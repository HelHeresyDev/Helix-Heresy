// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const GlobeRenderer = require('../strategic-globe-renderer');

test('the level-five geodesic globe has the required closed hex-pentagon topology', () => {
  const topology = StrategicWorld.buildTopology(5);
  expect(topology).toMatchObject({
    kind: 'geodesic-icosphere-dual',
    cellCount: 10242,
    faceCount: 20480,
    hexagonCount: 10230,
    pentagonCount: 12,
  });
  expect(topology.neighbors.filter((neighbors) => neighbors.length === 5)).toHaveLength(12);
  expect(topology.neighbors.filter((neighbors) => neighbors.length === 6)).toHaveLength(10230);
  expect(topology.neighbors.every((neighbors) => neighbors.length >= 5)).toBe(true);
  for (let index = 0; index < topology.cellCount; index += 1) {
    expect(topology.neighbors[index].every((neighbor) => topology.neighbors[neighbor].includes(index))).toBe(true);
  }
});

test('world surfaces are deterministic, seamless, connected, and compactly serializable', () => {
  const first = StrategicWorld.createStrategicMap('spherical-world-seed');
  const same = StrategicWorld.createStrategicMap('spherical-world-seed');
  const different = StrategicWorld.createStrategicMap('another-spherical-seed');
  expect(first).toEqual(same);
  expect(first.digest).not.toBe(different.digest);
  expect(first.surface.classes).not.toBe(different.surface.classes);
  expect(first.surface.landFraction).toBeCloseTo(0.38, 3);
  expect(first.routeGraph).toEqual({ version: 1, nodes: [], routes: [] });
  expect(StrategicWorld.validateStrategicMap(JSON.parse(JSON.stringify(first)))).toEqual(first);
  expect(StrategicWorld.auditStrategicMap(first)).toMatchObject({
    valid: true,
    cellCount: 10242,
    pentagonCount: 12,
    boundaryCellCount: 0,
    reciprocalEdges: true,
    connectedRegions: true,
  });
  expect(JSON.stringify(first).length).toBeLessThan(40000);
});

test('great-circle distance and graph adjacency work across the longitude seam', () => {
  const map = StrategicWorld.createStrategicMap('seam-test');
  const topology = StrategicWorld.topologyForMap(map);
  let seamEdge = null;
  for (let index = 0; index < topology.cellCount && !seamEdge; index += 1) {
    const left = StrategicWorld.cellSnapshot(map, index);
    for (const neighbor of topology.neighbors[index]) {
      const right = StrategicWorld.cellSnapshot(map, neighbor);
      if (Math.abs(left.longitude - right.longitude) > 300) {
        seamEdge = [index, neighbor];
        break;
      }
    }
  }
  expect(seamEdge).not.toBeNull();
  expect(StrategicWorld.graphDistance(map, seamEdge[0], seamEdge[1])).toBe(1);
  expect(StrategicWorld.greatCircleDistanceKm(map, seamEdge[0], seamEdge[1])).toBeLessThan(140);
  expect(StrategicWorld.cellRing(map, seamEdge[0], 1)).toContain(seamEdge[1]);
});

test('route records require stable IDs and truly adjacent ordered cell paths', () => {
  const map = StrategicWorld.createStrategicMap('route-contract');
  const topology = StrategicWorld.topologyForMap(map);
  const start = 50;
  const neighbor = topology.neighbors[start][0];
  expect(StrategicWorld.validateRouteRecord(map, {
    id: 'route:prototype-corridor',
    kind: 'surfaceRoute',
    endpointIds: ['future-place:a', 'future-place:b'],
    cellPath: [StrategicWorld.cellId(start), StrategicWorld.cellId(neighbor)],
  })).toEqual({
    id: 'route:prototype-corridor',
    kind: 'surfaceRoute',
    endpointIds: ['future-place:a', 'future-place:b'],
    cellPath: [StrategicWorld.cellId(start), StrategicWorld.cellId(neighbor)],
  });
  const distant = topology.neighbors[start].includes(start + 100) ? start + 200 : start + 100;
  expect(() => StrategicWorld.validateRouteRecord(map, {
    id: 'route:broken',
    cellPath: [StrategicWorld.cellId(start), StrategicWorld.cellId(distant)],
  })).toThrow(/non-adjacent/i);
});

test('globe view rotation is reversible without a flat-map seam', () => {
  const vector = StrategicWorld.buildTopology(1).vertices[7];
  const rotated = GlobeRenderer.rotateVector(vector, 1.2, -0.45);
  const restored = GlobeRenderer.inverseRotateVector(rotated, 1.2, -0.45);
  expect(restored[0]).toBeCloseTo(vector[0], 10);
  expect(restored[1]).toBeCloseTo(vector[1], 10);
  expect(restored[2]).toBeCloseTo(vector[2], 10);
});
