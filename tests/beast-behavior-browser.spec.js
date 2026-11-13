const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(360000);
const snap = (page, id) => page.evaluate(id => window.helixHeresyDebug.beastBehaviorSnapshot(id), id);
async function setup(page, renderer) {
  await startLifecycleRun(page, `behavior-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'behavior-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Original habitat', temperatureC: 18, slopePercent: 5, precipitationMm: 500, terrain: 'ground', jurisdiction: 'Wilderness', description: 'Prepared original biological sources.' }, mode: 'wilderness', autoCare: false });
  }, renderer);
}
async function place(page, species, id, separation, habitat) {
  return page.evaluate(({ species, id, separation, habitat }) => {
    const d = window.helixHeresyDebug;
    d.configureWildernessBeastsTest({ actors: [] });
    const cells = d.boundaryDiscoverySnapshot().cells;
    const keys = new Set(cells.map(c => `${c.x},${c.y}`));
    const fit = cells.find(c => c.x >= 27 && c.x <= 31 && c.y >= 10 && c.y <= 15
      && Array.from({ length: 3 }, (_, dx) => Array.from({ length: 2 }, (_, dy) => keys.has(`${c.x + dx},${c.y + dy}`))).flat().every(Boolean)
      && Array.from({ length: separation }, (_, i) => keys.has(`${c.x - i - 1},${c.y}`)).every(Boolean));
    if (!fit) throw Error('No original clear field source fits these bodies');
    const clock = d.wildernessBeastSnapshot().clock, original = window.HelixWildernessBeasts.actor(species, id, fit, 'original-biological-population', clock);
    const terrain = {};
    for (const c of cells) terrain[`${c.x},${c.y},${c.z}`] = { floor: true, temperatureC: 20, soilDepthM: 8,
      hardness: 1, densityKgM3: 1500, materialKg: 12000, supportKg: 100000, oxygen: true, wind: { x: 3, y: 0 },
      areaHa: .0001, condition: { soilCover: 40, freshwaterQuantity: 40, freshwaterQuality: 40, wetlandReefHabitat: 40, renewableBiomass: 40, arcaneStability: 40 }, resources: {} };
    Object.assign(terrain[`${fit.x},${fit.y},${fit.z}`], habitat || {});
    d.configureWildernessBeastsTest({ actors: [{ ...original, cell: fit }], bodyTerrain: terrain,
      scientistCell: { ...fit, x: fit.x - separation } });
    d.setMapOverlay('prospecting');
    return { key: `${fit.x},${fit.y},${fit.z}`, clock, massKg: original.bodyPhysics.massKg };
  }, { species, id, separation, habitat });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: autonomous paid fan, partial save/import, real hit, resource-backed blooms and final-death freeze`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await setup(page, renderer);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await place(page, 'beast:sunspine-basilisk', 'original-fan', 2);
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(1));
  let s = await snap(page, 'original-fan');
  expect(s.actor.life.pending?.action, JSON.stringify(s.actor)).toBe('radiantFan');
  expect(s.actor.bodyPhysics.mana).toBe(48);
  await expect(page.locator('[data-wilderness-beasts]')).toContainText('Preparing Radiant fan display');
  const original = s.actor, health = s.health;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  s = await snap(page, 'original-fan'); expect(s.actor.life).toEqual(original.life); expect(s.actor.bodyPhysics).toEqual(original.bodyPhysics);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-behavior.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  s = await snap(page, 'original-fan'); expect(s.actor.life).toEqual(original.life);
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(2));
  s = await snap(page, 'original-fan'); expect(s.actor.life.events.some(e => e.kind === 'released' && e.action === 'radiantFan')).toBe(true);
  expect(s.health).toBeLessThan(health); expect(s.actor.bodyPhysics.mana).toBe(48);
  expect(JSON.stringify(s.knowledge)).not.toMatch(/"stores"|"energy"|"cooldowns"|"parentIds"|"memories"/);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-wilderness-beasts]')).toContainText('Witnessed natural outcome: Radiant fan display');

  const bed = await place(page, 'beast:gravebloom-elk', 'original-grazer', 5,
    { resources: { bloomKg: 1, carrionKg: 20, waterL: 100 } });
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(30));
  s = await snap(page, 'original-grazer'); const p = s.habitat[bed.key];
  expect(p.resources.carrionKg).toBeLessThan(20); expect(p.resources.bloomKg).toBeGreaterThan(1);
  expect(p.condition.soilCover).toBeGreaterThan(40);
  expect(s.actor.life.events.some(e => e.kind === 'ecologicalWork')).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-wilderness-beasts]')).toContainText('Carrion-supported bloom growth');
  const life = s.actor.life, habitat = s.habitat;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  s = await snap(page, 'original-grazer'); expect(s.actor.life).toEqual(life); expect(s.habitat).toEqual(habitat);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  const frozen = s.actor;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(30); });
  s = await snap(page, 'original-grazer'); expect(s.actor).toEqual(frozen); expect(s.habitat).toEqual(habitat);
  expect((await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot())).mode).toBe(renderer);
  expect(errors).toEqual([]);
});
