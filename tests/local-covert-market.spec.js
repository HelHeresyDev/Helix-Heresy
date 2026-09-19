const { test, expect } = require('@playwright/test');
const Market = require('../local-covert-market');
const route = { ok: true, cityId: 'a', distanceKm: 12 };
const cargo = { massKg: 10, volumeL: 10 };
function fixture() {
  const state = Market.create('a', 'Home'), contact = { id: 'contact-1', name: 'Sera Vale' };
  Market.bind(state, contact, 0); return { state, contact, courier: state.couriers[0] };
}
test('contact reach is explicit, city local and independent of remote communications or affiliation', () => {
  const f = fixture(); expect(f.contact).toMatchObject({ homeCityId: 'a', serviceCityIds: ['a'] });
  f.contact.networkId = 'global-network'; f.contact.homeCityId = 'b';
  expect(Market.availability(f.state, f.contact, route, cargo).reason).toContain('Remote contact only');
  Market.bind(f.state, f.contact, 0); expect(f.state.couriers).toHaveLength(1);
  expect(Market.availability(f.state, { ...f.contact, homeCityId: 'a' }, { ...route, cityId: 'b' }, cargo).ok).toBe(false);
});
test('finite identified assets, full return fuel, containment and crew constrain booking without mutations', () => {
  for (const change of ['fuel', 'capacity', 'health', 'condition', 'fatigue', 'specimen', 'route']) {
    const f = fixture(), c = f.courier;
    if (change === 'fuel') c.fuelKm = 23;
    if (change === 'capacity') c.capacityKg = 1;
    if (change === 'health') c.driver.health = 0;
    if (change === 'condition') c.condition = 49;
    if (change === 'fatigue') c.driver.fatigue = 79;
    if (change === 'specimen') c.specimenCapable = false;
    const before = JSON.stringify(f), result = Market.book(f.state, f.contact, { ...route, ok: change !== 'route' }, 'contract-1', { ...cargo, specimen: true }, 0);
    expect(result.ok, change).toBe(false); expect(JSON.stringify(f), change).toBe(before);
  }
});
test('courier arrival, exact handoff, buyer ownership and loaded return persist without duplicate transfers', () => {
  const f = fixture(), booking = Market.book(f.state, f.contact, route, 'contract-1', cargo, 100);
  expect(booking.ok).toBe(true); expect(Market.handoff(f.state, 'contract-1', {}, 100)).toBe(false);
  Market.advance(f.state, 1000, route); expect(booking.collection.positionKm).toBe(6);
  const loaded = JSON.parse(JSON.stringify(f));
  Market.advance(f.state, 1900, route); Market.advance(loaded.state, 1900, route); expect(loaded.state).toEqual(f.state);
  const manifest = { entries: [{ creature: { id: 'slime-7', name: 'Moss', genome: [1, 2], health: 95 }, pod: { id: 'pod-2' } }] };
  expect(Market.handoff(f.state, 'contract-1', manifest, 1900)).toBe(true);
  expect(Market.handoff(f.state, 'contract-1', manifest, 1900)).toBe(false);
  expect(Market.cancel(f.state, 'contract-1', 1900)).toBe(false);
  expect(booking.collection.owner).toBe(f.contact.id); expect(booking.collection.manifest).toEqual(manifest);
  expect(Market.availability(f.state, f.contact, route, cargo).ok).toBe(false);
  Market.advance(f.state, 3700, route); expect(booking.collection.phase).toBe('returned'); expect(f.courier.assignment).toBe(null);
  expect(f.courier.fuelKm).toBe(136); expect(booking.collection.manifest).toEqual(manifest);
});
test('holds and interrupted pickups preserve position and cargo; empty returns never teleport assets', () => {
  const f = fixture(), sh = Market.book(f.state, f.contact, route, 'deal-1', cargo, 0).collection;
  Market.advance(f.state, 900, route); expect(sh.positionKm).toBe(6);
  Market.advance(f.state, 3600, { ...route, ok: false }); expect(sh.positionKm).toBe(6);
  expect(Market.cancel(f.state, 'deal-1', 3600)).toBe(true); expect(f.courier.assignment).toBe(sh.id);
  Market.advance(f.state, 4500, route); expect(sh.phase).toBe('canceled'); expect(f.courier.fuelKm).toBe(148);
  expect(sh.manifest).toBe(null); expect(Market.cancel(f.state, 'deal-1', 4500)).toBe(false);
});
test('fuel replenishment debits a separate operator and actual finite supplier stocks', () => {
  const f = fixture(); f.courier.fuelKm = 1; f.courier.money = .1;
  const supplier = { routeOpen: true, fuelStockKm: 1 };
  Market.advance(f.state, 100, route, supplier);
  expect(f.courier.fuelKm).toBe(2); expect(supplier.fuelStockKm).toBe(0); expect(f.courier.money).toBeCloseTo(.05);
  Market.advance(f.state, 200, route, supplier); expect(f.courier.fuelKm).toBe(2);
});
test('only public relevant city facts change terms; doctrine never creates a legal ruling or evidence', () => {
  const context = { cityId: 'a', productionSources: [{ family: 'chemicalFeedstock' }], listings: { assayReagent: { targetDemand: 1.2 } },
    institutions: [{ standing: 'proscribed' }], beliefs: ['unconsented experimentation'], hiddenAlignment: 'evil', hiddenNetworkCapacity: 100 };
  const q = Market.terms(context, 'manufactured', [], 'product');
  expect(q.multiplier).toBeGreaterThan(1); expect(q.requireAssay).toBe(true); expect(q.exposureDelta).toBe(.015);
  expect(q.summary).toContain('No additional product-specific local legal ruling');
  expect(q.summary).not.toMatch(/evil|100/); expect(q).not.toHaveProperty('guilt');
  expect(Market.terms({ ...context, hiddenAlignment: 'good' }, 'manufactured', [], 'product')).toEqual(q);
  const restricted = Market.terms({ ...context, restrictions: [{ productId: 'product', known: true, label: 'Published licensed-only ruling' }] }, 'manufactured', [], 'product');
  expect(restricted.exposureDelta).toBeGreaterThan(q.exposureDelta); expect(restricted.summary).toContain('licensed-only');
  const civic = Market.terms({ ...context, lawRules: [{ offenseId: 'corporateLicensing', label: 'Corporate licensing', legalStatus: 'restricted' }], marketListings: { assayReagent: { supply: 0 } } }, 'manufactured', [], 'product');
  expect(civic.exposureDelta).toBeGreaterThan(q.exposureDelta); expect(civic.multiplier).toBeGreaterThan(q.multiplier);
  expect(civic.summary).toContain('do not establish');
});
