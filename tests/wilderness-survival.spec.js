const { test, expect } = require('@playwright/test');
const Survival = require('../wilderness-survival');
const { pathToFileURL } = require('url');
const path = require('path');
const destination = () => ({ id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Cold Woodland Boundary', temperatureC: -8, slopePercent: 20, precipitationMm: 1200, terrain: 'broken ground', jurisdiction: 'No ordinary city jurisdiction', description: 'A bounded local boundary sector, not the whole globe cell.' });
test('wilderness destinations require saved adjacency, walkable land, and no city core', () => {
  const origin = { id: 'a', neighborIds: ['b', 'c', 'd', 'e'] };
  const candidates = ['b', 'c', 'd', 'e', 'f'].map((id) => ({ id, surfaceClass: 'land', slopePercent: 10, temperatureC: 15, biomeLabel: 'Woodland' }));
  candidates[0].surfaceClass = 'ocean'; candidates[1].slopePercent = 60;
  const before = JSON.stringify(candidates);
  expect(Survival.chooseDestination(origin, candidates, ['d'])).toMatchObject({ strategicCellId: 'e', approachCellId: 'a' });
  expect(Survival.chooseDestination(origin, candidates, ['d', 'e'])).toBeNull();
  expect(JSON.stringify(candidates)).toBe(before);
});
test('needs, exposure, and physiological harm are deterministic across chunks and reloads', () => {
  const initial = { ...Survival.defaultState(), thirst: 89, hunger: 89 };
  const whole = Survival.advance(initial, 7200, { working: true, destination: destination() });
  const first = Survival.advance(initial, 3000, { working: true, destination: destination() });
  const second = Survival.advance(Survival.normalizeState(JSON.parse(JSON.stringify(first.state))), 7200, { working: true, destination: destination() });
  expect(second.state).toEqual(whole.state); expect(first.damage + second.damage).toBe(whole.damage);
  expect(whole.damage).toBeGreaterThan(0); expect(whole.warning).toBe(true);
  expect(Survival.advance(Survival.defaultState(), 1).damage).toBe(0);
});
test('water and food satisfy separate needs; rest and shelter mitigate different pressures', () => {
  const initial = { ...Survival.defaultState(), thirst: 60, hunger: 60, exertion: 60 };
  const water = Survival.consume(initial, 'drinkingWater'); expect(water.thirst).toBe(20); expect(water.hunger).toBe(60);
  expect(Survival.consume(water, 'trailMeal').hunger).toBe(20);
  const exposed = Survival.advance(initial, 3600, { destination: destination(), working: true }).state;
  const sheltered = Survival.advance(initial, 3600, { destination: destination(), sheltered: true, resting: true }).state;
  expect(sheltered.exposure).toBeLessThan(exposed.exposure); expect(sheltered.exertion).toBeLessThan(exposed.exertion);
  expect(Survival.fatigueMultiplier(exposed)).toBeGreaterThan(1);
});
test('only powered carried communicators drain; battery state survives reload', () => {
  const state = Survival.defaultState(); state.radios.a = { stackId: 'a', charge: 30, powered: true }; state.radios.b = { stackId: 'b', charge: 30, powered: true };
  const after = Survival.advance(state, 35, { carriedRadioIds: ['a'] }).state;
  expect(after.radios.a).toMatchObject({ charge: 0, powered: false }); expect(after.radios.b.charge).toBe(30);
  expect(Survival.normalizeState(JSON.parse(JSON.stringify(after)))).toEqual(after);
  expect(Survival.warnings([])).toHaveLength(5);
});

async function start(page) {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => {
    const network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] };
    window.helixHeresyDebug.setSurveyExpeditionTestContext({ network, context: { worldId: 'test-world', siteId: 'parcel-test', strategicCellId: 'planet-cell:00009', seed: 'wilderness-test', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 700 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 800, environmentalDifficultyPermille: 200 } } });
  });
  await page.evaluate((destination) => window.helixHeresyDebug.configureWildernessTest({ destination, mode: 'wilderness', autoCare: false }), destination());
}
const snapshot = (page) => page.evaluate(() => window.helixHeresyDebug.wildernessSnapshot());
async function finish(page) {
  await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    for (let i = 0; i < 15; i++) {
      const saved = debug.wildernessSnapshot(), task = saved.tasks.find((entry) => !entry.reason);
      if (!task) return;
      debug.advanceSimulation(Math.max(0, task.dueAt - saved.clock) + 1);
    }
    throw new Error('Physical wilderness work failed to finish: ' + JSON.stringify(debug.wildernessSnapshot().tasks));
  });
}
async function arrive(page) {
  await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    for (let i = 0; i < 8; i++) {
      const state = debug.surveyExpeditionSnapshot();
      if (!['outbound', 'inbound'].includes(state.phase)) return;
      const journey = debug.strategicJourneysSnapshot().journeys.find((entry) => entry.id === state.journeyId);
      if (journey.status === 'stranded') debug.controlSurveyJourney('recover');
      else { debug.advanceStrategicServices(Math.max(0, journey.exactArrivalAt - state.clock) + 1); debug.advanceSimulation(1); }
    }
    throw new Error('Travel did not arrive');
  });
}
test.describe('physical wilderness survival', () => {
  // Six real packing routes plus fieldwork and return advance the complete local simulation.
  test.setTimeout(600000);
  test('entry, fieldwork, shelter, needs, portable reports, reload, and physical withdrawal', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await start(page);
    for (const key of ['environmentalSurveyKit', 'drinkingWater', 'trailMeal', 'fieldShelter', 'satelliteCommunicator', 'relayBattery']) {
      await test.step(`Physically pack ${key}`, async () => {
        expect(await page.evaluate((key) => window.helixHeresyDebug.packSurveyItem(key), key), key).toBe(true); await finish(page);
      });
    }
    await test.step('Board and travel to the defended ground', async () => {
      expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await arrive(page);
    });
    expect(await page.evaluate(() => window.helixHeresyDebug.queueSurvivalConsumption('fieldRation'))).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.enterWilderness())).toBe(true);
    expect((await snapshot(page)).roomId).toBe('supportedSurveyGround');
    await test.step('Walk across the physical boundary', async () => finish(page));
    let saved = await snapshot(page); expect(saved.roomId).toBe(Survival.ROOM); expect(saved.scientistCell).toEqual(Survival.ENTRY);
    expect(await page.evaluate(() => window.helixHeresyDebug.refreshSurveyReport())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestWildernessReport())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.toggleWildernessRadio())).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.requestWildernessReport())).toBe(true);
    await page.evaluate(() => { window.helixHeresyDebug.configureWildernessTest({ radioCharge: 2, thirst: 70, hunger: 60 }); window.helixHeresyDebug.advanceSimulation(3); });
    expect(await page.evaluate(() => window.helixHeresyDebug.requestWildernessReport())).toBe(false);
    const waterCount = (await snapshot(page)).carried.find((stack) => stack.key === 'drinkingWater').quantity;
    expect(await page.evaluate(() => window.helixHeresyDebug.queueSurvivalConsumption('drinkingWater'))).toBe(true); await finish(page);
    saved = await snapshot(page); expect(saved.thirst).toBeLessThan(35); expect(saved.hunger).toBeGreaterThan(59);
    expect(saved.carried.find((stack) => stack.key === 'drinkingWater').quantity).toBe(waterCount - 1);
    expect(await page.evaluate(() => window.helixHeresyDebug.replaceWildernessBattery())).toBe(true); await finish(page);
    expect((await snapshot(page)).radio.charge).toBe(Survival.RADIO_SECONDS);
    const kitId = (await snapshot(page)).carried.find((stack) => stack.key === 'fieldShelter').id;
    expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('deployShelter'))).toBe(true);
    expect((await snapshot(page)).shelter).toBeNull(); await finish(page);
    saved = await snapshot(page); expect(saved.sheltered).toBe(true); expect(saved.shelter.stackId).toBe(kitId);
    expect(saved.carried.some((stack) => stack.id === kitId)).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); expect((await snapshot(page)).sheltered).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.startResourceSurvey('reconnaissance', { x: 25, y: 12, z: 6 }))).toBe(true); await finish(page);
    expect((await snapshot(page)).sheltered).toBe(false);
    const observations = await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot().observations);
    expect(observations[0].siteId).toBe(destination().id);
    expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('packShelter'))).toBe(true); await finish(page);
    saved = await snapshot(page); expect(saved.shelter).toBeNull(); expect(saved.carried.find((stack) => stack.id === kitId)).toBeTruthy();
    await page.locator('[data-workspace-tab="visits"]').click();
    await expect(page.locator('[data-wilderness-survival]')).toContainText('Field Survival');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true);
    expect((await snapshot(page)).roomId).toBe(Survival.ROOM);
    await finish(page); await arrive(page);
    expect((await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot())).phase).toBe('home');
    expect((await snapshot(page)).materialized).toBe(true);
  });
  test('lab routines route to finite reachable food and water; cancellation does not consume', async ({ page }) => {
    await start(page);
    await page.evaluate(() => window.helixHeresyDebug.configureWildernessTest({ thirst: 45, hunger: 45, autoCare: true }));
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    let saved = await snapshot(page); expect(saved.tasks[0].data.action).toBe('consume');
    expect(saved.tasks[0].data.mapPath.length).toBeGreaterThan(1);
    const task = saved.tasks[0];
    const before = await page.evaluate((id) => window.helixHeresyDebug.exportSurveyExpeditionTestState().physicalItemStacks.find((stack) => stack.id === id).quantity, task.data.stackId);
    await page.evaluate((id) => window.helixHeresyDebug.cancelTask(id), task.id);
    expect(await page.evaluate((id) => window.helixHeresyDebug.exportSurveyExpeditionTestState().physicalItemStacks.find((stack) => stack.id === id).quantity, task.data.stackId)).toBe(before);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1)); await finish(page);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1)); await finish(page);
    saved = await snapshot(page); expect(saved.thirst).toBeLessThan(10); expect(saved.hunger).toBeLessThan(10);
    await page.evaluate(() => {
      window.helixHeresyDebug.configureWildernessTest({ thirst: 100, hunger: 100, autoCare: false });
      window.helixHeresyDebug.advanceWildernessNeedsForTest(100 * 3600);
    });
    expect((await snapshot(page)).health).toBe(0);
    const death = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientistDeath);
    expect(JSON.stringify(death)).toContain('physiologicalFailure');
  });
});
