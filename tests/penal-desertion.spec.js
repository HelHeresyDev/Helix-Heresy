const { test, expect } = require('@playwright/test');
const Desertion = require('../penal-desertion');
const Service = require('../penal-service');
const Legion = require('../penal-legion');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const s = { id: 'service', phase: 'field', termMonths: 12, startedAt: 100, jailStayId: 'jail', history: [] };
  Service.ledger(s, { id: 'jail', bookedAt: 0 }); return s;
}
test('intent and ordinary separation are not observations or an automatic conviction', () => {
  const s = fixture(); expect(Desertion.begin(s, 200)).toBe(true);
  expect(s.desertion.observations).toEqual([]); expect(s.desertion.newConviction).toBe(false);
  expect(Desertion.observe(s.desertion, 'guard', { x: 30, y: 16, z: 1 }, 201)).toBe(false);
  expect(Desertion.observe(s.desertion, 'guard', { x: 39, y: 16, z: 1 }, 202)).toBe(true);
  expect(s.desertion.observations[0].allegationOnly).toBe(true);
  expect(s.ledger.suspendedAt).toBeUndefined();
});
test('pursuit uses a short-lived last-known position and never renews from hidden information', () => {
  const s = fixture(); Desertion.begin(s, 200); const d = s.desertion;
  Desertion.observe(d, 'guard', { x: 40, y: 16, z: 1 }, 201);
  expect(Desertion.searchTarget(d, 210).x).toBe(40);
  expect(Desertion.searchTarget(d, 222)).toBeNull();
  Desertion.observe(d, 'guard', { x: 42, y: 16, z: 1 }, 320);
  expect(Desertion.searchTarget(d, 322)).toBeNull();
  expect(d.pursuitUntil).toBe(321);
});
test('escape needs physical exit, mobility and broken control, while restraint needs one present capable actor', () => {
  const s = fixture(); Desertion.begin(s, 200);
  const facts = { mobile: true, atExit: true, controlled: false };
  expect(Desertion.canEscape(s, 210, facts)).toBe(true);
  for (const f of [{ mobile: false }, { atExit: false }, { controlled: true }]) expect(Desertion.canEscape(s, 210, { ...facts, ...f })).toBe(false);
  const contact = { actorId: 'guard-a', authorized: true, capable: true, adjacent: true, observed: true, threatened: false };
  expect(Desertion.restraint(s.desertion, 9, contact)).toBe(false);
  expect(Desertion.restraint(s.desertion, 1, { ...contact, actorId: 'guard-b' })).toBe(false);
  expect(Desertion.restraint(s.desertion, 9, { ...contact, adjacent: false })).toBe(false);
  expect(Desertion.restraint(s.desertion, 10, contact)).toBe(true);
});
test('successful escape freezes the exact remainder across reload and repeated recapture preserves all prior credit', () => {
  const s = fixture(); s.ledger.reductions = [{ assignmentId: 'repair', seconds: 604800 }]; s.ledger.releaseAt -= 604800;
  const original = s.ledger.originalReleaseAt, deadline = s.ledger.releaseAt;
  expect(Service.interrupt(s, 200, 'escape-a')).toBe(true); const remaining = s.remainingSeconds, served = s.ledger.servedSeconds;
  const loaded = copy(s), returnAt = deadline + 10000; expect(Service.accrue(loaded, returnAt)).toBe(false);
  expect(loaded.remainingSeconds).toBe(remaining); expect(loaded.serviceEndedAt).toBeUndefined();
  Legion.credit(loaded, deadline + 10000); expect(loaded.remainingSeconds).toBe(remaining);
  expect(Service.interrupt(loaded, 500, 'duplicate')).toBe(false);
  expect(Service.resume(loaded, returnAt)).toBe(true); expect(Service.resume(loaded, returnAt + 1)).toBe(false);
  expect(loaded.ledger.releaseAt).toBe(deadline + returnAt - 200); expect(loaded.ledger.servedSeconds).toBe(served);
  Service.accrue(loaded, returnAt + 100); expect(loaded.remainingSeconds).toBe(remaining - 100);
  Service.interrupt(loaded, returnAt + 200, 'escape-b'); Service.resume(loaded, returnAt + 300);
  expect(loaded.ledger.releaseAt).toBe(deadline + returnAt - 100); expect(loaded.ledger.originalReleaseAt).toBe(original);
  expect(loaded.ledger.reductions).toHaveLength(1); expect(loaded.ledger.interruptions).toHaveLength(2);
});
test('expiry wins over an unfinished escape and witnessed conduct never invents loyalty or guilt', () => {
  const s = fixture(); Desertion.begin(s, 200); Service.accrue(s, s.ledger.releaseAt);
  expect(Service.interrupt(s, s.ledger.releaseAt, 'too-late')).toBe(false);
  expect(Desertion.canEscape(s, s.ledger.releaseAt, { mobile: true, atExit: true, controlled: false })).toBe(false);
  expect(Desertion.conduct(s, 'threat', 'guard', [], 201)).toBe(false);
  expect(Desertion.conduct(s, 'aid', 'guard', ['guard'], 202, 'receipt')).toBe(true);
  expect(Desertion.conduct(s, 'aid', 'guard', ['guard'], 203, 'receipt')).toBe(false);
  expect(s.squadConduct[0].reaction).toContain('military obligations remain');
  expect(s.desertion.newConviction).toBe(false);
});

