// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const CanvasRenderer = require('../canvas-map-renderer.js');
const RenderOrder = require('../map-render-order.js');
const SpriteManifest = require('../sprite-asset-manifest.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function openRendererDebug(page) {
  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('[data-debug-menu-tab="performance"]').click();
}

async function canvasPointForCell(page, cell) {
  return page.evaluate((targetCell) => {
    const host = document.querySelector('.lab-map-canvas-host');
    const point = window.helixHeresyDebug.canvasPointForCell(targetCell);
    if (!host || !point) return null;
    const rect = host.getBoundingClientRect();
    return {
      x: rect.left + point.x + point.width / 2,
      y: rect.top + point.y + point.height / 2,
    };
  }, cell);
}

function recordingContext() {
  return new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

test('Canvas helpers cull overscan and derive presentation from semantic state', () => {
  const scene = {
    viewport: { x: 10, y: 10, z: 0, width: 2, height: 1 },
    cells: [
      { cell: { x: 9, y: 10, z: 0 }, base: { kind: 'unknownDark' } },
      { cell: { x: 10, y: 10, z: 0 }, base: { kind: 'room', role: 'mainLab' } },
      {
        cell: { x: 11, y: 10, z: 0 },
        base: { kind: 'floor' },
        overlay: { id: 'access', states: ['access-forbidden'] },
      },
      { cell: { x: 12, y: 10, z: 0 }, base: { kind: 'solidEarth' } },
      { cell: { x: 10, y: 10, z: 1 }, base: { kind: 'floor' } },
    ],
  };

  expect(CanvasRenderer.visibleCells(scene).map((cell) => cell.cell)).toEqual([
    { x: 10, y: 10, z: 0 },
    { x: 11, y: 10, z: 0 },
  ]);
  expect(CanvasRenderer.renderCells(scene, { includeOverscan: true }).map((cell) => cell.cell)).toEqual([
    { x: 9, y: 10, z: 0 },
    { x: 10, y: 10, z: 0 },
    { x: 11, y: 10, z: 0 },
    { x: 12, y: 10, z: 0 },
  ]);
  const presentation = { tilePx: 20, origin: { x: -4, y: 6 } };
  expect(CanvasRenderer.screenToCell(scene, { x: 17, y: 16 }, presentation)).toEqual({ x: 11, y: 10, z: 0 });
  expect(CanvasRenderer.cellToScreen(scene, { x: 11, y: 10, z: 0 }, presentation)).toEqual({
    x: 16,
    y: 6,
    width: 20,
    height: 20,
  });
  expect(CanvasRenderer.cellStyle(scene.cells[1])).toMatchObject({
    fill: '#22251d',
    stroke: '#2c3128',
  });
  expect(CanvasRenderer.cellStyle(scene.cells[2])).toMatchObject({
    fill: '#3b1d1d',
    stroke: '#e8685b',
  });
  expect(CanvasRenderer.cellStyle({
    base: { kind: 'floor' },
    knowledge: { state: 'stale', tier: 'archived' },
  })).toMatchObject({
    dashed: true,
    alpha: 0.48,
  });
  expect(CanvasRenderer.entityStyle({
    kind: 'slime',
    knowledge: { state: 'stale' },
  })).toMatchObject({
    fill: '#1f2b1a',
    stroke: '#75b86b',
    dashed: true,
    alpha: 0.62,
  });
  expect(CanvasRenderer.actorCueModel({
    kind: 'slime',
    category: 'actor',
    facing: 'west',
    pose: 'attacking',
    condition: { cues: ['critical', 'compressed'] },
  })).toEqual({
    facing: 'west',
    pose: 'attacking',
    poseMark: '!',
    conditionMarks: ['!!', '='],
  });
  expect(CanvasRenderer.actorCueModel({ kind: 'fixture', category: 'fixture' })).toBeNull();
  const movingActor = {
    id: 'moving-actor',
    kind: 'slime',
    category: 'actor',
    anchorCell: { x: 0, y: 0, z: 0 },
    footprintCells: [{ x: 0, y: 0, z: 0 }],
    bounds: { x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1 },
    knowledge: { state: 'current' },
    target: { kind: 'slime', id: 'moving-actor' },
    visual: { key: '', glyph: 'L', layer: '' },
    motion: {
      id: 'moving-actor:1',
      state: 'moving',
      intent: 'move',
      fromCell: { x: 0, y: 0, z: 0 },
      toCell: { x: 1, y: 0, z: 0 },
      segmentStartedAt: 0,
      segmentArriveAt: 2,
      revision: '1',
    },
  };
  expect(CanvasRenderer.entityMotionSample(movingActor, {
    presentationTime: 1,
    speed: 1,
  })).toMatchObject({
    interpolated: true,
    active: true,
    progress: 0.5,
    offset: { x: 0.5, y: 0 },
  });
  const movingResult = CanvasRenderer.renderScene(recordingContext(), {
    viewport: { x: 0, y: 0, z: 0, width: 2, height: 1 },
    cells: [
      { key: '0,0,0', cell: { x: 0, y: 0, z: 0 }, base: { kind: 'floor' }, visual: {} },
      { key: '1,0,0', cell: { x: 1, y: 0, z: 0 }, base: { kind: 'floor' }, visual: {} },
    ],
    entities: [movingActor],
    effects: [],
    selection: { entityId: 'moving-actor', cells: [{ x: 0, y: 0, z: 0 }] },
  }, {
    tilePx: 20,
    presentationTime: 1,
    speed: 1,
  });
  expect(movingResult).toMatchObject({
    activeAnimations: 1,
    animationActive: true,
    interpolatedEntities: 1,
    entityHitRegions: [{
      entityId: 'moving-actor',
      x: 16,
      y: 6,
      width: 20,
      height: 20,
    }],
  });

  const workbench = SpriteManifest.manifest.assets.find((entry) => entry.key === 'fixture.basicWorkbench');
  const resolved = { entry: workbench, image: {} };
  const placements = [0, 1, 2, 3].map((quarterTurns) => {
    const rotated = quarterTurns % 2 === 1;
    return CanvasRenderer.spritePlacement({
      id: `workbench-${quarterTurns}`,
      anchorCell: { x: 4, y: 7, z: 0 },
      bounds: { x: 4, y: 7, z: 0, width: rotated ? 1 : 2, height: rotated ? 2 : 1, depth: 1 },
      orientation: { quarterTurns, mirrored: false },
    }, resolved);
  });
  expect(placements.every((placement) => placement.matches)).toBe(true);
  expect(placements.map((placement) => placement.bounds)).toEqual([
    { x: 4, y: 7, z: 0, width: 2, height: 1, depth: 1 },
    { x: 4, y: 7, z: 0, width: 1, height: 2, depth: 1 },
    { x: 4, y: 7, z: 0, width: 2, height: 1, depth: 1 },
    { x: 4, y: 7, z: 0, width: 1, height: 2, depth: 1 },
  ]);
  expect(placements[0].source).toEqual({ x: 0, y: 313, width: 1254, height: 627 });
  expect(CanvasRenderer.spritePlacement({
    anchorCell: { x: 4, y: 7, z: 0 },
    bounds: { x: 4, y: 7, z: 0, width: 1, height: 1, depth: 1 },
    orientation: { quarterTurns: 0, mirrored: false },
  }, resolved)).toMatchObject({
    matches: false,
    reason: expect.stringContaining('asset expects 2x1x1'),
  });
  const largeSlime = SpriteManifest.manifest.assets.find((entry) => entry.key === 'actor.slime.large');
  expect(CanvasRenderer.spritePlacement({
    anchorCell: { x: 8, y: 9, z: 0 },
    bounds: { x: 8, y: 9, z: 0, width: 2, height: 2, depth: 1 },
    orientation: { quarterTurns: 0, mirrored: true },
  }, { entry: largeSlime, image: {} })).toMatchObject({
    matches: true,
    orientation: { quarterTurns: 0, mirrored: true },
  });

  const layeredEntities = [
    { id: 'actor-south', category: 'actor', bounds: { x: 1, y: 4, z: 0, width: 1, height: 1 } },
    { id: 'overhead', category: 'fixture', visual: { layer: 'overhead' }, bounds: { x: 1, y: 1, z: 0, width: 1, height: 1 } },
    { id: 'item', category: 'item', bounds: { x: 1, y: 3, z: 0, width: 1, height: 1 } },
    { id: 'actor-north', category: 'actor', bounds: { x: 1, y: 2, z: 0, width: 1, height: 1 } },
    { id: 'fixture', category: 'fixture', bounds: { x: 1, y: 2, z: 0, width: 1, height: 1 } },
    { id: 'remains', category: 'remains', bounds: { x: 1, y: 2, z: 0, width: 1, height: 1 } },
    { id: 'spill', category: 'hazard', bounds: { x: 1, y: 2, z: 0, width: 1, height: 1 } },
  ];
  expect(RenderOrder.orderedEntities(layeredEntities).map((entity) => entity.id)).toEqual([
    'spill',
    'item',
    'remains',
    'fixture',
    'actor-north',
    'actor-south',
    'overhead',
  ]);

  const occupiedCell = { x: 2, y: 2, z: 1 };
  const occlusionScene = {
    viewport: { x: 2, y: 2, z: 1, width: 1, height: 1 },
    cells: [{
      key: '2,2,1',
      cell: occupiedCell,
      base: { kind: 'floor' },
      visual: { glyph: '', layer: 'base' },
      planned: { taskId: 'planned-test' },
      cursor: true,
    }],
    entities: [
      {
        id: 'tall-actor',
        kind: 'slime',
        category: 'actor',
        selected: true,
        anchorCell: { x: 2, y: 2, z: 0 },
        footprintCells: [{ x: 2, y: 2, z: 0 }, occupiedCell],
        bounds: { x: 2, y: 2, z: 0, width: 1, height: 1, depth: 2 },
        knowledge: { state: 'current' },
        target: { kind: 'slime', id: 'tall-actor' },
        visual: { key: '', glyph: 'L', layer: '' },
      },
      {
        id: 'ceiling-duct',
        kind: 'fixture',
        category: 'fixture',
        selected: false,
        anchorCell: occupiedCell,
        footprintCells: [occupiedCell],
        bounds: { x: 2, y: 2, z: 1, width: 1, height: 1, depth: 1 },
        knowledge: { state: 'current' },
        target: { kind: 'fixture', id: 'ceiling-duct' },
        visual: { key: '', glyph: 'D', layer: 'overhead' },
      },
    ],
    effects: [{
      id: 'known-alert',
      plane: 'alert',
      cells: [occupiedCell],
      severity: 'serious',
      knowledge: { state: 'current' },
      visualKey: '',
      target: { kind: 'incident', id: 'known-alert' },
    }],
    selection: { entityId: 'tall-actor', cells: [occupiedCell] },
  };
  expect(RenderOrder.entityLayerMode(occlusionScene.entities[0], 1)).toBe('slice');
  expect([...RenderOrder.selectedOccluderIds(occlusionScene)]).toEqual(['ceiling-duct']);
  expect([...RenderOrder.cutawayEntityIds(occlusionScene)]).toEqual(['ceiling-duct']);
  expect([...RenderOrder.cutawayEntityIds({
    ...occlusionScene,
    entities: occlusionScene.entities.map((entity) => ({
      ...entity,
      selected: entity.id === 'ceiling-duct',
    })),
  })]).toEqual([]);
  expect(RenderOrder.orderInteractionTargets(occlusionScene, [
    { kind: 'tile', tile: occupiedCell },
    { kind: 'slime', id: 'tall-actor' },
    { kind: 'corpse', id: 'contained-remains' },
    { kind: 'fixture', id: 'ceiling-duct' },
    { kind: 'incident', id: 'known-alert' },
  ]).map(RenderOrder.targetKey)).toEqual([
    'incident:known-alert',
    'fixture:ceiling-duct',
    'slime:tall-actor',
    'corpse:contained-remains',
    'tile:2,2,1',
  ]);
  expect(CanvasRenderer.renderScene(recordingContext(), occlusionScene)).toMatchObject({
    tallSlicesDrawn: 1,
    fadedOccludersDrawn: 1,
    overheadCutawaysDrawn: 1,
    renderPassCounts: {
      terrain: 1,
      path: 1,
      actor: 1,
      overhead: 1,
      alert: 1,
      selection: 1,
      cursor: 1,
    },
  });
});

test('Debug renderer switch draws a nonblank high-DPI Canvas from MapScene', async ({ page }) => {
  await startRun(page);
  await expect(page.locator('.lab-map-grid[data-map-renderer="dom"]')).toBeVisible();

  await openRendererDebug(page);
  await expect(page.locator('#mapRendererDomBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#mapRendererCanvasBtn').click();
  await expect(page.locator('#mapRendererCanvasBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-workspace-tab="map"]').click();

  const canvas = page.locator('canvas[data-canvas-map="true"]');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.lab-map-grid')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-canvas-frame-count', /[1-9]\d*/);
  await expect(page.locator('#canvasMapPrototypeNotice')).toContainText('selection, tooltips, contextual commands');

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-canvas-map="true"]');
    const rect = canvas.getBoundingClientRect();
    return {
      rect: { width: rect.width, height: rect.height },
      backing: { width: canvas.width, height: canvas.height },
      diagnostics: window.helixHeresyDebug.mapRendererSnapshot(),
      scene: window.helixHeresyDebug.mapSceneSnapshot(),
      pointerEvents: getComputedStyle(canvas).pointerEvents,
    };
  });

  expect(result.rect.width).toBeGreaterThan(500);
  expect(result.rect.height).toBeGreaterThan(300);
  expect(result.backing.width).toBeGreaterThanOrEqual(Math.floor(result.rect.width));
  expect(result.backing.height).toBeGreaterThanOrEqual(Math.floor(result.rect.height));
  expect(result.pointerEvents).toBe('none');
  expect(result.diagnostics.mode).toBe('canvas');
  expect(result.diagnostics.canvas.frameCount).toBeGreaterThan(0);
  expect(result.diagnostics.canvas.cellsDrawn).toBeGreaterThanOrEqual(
    result.scene.viewport.width * result.scene.viewport.height
  );
  expect(result.diagnostics.canvas.entitiesDrawn).toBeGreaterThan(0);
  expect(result.diagnostics.canvas.version).toBe(3);
  expect(result.diagnostics.canvas.renderPassCounts.terrain).toBeGreaterThan(0);
  expect(result.diagnostics.canvas.renderPassCounts.fixture).toBeGreaterThan(0);
  expect(result.diagnostics.canvas.renderPassCounts.actor).toBeGreaterThan(0);
  expect(result.diagnostics.canvasDraw.calls).toBeGreaterThan(0);
  expect(result.diagnostics.sceneBuild.calls).toBeGreaterThan(0);
});

