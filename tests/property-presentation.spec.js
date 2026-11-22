// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { createHash } = require('node:crypto');

const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function openDefaultState(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

test('opaque parcel fixtures block only rays intersecting their actual occupied tiles', async ({ page }) => {
  await openDefaultState(page);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const left = { x: 41, y: 55, z: 1 }, right = { x: 43, y: 55, z: 1 };
    const before = d.sensoryLineOfSight(left, right);
    const s = d.exportSurveyExpeditionTestState();
    s.fixtures.find(f => f.typeId === 'privacyScreen').origin = { x: 42, y: 55, z: 1 };
    d.importSurveyExpeditionTestState(s);
    return { before, blocked: d.sensoryLineOfSight(left, right),
      adjacent: d.sensoryLineOfSight({ ...left, y: 56 }, { ...right, y: 56 }) };
  });
  expect(result).toEqual({ before: true, blocked: false, adjacent: true });
});

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

test('parcel assessment reflects an opened roof and restores the original sightlines on repair', async ({ page }) => {
  test.setTimeout(120000);
  await openDefaultState(page);
  const { intact, open, repaired } = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const cell = d.surfaceMapSnapshot().samples.interior;
    if (!cell) throw new Error('Expected an interior surface cell');
    const read = () => {
      const { assessment, sightlines, fixtures } = d.propertyPresentationSnapshot();
      return { envelope: d.surfaceEnvelopeForTest(cell).direct.kind, assessment, sightlines,
        fixtures: fixtures.map(fixture => ({ id: fixture.id, type: fixture.typeId, origin: fixture.origin })) };
    };
    const intact = read();
    const original = d.exportSurveyExpeditionTestState();
    const changed = structuredClone(original);
    const floors = changed.labMap.terrain.constructedFloors;
    const roof = floors.findIndex(floor => floor.purpose === 'roof' && floor.cell.x === cell.x && floor.cell.y === cell.y && floor.cell.z === cell.z + 1);
    if (roof < 0) throw new Error('Expected a roof directly above the selected cell');
    floors.splice(roof, 1);
    d.importSurveyExpeditionTestState(changed);
    const open = read();
    d.importSurveyExpeditionTestState(original);
    return { intact, open, repaired: read() };
  });
  expect(intact.envelope).toBe('interior');
  expect(open.envelope).toBe('outdoor');
  expect(open.sightlines.targetCount).toBeGreaterThan(intact.sightlines.targetCount);
  expect(repaired).toEqual(intact);
  const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
  console.log(`Parcel comparison hashes (intact, opened roof): ${digest(intact)}, ${digest(open)}`);
});
