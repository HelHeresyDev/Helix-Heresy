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
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function box(locator) {
  const value = await locator.boundingBox();
  expect(value).toBeTruthy();
  return /** @type {{x:number,y:number,width:number,height:number}} */ (value);
}

test.describe('UI Cleanup Pass 3 right sidebar alignment', () => {
  test('source creates a real right sidebar for journal and inventory panels', async () => {
    const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
    const styleSource = fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8');

    expect(appSource).toContain('function ensureRightSidebar');
    expect(appSource).toContain('sidebar.className = "right-sidebar"');
    expect(appSource).toContain('sidebar.append(journalPanel)');
    expect(appSource).toContain('sidebar.append(panel)');
    expect(appSource).toContain('ensureRightSidebar();');

    expect(styleSource).toContain('.right-sidebar');
    expect(styleSource).toContain('grid-column: 3;');
    expect(styleSource).toContain('display: flex;');
    expect(styleSource).toContain('flex-direction: column;');
  });

  test('journal aligns with top content row and inventory sits directly below it', async ({ page }) => {
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

    const sidebar = page.locator('.right-sidebar');
    const journal = page.locator('.journal-panel');
    const inventory = page.locator('.inventory-panel');
    const dna = page.locator('.dna-panel');
    const livingSamples = page.locator('.lab-panel');
    const containers = page.locator('.container-panel');

    await expect(sidebar).toHaveCount(1);
    await expect(journal).toBeVisible();
    await expect(inventory).toBeVisible();
    await expect(sidebar.locator('.journal-panel')).toHaveCount(1);
    await expect(sidebar.locator('.inventory-panel')).toHaveCount(1);

    const sidebarBox = await box(sidebar);
    const journalBox = await box(journal);
    const inventoryBox = await box(inventory);
    const dnaBox = await box(dna);
    const labBox = await box(livingSamples);
    const containerBox = await box(containers);

    // Journal should align with the top main content row, not the lower Containers row.
    expect(Math.abs(journalBox.y - dnaBox.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(journalBox.y - labBox.y)).toBeLessThanOrEqual(4);
    expect(journalBox.y).toBeLessThan(containerBox.y - 20);

    // Inventory should be directly beneath Journal inside the right sidebar, not stranded below the Containers row.
    expect(inventoryBox.y).toBeGreaterThan(journalBox.y + journalBox.height - 1);
    expect(inventoryBox.y).toBeLessThan(journalBox.y + journalBox.height + 32);
    expect(inventoryBox.y).toBeLessThan(containerBox.y);

    // Sidebar remains in the right column.
    expect(sidebarBox.x).toBeGreaterThan(labBox.x + labBox.width - 8);

    await visualPause(page, sidebar, 'Right sidebar aligned with top row');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
