const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hauntbound');
const ctx = () => ({ local: true, letterLocal: true, letterExists: true, animancy: 1, suppressed: false, dead: false });
const make = () => H.create(0, { roomId: 'lab', cell: { x: 1, y: 1, z: 0 } }, 'original-doll', 'original-letter');
const source = () => ({ id: 'cloth-lot', section: 'resources', key: 'cloth', quantity: 5, unitMassKg: .5, unitVolumeL: 2 });
function recruit(s) { for (const a of ['examine', 'contact', 'agreement']) assert.equal(H.interact(s, a, ctx(), 0).ok, true); }
function assign(s) { return H.assign(s, { id: 'order', amount: 3, toCell: { x: 2, y: 1, z: 0 }, toRoomId: 'lab' }, { ...ctx(), source: source() }, 0); }
const hooks = overrides => ({ environment: () => ({ letterExists: true }), work: () => ({}), release: () => true, ...overrides });
test('not producible, no tier-zero or fresh-soul counterpart; retains original deceased identity', () => {
  const s = make(); assert.equal(H.DEFINITION.producible, false); assert.equal(H.DEFINITION.productionTier, null);
  assert.equal(s.actor.soul.origin, 'natural-lingering-deceased'); assert.equal(H.interact(s, 'grow', ctx(), 1).ok, false);
});
test('physical discovery does not grant personal contact or reveal all memories', () => {
  const s = make(); assert.equal(H.interact(s, 'examine', ctx(), 0).ok, true); assert.equal(s.contact, false);
  assert.equal(H.interact(s, 'contact', { ...ctx(), animancy: 0 }, 1).ok, false);
  assert.equal(H.interact(s, 'contact', { ...ctx(), suppressed: true }, 1).ok, false);
  assert.equal(H.interact(s, 'contact', { ...ctx(), local: false }, 1).ok, false);
});
test('no inherited apparatus, obedience switch or human expertise required for contact', () => {
  const s = make(); recruit(s); assert.equal(s.agreement, true); assert.match(s.actor.memories, /No complete autobiography/);
  assert.equal(s.journal.filter(j => j.action === 'agreement').length, 1);
});
test('damaged individual refuses a new agreement; body ownership does not imply consent', () => {
  const s = make(); H.interact(s, 'examine', ctx(), 0); H.interact(s, 'contact', ctx(), 0);
  H.damage(s, 80, 'physical', 1); assert.equal(H.interact(s, 'agreement', ctx(), 2).ok, false);
});
test('original farewell must be physically read and shared, not conjured by conversation', () => {
  const s = make(); recruit(s); assert.equal(H.interact(s, 'farewell', ctx(), 1).ok, false);
  assert.equal(H.interact(s, 'letter', { ...ctx(), letterLocal: false }, 2).ok, false);
  assert.equal(H.interact(s, 'letter', ctx(), 2).ok, true); assert.equal(H.interact(s, 'farewell', ctx(), 3).ok, true);
  assert.equal(s.actor.status, 'bound'); assert.equal(s.agreement, true);
});
test('ordinary materials only; no dangerous evidence, too-heavy cargo or reserved source', () => {
  assert.equal(H.eligible(source()), true);
  for (const diff of [{ key: 'biomass' }, { tags: ['evidence'] }, { reservedTaskId: 'other' }, { unitMassKg: 2 }, { unitVolumeL: 4 }, { carriedBy: 'other' }, { substances: { toxin: 1 } }])
    assert.equal(H.eligible({ ...source(), ...diff }), false, JSON.stringify(diff));
});
test('received assignment, consent and exact quantities are saved; no unordered work', () => {
  const s = make(); assert.equal(assign(s).ok, false); recruit(s); assert.equal(assign(s).ok, true);
  assert.equal(s.orders[0].receivedVia, 'personal-animancy'); assert.equal(assign(s).ok, false);
  const idle = make(); let calls = 0; H.advance(idle, 1000, hooks({ work: () => { calls++; return {}; } })); assert.equal(calls, 0);
});
test('independent continuing work, real delivery receipts, experience and finite effort', () => {
  const s = make(); recruit(s); assign(s); const o = s.orders[0];
  H.advance(s, 90, hooks({ work: (a, o) => { o.delivered++; return { loadKg: .5 }; } }));
  assert.equal(o.status, 'completed'); assert.equal(o.delivered, 3); assert.ok(s.actor.experience > 0);
  assert.equal(s.actor.foodHours, undefined); assert.equal(s.actor.fatigue, undefined);
});
test('an actual blockage retains the same instruction without invented deliveries', () => {
  const s = make(); recruit(s); assign(s); H.advance(s, 60, hooks({ work: () => ({ reason: 'Locked physical door' }) }));
  assert.equal(s.orders[0].status, 'blocked'); assert.equal(s.orders[0].delivered, 0);
  const id = s.orders[0].id; H.advance(s, 63, hooks({ work: (a, o) => { o.delivered++; return {}; } }));
  assert.equal(s.orders[0].id, id); assert.equal(s.orders[0].delivered, 1);
});
test('soul exertion recovery is not biological hunger or sleep and can resume work', () => {
  const s = make(); recruit(s); assign(s); s.actor.soulReserve = 0;
  H.advance(s, 60, hooks()); assert.equal(s.orders[0].status, 'blocked'); assert.ok(s.actor.soulReserve > 0);
  H.advance(s, 600, hooks()); assert.equal(s.orders[0].status, 'claimed'); assert.ok(s.actor.workSeconds > 0);
});
test('seams and waterlogged cloth matter; nearby food does not change either', () => {
  const s = make(); recruit(s); assign(s); s.actor.seamWear = 85;
  H.advance(s, 9, hooks()); assert.equal(s.orders[0].status, 'blocked');
  assert.equal(H.repair(s, { cloth: 1, sourceStackIds: ['original-cloth'] }, 10), true);
  H.advance(s, 240, hooks({ environment: (a, dt) => ({ letterExists: true, wet: true, waterKg: dt * .002 }) }));
  assert.ok(s.actor.wetKg >= .4); assert.equal(s.orders[0].status, 'blocked');
  assert.ok(Math.abs(s.actor.wetKg + s.actor.waterEvaporatedKg - s.actor.waterAbsorbedKg) < 1e-8);
});
test('danger and loss of the protected letter can withdraw consent', () => {
  for (const env of [{ unsafe: true, letterExists: true }, { letterExists: false }]) {
    const s = make(); recruit(s); assign(s); H.advance(s, 3, hooks({ environment: () => env }));
    assert.equal(s.agreement, false); assert.equal(s.withdrawn, true); assert.equal(s.orders[0].delivered, 0);
  }
});
test('weak soul force moves its doll and light cargo, not an unpowered mech or unlimited load', () => {
  const a = make().actor; assert.equal(H.canMove(a, 1), true); assert.equal(H.canMove(a, 10), false);
  a.bodyMassKg = 5000; assert.equal(H.canMove(a), false);
  a.bodyMassKg = .5; a.forceN = 10; a.wetKg = .5; assert.equal(H.canMove(a, .5), false);
});
test('contact without a supplied water receipt adds no mass; finite supplied water later evaporates', () => {
  const s = make(); H.advance(s, 60, hooks({ environment: () => ({ wet: true }) })); assert.equal(s.actor.wetKg, 0);
  let remaining = .015;
  H.advance(s, 120, hooks({ environment: (a, dt) => { const waterKg = Math.min(remaining, dt * .002); remaining -= waterKg; return { wet: true, waterKg }; } }));
  assert.ok(Math.abs(s.actor.wetKg - .015) < 1e-8); H.advance(s, 600, hooks());
  assert.equal(s.actor.wetKg, 0); assert.ok(Math.abs(s.actor.waterEvaporatedKg - .015) < 1e-8);
});
test('breaking the object does not destroy its inhabitant; sourced repair never heals a soul', () => {
  const s = make(); H.damage(s, 100, 'physical', 1); H.damage(s, 20, 'soul', 2);
  assert.equal(s.actor.status, 'bound-remains'); assert.equal(s.actor.soul.integrity, 80);
  assert.equal(H.repair(s, {}, 3), false);
  assert.equal(H.repair(s, { cloth: 1, sourceStackIds: ['cloth'] }, 3), true);
  assert.equal(s.actor.status, 'bound'); assert.equal(s.actor.soul.integrity, 80);
});
test('true soul destruction cannot be reversed by cloth repair or contact', () => {
  const s = make(); recruit(s); H.damage(s, 100, 'soul', 3); H.repair(s, { cloth: 1, sourceStackIds: ['cloth'] }, 4);
  assert.equal(s.actor.status, 'soul-destroyed'); assert.equal(H.interact(s, 'contact', ctx(), 5).ok, false);
});
test('voluntary departure requires readiness and physically settled work', () => {
  const s = make(); recruit(s); assert.equal(H.interact(s, 'release', ctx(), 1).ok, false);
  H.interact(s, 'letter', ctx(), 1); H.interact(s, 'farewell', ctx(), 2); assign(s);
  assert.equal(H.interact(s, 'release', ctx(), 3).ok, false);
  assert.equal(H.cancel(s, 'order', 4, { release: () => false }), false);
  assert.equal(H.cancel(s, 'order', 4, { release: () => true }), true);
  assert.equal(H.interact(s, 'release', ctx(), 5).ok, true); assert.equal(s.actor.status, 'departed');
  assert.equal(s.actor.soul.integrity, 100); assert.equal(s.agreement, false);
});
test('bounded imbuement remains after departure without continued spiritual labor', () => {
  const s = make(); recruit(s); H.advance(s, 30 * 3600, hooks());
  assert.ok(Math.abs(s.enchantment.charge - 20) < 1e-7);
  H.interact(s, 'letter', ctx(), s.lastAt); H.interact(s, 'farewell', ctx(), s.lastAt); H.interact(s, 'release', ctx(), s.lastAt);
  const work = s.actor.workSeconds; H.advance(s, 31 * 3600, hooks());
  assert.equal(s.actor.workSeconds, work); assert.equal(assign(s).ok, false);
  assert.ok(Math.abs(s.enchantment.charge - 20) < 1e-7);
});
test('cushion only works on the real carried intact released object; charge is spent', () => {
  const s = make(); s.enchantment.charge = 10;
  assert.equal(H.absorb(s, 10, ['physical'], true).absorbed, 0); s.actor.status = 'departed';
  assert.equal(H.absorb(s, 10, ['physical'], false).absorbed, 0);
  for (const types of [['soul'], ['fire'], ['physical', 'fire']]) assert.equal(H.absorb(s, 10, types, true).absorbed, 0);
  assert.deepEqual(H.absorb(s, 10, ['physical'], true), { damage: 7, absorbed: 3 }); assert.equal(s.enchantment.charge, 7);
  s.actor.health = 0; assert.equal(H.absorb(s, 10, ['physical'], true).absorbed, 0);
});
test('recharging needs sourced feedstock, respects capacity and never recalls the individual', () => {
  const s = make(); const r = { sourceStackIds: ['actual-feedstock'] };
  assert.equal(H.recharge(s, r), false); s.actor.status = 'departed'; assert.equal(H.recharge(s, {}), false);
  assert.equal(H.recharge(s, r), true); assert.equal(H.recharge(s, r), true); assert.equal(H.recharge(s, r), false);
  assert.equal(s.enchantment.charge, 16); assert.equal(s.actor.status, 'departed');
});
test('original bodies, cargo, soul and instructions survive a continued state copy', () => {
  const s = make(); recruit(s); assign(s); s.orders[0].carriedStackId = 'real-carried-cargo'; s.orders[0].stage = 'delivery';
  const restored = JSON.parse(JSON.stringify(s)); assert.deepEqual(restored, s);
  H.advance(restored, 3, hooks({ work: () => ({ reason: 'Still obstructed' }) }));
  assert.equal(restored.orders[0].carriedStackId, 'real-carried-cargo'); assert.equal(restored.actor.soul.id, s.actor.soul.id);
});
test('remote observations stay dated and final scientist death freezes all activity', () => {
  const s = make(); recruit(s); const view = H.observe(s, 0); assign(s); H.advance(s, 60, hooks()); assert.deepEqual(s.observations, view);
  const before = JSON.stringify(s); H.advance(s, 3600, { dead: true }); assert.equal(JSON.stringify(s), before);
});