test('Canvas hit testing selects full semantic footprints and opens existing contextual commands', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  const target = await page.evaluate(() => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    for (const entity of scene.entities) {
      if (!entity.target || entity.footprintCells.length <= 1 || !entity.footprintCells.every((cell) =>
        cell.z === scene.viewport.z
        && cell.x >= scene.viewport.x
        && cell.x < scene.viewport.x + scene.viewport.width
        && cell.y >= scene.viewport.y
        && cell.y < scene.viewport.y + scene.viewport.height
      )) continue;
      const clickedCell = entity.footprintCells.at(-1);
      const interaction = scene.interactionIndex.find((entry) =>
        entry.key === window.HelixMapVisualState.cellKey(clickedCell)
      );
      if (interaction?.targets?.length > 1
        && window.HelixMapRenderOrder.targetKey(interaction.targets[0])
          === window.HelixMapRenderOrder.targetKey(entity.target)) {
        return { entity, clickedCell, orderedTargets: interaction.targets };
      }
    }
    return null;
  });
  expect(target).toBeTruthy();
  const point = await canvasPointForCell(page, target.clickedCell);
  expect(point).toBeTruthy();
  await page.mouse.click(point.x, point.y);

  const result = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    return {
      selection: view.scene.selection,
      cursor: view.cursor,
    };
  });
  expect(result.selection.target).toMatchObject(target.entity.target);
  expect(result.selection.cells).toEqual(expect.arrayContaining(target.entity.footprintCells));
  expect(result.cursor).toEqual(target.clickedCell);
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', target.entity.target.kind);
  const alsoHereKeys = await page.locator('[data-selection-also-here-key]').evaluateAll((links) =>
    links.map((link) => link.dataset.selectionAlsoHereKey)
  );
  expect(alsoHereKeys[0]).toBe(RenderOrder.targetKey(target.orderedTargets[1]));

  await page.mouse.move(point.x + 1, point.y + 1);
  const tooltip = page.locator('[data-canvas-map-tooltip="true"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).not.toHaveText('');

  await page.locator('[data-command-menu-trigger="true"]').first().click();
  await expect(page.locator('[data-context-command-menu="true"]')).toBeVisible();
  await expect(page.locator('[data-context-command-panel="true"]')).not.toContainText('No contextual commands');
  await page.locator('[data-context-command-menu="true"]').getByRole('button', { name: 'Close', exact: true }).click();

  await page.mouse.click(point.x, point.y);
  const cycledSelection = await page.evaluate(() =>
    window.helixHeresyDebug.mapSceneSnapshot().selection.target
  );
  expect(RenderOrder.targetKey(cycledSelection)).toBe(RenderOrder.targetKey(target.orderedTargets[1]));
});

