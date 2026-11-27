/**
 * Whiteboard end-to-end tests: real mouse, keyboard and touch input in a real
 * browser, checking what's drawn and what's saved.
 */
import { expect, test } from '@playwright/test';
import { answerPrompt, canvas, click, dblclick, drag, expectSaved, openFreshBoard, savedBoards, savedElements, tool, toolbarButton, viewport, type SavedElement } from './board';

const rects = (els: SavedElement[]) => els.filter((e) => e.type === 'rect');
const byColorOrder = (els: SavedElement[]) => rects(els).sort((a, b) => a.x! - b.x!);

/** Draws a rectangle with the R tool and returns to the select tool. */
async function drawRect(page: import('@playwright/test').Page, x: number, y: number, w: number, h: number) {
  await tool(page, 'r');
  await drag(page, [x, y], [x + w, y + h]);
  await tool(page, 'v');
}

test.beforeEach(async ({ page }) => {
  await openFreshBoard(page);
});

test('double-click makes a yellow sticky note and typing saves its text', async ({ page }) => {
  await dblclick(page, 300, 250);
  const box = page.getByRole('textbox', { name: 'Sticky note text' });
  await expect(box).toBeFocused();
  await box.fill('Mara finds the teapot');
  await page.keyboard.press('Escape');
  await expectSaved(page, (els) => els.some((e) => e.type === 'note' && e.text === 'Mara finds the teapot'));
  // The paper is drawn in a solid sticky-note colour, not just an outline.
  await expect(canvas(page).locator('g.wb-world path[fill="#ffe45c"]')).toHaveCount(1);
  await expect(canvas(page).getByText('Mara finds the teapot')).toBeVisible();
});

test('notes keep their paper when several board tabs are open', async ({ page }) => {
  await dblclick(page, 300, 250);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New whiteboard tab' }).click();
  await answerPrompt(page, 'Second board');
  await expect(page.getByRole('tab', { name: /Second board/ })).toHaveAttribute('aria-selected', 'true');
  await dblclick(page, 300, 250);
  await page.keyboard.press('Escape');
  // Every board defines its own shadow/sheen; shared ids made notes invisible on some tabs.
  const ids = await page.locator('[id$="-note-shadow"]').evaluateAll((els) => els.map((e) => e.id));
  expect(ids.length).toBe(2);
  expect(new Set(ids).size).toBe(2);
  await expect(canvas(page).locator('g.wb-world path[fill="#ffe45c"]')).toHaveCount(1);
});

test('shapes can have no fill, a see-through fill or a solid fill', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await click(page, 101, 150); // on the border
  await toolbarButton(page, 'Solid fill').click();
  await expectSaved(page, (els) => rects(els)[0]?.fill === 'ink');
  await toolbarButton(page, 'See-through fill').click();
  await expectSaved(page, (els) => /^#[0-9a-f]{8}$/i.test(rects(els)[0]?.fill ?? ''));
  await toolbarButton(page, 'No fill').click();
  await expectSaved(page, (els) => rects(els)[0]?.fill === 'none');
});

test('arrows attach only at an edge, and follow the shape they attach to', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await drawRect(page, 400, 100, 160, 100);
  await tool(page, 'a');
  await drag(page, [258, 130], [480, 140]); // ends inside the second box: stays free
  await tool(page, 'a');
  await drag(page, [258, 180], [401, 180]); // ends on its left edge: attaches
  await tool(page, 'v');
  await expectSaved(page, (els) => els.filter((e) => e.type === 'arrow').length === 2);
  const [a, b] = byColorOrder(await savedElements(page));
  const arrows = (await savedElements(page)).filter((e) => e.type === 'arrow');
  const free = arrows.find((x) => !x.to)!;
  const linked = arrows.find((x) => x.to)!;
  expect(free.from).toBe(a.id);
  expect(linked.from).toBe(a.id);
  expect(linked.to).toBe(b.id);
  // Move the second box down: the attached arrow's end follows it.
  await drag(page, [540, 190], [540, 390]);
  await expectSaved(page, (els) => (els.find((e) => e.id === linked.id)?.y2 ?? 0) > 250, 'attached arrow end moved with the box');
  // Both ends sit on one of the fixed points: a side middle or a corner.
  const els = await savedElements(page);
  const line = els.find((e) => e.id === linked.id)!;
  const onAnchor = (r: SavedElement, x: number, y: number) =>
    [-1, 0, 1].some((sx) =>
      [-1, 0, 1].some((sy) => {
        if (!sx && !sy) return false;
        const g = 6 / Math.hypot(sx, sy);
        const ax = r.x! + r.w! / 2 + (sx * r.w!) / 2 + sx * g;
        const ay = r.y! + r.h! / 2 + (sy * r.h!) / 2 + sy * g;
        return Math.abs(ax - x) < 0.01 && Math.abs(ay - y) < 0.01;
      }),
    );
  expect(onAnchor(els.find((e) => e.id === a.id)!, line.x1!, line.y1!)).toBe(true);
  expect(onAnchor(els.find((e) => e.id === b.id)!, line.x2!, line.y2!)).toBe(true);
  await page.screenshot({ path: 'test-results/arrow-anchors.png' });
});

