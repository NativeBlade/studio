import { Mail, MessageCircle, Rocket } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';

const WHATSAPP = 'https://wa.me/34654873927';
const EMAIL = 'mailto:jeffleyd@gmail.com';
const SITE = 'https://nativeblade.dev';

/**
 * Publishing to the stores is a paid consulting offer for now, with a
 * self-serve path via nativeblade.dev. Opened from the orange Publish button.
 */
export function PublishModal({ open, onClose }) {
    return (
        <Modal open={open} onClose={onClose} title="Publish your app" subtitle="Get it live on the App Store and Google Play." maxWidth={420}>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                Getting an app onto the App Store and Google Play takes a few technical steps: developer accounts, app signing, and each store's review process.
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                Want it handled for you? I can take care of the whole thing. This is a paid consulting service at <strong style={{ color: '#e7e9ee' }}>$200/hour</strong>. Reach out:
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => window.studio.shell.open(WHATSAPP)} className="nb-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#25d366,#128c4b)' }}>
                    <MessageCircle size={15} />WhatsApp
                </button>
                <button onClick={() => window.studio.shell.open(EMAIL)} className="nb-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, color: '#c2c7cf', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <Mail size={15} />Email
                </button>
            </div>
            <div style={{ fontSize: 11.5, color: '#6b7280', textAlign: 'center', marginBottom: 18 }}>+34 654 87 39 27 · jeffleyd@gmail.com</div>

            <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                Prefer to do it yourself? A step by step guide is coming soon, right here in the Studio. For now, head to nativeblade.dev to build your app.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => window.studio.shell.open(SITE)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff9d2e,#f97316)' }}>
                    <Rocket size={14} />Build at nativeblade.dev
                </button>
            </div>
        </Modal>
    );
}
