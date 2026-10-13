const { test, expect } = require('@playwright/test');
const Passenger = require('../intercity-passenger');
const { pathToFileURL } = require('url');
const path = require('path');
const copy = x => JSON.parse(JSON.stringify(x));
const city = id => ({ cityId: id, assetId: `city:${id}`, currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = id => [{ network: { id: `transport:${id}`, category: 'transport' }, standing: 'licensed', branch: { id: `branch:${id}`, cityId: id, publicName: `City ${id} Passenger Depot`, capacityBand: 'functional', operationalStatus: 'active' } }];
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b', 'c'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [
  { id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'bc', endpointCityIds: ['b', 'c'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }
] });
function fixture() {
  const s = Passenger.create(city('a'), standings('a'), 0); s.provisionsSeconds = 0;
  return { s, item: { id: 'actual-pack', section: 'inventory', key: 'fieldRation', quantity: 1, carriedBy: 'scientist', unitMassKg: 1, unitVolumeL: 1, sourceLabels: ['Original paid supplies'], tags: [] },
    c: { local: true, atStand: true, carrierCurrent: true, sameBody: true, bodyEpoch: 0, alive: true, capable: true, free: true, busy: false } };
}
function reserved(f) { f.item.reservedTaskId = 'handoff:1'; return { progress: 30, lastAt: 30, attendedAt: 0 }; }
test('ration terms use one real owned carried pack, four hours and the unchanged original 96-hour cap', () => {
  const f = fixture(), before = JSON.stringify(f);
  expect(Passenger.provisionPlan(f.s, f.item, f.c)).toMatchObject({ ok: true, quantity: 1, seconds: 14400, handoffSeconds: 30, capSeconds: 345600 });
  expect(JSON.stringify(f)).toBe(before);
  for (const change of [{ section: 'resources' }, { key: 'trailMeal' }, { key: 'drinkingWater' }, { carriedBy: '' }, { quantity: 0 }, { quantity: 1.5 },
    { cityOwnerId: 'b' }, { civicCustody: {} }, { carryTaskId: 'borrowed' }, { fixtureId: 'locker' }, { containerId: 'bottle' }, { toolInstanceId: 'tool' },
    { contents: [{}] }, { chemicalBatch: {} }, { biology: {} }, { reservedTaskId: 'another' }, { tags: ['contaminated'] }, { tags: ['unsealed'] }, { unitMassKg: 0 }, { unitVolumeL: NaN }])
    expect(Passenger.provisionPlan(f.s, { ...f.item, ...change }, f.c).ok).toBe(false);
  f.s.provisionsSeconds = Passenger.PROVISION_CAP - Passenger.PROVISION_SECONDS; expect(Passenger.provisionPlan(f.s, f.item, f.c).ok).toBe(true);
  f.s.provisionsSeconds += 1; expect(Passenger.provisionPlan(f.s, f.item, f.c).ok).toBe(false);
});
test('only the selected local living original can receive; commitments and body changes block the operation', () => {
  const f = fixture();
  for (const flag of ['local', 'carrierCurrent', 'sameBody', 'alive', 'capable', 'free']) expect(Passenger.provisionPlan(f.s, f.item, { ...f.c, [flag]: false }).ok).toBe(false);
  expect(Passenger.provisionPlan(f.s, f.item, { ...f.c, busy: true }).ok).toBe(false);
  for (const patch of [{ phase: 'outbound' }, { phase: 'inbound' }, { phase: 'arrival' }, { phase: 'bodyLost' }, { booking: {} }, { rest: {} }, { driver: { health: 0 } }])
    expect(Passenger.provisionPlan({ ...f.s, ...patch }, f.item, f.c).ok).toBe(false);
  f.s.driver.fatigue = 80; f.s.vehicle.fuelKm = 0; f.s.vehicle.condition = 40;
  expect(Passenger.provisionPlan(f.s, f.item, f.c).ok).toBe(true);
});
test('physical handoff receives once only after thirty attended seconds and exact reserved custody', () => {
  const f = fixture(), work = reserved(f), consume = item => { item.quantity--; return true; };
  const before = copy(f.s);
  expect(Passenger.receiveProvisions(f.s, f.item, f.c, { ...work, progress: 29 }, 'handoff:1', 30, consume)).toBe(false);
  expect(Passenger.receiveProvisions(f.s, f.item, { ...f.c, atStand: false }, work, 'handoff:1', 30, consume)).toBe(false);
  expect(Passenger.receiveProvisions(f.s, f.item, f.c, null, 'handoff:1', 30, consume)).toBe(false);
  expect(Passenger.receiveProvisions(f.s, { ...f.item, quantity: 2 }, f.c, work, 'handoff:1', 30, consume)).toBe(false);
  expect(Passenger.receiveProvisions(f.s, f.item, f.c, work, 'handoff:1', 30, () => false)).toBe(false);
  expect(f.s).toEqual(before);
  expect(Passenger.receiveProvisions(f.s, f.item, f.c, work, 'handoff:1', 30, consume)).toBe(true);
  expect(f.s.provisionsSeconds).toBe(14400); expect(f.item.quantity).toBe(0);
  expect(f.s.provisionReceipts[0]).toMatchObject({ id: 'handoff:1', stackId: 'actual-pack', quantity: 1, seconds: 14400, sourceLabels: ['Original paid supplies'], driverId: before.driver.id });
  const saved = copy(f), fresh = { ...f.item, quantity: 1 };
  expect(Passenger.receiveProvisions(saved.s, fresh, saved.c, work, 'handoff:1', 60, consume)).toBe(false); expect(fresh.quantity).toBe(1); expect(saved.s.provisionsSeconds).toBe(14400);
});
test('resupply restores no duty, health, fuel, condition, cargo capacity, personal needs or money', () => {
  const f = fixture(); f.s.driver.fatigue = 80; f.s.driver.health = 65; f.s.vehicle.fuelKm = 0; f.s.vehicle.condition = 40;
  const before = copy(f.s), needs = { thirst: 80, hunger: 60 }, wallet = { money: 20 };
  expect(Passenger.receiveProvisions(f.s, f.item, f.c, reserved(f), 'handoff:1', 30, i => { i.quantity--; return true; })).toBe(true);
  expect(f.s.driver).toEqual(before.driver); expect(f.s.vehicle).toEqual(before.vehicle); expect(needs).toEqual({ thirst: 80, hunger: 60 }); expect(wallet.money).toBe(20);
  expect(Passenger.reason(f.s, Passenger.quote(f.s, network(), 'city:b'), { kg: 0, l: 0 }, 1000)).toContain('not capable');
  f.s.driver.fatigue = 10; f.s.vehicle.condition = 70;
  expect(Passenger.reason(f.s, Passenger.quote(f.s, network(), 'city:b'), { kg: 0, l: 0 }, 1000)).toContain('Finite');
});
test('saved partial attendance excludes walking, blocked intervals and resumed backfill', () => {
  let work = { progress: 0, lastAt: 0, attendedAt: null };
  Passenger.advanceProvisionWork(work, 100, false); Passenger.advanceProvisionWork(work, 110, true); expect(work.progress).toBe(0);
  Passenger.advanceProvisionWork(work, 120, true); expect(work.progress).toBe(10); work = copy(work);
  Passenger.advanceProvisionWork(work, 120, true); expect(work.progress).toBe(10);
  Passenger.advanceProvisionWork(work, 200, false); Passenger.advanceProvisionWork(work, 1000, true); expect(work.progress).toBe(10);
  Passenger.advanceProvisionWork(work, 1019, true); expect(work.progress).toBe(29); Passenger.advanceProvisionWork(work, 9000, true); expect(work.progress).toBe(30);
});

