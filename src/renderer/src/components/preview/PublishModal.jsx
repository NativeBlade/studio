import { Mail, MessageCircle, Rocket } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { useT } from '../../lib/i18n.js';

const WHATSAPP = 'https://wa.me/34654873927';
const EMAIL = 'mailto:jeffleyd@gmail.com';
const SITE = 'https://nativeblade.dev';
const PRICE = '$200/hour';

/**
 * Publishing to the stores is a paid consulting offer for now, with a
 * self-serve path via nativeblade.dev. Opened from the orange Publish button.
 */
export function PublishModal({ open, onClose }) {
    const t = useT();
    return (
        <Modal open={open} onClose={onClose} title={t('publish.title')} subtitle={t('publish.subtitle')} maxWidth={420}>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                {t('publish.p1')}
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                {t('publish.p2', { price: PRICE })}
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
                {t('publish.self')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => window.studio.shell.open(SITE)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff9d2e,#f97316)' }}>
                    <Rocket size={14} />{t('publish.buildAt')}
                </button>
            </div>
        </Modal>
    );
}
