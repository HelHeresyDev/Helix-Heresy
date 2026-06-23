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

test.describe('Collection Bay Pass 1 room foundation', () => {
  test('source defines Collection Bay as a closed Main Lab side room without collection mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const COLLECTION_BAY_ROOM_ID = "collectionBay";');
    expect(source).toContain('connections: [MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID, COLLECTION_BAY_ROOM_ID]');
    expect(source).toContain('id: COLLECTION_BAY_ROOM_ID');
    expect(source).toContain('name: "Collection Bay"');
    expect(source).toContain('articleName: "the Collection Bay"');
    expect(source).toContain('role: "byproductCollection"');
    expect(source).toContain('roleLabel: "Byproduct collection"');
    expect(source).toContain('description: "Sealed troughs, drain channels, condensers, and stained collection plates');
    expect(source).toContain('ids.has(COLLECTION_BAY_ROOM_ID)');
    expect(source).toContain('[MAIN_ROOM_ID, MENAGERIE_ROOM_ID, PITS_ROOM_ID, BEDROOM_ROOM_ID, STORAGE_ROOM_ID, COLLECTION_BAY_ROOM_ID]');

    const forbidden = [
      'byproductCollectionRate',
      'collectByproduct',
      'harvestByproduct',
      'byproductInventoryOutput',
      'currentOutputSimulation',
      'feedingResidue',
      'harvestableMaterial',
      'acidDamage',
      'toolCorrosion',
      'storageCapacity',
      'inventoryRecipes',
      'craftInventoryItem'
    ];
    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  test('UI shows Collection Bay, closed Main Lab door, and normal movement access', async ({ page }) => {
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

    await expect(page.locator('#roomSummary')).toContainText('6 rooms active');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Main Lab');

    const roomList = page.locator('#roomList');
    await expect(roomList).toContainText('Collection Bay');
    await expect(roomList).toContainText('Byproduct collection');
    await expect(roomList).toContainText('Sealed troughs, drain channels, condensers, and stained collection plates');
    await expect(roomList).toContainText('Collection Bay door: Closed');

    const moveButton = page.locator('[data-scientist-move-room-id="collectionBay"]');
    await expect(moveButton).toBeVisible();
    await expect(moveButton).toBeEnabled();

    await visualPause(page, roomList, 'Collection Bay appears in room list with closed door');

    await moveButton.click();
    await page.keyboard.press('Shift+Period');

    await expect(page.locator('#roomSummary')).toContainText('Current location: Collection Bay');
    await expect(roomList).toContainText('Main Lab door: Closed');

    await visualPause(page, roomList, 'Scientist moved to Collection Bay');

    await expect(page.locator('body')).not.toContainText('Collect byproduct');
    await expect(page.locator('body')).not.toContainText('Harvest byproduct');
    await expect(page.locator('body')).not.toContainText('Byproduct output stored');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
