const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(300000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.runStrategicConditionsSnapshot());
const admin = page => page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), n);
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAdministrationAction(action, expected), { action, expected });
const identity = (page, action) => page.evaluate(action => window.helixHeresyDebug.scientistIdentityAction(action, 'Mira'), action);
const routeState = page => page.evaluate(() => {
  const s = window.helixHeresyDebug.strategicJourneysSnapshot();
  return { destinations: s.destinations.map(d => ({ id: d.id, cityId: d.cityId, reachable: d.reachable, routeContinuity: d.routeContinuity || '' })), routes: s.routes };
});
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) { d.advanceCityAdministrationForTest(0); return; }
      // Exercise ordinary physical walking without simulating unrelated hunger
      // for the day-long civic deadline isolated by this focused fixture.
      d.advanceBoundaryTravelForTest(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Original counter walk did not finish');
  });
}
async function reload(page) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  const tab = page.locator('[data-workspace-tab="visits"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `conditions-${renderer}`);
  expect((await snapshot(page)).conditions).toBeNull();
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'conditions', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.citySuccessionAction('walk')) throw new Error('Original counter walk refused');
  }, renderer);
  await finishWalk(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    // Explicit local qualifications and finite capacity. All civic consent,
    // supplied handover and subsequent repair work use production actions.
    if (!d.configureCitySuccessionTest({ retirement: true }) || !d.citySuccessionAction('request')) throw new Error('Succession request refused');
    d.advanceCitySuccessionForTest(30);
    if (!d.citySuccessionAction('hear')) throw new Error('Hearing refused'); d.advanceCitySuccessionForTest(180);
    if (!d.citySuccessionAction('sign', d.citySuccessionSnapshot().succession.terms)) throw new Error('Terms refused');
    d.configureSovereignBargainTest({ supply: 18, carried: true });
    if (!d.citySuccessionAction('deliver')) throw new Error('Original parts refused');
    const s = d.citySuccessionSnapshot();
    for (const a of [...s.succession.leaders, s.bargain.defender]) {
      if (!d.citySuccessionAction('agree', a.id)) throw new Error('Continuation refused'); d.advanceCitySuccessionForTest(60);
    }
    if (!d.citySuccessionAction('handover')) throw new Error('Handover refused'); d.advanceCitySuccessionForTest(180);
    d.configureCityAdministrationTest({ counterWork: 6000, workerWork: 500, power: 6, supplies: { relayBattery: 1 } });
    if (!d.citySuccessionAction('directive')) throw new Error('Original finite staging directive refused');
    d.advanceCitySuccessionForTest(60); d.advanceCitySuccessionForTest(30);
    if (d.citySuccessionSnapshot().succession.directive.status !== 'completed') throw new Error('Actual staging did not finish');
    d.advanceCityAdministrationForTest(0);
  });
  await page.locator('[data-workspace-tab="visits"]').click();
  const routes = await routeState(page);
  return { errors, world, routes };
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('conditions', {
    body: JSON.stringify({ conditions: await snapshot(page), administration: await admin(page) }), contentType: 'application/json' });
});
test('Canvas run service loss stays unknown away, survives real reload and returns through original supplied repair', async ({ page }) => {
  const f = await setup(page, 'canvas');
  const initial = await snapshot(page), original = await admin(page);
  expect(initial.known.available).toBe(true);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snapshot(page)).known;
  await advance(page, original.administration.graceUntil - (await snapshot(page)).clock + 1);
  let s = await snapshot(page); expect(s.serviceReason).toContain('maintenance grace expired'); expect(s.known).toEqual(dated);
  expect(s.conditions.installations[0].events.at(-1).at).toBe(original.administration.graceUntil);
  await expect(page.locator('[data-run-strategic-conditions]')).toContainText('available at observation');
  await expect(page.locator('[data-run-strategic-conditions]')).not.toContainText('Maintenance grace expired');
  await reload(page); expect((await snapshot(page)).conditions).toEqual(s.conditions);
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page);
  s = await snapshot(page); expect(s.known.available).toBe(false);
  await expect(page.locator('[data-run-strategic-conditions]')).toContainText('Maintenance grace expired');
  const blocked = await page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot());
  expect(await identity(page, 'preview')).toBe(false);
  expect((await page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot())).money).toBe(blocked.money);
  await page.locator('[data-administration-action="inspect"]').click();
  await page.locator('[data-administration-action="order"]').click(); await advance(page, 1);
  expect((await admin(page)).administration.job).not.toBeNull();
  const partial = (await admin(page)).administration.job;
  await reload(page); expect((await admin(page)).administration.job).toEqual(partial);
  await advance(page, 180);
  const repaired = await admin(page), receipt = repaired.administration.receipts.find(r => r.installationId);
  expect(repaired.administration.job).toBeNull(); expect(receipt).toBeTruthy();
  s = await snapshot(page); expect(s.serviceReason).toBe(''); expect(s.known.available).toBe(true);
  expect(s.conditions.installations[0].events.at(-1)).toMatchObject({ kind: 'restored', sourceId: receipt.id, at: receipt.at });
  expect(repaired.succession.provision.stock).toBe(original.succession.provision.stock);
  expect(repaired.stacks.some(i => i.id === partial.source.id)).toBe(false); // The original staged lot was actually installed.
  expect(repaired.succession.handover).toEqual(original.succession.handover);
  expect(repaired.office.power).toBeLessThan(original.office.power); expect(repaired.office.workSeconds).toBeLessThan(original.office.workSeconds);
  expect(await identity(page, 'preview')).toBe(true); expect(await identity(page, 'confirm')).toBe(true);
  const identityState = await page.evaluate(() => window.helixHeresyDebug.scientistIdentitySnapshot());
  expect(identityState.job).not.toBeNull(); expect(identityState.money).toBe(blocked.money - 20);
  const history = (await snapshot(page)).conditions.installations[0].events;
  await advance(page, 0); expect((await snapshot(page)).conditions.installations[0].events).toEqual(history);
  await reload(page); expect((await snapshot(page)).conditions.installations[0].events).toEqual(history);
  expect(await routeState(page)).toEqual(f.routes);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.world);
  expect(f.errors).toEqual([]);
});
test('DOM interrupted repair preserves refusal and finite blockers, death freezes conditions and same-world restart inherits none', async ({ page }) => {
  const f = await setup(page, 'dom');
  expect(await page.evaluate(() => window.helixHeresyDebug.cityResistanceAction('terms'))).toBe(true);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.cityResistanceAction('accept', d.cityAdministrationSnapshot().administration.resistance.offer); })).toBe(true);
  await advance(page, 60);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityResistanceAction('demandDefense'))).toBe(true);
  const original = await admin(page);
  await advance(page, original.administration.graceUntil - original.clock + 1);
  expect(await act(page, 'inspect')).toBe(true); expect(await act(page, 'order', (await admin(page)).administration.inspection)).toBe(true);
  await advance(page, 1);
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ powered: false }));
  await advance(page, 60); const interrupted = (await admin(page)).administration.job;
  await reload(page); await advance(page, 60); expect((await admin(page)).administration.job.progress).toBe(interrupted.progress);
  expect((await snapshot(page)).serviceReason).toContain('maintenance grace expired');
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ powered: true }));
  await advance(page, 0); expect((await admin(page)).administration.job.progress).toBe(interrupted.progress);
  await advance(page, 180); expect((await admin(page)).administration.job).toBeNull();
  let s = await snapshot(page); expect(s.conditions.installations[0].status).toBe('maintained');
  expect((await admin(page)).administration.resistance.commandStatus).toBe('suspended');
  expect((await admin(page)).succession.handover).toEqual(original.succession.handover);
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ power: 0 }));
  expect((await snapshot(page)).known.available).toBe(false);
  expect(await identity(page, 'preview')).toBe(true); expect(await identity(page, 'confirm')).toBe(false);
  expect(await act(page, 'battery')).toBe(true); expect((await admin(page)).office.power).toBe(12);
  expect((await snapshot(page)).known.available).toBe(true);
  expect((await admin(page)).administration.resistance.commandStatus).toBe('suspended');
  s = await snapshot(page); await reload(page); expect((await snapshot(page)).conditions).toEqual(s.conditions);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const dead = await snapshot(page); await advance(page, 200000); expect((await snapshot(page)).conditions).toEqual(dead.conditions);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="review-run"]').click(); await page.locator('#runOutcomeRestartBtn').click();
  await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  expect((await snapshot(page)).conditions).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.world);
  expect(f.errors).toEqual([]);
});
