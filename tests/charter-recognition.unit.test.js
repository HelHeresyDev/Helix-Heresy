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

function newReceivedReport(f, id = 'received-watch-report') {
  f.c.conduct.push({ id, at: f.at, kind: 'attackAtCounter', targetId: f.succession.ruler.id, witnessId: 'original-watch' });
}
function reconsidered(f) {
  assert.equal(invoke(f, 'reconsider'), true); f.at = f.s.reconsideration.readyAt;
  assert.equal(invoke(f, 'hearReconsideration'), true); step(f, 180);
}
test('post-recognition reconsideration preserves original records in every theme and never renews assent or commands', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme); recognized(f);
    const review = copy(f.s.review), receipt = copy(f.s.recognition), response = copy(f.s.response), terms = copy(f.s.terms),
      claim = copy(f.abdication.receipt), source = copy(f.source), people = Succession.people(f.succession, f.b).map(a => a.id);
    assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), true);
    newReceivedReport(f); assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    reconsidered(f);
    assert.equal(f.s.reconsideration.finding.outcome, 'eligible');
    assert.equal(f.s.reconsideration.finding.recognitionId, receipt.id);
    assert.equal(f.s.reconsideration.originalReviewId, review.id);
    assert.deepEqual(f.s.review, review); assert.deepEqual(f.s.recognition, receipt); assert.deepEqual(f.s.response, response);
    assert.deepEqual(f.s.terms, terms); assert.deepEqual(f.abdication.receipt, claim); assert.deepEqual(f.source, source);
    assert.deepEqual(Succession.people(f.succession, f.b).map(a => a.id), people);
    assert.equal(invoke(f, 'file'), false); assert.equal(invoke(f, 'meeting'), false); assert.equal(invoke(f, 'sign', terms), false);
    assert.equal(invoke(f, 'instruct', Recognition.instructionTerms(f.s)), false);
    assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.deepEqual(f.succession.agreements, []);
    assert.equal(f.succession.provision.stock, 0); assert.equal(f.office.successionMemoranda, undefined);
    assert.equal(Recognition.publicView(f.s, f.c).personalReaffirmationRequired, true);
  }
});
test('reconsideration requires genuinely changed received grounds and cannot reroll, invent consent or erase reports', () => {
  const f = fixture(); assert.equal(invoke(f, 'reconsider'), false); recognized(f);
  assert.equal(invoke(f, 'reconsider'), false); newReceivedReport(f); assert.equal(invoke(f, 'reconsider'), true);
  const queue = copy(f.institutions), work = f.office.workSeconds, queued = copy(f.s.reconsideration);
  f.s = Recognition.normalize(f.s); assert.equal(invoke(f, 'reconsider'), false);
  assert.deepEqual(f.institutions, queue); assert.equal(f.office.workSeconds, work);
  f.c.conduct = []; assert.equal(invoke(f, 'reconsider'), false); assert.deepEqual(f.s.reconsideration, queued);
  // Even if a source reverts, the filed review cannot restore old assent.
  assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
  f.c.conduct = copy(queued.evidence.conduct); f.at = f.s.reconsideration.readyAt;
  assert.equal(invoke(f, 'hearReconsideration'), true); step(f, 180); f.s = Recognition.normalize(f.s);
  assert.equal(invoke(f, 'reconsider'), false); assert.equal(invoke(f, 'hearReconsideration'), false);
  assert.deepEqual(f.institutions, queue);
});
test('reconsideration binds the actual signed claim, original institutions, reviewer, clerk, body and finite filing work', () => {
  for (const change of [f => f.s.recognition.role = 'militaryDefenseCommand', f => f.s.recognition.personId = 'replacement',
    f => f.s.recognition.terms.duties = 'unlimited obedience', f => f.s.recognition.reviewId = 'fake-review',
    f => f.c.charterCurrent = false, f => f.c.bodyEpoch++, f => f.c.cityId = 'other', f => f.c.local = false,
    f => f.c.atCounter = false, f => f.c.clerkPresent = false, f => f.c.capable = false, f => f.c.lineOfSight = false,
    f => f.c.busy = true, f => f.c.activeViolence = true, f => f.c.reviewAvailable = false,
    f => f.office.workSeconds = 29, f => f.office.channelPowered = false, f => f.office.clerk.id = 'replacement',
    f => Recognition.reviewer(f.s, f.succession).status = 'dead', f => f.succession.handover = { id: 'different-route' },
    f => f.institutions.roles['civic-review'] = 'substitute-review']) {
    const f = fixture(); recognized(f); newReceivedReport(f); change(f);
    const queue = copy(f.institutions), work = f.office.workSeconds;
    assert.equal(invoke(f, 'reconsider'), false); assert.equal(f.s.reconsideration, null);
    assert.deepEqual(f.institutions, queue); assert.equal(f.office.workSeconds, work);
  }
});
test('reconsideration consumes actual independent queue, original reviewer duty and shared clerk power only once', () => {
  const f = fixture(); recognized(f); newReceivedReport(f);
  const originalAllocation = copy(f.institutions.offices['review:a'].jobs[f.s.review.id]), work = f.office.workSeconds,
    reviewerWork = Recognition.reviewer(f.s, f.succession).workSeconds, adminWork = Recognition.admin(f.s, f.succession).workSeconds, power = f.office.power;
  assert.equal(invoke(f, 'reconsider'), true); assert.equal(f.office.workSeconds, work - 30);
  assert.ok(f.s.reconsideration.readyAt > f.s.review.readyAt); assert.equal(invoke(f, 'hearReconsideration'), false);
  f.at = f.s.reconsideration.readyAt; f.c.presentIds = [f.s.administratorId];
  assert.equal(invoke(f, 'hearReconsideration'), false); f.c.presentIds = f.succession.leaders.map(a => a.id);
  f.office.power = 0; assert.equal(invoke(f, 'hearReconsideration'), false); f.office.power = power;
  assert.equal(invoke(f, 'hearReconsideration'), true); step(f, 60);
  f.s = Recognition.normalize(f.s); f.succession = Succession.normalize(f.succession);
  f.office.channelPowered = false; step(f, 1000); assert.equal(f.s.job.progress, 60);
  f.office.channelPowered = true; step(f, 500); assert.equal(f.s.job.progress, 60); step(f, 120);
  assert.equal(f.s.reconsideration.status, 'completed'); assert.equal(f.office.workSeconds, work - 210);
  assert.equal(Recognition.reviewer(f.s, f.succession).workSeconds, reviewerWork - 180);
  assert.equal(Recognition.admin(f.s, f.succession).workSeconds, adminWork); assert.equal(f.office.power, power - 1);
  assert.deepEqual(f.institutions.offices['review:a'].jobs[f.s.review.id], originalAllocation);
  assert.equal(f.office.assignment, null); assert.equal(f.office.clerk.assignment, null);
  assert.equal(Recognition.reviewer(f.s, f.succession).assignment, null);
});
test('changed received facts interrupt a reconsideration snapshot; refiling retains prior evidence, allocation and spent work', () => {
  const f = fixture(); recognized(f); newReceivedReport(f); invoke(f, 'reconsider'); f.at = f.s.reconsideration.readyAt;
  invoke(f, 'hearReconsideration'); step(f, 20); newReceivedReport(f, 'second-witness-report');
  step(f, 500); assert.equal(f.s.job.progress, 20); assert.equal(f.s.reconsideration.finding, null);
  assert.equal(invoke(f, 'reconsider'), false); const queue = copy(f.institutions), work = f.office.workSeconds;
  assert.equal(Recognition.cancel(f.s, f.succession, f.office, f.at), true);
  const previous = copy(f.s.reconsideration); assert.equal(invoke(f, 'reconsider'), true);
  assert.deepEqual(f.s.previousReconsiderations, [previous]); assert.equal(f.office.workSeconds, work - 30);
  assert.deepEqual(f.institutions.offices['review:a'].jobs[previous.id], queue.offices['review:a'].jobs[previous.id]);
  f.at = f.s.reconsideration.readyAt; invoke(f, 'hearReconsideration'); step(f, 180);
  assert.equal(f.s.reconsideration.evidence.conduct.length, 2); assert.equal(f.s.reconsideration.finding.outcome, 'eligible');
  assert.equal(Recognition.publicView(f.s, f.c).previousReconsiderations[0].status, 'queued');
});
test('reconsidered ineligible and unresolved requirements remain distinct, with no fabricated patron authorization', () => {
  for (const [change, outcome] of [[f => f.c.rule.coercionRule = 'uncoercedDesignationRequired', 'ineligible'],
    [f => f.c.rule.requiredAuthorizationIds = ['actual-patron'], 'unresolved'], [f => f.c.rule = null, 'unresolved']]) {
    const f = fixture(); recognized(f); const receipt = copy(f.s.recognition); change(f); reconsidered(f);
    assert.equal(f.s.reconsideration.finding.outcome, outcome); assert.deepEqual(f.s.recognition, receipt);
    assert.equal(invoke(f, 'reconsider'), false); assert.equal(Recognition.operative(f.s, f.succession, f.abdication, f.office, f.c), false);
    if (outcome === 'unresolved' && f.c.rule) {
      f.c.authorizationIds = ['actual-patron']; reconsidered(f); assert.equal(f.s.reconsideration.finding.outcome, 'eligible');
      assert.equal(f.s.previousReconsiderations[0].finding.outcome, 'unresolved');
      assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    }
  }
});
test('reconsideration attendance loss pauses, body change cancels original reservations and death freezes history', () => {
  for (const change of [f => f.c.clerkPresent = false, f => f.c.presentIds = [],
    f => Recognition.reviewer(f.s, f.succession).health = 49, f => f.office.workSeconds = 0]) {
    const f = fixture(); recognized(f); newReceivedReport(f); invoke(f, 'reconsider'); f.at = f.s.reconsideration.readyAt;
    invoke(f, 'hearReconsideration'); step(f, 20); change(f); step(f, 500);
    assert.equal(f.s.job.progress, 20); assert.equal(f.s.reconsideration.finding, null);
  }
  const body = fixture(); recognized(body); newReceivedReport(body); invoke(body, 'reconsider'); body.at = body.s.reconsideration.readyAt;
  invoke(body, 'hearReconsideration'); step(body, 20); body.c.bodyEpoch++; step(body, 60);
  assert.equal(body.s.job, null); assert.equal(body.office.assignment, null); assert.equal(body.s.reconsideration.finding, null);
  assert.equal(invoke(body, 'hearReconsideration'), false);
  const dead = fixture(); recognized(dead); newReceivedReport(dead); invoke(dead, 'reconsider'); dead.at = dead.s.reconsideration.readyAt;
  invoke(dead, 'hearReconsideration'); dead.c.alive = false; const saved = copy(dead.s); step(dead, 500); assert.deepEqual(dead.s, saved);
});
test('public reconsideration records expose dated grounds and outcome, not private snapshots, policies or reserve totals', () => {
  const f = fixture(); recognized(f); newReceivedReport(f); reconsidered(f);
  const view = Recognition.publicView(f.s, f.c);
  assert.equal(view.originalFindingCurrent, false); assert.equal(view.reconsideration.current, true);
  assert.deepEqual(view.reconsideration.grounds, ['Changed actually received witnessed conduct evidence']);
  assert.match(view.reconsiderationLimitations, /No renewed personal assent/);
  assert.doesNotMatch(JSON.stringify(view), /"evidence"|"conduct"|recognitionPolicy|workSeconds|wardMana|mapCell/);
  newReceivedReport(f, 'later-report'); assert.equal(Recognition.publicView(f.s, f.c).reconsideration.current, false);
});

