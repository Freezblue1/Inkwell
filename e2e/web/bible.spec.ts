/** Story Bible templates. */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Title').fill('Template Novel');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /^Plan/ }).click();
  await page.getByRole('tab', { name: 'Story Bible' }).click();
});

test('new entries can start from a template for their type', async ({ page }) => {
  await page.getByRole('button', { name: /New character/ }).click();
  await page.getByRole('menuitem', { name: /Antagonist/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Role')).toHaveValue('Antagonist');
  await expect(dialog.getByLabel('Goals & motivation')).toHaveValue(/Why they believe they are right:/);
  await dialog.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('tab', { name: /World & Lore/ }).click();
  await page.getByRole('button', { name: /New lore note/ }).click();
  await expect(page.getByRole('menuitem', { name: /Magic system/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /Magic system/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Category')).toHaveValue('Magic');
});

test('any entry can be saved as your own template', async ({ page }) => {
  await page.getByRole('tab', { name: /Locations/ }).click();
  await page.getByRole('button', { name: /New location/ }).first().click();
  await page.getByRole('menuitem', { name: /Blank/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Type').fill('Lighthouse');
  await dialog.getByRole('button', { name: 'Save as template' }).click();
  const prompt = page.getByRole('dialog').filter({ hasText: 'Save as template' });
  await prompt.getByRole('textbox').fill('Coastal landmark');
  await prompt.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText(/Saved “Coastal landmark”/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /New location/ }).first().click();
  await page.getByRole('menuitem', { name: /Coastal landmark/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Type')).toHaveValue('Lighthouse');
});

test('the name generator gives names that fit the age and varies each batch', async ({ page }) => {
  await page.getByRole('button', { name: /Name generator/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Name generator' });
  const names = dialog.getByRole('list', { name: 'Generated names' }).getByRole('listitem');
  await expect(names).toHaveCount(12);

  await dialog.getByLabel('Age').click();
  await page.getByRole('option', { name: 'Elderly' }).click();
  await dialog.getByLabel('Style').click();
  await page.getByRole('option', { name: /Slavic/ }).click();
  await expect(dialog.getByText('Names that were popular when someone this age was born.')).toBeVisible();
  const first = await names.allInnerTexts();
  expect(first.some((t) => /Russian|Polish|Czech/.test(t))).toBe(true);

  await dialog.getByRole('button', { name: 'More names' }).click();
  const second = await names.allInnerTexts();
  expect(second.filter((t) => first.includes(t)).length).toBe(0);
  await page.screenshot({ path: 'test-results/name-generator.png' });
});

test('entries link to whiteboard tabs and open them', async ({ page }) => {
  // A board that already exists ("Brainstorm" is made on first visit).
  await page.getByRole('tab', { name: 'Whiteboard', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Brainstorm/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Story Bible' }).click();

  await page.getByRole('button', { name: /New character/ }).click();
  await page.getByRole('menuitem', { name: /Blank/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Whiteboards').click();
  await page.getByRole('option', { name: 'Brainstorm' }).click();

  // A new board named after the entry, linked straight away.
  await dialog.getByRole('button', { name: 'New whiteboard tab for this entry' }).click();
  const prompt = page.getByRole('dialog').filter({ hasText: 'New whiteboard tab' });
  await prompt.getByRole('textbox').fill('Kael’s journey');
  await prompt.getByRole('button', { name: 'Create' }).click();
  const editor = page.getByRole('dialog').filter({ hasText: 'Cross-links' });
  await expect(editor.getByRole('button', { name: 'Kael’s journey' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Brainstorm' })).toBeVisible();

  await editor.getByRole('button', { name: 'Kael’s journey' }).click();
  const strip = page.locator('[role="tablist"][aria-label="Whiteboards"]');
  await expect(strip.getByRole('tab', { name: /Kael’s journey/ })).toHaveAttribute('aria-selected', 'true');

  // The links are saved with the entry.
  await page.getByRole('tab', { name: 'Story Bible' }).click();
  await page.getByText('No summary yet.').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Brainstorm' }).click();
  await expect(strip.getByRole('tab', { name: /Brainstorm/ })).toHaveAttribute('aria-selected', 'true');
});
