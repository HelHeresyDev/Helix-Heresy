const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { recoverySources } = require('./helpers/city-recovery-source');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n), n);
for (const renderer of ['dom', 'canvas']) test(`${renderer}: purchased food physically arrives and feeds an original farmless city; partial intake, shortage and recovery survive continued copies`, async ({ page }) => {
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `city-food-${renderer}`);
  await page.evaluate(({ renderer, prepared }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Original city', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] };
    d.setSurveyExpeditionTestContext({ network, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'farmless-city', publicProspects: {}, truth: {} } });
    // Choose an ordinary uninterrupted prior route, not a successful shipment.
    let quietSeed = null;
    for (let n = 0; n < 100; n++) {
      const seed = `city-food-freight-${n}`, result = window.HelixStrategicJourneys.createJourney(d.strategicJourneysSnapshot(), {
        seed: `${seed}:commodityConsignment:legal-consignment-1`, originId: 'city:a', destinationId: 'site:lab', modeId: 'hiredFreightRoad'
      });
      if (result.journey && !result.journey.route.legs.some(l => l.interruption)) { quietSeed = seed; break; }
    }
    if (!quietSeed) throw Error('No ordinary prior freight route'); d.setStrategicServiceTestNetwork(network, quietSeed);
    d.setMarketCash(10000);
  }, { renderer });
  const beforeMarket = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  const purchase = await page.evaluate(() => window.helixHeresyDebug.buyCommodity('fieldRation', 20));
  expect(purchase.filled).toBe(20);
  let market = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot());
  expect(market.money).toBe(beforeMarket.money - purchase.total);
  expect(market.market.listings.fieldRation.supply).toBeCloseTo(beforeMarket.market.listings.fieldRation.supply - 20, 4);
  await page.evaluate(id => {
    const d = window.helixHeresyDebug, j = d.strategicJourneysSnapshot(), arrival = j.journeys.find(j => j.subject.id === id && j.subject.kind === 'commodityConsignment');
    if (!arrival) throw Error('No physical purchase journey');
    d.advanceStrategicServices(Math.max(0, arrival.exactArrivalAt - j.clock)); d.advanceStrategicServices(3600);
  }, purchase.consignment.id);
  market = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot()); expect(market.consignments.at(-1).status).toBe('received');
  const paidLot = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks.find(s => s.key === 'fieldRation' && s.tags?.includes('legalfreight')));
  expect(paidLot.quantity).toBe(20);
  expect(paidLot.unitMassKg).toBe(1); expect(paidLot.unitVolumeL).toBe(1.4);
  await page.evaluate(cell => {
    const d = window.helixHeresyDebug;
    const prior = d.surveyExpeditionSnapshot();
    if (Math.max(Math.abs(prior.scientistCell.x - cell.x), Math.abs(prior.scientistCell.y - cell.y)) > 1
      && !d.startScientistMove('surfaceLoadingBay', { toCell: cell, allowMultiRoom: true })) throw Error('Cannot walk to the actual received lot');
    for (let n = 0; n < 50; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
  }, paidLot.cell);
  await page.evaluate(({ prepared, id }) => {
    const d = window.helixHeresyDebug;
    const originalReserve = d.configureHiddenWorkshopTest({ supplies: { trailMeal: 8 } })[0];
    if (!d.carryActorStack('scientist', id, 20)) throw Error(`Actual paid food cannot be carried: ${JSON.stringify(d.physicalStockSnapshot().stacks.find(s => s.id === id))}; ${JSON.stringify(d.surveyExpeditionSnapshot())}`);
    if (!d.carryActorStack('scientist', originalReserve, 8)) throw Error(`Original reserve cannot fit beside actual paid food: ${JSON.stringify(d.surveyExpeditionSnapshot().carried)}`);
    // Prior municipal scene starts with this genuinely received owned cargo;
    // this fixture does not claim a played laboratory-to-city journey.
    d.configureScientistIdentityTest({ office: true }); d.configureSovereignBargainTest({ collective: true }); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    // Small finite prior population makes physical package hauling practical;
    // generated city source families are checked separately without shrinking them.
    const map = prepared.rawMap, original = d.sovereignBargainSnapshot().bargain.source, g = map.cityGovernments.governments[0];
    const replacements = { [g.roleAssignments.centralAdministration]: original.administrationId, [g.roleAssignments.militaryDefenseCommand]: original.defenseId };
    g.charter.id = original.charterId;
    for (const [role, id] of Object.entries(g.roleAssignments)) g.roleAssignments[role] = replacements[id] || id;
    for (const i of g.institutions) i.id = replacements[i.id] || i.id;
    for (const i of map.strategicCivicHistory.currentInstitutionRows) { i.institutionId = replacements[i.institutionId] || i.institutionId; i.operationalStatus = 'operational'; i.currentCapacityBand = 'functional'; }
    map.cityPolities.polities[0].authority = original.authority;
    map.strategicPoliticalHistory.currentControlRows[0].recognizedAuthorityId = original.authority.id;
    const city = map.strategicPlayableSettlementState.cityRows[0]; city.physicalCondition = 'intact';
    for (const key of Object.keys(city.services)) city.services[key] = 'functional';
    map.publicSettlementDirectory.satelliteCodes = []; map.strategicPlayableSettlementState.satelliteRows = [];
    const political = window.HelixCityAuthority.sourceFromWorld(map, 'a'), operation = window.HelixCityRule.sourceFromWorld(map, 'a', { politicalSettlement: true }), defense = window.HelixCityDefense.sourceFromWorld(map, 'a', { politicalSettlement: true });
    if (!operation || operation.farms.length) throw Error('Original farmless source failed');
    if (!d.configureCityAuthorityTest([{ political, operation, defense, rawMap: map }])) throw Error('Original city prior inputs refused');
    if (!d.scientistIdentityAction('walk')) throw Error('Counter walk refused');
    for (let n = 0; n < 60; n++) { const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true); }
    d.advanceCityRuleForTest(0);
  }, { prepared: recoverySources('groundConvoy', 12), id: paidLot.id });
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-city-authority]'), act = name => panel.locator(`[data-city-authority-action="${name}"][data-city-authority-target="a"]`).click();
  await act('inspect'); await tick(page, 60); await act('negotiate'); await tick(page, 180); await act('accept'); await tick(page, 60);
  await act('operate'); await tick(page, 3600);
  let e = (await snapshot(page)).saved.entries[0]; expect(e.operation.farms).toEqual([]); expect(e.operation.accomplishment).toBeNull();
  const allocation = e.operation.allocatedAt, initialFood = e.operation.initialFoodKg;
  await panel.getByRole('spinbutton', { name: 'City food package quantity' }).fill('20');
  await panel.locator('[data-city-food-action="fieldRation"]').click(); await tick(page, 10);
  e = (await snapshot(page)).saved.entries[0]; expect(e.operation.foodDelivery.progress).toBe(10); expect(e.operation.deliveredFoodKg).toBe(0);
  const partial = e.operation.foodDelivery;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved.entries[0].operation.foodDelivery).toEqual(partial);
  await tick(page, 30); expect((await snapshot(page)).saved.entries[0].operation.deliveredFoodKg).toBe(10);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityClientForTest(3 * 86400));
  await act('receiveOperation'); e = (await snapshot(page)).saved.entries[0];
  expect(e.operation.status).toBe('established'); expect(e.operation.initialFoodKg).toBe(initialFood);
  expect(e.operation.initialFoodKg + e.operation.deliveredFoodKg - e.operation.eatenKg).toBeCloseTo(e.operation.foodKg, 6);
  const historical = e.operation.report, people = e.staff;
  await page.evaluate(() => window.helixHeresyDebug.advanceCityClientForTest(86400));
  e = (await snapshot(page)).saved.entries[0]; expect(e.operation.foodKg).toBe(0); expect(e.operation.since).toBeNull(); expect(e.operation.report).toEqual(historical);
  await panel.getByRole('spinbutton', { name: 'City food package quantity' }).fill('8'); await panel.locator('[data-city-food-action="trailMeal"]').click(); await tick(page, 16);
  e = (await snapshot(page)).saved.entries[0]; expect(e.operation.status).toBe('limited'); expect(e.operation.since).toBeGreaterThan(historical.at);
  expect(e.operation.deliveredFoodKg).toBe(14); expect(e.operation.allocatedAt).toBe(allocation); expect(e.staff).toEqual(people);
  expect(e.operation.accomplishment).toEqual(historical.accomplishment); expect(e.operation.report).toEqual(historical);
  const saved = (await snapshot(page)).saved, bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-food-supply.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  e = (await snapshot(page)).saved.entries[0]; expect(e.operation.runId).not.toBe(saved.runId); expect(e.operation.foodKg).toBe(saved.entries[0].operation.foodKg);
  expect(e.operation.receipts).toEqual(saved.entries[0].operation.receipts); expect(e.operation.report).toEqual(historical);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = (await snapshot(page)).saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snapshot(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
