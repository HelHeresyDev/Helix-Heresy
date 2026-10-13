const { test, expect } = require('@playwright/test');
const Repair = require('../passenger-maintenance');
const Carrier = require('../local-exchange-carrier');
const Passenger = require('../intercity-passenger');
const Fuel = require('../passenger-fuel');
const Production = require('../local-market-production');
const path = require('path');
const { pathToFileURL } = require('url');
const copy = x => JSON.parse(JSON.stringify(x));
const city = id => ({ cityId: id, assetId: `city:${id}`, currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = id => [{ network: { id: `transport:${id}`, category: 'transport' }, standing: 'licensed', branch: {
  id: `branch:${id}`, cityId: id, publicName: `City ${id} Passenger Depot`, capacityBand: 'functional', operationalStatus: 'active' } }];
function fixture() {
  const fleet = Carrier.create('a'), support = Carrier.support(fleet, 0), s = Passenger.create(city('a'), standings('a'), 0);
  support.passengerMaintenance = Repair.create(city('a'), standings('a'), 0); s.vehicle.condition = 65; s.vehicle.fuelKm = 0;
  s.driver.health = 80; s.driver.fatigue = 64;
  return { fleet, support, s, wallet: { money: 100 }, c: { local: true, atStand: true, sameBody: true, alive: true,
    capable: true, free: true, busy: false, sourceCurrent: true, bodyEpoch: 0, distanceKm: 4, stand: { roomId: 'stand', cell: { x: 1, y: 1, z: 6 } } } };
}
function request(f, at = 0) {
  const q = Repair.quote(f.s, f.support, f.c, at); expect(q).toBeTruthy();
  expect(Repair.request(f.s, f.support, f.c, q, f.wallet, at)).toBe(true); return q;
}
const advance = (f, at) => Repair.advance(f.s, f.support, f.c, f.wallet, at);
const mechanic = f => f.support.passengerMaintenance;
function reload(f) { const saved = copy(f); saved.support = saved.fleet.support; return saved; }
test('qualified mechanic requires actual local population and branch backing; no unsupported person is allocated', () => {
  const row = city('a'), source = standings('a'), before = copy({ row, source });
  expect(Repair.create(row, source, 0)).toMatchObject({ source: { cityId: 'a', branchId: 'branch:a', populationId: 'city:a', people: 1 },
    actor: { id: 'branch:a:callout-mechanic', qualification: 'roadVehicleMaintenance' }, workSeconds: 28800 });
  expect({ row, source }).toEqual(before);
  expect(Repair.create(row, standings('b'), 0)).toBeNull();
  for (const patch of [{ currentPopulation: 0 }, { physicalCondition: 'ruined' }, { habitationStatus: 'abandoned' }, { services: { transport: 'failed' } }])
    expect(Repair.create({ ...row, ...patch }, source, 0)).toBeNull();
  expect(Repair.create(row, [{ ...source[0], standing: 'unrecognized' }], 0)).toBeNull();
});
test('exact routine repair terms require two real parts, free workshop, finite qualified duty and toolkit', () => {
  const f = fixture(), before = copy(f), q = Repair.quote(f.s, f.support, f.c, 0);
  expect(q).toMatchObject({ total: 40, callout: 20, partsPrice: 10, laborPrice: 10, parts: 2, gain: 25, workSeconds: 7200, seconds: 14400 });
  expect(f).toEqual(before);
  for (const flag of ['local', 'atStand', 'sameBody', 'alive', 'capable', 'free', 'sourceCurrent'])
    expect(Repair.quote(f.s, f.support, { ...f.c, [flag]: false }, 0)).toBeNull();
  for (const condition of [0, 100, NaN]) expect(Repair.quote({ ...f.s, vehicle: { ...f.s.vehicle, condition } }, f.support, f.c, 0)).toBeNull();
  expect(Repair.quote(f.s, { ...f.support, parts: 1 }, f.c, 0)).toBeNull();
  expect(Repair.quote(f.s, { ...f.support, workshop: {} }, f.c, 0)).toBeNull();
  for (const patch of [{ routeOpen: false }, { maintenanceReservedBy: 'other' }, { passengerService: {} }, { repairAt: 1 }])
    expect(Repair.quote(f.s, { ...f.support, supplier: { ...f.support.supplier, ...patch } }, f.c, 0)).toBeNull();
  mechanic(f).workSeconds = 14399; expect(Repair.quote(f.s, f.support, f.c, 0)).toBeNull(); mechanic(f).workSeconds = 28800;
  mechanic(f).toolkit.condition = 7; expect(Repair.quote(f.s, f.support, f.c, 0)).toBeNull(); mechanic(f).toolkit.condition = 100;
  mechanic(f).actor.capacityKg = 9; expect(Repair.quote(f.s, f.support, f.c, 0)).toBeNull(); mechanic(f).actor.capacityKg = 16;
  mechanic(f).actor.qualification = 'driver'; expect(Repair.quote(f.s, f.support, f.c, 0)).toBeNull();
});
test('payment commits original terms once without instant repair; stale and changed quotes are atomic refusals', () => {
  const f = fixture(), before = copy(f), q = Repair.quote(f.s, f.support, f.c, 0);
  for (const [expected, at] of [[q, 60], [{ ...q, total: 1 }, 1], [{ ...q, mechanicId: 'replacement' }, 1]]) {
    expect(Repair.request(f.s, f.support, f.c, expected, f.wallet, at)).toBe(false); expect(f).toEqual(before);
  }
  request(f); expect(f.wallet.money).toBe(60); expect(f.support.parts).toBe(4); expect(f.s.vehicle.condition).toBe(65);
  expect(mechanic(f).actor.carriedParts).toBe(2); expect(mechanic(f).job.escrowCents).toBe(2000); expect(f.support.money).toBe(1020);
  expect(Repair.request(f.s, f.support, f.c, q, f.wallet, 1)).toBe(false); expect(f.wallet.money).toBe(60);
});
test('actual saved walking consumes original duty and fatigue; closed roads hold without retroactive work', () => {
  let f = fixture(); request(f); advance(f, 1800); expect(mechanic(f).actor.positionKm).toBe(2);
  expect(mechanic(f).workSeconds).toBe(27000); expect(mechanic(f).actor.fatigue).toBe(3);
  f = reload(f); f.support.supplier.routeOpen = false; advance(f, 10000); expect(mechanic(f).actor.positionKm).toBe(2);
  f.support.supplier.routeOpen = true; advance(f, 20000); expect(mechanic(f).actor.positionKm).toBe(2);
  advance(f, 21800); expect(mechanic(f).job.phase).toBe('repairing'); expect(f.s.vehicle.condition).toBe(65);
  expect(mechanic(f).actor.location).toBe(`passenger stand:${f.s.vehicle.id}`); expect(mechanic(f).actor.carriedParts).toBe(2);
});
test('two hours of authorized repair proceed during absence, cap condition and never restore other resources', () => {
  let f = fixture(); f.s.vehicle.condition = 90; const original = copy(f.s); request(f);
  Repair.observe(mechanic(f), f.c, 0); const report = copy(mechanic(f).observation);
  advance(f, 3600); advance(f, 3601); f.c.local = false; f.c.atStand = false; f.c.busy = true; f.c.capable = false;
  advance(f, 7201); expect(f.s.vehicle.condition).toBe(95); expect(mechanic(f).job.partsUsed).toBe(1);
  expect(mechanic(f).job.escrowCents).toBe(1000); expect(Repair.observe(mechanic(f), f.c, 7201)).toEqual(report);
  f = reload(f); advance(f, 10801); expect(f.s.vehicle.condition).toBe(100); expect(f.s.maintenanceReceipts).toHaveLength(1);
  expect(f.s.maintenanceReceipts[0]).toMatchObject({ restoredCondition: 10, partsUsed: 2, total: 40, mechanicId: 'branch:a:callout-mechanic' });
  expect(f.s.driver).toEqual(original.driver); expect(f.s.vehicle.fuelKm).toBe(original.vehicle.fuelKm);
  expect(f.s.provisionsSeconds).toBe(original.provisionsSeconds); expect(mechanic(f).toolkit.condition).toBeCloseTo(92.8);
  expect(f.support.money).toBeCloseTo(1040); expect(f.support.supplier.maintenanceReservedBy).toBeTruthy();
  advance(f, 14401); expect(mechanic(f).job).toBeNull(); expect(mechanic(f).actor.location).toBe('workshop');
  expect(mechanic(f).actor.fatigue).toBe(24); expect(mechanic(f).workSeconds).toBe(14400); expect(f.support.parts).toBe(4);
  expect(f.support.supplier.maintenanceReservedBy).toBeUndefined(); advance(f, 99999); expect(f.s.maintenanceReceipts).toHaveLength(1);
});
test('partial cancellation retains actual improvements and spent parts; unused stock and escrow return physically once', () => {
  let f = fixture(); request(f); advance(f, 3600); advance(f, 3601); advance(f, 7201);
  expect(f.s.vehicle.condition).toBe(77.5); expect(Repair.cancel(f.support, f.c, 7201)).toBe(true);
  expect(f.support.parts).toBe(4); expect(f.wallet.money).toBe(60); expect(Repair.cancel(f.support, f.c, 7201)).toBe(false);
  f = reload(f); advance(f, 9001); expect(f.wallet.money).toBe(60); expect(mechanic(f).actor.positionKm).toBe(2);
  advance(f, 10801); expect(f.wallet.money).toBe(70); expect(f.support.parts).toBe(5); expect(f.s.vehicle.condition).toBe(77.5);
  expect(mechanic(f).history[0]).toMatchObject({ cancelled: true, progress: 3600, partsUsed: 1, refund: 10 });
  expect(f.s.maintenanceReceipts).toBeUndefined(); advance(f, 99999); expect(f.wallet.money).toBe(70);
  const untouched = fixture(); request(untouched); advance(untouched, 1800); Repair.cancel(untouched.support, untouched.c, 1800);
  advance(untouched, 3600); expect(untouched.wallet.money).toBe(80); expect(untouched.support.parts).toBe(6); expect(untouched.support.money).toBe(1020);
});
test('exhausted repair tools cannot produce more work but do not strand an able returning mechanic', () => {
  const f = fixture(); mechanic(f).toolkit.condition = 7.2; request(f);
  advance(f, 3600); advance(f, 3601); advance(f, 10801); expect(mechanic(f).toolkit.condition).toBeCloseTo(0);
  expect(f.s.vehicle.condition).toBe(90); advance(f, 14401); expect(mechanic(f).job).toBeNull();
  expect(mechanic(f).actor.location).toBe('workshop'); expect(Repair.quote(f.s, f.support, f.c, 14401)).toBeNull();
});
test('changed vehicle, body, cargo, qualifications or tools hold repair; death freezes original work', () => {
  const f = fixture(); request(f); advance(f, 3600); advance(f, 3601);
  f.c.alive = false; const before = copy(f); advance(f, 100000); expect(f).toEqual(before); expect(Repair.cancel(f.support, f.c, 100000)).toBe(false);
  f.c.alive = true; f.c.bodyEpoch = 1; f.c.sameBody = false; advance(f, 100001); expect(f.s.vehicle.condition).toBe(65);
  expect(Repair.cancel(f.support, f.c, 100001)).toBe(false); f.c.bodyEpoch = 0; f.c.sameBody = true;
  f.s.vehicle.condition = 60; advance(f, 100002); expect(mechanic(f).job.progress).toBe(0); f.s.vehicle.condition = 65;
  mechanic(f).actor.qualification = 'unqualified'; advance(f, 100003); expect(mechanic(f).job.progress).toBe(0);
  mechanic(f).actor.qualification = 'roadVehicleMaintenance'; mechanic(f).toolkit.condition = 0; advance(f, 100004); expect(mechanic(f).job.progress).toBe(0);
  mechanic(f).toolkit.condition = 100; mechanic(f).job.cargo.quantity = 0; mechanic(f).actor.carriedParts = 0;
  advance(f, 100005); advance(f, 100006); expect(mechanic(f).job.partsUsed).toBe(0); expect(f.support.money).toBe(1020);
  const capacity = fixture(); request(capacity); mechanic(capacity).actor.capacityKg = 9; advance(capacity, 1800);
  expect(mechanic(capacity).actor.positionKm).toBe(0); expect(mechanic(capacity).actor.carriedParts).toBe(2);
  const dimensions = fixture(); request(dimensions); mechanic(dimensions).job.cargo.unitMassKg = 0; advance(dimensions, 1800);
  expect(mechanic(dimensions).actor.positionKm).toBe(0); expect(mechanic(dimensions).actor.carriedParts).toBe(2);
});
test('shared workshop reservation excludes fuel calls and automatic repairs, not conserved depot deliveries', () => {
  const f = fixture(); request(f); f.fleet.vehicles[0].condition = 70; f.support.supplier.vehicle.condition = 70;
  Carrier.advanceSupport(f.fleet, 3600); expect(f.support.workshop).toBeNull(); expect(f.fleet.vehicles[0].condition).toBe(70);
  expect(Fuel.quote(f.s, f.support.supplier, f.c, 100, 3600)).toBeNull();
  const production = Production.create({ cityId: 'a', workshopCapacity: 0, listings: {}, productionSources: [] }, 0);
  Production.advance(production, 3600, {}, f.support.supplier); expect(f.support.supplier.repairAt).toBeFalsy();
  const delivery = fixture(); request(delivery); delivery.support.parts = 0; Carrier.advanceSupport(delivery.fleet, 1);
  expect(delivery.support.supplier.shipment.parts).toBe(12); expect(delivery.support.supplier.partsStock).toBe(68);
  Carrier.advanceSupport(delivery.fleet, 1081); expect(delivery.support.parts).toBe(12); expect(mechanic(delivery).job.cargo.quantity).toBe(2);
});
test('checkpoints and dated observations expose physical local progress, never away intelligence or free replenishment', () => {
  const f = fixture(); request(f); expect(Repair.nextEvent(f.s, f.support, f.c, 0).time).toBe(3600);
  const report = Repair.observe(mechanic(f), f.c, 0); advance(f, 1800);
  expect(Repair.observe(mechanic(f), f.c, 1800)).toEqual(report);
  expect(Repair.nextEvent(f.s, f.support, { ...f.c, local: false }, 1800)).toBeNull();
  advance(f, 3600); expect(Repair.nextEvent(f.s, f.support, f.c, 3600).time).toBe(3601);
  advance(f, 3601); expect(Repair.nextEvent(f.s, f.support, f.c, 3601).time).toBe(10801);
  mechanic(f).workSeconds = 0; expect(Repair.nextEvent(f.s, f.support, f.c, 3601)).toBeNull();
  Carrier.advanceSupport(f.fleet, 99999); expect(mechanic(f).workSeconds).toBe(0); expect(Repair.quote(f.s, f.support, f.c, 99999)).toBeNull();
});

const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] });
const snap = page => page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceSnapshot());
async function start(page, renderer, onward = false) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const fleet = Carrier.create('city:a'); fleet.preparedMaintenanceTestSource = { city: city('a'), standings: standings('a') };
  const neighborFleet = Carrier.create('b'); neighborFleet.preparedMaintenanceTestSource = { city: city('b'), standings: standings('b') };
  await page.evaluate(({ source, fleet, renderer, neighbor }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext(source); const s = d.exportSurveyExpeditionTestState();
    s.economy.exchangeCarrier = fleet; s.intercityPassenger.vehicle.condition = 65; s.intercityPassenger.vehicle.fuelKm = 0;
    s.intercityPassenger.driver.health = 80; s.intercityPassenger.driver.fatigue = 64;
    if (neighbor) {
      s.intercityPassenger.vehicle.fuelKm = 400;
      s.economy.commodityMarket.intercityTrade = { homeId: 'a', homeTreasury: 10000, homeReserveFraction: .6, homeProfile: {},
        neighbors: [neighbor], operators: [], shipments: [], nextNumber: 1, ledger: [], lastAt: s.clock };
    }
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
  }, { source: { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') } }, fleet, renderer,
    neighbor: onward ? { id: 'b', profile: { cityId: 'b', listings: {} }, treasury: 10000, reserveFraction: .6, listings: {}, reports: [],
      production: Production.create({ cityId: 'b', workshopCapacity: 0, listings: {}, productionSources: [] }, 0), carrier: neighborFleet } : null });
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`original paid mechanic, independent repair, reload and partial cancellation through ${renderer}`, async ({ page }) => {
  test.setTimeout(180000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const panel = page.locator('[data-passenger-maintenance]'), before = await snap(page); expect(before.quote.total).toBe(40);
  await expect(panel).toContainText('two hours of actual repair');
  await panel.getByRole('button', { name: 'Request Routine Vehicle Maintenance ($40)', exact: true }).click();
  let paid = await snap(page); expect(paid.money).toBe(before.money - 40); expect(paid.carrier.vehicle.condition).toBe(65);
  expect(paid.support.parts).toBe(4); expect(paid.support.passengerMaintenance.job.quote.mechanicId).toBe(before.support.passengerMaintenance.actor.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  expect((await page.evaluate(() => window.helixHeresyDebug.passengerFuelSnapshot())).quote).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect((await snap(page)).support.passengerMaintenance.actor.positionKm).toBeGreaterThan(0);
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3540));
  expect((await snap(page)).support.passengerMaintenance.job.phase).toBe('repairing');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(7260));
  const repaired = await snap(page); expect(repaired.carrier.vehicle.condition).toBe(90); expect(repaired.carrier.maintenanceReceipts).toHaveLength(1);
  expect(repaired.carrier.vehicle.fuelKm).toBe(0); expect(repaired.carrier.driver).toEqual(before.carrier.driver);
  await expect(panel).toContainText('repair completion received');
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3600));
  const returned = await snap(page); expect(returned.support.passengerMaintenance.job).toBeNull(); expect(returned.support.passengerMaintenance.actor.fatigue).toBeCloseTo(24);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await panel.getByRole('button', { name: 'Request Routine Vehicle Maintenance ($40)', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(7260));
  const partial = await snap(page); expect(partial.carrier.vehicle.condition).toBe(95);
  await panel.getByRole('button', { name: 'Cancel Unfinished Vehicle Maintenance', exact: true }).click();
  expect((await snap(page)).money).toBe(before.money - 80);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3600));
  const canceled = await snap(page); expect(canceled.money).toBe(before.money - 70); expect(canceled.carrier.vehicle.condition).toBe(95);
  expect(canceled.support.passengerMaintenance.actor.id).toBe(before.support.passengerMaintenance.actor.id);
  expect(canceled.support.passengerMaintenance.history.at(-1).refund).toBe(10); expect(canceled.carrier.maintenanceReceipts).toHaveLength(1);
  expect(canceled.quote).toBeNull(); expect(errors).toEqual([]);
});
test('personal walking leaves independently authorized repairs running with dated reports, not remote completion knowledge', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom'); const initial = await snap(page);
  expect(await page.evaluate(q => window.helixHeresyDebug.passengerMaintenanceAction('request', q), initial.quote)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3600));
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 15, y: 14, z: 6 } }))).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  const away = await snap(page); expect(away.context.atStand).toBe(false); const report = away.support.passengerMaintenance.observation;
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3300));
  const progress = await snap(page); expect(progress.carrier.vehicle.condition).toBeGreaterThan(away.carrier.vehicle.condition);
  expect(progress.support.passengerMaintenance.observation).toEqual(report);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).support.passengerMaintenance).toEqual(progress.support.passengerMaintenance);
  expect(await page.evaluate(cell => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell }), initial.context.stand.cell)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  const returned = await snap(page); expect(returned.context.atStand).toBe(true);
  expect(returned.support.passengerMaintenance.observation.at).toBeGreaterThan(report.at);
  const expectedRefund = returned.support.passengerMaintenance.job.escrowCents / 100;
  expect(await page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceAction('cancel'))).toBe(true);
  const canceled = await snap(page); await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3600));
  const final = await snap(page); expect(final.carrier.vehicle.condition).toBe(canceled.carrier.vehicle.condition);
  expect(final.money).toBeCloseTo(initial.money - 40 + expectedRefund); expect(final.support.passengerMaintenance.job).toBeNull();
});
test('reached neighbor uses its original local mechanic and depot, refuses switching and freezes work on death', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom', true);
  const finish = () => page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
  } throw new Error('Physical passenger task did not finish'); });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish();
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 5; n++) { const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return;
    const t = s.carrier.trip; d.advanceSimulation(t.seconds - t.progressSeconds + t.delaySeconds + 1); } });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish();
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.vehicle.condition = 65; d.importSurveyExpeditionTestState(s); });
  const before = await snap(page); expect(before.quote).toMatchObject({ cityId: 'b', mechanicId: 'branch:b:callout-mechanic', vehicleId: 'branch:b:passenger-road-car' });
  expect(await page.evaluate(q => window.helixHeresyDebug.passengerMaintenanceAction('request', q), before.quote)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  const partial = await snap(page); expect(partial.support.parts).toBe(before.support.parts - 2);
  const home = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().economy.exchangeCarrier.support);
  expect(home.passengerMaintenance.job).toBeNull(); expect(home.parts).toBe(6);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advancePassengerMaintenanceTestTime(100000); });
  const dead = await snap(page); expect(dead.support).toEqual(partial.support); expect(dead.carrier).toEqual(partial.carrier);
  expect(dead.money).toBe(partial.money); expect(await page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceAction('cancel'))).toBe(false);
});
