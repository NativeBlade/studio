import { useRef, useState } from 'react';
import { Loader, Mic, Square } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings.js';
import { AUDIO_LANGUAGES } from '../../lib/languages.js';
import { useT } from '../../lib/i18n.js';
import { createRecorder } from '../../lib/recorder.js';
import { transcribe } from '../../lib/whisper.js';
import { Modal } from '../ui/Modal.jsx';

/** Message input: Enter sends, Shift+Enter breaks a line, mic dictates. */
export function Composer({ onSend, busy }) {
    const [value, setValue] = useState('');
    const t = useT();
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
            setVoiceError(t('composer.micError'));
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
                setVoiceError(t('composer.transcribeError'));
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
                    placeholder={recording ? t('composer.listening') : working ? (progress ? t('composer.loadingModel', { percent: progress }) : t('composer.transcribing')) : busy ? t('composer.busy') : t('composer.idle')}
                    style={{ flex: 1, resize: 'none', maxHeight: 120, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: '#e7e9ee', outline: 'none', fontFamily: 'inherit' }}
                />
                <button
                    onClick={micClick}
                    title={recording ? t('composer.stopMic') : t('composer.speak')}
                    style={{ cursor: working ? 'default' : 'pointer', width: 40, height: 40, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: recording ? '#fff' : '#9aa0a8', background: recording ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)', border: recording ? 'none' : '1px solid rgba(255,255,255,0.12)' }}
                >
                    {working ? <Loader size={16} className="nb-spin" /> : recording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
                </button>
                <button
                    onClick={send}
                    disabled={!value.trim()}
                    style={{ cursor: value.trim() ? 'pointer' : 'default', width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', fontSize: 16, color: '#fff', background: value.trim() ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}
                    title={t('composer.send')}
                >
                    ➤
                </button>
            </div>

            <Modal open={askLang} onClose={() => setAskLang(false)} title={t('composer.askLang.title')} subtitle={t('composer.askLang.subtitle')} maxWidth={360}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AUDIO_LANGUAGES.map((l) => (
                        <button key={l.label} onClick={() => chooseLang(l.value)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 99, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#e7e9ee' }}>
                            <span style={{ fontSize: 15 }}>{l.flag}</span>{l.label}
                        </button>
                    ))}
                </div>
            </Modal>
        </div>
    );
}
