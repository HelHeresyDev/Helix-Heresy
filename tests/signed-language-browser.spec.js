const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.signedLanguageSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceHomunculiForTest(n), n);
const stage = (page, id, phase) => page.evaluate(({ id, phase }) => window.helixHeresyDebug.stageSignedLanguageTestExamples(id, phase), { id, phase });
async function session(page, id, action, options) {
  expect(await page.evaluate(({ id, action, options }) => window.helixHeresyDebug.signedLanguageAction(action, id, options), { id, action, options })).toBe(true);
  const s = await snapshot(page); await advance(page, s.tasks[0].dueAt - s.clock + 1); return (await snapshot(page)).saved.journal.at(-1);
}
test('physical signed instruction, grounded transfer, reload, expressive requests and no free permission', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'signed-language-learning');
  const before = await snapshot(page), setup = await page.evaluate(() => window.helixHeresyDebug.prepareSignedLanguageTest());
  expect(setup?.id).toBeTruthy(); expect((await snapshot(page)).campaign).toEqual(before.campaign);
  const id = setup.id;
  await page.locator('[data-workspace-tab="research"]').click();
  const panel = page.locator('[data-signed-language]'); await expect(panel).toContainText('Local Signed Language');
  await page.getByLabel(`Food example for Explicit first-contact test individual`).selectOption(setup.pairs[0].foodId);
  await page.getByLabel(`Water example for Explicit first-contact test individual`).selectOption(setup.pairs[0].waterId);
  await panel.locator('[data-signed-action="instruct"]').click();
  const pending = (await snapshot(page)).tasks[0]; expect(pending.type).toBe('signedLanguage');
  await advance(page, 300); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  let s = await snapshot(page); expect(s.tasks[0].id).toBe(pending.id); await advance(page, pending.dueAt - s.clock + 1);
  expect((await snapshot(page)).saved.journal.at(-1).outcome).toBe('practiced');
  expect((await session(page, id, 'check', { group: 'references', ...setup.pairs[1] })).outcome).toBe('recovering'); await advance(page, 3600);
  for (const phase of [1, 2]) {
    const pair = await stage(page, id, phase); const e = await session(page, id, 'check', { group: 'references', ...pair });
    expect(e.outcome).toBe(phase === 1 ? 'retained' : 'understood'); await advance(page, 3600);
  }
  const example = await stage(page, id, 0); expect((await session(page, id, 'instruct', { group: 'preferences', ...example })).outcome).toBe('practiced'); await advance(page, 3600);
  for (const phase of [1, 2]) {
    const pair = await stage(page, id, phase); expect((await session(page, id, 'check', { group: 'preferences', ...pair })).outcome).toBe(phase === 1 ? 'retained' : 'understood'); await advance(page, 3600);
  }
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { waterHours: 8 }), id);
  expect((await session(page, id, 'talk', { question: 'want' })).utterance).toEqual(['self', 'want', 'water']);
  s = await snapshot(page); expect(s.individuals[0].waterHours).toBeLessThan(8); expect(s.individuals[0].agreement).toBeNull(); expect(s.individuals[0].skills).toEqual({});
  expect((await session(page, id, 'talk', { question: 'pain' })).utterance).toEqual(['self', 'unknown']);
  const saved = (await snapshot(page)).saved; await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved).toEqual(saved);
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { health: 65 }), id);
  expect((await session(page, id, 'talk', { question: 'wantFood' })).outcome).toBe('refused');
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { health: 100 }), id);
  expect((await session(page, id, 'talk', { question: 'wantFood' })).outcome).toBe('recovering');
  expect((await snapshot(page)).campaign).toEqual(before.campaign); expect(errors).toEqual([]);
});
test('slime attempts fail, lost channels never teach, and death freezes signed sessions', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'signed-language-channel');
  const setup = await page.evaluate(() => window.helixHeresyDebug.prepareSignedLanguageTest()), id = setup.id;
  expect(await page.evaluate(({ id, options }) => window.helixHeresyDebug.signedLanguageAction('instruct', id, options), { id, options: { group: 'references', ...setup.pairs[0] } })).toBe(true);
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { vision: false }), id); await advance(page, 60);
  expect((await snapshot(page)).saved.journal.at(-1).outcome).toBe('unavailable'); expect((await snapshot(page)).saved.subjects[id]).toBeUndefined();
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { vision: true }), id);
  const slime = await page.evaluate(cell => window.helixHeresyDebug.createSpatialTestSlime({ cell, size: 'Tiny' }), (await snapshot(page)).cell);
  for (const action of ['instruct', 'check', 'talk']) {
    const e = await session(page, slime.id, action, { group: 'references', question: 'want', ...setup.pairs[0] }); expect(['unavailable', 'notDemonstrated']).toContain(e.outcome);
  }
  expect((await snapshot(page)).saved.subjects[slime.id]).toBeUndefined();
  expect(await page.evaluate(({ id, options }) => window.helixHeresyDebug.signedLanguageAction('instruct', id, options), { id, options: { group: 'references', ...setup.pairs[0] } })).toBe(true);
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { remote: true }), id); await advance(page, 60);
  expect((await snapshot(page)).saved.journal.at(-1).outcome).toBe('unavailable');
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { killScientist: true }), id);
  const frozen = (await snapshot(page)).saved; await advance(page, 3600); expect((await snapshot(page)).saved).toEqual(frozen);
  expect(await page.evaluate(id => window.helixHeresyDebug.signedLanguageAction('talk', id, { question: 'want' }), id)).toBe(false); expect(errors).toEqual([]);
});