async function setup(page) {
  const { pathToFileURL } = require('url'), path = require('path');
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'desertion-test', publicProspects: {}, truth: {} } }));
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(id => { const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(id); d.updateLawEnforcementRaids(1); d.surrenderToRaid(id); for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 }); }, execution.raidId);
  expect(await page.evaluate(() => window.helixHeresyDebug.preparePenalLegionForTest())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.advancePenalLegionForTest(3000, { untilPhase: 'briefing' }); d.penalLegionAction('deploy'); d.advancePenalLegionForTest(3000, { untilPhase: 'field' }); });
  expect((await snapshot(page)).service.phase).toBe('field');
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
const advance = (page, seconds, untilPhase) => page.evaluate(({ seconds, untilPhase }) => window.helixHeresyDebug.advancePenalDesertionForTest(seconds, { untilPhase }), { seconds, untilPhase });
const walk = (page, x, y) => page.evaluate(({ x, y }) => { const d = window.helixHeresyDebug, s = d.penalLegionSnapshot(); return d.startScientistMove(s.roomId, { toCell: { x, y, z: s.cell.z } }); }, { x, y });

test('browser escape walks into unsupported wilderness, freezes service, and physical surrender resumes only that remainder', async ({ page }) => {
  test.setTimeout(600000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); const before = await snapshot(page), ids = before.squad.map(a => a.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDesertionAction('attempt'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalDesertionForTest(1, { ordinary: true }));
  expect((await snapshot(page)).service.desertion.observations).toEqual([]);
  expect(await walk(page, 64, 16)).toBeTruthy();
  await advance(page, 240, 'deserted'); let s = await snapshot(page);
  expect(s.service.phase, JSON.stringify({ phase: s.service.phase, cell: s.cell, delay: s.service.delay })).toBe('deserted');
  expect(s.cell.x).toBeGreaterThanOrEqual(55); expect(s.suppression).toBe('');
  await advance(page, 90); // Finish the already-issued walk before requesting another route.
  const remainder = s.service.remainingSeconds, freeze = s.service.ledger.suspendedAt;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDesertionForTest({ clockAdvance: 3600 }));
  expect((await snapshot(page)).service.remainingSeconds).toBe(remainder);
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDesertionAction('surrender'))).toBe(true);
  expect(await walk(page, 30, 16)).toBeTruthy(); await advance(page, 240, 'desertionEscort'); s = await snapshot(page);
  expect(s.service.phase, JSON.stringify({ phase: s.service.phase, cell: s.cell, d: s.service.desertion })).toBe('desertionEscort');
  expect(s.service.desertion.property.length).toBeGreaterThan(0);
  expect(s.service.ledger.releaseAt).toBe(before.service.ledger.releaseAt + s.service.desertion.recapturedAt - freeze);
  expect(s.service.ledger.suspendedAt).toBeNull(); expect(s.service.desertion.newConviction).toBe(false);
  await advance(page, 240, 'withdrawal');
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(5000, { untilPhase: 'depotService' }));
  s = await snapshot(page); expect(s.service.phase).toBe('depotService'); expect(s.suppression).toContain('military');
  expect(s.service.desertion.restrained).toBe(false); expect(s.squad.map(a => a.id)).toEqual(ids);
  expect(errors).toEqual([]);
});

test('browser witnessed aid and departure persist; interrupted escape is physically restrained without freezing service', async ({ page }) => {
  test.setTimeout(600000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDesertionForTest({ guards: [{ x: 22, y: 13 }, { x: 26, y: 13 }], guardHealth: 80 }));
  const guard = (await snapshot(page)).squad[1].id;
  expect(await page.evaluate(id => window.helixHeresyDebug.legionSocialAction('aid', id), guard)).toBe(true);
  await advance(page, 60); let s = await snapshot(page);
  expect(s.service.squadConduct.some(r => r.kind === 'aid' && r.targetId === guard)).toBe(true);
  expect(await walk(page, 37, 16)).toBeTruthy(); await advance(page, 60);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDesertionForTest({ guards: [{ x: 38, y: 15 }, { x: 38, y: 17 }] }));
  expect(await page.evaluate(() => window.helixHeresyDebug.penalDesertionAction('attempt'))).toBe(true);
  expect(await walk(page, 40, 16)).toBeTruthy(); await advance(page, 60, 'desertionEscort'); s = await snapshot(page);
  expect(s.service.phase, JSON.stringify({ phase: s.service.phase, cell: s.cell, d: s.service.desertion })).toBe('desertionEscort');
  expect(s.service.desertion.observations.length).toBeGreaterThan(0); expect(s.service.desertion.restrained).toBe(true);
  expect(s.service.ledger.interruptions || []).toEqual([]); expect(s.service.desertion.newConviction).toBe(false);
  expect(await walk(page, 64, 16)).toBeFalsy();
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ remaining: 1 }));
  await advance(page, 1); s = await snapshot(page);
  expect(s.service.remainingSeconds).toBe(0); expect(s.service.desertion.restrained).toBe(false);
  expect(await walk(page, 22, 12)).toBeTruthy();
  expect(errors).toEqual([]);
});
