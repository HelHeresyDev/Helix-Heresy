const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');

async function configureField(page, populatedLab) {
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
  if (populatedLab) {
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      const saved = d.exportSurveyExpeditionTestState();
      const lab = saved.labMap.rooms.mainLab;
      if (lab.cells.length < 12) throw new Error('The benchmark needs twelve lab cells');
      saved.slimes = lab.cells.slice(0, 12).map((cell, i) => ({
        id: `slime-${i + 1}`, name: `Lab slime ${i + 1}`, genome: '', source: 'Field skip benchmark',
        createdAt: saved.clock, matureAt: saved.clock, mature: true, deathAt: saved.clock + 3600,
        lifecycleVersion: 1, status: 'released', roomId: 'mainLab', mapCell: cell,
        nextAutonomousDecisionAt: saved.clock + 60,
        stats: { bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 100, max: 100 },
          currentMass: { current: 15, max: 100 }, stress: { current: 0, max: 100 } }
      }));
      saved.nextSlimeNumber = 13;
      d.importSurveyExpeditionTestState(saved);
    });
  }
  return page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
}

test('ordinary field time skip saves once and preserves the exact completed or interrupted second', async ({ page }) => {
  const profilePopulatedLab = process.env.FIELD_SKIP_POPULATED_LAB === '1';
  test.setTimeout(profilePopulatedLab ? 300000 : 180000);
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
      livingSlimes: p.livingSlimes, systems: p.systems,
      scheduledMs: Object.values(p.systems).reduce((n, s) => n + s.totalMs, 0),
      specimen: after.actors.find(a => a.id === 'timed-rimefang'), health: after.health, injuries: after.injuries };
  }, seconds);
  const lab = await profile(8);
  expect(lab.advanced).toBe(8);
  const fieldStart = await configureField(page, profilePopulatedLab);
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
  if (profilePopulatedLab) {
    expect(completed.livingSlimes).toBe(12);
    expect(interrupted.livingSlimes).toBe(12);
    const costs = [completed, interrupted].map(({ advanced, systems }) => ({
      advanced, systems: Object.fromEntries(Object.entries(systems).map(([id, { calls, totalMs }]) =>
        [id, { calls, ms: Math.round(totalMs) }]))
    }));
    console.log(`Populated-lab field systems (${completed.livingSlimes} living slimes): ${JSON.stringify(costs)}`);
  }
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

test('field Next Event shortcut redraws the current map, preserves focus and shows the interruption', async ({ page }) => {
  test.setTimeout(300000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startLifecycleRun(page, 'field-skip-timing');
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  const fieldStart = await configureField(page, true);
  await expect(page.locator('#skipTimeBtn')).toBeHidden();
  const viewport = page.locator('#roomList .lab-map-canvas-host');

  async function profile(attack) {
    const before = await page.evaluate(({ saved, attack }) => {
      const d = window.helixHeresyDebug;
      // A real mana-recovery checkpoint 9.375 game seconds away. A binary
      // fraction makes the chosen interval exact without changing the clock.
      saved.scientist.vitals.mana.current = saved.scientist.vitals.mana.max - 1 / 64;
      if (attack) saved.wildernessBeasts.actors[0].nextAttackAt = saved.clock + 4;
      d.importSurveyExpeditionTestState(saved);
      return d.wildernessBeastSnapshot();
    }, { saved: fieldStart, attack });
    await viewport.focus();
    await page.evaluate(() => {
      window.helixHeresyDebug.resetSimulationPerformance({ profileRenderSections: true });
      let startedAt;
      document.addEventListener('keydown', () => { startedAt = performance.now(); }, { capture: true, once: true });
      document.addEventListener('keydown', () => { window.fieldShortcutMs = performance.now() - startedAt; }, { once: true });
    });
    await page.keyboard.press('Period');
    const result = await page.evaluate(() => {
      const d = window.helixHeresyDebug, p = d.simulationPerformanceSnapshot();
      return { after: d.wildernessBeastSnapshot(), feed: document.getElementById('messageFeed').textContent,
        paused: document.getElementById('pauseReadout').textContent, shortcutMs: window.fieldShortcutMs, p };
    });
    expect(result.p.livingSlimes).toBe(12);
    expect(result.p.render.calls).toBe(1);
    expect(result.p.mapSurface.calls).toBe(1);
    expect(result.p.renderSections['actionControls:fullRedraw']?.calls).toBe(1);
    expect(result.p.renderSections['actionControls:liveReadouts']).toBeUndefined();
    expect(result.p.renderSections['haulPlanning:routeSearch']?.calls).toBe(1);
    expect(result.p.renderSections['diffusion:excavatedKeys']?.calls).toBe(Math.ceil(result.after.clock - before.clock));
    expect(result.p.renderSections['roomSummaries:geometryReuse']?.calls).toBe(2 * result.p.systems.environment.calls);
    await expect(viewport).toBeFocused();
    return { ...result, advanced: result.after.clock - before.clock, notices: result.after.noticeSerial - before.noticeSerial };
  }

  const complete = await profile(false);
  const interrupted = await profile(true);
  const costs = [complete, interrupted].map(({ advanced, p, shortcutMs }) => ({ advanced, shortcutMs: Math.round(shortcutMs),
    saves: p.save.calls, saveMs: Math.round(p.save.totalMs), renderMs: Math.round(p.render.totalMs),
    startupUiCalls: p.startupUi.calls, startupUiMs: Math.round(p.startupUi.totalMs),
    mapSurfaceMs: Math.round(p.mapSurface.totalMs), sceneMs: Math.round(p.mapScene.totalMs),
    haulRouteSearches: p.renderSections['haulPlanning:routeSearch']?.calls || 0,
    exteriorAmbientLookups: p.renderSections['environment:exteriorAmbient']?.calls || 0,
    roomSummaryCalls: p.renderSections['roomSummaries:allCallers']?.calls || 0,
    roomGeometryBuilds: p.renderSections['roomSummaries:geometry']?.calls || 0,
    roomGeometryReuses: p.renderSections['roomSummaries:geometryReuse']?.calls || 0,
    systemsMs: Object.fromEntries(Object.entries(p.systems).sort((a, b) => b[1].totalMs - a[1].totalMs)
      .map(([id, sample]) => [id, Math.round(sample.totalMs)])),
    controlRefreshes: Object.fromEntries(Object.entries(p.renderSections).filter(([id]) => id.startsWith('actionControls:'))
      .map(([id, sample]) => [id, sample.calls])),
    otherRenderMs: Math.round(p.render.totalMs - p.mapSurface.totalMs),
    sectionsMs: Object.fromEntries(Object.entries(p.renderSections).sort((a, b) => b[1].totalMs - a[1].totalMs)
      .map(([id, sample]) => [id, Math.round(sample.totalMs)]))
  }));
  console.log(`Field Next Event keyboard timings (completed, interrupted): ${JSON.stringify(costs)}`);
  expect(complete.advanced).toBe(9.375);
  expect(complete.notices).toBe(0);
  expect(interrupted.advanced).toBe(4);
  expect(interrupted.notices).toBeGreaterThan(0);
  expect(interrupted.paused).toBe('Paused');
  expect(interrupted.feed).toMatch(/Rimefang.*(struck|attacked)/i);
  if (process.env.FIELD_SKIP_STARTUP_BASELINE !== '1') {
    expect(complete.p.startupUi.calls).toBe(0);
    expect(interrupted.p.startupUi.calls).toBe(0);
    await page.locator('#newRunBtn').click();
    await expect(page.locator('#loadLastSaveBtn')).toBeEnabled();
    await expect(page.locator('#loadLastSaveStatus')).toContainText('Chemistry Front');
    await page.locator('#loadLastSaveBtn').click();
    const continued = await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot());
    expect(continued.clock).toBe(interrupted.after.clock);
    expect(continued.health).toBe(interrupted.after.health);
    expect(continued.injuries).toEqual(interrupted.after.injuries);
  }
  expect(errors).toEqual([]);
});

