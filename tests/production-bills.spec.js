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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function finishProductionTask(page) {
  const taskId = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.tasks.find((task) => task.type === 'productionWork')?.id || '';
  }, { key: storageKey });
  expect(taskId).toBeTruthy();
  await page.locator('[data-workspace-tab="tasks"]').click();
  const row = page.locator(`[data-task-row="${taskId}"]`);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Finish' }).click();
}

test('global bill physically consumes material and produces craftsmanship-rated stock', async ({ page }) => {
  await startRun(page);
  await page.locator('[data-workspace-tab="production"]').click();
  await page.locator('#productionRecipeSelect').selectOption('fixture:bed');
  await page.locator('#productionBillForm button[type="submit"]').click();

  let snapshot = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const bill = state.productionBills.at(-1);
    const task = state.tasks.find((entry) => entry.type === 'productionWork');
    return {
      bill,
      task,
      workpieces: state.productionWorkpieces,
      reserved: state.physicalItemStacks.filter((stack) => stack.reservedTaskId === task.id),
    };
  }, { key: storageKey });
  expect(snapshot.bill).toMatchObject({ recipeId: 'fixture:bed', scope: 'global', mode: 'once', status: 'active' });
  expect(snapshot.task.data.workstationId).toBe('starter-workbench');
  expect(snapshot.task.data.mapPath.length).toBeGreaterThan(1);
  expect(snapshot.reserved.length).toBeGreaterThan(0);
  expect(snapshot.workpieces).toHaveLength(0);

  const beginDelay = Math.max(1, Math.ceil(snapshot.task.data.workStartsAt - snapshot.task.createdAt + 1));
  await skipSeconds(page, beginDelay);
  snapshot = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      workpiece: state.productionWorkpieces.at(-1),
      reservedInputs: state.physicalItemStacks.filter((stack) => stack.productionBillId === state.productionBills.at(-1).id && !stack.productionWorkpieceId),
    };
  }, { key: storageKey });
  expect(snapshot.workpiece).toMatchObject({ recipeId: 'fixture:bed', status: 'working', workstationId: 'starter-workbench' });
  expect(snapshot.workpiece.progressSeconds).toBeGreaterThan(0);
  expect(snapshot.reservedInputs).toHaveLength(0);

  await finishProductionTask(page);
  const completed = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const bill = state.productionBills.at(-1);
    const workpiece = state.productionWorkpieces.at(-1);
    const output = state.physicalItemStacks.find((stack) => stack.productionWorkpieceId === workpiece.id);
    return { bill, workpiece, output, fabrication: state.scientist.skills.fabrication };
  }, { key: storageKey });
  expect(completed.bill).toMatchObject({ status: 'completed', completedQuantity: 1 });
  expect(completed.workpiece).toMatchObject({ status: 'completed' });
  expect(completed.workpiece.craftsmanship).toBeGreaterThan(0);
  expect(completed.output).toMatchObject({ key: 'bedComponents', quantity: 1 });
  expect(completed.output.craftsmanship).toBe(completed.workpiece.craftsmanship);
  expect(completed.output.materialComposition.primary).toBeTruthy();
  expect(completed.fabrication).toBeTruthy();

  await page.locator('[data-workspace-tab="production"]').click();
  await page.locator('[data-production-menu-tab="workpieces"]').click();
  await expect(page.locator(`[data-production-workpiece="${completed.workpiece.id}"]`)).toContainText('craftsmanship');
});

test('workstation bill remains pinned to its chosen workbench', async ({ page }) => {
  await startRun(page);
  await page.locator('[data-map-x="55"][data-map-y="46"]').click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Add Workstation Bill' }).click();
  await expect(page.locator('[data-workspace-panel="production"]')).toBeVisible();
  await expect(page.locator('#productionScopeSelect')).toHaveValue('workstation');
  await expect(page.locator('#productionWorkstationSelect')).toHaveValue('starter-workbench');

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const second = structuredClone(state.fixtures.find((fixture) => fixture.id === 'starter-workbench'));
    second.id = 'secondary-workbench';
    second.name = 'Secondary Workbench';
    second.origin = { x: 58, y: 46 };
    second.productionTaskId = '';
    state.fixtures.push(second);
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, { key: storageKey });
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();

  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:filterBag',
    scope: 'workstation',
    workstationId: 'secondary-workbench',
    mode: 'once',
    priority: 2,
    materialStrategy: 'closest',
    allowedMaterialOptionIds: ['cloth'],
  }));
  const task = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.tasks.find((entry) => entry.type === 'productionWork');
  }, { key: storageKey });
  expect(task.data.workstationId).toBe('secondary-workbench');
});

