/**
 * The app's log lines as the NativeBlade dev server prints them:
 *
 *   [nb:app:error] 14:03:22.118 PHP crashed (memory access out of bounds). ...
 *   [nb:php:warn] 14:03:25.002 Undefined variable $x {"file":"..."}
 *
 * `[nb:<source>:<level>]`, an optional time, the message, and an optional
 * JSON context at the end. Everything else the server prints (Vite, the
 * bundle watcher) is ignored. Leaf module, no Electron, so it is unit-tested.
 */

const LINE = /^\[nb:(app|php):(\w+)\]\s*(?:\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+)?(.*)$/;

/** @returns {{source: string, level: string, message: string}|null} */
export function parseLogLine(line) {
    const m = LINE.exec(line.trim());
    if (!m) return null;
    return { source: m[1], level: m[2].toLowerCase(), message: m[3].trim() };
}

/**
 * Feed raw chunks (ANSI already stripped); complete lines that are app
 * warnings or errors reach `onLog`. Partial lines wait for the rest.
 */
export function createLogReader(onLog) {
    let rest = '';
    return (chunk) => {
        rest += chunk;
        const lines = rest.split(/\r?\n/);
        rest = lines.pop() ?? '';
        for (const line of lines) {
            const log = parseLogLine(line);
            if (log && (log.level === 'error' || log.level === 'warn')) onLog(log);
        }
    };
}

/** A runtime crash report from the shell; the one line worth a fix turn of its own. */
export function isCrashReport(log) {
    return log?.level === 'error' && /^PHP crashed/.test(log.message || '');
}
