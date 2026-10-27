const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../terrestrial-forces');
const N = require('../network-operations');
const I = require('../network-interdiction');
const R = require('../city-rule');
const { world } = require('./helpers/network-operating-source');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const map = world(); map.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'non-state-network.shared.bastion-contract';
  for (const b of map.strategicNonStateNetworkHistory.branchRows) Object.assign(b, { organizationForm: 'escortChapter', currentStanding: 'licensed' });
  const n = N.create(N.sources(map, 'original:5'), { worldId: 'w', runId: 'r' }, 0, { originalInventory: true });
  const s = G.create(n, 0), b = G.sources(n, 'a')[0]; assert.ok(b);
  const c = { alive: true, capable: true, authority: true, local: true, sourceCurrent: true, cityId: 'a', populationSourceId: 'population:a', busy: false, observed: true };
  const layout = { roomId: 'original-chapter', roomIds: ['original-chapter'], home: { x: 8, y: 8, z: 20 } };
  const f = { map, n, s, b, c, layout, alive: true };
  f.h = { alive: () => f.alive, incapacitated: () => false, threat: () => null, distance: () => 1, strike: () => ({ ok: true }), move: () => false };
  f.open = () => G.open(s, n, b.id, c, layout, 'fixed-original-person', 0);
  f.tick = at => G.advance(f.s, f.n, () => c, at, f.h);
  return f;
}
test('the original reserve and kit remain single inventory-owned resources, with existing damage/duty and finite wages', () => {
  const f = fixture(), worker = f.n.inventories.assets.find(a => a.id === `${f.b.id}:original-reserve-professional`),
    kit = f.n.inventories.assets.find(a => a.id === `${f.b.id}:original-reserve-kit`);
  worker.state.health = 61; worker.state.workSeconds = 100; kit.state.vestCondition = 47;
  assert.equal(f.open(), true); const a = G.actors(f.s, f.n)[0];
  assert.equal(a, worker.state); assert.equal(a.fieldKit, kit.state); assert.equal(a.health, 61); assert.equal(a.fieldKit.vestCondition, 47);
  assert.equal(worker.ledger, 'inventory'); assert.equal(JSON.stringify(f.s).includes('"health"'), false);
  const money = f.n.inventories.assets.find(a => a.id === `${f.b.id}:non-office-reserve`).state;
  f.tick(60); assert.equal(a.workSeconds, 40); assert.equal(money.money, 239); assert.equal(a.money, 1);
  assert.equal(f.n.accounts.find(a => a.id === f.b.id).money, 240);
  f.tick(110); assert.equal(a.workSeconds, 0); assert.equal(f.s.posts[0].phase, 'offDuty');
  assert.equal(f.open(), true); assert.equal(a.workSeconds, 0); assert.equal(f.s.posts.length, 1);
  assert.equal(f.n.inventories.assets.filter(x => x.id === a.id).length, 1);
});
test('authority, original premises/population provenance, civilian duties and independent owners cannot be bypassed', () => {
  for (const key of ['alive', 'capable', 'authority', 'local', 'sourceCurrent']) {
    const f = fixture(); f.c[key] = false; assert.equal(f.open(), false); assert.equal(f.s.posts.length, 0);
  }
  const f = fixture(); const a = f.n.inventories.assets.find(a => a.id === `${f.b.id}:original-reserve-professional`);
  a.state.assignment = 'earlier-original-obligation'; assert.equal(f.open(), false);
  a.state.assignment = null; a.ownerId = 'another-owner'; assert.equal(f.open(), false);
  const other = fixture(); other.c.populationSourceId = 'another-city-population'; assert.equal(other.open(), false);
  const wrongPlan = fixture(); wrongPlan.n.source.inventoryPlan.assets.find(a => a.id === `${wrongPlan.b.id}:original-reserve-kit`).populationSourceId = 'different-originals';
  assert.equal(wrongPlan.open(), false);
});
test('coarse, fine and restored duty debit the same original wages; disconnected provenance cannot work or fund a replacement', () => {
  const a = fixture(), b = fixture(); a.open(); b.open(); a.tick(137);
  for (let t = 1; t <= 137; t++) b.tick(t);
  assert.deepEqual(copy([a.s, a.n]), copy([b.s, b.n]));
  b.s = G.normalize(b.s); b.n = N.normalize(b.n); a.tick(181); b.tick(181);
  assert.deepEqual(copy([a.s, a.n]), copy([b.s, b.n]));
  const worker = G.actors(a.s, a.n)[0], work = worker.workSeconds;
  a.c.sourceCurrent = false; a.tick(240); assert.equal(worker.workSeconds, work); assert.equal(a.s.posts[0].phase, 'unverified');
  a.c.sourceCurrent = true; a.tick(241); assert.equal(worker.workSeconds, work - 1);
});
test('restored posts resolve the same worn originals, missing books/assets never regenerate and reports stay dated', () => {
  const f = fixture(); f.open(); f.tick(73);
  assert.equal(G.receive(f.s, f.n, f.s.posts[0].id, f.c, 73), true); const report = G.publicView(f.s);
  f.s = G.normalize(f.s); f.n = N.normalize(f.n); assert.equal(G.actors(f.s, f.n)[0].workSeconds, 14400 - 73);
  f.tick(120); assert.deepEqual(G.publicView(f.s), report);
  const p = f.s.posts[0]; f.s.posts = [];
  assert.equal(G.open(f.s, f.n, f.b.id, f.c, f.layout, 'other-seed', 120), false);
  f.s.posts.push(p); f.n.inventories.assets = f.n.inventories.assets.filter(a => a.id !== p.kitId);
  assert.deepEqual(G.actors(f.s, f.n), []); assert.equal(G.open(f.s, f.n, f.b.id, f.c, f.layout, 'other-seed', 120), false);
  assert.equal(G.outcomes(f.n, { terrestrialForces: f.s }).owners.find(o => o.id === `branch:${f.b.id}`).means.find(m => m.id === p.actorId).state, 'unverified');
});
test('scoped defensive combat uses real hooks and freezes at final death, including mid-update death and continued binding', () => {
  const f = fixture(); f.open(); const a = G.actors(f.s, f.n)[0];
  f.h.threat = () => ({ id: 'scientist', kind: 'creature', cell: { x: 8, y: 9, z: 20 } });
  f.h.strike = () => { f.alive = false; return { ok: true }; };
  f.tick(10); assert.equal(f.s.lastAt, 1); assert.equal(a.fieldKit.toolCondition, 99);
  const before = copy([f.s, f.n]); f.tick(100); assert.deepEqual(copy([f.s, f.n]), before);
  const to = { worldId: 'continued-world', runId: 'continued-run' };
  const next = G.rebind(f.s, f.n, to), owners = N.rebind(f.n, f.n, to);
  assert.equal(G.actors(next, owners)[0].health, a.health); assert.equal(G.actors(next, owners)[0].fieldKit.toolCondition, 99);
  assert.deepEqual(G.actors(next, f.n), []);
});
test('original training and private defensive equipment are not offensive armies, and missing service owners remain unverified', () => {
  const f = fixture(); const outcomes = G.outcomes(f.n, {}), owner = outcomes.owners.find(o => o.id === `branch:${f.b.id}`);
  assert.equal(owner.means.find(m => m.id.endsWith('original-reserve-professional')).state, 'ownPremisesDefenseOnly');
  const a = f.n.inventories.assets.find(a => a.id.endsWith('original-reserve-professional')); a.lost = true;
  assert.equal(G.outcomes(f.n, {}).owners.flatMap(o => o.means).find(m => m.id === a.id).state, 'unverified');
  const legacy = copy(f.n); legacy.inventories.mode = 'legacyUnknown'; assert.deepEqual(G.sources(legacy), []);
  f.map.strategicNonStateNetworkHistory.branchRows[0].organizationForm = 'trainingHall';
  const training = N.create(N.sources(f.map, 'original:5'), f.n, 0, { originalInventory: true });
  const teacher = G.outcomes(training, {}).owners.flatMap(o => o.means).find(m => m.id === 'branch:a:original-instructor');
  assert.equal(teacher.state, 'ordinaryTrainingOnly'); assert.ok(!G.sources(training).some(b => b.id === 'branch:a'));
  assert.ok(!I.originalSources(training).some(b => b.branchId === 'branch:a'));
});
test('actual original field allocations are consumed despite limited ratings; losses and service handoffs keep the same IDs', () => {
  const f = fixture(); f.map.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'limited';
  const n = N.create(N.sources(f.map, 'original:5'), f.n, 0, { originalInventory: true }), source = I.originalSources(n);
  assert.equal(I.sources(f.map).length, 0); assert.equal(source.length, 3);
  const inventories = require('../network-inventories'), model = I.create(source, n, 'original-employees', 0);
  const worker = n.inventories.assets.find(a => a.id === `${source[0].id}:1`); worker.state.health = 49;
  assert.ok(inventories.adopt(n, 'interdiction', model, n)); assert.equal(model.units[0].actors[0].health, 49);
  assert.deepEqual(I.originalSources(n), source); assert.equal(inventories.adopt(n, 'interdiction', I.create(source, n, 'another-seed', 0), n), null);
  const run = { networkInterdiction: model };
  assert.ok(G.outcomes(n, run).owners.flatMap(o => o.means).every(m => m.state !== 'unverified'));
});
test('ground reach requires actual outward/return duty and provisions; a passenger itinerary cannot clear a joint stronghold', () => {
  const actors = [1, 2].map(id => ({ id: `original:${id}`, status: 'alive', health: 100, workSeconds: 43200,
    foodSeconds: 43200, waterSeconds: 43200, fieldKit: { toolCondition: 100 }, physicalControl: { stamina: 80 } }));
  const u = { source: { cityId: 'a' }, actors }, c = { sourceCurrent: true, routeOpen: true,
    link: { endpointCityIds: ['a', 'b'], originCityId: 'a', corridorKm: 1, distanceKm: 3, strongholds: [] } };
  assert.equal(G.reach(u, c).state, 'supportedFootJourney');
  c.link.strongholds.push({ id: 'joint:ab', corridorKm: .5 }); assert.equal(G.reach(u, c).state, 'unverifiedPassage');
  c.passengerInspection = true; assert.equal(G.reach(u, c).state, 'unverifiedPassage');
  c.link.strongholds = []; actors[0].assignment = 'paid-civilian-duty'; assert.equal(G.reach(u, c).state, 'unavailable');
  actors[0].assignment = null; actors[1].waterSeconds = 10; assert.equal(G.reach(u, c).state, 'unavailable');
  actors[1].waterSeconds = 43200; c.link.corridorKm = 1000; assert.equal(G.reach(u, c).state, 'unavailable');
});
test('one actual deployed force holds only its named city/farm, preserving original convoy cargo and real buffer consequences', () => {
  const source = sources('b').operation;
  const people = R.ROLES.map(role => ({ id: role, status: 'alive', health: 100 }));
  const agreements = source.institutions.map(i => ({ personId: i.role, institutionId: i.id, roles: [i.role], termsId: 'terms' }));
  const succession = { source: { cityId: 'b', charterId: source.charterId, authority: { id: source.baselineAuthorityId } }, officeId: 'office:b',
    handover: { id: 'handover:b', termsId: 'terms', bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'handover:b', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const rule = R.createAggregate(source, succession, { worldId: 'w', runId: 'r' }, 0, { id: 'ward:b', initialEnergy: 69120 });
  const c = { alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true, bodyEpoch: 0, sourceCurrent: true,
    institutionsAvailable: true, defenseAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge', pilotSupplied: true, pilotDefended: true, routes: { 'farm:b': true } };
  R.order(rule, succession, people, c, 0); R.advance(rule, succession, people, () => c, 3600);
  const unit = { phase: 'deployed', deployment: { id: 'actual-trip', link: { cityId: 'b', satelliteId: 'farm:b', targetRuleId: rule.id, farmKm: .1 }, charterReceiptId: rule.handoverId },
    actors: [{ status: 'alive', health: 100, workSeconds: 10000, foodSeconds: 10000, waterSeconds: 10000, physicalControl: { stamina: 80 }, mapCell: { x: 8, y: 8, z: 20 }, assignment: 'actual-trip', fieldKit: { toolCondition: 100 } }] };
  const force = { worldId: 'w', runId: 'r', units: [unit] };
  assert.equal(I.blocks(force, 'b', 'farm:b', rule.handoverId, rule), true); assert.equal(I.blocks(force, 'a', 'farm:b', rule.handoverId), false);
  assert.equal(I.blocks(force, 'b', 'farm:b', 'later-government'), false);
  assert.equal(I.blocks(force, 'b', 'farm:b', rule.handoverId, { worldId: 'another-world', runId: 'r' }), false);
  const farm = rule.farms[0], cargo = farm.cargoKg;
  c.routes['farm:b'] = false; c.armedRouteHolds = ['farm:b'];
  c.armedRouteCrossings = { 'farm:b': I.crossings(force, 'b', 'farm:b', rule.handoverId, rule) };
  R.advance(rule, succession, people, () => c, 3 * 86400);
  assert.equal(rule.foodKg, 0); assert.ok(rule.unmetKg > 0); assert.equal(rule.status, 'contested');
  assert.equal(farm.cargoKg, cargo); assert.ok(farm.stockKg > 0); assert.ok(farm.cropKg < farm.initialCropKg);
  const inbound = (2 * farm.distanceKm - .1) / 40 * 3600 + Math.ceil(cargo / (50 * farm.drivers)) * 30;
  assert.ok(Math.abs(farm.trip.progress - 9) < 1e-7 || Math.abs(farm.trip.progress - inbound) < 1e-7);
  assert.ok(R.receive(rule, succession, people, c, 3 * 86400));
  assert.equal(rule.report.pendingDeliveries[0].overdue, true); assert.equal(rule.report.pendingDeliveries[0].expectedKg, cargo);
  assert.doesNotMatch(JSON.stringify(rule.report.pendingDeliveries), /actual-trip|positionKm|originalField/);
  const received = copy(rule.report);
  unit.deployment.ceasefire = { at: 3 * 86400 }; assert.equal(I.blocks(force, 'b', 'farm:b', rule.handoverId, rule), false);
  c.routes['farm:b'] = true; c.armedRouteHolds = []; c.armedRouteCrossings = {}; R.advance(rule, succession, people, () => c, 3 * 86400 + 3600);
  assert.ok(farm.deliveredKg >= cargo); assert.deepEqual(rule.report, received);
});
