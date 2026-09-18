const { test, expect } = require('@playwright/test');
const Market = require('../city-commodity-market');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const Trade = require('../intercity-trade');
const HOUR = 3600, copy = x => JSON.parse(JSON.stringify(x));
const defs = [['refinedConductors', 10], ['preparedManaCrystals', 16], ['relayAssembly', 58], ['relayBattery', 20], ['satelliteCommunicator', 120], ['glass', 14], ['rubber', 13], ['metalParts', 19]].map(([id, basePrice]) => ({ id, label: id, basePrice, supply: 40, liquidity: 10 }));
function fixture(cityId = 'a') {
  const directory = { foundations: [{ city: { id: cityId, name: cityId }, primaryExploitation: { id: 'baseMetalOre' }, secondaryExploitation: { id: 'manaCrystals' } }], satellites: [{ id: `${cityId}:chem`, parentId: cityId, sizeBand: 'town', exportResource: { id: 'chemicalFeedstock' }, localRouteCellIds: ['c'], logistics: { vehicleMode: 'groundConvoy' } }] };
  const current = { cityRows: [{ cityId, physicalCondition: 'intact', services: { utilities: 'functional', transport: 'functional' } }] };
  const capabilities = { cityProfiles: [{ city: { id: cityId }, deployedCapabilityIds: ['industrialFabrication', 'standardManaPower', 'regionalDataRelays'] }], milestones: [
    ['industrialFabrication', 'industrialWorks', ['precisionManufacturing', 'chemicalIndustry']], ['standardManaPower', 'powerWorks', ['powerEngineering']], ['regionalDataRelays', 'regionalRelayHub', ['relayEngineering']]
  ].map(([id, fn, roles]) => ({ capability: { id }, institution: { roles }, infrastructureSites: [{ id: `${cityId}:${fn}`, cityId, function: fn, operationalAtPlayableYear: true }] })) };
  return { directory, current, capabilities };
}
function profile(f = fixture(), cityId = 'a') { return Market.profile(cityId, f.directory, f.current, defs, null, f.capabilities); }
function setup() {
  const context = profile();
  return { state: Production.create(context), listings: Object.fromEntries(defs.map(d => [d.id, { supply: 40, demand: 1 }])), supplier: Carrier.support(Carrier.create('a')).supplier };
}
const advance = (f, h) => Production.advance(f.state, h * HOUR, f.listings, f.supplier);

test('precision factories need local deployed industrial and specialist sites, not global knowledge or a gateway', () => {
  const original = fixture(), before = copy(original);
  expect(profile(original).manufacturingFacilities.map(f => f.kind)).toEqual(expect.arrayContaining(['metalRefinery', 'crystalWorks', 'batteryWorks', 'electronicsWorks']));
  for (const role of ['site', 'deployment', 'expertise']) {
    const f = fixture();
    if (role === 'site') f.capabilities.milestones[0].infrastructureSites = [];
    if (role === 'deployment') f.capabilities.cityProfiles[0].deployedCapabilityIds = ['standardManaPower', 'regionalDataRelays'];
    if (role === 'expertise') f.capabilities.milestones[0].institution.roles = [];
    expect(profile(f).manufacturingFacilities, role).toEqual([]);
  }
  const f = fixture(); f.capabilities.milestones[2].infrastructureSites[0].cityId = 'foreign';
  expect(profile(f).manufacturingFacilities.some(f => f.kind === 'electronicsWorks')).toBe(false);
  f.capabilities.milestones[1].institution.roles = [];
  expect(profile(f).manufacturingFacilities.some(f => ['batteryWorks', 'crystalWorks'].includes(f.kind))).toBe(false);
  expect(original).toEqual(before);
});

