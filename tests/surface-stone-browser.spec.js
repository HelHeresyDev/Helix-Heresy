const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { pathToFileURL } = require('url');
const path = require('path');
const { openForeignWorkspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(600000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot());
const field = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function reload(page) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await page.locator('[data-workspace-tab="visits"]').click();
}
test('canvas finite surface stone requires inspection, original tools and attended work; reload, cancellation, depletion and real cargo conserve matter', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'surface-stone', 'canvas', false, false, 0, 'stone', 'stone');
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const context = { worldId: s.resourceSurveys.context?.worldId || 'lifecycle-world', siteId: 'home', strategicCellId: 'planet-cell:00009', seed: 'stone',
      truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } };
    if (!d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })) return false;
    return d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Dry woodland' }], occupied: [], context });
  }, { source, carrier })).toBe(true);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await field(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  // Even a real paid municipal sampling permit cannot authorize cutting its reserve.
  expect((await snap(page)).site).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.startSurfaceStoneWork('recover', 'invented'))).toBe(false);
  expect(await act(page, 'enterWilderness')).toBe(true); await finish(page);
  let s = await snap(page); expect(s.site.nodes.length).toBeGreaterThan(0); expect(s.knowledge.observations).toEqual([]);
  expect(s.tools.filter(t => t.stack.carriedBy === 'scientist')).toHaveLength(2);
  const node = s.site.nodes.filter(n => n.remaining > 0).sort((a, b) => a.remaining - b.remaining)[0]; expect(node).toBeTruthy();
  // Walk to an actual adjacent floor tile, not onto the blocking stone itself.
  const target = await page.evaluate(node => {
    const d = window.helixHeresyDebug, w = d.foreignWildernessSnapshot(), cells = w.site.discovery.baseline.cells;
    const cell = cells.find(c => c.z === node.cell.z && Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) === 1);
    return d.startScientistMove(w.roomId, { toCell: cell }) ? cell : null;
  }, node);
  expect(target).toBeTruthy(); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), node.id)).toBe(false);
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.locator('[data-surface-stone] button').filter({ hasText: `Inspect stone face ${node.cell.x},${node.cell.y}` }).click();
  await finish(page); s = await snap(page);
  expect(s.knowledge.observations.find(n => n.id === node.id).inspected.workable).toBe(true);
  expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toEqual([]);
  const initial = s.site.nodes.find(n => n.id === node.id).remaining;
  expect(initial).toBe(1); // This seeded site contains a genuinely one-block face.
  const beforeTools = s.tools.filter(t => t.stack.carriedBy === 'scientist').map(t => ({ id: t.tool.id, current: t.tool.current }));
  const beforeStamina = s.stamina;
  await page.locator('[data-surface-stone] button').filter({ hasText: `Recover one stone block ${node.cell.x},${node.cell.y}` }).click();
  await advance(page, 300); s = await snap(page);
  let task = s.tasks.find(t => t.data?.stoneWork); expect(task.reason).toBe(''); expect(task.data.stoneWork.progress).toBeGreaterThan(0);
  expect(s.stamina).toBeLessThan(beforeStamina); expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(initial);
  expect(s.tools.some(t => t.tool.current < beforeTools.find(b => b.id === t.tool.id)?.current)).toBe(true);
  const progress = task.data.stoneWork.progress, toolIds = task.data.stoneWork.tools.map(c => c.toolId);
  await reload(page); s = await snap(page); task = s.tasks.find(t => t.data?.stoneWork);
  expect(task.data.stoneWork.progress).toBe(progress); expect(task.reason).toBe('');
  expect(s.tools.filter(t => toolIds.includes(t.tool.id)).every(t => t.tool.reservedTaskId === task.id && t.stack.reservedTaskId === task.id)).toBe(true);
  await finish(page); s = await snap(page);
  expect(s.tasks.filter(t => t.data?.stoneWork)).toEqual([]);
  let outputs = s.stacks.filter(i => i.tags?.includes('surface-stone'));
  expect(outputs).toHaveLength(1); const block = outputs[0]; expect(block).toMatchObject({ key: 'stoneBlocks', section: 'resources', quantity: 1, unitMassKg: 8, carriedBy: '', cell: target });
  expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(initial - 1);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), node.id)).toBe(false);
  expect(s.tools.filter(t => toolIds.includes(t.tool.id)).every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
  expect(s.knowledge.observations.find(n => n.id === node.id).receipts.at(-1).outputId).toBe(block.id);
  await reload(page); s = await snap(page); expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toHaveLength(1);
  // Use another finite face to test partial cancellation without manufacturing stock.
  const other = s.site.nodes.find(n => n.id !== node.id && n.remaining > 0);
  expect(await page.evaluate(n => {
    const d = window.helixHeresyDebug, w = d.foreignWildernessSnapshot();
    const cell = w.site.discovery.baseline.cells.find(c => Math.abs(c.x - n.cell.x) + Math.abs(c.y - n.cell.y) === 1);
    return Boolean(d.startScientistMove(w.roomId, { toCell: cell }));
  }, other)).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('inspect', id), other.id)).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), other.id)).toBe(true); await advance(page, 300);
  s = await snap(page); task = s.tasks.find(t => t.data?.stoneWork); const worn = s.tools.map(t => t.tool.current);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
  s = await snap(page); expect(s.site.nodes.find(n => n.id === other.id).remaining).toBe(other.remaining);
  expect(s.tools.map(t => t.tool.current)).toEqual(worn); expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toHaveLength(1);
  expect(s.tools.every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
  // Walk back to the original output and physically pick it up through the ordinary queue.
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: block.roomId, cell: block.cell })).toBe(true); await finish(page);
  await page.locator('[data-surface-stone] button').filter({ hasText: `Walk to and carry stone block ${block.id}` }).click(); await finish(page);
  expect((await snap(page)).stacks.find(i => i.id === block.id).carriedBy).toBe('scientist');
  const parkedFuel = (await field(page)).excursion.carrier.vehicle.fuelKm;
  expect(await act(page, 'withdraw')).toBe(true); await finish(page);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  s = await snap(page); expect(s.site).toBeNull(); expect(s.stacks.find(i => i.id === block.id)).toMatchObject({ carriedBy: 'scientist', quantity: 1 });
  expect((await field(page)).excursion.carrier.vehicle.fuelKm).toBeLessThan(parkedFuel);
  // Existing intercity return actually carries the same block back to the home loading bay.
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.dropActorStack('scientist', id), block.id)).toBe(true);
  s = await snap(page); const delivered = s.stacks.find(i => i.id === block.id);
  expect(delivered).toMatchObject({ carriedBy: '', key: 'stoneBlocks', quantity: 1 });
  expect(delivered.roomId).not.toBe(block.roomId); expect(delivered.sourceLabels.join(' ')).toContain(node.cell.x + ',' + node.cell.y);
  expect(errors).toEqual([]);
});

