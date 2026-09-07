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
