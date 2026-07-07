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
    const refreshEnv = useEnvStore((s) => s.refresh);
    const engine = useSettingsStore((s) => s.engine);
    const app = useAppsStore((s) => s.apps.find((a) => a.id === s.current));
    const close = useAppsStore((s) => s.close);
    const handleEvent = useChatStore((s) => s.handleEvent);
    const [setupOpen, setSetupOpen] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Back holds until the dev server (and any tunnel) is truly dead, so the
    // app's files aren't locked if the user deletes it right after.
    const leave = async () => {
        if (!app) return close();
        setLeaving(true);
        try {
            await window.studio.preview.stop(app.id); // tunnel stays up for reuse
        } finally {
            setLeaving(false);
            close();
        }
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
            <TopBar app={engineOk ? app : null} onBack={leave} leaving={leaving} onOpenSetup={() => setSetupOpen(true)} />
            <div style={{ minHeight: 0, flex: 1 }}>
                {!engineOk ? <SetupScreen /> : app ? <Workspace app={app} /> : <Launcher />}
            </div>
            {engineOk && setupOpen && <SetupScreen onClose={() => setSetupOpen(false)} />}
        </div>
    );
}
