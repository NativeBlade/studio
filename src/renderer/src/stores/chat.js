import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/idb-storage.js';
import { useAppsStore } from './apps.js';
import { useSettingsStore } from './settings.js';
import { usePreviewStore } from './preview.js';
import { useConsoleStore, formatConsoleNote } from './console.js';
import { planPrompt, buildPrompt, parsePlan } from '../lib/plan.js';
import { parseSecrets, stripRebuild, parseImages } from '../lib/secret.js';
import { translate } from '../lib/i18n.js';

// System messages are rendered as chat, not routed through a React hook, so
// resolve the current UI language straight from the settings store.
const tt = (key, vars) => translate(useSettingsStore.getState().uiLang ?? 'en', key, vars);

let nextId = 1;

// The chain-of-thought items (the "Build details" accordion) are the bulk of a
// long history and the least useful once a turn is old. We keep them in full
// only for the most recent PRUNE_KEEP groups; older groups drop their items but
// keep the count + timing, so the header still reads "Build details · N · 1m 3s".
const PRUNE_KEEP = 8;

function pruneGroups(list) {
    const groupIdxs = [];
    for (let i = 0; i < list.length; i++) if (list[i].role === 'group') groupIdxs.push(i);
    if (groupIdxs.length <= PRUNE_KEEP) return list;
    const keepFrom = groupIdxs[groupIdxs.length - PRUNE_KEEP];
    let changed = false;
    const out = list.map((m, i) => {
        if (m.role === 'group' && i < keepFrom && m.items?.length) {
            changed = true;
            return { ...m, items: [], updates: m.updates ?? m.items.length };
        }
        return m;
    });
    return changed ? out : list;
}

// Git HEAD captured when a turn starts, per app — a checkpoint is recorded
// only if the AI actually committed something new by the time it's done.
const turnBase = {};

// A one-shot note prepended to the app's next turn, so the AI stays in sync
// after a checkpoint restore (its --resume session still "remembers" the
// rolled-back edits; this tells it the working tree changed underneath it).
const pendingNote = {};

/**
 * Conversations survive restarts (persisted like the app registry), but live
 * run state doesn't: on rehydrate, dangling groups are closed and message ids
 * are bumped past everything stored so keys never collide.
 */
function rehydrate(persisted) {
    const byApp = {};
    for (const [appId, list] of Object.entries(persisted?.byApp ?? {})) {
        const mapped = (list ?? []).map((m) => {
            if (m.id >= nextId) nextId = m.id + 1;
            for (const it of m.items ?? []) if (it.id >= nextId) nextId = it.id + 1;
            return m.role === 'group' && !m.endedAt ? { ...m, endedAt: m.startedAt } : m;
        });
        // Bound an already-large history the first time it loads.
        byApp[appId] = pruneGroups(mapped);
    }
    return byApp;
}

/**
 * Per-app conversation state, fed by main-process agent events.
 *
 * Message roles:
 *   user / ai / error / system — plain bubbles
 *   group — one run's chain of thought: { items: [{kind:'text'|'tool', text, detail}], startedAt, endedAt }
 *   plan  — the proposed plan awaiting the Features → Design → Review wizard
 *   checkpoint — a git restore point after an AI change: { n, sha, subject }
 *
 * While a run is live its narration collects into the open group; on done the
 * last text is promoted out of the group as the real answer (or parsed as the
 * plan JSON when we're in the planning step).
 */
