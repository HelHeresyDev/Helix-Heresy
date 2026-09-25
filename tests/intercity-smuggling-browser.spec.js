const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
test.setTimeout(120000);
async function setup(page) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a',
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 30, cellPath: ['cell:1', 'cell:2'] }],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test laboratory', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Home', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true },
      { id: 'city:b', kind: 'fortifiedCity', cityId: 'b', label: 'Neighbor', cellId: 'cell:2', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'local-covert-tests'));
  return page.evaluate(() => {
    const d = window.helixHeresyDebug, e = d.economySnapshot(), deal = e.deals.find(o => o.commodityKind === 'manufactured' && o.offerKind === 'contract');
    const batch = d.addBlackMarketManufacturedBatch(deal.id);
    return { deal, batch, operatorId: d.economySnapshot().intercitySmuggling.operators[0].id };
  });
}
test('foreign UI confirms exact cargo, preserves local offer, and settles only after physical destination receipt across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="deals"]').click();
  const row = page.locator(`[data-black-market-deal="${f.deal.id}"]`);
  await row.getByRole('button', { name: 'Foreign quote: b' }).click();
  await expect(page.locator('[data-foreign-smuggling-quote]')).toContainText('net on receipt');
  await page.getByRole('button', { name: 'Confirm Foreign Contract' }).click();
  const accepted = await page.evaluate(() => {
    const d = window.helixHeresyDebug, before = d.economySnapshot(); d.reloadSurveyExpeditionTestState();
    return { before, after: d.economySnapshot() };
  });
  expect(accepted.after.intercitySmuggling).toEqual(accepted.before.intercitySmuggling);
  expect(accepted.after.deals.find(o => o.id === f.deal.id).status).toBe('open');
  const contract = accepted.after.contracts.find(c => c.foreignShipmentId);
  expect(contract).toBeTruthy(); expect(accepted.after.money).toBe(0);
  expect(accepted.after.intercitySmuggling.buyers[0].money).toBeLessThan(10000);
  await page.keyboard.press('B');
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), contract.id)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  const collected = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(collected.economy.contracts.find(c => c.id === contract.id).status).toBe('inTransit');
  expect(collected.economy.money).toBe(0);
  expect(collected.economy.localCovertMarket.collections[0].owner).toBe('player');
  expect(collected.physicalItemStacks.some(s => s.id === f.batch.id)).toBe(false);
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.advanceStrategicServices(1800); // Loaded local courier reaches its depot; foreign convoy departs.
    const depot = d.economySnapshot();
    const saved = d.exportSurveyExpeditionTestState(); saved.strategicJourneys.routes[0].continuity = 'closed';
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(3600);
    const held = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); const reloaded = d.economySnapshot();
    const resume = d.exportSurveyExpeditionTestState(); resume.strategicJourneys.routes[0].continuity = 'continuous';
    d.importSurveyExpeditionTestState(resume); d.advanceStrategicServices(3600);
    const receipt = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); d.advanceStrategicServices(3600);
    return { depot, held, reloaded, receipt, returned: d.economySnapshot() };
  });
  expect(result.depot.intercitySmuggling.shipments[0].phase).toBe('outbound');
  expect(result.depot.localCovertMarket.collections[0].manifest).toBeNull();
  expect(result.held.intercitySmuggling.shipments[0].positionKm).toBe(0);
  expect(result.held.money).toBe(0); expect(result.reloaded.intercitySmuggling).toEqual(result.held.intercitySmuggling);
  expect(result.receipt.intercitySmuggling.shipments[0].phase).toBe('returning');
  expect(result.receipt.money).toBe(contract.payout);
  expect(result.returned.money).toBe(contract.payout);
  expect(result.returned.intercitySmuggling.shipments[0].phase).toBe('returned');
  expect(result.returned.intercitySmuggling.shipments[0].manifest.entries[0].stack.chemicalBatch.id).toBe(f.batch.chemicalBatch.id);
  expect(errors).toEqual([]);
});
test('checkpoint UI submits an existing manifest and preserves detention across reload before physical release', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  const id = await page.evaluate(f => {
    const d = window.helixHeresyDebug;
    d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id); d.confirmForeignSmuggling();
    return d.economySnapshot().contracts.find(c => c.foreignShipmentId).id;
  }, f);
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), id)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  const before = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    window.HelixSmugglingCheckpoints.bind(saved.economy.intercitySmuggling, [{ cityId: 'b', cellId: 'cell:2', institutionId: 'watch:b', institutionName: 'Neighbor Watch', jurisdiction: 'city' }]);
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(1800); d.advanceStrategicServices(6000);
    const before = d.economySnapshot(); d.reloadSurveyExpeditionTestState();
    return { before, after: d.economySnapshot() };
  });
  expect(before.after.intercitySmuggling).toEqual(before.before.intercitySmuggling);
  expect(before.after.intercitySmuggling.shipments[0].phase).toBe('detained'); expect(before.after.money).toBe(0);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-foreign-shipment]')).toContainText('freight-gate:b');
  await page.getByRole('button', { name: 'Submit Booked Cargo Manifest' }).click();
  const after = await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceStrategicServices(600); return d.economySnapshot(); });
  expect(after.intercitySmuggling.shipments[0].inspection.status).toBe('released');
  expect(after.intercitySmuggling.shipments[0].inspection.documents).toHaveLength(1);
  expect(after.money).toBeGreaterThan(0); expect(errors).toEqual([]);
});
test('returned cargo recovery UI charges once and physically receives the original batch across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  const id = await page.evaluate(f => {
    const d = window.helixHeresyDebug;
    d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id); d.confirmForeignSmuggling();
    return d.economySnapshot().contracts.find(c => c.foreignShipmentId).id;
  }, f);
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), id)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  const shipmentId = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    window.HelixSmugglingCheckpoints.bind(saved.economy.intercitySmuggling, [{ cityId: 'b', cellId: 'cell:2', institutionId: 'watch:b', jurisdiction: 'city' }]);
    saved.economy.money = 100; d.importSurveyExpeditionTestState(saved);
    d.advanceStrategicServices(1800); d.advanceStrategicServices(6000);
    const id = d.economySnapshot().intercitySmuggling.shipments[0].id;
    d.smugglingInspectionAction(id, 'return'); d.smugglingInspectionAction(id, 'manifest'); d.advanceStrategicServices(7200);
    return id;
  });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await page.getByRole('button', { name: 'Quote Depot Recovery' }).click();
  await page.getByRole('button', { name: 'Confirm Paid Recovery' }).click();
  const transit = await page.evaluate(() => {
    const d = window.helixHeresyDebug; const before = d.economySnapshot(); d.reloadSurveyExpeditionTestState();
    return { before, after: d.economySnapshot() };
  });
  expect(transit.after.intercitySmuggling).toEqual(transit.before.intercitySmuggling);
  expect(transit.after.money).toBeLessThan(100); expect(transit.after.intercitySmuggling.shipments[0].manifest).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(1800));
  // Reload preserves UI state, but ensure the market panel is open after the test-state helper.
  if (!(await page.getByRole('button', { name: 'Receive Recovered Cargo' }).isVisible())) {
    await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  }
  await page.getByRole('button', { name: 'Receive Recovered Cargo' }).click();
  const received = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  const stack = received.physicalItemStacks.find(s => s.chemicalBatch?.id === f.batch.chemicalBatch.id);
  expect(stack).toBeTruthy(); expect(stack.roomId).toBe('concealedExit'); expect(stack.quantity).toBe(f.deal.amount);
  expect(received.economy.money).toBe(transit.after.money);
  expect(received.economy.intercitySmuggling.shipments[0].receiptAt).toBeNull();
  const result = await page.evaluate(id => {
    const d = window.helixHeresyDebug; const duplicate = d.cargoRecoveryAction(id, 'receive'); d.advanceStrategicServices(1800);
    return { duplicate, local: d.economySnapshot().localCovertMarket };
  }, shipmentId);
  expect(result.duplicate.ok).toBe(false); expect(result.local.collections.find(j => j.kind === 'depotRecovery').phase).toBe('returned');
  expect(errors).toEqual([]);
});
test('property order UI files factual remote review, persists its reasons and releases unsupported custody', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  const contractId = await page.evaluate(f => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const batch = saved.physicalItemStacks.find(s => s.id === f.batch.id);
    batch.chemicalBatch.packaging.state = 'packaged'; batch.chemicalBatch.label = 'Unlicensed Mutagenic Primer';
    d.importSurveyExpeditionTestState(saved);
    d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id); d.confirmForeignSmuggling();
    return d.economySnapshot().contracts.find(c => c.foreignShipmentId).id;
  }, f);
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), contractId)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState(), market = saved.economy.intercitySmuggling;
    window.HelixSmugglingCheckpoints.bind(market, [{ cityId: 'b', cellId: 'cell:2', institutionId: 'watch:b', jurisdiction: 'city' }]);
    window.HelixCargoPropertyReview.publish(market.checkpoints[0], { legalStatus: 'restricted' }, { institutionId: 'court:b', name: 'Neighbor Court' }, saved.clock);
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(1800); d.advanceStrategicServices(6000);
  });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-property-order]')).toContainText('Neighbor Court');
  await page.getByRole('button', { name: 'Challenge Jurisdiction', exact: true }).click();
  const reviewed = await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.advanceStrategicServices(1800);
    const before = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); return { before, after: d.economySnapshot() };
  });
  expect(reviewed.after.intercitySmuggling).toEqual(reviewed.before.intercitySmuggling);
  expect(reviewed.after.intercitySmuggling.shipments[0].propertyOrder.decisions[0].result).toBe('upholdBoundedCustody');
  const examined = await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceStrategicServices(9000); const before = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); return { before, after: d.economySnapshot() }; });
  expect(examined.after.intercitySmuggling).toEqual(examined.before.intercitySmuggling);
  const shipment = examined.after.intercitySmuggling.shipments[0];
  expect(shipment.examination.reports).toHaveLength(2); expect(shipment.examination.samples[0].status).toBe('consumedByAssay');
  expect(shipment.manifest.amount).toBeCloseTo(shipment.propertyOrder.evidence.quantity - .01);
  expect(shipment.playerEscrow).toBe(0); expect(shipment.receiptAt).toBeNull();
  if (!(await page.getByRole('button', { name: 'Challenge Method Sufficiency' }).first().isVisible())) {
    await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  }
  await page.getByRole('button', { name: 'Challenge Method Sufficiency' }).first().click();
  await expect(page.locator('[data-cargo-examination-report]').first()).toContainText('sustained');
  const released = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.economy.intercitySmuggling.checkpoints[0].propertyRules.forEach(r => r.active = false);
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(600); return d.economySnapshot();
  });
  expect(released.intercitySmuggling.shipments[0].propertyOrder.status).toBe('released');
  expect(released.intercitySmuggling.shipments[0].propertyOrder.decisions.at(-1).reason).toContain(shipment.examination.reports[1].result === 'targetNotDetected' ? 'did not detect' : 'does not apply');
  expect(errors).toEqual([]);
});
test('forfeiture UI and separate criminal referral notices preserve property, evidence and reload boundaries', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const f = await setup(page);
  const contractId = await page.evaluate(f => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    const batch = saved.physicalItemStacks.find(s => s.id === f.batch.id);
    Object.assign(batch.chemicalBatch, { phase: 'liquid', productId: 'unlicensedMutagenicPrimer', label: 'Unlicensed Mutagenic Primer', purity: 90 });
    batch.chemicalBatch.packaging.state = 'packaged';
    d.importSurveyExpeditionTestState(saved); d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id); d.confirmForeignSmuggling();
    return d.economySnapshot().contracts.find(c => c.foreignShipmentId).id;
  }, f);
  expect(await page.evaluate(id => window.helixHeresyDebug.startMarketContractDelivery(id), contractId)).toBe(true);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: f.deal.material }).getByRole('button', { name: 'Finish' }).click();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState(), market = saved.economy.intercitySmuggling;
    window.HelixSmugglingCheckpoints.bind(market, [{ cityId: 'b', cellId: 'cell:2', institutionId: 'watch:b', jurisdiction: 'city' }]);
    window.HelixCargoPropertyReview.publish(market.checkpoints[0], { legalStatus: 'prohibited' }, { institutionId: 'court:b', name: 'Neighbor Court' }, saved.clock);
    market.checkpoints[0].productScheduleCode = { id: 'city-law:b:contrabandCommerce', offenseId: 'contrabandCommerce', legalStatus: 'prohibited', elements: window.HelixStrategicCityLaws.OFFENSE_CATALOG.find(o => o.id === 'contrabandCommerce').elements };
    market.checkpoints[0].criminalIntakeInstitution = { institutionId: 'prosecution:b', name: 'Neighbor Prosecution' };
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(1800); d.advanceStrategicServices(15000);
  });
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="deals"]').click();
  await expect(page.locator('[data-cargo-forfeiture]')).toContainText('never default forfeiture');
  await page.getByRole('button', { name: 'Contest Identity', exact: true }).click();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    d.advanceStrategicServices(saved.economy.intercitySmuggling.shipments[0].forfeiture.hearingAt - saved.clock);
  });
  await page.getByRole('button', { name: 'Appeal Confirmation', exact: true }).click();
  await expect(page.locator('[data-cargo-criminal-referral]')).toContainText('No response or appearance required');
  await expect(page.locator('[data-cargo-criminal-referral]')).toContainText('Transaction, actor attribution and knowledge remain unproved');
  const stayed = await page.evaluate(() => {
    const d = window.helixHeresyDebug, before = d.economySnapshot(); d.reloadSurveyExpeditionTestState(); return { before, after: d.economySnapshot() };
  });
  expect(stayed.after.intercitySmuggling).toEqual(stayed.before.intercitySmuggling);
  expect(stayed.after.intercitySmuggling.shipments[0]).toMatchObject({ owner: 'player', forfeiture: { status: 'appealed', responses: ['identity'] } });
  const final = await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.advanceStrategicServices(12000); d.reloadSurveyExpeditionTestState(); return d.economySnapshot().intercitySmuggling;
  });
  expect(final.shipments[0]).toMatchObject({ owner: 'court:b', receiptAt: null, phase: 'returned', forfeiture: { status: 'final' } });
  expect(final.checkpoints[0].forfeitureStore.lots).toHaveLength(1);
  expect(final.checkpoints[0].criminalIntake.referrals).toHaveLength(1);
  const corrected = await page.evaluate(() => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState();
    saved.economy.intercitySmuggling.shipments[0].examination.reports[1].supported = false;
    d.importSurveyExpeditionTestState(saved); d.advanceStrategicServices(1); d.advanceStrategicServices(1800); d.reloadSurveyExpeditionTestState();
    return d.economySnapshot().intercitySmuggling;
  });
  expect(corrected.checkpoints[0].criminalIntake.referrals[0].status).toBe('awaitingCorroboration');
  expect(corrected.shipments[0]).toMatchObject({ owner: 'court:b', phase: 'returned', propertyOrder: { status: 'forfeited' } });
  expect(corrected.checkpoints[0].forfeitureStore.lots).toEqual(final.checkpoints[0].forfeitureStore.lots);
  expect(errors).toEqual([]);
});
test('foreign cancellation releases exact stock and refunds buyer without altering local sale terms', async ({ page }) => {
  const f = await setup(page);
  const result = await page.evaluate(f => {
    const d = window.helixHeresyDebug, quote = d.requestForeignSmuggling(f.deal.id, f.operatorId, f.batch.id);
    const confirmed = d.confirmForeignSmuggling(), contract = d.economySnapshot().contracts.find(c => c.foreignShipmentId);
    return { quote, confirmed, contract };
  }, f);
  expect(result.quote.ok).toBe(true); expect(result.confirmed).toBe(true);
  await page.keyboard.press('B'); await page.locator('[data-economy-menu-tab="contracts"]').click();
  await page.locator(`[data-black-market-contract="${result.contract.id}"]`).filter({ has: page.getByRole('button', { name: 'Cancel Contract' }) }).getByRole('button', { name: 'Cancel Contract' }).click();
  const state = await page.evaluate(() => { const d = window.helixHeresyDebug; d.reloadSurveyExpeditionTestState(); return d.exportSurveyExpeditionTestState(); });
  expect(state.economy.intercitySmuggling.buyers[0].money).toBe(10000);
  expect(state.economy.intercitySmuggling.shipments[0].phase).toBe('canceled');
  expect(state.physicalItemStacks.find(s => s.id === f.batch.id).reservedTaskId).toBe('');
  expect(state.economy.deals.find(o => o.id === f.deal.id).payout).toBe(f.deal.payout);
});

