// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
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

test('@smoke construction tools block inadequate work retain partial progress and support basic repair', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);

  const geologyFoundation = await page.evaluate(() => {
    const sampleCell = { x: 46, y: 44, z: 0 };
    const sample = window.helixHeresyDebug.geologyCellSnapshot(sampleCell);
    const repeated = window.helixHeresyDebug.geologyCellSnapshot(sampleCell);
    const origin = window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell;
    return {
      version: window.HelixGeologyField.VERSION,
      sample,
      deterministic: JSON.stringify(sample.actual) === JSON.stringify(repeated.actual),
      deposit: window.helixHeresyDebug.findGeologyFeature('deposit', origin, { maxRadius: 40 }),
      hazard: window.helixHeresyDebug.findGeologyFeature('hazard', origin, { maxRadius: 40 }),
      readiness: window.helixHeresyDebug.roomExpansionReadiness('mainLab'),
    };
  });
  expect(geologyFoundation.version).toBe(1);
  expect(geologyFoundation.deterministic).toBe(true);
  expect(geologyFoundation.sample.face).toMatchObject({
    materialId: geologyFoundation.sample.actual.stratum.materialId,
    hardnessBand: expect.any(String),
    stabilityBand: expect.any(String),
  });
  expect(geologyFoundation.deposit.deposit).toBeTruthy();
  expect(geologyFoundation.hazard.hazard).toBeTruthy();
  expect(geologyFoundation.readiness.stages.map((stage) => stage.id)).toEqual([
    'designated', 'excavated', 'reachable', 'cleared', 'structurallySafe', 'lit', 'ventilated', 'equipped', 'commissioned',
  ]);

  const starterTools = await page.evaluate(() => window.helixHeresyDebug.constructionToolSnapshot());
  expect(starterTools.map((tool) => tool.itemKey).sort()).toEqual([
    'foldingLadder', 'handSaw', 'masonryHammer', 'miningPick', 'pryBar', 'shovel', 'stoneChisel', 'woodAxe',
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
  expect(snapshot.task.data.geologyWearMultiplier).toBeCloseTo(geologyFoundation.sample.actual.toolWearMultiplier);
  expect(snapshot.tile.workRequiredSeconds).toBeGreaterThan(0);

  await page.evaluate(() => {
    const pick = window.helixHeresyDebug.constructionToolSnapshot().find((tool) => tool.itemKey === 'miningPick');
    window.helixHeresyDebug.damageTool('miningPick', pick.instance.current - 1);
  });
  const progressAdvance = Math.max(1, Math.ceil(
    snapshot.task.data.workStartsAt - snapshot.task.createdAt
    + 65 / Math.max(0.1, snapshot.task.data.geologyWearMultiplier || 1)
  ));
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

  await finishTask(page, 'Mine tile 46,44');
  const mined = await page.evaluate((cell) => ({
    encounter: window.helixHeresyDebug.geologyEncounterSnapshot().find((entry) =>
      entry.cell.x === cell.x && entry.cell.y === cell.y && entry.cell.z === (cell.z || 0)),
    rubble: JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}').state.labMap.terrain.rubble
      .find((pile) => pile.cell.x === cell.x && pile.cell.y === cell.y && pile.cell.z === (cell.z || 0)),
  }), { x: 46, y: 44, z: 0 });
  expect(mined.encounter).toMatchObject({ stratumId: geologyFoundation.sample.actual.stratum.id });
  expect(mined.rubble.materials).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: geologyFoundation.sample.actual.stratum.materialId }),
  ]));

  const pocket = await page.evaluate((profile) => {
    window.helixHeresyDebug.setExcavatedCells([profile.cell]);
    const outcome = window.helixHeresyDebug.resolveGeologyExcavationForTest(profile.cell);
    const environment = window.helixHeresyDebug.tileEnvironmentSnapshot(profile.cell)[0];
    const encounter = window.helixHeresyDebug.geologyEncounterSnapshot().find((entry) =>
      entry.cell.x === profile.cell.x && entry.cell.y === profile.cell.y && entry.cell.z === profile.cell.z);
    const magnitude = profile.hazard.kind === 'airborne'
      ? environment.airborneTotal
      : profile.hazard.kind === 'mana'
        ? environment.manaDensity
        : environment.temperatureC;
    return { outcome, environment, encounter, magnitude };
  }, geologyFoundation.hazard);
  expect(pocket.encounter.hazardId).toBe(geologyFoundation.hazard.hazard.id);
  expect(pocket.outcome.profile.hazard.id).toBe(geologyFoundation.hazard.hazard.id);
  expect(pocket.magnitude).toBeGreaterThan(30);
});
