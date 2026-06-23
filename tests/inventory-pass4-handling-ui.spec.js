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

test.describe('Inventory Pass 4 inventory-aware handling UI', () => {
  test('source links handling methods to stocked inventory requirements', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const HANDLING_METHOD_INVENTORY_ITEM_KEYS = {');
    expect(source).toContain('thickGloves: "thickGloves"');
    expect(source).toContain('longTongs: "longTongs"');
    expect(source).toContain('hookPole: "hookPole"');
    expect(source).toContain('scraper: "scraper"');
    expect(source).toContain('function handlingMethodInventoryInfo');
    expect(source).toContain('function handlingMethodInventorySummary');
    expect(source).toContain('function handlingMethodRequirementSummary');
    expect(source).toContain('function handlingMethodActionTitle');
    expect(source).toContain('Inventory: no cataloged tool');
    expect(source).toContain('Requirement: stocked');
    expect(source).toContain('Tool requirements are enforced for this handling method.');
    expect(source).toContain('dataset.handlingInventoryNote');
    expect(source).toContain('dataset.handlingInventory');
    expect(source).toContain('dataset.handlingRequirement');

    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('toolContamination');
  });

  test('handling method UI shows cataloged tool stock without disabling methods', async ({ page }) => {
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

    const handlingSelect = page.locator('[data-handling-method-select]');
    await expect(handlingSelect).toBeVisible();
    await expect(handlingSelect.locator('option')).toHaveCount(5);

    const note = page.locator('[data-handling-inventory-note]');
    await expect(note).toContainText('Inventory: no cataloged tool');
    await expect(note).toContainText('Requirement: none');
    await expect(note).toHaveAttribute('title', /No inventory gate applies to this handling method/i);

    await handlingSelect.selectOption('thickGloves');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Inventory: 1 Thick gloves cataloged in Storage Room');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Requirement: stocked');
    await expect(page.locator('[data-handling-inventory-note]')).toHaveAttribute('title', /Tool requirements are enforced for this handling method/i);

    const handlingRisk = page.locator('.container-handling-risk').first();
    await expect(handlingRisk).toContainText('Method: Thick gloves');
    await expect(handlingRisk).toContainText('Inventory: 1 Thick gloves cataloged in Storage Room');
    await expect(handlingRisk).toContainText('Requirement: stocked');
    await expect(handlingRisk).toHaveAttribute('data-handling-inventory', /1 Thick gloves/);
    await expect(handlingRisk).toHaveAttribute('data-handling-requirement', 'Requirement: stocked');
    await expect(handlingRisk).toHaveAttribute('title', /Tool requirements are enforced for this handling method/i);

    const openButton = page.locator('[data-open-container-id]').first();
    await expect(openButton).toBeEnabled();
    await expect(openButton).toHaveAttribute('title', /Inventory: 1 Thick gloves cataloged in Storage Room/);
    await expect(openButton).toHaveAttribute('title', /Requirement: stocked/);

    await visualPause(page, page.locator('.container-panel'), 'Inventory-aware handling method UI');

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    await cheatInput.fill('gloves 2');
    await cheatBtn.click();
    await expect(page.locator('[data-inventory-item-key="thickGloves"] strong')).toHaveText('3');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Inventory: 3 Thick gloves cataloged in Storage Room');
    await expect(page.locator('.container-handling-risk').first()).toContainText('Inventory: 3 Thick gloves cataloged in Storage Room');

    await handlingSelect.selectOption('longTongs');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Inventory: 1 Long tongs cataloged in Storage Room');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Requirement: stocked');

    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.policy-panel'), 'Handling method stock after cheat update');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
