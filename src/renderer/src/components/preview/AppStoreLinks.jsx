import { Apple, Play } from 'lucide-react';
import { NB_APP } from '../../lib/links.js';

/**
 * Prompt the viewer to install the NativeBlade app for the best (native)
 * experience of a shared build. Shown alongside every share link/QR.
 */
export function AppStoreLinks() {
    return (
        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginTop: 2 }}>
            <div style={{ fontSize: 11.5, color: '#9aa0a8', textAlign: 'center', marginBottom: 8 }}>
                Best experience — open it in the <strong style={{ color: '#e7e9ee' }}>NativeBlade</strong> app:
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => window.studio.shell.open(NB_APP.playStore)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>
                    <Play size={13} />Google Play
                </button>
                <button onClick={() => window.studio.shell.open(NB_APP.appStore)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>
                    <Apple size={13} />App Store
                </button>
            </div>
        </div>
    );
}
