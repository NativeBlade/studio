import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Hand, Paintbrush, QrCode, Rocket, RotateCcw, RotateCw, Share2, Smartphone } from 'lucide-react';
import { useChatStore } from '../../stores/chat.js';
import { usePreviewStore } from '../../stores/preview.js';
import { useConsoleStore } from '../../stores/console.js';
import { devicesForPlatforms, resolveDevice, safeAreaCss } from '../../lib/devices.js';
import { Modal } from '../ui/Modal.jsx';
import { ShareModal } from './ShareModal.jsx';
import { PublishModal } from './PublishModal.jsx';
import { AppStoreLinks } from './AppStoreLinks.jsx';
import logo from '../../assets/nb-logo.png';

/**
 * The live preview: the app's local dev server in a device-emulated <webview>,
 * inside a phone frame. Chromium device emulation (metrics/DPR/UA/touch) plus
 * injected safe-area CSS make it read as iPhone or Android — all Studio-side,
 * the framework is untouched.
 */
export function PreviewPane({ app, preview }) {
    const status = preview?.status ?? null; // starting | up | down
    const url = preview?.url ?? null;
    const lanUrl = preview?.lanUrl ?? null;
    const available = devicesForPlatforms(app.platforms);
    const [deviceId, setDeviceId] = useState(available[0].id);
    const [landscape, setLandscape] = useState(false);
    // Mouse-as-finger off by default: the touch cursor can bleed onto the
    // Studio window. Wheel scrolling works without it; the 🖐️ toggle turns on
    // full drag-scroll/swipe/tap when a screen needs it.
    const [touch, setTouch] = useState(false);
    const [bust, setBust] = useState(0);
    const [qrOpen, setQrOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const busy = useChatStore((s) => s.busy[app.id] ?? false);
    const nonce = usePreviewStore((s) => s.nonce[app.id] ?? 0); // bumped on checkpoint restore
    const src = url ? `${url}?nb=${bust}-${nonce}` : null;

    const building = busy && !app.built;
    const ready = status === 'up' && !building;
    useEffect(() => {
        if (!busy) setBust((b) => b + 1);
    }, [busy]);

    const device = { ...resolveDevice(deviceId, landscape), emitTouch: touch };
    const mobileControls = ready && !device.desktop;

    return (
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {available.map((d) => (
                    <button key={d.id} onClick={() => setDeviceId(d.id)} className="nb-btn" title={d.label} style={{ height: 30, borderRadius: 9, padding: '0 11px', fontSize: 12, fontWeight: 500, background: deviceId === d.id ? 'rgba(220,38,38,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${deviceId === d.id ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}`, color: deviceId === d.id ? '#fff' : '#9aa0a8' }}>
                        {d.label}
                    </button>
                ))}
                {mobileControls && (
                    <button onClick={() => setLandscape((v) => !v)} className="nb-btn" title={landscape ? 'Portrait' : 'Landscape'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: landscape ? 'rgba(220,38,38,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${landscape ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}`, color: landscape ? '#fff' : '#9aa0a8' }}>
                        {landscape ? <RotateCcw size={13} /> : <RotateCw size={13} />}
                    </button>
                )}
                {mobileControls && (
                    <button onClick={() => setTouch((v) => !v)} className="nb-btn" title={touch ? 'Touch on: mouse drags to scroll/swipe (shows a touch dot). Click to turn off.' : 'Touch off: normal cursor, use the wheel to scroll. Click to turn on.'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: touch ? 'rgba(220,38,38,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${touch ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}`, color: touch ? '#fff' : '#9aa0a8' }}>
                        <Hand size={13} />
                    </button>
                )}
                <ServerBadge status={status} />
                <div style={{ flex: 1 }} />
                {ready && (
                    <>
                        {lanUrl && (
                            <button onClick={() => setQrOpen(true)} className="nb-btn" title="Open on your phone" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, borderRadius: 9, padding: '0 10px', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9aa0a8' }}>
                                <QrCode size={13} />Phone
                            </button>
                        )}
                        <button onClick={() => setShareOpen(true)} className="nb-btn" title="Share with someone (public link)" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, borderRadius: 9, padding: '0 10px', fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9aa0a8' }}>
                            <Share2 size={13} />Share
                        </button>
                        <button onClick={() => window.studio.preview.rebuild({ appId: app.id, cwd: app.path })} className="nb-btn" title="Refresh — recompile and reload the app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9aa0a8' }}><Paintbrush size={13} /></button>
                        <button onClick={() => setPublishOpen(true)} className="nb-btn" title="Publish to the App Store and Google Play" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, borderRadius: 9, padding: '0 11px', fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff9d2e,#f97316)' }}>
                            <Rocket size={13} />Publish
                        </button>
                    </>
                )}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                {!ready ? (
                    <div style={{ width: 330, height: '100%', maxHeight: 700, borderRadius: 34, padding: 10, background: '#0b0b0e', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: 20 }}>
                            <img src={logo} alt="" className="nb-pulse" style={{ width: 44, height: 44, objectFit: 'contain' }} />
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e7e9ee' }}>{building ? `Building ${app.name}…` : app.name}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                                {building
                                    ? "Your app shows up here the moment it's ready."
                                    : app.built
                                        ? 'Starting the preview — this can take a few seconds…'
                                        : 'The live preview appears here once the first build lands.'}
                            </div>
                        </div>
                    </div>
                ) : (
                    <DeviceViewport appId={app.id} src={src} device={device} />
                )}
            </div>

            <QrModal open={qrOpen} onClose={() => setQrOpen(false)} lanUrl={lanUrl} appName={app.name} />
            <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} app={app} targetUrl={url} />
            <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
        </div>
    );
}

const BEZEL = 12;

/** A device-sized <webview> in a phone frame, scaled to fit, with live emulation. */
function DeviceViewport({ appId, src, device }) {
    const wrapRef = useRef(null);
    const webviewRef = useRef(null);
    const wcIdRef = useRef(null);
    const cssKeyRef = useRef(null);
    const [scale, setScale] = useState(1);

    const screenW = device.landscape ? device.height : device.width;
    const screenH = device.landscape ? device.width : device.height;
    const frameW = screenW + BEZEL * 2;
    const frameH = screenH + BEZEL * 2;

    // Fit the (fixed-size) device frame inside the available pane.
    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;
        const fit = () => {
            const r = el.getBoundingClientRect();
            setScale(Math.min(r.width / frameW, r.height / frameH, 1));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [frameW, frameH]);

    // Push metrics/UA/touch + safe-area CSS into the webview. Desktop clears
    // any prior emulation (detach resets metrics/UA/touch) and drops the CSS.
    const apply = async () => {
        const wv = webviewRef.current;
        if (!wv || wcIdRef.current == null) return;
        try {
            if (cssKeyRef.current) { await wv.removeInsertedCSS(cssKeyRef.current); cssKeyRef.current = null; }
            if (device.desktop) {
                await window.studio.preview.stopEmulate(wcIdRef.current);
                return;
            }
            await window.studio.preview.emulate({ webContentsId: wcIdRef.current, device, appId });
            cssKeyRef.current = await wv.insertCSS(safeAreaCss(device));
        } catch { /* page navigating — dom-ready will re-apply */ }
    };
    // Keep the dom-ready handler pointing at the current device, not the one
    // captured when the listener was first wired.
    const applyRef = useRef(apply);
    applyRef.current = apply;

    // Wire the webview once; re-apply on every load (fresh page clears CSS),
    // and capture the app's console errors/warnings so the AI can debug them.
    useEffect(() => {
        const wv = webviewRef.current;
        if (!wv) return undefined;
        const onReady = () => {
            wcIdRef.current = wv.getWebContentsId();
            cssKeyRef.current = null;
            applyRef.current();
        };
        const onConsole = (e) => {
            // level is a string ('error'|'warning'|…) in newer Electron, a
            // number in older (>=2 ≈ error). Keep only warnings and errors.
            const level = e.level;
            const important = typeof level === 'string'
                ? (level === 'error' || level === 'warning')
                : level >= 2;
            if (!important) return;
            useConsoleStore.getState().push(appId, {
                level: typeof level === 'string' ? level : (level >= 3 ? 'error' : 'warning'),
                text: e.message ?? '',
                source: e.sourceId ?? '',
                line: e.line ?? 0,
            });
        };
        // Fresh page = fresh console: drop the old app's errors on every load
        // (reload, rebuild, restore) so stale ones never reach the AI.
        const onStartLoading = () => useConsoleStore.getState().clear(appId);
        wv.addEventListener('did-start-loading', onStartLoading);
        wv.addEventListener('dom-ready', onReady);
        wv.addEventListener('console-message', onConsole);
        return () => {
            wv.removeEventListener('did-start-loading', onStartLoading);
            wv.removeEventListener('dom-ready', onReady);
            wv.removeEventListener('console-message', onConsole);
            if (wcIdRef.current != null) window.studio.preview.stopEmulate(wcIdRef.current);
        };
        // Re-wire when the desktop⇄mobile branch swaps the <webview> element
        // (iphone⇄android stays in the same element, so it isn't a dep).
    }, [device.desktop]);

    // Live-update emulation when the device or orientation changes (no reload).
    useEffect(() => { apply(); }, [device.id, device.landscape, device.emitTouch]);

    // Desktop: no phone frame, no emulation — the webview fills the pane.
    if (device.desktop) {
        return (
            <div ref={wrapRef} style={{ width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', background: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
                <webview
                    ref={webviewRef}
                    src={src}
                    // eslint-disable-next-line react/no-unknown-property
                    partition={`persist:studio-${appId}`}
                    style={{ width: '100%', height: '100%', display: 'inline-flex' }}
                />
            </div>
        );
    }

    return (
        <div ref={wrapRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ width: frameW, height: frameH, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center', borderRadius: device.radius, padding: BEZEL, background: '#0b0b0e', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9)' }}>
                <webview
                    ref={webviewRef}
                    src={src}
                    // eslint-disable-next-line react/no-unknown-property
                    partition={`persist:studio-${appId}`}
                    style={{ width: screenW, height: screenH, borderRadius: device.radius - BEZEL, overflow: 'hidden', background: '#fff', display: 'inline-flex' }}
                />
            </div>
        </div>
    );
}

/** Live dot for the dev server: starting (amber pulse) / up (green) / down (grey). */
function ServerBadge({ status }) {
    const map = {
        building: { color: '#ffce7a', label: 'Rebuilding styles…', pulse: true },
        starting: { color: '#ffce7a', label: 'Starting preview…', pulse: true },
        up: { color: '#86e89a', label: 'Live', pulse: false },
        down: { color: '#6b7280', label: 'Server stopped', pulse: false },
    };
    const s = map[status];
    if (!s) return null; // unknown yet — don't flash a misleading state
    return (
        <span title={status === 'starting' ? 'The preview server can take a few seconds to boot' : s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, fontSize: 11.5, color: '#9aa0a8' }}>
            <span className={s.pulse ? 'nb-pulse' : undefined} style={{ width: 7, height: 7, borderRadius: 99, background: s.color }} />
            {s.label}
        </span>
    );
}

function QrModal({ open, onClose, lanUrl, appName }) {
    const [dataUrl, setDataUrl] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open || !lanUrl) return;
        QRCode.toDataURL(lanUrl, { width: 240, margin: 1, color: { dark: '#0b0b0e', light: '#ffffff' } })
            .then(setDataUrl)
            .catch(() => setDataUrl(null));
    }, [open, lanUrl]);

    const copy = () => {
        navigator.clipboard.writeText(lanUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <Modal open={open} onClose={onClose} title="Open on your phone" subtitle={`${appName} — same WiFi network`} maxWidth={340}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {dataUrl && <img src={dataUrl} alt="QR code" style={{ width: 200, height: 200, borderRadius: 14, background: '#fff', padding: 8 }} />}
                <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', borderRadius: 12, padding: '9px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <code style={{ flex: 1, fontSize: 12, color: '#ffce7a', overflowX: 'auto', whiteSpace: 'nowrap' }}>{lanUrl}</code>
                    <button onClick={copy} className="nb-btn" style={{ fontSize: 11.5, fontWeight: 600, color: '#c2c7cf', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 10px', flexShrink: 0 }}>{copied ? 'Copied ✓' : 'Copy'}</button>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.55, textAlign: 'center', color: '#9aa0a8', margin: 0 }}>
                    Scan with your camera or the NativeBlade app, or paste the link in your phone's browser.
                </p>
                <AppStoreLinks />
            </div>
        </Modal>
    );
}
