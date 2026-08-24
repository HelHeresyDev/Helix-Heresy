// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

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

test('@smoke queued black market trade sells collected byproduct and updates economy state', async ({ page }) => {
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

test('formal contracts reserve physical receptacles and expose structured negotiation choices', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.status === 'open'));
  expect(offer).toBeTruthy();

  await openCheats(page);
  await page.locator('#marketCommandInput').fill(`byproduct ${offer.material} ${offer.amount}`);
  await page.locator('#marketCommandBtn').click();
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="deals"]').click();
  const offerRow = page.locator(`[data-black-market-deal="${offer.id}"]`);
  await expect(offerRow.getByRole('button', { name: 'Accept Terms' })).toBeEnabled();
  await expect(offerRow.getByRole('button', { name: 'Ask More Time' })).toBeEnabled();
  await expect(offerRow.getByRole('button', { name: 'Request Discreet Handoff' })).toBeEnabled();
  await offerRow.getByRole('button', { name: 'Accept Terms' }).click();

  const economy = await page.evaluate(() => window.helixHeresyDebug.economySnapshot());
  const contract = economy.contracts.find((candidate) => candidate.offerId === offer.id);
  expect(contract.status).toBe('active');
  expect(contract.reservations.length).toBeGreaterThan(0);
  expect(contract.reservations.reduce((total, reservation) => total + reservation.amount, 0)).toBeCloseTo(offer.amount, 3);
  expect(await page.evaluate((material) => window.helixHeresyDebug.marketAvailableByproduct(material), offer.material)).toBe(0);

  await page.locator('[data-economy-menu-tab="contracts"]').click();
  const contractRow = page.locator(`[data-economy-menu-panel="contracts"] [data-black-market-contract="${contract.id}"]`);
  await expect(contractRow).toContainText('designated');
  await expect(contractRow.getByRole('button', { name: 'Dispatch Delivery' })).toBeEnabled();
});

test('contract delivery stores exposure and payment-default outcomes without rerolling', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.status === 'open'));
  await openCheats(page);
  await page.locator('#marketCommandInput').fill(`byproduct ${offer.material} ${offer.amount}`);
  await page.locator('#marketCommandBtn').click();
  await page.evaluate((offerId) => window.helixHeresyDebug.acceptMarketContract(offerId), offer.id);
  const contract = await page.evaluate((offerId) => window.helixHeresyDebug.economySnapshot().contracts.find((candidate) => candidate.offerId === offerId), offer.id);
  await page.evaluate((contractId) => window.helixHeresyDebug.setMarketContractOutcome(contractId, { paymentFraction: 0.5, exposureRoll: 0 }), contract.id);
  expect(await page.evaluate((contractId) => window.helixHeresyDebug.startMarketContractDelivery(contractId), contract.id)).toBe(true);

  await page.locator('[data-workspace-tab="tasks"]').click();
  const taskRow = page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: offer.material });
  await taskRow.getByRole('button', { name: 'Finish' }).click();
  let delivered = await page.evaluate((contractId) => window.helixHeresyDebug.economySnapshot().contracts.find((candidate) => candidate.id === contractId), contract.id);
  if (delivered.status === 'delivered') {
    await page.evaluate((seconds) => window.helixHeresyDebug.advanceMarketTime(seconds), 86401);
    delivered = await page.evaluate((contractId) => window.helixHeresyDebug.economySnapshot().contracts.find((candidate) => candidate.id === contractId), contract.id);
  }
  const finalState = await savedState(page);
  expect(delivered.status).toBe('defaulted');
  expect(delivered.outcome).toBe('Partially paid');
  expect(finalState.economy.exposures.some((entry) => entry.contractId === contract.id)).toBe(true);
  expect(finalState.suspicion).toBeGreaterThan(0);
  expect(finalState.economy.money).toBe(Math.round(delivered.payout * 0.5));
  expect((finalState.collectedByproductHistory[offer.material] || []).some((entry) => entry.source.includes(contract.id))).toBe(true);
});

test('missed contract deadlines release designated stock and apply saved relationship penalties', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.status === 'open'));
  await openCheats(page);
  await page.locator('#marketCommandInput').fill('reputation 20');
  await page.locator('#marketCommandBtn').click();
  await page.locator('#marketCommandInput').fill(`byproduct ${offer.material} ${offer.amount}`);
  await page.locator('#marketCommandBtn').click();
  await page.evaluate((offerId) => window.helixHeresyDebug.acceptMarketContract(offerId), offer.id);
  const before = await savedState(page);
  const contract = before.economy.contracts.find((candidate) => candidate.offerId === offer.id);
  const contactBefore = before.economy.contacts.find((contact) => contact.id === contract.contactId);
  await page.evaluate(({ contractId, dueAt }) => window.helixHeresyDebug.setMarketContractOutcome(contractId, { dueAt }), { contractId: contract.id, dueAt: before.clock + 1 });
  await page.evaluate(() => window.helixHeresyDebug.advanceMarketTime(2));

  const finalState = await savedState(page);
  const failed = finalState.economy.contracts.find((candidate) => candidate.id === contract.id);
  const contactAfter = finalState.economy.contacts.find((contact) => contact.id === contract.contactId);
  expect(failed.status).toBe('failed');
  expect(failed.reservations).toEqual([]);
  expect(finalState.economy.blackMarketReputation).toBeLessThan(20);
  expect(contactAfter.trust).toBeLessThan(contactBefore.trust);
  expect(finalState.collectedByproducts[offer.material]).toBeCloseTo(offer.amount, 3);
  expect(finalState.economy.ledger.some((entry) => entry.contractId === contract.id && entry.kind === 'contractFailed')).toBe(true);
});
