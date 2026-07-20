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

async function finishCurrentTask(page) {
  const timing = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const task = window.helixHeresyDebug.taskStatusSnapshot()[0];
    return task ? { seconds: Math.max(1, task.dueAt - state.clock + 1), type: task.type } : null;
  }, { key: storageKey });
  if (!timing) throw new Error('No scientist task is available to finish.');
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), timing.seconds);
  return timing.type;
}

test('persistent rubble hauling preserves the physical rubble pile and exposes its order controls', async ({ page }) => {
  await startRun(page);
  const setup = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const source = { ...state.scientist.mapCell };
    const destination = { ...state.labMap.rooms.storageRoom.anchor };
    state.labMap.terrain.rubble.push({
      id: 'labor-rubble', cell: source, source: 'test excavation', createdAt: state.clock,
      materials: [{ id: 'stone', label: 'Stone rubble', amount: 8 }],
    });
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return { source, destination };
  }, { key: storageKey });
  await loadSavedRun(page);

  await page.evaluate(({ destination }) => window.helixHeresyDebug.createLaborOrder({
    kind: 'rubbleHaul', category: 'hauling', label: 'Haul test rubble', priority: 3,
    target: { kind: 'rubble', id: 'labor-rubble' },
    destination: { roomId: 'storageRoom', cell: destination, stockpileId: 'test-material-stockpile' },
    dedupeKey: 'test:rubble',
  }), { destination: setup.destination });

  const before = await page.evaluate(() => ({
    orders: window.helixHeresyDebug.workOrderSnapshot(),
    tasks: window.helixHeresyDebug.taskStatusSnapshot(),
  }));
  expect(before.orders.find((order) => order.id === before.tasks[0].data.workOrderId)).toMatchObject({ status: 'claimed', priority: 3 });
  expect(before.tasks[0].type).toBe('laborWork');

  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-menu-tab="orders"]').click();
  const row = page.locator('[data-work-order-id]').filter({ hasText: 'Haul test rubble' });
  await expect(row).toContainText('Hauling');
  await expect(row.getByLabel('Priority for Haul test rubble')).toHaveValue('3');

  await finishCurrentTask(page);
  const after = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      pile: state.labMap.terrain.rubble.find((entry) => entry.id === 'labor-rubble'),
      order: window.helixHeresyDebug.workOrderSnapshot().find((entry) => entry.data.dedupeKey === 'test:rubble'),
    };
  }, { key: storageKey });
  expect(after.pile.cell).toEqual(setup.destination);
  expect(after.pile.materials).toEqual([{ id: 'stone', label: 'Stone rubble', amount: 8 }]);
  expect(after.pile.stockpileId).toBe('test-material-stockpile');
  expect(after.order.status).toBe('completed');
});

test('repair orders haul physical material before restoring a damaged door', async ({ page }) => {
  await startRun(page);
  const doorId = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const id = Object.keys(state.labMap.doors)[0];
    const door = state.doors[id];
    door.condition = 20;
    door.breached = false;
    door.state = 'open';
    door.lockState = 'unlocked';
    door.sealState = 'unsealed';
    const keys = new Set(['lumber', 'metalParts', 'stoneBlocks', 'glass', 'rubber']);
    state.physicalItemStacks = state.physicalItemStacks.filter((stack) => !keys.has(stack.key));
    const template = state.physicalItemStacks.find((stack) => stack.section === 'resources');
    for (const resourceKey of keys) {
      state.physicalItemStacks.push({
        ...template, id: `repair-${resourceKey}`, key: resourceKey, quantity: 5, knownQuantity: 5,
        roomId: 'storageRoom', cell: { ...state.labMap.rooms.storageRoom.anchor }, fixtureId: '', stockpileId: '',
        contents: [], tags: [], sourceLabels: [], sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
      });
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return id;
  }, { key: storageKey });
  await loadSavedRun(page);

  await page.evaluate((id) => window.helixHeresyDebug.createLaborOrder({
    kind: 'repair', category: 'repair', label: 'Repair test door', priority: 2,
    target: { kind: 'door', id }, dedupeKey: `test:repair:${id}`,
  }), doorId);
  expect(await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot()[0].type)).toBe('resourceHaul');
  await finishCurrentTask(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot()[0].type)).toBe('laborWork');
  await finishCurrentTask(page);

  const result = await page.evaluate(({ key, id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      condition: state.doors[id].condition,
      order: window.helixHeresyDebug.workOrderSnapshot().find((entry) => entry.data.dedupeKey === `test:repair:${id}`),
    };
  }, { key: storageKey, id: doorId });
  expect(result.condition).toBeGreaterThan(20);
  expect(result.order.status).toBe('completed');
});

