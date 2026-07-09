import { useEffect, useState } from 'react';
import { ExternalLink, Loader } from 'lucide-react';
import { useT } from '../../lib/i18n.js';

/**
 * Optional image generation: pick a provider (OpenAI / Google / xAI), paste
 * your own image-API key, and Test it. Independent of the code AI. The key is
 * stored in the main process; the renderer only sees provider + hasKey.
 */
export function ImageProviderCard() {
    const t = useT();
    const [providers, setProviders] = useState({});
    const [provider, setProvider] = useState(null);
    const [hasKey, setHasKey] = useState(false);
    const [configured, setConfigured] = useState([]); // providers with a saved key
    const [keyInput, setKeyInput] = useState('');
    const [editing, setEditing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sample, setSample] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([window.studio.image.providers(), window.studio.image.get()])
            .then(([p, s]) => { setProviders(p); setProvider(s.provider); setHasKey(s.hasKey); setConfigured(s.configured || []); })
            .catch(() => {});
    }, []);

    // Switching provider keeps every provider's key — so you can flip back to a
    // previously-used one without re-pasting. Show its input only if it has none.
    const pick = async (id) => {
        setError(''); setSample(null); setSaved(false);
        if (id === provider) return;
        const s = await window.studio.image.set({ provider: id });
        setProvider(s.provider); setHasKey(s.hasKey); setConfigured(s.configured || []); setKeyInput(''); setEditing(!!id && !s.hasKey);
    };

    const save = async () => {
        if (!keyInput.trim()) return;
        const s = await window.studio.image.set({ apiKey: keyInput.trim() });
        setHasKey(s.hasKey); setConfigured(s.configured || []); setKeyInput(''); setEditing(false);
        setSaved(true); setTimeout(() => setSaved(false), 1600);
    };

    const test = async () => {
        setTesting(true); setError(''); setSample(null);
        const r = await window.studio.image.test({});
        setTesting(false);
        if (r.ok) setSample(r.dataUrl); else setError(r.error || 'Failed.');
    };

    const meta = provider ? providers[provider] : null;
    const chip = (on) => ({ borderRadius: 99, padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: on ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#c2c7cf' });

    return (
        <div style={{ marginTop: 14, borderRadius: 14, padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#c2c7cf' }}>{t('image.title')}</span>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280' }}>{t('image.optional')}</span>
            </div>
            <p style={{ margin: '4px 0 10px', fontSize: 12, lineHeight: 1.5, color: '#9aa0a8' }}>{t('image.subtitle')}</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => pick(null)} className="nb-btn" style={chip(!provider)}>{t('image.off')}</button>
                {Object.entries(providers).map(([id, p]) => (
                    <button key={id} onClick={() => pick(id)} className="nb-btn" style={{ ...chip(provider === id), display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.name}
                        {configured.includes(id) && <span title="Key saved" style={{ width: 6, height: 6, borderRadius: 99, background: '#86e89a' }} />}
                    </button>
                ))}
            </div>

            {meta && (
                <div style={{ marginTop: 10 }}>
                    {hasKey && !editing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#86e89a' }}>
                                <span style={{ width: 7, height: 7, borderRadius: 99, background: '#86e89a' }} />{t('image.keySaved')}
                            </span>
                            <button onClick={() => { setEditing(true); setKeyInput(''); }} className="nb-btn" style={{ background: 'none', border: 'none', color: '#9aa0a8', fontSize: 12, textDecoration: 'underline' }}>{t('image.change')}</button>
                            <div style={{ flex: 1 }} />
                            <button onClick={test} disabled={testing} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff5151,#d31f1f)', opacity: testing ? 0.6 : 1 }}>
                                {testing ? <><Loader size={12} className="nb-spin" />{t('image.testing')}</> : t('image.test')}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="password"
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                                placeholder={t('image.keyPlaceholder', { name: meta.name })}
                                autoFocus
                                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: '#e7e9ee', outline: 'none' }}
                            />
                            <button onClick={save} disabled={!keyInput.trim()} className="nb-btn" style={{ borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: keyInput.trim() ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}>{saved ? t('image.saved') : t('image.save')}</button>
                        </div>
                    )}

                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => window.studio.shell.open(meta.keyUrl)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#9aa0a8', fontSize: 11.5, textDecoration: 'underline' }}>
                            <ExternalLink size={11} />{t('image.getKey')} · {meta.model}
                        </button>
                    </div>

                    {error && <div style={{ marginTop: 8, fontSize: 11.5, color: '#ff8585', wordBreak: 'break-word' }}>{error}</div>}
                    {sample && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={sample} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)' }} />
                            <span style={{ fontSize: 12, color: '#86e89a', fontWeight: 500 }}>{t('image.testOk')}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
