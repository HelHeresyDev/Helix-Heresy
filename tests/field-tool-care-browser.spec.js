const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldToolCareSnapshot());
const act = (page, id, action) => page.evaluate(({ id, action }) => window.helixHeresyDebug.startFieldToolCare(id, action), { id, action });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceFieldToolCareForTest(n), seconds);
const cancel = (page, id) => page.evaluate(id => window.helixHeresyDebug.cancelTask(id), id);
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(r => window.helixHeresyDebug.setMapRenderer(r), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function edit(page, changes) {
  await page.evaluate(changes => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    if (changes.tool) Object.assign(Object.values(s.toolDurability).flat().find(t => t.id === changes.tool.id), changes.tool.values);
    if (changes.blocked !== undefined) {
      const cell = d.fieldToolCareSnapshot().cell, same = a => ['x', 'y', 'z'].every(k => a[k] === cell[k]);
      s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !same(w.cell));
      if (changes.blocked) s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    }
    if (changes.remove) s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== changes.remove);
    d.importSurveyExpeditionTestState(s);
  }, changes);
}
async function setup(page, renderer, foreign = false) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-tool-care-${renderer}`);
  if (foreign) {
    const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
    const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: city.assetId,
      cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
    const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
      governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
    expect(await page.evaluate(({ source, carrier }) => {
      const d = window.helixHeresyDebug, context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'care', truth: { potentialPermille: {} } };
      return d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
        origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
          slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } });
    }, { source, carrier })).toBe(true);
  }
  const f = await page.evaluate(({ renderer, foreign }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    // Explicit finite initial carried tools and parts, not a packing/travel receipt.
    const partIds = d.configureHiddenWorkshopTest({ carryTools: foreign ? ['handSaw'] : ['masonryHammer', 'stoneChisel'], supplies: { metalParts: 2 } });
    const s = d.exportSurveyExpeditionTestState(), parts = s.physicalItemStacks.find(i => i.id === partIds[0]); parts.carriedBy = 'scientist'; parts.fixtureId = ''; parts.containerId = '';
    const carried = d.fieldToolCareSnapshot().tools.filter(t => t.stack?.carriedBy === 'scientist');
    for (const { tool, key } of carried) s.toolDurability[key].find(t => t.id === tool.id).current = key === 'handSaw' ? 0 : 100;
    s.toolDurability.handSaw[0].current = 0;
    s.toolDurability.miningPick[0].current = 100;
    d.importSurveyExpeditionTestState(s);
    return { ids: Object.fromEntries(carried.map(t => [t.key, t.tool.id])), parts: parts.id, remoteSaw: s.toolDurability.handSaw[0].id };
  }, { renderer, foreign });
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return { ...f, errors };
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('field-tool-care', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas carried-tool upkeep saves exact claims, pauses without backfill and keeps partial repair costs on cancellation', async ({ page }) => {
  const f = await setup(page, 'canvas'), hammer = f.ids.masonryHammer, chisel = f.ids.stoneChisel;
  expect(hammer).toBeTruthy(); expect(chisel).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.queueToolMaintenance('handSaw', 'repair'))).toBe(false);
  const panel = page.locator('[data-field-tool-care]');
  await panel.getByRole('button', { name: `Maintain exact carried tool (${hammer})`, exact: true }).click();
  await advance(page, 6); let s = await snap(page); const j = s.tasks[0].data.fieldToolCare;
  expect(j.progress).toBeGreaterThan(0); const value = s.tools.find(t => t.tool.id === hammer).tool.current;
  expect(s.stacks.find(i => i.id === f.parts).quantity).toBe(2); await reload(page, 'canvas'); s = await snap(page);
  expect(s.tools.find(t => t.tool.id === hammer).tool).toMatchObject({ current: value, reservedTaskId: j.id });
  expect(s.tools.find(t => t.tool.id === hammer).stack.reservedTaskId).toBe(j.id);
  await edit(page, { blocked: true }); await advance(page, 30); s = await snap(page);
  expect(s.tasks[0].data.fieldToolCare.progress).toBe(j.progress); expect(s.tools.find(t => t.tool.id === hammer).tool.current).toBe(value);
  await edit(page, { blocked: false }); await advance(page, 1); expect((await snap(page)).tasks[0].data.fieldToolCare.progress).toBe(j.progress);
  await advance(page, 30); s = await snap(page); expect(s.tasks).toHaveLength(0);
  expect(s.tools.find(t => t.tool.id === hammer).tool.current).toBe(450); expect(s.receipts).toHaveLength(1);
  expect(await act(page, hammer, 'maintain')).toBe(false);
  // Same generic action used by Inventory routes to the exact physical workflow.
  expect(await page.evaluate(() => window.helixHeresyDebug.queueToolMaintenance('stoneChisel', 'repair'))).toBe(true);
  await advance(page, 6); s = await snap(page); const repair = s.tasks[0].data.fieldToolCare;
  expect(repair.part.consumed).toBe(true); const partial = s.tools.find(t => t.tool.id === chisel).tool.current;
  expect(partial).toBeGreaterThan(100); expect(s.stacks.filter(i => i.key === 'metalParts' && i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(1);
  expect(await cancel(page, repair.id)).toBe(true); await reload(page, 'canvas'); s = await snap(page);
  expect(s.tools.find(t => t.tool.id === chisel).tool).toMatchObject({ current: partial, reservedTaskId: '' });
  expect(s.tools.find(t => t.tool.id === chisel).stack.reservedTaskId).toBe('');
  expect(await act(page, chisel, 'repair')).toBe(true); const fresh = (await snap(page)).tasks[0].data.fieldToolCare;
  expect(fresh.before).toBe(partial); await advance(page, fresh.required + 1); s = await snap(page);
  expect(s.tools.find(t => t.tool.id === chisel).tool.current).toBe(Math.min(400, partial + 180)); expect(s.receipts).toHaveLength(2);
  expect(s.stacks.filter(i => i.key === 'metalParts' && i.carriedBy === 'scientist')).toHaveLength(0);
  expect(s.tools.find(t => t.tool.id === f.remoteSaw).tool.current).toBe(0);
  // Unscoped legacy equipment keeps its existing maintenance behavior.
  expect(await page.evaluate(() => window.helixHeresyDebug.queueToolMaintenance('miningPick', 'maintain'))).toBe(true); await advance(page, 25);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().toolDurability.miningPick[0].current)).toBe(450);
  await reload(page, 'canvas'); expect((await snap(page)).receipts).toHaveLength(2); expect(f.errors).toEqual([]);
});
test('DOM foreign-field repair needs its exact carried input and original tool, restores surviving zero condition and cannot resurrect a missing item', async ({ page }) => {
  const f = await setup(page, 'dom', true), id = f.ids.handSaw; expect(id).toBeTruthy();
  expect(await act(page, id, 'maintain')).toBe(false);
  await page.locator('[data-field-tool-care]').getByRole('button', { name: `Repair exact carried tool (${id})`, exact: true }).click();
  let s = await snap(page); const first = s.tasks[0].data.fieldToolCare;
  expect(first.before).toBe(0); expect(first.part.consumed).toBe(false);
  expect(await cancel(page, first.id)).toBe(true);
  expect((await snap(page)).stacks.filter(i => i.key === 'metalParts' && i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(2);
  expect(await act(page, id, 'repair')).toBe(true); await advance(page, 6); s = await snap(page);
  const j = s.tasks[0].data.fieldToolCare, progress = j.progress, current = s.tools.find(t => t.tool.id === id).tool.current;
  expect(j.part.consumed).toBe(true); await reload(page, 'dom'); s = await snap(page);
  expect(s.tasks[0].reason).toBe(''); expect(s.tools.find(t => t.tool.id === id).tool.current).toBe(current);
  await advance(page, j.required - progress); s = await snap(page);
  expect(s.tasks).toHaveLength(0); expect(s.tools.find(t => t.tool.id === id).tool.current).toBe(158); expect(s.receipts).toHaveLength(1);
  expect(await act(page, id, 'repair')).toBe(true); await advance(page, 4); s = await snap(page); const interrupted = s.tasks[0].data.fieldToolCare;
  await edit(page, { remove: interrupted.stackId }); await advance(page, 50); s = await snap(page);
  expect(s.receipts).toHaveLength(1); expect(s.tasks[0].reason).toContain('exact owned carried tool');
  expect(await cancel(page, interrupted.id)).toBe(true); expect(await act(page, id, 'repair')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueToolMaintenance('handSaw', 'repair'))).toBe(false);
  await reload(page, 'dom'); expect((await snap(page)).receipts).toHaveLength(1); expect(f.errors).toEqual([]);
});
