import { existsSync } from 'fs';
import { join } from 'path';
import { spawnManaged, killTree } from './child-registry.js';

/**
 * `php artisan nativeblade:doctor --json`: the framework's static scan for PHP
 * that php-wasm cannot run on the device (sleep, sockets, processes, native
 * calls inside callbacks the runtime cannot pause). The Studio runs it after
 * every AI turn, deterministically, and hands the findings back to the AI —
 * a lay user cannot read "memory access out of bounds" on their phone, so
 * the check has to happen here, before the app ever reaches one.
 *
 * Returns null when the command is unavailable (an app on a NativeBlade
 * older than 37.7.16, or PHP missing), so callers skip the check instead of
 * showing an error the user cannot act on.
 */
const TIMEOUT = 120_000;

export function runDoctor(dir) {
    if (!existsSync(join(dir, 'artisan'))) return Promise.resolve(null);

    return new Promise((resolve) => {
        const child = spawnManaged('php artisan nativeblade:doctor --json', { cwd: dir });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => killTree(child), TIMEOUT);
        child.stdout.on('data', (c) => { stdout += c.toString(); });
        child.stderr.on('data', (c) => { stderr += c.toString(); });
        child.on('close', (code) => {
            clearTimeout(timer);
            // The command prints one JSON document; anything else (a missing
            // command, a PHP error) is "unavailable", never a finding.
            const start = stdout.indexOf('{');
            if (start === -1) return resolve(null);
            try {
                const json = JSON.parse(stdout.slice(start));
                if (!Array.isArray(json.findings)) return resolve(null);
                resolve({
                    ok: code === 0,
                    files: json.files ?? 0,
                    errors: json.errors ?? 0,
                    warnings: json.warnings ?? 0,
                    findings: json.findings.map((f) => ({
                        file: f.file, line: f.line, rule: f.rule, severity: f.severity, message: f.message,
                    })),
                });
            } catch {
                resolve(null);
            }
        });
        child.on('error', () => { clearTimeout(timer); resolve(null); });
        void stderr;
    });
}

/**
 * The note handed to the AI when the scan found something. Problems end the
 * PHP instance on iOS and macOS; warnings throw at runtime on every platform.
 * Both have to go, so the note does not distinguish them beyond the label.
 */
export function formatDoctorNote(result) {
    if (!result || !result.findings.length) return null;
    const lines = result.findings.slice(0, 30).map((f, i) => `${i + 1}. [${f.severity}] ${f.file}:${f.line}: ${f.message}`);
    const more = result.findings.length > lines.length ? `\n(+${result.findings.length - lines.length} more)` : '';
    return [
        '[Studio] `php artisan nativeblade:doctor` scanned the app after your last turn and found code php-wasm cannot run on the device.',
        'Problems end the PHP instance on iPhone and Mac (the Asyncify build); warnings throw NativeCallNotAllowed on every platform. Fix every item:',
        'move waits to the shell or drop them, replace sockets and curl with `Http::`, and collect the data before `usort`, `json_encode`, `preg_replace_callback` and the like.',
        'Then run `php artisan nativeblade:doctor` yourself until it is clean, bump the version, commit once, and reply with one short sentence in the user\'s language. Do not mention this note.',
        lines.join('\n') + more,
    ].join('\n');
}
