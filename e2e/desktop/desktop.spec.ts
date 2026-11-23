/**
 * Desktop app end-to-end tests: launches Electron from this checkout (main
 * process, preload bridge, IPC and file access) with a throwaway profile, and
 * drives it like a user. Uses the build in dist/ (made by the web server step).
 */
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string;

let profile: string;
let running: ElectronApplication | null = null;

async function launch(args: string[] = []): Promise<{ app: ElectronApplication; win: Page }> {
  const app = await electron.launch({ args: ['.', ...args], cwd: root, env: { ...process.env, INKWELL_USER_DATA: profile } });
  running = app;
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await expect(win.getByText(/Running as the Inkwell desktop app/).first()).toBeVisible({ timeout: 20_000 });
  return { app, win };
}

async function quit(app: ElectronApplication) {
  await app.close();
  running = null;
}

async function createProject(win: Page, title: string) {
  await win.getByLabel('Title').fill(title);
  await win.getByRole('button', { name: 'Create project' }).click();
  await expect(win.getByRole('button', { name: /^Plan/ })).toBeVisible();
}

test.beforeEach(() => {
  profile = mkdtempSync(join(tmpdir(), 'inkwell-e2e-'));
});

test.afterEach(async () => {
  if (running) await running.close().catch(() => {});
  running = null;
  rmSync(profile, { recursive: true, force: true });
});

test('opens on Home as the desktop app, with the desktop bridge', async () => {
  const { app, win } = await launch();
  expect(await win.title()).toBe('Inkwell');
  expect(await win.evaluate(() => (window as unknown as { inkwellDesktop?: { isDesktop: boolean } }).inkwellDesktop?.isDesktop)).toBe(true);
  // Node isn't exposed to the page.
  expect(await win.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
  expect(await app.evaluate(({ app: a }) => a.getPath('userData'))).toBe(profile);
  await quit(app);
});

test('writing typed just before quitting is saved and still there after reopening', async () => {
  let { app, win } = await launch();
  await createProject(win, 'Desk Novel');
  const editor = win.locator('.ProseMirror[contenteditable="true"]').first();
  await editor.click();
  await win.keyboard.press('Control+End');
  await win.keyboard.type(' Last words before quitting.');
  await quit(app); // straight away: the app must save before the window closes

  ({ app, win } = await launch());
  await expect(win.getByText('Desk Novel').first()).toBeVisible();
  await win.getByRole('button', { name: /Continue writing/ }).click();
  await expect(win.locator('.ProseMirror').first()).toContainText('Last words before quitting.');
  await quit(app);
});

test('opens a .inkwell backup passed on the command line', async () => {
  const file = join(profile, 'Imported Tale.inkwell');
  const now = Date.now();
  writeFileSync(
    file,
    JSON.stringify({
      format: 'inkwell-project',
      version: 1,
      exportedAt: now,
      project: { id: 'imported-1', title: 'Imported Tale', subtitle: '', author: 'Tester', kind: 'novel', seriesId: null, seriesOrder: 1, statuses: ['Draft'], labels: [], customFields: [], isDemo: false, createdAt: now, updatedAt: now, lastOpenedAt: now },
      series: null,
      documents: [],
      contents: [],
      bible: [],
      tags: [],
      plotThreads: [],
      comments: [],
      goal: null,
      sessions: [],
      exportProfiles: [],
      snapshots: [],
      assets: [],
      whiteboards: [],
    }),
  );
  const { app, win } = await launch([file]);
  await expect(win.getByText(/Opened “Imported Tale”/)).toBeVisible();
  await quit(app);
});

test('mirrors projects to a chosen folder and picks up changes made there', async () => {
  const folder = join(profile, 'Synced projects');
  const { app, win } = await launch();
  await createProject(win, 'Folder Novel');
  await win.getByRole('button', { name: /^Home/ }).first().click();
  // Same as choosing the folder in Settings (the native folder picker can't be scripted).
  await win.evaluate((dir) => localStorage.setItem('inkwell:folderSync:dir', dir), folder.replace(/\\/g, '/'));
  mkdirSync(folder, { recursive: true });
  await win.reload();
  await expect(win.getByText(/Projects folder: Synced projects/)).toBeVisible({ timeout: 20_000 });

  const path = join(folder, 'Folder Novel.inkwell');
  await expect.poll(() => existsSync(path), { timeout: 15_000 }).toBe(true);
  const bundle = JSON.parse(readFileSync(path, 'utf8'));
  expect(bundle.project.title).toBe('Folder Novel');

  // Another PC renames the project in the file: it appears here within seconds.
  bundle.project.title = 'Folder Novel (laptop)';
  writeFileSync(path, JSON.stringify(bundle));
  await expect(win.getByText('Folder Novel (laptop)').first()).toBeVisible({ timeout: 20_000 });
  expect(readdirSync(folder).filter((f) => f.endsWith('.inkwell')).length).toBe(1);
  await quit(app);
});

test('reports its version, and that self-updates need the packaged exe', async () => {
  const { app, win } = await launch();
  const info = await win.evaluate(() => (window as unknown as { inkwellDesktop: { updates: { info(): Promise<{ current: string; supported: boolean; status: string }> } } }).inkwellDesktop.updates.info());
  expect(info.current).toBe(version);
  expect(info.supported).toBe(false); // only the portable Inkwell.exe updates itself
  expect(info.status).toBe('idle'); // and it doesn't go online when it can't update
  await quit(app);
});

test('the whiteboard works in the desktop app', async () => {
  const { app, win } = await launch();
  await createProject(win, 'Board Novel');
  await win.getByRole('button', { name: /^Plan/ }).click();
  await win.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  const canvas = win.locator('svg:has(g.wb-world):visible').first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await win.mouse.dblclick(box.x + 300, box.y + 250);
  await win.getByRole('textbox', { name: 'Sticky note text' }).fill('Desktop note');
  await win.keyboard.press('Escape');
  await expect(canvas.getByText('Desktop note')).toBeVisible();
  await expect(canvas.locator('g.wb-world path[fill="#ffe45c"]')).toHaveCount(1);
  await quit(app);
});

test('has no menu bar for Alt to flash, and Settings can open the data folder', async () => {
  const { app, win } = await launch();
  const bar = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { visible: w.isMenuBarVisible(), autoHide: w.isMenuBarAutoHide() };
  });
  // An auto-hiding menu bar pops up on every Alt press, which the whiteboard uses for free placement.
  expect(bar).toEqual({ visible: false, autoHide: false });
  await win.getByRole('button', { name: 'Open settings' }).first().click();
  await expect(win.getByRole('button', { name: 'Open data folder' })).toBeVisible();
  await quit(app);
});
