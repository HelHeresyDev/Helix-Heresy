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
test('available gate witnesses consume real work and produce only bounded observations, never private identities', () => {
  const f = finished(), i = f.referral().investigation;
  expect(i.status).toBe('awaitingNamedSource'); expect(i.interviews.map(w => w.kind)).toEqual(['officer', 'examiner']);
  expect(i.assessments[0].actors).toHaveLength(1); expect(i.assessments[0].actors[0]).toMatchObject({ identity: 'unverified', transaction: 'not established', knowledge: 'not established' });
  expect(f.gate.investigationOffice).toMatchObject({ power: 9, workSeconds: 9000 });
  for (const person of f.state.operators[0].crew) expect(JSON.stringify(i)).not.toContain(person.id);
  expect(JSON.stringify(i)).not.toContain(f.sh.buyerId); expect(i.notices[0].obligation).toContain('adverse inference from silence');
});
test('a busy gate officer cannot interview while inspecting the consignment or extend cargo custody', () => {
  const f = fixture(); f.advance(20000); const i = f.referral().investigation;
  expect(i.status).toBe('paused'); expect(i.interviews).toHaveLength(0);
  f.advance(100000); expect(f.sh.propertyOrder.status).toBe('released'); expect(f.sh.phase).toBe('returned');
  expect(f.sh.custodian).toBe('covert-depot:a'); expect(f.sh.owner).toBe('player');
});
test('incapacitated witnesses, investigator, missing power or records pause without retroactive work', () => {
  for (const failure of ['officer', 'investigator', 'power', 'channel']) {
    const f = fixture(); f.advance(100000); const office = f.gate.investigationOffice;
    if (failure === 'officer') f.gate.officer.health = 0;
    if (failure === 'investigator') office.investigator.health = 0;
    if (failure === 'channel') office.channelPowered = false;
    if (failure === 'power') { office.power = 0; f.referral().investigation.job.paid = false; }
    f.advance(110000); expect(f.referral().investigation.interviews).toHaveLength(0);
    f.gate.officer.health = 100; office.investigator.health = 100; office.power = 10; office.channelPowered = true;
    f.advance(110001); expect(f.referral().investigation.interviews).toHaveLength(0);
    f.advance(115401); expect(f.referral().investigation.assessments).toHaveLength(1);
  }
});
test('silence and repeated clock updates generate neither evidence, requests nor extra resource charges', () => {
  const f = finished(), before = JSON.stringify(f.referral().investigation), resources = f.gate.investigationOffice.workSeconds;
  f.advance(200000); expect(JSON.stringify(f.referral().investigation)).toBe(before); expect(f.gate.investigationOffice.workSeconds).toBe(resources);
});
test('preview discloses nothing; explicit submission archives only the exact whitelisted fields', () => {
  const f = finished(), r = f.referral(), contract = { id: f.sh.contractId, material: 'Primer', amount: 1, status: 'failed', hiddenLedger: 'SECRET' };
  const doc = Investigations.preview('contract', f.sh, contract, 'Named buyer');
  expect(r.investigation.submissions).toHaveLength(0); expect(doc).not.toHaveProperty('hiddenLedger');
  f.gate.investigationOffice.channelPowered = false;
  expect(Investigations.submit(f.gate, r, doc, 106000)).toBe(false); expect(Investigations.correct(f.gate, r, 'scope', 106000)).toBe(false);
  f.gate.investigationOffice.channelPowered = true;
  expect(Investigations.submit(f.gate, r, doc, 106000)).toBe(true); expect(Investigations.submit(f.gate, r, doc, 106000)).toBe(false);
  doc.counterpartyName = 'changed'; expect(r.investigation.submissions[0].document.counterpartyName).toBe('Named buyer');
  f.advance(106000); f.advance(107800);
  const result = r.investigation.assessments.at(-1); expect(result.documents).toHaveLength(1);
  expect(result.actors[0].identity).toBe('unverified'); expect(result.elements.filter(e => ['knowledge', 'transaction'].includes(e.id)).every(e => !e.support.length)).toBe(true);
  expect(r.investigation.interviews).toHaveLength(2);
});
test('factual corrections preserve earlier assessments without rerolls or manufactured testimony', () => {
  const f = finished(), r = f.referral(), old = JSON.stringify(r.investigation.assessments[0]);
  expect(Investigations.correct(f.gate, r, 'scope', 106000)).toBe(true); expect(Investigations.correct(f.gate, r, 'scope', 106000)).toBe(false);
  f.advance(106000); f.advance(107800);
  expect(JSON.stringify(r.investigation.assessments[0])).toBe(old);
  expect(r.investigation.assessments.at(-1).correctionFindings[0].result).toContain('neither prior knowledge nor a transaction');
  expect(r.investigation.interviews).toHaveLength(2);
});
test('revoked criminal basis closes the investigated lead without erasing history or changing returned property', () => {
  const f = finished(), property = JSON.stringify(f.sh), r = f.referral();
  f.gate.criminalRule.active = false; f.advance(106000); f.advance(107800); f.advance(109600);
  expect(r.investigation.status).toBe('exhaustedUnsupported'); expect(r.investigation.assessments).toHaveLength(2);
  expect(JSON.stringify(f.sh)).toBe(property); expect(r.investigation.interviews).toHaveLength(2);
});
test('save/load preserves active interview progress and exactly-once work, notices and source identity', () => {
  const f = fixture(); f.advance(100000); f.advance(101000); const saved = JSON.parse(JSON.stringify(f.state));
  f.advance(106000); Market.advance(saved, 106000, [route]); expect(saved).toEqual(f.state);
});
