const { test, expect } = require('@playwright/test');
const Remote = require('../unsupported-excursions');
const { pathToFileURL } = require('url');
const path = require('path');
const destination = { id: 'remote-survey:planet-cell:00003', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Remote Woodland', distanceKm: 42, temperatureC: 18, slopePercent: 18, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'No implemented overland return route.' };
test('remote destinations require real suitable land, range, and separation from cities and the boundary', () => {
  const origin = { id: 'a' };
  const cells = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, surfaceClass: 'land', slopePercent: 15, temperatureC: 18, distanceKm: 50 }));
  const original = JSON.stringify(cells);
  expect(Remote.chooseDestination(origin, cells, ['b'], ['c'])).toMatchObject({ strategicCellId: 'd', originCellId: 'a' });
  expect(JSON.stringify(cells)).toBe(original);
  expect(Remote.chooseDestination(origin, cells.map((c) => ({ ...c, distanceKm: 900 })))).toBeNull();
  expect(Remote.chooseDestination(origin, cells.map((c) => ({ ...c, surfaceClass: 'ocean' })))).toBeNull();
  expect(Remote.chooseDestination(origin, cells.map((c) => ({ ...c, slopePercent: 40 })))).toBeNull();
});
test('scheduled pickup is finite, exact closing time rejects boarding, and missed pickup does not end the party', () => {
  const trip = Remote.start(1, 0, destination);
  expect(Remote.quote(destination).passengerCapacity).toBe(1);
  Remote.advance(trip, trip.fieldAt, destination); expect(trip.status).toBe('field');
  Remote.advance(trip, trip.pickup.opensAt, destination); expect(trip.pickup.status).toBe('waiting');
  expect(Remote.board(trip, trip.pickup.opensAt, { ...Remote.LANDING, x: 24 }, 1, true, destination)).toBe(false);
  expect(Remote.board(trip, trip.pickup.opensAt, Remote.LANDING, 5, true, destination)).toBe(false);
  expect(Remote.board(trip, trip.pickup.opensAt, Remote.LANDING, 1, false, destination)).toBe(false);
  expect(Remote.board(trip, trip.pickup.closesAt, Remote.LANDING, 1, true, destination)).toBe(false);
  Remote.advance(trip, trip.pickup.closesAt, destination); expect(trip.pickup.status).toBe('missed'); expect(trip.status).toBe('field');
  expect(Remote.normalizeState({ trip }).trip).toEqual(trip);
});
test('requests acknowledge before review, reject unavailable craft with one refund, and accepted flights survive contact loss', () => {
  const trip = Remote.start(1, 0, destination);
  Remote.advance(trip, trip.pickup.closesAt, destination);
  expect(Remote.request(trip, trip.pickup.closesAt, 1, Remote.LANDING).status).toBe('acknowledged');
  expect(Remote.request(trip, trip.pickup.closesAt, 1, Remote.LANDING)).toBeNull();
  const at = trip.request.reviewAt;
  expect(Remote.advance(trip, at, destination).filter((e) => e.kind === 'refund')).toHaveLength(1);
  expect(trip.request.status).toBe('refused');
  expect(Remote.advance(trip, at + 1, destination).filter((e) => e.kind === 'refund')).toHaveLength(0);
  Remote.request(trip, trip.providerReadyAt + 1, 1, Remote.LANDING);
  const acknowledgedReport = { request: JSON.parse(JSON.stringify(trip.request)), pickup: JSON.parse(JSON.stringify(trip.pickup)) };
  Remote.advance(trip, trip.request.reviewAt, destination); expect(trip.request.status).toBe('accepted'); expect(trip.pickup.status).toBe('scheduled');
  expect(Remote.nextPublicEventAt(trip, acknowledgedReport, trip.request.reviewAt)).toBe(Infinity);
  expect(Remote.nextPublicEventAt(trip, { pickup: trip.pickup }, trip.request.reviewAt)).toBe(trip.pickup.opensAt);
  const loaded = JSON.parse(JSON.stringify(trip));
  Remote.advance(loaded, loaded.pickup.opensAt, destination); expect(loaded.pickup.status).toBe('waiting');
  expect(Remote.board(loaded, loaded.pickup.opensAt, Remote.LANDING, 1, true, destination)).toBe(true);
  expect(loaded.status).toBe('inbound'); Remote.advance(loaded, loaded.returnAt, destination); expect(loaded.status).toBe('complete');
});
test('weather can prevent dispatch without inventing aircraft losses or killing passengers', () => {
  const trip = Remote.start(1, 0, destination);
  Remote.advance(trip, trip.pickup.opensAt, { ...destination, temperatureC: 60 });
  expect(trip.status).toBe('field'); expect(trip.pickup.status).toBe('aborted'); expect(trip.pickup.reason).toContain('Temperature');
});

