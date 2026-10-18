const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Beasts = require('../wilderness-beasts');
const Graph = require('../local-patch-graph');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
const atlas = page => page.evaluate(() => window.helixHeresyDebug.expansionAtlasSnapshot());
const act = (page, action, direction) => page.evaluate(({ action, direction }) => window.helixHeresyDebug.foreignSurveyAction(action, { direction }), { action, direction });
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(seconds), seconds);
async function finish(page) {
  for (let i = 0; i < 40; i++) {
    const s = await snap(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe('');
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Physical local-patch work did not finish');
}
async function visits(page) {
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function move(page, cell) {
  const s = await snap(page);
  if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true, urgent: true })), { room: s.site.roomId, cell })).toBe(true);
  await finish(page);
}
async function cross(page, direction) {
  const before = await snap(page), node = Graph.nodeAt(before.site.patchGraph, before.cell), next = Graph.plan(before.site.patchGraph, node.id, direction);
  if (JSON.stringify(before.cell) !== JSON.stringify(next.seam)) {
    expect(await act(page, 'walkLocalEdge', direction)).toBe(true); await finish(page);
  }
  const s = await snap(page), from = Graph.nodeAt(s.site.patchGraph, s.cell), l = Graph.plan(s.site.patchGraph, from.id, direction);
  expect(s.cell).toEqual(l.seam); expect(await act(page, 'crossLocalConnection', direction)).toBe(true); await finish(page);
  expect((await snap(page)).cell).toEqual(l.entry); return l.toId;
}
async function setup(page, renderer, tools = false) {
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `patch-loop-${renderer}`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b', cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const initial = await page.evaluate(({ source, carrier, renderer, tools }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'local-loop',
      truth: { potentialPermille: { constructionStone: 1000, timberFiber: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000, privateMarker: 'SECRET_GEOLOGY' } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: { origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) throw new Error('Explicit original physical fixture unavailable');
    if (!d.fieldStationAction('register')) throw new Error('Actual original station inspection unavailable');
    const property = d.configureHiddenWorkshopTest({ carryTools: tools ? ['masonryHammer', 'stoneChisel'] : [], supplies: { lumber: 1 } })[0];
    if (tools) { const s = d.exportSurveyExpeditionTestState(); s.scientist.skills.materialsScience = { ...(s.scientist.skills.materialsScience || {}), xp: 100000 }; d.importSurveyExpeditionTestState(s); }
    return { property, station: d.fieldStationSnapshot().saved.site, stone: d.surfaceStoneSnapshot().site, timber: d.fallenTimberSnapshot().site,
      world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), money: d.foreignSurveySnapshot().money };
  }, { source, carrier, renderer, tools });
  await visits(page); return { ...initial, errors };
}
test('Canvas branching loop preserves one site reached by both paths, finite recovery, physical edits/property and saved interrupted crossings through departure/revisit', async ({ page }) => {
  const f = await setup(page, 'canvas', true), root = (await snap(page)).site;
  expect(root.patchGraph.nodes).toHaveLength(4); expect(root.localPatches).toBeUndefined();
  expect((await atlas(page)).entries.some(e => e.kind === 'adjoining')).toBe(false);
  expect(await act(page, 'crossLocalConnection', 'south')).toBe(false);
  await page.getByRole('button', { name: 'Walk to south local edge', exact: true }).click(); await finish(page);
  const edge = await snap(page), l = Graph.plan(edge.site.patchGraph, root.context.siteId, 'south');
  expect(edge.cell).toEqual(l.seam); expect(edge.site.patchGraph.records.some(r => r.kind === 'edge' && r.toId === l.toId)).toBe(true);
  expect((await atlas(page)).entries.some(e => e.id === l.toId)).toBe(false);
  await page.getByRole('button', { name: 'Cross south local connection', exact: true }).click();
  let s = await snap(page); expect(s.tasks).toHaveLength(1); expect(s.site.localPatches[l.toId].discovery).toBeNull(); expect(s.cell).toEqual(l.seam);
  await advance(page, 0.25); const task = (await snap(page)).tasks[0];
  await reload(page); expect((await snap(page)).tasks[0].data.movement).toEqual(task.data.movement);
  await finish(page); s = await snap(page); const south = s.site.localPatches[l.toId];
  expect(south.materialized).toBe(true); expect(south.context.strategicCellId).toBe(root.context.strategicCellId);
  expect((await atlas(page)).entries.find(e => e.id === l.toId).facts.some(r => r.category === 'route')).toBe(true);
  const node = await page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot().site.nodes[0]); expect(node).toBeTruthy();
  const work = south.discovery.baseline.cells.find(c => Math.abs(c.x - node.cell.x) + Math.abs(c.y - node.cell.y) === 1);
  await move(page, work);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('inspect', id), node.id)).toBe(true); await finish(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.startSurfaceStoneWork('recover', id), node.id)).toBe(true);
  await advance(page, 20); await reload(page); await finish(page);
  const stone = await page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot());
  expect(stone.site.nodes.find(n => n.id === node.id).remaining).toBe(node.remaining - 1);
  const outputId = stone.site.nodes.find(n => n.id === node.id).receipts.at(-1).outputId;
  const southeastId = await cross(page, 'east'), first = (await snap(page)).site.localPatches[southeastId];
  expect(await cross(page, 'north')).toBe(`${root.context.siteId}:adjoining-east`);
  expect(await cross(page, 'west')).toBe(root.context.siteId);
  expect((await snap(page)).site.discovery.baseline).toEqual(root.discovery.baseline);
  expect(await page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot().site)).toEqual(f.stone);
  expect(await page.evaluate(() => window.helixHeresyDebug.fallenTimberSnapshot().site)).toEqual(f.timber);
  // The other branch reaches the same southeastern site, not another copy.
  await cross(page, 'east'); expect(await cross(page, 'south')).toBe(southeastId);
  expect((await snap(page)).site.localPatches[southeastId].discovery.baseline).toEqual(first.discovery.baseline);
  expect(await cross(page, 'west')).toBe(l.toId);
  expect(await page.evaluate(() => window.helixHeresyDebug.surfaceStoneSnapshot().site)).toEqual(stone.site);
  const { observedAt: firstSeen, ...originalOutput } = stone.stacks.find(i => i.id === outputId);
  const { observedAt: seenAgain, ...sameOutput } = await page.evaluate(id => window.helixHeresyDebug.surfaceStoneSnapshot().stacks.find(i => i.id === id), outputId);
  expect(sameOutput).toEqual(originalOutput); expect(seenAgain).toBeGreaterThanOrEqual(firstSeen);
  expect(Object.keys((await snap(page)).site.localPatches)).toHaveLength(2);
  await cross(page, 'north'); expect(await act(page, 'withdraw')).toBe(true); await finish(page);
  const saved = (await snap(page)).site;
  await reload(page); expect(await act(page, 'enterWilderness')).toBe(true); await finish(page);
  expect((await snap(page)).site.localPatches).toEqual(saved.localPatches);
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot().saved.site)).toEqual(f.station);
  const final = await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.foreignSurveySnapshot(); return { money: s.money,
    property: s.stacks.find(i => i.id === id), valid: d.validateMapScene(), world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world') }; }, f.property);
  expect(final.money).toBe(f.money); expect(final.property).toMatchObject({ quantity: 1, carriedBy: '' }); expect(final.valid).toEqual([]); expect(final.world).toBe(f.world);
  expect(JSON.stringify(await atlas(page))).not.toMatch(/SECRET_GEOLOGY|potentialPermille/); expect(f.errors).toEqual([]);
});
test('DOM wounded original beast pursues across two new seams; obstruction, reload and death neither reset it nor turn known routes into guaranteed access', async ({ page }) => {
  const f = await setup(page, 'dom'); await cross(page, 'east');
  expect(await act(page, 'walkLocalEdge', 'south')).toBe(true); await finish(page);
  let s = await snap(page); const l = Graph.plan(s.site.patchGraph, s.site.extension.id, 'south');
  const original = await page.evaluate(({ cell, beast }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), w = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness;
    Object.assign(beast, { roomId: w.roomId, health: 31, nextMoveAt: s.clock + 3, nextAttackAt: s.clock + 1000,
      provokedUntil: s.clock + 600, targetId: 'scientist', lastTarget: cell, rememberedUntil: s.clock + 30 });
    w.beasts = { ...window.HelixWildernessBeasts.defaultState(), materialized: true, siteId: w.destination.id, actors: [beast], lastAt: s.clock };
    d.importSurveyExpeditionTestState(s); return beast;
  }, { cell: l.seam, beast: Beasts.actor('beast:rimefang-pack', 'original-loop-beast', { ...l.seam, y: l.seam.y - 2 }, 'original-population', s.clock) });
  expect(await act(page, 'crossLocalConnection', 'south')).toBe(true); await finish(page);
  s = await snap(page); const se = s.site.localPatches[l.toId]; await move(page, se.entry); await advance(page, 8);
  let beast = (await snap(page)).site.beasts.actors[0];
  expect(beast).toMatchObject({ id: original.id, health: 31, populationId: original.populationId, nextAttackAt: original.nextAttackAt, behavior: 'pursue' });
  expect(beast.mapCell.y).toBeGreaterThanOrEqual(se.bounds.y);
  await reload(page); expect((await snap(page)).site.beasts.actors[0]).toEqual(beast);
  const southId = await cross(page, 'west'); s = await snap(page); const south = s.site.localPatches[southId];
  await move(page, { ...south.entry, x: south.entry.x + 7 }); await advance(page, 8);
  s = await snap(page); beast = s.site.beasts.actors[0]; expect(s.site.beasts.actors).toHaveLength(1);
  expect(beast).toMatchObject({ id: original.id, health: 31, nextAttackAt: original.nextAttackAt, behavior: 'pursue' });
  expect(beast.mapCell.x).toBeLessThan(se.bounds.x); expect(beast.rememberedUntil).toBeGreaterThan(s.clock);
  // A known return link can become physically obstructed. The crossing action
  // must refuse rather than clearing the wall or teleporting to the old site.
  expect(await act(page, 'walkLocalEdge', 'north')).toBe(true); await finish(page);
  s = await snap(page); const back = Graph.plan(s.site.patchGraph, southId, 'north');
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
    d.expansionAtlasAction('select', s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness.context.siteId, 'revisit');
  }, back.entry);
  const blocked = await snap(page); expect(await act(page, 'crossLocalConnection', 'north')).toBe(false);
  expect((await snap(page)).cell).toEqual(blocked.cell); expect((await snap(page)).clock).toBe(blocked.clock);
  await reload(page); expect(await act(page, 'crossLocalConnection', 'north')).toBe(false);
  expect((await snap(page)).site.beasts.actors[0].nextAttackAt).toBe(original.nextAttackAt);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = (await snap(page)).site;
  expect(await act(page, 'crossLocalConnection', 'north')).toBe(false); await advance(page, 100);
  expect((await snap(page)).site).toEqual(frozen);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(f.errors).toEqual([]);
});
