const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.spokenLanguageSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceHomunculiForTest(n), n);
const stage = (page, id, phase) => page.evaluate(({ id, phase }) => window.helixHeresyDebug.stageSpokenLanguageTestExamples(id, phase), { id, phase });
async function session(page, id, action, options) {
  expect(await page.evaluate(({ id, action, options }) => window.helixHeresyDebug.spokenLanguageAction(action, id, options), { id, action, options })).toBe(true);
  const s = await snapshot(page); await advance(page, s.tasks[0].dueAt - s.clock + 1); return (await snapshot(page)).saved.journal.at(-1);
}
async function checks(page, id, action, group) {
  for (const phase of [1, 2]) {
    const pair = await stage(page, id, phase), e = await session(page, id, action, { group, ...pair });
    expect(e.outcome, e.summary).toBe(phase === 1 ? 'retained' : 'understood'); await advance(page, 3600);
  }
}
async function train(page, id, side, group) {
  const pair = await stage(page, id, 0);
  const e = await session(page, id, side === 'listening' ? 'listenTeach' : 'speakPractice', { group, ...pair });
  expect(e.outcome, e.summary).toBe('practiced'); await advance(page, 3600);
  await checks(page, id, side === 'listening' ? 'listenCheck' : 'speakCheck', group);
}
test('separate spoken listening and production, actual care-backed help, reload and intelligible dark conversation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'spoken-language-learning');
  const before = await snapshot(page), setup = await page.evaluate(() => window.helixHeresyDebug.prepareSpokenLanguageTest()), id = setup.id;
  expect((await snapshot(page)).campaign).toEqual(before.campaign);
  expect((await session(page, id, 'talk', { question: 'want' })).outcome).toBe('misunderstood');
  // Creating an empty speech record is not a meaningful lesson and must not start recovery.
  expect(await page.evaluate(id => window.helixHeresyDebug.firstContactSnapshot().contact.subjects[id].lastSessionAt, id)).toBeNull();
  // This is the ordinary care procedure, with finite original reserved supplies and actual scientist movement.
  expect(await page.evaluate(id => window.helixHeresyDebug.homunculusAction('nourish', id), id)).toBe(true);
  let s = await snapshot(page); const careTask = s.tasks[0]; const careStocks = careTask.data.reservedStackIds;
  await advance(page, careTask.dueAt - s.clock + 1); s = await snapshot(page);
  const care = s.individuals[0].receivedCare.at(-1); expect(care, JSON.stringify(s.tasks)).toBeTruthy(); expect(care.consumed).toBe(true); expect(care.unconditional).toBe(true);
  expect(care.inputs.map(i => i.stackId).sort()).toEqual(careStocks.sort()); expect(s.stacks.some(i => careStocks.includes(i.id))).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.returnSpokenTestTeacher(id), id)).toBe(true);
  s = await snapshot(page); await advance(page, s.tasks[0].dueAt - s.clock + 1);
  expect((await snapshot(page)).tasks).toEqual([]);
  const pair = await stage(page, id, 0);
  await page.locator('[data-workspace-tab="research"]').click();
  await page.getByLabel('Spoken food example for Explicit first-contact test individual').selectOption(pair.foodId);
  await page.getByLabel('Spoken water example for Explicit first-contact test individual').selectOption(pair.waterId);
  await page.locator('[data-spoken-action="listenTeach"]').click();
  const pending = (await snapshot(page)).tasks[0]; await advance(page, 300);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); s = await snapshot(page); expect(s.tasks[0].id).toBe(pending.id);
  await advance(page, pending.dueAt - s.clock + 1); expect((await snapshot(page)).saved.journal.at(-1).outcome).toBe('practiced'); await advance(page, 3600);
  await checks(page, id, 'listenCheck', 'core');
  expect((await session(page, id, 'talk', { question: 'want' })).outcome).toBe('unintelligible');
  await train(page, id, 'production', 'core');
  expect((await session(page, id, 'talk', { question: 'help' })).utterance).toEqual(['self', 'unknown']);
  await train(page, id, 'listening', 'help'); await train(page, id, 'production', 'help');
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { waterHours: 8, vision: false }), id);
  await page.evaluate(id => window.helixHeresyDebug.setSpokenLanguageTestCondition(id, { dark: true }), id);
  const e = await session(page, id, 'talk', { question: 'help' }); expect(e.utterance).toEqual(['self', 'want', 'help', 'water']);
  s = await snapshot(page); expect(s.individuals[0].waterHours).toBeLessThan(8); expect(s.individuals[0].agreement).toBeNull(); expect(s.individuals[0].skills).toEqual({});
  const saved = s.saved; await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved).toEqual(saved);
  await page.evaluate(id => window.helixHeresyDebug.setSpokenLanguageTestCondition(id, { throatInjury: true }), id);
  expect((await session(page, id, 'talk', { question: 'wantWater' })).outcome).toBe('unintelligible');
  await page.evaluate(id => window.helixHeresyDebug.setSpokenLanguageTestCondition(id, { clearThroat: true, hearing: false }), id);
  expect((await session(page, id, 'talk', { question: 'wantWater' })).outcome).toBe('unavailable');
  expect((await snapshot(page)).campaign).toEqual(before.campaign); expect(errors).toEqual([]);
});
test('lost hearing interrupts spoken lessons, slimes never learn, and scientist death freezes speech', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'spoken-language-channel');
  const setup = await page.evaluate(() => window.helixHeresyDebug.prepareSpokenLanguageTest()), id = setup.id;
  expect(await page.evaluate(({ id, options }) => window.helixHeresyDebug.spokenLanguageAction('listenTeach', id, options), { id, options: { ...setup.pairs[0], group: 'core' } })).toBe(true);
  await page.evaluate(id => window.helixHeresyDebug.setSpokenLanguageTestCondition(id, { hearing: false }), id); await advance(page, 60);
  expect((await snapshot(page)).saved.journal.at(-1).outcome).toBe('unavailable'); expect((await snapshot(page)).saved.subjects[id]).toBeUndefined();
  await page.evaluate(id => window.helixHeresyDebug.setSpokenLanguageTestCondition(id, { hearing: true }), id);
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { fatigue: 35 }), id);
  const context = await page.evaluate(({ id, options }) => window.helixHeresyDebug.spokenLanguageTestContext(id, options), { id, options: setup.pairs[0] });
  expect(context.teacherToLearner && context.visual && context.examplesValid, JSON.stringify(context)).toBe(true);
  expect((await session(page, id, 'listenTeach', { ...setup.pairs[0], group: 'core' })).outcome).toBe('refused');
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { fatigue: 0 }), id);
  expect(await page.evaluate(id => window.helixHeresyDebug.signedLanguageAction('talk', id, { question: 'want' }), id)).toBe(true);
  const signed = await page.evaluate(() => window.helixHeresyDebug.signedLanguageSnapshot());
  await advance(page, signed.tasks[0].dueAt - signed.clock + 1);
  expect(await page.evaluate(() => window.helixHeresyDebug.signedLanguageSnapshot().saved.journal.at(-1).outcome)).toBe('recovering');
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await session(page, id, 'talk', { question: 'want' })).outcome).toBe('recovering');
  const cell = await page.evaluate(() => window.helixHeresyDebug.firstContactSnapshot().cell);
  const slime = await page.evaluate(cell => window.helixHeresyDebug.createSpatialTestSlime({ cell, size: 'Tiny' }), cell);
  for (const action of ['listenTeach', 'listenCheck', 'speakPractice', 'speakCheck', 'talk']) {
    const e = await session(page, slime.id, action, { ...setup.pairs[0], group: 'core', question: 'want' }); expect(['unavailable', 'notDemonstrated']).toContain(e.outcome);
  }
  expect((await snapshot(page)).saved.subjects[slime.id]).toBeUndefined();
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { killScientist: true }), id);
  const frozen = (await snapshot(page)).saved; await advance(page, 3600); expect((await snapshot(page)).saved).toEqual(frozen);
  expect(await page.evaluate(id => window.helixHeresyDebug.spokenLanguageAction('talk', id, { question: 'want' }), id)).toBe(false); expect(errors).toEqual([]);
});
