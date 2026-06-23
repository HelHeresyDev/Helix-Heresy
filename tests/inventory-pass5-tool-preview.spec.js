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

test.describe('Inventory Pass 5 tool requirement previews', () => {
  test('source adds tool preview/protocol wording without gates', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function handlingMethodToolPreviewSummary');
    expect(source).toContain('Tool preview: no tool expected');
    expect(source).toContain('Tool preview: ${info.item.label} available');
    expect(source).toContain('Tool preview: ${info.item.label} not stocked');
    expect(source).toContain('function handlingMethodProtocolSummary');
    expect(source).toContain('Protocol: tool requirement not enforced');
    expect(source).toContain('Protocol: tool requirement not enforced; procedure still permitted');
    expect(source).toContain('dataset.handlingToolPreview');
    expect(source).toContain('dataset.handlingProtocol');

    expect(source).not.toContain('requireInventoryTool');
    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('disableHandlingMethodForInventory');
    expect(source).not.toContain('toolRequirementGate');
  });

  test('handling UI previews available and missing tools without blocking actions', async ({ page }) => {
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
    await expect(note).toContainText('Protocol: tool requirement not enforced');
    await expect(note).toContainText('Requirement: not enforced yet');
    await expect(note).toHaveAttribute('title', /Tool preview: Thick gloves available/i);

    const handlingRisk = page.locator('.container-handling-risk').first();
    await expect(handlingRisk).toContainText('Tool preview: Thick gloves available');
    await expect(handlingRisk).toContainText('Protocol: tool requirement not enforced');
    await expect(handlingRisk).toHaveAttribute('data-handling-tool-preview', 'Tool preview: Thick gloves available');
    await expect(handlingRisk).toHaveAttribute('data-handling-protocol', 'Protocol: tool requirement not enforced');

    const openButton = page.locator('[data-open-container-id]').first();
    await expect(openButton).toBeEnabled();
    await expect(openButton).toHaveAttribute('title', /Tool preview: Thick gloves available/);
    await expect(openButton).toHaveAttribute('title', /Protocol: tool requirement not enforced/);

    await visualPause(page, page.locator('.policy-panel'), 'Tool preview available');

    const cheatInput = page.locator('#inventoryCommandInput');
    const cheatBtn = page.locator('#inventoryCommandBtn');
    await cheatInput.fill('gloves 2');
    await cheatBtn.click();
    await expect(page.locator('[data-inventory-item-key="thickGloves"] strong')).toHaveText('3');
    await expect(note).toContainText('Tool preview: Thick gloves available');
    await expect(note).toContainText('Inventory: 3 Thick gloves cataloged in Storage Room');

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
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Protocol: tool requirement not enforced; procedure still permitted');
    await expect(page.locator('.container-handling-risk').first()).toContainText('Tool preview: Thick gloves not stocked');
    await expect(page.locator('.container-handling-risk').first()).toContainText('procedure still permitted');
    await expect(page.locator('[data-open-container-id]').first()).toBeEnabled();
    await expect(page.locator('[data-open-container-id]').first()).toHaveAttribute('title', /Tool preview: Thick gloves not stocked/);
    await expect(page.locator('[data-open-container-id]').first()).toHaveAttribute('title', /procedure still permitted/);

    await handlingSelect.selectOption('longTongs');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Tool preview: Long tongs available');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Inventory: 1 Long tongs cataloged in Storage Room');

    for (const value of ['bareHands', 'thickGloves', 'longTongs', 'hookPole', 'scraper']) {
      await expect(handlingSelect.locator(`option[value="${value}"]`)).toBeEnabled();
    }

    await expect(page.locator('text=Recipes')).toHaveCount(0);
    await expect(page.locator('text=Crafting')).toHaveCount(0);
    await expect(page.locator('text=Storage capacity')).toHaveCount(0);

    await visualPause(page, page.locator('.container-panel'), 'Tool preview not stocked but allowed');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
