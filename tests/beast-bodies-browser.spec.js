const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(300000);
const cell = (x, y = 12) => ({ x, y, z: 6 });
const snap = (page, id) => page.evaluate(id => window.helixHeresyDebug.beastBodySnapshot(id), id);
async function place(page, species, id, position, options = {}) {
  await page.evaluate(({ species, id, position, options }) => {
    const d = window.helixHeresyDebug, clock = d.wildernessBeastSnapshot().clock;
    const original = window.HelixWildernessBeasts.actor(species, id, position, 'original-prepared-source', clock);
    // Original source pose/terrain inputs only; no movement, injury, spending,
    // partial-progress, observation or outcome flags are injected.
    if (options.mode) original.bodyPhysics.mode = options.mode;
    if (options.altitude !== undefined) original.bodyPhysics.altitudeM = options.altitude;
    const bodyTerrain = {};
    for (let y = 8; y < 20; y++) for (let x = 21; x < 37; x++) {
      const water = options.waterRows?.includes(y) || options.waterFromX !== undefined && x >= options.waterFromX;
      bodyTerrain[`${x},${y},6`] = { floor: true, waterDepthM: water ? 5 : 0, waterClarityM: 5,
        soilDepthM: 8, hardness: 1, densityKgM3: 1500, materialKg: 12000, supportKg: 100000,
        wind: { x: .2, y: 0 }, current: { x: .1, y: 0 }, ceilingM: 100, oxygen: true };
    }
    d.configureWildernessBeastsTest({ actors: [{ ...original, cell: position }], bodyTerrain, scientistCell: options.scientistCell || { x: 24, y: 12, z: 6 } });
    d.setMapOverlay('prospecting');
  }, { species, id, position, options });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: physical flight, saved/imported original pose, water, colossal body and finite excavation`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await startLifecycleRun(page, `bodies-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'body-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Physical shoreline', temperatureC: 18, slopePercent: 5, precipitationMm: 500, terrain: 'ground', jurisdiction: 'Wilderness', description: 'Prepared original physical inputs.' }, mode: 'wilderness', autoCare: false });
  }, renderer);
  await place(page, 'beast:ley-manta', 'original-manta', cell(25, 10), { mode: 'levitation', altitude: 4 });
  await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page, 'original-manta')).strikeReason).toMatch(/range|reach|outside/i);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-manta', 'levitation', { x: 30, y: 10, z: 6 }))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  let s = await snap(page, 'original-manta');
  // The actual local AI retains agency and can turn toward its perceived target;
  // the request is a supported intent, not an injected movement outcome.
  expect(s.actor.bodyPhysics.distanceM, JSON.stringify({ body: s.actor.bodyPhysics, reasons: s.movementReasons })).toBeGreaterThan(0);
  expect(s.actor.bodyPhysics.altitudeM).toBeGreaterThan(4);
  expect(s.actor.bodyPhysics.mana).toBeLessThan(1200);
  expect(s.knowledge.sightings.find(a => a.id === 'original-manta').heightM).toBe(s.actor.bodyPhysics.altitudeM);
  expect(s.footprint.mask.length).toBeGreaterThan(1);
  await expect(page.locator('[data-wilderness-beasts]')).toContainText('levitation');
  const scene = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.mapSceneSnapshot()));
  expect(scene).toContain('observed body footprint');
  const pose = s.actor.bodyPhysics;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page, 'original-manta'); expect(s.actor.bodyPhysics).toEqual(pose);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = bundle.run.id;
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-body.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect((await snap(page, 'original-manta')).actor.bodyPhysics).toEqual(pose);
  expect((await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot())).run.id).not.toBe(oldRun);
  // The debug renderer switch is deliberately session-only; select it again
  // after reload/import so subsequent checks really exercise this renderer.
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  expect((await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot())).mode).toBe(renderer);

  await place(page, 'beast:storm-kite', 'original-kite', cell(26, 10));
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-kite', 'flight', { x: 30, y: 10, z: 6 }))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(2));
  s = await snap(page, 'original-kite'); expect(s.actor.bodyPhysics.altitudeM).toBeGreaterThan(0);
  expect(s.actor.bodyPhysics.distanceM).toBeGreaterThan(0); expect(s.actor.bodyPhysics.stamina).toBeLessThan(300);

  await place(page, 'beast:mire-choir', 'original-amphibian', cell(26), { waterFromX: 27 });
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-amphibian', 'swimming', { x: 27, y: 12, z: 6 }, true))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  s = await snap(page, 'original-amphibian');
  expect(s.actor.bodyPhysics.motion.transition.mode).toBe('swimming');
  expect(s.actor.mapCell.x).toBe(26); expect(s.actor.bodyPhysics.altitudeM).toBeLessThan(0);
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(3));
  s = await snap(page, 'original-amphibian'); expect(s.actor.bodyPhysics.mode).toBe('swimming'); expect(s.actor.mapCell.x).toBe(27);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('wildernessSurveySector',
    { toCell: { x: 28, y: 12, z: 6 }, allowMultiRoom: true, urgent: true })))).toBe(false);

  await place(page, 'beast:rivercoil', 'original-colossal', cell(21, 9), { mode: 'swimming', altitude: -3, waterRows: [9, 10, 11] });
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-colossal', 'swimming', { x: 22, y: 9, z: 6 }))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  s = await snap(page, 'original-colossal'); expect(s.actor.mapCell.x).toBe(22); expect(s.footprint.mask.length).toBeGreaterThan(20);
  expect(s.actor.bodyPhysics.massKg).toBe(40000);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-colossal', 'swimming', { x: 22, y: 14, z: 6 }))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  s = await snap(page, 'original-colossal'); expect(s.actor.bodyPhysics.blockedReason).toContain('Turning clearance');
  expect(s.actor.bodyPhysics.heading).toBe(0);

  await place(page, 'beast:burrowing-furnace', 'original-burrower', cell(26, 15));
  expect(await page.evaluate(() => window.helixHeresyDebug.beastBodyRequestForTest('original-burrower', 'burrowing', { x: 28, y: 15, z: 6 }))).toMatchObject({ ok: true });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(2));
  s = await snap(page, 'original-burrower');
  expect(s.actor.bodyPhysics.motion.progressM).toBeGreaterThan(0); expect(s.actor.bodyPhysics.motion.excavatedKg).toBeGreaterThan(0);
  expect(s.visible).toBe(false); expect(s.knowledge.sightings.some(a => a.id === 'original-burrower')).toBe(false);
  const soil = s.terrain, motion = s.actor.bodyPhysics;
  expect(Object.values(soil).some(t => t.rubbleKg > 0)).toBe(true);
  for (const t of Object.values(soil)) expect(t.materialKg + (t.rubbleKg || 0)).toBeCloseTo(12000, 8);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  s = await snap(page, 'original-burrower'); expect(s.actor.bodyPhysics).toEqual(motion); expect(s.terrain).toEqual(soil);
  expect((await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot())).mode).toBe(renderer);
  expect(errors).toEqual([]);
});