test('collection service policy carries a real replacement and does not auto-clear overflow by default', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const tank = state.containers.find((container) => container.id === 'basic-10');
    tank.name = 'Policy Collection Tank';
    tank.typeId = 'specimenDrainageTank';
    tank.roomId = 'collectionBay';
    tank.mapCell = { ...state.labMap.rooms.collectionBay.anchor };
    state.collectionBay = { stations: {
      'basic-10': {
        containerId: 'basic-10', material: 'acid droplets', methodType: 'drip', automaticServiceHold: false,
        receptacle: { label: 'sealed collection jar', itemKey: 'sealedCollectionJar', installed: true, amount: 10, capacity: 10 },
        overflow: { amount: 3, capacity: 3 }, sourceMaterials: ['acid droplets'], sourceSlimes: ['POLICY-001'],
      },
    } };
    state.policies.servicing = { mode: 'full', thresholdPercent: 100, clearOverflow: false, priority: 2 };
    state.physicalItemStacks = state.physicalItemStacks.filter((stack) => stack.key !== 'sealedCollectionJar');
    const template = state.physicalItemStacks.find((stack) => stack.section === 'inventory');
    state.physicalItemStacks.push({
      ...template, id: 'policy-empty-jars', section: 'inventory', key: 'sealedCollectionJar', quantity: 2, knownQuantity: 2,
      roomId: 'storageRoom', cell: { ...state.labMap.rooms.storageRoom.anchor }, fixtureId: '', stockpileId: '',
      form: 'stack', contents: [], tags: [], sourceLabels: [], sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
    });
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await page.evaluate(() => window.helixHeresyDebug.syncLaborOrders());

  const task = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot()[0]);
  expect(task.type).toBe('laborWork');
  expect(task.data.replacementStackId).toBe('policy-empty-jars');
  expect(task.data.mapPath.length).toBeGreaterThan(2);
  await finishCurrentTask(page);
  await page.evaluate(() => window.helixHeresyDebug.syncLaborOrders());

  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const station = state.collectionBay.stations['basic-10'];
    return {
      station,
      filled: state.physicalItemStacks.filter((stack) => stack.key === 'sealedCollectionJar' && stack.contents?.length),
      activePolicyOrders: window.helixHeresyDebug.workOrderSnapshot().filter((order) => order.source === 'policy' && !['completed', 'canceled'].includes(order.status)),
    };
  }, { key: storageKey });
  expect(result.filled).toHaveLength(1);
  expect(result.station.receptacle.amount).toBe(3);
  expect(result.station.overflow.amount).toBe(0);
  expect(result.station.automaticServiceHold).toBe(true);
  expect(result.activePolicyOrders).toHaveLength(0);
});

test('checking an adapted task status does not cancel its work order', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    state.tasks.push({
      id: `task-${state.nextTaskNumber++}`, type: 'containerHaul', label: 'Move test container',
      createdAt: state.clock, dueAt: state.clock + 600,
      data: { containerId: 'basic-1', toRoomId: 'mainLab', roomId: 'mainLab' },
    });
    state.policies.labor.permissions.hauling = false;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  const result = await page.evaluate(() => {
    window.helixHeresyDebug.taskStatusSnapshot();
    return window.helixHeresyDebug.workOrderSnapshot().find((order) => order.data.adaptedTaskType === 'containerHaul');
  });
  expect(result.status).toBe('blocked');
  expect(result.blockedReason).toContain('Hauling is disabled');
  expect(result.claimedTaskId).toBeTruthy();
});
