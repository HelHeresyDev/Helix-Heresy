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

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

async function mutateSave(page, callbackSource) {
  await page.evaluate(({ key, callback }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    // Tests pass only local fixture callbacks, evaluated inside the browser page.
    Function('state', callback)(state);
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, callback: callbackSource });
}

test('named access areas are assigned and painted through the map overlay', async ({ page }) => {
  await startRun(page);
  await page.locator('[data-workspace-tab="policies"]').click();
  await page.locator('[data-policy-menu-tab="access"]').click();
  await expect(page.locator('#accessPolicyList')).toContainText('No named access areas');

  page.once('dialog', (dialog) => dialog.accept('Acid Wing'));
  await page.getByRole('button', { name: 'New Forbidden Area' }).click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');

  const before = await page.evaluate(() => window.helixHeresyDebug.accessControlSnapshot());
  expect(before.areas).toEqual([
    expect.objectContaining({ name: 'Acid Wing', kind: 'forbidden', cells: [] }),
  ]);
  expect(before.profiles[0].areaIds).toContain(before.areas[0].id);
  expect(before.editor.activeAreaId).toBe(before.areas[0].id);

  const target = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    return view.cells.find((cell) => cell.known && ['room', 'floor'].includes(cell.base.kind) && !cell.scientist && !cell.object && !cell.door).cell;
  });
  await page.locator(`[data-map-x="${target.x}"][data-map-y="${target.y}"]`).click();

  const after = await page.evaluate(() => window.helixHeresyDebug.accessControlSnapshot());
  expect(after.areas[0].cells).toContainEqual(target);
  const map = await page.evaluate(() => window.helixHeresyDebug.mapViewSnapshot());
  const painted = map.cells.find((cell) => cell.cell.x === target.x && cell.cell.y === target.y);
  expect(painted.overlay).toMatchObject({ id: 'access' });
  expect(painted.overlay.styleTokens).toContain('map-overlay-access-forbidden');
});

test('direct scientist movement warns and records an explicit restriction override', async ({ page }) => {
  await startRun(page);
  await mutateSave(page, `
    const cells = state.labMap.rooms.storageRoom.cells;
    state.accessControl.areas = [{ id: 'access-area-1', name: 'Toxic Storage', kind: 'forbidden', emergencyOnly: false, cells }];
    state.accessControl.profiles[0].areaIds = ['access-area-1'];
  `);
  await loadSavedRun(page);

  page.once('dialog', (dialog) => dialog.dismiss());
  const canceled = await page.evaluate(() => window.helixHeresyDebug.startScientistMove('storageRoom'));
  expect(canceled).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot())).toEqual([]);

  page.once('dialog', (dialog) => dialog.accept());
  const accepted = await page.evaluate(() => window.helixHeresyDebug.startScientistMove('storageRoom'));
  expect(accepted.type).toBe('scientistMove');
  expect(accepted.data.accessOverride).toBe(true);
  const queued = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot());
  expect(queued[0].status.id).not.toBe('blocked');
});

test('new restrictions block existing routine work while loose slimes ignore policy areas', async ({ page }) => {
  await startRun(page);
  const task = await page.evaluate(() => window.helixHeresyDebug.startScientistMove('storageRoom'));
  expect(task.data.accessOverride).toBe(false);
  await mutateSave(page, `
    const target = state.tasks.find((task) => task.type === 'scientistMove').data.mapPath.at(-1);
    state.accessControl.areas = [{ id: 'access-area-1', name: 'New Hazard', kind: 'forbidden', emergencyOnly: false, cells: [target] }];
    state.accessControl.profiles[0].areaIds = ['access-area-1'];
    const slime = {
      id: 'policy-blind-slime', name: 'POLICY-BLIND', status: 'released', roomId: 'mainLab', mapCell: state.scientist.mapCell,
      genome: state.currentGenome, createdAt: 0, matureAt: 0, deathAt: 999999, stats: {}, skills: {}
    };
    state.slimes = [slime];
    state.accessControl.assignments[slime.id] = state.accessControl.profiles[0].id;
    state.accessControl.profiles[0].actorIds.push(slime.id);
  `);
  await loadSavedRun(page);

  const result = await page.evaluate(() => {
    const statuses = window.helixHeresyDebug.taskStatusSnapshot();
    const state = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save')).state;
    const target = state.tasks[0].data.mapPath.at(-1);
    return {
      task: statuses[0],
      slimeReasons: window.helixHeresyDebug.accessBlockReasons([state.scientist.mapCell, target], 'policy-blind-slime'),
    };
  });
  expect(result.task.status).toMatchObject({ id: 'blocked' });
  expect(result.task.status.reason).toContain('New Hazard');
  expect(result.slimeReasons).toEqual([]);
});

