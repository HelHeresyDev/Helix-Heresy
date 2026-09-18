// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
test.setTimeout(60000);

async function startRun(page, localDistanceKm = 8) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.goto(appUrl);
  await page.evaluate((localDistanceKm) => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test laboratory', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'commodity-exchange-tests'), localDistanceKm);
}

test('visitors require physical arrival and official visits cannot be cancelled remotely', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const courier = debug.scheduleSiteVisit('routineCourier', { arrivalAt: 10000 });
    const inspector = debug.scheduleSiteVisit('environmentalInspector', { arrivalAt: 20000 });
    const journeys = debug.strategicJourneysSnapshot().journeys;
    const courierJourney = journeys.find((journey) => journey.subject.id === courier.id);
    const inspectorJourney = journeys.find((journey) => journey.subject.id === inspector.id);
    return { courier, inspector, cancelled: debug.cancelStrategicJourney(courierJourney.id), officialCancelled: debug.cancelStrategicJourney(inspectorJourney.id) };
  });
  expect(result.cancelled).toBe(true);
  expect(result.officialCancelled).toBe(false);
  const courier = await page.evaluate(() => window.helixHeresyDebug.scheduleSiteVisit('routineCourier', { arrivalAt: 0 }));
  let visit = await page.evaluate((id) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === id), courier.id);
  expect(visit.phase).toBe('scheduled');
  expect(visit.actor.present).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(86400));
  visit = await page.evaluate((id) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === id), courier.id);
  expect(visit.phase).not.toBe('scheduled');
  expect(visit.actor.present).toBe(true);
  const cancelled = await page.evaluate((id) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === id), result.courier.id);
  expect(cancelled.actor.present).toBe(false);
});

test('licensed waste waits for its carrier then retains outbound cargo and permanent custody', async ({ page }) => {
  await startRun(page, 150);
  const created = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    debug.setMarketCash(1000);
    const stack = debug.addContainedEvidenceWasteForTest({ amount: 3 });
    const task = debug.queueEvidenceHandling(stack.id, 'dispose');
    return { stack, task };
  });
  expect(created.task?.data.pickupJourneyId).toBeTruthy();
  await page.evaluate((at) => window.helixHeresyDebug.advanceStrategicServices(at + 1), created.task.dueAt);
  let result = await page.evaluate(() => ({ handling: window.helixHeresyDebug.evidenceHandlingSnapshot(), money: window.helixHeresyDebug.economySnapshot().money }));
  expect(result.handling.stacks.some((stack) => stack.id === created.stack.id)).toBe(true);
  expect(result.handling.manifests).toHaveLength(0);
  expect(result.money).toBe(1000);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(86400));
  result = await page.evaluate(() => ({ handling: window.helixHeresyDebug.evidenceHandlingSnapshot(), money: window.helixHeresyDebug.economySnapshot().money }));
  expect(result.handling.stacks.some((stack) => stack.id === created.stack.id)).toBe(false);
  expect(result.handling.manifests.at(-1)).toMatchObject({ subjectId: created.stack.id });
  expect(result.money).toBe(1000 - created.task.data.fee);
  const transfer = await page.evaluate(() => window.helixHeresyDebug.strategicJourneysSnapshot().journeys.find((journey) => journey.subject.kind === 'wasteTransfer'));
  expect(transfer).toMatchObject({ originId: 'site:lab', destinationId: 'city:a', status: 'scheduled', capacity: { cargo: created.stack.quantity } });
});

test('stranded paid freight remains in carrier custody until physical recovery', async ({ page }) => {
  await startRun(page);
  const booked = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const network = debug.strategicJourneysSnapshot();
    let seed = '';
    for (let index = 0; index < 10000; index += 1) {
      const candidate = `stranded-freight-${index}`;
      const preview = window.HelixStrategicJourneys.createJourney(network, {
        seed: `${candidate}:commodityConsignment:legal-consignment-1`,
        originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad'
      });
      if (preview.journey.route.legs[0].interruption?.kind === 'stranding') { seed = candidate; break; }
    }
    if (!seed) throw new Error('No deterministic stranded fixture found');
    debug.setStrategicServiceTestNetwork(network, seed);
    debug.setMarketCash(1000);
    return debug.buyCommodity('steelPanels', 3);
  });
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(86400));
  let result = await page.evaluate(() => ({ market: window.helixHeresyDebug.commodityMarketSnapshot(), journeys: window.helixHeresyDebug.strategicJourneysSnapshot() }));
  const journey = result.journeys.journeys.find((entry) => entry.subject.kind === 'commodityConsignment');
  expect(journey).toMatchObject({ status: 'stranded', capacity: { cargo: 3 } });
  expect(result.market.consignments.at(-1).status).toBe('inTransit');
  expect(result.market.money).toBe(1000 - booked.total);
  expect(await page.evaluate((id) => window.helixHeresyDebug.recoverStrategicJourney(id), journey.id)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(86400));
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(360));
  result = await page.evaluate(() => ({ market: window.helixHeresyDebug.commodityMarketSnapshot(), journeys: window.helixHeresyDebug.strategicJourneysSnapshot() }));
  expect(result.market.consignments.at(-1).status).toBe('received');
  expect(result.market.money).toBe(1000 - booked.total);
});

