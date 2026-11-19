const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
for (const renderer of ['dom', 'canvas']) test(`${renderer}: generated original population handoff persists through game save and continued import`, async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const world = await page.evaluate(catalog => {
    const L = window.HelixWorldRunLibrary, W = window.HelixStrategicWorld;
    const w = L.createWorld({ id: 'native-browser', worldSeed: 'native-encounters', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    // Authored public starting parcels only; generated population originals,
    // private habitat and account inputs are untouched.
    const m = w.generatedData.strategicMap; delete catalog.digest;
    for (const c of catalog.scenarioRows[0].candidates) c.strategicCellId = W.cellId(m.surface.classes.indexOf('L'));
    catalog.digest = `strategic-starting-sites-${W.stableHash(catalog)}`;
    m.strategicStartingSites = catalog; m.publicStartingSiteDirectory = JSON.parse(JSON.stringify(catalog));
    return L.createWorld({ ...w, generatedData: { ...w.generatedData, strategicMap: W.finalizeStrategicMap(m) } });
  }, lifecycleWorld().generatedData.strategicMap.strategicStartingSites);
  await startLifecycleRun(page, `native-${renderer}`, world);
  const source = await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'native-browser', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'native-test', publicProspects: {}, truth: {} } });
    const source = d.configureNativeBeastSiteForTest('beast:rimefang-pack'); d.setMapOverlay('prospecting'); return source;
  }, renderer);
  expect(source).toBeTruthy();
  const first = await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot());
  const actor = first.actors.find(a => a.populationId === source.populationId || a.speciesId === 'beast:rimefang-pack');
  expect(actor).toBeTruthy(); expect(actor.nativePopulation.sourceId).toBe(source.sourceId);
  expect(actor.life.originalMemberId).toBeTruthy(); expect(actor.bodyPhysics.stamina).toBe(0);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-wilderness-beasts]')).toContainText('Population-backed');
  const observation = await page.evaluate(id => window.helixHeresyDebug.beastBodySnapshot(id), actor.id);
  expect(observation.visible).toBe(true);
  expect(observation.knowledge.sightings.some(a => a.id === actor.id)).toBe(true);
  const sceneEvidence = await page.evaluate(({ name, cells }) => {
    const d = window.helixHeresyDebug, scene = d.mapSceneSnapshot();
    // This original may be a one-cell juvenile: require its actual observed
    // volume, not the adult-only extra-footprint wording used by fixture tests.
    return cells.every(p => scene.cells.some(c => c.cell.x === p.x && c.cell.y === p.y && c.cell.z === p.z
      && c.overlay?.source === 'Run-owned field observation' && c.overlay.label.includes(name)));
  }, { name: actor.name, cells: observation.knowledge.sightings.find(a => a.id === actor.id).visibleBodyCells });
  expect(sceneEvidence).toBe(true);
  expect((await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot())).mode).toBe(renderer);
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  const before = await page.evaluate(id => window.helixHeresyDebug.beastBodySnapshot(id), actor.id);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  const loaded = await page.evaluate(id => window.helixHeresyDebug.beastBodySnapshot(id), actor.id);
  expect(loaded.actor).toEqual(before.actor); expect(loaded.terrain).toEqual(before.terrain);
  expect(errors).toEqual([]);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2,
    ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = bundle.run.id;
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'native-continued.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  const continued = await page.evaluate(id => window.helixHeresyDebug.beastBodySnapshot(id), actor.id);
  expect(continued.actor).toEqual(before.actor); expect(continued.terrain).toEqual(before.terrain);
  const branch = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(branch.run.id).not.toBe(oldRun);
  expect(branch.run.state.nativeBeastPopulations.runId).toBe(branch.run.id);
  expect(branch.world.canonicalDigest).toBe(bundle.world.canonicalDigest);
  expect(errors).toEqual([]);
});
