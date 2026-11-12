import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLogLine, createLogReader, isCrashReport } from '../src/main/services/dev-log.js';

describe('dev-log', () => {
    it('parses the lines the dev server prints for the app', () => {
        assert.deepEqual(parseLogLine('[nb:app:error] 14:03:22.118 PHP crashed (memory access out of bounds). {"path":"/orders","method":"GET"}'), {
            source: 'app', level: 'error', message: 'PHP crashed (memory access out of bounds). {"path":"/orders","method":"GET"}',
        });
        assert.deepEqual(parseLogLine('[nb:php:warn] Undefined variable $x'), { source: 'php', level: 'warn', message: 'Undefined variable $x' });
        assert.equal(parseLogLine('  VITE v5.4.11  ready in 300 ms'), null);
        assert.equal(parseLogLine('Local:   http://localhost:1420/'), null);
    });

    it('reassembles lines across chunks and keeps only warnings and errors', () => {
        const seen = [];
        const feed = createLogReader((log) => seen.push(log));
        feed('[nb:app:info] 10:00:00.000 hello\n[nb:php:err');
        feed('or] 10:00:01.000 Call to undefined function foo()\n[nb:app:warn] slow\n[nb:app:debug] x\n');
        feed('[nb:app:error] no newline yet');
        assert.deepEqual(seen.map((l) => `${l.level}:${l.message}`), ['error:Call to undefined function foo()', 'warn:slow']);
        feed('\n');
        assert.equal(seen.length, 3);
    });

    it('recognises a runtime crash report', () => {
        assert.equal(isCrashReport({ level: 'error', message: 'PHP crashed during HTTP GET https://a.test (unreachable). ...' }), true);
        assert.equal(isCrashReport({ level: 'error', message: 'Undefined variable $x' }), false);
        assert.equal(isCrashReport({ level: 'warn', message: 'PHP crashed' }), false);
        assert.equal(isCrashReport(null), false);
    });
});