test('Canvas construction selection and access-area drag painting use the same map cells as DOM tools', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));

  const rockCells = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const candidates = view.cells.filter((cell) => cell.known && cell.base.kind === 'solidEarth');
    for (const cell of candidates) {
      const neighbor = candidates.find((entry) =>
        entry.cell.z === cell.cell.z
        && entry.cell.x === cell.cell.x + 1
        && entry.cell.y === cell.cell.y
      );
      if (neighbor) return [cell.cell, neighbor.cell];
    }
    return [];
  });
  expect(rockCells).toHaveLength(2);
  const firstRock = await canvasPointForCell(page, rockCells[0]);
  await page.mouse.click(firstRock.x, firstRock.y);
  await page.locator('[data-command-menu-trigger="true"]').first().click();
  await page.getByRole('button', { name: 'Add Dig Tile', exact: true }).click();
  const secondRock = await canvasPointForCell(page, rockCells[1]);
  await page.mouse.click(secondRock.x, secondRock.y);
  const construction = await page.evaluate(() => window.helixHeresyDebug.constructionSnapshot());
  expect(construction.draftCells).toEqual(expect.arrayContaining(rockCells));

  await page.locator('[data-workspace-tab="policies"]').click();
  await page.locator('[data-policy-menu-tab="access"]').click();
  page.once('dialog', (dialog) => dialog.accept('Canvas Hazard'));
  await page.getByRole('button', { name: 'New Forbidden Area' }).click();
  await expect(page.locator('.lab-map-canvas-host')).toBeVisible();

  const paintCells = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const candidates = view.cells.filter((cell) =>
      cell.known
      && ['room', 'floor'].includes(cell.base.kind)
      && !cell.scientist
      && !cell.object
      && !cell.door
    );
    for (const cell of candidates) {
      const neighbor = candidates.find((entry) =>
        entry.cell.z === cell.cell.z
        && entry.cell.x === cell.cell.x + 1
        && entry.cell.y === cell.cell.y
      );
      if (neighbor) return [cell.cell, neighbor.cell];
    }
    return [];
  });
  expect(paintCells).toHaveLength(2);
  const paintStart = await canvasPointForCell(page, paintCells[0]);
  const paintEnd = await canvasPointForCell(page, paintCells[1]);
  await page.mouse.move(paintStart.x, paintStart.y);
  await page.mouse.down();
  await page.mouse.move(paintEnd.x, paintEnd.y, { steps: 4 });
  await page.mouse.up();
  const access = await page.evaluate(() => window.helixHeresyDebug.accessControlSnapshot());
  expect(access.areas[0].cells).toEqual(expect.arrayContaining(paintCells));
});

