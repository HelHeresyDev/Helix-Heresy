const { test } = require('node:test'), assert = require('node:assert/strict');
const Rule = require('../city-rule'), History = require('../city-rule-history'), E = require('../institutional-evidence'), S = require('../durable-supremacy');
const { sources } = require('./helpers/regional-government-source');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const source = sources('a').operation, b = { worldId: 'world', runId: 'run' },
    people = source.institutions.map(i => ({ id: `${i.id}:person`, institutionId: i.id, roles: [i.role], health: 100, status: 'alive' })),
    agreements = people.map(p => ({ institutionId: p.institutionId, personId: p.id, roles: p.roles, termsId: 'original-terms' })),
    succession = { source: { cityId: source.cityId, charterId: source.charterId, authority: { id: source.baselineAuthorityId } }, officeId: 'original-office',
      handover: { id: 'original-handover', bodyEpoch: 0, termsId: 'original-terms' }, agreements,
      control: { sourceReceiptId: 'original-handover', recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: copy(agreements) } },
    rule = Rule.createAggregate(source, succession, b, 0, { id: 'original-defense', initialEnergy: 69120 }),
    c = { alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true, sourceCurrent: true,
      bodyEpoch: 0, institutionsAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge', defenseAvailable: true,
      routes: { 'farm:a': true } }, book = S.create(b, { complete: false, targets: [] }, 0);
  return { source, b, people, succession, rule, c, book, at: 0 };
}
function tick(f, seconds) { f.at += seconds; Rule.advance(f.rule, f.succession, f.people, () => f.c, f.at); }
function establish(f) { assert(Rule.order(f.rule, f.succession, f.people, f.c, f.at)); tick(f, 3600 + Rule.INTERVAL); assert.equal(f.rule.status, 'established'); }
function receive(f) { assert(Rule.receive(f.rule, f.succession, f.people, f.c, f.at));
  assert(S.receiveCityReport(f.book, f.b, f.rule.report, f.at)); return copy(f.rule.report); }
