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
