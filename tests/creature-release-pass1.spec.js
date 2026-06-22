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

test.describe('Creature Release Pass 1 smoke test', () => {
  test('source includes release suitability warning without new obedience or target systems', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function releaseSuitabilityWarningText(');
    expect(source).toContain('function observedReleaseUseFit(');
    expect(source).toContain('function confirmReleaseSuitabilityIfNeeded(');
    expect(source).toContain('Release warning');
    expect(source).toContain('Released simple slimes follow instincts. Doors limit where they can roam.');
    expect(source).toContain('Intended use:');
    expect(source).toContain('Expected fit after release:');
    expect(source).toContain('Helpful factors:');
    expect(source).toContain('Concerns:');
    expect(source).toContain('Unknown factors:');
    expect(source).toContain('formal corpse processing depends on reachable remains and room conditions');
    expect(source).toContain('formal waste disposal depends on accessible waste and room conditions');
    expect(source).toContain('observedCleanupUseSuitability(slime)');

    expect(source).not.toContain('releaseTargetRoomId');
    expect(source).not.toContain('cleanupTargetRoomId');
    expect(source).not.toContain('assign release target');
    expect(source).not.toContain('order slime to clean');
    expect(source).not.toContain('ordered to clean');
    expect(source).not.toContain('slime obeys');
  });

  test('release button warns before releasing and can be cancelled', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 5);
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

    await page.locator('#synthesizeBtn').click();
    await page.keyboard.press('Shift+Period');
    await expect(page.locator('#selectedSlimeSummary')).toContainText('RG-001');
    await expect(page.locator('#releaseBtn')).toBeEnabled();

    const title = await page.locator('#releaseBtn').getAttribute('title');
    expect(title || '').toContain('Release warning');
    expect(title || '').toContain('Released simple slimes follow instincts');
    expect(title || '').toContain('Intended use: Idle');
    expect(title || '').toContain('Expected fit after release:');

    await visualPause(page, page.locator('#selectedSlimeSummary'), 'Selected slime before release warning');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Release warning');
      expect(dialog.message()).toContain('Released simple slimes follow instincts');
      expect(dialog.message()).toContain('Intended use: Idle');
      expect(dialog.message()).toContain('Expected fit after release:');
      await dialog.dismiss();
    });
    await page.locator('#releaseBtn').click();
    await expect(page.locator('#eventLog')).toContainText('RG-001 release cancelled.');
    await expect(page.locator('#selectedSlimeSummary')).toContainText('Contained in Synthesis Tube');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Continue releasing this slime?');
      await dialog.accept();
    });
    await page.locator('#releaseBtn').click();
    await expect(page.locator('#selectedSlimeSummary')).toContainText('Location: Main Lab');
    await expect(page.locator('#eventLog')).toContainText('moved out of containment');

    await visualPause(page, page.locator('#eventLog'), 'Event log after release warning accept/cancel');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