test('maintain-stock counts only empty eligible receptacles', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const stack = state.physicalItemStacks.find((entry) => entry.section === 'inventory' && entry.key === 'sealedCollectionJar');
    stack.quantity -= 1;
    stack.knownQuantity = stack.quantity;
    state.physicalItemStacks.push({
      ...structuredClone(stack), id: `stack-${state.nextPhysicalItemStackNumber++}`, quantity: 1, knownQuantity: 1,
      contents: [{ type: 'collectedByproduct', key: 'acid droplets', label: 'acid droplets', amount: 2, unit: 'L', tags: ['acid'] }],
    });
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, { key: storageKey });
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:sealedCollectionJar', mode: 'maintain', targetQuantity: 6,
    scope: 'global', materialStrategy: 'closest', allowedMaterialOptionIds: ['glass'],
  }));

  await finishProductionTask(page);
  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const bill = state.productionBills.at(-1);
    return {
      bill,
      activeProductionTasks: state.tasks.filter((task) => task.type === 'productionWork').length,
      emptyJars: state.physicalItemStacks
        .filter((stack) => stack.key === 'sealedCollectionJar' && !(stack.contents || []).length)
        .reduce((total, stack) => total + stack.quantity, 0),
      filledJars: state.physicalItemStacks
        .filter((stack) => stack.key === 'sealedCollectionJar' && (stack.contents || []).length)
        .reduce((total, stack) => total + stack.quantity, 0),
    };
  }, { key: storageKey });
  expect(result.bill).toMatchObject({ status: 'active', completedQuantity: 1, targetQuantity: 6 });
  expect(result.activeProductionTasks).toBe(0);
  expect(result.emptyJars).toBe(6);
  expect(result.filledJars).toBe(1);
});

test('pausing after work starts preserves and resumes the physical workpiece', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:filterBag', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['cloth'],
  }));
  const initial = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return { billId: state.productionBills.at(-1).id, task: state.tasks.find((entry) => entry.type === 'productionWork') };
  }, { key: storageKey });
  await skipSeconds(page, Math.max(1, Math.ceil(initial.task.data.workStartsAt - initial.task.createdAt + 30)));
  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'paused'), initial.billId);
  const paused = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return { bill: state.productionBills.at(-1), workpiece: state.productionWorkpieces.at(-1), task: state.tasks.find((entry) => entry.type === 'productionWork') };
  }, { key: storageKey });
  expect(paused.bill.status).toBe('paused');
  expect(paused.task).toBeUndefined();
  expect(paused.workpiece.status).toBe('paused');
  expect(paused.workpiece.progressSeconds).toBeGreaterThan(0);

  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'active'), initial.billId);
  const resumed = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.tasks.find((entry) => entry.type === 'productionWork');
  }, { key: storageKey });
  expect(resumed.data.workpieceId).toBe(paused.workpiece.id);
  expect(resumed.data.reservedStackIds).toHaveLength(0);
  await finishProductionTask(page);
  const completed = await page.evaluate(({ key }) => JSON.parse(window.localStorage.getItem(key) || '{}').state.productionWorkpieces.at(-1), { key: storageKey });
  expect(completed).toMatchObject({ id: paused.workpiece.id, status: 'completed' });
});

test('canceling started work leaves physical scrap and releases the workstation', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:filterBag', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['cloth'],
  }));
  const initial = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return { billId: state.productionBills.at(-1).id, task: state.tasks.find((entry) => entry.type === 'productionWork') };
  }, { key: storageKey });
  await skipSeconds(page, Math.max(1, Math.ceil(initial.task.data.workStartsAt - initial.task.createdAt + 30)));
  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'canceled'), initial.billId);

  const canceled = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const workpiece = state.productionWorkpieces.at(-1);
    return {
      bill: state.productionBills.at(-1),
      workpiece,
      scrap: state.physicalItemStacks.find((stack) => stack.id === workpiece.scrapStackId),
      workstation: state.fixtures.find((fixture) => fixture.id === 'starter-workbench'),
      activeProductionTasks: state.tasks.filter((task) => task.type === 'productionWork').length,
    };
  }, { key: storageKey });
  expect(canceled.bill.status).toBe('canceled');
  expect(canceled.workpiece.status).toBe('canceled');
  expect(canceled.scrap).toMatchObject({ key: 'waste' });
  expect(canceled.scrap.tags).toContain('crafting-scrap');
  expect(canceled.workstation.productionTaskId).toBe('');
  expect(canceled.activeProductionTasks).toBe(0);

  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:sealedCollectionJar', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['glass'],
  }));
  const replacementTask = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.tasks.find((entry) => entry.type === 'productionWork');
  }, { key: storageKey });
  expect(replacementTask.data.workstationId).toBe('starter-workbench');
});
