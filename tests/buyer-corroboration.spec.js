const { test, expect } = require('@playwright/test');
const Investigations = require('../cargo-investigations');
const Referrals = require('../cargo-criminal-referrals');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Market = require('../intercity-smuggling');
const Laws = require('../strategic-city-laws');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: 'restricted' }, { institutionId: 'court' }, 0);
  Referrals.provision(gate, { id: 'criminal-commerce', offenseId: 'contrabandCommerce', legalStatus: 'prohibited', elements: Laws.OFFENSE_CATALOG.find(o => o.id === 'contrabandCommerce').elements }, { institutionId: 'prosecution' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', section: 'chemicalBatches', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', phase: 'liquid', productId: 'unlicensedMutagenicPrimer', purity: 90, label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const quote = Market.offer(state, state.operators[0].id, request, route, 0), sh = Market.book(state, quote, request, route, 'private-contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0); Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]);
  return { state, gate, sh, advance: at => Market.advance(state, at, [route]), referral: () => gate.criminalIntake.referrals[0] };
}
function finished() { const f = fixture(); f.advance(100000); f.advance(106000); return f; }

const Buyer = require('../buyer-corroboration');
const Carrier = require('../carrier-corroboration');
function disclose(f, document = Buyer.preview(f.sh)) {
  expect(Investigations.submit(f.gate, f.referral(), document, 106000)).toBe(true);
  f.advance(106000); return document;
}
test('prospective acknowledgments do not fabricate delivery or expose private commercial state', () => {
  const f = finished(), service = f.state.buyers[0].buyerService;
  expect(service.records.map(r => r.document.kind)).toEqual(['orderAcknowledged', 'cancellationAcknowledged']);
  expect(f.sh.receiptAt).toBeNull();
  const doc = Buyer.preview(f.sh), serialized = JSON.stringify(doc);
  for (const privateField of ['money', 'Escrow', 'purity', 'observerId', 'buyerId', 'contractId']) expect(serialized).not.toContain(privateField);
  expect(f.referral().investigation.buyerChoices).toBeUndefined();
  expect(f.referral().investigation.buyerResponses).toBeUndefined();
  expect(service.records[1].document.scope).toContain('not personal observation');
  delete f.state.buyers[0].buyerService; delete f.sh.buyerContact; delete f.sh.buyerDocuments;
  Buyer.provision(f.state.buyers[0], 106000); f.advance(120000);
  Buyer.record(f.state.buyers[0], f.sh, 'deliveryReceived', 10);
  expect(f.state.buyers[0].buyerService.records).toEqual([]); expect(Buyer.preview(f.sh)).toBeNull();
});
test('explicit disclosure yields finite account replies and exculpatory limits without guilt or property changes', () => {
  const f = finished(), property = JSON.stringify(f.sh.propertyOrder), buyerMoney = f.state.buyers[0].money;
  const document = disclose(f); f.advance(111400);
  const i = f.referral().investigation, findings = i.assessments.at(-1).buyerFindings;
  expect(i.buyerResponses.map(r => r.kind)).toEqual(['buyerRecords', 'buyerInterview']);
  expect(findings[0].comparisons.every(c => c.result === 'matchesBuyerCopy')).toBe(true);
  expect(findings[0].exculpatory).toContain('not proof');
  expect(findings[0].events.every(e => e.cityId === 'b' && e.independentObservation)).toBe(true);
  expect(findings[1].participantClaim).toContain('representative');
  expect(new Set(i.buyerResponses.map(r => r.sourceGroup)).size).toBe(1);
  expect(i.assessments.at(-1).actors.find(a => a.role.startsWith('buyer record')).identity).toContain('civil identity unverified');
  expect(i.assessments.at(-1).elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => !e.support.length)).toBe(true);
  expect(f.state.buyers[0].buyerService).toMatchObject({ power: 4, workSeconds: 3600, assignment: null });
  expect(f.state.buyers[0].money).toBe(buyerMoney); expect(JSON.stringify(f.sh.propertyOrder)).toBe(property);
  expect(Investigations.submit(f.gate, f.referral(), document, 111400)).toBe(false);
});
test('saved refusal and records-only choices cannot reroll through repeat requests or reload', () => {
  for (const policy of ['refuse', 'recordsOnly']) {
    const f = finished(), service = f.state.buyers[0].buyerService; service.policy = policy;
    disclose(f); f.advance(109600); service.policy = 'cooperate';
    const saved = JSON.parse(JSON.stringify(f.state)); f.advance(120000); Market.advance(saved, 120000, [route]); expect(saved).toEqual(f.state);
    const i = f.referral().investigation; expect(i.buyerChoices).toHaveLength(1); expect(i.buyerResponses).toHaveLength(1);
    expect(i.buyerResponses[0].decision).toBe(policy === 'refuse' ? 'refused' : 'recordsOnly');
    if (policy === 'refuse') { expect(i.buyerResponses[0].comparisons).toEqual([]); expect(i.buyerResponses[0].statement).toContain('no evidence of guilt'); }
  }
});
test('contact, credentials, physical representative and work availability gate voluntary access', () => {
  for (const failure of ['contact', 'channel', 'credential', 'health', 'location', 'busy', 'power', 'work', 'investigator']) {
    const f = finished(), service = f.state.buyers[0].buyerService, doc = Buyer.preview(f.sh);
    if (failure === 'contact') doc.contact.handle = 'unknown';
    if (failure === 'channel') service.channelPowered = false;
    if (failure === 'credential') service.credentialActive = false;
    if (failure === 'health') service.representatives[0].health = 0;
    if (failure === 'location') service.representatives[0].locationId = 'elsewhere';
    if (failure === 'busy') service.representatives[0].assignment = 'unrelated';
    if (failure === 'power') service.power = 0;
    if (failure === 'work') service.workSeconds = 0;
    disclose(f, doc);
    if (failure === 'investigator') { f.gate.investigationOffice.channelPowered = false; }
    f.advance(120000);
    expect(f.referral().investigation.buyerResponses || []).toEqual([]);
    Buyer.provision(f.state.buyers[0], 120000); if (failure === 'work') expect(service.workSeconds).toBe(0);
  }
});
test('mismatches and missing records disclose no replacement; copied carrier material is not a buyer observation', () => {
  const f = finished(), service = f.state.buyers[0].buyerService, doc = Buyer.preview(f.sh);
  doc.records[0].items[0].quantity = 999;
  doc.records.push({ id: 'missing', shipmentReference: f.sh.id });
  const derived = { ...f.sh.carrierDocuments[0], provenance: 'carrierCopy' };
  service.records.push({ document: derived, observerId: service.representatives[0].id }); doc.records.push(derived);
  disclose(f, doc); f.advance(111400);
  const i = f.referral().investigation;
  expect(i.buyerResponses[0].comparisons.map(c => c.result)).toEqual(['contradicted', 'matchesBuyerCopy', 'unavailable', 'matchesBuyerCopy']);
  expect(i.buyerResponses[0]).not.toHaveProperty('records');
  expect(i.buyerResponses[1].recordIds).toEqual([doc.records[1].id]);
  expect(i.assessments.at(-1).buyerFindings[0].events.at(-1)).toMatchObject({ independentObservation: false, sourceGroup: derived.sourceAccountId });
});
test('available records with no matching personal observation produce an honest limited statement', () => {
  const f = finished(), doc = Buyer.preview(f.sh); doc.records.forEach(d => { d.at = -1; });
  disclose(f, doc); f.advance(111400);
  const response = f.referral().investigation.buyerResponses[1];
  expect(response.recordIds).toEqual([]); expect(response.statement).toContain('no relevant matching firsthand observation');
});
test('outage releases voluntary reservations and preserves paid progress across reload without retroactive work', () => {
  const f = finished(); disclose(f); f.advance(106900);
  const service = f.state.buyers[0].buyerService; expect(service.assignment).toBeTruthy();
  f.gate.investigationOffice.channelPowered = false; f.advance(107000); expect(service.assignment).toBeNull();
  f.gate.investigationOffice.channelPowered = true; f.advance(110000);
  expect(f.referral().investigation.buyerResponses || []).toEqual([]);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(115400); Market.advance(saved, 115400, [route]); expect(saved).toEqual(f.state);
  expect(service.power).toBe(4); expect(f.referral().investigation.buyerResponses).toHaveLength(2);
});
test('replacement representatives cannot inherit the original observer’s memories', () => {
  const f = finished(); disclose(f); f.advance(107800);
  const service = f.state.buyers[0].buyerService; service.representatives[0].health = 0;
  service.representatives.push({ id: 'replacement', name: 'Replacement', health: 100, status: 'alive', fatigue: 0, locationId: 'b' });
  f.advance(120000); expect(f.referral().investigation.buyerResponses.map(r => r.kind)).toEqual(['buyerRecords']); expect(service.assignment).toBeNull();
});
test('actual receipt is independent of carrier testimony but default completed-purchase confidentiality may refuse', () => {
  const f = fixture(); f.gate.active = false; f.advance(10000);
  const service = f.state.buyers[0].buyerService;
  expect(service.records.map(r => r.document.kind)).toEqual(['orderAcknowledged', 'deliveryReceived']);
  const received = service.records[1].document, handoff = f.sh.carrierDocuments.find(d => d.kind === 'buyerHandoff');
  expect(received.at).toBe(handoff.at); expect(received.cityId).toBe(handoff.cityId); expect(received.items).toEqual(handoff.items);
  expect(received.sourceAccountId).not.toBe(handoff.sourceAccountId);
  expect(Buyer.prepare(f.state.buyers, {}, { document: Buyer.preview(f.sh) }, 'buyerRecords', 10000).choice.decision).toBe('refused');
  service.policy = 'cooperate';
  const i = { submissions: [{ id: 's', document: Buyer.preview(f.sh) }] };
  Buyer.complete(i, i.submissions[0], 'buyerRecords', Buyer.prepare(f.state.buyers, i, i.submissions[0], 'buyerRecords', 10000), 11800);
  expect(Buyer.findings(i, 'a')[0].events[1].jurisdiction).toContain('outside investigating city');
});
test('absent receiver postpones physical receipt; offline copies and historical cancellations are not reconstructed', () => {
  const f = fixture(); f.gate.active = false; const service = f.state.buyers[0].buyerService;
  service.representatives[0].locationId = 'elsewhere'; f.advance(10000);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.owner).toBe('player');
  service.representatives[0].locationId = 'b'; service.channelPowered = false; f.advance(11000);
  expect(f.sh.receiptAt).not.toBeNull(); expect(service.records.at(-1).document.kind).toBe('deliveryReceived');
  expect(f.sh.buyerDocuments.map(d => d.kind)).toEqual(['orderAcknowledged']);
  service.channelPowered = true; f.advance(15000); expect(f.sh.buyerDocuments).toHaveLength(1);
  const g = fixture(); g.state.buyers[0].buyerService.channelPowered = false; g.advance(106000);
  g.state.buyers[0].buyerService.channelPowered = true; g.advance(120000);
  expect(g.state.buyers[0].buyerService.records.map(r => r.document.kind)).toEqual(['orderAcknowledged']);
});
test('both source services share the existing finite investigator budget without creating extra staff', () => {
  const f = finished(); disclose(f);
  expect(Investigations.submit(f.gate, f.referral(), Carrier.preview(f.sh), 106000)).toBe(true);
  f.advance(106000); f.advance(125000);
  const i = f.referral().investigation;
  expect(i.carrierResponses).toHaveLength(2); expect(i.buyerResponses).toHaveLength(2);
  expect(f.gate.investigationOffice.workSeconds).toBe(0);
  expect(i.assessments.at(-1).buyerFindings).toHaveLength(2);
});
test('unpowered investigators cannot freeze buyer consent, and later source review releases a reserved buyer', () => {
  const f = finished(), office = f.gate.investigationOffice;
  expect(Investigations.submit(f.gate, f.referral(), Buyer.preview(f.sh), 106000)).toBe(true);
  office.channelPowered = false; f.advance(106000); f.advance(110000);
  expect(f.referral().investigation.buyerChoices).toBeUndefined();
  office.channelPowered = true; f.advance(110001);
  expect(f.state.buyers[0].buyerService.assignment).toBeTruthy();
  f.referral().reviewedRevision = 0;
  Investigations.advance(f.gate, 110002, f.state.operators, f.state.buyers);
  expect(f.state.buyers[0].buyerService.assignment).toBeNull();
  expect(f.referral().investigation.status).toBe('awaitingSourceReview');
});
