const { test } = require('node:test');
const assert = require('node:assert/strict');
const Religion = require('../religious-recognition');
const Charter = require('../charter-recognition');
const Governments = require('../strategic-city-governments');
const Faiths = require('../strategic-faiths');
const World = require('../strategic-world');
const { civicFixture, patronSource } = require('./helpers/patron-fixture');
const copy = v => JSON.parse(JSON.stringify(v));
const tick = (f, n) => { f.at += n; return Religion.advance(f.s, f.office, f.c, f.at); };
const meet = f => { assert.ok(Religion.meet(f.s, f.office, f.c, f.at)); tick(f, 60); };
function answer(f) { meet(f); assert.ok(Religion.petition(f.s, f.office, copy(f.s.terms), f.c, f.at)); tick(f, 180); }
function submit(f) { answer(f); assert.ok(Religion.submit(f.s, f.office, copy(f.s.reply), f.c, f.at)); tick(f, 60); }
function review(f) {
  assert.ok(Charter.file(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at)); f.at = f.charter.review.readyAt;
  assert.ok(Charter.hear(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at)); f.at += 180;
  Charter.advance(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at);
}
test('every theme allocates one original local faithful representative and finite private divine capacity, not new world assets', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = civicFixture(theme), original = copy(f.origin), reserve = f.s.god.power.reserve, duty = f.office.workSeconds, power = f.office.power;
    submit(f);
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.allocation.people, 1);
    assert.deepEqual(f.origin, original); assert.equal(f.s.god.power.reserve, reserve - 7); assert.equal(f.s.attentionSeconds, 420);
    assert.equal(f.office.workSeconds, duty - 300); assert.equal(f.s.actor.workSeconds, 1500); assert.equal(f.office.power, power - 3);
    assert.equal(f.succession.handover, null); assert.equal(f.charter.recognition, null); assert.equal(f.succession.control, null);
    assert.equal(f.s.reply.payload.decision.outcome, 'approved'); assert.equal(f.s.submissions.length, 1);
    assert.deepEqual(f.office.records.at(-1), f.s.submissions[0]);
  }
});
test('unsupported branch, faith, source, corpse or descended god is not substituted', () => {
  const f = civicFixture(); assert.equal(Religion.create(null, f.office), null); assert.equal(Religion.publicView(null), null);
  for (const change of [s => s.branch.operationalStatus = 'destroyed', s => s.branch.publicPhysicalPresence = false,
    s => s.branch.currentStanding = 'proscribed', s => s.branch.divineRelationship = 'censured', s => s.branch.currentCityId = 'other',
    s => s.faith.godId = 'different', s => s.faith.confirmation.state = 'historicallyConfirmed', s => s.branch.originalCityId = 'other',
    s => s.populationSourceId = null, s => s.god.lifecycle.lifeState = 'dead', s => s.god.lifecycle.divinityState = 'descended',
    s => s.god.divineCore.receivingCapacity = 0, s => s.communicationMethods = []]) {
    const source = patronSource(); change(source); assert.equal(Religion.create(source, f.office), null);
  }
});
test('actual attendance, original identity, usable counter and shared capacity are required', () => {
  for (const change of [f => f.c.local = false, f => f.c.capable = false, f => f.c.cityId = 'other', f => f.c.atCounter = false,
    f => f.c.clerkPresent = false, f => f.c.representativePresent = false, f => f.c.lineOfSight = false, f => f.c.visitPermission = false,
    f => f.c.sourceCurrent = false, f => f.c.charterCurrent = false, f => f.c.bodyEpoch++, f => f.c.activeViolence = true,
    f => f.c.busy = true, f => f.c.branchAvailable = false, f => f.office.channelPowered = false, f => f.office.power = 0,
    f => f.office.maintenanceReady = false, f => f.office.workSeconds = 59, f => f.s.actor.workSeconds = 59,
    f => f.s.actor.health = 49, f => f.s.actor.assignment = 'pastoral-care', f => f.office.clerk.assignment = 'another-duty',
    f => f.office.clerk.id = 'replacement', f => f.s.actor.institutionId = 'new-church']) {
    const f = civicFixture(); change(f); assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false);
  }
});
test('representative refusal is stable across reload, waiting and changed channel availability, and is not divine refusal', () => {
  const f = civicFixture(); f.s.actor.facilitationPolicy = 'declinePoliticalPetitions'; meet(f);
  assert.equal(f.s.facilitation.decision, 'refused'); assert.equal(f.s.reply, null); assert.equal(f.s.terms, null);
  const response = copy(f.s.facilitation); f.s = Religion.normalize(f.s); tick(f, 5000); f.c.channelAvailable = false;
  assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false); assert.deepEqual(f.s.facilitation, response);
});
test('partial attended work persists across reload and outages without backfill or resource reset', () => {
  const f = civicFixture(), original = f.office.workSeconds; assert.ok(Religion.meet(f.s, f.office, f.c, f.at)); tick(f, 20);
  f.s = Religion.normalize(f.s); f.office.channelPowered = false; tick(f, 500); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; tick(f, 500); assert.equal(f.s.job.progress, 20); tick(f, 40);
  assert.equal(f.office.workSeconds, original - 60); assert.equal(f.office.power, 28);
  assert.ok(Religion.petition(f.s, f.office, copy(f.s.terms), f.c, f.at)); tick(f, 25);
  const reserve = f.s.god.power.reserve; f.s = Religion.normalize(f.s); f.c.channelAvailable = false; tick(f, 500);
  assert.equal(f.s.job.progress, 25); assert.equal(f.s.reply, null); assert.equal(f.s.god.power.reserve, reserve);
  f.c.channelAvailable = true; tick(f, 1); tick(f, 155); assert.equal(f.s.reply.payload.decision.outcome, 'approved');
});
test('exact one-hour petition cannot widen authority, refresh expiry or overspend finite divine power and attention', () => {
  for (const change of [f => f.s.god.power.reserve = 6, f => f.s.attentionSeconds = 179, f => f.c.channelAvailable = false,
    f => f.at = f.s.terms.expiresAt, f => f.s.god.lifecycle.divinityState = 'descended']) {
    const f = civicFixture(); meet(f); change(f); assert.equal(Religion.petition(f.s, f.office, copy(f.s.terms), f.c, f.at), false);
  }
  const f = civicFixture(); meet(f); const terms = copy(f.s.terms);
  assert.equal(Religion.petition(f.s, f.office, { ...terms, scope: 'Rule over this god' }, f.c, f.at), false);
  assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false); assert.deepEqual(f.s.terms, terms);
});
test('doctrine—not alignment, secret lab contents or rerollable favor—determines the disclosed scoped reply', () => {
  for (const [teaching, expected] of [['cooperationWithoutDivineSovereignty', 'approved'], ['strictSeparationFromChurch', 'refused'],
    ['conditionalMoralSupport', 'conditional'], ['authorityBoundByPublishedOath', 'conditional'], ['unsupported', 'unresolved']]) {
    const f = civicFixture(); f.s.source.faith.civicTeaching.position = teaching; answer(f);
    assert.equal(f.s.reply.payload.decision.outcome, expected); assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false);
    assert.equal(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at), false);
    assert.equal(f.charter.recognition, null);
  }
  const f = civicFixture(); f.c.conduct.push({ id: 'actually-received', at: f.c.claim.at + 1, kind: 'attack', witnessId: 'original-witness' }); answer(f);
  assert.equal(f.s.reply.payload.decision.outcome, 'refused'); assert.match(f.s.reply.payload.decision.reason, /not a criminal judgment/);
});
test('authenticated receipt binds original god, faith, exact response, claim, method and body, not a signature label', () => {
  const f = civicFixture(); answer(f); const genuine = copy(f.s.reply);
  assert.ok(Religion.authentic(f.s, genuine, f.c));
  for (const change of [r => r.id = 'fake', r => r.seal = 'divine-signature:looks-authentic', r => r.payload.godId = 'other-god',
    r => r.payload.faithId = 'other-faith', r => r.payload.scope = 'army', r => r.payload.method = 'free-avatar',
    r => r.payload.facts.claim.id = 'other-claim', r => r.payload.facts.bodyEpoch++, r => r.payload.decision.outcome = 'refused']) {
    const falseReply = copy(genuine); change(falseReply); assert.equal(Religion.authentic(f.s, falseReply, f.c), false);
    assert.equal(Religion.submit(f.s, f.office, falseReply, f.c, f.at), false);
  }
  f.c.bodyEpoch++; assert.equal(Religion.authentic(f.s, genuine, f.c), false);
});
test('reply is not civic evidence until actual once-only attended original-clerk submission', () => {
  const f = civicFixture(); answer(f); assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
  assert.ok(Religion.submit(f.s, f.office, copy(f.s.reply), f.c, f.at)); tick(f, 25);
  assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []); f.s = Religion.normalize(f.s); tick(f, 35);
  assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), f.c.rule.requiredAuthorizationIds);
  assert.equal(Religion.submit(f.s, f.office, copy(f.s.reply), f.c, f.at), false); assert.equal(f.s.submissions.length, 1);
  const original = copy(f.office.records); f.office.records = []; assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
  f.office.records = original; f.c.rule.patronRequirement.godId = 'different'; assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
});
test('actual unresolved charter finding becomes eligible only through a separate original independent hearing', () => {
  const f = civicFixture(); review(f); assert.equal(f.charter.review.finding.outcome, 'unresolved');
  const original = copy(f.charter.review); submit(f);
  assert.equal(f.charter.review.finding.outcome, 'unresolved'); assert.equal(f.charter.recognition, null);
  f.c.authorizationIds = Religion.authorizationIds(f.s, f.office, f.c); review(f);
  assert.equal(f.charter.review.finding.outcome, 'eligible'); assert.deepEqual(f.charter.previousReviews[0], original);
  assert.equal(f.charter.recognition, null); assert.equal(f.succession.control, null);
});
test('optional statement never retroactively changes old law or makes existing recognition stale', () => {
  const f = civicFixture('madcap', false); const law = copy(f.c.rule); review(f);
  assert.ok(Charter.meeting(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at)); f.at += 60;
  Charter.advance(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at);
  assert.ok(Charter.sign(f.charter, f.succession, f.abdication, f.office, f.institutions, copy(f.charter.terms), f.c, f.at)); f.at += 60;
  Charter.advance(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at);
  const receipt = copy(f.charter.recognition); submit(f); f.c.authorizationIds = Religion.authorizationIds(f.s, f.office, f.c);
  assert.deepEqual(f.c.authorizationIds, []); assert.deepEqual(f.c.rule, law); assert.deepEqual(f.charter.recognition, receipt);
  assert.ok(Charter.authorityCurrent(f.charter, f.succession, f.abdication, f.office, f.c));
});
test('refused, conditional and unresolved replies are fileable but never fulfill a patron approval', () => {
  for (const teaching of ['strictSeparationFromChurch', 'conditionalMoralSupport', 'authorityBoundByPublishedOath', 'unsupported']) {
    const f = civicFixture(); f.s.source.faith.civicTeaching.position = teaching; submit(f);
    assert.equal(f.s.submissions.length, 1); assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
  }
});
test('changed actually received facts permit a new petition while preserving earlier refusal and spent finite capacity', () => {
  const f = civicFixture(); f.c.conduct = [{ id: 'witnessed', at: f.c.claim.at + 1, kind: 'attack' }]; answer(f);
  const old = copy(f.s.reply), reserve = f.s.god.power.reserve; assert.equal(old.payload.decision.outcome, 'refused');
  f.c.conduct.push({ id: 'new-received', at: f.at, kind: 'newTestimony' }); meet(f);
  assert.deepEqual(f.s.previous[0].reply, old); assert.equal(f.s.god.power.reserve, reserve);
  assert.ok(Religion.petition(f.s, f.office, copy(f.s.terms), f.c, f.at)); tick(f, 180);
  assert.equal(f.s.reply.payload.decision.outcome, 'refused'); assert.equal(f.s.god.power.reserve, reserve - 7);
});
test('a relabeled conditional response or substituted original record cannot fulfill a patron covenant', () => {
  const f = civicFixture(); f.s.source.faith.civicTeaching.position = 'authorityBoundByPublishedOath'; submit(f);
  f.s.submissions[0].outcome = 'approved'; f.office.records[f.office.records.length - 1] = copy(f.s.submissions[0]);
  assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
  for (const change of [r => r.id = 'forged', r => r.replyId = 'different', r => r.claimId = 'different',
    r => r.godId = 'different', r => r.scope = 'divine-command', r => r.recorderId = 'substitute']) {
    const g = civicFixture(); submit(g); change(g.s.submissions[0]); g.office.records[g.office.records.length - 1] = copy(g.s.submissions[0]);
    assert.deepEqual(Religion.authorizationIds(g.s, g.office, g.c), []);
  }
});
test('changed evidence, body or unavailable original source cancels unsupported work without forging a response', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.conduct.push({ id: 'new', kind: 'attack', at: f.at }),
    f => f.c.sourceCurrent = false, f => f.office.clerk.id = 'replacement']) {
    const f = civicFixture(); meet(f); assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 20);
    change(f); tick(f, 10); assert.equal(f.s.job, null); assert.equal(f.s.reply, null); assert.equal(f.s.god.power.reserve, 93);
  }
});
test('cancelled communication may be explicitly retried under the same expiry with another real allocation, not a free response', () => {
  const f = civicFixture(); meet(f); const expiry = f.s.terms.expiresAt;
  assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 20); Religion.cancel(f.s, f.office, f.at);
  assert.equal(f.s.reply, null); assert.equal(f.s.god.power.reserve, 93); f.at = f.s.channelAvailableAt;
  assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 180);
  assert.equal(f.s.terms.expiresAt, expiry); assert.equal(f.s.god.power.reserve, 86); assert.equal(f.s.attentionSeconds, 240);
});
test('death freezes original reservations and private resources, and public records omit private attention, evidence and signature', () => {
  const f = civicFixture(); meet(f); assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 20);
  f.c.alive = false; const before = copy({ s: f.s, office: f.office }); tick(f, 500);
  assert.deepEqual({ s: f.s, office: f.office }, before);
  const publicRecord = JSON.stringify(Religion.publicView(f.s));
  for (const key of ['repeatableSignature', 'attentionSeconds', 'receivingCapacity', 'reserve', 'facilitationPolicy', 'conduct', 'seal', 'workSeconds'])
    assert.equal(publicRecord.includes('"' + key + '"'), false);
});
test('new-world published patron covenants are a deterministic minority; legacy and unsupported rules remain unchanged', () => {
  const patron = { godId: 'known-god', faithId: 'confirmed-faith' };
  const make = (i, p) => Governments.designationReviewRule('patron-laws', `city:${i}`, 'named experimental successor', 'individual', 'review', p);
  const laws = Array.from({ length: 100 }, (_, i) => make(i, patron));
  assert.deepEqual(laws, Array.from({ length: 100 }, (_, i) => make(i, patron)));
  assert.ok(laws.some(r => r.patronRequirement)); assert.ok(laws.some(r => !r.patronRequirement));
  for (const law of laws.filter(r => r.patronRequirement)) {
    assert.deepEqual(law.requiredAuthorizationIds, [law.patronRequirement.authorizationId]); assert.equal(law.patronRequirement.scope, Religion.SCOPE);
  }
  assert.deepEqual(make(0, null).requiredAuthorizationIds, []);
  assert.equal(Governments.designationReviewRule('patron-laws', 'a', 'inheritance', 'individual', 'review', patron), null);
});

