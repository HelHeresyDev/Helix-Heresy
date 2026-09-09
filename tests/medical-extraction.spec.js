const { test, expect } = require('@playwright/test');
const Medical = require('../medical-extraction');
const Remote = require('../unsupported-excursions');
const { pathToFileURL } = require('url');
const path = require('path');
const destination = { id: 'remote-survey:test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Remote Medical Test Site', distanceKm: 42, temperatureC: 18, slopePercent: 18, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'No overland route.' };
test('coverage binds one trip, assessment is not dispatch, and refusals refund once', () => {
  const coverage = { status: 'active', tripId: 'trip-1' };
  expect(Medical.coverageValid(coverage, 'trip-1')).toBe(true); expect(Medical.coverageValid(coverage, 'trip-2')).toBe(false);
  const mission = Medical.request(1, 100, { cell: Remote.LANDING, at: 100 }, { kind: 'emergency', amount: 700 });
  expect(mission.status).toBe('assessing'); expect(mission.reviewAt).toBe(160);
  expect(Medical.refuse(mission, 'No medic')).toBe(700); expect(Medical.refuse(mission, 'Still unavailable')).toBe(0);
  coverage.status = 'used'; expect(Medical.coverageValid(coverage, 'trip-1')).toBe(false);
  expect(Medical.normalizeState({ mission }).mission).toEqual(mission);
});
test('medical configuration shares aircraft availability and prevents ordinary double booking', () => {
  const trip = Remote.start(1, 0, destination);
  Remote.advance(trip, trip.pickup.opensAt, destination);
  const ready = Medical.aircraftReadyAt(trip, trip.pickup.opensAt, Remote.TURNAROUND);
  expect(ready).toBe(trip.pickup.closesAt + trip.terms.flightSeconds + Remote.TURNAROUND);
  const mission = Medical.request(1, trip.pickup.opensAt, { cell: Remote.LANDING }, { kind: 'coverage', amount: 0 });
  Medical.accept(mission, mission.reviewAt, ready, trip.terms.flightSeconds);
  expect(mission.departAt).toBe(ready + 300); expect(mission.arriveAt).toBe(mission.departAt + trip.terms.flightSeconds);
  expect(mission.cabin).toMatchObject({ medicSeats: 1, casualtyBerths: 1, cargoCapacity: 6 });
  trip.rescueReservation = mission.id;
  expect(Remote.boardingReason(trip, trip.pickup.opensAt, Remote.LANDING, 1)).toContain('Medical extraction');
  expect(Remote.requestReason(trip, trip.pickup.opensAt, 1)).toContain('reserved');
});
test('withdrawal uses actual medical condition, observed opposition, and finite endurance', () => {
  const medic = { health: 100, status: 'alive', needs: { exertion: 0, thirst: 0 } };
  expect(Medical.withdrawReason(medic, 0, 1000)).toBe('');
  expect(Medical.withdrawReason(medic, 3, 1000)).toContain('opposition');
  expect(Medical.withdrawReason(medic, 0, 120)).toContain('endurance');
  medic.health = 20; expect(Medical.withdrawReason(medic, 0, 1000)).toContain('wounds');
  medic.health = 100; medic.needs.exertion = 85; expect(Medical.withdrawReason(medic, 0, 1000)).toContain('exhausted');
});
async function start(page, covered = false, armed = false) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((destination) => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'rescue-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { ...destination, id: 'boundary-test', strategicCellId: 'planet-cell:00002' }, mode: 'wilderness', autoCare: false });
    d.configureUnsupportedTest({ destination, municipal: true, carry: ['satelliteCommunicator', 'drinkingWater', 'trailMeal'] });
    d.configureMedicalTest({}); d.toggleWildernessRadio();
  }, destination);
  if (covered) expect(await page.evaluate(() => window.helixHeresyDebug.buyExtractionCoverage())).toBe(true);
  if (armed) expect(await page.evaluate(() => window.helixHeresyDebug.toggleDistressBeacon())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.unsupportedSnapshot(); d.advanceSimulation(s.tasks.find((t) => !t.reason).dueAt - s.clock + 1); });
  await to(page, (await snap(page)).remote.trip.fieldAt);
}
const snap = (page) => page.evaluate(() => window.helixHeresyDebug.medicalExtractionSnapshot());
async function advance(page, seconds) { await page.evaluate((n) => window.helixHeresyDebug.advanceMedicalForTest(n), seconds); }
async function to(page, at) { await advance(page, Math.max(0, at - (await snap(page)).clock)); }
test.describe('physical medical extraction', () => {
  test.setTimeout(360000);
  test('armed covered distress persists through incapacity, treats finite supplies, loads physically, and hands off without a cure', async ({ page }) => {
    await start(page, true, true);
    await page.evaluate(() => window.helixHeresyDebug.configureMedicalTest({ injury: true, health: 5, cell: { x: 28, y: 12, z: 8 } }));
    await advance(page, 60); let saved = await snap(page);
    expect(saved.mission).toBeTruthy(); expect(saved.coverage.tripId).toBe(saved.remote.trip.id);
    expect(await page.evaluate(() => window.helixHeresyDebug.sendRescueDistress())).toBe(false);
    await to(page, saved.mission.reviewAt); saved = await snap(page); expect(saved.mission.status).toBe('preparing'); expect(saved.coverage.status).toBe('used');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardUnsupportedPickup())).toBe(false);
    const message = saved.mission.message;
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.configureWildernessTest({ radioCharge: 0 }); d.configureMedicalTest({ cell: { x: 33, y: 18, z: 8 } }); d.reloadSurveyExpeditionTestState(); });
    await to(page, saved.mission.arriveAt); saved = await snap(page);
    expect(saved.medic.mapCell).toEqual(Remote.LANDING); expect(saved.mission.target).toEqual(message.cell);
    for (let i = 0; i < 30 && !(await snap(page)).mission.treatment; i++) await advance(page, 10);
    saved = await snap(page); expect(saved.mission.treatment).toBeTruthy();
    expect(saved.routineSuspension.reason).toBe('medical extraction assistance');
    const bandages = saved.medicInventory.find((s) => s.key === 'medicalBandage').quantity;
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await advance(page, 46); saved = await snap(page);
    expect(saved.medicInventory.find((s) => s.key === 'medicalBandage').quantity).toBe(bandages - 1);
    expect(saved.health).toBe(5); expect(saved.injuries.some((i) => i.actorId === 'scientist' && i.status === 'stabilized')).toBe(true);
    for (let i = 0; i < 30 && (await snap(page)).mission.status !== 'inbound'; i++) await advance(page, 10);
    saved = await snap(page); expect(saved.mission.status).toBe('inbound'); expect(saved.scientistRoomId).toBe(Remote.CABIN_ROOM);
    expect(saved.mission.patientLoaded).toBe(true); expect(saved.mission.medicLoaded).toBe(true);
    await to(page, saved.mission.returnAt); expect((await snap(page)).mission.status).toBe('handoff');
    await advance(page, 50); saved = await snap(page);
    expect(saved.mission.status).toBe('complete'); expect(saved.scientistCell).toEqual(Medical.RECEIVING); expect(saved.health).toBe(5); expect(saved.beacon.armed).toBe(false);
    expect(saved.routineSuspension).toBeNull();
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator('[data-medical-extraction]')).toContainText('Handoff completed');
  });
  test('uncovered beacon cannot invent payment authority after incapacity', async ({ page }) => {
    await start(page, false, true);
    const initial = await snap(page);
    await page.evaluate(() => window.helixHeresyDebug.configureMedicalTest({ health: 5 }));
    await advance(page, 120);
    let saved = await snap(page); expect(saved.message).toBeTruthy(); expect(saved.mission).toBeNull(); expect(saved.money).toBe(initial.money);
    expect(await page.evaluate(() => window.helixHeresyDebug.toggleDistressBeacon())).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 60);
    saved = await snap(page); expect(saved.mission).toBeNull(); expect(saved.health).toBe(5);
  });
  test('emergency refusal refunds once; a medic can be attacked and die without killing the scientist', async ({ page }) => {
    await start(page);
    await page.evaluate(() => window.helixHeresyDebug.configureMedicalTest({ medicHealth: 20 }));
    const before = await snap(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.sendRescueDistress())).toBe(true);
    let saved = await snap(page); expect(saved.money).toBeLessThan(before.money); await to(page, saved.mission.reviewAt);
    saved = await snap(page); expect(saved.mission.status).toBe('refused'); expect(saved.money).toBe(before.money);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 61); expect((await snap(page)).money).toBe(before.money);
    await page.evaluate(() => window.helixHeresyDebug.configureMedicalTest({ medicHealth: 100 }));
    await page.evaluate(() => window.helixHeresyDebug.sendRescueDistress()); await to(page, (await snap(page)).mission.reviewAt);
    saved = await snap(page); await to(page, saved.mission.arriveAt);
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.medicalExtractionSnapshot(); d.configureUnsupportedTest({ cell: { x: 35, y: 18, z: 8 }, beasts: [{ id: 'medic-attacker', cell: { x: 24, y: 12, z: 8 }, nextMoveAt: s.clock + 1000, nextAttackAt: s.clock + 1 }] }); });
    await advance(page, 1); saved = await snap(page); expect(saved.medic.health).toBeLessThan(100);
    const patientHealth = saved.health;
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.damageRescueMedicForTest(500); d.configureUnsupportedTest({ beasts: [] }); });
    saved = await snap(page); expect(saved.medic.status).toBe('dead'); expect(saved.medicInventory).toHaveLength(0);
    await advance(page, 1); expect((await snap(page)).mission.status).toBe('withdrawing');
    expect(saved.stacks.some((s) => s.key === 'escortVest' && !s.carriedBy && s.roomId === Remote.ROOM)).toBe(true);
    await to(page, saved.mission.fieldDeadline); await to(page, (await snap(page)).mission.returnAt);
    saved = await snap(page); expect(saved.mission.status).toBe('failed'); expect(saved.health).toBe(patientHealth); expect(saved.scientistRoomId).toBe(Remote.ROOM); expect(saved.remote.trip.rescueReservation).toBeNull();
  });
});
