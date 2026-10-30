const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceMap } = require('./helpers/city-authority-source');
const { world, Definitions } = require('./helpers/institutional-inventory-source');
const Networks = require('../network-operations');
test.setTimeout(240000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.offensiveMandateSnapshot());
const tick = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceCityRuleForTest(seconds), seconds);
async function finish(page) {
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot()), t = s.tasks.find(t => !t.reason);
    if (!t) { expect(s.tasks, JSON.stringify(s.tasks)).toHaveLength(0); return; }
    await tick(page, Math.min(60, Math.max(1, Math.ceil(t.dueAt - s.clock + 1))));
  }
  throw Error('Actual local muster walking did not finish');
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: separate declared original-team preparation, actual muster/follow/return, escrow and partial review survive reload and continued import without city control`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.setDefaultTimeout(20000); await startLifecycleRun(page, `offensive-muster-${renderer}`);
  const input = sourceMap(), map = world([Definitions.find(d => d.id === 'non-state-network.shared.bastion-contract')], 3000);
  map.strategicPlayableSettlementState.cityRows[0].cityId = 'a'; map.strategicPlayableSettlementState.cityRows[0].assetId = 'population:a';
  Object.assign(map.strategicNonStateNetworkHistory.networkRows[0], { originCityId: 'a' });
  Object.assign(map.strategicNonStateNetworkHistory.branchRows[0], { currentCityId: 'a', originalCityId: 'a' });
  await page.evaluate(({ input, source, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    if (!d.setOriginalInstitutionalInventoryTestSource(source)) throw Error('Original finite inventory fixture refused');
    // Explicit prior local presence, original sources and finite purse, NOT a
    // generated-world earned acquisition/transport or conquest acceptance.
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true,
        localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Original city', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true,
        jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'original-muster', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 });
    // Original collective identity fixed before any decision; this one has a
    // stable independently refusing delegate, unlike the old accepting fixture.
    d.configureSovereignBargainTest({ collective: true, authorityId: 'authority:09512' });
    d.configureUnsupportedTest({ municipal: true });
    const original = d.sovereignBargainSnapshot().bargain.source, p = input.political;
    p.charterId = original.charterId;
    p.parties[0] = { ...p.parties[0], authorityId: original.authority.id, name: original.authority.name, charterId: original.charterId };
    for (const i of p.institutions) {
      if (i.role === 'centralAdministration') i.id = original.administrationId;
      if (i.role === 'militaryDefenseCommand') i.id = original.defenseId;
    }
    if (!d.configureCityAuthorityTest([{ political: p, operation: input.operation, defense: input.defense }])) throw Error('Original target fixture refused');
    if (!d.scientistIdentityAction('walk')) throw Error('Original civic walk refused');
  }, { input, renderer, source: Networks.sources(map, 'prior-offensive-inventory') });
  await finish(page); await page.locator('[data-workspace-tab="visits"]').click();
  const political = page.locator('[data-city-authority]');
  await political.locator('[data-city-authority-action="inspect"][data-city-authority-target="a"]').click(); await tick(page, 60);
  await political.locator('[data-city-authority-action="negotiate"][data-city-authority-target="a"]').click(); await tick(page, 180);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot().saved.entries[0].phase)).toBe('refused');
  const panel = page.locator('[data-offensive-mandates]'), action = name => panel.locator(`[data-offensive-mandate-action="${name}"]`).first().click();
  await action('contacts'); await action('walk'); await finish(page);
  let s = await snap(page); expect(s.saved.posts).toHaveLength(1); const p = s.saved.posts[0], unitId = p.source.id;
  const originalPeople = s.field.units.find(u => u.id === unitId).actors; expect(originalPeople).toHaveLength(2);
  expect(originalPeople.every(a => a.mapCell && !a.assignment)).toBe(true); expect(s.public).toEqual([]);
  await action('review'); await tick(page, 25); s = await snap(page); expect(s.saved.posts[0].job.progress).toBe(25);
  const work = s.contexts[0].context.manager.workSeconds;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.saved.posts[0].job.progress).toBe(25); expect(s.contexts[0].context.manager.workSeconds).toBe(work);
  await tick(page, 35); s = await snap(page); expect(s.saved.posts[0].phase).toBe('offered'); expect(s.money).toBe(1000);
  await action('accept'); s = await snap(page); expect(s.money).toBe(728); const contract = s.saved.posts[0].contract.id;
  expect(s.field.units.find(u => u.id === unitId).actors.map(a => a.id)).toEqual(originalPeople.map(a => a.id));
  await action('follow');
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true })),
    { roomId: p.layout.roomId, cell: { ...p.layout.visitor, x: p.layout.visitor.x + 2, y: p.layout.visitor.y + 3 } })).toBe(true);
  await finish(page); await tick(page, 10); s = await snap(page);
  expect(s.field.units.find(u => u.id === unitId).actors.some((a, i) => JSON.stringify(a.mapCell) !== JSON.stringify(originalPeople[i].mapCell))).toBe(true);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const partial = s.saved.posts[0].contract, bodies = s.field.units.find(u => u.id === unitId).actors;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-original-muster.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.saved.runId).not.toBe(bundle.run.id); expect(s.saved.posts[0].contract).toEqual(partial);
  expect(s.field.units.find(u => u.id === unitId).actors).toEqual(bodies); expect(s.saved.posts[0].contract.id).toBe(contract);
  if (renderer === 'canvas') {
    const frozen = { saved: s.saved, actors: s.field.units.find(u => u.id === unitId).actors, money: s.money, clock: s.clock };
    await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 20); s = await snap(page);
    expect({ saved: s.saved, actors: s.field.units.find(u => u.id === unitId).actors, money: s.money, clock: s.clock }).toEqual(frozen);
    expect(await page.evaluate(() => { const e = window.helixHeresyDebug.cityAuthoritySnapshot().saved.entries[0]; return { phase: e.phase, operation: e.operation }; }))
      .toEqual({ phase: 'refused', operation: null });
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]); return;
  }
  await action('withdraw'); await action('walk'); await finish(page);
  for (let i = 0; i < 20 && (await snap(page)).saved.posts[0].phase !== 'returned'; i++) await tick(page, 30);
  s = await snap(page); expect(s.saved.posts[0].phase).toBe('returned');
  expect(s.field.units.find(u => u.id === unitId).actors.map(a => a.mapCell)).toEqual(p.layout.homes);
  await action('report'); const earned = (await snap(page)).saved.posts[0].contract.earned;
  await action('settle'); s = await snap(page); expect(s.money).toBeCloseTo(1000 - 80 - earned, 6);
  expect(s.saved.posts[0].phase).toBe('settled'); expect(s.saved.posts[0].contract.escrow).toBe(0);
  expect(await page.evaluate(() => { const s = window.helixHeresyDebug.cityAuthoritySnapshot().saved.entries[0]; return { phase: s.phase, operation: s.operation }; }))
    .toEqual({ phase: 'refused', operation: null });
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
