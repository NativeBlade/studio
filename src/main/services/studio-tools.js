import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import { webContents } from 'electron';
import { runDoctor } from './doctor.js';
import { appRoutes } from './routes.js';

/**
 * The Studio's own files inside an app live under `.studio/`: screenshots of
 * the preview (what the AI reads to "see" the app), one per checkpoint, and
 * support bundles. Never part of the app, so the folder is git-ignored.
 */
export const STUDIO_DIR = '.studio';

function studioDir(cwd, sub = '') {
    const dir = join(cwd, STUDIO_DIR, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    ensureIgnored(cwd);
    return dir;
}

function ensureIgnored(cwd) {
    const file = join(cwd, '.gitignore');
    try {
        const current = existsSync(file) ? readFileSync(file, 'utf-8') : '';
        if (current.split(/\r?\n/).some((l) => l.trim() === `${STUDIO_DIR}/` || l.trim() === STUDIO_DIR)) return;
        appendFileSync(file, `${current && !current.endsWith('\n') ? '\n' : ''}${STUDIO_DIR}/\n`);
    } catch { /* an app without a git repo still works */ }
}

/** Only names the Studio itself produces: no path from the renderer is trusted as is. */
function safeName(name) {
    return String(name || 'preview').replace(/[^a-z0-9/_-]/gi, '').replace(/\.\.+/g, '').replace(/^\/+/, '') || 'preview';
}

/**
 * Save what the preview shows right now as `.studio/<name>.png`. Returns the
 * project-relative path, which is what the AI gets told to read.
 */
export async function capturePreview({ webContentsId, cwd, name = 'preview' }) {
    const wc = webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed() || !cwd) return null;
    try {
        const image = await wc.capturePage();
        if (image.isEmpty()) return null;
        const rel = `${safeName(name)}.png`;
        const dir = studioDir(cwd, rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
        const file = join(dir, rel.slice(rel.lastIndexOf('/') + 1));
        writeFileSync(file, image.toPNG());
        return `${STUDIO_DIR}/${rel}`;
    } catch {
        return null;
    }
}

/** A saved screenshot as a data URL, for the checkpoint thumbnails. */
export function readShot({ cwd, name }) {
    const file = join(cwd, STUDIO_DIR, `${safeName(name)}.png`);
    if (!existsSync(file)) return null;
    try { return `data:image/png;base64,${readFileSync(file).toString('base64')}`; } catch { return null; }
}

/**
 * The screens worth visiting after a build: the app's own GET routes with no
 * parameters, from `php artisan route:list --json`. Framework and plumbing
 * routes are left out, so the tour only opens what the user would.
 */
export function listRoutes(cwd) {
    return new Promise((resolve) => {
        execFile('php', ['artisan', 'route:list', '--json'], { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            if (err) return resolve([]);
            try {
                const start = stdout.indexOf('[');
                const routes = JSON.parse(stdout.slice(start));
                resolve(appRoutes(routes));
            } catch {
                resolve([]);
            }
        });
    });
}

/**
 * Everything a maintainer asks for when something goes wrong, in one
 * Markdown file the user can paste: versions, the doctor's findings, the
 * app log, the last crash and console lines, and what the AI last said.
 */
export async function supportBundle({ cwd, extra = {} }) {
    const run = (cmd, args) => new Promise((resolve) => {
        execFile(cmd, args, { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
            resolve(((stdout || '') + (stderr || '')).trim() || (err ? `(failed: ${err.message})` : ''));
        });
    });

    const [version, php, node, logs, doctor] = await Promise.all([
        run('composer', ['show', 'nativeblade/nativeblade', '--no-interaction']).then((out) => out.match(/versions\s*:\s*\*?\s*(\S+)/)?.[1] ?? out.slice(0, 200)),
        run('php', ['-v']).then((out) => out.split('\n')[0]),
        run('node', ['-v']),
        run('php', ['artisan', 'nativeblade:logs', '--platform=desktop', '--lines=200']),
        runDoctor(cwd),
    ]);

    const when = new Date().toISOString();
    const lines = [
        `# Support bundle (${when})`,
        '',
        '## Environment',
        `- OS: ${process.platform} ${process.arch}`,
        `- NativeBlade: ${version}`,
        `- PHP: ${php}`,
        `- Node: ${node}`,
        `- Studio: ${extra.studioVersion || 'unknown'}, engine ${extra.engine || 'unknown'}`,
        '',
        '## nativeblade:doctor',
        doctor
            ? (doctor.findings.length
                ? doctor.findings.map((f) => `- [${f.severity}] ${f.file}:${f.line}: ${f.message}`).join('\n')
                : `No incompatible code found in ${doctor.files} PHP files.`)
            : '(unavailable on this NativeBlade version)',
        '',
        '## Last crash report',
        extra.lastCrash || '(none)',
        '',
        '## Recent console lines from the preview',
        (extra.console || []).map((e) => `- [${e.level}] ${e.text}`).join('\n') || '(none)',
        '',
        '## Last message from the AI',
        extra.lastAi || '(none)',
        '',
        '## nativeblade.log (last 200 lines)',
        '```',
        logs || '(empty)',
        '```',
        '',
    ];
    const content = lines.join('\n');
    const dir = studioDir(cwd);
    const file = join(dir, `support-${when.replace(/[:.]/g, '-')}.md`);
    writeFileSync(file, content);
    return { path: file, content };
}
