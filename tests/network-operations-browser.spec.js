const { test, expect } = require('@playwright/test');
const { setup, snap: outer, walk, advance, reload } = require('./helpers/outer-approach-visit');
const { source: originalSource } = require('./helpers/network-operating-source');
const snap = p => p.evaluate(() => window.helixHeresyDebug.networkOperationsSnapshot());
const relief = p => p.evaluate(() => window.helixHeresyDebug.countercoalitionReliefSnapshot());
test.setTimeout(900000);
async function prepare(page, renderer, managed) {
  const original = await setup(page, renderer, 'exhausted');
  const source = originalSource();
  if (managed) source.branches[0].charter = { ...source.branches[0].charter, mode: 'delegatedManagement', controllerId: 'original-network' };
  await page.evaluate(source => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), m = s.economy.commodityMarket;
    const g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    const definitions = ['fieldRation', 'drinkingWater', 'metalParts', 'preparedManaCrystals'].map(id => ({ id, label: id, basePrice: 10, supply: 20 }));
    const profile = { cityId: 'a', cityName: 'City A', workshopCapacity: 1, productionSources: [], manufacturingFacilities: [], commodityDefinitions: definitions,
      listings: Object.fromEntries(definitions.map(d => [d.id, { targetSupply: 20, targetDemand: 1, reasons: ['Original municipal stock, not organization property.'] }])) };
    m.cityContext = profile; m.localProduction = window.HelixLocalMarketProduction.create(profile, s.clock);
    m.intercityTrade = window.HelixIntercityTrade.create(profile, [{ ...profile, cityId: 'b' }], s.strategicJourneys.routes, [], definitions, s.clock);
    for (const listing of Object.values(m.listings)) { listing.supply = 20; listing.demand = 1; }
    g.preparedCountercoalitionSources = [{ cityId: 'b', partnerId: 'a', routeId: 'route:ab', interest: 'Restore the original shared receiving corridor.',
      cities: ['a', 'b'].map(cityId => ({ cityId, polityId: `polity:${cityId}`, authorityId: `ruler:${cityId}`, charterId: `charter:${cityId}`, populationSourceId: `population:${cityId}` })),
      relation: { basis: 'corridorNeighbors', posture: 'pragmatic', cooperationReadiness: 'high', communicationCompatibility: 'clear', standingObligations: ['corridorStatusExchange'], grievances: [], permanentAlliance: false } }];
    // Only prior original sources: no request, consent, mandate, receipt,
    // deployment, casualty, map knowledge or paid outcome is injected.
    d.importSurveyExpeditionTestState(s);
    if (!d.setNetworkOperationsTestSource(source)) throw new Error('Original operating source refused');
  }, source);
  const front = await outer(page), c = (await snap(page)).context.clerk.mapCell;
  await walk(page, front.saved.home.roomId, { x: c.x - 1, y: c.y + 1, z: c.z });
  let s = await snap(page); expect(s.context.near).toBe(true); expect(s.saved.requests).toEqual([]);
  await page.locator('[data-network-action="send"][data-network-entry="branch:b"]').click();
  await advance(page, 20); s = await snap(page); expect(s.saved.job.progress).toBe(20); expect(s.saved.requests).toHaveLength(0);
  const spent = s.context.gate.powerSeconds; await reload(page);
  s = await snap(page); expect(s.saved.job.progress).toBe(20); expect(s.context.gate.powerSeconds).toBe(spent);
  await advance(page, 161); s = await snap(page);
  const a = s.saved.accounts.find(a => a.id === 'branch:a'), cBranch = s.saved.accounts.find(a => a.id === 'branch:c');
  expect(a.reply.accepts).toBe(managed); expect(cBranch.reply.accepts).toBe(true);
  expect(cBranch.mandate.controllerId).toBe('original-network'); expect(a.operator.workSeconds).toBe(14340);
  expect(s.public).toEqual([]); expect(s.saved.requests).toHaveLength(1);
  await page.locator('[data-network-action="receive"][data-network-entry="branch:b"]').click();
  await advance(page, 30); s = await snap(page); expect(s.public).toHaveLength(1); expect(s.public[0].replies).toHaveLength(3);
  expect(JSON.stringify(s.public)).not.toMatch(/original-undisclosed|original-opaque|capital|workSeconds|money|latitude/);
  const text = await page.locator('[data-network-operations]').innerText(); expect(text).toContain('Original C Chapter: Scoped accession');
  expect(text).toContain(managed ? 'Original A Chapter: Scoped accession' : 'Original A Chapter: Independent refusal');
  expect(text).not.toMatch(/original-undisclosed|original-opaque|14400|240/);
  expect(s.campaign).toEqual(original.campaign);
  console.info(`${renderer}: attended saved request, original cross-city authorization, independent reply and dated receipt complete`);
  return { original, receipt: s.public, initialMoney: a.money };
}
async function dispatchActualRelief(page) {
  let s = await outer(page);
  await walk(page, s.saved.home.roomId, { ...s.saved.home.cell, x: s.saved.home.cell.x + 1 });
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('shove', id), s.defender.id)).toBe(true);
  await advance(page, 4); s = await outer(page); expect(s.defender.health).toBeGreaterThanOrEqual(50); expect(s.saved.reports.length).toBeGreaterThan(0);
  await walk(page, s.saved.layout.roomId, s.saved.layout.service); await advance(page, 11);
  s = await outer(page); expect(s.saved.phase).toBe('held'); expect(s.saved.relief?.job).toBeTruthy();
  const r = await relief(page); await advance(page, 120 - r.saved.job.progress);
  const sent = await relief(page); expect(sent.saved.phase).toBe('outbound'); expect(sent.saved.mission.driverId).toBe('a:producer-driver-1');
  return sent;
}
test('DOM cross-city independent refusal spends original branch capital on actual carried relief equipment, not municipal trucks or an invented army', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'dom', false);
  const sent = await dispatchActualRelief(page); expect(sent.saved.mission.equipmentSponsor.branchId).toBe('branch:a');
  let s = await snap(page), a = s.saved.accounts.find(a => a.id === 'branch:a');
  expect(a.money).toBe(start.initialMoney - sent.saved.mission.equipmentSponsor.amount); expect(a.payments).toHaveLength(1);
  expect(s.saved.accounts.find(a => a.id === 'branch:c').payments).toEqual([]);
  await advance(page, sent.saved.mission.legSeconds + 100); let r = await relief(page);
  expect(r.saved.mission.deliveredAt, JSON.stringify(r.saved.mission)).toBeTruthy();
  expect(r.items.find(i => i.key === 'metalParts').quantity).toBe(2); expect(r.items.find(i => i.key === 'preparedManaCrystals').quantity).toBe(1);
  expect(r.driver.id).toBe(sent.saved.mission.driverId); const money = a.money;
  await reload(page); s = await snap(page); a = s.saved.accounts.find(a => a.id === 'branch:a');
  expect(a.money).toBe(money); expect(a.payments).toHaveLength(1); expect(s.public).toEqual(start.receipt);
  expect(s.campaign).toEqual(start.original.campaign);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.original.world);
  expect(errors).toEqual([]);
});
test('Canvas delegated accession blocks new branch funding while the independent city can still pay its own actual relief; death freezes accounts', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const start = await prepare(page, 'canvas', true);
  const sent = await dispatchActualRelief(page); expect(sent.saved.mission.equipmentSponsor).toBeNull();
  let s = await snap(page); expect(s.saved.accounts.find(a => a.id === 'branch:a').money).toBe(start.initialMoney);
  expect(s.saved.accounts.every(a => a.payments.length === 0)).toBe(true);
  expect(sent.market.treasury).toBeLessThan(10000); // Organization signature did not bind the municipal treasury.
  await reload(page); s = await snap(page); const frozen = s.saved;
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).saved).toEqual(frozen); expect((await snap(page)).public).toEqual(start.receipt);
  expect(s.campaign).toEqual(start.original.campaign);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(start.original.world);
  expect(errors).toEqual([]);
});
