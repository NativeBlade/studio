/**
 * Ollama, over its HTTP API (default localhost:11434) — never the `ollama` CLI.
 * The daemon is what actually matters: it's common for the CLI to be off PATH
 * while Ollama runs fine, and Codex (which drives the local model via
 * `-c model_provider=ollama`) only ever speaks to the daemon anyway.
 */

const DEFAULT_HOST = 'http://localhost:11434';

// Ollama's own default context (0.32). NOT the model card's architectural max —
// the daemon ignores that and loads at its own ceiling, silently truncating the
// prompt once the conversation passes it.
const DEFAULT_CONTEXT = 32768;

// Studio-made variants are tagged like `ornith:35b-nb64k`: same weights, one
// parameter changed. They're an implementation detail, so they never show up in
// the model picker — the chosen size does.
const VARIANT = /-nb(\d+)k$/;

/** OLLAMA_HOST may be a bare host:port ("127.0.0.1:11434") or a full URL. */
function base() {
    const raw = (process.env.OLLAMA_HOST || '').trim().replace(/\/$/, '');
    if (!raw) return DEFAULT_HOST;
    return /^https?:\/\//.test(raw) ? raw : `http://${raw}`;
}

async function call(path, body, timeout = 4000) {
    try {
        const res = await fetch(`${base()}${path}`, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeout),
        });
        return res.ok ? await res.json() : null;
    } catch {
        return null; // not installed, or the daemon isn't running
    }
}

/** The running daemon's version, or null when Ollama isn't reachable. */
export async function ollamaVersion() {
    const body = await call('/api/version');
    return body?.version ?? null;
}

/**
 * Models pulled on this machine that can actually drive a coding agent. The
 * whole loop is tool calls, so anything without the "tools" capability (an
 * embedding model, a chat-only model) would just stall — filter those out.
 * Older daemons don't report capabilities at all; keep those rather than hide
 * every model behind a version detail.
 *
 * `maxContext` is the architecture's ceiling, which is what caps the context
 * picker — it's usually far above what the daemon actually loads.
 */
export async function ollamaModels() {
    const body = await call('/api/tags');
    return (body?.models ?? [])
        .filter((m) => !m.capabilities || m.capabilities.includes('tools'))
        .map((m) => ({ id: m.model ?? m.name, maxContext: m.details?.context_length ?? null }))
        .filter((m) => m.id && !VARIANT.test(m.id))
        .map((m) => ({ ...m, label: m.id }));
}

/**
 * The context window the daemon will really use for `model`. /api/ps is the
 * truth but only reports a model that's currently loaded, so fall back to the
 * size baked into a Studio variant, then to Ollama's default.
 */
export async function ollamaContext(model) {
    const body = await call('/api/ps');
    const loaded = (body?.models ?? []).find((m) => (m.model ?? m.name) === model);
    if (loaded?.context_length) return loaded.context_length;
    const variant = String(model || '').match(VARIANT);
    return variant ? Number(variant[1]) * 1024 : DEFAULT_CONTEXT;
}

/**
 * Point `model` at a given context size. Ollama only takes num_ctx on its own
 * /api/generate — Codex talks to the OpenAI-compatible endpoint, which has no
 * such field — so the size has to be baked into the model itself. /api/create
 * does that by writing a new manifest over the same blobs: instant, and no
 * extra disk.
 *
 * Returns the name Codex should run. Falls back to the base model if anything
 * goes wrong: a wrong-but-working context beats a dead engine.
 */
export async function ollamaEnsureContext(model, context) {
    if (!model || !context) return model;
    if (VARIANT.test(model)) return model; // already a variant
    const name = `${model}-nb${Math.round(context / 1024)}k`;

    const tags = await call('/api/tags');
    const exists = (tags?.models ?? []).some((m) => (m.model ?? m.name) === name);
    if (exists) return name;

    // Slower than the other calls: Ollama writes a manifest and re-reads the
    // model config, which on a 30B+ can take a few seconds.
    const made = await call('/api/create', { model: name, from: model, parameters: { num_ctx: context }, stream: false }, 60_000);
    return made?.status === 'success' ? name : model;
}
