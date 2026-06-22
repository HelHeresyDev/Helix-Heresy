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

test.describe('Inventory Pass 3 starter stock', () => {
  test('source defines starter stock for cataloged tools without action gates', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    for (const key of ['thickGloves', 'longTongs', 'hookPole', 'scraper']) {
      expect(source).toContain(`key: "${key}"`);
    }
    expect(source).toContain('Starter stock is cataloged in the Storage Room');
    expect(source).toContain('Starter tools are cataloged only');
    expect(source).toContain('function defaultInventory');

    expect(source).not.toContain('requireInventoryTool');
    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('disableHandlingMethodForInventory');
    expect(source).not.toContain('storageCapacity');
    expect(source).not.toContain('inventoryRecipes');
    expect(source).not.toContain('craftInventoryItem');
  });

  test('new runs start with basic tool stock while materials remain zero', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 2);
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

    await expect(page.locator('#inventorySummary')).toContainText('Storage Room ledger');
    await expect(page.locator('#inventorySummary')).toHaveAttribute('title', /Starter tools are cataloged only/i);

    const inventory = page.locator('#inventoryList');
    for (const key of ['biomass', 'traceSlime', 'contaminatedResidue', 'ruinedOrganicMatter', 'preservedTissue']) {
      await expect(inventory.locator(`[data-inventory-item-key="${key}"] strong`)).toHaveText('0');
    }
    for (const key of ['thickGloves', 'longTongs', 'hookPole', 'scraper']) {
      const row = inventory.locator(`[data-inventory-item-key="${key}"]`);
      await expect(row.locator('strong')).toHaveText('1');
      await expect(row).toHaveAttribute('title', /Starter stock|not gated by inventory|not enforced/i);
    }

    await visualPause(page, inventory, 'Inventory starter stock');

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    await cheatInput.fill('gloves 1');
    await cheatBtn.click();
    await expect(inventory.locator('[data-inventory-item-key="thickGloves"] strong')).toHaveText('2');
    await expect(page.locator('#inventoryCommandStatus')).toContainText('Added 1 Thick gloves');

    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.cheat-panel'), 'Starter stock plus cheat add');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
