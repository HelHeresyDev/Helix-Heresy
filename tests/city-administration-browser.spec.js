const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityAdministrationSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityAdministrationAction(action, expected), { action, expected });
const succession = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.citySuccessionAction(action, expected), { action, expected });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceCityAdministrationForTest(n), seconds);
const resist = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityResistanceAction(action, expected), { action, expected });
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
async function handedOver(page, renderer = 'dom') {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'administration-test', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'administration-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
  });
  expect(await act(page, 'inspect')).toBe(false);
  expect(await succession(page, 'walk')).toBe(true); await finishWalk(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.configureCitySuccessionTest({ retirement: true }))).toBe(true);
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
  await page.locator('[data-workspace-tab="visits"]').click();
}
test('local administration physically consumes the first staged city parts across reload and continues out of sight without live reports', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await handedOver(page);
  const panel = page.locator('[data-city-administration]');
  await panel.locator('[data-administration-action="inspect"]').click();
  let s = await snap(page); const originalReceipt = s.succession.handover, terms = s.administration.inspection;
  expect(await act(page, 'order', { ...terms, parts: 0 })).toBe(false);
  await panel.locator('[data-administration-action="order"]').click();
  s = await snap(page); expect(s.administration.job.status).toBe('collecting');
  const sourceId = s.administration.job.source.id;
  expect(s.stacks.find(i => i.id === sourceId).quantity).toBe(3);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
  s = await snap(page); expect(s.administration.job.cargo.quantity).toBe(3); expect(s.stacks.some(i => i.id === sourceId)).toBe(false);
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(saved)), saved);
  expect((await snap(page)).administration.job.cargo.quantity).toBe(3);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  await advance(page, 180); s = await snap(page);
  expect(s.administration.job, JSON.stringify({ context: s.context, clerkId: s.administration.clerkId, office: s.office,
    worker: s.succession.leaders.find(a => a.id === s.administration.workerId) })).toBeNull();
  expect(s.administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(s.succession.provision.stock).toBe(15); expect(s.succession.handover).toEqual(originalReceipt);
  expect(s.known).toEqual(dated); expect(await act(page, 'inspect')).toBe(false);
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page);
  expect((await snap(page)).known.receipts.filter(r => r.installationId)).toHaveLength(1);
  await expect(panel).toContainText('local installation serviced');
  await advance(page, 100); expect((await snap(page)).administration.receipts.filter(r => r.installationId)).toHaveLength(1);
  expect(errors).toEqual([]);
});
test('deadline interrupts real registration, supplied recovery and batteries allow overdue repair without resetting authority or wounds', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await handedOver(page, 'canvas');
  let s = await snap(page); await advance(page, s.administration.graceUntil - s.clock);
  s = await snap(page); expect(s.office.maintenanceReady).toBe(false); const recognition = s.succession.handover;
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('preview', 'Test Scientist'))).toBe(false);
  expect(await act(page, 'inspect')).toBe(true);
  await expect(page.locator('[data-city-administration]')).toContainText('offline');
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ workerWork: 0, counterWork: 0, power: 0,
    supplies: { fieldRation: 2, relayBattery: 1, metalParts: 3 } }));
  s = await snap(page); const worker = s.succession.leaders.find(a => a.id === s.administration.workerId), health = worker.health;
  expect(await act(page, 'order', s.administration.inspection)).toBe(false);
  expect(await act(page, 'rest', worker.id)).toBe(true);
  expect(await act(page, 'rest', s.office.clerk.id)).toBe(true);
  expect(await act(page, 'rest', worker.id)).toBe(false);
  expect(await act(page, 'battery')).toBe(false); // Clerk is genuinely off duty.
  await advance(page, 14400); s = await snap(page); expect(s.office.workSeconds).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 14400); s = await snap(page); expect(s.administration.rests).toHaveLength(0); expect(s.office.workSeconds).toBe(14400);
  expect(s.succession.leaders.find(a => a.id === worker.id).health).toBe(health);
  expect(await act(page, 'battery')).toBe(true); expect((await snap(page)).office.power).toBe(12);
  expect(await act(page, 'parts')).toBe(true); expect((await snap(page)).succession.provision.stock).toBe(18);
  expect(await act(page, 'inspect')).toBe(true); s = await snap(page);
  expect(await act(page, 'order', s.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.office.maintenanceReady).toBe(true); expect(s.succession.handover).toEqual(recognition);
  expect(await page.evaluate(() => window.helixHeresyDebug.scientistIdentityAction('preview', 'Test Scientist'))).toBe(true);
  expect(errors).toEqual([]);
});
test('institutional notice, supplied remedy, independent hearing and explicit renewal survive reload without erasing recognition', async ({ page }) => {
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await handedOver(page);
  const panel = page.locator('[data-city-resistance]');
  await panel.locator('[data-resistance-action="terms"]').click();
  let s = await snap(page); const recognition = s.succession.handover;
  expect(await resist(page, 'accept', { ...s.administration.resistance.offer, remedySeconds: 0 })).toBe(false);
  await panel.locator('[data-resistance-action="accept"]').click();
  await advance(page, 60); s = await snap(page); expect(s.administration.resistance.commitment).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.configureCityAdministrationTest({ supplies: { relayBattery: 1 } }));
  expect(await act(page, 'battery')).toBe(true);
  // Physical attendance and dated knowledge remain separate from actual state.
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 10, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  await advance(page, 180); expect((await snap(page)).known).toEqual(dated);
  expect(await resist(page, 'receive')).toBe(false);
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page);
  s = await snap(page); expect(s.context.atCounter).toBe(true);
  // Isolate the long institutional clock from unrelated field-visit physiology.
  await advance(page, s.administration.graceUntil - s.clock + 1);
  s = await snap(page); expect(s.administration.resistance.notice.receivedAt).toBeNull();
  await advance(page, 30000); expect((await snap(page)).administration.resistance.commandStatus).toBe('active');
  await panel.locator('[data-resistance-action="receive"]').click();
  s = await snap(page); const notice = s.administration.resistance.notice;
  expect(notice.receivedAt).not.toBeNull();
  expect(notice.remedyUntil).toBe(notice.receivedAt + 28800);
  await advance(page, 28800); s = await snap(page);
  expect(s.administration.resistance.commandStatus).toBe('suspended'); expect(s.succession.handover).toEqual(recognition);
  await panel.locator('[data-resistance-action="review"]').click();
  s = await snap(page); expect(s.administration.resistance.notice.review).not.toBeNull();
  await advance(page, s.administration.resistance.notice.review.readyAt - s.clock);
  await panel.locator('[data-resistance-action="hear"]').click();
  expect((await snap(page)).administration.resistance.job?.kind).toBe('review');
  await advance(page, 90);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 90); s = await snap(page);
  expect(s.administration.resistance.reviews).toHaveLength(1);
  expect(s.administration.resistance.notice.review.outcome).toBe('unmetObligationUpheld');
  await expect(panel).toContainText('no criminal verdict or deposition');
  expect(await act(page, 'inspect')).toBe(true); s = await snap(page);
  expect(await act(page, 'order', s.administration.inspection)).toBe(true); await advance(page, 180);
  s = await snap(page); expect(s.office.maintenanceReady).toBe(true);
  expect(s.administration.resistance.commandStatus).toBe('suspended');
  await panel.locator('[data-resistance-action="renew"]').click();
  s = await snap(page); expect(s.administration.resistance.job?.kind, JSON.stringify(s.context)).toBe('renewal');
  await advance(page, 30);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await advance(page, 30); s = await snap(page);
  expect(s.administration.resistance.commandStatus).toBe('active'); expect(s.administration.resistance.renewals).toHaveLength(1);
  expect(s.succession.handover).toEqual(recognition);
  await advance(page, 100); expect((await snap(page)).administration.resistance.renewals).toHaveLength(1);
  expect(errors).toEqual([]);
});
test('unsupported defense order receives a real bounded refusal and review in Canvas without granting an army or ending the run', async ({ page }) => {
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await handedOver(page, 'canvas');
  const panel = page.locator('[data-city-resistance]');
  await panel.locator('[data-resistance-action="terms"]').click();
  await panel.locator('[data-resistance-action="accept"]').click(); await advance(page, 60);
  let s = await snap(page); const defender = s.bargain.defender, recognition = s.succession.handover;
  await panel.locator('[data-resistance-action="demandDefense"]').click();
  s = await snap(page); expect(s.administration.resistance.commandStatus).toBe('suspended');
  expect(s.administration.resistance.notice.kind).toBe('unsupportedOrder'); expect(s.bargain.defender).toEqual(defender);
  await expect(panel).toContainText('defense command is outside');
  expect(await resist(page, 'demandDefense')).toBe(false);
  await panel.locator('[data-resistance-action="review"]').click(); s = await snap(page);
  expect(s.administration.resistance.notice.review).not.toBeNull();
  expect(await resist(page, 'hear')).toBe(false);
  await advance(page, s.administration.resistance.notice.review.readyAt - s.clock);
  await panel.locator('[data-resistance-action="hear"]').click(); await advance(page, 180);
  s = await snap(page); expect(s.administration.resistance.notice.review.outcome).toBe('unsupportedOrderUpheld');
  expect(s.succession.handover).toEqual(recognition); expect(s.context.alive).toBe(true);
  expect(s.bargain.defender).toEqual(defender); expect(s.administration.resistance.reviews).toHaveLength(1);
  expect(errors).toEqual([]);
});
