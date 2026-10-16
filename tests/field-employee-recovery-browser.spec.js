const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snap = (page, role) => page.evaluate(role => window.helixHeresyDebug.fieldEmployeeRecoverySnapshot(role), role);
const rest = (page, role, action, options = {}) => page.evaluate(({ role, action, options }) => window.helixHeresyDebug.fieldEmployeeRecoveryAction(role, action, options), { role, action, options });
const work = (page, role, action, options = {}) => page.evaluate(({ role, action, options }) => window.helixHeresyDebug[role === 'builder' ? 'fieldBuilderAction' : 'fieldPorterAction'](action, options), { role, action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldPorterForTest(n), n);
const recover = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldEmployeeRecoveryForTest(n), n);
async function move(page, role, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 30; n++) {
    const s = await snap(page, role); if (!s.tasks.length) return;
    expect(s.tasks[0].reason).toBe(''); await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Actual walking did not finish.');
}
async function finish(page, role) {
  const s = await snap(page, role); expect(s.tasks).toHaveLength(1); expect(s.tasks[0].reason).toBe('');
  await advance(page, Math.ceil(s.tasks[0].dueAt - s.clock) + 1); expect((await snap(page, role)).tasks).toHaveLength(0);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, role, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `field-rest-${role}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const depot = { city, standings: [{ standing: 'licensed', network: { id: 'transport:b', category: 'transport', roles: ['courierDispatch'], prohibitions: [] },
    branch: { id: 'depot:b', publicName: 'Birch Depot', organizationForm: 'contractDepot', currentCityId: 'b', publicPhysicalPresence: true,
      physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] };
  const f = await page.evaluate(({ role, renderer, source, carrier, city, institution, depot }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'rest', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setFieldBuilderTestSource({ city, institution }) || !d.setFieldPorterTestSource(depot)) return null;
    const site = d.fieldStationSnapshot().saved.site, part = site.layout.parts.find(p => p.kind === 'floor');
    const cell = role === 'builder' ? d.fieldStationBuildPlan(part.id).context.workCell : site.layout.apron;
    // Explicit finite initial local cargo/tools/funds. No earned trip or replacement person.
    d.configureUnsupportedTest({ cell });
    if (role === 'builder') {
      d.configureHiddenWorkshopTest({ carryTools: Object.keys(part.tools) });
      for (const i of d.fieldStationSnapshot().stacks.filter(i => i.carriedBy === 'scientist')) d.fieldStationAction('stage', { stackId: i.id });
      d.configureHiddenWorkshopTest({ cell, supplies: { stoneBlocks: 1 } });
      if (!d.fieldBuilderAction('inspect', { partId: part.id })) return null;
    } else if (!d.fieldPorterAction('mark')) return null;
    const ids = d.configureHiddenWorkshopTest({ cell, supplies: { fieldShelter: 1, drinkingWater: 4, trailMeal: 2 } });
    for (const id of ids) if (!d.carryActorStack('scientist', id, id === ids[1] ? 4 : id === ids[2] ? 2 : 1)) return null;
    const state = d.exportSurveyExpeditionTestState(); state.economy.money = 500; d.importSurveyExpeditionTestState(state);
    const e = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    return { site, cell, room: e.roomId, shelter: ids[0], partId: part.id };
  }, { role, renderer, source, carrier, city, institution, depot });
  expect(f).toBeTruthy();
  const x = role === 'builder' ? 15 : 13;
  await move(page, role, f.room, { x, y: 11, z: f.cell.z });
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  const q = await work(page, role, 'review'); expect(q).toBeTruthy();
  expect(await work(page, role, 'hire', { expected: q })).toBe(true);
  expect(await rest(page, role, 'begin')).toBe(false); expect(await rest(page, role, 'deploy')).toBe(false);
  expect(await work(page, role, 'withdraw')).toBe(true); await advance(page, 1);
  expect((await snap(page, role)).saved.phase).toBe('awaitingSettlement');
  expect(await rest(page, role, 'begin')).toBe(false); expect(await work(page, role, 'settle')).toBe(true);
  // A depleted returned person's persistent condition and kit are explicit test
  // inputs, not replenishment or work earned by a fixture.
  await page.evaluate(role => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const s = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey[role];
    s.dutySeconds = 100; s.actor.health = 72; Object.assign(s.actor.needs, { thirst: 80, hunger: 75, exertion: 85 });
    state.physicalItemStacks = state.physicalItemStacks.filter(i => i.carriedBy !== s.actor.id || !['drinkingWater', 'trailMeal'].includes(i.key));
    d.importSurveyExpeditionTestState(state);
  }, role);
  expect(await rest(page, role, 'begin')).toBe(false);
  await page.getByRole('button', { name: `Deploy ${role} rest shelter here`, exact: true }).click();
  await advance(page, 30); let s = await snap(page, role); expect(s.saved.restPlace).toBeUndefined(); expect(s.tasks).toHaveLength(1);
  await reload(page, renderer); await finish(page, role); s = await snap(page, role);
  expect(s.saved.restPlace.stackId).toBe(f.shelter); expect(s.context.placeUsable).toBe(true);
  expect(s.stacks.find(i => i.id === f.shelter)).toMatchObject({ carriedBy: '', quantity: 1, reservedTaskId: s.saved.restPlace.id });
  expect(await rest(page, role, 'begin')).toBe(false);
  for (const key of ['drinkingWater', 'drinkingWater', 'trailMeal']) expect(await rest(page, role, 'provision', { key })).toBe(true);
  await page.getByRole('button', { name: `Begin ${role} supplied eight-hour rest`, exact: true }).click();
  s = await snap(page, role); expect(s.saved.recovery.status).toBe('resting'); expect(s.saved.dutySeconds).toBe(100);
  expect(s.saved.recovery.consumed.map(i => i.key)).toEqual(['drinkingWater', 'trailMeal']);
  expect(await work(page, role, 'review')).toBeNull(); expect(await rest(page, role, 'pack')).toBe(false);
  return { ...f, role, renderer, errors, id: s.saved.actor.id, money: s.money };
}

test('canvas porter supplied rest survives real saves, remains private while away, restores duty once and requires fresh paid rehire', async ({ page }) => {
  const f = await setup(page, 'porter', 'canvas'), role = f.role;
  await recover(page, 3600); let s = await snap(page, role); const partial = s.saved.recovery.progressSeconds;
  expect(partial).toBe(3600); const report = s.saved.recoveryReport;
  await reload(page, f.renderer); expect((await snap(page, role)).saved.recovery.progressSeconds).toBe(partial);
  await move(page, role, f.room, { x: 11, y: 13, z: f.cell.z });
  expect(await rest(page, role, 'report')).toBe(false); expect(await rest(page, role, 'end')).toBe(false);
  s = await snap(page, role); await recover(page, 28800 - s.saved.recovery.progressSeconds); s = await snap(page, role);
  expect(s.saved.recovery.status).toBe('completed'); expect(s.saved.dutySeconds).toBe(28800); expect(s.saved.actor.health).toBe(72);
  expect(s.saved.recoveryReport).toEqual(report); expect(s.saved.actor.id).toBe(f.id); expect(s.money).toBe(f.money);
  const done = s.saved.recovery, kit = s.inventory.contents; await recover(page, 60); s = await snap(page, role);
  expect(s.saved.recovery).toEqual(done); expect(s.inventory.contents).toEqual(kit);
  await move(page, role, f.room, { x: 13, y: 11, z: f.cell.z });
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('button', { name: 'Ask porter for off-duty report', exact: true }).click();
  expect((await snap(page, role)).saved.recoveryReport.recovery.status).toBe('completed');
  // Packing returns the one actual kit, never a replacement.
  expect(await rest(page, role, 'pack')).toBe(true); await finish(page, role); s = await snap(page, role);
  expect(s.saved.restPlace).toBeNull(); expect(s.stacks.find(i => i.id === f.shelter).carriedBy).toBe('scientist');
  const q = await work(page, role, 'review'); expect(q).toBeTruthy();
  expect(await work(page, role, 'hire', { expected: q })).toBe(true); s = await snap(page, role);
  expect(s.money).toBe(f.money - 64); expect(s.saved.actor.id).toBe(f.id); expect(s.saved.dutySeconds).toBe(28800);
  await reload(page, f.renderer); expect((await snap(page, role)).saved.actor.id).toBe(f.id); expect(f.errors).toEqual([]);
});

test('DOM craftsperson shelter obstruction and real missing water hold saved rest, cancellation retains costs and physical shelter packing can be cancelled', async ({ page }) => {
  const f = await setup(page, 'builder', 'dom'), role = f.role;
  await recover(page, 3600); let s = await snap(page, role); const partial = s.saved.recovery.progressSeconds;
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), s = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder;
    state.labMap.terrain.constructedWalls.push({ cell: s.restPlace.cell, materialId: 'stoneBlocks', condition: 100, builtAt: state.clock });
    d.importSurveyExpeditionTestState(state);
  });
  await recover(page, 3600); s = await snap(page, role); expect(s.saved.recovery.progressSeconds).toBe(partial); expect(s.saved.recovery.status).toBe('paused');
  await reload(page, f.renderer); expect((await snap(page, role)).saved.recovery.progressSeconds).toBe(partial);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), s = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder;
    state.labMap.terrain.constructedWalls = state.labMap.terrain.constructedWalls.filter(w => JSON.stringify(w.cell) !== JSON.stringify(s.restPlace.cell));
    // Explicit loss of the remaining original water; no substitute is fetched.
    state.physicalItemStacks = state.physicalItemStacks.filter(i => i.carriedBy !== s.actor.id || i.key !== 'drinkingWater');
    d.importSurveyExpeditionTestState(state);
  });
  await recover(page, 6 * 3600); s = await snap(page, role); expect(s.saved.recovery.status).toBe('paused'); expect(s.saved.dutySeconds).toBe(100);
  const held = s.saved.recovery.progressSeconds; expect(held).toBeGreaterThan(partial); expect(held).toBeLessThan(28800);
  expect(await rest(page, role, 'provision', { key: 'drinkingWater' })).toBe(true); await recover(page, 60);
  s = await snap(page, role); expect(s.saved.recovery.progressSeconds).toBe(held + 60); expect(s.saved.recovery.consumed.at(-1).key).toBe('drinkingWater');
  const spent = s.saved.recovery.consumed; expect(await rest(page, role, 'end')).toBe(true);
  s = await snap(page, role); expect(s.saved.dutySeconds).toBe(100); expect(s.saved.recovery.status).toBe('ended'); expect(s.saved.recovery.consumed).toEqual(spent);
  expect(s.money).toBe(f.money); expect(s.saved.actor.health).toBe(72); expect(s.saved.actor.id).toBe(f.id);
  expect(await rest(page, role, 'pack')).toBe(true); await advance(page, 10);
  const task = (await snap(page, role)).tasks[0];
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
  s = await snap(page, role); expect(s.stacks.find(i => i.id === f.shelter).reservedTaskId).toBe(s.saved.restPlace.id);
  await reload(page, f.renderer); expect((await snap(page, role)).context.placeUsable).toBe(true);
  expect(await rest(page, role, 'pack')).toBe(true); await finish(page, role); expect((await snap(page, role)).stacks.find(i => i.id === f.shelter).carriedBy).toBe('scientist');
  expect(f.errors).toEqual([]);
});
