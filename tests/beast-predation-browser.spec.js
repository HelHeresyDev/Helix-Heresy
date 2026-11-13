const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(120000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot());
async function setup(page, renderer) {
  await startLifecycleRun(page, `predation-${renderer}`);
  return page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'predation-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Original hunting ground', temperatureC: 18, slopePercent: 5, precipitationMm: 500, terrain: 'ground', jurisdiction: 'Wilderness', description: 'Prepared original physical contact.' }, mode: 'wilderness', autoCare: false });
    d.configureWildernessBeastsTest({ actors: [] });
    const cells = d.boundaryDiscoverySnapshot().cells, keys = new Set(cells.map(c => `${c.x},${c.y}`));
    const home = cells.find(c => c.x >= 28 && c.x <= 31 && c.y >= 10 && c.y <= 15
      && Array.from({ length: 8 }, (_, x) => Array.from({ length: 3 }, (_, y) => keys.has(`${c.x + x},${c.y + y}`))).flat().every(Boolean));
    if (!home) throw Error('No original physical terrain for predator and prey');
    const clock = d.wildernessBeastSnapshot().clock, W = window.HelixWildernessBeasts;
    const predator = W.actor('beast:rimefang-pack', 'original-hunter', home, 'original-hunters', clock);
    predator.bodyPhysics.mode = 'walking'; predator.bodyPhysics.altitudeM = 0; predator.life.stores.fatKg = 0;
    const prey = W.actor('beast:gravebloom-elk', 'original-calf', { ...home, x: home.x + 2 }, 'original-herd', clock,
      { ageDays: 2, massKg: 30 });
    prey.maxHealth *= Math.sqrt(30 / 350); prey.health = prey.maxHealth;
    const terrain = Object.fromEntries(cells.map(c => [`${c.x},${c.y},${c.z}`, { floor: true, temperatureC: 20,
      ceilingM: 100, soilDepthM: 8, hardness: 1, densityKgM3: 1500, materialKg: 12000,
      supportKg: 100000, oxygen: true, wind: { x: 1, y: 0 }, resources: {} }]));
    d.configureWildernessBeastsTest({ actors: [predator, prey].map(a => ({ ...a, cell: a.mapCell })), bodyTerrain: terrain,
      scientistCell: { ...home, x: home.x - 20 } });
    return { clock, home };
  }, renderer);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: native sensed hunt, actual kill and finite corpse feeding survive reload and death`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await setup(page, renderer);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(3));
  let s = await snapshot(page), hunter = s.actors.find(a => a.id === 'original-hunter');
  expect(hunter.life.hunt?.targetId, JSON.stringify(hunter)).toBe('original-calf');
  expect(hunter.bodyPhysics.spentStamina).toBeGreaterThan(0);
  const partial = s.actors;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).actors).toEqual(partial);
  await page.evaluate(() => window.helixHeresyDebug.advanceWildernessBeastsForTest(40));
  s = await snapshot(page); const corpse = s.actors.find(a => a.id === 'original-calf');
  hunter = s.actors.find(a => a.id === 'original-hunter');
  expect(corpse.status, JSON.stringify(s.actors)).toBe('dead'); expect(corpse.diedAt).toBeGreaterThan(partial[0].life.hunt.startedAt);
  expect(hunter.life.events.some(e => e.kind === 'fedFromRemains')).toBe(true);
  expect(corpse.life.remains.consumedKg).toBeGreaterThan(0);
  expect(corpse.life.remains.edibleKg + corpse.life.remains.consumedKg + corpse.life.remains.decomposedKg)
    .toBeCloseTo(corpse.life.remains.initialEdibleKg, 7);
  expect(JSON.stringify(s.knowledge)).not.toMatch(/initialEdibleKg|huntCooldownUntil|"stores"|"memories"/);
  const saved = s.actors;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).actors).toEqual(saved);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(30); });
  expect((await snapshot(page)).actors).toEqual(saved);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
