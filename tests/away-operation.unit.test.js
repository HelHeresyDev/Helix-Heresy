const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../away-operation');
const P = require('../local-market-production');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const plan = { worldId: 'world', siteId: 'refuge', cityId: 'b', cacheId: 'crate', residentId: 'resident', residentActorId: 'resident', label: 'Original refuge',
    route: [{ x: 1, y: 1, z: 5 }, { x: 2, y: 1, z: 5 }, { x: 3, y: 1, z: 5 }], port: { x: 3, y: 1, z: 5 } };
  const binding = { worldId: 'world', runId: 'run', bodyEpoch: 0 };
  const definitions = Object.keys(A.GOODS).map(id => ({ id, basePrice: 8, supply: 40 }));
  const profile = { cityId: 'b', listings: Object.fromEntries(definitions.map(d => [d.id, { targetSupply: 40 }])), productionSources: [], commodityDefinitions: definitions };
  const market = { id: 'b', profile, reserveFraction: .6, production: P.create(profile), listings: Object.fromEntries(definitions.map(d => [d.id, { supply: 40, demand: 1 }])) };
  const c = { ...binding, alive: true, capable: true, free: true, atProvider: true, providerReady: true, sourceCurrent: true,
    planCurrent: true, routeOpen: true, routeKnown: true, walkable: true, distanceKm: 2, residentReady: true,
    storageOpen: true, storageRemaining: { massKg: 250, volumeL: 300 }, supplierId: 'supplier', branchId: 'branch',
    definitions, metrics: Object.fromEntries(definitions.map(d => [d.id, { massKg: 1, volumeL: 1 }])), groundSafe: true,
    supported: true, provisionsAvailable: true, heatAvailable: true, threatened: false, personalInspection: false, scientistAway: true };
  const f = { s: A.create(plan, binding, 0), c, market, wallet: { money: 1000 }, at: 0, deposits: 0 };
  f.h = { arrive(d, t) { d.mapCell = copy(plan.route[0]); t.mapCell = copy(d.mapCell); return true; },
    loadPack() { return true; }, move(d, goal) { d.mapCell.x += Math.sign(goal.x - d.mapCell.x); return true; },
    deposit() { f.deposits++; return true; }, board() { return true; } };
  return f;
}
function context(f) { const t = A.truck(f.s, f.market), d = t?.driver;
  return { ...f.c, atTruck: Boolean(d?.mapCell && d.mapCell.x === t.mapCell?.x), atCrate: d?.mapCell?.x === 3 }; }
