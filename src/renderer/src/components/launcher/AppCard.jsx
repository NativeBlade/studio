import { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { useAppsStore } from '../../stores/apps.js';
import { useT } from '../../lib/i18n.js';

/** One existing app in the home grid — cloud Studio card style. */
export function AppCard({ app, onDelete }) {
    const open = useAppsStore((s) => s.open);
    const t = useT();
    const [hover, setHover] = useState(false);

    return (
        <div
            onClick={() => open(app.id)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="nb-card nb-card-hover"
            style={{ display: 'flex', cursor: 'pointer', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, textAlign: 'left' }}
        >
            <span style={{ display: 'flex', height: 40, width: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', background: '#dc2626' }}>
                {app.name.slice(0, 1).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.built ? t('card.built') : t('card.draft')} · {(app.platforms || []).map((p) => t(`newapp.${p}`)).join(' + ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, opacity: hover ? 1 : 0, transition: 'opacity .15s' }}>
                {app.path && (
                    <button
                        onClick={(e) => { e.stopPropagation(); window.studio.shell.reveal(app.path); }}
                        title={t('card.explore')}
                        className="nb-btn"
                        style={{ display: 'flex', height: 28, width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#9aa0a8' }}
                    >
                        <FolderOpen size={13} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    title={t('card.delete')}
                    className="nb-btn"
                    style={{ display: 'flex', height: 28, width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', color: '#ff8585' }}
                >
                    <X size={13} />
                </button>
            </div>
        </div>
    );
}
