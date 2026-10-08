const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../creation-cooperation');
const a = () => ({ id: 'person', name: 'Individual', actorKind: 'homunculus', family: 'homunculus', status: 'stabilizing', maturity: 1,
  chamberId: '', health: 100, foodHours: 24, waterHours: 24, fatigue: 0, stress: 0, skills: {}, agreement: null });
const plan = () => ({ ok: true, roomId: 'lab', source: { x: 1, y: 1, z: 0 }, destination: { x: 2, y: 1, z: 0 },
  route: [{ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }], cargoId: 'real-water', mealId: 'real-meal', waterId: 'reward-water' });
const reserve = () => ({ cargo: 'real-water', meal: 'real-meal', water: 'reward-water' });
function fixture() {
  const s = C.create(), actor = a(), contact = { understood: true, restUntil: 0, lastSessionAt: null }, p = plan();
  const calls = [], hooks = { actor: () => actor, witness: () => true, rewardIntact: () => true, danger: () => false,
    release: r => calls.push(`release:${r.id}`), step: (r, executor, lesson) => { calls.push(executor); if (!lesson) { r.worked = true; r.delivered++; } return { done: lesson || r.delivered === 2 }; } };
  const rest = () => { s.lastAt += C.REST; actor.fatigue = 0; };
  function train() {
    assert.equal(C.lesson(s, actor, 'demonstrate', p, contact, s.lastAt, reserve).ok, true); C.advance(s, s.lastAt + C.LESSON, hooks);
    for (let n = 0; n < 2; n++) { rest(); assert.equal(C.lesson(s, actor, 'check', p, contact, s.lastAt, reserve).ok, true); C.advance(s, s.lastAt + C.LESSON, hooks); }
    rest();
  }
  return { s, actor, contact, p, hooks, calls, train };
}
test('continue/stop, creator status and skill labels alone never authorize carrying; slimes cannot negotiate', () => {
  const f = fixture(); let reservations = 0;
  assert.equal(C.propose(f.s, f.actor, f.p, f.contact, 0, () => { reservations++; }).ok, false);
  for (const other of [{ ...f.actor, family: 'slime' }, { ...f.actor, genome: 'slime' }, { ...f.actor, maturity: 0 }, { ...f.actor, chamberId: 'chamber' }])
    assert.equal(C.lesson(f.s, other, 'demonstrate', f.p, f.contact, 0, reserve).ok, false);
  assert.equal(reservations, 0); assert.equal(f.actor.agreement, null);
});
test('actual demonstration then two spaced unguided checks teach only this route and independent handling', () => {
  const f = fixture(); f.train(); assert.equal(f.s.learning.person.checks, 2); assert.equal(f.actor.skills.handling, 2);
  assert.ok(f.calls.includes('scientist')); assert.ok(f.calls.includes('person'));
  const changed = { ...f.p, destination: { x: 3, y: 1, z: 0 } };
  assert.equal(C.propose(f.s, f.actor, changed, f.contact, f.s.lastAt, reserve).ok, false);
  assert.equal(C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve).ok, true);
  assert.equal(f.actor.agreement.kind, 'one-delivery');
});
test('no surviving witness, completed physical round trip or recovery means no free learning', () => {
  const f = fixture(); C.lesson(f.s, f.actor, 'demonstrate', f.p, f.contact, 0, reserve);
  C.advance(f.s, 600, { ...f.hooks, step: () => ({}) }); assert.equal(f.s.learning.person, undefined);
  C.advance(f.s, 610, { ...f.hooks, witness: () => false }); assert.equal(f.s.lessons[0].status, 'interrupted'); assert.equal(f.s.learning.person, undefined);
  const g = fixture(); C.lesson(g.s, g.actor, 'demonstrate', g.p, g.contact, 0, reserve); C.advance(g.s, 600, g.hooks);
  assert.equal(C.lesson(g.s, g.actor, 'check', g.p, g.contact, 600, reserve).ok, false);
});
test('atomic reservation failure consumes no agreement, creates no cargo or reward and cannot substitute stock', () => {
  const f = fixture(); f.train(); assert.equal(C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, () => null).ok, false);
  assert.equal(f.s.orders.length, 0); assert.equal(f.actor.agreement, null);
});
test('authorized independent work continues without a scientist witness while reports remain dated', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  C.observe(f.s, f.actor, f.s.lastAt); const known = JSON.stringify(f.s.knowledge);
  C.advance(f.s, f.s.lastAt + 20, { ...f.hooks, witness: () => false });
  assert.equal(order.delivered, 2); assert.equal(order.status, 'awaitingReward'); assert.equal(order.paid, false);
  assert.equal(JSON.stringify(f.s.knowledge), known); assert.equal(f.actor.agreement, null);
});
test('pain and changed route interrupt with real partial deliveries and held custody preserved', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  order.carriedStackId = 'held-original-portion'; order.delivered = 1; f.actor.health = 65;
  C.advance(f.s, f.s.lastAt + 10, f.hooks); assert.equal(order.status, 'paused'); assert.equal(order.delivered, 1); assert.equal(order.carriedStackId, 'held-original-portion');
  assert.equal(C.resume(f.s, order, f.actor, f.contact, f.s.lastAt, () => true).ok, false);
  f.actor.health = 100; f.s.lastAt += C.REST;
  assert.equal(C.resume(f.s, order, f.actor, f.contact, f.s.lastAt, () => false).ok, false);
});
test('lost original reward stops work and records an identity-bound broken promise across reload', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  C.advance(f.s, f.s.lastAt + 10, { ...f.hooks, rewardIntact: () => false });
  assert.equal(order.status, 'paused'); assert.equal(order.delivered, 0); assert.equal(order.broken, true);
  const saved = C.normalize(f.s); assert.deepEqual(saved.relationships.person.brokenPromises, [order.id]);
  f.contact.lastSessionAt = null; assert.match(C.readiness(saved, f.actor, f.contact, f.s.lastAt + C.REST), /promise/);
});
test('started cancellation preserves promised compensation and actual payment is received exactly once', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  order.worked = true; order.delivered = 1; let kept;
  assert.equal(C.cancel(f.s, order, f.actor, f.s.lastAt, (r, reward) => { kept = reward; }), true); assert.equal(kept, true);
  assert.equal(order.delivered, 1); assert.equal(order.paid, false); assert.equal(f.s.relationships.person.brokenPromises.length, 1);
  assert.equal(C.pay(f.s, order, f.actor, f.s.lastAt, () => false), false);
  assert.equal(C.pay(f.s, order, f.actor, f.s.lastAt, () => true), true); assert.equal(f.actor.foodHours, 48); assert.equal(f.actor.waterHours, 48);
  assert.equal(order.status, 'settled'); assert.equal(order.delivered, 1);
  assert.equal(f.s.relationships.person.brokenPromises.length, 0); assert.equal(C.pay(f.s, order, f.actor, f.s.lastAt, () => true), false);
});
test('death retains the individual, exact original property and task state; irreversible scientist death freezes it all', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  const frozen = JSON.stringify(f.s); C.advance(f.s, f.s.lastAt + 1000, { ...f.hooks, dead: true }); assert.equal(JSON.stringify(f.s), frozen);
  order.carriedStackId = 'real-held-portion'; f.actor.status = 'dead'; C.advance(f.s, f.s.lastAt + 10, f.hooks);
  assert.equal(order.status, 'fatality'); assert.equal(order.carriedStackId, 'real-held-portion'); assert.equal(order.delivered, 0);
});
test('ending an unstarted arrangement releases reservations without inventing a broken promise or reward debt', () => {
  const f = fixture(); f.train(); const { order } = C.propose(f.s, f.actor, f.p, f.contact, f.s.lastAt, reserve);
  let kept;
  C.cancel(f.s, order, f.actor, f.s.lastAt, (r, reward) => { kept = reward; }); assert.equal(kept, false);
  C.advance(f.s, f.s.lastAt + 10, { ...f.hooks, rewardIntact: () => false });
  assert.deepEqual(f.s.relationships.person.brokenPromises, []); assert.equal(order.broken, false);
  assert.equal(C.pay(f.s, order, f.actor, f.s.lastAt, () => true), false);
});
