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

test.describe('Inventory Pass 1 storage ledger foundation', () => {
  test('source defines lab-wide Storage Room inventory ledger and inventory cheat', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const INVENTORY_ITEM_DEFS = [');
    expect(source).toContain('key: "biomass"');
    expect(source).toContain('key: "traceSlime"');
    expect(source).toContain('key: "contaminatedResidue"');
    expect(source).toContain('key: "ruinedOrganicMatter"');
    expect(source).toContain('key: "preservedTissue"');
    expect(source).toContain('inventory: defaultInventory()');
    expect(source).toContain('function normalizeInventory');
    expect(source).toContain('function addInventoryItem');
    expect(source).toContain('function renderInventory');
    expect(source).toContain('Storage Room ledger · Lab-wide prototype');
    expect(source).toContain('Inventory Cheat');
    expect(source).toContain('runInventoryCommand');

    expect(source).not.toContain('storageCapacity');
    expect(source).not.toContain('roomLocalInventory');
    expect(source).not.toContain('inventoryRecipes');
    expect(source).not.toContain('craftInventoryItem');
  });

  test('UI shows inventory ledger and cheats can add every inventory item', async ({ page }) => {
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

    await expect(page.locator('#inventoryTitle')).toContainText('Inventory');
    await expect(page.locator('#inventorySummary')).toContainText('Storage Room ledger');
    await expect(page.locator('#inventorySummary')).toHaveAttribute('title', /lab-wide/i);

    const inventory = page.locator('#inventoryList');
    await expect(inventory).toContainText('Biomass');
    await expect(inventory).toContainText('Trace slime');
    await expect(inventory).toContainText('Contaminated residue');
    await expect(inventory).toContainText('Ruined organic matter');
    await expect(inventory).toContainText('Preserved tissue');
    await expect(inventory.locator('[data-inventory-item-key="biomass"]')).toContainText('0');
    await expect(inventory.locator('[data-inventory-item-key="traceSlime"]')).toContainText('0');

    await visualPause(page, page.locator('.inventory-panel'), 'Inventory ledger foundation');

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    await expect(cheatInput).toBeVisible();
    await expect(cheatBtn).toBeVisible();

    const commands = [
      ['biomass 1', 'biomass', '1'],
      ['trace slime 2', 'traceSlime', '2'],
      ['contaminated residue 3', 'contaminatedResidue', '3'],
      ['ruined organic matter 4', 'ruinedOrganicMatter', '4'],
      ['preserved tissue 5', 'preservedTissue', '5'],
    ];

    for (const [command, key, amount] of commands) {
      await cheatInput.fill(command);
      await cheatBtn.click();
      await expect(inventory.locator(`[data-inventory-item-key="${key}"] strong`)).toHaveText(amount);
    }

    await expect(page.locator('#inventoryCommandStatus')).toContainText('Added 5 Preserved tissue');
    await expect(page.locator('#eventLog')).not.toContainText('Stored material logged');
    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.cheat-panel'), 'Inventory cheat can add each item');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
