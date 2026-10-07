const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Discovery = require('../wilderness-discovery');
const Remote = require('../unsupported-excursions');
const Beasts = require('../wilderness-beasts');
const clone = value => JSON.parse(JSON.stringify(value));
const key = cell => `${cell.x},${cell.y},${cell.z}`;
const destination = { id: 'remote-survey:planet-cell:00003', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Remote Woodland', distanceKm: 42, temperatureC: 18, slopePercent: 18, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'No implemented overland return route.' };
function materialized(seed = 'world', slopePercent = 18) {
  const state = Discovery.create(destination, 'remote');
  Discovery.materialize(state, 'world', seed, { ...destination, slopePercent }, 20);
  return state;
}

test('remote elaboration is lazy and world/place seeded, with a clear landing footprint and connected terrain', () => {
  const empty = Discovery.create(destination, 'remote');
  expect(empty.baseline).toBeNull(); expect(Discovery.publicView(empty).records).toEqual([]);
  for (const slope of [5, 18]) for (let i = 0; i < 16; i++) {
    const a = materialized(`seed-${i}`, slope), b = materialized(`seed-${i}`, slope);
    expect(a.baseline).toEqual(b.baseline); expect(a.baseline.rocks).toHaveLength(slope > 15 ? 14 : 6);
    expect(Discovery.connected(a.baseline.cells, Remote.LANDING)).toBe(true);
    expect(a.baseline.bounds).toEqual(Discovery.REMOTE_BOUNDS);
    for (let x = 22; x <= 24; x++) for (let y = 11; y <= 13; y++) expect(a.baseline.cells).toContainEqual({ x, y, z: Remote.Z });
    expect(a.baseline.cells.every(cell => cell.z === Remote.Z)).toBe(true);
    expect(a.baseline.landmarks.find(row => row.id === 'landing-ground').text).toContain('no defended perimeter');
    expect(JSON.stringify(Discovery.publicView(a))).not.toMatch(/"(?:baseline|bounds|cells|rocks|landmarks|population|truth)":/);
  }
  const other = Discovery.create({ ...destination, id: 'another-place' }, 'remote');
  Discovery.materialize(other, 'world', 'world', destination, 20);
  expect(other.baseline.cells).not.toEqual(materialized().baseline.cells);
});

test('remote observations require the actual layer, proximity and sight, retain dates and survive site save/load independently', () => {
  const state = materialized(), rock = state.baseline.landmarks.find(row => row.id === 'weathered-rock').cell;
  Discovery.observe(state, 30, { ...rock, z: 6 }, () => true, () => false);
  Discovery.observe(state, 30, Remote.LANDING, () => false, () => false);
  expect(state.records).toEqual([]);
  Discovery.observe(state, 40, Remote.LANDING, () => true, () => false);
  expect(state.records.every(row => row.cell.z === Remote.Z && row.source === 'Scientist remote-site observation')).toBe(true);
  expect(state.records.some(row => row.subject === 'bare-clearing')).toBe(false);
  Discovery.observe(state, 50, rock, cell => key(cell) === key(rock), () => false);
  const before = clone(Discovery.publicView(state));
  Discovery.observe(state, 60, rock, () => false, () => true);
  expect(Discovery.publicView(state)).toEqual(before);
  Discovery.observe(state, 70, rock, cell => key(cell) === key(rock), () => true);
  const saved = Remote.normalizeState({ remote: { discovery: state }, boundary: { discovery: Discovery.create({ id: 'boundary', label: 'Boundary' }) } });
  expect(Discovery.materialize(saved.remote.discovery, 'new-world', 'new-seed', destination, 500)).toEqual(state.baseline);
  expect(saved.remote.discovery.records.filter(row => row.subject === 'weathered-rock')).toMatchObject([{ at: 50 }, { at: 70 }]);
  expect(saved.boundary.discovery.records).toEqual([]); expect(saved.boundary.discovery.baseline).toBeNull();
  saved.remote.discovery.records[0].text = 'tampered'; expect(saved.remote.discovery).not.toEqual(state);
});

test('remote encounters use only supplied regional populations and run seed without changing surface geography or resurrecting casualties', () => {
  const state = materialized(), baseline = clone(state.baseline);
  expect(Beasts.materialize('run', destination.id, [], baseline.cells, 20).actors).toEqual([]);
  const populations = [{ id: 'canonical-population', speciesId: 'beast:rimefang-pack', populationIndex: 1000 }], original = clone(populations);
  const outcomes = Array.from({ length: 20 }, (_, i) => Beasts.materialize(`run-${i}`, destination.id, populations, baseline.cells, 20));
  expect(new Set(outcomes.map(row => row.actors.length)).size).toBeGreaterThan(1);
  const occupied = outcomes.find(row => row.actors.length);
  expect(occupied.actors.every(actor => actor.populationId === populations[0].id && baseline.cells.some(cell => key(cell) === key(actor.mapCell)) && key(actor.mapCell) !== key(Remote.LANDING))).toBe(true);
  occupied.actors[0].status = 'dead'; occupied.actors[0].health = 0;
  expect(Beasts.normalizeState(clone(occupied))).toEqual(occupied);
  expect(state.baseline).toEqual(baseline); expect(populations).toEqual(original);
});

async function start(page) {
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug);
  await page.evaluate(destination => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'remote-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { ...destination, id: 'boundary-test', strategicCellId: 'planet-cell:00002' }, mode: 'wilderness', autoCare: false });
    d.configureUnsupportedTest({ destination, municipal: true, carry: ['drinkingWater', 'fieldShelter'] });
  }, destination);
  await page.locator('#debugToggleBtn').click();
}
const snap = page => page.evaluate(() => window.helixHeresyDebug.unsupportedSnapshot());
const detail = page => page.evaluate(() => window.helixHeresyDebug.remoteDiscoverySnapshot());
async function advanceTo(page, at) { const saved = await snap(page); await page.evaluate(seconds => window.helixHeresyDebug.advanceUnsupportedForTest(seconds), Math.max(0, at - saved.clock)); }
async function work(page, seconds = 90) { await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), seconds); }
async function walk(page, room, cell) {
  if (key((await snap(page)).cell) === key(cell)) return;
  expect(await page.evaluate(({ room, cell }) => window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true, urgent: true }), { room, cell })).toBeTruthy();
  await work(page);
  const saved = await snap(page); expect(saved.cell, JSON.stringify(saved.tasks)).toEqual(cell);
}
async function depart(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true);
  await work(page, 40);
  const saved = await snap(page); expect(saved.roomId, JSON.stringify(saved.tasks)).toBe(Remote.CABIN_ROOM);
  return saved;
}
async function returnHome(page) {
  await walk(page, Remote.ROOM, Remote.LANDING);
  await advanceTo(page, (await snap(page)).trip.pickup.opensAt);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardUnsupportedPickup())).toBe(true);
  await work(page, 40);
  let saved = await snap(page); expect(saved.trip.status).toBe('inbound'); expect(saved.roomId).toBe(Remote.CABIN_ROOM);
  await advanceTo(page, saved.trip.returnAt);
  saved = await snap(page); expect(saved.active).toBe(false); expect(saved.roomId).toBe('supportedSurveyGround');
}

