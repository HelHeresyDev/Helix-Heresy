const { test, expect } = require('@playwright/test');
const Surveys = require('../resource-surveys');
const Diagnostics = require('../diagnostic-system');
const CanvasRenderer = require('../canvas-map-renderer');
const { pathToFileURL } = require('url');
const path = require('path');
const context = () => ({ worldId: 'world-test', siteId: 'parcel-test', strategicCellId: 'planet-cell:00001', seed: 'survey-test', publicProspects: { prospectBands: { ferrousOre: 'moderate', manaCrystals: 'high' } }, arcaneInterference: 850,
  truth: { potentialPermille: Object.fromEntries(Object.keys(Surveys.FAMILIES).map((id) => [id, 900])), typicalDepth: { ferrousOre: 'veryDeep', baseMetalOre: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } });
const cell = { x: 10, y: 12, z: 1 };

test('local indicators respect depth and never establish absence, reserves, or regional coverage', () => {
  const captured = Surveys.capture(context(), cell, 'shallowCore', 0, 95);
  const result = Surveys.record(Surveys.defaultState(context()), captured, { score: 95 });
  expect(result.observation.findings.find((entry) => entry.familyId === 'ferrousOre').result).toBe('notDetected');
  expect(result.observation.findings.find((entry) => entry.familyId === 'baseMetalOre').result).toBe('indicatorsDetected');
  const known = Surveys.publicKnowledge(result.state);
  expect(known).toMatchObject({ coveredPoints: 1, wholeCellSurveyed: false, grantsExtractionRights: false });
  expect(JSON.stringify(known)).not.toMatch(/potentialPermille|signals|evidenceKey|surfaceAccessibility|veryDeep/);
  expect(known.observations[0].findings[0].summary).toContain('absence is not established');
});

test('repeat measurements and JSON reloads cannot reroll or inflate independent coverage', () => {
  const ctx = context(); const before = JSON.stringify(ctx);
  const first = Surveys.capture(ctx, cell, 'reconnaissance', 100, 70, { id: 'kit-one' });
  const later = Surveys.capture(ctx, cell, 'reconnaissance', 999, 70, { id: 'kit-two' });
  expect(Surveys.assess(first, 70)).toEqual(Surveys.assess(later, 70));
  let state = Surveys.record(Surveys.defaultState(ctx), first).state;
  state = Surveys.record(Surveys.normalizeState(JSON.parse(JSON.stringify(state))), later).state;
  expect(Surveys.publicKnowledge(state).coveredPoints).toBe(1);
  expect(JSON.stringify(ctx)).toBe(before);
  expect(Surveys.defaultState(ctx).observations).toEqual([]);
  expect(Surveys.normalizeState(state)).toEqual(state);
  expect(Surveys.record(Surveys.defaultState({ ...ctx, siteId: 'other-parcel' }), first).observation).toBeNull();
});

test('poor instruments are inconclusive and arcane anomalies do not identify a resource', () => {
  const captured = Surveys.capture(context(), cell, 'arcaneSurvey', 0, 80);
  const finding = Surveys.assess(captured, 80)[0];
  expect(finding).toMatchObject({ familyId: 'arcaneIndicators', result: 'indicatorsDetected' });
  expect(finding.summary).toContain('identity unresolved');
  expect(Surveys.assess(captured, 10)[0].result).toBe('inconclusive');
  expect(Surveys.assess({ ...captured, quality: 10 }, 100)[0].result).toBe('inconclusive');
});

test('sealed resource samples preserve captured source and quality through diagnostic normalization', () => {
  const captured = Surveys.capture(context(), cell, 'surfaceSample', 45, 62, { calibration: 50 });
  const sample = Diagnostics.normalizeSample({ id: 'sample-1', stackId: 'stack-1', methodId: 'resourceSurfaceSample', cell, collectedAt: 45, captured: { resourceSurvey: captured } });
  const saved = Diagnostics.normalizeState({ samples: [sample] });
  expect(saved.samples[0].captured.resourceSurvey).toEqual(captured);
  expect(Surveys.assess(saved.samples[0].captured.resourceSurvey, 90)).toEqual(Surveys.assess(captured, 62));
});

test('canvas prospect markers have a visible style without changing the public prospect bands', () => {
  expect(CanvasRenderer.cellStyle({ base: { kind: 'surface' }, overlay: { id: 'prospecting', states: ['resources-high'] } })).toMatchObject({ fill: '#26311f', stroke: '#bdefff' });
  const state = Surveys.record(Surveys.defaultState(context()), Surveys.capture(context(), cell, 'reconnaissance', 0, 70)).state;
  expect(Surveys.publicKnowledge(state).publicProspects).toEqual(context().publicProspects);
  expect(Surveys.publicKnowledge(state, 'planet-cell:00002').observations).toHaveLength(0);
});

async function start(page) {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((ctx) => window.helixHeresyDebug.setResourceSurveyTestContext(ctx), context());
  return page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    return debug.surfaceMapSnapshot().ground.find((entry) => entry.terrainId === 'grass' && !debug.resourceSurveyBlockReason('shallowCore', entry.cell))?.cell;
  });
}
async function finish(page) {
  await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    for (let step = 0; step < 6; step += 1) {
      const task = debug.resourceSurveySnapshot().tasks[0];
      if (!task) return;
      debug.advanceSimulation(Math.max(0, task.dueAt - debug.strategicJourneysSnapshot().clock) + 1);
    }
    throw new Error('Diagnostic work did not complete after six scheduled simulation advances');
  });
}
test.describe('local prospecting integration', () => {
  test.setTimeout(90000);
  test('routed reconnaissance creates only local findings and wears the instrument', async ({ page }) => {
    const target = await start(page);
    expect(target).toBeTruthy();
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startResourceSurvey('reconnaissance', cell), target)).toBe(true);
    const queued = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot());
    expect(queued.tasks[0].data.mapPath.length).toBeGreaterThan(1);
    expect(queued.observations).toHaveLength(0);
    await finish(page);
    const result = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot());
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({ methodId: 'reconnaissance', cell: target });
    expect(result.wholeCellSurveyed).toBe(false);
    expect(result.observations[0].instrument.calibration).toBe(45);
    const instrument = await page.evaluate(() => Object.values(window.helixHeresyDebug.diagnosticsSnapshot().instruments).find((entry) => entry.instanceId.startsWith('environmentalSurveyKit')));
    expect(instrument.calibration).toBe(41);
    await expect(page.locator('[data-resource-survey-findings]')).toContainText('Local Resource Findings');
    const overlay = await page.evaluate((target) => {
      const debug = window.helixHeresyDebug;
      debug.setMapLayer(target.z);
      debug.centerMapOnCell(target);
      debug.setMapOverlay('prospecting');
      return debug.mapSceneSnapshot().cells.filter((cell) => cell.overlay?.id === 'prospecting').map((cell) => cell.overlay);
    }, target);
    expect(overlay.length).toBeGreaterThan(0);
    expect(JSON.stringify(overlay)).not.toMatch(/potentialPermille|surfaceAccessibility|signals|evidenceKey/);
  });
  test('sample collection consumes a bottle; saved sample and reagent become a provenance-linked assay', async ({ page }) => {
    const target = await start(page);
    const count = () => page.evaluate(() => {
      const stacks = window.helixHeresyDebug.physicalStockSnapshot().stacks;
      return Object.fromEntries(['sealedReagentBottle', 'assayReagent'].map((key) => [key, stacks.filter((stack) => stack.key === key).reduce((sum, stack) => sum + stack.quantity, 0)]));
    });
    const before = await count();
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startResourceSurvey('shallowCore', cell), target)).toBe(true);
    await finish(page);
    let snapshot = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot());
    expect(snapshot.observations).toHaveLength(0);
    expect(snapshot.samples).toHaveLength(1);
    expect((await count()).sealedReagentBottle).toBe(before.sealedReagentBottle - 1);
    const sample = snapshot.samples[0];
    await page.evaluate(() => window.helixHeresyDebug.restoreResourceSurveyTestState());
    expect(await page.evaluate((id) => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(true);
    await finish(page);
    snapshot = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot());
    expect(snapshot.samples).toHaveLength(0);
    expect(snapshot.observations[0]).toMatchObject({ sampleId: sample.id, sampleStackId: sample.stackId, methodId: 'shallowCore' });
    expect(snapshot.observations[0].diagnosticResultId).toBeTruthy();
    expect((await count()).assayReagent).toBe(before.assayReagent - 1);
  });
  test('cancellation releases bottle and tool reservations without findings', async ({ page }) => {
    const target = await start(page);
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startResourceSurvey('surfaceSample', cell), target)).toBe(true);
    const queued = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot().tasks[0]);
    expect(queued.data.reservedStackIds.length).toBeGreaterThan(0);
    expect(await page.evaluate((id) => window.helixHeresyDebug.cancelTask(id), queued.id)).toBeTruthy();
    expect((await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot())).observations).toHaveLength(0);
    expect(await page.evaluate((cell) => window.helixHeresyDebug.resourceSurveyBlockReason('surfaceSample', cell), target)).toBe('');
  });
  test('arcane prospecting stays unidentified and ordinary outdoor air assays still work', async ({ page }) => {
    const target = await start(page);
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startResourceSurvey('arcaneSurvey', cell), target)).toBe(true);
    await finish(page);
    const observed = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot().observations[0]);
    expect(observed.findings).toHaveLength(1);
    expect(observed.findings[0].familyId).toBe('arcaneIndicators');
    expect(await page.evaluate((cell) => window.helixHeresyDebug.startSampleCollection('airVial', 'tile', '', cell), target)).toBe(true);
    await finish(page);
    const sample = await page.evaluate(() => window.helixHeresyDebug.diagnosticsSnapshot().samples.at(-1));
    expect(sample.methodId).toBe('airVial');
    expect(await page.evaluate((id) => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(true);
    await finish(page);
    const result = await page.evaluate(() => window.helixHeresyDebug.diagnosticsSnapshot());
    expect(result.samples).toHaveLength(0);
    expect(result.results.at(-1).workflowId).toBe('assaySample');
    expect(result.results.at(-1).readings.some((reading) => reading.key === 'airborneIdentity')).toBe(true);
    expect((await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot())).observations).toHaveLength(1);
  });
});
