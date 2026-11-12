const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('../creature-formation'), W = F.Wisps;
const cell = (x = 1, y = 1, z = 0) => ({ x, y, z });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const specimen = (souled = true) => ({ ...W.body(), id: 'original-wisp', actorKind: 'lanternWisp', family: 'lanternWisp', name: 'Wisp',
  mapCell: cell(), status: 'alive', health: 100, maxHealth: 100, injuries: [], formationSoul: { present: souled }, independentIntent: '' });
const env = { temperature: 20, disrupted: false };
const hooks = extra => ({ hasWill: F.hasWill, teacher: () => null, next: () => null, move: () => false, ...extra });
const receipt = (at = 0) => ({ at, taskId: `attended-${at}`, heard: true });
const teacher = (c = cell(4)) => ({ cell: c, lineOfSight: true });
function conserved(a) { near(a.bodyKg + a.brokenKg, .1); near(a.manaReserve + a.manaSpent, a.manaReceived); }
function train(a) {
  assert.ok(W.recharge(a, { at: 0, sourceIds: ['original-feedstock'] }));
  for (let n = 0; n < 3; n++) assert.ok(W.lesson(a, 'familiarity', receipt(n), true));
  for (const kind of ['follow', 'stay']) for (let n = 0; n < 3; n++) assert.ok(W.lesson(a, kind, receipt(n + 3), true));
}
test('natural luminous mineral creature, separate tiers and performed controls; no Mudlet research required', () => {
  const s = F.create(); assert.equal(F.research(s, 'wispDocument', {}, 0), false);
  for (const m of ['notes', 'wispCharacterize', 'wispStable', 'wispOvercharge', 'wispDocument']) assert.ok(F.research(s, m, { taskId: m }, 0));
  assert.equal(s.pattern, null); assert.equal(s.wispPattern.family, 'lanternWisp'); assert.equal(s.wispPattern.evidenceIds.length, 4);
  assert.equal(F.FAMILIES.lanternWisp.researchTier, 2); assert.equal(F.FAMILIES.lanternWisp.synthesisTier, 0); assert.equal(F.FAMILIES.lanternWisp.natural, true);
  assert.deepEqual(F.COSTS.growWisp, { glowSalts: 1 });
});
for (const soul of [true, false]) test(`original sourced ten-minute formation with ${soul ? 'actual concurrent own soul' : 'unassisted soulless result'}`, () => {
  const s = F.create(); s.wispPattern = {}; let consumed = 0;
  const r = F.begin(s, 'original-chamber', [{ stackId: 'original-salts', key: 'glowSalts', quantity: 1 }], F.soulWindow(soul, 'inherited-device'), { bodyCell: cell() }, 0, 'lanternWisp');
  const h = { support: (r, dt) => ({ ok: true, manaEnergy: dt / 600 * 4, soulEnergy: soul ? dt / 600 * 2 : 0 }),
    consume: (r, amounts) => { consumed += amounts.glowSalts; return true; }, release: () => {}, environment: () => env, wisp: hooks() };
  F.advance(s, 300, h); assert.equal(r.status, 'forming'); assert.equal(consumed, 1);
  const saved = F.normalize(s); F.advance(saved, 600, h); const a = saved.creatures[0]; assert.equal(a.formationSoul.present, soul);
  near(saved.runs[0].manaReceived, 4); near(a.manaReserve + a.formationManaSpent, 4); assert.equal(a.familiarity, 0); conserved(a);
  saved.pattern = {}; // Eligible alternative family, not a missing-pattern refusal.
  assert.equal(F.begin(saved, 'original-chamber', [], F.soulWindow(false), {}, 600, 'mudlet'), null);
});
test('lost support consumes a nonrenewable buffer and retains incorporated original salts, never a replacement soul', () => {
  const s = F.create(); s.wispPattern = {}; let ok = true, released = 0;
  const r = F.begin(s, 'chamber', [], F.soulWindow(true, 'device'), { bodyCell: cell() }, 0, 'lanternWisp');
  const h = { support: (r, dt) => ({ ok, manaEnergy: dt / 150, soulEnergy: dt / 300 }), consume: () => true, release: () => released++ };
  F.advance(s, 300, h); ok = false; F.advance(s, 420, h); assert.equal(r.status, 'failed'); assert.equal(released, 1);
  assert.equal(r.consumed.glowSalts, 1); assert.equal(r.soulWindow.requested, true); assert.equal(s.creatures.length, 0);
});
test('real emitted light has finite mana; souled low-reserve dimming is not soulless self-care', () => {
  const a = specimen(), b = specimen(false); W.step(a, env, 3600, 3600, hooks()); W.step(b, env, 3600, 3600, hooks());
  near(a.manaReserve, 1.5); near(b.manaReserve, 0); assert.equal(W.light(a), 20); assert.equal(W.light(b), 0); conserved(a); conserved(b);
  assert.equal(b.independentIntent, ''); assert.equal(W.lesson(b, 'familiarity', receipt(), false), false);
});
test('opaque shutters hide light without saving internal fuel; closed formation chamber and dead cores emit none', () => {
  const a = specimen(); W.recharge(a, { sourceIds: ['actual-fuel'] }); a.shutterClosed = true;
  W.step(a, env, 3600, 3600, hooks()); near(a.manaReserve, 8); assert.equal(W.light(a), 0); a.shutterClosed = false; assert.equal(W.light(a), 60);
  a.chamberId = 'sealed-chamber'; assert.equal(W.light(a), 0); a.chamberId = ''; W.damage(a, 100, 'Impact', 3600); assert.equal(W.light(a), 0); conserved(a);
});
test('supplied recharging has capacity and source receipts; starvation is finite and dead identity cannot restart', () => {
  const a = specimen(false), soul = JSON.stringify(a.formationSoul); assert.equal(W.recharge(a, {}), false);
  assert.ok(W.recharge(a, { sourceIds: ['original-stack'] })); assert.equal(W.recharge(a, { sourceIds: ['overflow'] }), false);
  for (let t = 60; t <= 20 * 3600; t += 60) W.step(a, env, 60, t, hooks());
  assert.equal(a.status, 'dead'); assert.equal(W.recharge(a, { sourceIds: ['not-resurrection'] }), false); assert.equal(a.id, 'original-wisp');
  assert.equal(JSON.stringify(a.formationSoul), soul); conserved(a);
});
test('familiarity and separate learned cues spend stored mana and preserve actual attended receipts', () => {
  const a = specimen(); assert.equal(W.cue(a, 'follow', teacher(), receipt(), true), false); assert.equal(W.lesson(a, 'follow', receipt(), true), false);
  train(a); assert.equal(a.lessonReceipts.length, 9); assert.ok(W.cue(a, 'follow', teacher(), receipt(10), true));
  assert.equal(W.cue(a, 'invented-command', teacher(), receipt(), true), false); assert.equal(W.cue(a, 'stay', { ...teacher(), lineOfSight: false }, receipt(), true), false);
  assert.equal(W.cue(a, 'follow', teacher(cell(9)), receipt(), true), false); conserved(a);
});
test('following uses ordinary adjacent movement, expires and cannot execute before the received cue', () => {
  const a = specimen(); train(a); W.cue(a, 'follow', teacher(), receipt(10), true); let moved = 0;
  const h = hooks({ teacher: () => teacher(), next: () => cell(2), move: () => { moved++; return true; } });
  W.step(a, env, 1, 9, h); assert.equal(moved, 0); W.step(a, env, 1, 10, h); assert.equal(moved, 1); assert.deepEqual(a.mapCell, cell(2));
  W.step(a, env, 1, 311, h); assert.equal(a.goal, null);
});
test('closed barriers, long separation and different strata provide no phasing or hidden teacher tracking', () => {
  const a = specimen(); train(a); W.cue(a, 'follow', teacher(), receipt(), true);
  W.step(a, env, 1, 2, hooks({ teacher: () => teacher(), next: () => cell(2), move: () => false })); assert.deepEqual(a.mapCell, cell());
  const last = { ...a.goal.lastSeenCell }; W.step(a, env, 1, 3, hooks({ teacher: () => teacher(cell(5, 1, 1)) })); assert.deepEqual(a.goal.lastSeenCell, last);
  W.step(a, env, 1, 18, hooks()); assert.equal(a.goal, null); assert.deepEqual(a.mapCell, cell());
});
test('stay, injury, fear, disruption and enclosure interrupt independent movement instead of manufacturing loyalty', () => {
  const a = specimen(); train(a); const h = hooks({ teacher: () => teacher(), next: () => cell(2), move: () => { throw Error('Must stay'); } });
  W.cue(a, 'stay', teacher(), receipt(), true); W.step(a, env, 1, 2, h); assert.match(a.mode, /stay/);
  a.carryStackId = 'original-lantern'; W.step(a, env, 1, 3, h); assert.equal(a.goal, null);
  a.carryStackId = ''; a.fear = 50; assert.equal(W.cue(a, 'follow', teacher(), receipt(), true), false);
  a.fear = 0; W.cue(a, 'follow', teacher(), receipt(), true); W.step(a, { ...env, disrupted: true }, 60, 60, h); assert.equal(a.goal, null); assert.ok(a.health < 100);
});
test('fragile core fractures retain all mineral mass; real housing absorbs finite impacts and then breaks', () => {
  const a = specimen(), housing = { condition: 100 }; near(W.shield(housing, 10), 0); near(housing.condition, 60);
  const remainder = W.shield(housing, 20); near(remainder, 5); assert.equal(housing.condition, 0);
  W.damage(a, remainder, 'Physical impact', 0); assert.equal(a.health, 85); assert.ok(a.brokenKg > 0); conserved(a);
});
test('observations omit private route/teacher memory; normal saves retain it; final scientist death freezes everything', () => {
  const s = F.create(), a = specimen(); train(a); W.cue(a, 'follow', teacher(), receipt(), true); s.creatures.push(a);
  const v = F.observe(s, a, 0); assert.equal(v.wisp.goal, undefined); assert.equal(v.wisp.moves, undefined);
  const saved = F.normalize(s); assert.deepEqual(saved.creatures, s.creatures); const frozen = JSON.stringify(saved); F.advance(saved, 7200, { dead: true }); assert.equal(JSON.stringify(saved), frozen);
});
