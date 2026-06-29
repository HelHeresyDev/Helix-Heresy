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

test('lab blueprint stores room footprints and queues scientist movement with map paths', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);

  await expect(page.locator('[data-lab-map-panel="true"]')).toBeVisible();
  await expect(page.locator('#clockReadout')).toContainText('Day 1 00:00:00');
  await expect(page.locator('#roomSummary')).toContainText('Blueprint: 40 x 25 m; 6 mapped rooms');
  await expect(page.locator('.lab-map-cell.object-cell').first()).toBeVisible();

  const initial = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return {
      map: state.labMap,
      scientist: state.scientist,
      containers: state.containers,
      containerCellsValid: (state.containers || []).every((container) =>
        container.mapCell
        && (state.labMap.rooms[container.roomId]?.cells || []).some((cell) => cell.x === container.mapCell.x && cell.y === container.mapCell.y)
        && !doorCells.has(`${container.mapCell.x},${container.mapCell.y}`)
      )
    };
  }, { key: storageKey });

  expect(initial.map.tileSizeM).toBe(1);
  expect(initial.map.rooms.mainLab).toMatchObject({ x: 16, y: 10, width: 12, height: 10 });
  expect(initial.map.rooms.storageRoom).toMatchObject({ x: 18, y: 5, width: 7, height: 5 });
  expect(initial.map.rooms.pits.cells.length).toBeLessThan(initial.map.rooms.pits.width * initial.map.rooms.pits.height);
  expect(initial.map.doors['mainLab::storageRoom']).toMatchObject({
    from: { x: 21, y: 9 },
    to: { x: 21, y: 10 }
  });
  expect(initial.scientist.roomId).toBe('mainLab');
  expect(initial.scientist.mapCell).toEqual(initial.map.rooms.mainLab.anchor);
  expect(initial.scientist.physicalPresence.moveSpeedMps).toBeGreaterThan(0);
  expect(initial.containerCellsValid).toBe(true);
  expect(initial.containers.find((container) => container.id === 'basic-11').mapCell).toBeTruthy();
  expect(await page.locator('.lab-map-cell.blocking-object-cell').count()).toBeGreaterThan(initial.containers.length);

  await page.locator('[data-scientist-move-room-id="storageRoom"]').click();

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'scientistMove');
    return { task, storageAnchor: state.labMap.rooms.storageRoom.anchor };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromRoomId).toBe('mainLab');
  expect(queued.task.data.toRoomId).toBe('storageRoom');
  expect(queued.task.data.mapPath.length).toBeGreaterThan(1);
  expect(queued.task.data.toCell).toEqual(queued.storageAnchor);
  expect(queued.task.data.doorTransit.some((step) => step.fromRoomId === 'mainLab' && step.toRoomId === 'storageRoom')).toBe(true);
  expect(queued.task.dueAt - queued.task.createdAt).toBeLessThan(60);
  await expect(page.locator('.lab-map-cell.queued-path-cell')).toHaveCount(queued.task.data.mapPath.length);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Move scientist to Storage Room' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      scientist: state.scientist,
      storageAnchor: state.labMap.rooms.storageRoom.anchor
    };
  }, { key: storageKey });

  expect(arrived.scientist.roomId).toBe('storageRoom');
  expect(arrived.scientist.mapCell).toEqual(arrived.storageAnchor);
  await expect(page.locator('.lab-map-cell.scientist-cell')).toHaveAttribute('data-map-room', 'storageRoom');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('container hauling reserves a footprint and routes to adjacent access cells', async ({ page }) => {
  await startRun(page);

  const before = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(before.container.mapCell).toBeTruthy();

  await page.locator('[data-container-room-select="basic-1"]').selectOption('collectionBay');

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'containerHaul');
    return { task };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromCell).toEqual(before.container.mapCell);
  expect(queued.task.data.mapPath[0]).toEqual(queued.task.data.fromAccessCell);
  expect(queued.task.data.mapPath.at(-1)).toEqual(queued.task.data.toAccessCell);
  expect(queued.task.data.toCell).not.toEqual(queued.task.data.toAccessCell);
  expect(Math.abs(queued.task.data.toCell.x - queued.task.data.toAccessCell.x)
    + Math.abs(queued.task.data.toCell.y - queued.task.data.toAccessCell.y)).toBe(1);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Haul Basic Glass Jar 1 to Collection Bay' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(arrived.container.roomId).toBe('collectionBay');
  expect(arrived.container.mapCell).toEqual(queued.task.data.toCell);
});

