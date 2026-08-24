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
  const seconds = await page.evaluate(({ key, id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const task = state.tasks.find((entry) => entry.id === id);
    return Math.max(1, Math.ceil(task.dueAt - state.clock + 1));
  }, { key: storageKey, id: taskId });
  await page.evaluate((amount) => window.helixHeresyDebug.advanceSimulation(amount), seconds);
}

async function finishProductionChain(page, recipeId, maximumTasks = 12) {
  for (let count = 0; count < maximumTasks; count += 1) {
    const status = await page.evaluate(({ key, recipeId: targetRecipeId }) => {
      const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
      const parent = state.productionBills.find((bill) => bill.recipeId === targetRecipeId && !bill.parentBillId);
      return { parentStatus: parent?.status || '', hasTask: state.tasks.some((task) => task.type === 'productionWork') };
    }, { key: storageKey, recipeId });
    if (status.parentStatus === 'completed') return;
    if (!status.hasTask) throw new Error(`Production chain for ${recipeId} stopped before completion.`);
    await finishProductionTask(page);
  }
  throw new Error(`Production chain for ${recipeId} exceeded ${maximumTasks} tasks.`);
}

async function finishProductionUntilIdle(page, maximumTasks = 12) {
  for (let count = 0; count < maximumTasks; count += 1) {
    const hasTask = await page.evaluate(({ key }) => {
      const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
      return state.tasks.some((task) => task.type === 'productionWork');
    }, { key: storageKey });
    if (!hasTask) return;
    await finishProductionTask(page);
  }
  throw new Error(`Production remained active after ${maximumTasks} tasks.`);
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

  if (!await page.locator('[data-workspace-panel="production"]').isVisible()) {
    await page.locator('[data-workspace-tab="production"]').click();
  }
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

  await finishProductionUntilIdle(page);
  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const bill = state.productionBills.find((entry) => entry.recipeId === 'receptacle:sealedCollectionJar' && !entry.parentBillId);
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

test('glassware bill creates visible prerequisite stages and physical byproducts', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:sealedCollectionJar', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['glass'],
  }));

  const planned = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.recipeId === 'receptacle:sealedCollectionJar' && !bill.parentBillId);
    return {
      parent,
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === parent.id).map((bill) => bill.recipeId).sort(),
      activeRecipe: state.tasks.find((task) => task.type === 'productionWork')?.data.recipeId,
    };
  }, { key: storageKey });
  expect(planned.dependencies).toEqual(['process:glasswareComponents', 'process:rubberSeals']);
  expect(['process:glasswareComponents', 'process:rubberSeals']).toContain(planned.activeRecipe);

  await finishProductionChain(page, 'receptacle:sealedCollectionJar');
  const completed = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.recipeId === 'receptacle:sealedCollectionJar' && !bill.parentBillId);
    return {
      parent,
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === parent.id),
      recipes: state.productionWorkpieces.map((workpiece) => workpiece.recipeId),
      jar: state.physicalItemStacks.find((stack) => stack.key === 'sealedCollectionJar' && stack.productionBillId === parent.id),
      byproducts: state.physicalItemStacks.filter((stack) => stack.tags?.includes('production-byproduct')).map((stack) => stack.key).sort(),
      workpieces: state.productionWorkpieces,
    };
  }, { key: storageKey });
  expect(completed.parent.status).toBe('completed');
  expect(completed.dependencies.every((bill) => bill.status === 'completed')).toBe(true);
  expect(completed.recipes).toEqual(expect.arrayContaining(['process:glasswareComponents', 'process:rubberSeals', 'receptacle:sealedCollectionJar']));
  expect(completed.jar).toMatchObject({ quantity: 1, materialComposition: { primary: 'glass', seal: 'rubber' } });
  expect(completed.byproducts).toEqual(expect.arrayContaining(['glassFragments', 'rubberOffcuts']));
  expect(completed.workpieces.every((workpiece) => workpiece.inputQuality > 0 && workpiece.craftsmanship > 0)).toBe(true);
});


