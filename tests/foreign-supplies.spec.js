const { test, expect } = require('@playwright/test');
const Supplies = require('../foreign-supplies');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.use({ actionTimeout: 15000 });
const copy = v => JSON.parse(JSON.stringify(v));
const city = () => ({ cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', services: { provisioning: 'functional', transport: 'functional' } });
const standings = () => [{ network: { id: 'commerce:b', category: 'commercial', roles: ['procurement'] }, standing: 'licensed',
  branch: { id: 'supplier:b', cityId: 'b', publicName: 'Neighbor Provision Depot', capacityBand: 'functional', operationalStatus: 'active' } }];
const defs = [{ id: 'drinkingWater', label: 'Sealed Drinking Water', basePrice: 4, supply: 40, liquidity: 16 },
  { id: 'fieldRation', label: 'Field Provision Pack', basePrice: 12, supply: 50, liquidity: 24 }];
function fixture() {
  const input = { city: city(), standings: standings() };
  const s = Supplies.create(input.city, input.standings, 0, { roomId: 'hall', cell: { x: 18, y: 7, z: 22 } });
  const m = { id: 'b', treasury: 10000, listings: { drinkingWater: { supply: 12, demand: 1 }, fieldRation: { supply: 10, demand: 1 } } };
  const c = { alive: true, capable: true, local: true, atCounter: true, atOuter: false, contact: true, providerCurrent: true,
    bodyEpoch: 0, visitId: 'original-trip', busy: false, permit: { id: 'permit', expiresAt: 21600 }, routeSeconds: 20,
    remaining: { massKg: 20, volumeL: 30 }, supplierRemaining: { massKg: 18, volumeL: 24 }, metrics: { massKg: 1, volumeL: 1 } };
  let allocations = 0, transfers = 0, collected = false;
  const hooks = { allocate: () => `paid-lot-${++allocations}`, custody: () => true, move: () => ({ done: true }),
    collect: () => { collected = true; return true; }, handoff: () => collected ? `received-${++transfers}` : null };
  return { s, m, c, hooks, input, wallet: { money: 1000 }, get allocations() { return allocations; }, get transfers() { return transfers; } };
}
function buy(f, n = 2) { const q = Supplies.quote(f.s, f.m, defs[0], n, f.c, 0); expect(q).not.toBeNull(); expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 0, f.hooks)).toBe(true); return q; }
test('supplier requires its own lawful current physical commercial branch and actual population', () => {
  const f = fixture(), before = JSON.stringify(f.input);
  expect(f.s.actor.id).toBe('supplier:b:visitor-supplier'); expect(JSON.stringify(f.input)).toBe(before);
  for (const alter of [v => v.standings[0].standing = 'recognized', v => v.standings[0].branch.cityId = 'a',
    v => v.standings[0].branch.operationalStatus = 'disrupted', v => v.standings[0].branch.publicPhysicalPresence = false,
    v => v.city.currentPopulation = 2, v => delete v.city.currentPopulation, v => v.city.physicalCondition = 'ruined', v => v.standings[0].network.category = 'transport']) {
    const v = copy(f.input); alter(v); expect(Supplies.create(v.city, v.standings, 0, { cell: {}, roomId: 'hall' })).toBeNull();
  }
});
test('exact market ask changes with scarcity; changed quotes, six-unit limit and actual capacities prevent charging', () => {
  const f = fixture(), q = Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0);
  f.m.listings.drinkingWater.supply /= 2;
  expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0).unitPrice).toBeGreaterThan(q.unitPrice);
  expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 1, f.hooks)).toBe(false); expect(f.wallet.money).toBe(1000); expect(f.allocations).toBe(0);
  expect(Supplies.quote(f.s, f.m, defs[0], 7, f.c, 1)).toBeNull();
  f.c.remaining.massKg = 1; expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 1)).toBeNull();
  f.c.remaining.massKg = 20; f.c.supplierRemaining.volumeL = 1; expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 1)).toBeNull();
});
test('payment removes original city stock once but gives title only; no duplicate outstanding purchase', () => {
  const f = fixture(), q = buy(f); expect(f.m.listings.drinkingWater.supply).toBe(10);
  expect(f.wallet.money).toBe(1000 - q.total); expect(f.m.treasury).toBe(10000 + q.total - 4); expect(f.s.handlingRevenue).toBe(4);
  expect(f.transfers).toBe(0); expect(f.s.orders[0].stackId).toBe('paid-lot-1'); expect(f.s.powerSeconds).toBe(1799);
  expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 1, f.hooks)).toBe(false);
  expect(Supplies.quote(f.s, f.m, defs[0], 1, f.c, 1)).toBeNull(); expect(f.allocations).toBe(1);
});
test('finite collection then thirty-second unit handoffs retain partial custody and exactly-once receipts after save', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 89, f.hooks); expect(f.transfers).toBe(0);
  Supplies.advance(f.s, f.c, 90, f.hooks); expect(f.transfers).toBe(1); expect(f.s.orders[0].delivered).toBe(1);
  f.s = copy(f.s); Supplies.advance(f.s, f.c, 120, f.hooks); expect(f.s.orders[0].status).toBe('received');
  expect(f.s.orders[0].receipts.map(r => r.at)).toEqual([90, 120]); expect(f.transfers).toBe(2);
  Supplies.advance(f.s, f.c, 999, f.hooks); expect(f.transfers).toBe(2); expect(f.s.workSeconds).toBe(14400 - 120);
});
test('absence, outage and physical obstruction pause without refund, free stock or retroactive duty', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 20, f.hooks);
  f.c.atCounter = false; Supplies.advance(f.s, f.c, 200, f.hooks); expect(f.s.orders[0].progress).toBe(20);
  f.c.atCounter = true; Supplies.advance(f.s, f.c, 300, f.hooks); expect(f.s.orders[0].progress).toBe(20);
  f.hooks.move = () => ({ blocked: 'door locked' }); Supplies.advance(f.s, f.c, 301, f.hooks);
  expect(f.s.orders[0].delay).toBe('door locked'); expect(f.s.workSeconds).toBe(14380);
  f.c.providerCurrent = false; Supplies.advance(f.s, f.c, 1000, f.hooks); expect(f.transfers).toBe(0);
  expect(f.m.listings.drinkingWater.supply).toBe(10); expect(f.s.provisionsSeconds).toBe(27800);
});
test('expired admission leaves paid goods; explicit original-body outer collection needs physical attendance', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 90, f.hooks);
  f.c.permit = null; Supplies.advance(f.s, f.c, 100, f.hooks); expect(f.s.orders[0].delivered).toBe(1);
  expect(Supplies.outer(f.s, { ...f.c, atOuter: false, at: 100 })).toBe(false);
  f.c.atCounter = false; f.c.atOuter = true; expect(Supplies.outer(f.s, { ...f.c, at: 100 })).toBe(true);
  Supplies.advance(f.s, f.c, 101, f.hooks); Supplies.advance(f.s, f.c, 131, f.hooks);
  expect(f.s.orders[0].status).toBe('received'); expect(f.s.orders[0].delivered).toBe(2);
});
test('expiry, poor funds and exhausted actual stores or staff offer no purchase or replenishment', () => {
  const f = fixture(); const q = Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0);
  expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 60, f.hooks)).toBe(false);
  f.wallet.money = 0; expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 1, f.hooks)).toBe(false);
  f.c.permit.expiresAt = 100; expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0)).toBeNull();
  f.c.permit.expiresAt = 21600; f.m.listings.drinkingWater.supply = 0; expect(Supplies.quote(f.s, f.m, defs[0], 1, f.c, 0)).toBeNull();
  Supplies.advance(f.s, f.c, 30000, f.hooks); expect(f.m.listings.drinkingWater.supply).toBe(0); expect(f.s.provisionsSeconds).toBe(0);
  expect(Supplies.quote(f.s, f.m, defs[1], 1, f.c, 30000)).toBeNull();
});
test('death freezes work and original custody, while replacement bodies cannot inherit handoffs', () => {
  const f = fixture(); buy(f); const frozen = JSON.stringify(f.s);
  Supplies.advance(f.s, { ...f.c, alive: false }, 1000, f.hooks); expect(JSON.stringify(f.s)).toBe(frozen);
  f.c.bodyEpoch = 1; Supplies.advance(f.s, f.c, 1000, f.hooks);
  expect(f.s.orders[0].status).toBe('bodyLost'); expect(f.transfers).toBe(0);
  expect(Supplies.outer(f.s, { ...f.c, atOuter: true, at: 1000 })).toBe(false);
});
test('received knowledge stays dated away and cannot expose private foreign stocks or later outcomes', () => {
  const f = fixture(); buy(f); const v = copy(Supplies.observe(f.s, f.c, f.m, defs, 0));
  f.m.listings.drinkingWater.supply = 0; Supplies.advance(f.s, f.c, 120, f.hooks);
  expect(Supplies.observe(f.s, { ...f.c, contact: false }, f.m, defs, 120)).toEqual(v);
  expect(JSON.stringify(v)).not.toContain('productionSources'); expect(JSON.stringify(v)).not.toContain('treasury');
});
test('missing lot, new pack limits and finite provision exhaustion retain paid partial custody', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 90, f.hooks);
  f.hooks.handoff = () => null; Supplies.advance(f.s, f.c, 120, f.hooks);
  expect(f.s.orders[0].delivered).toBe(1); expect(f.s.orders[0].status).toBe('delivering');
  f.hooks.custody = () => false; Supplies.advance(f.s, f.c, 121, f.hooks); Supplies.advance(f.s, f.c, 122, f.hooks);
  expect(f.s.orders[0].delay).toContain('actual paid lot'); expect(f.transfers).toBe(1); expect(f.m.listings.drinkingWater.supply).toBe(10);
  const h = fixture(); buy(h); h.s.provisionsSeconds = 30; Supplies.advance(h.s, h.c, 100, h.hooks);
  expect(h.s.orders[0].progress).toBe(30); expect(h.s.provisionsSeconds).toBe(0); expect(h.transfers).toBe(0);
});

