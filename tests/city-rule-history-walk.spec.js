const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(180000);
test('returned scientist can physically walk through ordinary closed doors to the records desk', async ({ page }) => {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, 'city-history-desk-route');
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const finish = () => {
      for (let i = 0; i < 60; i++) {
        const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
        if (!t) { d.advanceCityRuleForTest(0); return; }
        d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
      }
      throw Error('Actual laboratory walk did not finish');
    };
    const outward = Boolean(d.startScientistMove('surfaceReception', { allowMultiRoom: true })); finish();
    const before = d.supremacySnapshot().assessmentContext, started = d.supremacyAction('assessmentWalk'); finish();
    return { outward, before, started, after: d.supremacySnapshot().assessmentContext, survey: d.surveyExpeditionSnapshot() };
  });
  expect(result.outward).toBe(true); expect(result.before.atDesk).toBe(false); expect(result.before.local).toBe(true);
  expect(result.started).toBe(true); expect(result.after.atDesk).toBe(true); expect(result.after.busy).toBe(false);
  expect(result.survey.scientistRoomId).toBe('mainLab'); expect(result.survey.tasks).toEqual([]);
});
