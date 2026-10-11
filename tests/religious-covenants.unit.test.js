const { test } = require('node:test');
const assert = require('node:assert/strict');
const Religion = require('../religious-recognition');
const Faiths = require('../strategic-faiths');
const { civicFixture } = require('./helpers/patron-fixture');
const copy = v => JSON.parse(JSON.stringify(v));
const tick = (f, n) => { f.at += n; return Religion.advance(f.s, f.office, f.c, f.at); };
function prepared(theme = 'madcap', required = true) {
  const f = civicFixture(theme, required);
  f.s.source.faith.civicTeaching.position = 'authorityBoundByPublishedOath'; return f;
}
function answer(f) {
  assert.ok(Religion.meet(f.s, f.office, f.c, f.at)); tick(f, 60);
  assert.ok(Religion.petition(f.s, f.office, copy(f.s.terms), f.c, f.at)); tick(f, 180);
  return f.s.reply.payload.covenantOffer;
}
function sign(f) {
  const terms = answer(f); assert.ok(terms);
  assert.ok(Religion.acceptCovenant(f.s, f.office, copy(terms), f.c, f.at)); tick(f, 60); return terms;
}
function confirm(f) {
  const terms = sign(f);
  assert.ok(Religion.confirmCovenant(f.s, f.office, copy(terms), f.c, f.at)); tick(f, 180); return terms;
}
function file(f) {
  const terms = confirm(f);
  assert.ok(Religion.fileCovenant(f.s, f.office, copy(terms), f.c, f.at)); tick(f, 60); return terms;
}
const ids = f => Religion.authorizationIds(f.s, f.office, f.c);
const report = (f, extras = {}) => ({ id: 'received:witness:attack', at: f.at, kind: 'attackAtMunicipalCounter',
  actorId: 'scientist', targetId: f.office.clerk.id, witnessId: 'original-watch', cityId: f.c.cityId, ...extras });
