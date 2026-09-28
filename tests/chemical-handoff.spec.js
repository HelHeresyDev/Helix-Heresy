const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const Chemical = require('../chemical-handoff');
const Recipient = require('../buyer-identity');
const Charging = require('../cargo-charging');
const Court = require('../cargo-judicial-review');
const Referrals = require('../cargo-criminal-referrals');
const Gates = require('../smuggling-checkpoints');
const Property = require('../cargo-property-review');
const copy = x => JSON.parse(JSON.stringify(x));
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  const op = state.operators[0], buyer = state.buyers[0], person = buyer.buyerService.representatives[0];
  const manifest = { commodityKind: 'manufactured', material: 'Unlicensed Mutagenic Primer', amount: .95,
    entries: [{ amount: .95, stack: { id: 'lot', section: 'chemicalBatches', quantity: .95, knownQuantity: .95,
      chemicalBatch: { id: 'batch', productId: 'unlicensedMutagenicPrimer', purity: 90, phase: 'liquid', label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const q = Market.offer(state, op.id, request, route, 200), sh = Market.book(state, q, request, route, 'contract', 200).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 200); Market.receiveDepot(state, sh.id, manifest, 200);
  return { state, op, buyer, person, sh, advance: at => Market.advance(state, at, [route]) };
}
function offer(f) { expect(Chemical.request(f.sh, Chemical.preview(f.sh))).toBe(true); f.advance(200); }
function source(f) {
  f.op.carrierService.policy = 'recordsOnly';
  const s = { id: 'submission', document: Recipient.previewEvidence(f.sh) }, i = { submissions: [s] };
  const ctx = Recipient.prepare(f.state.operators, i, s, 'recipientRecords', 12000);
  Recipient.complete(i, s, 'recipientRecords', ctx, 13800); return Recipient.findings(i, 'b');
}
function evidence() {
  const sample = { id: 'sample', quantity: .05, sourceStackId: 'lot', sourceBatchId: 'batch', locationId: 'gate', sealId: 'seal', examinerId: 'examiner', labId: 'lab', status: 'consumedByAssay',
    custody: [{ at: 80, action: 'drawnAndSealed', from: 'lot', custodian: 'examiner', sealId: 'seal' }, { at: 100, action: 'consumedByAssay', custodian: 'lab' }],
    representation: { method: 'mixedSingleLiquidBatchAliquot', at: 80, stackId: 'lot', batchId: 'batch', quantity: 1 } };
  const report = { id: 'assay', at: 100, sampleId: 'sample', sourceStackId: 'lot', sourceBatchId: 'batch', locationId: 'gate', institutionId: 'court', supported: true,
    chainIntact: true, method: 'sealedSampleConfirmatoryAssay', result: 'targetDetected', quality: { skill: 80, calibration: 80 } };
  return { cityId: 'b', arrivedAt: 0, productId: 'unlicensedMutagenicPrimer', personObservations: [], reports: [report], samples: [sample],
    law: { id: 'law', sourceLawId: 'code', cityId: 'b', offenseId: 'contrabandCommerce', active: true, publishedAt: 0, effectiveAt: 0,
      products: ['unlicensedMutagenicPrimer'], elements: ['transaction', 'contraband', 'knowledge'].map(id => ({ id })) },
    observation: { at: 100, stackId: 'lot', gateId: 'gate', observerId: 'watch' }, observations: [{ at: 100, observerId: 'watch', locationId: 'gate', entryIds: ['lot'] }],
    examinationAuthority: { scope: 'chemicalIdentification', cityId: 'b', stackId: 'lot', batchId: 'batch', institutionId: 'court', issuedAt: 0, expiresAt: 1000 },
    authorization: { checked: true, covering: [] } };
}
test('preview is exact, optional and contains no private chemistry or receiver policy', () => {
  const f = fixture(), q = Chemical.preview(f.sh);
  expect(q.items[0].label).toBe('Unlicensed Mutagenic Primer');
  expect(JSON.stringify(q)).not.toContain('purity'); expect(JSON.stringify(q)).not.toContain('requireVerification');
  q.items[0].label = 'Different'; expect(Chemical.request(f.sh, q)).toBe(false);
  expect(f.sh.chemicalDisclosure).toBeUndefined();
});
test('disclosure precedes actual handoff, consumes real work, survives reload and does not prove chemistry', () => {
  const f = fixture(); offer(f); f.advance(4100);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.chemicalHandoff.progress).toBeLessThan(600);
  const restored = copy(f.state); f.advance(12000); Market.advance(restored, 12000, [route]); expect(restored).toEqual(f.state);
  expect(f.sh.receiptAt).toBe(4400); expect(f.op.carrierService.workSeconds).toBe(6600);
  expect(f.sh.recipientDocuments.map(d => d.kind)).toEqual(['chemicalDisclosure', 'recipientHandoff']);
  const a = { recipientFindings: source(f) }, actorId = f.sh.chemicalHandoff.observationId;
  expect(Chemical.proof(evidence(), a, actorId)).toMatchObject({ transaction: [f.sh.recipientDocuments[1].id], knowledge: [] });
  expect(JSON.stringify(f.sh.recipientDocuments)).not.toContain(f.person.id);
});
test('receiver requests missing verification and refuses without invented tests or lost refunds', () => {
  const f = fixture(); f.person.chemicalPreferences.requireVerification = true; const reservedMoney = f.buyer.money;
  offer(f); f.advance(12000);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.owner).toBe('player'); expect(f.sh.phase).toBe('returned');
  expect(f.sh.recipientDocuments[0]).toMatchObject({ response: 'verificationRequested', verificationRequested: true });
  expect(f.sh.recipientDocuments[1].accepted).toBe(false); expect(f.sh.examination).toBeUndefined(); expect(f.buyer.money).toBeGreaterThan(reservedMoney);
});
test('changed declarations and independent receiver refusals prevent acceptance', () => {
  for (const defect of ['label', 'quantity', 'policy', 'authorization']) {
    const f = fixture(); offer(f);
    if (defect === 'label') f.sh.manifest.entries[0].stack.chemicalBatch.label = 'Different';
    if (defect === 'quantity') f.sh.manifest.entries[0].amount = .5;
    if (defect === 'policy') f.person.chemicalPreferences.refuseDeclaredProducts = ['unlicensedMutagenicPrimer'];
    if (defect === 'authorization') f.person.chemicalPreferences.requireAuthorization = true;
    f.advance(12000); expect(f.sh.receiptAt, defect).toBeNull(); expect(f.sh.recipientDocuments[1].accepted).toBe(false);
  }
});
test('outages do not produce free work and expiry releases the exact participants', () => {
  const f = fixture(); offer(f); f.advance(3900); f.op.carrierService.workSeconds = 0;
  f.advance(4500); const progress = f.sh.chemicalHandoff.progress;
  f.op.carrierService.workSeconds = 500; f.advance(4501); expect(f.sh.chemicalHandoff.progress).toBe(progress);
  f.sh.deliveryDeadlineAt = 4600; f.advance(10000);
  expect(f.person.assignment).toBeNull(); expect(f.op.carrierService.assignment).toBeNull(); expect(f.sh.receiptAt).toBeNull();
});
test('customer and source consent remain separate; copies are not backfilled', () => {
  const f = fixture(); f.person.identityDisclosureConsent = false; offer(f); f.advance(12000);
  expect(f.op.carrierService.recipientRecords).toHaveLength(2); expect(f.sh.recipientDocuments).toBeUndefined();
  f.person.identityDisclosureConsent = true; f.advance(15000); expect(Recipient.previewEvidence(f.sh)).toBeNull();
});
test('detained cargo never reaches the receiver merely because disclosure was offered', () => {
  const f = fixture(); Gates.bind(f.state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  Property.publish(f.state.checkpoints[0], { legalStatus: 'restricted' }, { institutionId: 'court' }, 0);
  offer(f); f.advance(25000); expect(f.sh.propertyOrder).toBeTruthy(); expect(f.sh.chemicalHandoff).toBeUndefined(); expect(f.sh.receiptAt).toBeNull();
});
test('credible dated source records support only the observed receiver and reach independent judicial review', () => {
  const f = fixture(), e = evidence();
  // A retained pre-existing report fixture, not a report generated by disclosure.
  f.sh.examination = { reports: copy(e.reports) }; f.sh.propertyOrder = { rule: { productId: e.productId } };
  offer(f); f.advance(12000);
  const recipientFindings = source(f), actorId = f.sh.chemicalHandoff.observationId;
  const a = { at: 14000, sourceRevision: 1, recipientFindings, actors: [{ id: actorId, sourceIds: recipientFindings[0].events.map(d => d.id), role: 'receiver' }, { id: 'gate-person', sourceIds: ['gate-person'], role: 'driver' }] };
  e.personObservations.push({ id: 'gate-person' });
  const r = { id: 'referral', reviewedRevision: 1, revisions: [{ evidence: e }], investigation: { assessments: [a], assessedSignature: '1:0:0', submissions: [], corrections: [] } };
  const gate = { id: 'gate', active: true, cityId: 'b', jurisdiction: 'city', judiciary: { active: true, cityId: 'b', institutionId: 'court' },
    criminalIntake: { active: true, cityId: 'b', institutionId: 'prosecution', referrals: [r] } };
  Charging.advance(gate, 14000, Referrals.findings); Charging.advance(gate, 15800, Referrals.findings);
  expect(r.charging.reviews[0].counts.map(c => c.status)).toEqual(['proposed', 'returnedForEvidence']);
  Court.advance(gate, 15800, Referrals.findings); Court.advance(gate, 17600, Referrals.findings);
  expect(gate.cargoCourt.dockets).toHaveLength(1); expect(gate.cargoCourt.dockets[0].status).toBe('allowed');
  expect(gate.cargoCourt.dockets[0].handoff).toMatchObject({ custodyAuthorized: false, trialStarted: false });
  for (const change of ['late', 'scope', 'actor', 'copy', 'silent', 'quality', 'signatureOnly']) {
    const changed = copy(a), changedE = copy(e), events = changed.recipientFindings[0].events;
    if (change === 'late') changedE.reports[0].at = 9000;
    if (change === 'scope') changedE.samples[0].representation = null;
    if (change === 'actor') events[0].observationId = 'somebody-else';
    if (change === 'copy') changed.recipientFindings[0].comparisons[0].result = 'contradicted';
    if (change === 'silent') events[0].acknowledgmentWitnessed = false;
    if (change === 'quality') changedE.reports[0].quality.calibration = 20;
    if (change === 'signatureOnly') events[0].reportAcknowledgments = [];
    expect(Chemical.proof(changedE, changed, actorId).knowledge, change).toEqual([]);
  }
  e.authorization.covering.push('verified-local-permit');
  expect(Charging.proposalFindings(gate, r, actorId, Referrals.findings).supported).toBe(false);
  expect(r.charging.reviews[0].counts[0].status).toBe('proposed'); // Historical decision is retained.
  e.authorization.covering = []; e.authorization.checked = false;
  expect(Charging.proposalFindings(gate, r, actorId, Referrals.findings).supported).toBe(false);
});
test('a silent receiver may accept, but private comprehension is never disclosed as knowledge', () => {
  const f = fixture(), e = evidence();
  f.sh.examination = { reports: copy(e.reports) }; f.sh.propertyOrder = { rule: { productId: e.productId } };
  f.person.chemicalPreferences.acknowledgesDeclarations = false;
  offer(f); f.advance(12000);
  expect(f.sh.receiptAt).not.toBeNull();
  const disclosure = f.sh.recipientDocuments[0];
  expect(disclosure.acknowledgedProducts).toEqual([]); expect(disclosure.reportIdsRead).toEqual([]);
  expect(Chemical.proof(e, { recipientFindings: source(f) }, f.sh.chemicalHandoff.observationId).knowledge).toEqual([]);
});
