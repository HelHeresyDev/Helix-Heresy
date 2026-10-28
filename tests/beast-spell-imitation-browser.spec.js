const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
const D = require('../beast-diplomacy'), R = require('../regional-encounters');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.beastSpellImitationSnapshot());
const tick = (page, n) => page.evaluate(n => {
  const d = window.helixHeresyDebug, target = d.overlandSnapshot().clock + n;
  for (let i = 0; i < 200 && d.overlandSnapshot().clock < target - 1e-6; i++) {
    const before = d.overlandSnapshot().clock; d.advanceOverlandForTest(target - before);
    if (d.overlandSnapshot().clock <= before) throw Error('Actual physical clock stopped');
  }
  if (d.overlandSnapshot().clock < target - 1e-6) throw Error('Actual physical interval did not finish');
}, n);
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
async function finish(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 30; n++) {
      const s = d.overlandSnapshot(); if (!s.tasks.length) return;
      if (s.tasks[0].reason) throw Error(s.tasks[0].reason);
      d.advanceOverlandForTest(Math.max(1, s.tasks[0].dueAt - s.clock + 1));
    }
    throw Error('Actual movement did not finish');
  });
}
async function until(page, id, condition, max = 180) {
  return page.evaluate(({ id, condition, max }) => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < max; n++) {
      const s = d.beastSpellImitationSnapshot(), a = s.region.beasts.actors.find(a => a.id === id), m = a.spellImitation;
      if (condition === 'pending' ? m.pending : condition === 'perchCast' ? m.casts.some(c => c.state === 'released' && c.casterHeightM > 0)
        : m.mana === 0 && !m.pending) return s;
      d.advanceOverlandForTest(1);
    }
    throw Error(`Original spell behavior did not reach ${condition}: ${JSON.stringify(d.beastSpellImitationSnapshot())}`);
  }, { id, condition, max });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original one-observation Soul Lash, conserved partial import, ${renderer === 'canvas' ? 'perch release' : 'movement interruption'}, exhaustion and compact protection`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log(e.message); }); page.on('dialog', d => d.accept());
  page.setDefaultTimeout(20000);
  await startLifecycleRun(page, `spell-imitation-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'mirror-spells', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 5, hunger: 5 });
  }, renderer);
  const route = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot().route), f = sourceFixture(route.id, route.distanceKm);
  // Original personality seed before allocation, not an edited live agreement or AI decision.
  for (let i = 0; i < 100; i++) {
    const b = { worldId: 'world', runId: 'run' }, s = D.create(b), r = R.create(b);
    D.register(s, f.source, r, [], `spell-personality-${i}`, 0);
    if (r.beasts.actors.find(a => a.offsetM === 4)?.dialoguePolicy === 'consider'
      && r.beasts.actors.find(a => a.offsetM === -4)?.dialoguePolicy === 'decline') { f.seed = `spell-personality-${i}`; break; }
  }
  expect(await page.evaluate(({ f, renderer }) => {
    const d = window.helixHeresyDebug;
    return d.setBeastDiplomacyTestSources([f.source], f.seed) && (renderer !== 'canvas'
      || d.setBeastClimbingTestTerrain({ sourceCellId: f.source.sourceCellId, biomeCode: 'F', slopePercent: 20 }));
  }, { f: { source: f.source, seed: f.seed }, renderer })).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('depart'))).toBe(true);
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(12000)); await visits(page);
  let s = await snap(page); const originals = s.region.beasts.actors.map(a => a.id),
    ally = s.region.beasts.actors.find(a => a.dialoguePolicy === 'consider').id,
    learner = s.region.beasts.actors.find(a => a.dialoguePolicy === 'decline').id;
  expect(s.region.beasts.actors).toHaveLength(2); expect(s.region.beasts.actors.find(a => a.id === ally).homeCell.y).toBe(14);
  expect(s.region.beasts.actors.every(a => a.spellImitation.known.length === 0 && a.spellImitation.mana === 48)).toBe(true);
  const row = page.locator(`[data-beast-contact="${ally}"]`);
  // Respect real alert interruptions and fractional arrival clocks; no work or outcome is injected.
  for (const [action, seconds] of [['greet', 61], ['check', 121], ['discuss', 61], ['accept', 61]]) {
    await row.locator(`[data-beast-dialogue-action="${action}"]`).click(); await tick(page, seconds);
    expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.beastDiplomacySnapshot();
      return { job: s.saved.job, contexts: s.contexts }; }), `${renderer}: ${action} remains actual attended work`).toMatchObject({ job: null });
  }
  const signed = await page.evaluate(() => window.helixHeresyDebug.beastDiplomacySnapshot().saved.agreements[0]);
  expect(signed.payload.actorId).toBe(ally);
  // Real scientist payment and visible release, not injected learning or raw damage.
  const beforeMana = (await snap(page)).scientist.mana;
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), learner)).toBe(true);
  s = await snap(page); expect(s.scientist.mana).toBe(beforeMana - 12);
  expect(s.region.beasts.actors.every(a => a.spellImitation.known.length === 1 && a.spellImitation.mana === 48
    && a.spellImitation.animancy === 1)).toBe(true);
  expect(s.knowledge.sightings.every(a => !a.spellEvent)).toBe(true);
  console.log(`${renderer}: actual paid release taught both original observers without disclosing private learning`);
  s = await until(page, learner, 'pending'); const partial = s.region.beasts.actors.find(a => a.id === learner).spellImitation;
  expect(partial.mana).toBe(36); expect(partial.pending).toBeTruthy();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page);
  expect((await snap(page)).region.beasts.actors.find(a => a.id === learner).spellImitation).toEqual(partial);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = s.region.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-spell-imitation.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page); s = await snap(page);
  expect(s.region.runId).not.toBe(oldRun); expect(s.region.beasts.actors.map(a => a.id)).toEqual(originals);
  expect(s.region.beasts.actors.find(a => a.id === learner).spellImitation).toEqual(partial);
  if (renderer === 'dom') {
    expect(await page.evaluate(({ site, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
      { toCell: { ...cell, y: cell.y - 1 }, allowMultiRoom: true, urgent: true })), s)).toBe(true);
    await finish(page); s = await snap(page);
    const m = s.region.beasts.actors.find(a => a.id === learner).spellImitation;
    expect(m.casts[0].state).toBe('interrupted'); expect(m.mana).toBe(36);
  } else {
    await tick(page, 2); // Finish the saved original preparation without interruption.
    expect(await page.evaluate(({ site, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
      { toCell: { ...cell, y: cell.y - 1 }, allowMultiRoom: true, urgent: true })), s)).toBe(true);
    await finish(page); // Actual territorial presence keeps a later perched target relevant, not an AI override.
  }
  await page.locator('[data-beast-spell-imitation]').getByRole('button', { name: 'Guard', exact: true }).click();
  if (renderer === 'canvas') s = await until(page, learner, 'perchCast');
  s = await until(page, learner, 'empty'); const a = s.region.beasts.actors.find(a => a.id === learner), friend = s.region.beasts.actors.find(a => a.id === ally);
  expect(a.spellImitation.spent).toBe(48); expect(a.spellImitation.casts).toHaveLength(4);
  expect(a.spellImitation.casts.some(c => c.state === 'released')).toBe(true);
  expect(a.spellImitation.known).toEqual(partial.known); expect(friend.spellImitation.spent).toBe(0);
  expect(s.scientist.health).toBeGreaterThan(0);
  expect(s.knowledge.sightings.find(a => a.id === learner).spellEvent.spell).toBe('Soul Lash');
  await expect(page.locator('[data-beast-spell-imitation]')).toContainText('witnessed reproduction of Soul Lash');
  expect(JSON.stringify(s.knowledge)).not.toMatch(/spellImitation|"spent"|"known"|castId|SECRET_APE/);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastDiplomacySnapshot().saved.agreements[0])).toEqual(signed);
  // Waiting supplies neither refill nor another body or spell. The quiet-ground pact is still exact.
  await tick(page, 10); s = await snap(page);
  expect(s.region.beasts.actors.find(a => a.id === learner).spellImitation.mana).toBe(0);
  expect(s.region.beasts.actors.map(a => a.id)).toEqual(originals);
  expect(await page.evaluate(({ site }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
    { toCell: { ...site.entry, y: 12 }, allowMultiRoom: true, urgent: true })), s)).toBe(true);
  await finish(page); const protectedHealth = (await snap(page)).scientist.health;
  await tick(page, 10); s = await snap(page);
  expect(s.scientist.health).toBe(protectedHealth);
  expect(s.region.beasts.actors.find(a => a.id === ally).spellImitation.spent).toBe(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastDiplomacySnapshot().saved.agreements[0])).toEqual(signed);
  console.log(`${renderer}: original resource exhaustion and actual territorial compact protection verified`);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  const frozen = s.region.beasts.actors;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snap(page)).region.beasts.actors).toEqual(frozen); expect(errors).toEqual([]);
});
