// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

test('world names, years, and canonical digests are deterministic and versioned', () => {
  const first = Library.createWorld({
    id: 'world-one',
    worldSeed: 'reusable-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const same = Library.createWorld({
    id: 'another-library-id',
    worldSeed: 'reusable-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const different = Library.createWorld({
    id: 'world-two',
    worldSeed: 'different-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });

  expect(first.name).toBe(same.name);
  expect(first.playableYear).toBe(same.playableYear);
  expect(first.canonicalDigest).toBe(same.canonicalDigest);
  expect(first.name).not.toBe(different.name);
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(first)))).toEqual(first);
  expect(first).toMatchObject({
    generationVersion: 9,
    nameGeneratorVersion: 2,
    worldTheme: 'grim',
    creationSettings: {
      worldTheme: 'grim',
      scale: 'planetary-prototype',
      strategicMap: { refinementLevel: 5, radiusKm: 3000, landFraction: 0.38 },
      relief: { plateCount: 28 },
      environment: { climate: { axialTiltMinimumDeg: 18, axialTiltMaximumDeg: 28 } },
      geology: { provinceCellTarget: 72 },
      arcaneGeography: { fieldWaveCount: 5, leyCellFraction: 0.065 },
      humanGeography: { cityCellsPerCity: 125, minimumCityCount: 18, maximumCityCount: 44, minimumCitySpacingKm: 340 },
    },
    generatedData: {
      strategicResolution: 'geodesic-globe-city-polities',
      strategicMap: {
        topology: { cellCount: 10242, hexagonCount: 10230, pentagonCount: 12 },
        relief: { settings: { plateCount: 28 } },
        climate: { settings: { axialTiltMinimumDeg: 18, axialTiltMaximumDeg: 28 } },
        hydrology: { diagnostics: { watershedCount: expect.any(Number), lakeCount: expect.any(Number) } },
        biomes: { diagnostics: { representedBiomeCount: expect.any(Number) } },
        geology: { diagnostics: { provinceCount: expect.any(Number), representedBedrockClassCount: 7 } },
        naturalHazards: { diagnostics: { highHazardCellCount: expect.any(Number) } },
        arcaneGeography: { diagnostics: { leyCellCount: expect.any(Number), representedPrimaryAspectCount: 8 } },
        magicalHazards: { diagnostics: { highHazardCellCount: expect.any(Number) } },
        resourcePotential: { diagnostics: { representedFamilyCount: 12 } },
        publicResourceProspects: { diagnostics: { representedDominantProspectCount: 12 } },
        humanGeography: { diagnostics: { cityCount: expect.any(Number), corridorCount: expect.any(Number), redundantCorridorCount: expect.any(Number) } },
        cityPolities: { diagnostics: { polityCount: expect.any(Number), corridorRelationCount: expect.any(Number), notableInternetRelationCount: expect.any(Number) } },
        routeGraph: { version: 1, nodes: expect.any(Array), routes: expect.any(Array) },
      },
      themeContent: {
        version: 2,
        worldName: { sourceTheme: 'grim' },
        worldSummary: { sourceTheme: 'grim' },
      },
    },
  });
});

