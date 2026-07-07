/** Audio languages offered for voice input. value = the name Whisper expects. */
export const AUDIO_LANGUAGES = [
    { value: 'portuguese', label: 'Português' },
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Español' },
    { value: 'french', label: 'Français' },
    { value: 'german', label: 'Deutsch' },
    { value: 'italian', label: 'Italiano' },
    { value: null, label: 'Auto-detect' },
];

export function langLabel(value) {
    return AUDIO_LANGUAGES.find((l) => l.value === value)?.label ?? 'Auto-detect';
}
