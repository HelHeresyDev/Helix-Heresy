const { test, expect } = require('@playwright/test');
const Recovery = require('../mechanic-recovery');
const Maintenance = require('../passenger-maintenance');
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
const defs = [{ id: 'fieldRation', buyable: true, basePrice: 12, supply: 50 }, { id: 'drinkingWater', buyable: true, basePrice: 4, supply: 40 }];
function fixture(id = 'a') {
  const fleet = Carrier.create(id), support = Carrier.support(fleet, 0), s = Passenger.create(city(id), standings(id), 0);
  const m = support.passengerMaintenance = Maintenance.create(city(id), standings(id), 0);
  m.workSeconds = 0; m.actor.fatigue = 48; m.toolkit.condition = 80; s.vehicle.condition = 65;
  return { fleet, support, s, market: { id, treasury: 1000, listings: { fieldRation: { supply: 50, demand: 1 }, drinkingWater: { supply: 40, demand: 1 } } },
    wallet: { money: 1000 }, c: { local: true, atStand: true, sameBody: true, alive: true, capable: true, free: true, busy: false,
      bodyEpoch: 0, sourceCurrent: true, distanceKm: 4, metrics: { fieldRation: { massKg: 1, volumeL: 1 }, drinkingWater: { massKg: 1, volumeL: 1 } } } };
}
const mechanic = f => f.support.passengerMaintenance;
const order = f => mechanic(f).recovery;
const advance = (f, at) => Recovery.advance(f.support, f.market, f.c, f.wallet, at);
function request(f, at = 0) { const q = Recovery.quote(f.s, f.support, f.market, defs, f.c, at); expect(q).toBeTruthy();
  expect(Recovery.request(f.s, f.support, f.market, defs, f.c, q, f.wallet, at)).toBe(true); return q; }
