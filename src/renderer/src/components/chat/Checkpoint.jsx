import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useT } from '../../lib/i18n.js';

/**
 * A git restore point in the chat. Hovering the label shows how the app
 * looked when the checkpoint was taken (the Studio photographs the preview
 * at every checkpoint), so the user compares before giving up later work.
 */
export function Checkpoint({ cp, app, onRestore }) {
    const t = useT();
    const [hover, setHover] = useState(false);
    const [shot, setShot] = useState(undefined); // undefined = not asked yet, null = none

    useEffect(() => {
        if (!hover || shot !== undefined || !app?.path) return;
        window.studio.preview.shot({ cwd: app.path, name: `checkpoints/${cp.sha}` })
            .then((url) => setShot(url ?? null))
            .catch(() => setShot(null));
    }, [hover, shot, app?.path, cp.sha]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0', position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 99, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <History size={12} style={{ color: '#9aa0a8' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9aa0a8' }}>{t('checkpoint.label', { n: cp.n })}</span>
                <button onClick={onRestore} className="nb-btn" title={cp.subject || t('checkpoint.restoreTitle')} style={{ borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#ff8585', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(255,77,77,0.25)' }}>{t('checkpoint.restore')}</button>
            </div>
            <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            {hover && shot && (
                <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 8, zIndex: 5, borderRadius: 14, padding: 6, background: '#0b0b0e', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 40px -20px rgba(0,0,0,0.9)' }}>
                    <img src={shot} alt="" title={t('checkpoint.preview')} style={{ display: 'block', width: 180, borderRadius: 10 }} />
                    {cp.subject && <div style={{ maxWidth: 180, marginTop: 6, fontSize: 10.5, lineHeight: 1.4, color: '#9aa0a8' }}>{cp.subject}</div>}
                </div>
            )}
        </div>
    );
}
