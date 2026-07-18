// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  NavigationService,
  ReservationTable,
  findPath,
  footprintCells,
} = require('../navigation.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test('weighted A star chooses a longer but cheaper route', () => {
  const expensive = new Set(['1,1', '2,1', '3,1']);
  const result = findPath({
    width: 5,
    height: 3,
    start: { x: 0, y: 1 },
    goal: { x: 4, y: 1 },
    canOccupy: () => true,
    stepCost: (_from, to) => expensive.has(`${to.cell.x},${to.cell.y}`) ? 8 : 1,
  });

  expect(result.found).toBe(true);
  expect(result.path).not.toEqual(expect.arrayContaining([{ x: 2, y: 1 }]));
  expect(result.cost).toBeLessThan(10);
});

test('oriented multi-tile bodies rotate only where their full footprint fits', () => {
  const open = new Set([
    '0,0', '0,1',
    '1,0', '1,1',
    '2,0', '2,1',
    '3,0', '3,1',
    '4,0', '4,1',
    '4,2',
  ]);
  const result = findPath({
    width: 5,
    height: 3,
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 1 },
    footprint: { width: 2, height: 1, orientation: 'horizontal', rotatable: true, exclusive: true },
    canOccupy: (anchor, orientation) => footprintCells(anchor, {
      width: 2,
      height: 1,
      orientation: 'horizontal',
      rotatable: true,
    }, orientation).every((cell) => open.has(`${cell.x},${cell.y}`)),
  });

  expect(result.found).toBe(true);
  expect(result.steps.some((step) => step.action === 'rotate')).toBe(true);
  expect(result.steps.at(-1)?.orientation).toBe('vertical');
});

test('reservations permit small actors to share capacity and block oversized overlap', () => {
  const table = new ReservationTable({ capacity: 1 });
  const cell = [{ x: 2, y: 2 }];
  expect(table.tryReserve({ actorId: 'small-a', cells: cell, startAt: 0, endAt: 5, loadM2: 0.3, priority: 10 }).ok).toBe(true);
  expect(table.tryReserve({ actorId: 'small-b', cells: cell, startAt: 1, endAt: 4, loadM2: 0.4, priority: 10 }).ok).toBe(true);
  expect(table.tryReserve({ actorId: 'large', cells: cell, startAt: 1, endAt: 4, loadM2: 0.8, priority: 10 }).ok).toBe(false);
  expect(table.snapshot().map((entry) => entry.actorId)).toEqual(['small-a', 'small-b']);
});

test('higher priority movement can preempt a lower priority reservation deterministically', () => {
  const table = new ReservationTable({ capacity: 1 });
  const cell = [{ x: 3, y: 3 }];
  table.tryReserve({ actorId: 'wanderer', cells: cell, startAt: 0, endAt: 5, loadM2: 1, priority: 10 });
  const urgent = table.tryReserve({
    actorId: 'fleeing-slime', cells: cell, startAt: 0, endAt: 5,
    loadM2: 1, priority: 100, preempt: true,
  });

  expect(urgent).toMatchObject({ ok: true, preempted: true });
  expect(table.snapshot()).toEqual([expect.objectContaining({ actorId: 'fleeing-slime' })]);
});

test('navigation service reuses only validated cached routes', () => {
  const service = new NavigationService({ cacheLimit: 4 });
  let valid = true;
  const request = {
    width: 4,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 0 },
    canOccupy: () => true,
    validatePath: () => valid,
  };
  expect(service.findPath(request, 'route').cached).toBe(false);
  expect(service.findPath(request, 'route').cached).toBe(true);
  valid = false;
  expect(service.findPath(request, 'route').cached).toBe(false);
  expect(service.snapshot()).toMatchObject({ searches: 2, cacheHits: 1, cacheSize: 1 });
});