test('ordinary civic cooperation, aid, oath compliance and personality never endorse the openly heretical scientist', () => {
  for (const position of [null, 'reject']) for (const civic of ['cooperationWithoutDivineSovereignty', 'authorityBoundByPublishedOath', 'conditionalMoralSupport']) {
    const f = civicFixture();
    if (position) f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(position);
    else delete f.s.source.faith.hereticTeaching;
    f.s.source.faith.civicTeaching.position = civic;
    f.s.source.faith.outsiderTreatment = { stance: 'aidWithoutCompulsoryConversion' };
    f.s.god.personality = ['vengeful', 'oppressed', 'nihilistic']; f.c.fulfilledOath = true;
    submit(f);
    assert.equal(f.s.reply.payload.decision.outcome, 'refused');
    assert.equal(f.s.reply.payload.decision.supportKind, 'none');
    assert.deepEqual(f.s.request.facts.scientistPosition, Religion.SCIENTIST_POSITION);
    assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
    assert.ok(Religion.authentic(f.s, f.s.reply, f.c));
    f.s = Religion.normalize(f.s); tick(f, 5000);
    assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false);
  }
});

test('four explicit exceptional motives authorize only the disclosed claim, not a bargain or hidden killing ambition', () => {
  for (const motive of ['mortalAutonomy', 'vengeance', 'liberation', 'nihilism']) {
    const f = civicFixture(); f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(motive);
    if (['vengeance', 'liberation'].includes(motive)) f.s.source.patronInterest = {
      kind: motive, godId: 'god:a', targetGodId: 'god:rival',
      ...(motive === 'vengeance' ? { basis: 'publishedDivineInjury', eventId: 'injury', year: 100 }
        : { basis: 'publishedSeizedHolySite', siteId: 'seized-site' })
    };
    f.c.hiddenAmbition = 'peacefulResearch'; f.c.privateLab = 'unknown'; submit(f);
    const d = f.s.reply.payload.decision;
    assert.equal(d.outcome, 'approved'); assert.equal(d.motive, motive);
    assert.equal(d.supportKind, 'exceptionalClaimAuthorization'); assert.match(d.reason, /not approval of research/);
    assert.match(d.reason, /not.*a bargain, a killing promise/);
    assert.equal(f.s.request.facts.hiddenAmbition, undefined); assert.equal(f.s.request.facts.privateLab, undefined);
    assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), f.c.rule.requiredAuthorizationIds);
    assert.equal(f.charter.recognition, null); assert.equal(f.succession.control, null);
    f.c.hiddenAmbition = 'ruleOverGods'; assert.ok(Religion.authentic(f.s, f.s.reply, f.c));
    assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false);
  }
});

