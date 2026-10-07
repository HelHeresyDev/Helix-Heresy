const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(120000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.surfaceWorkerSnapshot());
async function openWorkers(page) {
  if (!await page.locator('[data-economy-menu-tab="workers"]').isVisible()) await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="workers"]').click();
}
async function start(page) {
  page.setDefaultTimeout(20000);
  await startLifecycleRun(page, 'surface-employment');
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
  ] }, 'surface-employment'));
  const source = await page.evaluate(() => window.helixHeresyDebug.configureSurfaceWorkerTestSupport());
  expect(source).toBeTruthy(); await openWorkers(page); return source;
}
async function hire(page) {
  await page.getByRole('button', { name: 'Review 2-hour worker shift', exact: true }).click();
  await expect(page.locator('#economyWorkersList')).toContainText('no tools or protective kit', { ignoreCase: true });
  await page.getByRole('button', { name: 'Hire surface worker', exact: true }).click();
  const s = await snapshot(page); expect(s.saved.actor.present).toBe(false); expect(s.saved.contract.status).toBe('arriving');
  await page.evaluate(seconds => window.helixHeresyDebug.advanceSurfaceWorkerForTest(seconds), Math.ceil(s.route.distanceKm / 4 * 3600) + 10);
  expect((await snapshot(page)).saved.actor.present).toBe(false);
  await page.evaluate(() => { window.helixHeresyDebug.setDoorLockPhysicalState('door-surface-loading', 'unlocked'); window.helixHeresyDebug.advanceSurfaceWorkerForTest(10); });
  const arrival = await snapshot(page); expect(arrival.saved.actor.present, JSON.stringify({ gate: arrival.gate, actor: arrival.saved.actor })).toBe(true);
  const cell = arrival.scientist.cell;
  await page.getByRole('button', { name: 'Walk to worker receiving area', exact: true }).click();
  expect((await snapshot(page)).scientist.cell).toEqual(cell);
  for (let i = 0; i < 6; i++) {
    const s = await snapshot(page), task = s.tasks.find(t => t.type === 'scientistMove'); if (!task) break;
    await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, task.dueAt - s.clock + 1));
  }
  expect((await snapshot(page)).scientist.roomId).toBe('surfaceLoadingBay');
  await page.getByRole('button', { name: 'Receive worker report', exact: true }).click();
}

test('a worker arrives physically, carries exact supplies independently of the scientist, reloads and returns finite escrow', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = await start(page), initial = await snapshot(page);
  await hire(page); const before = await snapshot(page);
  await page.locator('[data-worker-field="source"]').selectOption(source);
  await page.locator('[data-worker-field="destination"]').selectOption('surfaceStaffOperations');
  await page.locator('[data-worker-field="amount"]').fill('10');
  await page.getByRole('button', { name: 'Delegate surface haul', exact: true }).click();
  const delegated = await snapshot(page); expect(delegated.saved.orders).toHaveLength(1); expect(delegated.tasks).toEqual(before.tasks);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(40));
  let s = await snapshot(page); expect(s.scientist).toEqual(before.scientist);
  expect(s.stacks.some(stack => stack.carriedBy === s.saved.actor.id), JSON.stringify({ orders: s.saved.orders, actor: s.saved.actor })).toBe(true);
  const original = s.saved.actor.id;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await openWorkers(page);
  expect((await snapshot(page)).saved.actor.id).toBe(original);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(1500));
  s = await snapshot(page); expect(s.saved.orders[0]).toMatchObject({ status: 'completed', delivered: 10 });
  expect(s.stacks.filter(stack => stack.key === 'cloth').reduce((n, stack) => n + stack.quantity, 0)).toBe(initial.stacks.filter(stack => stack.key === 'cloth').reduce((n, stack) => n + stack.quantity, 0));
  expect(s.stacks.filter(stack => stack.key === 'cloth' && stack.roomId === 'surfaceStaffOperations').reduce((n, stack) => n + stack.quantity, 0), JSON.stringify({ order: s.saved.orders[0], cloth: s.stacks.filter(stack => stack.key === 'cloth') })).toBe(10);
  await page.evaluate(() => window.helixHeresyDebug.setSurfaceWorkerForTest({ nearby: true }));
  await page.getByRole('button', { name: 'Receive worker report', exact: true }).click();
  const campaign = await page.evaluate(() => window.helixHeresyDebug.campaignSnapshot());
  expect(campaign.independentOperations.recruitment).toBeTruthy(); expect(campaign.independentOperations.delegation).toBeTruthy(); expect(campaign.accomplishedAt).toBeNull();
  await page.getByRole('button', { name: 'End worker shift', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(1800));
  s = await snapshot(page); expect(s.saved.contract.status).toBe('completed'); expect(s.saved.actor.present).toBe(false);
  expect(s.money + s.saved.actor.money).toBeCloseTo(initial.money); const money = s.money;
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(100)); expect((await snapshot(page)).money).toBe(money);
  expect(errors).toEqual([]);
});

