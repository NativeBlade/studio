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
    image: {
        providers: () => ipcRenderer.invoke('image:providers'),
        get: () => ipcRenderer.invoke('image:get'),
        set: (cfg) => ipcRenderer.invoke('image:set', cfg),
        test: (payload) => ipcRenderer.invoke('image:test', payload),
        generate: (payload) => ipcRenderer.invoke('image:generate', payload),
    },
    shell: {
        open: (url) => ipcRenderer.invoke('shell:open', url),
        reveal: (path) => ipcRenderer.invoke('shell:reveal', path),
    },
    locale: () => ipcRenderer.invoke('app:locale'),
    version: () => ipcRenderer.invoke('app:version'),
    apps: {
        ensureDir: (slug) => ipcRenderer.invoke('apps:ensure-dir', slug),
        delete: (payload) => ipcRenderer.invoke('apps:delete', payload),
        attachLogo: (payload) => ipcRenderer.invoke('apps:attach-logo', payload),
        logo: (payload) => ipcRenderer.invoke('apps:logo', payload),
    },
    framework: {
        update: (payload) => ipcRenderer.invoke('framework:update', payload),
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
    publish: {
        status: () => ipcRenderer.invoke('publish:status'),
        login: () => ipcRenderer.invoke('publish:login'),
        logout: () => ipcRenderer.invoke('publish:logout'),
        apps: () => ipcRenderer.invoke('publish:apps'),
        version: (cwd) => ipcRenderer.invoke('publish:version', cwd),
        upload: (payload) => ipcRenderer.invoke('publish:upload', payload),
        onEvent: (cb) => {
            const handler = (_e, payload) => cb(payload);
            ipcRenderer.on('publish:event', handler);
            return () => ipcRenderer.removeListener('publish:event', handler);
        },
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
