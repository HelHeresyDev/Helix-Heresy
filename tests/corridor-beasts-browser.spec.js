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
  expect(errors).toEqual([]);
});
