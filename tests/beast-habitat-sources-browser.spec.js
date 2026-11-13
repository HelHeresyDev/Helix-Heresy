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
      private: !JSON.stringify(world.generatedData.strategicMap.publicBeastAtlas || {}).includes('foodAllocations'),
      validated: S.validate(source, world.generatedData.strategicMap, world.worldSeed).id === source.id };
  });
  expect(original.species).toBe(24); expect(original.private).toBe(true); expect(original.validated).toBe(true);
  expect(original.status).toBe('rejected');
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click();
  await expect(page.locator('body')).toContainText(original.name);
  await expect(page.locator('body')).not.toContainText('unfundedPrey');
  await expect(page.locator('body')).not.toContainText('foodAllocations');
  const loaded = await page.evaluate(id => {
    const L = window.HelixWorldRunLibrary, S = window.HelixBeastHabitatSources;
    const world = L.createRepository(localStorage).getWorld(id), map = world.generatedData.strategicMap;
    let unavailable = false;
    try { S.runtimeSource(map.beastHabitatSources, map); } catch { unavailable = true; }
    return { digest: world.canonicalDigest, sourceId: map.beastHabitatSources.id, unavailable };
  }, original.id);
  expect(loaded).toEqual({ digest: original.digest, sourceId: original.sourceId, unavailable: true });
  expect(errors).toEqual([]);
});
