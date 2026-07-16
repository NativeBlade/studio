import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Local registry of the user's Studio apps (folders on their machine). */
export const useAppsStore = create(
    persist(
        (set) => ({
            apps: [], // { id, name, slug, platforms, path, createdAt, frameworkUpdatedAt }
            current: null, // app id open in the workspace

            addApp: (app) => set((s) => ({ apps: [app, ...s.apps] })),
            setPath: (id, path) => set((s) => ({ apps: s.apps.map((a) => (a.id === id ? { ...a, path } : a)) })),
            // When the Studio last brought this app's NativeBlade up to date.
            setFrameworkUpdated: (id, at) => set((s) => ({ apps: s.apps.map((a) => (a.id === id ? { ...a, frameworkUpdatedAt: at } : a)) })),
            setBuilt: (id) => set((s) => ({ apps: s.apps.map((a) => (a.id === id ? { ...a, built: true } : a)) })),
            removeApp: (id) => set((s) => ({ apps: s.apps.filter((a) => a.id !== id) })),
            open: (id) => set({ current: id }),
            close: () => set({ current: null }),
        }),
        // Only the registry persists — `current` stays session-only, so the
        // Studio always opens on the home screen (chat context is in-memory).
        {
            name: 'studio-apps',
            partialize: (s) => ({ apps: s.apps }),
            merge: (persisted, current) => ({ ...current, apps: persisted?.apps ?? [] }),
        },
    ),
);