test('Canvas room designation drag uses the active paint or erase brush', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  const roomCell = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    return view.cells.find((cell) =>
      cell.known
      && cell.base.kind === 'room'
      && !cell.scientist
      && !cell.object
      && !cell.door
    ).cell;
  });
  const roomPoint = await canvasPointForCell(page, roomCell);
  await page.mouse.click(roomPoint.x, roomPoint.y);
  await page.locator('[data-command-menu-trigger="true"]').first().click();
  await page.getByRole('button', { name: 'Edit Room Tiles', exact: true }).click();
  await page.locator('[data-command-menu-trigger="true"]').first().click();
  await page.getByRole('button', { name: 'Erase Tiles', exact: true }).click();

  const eraseCells = await page.evaluate(() => {
    const draft = window.helixHeresyDebug.constructionSnapshot().roomDraftCells;
    for (const cell of draft) {
      const neighbor = draft.find((entry) =>
        entry.z === cell.z
        && entry.x === cell.x + 1
        && entry.y === cell.y
      );
      if (neighbor) return [cell, neighbor];
    }
    return [];
  });
  expect(eraseCells).toHaveLength(2);
  const eraseStart = await canvasPointForCell(page, eraseCells[0]);
  const eraseEnd = await canvasPointForCell(page, eraseCells[1]);
  await page.mouse.move(eraseStart.x, eraseStart.y);
  await page.mouse.down();
  await page.mouse.move(eraseEnd.x, eraseEnd.y, { steps: 4 });
  await page.mouse.up();

  const remaining = await page.evaluate(() => window.helixHeresyDebug.constructionSnapshot().roomDraftCells);
  expect(remaining).not.toEqual(expect.arrayContaining(eraseCells));
});

