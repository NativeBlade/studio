import { ChevronLeft, Cpu, Mic } from 'lucide-react';
import { useEnvStore } from '../../stores/env.js';
import { useSettingsStore } from '../../stores/settings.js';
import { AUDIO_LANGUAGES } from '../../lib/languages.js';
import logo from '../../assets/nb-logo.png';

/** Studio top bar — back (when inside an app) · logo · Studio · voice lang · AI picker. */
export function TopBar({ app, onBack, onOpenSetup }) {
    const engines = useEnvStore((s) => s.engines);
    const engine = useSettingsStore((s) => s.engine);
    const model = useSettingsStore((s) => s.model);
    const audioLang = useSettingsStore((s) => s.audioLang);
    const setAudioLang = useSettingsStore((s) => s.setAudioLang);
    const meta = engines?.[engine];
    const modelLabel = meta?.models.find((m) => m.id === model)?.label ?? 'Default';

    return (
        <header style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(9,9,12,0.7)', backdropFilter: 'blur(20px) saturate(150%)' }}>
            {app && (
                <button onClick={onBack} className="nb-btn" title="Back to your apps" style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 10, padding: '8px 12px 8px 6px', fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' }}>
                    <ChevronLeft size={16} />Back
                </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={logo} alt="" style={{ height: 26, width: 26, objectFit: 'contain' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Studio</span>
            </div>
            {app && (
                <span style={{ fontSize: 12.5, color: '#6b7280' }}>/ {app.name}</span>
            )}
            <div style={{ flex: 1 }} />
            <label title="Language you dictate in (for voice input)" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '0 10px 0 11px', height: 34, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' }}>
                <Mic size={13} style={{ color: '#9aa0a8' }} />
                <select
                    value={audioLang === undefined ? '' : String(audioLang)}
                    onChange={(e) => setAudioLang(e.target.value === 'null' ? null : (e.target.value || undefined))}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: '#c2c7cf', fontSize: 12, cursor: 'pointer' }}
                >
                    {audioLang === undefined && <option value="">Voice…</option>}
                    {AUDIO_LANGUAGES.map((l) => <option key={l.label} value={l.value === null ? 'null' : l.value} style={{ background: '#16161a' }}>{l.label}</option>)}
                </select>
            </label>
            <button onClick={onOpenSetup} className="nb-btn" title="Choose your AI and model" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' }}>
                <Cpu size={13} style={{ color: '#ff8585' }} />
                {meta?.name ?? 'AI'} · {modelLabel}
            </button>
        </header>
    );
}
