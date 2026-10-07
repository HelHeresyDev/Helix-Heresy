const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Discovery = require('../wilderness-discovery');
const Survival = require('../wilderness-survival');
const Beasts = require('../wilderness-beasts');
const clone = value => JSON.parse(JSON.stringify(value));
const key = cell => `${cell.x},${cell.y},${cell.z}`;
const destination = { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Woodland Boundary', temperatureC: 18, slopePercent: 20, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'Bounded test sector.' };
function materialized(seed = 'world-seed', place = destination) {
  const state = Discovery.create(place);
  Discovery.materialize(state, 'world', seed, place, 10);
  return state;
}

test('boundary geography is world/place stable, lazy, private and independent of visit order and run seed', () => {
  const a = Discovery.create(destination), b = Discovery.create(destination), original = clone(destination);
  expect(a.baseline).toBeNull(); expect(Discovery.publicView(a).records).toEqual([]);
  materialized('world-seed', { ...destination, id: 'other-place' });
  expect(Discovery.materialize(a, 'world', 'world-seed', destination, 10)).toEqual(Discovery.materialize(b, 'world', 'world-seed', destination, 10));
  expect(materialized('other-world').baseline.cells).not.toEqual(a.baseline.cells);
  expect(materialized('world-seed', { ...destination, id: 'other-place' }).baseline.cells).not.toEqual(a.baseline.cells);
  const runA = Survival.normalizeState({ discovery: a, runSeed: 'a' }), runB = Survival.normalizeState({ discovery: b, runSeed: 'b' });
  expect(runA.discovery.baseline).toEqual(runB.discovery.baseline);
  expect(JSON.stringify(Discovery.publicView(a))).not.toMatch(/"(?:baseline|bounds|cells|rocks|landmarks|population|truth)":|world-seed/);
  expect(destination).toEqual(original);
});

test('slope constrains obstacles while the entrance, withdrawal lane and every walkable tile remain connected', () => {
  for (let i = 0; i < 24; i++) {
    for (const slopePercent of [5, 25]) {
      const { baseline } = materialized(`world-${i}`, { ...destination, slopePercent });
      expect(baseline.rocks).toHaveLength(slopePercent > 15 ? 14 : 6);
      expect(Discovery.connected(baseline.cells)).toBe(true);
      const allowed = new Set(baseline.cells.map(key));
      for (let x = 21; x < 37; x++) expect(allowed.has(key({ x, y: 12, z: 6 }))).toBe(true);
      for (const rock of baseline.rocks) { expect(allowed.has(key(rock))).toBe(false); expect(Discovery.obstacleAt({ baseline }, rock)).toBe(true); }
      expect(baseline.cells.length + baseline.rocks.length).toBe(192);
      expect(baseline.landmarks.every(row => allowed.has(key(row.cell)) || baseline.rocks.some(rock => key(rock) === key(row.cell)))).toBe(true);
      expect(Beasts.materialize('run', destination.id, [], baseline.cells, 0).actors).toEqual([]);
    }
  }
});

test('surface observations require proximity and sight; changed facts are dated and unseen changes never refresh copies', () => {
  const state = materialized(), landmark = state.baseline.landmarks.find(row => row.id === 'weathered-rock');
  Discovery.observe(state, 20, { ...landmark.cell, z: 7 }, () => true, () => false);
  Discovery.observe(state, 20, { x: 0, y: 0, z: 6 }, () => true, () => false);
  Discovery.observe(state, 20, landmark.cell, () => false, () => false);
  expect(state.records).toEqual([]);
  Discovery.observe(state, 30, landmark.cell, cell => key(cell) === key(landmark.cell), () => false);
  expect(state.records).toHaveLength(1); expect(state.records[0].at).toBe(30);
  const before = clone(Discovery.publicView(state));
  Discovery.observe(state, 40, landmark.cell, () => false, () => true);
  expect(Discovery.publicView(state)).toEqual(before);
  Discovery.observe(state, 50, landmark.cell, cell => key(cell) === key(landmark.cell), () => true);
  expect(state.records).toHaveLength(2); expect(state.records[1]).toMatchObject({ at: 50, text: 'Previously observed rock outcrop cleared' });
  const saved = Survival.normalizeState({ discovery: clone(state) }).discovery;
  expect(Discovery.materialize(saved, 'different', 'different', destination, 999)).toEqual(state.baseline);
  Discovery.observe(saved, 60, landmark.cell, cell => key(cell) === key(landmark.cell), () => true);
  expect(saved).toEqual(state);
  const view = Discovery.publicView(saved); view.records[0].text = 'tampered';
  expect(saved).toEqual(state);
});

test('adopting an existing visited footprint never inserts rocks under actors, property or changed terrain', () => {
  const state = Discovery.create(destination), existing = materialized('older-save').baseline.cells;
  existing.push({ x: 35, y: 19, z: 6 });
  Discovery.materialize(state, 'world', 'different', destination, 100, existing);
  expect(state.baseline.cells).toEqual(existing); expect(state.baseline.rocks).toEqual([]);
});

async function start(page) {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug);
  await page.evaluate(destination => {
    const debug = window.helixHeresyDebug;
    debug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'world-test', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'survey-test', publicProspects: {}, truth: {} } });
    debug.configureWildernessTest({ destination, mode: 'wilderness', autoCare: false });
    debug.configureUnsupportedTest({ municipal: true, carry: ['drinkingWater'] });
  }, destination);
  await page.locator('#debugToggleBtn').click();
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.boundaryDiscoverySnapshot());
async function walk(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true, urgent: true }), { room, cell })).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(90));
  const saved = await page.evaluate(() => window.helixHeresyDebug.wildernessSnapshot());
  expect(saved.scientistCell, JSON.stringify(saved.tasks)).toEqual(cell);
}

