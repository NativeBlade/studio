import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Globe, Loader } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { AppStoreLinks } from './AppStoreLinks.jsx';
import { useT } from '../../lib/i18n.js';

/**
 * Share a live build with someone outside the WiFi via a Cloudflare quick
 * tunnel. For a non-technical user: it checks for cloudflared and asks
 * permission before downloading it, then produces a public link + QR.
 */
export function ShareModal({ open, onClose, app, targetUrl }) {
    const t = useT();
    const [phase, setPhase] = useState('checking'); // checking | need-install | installing | ready | starting | live | error
    const [publicUrl, setPublicUrl] = useState(null);
    const [qr, setQr] = useState(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setPhase('checking'); setError('');
        (async () => {
            const s = await window.studio.tunnel.status();
            if (!s.installed) { setPhase('need-install'); return; }
            // Reuse an already-running tunnel for this app instead of making a new one.
            const cur = await window.studio.tunnel.current(app.id);
            if (cur.url) { setPublicUrl(cur.url); setPhase('live'); return; }
            setPhase('ready');
        })();
    }, [open, app.id]);

    useEffect(() => {
        if (!publicUrl) { setQr(null); return; }
        QRCode.toDataURL(publicUrl, { width: 220, margin: 1, color: { dark: '#0b0b0e', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
    }, [publicUrl]);

    const install = async () => {
        setPhase('installing'); setError('');
        const res = await window.studio.tunnel.install();
        if (res.ok) { setPhase('ready'); return; }
        setError(res.needsRestart
            ? t('share.installedRestart')
            : (res.output || t('share.installFailed')));
        setPhase('need-install');
    };

    const start = async () => {
        setPhase('starting'); setError('');
        const res = await window.studio.tunnel.start({ appId: app.id, targetUrl });
        if (!res.ok || !res.url) { setError(res.error || t('share.startFailed')); setPhase('ready'); return; }
        setPublicUrl(res.url); setPhase('live');
    };

    const stop = () => { window.studio.tunnel.stop(app.id); setPublicUrl(null); setPhase('ready'); };
    const copy = () => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); };

    const close = () => { onClose(); };

    return (
        <Modal open={open} onClose={close} title={t('share.title')} subtitle={t('share.subtitle')} maxWidth={380}>
            {phase === 'checking' && <Center><Loader size={18} className="nb-spin" /> {t('share.checking')}</Center>}

            {phase === 'need-install' && (
                <div>
                    <p style={p}>{t('share.needInstall')}</p>
                    {error && <Err>{error}</Err>}
                    <Actions>
                        <Ghost onClick={close}>{t('share.notNow')}</Ghost>
                        <Primary onClick={install}><Download size={14} />{t('share.download')}</Primary>
                    </Actions>
                </div>
            )}

            {phase === 'installing' && <Center><Loader size={18} className="nb-spin" /> {t('share.installing')}</Center>}

            {phase === 'ready' && (
                <div>
                    <p style={p}>{t('share.ready')}</p>
                    {error && <Err>{error}</Err>}
                    <Actions>
                        <Ghost onClick={close}>{t('common.cancel')}</Ghost>
                        <Primary onClick={start}><Globe size={14} />{t('share.start')}</Primary>
                    </Actions>
                </div>
            )}

            {phase === 'starting' && <Center><Loader size={18} className="nb-spin" /> {t('share.starting')}</Center>}

            {phase === 'live' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    {qr && <img src={qr} alt="QR" style={{ width: 180, height: 180, borderRadius: 14, background: '#fff', padding: 8 }} />}
                    <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', borderRadius: 12, padding: '9px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <code style={{ flex: 1, fontSize: 12, color: '#86e89a', overflowX: 'auto', whiteSpace: 'nowrap' }}>{publicUrl}</code>
                        <button onClick={copy} className="nb-btn" style={{ fontSize: 11.5, fontWeight: 600, color: '#c2c7cf', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 10px', flexShrink: 0 }}>{copied ? t('common.copied') : t('common.copy')}</button>
                    </div>
                    <p style={{ ...p, textAlign: 'center', margin: 0 }}>{t('share.liveHint')}</p>
                    <AppStoreLinks />
                    <Actions>
                        <Ghost onClick={close}>{t('share.keep')}</Ghost>
                        <Primary onClick={stop}>{t('share.stop')}</Primary>
                    </Actions>
                </div>
            )}
        </Modal>
    );
}

const p = { margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' };
const Center = ({ children }) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0', fontSize: 13, color: '#9aa0a8' }}>{children}</div>;
const Err = ({ children }) => <div style={{ marginBottom: 14, fontSize: 12, color: '#ff8585', wordBreak: 'break-word' }}>{children}</div>;
const Actions = ({ children }) => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{children}</div>;
const Ghost = ({ onClick, children }) => <button onClick={onClick} className="nb-btn" style={{ borderRadius: 11, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>{children}</button>;
const Primary = ({ onClick, children }) => <button onClick={onClick} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff5151,#d31f1f)' }}>{children}</button>;
