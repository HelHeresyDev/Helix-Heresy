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

test.describe('Prediction Cleanup Pass 2 active containment risk smoke test', () => {
  test('source adds active containment risk ranges and confidence without new mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function activeContainmentRiskPrediction(');
    expect(source).toContain('function activeContainmentRiskPredictionEl(');
    expect(source).toContain('function activeContainmentRiskRangeTooltip(');
    expect(source).toContain('function activeContainmentRiskUnknownFactors(');
    expect(source).toContain('function activeContainmentRiskKnownFactors(');
    expect(source).toContain('Active containment risk: ${predictionRangeText(prediction.range)}');
    expect(source).toContain('Confidence: ${prediction.confidence.label}');
    expect(source).toContain('Unknown factors widening the range');
    expect(source).toContain('Internal Potential and Pressure scores still drive incidents');
    expect(source).toContain('This is an assessment of possible active containment trouble, not a guaranteed escape outcome.');
    expect(source).toContain('skillIds: ["observation", "ethology", "slimeHandling"]');

    expect(source).not.toContain('likely escaping');
    expect(source).not.toContain('probably escape');
    expect(source).not.toContain('escape prediction percentage');
    expect(source).not.toContain('releaseTargetRoomId');
    expect(source).not.toContain('recapture system');
    expect(source).not.toContain('slime opens doors');
    expect(source).not.toContain('door hit points');
  });

  test('active risk UI shows compact range plus confidence and moves exact score reasons into tooltips', async ({ page }) => {
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

    const selectedSummary = page.locator('#selectedSlimeSummary');
    await expect(selectedSummary).toContainText('Active containment risk:');
    await expect(selectedSummary).toContainText('Confidence:');
    await expect(selectedSummary).not.toContainText('Potential:');
    await expect(selectedSummary).not.toContainText('Pressure:');

    const riskPrediction = page.locator('[data-active-risk-prediction="slime-1"]').first();
    await expect(riskPrediction).toBeVisible();
    await expect(riskPrediction).toContainText(/Active containment risk: [A-Za-z]+(?:–[A-Za-z]+)?/);
    await expect(riskPrediction).toContainText(/Confidence: (Unknown|Rough|Fair|Strong)/);
    await expect(riskPrediction).not.toContainText('Potential:');
    await expect(riskPrediction).not.toContainText('Pressure:');

    const rangeTitle = await page.locator('[data-active-risk-range="slime-1"]').first().getAttribute('title');
    const confidenceTitle = await page.locator('[data-active-risk-confidence="slime-1"]').first().getAttribute('title');
    expect(rangeTitle || '').toContain('Active containment risk range:');
    expect(rangeTitle || '').toContain('possible active containment trouble');
    expect(rangeTitle || '').toContain('Internal Potential and Pressure scores still drive incidents');
    expect(confidenceTitle || '').toContain('confidence');
    expect(confidenceTitle || '').toContain('relevant skills:');

    await visualPause(page, selectedSummary, 'Selected slime active containment risk range/confidence');
    await visualPause(page, page.locator('#containerList'), 'Container card active containment risk range/confidence');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
