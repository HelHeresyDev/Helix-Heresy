const { test } = require('node:test');
const assert = require('node:assert/strict');
const Recognition = require('../charter-recognition');
const Resistance = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Institutions = require('../home-institution-context');
const Governments = require('../strategic-city-governments');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    clerk: { id: 'clerk:a', locationId: 'office:a', status: 'alive', health: 100 }, power: 12, workSeconds: 14400, assignment: null, records: [] };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Explicit local rule.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Resistance.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const c = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: [],
    presentIds: succession.leaders.map(a => a.id) };
  Resistance.demand(abdication, succession, c, 0); Resistance.accept(abdication, succession, office, copy(abdication.terms), c, 0);
  Resistance.advance(abdication, succession, office, c, 60);
  assert.ok(abdication.receipt);
  const s = Recognition.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Recognition.admin(s, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  return { s, succession, b, abdication, office, c, institutions, at: 60, source };
}
function invoke(f, action, ...extra) { return Recognition[action](f.s, f.succession, f.abdication, f.office, f.institutions, ...extra, f.c, f.at); }
function step(f, seconds) { f.at += seconds; return Recognition.advance(f.s, f.succession, f.abdication, f.office, f.institutions, f.c, f.at); }
function reviewed(f) {
  assert.equal(invoke(f, 'file'), true); f.at = f.s.review.readyAt;
  assert.equal(invoke(f, 'hear'), true); step(f, 180); assert.equal(f.s.review.status, 'completed');
}
function offered(f) { reviewed(f); assert.equal(f.s.review.finding.outcome, 'eligible'); assert.equal(invoke(f, 'meeting'), true); step(f, 60); assert.equal(f.s.phase, 'offered'); }
function recognized(f) { offered(f); assert.equal(invoke(f, 'sign', copy(f.s.terms)), true); step(f, 60); assert.equal(f.s.phase, 'recognized'); }
test('explicit generated charter rules are deterministic, published, local and absent for unsupported succession or collectives', () => {
  const laws = Array.from({ length: 40 }, (_, i) => Governments.designationReviewRule('law-seed', `city:${i}`, Succession.CHARTERS[i % 2], 'individual', 'original-review'));
  assert.deepEqual(laws, Array.from({ length: 40 }, (_, i) => Governments.designationReviewRule('law-seed', `city:${i}`, Succession.CHARTERS[i % 2], 'individual', 'original-review')));
  assert.deepEqual(new Set(laws.map(r => r.coercionRule)), new Set(['independentConfirmationPermitted', 'uncoercedDesignationRequired']));
  assert.ok(laws.every(r => r.reviewInstitutionId === 'original-review' && r.requiredAuthorizationIds.length === 0));
  assert.equal(Governments.designationReviewRule('seed', 'city:a', 'inheritance', 'individual', 'review'), null);
  assert.equal(Governments.designationReviewRule('seed', 'city:a', Succession.CHARTERS[0], 'collective', 'review'), null);
});
test('every theme reuses actual claim, original people and rights, never world ownership or free replacements', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), original = copy(f.source), people = Succession.people(f.succession, f.b).map(a => a.id);
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.claim.origin, 'coerced');
    assert.equal(f.s.clerkId, f.office.clerk.id); assert.deepEqual(f.source, original);
    recognized(f); assert.deepEqual(Succession.people(f.succession, f.b).map(a => a.id), people);
    assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null); assert.deepEqual(f.succession.agreements, []);
    assert.deepEqual(f.source, original); assert.equal(f.s.recognition.role, 'centralAdministration');
    assert.match(f.s.recognition.terms.retainedRights, /property and faith/);
  }
});
test('an authentic original receipt, original recorder and independent institution are required, not a label or appointment flag', () => {
  const f = fixture(); assert.equal(Recognition.create(f.succession, null, f.office), null);
  const falseClaim = copy(f.abdication); falseClaim.receipt.recorderId = 'substitute'; assert.equal(Recognition.create(f.succession, falseClaim, f.office), null);
  const a = Recognition.admin(f.s, f.succession), r = Recognition.reviewer(f.s, f.succession);
  r.institutionId = a.institutionId; f.s.reviewInstitutionId = a.institutionId;
  assert.equal(Recognition.independent(f.s, f.succession), false); assert.equal(invoke(f, 'file'), false);
});
test('filing and hearing require original bodies, attendance, institutions, finite work, actual power and queue readiness', () => {
  for (const change of [f => f.c.alive = false, f => f.c.capable = false, f => f.c.local = false, f => f.c.atCounter = false,
    f => f.c.visitPermission = false, f => f.c.clerkPresent = false, f => f.c.lineOfSight = false, f => f.c.busy = true,
    f => f.c.activeViolence = true, f => f.c.bodyEpoch++, f => f.c.charterCurrent = false, f => f.c.reviewAvailable = false,
    f => f.c.administrationAvailable = false, f => f.office.assignment = 'another duty', f => f.office.clerk.locationId = 'elsewhere',
    f => f.office.workSeconds = 29, f => f.office.channelPowered = false]) {
    const f = fixture(); change(f); assert.equal(invoke(f, 'file'), false); assert.equal(f.s.review, null);
  }
  const f = fixture(), original = f.office.workSeconds; assert.equal(invoke(f, 'file'), true);
  assert.equal(f.office.workSeconds, original - 30); const allocation = copy(f.institutions);
  assert.equal(invoke(f, 'file'), false); assert.deepEqual(f.institutions, allocation); assert.equal(invoke(f, 'hear'), false);
  f.at = f.s.review.readyAt; f.c.presentIds = []; assert.equal(invoke(f, 'hear'), false);
  f.c.presentIds = f.succession.leaders.map(a => a.id); f.office.power = 0; assert.equal(invoke(f, 'hear'), false);
  f.office.power = 5; Recognition.reviewer(f.s, f.succession).workSeconds = 179; assert.equal(invoke(f, 'hear'), false);
});
test('coercion may be eligible, charter-refused or unresolved; no missing law, unknown procedure or divine approval is fabricated', () => {
  for (const [rule, expected] of [[null, 'unresolved'], [{ coercionRule: 'uncoercedDesignationRequired' }, 'ineligible'],
    [{ coercionRule: 'unknown' }, 'unresolved'], [{ requiredAuthorizationIds: ['actual-patron-authorization'] }, 'unresolved'],
    [{ principle: 'inheritance' }, 'unresolved'], [{ reviewInstitutionId: 'another reviewer' }, 'unresolved']]) {
    const f = fixture(); f.c.rule = rule == null ? null : { ...f.c.rule, ...rule }; reviewed(f);
    assert.equal(f.s.review.finding.outcome, expected); assert.equal(invoke(f, 'meeting'), false); assert.equal(f.s.recognition, null);
    const finding = copy(f.s.review.finding); f.s = Recognition.normalize(f.s);
    assert.equal(invoke(f, 'file'), false); assert.deepEqual(f.s.review.finding, finding);
  }
});
test('genuinely new law or authenticated evidence permits a new queued review, but never rewrites an old decision or queue', () => {
  const f = fixture(); f.c.rule = null; reviewed(f); const old = copy(f.s.review), allocations = copy(f.institutions.offices['review:a'].jobs);
  f.c.rule = copy(f.source.designationReview); assert.equal(invoke(f, 'file'), true);
  assert.deepEqual(f.s.previousReviews[0], old); assert.ok(f.s.review.readyAt > old.readyAt);
  assert.deepEqual(f.institutions.offices['review:a'].jobs[old.id], allocations[old.id]);
  const queued = fixture(); queued.c.rule = null; assert.equal(invoke(queued, 'file'), true);
  queued.c.rule = copy(queued.source.designationReview); assert.equal(invoke(queued, 'file'), true);
  assert.equal(queued.s.previousReviews.length, 1);
});
test('finite single clerk budget and original reviewer work survive partial reload and outages with no backfill', () => {
  const f = fixture(); invoke(f, 'file'); f.at = f.s.review.readyAt; invoke(f, 'hear'); const officeWork = f.office.workSeconds;
  step(f, 60); assert.equal(f.s.job.progress, 60); assert.equal(f.office.workSeconds, officeWork - 60);
  assert.equal(Recognition.reviewer(f.s, f.succession).workSeconds, 1740);
  f.s = Recognition.normalize(f.s); f.succession = Succession.normalize(f.succession); f.office.channelPowered = false;
  step(f, 1000); assert.equal(f.s.job.progress, 60); f.office.channelPowered = true; step(f, 500);
  assert.equal(f.s.job.progress, 60); step(f, 120); assert.equal(f.s.review.finding.outcome, 'eligible');
  assert.equal(f.office.workSeconds, officeWork - 180); assert.equal(f.office.clerk.workSeconds, undefined);
});
test('eligible review does not compel the original administrator, and a stable personal refusal cannot reroll', () => {
  const f = fixture(); Recognition.admin(f.s, f.succession).recognitionPolicy = 'declineCoercedAppointment'; reviewed(f);
  assert.equal(invoke(f, 'meeting'), true); step(f, 60); assert.equal(f.s.response.decision, 'refused');
  assert.equal(f.s.recognition, null); assert.equal(f.s.terms, null); f.s = Recognition.normalize(f.s);
  assert.equal(invoke(f, 'meeting'), false); assert.equal(invoke(f, 'file'), false);
  const violence = fixture(); violence.c.conduct = [{ id: 'actual-witness', at: 61, kind: 'attackOutsideTraining', witnessId: 'witness', targetId: 'defender' }];
  reviewed(violence); invoke(violence, 'meeting'); step(violence, 60); assert.equal(violence.s.response.decision, 'refused');
  assert.match(violence.s.response.reason, /not conviction/);
});
test('exact unexpired continuation and actual original official are required for one scoped recognition receipt', () => {
  const f = fixture(); offered(f); const original = copy(f.abdication.receipt);
  assert.equal(invoke(f, 'sign', { ...f.s.terms, role: 'militaryDefenseCommand' }), false);
  f.c.presentIds = []; assert.equal(invoke(f, 'sign', copy(f.s.terms)), false);
  f.c.presentIds = f.succession.leaders.map(a => a.id); assert.equal(invoke(f, 'sign', copy(f.s.terms)), true);
  step(f, 60); const receipt = copy(f.s.recognition); assert.equal(receipt.origin, 'coerced');
  assert.equal(receipt.commandRelationship.personId, f.s.administratorId); assert.equal(receipt.role, 'centralAdministration');
  assert.deepEqual(f.abdication.receipt, original); assert.equal(invoke(f, 'sign', copy(f.s.terms)), false);
  step(f, 500); assert.deepEqual(f.s.recognition, receipt);
  const expired = fixture(); offered(expired); step(expired, 3600); assert.equal(invoke(expired, 'sign', copy(expired.s.terms)), false);
  assert.equal(invoke(expired, 'meeting'), false); assert.equal(expired.s.recognition, null);
});
test('one bounded instruction actually writes the original register with finite work and no new stock, maps or other commands', () => {
  const f = fixture(); recognized(f); const work = f.office.workSeconds, officialWork = Recognition.admin(f.s, f.succession).workSeconds;
  const terms = Recognition.instructionTerms(f.s); assert.equal(invoke(f, 'instruct', { ...terms, role: 'militaryDefenseCommand' }), false);
  assert.equal(invoke(f, 'instruct', terms), true); step(f, 30); assert.equal(f.office.successionMemoranda, undefined);
  f.s = Recognition.normalize(f.s); step(f, 30);
  assert.equal(f.office.successionMemoranda.length, 1); assert.equal(f.office.successionMemoranda[0].contents.origin, 'coerced');
  assert.deepEqual(f.office.records, []); // Never masquerades as an identity document.
  assert.equal(f.office.workSeconds, work - 60); assert.equal(Recognition.admin(f.s, f.succession).workSeconds, officialWork - 60);
  assert.equal(f.s.instruction.recordId, f.office.successionMemoranda[0].id); assert.equal(invoke(f, 'instruct', terms), false);
  assert.equal(f.succession.provision.stock, 0); assert.equal(f.succession.control, null); assert.equal(f.b.copies.length, 0);
  assert.doesNotMatch(JSON.stringify(Recognition.publicView(f.s)), /recognitionPolicy|workSeconds|presentIds|"mapCell"/);
});
test('unavailable originals and changed law stop new execution without erasing received recognition or refunding resources', () => {
  const f = fixture(); recognized(f); const receipt = copy(f.s.recognition), power = f.office.power;
  assert.equal(invoke(f, 'instruct', Recognition.instructionTerms(f.s)), true); step(f, 20);
  Recognition.admin(f.s, f.succession).status = 'dead'; step(f, 60); assert.equal(f.s.instruction, null); assert.equal(f.s.job.progress, 20);
  assert.equal(Recognition.operative(f.s, f.succession, f.abdication, f.office, f.c), false);
  assert.deepEqual(f.s.recognition, receipt); assert.equal(f.office.power, power - 1);
  const rule = fixture(); recognized(rule); rule.c.rule.coercionRule = 'uncoercedDesignationRequired';
  assert.equal(invoke(rule, 'instruct', Recognition.instructionTerms(rule.s)), false); assert.ok(rule.s.recognition);
});
test('body change cancels original reservations, lost attendance pauses, cancellation spends resources, and death freezes', () => {
  const f = fixture(); invoke(f, 'file'); f.at = f.s.review.readyAt; invoke(f, 'hear'); step(f, 20); f.c.bodyEpoch++;
  step(f, 60); assert.equal(f.s.job, null); assert.equal(f.office.assignment, null); assert.equal(f.s.review.finding, null);
  const absence = fixture(); invoke(absence, 'file'); absence.at = absence.s.review.readyAt; invoke(absence, 'hear'); step(absence, 20);
  absence.c.clerkPresent = false; step(absence, 500); assert.equal(absence.s.job.progress, 20);
  const work = absence.office.workSeconds; Recognition.cancel(absence.s, absence.succession, absence.office, absence.at);
  assert.equal(absence.office.workSeconds, work); assert.equal(absence.s.review.status, 'queued');
  const dead = fixture(); invoke(dead, 'file'); dead.at = dead.s.review.readyAt; invoke(dead, 'hear'); dead.c.alive = false;
  const saved = copy(dead.s); step(dead, 500); assert.deepEqual(dead.s, saved);
});