test('raw foreign freight reserves exact contents, preserves receptacles and pays once at receipt', async ({ page }) => {
  const f = await setup(page);
  const deal = await page.evaluate(() => window.helixHeresyDebug.economySnapshot().deals.find(o => o.commodityKind === 'rawByproduct' && o.offerKind === 'contract'));
  await page.locator('[data-workspace-tab="cheats"]').click();
  await page.locator('#marketCommandInput').fill(`byproduct ${deal.material} ${deal.amount}`);
  await page.locator('#marketCommandBtn').click();
  const accepted = await page.evaluate(({ deal, f }) => {
    const d = window.helixHeresyDebug, quote = d.requestForeignSmuggling(deal.id, f.operatorId);
    const confirmed = d.confirmForeignSmuggling(), contract = d.economySnapshot().contracts.find(c => c.foreignShipmentId);
    const dispatched = contract && d.startMarketContractDelivery(contract.id);
    return { quote, confirmed, contract, dispatched, available: d.marketAvailableByproduct(deal.material) };
  }, { deal, f });
  expect(accepted.quote.ok).toBe(true); expect(accepted.confirmed).toBe(true); expect(accepted.dispatched).toBe(true);
  expect(accepted.available).toBe(0);
  await page.locator('[data-workspace-tab="tasks"]').click();
  await page.locator('[data-task-row]').filter({ hasText: 'Deliver' }).filter({ hasText: deal.material }).getByRole('button', { name: 'Finish' }).click();
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug, collected = d.exportSurveyExpeditionTestState();
    d.reloadSurveyExpeditionTestState(); d.advanceStrategicServices(1800); d.advanceStrategicServices(7200);
    const delivered = d.economySnapshot(); d.advanceStrategicServices(3600);
    return { collected, delivered, again: d.economySnapshot() };
  });
  expect(result.collected.economy.money).toBe(0);
  const manifest = result.delivered.intercitySmuggling.shipments[0].manifest;
  expect(manifest.entries.reduce((n, e) => n + e.contents.reduce((m, c) => m + c.amount, 0), 0)).toBeCloseTo(deal.amount, 3);
  for (const e of manifest.entries) expect(result.collected.physicalItemStacks.some(s => s.id === e.sourceReceptacleId)).toBe(true);
  expect(result.delivered.money).toBe(accepted.contract.payout); expect(result.again.money).toBe(result.delivered.money);
});
