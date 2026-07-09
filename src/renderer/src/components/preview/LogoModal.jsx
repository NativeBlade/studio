import { useEffect, useState } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { useChatStore } from '../../stores/chat.js';
import { useT } from '../../lib/i18n.js';

/**
 * Set the app logo two ways: attach a PNG the user made, or generate one with
 * the configured image provider. Either lands at src-tauri/icons/logo.png and
 * the AI runs `nativeblade:icon` + wires the splash. Generate is offered only
 * when an image provider is configured.
 */
export function LogoModal({ open, onClose, app }) {
    const t = useT();
    const applyLogo = useChatStore((s) => s.applyLogo);
    const generateLogo = useChatStore((s) => s.generateLogo);
    const [hasKey, setHasKey] = useState(false);
    const [prompt, setPrompt] = useState('');

    useEffect(() => {
        if (open) window.studio.image.get().then((s) => setHasKey(!!s.hasKey)).catch(() => {});
    }, [open]);

    const attach = () => { onClose(); applyLogo(app); };
    const generate = () => { if (!prompt.trim()) return; onClose(); generateLogo(app, prompt.trim()); setPrompt(''); };

    return (
        <Modal open={open} onClose={onClose} title={t('logo.title')} maxWidth={420}>
            <button onClick={attach} className="nb-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#e7e9ee', textAlign: 'left' }}>
                <Upload size={16} style={{ color: '#9aa0a8', flexShrink: 0 }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('logo.attach')}</span>
                    <span style={{ fontSize: 11.5, color: '#9aa0a8' }}>{t('logo.attachHint')}</span>
                </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('logo.or')}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} style={{ color: '#ff8585' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e7e9ee' }}>{t('logo.generate')}</span>
            </div>

            {hasKey ? (
                <>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        placeholder={t('logo.generatePlaceholder')}
                        style={{ width: '100%', resize: 'none', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#e7e9ee', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <button onClick={generate} disabled={!prompt.trim()} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', background: prompt.trim() ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}>
                            <Sparkles size={14} />{t('logo.generateBtn')}
                        </button>
                    </div>
                </>
            ) : (
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#9aa0a8' }}>{t('logo.needProvider')}</p>
            )}
        </Modal>
    );
}
