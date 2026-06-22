// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) return;
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

test.describe('Storage Room Pass 1 room foundation', () => {
  test('source defines Storage Room connected only to Main Lab with closed default door', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const STORAGE_ROOM_ID = "storageRoom";');
    expect(source).toContain('connections: [MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID]');
    expect(source).toContain('id: STORAGE_ROOM_ID');
    expect(source).toContain('name: "Storage Room"');
    expect(source).toContain('articleName: "the Storage Room"');
    expect(source).toContain('role: "materialStorage"');
    expect(source).toContain('roleLabel: "Materials storage"');
    expect(source).toContain('description: "A controlled supply room');
    expect(source).toContain('connections: [MAIN_ROOM_ID]');
    expect(source).toContain('ids.has(STORAGE_ROOM_ID)');
    expect(source).toContain('startsClosed ? DOOR_STATE_CLOSED : DOOR_STATE_OPEN');
    expect(source).toContain('[MAIN_ROOM_ID, MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID]');

    expect(source).not.toContain('inventory:');
    expect(source).not.toContain('crafting');
    expect(source).not.toContain('storageCapacity');
  });

  test('UI shows Storage Room, closed Main Lab door, and normal movement access', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 3);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await startRun(page);

    await expect(page.locator('#roomSummary')).toContainText('5 rooms active');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Main Lab');

    const roomList = page.locator('#roomList');
    await expect(roomList).toContainText('Storage Room');
    await expect(roomList).toContainText('Materials storage');
    await expect(roomList).toContainText('controlled supply room');
    await expect(roomList).toContainText('Storage Room door: Closed');

    await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeVisible();
    await expect(page.locator('[data-scientist-move-room-id="storageRoom"]')).toBeEnabled();

    await visualPause(page, page.locator('#roomList'), 'Storage Room appears in room list with closed door');

    await page.locator('[data-scientist-move-room-id="storageRoom"]').click();
    await page.keyboard.press('Shift+Period');

    await expect(page.locator('#roomSummary')).toContainText('Current location: Storage Room');
    await expect(roomList).toContainText('Main Lab door: Closed');

    await visualPause(page, page.locator('#roomList'), 'Scientist moved to Storage Room');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