test('city-local exchange preserves its baseline, charts and orders through save/load', async ({ page }) => {
  await startRun(page);
  const facts = { cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Aster' }, primaryExploitation: { id: 'ferrousOre', label: 'Ferrous Ore' }, arableLandBand: 'abundant' }], satellites: [] }, current: { playableYear: 500, cityRows: [{ cityId: 'a', physicalCondition: 'damaged', populationBand: 'immense', services: { utilities: 'strained' } }], satelliteRows: [] } };
  const initialized = await page.evaluate(f => window.helixHeresyDebug.configureCityCommodityMarketForTest(f), facts);
  expect(initialized.cityContext.cityId).toBe('a');
  expect(initialized.listings.steelPanels.supply).toBe(initialized.cityContext.listings.steelPanels.targetSupply);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="exchange"]').click();
  await expect(page.locator('[data-city-commodity-context="a"]')).toContainText('Aster local exchange');
  await expect(page.locator('[data-commodity-listing="steelPanels"]')).toContainText('Ferrous Ore');
  const before = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  await expect(page.locator('[data-commodity-chart]')).toHaveCount(Object.keys(before.market.listings).length);
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(10000));
  await page.evaluate(() => window.helixHeresyDebug.buyCommodity('steelPanels', 2));
  const bought = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(bought.market.listings.steelPanels.supply).toBe(before.market.listings.steelPanels.supply - 2);
  expect(bought.quotes.steelPanels.ask).toBeGreaterThan(before.quotes.steelPanels.ask);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const loaded = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(loaded.market).toEqual(bought.market); expect(loaded.consignments).toMatchObject(bought.consignments);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(6 * 3600 + 1));
  const advanced = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(advanced.market.cityContext).toEqual(initialized.cityContext);
  expect(advanced.market.listings.steelPanels.history.length).toBeGreaterThan(loaded.market.listings.steelPanels.history.length);
});

test('local production reaches exchange only after input processing and physical receipt', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityCommodityMarketForTest({ cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Quarry City' }, primaryExploitation: { id: 'constructionStone', label: 'Stone' } }], satellites: [] }, current: { cityRows: [{ cityId: 'a', physicalCondition: 'intact', services: { utilities: 'functional' } }], satelliteRows: [] } }));
  const before = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(3 * 3600));
  let current = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(current.market.listings.stoneBlocks.supply).toBe(before.market.listings.stoneBlocks.supply);
  expect(current.market.localProduction.inputs.constructionStone).toBeGreaterThan(0);
  expect(current.market.localProduction.workshops[0].produced).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).market.localProduction).toEqual(current.market.localProduction);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(3 * 3600));
  current = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(current.market.localProduction.receipts.some(r => r.cargo === 'stoneBlocks' && r.target === 'exchange')).toBe(true);
  expect(current.market.listings.stoneBlocks.supply).toBeGreaterThan(before.market.listings.stoneBlocks.supply);
  expect(current.market.listings.assayReagent.supply).toBeLessThan(before.market.listings.assayReagent.supply);
  expect(current.market.localProduction.trucks).toHaveLength(2);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="exchange"]').click();
  await expect(page.locator('[data-commodity-listing="assayReagent"]')).toContainText('No supported local producer');
  await page.locator('[data-economy-menu-tab="freight"]').click();
  await expect(page.locator('[data-local-production="a"]')).toContainText('2 persistent producer trucks');
});

