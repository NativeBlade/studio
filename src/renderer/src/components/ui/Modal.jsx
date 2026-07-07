import { X } from 'lucide-react';

/**
 * Centered glass modal with backdrop — same look as the cloud Studio.
 * `open` toggles visibility; `onClose` fires on backdrop click and the X.
 */
export function Modal({ open, onClose, title, subtitle, maxWidth = 460, children }) {
    if (!open) return null;
    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(4,4,6,0.62)', backdropFilter: 'blur(8px)' }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="nb-pop"
                style={{ width: '100%', maxWidth, borderRadius: 24, background: 'linear-gradient(180deg,rgba(26,26,30,0.96),rgba(16,16,20,0.96))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 50px 100px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
                <div style={{ padding: 28 }}>
                    {title && (
                        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: '#fff' }}>{title}</h2>
                                {subtitle && <p style={{ marginTop: 6, fontSize: 14, color: '#9aa0a8' }}>{subtitle}</p>}
                            </div>
                            <button onClick={onClose} className="nb-btn" style={{ display: 'flex', width: 30, height: 30, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9, color: '#9aa0a8', background: 'rgba(255,255,255,0.06)', border: 'none' }}>
                                <X size={15} />
                            </button>
                        </div>
                    )}
                    {children}
                </div>
            </div>
        </div>
    );
}