test('precision recipes consume exact inputs and installed battery, pause on power loss, and finish only after work', () => {
  for (const recipe of Production.PRECISION_RECIPES) {
    const f = setup(); f.state.sources = []; f.state.trucks = []; f.state.workshops = f.state.workshops.filter(w => w.id === recipe.id);
    Object.assign(f.state.inputs, recipe.inputs); advance(f, 1);
    expect(Object.values(f.state.inputs).every(n => n === 0), recipe.id).toBe(true);
    const facility = f.state.facilities.find(candidate => candidate.id === f.state.workshops[0].facilityId);
    facility.utilities = 0; advance(f, 5); expect(f.state.workshops[0].progress).toBe(1);
    expect(Production.status(f.state, recipe.id)).toContain('utilities');
    const restored = copy(f); facility.utilities = 1; restored.state.facilities.find(f => f.id === facility.id).utilities = 1;
    advance(f, 5 + recipe.hours - 1); advance(restored, 5 + recipe.hours - 1);
    expect(restored).toEqual(f); expect(f.state.workshops[0].stock, recipe.id).toBe(recipe.output);
    advance(f, 24); expect(f.state.workshops[0].stock, recipe.id).toBe(recipe.output);
  }
  expect(Production.PRECISION_RECIPES.find(r => r.id === 'satelliteCommunicator').inputs.relayBattery).toBe(1);
});

test('ore and crystals remain finite extraction allocations and require raw pickup before refining', () => {
  const f = setup(); f.state.workshops = f.state.workshops.filter(w => ['refinedConductors', 'preparedManaCrystals'].includes(w.id));
  f.state.sources = f.state.sources.filter(s => ['baseMetalOre', 'manaCrystals'].includes(s.family));
  f.state.sources.forEach(s => { s.remaining = 2; });
  advance(f, 1); expect(f.state.inputs.baseMetalOre || 0).toBe(0); expect(f.state.shipments).toHaveLength(2);
  advance(f, 3); expect(f.state.workshops.every(w => w.produced === 0)).toBe(true);
  advance(f, 5); expect(f.state.workshops.every(w => w.produced === 0)).toBe(true);
  advance(f, 6); expect(f.listings.refinedConductors.supply).toBe(40);
  advance(f, 7); expect(f.listings.refinedConductors.supply).toBe(43); expect(f.listings.preparedManaCrystals.supply).toBe(42);
  advance(f, 48); expect(f.state.sources.every(s => s.remaining === 0 && s.produced === 2)).toBe(true);
  expect(f.state.workshops.map(w => w.produced)).toEqual([3, 2]);
});

test('empty components, budget and unavailable carrier cannot manufacture or teleport a communicator', () => {
  for (const blocker of ['components', 'money', 'transport']) {
    const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'satelliteCommunicator');
    if (blocker === 'components') Object.values(f.listings).forEach(l => { l.supply = 0; });
    if (blocker === 'money') f.state.finance.money = 0;
    if (blocker === 'transport') f.state.trucks.forEach(t => { t.driver.health = 0; });
    advance(f, 24); expect(f.state.workshops[0].produced, blocker).toBe(0); expect(f.state.finance.spent, blocker).toBe(0);
    expect(Production.status(f.state, 'satelliteCommunicator')).toContain('Awaiting physically delivered inputs');
  }
});