function tick(f, n = 1) { f.at += n; A.advance(f.s, f.market, context(f), f.at, f.h); A.audit(f.s, f.c, f.at); }
function accept(f, deposit = 300) { const q = A.quote(f.s, f.market, f.c, f.at); assert.ok(q); assert.equal(A.accept(f.s, f.market, f.c, q, deposit, f.wallet, f.at), true); return q; }
function deliver(f) { accept(f); tick(f, 240); for (let n = 0; n < 200 && !f.s.mission.deliveredAt; n++) tick(f); assert.ok(f.s.mission.deliveredAt); }
test('local allowance, actual local stock, original assets and producer/exchange receipts conserve value', () => {
  const f = fixture(), before = copy(f.market), q = accept(f);
  assert.equal(f.wallet.money, 700); assert.equal(f.s.balance, 300 - q.total); assert.equal(f.s.spent, q.total);
  assert.equal(f.market.production.finance.exchangeMoney - before.production.finance.exchangeMoney, q.goodsCost);
  assert.equal(f.market.production.finance.money - before.production.finance.money, q.freight);
  assert.equal(f.market.listings.drinkingWater.supply, 33); assert.equal(f.market.listings.trailMeal.supply, 36);
  assert.equal(f.market.production.trucks[0].fuelKm, 236); assert.equal(f.market.production.trucks[0].driver.id, before.production.trucks[0].driver.id);
  assert.equal(A.quote(f.s, f.market, f.c, 1), null); assert.equal(f.market.production.shipments[0].externallyManaged, 'awayOperation');
});
test('missing local source, stock reserves, route, capacity, consent, funds or finite original transport prevents purchase', () => {
  for (const change of [f => f.c.sourceCurrent = false, f => f.c.atProvider = false, f => f.c.routeOpen = false,
    f => f.c.routeKnown = false, f => f.c.threatened = true, f => f.c.residentReady = false, f => f.c.storageRemaining.massKg = 2,
    f => f.c.metrics.drinkingWater.massKg = 10, f => f.market.listings.drinkingWater.supply = 25,
    f => f.market.production.trucks.forEach(t => t.shipment = 'other'), f => f.market.production.trucks.forEach(t => t.driver.health = 10),
    f => f.market.production.trucks.forEach(t => t.driver.localProvisionDuty = 5), f => f.market.production.cityId = 'remote-home']) {
    const f = fixture(); change(f); assert.equal(A.quote(f.s, f.market, f.c, 0), null); assert.equal(f.wallet.money, 1000);
  }
  const f = fixture(), q = A.quote(f.s, f.market, f.c, 0); assert.equal(A.accept(f.s, f.market, f.c, q, 0, f.wallet, 0), false);
  assert.equal(A.accept(f.s, f.market, f.c, {}, 300, f.wallet, 0), false);
  f.market.listings.drinkingWater.demand *= 2; assert.equal(A.accept(f.s, f.market, f.c, q, 300, f.wallet, 0), false);
});
test('real loading, walking, closed-storage interruption and same-person return cannot backfill or duplicate goods', () => {
  const f = fixture(); accept(f); tick(f, 240); assert.equal(f.s.mission.phase, 'unload');
  tick(f, 300); assert.equal(f.s.mission.progress, 1); // Coarse elapsed time is not attended loading.
  for (let n = 0; n < 65; n++) tick(f); assert.equal(f.s.mission.phase, 'deposit');
  f.c.storageOpen = false; for (let n = 0; n < 10; n++) tick(f); assert.equal(f.deposits, 0);
  const saved = A.normalize(copy(f.s)); assert.deepEqual(saved, f.s);
  f.c.storageOpen = true; for (let n = 0; n < 61; n++) tick(f); assert.equal(f.deposits, 1);
  for (let n = 0; n < 250; n++) tick(f); assert.equal(f.s.mission.phase, 'returned'); assert.equal(f.deposits, 1);
  assert.equal(f.market.production.trucks[0].shipment, null); assert.equal(f.market.production.trucks[0].fuelKm, 236);
  assert(f.market.production.trucks[0].condition < 100); assert(f.market.production.trucks[0].driver.localProvisionDuty < A.DUTY);
});
test('lost refuge permits physical withdrawal, not trapped bookkeeping or a free arrival', () => {
  const f = fixture(); accept(f); tick(f, 120); f.c.planCurrent = false; tick(f);
  assert.equal(f.s.mission.phase, 'returning'); tick(f, 121); assert.equal(f.s.mission.phase, 'returned');
  assert.equal(f.s.mission.retainedCargo, true); assert.equal(f.market.production.trucks[0].shipment, f.s.mission.id);
  assert.equal(A.quote(f.s, f.market, f.c, f.at), null);
  assert.equal(f.deposits, 0); assert(f.market.production.trucks[0].fuelKm > 236); assert.equal(f.wallet.money, 700);
});
test('dead or incapacitated original driver leaves original cargo and truck unavailable without replacements', () => {
  const f = fixture(); accept(f); tick(f, 240); const t = A.truck(f.s, f.market); t.driver.status = 'dead'; tick(f);
  assert.equal(f.s.mission.phase, 'stranded'); assert.equal(t.shipment, f.s.mission.id); assert.equal(f.market.production.trucks.length, 2);
  assert.equal(f.s.mission.cargo[0].quantity, 7); assert.equal(f.deposits, 0); assert.equal(A.refund(f.s, f.c, f.wallet, f.at), false);
});
test('local money is never drawn remotely; unused allowance settles only personally after the original return', () => {
  const f = fixture(); deliver(f); f.c.atProvider = false;
  for (let n = 0; n < 250; n++) tick(f); assert.equal(f.s.mission.phase, 'returned'); assert.equal(f.wallet.money, 700);
  assert.equal(A.refund(f.s, f.c, f.wallet, f.at), false); f.c.atProvider = true;
  const unused = f.s.balance; assert.equal(A.refund(f.s, f.c, f.wallet, f.at), true); assert.equal(f.wallet.money, 700 + unused);
  assert.equal(A.refund(f.s, f.c, f.wallet, f.at), false); assert.equal(f.s.balance, 0);
});
test('a full supported day requires actual local delivery and consumption; shortages reset continuity without ending life', () => {
  const f = fixture(); A.recordConsumption(f.s, 'resident', 'drinkingWater', 0); assert.equal(f.s.consumed.length, 0);
  deliver(f); A.recordConsumption(f.s, 'stranger', 'drinkingWater', f.at); A.recordConsumption(f.s, 'resident', 'fuelReagent', f.at);
  assert.equal(f.s.consumed.length, 0); A.recordConsumption(f.s, 'resident', 'drinkingWater', f.at);
  const start = f.s.continuityFrom; while (f.at < start + A.DAY) tick(f, 60);
  assert(f.s.viableAt >= start + A.DAY); const earned = f.s.viableAt;
  f.c.provisionsAvailable = false; tick(f); assert.equal(f.s.currentReady, false); assert.equal(f.s.continuityFrom, null);
  assert.equal(f.s.viableAt, earned); assert.equal(f.c.alive, true);
  const skip = fixture(); skip.s.suppliedAt = 0; A.recordConsumption(skip.s, 'resident', 'drinkingWater', 0);
  A.audit(skip.s, skip.c, 0); A.audit(skip.s, skip.c, A.DAY); assert.equal(skip.s.viableAt, null);
  skip.c.scientistAway = false; A.audit(skip.s, skip.c, A.DAY + 1); assert.equal(skip.s.continuityFrom, null);
});
test('save rebinding retains identities, budgets and dated knowledge; death freezes and new runs cannot command originals', () => {
  const f = fixture(); deliver(f); f.c.personalInspection = true; A.receive(f.s, f.c, f.at); const report = copy(f.s.report);
  f.c.personalInspection = f.c.atProvider = false; tick(f, 60); assert.equal(A.receive(f.s, f.c, f.at), false); assert.deepEqual(f.s.report, report);
  const rebound = A.rebind(f.s, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'imported' });
  assert.equal(rebound.runId, 'imported'); assert.deepEqual(rebound.mission, f.s.mission); assert.equal(rebound.balance, f.s.balance);
  assert.equal(A.bound(f.s, { ...f.c, runId: 'new' }), false);
  f.c.alive = false; const before = copy(f.s); tick(f, 600); assert.deepEqual(f.s, before);
});
