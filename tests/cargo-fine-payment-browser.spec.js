const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const { fineFixture } = require('./helpers/cargo-fine-payment-fixture');
test('fine, commitment and prison notices persist without leaking balances or granting NPC controls', async ({ page }) => {
  test.setTimeout(180000);
  const f = fineFixture(); f.person.courtPreferences.shareNotices = true; f.untilFine('satisfied');
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
  }, 'fine-payment-ui'));
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.checkpoints = [{ id: 'gate:b', cityId: 'b', institutionId: 'court:b', jurisdiction: 'city', active: true, policy: 'Local voluntary payment only.' }];
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-fine-payment-notice]')).toHaveCount(0);
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.finePaymentNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, f.buyer.buyerService.finePaymentNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  const notices = page.locator('[data-cargo-fine-payment-notice]');
  await expect(notices).toHaveCount(3);
  await expect(notices.first()).toContainText('120 of 120 credits outstanding');
  await expect(notices.nth(1)).toContainText('120 credits paid voluntarily; 0 credits outstanding');
  await expect(notices.last()).toContainText('Fine satisfied in full');
  await expect(notices.locator('button')).toHaveCount(0);
  expect((await notices.allTextContents()).join(' ')).not.toContain('880');
  expect(await page.evaluate(() => typeof window.HelixCargoFinePayment.advance)).toBe('function');
  await expect(page.locator('[data-cargo-commitment-notice]')).toHaveCount(0);
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const planned = commitmentFixture(); planned.person.courtPreferences.shareNotices = true; planned.untilCommitment('reserved');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.commitmentNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, planned.buyer.buyerService.commitmentNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  const planning = page.locator('[data-cargo-commitment-notice]');
  await expect(planning).toHaveCount(3);
  await expect(planning.first()).toContainText('2 months finite prison');
  await expect(planning.last()).toContainText('Defendant remains free');
  await expect(planning.locator('button')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.HelixCargoCommitment.advance)).toBe('function');
  await expect(page.locator('[data-cargo-prison-notice]')).toHaveCount(0);
  const { prisonFixture } = require('./helpers/cargo-prison-fixture');
  const served = prisonFixture(); served.person.courtPreferences.shareNotices = true;
  served.untilPrison('imprisoned'); served.stepPrison(served.d.commitment.execution.termEndsAt - served.prisonClock());
  served.untilPrison('closed');
  await page.evaluate(notices => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling.buyers[0].buyerService.prisonNotices = notices;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, served.buyer.buyerService.prisonNotices);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  const prison = page.locator('[data-cargo-prison-notice]');
  await expect(prison).toHaveCount(served.buyer.buyerService.prisonNotices.length);
  await expect(prison.first()).toContainText('defendant is still free');
  await expect(prison.last()).toContainText('Free voluntary return completed');
  expect((await prison.allTextContents()).join(' ')).toContain('Finite sentence completed');
  await expect(prison.locator('button')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.HelixCargoPrison.advance)).toBe('function');
  expect(errors).toEqual([]);
});
