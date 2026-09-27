const { test, expect } = require('@playwright/test');
const Principal = require('../buyer-principal');
const Identity = require('../buyer-identity');
const Buyer = require('../buyer-corroboration');
const Market = require('../intercity-smuggling');
const Investigations = require('../cargo-investigations');
const copy = v => JSON.parse(JSON.stringify(v));
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture(register = true) {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Identity.provision(state, { institutionId: 'registry:b', cityId: 'b', name: 'Registry', active: true, localDistanceKm: 2 }, 0);
  const b = state.buyers[0], rep = b.buyerService.representatives[0], p = Principal.principal(b), o = state.identityOffices[0];
  const request = { templateId: 'offer', selectedId: 'batch', brokerId: 'broker', value: 500, cargo: { massKg: 5, volumeL: 6 }, localDistanceKm: 8,
    manifest: { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ kind: 'chemicalBatch', amount: 5, sourceStackId: 'batch', stack: { id: 'batch', quantity: 5, purity: 90 } }] } };
  const sh = Market.book(state, Market.offer(state, state.operators[0].id, request, route, 0), request, route, 'contract', 0).shipment;
  const advance = at => Market.advance(state, at, [route]);
  if (register) {
    expect(Identity.request(state, b, Identity.preview(state, b), 0)).toBe(true); advance(5400);
    expect(Principal.register(state, b, Principal.registrationPreview(state, b), 5400)).toBe(true); advance(10800);
  }
  return { state, b, rep, p, o, sh, request, advance };
}
function start(f, at = 10800) { expect(Principal.request(f.state, f.b, Principal.preview(f.state, f.b, f.sh), at)).toBe(true); }
function finished() { const f = fixture(); start(f); f.advance(16200); return f; }
function inquiry(f, at = 17000) {
  const r = { id: 'inquiry', sourceOrderId: 'order', reviewedRevision: 1, revisions: [{ evidence: { personObservations: [], reports: [], observation: { observerId: 'officer' } } }], reviews: [{ at, status: 'acceptedForInvestigation', elements: [] }] };
  r.investigation = { id: 'inquiry:investigation', status: 'awaitingNamedSource', interviews: [{ kind: 'officer', persons: [] }, { kind: 'examiner' }], submissions: [], corrections: [], assessments: [], notices: [{}], job: null, assessedSignature: '' };
  const gate = { id: 'gate', cityId: 'a', institutionId: 'watch', active: true, jurisdiction: 'city', criminalIntake: { active: true, cityId: 'a', referrals: [r] } };
  Investigations.provision(gate, at);
  return { gate, r, i: r.investigation, advance: at => Investigations.advance(gate, at, f.state.operators, f.state.buyers, [], f.state.identityOffices) };
}
test('new principals are separate finite people, not civic documents, receiving staff or retroactive evidence', () => {
  const f = fixture(false); expect(f.p.id).not.toBe(f.rep.id); expect(f.p.civicDocument).toBeUndefined();
  expect(f.b.buyerService.representatives).toHaveLength(1); expect(Principal.preview(f.state, f.b, f.sh)).toBeNull();
  const before = copy(f.b); Principal.provision(f.b, 100); expect(f.b).toEqual(before);
  expect(f.sh.buyerDocuments[0].authorityReference).toBeUndefined(); expect(Principal.previewEvidence(f.state, f.sh)).toBeNull();
  delete f.b.principals[0]; Principal.provision(f.b, 100); expect(Principal.principal(f.b)).toBeUndefined();
});
test('principal registration reuses real travel, document issuance and shared registry budgets', () => {
  const f = fixture(); expect(f.p.civicDocument).toBeTruthy(); expect(f.rep.civicDocument).toBeTruthy();
  expect(f.p.locationId).toBe('b'); expect(f.o.records).toHaveLength(2); expect(f.o.money).toBe(40); expect(f.o.workSeconds).toBe(10800);
  expect(f.b.money).toBe(9460); expect(f.p.availableAt).toBe(10800); expect(f.p.accountCredentials).toBeUndefined();
});
test('exact preview is inert and both consent, actual documents and finite resources gate attendance', () => {
  for (const failure of ['principal', 'representative', 'document', 'power', 'work', 'money', 'food', 'road', 'busy', 'terms', 'fee', 'expiry']) {
    const f = fixture(), q = Principal.preview(f.state, f.b, f.sh), money = f.b.money;
    expect(q.terms.shipmentReference).toBe(f.sh.id); expect(q.warning).toContain('ultimate beneficiary');
    if (failure === 'principal') f.p.authorityConsent.instruction = false;
    if (failure === 'representative') f.rep.authorityConsent.appointment = false;
    if (failure === 'document') delete f.p.civicDocument;
    if (failure === 'power') f.o.power = 0;
    if (failure === 'work') f.o.workSeconds = 0;
    if (failure === 'money') f.b.money = 0;
    if (failure === 'food') f.p.provisions = 0;
    if (failure === 'road') f.o.route.open = false;
    if (failure === 'busy') f.rep.assignment = 'other';
    if (failure === 'terms') f.sh.gross++;
    if (failure === 'fee') f.o.fee++;
    if (failure === 'expiry') f.sh.deliveryDeadlineAt = 10000;
    expect(Principal.request(f.state, f.b, q, 10800), failure).toBe(false);
    expect(f.b.authorityTrip).toBeUndefined(); expect(f.o.authorityRecords).toBeUndefined();
    if (failure !== 'money') expect(f.b.money).toBe(money);
  }
});
test('joint physical attendance, saved progress and return consume resources once without historical attribution', () => {
  const f = fixture(), old = copy(f.sh.buyerDocuments); start(f); f.advance(11700);
  expect(f.b.authorityTrip.positionKm).toBe(1); expect(f.p.locationId).toBe(f.rep.locationId); expect(Buyer.canReceive(f.b)).toBe(false);
  f.advance(13500); expect(f.b.authorityTrip.progress).toBe(900); const saved = copy(f.state);
  f.advance(16200); Market.advance(saved, 16200, [route]); expect(saved).toEqual(f.state);
  expect(f.b.authorityTrip).toBeNull(); expect(f.b.authorityDocuments[0]).toMatchObject({ at: 14400, result: 'supported', instruction: 'givenAndAccepted' });
  expect(f.p.availableAt).toBe(16200); expect(f.rep.availableAt).toBe(16200); expect(f.o).toMatchObject({ workSeconds: 9000, power: 9, money: 60 });
  expect(f.sh.buyerDocuments).toEqual(old); expect(f.sh.owner).toBe('player'); expect(JSON.stringify(f.b.authorityDocuments)).not.toContain(f.p.id);
});
test('appearance, issuer, changed instructions, consent and clerk continuity cannot be cured by attendance', () => {
  for (const failure of ['appearance', 'obscured', 'issuer', 'consent', 'clerk', 'terms', 'cancelled']) {
    const f = fixture(); start(f); f.advance(13500);
    if (failure === 'appearance') f.p.appearance.face = 'different';
    if (failure === 'obscured') f.b.authorityTrip.visibility = 'obscured';
    if (failure === 'issuer') f.o.records[1].status = 'withdrawn';
    if (failure === 'consent') f.rep.authorityConsent.instruction = false;
    if (failure === 'clerk') f.o.clerk.id = 'replacement';
    if (failure === 'terms') f.sh.gross++;
    if (failure === 'cancelled') Market.cancel(f.state, f.sh.id, 13500);
    f.advance(16200); expect(f.b.authorityDocuments[0].result, failure).toBe('unverified'); expect(f.b.authorityTrip).toBeNull();
  }
});
test('outages release the shared clerk, pause without retroactive work and do not charge twice', () => {
  const f = fixture(); start(f); f.advance(13500); f.o.channelPowered = false; f.advance(15000);
  expect(f.o.assignment).toBeNull(); f.o.channelPowered = true; f.advance(18000); expect(f.b.authorityTrip.progress).toBe(900);
  f.advance(20700); expect(f.b.authorityTrip).toBeNull(); expect(f.b.authorityDocuments).toHaveLength(1); expect(f.o.money).toBe(60);
});
test('cancellation walks back from the real position and retains a fee already paid', () => {
  for (const at of [10800, 11700, 13500]) {
    const f = fixture(); start(f); f.advance(at); const position = f.b.authorityTrip.positionKm, money = f.b.money;
    expect(Principal.cancel(f.state, f.b, at)).toBe(true); expect(f.b.authorityTrip.positionKm).toBe(position);
    f.advance(at + 1801); expect(f.b.authorityTrip).toBeNull(); expect(f.b.money).toBe(money); expect(f.b.authorityDocuments).toBeUndefined();
  }
});
test('new acknowledgment takes real work and cites only the exact prospective instruction', () => {
  const f = finished(), old = copy(f.sh.buyerDocuments);
  expect(Principal.acknowledge(f.state, f.b, f.sh, 16200)).toBe(true); expect(f.sh.buyerDocuments).toEqual(old);
  f.advance(16230); expect(f.b.authorityActionJob.progress).toBe(30); expect(Buyer.canReceive(f.b)).toBe(false);
  const saved = copy(f.state); f.advance(16260); Market.advance(saved, 16260, [route]); expect(saved).toEqual(f.state);
  expect(f.sh.buyerDocuments.at(-1)).toMatchObject({ kind: 'authorityTermsAcknowledged', at: 16260, authorityReference: f.b.authorityDocuments[0].id });
  expect(f.sh.buyerDocuments[0]).toEqual(old[0]); expect(Principal.acknowledge(f.state, f.b, f.sh, 16260)).toBe(false);
  expect(f.b.buyerService).toMatchObject({ workSeconds: 7140, power: 5 });
});
test('real handoff can cite authority but unrelated consignments, replacements and changed terms cannot', () => {
  const f = finished(); Market.markCollected(f.state, f.sh.id, f.request.manifest, 'courier', 16300); Market.receiveDepot(f.state, f.sh.id, f.request.manifest, 16400);
  f.advance(16400); f.advance(23600);
  expect(f.sh.buyerDocuments.find(d => d.kind === 'deliveryReceived').authorityReference).toBe(f.b.authorityDocuments[0].id);
  for (const change of ['consignment', 'person', 'terms', 'expiry']) {
    const g = finished(); g.sh.receiptAt = 17000; g.sh.owner = g.b.id;
    if (change === 'consignment') g.sh.id = 'unrelated'; if (change === 'person') g.rep.id = 'replacement';
    if (change === 'terms') g.sh.bookedQuantity++; if (change === 'expiry') g.sh.deliveryDeadlineAt = 16999;
    expect(Principal.action(g.state, g.b, g.sh, g.rep, 'receiveSpecifiedConsignment', 17000)).toBe(false);
  }
});
test('physical revocation communicates a dated stop without erasing original instructions or acknowledgments', () => {
  const f = finished(), original = copy(f.b.authorityDocuments[0]); Principal.acknowledge(f.state, f.b, f.sh, 16200); f.advance(16260);
  const q = Principal.preview(f.state, f.b, f.sh, 'revoke', original.id); expect(Principal.request(f.state, f.b, q, 16300)).toBe(true); f.advance(21700);
  expect(f.b.authorityDocuments[0]).toEqual(original); expect(f.b.authorityDocuments[1]).toMatchObject({ instruction: 'revokedAndCommunicated', at: 19900 });
  expect(f.sh.buyerDocuments.at(-1).at).toBe(16260); f.sh.owner = f.b.id; f.sh.receiptAt = 21800;
  expect(Principal.action(f.state, f.b, f.sh, f.rep, 'receiveSpecifiedConsignment', 21800)).toBe(false);
});
test('withheld customer copies remain withheld and internal buyer IDs do not disclose a principal', () => {
  const f = fixture(); f.p.authorityConsent.customerCopy = false; start(f); f.advance(16200);
  expect(f.o.authorityRecords).toHaveLength(1); expect(f.b.authorityDocuments).toBeUndefined(); f.p.authorityConsent.customerCopy = true; f.advance(20000);
  expect(Principal.previewEvidence(f.state, f.sh)).toBeNull(); const g = finished(); expect(Principal.previewEvidence(g.state, { buyerId: g.b.id })).toBeNull();
});
test('selected issuer verification preserves source limits, independent consent and separate actor roles', () => {
  const f = finished(), q = inquiry(f), d = Principal.previewEvidence(f.state, f.sh);
  expect(Investigations.submit(q.gate, q.r, d, 17000)).toBe(true); q.advance(17000); q.advance(20600);
  expect(q.i.principalResponses[0].comparisons[0].result).toBe('matchesWitnessedInstruction');
  const assessment = q.i.assessments.at(-1); expect(assessment.principalFindings[0].jurisdiction).toContain('foreign');
  expect(assessment.actors.filter(a => a.id.startsWith(d.records[0].id))).toHaveLength(2);
  expect(assessment.actors.every(a => a.knowledge.includes('not established'))).toBe(true); expect(JSON.stringify(q.i)).not.toContain(f.p.id);
});
test('altered copies, refusal and replacement people supply no substitute evidence or guilt', () => {
  for (const failure of ['altered', 'principal', 'representative', 'office', 'missing', 'replacement']) {
    const f = finished(), q = inquiry(f), d = Principal.previewEvidence(f.state, f.sh);
    if (failure === 'altered') d.records[0].terms.price++;
    if (failure === 'principal') f.p.authorityConsent.release = false;
    if (failure === 'representative') f.rep.authorityConsent.release = false;
    if (failure === 'office') f.o.authorityReleaseConsent = false;
    if (failure === 'missing') f.o.authorityRecords = [];
    if (failure === 'replacement') f.p.id = 'replacement';
    Investigations.submit(q.gate, q.r, d, 17000); q.advance(17000); q.advance(20600);
    if (failure === 'replacement') expect(q.i.status).toBe('paused');
    else expect(q.i.principalResponses[0].comparisons[0].receipt, failure).toBeNull();
  }
});
test('issuer corrections append a finite status check and require new disclosure to change an assessment', () => {
  const f = finished(), q = inquiry(f), d = Principal.previewEvidence(f.state, f.sh);
  Investigations.submit(q.gate, q.r, d, 17000); q.advance(17000); q.advance(20600); const old = copy(q.i.assessments[0]);
  expect(Principal.withdraw(f.o, d.records[0].id, 'Unreliable observation', 21000)).toBe(true);
  expect(Principal.recheck(f.state, f.b, d.records[0].id, 21000)).toBe(true); f.advance(21600);
  expect(f.b.authorityDocuments.at(-1).originalSupport).toBe('withdrawn'); expect(q.i.assessments).toEqual([old]);
  Investigations.submit(q.gate, q.r, Principal.previewEvidence(f.state, f.sh), 21600); q.advance(21600); q.advance(25200);
  expect(q.i.assessments.at(-1).actors.find(a => a.id === `${d.records[0].id}:principal`).identity).toContain('withdrawn'); expect(q.i.assessments[0]).toEqual(old);
});
test('individual buyers can perform both roles only through the same explicit witnessed procedure', () => {
  const f = fixture(false); delete f.b.principalSetupAt; f.b.principals = []; Principal.provision(f.b, 0, true);
  Identity.request(f.state, f.b, Identity.preview(f.state, f.b), 0); f.advance(5400);
  expect(Principal.registrationPreview(f.state, f.b)).toBeNull();
  expect(Principal.request(f.state, f.b, Principal.preview(f.state, f.b, f.sh), 5400)).toBe(true); f.advance(10800);
  expect(f.b.authorityDocuments[0].principal.document).toEqual(f.b.authorityDocuments[0].representative.document);
  expect(f.b.authorityDocuments[0].instruction).toBe('givenAndAccepted'); expect(f.rep.provisions).toBeCloseTo(2 - 10800 / 28800);
  expect(f.b.authorityDocuments[0].sameAttendee).toBe(true);
  const q = inquiry(f); Investigations.submit(q.gate, q.r, Principal.previewEvidence(f.state, f.sh), 17000); q.advance(17000); q.advance(20600);
  expect(q.i.assessments.at(-1).actors.filter(a => a.id.startsWith(f.b.authorityDocuments[0].id))).toHaveLength(1);
});
test('withdrawn presentation before arrival never fabricates a presented document', () => {
  const f = fixture(); start(f); f.p.civicPreferences.presentationConsent = false; f.advance(16200);
  expect(f.b.authorityDocuments[0]).toMatchObject({ result: 'unverified', principal: { document: null, issuerResult: 'notPresented' } });
});
test('death and replacement cannot inherit a reserved visit; cancellation retains physical location', () => {
  const f = fixture(); start(f); f.advance(13500); f.p.status = 'dead'; f.advance(18000);
  expect(f.o.assignment).toBeNull(); expect(f.b.authorityDocuments).toBeUndefined();
  f.b.principals = [{ ...copy(f.p), id: 'replacement', status: 'alive' }]; f.advance(24000);
  expect(f.b.authorityDocuments).toBeUndefined(); expect(f.rep.locationId).toBe(f.o.id);
});
test('acknowledgment pauses shared work during outages and rejects expired or cancelled instructions', () => {
  const f = finished(); Principal.acknowledge(f.state, f.b, f.sh, 16200); f.advance(16230);
  f.b.buyerService.channelPowered = false; f.advance(17000); expect(f.b.buyerService.assignment).toBeNull();
  f.b.buyerService.channelPowered = true; f.advance(18000); expect(f.b.authorityActionJob.progress).toBe(30);
  f.advance(18030); expect(f.sh.buyerDocuments.at(-1).at).toBe(18030); expect(f.b.buyerService.power).toBe(5);
  const g = finished(); Principal.acknowledge(g.state, g.b, g.sh, 16200); Market.cancel(g.state, g.sh.id, 16210); g.advance(16260);
  expect(g.sh.buyerDocuments.some(d => d.kind === 'authorityTermsAcknowledged')).toBe(false); expect(g.rep.assignment).toBeNull();
});
test('status checks use original dates and persist paused work without duplicating power or deleting history', () => {
  const f = finished(), original = copy(f.b.authorityDocuments[0]);
  for (const r of f.o.records) { r.document.expiresAt = 15000; }
  // A changed source document is a contradiction, not ordinary later expiry.
  expect(Principal.recheck(f.state, f.b, original.id, 17000)).toBe(true); f.advance(17300);
  f.o.channelPowered = false; f.advance(18000); expect(f.o.assignment).toBeNull();
  f.o.channelPowered = true; f.advance(19000); expect(f.o.authorityRecords[0].job.progress).toBe(300);
  const saved = copy(f.state); f.advance(19300); Market.advance(saved, 19300, [route]); expect(saved).toEqual(f.state);
  expect(f.b.authorityDocuments[0]).toEqual(original); expect(f.b.authorityDocuments[1].originalSupport).toBe('withdrawn'); expect(f.o.power).toBe(8);
});
test('scoped release decisions stay fixed and investigative pauses release the shared clerk', () => {
  const f = finished(), q = inquiry(f), d = Principal.previewEvidence(f.state, f.sh); f.p.authorityConsent.release = false;
  Investigations.submit(q.gate, q.r, d, 17000); q.advance(17000); f.p.authorityConsent.release = true;
  q.gate.investigationOffice.channelPowered = false; q.advance(18000); expect(f.o.assignment).toBeNull();
  q.gate.investigationOffice.channelPowered = true; q.advance(19000); expect(q.i.job.progress).toBe(0); q.advance(22600);
  expect(q.i.principalResponses[0].comparisons[0].result).toBe('notReleased');
});
test('ordinary later document expiry does not invalidate an earlier witnessed instruction', () => {
  const f = fixture();
  for (const p of [f.p, f.rep]) { p.civicDocument.expiresAt = 20000; f.o.records.find(r => r.document.number === p.civicDocument.number).document.expiresAt = 20000; }
  start(f); f.advance(16200); const original = copy(f.b.authorityDocuments[0]); expect(original.result).toBe('supported');
  expect(Principal.recheck(f.state, f.b, original.id, 21000)).toBe(true); f.advance(21600);
  expect(f.b.authorityDocuments.at(-1).originalSupport).toBe('retained'); expect(f.b.authorityDocuments[0]).toEqual(original);
});
