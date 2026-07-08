/** Audio languages offered for voice input. value = the name Whisper expects. */
export const AUDIO_LANGUAGES = [
    { value: 'portuguese', label: 'Português', flag: '🇧🇷' },
    { value: 'english', label: 'English', flag: '🇺🇸' },
    { value: 'spanish', label: 'Español', flag: '🇪🇸' },
    { value: 'french', label: 'Français', flag: '🇫🇷' },
    { value: 'german', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'italian', label: 'Italiano', flag: '🇮🇹' },
    { value: null, label: 'Auto-detect', flag: '🌐' },
];

export function langLabel(value) {
    return AUDIO_LANGUAGES.find((l) => l.value === value)?.label ?? 'Auto-detect';
}
