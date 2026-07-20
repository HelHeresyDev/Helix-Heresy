// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { genomeForTraits } = require('./gene-fixtures');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function stageLooseSlime(page, options = {}) {
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { complexity: state.complexity || 'clean' };
  }, { key: storageKey });
  const fixtureSeed = 'containment-response-fixture';
  const genome = genomeForTraits({
    seed: fixtureSeed,
    complexity: context.complexity,
    baseGenome: 'A'.repeat(26),
    traits: {
      consistency: 'soft gelatin',
      element: 'none',
      behavior: 'idle pooling',
      stability: 'placid',
    },
  });
  options = { ...options, fixtureSeed, genome };
  await page.evaluate(({ key, options }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = state.containers.find((entry) => entry.id === 'basic-1');
    if (!container) throw new Error('basic-1 not found');
    const scientistCell = state.scientist.mapCell || state.labMap.rooms.mainLab.anchor;
    const slimeCell = { x: scientistCell.x + 2, y: scientistCell.y };
    state.seed = options.fixtureSeed;
    state.clock = 0;
    state.paused = true;
    state.timeSpeed = 'normal';
    state.tasks = [];
    state.nextTaskNumber = 1;
    state.taskHistory = [];
    state.incidents = [];
    state.nextIncidentNumber = 1;
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.policies.handling.method = 'longTongs';
    container.roomId = 'mainLab';
    container.type = 'basic';
    container.typeId = 'ironCage';
    container.name = 'Recovery Cage';
    container.condition = 100;
    container.isOpen = false;
    container.breachState = 'intact';
    state.slimes = [{
      id: 'loose-response-test',
      name: 'LOOSE-RESPONSE',
      genome: options.genome,
      source: 'Containment response fixture',
      createdAt: 0,
      deathAt: 1000000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: slimeCell,
      automationExcluded: true,
      roleId: 'idle',
      roleSource: 'manual',
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 90, max: 100 },
        currentMass: { current: 1, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      skills: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      analyzedCapabilities: {},
      containmentTest: {},
      revealed: { consistency: 'soft gelatin', element: 'none', behavior: 'idle pooling', stability: 'placid' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      autonomousMovement: null,
      nextAutonomousDecisionAt: 999999,
      roomActivity: { type: 'quiescent', label: 'remaining quiescent', roomId: 'mainLab', updatedAt: 0 },
    }];
    state.selection = { kind: 'slime', id: 'loose-response-test', source: 'map' };
    state.selectedMapTarget = { kind: 'slime', id: 'loose-response-test' };
    state.selectedSlimeId = 'loose-response-test';
    state.ui.activeWorkspaceTab = 'map';
    state.ui.selectionInspectorTab = 'summary';
    state.ui.selectionInspectorExpanded = false;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, options });
  await loadSavedRun(page);
  await skipSeconds(page, 1);
}

test('known loose slime can be physically recaptured into an explicit container', async ({ page }) => {
  await startRun(page);
  await stageLooseSlime(page);

  const before = await page.evaluate(() => window.helixHeresyDebug.containmentResponseSnapshot('loose-response-test'));
  expect(before.incident).toMatchObject({ sourceId: 'loose-response-test', perceptionPrecision: 'exact' });
  expect(before.destinations.some((entry) => entry.id === 'basic-1' && !entry.blockReason)).toBe(true);

  const queued = await page.evaluate(() => window.helixHeresyDebug.startSlimeRecapture('loose-response-test', 'basic-1'));
  expect(queued).toBe(true);
  const task = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot().find((entry) => entry.type === 'recaptureSlime'));
  expect(task).toMatchObject({ type: 'recaptureSlime', status: { id: 'active' } });
  expect(task.data.mapPath.length).toBeGreaterThan(1);
  expect(task.data.destinationContainerId).toBe('basic-1');

  await skipSeconds(page, 1000);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'loose-response-test');
    const container = state.containers.find((entry) => entry.id === 'basic-1');
    return {
      slime: { status: slime.status, containerId: slime.containerId, mapCell: slime.mapCell },
      containerOpen: container.isOpen,
      activeTasks: state.tasks.filter((entry) => entry.type === 'recaptureSlime').length,
      history: state.taskHistory.find((entry) => entry.type === 'recaptureSlime'),
      events: state.events.map((entry) => entry.message || String(entry)).join(' | '),
    };
  }, { key: storageKey });
  expect(result.slime, result.events).toEqual({ status: 'contained', containerId: 'basic-1', mapCell: null });
  expect(result.containerOpen).toBe(false);
  expect(result.activeTasks).toBe(0);
  expect(result.history?.status).toBe('completed');
  expect(result.events).toContain('recaptured in Recovery Cage');
});

