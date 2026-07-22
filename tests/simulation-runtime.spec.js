// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Simulation = require('../simulation-runtime.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('cadence scheduling is stable and preserves accumulated elapsed time', () => {
  const definitions = [
    { id: 'sensory', interval: 1, priority: 20 },
    { id: 'tactical', interval: 0.25, priority: 10 },
    { id: 'biology', interval: 30, priority: 30 },
  ];
  let state = Simulation.normalizeCadenceState(definitions, {}, 0);

  let result = Simulation.collectDueCadences(definitions, state, 0, 0.1);
  expect(result.due).toEqual([]);
  state = result.state;

  result = Simulation.collectDueCadences(definitions, state, 0.1, 0.25);
  expect(result.due.map((entry) => entry.id)).toEqual(['tactical']);
  expect(result.due[0].elapsed).toBeCloseTo(0.25, 6);
  state = result.state;

  result = Simulation.collectDueCadences(definitions, state, 0.25, 30);
  expect(result.due.map((entry) => entry.id)).toEqual(['tactical', 'sensory', 'biology']);
  expect(result.due.find((entry) => entry.id === 'biology')?.elapsed).toBeCloseTo(30, 6);
  expect(result.due.find((entry) => entry.id === 'sensory')?.elapsed).toBeCloseTo(30, 6);
});

test('incremental and bulk cadence advancement integrate the same elapsed time', () => {
  const definitions = [
    { id: 'fast', interval: 1, priority: 10 },
    { id: 'slow', interval: 10, priority: 20 },
  ];
  const run = (steps) => {
    let clock = 0;
    let state = Simulation.normalizeCadenceState(definitions, {}, 0);
    const totals = { fast: 0, slow: 0 };
    for (const seconds of steps) {
      const next = clock + seconds;
      const result = Simulation.collectDueCadences(definitions, state, clock, next);
      state = result.state;
      for (const entry of result.due) totals[entry.id] += entry.elapsed;
      clock = next;
    }
    return totals;
  };

  expect(run(Array.from({ length: 30 }, () => 1))).toEqual(run([30]));
  expect(run([30])).toEqual({ fast: 30, slow: 30 });
});

test('same-time events resolve by priority entity and stable id', () => {
  const queue = Simulation.createEventQueue([
    { id: 'z', dueAt: 10, priority: 2, entityId: 'slime-2' },
    { id: 'b', dueAt: 10, priority: 1, entityId: 'slime-2' },
    { id: 'a', dueAt: 10, priority: 1, entityId: 'slime-1' },
    { id: 'early', dueAt: 5, priority: 99, entityId: 'slime-9' },
  ]);

  expect(queue.takeDue(10).map((entry) => entry.id)).toEqual(['early', 'a', 'b', 'z']);
  expect(queue.size).toBe(0);
});

test('spatial index bounds local queries with one thousand actors', () => {
  const actors = Array.from({ length: 1000 }, (_entry, index) => ({
    id: `actor-${index}`,
    cell: { x: index % 100, y: Math.floor(index / 100), z: index % 2 },
    roomId: `room-${index % 10}`,
    containerId: index % 5 === 0 ? `container-${index % 20}` : '',
  }));
  const index = Simulation.createSpatialIndex();
  index.rebuild(actors);

  expect(index.snapshot()).toMatchObject({ records: 1000, occupiedCells: 1000, rooms: 10 });
  expect(index.recordsAtCell({ x: 0, y: 0, z: 0 }).map((actor) => actor.id)).toEqual(['actor-0']);
  expect(index.recordsInRoom('room-3')).toHaveLength(100);
  expect(index.recordsInRadius({ x: 50, y: 5, z: 0 }, 2)).toHaveLength(15);
});

test('debug performance view exposes cadences spatial counts and ten-minute autosave', async ({ page }) => {
  await startRun(page);
  const snapshot = await page.evaluate(() => {
    window.helixHeresyDebug.resetSimulationPerformance();
    window.helixHeresyDebug.advanceSimulation(30);
    return window.helixHeresyDebug.simulationPerformanceSnapshot();
  });

  expect(snapshot.autosave.intervalMs).toBe(600000);
  expect(snapshot.actors).toBeGreaterThanOrEqual(1);
  expect(snapshot.spatialIndex.records).toBe(snapshot.actors);
  expect(snapshot.systems.tactical.calls).toBe(1);
  expect(snapshot.systems.sensory.calls).toBe(1);
  expect(snapshot.systems.biology.calls).toBe(1);

  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('[data-debug-menu-tab="performance"]').click();
  await expect(page.locator('#simulationPerformanceSummary')).toContainText('living slime');
  await expect(page.locator('#simulationPerformanceReadout')).toContainText('Simulation advance');
});
