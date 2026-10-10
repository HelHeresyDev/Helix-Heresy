const { test } = require('node:test');
const assert = require('node:assert/strict');
const Defense = require('../defense-recognition');
const Works = require('../public-works-recognition');
const Watch = require('../watch-recognition');
const Charter = require('../charter-recognition');
const Abdication = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Institutions = require('../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap', conduct = []) {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    civicCounter: { cell: { x: 17, y: 8, z: 6 } }, clerk: { id: 'clerk:a', locationId: 'office:a',
      mapCell: { x: 18, y: 8, z: 6 }, status: 'alive', health: 100 }, power: 12, workSeconds: 14400, assignment: null, records: [] };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Explicit local rule.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Abdication.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const c = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: copy(conduct),
    publicWorksAvailable: true, publicWorksInstitutionId: source.institutions.find(i => i.role === Works.ROLE).id,
    watchAvailable: true, watchInstitutionId: source.institutions.find(i => i.role === Watch.ROLE).id,
    geometryAvailable: true, postReachable: true, counterVisible: true, presentIds: succession.leaders.map(a => a.id) };
  assert.ok(Abdication.demand(abdication, succession, c, 0));
  assert.ok(Abdication.accept(abdication, succession, office, copy(abdication.terms), c, 0)); Abdication.advance(abdication, succession, office, c, 60);
  const charter = Charter.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Charter.admin(charter, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  const args = [charter, succession, abdication, office, institutions];
  assert.ok(Charter.file(...args, c, 60)); let at = charter.review.readyAt;
  assert.ok(Charter.hear(...args, c, at)); at += 180; Charter.advance(...args, c, at);
  assert.ok(Charter.meeting(...args, c, at)); at += 60; Charter.advance(...args, c, at);
  assert.ok(Charter.sign(...args, copy(charter.terms), c, at)); at += 60; Charter.advance(...args, c, at);
  require('../defender-challenges').prepareDefender(b);
  c.defenseInstitutionId = b.source.defenseId; c.defenseAvailable = true; c.defenseConditions = [];
  c.coverDistanceM = 2; c.coverVisible = true; c.presentIds.push(b.defender.id);
  const s = Defense.create(charter, succession, b, office, theme), actor = b.defender;
  actor.defensePolicy = 'considerLimitedCover';
  return { s, charter, succession, abdication, office, c, at, actor, b, institutions };
}

