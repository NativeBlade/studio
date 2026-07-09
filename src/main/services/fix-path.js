import { execFile } from 'child_process';
import { delimiter } from 'path';

/**
 * A GUI-launched app inherits a stale/minimal PATH, so tools the user installed
 * are invisible and every spawn fails "command not found":
 *  - macOS/Linux from Finder/Dock: PATH is usually just /usr/bin:/bin, missing
 *    Homebrew, nvm/npm-global and user bins.
 *  - Windows: the process captures PATH at launch, so a CLI installed AFTER the
 *    app started (e.g. Grok Build, which adds its own dir to the user PATH) is
 *    missing until the app restarts — and even then only if we read the PATH
 *    the installer persisted, not the frozen one Explorer handed us.
 *
 * We rebuild process.env.PATH from the authoritative source per OS and merge it
 * over what we already have. Runs once at startup; a CLI installed while the app
 * is open is picked up on the next launch (the user just restarts the Studio).
 */
export function fixPath() {
    return process.platform === 'win32' ? fixPathWindows() : fixPathUnix();
}

// Prepend the given dirs to PATH, de-duped, using this OS's separator.
function merge(dirs) {
    const seen = new Set();
    process.env.PATH = [...dirs, ...(process.env.PATH || '').split(delimiter)]
        .map((p) => p.trim())
        .filter((p) => p && !seen.has(p) && seen.add(p))
        .join(delimiter);
}

// Windows: the real PATH lives in the registry (Machine + User). GetEnvironment
// Variable expands %VARS% and reflects installs done after the app launched.
function fixPathWindows() {
    return new Promise((resolve) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"],
            { timeout: 5000, windowsHide: true },
            (err, stdout) => {
                if (!err && stdout) merge(stdout.split(';'));
                resolve();
            },
        );
    });
}

// macOS/Linux: ask the login shell for its real PATH, plus well-known bins.
function fixPathUnix() {
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
            const fromShell = !err && stdout ? stdout.trim().split(':') : [];
            merge([...fromShell, ...extras]);
            resolve();
        });
    });
}
