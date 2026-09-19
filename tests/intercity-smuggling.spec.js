const { test, expect } = require('@playwright/test');
const Market = require('../intercity-smuggling');
const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' };
const broker = { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] };
const destinations = [{ kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', known: true }];
function fixture() {
  const state = Market.create('a'); Market.discover(state, [route], destinations, broker, 0);
  const request = { templateId: 'offer-1', selectedId: 'batch-1', brokerId: 'broker', value: 500, cargo: { massKg: 5, volumeL: 6 }, localDistanceKm: 8, terms: 'Known rules only',
    manifest: { commodityKind: 'manufactured', material: 'Primer', amount: 1, entries: [{ kind: 'chemicalBatch', amount: 5, sourceStackId: 'batch-1', stack: { id: 'batch-1', quantity: 5, purity: 90 } }] } };
  const op = state.operators[0], quote = Market.offer(state, op.id, request, route, 0);
  return { state, op, request, quote };
}
function booked() { const f = fixture(); f.sh = Market.book(f.state, f.quote, f.request, route, 'contract-1', 0).shipment; return f; }
test('only known direct supported neighbors receive distinct finite smuggling assets, never replacements', () => {
  const state = Market.create('a');
  Market.discover(state, [route], [{ ...destinations[0], known: false }], broker, 0); expect(state.operators).toHaveLength(0);
  Market.discover(state, [{ ...route, endpointCityIds: ['b', 'c'] }], destinations, broker, 0); expect(state.operators).toHaveLength(0);
  Market.discover(state, [route], destinations, { ...broker, homeCityId: 'b' }, 0); expect(state.operators).toHaveLength(0);
  Market.discover(state, [route], destinations, broker, 0); state.operators[0].condition = 0;
  Market.discover(state, [route], destinations, broker, 3600); expect(state.operators).toHaveLength(1); expect(state.operators[0].condition).toBe(0);
  expect(state.operators[0].vehicleId).toBe('smuggling-van:ab'); expect(state.operators[0].permit).toBeUndefined();
});
test('quotes reject living cargo, capacity, funding, route and crew constraints without reservations', () => {
  for (const constraint of ['specimen', 'capacity', 'buyer', 'fuel', 'crew', 'condition', 'provisions', 'money', 'route']) {
    const f = fixture(); let r = route;
    if (constraint === 'specimen') f.request.manifest.commodityKind = 'specimen';
    if (constraint === 'capacity') f.request.cargo.massKg = 121;
    if (constraint === 'buyer') f.state.buyers[0].money = 0;
    if (constraint === 'fuel') f.op.fuelKm = 59;
    if (constraint === 'crew') f.op.crew[0].health = 0;
    if (constraint === 'condition') f.op.condition = 50;
    if (constraint === 'provisions') f.op.provisions = 0;
    if (constraint === 'money') f.op.money = 0;
    if (constraint === 'route') r = { ...route, supportCapable: false };
    const before = JSON.stringify(f.state);
    expect(Market.offer(f.state, f.op.id, f.request, r, 0).ok, constraint).toBe(false); expect(JSON.stringify(f.state)).toBe(before);
  }
});
test('changed or expired quotes require confirmation; cancellation refunds funded escrow exactly once', () => {
  const f = fixture(); expect(f.quote.ok).toBe(true);
  expect(Market.book(f.state, f.quote, f.request, route, 'contract-1', 3601).revised).toBeTruthy();
  expect(Market.book(f.state, f.quote, { ...f.request, value: 501 }, route, 'contract-1', 0).revised).toBeTruthy();
  expect(f.state.buyers[0].money).toBe(10000);
  const result = Market.book(f.state, f.quote, f.request, route, 'contract-1', 0);
  expect(result.ok).toBe(true); expect(f.state.buyers[0].money).toBe(9500);
  expect(Market.cancel(f.state, result.shipment.id, 1)).toBe(true); expect(Market.cancel(f.state, result.shipment.id, 2)).toBe(false);
  expect(f.state.buyers[0].money).toBe(10000); expect(f.op.assignment).toBeNull();
});
test('exact custody, depot freight, foreign receipt and empty return survive reload without duplicate settlement', () => {
  const f = booked(), id = f.sh.id;
  expect(Market.receiveDepot(f.state, id, f.request.manifest, 100)).toBe(0);
  expect(Market.markCollected(f.state, id, { ...f.request.manifest, amount: 2 }, 'collector', 100)).toBe(false);
  expect(Market.markCollected(f.state, id, f.request.manifest, 'collector', 100)).toBe(true);
  expect(Market.cancel(f.state, id, 100)).toBe(false); expect(f.sh.owner).toBe('player');
  expect(Market.receiveDepot(f.state, id, f.request.manifest, 200)).toBe(f.quote.localFreight);
  expect(Market.receiveDepot(f.state, id, f.request.manifest, 200)).toBe(0);
  Market.advance(f.state, 200, [route]); expect(f.sh.phase).toBe('outbound'); expect(Market.settle(f.state, id, 200)).toBe(0);
  const loaded = JSON.parse(JSON.stringify(f.state));
  Market.advance(f.state, 3800, [route]); Market.advance(loaded, 3800, [route]); expect(loaded).toEqual(f.state);
  expect(f.sh).toMatchObject({ phase: 'returning', owner: f.quote.buyerId, custodian: f.quote.buyerId });
  expect(f.sh.manifest).toEqual(f.request.manifest); expect(f.op.assignment).toBe(id);
  expect(Market.settle(f.state, id, 3800)).toBe(f.quote.net); expect(Market.settle(f.state, id, 3800)).toBe(0);
  Market.advance(f.state, 7400, [route]); expect(f.sh.phase).toBe('returned'); expect(f.op.assignment).toBeNull();
  expect(f.sh.manifest).toEqual(f.request.manifest); expect(f.op.fuelKm).toBe(540);
});
test('closed corridors and exhausted resources hold saved cargo and unpaid escrow with no death or replacement', () => {
  const f = booked(); Market.markCollected(f.state, f.sh.id, f.request.manifest, 'collector', 0);
  Market.receiveDepot(f.state, f.sh.id, f.request.manifest, 0); Market.advance(f.state, 0, [route]);
  Market.advance(f.state, 3600, [{ ...route, continuity: 'closed' }]);
  expect(f.sh.positionKm).toBe(0); expect(f.op.provisions).toBeLessThan(40); expect(f.sh.playerEscrow).toBe(f.quote.net);
  f.op.fuelKm = 3; Market.advance(f.state, 7200, [route]); expect(f.sh.positionKm).toBe(3); expect(f.sh.reason).toContain('exhausted');
  const loaded = JSON.parse(JSON.stringify(f.state)); Market.advance(loaded, 9000000, [route]);
  expect(loaded.shipments[0].positionKm).toBe(3); expect(loaded.shipments[0].manifest).toEqual(f.request.manifest);
  expect(loaded.operators[0].crew[0].status).toBe('alive'); expect(loaded.shipments[0].owner).toBe('player');
});

test('large clock steps preserve actual receipt and return times, fuel and food rather than skipping a leg', () => {
  const f = booked(); Market.markCollected(f.state, f.sh.id, f.request.manifest, 'collector', 0);
  Market.receiveDepot(f.state, f.sh.id, f.request.manifest, 0); Market.advance(f.state, 0, [route]);
  const loaded = JSON.parse(JSON.stringify(f.state));
  Market.advance(f.state, 3600, [route]); Market.advance(f.state, 7200, [route]);
  Market.advance(loaded, 7200, [route]);
  expect(loaded.shipments).toEqual(f.state.shipments);
  expect(loaded.shipments[0]).toMatchObject({ phase: 'returned', receiptAt: 3600, returnedAt: 7200 });
  expect(loaded.operators[0].fuelKm).toBeCloseTo(f.op.fuelKm);
  expect(loaded.operators[0].provisions).toBeCloseTo(f.op.provisions);
});

test('raw manifests retain exact source content provenance and finite depot replenishment spends operator funds', () => {
  const f = fixture();
  f.request.manifest = { commodityKind: 'rawByproduct', material: 'trace slime', amount: 3.5,
    entries: [{ kind: 'rawByproduct', amount: 3.5, sourceReceptacleId: 'jar-1', contents: [{ kind: 'byproduct', amount: 3.5, source: 'slime-2' }] }] };
  const quote = Market.offer(f.state, f.op.id, f.request, route, 0);
  const sh = Market.book(f.state, quote, f.request, route, 'raw-contract', 0).shipment;
  Market.markCollected(f.state, sh.id, f.request.manifest, 'collector', 0); Market.receiveDepot(f.state, sh.id, f.request.manifest, 0);
  f.op.fuelKm = 590; const supplier = { routeOpen: true, fuelStockKm: 4 }, money = f.op.money;
  Market.advance(f.state, 0, [route], supplier);
  expect(supplier.fuelStockKm).toBe(0); expect(f.op.fuelKm).toBe(594); expect(f.op.money).toBeCloseTo(money - .2 - quote.hours);
  Market.advance(f.state, 7200, [route]); expect(sh.manifest).toEqual(f.request.manifest);
  expect(sh.owner).toBe(quote.buyerId); expect(sh.playerEscrow).toBe(quote.net);
});
