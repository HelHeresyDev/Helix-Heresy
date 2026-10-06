const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Survey = require('../survey-expeditions');
const source = () => ({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] }, cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } });
const fixture = () => Carrier.fromWorld(source(), 'a', 0);
const journey = (id, status = 'arrived') => ({ id, status, exactArrivalAt: 100 });

test('allocation requires canonical population, services and institutional backing without editing world', () => {
  const map = source(), before = JSON.stringify(map);
  expect(fixture().allocation).toMatchObject({ populationSourceId: 'a', people: 1, vehicles: 1 });
  expect(Carrier.fromWorld(map, 'absent', 0)).toBeNull();
  Carrier.fromWorld(map, 'a', 0); expect(JSON.stringify(map)).toBe(before);
  map.strategicPlayableSettlementState.cityRows[0].currentPopulation = 0;
  expect(Carrier.fromWorld(map, 'a', 0)).toBeNull();
  map.strategicPlayableSettlementState.cityRows[0].currentPopulation = 100;
  map.strategicPlayableSettlementState.cityRows[0].services.transport = 'failed';
  expect(Carrier.fromWorld(map, 'a', 0)).toBeNull();
  map.strategicPlayableSettlementState.cityRows[0].services.transport = 'functional';
  map.cityGovernments.governments[0].institutions[0].capacityBand = 'strained';
  expect(Carrier.fromWorld(map, 'a', 0)).toBeNull();
});

test('complete duty reserves one driver and vehicle, charges once and rejects insufficient resources', () => {
  for (const mode of ['fuel', 'driver', 'condition', 'fatigue', 'cargo', 'money']) {
    const s = fixture(), wallet = { money: mode === 'money' ? 0 : 500 };
    if (mode === 'fuel') s.vehicle.fuelKm = 11;
    if (mode === 'driver') s.driver.status = 'dead';
    if (mode === 'condition') s.vehicle.condition = 40;
    if (mode === 'fatigue') s.driver.fatigue = 80;
    const before = JSON.stringify([s, wallet]);
    expect(Carrier.reserve(s, 2, 4, mode === 'cargo' ? 25 : 4, 104, wallet, 0)).toBe(false);
    expect(JSON.stringify([s, wallet])).toBe(before);
  }
  const s = fixture(), wallet = { money: 500 };
  expect(Carrier.reserve(s, 2, 4, 4, 104, wallet, 0)).toBe(true);
  expect(s.contract.reservedFuelKm).toBe(12); expect(wallet.money).toBe(396);
  expect(Carrier.reserve(s, 2, 4, 4, 104, wallet, 1)).toBe(false);
});

test('collection, both passenger legs and depot return meter once and retain resources across save/load', () => {
  let s = fixture(); Carrier.reserve(s, 2, 4, 4, 104, { money: 500 }, 0);
  for (const [i, kind, km, location] of [[1, 'collection', 2, 'laboratory'], [2, 'outbound', 4, 'field'], [3, 'inbound', 4, 'laboratory'], [4, 'depot', 2, 'depot']]) {
    const j = journey(`j${i}`); Carrier.attach(s, j, kind);
    s = Survey.normalizeState(JSON.parse(JSON.stringify({ carrier: s }))).carrier;
    Carrier.advance(s, j, km, i * 100); const fuel = s.vehicle.fuelKm;
    Carrier.advance(s, j, km, i * 100);
    expect(s.vehicle.fuelKm).toBe(fuel); expect(s.location).toBe(location);
    expect(Boolean(s.contract)).toBe(i !== 4);
  }
  expect(s.vehicle.fuelKm).toBe(188); expect(s.driver.id).toBe(fixture().driver.id);
});

test('cancellation retains assignment for physical return and resting cannot refill or repair', () => {
  const s = fixture(); Carrier.reserve(s, 2, 4, 4, 104, { money: 500 }, 0);
  Carrier.attach(s, journey('c'), 'collection');
  Carrier.advance(s, journey('c', 'enRoute'), 1, 20);
  Carrier.advance(s, journey('c', 'returning'), 1, 20);
  expect(s.contract).not.toBeNull(); expect(s.location).toBe('road:c');
  Carrier.advance(s, journey('c', 'returned'), 1, 100);
  expect(s.location).toBe('depot'); expect(s.contract).toBeNull(); expect(s.vehicle.fuelKm).toBe(198);
  const vehicle = JSON.stringify(s.vehicle); s.driver.fatigue = 50;
  Carrier.advance(s, null, 0, 36100);
  expect(s.driver.fatigue).toBe(0); expect(JSON.stringify(s.vehicle)).toBe(vehicle);
  expect(JSON.stringify(Carrier.publicView(s))).not.toMatch(/health|fatigue|fuelKm|populationAtAllocation/);
});
