import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings.js';
import { UI_LANGUAGES, localeToLang, translate } from '../../lib/i18n.js';
import logo from '../../assets/nb-logo.png';

/**
 * First-run language gate. Pre-selects the language matching the OS locale,
 * and shows its own copy in that language, so a Brazilian user sees Portuguese
 * before choosing. Once picked, the whole Studio switches.
 */
export function LanguagePicker() {
    const setUiLang = useSettingsStore((s) => s.setUiLang);
    const [suggested, setSuggested] = useState('en');

    useEffect(() => { window.studio.locale().then((loc) => setSuggested(localeToLang(loc))).catch(() => {}); }, []);

    return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="nb-pop" style={{ width: 420, borderRadius: 22, padding: 28, textAlign: 'center', background: 'linear-gradient(180deg,rgba(26,26,30,0.97),rgba(14,14,18,0.97))', border: '1px solid rgba(255,77,77,0.3)' }}>
                <img src={logo} alt="" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} />
                <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', color: '#fff' }}>{translate(suggested, 'lang.title')}</h1>
                <p style={{ marginTop: 8, marginBottom: 20, fontSize: 13.5, color: '#9aa0a8' }}>{translate(suggested, 'lang.subtitle')}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
                    {UI_LANGUAGES.map((l) => (
                        <button key={l.value} onClick={() => setUiLang(l.value)} className="nb-btn" title={l.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: 10, background: l.value === suggested ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${l.value === suggested ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}` }}>
                            <img src={l.img} alt={l.label} style={{ width: 64, height: 44, objectFit: 'cover', borderRadius: 8 }} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
