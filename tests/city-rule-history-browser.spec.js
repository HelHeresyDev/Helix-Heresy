const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
async function finish(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 60; i++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) { d.advanceCityRuleForTest(0); return; }
      d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    throw Error('Actual civic/laboratory walk did not finish');
  });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: received actual city-rule period survives supply failure, workbench compilation, save/import and death without global recognition`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(25000);
  await startLifecycleRun(page, `city-rule-history-${renderer}`); await prepareHome(page, renderer);
  let s = await snap(page);
  const historical = s.saved.cityReports.find(e => e.temporal === 'historical'), firstId = historical.id;
  expect(historical.period.endAt - historical.period.startAt).toBe(3 * 86400);
  expect(historical.cityScope.cityId).toBe('a'); expect(s.public.review).toBeNull();
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const campaign = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().campaign);
  // Actual revocation stops future pickups; no food, failure or history flag is injected.
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('stopStanding'))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 20; i++) {
      const s = d.cityRuleSnapshot(); if (!s.context.pilotSupplied) return;
      d.advanceCityRuleForTest(6 * 3600, true);
    }
    throw Error('The original finite quota did not exhaust after pickups stopped');
  });
  const failed = await page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot());
  expect(failed.saved.status).toBe('contested'); expect(failed.context.pilotSupplied).toBe(false);
  expect((await snap(page)).saved.cityReports.find(e => e.id === firstId)).toEqual(historical);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityRuleAction('report'))).toBe(true);
  s = await snap(page); const adverse = s.saved.cityReports.find(e => e.temporal !== 'historical' && e.status === 'challenge');
  expect(adverse).toBeTruthy(); expect(adverse.observedAt).toBeGreaterThan(historical.period.endAt);
  expect(s.saved.cityReports.find(e => e.id === firstId)).toEqual(historical);
  expect(s.public.review).toBeNull(); // Receiving papers is not an automatic assessment.
  console.log(`${renderer}: real sustained government, original report receipt and later finite supply failure verified`);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('depart'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(12000));
  expect((await snap(page)).assessmentContext.local).toBe(true);
  await page.locator('[data-workspace-tab="journal"]').click();
  const panel = page.locator('[data-durable-supremacy]');
  s = await snap(page);
  if (!s.assessmentContext.atDesk) { await panel.locator('[data-supremacy-action="assessmentWalk"]').click(); await finish(page); }
  expect((await snap(page)).assessmentContext).toMatchObject({ alive: true, capable: true, local: true, atDesk: true, deskAvailable: true, busy: false });
  await panel.locator('[data-supremacy-action="assess"]').click(); s = await snap(page);
  expect(s.assessmentContext.atDesk).toBe(true); expect(s.public.review.apparent).toBe(false);
  expect(s.public.assessment.reportedCityIntervals).toHaveLength(1);
  const p = s.public.assessment.reportedCityIntervals[0];
  expect(p.startAt).toBe(historical.period.startAt); expect(p.endAt).toBe(historical.period.endAt);
  expect(p.receivedAt).toBe(historical.receivedAt); expect(p.cityScope).toEqual(historical.cityScope);
  expect(p.conflictingEvidenceIds).toEqual([]);
  expect(s.public.assessment.evidence.find(e => e.id === adverse.id).status).toBe('challenge');
  await expect(panel.locator('[data-city-rule-history]')).toContainText('past local operation, not current control');
  await expect(panel).toContainText('Held records do not establish a complete worldwide qualifying interval');
  expect(s.saved.intervals).toEqual([]); expect(s.saved.phase).not.toBe('qualified');
  const known = s.public, archive = s.saved.cityReports;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="journal"]').click();
  s = await snap(page); expect(s.public).toEqual(known); expect(s.saved.cityReports).toEqual(archive);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() })), oldRun = s.saved.runId;
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-city-rule-history.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="journal"]').click(); s = await snap(page);
  expect(s.saved.runId).not.toBe(oldRun); expect(s.saved.cityReports).toEqual(archive); expect(s.public).toEqual(known);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().campaign.accomplishedAt)).toBe(campaign.accomplishedAt);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/); s = await snap(page);
  expect(s.saved?.cityReports || []).toEqual([]); expect(s.public.review).toBeNull(); expect(s.public.assessment).toBeNull();
});
