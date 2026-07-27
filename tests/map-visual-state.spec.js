// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const VisualState = require('../map-visual-state.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('scene model deduplicates entities while retaining footprint and interaction references', () => {
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
  const scene = VisualState.buildScene({
    viewport: { x: 1, y: 1, z: 0, width: 2, height: 1 },
    cells,
    entities: [{
      id: 'container:jar-1',
      kind: 'container',
      target: { kind: 'container', id: 'jar-1' },
      anchorCell: { x: 1, y: 1, z: 0 },
      footprintCells: [{ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],
      knowledge: { state: 'current' },
      visual: { key: 'container.jar', glyph: 'C', layer: 'wallMounted' },
    }],
    effects: [{
      id: 'incident:test',
      kind: 'incident',
      cell: { x: 1, y: 1, z: 0 },
      plane: 'alert',
      knowledge: { state: 'current' },
    }],
    selection: { target: { kind: 'container', id: 'jar-1' } },
  });

  expect(scene.entities).toHaveLength(1);
  expect(VisualState.cleanOrientation(90)).toEqual({ quarterTurns: 1, mirrored: false });
  expect(VisualState.cleanOrientation({ quarterTurns: 2, mirrored: true }))
    .toEqual({ quarterTurns: 2, mirrored: true });
  expect(scene.entities[0]).toMatchObject({
    id: 'container:jar-1',
    selected: true,
    orientation: { quarterTurns: 0, mirrored: false },
    visual: { layer: 'wallMounted' },
    footprintCells: [{ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],
  });
  expect(scene.effects[0].plane).toBe('alert');
  expect(scene.cells.every((cell) => cell.entityIds.includes('container:jar-1'))).toBe(true);
  expect(scene.interactionIndex[0].targets).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'container', id: 'jar-1' }),
    expect.objectContaining({ kind: 'slime', id: 'slime-1' }),
    expect.objectContaining({ kind: 'room', roomId: 'mainLab' }),
    expect.objectContaining({ kind: 'tile', tile: { x: 1, y: 1, z: 0 } }),
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
    };
  });

  expect(result.errors).toEqual([]);
  expect(result.version).toBe(3);
  expect(result.perspective.kind).toBe('debug');
  expect(result.sceneCellCount).toBeGreaterThan(result.visibleCellCount);
  expect(result.visibleCellCount).toBe(result.viewport.width * result.viewport.height);
  expect(result.domCellCount).toBe(result.visibleCellCount);
  expect(result.entityCount).toBe(result.uniqueEntityCount);
  expect(result.multi).toBeTruthy();
  expect(result.referencedCells.sort()).toEqual(result.multi.footprintCells.map(VisualState.cellKey).sort());
  expect(result.hasDomFields).toBe(false);
  expect(result.queryBounds.width).toBeGreaterThanOrEqual(result.viewport.width);
  expect(result.queryBounds.height).toBeGreaterThanOrEqual(result.viewport.height);
});

test('player perspective withholds environmental values for unknown cells', async ({ page }) => {
  await startRun(page);
  await page.locator('#debugToggleBtn').click();
  await expect(page.locator('#debugToggleBtn')).toHaveAttribute('aria-pressed', 'false');

  const result = await page.evaluate(() => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    const unknown = scene.cells.find((cell) => cell.environment?.knowledge?.state === 'unknown');
    const observed = scene.cells.find((cell) => cell.environment?.knowledge?.state === 'current');
    return {
      perspective: scene.perspective.kind,
      unknownEnvironment: unknown?.environment,
      observedEnvironment: observed?.environment,
      knowledgeStates: [...new Set(scene.entities.map((entity) => entity.knowledge.state))],
    };
  });

  expect(result.perspective).toBe('player');
  expect(result.unknownEnvironment).toMatchObject({
    knowledge: { state: 'unknown', confidence: 0 },
    values: null,
  });
  expect(result.observedEnvironment).toMatchObject({
    knowledge: { state: 'current', confidence: 1 },
    values: expect.any(Object),
    bands: null,
  });
  expect(result.knowledgeStates).not.toContain('debug');
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
