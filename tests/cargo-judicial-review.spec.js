const { test, expect } = require('@playwright/test');
const Court = require('../cargo-judicial-review');
const Charging = require('../cargo-charging');
const Civic = require('../scientist-identity');
const Registry = require('../carrier-identity');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'registry', cityId: 'a', name: 'Registry', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0], profile = Civic.create();
  office.courtAuthority = { institutionId: 'court', cityId: 'a', active: true };
  const ctx = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  const wallet = { money: 100 };
  expect(Civic.begin(profile, office, Civic.preview(profile, office, 'Mira'), wallet, ctx, 0)).toBe(true);
  Civic.advance(profile, market.identityOffices, ctx, 1800);
  const doc = profile.documents[0];
  const q = Civic.preview(profile, office, '', 'courtAccess', doc.number);
  expect(Civic.begin(profile, office, q, wallet, ctx, 1800)).toBe(true);
  Civic.advance(profile, market.identityOffices, ctx, 2400);
  const assessment = { at: 2500, sourceRevision: 1, actors: [{ id: 'observed', role: 'presenter', sourceIds: ['observation'] }],
    identityFindings: [{ id: 'check', personObservationId: 'observed', result: 'supported', document: copy(doc) }] };
  const evidence = { cityId: 'a', arrivedAt: 2500, law: { cityId: 'a', id: 'law' }, personObservations: [{ id: 'observed' }], authorization: { checked: true, covering: [] } };
  const r = { id: 'referral', reviewedRevision: 1, revisions: [{ evidence }], investigation: { assessments: [assessment], assessedSignature: '1:0:0', submissions: [], corrections: [] } };
  const gate = { id: 'gate', cityId: 'a', jurisdiction: 'city', active: true, judiciary: { cityId: 'a', institutionId: 'court', active: true },
    criminalIntake: { cityId: 'a', institutionId: 'prosecution', active: true, referrals: [r] } };
  const findings = () => ({ status: 'acceptedForInvestigation', elements: ['transaction', 'contraband', 'knowledge'].map(id => ({ id, support: id === 'contraband' ? ['sample', 'law'] : [] })) });
  Charging.advance(gate, 2500, findings); Charging.advance(gate, 4300, findings);
  Court.advance(gate, 4300, findings);
  const credential = profile.courtCredentials[0];
  return { market, office, profile, ctx, wallet, doc, r, gate, findings, credential,
    advance: at => Court.advance(gate, at, findings) };
}
function proposed() {
  const f = fixture();
  // Deliberately corrupt a prosecutor conclusion: the independent judge must
  // reject it, not accept a status flag as transaction/knowledge evidence.
  f.r.charging.reviews[0].counts[0].status = 'proposed';
  f.advance(4301); f.d = f.gate.cargoCourt.dockets[0]; return f;
}
const args = f => [f.gate, f.d, f.profile, f.market.identityOffices, f.credential.id];
test('physical check issues a prospective credential, not a defendant identity or automatic court docket', () => {
  const f = fixture();
  expect(f.profile.courtCredentials).toHaveLength(1);
  expect(f.credential.observationId).not.toBe('observed');
  expect(Civic.courtAccess(f.profile, f.market.identityOffices, f.credential.id, 'court', 4400, true)).toEqual(f.credential);
  expect(f.gate.cargoCourt.dockets).toEqual([]); expect(f.gate.cargoCourt.power).toBe(12);
  expect(f.office.workSeconds).toBe(12000); // 4h clerk allocation less 30m registration and 10m check.
  expect(f.office.courtCredentials[0].credential.bodyEpoch).toBeUndefined();
});
test('independent judge rejects unsupported charge flags with reasons and no enforcement handoff', () => {
  const f = proposed(); expect(f.d.decisions).toEqual([]);
  f.advance(6101);
  expect(f.d.status).toBe('rejected'); expect(f.d.handoff).toBeNull();
  expect(f.d.decisions[0].gaps.map(g => g.element)).toEqual(['transaction', 'knowledge']);
  expect(f.d.decisions[0].judgeId).not.toBe(f.gate.chargingOffice.prosecutor.id);
  expect(f.d.notices[0]).toEqual(f.d.decisions[0]); expect(f.d.notices[0]).not.toBe(f.d.decisions[0]);
  const before = JSON.stringify(f.d); f.advance(20000); expect(JSON.stringify(f.d)).toBe(before);
});
test('offline, revoked, expired, altered, foreign and previous-body credentials fail closed', () => {
  for (const defect of ['offline', 'revoked', 'expired', 'altered', 'foreign', 'body', 'description']) {
    const f = proposed(); let at = 4400, connected = true;
    if (defect === 'offline') connected = false;
    if (defect === 'revoked') f.office.courtCredentials[0].status = 'revoked';
    if (defect === 'expired') at = f.credential.expiresAt;
    if (defect === 'altered') f.credential.document.registeredName = 'Someone else';
    if (defect === 'foreign') f.gate.cargoCourt.institutionId = 'foreign-court';
    if (defect === 'body') Civic.replaceBody(f.profile, f.market.identityOffices, f.profile.description, at);
    if (defect === 'description') f.profile.description.eyes = 'changed';
    expect(Court.challenge(...args(f), 'identity', at, connected), defect).toBe(false);
  }
});
test('identical names do not grant access to a different person or missing identity bridge', () => {
  const f = proposed(), d = copy(f.d); d.id = 'other'; d.proposals[0].subjectDocument.number = 'other-person-document';
  f.gate.cargoCourt.dockets.push(d);
  expect(Court.access(f.gate, d, f.profile, f.market.identityOffices, f.credential.id, 4400, true)).toBeNull();
  d.proposals[0].subjectDocument = null;
  expect(Court.access(f.gate, d, f.profile, f.market.identityOffices, f.credential.id, 4400, true)).toBeNull();
});
test('defendant challenges are bounded and counsel requires express docket-specific authorization and elapsed work', () => {
  const f = proposed();
  expect(Court.challenge(...args(f), 'identity', 4400, true, true)).toBe(false);
  expect(Court.authorize(...args(f), 4400, true)).toBe(true);
  expect(Court.authorize(...args(f), 4400, true)).toBe(false);
  expect(Court.challenge(...args(f), 'identity', 4400, true, true)).toBe(true);
  expect(f.d.challenges).toEqual([]); f.advance(4700); expect(f.d.challenges).toEqual([]);
  const restored = copy(f.gate); Court.advance(restored, 5000, f.findings); f.advance(5000);
  expect(restored).toEqual(f.gate); expect(f.d.challenges).toHaveLength(1);
  expect(f.gate.cargoCourt.counsel.workSeconds).toBe(6600);
  expect(Court.challenge(...args(f), 'identity', 5001, true)).toBe(false);
  expect(Court.challenge(...args(f), 'scope', 5001, true)).toBe(true);
  expect(Court.revoke(...args(f), 5002, true)).toBe(true);
  expect(Court.challenge(...args(f), 'jurisdiction', 5003, true, true)).toBe(false);
  expect(f.d.challenges).toHaveLength(2);
});
test('counsel incapacity pauses drafting without retrospective credit and revoked mandates cancel unfinished drafts', () => {
  const f = proposed(); Court.authorize(...args(f), 4400, true); Court.challenge(...args(f), 'scope', 4400, true, true);
  f.gate.cargoCourt.counsel.health = 0; f.advance(10000); expect(f.d.challenges).toEqual([]);
  f.gate.cargoCourt.counsel.health = 100; f.advance(10001); expect(f.d.challenges).toEqual([]);
  Court.revoke(...args(f), 10002, true); f.advance(11000);
  expect(f.d.challenges).toEqual([]); expect(f.gate.cargoCourt.counsel.job).toBeNull();
});
test('judge outages and amendments preserve old decisions and do not backdate work', () => {
  const f = proposed(); f.gate.cargoCourt.judge.health = 0; f.advance(10000); expect(f.d.decisions).toEqual([]);
  f.gate.cargoCourt.judge.health = 100; f.advance(10001); expect(f.d.decisions).toEqual([]);
  f.advance(11801); const original = JSON.stringify(f.d.decisions[0]);
  Court.challenge(...args(f), 'omittedDefense', 11802, true); f.advance(11802); f.advance(13602);
  expect(f.d.decisions).toHaveLength(2); expect(JSON.stringify(f.d.decisions[0])).toBe(original);
  expect(f.d.decisions[1].challengeFindings[0].kind).toBe('omittedDefense');
});
test('credentials require fresh completed attendance and unchanged local court authority', () => {
  const f = fixture(), q = Civic.preview(f.profile, f.office, '', 'courtAccess', f.doc.number);
  expect(Civic.begin(f.profile, f.office, q, f.wallet, { ...f.ctx, atCounter: false }, 3000)).toBe(false);
  expect(Civic.begin(f.profile, f.office, q, f.wallet, f.ctx, 3000)).toBe(true);
  f.office.courtAuthority.active = false; Civic.advance(f.profile, f.market.identityOffices, f.ctx, 10000);
  expect(f.profile.courtCredentials).toHaveLength(1); expect(f.profile.job.progress).toBe(0);
  f.office.courtAuthority.active = true; Civic.advance(f.profile, f.market.identityOffices, f.ctx, 10001);
  expect(f.profile.job.progress).toBe(0);
  Civic.advance(f.profile, f.market.identityOffices, f.ctx, 10601);
  expect(f.profile.courtCredentials).toHaveLength(2);
});
test('new defense material suspends a historical handoff even during judicial outage', () => {
  const f = proposed(); f.advance(6101);
  // Model a retained earlier decision; this is not a positive-evidence producer.
  f.d.decisions.push({ id: 'historical-decision', status: 'allowed' });
  f.d.handoff = { decisionId: 'historical-decision', custodyAuthorized: false };
  f.r.investigation.corrections.push({ kind: 'scope', at: 6200 });
  f.gate.cargoCourt.judge.health = 0; f.advance(6200);
  expect(f.d.handoff).toBeNull(); expect(f.d.status).toBe('reviewRequired');
  f.gate.cargoCourt.judge.health = 100; f.advance(6201); f.advance(8001);
  expect(f.d.status).toBe('withdrawn'); expect(f.d.decisions[1].id).toBe('historical-decision');
});
test('an incapacitated judge does not prevent authenticated filings and a depleted court cannot review for free', () => {
  const f = proposed(); f.gate.cargoCourt.judge.health = 0;
  expect(Court.challenge(...args(f), 'jurisdiction', 4400, true)).toBe(true);
  f.advance(10000); expect(f.d.decisions).toEqual([]);
  f.gate.cargoCourt.judge.health = 100; f.gate.cargoCourt.workSeconds = 0;
  f.advance(20000); expect(f.d.decisions).toEqual([]);
  expect(f.d.challenges).toHaveLength(1);
});
