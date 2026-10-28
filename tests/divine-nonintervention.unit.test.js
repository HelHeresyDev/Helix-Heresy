const { test } = require('node:test');
const assert = require('node:assert/strict');
const Owners = require('../divine-capabilities');
const Terms = require('../divine-nonintervention');
const Intervention = require('../divine-intervention');
const Religion = require('../religious-recognition');
const Faiths = require('../strategic-faiths');
const Supremacy = require('../durable-supremacy');
const { civicFixture } = require('./helpers/patron-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'world', runId: 'run' };
function fixture() {
  const f = civicFixture();
  f.s.source.faith.topicPositions = { warfare: 'defensiveOnly' };
  f.s.god.expenditures = { communication: 7, avatars: 12, protection: 8 };
  f.s.source.god = copy(f.s.god);
  f.base = { complete: true, rows: [{ godId: f.s.god.id, god: copy(f.s.god), faith: copy(f.s.source.faith), death: null }] };
  f.book = Owners.create(f.base, binding, f.at, true); assert(Owners.link(f.book, f.s));
  f.i = Intervention.create(f.s, binding, f.at);
  Object.assign(f.c, { representativeAtChannel: true, representativeAble: true, clerkAtChannel: true,
    sameGround: true, receiveAtCounter: true, free: true, representativeWitness: true, avatarWitness: true, expansionActive: true });
  return f;
}
function fact(f) {
  return Owners.advance(f.book, { ...binding, clock: f.at, divineCapabilities: f.book, divineIntervention: f.i }, f.at,
    { alive: f.c.alive, bodyEpoch: f.c.bodyEpoch })[0];
}
function tick(f, seconds) { f.at += seconds; Terms.advance(f.book, f.s, f.office, f.c, f.at); Terms.observeBreach(f.book, f.i, f.s, f.at); return fact(f); }
function begin(f) { const p = Terms.propose(f.book, f.s, f.office, f.c, f.at); assert(p); assert(Terms.begin(f.book, f.s, f.office, f.c, p, f.at)); return p; }
function agree(f) { begin(f); tick(f, Terms.WORK); assert.equal(f.book.agreements.length, 1); }
test('actual exact communication spends the same god reserve, original work, power and attention as petitions and manifestations', () => {
  const f = fixture(), original = copy(f.s.source), work = f.office.workSeconds;
  assert.equal(fact(f).state, 'unverified'); const p = begin(f);
  assert.equal(f.s.god, f.book.records[0].god); assert.equal(f.s.god.power.reserve, 93); assert.equal(f.s.attentionSeconds, 420);
  assert.equal(Terms.begin(f.book, f.s, f.office, f.c, p, f.at), false);
  tick(f, 179); assert.equal(f.book.agreements.length, 0); assert.equal(fact(f).state, 'unverified');
  tick(f, 1); assert.equal(fact(f).state, 'qualifying'); assert.equal(fact(f).strategic.willing, false);
  assert.equal(f.office.workSeconds, work - 180); assert.equal(f.s.actor.assignment, null);
  assert.equal(f.book.reports.length, 1); assert.deepEqual(f.s.source, original);
  assert.equal(f.s.covenants.length, 0); assert.equal(f.s.submissions.length, 0);
});
test('tampered terms, absent original attendance, other assignments and finite shortages refuse without debits', () => {
  for (const change of [f => f.c.free = false, f => f.c.clerkAtChannel = false, f => f.c.sourceCurrent = false,
    f => f.office.assignment = 'other-work', f => f.s.actor.assignment = 'pastoral-duty', f => f.office.power = 0,
    f => f.s.god.power.reserve = 6, f => f.s.attentionSeconds = 179, f => f.s.actor.workSeconds = 179,
    f => f.office.clerk.id = 'replacement', f => f.c.representativeAble = false]) {
    const f = fixture(), p = Terms.propose(f.book, f.s, f.office, f.c, f.at); change(f);
    const reserve = f.s.god.power.reserve; assert.equal(Terms.begin(f.book, f.s, f.office, f.c, p, f.at), false);
    assert.equal(f.s.god.power.reserve, reserve); assert.equal(f.book.job, null);
  }
  const f = fixture(), p = Terms.propose(f.book, f.s, f.office, f.c, f.at); p.terms = 'Worship and automatic endorsement';
  assert.equal(Terms.begin(f.book, f.s, f.office, f.c, p, f.at), false);
});
test('partial work reload hydrates a single account, pauses outages without backfill and never refunds cancel', () => {
  const f = fixture(); begin(f); tick(f, 25);
  const saved = copy({ book: f.book, religion: f.s }); assert.equal(saved.religion.god, undefined);
  f.book = Owners.normalize(saved.book); f.s = Religion.normalize(saved.religion); assert(Owners.link(f.book, f.s));
  assert.equal(f.s.god.power.reserve, 93);
  f.office.channelPowered = false; tick(f, 600); assert.equal(f.book.job.progress, 25);
  f.office.channelPowered = true; tick(f, 600); assert.equal(f.book.job.progress, 25);
  tick(f, 155); assert.equal(f.book.agreements.length, 1); assert.equal(f.s.god.power.reserve, 93);
  const g = fixture(); begin(g); tick(g, 25); Terms.release(g.book, g.s, g.office);
  assert.equal(g.s.god.power.reserve, 93); assert.equal(g.office.assignment, null); assert.equal(g.book.agreements.length, 0);
});
test('legacy migration preserves only an actually saved account; lost referenced data never refills from the world', () => {
  const f = fixture(), old = civicFixture().s; old.god.power.reserve = 23;
  const legacy = Owners.create(f.base, binding, 60, false); assert(Owners.preserveContact(legacy, old));
  assert.equal(old.god.power.reserve, 23); old.god.power.reserve--; assert.equal(legacy.records[0].god.power.reserve, 22);
  const missing = Owners.normalize(copy(f.book)); missing.records = []; const normalized = Owners.normalize(missing);
  const contact = Religion.normalize(copy(f.s)); assert.equal(Owners.link(normalized, contact), false);
  assert.equal(contact.god.lifecycle.lifeState, 'unknown'); assert.equal(contact.god.power.reserve, 0);
  assert.equal(Owners.link(null, contact), false); assert.equal(contact.god.power.reserve, 0);
  assert.equal(Owners.preserveContact(normalized, contact), false);
});
test('personal restraint does not recall a hostile local body, spend another reserve or turn local truce into global assent', () => {
  const f = fixture();
  assert(Intervention.observe(f.i, f.s, { id: 'original-attack', actorId: 'scientist', targetId: f.s.actor.id, actionId: 'strike' }, f.c, f.at));
  Intervention.advance(f.i, f.s, f.office, () => f.c, f.at, {});
  f.at += 120; Intervention.advance(f.i, f.s, f.office, () => f.c, f.at, { receivingCell: () => ({ x: 18, y: 11, z: 6 }) });
  assert.equal(f.s.god.power.reserve, 73); assert.equal(f.i.avatars.length, 1);
  const a = f.i.avatars[0]; assert(a.hostile); assert.equal(fact(f).state, 'unverified');
  f.c.avatarVisible = f.c.canHear = true; f.c.avatarIncapacitated = f.c.avatarSuppressed = false;
  assert(Intervention.agree(f.i, f.c, Intervention.TERMS, f.at)); assert.equal(fact(f).state, 'unverified');
  agree(f); assert.equal(f.s.god.power.reserve, 66); assert.equal(fact(f).state, 'qualifying');
  assert(Intervention.observe(f.i, f.s, { id: 'renewed-assault', actorId: 'scientist', targetId: a.id, actionId: 'strike' }, f.c, f.at));
  Terms.observeBreach(f.book, f.i, f.s, f.at); assert(f.book.agreements[0].breachedAt);
  assert.equal(fact(f).state, 'unverified'); assert.equal(a.hostile, true); assert.equal(a.health, 120);
});
test('a non-protective rare ally still receives an actual delayed breach report without inventing a protecting avatar', () => {
  const f = fixture(); delete f.s.source.faith.topicPositions; f.i = null;
  assert.equal(Intervention.create(f.s, binding, f.at), null); agree(f);
  const event = { id: 'actual-renewed-assault', actorId: 'scientist', targetId: f.s.actor.id, actionId: 'strike' };
  assert(Terms.observe(f.book, f.s, event, f.c, f.at)); tick(f, 0); assert.equal(f.s.god.power.reserve, 86);
  f.c.sameGround = f.c.receiveAtCounter = false; const known = Terms.publicView(f.book);
  tick(f, 119); assert.equal(f.book.agreements[0].breachedAt, null);
  tick(f, 1); assert.equal(fact(f).state, 'unverified'); assert.equal(f.book.incidents[0].receivedAt, f.at);
  assert.deepEqual(Terms.publicView(f.book), known); assert.equal(Terms.receive(f.book, f.s, f.c, f.at), false);
  f.c.sameGround = f.c.receiveAtCounter = true; assert(Terms.receive(f.book, f.s, f.c, f.at));
  assert.equal(Terms.publicView(f.book).at(-1).state, 'receivedBreach');
});
test('expiry and overlapping renewal use actual dates, finite costs and continuous coverage across coarse catch-up', () => {
  const f = fixture(); agree(f); const start = f.book.agreements[0].payload.at;
  assert.equal(fact(f).since, start); assert.equal(Terms.propose(f.book, f.s, f.office, f.c, f.at), null);
  tick(f, Terms.DURATION - 86400); const p = begin(f); tick(f, 180);
  assert.equal(fact(f).since, start); assert.equal(f.s.god.power.reserve, 86);
  const expiry = f.book.agreements[1].payload.expiresAt; const held = Terms.publicView(f.book);
  tick(f, expiry - f.at); assert.equal(fact(f).state, 'unverified'); assert.deepEqual(Terms.publicView(f.book), held);
  assert.equal(f.book.agreements[0].payload.id === p.id, false);
  begin(f); tick(f, 180); assert.equal(fact(f).since, f.at); assert.equal(fact(f).state, 'qualifying');
  const coarse = fixture(); begin(coarse); tick(coarse, 1000); assert.equal(coarse.book.agreements[0].payload.at, 240);
  assert.equal(fact(coarse).since, 240);
});
test('explicit independent means, unresolved earlier authorizations and body change cannot be settled by one personal signature', () => {
  for (const key of ['independentCommands', 'survivingClaimants', 'unresolvedCommitments']) {
    const f = fixture(); agree(f); f.s.god[key] = ['separate-original']; assert.equal(fact(f).state, 'unverified');
  }
  const f = fixture(); agree(f); f.i.authorizations.push({ manifested: false, payload: { expiresAt: f.at + 500 } });
  assert.equal(fact(f).state, 'unverified'); f.i.authorizations = []; f.c.bodyEpoch++; assert.equal(fact(f).state, 'unverified');
});
test('worship loss, exhaustion, avatar death and silence do not retire the living original individual', () => {
  const f = fixture(); f.s.god.lifecycle.divinityState = 'descended'; f.s.god.power.reserve = 0; f.s.god.worshipSources = [];
  assert.equal(fact(f).state, 'unverified'); assert.equal(f.s.god.lifecycle.lifeState, 'living');
  assert.equal(Terms.propose(f.book, f.s, f.office, f.c, f.at), null);
  const source = { strategicDivinity: { godOrder: ['god:a'] }, strategicDivineHistory: {
    currentGodRows: [copy(f.base.rows[0].god), { ...copy(f.base.rows[0].god), id: 'new-ascendant' }], eventRows: [], remainsRows: [] } };
  source.strategicDivineHistory.currentGodRows[0].lifecycle.lifeState = 'dead';
  assert.equal(Owners.sources(source).rows[0].death, null);
  source.strategicDivineHistory.eventRows.push({ id: 'actual-killing', kind: 'divineDeath', participantIds: ['god:a'], year: 20,
    stateDelta: { victimLifeState: 'dead', remainsId: 'remains:a' } });
  source.strategicDivineHistory.remainsRows.push({ id: 'remains:a', formerGodId: 'god:a', identityPreserved: true });
  const original = copy(source), base = Owners.sources(source); assert(base.complete); assert.equal(base.rows.length, 2);
  f.book = Owners.create(base, binding, f.at, true); assert.equal(fact(f).state, 'retired'); assert.deepEqual(source, original);
});
test('rare practical motives require real teaching and published rival circumstances, not generic anti-god endorsement', () => {
  const f = fixture(); delete f.s.source.faith.topicPositions;
  for (const position of ['mortalAutonomy', 'nihilism']) { f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(position); assert(Terms.motive(f.s)); }
  for (const position of ['vengeance', 'liberation']) {
    f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor(position); assert.equal(Terms.motive(f.s), null);
    f.s.source.patronInterest = { kind: position, godId: f.s.god.id, targetGodId: 'living-rival',
      basis: position === 'vengeance' ? 'publishedDivineInjury' : 'publishedSeizedHolySite', eventId: 'published-injury', siteId: 'seized-site' };
    assert(Terms.motive(f.s));
  }
  f.s.source.faith.hereticTeaching = { position: 'ordinaryOpposition' }; assert.equal(Terms.motive(f.s), null);
});
test('received evidence is scoped and dated, never a hidden-roster, power or live qualification view', () => {
  const f = fixture(); agree(f); const view = Terms.evidence(f.book);
  for (const secret of ['repeatableSignature', 'reserveCapacity', 'attentionSeconds', 'qualifying', 'continuity']) assert(!JSON.stringify(view).includes(secret));
  f.book.records[0].lost = true; assert.equal(fact(f).state, 'unverified'); assert.deepEqual(Terms.evidence(f.book), view);
  const review = Supremacy.create(binding, { complete: true, targets: [] }, f.at);
  assert(Supremacy.review(review, binding, view, f.at)); assert.equal(Supremacy.publicView(review).review.evidence[0].account.issuer, f.s.source.godName);
});
test('actual signed personal restraint feeds the continuous three-day evaluator and expiry removes current qualification', () => {
  const f = fixture(); agree(f);
  const target = { id: 'divine:god:a', sourceId: 'god:a', kind: 'divine', createdAt: 0 };
  const city = { id: 'city:a', sourceId: 'population:a', kind: 'city', createdAt: 0 };
  const evaluator = Supremacy.create(binding, { complete: true, targets: [target, city] }, f.at);
  const update = () => Supremacy.advance(evaluator, binding, { complete: true, facts: [fact(f), {
    ...binding, targetId: city.id, sourceId: city.sourceId, kind: 'city', at: f.at, since: 60,
    state: 'qualifying', proofId: 'separately-supported-city-consumer', basis: 'directGovernment', viable: true }] }, f.at);
  update(); assert.equal(evaluator.phase, 'holding'); tick(f, Supremacy.INTERVAL); update(); assert.equal(evaluator.phase, 'qualified');
  assert.equal(evaluator.accomplishment, undefined);
  tick(f, Terms.DURATION - Supremacy.INTERVAL); update(); assert.equal(evaluator.phase, 'unverified');
  assert.equal(evaluator.qualifiedAt, null); assert.equal(f.s.god.lifecycle.lifeState, 'living');
});
test('descent does not annul a living individual’s existing commitment, create a body or erase independent claimants', () => {
  const f = fixture(); agree(f); f.s.god.lifecycle.divinityState = 'descended';
  f.s.god.worshipSources = []; f.s.god.power.reserve = 0;
  assert.equal(fact(f).state, 'qualifying'); assert.equal(f.s.god.lifecycle.lifeState, 'living');
  f.s.god.survivingClaimants = ['independent-original']; assert.equal(fact(f).state, 'unverified');
  assert.equal(f.i.avatars.length, 0); assert.equal(Terms.propose(f.book, f.s, f.office, f.c, f.at), null);
});
test('run binding, continued copies, independent starts, malformed imports and final death preserve boundaries', () => {
  const f = fixture(); agree(f); const before = copy(f.book);
  f.c.alive = false; tick(f, 1000); assert.deepEqual(f.book, before);
  const other = { worldId: 'copy', runId: 'copy-run' }, book = Owners.rebind(f.book, binding, other), contact = Religion.normalize(copy(f.s));
  assert.equal(Owners.link(book, contact), false); Object.assign(contact.godRef, other); assert(Owners.link(book, contact));
  assert.equal(contact.god.power.reserve, 93); assert.equal(book.agreements.length, 1);
  assert.equal(Owners.rebind(f.book, other, binding), null);
  const fresh = Owners.create(f.base, { ...binding, runId: 'new' }, 0, true); assert.equal(fresh.records[0].god.power.reserve, 100); assert.deepEqual(fresh.reports, []);
  for (const bad of [{ ...before, records: [null] }, { ...before, agreements: [null] }, { ...before, job: {} }]) assert.equal(Owners.normalize(bad).invalid, true);
});
