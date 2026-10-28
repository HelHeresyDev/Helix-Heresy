const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.beastClimbingSnapshot());
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
async function until(page, id, phase, max = 120) {
  return page.evaluate(({ id, phase, max }) => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < max; n++) {
      const s = d.beastClimbingSnapshot(), a = s.region.beasts.actors.find(a => a.id === id);
      if (phase === 'partial' ? a.climbing?.mode === 'ascending' && a.climbing.heightM >= 1.5
        : phase === 'perched' ? a.climbing?.mode === 'perched' : !a.climbing) return s;
      d.advanceOverlandForTest(1);
    }
    throw Error(`Original climbing did not reach ${phase}: ${JSON.stringify(d.beastClimbingSnapshot())}`);
  }, { id, phase, max });
}
async function move(page, site, cell) {
  expect(await page.evaluate(({ site, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
    { toCell: cell, allowMultiRoom: true, urgent: true })), { site, cell })).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 100 && d.overlandSnapshot().tasks.length; n++) d.advanceOverlandForTest(1);
    if (d.overlandSnapshot().tasks.length) throw Error('Actual ground walk did not finish');
  });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: real original climbing, elevated reach, saved partial ascent and ${renderer === 'dom' ? 'impact fall' : 'physical descent'}`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log(e.message); }); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `mirror-climbing-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'mirror-climbing', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 5, hunger: 5 });
  }, renderer);
  const route = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot().route), f = sourceFixture(route.id, route.distanceKm);
  expect(await page.evaluate(({ source, seed }) => {
    const d = window.helixHeresyDebug;
    return d.setBeastDiplomacyTestSources([source], seed) && d.setBeastClimbingTestTerrain({ sourceCellId: source.sourceCellId, biomeCode: 'F', slopePercent: 20 });
  }, { source: f.source, seed: f.seed })).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('depart'))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 100 && d.overlandSnapshot().tasks.length; n++) d.advanceOverlandForTest(1);
    d.advanceOverlandForTest(12000);
  });
  await visits(page); let s = await snap(page); expect(s.site.climbSurfaces).toHaveLength(2);
  const id = s.region.beasts.actors.find(a => a.homeCell.y < 10).id, originals = s.region.beasts.actors.map(a => a.id);
  await expect(page.locator('[data-beast-climbing]')).toContainText('grippable tree');
  console.log(`${renderer}: original forest patch and conserved apes reached on foot`);
  // Actual shared spell action, not an injected climbing decision or outcome.
  for (let n = 0; n < 4; n++) {
    expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1)); s = await snap(page);
    if (s.region.beasts.actors.find(a => a.id === id).provokedUntil > s.clock) break;
  }
  s = await until(page, id, 'partial'); const partial = s.region.beasts.actors.find(a => a.id === id);
  expect(partial.health).toBeLessThan(80); expect(partial.climbStamina).toBeLessThan(120); expect(partial.climbing.heightM).toBeGreaterThanOrEqual(1.5);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); s = await snap(page);
  expect(s.region.beasts.actors.find(a => a.id === id).climbing).toEqual(partial.climbing);
  expect(s.region.beasts.actors.find(a => a.id === id).climbStamina).toBe(partial.climbStamina);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = s.region.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-climbing.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page); s = await snap(page);
  expect(s.region.runId).not.toBe(oldRun); expect(s.region.beasts.actors.map(a => a.id)).toEqual(originals);
  expect(s.region.beasts.actors.find(a => a.id === id).climbStamina).toBe(partial.climbStamina);
  expect(s.site.climbSurfaces).toEqual(bundle.run.state.roadsideStops.sites.find(p => p.id === s.site.id).climbSurfaces);
  s = await until(page, id, 'perched'); const perched = s.region.beasts.actors.find(a => a.id === id);
  expect(perched.climbing.heightM).toBe(4); expect(perched.mapCell.z).toBe(s.site.entry.z);
  await move(page, s.site, { ...perched.mapCell, y: perched.mapCell.y + 1 }); s = await snap(page);
  const elevated = s.region.beasts.actors.find(a => a.id === id);
  expect(elevated.climbing?.heightM, JSON.stringify(elevated)).toBeGreaterThan(1);
  expect(s.actors.find(a => a.id === id).strikeReason).toMatch(/range|reach|outside/i);
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), id)).toBe(false);
  expect(s.knowledge.sightings.find(a => a.id === id).heightM).toBeGreaterThan(1);
  if (renderer === 'dom') {
    const before = elevated.health;
    for (let n = 0; n < 4; n++) {
      s = await snap(page); if (s.region.beasts.actors.find(a => a.id === id).lastClimbEvent?.kind === 'fall') break;
      expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), id)).toBe(true);
      await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    }
    s = await snap(page); const fallen = s.region.beasts.actors.find(a => a.id === id);
    expect(fallen.lastClimbEvent.kind).toBe('fall'); expect(fallen.climbing).toBeNull(); expect(fallen.health).toBeLessThan(before - 14);
    expect(s.injuries.some(i => i.actorId === id && /fall/i.test(i.cause))).toBe(true);
  } else {
    s = await until(page, id, 'ground'); expect(s.region.beasts.actors.find(a => a.id === id).lastClimbEvent.kind).toBe('descended');
  }
  console.log(`${renderer}: actual elevation, conserved partial import and consequential ${renderer === 'dom' ? 'fall' : 'descent'} verified`);
  expect(s.region.beasts.actors.map(a => a.id)).toEqual(originals); expect(s.region.beasts.actors.find(a => a.id === id).climbStamina).toBeLessThan(partial.climbStamina);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  const frozen = s.region.beasts.actors;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snap(page)).region.beasts.actors).toEqual(frozen); expect(errors).toEqual([]);
});
