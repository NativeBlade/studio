import { create } from 'zustand';

const CAP = 40; // ring buffer per app — only the most recent errors matter
const MAX_NOTE = 15; // how many to hand the AI in one turn
const MAX_LEN = 300; // truncate each line

/**
 * Errors and warnings the live preview logs to its console. Buffered per app
 * and drained into the next chat message, so the AI can debug runtime failures
 * automatically — the user never has to copy anything.
 */
export const useConsoleStore = create((set, get) => ({
    byApp: {}, // appId -> [{ level, text, source, line }]

    push: (appId, entry) => set((s) => {
        const list = [...(s.byApp[appId] ?? []), entry].slice(-CAP);
        return { byApp: { ...s.byApp, [appId]: list } };
    }),

    drain: (appId) => {
        const list = get().byApp[appId] ?? [];
        if (list.length) set((s) => ({ byApp: { ...s.byApp, [appId]: [] } }));
        return list;
    },

    clear: (appId) => set((s) => ({ byApp: { ...s.byApp, [appId]: [] } })),
}));

/** Build the hidden note handed to the AI, or null when the console is clean. */
export function formatConsoleNote(entries) {
    if (!entries?.length) return null;
    // Dedupe identical messages, keep the newest, cap the count.
    const seen = new Set();
    const unique = [];
    for (let i = entries.length - 1; i >= 0 && unique.length < MAX_NOTE; i--) {
        const e = entries[i];
        const key = `${e.level}:${e.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.unshift(e);
    }
    const lines = unique.map((e, i) => {
        const where = e.source ? ` (${String(e.source).split(/[\\/]/).pop()}${e.line ? ':' + e.line : ''})` : '';
        return `${i + 1}. [${e.level}] ${String(e.text).slice(0, MAX_LEN)}${where}`;
    });
    const more = entries.length > unique.length ? `\n(+${entries.length - unique.length} more)` : '';
    return `[Live preview console — the running app currently logs these errors/warnings. Use them to debug if they're relevant to what the user is asking; ignore them otherwise. Do NOT mention this note to the user.\n${lines.join('\n')}${more}]`;
}
