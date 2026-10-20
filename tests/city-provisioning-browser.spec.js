const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityProvisioningSnapshot());
const action = (page, a, expected = null) => page.evaluate(({ a, expected }) => window.helixHeresyDebug.cityProvisioningAction(a, expected), { a, expected });
// Repaint on real actions, reloads and explicit zero-step UI refreshes, not
// every isolated fixture-clock step.
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityProvisioningForTest(n, n !== 0), n);
async function walk(page, cell) {
  if (cell) expect(await page.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell, urgent: true })), cell)).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 40; i++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceCityProvisioningForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    throw new Error('Actual municipal walking did not finish');
  });
  await tick(page, 0);
}
async function reload(page) {
  await tick(page, 0); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function setup(page, renderer) {
  page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `city-provisioning-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'provisioning', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.citySuccessionAction('walk')) throw new Error('Original counter route refused');
  }, renderer);
  await walk(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, act = (a, e) => { if (!d.citySuccessionAction(a, e)) throw new Error(`Actual succession refused ${a}`); };
    d.configureCitySuccessionTest({ retirement: true }); act('request'); d.advanceCitySuccessionForTest(30);
    act('hear'); d.advanceCitySuccessionForTest(180); act('sign', d.citySuccessionSnapshot().succession.terms);
    d.configureSovereignBargainTest({ supply: 18, carried: true }); act('deliver');
    const s = d.citySuccessionSnapshot();
    for (const person of [...s.succession.leaders, s.bargain.defender]) { act('agree', person.id); d.advanceCitySuccessionForTest(60); }
    act('handover'); d.advanceCitySuccessionForTest(180);
    const after = d.citySuccessionSnapshot(), source = after.succession.source;
    // Explicit existing agriculture fixture, not a generated replacement farm
    // or an authority outcome supplied by the new provisioning consumer.
    d.configureCityProvisioningTest({ cityId: 'a', cityName: 'Aster', populationSourceId: source.populationSourceId, cityPopulation: 3000,
      charterId: source.charterId, institutionId: source.institutions.find(i => i.role === 'publicWorksAndProvisioning').id,
      satelliteId: 'original-farm:a', satelliteName: 'Original Aster Farm', satellitePopulation: 200,
      cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive', storageDays: 4,
      distanceKm: 10, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true });
  });
  await page.locator('[data-workspace-tab="visits"]').click();
  const s = await snapshot(page); expect(s.saved, JSON.stringify(s.context)).toBeTruthy();
  return s;
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original city quota, physical loading, real saves, blocked return, consumption and dated reports do not award city power`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const initial = await setup(page, renderer);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const panel = page.locator('[data-city-provisioning]'); await expect(panel).toContainText('Municipal agricultural supply obligation');
  await panel.locator('[data-provisioning-action="inspect"]').click();
  let s = await snapshot(page); expect(s.saved.quote.kg).toBe(400); const quote = s.saved.quote;
  expect(await action(page, 'dispatch', { ...quote, kg: 1200 })).toBe(false);
  await panel.locator('[data-provisioning-action="dispatch"]').click();
  s = await snapshot(page); expect(s.saved.order.phase).toBe('approaching'); expect(s.saved.vehicle.cargoKg).toBe(0);
  expect(s.saved.stores.farmKg).toBe(initial.saved.stores.farmKg);
  const dated = s.saved.report, driverId = s.saved.driver.id, vehicleId = s.saved.vehicle.id;
  // A real ordinary step through the production simulation, not only the
  // focused fixture clock, exercises the new heartbeat integration.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  for (let i = 0; i < 40; i++) {
    s = await snapshot(page); if (s.saved.order.phase === 'loading') break;
    const j = s.saved.network.journeys.find(j => j.id === s.saved.order.journeyId);
    if (j?.status === 'stranded') expect(await action(page, 'recover')).toBe(true);
    await tick(page, 60);
  }
  s = await snapshot(page); expect(s.saved.order.phase).toBe('loading');
  const beforeLoad = s.saved.order.loadedKg; await tick(page, 15); const partial = (await snapshot(page)).saved.order.handling;
  await reload(page); expect((await snapshot(page)).saved.order.handling).toBe(partial);
  await tick(page, 15); expect((await snapshot(page)).saved.order.loadedKg).toBeGreaterThanOrEqual(beforeLoad);
  expect((await snapshot(page)).saved.report).toEqual(dated);
  for (let i = 0; i < 40 && (await snapshot(page)).saved.order.phase !== 'inbound'; i++) await tick(page, 30);
  s = await snapshot(page); expect(s.saved.order.phase).toBe('inbound');
  // An actually occupied receiving tile must retain the original people and
  // truck outside, not teleport an arrival through the scientist.
  await walk(page, { x: 18, y: 15, z: 6 });
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.mapCell)).toEqual({ x: 18, y: 15, z: 6 });
  await tick(page, 1500); s = await snapshot(page);
  expect(s.saved.order.phase).toBe('inbound'); expect(s.saved.driver.mapCell).toBeNull(); expect(s.saved.order.deliveredKg).toBe(0);
  await reload(page); await walk(page, { x: 17, y: 8, z: 6 });
  for (let i = 0; i < 100 && (await snapshot(page)).saved.order; i++) {
    s = await snapshot(page); const j = s.saved.network.journeys.find(j => j.id === s.saved.order.journeyId);
    if (j?.status === 'stranded') expect(await action(page, 'recover')).toBe(true);
    await tick(page, 30);
  }
  s = await snapshot(page); expect(s.saved.order).toBeNull(); expect(s.saved.receipts).toHaveLength(1);
  expect(s.saved.receipts[0].deliveredKg).toBe(400); expect(s.saved.vehicle.cargoKg).toBe(0);
  expect(s.saved.driver.id).toBe(driverId); expect(s.saved.vehicle.id).toBe(vehicleId);
  expect(s.saved.vehicle.fuelKm).toBeCloseTo(580, 4); expect(s.saved.driver.mapCell).toEqual({ x: 18, y: 14, z: 6 });
  expect(s.saved.report).toEqual(dated); await panel.locator('[data-provisioning-action="report"]').click();
  s = await snapshot(page); expect(s.saved.report.receipts).toHaveLength(1); expect(s.saved.report.suppliedKg).toBeGreaterThan(0);
  await expect(panel).toContainText('400/400 kg received');
  expect(JSON.stringify(s.saved.report)).not.toMatch(/fuelKm|health|standingCropKg|workSeconds|journeyId|skills/);
  expect(s.succession.handover).toEqual(initial.succession.handover); expect(s.campaign).toEqual(initial.campaign);
  expect(s.stacks.filter(i => i.carriedBy === 'scientist')).toEqual(initial.stacks.filter(i => i.carriedBy === 'scientist'));
  const total = s.saved.stores.cityKg + s.saved.stores.farmKg + s.saved.vehicle.cargoKg + s.saved.demand.suppliedKg;
  expect(total).toBeCloseTo(s.saved.stores.initialKg + s.saved.stores.harvestedKg, 5);
  expect(await action(page, 'rest')).toBe(true); await tick(page, 14400); const rested = await snapshot(page);
  expect(rested.saved.rest.progress).toBe(14400); await reload(page); await tick(page, 14400);
  s = await snapshot(page); expect(s.saved.rest).toBeNull(); expect(s.saved.vehicle.fuelKm).toBeCloseTo(580, 4);
  expect(s.saved.driver.health).toBe(initial.saved.driver.health);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    state.physicalItemStacks.push({ id: 'owned-driver-ration', section: 'inventory', key: 'fieldRation', quantity: 1,
      carriedBy: 'scientist', roomId: state.scientist.roomId, cell: state.scientist.mapCell });
    d.importSurveyExpeditionTestState(state);
  });
  expect(await action(page, 'fieldRation')).toBe(false); // No handoff from the remote counter.
  expect(await action(page, 'depot')).toBe(true); await walk(page);
  const food = (await snapshot(page)).saved.driver.foodSeconds;
  expect(await action(page, 'fieldRation')).toBe(true); s = await snapshot(page);
  expect(s.saved.driver.foodSeconds).toBe(food + 14400);
  expect(s.stacks.find(i => i.id === 'owned-driver-ration')?.quantity || 0).toBe(0);
  expect(s.saved.driver.workSeconds).toBe(43200); // Giving food is not instant duty recovery.
  await reload(page); expect((await snapshot(page)).saved.receipts).toEqual(s.saved.receipts);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
