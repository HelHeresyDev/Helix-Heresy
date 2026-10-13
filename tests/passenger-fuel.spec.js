const { test, expect } = require('@playwright/test');
const Fuel = require('../passenger-fuel');
const Carrier = require('../local-exchange-carrier');
const Passenger = require('../intercity-passenger');
const Production = require('../local-market-production');
const path = require('path');
const { pathToFileURL } = require('url');
const copy = x => JSON.parse(JSON.stringify(x));
const city = id => ({ cityId: id, assetId: `city:${id}`, currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = id => [{ network: { id: `transport:${id}`, category: 'transport' }, standing: 'licensed', branch: { id: `branch:${id}`, cityId: id, publicName: `City ${id} Passenger Depot`, capacityBand: 'functional', operationalStatus: 'active' } }];
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b', 'c'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [ { id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'bc', endpointCityIds: ['b', 'c'], supportCapable: true, continuity: 'continuous', distanceKm: 2 } ] });
function fixture() {
  const fleet = Carrier.create('a'), support = Carrier.support(fleet, 0), s = Passenger.create(city('a'), standings('a'), 0); s.vehicle.fuelKm = 0;
  return { fleet, support, supplier: support.supplier, s, wallet: { money: 100 }, c: { local: true, atStand: true, sameBody: true, alive: true,
    capable: true, free: true, busy: false, sourceCurrent: true, bodyEpoch: 0, distanceKm: 4, stand: { roomId: 'stand', cell: { x: 1, y: 1, z: 6 } } } };
}
function request(f, amount = 100) { const q = Fuel.quote(f.s, f.supplier, f.c, amount, 0); expect(q).toBeTruthy(); expect(Fuel.request(f.s, f.supplier, f.c, q, f.wallet, f.support, 0)).toBe(true); return q; }
const advance = (f, at) => Fuel.advance(f.s, f.supplier, f.c, f.wallet, f.support, at);
test('fuel terms disclose exact 100/200/400 allocations, pricing, original cap and real source constraints', () => {
  const f = fixture(), before = copy(f);
  expect(Fuel.quote(f.s, f.supplier, f.c, 100, 0)).toMatchObject({ amount: 100, total: 25, handling: 20, rate: .05, seconds: 1080, vehicleId: f.s.vehicle.id });
  expect(Fuel.quote(f.s, f.supplier, f.c, 200, 0).total).toBe(30); expect(Fuel.quote(f.s, f.supplier, f.c, 400, 0).total).toBe(40);
  expect(f).toEqual(before);
  for (const flag of ['local', 'atStand', 'sameBody', 'alive', 'capable', 'free', 'sourceCurrent']) expect(Fuel.quote(f.s, f.supplier, { ...f.c, [flag]: false }, 100, 0)).toBeNull();
  expect(Fuel.quote(f.s, f.supplier, { ...f.c, busy: true }, 100, 0)).toBeNull();
  for (const amount of [0, 99, 500, NaN]) expect(Fuel.quote(f.s, f.supplier, f.c, amount, 0)).toBeNull();
  for (const patch of [{ routeOpen: false }, { fuelStockKm: 99 }, { shipment: {} }, { repairAt: 20 }]) expect(Fuel.quote(f.s, { ...f.supplier, ...patch }, f.c, 100, 0)).toBeNull();
  f.s.vehicle.fuelKm = 2300; expect(Fuel.quote(f.s, f.supplier, f.c, 100, 0)).toBeTruthy();
  f.s.vehicle.fuelKm++; expect(Fuel.quote(f.s, f.supplier, f.c, 100, 0)).toBeNull();
});
test('payment reserves stock and the same truck once, never adding fuel on payment or accepting stale terms', () => {
  const f = fixture(), original = copy(f); const q = Fuel.quote(f.s, f.supplier, f.c, 100, 0);
  for (const [expected, at] of [[q, 60], [{ ...q, total: 1 }, 1], [{ ...q, supplierDriverId: 'replacement' }, 1]]) {
    expect(Fuel.request(f.s, f.supplier, f.c, expected, f.wallet, f.support, at)).toBe(false); expect(f).toEqual(original);
  }
  request(f); expect(f.s.vehicle.fuelKm).toBe(0); expect(f.wallet.money).toBe(75); expect(f.supplier.fuelStockKm).toBe(7900);
  expect(f.supplier.passengerService).toMatchObject({ cargoKm: 100, escrow: 5, phase: 'outbound' }); expect(f.support.money).toBe(1020);
  expect(Fuel.request(f.s, f.supplier, f.c, q, f.wallet, f.support, 1)).toBe(false); expect(f.wallet.money).toBe(75);
});
test('saved road progress spends real truck fuel, wear and duty; holds resume without backfill or emergency fuel', () => {
  let f = fixture(); request(f); advance(f, 240); expect(f.supplier.passengerService.positionKm).toBe(2); expect(f.supplier.vehicle.fuelKm).toBe(118);
  f = copy(f); f.supplier = f.fleet.support.supplier; f.support = f.fleet.support;
  f.supplier.routeOpen = false; advance(f, 1000); expect(f.supplier.passengerService.positionKm).toBe(2);
  f.supplier.routeOpen = true; advance(f, 2000); expect(f.supplier.passengerService.positionKm).toBe(2);
  advance(f, 2240); expect(f.supplier.passengerService.phase).toBe('transfer'); expect(f.s.vehicle.fuelKm).toBe(0);
  expect(f.supplier.vehicle.condition).toBeCloseTo(99.92); expect(f.supplier.vehicle.driver.fatigue).toBeCloseTo(.16);
  const depleted = fixture(); request(depleted); depleted.supplier.vehicle.fuelKm = 0; advance(depleted, 10000);
  expect(depleted.supplier.passengerService.positionKm).toBe(0); expect(depleted.supplier.vehicle.fuelKm).toBe(0); expect(depleted.supplier.operatingFuelKm).toBe(800);
});
test('two attended minutes recheck original body, stand, carrier and tank; interruptions reload without duplicate transfer', () => {
  let f = fixture(); request(f); const original = copy(f.s); advance(f, 480); advance(f, 481); advance(f, 541);
  expect(f.supplier.passengerService.progress).toBe(60); expect(f.s.vehicle.fuelKm).toBe(0);
  f = copy(f); f.supplier = f.fleet.support.supplier; f.support = f.fleet.support;
  f.c.atStand = false; advance(f, 10000); f.c.atStand = true; advance(f, 10001); expect(f.supplier.passengerService.progress).toBe(60);
  f.c.bodyEpoch = 1; advance(f, 10100); expect(f.s.vehicle.fuelKm).toBe(0); f.c.bodyEpoch = 0; advance(f, 10101); advance(f, 10161);
  expect(f.s.vehicle.fuelKm).toBe(100); expect(f.s.fuelReceipts).toHaveLength(1); expect(f.s.fuelReceipts[0]).toMatchObject({ amount: 100, supplierDriverId: 'a:supply-driver', total: 25 });
  expect(f.s.driver).toEqual(original.driver); expect(f.s.provisionsSeconds).toBe(original.provisionsSeconds);
  expect(f.s.vehicle.condition).toBe(original.vehicle.condition); expect(f.s.vehicle.cargoKg).toBe(original.vehicle.cargoKg);
  expect(f.support.money).toBe(1025); advance(f, 10641); expect(f.supplier.passengerService).toBeNull(); expect(f.supplier.vehicle.location).toBe('supplier');
  advance(f, 99999); expect(f.s.vehicle.fuelKm).toBe(100); expect(f.s.fuelReceipts).toHaveLength(1); expect(f.wallet.money).toBe(75);
});
test('cancelled unused fuel and escrow return only with the actual truck; spent handling and transferred fuel are never refunded', () => {
  const f = fixture(); request(f); advance(f, 240); expect(Fuel.cancel(f.supplier, f.c, 240)).toBe(true);
  expect(Fuel.cancel(f.supplier, f.c, 240)).toBe(false); expect(f.wallet.money).toBe(75); expect(f.supplier.fuelStockKm).toBe(7900);
  advance(f, 241); advance(f, 360); expect(f.wallet.money).toBe(75); advance(f, 600);
  expect(f.wallet.money).toBe(80); expect(f.supplier.fuelStockKm).toBe(8000); expect(f.supplier.vehicle.fuelKm).toBe(116);
  expect(f.s.vehicle.fuelKm).toBe(0); expect(f.supplier.passengerHistory[0]).toMatchObject({ phase: 'returned', cancelled: true, refund: 5 });
  advance(f, 1000); expect(f.wallet.money).toBe(80);
  const delivered = fixture(); request(delivered); advance(delivered, 480); advance(delivered, 481); advance(delivered, 601);
  expect(Fuel.cancel(delivered.supplier, delivered.c, 601)).toBe(false); advance(delivered, 1081); expect(delivered.wallet.money).toBe(75);
});
test('original supplier lock prevents overlapping depot delivery, free rest, maintenance and operating top-ups', () => {
  const f = fixture(); request(f); f.fleet.fuelReserveKm = 0; f.supplier.vehicle.driver.fatigue = 30; f.supplier.vehicle.condition = 70; f.supplier.operatingFuelKm = 0;
  const before = copy(f.supplier.vehicle); Carrier.advanceSupport(f.fleet, 3600);
  expect(f.supplier.shipment).toBeNull(); expect(f.supplier.vehicle).toEqual(before);
  const state = Production.create({ cityId: 'a', workshopCapacity: 0, listings: {}, productionSources: [] }, 0);
  Production.advance(state, 3600, {}, f.supplier); expect(f.supplier.repairAt).toBeFalsy(); expect(f.supplier.operatingFuelKm).toBe(0);
  expect(f.supplier.vehicle).toEqual(before); expect(f.supplier.passengerService.cargoKm).toBe(100);
});
test('death freezes the exact original service and replacement bodies cannot receive or cancel its handoff', () => {
  const f = fixture(); request(f); advance(f, 100); f.c.alive = false; const before = copy(f);
  advance(f, 100000); expect(f).toEqual(before); expect(Fuel.cancel(f.supplier, f.c, 100000)).toBe(false);
  f.c.alive = true; f.c.bodyEpoch = 1; f.c.sameBody = false; advance(f, 100480); advance(f, 100481); advance(f, 100999);
  expect(f.s.vehicle.fuelKm).toBe(0); expect(Fuel.cancel(f.supplier, f.c, 100999)).toBe(false);
});
test('changed selected carrier, supplier identity and tank room preserve original fuel custody', () => {
  const f = fixture(); request(f); advance(f, 480); advance(f, 481);
  f.c.stand.cell.x = 2; advance(f, 600); expect(f.s.vehicle.fuelKm).toBe(0); expect(f.supplier.passengerService.progress).toBe(0); f.c.stand.cell.x = 1;
  const different = copy(f.s); different.vehicle.id = 'other original';
  Fuel.advance(different, f.supplier, f.c, f.wallet, f.support, 1000); expect(different.vehicle.fuelKm).toBe(0); expect(f.s.vehicle.fuelKm).toBe(0);
  f.s.vehicle.fuelKm = 2350; advance(f, 2000); expect(f.s.vehicle.fuelKm).toBe(2350); expect(f.supplier.passengerService.cargoKm).toBe(100);
  f.supplier.vehicle.driver.id = 'replacement'; advance(f, 3000); expect(f.supplier.passengerService.progress).toBe(0);
});
test('next service checkpoint covers real travel and attendance, never absent, held or dead-body work', () => {
  const f = fixture(); request(f); expect(Fuel.nextEvent(f.s, f.supplier, f.c, 0).time).toBe(480);
  expect(Fuel.nextEvent(f.s, f.supplier, { ...f.c, local: false }, 0)).toBeNull();
  f.supplier.routeOpen = false; expect(Fuel.nextEvent(f.s, f.supplier, f.c, 0)).toBeNull(); f.supplier.routeOpen = true;
  advance(f, 480); expect(Fuel.nextEvent(f.s, f.supplier, f.c, 480).time).toBe(481);
  advance(f, 481); expect(Fuel.nextEvent(f.s, f.supplier, f.c, 481).time).toBe(601);
  expect(Fuel.nextEvent(f.s, f.supplier, { ...f.c, atStand: false }, 481)).toBeNull();
  expect(Fuel.nextEvent(f.s, f.supplier, { ...f.c, alive: false }, 481)).toBeNull();
});

async function start(page, renderer, onward = false) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ source, fleet, renderer, neighbor }) => {
    const d = window.helixHeresyDebug; d.setIntercityPassengerTestContext(source);
    const s = d.exportSurveyExpeditionTestState(); s.economy.exchangeCarrier = fleet;
    s.intercityPassenger.vehicle.fuelKm = 0; s.intercityPassenger.vehicle.condition = 65; s.intercityPassenger.driver.fatigue = 64; s.intercityPassenger.driver.health = 80;
    if (neighbor) {
      // Allocate the original B supplier before departure, never as a rescue outcome.
      s.intercityPassenger.vehicle.fuelKm = 400;
      s.economy.commodityMarket.intercityTrade = { homeId: 'a', homeTreasury: 10000, homeReserveFraction: .6, homeProfile: {},
        neighbors: [neighbor], operators: [], shipments: [], nextNumber: 1, ledger: [], lastAt: s.clock };
    }
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
  }, { source: { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') } }, fleet: Carrier.create('city:a'), renderer,
    neighbor: onward ? { id: 'b', profile: { cityId: 'b', listings: {} }, treasury: 10000, reserveFraction: .6, listings: {}, reports: [],
      production: Production.create({ cityId: 'b', workshopCapacity: 0, listings: {}, productionSources: [] }, 0), carrier: Carrier.create('b') } : null });
  await page.locator('[data-workspace-tab="visits"]').click();
}
const snap = page => page.evaluate(() => window.helixHeresyDebug.passengerFuelSnapshot());
for (const renderer of ['dom', 'canvas']) test(`paid original fuel truck, saved interrupted transfer and physical cancellation through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const before = await snap(page), panel = page.locator('[data-passenger-fuel]'); expect(before.quote.total).toBe(25);
  await expect(panel).toContainText('Handling is spent on dispatch');
  await panel.getByRole('button', { name: 'Request 100-km Fuel Service ($25)', exact: true }).click();
  const paid = await snap(page); expect(paid.money).toBe(before.money - 25); expect(paid.carrier.vehicle.fuelKm).toBe(0);
  expect(paid.supplier.fuelStockKm).toBe(before.supplier.fuelStockKm - 100); expect(paid.supplier.passengerService.quote.supplierDriverId).toBe(before.supplier.vehicle.driver.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(500));
  const arrived = await snap(page); expect(arrived.supplier.passengerService.phase).toBe('transfer'); expect(arrived.supplier.passengerService.progress).toBeLessThan(120);
  expect(arrived.carrier.vehicle.fuelKm).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.economy.exchangeCarrier.support.supplier.routeOpen = false; d.importSurveyExpeditionTestState(s); d.advanceSimulation(60); });
  expect((await snap(page)).supplier.passengerService.progress).toBe(arrived.supplier.passengerService.progress);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.economy.exchangeCarrier.support.supplier.routeOpen = true; d.importSurveyExpeditionTestState(s); d.advanceSimulation(1); });
  expect((await snap(page)).supplier.passengerService.progress).toBe(arrived.supplier.passengerService.progress);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(121));
  const delivered = await snap(page); expect(delivered.carrier.vehicle.fuelKm).toBe(100); expect(delivered.carrier.fuelReceipts).toHaveLength(1);
  expect(delivered.carrier.driver).toEqual(before.carrier.driver); expect(delivered.carrier.vehicle.condition).toBe(65); expect(delivered.carrier.vehicle.cargoKg).toBe(before.carrier.vehicle.cargoKg);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(500)); await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const returned = await snap(page); expect(returned.supplier.passengerService).toBeNull(); expect(returned.carrier.fuelReceipts).toHaveLength(1); expect(returned.money).toBe(before.money - 25);
  expect(returned.supplier.vehicle.fuelKm).toBe(112);
  await panel.getByRole('button', { name: 'Request 100-km Fuel Service ($25)', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(240));
  await panel.getByRole('button', { name: 'Cancel Unfinished Passenger Fuel Service', exact: true }).click();
  const cancelled = await snap(page); expect(cancelled.money).toBe(before.money - 50); expect(cancelled.carrier.vehicle.fuelKm).toBe(100);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(300));
  const refund = await snap(page); expect(refund.supplier.passengerService).toBeNull(); expect(refund.money).toBe(before.money - 45);
  expect(refund.carrier.fuelReceipts).toHaveLength(1); expect(refund.supplier.passengerHistory.at(-1).refund).toBe(5); expect(errors).toEqual([]);
});
test('foreign refuelling uses only that city original supplier, forbids remote switching and freezes on death', async ({ page }) => {
  test.setTimeout(300000); await start(page, 'dom', true);
  const finish = () => page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
  } throw new Error('Physical passenger task did not finish'); });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish();
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 5; n++) { const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return;
    const t = s.carrier.trip; d.advanceSimulation(t.seconds - t.progressSeconds + t.delaySeconds + 1); } });
  expect((await snap(page)).quote).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish();
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.vehicle.fuelKm = 0; d.importSurveyExpeditionTestState(s); });
  const before = await snap(page); expect(before.quote).toMatchObject({ cityId: 'b', supplierVehicleId: 'b:supply-truck', vehicleId: 'branch:b:passenger-road-car' });
  expect(await page.evaluate(q => window.helixHeresyDebug.passengerFuelAction('request', q), before.quote)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(500));
  const partial = await snap(page); expect(partial.carrier.vehicle.fuelKm).toBe(0); expect(partial.supplier.passengerService.phase).toBe('transfer');
  const original = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().economy.exchangeCarrier.support.supplier);
  expect(original.passengerService).toBeUndefined(); expect(original.fuelStockKm).toBe(8000);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100000); });
  const dead = await snap(page); expect(dead.supplier).toEqual(partial.supplier); expect(dead.carrier).toEqual(partial.carrier); expect(dead.money).toBe(partial.money);
});
