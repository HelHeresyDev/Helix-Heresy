const { test, expect } = require('@playwright/test');
const path = require('path'), { pathToFileURL } = require('url');
test.setTimeout(150000);
async function start(page) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); }); await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 30, supportCapable: true, continuity: 'continuous' }],
    destinations: [
      { id: 'site:lab', cityId: 'a', kind: 'laboratorySite', label: 'Lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', cityId: 'a', kind: 'fortifiedCity', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', cityId: 'b', kind: 'fortifiedCity', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'local-covert-tests'));
  return page.evaluate(() => {
    const d = window.helixHeresyDebug, deal = d.economySnapshot().deals.find(o => o.commodityKind === 'specimen' && o.offerKind === 'contract');
    const slime = d.addBlackMarketSpecimen(deal.id, { revealSustenance: true, sustenance: 'organic feeder' }), pod = d.addBlackMarketTransportPod(95);
    const op = d.economySnapshot().intercitySmuggling.operators.find(o => o.biological);
    return { deal, slime, pod, op };
  });
}
async function collect(page, f) {
  const result = await page.evaluate(f => {
    const d = window.helixHeresyDebug, quote = d.requestForeignSmuggling(f.deal.id, f.op.id, f.slime.id);
    const confirmed = d.confirmForeignSmuggling(), contract = d.economySnapshot().contracts.find(c => c.foreignShipmentId);
    if (!contract) return { quote, confirmed };
    d.setMarketContractOutcome(contract.id, { transportRoll: .99, exposureRoll: 1 });
    return { quote, confirmed, contract, dispatched: d.startMarketContractDelivery(contract.id) };
  }, f);
  expect(result.quote.ok, result.quote.reason).toBe(true); expect(result.confirmed).toBe(true); expect(result.dispatched).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  return result;
}
test('foreign specimen survives exact physical handoffs and reload, then pays only on alive receipt', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await start(page), accepted = await collect(page, f);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug, collected = d.exportSurveyExpeditionTestState();
    d.reloadSurveyExpeditionTestState(); const loaded = d.economySnapshot();
    d.advanceStrategicServices(1800); const depot = d.economySnapshot();
    d.advanceStrategicServices(7200); const received = d.economySnapshot();
    d.reloadSurveyExpeditionTestState(); d.advanceStrategicServices(3600);
    return { collected, loaded, depot, received, again: d.economySnapshot() };
  });
  expect(result.collected.slimes.some(s => s.id === f.slime.id)).toBe(false);
  expect(result.collected.economy.money).toBe(0); expect(result.loaded.intercitySmuggling).toEqual(result.collected.economy.intercitySmuggling);
  expect(result.depot.money).toBe(0); expect(result.received.money).toBe(accepted.contract.payout); expect(result.again.money).toBe(result.received.money);
  const sh = result.received.intercitySmuggling.shipments[0]; expect(sh.living.outcome).toBe('received');
  expect(sh.manifest.entries.find(e => e.creature).creature.id).toBe(f.slime.id); expect(sh.owner).toBe(sh.buyerId);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-economy-category="foreignSmuggling"]')).toContainText('Handler report');
  expect(errors).toEqual([]);
});
test('unsafe shipment physically returns, refuses remote receipt, and restores the same creature into exit containment once', async ({ page }) => {
  const f = await start(page); await collect(page, f);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.advanceStrategicServices(1800);
    const saved = d.exportSurveyExpeditionTestState(); saved.economy.intercitySmuggling.shipments[0].living.powerLeft = 2;
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(5400);
    const waiting = d.economySnapshot(), id = waiting.intercitySmuggling.shipments[0].id;
    const refused = d.receiveReturnedSpecimen(id);
    return { waiting, id, refused };
  });
  expect(result.waiting.intercitySmuggling.shipments[0].phase).toBe('returnWaiting'); expect(result.refused).toBe(false);
  expect(result.waiting.money).toBe(0);
  const received = await page.evaluate(({ f, id }) => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    // Place the now-empty original container at the exit in this physical-handoff fixture.
    const c = saved.containers.find(c => c.id === f.slime.containerId); c.roomId = 'concealedExit'; c.mapCell = { ...saved.scientist.mapCell };
    d.importSurveyExpeditionTestState(saved);
    const first = d.receiveReturnedSpecimen(id), second = d.receiveReturnedSpecimen(id);
    d.reloadSurveyExpeditionTestState(); return { first, second, state: d.exportSurveyExpeditionTestState() };
  }, { f, id: result.id });
  expect(received.first).toBe(true); expect(received.second).toBe(false);
  expect(received.state.slimes.filter(s => s.id === f.slime.id)).toHaveLength(1);
  expect(received.state.slimes.find(s => s.id === f.slime.id).containerId).toBe(f.slime.containerId);
  expect(received.state.economy.money).toBe(0);
});