test('vengeance and liberation cannot substitute a presumed grievance, another god, or invented target for received interests', () => {
  for (const motive of ['vengeance', 'liberation']) for (const interest of [null,
    { kind: motive, godId: 'other', targetGodId: 'rival', basis: 'personality' },
    { kind: motive, godId: 'god:a', targetGodId: 'god:a', basis: 'publishedDivineInjury', eventId: 'injury' },
    { kind: motive, godId: 'god:a', targetGodId: 'rival', basis: 'secretCanonicalHistory', siteId: 'site', eventId: 'injury' }]) {
    const f = civicFixture(); f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(motive);
    f.s.source.patronInterest = interest; answer(f);
    assert.equal(f.s.reply.payload.decision.outcome, 'refused');
  }
});

test('exceptional willingness does not waive civic separation, coercion remedies, oath conditions or received violence', () => {
  for (const motive of ['mortalAutonomy', 'nihilism']) {
    for (const [civic, outcome] of [['strictSeparationFromChurch', 'refused'], ['authorityBoundByPublishedOath', 'conditional'], ['conditionalMoralSupport', 'conditional']]) {
      const f = civicFixture(); f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(motive);
      f.s.source.faith.civicTeaching.position = civic; submit(f);
      assert.equal(f.s.reply.payload.decision.outcome, outcome); assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), []);
    }
    const f = civicFixture(); f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(motive);
    f.c.conduct.push({ id: 'received-attack', kind: 'attack', at: f.c.claim.at + 1 }); answer(f);
    assert.equal(f.s.reply.payload.decision.outcome, 'refused');
  }
});

