const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
// Both employment roles share the production movement/needs/beast heartbeat,
// not their contracts, source allocations or job authorization.
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function move(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 30; n++) {
    const s = await snap(page), tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason).toBe(''); await advance(page, Math.max(1, tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Scientist did not finish the real walking path.');
}
async function until(page, predicate, limit = 30) {
  for (let n = 0; n < limit; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 10); }
  throw new Error(`Builder condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('original-builder-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-builder-${renderer}`);
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
    const site = d.fieldStationSnapshot().saved.site, part = site.layout.parts.find(p => p.kind === 'floor');
    const workCell = d.fieldStationBuildPlan(part.id).context.workCell; if (!workCell) return null;
    // Explicit initial local presence, finite cargo and original home tool
    // placement. No earned passenger trip, new worker pool or new tool copies.
    d.configureUnsupportedTest({ cell: workCell });
    d.configureHiddenWorkshopTest({ carryTools: Object.keys(part.tools) });
    for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist')) d.fieldStationAction('stage', { stackId: i.id });
    const [stone] = d.configureHiddenWorkshopTest({ cell: workCell, supplies: { stoneBlocks: 3 } });
    const prepared = d.exportSurveyExpeditionTestState(); prepared.economy.money = 500; d.importSurveyExpeditionTestState(prepared);
    const e = prepared.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    return { site, part, workCell, stone, room: e.roomId, observer: { ...workCell, x: workCell.x + 1 } };
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy();
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('button', { name: `Inspect building commission ${f.part.id}`, exact: true }).click();
  await move(page, f.room, { x: 15, y: 11, z: f.workCell.z });
  const q = await act(page, 'review'); expect(q, JSON.stringify((await snap(page)).context)).toBeTruthy();
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original one-component building commission', exact: true }).click();
  const s = await snap(page); expect(s.saved.phase).toBe('arriving'); expect(s.money).toBe(412);
  expect(s.stacks.find(i => i.id === f.stone)).toMatchObject({ quantity: 2, reservedTaskId: '' });
  expect(s.saved.contract.claims.inputs).toHaveLength(1);
  return { ...f, errors, id: s.actor.id, loan: s.saved.contract.claims.tools };
}

test('canvas one original craftsperson uses saved real tools and materials, builds independently, reports locally and returns loans before settlement', async ({ page }) => {
  const f = await setup(page, 'canvas');
  await until(page, s => s.saved.phase === 'onSite');
  await move(page, f.site.roomId, f.observer);
  await until(page, s => s.saved.job?.progress > 10);
  let s = await snap(page); const progress = s.saved.job.progress, claim = s.saved.contract.id;
  expect(s.saved.job.actorId).toBe(f.id); expect(s.saved.job.actorId).not.toBe('scientist');
  expect(s.tools.filter(t => f.loan.some(l => l.toolId === t.tool.id)).every(t => t.tool.carriedBy === f.id && t.stack.carriedBy === f.id && t.tool.reservedTaskId === claim)).toBe(true);
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(progress); expect(s.saved.job.actorId).toBe(f.id);
  expect(s.tools.filter(t => f.loan.some(l => l.toolId === t.tool.id)).every(t => t.tool.reservedTaskId === claim && t.stack.reservedTaskId === claim)).toBe(true);
  const known = s.known;
  await move(page, f.site.roomId, { x: 35, y: 12, z: f.workCell.z });
  await advance(page, s.saved.job.required - s.saved.job.progress + 10); s = await snap(page);
  expect(s.saved.job.status, JSON.stringify({ reason: s.saved.contract.reason, workReason: s.workReason, actor: s.actor.mapCell })).toBe('completed'); expect(s.actor.id).toBe(f.id); expect(s.known).toEqual(known);
  expect(await act(page, 'report')).toBe(false); expect(s.station.site.parts[f.part.id].actorId).toBe(f.id);
  expect(s.station.history.filter(r => r.partId === f.part.id && r.physicalId)).toHaveLength(1);
  expect(s.stacks.some(i => i.id === s.saved.contract.claims.inputs[0].stackId)).toBe(false);
  expect(s.stacks.find(i => i.id === f.stone).quantity).toBe(2);
  for (const loan of f.loan) expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - f.part.tools[loan.key]);
  const publicStation = await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot().knowledge);
  expect(publicStation.history.some(r => r.actorId === f.id && r.physicalId)).toBe(false);
  await advance(page, 60); expect((await snap(page)).station.history.filter(r => r.partId === f.part.id && r.physicalId)).toHaveLength(1);
  await move(page, f.site.roomId, f.observer);
  await page.getByRole('button', { name: 'Ask craftsperson for personal report', exact: true }).click();
  expect((await snap(page)).known.received.job.status).toBe('completed');
  await page.getByRole('button', { name: 'Ask craftsperson to withdraw', exact: true }).click();
  await advance(page, 80); expect((await snap(page)).saved.phase).toBe('awaitingSettlement'); expect(await act(page, 'settle')).toBe(false);
  await move(page, f.room, { x: 15, y: 11, z: f.workCell.z }); expect(await act(page, 'settle')).toBe(false);
  for (const loan of f.loan) expect(await act(page, 'tool', { stackId: loan.stackId })).toBe(true);
  await page.getByRole('button', { name: 'Settle returned building commission here', exact: true }).click();
  s = await snap(page); expect(s.saved.phase).toBe('completed'); expect(Number.isInteger(s.money)).toBe(true); expect(s.money).toBeGreaterThan(412); expect(s.money).toBeLessThan(460);
  const money = s.money; expect(await act(page, 'settle')).toBe(false); await reload(page, 'canvas'); s = await snap(page);
  expect(s.money).toBe(money); expect(s.actor.id).toBe(f.id);
  for (const loan of f.loan) expect(s.stacks.find(i => i.id === loan.stackId).carriedBy).toBe('scientist');
  expect(f.errors).toEqual([]);
});

