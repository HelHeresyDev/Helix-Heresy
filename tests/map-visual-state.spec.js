// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const VisualState = require('../map-visual-state.js');
const ActorVisualState = require('../actor-visual-state.js');
const AnimationClock = require('../animation-clock.js');
const MapKnowledge = require('../map-knowledge.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
}

function expectActorVisualStateContract() {
  let realTimeMs = 1000;
  const clock = AnimationClock.createClock({
    now: () => realTimeMs,
    gameTime: 10,
    timeline: { revision: 1, speed: 60, paused: false },
  });
  realTimeMs = 1100;
  expect(clock.sample()).toMatchObject({ gameTime: 16, revision: 1, speed: 60, paused: false });
  clock.setSnapshot({ gameTime: 16, timeline: { revision: 1, speed: 60, paused: true } });
  realTimeMs = 1300;
  expect(clock.sample().gameTime).toBe(16);

  const motion = {
    id: 'actor-1:segment-1',
    state: 'moving',
    intent: 'move',
    fromCell: { x: 2, y: 3, z: 0 },
    toCell: { x: 3, y: 3, z: 0 },
    segmentStartedAt: 10,
    segmentArriveAt: 12,
    revision: '1:1:0',
  };
  expect(AnimationClock.sampleMotion(motion, 11, {
    speed: 1,
    knowledgeState: 'current',
  })).toMatchObject({
    interpolated: true,
    active: true,
    progress: 0.5,
    offset: { x: 0.5, y: 0 },
  });
  expect(AnimationClock.sampleMotion(motion, 11, {
    speed: 300,
    knowledgeState: 'current',
  })).toMatchObject({ interpolated: false, active: false, offset: { x: 0, y: 0 } });
  expect(AnimationClock.sampleMotion(motion, 11, {
    speed: 1,
    knowledgeState: 'stale',
  })).toMatchObject({ interpolated: false, active: false });
  expect(AnimationClock.sampleMotion(motion, 11, {
    speed: 1,
    knowledgeState: 'current',
    discontinuity: true,
  })).toMatchObject({ interpolated: false, active: false });
  expect(AnimationClock.sampleAction({
    id: 'attack-1',
    kind: 'attack',
    startedAt: 10,
    activeAt: 11,
    endsAt: 13,
  }, 10.5)).toMatchObject({ phase: 'charge', progress: 0.5, active: true });

  const cases = [
    {
      input: {
        anchorCell: { x: 4, y: 4 },
        activity: { id: 'combatAttack', label: 'attacking target', combatIntent: 'attack' },
        combatTargetCell: { x: 7, y: 4 },
        condition: { ratio: 0.2, stress: 80 },
      },
      expected: { facing: 'east', pose: 'attacking', family: 'combat', cues: ['critical', 'stressed'] },
    },
    {
      input: {
        anchorCell: { x: 4, y: 4 },
        previousFacing: 'east',
        activity: { id: 'moving', label: 'moving' },
        motion: { state: 'moving', nextCell: { x: 5, y: 5 } },
      },
      expected: { facing: 'east', pose: 'moving', family: 'movement', cues: [] },
    },
    {
      input: {
        activity: { id: 'containment.press', label: 'pressing against containment' },
        containment: { active: true, method: 'press' },
      },
      expected: { facing: 'none', pose: 'strained', family: 'containment', cues: ['compressed'] },
    },
    {
      input: {
        activity: { id: 'feedingCorpse', label: 'feeding on remains' },
        condition: { ratio: 0.4 },
      },
      expected: { facing: 'none', pose: 'feeding', family: 'feeding', cues: ['injured'] },
    },
    {
      input: {
        activity: { id: 'physicalDiagnostic', label: 'Run tissue assay' },
      },
      expected: { facing: 'none', pose: 'working', family: 'work', cues: [] },
    },
    {
      input: {
        activity: { id: 'quiescent', label: 'quiescent while recovering' },
        condition: { ratio: 0.2 },
      },
      expected: { facing: 'none', pose: 'recovering', family: 'recovery', cues: ['critical'] },
    },
  ];

  for (const { input, expected } of cases) {
    const result = ActorVisualState.deriveActorVisualState(input);
    expect(result).toMatchObject({
      facing: expected.facing,
      pose: expected.pose,
      activity: { family: expected.family },
      conditionCues: expected.cues,
    });
  }

  expect(ActorVisualState.spriteKeyCandidates('actor.slime', {
    facing: 'west',
    pose: 'feeding',
  })).toEqual([
    'actor.slime.pose.feeding.facing.west',
    'actor.slime.pose.feeding',
    'actor.slime.facing.west',
    'actor.slime',
  ]);
  const entity = VisualState.cleanEntity({
    id: 'actor-1',
    kind: 'slime',
    category: 'actor',
    anchorCell: { x: 2, y: 3 },
    orientation: 'vertical',
    facing: 'west',
    pose: 'feeding',
    activity: { id: 'feedingWaste', label: 'feeding on waste' },
    motion,
    action: { id: 'attack-1', kind: 'attack', startedAt: 10, activeAt: 11, endsAt: 13 },
    condition: { cues: ['injured', 'not-a-cue'] },
  });
  expect(entity).toMatchObject({
    orientation: { quarterTurns: 1, mirrored: false },
    facing: 'west',
    pose: 'feeding',
    activity: { family: 'feeding' },
    motion: { id: 'actor-1:segment-1', fromCell: { x: 2, y: 3, z: 0 }, toCell: { x: 3, y: 3, z: 0 } },
    action: { id: 'attack-1', kind: 'attack', startedAt: 10, activeAt: 11, endsAt: 13 },
    condition: { cues: ['injured'] },
  });

  const visibleKeys = MapKnowledge.perceivedCellKeys({
    origin: { x: 2, y: 2, z: -1 },
    width: 6,
    height: 6,
    radius: 2,
    canSee: (_from, cell) => cell.x <= 2,
  });
  expect(visibleKeys.has('2,2,-1')).toBe(true);
  expect(visibleKeys.has('1,2,-1')).toBe(true);
  expect(visibleKeys.has('3,2,-1')).toBe(false);
  expect(MapKnowledge.LIGHT_VISIBILITY_BANDS.map(({ id, range }) => [id, range])).toEqual([
    ['dark', 1],
    ['dim', 4],
    ['lit', 8],
    ['bright', 12],
  ]);
  expect(MapKnowledge.canVisuallyPerceive({
    distance: 4,
    lightLevel: 20,
    vision: true,
    lineOfSight: true,
    contact: false,
  })).toBe(true);
  expect(MapKnowledge.canVisuallyPerceive({
    distance: 5,
    lightLevel: 20,
    vision: true,
    lineOfSight: true,
    contact: false,
  })).toBe(false);
  expect(MapKnowledge.canVisuallyPerceive({
    distance: 1,
    lightLevel: 0,
    vision: false,
    lineOfSight: false,
  })).toBe(true);
  const remembered = MapKnowledge.normalizeObservation({
    cell: { x: 1, y: 2, z: -1 },
    firstObservedAt: 10,
    lastObservedAt: 20,
    source: 'vision',
    snapshot: { base: { kind: 'floor' } },
  });
  expect(MapKnowledge.knowledgeForObservation(remembered, 21)).toMatchObject({
    state: 'stale',
    tier: 'recent',
    observedAt: 20,
  });
  expect(MapKnowledge.knowledgeForObservation(remembered, 20 + MapKnowledge.AGED_OBSERVATION_SECONDS + 1))
    .toMatchObject({ state: 'stale', tier: 'archived' });
  expect(MapKnowledge.knowledgeForObservation(null, 100)).toMatchObject({
    state: 'unknown',
    tier: 'unknown',
    confidence: 0,
  });
}

