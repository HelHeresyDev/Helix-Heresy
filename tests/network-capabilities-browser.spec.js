const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { world } = require('./helpers/network-operating-source');
const N = require('../network-operations');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const C = require('../network-capabilities');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.networkOperationsSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOuterApproachForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 15; n++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot()), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe('');
    await page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), Math.max(1, Math.ceil(t.dueAt - s.clock + 1)));
  }
  throw new Error('Actual passenger or local walking task did not finish');
}
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
async function arrive(page, renderer) {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, `capability-account-${renderer}`);
  const map = world(), n = map.strategicNonStateNetworkHistory.networkRows[0];
  n.category = 'transport'; n.sourceDefinitionId = Definitions.find(d => d.category === 'transport').id;
  map.strategicNonStateNetworkHistory.branchRows.forEach(b => { b.organizationForm = 'contractDepot'; b.currentStanding = 'licensed'; });
  const original = N.sources(map, 'original:5'); original.branches[0].disclosurePolicy = 'withholdInternalAccounts';
  // Original inventories are fixed before any journey, spending or request.
  expect(await page.evaluate(s => window.helixHeresyDebug.setOriginalInstitutionalInventoryTestSource(s), original)).toBe(true);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', assetId: 'population:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Original Carrier', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00001' },
        ...['a', 'b'].map(cityId => ({ id: `city:${cityId}`, kind: 'fortifiedCity', cityId, label: `City ${cityId}`, known: true,
          supportComponentId: 'one', jurisdiction: { kind: 'city', cityId }, cellId: 'planet-cell:00001' }))
      ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], distanceKm: 2, continuity: 'continuous', supportCapable: true }] } });
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] } });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Actual booking/boarding failed');
  }, renderer);
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  // Source fixtures allocate no reconciled outcome. Let the ordinary update
  // discover existing owners; rendering/snapshotting must remain read-only.
  await advance(page, 1);
  await page.locator('[data-workspace-tab="visits"]').click();
  return page.evaluate(() => ({ world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), campaign: window.helixHeresyDebug.campaignSnapshot() }));
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual clerk request acquires only dated limited capability accounts, preserves original assets and cannot certify the network`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await arrive(page, renderer);
  const before = await snap(page); expect(before.context.near).toBe(true); expect(before.capabilityAssessments[0].sources).toHaveLength(6);
  const car = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier);
  const owner = before.capabilityAssessments[0].ownerAccount;
  expect(owner.assets.filter(a => a.assetId === car.vehicle.id)).toHaveLength(1);
  expect(owner.assets.find(a => a.assetId === car.vehicle.id)).toMatchObject({ state: 'linked', owner: { branchId: 'branch:a', cityId: 'a' } });
  expect(car.vehicle.fuelKm).toBeLessThan(2400); // Actual journey spent it before reconciliation.
  expect(owner.references.filter(r => r.assetId === car.vehicle.id)).toHaveLength(1);
  expect(before.saved.inventories.mode).toBe('original');
  expect(before.saved.inventories.assets.find(a => a.id === car.vehicle.id)).toMatchObject({ ledger: 'service', state: null, lost: false });
  expect(before.capabilityAssessments[0].inventory.sources.every(s => s.families.length === 7)).toBe(true);
  const selector = `[data-network-entry="branch:b"][data-network-purpose="${C.PURPOSE}"]`;
  await page.locator(`${selector}[data-network-action="send"]`).click(); await advance(page, 20);
  let s = await snap(page); expect(s.saved.job, JSON.stringify(s.context)).toBeTruthy(); expect(s.saved.job.progress).toBe(20); expect(s.public).toEqual([]);
  const work = s.context.gate.receptionWorkSeconds; await reload(page); s = await snap(page);
  expect(s.capabilityAssessments[0].ownerAccount.assets).toEqual(owner.assets);
  expect(await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier.vehicle)).toEqual(car.vehicle);
  expect(s.saved.job.progress).toBe(20); expect(s.context.gate.receptionWorkSeconds).toBe(work);
  await advance(page, 100); s = await snap(page); expect(s.saved.requests[0].replies).toHaveLength(3); expect(s.public).toEqual([]);
  expect(s.saved.accounts.every(a => !a.mandate && !a.mandates)).toBe(true);
  expect(s.saved.accounts.map(a => a.money)).toEqual(before.saved.accounts.map(a => a.money));
  await page.locator(`${selector}[data-network-action="receive"]`).click(); await advance(page, 30);
  s = await snap(page); expect(s.public).toHaveLength(1); const receipt = s.public[0];
  expect(receipt.purpose).toBe(C.PURPOSE); expect(receipt.replies.find(r => r.branchId === 'branch:a').statement.disclosure).toBe('withheld');
  expect(receipt.replies.find(r => r.branchId === 'branch:b').statement.disclosure).toBe('limited');
  const panel = page.locator('[data-network-operations]'); await expect(panel).toContainText('Original A Chapter: Internal account withheld');
  await expect(panel).toContainText('Original B Chapter: Limited office account');
  expect(await panel.innerText()).not.toMatch(/original-undisclosed|original-opaque|14400|240|population:b/);
  expect(JSON.stringify(s.public)).not.toMatch(/original-undisclosed|original-opaque|capabilityBaseline|actualCapacity|workSeconds|populationSourceId|latitude|longitude/);
  expect(s.capabilityAssessments[0].catalogComplete).toBe(true); expect(s.capabilityAssessments[0].strategicComplete).toBe(false);
  expect(s.capabilityAssessments[0].families).toHaveLength(7);
  await reload(page); await advance(page, 90); expect((await snap(page)).public).toEqual(s.public);
  if (renderer === 'dom') {
    await page.locator(`${selector}[data-network-action="receive"]`).click(); await advance(page, 30);
    const newer = (await snap(page)).public.at(-1);
    expect(newer.at).toBeGreaterThan(receipt.at); expect(newer.observedAt).toBe(receipt.observedAt);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('review'))).toBe(true);
  const evidence = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().public.review.evidence);
  const account = evidence.find(e => e.id === receipt.id); expect(account.status).toBe('unverified');
  expect(account.observedAt).toBe(receipt.observedAt); expect(account.receivedAt).toBe(receipt.at);
  expect(JSON.stringify(evidence)).not.toMatch(/original-undisclosed|original-opaque|catalogComplete|strategicComplete/);
  expect(await page.evaluate(() => window.helixHeresyDebug.campaignSnapshot())).toEqual(original.campaign);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  if (renderer === 'canvas') {
    const frozen = (await snap(page)).saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
    await advance(page, 60); expect((await snap(page)).saved).toEqual(frozen);
  }
  expect(errors).toEqual([]);
});
