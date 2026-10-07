const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(360000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.leasedAnnexSnapshot());
const action = (page, name, options = {}) => page.evaluate(({ name, options }) => window.helixHeresyDebug.leasedAnnexAction(name, options), { name, options });
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceLeasedAnnexForTest(seconds), seconds);
const canonicalWorld = page => page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
async function facilities(page) {
  if ((await snapshot(page)).saved?.away) { await page.locator('[data-workspace-tab="visits"]').click(); return; }
  if (!await page.locator('[data-economy-menu-tab="facilities"]').isVisible()) await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="facilities"]').click();
}
async function start(page) {
  await startLifecycleRun(page, 'leased-annex');
  const pristine = await canonicalWorld(page);
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, 'leased-annex'));
  const source = await page.evaluate(() => window.helixHeresyDebug.configureLaboratoryAssistantTestSupport());
  expect(source).toBeTruthy(); await facilities(page);
  await page.getByRole('button', { name: 'Review annex lease', exact: true }).click();
  await expect(page.locator('#economyFacilitiesList')).toContainText('deposit 150 marks');
  await page.getByRole('button', { name: 'Sign exact annex terms', exact: true }).click();
  const s = await snapshot(page); expect(s.money).toBe(625); expect(s.bench.condition).toBe(100);
  expect(await canonicalWorld(page)).toBe(pristine);
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ atLoading: true }));
  return source;
}
async function finishTasks(page) {
  for (let i = 0; i < 6; i++) {
    const s = await snapshot(page), task = s.tasks.find(t => ['surveyExpeditionWork', 'scientistMove', 'physicalDiagnostic'].includes(t.type));
    if (!task) return;
    await advance(page, Math.max(1, task.dueAt - s.clock + 1));
  }
  const stalled = await snapshot(page);
  expect(stalled.tasks, JSON.stringify({ scientist: stalled.scientist, stacks: stalled.stacks.filter(s => s.reservedTaskId), lease: stalled.saved.lease })).toEqual([]);
}
async function pack(page, id) {
  expect(await action(page, 'pack', { stackId: id })).toBe(true); await finishTasks(page);
}
async function finishWalk(page) {
  for (let i = 0; i < 6; i++) {
    const s = await snapshot(page); if (!s.saved.trip) return;
    expect(s.saved.trip.reason).toBe(''); expect(s.nextEvent).toBeTruthy();
    await advance(page, Math.ceil(s.nextEvent.time - s.clock + 10));
  }
  expect((await snapshot(page)).saved.trip).toBeNull();
}
async function depart(page) {
  // Explicit starting-position fixture avoids retesting unrelated basement navigation.
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ atReception: true }));
  await facilities(page); await page.getByRole('button', { name: 'Depart for leased annex', exact: true }).click();
}
test('leased annex uses physical supplies, timed walking and reload; scientist can assay after original bench loss and return without shared inventory', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const sample = await start(page), initial = await snapshot(page);
  const world = await canonicalWorld(page);
  expect(await action(page, 'depart')).toBe(false); // Must reach public departure point.
  expect(await action(page, 'pack', { stackId: sample, amount: 1000 })).toBe(false);
  for (const id of [sample, initial.stacks.find(s => s.key === 'assayCase').id, initial.stacks.find(s => s.key === 'assayReagent').id]) await pack(page, id);
  let s = await snapshot(page); expect(s.stacks.filter(g => g.carriedBy === 'scientist')).toHaveLength(3);
  await depart(page); s = await snapshot(page); expect(s.scientist.roomId).toBe('annexMunicipalWalk');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
  s = await snapshot(page); expect(s.scientist.roomId).toBe('annexMunicipalWalk'); expect(s.runEnded).toBe(false);
  expect(s.saved.trip.positionKm).toBeGreaterThan(0);
  expect(await action(page, 'assay', { stackId: sample })).toBe(false);
  await advance(page, 100); const walking = await snapshot(page);
  expect(walking.saved.trip.positionKm).toBeGreaterThan(0); expect(walking.saved.trip.positionKm).toBeLessThan(1.5);
  await action(page, 'pause'); await advance(page, 100); expect((await snapshot(page)).saved.trip.positionKm).toBe(walking.saved.trip.positionKm);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snapshot(page); expect(s.saved.trip.positionKm).toBe(walking.saved.trip.positionKm); expect(s.saved.trip.paused).toBe(true);
  await action(page, 'resume'); await finishWalk(page);
  s = await snapshot(page); expect(s.scientist.roomId, JSON.stringify(s.saved.trip)).toBe('leasedAssayAnnex');
  expect(s.stacks.filter(g => g.roomId === 'leasedAssayAnnex' && g.carriedBy === 'scientist')).toHaveLength(3);
  expect(s.stacks.some(g => g.roomId === 'leasedAssayAnnex' && g.key === 'assayReagent' && !g.carriedBy)).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ breakOriginalBench: true }));
  const carriedReagent = s.stacks.find(g => g.carriedBy === 'scientist' && g.key === 'assayReagent');
  expect(await action(page, 'assay', { stackId: sample })).toBe(false); // Carried reagent must be physically staged.
  expect(await action(page, 'drop', { stackId: carriedReagent.id })).toBe(true);
  await facilities(page); await page.getByRole('button', { name: `Assay sealed portion (${sample})`, exact: true }).click();
  s = await snapshot(page); expect(s.tasks.find(t => t.type === 'physicalDiagnostic').data.workstationId).toBe('leased-annex-bench');
  await finishTasks(page); s = await snapshot(page);
  expect(s.diagnostics.results.at(-1)).toMatchObject({ workflowId: 'assaySample' });
  expect(s.stacks.some(g => g.id === sample)).toBe(false);
  expect(s.stacks.filter(g => g.key === 'assayReagent').reduce((n, g) => n + g.quantity, 0)).toBe(11);
  // Leave actual tool here: handback must refuse to delete it, and returning must not teleport it home.
  const tool = s.stacks.find(g => g.carriedBy === 'scientist' && g.key === 'assayCase');
  expect(await action(page, 'drop', { stackId: tool.id })).toBe(true);
  expect(await action(page, 'handback')).toBe(false);
  expect(await action(page, 'return')).toBe(true); const remembered = (await snapshot(page)).saved.observation;
  await finishWalk(page); s = await snapshot(page);
  expect(s.scientist.roomId).toBe('surfaceReception'); expect(s.saved.away).toBe(false);
  expect(s.stacks.find(g => g.id === tool.id)).toMatchObject({ roomId: 'leasedAssayAnnex', carriedBy: '' });
  expect(s.saved.observation).toEqual(remembered); expect(s.campaign.readiness).toEqual(initial.campaign.readiness);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); s = await snapshot(page);
  expect(s.stacks.find(g => g.id === tool.id).roomId).toBe('leasedAssayAnnex');
  expect(await canonicalWorld(page)).toBe(world);
  expect(errors).toEqual([]);
});
test('expiry interrupts local assays without refunds or lost goods; retrieval, exact damaged-property handback and death freeze remain physical', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const sample = await start(page), initial = await snapshot(page);
  for (const id of [sample, initial.stacks.find(s => s.key === 'assayCase').id, initial.stacks.find(s => s.key === 'assayReagent').id]) await pack(page, id);
  await depart(page); await finishWalk(page);
  let s = await snapshot(page); const reagent = s.stacks.find(g => g.carriedBy === 'scientist' && g.key === 'assayReagent');
  await action(page, 'drop', { stackId: reagent.id }); expect(await action(page, 'assay', { stackId: sample })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ expire: true }));
  await advance(page, 100); s = await snapshot(page);
  expect(s.saved.lease.status).toBe('expired'); expect(s.money).toBe(625); expect(s.diagnostics.results).toEqual([]);
  expect(s.stacks.find(g => g.id === sample)).toBeTruthy(); expect(s.tasks.some(t => t.type === 'physicalDiagnostic')).toBe(true);
  expect(await action(page, 'assay', { stackId: sample })).toBe(false);
  expect(await action(page, 'return')).toBe(true); // Blocked task can remain queued; no fake completion.
  await finishWalk(page); expect((await snapshot(page)).scientist.roomId).toBe('surfaceReception');
  // Retrieval trip remains allowed after expiry; renewal cannot create equipment or replace missing goods.
  expect(await action(page, 'depart')).toBe(true); await finishWalk(page);
  s = await snapshot(page); expect(s.saved.lease.status).toBe('expired');
  expect(await action(page, 'quote')).toBe(true); expect(await action(page, 'sign')).toBe(true);
  expect((await snapshot(page)).tasks.find(t => t.type === 'physicalDiagnostic').dueAt).toBeGreaterThan((await snapshot(page)).clock);
  await finishTasks(page); s = await snapshot(page); expect(s.diagnostics.results).toHaveLength(1); expect(s.money).toBe(400);
  // Work consumed the sample and staged reagent, leaving no floor property. Real bench damage affects refund.
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ benchCondition: 50 }));
  expect(await action(page, 'handback')).toBe(true); s = await snapshot(page); expect(s.money).toBe(475); expect(s.saved.lease.status).toBe('terminated');
  expect(await action(page, 'handback')).toBe(false); expect(await action(page, 'quote')).toBe(false);
  expect(await action(page, 'return')).toBe(true); await finishWalk(page);
  expect(await action(page, 'depart')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const dead = await snapshot(page);
  await advance(page, 86400); s = await snapshot(page); expect(s.saved).toEqual(dead.saved); expect(s.money).toBe(dead.money);
  expect(errors).toEqual([]);
});
