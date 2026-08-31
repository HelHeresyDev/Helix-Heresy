// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

test('city law UI exposes declared enforcement practice and qualitative justice throughput', async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupWorldSeedInput').fill('world-seed-one');
  await page.locator('input[name="setupWorldTheme"][value="unbound"]').check();
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('offense-practice profiles', { timeout: 300_000 });

  const cityIndices = await page.evaluate(() => window.helixHeresyDebug.strategicHumanGeographyCityIndices());
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), cityIndices[0]);
  await expect(page.locator('#strategicCellEnforcementPractice')).toContainText('declared priority');
  await expect(page.locator('#strategicCellJusticeThroughput')).toContainText('Report intake');
  await expect(page.locator('#strategicCellJusticeThroughput')).toContainText('Long-term corrections');
  await expect(page.locator('#strategicCityLawDirectoryHeading')).toContainText('Justice Throughput');
  await expect(page.locator('.strategic-city-enforcement-practice').first()).toContainText('exact workload');

  const publicHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicEnforcementPracticeHistory());
  expect(publicHistory.practiceRows).toHaveLength(cityIndices.length * 21);
  expect(publicHistory.pipelineRows).toHaveLength(cityIndices.length * 6);
  expect(JSON.stringify(publicHistory)).not.toMatch(/actualPriority|resourceCommitment|selectiveTolerance|hiddenInterference|exactWorkloadIndex|covertInterference/);
});
