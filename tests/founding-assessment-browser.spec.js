const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { walk, tick } = require('./helpers/founding-expedition');
const { reload } = require('./helpers/field-station');
test.setTimeout(900000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foundingWorksSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foundingWorksAction(action, options), { action, options });
// Authored prior project inputs, not outcomes of the assessment under test.
// The existing founding-works scenarios separately earn camp/migration/works.
async function priorWorksite(page, renderer) {
  await startLifecycleRun(page, `foundation-assessment-${renderer}`);
  return page.evaluate(renderer => {
    const d = window.helixHeresyDebug, W = window.HelixFoundingWorks, F = window.HelixFoundingExpedition;
    d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: 'original-assessment-site', strategicCellId: 'planet-cell:00009', seed: 'founding-boundary', publicProspects: {},
      truth: { potentialPermille: { constructionStone: 1000, freshWater: 1000, biologicalProductivity: 1000 }, surfaceAccessibilityPermille: 1000 } };
    d.setSurveyExpeditionTestContext({ context, network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Original lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] } });
    d.configureScientistIdentityTest({ office: true, money: 5000 }); d.configureSovereignBargainTest();
    const origin = { x: 26, y: 12, z: 6 }, work = { ...origin, y: 13 };
    d.configureWildernessTest({ destination: { id: context.siteId, strategicCellId: 'planet-cell:00002', label: 'Original project', temperatureC: 18, precipitationMm: 100, slopePercent: 5 } });
    d.configureWildernessBeastsTest({ actors: [], scientistCell: work });
    d.configureHiddenWorkshopTest({ carryTools: ['masonryHammer'] });
    const kits = Array.from({ length: 6 }, () => d.configureHiddenWorkshopTest({ cell: work, supplies: { fieldShelter: 1 } })[0]);
    const s = d.exportSurveyExpeditionTestState(), binding = d.foundingExpeditionSnapshot().saved, b = s.sovereignBargains;
    b.source.populationSourceId = 'original-population'; b.source.population = 100;
    window.HelixDefenderChallenges.prepareDefender(b);
    const sourceKey = JSON.stringify([b.officeId, b.source.cityId, b.source.charterId, b.source.authority.id, b.source.administrationId, b.source.defenseId, b.source.populationSourceId]);
    const f = F.create(binding), cell = (x, y) => ({ x, y, z: 6 });
    f.plan = { worldId: binding.worldId, siteId: context.siteId, roomId: 'wildernessSurveySector', origin, work, post: cell(27,13),
      beds: [cell(26,14), cell(27,14)], home: { roomId: 'supportedSurveyGround', cell: cell(19,9) }, sourceKey,
      route: [cell(19,9),cell(19,10),cell(19,11),cell(19,12),cell(20,12),cell(21,12),cell(22,12),cell(23,12),cell(23,13),cell(24,13),cell(25,13),cell(26,13),cell(27,13)], observationIds: [] };
    f.camp = { crateId: 'original-project-crate', kitIds: kits.slice(0,2) }; f.demonstratedAt = s.clock; f.phase = 'returned'; f.lastAt = s.clock;
    s.fixtures.push({ id: f.camp.crateId, typeId: 'storageCrate', name: 'Original project crate', origin, condition: 100, operationalState: 'operational', accessState: 'open', installedAt: s.clock });
    const w = W.create(binding, f, { cityId: b.source.cityId, populationSourceId: b.source.populationSourceId, population: 100, sourceKey });
    w.layout = W.layout(origin); w.supportPath = f.plan.route; w.supportInspectedAt = s.clock;
    w.investigations = { stone: { at: s.clock, estimatedStoneTonnes: 9000 }, water: { at: s.clock, testLitresPerDay: 9000 }, ground: { at: s.clock, testedSquareMetres: 80, cultivableSquareMetres: 60 } };
    // Original, already-paid engagements. Never inject a new assessment,
    // decision, physical return, failure conclusion or settlement outcome.
    w.agreement = { actorId: b.defender.id, acceptedAt: s.clock, endsAt: s.clock + W.TERM, fee: 1200, wageEscrow: 192, bodyEpoch: s.scientistIdentity.bodyEpoch };
    s.economy.money -= 1392; b.defender.money = 1200; b.defender.assignment = w.id;
    b.defender.roomId = f.plan.roomId; b.defender.mapCell = f.plan.post;
    const homes = [cell(14,10),cell(16,10),cell(14,12),cell(16,12)];
    if (homes.some(c => !s.labMap.rooms.supportedSurveyGround.cells.some(v => JSON.stringify(c) === JSON.stringify(v)))) throw Error('Invalid authored original receiving points');
    w.people = homes.map((home, n) => ({ phase: 'resident', willing: true, duty: W.DUTY - 170, earned: 170 * W.WAGE, settled: false, kitId: kits[n+2], deployProgress: 120,
      actor: { id: `original-population:founding-resident:${n}`, name: `Original Resident ${n}`, actorKind: 'surfaceWorker', roomId: f.plan.roomId,
        mapCell: w.layout.beds[n], home, status: 'alive', health: 100, maxHealth: 100, stamina: 100, needs: { lastAt: s.clock, hunger: 0, thirst: 0, exertion: 0, exposure: 0 }, money: 170 * W.WAGE } }));
    w.ledger = { allocated: 4, departed: w.people.map(p => p.actor.id), returned: [], deaths: [] }; w.phase = 'works'; w.lastAt = s.clock;
    kits.forEach((id, n) => { const i = s.physicalItemStacks.find(i => i.id === id); Object.assign(i, { cell: n < 2 ? f.plan.beds[n] : w.layout.beds[n-2], roomId: f.plan.roomId, reservedTaskId: n < 2 ? f.id : w.id, carriedBy: '' }); });
    const part = w.layout.parts.find(p => p.id === 'perimeter:1:-2'), hammer = s.physicalItemStacks.find(i => i.key === 'masonryHammer' && i.carriedBy === 'scientist');
    w.parts[part.id] = { startedAt: s.clock, physicalId: `${part.cell.x},${part.cell.y},${part.cell.z}`, progress: 50, completeAt: null };
    s.labMap.terrain.constructedWalls.push({ cell: part.cell, materialId: 'stoneBlocks', materialComposition: { primary: 'stone', reinforcement: 'steel' }, condition: 1 + 99 * 50/3600, builtAt: s.clock });
    w.job = { kind: 'construction', partId: part.id, progress: 50, seconds: 3600, lastAt: s.clock, attended: false, running: false,
      claims: { toolId: hammer.toolInstanceId, stackId: hammer.id, cell: part.work }, bodyEpoch: s.scientistIdentity.bodyEpoch, wear: 0 };
    const inspected = [...f.plan.route, ...s.labMap.rooms.supportedSurveyGround.cells,
      ...s.labMap.rooms.wildernessSurveySector.cells.filter(c => c.x >= 23 && c.x <= 31 && c.y >= 9 && c.y <= 17)];
    for (const c of inspected) s.mapCellObservations[`${c.x},${c.y},${c.z}`] = { cell: c, source: 'Prior local worksite/receiving-ground inspection', observedAt: s.clock };
    s.surveyExpeditions.discovery.access.active = true;
    s.foundingExpedition = f; s.foundingWorks = w; s.paused = true;
    d.importSurveyExpeditionTestState(s);
    return { work, origin, homes, partId: part.id, ids: w.people.map(p => p.actor.id), kitIds: kits.slice(2) };
  }, renderer);
}
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus && !page.isClosed())
  await info.attach('founding-assessment', { body: JSON.stringify(await snap(page)), contentType: 'application/json' }); });
