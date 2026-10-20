const { test } = require('node:test');
const assert = require('node:assert/strict');
const Wild = require('../wilderness-beasts');
const Force = require('../field-force');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = (x, y = 1) => ({ x, y, z: 6 });
function fixture(species = 'beast:rimefang-pack') {
  const beast = Wild.actor(species, 'original-animal', cell(1), 'original-population', 0);
  beast.lastTarget = cell(3); beast.rememberedUntil = 12; beast.nextAttackAt = 0;
  return { beast, decision: { behavior: 'investigate', goal: cell(3) },
    barrier: { cell: cell(2), kind: 'door', closed: true, condition: 100, composition: { primary: 'wood' }, warded: false } };
}
test('a remembered blocked pursuit permits physical wooden-door damage, not cold magical siege damage', () => {
  const f = fixture(); assert(Wild.canBreach(f.beast, f.decision, f.barrier, 1));
  assert.deepEqual(Wild.barrierStrike(f.beast, f.decision, f.barrier, 1), { damage: 6, damageTypes: ['physical'], recovery: 8 });
});
test('species capability distinguishes a predator at a door from a provoked territorial rammer at a wooden wall', () => {
  const f = fixture(); f.barrier.kind = 'constructedWall'; assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
  const elk = fixture('beast:gravebloom-elk'); elk.barrier.kind = 'constructedWall'; elk.beast.provokedUntil = 20;
  elk.decision = Wild.decide(elk.beast, cell(3), 1, false, false);
  assert.equal(elk.decision.behavior, 'investigate'); assert(Wild.barrierStrike(elk.beast, elk.decision, elk.barrier, 1));
  elk.beast.provokedUntil = 0; elk.decision = Wild.decide(elk.beast, cell(3), 1, false, false);
  assert.equal(Wild.canBreach(elk.beast, elk.decision, elk.barrier, 1), false);
});
test('masonry, reinforced wood, metal, lining, coating, seals and wards exceed these animals capability', () => {
  for (const composition of [{ primary: 'stone' }, { primary: 'steel' }, ...['reinforcement', 'lining', 'coating', 'seal'].map(k => ({ primary: 'wood', [k]: 'iron' }))]) {
    const f = fixture(); f.barrier.composition = composition; assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
  }
  const f = fixture(); f.barrier.warded = true; assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
});
test('no target memory, hidden current target, stale memory, flight, return or idle behavior authorizes a breach', () => {
  for (const behavior of ['roam', 'return', 'flee', 'dead']) {
    const f = fixture(); f.decision.behavior = behavior; assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
  }
  const f = fixture(); assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 12), false);
  f.decision.goal = cell(9); assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
  f.decision.goal = cell(3); f.beast.lastTarget = null; assert.equal(Wild.canBreach(f.beast, f.decision, f.barrier, 1), false);
});
test('real wounds, death, spent regional effort, open or destroyed barriers prevent attempts', () => {
  for (const change of [{ health: 10 }, { status: 'dead' }, { effortSeconds: 0 }]) {
    const f = fixture(); Object.assign(f.beast, change); assert.equal(Wild.barrierStrike(f.beast, f.decision, f.barrier, 1), null);
  }
  for (const change of [{ closed: false }, { condition: 0 }, { kind: 'naturalWall' }, { kind: 'fixture' }]) {
    const f = fixture(); Object.assign(f.barrier, change); assert.equal(Wild.barrierStrike(f.beast, f.decision, f.barrier, 1), null);
  }
});
test('strikes require cardinal adjacent access and the same persistent attack cooldown', () => {
  const f = fixture(); f.beast.nextAttackAt = 8;
  assert.equal(Wild.barrierStrike(f.beast, f.decision, f.barrier, 7), null);
  assert(Wild.barrierStrike(f.beast, f.decision, f.barrier, 8));
  for (const c of [cell(2, 2), cell(3), { ...cell(2), z: 7 }]) {
    f.barrier.cell = c; assert.equal(Wild.barrierStrike(f.beast, f.decision, f.barrier, 8), null);
  }
});
test('reload preserves spent clock, target memory and actual contact without generating an encounter or revealing it', () => {
  const f = fixture(), s = { ...Wild.defaultState(), materialized: true, actors: [f.beast] };
  f.beast.barrierContact = { at: 2, cell: cell(2), breached: false }; f.beast.nextAttackAt = 10;
  const saved = Wild.normalizeState(copy(s)); assert.deepEqual(saved, s);
  assert.equal(Wild.barrierStrike(saved.actors[0], f.decision, f.barrier, 9), null);
  assert.deepEqual(Wild.publicKnowledge(saved), { sightings: [], tracks: [], heard: null });
  assert.deepEqual(Wild.normalizeState(Wild.defaultState()).actors, []);
});
test('losing sight retains the last perceived cell rather than tracking the hidden person, then expires', () => {
  const f = fixture(); const hidden = cell(9);
  const decision = Wild.decide(f.beast, hidden, 2, false, false);
  assert.deepEqual(decision.goal, cell(3)); assert.equal(f.beast.rememberedUntil, 12);
  assert.equal(Wild.decide(f.beast, hidden, 12, false, false).behavior, 'roam');
});
test('personal reports copy only original witnesses dated barrier observations; later hidden damage does not update a received account', () => {
  const ids = ['original-guard-1', 'original-guard-2'];
  const contact = { alive: true, capable: true, originalBody: true, originalTrip: true, near: true, reporterIds: [ids[0]] };
  const s = { source: { memberIds: ids }, members: ids.map((id, i) => ({ source: { allocationId: id }, phase: 'watch', dutySeconds: 100,
    actor: { id, name: id, mapCell: cell(i), health: 100, needs: {}, observed: {} } })) };
  s.members[0].actor.observed.animal = { at: 2, name: 'Original animal', cell: cell(1), barrier: { at: 1, cell: cell(2), breached: false } };
  s.members[1].actor.observed.unseen = { at: 3, name: 'Unseen to first guard', cell: cell(9) };
  assert(Force.receive(s, contact, 4)); const received = copy(s.report);
  assert.equal(s.report.members.length, 1); assert.equal(s.report.partial, true);
  assert.deepEqual(s.report.members[0].observations, s.members[0].actor.observed);
  s.members[0].actor.observed.animal.barrier.breached = true;
  assert.deepEqual(s.report, received); assert(!JSON.stringify(s.report).includes('Unseen to first guard'));
  assert.equal(Force.receive(s, { ...contact, near: false, reporterIds: [] }, 5), false);
  assert.deepEqual(s.report, received);
});
