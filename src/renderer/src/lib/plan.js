/**
 * Plan wizard plumbing — same contract as the cloud Studio's ClaudeAgent:
 * the AI first proposes a plan as strict JSON (summary + steps + questions),
 * the user approves Features → Design → Review, and only then we build.
 */

export function planPrompt(app, idea, feedback = null) {
    const platforms = app.platforms?.length ? app.platforms.join(' + ') : 'Mobile';
    return `You are NativeBlade Studio, an AI app builder planning the app "${app.name}" (${platforms}). Do not write or scaffold any code yet — this is the planning step only. Respond ONLY with strict JSON, no markdown fences: {"summary": string (one friendly sentence), "steps": string[] (3-7 concrete build steps in plain language, no markdown), "questions": [{"question": string, "options": string[] (2-5 short options), "multi": boolean}], "secrets": [{"env": string, "label": string, "help": string}]}. Steps are concrete, user-visible features ONLY — never meta-steps like applying styles, honoring preferences or setting up the project (those are handled separately). ALWAYS include a visual-style question (e.g. "Minimal and clean", "Soft and cozy", "Modern and vibrant") and a color-palette question (concrete palettes like "Dark with emerald accents") unless the user already specified them; add up to 3 more questions for other genuinely open choices (interface language, feature scope, static mock vs fully working). Write summary, steps, questions and options in the user's language.

"secrets" is for values ONLY THE USER CAN GET — a third-party API key, token or client secret that the planned features genuinely require (e.g. a Google Maps key for a map screen). The Studio collects them in a masked field and writes them into .env BEFORE the build, so you never have to ask for one mid-build and no secret ever lands in the chat. "env" is the .env key (UPPER_SNAKE_CASE), "label" is what the user reads (in their language), "help" tells them where to get it. Most apps need NONE — data can live in the local database; only list a key a planned feature truly cannot work without, and never invent one. Use [] when in doubt.

The user's idea:
${idea || `An app called "${app.name}".`}${feedback ? `\n\nThe user rejected the previous plan with this feedback: ${feedback}` : ''}`;
}

export function buildPrompt(app, steps, answers, secrets = []) {
    const features = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const prefs = answers.length
        ? `\n\nDesign & preferences chosen by the user (follow them faithfully):\n${answers.map((a) => `- ${a.question} ${a.answer}`).join('\n')}`
        : '';

    // The keys were collected in the wizard and are already in .env — say so, or
    // the AI stops mid-build to ask for something it already has. Skipped ones
    // are named too: silence there would have it assume the value exists.
    const given = secrets.filter((s) => s.value);
    const skipped = secrets.filter((s) => !s.value);
    const keys = given.length
        ? `\n\nThe user already provided these in \`.env\` — read them with \`env()\`/\`config()\` and never ask for them again:\n${given.map((s) => `- ${s.env} (${s.label})`).join('\n')}`
        : '';
    const missing = skipped.length
        ? `\n\nThe user SKIPPED these keys, so they are NOT in \`.env\`:\n${skipped.map((s) => `- ${s.env} (${s.label})`).join('\n')}\nBuild the rest of the app anyway and degrade that feature gracefully (a friendly placeholder, never a crash). Do not block on them and do not invent values.`
        : '';

    return `The user approved the plan. The Studio already scaffolded this folder (Laravel + NativeBlade, blank template) and keeps the live preview running.${keys}${missing}

FIRST, before writing any code: read CLAUDE.md, then call the nativeblade MCP \`read_doc\` with {"name":"ARCHITECTURE.md"} and follow it (one component per screen, thin components + services, the anti-patterns). Only then build the features, committing checkpoints as you go.

Approved features:
${features}${prefs}

When finished, reply with a short friendly summary of what you built — plain language, no code talk.`;
}

/**
 * Asked as its own short turn right after a build, NOT as a marker buried in the
 * build's instructions: by the end of a hundred-step build that rule is
 * thousands of tokens away and loses to everything else, so it just never fires.
 * A tiny prompt whose only job is to answer JSON gets answered — same reason the
 * plan above works.
 */
