const { test, expect } = require('@playwright/test');
const Passenger = require('../intercity-passenger');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
const copy = x => JSON.parse(JSON.stringify(x));
const city = id => ({ cityId: id, assetId: `city:${id}`, currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } });
const standings = id => [{ network: { id: `transport:${id}`, category: 'transport' }, standing: 'licensed', branch: { id: `branch:${id}`, cityId: id, publicName: `City ${id} Passenger Depot`, capacityBand: 'functional', operationalStatus: 'active' } }];
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, reachable: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b', 'c', 'd', 'hidden'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: id !== 'hidden', reachable: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [
  { id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'bc', endpointCityIds: ['b', 'c'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'cd', endpointCityIds: ['c', 'd'], supportCapable: true, continuity: 'continuous', distanceKm: 2 },
  { id: 'bh', endpointCityIds: ['b', 'hidden'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }
] });
const cargo = { kg: 1, l: 1, reserved: false };
function arrived() {
  const first = Passenger.create(city('a'), standings('a'), 0), n = network(), wallet = { money: 5000 };
  expect(Passenger.book(first, Passenger.quote(first, n, 'city:b'), cargo, wallet, 0, 0)).toBe('');
  Passenger.board(first, 0, [{ stackId: 'actual-cargo' }], 'second-hop'); Passenger.advance(first, n, 2000); Passenger.disembark(first);
  return { first, n, wallet, connection: Passenger.connection(first, city('b'), standings('b'), 2000, 0) };
}
test('second service requires its own local original source and cannot replace the first carrier', () => {
  const f = arrived(), sourceCity = city('b'), entries = standings('b'), before = JSON.stringify({ city: sourceCity, entries });
  Passenger.connection(f.first, sourceCity, entries, 2000, 0);
  expect(f.connection.otherCarrier.source).toEqual({ branchId: 'branch:b', populationId: 'city:b', people: 1, vehicles: 1 });
  expect(JSON.stringify({ city: sourceCity, entries })).toBe(before);
  expect(f.connection.otherCarrier.driver.id).not.toBe(f.first.driver.id);
  expect(Passenger.connection(f.first, city('c'), standings('c'), 2000, 0)).toBeNull();
  expect(Passenger.connection(f.first, city('b'), standings('b'), 2000, 1)).toBeNull();
  for (const entries of [[], standings('a'), [{ ...standings('b')[0], standing: 'proscribed' }]])
    expect(Passenger.connection(f.first, city('b'), entries, 2000, 0).otherCarrier).toBeNull();
  expect(Passenger.connection(f.first, { ...city('b'), currentPopulation: 0 }, standings('b'), 2000, 0).otherCarrier).toBeNull();
  expect(f.first.vehicle.fuelKm).toBeCloseTo(2398);
});
test('onward publishes only known supported B neighbors, bounded terminal and separately named fares', () => {
  const { first, connection: c, n, wallet } = arrived(), second = Passenger.selectConnection(c, first, 0);
  expect(Passenger.connectionDestinations(c, second, n)).toEqual(['city:c']);
  const q = Passenger.quote(second, n, 'city:c'); expect(q).toMatchObject({ fee: 108, cargoKg: 20, cargoL: 40 });
  expect(q.directions).toContain('no maps'); expect(JSON.stringify(q)).not.toContain('cellPath');
  expect(Passenger.book(second, q, cargo, wallet, 2000, 0)).toBe('');
  expect(second.booking.id).not.toBe(first.trip.id); expect(wallet.money).toBe(4784);
  c.terminalCityId = 'c'; n.destinations.push({ id: 'city:another', kind: 'fortifiedCity', cityId: 'another', known: true });
  n.routes.push({ id: 'ba', endpointCityIds: ['b', 'another'], supportCapable: true, continuity: 'continuous', distanceKm: 2 });
  expect(Passenger.connectionDestinations(c, { ...second, booking: null }, n)).toEqual(['city:c']);
  n.routes[1].continuity = 'closed'; expect(Passenger.connectionDestinations(c, second, n)).toEqual([]);
  n.routes[1].continuity = 'continuous'; n.destinations.find(d => d.cityId === 'c').supportComponentId = 'disconnected';
  expect(Passenger.connectionDestinations(c, second, n)).toEqual([]);
});
test('selection preserves finite originals, physical city and visit identity; commitments/body prevent transfer', () => {
  const f = arrived(), c = f.connection, visit = c.visitId;
  for (const patch of [{ booking: { id: 'pending' } }, { rest: { remaining: 10 } }, { phase: 'arrival' }, { location: 'c' }])
    expect(Passenger.selectConnection(copy(c), { ...f.first, ...patch }, 0)).toBeNull();
  expect(Passenger.selectConnection(copy(c), f.first, 1)).toBeNull();
  const second = Passenger.selectConnection(c, f.first, 0); second.driver.fatigue = 19; second.vehicle.condition = 70;
  Passenger.advance(c.otherCarrier, f.n, 5000); Passenger.advance(second, f.n, 5000);
  const saved = copy({ c, second }); expect(saved.c.otherCarrier.provisionsSeconds).toBe(96 * 3600 - 5000);
  const firstAgain = Passenger.selectConnection(saved.c, saved.second, 0);
  expect(firstAgain.driver.id).toBe('branch:a:passenger-driver'); expect(firstAgain.vehicle.fuelKm).toBeCloseTo(2398);
  expect(saved.c.otherCarrier).toMatchObject({ driver: { fatigue: 19 }, vehicle: { condition: 70 } });
  expect(saved.c.visitId).toBe(visit);
});
test('two-carrier round trip spends four fares and original fuel; expired waiting reserves prevent home return', () => {
  const { first, connection: c, n, wallet } = arrived(); let selected = Passenger.selectConnection(c, first, 0);
  for (const at of [2000, 4000]) {
    expect(Passenger.book(selected, Passenger.quote(selected, n, 'city:c'), cargo, wallet, at, 0)).toBe('');
    Passenger.board(selected, at, [{ stackId: 'actual-cargo' }], 'second-hop');
    Passenger.advance(selected, n, at + 2000); Passenger.advance(c.otherCarrier, n, at + 2000); Passenger.disembark(selected);
  }
  expect(selected.phase).toBe('home'); expect(selected.location).toBe('b'); expect(selected.vehicle.fuelKm).toBeCloseTo(2396);
  selected = Passenger.selectConnection(c, selected, 0);
  expect(Passenger.book(selected, Passenger.quote(selected, n, 'city:b'), cargo, wallet, 6000, 0)).toBe('');
  Passenger.board(selected, 6000, [], 'second-hop'); Passenger.advance(selected, n, 8000); Passenger.disembark(selected);
  expect(selected.location).toBe('a'); expect(selected.vehicle.fuelKm).toBeCloseTo(2396); expect(wallet.money).toBe(4568);
  const f = arrived(); Passenger.advance(f.first, n, 400000);
  const frozen = JSON.stringify(f.first); expect(Passenger.book(f.first, Passenger.quote(f.first, n, 'city:b'), cargo, f.wallet, 400000, 0)).toContain('Finite');
  expect(JSON.stringify(f.first)).toBe(frozen);
});
test('saved onward holds and death do not advance either original or disclose remote private reserves', () => {
  const f = arrived(), c = f.connection; let second = Passenger.selectConnection(c, f.first, 0);
  Passenger.book(second, Passenger.quote(second, f.n, 'city:c'), cargo, f.wallet, 2000, 0); Passenger.board(second, 2000, [], 'second-hop');
  Passenger.advance(second, f.n, 2100); second = copy(second); const km = second.trip.distanceKm;
  f.n.routes[1].continuity = 'closed'; Passenger.advance(second, f.n, 2300); expect(second.trip.distanceKm).toBe(km);
  const frozen = JSON.stringify({ second, c }); Passenger.advance(second, f.n, 10000, false); Passenger.advance(c.otherCarrier, f.n, 10000, false);
  expect(JSON.stringify({ second, c })).toBe(frozen);
  expect(JSON.stringify(Passenger.publicView(c.otherCarrier))).not.toMatch(/fuelKm|fatigue|condition|manifest|progressSeconds/);
});

