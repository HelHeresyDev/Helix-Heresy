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
  await page.locator('#setupForm button[type="submit"]').click();
}

async function savedState(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return payload.state || payload;
  }, { key: storageKey });
}

test('contraband catalog exposes illicit formulas, transport pods, and separated offer categories', async ({ page }) => {
  await startRun(page);

  const snapshot = await page.evaluate(() => ({
    economy: window.helixHeresyDebug.economySnapshot(),
    fixtures: window.helixHeresyDebug.fixtureSnapshot()
  }));
  expect(snapshot.economy.deals.some((deal) => deal.commodityKind === 'rawByproduct')).toBe(true);
  expect(snapshot.economy.deals.some((deal) => deal.commodityKind === 'manufactured')).toBe(true);
  expect(snapshot.economy.deals.some((deal) => deal.commodityKind === 'specimen')).toBe(true);
  expect(snapshot.fixtures.recipes.some((recipe) => recipe.id === 'containment:specimenTransportPod')).toBe(true);
  expect(snapshot.fixtures.recipes.some((recipe) => recipe.id === 'chemistry:formulateMutagenicPrimer')).toBe(true);
  expect(snapshot.fixtures.recipes.some((recipe) => recipe.id === 'chemistry:formulateArcaneSuspension')).toBe(true);
  expect(snapshot.fixtures.recipes.some((recipe) => recipe.id === 'chemistry:formulateNumbingSolvent')).toBe(true);

  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-economy-category="rawByproducts"]')).toContainText('Raw Materials');
  await expect(page.locator('[data-economy-category="manufacturedContraband"]')).toContainText('Manufactured Goods');
  await expect(page.locator('[data-economy-category="livingSpecimens"]')).toContainText('Living Specimens');
});

test('manufactured contracts reserve and deliver one exact qualifying batch', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'manufactured'));
  expect(offer).toBeTruthy();
  const batch = await page.evaluate((offerId) => window.helixHeresyDebug.addBlackMarketManufacturedBatch(offerId), offer.id);
  expect(batch).toBeTruthy();
  expect(await page.evaluate((stackId) => window.helixHeresyDebug.physicalItemVisualSnapshot()
    .find((stack) => stack.id === stackId)?.visualKey, batch.id)).toBe('item.chemical.packaged');

  expect(await page.evaluate(({ offerId, stackId }) => window.helixHeresyDebug.acceptMarketContract(offerId, 'standard', stackId), { offerId: offer.id, stackId: batch.id })).toBe(true);
  const accepted = await savedState(page);
  const contract = accepted.economy.contracts.find((candidate) => candidate.offerId === offer.id);
  const reservedStack = accepted.physicalItemStacks.find((stack) => stack.id === batch.id);
  expect(contract.commodityKind).toBe('manufactured');
  expect(contract.selectedStackId).toBe(batch.id);
  expect(contract.reservations).toEqual([expect.objectContaining({ kind: 'chemicalBatch', stackId: batch.id })]);
  expect(reservedStack.reservedTaskId).toBe(contract.id);
  expect(contract.shipmentValueModifier).toBeGreaterThan(0.75);

  expect(await page.evaluate((contractId) => window.helixHeresyDebug.startMarketContractDelivery(contractId), contract.id)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: offer.material }).getByRole('button', { name: 'Finish' }).click();

  const finalState = await savedState(page);
  const delivered = finalState.economy.contracts.find((candidate) => candidate.id === contract.id);
  expect(['delivered', 'completed']).toContain(delivered.status);
  expect(finalState.physicalItemStacks.some((stack) => stack.id === batch.id)).toBe(false);
  expect(finalState.economy.ledger.some((entry) => entry.contractId === contract.id && entry.kind === 'delivered')).toBe(true);
  expect(finalState.company.variances).toContainEqual(expect.objectContaining({
    kind: 'unexplainedInventoryLoss',
    severity: 'serious',
    batchId: batch.chemicalBatch.id,
    sourceId: contract.id,
    status: 'open',
  }));
  expect(finalState.investigativeEvidence.records).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'covertCommercialDelivery',
      category: 'commercial',
      lifecycle: 'externalized',
      refs: expect.objectContaining({ contractIds: [contract.id], batchIds: [batch.chemicalBatch.id] }),
    }),
    expect.objectContaining({
      type: 'documentVariance',
      category: 'documentary',
      refs: expect.objectContaining({ batchIds: [batch.chemicalBatch.id] }),
    }),
  ]));
});

