import { spawn, execFile, execFileSync } from 'child_process';

/**
 * Every child the Studio spawns (AI CLIs, dev servers, scaffold steps, tunnels)
 * registers here, so quitting the app can kill the whole family. On Windows
 * `taskkill /T` walks the PID tree; on macOS/Linux we spawn detached so the
 * child is a process-group leader and one signal to the negative PID reaps the
 * shell AND its grandchildren (vite, php, cloudflared) — otherwise they orphan.
 */

const POSIX = process.platform !== 'win32';
const children = new Set();

/** Spawn a shell command, made killable-as-a-tree and tracked for cleanup. */
export function spawnManaged(command, opts = {}) {
    const child = spawn(command, [], { shell: true, windowsHide: true, detached: POSIX, ...opts });
    return register(child);
}

export function register(child) {
    if (!child?.pid) return child;
    children.add(child);
    child.on('close', () => children.delete(child));
    return child;
}

/** Kill a child and its whole process tree (async, best-effort). */
export function killTree(child) {
    if (!child || child.exitCode !== null) return;
    try {
        if (process.platform === 'win32') {
            execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
        } else {
            try { process.kill(-child.pid, 'SIGTERM'); } // negative pid = the process group
            catch { child.kill('SIGTERM'); }
        }
    } catch { /* already gone */ }
}

export function killAllSync() {
    for (const child of children) {
        try {
            if (process.platform === 'win32') {
                execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
            } else {
                try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
            }
        } catch { /* already gone */ }
    }
    children.clear();
}
