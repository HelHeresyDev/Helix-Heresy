const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../beast-bodies'), A = require('../carrion-lantern-approach'), W = require('../wilderness-beasts');
const C = require('../beast-behavior'), P = require('../beast-populations');
const { windSource } = require('./helpers/wind-source');
const copy = x => JSON.parse(JSON.stringify(x));
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
function native(wind = { x: .2, y: .1 }) {
  const a = W.actor(A.ID, 'airborne-original', { x: 0, y: 0, z: 6 }, 'original-population', 0);
  const terrain = () => ({ floor: true, ceilingM: 100, supportKg: 1e8, oxygen: true, wind, resources: {} });
  return { a, ctx: { alive: true, local: true, tileSizeM: 1, terrain, patch: terrain, actors: [a],
    signal: () => true, lightAt: () => 100, effectLine: () => true, blocked: () => false } };
}
function regional({ wind = { x: .3, y: .4 }, north = 10000, preyX = 10000 } = {}) {
  const src = windSource({ wind, preyX }); src.groups[1].home.northKm = north / 1000;
  const s = P.create(src, { worldId: 'vector-drift', runId: 'original' });
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return s;
}
const valid = s => assert.ok(P.normalize(s), `invalid drift at ${s.clock}`);
function fronts({ wind = { x: .4, y: .2 }, incoming = { x: -.4, y: .2 }, corner = false } = {}) {
  const src = windSource({ wind, preyX: 10000 }), r = src.regions[0];
  for (const [id, normal, entry, flow] of [['east', { x: 1, y: 0 }, { eastM: -10, northM: 0 }, incoming],
    ...(corner ? [['north', { x: 0, y: 1 }, { eastM: 0, northM: -10 }, { x: .2, y: -.4 }]] : [])]) {
    const other = copy(r); other.id = id; other.edges = []; other.wind = flow;
    other.wildlife.pools.forEach(p => { p.id += id; }); src.regions.push(other);
    r.edges.push({ id, distanceKm: .02, traversable: true,
      windBoundary: { normal, offsetM: 10, exit: { eastM: normal.x * 10, northM: normal.y * 10 }, entry } });
  }
  return P.create(src, { worldId: 'vector-front', runId: 'original' });
}

