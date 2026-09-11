const { test, expect } = require('@playwright/test');
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

const contact = () => ({ id: 'known', name: 'Known Contact', trust: 70, unavailableUntil: 0 });
const provider = c => Aid.service(c, { id: 'owned-pad', ownerId: c.id, cellId: 'cell-pad', label: 'Private Pad' }, 'Irena Vale', 0);
const message = { cell: { x: 23, y: 12, z: 13 }, distanceKm: 90, channel: { kind: 'terminal' } };
test('willingness and actual transport capability are separate deterministic requirements', () => {
  const c = contact(), p = provider(c);
  expect(Aid.reason({ ...c, trust: 5 }, p, 90, 10)).toContain('relationship');
  expect(Aid.reason(c, null, 90, 10)).toContain('No existing');
  p.aircraft.fuelKm = 100; expect(Aid.reason(c, p, 90, 10)).toContain('fuel');
  p.aircraft.fuelKm = 1600; p.pilot.health = 20; expect(Aid.reason(c, p, 90, 10)).toContain('pilot');
});
test('unchanged refused requests cannot reroll; offers preserve exact assets and coordinates', () => {
  const c = contact(), p = provider(c), s = Aid.create(); c.trust = 5;
  const r = Aid.request(s, c, p, message, 0); Aid.assess(r, c, p, 60);
  expect(r.status).toBe('refused'); expect(Aid.request(s, c, p, message, 900)).toBeNull();
  c.trust = 70; const retry = Aid.request(s, c, p, message, 900); Aid.assess(retry, c, p, 960);
  expect(retry.offer).toMatchObject({ aircraftId: p.aircraft.id, pilotName: p.pilot.name, rendezvous: message.cell, seats: 2 });
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
test('payment, passenger capacity and expiry require explicit acceptance; refunds occur only once before departure', () => {
  const c = contact(), p = provider(c), s = Aid.create(), r = Aid.request(s, c, p, message, 0);
  Aid.assess(r, c, p, 60);
  expect(Aid.accept(s, r, p, 70, 'cash', 0, ['scientist'])).toBe(false);
  expect(Aid.accept(s, r, p, 70, 'cash', 10000, ['scientist', 'a', 'b'])).toBe(false);
  expect(Aid.accept(s, r, p, 70, 'debt', 0, ['scientist', 'consenting-person'])).toBe(true);
  expect(s.debts[0]).toMatchObject({ debtorId: 'scientist', status: 'reserved', amount: 1075 });
  expect(Aid.refund(s, r)).toBe(0); expect(s.debts[0].status).toBe('cancelled');
  const s2 = Aid.create(), p2 = provider(c), r2 = Aid.request(s2, c, p2, message, 0); Aid.assess(r2, c, p2, 60);
  expect(Aid.accept(s2, r2, p2, 70, 'cash', 10000, ['scientist'])).toBe(true);
  expect(Aid.refund(s2, r2)).toBe(860); expect(Aid.refund(s2, r2)).toBe(0);
  r2.payment.refunded = false; r2.departedAt = 70; expect(Aid.refund(s2, r2)).toBe(0);
});
test('weather can refuse an assessment without fabricating a dispatch', () => {
  const c = contact(), p = provider(c), s = Aid.create(), r = Aid.request(s, c, p, message, 0);
  Aid.assess(r, c, p, 60, 'Unsafe landing weather'); expect(r.status).toBe('refused'); expect(p.aircraft.reservedBy).toBeNull();
});
test('expired offers and duplicate passenger identities cannot reserve transport', () => {
  const c = contact(), p = provider(c), s = Aid.create(), r = Aid.request(s, c, p, message, 0);
  Aid.assess(r, c, p, 60);
  expect(Aid.accept(s, r, p, 70, 'cash', 10000, ['scientist', 'scientist'])).toBe(false);
  expect(Aid.accept(s, r, p, r.offer.expiresAt, 'cash', 10000, ['scientist'])).toBe(false);
  expect(p.aircraft.reservedBy).toBeNull(); expect(s.debts).toEqual([]);
});
test('missed rendezvous returns the aircraft empty and dismantling permanently disables the terminal', async ({ page }) => {
  test.setTimeout(300000);
  await setup(page); await page.evaluate(() => window.helixHeresyDebug.prepareCastawayAssistanceForTest());
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayForTest({ analysis: 3, disableAutoCare: true }));
  for (const kind of ['inspect', 'terminal']) {
    expect(await page.evaluate(kind => window.helixHeresyDebug.queueCastawayWork(kind, '', { deferRender: true }), kind)).toBe(true);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceCastawayForTest(Math.ceil(d.castawaySnapshot().tasks[0].dueAt - d.penalFlightSnapshot().clock) + 2, { deferRender: true }); });
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.requestCastawayPickup('castaway-test-contact', { deferRender: true }))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCastawayAssistanceForTest(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.acceptCastawayPickup('cash', '', { confirmed: true, deferRender: true }))).toBe(true);
  const s = await page.evaluate(() => window.helixHeresyDebug.castawayAssistanceSnapshot());
  await page.evaluate(seconds => window.helixHeresyDebug.advanceCastawayAssistanceForTest(seconds), 300 + s.requests[0].offer.flightSeconds * 2 + 900);
  const after = await page.evaluate(() => window.helixHeresyDebug.castawayAssistanceSnapshot());
  expect(after.requests[0].status).toBe('failed'); expect(after.roomId).toBe('penalFlightWilderness');
  expect(after.money).toBe(9140); expect(after.services[0].aircraft.fuelKm).toBe(1420);
  expect(after.services[0].pilot.location).toBe('receivingPad'); expect(after.requests[0].boardedIds).toBeUndefined();
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayWork('salvage', '', { deferRender: true }))).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceCastawayForTest(Math.ceil(d.castawaySnapshot().tasks[0].dueAt - d.penalFlightSnapshot().clock) + 2, { deferRender: true }); });
  expect((await page.evaluate(() => window.helixHeresyDebug.castawayAssistanceSnapshot())).channel).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayWork('terminal', '', { deferRender: true }))).toBe(false);
});
test('physical negotiated pickup preserves communications, consent, escrow, debt, roster and off-site arrival', async ({ page }) => {
  test.setTimeout(360000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, [{ name: 'Dara Fen' }]);
  expect(await page.evaluate(() => window.helixHeresyDebug.prepareCastawayAssistanceForTest())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayForTest({ analysis: 3, disableAutoCare: true }));
  const snap = () => page.evaluate(() => window.helixHeresyDebug.castawayAssistanceSnapshot());
  const flight = () => page.evaluate(() => window.helixHeresyDebug.penalFlightSnapshot());
  const advance = seconds => page.evaluate(n => window.helixHeresyDebug.advanceCastawayAssistanceForTest(n), seconds);
  const work = async (kind, id = '') => {
    expect(await page.evaluate(({ kind, id }) => window.helixHeresyDebug.queueCastawayWork(kind, id, { deferRender: true }), { kind, id }), kind).toBe(true);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceCastawayForTest(Math.ceil(d.castawaySnapshot().tasks[0].dueAt - d.penalFlightSnapshot().clock) + 2, { deferRender: true }); });
  };
  expect((await snap()).channel).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.requestCastawayPickup('castaway-test-contact', { deferRender: true }))).toBe(false);
  await work('inspect'); await work('terminal'); expect((await snap()).channel.kind).toBe('terminal');
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ cell: { x: 36, y: 19, z: 13 } }));
  expect((await snap()).channel).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ cell: { x: 23, y: 12, z: 13 }, companionTrust: 1 }));
  const companionId = (await flight()).actors[0].id; await work('pickup', companionId);
  expect(await page.evaluate(() => window.helixHeresyDebug.requestCastawayPickup('castaway-test-contact', { deferRender: true }))).toBe(true);
  await advance(60); let s = await snap(); expect(s.requests[0].status).toBe('offered');
  expect(await page.evaluate(id => window.helixHeresyDebug.acceptCastawayPickup('cash', id, { confirmed: true, deferRender: true }), companionId)).toBe(true);
  expect((await snap()).money).toBe(9140);
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ condition: 20 })); await advance(300);
  expect((await snap()).money).toBe(10000); expect((await snap()).requests[0].status).toBe('failed');
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ condition: 100 }));
  expect(await page.evaluate(() => window.helixHeresyDebug.requestCastawayPickup('castaway-test-contact', { deferRender: true }))).toBe(true);
  await advance(60);
  expect(await page.evaluate(id => window.helixHeresyDebug.acceptCastawayPickup('debt', id, { confirmed: true, deferRender: true }), companionId)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ terminalPower: 0, cell: { x: 36, y: 19, z: 13 } }));
  await advance(300); s = await snap(); const r = s.requests.at(-1), seconds = r.offer.flightSeconds;
  expect(r.status).toBe('outbound'); expect(r.lastReport.status).toBe('preparing'); expect(s.debts[0].status).toBe('owed');
  await advance(seconds); s = await snap(); expect(s.requests.at(-1).status).toBe('waiting');
  expect(s.services[0].pilot.cell).toEqual({ x: 23, y: 12, z: 13 }); expect(s.requests.at(-1).lastReport.status).toBe('preparing');
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ cell: { x: 23, y: 13, z: 13 }, refresh: true }));
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ condition: 20 }));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayBoard({ confirmed: true, deferRender: true }))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayAssistanceForTest({ condition: 100 }));
  const before = await flight();
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayBoard({ confirmed: true, deferRender: true }))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCastawayForTest(90, { deferRender: true }));
  s = await snap(); expect(s.roomId, JSON.stringify({ tasks: s.tasks, boardingReason: s.boardingReason, party: s.boardingParty, request: s.requests.at(-1) })).toBe(Aid.CABIN); expect(s.requests.at(-1).boardedIds).toEqual(['scientist', companionId]);
  await advance(seconds + 30); s = await snap(); expect(s.roomId).toBe(Aid.PAD); expect(s.requests.at(-1).status).toBe('complete');
  expect(s.money).toBe(10000); expect(s.debts[0].amount).toBe(1075); expect(s.banishments).toEqual(before.banishments);
  expect(s.services[0].aircraft.fuelKm).toBe(1420);
  const after = await flight(); expect(after.health).toBe(before.health); expect(after.actors[0].health).toBe(before.actors[0].health);
  expect(after.stacks.map(x => x.id).sort()).toEqual(before.stacks.map(x => x.id).sort());
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayWork('inspect', '', { deferRender: true }))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceCastawayForTest(0));
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator('[data-castaway-assistance]')).toContainText('No city gate has admitted you');
  expect(errors).toEqual([]);
});
