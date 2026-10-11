const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const { patronSource } = require('./helpers/patron-fixture');
const Religion = require('../religious-recognition');
const Faiths = require('../strategic-faiths');
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
async function setup(page, renderer, position = 'mortalAutonomy', teaching = 'cooperationWithoutDivineSovereignty') {
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
  const origin = patronSource(source.cityId, source.charterId, teaching);
  origin.faith.hereticTeaching = Faiths.hereticTeachingFor(position);
  expect(await page.evaluate(origin => window.helixHeresyDebug.configureReligiousRecognitionTest({ source: origin, policy: 'considerScopedPetition' }),
    origin)).toBe(true);
  await visits(page);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: civic covenant publishes, confirms and files scoped support with prospective withdrawal or received breach`, async ({ page }) => {
  test.setTimeout(600000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, renderer, 'mortalAutonomy', 'authorityBoundByPublishedOath');
  const original = await snap(page);
  await ui(page, 'meet'); await tick(page, 60); await ui(page, 'petition'); await tick(page, 180);
  let s = await snap(page); const reply = s.petition.reply, terms = s.known.reply.covenantOffer;
  expect(terms, JSON.stringify(s.context.covenantPeople)).not.toBeNull();
  expect(s.known.reply.decision.outcome).toBe('conditional');
  await expect(page.locator('[data-religious-recognition]')).toContainText('Named participants');
  expect(await act(page, 'acceptCovenant', { ...terms, obligation: 'Obey the gods' })).toBe(false);
  await ui(page, 'acceptCovenant'); await tick(page, 20); if (renderer === 'dom') await reload(page);
  expect((await snap(page)).petition.job.progress).toBe(20); await tick(page, 40);
  s = await snap(page); expect(s.known.covenants[0].status).toBe('accepted');
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual([]);
  await ui(page, 'confirmCovenant'); await tick(page, 25); if (renderer === 'dom') await reload(page);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ channelAvailable: false }));
  await tick(page, 100); expect((await snap(page)).petition.job.progress).toBe(25);
  await page.evaluate(() => window.helixHeresyDebug.configureReligiousRecognitionTest({ channelAvailable: true }));
  await tick(page, 1); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(155));
  expect((await snap(page)).known.covenants[0].status).toBe('confirmed');
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual([]);
  await ui(page, 'fileCovenant'); await tick(page, 20); if (renderer === 'dom') await reload(page); await tick(page, 40);
  s = await snap(page); expect(s.known.covenants[0].status).toBe('filed'); expect(s.petition.reply).toEqual(reply);
  expect(s.office.power).toBe(original.office.power - 5); expect(s.office.workSeconds).toBe(original.office.workSeconds - 540);
  expect(s.petition.god.power.reserve).toBe(original.petition.god.power.reserve - 14);
  expect(s.petition.attentionSeconds).toBe(original.petition.attentionSeconds - 360);
  expect(s.office.records).toContainEqual(s.petition.covenants[0].acceptance);
  expect(s.office.records).toContainEqual(s.petition.covenants[0].filing);
  expect(s.charter.recognition).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual(['a:designation-patron:god:a']);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    if (!d.charterRecognitionAction('file')) throw new Error('Covenant evidence was not accepted');
    d.advanceCharterRecognitionForTest(d.charterRecognitionSnapshot().recognition.review.readyAt - d.charterRecognitionSnapshot().clock);
    if (!d.charterRecognitionAction('hear')) throw new Error('Independent hearing refused'); d.advanceCharterRecognitionForTest(180);
  });
  s = await snap(page); expect(s.charter.review.finding.outcome).toBe('eligible'); const finding = s.charter.review;
  if (renderer === 'dom') {
    await ui(page, 'withdrawCovenant'); await reload(page); s = await snap(page);
    expect(s.known.covenants[0].status).toBe('withdrawn'); expect(s.charter.review).toEqual(finding);
    expect(await act(page, 'acceptCovenant', terms)).toBe(false);
  } else {
    // Earn the existing watch's actual consent and physical observation; no report or breach is inserted by a fixture.
    await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      if (!d.charterRecognitionAction('meeting')) throw new Error('Administrator meeting refused'); d.advanceCharterRecognitionForTest(60);
      if (!d.charterRecognitionAction('sign', d.charterRecognitionSnapshot().recognition.terms)) throw new Error('Administrator sign refused'); d.advanceCharterRecognitionForTest(60);
      d.configurePublicWorksRecognitionTest({ policy: 'considerSuppliedCounter' });
      if (!d.publicWorksRecognitionAction('meet')) throw new Error('Public-works meeting refused'); d.advancePublicWorksRecognitionForTest(60);
      if (!d.publicWorksRecognitionAction('sign', d.publicWorksRecognitionSnapshot().recognition.terms)) throw new Error('Public-works sign refused'); d.advancePublicWorksRecognitionForTest(60);
      if (!d.configureCityAdministrationTest({ supplies: { relayBattery: 1 } }) || !d.cityAdministrationAction('battery'))
        throw new Error('Real carried counter battery handover refused');
      const positions = [{ x: 20, y: 10, z: 6 }, { x: 18, y: 10, z: 6 }, { x: 20, y: 11, z: 6 },
        { x: 18, y: 9, z: 6 }, { x: 19, y: 10, z: 6 }];
      if (!positions.some(cell => d.configureWatchRecognitionTest({ policy: 'considerCounterObservation', cell })))
        throw new Error('Initial accessible original watch position unavailable');
      if (!d.watchRecognitionAction('meet')) throw new Error('Watch meeting refused'); d.advanceWatchRecognitionForTest(60);
      if (!d.watchRecognitionAction('sign', d.watchRecognitionSnapshot().recognition.terms)) throw new Error('Watch sign refused'); d.advanceWatchRecognitionForTest(60);
      if (!d.watchRecognitionAction('order', d.watchRecognitionSnapshot().known.instructionTerms)) throw new Error('Watch instruction refused'); d.advanceSimulation(30); d.advanceWatchRecognitionForTest(25);
    });
    const posted = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
    const diagnostic = posted.recognition.duty?.status === 'observing' ? '' : JSON.stringify({ duty: posted.recognition.duty,
      person: posted.succession.leaders.find(a => a.id === posted.recognition.personId),
      navigation: await page.evaluate(() => window.helixHeresyDebug.citySuccessionNavigationSnapshot({ x: 19, y: 10, z: 6 })),
      context: posted.context, power: posted.office.power, maintenance: posted.office.maintenanceReady });
    expect(posted.recognition.duty?.status, diagnostic).toBe('observing');
    expect(await page.evaluate(() => { const d = window.helixHeresyDebug;
      return d.startScientistCombatAction('shove', d.watchRecognitionSnapshot().succession.ruler.id); })).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    let watch = await page.evaluate(() => window.helixHeresyDebug.watchRecognitionSnapshot());
    expect(watch.recognition.reports).toHaveLength(1); expect(watch.recognition.reports[0].communicatedAt).toBeNull();
    expect((await snap(page)).known.covenants[0].status).toBe('filed');
    expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual(['a:designation-patron:god:a']);
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.advanceWatchRecognitionForTest(650);
      if (!d.watchRecognitionAction('receive')) throw new Error('Actual witness communication refused'); d.advanceSimulation(1); });
    await reload(page); s = await snap(page);
    expect(s.known.covenants[0].status).toBe('suspended'); expect(s.charter.review).toEqual(finding);
    await expect(page.locator('[data-religious-recognition]')).toContainText('Future covenant support is suspended');
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds)).toEqual([]);
  expect(s.petition.reply).toEqual(reply); expect(s.petition.covenants[0].filing).not.toBeNull();
  expect(await act(page, 'meet')).toBe(renderer === 'canvas');
  expect(errors).toEqual([]);
});
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
  expect(s.known.scientistPosition.stance).toBe('opposedToDivineAuthority');
  expect(s.known.reply.decision).toMatchObject({ supportKind: 'exceptionalClaimAuthorization', motive: 'mortalAutonomy' });
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

for (const [renderer, position, outcome] of [['dom', 'reject', 'refused'], ['canvas', 'nihilism', 'approved']])
  test(`${renderer}: ${position} patron distinguishes anti-divine support from facilitation and future killing promises`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer, position);
    const original = await snap(page);
    await expect(page.locator('[data-religious-recognition]')).toContainText('fundamentally opposes the gods');
    await ui(page, 'meet'); await tick(page, 60);
    expect((await snap(page)).petition.reply).toBeNull();
    await ui(page, 'petition'); await tick(page, 180); await reload(page);
    let s = await snap(page);
    expect(s.known.reply.decision.outcome).toBe(outcome); expect(s.petition.request.facts.scientistPosition.promises).toContain('No conversion');
    expect(s.petition.request.facts.scientistPosition.promises).toContain('assassination');
    expect(s.petition.god.power.reserve).toBe(original.petition.god.power.reserve - 7);
    if (position === 'nihilism') {
      await expect(page.locator('[data-religious-recognition]')).toContainText('potentially including itself');
      expect(s.known.reply.decision.supportKind).toBe('exceptionalClaimAuthorization');
    } else await expect(page.locator('[data-religious-recognition]')).toContainText('no explicit exceptional teaching');
    await ui(page, 'submit'); await tick(page, 60); await reload(page); s = await snap(page);
    expect(s.petition.submissions).toHaveLength(1); expect(s.charter.recognition).toBeNull();
    expect(await page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot().context.authorizationIds))
      .toEqual(outcome === 'approved' ? ['a:designation-patron:god:a'] : []);
    expect(await act(page, 'meet')).toBe(false); expect(errors).toEqual([]);
  });
