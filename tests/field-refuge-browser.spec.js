const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { snap, act, trip, reload } = require('./helpers/field-station');
test.setTimeout(1080000);
async function tick(page, seconds) {
  await page.evaluate(n => {
    const d = window.helixHeresyDebug, s = d.fieldStationSnapshot();
    // Use the existing field-work heartbeat while at a registered facility.
    // The adjoining-walking helper deliberately ticks single-cell movement
    // records every second, even after a worker is already at the work tile.
    return s.local && s.saved?.site ? d.advanceFieldStationForTest(n) : d.advanceAdjoiningWildernessForTest(n);
  }, seconds);
}
async function finish(page) {
  for (let n = 0; n < 15; n++) {
    const s = await snap(page), t = s.tasks.find(t => !t.reason); if (!t) return;
    await tick(page, Math.max(1, t.dueAt - s.clock + 1));
  }
  throw Error(JSON.stringify((await snap(page)).tasks));
}
async function scaffold(page, key) {
  // Explicit pre-existing shell fixture: actual supplied construction of all
  // component recipes is covered by the focused model and original lifecycle.
  // This browser slice constructs a refuge floor and its heater through real tasks.
  await page.evaluate(key => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), site = s[key].site, l = site.layout, at = s.clock;
    for (const p of l.parts) {
      if (site.parts[p.id] || p.kind === 'heater') continue;
      let id = `${p.cell.x},${p.cell.y},${p.cell.z}`;
      if (p.kind === 'wall') s.labMap.terrain.constructedWalls.push({ cell: p.cell, materialId: 'stoneBlocks', condition: 100, builtAt: at });
      if (['floor', 'roof'].includes(p.kind)) s.labMap.terrain.constructedFloors.push({ cell: p.cell, materialId: p.kind === 'floor' ? 'stoneBlocks' : 'lumber', purpose: p.kind, condition: 100, builtAt: at });
      if (p.kind === 'door') {
        site.doorId = id = `door-${p.cell.x}-${p.cell.y}-${p.cell.z}`;
        s.labMap.doors[id] = { id, cell: p.cell, roomIds: [site.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
        s.doors[id] = { id, typeId: 'roughWoodDoor', state: 'open', condition: 100, builtAt: at, materialId: 'lumber', materialComposition: { primary: 'wood' } };
      }
      if (p.kind === 'cache') {
        site.cacheId = id = `${key}-original-cache`;
        s.fixtures.push({ id, typeId: 'storageCrate', name: `${key} Supply Crate`, origin: p.cell, rotation: 0, condition: 100,
          accessState: 'open', materialPolicy: 'wood', installedAt: at });
      }
      site.parts[p.id] = { at, partId: p.id, physicalId: id, taskId: `fixture:${p.id}` }; site.effort[p.id] = 1;
    }
    d.importSurveyExpeditionTestState(s);
  }, key);
}
async function walk(page, cell) {
  const s = await snap(page);
  if (JSON.stringify(s.cell) === JSON.stringify(cell)) return;
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room: s.roomId, cell })).toBe(true);
  await finish(page);
}
async function setup(page, renderer) {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, `field-refuge-${renderer}`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'station',
      truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    return d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: -10, precipitationMm: 100, biomeLabel: 'Cold woodland' }], occupied: [], context } });
  }, { source, carrier, renderer })).toBe(true);
  expect(await act(page, 'register')).toBe(true); await scaffold(page, 'fieldStation');
  const original = (await snap(page)).saved;
  expect(await act(page, 'register')).toBe(false);
  expect(await trip(page, 'walkLocalEdge', { direction: 'east' })).toBe(true); await finish(page);
  expect(await trip(page, 'crossLocalConnection', { direction: 'east' })).toBe(true); await finish(page);
  expect(await act(page, 'register')).toBe(true);
  return original;
}
for (const renderer of ['canvas', 'dom']) test(`${renderer}: separately supplied refuge retains both sites, finite heating, original handling and dated knowledge`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const original = await setup(page, renderer);
  console.info('Reached and registered the separate refuge patch.');
  let s = await snap(page); const site = s.saved.site, l = site.layout;
  expect(site.layout.purpose).toBe('refuge'); expect(site.siteId).not.toBe(original.site.siteId);
  expect(site.id).not.toBe(original.site.id); expect(site.cacheId).toBe('');
  expect(await act(page, 'build', { partId: l.parts[0].id })).toBe(false);
  expect(await act(page, 'heaterToggle')).toBe(false);
  await walk(page, l.apron);
  // Explicit finite supplies delivered locally by the test, never by registration.
  await page.evaluate(cell => window.helixHeresyDebug.configureHiddenWorkshopTest({ cell, carryTools: ['masonryHammer'],
    supplies: { stoneBlocks: 1, steelPanels: 2, metalParts: 3, fuelReagent: 1, drinkingWater: 1, trailMeal: 1 } }), l.apron);
  const first = l.parts[0];
  // Floor construction also needs the original chisel; absence is not waived.
  await page.evaluate(() => window.helixHeresyDebug.configureHiddenWorkshopTest({ carryTools: ['stoneChisel'] }));
  let plan = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id), first.id);
  const stone = (await snap(page)).stacks.find(i => i.key === 'stoneBlocks' && i.roomId === site.roomId && !i.carriedBy);
  await walk(page, stone.cell); expect(await act(page, 'collect', { stackId: stone.id })).toBe(true); await finish(page);
  await walk(page, plan.context.workCell);
  expect(await act(page, 'stage', { stackId: (await snap(page)).stacks.find(i => i.key === 'stoneBlocks' && i.carriedBy === 'scientist').id })).toBe(true);
  expect(await act(page, 'build', { partId: first.id })).toBe(true);
  await tick(page, 120); s = await snap(page); const work = s.tasks.find(t => t.data?.fieldStationWork);
  expect(work.data.fieldStationWork.progress).toBeGreaterThan(0);
  await reload(page, renderer); s = await snap(page);
  expect(s.tasks.find(t => t.id === work.id).reason).toBe('');
  expect(s.tasks.find(t => t.id === work.id).data.fieldStationWork.progress).toBe(work.data.fieldStationWork.progress);
  await finish(page); expect((await snap(page)).saved.site.parts[first.id]).toBeTruthy();
  console.info('Original refuge floor work survived reload and completed.');
  await walk(page, l.apron); await scaffold(page, 'fieldRefuge');
  const heaterPart = l.parts.find(p => p.kind === 'heater');
  plan = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id), heaterPart.id);
  expect(plan.context.workCell).toBeTruthy();
  for (const key of ['steelPanels', 'metalParts']) {
    const pile = (await snap(page)).stacks.find(i => i.key === key && !i.carriedBy && !i.reservedTaskId && i.roomId === site.roomId);
    for (let n = 0; n < 2; n++) {
      await walk(page, pile.cell); expect(await act(page, 'collect', { stackId: pile.id })).toBe(true); await finish(page);
      await walk(page, plan.context.workCell);
      const carried = (await snap(page)).stacks.find(i => i.key === key && i.carriedBy === 'scientist');
      expect(await act(page, 'stage', { stackId: carried.id })).toBe(true);
    }
  }
  if ((await snap(page)).stamina < 30) {
    await walk(page, l.rest); expect(await act(page, 'rest')).toBe(true); await finish(page);
  }
  const suppliedHeater = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id), heaterPart.id);
  expect(await act(page, 'build', { partId: heaterPart.id }), JSON.stringify(suppliedHeater)).toBe(true); await finish(page);
  console.info('Installed the refuge heater from staged steel and parts.');
  s = await snap(page); const heaterId = s.saved.site.heaterId, cacheId = s.saved.site.cacheId;
  expect(s.fixtures.find(f => f.id === heaterId).utility.fuel).toBe(0);
  expect(s.fixtures.find(f => f.id === heaterId).utility.enabled).toBe(false);
  const water = s.stacks.find(i => i.key === 'drinkingWater' && !i.carriedBy && i.roomId === site.roomId);
  await walk(page, water.cell); expect(await act(page, 'collect', { stackId: water.id })).toBe(true); await finish(page);
  const carriedWater = (await snap(page)).stacks.find(i => i.key === 'drinkingWater' && i.carriedBy === 'scientist');
  expect(await act(page, 'put', { stackId: carriedWater.id })).toBe(true); await finish(page);
  const storedWater = (await snap(page)).stacks.find(i => i.fixtureId === cacheId && i.key === 'drinkingWater');
  expect(storedWater.quantity).toBe(1);
  s = await snap(page);
  const fuel = s.stacks.find(i => i.key === 'fuelReagent' && !i.carriedBy && i.roomId === site.roomId);
  await walk(page, fuel.cell); expect(await act(page, 'collect', { stackId: fuel.id })).toBe(true); await finish(page);
  expect(await act(page, 'heaterFuel')).toBe(true); await tick(page, 20);
  await reload(page, renderer); await finish(page);
  expect((await snap(page)).fixtures.find(f => f.id === heaterId).utility.fuel).toBe(1);
  expect(await act(page, 'heaterFuel')).toBe(false);
  expect(await act(page, 'heaterToggle')).toBe(true); await finish(page);
  await walk(page, { ...l.door, y: l.door.y - 1 }); expect(await act(page, 'door')).toBe(true);
  await walk(page, l.rest); expect(await act(page, 'rest')).toBe(true); await tick(page, 600);
  s = await snap(page); const warm = s.saved.site.climate.temperatureC;
  expect(warm).toBeGreaterThan(-9); expect(s.fixtures.find(f => f.id === heaterId).utility.fuel).toBeLessThan(1);
  expect(s.allSites[0].site.parts).toEqual(original.site.parts);
  for (const t of s.tasks) await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), t.id);
  const reportAt = s.saved.observations.at;
  await walk(page, l.apron);
  expect(await trip(page, 'walkLocalEdge', { direction: 'west' })).toBe(true); await finish(page);
  expect(await trip(page, 'crossLocalConnection', { direction: 'west' })).toBe(true); await finish(page);
  await walk(page, original.site.layout.rest);
  s = await snap(page); expect(s.saved.site.id).toBe(original.site.id); expect(s.sheltered).toBe(true);
  expect(await act(page, 'take', { stackId: storedWater.id })).toBe(false);
  const away = s.allSites[1].observations, fuelBefore = s.fixtures.find(f => f.id === heaterId).utility.fuel;
  expect(away.at).toBeGreaterThanOrEqual(reportAt);
  await tick(page, 120); s = await snap(page);
  expect(s.allSites[1].observations).toEqual(away);
  expect(s.fixtures.find(f => f.id === heaterId).utility.fuel).toBeLessThan(fuelBefore);
  await reload(page, renderer); s = await snap(page);
  expect(s.allSites[1].site.cacheId).toBe(cacheId); expect(s.allSites[1].observations).toEqual(away);
  expect(s.allSites[0].site.cacheId).toBe(original.site.cacheId);
  expect(s.stacks.find(i => i.id === storedWater.id).fixtureId).toBe(cacheId);
  // Explicit actual fixture damage while elsewhere: no discovery or repair is
  // granted remotely, and the original station's shelter remains independent.
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const f = s.fixtures.find(f => f.id === id); f.condition = 0; f.operationalState = 'broken'; d.importSurveyExpeditionTestState(s);
  }, heaterId);
  const stoppedFuel = (await snap(page)).fixtures.find(f => f.id === heaterId).utility.fuel;
  await tick(page, 120); s = await snap(page);
  expect(s.sheltered).toBe(true); expect(s.fixtures.find(f => f.id === heaterId).utility.fuel).toBe(stoppedFuel);
  expect(s.allSites[1].observations).toEqual(away);
  expect(await trip(page, 'walkLocalEdge', { direction: 'east' })).toBe(true); await finish(page);
  expect(await trip(page, 'crossLocalConnection', { direction: 'east' })).toBe(true); await finish(page);
  await walk(page, { ...l.heater, y: l.heater.y + 1 });
  const repairPlan = await page.evaluate(id => window.helixHeresyDebug.fieldStationBuildPlan(id, 'repair'), heaterPart.id);
  expect(repairPlan.part.costs).toEqual({ metalParts: 1 });
  const spare = (await snap(page)).stacks.find(i => i.key === 'metalParts' && !i.carriedBy && !i.reservedTaskId && i.roomId === site.roomId);
  await walk(page, spare.cell); expect(await act(page, 'collect', { stackId: spare.id })).toBe(true); await finish(page);
  await walk(page, repairPlan.context.workCell);
  const carriedPart = (await snap(page)).stacks.find(i => i.key === 'metalParts' && i.carriedBy === 'scientist');
  expect(await act(page, 'stage', { stackId: carriedPart.id })).toBe(true);
  expect(await act(page, 'repair', { partId: heaterPart.id })).toBe(true); await finish(page);
  s = await snap(page); expect(s.fixtures.find(f => f.id === heaterId).condition).toBe(45);
  expect(s.fixtures.find(f => f.id === heaterId).operationalState).toBe('operational');
  expect(s.stacks.find(i => i.id === storedWater.id).fixtureId).toBe(cacheId);
  expect(s.allSites[0].site.parts).toEqual(original.site.parts);
  expect(errors).toEqual([]);
});
