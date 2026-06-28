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
    return {
      map: state.labMap,
      scientist: state.scientist
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
