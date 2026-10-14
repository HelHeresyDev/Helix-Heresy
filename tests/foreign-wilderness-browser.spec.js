const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { openForeignWorkspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(540000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const wild = page => page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
test('canvas foreign wilderness physically discovers, shelters, samples and withdraws without extending municipal rights or resetting original sites across real saves', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'foreign-wilderness', 'canvas', false, false, 0, 'wilderness');
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const original = state.resourceSurveys.context || { worldId: 'lifecycle-world', siteId: 'original-home-parcel', strategicCellId: 'planet-cell:00009', seed: 'home-fixture',
      truth: { potentialPermille: { ferrousOre: 700 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 800, environmentalDifficultyPermille: 0 } };
    if (!state.resourceSurveys.context) d.setResourceSurveyTestContext(original);
    if (!d.setForeignSurveyTestSource(source, carrier, { ...original, siteId: source.placeId, strategicCellId: source.cellId })) return false;
    return d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: -10, precipitationMm: 1200, biomeLabel: 'Cold forest' }], occupied: [], context: original });
  }, { source, carrier })).toBe(true);
  const before = await snap(page), home = before.surveys.context, homeNeeds = (await wild(page)).needs;
  expect(await act(page, 'enterWilderness')).toBe(false);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  const parked = await snap(page), driver = parked.excursion.carrier.driver, fuel = parked.excursion.carrier.vehicle.fuelKm;
  expect(parked.excursion.wilderness.discovery).toBeNull(); expect(parked.excursion.wilderness.materialized).toBe(false);
  expect(await act(page, 'enterWilderness')).toBe(true);
  expect((await wild(page)).site.discovery).toBeNull(); // Planning does not survey or populate the wild.
  await finish(page); let w = await wild(page), s = await snap(page);
  expect(w.roomId).toBe(w.site.roomId); expect(w.site.discovery.baseline.rocks.length).toBeGreaterThan(0);
  expect(w.site.discovery.records.length).toBeGreaterThan(0); expect(w.site.context.siteId).not.toBe(home.siteId);
  expect(s.surveys.context).toEqual(home); expect(w.needs.destination).toEqual(homeNeeds.destination);
  expect(s.excursion.carrier.driver.id).toBe(driver.id); expect(s.excursion.carrier.driver.roomId).toBe(s.excursion.roomId);
  expect(s.excursion.carrier.vehicle.fuelKm).toBe(fuel); expect(await act(page, 'board')).toBe(false);
  // Municipal expiry does not extend ground permission, nor prohibit an actual wilderness sample or paid return.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.permission.endsAt = s.clock - 1;
    s.wildernessSurvival.autoCare = false; d.importSurveyExpeditionTestState(s); });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('deployShelter'))).toBe(true); await finish(page);
  w = await wild(page); const shelter = w.site.shelter; expect(shelter).toBeTruthy(); expect(w.sheltered).toBe(true);
  const savedBaseline = w.site.discovery.baseline, savedRecords = w.site.discovery.records, exposure = w.needs.exposure;
  await reload(page); w = await wild(page); expect(w.site.shelter).toEqual(shelter); expect(w.site.discovery.baseline).toEqual(savedBaseline);
  expect(w.site.discovery.records).toEqual(savedRecords); expect(w.needs.exposure).toBeCloseTo(exposure);
  expect(await act(page, 'survey', { method: 'shallowCore', cell: w.cell })).toBe(true);
  let task = (await snap(page)).tasks.find(t => t.type === 'physicalDiagnostic'); expect(task.reason).toBe('');
  await advance(page, 20); const remaining = (await snap(page)).tasks.find(t => t.id === task.id).dueAt - (await snap(page)).clock;
  await reload(page); expect((await snap(page)).tasks.find(t => t.id === task.id).dueAt - (await snap(page)).clock).toBeCloseTo(remaining);
  await finish(page); s = await snap(page); const sample = s.diagnostics.samples.find(i => i.captured.resourceSurvey?.siteId === w.site.context.siteId);
  expect(sample).toBeTruthy(); expect(s.stacks.find(i => i.id === sample.stackId).carriedBy).toBe('scientist');
  expect(await act(page, 'withdraw')).toBe(true); await finish(page); s = await snap(page);
  expect(s.context.atFieldEntry).toBe(true); expect(await act(page, 'survey', { method: 'reconnaissance', cell: s.excursion.entry })).toBe(false);
  const oldBeasts = s.excursion.wilderness.beasts, oldShelter = s.excursion.wilderness.shelter;
  // Leave the surviving physical kit, then revisit without generating another kit, map or population.
  expect(await act(page, 'enterWilderness')).toBe(true); await finish(page); w = await wild(page);
  expect(w.site.discovery.baseline).toEqual(savedBaseline); expect(w.site.shelter).toEqual(oldShelter);
  expect(w.site.beasts.actors.map(a => a.id)).toEqual(oldBeasts.actors.map(a => a.id));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('packShelter'))).toBe(true); await finish(page);
  expect((await wild(page)).site.shelter).toBeNull();
  expect(await act(page, 'withdraw')).toBe(true); await finish(page);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  s = await snap(page); expect(s.excursion.phase).toBe('depot'); expect(s.surveys.context).toEqual(home);
  expect(s.passenger.vehicle.id).toBe(before.passenger.vehicle.id); expect(s.passenger.vehicle.fuelKm).toBe(before.passenger.vehicle.fuelKm);
  expect(s.excursion.carrier.vehicle.fuelKm).toBeCloseTo(195.5); expect(s.stacks.find(i => i.id === sample.stackId).carriedBy).toBe('scientist');
  expect(errors).toEqual([]);
});
