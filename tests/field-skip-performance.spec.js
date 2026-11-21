const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');

test('ordinary field time skip saves once and preserves the exact completed or interrupted second', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('dialog', dialog => dialog.accept());
  await startLifecycleRun(page, 'field-skip-timing');
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));

  const profile = seconds => page.evaluate(seconds => {
    const d = window.helixHeresyDebug, input = document.getElementById('skipAmountInput');
    input.value = seconds;
    const before = d.wildernessBeastSnapshot();
    d.resetSimulationPerformance();
    const started = performance.now();
    document.getElementById('skipTimeBtn').click();
    const elapsedMs = performance.now() - started, p = d.simulationPerformanceSnapshot(), after = d.wildernessBeastSnapshot();
    return { elapsedMs, saved: p.save, render: p.render, clock: p.clock, advanced: after.clock - before.clock,
      notices: after.noticeSerial - before.noticeSerial,
      scheduledMs: Object.values(p.systems).reduce((n, s) => n + s.totalMs, 0),
      specimen: after.actors.find(a => a.id === 'timed-rimefang'), health: after.health, injuries: after.injuries };
  }, seconds);
  const lab = await profile(8);
  expect(lab.advanced).toBe(8);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'beast-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002',
      approachCellId: 'planet-cell:00001', label: 'Woodland Boundary', temperatureC: 18, slopePercent: 20, precipitationMm: 500,
      terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'Bounded test sector.' }, mode: 'wilderness', autoCare: false });
    const at = d.simulationPerformanceSnapshot().clock;
    d.configureWildernessBeastsTest({ actors: [{ id: 'timed-rimefang', cell: { x: 23, y: 12, z: 6 },
      nextAttackAt: at + 1000, nextMoveAt: at + 1000 }] });
  });
  const fieldStart = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  const completed = await profile(8);
  expect(completed.advanced).toBe(8);
  expect(completed.notices).toBe(0);
  expect(await page.evaluate(() => window.HelixWorldRunLibrary.createRepository(localStorage).continuation().state.clock)).toBe(completed.clock);

  await page.evaluate(saved => {
    saved.wildernessBeasts.actors[0].nextAttackAt = saved.clock + 4;
    window.helixHeresyDebug.importSurveyExpeditionTestState(saved);
  }, fieldStart);
  const interrupted = await profile(8);
  expect(interrupted.advanced).toBe(4);
  expect(interrupted.notices).toBeGreaterThan(0);
  expect(interrupted.specimen.nextAttackAt).toBeGreaterThan(interrupted.clock);

  const timings = [lab, completed, interrupted].map(({ advanced, elapsedMs, saved, render, scheduledMs }) => ({
    advanced, elapsedMs, saves: saved.calls, saveMs: saved.totalMs, renderMs: render.totalMs,
    simulationMs: elapsedMs - saved.totalMs - render.totalMs, scheduledMs
  }));
  console.log(`Ordinary skip timings (lab, field, encounter): ${JSON.stringify(timings)}`);
  if (!process.env.FIELD_SKIP_BASELINE) {
    expect(completed.saved.calls).toBe(1);
    expect(interrupted.saved.calls).toBe(1);
  }
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const saved = await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot());
  expect(saved.clock).toBe(interrupted.clock);
  expect(saved.actors.find(a => a.id === 'timed-rimefang')).toEqual(interrupted.specimen);
  expect(saved.health).toBe(interrupted.health);
  expect(saved.injuries).toEqual(interrupted.injuries);
  if (!process.env.FIELD_SKIP_BASELINE) {
    const direct = await page.evaluate(saved => {
      const d = window.helixHeresyDebug;
      saved.wildernessBeasts.actors[0].nextAttackAt = saved.clock + 2;
      d.importSurveyExpeditionTestState(saved);
      d.resetSimulationPerformance();
      d.advanceTestRunTime(3);
      const p = d.simulationPerformanceSnapshot();
      return { advanced: p.clock - saved.clock, saves: p.save.calls,
        persisted: window.HelixWorldRunLibrary.createRepository(localStorage).continuation().state.clock === p.clock };
    }, fieldStart);
    expect(direct).toEqual({ advanced: 2, saves: 1, persisted: true });
  }
  expect(errors).toEqual([]);
});
