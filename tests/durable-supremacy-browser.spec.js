const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(180000);
for (const renderer of ['canvas', 'dom']) test(`${renderer}: supremacy evidence review, real save, private-state isolation, death freeze and independent restart`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `supremacy-${renderer}`);
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  await page.locator('[data-workspace-tab="journal"]').click();
  const panel = page.locator('[data-durable-supremacy]'); await expect(panel).toContainText('Not reviewed');
  await page.getByRole('checkbox', { name: 'Show campaign guidance' }).uncheck();
  await expect(panel).toBeVisible();
  const before = await page.evaluate(() => { const d = window.helixHeresyDebug; const s = d.exportSurveyExpeditionTestState(); return {
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), campaign: s.campaign, money: s.economy.money, clock: s.clock }; });
  await panel.locator('[data-supremacy-action="review"]').click();
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
  expect(snapshot.public.review.evidence.every(e => e.status === 'unverified')).toBe(true); expect(snapshot.public.review.at).toBe(before.clock);
  await expect(panel).toContainText('No relevant received control');
  expect(snapshot.saved.intervals).toEqual([]);
  expect(snapshot.assessmentContext.deskAvailable).toBe(true);
  expect(snapshot.public.assessment).toBeNull();
  if (!snapshot.assessmentContext.atDesk) {
    expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('assess'))).toBe(false);
    await panel.locator('[data-supremacy-action="assessmentWalk"]').click();
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let i = 0; i < 45; i++) {
        const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
        if (!task) return;
        d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
      }
      throw new Error('Actual assessment-desk walk did not finish');
    });
  }
  await panel.locator('[data-supremacy-action="assess"]').click();
  snapshot = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
  expect(snapshot.assessmentContext.atDesk).toBe(true);
  expect(snapshot.public.assessment.evidence).toEqual(snapshot.public.review.evidence);
  await expect(panel).toContainText('Held records do not establish a complete worldwide qualifying interval');
  await expect(panel).toContainText('no accomplishment is awarded');
  const known = snapshot.public;
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().public)).toEqual(known);
  const originalTargets = (await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot())).saved.targets;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="journal"]').click();
  snapshot = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
  expect(snapshot.public).toEqual(known); expect(snapshot.saved.targets).toEqual(originalTargets);
  expect(snapshot.saved.phase).toBe('unverified'); expect(snapshot.saved.since).toBeNull();
  expect(snapshot.saved.intervals).toEqual([]);
  if (renderer === 'dom') {
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2,
      ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    const previousRun = snapshot.saved.runId;
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-supremacy-records.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
    await page.locator('[data-workspace-tab="journal"]').click();
    snapshot = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
    expect(snapshot.saved.runId).not.toBe(previousRun); expect(snapshot.public).toEqual(known); expect(snapshot.saved.intervals).toEqual([]);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const state = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(state.economy.money).toBe(before.money); expect(state.campaign.accomplishedAt).toBe(before.campaign.accomplishedAt);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(before.world);
  const frozen = snapshot.saved;
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('review'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('assess'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(10));
  expect((await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot())).saved).toEqual(frozen);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot()); expect(snapshot.public.review).toBeNull();
  expect(snapshot.saved?.since ?? null).toBeNull(); expect(snapshot.saved?.qualifiedAt ?? null).toBeNull(); expect(errors).toEqual([]);
  expect(snapshot.public.assessment).toBeNull(); expect(snapshot.saved?.intervals || []).toEqual([]);
});