function reload(f) { const saved = copy(f); saved.support = saved.fleet.support; return saved; }
function deliver(f) {
  advance(f, 480); advance(f, 481); advance(f, 1081); advance(f, 1082); advance(f, 1562); advance(f, 1563); advance(f, 1623);
  expect(order(f).phase).toBe('resting'); expect(order(f).progress).toBe(0); advance(f, 1624);
}
test('exact recovery terms bind current local food/water prices, original assets and finite carrying/endurance', () => {
  const f = fixture(), before = copy(f); expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 0)).toMatchObject({
    total: 46, handling: 10, restSeconds: 28800, deliverySeconds: 1620, mechanicId: 'branch:a:callout-mechanic', supplierVehicleId: 'a:supply-truck', massKg: 4 });
  expect(f).toEqual(before);
  for (const flag of ['local', 'atStand', 'sameBody', 'alive', 'capable', 'free', 'sourceCurrent'])
    expect(Recovery.quote(f.s, f.support, f.market, defs, { ...f.c, [flag]: false }, 0)).toBeNull();
  for (const key of ['fieldRation', 'drinkingWater']) { const old = f.market.listings[key].supply; f.market.listings[key].supply = 1;
    expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 0)).toBeNull(); f.market.listings[key].supply = old; }
  expect(Recovery.quote(f.s, f.support, { ...f.market, id: 'b' }, defs, f.c, 0)).toBeNull();
  for (const patch of [{ shipment: {} }, { passengerService: {} }, { repairAt: 1 }, { routeOpen: false }, { maintenanceReservedBy: 'other' }])
    expect(Recovery.quote(f.s, { ...f.support, supplier: { ...f.support.supplier, ...patch } }, f.market, defs, f.c, 0)).toBeNull();
  f.support.supplier.vehicle.capacityKg = 3; expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 0)).toBeNull();
  f.support.supplier.vehicle.capacityKg = 48; f.support.supplier.vehicle.fuelKm = 15; expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 0)).toBeNull();
  f.support.supplier.vehicle.fuelKm = 120; mechanic(f).actor.health = 49; expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 0)).toBeNull();
});
test('request reserves original exchange cargo and payment once; stale price, stock and identity quotes fail atomically', () => {
  const f = fixture(), q = Recovery.quote(f.s, f.support, f.market, defs, f.c, 0), before = copy(f);
  for (const [expected, at] of [[q, 60], [{ ...q, total: 1 }, 1], [{ ...q, supplierDriverId: 'replacement' }, 1]]) {
    expect(Recovery.request(f.s, f.support, f.market, defs, f.c, expected, f.wallet, at)).toBe(false); expect(f).toEqual(before);
  }
  f.market.listings.fieldRation.demand = 1.5;
  expect(Recovery.request(f.s, f.support, f.market, defs, f.c, q, f.wallet, 1)).toBe(false); f.market.listings.fieldRation.demand = 1;
  request(f); expect(f.wallet.money).toBe(954); expect(f.support.money).toBe(1010); expect(f.market.treasury).toBe(1000);
  expect(f.market.listings.fieldRation.supply).toBe(48); expect(f.market.listings.drinkingWater.supply).toBe(38);
  expect(order(f).cargo.every(g => g.custody === 'exchange')).toBe(true); expect(mechanic(f).workSeconds).toBe(0);
  expect(Recovery.request(f.s, f.support, f.market, defs, f.c, q, f.wallet, 1)).toBe(false);
});
test('original truck physically collects and delivers with conserved fuel, wear, handling duty and saved holds', () => {
  let f = fixture(); request(f); advance(f, 240); expect(order(f).positionKm).toBe(2); expect(f.support.supplier.vehicle.fuelKm).toBe(118);
  f = reload(f); f.support.supplier.routeOpen = false; advance(f, 10000); expect(order(f).positionKm).toBe(2);
  f.support.supplier.routeOpen = true; advance(f, 20000); expect(order(f).positionKm).toBe(2); advance(f, 20240);
  expect(order(f).phase).toBe('collecting'); expect(order(f).cargo.every(g => g.custody === 'exchange')).toBe(true);
  advance(f, 20241); advance(f, 20841); expect(order(f).phase).toBe('inbound'); expect(order(f).cargo.every(g => g.custody === 'truck')).toBe(true);
  advance(f, 20842); advance(f, 21322); advance(f, 21323); advance(f, 21383);
  expect(order(f).phase).toBe('resting'); expect(mechanic(f).workSeconds).toBe(0); expect(f.support.supplier.vehicle.fuelKm).toBe(112);
  expect(f.support.supplier.vehicle.condition).toBeCloseTo(99.84); expect(f.support.supplier.vehicle.driver.fatigue).toBeCloseTo(1.42);
});
test('eight supplied off-duty hours restore only original bounded duty and fatigue, independently and once across reload', () => {
  let f = fixture(); const original = copy(f.s), toolkit = copy(mechanic(f).toolkit), actorId = mechanic(f).actor.id; request(f); deliver(f);
  Recovery.observe(mechanic(f), f.c); const report = copy(mechanic(f).recoveryObservation);
  f.c.local = false; f.c.atStand = false; f.c.capable = false; f.c.busy = true; f.support.supplier.routeOpen = false;
  advance(f, 16024); expect(order(f).progress).toBe(14400); expect(order(f).cargo.map(g => g.consumed)).toEqual([1, 1]);
  expect(mechanic(f).workSeconds).toBe(0); expect(mechanic(f).actor.fatigue).toBe(48); expect(f.market.treasury).toBe(1018);
  expect(Recovery.observe(mechanic(f), f.c)).toEqual(report); f = reload(f); advance(f, 30424);
  expect(mechanic(f).recovery).toBeNull(); expect(mechanic(f).workSeconds).toBe(28800); expect(mechanic(f).actor.fatigue).toBe(18);
  expect(mechanic(f).actor.id).toBe(actorId); expect(mechanic(f).toolkit).toEqual(toolkit); expect(f.s).toEqual(original);
  expect(f.market.treasury).toBe(1036); expect(f.support.money).toBe(1010); expect(f.support.supplier.mechanicService).toBeUndefined();
  expect(mechanic(f).recoveryHistory).toHaveLength(1); advance(f, 99999); expect(mechanic(f).recoveryHistory).toHaveLength(1);
});
test('partial rest pauses on original mechanic incapacity without backfill, healing, toolkit repair or free recovery', () => {
  const f = fixture(); request(f); deliver(f); advance(f, 2624); mechanic(f).actor.health = 49; advance(f, 100000);
  expect(order(f).progress).toBe(1000); mechanic(f).actor.health = 80; advance(f, 200000); expect(order(f).progress).toBe(1000);
  advance(f, 227800); expect(mechanic(f).workSeconds).toBe(28800); expect(mechanic(f).actor.health).toBe(80); expect(mechanic(f).toolkit.condition).toBe(80);
  mechanic(f).actor.fatigue = 0; expect(Recovery.quote(f.s, f.support, f.market, defs, f.c, 227800)).toBeNull();
});
test('cancel before pickup releases only original source reservation after actual truck return; handling remains spent', () => {
  let f = fixture(); request(f); advance(f, 240); expect(Recovery.cancel(f.support, f.c, 240)).toBe(true);
  expect(f.wallet.money).toBe(954); expect(f.market.listings.fieldRation.supply).toBe(48); f = reload(f);
  advance(f, 360); expect(f.wallet.money).toBe(954); advance(f, 480);
  expect(f.wallet.money).toBe(990); expect(f.market.listings.fieldRation.supply).toBe(50); expect(mechanic(f).recovery).toBeNull();
  expect(mechanic(f).workSeconds).toBe(0); advance(f, 99999); expect(f.wallet.money).toBe(990);
});
test('partial cancellation consumes no further rest and physically returns only unused workshop goods before refund', () => {
  let f = fixture(); request(f); deliver(f); advance(f, 16024); expect(Recovery.cancel(f.support, f.c, 16024)).toBe(true);
  expect(order(f).cargo.map(g => g.quantity)).toEqual([1, 1]); expect(f.wallet.money).toBe(954); expect(f.market.listings.fieldRation.supply).toBe(48);
  advance(f, 16084); advance(f, 16085); advance(f, 16565); advance(f, 16566);
  expect(f.wallet.money).toBe(954); f = reload(f); advance(f, 16626);
  expect(f.wallet.money).toBe(972); expect(f.market.listings.fieldRation.supply).toBe(49); expect(f.market.listings.drinkingWater.supply).toBe(39);
  expect(f.support.supplier.mechanicService).toBeTruthy(); advance(f, 16627); advance(f, 17107);
  expect(mechanic(f).recovery).toBeNull(); expect(mechanic(f).workSeconds).toBe(0); expect(mechanic(f).actor.fatigue).toBe(48);
  expect(mechanic(f).recoveryHistory[0]).toMatchObject({ cancelled: true, progress: 14400, refund: 18 });
  advance(f, 99999); expect(f.wallet.money).toBe(972);
});
test('death freezes exact original delivery/rest and replacement bodies cannot recover or cancel old orders', () => {
  const f = fixture(); request(f); advance(f, 240); f.c.alive = false; const before = copy(f); advance(f, 100000); expect(f).toEqual(before);
  expect(Recovery.cancel(f.support, f.c, 100000)).toBe(false); f.c.alive = true; f.c.sameBody = false; f.c.bodyEpoch = 1; advance(f, 100001);
  expect(order(f).positionKm).toBe(2); expect(Recovery.cancel(f.support, f.c, 100001)).toBe(false); expect(mechanic(f).workSeconds).toBe(0);
  const other = fixture(); request(other); other.support.supplier.vehicle.driver.id = 'replacement'; advance(other, 10000); expect(order(other).positionKm).toBe(0);
});
test('original truck and mechanic reservation blocks overlapping fuel/depot maintenance, free rest and operating topups', () => {
  const f = fixture(); request(f); f.fleet.fuelReserveKm = 0; f.support.parts = 0; f.fleet.vehicles[0].condition = 70;
  f.support.supplier.vehicle.driver.fatigue = 20; f.support.supplier.vehicle.condition = 70; f.support.supplier.operatingFuelKm = 0;
  const v = copy(f.support.supplier.vehicle); Carrier.advanceSupport(f.fleet, 3600);
  expect(f.support.supplier.shipment).toBeNull(); expect(f.support.workshop).toBeNull(); expect(f.support.supplier.vehicle).toEqual(v);
  const production = Production.create({ cityId: 'a', workshopCapacity: 0, listings: {}, productionSources: [] }, 0);
  Production.advance(production, 3600, {}, f.support.supplier); expect(f.support.supplier.repairAt).toBeFalsy(); expect(f.support.supplier.operatingFuelKm).toBe(0);
  f.s.vehicle.fuelKm = 0; expect(Fuel.quote(f.s, f.support.supplier, { ...f.c, stand: {} }, 100, 3600)).toBeNull();
  expect(Maintenance.quote(f.s, f.support, { ...f.c, stand: {} }, 3600)).toBeNull();
});
test('checkpoints and reports use local original-body records, while rest can continue without the scientist', () => {
  const f = fixture(); request(f); const initial = Recovery.observe(mechanic(f), f.c);
  expect(Recovery.nextEvent(f.support, f.market, f.c, 0).time).toBe(480); advance(f, 240);
  expect(Recovery.observe(mechanic(f), f.c)).toEqual(initial); expect(Recovery.nextEvent(f.support, f.market, { ...f.c, local: false }, 240)).toBeNull();
  f.support.supplier.routeOpen = false; expect(Recovery.nextEvent(f.support, f.market, f.c, 240)).toBeNull();
});

