const { test, expect } = require('@playwright/test');
const Charging = require('../cargo-charging');
const Referrals = require('../cargo-criminal-referrals');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Market = require('../intercity-smuggling');
const Laws = require('../strategic-city-laws');
const Investigations = require('../cargo-investigations');
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
  const advance = at => Market.advance(state, at, [route]);
  advance(100000); advance(106000);
  return { state, gate, sh, advance, r: gate.criminalIntake.referrals[0] };
}
test('real cargo inquiry produces timed person-specific screening without charges or custody', () => {
  const f = fixture(); f.advance(108000);
  const review = f.r.charging.reviews.at(-1);
  expect(review.counts).toHaveLength(1);
  expect(review.counts[0]).toMatchObject({ status: 'returnedForEvidence', actor: { role: 'observed cargo presenter' } });
  expect(review.counts[0].gaps.map(g => g.element)).toEqual(['transaction', 'knowledge']);
  expect(review.counts[0].elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => !e.support.length)).toBe(true);
  expect(f.gate.chargingOffice).toMatchObject({ power: 11, workSeconds: 19800 });
  expect(review.prosecutorId).not.toBe(f.gate.criminalIntake.reviewer.id);
  expect(f.sh.inspection.crewDetained).toBe(false); expect(f.sh.phase).toBe('returned');
  expect(JSON.stringify(review)).not.toContain('private-contract');
  for (const person of f.state.operators[0].crew) expect(JSON.stringify(review)).not.toContain(person.id);
  expect(f.r.charging.notices[0]).toEqual(review); expect(f.r.charging.notices[0]).not.toBe(review);
});
test('silence neither generates proof nor repeated screening and money or custody mutations', () => {
  const f = fixture(); f.advance(108000);
  const before = JSON.stringify(f.r.charging), resources = f.gate.chargingOffice.workSeconds;
  const physical = JSON.stringify(f.sh);
  f.advance(200000); f.advance(300000);
  expect(JSON.stringify(f.r.charging)).toBe(before); expect(f.gate.chargingOffice.workSeconds).toBe(resources);
  expect(JSON.stringify(f.sh)).toBe(physical);
});
test('outages and exhausted work pause without retrospective time or replacement staff', () => {
  for (const kind of ['channelPowered', 'active', 'person', 'work', 'location']) {
    const f = fixture(), o = f.gate.chargingOffice;
    if (kind === 'person') o.prosecutor.health = 0;
    else if (kind === 'work') o.workSeconds = 0;
    else if (kind === 'location') o.locationId = 'foreign';
    else o[kind] = false;
    Charging.advance(f.gate, 120000, Referrals.findings);
    expect(f.r.charging).toBeUndefined();
    o.prosecutor.health = 100; o.channelPowered = o.active = true; o.locationId = f.gate.id; o.workSeconds = 21600;
    Charging.advance(f.gate, 120000, Referrals.findings);
    expect(f.r.charging).toBeUndefined();
    Charging.advance(f.gate, 121800, Referrals.findings);
    expect(f.r.charging.reviews).toHaveLength(1);
  }
});
test('save/load preserves partial progress and produces exactly the same immutable result', () => {
  const f = fixture(); Charging.advance(f.gate, 106500, Referrals.findings);
  const restored = JSON.parse(JSON.stringify(f.gate));
  Charging.advance(f.gate, 108000, Referrals.findings); Charging.advance(restored, 108000, Referrals.findings);
  expect(restored).toEqual(f.gate);
});
test('new source review invalidates pending work and preserves earlier dispositions', () => {
  const f = fixture(); f.advance(108000);
  const original = JSON.stringify(f.r.charging.reviews[0]);
  expect(Investigations.correct(f.gate, f.r, 'scope', 108001)).toBe(true);
  Charging.advance(f.gate, 111000, Referrals.findings);
  expect(f.r.charging.reviews).toHaveLength(1);
  f.advance(114000); f.advance(118000);
  expect(f.r.charging.reviews).toHaveLength(2);
  expect(JSON.stringify(f.r.charging.reviews[0])).toBe(original);
  expect(f.r.charging.reviews[1].disclosure.assessment.correctionFindings).not.toEqual([]);
});
test('claimant names, accounts and assessment prose cannot become person-linked proof', () => {
  const f = fixture(), a = f.r.investigation.assessments.at(-1);
  a.actors[0].knowledge = 'proven'; a.actors[0].transaction = 'proven';
  a.actors.push({ id: 'account-person-guess', sourceIds: ['invoice'], identity: 'same name', role: 'buyer' });
  f.advance(108000);
  expect(f.r.charging.reviews[0].counts).toHaveLength(1);
  expect(f.r.charging.reviews[0].counts[0].status).toBe('returnedForEvidence');
});
test('withdrawn lawful basis is declined after new source review without erasing the original', () => {
  const f = fixture(); f.advance(108000); f.gate.criminalRule.active = false;
  f.advance(108001); f.advance(115000); f.advance(120000);
  expect(f.r.charging.reviews.at(-1).counts[0].status).toBe('declined');
  expect(f.r.charging.reviews[0].counts[0].status).toBe('returnedForEvidence');
});
test('one prosecutor cannot spend the same half hour on two referrals', () => {
  const f = fixture(), second = JSON.parse(JSON.stringify(f.r));
  second.id += ':second'; f.gate.criminalIntake.referrals.push(second);
  Charging.advance(f.gate, 108000, Referrals.findings);
  expect(f.r.charging.reviews).toHaveLength(1); expect(second.charging).toBeUndefined();
  Charging.advance(f.gate, 110000, Referrals.findings);
  expect(second.charging.reviews).toHaveLength(1);
  expect(second.charging.reviews[0].at - f.r.charging.reviews[0].at).toBe(1800);
  expect(f.gate.chargingOffice).toMatchObject({ power: 10, workSeconds: 18000 });
});
test('missing prosecution and non-city jurisdiction cannot materialize a screening service', () => {
  for (const gate of [{ id: 'none', cityId: 'b', jurisdiction: 'city' },
    { id: 'wild', cityId: 'b', jurisdiction: 'wilderness', criminalIntake: { cityId: 'b', institutionId: 'p' } }]) {
    Charging.advance(gate, 100, Referrals.findings);
    expect(gate.chargingOffice).toBeUndefined();
  }
});
test('principal and receiver observations stay separate despite shared names and consignment', () => {
  const f = fixture(), a = f.r.investigation.assessments.at(-1);
  a.principalFindings = [{ comparisons: [{ receipt: { id: 'authority', kind: 'purchasingAuthority', sameAttendee: false } }] }];
  a.recipientFindings = [{ events: [{ id: 'receipt', observationId: 'receiver' }] }];
  for (const id of ['authority:principal', 'authority:representative', 'receiver'])
    a.actors.push({ id, identity: 'same chosen name', role: id, sourceIds: [id === 'receiver' ? 'receipt' : 'authority'] });
  a.paymentFindings = [{ statement: 'Refund recorded; not performance.' }];
  f.advance(108000);
  const result = f.r.charging.reviews[0];
  expect(result.counts).toHaveLength(4);
  expect(new Set(result.counts.map(c => c.actor.id)).size).toBe(4);
  expect(result.counts.every(c => c.status === 'returnedForEvidence')).toBe(true);
  expect(result.disclosure.assessment.paymentFindings).toEqual(a.paymentFindings);
  a.paymentFindings[0].statement = 'changed';
  expect(result.disclosure.assessment.paymentFindings[0].statement).toContain('Refund');
});
