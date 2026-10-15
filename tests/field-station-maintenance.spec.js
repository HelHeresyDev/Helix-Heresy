const { test, expect } = require('@playwright/test');
const { snap, act, advance, finish, move, reload } = require('./helpers/field-station');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const plan = (page, id, operation) => page.evaluate(({ id, operation }) => window.helixHeresyDebug.fieldStationBuildPlan(id, operation), { id, operation });
async function edit(page, change) {
  await page.evaluate(change => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), l = s.fieldStation.site.layout;
    const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
    if (change.roof !== undefined) s.labMap.terrain.constructedFloors.find(p => same(p.cell, l.roofs.find(c => c.x === l.rest.x && c.y === l.rest.y))).condition = change.roof;
    if (change.missingRoof) s.labMap.terrain.constructedFloors = s.labMap.terrain.constructedFloors.filter(p => !same(p.cell, l.roofs[0]));
    if (change.floor !== undefined) s.labMap.terrain.constructedFloors.find(p => same(p.cell, l.rest)).condition = change.floor;
    if (change.wall !== undefined) s.labMap.terrain.constructedWalls.find(p => same(p.cell, l.walls.find(c => c.x === l.origin.x + 2 && c.y === l.rest.y))).condition = change.wall;
    if (change.door !== undefined) s.doors[s.fieldStation.site.doorId].condition = change.door;
    if (change.crate !== undefined) {
      const f = s.fixtures.find(f => f.id === s.fieldStation.site.cacheId);
      f.condition = change.crate; f.operationalState = change.crate > 0 ? 'operational' : 'broken';
    }
    if (change.removeCrate) s.fixtures = s.fixtures.filter(f => f.id !== s.fieldStation.site.cacheId);
    d.importSurveyExpeditionTestState(s);
  }, change);
}
async function scaffold(page) {
  // Explicit pre-existing hut fixture: this test covers maintenance, not its
  // already separately tested 26-piece construction or importing building stock.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site, l = site.layout;
    const at = s.clock, key = c => `${c.x},${c.y},${c.z}`;
    for (const p of l.parts) {
      if (site.parts[p.id]) continue;
      let id = key(p.cell);
      if (p.kind === 'wall') s.labMap.terrain.constructedWalls.push({ cell: p.cell, materialId: 'stoneBlocks', condition: 100, builtAt: at });
      if (['floor', 'roof'].includes(p.kind)) s.labMap.terrain.constructedFloors.push({ cell: p.cell, materialId: p.kind === 'floor' ? 'stoneBlocks' : 'lumber', purpose: p.kind, condition: 100, builtAt: at });
      if (p.kind === 'door') {
        site.doorId = id = `door-${p.cell.x}-${p.cell.y}-${p.cell.z}`;
        s.labMap.doors[id] = { id, cell: p.cell, roomIds: [site.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
        s.doors[id] = { id, typeId: 'roughWoodDoor', state: 'open', condition: 100, materialId: 'lumber', materialComposition: { primary: 'wood' } };
      }
      if (p.kind === 'cache') {
        site.cacheId = id = 'maintenance-original-cache';
        s.fixtures.push({ id, typeId: 'storageCrate', name: 'Field Station Supply Crate', origin: p.cell, rotation: 0, condition: 100,
          accessState: 'open', materialPolicy: 'wood', installedAt: at });
      }
      site.parts[p.id] = { at, partId: p.id, physicalId: id, taskId: `fixture-${p.id}` }; site.effort[p.id] = 1;
    }
    d.importSurveyExpeditionTestState(s);
  });
}
async function supply(page, partId, operation, stock) {
  let p = await plan(page, partId, operation); expect(p.context.workCell, JSON.stringify(p)).toBeTruthy();
  const work = p.context.workCell, s = await snap(page), apron = s.saved.site.layout.apron;
  // Keep a whole carried toolset out of the backpack; roofing's three tools
  // fit real capacity, whereas every tool plus the environmental kit does not.
  await move(page, apron);
  while ((await snap(page)).stamina < 65) {
    await page.getByRole('button', { name: 'Rest Here (15 minutes)', exact: true }).click(); await finish(page);
  }
  for (const item of (await snap(page)).stacks.filter(i => i.carriedBy === 'scientist' && !Object.keys(p.part.tools).includes(i.key)))
    expect(await act(page, 'stage', { stackId: item.id })).toBe(true);
  for (const key of Object.keys(p.part.tools)) {
    let s = await snap(page); if (s.stacks.some(i => i.key === key && i.carriedBy === 'scientist')) continue;
    const i = s.stacks.find(i => i.key === key && !i.carriedBy && i.roomId === s.saved.site.roomId);
    expect(i, key).toBeTruthy(); await move(page, i.cell);
    expect(await act(page, 'collect', { stackId: i.id })).toBe(true); await finish(page);
  }
  // Every unit is physically collected, routed and staged; no remote debit.
  for (const [key, amount] of Object.entries(p.part.costs)) for (let n = 0; n < amount; n++) {
    // Inspect inputs at the chosen position, not at a newly selected position
    // nearer a pile while fetching tools at the apron.
    await move(page, work);
    if ((await plan(page, partId, operation)).inputs) break;
    const i = (await snap(page)).stacks.find(i => i.id === stock[key] && i.quantity > 0);
    expect(i, key).toBeTruthy(); await move(page, i.cell);
    expect(await act(page, 'collect', { stackId: i.id })).toBe(true); await finish(page);
    const carried = (await snap(page)).stacks.find(i => i.key === key && i.carriedBy === 'scientist');
    await move(page, work); expect(await act(page, 'stage', { stackId: carried.id })).toBe(true);
  }
  await move(page, work); p = await plan(page, partId, operation);
  expect(p.plan, JSON.stringify(p)).toBeTruthy(); return p;
}

