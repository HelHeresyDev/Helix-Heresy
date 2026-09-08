const { test, expect } = require('@playwright/test');
const Expeditions = require('../survey-expeditions');
const Journeys = require('../strategic-journeys');
const Surveys = require('../resource-surveys');
const { pathToFileURL } = require('url');
const path = require('path');
function network() {
  return { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Helix Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'component:one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'component:one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] };
}
function context() { return { worldId: 'survey-world', siteId: 'parcel-test', strategicCellId: 'planet-cell:00009', seed: 'survey-test', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 900 }, typicalDepth: { ferrousOre: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } }; }
test('public municipal destination uses real city geography and only a supported route', () => {
  const saved = network(), before = JSON.stringify(saved);
  const destination = Expeditions.destinationFor(saved);
  expect(destination).toMatchObject({ cityId: 'a', cellId: 'planet-cell:00001', dangerBand: 'veryLow' });
  expect(destination.permission).toContain('No ownership');
  const state = Journeys.defaultState({ network: saved }); state.destinations.push(destination);
  expect(Expeditions.quote(Journeys.routePlan(state, saved.homeDestinationId, destination.id, 'hiredFreightRoad'))).toMatchObject({ ok: true, distanceKm: 4, fee: 104 });
  state.destinations[0].routeContinuity = 'closed';
  expect(Expeditions.quote(Journeys.routePlan(state, saved.homeDestinationId, destination.id, 'hiredFreightRoad')).ok).toBe(false);
  expect(JSON.stringify(saved)).toBe(before);
  expect(Expeditions.destinationFor({ ...saved, nearestSettlementDestinationId: 'missing' })).toBeNull();
});
test('physical manifest, bounded account reports, and saved expedition state', () => {
  const stacks = Expeditions.PACK_LIST.map((item) => ({ key: item.key, quantity: item.amount, carriedBy: 'scientist', unitMassKg: 1, unitVolumeL: 2 }));
  expect(Expeditions.manifestReason(stacks)).toBe('');
  expect(Expeditions.manifestReason(stacks.map((entry) => ({ ...entry, carriedBy: '' })))).toContain('Pack');
  expect(Expeditions.cargoUnits([{ quantity: 1, unitMassKg: 241, unitVolumeL: 1 }])).toBe(25);
  const report = Expeditions.report({ money: 10, openLegalOrders: 2, hiddenFaults: ['leak'], exactInventory: 99 }, 30);
  expect(report).toMatchObject({ observedAt: 30, money: 10, openLegalOrders: 2 });
  expect(report.hiddenFaults).toBeUndefined(); expect(report.exactInventory).toBeUndefined();
  const state = { ...Expeditions.defaultState(), phase: 'field', materialized: true, hazardDisturbed: true, report, visits: 2 };
  expect(Expeditions.normalizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  expect(Expeditions.defaultState().visits).toBe(0);
});
test('off-site samples can be assayed at home without accepting unknown sites or other worlds', () => {
  const home = context(), field = { ...home, siteId: 'survey:a', strategicCellId: 'planet-cell:00001' };
  const captured = Surveys.capture(field, { x: 12, y: 12, z: 6 }, 'surfaceSample', 10, 80);
  const state = Surveys.defaultState(home); state.sites[field.siteId] = field;
  const saved = Surveys.normalizeState(JSON.parse(JSON.stringify(state)));
  expect(Surveys.record(saved, captured, { at: 60, score: 75 }).observation).toMatchObject({ siteId: field.siteId, sampledAt: 10, recordedAt: 60 });
  expect(Surveys.record(Surveys.defaultState(home), captured).observation).toBeNull();
  expect(Surveys.record(saved, { ...captured, worldId: 'other-world' }).observation).toBeNull();
});
async function start(page) {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((options) => window.helixHeresyDebug.setSurveyExpeditionTestContext(options), { network: network(), context: context() });
}
const snapshot = (page) => page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot());
let packedState;
async function finishWork(page) {
  await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    for (let i = 0; i < 12; i++) {
      const saved = debug.surveyExpeditionSnapshot(); const task = saved.tasks.find((entry) => !entry.reason);
      if (!task) return;
      debug.advanceSimulation(Math.max(0, task.dueAt - saved.clock) + 1);
    }
    throw new Error('Routed work failed to finish: ' + JSON.stringify(debug.surveyExpeditionSnapshot().tasks));
  });
}
async function pack(page) {
  for (const item of Expeditions.PACK_LIST.filter((item) => item.required)) {
    expect(await page.evaluate((key) => window.helixHeresyDebug.packSurveyItem(key), item.key), item.key).toBe(true);
    await finishWork(page);
  }
  packedState = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
}
async function prepared(page) {
  await start(page);
  if (packedState) await page.evaluate((saved) => window.helixHeresyDebug.importSurveyExpeditionTestState(saved), packedState);
  else await pack(page);
}
async function travel(page) {
  await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    for (let i = 0; i < 6; i++) {
      const saved = debug.surveyExpeditionSnapshot();
      if (!['outbound', 'inbound'].includes(saved.phase)) return;
      const journey = debug.strategicJourneysSnapshot().journeys.find((entry) => entry.id === saved.journeyId);
      if (journey.status === 'stranded') debug.controlSurveyJourney('recover');
      else debug.advanceSimulation(Math.max(1, journey.exactArrivalAt - saved.clock + 1));
    }
    throw new Error('Saved journey did not resolve');
  });
}
test.describe('supported survey integration', () => {
  test.setTimeout(300000);
  test('physical packing, travel, field sample, reload, return, and home assay', async ({ page }) => {
    await start(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    await pack(page);
    const prepared = await snapshot(page); expect(prepared.departureReason).toBe('');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
    expect((await snapshot(page)).phase).toBe('home');
    await finishWork(page);
    let saved = await snapshot(page); expect(saved.phase).toBe('outbound'); expect(saved.scientistCell.z).toBe(7);
    expect(saved.money).toBe(prepared.money - prepared.quote.fee);
    expect(saved.carried.find((entry) => entry.key === 'fieldRation').quantity).toBe(1);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).journeyId).toBe(saved.journeyId);
    await travel(page);
    saved = await snapshot(page); expect(saved.phase).toBe('field'); expect(saved.scientistCell).toEqual(Expeditions.RENDEZVOUS);
    const cell = { x: 13, y: 12, z: 6 };
    expect(await page.evaluate((cell) => window.helixHeresyDebug.resourceSurveyBlockReason('surfaceSample', cell), cell)).toBe('');
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startResourceSurvey('surfaceSample', cell), cell)).toBe(true);
    await finishWork(page);
    const sample = (await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot())).samples[0]; expect(sample).toBeTruthy();
    expect(await page.evaluate((id) => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).phase).toBe('field');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
    expect((await snapshot(page)).phase).toBe('field');
    await finishWork(page); await travel(page);
    saved = await snapshot(page); expect(saved.phase).toBe('home'); expect(saved.scientistCell.z).not.toBe(6);
    expect(saved.carried.find((entry) => entry.id === sample.stackId)).toBeTruthy();
    expect(await page.evaluate((id) => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(true);
    await finishWork(page);
    const findings = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot());
    expect(findings.observations[0]).toMatchObject({ siteId: 'survey:a', sampleStackId: sample.stackId });
    expect(findings.samples).toHaveLength(0);
    expect(findings.wholeCellSurveyed).toBe(false);
  });

  test('knowledge boundaries, carried first aid, cancelled treatment, and persistent revisits', async ({ page }) => {
    await prepared(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
    await finishWork(page); await travel(page);
    const before = await snapshot(page);
    const remoteTask = await page.evaluate(() => window.helixHeresyDebug.queueSurveyLabTestTask());
    await page.evaluate(() => { const debug = window.helixHeresyDebug; debug.setSurveyRelayTestState(false); debug.advanceSimulation(2); debug.setSurveyLabTestReport(4321); });
    expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
    let saved = await snapshot(page);
    expect(saved.report).toEqual(before.report);
    expect(saved.visibleTabs).not.toContain('economy'); expect(saved.visibleTabs).not.toContain('resources');
    expect(saved.visibleEvents.some((event) => event.message === 'Laboratory-only test fault')).toBe(false);
    expect(saved.tasks.find((task) => task.id === remoteTask).reason).toContain('off site');
    await page.evaluate(() => { window.helixHeresyDebug.setSurveyRelayTestState(true); window.helixHeresyDebug.refreshSurveyReport(); });
    expect((await snapshot(page)).report.money).toBe(4321);
    expect((await snapshot(page)).report.observedAt).toBeGreaterThan(before.report.observedAt);
    expect(await page.evaluate(() => { const debug = window.helixHeresyDebug; debug.setMapLayer(0); return debug.mapViewSnapshot().viewport.z; })).toBe(6);
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: cell }), Expeditions.HAZARD)).toBeTruthy();
    await finishWork(page);
    saved = await snapshot(page); expect(saved.hazardDisturbed).toBe(true); expect(saved.injuries).toHaveLength(1);
    expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
    const injuryId = saved.injuries[0].id;
    expect(await page.evaluate((id) => window.helixHeresyDebug.treatSurveyInjuryForTest(id), injuryId)).toBe(true);
    const medicalTask = (await snapshot(page)).tasks.find((task) => task.type === 'injuryTreatment');
    await page.evaluate((id) => window.helixHeresyDebug.cancelTask(id), medicalTask.id);
    expect((await snapshot(page)).carried.find((stack) => stack.key === 'medicalBandage').reservedTaskId).toBe('');
    expect(await page.evaluate((id) => window.helixHeresyDebug.treatSurveyInjuryForTest(id), injuryId)).toBe(true);
    await finishWork(page);
    saved = await snapshot(page); expect(saved.injuries[0].status).toBe('recovering');
    expect(saved.carried.find((stack) => stack.key === 'medicalBandage').quantity).toBe(1);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    expect((await snapshot(page)).hazardDisturbed).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
    await finishWork(page);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(31));
    expect(await page.evaluate(() => window.helixHeresyDebug.controlSurveyJourney('cancel'))).toBe(true);
    expect((await snapshot(page)).phase).toBe('inbound');
    await travel(page);
    saved = await snapshot(page); expect(saved.phase).toBe('field'); expect(saved.visits).toBe(2); expect(saved.hazardDisturbed).toBe(true);
    expect(saved.scientistCell).toEqual(Expeditions.RENDEZVOUS);
    expect(saved.tasks.find((task) => task.id === remoteTask).reason).toContain('off site');
  });

  test('cancelled packing releases its real supply, predeparture cancellation disembarks, and recovery keeps the passenger', async ({ page }) => {
    await start(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.packSurveyItem('environmentalSurveyKit'))).toBe(true);
    const packing = (await snapshot(page)).tasks.find((task) => task.type === 'surveyExpeditionWork');
    await page.evaluate((id) => window.helixHeresyDebug.cancelTask(id), packing.id);
    expect((await snapshot(page)).carried.some((stack) => stack.key === 'environmentalSurveyKit')).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.packSurveyItem('environmentalSurveyKit'))).toBe(true);
    await finishWork(page);
    if (packedState) await page.evaluate((saved) => window.helixHeresyDebug.importSurveyExpeditionTestState(saved), packedState);
    else { await start(page); await pack(page); }
    await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle()); await finishWork(page);
    expect(await page.evaluate(() => window.helixHeresyDebug.controlSurveyJourney('cancel'))).toBe(true);
    expect((await snapshot(page)).phase).toBe('home');
    await prepared(page);
    await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle()); await finishWork(page);
    const outbound = await snapshot(page);
    await page.evaluate(() => window.helixHeresyDebug.strandSurveyJourneyForTest());
    expect(await page.evaluate(() => window.helixHeresyDebug.controlSurveyJourney('recover'))).toBe(true);
    expect((await snapshot(page)).carried.map((stack) => stack.id)).toEqual(outbound.carried.map((stack) => stack.id));
    await travel(page); expect((await snapshot(page)).phase).toBe('field');
  });
});
