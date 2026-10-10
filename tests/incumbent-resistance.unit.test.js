const { test } = require('node:test');
const assert = require('node:assert/strict');
const Resistance = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    clerk: { id: 'original:clerk', status: 'alive', health: 100, fatigue: 0 }, power: 10, workSeconds: 1500, assignment: null };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], populationSourceId: 'population:a', administrationId: office.institutionId, defenseId: 'defense:a',
    archive: { coverage: [{ cellId: 'a' }] }, institutions: Succession.ROLES.map(role => ({ role,
      id: role === 'centralAdministration' ? office.institutionId : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const s = Resistance.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife';
  const c = { alive: true, capable: true, local: true, busy: false, rulerPresent: true, rulerObserved: true,
    rulerIncapacitated: false, charterCurrent: true, cityId: 'a', authorityId: source.authority.id, bodyEpoch: 0,
    sameGround: true, rulerDistanceM: 1, rulerLineOfEffect: true, rulerTracksScientist: true, escapeReachable: false,
    cell: { x: 17, y: 8, z: 6 }, atCounter: true, clerkPresent: true, recordWitnesses: [office.clerk.id, b.representative.id],
    witnessIds: [office.clerk.id, b.representative.id], activeViolence: false };
  return { office, source, b, succession, s, c, at: 0 };
}
function step(f, seconds = 1, effects = {}) { f.at += seconds; return Resistance.advance(f.s, f.succession, f.office, f.c, f.at, effects); }
function begin(f) { assert.equal(Resistance.demand(f.s, f.succession, f.c, f.at), true); }
function offered(f) { f.succession.ruler.health = 34; begin(f); assert.equal(f.s.phase, 'offered'); }
function recording(f) { offered(f); assert.equal(Resistance.accept(f.s, f.succession, f.office, copy(f.s.terms), f.c, f.at), true); }
test('all themes reuse the original individual, clerk and institutions without creating replacement people or changing world facts', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), world = copy(f.source), identities = Succession.people(f.succession, f.b).map(a => a.id);
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.rulerId, f.source.authority.id);
    assert.equal(f.s.clerkId, f.office.clerk.id); assert.equal(f.s.administrationId, 'admin:a');
    assert.deepEqual(f.source, world); assert.deepEqual(Succession.people(f.succession, f.b).map(a => a.id), identities);
    f.succession.source.authority.kind = 'collective'; assert.equal(Resistance.create(f.succession, f.b, f.office), null);
    f.succession.source.authority.kind = 'individual'; f.succession.source.succession = 'inheritance';
    assert.equal(Resistance.create(f.succession, f.b, f.office), null);
  }
});
test('preparation and reload never replenish the incumbent body, energy, stamina or civic duty work', () => {
  const f = fixture(), r = f.succession.ruler;
  r.health = 23; r.personalDefense.mana = 7; r.personalDefense.stamina = 2; r.workSeconds = 11;
  const saved = copy(r); Resistance.prepareRuler(r); Resistance.create(f.succession, f.b, f.office);
  f.succession = Succession.normalize(f.succession); assert.deepEqual(f.succession.ruler, saved);
  assert.deepEqual(Resistance.normalize(f.s), f.s);
});
test('actual attendance, availability, incumbency and capability gate demands, not defender defeat or reputation', () => {
  for (const change of [f => f.c.local = false, f => f.c.rulerPresent = false, f => f.c.alive = false, f => f.c.capable = false,
    f => f.c.busy = true, f => f.c.rulerIncapacitated = true, f => f.c.authorityId = 'other', f => f.c.cityId = 'other',
    f => f.c.charterCurrent = false, f => f.succession.ruler.assignment = 'another duty', f => f.succession.job = {},
    f => f.succession.ruler.status = 'dead', f => f.succession.handover = {}]) {
    const f = fixture(); change(f); assert.equal(Resistance.demand(f.s, f.succession, f.c, 0), false);
    assert.equal(f.s.encounter, null); assert.equal(f.s.reports.length, 0);
  }
  const f = fixture(); f.b.defender.status = 'dead'; begin(f);
  assert.equal(f.s.phase, 'resisting'); assert.equal(f.s.terms, null); assert.equal(f.succession.control, null);
  for (let i = 0; i < 4; i++) { f.s = Resistance.normalize(f.s); begin(f); }
  assert.equal(f.s.phase, 'resisting'); assert.equal(f.succession.ruler.personalDefense.mana, 90);
});
test('life-preserving exact terms require the capable original person in actual bodily danger and close direct contact', () => {
  for (const change of [f => f.succession.ruler.personalDefense.policy = 'holdOffice', f => f.c.rulerDistanceM = 2,
    f => f.c.rulerLineOfEffect = false]) {
    const f = fixture(); f.succession.ruler.health = 34; change(f); begin(f); assert.equal(f.s.terms, null);
  }
  const f = fixture(); offered(f); const terms = copy(f.s.terms); f.at = 500; begin(f);
  assert.deepEqual(f.s.terms, terms); assert.match(terms.origin, /coercion/); assert.match(terms.retainedRights, /property and faith/);
  assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null);
});
test('personal projection spends finite mana with no artificial body floor or refill', () => {
  const f = fixture(), r = f.succession.ruler;
  assert.deepEqual(Resistance.absorb(r, 30), { damage: 20, absorbed: 10 }); assert.equal(r.personalDefense.mana, 70);
  r.personalDefense.mana = 3; assert.deepEqual(Resistance.absorb(r, 14), { damage: 13, absorbed: 1 });
  assert.equal(r.personalDefense.mana, 1); assert.deepEqual(Resistance.absorb(r, 14, true), { damage: 14, absorbed: 0 });
  r.status = 'dead'; assert.deepEqual(Resistance.absorb(r, 14), { damage: 14, absorbed: 0 });
});
test('pulse costs once, survives reload, keeps its original marked tile and respects actual distance and cover', () => {
  const f = fixture(); begin(f); let telegraphs = 0, damage = 0;
  step(f, 2, { telegraph: () => telegraphs++ }); assert.equal(telegraphs, 1); assert.equal(f.succession.ruler.personalDefense.mana, 78);
  const marked = copy(f.s.pendingPulse); f.s = Resistance.normalize(f.s);
  assert.deepEqual(f.s.pendingPulse, marked);
  // Attacking does not cancel an already paid hostile windup merely because a
  // hit was attempted; an actual offer is a separate ceasefire.
  assert.equal(Resistance.attack(f.s, f.succession, f.office, f.c, f.at, 'strike'), true);
  assert.deepEqual(f.s.pendingPulse, marked);
  step(f, 2, { pulse: n => damage += n }); step(f, 0, { pulse: n => damage += n });
  assert.equal(damage, 12); assert.equal(f.succession.ruler.personalDefense.mana, 78);
  for (const change of [f => f.c.cell.x++, f => f.c.rulerLineOfEffect = false, f => f.c.rulerDistanceM = 5]) {
    const f = fixture(); begin(f); step(f, 2); change(f); step(f, 2, { pulse: () => assert.fail('Blocked or vacated pulse hit') });
  }
});
test('physical escape spends stamina only for real steps; blocked routes and exhausted reserves do not teleport', () => {
  const f = fixture(); f.c.escapeReachable = true; begin(f); const r = f.succession.ruler, original = copy(r.mapCell);
  step(f, 1, { move: () => false }); assert.equal(r.personalDefense.stamina, 80); assert.deepEqual(r.mapCell, original);
  step(f, 1, { move: (actor, target) => { assert.deepEqual(target, Resistance.ESCAPE); actor.mapCell.y++; return true; } });
  assert.equal(r.personalDefense.stamina, 79); assert.equal(r.mapCell.y, original.y + 1);
  r.personalDefense.stamina = 0; r.personalDefense.mana = 0; step(f, 1, { move: () => assert.fail('Exhausted escape') });
  assert.equal(f.s.phase, 'resisting'); assert.equal(f.s.receipt, null);
  const escaped = fixture(); escaped.c.escapeReachable = true; escaped.c.rulerDistanceM = 5; begin(escaped);
  step(escaped, 1, { move: actor => { actor.mapCell = copy(Resistance.ESCAPE); return true; } });
  assert.equal(escaped.s.phase, 'escapedLocalEncounter'); assert.equal(escaped.succession.ruler.assignment, null);
});
test('ordinary close attacks use finite stamina and recovery; a fatal pulse stops subsequent physical escape', () => {
  const f = fixture(); begin(f); f.succession.ruler.personalDefense.mana = 0; let strikes = 0;
  step(f, 2, { strike: () => strikes++ }); step(f, 1, { strike: () => strikes++ });
  assert.equal(strikes, 1); assert.equal(f.succession.ruler.personalDefense.stamina, 74);
  const lethal = fixture(); begin(lethal); step(lethal, 2); lethal.c.escapeReachable = true; let alive = true;
  step(lethal, 2, { pulse: () => alive = false, alive: () => alive, move: () => assert.fail('Post-death motion') });
});
test('exact terms, original authorized clerk, power, work, nonviolence and physically attended declaration gate acceptance', () => {
  for (const change of [f => f.c.atCounter = false, f => f.c.rulerPresent = false, f => f.c.clerkPresent = false,
    f => f.c.recordWitnesses = [], f => f.c.rulerIncapacitated = true, f => f.c.activeViolence = true, f => f.c.busy = true,
    f => f.c.bodyEpoch++, f => f.c.charterCurrent = false, f => f.office.institutionId = 'another administration',
    f => f.office.clerk.id = 'replacement', f => f.office.clerk.health = 49, f => f.office.clerk.status = 'dead',
    f => f.office.clerk.fatigue = 80, f => f.office.channelPowered = false, f => f.office.active = false,
    f => f.office.assignment = 'another job', f => f.office.clerk.assignment = 'another job', f => f.office.power = 0,
    f => f.office.workSeconds = 59, f => f.succession.ruler.workSeconds = 59, f => f.office.availableAt = 1]) {
    const f = fixture(); offered(f); change(f);
    assert.equal(Resistance.accept(f.s, f.succession, f.office, copy(f.s.terms), f.c, 0), false);
    assert.equal(f.s.job, null); assert.equal(f.s.receipt, null);
  }
  const f = fixture(); offered(f);
  assert.equal(Resistance.accept(f.s, f.succession, f.office, { ...f.s.terms, origin: 'voluntary' }, f.c, 0), false);
});
test('outages and absent attendance pause without backfill; reload preserves finite single clerk duty pool', () => {
  const f = fixture(); recording(f); step(f, 20);
  assert.equal(f.office.power, 9); assert.equal(f.office.workSeconds, 1480); assert.equal(f.succession.ruler.workSeconds, 1780);
  assert.equal(f.office.clerk.workSeconds, undefined);
  f.office.channelPowered = false; step(f, 300); assert.equal(f.s.job.progress, 20);
  f.s = Resistance.normalize(f.s); f.succession = Succession.normalize(f.succession);
  f.office.channelPowered = true; step(f, 100); assert.equal(f.s.job.progress, 20);
  step(f, 10); assert.equal(f.s.job.progress, 30); f.c.rulerPresent = false; step(f, 100);
  f.c.rulerPresent = true; step(f, 100); assert.equal(f.s.job.progress, 30); step(f, 30);
  assert.equal(f.s.phase, 'claimed'); assert.equal(f.office.workSeconds, 1440); assert.equal(f.succession.ruler.workSeconds, 1740);
});
test('one honest authenticated declaration is only a disputed claim, never command, voluntary handover or reset resources', () => {
  const f = fixture(), world = copy(f.source), agreements = copy(f.succession.agreements); recording(f); step(f, 60);
  const receipt = copy(f.s.receipt); assert.equal(receipt.origin, 'coerced'); assert.equal(receipt.declarantId, 'ruler:a');
  assert.equal(receipt.recorderId, 'original:clerk'); assert.equal(receipt.recorderInstitutionId, 'admin:a');
  assert.equal(receipt.recognition, 'disputedSuccessorClaim'); assert.deepEqual(receipt.institutionalCommand, []);
  assert.equal(f.succession.ruler.status, 'alive'); assert.equal(f.succession.ruler.officeStatus.status, 'abdicatedUnderCoercion');
  assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null); assert.deepEqual(f.succession.agreements, agreements);
  assert.deepEqual(f.source, world); assert.equal(f.office.assignment, null); assert.equal(f.office.clerk.assignment, null);
  f.s = Resistance.normalize(f.s); step(f, 200); assert.deepEqual(f.s.receipt, receipt);
  assert.equal(Resistance.accept(f.s, f.succession, f.office, copy(f.s.terms), f.c, f.at), false);
  assert.equal(Resistance.demand(f.s, f.succession, f.c, f.at), false); assert.equal(f.office.power, 9);
  assert.match(Succession.localReason(f.succession, f.b, f.office, f.c), /separate institutional recognition/);
  assert.equal(Succession.request(f.succession, f.b, f.office, null, f.c, f.at), false);
  assert.doesNotMatch(JSON.stringify(Resistance.publicView(f.s)), /personalDefense|workSeconds|"skills"|"mapCell"/);
});
test('attacks cancel unsigned declarations and release original reservations without refund or free signature', () => {
  const f = fixture(); recording(f); step(f, 20);
  assert.equal(Resistance.attack(f.s, f.succession, f.office, f.c, f.at, 'soulLash'), true);
  assert.equal(f.s.job, null); assert.equal(f.s.terms, null); assert.equal(f.office.assignment, null);
  assert.equal(f.office.clerk.assignment, null); assert.equal(f.office.workSeconds, 1480); assert.equal(f.office.power, 9);
  assert.equal(f.s.receipt, null); assert.equal(f.s.reports.at(-1).kind, 'attackOnIncumbent');
});
test('incumbent death or incapacity cannot declare; scientist death freezes; body changes, expiry and departures award nothing', () => {
  for (const change of [f => f.succession.ruler.status = 'dead', f => f.c.rulerIncapacitated = true]) {
    const f = fixture(); recording(f); step(f, 20); change(f); step(f, 60);
    assert.equal(f.s.phase, 'unresolvedSuccession'); assert.equal(f.s.receipt, null); assert.equal(f.office.assignment, null);
    assert.equal(f.office.workSeconds, 1480); assert.equal(f.succession.control, null);
  }
  const dead = fixture(); recording(dead); dead.c.alive = false; const saved = copy(dead.s); step(dead, 10000); assert.deepEqual(dead.s, saved);
  const body = fixture(); recording(body); body.c.bodyEpoch++; step(body, 60); assert.equal(body.s.phase, 'interrupted'); assert.equal(body.s.receipt, null);
  const expired = fixture(); recording(expired); step(expired, 3600); assert.equal(expired.s.phase, 'expired'); assert.equal(expired.s.receipt, null);
  const away = fixture(); begin(away); away.c.local = false; step(away); assert.equal(away.s.phase, 'withdrawn'); assert.equal(away.s.receipt, null);
  const abandoned = fixture(); recording(abandoned); step(abandoned, 20);
  assert.equal(Resistance.withdraw(abandoned.s, abandoned.succession, abandoned.office, abandoned.c, abandoned.at), true);
  assert.equal(abandoned.s.phase, 'withdrawn'); assert.equal(abandoned.office.workSeconds, 1480); assert.equal(abandoned.s.receipt, null);
});
