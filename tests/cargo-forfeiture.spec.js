const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Court = require('../cargo-forfeiture');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture(code = 'prohibited') {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: code }, { institutionId: 'court' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', section: 'chemicalBatches', quantity: 1, knownQuantity: 1,
    chemicalBatch: { id: 'batch', phase: 'liquid', productId: 'unlicensedMutagenicPrimer', purity: 90, label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const request = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const q = Market.offer(state, state.operators[0].id, request, route, 0), sh = Market.book(state, q, request, route, 'contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0); Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]);
  return { state, gate, sh, advance: at => Market.advance(state, at, [route]) };
}
test('silence requires all findings and an appeal window before exactly-once physical transfer across reload', () => {
  const f = fixture(); f.advance(15000);
  expect(f.sh.forfeiture.status).toBe('noticed'); expect(f.sh.owner).toBe('player');
  f.advance(f.sh.forfeiture.hearingAt); expect(f.sh.forfeiture.status).toBe('judgment');
  expect(f.sh.forfeiture.decisions[0].findings.every(p => p.passed)).toBe(true);
  expect(f.sh.owner).toBe('player'); expect(f.gate.forfeitureStore.lots).toHaveLength(0);
  const saved = JSON.parse(JSON.stringify(f.state)); f.advance(40000); Market.advance(saved, 40000, [route]); expect(saved).toEqual(f.state);
  expect(f.sh.forfeiture.status).toBe('final'); expect(f.sh.phase).toBe('returned');
  expect(f.sh.custodian).toBe(f.gate.forfeitureStore.id); expect(f.sh.owner).toBe('court');
  expect(f.gate.forfeitureStore.lots[0].entry).toMatchObject({ amount: .99, stack: { id: 'lot', chemicalBatch: { id: 'batch' } } });
  expect(f.sh.manifest.entries).toHaveLength(0); expect(f.sh.receiptAt).toBeNull(); expect(f.sh.playerEscrow).toBe(0);
  f.advance(100000); expect(f.gate.forfeitureStore.lots).toHaveLength(1);
});
test('restriction alone or a retrospective confiscation rule never starts forfeiture', () => {
  const restricted = fixture('restricted'); restricted.advance(100000); expect(restricted.sh.forfeiture).toBeUndefined(); expect(restricted.sh.owner).toBe('player');
  const late = fixture(); late.gate.forfeitureRules.forEach(r => r.effectiveAt = 10000); late.advance(100000); expect(late.sh.forfeiture).toBeUndefined();
});
test('unsupported identity, confirmation or representative scope releases rather than treating silence as consent', () => {
  for (const defect of ['identity', 'confirmation', 'representativeLot']) {
    const f = fixture(); f.advance(15000);
    if (defect === 'identity') f.sh.examination.reports[1].sourceBatchId = 'wrong';
    if (defect === 'confirmation') f.sh.examination.reports[1].supported = false;
    if (defect === 'representativeLot') f.sh.examination.samples[0].representation = null;
    f.advance(40000); expect(f.sh.forfeiture.status, defect).toBe('released'); expect(f.sh.owner).toBe('player'); expect(f.sh.manifest.amount).toBe(.99);
  }
});
test('registry authorization prevents forfeiture even without a player filing', () => {
  const f = fixture(); f.advance(15000);
  f.gate.authorizations.push({ id: 'permit', status: 'active', cityId: 'b', issuerId: 'court', holderId: 'player', productId: 'unlicensedMutagenicPrimer', scope: 'destinationGateCargo', validFrom: 0, expiresAt: 100000, quantity: 1 });
  f.advance(30000); expect(f.sh.forfeiture.status).toBe('released'); expect(f.sh.owner).toBe('player');
});
test('timely appeal stays transfer and receives a distinct reasoned review, including reversal', () => {
  for (const reverse of [false, true]) {
    const f = fixture(); f.advance(15000); expect(Court.file(f.sh, 'confirmation', 15000)).toBe(true);
    f.advance(f.sh.forfeiture.hearingAt); const at = f.sh.forfeiture.hearingAt;
    expect(Court.file(f.sh, 'confirmation', at)).toBe(true); expect(Court.file(f.sh, 'identity', at)).toBe(false);
    f.advance(at + 7100); expect(f.sh.owner).toBe('player'); expect(f.gate.forfeitureStore.lots).toHaveLength(0);
    if (reverse) f.sh.examination.reports[1].supported = false;
    f.advance(at + 7200); const decisions = f.sh.forfeiture.decisions;
    expect(decisions).toHaveLength(2); expect(decisions[1].reviewerId).not.toBe(decisions[0].reviewerId);
    expect(f.sh.owner).toBe('player'); f.advance(at + 8000);
    expect(f.sh.forfeiture.status).toBe(reverse ? 'released' : 'final');
  }
});
test('unavailable independent reviewer or storage never extends the original custody deadline', () => {
  for (const failure of ['reviewer', 'storage']) {
    const f = fixture(); f.advance(22000);
    if (failure === 'reviewer') { Court.file(f.sh, 'identity', 22000); f.gate.propertyBench.appealReviewer.id = f.gate.propertyBench.judge.id; }
    else f.gate.forfeitureStore.capacityKg = 0;
    f.advance(f.sh.propertyOrder.expiresAt); expect(f.sh.forfeiture.status).toBe('released'); expect(f.sh.propertyOrder.status).toBe('released');
    expect(f.sh.owner).toBe('player'); expect(f.gate.forfeitureStore.lots).toHaveLength(0);
  }
});
test('only the adjudicated lot transfers; unrelated cargo returns with its original owner', () => {
  const f = fixture();
  f.sh.manifest.entries.push({ amount: 1, stack: { id: 'unrelated', quantity: 1 } }); f.sh.manifest.amount = 2; f.sh.cargo = { massKg: 2, volumeL: 2 };
  f.advance(40000); expect(f.sh.forfeiture.status).toBe('final'); expect(f.sh.owner).toBe('player');
  expect(f.sh.manifest.entries.map(e => e.stack.id)).toEqual(['unrelated']); expect(f.sh.custodian).toBe('covert-depot:a');
  expect(f.gate.forfeitureStore.lots).toHaveLength(1); expect(f.gate.forfeitureStore.usedKg).toBeCloseTo(.99);
});
