import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreviewStore } from '../../stores/preview.js';
import { ChatPanel } from './ChatPanel.jsx';
import { PreviewPane } from '../preview/PreviewPane.jsx';

/**
 * App workspace: chat on the left, live preview on the right, draggable
 * divider between them — same layout as the cloud Studio. The dev server
 * lives only while this view is open (started on enter, stopped on leave).
 */
export function Workspace({ app }) {
    const [chatW, setChatW] = useState(480);
    const rootRef = useRef(null);
    const preview = usePreviewStore((s) => s.byApp[app.id] ?? null);

    // The dev server is bound to this view: start on enter, stop on leave, so
    // vite never lingers in the background once the user is back on the home.
    // Show "starting" optimistically so opening a built app never flashes a
    // stale "Server stopped" while the server spins up (which can take a bit).
    useEffect(() => {
        if (app.path) {
            if (app.built) usePreviewStore.getState().apply(app.id, { status: 'starting', url: null });
            window.studio.preview.start({ appId: app.id, cwd: app.path });
        }
        // Stop the dev server on leave (frees node_modules locks), but keep any
        // active tunnel alive so returning reuses the same public URL instead
        // of spawning a new one. The tunnel ends on Stop sharing / delete / quit.
        return () => { window.studio.preview.stop(app.id); };
    }, [app.id, app.path, app.built]);

    // Drag the divider to resize the chat column (min 360, keep 380 for preview).
    const startDrag = useCallback((e) => {
        e.preventDefault();
        const rootLeft = rootRef.current.getBoundingClientRect().left;
        const max = rootRef.current.getBoundingClientRect().width - 380;
        const move = (ev) => setChatW(Math.min(max, Math.max(360, ev.clientX - rootLeft - 16)));
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }, []);

    return (
        <div ref={rootRef} className="nb-screen" style={{ height: '100%', display: 'grid', gridTemplateColumns: `${chatW}px 14px 1fr`, padding: 16 }}>
            <ChatPanel app={app} />

            <div onMouseDown={startDrag} title="Drag to resize" style={{ cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 3, height: 44, borderRadius: 99, background: 'rgba(255,255,255,0.14)' }} />
            </div>

            <PreviewPane app={app} preview={preview} />
        </div>
    );
}
