const { test, expect } = require('@playwright/test');
const { fixture: refugeFixture } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldPorterSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldSupplyAction(action, options), { action, options });
const tick = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceFieldSupplyForTest(n), seconds);
async function walk(page, room, cell) {
  const before = await snap(page); if (JSON.stringify(before.scientistCell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 80; n++) { if (!(await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks)).length) return; await tick(page, 5); }
  throw Error('Physical scientist walk blocked');
}
async function until(page, predicate, steps = 140, stepSeconds = 5) {
  for (let n = 0; n < steps; n++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.fieldSupplyProgressForTest());
    if (predicate(s)) return snap(page);
    if (s.saved?.supplyLeg?.status === 'interrupted') throw Error(`Supply interrupted: ${s.saved.supplyLeg.reason}`);
    await tick(page, stepSeconds);
  }
  throw Error(`Supply condition not reached: ${JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.fieldSupplyProgressForTest()))}`);
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('supply-progress', {
    body: JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.fieldSupplyProgressForTest())), contentType: 'application/json' });
});
async function setup(page, renderer) {
  const f = await refugeFixture(page, renderer);
  expect(await page.evaluate(() => window.helixHeresyDebug.residentCaretakerAction('inspect'))).toBe(true);
  return page.evaluate(f => {
    const d = window.helixHeresyDebug;
    const depot = { city: { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ standing: 'licensed', network: { id: 'transport:b', category: 'transport', roles: ['courierDispatch'], prohibitions: [] },
        branch: { id: 'depot:b', publicName: 'Birch Depot', organizationForm: 'contractDepot', currentCityId: 'b', publicPhysicalPresence: true,
          physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] };
    d.setFieldPorterTestSource(depot);
    const state = d.exportSurveyExpeditionTestState(), e = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    const src = state.fieldStation.site, dest = state.fieldRefuge.site, at = state.clock;
    // Explicit original supplied source node, prior paid engagement and arrived
    // resident are inputs. No delivery, route permission or receipt is supplied.
    const part = src.layout.parts.find(p => p.kind === 'cache'); src.cacheId = 'supply-source-original';
    src.parts[part.id] = { at, physicalId: src.cacheId };
    state.fixtures.push({ id: src.cacheId, typeId: 'storageCrate', origin: src.layout.cache, condition: 100, accessState: 'open', installedAt: at });
    const moved = state.physicalItemStacks.filter(i => i.fixtureId === dest.cacheId && ['trailMeal', 'fuelReagent'].includes(i.key));
    for (const i of moved) { i.fixtureId = src.cacheId; i.roomId = src.roomId; i.cell = src.layout.cache; }
    const filterId = `stack-${state.nextPhysicalItemStackNumber++}`;
    state.physicalItemStacks.push({ id: filterId, key: 'fieldWaterFilter', section: 'inventory', quantity: 1, knownQuantity: 1,
      roomId: src.roomId, cell: src.layout.cache, fixtureId: src.cacheId, sourceLabels: ['Explicit finite paid cartridge input'] });
    const backing = window.HelixFieldPorter.source(depot.city, depot.standings, e), p = window.HelixFieldPorter.create(backing, e, at);
    const c = { source: backing, alive: true, capable: true, originalBody: true, originalTrip: true, bodyEpoch: state.scientistIdentity.bodyEpoch,
      visitId: e.trip.visitId, tripId: e.trip.id, near: true, atGround: true, site: { siteId: src.siteId, worldId: src.worldId, roomId: src.roomId },
      drop: src.layout.apron, dropLegal: true, routeOk: true, hazards: {} };
    const quote = window.HelixFieldPorter.review(p, c, at); if (!window.HelixFieldPorter.hire(p, c, quote, state.economy, at)) return null;
    p.phase = 'onSite'; p.contract.startedAt = at; p.actor.mapCell = src.layout.apron; p.actor.roomId = src.roomId; p.actor.initializedKit = true; e.porter = p;
    const add = (key, quantity, actor) => state.physicalItemStacks.push({ id: `stack-${state.nextPhysicalItemStackNumber++}`, key, quantity, knownQuantity: quantity,
      section: 'inventory', roomId: actor.roomId, cell: actor.mapCell, carriedBy: actor.id, sourceLabels: ['Explicit original personal travel provisions'] });
    add('drinkingWater', 3, p.actor); add('trailMeal', 2, p.actor);
    const b = e.builder, plan = state.fieldRefuge.staffPlan, kit = state.physicalItemStacks.find(i => i.key === 'fieldShelter' && i.carriedBy === 'scientist');
    b.actor.mapCell = plan.sleep; b.actor.roomId = dest.roomId;
    b.resident = { id: 'supplied-prior-residence', actorId: b.actor.id, phase: 'resident', recognizedBodyEpoch: c.bodyEpoch, signedAt: at,
      lastAt: at, arrivedAt: at, endsAt: at + 3 * 86400, earned: 0, restSeconds: 0, deployed: true, service: null, reason: '', log: [], report: null,
      kitId: kit.id, plan };
    kit.carriedBy = ''; kit.roomId = dest.roomId; kit.cell = plan.sleep; kit.reservedTaskId = b.resident.id;
    const heater = state.fixtures.find(i => i.id === dest.heaterId); heater.utility.enabled = true; heater.utility.fuel = 1;
    d.importSurveyExpeditionTestState(state);
    return { ...f, source: src, destination: dest, mealId: moved.find(i => i.key === 'trailMeal').id,
      fuelId: moved.find(i => i.key === 'fuelReagent').id, filterId, porterId: p.actor.id, residentId: b.actor.id, startedAt: p.contract.startedAt };
  }, f);
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: exact whole-load supply trip, access interruption, saved custody, resident consumption and dated return report`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, renderer); expect(f).toBeTruthy();
  console.info(`${renderer}: prepared original supplied nodes and finite employed people.`);
  expect(await act(page, 'inspectDestination')).toBe(true);
  expect(await act(page, 'append', { stackId: f.mealId })).toBe(false);
  await walk(page, f.source.roomId, f.source.layout.rest); expect(await act(page, 'inspectSource')).toBe(true);
  await walk(page, f.source.roomId, f.source.layout.door);
  for (const id of [f.mealId, f.mealId, f.fuelId, f.filterId]) {
    const ok = await act(page, 'append', { stackId: id }), state = await snap(page);
    const details = ok ? '' : JSON.stringify({ phase: state.saved.phase, reason: state.saved.contract.reason, context: state.context,
      supply: await page.evaluate(() => window.helixHeresyDebug.fieldSupplySnapshot()) });
    expect(ok, details).toBe(true);
  }
  const proposed = (await snap(page)).saved.supplyPreview;
  expect(await act(page, 'accept', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept exact one-round-trip supply order', exact: true }).click();
  let s = await snap(page); const id = s.saved.supplyLeg.id, rows = s.saved.supplyLeg.rows;
  console.info(`${renderer}: accepted exact four-unit supply load.`);
  expect(rows).toHaveLength(4); expect(new Set(rows.map(r => r.stackId)).size).toBe(4);
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldPorterAction('assign', { stackId: 'unused' }))).toBe(false);
  await walk(page, f.room, { ...f.home, x: 13, y: 11 });
  s = await until(page, s => s.saved.supplyLeg.phase === 'unload' && s.saved.supplyLeg.rows.every(r => r.phase === 'carried'));
  console.info(`${renderer}: loaded all four original units; walking to the refuge.`);
  expect(s.stacks.filter(i => rows.some(r => r.stackId === i.id)).every(i => i.carriedBy === f.porterId && !i.fixtureId)).toBe(true);
  // Actual storage closure, not a random interruption, retains the whole load.
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.fixtures.find(i => i.id === id).accessState = 'closed'; d.importSurveyExpeditionTestState(s); }, f.destination.cacheId);
  s = await until(page, s => s.saved.supplyLeg.reason.includes('unavailable'));
  expect(s.actor.mapCell).toEqual(f.destination.layout.rest); const partial = s.saved.supplyLeg;
  console.info(`${renderer}: physically reached the closed destination; original load retained.`);
  expect(partial.rows.every(r => r.phase === 'carried')).toBe(true);
  await reload(page, renderer); expect((await snap(page)).saved.supplyLeg).toEqual(partial);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.fixtures.find(i => i.id === id).accessState = 'open'; d.importSurveyExpeditionTestState(s); }, f.destination.cacheId);
  s = await until(page, s => s.saved.supplyLeg.status === 'completed');
  console.info(`${renderer}: physically deposited the load and returned to the station.`);
  expect(s.saved.supplyLeg.id).toBe(id); expect(s.saved.supplyLeg.deliveredAt).toBeLessThan(s.saved.supplyLeg.returnedAt);
  expect(s.saved.contract.startedAt).toBe(f.startedAt); expect(s.saved.contract.earned).toBeGreaterThan(0); expect(s.known.received).toBeNull();
  for (const r of rows) expect(s.stacks.find(i => i.id === r.stackId)).toMatchObject({ fixtureId: f.destination.cacheId, quantity: 1, reservedTaskId: '', carriedBy: '' });
  expect(s.stacks.find(i => i.id === f.mealId).quantity).toBe(2); expect(s.stacks.find(i => i.id === f.fuelId).quantity).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldPorterAction('report'))).toBe(false);
  // The existing resident physically collects and consumes delivered food.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const b = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder; b.actor.needs.hunger = 60;
    for (const i of state.physicalItemStacks.filter(i => i.carriedBy === b.actor.id && i.key === 'trailMeal')) i.reservedTaskId = 'explicit-unavailable-personal-meals';
    d.importSurveyExpeditionTestState(state);
  });
  await tick(page, 60); const resident = await page.evaluate(() => window.helixHeresyDebug.residentCaretakerSnapshot());
  expect(resident.saved.actor.needs.hunger).toBeLessThan(45); expect(resident.saved.resident.phase).toBe('resident');
  s = await snap(page); expect(s.stacks.filter(i => rows.some(r => r.stackId === i.id) && i.key === 'trailMeal')).toHaveLength(1);
  await walk(page, f.source.roomId, f.source.layout.door);
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldPorterAction('report'))).toBe(true);
  const report = (await snap(page)).known.received; expect(report.supplyLeg.status).toBe('completed');
  await tick(page, 20); expect((await snap(page)).known.received).toEqual(report);
  await reload(page, renderer); expect((await snap(page)).known.received).toEqual(report);
  expect(errors).toEqual([]);
});
test('dom: cancelled exact food remains client cargo through physical withdrawal, reload and personal handback', async ({ page }) => {
  const f = await setup(page, 'dom');
  expect(await act(page, 'inspectDestination')).toBe(true);
  await walk(page, f.source.roomId, f.source.layout.rest);
  expect(await act(page, 'inspectSource')).toBe(true);
  await walk(page, f.source.roomId, f.source.layout.door);
  expect(await act(page, 'append', { stackId: f.mealId })).toBe(true);
  const expected = (await snap(page)).saved.supplyPreview;
  expect(await act(page, 'accept', { expected })).toBe(true);
  let s = await until(page, s => s.saved.supplyLeg.rows[0].phase === 'carried', 140, 1);
  const retainedId = s.saved.supplyLeg.rows[0].stackId;
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldPorterAction('cancel')),
    JSON.stringify({ context: s.context, actor: s.actor, scientist: s.scientistCell })).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const p = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.porter;
    p.actor.needs.hunger = 60;
    for (const i of state.physicalItemStacks.filter(i => i.carriedBy === p.actor.id && i.key === 'trailMeal'
      && !p.supplyLeg.rows.some(r => r.stackId === i.id))) i.reservedTaskId = 'explicit-unavailable-personal-meals';
    d.importSurveyExpeditionTestState(state);
  });
  // The scientist must physically clear the only hut doorway first.
  await walk(page, f.room, { ...f.home, x: 13, y: 11 });
  await tick(page, 60); s = await snap(page);
  expect(s.saved.phase).toBe('awaitingSettlement');
  expect(s.stacks.find(i => i.id === retainedId)).toMatchObject({ carriedBy: f.porterId, quantity: 1 });
  expect(s.actor.needs.hunger).toBeGreaterThan(45);
  await reload(page, 'dom');
  expect(await page.evaluate(stackId => window.helixHeresyDebug.fieldPorterAction('cargo', { stackId }), retainedId)).toBe(true);
  expect((await snap(page)).stacks.find(i => i.id === retainedId).carriedBy).toBe('scientist');
});
