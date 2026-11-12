import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appRoutes } from '../src/main/services/routes.js';

describe('routes', () => {
    it('keeps the app pages, home first, and drops parameters and plumbing', () => {
        const dump = [
            { method: 'GET|HEAD', uri: 'settings' },
            { method: 'GET|HEAD', uri: '/' },
            { method: 'POST', uri: 'tasks' },
            { method: 'GET|HEAD', uri: 'tasks/{task}' },
            { method: 'GET|HEAD', uri: 'livewire/update' },
            { method: 'GET|HEAD', uri: '_nativeblade/deep-link' },
            { method: 'GET|HEAD', uri: '__nb/boot' },
            { method: 'GET|HEAD', uri: 'up' },
            { method: 'GET|HEAD', uri: 'about' },
            { method: 'GET|HEAD', uri: 'about' },
        ];
        assert.deepEqual(appRoutes(dump), ['/', '/about', '/settings']);
    });

    it('tolerates garbage', () => {
        assert.deepEqual(appRoutes(null), []);
        assert.deepEqual(appRoutes([{}, { method: 'GET' }]), ['/']);
    });
});
