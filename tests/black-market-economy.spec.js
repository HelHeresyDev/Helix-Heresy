// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function savedState(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return payload.state || payload;
  }, { key: storageKey });
}

async function firstOpenDeal(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const deal = (state.economy?.deals || []).find((candidate) => candidate.status === 'open');
    if (!deal) {
      throw new Error('No open black market deal found.');
    }
    return deal;
  }, { key: storageKey });
}

async function openCheats(page) {
  const cheatsTab = page.locator('[data-workspace-tab="cheats"]');
  if (!(await cheatsTab.isVisible())) {
    await page.locator('#debugToggleBtn').click();
  }
  await cheatsTab.click();
}

test('black market starts with contacts, deals, and a concealed exit', async ({ page }) => {
  await startRun(page);

  await page.keyboard.press('B');
  await expect(page.locator('[data-workspace-tab="economy"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#economySummary')).toContainText('open deals');
  await expect(page.locator('[data-economy-menu-tab="overview"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-economy-menu-tab="contacts"]').click();
  await expect(page.locator('[data-economy-menu-panel="contacts"] [data-black-market-contact]')).toHaveCount(3);
  await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-economy-menu-panel="deals"] [data-black-market-deal]')).toHaveCount(6);

  const state = await savedState(page);
  expect(state.rooms.some((room) => room.id === 'concealedExit')).toBe(true);
  expect(state.economy.money).toBe(0);
  expect(state.economy.blackMarketReputation).toBe(0);
});

test('queued black market trade sells collected byproduct and updates economy state', async ({ page }) => {
  await startRun(page);
  const deal = await firstOpenDeal(page);

  await openCheats(page);
  await page.locator('#marketCommandInput').fill(`byproduct ${deal.material} ${deal.amount}`);
  await page.locator('#marketCommandBtn').click();
  await expect(page.locator('#marketCommandStatus')).toContainText(deal.material);

  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="deals"]').click();
  const dealRow = page.locator(`[data-economy-menu-panel="deals"] [data-black-market-deal="${deal.id}"]`);
  await expect(dealRow).toContainText(deal.material);
  await expect(dealRow.getByRole('button', { name: 'Queue Trade' })).toBeEnabled();
  await dealRow.getByRole('button', { name: 'Queue Trade' }).click();

  const queuedState = await savedState(page);
  const queuedDeal = queuedState.economy.deals.find((candidate) => candidate.id === deal.id);
  expect(queuedDeal.status).toBe('queued');
  expect(queuedState.tasks.some((task) => task.type === 'blackMarketTrade' && task.data.dealId === deal.id)).toBe(true);

  await page.locator('[data-workspace-tab="tasks"]').click();
  const taskRow = page.locator('[data-task-row]').filter({ hasText: 'Trade' }).filter({ hasText: deal.material });
  await expect(taskRow).toContainText('Black Market');
  await taskRow.getByRole('button', { name: 'Finish' }).click();

  const finalState = await savedState(page);
  const completedDeal = finalState.economy.deals.find((candidate) => candidate.id === deal.id);
  expect(completedDeal.status).toBe('completed');
  expect(finalState.economy.money).toBeGreaterThanOrEqual(deal.payout);
  expect(finalState.economy.blackMarketReputation).toBeGreaterThan(0);
  expect((finalState.collectedByproductHistory[deal.material] || []).some((entry) => (
    entry.source.includes('Sold to') && Math.abs(entry.amount + deal.amount) < 0.001
  ))).toBe(true);
  expect(finalState.scientist.roomId).toBe('concealedExit');
  expect(finalState.taskHistory[0].type).toBe('blackMarketTrade');
});
