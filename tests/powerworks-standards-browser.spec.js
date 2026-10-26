const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { source } = require('./helpers/powerworks-standards-source');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.powerworksStandardsSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n, false), n);
async function walk(page, counter = false) {
  expect(await page.evaluate(counter => counter ? window.helixHeresyDebug.cityRuleAction('counter')
    : window.helixHeresyDebug.powerworksMaintenanceAction('walk'), counter)).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug;
    for (let n = 0; n < 40; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    throw new Error('Original counter/dock walk did not finish');
  }); await tick(page, 0);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original part standards, exact physical assessments, saved scope and real maintenance consequences`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `parts-standards-${renderer}`); await prepareHome(page, renderer, { sustain: false, powerCondition: 80 });
  await page.locator('[data-workspace-tab="visits"]').click();
  const city = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved.source), map = source(city.populationSourceId, city.powerId);
  expect(await page.evaluate(prior => window.helixHeresyDebug.configurePowerworksMaintenanceTest(prior), { map, skilled: true })).toBe(true);
  expect(await page.evaluate(map => window.helixHeresyDebug.configurePowerworksStandardsTest(map), map)).toBe(true);
  const ids = await page.evaluate(() => { const d = window.helixHeresyDebug;
    const ids = d.configureHiddenWorkshopTest({ supplies: { metalParts: 6, rubber: 2, assayReagent: 4, preparedManaCrystals: 1 } });
    for (const [n, id] of ids.entries()) if (!d.carryActorStack('scientist', id, [6, 2, 4, 1][n])) throw new Error('Original carried test/repair inputs unavailable');
    return ids;
  });
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const initial = await snap(page), panel = page.locator('[data-powerworks-standards]');
  expect(initial.saved.policy).toBeNull(); await panel.locator('[data-parts-standards-action="reviewAdopt"]').click();
  let s = await snap(page); expect(s.saved.offer).toBeTruthy(); expect(s.money).toBe(initial.money); expect(s.rule.powerMaintenance).toEqual(initial.rule.powerMaintenance);
  await panel.locator('[data-parts-standards-action="adopt"]').click(); await tick(page, 23);
  s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.context)).toBe(23); expect(s.saved.policy).toBeNull();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.saved)).toBe(23); await tick(page, 37); s = await snap(page);
  expect(s.saved.policy).toBeTruthy(); expect(s.rule.operatorWorkSeconds).toBe(initial.rule.operatorWorkSeconds - 60);
  expect(s.rule.powerMaintenance).toEqual(initial.rule.powerMaintenance);
  await walk(page); const maintenance = page.locator('[data-powerworks-maintenance]');
  await maintenance.locator('[data-powerworks-action="inspect"]:not([data-provider-id])').click(); await tick(page, 120);
  await maintenance.locator('[data-powerworks-action="investigate"]').click(); await tick(page, 1800);
  expect((await snap(page)).maintenance.method).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceAction('repair'))).toBe(false); // no accepted lot yet
  const before = await snap(page); await panel.locator('[data-parts-standards-action="test"]').click(); await tick(page, 43);
  s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.context)).toBe(43); expect(s.saved.assessments).toHaveLength(0);
  expect(s.money).toBe(before.money - 20); expect(s.stacks.find(i => i.id === ids[0]).quantity).toBe(5); expect(s.saved.reference.sampleTests).toBe(23);
  const partial = s;
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-parts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
    const copy = await snap(page); expect(copy.saved.runId).not.toBe(partial.saved.runId); expect(copy.saved.runId).toBe(copy.rule.runId);
    expect(copy.saved.job).toEqual(partial.saved.job); expect(copy.tools).toEqual(partial.tools);
  } else { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
  expect((await snap(page)).saved.job.progress).toBe(43); await tick(page, 257); s = await snap(page);
  expect(s.saved.job).toBeNull(); expect(s.saved.assessments[0]).toMatchObject({ stackId: ids[0], remaining: 5, measurements: { suitable: true } });
  expect(s.saved.assessments[0].endorsement).toBeTruthy(); expect(s.money).toBe(before.money - 20);
  const dated = s.public;
  if (renderer === 'dom') {
    await maintenance.locator('[data-powerworks-action="repair"]:not([data-provider-id])').click(); await tick(page, 600); s = await snap(page);
    expect(s.rule.powerMaintenance.condition).toBe(100); expect(s.rule.powerMaintenance.repaired).toBe(20);
    expect(s.stacks.find(i => i.id === ids[0]).quantity).toBe(3); expect(s.saved.assessments[0].remaining).toBe(3);
    expect(s.public).toEqual(dated); expect(s.money).toBe(before.money - 20); expect(s.rule.chargedEnergy).toBe(0);
    await panel.locator('[data-parts-standards-action="report"]').click(); expect((await snap(page)).public.assessments[0].remaining).toBe(3);
  } else {
    expect(await page.evaluate(id => window.helixHeresyDebug.setPowerworksStandardsTestDamage(id), ids[0])).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceAction('repair'))).toBe(false);
    for (const p of s.saved.providers) expect(await page.evaluate(id => window.helixHeresyDebug.setPowerworksStandardsTestAvailability(id, false), p.sourceId)).toBe(true);
    const accounts = (await snap(page)).networks;
    await panel.locator('[data-parts-standards-action="selfTest"]').click(); await tick(page, 600); s = await snap(page);
    expect(s.saved.assessments).toHaveLength(2); expect(s.saved.assessments[1]).toMatchObject({ endorsement: null, measurements: { suitable: false } });
    expect(s.networks.accounts).toEqual(accounts.accounts); expect(s.rule.powerMaintenance.condition).toBe(80);
    await walk(page, true); await panel.locator('[data-parts-standards-action="reviewWithdraw"]').click();
    await panel.locator('[data-parts-standards-action="withdraw"]').click(); await tick(page, 60); expect((await snap(page)).saved.policy).toBeNull();
    await walk(page); expect(await page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceAction('repair'))).toBe(false);
    const frozen = (await snap(page)).saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 60);
    expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(await panel.innerText()).not.toMatch(/workSeconds|14400|original-undisclosed|populationSourceId/);
  expect((await snap(page)).networks.accounts.every(a => !a.mandate)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
