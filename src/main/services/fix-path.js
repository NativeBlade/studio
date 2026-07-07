import { execFile } from 'child_process';

/**
 * A macOS/Linux app launched from Finder/Dock (not a terminal) inherits a
 * minimal PATH — usually just /usr/bin:/bin — so Homebrew, nvm/npm-global and
 * user-installed tools (php, node, composer, claude, git, cloudflared) are
 * invisible and every spawn fails "command not found". We ask the user's login
 * shell for its real PATH and adopt it, plus a few well-known bins as a
 * fallback. No-op on Windows and when already launched from a shell.
 */
export function fixPath() {
    if (process.platform === 'win32') return Promise.resolve();

    const extras = [
        '/opt/homebrew/bin', '/opt/homebrew/sbin', // Apple Silicon Homebrew
        '/usr/local/bin', '/usr/local/sbin', // Intel Homebrew / manual
        `${process.env.HOME}/.local/bin`, // pip/user installs, our cloudflared
        `${process.env.HOME}/.composer/vendor/bin`, // global composer bins
        `${process.env.HOME}/.nvm/current/bin`,
    ];

    return new Promise((resolve) => {
        const shell = process.env.SHELL || '/bin/zsh';
        // Login+interactive shell so it sources the user's profile (where PATH
        // is set). Timeboxed so a slow profile can't hang startup.
        execFile(shell, ['-ilc', 'echo -n "$PATH"'], { timeout: 4000 }, (err, stdout) => {
            const current = (process.env.PATH || '').split(':');
            const fromShell = !err && stdout ? stdout.trim().split(':') : [];
            const merged = [...new Set([...fromShell, ...current, ...extras])].filter(Boolean);
            process.env.PATH = merged.join(':');
            resolve();
        });
    });
}