test('industrial consumables expose saved factories, funded procurement and physical receipts in the exchange', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityCommodityMarketForTest({
    cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Industrial City' }, primaryExploitation: { id: 'industrialMinerals' }, secondaryExploitation: { id: 'chemicalFeedstock' } }], satellites: [] },
    current: { cityRows: [{ cityId: 'a', physicalCondition: 'intact', services: { utilities: 'functional', transport: 'functional' } }] },
    capabilities: { cityProfiles: [{ city: { id: 'a' }, deployedCapabilityIds: ['standardManaPower', 'industrialFabrication'] }], milestones: [{ capability: { id: 'industrialFabrication' }, institution: { roles: ['precisionManufacturing', 'chemicalIndustry'] }, infrastructureSites: [{ id: 'a:industrial-site', cityId: 'a', function: 'industrialWorks', operationalAtPlayableYear: true }] }] }
  }));
  const initial = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(initial.market.localProduction.facilities).toHaveLength(3);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(4 * 3600));
  const purchased = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(purchased.market.localProduction.finance.spent).toBeGreaterThan(0);
  expect(purchased.money).toBe(initial.money);
  expect(purchased.consignments).toHaveLength(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).market.localProduction).toEqual(purchased.market.localProduction);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(20 * 3600));
  const produced = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(produced.market.localProduction.finance.earned).toBeGreaterThan(0);
  expect(produced.market.localProduction.receipts.some(r => r.target === 'exchange' && ['glass', 'rubber', 'medicalBandage'].includes(r.cargo))).toBe(true);
  expect(produced.money).toBe(initial.money);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="freight"]').click();
  await expect(page.locator('[data-manufacturing-facility="a:glassworks"]')).toContainText('glassworking');
  await expect(page.locator('[data-manufacturing-finance="a"]')).toContainText('sale proceeds settle only on physical delivery');
  await expect(page.locator('[data-local-production="a"]')).toContainText('3 industrial facilities');
  await page.locator('[data-economy-menu-tab="exchange"]').click();
  await expect(page.locator('[data-commodity-listing="relayBattery"]')).toContainText('No supported local producer');
});

test('precision components support paid delivery, standing orders, physical storage and exact sale reservations', async ({ page }) => {
  await startRun(page);
  const booked = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setMarketCash(5000);
    const initial = d.physicalStockSnapshot();
    const buy = d.buyCommodity('refinedConductors', 2);
    const limit = d.createCommodityBuyOrder('preparedManaCrystals', { quantity: 1, limitPrice: 1000, protectedCash: 500 });
    const maintain = d.createCommodityBuyOrder('relayAssembly', { kind: 'maintainStock', quantity: 1, targetQuantity: 1, limitPrice: 1000, protectedCash: 500, maxOutstanding: 6 });
    return { initial, buy, limit, maintain, market: d.commodityMarketSnapshot() };
  });
  expect(booked.initial.stacks.some(s => ['refinedConductors', 'preparedManaCrystals', 'relayAssembly'].includes(s.key))).toBe(false);
  expect(booked.buy.filled).toBe(2); expect(booked.limit.order.listingId).toBe('preparedManaCrystals'); expect(booked.maintain.order.kind).toBe('maintainStock');
  expect(booked.market.consignments.filter(s => s.listingId === 'relayAssembly')).toHaveLength(1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).consignments).toMatchObject(booked.market.consignments);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(86400));
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(360));
  const result = await page.evaluate(() => ({ market: window.helixHeresyDebug.commodityMarketSnapshot(), stock: window.helixHeresyDebug.physicalStockSnapshot() }));
  const stack = result.stock.stacks.find(s => s.key === 'refinedConductors');
  expect(stack).toMatchObject({ section: 'resources', quantity: 2, roomId: 'surfaceLoadingBay', unitMassKg: 0.3, unitVolumeL: 0.2 });
  expect(result.market.consignments.filter(s => s.listingId === 'relayAssembly')).toHaveLength(1);
  const sale = await page.evaluate(({ id, bid }) => window.helixHeresyDebug.createCommoditySellOrder('refinedConductors', 1, bid, id), { id: stack.id, bid: result.market.quotes.refinedConductors.bid });
  expect(sale.order).toMatchObject({ stackId: stack.id, listingId: 'refinedConductors' });
  expect(await page.evaluate(id => window.helixHeresyDebug.physicalStockSnapshot().stacks.find(s => s.id === id).reservedTaskId, stack.id)).toBe(sale.order.id);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="exchange"]').click();
  await expect(page.locator('.commodity-listing-card[data-commodity-listing="relayAssembly"]')).toContainText('Calibrated Relay Assembly');
});

