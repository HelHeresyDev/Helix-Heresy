const { test, expect } = require('@playwright/test');
const Review = require('../cargo-property-review');
const Gates = require('../smuggling-checkpoints');
const Market = require('../intercity-smuggling');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
function fixture() {
  const state = Market.create('a');
  Market.discover(state, [route], [{ cityId: 'b', label: 'B', kind: 'fortifiedCity', known: true }], { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  Gates.bind(state, [{ cityId: 'b', cellId: 'b', institutionId: 'watch', jurisdiction: 'city' }]);
  const gate = state.checkpoints[0]; Review.publish(gate, { legalStatus: 'restricted' }, { institutionId: 'court', name: 'B Court' }, 0);
  const manifest = { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ amount: 1, stack: { id: 'lot', chemicalBatch: { label: 'Unlicensed Mutagenic Primer', packaging: { state: 'packaged' } } } }] };
  const req = { manifest, value: 800, cargo: { massKg: 1, volumeL: 1 }, localDistanceKm: 8 };
  const quote = Market.offer(state, state.operators[0].id, req, route, 0), sh = Market.book(state, quote, req, route, 'contract', 0).shipment;
  Market.markCollected(state, sh.id, manifest, 'collector', 0); Market.receiveDepot(state, sh.id, manifest, 0); Market.advance(state, 0, [route]);
  const advance = at => Market.advance(state, at, [route]);
  return { state, gate, sh, advance };
}
test('a specific published restriction and readable physical label support one bounded local order, never guilt or title transfer', () => {
  const f = fixture(); f.advance(6000);
  expect(f.sh.propertyOrder).toMatchObject({ status: 'active', institutionId: 'court', owner: 'player', crewDetained: false, vehicleSeized: false });
  expect(f.sh.propertyOrder.propertyIds).toEqual(['lot']); expect(f.sh.custodian).toBe(f.gate.id); expect(f.sh.owner).toBe('player');
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.propertyOrder.expiresAt - f.sh.propertyOrder.issuedAt).toBe(86400);
  Gates.submit(f.sh, f.sh.fingerprint, 6000); f.advance(7200); expect(f.sh.propertyOrder.status).toBe('active');
});
test('missing rules, generic market tags, bulk goods, foreign jurisdiction and unavailable courts cannot create orders', () => {
  for (const mode of ['rule', 'bulk', 'label', 'court', 'city', 'future']) {
    const f = fixture();
    if (mode === 'rule') f.gate.propertyRules = [];
    if (mode === 'bulk') f.sh.manifest.entries[0].stack.chemicalBatch.packaging.state = 'bulk';
    if (mode === 'label') f.sh.manifest.entries[0].stack.chemicalBatch.label = 'Unknown';
    if (mode === 'court') f.gate.judiciary.active = false;
    if (mode === 'city') f.gate.judiciary.cityId = 'foreign';
    if (mode === 'future') f.gate.propertyRules.forEach(r => r.effectiveAt = 100000);
    f.advance(6000); expect(f.sh.propertyOrder, mode).toBeUndefined();
  }
});
test('factual review upholds supported custody without extending its expiry; reload never rerolls a decision', () => {
  const f = fixture(); f.advance(6000); const expiry = f.sh.propertyOrder.expiresAt;
  expect(Review.petition(f.sh, 'identity', 6000)).toBe(true); expect(Review.petition(f.sh, 'jurisdiction', 6000)).toBe(false);
  const loaded = JSON.parse(JSON.stringify(f.state)); f.advance(7800); Market.advance(loaded, 7800, [route]); expect(loaded).toEqual(f.state);
  expect(f.sh.propertyOrder.decisions[0].result).toBe('upholdBoundedCustody'); expect(f.sh.propertyOrder.expiresAt).toBe(expiry);
  f.advance(expiry + 4000); expect(f.sh.propertyOrder.status).toBe('released'); expect(f.sh.owner).toBe(f.sh.buyerId);
  expect(f.sh.propertyOrder.decisions.filter(d => d.result === 'release')).toHaveLength(1);
});
test('unsupported identification, revoked rule and lost jurisdiction cause reasoned release instead of perpetual custody', () => {
  for (const mode of ['identity', 'rule', 'jurisdiction', 'missingGate']) {
    const f = fixture(); f.advance(6000); Review.petition(f.sh, mode === 'rule' ? 'applicability' : mode, 6000);
    if (mode === 'identity') f.sh.propertyOrder.evidence.label = 'Unsupported label';
    if (mode === 'rule') f.gate.propertyRules[0].active = false;
    if (mode === 'jurisdiction') f.gate.judiciary.cityId = 'elsewhere';
    if (mode === 'missingGate') f.state.checkpoints = [];
    f.advance(8000); expect(f.sh.propertyOrder.status, mode).toBe('released');
    expect(f.sh.propertyOrder.decisions[0].reason).toMatch(/not supported|does not apply|No competent/);
  }
});
test('only an existing specific authorization covers the product, quantity, owner, city and period', () => {
  for (const mode of ['valid', 'generic', 'expired', 'foreign', 'fabricated', 'quantity']) {
    const f = fixture(); f.advance(6000);
    const doc = { id: 'permit', status: 'active', cityId: 'b', issuerId: 'court', holderId: 'player', productId: 'unlicensedMutagenicPrimer', scope: 'destinationGateCargo', validFrom: 0, expiresAt: 20000, quantity: 1 };
    if (mode === 'generic') doc.scope = 'commercialLicense'; if (mode === 'expired') doc.expiresAt = 7000;
    if (mode === 'foreign') doc.cityId = 'c'; if (mode === 'quantity') doc.quantity = 0;
    if (mode !== 'fabricated') f.gate.authorizations.push(doc);
    Review.petition(f.sh, 'authorization', 6000, ['permit']); f.advance(8000);
    expect(f.sh.propertyOrder.status, mode).toBe(mode === 'valid' ? 'released' : 'active');
  }
});
test('delivery expiration while seized refunds once but cannot release property; later release makes a real loaded return', () => {
  const f = fixture(); f.sh.deliveryDeadlineAt = 7000; f.advance(8000);
  expect(f.sh.saleFailedAt).toBe(7000); expect(f.sh.propertyOrder.status).toBe('active'); expect(f.sh.playerEscrow).toBe(0);
  const money = f.state.buyers[0].money;
  f.advance(f.sh.propertyOrder.expiresAt + 4000); expect(f.state.buyers[0].money).toBe(money);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.custodian).toBe('covert-depot:a'); expect(f.sh.owner).toBe('player');
  expect(f.sh.manifest.entries[0].stack.id).toBe('lot'); expect(Market.settle(f.state, f.sh.id, 100000)).toBe(0);
});
