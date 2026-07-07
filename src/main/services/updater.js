import { app, ipcMain } from 'electron';
import electronUpdater from 'electron-updater';
import { killAllSync } from './child-registry.js';

const { autoUpdater } = electronUpdater;

/**
 * Auto-update over the generic S3 feed (NSIS on Windows, dmg/zip on macOS,
 * deb/rpm on Linux) via electron-updater. Downloads in the background and
 * installs on the next quit; the renderer shows a small "Restart to update"
 * banner when a build is ready. Disabled in dev.
 */
export function setupUpdater(getWindow) {
    if (!app.isPackaged) return; // no updates while developing

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = true; // avoid checksum edge cases
    autoUpdater.logger = console;

    const send = (payload) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) win.webContents.send('update:status', payload);
    };

    autoUpdater.on('update-available', (i) => send({ status: 'available', version: i.version }));
    autoUpdater.on('download-progress', (p) => send({ status: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => send({ status: 'ready', version: i.version }));
    autoUpdater.on('error', (e) => send({ status: 'error', message: String(e?.message ?? e) }));

    // Restart into the new version now. Killing every child first is CRITICAL
    // on Windows: the NSIS installer fails silently if php/vite/AI processes
    // still hold handles to the app directory.
    ipcMain.handle('update:restart', () => {
        killAllSync();
        setTimeout(() => autoUpdater.quitAndInstall(false, true), 400);
    });

    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}