function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const value = Civic.create(), office = m.identityOffices[0], ctx = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(value, office, Civic.preview(value, office, 'Mira Vale'), { money: 100 }, ctx, -1800); Civic.advance(value, m.identityOffices, ctx, 0);
  return { identity: value, offices: m.identityOffices };
}
async function finish(page) { await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
  const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
} throw new Error('Physical work did not finish'); }); }
async function municipalTravel(page) { await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 8; n++) {
  const s = d.surveyExpeditionSnapshot(); if (!['outbound', 'inbound'].includes(s.phase)) return;
  const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId); d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
} throw new Error('Municipal route did not finish'); }); }
async function leg(page, destination, interrupted = false) {
  const booked = await page.evaluate(destination => { const d = window.helixHeresyDebug, before = d.intercityPassengerSnapshot().money, ok = d.bookIntercityPassenger(destination), s = d.intercityPassengerSnapshot(); return { ok, before, money: s.money, booking: s.carrier.booking }; }, destination);
  expect(booked.ok).toBe(true); expect(booked.money).toBe(booked.before - booked.booking.fee);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  if (interrupted) {
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
    const before = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
    expect(before.carrier.phase).toBe('outbound'); expect(before.carrier.trip.distanceKm).toBeGreaterThan(0);
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.strategicJourneys.routes.find(r => r.id === 'bc').continuity = 'closed'; d.importSurveyExpeditionTestState(s); d.advanceSimulation(60); });
    const held = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot()); expect(held.carrier.trip.distanceKm).toBe(before.carrier.trip.distanceKm);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.reloadSurveyExpeditionTestState(); const s = d.exportSurveyExpeditionTestState(); s.strategicJourneys.routes.find(r => r.id === 'bc').continuity = 'continuous'; d.importSurveyExpeditionTestState(s); });
    expect((await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot())).carrier.vehicle.fuelKm).toBe(held.carrier.vehicle.fuelKm);
  }
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 6; n++) { const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return;
    const t = s.carrier.trip; d.advanceSimulation(Math.max(1, t.seconds - t.progressSeconds + t.delaySeconds + 1));
  } throw new Error('Passenger leg did not arrive'); });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
}
async function admit(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect((await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot())).permission).not.toBeNull();
  const point = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot().carrier.spaces.outer);
  expect(await page.evaluate(p => window.helixHeresyDebug.startScientistMove(p.roomId, { toCell: p.cell, allowMultiRoom: true }), point)).toBeTruthy(); await finish(page);
}
for (const renderer of ['dom', 'canvas']) test(`second-hop physical travel, independent reception, saved originals and ${renderer === 'dom' ? 'municipal lab return' : 'unavailable homeward carrier'} through ${renderer}`, async ({ page }) => {
  test.setTimeout(1200000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ network, city, standings, connectionSource, identity, renderer }) => {
    const d = window.helixHeresyDebug;
    if (renderer === 'dom') d.setSurveyExpeditionTestContext({ network, connectionSource, passengerSource: { city, standings },
      context: { worldId: 'second-hop-world', siteId: 'parcel', strategicCellId: 'planet-cell:00009', seed: 'second-hop', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 900 }, typicalDepth: { ferrousOre: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } },
      carrierSource: { strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } } });
    else d.setIntercityPassengerTestContext({ network, city, standings, connectionSource });
    d.setForeignReceptionTestContext({ source: { ...city, cityId: 'b', administrationId: 'admin:b', administrationName: 'City b Administration', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] }, ...identity });
    d.setMapRenderer(renderer);
  }, { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') }, identity: identity(), renderer });
  await page.locator('[data-workspace-tab="visits"]').click();
  if (renderer === 'dom') {
    for (const key of ['environmentalSurveyKit', 'sealedReagentBottle', 'medicalBandage', 'fieldRation']) { expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), key)).toBe(true); await finish(page); }
    expect(await page.evaluate(() => window.helixHeresyDebug.reserveMunicipalCarrier())).toBe(true);
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.surveyExpeditionSnapshot(), j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.carrier.journeyId); d.advanceSimulation(j.exactArrivalAt - s.clock + 1); });
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
  }
  const before = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  await leg(page, 'city:b'); await admit(page);
  const firstB = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot());
  const panel = page.locator('[data-intercity-passenger]');
  await panel.getByRole('button', { name: 'Inspect and Select Local Onward Carrier', exact: true }).click();
  const transfer = await page.evaluate(() => { const d = window.helixHeresyDebug; return { p: d.intercityPassengerSnapshot(), r: d.foreignReceptionSnapshot(), municipal: d.boardSurveyVehicle(), wider: d.bookIntercityPassenger('city:d') }; });
  expect(transfer.p.carrier.homeCityId).toBe('b'); expect(transfer.p.roomId).toBe('passenger-outer-b'); expect(transfer.p.surveyContext).toBeNull(); expect(transfer.municipal).toBe(false); expect(transfer.wider).toBe(false);
  expect(transfer.r.permission.id).toBe(firstB.permission.id); expect(transfer.r.context.visitId).toBe(firstB.context.visitId);
  const dated = transfer.p.connection.otherCarrier.observation;
  // Prepare only C's original source after B has actual rooms, just as the
  // production allocator does. Do not replenish the already-used identity issuer.
  await page.evaluate(source => window.helixHeresyDebug.setForeignReceptionTestContext({ source }),
    { ...city('c'), administrationId: 'admin:c', administrationName: 'City c Administration', watchId: 'watch:c', lawId: 'law:c', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] });
  await leg(page, 'city:c', true);
  const c = await page.evaluate(() => { const d = window.helixHeresyDebug; return { p: d.intercityPassengerSnapshot(), r: d.foreignReceptionSnapshot(), switch: d.selectIntercityConnection(), wider: d.bookIntercityPassenger('city:d') }; });
  expect(c.p.roomId).toBe('passenger-outer-c'); expect(c.r.permission).toBeNull(); expect(c.r.gate.cityId).toBe('c'); expect(c.r.gate.clerk.id).not.toBe(firstB.gate.clerk.id); expect(c.switch).toBe(false); expect(c.wider).toBe(false);
  expect(c.p.connection.otherCarrier.observation).toEqual(dated); expect(c.p.connection.otherCarrier.provisionsSeconds).toBeLessThan(transfer.p.connection.otherCarrier.provisionsSeconds);
  expect(c.p.connection.otherCarrier.vehicle.fuelKm).toBe(transfer.p.connection.otherCarrier.vehicle.fuelKm);
  await admit(page); await leg(page, 'city:c');
  const returnB = await page.evaluate(() => { const d = window.helixHeresyDebug; return { p: d.intercityPassengerSnapshot(), r: d.foreignReceptionSnapshot() }; });
  expect(returnB.p.roomId).toBe('passenger-outer-b'); expect(returnB.p.carrier.phase).toBe('home'); expect(returnB.r.permission).toBeNull();
  expect(returnB.r.context.visitId).not.toBe(firstB.context.visitId); expect(returnB.r.gate.visitorAdmission.permits[0].expiresAt).toBeGreaterThan(returnB.p.clock);
  expect(returnB.p.carrier.vehicle.fuelKm).toBeCloseTo(2396); expect(returnB.p.carrier.receipts).toHaveLength(2);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await panel.getByRole('button', { name: 'Select Original Homeward Carrier', exact: true }).click();
  const selected = await page.evaluate(() => { const d = window.helixHeresyDebug; return { p: d.intercityPassengerSnapshot(), r: d.foreignReceptionSnapshot() }; });
  expect(selected.p.carrier.driver.id).toBe(before.carrier.driver.id); expect(selected.p.carrier.vehicle.fuelKm).toBeCloseTo(2398);
  expect(selected.r.permission).toBeNull(); expect(selected.r.context.visitId).toBe(returnB.r.context.visitId);
  if (renderer === 'dom') {
    await leg(page, 'city:b'); const homeA = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
    expect(homeA.roomId).toBe('supportedSurveyGround'); expect(homeA.carrier.vehicle.fuelKm).toBeCloseTo(2396); expect(homeA.carrier.receipts).toHaveLength(2);
    expect(homeA.money).toBe(before.money - 4 * 108 - 2 * 40);
    expect(homeA.carried.map(i => i.id)).toEqual(before.carried.map(i => i.id)); expect(homeA.connection.otherCarrier.vehicle.fuelKm).toBeCloseTo(2396);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
    expect((await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot())).phase).toBe('home');
  } else {
    await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.intercityPassenger.provisionsSeconds = 0; d.importSurveyExpeditionTestState(s); });
    expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    const depleted = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot()); expect(depleted.roomId).toBe('passenger-outer-b'); expect(depleted.carrier.driver.id).toBe(before.carrier.driver.id); expect(depleted.carrier.provisionsSeconds).toBe(0);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100000); });
    const dead = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot()); expect(dead.carrier).toEqual(depleted.carrier); expect(dead.connection).toEqual(depleted.connection);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull(); expect(errors).toEqual([]);
});
test('replacement body cannot inherit selected B depot service or switch to the waiting A carrier', async ({ page }) => {
  test.setTimeout(300000);
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(f => window.helixHeresyDebug.setIntercityPassengerTestContext(f), { network: network(), city: city('a'), standings: standings('a'), connectionSource: { city: city('b'), standings: standings('b') } });
  await leg(page, 'city:b');
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(true);
  const original = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  expect(original.carrier.phase).toBe('home'); expect(original.carrier.trip).toBeNull();
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.scientistIdentity.bodyEpoch += 1; d.importSurveyExpeditionTestState(s); });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:c'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectIntercityConnection())).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  const lost = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  expect(lost.carrier.phase).toBe('bodyLost'); expect(lost.money).toBe(original.money);
  expect(lost.carrier.vehicle).toEqual(original.carrier.vehicle); expect(lost.carrier.provisionsSeconds).toBe(original.carrier.provisionsSeconds);
  expect(lost.connection.otherCarrier).toEqual(original.connection.otherCarrier);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.reloadSurveyExpeditionTestState(); d.advanceSimulation(60); });
  const frozen = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  expect(frozen.carrier).toEqual(lost.carrier); expect(frozen.connection).toEqual(lost.connection);
  // A replacement physically placed at its home receiver is not the old
  // passenger. Keep both archived original carriers, but release lab access.
  const received = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), point = s.surveyExpeditions.departure;
    s.scientist.roomId = point.roomId; s.scientist.mapCell = point.cell; s.surveyExpeditions.phase = 'home'; d.importSurveyExpeditionTestState(s);
    d.queueSurveyLabTestTask(); return d.intercityPassengerSnapshot();
  });
  expect(received.carrier).toEqual(lost.carrier); expect(received.connection).toEqual(lost.connection);
  expect(received.tasks.find(t => t.type === 'researchWork').reason).not.toMatch(/off.?site|away|passenger/i);
});
