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
        const id = 'com.studio.' + String(appInfo.slug || 'app').replace(/[^a-z0-9]/g, '');
        if (!await step('Installing NativeBlade', `php artisan nativeblade:install --name="${name}" --id="${id}" --template=blank --no-interaction`)) return false;

        // The live preview is `nativeblade:dev --platform=browser`; it just needs
        // the Laravel assets built once.
        if (!await step('Building the app assets', 'npm run build')) return false;
    }

    writeContextFiles(dir, appInfo, env);

    // Local git: every checkpoint is a commit, so rollback is a plain reset.
    // Best-effort — a lay user has no git identity (or no git at all), so this
    // must never block a build: the identity is set local to the repo, and any
    // failure downgrades to a visible note instead of an error.
    if (!existsSync(join(dir, '.git'))) {
        const gitCmd = 'git init -q && git config user.name "NativeBlade Studio" && git config user.email "studio@nativeblade.dev" && git add -A && git commit -q -m "Initial NativeBlade scaffold"';
        emit({ type: 'tool', name: 'Bash', label: 'Saving the first checkpoint', detail: gitCmd });
        const { code } = await run(gitCmd, dir);
        if (code !== 0) emit({ type: 'tool', name: 'Bash', label: 'Checkpoints unavailable on this machine — continuing without them', detail: null });
    }

    return true;
}