test('scene model deduplicates entities while retaining footprint and interaction references', () => {
  expectActorVisualStateContract();
  const cells = [
    {
      cell: { x: 1, y: 1, z: 0 },
      known: true,
      target: { kind: 'container', id: 'jar-1' },
      interactionTargets: [
        { kind: 'container', id: 'jar-1' },
        { kind: 'slime', id: 'slime-1' },
        { kind: 'room', roomId: 'mainLab' },
        { kind: 'tile', tile: { x: 1, y: 1, z: 0 } },
      ],
      object: {
        targets: [
          { kind: 'container', id: 'jar-1' },
          { kind: 'slime', id: 'slime-1' },
        ],
      },
    },
    {
      cell: { x: 2, y: 1, z: 0 },
      known: true,
      target: { kind: 'container', id: 'jar-1' },
      object: {
        targets: [
          { kind: 'container', id: 'jar-1' },
          { kind: 'slime', id: 'slime-1' },
        ],
      },
    },
  ];
  const entitySeeds = [{
    id: 'container:jar-1',
    kind: 'container',
    target: { kind: 'container', id: 'jar-1' },
    anchorCell: { x: 1, y: 1, z: 0 },
    footprintCells: [{ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],
    knowledge: { state: 'current' },
    visual: { key: 'container.jar', glyph: 'C', layer: 'wallMounted' },
    statusCues: [
      { id: 'routine', severity: 'routine', label: 'Routine', glyph: '.' },
      { id: 'damaged', severity: 'warning', label: 'Damaged', glyph: '!' },
      { id: 'breached', severity: 'critical', label: 'Breached', glyph: '!' },
    ],
  }, {
    id: 'offscreen-tall-body',
    kind: 'slime',
    category: 'actor',
    anchorCell: { x: 80, y: 80, z: 0 },
    footprintCells: [{ x: 80, y: 80, z: 0 }, { x: 80, y: 80, z: 1 }],
    bounds: { x: 80, y: 80, z: 0, width: 1, height: 1, depth: 2 },
    knowledge: { state: 'current' },
  }];
  const effectSeeds = [{
    id: 'incident:test',
    kind: 'incident',
    sourceId: 'test-source',
    cell: { x: 1, y: 1, z: 0 },
    plane: 'alert',
    knowledge: { state: 'current' },
    intensityBand: 'high',
    damageTags: ['toxic', 'corrosive', 'toxic'],
    timing: { startAt: 40, activeAt: 41, endAt: 50 },
    uncertaintyRadius: 2,
    stackCount: 3,
    glyph: '!',
    target: { kind: 'incident', id: 'test' },
    relatedTargets: [{ kind: 'task', id: 'response' }],
  }, {
    id: 'offscreen-effect',
    kind: 'spill',
    cell: { x: 90, y: 90, z: 0 },
    plane: 'ground',
    knowledge: { state: 'current' },
  }];
  const entityQuery = VisualState.createSpatialQuery(entitySeeds, { chunkSize: 8 });
  const effectQuery = VisualState.createSpatialQuery(effectSeeds, { chunkSize: 8 });
  const scene = VisualState.buildScene({
    clock: 42,
    timeline: { revision: 7, mode: 'skip', paused: true, speed: 60 },
    viewport: { x: 1, y: 1, z: 0, width: 2, height: 1 },
    cells,
    entities: entitySeeds,
    effects: effectSeeds,
    spatialQueries: { entities: entityQuery, effects: effectQuery },
    selection: { target: { kind: 'container', id: 'jar-1' } },
  });

  expect(scene.entities).toHaveLength(1);
  expect(scene.culling).toMatchObject({
    entities: { input: 2, visible: 1, culled: 1, indexed: true },
    effects: { input: 2, visible: 1, culled: 1, indexed: true },
  });
  expect(entityQuery.snapshot()).toMatchObject({ records: 2, queries: 1, candidatesExamined: 1 });
  expect(VisualState.candidateIntersectsBounds(entitySeeds[1], {
    x: 80, y: 80, z: 1, width: 1, height: 1,
  })).toBe(true);
  expect(scene.timeline).toEqual({ revision: 7, mode: 'skip', paused: true, speed: 60 });
  expect(VisualState.cleanOrientation(90)).toEqual({ quarterTurns: 1, mirrored: false });
  expect(VisualState.cleanOrientation({ quarterTurns: 2, mirrored: true }))
    .toEqual({ quarterTurns: 2, mirrored: true });
  expect(scene.entities[0]).toMatchObject({
    id: 'container:jar-1',
    selected: true,
    orientation: { quarterTurns: 0, mirrored: false },
    visual: { layer: 'wallMounted' },
    statusCues: [
      { id: 'breached', severity: 'critical', label: 'Breached', glyph: '!' },
      { id: 'damaged', severity: 'warning', label: 'Damaged', glyph: '!' },
    ],
    footprintCells: [{ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],
  });
  expect(scene.effects[0]).toMatchObject({
    plane: 'alert',
    sourceId: 'test-source',
    intensityBand: 'high',
    damageTags: ['toxic', 'corrosive'],
    timing: { startAt: 40, activeAt: 41, endAt: 50 },
    uncertaintyRadius: 2,
    stackCount: 3,
    glyph: '!',
  });
  expect(scene.cells[0].effectIds).toEqual(['incident:test']);
  expect(scene.cells.every((cell) => cell.entityIds.includes('container:jar-1'))).toBe(true);
  expect(scene.interactionIndex[0].targets).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'container', id: 'jar-1' }),
    expect.objectContaining({ kind: 'slime', id: 'slime-1' }),
    expect.objectContaining({ kind: 'room', roomId: 'mainLab' }),
    expect.objectContaining({ kind: 'tile', tile: { x: 1, y: 1, z: 0 } }),
    expect.objectContaining({ kind: 'incident', id: 'test' }),
    expect.objectContaining({ kind: 'task', id: 'response' }),
  ]));
  expect(VisualState.sceneCellAt(scene, { x: 1, y: 1, z: 0 })).toBe(scene.cells[0]);
  expect(VisualState.interactionAtCell(scene, { x: 1, y: 1, z: 0 })).toBe(scene.interactionIndex[0]);
  expect(VisualState.sceneCellAt(scene, { x: 0, y: 1, z: 0 })).toBeNull();
  expect(VisualState.interactionAtCell(scene, { x: 0, y: 1, z: 0 })).toBeNull();
  expect(scene.entities.some((entity) => entity.id === 'slime:slime-1')).toBe(false);
  expect(scene.selection.cells).toHaveLength(2);
  expect(VisualState.validateScene(scene)).toEqual([]);
});

