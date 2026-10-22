const { test, expect } = require('@playwright/test');
const { reload } = require('./helpers/field-station');
test.setTimeout(1800000);
const { setup, snap, act, tick, walk, until } = require('./helpers/away-operation');
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
