const { expect } = require('@playwright/test');
const Carrier = require('../../municipal-carrier');
const { startLifecycleRun } = require('./start-lifecycle-run');
const { reload } = require('./field-station');
const snap = page => page.evaluate(() => window.helixHeresyDebug.residentCaretakerSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.residentCaretakerAction(action, options), { action, options });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceResidentCaretakerForTest(n), n);
async function fixture(page, renderer) {
  page.on('dialog', d => d.accept()); await startLifecycleRun(page, `resident-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const institution = { id: 'works:b', name: 'Birch Public Works', capacityBand: 'functional' };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: institution.id, charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: institution.id }, institutions: [institution] }] } }, 'b', 0);
  const f = await page.evaluate(({ renderer, source, carrier, city, institution }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'resident', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: { origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    d.setFieldBuilderTestSource({ city, institution }); d.fieldStationAction('register');
    const s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey;
    const w = e.wilderness, ext = window.HelixForeignWilderness.extensionPlan(w);
    // Explicit pre-existing reached ground, supplied shell and previously
    // settled worker fixture. These are inputs, never outcomes of this slice.
    ext.discovery = window.HelixWildernessDiscovery.create(ext.destination, 'adjoining');
    window.HelixWildernessDiscovery.materialize(ext.discovery, context.worldId, 'resident', ext.destination, s.clock, null, ext);
    ext.materialized = true; w.extension = ext;
    w.patchGraph = window.HelixLocalPatchGraph.create(w);
    w.patchGraph = window.HelixLocalPatchGraph.recordStep(w.patchGraph, ext.seam, ext.entry, s.clock);
    s.labMap.rooms[w.roomId].cells.push(...ext.discovery.baseline.cells); s.labMap.rooms[w.roomId].width = w.bounds.width * 2;
    s.labMap.terrain.excavated.push(...ext.discovery.baseline.cells);
    for (const cell of [...s.labMap.rooms[e.roomId].cells, ...s.labMap.rooms[w.roomId].cells, w.gate]) {
      s.mapCellObservations[`${cell.x},${cell.y},${cell.z}`] = { cell, lastObservedAt: s.clock, source: 'Explicit previously inspected local route fixture', snapshot: {} };
    }
    const station = window.HelixFieldStation.create(), l = window.HelixFieldStation.layout({ x: 39, y: 14, z: w.bounds.z }, 'refuge');
    station.site = { id: 'refuge:lifecycle-world:east', siteId: ext.context.siteId, worldId: context.worldId, strategicCellId: ext.context.strategicCellId,
      cityId: 'b', roomId: w.roomId, label: 'Supplied Wilderness Refuge', weather: ext.destination, layout: l, registeredAt: s.clock, parts: {}, effort: {},
      cacheId: 'resident-original-cache', heaterId: 'resident-original-heater', doorId: 'resident-original-door' };
    s.fieldRefuge = station;
    for (const p of l.parts) {
      if (p.kind === 'wall') s.labMap.terrain.constructedWalls.push({ cell: p.cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
      if (['floor', 'roof'].includes(p.kind)) s.labMap.terrain.constructedFloors.push({ cell: p.cell, materialId: p.kind === 'floor' ? 'stoneBlocks' : 'lumber', purpose: p.kind, condition: 100, builtAt: s.clock });
      station.site.parts[p.id] = { at: s.clock, physicalId: p.kind === 'cache' ? station.site.cacheId : p.kind === 'heater' ? station.site.heaterId : p.id };
    }
    const doorId = station.site.doorId;
    s.labMap.doors[doorId] = { id: doorId, cell: l.door, roomIds: [w.roomId], frameAxis: 'eastWest', passageAxis: 'northSouth' };
    s.doors[doorId] = { id: doorId, typeId: 'roughWoodDoor', state: 'open', condition: 100, lockState: 'unlocked' };
    s.fixtures.push({ id: station.site.cacheId, typeId: 'storageCrate', name: 'Original refuge crate', origin: l.cache, condition: 100, accessState: 'open', installedAt: s.clock },
      { id: station.site.heaterId, typeId: 'spaceHeater', name: 'Original refuge heater', origin: l.heater, condition: 100, installedAt: s.clock,
        utility: { enabled: false, powerMode: 'fuel', fuel: 0, climateSetting: 'comfortable' } });
    const backing = window.HelixFieldBuilder.source(city, institution, null, e);
    e.builder = window.HelixFieldBuilder.create(backing, e, s.clock);
    e.builder.phase = 'completed'; e.builder.contract = { settledAt: s.clock, claims: { tools: [] } }; e.builder.actor.initializedKit = true;
    // Finite original personal kit and designated locally delivered crate goods.
    let n = s.nextPhysicalItemStackNumber;
    const add = (key, quantity, section, carriedBy = '', fixtureId = '') => s.physicalItemStacks.push({ id: `stack-${n++}`, key, quantity, knownQuantity: quantity,
      section, roomId: carriedBy ? e.roomId : w.roomId, cell: carriedBy ? e.builder.actor.mapCell : l.cache, carriedBy, fixtureId, sourceLabels: ['Explicit finite resident test stock'] });
    add('drinkingWater', 3, 'inventory', e.builder.actor.id); add('trailMeal', 2, 'inventory', e.builder.actor.id);
    add('drinkingWater', 8, 'inventory', '', station.site.cacheId); add('trailMeal', 4, 'inventory', '', station.site.cacheId);
    add('fuelReagent', 2, 'resources', '', station.site.cacheId);
    s.nextPhysicalItemStackNumber = n; s.economy.money = 1000;
    d.importSurveyExpeditionTestState(s); d.configureUnsupportedTest({ cell: l.rest });
    return { l, home: e.builder.layout.meeting, room: e.roomId, workerId: e.builder.actor.id, wildRoom: w.roomId };
  }, { renderer, source, carrier, city, institution });
  expect(f).toBeTruthy();
  // Real original home kit is carried to the local meeting point as an
  // explicit fixture; the tested handoff preserves its original stack identity.
  await page.evaluate(({ home }) => {
    const d = window.helixHeresyDebug;
    d.configureUnsupportedTest({ carry: ['fieldShelter'] });
  }, f);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return f;
}
async function walk(page, room, cell) {
  const started = await page.evaluate(({ room, cell }) => {
    const d = window.helixHeresyDebug, current = d.fieldStationSnapshot();
    if (JSON.stringify(current.cell) === JSON.stringify(cell)) return true;
    const s = d.exportSurveyExpeditionTestState();
    const actual = Object.entries(s.labMap.rooms).find(([, r]) => r.cells?.some(c => ['x', 'y', 'z'].every(k => c[k] === cell[k])))?.[0] || room;
    return Boolean(d.startScientistMove(actual, { toCell: cell }));
  }, { room, cell });
  expect(started, JSON.stringify({ cell, snapshot: (await snap(page)).saved?.actor.mapCell })).toBe(true);
  for (let i = 0; i < 180; i++) {
    const tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason || '').toBe(''); await tick(page, 8);
  }
  throw Error('Physical accompanied walk did not finish.');
}
module.exports = { fixture, walk, snap, act, tick };