test('precision city factories produce charged equipment through saved component procurement and delivery', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityCommodityMarketForTest({
    cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Relay City' }, primaryExploitation: { id: 'baseMetalOre' }, secondaryExploitation: { id: 'chemicalFeedstock' } }], satellites: [] },
    current: { cityRows: [{ cityId: 'a', physicalCondition: 'intact', services: { utilities: 'functional', transport: 'functional' } }] },
    capabilities: { cityProfiles: [{ city: { id: 'a' }, deployedCapabilityIds: ['industrialFabrication', 'standardManaPower', 'regionalDataRelays'] }], milestones: [
      ['industrialFabrication', 'industrialWorks', ['precisionManufacturing', 'chemicalIndustry']], ['standardManaPower', 'powerWorks', ['powerEngineering']], ['regionalDataRelays', 'regionalRelayHub', ['relayEngineering']]
    ].map(([id, fn, roles]) => ({ capability: { id }, institution: { roles }, infrastructureSites: [{ id: `a:${fn}`, cityId: 'a', function: fn, operationalAtPlayableYear: true }] })) }
  }));
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(48 * 3600));
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  const producer = snapshot.market.localProduction;
  expect(producer.workshops.find(w => w.id === 'satelliteCommunicator').produced).toBeGreaterThan(0);
  expect(producer.finance.spent).toBeGreaterThan(0);
  expect(producer.receipts.some(r => r.target === 'exchange' && r.cargo === 'satelliteCommunicator')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).market.localProduction).toEqual(producer);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="freight"]').click();
  await expect(page.locator('[data-manufacturing-facility="a:electronicsWorks"]')).toContainText('relayFabrication');
  await expect(page.locator('[data-manufacturing-facility="a:batteryWorks"]')).toContainText('batteryFabrication');
});

async function prepareCommissionedImport(page) {
  await startRun(page);
  return page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureCityCommodityMarketForTest({ cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Home' } }], satellites: [] }, current: null });
    d.setMarketCash(10000);
    const foreign = JSON.parse(JSON.stringify(d.commodityMarketSnapshot().market.cityContext));
    foreign.cityId = 'b'; foreign.cityName = 'Neighbor'; foreign.listings.refinedConductors.targetSupply = 120;
    const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 38, supportCapable: true, continuity: 'operational' };
    d.configureIntercityTradeForTest({ profiles: [foreign], routes: [route], permissions: [{ corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }] });
    return d.commodityMarketSnapshot();
  });
}

test('commissioned imports keep ownership across both delivery stages, escrow, reload and maintain-stock', async ({ page }) => {
  test.setTimeout(120000);
  const initial = await prepareCommissionedImport(page);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="exchange"]').click();
  const form = page.locator('[data-commissioned-imports="imports"]');
  await form.getByLabel('Import commodity').selectOption('refinedConductors');
  await form.locator('input[type="number"]').fill('2');
  await form.getByRole('button', { name: 'Request Import Quote', exact: true }).click();
  const quoted = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  const q = quoted.market.importOffer;
  expect(q.ok).toBe(true); expect(q.quantity).toBe(2); expect(quoted.money).toBe(initial.money);
  expect(quoted.market.intercityTrade.shipments).toHaveLength(0);
  await expect(form).toContainText('no automatic refund');
  await form.getByRole('button', { name: 'Confirm Import', exact: true }).click();
  const accepted = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.createCommodityBuyOrder('refinedConductors', { kind: 'maintainStock', targetQuantity: 2, quantity: 2, limitPrice: 1000, maxOutstanding: 6 });
    return d.commodityMarketSnapshot();
  });
  expect(accepted.money).toBe(initial.money - q.total); expect(accepted.consignments).toHaveLength(1);
  expect(accepted.consignments[0]).toMatchObject({ status: 'awaitingIntercity', quantity: 2, localFreightEscrow: q.localFreight });
  expect(accepted.market.intercityTrade.shipments[0].escrow).toBe(q.intercityFreight);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const loaded = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(loaded.market).toEqual(accepted.market); expect(loaded.consignments).toMatchObject(accepted.consignments);
  expect((await page.evaluate(() => window.helixHeresyDebug.confirmCommissionedImport())).ok).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(4 * 3600));
  const depot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(depot.market.intercityTrade.shipments[0]).toMatchObject({ delivered: true, handedOff: true, escrow: 0, owner: 'player' });
  expect(depot.market.listings.refinedConductors.supply).toBe(initial.market.listings.refinedConductors.supply);
  expect(depot.consignments[0]).toMatchObject({ status: 'inTransit', localFreightEscrow: q.localFreight });
  expect(depot.carrier.support.revenue).toBe(0);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, net = d.strategicJourneysSnapshot();
    const journey = net.journeys.find(j => j.subject.kind === 'commodityConsignment');
    d.advanceStrategicServices(journey.exactArrivalAt - net.clock);
  });
  const arrived = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(arrived.consignments[0]).toMatchObject({ status: 'unloading', localFreightEscrow: 0 });
  expect(arrived.carrier.support.revenue).toBe(q.localFreight);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(360));
  const final = await page.evaluate(() => ({ market: window.helixHeresyDebug.commodityMarketSnapshot(), stock: window.helixHeresyDebug.physicalStockSnapshot() }));
  expect(final.market.consignments).toHaveLength(1); expect(final.market.consignments[0].status).toBe('received');
  expect(final.market.money).toBe(initial.money - q.total);
  expect(final.stock.stacks.filter(s => s.key === 'refinedConductors').reduce((n, s) => n + s.quantity, 0)).toBe(2);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).carrier.support.revenue).toBe(q.localFreight);
});

