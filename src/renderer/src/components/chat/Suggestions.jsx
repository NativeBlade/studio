import { Sparkles } from 'lucide-react';
import { useT } from '../../lib/i18n.js';

/**
 * Native powers offered after a build. The user came from web tools, so it
 * never occurs to them to ask for the camera, the vibration motor or a
 * notification — those simply don't exist where they're coming from. The AI
 * proposes the ones that fit the app it just built; tapping one sends its
 * prompt as the next message, so a whole native feature costs one click.
 *
 * Disabled while a turn is running: they'd queue up behind it and read as
 * ignored taps.
 */
export function Suggestions({ items, busy, onPick }) {
    const t = useT();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280' }}>
                <Sparkles size={12} style={{ color: '#ffb066' }} />{t('chat.suggestTitle')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map((it) => (
                    <button
                        key={it.label}
                        onClick={() => onPick(it.prompt)}
                        disabled={busy}
                        className="nb-btn"
                        title={it.prompt}
                        style={{ borderRadius: 99, padding: '7px 13px', fontSize: 12.5, textAlign: 'left', color: busy ? '#6b7280' : '#e6e8eb', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
                    >
                        {it.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
