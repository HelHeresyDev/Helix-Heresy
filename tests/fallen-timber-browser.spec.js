const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(420000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fallenTimberSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFallenTimberForTest(n), n);
const work = (page, action, id) => page.evaluate(({ action, id }) => window.helixHeresyDebug.startFallenTimberWork(action, id), { action, id });
const act = (page, action, id) => page.evaluate(({ action, id }) => window.helixHeresyDebug.fallenTimberAction(action, id), { action, id });
async function finish(page) {
  for (let n = 0; n < 20; n++) {
    const s = await snap(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks)).toBe('');
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error(`Timber task did not finish: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function move(page, cell) {
  const s = await snap(page); if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: s.roomId, cell })).toBe(true);
  await finish(page);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `fallen-timber-${renderer}`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'fallen-timber', truth: {
      potentialPermille: { timberFiber: 1000, constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 20, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Dry woodland' }], occupied: [], context } })) return false;
    d.configureHiddenWorkshopTest({ carryTools: ['handSaw'] });
    return d.fallenTimberSnapshot().site?.nodes.length > 0;
  }, { source, carrier, renderer })).toBe(true);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return errors;
}

test('home saw preparation routes the original tool and retains its packing claim through real reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'fallen-timber-home-packing');
  expect(await page.evaluate(() => window.helixHeresyDebug.packSurveyItem('handSaw'))).toBe(true);
  let s = await snap(page), task = s.tasks.find(t => t.data?.itemKey === 'handSaw'); expect(task).toBeTruthy();
  const originalId = task.data.toolInstanceId, originalStack = task.data.stackId;
  const reserved = () => page.evaluate(id => Object.values(window.helixHeresyDebug.exportSurveyExpeditionTestState().toolDurability)
    .flat().find(t => t.id === id).reservedTaskId, originalId);
  // Before pickup the tool is claimed by the packing task; the loose supply
  // stack receives its tool-instance link only on actual carrying completion.
  expect(await reserved()).toBe(task.id);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snap(page); task = s.tasks.find(t => t.data?.itemKey === 'handSaw'); expect(task.reason).toBe('');
  expect(await reserved()).toBe(task.id);
  await page.evaluate(() => window.helixHeresyDebug.advanceBoundaryTravelForTest(600));
  s = await snap(page); expect(s.tasks.find(t => t.id === task.id)).toBeUndefined();
  expect(s.tools.find(t => t.tool?.id === originalId)).toMatchObject({ tool: { carriedBy: 'scientist', reservedTaskId: '' },
    stack: { id: originalStack, carriedBy: 'scientist', toolInstanceId: originalId, quantity: 1, reservedTaskId: '' } });
  expect(s.site).toBeNull(); expect(errors).toEqual([]);
});

test('canvas fallen timber: original sources, routed logs, partial reload/cancellation, sawing and supplied station repair', async ({ page }) => {
  const errors = await setup(page, 'canvas');
  // Explicit local foreign presence/tool fixture; unchanged passenger transport
  // is covered separately. No logs, lumber or sources are injected by this test.
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldStationAction('register'))).toBe(true);
  let s = await snap(page); const node = s.site.nodes.find(n => n.remaining === 1) || s.site.nodes[0], initial = node.remaining;
  await move(page, node.cell);
  expect(await work(page, 'cut', node.id)).toBe(false);
  await page.locator('[data-fallen-timber] button').filter({ hasText: `Inspect fallen trunk ${node.cell.x},${node.cell.y}` }).click(); await finish(page);
  expect((await snap(page)).knowledge.observations.find(n => n.id === node.id)).toBeTruthy();
  const beforeSaw = (await snap(page)).tools.find(t => t.stack.carriedBy === 'scientist').tool.current;
  await page.locator('[data-fallen-timber] button').filter({ hasText: `Cut one field log ${node.cell.x},${node.cell.y}` }).click();
  await advance(page, 240); s = await snap(page); let task = s.tasks.find(t => t.data?.timberWork);
  expect(task.data.timberWork.progress).toBeGreaterThan(0); const progress = task.data.timberWork.progress;
  await reload(page, 'canvas'); s = await snap(page); task = s.tasks.find(t => t.data?.timberWork);
  expect(task.data.timberWork.progress).toBe(progress); expect(task.reason).toBe('');
  expect(s.tools.find(t => t.tool?.id === task.data.timberWork.toolId).tool.reservedTaskId).toBe(task.id);
  await finish(page); s = await snap(page);
  expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(initial - 1);
  expect(s.tools.find(t => t.stack.carriedBy === 'scientist').tool.current).toBe(beforeSaw - 4);
  const log = s.stacks.find(i => i.key === 'fieldLog');
  expect(log).toMatchObject({ quantity: 1, unitMassKg: 11, unitVolumeL: 26, carriedBy: '', cell: node.cell });
  await page.locator('[data-fallen-timber] button').filter({ hasText: `Collect one Field Log (${log.id})` }).click(); await finish(page);
  expect((await snap(page)).stacks.find(i => i.id === log.id).carriedBy).toBe('scientist');
  expect(await work(page, 'saw', log.id)).toBe(false); // Carried is not staged.
  const station = await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot().saved.site);
  await move(page, station.layout.apron); expect(await act(page, 'stage', log.id)).toBe(true);
  await page.locator('[data-fallen-timber] button').filter({ hasText: `Hand-saw staged log (${log.id})` }).click();
  await advance(page, 360); s = await snap(page); task = s.tasks.find(t => t.data?.timberWork);
  expect(task.data.timberWork.progress).toBeGreaterThan(0);
  const originalRequired = task.data.timberWork.required, spentWear = s.tools.find(t => t.stack.carriedBy === 'scientist').tool.current;
  expect(s.stacks.find(i => i.id === log.id).reservedTaskId).toBe(task.id);
  await page.locator('[data-fallen-timber] button').filter({ hasText: 'Pause timber work and release claims' }).click();
  s = await snap(page); expect(s.stacks.find(i => i.id === log.id).reservedTaskId).toBe('');
  expect(s.tools.find(t => t.stack.carriedBy === 'scientist').tool.current).toBe(spentWear);
  expect(s.stacks.filter(i => i.tags.includes('fallen-timber') && i.key === 'lumber')).toEqual([]);
  expect(await work(page, 'saw', log.id)).toBe(true); s = await snap(page); task = s.tasks.find(t => t.data?.timberWork);
  expect(task.data.timberWork.required).toBeLessThan(originalRequired);
  await advance(page, 180); const partial = (await snap(page)).tasks.find(t => t.data?.timberWork).data.timberWork.progress;
  await reload(page, 'canvas'); s = await snap(page); task = s.tasks.find(t => t.data?.timberWork);
  expect(task.data.timberWork.progress).toBe(partial); expect(task.reason).toBe('');
  expect(s.stacks.find(i => i.id === log.id).reservedTaskId).toBe(task.id);
  expect(s.tools.find(t => t.tool?.id === task.data.timberWork.toolId).tool.reservedTaskId).toBe(task.id);
  await finish(page); s = await snap(page);
  expect(s.stacks.find(i => i.id === log.id)).toBeUndefined();
  const lumber = s.stacks.find(i => i.tags.includes('fallen-timber') && i.key === 'lumber');
  const offcuts = s.stacks.find(i => i.tags.includes('fallen-timber') && i.key === 'woodDebris');
  expect(lumber).toMatchObject({ quantity: 2, unitMassKg: 5, carriedBy: '', cell: station.layout.apron });
  expect(offcuts).toMatchObject({ quantity: 1, unitMassKg: 1, carriedBy: '', cell: station.layout.apron });
  expect(lumber.quantity * lumber.unitMassKg + offcuts.quantity * offcuts.unitMassKg).toBe(log.unitMassKg);
  expect(lumber.sourceLabels.join(' ')).toContain(node.id); expect(await work(page, 'saw', log.id)).toBe(false);
  // An explicitly pre-existing damaged roof supplies the consumer, not free
  // construction lumber. Its repair below must consume actual recovered wood.
  const partId = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site, l = site.layout;
    const p = l.parts.find(p => p.kind === 'roof' && p.cell.x === l.rest.x && p.cell.y === l.rest.y);
    for (const part of l.parts.filter(v => ['floor', 'wall'].includes(v.kind) || v.id === p.id)) {
      const id = `${part.cell.x},${part.cell.y},${part.cell.z}`;
      const target = part.kind === 'wall' ? s.labMap.terrain.constructedWalls : s.labMap.terrain.constructedFloors;
      target.push({ cell: part.cell, materialId: part.kind === 'roof' ? 'lumber' : 'stoneBlocks', purpose: part.kind,
        condition: part.id === p.id ? 20 : 100, builtAt: s.clock });
      site.parts[part.id] = { at: s.clock, partId: part.id, physicalId: id, taskId: `fixture-${part.id}` };
      site.effort[part.id] = 1;
    }
    d.importSurveyExpeditionTestState(s); d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'foldingLadder'] }); return p.id;
  });
  expect(await act(page, 'collect', lumber.id)).toBe(true); await finish(page);
  const carried = (await snap(page)).stacks.find(i => i.key === 'lumber' && i.carriedBy === 'scientist'); expect(carried.quantity).toBe(1);
  let p = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id, 'repair'), partId);
  await move(page, p.context.workCell); expect(await act(page, 'stage', carried.id)).toBe(true);
  p = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id, 'repair'), partId);
  expect(p.plan, JSON.stringify(p)).toBeTruthy(); expect(p.inputs[0].stackId).toBe(carried.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('repair', { partId: id }), partId)).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.filter(i => i.tags.includes('fallen-timber') && i.key === 'lumber').reduce((n, i) => n + i.quantity, 0)).toBe(1);
  await reload(page, 'canvas');
  const finalStation = await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot());
  const roof = station.layout.parts.find(p => p.id === partId);
  expect(finalStation.floors.find(f => f.cell.x === roof.cell.x && f.cell.y === roof.cell.y && f.cell.z === roof.cell.z).condition).toBe(65);
  expect((await snap(page)).site.nodes.find(n => n.id === node.id).remaining).toBe(initial - 1);
  expect(errors).toEqual([]);
});

test('DOM timber work pauses on physical displacement; exhausted or missing sources never respawn on reload', async ({ page }) => {
  const errors = await setup(page, 'dom');
  let s = await snap(page); const node = s.site.nodes.find(n => n.remaining === 1) || s.site.nodes[0];
  await move(page, node.cell); expect(await work(page, 'inspect', node.id)).toBe(true); await finish(page);
  expect(await work(page, 'cut', node.id)).toBe(true); await advance(page, 180);
  s = await snap(page); const task = s.tasks.find(t => t.data?.timberWork), progress = task.data.timberWork.progress;
  expect(progress).toBeGreaterThan(0);
  const away = { x: 22, y: 12, z: node.cell.z };
  await page.evaluate(cell => { const d = window.helixHeresyDebug; d.configureUnsupportedTest({ cell }); d.advanceFallenTimberForTest(1200); }, away);
  expect((await snap(page)).tasks.find(t => t.id === task.id).data.timberWork.progress).toBe(progress);
  await page.evaluate(cell => { const d = window.helixHeresyDebug; d.configureUnsupportedTest({ cell }); }, task.data.timberWork.workCell);
  await finish(page);
  s = await snap(page); expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(node.remaining - 1);
  // Exhaust the actual finite allocation through attended work, never by
  // injecting an extraction output or changing remaining stock.
  for (let n = 1; n < node.remaining; n++) { expect(await work(page, 'cut', node.id)).toBe(true); await finish(page); }
  s = await snap(page); expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(0);
  expect(s.stacks.find(i => i.id === node.stackId)).toBeUndefined(); expect(await work(page, 'cut', node.id)).toBe(false);
  const other = s.site.nodes.find(n => n.id !== node.id);
  await page.evaluate(id => window.helixHeresyDebug.configureHiddenWorkshopTest({ removeInputId: id }), other.stackId);
  const ids = s.site.nodes.map(n => n.stackId); await reload(page, 'dom');
  s = await snap(page); expect(s.site.nodes.map(n => n.stackId)).toEqual(ids);
  expect(s.stacks.find(i => i.id === other.stackId)).toBeUndefined(); expect(s.site.nodes.find(n => n.id === node.id).remaining).toBe(0);
  expect(s.stacks.filter(i => i.key === 'fieldLog').reduce((n, i) => n + i.quantity, 0)).toBe(node.remaining);
  expect(errors).toEqual([]);
});
