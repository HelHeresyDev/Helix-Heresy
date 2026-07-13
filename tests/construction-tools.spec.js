// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function openSelectionActions(page) {
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  return page.locator('[data-context-command-panel="true"]');
}

async function runSelectionCommand(page, name) {
  const actions = await openSelectionActions(page);
  await actions.getByRole('button', { name }).click();
}

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function finishTask(page, text) {
  if (!(await page.locator('[data-workspace-panel="tasks"]').isVisible())) {
    await page.locator('#queueToggleBtn').click();
  }
  const row = page.locator('#taskList .task-row').filter({ hasText: text }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Finish' }).click();
}

test('construction tools block inadequate work retain partial progress and support basic repair', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);

  const starterTools = await page.evaluate(() => window.helixHeresyDebug.constructionToolSnapshot());
  expect(starterTools.map((tool) => tool.itemKey).sort()).toEqual([
    'handSaw', 'masonryHammer', 'miningPick', 'pryBar', 'shovel', 'stoneChisel', 'woodAxe',
  ]);
  expect(starterTools.every((tool) => tool.instance.roomId === 'storageRoom')).toBe(true);
  expect(starterTools.find((tool) => tool.itemKey === 'shovel').capabilities.excavation).toBeLessThan(42);

  await page.evaluate(() => window.helixHeresyDebug.damageTool('miningPick', 1000));
  const cell = { x: 46, y: 44 };
  await page.locator(`[data-map-x="${cell.x}"][data-map-y="${cell.y}"]`).click();
  await runSelectionCommand(page, 'Mine Mode');
  await page.locator(`[data-map-x="${cell.x}"][data-map-y="${cell.y}"]`).click();
  await runSelectionCommand(page, 'Confirm Dig Designation');

  let snapshot = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      task: state.tasks.find((task) => task.type === 'constructionWork'),
      tile: state.construction.orders.at(-1).tiles[0],
    };
  }, { key: storageKey });
  expect(snapshot.task).toBeFalsy();
  expect(snapshot.tile.status).toBe('planned');
  expect(snapshot.tile.blockedReason).toContain('inadequate');

  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('#inventoryCommandInput').fill('restore pick');
  await page.locator('#inventoryCommandBtn').click();
  await page.locator('[data-workspace-tab="map"]').click();

  snapshot = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      task: state.tasks.find((task) => task.type === 'constructionWork'),
      tile: state.construction.orders.at(-1).tiles[0],
    };
  }, { key: storageKey });
  expect(snapshot.task.data.toolSelections).toEqual([
    expect.objectContaining({ itemKey: 'miningPick', requirement: 'solid-rock excavation' }),
  ]);

  await page.evaluate(() => {
    const pick = window.helixHeresyDebug.constructionToolSnapshot().find((tool) => tool.itemKey === 'miningPick');
    window.helixHeresyDebug.damageTool('miningPick', pick.instance.current - 1);
  });
  const progressAdvance = Math.max(1, Math.ceil(snapshot.task.data.workStartsAt - snapshot.task.createdAt + 65));
  await skipSeconds(page, progressAdvance);

  const interrupted = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const tile = state.construction.orders.at(-1).tiles[0];
    const pick = state.toolDurability.miningPick[0];
    return {
      task: state.tasks.find((task) => task.type === 'constructionWork'),
      tile,
      pick,
      metalParts: state.resources.metalParts,
    };
  }, { key: storageKey });
  expect(interrupted.task).toBeFalsy();
  expect(interrupted.tile.status).toBe('planned');
  expect(interrupted.tile.workCompletedSeconds).toBeGreaterThan(0);
  expect(interrupted.tile.workCompletedSeconds).toBeLessThan(interrupted.tile.workRequiredSeconds);
  expect(interrupted.pick.current).toBe(0);
  expect(interrupted.tile.lastInterruptionReason).toContain('broke');

  await page.locator('[data-workspace-tab="resources"]').click();
  await page.locator('[data-stores-menu-tab="tools"]').click();
  const pickRow = page.locator('[data-inventory-item-key="miningPick"]');
  await pickRow.getByRole('button', { name: 'Repair' }).click();
  await finishTask(page, 'Haul materials for Repair Mining pick');
  await finishTask(page, 'Repair Mining pick');

  const repaired = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const tile = state.construction.orders.at(-1).tiles[0];
    return {
      tile,
      pick: state.toolDurability.miningPick[0],
      task: state.tasks.find((task) => task.type === 'constructionWork'),
      metalParts: state.resources.metalParts,
    };
  }, { key: storageKey });
  expect(repaired.pick.current).toBeGreaterThan(0);
  expect(repaired.metalParts).toBe(interrupted.metalParts - 1);
  expect(repaired.tile.workCompletedSeconds).toBe(interrupted.tile.workCompletedSeconds);
  expect(repaired.task.data.toolSelections[0].itemKey).toBe('miningPick');
});