test('overscan bounds clamp to the map and preserve the selected z layer', () => {
  expect(VisualState.overscanBounds(
    { x: 0, y: 0, z: -2, width: 10, height: 8 },
    { width: 100, height: 100 },
    1
  )).toEqual({ x: 0, y: 0, z: -2, width: 11, height: 9 });
  expect(VisualState.overscanBounds(
    { x: 90, y: 92, z: 3, width: 10, height: 8 },
    { width: 100, height: 100 },
    2
  )).toEqual({ x: 88, y: 90, z: 3, width: 12, height: 10 });
});

test('browser scene is versioned, unique, overscanned, and free of DOM styling fields', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const scene = view.scene;
    const ids = scene.entities.map((entity) => entity.id);
    const multi = scene.entities.find((entity) => entity.footprintCells.length > 1);
    const referencedCells = multi
      ? scene.cells.filter((cell) => cell.entityIds.includes(multi.id)).map((cell) => cell.key)
      : [];
    return {
      errors: window.helixHeresyDebug.validateMapScene(),
      version: scene.version,
      perspective: scene.perspective,
      viewport: scene.viewport,
      queryBounds: scene.queryBounds,
      sceneCellCount: scene.cells.length,
      visibleCellCount: view.cells.length,
      domCellCount: window.helixHeresyDebug.mapDomSnapshot().length,
      entityCount: scene.entities.length,
      uniqueEntityCount: new Set(ids).size,
      multi,
      referencedCells,
      hasDomFields: JSON.stringify(scene).includes('styleTokens')
        || JSON.stringify(scene).includes('classNames')
        || JSON.stringify(scene).includes('stateClass'),
      roomAnchorVisualCount: scene.cells.filter((cell) => cell.visual.layer === 'roomAnchor' || cell.visual.spriteKey.startsWith('room.anchor.')).length,
      roomAnchorDomCount: window.helixHeresyDebug.mapDomSnapshot().filter((cell) => cell.classNames.includes('room-anchor')).length,
      roomTargetCount: scene.cells.filter((cell) => cell.target?.kind === 'room').length,
    };
  });

  expect(result.errors).toEqual([]);
  expect(result.version).toBe(9);
  expect(result.perspective.kind).toBe('debug');
  expect(result.sceneCellCount).toBeGreaterThan(result.visibleCellCount);
  expect(result.visibleCellCount).toBe(result.viewport.width * result.viewport.height);
  expect(result.domCellCount).toBe(result.visibleCellCount);
  expect(result.entityCount).toBe(result.uniqueEntityCount);
  expect(result.multi).toBeTruthy();
  expect(result.referencedCells.sort()).toEqual(result.multi.footprintCells.map(VisualState.cellKey).sort());
  expect(result.hasDomFields).toBe(false);
  expect(result.roomAnchorVisualCount).toBe(0);
  expect(result.roomAnchorDomCount).toBe(0);
  expect(result.roomTargetCount).toBeGreaterThan(0);
  expect(result.queryBounds.width).toBeGreaterThanOrEqual(result.viewport.width);
  expect(result.queryBounds.height).toBeGreaterThanOrEqual(result.viewport.height);

  const roomTile = page.locator('[data-map-target-kind="room"]').first();
  await expect(roomTile).toBeVisible();
  await roomTile.click();
  const roomInspector = page.locator('[data-selection-inspector="true"]');
  await expect(roomInspector).toHaveAttribute('data-selection-kind', 'room');
  await expect(roomInspector).toContainText('Expansion');
  await expect(roomInspector).toContainText(/Next:|Commissioned/);
});

