const { test, expect } = require('@playwright/test');
const Carrier = require('../local-exchange-carrier');

test('finite identified vehicles, capable drivers and full round-trip fuel constrain bookings', () => {
  const fleet = Carrier.create('a'), first = { id: 'one', quantity: 48 };
  expect(Carrier.reserve(fleet, first, 120)).toBe('');
  expect(fleet.fuelReserveKm).toBe(720);
  expect(Carrier.assigned(fleet, 'one')).toHaveLength(2);
  expect(Carrier.reserve(fleet, { id: 'two', quantity: 1 }, 8)).toContain('vehicles');
  const saved = JSON.parse(JSON.stringify(fleet));
  expect(saved).toEqual(fleet);
  Carrier.release(fleet, 'one');
  fleet.vehicles[0].driver.health = 0;
  expect(Carrier.reserve(fleet, first, 120)).toContain('vehicles');
  fleet.vehicles[0].driver.health = 100;
  fleet.fuelReserveKm = 0;
  const before = JSON.stringify(fleet);
  expect(Carrier.reserve(fleet, first, 200)).toContain('fuel');
  expect(JSON.stringify(fleet)).toBe(before);
  expect(fleet.vehicles).toHaveLength(3);
});

test('paid outstanding inbound property bounds depot capacity until unloading completes', () => {
  const consignments = ['awaitingCarrier', 'inTransit', 'unloading'].map(status => ({ direction: 'inbound', status, quantity: 48 }));
  expect(Carrier.depotSpace(consignments)).toBe(0);
  consignments[2].status = 'received';
  expect(Carrier.depotSpace(consignments)).toBe(48);
  expect(Carrier.depotSpace([...consignments, { direction: 'outbound', status: 'awaitingCarrier', quantity: 48 }])).toBe(48);
});

test('journey distance consumes fuel once and recovery uses a separate finite reserved asset', () => {
  const fleet = Carrier.create('a'), c = { id: 'one', quantity: 10 };
  Carrier.reserve(fleet, c, 8);
  const j = { id: 'trip', status: 'enRoute', originId: 'city', destinationId: 'lab', route: { legs: [{ distanceKm: 8, durationSeconds: 100, plannedStartAt: 0, status: 'active', interruption: null }] } };
  Carrier.meter(fleet, c, j, 50);
  expect(fleet.vehicles[0].fuelKm).toBe(196);
  Carrier.meter(fleet, c, j, 50);
  expect(fleet.vehicles[0].fuelKm).toBe(196);
  expect(Carrier.reserveRecovery(fleet, c.id, 8)).toBe(true);
  expect(Carrier.reserveRecovery(fleet, 'two', 8)).toBe(false);
  expect(fleet.vehicles[2].fuelKm).toBe(184);
  expect(Carrier.reserveRecovery(fleet, c.id, 8)).toBe(true);
  expect(fleet.vehicles[2].fuelKm).toBe(168);
  expect(Carrier.reserveRecovery(fleet, c.id, 100)).toBe(false);
  j.status = 'arrived'; Carrier.meter(fleet, c, j, 100);
  expect(fleet.vehicles[0].fuelKm).toBe(192);
  expect(fleet.vehicles[0].assignment).toBe(c.id);
  Carrier.release(fleet, c.id);
  expect(fleet.vehicles.every(v => v.assignment === null)).toBe(true);
  expect(fleet.vehicles[0].fuelKm).toBe(192);
});

test('operator buys allocated finite supplier cargo that arrives once and truck returns physically', () => {
  const fleet = Carrier.create('a'), s = Carrier.support(fleet, 0);
  fleet.fuelReserveKm = 0; s.parts = 0;
  Carrier.advanceSupport(fleet, 0);
  const shipment = { ...s.supplier.shipment };
  expect(shipment).toMatchObject({ fuelKm: 600, parts: 12, delivered: false, cost: 90 });
  expect(s.money).toBe(910); expect(s.expenses).toBe(90);
  expect(s.supplier.fuelStockKm).toBe(7400); expect(s.supplier.partsStock).toBe(68);
  expect(fleet.fuelReserveKm).toBe(0); expect(s.parts).toBe(0);
  const saved = JSON.parse(JSON.stringify(fleet));
  Carrier.advanceSupport(saved, shipment.arriveAt - 1);
  expect(saved.fuelReserveKm).toBe(0);
  Carrier.advanceSupport(saved, shipment.arriveAt);
  expect(saved.fuelReserveKm).toBe(600); expect(saved.support.parts).toBe(12);
  expect(saved.support.supplier.shipment.delivered).toBe(true);
  Carrier.advanceSupport(saved, shipment.arriveAt);
  expect(saved.fuelReserveKm).toBe(600);
  Carrier.advanceSupport(saved, shipment.returnAt);
  expect(saved.support.supplier.shipment).toBeNull();
  expect(saved.support.supplier.vehicle.location).toBe('supplier');
  expect(saved.support.supplier.vehicle.fuelKm).toBe(112);
  expect(saved.support.money).toBe(910);
});

