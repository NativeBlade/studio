import { useRef, useState } from 'react';
import { Loader, Mic, Square } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings.js';
import { AUDIO_LANGUAGES } from '../../lib/languages.js';
import { createRecorder } from '../../lib/recorder.js';
import { transcribe } from '../../lib/whisper.js';
import { Modal } from '../ui/Modal.jsx';

/** Message input: Enter sends, Shift+Enter breaks a line, mic dictates. */
export function Composer({ onSend, busy }) {
    const [value, setValue] = useState('');
    const audioLang = useSettingsStore((s) => s.audioLang);
    const setAudioLang = useSettingsStore((s) => s.setAudioLang);

    // Voice state: idle | recording | working (transcribing / downloading model)
    const [voice, setVoice] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [askLang, setAskLang] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const recorderRef = useRef(null);

    const send = () => {
        const text = value.trim();
        if (!text) return;
        setValue('');
        onSend(text);
    };

    const beginRecording = async () => {
        setVoiceError('');
        try {
            recorderRef.current = createRecorder();
            await recorderRef.current.start();
            setVoice('recording');
        } catch {
            setVoiceError('Could not access the microphone. Check the app\'s mic permission.');
        }
    };

    const micClick = async () => {
        if (voice === 'working') return;
        if (voice === 'recording') {
            // Stop → transcribe → drop the text into the field.
            setVoice('working'); setProgress(0);
            try {
                const samples = await recorderRef.current.stop();
                const text = await transcribe(samples, audioLang ?? null, setProgress);
                if (text) setValue((v) => (v ? `${v} ${text}` : text));
            } catch {
                setVoiceError('Transcription failed. Try again, or type your message.');
            } finally {
                setVoice('idle'); setProgress(0);
            }
            return;
        }
        // First ever mic press: pick the language once.
        if (audioLang === undefined) { setAskLang(true); return; }
        beginRecording();
    };

    const chooseLang = (lang) => {
        setAudioLang(lang);
        setAskLang(false);
        beginRecording();
    };

    const recording = voice === 'recording';
    const working = voice === 'working';

    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {voiceError && <div style={{ padding: '8px 14px 0', fontSize: 11.5, color: '#ff8585' }}>{voiceError}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: 14 }}>
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                    placeholder={recording ? 'Listening… tap the mic to stop' : working ? (progress ? `Loading voice model… ${progress}%` : 'Transcribing…') : busy ? 'Building — send tweaks and the AI folds them in…' : 'Describe a screen, a feature, a change…'}
                    style={{ flex: 1, resize: 'none', maxHeight: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: '#e7e9ee', outline: 'none', fontFamily: 'inherit' }}
                />
                <button
                    onClick={micClick}
                    title={recording ? 'Stop and transcribe' : 'Speak your message'}
                    style={{ cursor: working ? 'default' : 'pointer', width: 40, height: 40, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: recording ? '#fff' : '#9aa0a8', background: recording ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)', border: recording ? 'none' : '1px solid rgba(255,255,255,0.12)' }}
                >
                    {working ? <Loader size={16} className="nb-spin" /> : recording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
                </button>
                <button
                    onClick={send}
                    disabled={!value.trim()}
                    style={{ cursor: value.trim() ? 'pointer' : 'default', width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', fontSize: 16, color: '#fff', background: value.trim() ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}
                    title="Send"
                >
                    ➤
                </button>
            </div>

            <Modal open={askLang} onClose={() => setAskLang(false)} title="What language will you speak?" subtitle="Used to transcribe your voice. You can change it later next to the AI model." maxWidth={360}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AUDIO_LANGUAGES.map((l) => (
                        <button key={l.label} onClick={() => chooseLang(l.value)} className="nb-btn" style={{ borderRadius: 99, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#e7e9ee' }}>
                            {l.label}
                        </button>
                    ))}
                </div>
            </Modal>
        </div>
    );
}
