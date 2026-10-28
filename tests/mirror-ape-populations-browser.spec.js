const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.beastDiplomacySnapshot());
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
const tick = (page, n) => page.evaluate(n => {
  const d = window.helixHeresyDebug, target = d.overlandSnapshot().clock + n;
  for (let i = 0; i < 200 && d.overlandSnapshot().clock < target - 1e-6; i++) {
    const before = d.overlandSnapshot().clock; d.advanceOverlandForTest(target - before);
    if (d.overlandSnapshot().clock <= before) throw Error('Actual encounter clock stopped');
  }
  if (d.overlandSnapshot().clock < target - 1e-6) throw Error('Physical interval did not finish');
}, n);
async function finish(page) {
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot()); if (!s.tasks.length) return;
    expect(s.tasks[0].reason).toBe(''); await tick(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw Error('Actual walk did not finish');
}
async function move(page, site, cell) {
  expect(await page.evaluate(({ site, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
    { toCell: cell, allowMultiRoom: true, urgent: true })), { site, cell })).toBe(true); await finish(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual original compact, later habitat group, independent combat and conserved continued population`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(20000);
  await startLifecycleRun(page, `ape-population-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'ape-population', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 5, hunger: 5 });
  }, renderer);
  const route = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot().route), f = sourceFixture(route.id, route.distanceKm, 7);
  // Original ecological/personality inputs only, before any pool, person or promise exists.
  expect(await page.evaluate(({ source, habitat, renderer }) => {
    const d = window.helixHeresyDebug;
    return d.setBeastDiplomacyTestSources([source], 'population-35', [habitat]) && (renderer !== 'canvas'
      || d.setBeastClimbingTestTerrain({ sourceCellId: source.sourceCellId, biomeCode: 'F', slopePercent: 20 }));
  }, { source: f.source, habitat: f.habitat, renderer })).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('depart'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(12000)); await visits(page);
  let s = await snap(page); expect(s.region.beasts.actors).toHaveLength(2);
  const originalIds = s.region.beasts.actors.map(a => a.id), originalSite = s.site,
    ally = s.region.beasts.actors.find(a => a.dialoguePolicy === 'consider').id,
    row = page.locator(`[data-beast-contact="${ally}"]`), pool = s.saved.troops[0].pool,
    later = pool.groups.find(g => g.positionKm !== null);
  expect(later.positionKm).toBeGreaterThan(originalSite.positionKm + .04);
  expect(pool.groups.reduce((n, g) => n + g.count, 2)).toBe(7); expect(pool.groups.some(g => g.positionKm === null)).toBe(true);
  for (const [action, n] of [['greet', 61], ['check', 121], ['discuss', 61], ['accept', 61]]) {
    await row.locator(`[data-beast-dialogue-action="${action}"]`).click(); await tick(page, n);
    expect((await snap(page)).saved.job).toBeNull();
  }
  s = await snap(page); const signed = s.saved.agreements[0], held = s.public;
  expect(signed.payload.actorId).toBe(ally);
  await move(page, originalSite, { ...originalSite.entry, y: 12 });
  const protectedHealth = await page.evaluate(() => window.helixHeresyDebug.beastSpellImitationSnapshot().scientist.health);
  await tick(page, 10);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastSpellImitationSnapshot().scientist.health)).toBe(protectedHealth);
  await move(page, originalSite, originalSite.entry); const originalBodies = (await snap(page)).region.beasts.actors;
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(12000)); s = await snap(page);
  expect(s.site.id).not.toBe(originalSite.id); expect(s.site.positionKm).toBeCloseTo(later.positionKm, 8);
  const newcomers = s.region.beasts.actors.filter(a => !originalIds.includes(a.id)); expect(newcomers).toHaveLength(2);
  expect(newcomers.every(a => a.roomId === s.site.roomId && a.populationId === f.source.populationId
    && a.spellImitation.known.length === 0 && a.spellImitation.mana === 48 && a.contactWorkSeconds === 900)).toBe(true);
  expect(s.saved.agreements[0]).toEqual(signed); expect(s.public).toEqual(held);
  expect(s.region.beasts.actors.find(a => a.id === ally).spellImitation).toEqual(originalBodies.find(a => a.id === ally).spellImitation);
  console.log(`${renderer}: physical travel reached a different reserved original group, without population-wide consent or remote learning`);
  const target = newcomers.find(a => a.homeCell.y > 10).id,
    caster = newcomers.find(a => a.homeCell.y < 10).id;
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), target)).toBe(true);
  await page.locator('[data-wilderness-beasts]').getByRole('button', { name: 'Guard', exact: true }).click();
  // The uninjured original northern member has genuine territorial interest in this ground.
  await page.evaluate(id => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 40; n++) {
      const a = d.beastSpellImitationSnapshot().region.beasts.actors.find(a => a.id === id);
      if (a.spellImitation.casts.some(c => c.state === 'released')) return;
      d.advanceOverlandForTest(1);
    }
    throw Error('The independently hostile original did not perform its learned spell');
  }, caster);
  s = await snap(page); expect(s.region.beasts.actors.find(a => a.id === caster).spellImitation.spent).toBeGreaterThan(0);
  expect(s.region.beasts.actors.find(a => a.id === ally).spellImitation.known).toEqual([]);
  expect(s.saved.agreements[0]).toEqual(signed); expect(s.public).toEqual(held);
  const before = { pool: s.saved.troops[0].pool, actors: s.region.beasts.actors }, ids = before.actors.map(a => a.id);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); s = await snap(page);
  expect(s.saved.troops[0].pool).toEqual(before.pool); expect(s.region.beasts.actors).toEqual(before.actors);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() })), oldRun = s.saved.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-ape-population.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page); s = await snap(page);
  expect(s.saved.runId).not.toBe(oldRun); expect(s.saved.troops[0].pool).toEqual(before.pool);
  expect(s.region.beasts.actors).toEqual(before.actors); expect(s.region.beasts.actors.map(a => a.id)).toEqual(ids);
  expect(s.saved.agreements[0]).toEqual(signed); expect(s.public).toEqual(held);
  expect(JSON.stringify(s.public)).not.toMatch(/originalCount|materializedAt|positionKm|allocatedAt|SECRET_APE/);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  const frozen = { pool: s.saved.troops[0].pool, actors: s.region.beasts.actors };
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); }); s = await snap(page);
  expect({ pool: s.saved.troops[0].pool, actors: s.region.beasts.actors }).toEqual(frozen); expect(errors).toEqual([]);
});
