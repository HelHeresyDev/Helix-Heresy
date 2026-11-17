const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../background-wildlife'), C = require('../wildlife-carcasses'), T = require('../carcass-tissues');
const P = require('../beast-populations'), F = require('../beast-foraging'), Wind = require('../beast-wind-drift');
const { source } = require('./helpers/carcass-source');
const DAY = P.DAY, binding = { worldId: 'local-carcass-batches', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const valid = s => assert.ok(P.normalize(s, binding), `invalid at ${s.clock / DAY}`);
function points(s, guild = 'smallAnimals', sizeClass = 'large') {
  const r = s.regions[0], pool = r.wildlife.pools.find(p => p.guild === guild && p.sizeClass === sizeClass && p.habitatPatch === 'hotspot-0');
  const site = pool.spatial, point = { regionId: r.id, eastM: site.eastM, northM: site.northM, altitudeM: 0 };
  return { r, pool, result: C.query(pool, point, site.radiusM * 2) };
}
test('initial and subsequent local corpses partition real original deaths and preserve all tissue ages', () => {
  const s = P.create(source(), binding), { r, pool, result } = points(s);
  assert.equal(result.complete, true); assert.ok(result.sites.length);
  assert.equal(result.sites.reduce((n, p) => n + p.count, 0), pool.deadCount);
  for (const key of T.animalKeys) for (const field of ['initialKg', 'kg', 'decomposedKg'])
    near(result.sites.reduce((n, p) => n + p.tissues[key][field], 0), pool.carcass.tissues[key][field]);
  valid(s); P.advance(s, 3 * DAY, true, true); valid(s);
  assert.ok(C.valid(pool, r.id, s.clock));
});
test('a local encounter finds body-sized remains, not the habitat-wide fractional smear', () => {
  const s = P.create(source(), binding), { r, pool, result } = points(s), site = result.sites[0];
  const q = { scavenge: true, memberCount: 1, guilds: [pool.id], success: 1, areaHa: Math.PI * 2 ** 2 / 10000,
    position: copy(site.position), depthM: 0, id: 'actual-local-contact' };
  const claims = W.capture(r, {}, {}, q, 3, 0);
  assert.ok(claims.some(c => c.sourceId === site.id && c.kg > .1));
  const away = { ...q, position: { ...q.position, eastM: q.position.eastM + 100000 } };
  assert.deepEqual(W.capture(r, {}, {}, away, 3, 0), []);
  assert.equal(W.summary(s).hunted, 0); assert.equal(W.summary(s).consumedKg, 0); valid(s);
});
test('local views do not duplicate custody, consumption, mineral output or decomposed matter', () => {
  const raw = source({ animals: true }), probe = P.create(copy(raw), binding), point = points(probe).result.sites[0].position;
  Object.assign(raw.groups[0].home, { eastKm: point.eastM / 1000, northKm: point.northM / 1000 });
  const s = P.create(raw, binding); P.advance(s, 250, true, true);
  assert.ok(F.summary(s).eatenKg > .1); near(F.summary(s).eatenKg, W.summary(s).consumedKg);
  assert.ok(Object.values(s.regions[0].foraging.meals).every(m => !m.field));
  assert.ok(s.regions[0].outputs.carrionMineralsKg > 0); valid(s);
  const branch = P.rebind(P.normalize(s, binding), binding, { ...binding, runId: 'continued' });
  P.advance(s, 2 * DAY, true, true); P.advance(branch, 2 * DAY, true, true);
  assert.deepEqual(s.regions, branch.regions); assert.deepEqual(s.groups, branch.groups); valid(s);
});
test('query order and elapsed-time partitions do not move remains or reroll their actual body counts', () => {
  const raw = source(), a = P.create(copy(raw), binding), b = P.create(copy(raw), binding);
  const sites = points(a).result.sites.map(s => ({ id: s.id, position: copy(s.position) }));
  P.advance(a, 3 * DAY, true, true);
  P.advance(b, DAY, true, true); P.advance(b, 2 * DAY, true, true); P.advance(b, 3 * DAY, true, true);
  const pa = points(a).pool, pb = points(b).pool;
  for (const site of sites.reverse()) C.query(pb, site.position, 1);
  for (const site of sites) {
    const left = pa.carcassSpace.sites[site.id], right = pb.carcassSpace.sites[site.id];
    assert.equal(left.count, right.count); assert.deepEqual(left.position, right.position);
    for (const k of T.animalKeys) near(left.tissues[k].kg, right.tissues[k].kg);
  }
  valid(a); valid(b);
});
test('a million-fold population increase changes counts, not the number of local sites or unqueried animals', () => {
  const work = [];
  for (const scale of [100, 1e8]) {
    const s = P.create(source({ scale, areaHa: 1 }), binding);
    assert.ok(s.regions[0].wildlife.pools.every(p => Object.keys(p.carcassSpace.sites).length === 0));
    const { pool, result } = points(s); work.push({ visits: result.visits, sites: result.sites.length, count: pool.deadCount }); valid(s);
  }
  assert.ok(work[1].count > work[0].count * 1e5);
  assert.ok(work[1].sites < work[0].sites * 3); assert.ok(work[1].visits < work[0].visits * 3);
});
test('query budgets are explicit and cannot mint corpses outside the fixed original layout', () => {
  const s = P.create(source(), binding), { pool } = points(s), at = copy(pool.carcass);
  const pos = { regionId: 'ground', eastM: 0, northM: 0, altitudeM: 0 };
  const limited = C.query(pool, pos, 1e6, pos, 1); assert.equal(limited.visits, 1); assert.equal(limited.complete, false);
  assert.deepEqual(C.query(pool, { ...pos, regionId: 'unknown' }, 1e6).sites, []);
  assert.deepEqual(pool.carcass, at); valid(s);
});
test('forged spatial deaths, positions, tissue custody and counters are rejected on import', () => {
  const s = P.create(source(), binding); points(s); valid(s);
  for (const mutate of [space => space.count++, space => space.events[0][1]++,
    space => { Object.values(space.sites)[0].position.eastM++; }, space => { Object.values(space.sites)[0].count++; },
    space => { Object.values(space.sites)[0].tissues.flesh.reservedKg++; }]) {
    const bad = copy(s), pool = points(bad).pool; mutate(pool.carcassSpace); assert.ok(!P.normalize(bad));
  }
});
test('one real large corpse can support a paid feeding hold and leaving it releases its finite claim', () => {
  const raw = source({ animals: true, wind: { x: .5, y: 0 } }), probe = P.create(copy(raw), binding);
  const site = points(probe).result.sites[0], g = raw.groups[0];
  Object.assign(g.home, { eastKm: site.position.eastM / 1000, northKm: site.position.northM / 1000 });
  const s = P.create(raw, binding); P.advance(s, 250, true, true);
  const c = s.groups[0].cohorts[0], r = s.regions[0];
  assert.ok(c.windDrift.hold); assert.ok(F.summary(s).eatenKg > 0); valid(s);
  const eaten = F.summary(s).eatenKg; r.wind = { x: 20, y: 0 };
  P.removeStock(s, r.id, 'waterL', 0, s.clock, 'actual-gust'); P.advance(s, 350, true, true);
  assert.ok(!c.windDrift.hold); assert.equal(c.foraging.mealIds.length, 0);
  assert.ok(F.summary(s).eatenKg - eaten < .01); valid(s);
});
test('many tiny corpses cannot supply a collective anchor or turn clipped handling into earned ingestion', () => {
  const raw = source({ animals: true, wind: { x: .5, y: 0 } }), probe = P.create(copy(raw), binding);
  const site = points(probe, 'insects', 'small').result.sites[0], g = raw.groups[0];
  Object.assign(g.home, { eastKm: site.position.eastM / 1000, northKm: site.position.northM / 1000 });
  const s = P.create(raw, binding), r = s.regions[0], c = s.groups[0].cohorts[0];
  const pool = r.wildlife.pools.find(p => p.id === site.poolId), local = C.query(pool, site.position, 1).sites[0];
  assert.ok(local.massKg > 100); assert.ok(C.anchorLimit(local) < .001);
  assert.equal(Wind.canFeedAt(s.groups[0], c, r, local), false);
  F.cancel(r, c, 0); F.claim(r, s.groups[0], c, 'wildlife', local.id, 3, 0, site.position);
  assert.equal(Wind.holding(s.groups[0], c, r, r.wind, site.position, true), null);
  P.removeStock(s, r.id, 'waterL', 0, 0, 'actual-short-contact');
  P.advance(s, 20, true, true); assert.equal(F.summary(s).eatenKg, 0); assert.ok(!c.windDrift.hold); valid(s);
});
test('funded predator kills leave positioned, class-specific leftovers for a different scavenger', () => {
  const s = P.create(source(), binding), { r, pool } = points(s);
  const point = { regionId: r.id, eastM: pool.spatial.eastM, northM: pool.spatial.northM, altitudeM: 0 };
  const q = { id: 'paid-predator-catch', scavenge: false, speciesId: 'beast:glasswing-roc', guilds: [pool.id],
    memberCount: 1, success: 1, areaHa: pool.areaHa, depthM: 0, position: point };
  const before = pool.huntedCount;
  const claims = W.capture(r, { speciesId: q.speciesId }, {}, q, 3, 0);
  assert.ok(pool.huntedCount > before);
  const kill = Object.values(pool.carcassSpace.sites).find(row => row.killCell != null);
  assert.deepEqual(kill.position, point); assert.ok(claims.some(p => p.sourceId === kill.id));
  const flesh = C.reserve(r, kill, { speciesId: q.speciesId }, 1e9);
  for (const part of flesh) C.debit(r, kill, part.tissue, part.kg, 0, true);
  assert.equal(T.available(kill, { speciesId: q.speciesId }), 0);
  assert.ok(T.available(kill, { speciesId: 'beast:carrion-lantern' }) > 0);
  assert.ok(kill.tissues.hard.kg > 0); valid(s);
});
test('handling requirements and prototype names cannot forge local food custody on import', () => {
  const raw = source({ animals: true }), probe = P.create(copy(raw), binding), site = points(probe).result.sites[0];
  Object.assign(raw.groups[0].home, { eastKm: site.position.eastM / 1000, northKm: site.position.northM / 1000 });
  const s = P.create(raw, binding); P.advance(s, 20, true, true);
  const c = s.groups[0].cohorts[0]; assert.equal(c.foraging.phase, 'handling'); assert.equal(c.foraging.action.requiredSeconds, 60); valid(s);
  const bad = copy(s); bad.groups[0].cohorts[0].foraging.action.requiredSeconds = 1; assert.ok(!P.normalize(bad));
  assert.equal(C.source(s.regions[0], 'constructor'), null); assert.equal(C.source(s.regions[0], '__proto__'), null);
});
