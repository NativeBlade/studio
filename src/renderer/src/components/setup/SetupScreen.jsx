import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useEnvStore } from '../../stores/env.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useT } from '../../lib/i18n.js';
import { Button } from '../ui/Button.jsx';

/**
 * Choose your AI: which CLI drives the Studio (the user's own subscription,
 * never an API key) and which model. Doubles as the first-run gate (no
 * onClose) and the settings overlay opened from the top bar.
 */
export function SetupScreen({ onClose }) {
    const result = useEnvStore((s) => s.result);
    const engines = useEnvStore((s) => s.engines) ?? {};
    const checking = useEnvStore((s) => s.checking);
    const refresh = useEnvStore((s) => s.refresh);
    const engine = useSettingsStore((s) => s.engine);
    const model = useSettingsStore((s) => s.model);
    const setEngine = useSettingsStore((s) => s.setEngine);
    const setModel = useSettingsStore((s) => s.setModel);
    const t = useT();
    const [copied, setCopied] = useState(false);

    const check = (id) => result?.checks.find((c) => c.id === id);
    const selected = check(engine);
    const meta = engines[engine];
    const ready = !!selected?.ok;

    const copy = () => {
        navigator.clipboard.writeText(selected?.hint?.cmd ?? '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <div style={{ position: onClose ? 'fixed' : 'static', inset: 0, zIndex: 150, height: onClose ? undefined : '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: onClose ? 'rgba(4,4,6,0.72)' : 'transparent', backdropFilter: onClose ? 'blur(8px)' : 'none' }}>
            <div className="nb-pop" style={{ width: 620, borderRadius: 22, padding: 28, background: 'linear-gradient(180deg,rgba(26,26,30,0.97),rgba(14,14,18,0.97))', border: '1px solid rgba(255,77,77,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px' }}>{t('setup.title')}</h1>
                        <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: '#9aa0a8' }}>
                            {t('setup.subtitle')}
                        </p>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="nb-btn" style={{ display: 'flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, color: '#9aa0a8', background: 'rgba(255,255,255,0.06)', border: 'none' }}><X size={15} /></button>
                    )}
                </div>

                {/* Engine cards */}
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {Object.entries(engines).map(([id, e]) => {
                        const c = check(id);
                        const on = engine === id;
                        return (
                            <button key={id} onClick={() => setEngine(id)} className="nb-btn" style={{ textAlign: 'left', borderRadius: 14, padding: '12px 14px', background: on ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.1)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: on ? '#fff' : '#c2c7cf' }}>
                                    {e.name}
                                    {e.recommended && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#86e89a', background: 'rgba(134,232,154,0.1)', border: '1px solid rgba(134,232,154,0.25)', borderRadius: 99, padding: '1px 6px' }}>{t('setup.best')}</span>}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 11, color: '#6b7280' }}>{e.vendor}</div>
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: c?.ok ? '#86e89a' : '#6b7280' }}>
                                    {c?.ok ? <><Check size={11} />v{c.version}</> : t('setup.notInstalled')}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Selected engine: install steps or model picker */}
                {!ready ? (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ borderRadius: 14, padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#c2c7cf' }}>{t('setup.installStep', { name: meta?.name ?? 'the AI' })}</div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <code style={{ flex: 1, fontSize: 12, color: '#ffce7a', overflowX: 'auto', whiteSpace: 'nowrap' }}>{selected?.hint?.cmd}</code>
                                <button onClick={copy} className="nb-btn" style={{ fontSize: 11.5, fontWeight: 600, color: '#c2c7cf', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 10px', flexShrink: 0 }}>{copied ? t('setup.copied') : t('setup.copy')}</button>
                            </div>
                        </div>
                        <div style={{ borderRadius: 14, padding: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#c2c7cf' }}>{t('setup.signStep')}</div>
                            <div style={{ marginTop: 6, fontSize: 12.5, color: '#9aa0a8' }}>{t('setup.signWith', { vendor: meta?.vendor ?? '', hint: meta?.loginHint ?? '' })}</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: 14 }}>
                        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>{t('setup.model')}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(meta?.models ?? []).map((m) => {
                                const on = model === m.id;
                                return <button key={m.label} onClick={() => setModel(m.id)} className="nb-btn" style={{ borderRadius: 99, padding: '7px 14px', fontSize: 12.5, background: on ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#c2c7cf' }}>{m.label}</button>;
                            })}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!ready ? (
                        <Button onClick={refresh} disabled={checking}>{checking ? t('setup.checking') : t('setup.check')}</Button>
                    ) : onClose ? (
                        <Button onClick={onClose}>{t('common.done')}</Button>
                    ) : null}
                    <button onClick={() => window.studio.shell.open(selected?.hint?.url ?? 'https://nativeblade.dev')} className="nb-btn" style={{ fontSize: 12.5, color: '#9aa0a8', background: 'none', border: 'none', textDecoration: 'underline' }}>
                        {t('setup.whatis', { name: meta?.name ?? 'this' })}
                    </button>
                </div>
            </div>
        </div>
    );
}
