import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Which AI CLI drives the Studio (the user's own subscription) and which model. */
export const useSettingsStore = create(
    persist(
        (set) => ({
            engine: 'claude', // claude | codex | gemini
            model: null, // engine-specific model id; null = the CLI's default
            audioLang: undefined, // Whisper language name; undefined = never asked yet

            setEngine: (engine) => set({ engine, model: null }),
            setModel: (model) => set({ model }),
            setAudioLang: (audioLang) => set({ audioLang }),
        }),
        { name: 'studio-settings' },
    ),
);
