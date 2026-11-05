const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../creature-formation');
function fixture(souled = true) {
  const s = F.create(), spent = {}, emissions = [];
  for (const method of ['notes', 'fireCharacterize', 'fireStability', 'fireDocument'])
    assert.equal(F.research(s, method, { taskId: `actual-${method}` }, 0), true);
  const r = F.begin(s, 'original-chamber', [{ key: 'charcoal', quantity: 2, stackId: 'original-charcoal' }],
    F.soulWindow(souled, 'inherited-device'), { bodyCell: { x: 1, y: 1, z: 0 }, cell: { x: 1, y: 2, z: 0 }, roomId: 'lab' }, 0, 'cinderling');
  const hooks = { support: (r, seconds) => ({ ok: true, soulEnergy: souled ? 2 * seconds / 600 : 0 }),
    consume: (r, amounts) => { for (const [k, n] of Object.entries(amounts)) spent[k] = (spent[k] || 0) + n; return true; },
    release: () => {}, environment: () => ({ temperature: 20, air: true }), move: () => false,
    emitFire: (a, e) => emissions.push(e), leakPresent: () => false };
  return { s, r, hooks, spent, emissions, form() { F.advance(s, 600, hooks); return s.creatures[0]; } };
}
test('a separate performed flame pattern and naturally existing 0/0 family reuse the same chamber', () => {
  const s = F.create(); assert.equal(F.FAMILIES.cinderling.natural, true);
  assert.equal(F.FAMILIES.cinderling.researchTier, 0); assert.equal(F.FAMILIES.cinderling.synthesisTier, 0);
  assert.equal(F.research(s, 'fireDocument', {}, 0), false);
  assert.equal(F.begin(s, 'c', [], F.soulWindow(false), {}, 0, 'cinderling'), null);
  const f = fixture(); assert.equal(f.s.pattern, null); assert.equal(f.s.firePattern.family, 'cinderling');
  assert.deepEqual(f.s.firePattern.evidenceIds, ['actual-fireCharacterize', 'actual-fireStability', 'actual-fireDocument']);
});
test('original charcoal and sufficient concurrent animancy produce one persistent fuel-bearing ember body', () => {
  const f = fixture(); F.advance(f.s, 300, f.hooks);
  assert.equal(f.spent.charcoal, 1); assert.equal(f.s.creatures.length, 0);
  const saved = F.normalize(f.s); F.advance(saved, 600, f.hooks); const a = saved.creatures[0];
  assert.equal(a.family, 'cinderling'); assert.equal(a.fuelUnits, 2); assert.equal(a.fuelReceived, 2);
  assert.equal(a.formationSoul.present, true); assert.equal(a.formationSoul.deviceId, 'inherited-device');
  assert.equal(f.spent.charcoal, 2); assert.equal(saved.runs[0].stocks[0].stackId, 'original-charcoal');
  assert.ok(F.light(a) > 0);
});
test('fuel, ash and emitted matter remain conserved while finite burning produces actual hook output', () => {
  const f = fixture(), a = f.form(); F.advance(f.s, 4200, f.hooks);
  assert.ok(Math.abs(a.fuelUnits - 1) < 1e-8); assert.ok(a.heatEmitted > 0);
  assert.ok(f.emissions.reduce((n, e) => n + e.heat, 0) > 0);
  assert.ok(Math.abs(a.fuelUnits + a.ashUnits + a.emittedUnits - a.fuelReceived) < 1e-8);
  const saved = F.normalize(f.s); F.advance(saved, 7800, f.hooks); const b = saved.creatures[0];
  assert.ok(b.fuelUnits < 1e-8); assert.equal(F.light(b), 0);
  assert.ok(Math.abs(b.burnedUnits - 2) < 1e-8); assert.ok(Math.abs(b.ashUnits + b.emittedUnits - 2) < 1e-8);
});
test('soulless fire still radiates but never chooses fuel, locomotion, feeding or leveling', () => {
  const f = fixture(false), a = f.form(); a.chamberId = ''; a.fuelUnits = .5; a.fuelReceived = .5;
  let moves = 0, feedRequests = 0;
  f.hooks.environment = () => ({ temperature: 20, air: true, fuelDestination: { x: 2, y: 1, z: 0 } });
  f.hooks.move = () => { moves++; return true; }; f.hooks.takeFuel = () => { feedRequests++; return true; };
  F.advance(f.s, 900, f.hooks);
  assert.equal(moves, 0); assert.equal(feedRequests, 0); assert.equal(a.independentIntent, '');
  assert.equal(F.hasWill(a), false); assert.ok(a.heatEmitted > 0); assert.deepEqual(a.skills, {});
});
test('souled fuel-seeking consumes only an actually delivered original charcoal unit', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; a.fuelUnits = .5; a.fuelReceived = .5;
  let original = 1;
  f.hooks.environment = () => ({ temperature: 20, air: true, fuelDestination: { x: 2, y: 1, z: 0 } });
  f.hooks.move = (a, cell) => { a.mapCell = cell; return true; };
  f.hooks.takeFuel = () => original > 0 ? (original--, true) : false;
  F.advance(f.s, 660, f.hooks); assert.equal(original, 0); assert.equal(a.fuelReceived, 1.5);
  assert.equal(a.mapCell.x, 2); assert.match(a.independentIntent, /fuel/);
  a.fuelUnits = .5; F.advance(f.s, 720, f.hooks); assert.equal(a.fuelReceived, 1.5);
});
test('a fire-resistant holder prevents voluntary wandering without becoming a command or fuel source', () => {
  const f = fixture(), a = f.form(); a.chamberId = ''; a.brazierId = 'original-brazier'; a.fuelUnits = .5;
  let requests = 0; f.hooks.takeFuel = () => { requests++; return true; };
  F.advance(f.s, 900, f.hooks); assert.equal(requests, 0); assert.ok(a.fuelUnits < .5);
});
test('water irreversibly quenches the same identity, retaining fuel, ash and received water', () => {
  const f = fixture(), a = f.form(); const soul = JSON.stringify(a.formationSoul);
  const r = F.quench(a, 1, 601); assert.equal(a.status, 'dead'); assert.equal(F.light(a), 0);
  assert.equal(a.waterVaporL + a.quenchWaterL, 1); assert.equal(r.vapor, .25);
  assert.equal(a.fuelUnits, 2); assert.equal(F.feed(a), false);
  F.advance(f.s, 1200, f.hooks); assert.equal(a.status, 'dead'); assert.equal(JSON.stringify(a.formationSoul), soul);
});
test('depleted fuel and lost air/cold cause saved injury and death, never free fuel or replacement individuals', () => {
  const f = fixture(false), a = f.form(); f.hooks.environment = () => ({ temperature: -20, air: false });
  F.advance(f.s, 12 * 3600, f.hooks); assert.equal(a.status, 'dead'); assert.equal(f.s.creatures.length, 1);
  assert.equal(a.fuelUnits, 2); assert.equal(a.burning, false); assert.equal(F.light(a), 0);
});
test('lost apparatus uses a finite nonrenewable buffer and retains incorporated charcoal rather than a soulless fallback', () => {
  const f = fixture(); F.advance(f.s, 300, f.hooks); const incorporated = f.r.consumed.charcoal;
  f.hooks.support = () => ({ ok: false, reason: 'Original inherited apparatus unavailable' }); F.advance(f.s, 425, f.hooks);
  assert.equal(f.r.status, 'failed'); assert.equal(f.r.consumed.charcoal, incorporated); assert.equal(f.s.creatures.length, 0);
});
test('scientist death freezes physical formation and ember care without a postmortem success', () => {
  const f = fixture(); f.form(); const saved = JSON.stringify(f.s);
  F.advance(f.s, 5000, { ...f.hooks, dead: true }); assert.equal(JSON.stringify(f.s), saved);
});
test('dead hot remains release only bounded residual heat and retain their unburned original material', () => {
  const f = fixture(), a = f.form(); F.damage(a, 100, 'Physical core fracture', 601);
  const fuel = a.fuelUnits, soul = JSON.stringify(a.formationSoul);
  F.advance(f.s, 24 * 3600, f.hooks);
  assert.equal(a.status, 'dead'); assert.equal(F.light(a), 0); assert.equal(a.fuelUnits, fuel);
  assert.equal(a.burnedUnits, 0); assert.equal(a.ashUnits, 0); assert.equal(a.emittedUnits, 0);
  assert.ok(a.temperatureC < 26); assert.ok(a.heatEmitted > 0 && a.heatEmitted <= 3.4);
  assert.equal(JSON.stringify(a.formationSoul), soul); assert.equal(F.feed(a), false);
});
test('lost ventilation suppresses light without consuming fuel; restored air burns only the surviving body', () => {
  const f = fixture(false), a = f.form(); f.hooks.environment = () => ({ temperature: 20, air: false });
  F.advance(f.s, 1200, f.hooks); assert.equal(a.fuelUnits, 2); assert.equal(F.light(a), 0);
  assert.ok(a.health < 100 && a.health > 0);
  f.hooks.environment = () => ({ temperature: 20, air: true }); F.advance(f.s, 1260, f.hooks);
  assert.equal(a.status, 'alive'); assert.ok(a.fuelUnits < 2); assert.ok(F.light(a) > 0);
});
