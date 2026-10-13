const { test, expect } = require('@playwright/test');
const Servicing = require('../toolkit-servicing');
const Maintenance = require('../passenger-maintenance');
const Recovery = require('../mechanic-recovery');
const Carrier = require('../local-exchange-carrier');
const Passenger = require('../intercity-passenger');
const Fuel = require('../passenger-fuel');
const Production = require('../local-market-production');
const { pathToFileURL } = require('url');
const path = require('path');
const copy = x => JSON.parse(JSON.stringify(x));
const city = id => ({ cityId: id, currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = id => [{ network: { category: 'transport' }, standing: 'licensed', branch: {
  id: `branch:${id}`, cityId: id, publicName: `City ${id} Transport`, capacityBand: 'functional', operationalStatus: 'active' } }];
function fixture(id = 'a') {
  const fleet = Carrier.create(id), support = Carrier.support(fleet, 0), s = Passenger.create(city(id), standings(id), 0);
  const m = support.passengerMaintenance = Maintenance.create(city(id), standings(id), 0);
  m.toolkit.condition = 0; s.vehicle.condition = 65;
  return { fleet, support, s, wallet: { money: 1000 }, c: { local: true, atStand: true, sameBody: true, alive: true,
    capable: true, free: true, busy: false, bodyEpoch: 0, sourceCurrent: true, distanceKm: 4, stand: { roomId: 'stand', cell: { x: 1, y: 1, z: 0 } } } };
}
const mechanic = f => f.support.passengerMaintenance;
const order = f => mechanic(f).toolkitService;
const advance = (f, at) => Servicing.advance(f.support, f.c, at);
const cancel = (f, at) => Servicing.cancel(f.support, f.c, f.wallet, at);
function request(f, at = 0) {
  const q = Servicing.quote(f.s, f.support, f.c, at); expect(q).toBeTruthy();
  expect(Servicing.request(f.s, f.support, f.c, q, f.wallet, at)).toBe(true); return q;
}
function reload(f) { const saved = copy(f); saved.support = saved.fleet.support; return saved; }

test('toolkit exact terms accept exhausted wear and cap restoration without changing original assets', () => {
  const f = fixture(), before = copy(f);
  expect(Servicing.quote(f.s, f.support, f.c, 0)).toMatchObject({ total: 15, parts: 1, workSeconds: 3600,
    partPrice: 5, laborPrice: 10, condition: 0, gain: 25, mechanicId: 'branch:a:callout-mechanic', toolkitId: 'branch:a:mechanic-toolkit' });
  expect(f).toEqual(before); mechanic(f).toolkit.condition = 94;
  expect(Servicing.quote(f.s, f.support, f.c, 0).gain).toBe(6);
  for (const condition of [100, -1, NaN]) { mechanic(f).toolkit.condition = condition; expect(Servicing.quote(f.s, f.support, f.c, 0)).toBeNull(); }
});
test('toolkit quotes require local attendance, original finite mechanic, returned tools, parts and free workshop', () => {
  for (const flag of ['local', 'atStand', 'sameBody', 'alive', 'capable', 'free', 'sourceCurrent']) {
    const f = fixture(); f.c[flag] = false; expect(Servicing.quote(f.s, f.support, f.c, 0)).toBeNull();
  }
  const changes = [f => f.c.busy = true, f => f.s.location = 'b', f => f.s.booking = {}, f => f.s.rest = {},
    f => f.support.parts = 0, f => mechanic(f).workSeconds = 3599, f => mechanic(f).actor.fatigue = 74,
    f => mechanic(f).actor.health = 49, f => mechanic(f).actor.status = 'dead', f => mechanic(f).actor.qualification = 'none',
    f => mechanic(f).actor.location = 'road', f => mechanic(f).actor.positionKm = 1, f => mechanic(f).actor.carriedParts = 1,
    f => mechanic(f).job = {}, f => mechanic(f).recovery = {}, f => f.support.workshop = {},
    f => f.support.supplier.passengerService = {}, f => f.support.supplier.mechanicService = 'busy',
    f => f.support.supplier.shipment = {}, f => f.support.supplier.repairAt = 1, f => f.support.supplier.maintenanceReservedBy = 'busy'];
  for (const change of changes) { const f = fixture(); change(f); expect(Servicing.quote(f.s, f.support, f.c, 0)).toBeNull(); }
});
test('toolkit payment and part reservation are atomic against stale quotes, expiry and insufficient funds', () => {
  for (const change of [f => f.wallet.money = 14, f => mechanic(f).toolkit.condition = 1,
    f => mechanic(f).toolkit.id = 'replacement', f => mechanic(f).actor.id = 'replacement', f => f.c.bodyEpoch = 1,
    f => f.support.parts = 0]) {
    const f = fixture(), q = Servicing.quote(f.s, f.support, f.c, 0); change(f); const before = copy(f);
    expect(Servicing.request(f.s, f.support, f.c, q, f.wallet, 0)).toBe(false); expect(f).toEqual(before);
  }
  const f = fixture(), q = Servicing.quote(f.s, f.support, f.c, 0), before = copy(f);
  expect(Servicing.request(f.s, f.support, f.c, q, f.wallet, 60)).toBe(false); expect(f).toEqual(before);
  request(f); expect(f.wallet.money).toBe(985); expect(f.support.parts).toBe(5); expect(mechanic(f).toolkit.condition).toBe(0);
  expect(order(f).cargo).toMatchObject({ quantity: 1, custody: 'workshop', sourceCityId: 'a' });
  expect(Servicing.request(f.s, f.support, f.c, q, f.wallet, 0)).toBe(false);
});
test('toolkit progressive original work conserves supplies, cents and duty across absence and reload exactly once', () => {
  let f = fixture(); const before = copy(f); request(f); Servicing.observe(mechanic(f), f.c); const report = copy(mechanic(f).toolkitServiceObservation);
  f.c.local = false; f.c.atStand = false; f.c.capable = false; f.c.busy = true; advance(f, 1800);
  expect(mechanic(f).toolkit.condition).toBe(12.5); expect(mechanic(f).workSeconds).toBe(27000); expect(mechanic(f).actor.fatigue).toBe(3);
  expect(order(f)).toMatchObject({ partsUsed: 1, laborPaidCents: 500, escrowCents: 500, progress: 1800 });
  expect(f.support.money).toBe(1010); expect(f.support.parts).toBe(5); f = reload(f); advance(f, 3600);
  expect(order(f)).toBeNull(); expect(mechanic(f).toolkit.condition).toBe(25); expect(mechanic(f).workSeconds).toBe(25200);
  expect(mechanic(f).actor.fatigue).toBe(6); expect(mechanic(f).actor.health).toBe(100); expect(mechanic(f).actor.id).toBe(before.support.passengerMaintenance.actor.id);
  expect(f.s).toEqual(before.s); expect(f.support.supplier.vehicle).toEqual(before.support.supplier.vehicle);
  expect(f.support.money).toBe(1015); expect(f.support.revenue).toBe(15); expect(f.wallet.money).toBe(985);
  expect(f.support.supplier.maintenanceReservedBy).toBeUndefined();
  Servicing.observe(mechanic(f), f.c); expect(mechanic(f).toolkitServiceObservation).toEqual(report);
  const finished = copy(f); advance(f, 99999); expect(f).toEqual(finished); expect(mechanic(f).toolkitServiceHistory).toHaveLength(1);
  f.c.local = true; f.c.atStand = true; f.c.capable = true; f.c.busy = false;
  expect(Servicing.observe(mechanic(f), f.c)).toMatchObject({ completed: true, at: 3600 });
  expect(Maintenance.quote(f.s, f.support, f.c, 3600)).toBeTruthy();
});
test('toolkit high-condition servicing stops at the original cap and spends the full agreed hour', () => {
  const f = fixture(); mechanic(f).toolkit.condition = 94; request(f); advance(f, 1800); expect(mechanic(f).toolkit.condition).toBe(97);
  advance(f, 7200); expect(mechanic(f).toolkit.condition).toBe(100); expect(mechanic(f).workSeconds).toBe(25200);
  expect(mechanic(f).toolkitServiceHistory[0].receipt.restoredCondition).toBe(6); expect(Servicing.quote(f.s, f.support, f.c, 7200)).toBeNull();
});
test('toolkit cancellation returns only physically unused stock and unearned payment without repeated refunds', () => {
  let f = fixture(); request(f); expect(cancel(f, 0)).toBe(true); expect(f.wallet.money).toBe(1000); expect(f.support.parts).toBe(6);
  expect(mechanic(f).toolkit.condition).toBe(0); expect(f.support.money).toBe(1000); expect(cancel(f, 0)).toBe(false);
  f = fixture(); request(f); advance(f, 900); f = reload(f); expect(cancel(f, 900)).toBe(true);
  expect(mechanic(f).toolkit.condition).toBe(6.25); expect(mechanic(f).workSeconds).toBe(27900); expect(mechanic(f).actor.fatigue).toBe(1.5);
  expect(f.wallet.money).toBe(992.5); expect(f.support.parts).toBe(5); expect(f.support.money).toBe(1007.5);
  expect(mechanic(f).toolkitServiceHistory[0]).toMatchObject({ refund: 7.5, cancelled: true, partsUsed: 1 });
  const before = copy(f); advance(f, 3600); expect(cancel(f, 3600)).toBe(false); expect(f).toEqual(before);
});
test('toolkit original source, injury and custody holds preserve work and never backfill unavailable intervals', () => {
  for (const change of [f => f.c.sourceCurrent = false, f => mechanic(f).actor.health = 49,
    f => mechanic(f).workSeconds = 0, f => mechanic(f).actor.fatigue = 80,
    f => mechanic(f).toolkit.id = 'replacement', f => mechanic(f).toolkit.condition = 90,
    f => order(f).cargo.quantity = 0, f => f.support.workshop = { vehicleId: 'other' }, f => f.c.bodyEpoch = 1]) {
    const f = fixture(); request(f); change(f); advance(f, 3600);
    expect(order(f).progress).toBe(0); expect(order(f).escrowCents).toBe(1500); expect(Servicing.nextEvent(f.support, f.c, 3600)).toBeNull();
  }
  const f = fixture(); request(f); mechanic(f).actor.health = 49; advance(f, 7200); mechanic(f).actor.health = 100;
  advance(f, 10800); expect(order(f).progress).toBe(0); advance(f, 12600); expect(order(f).progress).toBe(1800);
  expect(mechanic(f).toolkit.condition).toBe(12.5);
});
test('toolkit shared workshop excludes vehicle repairs, supplied recovery, refuelling and automatic workshop reuse', () => {
  const f = fixture(); request(f);
  expect(Maintenance.quote(f.s, f.support, f.c, 0)).toBeNull(); expect(Fuel.quote(f.s, f.support.supplier, f.c, 100, 0)).toBeNull();
  const market = { id: 'a', treasury: 100, listings: { fieldRation: { supply: 50, demand: 1 }, drinkingWater: { supply: 40, demand: 1 } } };
  const defs = [{ id: 'fieldRation', buyable: true, basePrice: 12, supply: 50 }, { id: 'drinkingWater', buyable: true, basePrice: 4, supply: 40 }];
  expect(Recovery.quote(f.s, f.support, market, defs, { ...f.c, metrics: { fieldRation: { massKg: 1, volumeL: 1 }, drinkingWater: { massKg: 1, volumeL: 1 } } }, 0)).toBeNull();
  f.fleet.vehicles[0].condition = 60; Carrier.advanceSupport(f.fleet, 100); expect(f.support.workshop).toBeNull();
  expect(f.fleet.vehicles[0].condition).toBe(60); expect(f.support.parts).toBe(5);
  f.support.supplier.repairAt = 1; f.support.supplier.vehicle.condition = 60;
  Carrier.advanceSupport(f.fleet, 200); expect(f.support.supplier.vehicle.condition).toBe(60);
});
test('toolkit checkpoints, dated reports, death and replacement-body guards preserve original service', () => {
  const f = fixture(); request(f); expect(Servicing.nextEvent(f.support, f.c, 0)).toMatchObject({ time: 3600, type: 'travel' });
  advance(f, 60); Servicing.observe(mechanic(f), f.c); expect(mechanic(f).toolkitServiceObservation.at).toBe(0);
  f.c.local = false; expect(Servicing.nextEvent(f.support, f.c, 60)).toBeNull(); f.c.local = true;
  f.c.bodyEpoch = 1; f.c.sameBody = false; expect(cancel(f, 60)).toBe(false); advance(f, 120); expect(order(f).progress).toBe(60);
  f.c.alive = false; const before = copy(f); advance(f, 99999); expect(cancel(f, 99999)).toBe(false); expect(f).toEqual(before);
});

const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] });
const snap = page => page.evaluate(() => window.helixHeresyDebug.toolkitServicingSnapshot());
async function start(page, renderer, onward = false) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const f = fixture(); f.fleet.cityId = 'city:a'; f.fleet.preparedMaintenanceTestSource = { city: city('a'), standings: standings('a') };
  const neighborFleet = fixture('b').fleet; neighborFleet.preparedMaintenanceTestSource = { city: city('b'), standings: standings('b') };
  await page.evaluate(({ source, fleet, renderer, neighbor }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext(source); const s = d.exportSurveyExpeditionTestState();
    s.economy.exchangeCarrier = fleet; s.intercityPassenger.vehicle.condition = 65;
    if (neighbor) s.economy.commodityMarket.intercityTrade = { homeId: 'a', homeTreasury: 10000, homeReserveFraction: .6, homeProfile: {},
      neighbors: [neighbor], operators: [], shipments: [], nextNumber: 1, ledger: [], lastAt: s.clock };
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
  }, { source: { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') } }, fleet: f.fleet, renderer,
    neighbor: onward ? { id: 'b', profile: { cityId: 'b', listings: {} }, treasury: 10000, reserveFraction: .6, listings: {}, reports: [],
      production: Production.create({ cityId: 'b', workshopCapacity: 0, listings: {}, productionSources: [] }, 0), carrier: neighborFleet } : null });
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`toolkit controls preserve original servicing through absence and reload in ${renderer}`, async ({ page }) => {
  test.setTimeout(180000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const panel = page.locator('[data-toolkit-servicing]'), before = await snap(page); expect(before.quote.total).toBe(15);
  await panel.getByRole('button', { name: 'Request Toolkit Servicing ($15)', exact: true }).click();
  const paid = await snap(page); expect(paid.money).toBe(before.money - 15); expect(paid.support.parts).toBe(before.support.parts - 1);
  expect(paid.support.passengerMaintenance.toolkit.condition).toBe(0);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-mechanic-recovery]').getByRole('button', { name: /^Request Supplied Mechanic Recovery/ })).toBeDisabled();
  expect((await page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceSnapshot())).quote).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 15, y: 14, z: 6 } }))).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(1800));
  let partial = await snap(page); expect(partial.context.atStand).toBe(false); expect(partial.support.passengerMaintenance.toolkit.condition).toBe(12.5);
  const report = copy(partial.support.passengerMaintenance.toolkitServiceObservation);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(1800));
  const finished = await snap(page); expect(finished.support.passengerMaintenance.toolkitService).toBeNull();
  expect(finished.support.passengerMaintenance.toolkit.condition).toBe(25); expect(finished.support.passengerMaintenance.workSeconds).toBe(25200);
  expect(finished.support.passengerMaintenance.actor.fatigue).toBeCloseTo(6, 10); expect(finished.support.passengerMaintenance.toolkitServiceHistory).toHaveLength(1);
  expect(finished.support.passengerMaintenance.toolkitServiceObservation).toEqual(report); expect(finished.carrier.vehicle.condition).toBe(65);
  expect(finished.support.passengerMaintenance.toolkit.id).toBe(before.support.passengerMaintenance.toolkit.id);
  expect(await page.evaluate(cell => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell }), before.context.stand.cell)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(60));
  await expect(panel).toContainText('Original toolkit servicing completed');
  const ready = await page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceSnapshot()); expect(ready.quote.total).toBe(40);
  expect(await page.evaluate(q => window.helixHeresyDebug.passengerMaintenanceAction('request', q), ready.quote)).toBe(true);
  expect((await snap(page)).support.passengerMaintenance.job.quote.toolkitId).toBe(before.support.passengerMaintenance.toolkit.id);
  expect(errors).toEqual([]);
});
test('toolkit cancellation controls refund unearned work and scientist death freezes the saved job', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom'); const before = await snap(page), panel = page.locator('[data-toolkit-servicing]');
  await panel.getByRole('button', { name: 'Request Toolkit Servicing ($15)', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(900));
  await panel.getByRole('button', { name: 'Cancel Unfinished Toolkit Servicing', exact: true }).click();
  const canceled = await snap(page); expect(canceled.money).toBe(before.money - 7.5); expect(canceled.support.passengerMaintenance.toolkit.condition).toBe(6.25);
  expect(canceled.support.passengerMaintenance.toolkitService).toBeNull();
  await panel.getByRole('button', { name: 'Request Toolkit Servicing ($15)', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(120)); const running = await snap(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advancePassengerMaintenanceTestTime(100000); });
  const dead = await snap(page); expect(dead.support).toEqual(running.support); expect(dead.money).toBe(running.money);
  expect(await page.evaluate(() => window.helixHeresyDebug.toolkitServicingAction('cancel'))).toBe(false);
});
test('toolkit controls use reached-city original stock and keep service running after local carrier selection', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom', true);
  const finish = () => page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
    d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
  } throw new Error('Physical passenger task did not finish'); });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish();
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 5; n++) {
    const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return;
    const t = s.carrier.trip; d.advanceSimulation(t.seconds - t.progressSeconds + t.delaySeconds + 1);
  } });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish();
  const before = await snap(page); expect(before.quote).toMatchObject({ cityId: 'b', mechanicId: 'branch:b:callout-mechanic', toolkitId: 'branch:b:mechanic-toolkit' });
  await page.locator('[data-toolkit-servicing]').getByRole('button', { name: 'Request Toolkit Servicing ($15)', exact: true }).click();
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(3600));
  const completed = await snap(page); expect(completed.support.passengerMaintenance.toolkitService).toBeNull();
  expect(completed.support.passengerMaintenance.toolkit.condition).toBe(25); expect(completed.support.parts).toBe(before.support.parts - 1);
  const home = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().economy.exchangeCarrier.support);
  expect(home.passengerMaintenance.toolkit.condition).toBe(0); expect(home.parts).toBe(6);
  expect(completed.support.passengerMaintenance.toolkitServiceHistory[0].quote.toolkitId).toBe(before.quote.toolkitId);
});
