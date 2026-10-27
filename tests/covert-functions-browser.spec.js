const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { world } = require('./helpers/network-operating-source');
const N = require('../network-operations');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.covertFunctionSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCovertFunctionsForTest(n), n);
const resources = market => ({ ...market, couriers: market.couriers.map(({ lastAt, ...c }) => c) });
async function contacts(page) {
  const tab = page.locator('[data-workspace-tab="economy"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator('[data-economy-menu-tab="contacts"]').click();
}
test('DOM original broker introduces only an actual independent collection contract, conserving partial work, custody, acquired knowledge and continued copies', async ({ page }) => {
  page.setDefaultTimeout(20000); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { if (d.type() === 'alert') errors.push(d.message()); return d.accept(); });
  await startLifecycleRun(page, 'original-covert-functions');
  const m = world(); Object.assign(m.strategicNonStateNetworkHistory.networkRows[0], {
    category: 'blackMarket', sourceDefinitionId: Definitions.find(d => d.category === 'blackMarket').id });
  for (const b of m.strategicNonStateNetworkHistory.branchRows) Object.assign(b, { organizationForm: 'brokerFront', currentStanding: 'licensed', publicName: `${b.id} Original Brokerage` });
  Object.assign(m.strategicNonStateNetworkHistory.covertRows[0], { kind: 'informantExchange' });
  Object.assign(m.strategicNonStateNetworkHistory.affiliateRows[0], { registrationCityId: 'c', declaredActivity: 'freightBrokerage' });
  expect(await page.evaluate(s => window.helixHeresyDebug.setOriginalInstitutionalInventoryTestSource(s), N.sources(m, 'original:5'))).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'cell:1', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'cell:1', supportComponentId: 'one', known: true, reachable: true }
    ] }, 'original-covert-functions');
    d.configureScientistIdentityTest({ money: 20 });
  });
  const offer = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find(d => d.offerKind === 'contract' && d.status === 'open' && d.commodityKind !== 'specimen'));
  expect(offer).toBeTruthy();
  if (!await page.locator('[data-workspace-tab="cheats"]').isVisible()) await page.locator('#debugToggleBtn').click();
  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('#marketCommandInput').fill(`byproduct ${offer.material} ${offer.amount}`); await page.locator('#marketCommandBtn').click();
  await page.locator('[data-workspace-tab="economy"]').click(); await page.locator('[data-economy-menu-tab="deals"]').click();
  await page.locator(`[data-black-market-deal="${offer.id}"]`).getByRole('button', { name: 'Accept Terms', exact: true }).click();
  const initial = await page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot());
  const contract = (await page.evaluate(() => window.helixHeresyDebug.economySnapshot())).contracts.find(c => c.offerId === offer.id);
  await contacts(page); const panel = page.locator('[data-covert-functions]');
  await expect(panel).not.toContainText('original-undisclosed'); await expect(panel).not.toContainText('original-opaque');
  await panel.locator(`[data-covert-function-action="introduce"][data-owner-id="branch:branch:a"][data-contract-id="${contract.id}"]`).click();
  await tick(page, 30); let s = await snap(page); expect(s.saved.job.progress).toBe(30); expect(s.money).toBe(initial.money - 2);
  expect(resources(await page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot().local))).toEqual(resources(initial.local));
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await contacts(page);
  expect((await snap(page)).saved.job.progress).toBe(30); await tick(page, 150); s = await snap(page);
  expect(s.public).toHaveLength(1); expect(s.public[0].available, JSON.stringify(s)).toBe(true);
  const report = s.public, worker = s.networks.inventories.assets.find(a => a.id === 'branch:a:original-broker');
  expect(worker.state.workSeconds).toBe(14400 - 180);
  expect(resources(await page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot().local))).toEqual(resources(initial.local));
  console.info('broker: actual contract accepted, original partial work reloaded, dated introduction received without allocating a courier');
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-covert-functions.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await contacts(page);
  const continued = await snap(page); expect(continued.saved.runId).not.toBe(s.saved.runId); expect(continued.public).toEqual(report);
  expect(continued.networks.inventories.assets.find(a => a.id === worker.id)).toEqual(worker);
  await panel.locator('[data-covert-function-action="dispatch"]').click();
  const queued = await page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot());
  const collection = queued.local.collections.find(j => j.obligationId === contract.id);
  expect(collection.introductionReference).toBe(report[0].id); expect(collection.owner).toBe('player');
  expect(queued.local.couriers.map(c => c.id)).toEqual(initial.local.couriers.map(c => c.id));
  console.info('broker: continued copy preserved the original allocation and booked the independent courier through normal delivery');
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: offer.material }).getByRole('button', { name: 'Finish', exact: true }).click();
  const delivered = await page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot());
  expect(delivered.local.collections.find(j => j.id === collection.id).manifest).toBeTruthy();
  expect(delivered.local.collections.find(j => j.id === collection.id).owner).toBe(contract.contactId);
  expect((await snap(page)).public).toEqual(report);
  await contacts(page); await panel.locator('[data-covert-function-action="close"]').click();
  expect((await snap(page)).saved.closed).toEqual([{ id: report[0].id, at: (await snap(page)).clock }]);
  expect((await snap(page)).public).toEqual(report);
  expect(await page.evaluate(id => window.helixHeresyDebug.confidentialServiceSnapshot().local.collections.find(j => j.id === id), collection.id)).toEqual(delivered.local.collections.find(j => j.id === collection.id));
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('review'))).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.supremacySnapshot().public.review.evidence.find(e => e.id === id).status, report[0].id)).toBe('unverified');
  const evidence = await page.evaluate(id => window.helixHeresyDebug.supremacySnapshot().public.review.evidence.find(e => e.id === id), report[0].id);
  expect(evidence.account.scope).toBe('The exact nonliving collection request and dated quote');
  expect(evidence.account.findings[0]).toContain('no carrier or cargo was reserved');
  expect(evidence.observedAt).toBe(report[0].observedAt); expect(evidence.receivedAt).toBe(report[0].at);
  expect(evidence.account.limits).toContain('No government credential');
  const frozen = await snap(page); await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 30);
  expect((await snap(page)).saved).toEqual(frozen.saved); expect((await snap(page)).networks).toEqual(frozen.networks);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
