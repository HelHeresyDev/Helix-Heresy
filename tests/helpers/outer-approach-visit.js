const { expect } = require('@playwright/test');
const { startLifecycleRun } = require('./start-lifecycle-run');
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
module.exports = { snap, action, advance, finish, visits, reload, walk, setup };
