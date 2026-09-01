// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Library = require('../world-run-library');

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

test('New Run filters explicit candidate cards and saves the chosen strategic site with the run', async ({ page }) => {
  test.setTimeout(1_800_000);
  const world = Library.createWorld({ id: 'site-ui-world', worldSeed: 'site-ui-world-seed', worldTheme: 'madcap', createdAt: 'test' });
  const manifest = { version: 2, worldIds: [world.id], runIds: [], activeRunId: null };
  await page.addInitScript(({ manifest, worldKey, worldPayload }) => {
    window.localStorage.setItem('helix-heresy-v2-library', JSON.stringify(manifest));
    window.localStorage.setItem(worldKey, worldPayload);
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  }, {
    manifest,
    worldKey: `${Library.WORLD_KEY_PREFIX}${world.id}`,
    worldPayload: Library.compressStorageText(JSON.stringify(world)),
  });
  await page.goto(appUrl);
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('[data-starting-site]')).toHaveCount(15);
  await expect(page.locator('#startRunSubmitBtn')).toBeDisabled();
  await expect(page.locator('#startingSiteBiomeFilter option')).not.toHaveCount(1);
  await expect(page.locator('#startingSiteDistanceFilter')).toContainText('Inside city walls');
  await expect(page.locator('#startingSiteDistanceFilter')).toContainText('Protected approaches');
  await expect(page.locator('#startingSiteDistanceFilter')).toContainText('Supported corridor fringe');

  await page.locator('#startingSiteDistanceFilter').selectOption('corridorFringe');
  const selectedCard = page.locator('[data-starting-site]').first();
  const candidateId = await selectedCard.getAttribute('data-starting-site');
  await selectedCard.locator('input').check();
  await expect(page.locator('#startRunSubmitBtn')).toBeEnabled();
  await page.locator('#startRunSubmitBtn').click();

  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="company"]').click();
  await expect(page.locator('[data-site-context-row="location"]')).toBeVisible();
  await expect(page.locator('[data-site-context-row="water"]')).toContainText('viable at run start');
  await expect(page.locator('[data-site-context-row="knowledge"]')).toContainText('Exact deposits');
  await expect(page.locator('[data-site-conditions-row="weather"]')).toBeVisible();
  await expect(page.locator('[data-site-conditions-row="drainage"]')).toContainText('aquifer quality');

  const actualContext = await page.evaluate(() => window.helixHeresyDebug.localSiteContextSnapshot());
  expect(actualContext.runSite).toMatchObject({
    selectionStatus: 'selectedAndMaterialized',
    candidateId,
    worldId: world.id,
    canonicalWorldDigest: world.canonicalDigest,
    strategicLocation: {
      distanceBand: 'corridorFringe',
      jurisdiction: { kind: 'facilityConvoyOrAgreementOnly', governingCityId: null },
    },
    materialization: { preservesCanonicalWorld: true, priorRunOccupancyIgnored: true, exactLocalContextDeferred: false },
  });
  expect(actualContext.startingSite).toEqual(actualContext.runSite);
  expect(actualContext.runSite.materialization.localContextDigest).toBe(actualContext.context.digest);
  expect(actualContext.context).toMatchObject({
    worldId: world.id,
    canonicalWorldDigest: world.canonicalDigest,
    candidateId,
    water: { viableAtRunStart: true },
    knowledge: { exactDepositLocationsKnown: false, hiddenAquiferQualityKnown: false, concealedHazardsKnown: false },
  });
  expect(actualContext.cistern.utility.contents.cleanWater).toBe(actualContext.context.water.initialCisternUnits);
  expect(actualContext.cistern.utility.waterQuality).toBe(actualContext.context.water.startingQuality);
  expect(actualContext.serviceCapacities.electricity).toBeCloseTo(24 * actualContext.context.utilities.multipliers.electricity, 5);
  expect(actualContext.sampleGeology.stratum.id).toBeTruthy();

  const surfaceResult = await page.evaluate(() => window.helixHeresyDebug.surfaceExposureSnapshot());
  expect(surfaceResult.known.weather.digest).toBeTruthy();
  expect(surfaceResult.known.aquiferStatement).toContain('unknown');
  expect(surfaceResult.conservation).toEqual([]);
});
