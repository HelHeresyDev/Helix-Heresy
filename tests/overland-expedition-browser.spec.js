const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), n);
const act = (page, action) => page.evaluate(action => window.helixHeresyDebug.overlandAction(action), action);
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function depart(page) {
  expect(await act(page, 'depart')).toBe(true);
  for (let i = 0; i < 20; i++) {
    const s = await snapshot(page); if (s.saved?.trip.status === 'walking') return;
    expect(s.tasks).toHaveLength(1); expect(s.tasks[0].reason).toBe('');
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Actual local departure walk unfinished');
}
async function setup(page, renderer) {
  page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `overland-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'overland', truth: { private: 'SECRET_GEOLOGY' }, publicProspects: {} } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 15, hunger: 15 });
  }, renderer);
  await visits(page);
  const original = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    money: s.economy.money, body: s.scientist.vocalBodyId, carrier: s.surveyExpeditions.carrier, stacks: d.actorInventorySnapshot().stacks,
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  return { errors, original };
}
test('Canvas actual departure, native clock, saved stop, carried food/water, rest and partial reversal preserve bodily distance and belongings without booking', async ({ page }) => {
  const { errors, original } = await setup(page, 'canvas');
  await expect(page.locator('[data-overland-expedition]')).toContainText('2.25 km');
  await depart(page); let s = await snapshot(page); expect(s.roomId).toBe('overlandApproachPosition'); expect(s.saved.route.distanceKm).toBe(2.25);
  const initial = s.saved.trip.positionKm;
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
  expect((await snapshot(page)).saved.trip.positionKm).toBeGreaterThan(initial);
  await advance(page, 300); s = await snapshot(page); expect(s.saved.trip.positionKm).toBeGreaterThan(.1); expect(s.needs.exertion).toBeGreaterThan(0);
  await visits(page); await page.getByRole('button', { name: 'Stop walking here', exact: true }).click();
  s = await snapshot(page); const position = s.saved.trip.positionKm;
  await reload(page); expect((await snapshot(page)).saved).toEqual(s.saved);
  expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('mainLab', { allowMultiRoom: true })))).toBe(false);
  const water = s.stacks.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0), thirst = s.needs.thirst;
  expect(water).toBeGreaterThan(0); await page.getByRole('button', { name: 'Stop and drink carried water', exact: true }).click(); await advance(page, 30);
  s = await snapshot(page); expect(s.stacks.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0)).toBe(water - 1);
  expect(s.needs.thirst).toBeLessThan(thirst); expect(s.saved.trip.positionKm).toBe(position);
  const hunger = s.needs.hunger; expect(await act(page, 'meal')).toBe(true); await advance(page, 30);
  expect((await snapshot(page)).needs.hunger).toBeLessThan(hunger);
  expect(await act(page, 'rest')).toBe(true); await advance(page, 900); expect((await snapshot(page)).saved.trip.positionKm).toBe(position);
  expect(await act(page, 'reverse')).toBe(true); expect((await snapshot(page)).saved.trip).toMatchObject({ direction: -1, status: 'stopped', positionKm: position });
  expect(await act(page, 'resume')).toBe(true); await advance(page, 10000);
  s = await snapshot(page); expect(s.saved.trip.status).toBe('arrived'); expect(s.saved.trip.positionKm).toBe(0);
  expect(s.saved.trip.walkedKm).toBeCloseTo(position * 2, 8); expect(s.saved.history).toHaveLength(1);
  const result = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return { body: s.scientist.vocalBodyId,
    money: s.economy.money, carrier: s.surveyExpeditions.carrier, stacks: d.actorInventorySnapshot().stacks,
    survey: s.surveyExpeditions, valid: d.validateMapScene(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  expect(result.body).toBe(original.body); expect(result.money).toBe(original.money); expect(result.carrier?.contract).toBeFalsy();
  expect(result.carrier?.vehicle).toEqual(original.carrier?.vehicle); expect(result.survey.materialized).toBe(false);
  expect(result.stacks.map(i => i.id).every(id => original.stacks.some(i => i.id === id))).toBe(true);
  expect(result.valid).toEqual([]); expect(result.world).toBe(original.world); expect(errors).toEqual([]);
});
test('DOM on-foot arrival creates no vehicle, preserves changed ground through return/revisit, holds at blocked home, and freezes on death without same-world inheritance', async ({ page }) => {
  const { errors, original } = await setup(page, 'dom'); await depart(page); await advance(page, 12000);
  let s = await snapshot(page); expect(s.saved.trip.status).toBe('arrived'); expect(s.roomId).toBe('supportedSurveyGround');
  const ground = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const item = d.configureHiddenWorkshopTest({ supplies: { lumber: 1 } })[0];
    return { item, baseline: s.surveyExpeditions.discovery.baseline, permission: s.surveyExpeditions.discovery.access,
      cabin: s.rooms.some(r => r.id === 'surveyVehicleCabin'), materialized: s.surveyExpeditions.materialized, carrier: s.surveyExpeditions.carrier }; });
  expect(ground.cabin).toBe(false); expect(ground.materialized).toBe(true); expect(ground.carrier?.contract).toBeFalsy(); expect(ground.permission.active).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
  await depart(page); await advance(page, 300); s = await snapshot(page); await reload(page); expect((await snapshot(page)).saved).toEqual(s.saved);
  const home = s.approach.home;
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
    d.overlandAction('stop'); d.overlandAction('resume');
  }, home.cell);
  await advance(page, 12000); s = await snapshot(page);
  expect(s.saved.trip).toMatchObject({ status: 'stopped', positionKm: 0 }); expect(s.saved.trip.reason).toContain('receiving point');
  expect(s.roomId).toBe('overlandApproachPosition'); expect(s.saved.history).toHaveLength(1); await reload(page);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === cell[k]));
    d.importSurveyExpeditionTestState(s);
  }, home.cell);
  expect(await act(page, 'resume')).toBe(true); await advance(page, 2); expect((await snapshot(page)).roomId).toBe(home.roomId);
  await depart(page); await advance(page, 12000); s = await snapshot(page); expect(s.roomId).toBe('supportedSurveyGround');
  const retained = await page.evaluate(id => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return {
    baseline: s.surveyExpeditions.discovery.baseline, permission: s.surveyExpeditions.discovery.access,
    item: s.physicalItemStacks.find(i => i.id === id), carrier: s.surveyExpeditions.carrier, valid: window.helixHeresyDebug.validateMapScene() }; }, ground.item);
  expect(retained.baseline).toEqual(ground.baseline); expect(retained.permission).toEqual(ground.permission);
  expect(retained.item).toMatchObject({ key: 'lumber', quantity: 1, carriedBy: '', roomId: 'supportedSurveyGround' });
  expect(retained.carrier?.vehicle).toEqual(original.carrier?.vehicle); expect(retained.valid).toEqual([]);
  await depart(page); await advance(page, 60); await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = (await snapshot(page)).saved; expect(await act(page, 'reverse')).toBe(false); await advance(page, 100); expect((await snapshot(page)).saved).toEqual(frozen);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/); expect((await snapshot(page)).saved).toBeNull(); expect(errors).toEqual([]);
});