test('player perspective withholds environmental values for unknown cells', async ({ page }) => {
  await startRun(page);
  await page.locator('#debugToggleBtn').click();
  await expect(page.locator('#debugToggleBtn')).toHaveAttribute('aria-pressed', 'false');

  const result = await page.evaluate(() => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    const unknown = scene.cells.find((cell) => cell.environment?.knowledge?.state === 'unknown');
    const observed = scene.cells.find((cell) =>
      cell.environment?.knowledge?.state === 'current'
      && cell.environment?.bands?.temperature
    );
    const mapKnowledge = window.helixHeresyDebug.mapKnowledgeSnapshot();
    const cellKnowledgeStates = [...new Set(scene.cells.map((cell) => cell.knowledge.state))];
    const stale = scene.cells.find((cell) => cell.knowledge.state === 'stale');
    const staleDoor = scene.cells.find((cell) => cell.knowledge.state === 'stale' && cell.door);
    const currentKeys = scene.cells
      .filter((cell) => cell.knowledge.state === 'current')
      .map((cell) => cell.key);
    const currentLightingBands = [...new Set(scene.cells
      .filter((cell) => cell.knowledge.state === 'current')
      .map((cell) => cell.lighting?.band)
      .filter(Boolean))];
    const domKnowledgeClasses = window.helixHeresyDebug.mapDomSnapshot()
      .flatMap((cell) => cell.classNames)
      .filter((name) => name.startsWith('knowledge-'));
    const domLightingClasses = window.helixHeresyDebug.mapDomSnapshot()
      .flatMap((cell) => cell.classNames)
      .filter((name) => name.startsWith('lighting-'));
    const currentSolid = scene.cells.find((cell) => cell.knowledge.state === 'current' && cell.base.kind === 'solidEarth');
    const currentGeology = currentSolid ? window.helixHeresyDebug.geologyCellSnapshot(currentSolid.cell) : null;
    const hiddenFeature = scene.cells
      .filter((cell) => cell.knowledge.state === 'unknown')
      .map((cell) => ({ cell, geology: window.helixHeresyDebug.geologyCellSnapshot(cell.cell) }))
      .find((entry) => entry.geology.actual.deposit || entry.geology.actual.hazard);
    let staleDoorPreserved = null;
    if (staleDoor) {
      const rememberedState = staleDoor.door.state;
      window.helixHeresyDebug.setDoorPhysicalState(
        staleDoor.door.key,
        rememberedState === 'open' ? 'closed' : 'open'
      );
      const after = window.helixHeresyDebug.mapSceneSnapshot().cells
        .find((cell) => cell.key === staleDoor.key);
      staleDoorPreserved = after?.door?.state === rememberedState;
    }
    return {
      perspective: scene.perspective.kind,
      unknownEnvironment: unknown?.environment,
      observedEnvironment: observed?.environment,
      knowledgeStates: [...new Set(scene.entities.map((entity) => entity.knowledge.state))],
      cellKnowledgeStates,
      staleBaseKind: stale?.base?.kind,
      currentKeysArePerceived: currentKeys.every((key) => mapKnowledge.perceivedCellKeys.includes(key)),
      observationCount: Object.keys(mapKnowledge.observations).length,
      domKnowledgeClasses,
      domLightingClasses,
      currentLightingBands,
      observedEnvironmentJson: JSON.stringify(observed?.environment),
      currentSolidBase: currentSolid?.base,
      currentGeology,
      hiddenFeatureBase: hiddenFeature?.cell.base,
      hiddenFeatureActual: hiddenFeature ? {
        depositId: hiddenFeature.geology.actual.deposit?.id || '',
        hazardId: hiddenFeature.geology.actual.hazard?.id || '',
      } : null,
      staleDoorPreserved,
    };
  });

  expect(result.perspective).toBe('player');
  expect(result.unknownEnvironment).toMatchObject({
    knowledge: { state: 'unknown', confidence: 0 },
    values: null,
  });
  expect(result.observedEnvironment).toMatchObject({
    knowledge: { state: 'current', confidence: 1 },
    values: null,
    bands: expect.objectContaining({
      temperature: expect.any(String),
      light: expect.any(String),
      humidity: expect.any(String),
      ambientMana: expect.any(String),
      contamination: expect.any(String),
    }),
  });
  expect(result.observedEnvironmentJson).not.toContain('chemicalTraces');
  expect(result.observedEnvironmentJson).not.toContain('"airborne":');
  expect(result.currentSolidBase.materialId).toBe(result.currentGeology.actual.stratum.materialId);
  expect(JSON.stringify(result.currentSolidBase)).not.toContain(result.currentGeology.actual.deposit?.id || 'unreachable-hidden-deposit');
  expect(JSON.stringify(result.currentSolidBase)).not.toContain(result.currentGeology.actual.hazard?.id || 'unreachable-hidden-hazard');
  expect(result.hiddenFeatureActual).toBeTruthy();
  expect(result.hiddenFeatureBase.kind).toBe('unknownDark');
  expect(JSON.stringify(result.hiddenFeatureBase)).not.toContain(result.hiddenFeatureActual.depositId || 'unreachable-hidden-deposit');
  expect(JSON.stringify(result.hiddenFeatureBase)).not.toContain(result.hiddenFeatureActual.hazardId || 'unreachable-hidden-hazard');
  expect(result.currentLightingBands.length).toBeGreaterThan(0);
  expect(result.knowledgeStates).not.toContain('debug');
  expect(result.cellKnowledgeStates).toEqual(expect.arrayContaining(['current', 'stale', 'unknown']));
  expect(result.staleBaseKind).not.toBe('unknownDark');
  expect(result.currentKeysArePerceived).toBe(true);
  expect(result.observationCount).toBeGreaterThan(0);
  expect(result.staleDoorPreserved).toBe(true);
  expect(result.domKnowledgeClasses).toEqual(expect.arrayContaining([
    'knowledge-current',
    'knowledge-stale',
    'knowledge-unknown',
  ]));
  expect(result.domLightingClasses.some((name) => ['lighting-dark', 'lighting-dim', 'lighting-lit', 'lighting-bright'].includes(name))).toBe(true);
});