test('parent bill pause resume and cancellation propagate to generated prerequisites', async ({ page }) => {
  await startRun(page);
  const parentId = await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:sealedCollectionJar', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['glass'],
  }).id);

  await page.evaluate((id) => window.helixHeresyDebug.setProductionBillStatus(id, 'paused'), parentId);
  let snapshot = await page.evaluate(({ key, id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      children: state.productionBills.filter((bill) => bill.parentBillId === id),
      tasks: state.tasks.filter((task) => task.type === 'productionWork'),
    };
  }, { key: storageKey, id: parentId });
  expect(snapshot.children.length).toBeGreaterThan(0);
  expect(snapshot.children.every((bill) => bill.status === 'paused' && bill.pausedByParent)).toBe(true);
  expect(snapshot.tasks).toHaveLength(0);

  await page.evaluate((id) => window.helixHeresyDebug.setProductionBillStatus(id, 'active'), parentId);
  snapshot = await page.evaluate(({ key, id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      children: state.productionBills.filter((bill) => bill.parentBillId === id),
      tasks: state.tasks.filter((task) => task.type === 'productionWork'),
    };
  }, { key: storageKey, id: parentId });
  expect(snapshot.children.every((bill) => bill.status === 'active' && !bill.pausedByParent)).toBe(true);
  expect(snapshot.tasks).toHaveLength(1);

  await page.evaluate((id) => window.helixHeresyDebug.setProductionBillStatus(id, 'canceled'), parentId);
  snapshot = await page.evaluate(({ key, id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      children: state.productionBills.filter((bill) => bill.parentBillId === id),
      tasks: state.tasks.filter((task) => task.type === 'productionWork'),
      workstationTaskId: state.fixtures.find((fixture) => fixture.id === 'starter-workbench').productionTaskId,
    };
  }, { key: storageKey, id: parentId });
  expect(snapshot.children.every((bill) => bill.status === 'canceled')).toBe(true);
  expect(snapshot.tasks).toHaveLength(0);
  expect(snapshot.workstationTaskId).toBe('');
});
test('wood fixture recursively produces fixed-batch intermediates without reserving the whole chain', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'fixture:bed', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['wood'],
  }));
  await finishProductionChain(page, 'fixture:bed');

  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.recipeId === 'fixture:bed' && !bill.parentBillId);
    return {
      parent,
      dependencyRecipes: state.productionBills.filter((bill) => bill.autoGenerated && bill.parentBillId).map((bill) => bill.recipeId),
      bed: state.physicalItemStacks.find((stack) => stack.key === 'bedComponents' && stack.productionBillId === parent.id),
      sawdust: state.physicalItemStacks.filter((stack) => stack.key === 'sawdust').reduce((total, stack) => total + stack.quantity, 0),
      workpieces: state.productionWorkpieces,
    };
  }, { key: storageKey });
  expect(result.parent.status).toBe('completed');
  expect(result.dependencyRecipes).toEqual(expect.arrayContaining(['process:woodenComponents', 'process:cutBoards']));
  expect(result.bed).toMatchObject({ quantity: 1, materialComposition: { primary: 'wood' } });
  expect(result.sawdust).toBeGreaterThanOrEqual(2);
  for (const workpiece of result.workpieces) {
    expect(workpiece.craftsmanship).toBeLessThanOrEqual(workpiece.criticalInputQuality + 18.01);
  }
});

test('maintain-stock quality floor excludes unrated starter stock', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:filterBag', mode: 'maintain', targetQuantity: 1, minimumCraftsmanship: 40,
    scope: 'global', materialStrategy: 'closest', allowedMaterialOptionIds: ['cloth'],
  }));
  await finishProductionTask(page);
  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const bill = state.productionBills.find((entry) => entry.recipeId === 'receptacle:filterBag' && !entry.parentBillId);
    const eligible = state.physicalItemStacks.filter((stack) => stack.key === 'filterBag' && stack.craftsmanship >= 40)
      .reduce((total, stack) => total + stack.quantity, 0);
    return { bill, eligible, active: state.tasks.some((task) => task.type === 'productionWork') };
  }, { key: storageKey });
  expect(result.bill).toMatchObject({ status: 'active', minimumCraftsmanship: 40, completedQuantity: 1 });
  expect(result.eligible).toBeGreaterThanOrEqual(1);
  expect(result.active).toBe(false);
});

