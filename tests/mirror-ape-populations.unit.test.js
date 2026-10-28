const { test } = require('node:test'), assert = require('node:assert/strict');
const P = require('../mirror-ape-populations'), D = require('../beast-diplomacy'), R = require('../regional-encounters');
const W = require('../wilderness-beasts'), Stops = require('../roadside-stops'), M = require('../municipal-supply-threats');
const S = require('../regional-suppression'), I = require('../beast-spell-imitation');
const { sourceFixture } = require('./helpers/beast-diplomacy-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(count = 7) {
  const f = sourceFixture('intercity-march:corridor:ab', 2.25, count), b = { worldId: 'world', runId: 'run' },
    s = D.create(b), r = R.create(b), seed = 'population-35', t = D.register(s, f.source, r, [], seed, 0, f.habitat);
  const group = t.pool.groups.find(g => g.positionKm !== null);
  return { ...f, b, s, r, seed, t, group };
}
function stop(f, km, z = 21) { return Stops.ensure(null, f.b, f.source.routeId, km, 10, z, {}).site; }
function place(f, site, at = 10, enter = () => true) {
  const n = P.materialize(f.t, f.r, site, at, enter); R.place(f.r, site, at, enter); return n;
}
test('only genuine interior habitat overlap supplies bounded physical spans, not the entire road, a city or a wave warning', () => {
  const f = fixture(); assert(f.habitat); assert.equal(f.habitat.spans.length, 1);
  assert(f.habitat.spans[0].startKm > 0); assert(f.habitat.spans[0].endKm < f.source.distanceKm);
  f.map.beastEcology.populations[0].territory.rangeMask = Buffer.from([0]).toString('base64');
  assert.equal(P.habitat(f.map, f.source, f.geometry), null);
  assert.equal(P.validHabitat({ ...f.habitat, originalCount: 1 }, f.source), false);
  assert.equal(P.validHabitat({ ...f.habitat, spans: [{ cellId: 'foreign', startKm: 0, endKm: 10 }] }, f.source), false);
});
test('one immutable original pool partitions every remaining ordinal into small fixed groups and unlocated capacity without allocating a census of bodies', () => {
  const f = fixture(3000); assert.equal(f.r.members.length, 2); assert.equal(f.r.beasts.actors.length, 2);
  assert.equal(f.t.pool.groups.reduce((n, g) => n + g.count, 2), 3000);
  assert(f.t.pool.groups.every(g => g.count <= 2)); assert(f.t.pool.groups.some(g => g.positionKm === null));
  assert(P.valid(f.t.pool, f.source, f.t.memberIds));
  const xs = P.positions(f.t, f.source.routeId).sort((a, b) => a - b);
  assert(xs.every((x, i) => Math.abs(x - f.source.positionKm) >= P.SEPARATION_KM && (!i || x - xs[i - 1] >= P.SEPARATION_KM)));
  const saved = copy(f.t.pool); D.register(f.s, f.source, f.r, f.r.beasts.actors, 'reroll', 1000, f.habitat);
  assert.deepEqual(f.t.pool, saved); assert.equal(R.remaining(f.r, f.source.populationId), 0);
});
test('physically reaching a later reserved group materializes its original identities and original budgets exactly once', () => {
  const f = fixture(), first = stop(f, f.source.positionKm); place(f, first);
  const original = copy(f.r.beasts.actors); assert.equal(f.r.beasts.actors.length, 2);
  const site = stop(f, f.group.positionKm, 22); assert.equal(place(f, site, 40), 2);
  const newcomers = f.r.beasts.actors.filter(a => !original.some(b => b.id === a.id)); assert.equal(newcomers.length, 2);
  assert(newcomers.every(a => a.roomId === site.roomId && a.populationId === f.source.populationId && a.health === 80
    && a.spellImitation.allocatedAt === 0 && a.spellImitation.mana === 48 && a.spellImitation.known.length === 0
    && a.climbStamina === 120 && a.contactWorkSeconds === 900));
  assert.deepEqual(f.r.beasts.actors.slice(0, 2), original); assert.equal(P.positions(f.t, f.source.routeId).length, 0);
  newcomers[0].health = 0; newcomers[0].status = 'dead'; newcomers[1].contactWorkSeconds = 840;
  const saved = copy(f.r.beasts.actors); assert.equal(place(f, site, 1000), 0); assert.deepEqual(f.r.beasts.actors, saved);
  assert.equal(f.t.memberIds.length, 4); assert(P.valid(f.t.pool, f.source, f.t.memberIds));
});
test('other routes, absent patches, blocked projected cells and final death cannot spawn or move a reserved group', () => {
  const f = fixture(), site = stop(f, f.group.positionKm);
  assert.equal(P.materialize(f.t, f.r, { ...site, routeId: 'elsewhere' }, 10, () => true), 0);
  assert.equal(P.materialize(f.t, f.r, stop(f, f.source.positionKm), 10, () => true), 0);
  assert.equal(P.materialize(f.t, f.r, site, 10, () => false), 0);
  assert.equal(P.materialize(f.t, f.r, site, 10, () => true, false), 0);
  assert.equal(f.r.members.length, 2); assert.equal(f.group.materializedAt, null);
  assert.equal(P.positions(f.t, 'elsewhere').length, 0);
});
test('missing legacy or damaged original allocations never gain a new pool, rerolled locations or replacement claimants', () => {
  const f = fixture(), legacy = copy(f.s); delete legacy.troops[0].pool;
  const s = D.normalize(legacy), r = R.normalize(copy(f.r)), t = D.register(s, f.source, r, r.beasts.actors, f.seed, 1000, f.habitat);
  assert.equal(t.pool, undefined); assert.deepEqual(P.positions(t, f.source.routeId), []);
  const broken = copy(f.s); broken.troops[0].pool.seed = 'reroll'; assert(D.normalize(broken).troops[0].pool.invalid);
  const malformed = copy(f.s); malformed.troops[0].pool.groups[0] = null;
  assert(D.normalize(malformed).troops[0].pool.invalid);
  const badHabitat = copy(f.s); badHabitat.troops[0].pool.habitat.spans[0] = null;
  assert(D.normalize(badHabitat).troops[0].pool.invalid);
  const site = stop(f, f.group.positionKm); place(f, site); f.r.beasts.actors.pop();
  assert.equal(place(f, site, 100), 0); assert.equal(f.r.beasts.actors.length, 3);
  // Losing an issuance receipt cannot turn a previously issued ordinal into another healthy body.
  f.group.materializedAt = null; assert.equal(P.materialize(f.t, f.r, site, 200, () => true), 0);
  assert.equal(P.valid(f.t.pool, f.source, f.t.memberIds), false);
});
test('continued copies retain groups, issued identity, wounds and spent spell budgets, while independent starts inherit no encounters', () => {
  const f = fixture(), site = stop(f, f.group.positionKm); place(f, site);
  const a = f.r.beasts.actors.at(-1), c = { alive: true, sourceCurrent: true, local: true, visual: true, conscious: true,
    casterVisible: true, releaseVisible: true, handsFree: true, targetKind: 'creature', targetAlive: true, targetSouled: true,
    targetVisible: true, lineOfEffect: true, distanceM: 3, targetCell: site.entry, casterHeightM: 0, targetHeightM: 0,
    bodyEpoch: 0, visitAt: site.lastVisitedAt, decision: 'pursue' };
  assert(I.observe(a, { id: 'paid:1', casterId: 'scientist', spellId: 'soulLash', at: 10, released: true, paid: true,
    roomId: site.roomId, casterCell: site.entry }, c)); assert(I.begin(a, 'scientist', c, 11)); a.health = 66;
  const b = { worldId: 'world', runId: 'continued' }, s = D.rebind(f.s, f.b, b), r = R.rebind(f.r, f.b, b);
  assert.deepEqual(s.troops[0], f.t); assert.deepEqual(r.beasts.actors, f.r.beasts.actors);
  assert.equal(P.materialize(s.troops[0], r, site, 1000, () => true), 0);
  assert.equal(r.beasts.actors.at(-1).spellImitation.mana, 36); assert(I.advance(r.beasts.actors.at(-1), c, 13));
  assert.equal(D.create(b).troops.length, 0); assert.equal(R.create(b).members.length, 0);
});
test('a genuinely shared carrier crossing can encounter a reserved group, but no carrier registers a new population or teleports an existing body', () => {
  const f = fixture(), quota = { ...f.b, id: 'a:agricultural-quota', source: { cityId: 'a', satelliteId: 'farm',
    routeCellIds: ['planet-cell:00003', 'planet-cell:00002', 'planet-cell:00001'], distanceKm: 2.25 },
    order: { id: 'grain:1', phase: 'outbound' }, vehicle: { id: 'truck', condition: 100, cargoKg: 40 }, driver: { id: 'driver', status: 'alive', health: 100 } };
  const links = M.sources(f.map, quota.source, f.geometry, [{ ...f.route, distanceKm: 2.25 }]);
  assert.equal(links.length, 1); assert.equal(links[0].population.speciesId, P.SPECIES);
  const s = M.create(f.b, quota.source, links, 0); assert(s);
  const candidates = () => M.candidates(s, quota, null, f.r.beasts.actors, [], f.s);
  assert(candidates().some(c => Math.abs(c.corridorKm - f.group.positionKm) < 1e-9));
  assert.equal(M.candidates(s, quota, null, [], [], D.create(f.b)).length, 0);
  const cross = M.crossing(s, quota, candidates(), f.group.positionKm - .001, f.group.positionKm + .001); assert(cross);
  const site = stop(f, cross.corridorKm); place(f, site); assert(M.start(s, quota, cross, site, 10));
  for (let at = 11; at <= 30; at++) M.step(s, quota, site, f.r.beasts.actors, at, { alive: () => true, sight: () => true,
    protectedTarget: (a, targetId) => D.covered(f.s, a, { routeId: f.source.routeId, cityId: 'a', bodyEpoch: 0, trafficIds: ['truck', 'driver'] }, targetId, at),
    canEnter: (a, c) => site.baseline.some(t => W.key(t.cell) === W.key(c)), strike: (a, t, profile) => {
      if (t.id === 'truck') quota.vehicle.condition -= profile.damage; return { ok: true }; } });
  assert(quota.vehicle.condition < 100); assert.equal(f.s.agreements.length, 0);
  assert.deepEqual(M.fact(s, quota, S.create(f.b), f.r.beasts.actors, 30), []);
  const another = { ...site, id: 'far-site', roomId: 'far-room', positionKm: site.positionKm + .2 };
  assert.equal(P.materialize(f.t, f.r, another, 40, () => true), 0);
  assert(f.r.beasts.actors.filter(a => a.id.includes(':4') || a.id.includes(':5')).every(a => a.roomId === site.roomId));
});
test('held individual reports and sightings never publish reserved groups, source counts, routes or unseen collective resolution', () => {
  const f = fixture(), before = D.publicView(f.s); place(f, stop(f, f.group.positionKm));
  assert.deepEqual(D.publicView(f.s), before); assert.equal(D.evidence(f.s).length, 0);
  assert.deepEqual(W.publicKnowledge(f.r.beasts), { sightings: [], tracks: [], heard: null });
  assert(f.t.pool.groups.some(g => g.positionKm === null)); assert.equal(f.t.memberIds.length, 4);
});
test('real individual cognition and exact assent remain valid after another group appears, without extending consent to its members', () => {
  const f = fixture(), first = stop(f, f.source.positionKm); place(f, first, 10);
  const ally = f.r.beasts.actors[0], c = { alive: true, capable: true, visible: true, near: true, sourceCurrent: true, free: true,
    bodyEpoch: 0, siteId: first.id, routeId: first.routeId, cityId: 'a', actorWitness: true, scientistCell: first.entry,
    markers: [-1, 1].map(dx => ({ ...ally.homeCell, x: ally.homeCell.x + dx })), noGo: [ally.homeCell],
    boundary: { siteId: first.id, roomId: first.roomId, cells: [ally.homeCell] }, trafficIds: ['truck', 'driver'] };
  let at = 10;
  function work(n) { for (let i = 0; i < n; i++) { at++; D.advance(f.s, f.r.beasts.actors, () => c, at);
    const intent = D.intent(f.s, ally, c, at); if (intent && at >= ally.nextMoveAt) {
      const next = W.nextStep(ally.mapCell, intent.goal, p => first.baseline.some(t => W.key(t.cell) === W.key(p)) && !D.forbidden(f.s, ally, p));
      if (next) ally.mapCell = copy(next); ally.nextMoveAt = at + 2;
    } } }
  for (const [action, seconds] of [['greet', 60], ['check', 120], ['discuss', 60], ['accept', 60]]) {
    assert(D.begin(f.s, ally, action, c, at, action === 'accept' ? copy(D.contact(f.s, ally).proposal) : null)); work(seconds);
  }
  const signed = copy(f.s.agreements[0]), evidence = D.evidence(f.s), original = copy(ally);
  const site = stop(f, f.group.positionKm, 22); assert.equal(place(f, site, at + 10), 2);
  assert.deepEqual(ally, original); assert.deepEqual(f.s.agreements[0], signed); assert.deepEqual(D.evidence(f.s), evidence);
  assert(D.covered(f.s, ally, c, 'scientist', at + 11)); assert(D.covered(f.s, ally, c, 'truck', at + 11));
  for (const a of f.r.beasts.actors.filter(a => !f.t.pool.initialIds.includes(a.id))) {
    assert.equal(D.covered(f.s, a, c, 'scientist', at + 11), false); assert.equal(D.contact(f.s, a), undefined);
    assert.equal(a.contactWorkSeconds, 900); assert.equal(a.spellImitation.known.length, 0);
  }
  assert(D.evidence(f.s).every(e => e.status === 'unverified')); assert.equal(f.t.source.originalCount, 7);
});
