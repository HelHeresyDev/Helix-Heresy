const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const { threatFixture } = require('./helpers/cargo-threat-fixture');
test('consented threat review and release notices persist without private intent or NPC controls', async ({ page }) => {
  test.setTimeout(180000);
  const f = threatFixture(); f.person.courtPreferences.shareNotices = true; f.until('closed');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 30, cellPath: ['cell:1', 'cell:2'] }],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'threat-notice-ui'));
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.checkpoints = [{ id: 'gate:b', cityId: 'b', jurisdiction: 'city', active: true, policy: 'Local review only.' }];
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-appearance-notice]')).toHaveCount(0);
  await page.evaluate(({ notices, availability }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const service = s.economy.intercitySmuggling.buyers[0].buyerService;
    service.appearanceNotices = notices; service.availabilityNotices = availability;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, { notices: f.buyer.buyerService.appearanceNotices, availability: f.buyer.buyerService.availabilityNotices });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  const notices = page.locator('[data-cargo-appearance-notice]');
  await expect(notices).toHaveCount(f.buyer.buyerService.appearanceNotices.length);
  expect((await notices.allTextContents()).join(' ')).toContain('separate immediate-threat review');
  await expect(notices.last()).toContainText('no continuing custody');
  await expect(notices.locator('button')).toHaveCount(0);
  expect((await notices.allTextContents()).join(' ')).not.toContain('threatPreferences');
  await expect(page.locator('[data-cargo-appearance-availability]')).toContainText('not live location tracking');
  expect(await page.evaluate(() => typeof window.HelixCargoThreats.supported)).toBe('function');
  expect(errors).toEqual([]);
});