test('Canvas redraws after keyboard camera movement and the renderer resets on reload', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await expect(page.locator('canvas[data-canvas-map="true"]')).toHaveAttribute('data-canvas-frame-count', /[1-9]\d*/);
  const before = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().viewport.x);

  await page.keyboard.down('d');
  await page.waitForTimeout(180);
  await page.keyboard.up('d');
  await expect(page.locator('canvas[data-canvas-map="true"]')).toHaveAttribute('data-canvas-frame-count', /[1-9]\d*/);
  const after = await page.evaluate(() => ({
    x: window.helixHeresyDebug.mapSceneSnapshot().viewport.x,
    renderer: window.helixHeresyDebug.mapRendererSnapshot(),
  }));
  expect(after.x).toBeGreaterThan(before);
  expect(after.renderer.mode).toBe('canvas');
  expect(after.renderer.canvas.cellsDrawn).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('canvas[data-canvas-map="true"]')).toHaveAttribute('data-canvas-frame-count', /[1-9]\d*/);
  const selection = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().selection);
  expect(selection.target).toBeTruthy();
  expect(selection.cells.length).toBeGreaterThan(0);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  await expect(page.locator('.lab-map-grid[data-map-renderer="dom"]')).toBeVisible();
  expect(await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot().mode)).toBe('dom');
});

