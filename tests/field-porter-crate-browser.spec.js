const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldPorterSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldPorterAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
async function until(page, predicate, limit = 90) {
  for (let n = 0; n < limit; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 2); }
  throw new Error(`Crate condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function move(page, room, cell) {
  const s = await snap(page); if (s.scientistRoom === room && JSON.stringify(s.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 20; n++) {
    const tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason).toBe(''); await advance(page, Math.max(1, tasks[0].dueAt - (await snap(page)).clock + 1));
  }
  throw new Error('Scientist walk did not finish');
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.evaluate(r => window.helixHeresyDebug.setMapRenderer(r), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function editCrate(page, change) {
  await page.evaluate(change => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site;
    const f = s.fixtures.find(f => f.id === site.cacheId), rest = site.layout.rest;
    if (change.access) f.accessState = change.access;
    if (change.condition !== undefined) { f.condition = change.condition; f.operationalState = change.condition > 0 ? 'operational' : 'broken'; }
    if (change.replace) {
      f.id = 'replacement-crate'; site.cacheId = f.id; f.installedAt++;
      const p = site.layout.parts.find(p => p.kind === 'cache'); site.parts[p.id] = { ...site.parts[p.id], physicalId: f.id, at: f.installedAt };
    }
    if (change.full !== undefined) {
      s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== 'crate-capacity-fixture');
      if (change.full) s.physicalItemStacks.push({ id: 'crate-capacity-fixture', section: 'resources', key: 'stoneBlocks', quantity: 1,
        unitMassKg: change.full === 'mass' ? 250 : 1, unitVolumeL: change.full === 'volume' ? 300 : 1,
        fixtureId: f.id, roomId: site.roomId, cell: f.origin, sourceLabels: ['Explicit unrelated finite capacity fixture'] });
    }
    if (change.blocked !== undefined) {
      s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === rest[k]));
      if (change.blocked) s.labMap.terrain.constructedWalls.push({ cell: rest, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    }
    d.importSurveyExpeditionTestState(s);
  }, change);
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-porter-crate-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const depot = { city, standings: [{ standing: 'licensed', network: { id: 'transport:b', category: 'transport', roles: ['courierDispatch'], prohibitions: [] },
    branch: { id: 'depot:b', publicName: 'Birch Depot', organizationForm: 'contractDepot', currentCityId: 'b', publicPhysicalPresence: true,
      physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] };
  const f = await page.evaluate(({ source, carrier, depot, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'porter', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldPorterTestSource(depot)) return null;
    const s = d.exportSurveyExpeditionTestState(), site = s.fieldStation.site, l = site.layout, at = s.clock;
    // Explicit pre-existing original hut, not construction output or a free
    // player action. Construction has separate focused lifecycle coverage.
    for (const p of l.parts) {
      let id = `${p.cell.x},${p.cell.y},${p.cell.z}`;
      if (p.kind === 'wall') s.labMap.terrain.constructedWalls.push({ cell: p.cell, materialId: 'stoneBlocks', condition: 100, builtAt: at });
      if (['floor', 'roof'].includes(p.kind)) s.labMap.terrain.constructedFloors.push({ cell: p.cell, materialId: p.kind === 'floor' ? 'stoneBlocks' : 'lumber', purpose: p.kind, condition: 100, builtAt: at });
      if (p.kind === 'door') {
        site.doorId = id = `door-${p.cell.x}-${p.cell.y}-${p.cell.z}`;
        s.labMap.doors[id] = { id, cell: p.cell, roomIds: [site.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
        s.doors[id] = { id, typeId: 'roughWoodDoor', state: 'open', condition: 100, materialId: 'lumber' };
      }
      if (p.kind === 'cache') {
        site.cacheId = id = 'porter-original-cache'; s.fixtures.push({ id, typeId: 'storageCrate', name: 'Field Station Supply Crate', origin: p.cell,
          rotation: 0, condition: 100, accessState: 'open', materialPolicy: 'wood', installedAt: at });
      }
      site.parts[p.id] = { at, partId: p.id, physicalId: id, taskId: `fixture-${p.id}` }; site.effort[p.id] = 1;
    }
    s.economy.money = 500; d.importSurveyExpeditionTestState(s); d.configureUnsupportedTest({ cell: l.apron });
    const pickup = { ...l.apron, x: l.apron.x + 4 }, stock = d.configureHiddenWorkshopTest({ cell: pickup, supplies: { stoneBlocks: 4, lumber: 2 } });
    return { site, pickup, stone: stock[0], lumber: stock[1], room: d.foreignSurveySnapshot().excursion.roomId };
  }, { source, carrier, depot, renderer });
  expect(f).toBeTruthy(); const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await move(page, f.site.roomId, f.site.layout.rest);
  await page.getByRole('button', { name: 'Inspect original station crate for porter deposits', exact: true }).click();
  f.mark = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.porterStages.find(m => m.kind === 'crate'));
  expect(f.mark).toMatchObject({ kind: 'crate', fixtureId: f.site.cacheId, cell: f.site.layout.rest });
  await move(page, f.site.roomId, f.site.layout.apron); expect(await act(page, 'mark')).toBe(true);
  f.meeting = { x: 13, y: 11, z: f.site.layout.apron.z }; await move(page, f.room, f.meeting);
  expect(await act(page, 'review')).toBeTruthy();
  await page.getByRole('button', { name: 'Hire original porter for two-hour station shift', exact: true }).click();
  await move(page, f.site.roomId, f.site.layout.apron); await until(page, s => s.saved.phase === 'onSite');
  f.id = (await snap(page)).actor.id; f.errors = errors; console.info(`${renderer}: original porter personally hired beside the original crate.`); return f;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('crate-porter-state', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
test('Canvas exact crate deposits conserve real cargo, pause for access and both capacities, save and report only on reunion', async ({ page }) => {
  const f = await setup(page, 'canvas');
  const selector = page.getByLabel('Porter delivery staging destination'); await selector.selectOption(f.mark.id);
  await page.getByRole('button', { name: new RegExp(`^Append porter delivery:.*\\(${f.stone}\\)$`) }).click();
  await page.getByRole('button', { name: new RegExp(`^Append porter delivery:.*\\(${f.lumber}\\)$`) }).click();
  const expected = (await snap(page)).known.proposal;
  expect(expected.rows.every(r => r.destination.fixtureId === f.site.cacheId)).toBe(true);
  expect(await act(page, 'acceptOrder', { expected: { ...expected, rows: [] } })).toBe(false);
  await editCrate(page, { access: 'closed' }); expect(await act(page, 'acceptOrder', { expected })).toBe(false);
  expect((await snap(page)).stacks.find(i => i.id === f.stone).quantity).toBe(4);
  await editCrate(page, { access: 'open' }); await page.getByRole('button', { name: 'Accept exact bounded porter delivery order', exact: true }).click();
  let s = await until(page, s => s.saved.job.phase === 'load' && s.saved.job.progress > 0);
  const jobs = s.saved.deliveryOrder.jobs, start = s.saved.contract.startedAt, partial = s.saved.job.progress;
  await reload(page, 'canvas'); s = await snap(page); expect(s.saved.job.progress).toBe(partial);
  expect(s.stacks.find(i => i.id === jobs[0].stackId).reservedTaskId).toBe(jobs[0].id);
  await until(page, s => s.saved.job.phase === 'delivery');
  for (const change of [{ full: 'mass' }, { full: 'volume' }, { full: false, access: 'closed' }, { access: 'open', blocked: true }]) {
    await editCrate(page, change); const before = (await snap(page)).saved.job.progress; await advance(page, 20); s = await snap(page);
    expect(s.saved.deliveryOrder.index).toBe(0); expect(s.saved.job.progress).toBe(before); expect(s.saved.job.reason).toContain('unavailable');
    expect(s.stacks.find(i => i.id === jobs[0].stackId)).toMatchObject({ carriedBy: f.id, fixtureId: '', reservedTaskId: jobs[0].id });
  }
  await reload(page, 'canvas'); await editCrate(page, { blocked: false });
  // Move onto defended ground so a later report cannot be remotely refreshed.
  await move(page, f.room, f.meeting); const known = (await snap(page)).known; await advance(page, 100); s = await snap(page);
  expect(s.saved.deliveryOrder.status, JSON.stringify(s.saved.job)).toBe('delivered'); expect(s.known).toEqual(known);
  expect(await act(page, 'report')).toBe(false);
  for (const j of jobs) expect(s.stacks.find(i => i.id === j.stackId)).toMatchObject({ quantity: 1, fixtureId: f.site.cacheId, cell: f.site.layout.cache, carriedBy: '', reservedTaskId: '' });
  expect(s.stacks.find(i => i.id === f.stone).quantity).toBe(3); expect(s.stacks.find(i => i.id === f.lumber).quantity).toBe(1);
  expect(s.saved.contract.startedAt).toBe(start); expect(s.money).toBe(436);
  await move(page, f.site.roomId, f.site.layout.door); expect(await act(page, 'report')).toBe(true);
  expect((await snap(page)).known.received.order.status).toBe('delivered');
  expect(await act(page, 'withdraw')).toBe(true); await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(true); const money = (await snap(page)).money;
  expect(await act(page, 'settle')).toBe(false); await reload(page, 'canvas'); s = await snap(page);
  expect(s.money).toBe(money); expect(s.actor.id).toBe(f.id); expect(s.saved.history).toHaveLength(2); expect(f.errors).toEqual([]);
});
test('DOM crate cancellation retains carried goods through return and handback; replacement requires fresh inspection and consent', async ({ page }) => {
  const f = await setup(page, 'dom');
  expect(await act(page, 'append', { stackId: f.stone, stageId: f.mark.id })).toBe(true);
  expect(await act(page, 'acceptOrder', { expected: (await snap(page)).known.proposal })).toBe(true);
  await until(page, s => s.saved.job.phase === 'delivery'); let s = await snap(page); const job = s.saved.job;
  await editCrate(page, { access: 'closed' });
  await move(page, f.site.roomId, s.actor.mapCell); // Cancellation, like consent, requires actual arm's-reach contact.
  expect(await act(page, 'cancel')).toBe(true); s = await snap(page);
  expect(s.stacks.find(i => i.id === job.stackId)).toMatchObject({ carriedBy: f.id, reservedTaskId: '', fixtureId: '' });
  expect(await act(page, 'cargo', { stackId: job.stackId })).toBe(false);
  await reload(page, 'dom'); expect(await act(page, 'withdraw')).toBe(true);
  await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'settle')).toBe(true); const money = (await snap(page)).money;
  expect(await act(page, 'review')).toBeNull();
  await page.getByRole('button', { name: `Collect retained porter cargo (${job.stackId})`, exact: true }).click();
  s = await snap(page); expect(s.stacks.find(i => i.id === job.stackId)).toMatchObject({ carriedBy: 'scientist', fixtureId: '', quantity: 1 });
  expect(await act(page, 'cargo', { stackId: job.stackId })).toBe(false); expect(s.saved.cargoHandbacks).toHaveLength(1);
  await reload(page, 'dom'); expect((await snap(page)).money).toBe(money);
  expect(await act(page, 'review')).toBeTruthy(); expect(await act(page, 'hire', { expected: (await snap(page)).known.quote })).toBe(true);
  await editCrate(page, { access: 'open' });
  await move(page, f.site.roomId, f.site.layout.apron); await until(page, s => s.saved.phase === 'onSite');
  expect(await act(page, 'append', { stackId: f.lumber, stageId: f.mark.id })).toBe(true);
  expect(await act(page, 'acceptOrder', { expected: (await snap(page)).known.proposal })).toBe(true);
  await until(page, s => s.saved.job.phase === 'delivery'); const next = (await snap(page)).saved.job;
  await editCrate(page, { replace: true }); await advance(page, 1); s = await snap(page);
  expect(s.saved.phase).toBe('returning'); expect(s.saved.deliveryOrder.status).toBe('interrupted');
  expect(s.saved.contract.reason).toContain('fresh inspection');
  expect(s.stacks.find(i => i.id === next.stackId)).toMatchObject({ carriedBy: f.id, reservedTaskId: '', fixtureId: '' });
  expect(s.stacks.filter(i => i.fixtureId === 'replacement-crate')).toHaveLength(0);
  await reload(page, 'dom'); await until(page, s => s.saved.phase === 'awaitingSettlement'); await move(page, f.room, f.meeting);
  expect(await act(page, 'cargo', { stackId: next.stackId })).toBe(true); expect(await act(page, 'settle')).toBe(true);
  await move(page, f.site.roomId, f.site.layout.rest); expect(await act(page, 'markCrate')).toBe(true);
  const marks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.porterStages);
  expect(marks.find(m => m.fixtureId === 'replacement-crate')).toBeTruthy(); expect(marks.find(m => m.fixtureId === f.site.cacheId)).toEqual(f.mark);
  expect(f.errors).toEqual([]);
});
