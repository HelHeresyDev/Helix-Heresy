const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
test('browser generation, compressed world storage and reload preserve private rejected habitat proposals', async ({ page }) => {
  test.setTimeout(120000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastHabitatSources);
  const original = await page.evaluate(() => {
    const L = window.HelixWorldRunLibrary, S = window.HelixBeastHabitatSources;
    localStorage.clear();
    const world = L.createWorld({ id: 'browser-habitat-world', worldSeed: 'source-small', generationVersion: 8,
      createdAt: 'test', creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const source = world.generatedData.strategicMap.beastHabitatSources;
    L.createRepository(localStorage).putWorld(world);
    return { id: world.id, name: world.name, digest: world.canonicalDigest, sourceId: source.id,
      status: source.assessment.status, species: new Set(source.populations.map(p => p.speciesId)).size,
      journeyGroups: source.assessment.seasonalJourneys.length,
      travellingDays: source.assessment.seasonalJourneys.reduce((n, g) => n + g.travellingDays, 0),
      blanketUnverified: source.assessment.issues.some(i => i.kind === 'seasonalResidenceUnverified'),
      private: !JSON.stringify(world.generatedData.strategicMap.publicBeastAtlas || {}).includes('foodAllocations'),
      workSites: source.physicalBinding.workSites.length, nurseries: source.physicalBinding.nurseries.length,
      establishedHabitats: source.establishedHabitats === true, initialConstruction: source.physicalBinding.initialWork.length,
      wetlandDrainage: source.wetlandDrainage === true,
      physicalDigest: window.HelixStrategicWorld.stableHash(source.physicalBinding),
      wildlifeDigest: window.HelixStrategicWorld.stableHash(source.backgroundWildlife),
      wildlifeDistribution: source.backgroundWildlife.distribution,
      preyClasses: [...new Set(window.HelixBackgroundWildlife.definitions(source.backgroundWildlife, S.expand(source, world.generatedData.strategicMap).regions)
        .flatMap(a => a.pools.map(p => p.sizeClass)))].sort(),
      validated: S.validate(source, world.generatedData.strategicMap, world.worldSeed).id === source.id };
  });
  expect(original.species).toBe(24); expect(original.private).toBe(true); expect(original.validated).toBe(true);
  expect(original.status).toBe('rejected');
  expect(original.journeyGroups).toBeGreaterThan(0); expect(original.travellingDays).toBeGreaterThan(0);
  expect(original.blanketUnverified).toBe(false);
  expect(original.workSites).toBeGreaterThan(0); expect(original.nurseries).toBeGreaterThan(0);
  expect(original.establishedHabitats).toBe(true); expect(original.initialConstruction).toBeGreaterThan(0);
  expect(original.wetlandDrainage).toBe(true);
  expect(original.preyClasses).toEqual(['large', 'medium', 'small']);
  expect(original.wildlifeDistribution).toBe('habitatPatches');
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click();
  await expect(page.locator('body')).toContainText(original.name);
  await expect(page.locator('body')).not.toContainText('unfundedPrey');
  await expect(page.locator('body')).not.toContainText('foodAllocations');
  await expect(page.locator('body')).not.toContainText('seasonalResourceDeficit');
  const loaded = await page.evaluate(id => {
    const L = window.HelixWorldRunLibrary, S = window.HelixBeastHabitatSources, P = window.HelixBeastPopulations;
    const world = L.createRepository(localStorage).getWorld(id), map = world.generatedData.strategicMap;
    const before = JSON.stringify(world), binding = { worldId: id, runId: 'private-browser-replay' };
    const first = S.replay(map.beastHabitatSources, map, { binding, until: P.DAY / 8 });
    const saved = JSON.parse(JSON.stringify(first.account));
    const branchBinding = { worldId: id, runId: 'continued-browser-replay' };
    const branch = P.rebind(saved, binding, branchBinding);
    const continued = S.replay(map.beastHabitatSources, map, { binding: branchBinding, account: branch, until: P.DAY / 4 });
    const direct = S.replay(map.beastHabitatSources, map, { binding, until: P.DAY / 4 });
    let unavailable = false;
    try { S.runtimeSource(map.beastHabitatSources, map); } catch { unavailable = true; }
    return { digest: world.canonicalDigest, sourceId: map.beastHabitatSources.id, unavailable,
      workSites: map.beastHabitatSources.physicalBinding.workSites.length,
      nurseries: map.beastHabitatSources.physicalBinding.nurseries.length,
      physicalDigest: window.HelixStrategicWorld.stableHash(map.beastHabitatSources.physicalBinding),
      wildlifeDigest: window.HelixStrategicWorld.stableHash(map.beastHabitatSources.backgroundWildlife),
      startingDead: window.HelixBackgroundWildlife.summary(continued.account).startingDead,
      initialHistoryMatches: window.HelixBackgroundWildlife.summary(continued.account).startingDead
        === window.HelixBackgroundWildlife.summary(direct.account).startingDead,
      diagnosticOnly: continued.account.diagnosticOnly, status: continued.report.status,
      assessmentStage: continued.report.viability.stage, preliminaryWarnings: continued.report.viability.warnings.length,
      originalSpecies: continued.report.viability.coverage.species.length,
      continuationMatches: JSON.stringify(continued.report.counts) === JSON.stringify(direct.report.counts)
        && Object.entries(direct.report.work).every(([key, n]) => Math.abs(continued.report.work[key] - n) <= 1e-8 * Math.max(1, n)),
      paidWork: Object.values(continued.report.work).some(n => n > 0), unchanged: JSON.stringify(world) === before };
  }, original.id);
  expect(loaded.startingDead).toBeGreaterThan(0);
  expect(loaded).toEqual({ digest: original.digest, sourceId: original.sourceId, unavailable: true,
    workSites: original.workSites, nurseries: original.nurseries, physicalDigest: original.physicalDigest,
    wildlifeDigest: original.wildlifeDigest,
    startingDead: loaded.startingDead, initialHistoryMatches: true,
    diagnosticOnly: true, status: 'incomplete', assessmentStage: 'measured', preliminaryWarnings: loaded.preliminaryWarnings,
    originalSpecies: 24, continuationMatches: true, paidWork: true, unchanged: true });
  expect(loaded.preliminaryWarnings).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('default-resolution generated bindings fit actual compressed browser world storage', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastHabitatSources);
  const original = await page.evaluate(() => {
    localStorage.clear();
    const L = window.HelixWorldRunLibrary;
    const world = L.createWorld({ id: 'default-binding-storage', worldSeed: 'source-small', generationVersion: 8, createdAt: 'test' });
    const map = world.generatedData.strategicMap;
    L.createRepository(localStorage).putWorld(world);
    return { id: world.id, digest: world.canonicalDigest, cells: map.topology.cellCount, sourceId: map.beastHabitatSources.id };
  });
  expect(original.cells).toBe(10242);
  await page.reload(); await page.waitForFunction(() => window.HelixWorldRunLibrary);
  const loaded = await page.evaluate(id => {
    const world = window.HelixWorldRunLibrary.createRepository(localStorage).getWorld(id);
    return { digest: world.canonicalDigest, sourceId: world.generatedData.strategicMap.beastHabitatSources.id };
  }, original.id);
  expect(loaded).toEqual({ digest: original.digest, sourceId: original.sourceId });
  expect(errors).toEqual([]);
});
