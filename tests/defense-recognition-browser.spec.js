const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(420000);
test.afterEach(async ({ page }, info) => {
  test.setTimeout(10000);
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('actual-run-state', { body: Buffer.from(JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState()))), contentType: 'application/json' });
});
const snap = page => page.evaluate(() => window.helixHeresyDebug.defenseRecognitionSnapshot());
const act = (page, action, terms) => page.evaluate(({ action, terms }) => window.helixHeresyDebug.defenseRecognitionAction(action, terms), { action, terms });
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceDefenseRecognitionForTest(n), seconds);
async function visits(page) { if (!await page.locator('[data-defense-recognition]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click(); }
async function ui(page, action) { await visits(page); await page.locator(`[data-defense-recognition-action="${action}"]`).click(); }
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
async function setup(page, renderer, policy = 'considerLimitedCover') {
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
    // Clerk-only test advances cannot complete the original defender's independent physical return.
    for (let i = 0; i < 20 && d.defenseRecognitionSnapshot().bargain.defender.assignment; i++) d.advanceSimulation(1);
  });
  expect(await page.evaluate(policy => window.helixHeresyDebug.configureDefenseRecognitionTest({ policy }), policy)).toBe(true);
  await visits(page);
}

for (const renderer of ['dom', 'canvas']) test(`${renderer}: original defender assent and real short-range combat cover survive reload and physical return`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  console.log(`${renderer}: actual charter, administrator and free original defender ready`);
  const original = await snap(page), a = original.bargain.defender;
  expect(a.assignment, JSON.stringify({ actor: a, context: original.context, office: original.office })).toBeFalsy();
  expect(original.charter.recognition).not.toBeNull(); expect(original.context.defenseAvailable).toBe(true);
  expect(original.context.postReachable).toBe(true);
  await ui(page, 'meet'); let started = await snap(page);
  expect(started.recognition.job, JSON.stringify({ context: started.context, actor: started.bargain.defender, office: started.office, message: started.recognition.message })).not.toBeNull();
  await advance(page, 20); expect((await snap(page)).recognition.job.progress).toBe(20);
  await reload(page); expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureDefenseRecognitionTest({ powered: false }));
  await advance(page, 500); expect((await snap(page)).recognition.job.progress).toBe(20);
  await page.evaluate(() => window.helixHeresyDebug.configureDefenseRecognitionTest({ powered: true }));
  await advance(page, 1); await advance(page, 40); let s = await snap(page);
  expect(s.recognition.response.decision).toBe('offered');
  expect(await act(page, 'sign', { ...s.known.terms, role: 'army' })).toBe(false);
  await ui(page, 'sign'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60)); s = await snap(page);
  expect(s.recognition.receipt).toMatchObject({ role: 'militaryDefenseCommand', personId: a.id, origin: 'coerced' });
  expect(s.recognition.receipt.basis.receiptId).toBe(original.charter.recognition.id);
  expect(s.charter.recognition).toEqual(original.charter.recognition);
  expect(s.office.power).toBe(original.office.power - 2);
  expect(s.bargain.defender.workSeconds).toBe(a.workSeconds - 120);
  expect(s.bargain.defender.wardMana).toBe(a.wardMana); expect(s.bargain.defender.health).toBe(a.health);
  console.log(`${renderer}: separate defender signature completed`);
  expect(s.succession.control).toBeNull(); expect(s.succession.handover).toBeNull(); expect(s.succession.provision.stock).toBe(0);
  const terms = s.known.instructionTerms;
  expect(await act(page, 'order', { ...terms, radiusM: 100 })).toBe(false);
  await ui(page, 'order'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(30));
  s = await snap(page); expect(s.recognition.duty, JSON.stringify(s.context)).not.toBeNull();
  expect(s.recognition.duty.status).toBe('walking');
  await advance(page, 2); s = await snap(page);
  expect(s.recognition.duty.status).toBe('covering'); expect(s.bargain.defender.mapCell).toEqual({ x: 19, y: 8, z: 6 });
  expect(s.bargain.defender.stamina).toBe(a.stamina - 1);
  // Explicit prepared evasion, not a force-hit flag: the ordinary bounded accuracy contest still decides the strike.
  await page.evaluate(() => window.helixHeresyDebug.configureDefenseRecognitionTest({ scientistEvasionXp: 0 }));
  const before = await snap(page);
  const attack = await page.evaluate(() => window.helixHeresyDebug.defenseIncomingStrikeForTest({ baseDamage: 20 }));
  expect(attack.ok).toBe(true); expect(attack.hit, JSON.stringify(attack)).toBe(true);
  s = await snap(page); expect(attack.damage).toBeGreaterThan(0); expect(attack.damage).toBeLessThan(20);
  expect(before.bargain.defender.wardMana - s.bargain.defender.wardMana).toBe(24);
  expect(s.recognition.duty.absorbed).toBe(12); expect(before.health - s.health).toBe(attack.damage);
  console.log(`${renderer}: real shared-combat hit consumed original ward mana`);
  await advance(page, 20); const partial = await snap(page); await reload(page); s = await snap(page);
  expect(s.recognition.duty).toEqual(partial.recognition.duty); expect(s.bargain.defender.wardMana).toBe(partial.bargain.defender.wardMana);
  if (renderer === 'dom') {
    // The same private former incumbent is a real reachable shared-combat target.
    expect(await page.evaluate(() => {
      const d = window.helixHeresyDebug;
      return d.startScientistCombatAction('shove', d.defenseRecognitionSnapshot().succession.ruler.id);
    })).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    s = await snap(page); expect(s.recognition.duty?.status || s.recognition.completions[0]?.status).toMatch(/returning|interruptedReturn/);
    await advance(page, 5); s = await snap(page); expect(s.recognition.completions[0].status).toBe('interruptedReturn');
    expect(s.recognition.completions[0].reason).toMatch(/aggression/);
  } else {
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(110)); s = await snap(page);
    expect(s.recognition.completions[0].status).toBe('completed'); expect(s.recognition.completions[0].seconds).toBe(120);
  }
  expect(s.recognition.duty).toBeNull(); expect(s.recognition.completions).toHaveLength(1);
  console.log(`${renderer}: original defender physically returned`);
  expect(s.bargain.defender.mapCell).toEqual(a.mapCell); expect(s.bargain.defender.stamina).toBe(a.stamina - 2);
  expect(s.recognition.receipt).toEqual(partial.recognition.receipt);
  expect(await act(page, 'order', terms)).toBe(false);
  expect(await page.evaluate(() => Boolean(window.helixHeresyDebug.startScientistMove('supportedSurveyGround',
    { toCell: { x: 10, y: 14, z: 6 }, allowMultiRoom: true })))).toBe(true);
  await finishWalk(page); const dated = (await snap(page)).known; await advance(page, 500);
  expect((await snap(page)).known).toEqual(dated); expect(errors).toEqual([]);
});
