const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('../creature-formation'), D = F.Duskcats;
const cell = (x = 1, y = 1) => ({ x, y, z: 0 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const specimen = (soul = true) => ({ ...D.body(), id: 'original-cat', actorKind: 'duskcat', family: 'duskcat', name: 'Duskcat',
  status: 'alive', health: 100, maxHealth: 100, mapCell: cell(), chamberId: '', injuries: [], formationSoul: { present: soul }, independentIntent: '' });
const env = { light: 20, temperature: 20, disrupted: false };
const hooks = extra => ({ hasWill: F.hasWill, prey: () => null, perceive: () => null, next: () => null, move: () => false, strike: () => null, ...extra });
const receipt = (at = 0) => ({ taskId: `attended-${at}`, heard: true, at });
function train(a) { for (let n = 0; n < 3; n++) assert.ok(D.lesson(a, 'socialize', receipt(n), true));
  D.feed(a, .1, ['original-ration']); for (const kind of ['attack', 'recall']) for (let n = 0; n < 4; n++) assert.ok(D.lesson(a, kind, receipt(n + 3), true)); }
function conserved(a) { near(a.bodyKg + a.foodKg + a.metabolizedKg, 2 + a.foodReceivedKg); near(a.waterL + a.waterLostL, a.waterReceivedL); near(a.manaReserve + a.manaSpent, a.manaReceived); }
test('natural biological feline, separate research/production tiers and real embryo-based recipe', () => {
  assert.equal(F.FAMILIES.duskcat.natural, true); assert.equal(F.FAMILIES.duskcat.researchTier, 2); assert.equal(F.FAMILIES.duskcat.synthesisTier, 0);
  assert.deepEqual(F.COSTS.growDuskcat, { duskcatEmbryo: 1, biomass: 2, nutrientMedium: 1, drinkingWater: 1 });
  const s = F.create(); assert.equal(F.research(s, 'catDocument', receipt(), 0), false);
  for (const m of ['notes', 'catCharacterize', 'catShadeTrial', 'catBrightTrial', 'catDocument']) assert.ok(F.research(s, m, { taskId: m }, 0));
  assert.equal(s.pattern, null); assert.equal(s.rootPattern, null); assert.equal(s.catPattern.evidenceIds.length, 4);
});
for (const soul of [true, false]) test(`eight-hour original-tube formation with ${soul ? 'actual concurrent soul' : 'no soul'}`, () => {
  const s = F.create(); s.catPattern = { family: 'duskcat' }; const used = {};
  const r = F.begin(s, 'original-tube', [{ stackId: 'source-embryo', key: 'duskcatEmbryo', quantity: 1 }], F.soulWindow(soul, 'original-device'), { bodyCell: cell(), roomId: 'lab' }, 0, 'duskcat');
  const h = { support: (r, dt) => ({ ok: true, manaEnergy: dt * 4 / 28800, soulEnergy: soul ? dt * 2 / 28800 : 0 }),
    consume: (r, amounts) => { for (const [k, n] of Object.entries(amounts)) used[k] = (used[k] || 0) + n; return true; }, release: () => {}, environment: () => env, duskcat: hooks() };
  F.advance(s, 14400, h); assert.equal(r.status, 'forming'); assert.equal(used.duskcatEmbryo, 1);
  const restored = F.normalize(s); F.advance(restored, 28800, h); const a = restored.creatures[0];
  assert.equal(a.formationSoul.present, soul); near(restored.runs[0].manaReceived, 4); near(a.formationSoul.gathered, soul ? 2 : 0);
  assert.deepEqual(used, F.COSTS.growDuskcat); near(a.bodyKg + a.foodKg + a.waterL + 1.5, 4.1); conserved(a);
  assert.equal(a.familiarity, 0); assert.deepEqual(a.lessons, { attack: 0, recall: 0 });
});
test('lost original support spends a nonrenewable buffer without changing requested soul or refunding tissue', () => {
  const s = F.create(); s.catPattern = {}; let ok = true, released = 0;
  const r = F.begin(s, 'tube', [], F.soulWindow(true, 'device'), { bodyCell: cell() }, 0, 'duskcat');
  const h = { support: (r, dt) => ({ ok, manaEnergy: dt / 7200, soulEnergy: dt / 14400 }), consume: () => true, release: () => released++ };
  F.advance(s, 8000, h); const used = { ...r.consumed }; ok = false; F.advance(s, 9801, h);
  assert.equal(r.status, 'failed'); assert.equal(s.creatures.length, 0); assert.equal(released, 1); assert.deepEqual(r.consumed, used); assert.equal(r.soulWindow.requested, true);
});
test('Duskcat, Rootling and Sporecap share one original tube without overlapping uncleared runs', () => {
  for (const first of ['duskcat', 'rootling', 'sporecap']) {
    const s = F.create(); s.catPattern = {}; s.rootPattern = {}; s.fungalPattern = {};
    assert.ok(F.begin(s, 'tube', [], F.soulWindow(false), { bodyCell: cell() }, 0, first));
    for (const family of ['duskcat', 'rootling', 'sporecap']) assert.equal(F.begin(s, 'tube', [], F.soulWindow(false), { bodyCell: cell() }, 1, family), null);
  }
});
test('original carrier access requires actual local floor custody or the scientist, never another holder or enclosing container', () => {
  const i = { cell: cell(2) }; assert.equal(D.carrierAccessible(i, cell()), true);
  assert.equal(D.carrierAccessible({ ...i, cell: cell(3) }, cell()), false);
  assert.equal(D.carrierAccessible({ ...i, carriedBy: 'scientist' }, cell()), true);
  for (const blocked of [{ carriedBy: 'other-holder' }, { containerId: 'actual-chest' }, { fixtureId: 'closed-locker' }, { reservedTaskId: 'other-task' }, { carriedBy: 'scientist', containerId: 'actual-chest' }])
    assert.equal(D.carrierAccessible({ ...i, ...blocked }, cell()), false);
});
test('food, water and growth are finite and conserved; normal daylight never burns biological flesh', () => {
  const a = specimen(); a.chamberId = 'tube'; D.feed(a, .4, ['ration']); D.water(a, .5, ['water']);
  for (let t = 60; t <= 36000; t += 60) D.step(a, { ...env, light: 100 }, 60, t, hooks());
  assert.equal(a.health, 100); assert.ok(a.grownKg > 0 && a.grownKg <= .5); conserved(a);
  assert.equal(D.feed(a, 1, ['overflow']), false); assert.equal(D.water(a, 2, ['overflow']), false);
});
test('starvation, dehydration, unsafe temperature and exhaustion cause persistent injuries, not mana repair', () => {
  const a = specimen(false); a.foodKg = 0; a.waterL = 0; a.fatigue = 95;
  D.step(a, { ...env, temperature: -20 }, 3600, 3600, hooks()); assert.ok(a.health < 90); assert.ok(a.injuries.length >= 3);
  const soul = JSON.stringify(a.formationSoul); D.damage(a, 100, 'Impact', 3601); assert.equal(a.status, 'dead'); assert.equal(a.id, 'original-cat');
  assert.equal(D.feed(a, .1, []), false); assert.equal(JSON.stringify(a.formationSoul), soul);
});
test('rest is voluntary and suspends pursuit, whereas a soulless body has no self-care or learned responses', () => {
  for (const soul of [true, false]) { const a = specimen(soul); a.fatigue = 36; let sensed = 0;
    D.step(a, env, 60, 60, hooks({ prey: () => { sensed++; return { id: 'food', cell: cell(2) }; } }));
    assert.equal(a.sleeping, soul); assert.equal(sensed, 0); assert.equal(a.goal, null);
    assert.equal(D.lesson(a, 'socialize', receipt(), F.hasWill(a)), false);
    if (!soul) { assert.equal(a.independentIntent, ''); assert.equal(D.cue(a, 'attack', { id: 'food', cell: cell(2) }, receipt(), false), false); }
  }
});
test('concealment spends finite mana in existing shade without altering illumination; close contact and other senses remain', () => {
  const a = specimen(); const unchanged = JSON.stringify(env);
  D.step(a, env, 3600, 3600, hooks()); assert.equal(a.concealment, true); near(a.manaReserve, 1); assert.equal(JSON.stringify(env), unchanged);
  const observer = { cell: cell(5), lineOfSight: true, channel: 'sight' };
  assert.equal(D.canNotice(a, observer, env, 3600), false); assert.equal(D.canNotice(a, { ...observer, channel: 'scent' }, env, 3600), true);
  assert.equal(D.canNotice(a, { ...observer, cell: cell(2) }, env, 3600), true);
  assert.equal(D.canNotice(a, { ...observer, lineOfSight: false }, env, 3600), false);
  assert.equal(D.canNotice(a, observer, { ...env, light: 80 }, 3600), true); assert.equal(D.canNotice(a, observer, { ...env, disrupted: true }, 3600), true);
  D.step(a, env, 3600, 7200, hooks()); near(a.manaReserve, 0); assert.equal(D.concealed(a, 20, 7200), false); conserved(a);
});
test('real rewarded familiarity and separate lessons are needed; fear, hunger and missing cues refuse', () => {
  const a = specimen(); assert.equal(D.cue(a, 'attack', { id: 'lure', cell: cell(2) }, receipt(), true), false);
  assert.equal(D.lesson(a, 'attack', receipt(), true), false); assert.equal(D.lesson(a, 'socialize', {}, true), false);
  train(a); assert.equal(a.lessonReceipts.length, 11); conserved(a);
  assert.ok(D.cue(a, 'recall', { id: 'scientist', cell: cell(4) }, receipt(20), true));
  a.fear = 50; assert.equal(D.lesson(a, 'socialize', receipt(), true), false); a.fear = 0; a.foodKg = 0;
  assert.equal(D.cue(a, 'attack', { id: 'lure', cell: cell(2) }, receipt(), true), false);
});
test('stalking uses ordinary adjacent moves and finite last-seen goals, not tracking through walls', () => {
  const a = specimen(); train(a); const target = { id: 'lure', cell: cell(5) }; D.cue(a, 'attack', target, receipt(), true);
  let moves = 0; D.step(a, env, 1, 3, hooks({ next: () => cell(2), move: (a, c) => { moves++; a.mapCell = c; return true; } }));
  assert.equal(moves, 1); assert.equal(a.mapCell.x, 2); assert.equal(a.pendingPounce, null);
  D.step(a, env, 1, 61, hooks()); assert.equal(a.goal, null);
});
test('catch-up substeps cannot execute a cue before its actual attended completion', () => {
  const a = specimen(); train(a); const target = { id: 'lure', cell: cell(2) };
  D.cue(a, 'attack', target, receipt(60), true);
  const h = hooks({ perceive: () => target }); D.step(a, env, 1, 59, h); assert.equal(a.pendingPounce, null);
  D.step(a, env, 1, 60, h); assert.equal(a.pendingPounce.dueAt, 62);
});
for (const variation of ['hit', 'dodge', 'bright', 'disrupted']) test(`marked two-second pounce: ${variation}; no guarantee or free mana refund`, () => {
  const a = specimen(); train(a); let target = { id: 'lure', cell: cell(2) }, struck = 0, bonus;
  D.cue(a, 'attack', target, receipt(), true); const h = hooks({ perceive: () => target, strike: (a, t, ambush) => { struck++; bonus = ambush; return { hit: true, damage: 5 }; } });
  D.step(a, env, 1, 1, h); assert.ok(a.pendingPounce); assert.equal(a.pendingPounce.dueAt, 3); assert.equal(a.concealment, false); const mana = a.manaReserve;
  D.step(a, env, 1, 2, h); assert.equal(struck, 0);
  if (variation === 'dodge') target = { ...target, cell: cell(3) };
  D.step(a, { ...env, light: variation === 'bright' ? 80 : 20, disrupted: variation === 'disrupted' }, 1, 3, h);
  assert.equal(struck, variation === 'dodge' ? 0 : 1); if (struck) assert.equal(bonus, variation === 'hit'); near(a.manaReserve, mana);
  assert.equal(a.pendingPounce, null); assert.equal(a.goal, null); assert.equal(a.attacks.length, 1); conserved(a);
});
test('observations omit hidden goals/attack records; save-copy retains identity, intent and paid preparation; scientist death freezes all', () => {
  const s = F.create(), a = specimen(); train(a); s.creatures.push(a); a.createdAt = 0;
  D.cue(a, 'attack', { id: 'lure', cell: cell(2) }, receipt(), true); D.step(a, env, 1, 1, hooks({ perceive: () => ({ id: 'lure', cell: cell(2) }) }));
  const saved = F.normalize(s); assert.deepEqual(saved.creatures, s.creatures); const view = F.observe(s, a, 1);
  assert.equal(view.feline.goal, undefined); assert.equal(view.feline.pendingPounce, undefined); assert.equal(view.feline.attacks, undefined);
  const frozen = JSON.stringify(saved); F.advance(saved, 7200, { dead: true }); assert.equal(JSON.stringify(saved), frozen);
});
