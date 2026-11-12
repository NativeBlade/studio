import { create } from 'zustand';

/**
 * Live preview state per app: the local `nativeblade:dev --platform=browser`
 * server. status: 'starting' | 'up' | 'down' (missing = never started).
 */
export const usePreviewStore = create((set, get) => ({
    byApp: {}, // appId -> { status, url, lanUrl }
    nonce: {}, // appId -> number, bump to force the iframe to reload
    // The mounted <webview> per app (and its webContents id), for whoever
    // needs to drive or photograph the preview: the screenshot the AI reads,
    // the tour through the screens, the "point at it" mode. Live DOM handles,
    // never persisted.
    webviews: {},
    picking: {}, // appId -> bool, "point at it" mode on

    apply: (appId, evt) => set((s) => ({
        byApp: { ...s.byApp, [appId]: { status: evt.status ?? (evt.url ? 'up' : 'down'), url: evt.url ?? null, lanUrl: evt.lanUrl ?? null } },
    })),

    reload: (appId) => set((s) => ({ nonce: { ...s.nonce, [appId]: (s.nonce[appId] ?? 0) + 1 } })),

    setWebview: (appId, webview, webContentsId) => set((s) => {
        const webviews = { ...s.webviews };
        if (webview) webviews[appId] = { webview, webContentsId: webContentsId ?? null };
        else delete webviews[appId];
        return { webviews };
    }),

    setPicking: (appId, on) => set((s) => ({ picking: { ...s.picking, [appId]: !!on } })),

    /** Save the preview as .studio/<name>.png; the project-relative path, or null. */
    capture: async (appId, cwd, name = 'preview') => {
        const entry = get().webviews[appId];
        if (!entry?.webContentsId || !cwd) return null;
        try { return await window.studio.preview.capture({ webContentsId: entry.webContentsId, cwd, name }); } catch { return null; }
    },
}));
