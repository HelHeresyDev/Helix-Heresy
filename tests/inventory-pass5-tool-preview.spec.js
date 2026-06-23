// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
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

async function reloadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test.describe('Inventory Pass 5 tool previews under enforced gates', () => {
  test('source keeps tool preview/protocol wording with stocked and blocked states', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function handlingMethodToolPreviewSummary');
    expect(source).toContain('Tool preview: no tool expected');
    expect(source).toContain('Tool preview: ${info.item.label} available');
    expect(source).toContain('Tool preview: ${info.item.label} not stocked');
    expect(source).toContain('Protocol: required tool stocked');
    expect(source).toContain('Protocol: procedure blocked until tool is stocked');
    expect(source).toContain('Requirement: blocked until stocked');

    expect(source).not.toContain('consumeInventoryTool');
    expect(source).not.toContain('toolDurability');
    expect(source).not.toContain('toolContamination');
  });

  test('handling UI previews available and missing tools while gates block missing tools', async ({ page }) => {
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

    await handlingSelect.selectOption('thickGloves');
    await expect(note).toContainText('Tool preview: Thick gloves available');
    await expect(note).toContainText('Protocol: required tool stocked');
    await expect(page.locator('[data-open-container-id]').first()).toBeEnabled();

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

    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Tool preview: Thick gloves not stocked');
    await expect(page.locator('[data-handling-inventory-note]')).toContainText('Protocol: procedure blocked until tool is stocked');
    await expect(page.locator('[data-open-container-id]').first()).toBeDisabled();
    await expect(page.locator('[data-open-container-id]').first()).toHaveAttribute('title', 'Procedure blocked: Thick gloves not stocked in Storage Room.');

    for (const value of ['bareHands', 'thickGloves', 'longTongs', 'hookPole', 'scraper']) {
      await expect(handlingSelect.locator(`option[value="${value}"]`)).toBeEnabled();
    }

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
