// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');

test('planetary relief is deterministic without changing the canonical land and ocean mask', () => {
  const base = StrategicWorld.createStrategicMap('relief-determinism');
  const original = JSON.parse(JSON.stringify(base));
  const first = PlanetaryRelief.attachRelief('relief-determinism', base);
  const same = PlanetaryRelief.attachRelief('relief-determinism', base);
  const different = PlanetaryRelief.attachRelief('different-relief', StrategicWorld.createStrategicMap('different-relief'));

  expect(base).toEqual(original);
  expect(first.surface).toEqual(base.surface);
  expect(first.relief).toEqual(same.relief);
  expect(first.relief.digest).not.toBe(different.relief.digest);
  expect(StrategicWorld.validateStrategicMap(JSON.parse(JSON.stringify(first)))).toEqual(first);
  expect(PlanetaryRelief.validateRelief(first)).toEqual(first.relief);
});

test('plates are contiguous and elevation, coast, and seam data obey the strategic graph', () => {
  const map = PlanetaryRelief.attachRelief('relief-topology', StrategicWorld.createStrategicMap('relief-topology'));
  const topology = StrategicWorld.topologyForMap(map);
  const audit = PlanetaryRelief.auditRelief(map);

  expect(audit).toMatchObject({
    valid: true,
    plateCount: 28,
    contiguousPlates: true,
    coastPreserved: true,
    elevationSignsValid: true,
  });
  expect(Object.values(audit.boundaryKindCounts).every((count) => count > 0)).toBe(true);
  expect(map.relief.plates.reduce((total, plate) => total + plate.cellCount, 0)).toBe(topology.cellCount);
  expect(new Set(map.relief.reliefClasses).size).toBeGreaterThanOrEqual(7);
  expect(new Set(map.relief.coastClasses)).toEqual(new Set(['.', 'l', 'r', 'c', 'i', 's']));

  const boundaryDistancesAreContinuous = topology.neighbors.every((neighbors, left) => neighbors.every((right) => (
    Math.abs(map.relief.boundaryDistanceByCell[left] - map.relief.boundaryDistanceByCell[right]) <= 1
  )));
  expect(boundaryDistancesAreContinuous).toBe(true);
});

test('relief validation rejects altered elevation and mismatched surface data', () => {
  const map = PlanetaryRelief.attachRelief('relief-integrity', StrategicWorld.createStrategicMap('relief-integrity'));
  const landIndex = map.surface.classes.indexOf('L');
  const altered = JSON.parse(JSON.stringify(map));
  altered.relief.elevationM[landIndex] = -1;
  expect(() => PlanetaryRelief.validateRelief(altered)).toThrow(/land must remain above sea level/i);

  const changedSurface = JSON.parse(JSON.stringify(map));
  changedSurface.surface.classes = `${changedSurface.surface.classes.slice(0, landIndex)}W${changedSurface.surface.classes.slice(landIndex + 1)}`;
  expect(() => PlanetaryRelief.validateRelief(changedSurface)).toThrow(/does not match its canonical land\/ocean surface/i);
});
