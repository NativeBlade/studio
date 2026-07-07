/**
 * The AI requests a user-only value (API key, token…) by emitting a marker
 * instead of asking in the chat — so the secret is entered in a masked card
 * and written to .env, never landing in the conversation log:
 *
 *   [[NB_SECRET]]{"env":"GOOGLE_MAPS_API_KEY","label":"Google Maps API key","help":"…"}[[/NB_SECRET]]
 */
const RE = /\[\[NB_SECRET\]\]\s*(\{[\s\S]*?\})\s*\[\[\/NB_SECRET\]\]/g;

/** Pull secret requests out of an AI message; returns the specs + the text with markers removed. */
export function parseSecrets(text) {
    const secrets = [];
    let stripped = text || '';
    for (const m of (text || '').matchAll(RE)) {
        try {
            const spec = JSON.parse(m[1]);
            if (spec && typeof spec.env === 'string' && /^[A-Z0-9_]+$/i.test(spec.env)) {
                secrets.push({
                    env: spec.env,
                    label: spec.label || spec.env,
                    help: typeof spec.help === 'string' ? spec.help : null,
                });
            }
        } catch { /* malformed marker — ignore */ }
    }
    if (secrets.length) stripped = stripped.replace(RE, '').replace(/\n{3,}/g, '\n\n').trim();
    return { secrets, stripped };
}

const REBUILD_RE = /\[\[NB_REBUILD\]\]/g;

/**
 * CSS/Tailwind changes need a full stop → npm run build → start (php-wasm
 * bakes the stylesheet at boot, so nothing lighter picks up new classes). The
 * AI emits [[NB_REBUILD]] when it touched CSS; strip it and flag the rebuild.
 */
export function stripRebuild(text) {
    const rebuild = REBUILD_RE.test(text || '');
    const cleaned = rebuild ? (text || '').replace(REBUILD_RE, '').replace(/\n{3,}/g, '\n\n').trim() : (text || '');
    return { rebuild, text: cleaned };
}