async function start(page, renderer, depleted = true) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ source, renderer, depleted }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext(source);
    const s = d.exportSurveyExpeditionTestState(), pack = s.physicalItemStacks.find(i => i.section === 'inventory' && i.key === 'fieldRation' && !i.reservedTaskId);
    if (!pack || pack.quantity < 2) throw new Error('Missing original starting packs');
    // Carry the existing original departure stock, never fabricate food or a receipt.
    pack.carriedBy = 'scientist'; pack.roomId = s.scientist.roomId; pack.cell = s.scientist.mapCell; pack.fixtureId = ''; pack.stockpileId = '';
    if (depleted) { s.intercityPassenger.provisionsSeconds = 0; s.intercityPassenger.driver.fatigue = 64; s.intercityPassenger.driver.health = 80; s.intercityPassenger.vehicle.fuelKm = 0; s.intercityPassenger.vehicle.condition = 65; }
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
  }, { source: { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') } }, renderer, depleted });
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function finish(page) { await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
  const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
} throw new Error('Physical driver handoff did not finish'); }); }
const snap = page => page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
for (const renderer of ['dom', 'canvas']) test(`original ration slice, saved attended handoff, cancellation, cap and depleted return through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const before = await snap(page), pack = before.carried.find(i => i.key === 'fieldRation'), panel = page.locator('[data-intercity-passenger]');
  await expect(panel).toContainText('one owned carried field-ration pack gives four hours');
  await panel.getByRole('button', { name: `Hand Over One Field-Ration Pack (${pack.id})`, exact: true }).click();
  let queued = await snap(page), task = queued.tasks.find(t => t.data.action === 'passengerProvisions');
  expect(queued.carried.find(i => i.id === pack.id).quantity).toBe(pack.quantity - 1);
  expect(queued.carried.find(i => i.id === task.data.stackId)).toMatchObject({ quantity: 1, reservedTaskId: task.id });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(10)); await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const partial = await snap(page); expect(partial.carrier.provisionsSeconds).toBe(0); expect(partial.tasks.find(t => t.id === task.id).data.provisionWork.progress).toBe(10);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.driver.health = 0; d.importSurveyExpeditionTestState(s); d.advanceSimulation(120); });
  expect((await snap(page)).tasks.find(t => t.id === task.id).data.provisionWork.progress).toBe(10);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.driver.health = 80; d.importSurveyExpeditionTestState(s); d.advanceSimulation(1); });
  expect((await snap(page)).tasks.find(t => t.id === task.id).data.provisionWork.progress).toBe(10);
  await finish(page); const delivered = await snap(page), receipt = delivered.carrier.provisionReceipts[0];
  expect(receipt).toMatchObject({ stackId: task.data.stackId, seconds: 14400, quantity: 1, driverId: before.carrier.driver.id });
  expect(delivered.carrier.provisionsSeconds).toBe(14400 - (delivered.clock - receipt.at));
  expect(delivered.carrier.driver).toEqual(before.carrier.driver); expect(delivered.carrier.vehicle).toEqual(before.carrier.vehicle); expect(delivered.money).toBe(before.money);
  expect(delivered.carried.find(i => i.id === task.data.stackId)).toBeUndefined();
  expect(delivered.carried.filter(i => i.key === 'fieldRation').reduce((n, i) => n + i.quantity, 0)).toBe(pack.quantity - 1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); expect((await snap(page)).carrier.provisionReceipts).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.queuePassengerProvisions(id), pack.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5)); const cancel = await snap(page), cancelledTask = cancel.tasks.find(t => t.data.action === 'passengerProvisions');
  await panel.getByRole('button', { name: 'Cancel Unfinished Driver Ration Handoff', exact: true }).click();
  const cancelled = await snap(page); expect(cancelled.carried.find(i => i.id === cancelledTask.data.stackId)).toMatchObject({ carriedBy: 'scientist', quantity: 1, reservedTaskId: '' });
  expect(cancelled.carrier.provisionReceipts).toHaveLength(1); expect(cancelled.carrier.provisionsSeconds).toBe(cancel.carrier.provisionsSeconds);
  const rejected = await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.provisionsSeconds = 96 * 3600; d.importSurveyExpeditionTestState(s); return d.queuePassengerProvisions(id); }, cancelledTask.data.stackId);
  expect(rejected).toBe(false); expect((await snap(page)).carrier.provisionReceipts).toHaveLength(1); expect(errors).toEqual([]);
});
test('actual walking and changed ownership earn no handoff time or supplies', async ({ page }) => {
  test.setTimeout(300000); await start(page, 'dom');
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 15, y: 14, z: 6 } }))).toBeTruthy();
  await finish(page); const away = await snap(page), pack = away.carried.find(i => i.key === 'fieldRation');
  expect(await page.evaluate(id => window.helixHeresyDebug.queuePassengerProvisions(id), pack.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  const walking = await snap(page), task = walking.tasks.find(t => t.data.action === 'passengerProvisions');
  expect(task.data.provisionWork.progress).toBe(0); expect(walking.carrier.provisionsSeconds).toBe(0);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).cityOwnerId = 'a'; d.importSurveyExpeditionTestState(s); d.advanceSimulation(60);
  }, task.data.stackId);
  const blocked = await snap(page); expect(blocked.tasks.find(t => t.id === task.id).data.provisionWork.progress).toBe(0);
  expect(blocked.carrier.provisionsSeconds).toBe(0); expect(blocked.carried.find(i => i.id === task.data.stackId).quantity).toBe(1);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    delete s.physicalItemStacks.find(i => i.id === id).cityOwnerId; d.importSurveyExpeditionTestState(s);
  }, task.data.stackId);
  await finish(page); expect((await snap(page)).carrier.provisionReceipts).toHaveLength(1);
});
test('onward transfer binds the selected original, excludes remote delivery and freezes old-body work', async ({ page }) => {
  test.setTimeout(300000); await start(page, 'dom', false);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 5; n++) { const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return; const t = s.carrier.trip; d.advanceSimulation(t.seconds - t.progressSeconds + t.delaySeconds + 1); } });
  const occupied = await snap(page), packId = occupied.carried.find(i => i.key === 'fieldRation').id;
  expect(await page.evaluate(id => window.helixHeresyDebug.queuePassengerProvisions(id), packId)).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.provisionsSeconds = 0; d.importSurveyExpeditionTestState(s); });
  const selected = await snap(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.queuePassengerProvisions(id), packId)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(10)); const partial = await snap(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(false);
  expect(partial.connection.otherCarrier.provisionsSeconds).toBe(selected.connection.otherCarrier.provisionsSeconds - 10);
  await finish(page); const done = await snap(page);
  expect(done.carrier.provisionReceipts[0].driverId).toBe('branch:b:passenger-driver'); expect(done.connection.otherCarrier.provisionReceipts).toBeUndefined();
  expect(done.connection.otherCarrier.vehicle).toEqual(selected.connection.otherCarrier.vehicle);
  const remaining = done.carried.find(i => i.key === 'fieldRation').id;
  expect(await page.evaluate(id => window.helixHeresyDebug.queuePassengerProvisions(id), remaining)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5)); const alive = await snap(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100000); });
  const dead = await snap(page); expect(dead.carrier).toEqual(alive.carrier); expect(dead.connection).toEqual(alive.connection);
  expect(dead.tasks.find(t => t.data.action === 'passengerProvisions').data.provisionWork).toEqual(alive.tasks.find(t => t.data.action === 'passengerProvisions').data.provisionWork);
});