test('living-specimen contracts reserve a creature and pod, freeze high transport risk, and transfer both', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'specimen'));
  expect(offer).toBeTruthy();
  expect(offer.exposureChance).toBeGreaterThanOrEqual(0.32);
  const specimen = await page.evaluate((offerId) => window.helixHeresyDebug.addBlackMarketSpecimen(offerId), offer.id);
  const pod = await page.evaluate(() => window.helixHeresyDebug.addBlackMarketTransportPod(92));
  expect(specimen).toBeTruthy();
  expect(pod).toBeTruthy();

  expect(await page.evaluate(({ offerId, slimeId }) => window.helixHeresyDebug.acceptMarketContract(offerId, 'standard', slimeId), { offerId: offer.id, slimeId: specimen.id })).toBe(true);
  let state = await savedState(page);
  const contract = state.economy.contracts.find((candidate) => candidate.offerId === offer.id);
  const reservedSlime = state.slimes.find((slime) => slime.id === specimen.id);
  expect(contract.reservations).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'creature', slimeId: specimen.id }),
    expect.objectContaining({ kind: 'transportPod', stackId: pod.id })
  ]));
  expect(reservedSlime.blackMarketContractId).toBe(contract.id);
  expect(contract.transportFailureChance).toBeGreaterThan(0);

  await page.evaluate((contractId) => window.helixHeresyDebug.setMarketContractOutcome(contractId, { transportRoll: 1, exposureRoll: 1, paymentFraction: 1 }), contract.id);
  expect(await page.evaluate((contractId) => window.helixHeresyDebug.startMarketContractDelivery(contractId), contract.id)).toBe(true);
  state = await savedState(page);
  expect(state.economy.contracts.find((candidate) => candidate.id === contract.id).transportOutcome).toBe('secure');
  const queuedTask = await page.evaluate((contractId) => window.helixHeresyDebug.taskStatusSnapshot().find((task) => task.data.contractId === contractId), contract.id);
  expect(queuedTask.status).toEqual({ id: 'active', label: 'Active', reason: '' });

  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: offer.material }).getByRole('button', { name: 'Finish' }).click();
  state = await savedState(page);
  if (state.economy.contracts.find((candidate) => candidate.id === contract.id).status === 'queued') {
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
    state = await savedState(page);
  }
  const delivered = state.economy.contracts.find((candidate) => candidate.id === contract.id);
  expect(['delivered', 'completed']).toContain(delivered.status);
  expect(state.slimes.some((slime) => slime.id === specimen.id)).toBe(false);
  expect(state.physicalItemStacks.some((stack) => stack.id === pod.id)).toBe(false);
  expect(delivered.transportOutcome).toBe('secure');
});

test('a saved specimen-pod breach consumes the pod, fails the contract, and releases the creature at the exit', async ({ page }) => {
  await startRun(page);
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'specimen'));
  const specimen = await page.evaluate((offerId) => window.helixHeresyDebug.addBlackMarketSpecimen(offerId), offer.id);
  const pod = await page.evaluate(() => window.helixHeresyDebug.addBlackMarketTransportPod(20));
  await page.evaluate(({ offerId, slimeId }) => window.helixHeresyDebug.acceptMarketContract(offerId, 'standard', slimeId), { offerId: offer.id, slimeId: specimen.id });
  let state = await savedState(page);
  const contract = state.economy.contracts.find((candidate) => candidate.offerId === offer.id);
  expect(contract.transportFailureChance).toBeGreaterThan(0);

  await page.evaluate((contractId) => window.helixHeresyDebug.setMarketContractOutcome(contractId, { transportRoll: 0, exposureRoll: 1 }), contract.id);
  expect(await page.evaluate((contractId) => window.helixHeresyDebug.startMarketContractDelivery(contractId), contract.id)).toBe(true);
  state = await savedState(page);
  expect(state.economy.contracts.find((candidate) => candidate.id === contract.id).transportOutcome).toBe('breach');

  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: offer.material }).getByRole('button', { name: 'Finish' }).click();
  state = await savedState(page);
  if (state.economy.contracts.find((candidate) => candidate.id === contract.id).status === 'queued') {
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
    state = await savedState(page);
  }
  const failed = state.economy.contracts.find((candidate) => candidate.id === contract.id);
  const escaped = state.slimes.find((slime) => slime.id === specimen.id);
  expect(failed.status).toBe('failed');
  expect(failed.transportOutcome).toBe('breach');
  expect(failed.outcome).toContain('breached');
  expect(escaped).toEqual(expect.objectContaining({ status: 'released', roomId: 'concealedExit', blackMarketContractId: '' }));
  expect(state.physicalItemStacks.some((stack) => stack.id === pod.id)).toBe(false);
  expect(state.economy.exposures.some((entry) => entry.contractId === contract.id)).toBe(true);
});