test('rotates with the round handle (snapping) and with the ] key', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await click(page, 101, 150);
  // The handle sits 28 px above the top centre; drag it 45° clockwise around the centre (180, 150).
  await drag(page, [180, 72], [180 + 100 * Math.cos(-Math.PI / 4), 150 + 100 * Math.sin(-Math.PI / 4)], {
    beforeRelease: async () => expect(canvas(page).getByText('45°')).toBeVisible(),
  });
  await expectSaved(page, (els) => rects(els)[0]?.rotation === 45);
  await page.keyboard.press(']');
  await expectSaved(page, (els) => rects(els)[0]?.rotation === 60);
  await page.keyboard.press('Shift+{');
  await expectSaved(page, (els) => rects(els)[0]?.rotation === -30);
});

test('grouped items are selected and moved together; Ctrl-click picks one; ungroup', async ({ page }) => {
  await drawRect(page, 100, 100, 120, 80);
  await drawRect(page, 300, 100, 120, 80);
  await click(page, 101, 140);
  await click(page, 301, 140, ['Shift']);
  await page.keyboard.press('Control+g');
  await expectSaved(page, (els) => rects(els).length === 2 && rects(els).every((e) => e.groupId && e.groupId === rects(els)[0].groupId));
  await click(page, 700, 600); // deselect
  await drag(page, [101, 140], [151, 190]); // grab one member: the whole group moves
  await expectSaved(page, (els) => byColorOrder(els)[0].x === 150 && byColorOrder(els)[1].x === 350);
  await click(page, 700, 600);
  await click(page, 351, 200, ['Control']); // just the second box
  await drag(page, [351, 200], [351, 300]);
  await expectSaved(page, (els) => byColorOrder(els)[1].y === 250 && byColorOrder(els)[0].y === 150);
  await click(page, 151, 190);
  await page.keyboard.press('Control+Shift+G');
  await expectSaved(page, (els) => rects(els).every((e) => !e.groupId));
});

test('locked items cannot be moved or deleted until unlocked', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await click(page, 101, 150);
  await page.keyboard.press('Control+Shift+L');
  await expectSaved(page, (els) => rects(els)[0]?.locked === true);
  await expect(toolbarButton(page, 'Unlock')).toBeVisible();
  await drag(page, [101, 150], [301, 350]);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(800);
  let r = rects(await savedElements(page))[0];
  expect([r.x, r.y]).toEqual([100, 100]);
  await toolbarButton(page, 'Unlock').click();
  await drag(page, [101, 150], [201, 150]);
  await expectSaved(page, (els) => rects(els)[0]?.x === 200);
  r = rects(await savedElements(page))[0];
  expect(r.locked).toBeFalsy();
});

test('alignment guides line things up, and snap to grid places them on the grid', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await drawRect(page, 400, 300, 160, 100);
  // Drag the second box until its top is 3 px below the first box's top.
  await drag(page, [401, 350], [401, 153], {
    beforeRelease: async () => expect(canvas(page).locator(`line[stroke="#ff4081"]`)).not.toHaveCount(0),
  });
  await expectSaved(page, (els) => byColorOrder(els)[1].y === 100, 'snapped into line with the first box');
  await expect(canvas(page).locator('line[stroke="#ff4081"]')).toHaveCount(0); // guides go away on release
  await tool(page, 'g'); // snap to grid on (24 px dots)
  await expect(toolbarButton(page, 'Snap to grid')).toHaveAttribute('aria-pressed', 'true');
  await drag(page, [401, 150], [438, 211]);
  await expectSaved(page, (els) => {
    const b = byColorOrder(els)[1];
    return b.x! % 24 === 0 && b.y! % 24 === 0;
  }, 'moved onto the grid');
});

