/**
 * Preload bridge: exposes a tiny, safe API to the web app as
 * `window.inkwellDesktop` (no Node access in the page).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inkwellDesktop', {
  isDesktop: true,
  platform: process.platform,
  /** Called with { name, text } when a .inkwell file is opened with the app. */
  onOpenFile(callback) {
    ipcRenderer.on('open-file', (_event, file) => callback(file));
  },
  /** Called before the window closes; the app saves, then the window closes. */
  onAppClosing(callback) {
    ipcRenderer.on('app-closing', async () => {
      try {
        await callback();
      } finally {
        ipcRenderer.send('ready-to-close');
      }
    });
  },
  ready() {
    ipcRenderer.send('renderer-ready');
  },
});
