const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../municipal-fuel-service');
const P = require('../local-market-production');
const N = require('../network-operations');
const C = require('../network-capabilities');
const R = require('../city-rule');
const Carrier = require('../local-exchange-carrier');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const { inputs } = require('./helpers/municipal-fuel-source');
const copy = x => JSON.parse(JSON.stringify(x));
const Communications = require('../civic-communications');
const { addCommunications } = require('./helpers/civic-communication-source');
const limits = { threshold: 6, quantity: 6, maxUnitPrice: 100, maxTripSpend: 1000 };
function fixture(options = {}) {
  const { map, profile } = inputs(), run = { worldId: 'w', runId: 'r' };
  if (options.alternative) map.strategicNonStateNetworkHistory.branchRows[1].currentCityId = 'a';
  const people = R.ROLES.map(role => ({ id: `original:${role}`, institutionId: role, roles: [role], health: 100, status: 'alive' }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'terms' }));
  const succession = { source: { cityId: 'a', charterId: 'charter:a' }, officeId: 'original-office:a',
    handover: { id: 'original-handover:a', termsId: 'terms', bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'original-handover:a', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const farm = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', institutionId: 'publicWorksAndProvisioning', populationSourceId: 'population:a',
    cityPopulation: 3000, satelliteId: 'original-farm:a', satelliteName: 'Original farm', satellitePopulation: 600,
    cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive', storageDays: 3,
    distanceKm: 2, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', populationSourceId: 'population:a', population: 3000,
    institutions: R.ROLES.map(role => ({ role, id: role })), worksId: 'original-water-walls:a', powerId: 'original-power:a', reserveDays: options.reserveDays || 4, farms: [farm] };
  const rule = R.createAggregate(source, succession, run, 0, { id: 'original-detailed-ward', initialEnergy: 69120 }); assert.ok(rule);
  const wallet = { money: 5000 }, c = { alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true,
    sourceCurrent: true, bodyEpoch: 0, institutionsAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge',
    pilotSupplied: true, pilotDefended: true, defenseAvailable: true, routes: { 'original-farm:a': true }, authority: true, otherBusy: false,
    cell: { x: 15, y: 11, z: 6 }, routeOpen: true, targetExists: true, wallet };
  assert.equal(R.order(rule, succession, people, c, 0), true); R.advance(rule, succession, people, () => c, 3600);
  profile.commodityDefinitions = [P.FUEL_DEFINITION, ...['manaCrystals', 'preparedManaCrystals', 'fieldRation', 'drinkingWater'].map(id => ({ id, basePrice: 10, supply: 36 }))];
  const production = P.create(profile, 3600), networks = N.create(N.sources(map, 'original-local-fuel'), run, 3600);
  const sources = F.sources(map, rule.source, production, Definitions), state = F.create(sources, rule, 3600, production); assert.ok(state);
  const listings = Object.fromEntries(profile.commodityDefinitions.map(d => [d.id, { supply: 36, demand: 1 }]));
  const f = { state, rule, networks, production, listings, c, people, succession, wallet, map, profile, at: 3600,
    hooks: { alive: () => c.alive, incapacitated: d => Boolean(d.incapacitated), safe: d => !d.incapacitated,
      arrive: (d, t) => { d.mapCell = copy(F.ENTRY); t.mapCell = copy(F.TRUCK); return true; },
      move: (d, cell) => { d.mapCell = copy(cell); return true; } } };
  f.tick = n => {
    for (let left = n; left > 0;) {
      const dt = Math.min(1, left); f.at += dt; left -= dt; c.at = f.at;
      c.authority = R.authority(f.rule, succession, people, c);
      R.advance(f.rule, succession, people, () => c, f.at);
      F.advance(f.state, f.rule, f.networks, f.production, listings, () => c, f.at, f.hooks);
    }
  };
  f.sign = (v = limits, deposit = 1000, id = sources[0].id) => {
    const q = F.offer(f.state, f.rule, f.networks, f.production, c, id, v, f.at); assert.ok(q);
    assert.equal(F.begin(f.state, f.rule, f.networks, f.production, c, 'sign', q, deposit, wallet, f.at), true);
    f.tick(120);
  };
  return f;
}
test('a real selected relay can hold new procurement without money/stock movement; municipal failover resumes and paid physical cargo ignores a later outage', () => {
  const f = fixture(), map = addCommunications(f.map, f.rule.source);
  f.networks = N.create(N.sources(map, 'original-local-fuel'), f.rule, f.at);
  const s = Communications.create(Communications.sources(map, Definitions), f.rule, f.at), path = s.sources.find(r => r.kind === 'provider').id;
  assert.equal(Communications.begin(s, f.rule, f.networks, f.c, path, Communications.PURPOSES, false, f.at), true);
  f.tick(60); Communications.advance(s, f.rule, f.networks, () => f.c, f.at);
  f.c.communicate = (data, at) => Communications.transfer(s, f.networks, Communications.packet(s, f.rule, data), at);
  f.sign(); s.ports.find(p => p.id === path).condition = 0;
  const before = copy([f.listings, f.state.balance, f.production.trucks]); f.tick(61);
  assert.equal(f.state.mission, null); assert.deepEqual([f.listings, f.state.balance, f.production.trucks], before);
  const municipal = s.sources.find(r => r.kind === 'municipal').id;
  assert.equal(Communications.begin(s, f.rule, f.networks, f.c, municipal, Communications.PURPOSES, false, f.at), true);
  f.tick(60); Communications.advance(s, f.rule, f.networks, () => f.c, f.at); f.tick(61);
  assert.ok(f.state.mission); const paid = f.state.spent;
  s.ports.find(p => p.id === municipal).condition = 0; f.tick(4000);
  assert.equal(f.rule.powerFuel.received, 6); assert.equal(f.state.spent, paid); assert.equal(f.state.mission.remaining, 0);
});
test('eligible original producer and procurement office only; no military label, dead source, missing specialty or shared host becomes a supplier', () => {
  const f = fixture(), before = copy(f.map); assert.equal(f.state.sources.length, 1); assert.deepEqual(f.map, before);
  for (const mutate of [x => x.map.strategicNonStateNetworkHistory.networkRows[0].category = 'military',
    x => x.map.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'negligible',
    x => x.map.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'branch:b',
    x => x.production.sources = [], x => x.production.facilities[0].expertise = [],
    x => x.production.facilities[0].utilities = 0, x => x.map.strategicPlayableSettlementState.cityRows[0].assetId = 'other-population']) {
    const x = fixture(); mutate(x); assert.deepEqual(F.sources(x.map, x.rule.source, x.production, Definitions), []);
  }
});
test('exact attended signature uses the same finite office/municipal work, survives reload, and transfers no funds early', () => {
  const f = fixture(), q = F.offer(f.state, f.rule, f.networks, f.production, f.c, f.state.sources[0].id, limits, f.at);
  assert.equal(F.begin(f.state, f.rule, f.networks, f.production, f.c, 'sign', { ...q, brokerFee: 0 }, 500, f.wallet, f.at), false);
  assert.equal(F.begin(f.state, f.rule, f.networks, f.production, f.c, 'sign', q, 500, f.wallet, f.at), true);
  const work = f.rule.operatorWorkSeconds, desk = f.networks.accounts[0].operator.workSeconds;
  f.tick(43); assert.equal(f.state.job.progress, 43); assert.equal(f.wallet.money, 5000); assert.equal(f.state.contract, null);
  f.state = F.normalize(f.state); f.tick(77); assert.equal(f.wallet.money, 4500); assert.equal(f.state.balance, 500);
  assert.equal(f.rule.operatorWorkSeconds, work - 120); assert.equal(f.networks.accounts[0].operator.workSeconds, desk - 120);
  assert.equal(f.state.mission, null); assert.equal(f.rule.powerFuel.stock, 0);
  assert.equal(F.begin(f.state, f.rule, f.networks, f.production, f.c, 'sign', q, 500, f.wallet, f.at), false);
});
test('movement, body change, absent staff, paid-work conflicts and outages interrupt without refunds, lock theft or false contract', () => {
  for (const mutate of [f => f.c.cell.x++, f => f.c.bodyEpoch++, f => f.c.otherBusy = true,
    f => f.networks.accounts[0].operator.status = 'dead', f => f.networks.accounts[0].terminal.powerSeconds = 0,
    f => f.rule.operatorServiceAssignment = 'different-job', f => f.c.sourceCurrent = false]) {
    const f = fixture();
    // Complete only a partial real signature, never a contract fixture.
    const q = F.offer(f.state, f.rule, f.networks, f.production, f.c, f.state.sources[0].id, limits, f.at);
    assert.equal(F.begin(f.state, f.rule, f.networks, f.production, f.c, 'sign', q, 500, f.wallet, f.at), true);
    f.tick(20); mutate(f); f.tick(5);
    assert.equal(f.state.job, null); assert.equal(f.state.contract, null); assert.equal(f.wallet.money, 5000);
    assert.equal(f.networks.accounts[0].operator.workSeconds, 14380);
    if (f.rule.operatorServiceAssignment) assert.equal(f.rule.operatorServiceAssignment, 'different-job');
  }
});
test('actual purchase conserves money and stock, reserves the original shared carrier, and cannot generate energy before physical unloading and work', () => {
  const f = fixture(); f.sign(); const dated = copy(f.state.report), before = copy(f.production.finance);
  const deskMoney = f.networks.accounts[0].money, energy = f.rule.energy; f.tick(1);
  const m = f.state.mission; assert.ok(m); assert.equal(f.listings.arcaneFeedstock.supply, 30);
  assert.equal(f.production.trucks.filter(t => t.shipment === m.id).length, 1); assert.equal(f.rule.powerFuel.received, 0);
  assert.equal(f.production.finance.money - before.money, F.FREIGHT); assert.equal(f.networks.accounts[0].money - deskMoney, F.BROKER);
  assert.equal(f.production.finance.exchangeMoney - before.exchangeMoney + F.BROKER + F.FREIGHT, m.cost);
  assert.equal(f.wallet.money + f.state.balance + f.state.spent, 5000);
  const t = f.production.trucks.find(t => t.id === m.truckId), fuel = t.fuelKm;
  // The ordinary producer tick must not unload, refuel or release this trip.
  P.advance(f.production, f.at + 2 * 3600, f.listings, Carrier.support(Carrier.create('a')).supplier);
  assert.equal(t.shipment, m.id); assert.equal(t.fuelKm, fuel); assert.equal(f.rule.powerFuel.received, 0);
  f.tick(3599); assert.equal(f.rule.powerFuel.received, 0); assert.ok(f.rule.energy < energy);
  f.tick(65); assert.equal(f.rule.powerFuel.received, 1); assert.equal(f.rule.powerFuel.processed, 0);
  f.tick(61); assert.ok(f.rule.powerFuel.processed >= 1); assert.ok(f.rule.chargedEnergy >= 21600);
  assert.deepEqual(f.state.report, dated);
  assert.equal(f.rule.powerFuel.received, f.rule.powerFuel.stock + f.rule.powerFuel.processed + (f.rule.powerFuel.progress ? 1 : 0));
});
test('price, prepaid funds, original carrier assignments and physical receiving limits are real procurement holds, not civic defeat', () => {
  for (const configure of [f => f.state.contract.limits.maxUnitPrice = 1, f => f.state.contract.limits.maxTripSpend = 1,
    f => { f.state.balance = 0; f.state.refunded = f.state.deposited; }, f => f.listings.arcaneFeedstock.supply = 0,
    f => f.production.trucks.forEach(t => t.driver.assignment = 'previous-paid-work'), f => f.c.routeOpen = false]) {
    const f = fixture(); f.sign(); configure(f); const stock = f.listings.arcaneFeedstock.supply, energy = f.rule.energy;
    f.tick(60); assert.equal(f.state.mission, null); assert.equal(f.listings.arcaneFeedstock.supply, stock);
    assert.ok(f.state.hold); assert.ok(f.rule.energy < energy); assert.notEqual(f.rule.status, 'contested'); assert.equal(f.c.alive, true);
  }
});
test('standing procurement still needs its original qualified operator, powered payment channel and actual charter authority', () => {
  for (const stop of [f => f.networks.accounts[0].operator.status = 'dead', f => f.networks.accounts[0].operator.workSeconds = 0,
    f => f.networks.accounts[0].operator.assignment = 'other-persons-work', f => f.networks.accounts[0].terminal.powerSeconds = 0,
    f => f.networks.accounts[0].source.charter.scope = []]) {
    const f = fixture(); f.sign(); stop(f); f.tick(61); assert.equal(f.state.mission, null); assert.equal(f.state.spent, 0);
  }
  const f = fixture(); f.sign(); const before = f.networks.accounts[0].operator.workSeconds;
  f.tick(1); assert.equal(f.networks.accounts[0].operator.workSeconds, before - 1);
});
test('cancellation and unspent refund preserve paid cargo, municipal property, existing processing and original return; another provider may serve later', () => {
  const f = fixture(); f.sign(); f.tick(1); const m = f.state.mission, cost = m.cost;
  f.c.at = f.at; assert.equal(F.action(f.state, f.rule, f.networks, f.c, f.wallet, 'cancel'), true);
  assert.equal(F.action(f.state, f.rule, f.networks, f.c, f.wallet, 'refund'), true); assert.equal(f.wallet.money, 5000 - cost);
  f.tick(8000); assert.equal(f.rule.powerFuel.received, 6); assert.ok(f.state.mission.returnedAt);
  assert.equal(f.state.missions.length, 1); assert.equal(f.production.trucks[0].shipment, null); assert.equal(f.state.balance, 0);
  assert.equal(f.state.mission.travelledKm.toFixed(5), '8.00000'); assert.equal(f.state.spent, cost);
  f.sign(); assert.equal(f.state.contracts.length, 1); assert.equal(f.state.contract.cancelledAt, null);
});
test('a separately eligible independent procurement office is an alternative, not a new fleet or a network-wide breach waiver', () => {
  const f = fixture({ alternative: true }); assert.equal(f.state.sources.length, 2); f.sign(); f.tick(3601);
  f.production.trucks[0].driver.fuelServiceAttack = { id: 'original-local-breach', missionId: f.state.mission.id };
  f.tick(61); assert.equal(f.state.suspended.length, 1); f.c.at = f.at;
  assert.equal(F.action(f.state, f.rule, f.networks, f.c, f.wallet, 'cancel'), true);
  assert.equal(F.action(f.state, f.rule, f.networks, f.c, f.wallet, 'refund'), true); f.tick(4500);
  assert.equal(F.offer(f.state, f.rule, f.networks, f.production, f.c, f.state.sources[0].id, limits, f.at), null);
  const money = f.wallet.money; f.sign(limits, 1000, f.state.sources[1].id);
  assert.equal(f.state.contract.sourceId, f.state.sources[1].id); assert.equal(f.wallet.money, money - 1000);
  assert.equal(f.production.trucks.length, 2); assert.equal(f.state.suspended.length, 1);
});
test('blocked road, receiving obstruction, injured original driver and damaged truck hold the same municipal cargo without resets', () => {
  for (const stop of [f => f.c.routeOpen = false, f => f.production.trucks[0].driver.health = 49,
    f => f.production.trucks[0].condition = 49, f => f.hooks.arrive = () => false]) {
    const f = fixture(); f.sign(); f.tick(1); const stock = f.listings.arcaneFeedstock.supply, paid = f.state.spent; stop(f); f.tick(8000);
    assert.equal(f.rule.powerFuel.received, 0); assert.equal(f.state.mission.remaining, 6);
    assert.equal(f.state.spent, paid); assert.equal(f.listings.arcaneFeedstock.supply, stock); assert.equal(f.production.trucks.length, 2);
    f.state = F.normalize(f.state); assert.ok(!f.state.invalid);
  }
});
test('a surviving actual attack witness and finite powered authentication stop only new work; silence, old network mandates and unseen attacks do not', () => {
  const f = fixture(); f.sign(); f.tick(3601); const m = f.state.mission, d = f.production.trucks[0].driver;
  assert.equal(f.state.suspended.length, 0); d.fuelServiceAttack = { id: 'actual-witnessed-attack', missionId: m.id, at: f.at };
  f.tick(20); assert.equal(f.state.noticeJob.progress, 19); assert.equal(f.state.suspended.length, 0);
  const a = f.networks.accounts[0], power = a.terminal.powerSeconds; a.terminal.powerSeconds = 0; f.tick(100);
  assert.equal(a.operator.assignment, null); assert.equal(f.state.suspended.length, 0);
  a.terminal.powerSeconds = power; f.state = F.normalize(f.state); f.tick(41);
  assert.equal(f.state.suspended.length, 1); assert.deepEqual(F.publicView(f.state).notices, []);
  f.tick(8000); assert.equal(f.rule.powerFuel.received, 6); assert.equal(f.state.missions.length, 1);
  assert.match(f.state.hold, /suspended/); assert.equal(f.c.alive, true);
  assert.equal(F.begin(f.state, f.rule, f.networks, f.production, f.c, 'report', null, 0, f.wallet, f.at), true);
  f.tick(60); assert.equal(F.publicView(f.state).notices.length, 1);
  assert.equal(N.fact(f.networks, 'original-network', false, f.at).state, 'unverified');
  const g = fixture(); g.sign(); g.tick(1); g.production.trucks[0].driver.status = 'dead';
  g.production.trucks[0].driver.fuelServiceAttack = { id: 'no-surviving-witness', missionId: g.state.mission.id };
  g.tick(80); assert.equal(g.state.suspended.length, 0);
});
test('finite supplied driver duty cannot reset; missing original support/accounts are gaps, bindings isolate imports and death freezes everything', () => {
  const f = fixture(); f.sign(); f.tick(100); const original = copy([f.state, f.rule, f.production, f.wallet, f.networks]);
  f.c.alive = false; f.tick(100); assert.deepEqual([f.state, f.rule, f.production, f.wallet, f.networks], original);
  assert.equal(F.rebind(f.state, { worldId: 'w', runId: 'other' }, { worldId: 'w', runId: 'next' }), null);
  const rebound = F.rebind(f.state, f.state, { worldId: 'w', runId: 'continued' });
  assert.equal(rebound.runId, 'continued'); assert.equal(rebound.mission.id, f.state.mission.id);
  delete f.production.trucks[0].driver.fuelDutySeconds; F.prepareDrivers(f.state, f.production);
  assert.equal(f.production.trucks[0].driver.fuelDutySeconds, 0); assert.equal(f.production.trucks[0].driver.fuelSupportLost, true);
  const bad = copy(f.state); bad.balance++; assert.equal(F.normalize(bad).invalid, true); assert.equal(F.normalize(F.normalize(bad)).invalid, true);
});
test('a witnessed attack cannot transmit by telepathy: the original cab set, charge, access, healthy witness and same office channel are required', () => {
  for (const stop of [f => f.production.trucks[0].driver.cabRadio.chargeSeconds = 0,
    f => f.production.trucks[0].driver.cabRadio.condition = 0, f => delete f.production.trucks[0].driver.cabRadio,
    f => f.production.trucks[0].driver.cabRadio.id = 'unallocated-radio', f => f.hooks.radioPath = () => false,
    f => f.production.trucks[0].driver.incapacitated = true]) {
    const f = fixture(); f.sign(); f.tick(3601);
    f.production.trucks[0].driver.fuelServiceAttack = { id: 'actual-contact', missionId: f.state.mission.id, at: f.at };
    stop(f); f.tick(80); assert.equal(f.state.notices.length, 0); assert.equal(f.state.suspended.length, 0);
    assert.equal(f.networks.accounts[0].operator.assignment, null);
  }
  const f = fixture(); f.sign(); f.tick(3601); const d = f.production.trucks[0].driver, charge = d.cabRadio.chargeSeconds;
  d.fuelServiceAttack = { id: 'actual-contact', missionId: f.state.mission.id, at: f.at }; f.tick(61);
  assert.equal(d.cabRadio.chargeSeconds, charge - 60); assert.equal(f.state.suspended.length, 1);
});
test('private references deduplicate shared supplier assets and cannot certify worldwide outcomes or widen old mandates', () => {
  const f = fixture(); f.sign(); f.tick(1); F.register(f.state, f.networks, f.production);
  const a = f.networks.accounts[0], allocation = a.allocations[0]; a.allocations.push({ ...copy(allocation), id: 'second-same-vendor' });
  const assess = C.assess(f.networks.capabilityAccounting, f.networks, 'original-network');
  assert.equal(assess.references.filter(r => r.assetId === f.production.trucks[0].id).length, 1);
  assert.equal(assess.strategicComplete, false); assert.equal(assess.state, 'unverified');
  assert.equal(f.networks.accounts.some(a => a.mandate), false); assert.equal(F.publicView(f.state).cityOwnedFuel, 0);
});
test('withdrawal is consequential only after actual reserve depletion; reliable service and personally delivered fuel operate on that same power dependency', () => {
  const held = fixture({ reserveDays: 1 }), supplied = fixture({ reserveDays: 1 });
  held.sign({ ...limits, maxUnitPrice: 1 }); supplied.sign();
  held.tick(3600); supplied.tick(3600);
  assert.ok(held.rule.energy > 0); assert.notEqual(held.rule.status, 'contested');
  held.tick(20 * 3600); supplied.tick(20 * 3600);
  assert.equal(held.rule.energy, 0); assert.equal(held.rule.status, 'contested'); assert.equal(R.condition(held.rule, held.succession, held.people, held.c), 'defense');
  assert.ok(supplied.rule.energy > 0); assert.notEqual(supplied.rule.status, 'contested'); assert.ok(supplied.rule.powerFuel.processed > 0);
  assert.equal(held.c.alive, true); assert.equal(held.rule.accomplishment, null);
  // The old personal-delivery path remains a genuinely independent fallback.
  held.c.at = held.at;
  assert.equal(F.action(held.state, held.rule, held.networks, held.c, held.wallet, 'cancel'), true);
  const stacks = [{ id: 'original-owned-fuel', section: 'resources', key: 'arcaneFeedstock', quantity: 1, carriedBy: 'scientist' }];
  assert.equal(R.recharge(held.rule, held.succession, held.people, held.c, stacks, held.at, 1), true);
  held.tick(60); assert.ok(held.rule.energy > 0); assert.equal(stacks[0].quantity, 0); assert.notEqual(held.rule.status, 'contested');
});
test('stored processing preserves paid city stock after cancellation and agrees across catch-up/save boundaries', () => {
  const a = fixture(), b = fixture(); a.sign(); b.sign(); a.tick(4000); b.tick(4000);
  // Delivered fuel is now original city property, not a reusable free reserve.
  assert.ok(a.rule.powerFuel.stock > 0);
  a.c.at = a.at; b.c.at = b.at;
  F.action(a.state, a.rule, a.networks, a.c, a.wallet, 'cancel'); F.action(b.state, b.rule, b.networks, b.c, b.wallet, 'cancel');
  a.tick(4000); b.tick(4000); a.rule = R.normalize(a.rule); b.rule = R.normalize(b.rule);
  const at = a.at + 10000;
  R.advance(a.rule, a.succession, a.people, () => a.c, at);
  for (let t = b.at + 1; t <= at; t++) R.advance(b.rule, b.succession, b.people, () => b.c, t);
  assert.deepEqual(a.rule, b.rule);
  const bad = copy(a.rule); bad.powerFuel.stock = 24; bad.powerFuel.progress = { work: 1, at, handoverId: bad.handoverId };
  assert.equal(R.normalize(bad), null);
});
