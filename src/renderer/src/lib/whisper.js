/**
 * Local speech-to-text with Whisper (base, multilingual) via transformers.js —
 * runs in the renderer (WASM), no API key, audio never leaves the machine.
 * The model (~80MB) downloads once and is cached by the browser.
 *
 * transformers.js is imported dynamically so its weight (and any bundling
 * quirks) only load when the user actually dictates — never on boot.
 */

const MODEL = 'Xenova/whisper-base';
let asrPromise = null;

/** Lazily create the ASR pipeline; onProgress reports the model download (0-100). */
function getPipeline(onProgress) {
    if (!asrPromise) {
        asrPromise = (async () => {
            const { pipeline, env } = await import('@xenova/transformers');
            env.allowLocalModels = false; // only the remote HF model
            return pipeline('automatic-speech-recognition', MODEL, {
                progress_callback: (p) => {
                    if (p.status === 'progress' && onProgress) onProgress(Math.round(p.progress || 0));
                },
            });
        })().catch((e) => { asrPromise = null; throw e; });
    }
    return asrPromise;
}

/**
 * Transcribe 16kHz mono PCM samples. `language` is a full name Whisper knows
 * ('portuguese', 'english', …) or null to auto-detect.
 */
export async function transcribe(samples, language, onProgress) {
    const asr = await getPipeline(onProgress);
    const out = await asr(samples, {
        chunk_length_s: 30,
        language: language || null,
        task: 'transcribe',
    });
    return (out?.text || '').trim();
}
