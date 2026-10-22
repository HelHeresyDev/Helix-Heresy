const { test, expect } = require('@playwright/test');
const { fixture: refugeFixture } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(1800000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.awayOperationSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.awayOperationAction(action, options), { action, options });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceAwayOperationForTest(n), n);
async function walk(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 8; n++) {
    if (!(await snap(page)).tasks.length) return;
    await page.evaluate(() => window.helixHeresyDebug.advanceAwayOperationForTest(120, { stopOnIdle: true }));
  }
  throw Error(`Scientist walk blocked: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function until(page, predicate, limit = 180, step = 10) {
  for (let n = 0; n < limit; n++) {
    const s = await snap(page); if (predicate(s)) return s;
    if (n % 30 === 0) console.info(`Local freight: ${s.saved.mission.phase}, ${JSON.stringify(s.driver?.mapCell)}, ${s.saved.mission.progress}`);
    await tick(page, step);
  }
  const s = await snap(page);
  throw Error(`Local operation stalled: ${JSON.stringify({ saved: s.saved, driver: s.driver, context: { ...s.context, definitions: undefined }, items: s.items })}`);
}
async function setup(page, renderer) {
  page.setDefaultTimeout(30000);
  const f = await refugeFixture(page, renderer);
  console.info(`${renderer}: original refuge fixture ready`);
  expect(await page.evaluate(() => window.helixHeresyDebug.residentCaretakerAction('inspect'))).toBe(true);
  const result = await page.evaluate(f => {
    const d = window.helixHeresyDebug;
    const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } };
    const standings = [{ standing: 'licensed', network: { id: 'commercial:b', category: 'commercial', roles: ['procurement'], prohibitions: [] },
      branch: { id: 'supplier:b', publicName: 'Birch Supply', currentCityId: 'b', publicPhysicalPresence: true,
        physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }];
    d.setForeignSuppliesTestContext({ city, standings, market: { listings: { drinkingWater: { supply: 50, demand: 1 }, trailMeal: { supply: 50, demand: 1 } } } });
    const s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b'), e = g.foreignSurvey;
    const dest = s.fieldRefuge.site, b = e.builder, at = s.clock, plan = s.fieldRefuge.staffPlan;
    // Prior residence, original finite merchant/producer stock and personal
    // provisions are inputs. No operation, consignment or viability is injected.
    const kit = s.physicalItemStacks.find(i => i.key === 'fieldShelter' && i.carriedBy === 'scientist');
    b.actor.mapCell = plan.sleep; b.actor.roomId = dest.roomId;
    b.resident = { id: 'original-prior-residence', actorId: b.actor.id, phase: 'resident', recognizedBodyEpoch: s.scientistIdentity.bodyEpoch,
      signedAt: at, lastAt: at, arrivedAt: at, endsAt: at + 3 * 86400, earned: 0, restSeconds: 0, deployed: true, service: null, reason: '', log: [], report: null,
      kitId: kit.id, plan };
    kit.carriedBy = ''; kit.roomId = dest.roomId; kit.cell = plan.sleep; kit.reservedTaskId = b.resident.id;
    for (const i of s.physicalItemStacks) if (['drinkingWater', 'trailMeal'].includes(i.key) && (i.carriedBy === b.actor.id || i.fixtureId === dest.cacheId)) i.quantity = i.knownQuantity = 1;
    const heater = s.fixtures.find(i => i.id === dest.heaterId); heater.utility.enabled = true; heater.utility.fuel = 1;
    const counter = { x: 12, y: 10, z: e.entry.z }, stand = { ...counter, x: 13 }, away = { ...counter, y: 12, x: 15 };
    g.visitorSupplies = window.HelixForeignSupplies.create(city, standings, at, { roomId: e.roomId, cell: counter });
    for (const key of ['drinkingWater', 'trailMeal']) s.physicalItemStacks.push({ id: `stack-${s.nextPhysicalItemStackNumber++}`, key, quantity: 6, knownQuantity: 6,
      section: 'inventory', carriedBy: 'scientist', roomId: dest.roomId, cell: dest.layout.rest, sourceLabels: ['Original paid personal provisions fixture'] });
    s.wildernessSurvival.autoCare = true;
    d.importSurveyExpeditionTestState(s);
    return { ...f, stand, away, counter, plan };
  }, f);
  expect(await act(page, 'inspect'), JSON.stringify(await snap(page))).toBe(true);
  console.info(`${renderer}: original staffed refuge inspected`);
  await walk(page, result.room, result.stand);
  console.info(`${renderer}: personally reached original local supplier`);
  return result;
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('local-operation', { body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
for (const renderer of ['canvas', 'dom']) test(`${renderer}: local native contract, physical delivery, saved original cargo and full supported day during absence`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await setup(page, renderer);
  const before = await snap(page);
  await page.getByRole('button', { name: 'Review local refuge supply terms', exact: true }).click();
  expect(errors).toEqual([]);
  let s = await snap(page); expect(s.saved.quote, JSON.stringify({ context: { ...s.context, definitions: undefined },
    binding: [s.saved.worldId, s.saved.runId, s.saved.bodyEpoch], routeLength: s.saved.plan.route.length,
    market: { id: s.market.id, listings: s.market.listings, profile: s.market.profile, production: s.market.production } })).toBeTruthy(); const q = s.saved.quote;
  console.info(`${renderer}: actual supplier quote received`);
  await page.getByRole('spinbutton', { name: 'Local operating allowance deposit' }).fill('300');
  await page.getByRole('button', { name: 'Accept exact local supply order and commit allowance', exact: true }).click();
  s = await snap(page); expect(s.saved.mission.phase).toBe('outbound'); expect(s.money).toBe(before.money - 300);
  console.info(`${renderer}: original driver contracted from actual local stock`);
  expect(s.market.listings.drinkingWater.supply).toBe(before.market.listings.drinkingWater.supply - 7);
  expect(s.market.listings.trailMeal.supply).toBe(before.market.listings.trailMeal.supply - 4);
  await walk(page, f.room, f.away);
  expect((await snap(page)).context.atProvider).toBe(false);
  s = await until(page, s => s.saved.mission.phase === 'walk');
  console.info(`${renderer}: original driver physically loaded original cargo`);
  const driverId = s.driver.id, stackIds = s.items.map(i => i.id), contractId = s.saved.mission.id;
  expect(stackIds).toHaveLength(2); expect(s.items.every(i => i.carriedBy === driverId)).toBe(true);
  await reload(page, renderer); s = await snap(page);
  expect(s.driver.id).toBe(driverId); expect(s.items.map(i => i.id)).toEqual(stackIds); expect(s.items.every(i => i.carriedBy === driverId)).toBe(true);
  console.info(`${renderer}: saved original carrier custody restored`);
  s = await until(page, s => s.saved.mission.phase === 'returned');
  expect(s.saved.mission.id).toBe(contractId); expect(s.saved.mission.deliveredAt).not.toBeNull();
  expect(s.items.every(i => !i.carriedBy && i.fixtureId === 'resident-original-cache')).toBe(true);
  expect(s.market.production.trucks.find(t => t.driver.id === driverId).shipment).toBeNull();
  expect(s.saved.balance).toBe(300 - q.total); expect(s.money).toBe(before.money - 300);
  const dated = s.saved.report;
  // Same actual resident/stock/needs/heater simulation, bounded minute segments
  // while off map. No injected viability timestamp or consumption outcome.
  for (let n = 0; n < 25; n++) { await tick(page, 3600); if (n % 6 === 0) {
    const p = await snap(page); console.info(`${renderer}: supported absence ${n + 1}h; continuity ${p.saved.continuityFrom}, consumed ${p.saved.consumed.length}, exertion ${p.resident.actor.needs.exertion}`);
  } }
  s = await snap(page);
  expect(s.saved.viableAt, JSON.stringify({ saved: s.saved, context: { ...s.context, definitions: undefined }, needs: s.resident.actor.needs })).not.toBeNull();
  expect(s.saved.consumed.length).toBeGreaterThan(0); expect(s.resident.resident.phase).toBe('resident');
  expect(s.saved.report).toEqual(dated); expect(s.money).toBe(before.money - 300); expect(s.saved.spent).toBe(q.total);
  await walk(page, f.room, f.stand); expect(await act(page, 'refund')).toBe(true);
  expect((await snap(page)).money).toBe(before.money - q.total);
  await walk(page, f.wildRoom, f.l.rest); expect(await act(page, 'report')).toBe(true);
  s = await snap(page); expect(s.saved.report.viableAt).toBe(s.saved.viableAt);
  expect(await page.evaluate(() => window.helixHeresyDebug.expansionAtlasSnapshot())).toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ id: `away:${s.saved.plan.siteId}` })]) });
  expect(errors).toEqual([]);
});
test('original driver incapacity retains purchased carried goods and blocks replacement, refund and free support', async ({ page }) => {
  const f = await setup(page, 'dom'); expect(await act(page, 'review')).toBe(true);
  const q = (await snap(page)).saved.quote; expect(await act(page, 'accept', { expected: q, deposit: 300 })).toBe(true);
  await walk(page, f.room, f.away); await until(page, s => s.saved.mission.phase === 'walk');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), m = s.awayOperation.mission;
    const truck = s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production.trucks.find(t => t.id === m.truckId);
    truck.driver.health = 10; d.importSurveyExpeditionTestState(s);
  });
  await tick(page, 1); const stopped = await snap(page); expect(stopped.saved.mission.phase).toBe('stranded');
  expect(stopped.items.every(i => i.carriedBy === stopped.driver.id)).toBe(true);
  await reload(page, 'dom'); await tick(page, 3600); const after = await snap(page);
  expect(after.items.map(i => i.id)).toEqual(stopped.items.map(i => i.id)); expect(after.saved.mission.deliveredAt).toBeNull();
  expect(after.market.production.trucks).toHaveLength(2); expect(after.saved.viableAt).toBeNull();
  await walk(page, f.room, f.stand); expect(await act(page, 'refund')).toBe(false); expect(await act(page, 'review')).toBe(false);
});
