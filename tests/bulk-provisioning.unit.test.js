const { test } = require('node:test'), assert = require('node:assert/strict');
const Bulk = require('../bulk-provisioning'), Rule = require('../city-rule');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
const limits = { thresholdDays: 3, targetDays: 3.8, quantityKg: 2000, maxUnitPrice: 10, maxTripSpend: 100000 };
function account(cityId, farms) {
  const source = sources(cityId).operation;
  if (!farms) source.farms = [];
  else { const second = copy(source.farms[0]); second.satelliteId += ':second'; source.farms.push(second); }
  const people = source.institutions.map(i => ({ id: `${i.id}:original`, institutionId: i.id, roles: [i.role], status: 'alive', health: 100 }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: `terms:${cityId}` }));
  const succession = { source: { ...copy(source), authority: { id: source.baselineAuthorityId } }, officeId: `counter:${cityId}`,
    handover: { id: `handover:${cityId}`, bodyEpoch: 0, termsId: `terms:${cityId}` }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: `handover:${cityId}`, bodyEpoch: 0, commandRelationships: copy(agreements) } };
  return { rule: Rule.createAggregate(source, succession, { worldId: 'world', runId: 'run' }, 0, { id: `ward:${cityId}`, initialEnergy: 0 }), succession, people };
}
function attach(f) {
  f.context = e => ({ alive: f.alive, capable: true, local: true, free: true, atCounter: true, reportersPresent: true,
    sourceCurrent: true, bodyEpoch: f.bodyEpoch, institutionsAvailable: !f.staffUnavailable?.includes(e.rule.source.cityId),
    coverageVerified: true, counterpower: 'noEstablishedChallenge', defenseAvailable: true });
  f.contact = cityId => ({ ...f.context(f.entries[0]), cityId: f.localCity, local: f.localCity === cityId,
    cell: f.cell, free: !f.busy });
  f.hooks = { alive: () => f.alive, contact: f.contact, route: () => f.route, wallet: f.wallet,
    fuel: cityId => ({ stock: () => f.fuels[cityId].stock, price: () => f.fuels[cityId].price,
      take: (km, paid) => { const d = f.fuels[cityId]; if (d.stock + 1e-7 < km) return false; d.stock = Math.max(0, d.stock - km); d.received += paid; return true; } }) };
  f.advance = seconds => { f.at += seconds; return Bulk.advance(f.book, f.entries, f.context, f.hooks, f.at); };
  f.sign = (settings = limits, deposit = 50000) => {
    const q = Bulk.offer(f.book, f.entries, f.context, f.route, f.entries[0].rule.farms[0].id, settings, f.contact('a'), f.at); assert(q);
    assert(Bulk.begin(f.book, f.entries, f.context, f.contact('a'), q, deposit, f.wallet, f.at)); f.advance(120);
    assert.equal(f.book.contracts.length, 1); return f.book.contracts[0];
  };
  return f;
}
function fixture() {
  const entries = [account('a', true), account('b', false)], f = attach({ entries, at: 0, localCity: 'a', bodyEpoch: 0,
    cell: { x: 15, y: 11, z: 6 }, alive: true, busy: false, wallet: { money: 100000 },
    route: { id: 'original-ab', originId: 'a', destinationId: 'b', distanceKm: 558, supportCapable: true, continuity: 'operational',
      stops: [{ id: 'original-joint-fort', populationSourceId: 'population:fort', population: 400, km: 279, sponsorCityIds: ['a', 'b'], usable: true }] },
    fuels: { a: { stock: 8000, received: 0, price: .05 }, b: { stock: 8000, received: 0, price: .05 } } });
  for (const e of entries) assert(Rule.order(e.rule, e.succession, e.people, f.context(e), 0));
  for (const e of entries) { Rule.advance(e.rule, e.succession, e.people, () => f.context(e), 7200); assert(Rule.receive(e.rule, e.succession, e.people, f.context(e), 7200)); }
  f.at = 7200; f.book = Bulk.create({ worldId: 'world', runId: 'run' }, f.at); return f;
}
test('two original city accounts use a conserved bulk fleet, physically supplied fort fuel and paid rest before receipt and return', () => {
  const f = fixture(), source = f.entries[0].rule, target = f.entries[1].rule;
  const before = copy(source.farms[0]), originals = copy(f.entries.map(e => e.people));
  const contract = f.sign(); assert.equal(f.wallet.money, 50000); assert.equal(f.book.missions.length, 1);
  const m = f.book.missions[0]; assert.equal(source.farms[0].bulkAssignment, m.id);
  assert.equal(m.phase, 'loading'); assert.equal(m.departedAt, undefined);
  assert.equal(Bulk.receive(f.book, 'a', f.contact('a'), f.at).departures[0].departedAt, null);
  assert.equal(source.farms[0].drivers + m.drivers, before.drivers); assert.equal(source.farms[0].carriers + m.carriers, before.carriers);
  assert.equal(target.bulkReceivedFoodKg || 0, 0); assert(m.foodKg > 1500);
  f.advance(8 * 3600); assert.equal(m.phase, 'station'); assert.equal(m.at.kind, 'stronghold');
  assert(m.departedAt > m.createdAt);
  assert(m.restProgress < Bulk.REST); assert.equal(m.deliveredKg, 0);
  f.advance(24 * 3600); assert(m.deliveredKg > 1500); assert.equal(m.foodKg, 0); assert(target.foodKg > 0);
  const station = f.book.stations[0]; assert(station.fuelReceivedKm > 0); assert.equal(station.fuelReceivedKm, station.fuelDispensedKm);
  assert(station.workSeconds < Bulk.SHIFT); assert.equal(station.sponsorCityIds.length, 2);
  assert(Bulk.manage(f.book, f.entries, f.context, f.contact('a'), contract.id, 'cancel', 0, f.wallet, f.at));
  f.advance(48 * 3600); assert.equal(m.phase, 'returned'); assert.equal(source.farms[0].bulkAssignment, undefined);
  assert(m.restCount >= 3); assert.equal(m.driverIds.length, before.drivers); assert(m.spentFuelKm > m.initialTankKm);
  assert(Math.abs(before.fuelKm + m.purchasedFuelKm - (source.farms[0].spentFuelKm - before.spentFuelKm) - source.farms[0].fuelKm - (m.returnedFuelCargoKm || 0)) < 1e-5);
  assert.deepEqual(f.entries.map(e => e.people), originals); assert(Bulk.normalize(f.book));
  assert(Math.abs(contract.deposited - contract.spent - contract.refunded - contract.balance) < 1e-6);
});
test('normally sized farmless demand qualifies only after actual receipt while its original supplier operates concurrently', () => {
  const f = fixture(); f.sign(); f.advance(3 * 86400 - 3600);
  for (const e of f.entries) assert.equal(e.rule.status, 'established');
  assert(f.entries[1].rule.bulkReceivedFoodKg > 1500); assert(f.entries[0].rule.exportedFoodKg > 1500);
  assert(f.book.receipts.length); assert(f.book.receipts[0].at < f.entries[1].rule.accomplishment.at);
});
test('price, prepaid funds, source priority and fuel capacity stop purchases without fabricating grain or drivers', () => {
  for (const kind of ['price', 'funds', 'sourceReserve', 'fuel', 'station', 'assignment']) {
    const f = fixture(), opts = { ...limits }; if (kind === 'price') opts.maxUnitPrice = .01;
    if (kind === 'sourceReserve') f.entries[0].rule.foodKg = f.entries[0].rule.dailyKg * 2;
    if (kind === 'fuel') { f.fuels.a.stock = 0; f.fuels.b.stock = 0; }
    if (kind === 'station') f.route.stops[0].usable = false;
    if (kind === 'assignment') f.entries[0].rule.farms[0].bulkAssignment = 'actual-other-mission';
    const before = copy(f.fuels);
    if (['station', 'assignment'].includes(kind)) {
      assert.equal(Bulk.offer(f.book, f.entries, f.context, f.route, f.entries[0].rule.farms[0].id, opts, f.contact('a'), f.at), null); continue;
    }
    const c = f.sign(opts, kind === 'funds' ? 1 : 50000);
    assert.equal(f.book.missions.length, 0); f.advance(600); assert.equal(f.book.missions.length, 0);
    assert.equal(c.spent, 0); assert.deepEqual(f.fuels, before); assert.equal(f.entries[0].rule.exportedFoodKg || 0, 0);
  }
});
test('a closed route holds original paid cargo and spends provisions; reopening cannot backfill lost travel or erase a food gap', () => {
  const f = fixture(); f.sign(); f.advance(3600); const m = f.book.missions[0], km = m.km, food = m.foodKg, crew = m.crewFoodKg;
  f.route.supportCapable = false; f.advance(2 * 86400); assert.equal(m.km, km); assert.equal(m.foodKg, food); assert(m.crewFoodKg < crew);
  assert.equal(f.entries[1].rule.since, null); assert.equal(f.entries[1].rule.accomplishment, null);
  f.route.supportCapable = true; f.advance(60); assert(m.km < km + 1); assert.equal(m.deliveredKg, 0);
  f.advance(36 * 3600); assert(m.deliveredKg > 0); assert.equal(f.entries[1].rule.status, 'limited');
});
test('saved partial agreement and stronghold rest conserve paid work, original station spending and food across continued copies', () => {
  const f = fixture(), q = Bulk.offer(f.book, f.entries, f.context, f.route, f.entries[0].rule.farms[0].id, limits, f.contact('a'), f.at);
  assert(Bulk.begin(f.book, f.entries, f.context, f.contact('a'), q, 50000, f.wallet, f.at)); f.advance(30);
  const partial = copy(f.book.job); f.busy = true; f.advance(600); assert.equal(f.book.job.progress, partial.progress);
  f.busy = false; f.advance(60); assert.equal(f.book.job.progress, partial.progress); f.advance(90); assert.equal(f.book.job, null);
  f.advance(8 * 3600);
  const loaded = attach(copy({ entries: f.entries, at: f.at, book: f.book, localCity: f.localCity, bodyEpoch: f.bodyEpoch,
    cell: f.cell, alive: f.alive, busy: f.busy, wallet: f.wallet, route: f.route, fuels: f.fuels }));
  loaded.book = Bulk.normalize(loaded.book); assert(loaded.book);
  f.advance(3600); loaded.advance(3600); assert.deepEqual(loaded.book, f.book); assert.deepEqual(loaded.entries, f.entries);
  loaded.book = Bulk.rebind(loaded.book, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'copy' });
  for (const e of loaded.entries) e.rule.runId = 'copy';
  loaded.advance(22 * 3600); assert(loaded.book.missions[0].deliveredKg > 0);
});
test('cancellation refunds only unspent allowance; paid cargo and funded return keep their original custody', () => {
  const f = fixture(), c = f.sign(), m = f.book.missions[0], paid = c.spent;
  assert(Bulk.manage(f.book, f.entries, f.context, f.contact('a'), c.id, 'cancel', 0, f.wallet, f.at));
  assert(Bulk.manage(f.book, f.entries, f.context, f.contact('a'), c.id, 'refund', 0, f.wallet, f.at));
  assert.equal(f.wallet.money, 100000 - paid); assert.equal(c.balance, 0);
  f.advance(4 * 86400); assert.equal(m.phase, 'returned'); assert(m.deliveredKg > 0); assert.equal(f.book.missions.length, 1);
});
test('dated local reports cannot reveal unreturned crew positions or hidden remote shortages; death freezes all accounts', () => {
  const f = fixture(); f.sign(); f.advance(3600);
  const r = Bulk.receive(f.book, 'a', f.contact('a'), f.at); assert(r); assert(!JSON.stringify(r).includes('km'));
  const before = copy(r); f.route.supportCapable = false; f.advance(86400); assert.deepEqual(r, before);
  f.localCity = 'b'; const dest = Bulk.receive(f.book, 'b', f.contact('b'), f.at); assert.deepEqual(dest.receipts, []);
  f.alive = false; const frozen = copy([f.book, f.entries, f.fuels]); assert.equal(f.advance(86400), false); assert.deepEqual([f.book, f.entries, f.fuels], frozen);
});
test('lost station resources cannot be recreated by another dispatch or a new view', () => {
  const f = fixture(); f.sign(); assert(f.book.stationOriginals.length); const marker = f.book.stationOriginals[0];
  f.book.stations = []; f.advance(8 * 3600); assert.equal(f.book.missions[0].hold, 'Original joint rest/refueling station unavailable or occupied.');
  assert.deepEqual(f.book.stationOriginals, [marker]); assert.deepEqual(f.book.stations, []);
  const stripped = copy(f.book); stripped.stationOriginals = []; assert.equal(Bulk.normalize(stripped), null);
});
test('return fuel is a paid bounded cargo purchase, not an overfilled tank or a second escrow refund', () => {
  const f = fixture(); f.route.distanceKm = 2000;
  f.route.stops = [300, 600, 900, 1200, 1500, 1800].map((km, i) => ({ ...copy(f.route.stops[0]), id: `original-fort:${i}`, populationSourceId: `population:fort:${i}`, km }));
  const c = f.sign(), m = f.book.missions[0]; assert(m.returnAllowance > 0);
  assert(Bulk.manage(f.book, f.entries, f.context, f.contact('a'), c.id, 'cancel', 0, f.wallet, f.at));
  const before = f.fuels.b.stock; f.advance(7 * 86400);
  assert(m.deliveredKg > 0); assert(f.fuels.b.stock < before); assert(m.tankKm <= m.tankCapacityKm);
  assert(m.purchasedFuelKm > 8000); assert(Math.abs(m.returnAllowance) < 1e-7);
  f.advance(7 * 86400); assert.equal(m.phase, 'returned');
  assert(Math.abs(c.deposited - c.spent - c.refunded - c.balance) < 1e-5); assert(Bulk.normalize(f.book));
});
test('longer actual support legs use two conserved original drivers per truck, not longer individual shifts or larger tanks', () => {
  const f = fixture(); f.route.stops[0].km = 350;
  const original = copy(f.entries[0].rule.farms[0]); f.sign();
  const m = f.book.missions[0]; assert.equal(m.carriers, original.carriers / 2); assert.equal(m.drivers, original.drivers);
  assert.equal(m.capacityKg * 2, original.capacityKg); assert.equal(m.passengerKg, m.carriers * 75);
  f.advance(9 * 3600); assert.equal(m.at.kind, 'stronghold'); assert.equal(m.km, 350);
  assert(m.dutySeconds > 0); assert(m.dutySeconds < Bulk.SHIFT); assert.equal(m.tankCapacityKm, m.carriers * 600);
  assert(Bulk.normalize(f.book));
});
test('unchanged terms, both real authorities and the same living body are necessary; refusal never spends the allowance', () => {
  for (const kind of ['terms', 'authority', 'body']) {
    const f = fixture(), q = Bulk.offer(f.book, f.entries, f.context, f.route, f.entries[0].rule.farms[0].id, limits, f.contact('a'), f.at);
    if (kind === 'terms') q.limits.quantityKg++;
    if (kind === 'authority') f.entries[1].succession.agreements = [];
    if (kind === 'body') f.bodyEpoch++;
    assert.equal(Bulk.begin(f.book, f.entries, f.context, f.contact('a'), q, 50000, f.wallet, f.at), false);
    assert.equal(f.wallet.money, 100000); assert.equal(f.book.job, null); assert.deepEqual(f.book.missions, []);
  }
});
test('a moved fort or changed sponsor cannot reroute paid original cargo; injured crew or an unwilling custodian cannot be replaced', () => {
  for (const kind of ['location', 'sponsor', 'injury', 'refusal', 'occupied']) {
    const f = fixture(); f.sign(); f.advance(8 * 3600); const m = f.book.missions[0], km = m.km, rest = m.restProgress;
    if (kind === 'location') f.route.stops[0].km++;
    if (kind === 'sponsor') f.route.stops[0].sponsorCityIds[1] = 'unrelated-city';
    if (kind === 'injury') m.health = 49;
    if (kind === 'refusal') f.book.stations[0].willing = false;
    if (kind === 'occupied') f.book.stations[0].assignment = 'other-original-mission';
    f.advance(86400); assert.equal(m.km, km); assert.equal(m.restProgress, rest); assert.equal(m.deliveredKg, 0); assert(m.hold);
  }
});
test('minute catch-up and separate event calls spend the same original food, fuel, work and escrow', () => {
  const f = fixture(); f.sign();
  const g = attach(copy({ entries: f.entries, at: f.at, book: f.book, localCity: f.localCity, bodyEpoch: f.bodyEpoch,
    cell: f.cell, alive: f.alive, busy: f.busy, wallet: f.wallet, route: f.route, fuels: f.fuels }));
  f.advance(6 * 3600); for (let i = 0; i < 360; i++) g.advance(60);
  const rounded = x => JSON.parse(JSON.stringify(x, (_, v) => typeof v === 'number' ? Math.round(v * 1e7) / 1e7 : v));
  assert.deepEqual(rounded(g.book), rounded(f.book)); assert.deepEqual(rounded(g.entries), rounded(f.entries)); assert.deepEqual(rounded(g.fuels), rounded(f.fuels));
});
test('standing replenishment refuels the same returned original tanks through actual paid origin loading, not fresh fleet allocation', () => {
  const f = fixture(); f.sign(); const first = f.book.missions[0];
  f.advance(80 * 3600); assert.equal(first.phase, 'returned');
  const second = f.book.missions[1]; assert(second); assert.deepEqual(second.driverIds, first.driverIds);
  assert(second.initialTankKm < second.tankCapacityKm); assert(second.purchasedFuelKm > 0);
  f.advance(3600); assert(second.km > 0); assert(second.tankKm <= second.tankCapacityKm); assert(second.loadingSeconds > 0);
  assert(Bulk.normalize(f.book));
});
test('malformed saved terms or missing original mission custody are rejected rather than silently repaired into fresh resources', () => {
  const f = fixture();
  Bulk.offer(f.book, f.entries, f.context, f.route, f.entries[0].rule.farms[0].id, limits, f.contact('a'), f.at);
  const quote = copy(f.book); quote.quote.route = null; assert.equal(Bulk.normalize(quote), null);
  f.sign();
  for (const key of ['distanceKm', 'at', 'crewPerVehicle', 'driverIds', 'returnAllowance']) {
    const saved = copy(f.book); delete saved.missions[0][key]; assert.equal(Bulk.normalize(saved), null, key);
  }
  assert(Bulk.normalize(f.book));
});