function identityFixture() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], ctx = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, ctx, -1800); Civic.advance(identity, m.identityOffices, ctx, 0);
  return { identity, offices: m.identityOffices };
}
async function finish(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let i = 0; i < 12; i++) {
    const s = d.intercityPassengerSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
    d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
  } throw new Error('Queued physical work did not finish'); });
}
async function enter(page, renderer, sales = false) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ f, city, standings, renderer, sales }) => {
    const d = window.helixHeresyDebug;
    const network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    d.setIntercityPassengerTestContext({ city: { ...city, cityId: 'a', assetId: 'a' }, network,
      standings: [{ network: { id: 'transport:a', category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Passenger Depot', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer); d.setForeignReceptionTestContext({ source: { ...city, administrationId: 'admin:b', administrationName: 'Neighbor Administration',
      watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] }, ...f });
    d.setForeignSuppliesTestContext({ city, standings, carriedMetalParts: sales ? 6 : 0, market: { id: 'b', listings: { drinkingWater: { supply: 12, demand: 1 }, fieldRation: { supply: 10, demand: 1 }, metalParts: { supply: 60, demand: 1 } } } });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
  }, { f: identityFixture(), city: city(), standings: standings(), renderer, sales });
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(true); await finish(page);
  if (!await page.locator('[data-intercity-passenger]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Walk to Visitor Provisions Counter', exact: true }).click(); await finish(page);
}
for (const renderer of ['dom', 'canvas']) test(`foreign food/water purchase, actual supplier walking and saved partial handoff through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await enter(page, renderer);
  const snapshot = () => page.evaluate(() => window.helixHeresyDebug.foreignSuppliesSnapshot('drinkingWater', 2));
  const before = await snapshot(); expect(before.quote).not.toBeNull(); expect(before.context.atCounter).toBe(true);
  const carrier = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier);
  await page.getByLabel('Sealed Drinking Water purchase quantity').selectOption('2');
  await page.getByRole('button', { name: 'Buy Sealed Drinking Water at Exact Quoted Total', exact: true }).click();
  const paid = await snapshot(); expect(paid.market.listings.drinkingWater.supply).toBe(10); expect(paid.money).toBe(before.money - before.quote.total);
  expect(paid.carried).toEqual(before.carried); expect(paid.supplier.orders[0].delivered).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(10));
  expect((await snapshot()).supplier.actor.mapCell).not.toEqual(before.supplier.actor.mapCell);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180, true));
  const partial = await snapshot();
  expect(partial.supplier.orders[0].receipts).toHaveLength(1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  const received = await snapshot(); expect(received.supplier.orders[0].status).toBe('received'); expect(received.supplier.orders[0].receipts).toHaveLength(2);
  expect(received.carried.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0)).toBe(before.carried.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0) + 2);
  const afterCarrier = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier);
  expect(afterCarrier.vehicle).toEqual(carrier.vehicle); expect(afterCarrier.driver).toEqual(carrier.driver); expect(afterCarrier.provisionsSeconds).toBeLessThan(carrier.provisionsSeconds);
  expect(await page.evaluate(n => { const d = window.helixHeresyDebug, q = d.foreignSuppliesSnapshot('fieldRation', n).quote; return d.foreignSupplyAction('buy', { quote: q }); }, renderer === 'dom' ? 2 : 1)).toBe(true);
  if (renderer === 'dom') {
    await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180, true));
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
    await page.evaluate(() => { const d = window.helixHeresyDebug, r = d.foreignReceptionSnapshot(); d.advanceForeignReceptionTestTime(r.permission.expiresAt - r.clock); });
    expect((await snapshot()).supplier.orders[1].delivered).toBe(1);
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignSupplyAction('outer'))).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
    expect((await snapshot()).supplier.orders[1].target).toBe('outer');
  } else await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
  expect((await snapshot()).supplier.orders[1].status).toBe('received');
  const packCount = (await snapshot()).carried.filter(i => i.key === 'fieldRation').reduce((n, i) => n + i.quantity, 0);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSupplyAction('consume'))).toBe(true); await finish(page);
  expect((await snapshot()).carried.filter(i => i.key === 'fieldRation').reduce((n, i) => n + i.quantity, 0)).toBe(packCount - 1);
  expect(errors).toEqual([]);
});
for (const renderer of ['dom', 'canvas']) test(`foreign exact carried sale, saved custody, market receipt and observed chart through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await enter(page, renderer, true);
  const snapshot = () => page.evaluate(() => window.helixHeresyDebug.foreignSaleSnapshot());
  const before = await snapshot(), lot = before.carried.find(i => i.key === 'metalParts'); expect(lot?.quantity).toBe(6);
  const q = await page.evaluate(id => window.helixHeresyDebug.foreignSaleSnapshot(id, 2).quote, lot.id); expect(q).not.toBeNull();
  const carrier = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier);
  await expect(page.locator('[data-foreign-bid-chart="metalParts"]')).toHaveAttribute('aria-label', /No unseen price history/);
  await page.getByLabel(`${lot.id} metal-parts sale quantity`).selectOption('2');
  await page.getByRole('button', { name: `Sell ${lot.id} at Exact Quoted Net`, exact: true }).click();
  const booked = await snapshot(), order = booked.supplier.orders[0];
  expect(order.kind).toBe('sale'); expect(booked.money).toBe(before.money); expect(booked.market.treasury).toBe(before.market.treasury - q.gross);
  expect(booked.market.listings.metalParts.supply).toBe(before.market.listings.metalParts.supply);
  expect(booked.carried.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0)).toBe(6);
  expect(booked.carried.find(i => i.id === order.stackId).reservedTaskId).toBe(order.id);
  expect(booked.carried.find(i => i.id === lot.id).reservedTaskId).toBe('');
  // The original selected quote cannot sell a second slice or replenish anything.
  expect(await page.evaluate(q => window.helixHeresyDebug.foreignSupplyAction('sell', { quote: q }), q)).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180, 'handoff'));
  const handed = await snapshot(); expect(handed.supplier.orders[0].handed).toBe(1); expect(handed.money).toBe(before.money);
  const custody = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks);
  expect(custody.find(i => i.id === handed.supplier.orders[0].lots[0]).cityOwnerId).toBe('b');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(240, true));
  const partial = await snapshot(); expect(partial.supplier.orders[0].receipts).toHaveLength(1);
  expect(partial.money).toBe(before.money + q.unitPrice - 4); expect(partial.market.listings.metalParts.supply).toBe(before.market.listings.metalParts.supply + 1);
  expect(partial.supplier.orders[0].escrow).toBe(q.unitPrice);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  const received = await snapshot(); expect(received.supplier.orders[0].status).toBe('received'); expect(received.money).toBe(before.money + q.net);
  expect(received.supplier.orders[0].escrow).toBe(0); expect(received.supplier.handlingRevenue).toBe(4);
  expect(received.carried.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0)).toBe(4);
  expect(received.market.listings.metalParts.supply).toBe(before.market.listings.metalParts.supply + 2);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60)); expect((await snapshot()).money).toBe(received.money);
  const afterCarrier = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier);
  expect(afterCarrier.vehicle).toEqual(carrier.vehicle); expect(afterCarrier.driver).toEqual(carrier.driver); expect(afterCarrier.provisionsSeconds).toBeLessThan(carrier.provisionsSeconds);
  if (renderer === 'dom') {
    const secondLot = received.carried.find(i => i.key === 'metalParts' && !i.reservedTaskId);
    expect(await page.evaluate(id => { const d = window.helixHeresyDebug; return d.foreignSupplyAction('sell', { quote: d.foreignSaleSnapshot(id, 2).quote }); }, secondLot.id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180, 'handoff'));
    expect((await snapshot()).supplier.orders[1].handed).toBe(1);
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
    await page.evaluate(() => { const d = window.helixHeresyDebug, r = d.foreignReceptionSnapshot(); d.advanceForeignReceptionTestTime(r.permission.expiresAt - r.clock); });
    const expired = await snapshot(); expect(expired.context.permit).toBeNull(); expect(expired.supplier.orders[1].handed).toBe(1); expect(expired.money).toBe(received.money);
    expect(await page.evaluate(() => window.helixHeresyDebug.foreignSupplyAction('outer'))).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(420));
    const completed = await snapshot(); expect(completed.supplier.orders[1].status).toBe('received'); expect(completed.supplier.orders[1].target).toBe('outer');
    expect(completed.money).toBe(received.money + completed.supplier.orders[1].quote.net);
  }
  expect(errors).toEqual([]);
});
