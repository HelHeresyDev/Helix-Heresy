const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), n);
const act = (page, action) => page.evaluate(action => window.helixHeresyDebug.overlandAction(action), action);
const roadside = (page, action, id = '') => page.evaluate(({ action, id }) => window.helixHeresyDebug.roadsideAction(action, id), { action, id });
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page) {
  for (let i = 0; i < 20; i++) {
    const s = await snapshot(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe(''); await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Actual roadside work did not finish');
}
async function depart(page) { expect(await act(page, 'depart')).toBe(true); await finish(page); expect((await snapshot(page)).saved.trip.status).toBe('walking'); }
async function walk(page, cell) { const s = await snapshot(page); expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: s.roomId, cell })).toBe(true); await finish(page); }
async function fixture(page, changes) {
  await page.evaluate(changes => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    if (changes.wall) s.labMap.terrain.constructedWalls.push({ cell: changes.wall, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    if (changes.clear) s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === changes.clear[k]));
    if (changes.continuity) s.strategicJourneys.destinations.find(r => r.id === s.strategicJourneys.homeDestinationId).routeContinuity = changes.continuity;
    if (changes.health != null) s.scientist.vitals.health.current = changes.health;
    if (changes.ground) s.labMap.terrain.surfaceGround.find(t => ['x', 'y', 'z'].every(k => t.cell[k] === changes.ground[k])).terrainId = 'grass';
    d.importSurveyExpeditionTestState(s);
  }, changes);
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(15000);
  await startLifecycleRun(page, `roadside-${renderer}`);
  await page.evaluate(renderer => { const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'roadside', publicProspects: {}, truth: { private: 'SECRET_GEOLOGY' } } });
    d.configureUnsupportedTest({ carry: ['drinkingWater', 'trailMeal', 'fieldShelter'] }); d.configureWildernessTest({ autoCare: false, thirst: 15, hunger: 15 });
  }, renderer);
  const original = await page.evaluate(() => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return {
    body: s.scientist.vocalBodyId, money: s.economy.money, carrier: s.surveyExpeditions.carrier, world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  await depart(page); await advance(page, 90); return { errors, original };
}
test('Canvas stopped ground, physical shelter/property, partial saved departure, obstruction and actual return revisit retain original goods and terrain', async ({ page }) => {
  const { errors, original } = await setup(page, 'canvas'); await visits(page); await page.getByRole('button', { name: 'Stop walking here', exact: true }).click();
  let s = await snapshot(page); const site = s.stop, position = s.saved.trip.positionKm, kit = s.stacks.find(i => i.key === 'fieldShelter').id;
  expect(site, JSON.stringify(s.stopAccess)).toBeTruthy(); expect(site.baseline).toHaveLength(120); expect(s.cell).toEqual(site.entry); expect(s.sheltered).toBe(false);
  const local = { x: 18, y: 14, z: site.entry.z }; await walk(page, local);
  expect((await snapshot(page)).saved.trip.positionKm).toBe(position); expect((await snapshot(page)).clock).toBeGreaterThan(s.clock);
  await visits(page); await page.getByRole('button', { name: 'Deploy carried shelter here', exact: true }).click(); await finish(page);
  s = await snapshot(page); expect(s.stop.shelter).toMatchObject({ stackId: kit, cell: local }); expect(s.sheltered).toBe(true);
  await fixture(page, { ground: site.entry });
  const meal = s.stacks.find(i => i.key === 'trailMeal').id; expect(await roadside(page, 'drop', meal)).toBe(true);
  expect(await act(page, 'rest')).toBe(true); await finish(page); await reload(page);
  s = await snapshot(page); expect(s.stop.baseline).toEqual(site.baseline); expect(s.stop.shelter.stackId).toBe(kit); expect(s.cell).toEqual(local);
  const ground = await page.evaluate(z => window.helixHeresyDebug.exportSurveyExpeditionTestState().labMap.terrain.surfaceGround.filter(t => t.cell.z === z), site.entry.z);
  expect(ground).toHaveLength(120); expect(ground.find(t => t.cell.x === 10 && t.cell.y === 10).terrainId).toBe('grass');
  expect(await act(page, 'resume')).toBe(true); s = await snapshot(page); expect(s.saved.trip.status).toBe('stopped'); expect(s.tasks[0].data.action).toBe('overlandResume');
  await advance(page, 1); const partial = await snapshot(page); await reload(page); expect((await snapshot(page)).cell).toEqual(partial.cell);
  expect((await snapshot(page)).tasks[0].id).toBe(partial.tasks[0].id);
  await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), partial.tasks[0].id);
  await fixture(page, { wall: site.entry }); expect(await act(page, 'resume')).toBe(false); expect((await snapshot(page)).saved.trip.positionKm).toBe(position);
  expect((await snapshot(page)).roomId).toBe(site.roomId); await fixture(page, { clear: site.entry });
  expect(await act(page, 'resume')).toBe(true); await finish(page); expect((await snapshot(page)).roomId).toBe('overlandApproachPosition');
  await visits(page); await expect(page.locator('[data-roadside-stop]')).toHaveCount(0); await expect(page.locator('[data-overland-expedition]')).not.toContainText(meal);
  await advance(page, 12000); expect((await snapshot(page)).roomId).toBe('supportedSurveyGround'); await depart(page); await advance(page, 12000);
  s = await snapshot(page); expect(s.stop.id).toBe(site.id); expect(s.saved.trip.positionKm).toBe(position); expect(s.saved.trip.status).toBe('stopped');
  expect(s.stop.baseline).toEqual(site.baseline); expect(s.stop.shelter.stackId).toBe(kit); expect(s.stop.visits).toBe(2);
  const retained = await page.evaluate(({ kit, meal }) => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    kit: s.physicalItemStacks.find(i => i.id === kit), meal: s.physicalItemStacks.find(i => i.id === meal), valid: d.validateMapScene() }; }, { kit, meal });
  expect(retained.kit).toMatchObject({ quantity: 1, carriedBy: '', roomId: site.roomId, cell: local });
  expect(retained.meal).toMatchObject({ quantity: 1, carriedBy: '', roomId: site.roomId, cell: local }); expect(retained.valid).toEqual([]);
  expect(await roadside(page, 'take', meal)).toBe(true); await finish(page); expect(await roadside(page, 'packShelter')).toBe(true); await finish(page);
  s = await snapshot(page); expect(s.stop.shelter).toBeNull(); expect(s.stacks.some(i => i.id === kit)).toBe(true); expect(s.stacks.some(i => i.id === meal)).toBe(true);
  expect(await act(page, 'resume')).toBe(true); await finish(page); await advance(page, 12000); expect((await snapshot(page)).saved.trip.status).toBe('arrived');
  const final = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    body: s.scientist.vocalBodyId, money: s.economy.money, carrier: s.surveyExpeditions.carrier, valid: d.validateMapScene(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; });
  expect(final.body).toBe(original.body); expect(final.money).toBe(original.money); expect(final.carrier?.vehicle).toEqual(original.carrier?.vehicle);
  expect(final.carrier?.contract).toBeFalsy(); expect(final.world).toBe(original.world); expect(final.valid).toEqual([]); expect(errors).toEqual([]);
});
test('DOM concrete route loss and incapacity keep the same living position/site, local supplies work, death freezes and fresh same-world games inherit no camp', async ({ page }) => {
  const { errors } = await setup(page, 'dom'); const before = await snapshot(page);
  await fixture(page, { continuity: 'closed' }); await advance(page, 2);
  let s = await snapshot(page); expect(s.saved.trip).toMatchObject({ status: 'stopped', positionKm: before.saved.trip.positionKm }); expect(s.stop).toBeTruthy();
  expect(s.saved.trip.reason).toContain('traversable'); const site = s.stop;
  expect(await act(page, 'resume')).toBe(false); await act(page, 'stop'); await reload(page); expect((await snapshot(page)).stop.id).toBe(site.id);
  await fixture(page, { continuity: 'municipal' }); expect(await act(page, 'resume')).toBe(true); await advance(page, 20);
  s = await snapshot(page); const moved = s.saved.trip.positionKm; expect(moved).toBeGreaterThan(site.positionKm);
  await fixture(page, { health: 5 }); await advance(page, 2); s = await snapshot(page);
  expect(s.saved.trip.positionKm).toBe(moved); expect(s.saved.trip.status).toBe('stopped'); expect(s.stop.id).not.toBe(site.id);
  expect(await act(page, 'resume')).toBe(false); await advance(page, 60); expect((await snapshot(page)).saved.trip.positionKm).toBe(moved);
  await fixture(page, { health: 100 }); expect(await act(page, 'water')).toBe(true); await finish(page); expect((await snapshot(page)).needs.thirst).toBeLessThan(s.needs.thirst);
  const stopped = await snapshot(page); await reload(page); expect((await snapshot(page)).stops).toEqual(stopped.stops);
  expect(await roadside(page, 'shelter')).toBe(true); await advance(page, 10); const unfinished = (await snapshot(page)).tasks[0];
  expect(unfinished.data.roadsideSiteId).toBe(stopped.stop.id);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = await snapshot(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), unfinished.id)).toBe(false);
  expect(await roadside(page, 'shelter')).toBe(false); expect(await act(page, 'reverse')).toBe(false); await advance(page, 100);
  expect((await snapshot(page)).stops).toEqual(frozen.stops); expect((await snapshot(page)).saved).toEqual(frozen.saved);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/); expect((await snapshot(page)).stops).toBeNull(); expect(errors).toEqual([]);
});