test('contained slime remains an interaction target without becoming a map entity', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => window.helixHeresyDebug.createSpatialTestSlime({
    size: 'cup-sized',
    shape: 'spherical',
  }));
  const prepared = await page.evaluate(({ key, slimeId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const game = payload.state || payload;
    const container = game.containers.find((entry) => entry.typeId !== 'synthesisTube');
    const slime = game.slimes.find((entry) => entry.id === slimeId);
    slime.status = 'contained';
    slime.containerId = container.id;
    slime.roomId = container.roomId;
    slime.mapCell = null;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: game }));
    return { containerId: container.id };
  }, { key: storageKey, slimeId: created.id });

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const result = await page.evaluate(({ slimeId, containerId }) => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    return {
      slimeEntity: scene.entities.find((entity) => entity.id === `slime:${slimeId}`) || null,
      containerEntity: scene.entities.find((entity) => entity.id === `container:${containerId}`) || null,
      interaction: scene.interactionIndex.find((entry) =>
        entry.targets.some((target) => target.kind === 'slime' && target.id === slimeId)) || null,
      errors: window.helixHeresyDebug.validateMapScene(),
    };
  }, { slimeId: created.id, containerId: prepared.containerId });

  expect(result.errors).toEqual([]);
  expect(result.slimeEntity).toBeNull();
  expect(result.containerEntity).toBeTruthy();
  expect(result.interaction).toBeTruthy();
});
