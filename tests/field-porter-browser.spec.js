const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Beasts = require('../wilderness-beasts');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldPorterSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldPorterAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function move(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 30; n++) {
    const tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason).toBe(''); await advance(page, Math.max(1, tasks[0].dueAt - (await snap(page)).clock + 1));
  }
  throw new Error('Scientist walk did not finish');
}
async function until(page, predicate, limit = 80) {
  for (let n = 0; n < limit; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 2); }
  throw new Error(`Porter condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('porter-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
async function setup(page, renderer, tools = false) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-porter-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const depot = { city, standings: [{ standing: 'licensed', network: { id: 'transport:b', category: 'transport', roles: ['courierDispatch'], prohibitions: [] },
    branch: { id: 'depot:b', publicName: 'Birch Depot', organizationForm: 'contractDepot', currentCityId: 'b', publicPhysicalPresence: true,
      physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] };
  const f = await page.evaluate(({ source, carrier, depot, renderer, tools }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'porter', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldPorterTestSource(depot)) return null;
    const station = d.fieldStationSnapshot().saved.site;
    // Explicit initial local position and finite wallet/cargo. No new journey,
    // worker, transport receipt, materials or teleport after this setup.
    d.configureUnsupportedTest({ cell: station.layout.apron });
    if (tools) d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'stoneChisel'] });
    const funds = d.exportSurveyExpeditionTestState(); funds.economy.money = 500; d.importSurveyExpeditionTestState(funds);
    const pickup = { ...station.layout.apron, x: station.layout.apron.x + 4 };
    const stock = d.configureHiddenWorkshopTest({ cell: pickup, supplies: { stoneBlocks: 3, lumber: 2 } });
    return { station, stone: stock[0], lumber: stock[1], pickup,
      tools: tools ? d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist' && ['masonryHammer', 'stoneChisel'].includes(i.key)).map(i => i.id) : [] };
  }, { source, carrier, depot, renderer, tools });
  expect(f).toBeTruthy();
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('button', { name: 'Mark porter outdoor station drop here', exact: true }).click();
  // The worker is already posted at defended ground; meet them by walking.
  const survey = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
  const ground = survey.saved?.roomId || survey.survey?.roomId;
  const room = ground || await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.roomId);
  await move(page, room, { x: 13, y: 11, z: f.station.layout.apron.z });
  const q = await act(page, 'review'); expect(q, JSON.stringify((await snap(page)).context)).toBeTruthy();
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Hire original porter for two-hour station shift', exact: true }).click();
  expect((await snap(page)).money).toBe(436);
  const s = await snap(page); expect(s.saved.phase).toBe('arriving'); expect(s.actor.roomId).toBe(room);
  await move(page, f.station.roomId, f.station.layout.apron);
  await until(page, s => s.saved.phase === 'onSite');
  return { ...f, room, errors, id: (await snap(page)).actor.id };
}

test('canvas porter walks, delivers one exact unit with real saved attendance, reports on reunion and settles only after return', async ({ page }) => {
  const f = await setup(page, 'canvas');
  let s = await snap(page); const capacity = s.inventory.capacity, started = s.saved.contract.startedAt;
  expect(capacity).toMatchObject({ massKg: 18, volumeL: 24 });
  expect(await act(page, 'assign', { stackId: f.stone })).toBe(true);
  const j = (await snap(page)).saved.job;
  expect((await snap(page)).stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 2, reservedTaskId: '' });
  await until(page, s => s.saved.job.phase === 'load' && s.saved.job.progress > 0);
  const partial = (await snap(page)).saved.job.progress; await reload(page, 'canvas'); s = await snap(page);
  expect(s.saved.job.progress).toBe(partial); expect(s.stacks.find(i => i.id === j.stackId).reservedTaskId).toBe(j.id);
  const known = s.known;
  await move(page, f.station.roomId, { x: 35, y: 12, z: f.station.layout.apron.z }); await advance(page, 60);
  s = await snap(page); expect(s.saved.job.status).toBe('delivered'); expect(s.known).toEqual(known); expect(await act(page, 'report')).toBe(false);
  expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: f.station.layout.apron, carriedBy: '', reservedTaskId: '', quantity: 1 });
  expect(s.saved.history).toHaveLength(1); expect(s.actor.id).toBe(f.id); expect(s.inventory.capacity).toEqual(capacity); expect(s.saved.contract.startedAt).toBe(started);
  await move(page, f.station.roomId, f.station.layout.apron);
  await page.getByRole('button', { name: 'Ask porter for personal report', exact: true }).click();
  expect((await snap(page)).known.received.job.status).toBe('delivered');
  expect(await act(page, 'settle')).toBe(false);
  await page.getByRole('button', { name: 'Ask porter to withdraw', exact: true }).click();
  expect((await snap(page)).saved.phase).toBe('returning');
  await advance(page, 70); s = await snap(page); expect(s.saved.phase).toBe('awaitingSettlement'); expect(s.actor.roomId).toBe(f.room);
  expect(await act(page, 'settle')).toBe(false);
  await move(page, f.room, { x: 13, y: 11, z: f.station.layout.apron.z });
  await page.getByRole('button', { name: 'Settle returned porter shift here', exact: true }).click();
  s = await snap(page); expect(s.saved.phase).toBe('completed'); expect(s.money).toBeGreaterThan(436); expect(s.money).toBeLessThan(460);
  const money = s.money; expect(await act(page, 'settle')).toBe(false); expect((await snap(page)).money).toBe(money);
  await reload(page, 'canvas'); expect((await snap(page)).actor.id).toBe(f.id); expect((await snap(page)).money).toBe(money); expect(f.errors).toEqual([]);
});

test('DOM porter respects blocked routes, finite kit capacity, missing cargo and actual unobserved beast injury without harming home worker', async ({ page }) => {
  const f = await setup(page, 'dom');
  const provisions = (await snap(page)).stacks.find(i => i.carriedBy === f.id && i.key === 'drinkingWater').quantity;
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.porter.actor.needs.thirst = 46;
    d.importSurveyExpeditionTestState(s);
  });
  await advance(page, 1);
  expect((await snap(page)).saved.actor.porterCare.key).toBe('drinkingWater');
  expect(await act(page, 'assign', { stackId: f.stone })).toBe(false);
  await advance(page, 20);
  expect((await snap(page)).stacks.find(i => i.carriedBy === f.id && i.key === 'drinkingWater').quantity).toBe(provisions - 1);
  expect((await snap(page)).actor.needs.thirst).toBeLessThan(10);
  // The finite 26L log exceeds this ordinary worker's entire 24L capacity.
  const log = await page.evaluate(id => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), i = s.physicalItemStacks.find(i => i.id === id);
    const log = { ...i, id: 'porter-finite-log-fixture', key: 'fieldLog', quantity: 1, unitVolumeL: 26, unitMassKg: 11 };
    s.physicalItemStacks.push(log); d.importSurveyExpeditionTestState(s); return log.id;
  }, f.stone);
  expect(await act(page, 'assign', { stackId: log })).toBe(false);
  expect(await act(page, 'assign', { stackId: f.stone })).toBe(true); await advance(page, 2);
  const ring = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = d.fieldPorterSnapshot().actor;
    const cells = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...a.mapCell, x: a.mapCell.x + dx, y: a.mapCell.y + dy }));
    for (const cell of cells) s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s); return cells;
  });
  const position = (await snap(page)).actor.mapCell; await advance(page, 60); let s = await snap(page);
  expect(s.actor.mapCell).toEqual(position); expect(s.saved.job.progress).toBe(0); expect(s.saved.job.reason).toContain('blocked');
  await reload(page, 'dom');
  await page.evaluate(ring => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !ring.some(c => c.x === w.cell.x && c.y === w.cell.y && c.z === w.cell.z));
    const id = d.fieldPorterSnapshot().saved.job.stackId; s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== id); d.importSurveyExpeditionTestState(s);
  }, ring);
  await advance(page, 1); expect((await snap(page)).saved.job.status).toBe('interrupted');
  expect(await act(page, 'assign', { stackId: f.stone })).toBe(true);
  await until(page, s => s.saved.job.phase === 'delivery'); s = await snap(page); const job = s.saved.job;
  // Scientist walks away; beasts still act against the actual porter, but no
  // private wound, progress or position becomes a remote report.
  await move(page, f.station.roomId, { x: 35, y: 12, z: f.station.layout.apron.z });
  const before = await snap(page), known = before.known;
  const baseline = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return s.surfaceWorkers?.actor?.health ?? null;
  });
  const beast = Beasts.actor('beast:rimefang-pack', 'porter-actual-threat', { ...before.actor.mapCell, x: before.actor.mapCell.x + 1 }, 'actual-test-population', before.clock);
  await page.evaluate(beast => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    Object.assign(beast, { roomId: e.wilderness.roomId, nextMoveAt: s.clock + 1000, nextAttackAt: s.clock, targetId: e.porter.actor.id, provokedUntil: s.clock + 1000, behavior: 'pursue' });
    e.porter.actor.nextMoveAt = s.clock + 100; // Explicit physical movement-cooldown fixture, not immunity.
    e.wilderness.beasts.actors = [beast]; d.importSurveyExpeditionTestState(s);
  }, beast);
  await advance(page, 20); s = await snap(page);
  expect(['returning', 'dead']).toContain(s.saved.phase); expect(s.known).toEqual(known); expect(s.actor.id).toBe(f.id);
  expect(s.actor.health).toBeLessThan(before.actor.health);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().surfaceWorkers?.actor?.health ?? null)).toBe(baseline);
  // Whether the first physical attack hits or misses, immediate danger ends
  // work. A delivered prior job cannot be credited a second time.
  expect(s.saved.history.filter(h => h.id === job.id && h.status === 'delivered').length).toBeLessThanOrEqual(1);
  expect(await act(page, 'report')).toBe(false); expect(f.errors).toEqual([]);
});

test('canvas bounded porter order reserves four exact mixed units, resumes partial reload, delivers independently and settles the original shift', async ({ page }) => {
  test.setTimeout(720000); // Four physical deliveries plus real reunion/return, not a clock jump.
  const f = await setup(page, 'canvas'); let s = await snap(page);
  const started = s.saved.contract.startedAt, capacity = s.inventory.capacity;
  const append = id => page.getByRole('button', { name: new RegExp(`^Append porter delivery:.*\\(${id}\\)$`) }).click();
  await append(f.stone); await append(f.stone); await append(f.lumber);
  await page.getByRole('button', { name: 'Remove last inspected porter delivery', exact: true }).click();
  expect((await snap(page)).known.proposal.rows).toHaveLength(2);
  await append(f.stone); await append(f.lumber); s = await snap(page);
  expect(s.known.proposal.rows.map(r => r.sourceId)).toEqual([f.stone, f.stone, f.stone, f.lumber]);
  expect(s.stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 3, reservedTaskId: '' });
  expect(await act(page, 'append', { stackId: f.lumber })).toBe(false);
  expect(await act(page, 'acceptOrder', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept exact bounded porter delivery order', exact: true }).click();
  s = await snap(page); const jobs = s.saved.deliveryOrder.jobs;
  expect(s.money).toBe(436); expect(jobs).toHaveLength(4); expect(new Set(jobs.map(j => j.stackId)).size).toBe(4);
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ quantity: 1, reservedTaskId: j.id });
  expect(s.stacks.find(i => i.id === f.lumber)).toMatchObject({ quantity: 1, reservedTaskId: '' });
  await until(page, s => s.saved.job.phase === 'load' && s.saved.job.progress > 0);
  const partial = (await snap(page)).saved.job.progress;
  await reload(page, 'canvas'); s = await snap(page);
  expect(s.saved.job.progress).toBe(partial); expect(s.saved.deliveryOrder.index).toBe(0);
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId).reservedTaskId).toBe(j.id);
  const known = s.known;
  await move(page, f.station.roomId, { x: 35, y: 12, z: f.station.layout.apron.z });
  s = await until(page, s => s.saved.deliveryOrder.status === 'delivered', 160);
  expect(s.known).toEqual(known); expect(await act(page, 'report')).toBe(false);
  expect(s.saved.deliveryOrder.index).toBe(4); expect(s.saved.history.map(j => j.id)).toEqual(jobs.map(j => j.id));
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: f.station.layout.apron, carriedBy: '', reservedTaskId: '' });
  expect(s.saved.contract.startedAt).toBe(started); expect(s.inventory.capacity).toEqual(capacity); expect(s.actor.id).toBe(f.id);
  await advance(page, 30); expect((await snap(page)).saved.history).toHaveLength(4);
  await move(page, f.station.roomId, f.station.layout.apron);
  await page.getByRole('button', { name: 'Ask porter for personal report', exact: true }).click();
  expect((await snap(page)).known.received.order.jobs.every(j => j.status === 'delivered')).toBe(true);
  await page.getByRole('button', { name: 'Ask porter to withdraw', exact: true }).click();
  await until(page, s => s.saved.phase === 'awaitingSettlement');
  expect(await act(page, 'settle')).toBe(false);
  await move(page, f.room, { x: 13, y: 11, z: f.station.layout.apron.z });
  await page.getByRole('button', { name: 'Settle returned porter shift here', exact: true }).click();
  s = await snap(page); expect(s.saved.phase).toBe('completed'); expect(Number.isInteger(s.money)).toBe(true);
  expect(s.money).toBeGreaterThan(436); expect(s.money).toBeLessThan(460); const money = s.money;
  expect(await act(page, 'settle')).toBe(false); await reload(page, 'canvas'); s = await snap(page);
  expect(s.money).toBe(money); expect(s.actor.id).toBe(f.id); expect(s.saved.history).toHaveLength(4); expect(f.errors).toEqual([]);
});

test('DOM porter order holds the next blocked delivery across reload and cancels unused claims on missing exact future cargo without substitution', async ({ page }) => {
  const f = await setup(page, 'dom');
  for (const id of [f.stone, f.stone, f.lumber]) expect(await act(page, 'append', { stackId: id })).toBe(true);
  // A real competing builder claim invalidates acceptance before any split.
  await page.evaluate(id => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).reservedTaskId = 'field-build:competing-material'; d.importSurveyExpeditionTestState(s);
  }, f.lumber);
  expect(await act(page, 'acceptOrder', { expected: (await snap(page)).known.proposal })).toBe(false);
  expect((await snap(page)).stacks.find(i => i.id === f.stone).quantity).toBe(3);
  await page.evaluate(id => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).reservedTaskId = ''; d.importSurveyExpeditionTestState(s);
  }, f.lumber);
  await page.getByRole('button', { name: 'Accept exact bounded porter delivery order', exact: true }).click();
  let s = await until(page, s => s.saved.deliveryOrder.index === 1); const jobs = s.saved.deliveryOrder.jobs;
  const ring = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = d.fieldPorterSnapshot().actor;
    const cells = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...a.mapCell, x: a.mapCell.x + dx, y: a.mapCell.y + dy }));
    for (const cell of cells) s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s); return cells;
  });
  const position = (await snap(page)).actor.mapCell; await advance(page, 40); s = await snap(page);
  expect(s.actor.mapCell).toEqual(position); expect(s.saved.deliveryOrder.index).toBe(1); expect(s.saved.job.progress).toBe(0);
  // This actual wall ring also covers the adjacent agreed drop. Access fails
  // before pathfinding, rather than inventing a delivery or skipping the unit.
  expect(s.context.dropLegal).toBe(false); expect(s.saved.job.reason).toContain('unavailable'); expect(s.saved.history).toHaveLength(1);
  await reload(page, 'dom'); s = await snap(page);
  expect(s.saved.deliveryOrder.index).toBe(1); expect(s.stacks.find(i => i.id === jobs[2].stackId).reservedTaskId).toBe(jobs[2].id);
  await page.evaluate(({ ring, missing }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !ring.some(c => c.x === w.cell.x && c.y === w.cell.y && c.z === w.cell.z));
    s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== missing); d.importSurveyExpeditionTestState(s);
  }, { ring, missing: jobs[2].stackId });
  await advance(page, 1); s = await snap(page);
  expect(s.saved.phase).toBe('returning'); expect(s.saved.deliveryOrder.status).toBe('interrupted');
  expect(s.stacks.find(i => i.id === f.lumber)).toMatchObject({ quantity: 1, reservedTaskId: '', cell: f.pickup });
  expect(s.stacks.filter(i => jobs.some(j => j.id === i.reservedTaskId))).toHaveLength(0);
  expect(s.stacks.find(i => i.id === jobs[0].stackId)).toMatchObject({ cell: f.station.layout.apron, reservedTaskId: '' });
  expect(s.saved.history.filter(j => j.status === 'delivered')).toHaveLength(1); const started = s.saved.contract.startedAt;
  await reload(page, 'dom'); await until(page, s => s.saved.phase === 'awaitingSettlement');
  await move(page, f.room, { x: 13, y: 11, z: f.station.layout.apron.z });
  await page.getByRole('button', { name: 'Ask porter for personal report', exact: true }).click();
  expect((await snap(page)).known.received.order.jobs.map(j => j.status)).toEqual(['delivered', 'interrupted', 'cancelled']);
  expect(await act(page, 'settle')).toBe(true); s = await snap(page); const money = s.money;
  expect(s.saved.contract.startedAt).toBe(started); expect(await act(page, 'settle')).toBe(false);
  await reload(page, 'dom'); expect((await snap(page)).money).toBe(money); expect(f.errors).toEqual([]);
});

test('canvas staging binds an interior delivery and the default drop, saves partial hauling and exposes only deposited stock to construction inspection', async ({ page }) => {
  test.setTimeout(720000);
  const f = await setup(page, 'canvas', true), tile = f.station.layout.rest;
  const part = f.station.layout.parts.find(p => p.kind === 'floor' && p.cell.y === f.station.layout.cache.y);
  await move(page, f.station.roomId, tile);
  for (const stackId of f.tools) expect(await page.evaluate(stackId => window.helixHeresyDebug.fieldStationAction('stage', { stackId }), stackId)).toBe(true);
  expect(f.tools).toHaveLength(2);
  const markButton = page.locator('[data-field-porter] button').filter({ hasText: /^Inspect porter staging tile here$/ });
  await expect(markButton).toBeEnabled({ timeout: 10000 }); await markButton.click();
  let stage = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.porterStages[0]);
  expect(stage.cell).toEqual(tile);
  const inspect = () => page.evaluate(partId => window.helixHeresyDebug.fieldBuilderAction('inspect', { partId }), part.id);
  expect(await inspect()).toBe(false); // Tools are real and staged, but no local stone exists yet.
  await move(page, f.station.roomId, f.station.layout.apron);
  const selector = page.getByLabel('Porter delivery staging destination');
  await selector.selectOption(stage.id);
  await page.getByRole('button', { name: new RegExp(`^Append porter delivery:.*\\(${f.stone}\\)$`) }).click();
  await selector.selectOption('');
  await page.getByRole('button', { name: new RegExp(`^Append porter delivery:.*\\(${f.stone}\\)$`) }).click();
  let s = await snap(page); const expected = s.known.proposal, start = s.saved.contract.startedAt;
  expect(expected.rows.map(r => r.drop)).toEqual([tile, f.station.layout.apron]);
  await page.getByRole('button', { name: 'Accept exact bounded porter delivery order', exact: true }).click();
  s = await snap(page); const jobs = s.saved.deliveryOrder.jobs;
  expect(jobs.map(j => j.drop)).toEqual([tile, f.station.layout.apron]);
  expect(s.money).toBe(436); expect(s.saved.contract.drop).toEqual(f.station.layout.apron);
  // Actual personal occupation of the staging/work tile prevents unloading,
  // and reserved cargo still at pickup is not promised construction stock.
  await move(page, f.station.roomId, tile); await advance(page, 5);
  s = await snap(page); expect(s.saved.history).toHaveLength(0); expect(s.saved.job.reason).toContain('unavailable');
  expect(await inspect()).toBe(false);
  await move(page, f.station.roomId, f.station.layout.apron);
  await until(page, s => s.saved.job.phase === 'load' && s.saved.job.progress > 0);
  const partial = (await snap(page)).saved.job.progress;
  await reload(page, 'canvas'); s = await snap(page);
  expect(s.saved.job.progress).toBe(partial); expect(s.saved.job.drop).toEqual(tile); expect(s.saved.job.destination).toEqual(stage);
  expect(s.stacks.find(i => i.id === jobs[0].stackId).reservedTaskId).toBe(jobs[0].id);
  stage = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.porterStages[0]);
  expect(stage).toEqual(expected.rows[0].destination);
  const known = s.known;
  await move(page, f.station.roomId, { x: 29, y: 14, z: tile.z }); await advance(page, 90); s = await snap(page);
  expect(s.saved.deliveryOrder.status, JSON.stringify(s.saved.job)).toBe('delivered');
  expect(s.saved.history.map(j => j.drop)).toEqual([tile, f.station.layout.apron]); expect(s.known).toEqual(known);
  expect(await act(page, 'report')).toBe(false);
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: j.drop, carriedBy: '', reservedTaskId: '', quantity: 1 });
  expect(s.stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 1, cell: f.pickup, reservedTaskId: '' });
  expect(s.saved.contract.startedAt).toBe(start); expect(s.money).toBe(436);
  await move(page, f.station.roomId, tile); expect(await inspect()).toBe(true);
  const proposal = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builderProposal);
  expect(proposal.inputs).toHaveLength(1); expect(proposal.inputs[0]).toMatchObject({ stackId: jobs[0].stackId, cell: tile, quantity: 1 });
  // Inspection alone neither reserves delivered goods nor commissions a worker.
  expect((await snap(page)).stacks.find(i => i.id === jobs[0].stackId).reservedTaskId).toBe('');
  await advance(page, 5); expect((await snap(page)).saved.history).toHaveLength(2); expect(f.errors).toEqual([]);
});

test('DOM staging rejects obstructed acceptance and holds a newly blocked second destination across reload without skipping the later default delivery', async ({ page }) => {
  test.setTimeout(720000);
  const f = await setup(page, 'dom'), tile = f.station.layout.rest;
  await move(page, f.station.roomId, tile); expect(await act(page, 'markStage')).toBe(true);
  const stage = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.porterStages[0]);
  await move(page, f.station.roomId, f.station.layout.apron);
  for (const options of [{ stackId: f.stone }, { stackId: f.stone, stageId: stage.id }, { stackId: f.lumber }]) expect(await act(page, 'append', options)).toBe(true);
  const expected = (await snap(page)).known.proposal;
  const wall = async present => page.evaluate(({ tile, present }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === tile[k]));
    if (present) s.labMap.terrain.constructedWalls.push({ cell: tile, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s);
  }, { tile, present });
  await wall(true); expect(await act(page, 'acceptOrder', { expected })).toBe(false);
  expect((await snap(page)).stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 3, reservedTaskId: '' });
  await wall(false); expect(await act(page, 'acceptOrder', { expected })).toBe(true);
  let s = await snap(page); const jobs = s.saved.deliveryOrder.jobs, start = s.saved.contract.startedAt;
  await wall(true); const known = (await snap(page)).known; await advance(page, 90); s = await snap(page);
  expect(s.saved.deliveryOrder.index).toBe(1); expect(s.saved.history).toHaveLength(1);
  expect(s.saved.job).toMatchObject({ id: jobs[1].id, drop: tile, status: 'working', progress: 0 }); expect(s.saved.job.reason).toContain('unavailable');
  for (const j of jobs.slice(1)) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: f.pickup, reservedTaskId: j.id, carriedBy: '' });
  expect(s.known).toEqual(known); expect(s.saved.contract.drop).toEqual(f.station.layout.apron);
  await reload(page, 'dom'); s = await snap(page);
  expect(s.saved.job.drop).toEqual(tile); expect(s.saved.job.destination).toEqual(stage); expect(s.saved.deliveryOrder.index).toBe(1);
  await advance(page, 20); expect((await snap(page)).saved.job.progress).toBe(0);
  await wall(false); await advance(page, 100); s = await snap(page);
  expect(s.saved.deliveryOrder.status, JSON.stringify(s.saved.job)).toBe('delivered');
  expect(s.saved.history.map(j => j.id)).toEqual(jobs.map(j => j.id));
  expect(s.saved.history.map(j => j.drop)).toEqual([f.station.layout.apron, tile, f.station.layout.apron]);
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: j.drop, carriedBy: '', reservedTaskId: '' });
  expect(s.stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 1, cell: f.pickup, reservedTaskId: '' });
  expect(s.stacks.find(i => i.id === f.lumber)).toMatchObject({ quantity: 1, cell: f.pickup, reservedTaskId: '' });
  expect(s.saved.contract.startedAt).toBe(start); expect(s.money).toBe(436);
  await reload(page, 'dom'); expect((await snap(page)).saved.history).toHaveLength(3); expect(f.errors).toEqual([]);
});
