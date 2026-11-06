const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('../creature-formation'), S = F.Shardlings, G = require('../geology-field');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const specimen = (souled = true) => ({ ...S.body(), id: 'original-quartz', family: 'quartzShardling', actorKind: 'quartzShardling', status: 'alive',
  mapCell: { x: 1, y: 1, z: 0 }, health: 100, maxHealth: 100, injuries: [], formationSoul: { present: souled }, independentIntent: '' });
const hooks = extra => ({ hasWill: F.hasWill, sense: () => [], sourceExists: () => true, takeFood: () => null, next: () => null,
  move: () => true, dig: () => true, ...extra });
function advance(a, seconds, h = hooks()) { for (let n = 60; n <= seconds; n += 60) S.step(a, { temperature: 20 }, 60, n, h); }
function conserved(a) { near(a.bodyKg + S.total(a.spentMaterials) + a.brokenKg + a.removedKg, a.materialReceivedKg); }
test('material-specific naturally existing family, separate research/production tiers, no optical or ghost definition', () => {
  assert.equal(F.FAMILIES.quartzShardling.name, 'Quartz Shardling'); assert.equal(F.FAMILIES.quartzShardling.researchTier, 1);
  assert.equal(F.FAMILIES.quartzShardling.synthesisTier, 0); assert.equal(S.body('not-authored'), null);
  assert.equal(S.MATERIALS.quartz.resource, 'quartz');
});
test('performed mineral controls are required; no previous Mudlet discovery is compulsory', () => {
  const s = F.create(); assert.equal(F.research(s, 'shardDocument', {}, 0), false);
  for (const method of ['notes', 'shardCharacterize', 'shardStoneTrial', 'shardQuartzTrial', 'shardDocument']) assert.equal(F.research(s, method, { taskId: method }, 0), true);
  assert.equal(s.pattern, null); assert.equal(s.shardPattern.material, 'quartz'); assert.equal(s.shardPattern.evidenceIds.length, 4);
});
for (const souled of [true, false]) test(`one-hour sourced formation retains ${souled ? 'actual concurrent gathered soul' : 'unassisted soulless result'}`, () => {
  const s = F.create(); s.shardPattern = { material: 'quartz' }; const consumed = {};
  const r = F.begin(s, 'original-chamber', [], F.soulWindow(souled, 'inherited-device'), { roomId: 'lab', bodyCell: { x: 1, y: 1, z: 0 } }, 0, 'quartzShardling');
  const h = { support: (r, dt) => ({ ok: true, manaEnergy: dt * 2 / 3600, soulEnergy: souled ? dt * 2 / 3600 : 0 }),
    consume: (r, amounts) => { for (const [k, n] of Object.entries(amounts)) consumed[k] = (consumed[k] || 0) + n; return true; },
    release: () => {}, environment: () => ({ temperature: 20 }), shardling: hooks() };
  F.advance(s, 1800, h); assert.equal(r.status, 'forming'); assert.equal(consumed.quartz, 1); assert.equal(consumed.mineralSalts, 1);
  const restored = F.normalize(s); F.advance(restored, 3600, h); const a = restored.creatures[0];
  assert.equal(a.material, 'quartz'); assert.equal(a.formationSoul.present, souled); near(restored.runs[0].manaReceived, 2);
  assert.deepEqual(consumed, { quartz: 1, mineralSalts: 1, drinkingWater: 1 }); conserved(a);
});
test('failed requested formation consumes its nonrenewable buffer, retains inputs consumed and never substitutes soulless', () => {
  const s = F.create(); s.shardPattern = {};
  const r = F.begin(s, 'chamber', [], F.soulWindow(true, 'device'), { bodyCell: {} }, 0, 'quartzShardling'); let ok = true, released = 0;
  const h = { support: (r, dt) => ({ ok, manaEnergy: dt * 2 / 3600, soulEnergy: dt * 2 / 3600 }), consume: () => true, release: () => released++ };
  F.advance(s, 1800, h); ok = false; F.advance(s, 1921, h); assert.equal(r.status, 'failed'); assert.equal(released, 1);
  assert.equal(r.consumed.quartz, 1); assert.equal(r.consumed.drinkingWater, 0); assert.equal(s.creatures.length, 0);
});
test('private mineral sense passes through intervening rock, remains finite and material-specific', () => {
  const a = specimen(), source = { id: 'actual-vein', cell: { x: 5, y: 1, z: 0 }, material: 'quartz', kg: 10 };
  assert.equal(S.sense(a, [source]).id, source.id);
  assert.equal(S.sense(a, [{ ...source, material: 'ironOre' }]), null);
  assert.equal(S.sense(a, [{ ...source, cell: { x: 8, y: 1, z: 0 } }]), null);
});
test('stone sustains without growing or repairing quartz; all eaten mass remains tracked', () => {
  const a = specimen(); a.reserveHours = 2; a.health = 70; a.biteBudgetKg = .01;
  assert.equal(S.eat(a, { materials: { stone: .01 }, sourceIds: ['real-stone'] }, 0), true);
  assert.equal(a.bodyKg, 1); assert.equal(a.health, 70); assert.ok(a.reserveHours > 2); conserved(a);
});
test('own mineral alone grows and rebuilds lost body mass, without changing original identity', () => {
  const a = specimen(); S.damage(a, 20, 'Impact', 0); const old = a.bodyKg; a.biteBudgetKg = .01;
  S.eat(a, { materials: { quartz: .01 }, sourceIds: ['actual-quartz'] }, 1);
  assert.ok(a.bodyKg > old); assert.ok(a.repairedKg > 0); assert.equal(a.id, 'original-quartz'); conserved(a);
});
test('mixed minerals contribute only their actual compatible fraction', () => {
  const a = specimen(); a.biteBudgetKg = .01; S.eat(a, { materials: { quartz: .002, granite: .008 }, sourceIds: ['mixed-rock'] }, 0);
  near(a.grownKg, .0005); conserved(a);
});
test('no random excavation, eating or exploration by an unordered soulless body', () => {
  const a = specimen(false); let calls = 0; advance(a, 3600, hooks({ takeFood: () => { calls++; return null; }, next: () => { calls++; return null; } }));
  assert.equal(calls, 0); assert.equal(a.mode, 'unordered'); near(a.reserveHours, 47); assert.equal(a.independentIntent, '');
});
test('a physically received standing instruction authorizes exploration and survives copy; cancel stops it', () => {
  const a = specimen(false); assert.equal(S.instruction(a, true, {}, 0, false), false);
  assert.equal(S.instruction(a, true, { taskId: 'actual-contact-task', touch: true }, 0, false), true);
  let digs = 0; advance(a, 1200, hooks({ next: () => ({ cell: { x: 2, y: 1, z: 0 }, dig: true }), dig: () => digs++ }));
  assert.equal(digs, 2); assert.equal(a.independentIntent, ''); const restored = JSON.parse(JSON.stringify(a)); assert.deepEqual(restored.order, a.order);
  S.instruction(a, false, { taskId: 'stop-contact', touch: true }, 1200, false); advance(a, 600, hooks({ dig: () => digs++ })); assert.equal(digs, 2);
  assert.equal(S.instruction(specimen(), true, { taskId: 'puppet', touch: true }, 0, true), false);
});
test('untiring slow movement takes five minutes, not an instant path or biological rest cycle', () => {
  const a = specimen(); let moves = 0; const h = hooks({ next: () => ({ cell: { x: 2, y: 1, z: 0 }, dig: false }), move: () => { moves++; return true; } });
  advance(a, 240, h); assert.equal(moves, 0); advance(a, 60, h); assert.equal(moves, 1); assert.equal(a.fatigue, undefined);
});
test('a reached source occupies slow feeding rather than being depleted at discovery', () => {
  const a = specimen(), source = { id: 'vein', cell: { x: 2, y: 1, z: 0 }, material: 'quartz', kg: 10 }; let remaining = 10;
  advance(a, 3600, hooks({ sense: () => [source], takeFood: (a, kg) => { remaining -= kg; return { materials: { quartz: kg }, sourceIds: ['vein'] }; } }));
  near(remaining, 9.99); assert.equal(a.mode, 'feeding-at-source'); conserved(a);
});
test('a contained body cannot tunnel and an assisted soulless feeding instruction is source-specific', () => {
  const a = specimen(false); a.chamberId = 'original-chamber'; a.assistedSourceId = 'actual-offered-block'; let n = 0;
  advance(a, 600, hooks({ takeFood: (a, kg, active) => { assert.equal(active, false); n++; return { materials: { stone: kg }, sourceIds: [a.assistedSourceId] }; }, next: () => { throw Error('Contained creature tried to tunnel'); } }));
  assert.equal(n, 1); assert.equal(a.mode, 'contained'); conserved(a);
});
test('mineral starvation and core destruction retain original dead remains; no feeding resurrection', () => {
  const a = specimen(false); a.reserveHours = 0; advance(a, 3600 * 55); assert.equal(a.status, 'dead'); conserved(a);
  a.biteBudgetKg = .01; assert.equal(S.eat(a, { materials: { quartz: .01 } }, 9), false);
});
test('fractional dust and fractures are retained until actual collection, never rounded into new mass', () => {
  const a = specimen(); a.biteBudgetKg = .001; S.eat(a, { materials: { quartz: .001 }, sourceIds: ['q'] }, 0);
  S.damage(a, .1, 'Tiny chip', 1); const out = S.collect(a); assert.equal(S.total(out.materials), 0); assert.equal(out.brokenKg, 0); conserved(a);
});
test('seeded quartz deposits and mixed granite are independent of old iron/copper rolls', () => {
  const p = G.profileForCell('seed', { x: 1, y: 1, z: 0 }); assert.deepEqual(G.excavationMaterials(p), G.excavationMaterials({ ...p }));
  const augmented = { ...p, quartzKg: 10 }; near(G.excavationMaterials(augmented).quartz, 10);
  assert.deepEqual(G.excavationMaterials({ ...augmented, excavationRemainder: { quartz: 9.999, granite: 2 } }), { quartz: 9.999, granite: 2 });
  assert.deepEqual(G.excavationMaterials({ ...augmented, excavationRemainder: {} }), {});
  assert.equal(S.quartzAt('seed', p.cell, 'granite'), S.quartzAt('seed', p.cell, 'granite'));
});
test('dated observations omit private targets, exploration history and hidden source coordinates', () => {
  const s = F.create(), a = specimen(); a.sensed = { cell: { x: 5, y: 5, z: 0 } }; s.creatures.push(a);
  const v = F.observe(s, a, 5); assert.equal(v.mineral.sensed, undefined); assert.equal(v.mineral.foodSources, undefined); assert.equal(v.at, 5);
  const before = JSON.stringify(s); F.advance(s, 600, { dead: true }); assert.equal(JSON.stringify(s), before);
});
