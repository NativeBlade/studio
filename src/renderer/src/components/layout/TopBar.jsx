import { useEffect, useState } from 'react';
import { ChevronLeft, Cpu, Mic } from 'lucide-react';
import { useEnvStore } from '../../stores/env.js';
import { useSettingsStore } from '../../stores/settings.js';
import { AUDIO_LANGUAGES } from '../../lib/languages.js';
import { UI_LANGUAGES, useT } from '../../lib/i18n.js';
import logo from '../../assets/nb-logo.png';

/** Studio top bar — back · logo · Studio · UI lang · voice lang · AI picker. */
export function TopBar({ app, onBack, onOpenSetup }) {
    const engines = useEnvStore((s) => s.engines);
    const engine = useSettingsStore((s) => s.engine);
    const model = useSettingsStore((s) => s.model);
    const audioLang = useSettingsStore((s) => s.audioLang);
    const setAudioLang = useSettingsStore((s) => s.setAudioLang);
    const uiLang = useSettingsStore((s) => s.uiLang) ?? 'en';
    const setUiLang = useSettingsStore((s) => s.setUiLang);
    const t = useT();
    const meta = engines?.[engine];
    const modelLabel = meta?.models.find((m) => m.id === model)?.label ?? 'Default';
    const uiFlag = UI_LANGUAGES.find((l) => l.value === uiLang)?.img;

    // The version the user is actually running — the first thing worth knowing
    // when an update is meant to have landed, or when they report a bug.
    const [version, setVersion] = useState(null);
    useEffect(() => {
        window.studio.version()
            .then((v) => setVersion(v?.packaged ? `v${v.version}` : 'dev'))
            .catch(() => {}); // a missing version label is never worth an error
    }, []);

    const pill = { display: 'flex', alignItems: 'center', gap: 6, height: 34, borderRadius: 10, padding: '0 10px', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' };
    const bare = { background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12, fontWeight: 400, cursor: 'pointer' };

    return (
        <header style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(9,9,12,0.7)', backdropFilter: 'blur(20px) saturate(150%)' }}>
            {app && (
                <button onClick={onBack} className="nb-btn" title={t('topbar.backTitle')} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 10, padding: '8px 12px 8px 6px', fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' }}>
                    <ChevronLeft size={16} />{t('topbar.back')}
                </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={logo} alt="" style={{ height: 26, width: 26, objectFit: 'contain' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Studio</span>
                {version && <span title={t('topbar.versionTitle')} style={{ fontSize: 10.5, fontWeight: 500, color: '#6b7280', letterSpacing: '0.02em' }}>{version}</span>}
            </div>
            {app && (
                <span style={{ fontSize: 12.5, color: '#6b7280' }}>/ {app.name}</span>
            )}
            <div style={{ flex: 1 }} />

            {/* Interface language — flag image only, left of the voice language.
                The native <select> sits transparent on top so clicking the flag
                opens the picker (option lists can't render images natively). */}
            <label title={t('topbar.uiLangTitle')} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 34, width: 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
                <img src={uiFlag} alt={uiLang} style={{ width: 22, height: 16, objectFit: 'cover', borderRadius: 3 }} />
                <select value={uiLang} onChange={(e) => setUiLang(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', appearance: 'none', border: 'none' }}>
                    {UI_LANGUAGES.map((l) => <option key={l.value} value={l.value} style={{ background: '#16161a', color: '#fff', fontWeight: 400 }}>{l.flag} {l.label}</option>)}
                </select>
            </label>

            <label title={t('topbar.voiceTitle')} style={{ ...pill, paddingLeft: 11 }}>
                <Mic size={13} style={{ color: '#9aa0a8' }} />
                <select
                    value={audioLang === undefined ? '' : String(audioLang)}
                    onChange={(e) => setAudioLang(e.target.value === 'null' ? null : (e.target.value || undefined))}
                    style={bare}
                >
                    {audioLang === undefined && <option value="" style={{ background: '#16161a', color: '#fff', fontWeight: 400 }}>Voice…</option>}
                    {AUDIO_LANGUAGES.map((l) => <option key={l.label} value={l.value === null ? 'null' : l.value} style={{ background: '#16161a', color: '#fff', fontWeight: 400 }}>{l.flag} {l.label}</option>)}
                </select>
            </label>

            <button onClick={onOpenSetup} className="nb-btn" title={t('topbar.aiTitle')} style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#c2c7cf' }}>
                <Cpu size={13} style={{ color: '#ff8585' }} />
                {meta?.name ?? 'AI'} · {modelLabel}
            </button>
        </header>
    );
}