test('DOM home-boundary stone work pauses across actual displacement and preserves the same finite face', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, cellId: 'planet-cell:00009', supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', known: true, cellId: 'planet-cell:00001', supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'home-stone-world', siteId: 'parcel', strategicCellId: 'planet-cell:00009', seed: 'home-stone', truth: {
      potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001',
      label: 'Home Boundary', temperatureC: 18, precipitationMm: 100, slopePercent: 20, jurisdiction: 'No ordinary city jurisdiction', description: 'Local surface ground.' }, mode: 'wilderness', autoCare: false });
  });
  for (const key of ['masonryHammer', 'stoneChisel']) {
    expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), key)).toBe(true);
    let packing = await snap(page); const task = packing.tasks.find(t => t.data?.itemKey === key);
    expect(task).toBeTruthy(); expect(task.reason).toBe('');
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    packing = await snap(page); expect(packing.tasks.find(t => t.id === task.id).reason).toBe('');
    expect(await page.evaluate(id => Object.values(window.helixHeresyDebug.exportSurveyExpeditionTestState().toolDurability)
      .flat().find(t => t.id === id).reservedTaskId, task.data.toolInstanceId)).toBe(task.id);
    await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(300));
    packing = await snap(page);
    expect(packing.tools.find(t => t.tool?.id === task.data.toolInstanceId).stack.carriedBy).toBe('scientist');
    expect(packing.tools.find(t => t.tool?.id === task.data.toolInstanceId).tool.reservedTaskId).toBe('');
  }
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  expect(await page.evaluate(() => window.helixHeresyDebug.enterWilderness())).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(90));
  let s = await snap(page); expect(s.site).toBeTruthy();
  const node = s.site.nodes[0];
  const workCell = await page.evaluate(node => {
    const d = window.helixHeresyDebug, w = d.boundaryDiscoverySnapshot();
    const cell = w.discovery.baseline.cells.find(c => Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) === 1);
    d.startScientistMove('wildernessSurveySector', { toCell: cell }); d.advanceBoundaryTravelForTest(90); return cell;
  }, node);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('inspect', id), node.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(180));
  expect((await snap(page)).knowledge.observations[0].inspected.workable).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), node.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(300));
  s = await snap(page); const task = s.tasks.find(t => t.data?.stoneWork), before = task.data.stoneWork.progress;
  expect(before).toBeGreaterThan(0);
  // Displace the actual body using the existing explicit test placement fixture,
  // then advance real movement/work updates while it is absent.
  await page.evaluate(() => { const d = window.helixHeresyDebug;
    d.configureUnsupportedTest({ cell: { x: 22, y: 12, z: 6 } }); d.advanceBoundaryTravelForTest(600); });
  s = await snap(page); expect(s.tasks.find(t => t.id === task.id).data.stoneWork.progress).toBe(before);
  expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toEqual([]);
  await page.evaluate(cell => { const d = window.helixHeresyDebug; d.configureUnsupportedTest({ cell }); d.advanceBoundaryTravelForTest(1500); }, workCell);
  s = await snap(page); expect(s.tasks.find(t => t.id === task.id)).toBeUndefined();
  expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toHaveLength(1);
  expect(s.site.nodes[0].remaining).toBe(node.remaining - 1);
  expect(s.tools.every(t => !t.tool?.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
  expect(errors).toEqual([]);
});