test('component quality gate propagates to dependencies and leaves low-quality stock for other work', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state;
    const source = state.physicalItemStacks.find((stack) => stack.section === 'resources' && stack.key === 'glass');
    state.physicalItemStacks.push(
      { ...structuredClone(source), id: 'test-low-glassware', key: 'glasswareComponents', quantity: 2, knownQuantity: 2, craftsmanship: 20, productionBillId: 'older-work' },
      { ...structuredClone(source), id: 'test-low-seals', key: 'rubberSeals', quantity: 2, knownQuantity: 2, craftsmanship: 18, productionBillId: 'older-work' },
    );
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, { key: storageKey });
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();

  await page.locator('[data-workspace-tab="production"]').click();
  await page.locator('#productionRecipeSelect').selectOption('receptacle:sealedCollectionJar');
  await page.locator('#productionComponentQualityInput').fill('40');
  await page.locator('#productionBillForm button[type="submit"]').click();

  const initial = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.recipeId === 'receptacle:sealedCollectionJar' && !bill.parentBillId);
    return {
      parent,
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === parent.id),
      lowGlassware: state.physicalItemStacks.find((stack) => stack.id === 'test-low-glassware'),
      lowSeals: state.physicalItemStacks.find((stack) => stack.id === 'test-low-seals'),
    };
  }, { key: storageKey });
  expect(initial.parent.minimumComponentCraftsmanship).toBe(40);
  expect(initial.dependencies).toHaveLength(2);
  for (const dependency of initial.dependencies) {
    expect(dependency).toMatchObject({
      minimumComponentCraftsmanship: 40,
      requiredOutputCraftsmanship: 40,
      producedQuantity: 0,
      rejectedQuantity: 0,
      qualityRetryLimit: 3,
    });
  }
  expect(initial.lowGlassware.reservedTaskId).toBe('');
  expect(initial.lowSeals.reservedTaskId).toBe('');
  await expect(page.locator(`[data-production-bill="${initial.parent.id}"]`)).toContainText('Component inputs must have 40+ craftsmanship');

  await finishProductionChain(page, 'receptacle:sealedCollectionJar');
  const completed = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.recipeId === 'receptacle:sealedCollectionJar' && !bill.parentBillId);
    return {
      parent,
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === parent.id),
      lowGlassware: state.physicalItemStacks.find((stack) => stack.id === 'test-low-glassware'),
      lowSeals: state.physicalItemStacks.find((stack) => stack.id === 'test-low-seals'),
      jar: state.physicalItemStacks.find((stack) => stack.key === 'sealedCollectionJar' && stack.productionBillId === parent.id),
    };
  }, { key: storageKey });
  expect(completed.parent.status).toBe('completed');
  expect(completed.jar.craftsmanship).toBeGreaterThan(0);
  expect(completed.lowGlassware).toMatchObject({ quantity: 2, craftsmanship: 20, reservedTaskId: '' });
  expect(completed.lowSeals).toMatchObject({ quantity: 2, craftsmanship: 18, reservedTaskId: '' });
  for (const dependency of completed.dependencies) {
    expect(dependency.completedQuantity).toBeGreaterThan(0);
    expect(dependency.rejectedQuantity).toBe(0);
  }
});

