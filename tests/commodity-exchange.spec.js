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
