const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('actual-run-state', { body: Buffer.from(JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState()))), contentType: 'application/json' });
});
const snap = page => page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.watchRecognitionAction(action, terms), { action, terms });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceWatchRecognitionForTest(n), seconds);
async function visits(page) { if (!await page.locator('[data-watch-recognition]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click(); }
async function ui(page, action) { await visits(page); await page.locator(`[data-watch-recognition-action="${action}"]`).click(); }
async function reload(page) {
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(raw => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(raw)), saved); await visits(page);
}
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) return;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw new Error('Physical walk failed');
  });
}
async function setup(page, renderer, policy = 'considerCounterObservation') {
  page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'watch-test', siteId: 'watch-lab', strategicCellId: 'planet-cell:00009', seed: 'watch-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual civic walk refused');
  });
  await finishWalk(page);
  expect(await act(page, 'meet')).toBe(false);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureCityConfrontationTest(); d.configureCharterRecognitionTest({ bindInstitutions: true, policy: 'considerAdministrativeContinuity' });
    d.configureIncumbentResistanceTest({ health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true });
    if (!d.incumbentResistanceAction('demand') || !d.incumbentResistanceAction('soulLash')) throw new Error('Actual coercion refused');
    if (!d.incumbentResistanceAction('accept', d.incumbentResistanceSnapshot().resistance.terms)) throw new Error('Actual declaration refused');
    d.advanceSimulation(60);
    if (!d.charterRecognitionAction('file')) throw new Error('Actual filing refused');
    d.advanceCharterRecognitionForTest(d.charterRecognitionSnapshot().recognition.review.readyAt - d.charterRecognitionSnapshot().clock);
    if (!d.charterRecognitionAction('hear')) throw new Error('Actual hearing refused'); d.advanceCharterRecognitionForTest(180);
    if (!d.charterRecognitionAction('meeting')) throw new Error('Actual administrator meeting refused'); d.advanceCharterRecognitionForTest(60);
    if (!d.charterRecognitionAction('sign', d.charterRecognitionSnapshot().recognition.terms)) throw new Error('Actual administrator signature refused'); d.advanceCharterRecognitionForTest(60);
    d.configurePublicWorksRecognitionTest({ policy: 'considerSuppliedCounter' });
    if (!d.publicWorksRecognitionAction('meet')) throw new Error('Actual public-works meeting refused'); d.advancePublicWorksRecognitionForTest(60);
    if (!d.publicWorksRecognitionAction('sign', d.publicWorksRecognitionSnapshot().recognition.terms)) throw new Error('Actual public-works signature refused'); d.advancePublicWorksRecognitionForTest(60);
  });
  expect(await page.evaluate(policy => window.helixHeresyDebug.configureWatchRecognitionTest({ policy }), policy)).toBe(true);
  await visits(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: separate watch assent and actual finite counter duty survive reload, outages and absence`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const original = await snap(page), person = original.succession.leaders.find(a => a.id === original.recognition.personId);
  await ui(page, 'meet'); await advance(page, 20); expect((await snap(page)).recognition.job.progress).toBe(20);
  await reload(page); expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureWatchRecognitionTest({ powered: false }));
  await advance(page, 500); expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureWatchRecognitionTest({ powered: true })); await advance(page, 1); await advance(page, 40);
  let s = await snap(page); expect(s.recognition.response.decision).toBe('offered');
  expect(await act(page, 'sign', { ...s.recognition.terms, role: 'militaryDefenseCommand' })).toBe(false);
  await ui(page, 'sign'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  s = await snap(page); expect(s.recognition.receipt).toMatchObject({ origin: 'coerced', role: 'civilWatch', personId: person.id,
    administrationReceiptId: original.charter.recognition.id, worksReceiptId: original.works.receipt.id, recorderId: original.office.clerk.id });
  expect(s.charter.recognition).toEqual(original.charter.recognition); expect(s.works.receipt).toEqual(original.works.receipt);
  expect(s.succession.handover).toBeNull(); expect(s.succession.control).toBeNull(); expect(s.succession.agreements).toEqual([]);
  expect(s.office.power).toBe(original.office.power - 2); expect(s.office.workSeconds).toBe(original.office.workSeconds - 120);
  const terms = s.known.instructionTerms;
  expect(await act(page, 'order', { ...terms, duty: 'Arrest a rival' })).toBe(false);
  await ui(page, 'order'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(30));
  s = await snap(page); expect(s.recognition.duty, JSON.stringify({ context: s.context, message: s.recognition.message,
    job: s.recognition.job, person: s.succession.leaders.find(a => a.id === person.id), office: { power: s.office.power, workSeconds: s.office.workSeconds, maintenanceReady: s.office.maintenanceReady } })).not.toBeNull();
  expect(s.recognition.duty.status).toBe('walking'); expect(s.recognition.duty.progress).toBe(0);
  await advance(page, 25); s = await snap(page); expect(s.recognition.duty.status).toBe('observing');
  expect(s.succession.leaders.find(a => a.id === person.id).mapCell).toEqual({ x: 19, y: 10, z: 6 });
  await advance(page, 100); const partial = (await snap(page)).recognition.duty.progress;
  await reload(page); expect((await snap(page)).recognition.duty.progress).toBe(partial);
  await page.evaluate(() => window.helixHeresyDebug.configureWatchRecognitionTest({ powered: false })); await advance(page, 500);
  expect((await snap(page)).recognition.duty.progress).toBe(partial);
  await page.evaluate(() => window.helixHeresyDebug.configureWatchRecognitionTest({ powered: true })); await advance(page, 1);
  if (renderer === 'dom') {
    // Real combat against the living former incumbent; no synthetic incident or receipt.
    expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.startScientistCombatAction('shove', d.watchRecognitionSnapshot().succession.ruler.id); })).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1)); // Resolve its real half-second windup.
    s = await snap(page); expect(s.recognition.reports).toHaveLength(1); expect(s.recognition.reports[0].actorId).toBe('scientist');
    expect(s.recognition.reports[0].communicatedAt).toBeNull(); expect(s.known.reports).toEqual([]);
    expect(await act(page, 'receive')).toBe(false);
  }
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known;
  await advance(page, 650); s = await snap(page);
  expect(s.recognition.duty).toBeNull(); expect(s.recognition.deliveries).toHaveLength(1); expect(s.recognition.deliveries[0].seconds).toBe(600);
  expect(s.succession.leaders.find(a => a.id === person.id).mapCell).toEqual(person.mapCell);
  expect(s.known).toEqual(dated); expect(s.succession.provision.stock).toBe(0);
  expect(await act(page, 'receive')).toBe(false);
  expect(await act(page, 'walk')).toBe(true); await finishWalk(page); await visits(page);
  if (renderer === 'dom') {
    expect(await act(page, 'receive')).toBe(true); s = await snap(page);
    expect(s.recognition.reports[0].communicatedAt).not.toBeNull(); expect(s.known.reports).toHaveLength(1);
    expect(s.context.conduct.some(r => r.id === s.recognition.reports[0].id)).toBe(true);
    expect(s.charter.recognition).toEqual(original.charter.recognition); expect(s.works.receipt).toEqual(original.works.receipt);
    expect(await act(page, 'receive')).toBe(false); expect(await act(page, 'order', terms)).toBe(false);
  }
  await expect(page.locator('[data-watch-recognition]')).toContainText('physical return recorded');
  await reload(page); expect((await snap(page)).recognition.deliveries).toHaveLength(1); expect(errors).toEqual([]);
});
test('original watch refusal stays personal and stable without creating guards, command or altered prior receipts', async ({ page }) => {
  await setup(page, 'dom', 'declineCoercedContinuation'); const before = await snap(page);
  await ui(page, 'meet'); await advance(page, 60); const decision = (await snap(page)).recognition.response;
  expect(decision.decision).toBe('refused'); await reload(page); expect(await act(page, 'meet')).toBe(false);
  const s = await snap(page); expect(s.recognition.response).toEqual(decision); expect(s.recognition.receipt).toBeNull(); expect(s.recognition.duty).toBeNull();
  expect(s.charter.recognition).toEqual(before.charter.recognition); expect(s.works.receipt).toEqual(before.works.receipt);
  await expect(page.locator('[data-watch-recognition]')).toContainText('not criminal guilt');
});
