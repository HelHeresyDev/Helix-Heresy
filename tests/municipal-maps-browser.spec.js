const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

test('municipal copies require physical discovery and clerk work, survive reload and cannot unlock the generation globe', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'map-world', siteId: 'parcel-test', strategicCellId: 'planet-cell:00009', seed: 'map-test', publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 });
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot().service)).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('request', 'groundPlan'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('meet'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot().service)).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('walk'))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 12; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(row => !row.reason);
      if (!t) return;
      d.advanceSimulation(Math.max(0, t.dueAt - s.clock) + 1);
    }
  });
  const before = await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
  expect(before.service.officeId).toBe(before.office.id);
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-municipal-maps]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Money alone does not buy access');
  await expect(panel.locator('[data-institutional-contact]')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Introduce Yourself to the Clerk', exact: true }).click();
  await expect(panel.locator('[data-institutional-contact]')).toHaveCount(1);
  await expect(panel.locator('[data-institutional-contacts]')).toContainText('Last confirmed service location');
  const introduced = await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
  expect(introduced.office).toEqual(before.office);
  expect(introduced.service.contacts[0].personId).toBe(before.office.clerk.id);
  await expect(panel.locator('[data-municipal-map-copy]')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Request Booked return-travel brief', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Request Authorized survey-ground plan', exact: true }).click();
  const paying = await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
  expect(paying.money).toBe(before.money - 25); expect(paying.office.power).toBe(before.office.power - 1);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(300));
  const partial = await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
  expect(partial.service.job.progress).toBeCloseTo(300, 5); expect(partial.public.copies).toHaveLength(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(301));
  const done = await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
  expect(done.service.job).toBeNull(); expect(done.public.copies).toHaveLength(1);
  expect(done.service.contacts).toHaveLength(1);
  expect(done.public.copies[0].suppliedBy.personId).toBe(before.office.clerk.id);
  await expect(panel.locator('[data-institutional-contact]')).toContainText('1 retained extract(s)');
  expect(done.office.workSeconds).toBeCloseTo(before.office.workSeconds - 600, 5);
  await expect(page.locator('[data-municipal-map-copy] pre')).toContainText('V: vehicle rendezvous');
  await expect(page.locator('[data-municipal-map-copy]')).toContainText('source survey date not supplied');
  const saved = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  saved.surveyExpeditions.mapService.accessActive = false;
  await page.evaluate(value => window.helixHeresyDebug.importSurveyExpeditionTestState(value), saved);
  expect((await page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot())).public.copies).toEqual(done.public.copies);
  await expect(page.locator('[data-institutional-contact]')).toHaveCount(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot().hasMap)).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicSelectCell(0))).toBe(false);
  await expect(page.locator('#strategicWorldPreviewHeading')).toContainText('Omniscient Generation Preview');
  expect(errors).toEqual([]);
});
