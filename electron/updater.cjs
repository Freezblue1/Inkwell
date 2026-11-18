/**
 * Self-updater for the portable Inkwell.exe.
 *
 * Checks the latest GitHub release of Freezblue1/Inkwell, downloads its
 * Inkwell.exe next to the running one, and swaps it in after Inkwell closes
 * (a tiny script waits for the exe to be unlocked, replaces it and, if asked,
 * starts the new version). Only active in the packaged portable build.
 */
const { app, ipcMain, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const REPO = 'Freezblue1/Inkwell';
const ASSET = 'Inkwell.exe';
const FIRST_CHECK_MS = 15 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const exePath = process.env.PORTABLE_EXECUTABLE_FILE || '';
const supported = app.isPackaged && !!exePath;
const pendingPath = exePath ? `${exePath}.update` : '';
const prefsFile = () => path.join(app.getPath('userData'), 'update-prefs.json');

/** @type {{ status: 'idle'|'checking'|'up-to-date'|'downloading'|'ready'|'error', latest?: string, notes?: string, progress?: number, error?: string, manual?: boolean, checkedAt?: number }} */
let state = { status: 'idle' };
let getWindow = () => null;
let relaunchAfterQuit = false;
let timer = null;

function loadPrefs() {
  try {
    return { auto: true, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) };
  } catch {
    return { auto: true };
  }
}
function savePrefs(p) {
  try {
    fs.writeFileSync(prefsFile(), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function setState(patch) {
  state = { ...state, ...patch };
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update-status', info());
}

function info() {
  return { ...state, current: app.getVersion(), supported, auto: loadPrefs().auto };
}

/** 1.2.10 > 1.2.9; ignores a leading "v" and any "-beta" suffix. */
function newer(a, b) {
  const pa = a.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = b.replace(/^v/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function check(manual = false) {
  if (!supported || state.status === 'checking' || state.status === 'downloading') return info();
  if (state.status === 'ready') {
    setState({ manual });
    return info();
  }
  setState({ status: 'checking', manual, error: undefined });
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Inkwell-updater' },
    });
    if (res.status === 404) {
      setState({ status: 'up-to-date', checkedAt: Date.now() });
      return info();
    }
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const rel = await res.json();
    const latest = String(rel.tag_name || '').replace(/^v/, '');
    const asset = (rel.assets || []).find((a) => a.name === ASSET);
    if (!latest || !asset || !newer(latest, app.getVersion())) {
      setState({ status: 'up-to-date', latest: latest || undefined, checkedAt: Date.now() });
      return info();
    }
    await download(asset, latest, String(rel.body || ''));
  } catch (err) {
    setState({ status: 'error', error: err instanceof Error ? err.message : String(err), checkedAt: Date.now() });
  }
  return info();
}

async function download(asset, latest, notes) {
  setState({ status: 'downloading', latest, notes, progress: 0 });
  const part = `${pendingPath}.part`;
  const res = await net.fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Inkwell-updater' } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  let got = 0;
  let lastSent = 0;
  const hash = crypto.createHash('sha256');
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    got += chunk.length;
    hash.update(chunk);
    if (total && Date.now() - lastSent > 250) {
      lastSent = Date.now();
      setState({ progress: got / total });
    }
  });
  try {
    await pipeline(body, fs.createWriteStream(part));
  } catch (err) {
    fs.rmSync(part, { force: true });
    throw new Error(err && err.code === 'EPERM' ? `Can't write next to ${path.basename(exePath)}. Move Inkwell.exe to a folder you can write to.` : err.message);
  }
  if (asset.size && got !== asset.size) {
    fs.rmSync(part, { force: true });
    throw new Error('The download was incomplete. Inkwell will try again later.');
  }
  const digest = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:') ? asset.digest.slice(7) : null;
  if (digest && digest.toLowerCase() !== hash.digest('hex')) {
    fs.rmSync(part, { force: true });
    throw new Error('The download was damaged (checksum mismatch). Inkwell will try again later.');
  }
  fs.renameSync(part, pendingPath);
  setState({ status: 'ready', progress: 1 });
}

/** Writes and starts a script that swaps in the new exe once this one is closed. */
function applyUpdate(relaunch) {
  if (state.status !== 'ready' || !fs.existsSync(pendingPath)) return;
  const script = path.join(os.tmpdir(), `inkwell-update-${Date.now()}.cmd`);
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'set tries=0',
    ':loop',
    'ping -n 2 127.0.0.1 >nul',
    `move /y "${pendingPath}" "${exePath}" >nul 2>&1`,
    'if not errorlevel 1 goto done',
    'set /a tries+=1',
    'if %tries% lss 120 goto loop',
    'goto end',
    ':done',
    relaunch ? `start "" "${exePath}"` : 'rem no relaunch',
    ':end',
    '(goto) 2>nul & del "%~f0"',
  ];
  fs.writeFileSync(script, lines.join('\r\n'), 'utf8');
  spawn('cmd.exe', ['/d', '/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

function schedule() {
  if (timer) clearInterval(timer);
  timer = null;
  if (!supported || !loadPrefs().auto) return;
  setTimeout(() => void check(false), FIRST_CHECK_MS);
  timer = setInterval(() => void check(false), CHECK_EVERY_MS);
}

function init(windowGetter) {
  getWindow = windowGetter;
  // A leftover download from a session that never swapped it in.
  if (supported) for (const f of [pendingPath, `${pendingPath}.part`]) fs.rmSync(f, { force: true });

  ipcMain.handle('update-info', () => info());
  ipcMain.handle('update-check', () => check(true));
  ipcMain.handle('update-set-auto', (_e, auto) => {
    savePrefs({ ...loadPrefs(), auto: !!auto });
    schedule();
    return info();
  });
  ipcMain.on('update-restart', () => {
    if (state.status !== 'ready') return;
    relaunchAfterQuit = true;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.close(); // saves first, then quits
    else app.quit();
  });
  // Downloaded but not restarted: install when Inkwell closes, ready for next time.
  app.on('will-quit', () => applyUpdate(relaunchAfterQuit));
  schedule();
}

module.exports = { init, check, newer };
