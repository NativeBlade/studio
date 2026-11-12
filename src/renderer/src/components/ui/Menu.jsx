import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * A "more" button with a small dropdown, for the preview toolbar's secondary
 * actions. `items`: [{ icon, label, onClick, disabled }]; a null item draws a
 * separator. Closes on a click outside or on Escape.
 */
export function Menu({ items, title }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen((v) => !v)} className="nb-btn" title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: open ? '#fff' : '#9aa0a8' }}>
                <MoreHorizontal size={14} />
            </button>
            {open && (
                <div className="nb-pop" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, minWidth: 220, padding: 6, borderRadius: 14, background: 'linear-gradient(180deg,rgba(26,26,30,0.98),rgba(16,16,20,0.98))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.9)' }}>
                    {items.map((item, i) => (
                        item === null
                            ? <div key={`sep${i}`} style={{ height: 1, margin: '5px 6px', background: 'rgba(255,255,255,0.08)' }} />
                            : (
                                <button
                                    key={item.label}
                                    disabled={item.disabled}
                                    onClick={() => { setOpen(false); item.onClick?.(); }}
                                    className="nb-btn"
                                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, borderRadius: 9, padding: '8px 10px', fontSize: 12.5, textAlign: 'left', background: 'transparent', border: 'none', color: item.disabled ? '#6b7280' : '#e7e9ee', cursor: item.disabled ? 'default' : 'pointer' }}
                                >
                                    <span style={{ display: 'flex', width: 16, justifyContent: 'center', color: item.checked ? '#ff8585' : '#9aa0a8' }}>{item.icon}</span>
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {item.checked !== undefined && <span style={{ fontSize: 11, color: item.checked ? '#ff8585' : '#4b5563' }}>{item.checked ? '✓' : ''}</span>}
                                </button>
                            )
                    ))}
                </div>
            )}
        </div>
    );
}
