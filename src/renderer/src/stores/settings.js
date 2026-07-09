import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Which AI CLI drives the Studio (the user's own subscription) and which model. */
export const useSettingsStore = create(
    persist(
        (set) => ({
            engine: 'claude', // claude | codex | grok
            model: null, // engine-specific model id; null = the CLI's default
            audioLang: undefined, // Whisper language name; undefined = never asked yet
            uiLang: undefined, // interface language 'en'|'pt'|'es'; undefined = ask on first run

            setEngine: (engine) => set({ engine, model: null }),
            setModel: (model) => set({ model }),
            setAudioLang: (audioLang) => set({ audioLang }),
            setUiLang: (uiLang) => set({ uiLang }),
        }),
        { name: 'studio-settings' },
    ),
);