test('DOM physical route obstruction, missing original materials and personal cancellation preserve actual goods, loans and effort', async ({ page }) => {
  const f = await setup(page, 'dom');
  await move(page, f.room, { x: 12, y: 11, z: f.workCell.z });
  const ring = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = d.fieldBuilderSnapshot().actor;
    const cells = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...a.mapCell, x: a.mapCell.x + dx, y: a.mapCell.y + dy }));
    for (const cell of cells) s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s); return cells;
  });
  const position = (await snap(page)).actor.mapCell; await advance(page, 60); let s = await snap(page);
  expect(s.actor.mapCell).toEqual(position); expect(s.saved.phase).toBe('arriving'); expect(s.saved.contract.startedAt).toBeNull();
  await reload(page, 'dom');
  await page.evaluate(ring => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !ring.some(c => c.x === w.cell.x && c.y === w.cell.y && c.z === w.cell.z));
    d.importSurveyExpeditionTestState(s);
  }, ring);
  await until(page, s => s.saved.job?.progress > 10); s = await snap(page); const progress = s.saved.job.progress;
  const originalMaterial = s.saved.contract.claims.inputs[0].stackId;
  await page.evaluate(id => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== id); d.importSurveyExpeditionTestState(s);
  }, originalMaterial);
  await advance(page, 1); s = await snap(page); expect(s.saved.phase).toBe('returning'); expect(s.saved.job.status).toBe('cancelled');
  expect(s.station.site.parts[f.part.id]).toBeUndefined(); expect(s.station.site.effort[f.part.id]).toBeGreaterThan(0);
  expect(s.saved.job.progress).toBe(progress); expect(s.stacks.find(i => i.id === f.stone).quantity).toBe(2);
  expect(s.saved.contract.claims.tools.every(t => s.stacks.find(i => i.id === t.stackId).reservedTaskId === '')).toBe(true);
  await advance(page, 80); expect((await snap(page)).saved.phase).toBe('awaitingSettlement');
  expect((await snap(page)).saved.contract.claims.tools.every(t => (s.stacks.find(i => i.id === t.stackId)?.carriedBy) === f.id)).toBe(true);
  expect(await act(page, 'report')).toBe(false); expect(f.errors).toEqual([]);
});
