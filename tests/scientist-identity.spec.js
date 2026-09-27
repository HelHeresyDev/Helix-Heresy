const { test, expect } = require('@playwright/test');
const Civic = require('../scientist-identity');
const Registry = require('../carrier-identity');
const Investigations = require('../cargo-investigations');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'registry:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, 0);
  return { value: Civic.create(), office: market.identityOffices[0], offices: market.identityOffices, wallet: { money: 100 },
    ctx: { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' } };
}
function begin(f, at = 0, name = 'Mira Vale') { return Civic.begin(f.value, f.office, Civic.preview(f.value, f.office, name), f.wallet, f.ctx, at); }
function finished() { const f = fixture(); expect(begin(f)).toBe(true); Civic.advance(f.value, f.offices, f.ctx, 1800); return f; }
function check(f, at = 2000) {
  const quote = Civic.preview(f.value, f.office, '', 'check', f.value.documents[0].number);
  expect(Civic.begin(f.value, f.office, quote, f.wallet, f.ctx, at)).toBe(true); Civic.advance(f.value, f.offices, f.ctx, at + 600);
}
function inquiry(f, at = 3000) {
  const r = { id: 'inquiry', sourceOrderId: 'order', reviewedRevision: 1, revisions: [{ evidence: { personObservations: [], reports: [], observation: { observerId: 'officer' } } }], reviews: [{ at, status: 'acceptedForInvestigation', elements: [] }] };
  r.investigation = { id: 'inquiry:investigation', status: 'awaitingNamedSource', interviews: [{ kind: 'officer', persons: [] }, { kind: 'examiner' }], submissions: [], corrections: [], assessments: [], notices: [{}], job: null, assessedSignature: '' };
  const gate = { id: 'gate', cityId: 'b', institutionId: 'watch', active: true, jurisdiction: 'city', criminalIntake: { active: true, cityId: 'b', referrals: [r] } };
  Investigations.provision(gate, at);
  return { r, gate, i: r.investigation, advance: at => Investigations.advance(gate, at, [], [], [], f.offices) };
}
test('preview is a disclosed proposed registration, not a document or historical identity', () => {
  const f = fixture(), quote = Civic.preview(f.value, f.office, '  Mira Vale  ');
  expect(quote).toMatchObject({ registeredName: 'Mira Vale', fee: 20, workSeconds: 1800 }); expect(quote.warning).toContain('permanent local visit record');
  expect(f.office.records).toEqual([]); expect(f.value.documents).toEqual([]); expect(f.wallet.money).toBe(100);
  expect(Civic.preview(f.value, null, 'Name')).toBeNull(); expect(Civic.preview(f.value, f.office, '')).toBeNull();
  expect(Civic.evidencePreview(f.value)).toBeNull();
});
test('real attendance, exact terms, usable staff, visibility, funds and free time are required', () => {
  for (const failure of ['away', 'otherCity', 'incapacitated', 'dead', 'clerkAway', 'blockedSight', 'busy', 'obscured', 'power', 'work', 'money', 'assignment', 'fee', 'appearance']) {
    const f = fixture(), q = Civic.preview(f.value, f.office, 'Mira');
    if (failure === 'away') f.ctx.atCounter = false;
    if (failure === 'otherCity') f.ctx.cityId = 'b';
    if (failure === 'incapacitated') f.ctx.capable = false;
    if (failure === 'dead') f.ctx.alive = false;
    if (failure === 'clerkAway') f.ctx.clerkPresent = false;
    if (failure === 'blockedSight') f.ctx.lineOfSight = false;
    if (failure === 'busy') f.ctx.busy = true;
    if (failure === 'obscured') f.ctx.visibility = 'obscured';
    if (failure === 'power') f.office.power = 0;
    if (failure === 'work') f.office.workSeconds = 0;
    if (failure === 'money') f.wallet.money = 0;
    if (failure === 'assignment') f.office.assignment = 'other-visitor';
    if (failure === 'fee') f.office.fee++;
    if (failure === 'appearance') f.value.description.hair = 'fair';
    expect(Civic.begin(f.value, f.office, q, f.wallet, f.ctx, 0), failure).toBe(false); expect(f.office.records).toEqual([]);
  }
});
test('physical clerk work issues one chosen-name document with finite resources and survives reload', () => {
  const f = fixture(); expect(begin(f)).toBe(true); Civic.advance(f.value, f.offices, f.ctx, 900);
  expect(f.value.job.progress).toBe(900); expect(f.value.documents).toEqual([]); expect(f.office.scientistVisits[0].status).toBe('inProgress');
  const saved = copy(f); Civic.advance(f.value, f.offices, f.ctx, 1800); Civic.advance(saved.value, saved.offices, saved.ctx, 1800);
  expect(saved.value).toEqual(f.value); expect(saved.offices).toEqual(f.offices);
  expect(f.wallet.money).toBe(80); expect(f.office).toMatchObject({ money: 20, power: 11, workSeconds: 12600, assignment: null });
  expect(f.value.documents[0]).toMatchObject({ registeredName: 'Mira Vale', issuedAt: 1800, description: f.value.description });
  expect(f.value.documents[0].scope).toContain('not verified birth history');
  Civic.advance(f.value, f.offices, f.ctx, 99999); expect(f.value.documents).toHaveLength(1); expect(f.office.records).toHaveLength(1);
});
test('cancellation and departure retain the permanent claim without issuing documents or refunding fees', () => {
  for (const failure of ['cancel', 'leave']) {
    const f = fixture(); begin(f); Civic.advance(f.value, f.offices, f.ctx, 600);
    if (failure === 'cancel') expect(Civic.cancel(f.value, f.offices, 600)).toBe(true);
    else { f.ctx.atCounter = false; Civic.advance(f.value, f.offices, f.ctx, 700); }
    expect(f.value.job).toBeNull(); expect(f.office.assignment).toBeNull(); expect(f.office.scientistVisits[0].claim.registeredName).toBe('Mira Vale');
    expect(f.value.documents).toEqual([]); expect(f.wallet.money).toBe(80); expect(Civic.cancel(f.value, f.offices, 800)).toBe(false);
  }
});
test('staff and channel outages pause without retroactive work, a new clerk cannot inherit the active observation', () => {
  const f = fixture(); begin(f); Civic.advance(f.value, f.offices, f.ctx, 600);
  f.office.channelPowered = false; Civic.advance(f.value, f.offices, f.ctx, 700); expect(f.office.assignment).toBeNull();
  f.office.channelPowered = true; Civic.advance(f.value, f.offices, f.ctx, 7000); expect(f.value.job.progress).toBe(600);
  const clerk = f.office.clerk.id; f.office.clerk.id = 'replacement'; Civic.advance(f.value, f.offices, f.ctx, 9000); expect(f.value.job.progress).toBe(600);
  f.office.clerk.id = clerk; Civic.advance(f.value, f.offices, f.ctx, 10000); Civic.advance(f.value, f.offices, f.ctx, 11200);
  expect(f.value.documents[0].issuedAt).toBe(11200); expect(f.office.money).toBe(20); expect(f.office.power).toBe(11);
});
test('death or body replacement interrupts unfinished registration without rewriting retained documents', () => {
  const f = fixture(); begin(f); Civic.endBody(f.value, f.offices, 600);
  expect(f.value.job).toBeNull(); expect(f.value.bodyEnded).toBe(true); expect(Civic.preview(f.value, f.office, 'New name')).toBeNull();
  const g = finished(), original = copy(g.value.documents[0]);
  Civic.replaceBody(g.value, g.offices, { ...g.value.description, face: 'angular', hair: 'fair' }, 1900);
  expect(g.value.documents[0]).toEqual(original); expect(g.value.receipts).toHaveLength(1); check(g);
  expect(g.value.receipts[1]).toMatchObject({ issuerResult: 'confirmed', appearance: 'mismatch', result: 'unverified' });
  expect(g.value.receipts[1].observationId).not.toBe(g.value.receipts[0].observationId);
});
test('physical checks preserve ambiguity and bodily changes without asserting soul or historical continuity', () => {
  for (const change of ['same', 'obscured', 'changed', 'expired', 'withdrawn', 'altered']) {
    const f = finished();
    if (change === 'obscured') f.ctx.visibility = 'obscured';
    if (change === 'changed') f.value.description.mark = 'new scar';
    if (change === 'expired') { f.value.documents[0].expiresAt = 1900; f.office.records[0].document.expiresAt = 1900; }
    if (change === 'withdrawn') f.office.records[0].status = 'withdrawn';
    if (change === 'altered') f.value.documents[0].registeredName = 'Altered';
    check(f); const result = f.value.receipts[1];
    expect(result.result).toBe(change === 'same' ? 'supported' : 'unverified'); expect(result.scope).toContain('not proof of historical, bodily or soul continuity');
    expect(f.wallet.money).toBe(80); expect(f.office.power).toBe(10); expect(f.office.workSeconds).toBe(12000);
  }
});
test('a changed body with indistinguishable descriptors gets only a fresh bounded observation, not continuity', () => {
  const f = finished(), first = copy(f.value.receipts[0]); Civic.replaceBody(f.value, f.offices, f.value.description, 1900); check(f);
  expect(f.value.receipts[1].result).toBe('supported'); expect(f.value.receipts[0]).toEqual(first);
  expect(f.value.receipts[1]).not.toHaveProperty('bodyEpoch'); expect(f.value.receipts[1].scope).toContain('not proof of historical');
});
test('independent disclosure neither identifies the remote submitter nor reveals private body state', () => {
  const f = finished(), q = inquiry(f), document = Civic.evidencePreview(f.value);
  expect(JSON.stringify(document)).not.toContain('bodyEpoch'); expect(JSON.stringify(document)).not.toContain('personId'); expect(JSON.stringify(document)).not.toContain('private');
  expect(q.i.submissions).toEqual([]); Investigations.submit(q.gate, q.r, document, 3000); q.advance(3000); q.advance(6600);
  const a = q.i.assessments[0]; expect(a.actors).toHaveLength(2);
  expect(a.actors.find(a => a.role.includes('registered civic attendee')).identity).toContain('Locally registered name: Mira Vale');
  expect(a.actors.find(a => a.role.includes('submitter')).identity).toContain('civil identity unverified');
  expect(a.actors.every(a => a.transaction === 'not established')).toBe(true);
  expect(a.scientistIdentityFindings[0].jurisdiction).toContain('foreign'); expect(f.office.workSeconds).toBe(10800);
});
test('altered copies, missing records and refusal disclose no replacement records', () => {
  for (const failure of ['altered', 'missing', 'refused', 'noConsent']) {
    const f = finished(), q = inquiry(f), document = Civic.evidencePreview(f.value);
    if (failure === 'altered') document.records[0].document.registeredName = 'Forgery';
    if (failure === 'missing') f.office.scientistVisits = [];
    if (failure === 'refused') f.office.civicReleaseConsent = false;
    if (failure === 'noConsent') document.releaseConsent = false;
    Investigations.submit(q.gate, q.r, document, 3000); q.advance(3000); q.advance(6600);
    const c = q.i.scientistIdentityResponses[0].comparisons[0]; expect(c.receipt).toBeNull(); expect(c.issuerStatus).toBeNull();
    expect(c.result).not.toBe('matchesCivicRecord'); expect(q.i.assessments[0].actors).toHaveLength(1);
  }
});
test('issuer withdrawal reaches a fresh disclosed check without deleting original observations or earlier findings', () => {
  const f = finished(), q = inquiry(f); Investigations.submit(q.gate, q.r, Civic.evidencePreview(f.value), 3000); q.advance(3000); q.advance(6600);
  const old = copy(q.i.assessments[0]); f.office.records[0].status = 'withdrawn'; q.advance(7000); expect(q.i.assessments).toHaveLength(1);
  check(f, 7000); Investigations.submit(q.gate, q.r, Civic.evidencePreview(f.value), 7600); q.advance(7600); q.advance(11200);
  expect(q.i.assessments.at(-1).actors.filter(a => a.role.includes('civic attendee'))[0].identity).toContain('withdrawn');
  expect(q.i.assessments[0]).toEqual(old); expect(f.value.receipts).toHaveLength(2); expect(f.value.documents).toHaveLength(1);
});
test('investigative verification shares the actual clerk and releases it when the inquiry pauses', () => {
  const f = finished(), q = inquiry(f); Investigations.submit(q.gate, q.r, Civic.evidencePreview(f.value), 3000); q.advance(3000);
  expect(f.office.assignment).toBeTruthy(); expect(begin(f, 3000, 'Another claim')).toBe(false);
  q.gate.investigationOffice.channelPowered = false; q.advance(4000); expect(f.office.assignment).toBeNull();
  q.gate.investigationOffice.channelPowered = true; q.advance(5000); expect(q.i.job.progress).toBe(0); q.advance(8600);
  expect(q.i.scientistIdentityResponses).toHaveLength(1); expect(f.office.power).toBe(10);
});
