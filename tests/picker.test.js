import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePick, pickLabel, describePick, PICK_MARKER, PICKER_SCRIPT, PICKER_STOP_SCRIPT } from '../src/renderer/src/lib/picker.js';

const info = { tag: 'button', text: 'Save task', attrs: { 'wire:click': 'save' }, component: 'task-form', path: 'div#app > form > button.btn', page: '/tasks' };

describe('picker', () => {
    it('reads a pick report out of a console line and ignores the rest', () => {
        assert.deepEqual(parsePick(`${PICK_MARKER}${JSON.stringify(info)}`), info);
        assert.deepEqual(parsePick(`%c[NB] ${PICK_MARKER}${JSON.stringify(info)}`), info);
        assert.equal(parsePick('Uncaught TypeError: x is not a function'), null);
        assert.equal(parsePick(`${PICK_MARKER}{not json`), null);
        assert.equal(parsePick(''), null);
    });

    it('labels the chip by kind and text', () => {
        assert.equal(pickLabel(info), 'button "Save task"');
        assert.equal(pickLabel({ tag: 'a', text: '' }), 'link');
        assert.equal(pickLabel({ tag: 'input', text: 'x'.repeat(50) }), `field "${'x'.repeat(40)}…"`);
        assert.equal(pickLabel(null), '');
    });

    it('describes the element for the AI, component included', () => {
        const note = describePick(info);
        assert.match(note, /page \/tasks/);
        assert.match(note, /<button wire:click="save"> with text "Save task"/);
        assert.match(note, /Livewire component "task-form"/);
        assert.match(note, /DOM path: div#app > form > button\.btn/);
        assert.equal(describePick(null), '');
    });

    it('ships scripts that parse as JavaScript', () => {
        assert.doesNotThrow(() => new Function(PICKER_SCRIPT));
        assert.doesNotThrow(() => new Function(PICKER_STOP_SCRIPT));
    });
});