test('physical crossing elaborates once; terrain, observations, dropped property and casualties persist through withdrawal, reload and revisit', async ({ page }) => {
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  page.once('dialog', dialog => dialog.dismiss());
  expect(await page.evaluate(() => window.helixHeresyDebug.enterWilderness())).toBe(false);
  let saved = await snapshot(page);
  expect(saved.discovery).toBeNull(); expect(saved.cells).toHaveLength(2);
  expect((await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot())).materialized).toBe(false);
  page.on('dialog', dialog => dialog.accept());
  expect(await page.evaluate(() => window.helixHeresyDebug.enterWilderness())).toBeTruthy();
  expect((await snapshot(page)).discovery).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(90));
  saved = await snapshot(page);
  expect(saved.discovery.baseline.cells.length).toBeGreaterThan(150);
  expect(saved.public.records.some(record => record.subject === 'entrance-ground')).toBe(true);
  expect(saved.public.records.some(record => record.subject === 'bare-clearing')).toBe(false);
  expect((await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot())).materialized).toBe(true);
  const baseline = clone(saved.discovery.baseline);
  await page.evaluate(() => window.helixHeresyDebug.setMapOverlay('prospecting'));
  const initialOverlays = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().overlays);
  expect(initialOverlays.some(row => /Weathered rock outcrop|Bare surface clearing/.test(row.label))).toBe(false);
  // Install one actual saved corpse, not a new encounter generator.
  await page.evaluate(() => window.helixHeresyDebug.configureWildernessBeastsTest({ actors: [{ id: 'saved-corpse', cell: { x: 23, y: 17, z: 6 }, status: 'dead', health: 0 }] }));
  const rock = baseline.landmarks.find(row => row.id === 'weathered-rock').cell;
  const adjacent = [{ ...rock, x: rock.x - 1 }, { ...rock, x: rock.x + 1 }, { ...rock, y: rock.y - 1 }, { ...rock, y: rock.y + 1 }].find(cell => baseline.cells.some(row => key(row) === key(cell)));
  const opposite = { x: rock.x * 2 - adjacent.x, y: rock.y * 2 - adjacent.y, z: 6 };
  const terrain = await page.evaluate(({ from, to }) => window.helixHeresyDebug.boundaryDiscoverySnapshot(from, to), { from: adjacent, to: opposite });
  expect(terrain.sight).toBe(false);
  if (baseline.cells.some(row => key(row) === key(opposite))) { expect(terrain.path.length).toBeGreaterThan(3); expect(terrain.path.some(cell => key(cell) === key(rock))).toBe(false); }
  await walk(page, Survival.ROOM, adjacent);
  expect((await snapshot(page)).public.records.some(row => row.subject === 'weathered-rock')).toBe(true);
  const renderedRock = await page.evaluate(rock => window.helixHeresyDebug.mapSceneSnapshot().cells.find(cell => cell.key === `${rock.x},${rock.y},${rock.z}`), rock);
  expect(renderedRock.knowledge.state).toBe('current');
  expect(renderedRock.base).toMatchObject({ kind: 'solidEarth', materialId: 'stone' });
  expect(await page.evaluate(rock => window.helixHeresyDebug.geologyCellSnapshot(rock), rock)).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'))).toBe('canvas');
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('dom'));
  const dropped = await page.evaluate(() => {
    const debug = window.helixHeresyDebug, water = debug.wildernessSnapshot().carried.find(stack => stack.key === 'drinkingWater');
    debug.dropActorStack('scientist', water.id);
    return debug.exportSurveyExpeditionTestState().physicalItemStacks.find(stack => stack.id === water.id);
  });
  expect(dropped.carriedBy).toBeFalsy(); expect(dropped.cell).toEqual(adjacent);
  await page.evaluate(rock => { const debug = window.helixHeresyDebug; debug.setExcavatedCells([rock]); debug.advanceSimulation(1); }, rock);
  expect((await snapshot(page)).public.records.filter(row => row.subject === 'weathered-rock')).toHaveLength(2);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-boundary-discovery]')).toContainText('rock outcrop cleared');
  await page.evaluate(() => window.helixHeresyDebug.setMapOverlay('prospecting'));
  const journal = clone((await snapshot(page)).public);
  await walk(page, 'supportedSurveyGround', { x: 10, y: 10, z: 6 });
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snapshot(page)).public).toEqual(journal);
  await expect(page.locator('[data-boundary-discovery]')).toContainText('rock outcrop cleared');
  const remembered = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().overlays.find(row => row.label.startsWith('Previously observed rock outcrop cleared')));
  expect(remembered.knowledge.state).toBe('stale');
  expect(remembered.knowledge.observedAt).toBe(journal.records.filter(row => row.subject === 'weathered-rock').at(-1).at);
  await walk(page, Survival.ROOM, Survival.ENTRY);
  saved = await snapshot(page);
  expect(saved.discovery.baseline).toEqual(baseline);
  expect((await page.evaluate(rock => window.helixHeresyDebug.boundaryDiscoverySnapshot(rock, rock), rock)).path).toHaveLength(1);
  expect((await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot())).actors).toMatchObject([{ id: 'saved-corpse', status: 'dead', health: 0 }]);
  expect(await page.evaluate(id => window.helixHeresyDebug.exportSurveyExpeditionTestState().physicalItemStacks.find(stack => stack.id === id), dropped.id)).toEqual(dropped);
  expect(errors).toEqual([]);
});
