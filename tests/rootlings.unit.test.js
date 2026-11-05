const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../creature-formation'), R = F.Rootlings;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function plant(souled = true) { return { ...R.body(), id: 'original-rootling', family: 'rootling', health: 100, maxHealth: 100,
  status: 'alive', injuries: [], formationSoul: { present: souled, id: souled ? 'original-soul' : null }, planterId: 'original-planter' }; }
function hooks() { return { hasWill: F.hasWill, damage: F.damage }; }
function env(overrides = {}) { return { light: 50, temperature: 20, ...overrides }; }
function conservedPlant(a) { near(R.dryMass(a) + a.respiredKg + a.prunedKg + a.discardedMediumKg, a.materialReceivedKg); near(a.waterL + a.transpiredL + a.drainedCareWaterL, a.waterReceivedL); }
test('naturally existing Research 1 / Production 0 Rootlings require both performed botanical controls', () => {
  assert.equal(F.FAMILIES.rootling.natural, true); assert.equal(F.FAMILIES.rootling.researchTier, 1); assert.equal(F.FAMILIES.rootling.synthesisTier, 0);
  const s = F.create(); assert.equal(F.research(s, 'rootDocument', {}, 0), false);
  for (const m of ['notes', 'rootCharacterize', 'rootWetTrial']) assert.equal(F.research(s, m, { taskId: m }, 0), true);
  assert.equal(F.research(s, 'rootDocument', {}, 0), false);
  F.research(s, 'rootShadeTrial', { taskId: 'actual-dark-control' }, 1); F.research(s, 'rootDocument', { taskId: 'actual-document' }, 2);
  assert.ok(s.rootPattern.evidenceIds.includes('actual-dark-control')); assert.equal(s.pattern, null);
});
for (const souled of [true, false]) test(`six-hour original propagation incorporates plant/water/medium with ${souled ? 'concurrent own-soul gathering' : 'no independent soul'}`, () => {
  const s = F.create(); for (const m of ['notes', 'rootCharacterize', 'rootWetTrial', 'rootShadeTrial', 'rootDocument']) F.research(s, m, { taskId: m }, 0);
  const r = F.begin(s, 'original-synthesis-tube', [{ stackId: 'original-propagule' }], F.soulWindow(souled, 'inherited-device'), { bodyCell: { x: 1, y: 1, z: 0 }, roomId: 'lab' }, 0, 'rootling');
  const consumed = {}, h = { support: (r, seconds) => ({ ok: true, manaEnergy: 2 * seconds / r.required, soulEnergy: souled ? 2 * seconds / r.required : 0 }),
    consume: (r, amounts) => { for (const [key, n] of Object.entries(amounts)) consumed[key] = (consumed[key] || 0) + n; return true; },
    release: () => {}, environment: () => env(), leakPresent: () => false };
  F.advance(s, 10800, h); assert.equal(r.status, 'forming'); assert.equal(s.creatures.length, 0); assert.equal(consumed.drinkingWater, 1);
  const saved = F.normalize(s); F.advance(saved, 21600, h); const a = saved.creatures[0];
  assert.equal(a.family, 'rootling'); assert.equal(a.chamberId, 'original-synthesis-tube'); assert.equal(a.formationSoul.present, souled);
  near(saved.runs[0].manaReceived, 2); assert.deepEqual(consumed, { plantPropagule: 1, drinkingWater: 2, nutrientMedium: 1 });
  conservedPlant(a); assert.equal(F.hasWill(a), souled); assert.deepEqual(a.skills, {});
});
test('interrupted requested propagation exhausts its nonrenewable thirty-minute buffer without creating a soulless substitute', () => {
  const s = F.create(); s.rootPattern = { family: 'rootling' };
  const r = F.begin(s, 'tube', [], F.soulWindow(true, 'original-device'), { bodyCell: {} }, 0, 'rootling');
  let released = 0; F.advance(s, 1801, { support: () => ({ ok: false }), release: () => released++, environment: () => env(), leakPresent: () => false });
  assert.equal(r.status, 'failed'); assert.equal(s.creatures.length, 0); assert.equal(released, 1);
});
test('a recovered propagation interval does not replenish the spent support-loss buffer', () => {
  const s = F.create(); s.rootPattern = { family: 'rootling' };
  const r = F.begin(s, 'tube', [], F.soulWindow(false), { bodyCell: {} }, 0, 'rootling');
  let available = false;
  const h = { support: (r, seconds) => ({ ok: available, manaEnergy: available ? 2 * seconds / r.required : 0 }),
    consume: () => true, release: () => {}, environment: () => env(), leakPresent: () => false };
  F.advance(s, 900, h); assert.equal(r.buffer, 900);
  available = true; F.advance(s, 960, h); assert.equal(r.progress, 60); assert.equal(r.buffer, 900);
  available = false; F.advance(s, 1860, h); assert.equal(r.status, 'failed'); assert.equal(s.creatures.length, 0);
});
test('scientist death freezes original botanical formation, care, roots and captured substances', () => {
  const s = F.create(); s.rootPattern = { family: 'rootling' };
  F.begin(s, 'tube', [], F.soulWindow(false), { bodyCell: {} }, 0, 'rootling');
  const a = plant(); a.surfaceLoad = { 'cinderling-smoke': .2 }; s.creatures.push(a);
  const saved = JSON.stringify(s);
  assert.equal(F.advance(s, 36000, { dead: true }), 0); assert.equal(JSON.stringify(s), saved);
});
test('air capture retains exact supported substances and leaves unknown gas untouched', () => {
  const a = plant(), air = { airborne: { 'cinderling-smoke': .5, 'chemistry-test-fumes': .5, unknown: .5 } }, volume = 3;
  R.filterAir(a, air, volume, .5, 1, 3600);
  near(air.airborne['cinderling-smoke'] * volume + R.total(a.surfaceLoad), 1.5);
  near(air.airborne['chemistry-test-fumes'] * volume + R.total(a.tissueLoad), 1.5); near(air.airborne.unknown, .5);
  assert.ok(R.total(a.surfaceLoad) > 0 && R.total(a.tissueLoad) > 0);
});
test('liquid capture moves contaminants into finite tissue/substrate capacity without creating drinkable water', () => {
  const a = plant(); assert.equal(R.loadLiquid(a, { waterL: 1, substances: { 'spent-assay-solute': 1, unknown: 2 }, sourceIds: ['original-batch'] }), true);
  for (let n = 0; n < 100; n++) R.filterLiquid(a, 1, n);
  near(a.liquid.substances['spent-assay-solute'] + R.total(a.tissueLoad) + R.total(a.substrateLoad), 1);
  assert.ok(a.liquid.substances['spent-assay-solute'] > 0); near(a.liquid.substances.unknown, 2); near(a.liquid.waterL, 1);
  assert.equal(R.loadLiquid(a, { waterL: 1 }), false); const out = R.drainLiquid(a); assert.deepEqual(out.sourceIds, ['original-batch']); assert.equal(a.liquid, null);
});
test('washing uses a separate supplied water portion and moves particles into retained wastewater, not oblivion', () => {
  const a = plant(); a.surfaceLoad = { smoke: .2 }; a.tissueLoad = { toxin: .1 };
  const out = R.wash(a); near(out.waterL, 1); near(out.substances.smoke, .2); assert.deepEqual(a.surfaceLoad, {}); near(a.tissueLoad.toxin, .1);
});
test('substrate replacement preserves original polluted medium and does not reset tissue or leaf load', () => {
  const a = plant(); a.substrateLoad = { toxin: .2 }; a.tissueLoad = { toxin: .1 }; a.surfaceLoad = { dust: .1 };
  const out = R.replaceMedium(a); near(out.kg, .75); near(out.substances.toxin, .2); near(a.tissueLoad.toxin, .1); near(a.surfaceLoad.dust, .1); conservedPlant(a);
});
test('guided root growth spends existing carbon, obstructs only the original adjacent inlet, and dead roots still obstruct', () => {
  const a = plant(false), cell = { x: 2, y: 1, z: 0 }; a.rootGuard = false; a.guideCell = cell;
  for (let n = 0; n < 360; n++) R.step(a, env({ rootPassable: true }), 60, n * 60, hooks());
  assert.equal(a.rootCell.x, 2); assert.ok(a.rootLength > .9); conservedPlant(a); assert.equal(a.independentIntent, '');
  assert.ok(R.drainFactor(a, cell) < .3); assert.equal(R.drainFactor(a, { x: 9, y: 9, z: 0 }), 1);
  F.damage(a, 100, 'Physical death', 21601); assert.ok(R.drainFactor(a, cell) < .3);
});
test('a soulless unguarded Rootling never chooses a moisture destination, but a souled one can direct its own tip', () => {
  for (const souled of [true, false]) { const a = plant(souled); a.rootGuard = false;
    R.step(a, env({ moistCell: { x: 2, y: 1, z: 0 }, rootPassable: false }), 60, 60, hooks()); assert.equal(Boolean(a.guideCell), souled);
    assert.equal(Boolean(a.independentIntent), souled);
  }
});
test('root barriers and impassable geometry prevent extension even with real reserves and light', () => {
  const a = plant(); a.guideCell = { x: 2, y: 1, z: 0 };
  R.step(a, env({ rootPassable: true }), 3600, 3600, hooks()); assert.equal(a.rootLength, 0);
  a.rootGuard = false; R.step(a, env({ rootPassable: false }), 3600, 7200, hooks()); assert.equal(a.rootLength, 0); conservedPlant(a);
});
test('pruning removes the actual exterior tissue, transfers only its pollutant fraction, wounds the same individual and frees the drain', () => {
  const a = plant(); a.rootKg = .4; a.reserveKg -= .25; a.rootCell = { x: 2, y: 1, z: 0 }; a.rootLength = 1; a.tissueLoad = { toxin: .2 };
  const soul = JSON.stringify(a.formationSoul), out = R.prune(a, 10, F.damage);
  near(out.kg, .25); near(out.substances.toxin + a.tissueLoad.toxin, .2); assert.equal(a.health, 92); assert.equal(a.rootCell, null);
  assert.equal(JSON.stringify(a.formationSoul), soul); conservedPlant(a);
});
test('light/water/nutrient care is finite and does not heal injuries or resurrect a dead plant', () => {
  const a = plant(); a.health = 50; assert.equal(R.water(a), true); assert.equal(R.nourish(a), true); assert.equal(a.health, 50); conservedPlant(a);
  F.damage(a, 100, 'Fatal injury', 0); assert.equal(R.water(a), false); assert.equal(R.nourish(a), false);
  const saved = JSON.stringify(a); R.step(a, env(), 36000, 36000, hooks()); assert.equal(JSON.stringify(a), saved);
});
test('prolonged darkness, drought, waterlogging and unsafe temperature leave retained injury and death', () => {
  for (const kind of ['dark', 'dry', 'wet', 'hot']) { const a = plant();
    if (kind === 'dry') a.waterL = 0; if (kind === 'wet') a.waterL = 4;
    for (let n = 0; n < 200; n++) R.step(a, env({ light: kind === 'dark' ? 0 : 50, temperature: kind === 'hot' ? 50 : 20 }), 3600, n * 3600, hooks());
    assert.equal(a.status, 'dead'); assert.ok(a.injuries.length > 0); assert.equal(a.id, 'original-rootling');
  }
});
