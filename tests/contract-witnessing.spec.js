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

  return { state, gate, sh, manifest, advance: at => Market.advance(state, at, [route]), referral: () => gate.criminalIntake.referrals[0] };
}

const Witness = require('../contract-witnessing');
function setup() {
  const f = fixture(); f.wallet = { money: 100 };
  Witness.provision(f.state, { institutionId: 'registry:a', name: 'Home Records', cityId: 'a', active: true }, 0);
  f.office = f.state.witnessOffices[0]; return f;
}
function file(f, kind = 'terms', note = '', at = 0) {
  const doc = Witness.filingPreview(f.state, f.sh, kind, note);
  expect(Witness.file(f.state, f.sh, doc, f.wallet, at)).toBe(true); return doc;
}
function finished() {
  const f = setup(); file(f); f.advance(1800);
  Market.markCollected(f.state, f.sh.id, f.manifest, 'collector', 1800); Market.receiveDepot(f.state, f.sh.id, f.manifest, 1800); f.advance(1800);
  f.advance(100000); f.advance(106000); return f;
}
function submit(f, doc = Witness.preview(f.sh)) {
  expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true); f.advance(106000); f.advance(109600);
  return f.referral().investigation.assessments.at(-1).witnessFindings;
}
test('only a real local institution supplies a finite office; unfiled contracts create no records', () => {
  const f = fixture();
  for (const institution of [null, { institutionId: 'foreign', cityId: 'b', active: true }, { institutionId: 'dead', cityId: 'a', active: false }]) Witness.provision(f.state, institution, 0);
  expect(f.state.witnessOffices).toBeUndefined(); expect(Witness.filingPreview(f.state, f.sh)).toBeNull();
  Witness.provision(f.state, { institutionId: 'registry', cityId: 'a', active: true }, 100);
  f.advance(1000); expect(f.state.witnessOffices[0].witnessService.records).toEqual([]); expect(Witness.preview(f.sh)).toBeNull();
});
test('preview does not disclose or spend; paid filing conserves funds and captures only prospective acknowledgments', () => {
  const f = setup(), p = Witness.filingPreview(f.state, f.sh), s = f.office.witnessService;
  expect(s.records).toEqual([]); expect(f.wallet.money).toBe(100);
  expect(JSON.stringify(p)).not.toMatch(/purity|observerId|playerEscrow|buyerId/);
  file(f); expect(f.wallet.money + s.money).toBe(100); expect(f.wallet.money).toBe(80); expect(s.records[0].acknowledgments).toHaveLength(1);
  f.advance(1799); expect(f.sh.witnessDocuments).toBeUndefined(); f.advance(1800);
  expect(f.sh.witnessDocuments[0]).toMatchObject({ status: 'acknowledged', filedAt: 0, completedAt: 1800 });
  expect(f.sh.witnessDocuments[0].acknowledgments.map(a => a.at)).toEqual([0, 1800]);
  expect(s).toMatchObject({ power: 11, workSeconds: 12600, assignment: null });
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.owner).toBe('player');
  expect(Witness.file(f.state, f.sh, p, f.wallet, 1800)).toBe(false);
});
test('stale terms, changed fees, insufficient funds, unavailable staff and old shipments cannot be filed', () => {
  for (const failure of ['terms', 'fee', 'money', 'health', 'power', 'work', 'channel', 'history']) {
    const f = setup(), p = Witness.filingPreview(f.state, f.sh), s = f.office.witnessService;
    if (failure === 'terms') f.sh.gross++;
    if (failure === 'fee') s.fee++;
    if (failure === 'money') f.wallet.money = 0;
    if (failure === 'health') s.clerk.health = 0;
    if (failure === 'power') s.power = 0;
    if (failure === 'work') s.workSeconds = 0;
    if (failure === 'channel') s.channelPowered = false;
    if (failure === 'history') delete f.sh.bookedQuantity;
    expect(Witness.file(f.state, f.sh, p, f.wallet, 0)).toBe(false); expect(s.records).toEqual([]);
  }
});
test('buyer refusal, departure, unavailability and missing power create no invented acknowledgment', () => {
  for (const failure of ['consent', 'departure', 'channel', 'health', 'power']) {
    const f = setup(); file(f); const b = f.state.buyers[0].buyerService;
    if (failure === 'consent') b.witnessTermsConsent = false;
    if (failure === 'departure') Market.markCollected(f.state, f.sh.id, f.manifest, 'courier', 1);
    if (failure === 'channel') b.channelPowered = false;
    if (failure === 'health') b.representatives[0].health = 0;
    if (failure === 'power') b.power = 0;
    f.advance(1800); expect(f.sh.witnessDocuments[0].status).toBe('missingAcknowledgment'); expect(f.sh.witnessDocuments[0].acknowledgments).toHaveLength(1);
    b.witnessTermsConsent = true; b.channelPowered = true; b.power = 6; f.advance(3600);
    expect(f.sh.witnessDocuments).toHaveLength(1); expect(f.sh.witnessDocuments[0].acknowledgments).toHaveLength(1);
  }
});
test('office interruptions and reload preserve work and one fee without retroactive processing', () => {
  const f = setup(); file(f); f.advance(900); const s = f.office.witnessService;
  s.channelPowered = false; f.advance(1000); s.channelPowered = true; f.advance(10000);
  expect(s.records[0].progress).toBe(900);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(10900); Market.advance(saved, 10900, [route]); expect(saved).toEqual(f.state);
  expect(f.wallet.money).toBe(80); expect(s.money).toBe(20); expect(s.records[0].status).toBe('acknowledged');
});
test('a successor office cannot silently inherit an earlier institution’s archive', () => {
  const f = setup(); file(f); f.advance(1800); f.office.witnessService.active = false;
  Witness.provision(f.state, { institutionId: 'successor', cityId: 'a', active: true }, 1800);
  expect(Witness.filingPreview(f.state, f.sh, 'amendment', 'A statement')).toBeNull();
  expect(f.state.witnessOffices[1].witnessService.records).toEqual([]);
  expect(Witness.preview(f.sh).contact.accountId).toBe(f.office.witnessService.contact.accountId);
});
test('cancellation and proposed amendments append permanent statements without rewriting terms or changing the sale', () => {
  const f = setup(); file(f); f.advance(1800); const first = JSON.stringify(f.sh.witnessDocuments[0]), gross = f.sh.gross;
  file(f, 'amendment', 'Proposed revised collection arrangement', 1800); f.advance(3600);
  expect(f.sh.witnessDocuments[1].status).toBe('missingAcknowledgment'); expect(f.sh.gross).toBe(gross);
  expect(Market.cancel(f.state, f.sh.id, 3600)).toBe(true);
  file(f, 'cancellation', '', 3600); f.advance(5400);
  expect(f.sh.witnessDocuments[2].kind).toBe('cancellation'); expect(JSON.stringify(f.sh.witnessDocuments[0])).toBe(first);
  expect(f.office.witnessService.records).toHaveLength(3); expect(f.wallet.money).toBe(40);
});
test('disclosure yields an independent bounded account-acknowledgment finding, not civil identity or guilt', () => {
  const f = finished(), before = JSON.stringify(f.sh.propertyOrder);
  expect(f.referral().investigation.witnessResponses).toBeUndefined();
  const findings = submit(f);
  expect(findings).toHaveLength(1); expect(findings[0].comparisons[0].result).toBe('matchesWitnessedTerms');
  expect(findings[0].jurisdiction).toContain('foreign'); expect(findings[0].limit).toContain('one source');
  expect(findings[0].comparisons[0].receipt.acknowledgments).toHaveLength(2);
  expect(JSON.stringify(f.sh.propertyOrder)).toBe(before);
  expect(f.referral().investigation.assessments.at(-1).elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => !e.support.length)).toBe(true);
  expect(f.office.witnessService.power).toBe(10);
});
test('other-party release refusal is saved and cannot be overridden by a forged submitter flag or policy reroll', () => {
  const f = finished(); f.state.buyers[0].buyerService.witnessReleaseConsent = false;
  const doc = Witness.preview(f.sh); doc.buyerConsents = true;
  const findings = submit(f, doc); expect(findings[0].comparisons[0]).toMatchObject({ result: 'notReleased', receipt: null });
  f.state.buyers[0].buyerService.witnessReleaseConsent = true;
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(115000); Market.advance(saved, 115000, [route]); expect(saved).toEqual(f.state);
  expect(f.office.witnessService.records[0].releaseChoices).toHaveLength(1);
  expect(f.office.witnessService.records[0].releaseChoices[0].consent).toBe(false);
});
test('altered and missing copies release no replacements or unrelated archives', () => {
  const f = finished(), doc = Witness.preview(f.sh); doc.records[0].terms.quantity = 999;
  doc.records.push({ id: 'not-in-archive' });
  const findings = submit(f, doc);
  expect(findings[0].comparisons.map(c => c.result)).toEqual(['alteredCopy', 'unavailable']);
  expect(findings[0].comparisons.every(c => c.receipt === null)).toBe(true);
});
test('missing acknowledgments remain in authenticated findings', () => {
  const f = setup(); f.state.buyers[0].buyerService.witnessTermsConsent = false; file(f); f.advance(1800);
  Market.markCollected(f.state, f.sh.id, f.manifest, 'collector', 1800); Market.receiveDepot(f.state, f.sh.id, f.manifest, 1800); f.advance(1800);
  f.advance(100000); f.advance(106000);
  const findings = submit(f); expect(findings[0].comparisons[0].result).toBe('missingAcknowledgment');
});
test('later cancellation is independently dated and retained as potentially exculpatory without erasing the original', () => {
  const f = finished(), original = JSON.stringify(f.sh.witnessDocuments[0]);
  file(f, 'cancellation', '', 106000); f.advance(107800);
  expect(Investigations.submit(f.gate, f.referral(), Witness.preview(f.sh), 107800)).toBe(true);
  f.advance(107800); f.advance(111400);
  const finding = f.referral().investigation.assessments.at(-1).witnessFindings[0];
  expect(finding.comparisons).toHaveLength(2); expect(finding.exculpatory).toContain('dated cancellation');
  expect(finding.comparisons[1].receipt.filedAt).toBe(106000); expect(JSON.stringify(f.sh.witnessDocuments[0])).toBe(original);
});
test('witness verification and filing share one clerk, and source pauses release the verification reservation', () => {
  const f = finished(), doc = Witness.preview(f.sh);
  expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true); f.advance(106000);
  expect(f.office.witnessService.assignment).toBeTruthy();
  expect(Witness.file(f.state, f.sh, Witness.filingPreview(f.state, f.sh, 'amendment', 'Another statement'), f.wallet, 106000)).toBe(false);
  f.advance(106900); f.gate.investigationOffice.channelPowered = false; f.advance(107000);
  expect(f.office.witnessService.assignment).toBeNull();
  f.gate.investigationOffice.channelPowered = true; f.advance(110000);
  expect(f.referral().investigation.witnessResponses || []).toEqual([]);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(113600); Market.advance(saved, 113600, [route]); expect(saved).toEqual(f.state);
  expect(f.office.witnessService.power).toBe(10); expect(f.office.witnessService.records[0].releaseChoices).toHaveLength(1);
});
test('no hidden buyer lookup, unavailable clerk or unpowered investigator can silently obtain consent', () => {
  for (const failure of ['handle', 'clerk', 'investigator', 'buyer']) {
    const f = finished(), doc = Witness.preview(f.sh);
    if (failure === 'handle') doc.contact.handle = 'other-office';
    if (failure === 'clerk') f.office.witnessService.clerk.health = 0;
    if (failure === 'buyer') f.state.buyers[0].buyerService.channelPowered = false;
    expect(Investigations.submit(f.gate, f.referral(), doc, 106000)).toBe(true);
    if (failure === 'investigator') f.gate.investigationOffice.channelPowered = false;
    f.advance(106000); f.advance(120000);
    expect(f.referral().investigation.witnessResponses || []).toEqual([]); expect(f.office.witnessService.records[0].releaseChoices).toEqual([]);
  }
});
