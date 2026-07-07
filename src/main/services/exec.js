import { exec } from 'child_process';

/**
 * Runs a shell command on the user's machine. Only ever called after the
 * user explicitly approved the exact command string in the chat UI.
 */
export function runCommand(command, { timeout = 300_000 } = {}) {
    return new Promise((resolve) => {
        exec(command, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({
                ok: !err,
                exitCode: err?.code ?? 0,
                output: [String(stdout || ''), String(stderr || '')].filter(Boolean).join('\n').slice(-8000),
            });
        });
    });
}
