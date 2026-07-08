import { History } from 'lucide-react';
import { useT } from '../../lib/i18n.js';

/** A git restore point in the chat — same divider style as the cloud Studio. */
export function Checkpoint({ cp, onRestore }) {
    const t = useT();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
            <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 99, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <History size={12} style={{ color: '#9aa0a8' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9aa0a8' }}>{t('checkpoint.label', { n: cp.n })}</span>
                <button onClick={onRestore} className="nb-btn" title={cp.subject || t('checkpoint.restoreTitle')} style={{ borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#ff8585', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(255,77,77,0.25)' }}>{t('checkpoint.restore')}</button>
            </div>
            <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>
    );
}
