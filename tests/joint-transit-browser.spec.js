const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.jointTransitSnapshot());
const advance = (page, n, bulk = false) => page.evaluate(({ n, bulk }) => window.helixHeresyDebug.advanceJointTransitForTest(n, bulk), { n, bulk });
const action = (page, a, index = 0, stackId = '') => page.evaluate(({ a, index, stackId }) => window.helixHeresyDebug.jointTransitAction(a, index, stackId), { a, index, stackId });
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page) {
  for (let n = 0; n < 16; n++) { const s = await snap(page), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(s)).toBe(''); await advance(page, Math.max(1, Math.ceil(t.dueAt - s.clock + 1))); }
  throw new Error('Original physical task did not finish');
}
async function walk(page, roomId, cell) {
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, urgent: true })), { roomId, cell })).toBe(true);
  await finish(page);
}
async function setup(page, renderer, foot = false) {
  page.setDefaultTimeout(20000); page.on('dialog', d => d.accept()); await startLifecycleRun(page, `joint-transit-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', assetId: 'people:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-driver', publicName: 'Original Passenger Service', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00003' },
        ...['a', 'b'].map(cityId => ({ id: `city:${cityId}`, cityId, label: `City ${cityId}`, kind: 'fortifiedCity', known: true, jurisdiction: { kind: 'city', cityId }, supportComponentId: 'one', cellId: 'planet-cell:00001' }))
      ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2, cellPath: ['planet-cell:00001', 'planet-cell:00002', 'planet-cell:00003'] }] } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 10, hunger: 10 });
    const state = d.exportSurveyExpeditionTestState();
    state.physicalItemStacks.push({ id: 'original-owned-upkeep-part', section: 'resources', key: 'metalParts', quantity: 1, carriedBy: 'scientist', roomId: state.scientist.roomId, cell: state.scientist.mapCell });
    d.importSurveyExpeditionTestState(state);
    if (!d.setJointTransitTestSource({ id: 'original-fort:ab', name: 'Original Joint Fort', corridorId: 'route:ab', cellId: 'planet-cell:00002',
      populationId: 'fort-population:ab', population: 100, endpointCityIds: ['a', 'b'], distanceKm: 2, positionKm: 1,
      sponsors: ['a', 'b'].map((cityId, i) => ({ cityId, charterId: `charter:${cityId}`, authorityId: `ruler:${cityId}`, institutionId: `works:${cityId}`, populationId: `people:${cityId}`, staffingPercent: i ? 65 : 35, upkeepPercent: i ? 65 : 35 })),
      administration: 'dividedSponsorFacilities', serviceMode: 'groundConvoy', independentlySovereign: false, independentDiplomacy: false,
      physicalCondition: 'intact', services: { utilities: 'functional', provisioning: 'functional', transport: 'functional' } })) throw new Error('Original joint source fixture failed');
  }, renderer);
  await visits(page);
  if (foot) {
    // An original completed passenger receipt is input to this foot consumer;
    // no walking, checkpoint service, fort condition or victory is assigned.
    await page.evaluate(() => {
      const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), p = state.intercityPassenger;
      const at = state.clock;
      p.trip = { id: 'prior-paid-return', routeId: 'route:ab', destinationId: 'city:b', destinationCityId: 'b', destinationLabel: 'City b',
        outbound: false, bodyEpoch: state.scientistIdentity.bodyEpoch, km: 2, seconds: 600, arrivedAt: at,
        arrivalWindow: { start: at, end: at }, directions: 'Original personally completed direct-neighbor itinerary only.' };
      p.receipts = [{ id: p.trip.id, at, destination: 'a', fee: 108 }];
      const m = window.HelixIntercityMarch.create({ worldId: state.jointTransit.worldId, runId: state.jointTransit.runId });
      if (!window.HelixIntercityMarch.learn(m, p, at)) throw new Error('Missing original itinerary input');
      state.intercityMarch = m; d.importSurveyExpeditionTestState(state);
    });
  }
  const original = await page.evaluate(() => ({ state: window.helixHeresyDebug.exportSurveyExpeditionTestState(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }));
  if (foot) return original;
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await advance(page, 1600); let s = await snap(page); expect(s.passenger.trip.distanceKm).toBe(1);
  expect(s.passenger.phase).toBe('outbound'); expect(s.ledger.stations).toHaveLength(1); expect(s.roomId).toBe(s.passenger.spaces.cabin.roomId);
  const fuel = s.passenger.vehicle.fuelKm, food = s.passenger.provisionsSeconds;
  await advance(page, 20); s = await snap(page); expect(s.passenger.vehicle.fuelKm).toBe(fuel); expect(s.passenger.provisionsSeconds).toBe(food - 20);
  expect(await action(page, 'exit')).toBe(true); await finish(page); s = await snap(page); expect(s.localId, JSON.stringify(s)).toBe('original-fort:ab');
  expect(await action(page, 'walk')).toBe(true); await finish(page);
  return original;
}
test('DOM original joint shares, physical upkeep gift, saved inspection and real boarding permit exactly one passenger leg', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await setup(page, 'dom');
  let s = await snap(page), fort = s.ledger.stations[0]; const people = fort.members.map(a => a.id), fuel = s.passenger.vehicle.fuelKm;
  // Explicit initial competing allocation: one original part is unavailable to this service.
  await page.evaluate(() => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), fort = state.jointTransit.stations[0];
    const stock = state.physicalItemStacks.find(i => fort.stockIds.includes(i.id) && i.cityOwnerId === 'b' && i.key === 'metalParts');
    stock.quantity -= 1; d.importSurveyExpeditionTestState(state); });
  expect(await action(page, 'request')).toBe(false); expect((await snap(page)).ledger.stations[0].operation).toBeNull();
  expect(await action(page, 'supply', 1, 'original-owned-upkeep-part')).toBe(true); await advance(page, 10);
  const queued = (await snap(page)).tasks[0]; await reload(page); expect((await snap(page)).tasks[0].id).toBe(queued.id); await finish(page);
  s = await snap(page); fort = s.ledger.stations[0]; expect(fort.receipts.filter(r => r.kind === 'supplied')).toHaveLength(1);
  expect(s.stacks.filter(i => i.key === 'metalParts' && i.cityOwnerId === 'b').reduce((n, i) => n + i.quantity, 0)).toBe(13);
  expect(await action(page, 'walk')).toBe(true); await finish(page);
  await page.locator('[data-joint-transit-action="request"]').click(); await advance(page, 20); s = await snap(page);
  expect(s.ledger.stations[0].job.progress).toBeGreaterThan(0); const partial = s.ledger.stations[0].job;
  await reload(page); expect((await snap(page)).ledger.stations[0].job).toEqual(partial); await advance(page, 80);
  s = await snap(page); fort = s.ledger.stations[0]; expect(fort.operation.coverage).toEqual([0, 1]); expect(fort.operation.manifest.reduce((n, r) => n + r.quantity, 0)).toBe(40);
  expect(fort.receipts.filter(r => r.kind === 'one-passenger-crossing')).toHaveLength(1); expect(s.passenger.trip.checkpoint.cleared).toBe(false);
  expect(s.passenger.vehicle.fuelKm).toBe(fuel); expect(fort.members.map(a => a.id)).toEqual(people);
  expect(await action(page, 'board')).toBe(true); await finish(page); expect((await snap(page)).passenger.trip.checkpoint.cleared).toBe(true);
  await advance(page, 1600); s = await snap(page); expect(s.passenger.phase).toBe('arrival'); expect(s.passenger.location).toBe('b');
  expect(s.passenger.vehicle.fuelKm).toBeCloseTo(original.state.intercityPassenger.vehicle.fuelKm - 2, 6);
  expect(s.ledger.stations[0].source.sponsors.map(a => a.upkeepPercent)).toEqual([35, 65]);
  expect(s.ledger.stations[0].source.independentlySovereign).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
test('Canvas interrupted original staffing, finite expiry, dated reports and measured turnaround never grant city admission or a learned uncompleted route', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await setup(page, 'canvas');
  let s = await snap(page), fort = s.ledger.stations[0]; const ids = fort.members.map(a => a.id);
  expect(await action(page, 'request')).toBe(true); await advance(page, 15); const duty = (await snap(page)).ledger.stations[0].members[0].workSeconds;
  await walk(page, fort.layout.roomId, fort.layout.entry); await advance(page, 1); s = await snap(page);
  expect(s.ledger.stations[0].job).toBeNull(); expect(s.ledger.stations[0].operation).toBeNull();
  expect(s.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(40); expect(s.ledger.stations[0].members[0].workSeconds).toBeLessThanOrEqual(duty);
  expect(await action(page, 'walk')).toBe(true); await finish(page); expect(await action(page, 'request')).toBe(true); await advance(page, 100);
  s = await snap(page); fort = s.ledger.stations[0]; expect(fort.receipts.filter(r => r.kind === 'one-passenger-crossing')).toHaveLength(1);
  await walk(page, fort.layout.roomId, fort.layout.entry); const dated = (await snap(page)).ledger.stations[0].report;
  await advance(page, fort.operation.endsAt - s.clock + 2, true); s = await snap(page); fort = s.ledger.stations[0];
  expect(fort.operation.endedAt).toBe(fort.operation.endsAt); expect(fort.windows).toHaveLength(1); expect(fort.report).toEqual(dated);
  expect(fort.members.map(a => a.id)).toEqual(ids); expect(s.passenger.trip.distanceKm).toBe(1); expect(s.passenger.trip.checkpoint.cleared).toBe(false);
  expect(await action(page, 'board')).toBe(true); s = await snap(page); expect(s.tasks[0].reason).toMatch(/current joint receiving service/);
  await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), s.tasks[0].id);
  expect(await action(page, 'turnBack')).toBe(true); await finish(page); await advance(page, 1600); s = await snap(page);
  expect(s.passenger.location).toBe('a'); expect(s.passenger.phase).toBe('arrival');
  expect(s.passenger.vehicle.fuelKm).toBeCloseTo(original.state.intercityPassenger.vehicle.fuelKm - 2, 6);
  expect(await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans)).toEqual([]);
  const frozen = s.ledger; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).ledger).toEqual(frozen);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world); expect(errors).toEqual([]);
});
test('DOM measured independent walking reaches the same source fort and resumes without fabricated commercial service or road destruction', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await setup(page, 'dom', true);
  const plan = await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans[0]);
  expect(await page.evaluate(id => window.helixHeresyDebug.intercityMarchAction('depart', id), plan.id)).toBe(true);
  await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(5000));
  let s = await snap(page); const overland = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
  expect(overland.saved.trip.positionKm).toBe(1); expect(overland.saved.trip.status).toBe('stopped');
  expect(s.localId, JSON.stringify(s)).toBe('original-fort:ab'); const originalPeople = s.ledger.stations[0].members.map(a => a.id);
  expect(s.ledger.stations[0].operation).toBeNull(); expect(s.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(40);
  await reload(page); expect((await snap(page)).ledger.stations[0].members.map(a => a.id)).toEqual(originalPeople);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(1));
  expect((await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot())).saved.trip.positionKm).toBeGreaterThan(1);
  expect((await snap(page)).ledger.stations[0].operation).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world); expect(errors).toEqual([]);
});
