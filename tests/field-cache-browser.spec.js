const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldCacheSnapshot());
const act = (page, kind, options = {}) => page.evaluate(({ kind, options }) => window.helixHeresyDebug.fieldCacheAction(kind, options), { kind, options });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n, true), n);
async function finish(page, home = false) {
  for (let n = 0; n < 18; n++) {
    const s = await snap(page), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe('');
    const seconds = Math.max(2, Math.ceil(t.dueAt - s.clock + 2));
    if (home) await page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), seconds);
    else await tick(page, seconds);
  }
  throw Error(`Physical cache work did not finish: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function walk(page, cell) {
  const s = await snap(page);
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, deferRender: true })), { room: s.roomId, cell })).toBe(true);
  await finish(page);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-cache-${renderer}`);
  const before = await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const s = d.exportSurveyExpeditionTestState(), bench = d.fixtureSnapshot().fixtures.find(f => f.id === 'starter-workbench');
    const cell = bench.accessiblePorts[0].cell;
    // Finite workshop inputs are explicit fixture inputs, never a finished kit,
    // production receipt or completed task. The ordinary crafting chain runs.
    for (const [key, quantity] of [['woodenComponents', 3], ['metalParts', 1]]) s.physicalItemStacks.push({
      id: `stack-${s.nextPhysicalItemStackNumber++}`, section: 'resources', key, quantity, knownQuantity: quantity,
      roomId: s.scientist.roomId, cell, sourceLabels: ['Explicit finite cache test workshop inputs'] });
    d.importSurveyExpeditionTestState(s);
    const total = key => d.fieldCacheSnapshot().stacks.filter(i => i.section === 'resources' && i.key === key).reduce((n, i) => n + i.quantity, 0);
    return { wood: total('woodenComponents'), metal: total('metalParts') };
  }, renderer);
  expect(await page.evaluate(() => window.helixHeresyDebug.createProductionBill({ recipeId: 'fixture:fieldCache', scope: 'workstation',
    workstationId: 'starter-workbench', mode: 'once', materialStrategy: 'closest', allowedMaterialOptionIds: ['wood'] }))).toBeTruthy();
  await finish(page, true);
  let s = await snap(page), kit = s.stacks.find(i => i.key === 'fieldCacheFinished'); expect(kit).toBeTruthy();
  expect(kit).toMatchObject({ unitMassKg: 4, unitVolumeL: 8, quantity: 1 });
  expect(s.stacks.filter(i => i.key === 'woodenComponents' && i.section === 'resources').reduce((n, i) => n + i.quantity, 0)).toBe(before.wood - 3);
  expect(s.stacks.filter(i => i.key === 'metalParts' && i.section === 'resources').reduce((n, i) => n + i.quantity, 0)).toBe(before.metal - 1);
  expect(s.fabricated.find(f => f.physicalStackId === kit.id).productionBillId).toBe(kit.productionBillId);
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('pack', { stackId: id }), kit.id)).toBe(true); await finish(page, true);
  s = await snap(page); const stone = s.stacks.find(i => i.section === 'resources' && i.key === 'stoneBlocks' && !i.reservedTaskId && !i.carriedBy);
  expect(stone).toBeTruthy();
  expect(await page.evaluate(id => window.helixHeresyDebug.fieldStationAction('pack', { stackId: id, amount: 1 }), stone.id)).toBe(true); await finish(page, true);
  s = await snap(page); const cargo = s.stacks.find(i => i.key === 'stoneBlocks' && i.carriedBy === 'scientist'); expect(cargo).toBeTruthy();
  console.info(`${renderer}: actual crafted frame and finite cargo physically packed`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [
    { cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'cache', truth: { potentialPermille: {} } };
    return Boolean(window.helixHeresyDebug.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10,
        temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } }));
  }, { source, carrier })).toBe(true);
  // Initial local presence uses the existing field fixture, not an earned
  // intercity journey. From here all walking, custody and handoffs are real.
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return { kit: kit.id, cargo: cargo.id, errors };
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: crafted cache deployment, interrupted handoff, revisit, empty repacking and genuine structural loss`, async ({ page }) => {
  const f = await setup(page, renderer);
  await walk(page, { ...(await snap(page)).cell, x: 24 });
  expect(await act(page, 'deploy', { stackId: f.kit })).toBe(true); await tick(page, 10);
  let s = await snap(page); expect(s.tasks[0].data.fieldCacheWork.progress).toBeGreaterThan(0);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), s.tasks[0].id)).toBe(true);
  expect((await snap(page)).stacks.find(i => i.id === f.kit).reservedTaskId).toBe('');
  expect(await act(page, 'deploy', { stackId: f.kit })).toBe(true); await tick(page, 15); await reload(page, renderer); await finish(page);
  s = await snap(page); let r = s.records[0]; expect(r).toBeTruthy();
  expect(s.stacks.some(i => i.id === f.kit)).toBe(false); expect(s.fabricated.some(i => i.physicalStackId === f.kit)).toBe(false);
  expect(s.fixtures.find(i => i.id === r.fixtureId).condition).toBe(100);
  expect(await page.evaluate(id => window.helixHeresyDebug.fixtureSnapshot().fixtures.find(f => f.id === id).definition.storage, r.fixtureId))
    .toMatchObject({ massKg: 30, volumeL: 30 });
  expect(await act(page, 'access', { fixtureId: r.fixtureId })).toBe(true);
  expect(await act(page, 'put', { fixtureId: r.fixtureId, stackId: f.cargo })).toBe(true); await tick(page, 5);
  const progress = (await snap(page)).tasks[0].data.fieldCacheWork.progress;
  expect(await page.evaluate(id => window.helixHeresyDebug.setStorageFixtureAccessState(id, 'closed'), r.fixtureId)).toBe(true);
  await tick(page, 40); expect((await snap(page)).tasks[0].data.fieldCacheWork.progress).toBe(progress);
  await reload(page, renderer);
  expect(await page.evaluate(id => window.helixHeresyDebug.setStorageFixtureAccessState(id, 'open'), r.fixtureId)).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.find(i => i.id === f.cargo)).toMatchObject({ fixtureId: r.fixtureId, carriedBy: '', quantity: 1, cell: r.cell });
  expect(await act(page, 'pack', { fixtureId: r.fixtureId })).toBe(false);
  expect(await act(page, 'access', { fixtureId: r.fixtureId })).toBe(true); const held = (await snap(page)).known;
  await walk(page, { ...r.port, x: r.port.x + 9 });
  expect(await act(page, 'take', { fixtureId: r.fixtureId, stackId: f.cargo })).toBe(false); expect((await snap(page)).known).toEqual(held);
  await page.evaluate(cell => window.helixHeresyDebug.damageStructure(cell, 20), r.cell);
  expect((await snap(page)).known).toEqual(held);
  await walk(page, r.port); expect(await act(page, 'access', { fixtureId: r.fixtureId })).toBe(true);
  const damaged = (await snap(page)).fixtures.find(i => i.id === r.fixtureId).condition; expect(damaged).toBeLessThan(100); expect(damaged).toBeGreaterThan(0);
  expect(await act(page, 'take', { fixtureId: r.fixtureId, stackId: f.cargo })).toBe(true); await finish(page);
  expect((await snap(page)).stacks.find(i => i.id === f.cargo).carriedBy).toBe('scientist');
  expect(await act(page, 'pack', { fixtureId: r.fixtureId })).toBe(true); await tick(page, 20); await reload(page, renderer); await finish(page);
  s = await snap(page); expect(s.stacks.filter(i => i.id === f.kit)).toHaveLength(1); expect(s.fabricated.find(i => i.physicalStackId === f.kit).condition).toBe(damaged);
  expect(await act(page, 'deploy', { stackId: f.kit })).toBe(true); await finish(page);
  s = await snap(page); r = s.records.at(-1); expect(s.fixtures.find(i => i.id === r.fixtureId).condition).toBe(damaged);
  expect(await act(page, 'access', { fixtureId: r.fixtureId })).toBe(true);
  expect(await act(page, 'put', { fixtureId: r.fixtureId, stackId: f.cargo })).toBe(true); await finish(page);
  await page.evaluate(cell => window.helixHeresyDebug.damageStructure(cell, 10000), r.cell); await reload(page, renderer);
  expect(await act(page, 'pack', { fixtureId: r.fixtureId })).toBe(false);
  expect(await act(page, 'recover', { fixtureId: r.fixtureId, stackId: f.cargo })).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.find(i => i.id === f.cargo)).toMatchObject({ carriedBy: 'scientist', quantity: 1 });
  expect(s.stacks.some(i => i.id === f.kit)).toBe(false); expect(s.fixtures.some(i => i.id === r.fixtureId)).toBe(false);
  expect(f.errors).toEqual([]); console.info(`${renderer}: complete finite cache loop, saved interruption and real loss passed`);
});
