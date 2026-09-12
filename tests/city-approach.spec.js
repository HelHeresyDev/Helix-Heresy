const { test, expect } = require('@playwright/test');
const City = require('../city-approach');
const Aid = require('../castaway-assistance');
const { pathToFileURL } = require('url');
const path = require('path');
const destination = { id: 'castaway-test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Camp', distanceKm: 90, temperatureC: 18, precipitationMm: 500, slopePercent: 10 };
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

const provider = () => { const p = Aid.service({ id: 'contact' }, { id: 'pad', cellId: 'pad' }, 'Irena', 0); p.radioSeconds = 14400; return p; };
const gate = (capacityBand = 'functional') => City.gate({ id: 'gate', cityId: 'a', institutionId: 'civic-a', capacityBand, createdAt: 0,
  clerk: { id: 'clerk', mapCell: { x: 10, y: 6, z: 16 } }, guard: { id: 'guard', mapCell: { x: 12, y: 7, z: 16 } } });
const person = { id: 'scientist', sourceCityId: 'a', sourceOrderId: 'completed-order' };
const evidence = { present: true, sourceOrderId: 'completed-order', connection: true, recognition: 'domestic' };
test('checkpoint permission does not erase banishment, reopen punishment, or admit passengers', () => {
  const s = City.create(), p = provider(), g = gate(), t = City.request(s, g.id, p.id, [person], 60, 0);
  expect(City.offer(t, g, p, 120)).toBe(true); expect(City.checkpointAuthorized(t, 'scientist')).toBe(false);
  expect(City.accept(t, g, p, 10000, 121)).toBe(true); expect(City.checkpointAuthorized(t, 'scientist')).toBe(true);
  const bans = [{ personId: 'scientist', cityId: 'a', orderId: 'completed-order', status: 'active', recognizedBy: [] }];
  const before = JSON.stringify(bans), d = City.decision(person, g, evidence, bans, 300);
  expect(d.status).toBe('refused'); expect(d.reason).toContain('not reactivated'); expect(City.canEnter(d, true)).toBe(false); expect(JSON.stringify(bans)).toBe(before);
  t.permit.departedIds = ['scientist']; expect(City.checkpointAuthorized(t, 'scientist')).toBe(false);
});
test('foreign notices and bare recognition labels never become a local ban', () => {
  const g = gate(), b = { personId: 'scientist', cityId: 'foreign', status: 'active', orderId: 'foreign-order', recognizedBy: ['a'] };
  expect(City.decision(person, g, evidence, [b], 0).status).toBe('admitted');
  b.recognizedBy = [{ cityId: 'a', localOrderId: 'local-judicial-order', institutionId: 'judiciary-a', status: 'active' }];
  expect(City.decision(person, g, evidence, [b], 0).status).toBe('refused');
  expect(City.decision({ ...person, id: 'companion' }, g, evidence, [b], 0).status).toBe('admitted');
});
test('identity review is separate from admission and missing facts remain pending', () => {
  const g = gate();
  expect(City.decision(person, g, { ...evidence, present: false }, [], 0).status).toBe('pending');
  expect(City.decision(person, g, { ...evidence, connection: false }, [], 0).status).toBe('pending');
  expect(City.decision(person, g, { ...evidence, recognition: 'caseReview' }, [], 0).status).toBe('pending');
  expect(City.decision(person, g, { ...evidence, recognition: 'refused' }, [], 0).status).toBe('refused');
  const conditional = City.decision(person, gate('strained'), evidence, [], 0);
  expect(conditional.status).toBe('conditional'); expect(conditional.scope).toBe('visitorAnnexOnly');
  expect(City.canEnter(conditional, false)).toBe(false); expect(City.canEnter(conditional, true)).toBe(true);
});
test('fuel, pilot, money, reservations, expiry, and one-time refunds govern the actual round trip', () => {
  const s = City.create(), p = provider(), g = gate(), t = City.request(s, g.id, p.id, [person], 60, 0);
  p.aircraft.fuelKm = 150; expect(City.transportReason(p, 60, 0)).toContain('fuel'); p.aircraft.fuelKm = 1200;
  p.pilot.health = 0; expect(City.transportReason(p, 60, 0)).toContain('pilot'); p.pilot.health = 100;
  City.offer(t, g, p, 120); expect(City.accept(t, g, p, 0, 121)).toBe(false);
  expect(City.accept(t, g, p, 10000, t.offer.expiresAt)).toBe(false);
  expect(City.accept(t, g, p, 10000, 121)).toBe(true); expect(p.aircraft.reservedBy).toBe(t.id); expect(g.berthReservedBy).toBe(t.id);
  expect(City.refund(t)).toBe(540); expect(City.refund(t)).toBe(0);
  t.payment.refunded = false; t.departedAt = 122; expect(City.refund(t)).toBe(0);
  expect(City.request(s, g.id, p.id, [person], 60, 200)).toBeNull();
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
test('city scenes and gate staff remain independently identified across repeat journeys', () => {
  const a = gate(), b = City.gate({ ...a, cityId: 'b', z: 17, createdAt: 100 });
  expect(a.checkpointRoomId).not.toBe(b.checkpointRoomId); expect(a.doorId).not.toBe(b.doorId); expect(b.clerk.mapCell.z).toBe(17);
});
async function fixture(page, options = {}) {
  await setup(page, options.companion ? [{ name: 'Dara Fen' }] : []);
  expect(await page.evaluate(() => window.helixHeresyDebug.prepareCastawayAssistanceForTest())).toBe(true);
  expect(await page.evaluate(options => window.helixHeresyDebug.prepareCityApproachForTest(options), options)).toBe(true);
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityApproachSnapshot());
const gateWork = (page, kind, data = {}) => page.evaluate(({ kind, data }) => window.helixHeresyDebug.queueGateWork(kind, data, { confirmed: true, deferRender: true }), { kind, data });
const configureGate = (page, options) => page.evaluate(options => window.helixHeresyDebug.configureGateEnforcementForTest(options), options);
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceCityApproachForTest(seconds), seconds);
async function work(page, kind, data = {}) {
  const queued = await page.evaluate(({ kind, data }) => window.helixHeresyDebug.queueCityApproachWork(kind, data, { confirmed: true, deferRender: true }), { kind, data });
  expect(queued, kind === 'enter' && !queued ? JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.cityApproachEntryDiagnostic())) : kind).toBe(true);
  await advance(page, 180);
}
async function arrive(page, companionId = '') {
  expect(await page.evaluate(id => window.helixHeresyDebug.requestCityApproach('test-city-gate', id, { deferRender: true }), companionId)).toBe(true);
  await advance(page, 120); expect((await snapshot(page)).trips.at(-1).status).toBe('offered');
  expect(await page.evaluate(() => window.helixHeresyDebug.acceptCityApproach({ confirmed: true, deferRender: true }))).toBe(true);
  await advance(page, 300); expect((await snapshot(page)).trips.at(-1).status).toBe('boarding');
  await work(page, 'outboundBoard');
  let s = await snapshot(page); expect(s.roomId).toBe(Aid.CABIN); expect(s.trips.at(-1).status).toBe('outbound');
  await advance(page, s.trips.at(-1).offer.flightSeconds + 30);
  s = await snapshot(page); expect(s.roomId).toBe(s.gates[0].checkpointRoomId); expect(s.trips.at(-1).status).toBe('checkpoint');
}
test('gate breach creates separate local custody through physical property intake and survives reload', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page); await arrive(page); await work(page, 'inspect'); await advance(page, 180);
  const before = await snapshot(page);
  expect(await gateWork(page, 'cross')).toBe(false); await advance(page, 5);
  expect((await snapshot(page)).gates[0].enforcement.cases).toHaveLength(0);
  await configureGate(page, { open: true }); expect(await gateWork(page, 'cross')).toBe(true);
  await advance(page, 30); let s = await snapshot(page), e = s.gates[0].enforcement;
  expect(s.roomId).toBe(s.gates[0].annexRoomId); expect(e.cases).toHaveLength(1); expect(e.cases[0].status).toBe('referred'); expect(e.response).toBeNull();
  await advance(page, 500); s = await snapshot(page); e = s.gates[0].enforcement;
  expect(e.response.stage, JSON.stringify({ response: e.response, cell: s.cell, tasks: s.tasks })).toBe('jailed');
  expect(s.roomId).toBe(e.cellRoomId); expect(e.jail.stays[0].facility.cityId).toBe(s.gates[0].cityId);
  await page.evaluate(() => window.helixHeresyDebug.advanceCityApproachForTest(0, { render: true }));
  await expect(page.locator('[data-gate-enforcement="true"]')).toContainText('Temporary local jail');
  expect(e.jail.stays[0].transport.mode).toBe('foot'); expect(e.cases[0].judgment).toBeNull();
  for (const id of e.propertyIds) { const stack = s.stacks.find(x => x.id === id); expect(stack.roomId).toBe(e.officeRoomId); expect(stack.carriedBy).toBeFalsy(); }
  expect(s.cases).toEqual(before.cases); expect(s.banishments).toEqual(before.banishments);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snapshot(page)).gates[0].enforcement).toEqual(e);
  expect(await gateWork(page, 'water')).toBe(true); await advance(page, 100);
  expect((await snapshot(page)).stacks.find(x => x.id === e.waterId).quantity).toBe(11);
  expect(await gateWork(page, 'counsel')).toBe(true); await advance(page, 7300);
  s = await snapshot(page); const request = s.gates[0].enforcement.jail.stays[0].communications.requests[0]; expect(request.status).toBe('ready');
  expect(await gateWork(page, 'speakCounsel', { requestId: request.id })).toBe(true); await advance(page, 1900);
  s = await snapshot(page); expect(s.gates[0].enforcement.jail.stays[0].communications.requests[0].status, JSON.stringify(s.tasks)).toBe('completed');
  expect(await gateWork(page, 'review')).toBe(true); await advance(page, 1100);
  expect((await snapshot(page)).gates[0].enforcement.reviews.at(-1).result.kind).toBe('scopeConfirmed');
  await configureGate(page, { sourceActorId: 'corrected-other-person' }); const amended = (await snapshot(page)).cases;
  expect(await gateWork(page, 'review')).toBe(true); await advance(page, 1200);
  s = await snapshot(page); expect(s.gates[0].enforcement.response.stage).toBe('released'); expect(s.roomId).toBe(s.gates[0].checkpointRoomId); expect(s.cases).toEqual(amended); expect(errors).toEqual([]);
});
test('cancelled or unseen gate crossing produces no allegation and lifted bans are reviewed without pardon', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page); await arrive(page); await work(page, 'inspect'); await advance(page, 180);
  await configureGate(page, { open: true }); expect(await gateWork(page, 'cross')).toBe(true);
  await configureGate(page, { cancelCross: true }); await advance(page, 10);
  let s = await snapshot(page); expect(s.gates[0].enforcement.intent).toBeNull(); expect(s.gates[0].enforcement.cases).toHaveLength(0);
  await configureGate(page, { guardHealth: 0 }); expect(await gateWork(page, 'cross')).toBe(true); await advance(page, 30);
  s = await snapshot(page); expect(s.roomId).toBe(s.gates[0].annexRoomId); expect(s.gates[0].enforcement.cases).toHaveLength(0);
  await configureGate(page, { guardHealth: 100, banStatus: 'lifted' });
  expect(await gateWork(page, 'review')).toBe(true); await advance(page, 1100);
  s = await snapshot(page); expect(s.gates[0].enforcement.reviews.at(-1).result.kind).toBe('corrected'); expect(s.trips.at(-1).decisions[0].status).toBe('admitted'); expect(errors).toEqual([]);
});
test('physical local refusal preserves separate passenger admission and paid return without arrest', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page, { companion: true, companionRelief: true }); let before = await snapshot(page); const companion = before.actors[0].id;
  expect(await page.evaluate(id => window.helixHeresyDebug.requestCityApproach('test-city-gate', id, { deferRender: true }), companion)).toBe(false);
  await work(page, 'invite', { personId: companion, gateId: 'test-city-gate' });
  await arrive(page, companion);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCityApproachWork('enter', {}, { confirmed: true, deferRender: true }))).toBe(false);
  await work(page, 'inspect'); await advance(page, 180); let s = await snapshot(page);
  expect(s.trips.at(-1).decisions.map(d => d.status)).toEqual(['refused', 'admitted']);
  expect(s.banishments).toEqual(before.banishments); expect(s.cases).toEqual(before.cases);
  expect(s.roomId).toBe(s.gates[0].checkpointRoomId); expect(s.provider.aircraft.fuelKm).toBe(1140);
  await work(page, 'companionEnter', { personId: companion }); s = await snapshot(page);
  expect(s.actors[0].roomId).toBe(s.gates[0].annexRoomId); expect(s.trips.at(-1).enteredIds).toEqual([companion]);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await work(page, 'returnBoard'); s = await snapshot(page); expect(s.roomId).toBe(Aid.CABIN);
  await advance(page, s.trips.at(-1).offer.flightSeconds + 30); s = await snapshot(page);
  expect(s.roomId).toBe(Aid.PAD); expect(s.trips.at(-1).status).toBe('returned'); expect(s.provider.aircraft.fuelKm).toBe(1080);
  expect(s.trips.at(-1).returningIds).toEqual(['scientist']); expect(s.actors[0].roomId).toBe(s.gates[0].annexRoomId); expect(s.money).toBe(before.money - 540);
  expect(s.health).toBe(before.health); expect(s.stacks.map(x => x.id).sort()).toEqual(before.stacks.map(x => x.id).sort());
  expect(s.cases).toEqual(before.cases); expect(errors).toEqual([]);
});
test('foreign conditional refuge requires physical inspection and accepted scope; releasing aircraft is explicit', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page, { foreign: true, conditional: true }); const before = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.requestCityApproach('test-city-gate', '', { deferRender: true }))).toBe(true);
  await advance(page, 120); expect(await page.evaluate(() => window.helixHeresyDebug.acceptCityApproach({ confirmed: true, deferRender: true }))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureCityApproachForTest({ condition: 20 })); await advance(page, 300);
  expect((await snapshot(page)).money).toBe(before.money);
  await page.evaluate(() => window.helixHeresyDebug.configureCityApproachForTest({ condition: 100 }));
  await arrive(page);
  await page.evaluate(() => window.helixHeresyDebug.configureCityApproachForTest({ recognition: 'caseReview' }));
  await work(page, 'inspect'); await advance(page, 180); expect((await snapshot(page)).trips.at(-1).decisions[0].status).toBe('pending');
  await page.evaluate(() => window.helixHeresyDebug.configureCityApproachForTest({ recognition: 'verified' }));
  await work(page, 'inspect'); await advance(page, 180);
  let s = await snapshot(page); expect(s.trips.at(-1).decisions[0].status).toBe('conditional');
  expect(s.roomId).toBe(s.gates[0].checkpointRoomId); expect(s.banishments).toEqual(before.banishments);
  await work(page, 'enter'); s = await snapshot(page); expect(s.roomId).toBe(s.gates[0].annexRoomId); expect(s.trips.at(-1).enteredIds).toEqual(['scientist']);
  expect(s.provider.pilot.location).toBe('cityCheckpoint');
  await page.evaluate(() => window.helixHeresyDebug.advanceCityApproachForTest(0, { render: true }));
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator('[data-city-approach]')).toContainText('conditional');
  expect(await page.evaluate(() => window.helixHeresyDebug.releaseCityAircraft({ confirmed: true, deferRender: true }))).toBe(true);
  await advance(page, s.trips.at(-1).offer.flightSeconds);
  s = await snapshot(page); expect(s.trips.at(-1).status).toBe('settled'); expect(s.roomId).toBe(s.gates[0].annexRoomId);
  expect(s.provider.pilot.location).toBe('receivingPad'); expect(s.provider.aircraft.fuelKm).toBe(1080);
  expect(s.cases).toEqual(before.cases); expect(errors).toEqual([]);
});
