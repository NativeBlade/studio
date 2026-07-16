import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { spawnManaged, killTree } from './child-registry.js';
import { writeContextFiles } from './context-files.js';

/**
 * Deterministic NativeBlade scaffold — the Node port of the studio-box
 * scaffold.sh. The Studio runs it itself on "Approve & build" (the AI only
 * builds features on top): agents fumbling the setup is exactly what wedged
 * the web Studio, and nativeblade:install without --id hangs on a hidden
 * interactive prompt. Every command is emitted as a tool event so the user
 * watches it happen in the chat's progress group.
 *
 * Always fetches the LATEST framework version at create time (never pinned).
 */

const STEP_TIMEOUT = 900_000; // composer/npm steps can be slow on cold cache

function run(command, cwd) {
    return new Promise((resolve) => {
        const child = spawnManaged(command, { cwd });
        let output = '';
        const timer = setTimeout(() => killTree(child), STEP_TIMEOUT);
        child.stdout.on('data', (c) => { output += c.toString(); });
        child.stderr.on('data', (c) => { output += c.toString(); });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, output });
        });
    });
}

/** Installed version of a composer package, or null if we can't tell. */
async function packageVersion(dir, pkg) {
    const { code, output } = await run(`composer show ${pkg} --no-interaction`, dir);
    return code === 0 ? (output.match(/versions\s*:\s*\*?\s*(\S+)/)?.[1] ?? null) : null;
}

/**
 * Refresh NativeBlade in an app. Same reasoning as the scaffold: the Studio owns
 * the framework commands, the AI only builds on top.
 *
 * Returns { ok, note }. `ok` means the check ran to completion — including
 * "already current", which still counts, or the caller would re-run composer on
 * every single request. `note` is only set when something actually moved, and is
 * what gets handed to the AI.
 */
export async function updateFramework({ dir, emit }) {
    if (!existsSync(join(dir, 'artisan'))) return { ok: false, note: null }; // never scaffolded

    const before = await packageVersion(dir, 'nativeblade/nativeblade');

    emit({ type: 'tool', name: 'Bash', label: 'Updating NativeBlade', detail: 'composer update nativeblade/nativeblade --no-interaction' });
    const update = await run('composer update nativeblade/nativeblade --no-interaction', dir);
    if (update.code !== 0) {
        // Offline or a locked dependency — not worth failing the user's request
        // over. Not ok, so we try again next time instead of waiting a week.
        emit({ type: 'tool', name: 'Bash', label: "Couldn't update NativeBlade — continuing on the current version", detail: null });
        return { ok: false, note: null };
    }

    emit({ type: 'tool', name: 'Bash', label: 'Applying the NativeBlade update', detail: 'php artisan nativeblade:update' });
    const migrate = await run('php artisan nativeblade:update', dir);
    if (migrate.code !== 0) {
        emit({ type: 'error', message: `php artisan nativeblade:update failed:\n${migrate.output.trim().slice(-900)}` });
        return { ok: false, note: null };
    }

    const after = await packageVersion(dir, 'nativeblade/nativeblade');
    if (before && after && before === after) {
        emit({ type: 'tool', name: 'Bash', label: `NativeBlade is already up to date (${after})`, detail: null });
        return { ok: true, note: null }; // nothing moved — don't spend the AI's context saying so
    }

    const moved = before && after ? `from ${before} to ${after}` : after ? `to ${after}` : 'to the latest version';
    // The AI needs to know this happened: it explains any diff in vendor/ or
    // config, and it may need to adapt the app to whatever the update changed.
    return {
        ok: true,
        note: [
            `[Studio] I updated NativeBlade ${moved} before this request`,
            '(`composer update nativeblade/nativeblade` + `php artisan nativeblade:update`). Output of the update:',
            '',
            migrate.output.trim().slice(-1200) || '(no output)',
            '',
            'Take this into account: if the update changed anything the app relies on, fix it as part of this request.',
        ].join('\n'),
    };
}

export async function scaffoldApp({ dir, appInfo, env, emit }) {
    const step = async (label, command) => {
        emit({ type: 'tool', name: 'Bash', label, detail: command });
        const { code, output } = await run(command, dir);
        if (code !== 0) {
            emit({ type: 'error', message: `${label} failed:\n${output.trim().slice(-900)}` });
            return false;
        }
        return true;
    };

    if (!existsSync(join(dir, 'src-tauri'))) {
        if (!existsSync(join(dir, 'artisan'))) {
            // create-project requires an empty folder; the context files are ours to remove.
            for (const f of ['CLAUDE.md', 'AGENTS.md', '.mcp.json']) {
                const p = join(dir, f);
                if (existsSync(p)) rmSync(p);
            }
            if (readdirSync(dir).length > 0) {
                emit({ type: 'error', message: `The folder ${dir} is not empty, so the app scaffold can't start. Move its contents away (or delete this app and create a new one) and approve the plan again.` });
                return false;
            }
            if (!await step('Creating the Laravel app', 'composer create-project "laravel/laravel:^13.0" . --no-interaction')) return false;
        } else {
            // Idempotent resume: an earlier attempt already created the Laravel app.
            emit({ type: 'tool', name: 'Bash', label: 'Laravel app already in place — resuming from there', detail: null });
        }

        if (!await step('Adding NativeBlade (latest)', 'composer require nativeblade/nativeblade --no-interaction')) return false;

        const name = String(appInfo.name || 'App').replace(/"/g, "'");
        // Reverse-DNS id: com.<company>.<app>. The company namespaces the id so
        // two users' apps never collide; the slug is already unique per library.
        // Each segment is lowercased to alphanumerics and made to start with a
        // letter (valid on both Android packages and iOS bundle ids).
        const seg = (v, fb) => {
            const s = String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return (!s || /^[0-9]/.test(s)) ? fb + s : s;
        };
        const id = `com.${seg(appInfo.company, 'co')}.${seg(appInfo.slug, 'app')}`;
        if (!await step('Installing NativeBlade', `php artisan nativeblade:install --name="${name}" --id="${id}" --template=blank --no-interaction`)) return false;

        // The live preview is `nativeblade:dev --platform=browser`; it just needs
        // the Laravel assets built once.
        if (!await step('Building the app assets', 'npm run build')) return false;
    }

    writeContextFiles(dir, appInfo, env);

    // Local git: every checkpoint is a commit, so rollback is a plain reset.
    // We only INIT the repo here (identity + no signing) and let the AI make the
    // first commit at the end of the build — one commit per request, no throwaway
    // "initial scaffold" checkpoint. Best-effort: a lay user has no git identity
    // (or no git at all), so the identity is set local to the repo and any failure
    // downgrades to a visible note instead of an error. `commit.gpgsign false` is
    // local so the AI's commit never hangs on a GPG passphrase prompt, even if the
    // user has signing on globally (a headless commit would wait forever for it).
    if (!existsSync(join(dir, '.git'))) {
        const gitCmd = 'git init -q && git config user.name "NativeBlade Studio" && git config user.email "studio@nativeblade.dev" && git config commit.gpgsign false';
        emit({ type: 'tool', name: 'Bash', label: 'Preparing version history', detail: gitCmd });
        const { code } = await run(gitCmd, dir);
        if (code !== 0) emit({ type: 'tool', name: 'Bash', label: 'Checkpoints unavailable on this machine — continuing without them', detail: null });
    }

    return true;
}
