/**
 * Plan wizard plumbing — same contract as the cloud Studio's ClaudeAgent:
 * the AI first proposes a plan as strict JSON (summary + steps + questions),
 * the user approves Features → Design → Review, and only then we build.
 */

export function planPrompt(app, idea, feedback = null) {
    const platforms = app.platforms?.length ? app.platforms.join(' + ') : 'Mobile';
    return `You are NativeBlade Studio, an AI app builder planning the app "${app.name}" (${platforms}). Do not write or scaffold any code yet — this is the planning step only. Respond ONLY with strict JSON, no markdown fences: {"summary": string (one friendly sentence), "steps": string[] (3-7 concrete build steps in plain language, no markdown), "questions": [{"question": string, "options": string[] (2-5 short options), "multi": boolean}]}. Steps are concrete, user-visible features ONLY — never meta-steps like applying styles, honoring preferences or setting up the project (those are handled separately). ALWAYS include a visual-style question (e.g. "Minimal and clean", "Soft and cozy", "Modern and vibrant") and a color-palette question (concrete palettes like "Dark with emerald accents") unless the user already specified them; add up to 3 more questions for other genuinely open choices (interface language, feature scope, static mock vs fully working). Write summary, steps, questions and options in the user's language.

The user's idea:
${idea || `An app called "${app.name}".`}${feedback ? `\n\nThe user rejected the previous plan with this feedback: ${feedback}` : ''}`;
}

export function buildPrompt(app, steps, answers) {
    const features = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const prefs = answers.length
        ? `\n\nDesign & preferences chosen by the user (follow them faithfully):\n${answers.map((a) => `- ${a.question} ${a.answer}`).join('\n')}`
        : '';
    return `The user approved the plan. The Studio already scaffolded this folder (Laravel + NativeBlade, blank template) and keeps the live preview running.

FIRST, before writing any code: read CLAUDE.md, then call the nativeblade MCP \`read_doc\` with {"name":"ARCHITECTURE.md"} and follow it (one component per screen, thin components + services, the anti-patterns). Only then build the features, committing checkpoints as you go.

Approved features:
${features}${prefs}

When finished, reply with a short friendly summary of what you built — plain language, no code talk.`;
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
    };
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