function review(f) { assert(S.review(f.book, f.b, f.book.cityReports, f.at)); return S.publicView(f.book).review; }
test('real supplied operation and existing reception emit exact reported historical scope without advancing time or awarding world domination', () => {
  const f = fixture(); establish(f); const at = f.at, reserve = f.rule.energy, r = receive(f), rows = E.city(r);
  assert.equal(f.at, at); assert.equal(f.rule.energy, reserve); assert.equal(rows.length, 2);
  assert.equal(rows[1].period.startAt, 3600); assert.equal(rows[1].period.endAt, f.at);
  assert.deepEqual(rows[1].cityScope, { cityId: 'a', sourceId: f.rule.id, charterId: f.source.charterId,
    populationSourceId: f.source.populationSourceId, handoverId: 'original-handover', bodyEpoch: 0,
    issuerIds: f.source.institutions.map(i => i.id).sort() });
  assert.equal(f.book.review, null); assert.equal(f.book.assessment, null); assert.equal(f.book.phase, 'unverified');
  assert.equal(f.book.intervals.length, 0); assert.equal(review(f).reportedCityIntervals.length, 1);
});
test('a later actual food shortage cannot erase an already received period, even if no review occurred between receptions', () => {
  const f = fixture(); establish(f); const old = receive(f), original = copy(f.book.cityReports);
  f.c.routes['farm:a'] = false; tick(f, 4 * Rule.DAY); assert.equal(f.rule.foodKg, 0); assert.equal(f.rule.status, 'contested');
  assert.equal(f.book.review, null); const adverse = receive(f); assert.equal(adverse.status, 'contested');
  assert.equal(f.book.cityReports.length, 3); assert.deepEqual(f.book.cityReports.slice(0, 2), original);
  const v = review(f); assert.equal(v.apparent, false); assert.equal(v.reportedCityIntervals.length, 1);
  const h = v.evidence.find(e => e.temporal === 'historical'), current = v.evidence.find(e => e.id === adverse.receiptId);
  assert.equal(h.receivedAt, old.at); assert.equal(h.period.endAt, old.accomplishment.at); assert.equal(h.supersededBy, undefined);
  assert.equal(current.status, 'challenge'); assert.equal(v.reportedCityIntervals[0].conflictingEvidenceIds.length, 0);
  assert.equal(f.book.accomplishment, undefined);
});
test('a first receipt after later loss can report an actually completed past local interval, never a fresh current control claim', () => {
  const f = fixture(); establish(f); const earned = copy(f.rule.accomplishment); f.c.routes['farm:a'] = false; tick(f, 4 * Rule.DAY);
  assert.equal(f.book.cityReports.length, 0); const r = receive(f), v = review(f);
  assert.equal(v.apparent, false); assert.equal(r.status, 'contested'); assert.equal(v.reportedCityIntervals[0].endAt, earned.at);
  assert.equal(v.reportedCityIntervals[0].receivedAt, f.at); assert.equal(v.reportedCityIntervals[0].startAt, earned.since);
});
test('snapshots, operating start dates, promised durations and missing legacy metadata never manufacture interval coverage', () => {
  const f = fixture(); establish(f); const r = receive(f);
  for (const change of [x => delete x.cityScope, x => x.accomplishment = null, x => x.accomplishment.at++,
    x => x.accomplishment.cityId = 'other', x => x.accomplishment.sourceId = 'other', x => x.accomplishment.since = -1,
    x => x.at = x.accomplishment.at - 1, x => x.cityScope.handoverId = '']) {
    const x = copy(r); change(x); assert.equal(E.city(x).some(e => e.temporal === 'historical'), false);
  }
  const snapshots = [10, 10 + History.INTERVAL].flatMap(at => E.city({ ...r, at, receiptId: `snapshot:${at}`, accomplishment: null, since: 10 }));
  S.review(f.book, f.b, [...f.book.cityReports, ...snapshots], f.at + History.INTERVAL); // The genuinely held earlier period is retained, not extended.
  assert.equal(f.book.review.reportedCityIntervals.length, 1);
  const fresh = fixture(); S.review(fresh.book, fresh.b, snapshots, 10 + History.INTERVAL);
  assert.deepEqual(fresh.book.review.reportedCityIntervals, []);
  const promise = { ...E.city(r)[1], period: { kind: 'promisedDuration', startAt: 0, endAt: History.INTERVAL } };
  S.review(fresh.book, fresh.b, [promise], r.at); assert.deepEqual(fresh.book.review.reportedCityIntervals, []);
});
test('same-time received contradictions remain distinct; a later failure outside the period does not retroactively contradict it', () => {
  const f = fixture(); establish(f); const first = receive(f);
  f.c.counterpower = 'capableOpposition'; tick(f, 0); const second = receive(f);
  assert.notEqual(first.receiptId, second.receiptId); assert.equal(f.book.cityReports.length, 3);
  const v = review(f); assert.equal(v.apparent, false);
  assert.deepEqual(v.reportedCityIntervals[0].conflictingEvidenceIds, [second.receiptId]);
  assert.equal(v.evidence.find(e => e.id === first.receiptId).supersededBy, undefined);
});
test('city, charter, population, handover, issuer and body scope cannot be merged into a different authority’s period', () => {
  const f = fixture(); establish(f); const r = receive(f), original = E.city(r)[1];
  for (const change of [x => x.cityScope.charterId = 'foreign-charter', x => x.cityScope.populationSourceId = 'foreign-population',
    x => x.cityScope.handoverId = 'other-handover', x => x.cityScope.bodyEpoch++, x => x.cityScope.issuerIds = ['another-issuer']]) {
    const x = E.city({ ...r, at: r.at + 1, receiptId: 'different-scope', status: 'contested' })[0]; change(x);
    const s = fixture().book; S.review(s, s, [original, x], r.at + 1);
    assert.equal(s.review.reportedCityIntervals[0].conflictingEvidenceIds.length, 0); assert.equal(original.supersededBy, undefined);
  }
  const forged = { ...original, cityScope: { ...original.cityScope, sourceId: 'another-source' } }, s = fixture().book;
  S.review(s, s, [forged], r.at); assert.equal(s.review.evidence.length, 0);
});
test('archive and assessment survive actual JSON normalization and continued binding without consulting live city accounts or private global archives', () => {
  const f = fixture(); establish(f); receive(f); review(f);
  // Receiving is independent of the evaluator's last private update.
  assert.equal(f.book.lastAt, 0); const restored = S.normalize(copy(f.book)); assert.deepEqual(restored.cityReports, f.book.cityReports);
  const b = { worldId: 'copy', runId: 'continued' }, continued = S.rebind(restored, f.b, b);
  assert.deepEqual(continued.cityReports, f.book.cityReports); assert.deepEqual(S.publicView(continued).review, S.publicView(f.book).review);
  const good = copy(continued), bad = copy(continued), c = { alive: true, capable: true, local: true, atDesk: true, deskAvailable: true, busy: false, deskId: 'existing-workbench' };
  for (const s of [good, bad]) s.lastAt = f.at;
  good.phase = 'qualified'; good.since = 0; good.intervals = [{ secret: 'HIDDEN_GLOBAL_TRUTH' }];
  bad.phase = 'failed'; bad.targets = [{ id: 'SECRET_ROSTER' }];
  assert(S.assess(good, good, c, f.at)); assert(S.assess(bad, bad, c, f.at));
  assert.deepEqual(good.assessment, bad.assessment); assert(!JSON.stringify(good.assessment).match(/HIDDEN_GLOBAL_TRUTH|SECRET_ROSTER/));
  assert.equal(good.assessment.reportedCityIntervals.length, 1);
  assert.deepEqual(S.normalize(copy(good)).assessment, good.assessment);
});
test('reading, repeat receipts and private changes cannot refresh a received historical claim; death freezes reception and fresh starts inherit nothing', () => {
  const f = fixture(); establish(f); const r = receive(f), held = copy(f.book.cityReports);
  assert(S.receiveCityReport(f.book, f.b, r, f.at + 10)); assert.deepEqual(f.book.cityReports, held);
  const altered = copy(r); altered.foodKg = 999999; altered.status = 'contested'; altered.cityScope.issuerIds = ['changed'];
  assert(S.receiveCityReport(f.book, f.b, altered, f.at + 10)); assert.deepEqual(f.book.cityReports, held);
  const before = copy(f.book); assert.equal(S.receiveCityReport(f.book, f.b, { ...r, at: f.at + 100 }, f.at), false);
  assert.equal(S.receiveCityReport(f.book, f.b, r, f.at + 10, false), false); assert.deepEqual(f.book, before);
  assert.equal(fixture().book.cityReports.length, 0); assert.equal(fixture().book.review, null);
});
