const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.outerApproachSnapshot());
const action = (page, a) => page.evaluate(a => window.helixHeresyDebug.outerApproachAction(a), a);
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOuterApproachForTest(n), n);
async function finish(page, kind = 'outer') {
  for (let n = 0; n < 18; n++) {
    const s = await snap(page), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe(''); const seconds = Math.max(1, Math.ceil(t.dueAt - s.clock + 1));
    await page.evaluate(({ seconds, kind }) => {
      const d = window.helixHeresyDebug;
      if (kind === 'passenger') d.advanceForeignReceptionTestTime(seconds);
      else if (kind === 'march') d.advanceOverlandForTest(seconds);
      else d.advanceOuterApproachForTest(seconds);
    }, { seconds, kind });
  }
  throw new Error('Actual walking/attendance did not finish');
}
async function visits(page) { const t = page.locator('[data-workspace-tab="visits"]'); if (await t.getAttribute('aria-current') !== 'page') await t.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function walk(page, roomId, cell) {
  const result = await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true, urgent: true })), { roomId, cell });
  expect(result).toBe(true); await finish(page);
}
async function setup(page, renderer, wounded = false) {
  page.setDefaultTimeout(20000); page.on('dialog', d => d.accept()); await startLifecycleRun(page, `outer-approach-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', assetId: 'original-a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-driver', publicName: 'Original Transport', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00003' },
        ...['a', 'b'].map(id => ({ id: `city:${id}`, cityId: id, label: `City ${id}`, kind: 'fortifiedCity', known: true, jurisdiction: { kind: 'city', cityId: id }, supportComponentId: 'one', cellId: 'planet-cell:00001' }))
      ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], continuity: 'continuous', supportCapable: true, distanceKm: 2 }] } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 10, hunger: 10 });
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] } });
  }, renderer);
  for (let n = 0; n < 2; n++) {
    expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page, 'passenger');
    await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1600));
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page, 'passenger');
  }
  await page.evaluate(wounded => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), g = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    const source = { cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b', defenseName: 'B Defense', populationSourceId: 'population:b',
      authority: { id: 'ruler:b', kind: 'collective', name: 'B Council' }, archive: { routeId: 'route:ab', source: 'Retained chart', sourceDate: null,
        coverage: [{ cellId: 'planet-cell:00001', latitude: 12, longitude: 20 }, { cellId: 'planet-cell:00002', latitude: 16, longitude: 21 }], notes: ['Withheld'] } };
    g.preparedForeignCivicTestSource = source;
    // Explicit initial original personnel, not a victory, assignment or claim.
    g.foreignCivic = window.HelixForeignCivicBargains.create(g, source, { theme: state.worldTheme, seed: state.seed });
    window.HelixDefenderChallenges.prepareDefender(g.foreignCivic.bargain);
    if (wounded) Object.assign(g.foreignCivic.bargain.defender, { health: wounded === 'exhausted' ? 70 : 12, wardMana: 0, stamina: 0,
      ...(wounded === 'exhausted' ? { workSeconds: 0 } : {}) });
    for (const id of ['striking', 'animancy', 'perception', 'evasion']) { state.scientist.skills[id] ||= { xp: 0 }; state.scientist.skills[id].xp = 100000; }
    d.importSurveyExpeditionTestState(state);
    if (!d.setOuterApproachTestSource('b', { cityId: 'b', cityName: 'City B', charterId: 'charter:b', institutionId: 'defense:b', populationSourceId: 'population:b', population: 100,
      installationId: 'population:b:existing-approach-ward', condition: 80, baselineEnergy: 69120 })) throw new Error('Missing original source');
  }, wounded);
  const plan = await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans[0]);
  expect(await page.evaluate(id => window.helixHeresyDebug.intercityMarchAction('depart', id), plan.id)).toBe(true); await finish(page, 'march');
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(8000));
  const original = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    return { body: s.scientist.vocalBodyId, defender: g.foreignCivic.bargain.defender, carrier: s.intercityPassenger.vehicle, campaign: s.campaign, money: s.economy.money,
      world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  expect(await action(page, 'approach')).toBe(true); await advance(page, 1);
  const pending = await snap(page); expect(pending.tasks[0].data.action).toBe('outerApproachTravel');
  await reload(page); expect((await snap(page)).tasks[0].id).toBe(pending.tasks[0].id); await finish(page);
  const arrived = await snap(page); expect(arrived.roomId).toBe(arrived.saved.layout.roomId); expect(arrived.defender.id).toBe(original.defender.id);
  expect(arrived.saved.travelReceipts).toHaveLength(1); expect(arrived.saved.travelReceipts[0].meters).toBe(20);
  return original;
}
test('DOM original defender walks, spends finite station reserve and dangerous personal pulse; save and withdrawal grant no city control', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await setup(page, 'dom');
  let s = await snap(page); await walk(page, s.saved.layout.roomId, s.saved.layout.receiving);
  s = await snap(page); expect(s.defender.mapCell).toEqual(s.saved.layout.post); expect(s.defender.workSeconds).toBeLessThan(original.defender.workSeconds);
  expect(await action(page, 'claim')).toBe(true); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  s = await snap(page); expect(s.saved.phase).toBe('contested'); expect(s.saved.pendingPulse).toBeTruthy();
  const marked = s.saved.pendingPulse, mana = s.defender.wardMana; expect(mana).toBeLessThan(original.defender.wardMana);
  await reload(page); expect((await snap(page)).saved.pendingPulse).toEqual(marked);
  expect(await action(page, 'guard')).toBe(true); const health = (await snap(page)).health; await advance(page, 2);
  expect((await snap(page)).health).toBeLessThan(health); expect((await snap(page)).saved.claim.heldAt).toBeNull();
  // Ordinary melee against the physical station is intercepted from its own reserve.
  s = await snap(page); await walk(page, s.saved.layout.roomId, s.saved.layout.service); const energy = (await snap(page)).saved.station.energy;
  expect(await action(page, 'structure')).toBe(true); const hit = await snap(page);
  expect(hit.saved.station.energy).toBeLessThan(energy - 10); expect(hit.defender.wardMana).toBeLessThanOrEqual(mana);
  expect(await action(page, 'return')).toBe(true); await finish(page);
  s = await snap(page); expect(s.visit).toBeNull(); expect(s.saved.phase).toBe('lost'); expect(s.roomId).toBe(s.saved.layout.stagingRoomId);
  const dated = s.saved.observations; await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(20)); expect((await snap(page)).saved.observations).toEqual(dated);
  await reload(page); s = await snap(page); expect(s.defender.id).toBe(original.defender.id); expect(s.saved.station.energy).toBeLessThan(s.saved.station.initialEnergy);
  expect(JSON.stringify(s.saved.observations)).not.toMatch(/wardMana|stamina|workSeconds|energy/);
  const final = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    body: s.scientist.vocalBodyId, money: s.economy.money, campaign: s.campaign, carrier: s.intercityPassenger.vehicle,
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), valid: d.validateMapScene() }; });
  expect(final.body).toBe(original.body); expect(final.money).toBe(original.money); expect(final.campaign).toEqual(original.campaign);
  expect(final.carrier).toEqual(original.carrier); expect(final.world).toBe(original.world); expect(final.valid).toEqual([]); expect(errors).toEqual([]);
});
test('Canvas shared lethal combat, ten-second physical holding, interruptions, original remains and persistent inner boundary are not sovereignty', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await setup(page, 'canvas', true);
  let s = await snap(page); const home = s.saved.home, checkpoint = home.roomId;
  await walk(page, checkpoint, { x: home.cell.x, y: home.cell.y + 1, z: home.cell.z });
  for (let n = 0; n < 4 && (await snap(page)).defender.status !== 'dead'; n++) { expect(await action(page, 'strike')).toBe(true); await advance(page, 2); }
  s = await snap(page); expect(s.defender.status).toBe('dead'); expect(s.defender.health).toBe(0); const remains = s.defender.mapCell;
  expect(s.saved.phase).toBe('contested'); expect(s.saved.station.energy).toBeGreaterThan(0); expect(s.saved.claim.heldAt).toBeNull();
  await walk(page, s.saved.layout.roomId, s.saved.layout.receiving); await advance(page, 5);
  s = await snap(page); expect(s.saved.phase).toBe('contested'); expect(s.saved.progress).toBeGreaterThan(0); expect(s.saved.progress).toBeLessThan(10);
  await reload(page); await advance(page, 5); s = await snap(page); expect(s.saved.phase).toBe('held'); expect(s.saved.claim.heldAt).toBeTruthy();
  await walk(page, s.saved.layout.roomId, s.saved.layout.entry); await advance(page, 1); expect((await snap(page)).saved.phase).toBe('contested');
  expect(await page.evaluate(roomId => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { allowMultiRoom: true })), s.innerBoundary.roomId)).toBe(false);
  expect(s.innerBoundary.door.lockState).toBe('locked'); expect(s.innerBoundary.door.condition).toBeGreaterThan(0);
  expect(await action(page, 'return')).toBe(true); await finish(page); s = await snap(page); expect(s.saved.phase).toBe('lost');
  expect(s.defender.mapCell).toEqual(remains); expect(s.defender.status).toBe('dead');
  expect(await action(page, 'approach')).toBe(true); await finish(page); s = await snap(page);
  expect(s.defender.id).toBe(original.defender.id); expect(s.defender.status).toBe('dead'); expect(s.defender.mapCell).toEqual(remains);
  expect(s.campaign).toEqual(original.campaign);
  const frozen = s.saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await advance(page, 100); expect((await snap(page)).saved).toEqual(frozen);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world); expect(errors).toEqual([]);
});

const relief = page => page.evaluate(() => window.helixHeresyDebug.countercoalitionReliefSnapshot());
async function prepareRelief(page, renderer) {
  const original = await setup(page, renderer, 'exhausted');
  console.info(`${renderer}: original receiving approach reached`);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), m = s.economy.commodityMarket; s.paused = true;
    const g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    const definitions = ['fieldRation', 'drinkingWater', 'metalParts', 'preparedManaCrystals'].map(id => ({ id, label: id, basePrice: 10, supply: 20 }));
    const profile = { cityId: 'a', cityName: 'City A', workshopCapacity: 1, productionSources: [], manufacturingFacilities: [], commodityDefinitions: definitions,
      listings: Object.fromEntries(definitions.map(d => [d.id, { targetSupply: 20, targetDemand: 1, reasons: ['Explicit original municipal merchant stock.'] }])) };
    // Original independent municipal funds, merchant stores and producer fleet,
    // before any claim/report/decision. No completed relief outcome is injected.
    m.cityContext = profile; m.localProduction = window.HelixLocalMarketProduction.create(profile, s.clock);
    m.intercityTrade = window.HelixIntercityTrade.create(profile, [{ ...profile, cityId: 'b' }], s.strategicJourneys.routes, [], definitions, s.clock);
    for (const listing of Object.values(m.listings)) { listing.supply = 20; listing.demand = 1; }
    g.preparedCountercoalitionSources = [{ cityId: 'b', partnerId: 'a', routeId: 'route:ab', interest: 'Restore the original shared receiving corridor.',
      cities: ['a', 'b'].map(cityId => ({ cityId, polityId: `polity:${cityId}`, authorityId: `ruler:${cityId}`, charterId: `charter:${cityId}`, populationSourceId: `population:${cityId}` })),
      relation: { basis: 'corridorNeighbors', posture: 'pragmatic', cooperationReadiness: 'high', communicationCompatibility: 'clear', standingObligations: ['corridorStatusExchange'], grievances: [], permanentAlliance: false } }];
    d.importSurveyExpeditionTestState(s);
  });
  let s = await snap(page);
  // The wall really hides the frontage from the rear counter. Make an actual
  // witnessed close attack, rather than injecting an omniscient claim report.
  await walk(page, s.saved.home.roomId, { ...s.saved.home.cell, x: s.saved.home.cell.x + 1 });
  expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('shove', id), s.defender.id)).toBe(true);
  await advance(page, 4); s = await snap(page); expect(s.defender.health).toBeGreaterThanOrEqual(50);
  expect(s.saved.reports.length).toBeGreaterThan(0);
  await walk(page, s.saved.layout.roomId, s.saved.layout.service);
  await advance(page, 11); s = await snap(page);
  expect(s.saved.phase).toBe('held'); expect(s.saved.relief?.job, JSON.stringify(await relief(page))).toBeTruthy();
  const before = await relief(page); await advance(page, 20); const partial = await relief(page); expect(partial.saved.job.progress).toBeGreaterThan(0);
  await reload(page); expect((await relief(page)).saved.job.claimId).toBe(before.saved.job.claimId);
  await advance(page, 120 - partial.saved.job.progress); const sent = await relief(page);
  expect(sent.saved.phase, JSON.stringify(sent)).toBe('outbound'); expect(sent.saved.attempts[0].receivedAt).toBeTruthy();
  expect(sent.market.treasury).toBeLessThan(10000); expect(sent.market.production.trucks.filter(t => t.shipment === sent.saved.mission.id)).toHaveLength(1);
  expect(sent.saved.mission.progress).toBeLessThan(sent.saved.mission.legSeconds); expect(sent.saved.mission.driverId).toBe('a:producer-driver-1');
  sent.defenderHealth = (await snap(page)).defender.health;
  console.info(`${renderer}: original truck dispatched after actual witnessed reporting`);
  return { original, before, sent };
}
test('DOM countercoalition relief uses received cause, existing municipal funds/truck, physical unloading and saved supplied recovery', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const { original, sent } = await prepareRelief(page, 'dom');
  await advance(page, 239); let r = await relief(page); expect(r.saved.mission.deliveredAt).toBeNull();
  await advance(page, 40); r = await relief(page); expect(r.driver.id).toBe(sent.saved.mission.driverId); expect(r.driver.mapCell).toBeTruthy();
  expect(r.items.filter(i => i.quantity > 0)).toHaveLength(0); await reload(page);
  await advance(page, 40); r = await relief(page); expect(r.saved.mission.deliveredAt, JSON.stringify(r)).toBeTruthy();
  expect(r.saved.phase).toBe('recovering'); expect(r.saved.recovery.progress).toBeGreaterThan(0);
  expect(r.items.find(i => i.key === 'metalParts').quantity).toBe(2); expect(r.items.find(i => i.key === 'preparedManaCrystals').quantity).toBe(1);
  const items = r.items.map(i => ({ ...i, civicCustody: i.civicCustody ?? null, seizureCustody: i.seizureCustody ?? null }));
  await reload(page); expect((await relief(page)).items).toEqual(items);
  await advance(page, 260); r = await relief(page); expect(r.saved.mission.phase).toBe('returned');
  expect(r.market.production.trucks.find(t => t.id === r.saved.mission.truckId).shipment).toBeNull();
  const outer = await snap(page); expect(outer.defender.id).toBe(original.defender.id); expect(outer.defender.health).toBe(sent.defenderHealth); expect(outer.defender.wardMana).toBe(0);
  expect(outer.defender.stamina).toBe(0); expect(outer.campaign).toEqual(original.campaign); expect(outer.innerBoundary.door.lockState).toBe('locked');
  expect(JSON.stringify(r.saved.observed)).not.toMatch(/"(?:treasury|fuelKm|health|driverId|workSeconds|cargo|trucks)"\s*:/);
  expect(await page.locator('[data-countercoalition-relief="account"]').count()).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
test('Canvas countercoalition relief can be physically resisted: original driver death retains allocated cargo and vehicle without a replacement wave', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const { original, sent } = await prepareRelief(page, 'canvas');
  // Leave the receiving tiles, not the local encounter. The specific seizure
  // remains contested while the scientist intercepts at real municipal ground.
  const s = await snap(page); await walk(page, s.saved.home.roomId, { x: 7, y: 8, z: s.saved.home.cell.z });
  await advance(page, 240); let r = await relief(page);
  expect(r.driver.mapCell).toBeTruthy(); expect(r.saved.mission.deliveredAt).toBeNull();
  // Follow the actual person; no remote hit or injected casualty.
  await walk(page, s.saved.home.roomId, { ...r.driver.mapCell, x: r.driver.mapCell.x + 1 });
  for (let n = 0; n < 8 && (await relief(page)).driver.status !== 'dead'; n++) {
    expect(await page.evaluate(id => window.helixHeresyDebug.startScientistCombatAction('strike', id), r.driver.id)).toBe(true);
    await advance(page, 2);
  }
  r = await relief(page); expect(r.driver.status).toBe('dead'); expect(r.driver.health).toBe(0); const remains = r.driver.mapCell;
  expect(r.saved.mission.deliveredAt).toBeNull(); expect(r.items.filter(i => i.quantity > 0)).toHaveLength(0);
  await reload(page); await advance(page, 300); r = await relief(page);
  expect(r.driver.id).toBe(sent.saved.mission.driverId); expect(r.driver.mapCell).toEqual(remains); expect(r.driver.status).toBe('dead');
  expect(r.saved.attempts).toHaveLength(1); expect(r.market.production.trucks).toHaveLength(2);
  expect(r.market.production.trucks.find(t => t.id === r.saved.mission.truckId).shipment).toBe(r.saved.mission.id);
  expect(r.saved.mission.cargo.reduce((n, i) => n + i.quantity, 0)).toBe(5); expect((await snap(page)).campaign).toEqual(original.campaign);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world); expect(errors).toEqual([]);
});

const settlement = page => page.evaluate(() => window.helixHeresyDebug.campaignSettlementSnapshot());
const settleAction = (page, action, expected = null) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.campaignSettlementAction(action, expected), { action, expected });
async function holdForSettlement(page, kill = false) {
  const original = await setup(page, kill ? 'dom' : 'canvas', true);
  // Explicit original municipal account fixture, not funds generated by a demand.
  await page.evaluate(() => window.helixHeresyDebug.setForeignSuppliesTestContext({
    city: { cityId: 'b' }, standings: [], market: { listings: {} } }));
  let s = await snap(page);
  if (kill) {
    const home = s.saved.home; await walk(page, home.roomId, { ...home.cell, y: home.cell.y + 1 });
    for (let n = 0; n < 4 && (await snap(page)).defender.status !== 'dead'; n++) { expect(await action(page, 'strike')).toBe(true); await advance(page, 2); }
    expect((await snap(page)).defender.status).toBe('dead');
  }
  s = await snap(page); await walk(page, s.saved.layout.roomId, s.saved.layout.receiving);
  if (s.saved.phase !== 'contested') expect(await action(page, 'claim')).toBe(true);
  await advance(page, 11); expect((await snap(page)).saved.phase).toBe('held');
  return original;
}
test('DOM limited settlement uses original sovereign mandate, dead defender, funded halves and physically returned witness without sovereignty', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await holdForSettlement(page, true);
  await page.locator('[data-campaign-settlement-action="demand"]').click();
  const before = await settlement(page); expect(before.saved.job?.kind, JSON.stringify(before)).toBe('negotiate');
  await advance(page, 10); const partial = await settlement(page); expect(partial.saved.job.progress).toBeGreaterThan(0);
  expect(partial.representative.mapCell).not.toEqual(partial.saved.home.cell);
  await reload(page); expect((await settlement(page)).saved.job.progress).toBe(partial.saved.job.progress);
  await advance(page, 120); let s = await settlement(page); expect(s.saved.phase, JSON.stringify(s)).toBe('offered');
  expect(s.saved.mandate.authorityId).toBe(s.saved.source.authority.id); expect(s.treasury).toBe(before.treasury);
  expect(s.money).toBe(before.money); expect(s.saved.offer.amount).toBe(250);
  expect(await settleAction(page, 'accept', { ...s.saved.offer, amount: 500 })).toBe(false);
  await page.locator('[data-campaign-settlement-action="accept"]').click(); await advance(page, 30);
  const unsigned = await settlement(page); expect(unsigned.saved.terms).toBeNull(); await reload(page);
  expect((await settlement(page)).saved.job.progress).toBe(unsigned.saved.job.progress); await advance(page, 31);
  s = await settlement(page); expect(s.saved.phase).toBe('active'); expect(s.money).toBe(before.money + 125);
  expect(s.treasury).toBe(before.treasury - 250); expect(s.saved.heldFunds).toBe(125); expect((await snap(page)).saved.phase).toBe('lost');
  await advance(page, 10); s = await settlement(page); expect(s.representative.mapCell).toEqual(s.saved.watching);
  expect(await action(page, 'return')).toBe(true); await finish(page);
  s = await settlement(page); expect(s.money).toBe(before.money + 125); // No remote balance before the witness completes their own journey.
  await advance(page, 12); s = await settlement(page); expect(s.saved.terms.withdrawnAt).toBeTruthy();
  expect(s.saved.heldFunds).toBe(125); expect(s.saved.witnessTravel.returning).toBe(true);
  const earned = s.saved.terms.withdrawnAt, witnessTravel = s.saved.witnessTravel;
  await reload(page); expect((await settlement(page)).saved.witnessTravel).toEqual(witnessTravel);
  await advance(page, 40); s = await settlement(page);
  expect(s.saved.terms.withdrawnAt).toBe(earned); expect(s.saved.paid).toBe(250); expect(s.money).toBe(before.money + 250);
  expect(s.treasury + s.money + s.saved.heldFunds).toBe(before.treasury + before.money);
  expect(s.representative.id).toBe(before.representative.id); expect(s.representative.mapCell).toEqual(s.saved.home.cell);
  expect(s.assignment).toBeNull(); expect(s.representative.workSeconds).toBeLessThan(before.representative.workSeconds - 180);
  expect(s.saved.history.filter(r => r.kind === 'payment')).toHaveLength(1);
  const report = s.saved.report; await advance(page, 5); expect((await settlement(page)).saved.report).toEqual(report);
  expect((await snap(page)).defender.status).toBe('dead'); expect((await snap(page)).campaign).toEqual(original.campaign);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
test('Canvas limited settlement interrupts on real channel loss, retries same original people and preserves upfront payment on renewed hostile claim', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const original = await holdForSettlement(page);
  expect(await settleAction(page, 'demand'), JSON.stringify(await settlement(page))).toBe(true); await advance(page, 15);
  let s = await settlement(page); const originalId = s.representative.id, power = s.power, spent = s.representative.workSeconds;
  await page.evaluate(() => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').powerSeconds = 0; d.importSurveyExpeditionTestState(state); });
  await advance(page, 1); s = await settlement(page); expect(s.saved.phase).toBe('interrupted'); expect(s.saved.terms).toBeNull();
  expect(s.saved.paid).toBe(0); const beforeMoney = s.money, beforeTreasury = s.treasury;
  await advance(page, 15); s = await settlement(page); expect(s.representative.mapCell).toEqual(s.saved.home.cell);
  await page.evaluate(power => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').powerSeconds = power; d.importSurveyExpeditionTestState(state); }, power);
  expect(await settleAction(page, 'demand')).toBe(true); await advance(page, 135); s = await settlement(page);
  expect(s.saved.phase, JSON.stringify(s)).toBe('offered'); expect(s.representative.id).toBe(originalId);
  expect(s.representative.workSeconds).toBeLessThan(spent); expect(await settleAction(page, 'accept', s.saved.offer)).toBe(true);
  await advance(page, 61); s = await settlement(page); expect(s.saved.phase).toBe('active'); expect(s.money).toBe(beforeMoney + 125);
  expect(await action(page, 'claim')).toBe(true); s = await settlement(page); expect(s.saved.phase).toBe('breached');
  expect(s.money).toBe(beforeMoney + 125); expect(s.treasury).toBe(beforeTreasury - 125); expect(s.saved.heldFunds).toBe(0);
  await reload(page); expect((await settlement(page)).saved.phase).toBe('breached');
  expect(await settleAction(page, 'demand')).toBe(false); expect((await snap(page)).campaign).toEqual(original.campaign);
  const frozen = (await settlement(page)).saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await advance(page, 100); expect((await settlement(page)).saved).toEqual(frozen);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(original.world); expect(errors).toEqual([]);
});
