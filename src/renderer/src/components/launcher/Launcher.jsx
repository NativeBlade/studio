import { useState } from 'react';
import { useAppsStore } from '../../stores/apps.js';
import { useChatStore } from '../../stores/chat.js';
import { Modal } from '../ui/Modal.jsx';
import { NewAppForm } from './NewAppForm.jsx';
import { AppCard } from './AppCard.jsx';

/** Home — same flow as the cloud Studio: hero, new-app card, existing apps grid. */
export function Launcher() {
    const apps = useAppsStore((s) => s.apps);
    const removeApp = useAppsStore((s) => s.removeApp);
    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [failedPath, setFailedPath] = useState(null); // folder that couldn't be removed (still locked)

    const confirmDelete = async () => {
        const app = toDelete;
        setDeleting(true);
        const res = await window.studio.apps.delete({ appId: app.id, path: app.path });
        setDeleting(false);
        // Remove from the Studio regardless; if the folder stayed (locked),
        // tell the user where it is so they can delete it by hand.
        useChatStore.getState().clearApp(app.id);
        removeApp(app.id);
        setToDelete(null);
        if (res && res.ok === false && res.path) setFailedPath(res.path);
    };

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '16px 24px' }}>
            <div className="nb-screen" style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 16, paddingBottom: 32 }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.5px', color: '#fff' }}>What are you building today?</h1>
                    <p style={{ marginTop: 8, fontSize: 15, color: '#9aa0a8' }}>Describe your app and AI will design it — or pick one of yours to keep iterating.</p>
                </div>

                <NewAppForm />

                <div>
                    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280' }}>Continue an existing app</div>
                    {apps.length === 0 ? (
                        <div style={{ borderRadius: 16, padding: '32px 20px', textAlign: 'center', fontSize: 13, border: '1px dashed rgba(255,255,255,0.14)', color: '#6b7280' }}>
                            You don't have any apps yet — start a new one above.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {apps.map((a) => <AppCard key={a.id} app={a} onDelete={() => setToDelete(a)} />)}
                        </div>
                    )}
                </div>
            </div>

            <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete this app?" subtitle={toDelete ? `"${toDelete.name}" will be removed from your Studio.` : ''} maxWidth={400}>
                <p style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                    This deletes the app and all of its files from your computer. There is no undo.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setToDelete(null)} disabled={deleting} className="nb-btn" style={{ borderRadius: 11, padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>Cancel</button>
                    <button onClick={confirmDelete} disabled={deleting} className="nb-btn" style={{ borderRadius: 11, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff5151,#d31f1f)' }}>{deleting ? 'Deleting…' : 'Delete app'}</button>
                </div>
            </Modal>

            <Modal open={!!failedPath} onClose={() => setFailedPath(null)} title="Couldn't fully delete the files" subtitle="The app was removed from your Studio, but some files were still in use." maxWidth={420}>
                <p style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.6, color: '#9aa0a8' }}>
                    Windows was still holding files in this folder (often a background process or your antivirus). You can delete it by hand:
                </p>
                <code style={{ display: 'block', marginBottom: 18, fontSize: 12, color: '#ffce7a', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>{failedPath}</code>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setFailedPath(null)} className="nb-btn" style={{ borderRadius: 11, padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>Close</button>
                    <button onClick={() => { window.studio.shell.reveal(failedPath); setFailedPath(null); }} className="nb-btn" style={{ borderRadius: 11, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff5151,#d31f1f)' }}>Open folder</button>
                </div>
            </Modal>
        </div>
    );
}