test('text boxes fit their text', async ({ page }) => {
  await tool(page, 't');
  await click(page, 100, 300);
  await page.getByRole('textbox', { name: 'Text' }).fill('Hi');
  await page.keyboard.press('Escape');
  await tool(page, 't');
  await click(page, 100, 400);
  await page.getByRole('textbox', { name: 'Text' }).fill('A much longer heading for the plot');
  await page.keyboard.press('Escape');
  const texts = canvas(page).locator('g.wb-world text');
  await expect(texts).toHaveCount(2);
  const short = (await texts.nth(0).boundingBox())!;
  const long = (await texts.nth(1).boundingBox())!;
  expect(long.width).toBeGreaterThan(short.width * 5);
  // One line each: nothing wrapped at a fixed width.
  await expect(texts.nth(1).locator('tspan')).toHaveCount(1);
});

test('undo and redo', async ({ page }) => {
  await drawRect(page, 100, 100, 160, 100);
  await expectSaved(page, (els) => rects(els).length === 1);
  await page.keyboard.press('Control+z');
  await expectSaved(page, (els) => rects(els).length === 0);
  await page.keyboard.press('Control+Shift+Z');
  await expectSaved(page, (els) => rects(els).length === 1);
});

test('the board is still there after reloading the app', async ({ page }) => {
  await dblclick(page, 300, 250);
  await page.getByRole('textbox', { name: 'Sticky note text' }).fill('Still here');
  await page.keyboard.press('Escape');
  await expectSaved(page, (els) => els.some((e) => e.text === 'Still here'));
  await page.reload();
  await page.getByRole('button', { name: /Continue writing/ }).click();
  await page.getByRole('button', { name: /^Plan/ }).click();
  await page.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  await expect(canvas(page).getByText('Still here')).toBeVisible();
});

test('board tabs can be grouped, collapsed and dragged into a new order', async ({ page }) => {
  for (const name of ['Second', 'Third']) {
    await page.getByRole('button', { name: 'New whiteboard tab' }).click();
    await answerPrompt(page, name);
  }
  const strip = page.locator('[role="tablist"][aria-label="Whiteboards"]');
  await strip.getByRole('tab', { name: /Third/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add to new group…' }).click();
  await answerPrompt(page, 'Act 1');
  const chip = strip.getByRole('button', { name: /Tab group Act 1/ });
  await expect(chip).toBeVisible();
  // The menu is fully gone, so the next click reaches the tabs (a leftover invisible overlay used to eat it).
  await expect(page.locator('.MuiPopover-root')).toHaveCount(0);
  await expect.poll(async () => (await savedBoards(page)).find((b) => b.name === 'Third')?.group?.name).toBe('Act 1');

  // Drag "Brainstorm" onto "Second": they swap places.
  const from = (await strip.getByRole('tab', { name: /Brainstorm/ }).boundingBox())!;
  const to = (await strip.getByRole('tab', { name: /Second/ }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Pick it up first (the drag starts after a few pixels), then carry it over.
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 5 });
  await page.waitForTimeout(150); // let the drag measure the other tabs, as a real hand would
  await page.mouse.move(to.x + to.width / 2 + 10, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await savedBoards(page)).filter((b) => b.open !== false).sort((a, b) => a.order - b.order).map((b) => b.name)).toEqual(['Second', 'Brainstorm', 'Third']);

  // Collapsing the group hides its tab.
  await chip.click();
  await expect(strip.getByRole('tab', { name: /Third/ })).toHaveCount(0);
  await chip.click();
  await expect(strip.getByRole('tab', { name: /Third/ })).toBeVisible();
});

test('pinch with two fingers zooms around them, and moving them pans', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses Chromium touch emulation');
  const box = (await canvas(page).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const touch = (type: string, pts: [number, number][]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x: box.x + x, y: box.y + y, id: i })) });
  await touch('touchStart', [
    [500, 300],
    [600, 300],
  ]);
  for (let i = 1; i <= 8; i++)
    await touch('touchMove', [
      [500 - i * 10, 300],
      [600 + i * 10, 300],
    ]);
  // Fingers 100 → 260 px apart: 2.6× zoom, keeping the board point under their midpoint (550, 300) in place.
  await expect.poll(async () => (await viewport(page)).zoom).toBeCloseTo(2.6, 1);
  const zoomed = await viewport(page);
  expect(zoomed.x).toBeCloseTo(550 - 550 * zoomed.zoom, 0);
  for (let i = 1; i <= 5; i++)
    await touch('touchMove', [
      [420, 300 + i * 10],
      [680, 300 + i * 10],
    ]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await viewport(page)).y - zoomed.y).toBeCloseTo(50, 0);
});

