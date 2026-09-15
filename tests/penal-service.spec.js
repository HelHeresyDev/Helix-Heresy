const { test, expect } = require('@playwright/test');
const Service = require('../penal-service');
const Legion = require('../penal-legion');
const copy = x => JSON.parse(JSON.stringify(x));
const driver = { id: 'driver', status: 'alive', health: 100 };
function fixture() {
  const s = { id: 'service', cityId: 'city-a', orderId: 'order-a', jailStayId: 'jail-a', termMonths: 12, startedAt: 1000, history: [], truck: { condition: 100, fuelKm: 50 } };
  Service.ledger(s, { id: 'jail-a', bookedAt: 100 }); Service.depot(s, 1000); return s;
}
test('documented source custody is credited once and waiting or recovery never resets the fixed boundary', () => {
  const s = fixture(), deadline = s.ledger.releaseAt;
  expect(s.ledger.recognizedCustodySeconds).toBe(900);
  Service.accrue(s, 2000); expect(s.creditedSeconds).toBe(1900);
  const loaded = copy(s); Service.ledger(loaded, { id: 'jail-a', bookedAt: 0 });
  for (const phase of ['depotService', 'medical', 'brokenTransport', 'field']) { loaded.phase = phase; Service.accrue(loaded, 5000); expect(loaded.ledger.releaseAt).toBe(deadline); }
  expect(loaded.creditedSeconds).toBe(4900);
  expect(Service.accrue(loaded, deadline + 1000)).toBe(true);
  expect(loaded.serviceEndedAt).toBe(deadline); expect(loaded.remainingSeconds).toBe(0);
  expect(Service.accrue(loaded, deadline + 2000)).toBe(false);
  expect(loaded.history.filter(h => h.phase === 'serviceExpired')).toHaveLength(1);
  Legion.credit(loaded, deadline + 3000); expect(loaded.creditedSeconds).toBe(12 * Service.MONTH);
});
test('unrelated custody is not fabricated as credit and activities require actual readiness', () => {
  const s = { termMonths: 12, startedAt: 100, jailStayId: 'a' };
  expect(Service.ledger(s, { id: 'b', bookedAt: 0 }).recognizedCustodySeconds).toBe(0);
  const d = fixture().depot;
  expect(Service.activity(d, 'company', 1000)).toBe(true);
  expect(Service.activity(d, 'training', 1000)).toBe(false);
  expect(Service.work(d, 10000, 1100, false)).toBeNull(); expect(d.activity.progress).toBe(0);
  expect(Service.work(d, 600, 1600, true).kind).toBe('company');
  expect(Service.work(d, 600, 2200, true)).toBeNull();
  Service.activity(d, 'company', 1700); expect(d.activity.readyAt).toBe(1600 + Service.DAY);
  expect(Service.work(d, 99999, 1800, true)).toBeNull();
});
test('local delivery preserves finite city stock, cargo, driver, fuel and one-time unload across reload', () => {
  const d = fixture().depot, initial = d.cityStock.drinkingWater;
  expect(Service.orderDelivery(d, { drinkingWater: 0, trailMeal: 80, medicalBandage: 12, neutralizingWash: 6 }, 1000)).toBe(true);
  expect(Service.orderDelivery(d, {}, 1000)).toBe(false);
  Service.deliveryTick(d, 300, 1300, driver, false); expect(d.supplyVan.distanceKm).toBe(2);
  d.route.open = false; Service.deliveryTick(d, 900, 2200, driver, false); expect(d.supplyVan.distanceKm).toBe(2);
  d.route.open = true; Service.deliveryTick(d, 300, 2500, driver, false); expect(d.delivery.phase).toBe('loading');
  expect(d.cityStock.drinkingWater).toBe(initial);
  Service.deliveryTick(d, 120, 2620, driver, true); expect(d.cityStock.drinkingWater).toBe(initial - 160);
  const loaded = copy(d); Service.deliveryTick(loaded, 600, 3220, driver, false);
  expect(Service.deliveryTick(loaded, 120, 3340, driver, true)).toEqual({ drinkingWater: 160 });
  expect(Service.deliveryTick(loaded, 120, 3460, driver, true)).toBeNull();
  expect(loaded.deliveryHistory).toHaveLength(1); expect(loaded.supplyVan.fuelKm).toBe(2392);
});
test('discharge transport cannot extend service, teleport through a breakdown, or grant unrelated relief', () => {
  const s = fixture(); Service.accrue(s, s.ledger.releaseAt); Service.beginDischarge(s, s.ledger.releaseAt);
  expect(Service.beginDischarge(s, s.ledger.releaseAt)).toBe(false);
  s.depot.discharge.phase = 'travelling';
  expect(Service.dischargeTravel(s, 300, driver)).toBe(false);
  expect(s.depot.discharge.distanceKm).toBe(2);
  s.truck.condition = 0; expect(Service.dischargeTravel(s, 100000, driver)).toBe(false);
  expect(s.depot.discharge.distanceKm).toBe(2); expect(s.remainingSeconds).toBe(0);
  s.truck.condition = 100; expect(Service.dischargeTravel(s, 300, driver)).toBe(true);
  expect(s.depot.discharge.receivingPermit.scope).toContain('unrelated restrictions remain');
});

