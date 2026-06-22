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

test.describe('Inventory Pass 2 tools and supplies catalog', () => {
  test('source defines inventory categories and current handling tools without action gates', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const INVENTORY_CATEGORY_DEFS = [');
    expect(source).toContain('label: "Materials"');
    expect(source).toContain('label: "Tools & Supplies"');
    expect(source).toContain('key: "thickGloves"');
    expect(source).toContain('key: "longTongs"');
    expect(source).toContain('key: "hookPole"');
    expect(source).toContain('key: "scraper"');
    expect(source).toContain('category: "tools"');
    expect(source).toContain('Tools and supplies are cataloged only');
    expect(source).toContain('gloves: "thickGloves"');
    expect(source).toContain('tongs: "longTongs"');
    expect(source).toContain('pole: "hookPole"');
    expect(source).toContain('scrapers: "scraper"');

    expect(source).not.toContain('requireInventoryTool');
    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('disableHandlingMethodForInventory');
    expect(source).not.toContain('storageCapacity');
    expect(source).not.toContain('inventoryRecipes');
    expect(source).not.toContain('craftInventoryItem');
  });

  test('UI groups materials and tools, and cheats can add each current tool', async ({ page }) => {
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

    const inventoryPanel = page.locator('.inventory-panel');
    await expect(page.locator('#inventorySummary')).toContainText('Storage Room ledger');
    await expect(page.locator('#inventorySummary')).toHaveAttribute('title', /Tools and supplies are cataloged only/i);

    await expect(page.locator('.inventory-section[data-inventory-category="materials"]')).toContainText('Materials');
    await expect(page.locator('.inventory-section[data-inventory-category="tools"]')).toContainText('Tools & Supplies');

    const inventory = page.locator('#inventoryList');
    for (const label of ['Biomass', 'Trace slime', 'Contaminated residue', 'Ruined organic matter', 'Preserved tissue']) {
      await expect(inventory).toContainText(label);
    }
    for (const [key, label] of [
      ['thickGloves', 'Thick gloves'],
      ['longTongs', 'Long tongs'],
      ['hookPole', 'Hook pole'],
      ['scraper', 'Scraper'],
    ]) {
      const row = inventory.locator(`[data-inventory-item-key="${key}"]`);
      await expect(row).toContainText(label);
      await expect(row.locator('strong')).toHaveText('0');
      await expect(row).toHaveAttribute('title', /Cataloged only|not gated by inventory|not enforced/i);
    }

    await visualPause(page, inventoryPanel, 'Inventory materials and tools catalog');

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    const commands = [
      ['gloves 1', 'thickGloves', '1'],
      ['tongs 2', 'longTongs', '2'],
      ['hook pole 3', 'hookPole', '3'],
      ['scrapers 4', 'scraper', '4'],
    ];

    for (const [command, key, amount] of commands) {
      await cheatInput.fill(command);
      await cheatBtn.click();
      await expect(inventory.locator(`[data-inventory-item-key="${key}"] strong`)).toHaveText(amount);
    }

    await expect(page.locator('#inventoryCommandStatus')).toContainText('Added 4 Scraper');
    await expect(page.locator('#eventLog')).toContainText('Stored tool logged: Scraper +4.');
    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.cheat-panel'), 'Inventory cheat adds all current tools');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
