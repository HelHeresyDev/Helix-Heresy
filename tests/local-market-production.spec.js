const { test, expect } = require('@playwright/test');
const Production = require('../local-market-production');
const Market = require('../city-commodity-market');
const Carrier = require('../local-exchange-carrier');
const hour = 3600;
function setup(families = ['constructionStone']) {
  const context = { cityId: 'a', workshopCapacity: 1, listings: {}, productionSources: families.map(family => ({ id: `a:${family}`, name: family, family, capacity: 1, route: { open: true, distanceKm: 4, cellIds: ['cell:1'], mode: 'groundConvoy' } })) };
  return { state: Production.create(context), supplier: Carrier.support(Carrier.create('a')).supplier, listings: Object.fromEntries(Production.RECIPES.filter(r => r.target === 'exchange').map(r => [r.id, { supply: 0 }])) };
}
const advance = (f, h) => Production.advance(f.state, h * hour, f.listings, f.supplier);

test('raw production, input delivery, processing and final receipt are separate conserved stages', () => {
  const f = setup(); advance(f, 1);
  expect(f.state.shipments[0]).toMatchObject({ cargo: 'constructionStone', quantity: 2, target: 'workshops', delivered: false });
  expect(f.state.inputs.constructionStone || 0).toBe(0); expect(f.listings.stoneBlocks.supply).toBe(0);
  advance(f, 2); expect(f.listings.stoneBlocks.supply).toBe(0);
  advance(f, 3); expect(f.state.workshops[0].produced).toBe(0); expect(f.state.inputs.constructionStone).toBeGreaterThan(0);
  advance(f, 4); expect(f.state.workshops[0].produced).toBeGreaterThan(0); expect(f.listings.stoneBlocks.supply).toBe(0);
  advance(f, 5); expect(f.listings.stoneBlocks.supply).toBeGreaterThan(0);
  const total = f.listings.stoneBlocks.supply;
  advance(f, 5); expect(f.listings.stoneBlocks.supply).toBe(total);
  expect(f.state.trucks).toHaveLength(2);
  expect(f.state.trucks.every(t => t.condition < 100 && t.fuelKm <= 240)).toBe(true);
});

test('reload and elapsed-time chunking preserve inventories, reservations and named trucks', () => {
  const a = setup(['ferrousOre', 'chemicalFeedstock']), b = setup(['ferrousOre', 'chemicalFeedstock']);
  advance(a, 24);
  for (let h = 1; h <= 24; h++) advance(b, h);
  expect(b).toEqual(a);
  const saved = JSON.parse(JSON.stringify(a)); advance(saved, 48); advance(a, 48);
  expect(saved).toEqual(a);
  expect(a.state.receipts.some(r => r.target === 'supplier')).toBe(true);
});

test('blocked routes hold allocated goods and incapable drivers never create replacement shipments', () => {
  const f = setup(); advance(f, 1);
  const original = f.state.shipments[0], truck = f.state.trucks.find(t => t.shipment === original.id);
  f.state.sources[0].route.open = false; truck.driver.health = 0;
  advance(f, 12);
  expect(original.delivered).toBe(false); expect(original.quantity).toBe(2);
  expect(f.listings.stoneBlocks.supply).toBe(0); expect(truck.shipment).toBe(original.id);
  f.state.sources[0].route.open = true; truck.driver.health = 100;
  advance(f, 16); expect(original.delivered).toBe(true);
  expect(f.state.trucks).toHaveLength(2);
});

test('extraction is finite, renewable throughput bounded, and failed utilities prevent manufacturing', () => {
  const f = setup(['constructionStone', 'biologicalProductivity']);
  f.state.sources[0].remaining = 3;
  f.state.workshops.forEach(w => { w.utilities = 0; });
  advance(f, 240);
  expect(f.state.sources[0].produced).toBe(3); expect(f.state.sources[0].remaining).toBe(0);
  expect(f.state.sources[1].produced).toBeLessThanOrEqual(240 * 2);
  expect(f.state.sources.every(s => s.stock <= 96)).toBe(true);
  expect(f.state.workshops.every(w => w.produced === 0)).toBe(true);
  expect(Object.values(f.listings).every(l => l.supply === 0)).toBe(true);
});

test('published local sources exclude foreign strongholds and unsupported satellite transport', () => {
  const directory = { foundations: [{ city: { id: 'a' }, primaryExploitation: { id: 'ferrousOre' } }], satellites: [
    { id: 'foreign', parentId: 'b', exportResource: { id: 'chemicalFeedstock' } },
    { id: 'air', name: 'Air farm', parentId: 'a', exportResource: { id: 'biologicalProductivity' }, localRouteCellIds: ['c1', 'c2'], logistics: { vehicleMode: 'aircraft' } }
  ] };
  const before = JSON.stringify(directory), context = Market.profile('a', directory, null, []), state = Production.create(context);
  expect(JSON.stringify(directory)).toBe(before);
  expect(state.sources.some(s => s.family === 'chemicalFeedstock')).toBe(false);
  expect(state.sources.find(s => s.id === 'air').route.open).toBe(false);
  expect(state.workshops.some(w => w.id === 'satelliteCommunicator')).toBe(false);
  expect(Production.status(state, 'satelliteCommunicator')).toContain('No supported local producer');
  directory.satellites[1].logistics.vehicleMode = 'groundConvoy';
  const routed = Market.profile('a', directory, null, [], () => 37);
  expect(routed.productionSources.find(s => s.id === 'air').route).toMatchObject({ open: true, distanceKm: 37 });
  expect(Market.profile('a', directory, null, [], () => null).productionSources.find(s => s.id === 'air').route.open).toBe(false);
});

test('fuel and maintenance deliveries partition real output without double-counting supplier stores', () => {
  const f = setup(['chemicalFeedstock', 'ferrousOre']);
  f.supplier.fuelStockKm = 0; f.supplier.partsStock = 0;
  advance(f, 48);
  const fuelLots = f.state.receipts.filter(r => r.cargo === 'transportFuel').reduce((n, r) => n + r.quantity, 0);
  expect(fuelLots).toBeGreaterThan(0);
  expect(f.supplier.fuelStockKm).toBeLessThanOrEqual(fuelLots * 20);
  expect(f.supplier.partsStock).toBeGreaterThan(0);
  expect(f.state.depotFuelKm).toBeLessThanOrEqual(1200);
});

test('exhausted logistics stops pickups; local refuelling conserves finite compound stocks', () => {
  const f = setup();
  f.state.depotFuelKm = 0; f.supplier.fuelStockKm = 0;
  f.state.trucks.forEach(t => { t.fuelKm = 0; });
  advance(f, 12);
  expect(f.state.shipments).toHaveLength(0); expect(f.state.sources[0].stock).toBeGreaterThan(0);
  expect(f.state.reason).toContain('fuel');
  f.supplier.fuelStockKm = 100;
  advance(f, 13);
  expect(f.state.shipments).toHaveLength(1);
  expect(f.supplier.fuelStockKm + f.state.depotFuelKm + f.state.trucks.reduce((n, t) => n + t.fuelKm, 0)).toBe(92);
  expect(f.state.trucks).toHaveLength(2);
});
