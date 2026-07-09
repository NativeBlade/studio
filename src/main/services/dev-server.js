import { existsSync } from 'fs';
import { join } from 'path';
import { createServer } from 'net';
import os from 'os';
import { spawnManaged, killTree } from './child-registry.js';

/**
 * The IPv4 a phone on the same WiFi can reach. The naive "first non-internal
 * IPv4" grabs whatever the OS lists first, which on Windows is often a virtual
 * adapter (WSL / Hyper-V / Docker / VPN, usually a 172.x address) the phone
 * can't route to. So we score candidates: real home/office ranges win, virtual
 * adapters are penalized by name, and link-local (169.254.x) is dropped.
 */
function lanAddress() {
    const candidates = [];
    for (const [name, nics] of Object.entries(os.networkInterfaces())) {
        for (const nic of nics ?? []) {
            if (nic.family !== 'IPv4' || nic.internal) continue;
            if (nic.address.startsWith('169.254.')) continue; // APIPA, not routable
            candidates.push({ name, address: nic.address });
        }
    }
    if (!candidates.length) return null;

    const score = ({ name, address }) => {
        let s = 0;
        if (address.startsWith('192.168.')) s += 100;          // classic home/office LAN
        else if (/^10\./.test(address)) s += 80;               // common LAN / router range
        else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) s += 20; // private, but often virtual on Windows
        // Virtual / VPN adapters the phone can't reach:
        if (/vethernet|wsl|hyper-?v|virtualbox|vmware|docker|default switch|loopback|tailscale|zerotier|tap-|npcap|radmin/i.test(name)) s -= 200;
        return s;
    };
    candidates.sort((a, b) => score(b) - score(a));
    return candidates[0].address;
}

/**
 * One live preview per app: `php artisan nativeblade:dev --platform=browser`
 * on a free port, embedded in the workspace iframe. Vite hot-reloads as the
 * AI edits, so the preview follows the build with no extra steps.
 */

const servers = new Map(); // appId -> { child, url, lanUrl }

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

export async function startPreview({ appId, dir, emit }) {
    if (!existsSync(join(dir, 'src-tauri'))) return; // not scaffolded yet — nothing to serve

    const existing = servers.get(appId);
    if (existing) {
        emit({ type: 'preview', status: existing.url ? 'up' : 'starting', url: existing.url, lanUrl: existing.lanUrl });
        return;
    }

    emit({ type: 'preview', status: 'starting', url: null, lanUrl: null });

    const port = await freePort();
    const child = spawnManaged(`php artisan nativeblade:dev --platform=browser --port=${port}`, {
        cwd: dir,
        // REPL_ID makes the dev command treat us as headless, skipping vite's
        // --open (which would pop the user's browser). TODO: replace with a
        // proper --no-open flag in the next framework release.
        env: { ...process.env, REPL_ID: 'nativeblade-studio' },
    });
    const entry = { child, url: null, lanUrl: null };
    servers.set(appId, entry);

    child.stdout.on('data', (chunk) => {
        if (entry.url) return;
        // Wait for vite's "Local:" line — the command banner prints the URL
        // before the server is actually accepting connections.
        const clean = chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
        const m = clean.match(/Local:\s*(http:\/\/localhost:\d+)/);
        if (m) {
            entry.url = m[1];
            const lan = lanAddress();
            entry.lanUrl = lan ? m[1].replace('localhost', lan) : null;
            emit({ type: 'preview', status: 'up', url: entry.url, lanUrl: entry.lanUrl });
        }
    });

    child.on('close', () => {
        // Only report "down" if this is still the active server. On a quick
        // leave→reopen, the old process's close fires AFTER the new one's
        // "starting" — without this guard it clobbers the new state and the
        // badge wrongly reads "Server stopped".
        if (servers.get(appId) === entry) {
            servers.delete(appId);
            emit({ type: 'preview', status: 'down', url: null, lanUrl: null });
        }
    });
}

/**
 * Kill the dev server and resolve only once the process has actually exited,
 * so the caller (e.g. Back, before a delete) can wait for the file locks on
 * node_modules to be released. Caps the wait so it never hangs.
 */
export function stopPreview(appId) {
    const entry = servers.get(appId);
    if (!entry) return Promise.resolve();
    servers.delete(appId);
    const child = entry.child;
    if (!child || child.exitCode !== null) { killTree(child); return Promise.resolve(); }
    return new Promise((resolve) => {
        const done = () => { clearTimeout(t); resolve(); };
        const t = setTimeout(() => { child.removeListener('close', done); resolve(); }, 5000);
        child.once('close', done);
        killTree(child);
    });
}

/**
 * Recompile CSS and reboot the preview. Tailwind only compiles on
 * `npm run build`, and php-wasm bakes the stylesheet in at boot — so a reload
 * can't pick up new classes. The only reliable path is stop → build → start.
 */
export async function rebuildPreview({ appId, dir, emit }) {
    if (!existsSync(join(dir, 'src-tauri'))) return { ok: false };
    stopPreview(appId);
    emit({ type: 'preview', status: 'building', url: null, lanUrl: null });

    const code = await new Promise((resolve) => {
        const child = spawnManaged('npm run build', { cwd: dir });
        const timer = setTimeout(() => killTree(child), 300_000);
        child.on('close', (c) => { clearTimeout(timer); resolve(c); });
    });
    if (code !== 0) {
        emit({ type: 'preview', status: 'down', url: null, lanUrl: null });
        return { ok: false };
    }

    await startPreview({ appId, dir, emit }); // re-bundles the fresh CSS at boot
    return { ok: true };
}

export function stopAllPreviews() {
    for (const appId of [...servers.keys()]) stopPreview(appId);
}
