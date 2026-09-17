const { test, expect } = require('@playwright/test');
const Trade = require('../intercity-trade');
const Carrier = require('../local-exchange-carrier');
const H = 3600;
const defs = [{ id: 'steelPanels', basePrice: 24, supply: 50, liquidity: 10, buyable: true, sellable: true }];
const profile = (id, targetSupply) => ({ cityId: id, cityName: id, productionSources: [], workshopCapacity: 1, listings: { steelPanels: { targetSupply, targetDemand: 1 } } });
function fixture() {
  const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 38, supportCapable: true, continuity: 'operational', cellPath: ['a1', 'b1'] };
  const permission = { corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }], operatorId: 'transport' };
  return { state: Trade.create(profile('a', 50), [profile('b', 120), profile('c', 200)], [route, { ...route, id: 'bc', endpointCityIds: ['b', 'c'] }], [permission], defs), home: { steelPanels: { supply: 1, demand: 1 } }, supplier: Carrier.support(Carrier.create('a')).supplier };
}
const advance = (f, hour) => Trade.advance(f.state, hour * H, f.home, f.supplier, defs);
test('direct-neighbor import reserves source goods and funded payment then settles only at arrival', () => {
  const f = fixture(); advance(f, 1);
  expect(f.state.neighbors.map(n => n.id)).toEqual(['b']); expect(f.state.operators).toHaveLength(1);
  const s = f.state.shipments[0], operator = f.state.operators[0];
  expect(s).toMatchObject({ sourceId: 'b', destinationId: 'a', quantity: 24, delivered: false, pickedUp: false });
  expect(f.state.neighbors[0].listings.steelPanels.supply).toBe(96); expect(f.home.steelPanels.supply).toBe(1);
  expect(f.state.homeTreasury).toBeCloseTo(10000 - s.escrow);
  const cash = operator.money; advance(f, 4); expect(s.delivered).toBe(false);
  advance(f, 5); expect(s.delivered).toBe(true); expect(s.returned).toBe(true);
  expect(f.home.steelPanels.supply).toBe(25); expect(operator.money).toBeGreaterThan(cash);
  expect(operator.location).toBe('a'); expect(operator.fuelKm).toBe(524);
  const saved = JSON.stringify(f); advance(f, 5); expect(JSON.stringify(f)).toBe(saved);
});
test('route and permit holds preserve custody and position, consume provisions and never fabricate rescue', () => {
  const f = fixture(); advance(f, 2);
  const op = f.state.operators[0], s = f.state.shipments[0], distance = s.travelledKm;
  op.permit.approvals[1].allowed = false;
  advance(f, 3); expect(s.travelledKm).toBe(distance); expect(s.delivered).toBe(false);
  op.permit.approvals[1].allowed = true; advance(f, 6); expect(s.delivered).toBe(true);
  const stranded = fixture(); advance(stranded, 1); stranded.state.operators[0].route.supportCapable = false;
  advance(stranded, 40);
  expect(stranded.state.shipments[0].delivered).toBe(false);
  expect(stranded.state.operators[0].reason).toContain('provisions exhausted');
  expect(stranded.state.operators[0].crew.every(c => c.status === 'alive')).toBe(true);
  expect(stranded.home.steelPanels.supply).toBe(1);
});
test('range, source reserves, treasury, road and permission independently constrain trade', () => {
  for (const failure of ['range', 'reserve', 'funds', 'road', 'permit']) {
    const f = fixture(), op = f.state.operators[0];
    if (failure === 'range') op.route.distanceKm = 1000;
    if (failure === 'reserve') f.state.neighbors[0].reserveFraction = 1;
    if (failure === 'funds') f.state.homeTreasury = 0;
    if (failure === 'road') op.route.supportCapable = false;
    if (failure === 'permit') op.permit.approvals[0].allowed = false;
    advance(f, 1); expect(f.state.shipments).toHaveLength(0); expect(f.home.steelPanels.supply).toBe(1);
    expect(op.reason).not.toBe('');
  }
});
test('save/load and small time steps retain operator assets, inventories and escrow identically', () => {
  const a = fixture(), b = fixture(); advance(a, 12);
  for (let i = 1; i <= 12; i++) advance(b, i);
  expect(b).toEqual(a);
  const loaded = JSON.parse(JSON.stringify(a)); advance(loaded, 24); advance(a, 24); expect(loaded).toEqual(a);
  const projection = Trade.publicView(a.state);
  expect(JSON.stringify(projection)).not.toContain('treasury'); expect(JSON.stringify(projection)).not.toContain('productionSources');
});
test('commercial access uses two current licensed physical branches, never diplomatic alignment or a road alone', () => {
  const route = fixture().state.operators[0].route;
  const entry = { network: { id: 'carrier', category: 'transport' }, standing: 'licensed', branch: { operationalStatus: 'active', physicalCondition: 'intact' } };
  const profiles = { a: { standings: [entry] }, b: { standings: [JSON.parse(JSON.stringify(entry))] } };
  expect(Trade.permit(route, profiles).approvals.every(p => p.allowed)).toBe(true);
  profiles.b.standings[0].standing = 'restricted';
  expect(Trade.permit(route, profiles).approvals.every(p => !p.allowed)).toBe(true);
  profiles.b.standings[0].standing = 'licensed'; profiles.b.standings[0].branch.operationalStatus = 'defunct';
  expect(Trade.permit(route, profiles).operatorId).toBe('');
  profiles.b.standings[0].branch.operationalStatus = 'relocated'; profiles.b.standings[0].branch.currentCityId = 'a';
  expect(Trade.permit(route, profiles).operatorId).toBe('');
});

test('exports settle at the neighboring depot but keep their vehicle reserved for the empty return', () => {
  const f = fixture(); f.home.steelPanels.supply = 120; f.state.neighbors[0].listings.steelPanels.supply = 1;
  advance(f, 1); const sh = f.state.shipments[0], op = f.state.operators[0];
  expect(sh).toMatchObject({ sourceId: 'a', destinationId: 'b', pickedUp: true });
  expect(f.home.steelPanels.supply).toBe(96);
  advance(f, 3); expect(sh.delivered).toBe(true); expect(sh.returned).toBe(false); expect(op.shipment).toBe(sh.id);
  const quantity = f.state.neighbors[0].listings.steelPanels.supply, money = op.money;
  op.route.supportCapable = false; advance(f, 4);
  expect(f.state.neighbors[0].listings.steelPanels.supply).toBe(quantity); expect(op.money).toBe(money);
  expect(sh.escrow).toBe(0); expect(op.shipment).toBe(sh.id);
});
