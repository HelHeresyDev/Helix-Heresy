const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { inputs } = require('./helpers/powerworks-source');
test.setTimeout(360000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceSnapshot());
const tick = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n, false), seconds);
async function walk(page, action) {
  expect(await page.evaluate(action => window.helixHeresyDebug.powerworksMaintenanceAction(action), action)).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 40; i++) {
      const t = d.surveyExpeditionSnapshot().tasks.find(t => !t.reason); if (!t) return;
      d.advanceCityRuleForTest(Math.max(1, t.dueAt - d.surveyExpeditionSnapshot().clock + 1), true);
    }
    throw new Error('Original service dock walk did not complete');
  });
  await tick(page, 0);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original powerworks guided maintenance, transferable or investigated independence and saved physical work`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `powerworks-${renderer}`); await prepareHome(page, renderer, { sustain: false, powerCondition: 80 });
  await page.locator('[data-workspace-tab="visits"]').click();
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('operate'))).toBe(true);
  await tick(page, 3600);
  const source = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved.source);
  expect(await page.evaluate(prior => window.helixHeresyDebug.configurePowerworksMaintenanceTest(prior), {
    map: inputs(source.populationSourceId, source.powerId), skilled: true
  })).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const ids = d.configureHiddenWorkshopTest({ supplies: { metalParts: 4, rubber: 2, preparedManaCrystals: 1, assayReagent: 1 } });
    for (const [index, id] of ids.entries())
      if (!d.carryActorStack('scientist', id, [4, 2, 1, 1][index])) throw new Error('Original repair material cannot be carried');
  });
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await walk(page, 'walk');
  let s = await snap(page); const before = s, providerId = s.saved.sources[0].id;
  expect(s.context.atWorkface).toBe(true); expect(s.context.authority).toBe(true); expect(s.context.otherBusy).toBe(false);
  expect(s.rule.powerMaintenance.condition).toBeLessThan(100); expect(s.saved.inspection).toBeNull();
  const panel = page.locator('[data-powerworks-maintenance]');
  await panel.locator('[data-powerworks-action="inspect"][data-provider-id]').click(); await tick(page, 43);
  s = await snap(page); expect(s.saved.job.progress, JSON.stringify(s.context)).toBe(43); expect(s.money).toBe(before.money - 12);
  expect(s.saved.inspection).toBeNull();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.job.progress).toBe(43); await tick(page, 77);
  s = await snap(page); expect(s.saved.inspection).toBeTruthy(); expect(s.public.measuredAt).toBe(s.clock);
  const dated = s.public; await tick(page, 5); expect((await snap(page)).public).toEqual(dated);
  if (renderer === 'dom') {
    await panel.locator('[data-powerworks-action="learn"]').click(); await tick(page, 1200);
    expect((await snap(page)).saved.method.sourceId).toBe(providerId);
  } else {
    await panel.locator('[data-powerworks-action="investigate"]').click(); await tick(page, 1800);
    s = await snap(page); expect(s.saved.method.sourceId, JSON.stringify({ job: s.saved.job, history: s.saved.history, context: s.context })).toBe('personal-reproducible-investigation');
    expect(s.stacks.find(i => i.key === 'assayReagent')?.quantity ?? 0).toBe(0);
  }
  const money = (await snap(page)).money;
  // Actual independent work uses the retained method and original carried
  // instruments; no provider/municipal technician is created or charged.
  await panel.locator('[data-powerworks-action="repair"]:not([data-provider-id])').click(); await tick(page, 173);
  s = await snap(page); expect(s.saved.job.progress).toBe(173); expect(s.rule.powerMaintenance.repairAssignment).toBe(s.saved.job.id);
  const partial = s;
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-powerworks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
    await page.locator('[data-workspace-tab="visits"]').click();
    s = await snap(page); expect(s.saved.runId).not.toBe(partial.saved.runId); expect(s.saved.runId).toBe(s.rule.runId);
    expect(s.saved.providers).toEqual(partial.saved.providers); expect(s.tools).toEqual(partial.tools);
  } else {
    await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  }
  expect((await snap(page)).saved.job.progress).toBe(173); await tick(page, 427); s = await snap(page);
  expect(s.saved.job).toBeNull(); expect(s.rule.powerMaintenance.condition).toBe(100); expect(s.rule.powerMaintenance.repairAssignment).toBeUndefined();
  expect(s.rule.powerMaintenance.repaired).toBeGreaterThan(1); expect(s.money).toBe(money);
  expect(s.stacks.find(i => i.key === 'metalParts').quantity).toBe(2); expect(s.stacks.find(i => i.key === 'rubber').quantity).toBe(1);
  expect(s.tools.find(t => t.key === 'masonryHammer').tool.current).toBe(partial.tools.find(t => t.key === 'masonryHammer').tool.current);
  expect(s.tools.find(t => t.key === 'masonryHammer').tool.current).toBeLessThan(before.tools.find(t => t.key === 'masonryHammer').tool.current);
  expect(s.saved.providers).toEqual(partial.saved.providers); expect(s.networks.accounts.every(a => !a.mandate)).toBe(true);
  await expect(panel).toContainText('Transferable local method retained');
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  if (renderer === 'canvas') {
    const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 60);
    expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(errors).toEqual([]);
});