test('commissioned import confirmation refuses changed access without charging or allocating', async ({ page }) => {
  const initial = await prepareCommissionedImport(page);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    const offer = d.requestCommissionedImport('wholesaler:ab', 'refinedConductors', 2);
    d.reloadSurveyExpeditionTestState();
    const restoredOffer = d.commodityMarketSnapshot().market.importOffer;
    const net = d.strategicJourneysSnapshot(); net.routes[0].supportCapable = false;
    d.setStrategicServiceTestNetwork(net, 'commodity-exchange-tests');
    return { offer, restoredOffer, result: d.confirmCommissionedImport(), market: d.commodityMarketSnapshot() };
  });
  expect(result.restoredOffer).toEqual(result.offer);
  expect(result.offer.ok).toBe(true); expect(result.result.ok).toBe(false);
  expect(result.market.money).toBe(initial.money); expect(result.market.consignments).toHaveLength(0);
  expect(result.market.market.intercityTrade.shipments).toHaveLength(0);
});

test('neighbor wholesale stays separate from player property and persists until physical import arrival', async ({ page }) => {
  await startRun(page);
  const initial = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureCityCommodityMarketForTest({ cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Home' } }], satellites: [] }, current: null });
    d.setMarketCash(100000); d.buyCommodity('steelPanels', 999);
    const home = d.commodityMarketSnapshot(), foreign = JSON.parse(JSON.stringify(home.market.cityContext));
    foreign.cityId = 'b'; foreign.cityName = 'Neighbor'; foreign.listings.steelPanels.targetSupply = 120;
    foreign.productionSources = []; foreign.workshopCapacity = 0;
    d.configureIntercityTradeForTest({ profiles: [foreign], routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 38, supportCapable: true, continuity: 'operational', cellPath: ['a1', 'b1'] }], permissions: [{ corridorId: 'ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }] });
    d.advanceStrategicServices(3600);
    return d.commodityMarketSnapshot();
  });
  expect(initial.market.intercityTrade.shipments[0]).toMatchObject({ good: 'steelPanels', destinationId: 'a', delivered: false });
  expect(initial.market.listings.steelPanels.supply).toBe(0);
  expect(initial.consignments).toHaveLength(1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const loaded = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(loaded.market.intercityTrade).toEqual(initial.market.intercityTrade);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(4 * 3600));
  const after = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(after.market.intercityTrade.shipments[0].delivered).toBe(true);
  expect(after.market.listings.steelPanels.supply).toBeGreaterThan(0);
  expect(after.money).toBe(initial.money); expect(after.consignments).toHaveLength(1);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="freight"]').click();
  await expect(page.locator('[data-intercity-operator="wholesaler:ab"]')).toContainText('Endpoint permits');
});

test('legal exchange renders saved stock charts and deterministic bid/ask history', async ({ page }) => {
  await startRun(page);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="exchange"]').click();

  await expect(page.locator('[data-commodity-listing]')).toHaveCount(20);
  await expect(page.locator('[data-commodity-chart]')).toHaveCount(20);
  await expect(page.locator('[data-commodity-chart="biomass"]')).toHaveAttribute('role', 'img');
  await expect(page.locator('[data-commodity-listing="biomass"]')).toContainText('Bid');
  await expect(page.locator('[data-commodity-listing="biomass"]')).toContainText('Ask');

  const before = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(before.quotes.biomass.ask).toBeGreaterThan(before.quotes.biomass.bid);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(6 * 60 * 60 + 1));
  const after = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(after.market.listings.biomass.history).toHaveLength(2);
  expect(after.market.listings.biomass.history[1].at).toBe(6 * 60 * 60);
});