export const useChatStore = create(persist((set, get) => ({
    byApp: {}, // appId -> message list
    busy: {}, // appId -> bool (a run is in flight)
    mode: {}, // appId -> 'plan' | 'build' | 'chat' (what the live run is doing)

    clearApp: (appId) => set((s) => {
        const byApp = { ...s.byApp };
        delete byApp[appId];
        return { byApp };
    }),

    startPlan: async (app, idea, feedback = null) => {
        if (idea && !feedback) pushMsg(set, app.id, { role: 'user', text: idea });
        await launch(set, app, planPrompt(app, idea, feedback), 'plan');
    },

    approvePlan: (app, steps, answers) => {
        set((s) => ({ byApp: { ...s.byApp, [app.id]: (s.byApp[app.id] ?? []).map((m) => (m.role === 'plan' ? { ...m, approved: true } : m)) } }));
        launch(set, app, buildPrompt(app, steps, answers), 'build');
    },

    rejectPlan: (app, feedback) => {
        set((s) => ({ byApp: { ...s.byApp, [app.id]: (s.byApp[app.id] ?? []).filter((m) => m.role !== 'plan') } }));
        get().startPlan(app, app.description, feedback);
    },

    send: async (app, text) => {
        const hasHistory = (get().byApp[app.id] ?? []).length > 0;
        if (!hasHistory) return get().startPlan(app, text); // first contact → plan first, like the cloud
        pushMsg(set, app.id, { role: 'user', text });
        await launch(set, app, text, 'chat');
    },

    stop: (appId) => window.studio.chat.stop(appId),

    // After a turn ends, if the AI advanced git HEAD, drop a checkpoint in the
    // chat pointing at that commit.
    recordCheckpoint: async (appId) => {
        const app = useAppsStore.getState().apps.find((a) => a.id === appId);
        if (!app?.path) return;
        const head = await window.studio.git.head(app.path);
        if (!head?.sha || head.sha === turnBase[appId]) return; // nothing new committed
        turnBase[appId] = head.sha;
        set((s) => {
            const list = s.byApp[appId] ?? [];
            const n = list.filter((m) => m.role === 'checkpoint').length + 1;
            return { byApp: { ...s.byApp, [appId]: [...list, { id: nextId++, role: 'checkpoint', n, sha: head.sha, subject: head.subject }] } };
        });
    },

    // Manual "Update NativeBlade". Same deterministic path as the weekly refresh,
    // in its own progress group so the user watches the commands run, and it
    // leaves a note the next request rides along — the AI has to know the
    // framework moved under it.
    updateFramework: async (app) => {
        if (get().busy[app.id] || !app.path) return;
        set((s) => ({
            byApp: { ...s.byApp, [app.id]: [...(s.byApp[app.id] ?? []), { id: nextId++, role: 'group', items: [], startedAt: Date.now(), endedAt: null }] },
            busy: { ...s.busy, [app.id]: true },
        }));
        const res = await window.studio.framework.update({ appId: app.id, cwd: app.path }).catch(() => null);
        if (res?.ok) useAppsStore.getState().setFrameworkUpdated(app.id, res.frameworkUpdatedAt);
        if (res?.note) pendingNote[app.id] = res.note;
        // No agent ran, so no `done` event is coming to close the group for us.
        set((s) => ({
            busy: { ...s.busy, [app.id]: false },
            byApp: { ...s.byApp, [app.id]: (s.byApp[app.id] ?? []).map((m) => (m.role === 'group' && !m.endedAt ? { ...m, endedAt: Date.now() } : m)) },
        }));
    },

    restore: async (app, cp) => {
        const res = await window.studio.git.reset({ cwd: app.path, sha: cp.sha });
        if (!res?.ok) {
            pushMsg(set, app.id, { role: 'error', text: tt('chat.rollbackFailed') });
            return;
        }
        turnBase[app.id] = cp.sha;
        pendingNote[app.id] = `[Project state changed outside the conversation: the user rolled the code back to Checkpoint v${cp.n} (git commit ${cp.sha.slice(0, 7)}${cp.subject ? `: "${cp.subject}"` : ''}) with \`git reset --hard\`. The working tree on disk now matches that commit — any edits you made after it are gone. Before making changes, re-read the relevant files to see the actual current state; do not assume your later edits are still present.]`;
        pushMsg(set, app.id, { role: 'system', text: tt('chat.restored', { n: cp.n }) });
        usePreviewStore.getState().reload(app.id);
    },

    // The user filled a secret card → write it to .env (off the chat log) and
    // let the AI continue from where it stopped.
    resolveSecret: async (app, message, value) => {
        set((s) => ({ byApp: { ...s.byApp, [app.id]: (s.byApp[app.id] ?? []).map((m) => (m.id === message.id ? { ...m, resolved: true } : m)) } }));
        const res = await window.studio.env.setSecret({ cwd: app.path, key: message.spec.env, value });
        if (!res?.ok) {
            pushMsg(set, app.id, { role: 'error', text: tt('chat.saveFailed', { label: message.spec.label }) });
            return;
        }
        usePreviewStore.getState().reload(app.id);
        pushMsg(set, app.id, { role: 'system', text: tt('chat.secretSaved', { label: message.spec.label }) });
        launch(set, app, `The value for ${message.spec.env} has been saved to .env. Continue building.`, 'chat');
    },

    // Attach a logo: copy the PNG to src-tauri/icons/logo.png (via a native file
    // picker) and kick off a turn telling the AI to regenerate the icons and use
    // it in the splash. The AI has the file because it lives in the project.
    applyLogo: async (app) => {
        if (!app?.path) return;
        const res = await window.studio.apps.attachLogo({ cwd: app.path });
        if (!res?.ok) {
            if (res?.error) pushMsg(set, app.id, { role: 'error', text: res.error });
            return; // user canceled the picker → do nothing
        }
        const off = res.width && (res.width !== 1024 || res.height !== 1024);
        const warn = off ? ` ${tt('chat.logoWarn', { w: res.width, h: res.height })}` : '';
        pushMsg(set, app.id, { role: 'system', text: `${tt('chat.logoAdded')}${warn}` });
        const dimNote = off
            ? ` (it is ${res.width}x${res.height}, not a square 1024x1024 — briefly tell the user a square 1024px logo gives the sharpest icons)`
            : '';
        const prompt = `The user attached their app logo as a PNG at \`src-tauri/icons/logo.png\`${dimNote}. Apply it now: run \`php artisan nativeblade:icon\` to regenerate every platform icon from it, and use this same logo in the loading splash at \`resources/js/index.html\` (replace any placeholder mark; keep the splash mechanics intact — do not remove #splash, #app, or the two scripts).`;
        await launch(set, app, prompt, 'chat');
    },

    // Generate the app logo with the configured image provider, straight into
    // the icon source, then have the AI regenerate the icons + use it in the splash.
    generateLogo: async (app, prompt) => {
        if (!app?.path || !prompt?.trim()) return;
        pushMsg(set, app.id, { role: 'system', text: tt('chat.logoGenerating') });
        const r = await window.studio.image.generate({ cwd: app.path, prompt: prompt.trim(), path: 'src-tauri/icons/logo.png', size: '1024x1024' });
        if (!r?.ok) {
            pushMsg(set, app.id, { role: 'error', text: tt('chat.imageFail', { error: r?.error || '' }) });
            return;
        }
        pushMsg(set, app.id, { role: 'system', text: tt('chat.logoAdded') });
        const applyPrompt = `A new app logo was generated as a 1024x1024 PNG at \`src-tauri/icons/logo.png\`. Apply it now: run \`php artisan nativeblade:icon\` to regenerate every platform icon from it, and use this same logo in the loading splash at \`resources/js/index.html\` (replace any placeholder mark; keep the splash mechanics intact — do not remove #splash, #app, or the two scripts).`;
        await launch(set, app, applyPrompt, 'chat');
    },

    // The AI requested one or more generated images ([[NB_IMAGE]]): create each
    // with the user's configured provider, save it into the project, then hand
    // control back so the AI continues the build using them.
    generateImages: async (appId, images) => {
        const app = useAppsStore.getState().apps.find((a) => a.id === appId);
        if (!app?.path) return;
        const notes = [];
        for (const img of images) {
            pushMsg(set, appId, { role: 'system', text: tt('chat.imageGen', { path: img.path }) });
            const r = await window.studio.image.generate({ cwd: app.path, prompt: img.prompt, path: img.path, size: img.size });
            if (r?.ok) notes.push(`saved to ${img.path}`);
            else {
                notes.push(`FAILED for ${img.path}: ${r?.error || 'unknown error'}`);
                pushMsg(set, appId, { role: 'error', text: tt('chat.imageFail', { error: r?.error || '' }) });
            }
        }
        usePreviewStore.getState().reload(appId);
        const note = `[Image generation results: ${notes.join('; ')}.] Continue the build using the images that were saved. If any failed, proceed without it or briefly tell the user.`;
        await launch(set, app, note, 'chat');
    },

    // Stop → npm run build → start, so php-wasm reloads with the new CSS.
    triggerRebuild: async (appId) => {
        const app = useAppsStore.getState().apps.find((a) => a.id === appId);
        if (!app?.path) return;
        pushMsg(set, appId, { role: 'system', text: tt('chat.rebuilding') });
        await window.studio.preview.rebuild({ appId, cwd: app.path });
    },

    handleEvent: (evt) => {
        const { appId } = evt;
        let rebuild = false;
        let doneMode = null;
        let images = null; // [[NB_IMAGE]] requests to fulfill after this turn ends
        set((s) => {
            const list = [...(s.byApp[appId] ?? [])];
            const gi = list.findLastIndex((m) => m.role === 'group');
            const group = gi !== -1 && !list[gi].endedAt ? { ...list[gi], items: [...list[gi].items] } : null;
            if (group) list[gi] = group;

            if (evt.type === 'text' && group) {
                group.items.push({ id: nextId++, kind: 'text', text: evt.text });
            }
            if (evt.type === 'tool' && group) {
                group.items.push({ id: nextId++, kind: 'tool', text: evt.label, detail: evt.detail });
            }

            if (evt.type === 'done' || evt.type === 'stopped' || evt.type === 'error') {
                const mode = s.mode[appId];
                doneMode = mode;
                if (group) group.endedAt = Date.now();

                if (evt.type === 'done' && mode === 'build') useAppsStore.getState().setBuilt(appId);

                if (evt.type === 'done' && group) {
                    const lastText = [...group.items].reverse().find((it) => it.kind === 'text');
                    if (mode === 'plan') {
                        const app = useAppsStore.getState().apps.find((a) => a.id === appId);
                        if (lastText) group.items = group.items.filter((it) => it !== lastText);
                        list.push({ id: nextId++, role: 'plan', plan: parsePlan(lastText?.text, app ?? { name: 'your app' }), approved: false });
                    } else if (lastText) {
                        group.items = group.items.filter((it) => it !== lastText);
                        // The AI may end its turn asking for a user-only secret,
                        // requesting a generated image, and/or flagging a CSS
                        // rebuild; render/strip each marker.
                        const { secrets, stripped: s1 } = parseSecrets(lastText.text);
                        const { images: imgs, stripped: s2 } = parseImages(s1);
                        const cleaned = stripRebuild(s2);
                        rebuild = cleaned.rebuild;
                        images = imgs.length ? imgs : null;
                        if (cleaned.text) list.push({ id: nextId++, role: 'ai', text: cleaned.text });
                        for (const spec of secrets) list.push({ id: nextId++, role: 'secret', spec, resolved: false });
                    }
                    if (group && !group.items.length) list.splice(list.indexOf(group), 1);
                }
                if (evt.type === 'stopped') list.push({ id: nextId++, role: 'system', text: tt('chat.stopped') });
                if (evt.type === 'error') list.push({ id: nextId++, role: 'error', text: evt.message });

                // A failed build (e.g. scaffold error) re-opens the plan so the
                // user can fix the machine and hit Approve again.
                const reopened = evt.type === 'error' && mode === 'build'
                    ? list.map((m) => (m.role === 'plan' ? { ...m, approved: false } : m))
                    : list;

                // Turn just ended: trim the verbose detail of older turns so the
                // history stays bounded no matter how long the app is built for.
                return { byApp: { ...s.byApp, [appId]: pruneGroups(reopened) }, busy: { ...s.busy, [appId]: false }, mode: { ...s.mode, [appId]: null } };
            }

            return { byApp: { ...s.byApp, [appId]: list } };
        });

        // Checkpoints are for tweaks AFTER the first build — the initial build
        // is the baseline (nothing earlier to roll back to), so only 'chat'
        // turns get one. Also handle a CSS rebuild the AI flagged.
        if (evt.type === 'done') {
            // Skip the checkpoint when images are pending — the turn continues
            // in generateImages, which commits (and checkpoints) at its end.
            if (doneMode === 'chat' && !images) get().recordCheckpoint(appId);
            if (rebuild) get().triggerRebuild(appId);
            if (images) get().generateImages(appId, images);
        }
    },
}), {
    name: 'studio-chats',
    storage: createJSONStorage(() => idbStorage),
    partialize: (s) => ({ byApp: s.byApp }),
    merge: (persisted, current) => ({ ...current, byApp: rehydrate(persisted) }),
}));

