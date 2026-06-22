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

test.describe('Prediction Cleanup Pass 1 smoke test', () => {
  test('source has compact ranges and confidence tooltips for cleanup/release predictions', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function predictionRangeText(');
    expect(source).toContain('function predictionConfidenceFromContext(');
    expect(source).toContain('function cleanupUseRangeTooltip(');
    expect(source).toContain('function predictionConfidenceTooltip(');
    expect(source).toContain('function releaseSuitabilityTooltipText(');
    expect(source).toContain('Possible fit after release:');
    expect(source).toContain('Cleanup suitability: ${predictionRangeText(suitability.range)}');
    expect(source).toContain('Confidence: ${suitability.confidence.label}');
    expect(source).toContain('relevant skills:');
    expect(source).toContain('unknown factors widen the range');
    expect(source).toContain('Observation');
    expect(source).toContain('Slime Handling');
    expect(source).toContain('Ethology');

    expect(source).not.toContain('likely cramped');
    expect(source).not.toContain('probably safe');
    expect(source).not.toContain('Expected fit after release:');
    expect(source).not.toContain('cleanupTargetRoomId');
    expect(source).not.toContain('releaseTargetRoomId');
    expect(source).not.toContain('order slime to clean');
    expect(source).not.toContain('slime obeys');
  });

  test('cleanup and release UI show range plus confidence while details live in tooltips', async ({ page }) => {
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

    // Check release button title BEFORE releasing (slime still in tube)
    const releaseTitle = await page.locator('#releaseBtn').getAttribute('title');
    expect(releaseTitle || '').toContain('Possible fit after release:');
    expect(releaseTitle || '').toContain('Confidence:');
    expect(releaseTitle || '').toMatch(/Helpful factors|Concerns|Unknown factors|relevant skills/);

    // Test release warning dialog content, then cancel
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Release warning');
      expect(dialog.message()).toContain('Possible fit after release:');
      expect(dialog.message()).toContain('Confidence:');
      expect(dialog.message()).not.toContain('Helpful factors:');
      expect(dialog.message()).not.toContain('Concerns:');
      expect(dialog.message()).not.toContain('Unknown factors:');
      await dialog.dismiss();
    });
    await page.locator('#releaseBtn').click();
    await expect(page.locator('#eventLog')).toContainText('RG-001 release cancelled.');

    // Now release the slime so the job select becomes enabled
    page.once('dialog', async (dialog) => await dialog.accept());
    await page.locator('#releaseBtn').click();
    await expect(page.locator('#selectedSlimeSummary')).toContainText('Location: Main Lab');

    const jobSelect = page.locator('.job-row select[data-job-slime-id="slime-1"]');
    await expect(jobSelect).toBeVisible();
    await jobSelect.selectOption('cleanup');

    const panel = page.locator('[data-cleanup-use-suitability="slime-1"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Cleanup suitability:');
    await expect(panel).toContainText('Confidence:');
    await expect(panel).not.toContainText('Known helpful factors:');
    await expect(panel).not.toContainText('Concerns:');
    await expect(panel).not.toContainText('Unknown factors:');

    const panelText = await panel.innerText();
    expect(panelText).toMatch(/Cleanup suitability: [A-Za-z]+(?:–[A-Za-z]+)?/);
    expect(panelText).toMatch(/Confidence: (Unknown|Rough|Fair|Strong)/);

    const rangeTitle = await page.locator('[data-cleanup-suitability-range="slime-1"]').getAttribute('title');
    const confidenceTitle = await page.locator('[data-cleanup-suitability-confidence="slime-1"]').getAttribute('title');
    expect(rangeTitle || '').toContain('Cleanup suitability range:');
    expect(rangeTitle || '').toMatch(/Helpful factors|Concerns|Unknown factors|Simple slimes follow instincts/);
    expect(confidenceTitle || '').toContain('confidence');
    expect(confidenceTitle || '').toContain('relevant skills:');

    await visualPause(page, page.locator('#jobSummary'), 'Prediction cleanup range/confidence job UI');
    await visualPause(page, page.locator('#selectedSlimeSummary'), 'Release warning title with tooltip details');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
