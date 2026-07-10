import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Keep node dependencies (archiver, electron-updater, …) external so CJS
    // packages are required from node_modules at runtime instead of bundled.
    main: { plugins: [externalizeDepsPlugin()] },
    preload: { plugins: [externalizeDepsPlugin()] },
    renderer: {
        plugins: [react()],
    },
});