test('Canvas preserves its surface through smooth pan, middle drag, and pointer-anchored zoom', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  const host = page.locator('.lab-map-canvas-host');
  const canvas = page.locator('canvas[data-canvas-map="true"]');
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => { element.dataset.persistenceSentinel = 'same-canvas'; });

  const before = await page.evaluate(() => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    const state = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}').state;
    return {
      viewport: scene.viewport,
      clock: state.clock,
      frameCount: Number(document.querySelector('canvas[data-canvas-map="true"]').dataset.canvasFrameCount),
    };
  });

  await page.keyboard.down('d');
  await page.waitForTimeout(240);
  const during = await page.evaluate(() => window.helixHeresyDebug.mapRendererSnapshot());
  await page.keyboard.up('d');
  await expect(canvas).toHaveAttribute('data-persistence-sentinel', 'same-canvas');
  expect(during.canvas.presentation.includeOverscan).toBe(true);
  expect(during.canvas.frameCount).toBeGreaterThan(before.frameCount);

  const box = await host.boundingBox();
  if (!box) throw new Error('Canvas map host has no bounds.');
  const startX = box.x + box.width * 0.55;
  const startY = box.y + box.height * 0.55;
  const beforeDrag = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().viewport);
  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(startX + 90, startY, { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  const afterDrag = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().viewport);
  expect(afterDrag.x).toBeLessThan(beforeDrag.x);
  await expect(canvas).toHaveAttribute('data-persistence-sentinel', 'same-canvas');

  const anchorBefore = await page.evaluate(({ x, y }) => {
    const cell = window.helixHeresyDebug.canvasPointToCell(x, y);
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    return {
      cell,
      relativeX: (cell.x - scene.viewport.x + 0.5) / scene.viewport.width,
      relativeY: (cell.y - scene.viewport.y + 0.5) / scene.viewport.height,
      zoom: window.helixHeresyDebug.mapViewSnapshot().zoom.index,
    };
  }, { x: box.x + box.width * 0.72, y: box.y + box.height * 0.32 });
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.32);
  await page.mouse.wheel(0, -200);
  const anchorAfter = await page.evaluate((cell) => {
    const scene = window.helixHeresyDebug.mapSceneSnapshot();
    return {
      relativeX: (cell.x - scene.viewport.x + 0.5) / scene.viewport.width,
      relativeY: (cell.y - scene.viewport.y + 0.5) / scene.viewport.height,
      zoom: window.helixHeresyDebug.mapViewSnapshot().zoom.index,
      clock: JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}').state.clock,
    };
  }, anchorBefore.cell);
  expect(anchorAfter.zoom).toBeGreaterThan(anchorBefore.zoom);
  expect(Math.abs(anchorAfter.relativeX - anchorBefore.relativeX)).toBeLessThan(0.08);
  expect(Math.abs(anchorAfter.relativeY - anchorBefore.relativeY)).toBeLessThan(0.08);
  expect(anchorAfter.clock).toBe(before.clock);
  await expect(canvas).toHaveAttribute('data-persistence-sentinel', 'same-canvas');
});