test('large-grid planning exposes bounded search diagnostics', () => {
  const service = new NavigationService({ cacheLimit: 64 });
  const startedAt = Date.now();
  for (let index = 0; index < 120; index += 1) {
    const row = index % 100;
    const result = service.findPath({
      width: 100,
      height: 100,
      start: { x: 0, y: row },
      goal: { x: 99, y: 99 - row },
      canOccupy: () => true,
    }, `open-${index}`);
    expect(result.found).toBe(true);
  }
  const stats = service.snapshot();
  expect(stats).toMatchObject({ searches: 120, failures: 0, cacheSize: 64 });
  expect(stats.visited).toBeLessThan(1_200_000);
  expect(Date.now() - startedAt).toBeLessThan(5000);
});

test('scientist movement occupies intermediate tiles before arrival', async ({ page }) => {
  await startRun(page);
  const started = await page.evaluate(() => {
    const before = window.helixHeresyDebug.navigationSnapshot().actors.find((actor) => actor.id === 'scientist').cell;
    const task = window.helixHeresyDebug.startScientistMove('menagerie', { accessOverride: true });
    return { before, task };
  });
  expect(started.task).toBeTruthy();
  expect(started.task.data.movement.steps.length).toBeGreaterThan(2);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  const intermediate = await page.evaluate(() => {
    const snapshot = window.helixHeresyDebug.navigationSnapshot();
    const task = window.helixHeresyDebug.taskStatusSnapshot().find((entry) => entry.type === 'scientistMove');
    return {
      cell: snapshot.actors.find((actor) => actor.id === 'scientist').cell,
      movement: task?.data?.movement,
      reservations: snapshot.reservations,
    };
  });
  expect(intermediate.cell).not.toEqual(started.before);
  expect(intermediate.movement.stepIndex).toBeGreaterThan(0);
  expect(intermediate.movement.completed).toBe(false);
  expect(intermediate.reservations).toEqual(expect.arrayContaining([
    expect.objectContaining({ actorId: 'scientist' }),
  ]));

  for (let index = 0; index < 40; index += 1) {
    const active = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot().some((entry) => entry.type === 'scientistMove'));
    if (!active) break;
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
  }
  const completed = await page.evaluate(() => window.helixHeresyDebug.navigationSnapshot());
  expect(completed.actors.find((actor) => actor.id === 'scientist').cell).toEqual(
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
  );
  expect(completed.reservations.some((entry) => entry.actorId === 'scientist')).toBe(false);
  expect(completed.actors.find((actor) => actor.id === 'scientist').roomId).toBe('menagerie');
});

test('door revision invalidates cached open-door routes', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    window.helixHeresyDebug.setDoorPhysicalState('door-menagerie-main', 'closed');
    const beforeSnapshot = window.helixHeresyDebug.navigationSnapshot();
    window.helixHeresyDebug.setDoorPhysicalState('door-menagerie-main', 'open');
    const openedSnapshot = window.helixHeresyDebug.navigationSnapshot();
    const from = openedSnapshot.actors.find((actor) => actor.id === 'scientist').cell;
    const to = { x: 45, y: 50 };
    const openPlan = window.helixHeresyDebug.navigationPlan(from, to, 'scientist', { ignoreAccessPolicy: true });
    window.helixHeresyDebug.setDoorPhysicalState('door-menagerie-main', 'closed');
    const closedSnapshot = window.helixHeresyDebug.navigationSnapshot();
    const closedPlan = window.helixHeresyDebug.navigationPlan(from, to, 'scientist', { ignoreAccessPolicy: true });
    return { beforeSnapshot, openedSnapshot, closedSnapshot, openPlan, closedPlan };
  });

  expect(result.openPlan.found).toBe(true);
  expect(result.closedPlan.found).toBe(false);
  expect(result.openedSnapshot.revisions.doorRevision).toBeGreaterThan(result.beforeSnapshot.revisions.doorRevision);
  expect(result.closedSnapshot.revisions.doorRevision).toBeGreaterThan(result.openedSnapshot.revisions.doorRevision);
});
