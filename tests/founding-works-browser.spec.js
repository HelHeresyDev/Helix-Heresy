const { test, expect } = require('@playwright/test');
const { setup, snap: camp, act: campAct, walk, tick, finish } = require('./helpers/founding-expedition');
const { reload } = require('./helpers/field-station');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
// A normal run also earns the original advance camp; allow that prerequisite
// without weakening any physical work, movement or finite-duty assertions.
test.setTimeout(process.env.HELIX_FOUNDING_FULL_COMPOUND === '1' ? 5400000 : 2100000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foundingWorksSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foundingWorksAction(action, options), { action, options });
const detail = s => JSON.stringify({ context: { ...s.context, observedParts: undefined }, saved: { ...s.saved, layout: undefined, plan: undefined, report: undefined }, protector: s.protector, cell: s.cell });
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus && !page.isClosed()) {
  const s = await snap(page);
  const routes = await page.evaluate(ids => ids.map(id => window.helixHeresyDebug.foundingWorksRouteReview(id)), s.saved?.people.map(p => p.actor.id) || []);
  console.info(`Founding route diagnostic: ${JSON.stringify(routes)}`);
  await info.attach('original-founding-works', { body: JSON.stringify({ ...s, routes }), contentType: 'application/json' });
} });
async function earnCamp(page, renderer) {
  // Optional local diagnostic checkpoint contains only an actually earned
  // prerequisite camp, never this pass's assessments, migrants or works.
  const checkpoint = process.env.HELIX_FOUNDING_CAMP_CHECKPOINT === '1' ? `/tmp/helix-founding-earned-${renderer}.json` : null;
  if (checkpoint && fs.existsSync(checkpoint)) {
    const saved = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
    await page.evaluate(entries => { localStorage.clear(); for (const [k, v] of entries) localStorage.setItem(k, v); }, saved.storage);
    await page.reload(); await page.locator('#loadLastSaveBtn').click();
    await page.evaluate(r => window.helixHeresyDebug.setMapRenderer(r), renderer);
    await page.locator('[data-workspace-tab="visits"]').click();
    const s = await snap(page); expect(s.saved.agreement).toBeNull(); expect(s.saved.job).toBeNull(); expect(s.saved.people).toHaveLength(0);
    return saved.fixture;
  }
  const f = await setup(page, renderer, true);
  expect(await campAct(page, 'accept', { expected: (await camp(page)).saved.quote })).toBe(true);
  await walk(page, f.work); for (let n = 0; n < 30 && (await camp(page)).saved.phase !== 'camp'; n++) await tick(page, 5, { render: false });
  expect((await camp(page)).saved.phase).toBe('camp');
  expect(await campAct(page, 'build')).toBe(true); await tick(page, 665, { render: false });
  expect((await camp(page)).saved.camp).toBeTruthy();
  expect(await campAct(page, 'meal')).toBe(true); await tick(page, 625, { render: false });
  expect((await camp(page)).saved.demonstratedAt).not.toBeNull();
  expect(await campAct(page, 'withdraw')).toBe(true);
  for (let n = 0; n < 40 && (await camp(page)).saved.phase !== 'returned'; n++) await tick(page, 5, { render: false });
  expect((await camp(page)).saved.phase).toBe('returned');
  console.info(`${renderer}: original earned camp and physical guardian return`);
  if (checkpoint) fs.writeFileSync(checkpoint, JSON.stringify({ fixture: f, storage: await page.evaluate(() => Object.entries(localStorage)) }));
  return f;
}
async function suppliedForemanRecovery(page, part) {
  let s = await snap(page);
  const drinking = s.survival.thirst >= 30, eating = s.survival.hunger >= 35;
  const resting = s.survival.exertion >= 50 || s.vitals.stamina.current < 40;
  if (!drinking && !eating && !resting) return;
  const paused = Boolean(s.saved.job?.running);
  if (paused) expect(await act(page, 'pause')).toBe(true);
  await walk(page, s.saved.plan.beds[0]);
  for (const [key, needed] of [['drinkingWater', drinking], ['trailMeal', eating]]) if (needed) {
    expect(await page.evaluate(key => Boolean(window.helixHeresyDebug.queueSurvivalConsumption(key)), key)).toBe(true); await finish(page);
  }
  if (resting) {
    await page.evaluate(() => { document.getElementById('restMinutesInput').value = '45'; document.getElementById('restCustomBtn').click(); });
    await finish(page);
  }
  await walk(page, part.work);
  if (paused) expect(await act(page, 'resume'), detail(await snap(page))).toBe(true);
}
async function completeOriginalCompound(page) {
  const full = process.env.HELIX_FOUNDING_FULL_COMPOUND === '1';
  const before = await snap(page), ids = before.saved.people.map(p => p.actor.id);
  // Finite separately authored prior provisions delivery, picked up at each
  // actual body's position with ordinary capacity checks. No needs/duty reset.
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foundingWorksSnapshot();
    const scientist = { id: 'scientist', mapCell: s.cell };
    for (const a of [scientist, s.protector, ...s.saved.people.map(p => p.actor)])
      for (const id of d.configureHiddenWorkshopTest({ cell: a.mapCell, supplies: { drinkingWater: 8, trailMeal: 3 } })) {
        const item = d.exportSurveyExpeditionTestState().physicalItemStacks.find(i => i.id === id);
        if (!d.carryActorStack(a.id, id, item.quantity)) return false;
      }
    return true;
  })).toBe(true);
  for (const p of before.saved.layout.parts) {
    if ((await snap(page)).saved.parts[p.id]?.completeAt != null) continue;
    // Routine browser coverage exercises each distinct physical consumer and
    // the awkward exterior corner/gate geometry. The pure model covers every
    // component; an explicit soak option additionally builds the full circuit.
    if (!full && !['perimeter:-2:-2', 'perimeter:-2:1', 'bed-floor:0', 'bed-roof:0', 'supply-store'].includes(p.id)) continue;
    await suppliedForemanRecovery(page, p); await walk(page, p.work);
    await page.evaluate(({ cell, supplies }) => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell, supplies }), { cell: p.work, supplies: p.costs });
    expect(await act(page, 'build', { partId: p.id }), `${p.id}: ${detail(await snap(page))}`).toBe(true);
    for (let n = 0; n < 45 && (await snap(page)).saved.job; n++) {
      await suppliedForemanRecovery(page, p); await tick(page, 120, { render: false });
    }
    const s = await snap(page);
    expect(s.saved.job, `${p.id}: ${detail(s)}`).toBeNull(); expect(s.saved.parts[p.id].completeAt).not.toBeNull();
    expect(s.saved.people.map(p => p.actor.id)).toEqual(ids);
    if (p.kind === 'roof') expect(await page.evaluate(cell => window.helixHeresyDebug.exportSurveyExpeditionTestState().labMap.terrain.constructedFloors
      .find(f => f.cell.x === cell.x && f.cell.y === cell.y && f.cell.z === cell.z)?.purpose, p.cell)).toBe('roof');
    console.info(`canvas: actual ${p.id} completed with original paid residents`);
  }
  await walk(page, before.saved.plan.work);
  if (!full) { expect(await act(page, 'milestone')).toBe(false); return; }
  expect(await act(page, 'milestone'), detail(await snap(page))).toBe(true);
  const done = await snap(page); expect(done.saved.milestoneAt).not.toBeNull(); expect(done.saved.city).toBeUndefined();
  expect(done.saved.people.every(p => p.duty >= 0 && p.earned <= 48)).toBe(true);
  expect(await act(page, 'report')).toBe(true);
  await reload(page, 'canvas'); expect((await snap(page)).saved.milestoneAt).toBe(done.saved.milestoneAt);
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: original founding assessments, migrant departure, partial physical works, reload and consequential return`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const f = await earnCamp(page, renderer);
  let s = await snap(page); expect(s.saved.people).toHaveLength(0); expect(s.saved.agreement).toBeNull();
  expect(await act(page, 'review')).toBe(false);
  // The earlier diagnostic physically returned its tool to the field entry.
  // Retrieve that same original instrument rather than assuming it stayed in hand.
  const instrument = s.items.find(i => i.key === 'environmentalSurveyKit' && i.quantity > 0);
  expect(instrument).toBeTruthy();
  if (instrument.carriedBy !== 'scientist') {
    expect(await act(page, 'investigate', { kind: 'stone' })).toBe(false);
    await walk(page, instrument.cell);
    await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ carry: ['environmentalSurveyKit'] }));
    await walk(page, f.work);
  }
  // Finite prior purchased test feedstock, not a foundation result. Real carried
  // tools/calibration/skills are separately checked by the attended consumer.
  await page.evaluate(cell => { const d = window.helixHeresyDebug;
    d.configureHiddenWorkshopTest({ cell, supplies: { preparedManaCrystals: 3, assayReagent: 3 } });
    d.setInstrumentCalibration('environmentalSurveyKit', 20); }, f.work);
  expect(await act(page, 'investigate', { kind: 'stone' })).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setInstrumentCalibration('environmentalSurveyKit', 85));
  await page.getByRole('button', { name: 'Investigate founding stone here', exact: true }).click();
  s = await snap(page); expect(s.saved.job?.kind, detail(s)).toBe('investigation');
  console.info(`${renderer}: physically retrieved original kit; attended investigation started`);
  const toolId = s.saved.job.claims.toolId;
  await tick(page, 905, { render: false }); s = await snap(page);
  expect(s.saved.job.progress).toBeGreaterThanOrEqual(900); const partial = s.saved.job.progress;
  await page.getByRole('button', { name: 'Pause founding works and release tool', exact: true }).click();
  await tick(page, 60, { render: false }); expect((await snap(page)).saved.job.progress).toBe(partial);
  await reload(page, renderer); s = await snap(page); expect(s.saved.job.progress).toBe(partial); expect(s.saved.job.claims.toolId).toBe(toolId);
  await page.getByRole('button', { name: 'Resume same original founding work', exact: true }).click();
  await tick(page, 905, { render: false }); s = await snap(page); expect(s.saved.job).toBeNull(); expect(s.saved.investigations.stone.estimatedStoneTonnes).toBeGreaterThan(6000);
  for (const kind of ['water', 'ground']) { expect(await act(page, 'investigate', { kind }), detail(await snap(page))).toBe(true);
    await tick(page, kind === 'water' ? 1805 : 905, { render: false }); expect((await snap(page)).saved.job).toBeNull(); }
  console.info(`${renderer}: three actual attended assessments completed`);
  expect(await act(page, 'layout'), detail(await snap(page))).toBe(true);
  expect(await act(page, 'report')).toBe(true); s = await snap(page);
  expect(s.saved.report.investigations.ground.testedSquareMetres).toBeLessThan(250); // Not invented farmland hectares.
  const measured = s.saved.report;
  await walk(page, { x: 17, y: 8, z: 6 });
  expect(await act(page, 'review'), detail(await snap(page))).toBe(true); s = await snap(page);
  expect(await act(page, 'accept', { expected: { ...s.saved.quote, fee: 0 } })).toBe(false);
  const wallet = s.money, protector = s.protector;
  await page.getByRole('button', { name: 'Accept exactly this founding works agreement', exact: true }).click();
  s = await snap(page); expect(s.saved.people).toHaveLength(4); expect(s.saved.ledger.departed).toHaveLength(0);
  expect(s.money).toBe(wallet - 1392); expect(s.protector.id).toBe(protector.id); expect(s.protector.health).toBe(protector.health);
  expect(s.protector.wardMana).toBe(protector.wardMana); expect(s.protector.assignment).toBe(s.saved.id);
  expect(await act(page, 'depart')).toBe(false); // No free kits or provisions.
  // Separately authored finite prior purchases at each actual resident's muster
  // position. Every pickup uses the original person's ordinary carrying limit.
  expect(await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.foundingWorksSnapshot();
    for (const actor of [s.protector, ...s.saved.people.map(p => p.actor)]) {
      const keys = actor.id === s.protector.id ? { drinkingWater: 2, trailMeal: 1 } : { fieldShelter: 1, drinkingWater: 2, trailMeal: 1 };
      for (const id of d.configureHiddenWorkshopTest({ cell: actor.mapCell, supplies: keys })) {
        const i = d.exportSurveyExpeditionTestState().physicalItemStacks.find(i => i.id === id);
        if (!d.carryActorStack(actor.id, id, i.quantity)) return false;
      }
    }
    return true;
  })).toBe(true);
  await page.getByRole('button', { name: 'Depart with original supplied founding party', exact: true }).click();
  s = await snap(page); expect(s.saved.phase, detail(s)).toBe('outward'); expect(s.saved.ledger.departed).toHaveLength(4);
  expect(s.context.availablePopulation).toBe(96);
  const originalIds = s.saved.people.map(p => p.actor.id), originalKitIds = s.saved.people.map(p => p.kitId);
  await walk(page, f.work);
  for (let n = 0; n < 70 && (await snap(page)).saved.phase === 'outward'; n++) await tick(page, 5, { render: false });
  s = await snap(page); expect(s.saved.phase, detail(s)).toBe('works');
  expect(s.saved.people.every(p => p.phase === 'resident' && p.duty < 28800)).toBe(true);
  expect(s.saved.people.map(p => p.actor.id)).toEqual(originalIds);
  expect(s.items.filter(i => originalKitIds.includes(i.id)).every(i => !i.carriedBy && i.reservedTaskId === s.saved.id)).toBe(true);
  console.info(`${renderer}: four original residents actually walked and deployed original shelters`);
  const part = s.saved.layout.parts.find(p => p.kind === 'wall' && p.cell.x > f.origin.x && p.cell.y === f.origin.y - 2);
  await walk(page, part.work);
  expect(await act(page, 'build', { partId: part.id })).toBe(false); // No remote draw from home stocks.
  // Original purchased construction inputs staged at the actual work position;
  // enormous whole-city walls are not awarded by this one completed component.
  await page.evaluate(({ cell, costs }) => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell, supplies: costs }), { cell: part.work, costs: part.costs });
  expect(await act(page, 'build', { partId: part.id }), detail(await snap(page))).toBe(true);
  await tick(page, 300, { render: false }); s = await snap(page);
  expect(s.saved.job.progress, detail(s)).toBeGreaterThan(100); expect(s.saved.job.progress).toBeLessThan(part.seconds);
  expect(s.saved.parts[part.id].physicalId).toBeTruthy(); const progress = s.saved.job.progress;
  const wall = await page.evaluate(cell => window.helixHeresyDebug.exportSurveyExpeditionTestState().labMap.terrain.constructedWalls.find(p => JSON.stringify(p.cell) === JSON.stringify(cell)), part.cell);
  expect(wall.condition).toBeGreaterThan(1); expect(wall.condition).toBeLessThan(100);
  expect(wall.materialComposition).toEqual({ primary: 'stone', reinforcement: 'steel' });
  // Explicit external obstruction fault: the retained support path must be
  // currently walkable, not merely a floor underneath a newly built wall.
  const supportedPartial = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), w = s.foundingWorks;
    const occupied = [s.scientist.mapCell, s.sovereignBargains.defender.mapCell, ...w.people.map(p => p.actor.mapCell)].map(c => JSON.stringify(c));
    const cell = w.supportPath.find(c => !occupied.includes(JSON.stringify(c)) && c.x > 20 && c.x < w.plan.origin.x - 2);
    if (!cell) throw new Error('No unoccupied original support-path fault position');
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s);
  });
  expect((await snap(page)).context.routeOpen).toBe(false);
  await tick(page, 10, { render: false }); expect((await snap(page)).saved.job.progress).toBe(progress);
  await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(saved), supportedPartial);
  expect(await act(page, 'pause')).toBe(true); await tick(page, 30, { render: false });
  await reload(page, renderer); s = await snap(page); expect(s.saved.job.progress).toBe(progress); expect(s.saved.people.map(p => p.actor.id)).toEqual(originalIds);
  expect(s.saved.report).toEqual(measured); // No automatic live private update.
  expect(await act(page, 'resume')).toBe(true); await tick(page, 1000, { render: false }); s = await snap(page);
  expect(s.saved.job, detail(s)).toBeNull(); expect(s.saved.parts[part.id].completeAt).not.toBeNull();
  expect(await act(page, 'milestone')).toBe(false); expect(s.saved.milestoneAt).toBeNull(); expect(s.saved.city).toBeUndefined();
  expect(await act(page, 'report')).toBe(true); const beforeLoss = (await snap(page)).saved.report;
  await walk(page, f.work);
  const earned = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  if (renderer === 'canvas') {
    await completeOriginalCompound(page);
    // Separate consequential-failure branch from the actual earlier partial
    // project, not a rollback of the played successful construction episode.
    await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(saved), earned);
  }
  // Branch the actually earned project for a real shared-combat ward check.
  // This is one explicit pre-existing beast input, not an encounter generated
  // by founding or a direct call to the projection function.
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const beast = window.HelixWildernessBeasts.actor('beast:rimefang-pack', 'original-founding-ward-contact', cell, 'original-boundary-population', s.clock);
    beast.roomId = s.foundingWorks.plan.roomId; s.wildernessBeasts.actors = [beast]; d.importSurveyExpeditionTestState(s);
  }, { ...f.work, x: f.work.x - 1 });
  const beforeWard = (await snap(page)).protector.wardMana;
  const hit = await page.evaluate(() => window.helixHeresyDebug.cityDefenseTestStrike('original-founding-ward-contact', { kind: 'creature', id: 'scientist' }, { baseDamage: 10, damageTypes: ['physical'], sequence: 1 }));
  expect(hit.ok).toBe(true); expect(hit.hit).toBe(true);
  expect((await snap(page)).protector.wardMana).toBeCloseTo(beforeWard - 12, 8);
  await page.evaluate(saved => window.helixHeresyDebug.importSurveyExpeditionTestState(saved), earned);
  // Original-person injury/fatality fault, not a replacement or fake returned result.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.foundingWorks.people[0].actor.health = 0; s.foundingWorks.people[0].actor.status = 'dead'; d.importSurveyExpeditionTestState(s); });
  await tick(page, 1, { render: false }); s = await snap(page); expect(s.saved.phase).toBe('returning'); expect(s.saved.ledger.deaths).toEqual([originalIds[0]]);
  expect(s.saved.report).toEqual(beforeLoss); expect(s.saved.parts[part.id].completeAt).toBe(earned.foundingWorks.parts[part.id].completeAt);
  // Move the scientist off the physical return path; there is no party teleport.
  await walk(page, { ...f.work, x: f.work.x + 1, y: f.work.y + 1 });
  for (let n = 0; n < 60 && (await snap(page)).saved.phase === 'returning'; n++) await tick(page, 5, { render: false });
  s = await snap(page); expect(s.saved.phase, detail(s)).toBe('abandoned'); expect(s.saved.people).toHaveLength(4);
  expect(s.saved.ledger.returned).toHaveLength(3); expect(s.protector.assignment).toBeNull(); expect(s.saved.people[0].actor.status).toBe('dead');
  expect(s.context.availablePopulation).toBe(99);
  const beforeSettlement = s.money;
  expect(await act(page, 'settle')).toBe(false); await walk(page, { x: 17, y: 8, z: 6 });
  expect(await act(page, 'settle'), detail(await snap(page))).toBe(true); s = await snap(page); expect(s.money).toBeGreaterThan(beforeSettlement);
  expect(await act(page, 'settle')).toBe(false); expect((await snap(page)).money).toBe(s.money);
  expect(await act(page, 'releaseProperty')).toBe(false);
  const kit = s.items.find(i => i.id === originalKitIds[1]);
  await walk(page, kit.cell);
  expect(await act(page, 'releaseProperty'), detail(await snap(page))).toBe(true);
  s = await snap(page); expect(s.items.find(i => i.id === kit.id).reservedTaskId).toBe('');
  expect(s.money).toBeCloseTo(beforeSettlement + s.saved.people.filter(p => p.phase === 'returned').reduce((n, p) => n + 48 - p.earned, 0), 8);
  expect((await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState())).runEnded).toBeFalsy();
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
});