test('@smoke market buys become paid inbound Loading Bay freight and affect public supply', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(1000));
  const before = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  const result = await page.evaluate(() => window.helixHeresyDebug.buyCommodity('steelPanels', 3));
  expect(result.filled).toBe(3);

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.money).toBe(1000 - result.total);
  expect(snapshot.market.listings.steelPanels.supply).toBeCloseTo(before.market.listings.steelPanels.supply - 3, 4);
  expect(snapshot.consignments.at(-1)).toMatchObject({ direction: 'inbound', listingId: 'steelPanels', quantity: 3, status: 'inTransit' });

  const inboundArrival = await page.evaluate((consignmentId) => {
    const journeys = window.helixHeresyDebug.strategicJourneysSnapshot();
    return journeys.journeys.find((journey) => journey.subject.kind === 'commodityConsignment' && journey.subject.id === consignmentId).exactArrivalAt;
  }, snapshot.consignments.at(-1).id);
  await page.evaluate((arrivalAt) => {
    const clock = window.helixHeresyDebug.strategicJourneysSnapshot().clock;
    window.helixHeresyDebug.advanceStrategicServices(Math.max(0, arrivalAt - clock));
  }, inboundArrival);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.consignments.at(-1).status).toBe('unloading');
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(6 * 60));

  const final = await page.evaluate(() => ({
    market: window.helixHeresyDebug.commodityMarketSnapshot(),
    stacks: window.helixHeresyDebug.physicalStockSnapshot().stacks,
    visuals: window.helixHeresyDebug.physicalItemVisualSnapshot(),
  }));
  expect(final.market.consignments.at(-1).status).toBe('received');
  expect(final.market.businessReputation).toBeGreaterThan(0);
  expect(final.stacks.some((stack) => stack.section === 'resources' && stack.key === 'steelPanels' && stack.roomId === 'surfaceLoadingBay' && stack.quantity === 3)).toBe(true);
  expect(final.visuals.find((stack) => stack.section === 'resources' && stack.key === 'steelPanels' && stack.roomId === 'surfaceLoadingBay')).toMatchObject({
    tags: expect.arrayContaining(['legalfreight']),
    visualKey: 'item.surface.freight.lawful',
  });
});

test('maintain-stock buys only the deficit and respects a protected cash floor', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(1000));
  const quote = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().quotes.assayReagent);
  const created = await page.evaluate(({ limit }) => window.helixHeresyDebug.createCommodityBuyOrder('assayReagent', {
    kind: 'maintainStock', targetQuantity: 15, quantity: 15, limitPrice: limit, protectedCash: 500, maxOutstanding: 2,
  }), { limit: quote.ask });
  expect(created.order.kind).toBe('maintainStock');

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  const inbound = snapshot.consignments.filter((entry) => entry.listingId === 'assayReagent' && entry.direction === 'inbound');
  expect(inbound).toHaveLength(1);
  expect(inbound[0].quantity).toBe(3);
  expect(snapshot.money).toBeGreaterThanOrEqual(500);
  expect(snapshot.orders.at(-1).status).toBe('open');
});

