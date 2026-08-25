// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const manifestKey = 'helix-heresy-v2-library';
const preferencesKey = 'helix-heresy-v1-preferences';

async function openFreshTitle(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function beginRun(page, options = {}) {
  await page.locator('#titleNewRunBtn').click();
  if (options.worldSeed) await page.locator('#setupWorldSeedInput').fill(options.worldSeed);
  if (options.theme) await page.locator(`input[name="setupWorldTheme"][value="${options.theme}"]`).check();
  if (options.runSeed) await page.locator('#seedInput').fill(options.runSeed);
  await page.locator('#startRunSubmitBtn').click();
}

test('@smoke fresh startup generates an explicitly themed world before entering its first run', async ({ page }) => {
  await openFreshTitle(page);

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreenHeading')).toHaveText('Helix Heresy');
  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('No active run');
  await expect(page.locator('#setupForm')).toBeHidden();
  await expect(page.locator('#appShell')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();

  await page.locator('#titleNewRunBtn').click();
  await expect(page.locator('#setupForm')).toBeVisible();
  await expect(page.locator('#newWorldSetupFieldset')).toContainText('Choose Your Heresy');
  await expect(page.locator('[data-starting-scenario="chemistryFront"]')).toBeVisible();
  await expect(page.locator('#setupBackBtn')).toBeFocused();
  await page.locator('#setupWorldSeedInput').fill('world-seed-one');
  await page.locator('input[name="setupWorldTheme"][value="grim"]').check();
  await page.locator('#seedInput').fill('run-seed-one');
  await page.locator('#startRunSubmitBtn').click();

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(snapshot.world).toMatchObject({
    worldSeed: 'world-seed-one',
    worldTheme: 'grim',
    generationVersion: 1,
    nameGeneratorVersion: 1,
  });
  expect(snapshot.world.name).toBe(await page.evaluate(() => window.helixHeresyDebug.generatedWorldName('world-seed-one')));
  expect(snapshot.run).toMatchObject({
    worldId: snapshot.world.id,
    runSeed: 'run-seed-one',
    status: 'active',
    site: { selectionStatus: 'deferredWorldPlacement' },
    worldState: { changes: {} },
  });
  expect(snapshot.run.id).not.toBe(snapshot.world.id);
});

test('@smoke Continue shows world and run metadata and Return to Title suspends time', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'navigation-world', runSeed: 'navigation-run' });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(90));
  await page.locator('#timeSpeedSelect').selectOption('very-fast');
  await page.locator('#pauseBtn').click();
  await page.waitForTimeout(300);
  await page.locator('#newRunBtn').click();

  const before = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return { clock: current.run.state.clock, paused: current.run.state.paused, timeSpeed: current.run.state.timeSpeed, worldName: current.world.name };
  });
  await expect(page.locator('#loadLastSaveBtn')).toBeEnabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText(before.worldName);
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Chemistry Front');
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Day 1');
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return { clock: current.run.state.clock, paused: current.run.state.paused, timeSpeed: current.run.state.timeSpeed };
  });
  expect(after).toEqual({ clock: before.clock, paused: before.paused, timeSpeed: before.timeSpeed });

  await page.locator('#loadLastSaveBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#timeSpeedSelect')).toHaveValue(before.timeSpeed);
  await expect(page.locator('#pauseReadout')).toContainText(before.paused ? 'Paused' : 'Running');
});

test('malformed library data disables Continue without deleting it', async ({ page }) => {
  await openFreshTitle(page);
  const corrupt = '{ definitely-not-json';
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: manifestKey, value: corrupt });
  await page.reload();

  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('unreadable');
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupBackBtn').click();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), manifestKey)).toBe(corrupt);
});

test('two runs in one world retain independent seeds and saves', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'shared-world-seed', runSeed: 'first-run-seed' });
  await page.locator('#newRunBtn').click();
  await page.locator('#titleWorldLibraryBtn').click();
  const worldName = await page.locator('.world-card h3').textContent();
  await page.locator('[data-library-action="start-run"]').click();
  await expect(page.locator('#newWorldSetupFieldset')).toBeHidden();
  await expect(page.locator('#selectedWorldSummary')).toContainText(worldName || '');
  await page.locator('#seedInput').fill('second-run-seed');
  await page.locator('#startRunSubmitBtn').click();

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(snapshot.worlds).toHaveLength(1);
  expect(snapshot.runs).toHaveLength(2);
  expect(snapshot.runs.map((run) => run.runSeed).sort()).toEqual(['first-run-seed', 'second-run-seed']);
  expect(snapshot.runs.every((run) => run.worldId === snapshot.worlds[0].id)).toBe(true);

  await page.locator('#newRunBtn').click();
  await page.locator('#titleWorldLibraryBtn').click();
  const firstRun = page.locator('.run-library-entry', { hasText: 'first-run-seed' });
  await firstRun.locator('[data-library-action="resume-run"]').click();
  snapshot = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(snapshot.run.runSeed).toBe('first-run-seed');
  expect(snapshot.run.state.seed).toBe('first-run-seed');
});

test('validated bundle import reuses an identical world and remaps a colliding run ID', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'portable-world', runSeed: 'portable-run' });
  const bundle = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return JSON.stringify({ format: 'helix-heresy-run-bundle', version: 2, exportedAt: new Date().toISOString(), ...current });
  });
  await page.locator('#newRunBtn').click();

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#titleImportStatus')).toContainText('was not changed');
  expect((await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot())).runs).toHaveLength(1);

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'portable.json',
    mimeType: 'application/json',
    buffer: Buffer.from(bundle),
  });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  const library = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(library.worlds).toHaveLength(1);
  expect(library.runs).toHaveLength(2);
  expect(new Set(library.runs.map((run) => run.id)).size).toBe(2);
  expect(library.runs.every((run) => run.worldId === library.worlds[0].id)).toBe(true);

  const conflictingBundle = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    const world = window.HelixWorldRunLibrary.createWorld({
      id: current.world.id,
      worldSeed: 'different-canonical-seed',
      worldTheme: 'grim',
      createdAt: current.world.createdAt,
    });
    const state = JSON.parse(JSON.stringify(current.run.state));
    state.seed = 'different-imported-run';
    state.runEnded = false;
    state.runIdentity = { runId: current.run.id, runSeed: state.seed };
    state.worldReference = { worldId: world.id, generationVersion: world.generationVersion, canonicalDigest: world.canonicalDigest };
    const run = window.HelixWorldRunLibrary.createRun({
      ...current.run,
      worldId: world.id,
      worldGenerationVersion: world.generationVersion,
      canonicalWorldDigest: world.canonicalDigest,
      runSeed: state.seed,
      worldState: { version: 1, canonicalWorldDigest: world.canonicalDigest, changes: {} },
      state,
    });
    return JSON.stringify({ format: 'helix-heresy-run-bundle', version: 2, world, run });
  });
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'colliding-world.json',
    mimeType: 'application/json',
    buffer: Buffer.from(conflictingBundle),
  });
  const remapped = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(remapped.worlds).toHaveLength(2);
  expect(remapped.runs).toHaveLength(3);
  expect(remapped.worlds.map((world) => world.worldSeed).sort()).toEqual(['different-canonical-seed', 'portable-world']);
  expect(new Set(remapped.worlds.map((world) => world.id)).size).toBe(2);
});

test('title Settings persist independently and About describes world-backed saves', async ({ page }) => {
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
  await expect(page.locator('#titleAboutPanel')).toContainText('reusable generated worlds');
  await page.locator('#titleAboutBackBtn').click();
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();
});