test('the original disclosure and motive are sealed, and changing received interest cancels unfinished paid work', () => {
  const f = civicFixture(); answer(f);
  const forged = copy(f.s.reply); forged.payload.facts.scientistPosition.stance = 'obedientWorshipper';
  assert.equal(Religion.authentic(f.s, forged, f.c), false);
  const g = civicFixture(); meet(g); assert.ok(Religion.petition(g.s, g.office, g.s.terms, g.c, g.at)); tick(g, 20);
  g.s.source.patronInterest = { kind: 'vengeance', targetGodId: 'invented' }; tick(g, 20);
  assert.equal(g.s.job, null); assert.equal(g.s.reply, null); assert.equal(g.s.god.power.reserve, 93);
});

test('pre-disclosure signed approvals and filed authority remain authentic history without changing facts or spent costs', () => {
  const f = civicFixture(); submit(f);
  // Reconstruct a genuine pre-correction archive, including its original signature and filed copies.
  delete f.s.source.faith.hereticTeaching;
  for (const facts of [f.s.facilitation.facts, f.s.terms.evidence, f.s.request.facts, f.s.reply.payload.facts]) {
    delete facts.scientistPosition; delete facts.patronInterest; delete facts.doctrine.hereticTeaching;
  }
  f.s.reply.payload.decision = { outcome: 'approved', reason: 'The god supports independent consideration of this disclosed claim under cooperation without church sovereignty. Other officials and the civic reviewer remain independent.' };
  f.s.reply.seal = World.stableHash(`${f.s.god.divineCore.repeatableSignature}:${World.stableHash(f.s.reply.payload)}`);
  f.s.submissions[0].receivedReply = copy(f.s.reply); f.office.records[f.office.records.length - 1] = copy(f.s.submissions[0]);
  const old = copy(f.s.reply), reserve = f.s.god.power.reserve, record = copy(f.office.records);
  f.s = Religion.normalize(f.s); assert.ok(Religion.authentic(f.s, f.s.reply, f.c));
  assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), f.c.rule.requiredAuthorizationIds);
  meet(f); assert.deepEqual(f.s.previous[0].reply, old); assert.equal(f.s.god.power.reserve, reserve);
  assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 180);
  assert.equal(f.s.reply.payload.decision.outcome, 'refused'); assert.deepEqual(f.office.records, record);
  assert.deepEqual(Religion.authorizationIds(f.s, f.office, f.c), f.c.rule.requiredAuthorizationIds);
});