test('native sub-cell drift preserves vector speed, elapsed distance and exact partial save continuation without effort', () => {
  const { a, ctx } = native(); B.advance(a, 1.3, ctx);
  near(B.position(a).eastM, .26); near(B.position(a).northM, .13);
  near(a.bodyPhysics.distanceM, Math.hypot(.2, .1) * 1.3); assert.equal(a.bodyPhysics.spentStamina, 0);
  assert.ok(B.valid(a)); assert.deepEqual(B.observed(a).airOffset, a.bodyPhysics.airOffset);
  const branch = copy(a); B.advance(a, 4.7, ctx); B.advance(branch, 4.7, ctx);
  assert.deepEqual(a, branch); near(B.position(a).eastM, .94); near(B.position(a).northM, .47);
  const chunked = native(); for (const at of [.3, 1.3, 2, 3.1, 4.7]) B.advance(chunked.a, at, chunked.ctx);
  near(B.position(chunked.a).eastM, B.position(a).eastM); near(B.position(chunked.a).northM, B.position(a).northM);
  const bad = copy(a); bad.bodyPhysics.airOffset.x = 2; assert.equal(B.valid(bad), false);
});
test('native off-axis carrion requires earned two-axis movement before actual feeding', () => {
  const { a, ctx } = native({ x: .1, y: .05 });
  const corpse = W.actor('beast:rimefang-pack', 'finite-corpse', { x: 20, y: 12, z: 6 }, 'prey', 0);
  corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0; ctx.actors.push(corpse);
  for (let at = 1; at <= 110 && !a.life.stores.foodKg; at++) { C.step(a, { behavior: 'roam' }, null, at, 1, ctx); B.advance(a, at, ctx); }
  assert.ok(a.life.stores.foodKg > 0); assert.ok(a.mapCell.x > 0 && a.mapCell.y > 0);
  assert.ok(a.bodyPhysics.spentStamina > 0); assert.equal(a.life.carrionApproachOutcome.reason, 'arrived');
});
test('fractional swept masks block diagonal corner cutting and sensing uses actual sub-cell positions', () => {
  const { a, ctx } = native({ x: .2, y: .2 });
  ctx.blocked = cell => cell.x >= 2 || cell.y >= 2;
  B.advance(a, 10, ctx); near(B.position(a).eastM, 0); near(B.position(a).northM, 0);
  assert.ok(a.bodyPhysics.blockedReason); assert.equal(a.bodyPhysics.spentStamina, 0);
  const target = W.actor(A.ID, 'farther-than-the-grid-says', { x: 40, y: 0, z: 6 }, 'other', 0);
  a.bodyPhysics.airOffset = { x: -.3, y: 0 };
  assert.equal(B.perceive(a, target, 'scent', { signal: () => true }), false);
});
test('regional diagonal drift pays one interval, preserves crossings, formation and saved continuation', () => {
  const s = regional(); P.advance(s, 100, true, true); const c = s.groups[0].cohorts[0];
  near(c.regionalPosition.eastM, 30); near(c.regionalPosition.northM, 40); valid(s);
  const branch = P.rebind(s, s, { worldId: s.worldId, runId: 'continued' });
  P.advance(s, 250, true, true); P.advance(branch, 250, true, true);
  assert.deepEqual(s.groups, branch.groups); valid(s); valid(branch);
});
test('off-axis regional carrion is approached and eaten with finite effort, no changed thrust or prey', () => {
  const s = regional({ wind: { x: .1, y: .05 }, north: 12, preyX: 20 }), c = s.groups[0].cohorts[0];
  c.regional.stamina = 300; P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'real-corpse');
  P.advance(s, 30, true, true); assert.equal(c.foraging.phase, 'approach'); assert.equal(c.stores.foodKg, 0);
  assert.ok(c.regionalPosition.eastM > 0 && c.regionalPosition.northM > 0); valid(s);
  P.advance(s, 250, true, true); assert.ok(c.stores.foodKg > 0); assert.ok(c.regional.stamina < 300); valid(s);
});
test('convergence preserves tangential transport while exactly head-on flow still traps bodies', () => {
  const s = fronts(); P.advance(s, 120, true, true); const c = s.groups[0].cohorts[0];
  assert.ok(c.windDrift.front); near(c.regionalPosition.eastM, 10); assert.ok(c.regionalPosition.northM > 20);
  assert.equal(s.groups[0].regionId, 'ground'); assert.ok(s.work.boundaries < 100); valid(s);
  const branch = P.normalize(copy(s)); P.advance(s, 200, true, true); P.advance(branch, 200, true, true);
  assert.deepEqual(s.groups, branch.groups); valid(s); valid(branch);
  const head = fronts({ wind: { x: .4, y: 0 }, incoming: { x: -.4, y: 0 } }); P.advance(head, 120, true, true);
  near(head.groups[0].cohorts[0].regionalPosition.northM, 0); assert.ok(head.groups[0].cohorts[0].windDrift.front); valid(head);
  const bad = copy(s); bad.groups[0].cohorts[0].windDrift.velocity.y = .4; assert.equal(P.normalize(bad), null);
});
test('two simultaneous convergent planes hold a corner rather than crossing into opposing air', () => {
  const s = fronts({ wind: { x: .4, y: .4 }, corner: true }); P.advance(s, 120, true, true);
  assert.equal(s.groups[0].regionId, 'ground'); const pos = s.groups[0].cohorts[0].regionalPosition;
  assert.ok(pos.eastM <= 10.000001 && pos.northM <= 10.000001); valid(s);
  assert.ok(s.groups[0].cohorts[0].windDrift.front.others.length);
  s.regions.find(r => r.id === 'north').wind = { x: .2, y: .4 };
  P.removeStock(s, 'north', 'waterL', 0, s.clock, 'actual-secondary-front-wind-change');
  P.advance(s, 150, true, true);
  assert.equal(s.groups.find(g => g.windDriven && g.cohorts.some(c => P.count(c))).regionId, 'north'); valid(s);
});
test('legacy cardinal regional segments normalize unchanged and retain their already cached direction', () => {
  const s = regional({ wind: { x: .2, y: .1 } }), c = s.groups[0].cohorts[0], d = c.windDrift;
  delete d.vectorFlow; d.velocity = { x: Math.hypot(.2, .1), y: 0 };
  d.signature = JSON.stringify([d.flow, d.velocity, s.groups[0].regionId, undefined]);
  const before = copy(d), saved = P.normalize(copy(s)); assert.ok(saved);
  assert.deepEqual(saved.groups[0].cohorts[0].windDrift, before);
  P.advance(saved, 10, true, true); near(saved.groups[0].cohorts[0].regionalPosition.northM, 0);
  near(saved.groups[0].cohorts[0].regionalPosition.eastM, Math.hypot(.2, .1) * 10); valid(saved);
});

