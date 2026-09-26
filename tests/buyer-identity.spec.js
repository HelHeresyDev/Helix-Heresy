const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const Identity = require('../buyer-identity');
const Buyer = require('../buyer-corroboration');
const Carrier = require('../carrier-corroboration');
const Investigations = require('../cargo-investigations');
const Gates = require('../smuggling-checkpoints');
const Review = require('../cargo-property-review');
const copy = v => JSON.parse(JSON.stringify(v));
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Identity.provision(state, { institutionId: 'registry:b', cityId: 'b', name: 'Destination Registry', active: true, localDistanceKm: 2 }, 0);
  const buyer = state.buyers[0], op = state.operators[0], person = buyer.buyerService.representatives[0], office = state.identityOffices[0];
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', section: 'chemicalBatches', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', phase: 'liquid', productId: 'unlicensedMutagenicPrimer', purity: 90, label: 'Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const f = { state, buyer, op, person, office, manifest, advance: at => Market.advance(state, at, [route]) };
  f.book = (at = 6000) => {
    const quote = Market.offer(state, op.id, request, route, at); expect(quote.ok).toBe(true);
    f.sh = Market.book(state, quote, request, route, 'private-contract', at).shipment;
    Market.markCollected(state, f.sh.id, manifest, 'collector', at); Market.receiveDepot(state, f.sh.id, manifest, at); f.advance(at);
    return f.sh;
  };
  return f;
}
function register(f) {
  expect(Identity.request(f.state, f.buyer, Identity.preview(f.state, f.buyer), 0)).toBe(true); f.advance(5400);
  expect(f.buyer.identityTrip).toBeNull(); expect(f.person.civicDocument).toBeTruthy();
}
function delivered() { const f = fixture(); register(f); f.book(); Identity.requestCheck(f.sh); f.advance(14000); expect(f.sh.receiptAt).toBe(10200); return f; }
test('buyer-funded walking visit reserves the actual person, pays once and survives reload', () => {
  const f = fixture(), q = Identity.preview(f.state, f.buyer);
  expect(f.person.civicDocument).toBeUndefined(); expect(f.buyer.money).toBe(10000);
  expect(Identity.request(f.state, f.buyer, q, 0)).toBe(true); f.advance(900);
  expect(f.buyer.identityTrip.positionKm).toBe(1); expect(Buyer.canReceive(f.buyer)).toBe(false);
  f.advance(1800); expect(f.person.locationId).toBe(f.office.id); f.advance(2700);
  const saved = copy(f.state); f.advance(5400); Market.advance(saved, 5400, [route]); expect(saved).toEqual(f.state);
  expect(f.person.civicDocument.issuedAt).toBe(3600); expect(f.person.locationId).toBe('b'); expect(f.person.availableAt).toBe(5400);
  expect(f.buyer.money).toBe(9980); expect(f.office.money).toBe(20); expect(f.office.workSeconds).toBe(12600);
  expect(f.person.provisions).toBeCloseTo(2 - 5400 / 28800); expect(f.person.fatigue).toBe(4);
  expect(Buyer.canReceive(f.buyer)).toBe(true); expect(f.office.records[0]).not.toHaveProperty('personId');
});
test('registration requires real local access, separate consent and unchanged terms', () => {
  for (const failure of ['office', 'consent', 'funds', 'food', 'busy', 'fee', 'work', 'power']) {
    const f = fixture(), q = Identity.preview(f.state, f.buyer);
    if (failure === 'office') f.office.active = false;
    if (failure === 'consent') f.person.civicPreferences.registrationConsent = false;
    if (failure === 'funds') f.buyer.money = 0;
    if (failure === 'food') f.person.provisions = 0;
    if (failure === 'busy') f.person.assignment = 'other';
    if (failure === 'fee') f.office.fee++;
    if (failure === 'work') f.office.workSeconds = 0;
    if (failure === 'power') f.office.power = 0;
    expect(Identity.request(f.state, f.buyer, q, 0)).toBe(false); expect(f.office.records).toEqual([]);
  }
  const f = fixture(); Identity.provision(f.state, { institutionId: 'not-local', cityId: 'c', active: true, localDistanceKm: 2 }, 0);
  expect(f.state.identityOffices).toHaveLength(1);
});
test('office and road outages pause physical attendance with no retroactive clerk work', () => {
  const f = fixture(); Identity.request(f.state, f.buyer, Identity.preview(f.state, f.buyer), 0); f.advance(900);
  f.office.route.open = false; f.advance(5000); expect(f.buyer.identityTrip.positionKm).toBe(1);
  f.office.route.open = true; f.advance(6000); expect(f.buyer.identityTrip.positionKm).toBe(1); f.advance(7500);
  const progress = f.buyer.identityTrip.progress; f.office.channelPowered = false; f.advance(8000); expect(f.office.assignment).toBeNull();
  f.office.channelPowered = true; f.advance(18000); expect(f.buyer.identityTrip.progress).toBe(progress);
  f.advance(22000); expect(f.buyer.identityTrip).toBeNull(); expect(f.office.money).toBe(20);
});
test('physical receiver identification and completed acceptance are separate source records', () => {
  const f = delivered(), [check, handoff] = f.sh.recipientDocuments;
  expect(check).toMatchObject({ result: 'supported', issuerResult: 'confirmed', appearance: 'consistent', presentedAt: 9600, at: 10200 });
  expect(handoff).toMatchObject({ kind: 'recipientHandoff', accepted: true, observationId: check.observationId, at: 10200 });
  expect(f.sh.owner).toBe(f.buyer.id); expect(f.op.carrierService.workSeconds).toBe(6600);
  expect(f.office.workSeconds).toBe(12000); expect(f.office.power).toBe(10);
  const evidence = JSON.stringify(Identity.previewEvidence(f.sh));
  expect(evidence).not.toContain(f.person.id); expect(evidence).not.toContain(f.op.crew[0].id);
  expect(Carrier.preview(f.sh).records.some(r => r.kind === 'recipientIdentity')).toBe(false);
  const saved = copy(f.state); f.advance(20000); Market.advance(saved, 20000, [route]); expect(saved).toEqual(f.state);
});
test('presentation and verification refusals do not invalidate willing delivery', () => {
  for (const pref of ['presentationConsent', 'verificationConsent']) {
    const f = fixture(); register(f); f.person.civicPreferences[pref] = false; f.book(); Identity.requestCheck(f.sh); f.advance(14000);
    expect(f.sh.receiptAt).toBe(9600); expect(f.sh.owner).toBe(f.buyer.id); expect(f.sh.recipientDocuments[0].result).not.toBe('supported');
    expect(f.office.workSeconds).toBe(12600); expect(f.sh.recipientDocuments[1].accepted).toBe(true);
  }
});
test('identity can be supported while the identified representative declines the cargo', () => {
  const f = fixture(); register(f); f.person.receiptConsent = false; f.book(); Identity.requestCheck(f.sh); f.advance(14000);
  expect(f.sh.recipientDocuments[0].result).toBe('supported'); expect(f.sh.recipientDocuments[1].accepted).toBe(false);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.owner).toBe('player'); expect(f.sh.phase).toBe('returned');
  expect(f.sh.playerEscrow).toBe(0); expect(f.sh.freightEscrow).toBe(0);
  expect(f.buyer.buyerService.records.some(r => r.document.kind === 'deliveryReceived')).toBe(false);
});
test('issuer confirmation cannot cure mismatch or ambiguity; failed issuer checks have a fixed bound', () => {
  for (const failure of ['mismatch', 'ambiguous', 'offline', 'work', 'busy', 'expired', 'forged']) {
    const f = fixture(); register(f);
    if (failure === 'mismatch') f.person.appearance.face = 'different';
    if (failure === 'ambiguous') f.op.recipientVisibility = 'obscured';
    if (failure === 'offline') f.office.channelPowered = false;
    if (failure === 'work') f.office.workSeconds = 0;
    if (failure === 'busy') f.office.assignment = 'another-visitor';
    if (failure === 'expired') { f.person.civicDocument.expiresAt = 8000; f.office.records[0].document.expiresAt = 8000; }
    if (failure === 'forged') f.person.civicDocument.registeredName = 'Impostor';
    f.book(); Identity.requestCheck(f.sh); f.advance(14000);
    const c = f.sh.recipientDocuments[0]; expect(c.result).not.toBe('supported'); expect(f.sh.receiptAt).toBe(10200);
    if (['mismatch', 'ambiguous'].includes(failure)) { expect(c.issuerResult).toBe('confirmed'); expect(c.appearance).toBe(failure); }
    if (failure === 'expired') expect(c.issuerResult).toBe('expired');
    if (failure === 'busy') expect(f.office.assignment).toBe('another-visitor');
  }
});
test('failed or absent-receiver journeys cannot invent an identified recipient or past handoff', () => {
  const f = fixture(); register(f); f.book(); Identity.requestCheck(f.sh); f.sh.returnRequestedAt = 6200; f.advance(14000);
  expect(f.sh.recipientEncounter).toBeUndefined(); expect(Identity.previewEvidence(f.sh)).toBeNull();
  const g = fixture(); register(g); g.person.locationId = 'elsewhere'; g.book(); Identity.requestCheck(g.sh); g.advance(14000);
  expect(g.sh.receiptAt).toBeNull(); expect(g.sh.recipientEncounter).toBeUndefined();
  expect(Identity.requestCheck({ living: {}, receiptAt: null })).toBe(false);
});
test('gate detention and a failed inspected sale do not create a destination receiver observation', () => {
  const f = fixture(); register(f);
  f.manifest.entries[0].stack.chemicalBatch.label = 'Unlicensed Mutagenic Primer';
  Gates.bind(f.state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  Review.publish(f.state.checkpoints[0], { legalStatus: 'restricted' }, { institutionId: 'court' }, 5400);
  f.book(); Identity.requestCheck(f.sh); f.advance(25000);
  expect(f.sh.recipientEncounter).toBeUndefined(); expect(f.sh.receiptAt).toBeNull();
  f.advance(110000); expect(f.sh.saleFailedAt).not.toBeNull(); expect(f.sh.phase).toBe('returned');
  expect(Identity.previewEvidence(f.sh)).toBeNull(); expect(f.person.assignment).toBeNull();
});
test('partial receiver verification survives reload without duplicated work or handoff', () => {
  const f = fixture(); register(f); f.book(); Identity.requestCheck(f.sh); f.advance(9900);
  expect(f.sh.recipientEncounter.job.progress).toBeGreaterThan(0); expect(f.sh.recipientDocuments).toBeUndefined();
  const saved = copy(f.state); f.advance(14000); Market.advance(saved, 14000, [route]); expect(saved).toEqual(f.state);
  expect(f.sh.recipientDocuments).toHaveLength(2); expect(f.office.workSeconds).toBe(12000); expect(f.op.carrierService.workSeconds).toBe(6600);
});
test('arrival before a same-update registration return never backdates the handoff', () => {
  const f = fixture(); Identity.request(f.state, f.buyer, Identity.preview(f.state, f.buyer), 0); f.book(0); Identity.requestCheck(f.sh); f.advance(10000);
  expect(f.person.availableAt).toBe(5400); expect(f.sh.receiptAt).toBeNull(); expect(f.sh.recipientEncounter).toBeUndefined();
  f.advance(11000); expect(f.sh.recipientDocuments[0].presentedAt).toBe(10000); expect(f.sh.receiptAt).toBe(10600);
});
test('replacement receivers do not inherit the prior identity observation', () => {
  const f = fixture(); register(f); f.book(); Identity.requestCheck(f.sh); f.advance(9700);
  f.person.locationId = 'elsewhere';
  const replacement = { ...copy(f.person), id: 'new-person', name: 'Replacement', locationId: 'b', assignment: null }; delete replacement.civicDocument;
  f.buyer.buyerService.representatives.push(replacement); f.advance(14000);
  const [check, handoff] = f.sh.recipientDocuments;
  expect(check.result).toBe('unavailable'); expect(handoff.observationId).not.toBe(check.observationId); expect(handoff.accepted).toBe(true);
  expect(f.buyer.buyerService.records.find(r => r.document.kind === 'deliveryReceived').observerId).toBe(replacement.id);
});
test('the exact check boundary completes paid work, and incapacitation cannot strand the receiver', () => {
  const f = fixture(); register(f); f.book(); Identity.requestCheck(f.sh); f.advance(10200);
  expect(f.sh.recipientDocuments[0].result).toBe('supported'); expect(f.sh.receiptAt).toBeNull();
  f.advance(10201); expect(f.sh.receiptAt).toBe(10200); expect(f.sh.recipientDocuments[1].observationId).toBe(f.sh.recipientDocuments[0].observationId);
  const g = fixture(); register(g); g.book(); Identity.requestCheck(g.sh); g.advance(9700);
  g.op.crew[0].health = 0; g.advance(10200);
  expect(g.person.assignment).toBeNull(); expect(g.sh.recipientEncounter.job).toBeNull(); expect(g.sh.recipientDocuments[0].result).toBe('unavailable');
  expect(g.sh.receiptAt).toBeNull(); expect(g.sh.owner).toBe('player');
});
test('customer-copy consent and channel failures retain private reports without automatic later disclosure', () => {
  for (const failure of ['consent', 'channel']) {
    const f = fixture(); register(f); if (failure === 'consent') f.person.identityDisclosureConsent = false; else f.op.carrierService.channelPowered = false;
    f.book(); Identity.requestCheck(f.sh); f.advance(14000);
    expect(f.op.carrierService.recipientRecords).toHaveLength(2); expect(Identity.previewEvidence(f.sh)).toBeNull();
    f.person.identityDisclosureConsent = true; f.op.carrierService.channelPowered = true; f.advance(20000); expect(Identity.previewEvidence(f.sh)).toBeNull();
  }
});
test('corrections recheck the frozen document, preserve title and require new disclosure', () => {
  const f = delivered(), original = copy(f.sh.recipientDocuments), owner = f.sh.owner, receipt = f.sh.receiptAt;
  f.office.records[0].status = 'withdrawn'; expect(Identity.recheck(f.state, f.sh, 14000)).toBe(true);
  expect(f.op.carrierService.assignment).toBeTruthy(); const saved = copy(f.state); f.advance(14600); Market.advance(saved, 14600, [route]); expect(saved).toEqual(f.state);
  expect(f.sh.recipientDocuments.slice(0, 2)).toEqual(original); expect(f.sh.recipientDocuments[2]).toMatchObject({ result: 'mismatch', issuerResult: 'withdrawn', supersedes: original[0].id });
  expect(f.sh.owner).toBe(owner); expect(f.sh.receiptAt).toBe(receipt); expect(f.sh.recipientDocuments.filter(d => d.kind === 'recipientHandoff')).toHaveLength(1);
  f.op.crew = [{ id: 'replacement-driver', status: 'alive', health: 100, fatigue: 0 }]; expect(Identity.recheck(f.state, f.sh, 15000)).toBe(false);
});
test('source matching is voluntary and reveals neither private identities nor mismatched replacement records', () => {
  const f = delivered(), document = Identity.previewEvidence(f.sh), i = { submissions: [], notices: [] }, submission = { id: 'submission', document };
  i.submissions.push(submission); let ctx = Identity.prepare(f.state.operators, i, submission, 'recipientRecords', 14000);
  expect(ctx.choice.decision).toBe('refused'); Identity.complete(i, submission, 'recipientRecords', ctx, 15800);
  expect(Identity.findings(i, 'b')[0].events).toEqual([]);
  f.op.carrierService.policy = 'recordsOnly'; const other = { submissions: [submission] }; document.records[0].document.registeredName = 'FORGED';
  ctx = Identity.prepare(f.state.operators, other, submission, 'recipientRecords', 14000); Identity.complete(other, submission, 'recipientRecords', ctx, 15800);
  const finding = Identity.findings(other, 'b')[0]; expect(finding.comparisons[0].result).toBe('contradicted'); expect(finding.events).toHaveLength(1);
  expect(JSON.stringify(finding)).not.toContain(f.person.name); expect(JSON.stringify(finding)).not.toContain(f.person.id);
});
test('investigation consumes disclosed recipient copies through finite work and withdraws corrected attribution', () => {
  const f = delivered(); f.op.carrierService.policy = 'recordsOnly';
  // A bounded existing inquiry: source evidence is supplied voluntarily, not extracted from shipment internals.
  const r = { id: 'inquiry', sourceOrderId: 'order', reviewedRevision: 1, revisions: [{ evidence: { personObservations: [], reports: [], observation: { observerId: 'officer' } } }], reviews: [{ at: 14000, status: 'acceptedForInvestigation', elements: [] }] };
  r.investigation = { id: 'inquiry:investigation', status: 'awaitingNamedSource', interviews: [{ kind: 'officer', persons: [] }, { kind: 'examiner' }], submissions: [], corrections: [], assessments: [], notices: [{}], job: null, assessedSignature: '' };
  const gate = { id: 'gate', cityId: 'b', institutionId: 'watch', active: true, jurisdiction: 'city', criminalIntake: { active: true, cityId: 'b', referrals: [r] } };
  Investigations.provision(gate, 14000); const i = r.investigation;
  expect(Investigations.submit(gate, r, Investigations.preview('recipient', f.sh), 14000)).toBe(true);
  Investigations.advance(gate, 14000, f.state.operators); Investigations.advance(gate, 17600, f.state.operators);
  expect(i.assessments.at(-1).actors.find(a => a.id === f.sh.recipientEncounter.id).identity).toContain('Registered identity');
  expect(gate.investigationOffice.workSeconds).toBe(10800); expect(f.op.carrierService.workSeconds).toBe(4800);
  const old = copy(i.assessments.at(-1)); f.office.records[0].status = 'withdrawn'; Identity.recheck(f.state, f.sh, 18000); f.advance(18600);
  Investigations.advance(gate, 18600, f.state.operators); expect(i.assessments.at(-1)).toEqual(old);
  Investigations.submit(gate, r, Investigations.preview('recipient', f.sh), 18600);
  Investigations.advance(gate, 18600, f.state.operators); Investigations.advance(gate, 22200, f.state.operators);
  const actor = i.assessments.at(-1).actors.find(a => a.id === f.sh.recipientEncounter.id);
  expect(actor.identity).toContain('withdrawn'); expect(actor.conduct).toContain('accepting'); expect(actor.knowledge).toBe('not established');
  expect(i.assessments[0]).toEqual(old); expect(JSON.stringify(i)).not.toContain(f.person.id);
});
