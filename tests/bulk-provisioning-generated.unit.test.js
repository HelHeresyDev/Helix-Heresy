const { test } = require('node:test'), assert = require('node:assert/strict');
const Library = require('../world-run-library'), Rule = require('../city-rule'), Authority = require('../city-authority');
const Recovery = require('../city-recovery'), Bulk = require('../bulk-provisioning');
const Carrier = require('../local-exchange-carrier');
const copy = x => JSON.parse(JSON.stringify(x));
test('unmodified generated populations use actual political agreements, municipal operation and their real joint-fort supply corridor', () => {
  const world = Library.createWorld({ id: 'bulk-generated', worldSeed: 'charter-foundation', worldTheme: 'madcap', createdAt: 'test' });
  const map = world.generatedData.strategicMap, original = JSON.stringify(map), binding = { worldId: world.id, runId: 'original-run' };
  const political = Authority.create(binding), entries = [], originalSources = [];
  let at = 0, currentCity;
  const civic = () => ({ alive: true, capable: true, local: true, atCounter: true, clerkPresent: true,
    free: true, permission: true, sourceCurrent: true, authority: true, worksAvailable: true, defenseAvailable: true,
    cityId: currentCity, clerkId: `${currentCity}:original-clerk`, bodyEpoch: 0, at, reportersPresent: true, institutionsAvailable: true,
    coverageVerified: true, counterpower: 'noEstablishedChallenge', politicalAuthorities: political.authorities });
  // Prior owned repair deliveries and physically attended original civic
  // counters are inputs here, NOT a full-game money/travel acquisition proof.
  function prepare(cityId) {
    currentCity = cityId;
    let projected = map, source = Rule.sourceFromWorld(projected, cityId, { politicalSettlement: true });
    if (!source) {
      const recovery = Recovery.create(Recovery.sourceFromWorld(map, cityId), binding, at); assert(recovery);
      const stacks = Recovery.KEYS.map(key => ({ id: `owned:${cityId}:${key}`, key, quantity: 100000, carriedBy: 'scientist' }));
      while (recovery.completed.length < recovery.source.projects.length) {
        for (const key of Recovery.KEYS) Recovery.stage(recovery, civic(), stacks, key, at);
        assert(Recovery.begin(recovery, civic(), at)); at += recovery.job.seconds; assert(Recovery.advance(recovery, civic(), at));
      }
      projected = Recovery.projectMap(map, recovery, recovery); source = Rule.sourceFromWorld(projected, cityId, { politicalSettlement: true });
    }
    assert(source); originalSources.push(copy(source));
    const settlement = Authority.register(political, Authority.sourceFromWorld(projected, cityId)); assert(settlement);
    const offices = Object.fromEntries(settlement.source.parties.map(p => [p.cityId, { id: `${p.cityId}:original-counter`,
      clerk: { id: `${p.cityId}:original-clerk`, status: 'alive', health: 100 }, workSeconds: 28800, power: 28800 }]));
    const act = (action, terms) => { assert(Authority.begin(political, settlement, action, civic(), offices[currentCity], at, terms), `${cityId}: ${action}`);
      at += political.job.seconds; assert(Authority.advance(political, civic(), offices[currentCity], at)); };
    act('inspect'); act('negotiate'); assert.equal(settlement.phase, 'offered', `${cityId}: original authority refuses`);
    act('accept', copy(settlement.terms));
    for (const p of settlement.source.parties.slice(1)) { currentCity = p.cityId; act('assent', copy(settlement.terms)); }
    currentCity = cityId; assert(Authority.authorizes(settlement, political.authorities, civic(), at));
    settlement.staff = [...new Set(source.institutions.map(i => i.id))].map(institutionId => ({
      id: `${institutionId}:original-officeholder`, institutionId, roles: source.institutions.filter(i => i.id === institutionId).map(i => i.role), status: 'alive', health: 100 }));
    const rule = Rule.createClient(source, settlement, political.authorities, binding, at,
      { id: `${cityId}:original-defense`, initialEnergy: 0 }, civic()); assert(rule);
    const entry = { rule, succession: settlement, people: settlement.staff }; entries.push(entry); return entry;
  }
  const route = Bulk.routeFromWorld(map, 'corridor:01406-05525', 'city:01406'); assert(route);
  assert.equal(route.stops.length, 2); assert(route.distanceKm > 750);
  const supplier = prepare(route.originId), recipient = prepare(route.destinationId);
  assert.equal(supplier.rule.population, 41302); assert.equal(recipient.rule.population, 42820);
  const context = e => ({ ...civic(), cityId: e.rule.source.cityId, at: e.rule.lastAt });
  for (const e of entries) {
    currentCity = e.rule.source.cityId;
    Rule.advance(e.rule, e.succession, e.people, () => context(e), at);
    assert(Rule.order(e.rule, e.succession, e.people, context(e), at));
  }
  at += 12 * 3600;
  for (const e of entries) { Rule.advance(e.rule, e.succession, e.people, () => context(e), at);
    assert(Rule.receive(e.rule, e.succession, e.people, context(e), at)); }
  const book = Bulk.create(binding, at), wallet = { money: 1000000 };
  const depots = Object.fromEntries([route.originId, route.destinationId].map(id => [id, Carrier.support(Carrier.create(id), at)]));
  const contact = cityId => ({ ...civic(), cityId: currentCity, local: currentCity === cityId, cell: { x: 1, y: 1, z: 0 } });
  const hooks = { alive: () => true, contact, wallet, route: () => route,
    fuel: cityId => ({ stock: () => depots[cityId].supplier.fuelStockKm, price: () => .05, take: (km, paid) => {
      if (depots[cityId].supplier.fuelStockKm < km) return false;
      depots[cityId].supplier.fuelStockKm -= km; depots[cityId].revenue += paid; depots[cityId].money += paid; return true;
    } }) };
  currentCity = route.originId;
  const fleet = supplier.rule.farms.find(f => !f.trip && f.drivers >= 20 && f.distanceKm > 200); assert(fleet);
  const q = Bulk.offer(book, entries, context, route, fleet.id,
    { thresholdDays: 3, targetDays: 3.8, quantityKg: 10000, maxUnitPrice: 10, maxTripSpend: 100000 }, contact(currentCity), at); assert(q);
  assert(Bulk.begin(book, entries, context, contact(currentCity), q, 100000, wallet, at));
  at += 120; Bulk.advance(book, entries, context, hooks, at);
  assert(book.missions.length > 0, 'actual source surplus must fund a trip');
  const m = book.missions[0]; assert(m.foodKg > 9000); assert.equal(m.drivers, 20); assert.equal(m.carriers, 10);
  const fuelParcels = entries.map(e => [{ id: `owned:${e.rule.source.cityId}:power`, key: 'arcaneFeedstock', quantity: 500, carriedBy: 'scientist' }]);
  const end = at + 3 * 86400;
  while (at < end) {
    for (const [i, e] of entries.entries()) {
      currentCity = e.rule.source.cityId;
      const quantity = Math.min(Math.floor((e.rule.initialEnergy - e.rule.energy) / 21600),
        Math.ceil(Math.max(0, (end - at + 600) * e.rule.energyRate - e.rule.energy) / 21600));
      if (quantity > 0 && !e.rule.recharge && !e.rule.operatorServiceAssignment) {
        assert(Rule.recharge(e.rule, e.succession, e.people, context(e), fuelParcels[i], at, quantity), 'real power fuel processing must remain possible');
      }
    }
    at = Math.min(end, at + 6 * 3600); Bulk.advance(book, entries, context, hooks, at);
  }
  assert(fuelParcels.every(p => p[0].quantity < 500));
  assert(m.deliveredKg > 9000); assert(book.stations.some(s => s.fuelDispensedKm > 0));
  for (const e of entries) assert.equal(e.rule.status, 'established', `${e.rule.source.cityId}: ${JSON.stringify({ status: e.rule.status, food: e.rule.foodKg, energy: e.rule.energy, failure: e.rule.failureAt })}`);
  assert(m.receipts.some(r => r.kind === 'suppliedRest' && r.stationId === route.stops[0].id));
  assert.equal(JSON.stringify(map), original); assert.deepEqual(entries.map(e => e.rule.source), originalSources);
  assert(Bulk.normalize(book));
});
