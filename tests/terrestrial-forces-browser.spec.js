const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { world } = require('./helpers/network-operating-source');
const N = require('../network-operations');
test.setTimeout(480000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.terrestrialForceSnapshot());
const tick = (p, n) => p.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n), n);
async function finish(p) {
  for (let i = 0; i < 30; i++) {
    const s = await p.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot()), t = s.tasks.find(t => !t.reason);
    if (!t) { expect(s.tasks, JSON.stringify(s.tasks)).toHaveLength(0); return; }
    await tick(p, Math.max(1, Math.ceil(t.dueAt - s.clock + 1)));
  }
  throw Error('Original post walking did not finish');
}
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const path = info.outputPath('force-failure.json'); require('node:fs').writeFileSync(path, JSON.stringify(await page.evaluate(() => ({
    bundle: { format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() },
    force: window.helixHeresyDebug.terrestrialForceSnapshot(), tasks: window.helixHeresyDebug.surveyExpeditionSnapshot().tasks
  }))));
  await info.attach('force-failure', { path, contentType: 'application/json' });
});
test('dom: actual governor visits one original private chapter post, receives dated evidence and fights the same saved reserve guard', async ({ page }) => {
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => {
    if (d.type() === 'alert') errors.push(d.message()); return d.accept();
  });
  await startLifecycleRun(page, 'original-terrestrial-force');
  const m = world(); m.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'non-state-network.shared.bastion-contract';
  for (const b of m.strategicNonStateNetworkHistory.branchRows) Object.assign(b, { organizationForm: 'escortChapter', currentStanding: 'licensed' });
  Object.assign(m.strategicPlayableSettlementState.cityRows[0], { assetId: 'test-city-population', currentPopulation: 3000 });
  expect(await page.evaluate(s => window.helixHeresyDebug.setOriginalInstitutionalInventoryTestSource(s), N.sources(m, 'original:5'))).toBe(true);
  await prepareHome(page, 'dom', { sustain: false }); await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-terrestrial-forces]');
  await panel.locator('[data-ground-force-action="walk"][data-branch-id="branch:a"]').click(); await finish(page);
  let s = await snap(page); expect(s.saved.posts).toHaveLength(1); expect(s.actors).toHaveLength(1);
  const p = s.saved.posts[0], id = s.actors[0].id;
  expect(s.actors[0].roomId).toBe(p.layout.roomId); expect(s.public).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot().run.state.scientist.mapCell)).toEqual(p.layout.visitor);
  await panel.locator('[data-ground-force-action="report"]').click(); const report = (await snap(page)).public;
  expect(report).toHaveLength(1); await tick(page, 7); expect((await snap(page)).public).toEqual(report);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.actors[0].id).toBe(id); expect(s.public).toEqual(report);
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true })),
    { room: p.layout.roomId, cell: { ...p.layout.home, x: p.layout.home.x - 1 } })).toBe(true);
  await finish(page); const before = await snap(page);
  await panel.locator('[data-ground-force-action="strike"]').click(); await tick(page, 4); s = await snap(page);
  expect(s.actors[0].health).toBeLessThan(before.actors[0].health);
  expect(s.saved.posts[0].history.some(h => h.kind === 'defendedOriginalPremises')).toBe(true);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  const partial = await snap(page); await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-original-force.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click(); s = await snap(page);
  expect(s.saved.runId).not.toBe(partial.saved.runId); expect(s.actors).toEqual(partial.actors); expect(s.public).toEqual(report);
  const frozen = s; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 10);
  expect((await snap(page)).actors).toEqual(frozen.actors); expect((await snap(page)).saved).toEqual(frozen.saved);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