for (const renderer of ['canvas', 'dom']) test(`${renderer}: dated founding assessment, defer, original withdrawal and failed-project recovery`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const f = await priorWorksite(page, renderer); await page.locator('[data-workspace-tab="visits"]').click();
  let s = await snap(page); expect(s.saved.foundation.report).toBeNull(); expect(s.context.atCamp).toBe(true); expect(s.context.campIntact).toBe(true);
  const original = { money: s.money, parts: s.saved.parts, agreement: s.saved.agreement, kits: f.kitIds };
  await page.getByRole('button', { name: 'Assess this founding attempt here', exact: true }).click();
  await tick(page, 25, { render: false }); s = await snap(page); expect(s.saved.foundation.job.progress).toBeGreaterThan(20);
  const progress = s.saved.foundation.job.progress; expect(s.saved.job.progress).toBe(50);
  expect(await act(page, 'pauseFoundation')).toBe(true); await tick(page, 10, { render: false });
  await reload(page, renderer); expect((await snap(page)).saved.foundation.job.progress).toBe(progress);
  expect(await act(page, 'resumeFoundation')).toBe(true); await tick(page, 45, { render: false });
  s = await snap(page); const report = s.saved.foundation.report;
  expect(s.saved.foundation.job).toBeNull(); expect(report.verdict).toBe('notViable'); expect(report.findings).toHaveLength(8);
  expect(s.saved.job.progress).toBe(50); expect(s.money).toBe(original.money); expect(s.saved.agreement).toEqual(original.agreement);
  expect(await act(page, 'deferFoundation', { expected: { ...report, at: -1 } })).toBe(false);
  await page.getByRole('button', { name: 'Defer city founding without renewing commitments', exact: true }).click();
  s = await snap(page); expect(s.saved.phase).toBe('works'); expect(s.saved.foundation.decision.kind).toBe('defer');
  expect(s.saved.agreement).toEqual(original.agreement); expect(s.saved.people.map(p => p.actor.id)).toEqual(f.ids);
  if (renderer === 'dom') {
    // Explicit unseen original-person fatality, not a manufactured return.
    await page.evaluate(() => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
      Object.assign(state.foundingWorks.people[0].actor, { status: 'dead', health: 0 }); d.importSurveyExpeditionTestState(state); });
    await tick(page, 1, { render: false }); expect((await snap(page)).saved.foundation.report).toEqual(report);
  }
  s = await snap(page);
  if (s.saved.phase !== 'returning' && !s.context.withdrawContact) {
    expect(await act(page, 'abandonFoundation', { expected: report })).toBe(false);
    await walk(page, s.protector.mapCell);
    expect((await snap(page)).context.withdrawContact).toBe(true);
  }
  await page.getByRole('button', { name: 'Abandon this founding attempt and request physical withdrawal', exact: true }).click();
  s = await snap(page); expect(s.saved.foundation.decision.kind, JSON.stringify({ context: s.context, protector: s.protector, notice: s.saved.notice, report: s.saved.foundation.report })).toBe('abandon'); expect(s.saved.phase).toBe('returning');
  expect(s.saved.ledger.returned).toHaveLength(0); expect(s.saved.parts).toEqual(original.parts);
  expect(await act(page, 'resume')).toBe(false); expect(await act(page, 'deferFoundation', { expected: report })).toBe(false);
  await reload(page, renderer); expect((await snap(page)).saved.foundation.decision.kind).toBe('abandon');
  for (let n = 0; n < 100 && (await snap(page)).saved.phase === 'returning'; n++) await tick(page, 5, { render: false });
  s = await snap(page); expect(s.saved.phase, JSON.stringify(s.saved.people)).toBe('abandoned');
  expect(s.saved.ledger.returned).toHaveLength(renderer === 'dom' ? 3 : 4); expect(s.protector.assignment).toBeNull();
  expect(s.saved.foundation.report).toEqual(report); expect(s.saved.parts).toEqual(original.parts);
  await walk(page, { x: 17, y: 8, z: 6 }); expect(await act(page, 'settle')).toBe(true); const settled = (await snap(page)).money;
  expect(await act(page, 'settle')).toBe(false); expect((await snap(page)).money).toBe(settled);
  await walk(page, s.saved.layout.beds[1]); expect(await act(page, 'releaseProperty')).toBe(true);
  expect((await snap(page)).items.find(i => i.id === f.kitIds[1]).reservedTaskId).toBe('');
  const state = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(state.runEnded).toBeFalsy(); expect(state.foundingWorks.city).toBeUndefined(); expect(state.regionalOperations?.nodes.some(n => n.sourceId === state.foundingWorks.id) || false).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
