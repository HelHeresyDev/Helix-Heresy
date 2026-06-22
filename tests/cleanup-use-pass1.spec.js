// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) {
    return;
  }
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

test.describe('Contamination Cleanup Pass 1 smoke test', () => {
  test('source includes cleanup use suitability without room-target orders', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('{ id: "cleanup", label: "Use as Cleaner" }');
    expect(source).toContain('function observedCleanupUseSuitability(');
    expect(source).toContain('function cleanupUseControlNote()');
    expect(source).toContain('function cleanupUseSuitabilityPanel(');
    expect(source).toContain('Simple slimes follow instincts');
    expect(source).toContain('Use doors to limit where this creature can roam');
    expect(source).toContain('marked for cleanup use');
    expect(source).toContain('feeds on contamination');
    expect(source).toContain('seeks contamination');
    expect(source).toContain('may leave residue');
    expect(source).toContain('predatory behavior');
    expect(source).toContain('cleanupUseOptionTitle');

    expect(source).not.toContain('cleanupTargetRoomId');
    expect(source).not.toContain('assign cleanup target');
    expect(source).not.toContain('Clean this room');
    expect(source).not.toContain('ordered to clean');
  });

  test('app still loads cleanly with cleanup use source present', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 4);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(appUrl);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.locator('#setupForm button[type="submit"]').click();

    await expect(page.locator('#jobSummary')).toBeVisible();
    await expect(page.locator('#jobSummary')).toContainText('No living creatures available for jobs.');
    await expect(page.locator('#roomList')).toContainText('Bedroom');
    await expect(page.locator('#doorPolicyList')).toContainText('Door behavior');

    await visualPause(page, page.locator('#jobSummary'), 'Creature Jobs panel after setup');
    await visualPause(page, page.locator('#doorPolicyList'), 'Door policy remains visible after cleanup-use patch');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
