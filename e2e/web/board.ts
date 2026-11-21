/**
 * Helpers for driving the whiteboard in end-to-end tests: open a fresh project's
 * board, convert board coordinates to screen coordinates, read what's saved.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export interface SavedElement {
  id: string;
  type: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  fill?: string;
  color?: string;
  rotation?: number;
  groupId?: string;
  locked?: boolean;
  autoWidth?: boolean;
  from?: string | null;
  to?: string | null;
}

export interface SavedBoard {
  id: string;
  name: string;
  order: number;
  open?: boolean;
  elements: SavedElement[];
  group?: { id: string; name: string; color: string } | null;
}

/** Starts a new project from Home and opens its whiteboard. */
export async function openFreshBoard(page: Page, title = 'E2E Novel') {
  await page.goto('/');
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /^Plan/ }).click();
  await page.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  await expect(canvas(page)).toBeVisible();
  // A new board starts at 100% with the origin at the canvas's top-left corner.
  await expect.poll(() => viewport(page)).toEqual({ x: 0, y: 0, zoom: 1 });
}

/** The visible board's SVG canvas. */
export function canvas(page: Page): Locator {
  return page.locator('svg:has(g.wb-world):visible').first();
}

export async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  const t = (await canvas(page).locator('g.wb-world').getAttribute('transform')) ?? '';
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(t);
  return m ? { x: +m[1], y: +m[2], zoom: +m[3] } : { x: NaN, y: NaN, zoom: NaN };
}

/** Screen position of a board point. */
export async function at(page: Page, x: number, y: number) {
  const box = (await canvas(page).boundingBox())!;
  const vp = await viewport(page);
  return { x: box.x + vp.x + x * vp.zoom, y: box.y + vp.y + y * vp.zoom };
}

export async function click(page: Page, x: number, y: number, modifiers: ('Shift' | 'Control' | 'Alt')[] = []) {
  const p = await at(page, x, y);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

export async function dblclick(page: Page, x: number, y: number) {
  const p = await at(page, x, y);
  await page.mouse.dblclick(p.x, p.y);
}

/** Drags from one board point to another in small steps (like a real hand). */
export async function drag(page: Page, from: [number, number], to: [number, number], opts: { modifiers?: ('Shift' | 'Alt')[]; beforeRelease?: () => Promise<void> } = {}) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  for (const m of opts.modifiers ?? []) await page.keyboard.down(m);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  if (opts.beforeRelease) await opts.beforeRelease();
  await page.mouse.up();
  for (const m of opts.modifiers ?? []) await page.keyboard.up(m);
}

/** Picks a toolbar tool by its keyboard shortcut (the canvas must have focus). */
export async function tool(page: Page, key: string) {
  await canvas(page).locator('..').focus();
  await page.keyboard.press(key);
}

/** Boards as saved in IndexedDB (autosave runs about 0.6 s after a change). */
export async function savedBoards(page: Page): Promise<SavedBoard[]> {
  return page.evaluate(
    () =>
      new Promise<SavedBoard[]>((resolve, reject) => {
        const open = indexedDB.open('inkwell');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('whiteboards').objectStore('whiteboards').getAll();
          req.onsuccess = () => {
            resolve(req.result as SavedBoard[]);
            open.result.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

/** The saved elements of the board whose tab is selected. */
export async function savedElements(page: Page): Promise<SavedElement[]> {
  const name = (await page.locator('[role="tablist"][aria-label="Whiteboards"] [role="tab"][aria-selected="true"]').innerText()).trim();
  const board = (await savedBoards(page)).find((b) => b.name === name);
  return board?.elements ?? [];
}

/** Waits until the saved board satisfies `check` (autosave is debounced). */
export async function expectSaved(page: Page, check: (els: SavedElement[]) => boolean, message?: string) {
  await expect
    .poll(
      async () => {
        try {
          return check(await savedElements(page));
        } catch {
          return false; // e.g. an element isn't saved yet
        }
      },
      { message, timeout: 8000 },
    )
    .toBe(true);
}

/** Toolbar button by its accessible name (only the visible board's toolbar). */
export function toolbarButton(page: Page, name: string): Locator {
  return page.locator('[role="toolbar"][aria-label="Whiteboard tools"]:visible').getByRole('button', { name, exact: true });
}

/** Answers the app's name prompt ("New whiteboard tab", "New tab group"…) and waits for it to close. */
export async function answerPrompt(page: Page, value: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(value);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
}