async function start(page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((destination) => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'remote-test', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 700 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 800, environmentalDifficultyPermille: 200 } } });
    d.configureWildernessTest({ destination: { ...destination, id: 'boundary-test', strategicCellId: 'planet-cell:00002' }, mode: 'wilderness', autoCare: false });
    d.configureUnsupportedTest({ destination, municipal: true, carry: ['drinkingWater', 'trailMeal', 'satelliteCommunicator', 'fieldShelter', 'environmentalSurveyKit'] });
  }, destination);
}
const snap = (page) => page.evaluate(() => window.helixHeresyDebug.unsupportedSnapshot());
async function finish(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 10; i++) { const saved = d.unsupportedSnapshot(), task = saved.tasks.find((t) => !t.reason); if (!task) return; d.advanceSimulation(Math.max(1, task.dueAt - saved.clock + 1)); }
    throw new Error('Remote routed work did not finish');
  });
}
async function advanceTo(page, at) { const saved = await snap(page); await page.evaluate((seconds) => window.helixHeresyDebug.advanceUnsupportedForTest(seconds), Math.max(0, at - saved.clock)); }
async function depart(page, realTime = false) {
  expect(await page.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true);
  expect((await snap(page)).active).toBe(false); await finish(page);
  expect((await snap(page)).roomId).toBe(Remote.CABIN_ROOM);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const saved = await snap(page);
  if (realTime) {
    await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), saved.trip.fieldAt - saved.clock + 600);
    expect((await snap(page)).clock).toBe(saved.trip.fieldAt);
  } else await advanceTo(page, saved.trip.fieldAt);
}
test.describe('unsupported excursion integration', () => {
  test.setTimeout(300000);
  test('physical departure, remote shelter and findings, missed pickup, and reload preserve a living isolated scientist', async ({ page }) => {
    await start(page); const initial = await snap(page);
    await depart(page, true); let saved = await snap(page);
    expect(saved.roomId).toBe(Remote.ROOM); expect(saved.cell).toEqual(Remote.LANDING); expect(saved.money).toBe(initial.money - saved.trip.terms.fee);
    expect(saved.context.siteId).toBe(destination.id);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true }))).toBeFalsy();
    expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('deployShelter'))).toBe(true); await finish(page);
    const shelter = (await snap(page)).survival.shelter;
    expect(shelter.cell).toEqual(Remote.LANDING);
    const reason = await page.evaluate(() => window.helixHeresyDebug.resourceSurveyBlockReason('reconnaissance', { x: 25, y: 12, z: 8 }));
    expect(await page.evaluate(() => window.helixHeresyDebug.startResourceSurvey('reconnaissance', { x: 25, y: 12, z: 8 })), reason).toBe(true); await finish(page);
    expect((await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot())).observations.at(-1).siteId).toBe(destination.id);
    saved = await snap(page);
    await page.evaluate(({ cell, clock }) => { const d = window.helixHeresyDebug; d.configureUnsupportedTest({ beasts: [{ id: 'remote-wolf', cell: { ...cell, x: cell.x + 1 }, nextMoveAt: clock + 1000, nextAttackAt: clock + 1 }] }); d.advanceWildernessBeastsForTest(1); }, saved);
    expect((await snap(page)).health).toBeLessThan(saved.health);
    await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ beasts: [{ id: 'remote-wolf', cell: { x: 30, y: 12, z: 8 }, status: 'dead', health: 0 }] }));
    await advanceTo(page, (await snap(page)).trip.pickup.closesAt);
    saved = await snap(page); expect(saved.trip.pickup.status).toBe('missed'); expect(saved.phase).toBe('field'); expect(saved.health).toBeGreaterThan(0);
    expect(saved.survival.thirst).toBeGreaterThan(initial.survival.thirst);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snap(page)).survival.shelter).toEqual(shelter);
    await page.locator('[data-workspace-tab="visits"]').click();
    await expect(page.locator('[data-unsupported-excursions]')).toContainText('No implemented overland return route');
    await expect(page.getByRole('button', { name: 'Withdraw to Defended Ground', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(false);
  });
  test('replacement assessment, escrow refund, offline dispatch, physical return and rehire retain municipal and remote state', async ({ page }) => {
    await start(page); await depart(page);
    await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ beasts: [{ id: 'persistent-remains', cell: { x: 30, y: 12, z: 8 }, status: 'dead', health: 0 }] }));
    await advanceTo(page, (await snap(page)).trip.pickup.closesAt);
    expect(await page.evaluate(() => window.helixHeresyDebug.toggleWildernessRadio())).toBe(true);
    const before = await snap(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(true);
    let saved = await snap(page); expect(saved.trip.request.status).toBe('acknowledged'); expect(saved.money).toBe(before.money - saved.trip.terms.replacementFee);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(false);
    await advanceTo(page, saved.trip.request.reviewAt); saved = await snap(page);
    expect(saved.trip.request.status).toBe('refused'); expect(saved.money).toBe(before.money);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await advanceTo(page, saved.trip.providerReadyAt + 1);
    expect((await snap(page)).money).toBe(before.money);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestUnsupportedPickup())).toBe(true);
    const acknowledged = (await snap(page)).lastReport;
    await page.evaluate(() => window.helixHeresyDebug.toggleWildernessRadio());
    await advanceTo(page, (await snap(page)).trip.request.reviewAt);
    saved = await snap(page); expect(saved.trip.request.status).toBe('accepted'); expect(saved.lastReport).toEqual(acknowledged);
    await advanceTo(page, saved.trip.pickup.opensAt); expect((await snap(page)).trip.pickup.status).toBe('waiting');
    await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ cell: { x: 25, y: 12, z: 8 } }));
    expect(await page.evaluate(() => window.helixHeresyDebug.boardUnsupportedPickup())).toBe(true);
    expect((await snap(page)).roomId).toBe(Remote.ROOM); await finish(page);
    saved = await snap(page); expect(saved.roomId).toBe(Remote.CABIN_ROOM); expect(saved.trip.status).toBe('inbound');
    const carried = saved.carried.map((s) => s.id);
    await advanceTo(page, saved.trip.returnAt); saved = await snap(page);
    expect(saved.active).toBe(false); expect(saved.roomId).toBe('supportedSurveyGround'); expect(saved.phase).toBe('field');
    expect(saved.survival.destination.id).toBe('boundary-test'); expect(saved.carried.map((s) => s.id)).toEqual(carried);
    expect(saved.survival.thirst).toBeGreaterThan(before.survival.thirst);
    await advanceTo(page, saved.trip.returnAt + Remote.TURNAROUND + 1);
    await depart(page); expect((await snap(page)).trip.id).not.toBe(before.trip.id); expect((await snap(page)).context.siteId).toBe(destination.id);
    expect((await snap(page)).beasts.actors).toMatchObject([{ id: 'persistent-remains', status: 'dead', health: 0 }]);
  });
});
