const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(300000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.charterRecognitionSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.charterRecognitionAction(action, terms), { action, terms });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), seconds);
const configure = (page, options) => page.evaluate(o => window.helixHeresyDebug.configureCharterRecognitionTest(o), options);
async function openVisits(page) {
  // The active workspace button is a toggle; clicking it again closes it.
  if (!await page.locator('[data-charter-recognition]').isVisible())
    await page.locator('[data-workspace-tab="visits"]').click();
}
async function uiAction(page, action) {
  // Ordinary simulation notices can return focus to the map. Reopen the
  // actual records workspace instead of trying to click its hidden controls.
  await openVisits(page);
  await page.locator(`[data-charter-recognition-action="${action}"]`).click();
}
async function reload(page) {
  const saved = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.exportSurveyExpeditionTestState()));
  await page.reload();
  await page.evaluate(raw => window.helixHeresyDebug.importSurveyExpeditionTestState(JSON.parse(raw)), saved);
  await openVisits(page);
}
async function setup(page, mode = 'dom', options = {}) {
  page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(mode => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: mode })); }, mode);
  await page.reload();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'confrontation-test', siteId: 'confrontation-lab', strategicCellId: 'planet-cell:00009', seed: 'confrontation-test',
      publicProspects: {}, truth: { potentialPermille: {}, typicalDepth: {}, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
    d.configureUnsupportedTest({ municipal: true });
    if (!d.cityConfrontationAction('walk')) throw new Error('Actual walking refused');
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) break;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
    if (!d.configureCityConfrontationTest()) throw new Error('Existing-person fixture unavailable');
  });
  expect(await act(page, 'file')).toBe(false);
  await configure(page, { bindInstitutions: true, policy: 'considerAdministrativeContinuity', ...options });
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureIncumbentResistanceTest({ health: 48, mana: 0, policy: 'preserveLife', rulerCell: { x: 16, y: 8, z: 6 }, mastery: true });
    if (!d.incumbentResistanceAction('demand') || !d.incumbentResistanceAction('soulLash')) throw new Error('Actual attack refused');
    const terms = d.incumbentResistanceSnapshot().resistance.terms;
    if (!terms || !d.incumbentResistanceAction('accept', terms)) throw new Error('Actual declaration refused');
    d.advanceSimulation(60);
  });
  await openVisits(page);
  expect((await snap(page)).abdication.receipt.origin).toBe('coerced');
}
async function waitForQueue(page) {
  const s = await snap(page);
  await page.evaluate(n => window.helixHeresyDebug.advanceCharterRecognitionForTest(n), s.recognition.review.readyAt - s.clock);
}
async function review(page) {
  expect(await act(page, 'file')).toBe(true); expect(await act(page, 'hear')).toBe(false);
  await waitForQueue(page); expect(await act(page, 'hear')).toBe(true); await advance(page, 180);
}
for (const mode of ['dom', 'canvas']) test(`${mode}: charter review and original administration recognize only their role and perform one actual records instruction`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, mode);
  const original = await snap(page), claim = original.abdication.receipt, panel = page.locator('[data-charter-recognition]');
  expect(original.recognition.claim).toEqual(claim);
  await uiAction(page, 'file');
  let s = await snap(page); expect(s.recognition.phase).toBe('queued'); expect(s.office.workSeconds).toBe(original.office.workSeconds - 30);
  const queue = s.institutions.offices[s.recognition.reviewInstitutionId].jobs;
  expect(await act(page, 'file')).toBe(false); expect(await act(page, 'hear')).toBe(false);
  expect((await snap(page)).institutions.offices[s.recognition.reviewInstitutionId].jobs).toEqual(queue);
  await waitForQueue(page); await uiAction(page, 'hear');
  await advance(page, 60); expect((await snap(page)).recognition.job.progress).toBe(60);
  await reload(page); expect((await snap(page)).recognition.job.progress).toBe(60);
  await configure(page, { powered: false }); await advance(page, 30);
  expect((await snap(page)).recognition.job.progress).toBe(60);
  await configure(page, { powered: true }); await advance(page, 1);
  expect((await snap(page)).recognition.job.progress).toBe(60);
  await advance(page, 120); s = await snap(page);
  expect(s.recognition.review.finding.outcome).toBe('eligible');
  await uiAction(page, 'meeting'); await advance(page, 60);
  s = await snap(page); expect(s.recognition.response.decision).toBe('offered');
  expect(await act(page, 'sign', { ...s.recognition.terms, role: 'militaryDefenseCommand' })).toBe(false);
  await uiAction(page, 'sign'); await advance(page, 60);
  s = await snap(page); const receipt = s.recognition.recognition;
  expect(receipt).toMatchObject({ origin: 'coerced', role: 'centralAdministration', claimId: claim.id,
    personId: s.recognition.administratorId, recorderId: original.office.clerk.id });
  expect(s.succession.control).toBeNull(); expect(s.succession.handover).toBeNull(); expect(s.succession.agreements).toEqual([]);
  expect(s.campaign.cityPower.mandate).toBeNull(); expect(s.campaign.cityPower.succession).toBeNull();
  expect(await act(page, 'instruct', { ...s.known.instructionTerms, role: 'militaryDefenseCommand' })).toBe(false);
  await uiAction(page, 'instruct'); await advance(page, 30);
  expect((await snap(page)).recognition.instruction).toBeNull();
  await reload(page); expect((await snap(page)).recognition.job.progress).toBe(30); await advance(page, 30);
  s = await snap(page); expect(s.recognition.instruction.status).toBe('completed');
  const records = s.office.successionMemoranda; expect(records).toHaveLength(1);
  expect(s.office.records).toEqual(original.office.records);
  expect(records[0]).toMatchObject({ authorId: s.recognition.administratorId, recorderId: original.office.clerk.id,
    institutionId: original.office.institutionId, contents: { origin: 'coerced', recognizedRole: 'centralAdministration', claimId: claim.id } });
  expect(s.office.power).toBe(original.office.power - 4); expect(s.office.workSeconds).toBe(original.office.workSeconds - 390);
  expect(s.succession.leaders.find(a => a.id === s.recognition.administratorId).workSeconds)
    .toBe(original.succession.leaders.find(a => a.id === s.recognition.administratorId).workSeconds - 180);
  expect(s.abdication.receipt).toEqual(claim); expect(s.succession.ruler.health).toBe(34);
  expect(await act(page, 'instruct', s.known.instructionTerms)).toBe(false); expect(await act(page, 'sign', s.recognition.terms)).toBe(false);
  await reload(page); s = await snap(page); expect(s.recognition.recognition).toEqual(receipt);
  expect(s.office.successionMemoranda).toHaveLength(1);
  expect(JSON.stringify(s.known)).not.toMatch(/recognitionPolicy|workSeconds|personalDefense|"evidence"/);
  await openVisits(page);
  await expect(panel).toContainText('Other institutions have not agreed'); expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.startScientistMove('supportedSurveyGround', { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true }))).toBeTruthy();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let i = 0; i < 35; i++) {
      const s = d.surveyExpeditionSnapshot(), task = s.tasks.find(t => !t.reason);
      if (!task) break;
      d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
    }
  });
  const received = (await snap(page)).known;
  await configure(page, { administratorHealth: 0 });
  await page.evaluate(() => window.helixHeresyDebug.advanceCharterRecognitionForTest(60));
  s = await snap(page); expect(s.context.atCounter).toBe(false); expect(s.known).toEqual(received);
  expect(s.known.recognition).toEqual(receipt); expect(errors).toEqual([]);
});
test('published uncoerced-only law rejects an authentic claim without awarding institutional recognition', async ({ page }) => {
  await setup(page); let s = await snap(page);
  await configure(page, { rule: { ...s.context.rule, coercionRule: 'uncoercedDesignationRequired' } });
  await review(page); s = await snap(page); expect(s.recognition.review.finding.outcome).toBe('ineligible');
  expect(await act(page, 'meeting')).toBe(false); expect(await act(page, 'file')).toBe(false);
  await reload(page); expect((await snap(page)).recognition.review.finding).toEqual(s.recognition.review.finding);
  expect((await snap(page)).recognition.recognition).toBeNull();
});
test('missing charter procedure stays unresolved and a genuinely new rule cannot compel the original administrator', async ({ page }) => {
  await setup(page, 'dom', { missingRule: true, policy: 'declineCoercedAppointment' });
  await review(page); const unresolved = (await snap(page)).recognition.review;
  expect(unresolved.finding.outcome).toBe('unresolved'); expect(await act(page, 'file')).toBe(false);
  await configure(page, {}); await review(page); let s = await snap(page);
  expect(s.recognition.previousReviews).toEqual([unresolved]); expect(s.recognition.review.finding.outcome).toBe('eligible');
  expect(await act(page, 'meeting')).toBe(true); await advance(page, 60); s = await snap(page);
  expect(s.recognition.response.decision).toBe('refused'); expect(s.recognition.terms).toBeNull();
  expect(s.recognition.recognition).toBeNull(); expect(await act(page, 'meeting')).toBe(false);
  await reload(page); expect((await snap(page)).recognition.response).toEqual(s.recognition.response);
});
