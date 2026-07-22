// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function finishVerticalOrder(page, mode, cell) {
  const created = await page.evaluate(({ mode, cell }) => window.helixHeresyDebug.designateVerticalExcavation(mode, cell), { mode, cell });
  expect(created).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
}

test('map layer controls use signed z coordinates and preserve the planar camera', async ({ page }) => {
  await startRun(page);
  const before = await page.evaluate(() => window.helixHeresyDebug.mapViewSnapshot());
  expect(before.viewport.z).toBe(0);
  expect(before.layerHeightM).toBe(4);

  await page.keyboard.press(']');
  await expect(page.locator('[data-map-layer-readout="true"]')).toHaveText('Z 1');
  await expect(page.locator('[data-map-viewport="true"]')).toHaveAttribute('data-map-viewport-z', '1');
  const above = await page.evaluate(() => window.helixHeresyDebug.mapViewSnapshot());
  expect(above.viewport).toMatchObject({ x: before.viewport.x, y: before.viewport.y, z: 1 });
  expect(above.cursor.z).toBe(1);

  await page.keyboard.press('[');
  await expect(page.locator('[data-map-layer-readout="true"]')).toHaveText('Z 0');
});

test('queued stair excavation creates a vertical route with 4 m travel cost', async ({ page }) => {
  await startRun(page);
  const upper = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell);
  const lower = { ...upper, z: upper.z - 1 };

  await finishVerticalOrder(page, 'stairDown', upper);

  const result = await page.evaluate(({ upper, lower }) => ({
    vertical: window.helixHeresyDebug.verticalMapSnapshot(),
    route: window.helixHeresyDebug.navigationPlan(upper, lower),
    compartmentIds: window.helixHeresyDebug.mapViewSnapshot().compartments.map((entry) => entry.id),
  }), { upper, lower });
  expect(result.vertical.connectors).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'carvedStairs', lowerCell: lower, upperCell: upper }),
  ]));
  expect(result.vertical.excavated).toEqual(expect.arrayContaining([lower]));
  expect(result.route.found).toBe(true);
  expect(result.route.path).toEqual([upper, lower]);
  expect(result.route.cost).toBe(4);
  expect(result.compartmentIds.some((id) => id.endsWith('-0'))).toBe(true);
  expect(result.compartmentIds.some((id) => id.endsWith('--1'))).toBe(true);
  expect(new Set(result.compartmentIds).size).toBe(result.compartmentIds.length);

  await page.evaluate(({ z }) => window.helixHeresyDebug.setMapLayer(z), { z: lower.z });
  await expect(page.locator(`[data-map-x="${lower.x}"][data-map-y="${lower.y}"][data-map-z="${lower.z}"]`)).toHaveClass(/vertical-up-cell/);
});

test('channeling removes support and vertically mixes exact airborne substances', async ({ page }) => {
  await startRun(page);
  const scientist = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell);
  const upper = { ...scientist };
  const lower = { ...upper, z: upper.z - 1 };

  await finishVerticalOrder(page, 'channelDown', upper);

  const topology = await page.evaluate(({ upper, lower }) => ({
    vertical: window.helixHeresyDebug.verticalMapSnapshot(),
    route: window.helixHeresyDebug.navigationPlan(upper, lower),
  }), { upper, lower });
  expect(topology.vertical.excavated).toEqual(expect.arrayContaining([lower]));
  expect(topology.vertical.connectors).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ lowerCell: lower, upperCell: upper }),
  ]));
  expect(topology.route.found).toBe(false);

  const fall = await page.evaluate(({ upper }) => window.helixHeresyDebug.testScientistGravityAt(upper), { upper });
  expect(fall.moved).toBeGreaterThan(0);
  expect(fall.cell).toEqual(lower);
  expect(fall.health).toBeLessThan(fall.beforeHealth);

  const diffusion = await page.evaluate(({ upper, lower }) => {
    window.helixHeresyDebug.setTileEnvironment(upper, { airborne: { 'vertical-test-vapor': 60 } });
    window.helixHeresyDebug.setTileEnvironment(lower, { airborne: {} });
    window.helixHeresyDebug.advanceSimulation(3600);
    return window.helixHeresyDebug.tileEnvironmentSnapshot(lower)[0];
  }, { upper, lower });
  expect(diffusion.airborne['vertical-test-vapor']).toBeGreaterThan(0);
});
