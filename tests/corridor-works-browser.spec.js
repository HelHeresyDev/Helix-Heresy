const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { fixture } = require('./helpers/corridor-works-source');
test.setTimeout(600000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.corridorWorksSnapshot());
const advance = (p, seconds) => p.evaluate(seconds => window.helixHeresyDebug.advanceCorridorWorksForTest(seconds), seconds);
const act = (p, action, id = '', part = '') => p.evaluate(({ action, id, part }) => window.helixHeresyDebug.corridorWorksAction(action, id, part), { action, id, part });
async function visits(p) { const tab = p.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(p) { await p.reload(); await p.locator('#loadLastSaveBtn').click(); await visits(p); }
async function finish(p) {
  for (let n = 0; n < 18; n++) {
    const s = await snap(p), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe(''); await advance(p, Math.max(1, Math.ceil(t.dueAt - s.clock + 1)));
  }
  throw new Error(`Original roadworks task did not finish: ${JSON.stringify((await snap(p)).tasks)}`);
}
async function move(p, roomId, cell) {
  expect(await p.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, urgent: true })), { roomId, cell })).toBe(true);
  await finish(p);
}
async function setup(p, renderer) {
  p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await startLifecycleRun(p, `corridor-repair-${renderer}`); const f = fixture();
  await p.evaluate(({ renderer, network, source }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ network, city: { cityId: 'a', assetId: 'people:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-driver', publicName: 'Original Passenger Service', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, hunger: 5, thirst: 5 });
    d.configureHiddenWorkshopTest({ fabrication: 101, carryTools: ['masonryHammer', 'stoneChisel'] });
    if (!d.setCorridorWorksTestSource(source)) throw new Error('Original causal works source rejected');
  }, { renderer, network: f.network, source: f.source });
  await visits(p);
  expect(errors).toEqual([]);
  expect((await snap(p)).sources).toHaveLength(1);
  const originalWorld = await p.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await p.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(false);
  await p.locator('[data-corridor-works-action="notice"]').click(); await finish(p);
  let s = await snap(p); expect(s.saved.sites).toEqual([]); expect(s.saved.notices).toHaveLength(1); expect(s.march?.routes || []).toEqual([]);
  const plan = s.saved.notices[0].plan;
  expect(await p.evaluate(id => window.helixHeresyDebug.intercityMarchAction('depart', id), plan.id)).toBe(true); await finish(p);
  await p.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(5000)); s = await snap(p);
  expect(s.localId, JSON.stringify(s)).toBe(f.source.id); expect(s.saved.sites).toHaveLength(1);
  expect(s.saved.sites[0].inspectedAt).toBeNull(); expect(s.network.routes[0].supportCapable).toBe(false);
  await p.locator('[data-corridor-works-action="inspect"]').click(); await finish(p);
  await p.locator('[data-corridor-works-action="authorize"]').click(); await finish(p);
  s = await snap(p); expect(s.saved.sites[0].grant.sponsorCityIds).toEqual(['a', 'b']);
  return { ...f, errors, originalWorld, roomId: s.roomId, site: s.saved.sites[0], tools: s.tools.map(t => ({ id: t.tool.id, condition: t.tool.current })) };
}
async function stage(p, part) {
  // Explicit initial owned construction lots at the already reached worksite;
  // no completed road, work effort, vehicle leg or political result is assigned.
  return p.evaluate(cell => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell, supplies: { stoneBlocks: 4, metalParts: 1 } }), { ...part.cell, y: 12 });
}
for (const renderer of ['dom', 'canvas']) test(`${renderer} physical joint-road reconstruction, saved interrupted effort, real passenger traversal and subsequent breach`, async ({ page }) => {
  const f = await setup(page, renderer), parts = f.site.site.layout.parts;
  expect(await act(page, 'build', f.source.id, parts[0].id)).toBe(false); // No invented supplies.
  for (const [index, part] of parts.entries()) {
    const ids = await stage(page, part); expect(await act(page, 'build', f.source.id, part.id)).toBe(true);
    if (index === 0) {
      await advance(page, 90); let s = await snap(page), t = s.tasks[0]; expect(t.data.corridorWork.progress).toBeGreaterThan(0);
      const progress = t.data.corridorWork.progress; await reload(page); expect((await snap(page)).tasks[0].data.corridorWork.progress).toBe(progress);
      await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), t.id); s = await snap(page);
      expect(s.saved.sites[0].site.effort[part.id]).toBeGreaterThan(0); expect(s.stacks.filter(i => ids.includes(i.id)).every(i => !i.reservedTaskId)).toBe(true);
      expect(await act(page, 'build', f.source.id, part.id)).toBe(true);
    }
    await finish(page); const s = await snap(page);
    expect(s.stacks.filter(i => ids.includes(i.id))).toEqual([]); expect(Object.keys(s.saved.sites[0].site.parts)).toHaveLength(index + 1);
    expect(s.network.routes[0].supportCapable).toBe(index === 2); expect(s.network.routes[1].continuity).toBe('closed');
  }
  let s = await snap(page); expect(s.saved.currentSupportComponents.map(c => c.cityIds)).toEqual([['a', 'b'], ['c'], ['d']]);
  expect(s.tools.every(t => t.tool.current < f.tools.find(k => k.id === t.tool.id).condition)).toBe(true);
  const physical = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  for (const part of parts) expect(physical.labMap.terrain.constructedFloors.find(f => f.cell.x === part.cell.x && f.cell.y === part.cell.y && f.cell.z === part.cell.z)?.condition).toBe(100);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('reverse'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(5000)); s = await snap(page);
  expect(s.march.operation.phase).toBe('returned'); expect(s.march.routes).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await advance(page, 1600); const passenger = await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot());
  expect(passenger.carrier.trip.distanceKm).toBe(1); expect(passenger.carrier.trip.checkpoint.cleared).toBe(false);
  // Pavement did not provide a staffed window: original inspection is still required.
  expect(await page.evaluate(() => window.helixHeresyDebug.jointTransitAction('exit'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.jointTransitAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.jointTransitAction('request'))).toBe(true); await advance(page, 110);
  expect(await page.evaluate(() => window.helixHeresyDebug.jointTransitAction('board'))).toBe(true); await finish(page);
  await advance(page, 1600); expect((await page.evaluate(() => window.helixHeresyDebug.intercityPassengerSnapshot())).carrier.location).toBe('b');
  const dated = (await snap(page)).saved.sites[0].observations;
  // Actual shared structural damage, not an injected completed failure outcome.
  expect(await page.evaluate(cell => window.helixHeresyDebug.damageStructure(cell, 200, 'force'), parts[1].cell)).toBe(true);
  s = await snap(page); expect(s.network.routes[0].supportCapable).toBe(false); expect(s.saved.currentSupportComponents.map(c => c.cityIds)).toEqual([['a'], ['b'], ['c'], ['d']]);
  expect(s.saved.sites[0].observations).toEqual(dated); await reload(page); expect((await snap(page)).network.routes[0].supportCapable).toBe(false);
  const frozen = (await snap(page)).saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).saved).toEqual(frozen);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.originalWorld);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(f.errors).toEqual([]);
});
test('DOM a released near-side work approach records the fort rather than a reached city and can withdraw without reopening the road', async ({ page }) => {
  const f = await setup(page, 'dom');
  const atlas = await page.evaluate(() => { const d = window.helixHeresyDebug; d.expansionAtlasAction('clear'); return d.expansionAtlasSnapshot(); });
  const entry = atlas.entries.find(e => e.id === f.source.id);
  expect(entry.facts.some(f => f.subject === 'personally reached joint works ground')).toBe(true);
  expect(atlas.entries.filter(e => e.kind === 'city').flatMap(e => e.facts).some(f => f.subject === 'personally reached exterior staging ground')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.outerApproachAction('approach'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('reverse'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(5000));
  const s = await snap(page); expect(s.march.operation.phase).toBe('returned'); expect(s.march.history[0].worksiteId).toBe(f.source.id);
  expect(s.march.routes).toEqual([]); expect(s.network.routes[0].supportCapable).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(f.originalWorld); expect(f.errors).toEqual([]);
});
