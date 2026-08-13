// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('the saved site contains bounded surface ground, a roofed shell, and a physical basement stair', async ({ page }) => {
  await startRun(page);

  const result = await page.evaluate(() => {
    const surface = window.helixHeresyDebug.surfaceMapSnapshot();
    const vertical = window.helixHeresyDebug.verticalMapSnapshot();
    const route = window.helixHeresyDebug.navigationPlan(
      surface.basementStair.lowerCell,
      surface.basementStair.upperCell
    );
    return { surface, vertical, route };
  });

  expect(result.surface).toMatchObject({
    surfaceZ: 1,
    layer: { id: 'surface', kind: 'surface', label: 'Surface' },
    samples: {
      outdoor: expect.objectContaining({ z: 1 }),
      interior: expect.objectContaining({ z: 1 }),
      threshold: expect.objectContaining({ z: 1 }),
    },
    frontDoor: expect.objectContaining({ id: 'door-surface-front' }),
    basementStair: expect.objectContaining({ id: 'stairs-basement-surface', type: 'carvedStairs' }),
  });
  expect(result.surface.ground.length).toBeGreaterThan(250);
  expect(result.surface.roofs.length).toBeGreaterThan(100);
  expect(result.surface.walls.length).toBeGreaterThan(30);
  expect(result.surface.envelopeCounts.outdoor).toBeGreaterThan(0);
  expect(result.surface.envelopeCounts.interior).toBeGreaterThan(0);
  expect(result.vertical.excavated).not.toContainEqual(result.surface.basementStair.upperCell);
  expect(result.route).toMatchObject({ found: true, cost: 4 });
  expect(result.route.path).toEqual([
    result.surface.basementStair.lowerCell,
    result.surface.basementStair.upperCell,
  ]);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const restored = await page.evaluate(() => window.helixHeresyDebug.surfaceMapSnapshot());
  expect(restored.ground).toEqual(result.surface.ground);
  expect(restored.roofs).toEqual(result.surface.roofs);
  expect(restored.basementStair).toEqual(result.surface.basementStair);
});

test('surface plans remain visible without leaking live surface state', async ({ page }) => {
  await startRun(page);
  await page.locator('#debugToggleBtn').click();
  await page.evaluate(() => window.helixHeresyDebug.setMapLayer(1));

  const result = await page.evaluate(() => {
    const surface = window.helixHeresyDebug.surfaceMapSnapshot();
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const key = `${surface.samples.interior.x},${surface.samples.interior.y},${surface.samples.interior.z}`;
    const cell = view.scene.cells.find((entry) => entry.key === key);
    const domCell = window.helixHeresyDebug.mapDomSnapshot().find((entry) =>
      entry.dataset.mapX === String(surface.samples.interior.x)
      && entry.dataset.mapY === String(surface.samples.interior.y)
      && entry.dataset.mapZ === String(surface.samples.interior.z));
    return { surface, cell, domCell };
  });

  await expect(page.locator('[data-map-layer-readout="true"]')).toHaveText('Surface · Z 1');
  expect(result.cell).toMatchObject({
    knowledge: { state: 'stale', source: 'starter map' },
    base: { surface: true, enclosure: 'interior', roofed: true, openSky: false },
  });
  expect(result.cell.environment.values).toBeNull();
  expect(result.domCell.classNames).toEqual(expect.arrayContaining(['surface-cell', 'enclosure-interior']));
  expect(result.domCell.dataset).toMatchObject({ mapEnclosure: 'interior', mapSurface: 'gravel' });
});

test('open-sky tiles receive daylight and relax toward the exterior atmosphere', async ({ page }) => {
  await startRun(page);
  const before = await page.evaluate(() => {
    const surface = window.helixHeresyDebug.surfaceMapSnapshot();
    window.helixHeresyDebug.setTileEnvironment(surface.samples.outdoor, {
      temperatureC: 80,
      humidity: 90,
      manaDensity: 100,
      airborne: { 'surface-test-fume': 100 },
    });
    return {
      surface,
      environment: window.helixHeresyDebug.tileEnvironmentSnapshot(surface.samples.outdoor)[0],
    };
  });
  expect(before.surface.daylight).toBeGreaterThan(0);
  expect(before.environment.lightLevel).toBeGreaterThan(0);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
  const afterHour = await page.evaluate((cell) => ({
    environment: window.helixHeresyDebug.tileEnvironmentSnapshot(cell)[0],
    failures: window.helixHeresyDebug.verticalMapSnapshot().failures,
  }), before.surface.samples.outdoor);
  expect(afterHour.environment.temperatureC).toBeLessThan(80);
  expect(afterHour.environment.humidity).toBeLessThan(90);
  expect(afterHour.environment.manaDensity).toBeLessThan(100);
  expect(afterHour.environment.airborne['surface-test-fume']).toBeLessThan(100);
  expect(afterHour.failures.filter((failure) => failure.kind === 'constructedFloor' && failure.cell.z === 2)).toEqual([]);

  const night = await page.evaluate(() => window.helixHeresyDebug.surfaceDaylightAtClock(12 * 3600));
  expect(night).toBe(0);
});
