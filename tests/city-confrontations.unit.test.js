const { test } = require('node:test');
const assert = require('node:assert/strict');
const Confrontation = require('../city-confrontations');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Challenges = require('../defender-challenges');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a' };
  const source = { cityId: 'a', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], populationSourceId: 'population:a', administrationId: 'admin:a', defenseId: 'defense:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }); Challenges.prepareDefender(b);
  const succession = Succession.create(source, b, office, { theme });
  const s = Confrontation.create(succession, b, theme);
  const c = { alive: true, capable: true, local: true, busy: false, rulerPresent: true, charterCurrent: true,
    authorityId: source.authority.id, bodyEpoch: 0, defenseAvailable: true, defenderIncapacitated: false, sameGround: true,
    cell: { x: 17, y: 8, z: 6 }, rulerDistance: 2, distanceM: 3, lineOfEffect: true, defenderTracksScientist: true,
    defenderCanHear: true, defenderObserved: true, witnessIds: [succession.ruler.id, b.representative.id] };
  return { b, succession, s, c, at: 0 };
}
function begin(f) { assert.equal(Confrontation.demand(f.s, f.succession, f.b, f.c, f.at), true); }
function step(f, seconds = 1, effects = {}) { f.at += seconds; return Confrontation.advance(f.s, f.succession, f.b, f.c, f.at, effects); }
test('a personally heard renewed threat resumes the original defender with retained reserves, not a new person or attack allegation', () => {
  const f = fixture(); begin(f); step(f, 2);
  assert.equal(Confrontation.ceasefire(f.s, f.b, f.c, f.at, 'incumbent'), true);
  const original = copy(f.b.defender);
  assert.equal(Confrontation.renewedThreat(f.s, f.b, { ...f.c, defenderCanHear: false }, f.at), false);
  assert.equal(Confrontation.renewedThreat(f.s, f.b, f.c, f.at), true);
  assert.equal(f.s.phase, 'fighting'); assert.equal(f.b.defender.wardMana, original.wardMana);
  assert.equal(f.b.defender.stamina, original.stamina); assert.equal(f.b.defender.id, original.id);
  assert.equal(f.s.reports.at(-1).kind, 'renewedThreatToIncumbent'); assert.equal(f.s.encounter.ceasefire, null);
});
test('coerced personal relinquishment cannot be recycled into another incumbent-protection demand or sovereignty', () => {
  const f = fixture(); f.succession.ruler.assignment = 'original-resistance';
  assert.equal(Confrontation.demand(f.s, f.succession, f.b, { ...f.c, rulerResistanceId: 'original-resistance' }, 0), true);
  f.succession.ruler.officeStatus = { status: 'abdicatedUnderCoercion', sourceReceiptId: 'original:declaration' };
  step(f); assert.equal(f.s.outcomes[0].outcome, 'interventionDutyUnavailable');
  assert.equal(f.succession.control, null);
  assert.equal(Confrontation.demand(f.s, f.succession, f.b, f.c, f.at), false);
});
test('every theme binds the existing incumbent and defender; refusal supplies no authority or prerequisite bout', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), original = copy(f.succession); begin(f);
    assert.equal(f.s.encounter.abdication, 'rejected'); assert.equal(f.s.sourceTheme, 'shared');
    assert.deepEqual(f.succession, original); assert.equal(f.succession.handover, null);
    assert.equal(f.s.reports.length, 2); assert.match(f.s.reports[0].finding, /separate proceedings/);
  }
});
test('attendance, actual incumbency, supported duties, health and assignments gate a demand, not reputation', () => {
  for (const change of [f => f.c.rulerPresent = false, f => f.c.local = false, f => f.c.capable = false,
    f => f.c.authorityId = 'other', f => f.c.charterCurrent = false, f => f.c.defenseAvailable = false, f => f.c.defenderCanHear = false,
    f => f.b.defender.id = 'invented-replacement', f => f.b.source.charterId = 'other-charter',
    f => f.b.defender.assignment = 'walls duty', f => f.b.defender.status = 'dead', f => f.c.defenderIncapacitated = true,
    f => f.succession.ruler.assignment = 'other audience', f => f.succession.handover = { at: 1 }]) {
    const f = fixture(); change(f); assert.equal(Confrontation.demand(f.s, f.succession, f.b, f.c, 0), false);
    assert.equal(f.s.encounter, null); assert.equal(f.s.reports.length, 0);
  }
  const f = fixture(); f.succession.source.authority.kind = 'collective'; assert.equal(Confrontation.create(f.succession, f.b), null);
});
test('idempotent defender preparation never restores saved health, energy, stamina or work', () => {
  const f = fixture(); f.b.defender.wardMana = 7; f.b.defender.stamina = 2; f.b.defender.health = 34; f.b.defender.workSeconds = 0;
  const d = copy(f.b.defender); Challenges.prepareDefender(f.b); Challenges.create(f.b);
  assert.deepEqual(f.b.defender, d);
});
test('hostile projection uses finite original energy and no training health threshold or injury floor', () => {
  const f = fixture(); f.b.defender.health = 34; begin(f);
  assert.deepEqual(Confrontation.absorb(f.s, f.b, 30), { damage: 6, absorbed: 24 }); assert.equal(f.b.defender.wardMana, 96);
  f.b.defender.wardMana = 3; assert.deepEqual(Confrontation.absorb(f.s, f.b, 30), { damage: 27, absorbed: 3 });
  assert.equal(f.b.defender.wardMana, 0); assert.deepEqual(Confrontation.absorb(f.s, f.b, 30, true), { damage: 30, absorbed: 0 });
});
test('a real pulse telegraphs, spends mana once, survives reload and checks marked tile, range and cover', () => {
  const f = fixture(); begin(f); let marked = 0, damage = 0;
  step(f, 2, { telegraph: () => marked++ }); assert.equal(marked, 1); assert.equal(f.b.defender.wardMana, 108);
  const saved = copy(f.s); f.s = Confrontation.normalize(saved); assert.deepEqual(f.s, saved);
  step(f, 2, { pulse: n => damage += n }); assert.equal(damage, 18); assert.equal(f.b.defender.wardMana, 108);
  step(f, 0, { pulse: n => damage += n }); assert.equal(damage, 18);
  for (const change of [f => f.c.cell.x++, f => f.c.distanceM = 7, f => f.c.lineOfEffect = false]) {
    const f = fixture(); begin(f); step(f, 2); change(f); let hit = false; step(f, 2, { pulse: () => hit = true }); assert.equal(hit, false);
  }
});
test('physical pursuit and ordinary close strikes spend stamina only for successful steps and attempts', () => {
  const f = fixture(); begin(f); f.c.defenderTracksScientist = true; f.b.defender.wardMana = 0;
  const before = copy(f.b.defender.mapCell); step(f, 1, { move: () => false }); assert.equal(f.b.defender.stamina, 100);
  step(f, 1, { move: actor => { actor.mapCell.x--; return true; } }); assert.equal(f.b.defender.stamina, 99);
  assert.notDeepEqual(f.b.defender.mapCell, before); f.c.distanceM = 1; let strike = 0;
  step(f, 1, { strike: () => strike++ }); assert.equal(strike, 1); assert.equal(f.b.defender.stamina, 93);
  step(f, 1, { strike: () => strike++ }); assert.equal(strike, 1);
});
test('the encounter has no two-minute training deadline, damage-loss concession or supervision cutoff', () => {
  const f = fixture(); begin(f); f.b.defender.wardMana = 0; f.b.defender.workSeconds = 0; f.b.defender.health = 34;
  f.c.distanceM = 5; f.c.witnessIds = [];
  step(f, 121); assert.equal(f.s.phase, 'fighting'); assert.equal(f.s.outcomes.length, 0); assert.equal(f.succession.control, null);
});
test('personal ceasefire cancels a paid windup without refund, teleportation or political submission', () => {
  const f = fixture(); begin(f); step(f, 2); const cell = copy(f.b.defender.mapCell);
  assert.equal(Confrontation.ceasefire(f.s, f.b, f.c, f.at), true); assert.equal(f.s.pendingPulse, null);
  step(f, 100, { pulse: () => assert.fail('ceasefire attacked') }); assert.equal(f.b.defender.wardMana, 108);
  assert.deepEqual(f.b.defender.mapCell, cell); assert.equal(f.succession.control, null);
  assert.equal(Confrontation.attack(f.s, f.b, f.c, f.at, 'strike'), true); assert.equal(f.s.phase, 'fighting');
  assert.equal(f.s.encounter.ceasefire, null); assert.equal(f.s.reports.length, 4);
});
test('exhaustion or self-preservation is a personal ceasefire, never an incumbent concession', () => {
  for (const change of [f => f.b.defender.health = 20, f => { f.b.defender.wardMana = 0; f.b.defender.stamina = 0; }]) {
    const f = fixture(); begin(f); change(f); step(f); assert.equal(f.s.phase, 'ceasefire');
    assert.equal(f.s.encounter.ceasefire.by, 'defender'); assert.equal(f.s.encounter.abdication, 'rejected'); assert.equal(f.succession.control, null);
  }
});
test('incapacity, death and actual withdrawal create exactly-once bounded outcomes, not city surrender or arrest', () => {
  for (const [change, outcome] of [[f => f.c.defenderIncapacitated = true, 'defenderIncapacitated'],
    [f => { f.b.defender.status = 'dead'; f.b.defender.health = 0; }, 'defenderDead'],
    [f => { f.c.distanceM = 7; f.c.rulerDistance = 9; }, 'scientistPhysicallyWithdrew'],
    [f => f.c.capable = false, 'scientistIncapacitated']]) {
    const f = fixture(); begin(f); change(f); step(f); const receipt = copy(f.s.outcomes);
    assert.equal(receipt[0].outcome, outcome); assert.equal(receipt[0].sovereignty, 'unchanged');
    f.s = Confrontation.normalize(f.s); step(f); assert.deepEqual(f.s.outcomes, receipt); assert.equal(f.succession.control, null);
  }
});
test('returning actors walk with retained wounds and energy; a renewed attack records a distinct encounter', () => {
  const f = fixture(); begin(f); f.b.defender.mapCell.x--; f.c.sameGround = false; step(f);
  assert.equal(f.s.phase, 'returning'); const outcome = copy(f.s.outcomes[0]); f.c.sameGround = true;
  Confrontation.attack(f.s, f.b, f.c, f.at, 'strike'); assert.equal(f.s.phase, 'fighting');
  assert.notEqual(f.s.encounter.id + ':outcome', outcome.id); f.c.sameGround = false; step(f);
  assert.equal(f.s.outcomes.length, 2); step(f, 1, { move: (a, target) => { a.mapCell = copy(target); return true; } }); step(f);
  assert.equal(f.s.phase, 'closed'); assert.equal(f.b.defender.stamina, 99); assert.equal(f.b.defender.assignment, null);
});
test('lost duties stop intervention without overriding a foreign reservation; death freezes all new work', () => {
  const f = fixture(); begin(f); f.b.defender.assignment = 'emergency walls repair'; step(f);
  assert.equal(f.s.phase, 'closed'); assert.equal(f.b.defender.assignment, 'emergency walls repair');
  const g = fixture(); begin(g); g.c.alive = false; const before = copy(g); step(g, 1000);
  assert.deepEqual(g.s, before.s); assert.deepEqual(g.b, before.b);
});
test('local withdrawal requires actually leaving both the heard incumbent vicinity and defender attack reach', () => {
  const f = fixture(); begin(f); Confrontation.ceasefire(f.s, f.b, f.c, 0);
  f.c.rulerDistance = 5; f.c.distanceM = 6; step(f); assert.equal(f.s.phase, 'ceasefire');
  f.c.distanceM = 7; step(f); assert.equal(f.s.outcomes[0].outcome, 'scientistPhysicallyWithdrew');
});
test('a lethal attack does not perform a subsequent free pursuit step after scientist death', () => {
  const f = fixture(); begin(f); step(f, 2); f.c.defenderTracksScientist = true;
  let living = true, moved = false;
  step(f, 2, { pulse: () => living = false, alive: () => living, move: () => { moved = true; return true; } });
  assert.equal(living, false); assert.equal(moved, false); assert.equal(f.b.defender.stamina, 100);
});
test('only actual witnesses report attacks; public records omit private reserves and actual skill totals', () => {
  const f = fixture(); f.c.witnessIds = []; begin(f); Confrontation.attack(f.s, f.b, f.c, 1, 'strike');
  assert.equal(f.s.reports.length, 0); assert.doesNotMatch(JSON.stringify(Confrontation.publicView(f.s)), /wardMana|staminaCapacity|workSeconds|skills/);
});
test('lost sight prevents omniscient retargeting and pursuit, while a previously marked pulse remains a physical effect', () => {
  const f = fixture(); begin(f); f.c.defenderTracksScientist = false; let moved = false;
  step(f, 2, { move: () => { moved = true; return true; } }); assert.equal(f.s.pendingPulse, null);
  assert.equal(f.b.defender.wardMana, 120); assert.equal(moved, false);
  f.c.defenderTracksScientist = true; step(f); assert.ok(f.s.pendingPulse);
  f.c.defenderTracksScientist = false; let damage = 0; step(f, 2, { pulse: n => damage += n }); assert.equal(damage, 18);
});
