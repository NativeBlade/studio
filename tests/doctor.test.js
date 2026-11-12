import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor, formatDoctorNote } from '../src/main/services/doctor.js';

describe('doctor', () => {
    it('is unavailable for a folder that is not a Laravel app', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'nb-studio-doctor-'));
        try {
            assert.equal(await runDoctor(dir), null);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('writes no note for a clean scan', () => {
        assert.equal(formatDoctorNote(null), null);
        assert.equal(formatDoctorNote({ ok: true, findings: [] }), null);
    });

    it('lists every finding with file and line, capped', () => {
        const findings = Array.from({ length: 32 }, (_, i) => ({
            file: `app/F${i}.php`, line: i + 1, rule: 'suspension', severity: i % 2 ? 'warning' : 'error', message: `m${i}`,
        }));
        const note = formatDoctorNote({ ok: false, findings });
        assert.match(note, /^\[Studio\] `php artisan nativeblade:doctor`/);
        assert.match(note, /1\. \[error\] app\/F0\.php:1: m0/);
        assert.match(note, /30\. \[warning\] app\/F29\.php:30: m29/);
        assert.match(note, /\(\+2 more\)$/);
        assert.doesNotMatch(note, /F31\.php/);
        assert.match(note, /Do not mention this note/);
    });
});
