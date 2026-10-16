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
async function setup(page, renderer) {
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
  const f = await page.evaluate(({ source, carrier, depot, renderer }) => {
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
    const funds = d.exportSurveyExpeditionTestState(); funds.economy.money = 500; d.importSurveyExpeditionTestState(funds);
    const pickup = { ...station.layout.apron, x: station.layout.apron.x + 4 };
    const stock = d.configureHiddenWorkshopTest({ cell: pickup, supplies: { stoneBlocks: 3, lumber: 2 } });
    return { station, stone: stock[0], lumber: stock[1], pickup };
  }, { source, carrier, depot, renderer });
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
