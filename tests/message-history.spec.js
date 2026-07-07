// @ts-check
const { test, expect } = require('@playwright/test');
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

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test('message history keeps routine records while compact feed shows urgent observed messages', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const anchor = state.labMap.rooms.mainLab.anchor;
    state.incidents = [{
      id: 'incident-message-test',
      key: 'message-test-critical-leak',
      type: 'contamination',
      label: 'Critical test leak',
      severity: 'critical',
      status: 'active',
      sourceKind: 'room',
      sourceId: 'mainLab',
      roomId: 'mainLab',
      cell: { ...anchor },
      summary: 'A test leak is visible.',
      createdAt: 0,
      updatedAt: 0,
    }];
    state.events = [
      {
        time: 5,
        message: 'Visual Survey complete for RG-001.',
        category: 'task',
        severity: 'routine',
        feed: false,
      },
      {
        time: 10,
        message: 'Discovery recorded: poison affinity.',
        category: 'discovery',
        severity: 'routine',
        feed: false,
      },
      {
        time: 15,
        message: 'Critical incident spotted: Critical test leak. Time paused at 1x.',
        category: 'incident',
        severity: 'critical',
        feed: true,
        incidentId: 'incident-message-test',
        roomId: 'mainLab',
        cell: { ...anchor },
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('#messageFeed')).toContainText('Critical test leak');
  await expect(page.locator('#messageFeed')).toHaveAttribute('data-feed-fade', 'true');
  await expect(page.locator('#messageFeed')).not.toContainText('Visual Survey complete');
  await expect(page.locator('#messageFeed')).not.toContainText('Discovery recorded');
  await expect(page.locator('#messageFeed [data-message-feed="true"]')).toHaveCount(1);

  await page.locator('[data-workspace-tab="log"]').click();
  await expect(page.locator('#logTitle')).toContainText('Message History');
  await expect(page.locator('#messageFeedFadeCheckbox')).toBeChecked();
  await page.locator('#messageFeedFadeCheckbox').uncheck();
  await expect(page.locator('#messageFeed')).toHaveAttribute('data-feed-fade', 'false');
  const fadePreference = await page.evaluate(({ prefsKey }) => {
    return JSON.parse(window.localStorage.getItem(prefsKey) || '{}').compactFeedFades;
  }, { prefsKey: preferencesKey });
  expect(fadePreference).toBe(false);
  await expect(page.locator('#eventLog')).toContainText('Critical test leak');
  await expect(page.locator('#eventLog')).toContainText('Visual Survey complete');
  await expect(page.locator('#eventLog')).toContainText('Discovery recorded');

  await page.locator('#messageFilterSelect').selectOption('discovery');
  await expect(page.locator('#eventLog')).toContainText('Discovery recorded');
  await expect(page.locator('#eventLog')).not.toContainText('Critical test leak');

  await page.locator('#messageFilterSelect').selectOption('incident');
  await page.locator('#eventLog').getByRole('button', { name: 'Focus Incident' }).click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'incident');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Critical test leak');
});
