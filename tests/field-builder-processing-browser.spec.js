const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function move(page, room, cell) {
  const s = await snap(page); if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 20; n++) { const p = await snap(page); if (!p.tasks.length) return; await advance(page, Math.max(1, p.tasks[0].dueAt - p.clock + 1)); }
  throw new Error('Physical movement did not complete.');
}
async function until(page, predicate) {
  for (let n = 0; n < 24; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 15); }
  const s = await snap(page); throw new Error(`Processing condition not reached: ${JSON.stringify({ saved: s.saved, c: s.workContext, reason: s.workReason })}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `builder-processing-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'processing', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const site = d.fieldStationSnapshot().saved.site, work = site.layout.apron;
    d.configureUnsupportedTest({ cell: work }); d.configureHiddenWorkshopTest({ carryTools: ['handSaw'] });
    for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist' && i.key === 'handSaw')) d.fieldStationAction('stage', { stackId: i.id });
    // Explicit finite original-log fixture, not an earned extraction or journey.
    const [logId] = d.configureHiddenWorkshopTest({ cell: work, supplies: { fieldLog: 1 } });
    const state = d.exportSurveyExpeditionTestState(), log = state.physicalItemStacks.find(i => i.id === logId);
    Object.assign(log, { section: 'resources', unitMassKg: 11, unitVolumeL: 26, materialComposition: { primary: 'wood' }, sourceLabels: ['Explicit original fallen log'] });
    state.economy.money = 1000; d.importSurveyExpeditionTestState(state);
    return { site, work, logId, room: d.foreignSurveySnapshot().excursion.roomId, meeting: { x: 15, y: 11, z: work.z }, away: { x: 35, y: 12, z: work.z } };
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return { ...f, errors, renderer };
}
async function inspectAndHire(page, f) {
  await move(page, f.site.roomId, f.work);
  await page.getByRole('button', { name: `Inspect one-log processing commission (${f.logId})`, exact: true }).click();
  const proposal = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.builderProposal);
  expect(proposal).toMatchObject({ operation: 'saw', inputId: f.logId, part: { costs: { fieldLog: 1 }, tools: { handSaw: 8 }, seconds: 1200 } });
  expect(await act(page, 'append', { partId: f.site.layout.parts[0].id })).toBe(false);
  await move(page, f.room, f.meeting);
  await page.getByRole('button', { name: 'Review exact one-log processing terms', exact: true }).click();
  let s = await snap(page); expect(s.known.quote, JSON.stringify(s.context)).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original one-log processing commission', exact: true }).click();
  expect((await snap(page)).money).toBe(s.money - 88); return proposal;
}
async function settle(page, f) {
  await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(false);
  for (const t of (await snap(page)).saved.contract.claims.tools) if (t.borrowedAt != null) expect(await act(page, 'tool', { stackId: t.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); const s = await snap(page); expect(Number.isInteger(s.money)).toBe(true);
  expect(await act(page, 'settle')).toBe(false); return s;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('processing-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas one-log commission physically borrows, saves, pauses and produces once without remote evidence or scientist XP', async ({ page }) => {
  const f = await setup(page, 'canvas'), proposal = await inspectAndHire(page, f);
  let s = await until(page, s => s.saved.job?.progress > 10);
  const id = s.actor.id, loan = s.saved.contract.claims.tools[0], progress = s.saved.job.progress, started = s.saved.contract.startedAt;
  expect(s.saved.job).toMatchObject({ operation: 'saw', inputId: f.logId, actorId: id });
  expect(s.stacks.find(i => i.id === loan.stackId).carriedBy).toBe(id);
  expect(s.inventory.usage.volumeL).toBeLessThan(s.inventory.capacity.volumeL); // 26 L log is processed in place, not carried.
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(progress);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.reservedTaskId).toBe(s.saved.job.taskId);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await advance(page, 30); s = await snap(page); expect(s.saved.job.progress).toBe(progress); expect(s.saved.phase).toBe('onSite');
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => JSON.stringify(w.cell) !== JSON.stringify(cell)); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await move(page, f.site.roomId, f.away); const known = (await snap(page)).known;
  const xp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0);
  await advance(page, 1400); s = await snap(page); expect(s.saved.contract.completed, s.workReason || s.saved.contract.reason).toHaveLength(1);
  expect(s.saved.contract.startedAt).toBe(started); expect(s.actor.id).toBe(id); expect(s.known).toEqual(known);
  expect(s.stacks.find(i => i.id === f.logId)).toBeUndefined(); expect(await act(page, 'report')).toBe(false);
  const outputs = s.saved.contract.completed[0].outputs;
  expect(outputs.map(o => [o.key, o.quantity])).toEqual([['lumber', 2], ['woodDebris', 1]]);
  for (const o of outputs) expect(s.stacks.find(i => i.id === o.id)).toMatchObject({ quantity: o.quantity, cell: proposal.workCell, carriedBy: '', fixtureId: '' });
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - 8);
  expect(await page.evaluate(() => window.helixHeresyDebug.fallenTimberSnapshot().knowledge.receipts)).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.fabrication?.xp || 0)).toBe(xp);
  await advance(page, 30); expect((await snap(page)).saved.contract.completed).toHaveLength(1);
  await move(page, f.site.roomId, { ...f.work, x: f.work.x + 1 }); expect(await act(page, 'report')).toBe(true);
  expect((await snap(page)).known.received.completed[0].outputs).toEqual(outputs); expect(await act(page, 'withdraw')).toBe(true);
  const paid = await settle(page, f); await reload(page, 'canvas'); expect((await snap(page)).money).toBe(paid.money); expect(f.errors).toEqual([]);
});
test('DOM processing cancellation preserves partial log work; changed original inputs stop a fresh agreement without substitutes', async ({ page }) => {
  const f = await setup(page, 'dom'); await inspectAndHire(page, f);
  let s = await until(page, s => s.saved.job?.progress > 10); const loan = s.saved.contract.claims.tools[0];
  await move(page, f.site.roomId, { ...f.work, x: f.work.x + 1 });
  expect(await act(page, 'withdraw')).toBe(true); s = await snap(page);
  const effort = await page.evaluate(() => window.helixHeresyDebug.fallenTimberSnapshot().site.sawEffort);
  expect(effort[f.logId].fraction).toBeGreaterThan(0); expect(s.stacks.find(i => i.id === f.logId).quantity).toBe(1);
  expect(s.saved.contract.completed).toEqual([]); const worn = s.tools.find(t => t.tool.id === loan.toolId).tool.current;
  await reload(page, 'dom'); await settle(page, f);
  await move(page, f.site.roomId, f.work);
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('stage', { stackId: id }), loan.stackId)).toBe(true);
  const proposal = await inspectAndHire(page, f); expect(proposal.from).toBe(effort[f.logId].fraction);
  s = await until(page, s => s.saved.job?.progress > 0); expect(s.saved.job.retained).toBe(proposal.from);
  expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBeLessThanOrEqual(worn);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).sourceLabels.push('Changed original provenance'); d.importSurveyExpeditionTestState(s);
  }, f.logId);
  await advance(page, 1); s = await snap(page); expect(['returning', 'awaitingSettlement']).toContain(s.saved.phase);
  expect(s.saved.contract.completed).toEqual([]); expect(s.saved.contract.reason).toContain('fresh consent');
  expect(s.stacks.find(i => i.id === f.logId).quantity).toBe(1);
  expect(await page.evaluate(siteId => window.helixHeresyDebug.fallenTimberSnapshot().saved.sites[siteId].receipts, f.site.siteId)).toEqual([]);
  await settle(page, f); expect(f.errors).toEqual([]);
});
