const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { openForeignWorkspace, workspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(540000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
test('canvas foreign surface-survey trip physically carries finite samples to a leased bench, preserving original vehicles and interrupted work across real saves', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page, 'foreign-surface-survey', 'canvas', false, false, 0, true);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const original = state.resourceSurveys.context || { worldId: 'lifecycle-world', siteId: 'original-home-parcel', strategicCellId: 'planet-cell:00009', seed: 'home-fixture',
      truth: { potentialPermille: { ferrousOre: 700, constructionStone: 500 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 800, environmentalDifficultyPermille: 0 } };
    if (!state.resourceSurveys.context) d.setResourceSurveyTestContext(original);
    const context = { ...original, siteId: source.placeId, strategicCellId: source.cellId, seed: 'real-foreign-fixture' };
    return d.setForeignSurveyTestSource(source, carrier, context); }, { source, carrier })).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click(); const panel = page.locator('[data-foreign-survey]');
  const before = await snap(page), originalPassenger = before.passenger, kit = before.stacks.find(i => i.key === 'environmentalSurveyKit' && i.carriedBy === 'scientist');
  expect(kit).toBeTruthy(); expect(await act(page, 'book')).toBe(false);
  await panel.getByRole('button', { name: 'Review foreign municipal sampling terms', exact: true }).click();
  await panel.getByRole('button', { name: 'Accept exact foreign sampling access', exact: true }).click();
  await panel.getByRole('button', { name: 'Book original foreign municipal round trip (94 marks)', exact: true }).click();
  let s = await snap(page); expect(s.money).toBe(before.money - 94); expect(s.excursion.phase).toBe('collecting');
  await advance(page, 120); expect((await snap(page)).excursion.phase).toBe('city');
  await panel.getByRole('button', { name: 'Board original foreign survey vehicle', exact: true }).click(); await finish(page);
  s = await snap(page); expect(s.context.aboard).toBe(true); expect(s.excursion.phase).toBe('outbound');
  await advance(page, 300); s = await snap(page); expect(s.excursion.leg.progressKm).toBeCloseTo(1);
  await reload(page); expect((await snap(page)).excursion.leg.progressKm).toBeCloseTo(1); await advance(page, 300);
  await panel.getByRole('button', { name: 'Disembark foreign survey vehicle', exact: true }).click(); await finish(page);
  s = await snap(page); expect(s.context.atField).toBe(true); expect(s.stacks.find(i => i.id === kit.id).roomId).toBe(s.excursion.roomId);
  expect(await act(page, 'survey', { method: 'shallowCore', cell: s.excursion.entry })).toBe(false);
  expect(await act(page, 'survey', { method: 'surfaceSample', cell: s.excursion.entry })).toBe(true);
  s = await snap(page); const task = s.tasks.find(t => t.type === 'physicalDiagnostic'); expect(task.reason).toBe('');
  await advance(page, Math.max(1, (task.dueAt - s.clock) / 2)); s = await snap(page); const remaining = s.tasks.find(t => t.id === task.id).dueAt - s.clock;
  await reload(page); s = await snap(page); expect(s.tasks.find(t => t.id === task.id).dueAt - s.clock).toBeCloseTo(remaining);
  await finish(page); s = await snap(page); const sample = s.diagnostics.samples.find(i => i.captured.resourceSurvey?.siteId === source.placeId);
  expect(sample).toBeTruthy(); expect(s.stacks.find(i => i.id === sample.stackId).carriedBy).toBe('scientist');
  expect(s.stacks.some(i => i.key === 'sealedReagentBottle' && i.carriedBy === 'scientist')).toBe(false);
  // A real original-driver failure holds the paid return, not a defeat or rescue.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.carrier.driver.health = 0; d.importSurveyExpeditionTestState(s); });
  expect(await act(page, 'board')).toBe(false); await advance(page, 60); expect((await snap(page)).context.alive).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.carrier.driver.health = 100; d.importSurveyExpeditionTestState(s); });
  if (!(await snap(page)).context.atFieldEntry) { expect(await act(page, 'walkVehicle')).toBe(true); await finish(page); }
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  s = await snap(page); expect(s.excursion.phase).toBe('depot'); expect(s.excursion.carrier.vehicle.fuelKm).toBeCloseTo(195.5);
  expect(s.passenger.driver.id).toBe(originalPassenger.driver.id); expect(s.passenger.vehicle.id).toBe(originalPassenger.vehicle.id);
  expect(s.passenger.vehicle.fuelKm).toBe(originalPassenger.vehicle.fuelKm); expect(s.passenger.provisionsSeconds).toBeLessThan(originalPassenger.provisionsSeconds);
  expect(await wa(page, 'walk')).toBe(true); await finish(page); const w = await workspace(page), reagent = w.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  expect(await wa(page, 'drop', { stackId: reagent.id })).toBe(true); expect(await wa(page, 'assay', { stackId: sample.stackId })).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.some(i => i.id === sample.stackId || i.id === reagent.id)).toBe(false);
  const observation = s.surveys.observations.find(i => i.sampleStackId === sample.stackId); expect(observation).toMatchObject({ siteId: source.placeId, coverage: 'local sampling point; strategic cell remains unsurveyed' });
  await reload(page); expect((await snap(page)).surveys.observations.find(i => i.id === observation.id)).toEqual(observation);
  expect(errors).toEqual([]);
});
