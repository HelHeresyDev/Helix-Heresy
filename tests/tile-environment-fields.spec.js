// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

async function resetEnvironmentalFixture(page, mutation = '') {
  await page.evaluate(({ key, mutation }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.slimes = [];
    state.corpses = [];
    state.tasks = [];
    for (const room of state.rooms || []) {
      room.attributes.temperature.current = 20;
      room.attributes.temperature.baseline = 20;
      room.attributes.humidity.current = 50;
      room.attributes.humidity.baseline = 50;
      room.attributes.ambientMana.current = 50;
      room.attributes.ambientMana.baseline = 50;
      room.attributes.contamination.current = 0;
      room.attributes.contamination.baseline = 0;
    }
    state.tileEnvironments = {};
    if (mutation === 'rockPair') {
      state.labMap.terrain.excavated.push({ x: 8, y: 8 }, { x: 10, y: 8 });
    }
    if (mutation === 'containerExchange') {
      const open = state.containers.find((container) => container.id === 'basic-7');
      const sealed = state.containers.find((container) => container.id === 'basic-2');
      open.environment.airborne = {};
      open.environment.contamination.current = 0;
      sealed.environment.airborne = {};
      sealed.environment.contamination.current = 0;
      sealed.wardIds = ['sealTightening', 'poisonSealing'];
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, mutation });
  await loadSavedRun(page);
}

test('typed airborne substances diffuse without losing identity or total load', async ({ page }) => {
  await startRun(page);
  await resetEnvironmentalFixture(page);
  const cells = await page.evaluate(() => {
    const records = window.helixHeresyDebug.tileEnvironmentSnapshot();
    const keys = new Set(records.map((record) => `${record.cell.x},${record.cell.y}`));
    const left = records.find((record) => keys.has(`${record.cell.x + 1},${record.cell.y}`));
    return [left.cell, { x: left.cell.x + 1, y: left.cell.y }];
  });

  await page.evaluate(({ source }) => {
    window.helixHeresyDebug.setTileEnvironment(source, {
      airborne: { 'acid-vapor': 40, 'smoke-vapor': 20 },
      rockTemperatureC: 20,
      rockManaDensity: 50,
    });
    window.helixHeresyDebug.advanceSimulation(1800);
  }, { source: cells[0] });

  const result = await page.evaluate(({ neighbor }) => {
    const atNeighbor = window.helixHeresyDebug.tileEnvironmentSnapshot(neighbor)[0];
    const totals = window.helixHeresyDebug.airborneMassSnapshot();
    return { atNeighbor, totals };
  }, { neighbor: cells[1] });
  expect(result.atNeighbor.airborne['acid-vapor']).toBeGreaterThan(0);
  expect(result.atNeighbor.airborne['smoke-vapor']).toBeGreaterThan(0);
  expect(result.totals['acid-vapor']).toBeCloseTo(120, 4);
  expect(result.totals['smoke-vapor']).toBeCloseTo(60, 4);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(86400));
  const laterTotals = await page.evaluate(() => window.helixHeresyDebug.airborneMassSnapshot());
  expect(laterTotals['acid-vapor']).toBeCloseTo(120, 3);
  expect(laterTotals['smoke-vapor']).toBeCloseTo(60, 3);
});

test('natural rock conducts temperature and mana but blocks humidity and airborne matter', async ({ page }) => {
  await startRun(page);
  await resetEnvironmentalFixture(page, 'rockPair');
  await page.evaluate(() => {
    window.helixHeresyDebug.setTileEnvironment({ x: 8, y: 8 }, {
      temperatureC: 80, rockTemperatureC: 80, humidity: 90, manaDensity: 100, rockManaDensity: 100,
      airborne: { 'acid-vapor': 40 },
    });
    window.helixHeresyDebug.setTileEnvironment({ x: 10, y: 8 }, {
      temperatureC: 10, rockTemperatureC: 10, humidity: 10, manaDensity: 0, rockManaDensity: 0,
      airborne: {},
    });
    window.helixHeresyDebug.advanceSimulation(3600);
  });
  const right = await page.evaluate(() => window.helixHeresyDebug.tileEnvironmentSnapshot({ x: 10, y: 8 })[0]);
  expect(right.temperatureC).toBeGreaterThan(10);
  expect(right.manaDensity).toBeGreaterThan(0);
  expect(right.humidity).toBeCloseTo(10, 5);
  expect(right.airborne['acid-vapor'] || 0).toBe(0);
});

test('open porous containers exchange local air faster than sealed containers', async ({ page }) => {
  await startRun(page);
  await resetEnvironmentalFixture(page, 'containerExchange');
  const fixture = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      open: state.containers.find((container) => container.id === 'basic-7').mapCell,
      sealed: state.containers.find((container) => container.id === 'basic-2').mapCell,
    };
  }, { key: storageKey });
  await page.evaluate(({ fixture }) => {
    window.helixHeresyDebug.setTileEnvironment(fixture.open, { airborne: { 'test-fume': 50 } });
    window.helixHeresyDebug.setTileEnvironment(fixture.sealed, { airborne: { 'test-fume': 50 } });
    window.helixHeresyDebug.advanceSimulation(3600);
  }, { fixture });
  const result = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return {
      open: state.containers.find((container) => container.id === 'basic-7').environment.airborne['test-fume'] || 0,
      sealed: state.containers.find((container) => container.id === 'basic-2').environment.airborne['test-fume'] || 0,
    };
  }, { key: storageKey });
  expect(result.open).toBeGreaterThan(result.sealed * 3);
});

test('environment overlays expose physical units without revealing unobserved tiles', async ({ page }) => {
  await startRun(page);
  const cell = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.scientist.mapCell;
  }, { key: storageKey });
  await page.evaluate(({ cell }) => window.helixHeresyDebug.setTileEnvironment(cell, {
    temperatureC: 31.5,
    humidity: 72,
    manaDensity: 88,
    airborne: { 'smoke-vapor': 12 },
  }), { cell });

  await page.locator('[data-overlay-menu-toggle="true"]').click();
  await page.locator('[data-map-overlay-select="true"]').selectOption('temperature');
  const tile = page.locator(`[data-map-x="${cell.x}"][data-map-y="${cell.y}"]`);
  await expect(tile).toHaveAttribute('data-map-overlay', 'temperature');
  await expect(tile).toHaveAttribute('title', /Temperature: .*°C/);

  await page.locator('[data-overlay-menu-toggle="true"]').click();
  await page.locator('[data-map-overlay-select="true"]').selectOption('debug');
  await expect(tile).toHaveAttribute('title', /smoke vapor 12\.00/);
});
