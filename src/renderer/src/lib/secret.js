/**
 * The markers the AI ends a turn with, and how they're read back.
 *
 * All of them look like [[NAME]]{json}[[/NAME]]. They are NOT matched with a
 * regex over both tags: real models drop the closing tag (Claude does it), and
 * a pattern that demands it silently fails — leaving raw JSON in the chat and,
 * worse, never firing the action the marker asked for. So the payload is found
 * by scanning the JSON object itself, the closing tag is optional, and anything
 * unreadable is cut out anyway. A marker must never reach the user's eyes.
 */

/**
 * Read one balanced JSON object out of `text` starting at `start` (a '{').
 * String-aware, so a brace inside a prompt or label doesn't skew the depth.
 * Returns { json, end } — `end` is the index just past the closing brace — or
 * null when the payload is truncated.
 */
function scanObject(text, start) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return { json: text.slice(start, i + 1), end: i + 1 };
    }
    return null;
}

/**
 * Hand every [[name]] payload in `text` to `onSpec`, and return the text with
 * the markers removed. Untouched (not even trimmed) when there's no marker, so
 * a plain answer reads exactly as the AI wrote it.
 */
function parseMarkers(text, name, onSpec) {
    const src = text || '';
    const open = `[[${name}]]`;
    const close = `[[/${name}]]`;
    let out = '';
    let i = 0;
    let found = false;

    for (;;) {
        const at = src.indexOf(open, i);
        if (at === -1) { out += src.slice(i); break; }
        found = true;
        out += src.slice(i, at);

        const brace = src.indexOf('{', at + open.length);
        const obj = brace === -1 ? null : scanObject(src, brace);
        if (obj) {
            try { onSpec(JSON.parse(obj.json)); } catch { /* unreadable payload — still swallowed */ }
            // Eat THIS marker's closing tag when the model bothered to emit one;
            // if it didn't, leave whatever follows alone — it's the user's text.
            const after = src.slice(obj.end);
            const gap = after.match(/^\s*/)[0].length;
            i = after.slice(gap).startsWith(close) ? obj.end + gap + close.length : obj.end;
        } else {
            // Truncated payload: drop to the closing tag if it exists, else to
            // the end — half a JSON blob on screen is worse than a lost line.
            const c = src.indexOf(close, at);
            i = c === -1 ? src.length : c + close.length;
        }
    }

    return found ? out.replace(/\n{3,}/g, '\n\n').trim() : src;
}

/**
 * The AI requests a user-only value (API key, token…) by emitting a marker
 * instead of asking in the chat — so the secret is entered in a masked card
 * and written to .env, never landing in the conversation log:
 *
 *   [[NB_SECRET]]{"env":"GOOGLE_MAPS_API_KEY","label":"Google Maps API key","help":"…"}[[/NB_SECRET]]
 */
export function parseSecrets(text) {
    const secrets = [];
    const stripped = parseMarkers(text, 'NB_SECRET', (spec) => {
        if (spec && typeof spec.env === 'string' && /^[A-Z0-9_]+$/i.test(spec.env)) {
            secrets.push({
                env: spec.env,
                label: spec.label || spec.env,
                help: typeof spec.help === 'string' ? spec.help : null,
            });
        }
    });
    return { secrets, stripped };
}

/**
 * The AI requests a generated image (logo, illustration…) by emitting a marker
 * with a prompt + a project-relative destination path; the Studio calls the
 * image provider, saves the PNG there, and tells the AI to continue:
 *
 *   [[NB_IMAGE]]{"prompt":"a flat fox logo","path":"src-tauri/icons/logo.png","size":"1024x1024"}[[/NB_IMAGE]]
 */
export function parseImages(text) {
    const images = [];
    const stripped = parseMarkers(text, 'NB_IMAGE', (spec) => {
        const path = typeof spec?.path === 'string' ? spec.path.replace(/^[\\/]+/, '') : '';
        if (spec && typeof spec.prompt === 'string' && spec.prompt.trim() && path && !path.includes('..')) {
            images.push({ prompt: spec.prompt, path, size: typeof spec.size === 'string' ? spec.size : '1024x1024' });
        }
    });
    return { images, stripped };
}

const REBUILD_RE = /\[\[NB_REBUILD\]\]/g;

/**
 * CSS/Tailwind changes need a full stop → npm run build → start (php-wasm
 * bakes the stylesheet at boot, so nothing lighter picks up new classes). The
 * AI emits [[NB_REBUILD]] when it touched CSS; strip it and flag the rebuild.
 * No payload here, so there's nothing to scan — a flat replace is enough.
 */
export function stripRebuild(text) {
    const rebuild = REBUILD_RE.test(text || '');
    const cleaned = rebuild ? (text || '').replace(REBUILD_RE, '').replace(/\n{3,}/g, '\n\n').trim() : (text || '');
    return { rebuild, text: cleaned };
}