function pushMsg(set, appId, msg) {
    set((s) => ({ byApp: { ...s.byApp, [appId]: [...(s.byApp[appId] ?? []), { id: nextId++, ...msg }] } }));
}

async function launch(set, app, prompt, mode) {
    set((s) => ({
        byApp: { ...s.byApp, [app.id]: [...(s.byApp[app.id] ?? []), { id: nextId++, role: 'group', items: [], startedAt: Date.now(), endedAt: null }] },
        busy: { ...s.busy, [app.id]: true },
        mode: { ...s.mode, [app.id]: mode },
    }));
    const cwd = app.path ?? (await window.studio.apps.ensureDir(app.slug));
    if (!app.path) useAppsStore.getState().setPath(app.id, cwd);
    // Baseline for this turn's checkpoint: HEAD before the AI runs (null if the
    // folder isn't a git repo yet — the first build's commit then counts).
    turnBase[app.id] = (await window.studio.git.head(cwd))?.sha ?? null;
    // Ride-along context, newest info closest to the user's ask:
    //  - a pending restore note (so the AI re-syncs after a rollback),
    //  - the live preview's console errors (so it can debug automatically).
    let finalPrompt = prompt;
    const restoreNote = pendingNote[app.id];
    delete pendingNote[app.id];
    if (mode === 'chat') {
        const consoleNote = formatConsoleNote(useConsoleStore.getState().drain(app.id));
        if (consoleNote) finalPrompt = `${consoleNote}\n\n${finalPrompt}`;
    }
    if (restoreNote) finalPrompt = `${restoreNote}\n\n${finalPrompt}`;

    // When image generation is configured, tell the AI it can request images.
    // Not during planning — the plan shouldn't spend the user's image budget.
    if (mode !== 'plan') {
        const img = await window.studio.image.get().catch(() => null);
        if (img?.hasKey) {
            const note = `[Image generation is ENABLED — you can create real raster images (logos, icons, illustrations, backgrounds). Emit exactly ONE marker per image and STOP; the Studio generates it and then tells you to continue:
[[NB_IMAGE]]{"prompt":"a detailed description of the image","path":"public/images/name.png","size":"1024x1024"}[[/NB_IMAGE]]
APP ICON (important): the icon shown in the app list and on the device is SEPARATE from the loading splash, and it comes only from a real PNG. To give the app its own icon instead of the default NativeBlade mark, generate a 1024x1024 logo to "src-tauri/icons/logo.png" and then run \`php artisan nativeblade:icon\`. Do this as part of setting up the app's identity, not only when asked — an inline SVG in the splash does NOT change the app icon.
Keep any text before a marker and put nothing after it. Only generate images the design needs — never invent extras.]`;
            finalPrompt = `${note}\n\n${finalPrompt}`;
        }
    }

    const { engine, model, ollamaContext } = useSettingsStore.getState();
    const res = await window.studio.chat.send({
        appId: app.id,
        cwd,
        text: finalPrompt,
        engine,
        model,
        context: engine === 'ollama' ? ollamaContext : null,
        scaffold: mode === 'build', // Approve & build → the Studio scaffolds first
        frameworkUpdatedAt: app.frameworkUpdatedAt ?? null, // main decides if it's stale
        app: { name: app.name, slug: app.slug, company: app.company, description: app.description, platforms: app.platforms },
    });
    // Only set when the Studio actually moved the framework forward, so a failed
    // update is retried on the next request instead of waiting another week.
    if (res?.frameworkUpdatedAt) useAppsStore.getState().setFrameworkUpdated(app.id, res.frameworkUpdatedAt);
}