const args = f => [f.s, f.charter, f.succession, f.abdication, f.b, f.office];
const move = (a, target) => { for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) { a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true; } return false; };
function tick(f, seconds = 1, effects = { move }) { f.at += seconds; Defense.advance(...args(f), f.c, f.at, effects); }
function recognize(f) { assert.ok(Defense.meet(...args(f), f.c, f.at)); tick(f, 60); assert.ok(Defense.sign(...args(f), copy(f.s.terms), f.c, f.at)); tick(f, 60); }
function cover(f) { recognize(f); assert.ok(Defense.order(...args(f), Defense.instructionTerms(f.s), f.c, f.at)); tick(f, 30); for (let n = 0; n < 20 && f.s.duty.status !== 'covering'; n++) tick(f); assert.equal(f.s.duty.status, 'covering'); }
const hit = (f, amount = 20, types = ['physical', 'force']) => Defense.absorb(f.s, f.b, amount, types, f.c, f.at);
test('uninitialized ordinary runs have no phantom defender or public records', () => {
  assert.equal(Defense.actor(null, null), null); assert.equal(Defense.actor(null, {}), null);
  assert.equal(Defense.create(null, null, null, null), null); assert.equal(Defense.publicView(null), null);
});
test('all themes use original defender and independent finite agreement without other signatures or resource restoration', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), before = copy({ original: f.charter.recognition, ruler: f.succession.ruler, stock: f.b.depot, mana: f.actor.wardMana, stamina: f.actor.stamina });
    f.actor.health = 68; const work = f.actor.workSeconds, clerk = f.office.workSeconds, power = f.office.power;
    recognize(f);
    assert.equal(f.s.receipt.role, Defense.ROLE); assert.equal(f.s.receipt.origin, 'coerced');
    assert.equal(f.s.receipt.personId, f.actor.id); assert.equal(f.actor.workSeconds, work - 120);
    assert.equal(f.office.workSeconds, clerk - 120); assert.equal(f.office.power, power - 2); assert.equal(f.actor.health, 68);
    assert.deepEqual({ original: f.charter.recognition, ruler: f.succession.ruler, stock: f.b.depot, mana: f.actor.wardMana, stamina: f.actor.stamina }, before);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.equal(f.succession.provision.stock, 0);
    assert.deepEqual(f.succession.agreements, []);
  }
});
test('missing or forged basis and changed original people never authorize', () => {
  const f = fixture(); assert.equal(Defense.create(null, f.succession, f.b, f.office), null);
  const original = copy(f.charter.recognition); f.charter.recognition.personId = 'replacement';
  assert.equal(Defense.meet(...args(f), f.c, f.at), false); f.charter.recognition = original; recognize(f);
  for (const change of [r => r.personId = 'replacement', r => r.role = 'civilWatch', r => r.recorderId = 'new-clerk', r => r.bodyEpoch++,
    r => r.basis.reviewId = 'false', r => r.terms.personId = 'false']) {
    const receipt = copy(f.s.receipt); change(f.s.receipt); assert.equal(Defense.authorization(...args(f), f.c), null); f.s.receipt = receipt;
  }
  f.c.defenseInstitutionId = 'replacement'; assert.equal(Defense.authorization(...args(f), f.c), null);
});
test('stable refusals cannot reroll on unchanged facts or after reload', () => {
  for (const reason of ['policy', 'conditions', 'violence']) {
    const f = fixture('madcap', reason === 'violence' ? [{ id: 'received:attack', at: 1, kind: 'attackOutsideTraining', targetId: 'defense:a:ward-defender' }] : []);
    if (reason === 'policy') f.actor.defensePolicy = 'declineCoercedContinuation';
    if (reason === 'conditions') f.c.defenseConditions = ['Actually received incompatible religious duty'];
    assert.ok(Defense.meet(...args(f), f.c, f.at)); tick(f, 60); const response = copy(f.s.response);
    assert.equal(response.decision, 'refused'); assert.match(response.reason, /not criminal guilt/);
    f.s = Defense.normalize(f.s); assert.equal(Defense.meet(...args(f), f.c, f.at), false); assert.deepEqual(f.s.response, response);
  }
});
test('finite original staffing and usable physical attendance are mandatory', () => {
  for (const change of [f => f.c.local = false, f => f.c.capable = false, f => f.c.cityId = 'other', f => f.c.bodyEpoch++,
    f => f.c.presentIds = [], f => f.c.atCounter = false, f => f.c.clerkPresent = false, f => f.c.lineOfSight = false,
    f => f.c.busy = true, f => f.c.activeViolence = true, f => f.c.defenseAvailable = false, f => f.office.channelPowered = false,
    f => f.office.maintenanceReady = false, f => f.office.power = 0, f => f.office.workSeconds = 59, f => f.actor.workSeconds = 59,
    f => f.actor.assignment = 'existing-wall-duty', f => f.office.clerk.assignment = 'other-job']) {
    const f = fixture(); change(f); assert.equal(Defense.meet(...args(f), f.c, f.at), false);
  }
});
test('partial attendance survives reload and outages without backfill; exact terms expire without refund', () => {
  const f = fixture(), power = f.office.power, work = f.office.workSeconds;
  assert.ok(Defense.meet(...args(f), f.c, f.at)); tick(f, 20); f.s = Defense.normalize(f.s);
  f.office.channelPowered = false; tick(f, 400); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; tick(f, 400); assert.equal(f.s.job.progress, 20); tick(f, 40);
  assert.equal(f.office.workSeconds, work - 60); assert.equal(f.office.power, power - 1);
  assert.equal(Defense.sign(...args(f), { ...f.s.terms, role: 'army' }, f.c, f.at), false);
  assert.ok(Defense.sign(...args(f), copy(f.s.terms), f.c, f.at)); tick(f, 20);
  tick(f, 3600); assert.equal(f.s.job, null); assert.equal(f.s.receipt, null);
  assert.equal(f.office.workSeconds, work - 80); assert.equal(f.office.power, power - 2);
  assert.equal(Defense.meet(...args(f), f.c, f.at), false);
});
test('changed evidence and body cancel unfinished attendance and preserve costs', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.rule.text += ' amended']) {
    const f = fixture(); assert.ok(Defense.meet(...args(f), f.c, f.at)); tick(f, 20); change(f); tick(f, 500);
    assert.equal(f.s.job, null); assert.equal(f.s.receipt, null); assert.equal(f.actor.assignment, null);
  }
});
test('order rejects widened instructions, exhausted reserves, unavailable geometry and suppressors', () => {
  const f = fixture(); recognize(f); const terms = Defense.instructionTerms(f.s);
  assert.equal(Defense.order(...args(f), { ...terms, seconds: 999 }, f.c, f.at), false);
  for (const change of [f => f.c.geometryAvailable = false, f => f.c.postReachable = false, f => f.c.defenderSuppressed = true,
    f => f.actor.wardMana = 23, f => f.actor.stamina = 11, f => f.actor.workSeconds = 209]) {
    const g = fixture(); recognize(g); change(g); assert.equal(Defense.order(...args(g), Defense.instructionTerms(g.s), g.c, g.at), false);
  }
});
test('actual walking spends stamina and duty, cover spends existing mana and residual damage remains', () => {
  const f = fixture(), mana = f.actor.wardMana, stamina = f.actor.stamina, work = f.actor.workSeconds;
  cover(f); assert.equal(f.actor.stamina, stamina - 1); assert.equal(f.actor.workSeconds, work - 151);
  assert.deepEqual(hit(f), { damage: 8, absorbed: 12 }); assert.equal(f.actor.wardMana, mana - 24);
  tick(f, 20); const partial = copy(f.s.duty); f.s = Defense.normalize(f.s);
  assert.deepEqual(f.s.duty, partial); assert.deepEqual(hit(f, 6), { damage: 0, absorbed: 6 });
  tick(f, 100); for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.equal(f.s.completions.length, 1); assert.equal(f.s.completions[0].seconds, 120);
  assert.equal(f.s.completions[0].absorbed, 18); assert.equal(f.actor.stamina, stamina - 2);
  assert.deepEqual(f.actor.mapCell, { x: 19, y: 9, z: 6 }); assert.equal(f.actor.wardMana, mana - 36);
  assert.equal(Defense.order(...args(f), Defense.instructionTerms(f.s), f.c, f.at), false); tick(f, 500);
  assert.equal(f.s.completions.length, 1);
});
test('range, line of effect, soul damage, wrong city/body, suppression and expiry cannot absorb', () => {
  for (const change of [f => f.c.coverDistanceM = 3, f => f.c.coverVisible = false, f => f.c.cityId = 'other',
    f => f.c.local = false, f => f.c.bodyEpoch++, f => f.c.defenderSuppressed = true, f => f.actor.health = 49,
    f => f.at += 120]) {
    const f = fixture(); cover(f); change(f); const mana = f.actor.wardMana;
    assert.deepEqual(hit(f), { damage: 20, absorbed: 0 }); assert.equal(f.actor.wardMana, mana);
  }
  const f = fixture(); cover(f); assert.deepEqual(hit(f, 20, ['physical', 'soul']), { damage: 20, absorbed: 0 });
  assert.deepEqual(hit(f, 20, ['arcane']), { damage: 20, absorbed: 0 });
});
test('exhausted mana and witnessed aggression end cover, with safe physical return independent of counter power', () => {
  for (const kind of ['exhaustion', 'aggression']) {
    const f = fixture(); cover(f);
    assert.equal(Defense.aggression(f.s, false, true, f.at), false); assert.equal(Defense.aggression(f.s, true, false, f.at), false);
    if (kind === 'exhaustion') { f.actor.wardMana = 5; assert.deepEqual(hit(f, 10), { damage: 8, absorbed: 2 }); assert.equal(f.actor.wardMana, 1); }
    else assert.ok(Defense.aggression(f.s, true, true, f.at));
    assert.equal(f.s.duty.status, 'returning'); const receipt = copy(f.s.receipt);
    f.office.channelPowered = false; f.office.maintenanceReady = false; f.c.bodyEpoch++;
    for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
    assert.equal(f.s.duty, null); assert.equal(f.s.completions[0].status, 'interruptedReturn'); assert.deepEqual(f.s.receipt, receipt);
  }
});
test('blocked movement does not teleport or backfill; death freezes reservations and state', () => {
  const f = fixture(); recognize(f); assert.ok(Defense.order(...args(f), Defense.instructionTerms(f.s), f.c, f.at)); tick(f, 30);
  const cell = copy(f.actor.mapCell), work = f.actor.workSeconds; tick(f, 500, { move: () => false });
  assert.deepEqual(f.actor.mapCell, cell); assert.equal(f.actor.workSeconds, work); assert.equal(f.s.duty.progress, 0);
  f.c.alive = false; const frozen = copy({ s: f.s, actor: f.actor }); tick(f, 500);
  assert.deepEqual({ s: f.s, actor: f.actor }, frozen);
});
test('current independent reconsideration and separate records reaffirmation support a NEW defender decision without public-works/watch renewal', () => {
  const f = fixture(), ca = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  f.c.rule.text = 'Actually received amended confirmation requirement.';
  assert.equal(Defense.meet(...args(f), f.c, f.at), false);
  assert.ok(Charter.reconsider(...ca, f.c, f.at)); f.at = f.charter.reconsideration.readyAt;
  assert.ok(Charter.hearReconsideration(...ca, f.c, f.at)); f.at += 180; Charter.advance(...ca, f.c, f.at);
  assert.equal(Defense.meet(...args(f), f.c, f.at), false);
  assert.ok(Charter.reaffirmMeeting(...ca, f.c, f.at)); f.at += 60; Charter.advance(...ca, f.c, f.at);
  assert.ok(Charter.reaffirmSign(...ca, copy(f.charter.reaffirmation.terms), f.c, f.at)); f.at += 60; Charter.advance(...ca, f.c, f.at);
  assert.equal(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c), false);
  recognize(f); assert.equal(f.s.receipt.basis.receiptId, f.charter.reaffirmation.receipt.id);
  assert.equal(f.s.receipt.basis.reviewId, f.charter.reconsideration.id);
  assert.ok(Defense.authorization(...args(f), f.c)); assert.equal(f.succession.handover, null);
});
test('stale findings stop new instructions and protection without erasing signatures or accepted return', () => {
  const f = fixture(); cover(f); const receipt = copy(f.s.receipt), cell = copy(f.actor.mapCell);
  f.c.rule.text += ' genuinely amended'; assert.equal(Defense.authorization(...args(f), f.c), null);
  tick(f); assert.equal(f.s.duty.status, 'returning'); assert.deepEqual(f.s.receipt, receipt);
  for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
  assert.notDeepEqual(f.actor.mapCell, cell); assert.equal(f.s.completions[0].status, 'interruptedReturn');
  assert.deepEqual(f.s.receipt, receipt);
});
test('suppression interrupts real cover but does not prevent walking home', () => {
  const f = fixture(); cover(f); f.c.defenderSuppressed = true; tick(f);
  assert.equal(f.s.duty.status, 'returning'); for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.equal(f.s.completions[0].status, 'interruptedReturn');
});
function voluntaryFixture(theme = 'madcap') {
  const office = { id: 'counter:a', cityId: 'a', institutionId: 'institution:centralAdministration', active: true, channelPowered: true,
    clerk: { status: 'alive', health: 100, fatigue: 0 }, power: 12, workSeconds: 1500, availableAt: 0, assignment: null };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Existing Ruler', kind: 'individual' },
    succession: Succession.CHARTERS[0], administrationId: office.institutionId, defenseId: 'institution:militaryDefenseCommand', defenseName: 'Existing defense',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a', latitude: 0, longitude: 0 }] },
    institutions: [...Succession.ROLES, 'militaryDefenseCommand'].map(role => ({ role, id: `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme });
  const s = Succession.create(source, b, office, { theme });
  s.ruler.retirementPolicy = 'considerAdministrativeRetirement';
  const challenge = { terms: { bodyEpoch: 0 }, receipt: { id: 'concession:a', outcome: 'defenderConceded', bodyEpoch: 0,
    defenderId: b.defender.id, witnessId: b.representative.id, charterId: source.charterId, authorityId: source.authority.id },
    petition: { id: 'petition:a', status: 'filedNotAccepted', authorityId: source.authority.id, receiptId: 'concession:a' } };
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    cityId: 'a', authorityId: source.authority.id, bodyEpoch: 0, charterCurrent: true, administrationAvailable: true, defenseAvailable: true,
    institutionsAvailable: true, participantsPresent: true, leadersPresent: true, serviceIds: ['batch:a', 'batch:b', 'batch:c'], oppositionReports: [] };
  return { office, source, b, s, challenge, c, at: 0 };
}
function voluntaryStep(f, seconds, effects = {}) { f.at += seconds; return Succession.advance(f.s, f.b, f.office, f.c, f.at, { move, ...effects }); }
function voluntaryHearing(f) {
  assert.equal(Succession.request(f.s, f.b, f.office, f.challenge, f.c, f.at), true);
  for (let i = 0; i < 30 && f.s.phase === 'approaching'; i++) voluntaryStep(f, 1);
  assert.equal(f.s.phase, 'ready'); assert.equal(Succession.hear(f.s, f.b, f.office, f.c, f.at), true); voluntaryStep(f, 180);
}
function voluntarySigned(f) { voluntaryHearing(f); assert.equal(f.s.phase, 'offered'); assert.equal(Succession.sign(f.s, f.b, f.office, copy(f.s.terms), f.c, f.at), true); }
const stack = (id, quantity, extra = {}) => ({ id, key: 'metalParts', quantity, knownQuantity: quantity, carriedBy: 'scientist', ...extra });
function voluntaryProvisioned(f) { voluntarySigned(f); assert.equal(Succession.deliver(f.s, f.b, f.office, [stack('carried:a', 18)], f.c, f.at), true); }
function voluntaryTransferred(f) {
  voluntaryProvisioned(f);
  for (const actor of [...f.s.leaders, f.b.defender]) { assert.equal(Succession.agree(f.s, f.b, f.office, actor.id, f.c, f.at), true); voluntaryStep(f, 60); }
  assert.equal(Succession.handover(f.s, f.b, f.office, f.c, f.at), true); voluntaryStep(f, 180);
  assert.equal(f.s.phase, 'transferred'); f.c.authorityId = 'scientist';
}
test('actual voluntary handover reuses original defender continuation without another retirement, reserve, or coercion', () => {
  const v = voluntaryFixture(); voluntaryTransferred(v);
  Object.assign(v.office.clerk, { id: 'original-voluntary-clerk', locationId: v.office.id });
  require('../defender-challenges').prepareDefender(v.b);
  Object.assign(v.c, { local: true, defenseInstitutionId: v.b.source.defenseId, presentIds: [v.b.defender.id], defenseConditions: [] });
  const original = copy({ handover: v.s.handover, agreements: v.s.agreements, reserve: v.s.provision, defender: v.b.defender });
  const f = { s: Defense.create(null, v.s, v.b, v.office), charter: null, succession: v.s, abdication: null,
    b: v.b, office: v.office, c: v.c, at: v.at, actor: v.b.defender };
  f.actor.defensePolicy = 'declineCoercedContinuation'; recognize(f);
  assert.equal(f.s.receipt.origin, 'voluntary'); assert.equal(f.s.receipt.basis.receiptId, original.handover.id);
  assert.deepEqual(v.s.handover, original.handover); assert.deepEqual(v.s.agreements, original.agreements);
  assert.deepEqual(v.s.provision, original.reserve); assert.equal(v.b.defender.wardMana, original.defender.wardMana);
  const agreement = v.s.agreements.find(a => a.personId === v.b.defender.id);
  agreement.suspendedRoles = ['civilWatch']; assert.ok(Defense.authorization(...args(f), f.c));
  // Changed exact defender continuation invalidates this bound agreement; another role's refusal does not create it.
  delete agreement.suspendedRoles;
  agreement.suspendedRoles = [Defense.ROLE]; assert.equal(Defense.authorization(...args(f), f.c), null);
});

test('lost defense availability stops protection but cannot confiscate accepted physical return', () => {
  const f = fixture(); cover(f); f.c.defenseAvailable = false; tick(f);
  assert.equal(f.s.duty.status, 'returning'); for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.deepEqual(f.actor.mapCell, { x: 19, y: 9, z: 6 });
});
test('zero duty cannot sustain a free projection or fund a return step', () => {
  const f = fixture(); cover(f); f.actor.workSeconds = 0; tick(f);
  assert.equal(f.s.duty.status, 'returning'); const cell = copy(f.actor.mapCell), mana = f.actor.wardMana;
  assert.deepEqual(hit(f), { damage: 20, absorbed: 0 }); tick(f, 500);
  assert.deepEqual(f.actor.mapCell, cell); assert.equal(f.actor.wardMana, mana);
});
test('an unavailable cover position cannot backfill work or extend the two-minute window', () => {
  const f = fixture(); cover(f); tick(f, 10); const work = f.actor.workSeconds;
  f.c.geometryAvailable = false; tick(f, 500);
  assert.equal(f.s.duty.progress, 10); assert.equal(f.actor.workSeconds, work); assert.equal(f.s.duty.status, 'returning');
  f.c.geometryAvailable = true; tick(f); for (let n = 0; n < 10 && f.s.duty; n++) tick(f);
  assert.equal(f.s.duty, null); assert.equal(f.s.completions[0].status, 'interruptedReturn');
});
test('public projection excludes private policy, received evidence, duty budget and reserves', () => {
  const f = fixture(); cover(f); const v = Defense.publicView(f.s), raw = JSON.stringify(v);
  assert.equal(v.receipt.basis.evidence, undefined); assert.equal(v.response.facts, undefined); assert.equal(v.duty.homeCell, undefined);
  for (const privateKey of ['wardMana', 'stamina', 'workSeconds', 'defensePolicy', 'authorizationIds']) assert.equal(raw.includes('"' + privateKey + '":'), false);
});