test('recapture waits when the creature leaves its observed capture point', async ({ page }) => {
  await startRun(page);
  await stageLooseSlime(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.startSlimeRecapture('loose-response-test', 'basic-1'))).toBe(true);

  const current = await page.evaluate(() => window.helixHeresyDebug.containmentResponseSnapshot('loose-response-test').slime.cell);
  const moved = await page.evaluate(({ current }) => window.helixHeresyDebug.relocateLooseSlime('loose-response-test', {
    x: current.x + 1,
    y: current.y,
  }), { current });
  expect(moved).toBe(true);

  const task = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot().find((entry) => entry.type === 'recaptureSlime'));
  expect(task.status.id).toBe('blocked');
  expect(task.status.reason).toMatch(/moved away|not at an exactly observed location/i);
  const slime = await page.evaluate(() => window.helixHeresyDebug.containmentResponseSnapshot('loose-response-test').slime);
  expect(slime.status).toBe('released');
  expect(slime.containerId).toBe(null);
});

test('bait placement moves one physical feedstock unit onto the selected tile and emits a trace', async ({ page }) => {
  await startRun(page);
  const target = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const scientist = view.cells.find((cell) => cell.scientist);
    return scientist.cell;
  });
  const before = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks
    .filter((stack) => stack.section === 'resources' && stack.key === 'organicFeedstock')
    .reduce((total, stack) => total + stack.quantity, 0));

  expect(await page.evaluate(({ target }) => window.helixHeresyDebug.startPlaceBait(target, 'organicFeedstock'), { target })).toBe(true);
  const queued = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot().find((entry) => entry.type === 'placeBait'));
  expect(queued.data.mapPath.length).toBeGreaterThan(1);
  await skipSeconds(page, 1000);

  const result = await page.evaluate(({ target }) => {
    const stacks = window.helixHeresyDebug.physicalStockSnapshot().stacks;
    const bait = stacks.find((stack) => stack.section === 'resources'
      && stack.key === 'organicFeedstock'
      && stack.cell.x === target.x && stack.cell.y === target.y
      && stack.tags.includes('bait'));
    const after = stacks.filter((stack) => stack.section === 'resources' && stack.key === 'organicFeedstock')
      .reduce((total, stack) => total + stack.quantity, 0);
    const environment = window.helixHeresyDebug.tileEnvironmentSnapshot(target)[0];
    const queuedHaul = window.helixHeresyDebug.taskStatusSnapshot()
      .some((task) => task.type === 'stockpileHaul' && task.data.stackId === bait?.id);
    return { bait, after, trace: environment.chemicalTraces.organic || 0, queuedHaul };
  }, { target });
  expect(result.bait?.quantity).toBe(1);
  expect(result.after).toBe(before);
  expect(result.trace).toBeGreaterThan(0);
  expect(result.queuedHaul).toBe(false);
});

test('map selections expose explicit recapture destinations and physical bait commands', async ({ page }) => {
  await startRun(page);
  await stageLooseSlime(page);

  const slimeTile = page.locator('[data-map-target-kind="slime"][data-map-target-id="loose-response-test"]').first();
  await expect(slimeTile).toBeVisible();
  await slimeTile.click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const panel = page.locator('[data-context-command-panel="true"]');
  await expect(panel.getByRole('button', { name: 'Recapture into Recovery Cage' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: 'Contain Creature' })).toHaveAttribute('data-context-command-disabled', 'true');

  const slimeCell = await page.evaluate(() => window.helixHeresyDebug.containmentResponseSnapshot('loose-response-test').slime.cell);
  await page.keyboard.press('Escape');
  await page.evaluate(({ slimeCell }) => window.helixHeresyDebug.selectMapTarget({
    kind: 'tile',
    tile: { x: slimeCell.x + 1, y: slimeCell.y },
  }), { slimeCell });
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Place Bait: Organic Feedstock' })).toBeEnabled();

  const incidentId = await page.evaluate(() => window.helixHeresyDebug.containmentResponseSnapshot('loose-response-test').incident.id);
  await page.keyboard.press('Escape');
  await page.evaluate(({ incidentId }) => window.helixHeresyDebug.selectMapTarget({ kind: 'incident', id: incidentId }), { incidentId });
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const incidentPanel = page.locator('[data-context-command-panel="true"]');
  await expect(incidentPanel.getByRole('button', { name: 'Initiate Emergency Lockdown' })).toBeEnabled();
  await incidentPanel.getByRole('button', { name: 'Initiate Emergency Lockdown' }).click();
  const lockdown = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      active: state.accessControl.lockdownActive,
      doorTasks: state.tasks.filter((task) => task.type === 'doorOperation' && task.data.lockdown).length,
    };
  }, { key: storageKey });
  expect(lockdown.active).toBe(true);
  expect(lockdown.doorTasks).toBeGreaterThan(0);
});
