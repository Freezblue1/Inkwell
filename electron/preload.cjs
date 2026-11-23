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
  /** Opens the folder holding the app's data (Settings → App). */
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  /** Project folder sync: plain files in a folder the user picked (see electron/folders.cjs). */
  folders: {
    pick: (current) => ipcRenderer.invoke('folder-pick', current),
    exists: (dir) => ipcRenderer.invoke('folder-exists', dir),
    list: (dir) => ipcRenderer.invoke('folder-list', dir),
    read: (dir, name) => ipcRenderer.invoke('folder-read', dir, name),
    write: (dir, name, text) => ipcRenderer.invoke('folder-write', dir, name, text),
    remove: (dir, name) => ipcRenderer.invoke('folder-remove', dir, name),
    moveToDeleted: (dir, name) => ipcRenderer.invoke('folder-move-to-deleted', dir, name),
    readMeta: (dir) => ipcRenderer.invoke('folder-read-meta', dir),
    writeMeta: (dir, text) => ipcRenderer.invoke('folder-write-meta', dir, text),
    open: (dir) => ipcRenderer.invoke('folder-open', dir),
  },
  /** Self-updates of the portable exe (see electron/updater.cjs). */
  updates: {
    info: () => ipcRenderer.invoke('update-info'),
    check: () => ipcRenderer.invoke('update-check'),
    setAuto: (auto) => ipcRenderer.invoke('update-set-auto', auto),
    restart: () => ipcRenderer.send('update-restart'),
    onStatus(callback) {
      ipcRenderer.on('update-status', (_event, info) => callback(info));
    },
  },
});