test('Canvas resize preserves the viewed center and updates its semantic viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await expect(page.locator('canvas[data-canvas-map="true"]')).toBeVisible();
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => {
    const viewport = window.helixHeresyDebug.mapSceneSnapshot().viewport;
    return {
      viewport,
      center: { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 },
    };
  });

  await page.setViewportSize({ width: 1180, height: 760 });
  await expect.poll(async () => page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().viewport.width))
    .not.toBe(before.viewport.width);
  const after = await page.evaluate(() => {
    const viewport = window.helixHeresyDebug.mapSceneSnapshot().viewport;
    return {
      viewport,
      center: { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 },
    };
  });
  expect(Math.abs(after.center.x - before.center.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.center.y - before.center.y)).toBeLessThanOrEqual(1);
});

test('performance panel reports scene-build and Canvas-draw costs separately', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  await expect(page.locator('canvas[data-canvas-map="true"]')).toHaveAttribute('data-canvas-frame-count', /[1-9]\d*/);
  await openRendererDebug(page);

  await expect(page.locator('#simulationPerformanceReadout')).toContainText('Map scene build');
  await expect(page.locator('#simulationPerformanceReadout')).toContainText('Canvas draw');
  await expect(page.locator('#simulationPerformanceReadout')).toContainText('current-surface frame');

  await page.locator('#mapRendererDomBtn').click();
  await page.locator('[data-workspace-tab="map"]').click();
  await expect(page.locator('.lab-map-grid[data-map-renderer="dom"]')).toBeVisible();
});