test('lab blueprint clicks focus existing room door and object panels', async ({ page }) => {
  await startRun(page);

  await page.locator('[data-map-target-kind="container"][data-map-target-id="basic-1"]').first().click();
  await expect(page.locator('[data-container-card="basic-1"]')).toHaveClass(/selected-map-target/);

  let selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected).toEqual({ kind: 'container', id: 'basic-1' });

  await page.locator('[data-map-door="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-door-connection="mainLab::storageRoom"]').first()).toHaveClass(/selected-map-target/);
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected.kind).toBe('door');
  expect(selected.key).toBe('mainLab::storageRoom');

  const bedroomCell = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const bedroom = state.labMap.rooms.bedroom;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return bedroom.cells.find((cell) => !doorCells.has(`${cell.x},${cell.y}`));
  }, { key: storageKey });

  await page.locator(`[data-map-x="${bedroomCell.x}"][data-map-y="${bedroomCell.y}"]`).click();
  await expect(page.locator('[data-room-card="bedroom"]')).toHaveClass(/selected-map-target/);
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selectedMapTarget;
  }, { key: storageKey });
  expect(selected).toEqual({ kind: 'room', roomId: 'bedroom' });
});

test('construction designations become unassigned rooms that can receive a purpose', async ({ page }) => {
  await startRun(page);

  await expect(page.locator('[data-construction-panel="true"]')).toBeVisible();
  await page.locator('[data-dig-x="true"]').fill('25');
  await page.locator('[data-dig-y="true"]').fill('6');
  await page.locator('[data-dig-width="true"]').fill('4');
  await page.locator('[data-dig-height="true"]').fill('4');
  await page.locator('[data-designate-dig="true"]').click();

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'excavate');
    return {
      task,
      map: state.labMap,
      construction: state.construction
    };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.rect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  expect(queued.task.data.cells).toHaveLength(16);
  expect(queued.map.width).toBeGreaterThanOrEqual(40);
  expect(queued.construction.lastDigRect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(16);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Excavate 4 x 4 chamber' }).getByRole('button', { name: 'Finish' }).click();

  const excavated = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.role === 'excavated');
    const doorKeys = room
      ? Object.keys(state.doors || {}).filter((keyName) => keyName.includes(room.id))
      : [];
    return {
      room,
      mapRoom: room ? state.labMap.rooms[room.id] : null,
      doorKeys,
      doors: state.doors
    };
  }, { key: storageKey });

  expect(excavated.room).toBeTruthy();
  expect(excavated.room.name).toBe('Unassigned Excavation 1');
  expect(excavated.room.connections).toEqual(expect.arrayContaining(['mainLab']));
  expect(excavated.mapRoom.cells).toHaveLength(16);
  expect(excavated.doorKeys.length).toBeGreaterThan(0);
  expect(excavated.doorKeys.some((keyName) => excavated.doors[keyName].state === 'open')).toBe(true);
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(0);
  await expect(page.locator(`[data-room-purpose-control="${excavated.room.id}"]`)).toBeVisible();

  await page.locator(`[data-room-purpose-select="${excavated.room.id}"]`).selectOption('storage');
  await page.locator(`[data-assign-room-purpose="${excavated.room.id}"]`).click();

  const assigned = await page.evaluate(({ key, roomId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.id === roomId);
    return { room };
  }, { key: storageKey, roomId: excavated.room.id });

  expect(assigned.room.role).toBe('materialStorage');
  expect(assigned.room.name).toBe('Storage Room 1');
  await expect(page.locator(`[data-room-purpose-control="${excavated.room.id}"]`)).toHaveCount(0);
});
