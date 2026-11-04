// @ts-check
const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { activeRunStorageKey } = require('./helpers/active-run-storage');
const preferencesKey = 'helix-heresy-v1-preferences';
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

async function startRun(page) {
  await startLifecycleRun(page, 'message-history');
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test('message history keeps routine records while compact feed shows urgent observed messages', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.HelixWorldRunLibrary.decompressStorageText(window.localStorage.getItem(key) || '{}'));
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
    window.localStorage.setItem(key, window.HelixWorldRunLibrary.compressStorageText(JSON.stringify({ ...payload, state })));
  }, { key: await activeRunStorageKey(page) });
  await loadSavedRun(page);

  await expect(page.locator('#messageFeed')).toContainText('Critical test leak');
  // Critical text remains fully readable even when ordinary feed fading is on.
  await expect(page.locator('#messageFeed')).toHaveAttribute('data-feed-fade', 'false');
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
  await expect(page.locator('[data-workspace-panel="map"]')).toBeVisible();
  await expect(page.locator('[data-map-assistive-status="true"]')).toContainText('Critical test leak');
  await expect(page.locator('[data-map-cursor="true"]')).toHaveAttribute('data-map-target-kind', 'incident');
  await expect(page.locator('[data-map-cursor="true"]')).toHaveAttribute('data-map-target-id', 'incident-message-test');
});
