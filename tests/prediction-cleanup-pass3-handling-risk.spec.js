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

test.describe('Prediction Cleanup Pass 3 direct handling risk smoke test', () => {
  test('source adds direct handling ranges and confidence without new mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function directHandlingRiskPrediction(');
    expect(source).toContain('function directHandlingRiskTooltip(');
    expect(source).toContain('function handlingRiskTitle(');
    expect(source).toContain('Handling risk range: ${predictionRangeText(prediction?.riskRange)}.');
    expect(source).toContain('Possible harm range: ${predictionRangeText(prediction?.harmRange)}.');
    expect(source).toContain('Exact injury damage is not shown as a precise prediction.');
    expect(source).toContain('skillIds: ["observation", "slimeHandling", "physiology"]');
    expect(source).toContain('handling.dataset.handlingRisk = predictionRangeText(handlingPrediction.riskRange)');
    expect(source).toContain('handling.dataset.handlingHarm = predictionRangeText(handlingPrediction.harmRange)');
    expect(source).toContain('handling.dataset.handlingConfidence = handlingPrediction.confidence.label');

    expect(source).not.toContain('likely harm');
    expect(source).not.toContain('probably hurt');
    expect(source).not.toContain('handling prediction percentage');
    expect(source).not.toContain('new injury system');
    expect(source).not.toContain('recapture system');
  });

  test('handling risk UI shows compact range plus confidence and moves details into tooltip', async ({ page }) => {
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

    await expect(page.locator('#containerList')).toContainText('Handling risk:');
    const handling = page.locator('.container-handling-risk').first();
    await expect(handling).toBeVisible();
    await expect(handling).toContainText(/Handling risk: [A-Za-z ]+(?:–[A-Za-z ]+)?/);
    await expect(handling).toContainText(/Possible harm: [A-Za-z ]+(?:–[A-Za-z ]+)?/);
    await expect(handling).toContainText(/Confidence: (Unknown|Rough|Fair|Strong)/);
    await expect(handling).toContainText(/Method:/);
    await expect(handling).not.toContainText('Known factors:');
    await expect(handling).not.toContainText('Unknown factors:');
    await expect(handling).not.toContainText(/Possible harm: (serious to lethal harm likely|moderate harm possible|cannot estimate safely)/i);

    const title = await handling.getAttribute('title');
    expect(title || '').toContain('Handling risk range:');
    expect(title || '').toContain('Possible harm range:');
    expect(title || '').toContain('direct handling assessment');
    expect(title || '').toContain('relevant skills:');
    expect(title || '').toContain('Exact injury damage is not shown as a precise prediction.');

    const openButton = page.locator('[data-open-container-id]').first();
    const openTitle = await openButton.getAttribute('title');
    expect(openTitle || '').toContain('Handling risk range:');
    expect(openTitle || '').toContain('Possible harm range:');

    await visualPause(page, page.locator('#containerList'), 'Container handling risk range/confidence and tooltips');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
