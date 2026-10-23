const { expect } = require('@playwright/test');
const { startLifecycleRun } = require('./start-lifecycle-run');
const snap = page => page.evaluate(() => window.helixHeresyDebug.foundingExpeditionSnapshot());
const detail = s => JSON.stringify({ saved: s.saved, context: s.context, protector: s.protector, cell: s.cell, tasks: s.tasks });
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foundingExpeditionAction(action, options), { action, options });
const tick = (page, seconds, options = {}) => page.evaluate(({ seconds, options }) => window.helixHeresyDebug.advanceFoundingExpeditionForTest(seconds, options), { seconds, options });
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
async function setup(page, renderer, works = false) {
  await startLifecycleRun(page, `founding-${renderer}`);
  const fixture = await page.evaluate(({ renderer, works }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: 'founding-home', strategicCellId: 'planet-cell:00009', seed: 'founding-boundary',
      publicProspects: {}, truth: { potentialPermille: { constructionStone: 1000, freshWater: 1000, biologicalProductivity: 1000 },
        typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } };
    d.setSurveyExpeditionTestContext({ context, network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Original lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] } });
    d.configureScientistIdentityTest({ office: true, money: works ? 10000 : 1000 }); d.configureSovereignBargainTest();
    d.configureWildernessTest({ destination: { id: 'founding-boundary', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001',
      label: 'Original boundary sector', temperatureC: 18, precipitationMm: 100, jurisdiction: 'Outside city', slopePercent: 5 } });
    d.configureWildernessBeastsTest({ actors: [] });
    // Authored prior city/person, finite purchased stocks and original natural
    // source are inputs. Never inject an agreement, camp or completion outcome.
    let s = d.exportSurveyExpeditionTestState();
    const b = s.sovereignBargains, F = window.HelixFoundingExpedition;
    const source = { ...b.source, populationSourceId: 'population:a', population: 100, defenseId: Array.from({ length: 1000 }, (_, n) => `original-defense-${n}`)
      .find(id => F.willing(`${id}:ward-defender`) && (!works || window.HelixFoundingWorks.willing(`${id}:ward-defender`))
        && [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 5 !== 0) };
    const office = d.sovereignBargainSnapshot().office;
    s.sovereignBargains = window.HelixSovereignBargains.create(source, office); s.sovereignBargains.testFixture = true;
    s.scientist.skills.materialsScience = { ...(s.scientist.skills.materialsScience || {}), xp: 100000 };
    if (works && s.scientist.skills.materialsScience.embodiment) s.scientist.skills.materialsScience.embodiment.xp = 100000;
    s.scientist.skills.analysis = { ...(s.scientist.skills.analysis || {}), xp: 100000 };
    // Legacy fixture has a personally granted sampling visit, not an inferred
    // founding or immigration permission.
    s.surveyExpeditions.discovery.access.active = true;
    d.importSurveyExpeditionTestState(s);
    const stone = d.surfaceStoneSnapshot().site, discovery = d.boundaryDiscoverySnapshot().discovery.baseline;
    const keys = new Set(discovery.cells.map(c => `${c.x},${c.y},${c.z}`)), rocks = new Set(discovery.rocks.map(c => `${c.x},${c.y},${c.z}`));
    const candidate = stone.nodes.filter(n => n.remaining > 0).flatMap(node => discovery.cells.filter(c => c.x > 23 && c.x < 33 && c.y > 8 && c.y < 20
      && Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) <= 7
      && [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]].every(([x,y]) => keys.has(`${c.x+x},${c.y+y},${c.z}`) && !rocks.has(`${c.x+x},${c.y+y},${c.z}`))
      && (!works || window.HelixFoundingWorks.layout(c).parts.every(p => (p.kind === 'roof'
        || keys.has(`${p.cell.x},${p.cell.y},${p.cell.z}`) && !rocks.has(`${p.cell.x},${p.cell.y},${p.cell.z}`))
        && keys.has(`${p.work.x},${p.work.y},${p.work.z}`) && !rocks.has(`${p.work.x},${p.work.y},${p.work.z}`))))
      .map(origin => ({ node, origin })))[0];
    const node = candidate?.node, origin = candidate?.origin;
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
  }, { renderer, works });
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
module.exports = { snap, detail, act, tick, finish, walk, setup };
