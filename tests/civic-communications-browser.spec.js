const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { inputs } = require('./helpers/powerworks-source');
const { addCommunications } = require('./helpers/civic-communication-source');
test.setTimeout(420000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.civicCommunicationsSnapshot());
const maintenance = page => page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n, false), n);
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 40; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
      d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    throw new Error('Actual municipal walk did not finish');
  }); await tick(page, 0);
}
async function counter(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('counter'))).toBe(true); await finishWalk(page);
}
async function dock(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.powerworksMaintenanceAction('walk'))).toBe(true); await finishWalk(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original civic relay, scoped key, actual paused guidance, saved acknowledgements and supported alternate/offline service`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `civic-communications-${renderer}`); await prepareHome(page, renderer, { sustain: false, powerCondition: 80 });
  await page.locator('[data-workspace-tab="visits"]').click();
  const city = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot().saved.source);
  const map = inputs(city.populationSourceId, city.powerId);
  expect(await page.evaluate(prior => window.helixHeresyDebug.configurePowerworksMaintenanceTest(prior), { map, skilled: true })).toBe(true);
  expect(await page.evaluate(map => window.helixHeresyDebug.configureCivicCommunicationsTest(map), addCommunications(map, city))).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const before = await snap(page), provider = before.saved.sources.find(r => r.kind === 'provider').id;
  const municipal = before.saved.sources.find(r => r.kind === 'municipal').id, panel = page.locator('[data-civic-communications]');
  await panel.locator('select').selectOption(provider); await panel.locator('[data-civic-communication-action="adopt"]').click(); await tick(page, 23);
  let s = await snap(page); expect(s.saved.job?.progress, JSON.stringify(s.context)).toBe(23); expect(s.saved.profiles).toEqual([]);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.job.progress).toBe(23); await tick(page, 37);
  s = await snap(page); expect(s.saved.profiles[0].pathId).toBe(provider); const key = s.saved.profiles[0].keyId, dated = s.public;
  const documents = await page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot().documents);
  await dock(page); const work = page.locator('[data-powerworks-maintenance]');
  await work.locator('[data-powerworks-action="inspect"][data-provider-id]').click(); await tick(page, 43);
  let m = await maintenance(page); expect(m.saved.job?.progress, JSON.stringify(m.context)).toBe(43);
  s = await snap(page); expect(s.saved.sessions.find(r => r.purpose === 'technicalGuidance').through).toBe(43);
  expect(await page.evaluate(id => window.helixHeresyDebug.setCivicCommunicationsTestOutage(id, true), provider)).toBe(true);
  const held = await maintenance(page), port = (await snap(page)).saved.ports.find(p => p.id === provider);
  await tick(page, 75); m = await maintenance(page);
  expect(m.saved.job.progress).toBe(43); expect(m.saved.job.hold).toBeTruthy(); expect(m.money).toBe(held.money);
  expect(m.saved.providers).toEqual(held.saved.providers); expect((await snap(page)).saved.ports.find(p => p.id === provider)).toEqual(port);
  expect((await snap(page)).public).toEqual(dated);
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-civic-path.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
    const continued = await snap(page); expect(continued.saved.runId).not.toBe(s.saved.runId); expect(continued.saved.runId).toBe(continued.rule.runId);
    expect(continued.saved.profiles[0].keyId).toBe(key); expect(continued.saved.sessions).toEqual(s.saved.sessions);
  } else {
    await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  }
  expect((await maintenance(page)).saved.job.progress).toBe(43);
  await page.evaluate(id => window.helixHeresyDebug.setCivicCommunicationsTestOutage(id, false), provider); await tick(page, 77);
  m = await maintenance(page); expect(m.saved.job).toBeNull(); expect(m.saved.inspection).toBeTruthy(); expect(m.money).toBe(held.money);
  expect((await snap(page)).saved.sessions.find(r => r.purpose === 'technicalGuidance').through).toBe(120);
  await counter(page); await panel.locator('select').selectOption(municipal);
  await panel.locator(`[data-civic-communication-action="${renderer === 'dom' ? 'adopt' : 'rotate'}"]`).click(); await tick(page, 60);
  s = await snap(page); expect(s.saved.profiles[0].pathId).toBe(municipal);
  if (renderer === 'dom') expect(s.saved.profiles[0].keyId).toBe(key); else expect(s.saved.profiles[0].keyId).not.toBe(key);
  await page.evaluate(id => window.helixHeresyDebug.setCivicCommunicationsTestOutage(id, true), provider);
  await dock(page);
  await work.locator(renderer === 'dom' ? '[data-powerworks-action="inspect"][data-provider-id]' : '[data-powerworks-action="inspect"]:not([data-provider-id])').click();
  const prior = await snap(page); await tick(page, 120); m = await maintenance(page); expect(m.saved.job).toBeNull(); expect(m.saved.inspection.at).toBe(m.clock);
  s = await snap(page);
  if (renderer === 'canvas') expect(s.saved.ports).toEqual(prior.saved.ports);
  else expect(s.saved.ports.find(p => p.id === municipal).powerSeconds).toBeLessThan(prior.saved.ports.find(p => p.id === municipal).powerSeconds);
  await counter(page); await panel.locator('[data-civic-communication-action="report"]').click(); s = await snap(page);
  expect(s.public.at).toBe(s.clock); expect(s.public.acknowledgements.length).toBeGreaterThan(0);
  expect(await panel.innerText()).not.toMatch(/powerSeconds|original-undisclosed|population:a|14400/);
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot().documents)).toEqual(documents);
  expect(s.networks.accounts.every(a => !a.mandate)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  if (renderer === 'canvas') {
    const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 60);
    expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(errors).toEqual([]);
});
