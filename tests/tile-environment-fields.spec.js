// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { createHash } = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const { activeRunStorageKey } = require('./helpers/active-run-storage');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');

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
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: await activeRunStorageKey(page), mutation });
  await loadSavedRun(page);
}

test('typed airborne substances diffuse without losing identity before exterior dispersal', async ({ page }) => {
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
  expect(result.totals['acid-vapor']).toBeGreaterThan(150);
  expect(result.totals['acid-vapor']).toBeLessThanOrEqual(160);
  expect(result.totals['smoke-vapor']).toBeGreaterThan(75);
  expect(result.totals['smoke-vapor']).toBeLessThanOrEqual(80);
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

test('environment uses the current geometry after excavation opens a solid barrier and a door is breached', async ({ page }) => {
  test.setTimeout(120000);
  await startLifecycleRun(page, 'diffusion-floor-geometry');
  const { solid, opened, breached } = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const left = { x: 8, y: 8, z: 0 }, middle = { x: 9, y: 8, z: 0 }, right = { x: 10, y: 8, z: 0 };
    const read = () => {
      const tiles = d.tileEnvironmentSnapshot();
      const { rooms, compartmentEnvironments } = d.exportSurveyExpeditionTestState();
      return {
        target: d.tileEnvironmentSnapshot(right)[0], tiles, compartmentEnvironments,
        rooms: rooms.map(({ id, attributes }) => ({ id, attributes }))
      };
    };
    d.setExcavatedCells([left, right]);
    d.setTileEnvironment(left, { temperatureC: 80, rockTemperatureC: 80, humidity: 90, manaDensity: 100, rockManaDensity: 100,
      airborne: { 'acid-vapor': 40, 'smoke-vapor': 20 }, chemicalTraces: { 'slime-distress': 10 } });
    d.setTileEnvironment(right, { temperatureC: 10, rockTemperatureC: 10, humidity: 10, manaDensity: 0, rockManaDensity: 0,
      airborne: {}, chemicalTraces: {} });
    d.advanceTestRunTime(60);
    d.advanceTestRunTime(60);
    const solid = read();
    // Use the same active run and topology mutation path; do not reload or
    // clear a cache in between. A path through the newly open tile now exists.
    d.setExcavatedCells([middle]);
    d.advanceTestRunTime(60);
    d.advanceTestRunTime(60);
    const opened = read();
    const intact = d.mapViewSnapshot().compartments.find(entry =>
      entry.status === 'enclosed' && entry.portals.some(portal => portal.kind === 'door'));
    const door = intact.portals.find(portal => portal.kind === 'door');
    const damaged = d.damageStructure(door.cell, 10000);
    d.advanceTestRunTime(60);
    const status = d.mapViewSnapshot().compartments.find(entry => entry.id === intact.id).status;
    return { solid, opened, breached: { ...read(), damaged, status } };
  });
  expect(solid.target.temperatureC).toBeGreaterThan(10);
  expect(solid.target.manaDensity).toBeGreaterThan(0);
  expect(solid.target.humidity).toBeCloseTo(10, 8);
  expect(solid.target.airborne).toEqual({});
  expect(opened.tiles).toHaveLength(solid.tiles.length + 1);
  expect(opened.target.humidity).toBeGreaterThan(solid.target.humidity);
  expect(opened.target.airborne['acid-vapor']).toBeGreaterThan(0);
  expect(opened.target.airborne['smoke-vapor']).toBeGreaterThan(0);
  expect(Object.values(solid.compartmentEnvironments).some(({ cells }) => cells.some(cell => cell.x === 9 && cell.y === 8 && cell.z === 0))).toBe(false);
  expect(Object.values(opened.compartmentEnvironments).some(({ cells }) => cells.some(cell => cell.x === 9 && cell.y === 8 && cell.z === 0))).toBe(true);
  expect(breached.damaged).toBe(true);
  expect(breached.status).toBe('compromised');
  const digest = ({ tiles, rooms, compartmentEnvironments }) =>
    createHash('sha256').update(JSON.stringify({ tiles, rooms, compartmentEnvironments })).digest('hex');
  console.log(`Environment hashes (solid rock, excavated, breached door): ${[solid, opened, breached].map(digest).join(', ')}`);
});

test('open porous containers exchange local air faster than sealed containers', async ({ page }) => {
  test.setTimeout(120000);
  await startLifecycleRun(page, 'porous-container-exchange');
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const initial = d.exportSurveyExpeditionTestState();
    const open = initial.containers.find(container => container.id === 'basic-7');
    const sealed = initial.containers.find(container => container.id === 'basic-2');
    for (const container of [open, sealed]) {
      container.environment.airborne = {};
      container.environment.contamination.current = 0;
    }
    sealed.wardIds = ['sealTightening', 'poisonSealing'];
    d.importSurveyExpeditionTestState(initial);
    for (const container of [open, sealed]) {
      d.setTileEnvironment(container.mapCell, { airborne: { 'test-fume': 50 } });
    }
    d.advanceTestRunTime(60);
    const { containers } = d.exportSurveyExpeditionTestState();
    return {
      open: containers.find(container => container.id === open.id).environment.airborne['test-fume'] || 0,
      sealed: containers.find(container => container.id === sealed.id).environment.airborne['test-fume'] || 0,
    };
  });
  expect(result.open).toBeGreaterThan(result.sealed * 3);
});

test('environment overlays expose physical units without revealing unobserved tiles', async ({ page }) => {
  await startRun(page);
  const cell = await page.evaluate(({ key }) => {
    const state = JSON.parse(window.localStorage.getItem(key) || '{}').state;
    return state.scientist.mapCell;
  }, { key: await activeRunStorageKey(page) });
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
