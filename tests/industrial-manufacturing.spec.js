const { test, expect } = require('@playwright/test');
const Market = require('../city-commodity-market');
const Production = require('../local-market-production');
const Carrier = require('../local-exchange-carrier');
const Trade = require('../intercity-trade');
const HOUR = 3600;
const copy = x => JSON.parse(JSON.stringify(x));
const defs = Production.INDUSTRIAL_RECIPES.map(r => ({ id: r.id, label: r.id, basePrice: 12, supply: 40, liquidity: 10 }));
function profile(cityId = 'a', families = ['industrialMinerals', 'chemicalFeedstock', 'timberFiber']) {
  const directory = { foundations: [{ city: { id: cityId, name: cityId }, primaryExploitation: { id: families[0] }, secondaryExploitation: { id: families[1] } }], satellites: families.slice(2).map((family, i) => ({ id: `${cityId}:sat-${i}`, parentId: cityId, exportResource: { id: family }, localRouteCellIds: ['c'], logistics: { vehicleMode: 'groundConvoy' } })) };
  const current = { cityRows: [{ cityId, physicalCondition: 'intact', services: { utilities: 'functional', transport: 'functional' } }] };
  const capabilities = { cityProfiles: [{ city: { id: cityId }, deployedCapabilityIds: ['standardManaPower', 'industrialFabrication'] }], milestones: [{ capability: { id: 'industrialFabrication' }, institution: { roles: ['precisionManufacturing', 'chemicalIndustry'] }, infrastructureSites: [{ id: `works:${cityId}`, cityId, function: 'industrialWorks', operationalAtPlayableYear: true }] }] };
  return { directory, current, capabilities, context: Market.profile(cityId, directory, current, defs, null, capabilities) };
}
function setup() {
  const context = profile().context;
  return { state: Production.create(context), listings: Object.fromEntries(defs.map(d => [d.id, { supply: 40, demand: 1 }])), supplier: Carrier.support(Carrier.create('a')).supplier };
}
const advance = (f, hours) => Production.advance(f.state, hours * HOUR, f.listings, f.supplier);
const funds = f => f.state.finance.money + f.state.finance.exchangeMoney + f.state.shipments.reduce((n, s) => n + s.escrow, 0);

test('factory specialisms require deployed sites, power and expertise, not resources or knowledge alone', () => {
  const f = profile(), before = JSON.stringify(f);
  expect(f.context.manufacturingFacilities.map(x => x.kind)).toEqual(['glassworks', 'textileWorks', 'chemicalWorks', 'medicalSupplies']);
  expect(Market.profile('a', f.directory, f.current, defs).manufacturingFacilities).toEqual([]);
  const missing = copy(f.capabilities); missing.milestones[0].infrastructureSites = [];
  expect(Market.profile('a', f.directory, f.current, defs, null, missing).manufacturingFacilities).toEqual([]);
  missing.milestones = copy(f.capabilities.milestones); missing.cityProfiles[0].deployedCapabilityIds = ['industrialFabrication'];
  expect(Market.profile('a', f.directory, f.current, defs, null, missing).manufacturingFacilities).toEqual([]);
  const unskilled = copy(f.capabilities); unskilled.milestones[0].institution.roles = [];
  expect(Market.profile('a', f.directory, f.current, defs, null, unskilled).manufacturingFacilities).toEqual([]);
  expect(profile('b', ['ferrousOre']).context.manufacturingFacilities).toEqual([]);
  expect(JSON.stringify(f)).toBe(before);
  expect(Production.create(f.context).workshops.some(w => ['relayBattery', 'satelliteCommunicator'].includes(w.id))).toBe(false);
});