test('quality retries retain rejected outputs, pause after three attempts, persist, and can be deliberately resumed or lowered', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  const parentId = await page.evaluate(() => window.helixHeresyDebug.createProductionBill({
    recipeId: 'receptacle:sealedCollectionJar', mode: 'once', scope: 'global',
    materialStrategy: 'closest', allowedMaterialOptionIds: ['glass'], minimumComponentCraftsmanship: 100,
  }).id);

  await finishProductionUntilIdle(page, 10);
  let snapshot = await page.evaluate(({ key, parentId: id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    const parent = state.productionBills.find((bill) => bill.id === id);
    const dependencies = state.productionBills.filter((bill) => bill.parentBillId === id);
    return {
      parent,
      dependencies,
      rejectedStacks: state.physicalItemStacks.filter((stack) => dependencies.some((bill) => bill.rejectedStackIds.includes(stack.id))),
      activeTask: state.tasks.find((task) => task.type === 'productionWork') || null,
    };
  }, { key: storageKey, parentId });
  expect(snapshot.dependencies).toHaveLength(2);
  expect(snapshot.activeTask).toBeNull();
  expect(snapshot.parent.blockedReason).toContain('Waiting for prerequisite');
  for (const dependency of snapshot.dependencies) {
    expect(dependency).toMatchObject({
      status: 'paused',
      completedQuantity: 0,
      qualityRetryPaused: true,
      consecutiveQualityRejections: 3,
      qualityRetryLimit: 3,
    });
    expect(dependency.producedQuantity).toBe(dependency.rejectedQuantity);
    expect(dependency.rejectedQuantity).toBeGreaterThan(0);
    expect(dependency.rejectedStackIds).toHaveLength(3);
    expect(dependency.blockedReason).toContain('Quality gate paused after 3 consecutive rejected outputs');
  }
  expect(snapshot.rejectedStacks).toHaveLength(6);
  for (const stack of snapshot.rejectedStacks) {
    expect(stack.tags).toContain('quality-rejected');
    expect(stack.craftsmanship).toBeLessThan(100);
    expect(stack.quantity).toBeGreaterThan(0);
  }

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  snapshot = await page.evaluate(({ key, parentId: id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      parent: state.productionBills.find((bill) => bill.id === id),
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === id),
    };
  }, { key: storageKey, parentId });
  expect(snapshot.parent.minimumComponentCraftsmanship).toBe(100);
  expect(snapshot.dependencies.every((bill) => bill.qualityRetryPaused && bill.rejectedStackIds.length === 3)).toBe(true);

  const resumedId = snapshot.dependencies[0].id;
  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'active'), resumedId);
  let resumed = await page.evaluate(({ key, billId }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      bill: state.productionBills.find((entry) => entry.id === billId),
      task: state.tasks.find((entry) => entry.type === 'productionWork'),
    };
  }, { key: storageKey, billId: resumedId });
  expect(resumed.bill).toMatchObject({ status: 'active', qualityRetryPaused: false, consecutiveQualityRejections: 0 });
  expect(resumed.task.data.billId).toBe(resumedId);

  await page.evaluate((billId) => window.helixHeresyDebug.setProductionBillStatus(billId, 'paused'), resumedId);
  await page.evaluate(({ id }) => window.helixHeresyDebug.setProductionBillComponentQuality(id, 1), { id: parentId });
  const lowered = await page.evaluate(({ key, parentId: id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      parent: state.productionBills.find((bill) => bill.id === id),
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === id),
      task: state.tasks.find((entry) => entry.type === 'productionWork'),
    };
  }, { key: storageKey, parentId });
  expect(lowered.parent.minimumComponentCraftsmanship).toBe(1);
  expect(lowered.dependencies.every((bill) => bill.minimumComponentCraftsmanship === 1 && bill.requiredOutputCraftsmanship === 1)).toBe(true);
  expect(lowered.task).toBeTruthy();

  await finishProductionChain(page, 'receptacle:sealedCollectionJar', 4);
  const finished = await page.evaluate(({ key, parentId: id }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      parent: state.productionBills.find((bill) => bill.id === id),
      dependencies: state.productionBills.filter((bill) => bill.parentBillId === id),
      retainedRejected: state.physicalItemStacks.filter((stack) => stack.tags?.includes('quality-rejected')),
    };
  }, { key: storageKey, parentId });
  expect(finished.parent.status).toBe('completed');
  expect(finished.dependencies.every((bill) => ['completed', 'canceled'].includes(bill.status))).toBe(true);
  expect(finished.retainedRejected.length).toBeGreaterThan(0);
});