test('a selected arrow is outlined along its line, not with a box', async ({ page }) => {
  await tool(page, 'a');
  await drag(page, [100, 100], [400, 300]);
  await tool(page, 'v');
  await click(page, 250, 200); // on the line
  await expect(canvas(page).locator('[data-arrow-halo]')).toHaveCount(1);
  // No dashed selection box (only the line's halo and its two end handles).
  await expect(canvas(page).locator('rect[stroke-dasharray]')).toHaveCount(0);
  // Clicking inside the old corner-to-corner box but off the line selects nothing.
  await click(page, 350, 130);
  await expect(canvas(page).locator('[data-arrow-halo]')).toHaveCount(0);
  // A selection box picks the arrow only where it crosses the line.
  await drag(page, [330, 110], [390, 160]); // off the line
  await expect(canvas(page).locator('[data-arrow-halo]')).toHaveCount(0);
  await drag(page, [230, 170], [270, 230]); // across the line
  await expect(canvas(page).locator('[data-arrow-halo]')).toHaveCount(1);
});

test('copy, paste, cut and duplicate (keyboard and right-click menu)', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await drawRect(page, 100, 100, 120, 80);
  await click(page, 101, 140);
  await page.keyboard.press('Control+c');
  // Paste where the pointer is.
  const target = await (await import('./board')).at(page, 500, 400);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press('Control+v');
  await expectSaved(page, (els) => rects(els).length === 2 && rects(els).some((r) => r.x === 440 && r.y === 360));
  // Duplicate from the right-click menu.
  await click(page, 101, 140);
  const p = await (await import('./board')).at(page, 101, 140);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /Duplicate/ }).click();
  await expectSaved(page, (els) => rects(els).length === 3);
  // Cut removes it, paste brings it back.
  await page.keyboard.press('Control+x');
  await expectSaved(page, (els) => rects(els).length === 2);
  await page.keyboard.press('Control+v');
  await expectSaved(page, (els) => rects(els).length === 3);
  // Right-click on the empty board offers paste and select all.
  const empty = await (await import('./board')).at(page, 900, 600);
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Paste here/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Select all/ })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('links: a Google Maps link shows a live map preview; other sites a link card', async ({ page }) => {
  // Keep the tests offline: the preview frame's address is what matters here.
  await page.route(/google\.com|gstatic|googleapis|wikipedia/, (r) => r.abort());
  await toolbarButton(page, 'Add a link').click();
  await answerPrompt(page, 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z');
  await expectSaved(page, (els) => els.some((e) => e.type === 'link' && (e as unknown as { url: string }).url.includes('Eiffel')));
  const frame = canvas(page).locator('iframe');
  await expect(frame).toHaveAttribute('src', 'https://maps.google.com/maps?q=Eiffel%20Tower&z=17&output=embed');
  await expect(frame).toHaveCSS('pointer-events', 'none'); // the board keeps the mouse…
  await expect(canvas(page).getByText('Double-click to use the preview')).toBeVisible();
  const box = (await frame.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + 40);
  await expect(frame).toHaveCSS('pointer-events', 'auto'); // …until you double-click to use the map
  await canvas(page).locator('..').focus();
  await page.keyboard.press('Escape');
  await expect(frame).toHaveCSS('pointer-events', 'none');
  // A plain site: a card with the address, no frame.
  await toolbarButton(page, 'Add a link').click();
  await answerPrompt(page, 'en.wikipedia.org/wiki/Lighthouse');
  await expect(canvas(page).getByText('https://en.wikipedia.org/wiki/Lighthouse')).toBeVisible();
  await expect(canvas(page).locator('iframe')).toHaveCount(1);
});

test('Story Bible cards keep their colour strip inside the card', async ({ page }) => {
  await page.getByRole('tab', { name: 'Story Bible' }).click();
  await page.getByRole('button', { name: /New character/ }).click();
  await page.getByRole('menuitem', { name: /Blank/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  await page.getByRole('button', { name: /Add Story Bible card/ }).click();
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option').first().click(); // picking an entry adds its card
  const strip = canvas(page).locator('rect[clip-path*="-card-"]');
  await expect(strip).toHaveCount(1);
});