test('all themes offer only a concrete rare conditional oath; finite signing, confirmation and filing do not recognize the city', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = prepared(theme), original = copy(f.origin), work = f.office.workSeconds, power = f.office.power;
    const terms = file(f), v = f.s.covenants[0];
    assert.equal(f.s.reply.payload.decision.outcome, 'conditional'); assert.ok(Religion.authentic(f.s, f.s.reply, f.c));
    assert.equal(v.status, 'filed'); assert.deepEqual(ids(f), ['a:designation-patron:god:a']);
    assert.equal(terms.obligation, Religion.OATH); assert.deepEqual(terms.protectedPeople, f.c.covenantPeople);
    assert.equal(f.s.god.power.reserve, 86); assert.equal(f.s.attentionSeconds, 240);
    assert.equal(f.office.workSeconds, work - 540); assert.equal(f.s.actor.workSeconds, 1260);
    assert.equal(f.office.power, power - 5); assert.deepEqual(f.origin, original);
    assert.equal(f.charter.recognition, null); assert.equal(f.succession.handover, null);
    assert.ok(f.office.records.some(r => JSON.stringify(r) === JSON.stringify(v.acceptance)));
    assert.ok(f.office.records.some(r => JSON.stringify(r) === JSON.stringify(v.filing)));
    assert.equal(Religion.fileCovenant(f.s, f.office, terms, f.c, f.at), false);
    assert.equal(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at), false);
    assert.equal(Religion.acceptCovenant(f.s, f.office, terms, f.c, f.at), false);
  }
});
test('ordinary refusal, strict separation, moral remedy, missing people and legacy signed replies cannot acquire an oath offer', () => {
  for (const change of [f => f.s.source.faith.hereticTeaching = Faiths.hereticTeachingFor('reject'),
    f => f.s.source.faith.civicTeaching.position = 'strictSeparationFromChurch',
    f => f.s.source.faith.civicTeaching.position = 'conditionalMoralSupport',
    f => f.c.covenantPeople = [], f => f.c.covenantPeople = f.c.covenantPeople.filter(p => p.id !== f.office.clerk.id)]) {
    const f = prepared(); change(f); assert.equal(answer(f), null);
    assert.equal(Religion.acceptCovenant(f.s, f.office, { id: 'fabricated' }, f.c, f.at), false);
  }
  const f = prepared(); answer(f); delete f.s.reply.payload.covenantOffer;
  // Historical packets remain interpretable but absence of a signed offer is not new permission.
  f.s.reply.seal = require('../strategic-world').stableHash(`${f.s.god.divineCore.repeatableSignature}:${require('../strategic-world').stableHash(f.s.reply.payload)}`);
  assert.ok(Religion.authentic(f.s, f.s.reply, f.c)); assert.equal(Religion.publicView(f.s).reply.covenantOffer, null);
});
test('acceptance and confirmation alone never supply civic authorization; optional law is unchanged', () => {
  const f = prepared(); const terms = sign(f); assert.deepEqual(ids(f), []);
  assert.ok(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at)); tick(f, 180); assert.deepEqual(ids(f), []);
  const optional = prepared('madcap', false), rule = copy(optional.c.rule); file(optional);
  assert.deepEqual(ids(optional), []); assert.deepEqual(optional.c.rule, rule);
});
test('completed covenant remains available beyond unsigned expiry and a changed audience without rewriting either reply', () => {
  const f = prepared(); file(f); const original = copy(f.s.reply);
  tick(f, 4000); assert.deepEqual(ids(f), ['a:designation-patron:god:a']);
  f.c.conduct.push(report(f, { targetId: 'unrelated-person' }));
  assert.ok(Religion.meet(f.s, f.office, f.c, f.at)); tick(f, 60);
  assert.ok(Religion.petition(f.s, f.office, f.s.terms, f.c, f.at)); tick(f, 180);
  assert.equal(f.s.reply.payload.decision.outcome, 'refused'); assert.equal(f.s.reply.payload.covenantOffer, null);
  assert.deepEqual(f.s.previous[0].reply, original); assert.deepEqual(ids(f), ['a:designation-patron:god:a']);
  f.s = Religion.normalize(f.s); assert.deepEqual(ids(f), ['a:designation-patron:god:a']);
});
test('declining is optional, final for unchanged facts and survives reload without costs or a promise', () => {
  const f = prepared(), terms = answer(f), resources = [f.office.power, f.office.workSeconds, f.s.god.power.reserve];
  assert.ok(Religion.declineCovenant(f.s, f.office, terms, f.c, f.at)); f.s = Religion.normalize(f.s); tick(f, 600);
  assert.equal(f.s.covenants[0].status, 'declined'); assert.equal(f.s.covenants[0].acceptance, null);
  assert.deepEqual([f.office.power, f.office.workSeconds, f.s.god.power.reserve], resources);
  assert.equal(Religion.acceptCovenant(f.s, f.office, terms, f.c, f.at), false);
  assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false); assert.deepEqual(ids(f), []);
});
test('partial signing, confirmation, filing, outage scheduling and original custody round-trip without free work', () => {
  const f = prepared(), terms = answer(f);
  for (const [start, total] of [[Religion.acceptCovenant, 60], [Religion.confirmCovenant, 180], [Religion.fileCovenant, 60]]) {
    assert.ok(start(f.s, f.office, terms, f.c, f.at)); tick(f, 20);
    f.s = Religion.normalize(copy(f.s)); f.office = copy(f.office);
    assert.equal(f.s.job.progress, 20); const reserve = f.s.god.power.reserve;
    f.office.channelPowered = false; tick(f, 100); assert.equal(f.s.job.progress, 20);
    f.office.channelPowered = true; tick(f, 1); assert.equal(f.s.job.progress, 20);
    tick(f, total - 20); assert.equal(f.s.job, null); assert.equal(f.s.god.power.reserve, reserve);
  }
  assert.deepEqual(ids(f), ['a:designation-patron:god:a']); assert.deepEqual(Religion.normalize(f.s), f.s);
});
test('only received witnessed scientist attacks on named original people breach; old attacks and other victims are not omniscient breaches', () => {
  const f = prepared(); file(f); const original = copy(f.s.reply);
  for (const extras of [{ at: f.s.covenants[0].acceptance.at - 1 }, { targetId: 'unrelated-person' },
    { actorId: 'someone-else' }, { witnessId: null }, { cityId: 'other' }, { kind: 'complaint' }]) {
    f.c.conduct = [report(f, extras)]; tick(f, 1);
    assert.equal(f.s.covenants[0].status, 'filed'); assert.deepEqual(ids(f), ['a:designation-patron:god:a']);
  }
  f.c.conduct = [report(f)]; assert.deepEqual(ids(f), []); tick(f, 1);
  assert.equal(f.s.covenants[0].status, 'suspended'); assert.deepEqual(f.s.reply, original);
  const known = Religion.publicView(f.s); assert.equal(known.covenants[0].breach.report.witnessId, 'original-watch');
  f.s = Religion.normalize(f.s); f.c.conduct = []; tick(f, 60);
  assert.equal(f.s.covenants[0].status, 'suspended'); assert.deepEqual(ids(f), []);
});
test('withdrawal prospectively removes support but retains conditional reply, confirmation, register history and civic findings', () => {
  const f = prepared(), terms = file(f), before = copy(f.s.covenants[0]), reply = copy(f.s.reply);
  f.charter.review = { finding: { outcome: 'eligible' } }; const finding = copy(f.charter.review);
  assert.ok(Religion.withdrawCovenant(f.s, f.office, terms, f.c, f.at)); assert.deepEqual(ids(f), []);
  assert.deepEqual(f.s.reply, reply); assert.deepEqual(f.s.covenants[0].confirmation, before.confirmation);
  assert.deepEqual(f.s.covenants[0].filing, before.filing); assert.deepEqual(f.charter.review, finding);
  f.s = Religion.normalize(f.s); assert.equal(f.s.covenants[0].status, 'withdrawn');
  assert.equal(Religion.acceptCovenant(f.s, f.office, terms, f.c, f.at), false);
  assert.equal(Religion.meet(f.s, f.office, f.c, f.at), false);
});
test('tampering with named people, oath, confirmation, filing or original register cannot authorize', () => {
  for (const change of [f => f.s.covenants[0].terms.protectedPeople.pop(), f => f.s.covenants[0].terms.obligation = 'Serve me',
    f => f.s.covenants[0].confirmation.payload.decision.outcome = 'refused',
    f => f.s.covenants[0].confirmation.seal = 'forged', f => f.s.covenants[0].filing.recorderId = 'replacement',
    f => f.office.records = [], f => f.c.sourceCurrent = false, f => f.c.charterCurrent = false,
    f => f.c.bodyEpoch++, f => f.s.god.lifecycle.divinityState = 'descended',
    f => f.c.covenantPeople = f.c.covenantPeople.slice(1)]) {
    const f = prepared(); file(f); change(f); assert.deepEqual(ids(f), []);
  }
  const f = prepared(), terms = answer(f);
  assert.equal(Religion.acceptCovenant(f.s, f.office, { ...terms, scope: 'Divine supremacy' }, f.c, f.at), false);
});
test('finite capacity, unavailable people and expired offers cannot manufacture confirmation; cancelled communication spends again', () => {
  for (const change of [f => f.s.god.power.reserve = 6, f => f.s.attentionSeconds = 179,
    f => f.c.channelAvailable = false, f => f.c.representativePresent = false, f => f.office.power = 0,
    f => f.office.workSeconds = 179, f => f.s.actor.workSeconds = 179,
    f => f.at = f.s.covenants[0].terms.expiresAt]) {
    const f = prepared(), terms = sign(f); change(f);
    assert.equal(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at), false); assert.deepEqual(ids(f), []);
  }
  const f = prepared(), terms = sign(f);
  assert.ok(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at)); tick(f, 25);
  assert.ok(Religion.cancel(f.s, f.office, f.at)); assert.equal(f.s.covenants[0].confirmation, null);
  tick(f, 155); assert.ok(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at)); tick(f, 180);
  assert.equal(f.s.god.power.reserve, 79); assert.equal(f.s.attentionSeconds, 60);
  assert.equal(f.s.covenants[0].status, 'confirmed');
});
test('changed facts or received breach cancel unfinished work; irreversible death freezes covenant work and capacity', () => {
  const f = prepared(), terms = sign(f);
  assert.ok(Religion.confirmCovenant(f.s, f.office, terms, f.c, f.at)); tick(f, 25);
  f.c.alive = false; f.c.conduct.push(report(f)); const before = copy(f.s); tick(f, 100);
  assert.deepEqual(f.s, before); assert.deepEqual(ids(f), []);
  f.c.alive = true; tick(f, 1); assert.equal(f.s.job, null); assert.equal(f.s.covenants[0].status, 'suspended');
  assert.equal(f.s.covenants[0].confirmation, null);
  const changed = prepared(), offer = answer(changed);
  assert.ok(Religion.acceptCovenant(changed.s, changed.office, offer, changed.c, changed.at)); tick(changed, 20);
  changed.c.bodyEpoch++; tick(changed, 1); assert.equal(changed.s.job, null); assert.deepEqual(changed.s.covenants, []);
});
test('dated public covenant records contain clauses and status, not authentication secrets, undisclosed conduct or divine reserves', () => {
  const f = prepared(); file(f); const view = Religion.publicView(f.s), raw = JSON.stringify(view);
  assert.equal(view.covenants[0].status, 'filed'); assert.equal(view.covenants[0].terms.obligation, Religion.OATH);
  for (const hidden of ['repeatableSignature', 'attentionSeconds', 'reserveCapacity', 'payload', 'seal', 'conduct'])
    assert.equal(raw.includes(`"${hidden}"`), false);
  const old = copy(f.s); delete old.covenants;
  assert.deepEqual(Religion.normalize(old).covenants, []);
  assert.equal(Religion.normalize({ ...old, covenants: 'malformed' }), null);
});