test('access changes block a carried load; away reports freeze while authorized work continues; death freezes worker state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = await start(page); await hire(page);
  expect(await page.evaluate(source => window.helixHeresyDebug.surfaceWorkerAction('assign', { stackId: source, amount: 1, destination: 'mainLab' }), source)).toBe(false);
  expect(await page.evaluate(source => window.helixHeresyDebug.surfaceWorkerAction('assign', { stackId: source, amount: 5, destination: 'surfaceStaffOperations' }), source)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(40));
  let s = await snapshot(page); const worker = s.saved.actor;
  expect(s.stacks.some(stack => stack.carriedBy === worker.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setSurfaceWorkerForTest({ blockRoom: 'surfaceStaffOperations' }));
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(300));
  s = await snapshot(page); expect(s.saved.actor.mapCell).toEqual(worker.mapCell); expect(s.saved.orders[0].delivered).toBe(0);
  expect(s.stacks.some(stack => stack.carriedBy === worker.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setSurfaceWorkerForTest({ clearBlock: true, away: true }));
  const known = (await snapshot(page)).known;
  expect(await page.evaluate(() => window.helixHeresyDebug.surfaceWorkerAction('cancel'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(1200));
  s = await snapshot(page); expect(s.known).toEqual(known); expect(s.saved.orders[0].status).toBe('completed');
  await expect(page.locator('#economyWorkersList')).toContainText('this view stays dated');
  await page.evaluate(() => { window.helixHeresyDebug.setSurfaceWorkerForTest({ away: false, nearby: true }); window.helixHeresyDebug.surfaceWorkerAction('report'); });
  const finalKnown = (await snapshot(page)).known; expect(finalKnown.orders[0].delivered).toBe(5);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const dead = await snapshot(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(3600));
  expect((await snapshot(page)).saved).toEqual(dead.saved); expect((await snapshot(page)).known).toEqual(dead.known); expect(errors).toEqual([]);
});

test('nearby provision handoffs consume real stock and hazard withdrawal preserves a real carried load', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = await start(page); await hire(page);
  const before = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.surfaceWorkerAction('supply', { key: 'trailMeal' }))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setSurfaceWorkerForTest({ stageProvisionKey: 'trailMeal' }));
  const staged = await snapshot(page), meal = staged.stacks.find(stack => stack.key === 'trailMeal' && stack.carriedBy === 'scientist');
  expect(meal).toBeTruthy();
  await page.getByRole('button', { name: 'Give worker one meal', exact: true }).click();
  let s = await snapshot(page); expect(s.saved.actor.food).toBeCloseTo(before.saved.actor.food + 1); expect(s.stacks.some(stack => stack.id === meal.id)).toBe(false);
  expect(await page.evaluate(source => window.helixHeresyDebug.surfaceWorkerAction('assign', { stackId: source, amount: 5, destination: 'surfaceStaffOperations' }), source)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSurfaceWorkerForTest(40));
  s = await snapshot(page); const load = s.stacks.find(stack => stack.carriedBy === s.saved.actor.id), cell = s.saved.actor.mapCell;
  expect(load).toBeTruthy();
  await page.evaluate(cell => { window.helixHeresyDebug.setTileEnvironment(cell, { temperatureC: 70 }); window.helixHeresyDebug.advanceSurfaceWorkerForTest(10); }, cell);
  s = await snapshot(page); expect(s.saved.contract.reason).toContain('unsafe'); expect(s.saved.orders[0].status).toBe('cancelled');
  expect(s.stacks.find(stack => stack.id === load.id)).toMatchObject({ quantity: load.quantity, cell, carriedBy: '' });
  expect(s.stacks.find(stack => stack.id === source).reservedTaskId).toBe('');
  expect(s.stacks.filter(stack => stack.key === 'cloth').reduce((n, stack) => n + stack.quantity, 0)).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.setSurfaceWorkerForTest({ nearby: true }));
  const hit = await page.evaluate(() => window.helixHeresyDebug.surfaceWorkerCombatForTest(15));
  expect(hit).toMatchObject({ ok: true, hit: true, damage: 15 });
  s = await snapshot(page); expect(s.saved.actor.health).toBe(85);
  expect(s.injuries.filter(injury => injury.actorId === s.saved.actor.id)).toEqual(expect.arrayContaining([
    expect.objectContaining({ actorKind: 'surfaceWorker', typeId: 'bleeding' })
  ]));
  expect(s.injuries.filter(injury => injury.actorId === s.saved.actor.id).every(injury => ['head', 'torso', 'left arm', 'right arm', 'left leg', 'right leg'].includes(injury.location))).toBe(true);
  await page.evaluate(() => { window.helixHeresyDebug.surfaceWorkerCombatForTest(200); window.helixHeresyDebug.advanceSurfaceWorkerForTest(10); });
  s = await snapshot(page); expect(s.saved.actor.status).toBe('dead'); expect(s.saved.contract.status).toBe('fatality');
  expect(s.saved.contract.settled).toBe(false); expect(errors).toEqual([]);
});
