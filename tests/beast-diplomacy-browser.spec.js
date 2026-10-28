const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
test.setTimeout(600000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.beastDiplomacySnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), n);
async function tick(page, n) {
  let s = await snap(page); const target = s.clock + n;
  for (let i = 0; i < 200 && s.clock < target - 1e-6; i++) {
    const before = s.clock; await advance(page, target - before); s = await snap(page);
    if (s.clock <= before) throw Error(`Actual dialogue clock stopped: ${JSON.stringify(s.contexts)}`);
  }
  expect(s.clock).toBeCloseTo(target, 4);
}
const visits = page => page.locator('[data-workspace-tab="visits"]').click();
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page) {
  for (let n = 0; n < 30; n++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot()); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe('');
    await tick(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw Error('Actual ground movement did not finish');
}
async function move(page, site, cell) {
  expect(await page.evaluate(({ site, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(site.roomId,
    { toCell: cell, allowMultiRoom: true, urgent: true })), { site, cell })).toBe(true); await finish(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual Mirror Ape signals, independent refusal, saved territorial consent and witnessed breach`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log('Page error: ' + e.message); });
  page.on('dialog', d => d.accept()); page.setDefaultTimeout(20000);
  await startLifecycleRun(page, `beast-dialogue-${renderer}`);
  await page.evaluate(renderer => { const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'mirror-approach', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 5, hunger: 5 });
  }, renderer);
  const route = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot().route), f = sourceFixture(route.id, route.distanceKm);
  expect(await page.evaluate(({ source, seed }) => window.helixHeresyDebug.setBeastDiplomacyTestSources([source], seed), { source: f.source, seed: f.seed })).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect((await snap(page)).saved.troops).toHaveLength(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('depart'))).toBe(true); await finish(page); await advance(page, 12000);
  let s = await snap(page); expect(s.site, JSON.stringify(s)).toBeTruthy(); expect(s.region.beasts.actors).toHaveLength(2);
  expect(s.public).toEqual([]); expect(s.saved.troops[0].source.originalCount).toBe(5); await visits(page);
  const a = s.region.beasts.actors.find(a => a.dialoguePolicy === 'consider'), refusal = s.region.beasts.actors.find(a => a.dialoguePolicy === 'decline');
  expect(s.contexts.every(c => c.context.near && c.context.visible), JSON.stringify(s.contexts)).toBe(true);
  const panel = page.locator('[data-beast-diplomacy]'), row = panel.locator(`[data-beast-contact="${a.id}"]`), other = panel.locator(`[data-beast-contact="${refusal.id}"]`);
  await other.locator('[data-beast-dialogue-action="greet"]').click(); await expect(panel).toContainText('declines this interaction');
  expect((await snap(page)).saved.agreements).toHaveLength(0);
  await row.locator('[data-beast-dialogue-action="greet"]').click(); await tick(page, 20); s = await snap(page);
  expect(s.saved.job.progress, JSON.stringify(s.contexts)).toBe(20); expect(s.region.beasts.actors.find(b => b.id === a.id).contactWorkSeconds).toBe(840);
  await move(page, s.site, { ...s.site.entry, x: 19 }); await tick(page, 30);
  expect((await snap(page)).saved.job.progress).toBe(20); await reload(page);
  expect((await snap(page)).saved.job.progress).toBe(20);
  await move(page, s.site, s.site.entry); await tick(page, 41); s = await snap(page);
  expect(s.saved.job, JSON.stringify(s.contexts)).toBeNull();
  expect(s.saved.contacts.find(c => c.actorId === a.id).understood).toBe(false);
  await row.locator('[data-beast-dialogue-action="check"]').click(); await tick(page, 20);
  s = await snap(page); expect(s.saved.job.kind).toBe('check');
  expect(s.region.beasts.actors.find(b => b.id === a.id).mapCell).not.toEqual(a.mapCell);
  await reload(page); await tick(page, 101); s = await snap(page);
  expect(s.saved.job, JSON.stringify(s)).toBeNull();
  expect(s.saved.contacts.find(c => c.actorId === a.id).checks[0].detourObserved).toBe(true);
  await expect(panel).toContainText('real detour'); console.log(`${renderer}: actual unguided stop, redirection and detour observed`);
  await row.locator('[data-beast-dialogue-action="discuss"]').click(); await tick(page, 60);
  await expect(row).toContainText('Only this individual consents'); await expect(row).toContainText('Quiet ground:');
  await row.locator('[data-beast-dialogue-action="accept"]').click(); await tick(page, 59);
  expect((await snap(page)).saved.agreements).toHaveLength(0); await tick(page, 1); s = await snap(page);
  expect(s.saved.agreements).toHaveLength(1); expect(s.saved.agreements[0].payload.actorId).toBe(a.id);
  expect(s.region.beasts.actors.find(b => b.id === a.id).contactWorkSeconds).toBe(600);
  expect(s.region.beasts.actors.find(b => b.id === refusal.id).contactWorkSeconds).toBe(900);
  expect(JSON.stringify(s.public)).not.toMatch(/SECRET|originalCount|contactWorkSeconds|dialoguePolicy/);
  const signed = s.saved.agreements[0], ids = s.region.beasts.actors.map(b => b.id), received = s.public;
  const home = s.region.beasts.actors.find(b => b.id === a.id).homeCell;
  await move(page, s.site, { ...home, y: home.y + (home.y > 10 ? -2 : 2) });
  const health = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.vitals.health.current);
  await tick(page, 20);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.vitals.health.current)).toBe(health);
  expect((await snap(page)).saved.agreements[0]).toEqual(signed);
  await move(page, s.site, { ...s.site.entry, x: 19 }); await tick(page, 10);
  expect((await snap(page)).public).toEqual(received);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const oldRun = s.saved.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-beast-dialogue.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await visits(page); s = await snap(page);
  expect(s.saved.runId).not.toBe(oldRun); expect(s.region.beasts.actors.map(b => b.id)).toEqual(ids);
  expect(s.saved.agreements[0]).toEqual(signed); expect(s.public).toEqual(received);
  expect(s.region.beasts.actors.find(b => b.id === a.id).contactWorkSeconds).toBe(600);
  if (renderer === 'canvas') await move(page, s.site, { ...home, y: home.y + (home.y > 10 ? -1 : 1) });
  else {
    await move(page, s.site, s.site.entry);
    expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('soulLash', id), a.id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
  }
  s = await snap(page); expect(s.saved.agreements[0].breachedAt, JSON.stringify(s.contexts)).not.toBeNull();
  expect(s.public).toEqual(received);
  if (!s.contexts.find(c => c.id === a.id).context.near) await move(page, s.site, s.site.entry);
  expect(await page.evaluate(id => window.helixHeresyDebug.beastDiplomacyAction('hear', id), a.id)).toBe(true);
  s = await snap(page); expect(s.public.at(-1).agreement.state).toBe('receivedBrokenCompact');
  expect(s.region.beasts.actors.find(b => b.id === refusal.id).dialoguePolicy).toBe('decline');
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  const frozen = s.saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(300); });
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