test('finite exchange queue preserves owned stock through reload and waits for empty returns', async ({ page }) => {
  await startRun(page);
  const setup = await page.evaluate(() => {
    const d = window.helixHeresyDebug, network = d.strategicJourneysSnapshot();
    let seed;
    for (let i = 0; i < 1000; i++) {
      const candidate = `finite-carrier-${i}`;
      const clear = ['commodityConsignment', 'commodityReturn'].every(kind => [1, 2].every(n => {
        const j = window.HelixStrategicJourneys.createJourney(network, { seed: `${candidate}:${kind}:legal-consignment-${n}`, originId: kind === 'commodityReturn' ? 'site:lab' : 'city:a', destinationId: kind === 'commodityReturn' ? 'city:a' : 'site:lab', modeId: 'hiredFreightRoad' }).journey;
        return j.route.legs.every(l => !l.interruption);
      }));
      if (clear) { seed = candidate; break; }
    }
    if (!seed) throw new Error('No clear route seed');
    d.setStrategicServiceTestNetwork(network, seed); d.setMarketCash(100000);
    d.buyCommodity('steelPanels', 1); d.buyCommodity('stoneBlocks', 1);
    const owned = d.physicalStockSnapshot().stacks.filter(s => s.section === 'resources' && s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
    d.createCommodityBuyOrder('assayReagent', { kind: 'maintainStock', quantity: 1, targetQuantity: owned + 1, limitPrice: 10000, maxOutstanding: 6 });
    return d.commodityMarketSnapshot();
  });
  expect(setup.carrier.vehicles.filter(v => !v.recovery && v.assignment)).toHaveLength(2);
  expect(setup.consignments).toHaveLength(3);
  expect(setup.consignments[2]).toMatchObject({ status: 'awaitingCarrier', journeyId: '', quantity: 1 });
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  let current = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.processCommodityOrders(); return d.commodityMarketSnapshot();
  });
  expect(current.carrier).toEqual(setup.carrier);
  expect(current.consignments).toHaveLength(3);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.strategicJourneysSnapshot();
    d.advanceStrategicServices(Math.max(...s.journeys.filter(j => j.subject.kind === 'commodityConsignment').map(j => j.exactArrivalAt)) - s.clock);
    d.advanceStrategicServices(360);
  });
  current = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(current.consignments.slice(0, 2).every(c => c.status === 'received' && c.carrierBusy && c.returnJourneyId)).toBe(true);
  expect(current.consignments[2].status).toBe('awaitingCarrier');
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.strategicJourneysSnapshot();
    d.advanceStrategicServices(Math.max(...s.journeys.filter(j => j.subject.kind === 'commodityReturn').map(j => j.exactArrivalAt)) - s.clock);
  });
  current = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(current.consignments[2].status).toBe('inTransit');
  expect(current.carrier.vehicles).toHaveLength(3);
  expect(current.carrier.vehicles.slice(0, 2).every(v => v.fuelKm === 184)).toBe(true);
  expect(current.money).toBe(setup.money);
});

test('unavailable named driver pauses a paid convoy without conjuring delivery', async ({ page }) => {
  await startRun(page);
  const setup = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setMarketCash(1000); d.buyCommodity('steelPanels', 1);
    const market = d.commodityMarketSnapshot(), vehicle = market.carrier.vehicles.find(v => v.assignment);
    d.setExchangeCarrierTestCondition(vehicle.id, 100, 0);
    d.advanceStrategicServices(86400);
    return { vehicleId: vehicle.id, before: market, after: d.commodityMarketSnapshot(), journeys: d.strategicJourneysSnapshot() };
  });
  expect(setup.after.consignments[0].status).toBe('inTransit');
  expect(setup.after.consignments[0].delay).toContain('driver unavailable');
  expect(setup.after.money).toBe(setup.before.money);
  expect(setup.after.carrier.vehicles[0].fuelKm).toBe(200);
  expect(setup.journeys.journeys.find(j => j.subject.kind === 'commodityConsignment').status).toBe('scheduled');
  await page.evaluate(id => {
    const d = window.helixHeresyDebug;
    d.setExchangeCarrierTestCondition(id, 100, 100);
    d.advanceStrategicServices(86400); d.advanceStrategicServices(360);
  }, setup.vehicleId);
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).consignments[0].status).toBe('received');
});

test('bounded depot fills partially and a triggered sale waits on its reserved stack', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setMarketCash(100000);
    const fills = ['biomass', 'stoneBlocks', 'steelPanels'].map(id => d.buyCommodity(id, 999).filled);
    const before = d.commodityMarketSnapshot();
    const refused = d.buyCommodity('assayReagent', 1);
    const stack = d.physicalStockSnapshot().stacks.find(s => s.section === 'resources' && s.key === 'stoneBlocks' && s.quantity >= 2);
    const sale = d.createCommoditySellOrder('stoneBlocks', 2, 0, stack.id);
    return { fills, before, refused, sale, after: d.commodityMarketSnapshot(), stack: d.physicalStockSnapshot().stacks.find(s => s.id === stack.id), journeys: d.strategicJourneysSnapshot() };
  });
  expect(result.fills).toEqual([48, 48, 48]);
  expect(result.refused.filled).toBe(0);
  expect(result.refused.reason).toContain('depot');
  expect(result.after.money).toBe(result.before.money);
  expect(result.after.consignments.at(-1)).toMatchObject({ status: 'awaitingCarrier', direction: 'outbound', journeyId: '' });
  expect(result.stack.reservedTaskId).toBe(result.sale.order.id);
  expect(result.journeys.journeys.filter(j => j.subject.kind === 'commodityPickup')).toHaveLength(0);
  expect(result.after.carrier.vehicles.filter(v => !v.recovery && v.assignment)).toHaveLength(2);
});

