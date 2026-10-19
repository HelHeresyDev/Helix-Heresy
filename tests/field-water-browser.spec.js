const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { reload } = require('./helpers/field-station');
test.setTimeout(1080000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldWaterSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldWaterForTest(n), n);
const act = (page, kind, options = {}) => page.evaluate(({ kind, options }) => window.helixHeresyDebug.fieldWaterAction(kind, options), { kind, options });
async function finish(page) {
  for (let i = 0; i < 35; i++) {
    const s = await snap(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason || '', JSON.stringify(s.tasks[0])).toBe('');
    await tick(page, 90);
  }
  throw Error(`Unfinished water work: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function walk(page, cell) {
  const s = await snap(page); if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: s.roomId, cell })).toBe(true);
  await finish(page);
}
async function fixture(page, renderer) {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, `water-${renderer}`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100,
    physicalCondition: 'intact', services: { transport: 'functional' } }] }, cityGovernments: { governments: [{ cityId: 'b',
    roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  return page.evaluate(({ renderer, source, carrier }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'field-water',
      truth: { potentialPermille: { freshWater: 1000 }, surfaceAccessibilityPermille: 1000 } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: { context,
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [] } })) return null;
    d.fieldStationAction('register');
    const s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    const w = e.wilderness, ext = window.HelixForeignWilderness.extensionPlan(w);
    // Explicit pre-existing reached patch and original registered refuge are
    // inputs. Source volume/quality and all water-chain outcomes use real code.
    ext.discovery = window.HelixWildernessDiscovery.create(ext.destination, 'adjoining');
    window.HelixWildernessDiscovery.materialize(ext.discovery, context.worldId, 'water', ext.destination, s.clock, null, ext);
    ext.materialized = true; w.extension = ext; w.patchGraph = window.HelixLocalPatchGraph.create(w);
    w.patchGraph = window.HelixLocalPatchGraph.recordStep(w.patchGraph, ext.seam, ext.entry, s.clock);
    s.labMap.rooms[w.roomId].cells.push(...ext.discovery.baseline.cells); s.labMap.rooms[w.roomId].width = w.bounds.width * 2;
    s.labMap.terrain.excavated.push(...ext.discovery.baseline.cells);
    for (const cell of s.labMap.rooms[w.roomId].cells) s.mapCellObservations[`${cell.x},${cell.y},${cell.z}`] = { cell, lastObservedAt: s.clock, source: 'Previously inspected local fixture', snapshot: {} };
    const l = window.HelixFieldStation.layout({ x: 39, y: 14, z: w.bounds.z }, 'refuge');
    const refuge = window.HelixFieldStation.create(); refuge.site = { id: 'water-refuge', siteId: ext.context.siteId, worldId: context.worldId,
      roomId: w.roomId, cityId: 'b', layout: l, registeredAt: s.clock, parts: {}, effort: {} }; s.fieldRefuge = refuge;
    s.fieldWater = window.HelixFieldWater.create();
    // Select a deterministic supported filterable geography seed, not a free
    // source/product fixture. Absence and unsupported quality have model tests.
    for (let i = 0; i < 100; i++) {
      ext.context.seed = `water-fixture-${i}`;
      const generated = window.HelixFieldWater.site(ext.context, ext.discovery.baseline, w.roomId, c => !l.ground.some(p => p.x === c.x && p.y === c.y));
      if (generated?.nodes[0]?.quality === 'filterable') break;
    }
    d.importSurveyExpeditionTestState(s); d.configureUnsupportedTest({ cell: { x: l.origin.x + 4, y: l.origin.y + 3, z: l.origin.z } });
    d.configureHiddenWorkshopTest({ cell: { x: l.origin.x + 4, y: l.origin.y + 3, z: l.origin.z }, supplies: { steelPanels: 2, metalParts: 2, cloth: 2, rubber: 1 }, carryTools: ['masonryHammer'] });
    const input = d.exportSurveyExpeditionTestState();
    const add = key => input.physicalItemStacks.push({ id: `water-test-${key}`, key, section: 'inventory', quantity: 1, knownQuantity: 1,
      carriedBy: 'scientist', roomId: w.roomId, cell: l.rest, sourceLabels: ['Explicit finite paid expedition gear fixture'] });
    add('fieldWaterCan'); add('fieldWaterFilter'); d.importSurveyExpeditionTestState(input);
    return { l, port: { x: l.origin.x + 4, y: l.origin.y + 3, z: l.origin.z } };
  }, { renderer, source, carrier });
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: original water collection, paid construction, interrupted treatment, tank consumption and physical reject`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await fixture(page, renderer); expect(f).toBeTruthy();
  console.info(`${renderer}: prepared original refuge, finite gear and generated source.`);
  let s = await snap(page); expect(s.saved.plant).toBeNull();
  const canId = 'water-test-fieldWaterCan';
  expect(await act(page, 'build'), JSON.stringify(s)).toBe(true); await tick(page, 180);
  s = await snap(page); expect(s.tasks[0].data.fieldWaterWork.progress).toBeGreaterThan(0);
  expect(s.saved.plant).toBeNull(); const partial = s.tasks[0].data.fieldWaterWork.progress;
  await reload(page, renderer); s = await snap(page); expect(s.tasks[0].data.fieldWaterWork.progress).toBe(partial);
  await finish(page); s = await snap(page); expect(s.saved.plant.cleanL).toBe(0); expect(s.saved.plant.filter).toBeNull();
  console.info(`${renderer}: constructed original empty plant across reload.`);
  expect(await act(page, 'build')).toBe(false); expect(await act(page, 'filter')).toBe(true); await finish(page);
  expect((await snap(page)).saved.plant.filter.stackId).toBe('water-test-fieldWaterFilter');
  const node = (await snap(page)).local.nodes[0]; expect(node).toBeTruthy();
  await walk(page, node.cell); expect(await act(page, 'collect', { nodeId: node.id })).toBe(false);
  expect(await act(page, 'inspect', { nodeId: node.id })).toBe(true); await finish(page);
  expect(await act(page, 'collect', { nodeId: node.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.local.nodes[0].litres).toBe(node.litres - 5);
  expect(s.saved.vessels[canId].litres).toBe(5); expect(s.stacks.find(i => i.id === canId).unitMassKg).toBe(6);
  console.info(`${renderer}: inspected and physically collected finite raw water.`);
  expect(await act(page, 'collect', { nodeId: node.id })).toBe(false);
  await walk(page, f.port); expect(await act(page, 'load')).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.plant.rawL).toBe(5); expect(s.stacks.find(i => i.id === canId).unitMassKg).toBe(1);
  expect(await act(page, 'treat')).toBe(true); await tick(page, 300); s = await snap(page);
  expect(s.saved.plant.cleanL).toBe(0); expect(s.saved.plant.batch.fraction).toBeGreaterThan(0);
  const fraction = s.saved.plant.batch.fraction, rating = s.saved.plant.filter.remaining;
  await reload(page, renderer); s = await snap(page); expect(s.saved.plant.batch.fraction).toBe(fraction); expect(s.saved.plant.filter.remaining).toBe(rating);
  await finish(page); s = await snap(page);
  expect([s.saved.plant.rawL, s.saved.plant.cleanL, s.saved.plant.rejectL, s.saved.plant.filter.remaining]).toEqual([0, 4, 1, 20]);
  expect(await act(page, 'drink')).toBe(true); await finish(page); expect((await snap(page)).saved.plant.cleanL).toBe(3);
  expect(await act(page, 'drain')).toBe(true); await finish(page); s = await snap(page);
  expect(s.saved.vessels[canId].kind).toBe('reject'); expect(s.saved.plant.rejectL).toBe(0); expect(await act(page, 'load')).toBe(false);
  expect(await act(page, 'dispose')).toBe(false); // Never dump at the drinking point.
  const disposal = await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), s = d.fieldWaterSnapshot();
    const w = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness;
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), same = window.HelixFieldWater.same;
    return w.extension.discovery.baseline.cells.filter(c => distance(c, s.saved.plant.cell) > 3 && distance(c, s.saved.plant.port) > 3
      && s.local.nodes.every(n => distance(c, n.cell) > 4)
      && ![state.fieldStation, state.fieldRefuge].some(t => t?.site?.layout.ground.some(p => same(p, c)))
      && !state.fixtures.some(f => same(f.origin, c))).sort((a, b) => distance(a, s.cell) - distance(b, s.cell))[0];
  });
  expect(disposal).toBeTruthy(); await walk(page, disposal);
  expect(await act(page, 'dispose'), JSON.stringify(await snap(page))).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.vessels[canId].litres).toBe(0);
  expect(s.stacks.find(i => i.key === 'fieldWaterReject').unitMassKg).toBe(1);
  expect(s.saved.history.filter(h => h.kind === 'treated')).toHaveLength(1);
  await reload(page, renderer); s = await snap(page); expect(s.local.nodes[0].litres).toBe(node.litres - 5); expect(s.saved.plant.cleanL).toBe(3);
  expect(errors).toEqual([]);
});
