import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSecrets, parseImages, stripRebuild } from '../src/renderer/src/lib/secret.js';
import { parsePlan, parseSuggestions, shouldSuggest } from '../src/renderer/src/lib/plan.js';

describe('markers', () => {
    it('reads a secret marker with or without its closing tag and strips it', () => {
        const text = 'I need one key.\n[[NB_SECRET]]{"env":"MAPS_KEY","label":"Maps key","help":"console"}[[/NB_SECRET]]';
        const { secrets, stripped } = parseSecrets(text);
        assert.deepEqual(secrets, [{ env: 'MAPS_KEY', label: 'Maps key', help: 'console' }]);
        assert.equal(stripped.trim(), 'I need one key.');

        const open = parseSecrets('[[NB_SECRET]]{"env":"API_TOKEN"}');
        assert.deepEqual(open.secrets, [{ env: 'API_TOKEN', label: 'API_TOKEN', help: null }]);
        assert.equal(open.stripped.trim(), '');
    });

    it('rejects an image outside the project and defaults the size', () => {
        const { images } = parseImages('[[NB_IMAGE]]{"prompt":"a fox","path":"/public/fox.png"}[[/NB_IMAGE]][[NB_IMAGE]]{"prompt":"x","path":"../etc/passwd"}[[/NB_IMAGE]]');
        assert.deepEqual(images, [{ prompt: 'a fox', path: 'public/fox.png', size: '1024x1024' }]);
    });

    it('strips the rebuild marker', () => {
        assert.deepEqual(stripRebuild('Done.\n\n[[NB_REBUILD]]\n'), { rebuild: true, text: 'Done.' });
        assert.deepEqual(stripRebuild('Done.'), { rebuild: false, text: 'Done.' });
    });
});

describe('plan', () => {
    it('parses the plan JSON and falls back to defaults', () => {
        const plan = parsePlan('```json\n{"summary":"A todo app.","steps":["List","Add"],"extras":[{"label":"Reminders","why":"Never miss one."},{"label":""}],"styles":[{"label":"Paper notebook","description":"Lined cards, serif headings."}],"palettes":[{"label":"Ink","colors":["#111111","#1f1f1f","#fafafa","#f43f5e"]},{"label":"Broken","colors":["red","#123"]}],"questions":[{"question":"Language?","options":["A","B"],"multi":false}],"secrets":[{"env":"X_KEY","label":"X"}]}\n```', { name: 'Todo' });
        assert.equal(plan.summary, 'A todo app.');
        assert.deepEqual(plan.steps, ['List', 'Add']);
        assert.deepEqual(plan.extras, [{ label: 'Reminders', why: 'Never miss one.' }]);
        assert.deepEqual(plan.styles, [{ label: 'Paper notebook', description: 'Lined cards, serif headings.' }]);
        assert.deepEqual(plan.palettes, [{ label: 'Ink', colors: ['#111111', '#1f1f1f', '#fafafa', '#f43f5e'] }]);
        assert.equal(plan.questions.length, 1);
        assert.deepEqual(plan.secrets, [{ env: 'X_KEY', label: 'X', help: null }]);

        const fallback = parsePlan('not json', { name: 'Todo' });
        assert.deepEqual(fallback.steps, ['Build the first version of Todo']);
        assert.deepEqual(fallback.extras, []);
        assert.equal(fallback.questions.length, 0);
        assert.ok(fallback.styles.length >= 3);
        assert.ok(fallback.palettes.every((p) => p.colors.length === 4 && p.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))));
        assert.deepEqual(fallback.secrets, []);
    });

    it('parses suggestions and caps them at four', () => {
        const items = Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, prompt: `P${i}` }));
        assert.equal(parseSuggestions(JSON.stringify({ items })).length, 4);
        assert.deepEqual(parseSuggestions('garbage'), []);
        assert.deepEqual(parseSuggestions('{"items":[{"label":"","prompt":"x"}]}'), []);
    });

    it('only suggests after a real, finished turn', () => {
        assert.equal(shouldSuggest({ mode: 'chat', images: null, waitingSecret: false }), true);
        assert.equal(shouldSuggest({ mode: 'build', images: null, waitingSecret: false }), true);
        assert.equal(shouldSuggest({ mode: 'plan', images: null, waitingSecret: false }), false);
        assert.equal(shouldSuggest({ mode: 'suggest', images: null, waitingSecret: false }), false);
        assert.equal(shouldSuggest({ mode: 'chat', images: [{}], waitingSecret: false }), false);
        assert.equal(shouldSuggest({ mode: 'chat', images: null, waitingSecret: true }), false);
    });
});
