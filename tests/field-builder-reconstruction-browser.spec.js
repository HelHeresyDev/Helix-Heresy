const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const station = page => page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const personal = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldStationAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function finishWalking(page) {
  for (let n = 0; n < 20; n++) {
    const s = await snap(page); if (!s.tasks.length) return;
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Physical personal task did not finish.');
}
async function move(page, room, cell) {
  const s = await snap(page);
  if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  await finishWalking(page);
}
async function until(page, predicate) {
  for (let n = 0; n < 18; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 15); }
  throw new Error(`Reconstruction condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer, crate = false) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `builder-reconstruction-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer, crate }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'builder', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site, l = site.layout;
    const parts = crate ? l.parts.filter(p => p.kind === 'cache') : l.parts.filter(p => p.kind === 'wall'
      && p.cell.x === l.origin.x + 2 && [l.origin.y + 1, l.origin.y + 2].includes(p.cell.y));
    // Explicit pre-existing installation receipts and missing originals. This
    // fixture does not claim that construction or passenger travel was earned.
    for (const p of crate ? l.parts : [...l.parts.filter(p => p.kind === 'floor'), ...parts]) {
      let id = `${p.cell.x},${p.cell.y},${p.cell.z}`;
      if (p.kind === 'cache') site.cacheId = id = 'reconstruction-old-cache';
      if (p.kind === 'door') {
        site.doorId = id = `door-${p.cell.x}-${p.cell.y}-${p.cell.z}`;
        s.labMap.doors[id] = { id, cell: p.cell, roomIds: [site.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
        s.doors[id] = { id, typeId: 'roughWoodDoor', state: 'open', condition: 100, materialId: 'lumber', builtAt: s.clock };
      }
      site.parts[p.id] = { at: s.clock, partId: p.id, physicalId: id, taskId: `fixture-${p.id}` }; site.effort[p.id] = 1;
      if (parts.some(t => t.id === p.id)) continue;
      if (p.kind === 'wall') s.labMap.terrain.constructedWalls.push({ cell: p.cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
      if (['floor', 'roof'].includes(p.kind)) s.labMap.terrain.constructedFloors.push({ cell: p.cell, purpose: p.kind,
        materialId: p.kind === 'roof' ? 'lumber' : 'stoneBlocks', condition: 100, builtAt: s.clock });
    }
    s.economy.money = 1000; d.importSurveyExpeditionTestState(s);
    const work = crate ? [l.rest] : parts.map(p => ({ ...p.cell, x: p.cell.x + 1 }));
    d.configureUnsupportedTest({ cell: work[0] }); d.configureHiddenWorkshopTest({ carryTools: crate ? ['masonryHammer', 'handSaw'] : ['masonryHammer'] });
    for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist')) d.fieldStationAction('stage', { stackId: i.id });
    const stock = d.configureHiddenWorkshopTest({ cell: work[0], supplies: crate ? { lumber: 3, metalParts: 1 } : { stoneBlocks: 5 } });
    let water = '';
    if (crate) {
      [water] = d.configureHiddenWorkshopTest({ cell: l.cache, supplies: { drinkingWater: 1 } });
      const prepared = d.exportSurveyExpeditionTestState(); prepared.physicalItemStacks.find(i => i.id === water).fixtureId = site.cacheId;
      d.importSurveyExpeditionTestState(prepared);
    }
    return { site, parts, work, stock, water, room: d.foreignSurveySnapshot().excursion.roomId, meeting: { x: 15, y: 11, z: work[0].z },
      away: { x: 35, y: 12, z: work[0].z } };
  }, { source, carrier, city, institution, renderer, crate });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return { ...f, renderer, errors };
}
async function inspect(page, f) {
  for (const [n, p] of f.parts.entries()) {
    await move(page, f.site.roomId, f.work[n]);
    await page.getByRole('button', { name: `${n ? 'Append reconstruction component' : 'Inspect reconstruction commission'} ${p.id}`, exact: true }).click();
  }
  const proposal = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.builderProposal);
  expect(proposal.operation).toBe('reconstruct'); expect((proposal.components || [proposal]).map(p => p.from)).toEqual(f.parts.map(() => 0));
  expect(await act(page, 'appendRepair', { partId: f.parts[0].id })).toBe(false);
  await move(page, f.room, f.meeting); return proposal;
}
async function hire(page) {
  await page.getByRole('button', { name: 'Review exact reconstruction order terms', exact: true }).click();
  const s = await snap(page), q = s.known.quote; expect(q, JSON.stringify(s.context)).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original bounded reconstruction work order', exact: true }).click();
  expect((await snap(page)).money).toBe(s.money - 88); return q;
}
async function settle(page, f) {
  await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(false);
  for (const t of (await snap(page)).saved.contract.claims.tools) if (t.borrowedAt != null) expect(await act(page, 'tool', { stackId: t.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); const s = await snap(page); expect(Number.isInteger(s.money)).toBe(true);
  expect(await act(page, 'settle')).toBe(false); return s;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('reconstruction-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas reconstruction uses full recipes and saved physical work, pauses for loose obstructions and preserves installation history', async ({ page }) => {
  const f = await setup(page, 'canvas'), proposal = await inspect(page, f);
  expect(proposal.components.map(p => p.part.costs)).toEqual([{ stoneBlocks: 2 }, { stoneBlocks: 2 }]);
  expect(proposal.components.map(p => p.part.seconds)).toEqual([720, 720]); expect(proposal.tools).toHaveLength(1);
  await hire(page); let s = await until(page, s => s.saved.job?.progress > 10);
  const id = s.actor.id, loan = s.saved.contract.claims.tools[0], progress = s.saved.job.progress, started = s.saved.contract.startedAt;
  expect(s.saved.job.operation).toBe('reconstruct'); expect(s.saved.job.from).toBe(0);
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(progress);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.reservedTaskId).toBe(s.saved.job.taskId);
  const obstruction = await page.evaluate(cell => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell, supplies: { lumber: 1 } })[0], f.parts[0].cell);
  await advance(page, 20); s = await snap(page); expect(s.saved.phase).toBe('onSite'); expect(s.saved.job.progress).toBe(progress);
  // A simulated external clearing moves this explicit obstacle fixture; it is
  // neither construction material nor a deleted/consumed customer supply.
  await page.evaluate(({ obstruction, cell }) => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === obstruction).cell = cell; d.importSurveyExpeditionTestState(s);
  }, { obstruction, cell: f.away });
  await move(page, f.site.roomId, f.away); const known = (await snap(page)).known;
  const xp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0);
  await advance(page, 1500); s = await snap(page);
  expect(s.saved.contract.completed.map(p => p.restoredCondition), s.saved.contract.reason).toEqual([100, 100]);
  expect(s.saved.contract.startedAt).toBe(started); expect(s.actor.id).toBe(id); expect(s.known).toEqual(known);
  expect(await act(page, 'report')).toBe(false);
  const physical = await station(page);
  for (const p of f.parts) {
    expect(s.station.site.parts[p.id]).toMatchObject({ operation: 'reconstruct', actorId: id, previousInstallation: { taskId: `fixture-${p.id}` } });
    expect(physical.walls.find(w => JSON.stringify(w.cell) === JSON.stringify(p.cell)).condition).toBe(100);
  }
  expect(s.stacks.find(i => i.id === f.stock[0]).quantity).toBe(1);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - 4);
  expect(physical.knowledge.history.some(r => r.operation === 'reconstruct')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0)).toBe(xp);
  await move(page, f.site.roomId, { ...f.work[1], x: f.work[1].x + 1 }); expect(await act(page, 'report')).toBe(true);
  expect((await snap(page)).known.received.completed).toHaveLength(2); expect(await act(page, 'withdraw')).toBe(true);
  const paid = await settle(page, f); await reload(page, 'canvas'); expect((await snap(page)).money).toBe(paid.money); expect(f.errors).toEqual([]);
});
test('DOM missing-crate reconstruction requires personal recovery and fresh consent after an unrelated installation changes its footprint', async ({ page }) => {
  const f = await setup(page, 'dom', true), part = f.parts[0];
  await expect(page.getByRole('button', { name: new RegExp(`^Inspect reconstruction commission ${part.id}`) })).toBeDisabled();
  expect(await act(page, 'inspectReconstruction', { partId: part.id })).toBe(false);
  expect(await personal(page, 'recover', { stackId: f.water })).toBe(true); await finishWalking(page);
  expect((await snap(page)).stacks.find(i => i.id === f.water).carriedBy).toBe('scientist');
  const proposal = await inspect(page, f); expect(proposal.part.costs).toEqual({ lumber: 3, metalParts: 1 }); await hire(page);
  let s = await until(page, s => s.saved.job?.progress > 10); const id = s.actor.id, duty = s.saved.dutySeconds;
  expect(s.station.site.maintenanceEffort[`reconstruct:${part.id}`].fraction).toBeGreaterThan(0); await reload(page, 'dom');
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.fixtures.push({ id: 'explicit-unrelated-property', typeId: 'storageCrate', name: 'Unrelated property', origin: cell,
      rotation: 0, condition: 100, accessState: 'open', materialPolicy: 'wood', installedAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, part.cell);
  await advance(page, 1); s = await snap(page); expect(['returning', 'awaitingSettlement']).toContain(s.saved.phase);
  expect(s.saved.contract.reason).toContain('fresh consent'); expect(s.saved.job.invalidated).toBe(true);
  expect(s.station.site.maintenanceEffort[`reconstruct:${part.id}`]).toBeUndefined(); expect(s.saved.contract.completed).toEqual([]);
  expect(s.station.site.cacheId).toBe(f.site.cacheId); const paid = await settle(page, f);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.fixtures = s.fixtures.filter(f => f.id !== 'explicit-unrelated-property'); d.importSurveyExpeditionTestState(s);
  });
  await move(page, f.site.roomId, f.work[0]);
  for (const t of paid.saved.contract.claims.tools) expect(await personal(page, 'stage', { stackId: t.stackId })).toBe(true);
  await inspect(page, f); await hire(page); s = await until(page, s => s.saved.job?.progress > 10);
  expect(s.actor.id).toBe(id); expect(s.saved.dutySeconds).toBeLessThan(duty); expect(s.saved.job.from).toBe(0);
  await move(page, f.site.roomId, f.away); await advance(page, 700); s = await snap(page);
  expect(s.saved.contract.completed).toHaveLength(1); expect(s.station.site.cacheId).not.toBe(f.site.cacheId);
  expect(s.saved.contract.claims.inputs.every(t => !s.stacks.some(i => i.id === t.stackId))).toBe(true);
  const newId = s.station.site.cacheId, physical = await station(page);
  expect(physical.fixtures.find(f => f.id === newId).condition).toBe(100);
  expect(s.stacks.filter(i => i.fixtureId === newId || i.fixtureId === f.site.cacheId)).toEqual([]);
  expect(s.stacks.filter(i => i.id === f.water)).toHaveLength(1); expect(s.stacks.find(i => i.id === f.water).carriedBy).toBe('scientist');
  expect(s.station.site.parts[part.id].previousInstallation.physicalId).toBe(f.site.cacheId);
  await move(page, f.site.roomId, f.site.layout.door); expect(await act(page, 'withdraw')).toBe(true); await settle(page, f);
  await reload(page, 'dom'); s = await snap(page); expect(s.station.site.cacheId).toBe(newId);
  expect(s.station.history.filter(r => r.operation === 'reconstruct' && r.physicalId)).toHaveLength(1); expect(f.errors).toEqual([]);
});
