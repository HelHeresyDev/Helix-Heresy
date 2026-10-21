const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const march = page => page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot());
const walk = page => page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), seconds);
const act = (page, action) => page.evaluate(a => window.helixHeresyDebug.overlandAction(a), action);
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page, passenger = false) {
  for (let n = 0; n < 20; n++) {
    const s = await walk(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe('');
    const seconds = Math.max(1, s.tasks[0].dueAt - s.clock + 1);
    if (passenger) await page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), seconds);
    else await advance(page, seconds);
  }
  throw new Error('Physical movement or attendance did not finish');
}
async function journey(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true);
  await finish(page, true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true);
  await finish(page, true);
}
async function depart(page, objective = 'reconnoitre', queuedReload = false) {
  const s = await march(page); expect(s.plans).toHaveLength(1);
  expect(await page.evaluate(({ id, objective }) => window.helixHeresyDebug.intercityMarchAction('depart', id, objective), { id: s.plans[0].id, objective })).toBe(true);
  if (queuedReload) await reload(page);
  await finish(page); expect((await walk(page)).saved.trip.status).toBe('walking');
}
for (const renderer of ['dom', 'canvas']) test(`${renderer} real learned itinerary, saved partial retreat, exterior staging and persistent property never confer admission or political power`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `intercity-march-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', assetId: 'original-a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-driver', publicName: 'Original Transport', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00003' },
        ...['a', 'b'].map(id => ({ id: `city:${id}`, cityId: id, label: `City ${id}`, kind: 'fortifiedCity', known: true, jurisdiction: { kind: 'city', cityId: id }, supportComponentId: 'one', cellId: 'planet-cell:00001' }))
      ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], continuity: 'continuous', supportCapable: true, distanceKm: 2 }] } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal', 'fieldShelter'] });
    d.configureWildernessTest({ autoCare: false, thirst: 15, hunger: 15 });
  }, renderer);
  await visits(page); expect((await march(page)).plans).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.intercityMarchAction('depart', 'intercity-march:route:ab'))).toBe(false);
  await journey(page); await journey(page); // Real finite paid outward journey and separate paid return.
  const original = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    carrier: s.intercityPassenger, money: s.economy.money, campaign: s.campaign, city: s.citySuccession,
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), body: s.scientist.vocalBodyId }; });
  expect((await march(page)).plans).toHaveLength(1);
  await depart(page, 'reconnoitre', true);
  const beforeNative = (await walk(page)).saved.trip.positionKm;
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
  expect((await walk(page)).saved.trip.positionKm).toBeGreaterThan(beforeNative);
  await advance(page, 120); let s = await walk(page); const distance = s.saved.trip.positionKm;
  expect(distance).toBeGreaterThan(0); expect(distance).toBeLessThan(2);
  if (renderer === 'dom') {
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
      s.strategicJourneys.routes[0].continuity = 'closed'; d.importSurveyExpeditionTestState(s); });
    await advance(page, 30); expect((await walk(page)).saved.trip.positionKm).toBe(distance);
    expect((await walk(page)).saved.trip.status).toBe('stopped'); expect(await act(page, 'resume')).toBe(false);
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
      s.strategicJourneys.routes[0].continuity = 'continuous'; d.importSurveyExpeditionTestState(s); });
  }
  await visits(page); await page.getByRole('button', { name: 'Reverse direction and stop', exact: true }).click();
  s = await walk(page); expect(s.stop).toBeTruthy(); const stopped = s.saved;
  await reload(page); expect((await walk(page)).saved).toEqual(stopped);
  expect(await act(page, 'resume')).toBe(true); await advance(page, 2000);
  expect((await walk(page)).roomId).toBe('supportedSurveyGround');
  let m = await march(page); expect(m.saved.history).toHaveLength(1); expect(m.saved.history[0].stagedAt).toBeNull();
  expect(m.saved.history[0].walkedKm).toBeCloseTo(distance * 2, 8);
  await depart(page, 'prepareTerms');
  // A previously visited roadside position pauses the actual later passage.
  for (let n = 0; n < 12; n++) {
    await advance(page, 8000); s = await walk(page);
    if (s.saved.trip.positionKm === 2) break;
    expect(s.saved.trip.status).toBe('stopped'); expect(await act(page, 'resume')).toBe(true); await finish(page);
  }
  s = await walk(page); m = await march(page);
  expect(s.saved.trip).toMatchObject({ status: 'stopped', positionKm: 2 }); expect(s.stop).toBeTruthy();
  expect(m.saved.operation.phase).toBe('staging'); expect(m.saved.operation.stagingSiteId).toBe(s.stop.id); expect(s.sheltered).toBe(false);
  const site = s.stop, meal = s.stacks.find(i => i.key === 'trailMeal'); expect(meal).toBeTruthy();
  expect(await page.evaluate(id => window.helixHeresyDebug.roadsideAction('drop', id), meal.id)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(false);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { allowMultiRoom: true })))).toBe(false);
  await reload(page); expect((await walk(page)).stop.id).toBe(site.id);
  expect((await march(page)).saved.operation.stagedAt).toBe(m.saved.operation.stagedAt);
  expect(await act(page, 'water')).toBe(true); await finish(page);
  expect((await walk(page)).stacks.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0))
    .toBe(s.stacks.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0) - 1);
  expect(await act(page, 'reverse')).toBe(true); expect(await act(page, 'resume')).toBe(true); await finish(page);
  const origin = (await march(page)).saved.operation.origin;
  if (renderer === 'dom') await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s); }, origin.cell);
  let blockedReturnChecked = false;
  for (let n = 0; n < 12 && (await march(page)).saved.operation.phase !== 'returned'; n++) {
    await advance(page, 8000); if ((await march(page)).saved.operation.phase === 'returned') break;
    const outside = await walk(page);
    if (renderer === 'dom' && outside.saved.trip.positionKm === 0 && !blockedReturnChecked) {
      expect(outside.saved.trip.status).toBe('stopped'); expect(outside.stop).toBeTruthy();
      expect(outside.roomId).not.toBe(origin.roomId); expect(outside.saved.trip.reason).toContain('receiving point');
      await reload(page); expect((await walk(page)).saved.trip.positionKm).toBe(0);
      await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
        s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === cell[k]));
        d.importSurveyExpeditionTestState(s); }, origin.cell);
      blockedReturnChecked = true;
    }
    expect(await act(page, 'resume')).toBe(true); await finish(page);
  }
  if (renderer === 'dom') expect(blockedReturnChecked).toBe(true);
  expect((await march(page)).saved.history).toHaveLength(2); expect((await walk(page)).roomId).toBe('supportedSurveyGround');
  const result = await page.evaluate(({ siteId, mealId }) => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    carrier: s.intercityPassenger, money: s.economy.money, campaign: s.campaign, city: s.citySuccession, body: s.scientist.vocalBodyId,
    parcel: s.physicalItemStacks.find(i => i.id === mealId), site: s.roadsideStops.sites.find(p => p.id === siteId),
    valid: d.validateMapScene(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; }, { siteId: site.id, mealId: meal.id });
  expect(result.money).toBe(original.money); expect(result.carrier.vehicle).toEqual(original.carrier.vehicle);
  expect(result.body).toBe(original.body); expect(result.campaign).toEqual(original.campaign); expect(result.city).toEqual(original.city);
  expect(result.parcel).toMatchObject({ carriedBy: '', roomId: site.roomId }); expect(result.site.baseline).toEqual(site.baseline);
  expect(result.world).toBe(original.world); expect(result.valid).toEqual([]); expect(errors).toEqual([]);
  if (renderer === 'canvas') {
    await depart(page); await advance(page, 30); await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
    const frozen = (await walk(page)).saved; expect(await act(page, 'reverse')).toBe(false); await advance(page, 100);
    expect((await walk(page)).saved).toEqual(frozen);
    await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
    await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
    const fresh = await march(page); expect(fresh.saved?.operation || null).toBeNull(); expect(fresh.plans).toEqual([]);
  }
});
