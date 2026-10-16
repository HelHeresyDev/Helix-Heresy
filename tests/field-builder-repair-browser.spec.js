const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const proposal = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.builderProposal);
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function move(page, room, cell) {
  const s = await snap(page);
  if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 15; n++) {
    const s = await snap(page); if (!s.tasks.length) return;
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Original scientist did not finish walking.');
}
async function until(page, predicate) {
  for (let n = 0; n < 12; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 20); }
  throw new Error(`Repair condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function damage(page, partId, condition, replace = false) {
  await page.evaluate(({ partId, condition, replace }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), p = s.fieldStation.site.layout.parts.find(p => p.id === partId);
    const wall = s.labMap.terrain.constructedWalls.find(w => JSON.stringify(w.cell) === JSON.stringify(p.cell));
    wall.condition = condition; if (replace) wall.builtAt++;
    d.importSurveyExpeditionTestState(s);
  }, { partId, condition, replace });
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `builder-repair-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'builder', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site, l = site.layout;
    const parts = l.parts.filter(p => p.kind === 'wall' && p.cell.x === l.origin.x + 2 && [l.origin.y + 1, l.origin.y + 2].includes(p.cell.y));
    // Explicit already-built original floors and two damaged walls. This tests
    // repairs, not the separately covered construction or passenger journey.
    for (const p of [...l.parts.filter(p => p.kind === 'floor'), ...parts]) {
      const row = { cell: p.cell, materialId: 'stoneBlocks', condition: p.kind === 'floor' ? 100 : p.id === parts[0].id ? 20 : 80, builtAt: s.clock };
      if (p.kind === 'floor') s.labMap.terrain.constructedFloors.push({ ...row, purpose: 'floor' });
      else s.labMap.terrain.constructedWalls.push(row);
      site.parts[p.id] = { at: s.clock, partId: p.id, physicalId: `${p.cell.x},${p.cell.y},${p.cell.z}`, taskId: `fixture-${p.id}` };
      site.effort[p.id] = 1;
    }
    const doorPart = l.parts.find(p => p.kind === 'door'), doorId = `door-${l.door.x}-${l.door.y}-${l.door.z}`;
    site.doorId = doorId;
    s.labMap.doors[doorId] = { id: doorId, cell: l.door, roomIds: [site.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
    s.doors[doorId] = { id: doorId, typeId: 'roughWoodDoor', state: 'open', condition: 80, materialId: 'lumber', builtAt: s.clock };
    site.parts[doorPart.id] = { at: s.clock, partId: doorPart.id, physicalId: doorId, taskId: 'fixture-door' }; site.effort[doorPart.id] = 1;
    s.economy.money = 500; d.importSurveyExpeditionTestState(s);
    const work = parts.map(p => ({ ...p.cell, x: p.cell.x + 1 }));
    d.configureUnsupportedTest({ cell: work[0] });
    d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer'] });
    for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist')) d.fieldStationAction('stage', { stackId: i.id });
    const [stone] = d.configureHiddenWorkshopTest({ cell: work[0], supplies: { stoneBlocks: 3 } });
    const e = d.foreignSurveySnapshot().excursion;
    return { site, parts, work, stone, room: e.roomId, away: { x: 35, y: 12, z: work[0].z } };
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('button', { name: `Inspect repair commission ${f.parts[0].id}`, exact: true }).click();
  expect((await proposal(page))?.operation).toBe('repair');
  expect(await act(page, 'append', { partId: f.site.layout.parts[0].id })).toBe(false);
  await move(page, f.site.roomId, f.work[1]);
  await page.getByRole('button', { name: `Append repair component ${f.parts[1].id}`, exact: true }).click();
  const order = await proposal(page);
  expect(order.components.map(p => p.part.costs)).toEqual([{ stoneBlocks: 1 }, { stoneBlocks: 1 }]);
  expect(order.tools).toHaveLength(1);
  await move(page, f.room, { x: 15, y: 11, z: f.work[0].z });
  return { ...f, renderer, errors };
}
async function hire(page) {
  await page.getByRole('button', { name: 'Review exact repair order terms', exact: true }).click();
  const q = (await snap(page)).known.quote; expect(q).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original bounded repair work order', exact: true }).click();
  const s = await snap(page); expect(s.money).toBe(412); expect(s.saved.phase).toBe('arriving'); return s;
}
async function settle(page, f) {
  await until(page, s => s.saved.phase === 'awaitingSettlement');
  await move(page, f.room, { x: 15, y: 11, z: f.work[0].z });
  expect(await act(page, 'settle')).toBe(false);
  for (const t of (await snap(page)).saved.contract.claims.tools) if (t.borrowedAt != null)
    expect(await act(page, 'tool', { stackId: t.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); const s = await snap(page);
  expect(s.saved.phase).toBe('completed'); expect(Number.isInteger(s.money)).toBe(true);
  expect(await act(page, 'settle')).toBe(false); return s;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed())
    await info.attach('repair-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas repair orders preserve original targets, saved effort, finite stock, shared loans and dated reports', async ({ page }) => {
  const f = await setup(page, 'canvas'), hired = await hire(page), original = hired.station.site.parts;
  const xp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0);
  expect(hired.stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 1, reservedTaskId: '' });
  await until(page, s => s.saved.job?.progress > 10); let s = await snap(page);
  const progress = s.saved.job.progress, started = s.saved.contract.startedAt, id = s.actor.id, loan = s.saved.contract.claims.tools[0];
  expect(s.saved.job).toMatchObject({ actorId: id, operation: 'repair', targetKey: s.saved.contract.offer.components[0].targetKey });
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(progress);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.reservedTaskId).toBe(s.saved.job.taskId);
  await move(page, f.site.roomId, f.away); s = await snap(page); const known = s.known;
  await advance(page, 750); s = await snap(page);
  expect(s.saved.contract.completed.map(p => p.restoredCondition), JSON.stringify({ reason: s.saved.contract.reason, work: s.workReason })).toEqual([65, 100]);
  expect(s.saved.contract.startedAt).toBe(started); expect(s.station.site.parts).toEqual(original);
  expect(s.known).toEqual(known); expect(await act(page, 'report')).toBe(false);
  expect(s.station.history.filter(r => r.operation === 'repair')).toHaveLength(2);
  expect(s.station.history.filter(r => r.operation === 'repair').every(r => r.actorId === id)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0)).toBe(xp);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - 4);
  expect(s.saved.contract.claims.inputs.every(t => !s.stacks.some(i => i.id === t.stackId))).toBe(true);
  const knowledge = await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot().knowledge);
  expect(knowledge.history.some(r => r.operation === 'repair')).toBe(false);
  await advance(page, 30); expect((await snap(page)).station.history.filter(r => r.operation === 'repair')).toHaveLength(2);
  await move(page, f.site.roomId, { ...f.work[1], x: f.work[1].x + 1 });
  expect(await act(page, 'report')).toBe(true); expect((await snap(page)).known.received.completed.map(p => p.restoredCondition)).toEqual([65, 100]);
  expect(await act(page, 'withdraw')).toBe(true); const paid = await settle(page, f);
  await reload(page, 'canvas'); s = await snap(page); expect(s.money).toBe(paid.money); expect(s.actor.id).toBe(id);
  expect(s.stacks.find(i => i.id === loan.stackId).carriedBy).toBe('scientist'); expect(f.errors).toEqual([]);
  // Doors use tile-based IDs too: a new installation at the same tile and
  // condition must not inherit the original door's repair identity after load.
  const identity = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), p = s.fieldStation.site.layout.parts.find(p => p.kind === 'door');
    const before = d.fieldStationBuildPlan(p.id, 'repair').context.target;
    s.doors[s.fieldStation.site.doorId].builtAt++; d.importSurveyExpeditionTestState(s);
    const after = d.fieldStationBuildPlan(p.id, 'repair').context.target;
    return { before, after };
  });
  expect(identity.before.original).toBe(true); expect(identity.before.stamp).toBe(0);
  expect(identity.after.id).toBe(identity.before.id); expect(identity.after.condition).toBe(identity.before.condition);
  expect(identity.after.stamp).toBe(1); expect(identity.after.original).toBe(false);
});
test('DOM changed unfinished originals cancel the whole repair order and require fresh inspection and consent', async ({ page }) => {
  const f = await setup(page, 'dom');
  const q = await act(page, 'review'); expect(q).toBeTruthy();
  await damage(page, f.parts[1].id, 79);
  expect(await act(page, 'hire', { expected: q })).toBe(false); expect((await snap(page)).money).toBe(500);
  await damage(page, f.parts[1].id, 80); await hire(page);
  await until(page, s => s.saved.job?.progress > 10);
  let s = await snap(page); const first = f.parts[0].id;
  await advance(page, s.saved.job.required - s.saved.job.progress + 35);
  s = await until(page, s => s.saved.contract.index === 1 && s.saved.job?.progress > 10);
  expect(s.saved.contract.completed).toHaveLength(1); const completed = s.saved.contract.completed, targetKey = s.saved.job.targetKey;
  expect(s.station.site.maintenanceEffort[`repair:${f.parts[1].id}`].fraction).toBeGreaterThan(0);
  await reload(page, 'dom');
  // Same visible condition but a different construction stamp is a replacement,
  // not the original inspected component. No unfinished row may be substituted.
  await damage(page, f.parts[1].id, 80, true); await advance(page, 1); s = await snap(page);
  expect(['returning', 'awaitingSettlement']).toContain(s.saved.phase); expect(s.saved.contract.reason).toContain('fresh consent');
  expect(s.saved.contract.completed).toEqual(completed); expect(s.saved.job.invalidated).toBe(true);
  expect(s.station.site.maintenanceEffort[`repair:${f.parts[1].id}`]).toBeUndefined();
  expect(s.station.history.filter(r => r.operation === 'repair' && r.physicalId).map(r => r.partId)).toEqual([first]);
  expect(s.stacks.filter(i => s.saved.contract.claims.inputs.some(t => t.stackId === i.id)).every(i => !i.reservedTaskId)).toBe(true);
  const paid = await settle(page, f); await reload(page, 'dom'); s = await snap(page);
  expect(s.money).toBe(paid.money); expect(s.saved.contract.completed).toEqual(completed);
  expect(s.saved.job.targetKey).toBe(targetKey); expect(await act(page, 'hire', { expected: q })).toBe(false);
  expect(s.station.site.parts[first]).toBeTruthy(); expect(f.errors).toEqual([]);
});
