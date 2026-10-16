const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(1200000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const timber = page => page.evaluate(() => window.helixHeresyDebug.fallenTimberSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 20; n++) { const s = await snap(page); if (!s.tasks.length) return; await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1)); }
  throw new Error('Personal task did not complete.');
}
async function move(page, room, cell) {
  const s = await snap(page); if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true); await finish(page);
}
async function until(page, predicate, seconds = 15) {
  for (let n = 0; n < 32; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, seconds); }
  const s = await snap(page); throw new Error(`Recovery condition not reached: ${JSON.stringify({ saved: s.saved, c: s.workContext, reason: s.workReason })}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `timber-recovery-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'recovery', truth: {
      potentialPermille: { timberFiber: 1000 }, surfaceAccessibilityPermille: 1000 } };
    // Explicit local presence/backing, not an earned passenger journey. Sources
    // are generated from finite geography; no logs or lumber are injected.
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const t = d.fallenTimberSnapshot(), site = d.fieldStationSnapshot().saved.site, state = d.exportSurveyExpeditionTestState();
    const cells = new Set(state.labMap.rooms[t.site.roomId].cells.map(c => JSON.stringify(c)));
    for (const node of [...t.site.nodes].sort((a, b) => a.remaining - b.remaining)) {
      const work = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ x: node.cell.x + x, y: node.cell.y + y, z: node.cell.z }))
        .find(c => cells.has(JSON.stringify(c)) && !t.site.nodes.some(n => JSON.stringify(n.cell) === JSON.stringify(c))
          && !site.layout.parts.some(p => p.cell.z === c.z && Math.max(Math.abs(p.cell.x - c.x), Math.abs(p.cell.y - c.y)) <= 1));
      if (!work) continue;
      state.economy.money = 1000; d.importSurveyExpeditionTestState(state);
      d.configureUnsupportedTest({ cell: work }); d.configureHiddenWorkshopTest({ carryTools: ['handSaw'] });
      return { site, node, initial: node.remaining, work, room: d.foreignSurveySnapshot().excursion.roomId,
        meeting: { x: 15, y: 11, z: work.z }, away: site.layout.apron };
    }
    return null;
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  expect(await act(page, 'inspectTimber', { nodeId: f.node.id })).toBe(false); // Not personally inspected yet.
  expect(await page.evaluate(id => window.helixHeresyDebug.startFallenTimberWork('inspect', id), f.node.id)).toBe(true); await finish(page);
  await move(page, f.site.roomId, f.work);
  const saw = (await snap(page)).stacks.find(i => i.key === 'handSaw' && i.carriedBy === 'scientist');
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('stage', { stackId: id }), saw.id)).toBe(true);
  return { ...f, renderer, errors };
}
async function inspectAndHire(page, f) {
  await move(page, f.site.roomId, f.work);
  await page.getByRole('button', { name: `Inspect one-portion timber recovery (${f.node.id})`, exact: true }).click();
  const proposal = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.builderProposal);
  expect(proposal).toMatchObject({ operation: 'recoverTimber', nodeId: f.node.id, sourceRemaining: f.initial, part: { seconds: 1800, tools: { handSaw: 12 } } });
  expect(await act(page, 'append', { partId: f.site.layout.parts[0].id })).toBe(false);
  await move(page, f.room, f.meeting);
  await page.getByRole('button', { name: 'Review exact one-portion timber recovery terms', exact: true }).click();
  const s = await snap(page); expect(s.known.quote, JSON.stringify(s.context)).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original one-portion timber recovery commission', exact: true }).click();
  expect((await snap(page)).money).toBe(s.money - 88); return proposal;
}
async function settle(page, f) {
  await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(false);
  for (const loan of (await snap(page)).saved.contract.claims.tools) if (loan.borrowedAt != null) expect(await act(page, 'tool', { stackId: loan.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); const s = await snap(page); expect(await act(page, 'settle')).toBe(false); return s;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('recovery-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas source recovery saves both physical stages, pauses on obstruction, conserves finite timber and reports only at reunion', async ({ page }) => {
  const f = await setup(page, 'canvas'); await inspectAndHire(page, f);
  let s = await until(page, s => s.saved.job?.action === 'cut' && s.saved.job.progress > 10);
  const actor = s.actor.id, loan = s.saved.contract.claims.tools[0], started = s.saved.contract.startedAt, cutProgress = s.saved.job.progress;
  expect((await timber(page)).saved.sites[f.site.siteId].nodes.find(n => n.id === f.node.id).commissionClaim).toBe(s.saved.contract.id);
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(cutProgress);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.reservedTaskId).toBe(`${s.saved.contract.id}:cut`);
  s = await until(page, s => s.saved.job?.action === 'saw' && s.saved.job.progress > 5, 30);
  const logId = s.saved.contract.recovery.log.id, sawProgress = s.saved.job.progress;
  expect(s.stacks.find(i => i.id === logId)).toMatchObject({ key: 'fieldLog', quantity: 1, unitMassKg: 11, unitVolumeL: 26, carriedBy: '', cell: f.work });
  expect(s.inventory.stacks.some(i => i.id === logId)).toBe(false); expect(s.saved.contract.startedAt).toBe(started);
  expect((await timber(page)).saved.sites[f.site.siteId].nodes.find(n => n.id === f.node.id).remaining).toBe(f.initial - 1);
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(sawProgress);
  expect(s.stacks.find(i => i.id === logId).reservedTaskId).toBe(`${s.saved.contract.id}:saw`);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await advance(page, 30); s = await snap(page); expect(s.saved.job.progress).toBe(sawProgress); expect(s.saved.phase).toBe('onSite');
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => JSON.stringify(w.cell) !== JSON.stringify(cell)); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await move(page, f.site.roomId, f.away); const known = (await snap(page)).known, knownTimber = (await timber(page)).knowledge;
  const xp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0);
  await advance(page, 1400); s = await snap(page); expect(s.saved.contract.completed, s.workReason || s.saved.contract.reason).toHaveLength(1);
  expect(s.actor.id).toBe(actor); expect(s.saved.contract.startedAt).toBe(started); expect(s.known).toEqual(known);
  expect((await timber(page)).knowledge).toEqual(knownTimber); expect(await act(page, 'report')).toBe(false);
  expect(s.stacks.find(i => i.id === logId)).toBeUndefined(); expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - 12);
  const outputs = s.saved.contract.completed[0].outputs; expect(outputs.map(o => [o.key, o.quantity])).toEqual([['lumber', 2], ['woodDebris', 1]]);
  expect(outputs.reduce((n, o) => n + s.stacks.find(i => i.id === o.id).unitMassKg * o.quantity, 0)).toBe(11);
  for (const o of outputs) expect(s.stacks.find(i => i.id === o.id)).toMatchObject({ cell: f.work, carriedBy: '', fixtureId: '' });
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0)).toBe(xp);
  await advance(page, 30); expect((await snap(page)).saved.contract.completed).toHaveLength(1);
  await move(page, f.site.roomId, { ...f.work, y: f.work.y + 1 }); expect(await act(page, 'report')).toBe(true);
  expect((await snap(page)).known.received.completed[0].outputs).toEqual(outputs); expect(await act(page, 'withdraw')).toBe(true);
  const paid = await settle(page, f); await reload(page, 'canvas'); expect((await snap(page)).money).toBe(paid.money); expect(f.errors).toEqual([]);
});
test('DOM changed trunk stops cutting; fresh consent retains physical effort and cancellation leaves the real partially sawn log', async ({ page }) => {
  const f = await setup(page, 'dom'); await inspectAndHire(page, f);
  let s = await until(page, s => s.saved.job?.action === 'cut' && s.saved.job.progress > 10), loan = s.saved.contract.claims.tools[0];
  const actor = s.actor.id;
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).sourceLabels.push('Changed original source'); d.importSurveyExpeditionTestState(s);
  }, f.node.stackId);
  await advance(page, 1); s = await snap(page); expect(['returning', 'awaitingSettlement']).toContain(s.saved.phase);
  expect(s.saved.contract.reason).toContain('fresh consent'); expect(s.saved.contract.completed).toEqual([]);
  const physical = (await timber(page)).saved.sites[f.site.siteId], node = physical.nodes.find(n => n.id === f.node.id);
  expect(node.remaining).toBe(f.initial); expect(node.effort).toBeGreaterThan(0); expect(node.commissionClaim).toBe('');
  await reload(page, 'dom'); await settle(page, f); await move(page, f.site.roomId, f.work);
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('stage', { stackId: id }), loan.stackId)).toBe(true);
  const offer = await inspectAndHire(page, f); expect(offer.from).toBe(node.effort);
  s = await until(page, s => s.saved.job?.action === 'saw' && s.saved.job.progress > 5, 30);
  const logId = s.saved.contract.recovery.log.id; expect(s.actor.id).toBe(actor); expect(s.saved.job.retained).toBe(0);
  await move(page, f.site.roomId, { ...f.work, y: f.work.y + 1 }); expect(await act(page, 'withdraw')).toBe(true);
  s = await snap(page); expect(s.saved.contract.completed).toEqual([]); expect(s.stacks.find(i => i.id === logId)).toMatchObject({ key: 'fieldLog', quantity: 1, reservedTaskId: '' });
  const partial = (await timber(page)).saved.sites[f.site.siteId].sawEffort[logId].fraction; expect(partial).toBeGreaterThan(0);
  await reload(page, 'dom'); await settle(page, f); await move(page, f.site.roomId, f.work);
  expect(await page.evaluate(id => window.helixHeresyDebug.startFallenTimberWork('saw', id), logId)).toBe(true); await finish(page);
  const t = await timber(page); expect(t.stacks.find(i => i.id === logId)).toBeUndefined(); expect(t.site.nodes.find(n => n.id === f.node.id).remaining).toBe(f.initial - 1);
  const personal = t.site.receipts.filter(r => r.action === 'saw' && r.actorId === 'scientist'); expect(personal).toHaveLength(1);
  expect(personal[0].inputId).toBe(logId); expect(personal[0].outputs.map(o => o.quantity)).toEqual([2, 1]); expect(f.errors).toEqual([]);
});
