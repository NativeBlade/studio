import { create } from 'zustand';

/**
 * Hidden doctor: the user never sees a toolchain screen. The only thing the
 * Studio requires up front is an AI CLI; everything else (PHP, Composer,
 * Node, git) is passed to the AI as context and it handles setup.
 */
export const useEnvStore = create((set) => ({
    result: null, // full checkEnvironment payload (checks incl. the AI CLIs)
    engines: null, // engine metadata (names, models, login hints) from main
    checking: false,

    refresh: async () => {
        set({ checking: true });
        const [result, engines] = await Promise.all([
            window.studio.env.check(),
            window.studio.engines.list(),
        ]);
        set({ result, engines, checking: false });
    },
}));