test('procurement pays and reserves actual stock before pickup; receipts cannot feed preceding work', () => {
  const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'medicalBandage');
  advance(f, 1);
  const sh = f.state.shipments.find(s => s.cargo === 'cloth');
  expect(sh).toMatchObject({ procurement: true, quantity: 8, delivered: false, pickupAt: 2 * HOUR, arriveAt: 3 * HOUR });
  expect(f.listings.cloth.supply).toBe(32); expect(f.state.inputs.cloth || 0).toBe(0);
  expect(f.state.finance.spent).toBeGreaterThan(0); expect(funds(f)).toBeCloseTo(7500);
  advance(f, 3); expect(f.state.workshops[0].produced).toBe(0); expect(f.state.inputs.cloth).toBe(8);
  advance(f, 4); expect(f.state.inputs.cloth).toBe(6); expect(f.state.workshops[0].progress).toBe(1);
  expect(f.listings.medicalBandage.supply).toBe(40);
  advance(f, 5); expect(f.state.workshops[0].produced).toBe(4);
  for (let h = 6; h <= 12 && !f.state.shipments.some(s => s.cargo === 'medicalBandage'); h++) advance(f, h);
  const sale = f.state.shipments.find(s => s.cargo === 'medicalBandage');
  expect(sale.escrow).toBeGreaterThan(0); expect(f.state.finance.earned).toBe(0);
  const locked = sale.escrow;
  f.listings.medicalBandage.demand = 1.8;
  const arrival = sale.arriveAt / HOUR;
  advance(f, arrival); expect(f.state.finance.earned).toBe(locked); expect(sale.escrow).toBe(0);
  expect(f.listings.medicalBandage.supply).toBe(40 + sale.quantity); expect(funds(f)).toBeCloseTo(7500);
  advance(f, arrival); expect(f.state.finance.earned).toBe(locked);
});

test('one shared facility processes one saved workpiece and pauses without duplicating inputs', () => {
  const f = setup(); f.state.sources = []; f.state.trucks = [];
  f.state.workshops = f.state.workshops.filter(w => w.facility === 'chemicalWorks');
  Object.assign(f.state.inputs, { chemicalFeedstock: 20, glass: 20, rubber: 20 });
  advance(f, 1);
  const facility = f.state.facilities.find(f => f.kind === 'chemicalWorks');
  expect(f.state.workshops.filter(w => w.progress > 0)).toHaveLength(1);
  expect(f.state.inputs.chemicalFeedstock).toBe(18);
  const workpiece = facility.activeRecipe, progress = f.state.workshops.find(w => w.id === workpiece).progress;
  facility.expertise = []; advance(f, 5);
  expect(f.state.inputs.chemicalFeedstock).toBe(18); expect(f.state.workshops.find(w => w.id === workpiece).progress).toBe(progress);
  expect(Production.status(f.state, workpiece)).toContain('expertise');
  facility.expertise = ['chemicalProcessing']; facility.utilities = 0; advance(f, 6);
  expect(f.state.workshops.every(w => w.produced === 0)).toBe(true);
  facility.utilities = 1; advance(f, 7);
  expect(f.state.workshops.find(w => w.id === workpiece).produced).toBe(3);
  expect(f.state.inputs.chemicalFeedstock).toBe(18);
});

test('finite budgets, empty exchange, missing utilities and failed transport prevent replenishment', () => {
  for (const blocker of ['money', 'stock', 'trucks', 'route', 'utilities']) {
    const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'medicalBandage');
    if (blocker === 'money') f.state.finance.money = 0;
    if (blocker === 'stock') { f.listings.cloth.supply = 0; f.listings.neutralizingWash.supply = 0; }
    if (blocker === 'trucks') f.state.trucks.forEach(t => { t.driver.health = 0; });
    if (blocker === 'route') f.state.facilities.forEach(f => { f.routeOpen = false; });
    if (blocker === 'utilities') f.state.facilities.forEach(f => { f.utilities = 0; });
    advance(f, 24);
    expect(f.state.workshops[0].produced, blocker).toBe(0); expect(f.state.finance.spent, blocker).toBe(0);
  }
  const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'glass');
  f.state.inputs.industrialMinerals = 2; f.state.finance.exchangeMoney = 0;
  advance(f, 12); expect(f.state.workshops[0].stock).toBe(2); expect(f.listings.glass.supply).toBe(40);
});

test('delayed industrial output retains cargo and locked escrow through reload and settles once', () => {
  const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => w.id === 'glass');
  f.state.inputs.industrialMinerals = 2; advance(f, 2);
  const sh = f.state.shipments[0], amount = sh.escrow;
  const truck = f.state.trucks.find(t => t.shipment === sh.id); truck.driver.health = 0;
  advance(f, 8); expect(sh.delivered).toBe(false); expect(sh.escrow).toBe(amount);
  const restored = copy(f); advance(restored, 12); advance(f, 12); expect(restored).toEqual(f);
  truck.driver.health = 100; advance(f, 13);
  expect(sh.delivered).toBe(true); expect(f.state.finance.earned).toBe(amount); expect(funds(f)).toBeCloseTo(7500);
});

