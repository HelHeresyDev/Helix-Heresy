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
    if (wounded) Object.assign(g.foreignCivic.bargain.defender, { health: 12, wardMana: 0, stamina: 0 });
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
