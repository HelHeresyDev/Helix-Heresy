const { test, expect } = require('@playwright/test');
const { visit } = require('./helpers/multi-city-visit');
const { sources } = require('./helpers/regional-government-source');
test.setTimeout(900000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.bulkProvisioningSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n), n);
for (const renderer of ['dom', 'canvas']) test(`${renderer}: attended bulk terms, actual fort custody and return survive partial saves and continued import`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('console', m => { if (m.text().startsWith('multi-city:')) console.log(m.text()); });
  await visit(page, renderer, { beforeDeparture: async page => page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureCityCommodityMarketForTest({ cityId: 'a', directory: { foundations: [{ city: { id: 'a', name: 'Home' } }], satellites: [] }, current: null });
    const foreign = JSON.parse(JSON.stringify(d.commodityMarketSnapshot().market.cityContext)); foreign.cityId = 'b'; foreign.cityName = 'Neighbor';
    d.configureIntercityTradeForTest({ profiles: [foreign], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], distanceKm: 558, supportCapable: true, continuity: 'operational' }],
      permissions: [{ corridorId: 'route:ab', approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] }] });
  }) });
  console.log(`${renderer}: original home operation and passenger arrival complete`);
  // The passenger fixture explicitly initializes its own 5,000-mark purse.
  // Set this scenario's prior owned contracting funds AFTER that setup; the
  // actual contract still transfers/depletes them and has no credit creation.
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(100000));
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const original = sources(), farm = JSON.parse(JSON.stringify(original.operation.farms[0]));
  farm.satelliteId += ':second'; original.operation.farms.push(farm);
  expect(await page.evaluate(s => { const d = window.helixHeresyDebug;
    return d.setForeignCivicBargainTestSource(s.succession) && d.setRegionalGovernmentTestSources('b', s);
  }, original)).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
  const gov = page.locator('[data-regional-governments]'), panel = page.locator('[data-bulk-provisioning]');
  await gov.locator('[data-government-action="request"]').click(); await tick(page, 30);
  await gov.locator('[data-government-action="hear"]').click(); await tick(page, 180);
  await gov.locator('[data-government-action="sign"]').click(); await gov.locator('[data-government-action="deliver"]').click();
  let g = await page.evaluate(() => window.helixHeresyDebug.regionalGovernmentSnapshot());
  for (const id of [...g.gates[0].saved.succession.leaders.map(a => a.id), g.gates[0].bargain.defender.id]) {
    expect(await page.evaluate(id => window.helixHeresyDebug.regionalGovernmentAction('agree', id), id)).toBe(true); await tick(page, 60);
  }
  await gov.locator('[data-government-action="handover"]').click(); await tick(page, 180);
  await gov.locator('[data-government-action="operate"]').click(); await tick(page, 7200);
  await gov.locator('[data-government-action="report"]').click();
  console.log(`${renderer}: actual foreign handover, operation and report complete`);
  await test.info().attach('original-prior-bulk-run', { body: JSON.stringify(await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2,
    ...window.helixHeresyDebug.currentWorldRunSnapshot() }))), contentType: 'application/json' });
  expect(await page.evaluate(() => window.helixHeresyDebug.configureBulkProvisioningTest([{ id: 'original-bulk-ba', originId: 'b', destinationId: 'a', distanceKm: 558,
    supportCapable: true, continuity: 'operational', stops: [{ id: 'original-joint-fort', populationSourceId: 'population:joint-fort', population: 400, km: 279, sponsorCityIds: ['b', 'a'], usable: true }] }]))).toBe(true);
  await panel.getByLabel('Bulk food reorder threshold (days)', { exact: true }).fill('4');
  await panel.getByLabel('Bulk food reserve target (days)', { exact: true }).fill('4');
  await panel.getByLabel('Maximum grain kg per trip', { exact: true }).fill('2000');
  await panel.locator('[data-bulk-provisioning-action="quote"]').click();
  let s = await snapshot(page); expect(s.saved.quote).toBeTruthy(); expect(s.saved.contracts).toEqual([]);
  await panel.locator('[data-bulk-provisioning-action="sign"]').click();
  s = await snapshot(page); expect(s.saved.job, JSON.stringify({ book: s.saved, counter: s.counter,
    entries: s.entries.map(e => ({ id: e.rule.id, command: e.rule.command, assignment: e.rule.operatorServiceAssignment, recharge: e.rule.recharge, work: e.rule.operatorWorkSeconds })),
    money: await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().money) })).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceBulkProvisioningForTest(30));
  s = await snapshot(page); expect(s.saved.job.progress).toBe(30); const partial = s.saved;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved).toEqual(partial);
  await page.evaluate(() => window.helixHeresyDebug.advanceBulkProvisioningForTest(90));
  s = await snapshot(page); expect(s.saved.contracts).toHaveLength(1); expect(s.saved.job).toBeNull();
  expect(s.saved.missions, JSON.stringify({ counter: s.counter, entries: s.entries.map(e => ({ food: e.rule.foodKg, farms: e.rule.farms })), book: s.saved })).toHaveLength(1);
  const mission = s.saved.missions[0], spent = s.saved.contracts[0].spent;
  expect(mission.drivers).toBe(6); expect(mission.carriers).toBe(3);
  await page.evaluate(() => window.helixHeresyDebug.advanceBulkProvisioningForTest(8 * 3600));
  s = await snapshot(page); expect(s.saved.missions[0].phase).toBe('station'); expect(s.saved.missions[0].restProgress).toBeLessThan(57600);
  expect(s.saved.missions[0].deliveredKg).toBe(0); const resting = s.saved;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved).toEqual(resting);
  await panel.locator('[data-bulk-provisioning-action="report"]').click();
  await expect(panel).toContainText('No returned crew account');
  await panel.locator('[data-bulk-provisioning-action="cancel"]').click();
  // Personally witnessed management must refresh only this counter's account.
  await panel.locator('[data-bulk-provisioning-action="report"]').click();
  await panel.locator('[data-bulk-provisioning-action="refund"]').click();
  await page.evaluate(() => window.helixHeresyDebug.advanceBulkProvisioningForTest(3 * 86400));
  s = await snapshot(page); expect(s.saved.missions).toHaveLength(1); expect(s.saved.missions[0].phase).toBe('returned');
  expect(s.saved.missions[0].deliveredKg).toBeGreaterThan(0); expect(s.saved.contracts[0].spent).toBeLessThanOrEqual(spent);
  expect(s.saved.stations[0].fuelReceivedKm).toBeGreaterThan(0);
  await expect(panel).toContainText('No returned crew account'); // Unreceived changes stay unknown.
  await panel.locator('[data-bulk-provisioning-action="report"]').click(); await expect(panel).toContainText('Original crew returned');
  const before = (await snapshot(page)).saved;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-bulk.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snapshot(page); expect(s.saved.runId).not.toBe(before.runId); expect(s.saved.missions).toEqual(before.missions);
  expect(s.saved.stations).toEqual(before.stations); expect(s.saved.contracts).toEqual(before.contracts);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.saved; await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snapshot(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
