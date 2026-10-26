const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const { inputs } = require('./helpers/municipal-fuel-source');
const copy = x => JSON.parse(JSON.stringify(x));
function setup() {
  const { profile } = inputs(); profile.commodityDefinitions = [P.FUEL_DEFINITION,
    { id: 'preparedManaCrystals', basePrice: 18, supply: 36 }, { id: 'manaCrystals', basePrice: 8, supply: 36 }];
  return { state: P.create(profile), listings: { arcaneFeedstock: { supply: 0, demand: 1 },
    preparedManaCrystals: { supply: 0, demand: 1 }, manaCrystals: { supply: 36, demand: 1 } },
    supplier: Carrier.support(Carrier.create('a')).supplier };
}
test('arcane fuel requires real crystal extraction, finite financed freight, shared factory work and exchange delivery, with conserved inputs and no stock reset', () => {
  const f = setup();
  P.advance(f.state, 3600, f.listings, f.supplier); assert.equal(f.listings.arcaneFeedstock.supply, 0);
  const initialStock = 36;
  for (let h = 2; h <= 32; h++) P.advance(f.state, h * 3600, f.listings, f.supplier);
  const fuel = f.state.workshops.find(w => w.id === 'arcaneFeedstock'), crystal = f.state.workshops.find(w => w.id === 'preparedManaCrystals');
  assert.ok(fuel.produced > 0); assert.ok(f.listings.arcaneFeedstock.supply > 0); assert.ok(f.state.finance.spent > 0);
  const sold = f.listings.arcaneFeedstock.supply;
  assert.equal(fuel.produced, fuel.stock + sold + f.state.shipments.filter(s => s.cargo === 'arcaneFeedstock' && !s.delivered).reduce((n, s) => n + s.quantity, 0));
  const raw = f.state.sources[0], active = f.state.facilities[0].activeRecipe ? 2 : 0;
  const transit = f.state.shipments.filter(s => s.cargo === 'manaCrystals' && !s.delivered).reduce((n, s) => n + s.quantity, 0);
  assert.equal(raw.produced + initialStock, raw.stock + transit + (f.state.inputs.manaCrystals || 0) + f.listings.manaCrystals.supply + fuel.produced + crystal.produced + active);
  const before = copy(f); P.advance(f.state, 32 * 3600, f.listings, f.supplier); assert.deepEqual(f, before);
  assert.equal(f.state.trucks.length, 2);
});
test('missing expertise, interrupted factory utility, and legacy migration cannot create fuel or replay old production hours', () => {
  const f = setup(); f.state.facilities[0].utilities = 0; P.advance(f.state, 24 * 3600, f.listings, f.supplier);
  assert.equal(f.listings.arcaneFeedstock.supply, 0); assert.equal(f.state.workshops.find(w => w.id === 'arcaneFeedstock').produced, 0);
  const legacy = setup(); legacy.state.workshops = legacy.state.workshops.filter(w => w.id !== 'arcaneFeedstock'); delete legacy.state.fuelRecipeInitialized;
  legacy.state.inputs.manaCrystals = 24; legacy.state.trucks.forEach(t => t.shipment = 'original-other-contract');
  P.advance(legacy.state, 24 * 3600, legacy.listings, legacy.supplier);
  let w = legacy.state.workshops.find(w => w.id === 'arcaneFeedstock'); assert.equal(w.stock, 0); assert.equal(w.produced, 0); assert.equal(w.availableFrom, 24 * 3600);
  legacy.state.workshops = legacy.state.workshops.filter(w => w.id !== 'arcaneFeedstock');
  P.ensureFuelRecipe(legacy.state, 25 * 3600); w = legacy.state.workshops.find(w => w.id === 'arcaneFeedstock');
  assert.equal(w.accountLost, true); P.advance(legacy.state, 40 * 3600, legacy.listings, legacy.supplier); assert.equal(w.produced, 0);
  const absent = setup(); absent.state.facilities = []; assert.doesNotThrow(() => P.ensureFuelRecipe(absent.state, 40 * 3600));
});
test('original precision products and fuel share one factory; hourly, coarse and saved processing consume identical resources', () => {
  const a = setup(), b = setup(), c = setup();
  P.advance(a.state, 24 * 3600, a.listings, a.supplier);
  for (let h = 1; h <= 24; h++) P.advance(b.state, h * 3600, b.listings, b.supplier);
  P.advance(c.state, 7 * 3600, c.listings, c.supplier); c.state = copy(c.state); P.advance(c.state, 24 * 3600, c.listings, c.supplier);
  assert.deepEqual(a, b); assert.deepEqual(a, c);
  const works = a.state.workshops.filter(w => w.facilityId);
  assert.ok(works.every(w => w.progress < w.hours));
  assert.ok(works.reduce((n, w) => n + w.produced / w.output * w.hours + w.progress, 0) <= 24);
});
