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

async function inventoryCommand(page, command) {
  await page.locator('#inventoryCommandInput').fill(command);
  await page.locator('#inventoryCommandBtn').click();
}

test.describe('Inventory Pass 7 change history tooltips', () => {
  test('source stores inventory history and removes event-log accounting spam', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('inventoryHistory: defaultInventoryHistory()');
    expect(source).toContain('function defaultInventoryHistory');
    expect(source).toContain('function normalizeInventoryHistory');
    expect(source).toContain('function recordInventoryChange');
    expect(source).toContain('function inventoryItemTooltip');
    expect(source).toContain('Recent changes:');
    expect(source).toContain('slice(0, 10)');
    expect(source).toContain('cheat adjustment');

    expect(source).not.toContain('Stored ${itemKind} logged');
    expect(source).not.toContain('addEvent(`Stored');
  });

  test('inventory rows show last 10 changes in tooltip without event log entries', async ({ page }) => {
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

    const biomassRow = page.locator('[data-inventory-item-key="biomass"]');
    await expect(biomassRow).toHaveAttribute('title', /Recent changes:\nNo recorded changes\./);

    await inventoryCommand(page, 'biomass 5');
    await expect(biomassRow.locator('strong')).toHaveText('5');
    await expect(page.locator('#inventoryCommandStatus')).toContainText('Added 5 Biomass');
    await expect(biomassRow).toHaveAttribute('title', /\+5 cheat adjustment/);
    await expect(page.locator('#eventLog')).not.toContainText('Stored material logged');
    await expect(page.locator('#eventLog')).not.toContainText('Biomass +5');

    await inventoryCommand(page, 'biomass -2');
    await expect(biomassRow.locator('strong')).toHaveText('3');
    await expect(page.locator('#inventoryCommandStatus')).toContainText('Removed 2 Biomass');
    await expect(biomassRow).toHaveAttribute('title', /-2 cheat adjustment/);
    await expect(biomassRow).toHaveAttribute('title', /\+5 cheat adjustment/);

    await visualPause(page, page.locator('.inventory-panel'), 'Inventory change history tooltip');

    const traceRow = page.locator('[data-inventory-item-key="traceSlime"]');
    for (let amount = 1; amount <= 11; amount += 1) {
      await inventoryCommand(page, `trace slime ${amount}`);
    }
    await expect(traceRow.locator('strong')).toHaveText('66');
    const title = await traceRow.getAttribute('title');
    expect(title).toContain('Recent changes:');
    expect(title).toContain('+11 cheat adjustment');
    expect(title).toContain('+2 cheat adjustment');
    expect(title).not.toContain('+1 cheat adjustment');

    const changeLines = (title || '').split('\n').filter((line) => /cheat adjustment/.test(line));
    expect(changeLines).toHaveLength(10);

    await expect(page.locator('#eventLog')).not.toContainText('Stored material logged');
    await expect(page.locator('#eventLog')).not.toContainText('Stored tool logged');

    await visualPause(page, page.locator('.inventory-panel'), 'Inventory change history capped at 10');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
