// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';
const preferencesKey = 'helix-heresy-v1-preferences';

async function openFreshTitle(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function beginRun(page, seed = '') {
  await page.locator('#titleNewRunBtn').click();
  if (seed) await page.locator('#seedInput').fill(seed);
  await page.locator('#startRunSubmitBtn').click();
}

test('@smoke fresh startup opens the keyboard-accessible title shell', async ({ page }) => {
  await openFreshTitle(page);

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreenHeading')).toHaveText('Helix Heresy');
  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('No local continuation save');
  await expect(page.locator('#setupForm')).toBeHidden();
  await expect(page.locator('#appShell')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();

  await page.locator('#titleNewRunBtn').click();
  await expect(page.locator('#setupForm')).toBeVisible();
  await expect(page.locator('[data-starting-scenario="chemistryFront"]')).toBeVisible();
  await expect(page.locator('#setupBackBtn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();
});

test('@smoke Continue shows saved metadata and Return to Title suspends time without changing run pacing', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, 'navigation-seed');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(90));
  await page.locator('#timeSpeedSelect').selectOption('very-fast');
  await page.locator('#pauseBtn').click();
  await page.waitForTimeout(300);
  await page.locator('#newRunBtn').click();

  const before = await page.evaluate((key) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    return { clock: state.clock, paused: state.paused, timeSpeed: state.timeSpeed };
  }, storageKey);
  await expect(page.locator('#loadLastSaveBtn')).toBeEnabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Chemistry Front');
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Day 1');
  await page.waitForTimeout(650);
  const after = await page.evaluate((key) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    return { clock: state.clock, paused: state.paused, timeSpeed: state.timeSpeed };
  }, storageKey);
  expect(after).toEqual(before);

  await page.locator('#loadLastSaveBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#timeSpeedSelect')).toHaveValue(before.timeSpeed);
  await expect(page.locator('#pauseReadout')).toContainText(before.paused ? 'Paused' : 'Running');
});

test('malformed local data disables Continue without deleting it', async ({ page }) => {
  await openFreshTitle(page);
  const corrupt = '{ definitely-not-json';
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: storageKey, value: corrupt });
  await page.reload();

  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('unreadable');
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupBackBtn').click();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(corrupt);
});

test('New Run replacement can be canceled before the continuation save changes', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, 'original-seed');
  await page.locator('#newRunBtn').click();
  const original = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);

  await page.locator('#titleNewRunBtn').click();
  await page.locator('#seedInput').fill('replacement-seed');
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#replaceRunDialog')).toBeVisible();
  await page.locator('#cancelReplaceRunBtn').click();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(original);

  await page.locator('#startRunSubmitBtn').click();
  await page.locator('#confirmReplaceRunBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).state.seed, storageKey)).toBe('replacement-seed');
});

test('Import validates before replacement and applies only after confirmation', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, 'current-seed');
  const importedPayload = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key));
    payload.state.seed = 'imported-seed';
    return JSON.stringify(payload);
  }, storageKey);
  await page.locator('#newRunBtn').click();
  const original = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}')
  });
  await expect(page.locator('#titleImportStatus')).toContainText('was not changed');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(original);

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(importedPayload)
  });
  await expect(page.locator('#replaceRunDialog')).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(original);
  await page.locator('#confirmReplaceRunBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).state.seed, storageKey)).toBe('imported-seed');
});

test('title Settings persist independently and About returns focus to the main menu', async ({ page }) => {
  await openFreshTitle(page);
  await page.locator('#titleSettingsBtn').click();
  await page.locator('[data-title-preference="mapRendererMode"]').selectOption('dom');
  await page.locator('[data-title-preference="mapVisualMode"]').selectOption('glyphs');
  await page.locator('[data-title-preference="mapMotion"]').selectOption('reduced');
  await page.locator('[data-title-preference="mapContrast"]').selectOption('high');
  await page.locator('[data-title-preference="compactFeedVisible"]').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-map-contrast', 'high');
  await page.locator('#titleSettingsBackBtn').click();
  await page.reload();
  await page.locator('#titleSettingsBtn').click();
  await expect(page.locator('[data-title-preference="mapRendererMode"]')).toHaveValue('dom');
  await expect(page.locator('[data-title-preference="mapVisualMode"]')).toHaveValue('glyphs');
  await expect(page.locator('[data-title-preference="compactFeedVisible"]')).not.toBeChecked();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).mapRendererMode, preferencesKey)).toBe('dom');

  await page.locator('#titleSettingsBackBtn').click();
  await page.locator('#titleAboutBtn').click();
  await expect(page.locator('#titleAboutPanel')).toContainText('Nathaniel Tovar');
  await page.locator('#titleAboutBackBtn').click();
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();
});