test('remote arrival before boundary exploration keeps separate journals, physical terrain, shelter, property and actors across two charters', async ({ page }) => {
  test.setTimeout(480000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  expect((await detail(page)).discovery).toBeNull();
  let saved = await depart(page);
  expect((await detail(page)).cells).toHaveLength(9); expect((await detail(page)).discovery).toBeNull();
  expect(saved.beasts.materialized).toBe(false);
  await advanceTo(page, saved.trip.fieldAt - 1);
  expect((await detail(page)).discovery).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advanceTo(page, saved.trip.fieldAt);
  saved = await snap(page);
  expect(saved.roomId).toBe(Remote.ROOM); expect(saved.beasts).toMatchObject({ materialized: true, siteId: destination.id, actors: [] });
  expect(saved.survival.discovery.kind).toBe('remote'); expect(saved.boundary.discovery).toBeNull();
  const baseline = clone((await detail(page)).discovery.baseline);
  expect(baseline.materializedAt).toBe(saved.trip.fieldAt);
  expect((await detail(page)).public.records.some(row => row.subject === 'landing-ground')).toBe(true);
  expect((await detail(page)).public.records.some(row => row.subject === 'bare-clearing')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('deployShelter'))).toBe(true);
  await work(page, 150); const shelter = clone((await snap(page)).survival.shelter);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ beasts: [{ id: 'remote-corpse', cell: { x: 22, y: 8, z: 8 }, status: 'dead', health: 0 }] }));
  const rock = baseline.landmarks.find(row => row.id === 'weathered-rock').cell;
  const adjacent = [{ ...rock, x: rock.x - 1 }, { ...rock, x: rock.x + 1 }, { ...rock, y: rock.y - 1 }, { ...rock, y: rock.y + 1 }].find(cell => baseline.cells.some(row => key(row) === key(cell)));
  await walk(page, Remote.ROOM, adjacent);
  const rendering = await page.evaluate(rock => ({ cell: window.helixHeresyDebug.mapSceneSnapshot().cells.find(row => row.key === `${rock.x},${rock.y},${rock.z}`), geology: window.helixHeresyDebug.geologyCellSnapshot(rock) }), rock);
  expect(rendering.cell.base).toMatchObject({ kind: 'solidEarth', materialId: 'stone' }); expect(rendering.geology).toBeNull();
  const dropped = await page.evaluate(() => {
    const d = window.helixHeresyDebug, water = d.wildernessSnapshot().carried.find(row => row.key === 'drinkingWater');
    d.dropActorStack('scientist', water.id);
    return d.exportSurveyExpeditionTestState().physicalItemStacks.find(row => row.id === water.id);
  });
  expect(dropped.cell).toEqual(adjacent); expect(dropped.carriedBy).toBeFalsy();
  await page.evaluate(rock => window.helixHeresyDebug.setExcavatedCells([rock]), rock); await work(page, 1);
  const journal = clone((await detail(page)).public);
  expect(journal.records.filter(row => row.subject === 'weathered-rock')).toHaveLength(2);
  await returnHome(page);
  expect((await detail(page)).public).toEqual(journal);
  expect((await page.evaluate(() => window.helixHeresyDebug.boundaryDiscoverySnapshot())).discovery).toBeNull();
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-remote-discovery]')).toContainText('rock outcrop cleared');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await detail(page)).public).toEqual(journal);
  // Visit the boundary independently, then prove its records and wounded
  // body cannot be inherited by, or replaced with, the remote site.
  expect(await page.evaluate(() => window.helixHeresyDebug.enterWilderness())).toBe(true); await work(page);
  await page.evaluate(() => window.helixHeresyDebug.configureWildernessBeastsTest({ actors: [{ id: 'wounded-boundary', cell: { x: 23, y: 17, z: 6 }, health: 40, nextMoveAt: 1000000, nextAttackAt: 1000000 }] }));
  const boundary = clone((await page.evaluate(() => window.helixHeresyDebug.boundaryDiscoverySnapshot())).discovery);
  await walk(page, 'supportedSurveyGround', { x: 10, y: 10, z: 6 });
  await advanceTo(page, (await snap(page)).trip.returnAt + Remote.TURNAROUND + 1);
  saved = await depart(page); await advanceTo(page, saved.trip.fieldAt);
  expect((await detail(page)).discovery.baseline).toEqual(baseline);
  expect((await detail(page)).public).toEqual(journal);
  saved = await snap(page); expect(saved.survival.shelter).toEqual(shelter);
  expect(saved.beasts.actors).toMatchObject([{ id: 'remote-corpse', health: 0, status: 'dead', mapCell: { x: 22, y: 8, z: 8 } }]);
  expect(saved.boundary.discovery).toEqual(boundary); expect(saved.boundary.beasts.actors).toMatchObject([{ id: 'wounded-boundary', health: 40 }]);
  expect((await page.evaluate(rock => window.helixHeresyDebug.remoteDiscoverySnapshot(rock, rock), rock)).path).toHaveLength(1);
  expect(await page.evaluate(id => window.helixHeresyDebug.exportSurveyExpeditionTestState().physicalItemStacks.find(row => row.id === id), dropped.id)).toEqual(dropped);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  await returnHome(page);
  expect((await page.evaluate(() => window.helixHeresyDebug.boundaryDiscoverySnapshot())).discovery).toEqual(boundary);
  expect((await snap(page)).beasts.actors).toMatchObject([{ id: 'wounded-boundary', health: 40 }]);
  await expect(page.locator('[data-boundary-discovery]')).toContainText('defended entrance');
  await expect(page.locator('[data-remote-discovery]')).toContainText('rock outcrop cleared');
  expect(errors).toEqual([]);
});
