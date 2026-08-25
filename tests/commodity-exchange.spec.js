// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
}

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
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(6 * 60 * 60 + 1));
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

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(45 * 60));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.consignments.at(-1).status).toBe('unloading');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(6 * 60));

  const final = await page.evaluate(() => ({
    market: window.helixHeresyDebug.commodityMarketSnapshot(),
    stacks: window.helixHeresyDebug.physicalStockSnapshot().stacks,
    visuals: window.helixHeresyDebug.physicalItemVisualSnapshot(),
    state: window.helixHeresyDebug.currentWorldRunSnapshot().run.state,
  }));
  expect(final.market.consignments.at(-1).status).toBe('received');
  expect(final.market.businessReputation).toBeGreaterThan(0);
  expect(final.stacks.some((stack) => stack.section === 'resources' && stack.key === 'steelPanels' && stack.roomId === 'surfaceLoadingBay' && stack.quantity === 3)).toBe(true);
  expect(final.visuals.find((stack) => stack.section === 'resources' && stack.key === 'steelPanels' && stack.roomId === 'surfaceLoadingBay')).toMatchObject({
    tags: expect.arrayContaining(['legalfreight']),
    visualKey: 'item.surface.freight.lawful',
  });
  expect(final.state.taskHistory[0].type).toBe('commodityFreight');
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

test('limit sells reserve an exact physical stack and settle only after dispatch', async ({ page }) => {
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
  expect(reserved.reservedTaskId).toMatch(/^task-/);

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(6 * 60));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(snapshot.consignments.at(-1).status).toBe('sold');
  expect(snapshot.orders.at(-1).status).toBe('filled');
  expect(snapshot.money).toBe(setup.money + Math.round(2 * setup.bid));
  expect(snapshot.market.listings.stoneBlocks.supply).toBeCloseTo(setup.supply + 2, 4);
});