test('carrier support resupply persists through reload without changing locked customer charges', async ({ page }) => {
  await startRun(page);
  const initial = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setMarketCash(1000);
    const buy = d.buyCommodity('steelPanels', 1);
    const before = d.commodityMarketSnapshot();
    d.configureExchangeSupportForTest({ fuelReserveKm: 0, parts: 0 });
    d.advanceStrategicServices(0);
    return { buy, before, after: d.commodityMarketSnapshot() };
  });
  expect(initial.after.carrier.support.supplier.shipment).toMatchObject({ delivered: false, fuelKm: 600, parts: 12 });
  expect(initial.after.carrier.fuelReserveKm).toBe(0);
  expect(initial.after.money).toBe(initial.before.money);
  expect(initial.after.consignments[0].total).toBe(initial.buy.total);
  expect(initial.after.carrier.support.revenue).toBe(initial.buy.consignment.freightFee);
  expect(initial.after.quotes.steelPanels.freightPerUnit).toBeGreaterThan(initial.before.quotes.steelPanels.freightPerUnit);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  const loaded = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(loaded.carrier).toEqual(initial.after.carrier);
  await page.evaluate(arrival => {
    const d = window.helixHeresyDebug;
    d.advanceStrategicServices(arrival - d.strategicJourneysSnapshot().clock);
  }, loaded.carrier.support.supplier.shipment.arriveAt);
  const delivered = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(delivered.carrier.fuelReserveKm).toBe(600);
  expect(delivered.carrier.support.parts).toBe(12);
  expect(delivered.money).toBe(initial.before.money);
  expect(delivered.consignments[0].unitPrice).toBe(initial.buy.consignment.unitPrice);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="freight"]').click();
  await expect(page.locator('[data-exchange-carrier-support="operator"]')).toContainText('Cargo delivered; truck returning');
});

test('limit sells reserve an exact physical stack and settle only after carrier arrival', async ({ page }) => {
  await startRun(page);
  const setup = await page.evaluate(() => {
    const market = window.helixHeresyDebug.commodityMarketSnapshot();
    const stack = window.helixHeresyDebug.physicalStockSnapshot().stacks.find((entry) => entry.section === 'resources' && entry.key === 'stoneBlocks' && entry.quantity >= 2);
    return { bid: market.quotes.stoneBlocks.bid, supply: market.market.listings.stoneBlocks.supply, stackId: stack.id, money: market.money };
  });
  const created = await page.evaluate(({ bid, stackId }) => window.helixHeresyDebug.createCommoditySellOrder('stoneBlocks', 2, bid, stackId), setup);
  expect(created.order).toMatchObject({ kind: 'limitSell', stackId: setup.stackId, quantity: 2, status: 'executing' });

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.money).toBe(setup.money);
  expect(snapshot.consignments.at(-1)).toMatchObject({ direction: 'outbound', stackId: setup.stackId, status: 'dispatching' });
  const reserved = await page.evaluate((stackId) => window.helixHeresyDebug.physicalStockSnapshot().stacks.find((stack) => stack.id === stackId), setup.stackId);
  expect(reserved.reservedTaskId).toBe(created.order.id);
  await page.evaluate(() => {
    const saved = window.helixHeresyDebug.strategicJourneysSnapshot();
    const pickup = saved.journeys.find((journey) => journey.subject.kind === 'commodityPickup');
    window.helixHeresyDebug.advanceStrategicServices(pickup.exactArrivalAt - saved.clock);
  });

  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(6 * 60));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.consignments.at(-1).status).toBe('inTransit');
  expect(snapshot.orders.at(-1).status).toBe('executing');
  expect(snapshot.money).toBe(setup.money);
  const outboundArrival = await page.evaluate((consignmentId) => {
    const journeys = window.helixHeresyDebug.strategicJourneysSnapshot();
    return journeys.journeys.find((journey) => journey.subject.kind === 'commodityConsignment' && journey.subject.id === consignmentId).exactArrivalAt;
  }, snapshot.consignments.at(-1).id);
  await page.evaluate((arrivalAt) => {
    const clock = window.helixHeresyDebug.strategicJourneysSnapshot().clock;
    window.helixHeresyDebug.advanceStrategicServices(Math.max(0, arrivalAt - clock));
  }, outboundArrival);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.consignments.at(-1).status).toBe('sold');
  expect(snapshot.orders.at(-1).status).toBe('filled');
  expect(snapshot.money).toBe(setup.money + Math.round(2 * setup.bid));
  expect(snapshot.market.listings.stoneBlocks.supply).toBeCloseTo(setup.supply + 2, 4);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(360));
  expect((await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot())).money).toBe(snapshot.money);
});
