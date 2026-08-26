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
    generationVersion: 3,
    nameGeneratorVersion: 2,
    worldTheme: 'grim',
    creationSettings: {
      worldTheme: 'grim',
      scale: 'planetary-prototype',
      strategicMap: { refinementLevel: 5, radiusKm: 3000, landFraction: 0.38 },
      relief: { plateCount: 28 },
    },
    generatedData: {
      strategicResolution: 'geodesic-globe-relief',
      strategicMap: {
        topology: { cellCount: 10242, hexagonCount: 10230, pentagonCount: 12 },
        relief: { settings: { plateCount: 28 } },
        routeGraph: { version: 1, nodes: [], routes: [] },
      },
      themeContent: {
        version: 1,
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

test('strategic geography depends on world seed and generation version, not World Theme', () => {
  const worlds = ['madcap', 'grim', 'unbound'].map((worldTheme) => Library.createWorld({
    id: `same-planet-${worldTheme}`,
    worldSeed: 'same-physical-world',
    worldTheme,
    createdAt: '2026-08-25T00:00:00.000Z',
  }));
  expect(worlds[0].generatedData.strategicMap).toEqual(worlds[1].generatedData.strategicMap);
  expect(worlds[1].generatedData.strategicMap).toEqual(worlds[2].generatedData.strategicMap);
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
