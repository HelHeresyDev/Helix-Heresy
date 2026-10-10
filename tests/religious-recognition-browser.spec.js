const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const { patronSource } = require('./helpers/patron-fixture');
const Religion = require('../religious-recognition');
test.setTimeout(420000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.religiousRecognitionSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.religiousRecognitionAction(action, terms), { action, terms });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceReligiousRecognitionForTest(n), n);
async function visits(page) { if (!await page.locator('[data-religious-recognition]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click(); }
async function ui(page, action) { await visits(page); await page.locator(`[data-religious-recognition-action="${action}"]`).click(); }
async function reload(page) {
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload(); await page.evaluate(raw => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(raw)), saved); await visits(page);
}
async function finishWalk(page) {
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Actual walk did not complete');
  });
}
async function setup(page, renderer) {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(renderer => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: renderer })); }, renderer);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'patron-test', siteId: 'patron-lab', strategicCellId: 'planet-cell:00009', seed: 'patron-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual civic walk refused');
  });
  await finishWalk(page);
  await page.evaluate(scope => {
    const d = window.helixHeresyDebug;
    d.configureCityConfrontationTest();
    const current = d.cityConfrontationSnapshot().succession.source;
    d.configureCharterRecognitionTest({ bindInstitutions: true, policy: 'considerAdministrativeContinuity', rule: {
      id: 'actual-prepared-patron-law', principle: current.succession, reviewInstitutionId: current.institutions.find(i => i.role === 'civicReview').id,
      coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: ['a:designation-patron:god:a'],
      patronRequirement: { godId: 'god:a', faithId: 'faith:a', authorizationId: 'a:designation-patron:god:a', scope }, text: 'Explicit prepared local patron requirement.' } });
    d.configureIncumbentResistanceTest({ health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true });
    if (!d.incumbentResistanceAction('demand') || !d.incumbentResistanceAction('soulLash')) throw new Error('Actual disclosed confrontation refused');
    if (!d.incumbentResistanceAction('accept', d.incumbentResistanceSnapshot().resistance.terms)) throw new Error('Actual original declaration refused');
    d.advanceSimulation(60);
  }, Religion.SCOPE);
  const source = await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().succession.source);
  expect(await page.evaluate(origin => window.helixHeresyDebug.configureReligiousRecognitionTest({ source: origin, policy: 'considerScopedPetition' }),
    patronSource(source.cityId, source.charterId))).toBe(true);
  await visits(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual local patron response is finite authenticated evidence, not automatic recognition`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  console.log(`${renderer}: original civic declaration and local religious source ready`);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    if (!d.charterRecognitionAction('file')) throw new Error('Actual independent filing refused');
    d.advanceCharterRecognitionForTest(d.charterRecognitionSnapshot().recognition.review.readyAt - d.charterRecognitionSnapshot().clock);
    if (!d.charterRecognitionAction('hear')) throw new Error('Actual independent hearing refused'); d.advanceCharterRecognitionForTest(180);
  });
  let s = await snap(page); expect(s.charter.review.finding.outcome).toBe('unresolved');
  const originalFinding = s.charter.review, original = s.petition, duty = s.office.workSeconds, power = s.office.power;
  expect(s.context.representativePresent).toBe(true); expect(s.context.sourceCurrent).toBe(true);
  await ui(page, 'meet'); await tick(page, 20); await reload(page); s = await snap(page); expect(s.petition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: false }));
  await tick(page, 300); expect((await snap(page)).petition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ powered: true }));
  await tick(page, 1); await tick(page, 40); s = await snap(page);
  expect(s.known.facilitation.decision).toBe('offered'); expect(s.petition.reply).toBeNull();
  expect(await act(page, 'petition', { ...s.known.terms, scope: 'Divine submission' })).toBe(false);
  await ui(page, 'petition'); s = await snap(page);
  expect(s.petition.god.power.reserve).toBe(original.god.power.reserve - 7);
  await tick(page, 25); await reload(page); s = await snap(page); expect(s.petition.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ channelAvailable: false }));
  await tick(page, 300); expect((await snap(page)).petition.reply).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ channelAvailable: true }));
  await tick(page, 1);
  // Native simulation completes this real shared-clerk job; preparation hooks did not insert a response.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(155)); s = await snap(page);
  expect(s.known.reply).toMatchObject({ authenticated: true, decision: { outcome: 'approved' } });
  console.log(`${renderer}: ordinary simulation delivered the authenticated response`);
  expect(s.charter.review).toEqual(originalFinding); expect(s.charter.recognition).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual([]);
  expect(await act(page, 'petition', s.known.terms)).toBe(false);
  expect(await act(page, 'submit', { ...s.known.reply, godId: 'another-god' })).toBe(false);
  await ui(page, 'submit'); await tick(page, 20); await reload(page); await tick(page, 40); s = await snap(page);
  expect(s.petition.submissions).toHaveLength(1); expect(s.office.records).toContainEqual(s.petition.submissions[0]);
  expect(s.office.power).toBe(power - 3); expect(s.office.workSeconds).toBe(duty - 300);
  expect(s.petition.actor.workSeconds).toBe(original.actor.workSeconds - 300);
  expect(s.petition.actor.id).toBe(original.actor.id); expect(s.petition.god.power.reserve).toBe(original.god.power.reserve - 7);
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual(['a:designation-patron:god:a']);
  expect(s.charter.recognition).toBeNull(); expect(await act(page, 'submit', s.known.reply)).toBe(false);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    if (!d.charterRecognitionAction('file')) throw new Error('New authenticated evidence not accepted for filing');
    d.advanceCharterRecognitionForTest(d.charterRecognitionSnapshot().recognition.review.readyAt - d.charterRecognitionSnapshot().clock);
    if (!d.charterRecognitionAction('hear')) throw new Error('New independent hearing refused'); d.advanceCharterRecognitionForTest(180);
  });
  s = await snap(page); expect(s.charter.review.finding.outcome).toBe('eligible'); expect(s.charter.previousReviews[0]).toEqual(originalFinding);
  expect(s.charter.recognition).toBeNull(); expect(await act(page, 'meet')).toBe(false);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known; await tick(page, 500);
  expect((await snap(page)).known).toEqual(dated); expect(errors).toEqual([]);
});
