// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';
const preferencesKey = 'helix-heresy-v1-preferences';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function selectMapOverlay(page, overlayId) {
  await page.locator('[data-overlay-menu-toggle="true"]').click();
  await expect(page.locator('[data-overlay-menu="true"]')).toBeVisible();
  await page.locator('[data-map-overlay-select="true"]').selectOption(overlayId);
  await expect(page.locator('[data-overlay-menu="true"]')).toHaveCount(0);
}

test('importing a save resets transient UI to the map defaults', async ({ page }, testInfo) => {
  await startRun(page);

  const importPayload = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.ui = {
      mode: 'command',
      activeWorkspaceTab: 'log',
      mapCursor: { x: 1, y: 1 },
      mapOverlay: 'resources',
      resourceOverlayFocus: 'category:tools',
      messageFilter: 'combat',
      selectionInspectorTab: 'history',
      debugEnabled: false,
      keyboardHelpOpen: true,
    };
    state.selection = { kind: 'room', roomId: 'storageRoom', source: 'fixture' };
    state.selectedMapTarget = { kind: 'room', roomId: 'storageRoom', source: 'fixture' };
    state.selectedSlimeId = 'ghost-selection';
    return { version: 1, savedAt: new Date().toISOString(), state };
  }, { key: storageKey });
  const importPath = testInfo.outputPath('ui-state-import-save.json');
  fs.writeFileSync(importPath, JSON.stringify(importPayload, null, 2));

  await page.locator('#importFileInput').setInputFiles(importPath);

  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-overlay-menu-toggle="true"]')).toContainText('None');

  await page.locator('[data-workspace-tab="log"]').click();
  await expect(page.locator('#messageFilterSelect')).toHaveValue('all');

  const savedUi = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      ui: state.ui,
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      selectedSlimeId: state.selectedSlimeId,
      hasDebugFlag: Object.prototype.hasOwnProperty.call(state.ui || {}, 'debugEnabled'),
    };
  }, { key: storageKey });

  expect(savedUi).toMatchObject({
    ui: {
      mode: 'navigation',
      activeWorkspaceTab: 'map',
      mapOverlay: 'none',
      resourceOverlayFocus: 'resource:biomass',
      messageFilter: 'all',
      selectionInspectorTab: 'summary',
      keyboardHelpOpen: false,
    },
    selection: null,
    selectedMapTarget: null,
    selectedSlimeId: null,
    hasDebugFlag: false,
  });
});

test('reset UI preferences restores defaults and current map view', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ prefsKey }) => {
    window.localStorage.setItem(prefsKey, JSON.stringify({
      version: 1,
      compactFeedVisible: false,
      compactFeedFades: false,
      compactMessageLimit: 1,
    }));
  }, { prefsKey: preferencesKey });

  await selectMapOverlay(page, 'resources');
  await page.locator('[data-workspace-tab="log"]').click();
  await page.locator('#messageFilterSelect').selectOption('combat');
  await page.locator('#debugToggleBtn').click();
  await expect(page.locator('#debugToggleBtn')).toHaveText('Debug Off');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#resetUiPreferencesBtn').click();

  await expect(page.locator('#debugToggleBtn')).toHaveText('Debug On');
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-overlay-menu-toggle="true"]')).toContainText('None');

  const resetState = await page.evaluate(({ key, prefsKey }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      prefs: JSON.parse(window.localStorage.getItem(prefsKey) || '{}'),
      ui: state.ui,
      selection: state.selection,
    };
  }, { key: storageKey, prefsKey: preferencesKey });

  expect(resetState).toMatchObject({
    prefs: {
      version: 1,
      compactFeedVisible: true,
      compactFeedFades: true,
      compactMessageLimit: 8,
    },
    ui: {
      mode: 'navigation',
      activeWorkspaceTab: 'map',
      mapOverlay: 'none',
      resourceOverlayFocus: 'resource:biomass',
      messageFilter: 'all',
      selectionInspectorTab: 'summary',
      keyboardHelpOpen: false,
    },
    selection: null,
  });
});
