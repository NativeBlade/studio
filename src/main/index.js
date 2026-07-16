import { app, BrowserWindow, ipcMain, shell, webContents, dialog } from 'electron';
import { execFile } from 'child_process';
import { join, resolve, dirname } from 'path';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { checkEnvironment } from './services/env.js';
import { createSession, listEngines } from './services/engines.js';
import { imageStatus, setImageConfig, generateImage, IMAGE_PROVIDERS } from './services/image.js';
import { scaffoldApp, updateFramework } from './services/scaffold.js';
import { startPreview, stopPreview, rebuildPreview } from './services/dev-server.js';
import { tunnelStatus, tunnelInstall, startTunnel, stopTunnel, currentTunnel } from './services/tunnel.js';
import { killAllSync } from './services/child-registry.js';
import { fixPath } from './services/fix-path.js';
import { setupUpdater } from './services/updater.js';
import { publishStatus, publishLogout, publishLogin, publishApps, publishVersion, publishUpload } from './services/publish.js';

/** Read a PNG's pixel dimensions from its IHDR header (no image lib needed). */
function pngSize(path) {
    try {
        const b = readFileSync(path);
        if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null; // not a PNG
        return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    } catch { return null; }
}

/** The main window, so the updater can push status to the renderer. */
let mainWindow = null;

/** One live AI CLI session per app id (rebuilt if the user switches engine/model). */
const sessions = new Map(); // appId -> { key, session }

/** appId -> the preview webview's webContentsId, so Back can reset its emulation. */
const emulatedWc = new Map();

/** Cached toolchain report — the renderer only needs it once per boot; the AI gets it via CLAUDE.md. */
let envPromise = null;
const getEnv = (fresh = false) => {
    if (fresh || !envPromise) envPromise = checkEnvironment();
    return envPromise;
};

// The generated icons live at <projectRoot>/build/icons; import.meta.dirname
// is out/main, so two levels up. Windows wants the .ico, others a png.
const APP_ICON = join(
    import.meta.dirname,
    '../../build/icons',
    process.platform === 'win32' ? 'icon.ico' : '256x256.png',
);

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1040,
        minHeight: 680,
        backgroundColor: '#060608',
        autoHideMenuBar: true,
        icon: APP_ICON,
        webPreferences: {
            preload: join(import.meta.dirname, '../preload/index.mjs'),
            sandbox: false,
            webviewTag: true, // the device-emulated preview is a <webview>
        },
    });

    // External links open in the OS browser, never inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
    }

    mainWindow = win;
    win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
    return win;
}

// Emit to the renderer only if its window still exists — otherwise a dev
// server or AI process that emits after the window closed throws
// "Object has been destroyed" on the dead webContents.
function safeEmit(sender, appId) {
    return (evt) => {
        if (!sender.isDestroyed()) sender.send('agent:event', { appId, ...evt });
    };
}