test('expiry preserves requested medical care and completion consumes the activity only once', () => {
  const s = fixture(); Service.activity(s.depot, 'medical', 1000);
  Service.work(s.depot, 30, 1030, true);
  Service.accrue(s, s.ledger.releaseAt); Service.beginDischarge(s, s.ledger.releaseAt);
  expect(s.depot.activity.progress).toBe(30);
  expect(Service.work(s.depot, 90, s.ledger.releaseAt, true).kind).toBe('medical');
  expect(s.depot.activity).toBeNull();
  expect(Service.work(s.depot, 120, s.ledger.releaseAt + 120, true)).toBeNull();
});

async function setup(page, depot = true) {
  const { pathToFileURL } = require('url'), path = require('path');
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'depot-test', publicProspects: {}, truth: {} } }));
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(raidId => { const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(raidId); d.updateLawEnforcementRaids(1); d.surrenderToRaid(raidId); for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 }); }, execution.raidId);
  expect(await page.evaluate(() => window.helixHeresyDebug.preparePenalLegionForTest())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(2400));
  if (depot) expect(await page.evaluate(() => window.helixHeresyDebug.preparePenalDepotForTest())).toBe(true);
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advancePenalDepotForTest(n), seconds);

test('browser depot feeds from real stocks, conducts scheduled communication, and stops routine at completion', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); let s = await snapshot(page), initialWater = s.stacks.find(a => a.id === s.service.depot.supplyIds.drinkingWater).quantity;
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ thirst: 40 }));
  await advance(page, 90); s = await snapshot(page);
  expect(s.stacks.find(a => a.id === s.service.depot.supplyIds.drinkingWater).quantity).toBeLessThan(initialWater);
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDepotAction('company'))).toBe(true);
  await advance(page, 660); s = await snapshot(page);
  expect(s.service.depot.communications).toHaveLength(1);
  expect(s.service.depot.communications[0]).toMatchObject({ channel: 'company', confidential: false, report: { observedAt: expect.any(Number) } });
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDepotAction('maintenance'))).toBe(true);
  await advance(page, 30);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ activityRemaining: 30 }));
  const before = (await snapshot(page)).clock;
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDepotRoutine())).toBe(true);
  s = await snapshot(page); expect(s.clock - before).toBeLessThanOrEqual(120);
  expect(s.service.depot.activity).toBeNull(); expect(s.service.depot.communications).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('browser expiry removes the physical collar once and returns a consenting passenger to civilian receiving', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ remaining: 60 }));
  await advance(page, 240); let s = await snapshot(page);
  expect(s.service.phase, JSON.stringify(s.service.depot.discharge)).toBe('dischargeBoarding');
  expect(s.suppression).toBe(''); expect(s.service.remainingSeconds).toBe(0);
  expect(s.service.depot.discharge.equipment).toHaveLength(5);
  const papers = s.service.depot.discharge.papers;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect(await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ board: true }))).toBeTruthy();
  await advance(page, 90); s = await snapshot(page);
  expect(s.service.phase, JSON.stringify({ discharge: s.service.depot.discharge, cell: s.cell })).toBe('dischargeTransit');
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ routeOpen: false }));
  const position = s.service.depot.discharge.distanceKm; await advance(page, 60);
  expect((await snapshot(page)).service.depot.discharge.distanceKm).toBe(position);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ routeOpen: true }));
  await advance(page, 660); s = await snapshot(page);
  expect(s.service.phase).toBe('discharged'); expect(s.roomId).toBe('penalServiceReceiving');
  expect(s.service.depot.discharge.papers).toEqual(papers);
  expect(s.service.remainingSeconds).toBe(0); expect(s.service.truck.occupants).toEqual([]);
  expect(errors).toEqual([]);
});