test('door commands and emergency lockdown create physical scientist tasks', async ({ page }) => {
  await startRun(page);
  const doorFixture = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const entry = Object.values(state.doors).find((door) => door.state === 'open' && !door.breached);
    return { id: entry.id, state: entry.state };
  }, { key: storageKey });

  const task = await page.evaluate((doorId) => window.helixHeresyDebug.queueDoorOperation(doorId, 'position', 'closed'), doorFixture.id);
  expect(task).toMatchObject({ type: 'doorOperation', data: { doorId: doorFixture.id } });
  const before = await page.evaluate(({ key, doorId }) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    return { door: state.doors[doorId], tasks: state.tasks };
  }, { key: storageKey, doorId: doorFixture.id });
  expect(before.door.state).toBe('open');
  expect(before.tasks.some((entry) => entry.type === 'doorOperation')).toBe(true);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(10000));
  const after = await page.evaluate(({ key, doorId }) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    return { door: state.doors[doorId], tasks: state.tasks, scientist: state.scientist };
  }, { key: storageKey, doorId: doorFixture.id });
  expect(after.door.state).toBe('closed');
  expect(after.tasks.some((entry) => entry.type === 'doorOperation')).toBe(false);

  await mutateSave(page, `
    for (const door of Object.values(state.doors)) door.lockdownAction = 'unchanged';
    state.doors['${doorFixture.id}'].state = 'open';
    state.doors['${doorFixture.id}'].lockState = 'unlocked';
    state.doors['${doorFixture.id}'].lockdownAction = 'lock';
    state.accessControl.lockdownActive = false;
  `);
  await loadSavedRun(page);
  await page.locator('[data-workspace-tab="policies"]').click();
  await page.locator('[data-policy-menu-tab="access"]').click();
  await page.getByLabel('Emergency restrictions active').check();
  const lockdown = await page.evaluate(({ key, doorId }) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    return { door: state.doors[doorId], tasks: state.tasks, active: state.accessControl.lockdownActive };
  }, { key: storageKey, doorId: doorFixture.id });
  expect(lockdown.active).toBe(true);
  expect(lockdown.door.state).toBe('open');
  expect(lockdown.tasks).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'doorOperation', data: expect.objectContaining({ doorId: doorFixture.id, lockdown: true }) }),
  ]));
});

test('door authorization guides routing but direct orders can warn and override it', async ({ page }) => {
  await startRun(page);
  const doorId = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key)).state;
    const profile = state.accessControl.profiles[0];
    profile.doorAccessRuleIds = profile.doorAccessRuleIds.filter((id) => id !== 'containment');
    const door = Object.values(state.doors).find((entry) => entry.accessRuleId === 'containment' && !entry.breached);
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return door.id;
  }, { key: storageKey });
  await loadSavedRun(page);

  page.once('dialog', (dialog) => dialog.dismiss());
  const canceled = await page.evaluate((id) => window.helixHeresyDebug.queueDoorOperation(id, 'position', 'closed'), doorId);
  expect(canceled).toBeNull();

  page.once('dialog', (dialog) => dialog.accept());
  const accepted = await page.evaluate((id) => window.helixHeresyDebug.queueDoorOperation(id, 'position', 'closed'), doorId);
  expect(accepted.data.accessOverride).toBe(true);
  expect(accepted.data.accessOverrideKeys).toContain(`door:${doorId}:containment`);
});