app.whenReady().then(async () => {
    // Windows uses this to pick the taskbar icon and group windows correctly.
    if (process.platform === 'win32') app.setAppUserModelId('dev.nativeblade.studio');

    // Adopt the login shell's PATH so tools are found when launched from the
    // Dock/Finder on macOS/Linux (GUI apps get a bare PATH otherwise).
    await fixPath();

    ipcMain.handle('env:check', () => getEnv(true));
    ipcMain.handle('engines:list', () => listEngines());

    // Optional image generation (the user's own image-API key). The renderer
    // only ever learns the provider + whether a key is set, never the key.
    ipcMain.handle('image:providers', () => IMAGE_PROVIDERS);
    ipcMain.handle('image:get', () => imageStatus());
    ipcMain.handle('image:set', (_e, cfg) => setImageConfig(cfg));
    ipcMain.handle('image:test', async (_e, { prompt } = {}) => {
        try {
            const buf = await generateImage({ prompt: prompt || 'A simple, friendly app logo: a flat vector mark centered on a solid background, no text.' });
            return { ok: true, dataUrl: `data:image/png;base64,${buf.toString('base64')}` };
        } catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });
    // Generate straight into the project (used by the AI's [[NB_IMAGE]] marker).
    ipcMain.handle('image:generate', async (_e, { cwd, prompt, path, size }) => {
        try {
            if (!cwd || !path || !prompt) return { ok: false, error: 'Missing cwd, path or prompt.' };
            const target = resolve(join(cwd, path));
            if (target !== resolve(cwd) && !target.startsWith(resolve(cwd) + '\\') && !target.startsWith(resolve(cwd) + '/')) {
                return { ok: false, error: 'The image path escapes the project.' };
            }
            const buf = await generateImage({ prompt, size });
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, buf);
            return { ok: true, path };
        } catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });
    ipcMain.handle('shell:open', (_e, url) => shell.openExternal(url));
    ipcMain.handle('shell:reveal', (_e, path) => shell.openPath(path));
    ipcMain.handle('app:locale', () => app.getLocale()); // e.g. "pt-BR" — for the first-run language guess

    // Apps live in the user's Documents, one folder per slug.
    ipcMain.handle('apps:ensure-dir', (_e, slug) => {
        const dir = join(app.getPath('documents'), 'NativeBlade Studio', slug);
        mkdirSync(dir, { recursive: true });
        return dir;
    });

    // Deleting an app removes its folder too — otherwise a new app with the
    // same name lands in the old folder and "resumes" a stale install.
    ipcMain.handle('apps:delete', async (_e, { appId, path }) => {
        sessions.get(appId)?.session.stop();
        sessions.delete(appId);
        await stopPreview(appId); // wait for the dev server to release file locks
        stopTunnel(appId); // a deleted app shouldn't stay publicly shared
        if (!path) return { ok: true };
        // Safety: only ever delete inside the Studio's own apps root.
        const root = join(app.getPath('documents'), 'NativeBlade Studio');
        const target = resolve(path);
        if (!target.startsWith(root + '\\') && !target.startsWith(root + '/')) return { ok: false, path };
        // The killed dev server / AI can hold locks on node_modules for a beat
        // (and AV/indexer scans a fresh scaffold): give it a moment, then rely
        // on rmSync's built-in Windows lock retry (maxRetries/retryDelay).
        for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 1200));
            try {
                rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
            } catch { /* still locked — loop */ }
            if (!existsSync(target)) return { ok: true };
        }
        return { ok: false, path };
    });

    // Attach a user-supplied logo: copy a PNG into src-tauri/icons/logo.png, the
    // exact source `php artisan nativeblade:icon` reads to generate every platform
    // icon. Returns the pixel size so the caller can warn if it isn't 1024×1024.
    ipcMain.handle('apps:attach-logo', async (_e, { cwd }) => {
        if (!cwd) return { ok: false };
        const picked = await dialog.showOpenDialog(mainWindow, {
            title: 'Choose your app logo (1024×1024 PNG)',
            filters: [{ name: 'PNG image', extensions: ['png'] }],
            properties: ['openFile'],
        });
        if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, canceled: true };
        try {
            const src = picked.filePaths[0];
            const size = pngSize(src);
            const iconsDir = join(cwd, 'src-tauri', 'icons');
            mkdirSync(iconsDir, { recursive: true });
            copyFileSync(src, join(iconsDir, 'logo.png'));
            return { ok: true, width: size?.width ?? null, height: size?.height ?? null };
        } catch (err) {
            return { ok: false, error: String(err?.message || err) };
        }
    });

    // The app's logo for the home list, as a data URL. Prefer a small generated
    // icon (fast); fall back to the 1024 source if that's all there is yet.
    ipcMain.handle('apps:logo', (_e, { cwd }) => {
        if (!cwd) return null;
        for (const rel of ['src-tauri/icons/128x128.png', 'src-tauri/icons/icon.png', 'src-tauri/icons/logo.png']) {
            const p = join(cwd, ...rel.split('/'));
            if (existsSync(p)) {
                try { return `data:image/png;base64,${readFileSync(p).toString('base64')}`; } catch { /* try next */ }
            }
        }
        return null;
    });

    // Write a secret straight into the app's .env — never through the chat log.
    ipcMain.handle('env:set-secret', (_e, { cwd, key, value }) => {
        const root = join(app.getPath('documents'), 'NativeBlade Studio');
        const dir = resolve(cwd ?? '');
        if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) return { ok: false };
        if (!/^[A-Z0-9_]+$/i.test(key || '')) return { ok: false };

        const file = join(dir, '.env');
        // Quote if the value could be mis-parsed by dotenv (spaces, #, quotes…).
        const line = /[\s#"'=$]/.test(value ?? '')
            ? `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
            : `${key}=${value ?? ''}`;

        let env = existsSync(file) ? readFileSync(file, 'utf-8') : '';
        const re = new RegExp(`^${key}=.*$`, 'm');
        env = re.test(env) ? env.replace(re, line) : (env && !env.endsWith('\n') ? env + '\n' : env) + line + '\n';
        writeFileSync(file, env);
        return { ok: true };
    });

    // How long an app can sit before the Studio refreshes NativeBlade on the
    // next request. Long enough that day-to-day work never pays for it.
    const FRAMEWORK_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    ipcMain.handle('chat:send', async (event, { appId, cwd, text, app: appInfo, scaffold, engine, model, context, frameworkUpdatedAt }) => {
        const emit = safeEmit(event.sender, appId);
        const key = `${engine ?? 'claude'}:${model ?? ''}:${context ?? ''}`;
        let entry = sessions.get(appId);
        if (!entry || entry.key !== key) {
            entry = { key, session: await createSession({ engine, model, cwd, emit, context }) };
            sessions.set(appId, entry);
        }
        const session = entry.session;

        // "Approve & build": the Studio scaffolds deterministically first —
        // the AI only builds features on top of a working project.
        if (scaffold) {
            const ok = await scaffoldApp({ dir: cwd, appInfo: appInfo ?? {}, env: await getEnv(), emit });
            if (!ok) return; // scaffold already emitted the error
            startPreview({ appId, dir: cwd, emit: safeEmit(event.sender, appId) });
            return { frameworkUpdatedAt: new Date().toISOString() }; // scaffold installs the latest
        }

        // An app left alone for a week is probably on an old NativeBlade. Bring
        // it forward before the AI works on it, and tell the AI what changed —
        // the date only advances on a real update, so a failure retries later.
        const age = frameworkUpdatedAt ? Date.now() - new Date(frameworkUpdatedAt).getTime() : Infinity;
        let updatedAt = null;
        if (age > FRAMEWORK_MAX_AGE) {
            const { ok, note } = await updateFramework({ dir: cwd, emit });
            if (note) {
                text = `${note}\n\n${text}`;
                await rebuildPreview({ appId, dir: cwd, emit }); // new version ships new assets
            }
            if (ok) updatedAt = new Date().toISOString();
        }

        session.send(text);
        return { frameworkUpdatedAt: updatedAt };
    });

    // The same update on demand, from the preview toolbar. The note goes back to
    // the renderer, which rides it along on the user's next request.
    ipcMain.handle('framework:update', async (event, { appId, cwd }) => {
        const emit = safeEmit(event.sender, appId);
        const { ok, note } = await updateFramework({ dir: cwd, emit });
        if (note) await rebuildPreview({ appId, dir: cwd, emit });
        return { ok, note, frameworkUpdatedAt: ok ? new Date().toISOString() : null };
    });

    ipcMain.handle('chat:stop', (_e, appId) => {
        sessions.get(appId)?.session.stop();
    });

    ipcMain.handle('preview:start', (event, { appId, cwd }) => {
        startPreview({ appId, dir: cwd, emit: safeEmit(event.sender, appId) });
    });

    ipcMain.handle('preview:stop', (_e, appId) => stopPreview(appId));

    // Full CSS rebuild: stop → npm run build → start (Tailwind only compiles on
    // build, and php-wasm bakes CSS at boot, so nothing lighter works).
    ipcMain.handle('preview:rebuild', (event, { appId, cwd }) =>
        rebuildPreview({ appId, dir: cwd, emit: safeEmit(event.sender, appId) }));

    // Device emulation for the preview <webview> — the same stack Chrome
    // DevTools' device toolbar uses (metrics + DPR + mobile + UA + touch),
    // driven over CDP so nothing in the previewed app has to cooperate.
    ipcMain.handle('preview:emulate', async (event, { webContentsId, device, appId }) => {
        const wc = webContents.fromId(webContentsId);
        if (!wc || wc.isDestroyed()) return { ok: false };
        if (appId != null) emulatedWc.set(appId, webContentsId); // so Back can reset it while the webview is alive
        try {
            if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
            const w = device.landscape ? device.height : device.width;
            const h = device.landscape ? device.width : device.height;
            await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
                width: w,
                height: h,
                deviceScaleFactor: device.dpr,
                mobile: true,
                screenOrientation: device.landscape
                    ? { type: 'landscapePrimary', angle: 90 }
                    : { type: 'portraitPrimary', angle: 0 },
            });
            await wc.debugger.sendCommand('Emulation.setUserAgentOverride', {
                userAgent: device.ua,
                platform: device.platform,
            });
            // Touch capabilities (navigator.maxTouchPoints, ontouchstart,
            // pointer:coarse) so the app detects a touch device.
            await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
            // Mouse-as-finger: makes drag scroll, swipe and tap work with the
            // mouse (default on). It also paints a small touch-point cursor —
            // the preview's Touch toggle turns both off together.
            await wc.debugger.sendCommand('Emulation.setEmitTouchEventsForMouse', {
                enabled: device.emitTouch !== false,
                configuration: 'mobile',
            });
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String(e?.message ?? e) };
        }
    });

    // Public tunnel (cloudflared) so a build can be shown to someone remote.
    ipcMain.handle('tunnel:status', () => tunnelStatus());
    ipcMain.handle('tunnel:install', () => tunnelInstall());
    ipcMain.handle('tunnel:start', (_e, payload) => startTunnel(payload));
    ipcMain.handle('tunnel:stop', (_e, appId) => stopTunnel(appId));
    ipcMain.handle('tunnel:current', (_e, appId) => currentTunnel(appId));

    // Explicitly undo the emulation before detaching — a bare detach on a
    // webContents that's about to go away can leave the touch cursor stuck on
    // the host window. Reset touch/metrics first, then detach.
    async function resetEmulation(wc) {
        if (!wc || wc.isDestroyed() || !wc.debugger.isAttached()) return;
        try {
            await wc.debugger.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: false, configuration: 'desktop' });
            await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
            await wc.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
        } catch { /* webContents may already be tearing down */ }
        try { wc.debugger.detach(); } catch { /* already gone */ }
    }

    ipcMain.handle('preview:stopEmulate', (_e, webContentsId) => resetEmulation(webContents.fromId(webContentsId)));

    // Called on Back, while the webview is still alive — this is the reliable
    // path that actually clears the touch cursor (unmount races the teardown).
    ipcMain.handle('preview:resetEmulation', (_e, appId) => {
        const id = emulatedWc.get(appId);
        if (id == null) return;
        emulatedWc.delete(appId);
        return resetEmulation(webContents.fromId(id));
    });

    // Git checkpoints: the AI commits each round, so HEAD after a turn is a
    // restore point, and restore is a plain reset. execFile (no shell) keeps
    // the space in "NativeBlade Studio" from breaking anything.
    ipcMain.handle('git:head', (_e, cwd) => new Promise((res) => {
        execFile('git', ['rev-parse', 'HEAD'], { cwd, windowsHide: true }, (err, sha) => {
            if (err) return res(null);
            execFile('git', ['log', '-1', '--format=%s'], { cwd, windowsHide: true }, (e2, subject) => {
                res({ sha: sha.trim(), subject: (subject ?? '').trim() });
            });
        });
    }));

    ipcMain.handle('git:reset', (_e, { cwd, sha }) => new Promise((res) => {
        execFile('git', ['reset', '--hard', sha], { cwd, windowsHide: true }, (err) => res({ ok: !err }));
    }));

    // Publishing to nativeblade.dev (device-code login, list, zip + upload).
    const publishEmit = (event) => (p) => { if (!event.sender.isDestroyed()) event.sender.send('publish:event', p); };
    ipcMain.handle('publish:status', () => publishStatus());
    ipcMain.handle('publish:logout', () => publishLogout());
    ipcMain.handle('publish:apps', () => publishApps());
    ipcMain.handle('publish:version', (_e, cwd) => publishVersion(cwd));
    ipcMain.handle('publish:login', (event) => publishLogin({ emit: publishEmit(event) }));
    ipcMain.handle('publish:upload', (event, { slug, cwd, version }) =>
        publishUpload({ slug, projectDir: cwd, version, emit: publishEmit(event) }));

    createWindow();
    setupUpdater(() => mainWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Synchronous: async taskkill races the exit and leaves vite/AI processes
// (dev servers, tunnels) running after the window closes.
app.on('before-quit', () => killAllSync());
