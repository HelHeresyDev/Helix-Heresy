const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../creature-formation');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture(souled = true) {
  const s = F.create(), env = { airborne: { smoke: 5, dust: 2 } }, volume = 3;
  for (const m of ['notes', 'airCharacterize', 'airLow', 'airHigh', 'airDocument'])
    assert.equal(F.research(s, m, { taskId: m }, 0), true);
  const parcel = F.takeAir(env, .1, volume);
  const r = F.begin(s, 'original-chamber', [], F.soulWindow(souled, 'original-device'),
    { bodyCell: { x: 1, y: 1, z: 0 }, cell: { x: 1, y: 2, z: 0 }, roomId: 'lab' }, 0, 'zephyrMote', parcel);
  let chamberSpent = 0, soulSpent = 0, moves = 0;
  const hooks = {
    support: (r, seconds) => { chamberSpent += 4 * seconds / 600; soulSpent += souled ? 2 * seconds / 600 : 0;
      return { ok: true, manaEnergy: 4 * seconds / 600, soulEnergy: souled ? 2 * seconds / 600 : 0 }; },
    consume: (r, n) => { assert.deepEqual(n, {}); return true; },
    release: r => { if (r.status === 'failed') F.returnAir(env, r.airParcel, volume); },
    environment: () => ({ disruption: 0 }),
    move: (a, cell) => { moves++; a.mapCell = { ...cell }; return true; },
    circulateAir: (a, requested) => requested,
    disperseAir: a => !a.chamberId && (!a.vesselId || a.aperture !== 'sealed') && F.returnAir(env, a.airParcel, volume),
    leakPresent: () => false
  };
  return { s, r, env, hooks, form() { F.advance(s, 600, hooks); return s.creatures[0]; },
    totals: () => ({ chamberSpent, soulSpent, moves }) };
}
test('Research 1 / Production 0 needs both actual trial receipts, not a Mudlet or Cinderling pattern', () => {
  const s = F.create(); assert.equal(F.FAMILIES.zephyrMote.natural, true);
  assert.equal(F.FAMILIES.zephyrMote.researchTier, 1); assert.equal(F.FAMILIES.zephyrMote.synthesisTier, 0);
  assert.equal(F.research(s, 'airLow', {}, 0), false);
  for (const m of ['notes', 'airCharacterize', 'airHigh']) assert.equal(F.research(s, m, { taskId: m }, 0), true);
  assert.equal(F.research(s, 'airDocument', {}, 0), false);
  F.research(s, 'airLow', { taskId: 'low-original' }, 1); F.research(s, 'airDocument', { taskId: 'documentation' }, 2);
  assert.equal(s.pattern, null); assert.equal(s.firePattern, null);
  assert.ok(s.airPattern.evidenceIds.includes('low-original'));
  assert.equal(F.begin(s, 'c', [], F.soulWindow(false), {}, 3, 'zephyrMote'), null);
});
for (const souled of [true, false]) test(`four chamber mana preserve two in the ${souled ? 'soul-bearing' : 'soulless'} original vortex`, () => {
  const f = fixture(souled), a = f.form(); near(f.totals().chamberSpent, 4); near(f.totals().soulSpent, souled ? 2 : 0);
  assert.equal(a.family, 'zephyrMote'); assert.equal(a.formationSoul.present, souled); assert.equal(a.manaReserve, 2);
  assert.equal(a.formationManaSpent, 2); assert.equal(a.airParcel.volumeM3, .1);
  assert.equal(f.r.airParcel, null); assert.equal(f.r.airTransferred, true);
  const saved = F.normalize(f.s); assert.deepEqual(saved.creatures[0], a);
  F.advance(saved, 660, f.hooks); assert.equal(saved.creatures[0].id, a.id);
  assert.ok(saved.creatures[0].manaReserve < 2);
});
test('insufficient actual chamber energy cannot grant a charged vortex or permanent stalled success', () => {
  const f = fixture(); f.hooks.support = () => ({ ok: true, manaEnergy: 0, soulEnergy: .2 });
  F.advance(f.s, 900, f.hooks); assert.equal(f.r.status, 'failed'); assert.equal(f.s.creatures.length, 0);
  assert.equal(f.r.airParcel.released, true); near(f.env.airborne.smoke, 5);
});
test('finite captured air and its original substances are withdrawn and returned once, without neutralization', () => {
  const env = { airborne: { smoke: 6, acid: 2 } }, volume = 3;
  const p = F.takeAir(env, .1, volume); near(env.airborne.smoke * volume + p.airborne.smoke, 18);
  near(env.airborne.acid * volume + p.airborne.acid, 6); near(env.airVolumeDeltaM3, -.1);
  assert.equal(F.returnAir(env, p, volume), true); near(env.airborne.smoke, 6); near(env.airVolumeDeltaM3, 0);
  assert.equal(F.returnAir(env, p, volume), false); near(env.airborne.smoke, 6);
  assert.equal(F.takeAir(env, 4, volume), null);
});
test('adjacent air exchange conserves each substance amount even for different cell volumes', () => {
  const left = { airborne: { smoke: 6, acid: 1 } }, right = { airborne: { dust: 2 } };
  const before = { smoke: 18, acid: 3, dust: 4 };
  for (let n = 0; n < 100; n++) F.exchangeAir(left, right, .1, 3, 2);
  for (const [id, amount] of Object.entries(before)) near((left.airborne[id] || 0) * 3 + (right.airborne[id] || 0) * 2, amount);
  assert.ok(left.airborne.smoke < 6); assert.ok(right.airborne.smoke > 0);
  assert.ok(left.airborne.dust > 0); assert.ok(right.airborne.dust < 2);
  assert.equal(F.exchangeAir(left, left, 1, 3, 3), 0); assert.equal(F.exchangeAir(left, right, -1, 3, 2), 0);
});
test('a sealed original holder burns finite upkeep but exchanges no room air', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; a.vesselId = 'vessel';
  F.advance(f.s, 2400, f.hooks); near(a.manaReserve, 1.5); assert.equal(a.circulatedM3, 0);
  near(a.manaReserve + a.manaSpent, a.manaReceived);
});
test('gentle and strong physical apertures move finite air, expend real mana and strong flow damages coherence', () => {
  for (const mode of ['gentle', 'strong']) {
    const f = fixture(), a = f.form(); a.chamberId = ''; a.vesselId = 'vessel'; a.aperture = mode;
    F.advance(f.s, 1500, f.hooks); near(a.circulatedM3, mode === 'strong' ? .75 : .25);
    near(a.manaReserve, mode === 'strong' ? 1 : 1.5);
    assert.equal(a.coherence < 100, mode === 'strong'); near(a.manaReserve + a.manaSpent, a.manaReceived);
  }
});
test('blocked circulation neither crosses a barrier nor creates replacement energy', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; a.aperture = 'gentle';
  f.hooks.circulateAir = () => 0; F.advance(f.s, 1200, f.hooks);
  assert.equal(a.circulatedM3, 0); assert.ok(a.manaReserve < 2);
});
test('only a souled loose body chooses nearby shelter; a vessel or missing passage prevents that movement', () => {
  for (const souled of [true, false]) {
    const f = fixture(souled), a = f.form(); a.chamberId = '';
    f.hooks.environment = () => ({ disruption: 1, shelter: { x: 2, y: 1, z: 0 } });
    F.advance(f.s, 660, f.hooks); assert.equal(f.totals().moves, souled ? 1 : 0);
    assert.equal(Boolean(a.independentIntent), souled);
    a.vesselId = 'vessel'; F.advance(f.s, 720, f.hooks); assert.equal(f.totals().moves, souled ? 1 : 0);
  }
});
test('an unordered soulless body depletes and dies despite nearby energy; feeding requires actual administration', () => {
  const f = fixture(false), a = f.form(); a.chamberId = ''; a.vesselId = 'vessel';
  F.advance(f.s, 6 * 3600, f.hooks); assert.equal(a.status, 'dead'); assert.equal(a.manaReserve, 0);
  assert.equal(f.totals().moves, 0); assert.equal(a.independentIntent, ''); assert.deepEqual(a.skills, {});
  assert.equal(a.airReturned, false); // Closed vessel retains the original collapsed air.
  const soul = JSON.stringify(a.formationSoul); a.aperture = 'gentle'; F.advance(f.s, 6 * 3600 + 60, f.hooks);
  assert.equal(a.airReturned, true); assert.equal(a.airParcel.released, true); assert.equal(F.rechargeMote(a), false);
  F.advance(f.s, 7 * 3600, f.hooks); assert.equal(JSON.stringify(a.formationSoul), soul); assert.equal(f.s.creatures.length, 1);
});
test('supplied eight-mana charges have finite capacity and do not heal coherence or revive the dead', () => {
  const f = fixture(), a = f.form(); a.health = a.coherence = 50;
  assert.equal(F.rechargeMote(a), true); assert.equal(a.manaReserve, 10); assert.equal(F.rechargeMote(a), false);
  assert.equal(a.health, 50); assert.equal(a.coherence, 50);
  near(a.manaReserve + a.manaSpent, a.manaReceived);
});
test('formation interruption returns its captured contaminants, keeps spent mana and never substitutes a soulless body', () => {
  const f = fixture(); F.advance(f.s, 300, f.hooks); near(f.r.manaReceived, 2);
  f.hooks.support = () => ({ ok: false, reason: 'Original device unavailable' }); F.advance(f.s, 425, f.hooks);
  assert.equal(f.r.status, 'failed'); assert.equal(f.s.creatures.length, 0);
  near(f.r.manaReceived, 2); near(f.env.airborne.smoke, 5); assert.equal(f.r.airParcel.released, true);
});
test('opposing ventilation can irreversibly collapse the retained body; stopped scientist clock creates no postmortem result', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; f.hooks.environment = () => ({ disruption: 10 });
  F.advance(f.s, 2400, f.hooks); assert.equal(a.status, 'dead'); assert.equal(a.airReturned, true);
  const before = JSON.stringify(f.s); F.advance(f.s, 5000, { ...f.hooks, dead: true }); assert.equal(JSON.stringify(f.s), before);
});
test('ordinary physical core destruction ends coherence but does not delete or vent a sealed parcel remotely', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; a.vesselId = 'original-sealed-vessel';
  F.damage(a, 100, 'Ordinary physical strike', 601); assert.equal(a.status, 'dead'); assert.equal(a.coherence, 0);
  F.advance(f.s, 660, f.hooks); assert.equal(a.airReturned, false); assert.equal(a.airParcel.released, false);
  a.aperture = 'gentle'; F.advance(f.s, 720, f.hooks); assert.equal(a.airReturned, true);
  const before = { ...f.env.airborne }; F.advance(f.s, 780, f.hooks); assert.deepEqual(f.env.airborne, before);
});
