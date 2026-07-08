import { useEffect, useState } from 'react';
import { useAppsStore } from './stores/apps.js';
import { useEnvStore } from './stores/env.js';
import { useChatStore } from './stores/chat.js';
import { usePreviewStore } from './stores/preview.js';
import { useSettingsStore } from './stores/settings.js';
import { TopBar } from './components/layout/TopBar.jsx';
import { SetupScreen } from './components/setup/SetupScreen.jsx';
import { Launcher } from './components/launcher/Launcher.jsx';
import { Workspace } from './components/chat/Workspace.jsx';

/**
 * Top-level flow — same shell as the cloud Studio:
 *   · Chosen AI not installed yet → SetupScreen (the only gate; toolchain is the AI's job).
 *   · Home → Launcher: describe an idea, app list below.
 *   · App open → Workspace chat, Back and the AI picker live in the top bar.
 */
export default function App() {
    const result = useEnvStore((s) => s.result);
    const engines = useEnvStore((s) => s.engines);
    const refreshEnv = useEnvStore((s) => s.refresh);
    const engine = useSettingsStore((s) => s.engine);
    const setEngine = useSettingsStore((s) => s.setEngine);
    const app = useAppsStore((s) => s.apps.find((a) => a.id === s.current));
    const close = useAppsStore((s) => s.close);
    const handleEvent = useChatStore((s) => s.handleEvent);
    const [setupOpen, setSetupOpen] = useState(false);
    const [updateReady, setUpdateReady] = useState(null); // version string when a build is ready

    useEffect(() => window.studio.updates.onStatus((s) => {
        if (s.status === 'ready') setUpdateReady(s.version);
    }), []);

    // A previously-selected engine may no longer exist (e.g. Gemini removed) —
    // fall back to Claude so the setup screen isn't stuck on a dead option.
    useEffect(() => {
        if (engines && !engines[engine]) setEngine('claude');
    }, [engines, engine, setEngine]);

    // Back: clear the device emulation while the webview is still alive (this
    // reliably kills the touch cursor — doing it on unmount races the webview
    // teardown), then close. The dev server dies in the background; deleting an
    // app awaits its own stop, so files aren't locked.
    const back = async () => {
        if (app) await window.studio.preview.resetEmulation(app.id);
        close();
    };

    // Silent doctor on boot + one global subscription to agent events
    // (preview URLs are routed to their own store, the rest is chat).
    useEffect(() => { refreshEnv(); }, [refreshEnv]);
    useEffect(() => window.studio.chat.onEvent((evt) => {
        if (evt.type === 'preview') usePreviewStore.getState().apply(evt.appId, evt);
        else handleEvent(evt);
    }), [handleEvent]);

    if (!result) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="nb-pulse" style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280' }}>NativeBlade Studio</div>
            </div>
        );
    }

    const engineOk = !!result.checks.find((c) => c.id === engine)?.ok;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {updateReady && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '7px 14px', fontSize: 12.5, color: '#fff', background: 'linear-gradient(180deg,#ff5151,#d31f1f)' }}>
                    <span>A new version ({updateReady}) is ready.</span>
                    <button onClick={() => window.studio.updates.restart()} className="nb-btn" style={{ borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#d31f1f', background: '#fff', border: 'none' }}>Restart to update</button>
                    <button onClick={() => setUpdateReady(null)} className="nb-btn" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Later</button>
                </div>
            )}
            <TopBar app={engineOk ? app : null} onBack={back} onOpenSetup={() => setSetupOpen(true)} />
            <div style={{ minHeight: 0, flex: 1 }}>
                {!engineOk ? <SetupScreen /> : app ? <Workspace app={app} /> : <Launcher />}
            </div>
            {engineOk && setupOpen && <SetupScreen onClose={() => setSetupOpen(false)} />}
        </div>
    );
}
