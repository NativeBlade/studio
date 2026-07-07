import { create } from 'zustand';

/**
 * Live preview state per app: the local `nativeblade:dev --platform=browser`
 * server. status: 'starting' | 'up' | 'down' (missing = never started).
 */
export const usePreviewStore = create((set) => ({
    byApp: {}, // appId -> { status, url, lanUrl }
    nonce: {}, // appId -> number, bump to force the iframe to reload

    apply: (appId, evt) => set((s) => ({
        byApp: { ...s.byApp, [appId]: { status: evt.status ?? (evt.url ? 'up' : 'down'), url: evt.url ?? null, lanUrl: evt.lanUrl ?? null } },
    })),

    reload: (appId) => set((s) => ({ nonce: { ...s.nonce, [appId]: (s.nonce[appId] ?? 0) + 1 } })),
}));
