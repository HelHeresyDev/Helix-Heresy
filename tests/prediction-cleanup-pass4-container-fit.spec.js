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

test.describe('Prediction Cleanup Pass 4 physical container fit smoke test', () => {
  test('source adds physical fit ranges without mixing fit with escape risk', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function physicalContainerFitPrediction(');
    expect(source).toContain('function physicalContainerFitTooltip(');
    expect(source).toContain('function physicalContainerFitPredictionEl(');
    expect(source).toContain('Physical fit range: ${predictionRangeText(prediction?.range)}.');
    expect(source).toContain('Physical fit estimates size, shape, space, opening, weight, and comfort. It is not escape risk.');
    expect(source).toContain('skillIds: ["observation", "slimeHandling", "physiology", "materialsAnalysis"]');
    expect(source).toContain('line.dataset.physicalFitRange = predictionRangeText(prediction.range)');
    expect(source).toContain('line.dataset.physicalFitConfidence = prediction.confidence.label');

    expect(source).not.toContain('Physical fit: Dangerous');
    expect(source).not.toContain('Physical fit: Failing');
    expect(source).not.toContain('likely cramped');
    expect(source).not.toContain('probably cramped');
    expect(source).not.toContain('fit escape risk');
  });

  test('container occupant UI shows physical fit range plus confidence and hides exact factor lists', async ({ page }) => {
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

    await page.locator('#synthesizeBtn').click();
    await page.keyboard.press('Shift+Period');
    await expect(page.locator('#selectedSlimeSummary')).toContainText('RG-001');

    const moveButton = page.getByRole('button', { name: /Move to Open Container/i });
    await expect(moveButton).toBeEnabled();
    await moveButton.click();
    await expect(page.locator('#eventLog')).toContainText('RG-001 assigned to');

    const physicalFit = page.locator('.container-physical-fit-prediction').first();
    await expect(physicalFit).toBeVisible();
    await expect(physicalFit).toContainText(/Physical fit: [A-Za-z ]+(?:–[A-Za-z ]+)?/);
    await expect(physicalFit).toContainText(/Confidence: (Unknown|Rough|Fair|Strong)/);
    await expect(physicalFit).not.toContainText('Known fit factors:');
    await expect(physicalFit).not.toContainText('Unknown factors:');
    await expect(physicalFit).not.toContainText('Concerns:');
    await expect(physicalFit).not.toContainText(/Good Fit|Poor Fit|Questionable|Unsuitable/);

    const title = await physicalFit.getAttribute('title');
    expect(title || '').toContain('Physical fit range:');
    expect(title || '').toContain('It is not escape risk.');
    expect(title || '').toContain('relevant skills:');
    expect(title || '').not.toContain('likely cramped');
    expect(title || '').not.toContain('probably cramped');

    await visualPause(page, page.locator('#containerList'), 'Container physical fit range/confidence and tooltips');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