test('Unbound worlds consume both authored theme pools while legacy version-one names remain stable', () => {
  const sourceThemes = new Set();
  for (let index = 0; index < 100; index += 1) {
    const world = Library.createWorld({
      id: `unbound-${index}`,
      worldSeed: `unbound-world-${index}`,
      worldTheme: 'unbound',
      generationVersion: 1,
      createdAt: '2026-08-25T00:00:00.000Z',
    });
    expect(world.worldTheme).toBe('unbound');
    sourceThemes.add(world.generatedData.themeContent.worldName.sourceTheme);
    sourceThemes.add(world.generatedData.themeContent.worldSummary.sourceTheme);
  }
  expect(sourceThemes).toEqual(new Set(['madcap', 'grim']));

  const legacy = Library.createWorld({
    id: 'legacy-world',
    worldSeed: 'legacy-name-seed',
    worldTheme: 'grim',
    generationVersion: 1,
    nameGeneratorVersion: 1,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  expect(legacy.name).toBe(Library.generatedWorldName('legacy-name-seed', 1));
  expect(legacy.generatedData.strategicMap).toBeUndefined();
  expect(Library.normalizeWorld(legacy)).toEqual(legacy);
});

test('physical strategic geography ignores World Theme while city identity honors it', () => {
  const worlds = ['madcap', 'grim', 'unbound'].map((worldTheme) => Library.createWorld({
    id: `same-planet-${worldTheme}`,
    worldSeed: 'same-physical-world',
    worldTheme,
    createdAt: '2026-08-25T00:00:00.000Z',
  }));
  const physicalMaps = worlds.map((world) => {
    const map = JSON.parse(JSON.stringify(world.generatedData.strategicMap));
    delete map.cityPolities;
    delete map.digest;
    return map;
  });
  expect(physicalMaps[0]).toEqual(physicalMaps[1]);
  expect(physicalMaps[1]).toEqual(physicalMaps[2]);
  expect(worlds[0].generatedData.strategicMap.cityPolities).not.toEqual(worlds[1].generatedData.strategicMap.cityPolities);
  expect(new Set(worlds.map((world) => world.canonicalDigest)).size).toBe(3);
});

test('finalized generation-version-two worlds keep their original surface-only strategic maps', () => {
  const world = Library.createWorld({
    id: 'generation-two-world',
    worldSeed: 'generation-two-seed',
    worldTheme: 'madcap',
    generationVersion: 2,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe');
  expect(world.generatedData.strategicMap.relief).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('finalized generation-version-three worlds keep relief without silently gaining climate', () => {
  const world = Library.createWorld({
    id: 'generation-three-world',
    worldSeed: 'generation-three-seed',
    worldTheme: 'madcap',
    generationVersion: 3,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-relief');
  expect(world.generatedData.strategicMap.relief).toBeDefined();
  expect(world.generatedData.strategicMap.climate).toBeUndefined();
  expect(world.generatedData.strategicMap.hydrology).toBeUndefined();
  expect(world.generatedData.strategicMap.biomes).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('finalized generation-version-four worlds keep environment without silently gaining geology', () => {
  const world = Library.createWorld({
    id: 'generation-four-world',
    worldSeed: 'generation-four-seed',
    worldTheme: 'madcap',
    generationVersion: 4,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-environment');
  expect(world.generatedData.strategicMap.biomes).toBeDefined();
  expect(world.generatedData.strategicMap.geology).toBeUndefined();
  expect(world.generatedData.strategicMap.naturalHazards).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('finalized generation-version-five worlds keep geology without silently gaining arcane geography', () => {
  const world = Library.createWorld({
    id: 'generation-five-world',
    worldSeed: 'generation-five-seed',
    worldTheme: 'madcap',
    generationVersion: 5,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-geology');
  expect(world.generatedData.strategicMap.geology).toBeDefined();
  expect(world.generatedData.strategicMap.naturalHazards).toBeDefined();
  expect(world.generatedData.strategicMap.arcaneGeography).toBeUndefined();
  expect(world.generatedData.strategicMap.magicalHazards).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('finalized generation-version-six worlds keep arcane geography without silently gaining resource potential', () => {
  const world = Library.createWorld({
    id: 'generation-six-world',
    worldSeed: 'generation-six-seed',
    worldTheme: 'madcap',
    generationVersion: 6,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-arcane-geography');
  expect(world.generatedData.strategicMap.arcaneGeography).toBeDefined();
  expect(world.generatedData.strategicMap.magicalHazards).toBeDefined();
  expect(world.generatedData.strategicMap.resourcePotential).toBeUndefined();
  expect(world.generatedData.strategicMap.publicResourceProspects).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('finalized generation-version-seven worlds keep resource potential without silently gaining human geography', () => {
  const world = Library.createWorld({
    id: 'generation-seven-world',
    worldSeed: 'generation-seven-seed',
    worldTheme: 'madcap',
    generationVersion: 7,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-resource-potential');
  expect(world.generatedData.strategicMap.resourcePotential).toBeDefined();
  expect(world.generatedData.strategicMap.publicResourceProspects).toBeDefined();
  expect(world.generatedData.strategicMap.humanGeography).toBeUndefined();
  expect(world.generatedData.strategicMap.routeGraph).toEqual({ version: 1, nodes: [], routes: [] });
  expect(normalized).toEqual(world);
});

test('finalized generation-version-eight worlds keep city routes without silently gaining sovereign polities', () => {
  const world = Library.createWorld({
    id: 'generation-eight-world',
    worldSeed: 'generation-eight-seed',
    worldTheme: 'madcap',
    generationVersion: 8,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-fortified-cities');
  expect(world.generatedData.strategicMap.humanGeography).toBeDefined();
  expect(world.generatedData.strategicMap.cityPolities).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('several run records branch independently without modifying their canonical world', () => {
  const storage = memoryStorage();
  const repository = Library.createRepository(storage);
  const world = repository.putWorld(Library.createWorld({
    id: 'shared-world',
    worldSeed: 'shared-world-seed',
    worldTheme: 'madcap',
    createdAt: '2026-08-25T00:00:00.000Z',
  }));
  const canonicalBefore = repository.getWorld(world.id);
  const baseRun = {
    worldId: world.id,
    worldGenerationVersion: world.generationVersion,
    canonicalWorldDigest: world.canonicalDigest,
    scenario: { id: 'chemistryFront' },
    site: { id: 'starting-site:chemistryFront', strategicLocation: null },
  };
  repository.putRun(Library.createRun({
    ...baseRun,
    id: 'run-a',
    runSeed: 'run-seed-a',
    createdAt: '2026-08-25T01:00:00.000Z',
    state: { started: true, clock: 20, company: { legalName: 'Branch A' } },
  }));
  repository.putRun(Library.createRun({
    ...baseRun,
    id: 'run-b',
    runSeed: 'run-seed-b',
    createdAt: '2026-08-25T02:00:00.000Z',
    state: { started: true, clock: 90, company: { legalName: 'Branch B' } },
  }));

  const branchA = repository.getRun('run-a');
  branchA.state.clock = 500;
  branchA.worldState.changes.marketShock = 4;
  repository.putRun(branchA, { overwrite: true });

  expect(repository.listRuns(world.id).map((run) => run.id).sort()).toEqual(['run-a', 'run-b']);
  expect(repository.getRun('run-b').state).toMatchObject({ clock: 90, company: { legalName: 'Branch B' } });
  expect(repository.getRun('run-b').worldState.changes).toEqual({});
  expect(repository.getWorld(world.id)).toEqual(canonicalBefore);
  expect(repository.continuation().id).toBe('run-a');
  expect(() => repository.deleteWorld(world.id)).toThrow(/runs before deleting/i);
});

test('ended runs remain in the library but are not continuations', () => {
  const repository = Library.createRepository(memoryStorage());
  const world = repository.putWorld(Library.createWorld({ id: 'world', worldSeed: 'seed', worldTheme: 'madcap' }));
  const run = Library.createRun({
    id: 'run',
    worldId: world.id,
    worldGenerationVersion: world.generationVersion,
    canonicalWorldDigest: world.canonicalDigest,
    runSeed: 'run-seed',
    state: { started: true, runEnded: false },
  });
  repository.putRun(run);
  repository.putRun(Library.createRun({
    ...run,
    status: 'ended',
    endedAt: '2026-08-25T03:00:00.000Z',
    state: { started: true, runEnded: true },
  }), { overwrite: true, activate: false });

  expect(repository.getRun('run')).toMatchObject({ status: 'ended', endReason: 'death' });
  expect(repository.continuation()).toBeNull();
  expect(repository.manifest().activeRunId).toBeNull();
});

test('state-only test projections retain world and run identity when normalized from storage', () => {
  const state = {
    started: true,
    seed: 'run-seed',
    runEnded: false,
    runIdentity: { runId: 'run-projection', runSeed: 'run-seed' },
    worldReference: { worldId: 'world-projection', generationVersion: 1, canonicalDigest: 'world-digest' },
    startingScenario: { id: 'chemistryFront', blueprintId: 'chemistry-front-site-v3', blueprintVersion: 3 },
  };
  const normalized = Library.normalizeRunStorageRecord('run-projection', {
    version: 1,
    savedAt: '2026-08-25T04:00:00.000Z',
    state,
  });

  expect(normalized).toMatchObject({
    id: 'run-projection',
    worldId: 'world-projection',
    runSeed: 'run-seed',
    canonicalWorldDigest: 'world-digest',
    status: 'active',
    scenario: { id: 'chemistryFront' },
    site: { id: 'starting-site:chemistryFront', selectionStatus: 'deferredWorldPlacement' },
    worldState: { canonicalWorldDigest: 'world-digest', changes: {} },
  });
});
