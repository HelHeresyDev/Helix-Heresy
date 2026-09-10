const { test, expect } = require('@playwright/test');
const Penal = require('../penal-flights');
const Trial = require('../trial-sentencing');
const { pathToFileURL } = require('url');
const path = require('path');
const order = id => ({ id, kind: 'penalFlight', final: true, status: 'commitmentPending' });
const destination = { id: 'penal-landing:test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Castoff Test Wilderness', distanceKm: 90, temperatureC: 18, slopePercent: 10, precipitationMm: 500, description: 'A persistent unsupported wilderness landing.' };

test('seven-day docket freezes only real unique people, selects both craft variants, and splits excess', () => {
  const state = Penal.defaultState();
  for (let i = 0; i < 10; i++) Penal.enroll(state, { id: `person-${i}`, name: `Named Person ${i}`, caseId: `case-${i}` }, order(`order-${i}`), 'city-a', 100 + i);
  expect(Penal.freeze(state, 'city-a', 100 + Penal.WINDOW - 1, state.docket.map(d => d.orderId))).toHaveLength(0);
  const flights = Penal.freeze(state, 'city-a', 100 + Penal.WINDOW, state.docket.map(d => d.orderId));
  expect(flights.map(f => f.roster.length)).toEqual([8, 2]); expect(flights.every(f => f.craft.kind === 'massCastoff')).toBe(true);
  expect(Penal.freeze(state, 'city-a', 200 + Penal.WINDOW, state.docket.map(d => d.orderId))).toHaveLength(0);
  const solo = Penal.defaultState(); Penal.enroll(solo, { id: 'scientist', name: 'Scientist' }, order('solo'), 'city-a', 0);
  expect(Penal.freeze(solo, 'city-a', Penal.WINDOW, ['solo'])[0].craft.kind).toBe('soloCastoff');
  expect(Penal.normalizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
});
test('landing selection rejects supported, ocean, beast-free, steep and out-of-range cells', () => {
  const base = { id: 'cell-good', surfaceClass: 'land', beastPresent: true, supported: false, distanceKm: 100, slopePercent: 10, temperatureC: 18 };
  const bad = [{ ...base, supported: true }, { ...base, beastPresent: false }, { ...base, surfaceClass: 'ocean' }, { ...base, distanceKm: 900 }, { ...base, slopePercent: 35 }];
  expect(Penal.chooseDestination(bad)).toBeNull(); expect(Penal.chooseDestination([...bad, base]).strategicCellId).toBe(base.id);
});
test('legal stays, unavailable craft and weather prevent dispatch; only unloading completes living release', () => {
  const state = Penal.defaultState(); Penal.enroll(state, { id: 'scientist', name: 'Scientist' }, order('one'), 'city-a', 0);
  const flight = Penal.freeze(state, 'city-a', Penal.WINDOW, ['one'])[0]; flight.destination = destination;
  expect(Penal.holdReason(flight, { living: true, validOrder: false })).toContain('stayed');
  flight.craft.available = false; expect(Penal.holdReason(flight, { living: true, validOrder: true })).toContain('unavailable');
  flight.craft.available = true; expect(Penal.holdReason(flight, { living: true, validOrder: true, weatherReason: 'Storm' })).toBe('Storm');
  expect(Penal.release(state, flight, 800000)).toBe(false);
  flight.stage = 'unloading'; expect(Penal.release(state, flight, 800000, { living: false, validOrder: true, physicallyUnloaded: true })).toBe(false);
  expect(Penal.release(state, flight, 800000, { living: true, validOrder: true, physicallyUnloaded: true })).toBe(true);
  expect(state.banishments).toMatchObject([{ cityId: 'city-a', recognizedBy: [], status: 'active' }]);
  expect(Penal.release(state, flight, 800001)).toBe(false); expect(state.banishments).toHaveLength(1);
});
test('Penal Flight sentencing requires capital evidence and explicit local authorization without Public Enemy designation', () => {
  function sentence(allowed, capital = true) {
    const c = Trial.normalizeCase({ id: 'case', status: 'sentencing', phaseStatus: 'inProgress', currentPhaseId: 'sentencing', phases: [{ id: 'sentencing', startedAt: 0 }], sentencingPolicy: { cityId: 'city-a', penalFlightAvailable: allowed }, strategy: { sentencingSubmissionId: 'penalFlight' }, charges: [{ id: 'charge', typeId: capital ? 'violentResistance' : 'prohibitedResearch', weight: 40, verdict: 'guilty', support: [{ id: 'proof', label: 'Officer killed in deliberate lethal attack' }] }] });
    return Trial.completeAppearance({ ...Trial.defaultState(), cases: [c] }, c.id, 2700).order;
  }
  expect(sentence(true)).toMatchObject({ kind: 'penalFlight', publicEnemyDesignation: null, executionMethod: '' });
  expect(sentence(false).kind).toBe('deathRow'); expect(sentence(true, false).kind).not.toBe('penalFlight');
});

async function setup(page, companions = []) {
  page.on('dialog', d => d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'penal-test', publicProspects: {}, truth: {} } }));
  const warrant = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(id => { const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(id); d.updateLawEnforcementRaids(1); d.surrenderToRaid(id); for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 }); }, warrant.raidId);
  expect(await page.evaluate(({ destination, companions }) => window.helixHeresyDebug.preparePenalFlightForTest(destination, companions), { destination, companions })).toBe(true);
}
const snap = page => page.evaluate(() => window.helixHeresyDebug.penalFlightSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advancePenalFlightForTest(n), n);
test.describe('physical Penal Flight', () => {
  test.setTimeout(240000);
  test('custody route, depot inspection, reload, flight, live release and finite physical beacon', async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await setup(page);
    const initial = await snap(page); expect(initial.flights[0].stage).toBe('jailEscort');
    await page.evaluate(() => window.helixHeresyDebug.configurePenalFlightForTest({ stayed: true }));
    await advance(page, 60); expect((await snap(page)).cell).toEqual(initial.cell);
    await page.evaluate(() => window.helixHeresyDebug.configurePenalFlightForTest({ stayed: false }));
    await advance(page, 400); let s = await snap(page);
    expect(s.flights[0].stage, JSON.stringify({ reason: s.flights[0].reason, cell: s.cell, officer: s.flights[0].officer?.mapCell })).toBe('groundTransit'); expect(s.roomId).toBe(Penal.TRANSIT);
    await advance(page, 1800); await advance(page, 400); s = await snap(page);
    expect(['launch', 'airborne'], JSON.stringify({ reason: s.flights[0].reason, cell: s.cell })).toContain(s.flights[0].stage);
    const ids = s.flights[0].allocations.map(a => a.stackId); expect(ids.length).toBe(5);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await advance(page, 4500); s = await snap(page);
    expect(s.flights[0].stage).toBe('released'); expect(s.roomId).toBe(Penal.FIELD); expect(s.health).toBeGreaterThan(0);
    expect(s.suppressed).toContain('Penal Flight'); expect(s.flights[0].allocations.map(a => a.stackId)).toEqual(ids);
    expect(await page.evaluate(id => window.helixHeresyDebug.dropActorStack('scientist', id), s.flights[0].suppressor.physicalStackId)).toBe(false);
    expect(s.cases.find(c => c.id === 'penal-test-case').sentencing.order.status).toBe('completed');
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.sendRescueDistress())).toBe(false);
    const droppedAt = s.cell;
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.configurePenalFlightForTest({ dropBeacon: true }); d.configurePenalFlightForTest({ cell: { x: 28, y: 15, z: 13 } }); });
    await advance(page, 60); expect((await snap(page)).flights[0].report.cell).toEqual(droppedAt);
    await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator('[data-penal-flight]')).toContainText('Solo Castoff Glider');
    expect(errors).toEqual([]);
  });
  test('mass flight preserves a named prisoner, individual supplies, needs and nonterminal death', async ({ page }) => {
    await setup(page, [{ name: 'Dara Fen', crime: 'Convicted lethal assault' }]);
    let s = await snap(page); expect(s.flights[0].craft.kind).toBe('massCastoff'); expect(s.flights[0].roster).toHaveLength(2);
    expect(s.actors[0]).toMatchObject({ name: 'Dara Fen', health: 80, relationship: { scientist: 'unfamiliar' } });
    await advance(page, 600); await advance(page, 2400); await advance(page, 4800); s = await snap(page);
    expect(s.flights[0].stage, JSON.stringify({ reason: s.flights[0].reason, cell: s.cell, prisonerCell: s.actors[0].mapCell })).toBe('released');
    expect(s.actors[0].roomId).toBe(Penal.FIELD); expect(s.actors[0].health).toBe(80);
    expect(s.actors[0].tracker.report.cell).toEqual(s.actors[0].mapCell);
    expect(s.flights[0].allocations).toHaveLength(10);
    expect(s.stacks.filter(x => x.carriedBy === s.actors[0].id).length).toBeGreaterThanOrEqual(5);
    const water = s.stacks.find(x => x.carriedBy === s.actors[0].id && x.key === 'drinkingWater');
    await page.evaluate(() => window.helixHeresyDebug.configurePenalFlightForTest({ prisonerNeeds: { thirst: 60 }, trackerBattery: 0 }));
    await advance(page, 30); s = await snap(page); expect(s.stacks.find(x => x.id === water.id).quantity).toBeLessThan(water.quantity);
    await page.evaluate(() => window.helixHeresyDebug.configurePenalFlightForTest({ prisonerDamage: 100 }));
    s = await snap(page); expect(s.actors[0].status).toBe('dead'); expect(s.health).toBeGreaterThan(0);
    expect(s.stacks.find(x => x.id === water.id).carriedBy).toBe('');
  });
  test('a mid-flight stay returns the living scientist physically to jail without completing banishment', async ({ page }) => {
    await setup(page);
    const initial = await snap(page);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4));
    expect((await snap(page)).clock).toBe(initial.clock + 4);
    await advance(page, 400); await advance(page, 2200);
    expect((await snap(page)).flights[0].stage).toBe('airborne');
    await page.evaluate(() => window.helixHeresyDebug.configurePenalFlightForTest({ stayed: true }));
    await advance(page, 600);
    expect((await snap(page)).flights[0].stage).toBe('returnFlight');
    await advance(page, 3600);
    const s = await snap(page);
    expect(s.flights[0].stage, JSON.stringify({ cell: s.cell, reason: s.flights[0].reason })).toBe('returnedToJail');
    expect(s.cell).toEqual(initial.cell); expect(s.health).toBeGreaterThan(0);
    expect(s.banishments).toEqual([]); expect(s.activeId).toBeNull();
    expect(s.cases.find(c => c.id === 'penal-test-case').sentencing.order.status).not.toBe('completed');
  });
});
