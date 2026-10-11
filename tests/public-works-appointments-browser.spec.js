const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityAppointmentsSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAppointmentsAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCityAppointmentsForTest(n), seconds);
const admin = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAdministrationAction(action, expected), { action, expected });
const succession = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.citySuccessionAction(action, expected), { action, expected });
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Physical walk did not finish');
  });
}
async function setup(page, renderer = 'dom', obstruct = false) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'appointment-test', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'appointment-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
  });
  expect(await act(page, 'discuss')).toBe(false);
  expect(await succession(page, 'walk')).toBe(true); await finishWalk(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCitySuccessionTest({ retirement: true, appointmentLaw: true }))).toBe(true);
  expect(await succession(page, 'request')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(30));
  expect(await succession(page, 'hear')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(180));
  let s = await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot());
  expect(await succession(page, 'sign', s.succession.terms)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.configureSovereignBargainTest({ supply: 18, carried: true }));
  expect(await succession(page, 'deliver')).toBe(true); s = await page.evaluate(() => window.helixHeresyDebug.citySuccessionSnapshot());
  for (const a of [...s.succession.leaders, s.bargain.defender]) {
    expect(await succession(page, 'agree', a.id)).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(60));
  }
  expect(await succession(page, 'handover')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceCitySuccessionForTest(180));
  expect(await succession(page, 'directive')).toBe(true);
  await page.evaluate(() => { window.helixHeresyDebug.advanceCitySuccessionForTest(60); window.helixHeresyDebug.advanceCitySuccessionForTest(30); });
  // Extra attended operations require a genuinely delivered finite battery,
  // not a work/power refill or an invented appointment outcome.
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { relayBattery: 1 } }));
  expect(await admin(page, 'battery')).toBe(true);
  const configured = await page.evaluate(obstruct => window.helixHeresyDebug.configureCityAppointmentsTest({ maintenance: 50, willing: true, obstruct }), obstruct);
  const diagnostic = configured ? null : await snap(page);
  expect(configured, JSON.stringify({ appointments: diagnostic?.appointments, context: diagnostic && {
    atCounter: diagnostic.context.atCounter, busy: diagnostic.context.busy, rule: diagnostic.context.appointmentRule,
    institution: diagnostic.context.appointmentOffice }, ground: configured ? null : await page.evaluate(() => window.helixHeresyDebug.cityAppointmentGroundSnapshot()) })).toBe(true);
  expect((await page.evaluate(() => window.helixHeresyDebug.cityAppointmentGroundSnapshot())).load).toBe(.6);
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function reviewed(page) {
  const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="discuss"]').click();
  expect((await snap(page)).appointments.job?.kind).toBe('discuss');
  await advance(page, 60);
  let s = await snap(page);
  expect(await act(page, 'propose', { ...s.appointments.dossier, willing: false })).toBe(false);
  await panel.locator('[data-appointment-action="propose"]').click();
  s = await snap(page); expect(s.appointments.review.status).toBe('queued');
  expect(await act(page, 'hear')).toBe(false);
  await advance(page, s.appointments.review.readyAt - s.clock);
  await panel.locator('[data-appointment-action="hear"]').click();
  expect((await snap(page)).appointments.job?.kind).toBe('review');
  await advance(page, 180); s = await snap(page);
  expect(s.appointments.review.outcome).toBe('eligible');
  expect(s.appointments.appointment).toBeNull();
  expect(await act(page, 'appoint', { ...s.appointments.terms, workCap: 999999 })).toBe(false);
  await panel.locator('[data-appointment-action="appoint"]').click(); await advance(page, 60);
  s = await snap(page); expect(s.appointments.appointment).not.toBeNull();
  expect(s.administration.workerId).toBe(s.appointments.incumbentId);
  expect(s.office.publicWorksAppointments).toHaveLength(1);
  await panel.locator('[data-appointment-action="approach"]').click(); await advance(page, 30);
  s = await snap(page);
  expect(s.appointments.travel, JSON.stringify({ candidate: s.appointments.candidate, context: s.context })).toBeNull();
  expect(s.appointments.candidate.mapCell).toEqual(s.administration.installation.workCell);
  expect(s.appointments.receipt).toBeNull(); return s;
}
test('DOM: contested appointment physically transfers the original installation and the real technician performs supplied upkeep across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); const before = await snap(page);
  let s = await reviewed(page); const panel = page.locator('[data-city-appointments]');
  await panel.locator('[data-appointment-action="transfer"]').click(); await advance(page, 60);
  expect((await snap(page)).appointments.receipt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 70);
  s = await snap(page);
  expect(s.appointments.receipt).not.toBeNull(); expect(s.office.publicWorksTransfers).toHaveLength(1);
  expect(s.administration.workerId).toBe(s.appointments.candidate.id);
  expect(s.succession.handover).toEqual(before.succession.handover);
  expect(s.succession.agreements).toEqual(before.succession.agreements);
  expect(s.succession.provision).toEqual(before.succession.provision);
  expect(s.administration.dueAt).toBe(before.administration.dueAt);
  await expect(panel).toContainText('Physical transfer recorded');
  expect(await admin(page, 'inspect')).toBe(true);
  const a = await page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
  expect(await admin(page, 'order', a.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.administration.job).toBeNull();
  expect(s.administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(s.administration.receipts.at(-1).personId).toBe(s.appointments.candidate.id);
  const oldParts = before.succession.provision.stock;
  // The already staged three city-owned parts are consumed first, not cloned.
  expect(s.succession.provision.stock).toBe(oldParts);
  expect(errors).toEqual([]);
});
test('Canvas: incumbent obstruction leaves the recorded appointment without physical control, persists and exposes no away intelligence', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'canvas', true); let s = await reviewed(page);
  const oldWorkerId = s.administration.workerId, handover = s.succession.handover;
  expect(await act(page, 'transfer', s.appointments.appointment)).toBe(false);
  s = await snap(page); expect(s.appointments.phase).toBe('obstructed');
  expect(s.appointments.receipt).toBeNull(); expect(s.administration.workerId).toBe(oldWorkerId);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).appointments.obstruction).toEqual(s.appointments.obstruction);
  await expect(page.locator('[data-city-appointments]')).toContainText('enforceable control has not transferred');
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  expect(await act(page, 'appoint', s.appointments.terms)).toBe(false);
  await advance(page, 180); s = await snap(page);
  expect(s.known).toEqual(dated); expect(s.succession.handover).toEqual(handover);
  expect(s.administration.workerId).toBe(oldWorkerId); expect(s.appointments.receipt).toBeNull();
  expect(errors).toEqual([]);
});
