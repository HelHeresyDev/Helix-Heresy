// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);
const storageKey = 'helix-heresy-v1-save';

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

async function reloadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test.describe('Inventory Pass 6 tool requirement gates', () => {
  test('source enforces reusable stocked tools without consumption or durability', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function handlingMethodMissingToolReason');
    expect(source).toContain('Procedure blocked: ${info.item.label} not stocked in Storage Room.');
    expect(source).toContain('Protocol: required tool stocked');
    expect(source).toContain('Protocol: procedure blocked until tool is stocked');
    expect(source).toContain('Requirement: stocked');
    expect(source).toContain('Requirement: blocked until stocked');
    expect(source).toContain('Tools are reusable and are not consumed.');
    expect(source).toContain('handlingMethodMissingToolReason(currentHandlingMethodId())');

    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('toolContamination');
    expect(source).not.toContain('equipmentSlot');
    expect(source).not.toContain('inventoryRecipes');
    expect(source).not.toContain('craftInventoryItem');
    expect(source).not.toContain('storageCapacity');
  });

  test('missing stocked tools disable handling actions with detached tooltip reason', async ({ page }) => {
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

    const handlingSelect = page.locator('[data-handling-method-select]');
    const note = page.locator('[data-handling-inventory-note]');

    await expect(note).toContainText('Tool preview: no tool expected');
    await expect(note).toContainText('Inventory: no cataloged tool');
    await expect(note).toContainText('Protocol: no tool requirement');
    await expect(note).toContainText('Requirement: none');

    await handlingSelect.selectOption('thickGloves');
    await expect(note).toContainText('Tool preview: Thick gloves available');
    await expect(note).toContainText('Inventory: 1 Thick gloves cataloged in Storage Room');
    await expect(note).toContainText('Protocol: required tool stocked');
    await expect(note).toContainText('Requirement: stocked');

    const openButton = page.locator('[data-open-container-id]').first();
    await expect(openButton).toBeEnabled();
    await expect(openButton).toHaveAttribute('title', /Tool preview: Thick gloves available/);
    await expect(openButton).toHaveAttribute('title', /Tool requirements are enforced/);

    await visualPause(page, page.locator('.policy-panel'), 'Required tool stocked and action allowed');

    await page.evaluate((key) => {
      const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
      payload.state ||= {};
      payload.state.inventory ||= {};
      payload.state.inventory.thickGloves = 0;
      payload.state.policies ||= {};
      payload.state.policies.handling ||= {};
      payload.state.policies.handling.method = 'thickGloves';
      window.localStorage.setItem(key, JSON.stringify(payload));
    }, storageKey);
    await reloadSavedRun(page);

    await expect(page.locator('[data-handling-method-select]')).toHaveValue('thickGloves');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Tool preview: Thick gloves not stocked');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Inventory: 0 Thick gloves cataloged in Storage Room');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Protocol: procedure blocked until tool is stocked');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Requirement: blocked until stocked');
    await expect(page.locator('[data-handling-inventory-note]')).toHaveAttribute('title', /Procedure blocked: Thick gloves not stocked in Storage Room\./);

    const blockedOpenButton = page.locator('[data-open-container-id]').first();
    await expect(blockedOpenButton).toBeDisabled();
    await expect(blockedOpenButton).toHaveAttribute('title', 'Procedure blocked: Thick gloves not stocked in Storage Room.');
    await expect(blockedOpenButton).toHaveAttribute('data-disabled-reason', 'Procedure blocked: Thick gloves not stocked in Storage Room.');

    const handlingRisk = page.locator('.container-handling-risk').first();
    await expect(handlingRisk).toContainText('Tool preview: Thick gloves not stocked');
    await expect(handlingRisk).toContainText('Protocol: procedure blocked until tool is stocked');
    await expect(handlingRisk).toContainText('Requirement: blocked until stocked');

    await visualPause(page, page.locator('.container-panel'), 'Required tool missing and action blocked');

    for (const value of ['bareHands', 'thickGloves', 'longTongs', 'hookPole', 'scraper']) {
      await expect(page.locator('[data-handling-method-select]').locator(`option[value="${value}"]`)).toBeEnabled();
    }

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    await cheatInput.fill('gloves 1');
    await cheatBtn.click();
    await expect(page.locator('[data-inventory-item-key="thickGloves"] strong')).toHaveText('1');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Tool preview: Thick gloves available');
    await expect(page.locator('[data-open-container-id]').first()).toBeEnabled();

    await handlingSelect.selectOption('bareHands');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Tool preview: no tool expected');
    await expect(page.locator('[data-open-container-id]').first()).toBeEnabled();

    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.policy-panel'), 'Restocked tool and bare hands remain allowed');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