function freshEligible(f) {
  // A real received non-attack record changes the snapshot without forgiving
  // violence or rewriting the published confirmation rule.
  f.c.conduct.push({ id: `received-nonviolent-record:${f.at}`, at: f.at, kind: 'receivedAdministrativeNotice',
    targetId: f.s.administratorId, witnessId: f.office.clerk.id }); reconsidered(f);
}
function reaffirmOffered(f) {
  assert.equal(invoke(f, 'reaffirmMeeting'), true); step(f, 60); assert.equal(f.s.reaffirmation.response.decision, 'offered');
}
function reaffirmed(f) {
  reaffirmOffered(f); assert.equal(invoke(f, 'reaffirmSign', copy(f.s.reaffirmation.terms)), true); step(f, 60);
  assert.ok(f.s.reaffirmation.receipt);
}
test('every theme separates new records-only assent from original signatures, institutional authority and once-only memorandum', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme); recognized(f); invoke(f, 'instruct', Recognition.instructionTerms(f.s)); step(f, 60);
    const old = copy({ review: f.s.review, recognition: f.s.recognition, terms: f.s.terms, response: f.s.response,
      instruction: f.s.instruction, records: f.office.records, memorandum: f.office.successionMemoranda[0], claim: f.abdication.receipt,
      people: Succession.people(f.succession, f.b).map(a => a.id), source: f.source });
    freshEligible(f); const work = f.office.workSeconds, power = f.office.power, adminWork = Recognition.admin(f.s, f.succession).workSeconds;
    assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    reaffirmed(f); const receipt = copy(f.s.reaffirmation.receipt);
    assert.equal(receipt.originalRecognitionId, old.recognition.id); assert.equal(receipt.reviewId, f.s.reconsideration.id);
    assert.equal(receipt.commandRelationship.scope, 'One original-register reaffirmation addendum');
    assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), true);
    assert.equal(Recognition.authorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    assert.equal(Recognition.operative(f.s, f.succession, f.abdication, f.office, f.c), true);
    assert.equal(invoke(f, 'instruct', Recognition.instructionTerms(f.s)), false);
    const expected = Recognition.addendumTerms(f.s);
    assert.equal(invoke(f, 'enterAddendum', { ...expected, role: 'militaryDefenseCommand' }), false);
    assert.equal(invoke(f, 'enterAddendum', expected), true); step(f, 30); f.s = Recognition.normalize(f.s); step(f, 30);
    assert.equal(f.office.successionMemoranda.length, 2); assert.deepEqual(f.office.successionMemoranda[0], old.memorandum);
    assert.equal(f.office.successionMemoranda[1].type, 'scopedSuccessionReaffirmationAddendum');
    assert.equal(f.office.successionMemoranda[1].contents.originalMemorandumId, old.instruction.recordId);
    assert.equal(f.office.workSeconds, work - 180); assert.equal(f.office.power, power - 3);
    assert.equal(Recognition.admin(f.s, f.succession).workSeconds, adminWork - 180);
    assert.equal(invoke(f, 'enterAddendum', expected), false); assert.equal(invoke(f, 'reaffirmMeeting'), false);
    assert.equal(invoke(f, 'reaffirmSign', f.s.reaffirmation.terms), false); assert.deepEqual(f.s.reaffirmation.receipt, receipt);
    assert.deepEqual({ review: f.s.review, recognition: f.s.recognition, terms: f.s.terms, response: f.s.response,
      instruction: f.s.instruction, records: f.office.records, memorandum: f.office.successionMemoranda[0], claim: f.abdication.receipt,
      people: Succession.people(f.succession, f.b).map(a => a.id), source: f.source }, old);
    assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null); assert.deepEqual(f.succession.agreements, []);
    assert.equal(f.succession.provision.stock, 0); assert.equal(f.b.copies.length, 0);
  }
});
test('eligible reconsideration cannot forgive renewed violence or compel a stable personal refusal', () => {
  for (const change of [f => newReceivedReport(f), f => Recognition.admin(f.s, f.succession).recognitionPolicy = 'declineCoercedAppointment']) {
    const f = fixture(); recognized(f); change(f); freshEligible(f); const reports = copy(f.c.conduct);
    assert.equal(invoke(f, 'reaffirmMeeting'), true); step(f, 60);
    const response = copy(f.s.reaffirmation.response); assert.equal(response.decision, 'refused');
    assert.equal(f.s.reaffirmation.terms, null); assert.equal(f.s.reaffirmation.receipt, null); assert.deepEqual(f.c.conduct, reports);
    f.s = Recognition.normalize(f.s); step(f, 86400); assert.equal(invoke(f, 'reaffirmMeeting'), false);
    assert.deepEqual(f.s.reaffirmation.response, response); assert.equal(invoke(f, 'reaffirmSign', {}), false);
    assert.equal(invoke(f, 'enterAddendum', {}), false);
    assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
  }
});
test('a current eligible completed independent finding and actual capable originals are required before reaffirmation attendance', () => {
  for (const change of [f => f.s.reconsideration.status = 'queued', f => f.s.reconsideration.finding.outcome = 'ineligible',
    f => f.s.reconsideration.finding.outcome = 'unresolved', f => f.c.conduct.push({ id: 'later-report', at: f.at, kind: 'attack' }),
    f => f.s.reconsideration.finding.reviewerId = 'substitute', f => f.s.recognition.personId = 'substitute',
    f => f.c.bodyEpoch++, f => f.c.charterCurrent = false, f => f.c.cityId = 'another', f => f.c.alive = false,
    f => f.c.capable = false, f => f.c.atCounter = false, f => f.c.clerkPresent = false, f => f.c.lineOfSight = false,
    f => f.c.busy = true, f => f.c.activeViolence = true, f => f.c.administrationAvailable = false, f => f.c.presentIds = [],
    f => f.office.power = 0, f => f.office.workSeconds = 59, f => f.office.channelPowered = false,
    f => f.office.maintenanceReady = false, f => f.office.clerk.assignment = 'another-duty',
    f => Recognition.admin(f.s, f.succession).status = 'dead', f => Recognition.admin(f.s, f.succession).health = 49,
    f => Recognition.admin(f.s, f.succession).fatigue = 80, f => Recognition.admin(f.s, f.succession).workSeconds = 59,
    f => Recognition.admin(f.s, f.succession).assignment = 'other-duty']) {
    const f = fixture(); recognized(f); freshEligible(f); change(f);
    const work = f.office.workSeconds, power = f.office.power;
    assert.equal(invoke(f, 'reaffirmMeeting'), false); assert.equal(f.s.reaffirmation, null);
    assert.equal(f.office.workSeconds, work); assert.equal(f.office.power, power);
  }
  const f = fixture(); recognized(f); assert.equal(invoke(f, 'reaffirmMeeting'), false);
});
test('exact one-hour reaffirmation offers cannot be widened, signed twice or refreshed on unchanged facts', () => {
  const f = fixture(); recognized(f); freshEligible(f); reaffirmOffered(f); const terms = copy(f.s.reaffirmation.terms);
  assert.equal(terms.expiresAt - terms.offeredAt, 3600); assert.equal(terms.origin, 'coerced');
  assert.match(terms.retainedRights, /property and faith/);
  assert.equal(invoke(f, 'reaffirmSign', { ...terms, personId: 'replacement' }), false);
  assert.equal(invoke(f, 'reaffirmSign', { ...terms, role: 'civilWatch' }), false);
  step(f, 3600); assert.equal(invoke(f, 'reaffirmSign', terms), false); assert.equal(invoke(f, 'reaffirmMeeting'), false);
  const expiring = fixture(); recognized(expiring); freshEligible(expiring); reaffirmOffered(expiring);
  expiring.at = expiring.s.reaffirmation.terms.expiresAt - 10;
  assert.equal(invoke(expiring, 'reaffirmSign', copy(expiring.s.reaffirmation.terms)), true); step(expiring, 10);
  assert.equal(expiring.s.job, null); assert.equal(expiring.s.reaffirmation.receipt, null);
  assert.equal(expiring.s.phase, 'reaffirmationExpired'); assert.equal(expiring.office.assignment, null);
});
test('partial reaffirmation work reloads and pauses without backfill, refunds, signatures or new staff', () => {
  const f = fixture(); recognized(f); freshEligible(f); const work = f.office.workSeconds, power = f.office.power;
  invoke(f, 'reaffirmMeeting'); step(f, 20); f.s = Recognition.normalize(f.s); f.succession = Succession.normalize(f.succession);
  f.c.clerkPresent = false; step(f, 500); assert.equal(f.s.job.progress, 20); assert.equal(f.s.reaffirmation.response, null);
  f.c.clerkPresent = true; step(f, 1); assert.equal(f.s.job.progress, 20); step(f, 40);
  assert.equal(f.s.reaffirmation.response.decision, 'offered');
  invoke(f, 'reaffirmSign', copy(f.s.reaffirmation.terms)); step(f, 20); f.office.channelPowered = false; step(f, 500);
  assert.equal(f.s.job.progress, 20); assert.equal(f.s.reaffirmation.receipt, null);
  f.office.channelPowered = true; step(f, 1); step(f, 40);
  invoke(f, 'enterAddendum', Recognition.addendumTerms(f.s)); step(f, 20); f.office.workSeconds = 0; step(f, 100);
  assert.equal(f.s.job.progress, 20); assert.equal(f.s.reaffirmation.addendum, null);
  f.office.workSeconds = work - 140; step(f, 1); step(f, 40);
  assert.equal(f.s.reaffirmation.addendum.status, 'completed'); assert.equal(f.office.workSeconds, work - 180);
  assert.equal(f.office.power, power - 3);
  const cancelled = fixture(); recognized(cancelled); freshEligible(cancelled); invoke(cancelled, 'reaffirmMeeting'); step(cancelled, 20);
  const spent = cancelled.office.workSeconds, paid = cancelled.office.power;
  assert.equal(Recognition.cancel(cancelled.s, cancelled.succession, cancelled.office, cancelled.at), true);
  assert.equal(cancelled.office.workSeconds, spent); assert.equal(cancelled.office.power, paid); assert.equal(cancelled.s.reaffirmation.receipt, null);
});
test('further evidence cancels unsupported reaffirmation completion and supersedes old records permission without erasing it', () => {
  for (const kind of ['meeting', 'signing', 'addendum']) {
    const f = fixture(); recognized(f); freshEligible(f);
    if (kind === 'meeting') invoke(f, 'reaffirmMeeting');
    if (kind === 'signing') { reaffirmOffered(f); invoke(f, 'reaffirmSign', copy(f.s.reaffirmation.terms)); }
    if (kind === 'addendum') { reaffirmed(f); invoke(f, 'enterAddendum', Recognition.addendumTerms(f.s)); }
    step(f, 20); const historicalReceipt = copy(f.s.reaffirmation.receipt); newReceivedReport(f); step(f, 60);
    assert.equal(f.s.job, null); assert.equal(f.office.assignment, null); assert.deepEqual(f.s.reaffirmation.receipt, historicalReceipt);
    assert.equal(f.s.reaffirmation.addendum, null);
    assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    assert.equal(invoke(f, 'reaffirmSign', f.s.reaffirmation.terms), false);
  }
  const f = fixture(); recognized(f); freshEligible(f); reaffirmed(f); const old = copy(f.s.reaffirmation);
  newReceivedReport(f); reconsidered(f); assert.equal(invoke(f, 'reaffirmMeeting'), true); step(f, 60);
  assert.equal(f.s.reaffirmation.response.decision, 'refused'); assert.deepEqual(f.s.previousReaffirmations, [old]);
  assert.equal(f.s.reaffirmation.receipt, null); assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
});
test('forged reaffirmation bindings do not authorize the addendum, while fatigue and outages never erase historical consent', () => {
  for (const change of [f => f.s.reaffirmation.receipt.role = 'militaryDefenseCommand', f => f.s.reaffirmation.receipt.type = 'recognition',
    f => f.s.reaffirmation.receipt.recorderId = 'substitute', f => f.s.reaffirmation.receipt.originalRecognitionId = 'fake',
    f => f.s.reaffirmation.receipt.reviewId = f.s.review.id, f => f.s.reaffirmation.receipt.bodyEpoch++,
    f => f.s.reaffirmation.receipt.commandRelationship.scope = 'citywide army',
    f => f.s.reaffirmation.terms.duties = 'unlimited obedience', f => f.c.bodyEpoch++, f => f.office.clerk.id = 'substitute']) {
    const f = fixture(); recognized(f); freshEligible(f); reaffirmed(f); change(f);
    assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), false);
    assert.equal(invoke(f, 'enterAddendum', Recognition.addendumTerms(f.s)), false);
  }
  const f = fixture(); recognized(f); freshEligible(f); reaffirmed(f); const receipt = copy(f.s.reaffirmation.receipt);
  Recognition.admin(f.s, f.succession).fatigue = 80; f.office.channelPowered = false;
  assert.equal(Recognition.recordsAuthorityCurrent(f.s, f.succession, f.abdication, f.office, f.c), true);
  assert.equal(Recognition.operative(f.s, f.succession, f.abdication, f.office, f.c), false);
  assert.equal(invoke(f, 'enterAddendum', Recognition.addendumTerms(f.s)), false); assert.deepEqual(f.s.reaffirmation.receipt, receipt);
});
test('new register addendum does not invent an original memorandum, and public/normalized records hide private received facts', () => {
  const f = fixture(); recognized(f); freshEligible(f); reaffirmed(f);
  assert.equal(Recognition.addendumTerms(f.s).contents.originalMemorandumId, null);
  invoke(f, 'enterAddendum', Recognition.addendumTerms(f.s)); step(f, 60); f.s = Recognition.normalize(f.s);
  assert.equal(f.office.successionMemoranda.length, 1); assert.equal(f.office.successionMemoranda[0].type, 'scopedSuccessionReaffirmationAddendum');
  assert.equal(f.s.instruction, null); assert.deepEqual(f.office.records, []);
  const view = Recognition.publicView(f.s, f.c); assert.equal(view.reaffirmationCurrent, true); assert.equal(view.personalReaffirmationRequired, false);
  assert.doesNotMatch(JSON.stringify(view), /"evidence"|recognitionPolicy|workSeconds|wardMana|mapCell/);
  const dead = fixture(); recognized(dead); freshEligible(dead); invoke(dead, 'reaffirmMeeting'); dead.c.alive = false;
  const saved = copy(dead.s); step(dead, 500); assert.deepEqual(dead.s, saved);
  const body = fixture(); recognized(body); freshEligible(body); invoke(body, 'reaffirmMeeting'); step(body, 20); body.c.bodyEpoch++; step(body, 60);
  assert.equal(body.s.job, null); assert.equal(body.office.assignment, null); assert.equal(body.s.reaffirmation.receipt, null);
});
