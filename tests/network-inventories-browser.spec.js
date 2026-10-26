const { test, expect } = require('@playwright/test');
const { openForeignWorkspace } = require('./helpers/foreign-assay-visit');
const { world, Definitions } = require('./helpers/institutional-inventory-source');
const N = require('../network-operations');
test.setTimeout(480000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.networkOperationsSnapshot());
test('original inventories survive actual passenger travel, workspace lease payment, physical fixture creation, reload and final death', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const map = world(['transport', 'research'].map(category => Definitions.find(d => d.category === category)));
  const h = map.strategicNonStateNetworkHistory;
  for (const [i, cityId] of ['a', 'b'].entries()) {
    const networkId = i ? 'research' : 'transport';
    h.networkRows[i].networkId = networkId; h.networkRows[i].originCityId = cityId;
    Object.assign(h.branchRows[i], { id: i ? 'research:b' : 'branch:a', networkId, originalCityId: cityId, currentCityId: cityId });
    Object.assign(h.affiliateRows[i], { actualParentNetworkId: networkId, registrationCityId: cityId });
    Object.assign(h.covertRows[i], { networkId, cityId });
    Object.assign(map.strategicPlayableSettlementState.cityRows[i], { cityId, assetId: `population:${cityId}` });
    map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[i].cityId = cityId;
  }
  const source = N.sources(map, 'original-inventory-workspace');
  await openForeignWorkspace(page, 'original-inventory-workspace', 'dom', false, false, 0, false, false,
    async p => expect(await p.evaluate(s => window.helixHeresyDebug.setOriginalInstitutionalInventoryTestSource(s), source)).toBe(true),
    { homePopulationId: 'population:a', foreignPopulationId: 'population:b' });
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1));
  const before = await snap(page), workspace = await page.evaluate(() => window.helixHeresyDebug.foreignWorkspaceSnapshot());
  expect(before.saved.inventories.mode).toBe('original'); expect(workspace.saved.lease.depositHeld).toBe(150);
  expect(workspace.saved.property.landlord.rentReceived).toBe(225);
  for (const id of [workspace.saved.property.id, workspace.saved.actor.id, workspace.saved.benchId, 'branch:a:passenger-road-car'])
    expect(before.saved.inventories.assets.find(a => a.id === id)).toMatchObject({ ledger: 'service', state: null, lost: false });
  expect(before.saved.accounts.every(a => a.money === a.initialMoney)).toBe(true);
  expect(before.saved.inventories.assets.find(a => a.id === 'research:b:non-office-reserve').state.money).toBe(240);
  expect(await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier.vehicle.fuelKm)).toBeLessThan(2400);
  expect(before.public).toEqual([]);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snap(page)).saved.inventories).toEqual(before.saved.inventories);
  const restored = await page.evaluate(() => window.helixHeresyDebug.foreignWorkspaceSnapshot());
  expect(restored.money).toBe(workspace.money); expect(restored.saved.lease).toEqual(workspace.saved.lease);
  const frozen = (await snap(page)).saved;
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
