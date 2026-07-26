// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const CanvasRenderer = require('../canvas-map-renderer.js');

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
  expect(CanvasRenderer.entityStyle({
    kind: 'slime',
    knowledge: { state: 'stale' },
  })).toMatchObject({
    fill: '#1f2b1a',
    stroke: '#75b86b',
    dashed: true,
    alpha: 0.62,
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
  await expect(page.locator('#canvasMapPrototypeNotice')).toContainText('camera controls are active');

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-canvas-map="true"]');
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBackgroundSamples = 0;
    const pixelStep = Math.max(1, Math.round(12 * (window.devicePixelRatio || 1)));
    for (let y = 0; y < canvas.height; y += pixelStep) {
      for (let x = 0; x < canvas.width; x += pixelStep) {
        const index = (y * canvas.width + x) * 4;
        const isBackground = data[index] === 9 && data[index + 1] === 10 && data[index + 2] === 8;
        if (!isBackground) nonBackgroundSamples += 1;
      }
    }
    return {
      rect: { width: rect.width, height: rect.height },
      backing: { width: canvas.width, height: canvas.height },
      nonBackgroundSamples,
      diagnostics: window.helixHeresyDebug.mapRendererSnapshot(),
      scene: window.helixHeresyDebug.mapSceneSnapshot(),
      pointerEvents: getComputedStyle(canvas).pointerEvents,
    };
  });

  expect(result.rect.width).toBeGreaterThan(500);
  expect(result.rect.height).toBeGreaterThan(300);
  expect(result.backing.width).toBeGreaterThanOrEqual(Math.floor(result.rect.width));
  expect(result.backing.height).toBeGreaterThanOrEqual(Math.floor(result.rect.height));
  expect(result.nonBackgroundSamples).toBeGreaterThan(20);
  expect(result.pointerEvents).toBe('none');
  expect(result.diagnostics.mode).toBe('canvas');
  expect(result.diagnostics.canvas.frameCount).toBeGreaterThan(0);
  expect(result.diagnostics.canvas.cellsDrawn).toBeGreaterThanOrEqual(
    result.scene.viewport.width * result.scene.viewport.height
  );
  expect(result.diagnostics.canvas.entitiesDrawn).toBeGreaterThan(0);
  expect(result.diagnostics.canvasDraw.calls).toBeGreaterThan(0);
  expect(result.diagnostics.sceneBuild.calls).toBeGreaterThan(0);
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
