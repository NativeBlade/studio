import { spawn, execFile } from 'child_process';
import { spawnManaged, killTree } from './child-registry.js';

/**
 * Quick public tunnels via cloudflared — so the user can show a build to
 * someone outside their WiFi. Quick tunnels need no account/token: cloudflared
 * prints an `https://<random>.trycloudflare.com` URL we surface + QR.
 *
 * Honest limits: it exposes the local php-wasm dev server (heavy over the
 * internet) and anyone with the link can open it. For quick demos only.
 */

const tunnels = new Map(); // appId -> { child, url }

/** Is cloudflared on PATH? */
export function tunnelStatus() {
    return new Promise((resolve) => {
        execFile('cloudflared', ['--version'], { shell: true, windowsHide: true }, (err, stdout) => {
            resolve({ installed: !err, version: err ? null : String(stdout).trim() });
        });
    });
}

/**
 * winget/brew adds cloudflared to the machine/user PATH, but THIS process
 * still has its old PATH — so the freshly-installed binary is invisible until
 * we refresh it in-session (otherwise `cloudflared tunnel` fails → timeout).
 */
function refreshPathWindows() {
    return new Promise((resolve) => {
        execFile('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"],
            { windowsHide: true }, (err, stdout) => {
                if (!err && stdout && stdout.trim()) process.env.PATH = stdout.trim();
                resolve();
            });
    });
}

/** Install cloudflared per-OS (user-triggered). */
export function tunnelInstall() {
    const cmd = installCommand();
    return new Promise((resolve) => {
        const child = spawn(cmd, [], { shell: true, windowsHide: true });
        let out = '';
        child.stdout.on('data', (c) => { out += c.toString(); });
        child.stderr.on('data', (c) => { out += c.toString(); });
        child.on('close', async (code) => {
            if (process.platform === 'win32') await refreshPathWindows();
            if (process.platform === 'linux') addToPath(`${process.env.HOME}/.local/bin`);
            const status = await tunnelStatus(); // confirm it's now reachable in-session
            resolve({ ok: status.installed, needsRestart: code === 0 && !status.installed, output: out.trim().slice(-400) });
        });
    });
}

function installCommand() {
    if (process.platform === 'win32') {
        return 'winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements';
    }
    if (process.platform === 'darwin') return 'brew install cloudflared';
    // Linux: fetch the official static binary to a user-writable dir (no sudo).
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
    return `mkdir -p "$HOME/.local/bin" && curl -fsSL "${url}" -o "$HOME/.local/bin/cloudflared" && chmod +x "$HOME/.local/bin/cloudflared"`;
}

/** Prepend a dir to this process's PATH if it isn't already there. */
function addToPath(dir) {
    const sep = process.platform === 'win32' ? ';' : ':';
    if (dir && !(process.env.PATH || '').split(sep).includes(dir)) {
        process.env.PATH = `${dir}${sep}${process.env.PATH || ''}`;
    }
}

export function startTunnel({ appId, targetUrl }) {
    const existing = tunnels.get(appId);
    if (existing?.url) return Promise.resolve({ url: existing.url });
    if (existing) stopTunnel(appId); // stale, restart

    return new Promise((resolve) => {
        const child = spawnManaged(`cloudflared tunnel --url ${targetUrl}`);
        const entry = { child, url: null };
        tunnels.set(appId, entry);

        let settled = false;
        let log = '';
        const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
        const scan = (buf) => {
            const s = buf.toString();
            log += s;
            const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (m) { entry.url = m[0]; finish({ ok: true, url: m[0] }); }
        };
        child.stdout.on('data', scan);
        child.stderr.on('data', scan); // cloudflared prints the URL to stderr

        // Spawn failure (e.g. cloudflared not found even after install) → error now.
        child.on('error', (e) => finish({ ok: false, error: `Couldn't launch cloudflared: ${e.message}. Try restarting the Studio.` }));
        child.on('close', () => {
            tunnels.delete(appId);
            finish({ ok: false, error: /not recognized|not found|command not found/i.test(log)
                ? 'cloudflared was installed but not on PATH yet — restart NativeBlade Studio and try again.'
                : (log.trim().slice(-300) || 'The tunnel closed before it was ready.') });
        });
        setTimeout(() => finish({ ok: false, error: 'Timed out creating the link. Check your internet connection and try again.' }), 60_000);
    });
}

/** The live public URL for an app, if a tunnel is already running for it. */
export function currentTunnel(appId) {
    const entry = tunnels.get(appId);
    return { active: !!entry, url: entry?.url ?? null };
}

export function stopTunnel(appId) {
    const entry = tunnels.get(appId);
    if (!entry) return;
    tunnels.delete(appId);
    killTree(entry.child);
}

export function stopAllTunnels() {
    for (const appId of [...tunnels.keys()]) stopTunnel(appId);
}
