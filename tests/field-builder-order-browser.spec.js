const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function move(page, room, cell) {
  const before = await snap(page);
  if (before.scientistRoom === room && ['x', 'y', 'z'].every(k => before.scientistCell[k] === cell[k])) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 30; n++) {
    const s = await snap(page), tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) { expect(s.scientistCell).toEqual(cell); return; }
    expect(tasks[0].reason).toBe(''); await advance(page, Math.max(1, tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Actual walking did not finish.');
}
async function until(page, predicate, limit = 80) {
  for (let n = 0; n < limit; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 5); }
  throw new Error(`Ordered builder state not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer); await visits(page);
}
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('ordered-builder-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-order-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'order', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const site = d.fieldStationSnapshot().saved.site, l = site.layout;
    const floors = l.parts.filter(p => p.kind === 'floor').reverse(), wall = l.parts.find(p => p.kind === 'wall' && p.cell.x === l.origin.x && p.cell.y === l.origin.y + 1);
    const positions = [l.apron, l.door, l.rest, l.cache];
    // Explicit initial local stock, money and real existing home tools, not an
    // earned journey, free employee pool or construction receipts.
    d.configureUnsupportedTest({ cell: l.apron }); d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'stoneChisel'] });
    for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist')) d.fieldStationAction('stage', { stackId: i.id });
    const [apron] = d.configureHiddenWorkshopTest({ cell: l.apron, supplies: { stoneBlocks: 3 } });
    const [side] = d.configureHiddenWorkshopTest({ cell: { ...l.rest, x: l.rest.x + 1 }, supplies: { stoneBlocks: 1 } });
    const [upper] = d.configureHiddenWorkshopTest({ cell: { ...l.origin, x: l.origin.x + 1 }, supplies: { stoneBlocks: 5 } });
    const state = d.exportSurveyExpeditionTestState(); state.economy.money = 500; d.importSurveyExpeditionTestState(state);
    const e = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    return { site, parts: [...floors, wall], positions, apron, side, upper, room: e.roomId };
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy(); await visits(page);
  await page.getByRole('button', { name: `Inspect building commission ${f.parts[0].id}`, exact: true }).click();
  for (let n = 1; n < 4; n++) {
    await move(page, f.site.roomId, f.positions[n]); await visits(page);
    await page.getByRole('button', { name: `Append building component ${f.parts[n].id}`, exact: true }).click();
    expect(await act(page, 'append', { partId: f.parts[n].id })).toBe(false);
  }
  const proposal = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builderProposal);
  expect(proposal.components.map(p => p.part.id)).toEqual(f.parts.map(p => p.id)); expect(proposal.tools).toHaveLength(2);
  expect(await act(page, 'append', { partId: f.site.layout.parts.find(p => p.kind === 'wall' && p.id !== f.parts[3].id).id })).toBe(false);
  expect(await act(page, 'removeLast')).toBe(true); expect(await act(page, 'append', { partId: f.parts[3].id })).toBe(true);
  await move(page, f.room, { x: 15, y: 11, z: f.positions[0].z }); await visits(page);
  const q = await act(page, 'review'); expect(q, JSON.stringify((await snap(page)).known.reply)).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: { ...q, offer: { ...q.offer, components: [...q.offer.components].reverse() } } })).toBe(false);
  await page.getByRole('button', { name: 'Accept original bounded building work order', exact: true }).click();
  let s = await snap(page); expect(s.money).toBe(412); expect(s.saved.contract.claims.inputs).toHaveLength(4);
  expect(new Set(s.saved.contract.claims.inputs.map(i => i.stackId)).size).toBe(4);
  expect(s.saved.contract.claims.tools).toHaveLength(2); expect(s.stacks.find(i => i.id === f.apron)).toMatchObject({ quantity: 1, reservedTaskId: '' });
  expect(s.stacks.find(i => i.id === f.upper)).toMatchObject({ quantity: 3, reservedTaskId: '' });
  s = await until(page, s => s.saved.job?.status === 'working');
  const started = s.saved.contract.startedAt;
  await advance(page, Math.ceil(s.saved.job.required - s.saved.job.progress) + 2);
  s = await snap(page); expect(s.saved.contract.index).toBe(1); expect(s.saved.contract.completed).toHaveLength(1);
  expect(s.station.site.parts[f.parts[0].id].actorId).toBe(s.actor.id);
  expect(s.stacks.filter(i => s.saved.contract.claims.inputs.slice(1).some(t => t.stackId === i.id)).every(i => i.reservedTaskId.startsWith(`${s.saved.contract.id}:part-`))).toBe(true);
  return { ...f, renderer, errors, id: s.actor.id, started, loan: s.saved.contract.claims.tools };
}

test('canvas four-component order physically builds dependent work with original shared tools, saved partial claims, one wage clock and return settlement', async ({ page }) => {
  const f = await setup(page, 'canvas');
  let s = await until(page, s => s.saved.job?.progress > 10); const progress = s.saved.job.progress, jobId = s.saved.job.taskId;
  expect(s.saved.contract.index).toBe(1); await reload(page, 'canvas'); s = await snap(page);
  expect(s.saved.job.progress).toBe(progress); expect(s.saved.job.taskId).toBe(jobId);
  expect(s.tools.filter(t => f.loan.some(l => l.toolId === t.tool.id)).every(t => t.tool.reservedTaskId === jobId)).toBe(true);
  const known = s.known;
  await move(page, f.site.roomId, { x: 35, y: 12, z: f.positions[0].z }); await advance(page, 2400); s = await snap(page);
  expect(s.saved.contract.completed.map(p => p.partId), JSON.stringify({ reason: s.saved.contract.reason, work: s.workReason })).toEqual(f.parts.map(p => p.id));
  expect(s.saved.contract.startedAt).toBe(f.started); expect(s.saved.contract.finishedAt).toBeTruthy(); expect(s.known).toEqual(known);
  expect(s.station.history.filter(r => r.actorId === f.id && r.physicalId)).toHaveLength(4);
  expect(s.saved.contract.claims.inputs.every(t => !s.stacks.some(i => i.id === t.stackId))).toBe(true);
  expect(s.stacks.find(i => i.id === f.apron).quantity).toBe(1); expect(s.stacks.find(i => i.id === f.upper).quantity).toBe(3);
  for (const loan of f.loan) {
    const wear = f.parts.reduce((n, p) => n + (p.tools[loan.key] || 0), 0);
    expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - wear);
  }
  const publicStation = await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot().knowledge);
  expect(publicStation.history.some(r => r.partId === f.parts[3].id && r.physicalId)).toBe(false);
  await advance(page, 30); expect((await snap(page)).saved.contract.completed).toHaveLength(4);
  await move(page, f.site.roomId, { ...f.positions[3], y: f.positions[3].y - 1 });
  expect(await act(page, 'report')).toBe(true); expect((await snap(page)).known.received.completed).toHaveLength(4);
  expect(await act(page, 'withdraw')).toBe(true); await advance(page, 120);
  expect((await snap(page)).saved.phase).toBe('awaitingSettlement'); expect(await act(page, 'settle')).toBe(false);
  await move(page, f.room, { x: 15, y: 11, z: f.positions[0].z }); expect(await act(page, 'settle')).toBe(false);
  for (const loan of f.loan) expect(await act(page, 'tool', { stackId: loan.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); s = await snap(page); const money = s.money;
  expect(Number.isInteger(money)).toBe(true); expect(money).toBeGreaterThanOrEqual(412); expect(money).toBeLessThan(460);
  expect(await act(page, 'settle')).toBe(false); await reload(page, 'canvas'); s = await snap(page);
  expect(s.money).toBe(money); expect(s.actor.id).toBe(f.id); expect(s.saved.contract.completed).toHaveLength(4); expect(f.errors).toEqual([]);
});

test('DOM blocked next component never skips; saved partial work and completed pieces survive missing exact future stock without substitution', async ({ page }) => {
  const f = await setup(page, 'dom');
  const block = f.positions[1];
  await page.evaluate(cell => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, block);
  await advance(page, 60); let s = await snap(page); expect(s.saved.contract.index).toBe(1); expect(s.saved.contract.completed).toHaveLength(1);
  expect(s.saved.contract.startedAt).toBe(f.started); expect(s.station.site.parts[f.parts[3].id]).toBeUndefined();
  await reload(page, 'dom'); expect((await snap(page)).saved.contract.completed).toHaveLength(1);
  await page.evaluate(cell => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => w.cell.x !== cell.x || w.cell.y !== cell.y || w.cell.z !== cell.z); d.importSurveyExpeditionTestState(s);
  }, block);
  s = await until(page, s => s.saved.job?.progress > 10); const effort = s.saved.job.progress, taskId = s.saved.job.taskId;
  await reload(page, 'dom'); expect((await snap(page)).saved.job).toMatchObject({ progress: effort, taskId });
  const missing = s.saved.contract.claims.inputs.find(i => i.componentIndex === 3).stackId;
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== id); d.importSurveyExpeditionTestState(s); }, missing);
  await advance(page, 120); s = await snap(page);
  expect(s.saved.phase).toBe('awaitingSettlement'); expect(s.saved.contract.completed).toHaveLength(1); expect(s.saved.job.status).toBe('cancelled');
  expect(s.station.site.effort[f.parts[1].id]).toBeGreaterThan(0); expect(s.station.site.parts[f.parts[0].id]).toBeTruthy();
  expect(s.station.site.parts[f.parts[1].id]).toBeUndefined(); expect(s.station.site.parts[f.parts[3].id]).toBeUndefined();
  expect(s.stacks.find(i => i.id === f.upper)).toMatchObject({ quantity: 3, reservedTaskId: '' });
  expect(s.stacks.some(i => i.reservedTaskId.startsWith(s.saved.contract.id))).toBe(false); expect(s.money).toBe(412);
  await move(page, f.room, { x: 15, y: 11, z: f.positions[0].z });
  for (const loan of f.loan) expect(await act(page, 'tool', { stackId: loan.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); expect((await snap(page)).known.received.completed).toHaveLength(1); expect(f.errors).toEqual([]);
});