async function setup(page, initialFloor = false) {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'field-station-maintenance');
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug;
    d.setMapRenderer('canvas');
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'station',
      truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Dry woodland' }], occupied: [], context } })) return false;
    d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'stoneChisel', 'handSaw', 'foldingLadder'] });
    return d.fieldStationSnapshot().local;
  }, { source, carrier })).toBe(true);
  // Explicit original local presence and finite tool fixture, not a paid trip.
  // The separate construction lifecycle retains real passenger/municipal travel.
  expect(await act(page, 'register')).toBe(true);
  const site = (await snap(page)).saved.site, l = site.layout;
  await move(page, l.apron);
  const ids = await page.evaluate(cell => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell,
    supplies: { lumber: 9, metalParts: 1, stoneBlocks: 4, drinkingWater: 1 } }), l.apron);
  const stock = Object.fromEntries(['lumber', 'metalParts', 'stoneBlocks', 'drinkingWater'].map((key, i) => [key, ids[i]]));
  if (initialFloor) {
    await supply(page, l.parts[0].id, 'build', stock);
    expect(await act(page, 'build', { partId: l.parts[0].id })).toBe(true); await finish(page);
    expect(await act(page, 'build', { partId: l.parts[0].id })).toBe(false);
  }
  await move(page, l.apron); await scaffold(page); await move(page, l.rest);
  expect((await snap(page)).sheltered).toBe(true);
  const cacheId = (await snap(page)).saved.site.cacheId;
  await move(page, l.apron);
  for (const i of (await snap(page)).stacks.filter(i => i.carriedBy === 'scientist')) expect(await act(page, 'stage', { stackId: i.id })).toBe(true);
  expect(await act(page, 'collect', { stackId: stock.drinkingWater })).toBe(true); await finish(page);
  const water = (await snap(page)).stacks.find(i => i.key === 'drinkingWater' && i.carriedBy === 'scientist');
  expect(await act(page, 'put', { stackId: water.id })).toBe(true); await finish(page);
  return { errors, site, l, stock, water, cacheId };
}
test('roof repair preserves partial work, original claims and stock across reload and caps further repairs', async ({ page }) => {
  const { errors, l, stock, water, cacheId } = await setup(page, true);
  const roof = l.parts.find(p => p.kind === 'roof' && p.cell.x === l.rest.x && p.cell.y === l.rest.y);
  const roofReceipt = (await snap(page)).saved.site.parts[roof.id];
  await edit(page, { roof: 20 }); expect((await snap(page)).sheltered).toBe(false);
  expect(await act(page, 'build', { partId: roof.id })).toBe(false);
  await supply(page, roof.id, 'repair', stock);
  const visits = page.locator('[data-workspace-tab="visits"]');
  if (await visits.getAttribute('aria-current') !== 'page') await visits.click();
  await page.locator('[aria-label="Station construction component"]').selectOption(roof.id);
  await page.getByRole('button', { name: `Repair station ${roof.id}`, exact: true }).click();
  await advance(page, 90);
  let s = await snap(page), task = s.tasks.find(t => t.data?.fieldStationWork);
  expect(task?.data.fieldStationWork.progress).toBeGreaterThan(0);
  const progress = task.data.fieldStationWork.progress, claims = task.data.fieldStationWork.tools.map(t => t.toolId);
  await reload(page); s = await snap(page); task = s.tasks.find(t => t.data?.fieldStationWork);
  expect(task.reason).toBe(''); expect(task.data.fieldStationWork.progress).toBe(progress);
  expect(s.tools.filter(t => claims.includes(t.tool.id)).every(t => t.tool.reservedTaskId === task.id && t.stack.reservedTaskId === task.id)).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
  expect((await plan(page, roof.id, 'repair')).plan.from).toBeGreaterThan(0);
  expect(await act(page, 'repair', { partId: roof.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.sheltered).toBe(true); expect(s.saved.site.parts[roof.id]).toEqual(roofReceipt);
  expect(s.knowledge.observations.parts[roof.id].condition).toBe(65);
  expect(s.saved.history.filter(r => r.operation === 'repair' && r.physicalId)).toHaveLength(1);
  expect(s.stacks.find(i => i.id === water.id).fixtureId).toBe(cacheId);
  await supply(page, roof.id, 'repair', stock); expect(await act(page, 'repair', { partId: roof.id })).toBe(true); await finish(page);
  expect((await snap(page)).knowledge.observations.parts[roof.id].condition).toBe(100);
  expect(await act(page, 'repair', { partId: roof.id })).toBe(false); expect(errors).toEqual([]);
});
test('floor, wall and door repairs restore their original physical components and barrier', async ({ page }) => {
  const { errors, l, stock, site } = await setup(page);
  for (const kind of ['floor', 'wall', 'door']) {
    const p = l.parts.find(p => p.kind === kind && (kind === 'floor' ? p.cell.x === l.rest.x && p.cell.y === l.rest.y
      : kind === 'wall' ? p.cell.x === l.origin.x + 2 && p.cell.y === l.rest.y : true));
    await edit(page, { [kind]: 20 }); await supply(page, p.id, 'repair', stock);
    expect(await act(page, 'repair', { partId: p.id })).toBe(true); await finish(page);
    expect((await snap(page)).knowledge.observations.parts[p.id].condition).toBe(65);
  }
  const s = await snap(page);
  expect(s.doors[s.saved.site.doorId].state).toBe('closed'); expect(s.doorwayVisible).toBe(false);
  expect(s.stacks.filter(i => i.roomId === site.roomId && i.key === 'stoneBlocks').reduce((n, i) => n + i.quantity, 0)).toBe(2);
  expect(errors).toEqual([]);
});
test('missing roof and loaded crate require supplied reconstruction and physical recovery before replacement', async ({ page }) => {
  const { errors, l, stock, site, cacheId, water } = await setup(page);
  const missing = l.parts.find(p => p.kind === 'roof' && p.cell.x === l.roofs[0].x && p.cell.y === l.roofs[0].y);
  await edit(page, { missingRoof: true }); await supply(page, missing.id, 'reconstruct', stock);
  expect(await act(page, 'repair', { partId: missing.id })).toBe(false);
  expect(await act(page, 'reconstruct', { partId: missing.id })).toBe(true); await finish(page);
  let s = await snap(page); expect(s.saved.site.parts[missing.id].operation).toBe('reconstruct');
  expect(s.floors.filter(f => JSON.stringify(f.cell) === JSON.stringify(missing.cell))).toHaveLength(1);
  const crate = l.parts.find(p => p.kind === 'cache'); await edit(page, { crate: 0 });
  expect(await act(page, 'take', { stackId: water.id })).toBe(false);
  await supply(page, crate.id, 'repair', stock); expect(await act(page, 'repair', { partId: crate.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.site.cacheId).toBe(cacheId);
  expect(s.fixtures.find(f => f.id === cacheId).condition).toBe(45); expect(s.stacks.find(i => i.id === water.id).fixtureId).toBe(cacheId);
  expect(await act(page, 'take', { stackId: water.id })).toBe(true); await finish(page);
  expect(await act(page, 'put', { stackId: water.id })).toBe(true); await finish(page);
  await edit(page, { removeCrate: true }); await move(page, l.rest);
  expect((await plan(page, crate.id, 'reconstruct')).plan).toBeNull();
  expect(await act(page, 'recover', { stackId: water.id })).toBe(true); await advance(page, 1);
  await reload(page, 'dom'); await finish(page);
  s = await snap(page); expect(s.stacks.find(i => i.id === water.id).carriedBy).toBe('scientist');
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await supply(page, crate.id, 'reconstruct', stock);
  expect(await act(page, 'reconstruct', { partId: crate.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.site.cacheId).not.toBe(cacheId);
  expect(s.stacks.filter(i => i.fixtureId === s.saved.site.cacheId)).toEqual([]);
  expect(s.stacks.filter(i => i.fixtureId === cacheId)).toEqual([]);
  expect(s.stacks.filter(i => i.id === water.id)).toHaveLength(1);
  expect(s.stacks.filter(i => i.roomId === site.roomId && i.key === 'lumber').reduce((n, i) => n + i.quantity, 0)).toBe(4);
  expect(s.stacks.filter(i => i.roomId === site.roomId && i.key === 'metalParts')).toEqual([]);
  expect(await act(page, 'reconstruct', { partId: crate.id })).toBe(false);
  const newId = s.saved.site.cacheId; await reload(page);
  expect((await snap(page)).saved.site.cacheId).toBe(newId); expect(errors).toEqual([]);
});
