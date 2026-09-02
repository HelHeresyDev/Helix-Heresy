// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function openDefaultState(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

test('Chemistry Front materializes a physical, weatherable parcel presentation', async ({ page }) => {
  await openDefaultState(page);

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.propertyPresentationSnapshot());
  expect(snapshot.publicRoute.connected).toBe(true);
  expect(snapshot.publicRoute.requiredWidth).toBe(1);
  expect(snapshot.freightRoute.connected).toBe(true);
  expect(snapshot.freightRoute.requiredWidth).toBe(3);
  expect(snapshot.fixtures.map((fixture) => fixture.typeId)).toEqual(expect.arrayContaining([
    'companySign', 'meshBarrier', 'privacyScreen', 'landscapeBed', 'wasteEnclosure'
  ]));
  expect(snapshot.assessment.dimensions.map((dimension) => dimension.id)).toEqual([
    'identification', 'approaches', 'upkeep', 'landUse', 'landscaping', 'security'
  ]);
  expect(snapshot.sightlines.observers.length).toBeGreaterThanOrEqual(2);

  const company = await page.evaluate(() => window.helixHeresyDebug.companySnapshot());
  expect(company.assessment.dimensions.find((dimension) => dimension.id === 'public').reasons.join(' ')).toContain('Parcel presentation');

  const arrival = await page.evaluate(() => {
    const scheduled = window.helixHeresyDebug.scheduleSiteVisit('routineCourier');
    window.helixHeresyDebug.updateSiteVisits(1);
    return window.helixHeresyDebug.siteVisitsSnapshot().visits.find((visit) => visit.id === scheduled.id);
  });
  expect(arrival.routeHistory[0].cell).toEqual({ x: 47, y: 57, z: 1 });
});

test('property route designations can physically invalidate freight width', async ({ page }) => {
  await openDefaultState(page);

  await page.evaluate(() => window.helixHeresyDebug.setPropertyZone('publicApproach', { x: 64, y: 49, z: 1 }));
  const changed = await page.evaluate(() => window.helixHeresyDebug.propertyPresentationSnapshot());
  expect(changed.freightRoute.connected).toBe(false);
  expect(changed.state.zones.publicApproach).toContainEqual({ x: 64, y: 49, z: 1 });
  expect(changed.state.zones.freightApproach).not.toContainEqual({ x: 64, y: 49, z: 1 });

});
