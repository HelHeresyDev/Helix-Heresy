const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../creature-formation');
function setup(souled = true) {
  const s = F.create();
  for (const method of ['notes', 'characterize', 'stability', 'document']) assert.equal(F.research(s, method, { taskId: method }, 0), true);
  const stocks = [{ key: 'clay', quantity: 2, stackId: 'original-clay' }, { key: 'drinkingWater', quantity: 2, stackId: 'original-water' }];
  const r = F.begin(s, 'actual-chamber', stocks, F.soulWindow(souled, 'actual-device'),
    { bodyCell: { x: 1, y: 1, z: 0 }, cell: { x: 1, y: 2, z: 0 }, roomId: 'lab' }, 0);
  const spent = {}, hooks = { support: (r, seconds) => ({ ok: true, soulEnergy: souled ? seconds / 600 * 2 : 0 }),
    consume: (r, amounts) => { for (const [key, n] of Object.entries(amounts)) spent[key] = (spent[key] || 0) + n; return true; },
    release: () => {}, environment: () => ({ humidity: 50, temperature: 20 }), move: () => true, leakPresent: () => true };
  return { s, r, hooks, spent };
}
test('distinct tiers and performed evidence lead to one fixed natural pattern, not free designer sliders', () => {
  const s = F.create(); assert.equal(F.FAMILIES.mudlet.natural, true); assert.equal(F.FAMILIES.mudlet.synthesisTier, 0);
  assert.equal(F.research(s, 'document', {}, 0), false); assert.equal(F.begin(s, 'c', [], F.soulWindow(false), {}, 0), null);
  const f = setup(); assert.equal(f.s.pattern.revision, 1); assert.deepEqual(f.s.pattern.evidenceIds, ['notes', 'characterize', 'stability', 'document']);
  assert.deepEqual(f.r.stocks.map(x => x.stackId), ['original-clay', 'original-water']);
});
test('finite concurrent supply yields a distinct soul and immutable completed provenance', () => {
  const f = setup(); F.advance(f.s, 300, f.hooks); assert.equal(f.s.creatures.length, 0);
  const saved = F.normalize(f.s); F.advance(saved, 600, f.hooks); const a = saved.creatures[0];
  assert.equal(a.formationSoul.present, true); assert.equal(a.formationSoul.origin, 'creation-time-animancy');
  assert.ok(Math.abs(a.formationSoul.gathered - 2) < 1e-8); assert.equal(F.hasWill(a), true);
  const record = JSON.stringify(a.formationSoul); F.supplySoul(saved.runs[0].soulWindow, 100);
  assert.equal(JSON.stringify(F.sealSoul(saved.runs[0].soulWindow, 'different-id', 1000)), record);
  assert.ok(Math.abs(f.spent.clay - 2) < 1e-8); assert.ok(Math.abs(f.spent.drinkingWater - 2) < 1e-8);
});
test('soulless formation has no independent moisture-seeking; already existing identities are preserved', () => {
  const f = setup(false); F.advance(f.s, 600, f.hooks); const a = f.s.creatures[0];
  assert.equal(a.formationSoul.present, false); assert.equal(F.hasWill(a), false); assert.equal(F.hasWill({ id: 'existing' }), true);
  a.chamberId = ''; a.waterL = .5; const cell = { ...a.mapCell }; let moves = 0;
  f.hooks.environment = () => ({ humidity: 50, temperature: 20, moistDestination: { x: 2, y: 1, z: 0 } }); f.hooks.move = () => { moves++; return true; };
  F.advance(f.s, 1200, f.hooks); assert.equal(moves, 0); assert.deepEqual(a.mapCell, cell); assert.equal(a.independentIntent, '');
});
test('soul-bearing Mudlet seeks actually supplied adjacent moisture without interpreting orders', () => {
  const f = setup(); F.advance(f.s, 600, f.hooks); const a = f.s.creatures[0]; a.chamberId = ''; a.waterL = .5;
  let moved = false; f.hooks.environment = () => ({ moistDestination: { x: 2, y: 1, z: 0 } });
  f.hooks.move = (a, cell) => { a.mapCell = cell; moved = true; return true; };
  F.advance(f.s, 660, f.hooks); assert.equal(moved, true); assert.match(a.independentIntent, /moisture/);
});
test('an outage uses a nonrenewable buffer then leaves failed incorporated matter, never a soulless substitution', () => {
  const f = setup(); F.advance(f.s, 300, f.hooks); const spent = { ...f.spent }; let released = false;
  f.hooks.support = () => ({ ok: false, reason: 'Original device lost' }); f.hooks.release = () => { released = true; };
  F.advance(f.s, 360, f.hooks); assert.equal(f.r.status, 'forming'); assert.equal(f.r.buffer, 60);
  const saved = F.normalize(f.s); F.advance(saved, 420, f.hooks); assert.equal(saved.runs[0].status, 'failed');
  assert.equal(saved.creatures.length, 0); assert.equal(released, true); assert.deepEqual(f.spent, spent);
});
test('real water is conserved by the leak test, moist body obstructs and pressure/drying reopen it', () => {
  const f = setup(); F.advance(f.s, 600, f.hooks); const a = f.s.creatures[0]; a.chamberId = ''; a.waterL = 1;
  const leak = f.s.leaks.c = { cell: { ...a.mapCell }, remainingL: 4, caughtL: 0, pressure: 'low' };
  F.advance(f.s, 660, f.hooks); assert.equal(leak.sealed, true); const slow = leak.caughtL;
  a.waterL = .2; F.advance(f.s, 720, f.hooks); assert.equal(leak.sealed, false); assert.ok(leak.caughtL - slow > slow * 5);
  leak.pressure = 'high'; const before = a.health; F.advance(f.s, 780, f.hooks); assert.ok(a.health < before);
  assert.ok(Math.abs(leak.remainingL + leak.caughtL - 4) < 1e-8);
});
test('drying and injury kill a retained original body; scientist death freezes formation and care', () => {
  const f = setup(false); F.advance(f.s, 600, f.hooks); const a = f.s.creatures[0]; a.waterL = 0;
  F.advance(f.s, 3600, f.hooks); assert.ok(a.health < 100); F.damage(a, 100, 'Crushing', 3600);
  assert.equal(a.status, 'dead'); assert.equal(f.s.creatures.length, 1);
  const saved = JSON.stringify(f.s); F.advance(f.s, 7200, { ...f.hooks, dead: true }); assert.equal(JSON.stringify(f.s), saved);
});
test('missing actual soul energy cannot yield a complete requested soul or an immortal stalled procedure', () => {
  const f = setup(); f.hooks.support = () => ({ ok: true, soulEnergy: 0 }); F.advance(f.s, 900, f.hooks);
  assert.equal(f.r.status, 'failed'); assert.equal(f.s.creatures.length, 0); assert.equal(f.r.soulWindow.sealed, false);
});
test('the catch basin has finite capacity and passive absorption does not create water', () => {
  const f = setup(false); F.advance(f.s, 600, f.hooks); const a = f.s.creatures[0]; a.waterL = .5;
  f.hooks.environment = () => ({ humidity: 100, absorb: .1 });
  f.s.leaks.c = { cell: { x: 9, y: 9, z: 0 }, remainingL: 4, caughtL: 7.99, pressure: 'high' };
  F.advance(f.s, 660, f.hooks); assert.equal(f.s.leaks.c.caughtL, 8); assert.ok(f.s.leaks.c.remainingL > 3.98);
  assert.equal(a.absorbedL, .1); assert.ok(Math.abs(a.waterL + a.evaporatedL - .6) < 1e-8);
});
test('artificial broods divide actual gathered energy among distinct immutable child souls, not a copied parent', () => {
  const w = F.soulWindow(true, 'inherited-device', 4); F.supplySoul(w, 2); assert.equal(F.sealBrood(w, 2, 'actual-breed', 0), null);
  F.supplySoul(w, 2); const souls = F.sealBrood(w, 2, 'actual-breed', 100);
  assert.notEqual(souls[0].id, souls[1].id); assert.deepEqual(souls.map(s => s.gathered), [2, 2]);
  assert.equal(F.supplySoul(w, 100), 0); assert.deepEqual(F.sealBrood(JSON.parse(JSON.stringify(w)), 2, 'different', 999), souls);
  assert.deepEqual(F.sealBrood(F.soulWindow(false), 2, 'unassisted', 0).map(s => s.present), [false, false]);
});
