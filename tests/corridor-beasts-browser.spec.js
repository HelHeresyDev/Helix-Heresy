const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const { beastFixture } = require('./helpers/corridor-beast-fixture');
test('road UI shows only received dated reports and contact requests, not hidden encounter state', async ({ page }) => {
  test.setTimeout(180000);
  const f = beastFixture(); f.safety.radio.connected = false; f.advance(500);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'intermittent', distanceKm: 30, cellPath: ['cell:1', 'cell:2'] }],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'corridor-beasts-ui'));
  await page.evaluate(market => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling = market; s.clock = 500;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, f.state);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-corridor-report]')).toHaveCount(0);
  const operator = page.locator(`[data-smuggling-operator="${f.op.id}"]`);
  await expect(operator).toContainText('No live crew');
  expect(await operator.textContent()).not.toMatch(/Rimefang|health \d|condition \d|saved-road-beast/);
  await page.getByRole('button', { name: 'Request Driver to Abandon Delivery', exact: true }).click();
  await expect(page.locator('[data-corridor-report]')).toHaveCount(0);
  const online = beastFixture(); online.advance(500);
  await page.evaluate(market => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling = market; s.clock = 500;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, online.state);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  const reports = page.locator('[data-corridor-report]');
  expect((await reports.allTextContents()).join(' ')).toContain('physical strike');
  expect((await reports.allTextContents()).join(' ')).not.toMatch(/targetId|effortSeconds|populationId/);
  await expect(reports.first()).toContainText('not live tracking');
  await page.getByRole('button', { name: 'Request Driver to Abandon Delivery', exact: true }).click();
  expect((await reports.allTextContents()).join(' ')).toContain('Driver accepts');
  const { robberyFixture } = require('./helpers/corridor-robbery-fixture');
  const captured = robberyFixture();
  require('../negotiated-release').bind(captured.state, { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  captured.until('holding'); captured.step(2);
  await page.evaluate(({ market, clock }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling = market; s.clock = clock; s.economy.money = 1000;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, { market: captured.state, clock: captured.now() });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(reports.last()).toContainText('not a lawful arrest');
  await expect(operator).toContainText('No live crew');
  expect(await operator.textContent()).not.toMatch(/refuge|holding|captured|offRoadKm/);
  const count = await reports.count();
  await page.getByRole('button', { name: 'Request Driver to Abandon Delivery', exact: true }).click();
  await expect(reports).toHaveCount(count);
  const demand = page.locator('[data-release-offer]');
  await expect(demand).toContainText('Payment is not proof');
  expect(await demand.textContent()).not.toMatch(/releaseProgress|honor|receivingAccount|genome/);
  await page.getByRole('button', { name: 'Request Supervised Proof of Life', exact: true }).click();
  await expect(page.getByText(/Supervised contact with the original crew member/)).toBeVisible();
  await page.getByRole('button', { name: 'Pay for Claimed Release', exact: true }).click();
  await expect(page.locator('[data-release-receipt]')).toContainText('Not proof of release');
  await expect(page.getByRole('button', { name: 'Pay for Claimed Release', exact: true })).toHaveCount(0);
  const paid = await page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    return { money: s.economy.money, phase: s.economy.intercitySmuggling.shipments[0].phase };
  });
  expect(paid).toEqual({ money: 680, phase: 'captured' });
  const stranded = beastFixture(); stranded.state.corridorBeasts = [];
  stranded.op.condition = 20; stranded.sh.positionKm = 1;
  require('../corridor-beasts').report(stranded.sh, stranded.op, 0, 'Driver requests assistance at the reported position.');
  await page.evaluate(market => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.intercitySmuggling = market; s.clock = 0; s.economy.money = 1000;
    d.importSurveyExpeditionTestState(s); d.reloadSurveyExpeditionTestState();
  }, stranded.state);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await page.getByRole('button', { name: 'Request Roadside Assistance Quote', exact: true }).click();
  const recoveryOffer = page.locator('[data-assistance-quote]');
  await expect(recoveryOffer).toContainText('not tracking or guaranteed recovery');
  expect(await recoveryOffer.textContent()).not.toMatch(/medicalPacks|repairParts|willing|health/);
  await page.getByRole('button', { name: 'Reserve Paid Recovery Attempt', exact: true }).click();
  await expect(page.locator('[data-assistance-report]').last()).toContainText('fee held until departure');
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().economy.money)).toBe(814);
  await page.getByRole('button', { name: 'Cancel Undispatched Recovery', exact: true }).click();
  await expect(page.locator('[data-assistance-report]').last()).toContainText('refunded');
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().economy.money)).toBe(1000);
  expect(await page.evaluate(() => typeof window.HelixCorridorRobbery.tick)).toBe('function');
  expect(errors).toEqual([]);
});