const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] });
const snap = page => page.evaluate(() => window.helixHeresyDebug.mechanicRecoverySnapshot());
async function start(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const f = fixture(); f.fleet.cityId = 'city:a'; f.fleet.preparedMaintenanceTestSource = { city: city('a'), standings: standings('a') };
  const production = Production.create({ cityId: 'a', workshopCapacity: 0, listings: {}, productionSources: [] }, 0); production.finance.exchangeMoney = 1000;
  await page.evaluate(({ source, fleet, renderer, production }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext(source); const s = d.exportSurveyExpeditionTestState();
    s.economy.exchangeCarrier = fleet; s.intercityPassenger.vehicle.condition = 65; s.intercityPassenger.vehicle.fuelKm = 0;
    s.economy.commodityMarket.cityContext = { cityId: 'a', cityName: 'City a', listings: {} };
    s.economy.commodityMarket.localProduction = production;
    s.economy.commodityMarket.intercityTrade = null;
    s.economy.commodityMarket.listings.fieldRation.supply = 50; s.economy.commodityMarket.listings.fieldRation.demand = 1;
    s.economy.commodityMarket.listings.drinkingWater.supply = 40; s.economy.commodityMarket.listings.drinkingWater.demand = 1;
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
  }, { source: { network: network(), city: city('a'), standings: standings('a') }, fleet: f.fleet, renderer, production });
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`supplied recovery delivery, saved absence and another original repair through ${renderer}`, async ({ page }) => {
  test.setTimeout(180000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const panel = page.locator('[data-mechanic-recovery]'), before = await snap(page); expect(before.quote.total).toBe(46);
  await panel.getByRole('button', { name: 'Request Supplied Mechanic Recovery', exact: true }).click();
  let paid = await snap(page); expect(paid.money).toBe(before.money - 46); expect(paid.market.listings.fieldRation.supply).toBe(48);
  expect(paid.support.passengerMaintenance.workSeconds).toBe(0); expect(paid.support.passengerMaintenance.recovery.cargo[0].custody).toBe('exchange');
  expect((await page.evaluate(() => window.helixHeresyDebug.passengerFuelSnapshot())).quote).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(2100));
  const delivered = await snap(page); expect(delivered.support.passengerMaintenance.recovery.phase).toBe('resting');
  expect(delivered.support.passengerMaintenance.workSeconds).toBe(0); await expect(panel).toContainText('eight supplied off-duty hours now begin');
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 15, y: 14, z: 6 } }))).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(60));
  const away = await snap(page), report = copy(away.support.passengerMaintenance.recoveryObservation);
  expect(away.context.atStand).toBe(false); await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(28800));
  const complete = await snap(page); expect(complete.support.passengerMaintenance.recovery).toBeNull();
  expect(complete.support.passengerMaintenance.workSeconds).toBe(28800); expect(complete.support.passengerMaintenance.actor.fatigue).toBe(18);
  expect(complete.support.passengerMaintenance.recoveryObservation).toEqual(report); expect(complete.support.passengerMaintenance.toolkit.condition).toBe(80);
  expect(complete.carrier.vehicle.condition).toBe(65); expect(complete.carrier.vehicle.fuelKm).toBe(0); expect(complete.market.treasury).toBe(1036);
  expect(await page.evaluate(cell => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell }), before.context.stand.cell)).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(60));
  await expect(panel).toContainText('Eight supplied off-duty hours completed');
  const ready = await page.evaluate(() => window.helixHeresyDebug.passengerMaintenanceSnapshot()); expect(ready.quote.total).toBe(40);
  expect(await page.evaluate(q => window.helixHeresyDebug.passengerMaintenanceAction('request', q), ready.quote)).toBe(true);
  expect((await snap(page)).support.passengerMaintenance.job.quote.mechanicId).toBe(before.support.passengerMaintenance.actor.id);
  expect(errors).toEqual([]);
});
test('physical unused-provision return and frozen death are available through the recovery controls', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom'); const before = await snap(page), panel = page.locator('[data-mechanic-recovery]');
  await panel.getByRole('button', { name: 'Request Supplied Mechanic Recovery', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(240));
  await panel.getByRole('button', { name: 'Cancel Unfinished Mechanic Recovery', exact: true }).click();
  expect((await snap(page)).money).toBe(before.money - 46); await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(240));
  const canceled = await snap(page); expect(canceled.money).toBe(before.money - 10); expect(canceled.market.listings.fieldRation.supply).toBe(50);
  expect(canceled.support.passengerMaintenance.workSeconds).toBe(0);
  await panel.getByRole('button', { name: 'Request Supplied Mechanic Recovery', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advancePassengerMaintenanceTestTime(120)); const running = await snap(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advancePassengerMaintenanceTestTime(100000); });
  const dead = await snap(page); expect(dead.support).toEqual(running.support); expect(dead.market).toEqual(running.market); expect(dead.money).toBe(running.money);
  expect(await page.evaluate(() => window.helixHeresyDebug.mechanicRecoveryAction('cancel'))).toBe(false);
});