test('received views explain opposition and exceptional motives without revealing secret plans or divine reserves', () => {
  const f = civicFixture(); f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor('nihilism'); answer(f);
  const view = Religion.publicView(f.s);
  assert.equal(view.scientistPosition.stance, 'opposedToDivineAuthority'); assert.match(view.faith.hereticTeaching.summary, /including this god/);
  assert.equal(view.reply.decision.motive, 'nihilism'); assert.equal(view.reply.decision.supportKind, 'exceptionalClaimAuthorization');
  assert.equal(JSON.stringify(view).includes('repeatableSignature'), false); assert.equal(view.reply.payload, undefined);
});

test('unfinished pre-disclosure work cannot produce a new legacy approval after reload', () => {
  const f = civicFixture(); meet(f); assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 20);
  for (const facts of [f.s.job.facts, f.s.facilitation.facts, f.s.terms.evidence, f.s.request.facts]) {
    delete facts.scientistPosition; delete facts.patronInterest;
  }
  f.s = Religion.normalize(f.s); const reserve = f.s.god.power.reserve; tick(f, 180);
  assert.equal(f.s.reply, null); assert.equal(f.s.job, null); assert.equal(f.s.god.power.reserve, reserve);
  assert.equal(f.office.assignment, null); assert.equal(f.s.actor.assignment, null);
});
