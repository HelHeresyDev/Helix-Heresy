const { test, expect } = require('@playwright/test');
const Passenger = require('../intercity-passenger');
const { pathToFileURL } = require('url');
const path = require('path');
const city = () => ({ cityId: 'a', assetId: 'city:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } });
const standings = () => [{ network: { id: 'transport:a', category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Passenger Depot', capacityBand: 'functional', operationalStatus: 'active' } }];
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b', 'c', 'd'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: id === 'a' ? 'Aster' : `City ${id}`, known: id !== 'd', supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: `planet-cell:0000${id === 'a' ? 1 : 2}` }))
], routes: [
  { id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2, cellPath: ['secret-path'] },
  { id: 'route:bc', endpointCityIds: ['b', 'c'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'route:ad', endpointCityIds: ['a', 'd'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }
] });
const cargo = () => ({ kg: 1, l: 1, reserved: false });
const fixture = () => Passenger.create(city(), standings(), 0);
function launch(s, n = network(), wallet = { money: 5000 }, at = 0) {
  const q = Passenger.quote(s, n, 'city:b');
  expect(Passenger.book(s, q, cargo(), wallet, at, 1)).toBe('');
  expect(Passenger.boardingReason(s, n, cargo(), at, 1)).toBe('');
  expect(Passenger.board(s, at, [{ stackId: 'original-item' }], 'route-test')).toBe(true);
  return { q, wallet };
}
test('passenger allocation is sourced, finite and immutable-world; destinations are known direct neighbors only', () => {
  const c = city(), entries = standings(), before = JSON.stringify({ c, entries });
  expect(Passenger.create(c, entries, 0).source).toEqual({ branchId: 'branch:a', populationId: 'city:a', people: 1, vehicles: 1 });
  expect(JSON.stringify({ c, entries })).toBe(before);
  for (const changed of [{ ...c, currentPopulation: 0 }, { ...c, physicalCondition: 'ruined' }, { ...c, services: { transport: 'failed' } }]) expect(Passenger.create(changed, entries, 0)).toBeNull();
  expect(Passenger.create(c, [{ ...entries[0], standing: 'proscribed' }], 0)).toBeNull();
  expect(Passenger.create(c, [{ ...entries[0], branch: { ...entries[0].branch, operationalStatus: 'suspended' } }], 0)).toBeNull();
  const n = network(); expect(Passenger.neighbors(n, 'a').map(e => e.destination.id)).toEqual(['city:b']);
  expect(Passenger.quote(fixture(), n, 'city:c').ok).toBe(false);
  n.routes[0].continuity = 'closed'; expect(Passenger.quote(fixture(), n, 'city:b').ok).toBe(false);
});
test('exact fares, actual carried capacities, route/body/expiry rechecks and once-only unlaunched refunds', () => {
  const s = fixture(), n = network(), q = Passenger.quote(s, n, 'city:b'), wallet = { money: 5000 };
  expect(Passenger.load([{ carriedBy: 'scientist', quantity: 2, unitMassKg: 3, unitVolumeL: 4 }, { carriedBy: '', quantity: 999, unitMassKg: 100 }])).toEqual({ kg: 6, l: 8, reserved: false });
  for (const load of [{ kg: 21, l: 1 }, { kg: 1, l: 41 }, { kg: 1, l: 1, reserved: true }]) expect(Passenger.book(s, q, load, wallet, 0, 1)).toContain('cargo');
  expect(wallet.money).toBe(5000);
  expect(Passenger.book(s, q, cargo(), wallet, 0, 1)).toBe('');
  expect(wallet.money).toBe(5000 - q.fee);
  expect(Passenger.book(s, q, cargo(), wallet, 0, 1)).toContain('committed');
  expect(Passenger.boardingReason(s, n, cargo(), 0, 2)).toContain('previous body');
  expect(Passenger.boardingReason(s, n, cargo(), 3600, 1)).toContain('expired');
  n.routes[0].distanceKm = 3; expect(Passenger.boardingReason(s, n, cargo(), 10, 1)).toContain('changed');
  expect(Passenger.cancel(s, wallet)).toBe(true); expect(Passenger.cancel(s, wallet)).toBe(false); expect(wallet.money).toBe(5000);
});
test('finite physical transit survives reload, holds on route/crew failures and requires separate return and unloading', () => {
  let s = fixture(); const n = network(), { q, wallet } = launch(s, n);
  Passenger.advance(s, n, 100); expect(s.trip.distanceKm).toBeGreaterThan(0); expect(s.phase).toBe('outbound');
  s = JSON.parse(JSON.stringify(s)); const km = s.trip.distanceKm, fuel = s.vehicle.fuelKm;
  Passenger.advance(s, n, 100); expect(s.vehicle.fuelKm).toBe(fuel);
  n.routes[0].continuity = 'closed'; Passenger.advance(s, n, 200); expect(s.trip.distanceKm).toBe(km);
  n.routes[0].continuity = 'continuous'; s.driver.health = 0; Passenger.advance(s, n, 300); expect(s.trip.distanceKm).toBe(km);
  s.driver.health = 100; Passenger.advance(s, n, 2400); expect(s.phase).toBe('arrival');
  expect(s.location).toBe('b'); expect(s.trip.manifest).toEqual([{ stackId: 'original-item' }]);
  expect(s.vehicle.fuelKm).toBeCloseTo(2400 - q.km); expect(s.receipts).toHaveLength(1);
  expect(Passenger.cancel(s, wallet)).toBe(false);
  expect(Passenger.disembark(s)).toBe(true); expect(s.phase).toBe('foreign');
  const remaining = s.vehicle.fuelKm; s.vehicle.fuelKm = 0;
  expect(Passenger.book(s, Passenger.quote(s, n, 'city:b'), cargo(), wallet, 2400, 1)).toContain('Finite');
  expect(s.phase).toBe('foreign'); s.vehicle.fuelKm = remaining;
  launch(s, n, wallet, 2400); Passenger.advance(s, n, 4800); expect(s.phase).toBe('arrival'); expect(s.location).toBe('a');
  Passenger.disembark(s); expect(s.phase).toBe('home'); expect(s.vehicle.fuelKm).toBeCloseTo(2400 - 2 * q.km);
  expect(s.receipts).toHaveLength(2); expect(wallet.money).toBe(5000 - 2 * q.fee);
});
test('coarse advance cannot outrun fuel/provisions/duty, waiting is finite, death freezes and supplied rest does not repair', () => {
  for (const resource of ['fuel', 'provisions', 'fatigue', 'condition']) {
    const s = fixture(), n = network(); launch(s, n);
    if (resource === 'fuel') s.vehicle.fuelKm = .1;
    if (resource === 'provisions') s.provisionsSeconds = 30;
    if (resource === 'fatigue') s.driver.fatigue = 79.99;
    if (resource === 'condition') s.vehicle.condition = 50.001;
    Passenger.advance(s, n, 100000); expect(s.phase).toBe('outbound'); expect(s.trip.distanceKm).toBeLessThan(2);
    const frozen = JSON.stringify(s); Passenger.advance(s, n, 200000, false); expect(JSON.stringify(s)).toBe(frozen);
  }
  const s = fixture(), n = network(); s.driver.fatigue = 60; s.vehicle.condition = 70;
  expect(Passenger.rest(s)).toBe(true); Passenger.advance(s, n, 4 * 3600);
  s.rest = JSON.parse(JSON.stringify(s.rest)); Passenger.advance(s, n, 8 * 3600);
  expect(s.driver.fatigue).toBe(30); expect(s.vehicle.condition).toBe(70); expect(s.provisionsSeconds).toBe(88 * 3600);
  Passenger.advance(s, n, 100 * 3600); expect(s.provisionsSeconds).toBe(0);
  expect(Passenger.book(s, Passenger.quote(s, n, 'city:b'), cargo(), { money: 99999 }, 100 * 3600, 1)).toContain('Finite');
});
test('public itinerary omits withheld paths, private manifests, exact progress and unrevealed delays', () => {
  const s = fixture(); launch(s);
  const view = Passenger.publicView(s), serialized = JSON.stringify(view);
  for (const hidden of ['secret-path', 'manifest', 'progressSeconds', 'delaySeconds', 'fatigue', 'fuelKm', 'passenger-driver']) expect(serialized).not.toContain(hidden);
  expect(view.trip.delay).toBe(''); expect(view.trip.directions).toContain('no maps');
});

async function finishWork(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 8; i++) {
      const snap = d.intercityPassengerSnapshot(), task = snap.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - snap.clock + 1));
    }
    throw new Error('Passenger work did not finish');
  });
}
for (const renderer of ['dom', 'canvas']) test(`physical passenger journey, saved cargo and supported return through ${renderer} renderer`, async ({ page }) => {
  test.setTimeout(300000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ network, city, standings, renderer }) => {
    const d = window.helixHeresyDebug;
    d.setIntercityPassengerTestContext({ network, city, standings }); d.setMapRenderer(renderer);
    const saved = d.exportSurveyExpeditionTestState();
    // Prepared physical starting fixture: original supplies, not generated journey outcomes.
    const stack = saved.physicalItemStacks.find(s => s.quantity > 0 && !s.reservedTaskId && !s.toolInstanceId && s.unitMassKg < 5);
    if (!stack) throw new Error('No original fixture supply');
    stack.quantity = 1; stack.carriedBy = 'scientist'; stack.roomId = 'supportedSurveyGround'; stack.cell = { x: 10, y: 10, z: 6 };
    d.importSurveyExpeditionTestState(saved);
  }, { network: network(), city: city(), standings: standings(), renderer });
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 15, y: 14, z: 6 } }))).toBeTruthy();
  await finishWork(page); // Ordinary flagged-ground contact creates an actual minor injury.
  const snap = () => page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  const before = await snap(); expect(before.carried).not.toHaveLength(0);
  expect(before.injuries).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull();
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Accept Passenger Fare to City b', exact: true }).click();
  expect((await snap()).money).toBe(before.money - 108);
  expect((await snap()).roomId).toBe('supportedSurveyGround');
  await page.getByRole('button', { name: 'Walk to Vehicle and Board', exact: true }).click();
  await finishWork(page);
  let inTransit = await snap(); expect(inTransit.carrier.phase).toBe('outbound'); expect(inTransit.roomId).toContain('passenger-cabin');
  expect(inTransit.envelope).toMatchObject({ roofed: true, openSky: false }); expect(inTransit.constructionReason).toContain('no construction');
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.queueSurveyLabTestTask(); d.reloadSurveyExpeditionTestState(); });
  expect((await snap()).roomId).toContain('passenger-cabin');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  const arrived = await snap(); expect(arrived.carrier.phase).toBe('arrival'); expect(arrived.roomId).toContain('passenger-cabin');
  expect(arrived.tasks.find(t => t.label === 'Laboratory research test').reason).toContain('off site');
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true);
  await finishWork(page);
  const foreign = await snap(); expect(foreign.carrier.phase).toBe('foreign'); expect(foreign.roomId).toBe('passenger-outer-b');
  expect(foreign.envelope).toMatchObject({ roofed: false, openSky: true }); expect(foreign.constructionReason).toContain('no construction'); expect(foreign.surveyContext).toBeNull();
  expect(foreign.carried.map(s => [s.id, s.quantity])).toEqual(before.carried.map(s => [s.id, s.quantity]));
  expect(foreign.injuries.map(i => [i.id, i.typeId, i.location])).toEqual(before.injuries.map(i => [i.id, i.typeId, i.location]));
  expect(foreign.carried.every(s => s.cell.z === foreign.cell.z)).toBe(true);
  await expect(page.locator('[data-intercity-passenger]')).toContainText('maps and surveys remain withheld');
  const oldDriver = foreign.carrier.driver.id, oldVehicle = foreign.carrier.vehicle.id;
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  await finishWork(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true);
  await finishWork(page);
  const home = await snap(); expect(home.roomId).toBe('supportedSurveyGround'); expect(home.carrier.phase).toBe('home');
  expect(home.carrier.driver.id).toBe(oldDriver); expect(home.carrier.vehicle.id).toBe(oldVehicle); expect(home.carrier.receipts).toHaveLength(2);
  expect(home.carrier.vehicle.fuelKm).toBeCloseTo(2396); expect(home.money).toBe(before.money - 216);
  expect(home.carried.map(s => [s.id, s.quantity])).toEqual(before.carried.map(s => [s.id, s.quantity]));
  expect(home.injuries.map(i => [i.id, i.typeId, i.location])).toEqual(before.injuries.map(i => [i.id, i.typeId, i.location]));
  expect(home.injuries[0].status).toBe('active');
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull();
  expect(errors).toEqual([]);
});

