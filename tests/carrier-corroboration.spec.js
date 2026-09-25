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

const Carrier = require('../carrier-corroboration');
function disclose(f, at = 106000) {
  const document = Carrier.preview(f.sh);
  expect(Investigations.submit(f.gate, f.referral(), document, at)).toBe(true);
  f.advance(at); return document;
}
test('records are prospective, source-limited and conserved across reload with no disclosure by default', () => {
  const f = finished(), op = f.state.operators[0], service = op.carrierService;
  expect(service.records.map(r => r.document.kind)).toEqual(['transportBooked', 'receivedAtDepot', 'departedDepot', 'destinationArrival', 'returnedToDepot']);
  expect(service.records.at(-1).document).toMatchObject({ cityId: 'a', deliveryOutcome: 'returnedWithoutHandoff', items: [{ quantity: .99 }] });
  expect(JSON.stringify(f.sh.carrierDocuments)).not.toContain('purity'); expect(JSON.stringify(f.sh.carrierDocuments)).not.toContain(op.crew[0].id);
  expect(f.referral().investigation.carrierResponses).toBeUndefined();
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(110000); Market.advance(saved, 110000, [route]); expect(saved).toEqual(f.state);
  expect(service.records).toHaveLength(5);
});
test('provisioning a records service later cannot reconstruct historical journeys', () => {
  const f = finished(), op = f.state.operators[0]; delete op.carrierService; delete f.sh.carrierContact; delete f.sh.carrierDocuments;
  Carrier.provision(op, 106000); f.advance(120000); expect(op.carrierService.records).toEqual([]); expect(Carrier.preview(f.sh)).toBeNull();
  Carrier.record(op, f.sh, 'receivedAtDepot', 100, 'a', 'old depot'); expect(op.carrierService.records).toEqual([]);
});
test('explicit contact disclosure produces account-authenticated limited cooperation, not civil identity or guilt', () => {
  const f = finished(), r = f.referral(), beforeProperty = JSON.stringify(f.sh.propertyOrder);
  const preview = Carrier.preview(f.sh); expect(r.investigation.carrierChoices).toBeUndefined(); expect(r.investigation.submissions).toEqual([]);
  disclose(f); f.advance(111400);
  const result = r.investigation.assessments.at(-1), responses = r.investigation.carrierResponses;
  expect(responses.map(r => r.kind)).toEqual(['carrierRecords', 'carrierInterview']);
  expect(responses[0].comparisons.every(c => c.result === 'matchesCarrierCopy')).toBe(true);
  expect(new Set(responses.map(r => r.sourceGroup)).size).toBe(1); expect(responses.every(r => r.independentSources === 1)).toBe(true);
  expect(result.carrierFindings[0].exculpatory).toContain('return/non-delivery');
  expect(result.carrierFindings[0].events.find(e => e.kind === 'receivedAtDepot').jurisdiction).toContain('outside investigating city');
  expect(result.actors.find(a => a.role.startsWith('record source')).identity).toContain('civil identity unverified');
  expect(result.elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => e.support.length === 0)).toBe(true);
  expect(f.state.operators[0].carrierService).toMatchObject({ power: 4, workSeconds: 3600, assignment: null });
  expect(f.sh.owner).toBe('player'); expect(JSON.stringify(f.sh.propertyOrder)).toBe(beforeProperty);
  expect(Investigations.submit(f.gate, r, preview, 111400)).toBe(false);
});
test('carrier refusal and records-only limits persist without retries rerolling willingness', () => {
  for (const policy of ['refuse', 'recordsOnly']) {
    const f = finished(), service = f.state.operators[0].carrierService; service.policy = policy;
    const document = disclose(f); f.advance(109600);
    const i = f.referral().investigation; expect(i.carrierResponses).toHaveLength(1);
    expect(i.carrierResponses[0].decision).toBe(policy === 'refuse' ? 'refused' : 'recordsOnly');
    service.policy = 'protectCompletedClients'; f.advance(120000);
    expect(Investigations.submit(f.gate, f.referral(), document, 120000)).toBe(false);
    expect(i.carrierChoices).toHaveLength(1); expect(i.carrierResponses).toHaveLength(1);
    if (policy === 'refuse') { expect(i.carrierResponses[0].comparisons).toEqual([]); expect(i.carrierResponses[0].statement).toContain('no evidence of guilt'); }
  }
});
test('changed copies are contradicted and unavailable records stay unavailable without leaking replacements', () => {
  const f = finished(), doc = Carrier.preview(f.sh);
  doc.records[0].items[0].quantity = 999; doc.records.push({ id: 'nonexistent', shipmentReference: f.sh.id });
  expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true); f.advance(106000); f.advance(111400);
  const response = f.referral().investigation.carrierResponses[0];
  expect(response.comparisons[0].result).toBe('contradicted'); expect(response.comparisons.at(-1).result).toBe('unavailable');
  expect(response).not.toHaveProperty('records'); expect(f.referral().investigation.carrierResponses[1].recordIds).not.toContain(doc.records[0].id);
});
test('unavailable contact, occupied carrier, powerless channel and missing witness cannot create testimony', () => {
  for (const failure of ['contact', 'occupied', 'channel', 'credential', 'witness', 'work']) {
    const f = finished(), op = f.state.operators[0], service = op.carrierService, doc = Carrier.preview(f.sh);
    if (failure === 'contact') doc.contact.handle = 'unknown-contact';
    if (failure === 'occupied') op.assignment = 'another-task';
    if (failure === 'channel') service.channelPowered = false;
    if (failure === 'credential') service.credentialActive = false;
    if (failure === 'witness') op.crew[0].health = 0;
    if (failure === 'work') service.workSeconds = 0;
    expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true); f.advance(106000); f.advance(120000);
    expect(f.referral().investigation.carrierResponses || []).toEqual([]); expect(f.sh.phase).toBe('returned');
    Carrier.provision(op, 120000); if (failure === 'work') expect(service.workSeconds).toBe(0);
  }
});
test('reload and channel interruption preserve work without pinning a voluntary carrier or charging twice', () => {
  const f = finished(); disclose(f); f.advance(106900);
  const service = f.state.operators[0].carrierService; expect(service.assignment).toBeTruthy();
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(111400); Market.advance(saved, 111400, [route]); expect(saved).toEqual(f.state);
  const g = finished(); disclose(g); g.advance(106900); const s = g.state.operators[0].carrierService;
  g.gate.investigationOffice.channelPowered = false; g.advance(107000); expect(s.assignment).toBeNull();
  g.gate.investigationOffice.channelPowered = true; g.advance(110000); expect(g.referral().investigation.carrierResponses || []).toEqual([]);
  g.advance(110900); expect(g.referral().investigation.carrierResponses[0].kind).toBe('carrierRecords');
  expect(s.power).toBe(4); // records allocation once, then the interview allocation
});
test('a delivered shipment records its actual foreign handoff and empty home return, never false non-delivery', () => {
  const f = fixture(); f.gate.active = false; f.advance(10000);
  const records = f.state.operators[0].carrierService.records.map(r => r.document);
  expect(records.find(r => r.kind === 'buyerHandoff').cityId).toBe('b');
  expect(records.at(-1)).toMatchObject({ kind: 'returnedToDepot', items: [], deliveryOutcome: 'returnedAfterHandoff' });
  const context = Carrier.prepare(f.state.operators, {}, { document: Carrier.preview(f.sh) }, 'carrierRecords', 10000);
  expect(context.choice.decision).toBe('refused');
});
test('a replacement account representative cannot invent the original observer’s personal testimony', () => {
  const f = finished(); disclose(f); f.advance(107800);
  const op = f.state.operators[0]; op.crew[0].health = 0;
  op.crew.push({ id: 'replacement', name: 'Replacement', health: 100, status: 'alive', fatigue: 0 });
  f.advance(120000);
  expect(f.referral().investigation.carrierResponses.map(r => r.kind)).toEqual(['carrierRecords']);
  expect(op.carrierService.assignment).toBeNull();
});
test('an unpowered investigator cannot contact a carrier or freeze its willingness prematurely', () => {
  const f = finished(), office = f.gate.investigationOffice;
  const doc = Carrier.preview(f.sh); expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true);
  office.channelPowered = false; f.advance(106000); f.advance(110000);
  expect(f.referral().investigation.carrierChoices).toBeUndefined();
  office.channelPowered = true; f.advance(110001);
  expect(f.referral().investigation.carrierChoices).toHaveLength(1);
});