test('procured intermediates are not advertised as incoming exchange stock and closed receiving routes hold cargo', () => {
  const f = setup(); f.state.sources = []; f.state.workshops = f.state.workshops.filter(w => ['glass', 'assayReagent'].includes(w.id));
  advance(f, 1);
  const sh = f.state.shipments.find(s => s.procurement && s.cargo === 'glass'); expect(sh).toBeTruthy();
  expect(Production.status(f.state, 'glass')).not.toContain('Incoming allocated shipment');
  f.state.facilities.forEach(f => { f.routeOpen = false; });
  const paid = f.state.finance.spent, stock = f.listings.glass.supply;
  advance(f, 6); expect(sh.delivered).toBe(false); expect(f.state.inputs.glass || 0).toBe(0);
  expect(f.state.finance.spent).toBe(paid); expect(f.listings.glass.supply).toBe(stock);
  f.state.facilities.forEach(f => { f.routeOpen = true; });
  advance(f, 8); expect(sh.delivered).toBe(true); expect(f.state.inputs.glass).toBe(sh.quantity);
});

test('industrial chains preserve deterministic save state and bounded stocks across long and hourly waits', () => {
  const a = setup(), b = setup(); advance(a, 96);
  for (let h = 1; h <= 96; h++) advance(b, h);
  expect(b).toEqual(a); const saved = copy(a); advance(saved, 120); advance(a, 120); expect(saved).toEqual(a);
  expect(a.state.workshops.filter(w => w.facilityId).some(w => w.produced > 0)).toBe(true);
  expect(a.state.workshops.every(w => w.stock <= 96)).toBe(true);
  expect(Object.values(a.state.inputs).every(n => n >= 0 && n <= 192)).toBe(true);
  expect(funds(a)).toBeCloseTo(7500); expect(a.state.finance.money).toBeGreaterThanOrEqual(0);
});

test('every industrial recipe consumes its exact inputs once and needs its own processing time', () => {
  for (const recipe of Production.INDUSTRIAL_RECIPES) {
    const f = setup(); f.state.sources = []; f.state.trucks = []; f.state.workshops = f.state.workshops.filter(w => w.id === recipe.id);
    Object.assign(f.state.inputs, recipe.inputs);
    advance(f, recipe.hours - 1);
    expect(f.state.workshops[0].produced, recipe.id).toBe(0);
    expect(Object.values(f.state.inputs).every(n => n === 0), recipe.id).toBe(true);
    advance(f, recipe.hours);
    expect(f.state.workshops[0].produced, recipe.id).toBe(recipe.output);
    advance(f, recipe.hours + 10);
    expect(f.state.workshops[0].produced, recipe.id).toBe(recipe.output);
  }
});

test('neighbor factories use the same saved industrial rules and physical imports feed production only after receipt', () => {
  const home = profile().context, neighbor = profile('b', ['chemicalFeedstock']).context;
  const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 20, supportCapable: true, continuity: 'continuous' };
  const trade = Trade.create(home, [neighbor], [route], [{ corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }], defs);
  const n = trade.neighbors[0]; n.production.sources = []; n.production.workshops = n.production.workshops.filter(w => w.id === 'assayReagent');
  n.production.inputs.chemicalFeedstock = 20;
  Object.values(n.listings).forEach(l => { l.supply = 40; }); n.listings.glass.supply = 0;
  const f = setup(); f.listings.glass.supply = 180;
  Trade.advance(trade, HOUR, f.listings, f.supplier, defs);
  const sh = trade.shipments.find(s => s.good === 'glass'); expect(sh).toBeTruthy(); expect(sh.delivered).toBe(false);
  expect(n.production.inputs.glass || 0).toBe(0);
  Trade.advance(trade, 3 * HOUR, f.listings, f.supplier, defs); expect(sh.delivered).toBe(true);
  expect(n.production.workshops[0].produced).toBe(0);
  Trade.advance(trade, 12 * HOUR, f.listings, f.supplier, defs);
  expect(n.production.workshops[0].produced).toBeGreaterThan(0);
  expect(n.production.finance.spent).toBeGreaterThan(0);
});