test('expired/cancelled boarding, closed-route return, insufficient reserves and death cannot manufacture transport', async ({ page }) => {
  test.setTimeout(300000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(options => window.helixHeresyDebug.setIntercityPassengerTestContext(options), { network: network(), city: city(), standings: standings() });
  const snap = () => page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  const initial = await snap();
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  const oldBoardId = (await snap()).tasks.find(t => t.data.action === 'passengerBoard').id;
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.intercityPassenger.driver.health = 0; d.importSurveyExpeditionTestState(saved);
  });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3601));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(false);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.intercityPassenger.driver.health = 100; d.importSurveyExpeditionTestState(saved);
  });
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Cancel Unlaunched Booking (Refund Fare)', exact: true }).click();
  expect((await snap()).money).toBe(initial.money);
  const suppliesAfterWait = (await snap()).carrier.provisionsSeconds; expect(suppliesAfterWait).toBeLessThan(initial.carrier.provisionsSeconds);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect((await snap()).tasks.find(t => t.id === oldBoardId).reason).toContain('no longer owns');
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  await finishWork(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true);
  await finishWork(page);
  const outside = await snap(); expect(outside.roomId).toBe('passenger-outer-b');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.strategicJourneys.routes.find(r => r.id === 'route:ab').continuity = 'closed'; d.importSurveyExpeditionTestState(saved);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  expect((await snap()).roomId).toBe(outside.roomId); expect((await snap()).money).toBe(outside.money);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.strategicJourneys.routes.find(r => r.id === 'route:ab').continuity = 'continuous';
    saved.intercityPassenger.vehicle.fuelKm = 0; d.importSurveyExpeditionTestState(saved);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(false);
  const driver = (await snap()).carrier.driver.id;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap()).carrier.driver.id).toBe(driver); expect((await snap()).carrier.vehicle.fuelKm).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = (await snap()).carrier;
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(100000));
  expect((await snap()).carrier).toEqual(frozen);
  expect(errors).toEqual([]);
});

test('long occupied-journey skips stop at personal survival warnings without abandoning the passenger', async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const n = network(); n.routes[0].distanceKm = 200;
  await page.evaluate(options => window.helixHeresyDebug.setIntercityPassengerTestContext(options), { network: n, city: city(), standings: standings() });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  await finishWork(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.wildernessSurvival.thirst = 44.9; saved.wildernessSurvival.warningBand = 0; saved.wildernessSurvival.autoCare = false;
    d.importSurveyExpeditionTestState(saved);
  });
  const before = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(100000));
  const after = await page.evaluate(() => ({ snap: window.helixHeresyDebug.intercityPassengerSnapshot(), saved: window.helixHeresyDebug.exportSurveyExpeditionTestState() }));
  expect(after.snap.clock - before.clock).toBeLessThanOrEqual(600);
  expect(after.snap.carrier.phase).toBe('outbound'); expect(after.snap.roomId).toContain('passenger-cabin');
  expect(after.saved.wildernessSurvival.warningBand).toBe(1); expect(after.saved.runEnded).toBe(false);
  expect(after.snap.carried.map(s => [s.id, s.quantity])).toEqual(before.carried.map(s => [s.id, s.quantity]));
});