test('electronics lines share factory capacity, conserve funds and persist delayed equipment escrow', () => {
  const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'satelliteCommunicator');
  Object.assign(f.state.inputs, f.state.workshops[0].inputs);
  Object.values(f.listings).forEach(l => { l.supply = 0; });
  advance(f, 4);
  const shipment = f.state.shipments.find(s => s.cargo === 'satelliteCommunicator'); expect(shipment.escrow).toBeGreaterThan(0);
  expect(f.listings.satelliteCommunicator.supply).toBe(0); expect(f.state.finance.earned).toBe(0);
  f.state.facilities.find(f => f.kind === 'electronicsWorks').routeOpen = false;
  const saved = copy(f); advance(f, 8); for (let h = 5; h <= 8; h++) advance(saved, h); expect(saved).toEqual(f);
  expect(shipment.delivered).toBe(false);
  f.state.facilities.find(f => f.kind === 'electronicsWorks').routeOpen = true;
  const locked = shipment.escrow; f.listings.satelliteCommunicator.demand = 0.6;
  advance(f, 9); expect(f.state.finance.earned).toBe(locked); expect(shipment.escrow).toBe(0); expect(f.listings.satelliteCommunicator.supply).toBe(1);
  expect(f.state.finance.money + f.state.finance.exchangeMoney).toBeCloseTo(7500);
  const both = setup(); both.state.sources = []; both.state.trucks = []; both.state.workshops = both.state.workshops.filter(w => w.facility === 'electronicsWorks');
  Object.assign(both.state.inputs, { refinedConductors: 2, preparedManaCrystals: 2, glass: 2, metalParts: 2, relayAssembly: 2, rubber: 2, relayBattery: 2 });
  advance(both, 4); expect(both.state.workshops.reduce((n, w) => n + w.produced, 0)).toBe(1);
});

test('specialist assembly city can import components physically without acquiring mines or new factories', () => {
  const foreignFixture = fixture('b'); foreignFixture.directory.foundations[0].primaryExploitation = { id: 'constructionStone' }; foreignFixture.directory.foundations[0].secondaryExploitation = null; foreignFixture.directory.satellites = [];
  const foreign = profile(foreignFixture, 'b');
  expect(foreign.manufacturingFacilities.map(f => f.kind)).toEqual(['electronicsWorks']);
  const home = profile(), route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 20, supportCapable: true, continuity: 'continuous' };
  const trade = Trade.create(home, [foreign], [route], [{ corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }], defs);
  const n = trade.neighbors[0]; n.production.sources = []; n.production.workshops = n.production.workshops.filter(w => w.id === 'satelliteCommunicator');
  n.listings.relayAssembly.supply = 0;
  const f = setup(); f.listings.relayAssembly.supply = 160;
  Trade.advance(trade, HOUR, f.listings, f.supplier, defs);
  const sh = trade.shipments.find(s => s.good === 'relayAssembly'); expect(sh).toBeTruthy(); expect(sh.delivered).toBe(false);
  expect(n.production.inputs.relayAssembly || 0).toBe(0);
  Trade.advance(trade, 3 * HOUR, f.listings, f.supplier, defs); expect(sh.delivered).toBe(true); expect(n.production.workshops[0].produced).toBe(0);
  Trade.advance(trade, 20 * HOUR, f.listings, f.supplier, defs);
  expect(n.production.workshops[0].produced).toBeGreaterThan(0);
  expect(n.production.facilities.map(f => f.kind)).toEqual(['electronicsWorks']);
});

test('complete precision chain replenishes empty component and equipment listings without seed components', () => {
  const a = setup();
  for (const recipe of Production.PRECISION_RECIPES) a.listings[recipe.id].supply = 0;
  // A productive extraction allocation isolates chain feasibility from the
  // deliberately low throughput of the small satellite in the shared fixture.
  a.state.sources.forEach(s => { s.capacity = 1; s.labour = 1; });
  const b = copy(a); advance(a, 120);
  for (let h = 1; h <= 120; h++) advance(b, h);
  expect(b).toEqual(a);
  for (const recipe of Production.PRECISION_RECIPES) expect(a.state.workshops.find(w => w.id === recipe.id).produced, recipe.id).toBeGreaterThan(0);
  expect(a.state.finance.money).toBeGreaterThanOrEqual(0);
  expect(a.state.finance.exchangeMoney).toBeGreaterThanOrEqual(0);
  expect(a.state.trucks).toHaveLength(2);
  expect(a.state.finance.money + a.state.finance.exchangeMoney + a.state.shipments.reduce((n, s) => n + s.escrow, 0)).toBeCloseTo(7500);
});
