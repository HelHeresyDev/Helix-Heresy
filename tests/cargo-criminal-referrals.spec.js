const { test, expect } = require('@playwright/test');
const Referrals = require('../cargo-criminal-referrals');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Market = require('../intercity-smuggling');
const Laws = require('../strategic-city-laws');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
const law = { id: 'b:criminal-code:commerce', offenseId: 'contrabandCommerce', legalStatus: 'prohibited', elements: Laws.OFFENSE_CATALOG.find(o => o.id === 'contrabandCommerce').elements };
function fixture(criminalLaw = law) {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: 'restricted' }, { institutionId: 'court' }, 0);
  Referrals.provision(gate, criminalLaw, { institutionId: 'prosecution', name: 'Local Prosecution' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', section: 'chemicalBatches', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', phase: 'liquid', productId: 'unlicensedMutagenicPrimer', purity: 90, label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const quote = Market.offer(state, state.operators[0].id, request, route, 0), sh = Market.book(state, quote, request, route, 'private-contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0); Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]);
  return { state, gate, sh, office: gate.criminalIntake, advance: at => Market.advance(state, at, [route]) };
}
test('positive examination creates one timed intake lead, not charges or proof of transaction or knowledge', () => {
  const f = fixture(); f.advance(15000);
  expect(f.office.referrals).toHaveLength(1); const r = f.office.referrals[0];
  expect(r.disclosed).toHaveLength(0); expect(f.office.power).toBe(11);
  f.advance(18000); expect(r.status).toBe('acceptedForInvestigation');
  expect(r.reviews[0].elements.filter(e => ['transaction', 'knowledge'].includes(e.id)).every(e => e.support.length === 0)).toBe(true);
  expect(r.disclosed[0].obligation).toContain('No response or appearance');
  expect(f.sh.owner).toBe('player'); expect(f.sh.propertyOrder.expiresAt).toBe(91800);
  expect(f.sh.inspection.crewDetained).toBe(false); expect(f.sh.receiptAt).toBeNull(); expect(f.sh.playerEscrow).toBe(0);
});
test('evidence whitelist excludes private contracts, buyer and crew identities and hidden composition', () => {
  const f = fixture(); f.advance(18000); const e = f.office.referrals[0].revisions[0].evidence;
  expect(e.actors.identifiedSubjects).toEqual([]); expect(e.actors.unresolvedRoles).toEqual(['sender', 'buyer', 'carrier', 'handler']);
  const json = JSON.stringify(e); expect(json).not.toContain('private-contract'); expect(json).not.toContain(f.sh.buyerId);
  for (const crew of f.state.operators[0].crew) expect(json).not.toContain(crew.id);
  expect(e.samples[0].composition).toBeUndefined(); expect(e.samples[0].owner).toBeUndefined();
});
test('missing, restricted, foreign or retrospective criminal law is declined despite supported assay', () => {
  for (const defect of ['missing', 'restricted', 'foreign', 'late']) {
    const f = fixture(defect === 'missing' ? null : defect === 'restricted' ? { ...law, legalStatus: 'restricted' } : law);
    if (defect === 'foreign') f.gate.criminalRule.cityId = 'elsewhere';
    if (defect === 'late') f.gate.criminalRule.effectiveAt = 4000; // After arrival, before the later property order.
    f.advance(18000); expect(f.office.referrals[0].status, defect).toBe('declined'); expect(f.sh.owner).toBe('player');
  }
});
test('no initial referral from a screen, negative assay or unsupported confirmation', () => {
  const f = fixture(); f.advance(7300); expect(f.office.referrals).toHaveLength(0);
  f.sh.examination.samples[0].sealId = 'broken'; f.advance(18000); expect(f.office.referrals).toHaveLength(0);
  const g = fixture(); g.sh.manifest.entries[0].stack.chemicalBatch.productId = 'legal'; g.advance(18000); expect(g.office.referrals).toHaveLength(0);
});
test('amended evidence after physical return is reviewed without erasing the original or reviving custody', () => {
  const f = fixture(); f.advance(100000); f.advance(102000);
  const r = f.office.referrals[0], count = r.revisions.length, original = JSON.stringify(r.revisions[0]);
  const property = JSON.stringify({ manifest: f.sh.manifest, order: f.sh.propertyOrder, escrow: f.sh.playerEscrow, custodian: f.sh.custodian });
  f.sh.examination.reports[1].supported = false; f.advance(102001);
  expect(r.revisions).toHaveLength(count + 1); f.advance(104001);
  expect(r.status).toBe('awaitingCorroboration'); expect(JSON.stringify(r.revisions[0])).toBe(original);
  expect(JSON.stringify({ manifest: f.sh.manifest, order: f.sh.propertyOrder, escrow: f.sh.playerEscrow, custodian: f.sh.custodian })).toBe(property);
  expect(f.sh.phase).toBe('returned'); expect(r.reviews.at(-1).revision).toBe(r.revisions.length);
});
test('local registry authorization defeats a referral without requiring player paperwork', () => {
  const f = fixture(); f.gate.authorizations.push({ id: 'specific-permit', status: 'active', cityId: 'b', issuerId: 'court', holderId: 'player', productId: 'unlicensedMutagenicPrimer', scope: 'destinationGateCargo', validFrom: 0, expiresAt: 100000, quantity: 1 });
  f.advance(18000); expect(f.office.referrals[0].status).toBe('declined'); expect(f.office.referrals[0].reviews[0].reason).toContain('covering specific authorization');
});
test('review requires available local staff and finite powered records, with no retroactive work on restoration', () => {
  for (const failure of ['staff', 'channel', 'power']) {
    const f = fixture();
    if (failure === 'staff') f.office.reviewer.health = 0;
    if (failure === 'channel') f.office.channelPowered = false;
    if (failure === 'power') f.office.power = 0;
    f.advance(100000); expect(f.office.referrals[0].reviews).toHaveLength(0); expect(f.sh.propertyOrder.status).toBe('released');
    f.office.reviewer.health = 100; f.office.channelPowered = true; f.office.power = 2;
    f.advance(100001); expect(f.office.referrals[0].reviews).toHaveLength(0);
    f.advance(101801); expect(f.office.referrals[0].reviews).toHaveLength(1);
  }
});
test('reload and repeated submissions neither duplicate referrals nor reroll reviews or spend power twice', () => {
  const f = fixture(); f.advance(15000); const saved = JSON.parse(JSON.stringify(f.state));
  f.advance(18000); Market.advance(saved, 18000, [route]); expect(saved).toEqual(f.state);
  const power = f.office.power, r = f.office.referrals[0], count = r.revisions.length;
  for (let i = 0; i < 5; i++) Referrals.tick(f.gate, f.sh, 18000);
  expect(f.office.referrals).toHaveLength(1); expect(r.reviews).toHaveLength(1); expect(r.revisions).toHaveLength(count); expect(f.office.power).toBe(power);
});
test('a foreign laboratory report or missing gate observation requires corroboration, not inferred proof', () => {
  for (const defect of ['institution', 'observation', 'batch']) {
    const f = fixture(); f.advance(15000);
    if (defect === 'institution') f.sh.examination.reports[1].institutionId = 'foreign-court';
    if (defect === 'observation') f.sh.inspection.observations = [];
    if (defect === 'batch') f.sh.examination.authorization.batchId = 'different-batch';
    f.advance(15001); f.advance(16801); expect(f.office.referrals[0].status, defect).toBe('awaitingCorroboration');
  }
});
test('one reviewer processes multiple packets sequentially without duplicating staff capacity', () => {
  const f = fixture(); f.advance(15000);
  const second = JSON.parse(JSON.stringify(f.sh)); second.propertyOrder.id = 'second-property-order';
  Referrals.tick(f.gate, second, 15000);
  Referrals.advance(f.state, 16800);
  expect(f.office.referrals[0].reviews).toHaveLength(1); expect(f.office.referrals[1].reviews).toHaveLength(0);
  Referrals.advance(f.state, 18600); expect(f.office.referrals[1].reviews).toHaveLength(1);
  expect(f.office.referrals[1].reviews[0].at - f.office.referrals[0].reviews[0].at).toBe(1800);
});
