const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
test.setTimeout(120000);
async function setup(page) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 30, cellPath: ['cell:1', 'cell:2'] }],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test laboratory', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'local-covert-tests'));
  return page.evaluate(() => {
    const d = window.helixHeresyDebug, e = d.economySnapshot(), deal = e.deals.find(o => o.commodityKind === 'manufactured' && o.offerKind === 'contract');
    const batch = d.addBlackMarketManufacturedBatch(deal.id);
    return { deal, batch, operatorId: d.economySnapshot().intercitySmuggling.operators[0].id };
  });
}
test('foreign UI confirms exact cargo, preserves local offer, and settles only after physical destination receipt across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="deals"]').click();
  const row = page.locator(`[data-black-market-deal="${f.deal.id}"]`);
  await row.getByRole('button', { name: 'Foreign quote: b' }).click();
  await expect(page.locator('[data-foreign-smuggling-quote]')).toContainText('net on receipt');
  await page.getByRole('button', { name: 'Confirm Foreign Contract' }).click();
  const accepted = await page.evaluate(() => {
    const d = window.helixHeresyDebug, before = d.economySnapshot(); d.reloadSurveyExpeditionTestState();
    return { before, after: d.economySnapshot() };
  });
  expect(accepted.after.intercitySmuggling).toEqual(accepted.before.intercitySmuggling);
  expect(accepted.after.deals.find(o => o.id === f.deal.id).status).toBe('open');
  const contract = accepted.after.contracts.find(c => c.foreignShipmentId);
  expect(contract).toBeTruthy(); expect(accepted.after.money).toBe(0);
  expect(accepted.after.intercitySmuggling.buyers[0].money).toBeLessThan(10000);
  await page.keyboard.press('B');
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), contract.id)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  const collected = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(collected.economy.contracts.find(c => c.id === contract.id).status).toBe('inTransit');
  expect(collected.economy.money).toBe(0);
  expect(collected.economy.localCovertMarket.collections[0].owner).toBe('player');
  expect(collected.physicalItemStacks.some(s => s.id === f.batch.id)).toBe(false);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.advanceStrategicServices(1800); // Loaded local courier reaches its depot; foreign convoy departs.
    const depot = d.economySnapshot();
    const saved = d.exportSurveyExpeditionTestState(); saved.strategicJourneys.routes[0].continuity = 'closed';
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(3600);
    const held = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); const reloaded = d.economySnapshot();
    const resume = d.exportSurveyExpeditionTestState(); resume.strategicJourneys.routes[0].continuity = 'continuous';
    d.importSurveyExpeditionTestState(resume); d.advanceStrategicServices(3600);
    const receipt = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); d.advanceStrategicServices(3600);
    return { depot, held, reloaded, receipt, returned: d.economySnapshot() };
  });
  expect(result.depot.intercitySmuggling.shipments[0].phase).toBe('outbound');
  expect(result.depot.localCovertMarket.collections[0].manifest).toBeNull();
  expect(result.held.intercitySmuggling.shipments[0].positionKm).toBe(0);
  expect(result.held.money).toBe(0); expect(result.reloaded.intercitySmuggling).toEqual(result.held.intercitySmuggling);
  expect(result.receipt.intercitySmuggling.shipments[0].phase).toBe('returning');
  expect(result.receipt.money).toBe(contract.payout);
  expect(result.returned.money).toBe(contract.payout);
  expect(result.returned.intercitySmuggling.shipments[0].phase).toBe('returned');
  expect(result.returned.intercitySmuggling.shipments[0].manifest.entries[0].stack.chemicalBatch.id).toBe(f.batch.chemicalBatch.id);
  expect(errors).toEqual([]);
});
test('foreign cancellation releases exact stock and refunds buyer without altering local sale terms', async ({ page }) => {
  const f = await setup(page);
  const result = await page.evaluate(f => {
    const d = window.helixHeresyDebug, quote = d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id);
    const confirmed = d.confirmForeignSmuggling(), contract = d.economySnapshot().contracts.find(c => c.foreignShipmentId);
    return { quote, confirmed, contract };
  }, f);
  expect(result.quote.ok).toBe(true); expect(result.confirmed).toBe(true);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="contracts"]').click();
  await page.locator(`[data-black-market-contract="${result.contract.id}"]`).filter({ has: page.getByRole('button', { name: 'Cancel Contract' }) }).getByRole('button', { name: 'Cancel Contract' }).click();
  const state = await page.evaluate(() => { const d = window.helixHeresyDebug; d.reloadSurveyExpeditionTestState(); return d.exportSurveyExpeditionTestState(); });
  expect(state.economy.intercitySmuggling.buyers[0].money).toBe(10000);
  expect(state.economy.intercitySmuggling.shipments[0].phase).toBe('canceled');
  expect(state.physicalItemStacks.find(s => s.id === f.batch.id).reservedTaskId).toBe('');
  expect(state.economy.deals.find(o => o.id === f.deal.id).payout).toBe(f.deal.payout);
});

test('raw foreign freight reserves exact contents, preserves receptacles and pays once at receipt', async ({ page }) => {
  const f = await setup(page);
  const deal = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find(o => o.commodityKind === 'rawByproduct' && o.offerKind === 'contract'));
  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('#marketCommandInput').fill(`byproduct ${deal.material} ${deal.amount}`);
  await page.locator('#marketCommandBtn').click();
  const accepted = await page.evaluate(({ deal, f }) => {
    const d = window.helixHeresyDebug, quote = d.requestForeignSmuggling(deal.id, f.operatorId);
    const confirmed = d.confirmForeignSmuggling(), contract = d.economySnapshot().contracts.find(c => c.foreignShipmentId);
    const dispatched = contract && d.startMarketContractDelivery(contract.id);
    return { quote, confirmed, contract, dispatched, available: d.marketAvailableByproduct(deal.material) };
  }, { deal, f });
  expect(accepted.quote.ok).toBe(true); expect(accepted.confirmed).toBe(true); expect(accepted.dispatched).toBe(true);
  expect(accepted.available).toBe(0);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: deal.material }).getByRole('button', { name: 'Finish' }).click();
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug, collected = d.exportSurveyExpeditionTestState();
    d.reloadSurveyExpeditionTestState(); d.advanceStrategicServices(1800); d.advanceStrategicServices(7200);
    const delivered = d.economySnapshot(); d.advanceStrategicServices(3600);
    return { collected, delivered, again: d.economySnapshot() };
  });
  expect(result.collected.economy.money).toBe(0);
  const manifest = result.delivered.intercitySmuggling.shipments[0].manifest;
  expect(manifest.entries.reduce((n, e) => n + e.contents.reduce((m, c) => m + c.amount, 0), 0)).toBeCloseTo(deal.amount, 3);
  for (const e of manifest.entries) expect(result.collected.physicalItemStacks.some(s => s.id === e.sourceReceptacleId)).toBe(true);
  expect(result.delivered.money).toBe(accepted.contract.payout); expect(result.again.money).toBe(result.delivered.money);
});