test('browser expiry during outbound travel reverses the actual trip without beginning the relay objective', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, false);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ remaining: 240 }));
  expect(await page.evaluate(() => window.helixHeresyDebug.penalLegionAction('deploy'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(180));
  let s = await snapshot(page); expect(s.service.phase).toBe('outbound');
  const deadline = s.service.ledger.releaseAt;
  await advance(page, 60); s = await snapshot(page);
  expect(s.service.serviceEndedAt).toBe(deadline); expect(s.service.phase).toBe('returning');
  expect(s.service.returnDistanceKm).toBeLessThan(s.service.destination.distanceKm);
  expect(s.service.relay.repairSeconds).toBe(0);
  await advance(page, 600); s = await snapshot(page);
  expect(s.service.phase, JSON.stringify(s.service.depot.discharge)).toBe('dischargeBoarding');
  expect(s.suppression).toBe(''); expect(s.service.relay.repairSeconds).toBe(0);
  expect(s.service.history.filter(h => h.phase === 'serviceExpired')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('browser depot delivery and clinical care remain finite and available after expiry', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ stock: { drinkingWater: 1 }, driverHealth: 0 }));
  await advance(page, 10); let s = await snapshot(page);
  expect(s.service.depot.delivery.delay).toContain('driver');
  const cityWater = s.service.depot.cityStock.drinkingWater;
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ driverHealth: 100 }));
  await advance(page, 1500); s = await snapshot(page);
  expect(s.service.depot.delivery).toBeNull();
  expect(s.service.depot.deliveryHistory).toHaveLength(1);
  expect(s.service.depot.cityStock.drinkingWater).toBeLessThan(cityWater);
  expect(s.stacks.find(a => a.id === s.service.depot.supplyIds.drinkingWater).quantity).toBeGreaterThan(1);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ injury: true, remaining: 30 }));
  const bandages = (await snapshot(page)).stacks.find(a => a.id === s.service.depot.supplyIds.medicalBandage).quantity;
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDepotAction('medical'))).toBe(true);
  await advance(page, 300); s = await snapshot(page);
  expect(s.service.remainingSeconds).toBe(0);
  expect(s.service.depot.activity).toBeNull();
  expect(s.stacks.find(a => a.id === s.service.depot.supplyIds.medicalBandage).quantity).toBe(bandages - 1);
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDepotAction('medical'))).toBe(true);
  await advance(page, 150); s = await snapshot(page);
  expect(s.service.depot.activity).toBeNull();
  expect(s.stacks.find(a => a.id === s.service.depot.supplyIds.medicalBandage).quantity).toBe(bandages - 2);
  await advance(page, 150); s = await snapshot(page);
  expect(s.stacks.find(a => a.id === s.service.depot.supplyIds.medicalBandage).quantity).toBe(bandages - 2);
  expect(errors).toEqual([]);
});

test('browser field expiry halts repair and withdraws without refitting an expired custody collar', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, false);
  await page.evaluate(() => window.helixHeresyDebug.penalLegionAction('deploy'));
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(1890));
  let s = await snapshot(page); expect(s.service.phase).toBe('field');
  const repair = s.service.relay.repairSeconds;
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ remaining: 1 }));
  await advance(page, 1); s = await snapshot(page);
  expect(s.service.serviceEndedAt).toBe(s.clock);
  expect(['withdrawal', 'returning']).toContain(s.service.phase);
  expect(s.service.relay.repairSeconds).toBe(repair);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(2400));
  s = await snapshot(page);
  expect(s.roomId).toBe('penalLegionDepot');
  await advance(page, 300); s = await snapshot(page);
  expect(s.service.phase).toBe('dischargeBoarding');
  expect(s.service.relay.repairSeconds).toBe(repair);
  expect(s.suppression).toBe('');
  expect(s.service.history.filter(h => h.phase === 'serviceExpired')).toHaveLength(1);
  expect(errors).toEqual([]);
});
