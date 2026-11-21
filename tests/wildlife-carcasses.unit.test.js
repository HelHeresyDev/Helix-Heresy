const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../background-wildlife'), C = require('../wildlife-carcasses'), T = require('../carcass-tissues');
const P = require('../beast-populations'), F = require('../beast-foraging'), Wind = require('../beast-wind-drift');
const Behavior = require('../beast-behavior'), Predation = require('../beast-predation'), Beasts = require('../wilderness-beasts');
const Approach = require('../carrion-lantern-approach');
const { source } = require('./helpers/carcass-source');
const DAY = P.DAY, binding = { worldId: 'local-carcass-batches', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
const valid = s => assert.ok(P.normalize(s, binding), `invalid at ${s.clock / DAY}`);
function points(s, guild = 'smallAnimals', sizeClass = 'large') {
  const r = s.regions[0], pool = r.wildlife.pools.find(p => p.guild === guild && p.sizeClass === sizeClass && p.habitatPatch === 'hotspot-0');
  const site = pool.spatial, point = { regionId: r.id, eastM: site.eastM, northM: site.northM, altitudeM: 0 };
  return { r, pool, result: C.query(pool, point, site.radiusM * 2) };
}
const ground = () => ({ floor: true, waterDepthM: 0, wind: { x: 0, y: 0 } });
function frame(row, x = 10) {
  const cell = { x: 7 + x, y: 7, z: 6 };
  return { site: { roomId: 'visited-wilds', bounds: { x, y: 0, z: 6, width: 16, height: 16 },
    origin: { eastM: row.position.eastM - 7.25, northM: row.position.northM - 7.25 } }, observer: { cell, altitudeM: 0 } };
}
function feeding(species, cell) {
  const actor = Beasts.actor(`beast:${species}`, 'forager', cell, `original:${species}`, 0);
  actor.life.stores.foodKg = 0; actor.life.stores.fatKg = 0;
  return { actor, context: { alive: true, local: true, tileSizeM: 1, terrain: ground,
    signal: () => true, effectLine: () => true, foodKeys: Behavior.foodKeys } };
}
test('visited carcasses use local reach, senses and the same unreserved inventory across overlapping windows', () => {
  const s = P.create(source(), binding), { r, pool, result } = points(s), row = result.sites[0];
  const { site, observer } = frame(row), overlapping = frame(row, 80);
  const view = (window = { site, observer }, terrain = ground, observe = false) =>
    C.window(r, window.site, window.observer, 4, 1, terrain, observe).find(p => p.id === row.id);
  const body = view(), second = view(overlapping), { actor, context } = feeding('rimefang-pack', observer.cell);
  assert.equal(body.wildlifeCarrion.inventory(), row); assert.equal(second.wildlifeCarrion.inventory(), row);
  assert.equal(second.mapCell.x - body.mapCell.x, 70);
  assert.equal(view({ site: { ...site, bounds: { ...site.bounds, width: 5 } }, observer }), undefined);
  assert.equal(view(undefined, () => ({ ...ground(), protected: true })), undefined);
  assert.equal(view(undefined, undefined, true).wildlifeCarrion, undefined);
  const held = C.reserve(r, row, { speciesId: 'beast:carrion-lantern' }, 1e9);
  assert.ok(held.length); assert.equal(view(), undefined); assert.ok(view(undefined, undefined, true));
  assert.equal(Behavior.consumeRemains(actor, body, 1, 1, context), false);
  for (const p of held) C.release(r, row, p.tissue, p.kg);
  const ctx = { ...context, wildlifeCarrion: () => [body] };
  assert.equal(Predation.carcass(actor, 1, { ...ctx, signal: () => false }), null);
  assert.equal(Predation.carcass(actor, 1, ctx), body);
  assert.equal(Behavior.consumeRemains(actor, body, 1, 1, { ...ctx, effectLine: () => false }), false);
  actor.mapCell = { ...observer.cell, x: observer.cell.x + 3 };
  assert.equal(Behavior.consumeRemains(actor, body, 1, 1, ctx), false);
  actor.mapCell = observer.cell;
  const depletedAt = row.consumedKg, aggregate = pool.carcass.consumedKg;
  assert.equal(Behavior.consumeRemains(actor, body, 1, 1, ctx), true); near(row.consumedKg, depletedAt);
  assert.equal(Behavior.step(actor, { behavior: 'roam' }, null, 2, 1, { ...ctx, patch: () => ({}) }), true);
  assert.ok(row.consumedKg > depletedAt);
  const spent = row.consumedKg;
  near(second.wildlifeCarrion.inventory().consumedKg, spent); near(pool.carcass.consumedKg - aggregate, spent - depletedAt);
  Behavior.consumeRemains(actor, body, 1, 2, ctx); near(row.consumedKg, spent);
  const named = Beasts.actor('beast:rimefang-pack', 'named-death', observer.cell, 'local-test', 0);
  named.status = 'dead'; named.diedAt = 0;
  assert.equal(Behavior.consumeRemains(actor, named, 1, 2, ctx), false);
  valid(s);
  const restored = P.normalize(copy(s), binding);
  near(C.source(restored.regions[0], row.id).consumedKg, spent);
});
test('a local Lantern must finish continuous handling and cannot anchor with reserved or combined bodies', () => {
  const s = P.create(source(), binding), { r, result } = points(s), row = result.sites[0], { site, observer } = frame(row);
  const body = C.window(r, site, observer, 4, 1, ground).find(p => p.id === row.id);
  const { actor, context } = feeding('carrion-lantern', observer.cell);
  actor.bodyPhysics.altitudeM = .2;
  assert.ok(body.wildlifeCarrion.anchorKg() > 0);
  near(body.wildlifeCarrion.anchorKg(), (row.tissues.hard.kg + row.tissues.tough.kg) / Math.max(1, row.count));
  const held = C.reserve(r, row, { carrionDiet: ['hard', 'tough'] }, 1e9);
  near(body.wildlifeCarrion.anchorKg(), 0);
  assert.equal(Behavior.consumeRemains(actor, body, 1, 0, context), false);
  for (const p of held) C.release(r, row, p.tissue, p.kg);
  const consumed = row.consumedKg;
  assert.equal(Behavior.consumeRemains(actor, body, 1, 1, context), true);
  assert.equal(Behavior.consumeRemains(actor, body, 30, 31, context), true);
  actor.bodyPhysics.lastAt = 31;
  Approach.observe(actor.life, 31, { id: body.id, cell: body.mapCell, position: body.wildlifePosition });
  assert.equal(Behavior.step(actor, { behavior: 'roam' }, null, 32, 1, { ...context,
    patch: () => ({}), wildlifeCarrion: () => [body], terrain: () => ({ ...ground(), wind: { x: 100, y: 0 } }) }), true);
  assert.equal(actor.life.wildlifeContact, undefined);
  assert.equal(actor.life.carrionApproachOutcome.reason, 'unable');
  const breezy = { ...context, terrain: () => ({ ...ground(), wind: { x: .1, y: 0 } }) };
  const stamina = actor.bodyPhysics.stamina;
  assert.equal(Behavior.consumeRemains(actor, body, 60, 92, breezy), true);
  assert.equal(Behavior.consumeRemains(actor, body, 60, 152, breezy), true);
  near(row.consumedKg, consumed); assert.ok(actor.bodyPhysics.stamina < stamina);
  assert.equal(Behavior.consumeRemains(actor, body, 1, 153, breezy), true);
  assert.ok(row.consumedKg > consumed); valid(s);
});
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
    const left = C.source(a.regions[0], site.id), right = C.source(b.regions[0], site.id);
    assert.equal(left.count, right.count); assert.deepEqual(left.position, right.position);
    for (const k of T.animalKeys) near(left.tissues[k].kg, right.tissues[k].kg);
  }
  assert.deepEqual(pa.carcassSpace.sites, {}); assert.deepEqual(pb.carcassSpace.sites, {});
  valid(a); valid(b);
});
test('speculative searches leave no saved carcass rows; only real discovery makes a durable site', () => {
  const s = P.create(source(), binding), before = JSON.stringify(s), { r, pool, result } = points(s);
  const row = result.sites[0], { site, observer } = frame(row);
  const observation = C.window(r, site, observer, 4, 1, ground, true).find(c => c.id === row.id);
  assert.ok(observation); assert.equal(observation.wildlifeCarrion, undefined);
  assert.equal(JSON.stringify(s), before, 'queries and render candidates do not amend the world ledger');
  observation.rememberWildlifeRemains();
  assert.deepEqual(Object.keys(pool.carcassSpace.sites), [row.id]);
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  assert.deepEqual(Object.keys(points(saved).pool.carcassSpace.sites), [row.id]);
  P.advance(saved, 3 * DAY, true, true);
  const aged = C.source(saved.regions[0], row.id);
  assert.deepEqual(aged.position, row.position); assert.ok(aged.massKg < row.massKg);
  valid(saved);
});
test('loading an older account drops only untouched projections and keeps real custody and tissue changes', () => {
  const s = P.create(source({ animals: true }), binding), { r, pool, result } = points(s), [untouched, reserved, changed] = result.sites;
  assert.ok(changed);
  pool.carcassSpace.sites[untouched.id] = copy(untouched); // Old speculative representation.
  const g = s.groups[0], c = g.cohorts[0];
  const hold = F.claim(r, g, c, 'wildlife', reserved.id, .05, 0, reserved.position);
  assert.ok(hold); const reservedKg = reserved.reservedKg;
  C.debit(r, changed, 'flesh', 0, .01, false);
  delete reserved.retained; delete changed.retained;
  const old = JSON.stringify(s), saved = P.normalize(copy(s), binding); assert.ok(saved);
  assert.equal(JSON.stringify(s), old);
  const record = points(saved).pool;
  assert.deepEqual(Object.keys(record.carcassSpace.sites).sort(), [reserved.id, changed.id].sort());
  assert.ok(Object.values(record.carcassSpace.sites).every(row => row.retained));
  assert.deepEqual(C.source(saved.regions[0], untouched.id), untouched);
  near(C.source(saved.regions[0], reserved.id).reservedKg, reservedKg);
  assert.deepEqual(C.source(saved.regions[0], changed.id).tissues, changed.tissues);
  assert.deepEqual(record.carcass, pool.carcass); valid(saved);
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
  const s = P.create(source(), binding), { r, result } = points(s), { site, observer } = frame(result.sites[0]);
  C.window(r, site, observer, 4, 1, ground, true).find(c => c.id === result.sites[0].id).rememberWildlifeRemains();
  valid(s);
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
test('a brief downwind arrival starts a real hold, not a free meal or a delayed search', () => {
  const raw = source({ animals: true, wind: { x: 4.3, y: 0 } }), probe = P.create(copy(raw), binding);
  const site = points(probe).result.sites[0];
  Object.assign(raw.groups[0].home, { eastKm: (site.position.eastM - 1.6) / 1000, northKm: (site.position.northM + .43) / 1000 });
  const s = P.create(raw, binding), g = s.groups[0], c = g.cohorts[0], r = s.regions[0];
  P.advance(s, 20, true, true);
  assert.equal(c.foraging.phase, 'handling'); assert.ok(c.windDrift.hold); near(F.summary(s).eatenKg, 0);
  assert.ok(c.regional.stamina < 300);
  const resume = P.normalize(copy(s), binding);
  P.advance(s, 100, true, true); P.advance(resume, 100, true, true);
  assert.ok(F.summary(s).eatenKg > 0); near(F.summary(s).eatenKg, F.summary(resume).eatenKg);
  assert.ok(C.source(r, site.id).consumedKg > 0);
  valid(s); valid(resume);
});
test('aged wildlife remains reserve the necessary grip before food uses the same tissue', () => {
  const s = P.create(source({ animals: true, wind: { x: 5.82, y: 0 } }), binding), { r, result } = points(s);
  const g = s.groups[0], c = g.cohorts[0], body = result.sites.find(row => row.count === 1 && C.anchorLimit(row) > 15);
  assert.ok(body);
  c.regional.stamina = 300;
  const needed = Wind.anchorNeed(c, r, r.wind, body), initialStructure = C.anchorLimit(body);
  for (const [tissue, cell] of Object.entries(body.tissues)) {
    const keep = tissue === 'hard' || tissue === 'tough' ? cell.kg * needed * 1.01 / initialStructure
      : tissue === 'flesh' ? .32 : 0;
    C.debit(r, body, tissue, 0, cell.kg - keep);
  }
  const original = body.massKg, before = body.consumedKg;
  assert.ok(F.claim(r, g, c, 'wildlife', body.id, 3, 0, body.position));
  assert.equal(Wind.holding(g, c, r, r.wind, body.position, true), null, 'food-first custody consumes the needed grip');
  F.cancel(r, c, 0);
  const id = F.claim(r, g, c, 'wildlife', body.id, 3, 0, body.position, needed);
  assert.ok(id); assert.ok(Wind.holding(g, c, r, r.wind, body.position, true));
  assert.ok(r.foraging.meals[id].anchors.reduce((kg, p) => kg + p.kg, 0) >= needed);
  near(body.massKg, original); near(body.consumedKg, before);
  F.cancel(r, c, 0); near(body.reservedKg, 0);
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
