const { test, expect } = require('@playwright/test');
const Access = require('../account-access');
const Identity = require('../buyer-identity');
const Buyer = require('../buyer-corroboration');
const Market = require('../intercity-smuggling');
const Investigations = require('../cargo-investigations');
const copy = v => JSON.parse(JSON.stringify(v));
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Identity.provision(state, { institutionId: 'registry:b', cityId: 'b', name: 'Destination Registry', active: true, localDistanceKm: 2 }, 0);
  const buyer = state.buyers[0], service = buyer.buyerService, person = service.representatives[0], office = state.identityOffices[0];
  const advance = at => Market.advance(state, at, [route]);
  Identity.request(state, buyer, Identity.preview(state, buyer), 0); advance(5400);
  return { state, buyer, service, person, office, advance, sh: { buyerContact: copy(service.contact) } };
}
function start(f, at = 5400) { expect(Access.request(f.state, f.buyer, Access.preview(f.state, f.buyer), at)).toBe(true); }
function finished() { const f = fixture(); start(f); f.advance(10800); return f; }
function inquiry(f, at = 11000) {
  const r = { id: 'inquiry', sourceOrderId: 'order', reviewedRevision: 1, revisions: [{ evidence: { personObservations: [], reports: [], observation: { observerId: 'officer' } } }], reviews: [{ at, status: 'acceptedForInvestigation', elements: [] }] };
  r.investigation = { id: 'inquiry:investigation', status: 'awaitingNamedSource', interviews: [{ kind: 'officer', persons: [] }, { kind: 'examiner' }], submissions: [], corrections: [], assessments: [], notices: [{}], job: null, assessedSignature: '' };
  const gate = { id: 'gate', cityId: 'b', institutionId: 'watch', active: true, jurisdiction: 'city', criminalIntake: { active: true, cityId: 'b', referrals: [r] } };
  Investigations.provision(gate, at);
  return { gate, r, i: r.investigation, advance: at => Investigations.advance(gate, at, f.state.operators, f.state.buyers, [], f.state.identityOffices) };
}
test('appointment preview creates neither identity proof, travel nor a charge', () => {
  const f = fixture(), q = Access.preview(f.state, f.buyer);
  expect(q).toMatchObject({ fee: 20, roundTripKm: 4, workSeconds: 1800 });
  expect(q.terms).toContain('Not ownership'); expect(f.buyer.accessTrip).toBeUndefined();
  expect(f.office.accessRecords).toBeUndefined(); expect(f.buyer.money).toBe(9980);
  expect(Access.previewEvidence(f.state, f.sh)).toBeNull();
});
test('new accounts receive one explicit saved capability; roles and replacements do not generate credentials', () => {
  const f = fixture(), credentials = copy(f.service.accessCredentials);
  Access.provisionBuyer(f.buyer, 5400); expect(f.service.accessCredentials).toEqual(credentials);
  f.person.accountCredentials = []; expect(Access.request(f.state, f.buyer, Access.preview(f.state, f.buyer), 5400)).toBe(false);
  Access.provisionBuyer(f.buyer, 5400); expect(f.person.accountCredentials).toEqual([]);
  const replacement = { ...copy(f.person), id: 'replacement', name: f.person.name }; f.service.representatives = [replacement];
  expect(Access.request(f.state, f.buyer, Access.preview(f.state, f.buyer), 5400)).toBe(false);
});
test('consent, actual matching credentials, identity presentation, resources and unchanged terms gate requests', () => {
  for (const failure of ['attendee', 'account', 'presentation', 'verification', 'wrongKey', 'wrongAccount', 'revoked', 'compromised', 'fee', 'busy', 'funds', 'food', 'office']) {
    const f = fixture(), q = Access.preview(f.state, f.buyer);
    if (failure === 'attendee') f.person.accountAccessConsent.appointment = false;
    if (failure === 'account') f.service.accessDemonstrationConsent = false;
    if (failure === 'presentation') f.person.civicPreferences.presentationConsent = false;
    if (failure === 'verification') f.person.civicPreferences.verificationConsent = false;
    if (failure === 'wrongKey') f.person.accountCredentials[0].key = 'not-the-key';
    if (failure === 'wrongAccount') f.person.accountCredentials[0].accountId = 'another-account';
    if (failure === 'revoked') Access.credentialEvent(f.buyer, f.service.accessCredentials[0].id, 'revoked', 5300);
    if (failure === 'compromised') Access.credentialEvent(f.buyer, f.service.accessCredentials[0].id, 'compromiseReported', 5300);
    if (failure === 'fee') f.office.fee++;
    if (failure === 'busy') f.person.assignment = 'other-work';
    if (failure === 'funds') f.buyer.money = 0;
    if (failure === 'food') f.person.provisions = 0;
    if (failure === 'office') f.office.active = false;
    expect(Access.request(f.state, f.buyer, q, 5400)).toBe(false); expect(f.buyer.accessTrip).toBeUndefined();
  }
});
test('walking, physical clerk work and observed account response consume finite resources once across reload', () => {
  const f = fixture(); start(f); f.advance(6300);
  expect(f.buyer.accessTrip.positionKm).toBe(1); expect(Buyer.canReceive(f.buyer)).toBe(false);
  f.advance(8100); expect(f.person.locationId).toBe(f.office.id); expect(f.buyer.accessTrip.progress).toBe(900);
  const saved = copy(f.state); f.advance(10800); Market.advance(saved, 10800, [route]); expect(saved).toEqual(f.state);
  const d = f.buyer.accessDocuments[0]; expect(d).toMatchObject({ result: 'supported', at: 9000, challenge: { issuedAt: 7200, answeredAt: 9000, result: 'demonstrated' }, identity: { result: 'supported' } });
  expect(f.buyer.accessTrip).toBeNull(); expect(f.person.availableAt).toBe(10800); expect(Buyer.canReceive(f.buyer)).toBe(true);
  expect(f.buyer.money).toBe(9960); expect(f.office.money).toBe(40); expect(f.office.workSeconds).toBe(10800); expect(f.office.power).toBe(10);
  expect(f.service).toMatchObject({ power: 5, workSeconds: 6600 }); expect(f.person.provisions).toBeCloseTo(2 - 10800 / 28800);
  expect(f.state.shipments).toEqual([]); f.advance(20000); expect(f.buyer.accessDocuments).toHaveLength(1);
});
test('identity verification and access demonstration are independent and cannot cure each other', () => {
  for (const failure of ['mismatch', 'obscured', 'altered', 'withdrawn', 'expired']) {
    const f = fixture();
    if (failure === 'mismatch') f.person.appearance.face = 'different';
    if (failure === 'obscured') f.office.accessVisibility = 'obscured';
    if (failure === 'altered') f.person.civicDocument.registeredName = 'False name';
    if (failure === 'withdrawn') f.office.records[0].status = 'withdrawn';
    if (failure === 'expired') { f.person.civicDocument.expiresAt = 7000; f.office.records[0].document.expiresAt = 7000; }
    start(f); f.advance(10800); const d = f.buyer.accessDocuments[0];
    expect(d.result).toBe('unverified'); expect(d.identity.result).toBe('unverified'); expect(d.challenge.result).toBe('demonstrated');
  }
});
test('credentials revoked or withdrawn consent mid-visit cannot produce a supported access demonstration', () => {
  for (const failure of ['revoked', 'consent', 'account', 'offline', 'power', 'work', 'replacementClerk', 'replay']) {
    const f = fixture(); start(f); f.advance(8100);
    if (failure === 'revoked') Access.credentialEvent(f.buyer, f.service.accessCredentials[0].id, 'revoked', 8100);
    if (failure === 'consent') f.person.accountAccessConsent.demonstration = false;
    if (failure === 'account') f.service.accessDemonstrationConsent = false;
    if (failure === 'offline') f.service.channelPowered = false;
    if (failure === 'power') f.service.power = 0;
    if (failure === 'work') f.service.workSeconds = 0;
    if (failure === 'replacementClerk') f.office.clerk.id = 'different-clerk';
    if (failure === 'replay') f.buyer.accessTrip.challenge.consumedAt = 8000;
    f.advance(10800); const d = f.office.accessRecords[0].receipt;
    expect(d.result).toBe('unverified'); expect(d.challenge.result).toBe('notDemonstrated'); expect(f.buyer.accessTrip).toBeNull();
  }
});
test('withdrawn presentation consent before arrival cannot fabricate a presented identity document', () => {
  const f = fixture(); start(f); f.advance(6300); f.person.civicPreferences.presentationConsent = false; f.advance(10800);
  expect(f.buyer.accessDocuments[0].identity).toEqual({ document: null, issuerResult: 'notPresented', appearance: 'notCompared', result: 'unverified' });
  expect(f.buyer.accessDocuments[0].result).toBe('unverified');
});
test('a changed account endpoint cannot answer a challenge for the originally previewed account route', () => {
  const f = fixture(); start(f); f.advance(8100); f.service.contact.handle = 'changed-endpoint'; f.advance(10800);
  expect(f.office.accessRecords[0].receipt.challenge.result).toBe('notDemonstrated');
  expect(f.office.accessRecords[0].receipt.account.handle).not.toBe('changed-endpoint');
});
test('paused roads and clerk outages do not backdate work or refresh a stale challenge', () => {
  const f = fixture(); start(f); f.advance(6300); f.office.route.open = false; f.advance(9000);
  expect(f.buyer.accessTrip.positionKm).toBe(1); f.office.route.open = true; f.advance(9500); expect(f.buyer.accessTrip.positionKm).toBe(1);
  f.advance(11000); const challenge = copy(f.buyer.accessTrip.challenge), progress = f.buyer.accessTrip.progress;
  f.office.channelPowered = false; f.advance(12000); expect(f.office.assignment).toBeNull();
  f.office.channelPowered = true; f.advance(20000); expect(f.buyer.accessTrip.progress).toBe(progress);
  f.advance(24000); expect(f.buyer.accessTrip).toBeNull(); const d = f.buyer.accessDocuments[0];
  expect(d.challenge.id).toBe(challenge.id); expect(d.challenge.result).toBe('expired'); expect(f.office.money).toBe(40);
  start(f, 25000); f.advance(30400); expect(f.buyer.accessDocuments[1].challenge.id).not.toBe(challenge.id);
});
test('an unavailable or busy account cannot borrow overlapping work for a successful response', () => {
  const f = fixture(); start(f); f.advance(8100);
  f.service.availableAt = 8500; f.advance(10800);
  expect(f.buyer.accessDocuments[0].challenge.result).toBe('notDemonstrated'); expect(f.service.workSeconds).toBe(7200);
});
test('customer reports exclude keys and canonical person IDs and never backfill withheld copies', () => {
  const f = finished(), document = Access.previewEvidence(f.state, f.sh), text = JSON.stringify(document);
  expect(text).not.toContain(f.person.id); expect(text).not.toContain(f.person.accountCredentials[0].key); expect(text).not.toContain('credentialId');
  expect(Access.previewEvidence(f.state, { buyerId: f.buyer.id })).toBeNull();
  const g = fixture(); g.person.accountAccessConsent.customerCopy = false; start(g); g.advance(10800);
  expect(g.office.accessRecords).toHaveLength(1); expect(g.buyer.accessDocuments).toBeUndefined();
  g.person.accountAccessConsent.customerCopy = true; g.advance(20000); expect(g.buyer.accessDocuments).toBeUndefined();
});
test('later revocation and compromise are dated status changes, not retroactive denial of access', () => {
  for (const kind of ['revoked', 'compromiseReported']) {
    const f = finished(), original = copy(f.buyer.accessDocuments[0]);
    expect(Access.credentialEvent(f.buyer, f.service.accessCredentials[0].id, kind, 11000)).toBe(true);
    expect(Access.recheck(f.state, f.buyer, original.id, 11000)).toBe(true); f.advance(11300);
    const saved = copy(f.state); f.advance(11600); Market.advance(saved, 11600, [route]); expect(saved).toEqual(f.state);
    expect(f.buyer.accessDocuments[0]).toEqual(original);
    expect(f.buyer.accessDocuments[1]).toMatchObject({ originalSupport: 'retained', accessStatus: kind, changes: [{ kind, at: 11000 }], supersedes: original.id });
    expect(f.service).toMatchObject({ power: 4, workSeconds: 6000 });
    expect(Access.credentialEvent(f.buyer, f.service.accessCredentials[0].id, kind, 11000)).toBe(false);
  }
});
test('issuer withdrawal and original source corrections withdraw support without deleting the original record', () => {
  for (const failure of ['identity', 'observation']) {
    const f = finished(), original = copy(f.buyer.accessDocuments[0]);
    if (failure === 'identity') f.office.records[0].status = 'withdrawn';
    else expect(Access.withdrawObservation(f.office, original.id, 'Challenge response was not observed reliably.', 11000)).toBe(true);
    Access.recheck(f.state, f.buyer, original.id, 11000); f.advance(11600);
    expect(f.buyer.accessDocuments[1].originalSupport).toBe('withdrawn'); expect(f.buyer.accessDocuments[0]).toEqual(original);
    expect(f.state.shipments).toEqual([]); expect(f.buyer.money).toBe(9960);
  }
});
test('finite rechecks release unavailable services and resume without repeat power charges or retroactive work', () => {
  const f = finished(); Access.recheck(f.state, f.buyer, f.buyer.accessDocuments[0].id, 11000); f.advance(11300);
  f.office.channelPowered = false; f.advance(12000); expect(f.office.assignment).toBeNull(); expect(f.service.assignment).toBeNull();
  f.office.channelPowered = true; f.advance(15000); expect(f.office.accessRecords[0].job.progress).toBe(300);
  f.advance(15300); expect(f.office.accessRecords[0].job).toBeNull(); expect(f.office.power).toBe(9); expect(f.service.power).toBe(4);
});
test('independent source release needs original attendee and account consent; replacement testimony is not invented', () => {
  for (const failure of ['attendee', 'account', 'office', 'replacement']) {
    const f = finished(), q = inquiry(f), document = Access.previewEvidence(f.state, f.sh);
    if (failure === 'attendee') f.person.accountAccessConsent.release = false;
    if (failure === 'account') f.service.accessReleaseConsent = false;
    if (failure === 'office') f.office.accessReleaseConsent = false;
    if (failure === 'replacement') f.service.representatives = [{ ...copy(f.person), id: 'replacement' }];
    Investigations.submit(q.gate, q.r, document, 11000); q.advance(11000); q.advance(14600);
    if (failure === 'replacement') { expect(q.i.status).toBe('paused'); expect(q.i.accountAccessResponses).toBeUndefined(); }
    else { const c = q.i.accountAccessResponses[0].comparisons[0]; expect(c.result).toBe('notReleased'); expect(c.receipt).toBeNull(); }
  }
});
test('source comparisons disclose only selected matching copies and freeze refusal per inquiry', () => {
  const f = finished(), q = inquiry(f), document = Access.previewEvidence(f.state, f.sh);
  document.records[0].identity.document.registeredName = 'Altered';
  Investigations.submit(q.gate, q.r, document, 11000); q.advance(11000); q.advance(14600);
  expect(q.i.accountAccessResponses[0].comparisons[0]).toMatchObject({ result: 'alteredCopy', receipt: null });
  const g = finished(), p = inquiry(g), d = Access.previewEvidence(g.state, g.sh); g.person.accountAccessConsent.release = false;
  Investigations.submit(p.gate, p.r, d, 11000); p.advance(11000); g.person.accountAccessConsent.release = true; p.advance(14600);
  expect(p.i.accountAccessResponses[0].comparisons[0].result).toBe('notReleased');
});
test('investigations receive only explicitly submitted receipts and new corrections require fresh disclosure', () => {
  const f = finished(), q = inquiry(f), document = Investigations.preview('accountAccess', f.sh, null, null, f.state);
  expect(q.i.submissions).toEqual([]); expect(Investigations.submit(q.gate, q.r, document, 11000)).toBe(true);
  q.advance(11000); q.advance(14600);
  const original = copy(q.i.assessments[0]); expect(original.actors.find(a => a.id === document.records[0].id).identity).toContain('Registered identity');
  expect(original.actors.every(a => a.knowledge === 'not established' || a.knowledge.includes('not established'))).toBe(true);
  expect(f.office.workSeconds).toBe(9000); expect(q.gate.investigationOffice.workSeconds).toBe(10800);
  f.office.records[0].status = 'withdrawn'; Access.recheck(f.state, f.buyer, document.records[0].id, 15000); f.advance(15600);
  q.advance(15600); expect(q.i.assessments[0]).toEqual(original); expect(q.i.assessments).toHaveLength(1);
  Investigations.submit(q.gate, q.r, Access.previewEvidence(f.state, f.sh), 15600); q.advance(15600); q.advance(19200);
  const a = q.i.assessments.at(-1).actors.find(a => a.id === document.records[0].id);
  expect(a.identity).toContain('withdrawn'); expect(a.conduct).toContain('Demonstrated access'); expect(a.transaction).toBe('not established');
  expect(q.i.assessments[0]).toEqual(original); expect(JSON.stringify(q.i)).not.toContain(f.person.id);
});
test('registry interviews cannot overlap physical visits, and outages release the shared clerk', () => {
  const f = finished(), q = inquiry(f); Investigations.submit(q.gate, q.r, Access.previewEvidence(f.state, f.sh), 11000); q.advance(11000);
  expect(f.office.assignment).toBeTruthy(); expect(Access.request(f.state, f.buyer, Access.preview(f.state, f.buyer), 11000)).toBe(false);
  q.gate.investigationOffice.channelPowered = false; q.advance(12000); expect(f.office.assignment).toBeNull();
  q.gate.investigationOffice.channelPowered = true; q.advance(14000); expect(q.i.job.progress).toBe(0);
  q.advance(17600); expect(q.i.accountAccessResponses).toHaveLength(1); expect(f.office.power).toBe(9);
});
