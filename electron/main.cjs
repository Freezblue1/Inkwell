/**
 * Inkwell desktop (Electron main process).
 *
 * - Serves the built web app (dist/) over a private, secure `app://inkwell`
 *   origin, so IndexedDB data persists in the user's profile folder.
 * - Saves all pending writing before the window closes.
 * - Spellcheck suggestions on right-click, external links in the browser,
 *   Save dialogs for exports, remembered window size, single instance,
 *   and opening .inkwell backups passed on the command line.
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const updater = require('./updater.cjs');
const folders = require('./folders.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://inkwell';
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

// A separate profile folder (end-to-end tests, or keeping two setups apart). Must come before the single-instance lock.
if (process.env.INKWELL_USER_DATA) app.setPath('userData', process.env.INKWELL_USER_DATA);

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

app.setAppUserModelId('app.inkwell.desktop');
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let rendererReady = false;
let readyToClose = false;
const queuedFiles = [];

// ---------------------------------------------------------------------------
// .inkwell files from the command line / file association
function inkwellArgs(argv) {
  return argv.filter((a) => /\.inkwell$/i.test(a) && fs.existsSync(a));
}

function sendFile(file) {
  try {
    const payload = { name: path.basename(file), text: fs.readFileSync(file, 'utf8') };
    if (rendererReady && win) win.webContents.send('open-file', payload);
    else queuedFiles.push(payload);
  } catch (err) {
    console.error('Could not read', file, err);
  }
}

// ---------------------------------------------------------------------------
// Window state
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
  } catch {
    return { width: 1400, height: 900, maximized: false };
  }
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 380,
    minHeight: 500,
    title: 'Inkwell',
    backgroundColor: '#121318',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadURL(`${ORIGIN}/`);

  // Links to the web open in the default browser; the app never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  // We flush saves ourselves before closing, so ignore the page's "unsaved changes" guard.
  win.webContents.on('will-prevent-unload', (e) => e.preventDefault());

  // Right-click menu with spelling suggestions.
  win.webContents.on('context-menu', (_e, params) => {
    const items = [];
    for (const s of params.dictionarySuggestions.slice(0, 6)) items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
    if (params.misspelledWord) {
      if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false });
      items.push({ label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
      items.push({ type: 'separator' });
    }
    if (params.isEditable) {
      items.push({ role: 'cut', enabled: params.editFlags.canCut }, { role: 'copy', enabled: params.editFlags.canCopy }, { role: 'paste', enabled: params.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll' });
    } else if (params.selectionText) {
      items.push({ role: 'copy' });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Give the app a moment to save everything before the window closes.
  win.on('close', (e) => {
    saveState();
    if (readyToClose || !rendererReady) return;
    e.preventDefault();
    win.webContents.send('app-closing');
    setTimeout(() => {
      readyToClose = true;
      if (win && !win.isDestroyed()) win.close();
    }, 4000);
  });
  win.on('closed', () => {
    win = null;
  });
}

function buildMenu() {
  const template = [
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit Inkwell' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }],
    },
    {
      label: 'Help',
      submenu: [
        { label: `Inkwell ${app.getVersion()}`, enabled: false },
        { label: 'Check for updates…', click: () => void updater.check(true) },
        { label: 'Open data folder', click: () => void shell.openPath(app.getPath('userData')) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  while (queuedFiles.length && win) win.webContents.send('open-file', queuedFiles.shift());
});
ipcMain.on('ready-to-close', () => {
  readyToClose = true;
  if (win && !win.isDestroyed()) win.close();
});

app.on('second-instance', (_e, argv) => {
  inkwellArgs(argv).forEach(sendFile);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  // Serve dist/ with an SPA fallback to index.html.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  createWindow();
  updater.init(() => win);
  folders.init();
  inkwellArgs(process.argv).forEach(sendFile);
});

app.on('window-all-closed', () => app.quit());
