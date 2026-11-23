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
