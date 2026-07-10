import { useEffect, useState } from 'react';
import { Rocket, ExternalLink, Check, LogOut, Loader } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { useT } from '../../lib/i18n.js';

const SITE = 'https://nativeblade.dev';

const primaryBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff9d2e,#f97316)' };
const ghostBtn = { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' };
const field = { width: '100%', borderRadius: 12, padding: '11px 14px', fontSize: 14 };

/**
 * Publish this app's current source to nativeblade.dev: device-code login,
 * pick the account app, set the version, and upload the zip. No build is
 * triggered — the user clicks Build in the portal afterwards.
 */
export function PublishModal({ open, onClose, app }) {
    const t = useT();
    const [status, setStatus] = useState('checking'); // checking | anon | authed
    const [apps, setApps] = useState([]);
    const [slug, setSlug] = useState('');
    const [version, setVersion] = useState('');
    const [phase, setPhase] = useState('idle'); // idle | awaiting | zipping | uploading | done | error
    const [message, setMessage] = useState('');
    const [awaitUrl, setAwaitUrl] = useState(null);
    const [userCode, setUserCode] = useState(null);

    // Progress from the main process (login opened, zipping, uploading).
    useEffect(() => {
        return window.studio.publish.onEvent((e) => {
            if (e.type === 'awaiting') { setPhase('awaiting'); setAwaitUrl(e.url); setUserCode(e.userCode); }
            else if (e.type === 'zipping') setPhase('zipping');
            else if (e.type === 'uploading') setPhase('uploading');
        });
    }, []);

    // Refresh whenever the modal opens.
    useEffect(() => {
        if (!open) return;
        setPhase('idle'); setMessage(''); setAwaitUrl(null);
        (async () => {
            const s = await window.studio.publish.status();
            if (s.authenticated) await loadAuthed();
            else setStatus('anon');
        })();
    }, [open]);

    const loadAuthed = async () => {
        setStatus('authed');
        try {
            const list = await window.studio.publish.apps();
            setApps(list);
            const match = list.find((a) => a.slug === app?.slug) || list[0];
            setSlug(match?.slug || '');
        } catch { setApps([]); }
        if (app?.path) setVersion(await window.studio.publish.version(app.path));
    };

    const connect = async () => {
        setPhase('awaiting'); setMessage('');
        try {
            await window.studio.publish.login();
            setPhase('idle'); setAwaitUrl(null);
            await loadAuthed();
        } catch (e) { setPhase('error'); setMessage(String(e?.message || e)); }
    };

    const logout = async () => {
        await window.studio.publish.logout();
        setStatus('anon'); setApps([]); setSlug(''); setPhase('idle');
    };

    const publish = async () => {
        if (!slug || !version.trim()) return;
        setPhase('zipping'); setMessage('');
        try {
            const res = await window.studio.publish.upload({ slug, cwd: app.path, version: version.trim() });
            setPhase('done'); setMessage(res.version);
        } catch (e) { setPhase('error'); setMessage(String(e?.message || e)); }
    };

    const busy = phase === 'awaiting' || phase === 'zipping' || phase === 'uploading';
    // Block closing only during the actual upload; login polling can be
    // dismissed (it finishes in the background and shows as connected next time).
    const locked = phase === 'zipping' || phase === 'uploading';

    return (
        <Modal open={open} onClose={locked ? undefined : onClose} title={t('publish.title')} subtitle={t('publish.subtitle')} maxWidth={440}>
            {status === 'checking' && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0' }}>
                    <Loader size={22} className="nb-spin" style={{ color: '#9aa0a8' }} />
                </div>
            )}

            {status === 'anon' && (
                <div>
                    <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>{t('publish.connectDesc')}</p>
                    {phase === 'awaiting' ? (
                        <div>
                            {userCode && (
                                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                                    <div style={{ fontSize: 12, color: '#9aa0a8', marginBottom: 6 }}>{t('publish.confirmCode')}</div>
                                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', color: '#fff', fontFamily: 'ui-monospace, monospace' }}>{userCode}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, color: '#c2c7cf' }}>
                                <Loader size={16} className="nb-spin" style={{ color: '#ff9d2e' }} />
                                <span>{t('publish.approve')}</span>
                            </div>
                            {awaitUrl && (
                                <div style={{ textAlign: 'center', marginTop: 12 }}>
                                    <button onClick={() => window.studio.shell.open(awaitUrl)} className="nb-btn" style={{ ...ghostBtn, margin: '0 auto' }}><ExternalLink size={13} />{t('publish.openBrowser')}</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={connect} className="nb-btn" style={primaryBtn}><Rocket size={15} />{t('publish.connect')}</button>
                    )}
                    {phase === 'error' && <p style={{ marginTop: 12, fontSize: 12.5, color: '#ff8585' }}>{message}</p>}
                </div>
            )}

            {status === 'authed' && phase !== 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {apps.length === 0 ? (
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>{t('publish.noApps')}</p>
                    ) : (
                        <>
                            <label style={{ fontSize: 12, color: '#9aa0a8' }}>{t('publish.app')}
                                <select value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} className="nb-field" style={{ ...field, marginTop: 6 }}>
                                    {apps.map((a) => <option key={a.slug} value={a.slug} style={{ background: '#16161a' }}>{a.name} ({a.slug})</option>)}
                                </select>
                            </label>
                            <label style={{ fontSize: 12, color: '#9aa0a8' }}>{t('publish.version')}
                                <input value={version} onChange={(e) => setVersion(e.target.value)} disabled={busy} placeholder="1.0.0" className="nb-field" style={{ ...field, marginTop: 6 }} />
                            </label>
                        </>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <button onClick={logout} className="nb-btn" style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }} disabled={busy}><LogOut size={13} />{t('publish.logout')}</button>
                        <button onClick={publish} className="nb-btn" style={{ ...primaryBtn, opacity: (busy || !slug || !version.trim()) ? 0.6 : 1 }} disabled={busy || !slug || !version.trim()}>
                            {busy ? <Loader size={15} className="nb-spin" /> : <Rocket size={15} />}
                            {phase === 'zipping' ? t('publish.zipping') : phase === 'uploading' ? t('publish.uploading') : t('publish.publish')}
                        </button>
                    </div>
                    {phase === 'error' && <p style={{ fontSize: 12.5, color: '#ff8585' }}>{message}</p>}
                </div>
            )}

            {phase === 'done' && (
                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                    <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'rgba(134,232,154,0.12)', marginBottom: 12 }}>
                        <Check size={22} style={{ color: '#86e89a' }} />
                    </span>
                    <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#fff' }}>{t('publish.doneTitle', { version: message })}</p>
                    <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>{t('publish.done')}</p>
                    <button onClick={() => window.studio.shell.open(SITE)} className="nb-btn" style={{ ...primaryBtn, margin: '0 auto' }}><ExternalLink size={14} />{t('publish.openPortal')}</button>
                </div>
            )}
        </Modal>
    );
}