test('oblique separating planes preserve tangential position across a vector crossing', () => {
  const src = windSource({ wind: { x: .3, y: .4 }, preyX: 10000 }), r = src.regions[0], other = copy(r);
  other.id = 'oblique'; other.edges = []; other.wildlife.pools.forEach(p => { p.id += ':oblique'; }); src.regions.push(other);
  r.edges.push({ id: 'oblique', distanceKm: .02, traversable: true,
    windBoundary: { normal: { x: .6, y: .8 }, offsetM: 10, exit: { eastM: 6, northM: 8 }, entry: { eastM: -6, northM: -8 } } });
  const s = P.create(src, { worldId: 'oblique-crossing', runId: 'original' }); P.advance(s, 60, true, true);
  const g = s.groups.find(g => g.windDriven && g.cohorts.some(c => P.count(c)));
  assert.equal(g.regionId, 'oblique'); const pos = g.cohorts.find(c => P.count(c)).regionalPosition;
  near(pos.eastM, 6); near(pos.northM, 8); valid(s);
});
test('legacy native in-flight grid progress finishes once before new fractional advection begins', () => {
  const { a, ctx } = native({ x: .5, y: 0 });
  a.bodyPhysics.motion = { from: copy(a.mapCell), to: { x: 1, y: 0, z: 6 }, distanceM: 1, progressM: .1, excavatedKg: 0 };
  assert.ok(B.valid(a)); B.advance(a, 1.8, ctx);
  assert.equal(a.mapCell.x, 1); assert.equal(a.bodyPhysics.motion, null);
  B.advance(a, 2, ctx); near(B.position(a).eastM, 1.1); near(a.bodyPhysics.distanceM, 1); assert.ok(B.valid(a));
});

test('native offsets use the actual tile scale and pending/refusing bodies receive passive drift, not thrust', () => {
  const scaled = native(); scaled.ctx.tileSizeM = 4; B.advance(scaled.a, 1.3, scaled.ctx);
  near(B.position(scaled.a, 4).eastM, .26); near(B.position(scaled.a, 4).northM, .13);
  assert.ok(Math.abs(scaled.a.bodyPhysics.airOffset.x) < .5); assert.ok(B.valid(scaled.a));
  for (const change of [a => { a.life.pending = { action: 'carrionLight' }; }, a => { a.life.willing = false; }]) {
    const { a, ctx } = native({ x: -.1, y: .05 });
    A.observe(a.life, 0, { id: 'observed-corpse', cell: { x: 20, y: 12, z: 6 },
      position: { eastM: 20, northM: 12, altitudeM: 0 } });
    change(a); B.advance(a, 2, ctx);
    near(B.position(a).eastM, -.2); near(B.position(a).northM, .1); assert.equal(a.bodyPhysics.spentStamina, 0);
  }
});
