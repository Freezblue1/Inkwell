/**
 * File access for folder sync (see src/features/folderSync). The renderer
 * names a folder it was given by the folder picker and plain file names
 * inside it; nothing outside that folder (and its "Deleted projects"
 * subfolder) can be touched.
 */
const { app, dialog, ipcMain, shell, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DELETED_DIR = 'Deleted projects';
const META_FILE = '.inkwell-sync.json';

function safeName(name) {
  if (typeof name !== 'string' || !name || name !== path.basename(name) || name === '.' || name === '..') throw new Error('Bad file name');
  return name;
}
function safeDir(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error('Bad folder');
  return dir;
}
async function info(file) {
  const st = await fs.stat(file);
  return { name: path.basename(file), mtime: Math.round(st.mtimeMs), size: st.size };
}
async function atomicWrite(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await fs.writeFile(tmp, text, 'utf8');
  try {
    await fs.rename(tmp, file);
  } catch (err) {
    // Cloud-sync clients sometimes hold the target briefly; retry once, then copy.
    await new Promise((r) => setTimeout(r, 300));
    try {
      await fs.rename(tmp, file);
    } catch {
      await fs.copyFile(tmp, file);
      await fs.rm(tmp, { force: true });
    }
  }
}

function init() {
  ipcMain.handle('folder-pick', async (e, current) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose a folder for your Inkwell projects',
      buttonLabel: 'Use this folder',
      defaultPath: current || app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    await fs.mkdir(res.filePaths[0], { recursive: true });
    return res.filePaths[0];
  });
  ipcMain.handle('folder-exists', async (_e, dir) => {
    try {
      return (await fs.stat(safeDir(dir))).isDirectory();
    } catch {
      return false;
    }
  });
  ipcMain.handle('folder-list', async (_e, dir) => {
    const entries = await fs.readdir(safeDir(dir), { withFileTypes: true });
    const out = [];
    for (const ent of entries) {
      if (!ent.isFile() || !/\.inkwell$/i.test(ent.name) || ent.name.startsWith('.')) continue;
      try {
        out.push(await info(path.join(dir, ent.name)));
      } catch {
        /* vanished meanwhile */
      }
    }
    return out;
  });
  ipcMain.handle('folder-read', (_e, dir, name) => fs.readFile(path.join(safeDir(dir), safeName(name)), 'utf8'));
  ipcMain.handle('folder-write', async (_e, dir, name, text) => {
    const file = path.join(safeDir(dir), safeName(name));
    await atomicWrite(file, String(text));
    return info(file);
  });
  ipcMain.handle('folder-remove', (_e, dir, name) => fs.rm(path.join(safeDir(dir), safeName(name)), { force: true }));
  ipcMain.handle('folder-move-to-deleted', async (_e, dir, name) => {
    const src = path.join(safeDir(dir), safeName(name));
    const binDir = path.join(dir, DELETED_DIR);
    await fs.mkdir(binDir, { recursive: true });
    let dest = path.join(binDir, name);
    for (let i = 2; await fs.stat(dest).then(() => true, () => false); i++) dest = path.join(binDir, name.replace(/\.inkwell$/i, ` (${i}).inkwell`));
    await fs.rename(src, dest).catch(async () => {
      await fs.copyFile(src, dest);
      await fs.rm(src, { force: true });
    });
  });
  ipcMain.handle('folder-read-meta', async (_e, dir) => {
    try {
      return await fs.readFile(path.join(safeDir(dir), META_FILE), 'utf8');
    } catch {
      return null;
    }
  });
  ipcMain.handle('folder-write-meta', (_e, dir, text) => atomicWrite(path.join(safeDir(dir), META_FILE), String(text)));
  ipcMain.handle('folder-open', (_e, dir) => shell.openPath(safeDir(dir)));
}

module.exports = { init };
