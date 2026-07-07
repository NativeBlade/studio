/**
 * Device profiles for the preview. Logical CSS size + DPR + UA drive Chromium
 * device emulation (metrics/touch), and the safe-area insets are injected into
 * the app via webview.insertCSS so notch / home-indicator paddings behave —
 * all from the Studio side, nothing in the framework changes.
 */
export const DEVICES = {
    iphone: {
        id: 'iphone',
        label: 'iPhone',
        os: 'ios',
        // iPhone 15 / 15 Pro logical viewport.
        width: 393,
        height: 852,
        dpr: 3,
        radius: 44,
        platform: 'iPhone',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        // Portrait insets; landscape swaps to the sides + a smaller bottom.
        safe: { top: 59, bottom: 34, left: 0, right: 0 },
        safeLandscape: { top: 0, bottom: 21, left: 59, right: 59 },
        font: '-apple-system, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
    },
    android: {
        id: 'android',
        label: 'Android',
        os: 'android',
        // Pixel 8 logical viewport.
        width: 412,
        height: 915,
        dpr: 2.625,
        radius: 32,
        platform: 'Linux armv8l',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        // Status bar on top; gesture-nav devices have no bottom inset.
        safe: { top: 24, bottom: 0, left: 0, right: 0 },
        safeLandscape: { top: 0, bottom: 0, left: 24, right: 24 },
        font: 'Roboto, "Noto Sans", "Helvetica Neue", sans-serif',
    },
    desktop: {
        id: 'desktop',
        label: 'Desktop',
        desktop: true, // no phone frame, no mobile emulation — fills the pane
    },
};

/** Which device chips to show, based on the platforms the app targets. */
export function devicesForPlatforms(platforms = []) {
    const ids = [];
    if (platforms.includes('Mobile')) ids.push('iphone', 'android');
    if (platforms.includes('Desktop')) ids.push('desktop');
    return (ids.length ? ids : ['iphone']).map((id) => DEVICES[id]);
}

/** Resolve a device + orientation into the full emulation payload. */
export function resolveDevice(id, landscape) {
    const d = DEVICES[id] ?? DEVICES.iphone;
    const safe = landscape ? d.safeLandscape : d.safe;
    return { ...d, landscape, safe };
}

/**
 * The stylesheet injected into the previewed app: feed the framework's
 * --nb-safe-* variables real device insets (it defaults them to
 * env(safe-area-inset-*), which is 0 in a desktop webview), and nudge the
 * system font so the platform reads right. `!important` so it wins over the
 * app's inline :root definition.
 */
export function safeAreaCss(device) {
    const { top, bottom, left, right } = device.safe;
    return `:root{
  --nb-safe-top:${top}px !important;
  --nb-safe-bottom:${bottom}px !important;
  --nb-safe-left:${left}px !important;
  --nb-safe-right:${right}px !important;
}
html{ font-family:${device.font}; }`;
}