export function suggestPrompt(app) {
    return `The app "${app.name}" you just built is a REAL native app (NativeBlade: php-wasm + Tauri), not a web page — it can use the device camera, vibration/haptics, GPS, push notifications, files, native share, biometrics.

The user comes from web-based AI builders where none of that exists, so it never occurs to them to ask. Based on what you just built, propose up to 4 native powers that genuinely fit THIS app.

Respond ONLY with strict JSON, no markdown fences:
{"items":[{"label": string, "prompt": string}]}

- "label": what the user reads — short (max 6 words), concrete, the RESULT they get ("Photograph the dish"), never jargon ("integrate the Camera API"). In the user's language.
- "prompt": the instruction sent back to you as if the user wrote it — clear and self-contained.
- ONLY native capabilities the web can't do. Never CSS/UI/refactor work.
- Only what suits this app and what NativeBlade really supports. Never repeat something the app already has.
- Two great ideas beat four filler ones. If nothing genuinely fits, reply {"items":[]}.`;
}

/**
 * Should a finished turn be followed by a suggestion round?
 *
 * Only when the run is genuinely over. A `done` event does NOT mean that: the AI
 * ends its turn to wait for a generated image, or parked on an API key the user
 * still has to paste. Offering "add the camera!" over a half-built app waiting
 * on its key is nonsense — and asking after a 'suggest' turn loops forever.
 */
export function shouldSuggest({ mode, images, waitingSecret }) {
    if (mode !== 'chat' && mode !== 'build') return false; // 'plan' has no app yet; 'suggest' would loop
    return !images?.length && !waitingSecret;
}

// Four is what fits on one row without turning a nudge into a menu.
const MAX_SUGGESTIONS = 4;

/** Extracts the suggestion JSON from the model's reply; anything odd → none. */
export function parseSuggestions(text) {
    let json = null;
    try {
        const cleaned = (text || '').replace(/^```(?:json)?|```$/gm, '');
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) json = JSON.parse(match[0]);
    } catch { /* no suggestions is a fine outcome — never a broken chat */ }

    const items = Array.isArray(json?.items) ? json.items : [];
    return items
        .filter((it) => typeof it?.label === 'string' && it.label.trim() && typeof it?.prompt === 'string' && it.prompt.trim())
        .slice(0, MAX_SUGGESTIONS)
        .map((it) => ({ label: it.label.trim().slice(0, 60), prompt: it.prompt.trim() }));
}

/** Extracts the plan JSON from the model's final text; falls back gracefully. */
export function parsePlan(text, app) {
    let json = null;
    try {
        const cleaned = (text || '').replace(/^```(?:json)?|```$/gm, '');
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) json = JSON.parse(match[0]);
    } catch { /* fall through to defaults */ }

    return {
        summary: json?.summary || `Here is my plan to build ${app.name}.`,
        steps: Array.isArray(json?.steps) && json.steps.length ? json.steps.map(String) : [`Build the first version of ${app.name}`],
        questions: questionsOrDefaults(json?.questions),
        secrets: parsePlanSecrets(json?.secrets),
    };
}

// Same validation the [[NB_SECRET]] marker applies: the key has to be a usable
// .env name, since it's written straight into the file.
function parsePlanSecrets(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter((s) => typeof s?.env === 'string' && /^[A-Z0-9_]+$/i.test(s.env))
        .slice(0, 4) // a plan asking for more keys than this has misunderstood the job
        .map((s) => ({
            env: s.env,
            label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : s.env,
            help: typeof s.help === 'string' && s.help.trim() ? s.help.trim() : null,
        }));
}

/** The design step must always exist for a new build — same rule as the cloud. */
function questionsOrDefaults(raw) {
    const questions = (Array.isArray(raw) ? raw : [])
        .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({ question: q.question, options: q.options.map(String).slice(0, 5), multi: !!q.multi }))
        .slice(0, 5);
    if (questions.length) return questions;
    return [
        { question: 'What visual style do you want?', options: ['Minimal and clean', 'Soft and cozy', 'Modern and vibrant', 'Playful and colorful'], multi: false },
        { question: 'Which color palette?', options: ['Dark with emerald accents', 'Light with blue accents', 'Warm earth tones', 'Black & white with one accent'], multi: false },
    ];
}
