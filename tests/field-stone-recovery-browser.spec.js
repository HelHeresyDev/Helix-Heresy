const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldBuilderSnapshot());
const stone = page => page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot());
const savedStone = async (page, f) => (await stone(page)).saved.sites[f.site.siteId];
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldBuilderAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 20; n++) { const s = await snap(page); if (!s.tasks.length) return; await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1)); }
  throw new Error('Personal work did not complete.');
}
async function move(page, room, cell) {
  const s = await snap(page); if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true); await finish(page);
}
async function until(page, predicate) {
  for (let n = 0; n < 24; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 15); }
  const s = await snap(page); throw new Error(`Stone condition not reached: ${JSON.stringify({ saved: s.saved, c: s.workContext, reason: s.workReason })}`);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `stone-commission-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, carrier, city, institution, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'stone-commission', truth: {
      potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    // Explicit initial local presence, source backing and original tools. Actual
    // exposed faces are generated from saved geography; no blocks are injected.
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution })) return null;
    const q = d.surfaceStoneSnapshot(), site = d.fieldStationSnapshot().saved.site;
    const cells = d.foreignWildernessSnapshot().site.discovery.baseline.cells;
    const node = q.site.nodes.filter(n => n.remaining > 0).sort((a, b) => a.remaining - b.remaining)[0]; if (!node) return null;
    const work = cells.find(c => c.z === node.cell.z && Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) === 1); if (!work) return null;
    const state = d.exportSurveyExpeditionTestState(); state.economy.money = 1000;
    state.scientist.skills.materialsScience = { ...(state.scientist.skills.materialsScience || {}), xp: 100000 };
    d.importSurveyExpeditionTestState(state); d.configureUnsupportedTest({ cell: work }); d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer', 'stoneChisel'] });
    return { site, node, initial: node.remaining, work, room: d.foreignSurveySnapshot().excursion.roomId,
      meeting: { x: 15, y: 11, z: work.z }, away: site.layout.apron };
  }, { source, carrier, city, institution, renderer });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  expect(await act(page, 'inspectStone', { nodeId: f.node.id })).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('inspect', id), f.node.id)).toBe(true); await finish(page);
  await move(page, f.site.roomId, f.work);
  for (const i of (await snap(page)).stacks.filter(i => ['masonryHammer', 'stoneChisel'].includes(i.key) && i.carriedBy === 'scientist'))
    expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('stage', { stackId: id }), i.id)).toBe(true);
  await page.getByRole('button', { name: `Inspect one-block stone recovery (${f.node.id})`, exact: true }).click();
  const offer = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.builderProposal);
  expect(offer).toMatchObject({ operation: 'recoverStone', part: { seconds: 900, tools: { masonryHammer: 4, stoneChisel: 6 } } });
  expect(JSON.stringify(offer)).not.toMatch(/"(remaining|sourceRemaining|potentialPermille)":/);
  expect(await act(page, 'append', { partId: f.site.layout.parts[0].id })).toBe(false);
  await move(page, f.room, f.meeting); await page.getByRole('button', { name: 'Review exact one-block stone recovery terms', exact: true }).click();
  const s = await snap(page); expect(s.known.quote, JSON.stringify(s.context)).toMatchObject({ upfront: 88, seconds: 7200 });
  expect(await act(page, 'hire', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept original one-block stone recovery commission', exact: true }).click();
  expect((await snap(page)).money).toBe(s.money - 88); return { ...f, errors, renderer };
}
async function settle(page, f) {
  await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(false);
  for (const loan of (await snap(page)).saved.contract.claims.tools) if (loan.borrowedAt != null) expect(await act(page, 'tool', { stackId: loan.stackId })).toBe(true);
  expect(await act(page, 'settle')).toBe(true); const s = await snap(page); expect(await act(page, 'settle')).toBe(false); return s;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('stone-commission-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas one-block commission uses original tools and worker skill, saves, pauses, depletes once and reports only on reunion', async ({ page }) => {
  const f = await setup(page, 'canvas'); let s = await until(page, s => s.saved.job?.progress > 10);
  const id = s.actor.id, loans = s.saved.contract.claims.tools, progress = s.saved.job.progress, started = s.saved.contract.startedAt;
  expect(s.saved.job.required).toBeGreaterThanOrEqual(900); expect(s.actor.skills.materialsScience).toBeUndefined();
  expect(s.saved.job).toMatchObject({ operation: 'recoverStone', retained: 0 });
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(progress);
  expect(s.tools.filter(t => loans.some(l => l.toolId === t.tool.id)).every(t => t.tool.reservedTaskId === s.saved.job.taskId && t.stack.carriedBy === id)).toBe(true);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await advance(page, 30); s = await snap(page); expect(s.saved.job.progress).toBe(progress); expect(s.saved.phase).toBe('onSite');
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => JSON.stringify(w.cell) !== JSON.stringify(cell)); d.importSurveyExpeditionTestState(s);
  }, f.work);
  await move(page, f.site.roomId, f.away); const known = (await snap(page)).known, stoneKnown = (await stone(page)).knowledge;
  const xp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.materialsScience.xp);
  await advance(page, 1400); s = await snap(page); expect(s.saved.contract.completed, s.workReason || s.saved.contract.reason).toHaveLength(1);
  expect(s.actor.id).toBe(id); expect(s.saved.contract.startedAt).toBe(started); expect(s.known).toEqual(known); expect((await stone(page)).knowledge).toEqual(stoneKnown);
  expect(await act(page, 'report')).toBe(false); expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.skills.materialsScience.xp)).toBe(xp);
  const output = s.saved.contract.completed[0].outputId;
  expect(s.stacks.find(i => i.id === output)).toMatchObject({ key: 'stoneBlocks', quantity: 1, unitMassKg: 8, unitVolumeL: 5, cell: f.work, carriedBy: '', fixtureId: '' });
  for (const loan of loans) expect(s.tools.find(t => t.tool.id === loan.toolId).tool.current).toBe(loan.condition - s.saved.contract.offer.part.tools[loan.key]);
  expect((await savedStone(page, f)).nodes.find(n => n.id === f.node.id).remaining).toBe(f.initial - 1);
  await advance(page, 30); expect((await snap(page)).saved.contract.completed).toHaveLength(1);
  await move(page, f.site.roomId, f.work); expect(await act(page, 'report')).toBe(true);
  expect((await snap(page)).known.received.completed[0].outputId).toBe(output); expect(await act(page, 'withdraw')).toBe(true);
  const paid = await settle(page, f); await reload(page, 'canvas'); expect((await snap(page)).money).toBe(paid.money); expect(f.errors).toEqual([]);
});
test('DOM cancelled stone commission retains original-face progress and both worn tools for supplied personal completion', async ({ page }) => {
  const f = await setup(page, 'dom'); let s = await until(page, s => s.saved.job?.progress > 150);
  await move(page, f.site.roomId, f.work); expect(await act(page, 'withdraw')).toBe(true);
  s = await snap(page); const node = (await savedStone(page, f)).nodes.find(n => n.id === f.node.id), effort = node.effort.fraction;
  expect(effort).toBeGreaterThan(0); expect(node.commissionClaim).toBe(''); expect(node.remaining).toBe(f.initial);
  expect(s.saved.contract.completed).toEqual([]); expect(s.stacks.filter(i => i.tags?.includes('surface-stone'))).toEqual([]);
  await reload(page, 'dom'); await settle(page, f); await move(page, f.site.roomId, f.work);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), f.node.id)).toBe(true);
  const task = (await stone(page)).tasks.find(t => t.data?.stoneWork); expect(task.data.stoneWork.retained).toBe(effort);
  expect(task.data.stoneWork.required).toBeLessThan(900 * (1 - effort)); await finish(page);
  const p = await stone(page); expect(p.saved.sites[f.site.siteId].nodes.find(n => n.id === f.node.id).remaining).toBe(f.initial - 1);
  const blocks = p.stacks.filter(i => i.tags?.includes('surface-stone')); expect(blocks).toHaveLength(1); expect(blocks[0].quantity).toBe(1);
  expect(p.tools.filter(t => t.stack.carriedBy === 'scientist').every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
  await reload(page, 'dom'); expect((await stone(page)).stacks.filter(i => i.tags?.includes('surface-stone'))).toHaveLength(1); expect(f.errors).toEqual([]);
});