test('Economy shows one consistent, fresh credibility assessment after a company change', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startLifecycleRun(page, 'company-redraw-assessment');
  await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="company"]').click();

  async function expectVisibleAssessment() {
    const { assessment } = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
    await expect(page.locator('#economySummary')).toContainText(`${assessment.band.label} cover`);
    await expect(page.locator('#economyCompanyBadge')).toHaveText(String(assessment.exceptions.length + 1));
    await expect(page.locator(`[data-company-credibility="${assessment.band.id}"]`)).toBeVisible();
    await expect(page.locator('[data-company-exception]')).toHaveCount(assessment.exceptions.length);
    const commercial = assessment.dimensions.find(dimension => dimension.id === 'commercial');
    await expect(page.locator('[data-company-credibility-dimension="commercial"]')).toHaveAttribute('title', commercial.reasons.join('\n'));
    return commercial;
  }

  const before = await expectVisibleAssessment();
  await page.getByLabel('Company operating state').selectOption('open');
  const after = await expectVisibleAssessment();
  expect(after.reasons).not.toEqual(before.reasons);
  expect(errors).toEqual([]);
});

test('action controls update resource and stamina blockers on full and live-map redraws', async ({ page }) => {
  test.setTimeout(150000);
  const fixedNow = new Date('2026-01-01T00:00:00Z').getTime();
  await page.clock.setFixedTime(fixedNow);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await startLifecycleRun(page, 'action-control-refresh');
  const foundry = page.locator('[data-workspace-tab="foundry"]');
  const synthesize = page.locator('#synthesizeBtn');
  await foundry.click();
  await expect(synthesize).toBeEnabled();

  const stocked = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await page.evaluate(saved => {
    saved.physicalItemStacks = saved.physicalItemStacks.filter(stack => stack.section !== 'resources' || stack.key !== 'biomass');
    window.helixHeresyDebug.importSurveyExpeditionTestState(saved);
  }, stocked);
  await expect(synthesize).toBeDisabled();
  await expect(synthesize).toHaveAttribute('data-disabled-reason', /Not enough Biomass/);

  await page.evaluate(saved => {
    const cost = Number(document.getElementById('synthesizeBtn').dataset.finalStaminaCost);
    saved.scientist.vitals.stamina.current = cost - 1 / 1200;
    window.helixHeresyDebug.importSurveyExpeditionTestState(saved);
  }, stocked);
  await expect(synthesize).toBeDisabled();
  await expect(synthesize).toHaveAttribute('data-disabled-reason', /Not enough stamina/);

  await page.locator('[data-workspace-tab="map"]').click();
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pauseBtn')).toHaveText('Pause');
  await page.evaluate(() => window.helixHeresyDebug.resetSimulationPerformance({ profileRenderSections: true }));
  // One real-time second crosses the ordinary Stamina recovery threshold.
  await page.clock.setFixedTime(fixedNow + 1000);
  await expect.poll(() => page.evaluate(() => {
    const p = window.helixHeresyDebug.simulationPerformanceSnapshot();
    return p.renderSections['actionControls:liveReadouts']?.calls || 0;
  })).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.simulationPerformanceSnapshot().renderSections['actionControls:fullRedraw'])).toBeUndefined();
  await foundry.click();
  await expect(synthesize).toBeEnabled();
  await expect(synthesize).not.toHaveAttribute('data-disabled-reason', /Not enough/);
  expect(errors).toEqual([]);
});
