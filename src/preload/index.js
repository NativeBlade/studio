import { contextBridge, ipcRenderer } from 'electron';

// The single bridge between the renderer and the machine.
contextBridge.exposeInMainWorld('studio', {
    env: {
        check: () => ipcRenderer.invoke('env:check'),
        setSecret: (payload) => ipcRenderer.invoke('env:set-secret', payload),
    },
    engines: {
        list: () => ipcRenderer.invoke('engines:list'),
    },
    shell: {
        open: (url) => ipcRenderer.invoke('shell:open', url),
        reveal: (path) => ipcRenderer.invoke('shell:reveal', path),
    },
    locale: () => ipcRenderer.invoke('app:locale'),
    apps: {
        ensureDir: (slug) => ipcRenderer.invoke('apps:ensure-dir', slug),
        delete: (payload) => ipcRenderer.invoke('apps:delete', payload),
    },
    chat: {
        send: (payload) => ipcRenderer.invoke('chat:send', payload),
        stop: (appId) => ipcRenderer.invoke('chat:stop', appId),
        onEvent: (cb) => {
            const handler = (_e, evt) => cb(evt);
            ipcRenderer.on('agent:event', handler);
            return () => ipcRenderer.removeListener('agent:event', handler);
        },
    },
    preview: {
        start: (payload) => ipcRenderer.invoke('preview:start', payload),
        stop: (appId) => ipcRenderer.invoke('preview:stop', appId),
        emulate: (payload) => ipcRenderer.invoke('preview:emulate', payload),
        stopEmulate: (webContentsId) => ipcRenderer.invoke('preview:stopEmulate', webContentsId),
        resetEmulation: (appId) => ipcRenderer.invoke('preview:resetEmulation', appId),
        rebuild: (payload) => ipcRenderer.invoke('preview:rebuild', payload),
    },
    tunnel: {
        status: () => ipcRenderer.invoke('tunnel:status'),
        install: () => ipcRenderer.invoke('tunnel:install'),
        start: (payload) => ipcRenderer.invoke('tunnel:start', payload),
        stop: (appId) => ipcRenderer.invoke('tunnel:stop', appId),
        current: (appId) => ipcRenderer.invoke('tunnel:current', appId),
    },
    git: {
        head: (cwd) => ipcRenderer.invoke('git:head', cwd),
        reset: (payload) => ipcRenderer.invoke('git:reset', payload),
    },
    updates: {
        onStatus: (cb) => {
            const handler = (_e, payload) => cb(payload);
            ipcRenderer.on('update:status', handler);
            return () => ipcRenderer.removeListener('update:status', handler);
        },
        restart: () => ipcRenderer.invoke('update:restart'),
    },
});
