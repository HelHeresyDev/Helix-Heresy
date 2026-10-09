const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Survey = require('../survey-expeditions');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.sovereignBargainSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.sovereignBargainAction(action, expected), { action, expected });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), n);
async function finishWork(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 12; n++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(0, task.dueAt - s.clock) + 1);
    }
    throw new Error('Physical work did not finish');
  });
}
async function start(page, physicalTrip = false) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'audience-test-world', siteId: 'audience-test-lab', strategicCellId: 'planet-cell:00009', seed: 'audience-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } },
    carrierSource: { strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
      cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 });
    d.configureSovereignBargainTest({ supply: 6 });
  });
  expect(await act(page, 'request')).toBe(false);
  if (physicalTrip) {
    expect(await act(page, 'pack')).toBe(true); await finishWork(page);
    for (const item of Survey.PACK_LIST.filter(i => i.required)) {
      expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), item.key)).toBe(true); await finishWork(page);
    }
    expect(await page.evaluate(() => window.helixHeresyDebug.reserveMunicipalCarrier())).toBe(true);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let n = 0; n < 8; n++) {
        const s = d.surveyExpeditionSnapshot(); if (s.carrier.location === 'laboratory') return;
        const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.carrier.journeyId);
        if (j.status === 'stranded') throw new Error('Collection stranded');
        d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
      }
      throw new Error('Collection did not arrive');
    });
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finishWork(page);
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      for (let n = 0; n < 8; n++) {
        const s = d.surveyExpeditionSnapshot(); if (s.phase === 'field') return;
        const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId);
        if (j.status === 'stranded') d.controlSurveyJourney('recover');
        else d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
      }
      throw new Error('Paid trip did not arrive');
    });
  } else await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  expect(await act(page, 'walk')).toBe(true); await finishWork(page);
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function offer(page) {
  expect(await act(page, 'request')).toBe(true);
  const pending = (await snap(page)).bargain.audience;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).bargain.audience).toEqual(pending);
  await page.evaluate(n => window.helixHeresyDebug.advanceSovereignBargainForTest(n), pending.readyAt - (await snap(page)).clock);
  expect(await act(page, 'attend')).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  await advance(page, 450); expect((await snap(page)).bargain.job.progress).toBe(450);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 450); expect((await snap(page)).bargain.terms.status).toBe('offered');
}
test('paid municipal trip carries actual parts to a queued sovereign audience, physical receipt and one saved restricted map', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page, true); const before = await snap(page);
  expect(before.stacks.filter(i => i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(6);
  expect(before.money).toBeLessThan(1000); await offer(page);
  const panel = page.locator('[data-sovereign-bargains]');
  await expect(panel).toContainText('Exceptional city defender');
  const quote = (await snap(page)).bargain.terms;
  expect(await act(page, 'sign', { ...quote, quantity: 1 })).toBe(false);
  await panel.getByRole('button', { name: 'Sign exact sovereign supply bargain', exact: true }).click();
  expect((await snap(page)).bargain.terms.status).toBe('signed');
  await panel.getByRole('button', { name: 'Hand over carried defense supplies', exact: true }).click();
  const received = await snap(page);
  expect(received.bargain.depot.stock).toBe(6); expect(received.bargain.depot.receipts).toHaveLength(1);
  expect(received.stacks.filter(i => i.carriedBy === 'scientist')).toEqual([]);
  expect(received.bargain.copies).toEqual([]); expect(received.money).toBe(before.money);
  expect(received.campaign.cityPower.mandate).toBeNull();
  expect(await act(page, 'deliver')).toBe(false);
  await panel.getByRole('button', { name: 'Prepare fulfilled restricted route extract', exact: true }).click();
  await advance(page, 150); expect((await snap(page)).bargain.copies).toEqual([]);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 150);
  const done = await snap(page); expect(done.bargain.copies).toHaveLength(1); expect(done.bargain.terms.status).toBe('fulfilled');
  await expect(panel.locator('[data-sovereign-route-copy]')).toContainText('source survey date not supplied');
  await expect(panel.locator('[data-sovereign-route-copy]')).toContainText('No resource surveys');
  expect(await act(page, 'claim')).toBe(false);
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload();
  await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(saved)), saved);
  expect((await snap(page)).bargain.copies).toEqual(done.bargain.copies);
  expect((await snap(page)).bargain.depot.receipts).toEqual(done.bargain.depot.receipts);
  expect(errors).toEqual([]);
});
test('partial cargo cannot release information, expired terms preserve receipts, and off-counter records remain dated', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); await offer(page);
  const quote = (await snap(page)).bargain.terms; expect(await act(page, 'sign', quote)).toBe(true);
  expect(await act(page, 'deliver')).toBe(false); // Six parts on the ground are not carried.
  await page.evaluate(() => window.helixHeresyDebug.configureSovereignBargainTest({ supply: 2, carried: true }));
  expect(await act(page, 'deliver')).toBe(true); expect(await act(page, 'claim')).toBe(false);
  const partial = await snap(page); expect(partial.bargain.depot.stock).toBe(2);
  expect(JSON.stringify(partial.known)).not.toMatch(/latitude|longitude|workSeconds|health/);
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  const dated = (await snap(page)).known;
  await page.evaluate(n => window.helixHeresyDebug.advanceSovereignBargainForTest(n), partial.bargain.terms.deliverBy + 1 - partial.clock);
  const expired = await snap(page); expect(expired.bargain.terms.status).toBe('expired');
  expect(expired.bargain.depot.stock).toBe(2); expect(expired.bargain.copies).toEqual([]); expect(expired.known).toEqual(dated);
  expect(await act(page, 'deliver')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).bargain.depot.receipts).toEqual(partial.bargain.depot.receipts);
  expect(errors).toEqual([]);
});
