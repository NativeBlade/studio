import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

/**
 * Optional image generation, independent of the code AI. The user brings their
 * own image-API key (OpenAI / Google / xAI); the Studio calls the API from the
 * main process (key never touches the renderer or the chat) and hands back the
 * PNG bytes. The AI requests images via an [[NB_IMAGE]] marker (wired later);
 * for now the setup screen validates a provider with a one-shot Test.
 *
 * Config lives in userData/image-provider.json — a BYO local tool, same place a
 * CLI would keep a token. Model ids are the current picks (Imagen is retiring
 * Aug 2026, so Google uses Nano Banana); bump them here as vendors ship.
 */

export const IMAGE_PROVIDERS = {
    openai: { name: 'OpenAI', model: 'GPT Image', keyUrl: 'https://platform.openai.com/api-keys' },
    google: { name: 'Google Gemini', model: 'Nano Banana', keyUrl: 'https://aistudio.google.com/apikey' },
    xai: { name: 'xAI Grok', model: 'Grok Image', keyUrl: 'https://console.x.ai' },
};

const configPath = () => join(app.getPath('userData'), 'image-provider.json');

function readConfig() {
    let c = {};
    try { if (existsSync(configPath())) c = JSON.parse(readFileSync(configPath(), 'utf-8')); } catch { c = {}; }
    // Migrate the old single-key shape { provider, apiKey } → per-provider keys.
    if (c.apiKey && !c.keys) { c.keys = c.provider ? { [c.provider]: c.apiKey } : {}; delete c.apiKey; }
    if (!c.keys || typeof c.keys !== 'object') c.keys = {};
    return c;
}

function writeConfig(cfg) {
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

/** The active provider, whether it has a key, and which providers have one — never the keys. */
export function imageStatus() {
    const c = readConfig();
    return {
        provider: c.provider ?? null,
        hasKey: !!(c.provider && c.keys[c.provider]),
        configured: Object.keys(c.keys).filter((k) => c.keys[k]),
    };
}

// Keys are kept PER provider, so switching back and forth never loses one.
export function setImageConfig({ provider, apiKey }) {
    const c = readConfig();
    if (provider !== undefined) c.provider = provider; // null turns generation off (keys stay)
    if (apiKey !== undefined) {
        const target = provider !== undefined ? provider : c.provider;
        if (target) { if (apiKey) c.keys[target] = apiKey; else delete c.keys[target]; }
    }
    writeConfig(c);
    return imageStatus();
}

/** Generate one PNG for `prompt`, returning a Buffer. Throws with a clean message. */
export async function generateImage({ prompt, size = '1024x1024' }) {
    const c = readConfig();
    const provider = c.provider;
    const apiKey = provider ? c.keys[provider] : null;
    if (!provider || !apiKey) throw new Error('No image provider is configured.');
    if (provider === 'openai') return openaiImage(apiKey, prompt, size);
    if (provider === 'xai') return xaiImage(apiKey, prompt);
    if (provider === 'google') return googleImage(apiKey, prompt);
    throw new Error(`Unknown image provider: ${provider}`);
}

async function openaiImage(key, prompt, size) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error?.message || `OpenAI error ${res.status}`);
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image.');
    return Buffer.from(b64, 'base64');
}

async function xaiImage(key, prompt) {
    // OpenAI-compatible endpoint; sizing is prompt-driven (aspect_ratio, not size).
    const res = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'grok-imagine-image', prompt, response_format: 'b64_json', n: 1 }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error?.message || j?.error || `xAI error ${res.status}`);
    const item = j?.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
    if (item?.url) return fetchBytes(item.url);
    throw new Error('xAI returned no image.');
}

async function googleImage(key, prompt) {
    // Nano Banana via generateContent (Imagen's :predict retires Aug 2026).
    const model = 'gemini-2.5-flash-image';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error?.message || `Google error ${res.status}`);
    const parts = j?.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p?.inlineData?.data ?? p?.inline_data?.data);
    const data = img?.inlineData?.data ?? img?.inline_data?.data;
    if (!data) throw new Error('Google returned no image.');
    return Buffer.from(data, 'base64');
}

async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetching the image failed (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
}
