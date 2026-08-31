// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Library = require('../world-run-library');

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

test('New Run filters explicit candidate cards and saves the chosen strategic site with the run', async ({ page }) => {
  test.setTimeout(1_200_000);
  const world = Library.createWorld({ id: 'site-ui-world', worldSeed: 'site-ui-world-seed', worldTheme: 'madcap', createdAt: 'test' });
  const manifest = { version: 2, worldIds: [world.id], runIds: [], activeRunId: null };
  await page.addInitScript(({ manifest, worldKey, worldPayload }) => {
    window.localStorage.setItem('helix-heresy-v2-library', JSON.stringify(manifest));
    window.localStorage.setItem(worldKey, worldPayload);
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

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(snapshot.run.site).toMatchObject({
    selectionStatus: 'selectedAndMaterialized',
    candidateId,
    worldId: world.id,
    canonicalWorldDigest: world.canonicalDigest,
    strategicLocation: {
      distanceBand: 'corridorFringe',
      jurisdiction: { kind: 'facilityConvoyOrAgreementOnly', governingCityId: null },
    },
    materialization: { preservesCanonicalWorld: true, priorRunOccupancyIgnored: true },
  });
  expect(snapshot.run.state.startingSite).toEqual(snapshot.run.site);
});
