import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import logo from '../../assets/nb-logo.png';
import { useT } from '../../lib/i18n.js';

/**
 * A masked input the AI asks for when it needs a user-only value (API key,
 * token). The value goes straight to .env via the main process — it never
 * enters the chat log. Replit-style: clear label, help link, save.
 */
export function SecretCard({ message, onResolve }) {
    const t = useT();
    const { spec, resolved } = message;
    const [value, setValue] = useState('');
    const [show, setShow] = useState(false);

    return (
        <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ marginTop: 2, display: 'flex', height: 28, width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: 'linear-gradient(135deg,rgba(255,90,90,0.3),rgba(124,58,237,0.25))' }}>
                <img src={logo} alt="" style={{ height: 16, width: 16, objectFit: 'contain' }} />
            </span>
            <div style={{ flex: 1, borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,77,77,0.28)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <KeyRound size={14} style={{ color: '#ff8585' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#fff' }}>{spec.label}</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: '#9aa0a8' }}>
                    {t('secret.needsPre')}<code style={{ color: '#ffce7a' }}>.env</code>{t('secret.needsPost')}
                    {spec.help && <> {spec.help}</>}
                </p>

                {resolved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#86e89a' }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: '#86e89a' }} />{t('secret.saved')}
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '2px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)' }}>
                            <input
                                type={show ? 'text' : 'password'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onResolve(value.trim()); }}
                                placeholder={t('secret.paste', { label: spec.label })}
                                autoFocus
                                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#e7e9ee', padding: '8px 0' }}
                            />
                            <button onClick={() => setShow((v) => !v)} className="nb-btn" title={show ? t('secret.hide') : t('secret.show')} style={{ display: 'flex', background: 'none', border: 'none', color: '#6b7280' }}>
                                {show ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <button onClick={() => value.trim() && onResolve(value.trim())} disabled={!value.trim()} className="nb-btn" style={{ borderRadius: 10, padding: '0 16px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: value.trim() ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}>{t('secret.save')}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
