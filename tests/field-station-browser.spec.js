const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { openForeignWorkspace, advance: advanceForeign, wa } = require('./helpers/foreign-assay-visit');
test.setTimeout(2700000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldStationSnapshot());
const field = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.fieldStationAction(action, options), { action, options });
const trip = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function advance(page, seconds) {
  const s = await snap(page);
  return s.local && s.saved?.site ? page.evaluate(n => window.helixHeresyDebug.advanceFieldStationForTest(n), seconds) : advanceForeign(page, seconds);
}
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snap(page), task = s.tasks.find(t => !t.reason);
    if (!task) return;
    await advance(page, Math.max(1, task.dueAt - s.clock + 1));
  }
  throw new Error(`Physical station work did not finish: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function move(page, cell) {
  const s = await snap(page); if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId: s.saved.site.roomId, cell })).toBe(true);
  await finish(page);
}
async function reload(page, renderer = 'canvas') {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function arrive(page) {
  page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'field-station', 'canvas', false, false, 0, 'station', 'station');
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  // Explicit finite local tool fixture. The three masonry/carpentry hand tools
  // arrived through the real 40 L intercity allowance; adding the ladder there
  // would exceed it. No station action grants or replenishes this local tool.
  expect(await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.configureHiddenWorkshopTest({ carryTools: ['foldingLadder'] });
    return d.fieldStationSnapshot().stacks.some(i => i.key === 'foldingLadder' && i.carriedBy === 'scientist');
  })).toBe(true);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), context = {
      worldId: s.resourceSurveys.context?.worldId || 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'station',
      truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    if (!d.setForeignSurveyTestSource(source, carrier, context)) return false;
    return d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Dry woodland' }], occupied: [], context });
  }, { source, carrier })).toBe(true);
  expect(await trip(page, 'quote')).toBe(true); expect(await trip(page, 'accept', { expected: (await field(page)).excursion.quote })).toBe(true);
  expect(await trip(page, 'book')).toBe(true); await advance(page, 120);
  expect(await trip(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await trip(page, 'disembark')).toBe(true); await finish(page);
  expect(await act(page, 'register')).toBe(false); // Sampling permission is not construction permission.
  expect(await trip(page, 'enterWilderness')).toBe(true); await finish(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Automatic Eating and Drinking: On', exact: true }).click();
}
test('canvas foreign supply hut consumes finite staged stock piecewise, retains partial work and cargo through real saves and revisits, and provides only physical shelter/storage', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await arrive(page);
  console.info('Reached original foreign wilderness with finite tools and provisions.');
  const before = await snap(page), driver = (await field(page)).excursion.carrier.driver.id, fuel = (await field(page)).excursion.carrier.vehicle.fuelKm;
  expect(before.tools.filter(t => t.stack.carriedBy === 'scientist')).toHaveLength(4);
  const stockBefore = before.stacks.map(i => [i.id, i.quantity]);
  await page.locator('[data-field-station]').getByRole('button', { name: 'Register nearest inspected clear station footprint', exact: true }).click();
  let s = await snap(page); expect(s.saved.site).toBeTruthy(); expect(s.saved.site.parts).toEqual({});
  expect(s.stacks.map(i => [i.id, i.quantity])).toEqual(stockBefore); expect(await act(page, 'register')).toBe(false);
  const site = s.saved.site, l = site.layout;
  expect(l.footprint.every(c => c.y !== 12)).toBe(true);
  // Explicit finite construction stock fixture, separate from ordinary registration or travel.
  // No normal feature action issues this stock or replenishes it during the test.
  const supplies = await page.evaluate(cell => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell,
    supplies: { stoneBlocks: 21, lumber: 16, metalParts: 1, drinkingWater: 6, trailMeal: 4 } }), l.apron);
  expect(supplies).toHaveLength(5);
  await move(page, l.apron);
  // Park all actual original departure tools and supplies; retrieve only what each job/load can carry.
  for (const i of (await snap(page)).stacks.filter(i => i.carriedBy === 'scientist')) expect(await act(page, 'stage', { stackId: i.id })).toBe(true);
  const toolIds = before.tools.filter(t => t.stack.carriedBy === 'scientist').map(t => t.tool.id);
  for (let index = 0; index < l.parts.length; index++) {
    const p = l.parts[index];
    await test.step(`Physically supply and install ${p.id}`, async () => {
      // Put unused tools down at the apron, preserving real carrying limits.
      await move(page, l.apron);
      // Construction and loaded walking spend real stamina. Rest normally and
      // personally collect/consume this fixture's finite provisions as needed.
      for (const [need, key, supplyIndex, label] of [['thirst', 'drinkingWater', 3, 'Sealed Drinking Water'], ['hunger', 'trailMeal', 4, 'Trail Meal']]) {
        const needs = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().wildernessSurvival);
        if (needs[need] < 30) continue;
        const item = (await snap(page)).stacks.find(i => i.id === supplies[supplyIndex] && i.quantity > 0);
        expect(item, `finite ${key}`).toBeTruthy();
        expect(await act(page, 'collect', { stackId: item.id })).toBe(true); await finish(page);
        await page.getByRole('button', { name: `Use ${label}`, exact: true }).click(); await finish(page);
      }
      while ((await snap(page)).stamina < 65) {
        const previous = (await snap(page)).stamina;
        await page.getByRole('button', { name: 'Rest Here (15 minutes)', exact: true }).click(); await finish(page);
        expect((await snap(page)).stamina).toBeGreaterThan(previous);
      }
      for (const i of (await snap(page)).stacks.filter(i => i.carriedBy === 'scientist' && !Object.keys(p.tools).includes(i.key)))
        expect(await act(page, 'stage', { stackId: i.id })).toBe(true);
      for (const key of Object.keys(p.tools)) {
        s = await snap(page); if (s.stacks.some(i => i.key === key && i.carriedBy === 'scientist')) continue;
        const item = s.stacks.find(i => i.key === key && !i.carriedBy && !i.reservedTaskId && i.roomId === site.roomId);
        expect(item).toBeTruthy(); await move(page, item.cell);
        expect(await act(page, 'collect', { stackId: item.id })).toBe(true); await finish(page);
      }
      const plan = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id), p.id);
      expect(plan.context.reachable, p.id).toBe(true);
      const work = plan.context.workCell;
      // A real pile already within reach is valid staged stock; do not move
      // extra units onto future installation tiles merely to supply it twice.
      for (const [key, count] of plan.inputs ? [] : Object.entries(p.costs)) for (let unit = 0; unit < count; unit++) {
        s = await snap(page);
        const supplyId = supplies[['stoneBlocks', 'lumber', 'metalParts'].indexOf(key)];
        const item = s.stacks.find(i => i.id === supplyId && !i.carriedBy && !i.reservedTaskId && i.roomId === site.roomId && i.quantity > 0);
        expect(item, key).toBeTruthy(); await move(page, item.cell);
        expect(await act(page, 'collect', { stackId: item.id })).toBe(true); await finish(page);
        const carried = (await snap(page)).stacks.find(i => i.key === key && i.carriedBy === 'scientist');
        expect(carried).toBeTruthy(); await move(page, work);
        expect(await act(page, 'stage', { stackId: carried.id })).toBe(true);
      }
      const prepared = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id), p.id);
      expect(prepared.context.geometryOkay, JSON.stringify(prepared.context)).toBe(true);
      expect(prepared.inputs, JSON.stringify(prepared.context)).toBeTruthy();
      console.info(`Supplied station component ${index + 1}/${l.parts.length}: ${p.id}`);
      expect(await act(page, 'build', { partId: p.id }), JSON.stringify(prepared)).toBe(true);
      if (index === 0) {
        await advance(page, 180); s = await snap(page); let task = s.tasks.find(t => t.data?.fieldStationWork);
        expect(task.reason).toBe(''); expect(task.data.fieldStationWork.progress).toBeGreaterThan(0);
        const progress = task.data.fieldStationWork.progress, ids = task.data.fieldStationWork.tools.map(t => t.toolId);
        await reload(page); s = await snap(page); task = s.tasks.find(t => t.data?.fieldStationWork);
        expect(task.data.fieldStationWork.progress).toBe(progress); expect(task.reason).toBe('');
        expect(s.tools.filter(t => ids.includes(t.tool.id)).every(t => t.tool.reservedTaskId === task.id && t.stack.reservedTaskId === task.id)).toBe(true);
        expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
        s = await snap(page); expect(s.saved.site.effort[p.id]).toBeGreaterThan(0); expect(s.saved.site.parts[p.id]).toBeUndefined();
        expect(await act(page, 'build', { partId: p.id })).toBe(true);
      }
      await finish(page); s = await snap(page);
      expect(s.saved.site.parts[p.id], JSON.stringify(s.tasks)).toBeTruthy();
      expect(s.tasks.filter(t => t.data?.fieldStationWork)).toEqual([]);
      expect(await act(page, 'build', { partId: p.id })).toBe(false);
      console.info(`Installed station component ${index + 1}/${l.parts.length}: ${p.id}`);
    });
  }
  s = await snap(page); expect(Object.keys(s.saved.site.parts)).toHaveLength(26);
  expect(s.stacks.filter(i => i.section === 'resources' && i.roomId === site.roomId && ['stoneBlocks', 'lumber', 'metalParts'].includes(i.key))).toEqual([]);
  expect(s.tools.filter(t => toolIds.includes(t.tool.id)).every(t => t.tool.current < before.tools.find(b => b.tool?.id === t.tool.id).tool.current)).toBe(true);
  expect(s.fixtures.filter(f => f.id === s.saved.site.cacheId)).toHaveLength(1);
  const cacheId = s.saved.site.cacheId, doorId = s.saved.site.doorId;
  await move(page, l.rest); s = await snap(page); expect(s.sheltered).toBe(true); // Ordinary movement opens the real door.
  expect(s.doors[doorId].state).toBe('open'); expect(s.doorwayVisible).toBe(true);
  expect(await act(page, 'door')).toBe(true); s = await snap(page); expect(s.doors[doorId].state).toBe('closed'); expect(s.doorwayVisible).toBe(false);
  expect(await act(page, 'door')).toBe(true);
  const water = s.stacks.find(i => i.key === 'drinkingWater' && !i.carriedBy && i.quantity > 0 && i.roomId === site.roomId);
  await move(page, water.cell); expect(await act(page, 'collect', { stackId: water.id })).toBe(true); await finish(page);
  const carried = (await snap(page)).stacks.find(i => i.key === 'drinkingWater' && i.carriedBy === 'scientist');
  expect(await act(page, 'put', { stackId: carried.id })).toBe(true); await finish(page);
  s = await snap(page); const stored = s.stacks.find(i => i.fixtureId === cacheId && i.key === 'drinkingWater'); expect(stored?.quantity).toBe(1);
  const report = s.knowledge.observations.inventory; expect(report.goods.some(i => i.id === stored.id)).toBe(true);
  await reload(page, 'dom'); s = await snap(page); expect(s.stacks.find(i => i.id === stored.id).fixtureId).toBe(cacheId);
  expect(s.saved.site.doorId).toBe(doorId); expect(s.saved.site.cacheId).toBe(cacheId); expect(s.sheltered).toBe(true);
  // Actual damage removes weather shelter without erasing historical installation receipts.
  await page.evaluate(cell => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    state.labMap.terrain.constructedFloors.find(p => p.cell.x === cell.x && p.cell.y === cell.y && p.cell.z === cell.z).condition = 0;
    d.importSurveyExpeditionTestState(state);
  }, { ...l.rest, z: l.rest.z + 1 });
  s = await snap(page); expect(s.sheltered).toBe(false); expect(Object.keys(s.saved.site.parts)).toHaveLength(26);
  await page.evaluate(() => window.helixHeresyDebug.setMapRenderer('canvas'));
  // Retrieve real departure essentials before the next outbound trip; the hut supplies no remote packing exception.
  await move(page, l.apron);
  for (const key of ['environmentalSurveyKit', 'sealedReagentBottle', 'fieldRation', 'drinkingWater']) {
    s = await snap(page); if (s.stacks.some(i => i.key === key && i.carriedBy === 'scientist')) continue;
    const item = s.stacks.find(i => i.key === key && !i.carriedBy && !i.fixtureId && i.quantity > 0 && i.roomId === site.roomId);
    expect(item).toBeTruthy(); await move(page, item.cell); expect(await act(page, 'collect', { stackId: item.id })).toBe(true); await finish(page);
  }
  expect(await trip(page, 'withdraw')).toBe(true); await finish(page);
  const lastReport = (await snap(page)).knowledge.observations;
  expect(await trip(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await trip(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  s = await snap(page); expect(s.local).toBe(false); expect(s.knowledge.observations).toEqual(lastReport);
  expect(s.stacks.find(i => i.id === stored.id).fixtureId).toBe(cacheId); expect((await field(page)).excursion.carrier.driver.id).toBe(driver);
  expect((await field(page)).excursion.carrier.vehicle.fuelKm).toBeLessThan(fuel);
  expect(await act(page, 'take', { stackId: stored.id })).toBe(false);
  await expect(page.locator('[data-field-station]')).toContainText('Away records do not refresh');
  // Another paid physical trip returns to the same station, not a replenished replacement.
  expect(await trip(page, 'book')).toBe(true); await advance(page, 120);
  expect(await trip(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await trip(page, 'disembark')).toBe(true); await finish(page);
  expect(await trip(page, 'enterWilderness')).toBe(true); await finish(page); await move(page, l.rest);
  expect(await act(page, 'take', { stackId: stored.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.stacks.find(i => i.id === stored.id).carriedBy).toBe('scientist');
  expect(s.saved.site.cacheId).toBe(cacheId); expect(s.saved.site.doorId).toBe(doorId); expect(s.sheltered).toBe(false);
  expect(errors).toEqual([]);
});
