const { test, expect } = require('@playwright/test');
const Appearance = require('../../cargo-appearance');
const Charging = require('../../cargo-charging');
const Court = require('../../cargo-judicial-review');
const Referrals = require('../../cargo-criminal-referrals');
const Buyer = require('../../buyer-corroboration');
const Identity = require('../../buyer-identity');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const buyer = { id: 'buyer', cityId: 'b', name: 'Buyer', money: 100 };
  Buyer.provision(buyer, 0); const person = buyer.buyerService.representatives[0]; Identity.provisionPerson(person);
  const state = { buyers: [buyer], operators: [], shipments: [], homeId: 'a' };
  Identity.provision(state, { institutionId: 'registry', cityId: 'b', active: true, localDistanceKm: 1 }, 0);
  expect(Identity.request(state, buyer, Identity.preview(state, buyer), 0)).toBe(true);
  Identity.advance(state, 3600);
  const document = person.civicDocument, site = buyer.buyerService.premises;
  // Retained authority packet fixture: all charging and court checks run normally.
  const report = { id: 'report', at: 4000, sampleId: 'sample', sourceStackId: 'lot', sourceBatchId: 'batch', locationId: 'gate', institutionId: 'court', supported: true,
    chainIntact: true, method: 'sealedSampleConfirmatoryAssay', result: 'targetDetected', quality: { skill: 80, calibration: 80 } };
  const items = [{ stackId: 'lot', batchId: 'batch', quantity: .95 }], productId = 'unlicensedMutagenicPrimer';
  const disclosure = { id: 'disclosure', kind: 'chemicalDisclosure', observationId: 'observed', cityId: 'b', sourceAccountId: 'carrier', at: 4700, disclosedAt: 4100,
    unchanged: true, observedItems: items, declarations: { items, reports: [report], reportProductId: productId }, acknowledgmentWitnessed: true,
    reportIdsRead: ['report'], acknowledgedProducts: [productId], reportAcknowledgments: [{ reportId: 'report', productId, stackId: 'lot', batchId: 'batch', result: 'targetDetected' }],
    serviceLocation: { siteId: site.id, cityId: 'b' } };
  const events = [{ id: 'identity', kind: 'recipientIdentity', result: 'supported', document, cityId: 'b', observationId: 'observed', at: 4100 }, disclosure,
    { id: 'handoff', kind: 'recipientHandoff', observationId: 'observed', cityId: 'b', at: 4700, accepted: true, sourceAccountId: 'carrier', items, disclosureId: 'disclosure' }];
  const e = { cityId: 'b', arrivedAt: 3800, productId, personObservations: [], reports: [report], challenges: [],
    samples: [{ id: 'sample', quantity: .05, sourceStackId: 'lot', sourceBatchId: 'batch', locationId: 'gate', sealId: 'seal', examinerId: 'examiner', labId: 'lab', status: 'consumedByAssay',
      custody: [{ at: 3900, action: 'drawnAndSealed', from: 'lot', custodian: 'examiner', sealId: 'seal' }, { at: 4000, action: 'consumedByAssay', custodian: 'lab' }],
      representation: { method: 'mixedSingleLiquidBatchAliquot', at: 3900, stackId: 'lot', batchId: 'batch', quantity: 1 } }],
    law: { id: 'law', sourceLawId: 'code', cityId: 'b', offenseId: 'contrabandCommerce', active: true, publishedAt: 0, effectiveAt: 0, products: [productId], elements: ['transaction', 'contraband', 'knowledge'].map(id => ({ id })) },
    observation: { at: 3900, stackId: 'lot', gateId: 'gate', observerId: 'watch' }, observations: [{ at: 3900, observerId: 'watch', locationId: 'gate', entryIds: ['lot'] }],
    examinationAuthority: { scope: 'chemicalIdentification', cityId: 'b', stackId: 'lot', batchId: 'batch', institutionId: 'court', issuedAt: 0, expiresAt: 5000 }, authorization: { checked: true, covering: [] } };
  const a = { at: 5000, sourceRevision: 1, actors: [{ id: 'observed', role: 'receiver', sourceIds: events.map(e => e.id) }],
    recipientFindings: [{ events, comparisons: events.map(e => ({ recordId: e.id, result: 'matchesCarrierCopy' })) }] };
  const r = { id: 'referral', reviewedRevision: 1, revisions: [{ evidence: e }], investigation: { assessments: [a], assessedSignature: '1:0:0', submissions: [], corrections: [] } };
  const gate = { id: 'gate', active: true, cityId: 'b', jurisdiction: 'city', judiciary: { active: true, cityId: 'b', institutionId: 'court' }, criminalIntake: { active: true, cityId: 'b', institutionId: 'prosecution', referrals: [r] } };
  Charging.advance(gate, 5000, Referrals.findings); Charging.advance(gate, 6800, Referrals.findings);
  Court.advance(gate, 6800, Referrals.findings); Court.advance(gate, 8600, Referrals.findings);
  const d = gate.cargoCourt.dockets[0]; expect(d.status).toBe('allowed'); state.checkpoints = [gate];
  let now = 8600;
  const advance = (seconds = 60) => { now += seconds; Appearance.advance(state, gate, now, Referrals.findings); };
  const until = phase => { for (let i = 0; i < 1800 && d.appearance?.phase !== phase; i++) advance(); expect(d.appearance?.phase).toBe(phase); };
  return { state, gate, d, r, e, a, buyer, person, advance, until, now: () => now };
}
module.exports = { fixture };
