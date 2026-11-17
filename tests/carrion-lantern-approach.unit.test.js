const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../carrion-lantern-approach'), P = require('../beast-populations'), F = require('../beast-regional-foodweb');
const W = require('../wilderness-beasts'), C = require('../beast-behavior'), B = require('../beast-bodies'), T = require('../carcass-tissues');
const { windSource } = require('./helpers/wind-source');
const copy = x => JSON.parse(JSON.stringify(x)), binding = { worldId: 'sensed-carrion', runId: 'original' };
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const parts = { bladder: 100, membrane: 100, 'buoyancy organs': 100 };
const delta = { eastM: 20, northM: 0, altitudeM: 0 };
function fixture({ preyX = 20, wind = { x: 0, y: .2 }, members = 1 } = {}) {
  const s = P.create(windSource({ preyX, wind, members, cohorts: 1 }), binding);
  s.groups[0].cohorts[0].regional.stamina = 300;
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'original-carcass'); return s;
}
const valid = s => assert.ok(P.normalize(s), `invalid at ${s.clock}`);
function native({ wind = { x: 0, y: 0 }, x = 20, altitude = 0 } = {}) {
  const a = W.actor(A.ID, 'lantern', { x: 0, y: 0, z: 6 }, 'original', 0);
  const corpse = W.actor('beast:rimefang-pack', 'actual-corpse', { x, y: 0, z: 6 }, 'actual-prey', 0);
  corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0; a.life.stores.fatKg = 0; a.bodyPhysics.altitudeM = altitude;
  const terrain = () => ({ floor: true, ceilingM: 100, supportKg: 1e8, oxygen: true, wind, resources: {} });
  const ctx = { alive: true, local: true, tileSizeM: 1, actors: [a, corpse], terrain, patch: terrain,
    signal: () => true, lightAt: () => 100, effectLine: () => true, blocked: () => false };
  return { a, corpse, ctx };
}
function nativeStep(f, at) {
  C.step(f.a, { behavior: 'roam' }, null, at, 1, f.ctx); B.advance(f.a, at, f.ctx);
}
test('weak thrust can correct a mild crosswind but real strong wind overpowers it', () => {
  const mild = A.course(30, parts, { x: 0, y: .2 }, delta);
  near(mild.velocity.x, .25); near(mild.velocity.y, 0); assert.ok(mild.effortRate > 0);
  const strong = A.course(30, parts, { x: -20, y: 0 }, delta);
  assert.ok(strong.velocity.x < 0); assert.ok(strong.forceN <= strong.maximumForceN + 1e-9);
  assert.equal(A.course(30, parts, null, delta), null);
  assert.equal(A.course(30, { ...parts, membrane: 40 }, { x: 0, y: 0 }, delta), null);
  assert.ok(A.course(30, { ...parts, membrane: 50 }, { x: -1, y: 0 }, delta).maximumForceN < strong.maximumForceN);
});
test('a bounded last-seen pursuit neither tracks hidden new coordinates nor resets its time budget', () => {
  const owner = {}, target = { id: 'original', position: copy(delta) };
  A.observe(owner, 0, target); A.observe(owner, 5, null);
  assert.deepEqual(owner.carrionApproach.target.position, delta); assert.equal(owner.carrionApproach.lastSeenAt, 0);
  A.observe(owner, 6, { id: 'another', position: { ...delta, eastM: 100 } });
  assert.equal(owner.carrionApproach.target.id, 'original');
  A.observe(owner, 12, null); assert.equal(owner.carrionApproach, undefined);
  assert.equal(owner.carrionApproachOutcome.reason, 'lostContact');
  A.observe(owner, 13, target); assert.equal(owner.carrionApproach, undefined);
  A.observe(owner, 312, target); A.observe(owner, 600, target);
  assert.equal(owner.carrionApproach.deadlineAt, 612); A.observe(owner, 612, target);
  assert.equal(owner.carrionApproachOutcome.reason, 'timeBudgetSpent'); assert.ok(A.valid(owner, 612));
});
test('native mild-wind and calm approaches earn movement and effort before actual feeding', () => {
  for (const wind of [{ x: 0, y: 0 }, { x: 0, y: .2 }]) {
    const f = native({ wind }); nativeStep(f, 1);
    assert.equal(f.a.mapCell.x, 0); assert.equal(f.a.life.stores.foodKg, 0);
    for (let at = 2; at <= 110 && !f.a.life.stores.foodKg; at++) nativeStep(f, at);
    assert.ok(f.a.life.stores.foodKg > 0); assert.ok(f.a.bodyPhysics.spentStamina > 0);
    assert.ok(C.distance(f.a, f.corpse, f.ctx) <= 2);
    assert.equal(f.a.life.carrionApproachOutcome.reason, 'arrived');
  }
});
test('native opportunistic sensing uses actual food-store room rather than waiting for fat exhaustion', () => {
  const f = native(); f.a.life.stores.fatKg = 3; nativeStep(f, 1);
  assert.ok(f.a.life.carrionApproach); assert.equal(f.a.life.stores.foodKg, 0);
});
test('native sensory loss, an actual wall and overpowering wind do not award remote tissue', () => {
  const unknown = native({ wind: null, x: 0, altitude: 6 });
  for (let at = 1; at <= 24; at++) nativeStep(unknown, at);
  assert.equal(unknown.a.life.stores.foodKg, 0); near(unknown.a.bodyPhysics.altitudeM, 6);
  const lost = native(); nativeStep(lost, 1); const observed = copy(lost.a.life.carrionApproach.target.position);
  lost.ctx.signal = () => false; lost.corpse.mapCell.x = 1000;
  for (let at = 2; at <= 14; at++) nativeStep(lost, at);
  assert.equal(lost.a.life.carrionApproach, undefined); assert.equal(lost.a.life.stores.foodKg, 0);
  assert.equal(observed.eastM, 20);
  const wall = native(); wall.ctx.blocked = cell => cell.x >= 8;
  for (let at = 1; at <= 310; at++) nativeStep(wall, at);
  assert.ok(wall.a.mapCell.x < 8); assert.equal(wall.a.life.stores.foodKg, 0);
  const gust = native({ wind: { x: -20, y: 0 } });
  for (let at = 1; at <= 120; at++) nativeStep(gust, at);
  assert.ok(gust.a.mapCell.x < 0); assert.equal(gust.a.life.stores.foodKg, 0);
});
test('regional sensing permits an approach, not an advance meal reservation or omniscient target', () => {
  const s = fixture(); P.advance(s, 20, true, true); const c = s.groups[0].cohorts[0], r = s.regions[0];
  assert.equal(c.foraging.phase, 'approach'); assert.equal(c.foraging.mealIds.length, 0);
  assert.equal(c.stores.foodKg, 0); assert.ok(c.regional.stamina < 300); assert.ok(c.regionalPosition.eastM > 0);
  const target = copy(c.carrionApproach.target.position); valid(s);
  P.advance(s, 250, true, true); assert.ok(c.stores.foodKg > 0);
  assert.ok(Math.hypot(c.regionalPosition.eastM - target.eastM, c.regionalPosition.northM - target.northM) <= B.profiles[A.ID].reachM);
  assert.ok(r.foraging.receipts.approachSeconds > 0); valid(s);
  const far = fixture({ preyX: 500 }); P.advance(far, 20, true, true);
  assert.equal(far.groups[0].cohorts[0].carrionApproach, undefined); valid(far);
});
test('another mouth can finish the sensed corpse before arrival; only the old location may be searched', () => {
  const s = fixture(); P.advance(s, 20, true, true);
  const c = s.groups[0].cohorts[0], r = s.regions[0], row = Object.values(r.remainsBatches)[0];
  const target = copy(c.carrionApproach.target.position), eaten = T.take(row, { speciesId: A.ID }, 1e6).kg;
  s.foodWeb.receipts.consumedKg += eaten;
  P.removeStock(s, r.id, 'waterL', 0, s.clock, 'actual-other-mouth');
  P.advance(s, 40, true, true); assert.equal(c.carrionApproach, undefined);
  assert.equal(c.carrionApproachOutcome.reason, 'lostContact'); assert.equal(c.stores.foodKg, 0);
  assert.equal(c.foraging.mealIds.length, 0); assert.equal(target.eastM, 20); valid(s);
});
test('saved partial approach, elapsed effort and last observation continue independently without refunds', () => {
  const s = fixture(); P.advance(s, 20, true, true); const before = copy(s); valid(s);
  const branch = P.rebind(P.normalize(s, binding), binding, { ...binding, runId: 'continued' });
  P.advance(s, 250, true, true); P.advance(branch, 250, true, true);
  assert.deepEqual(s.groups, branch.groups); assert.deepEqual(s.regions, branch.regions); valid(s); valid(branch);
  const dead = copy(before); P.advance(dead, 10000, false, true); assert.deepEqual(dead, before);
  for (const change of [x => x.groups[0].cohorts[0].windDrift.control.forceN++,
    x => x.groups[0].cohorts[0].carrionApproach.deadlineAt++,
    x => x.groups[0].cohorts[0].foraging.action.targetId = 'unseen-source']) {
    const bad = copy(before); change(bad); assert.equal(P.normalize(bad), null);
  }
});
test('unknown air, severe injury, refusal, obstacles and unsensed distant corpses supply no propulsion', () => {
  for (const change of [s => { s.regions[0].wind = null; },
    s => { s.groups[0].cohorts[0].regional.parts.membrane = 20; },
    s => { s.groups[0].willing = false; },
    s => { s.regions[0].contactBarriers = [{ minEastM: 8, maxEastM: 9, minNorthM: -100, maxNorthM: 100, bottomM: -10, topM: 100 }]; }]) {
    const s = fixture(); change(s); P.removeStock(s, 'ground', 'waterL', 0, 0, 'original-interruption');
    P.advance(s, 100, true, true); const c = s.groups[0].cohorts[0];
    assert.ok(!c.windDrift?.control); assert.equal(c.stores.foodKg, 0); valid(s);
  }
});
test('a huge formation cannot borrow one member\'s sensed corpse to steer a million originals', () => {
  const s = fixture({ members: 1000000 }); P.advance(s, 20, true, true);
  const c = s.groups[0].cohorts[0]; assert.equal(c.carrionApproach, undefined);
  assert.ok(s.work.cohortIntervals < 1000); assert.equal(s.groups[0].cohorts.length, 1); valid(s);
});
test('a point corpse separates one actual sensing original instead of trapping an extended formation at a zero-time arrival', () => {
  const s = fixture({ members: 2, wind: { x: 0, y: .2 } });
  P.advance(s, 250, true, true);
  assert.equal(P.audit(s)['population-0'].background, 2);
  assert.equal(s.groups[0].cohorts.length, 2);
  assert.ok(s.groups[0].cohorts.some(c => c.stores.foodKg > 0));
  assert.ok(s.work.boundaries < 200); valid(s);
});
test('starting without effort requires actual supported recovery before propulsion', () => {
  const s = fixture({ wind: { x: 0, y: 0 } }), c = s.groups[0].cohorts[0]; c.regional.stamina = 0;
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-original-exhaustion');
  P.advance(s, 30, true, true); near(c.regionalPosition.eastM, 0); assert.equal(c.foraging.phase, 'search');
  P.advance(s, 80, true, true); assert.equal(c.foraging.phase, 'approach'); assert.ok(c.regionalPosition.eastM > 0);
  valid(s);
});
test('a regional Lantern earns descent to feeding height rather than eating from above', () => {
  const src = windSource({ preyX: 0, wind: { x: 0, y: 0 } });
  src.groups[0].regionalPosition = { regionId: 'ground', eastM: 0, northM: 0, altitudeM: 8, establishedAt: 0 };
  const s = P.create(src, binding), c = s.groups[0].cohorts[0]; c.regional.stamina = 300;
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'ground-carcass');
  P.advance(s, 10, true, true); assert.equal(c.stores.foodKg, 0); assert.ok(c.regionalPosition.altitudeM < 8);
  assert.ok(c.regionalPosition.altitudeM > 2); valid(s);
  P.advance(s, 150, true, true); assert.ok(c.regionalPosition.altitudeM <= B.profiles[A.ID].reachM);
  assert.ok(c.stores.foodKg > 0); valid(s);
});
test('an already reachable protected corpse cannot enter a passive meal claim', () => {
  const s = fixture({ preyX: 0 }), g = s.groups[0]; g.protectedGroupIds = [s.groups[1].id];
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'known-protection'); P.advance(s, 100, true, true);
  assert.equal(g.cohorts[0].stores.foodKg, 0); assert.equal(g.cohorts[0].foraging.mealIds.length, 0);
  assert.equal(g.cohorts[0].carrionApproach, undefined); valid(s);
});