test('supplier route holds preserve purchased cargo and resume without refund or duplication', () => {
  const f = Carrier.create('a'), s = Carrier.support(f, 0); f.fuelReserveKm = 0;
  Carrier.advanceSupport(f, 0);
  const money = s.money, arrival = s.supplier.shipment.arriveAt;
  s.supplier.routeOpen = false;
  Carrier.advanceSupport(f, 10000);
  expect(f.fuelReserveKm).toBe(0); expect(s.money).toBe(money);
  expect(s.supplier.shipment.arriveAt).toBe(arrival + 10000);
  s.supplier.routeOpen = true;
  Carrier.advanceSupport(f, arrival + 10000);
  expect(f.fuelReserveKm).toBe(600);
});

test('workshop consumes parts and operator funds, blocks dispatch and never heals drivers', () => {
  const f = Carrier.create('a'), s = Carrier.support(f, 0), v = f.vehicles[0];
  v.condition = 70; v.driver.health = 30; v.driver.fatigue = 90;
  Carrier.advanceSupport(f, 0);
  expect(s.parts).toBe(4); expect(s.money).toBe(992);
  expect(s.workshop.vehicleId).toBe(v.id);
  expect(Carrier.reserve(f, { id: 'large', quantity: 48 }, 8)).toContain('vehicles');
  Carrier.advanceSupport(f, 7199); expect(v.condition).toBe(70);
  Carrier.advanceSupport(f, 7200); expect(v.condition).toBe(95);
  expect(v.driver.health).toBe(30); expect(v.driver.fatigue).toBeCloseTo(60);
  expect(s.workshop).toBeNull(); expect(s.money).toBe(992);
});

test('supplier stock, funds and independent operating fuel shortages do not create replacements', () => {
  for (const shortage of ['stock', 'money', 'fuel', 'driver']) {
    const f = Carrier.create('a'), s = Carrier.support(f, 0); f.fuelReserveKm = 0; s.parts = 0;
    if (shortage === 'stock') { s.supplier.fuelStockKm = 0; s.supplier.partsStock = 0; }
    if (shortage === 'money') s.money = 0;
    if (shortage === 'fuel') { s.supplier.vehicle.fuelKm = 0; s.supplier.operatingFuelKm = 0; }
    if (shortage === 'driver') s.supplier.vehicle.driver.status = 'dead';
    Carrier.advanceSupport(f, 86400);
    expect(s.supplier.shipment).toBeNull(); expect(f.fuelReserveKm).toBe(0); expect(s.parts).toBe(0);
    expect(s.reason).not.toBe(''); expect(f.vehicles).toHaveLength(3);
  }
});

test('driving wears the same vehicle, fatigue requires local rest and new tariffs do not debit player funds', () => {
  const f = Carrier.create('a'), s = Carrier.support(f, 0), v = f.vehicles[0];
  const c = { id: 'one', quantity: 1 }; Carrier.reserve(f, c, 8);
  const j = { id: 'j', status: 'arrived', destinationId: 'depot', route: { legs: [{ distanceKm: 8 }] } };
  Carrier.meter(f, c, j, 100);
  expect(v.condition).toBeCloseTo(99.84); expect(v.driver.fatigue).toBeCloseTo(0.32);
  v.driver.fatigue = 90; Carrier.advanceSupport(f, 3600); expect(v.driver.fatigue).toBe(90);
  Carrier.release(f, c.id); Carrier.advanceSupport(f, 7200); expect(v.driver.fatigue).toBe(75);
  expect(Carrier.tariffMultiplier(f)).toBe(1);
  f.fuelReserveKm = 0; expect(Carrier.tariffMultiplier(f)).toBeGreaterThan(1);
  Carrier.credit(f, 4, 7200); expect(s.money).toBe(1004); expect(s.revenue).toBe(4);
});
