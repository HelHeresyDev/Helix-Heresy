const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.homunculusSnapshot());
async function advance(page, seconds) { await page.evaluate(n => window.helixHeresyDebug.advanceHomunculiForTest(n), seconds); }
async function finish(page) {
  for (let n = 0; n < 8; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['homunculusWork', 'researchWork'].includes(t.type)); if (!t) return;
    await advance(page, Math.max(60, t.dueAt - s.clock + 60));
  }
  expect((await snapshot(page)).tasks.filter(t => ['homunculusWork', 'researchWork'].includes(t.type))).toEqual([]);
}
async function action(page, action, id = '') {
  if (!await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageHomunculusTestSupplies(action, id), { action, id }))
    throw new Error(`stage ${action}: ${JSON.stringify(await page.evaluate(({ action, id }) => window.helixHeresyDebug.homunculusWorkPreview(action, id), { action, id }))}`);
  const queued = await page.evaluate(({ action, id }) => window.helixHeresyDebug.homunculusAction(action, id), { action, id });
  if (!queued) throw new Error(`${action}: ${JSON.stringify(await page.evaluate(({ action, id }) => window.helixHeresyDebug.homunculusWorkPreview(action, id), { action, id }))}`);
  await finish(page);
}
test('real staged care, research, finite chamber growth, reload and a physical independent body', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'advanced-human-growth');
  let s = await snapshot(page); expect(s.saved.individuals).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.homunculusAction('sample'))).toBe(false);
  const chamber = await page.evaluate(() => window.helixHeresyDebug.configureHomunculusTestLaboratory());
  expect((await snapshot(page)).campaign).toEqual(s.campaign);
  await page.locator('[data-workspace-tab="research"]').click();
  await expect(page.locator('[data-homunculi]')).toContainText('Adept Medicine and Alchemy');
  await action(page, 'sample'); await action(page, 'examineTemplate');
  s = await snapshot(page); expect(s.research.evidence.some(e => e.methodId === 'humanTemplateExam')).toBe(true);
  expect(s.stacks.filter(s => s.key === 'humanTissueTemplate')).toHaveLength(1);
  expect(await page.evaluate(id => window.helixHeresyDebug.homunculusAction('body', id), chamber)).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.startResearchProject('tissueCultureMethods'))).toBe(true); await finish(page);
  s = await snapshot(page); expect(s.research.projects.tissueCultureMethods.status).toBe('completed');
  expect(s.research.unlocks).toContain('fixtureBlueprint:homunculusChamber');
  await action(page, 'medium'); await action(page, 'inspect', chamber); await action(page, 'culture', chamber);
  let run = (await snapshot(page)).saved.runs[0]; expect(run.status).toBe('growing');
  await advance(page, 11 * 3600); await action(page, 'care', run.id); await advance(page, 3600);
  await action(page, 'observe', run.id); s = await snapshot(page);
  expect(s.saved.runs[0].status).toBe('completed'); expect(s.saved.individuals).toEqual([]);
  expect(s.research.evidence.filter(e => e.methodId === 'tissueCultureTrial')).toHaveLength(1);
  await action(page, 'observe', run.id); expect((await snapshot(page)).research.evidence.filter(e => e.methodId === 'tissueCultureTrial')).toHaveLength(1);
  await action(page, 'clear', run.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.startResearchProject('homunculusMorphogenesis'))).toBe(true); await finish(page);
  expect((await snapshot(page)).research.projects.homunculusMorphogenesis.status).toBe('completed');
  await action(page, 'sample'); await action(page, 'examineTemplate'); await action(page, 'medium');
  s = await snapshot(page);
  expect(s.stacks.filter(s => s.key === 'growthMedium').reduce((n, s) => n + s.quantity, 0)).toBeGreaterThanOrEqual(18);
  await action(page, 'inspect', chamber); await action(page, 'body', chamber);
  s = await snapshot(page); run = s.saved.runs[1]; expect(run.status).toBe('growing');
  const initialWater = s.fixtures.find(f => f.id === 'test-growth-water').utility.contents.cleanWater, initialProgress = run.progress;
  await page.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ power: false }));
  await advance(page, 600); s = await snapshot(page);
  expect(s.saved.runs[1].progress).toBe(initialProgress); expect(s.saved.runs[1].buffer).toBe(600); expect(s.saved.runs[1].damage).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ power: true }));
  await advance(page, 11 * 3600); await action(page, 'care', run.id); s = await snapshot(page);
  const saved = s.saved.runs[1]; await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snapshot(page); expect(s.saved.runs[1].consumed).toEqual(saved.consumed); expect(s.saved.runs[1].stocks).toEqual(saved.stocks);
  expect(s.saved.runs[1].progress).toBeCloseTo(saved.progress, 3);
  expect(s.saved.runs[1].buffer).toBe(600);
  for (let n = 0; n < 5; n++) { await advance(page, 11 * 3600); await action(page, 'care', run.id); }
  await advance(page, 7 * 3600); await action(page, 'observe', run.id); s = await snapshot(page);
  expect(s.saved.runs[1].status, JSON.stringify(s.saved.runs[1])).toBe('completed');
  const person = s.saved.individuals[0]; expect(person.status).toBe('stabilizing'); expect(person.skills).toEqual({}); expect(person.memories).toEqual([]);
  expect(person.soulOrigin).toBe('naturally-developed'); expect(person.agreement).toBeNull(); expect(person.language).toBeNull(); expect(person.id).not.toBe('scientist');
  expect(s.fixtures.find(f => f.id === 'test-growth-water').utility.contents.cleanWater).toBeLessThan(initialWater - 70);
  expect(await page.evaluate(id => window.helixHeresyDebug.homunculusAction('cancelGrowth', id), run.id)).toBe(false);
  await action(page, 'nourish', person.id); await action(page, 'release', person.id); s = await snapshot(page);
  expect(s.saved.individuals[0].chamberId).toBe(''); expect(s.saved.individuals[0].foodHours).toBeGreaterThan(24);
  await page.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ damageIndividual: 10 }));
  s = await snapshot(page); expect(s.saved.individuals[0].health).toBeLessThan(100); expect(s.injuries.some(i => i.actorId === person.id && i.actorKind === 'homunculus')).toBe(true);
  // Only actual examinations/research may add receipts; the prepared lab itself does not.
  await page.evaluate(() => window.helixHeresyDebug.setHomunculusTestSupport({ killScientist: true }));
  const frozen = (await snapshot(page)).saved; await advance(page, 3600); expect((await snapshot(page)).saved).toEqual(frozen);
  expect(errors).toEqual([]);
});
test('queued care claims the original bench across reload and cannot examine remote tissue', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'clinical-custody-and-locality');
  await page.evaluate(() => window.helixHeresyDebug.configureHomunculusTestLaboratory());
  await page.evaluate(() => window.helixHeresyDebug.stageHomunculusTestSupplies('sample'));
  const before = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.homunculusAction('sample'))).toBe(true);
  let s = await snapshot(page), task = s.tasks.find(t => t.type === 'homunculusWork');
  expect(s.workbench.productionTaskId).toBe(task.id); expect(task.data.reservedStackIds).toHaveLength(2);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); s = await snapshot(page);
  expect(s.workbench.productionTaskId).toBe(task.id); expect(s.tasks.find(t => t.id === task.id).data.inputQuantities).toEqual(task.data.inputQuantities);
  await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id); s = await snapshot(page);
  expect(s.workbench.productionTaskId).toBe(''); expect(s.stacks.some(s => s.reservedTaskId === task.id)).toBe(false);
  for (const key of ['medicalBandage', 'neutralizingWash']) expect(s.stacks.filter(s => s.key === key).reduce((n, s) => n + s.quantity, 0)).toBe(before.stacks.filter(s => s.key === key).reduce((n, s) => n + s.quantity, 0));
  const culture = await page.evaluate(() => window.helixHeresyDebug.prepareRemoteCultureObservationForTest());
  const evidence = (await snapshot(page)).research.evidence;
  expect(await page.evaluate(id => window.helixHeresyDebug.homunculusAction('observe', id), culture)).toBe(false);
  expect((await snapshot(page)).research.evidence).toEqual(evidence);
  await action(page, 'observe', culture); s = await snapshot(page);
  expect(s.research.evidence.filter(e => e.methodId === 'tissueCultureTrial')).toHaveLength(1); expect(s.saved.observations[culture].status).toBe('completed');
  expect(errors).toEqual([]);
});
