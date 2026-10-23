const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { reload } = require('./helpers/field-station');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foundingExpeditionSnapshot());
const detail = s => JSON.stringify({ saved: s.saved, context: s.context, protector: s.protector, cell: s.cell, tasks: s.tasks });
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foundingExpeditionAction(action, options), { action, options });
const tick = (page, seconds, options = {}) => page.evaluate(({ seconds, options }) => window.helixHeresyDebug.advanceFoundingExpeditionForTest(seconds, options), { seconds, options });
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('founding-ground', {
    body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
async function finish(page) {
  for (let n = 0; n < 35; n++) { const s = await snap(page), task = s.tasks.find(t => !t.reason); if (!task) return;
    await tick(page, Math.max(1, task.dueAt - s.clock + 1), { render: false }); }
  throw new Error(`Unfinished actual work: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function walk(page, cell) {
  const current = (await snap(page)).cell;
  if (JSON.stringify(current) === JSON.stringify(cell)) return;
  expect(await page.evaluate(cell => Boolean(window.helixHeresyDebug.startScientistMove(cell.x >= 21 ? 'wildernessSurveySector' : 'supportedSurveyGround', { toCell: cell })), cell)).toBe(true);
  await finish(page);
}
async function setup(page, renderer) {
  await startLifecycleRun(page, `founding-${renderer}`);
  const fixture = await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: 'founding-home', strategicCellId: 'planet-cell:00009', seed: 'founding-boundary',
      publicProspects: {}, truth: { potentialPermille: { constructionStone: 1000, freshWater: 1000, biologicalProductivity: 1000 },
        typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } };
    d.setSurveyExpeditionTestContext({ context, network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Original lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest();
    d.configureWildernessTest({ destination: { id: 'founding-boundary', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001',
      label: 'Original boundary sector', temperatureC: 18, precipitationMm: 100, jurisdiction: 'Outside city', slopePercent: 5 } });
    d.configureWildernessBeastsTest({ actors: [] });
    // Authored prior city/person, finite purchased stocks and original natural
    // source are inputs. Never inject an agreement, camp or completion outcome.
    let s = d.exportSurveyExpeditionTestState();
    const b = s.sovereignBargains, F = window.HelixFoundingExpedition;
    const source = { ...b.source, populationSourceId: 'population:a', defenseId: Array.from({ length: 100 }, (_, n) => `original-defense-${n}`)
      .find(id => F.willing(`${id}:ward-defender`) && [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 5 !== 0) };
    const office = d.sovereignBargainSnapshot().office;
    s.sovereignBargains = window.HelixSovereignBargains.create(source, office); s.sovereignBargains.testFixture = true;
    s.scientist.skills.materialsScience = { ...(s.scientist.skills.materialsScience || {}), xp: 100000 };
    s.scientist.skills.analysis = { ...(s.scientist.skills.analysis || {}), xp: 100000 };
    // Legacy fixture has a personally granted sampling visit, not an inferred
    // founding or immigration permission.
    s.surveyExpeditions.discovery.access.active = true;
    d.importSurveyExpeditionTestState(s);
    const stone = d.surfaceStoneSnapshot().site, discovery = d.boundaryDiscoverySnapshot().discovery.baseline;
    const keys = new Set(discovery.cells.map(c => `${c.x},${c.y},${c.z}`)), rocks = new Set(discovery.rocks.map(c => `${c.x},${c.y},${c.z}`));
    const node = stone.nodes.find(n => n.remaining > 0);
    const origin = discovery.cells.find(c => c.x > 23 && c.x < 30 && c.y > 8 && c.y < 17 && Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) <= 7
      && [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]].every(([x,y]) => keys.has(`${c.x+x},${c.y+y},${c.z}`) && !rocks.has(`${c.x+x},${c.y+y},${c.z}`)));
    if (!origin) return { error: 'No clear initial plot', stone, discovery };
    const work = { ...origin, y: origin.y + 1 };
    d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer'] });
    // Finite prior purchases within ordinary capacities, carried from the start.
    const ids = d.configureHiddenWorkshopTest({ supplies: { fieldShelter: 2, drinkingWater: 4, trailMeal: 2 } });
    for (const id of ids) { const i = d.exportSurveyExpeditionTestState().physicalItemStacks.find(i => i.id === id);
      if (!d.carryActorStack('scientist', id, i.quantity)) return { error: 'Prior provisions exceed actual carrying capacity' }; }
    const staging = { x: 16, y: 8, z: 6 };
    const materialIds = d.configureHiddenWorkshopTest({ cell: staging, supplies: { lumber: 3, metalParts: 1 } });
    const faceWork = discovery.cells.find(c => Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) === 1 && !rocks.has(`${c.x},${c.y},${c.z}`));
    return { node, faceWork, origin, work, materialIds, staging, room: 'wildernessSurveySector', defenderId: s.sovereignBargains.defender.id };
  }, renderer);
  expect(fixture.error, JSON.stringify(fixture)).toBeUndefined();
  await page.locator('[data-workspace-tab="visits"]').click();
  // Starting outside the walls does not grant knowledge of the route or the
  // original municipal people. Physically visit first, then walk back out.
  await walk(page, { x: 17, y: 8, z: 6 });
  for (const key of ['fieldShelter', 'drinkingWater', 'drinkingWater', 'trailMeal']) expect(await act(page, 'give', { key })).toBe(true);
  await walk(page, fixture.faceWork);
  // Personally inspect the original face through its pre-existing work consumer.
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('inspect', id), fixture.node.id), detail(await snap(page))).toBe(true); await finish(page);
  await walk(page, fixture.work);
  expect(await act(page, 'inspect')).toBe(false); // No received water/soil evidence yet.
  // An original carried calibrated instrument, not a result granted by the camp.
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ carry: ['environmentalSurveyKit'] }));
  expect(await page.evaluate(cell => window.helixHeresyDebug.startResourceSurvey('reconnaissance', cell), fixture.work),
    await page.evaluate(cell => window.helixHeresyDebug.resourceSurveyBlockReason('reconnaissance', cell), fixture.work)).toBe(true); await finish(page);
  await walk(page, fixture.work);
  expect(await page.evaluate(() => window.helixHeresyDebug.foundingCandidate()),
    JSON.stringify(await page.evaluate(() => window.helixHeresyDebug.foundingPlotReview()))).toBeTruthy();
  const review = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foundingExpeditionSnapshot(), p = d.foundingCandidate();
    return { reason: window.HelixFoundingExpedition.inspectionReason(s.saved, { ...s.context, inspectedSite: true }, p, s.clock), p }; });
  expect(review.reason, JSON.stringify(review.p)).toBe('');
  await page.getByRole('button', { name: 'Register personally inspected founding plot here', exact: true }).click();
  expect((await snap(page)).saved.plan, JSON.stringify({ context: (await snap(page)).context, saved: (await snap(page)).saved })).toBeTruthy();
  console.info(`${renderer}: personally registered original stone/reconnaissance plot`);
  await walk(page, { x: 17, y: 8, z: 6 });
  await walk(page, fixture.staging);
  for (const id of fixture.materialIds) expect(await page.evaluate(id => { const d = window.helixHeresyDebug;
    const i = d.exportSurveyExpeditionTestState().physicalItemStacks.find(i => i.id === id); return Boolean(d.carryActorStack('scientist', id, i.quantity)); }, id)).toBe(true);
  await walk(page, { x: 17, y: 8, z: 6 });
  expect(await act(page, 'review'), detail(await snap(page))).toBe(true);
  console.info(`${renderer}: original representative/protector offered a supplied bounded release`);
  return fixture;
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: original protector physically accompanies a supplied attended founding camp; no city is conjured`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const f = await setup(page, renderer); let s = await snap(page);
  const money = s.money, health = s.protector.health, mana = s.protector.wardMana;
  expect(await act(page, 'accept', { expected: { ...s.saved.quote, fee: 0 } })).toBe(false);
  await page.getByRole('button', { name: 'Accept exactly this founding release', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(money - 240); expect(s.protector.id).toBe(f.defenderId); expect(s.protector.assignment).toBe(s.saved.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
  const initialCell = s.protector.mapCell;
  await tick(page, 3); s = await snap(page); expect(s.protector.mapCell).not.toEqual(f.work); expect(s.protector.mapCell).not.toEqual(initialCell);
  await walk(page, f.work);
  for (let n = 0; n < 20 && (await snap(page)).saved.phase !== 'camp'; n++) await tick(page, 5);
  s = await snap(page); expect(s.saved.phase, detail(s)).toBe('camp'); expect(s.protector.mapCell).toEqual(s.saved.plan.post);
  console.info(`${renderer}: same original protector physically arrived`);
  expect(s.protector.health).toBe(health); expect(s.protector.wardMana).toBe(mana);
  await page.getByRole('button', { name: 'Build supplied temporary founding camp (11 minutes)', exact: true }).click();
  await tick(page, 335); s = await snap(page); expect(s.saved.job.progress).toBeGreaterThan(320); expect(s.saved.camp).toBeNull();
  const partial = s.saved.job.progress, hammer = s.tools.find(t => t.tool.id === s.saved.job.claims.toolId).tool.current;
  expect(s.fixtures.find(i => i.id === s.saved.job.claims.crateId).operationalState).toBe('unfinished');
  await page.getByRole('button', { name: 'Pause construction and release hammer claim', exact: true }).click();
  await tick(page, 90); expect((await snap(page)).saved.job.progress).toBe(partial);
  await reload(page, renderer); s = await snap(page); expect(s.saved.job.progress).toBe(partial);
  await page.getByRole('button', { name: 'Resume same unfinished founding construction', exact: true }).click();
  await tick(page, 340); s = await snap(page); expect(s.saved.job).toBeNull(); expect(s.saved.camp).toBeTruthy();
  expect(s.tools.find(t => t.tool.id === s.tools.find(t => t.key === 'masonryHammer').tool.id).tool.current).toBeLessThan(hammer);
  expect(s.items.filter(i => s.saved.camp.kitIds.includes(i.id)).every(i => !i.carriedBy && i.quantity === 1)).toBe(true);
  expect(s.items.filter(i => i.key === 'lumber' && i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(0);
  await tick(page, 610); expect((await snap(page)).saved.demonstratedAt).toBeNull();
  const waterBefore = s.items.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0);
  await page.getByRole('button', { name: 'Share carried founding provisions (20 seconds)', exact: true }).click();
  await tick(page, 22); s = await snap(page); expect(s.saved.mealAt).not.toBeNull();
  expect(s.items.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0)).toBe(waterBefore - 2);
  await tick(page, 605); s = await snap(page); expect(s.saved.demonstratedAt).not.toBeNull();
  await page.getByRole('button', { name: 'Personally inspect founding account', exact: true }).click();
  const dated = (await snap(page)).saved.report; expect(dated.demonstratedAt).not.toBeNull();
  await reload(page, renderer); expect((await snap(page)).saved.report).toEqual(dated);
  const earnedCamp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await page.getByRole('button', { name: 'Personally end release and withdraw protector', exact: true }).click();
  for (let n = 0; n < 25 && (await snap(page)).saved.phase !== 'returned'; n++) await tick(page, 5);
  s = await snap(page); expect(s.saved.phase).toBe('returned'); expect(s.protector.id).toBe(f.defenderId); expect(s.protector.assignment).toBeNull();
  expect(s.protector.mapCell).toEqual(s.saved.plan.home.cell); expect(s.saved.camp).toBeTruthy(); expect(s.money).toBe(money - 240);
  expect(s.saved.report).toEqual(dated); expect(s.protector.health).toBe(health); expect(s.protector.stamina).toBeLessThan(100);
  const raw = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(raw.runEnded).toBeFalsy(); expect(raw.foundingExpedition.city).toBeUndefined(); expect(raw.regionalOperations.nodes).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  // Branch only the actually earned camp for a separate physical danger fault.
  // One explicit pre-existing local beast, not a wave supplied by founding.
  await page.evaluate(saved => {
    const d = window.helixHeresyDebug, p = saved.foundingExpedition.plan, a = saved.sovereignBargains.defender;
    const beast = window.HelixWildernessBeasts.actor('beast:rimefang-pack', 'original-founding-encounter',
      { ...p.post, y: p.post.y - 1 }, 'original-boundary-population', saved.clock);
    Object.assign(beast, { targetId: a.id, provokedUntil: saved.clock + 90, nextAttackAt: saved.clock, nextMoveAt: saved.clock + 600 });
    saved.wildernessBeasts.actors = [beast]; d.importSurveyExpeditionTestState(saved);
  }, earnedCamp);
  const guardBefore = (await snap(page)).protector;
  await tick(page, 12); s = await snap(page);
  expect(s.protector.id).toBe(f.defenderId); expect(s.protector.stamina).toBeLessThan(guardBefore.stamina);
  const encountered = await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot().actors[0]);
  expect(encountered.targetId).toBe(f.defenderId); expect(encountered.nextAttackAt).toBeGreaterThan(earnedCamp.clock);
  expect(s.protector.health).toBeLessThanOrEqual(guardBefore.health); expect(s.protector.wardMana).toBeLessThanOrEqual(guardBefore.wardMana);
  expect(s.saved.demonstratedAt).toBe(earnedCamp.foundingExpedition.demonstratedAt); // Historical, not current safety.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.sovereignBargains.defender.health = 0; s.sovereignBargains.defender.status = 'dead'; d.importSurveyExpeditionTestState(s); });
  await tick(page, 1); s = await snap(page); expect(s.saved.phase).toBe('fatality'); expect(s.protector.id).toBe(f.defenderId);
  expect(s.saved.camp.crateId).toBe(earnedCamp.foundingExpedition.camp.crateId); expect(s.money).toBe(money - 240);
  expect((await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState())).runEnded).toBeFalsy();
  expect(await act(page, 'review')).toBe(false); expect(errors).toEqual([]);
});
