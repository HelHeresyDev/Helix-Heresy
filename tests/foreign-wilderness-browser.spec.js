const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Library = require('../world-run-library'), World = require('../strategic-world'), Bodies = require('../beast-bodies');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const { openForeignWorkspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(540000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const wild = page => page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignSurveyAction(action, options), { action, options });
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
let seamWorld;
function originalSeamWorld(worldSeed = 'native-encounters', refinementLevel = 2) {
  if (seamWorld && worldSeed === 'native-encounters') return seamWorld;
  const w = Library.createWorld({ id: 'native-survey', worldSeed, createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel } } });
  const map = w.generatedData.strategicMap, catalog = JSON.parse(JSON.stringify(lifecycleWorld().generatedData.strategicMap.strategicStartingSites));
  delete catalog.digest;
  for (const c of catalog.scenarioRows[0].candidates) c.strategicCellId = World.cellId(map.surface.classes.indexOf('L'));
  catalog.digest = `strategic-starting-sites-${World.stableHash(catalog)}`;
  map.strategicStartingSites = catalog; map.publicStartingSiteDirectory = JSON.parse(JSON.stringify(catalog));
  const result = Library.createWorld({ ...w, generatedData: { ...w.generatedData, strategicMap: World.finalizeStrategicMap(map) } });
  if (worldSeed === 'native-encounters') seamWorld = result;
  return result;
}
test('ordinary wetland bank survey observes a conserved original Mire Choir member from dry ground', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const world = originalSeamWorld('source-small'), field = 'planet-cell:00011', wetland = 'planet-cell:00045';
  await openForeignWorkspace(page, 'wetland-bank', 'canvas', false, false, 0, 'wilderness', false, null, null, world);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: field, name: 'Wetland Survey Approach', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const map = world.generatedData.strategicMap, origin = World.cellSnapshot(map, World.cellIndex(field));
  // Select an original mapped wetland in the itinerary. There is no recorded
  // local arrival override, debug body, or runtime search for a resident.
  const destination = World.cellSnapshot(map, World.cellIndex(wetland));
  expect(await page.evaluate(({ source, carrier, origin, destination }) => {
    const d = window.helixHeresyDebug, context = d.foreignSurveySnapshot().surveys.context;
    return d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })
      && d.setForeignWildernessTestSource({ origin, candidates: [{ ...destination, slopePercent: .6, temperatureC: 17 }], occupied: [], context });
  }, { source, carrier, origin, destination })).toBe(true);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  let w = await wild(page);
  expect(w.site.beasts?.materialized ?? false).toBe(false);
  expect(w.site.beasts?.actors ?? []).toHaveLength(0);
  expect(w.knowledge.sightings.filter(a => a.speciesId === 'beast:mire-choir')).toHaveLength(0);
  const walk = s => page.evaluate(s => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(s), s);
  const notes = async () => Object.values((await snap(page)).excursion.fieldSightings || {});
  async function finishWalk() {
    for (let i = 0; i < 12; i++) {
      const s = await wild(page), t = s.tasks.find(t => !t.reason);
      if (!t) { expect(s.tasks).toHaveLength(0); return; }
      await walk(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Wetland survey walk did not finish');
  }
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  await page.waitForFunction(() => window.helixHeresyDebug.foreignWildernessSnapshot().site.beasts?.materialized, null, { timeout: 120000 });
  w = await wild(page);
  expect(w.site.discovery.baseline.populationWetlandBank).toBeTruthy();
  const terrain = w.site.beasts.bodyTerrain;
  const dry = { ...w.site.entry, x: w.site.entry.x + 8 }, wet = { ...dry, x: dry.x + 1 };
  const key = ({ x, y, z }) => `${x},${y},${z}`;
  expect(terrain[key(dry)]).toMatchObject({ sourceRegionId: 'habitat:45:surface', waterDepthM: 0 });
  expect(terrain[key(wet)]).toMatchObject({ sourceRegionId: 'habitat:45:wetland', fieldWetland: true });
  expect(terrain[key(wet)].waterDepthM).toBeGreaterThan(.9);
  expect(w.knowledge.sightings.filter(a => a.speciesId === 'beast:mire-choir')).toHaveLength(0);
  expect((await notes()).filter(n => n.account.speciesId === 'beast:mire-choir')).toHaveLength(0);
  const start = cell => page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })),
    { room: w.site.roomId, cell });
  expect(await start(wet)).toBe(false);
  expect(await start(dry)).toBe(true); await finishWalk();
  w = await wild(page);
  expect(w.cell).toEqual(dry);
  const sighting = w.knowledge.sightings.find(a => a.speciesId === 'beast:mire-choir' && a.current);
  expect(sighting).toBeTruthy();
  const actor = w.site.beasts.actors.find(a => a.id === sighting.id);
  expect(actor.nativePopulation.regionId).toBe('habitat:45:wetland');
  expect(actor.life.originalMemberId).toBeTruthy();
  expect(actor.bodyPhysics.mode).toBe('swimming');
  const readSighting = async () => (await notes()).find(n => n.original.memberId === actor.life.originalMemberId);
  const observed = await readSighting();
  expect(observed).toMatchObject({ account: { observedAt: sighting.observedAt, speciesId: actor.speciesId,
    place: { strategicCellId: wetland }, witness: { actorId: 'scientist' } } });
  expect((await snap(page)).sightingReceipts).toHaveLength(0);
  expect(await act(page, 'shareSighting', { expected: { id: observed.id, observedAt: observed.account.observedAt } })).toBe(false);
  for (const renderer of ['canvas', 'dom']) {
    const labels = await page.evaluate(renderer => {
      const d = window.helixHeresyDebug; d.setMapRenderer(renderer); d.setMapOverlay('prospecting');
      return d.mapSceneSnapshot().cells.map(c => c.overlay?.label);
    }, renderer);
    expect(labels).toContain('Observed wetland water');
    expect(labels.some(label => label?.includes(actor.name))).toBe(true);
  }
  await reload(page); w = await wild(page);
  expect(w.site.beasts.actors.find(a => a.id === actor.id)?.life.originalMemberId).toBe(actor.life.originalMemberId);
  expect(await act(page, 'withdraw')).toBe(true); await finishWalk();
  w = await wild(page);
  expect(w.site.beasts.actors).toHaveLength(0);
  expect(w.knowledge.sightings.find(a => a.id === actor.id)?.current).toBe(false);
  const withdrawn = await readSighting();
  expect(withdrawn.account.observedAt).toBeLessThan(w.clock);
  await reload(page);
  expect(await readSighting()).toEqual(withdrawn);
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  w = await wild(page);
  expect(w.site.beasts.actors.filter(a => a.life.originalMemberId === actor.life.originalMemberId).map(a => a.id)).toEqual([actor.id]);
  expect(await act(page, 'withdraw')).toBe(true); await finishWalk();
  const finalNote = await readSighting();
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  expect((await snap(page)).context.atDesk).toBe(true);
  expect(await readSighting()).toEqual(finalNote);
  expect((await snap(page)).sightingReceipts).toHaveLength(0);
  const panel = page.locator('[data-foreign-field-sightings]');
  await expect(panel).toContainText('not a current position');
  const shareButton = panel.getByRole('button', { name: `Share ${actor.name} sighting with municipal clerk`, exact: true });
  await shareButton.click();
  const [receipt] = (await snap(page)).sightingReceipts;
  expect(receipt).toMatchObject({ account: finalNote.account, recipient: { cityId: 'b', institutionId: 'admin:b' } });
  expect(receipt.receivedAt).toBeGreaterThan(finalNote.account.observedAt);
  expect(await act(page, 'shareSighting', { expected: { id: finalNote.id, observedAt: finalNote.account.observedAt } })).toBe(false);
  await reload(page);
  expect((await snap(page)).sightingReceipts).toEqual([receipt]);
  await expect(panel).toContainText('Copy received by the municipal clerk');
  expect(errors).toEqual([]);
});
test('ordinary mapped shoreline survey observes an original Reef Wyrm only from dry ground', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  // This mapped shelf has no competing inland fissure or wetland approach.
  const world = originalSeamWorld('ocean', 1), field = World.cellId(3), coast = World.cellId(32), sea = World.cellId(33);
  const seaRegion = `habitat:${World.cellIndex(sea)}:waterColumn`, shoreRegion = `habitat:${World.cellIndex(coast)}:shore`;
  expect(world.generatedData.strategicMap.beastHabitatSources.backgroundWildlife.reefSchoolRows.some(([region]) => region === seaRegion)).toBe(true);
  await openForeignWorkspace(page, 'mapped-shore', 'canvas', false, false, 0, 'wilderness', false, null, null, world);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: field, name: 'Mapped Shelf Approach', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const map = world.generatedData.strategicMap, origin = World.cellSnapshot(map, World.cellIndex(field)), destination = World.cellSnapshot(map, World.cellIndex(coast));
  // Only book an original mapped dry itinerary. No fixture moves/resizes a body or supplies a local sea entry.
  expect(await page.evaluate(({ source, carrier, origin, destination }) => {
    const d = window.helixHeresyDebug, context = d.foreignSurveySnapshot().surveys.context;
    return d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })
      && d.setForeignWildernessTestSource({ origin, candidates: [{ ...destination, slopePercent: .6, temperatureC: 17 }], occupied: [], context });
  }, { source, carrier, origin, destination })).toBe(true);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  const walk = s => page.evaluate(s => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(s), s);
  async function finishWalk() {
    for (let i = 0; i < 12; i++) {
      const s = await wild(page), t = s.tasks.find(t => !t.reason);
      if (!t) { expect(s.tasks).toHaveLength(0); return; }
      await walk(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Shoreline walk did not finish');
  }
  const notes = async () => Object.values((await snap(page)).excursion.fieldSightings || {});
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  await page.waitForFunction(() => window.helixHeresyDebug.foreignWildernessSnapshot().site.beasts?.materialized, null, { timeout: 160000 });
  let w = await wild(page);
  expect(w.site.coast).toMatchObject({ landCellId: coast, seaCellId: sea });
  expect((await notes()).some(n => n.account.speciesId === 'beast:reef-wyrm')).toBe(false);
  const dry = { ...w.site.entry, x: 30 }, wet = { ...dry, x: 31 };
  const key = ({ x, y, z }) => `${x},${y},${z}`, terrain = w.site.beasts.bodyTerrain;
  expect(terrain[key(dry)]).toMatchObject({ sourceRegionId: shoreRegion, waterDepthM: 0 });
  expect(terrain[key(wet)]).toMatchObject({ sourceRegionId: seaRegion, fieldSeawater: true, waterKind: 'seawater', floor: false });
  const original = w.site.beasts.actors.find(a => a.speciesId === 'beast:reef-wyrm');
  expect(original?.nativePopulation.regionId, 'Original full body must fit in the funded sea before it is seen').toBe(seaRegion);
  const start = cell => page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })),
    { room: w.site.roomId, cell });
  expect(await start(wet)).toBe(false);
  expect(await start(dry)).toBe(true); await finishWalk();
  w = await wild(page); expect(w.cell).toEqual(dry);
  const seen = w.knowledge.sightings.find(a => a.speciesId === 'beast:reef-wyrm' && a.current);
  const diagnostic = seen ? '' : await page.evaluate(id => {
    const d = window.helixHeresyDebug, a = d.foreignWildernessSnapshot().site.beasts.actors.find(row => row.id === id);
    return JSON.stringify({ actor: a && { cell: a.mapCell, altitudeM: a.bodyPhysics.altitudeM, light: d.lightingSnapshot(a.mapCell).lightLevel } });
  }, original.id);
  expect(seen, diagnostic).toMatchObject({ condition: 'Body partially visible from shore' });
  expect(seen.physicalPose).toBeUndefined();
  const actor = w.site.beasts.actors.find(a => a.id === seen.id);
  expect(actor.bodyPhysics.mode).toBe('swimming');
  expect(actor.bodyPhysics.dimensions.lengthM).toBeGreaterThan(20);
  expect(actor.nativePopulation.regionId).toBe(seaRegion);
  const note = (await notes()).find(n => n.original.memberId === actor.life.originalMemberId);
  expect(note.account).toMatchObject({ place: { strategicCellId: sea }, cell: seen.cell, observedAt: seen.observedAt });
  for (const renderer of ['canvas', 'dom']) {
    const labels = await page.evaluate(renderer => {
      const d = window.helixHeresyDebug; d.setMapRenderer(renderer); d.setMapOverlay('prospecting');
      return d.mapSceneSnapshot().cells.map(c => c.overlay?.label);
    }, renderer);
    expect(labels).toContain('Observed seawater');
    expect(labels.some(label => label?.includes(actor.name))).toBe(true);
  }
  expect(await act(page, 'withdraw')).toBe(true); await finishWalk();
  w = await wild(page); expect(w.site.beasts.actors).toHaveLength(0);
  const last = (await notes()).find(n => n.id === note.id);
  await reload(page);
  expect((await notes()).find(n => n.id === note.id)).toEqual(last);
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  w = await wild(page);
  expect(w.site.beasts.actors.filter(a => a.life.originalMemberId === actor.life.originalMemberId).map(a => a.id)).toEqual([actor.id]);
  expect(errors).toEqual([]);
});
test('ordinary fissure survey records only the exposed original seen past a rock screen', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const world = originalSeamWorld('atlas', 1), field = World.cellId(30), fissure = World.cellId(8);
  await openForeignWorkspace(page, 'mapped-fissure', 'canvas', false, false, 0, 'wilderness', false, null, null, world);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: field, name: 'Volcanic Approach', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const map = world.generatedData.strategicMap, origin = World.cellSnapshot(map, World.cellIndex(field)), destination = World.cellSnapshot(map, World.cellIndex(fissure));
  // The itinerary is controlled; the geology, placement and whole body come
  // from the generated archive. There is no actor or tunnel injection.
  expect(await page.evaluate(({ source, carrier, origin, destination }) => {
    const d = window.helixHeresyDebug, context = d.foreignSurveySnapshot().surveys.context;
    return d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })
      && d.setForeignWildernessTestSource({ origin, candidates: [{ ...destination, slopePercent: .6, temperatureC: 17 }], occupied: [], context });
  }, { source, carrier, origin, destination })).toBe(true);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  async function finishWalk() {
    for (let i = 0; i < 12; i++) {
      const s = await wild(page), t = s.tasks.find(t => !t.reason);
      if (!t) { expect(s.tasks).toHaveLength(0); return; }
      await page.evaluate(s => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(s), Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Fissure walk did not finish');
  }
  const notes = async () => Object.values((await snap(page)).excursion.fieldSightings || {});
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  await page.waitForFunction(() => window.helixHeresyDebug.foreignWildernessSnapshot().site.beasts?.materialized, null, { timeout: 160000 });
  let w = await wild(page);
  expect(w.site.mouth.cellId).toBe(fissure);
  const a = w.site.beasts.actors.find(a => a.speciesId === 'beast:burrowing-furnace');
  expect(a?.nativePopulation.regionId).toBe('habitat:8:subsurface');
  const start = cell => page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })),
    { room: w.site.roomId, cell });
  const behind = { ...w.site.entry, x: 27 };
  expect(await start(a.mapCell)).toBe(false);
  expect(await start(behind)).toBe(true); await finishWalk();
  w = await wild(page); expect(w.cell).toEqual(behind);
  expect(w.knowledge.sightings.find(row => row.id === a.id)).toBeUndefined();
  expect((await notes()).some(n => n.original.memberId === a.life.originalMemberId)).toBe(false);
  const rim = { ...behind, x: 30, y: 10 };
  expect(await start(rim)).toBe(true); await finishWalk();
  w = await wild(page); expect(w.cell).toEqual(rim);
  const seen = w.knowledge.sightings.find(row => row.id === a.id && row.current);
  expect(seen).toMatchObject({ condition: 'Body partially exposed at the burrow mouth' });
  expect(seen.physicalPose).toBeUndefined();
  const note = (await notes()).find(n => n.original.memberId === a.life.originalMemberId);
  expect(note.account).toMatchObject({ place: { strategicCellId: fissure }, cell: seen.cell });
  expect(w.site.beasts.tracks.some(t => t.id === `track:${a.id}`)).toBe(false);
  expect(await act(page, 'withdraw')).toBe(true); await finishWalk();
  w = await wild(page); expect(w.site.beasts.actors).toHaveLength(0);
  const last = (await notes()).find(n => n.id === note.id);
  await reload(page);
  expect((await notes()).find(n => n.id === note.id)).toEqual(last);
  expect(await act(page, 'enterWilderness')).toBe(true); await finishWalk();
  w = await wild(page);
  expect(w.site.beasts.actors.filter(row => row.life.originalMemberId === a.life.originalMemberId).map(row => row.id)).toEqual([a.id]);
  expect(errors).toEqual([]);
});
test('Canvas and DOM: ordinary foreign survey claims an original full-size beast across the opened seam', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const world = originalSeamWorld(), field = 'planet-cell:00143', wildCell = 'planet-cell:00041';
  await openForeignWorkspace(page, 'original-seam', 'canvas', false, false, 0, 'wilderness', false, null, null, world);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: field, name: 'Birch Survey Approach', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const map = world.generatedData.strategicMap, origin = World.cellSnapshot(map, World.cellIndex(field)), destination = World.cellSnapshot(map, World.cellIndex(wildCell));
  // Catalog fixture: this entrance is recorded before booking, in the original
  // globe's habitat. No debug actor, body resize, edited reserves, teleport or
  // runtime search for a nearby population is used during the trip.
  const candidates = [{ ...destination, slopePercent: .6, temperatureC: 17, approachArrival: { eastM: -42542.346, northM: -149822.258 } }];
  expect(await page.evaluate(({ source, carrier, origin, candidates }) => {
    const d = window.helixHeresyDebug, context = d.foreignSurveySnapshot().surveys.context;
    return d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })
      && d.setForeignWildernessTestSource({ origin, candidates, occupied: [], context });
  }, { source, carrier, origin, candidates })).toBe(true);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  expect(await act(page, 'enterWilderness')).toBe(true);
  const walk = s => page.evaluate(s => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(s), s);
  const completeWalk = async () => {
    for (let i = 0; i < 12; i++) {
      const s = await wild(page), task = s.tasks.find(t => !t.reason);
      if (!task) { expect(s.tasks).toHaveLength(0); return; }
      await walk(Math.max(1, task.dueAt - s.clock + 1));
    }
    throw Error('Survey walk did not finish');
  };
  await completeWalk();
  await page.waitForFunction(() => window.helixHeresyDebug.foreignWildernessSnapshot().site.beasts?.materialized, null, { timeout: 120000 });
  let w = await wild(page);
  const frame = w.site.discovery.baseline.populationFrame;
  expect(frame).toEqual({ eastM: -42543.346, northM: -149826.258 });
  const rootId = w.site.destination.id;
  expect(w.site.beasts.actors).toHaveLength(0); expect(w.site.extension).toBeUndefined();
  expect(await act(page, 'walkLocalEdge', { direction: 'east' })).toBe(true); await completeWalk();
  expect((await wild(page)).knowledge.sightings).toHaveLength(0);
  expect(await act(page, 'crossLocalConnection', { direction: 'east' })).toBe(true); await completeWalk();
  w = await wild(page); expect(w.site.extension.materialized).toBe(true);
  const seam = w.site.extension.bounds.x, [a] = w.site.beasts.actors;
  expect(w.site.beasts.actors).toHaveLength(1);
  expect(a).toMatchObject({ speciesId: 'beast:nullmaw-stalker', nativePopulation: { siteId: rootId, regionId: 'habitat:41:surface' } });
  expect(a.life.originalMemberId).toBe('natural-group:beast-population:nullmaw-stalker:01:2:males:0');
  expect(a.bodyPhysics.massKg).toBeGreaterThan(490);
  const body = Bodies.occupied(a, 1);
  expect(body.some(c => c.x < seam) && body.some(c => c.x >= seam)).toBe(true);
  for (const renderer of ['canvas', 'dom']) {
    const scene = await page.evaluate(({ id, name, renderer }) => {
      const d = window.helixHeresyDebug; d.setMapRenderer(renderer); d.setMapOverlay('prospecting');
      const observation = d.foreignWildernessSnapshot().knowledge.sightings.find(b => b.id === id);
      return { render: d.mapRendererSnapshot().mode, observation, shown: d.mapSceneSnapshot().cells.filter(c => c.overlay?.label?.includes(name)).map(c => c.cell) };
    }, { id: a.id, name: a.name, renderer });
    expect(scene.render).toBe(renderer); expect(scene.observation.current).toBe(true);
    expect(scene.shown.some(c => c.x < seam) && scene.shown.some(c => c.x >= seam)).toBe(true);
  }
  await reload(page); w = await wild(page);
  expect(w.site.beasts.actors).toEqual([a]);
  expect(w.site.discovery.baseline.populationFrame).toEqual(frame);
  expect(w.cell).toEqual(w.site.extension.entry); // Already at its west seam.
  expect(await act(page, 'crossLocalConnection', { direction: 'west' })).toBe(true); await completeWalk();
  expect(await act(page, 'withdraw')).toBe(true); await completeWalk();
  w = await wild(page); expect(w.site.beasts.actors).toHaveLength(0);
  expect(w.knowledge.sightings.find(s => s.id === a.id)?.current).toBe(false);
  expect(await act(page, 'enterWilderness')).toBe(true); await completeWalk();
  w = await wild(page); expect(w.site.discovery.baseline.populationFrame).toEqual(frame);
  expect(w.site.extension.materialized).toBe(true);
  expect(w.site.beasts.actors.every(b => b.life.originalMemberId === a.life.originalMemberId)).toBe(true);
  expect(w.site.beasts.actors.length).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
test('canvas foreign wilderness physically discovers, shelters, samples and withdraws without extending municipal rights or resetting original sites across real saves', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'foreign-wilderness', 'canvas', false, false, 0, 'wilderness');
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const original = state.resourceSurveys.context || { worldId: 'lifecycle-world', siteId: 'original-home-parcel', strategicCellId: 'planet-cell:00009', seed: 'home-fixture',
      truth: { potentialPermille: { ferrousOre: 700 }, typicalDepth: { ferrousOre: 'shallow' }, surfaceAccessibilityPermille: 800, environmentalDifficultyPermille: 0 } };
    if (!state.resourceSurveys.context) d.setResourceSurveyTestContext(original);
    if (!d.setForeignSurveyTestSource(source, carrier, { ...original, siteId: source.placeId, strategicCellId: source.cellId })) return false;
    return d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 20, temperatureC: -10, precipitationMm: 1200, biomeLabel: 'Cold forest' }], occupied: [], context: original });
  }, { source, carrier })).toBe(true);
  const before = await snap(page), home = before.surveys.context, homeNeeds = (await wild(page)).needs;
  expect(await act(page, 'enterWilderness')).toBe(false);
  expect(await act(page, 'quote')).toBe(true); expect(await act(page, 'accept', { expected: (await snap(page)).excursion.quote })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  const parked = await snap(page), driver = parked.excursion.carrier.driver, fuel = parked.excursion.carrier.vehicle.fuelKm;
  expect(parked.excursion.wilderness.discovery).toBeNull(); expect(parked.excursion.wilderness.materialized).toBe(false);
  expect(await act(page, 'enterWilderness')).toBe(true);
  expect((await wild(page)).site.discovery).toBeNull(); // Planning does not survey or populate the wild.
  await finish(page); let w = await wild(page), s = await snap(page);
  expect(w.roomId).toBe(w.site.roomId); expect(w.site.discovery.baseline.rocks.length).toBeGreaterThan(0);
  expect(w.site.discovery.records.length).toBeGreaterThan(0); expect(w.site.context.siteId).not.toBe(home.siteId);
  expect(s.surveys.context).toEqual(home); expect(w.needs.destination).toEqual(homeNeeds.destination);
  expect(s.excursion.carrier.driver.id).toBe(driver.id); expect(s.excursion.carrier.driver.roomId).toBe(s.excursion.roomId);
  expect(s.excursion.carrier.vehicle.fuelKm).toBe(fuel); expect(await act(page, 'board')).toBe(false);
  // Municipal expiry does not extend ground permission, nor prohibit an actual wilderness sample or paid return.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.permission.endsAt = s.clock - 1;
    s.wildernessSurvival.autoCare = false; d.importSurveyExpeditionTestState(s); });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('deployShelter'))).toBe(true); await finish(page);
  w = await wild(page); const shelter = w.site.shelter; expect(shelter).toBeTruthy(); expect(w.sheltered).toBe(true);
  const savedBaseline = w.site.discovery.baseline, savedRecords = w.site.discovery.records, exposure = w.needs.exposure;
  await reload(page); w = await wild(page); expect(w.site.shelter).toEqual(shelter); expect(w.site.discovery.baseline).toEqual(savedBaseline);
  expect(w.site.discovery.records).toEqual(savedRecords); expect(w.needs.exposure).toBeCloseTo(exposure);
  expect(await act(page, 'survey', { method: 'shallowCore', cell: w.cell })).toBe(true);
  let task = (await snap(page)).tasks.find(t => t.type === 'physicalDiagnostic'); expect(task.reason).toBe('');
  await advance(page, 20); const remaining = (await snap(page)).tasks.find(t => t.id === task.id).dueAt - (await snap(page)).clock;
  await reload(page); expect((await snap(page)).tasks.find(t => t.id === task.id).dueAt - (await snap(page)).clock).toBeCloseTo(remaining);
  await finish(page); s = await snap(page); const sample = s.diagnostics.samples.find(i => i.captured.resourceSurvey?.siteId === w.site.context.siteId);
  expect(sample).toBeTruthy(); expect(s.stacks.find(i => i.id === sample.stackId).carriedBy).toBe('scientist');
  expect(await act(page, 'withdraw')).toBe(true); await finish(page); s = await snap(page);
  expect(s.context.atFieldEntry).toBe(true); expect(await act(page, 'survey', { method: 'reconnaissance', cell: s.excursion.entry })).toBe(false);
  const oldBeasts = s.excursion.wilderness.beasts, oldShelter = s.excursion.wilderness.shelter;
  // Leave the surviving physical kit, then revisit without generating another kit, map or population.
  expect(await act(page, 'enterWilderness')).toBe(true); await finish(page); w = await wild(page);
  expect(w.site.discovery.baseline).toEqual(savedBaseline); expect(w.site.shelter).toEqual(oldShelter);
  expect(w.site.beasts.actors.map(a => a.id)).toEqual(oldBeasts.actors.map(a => a.id));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueWildernessShelter('packShelter'))).toBe(true); await finish(page);
  expect((await wild(page)).site.shelter).toBeNull();
  expect(await act(page, 'withdraw')).toBe(true); await finish(page);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  s = await snap(page); expect(s.excursion.phase).toBe('depot'); expect(s.surveys.context).toEqual(home);
  expect(s.passenger.vehicle.id).toBe(before.passenger.vehicle.id); expect(s.passenger.vehicle.fuelKm).toBe(before.passenger.vehicle.fuelKm);
  expect(s.excursion.carrier.vehicle.fuelKm).toBeCloseTo(195.5); expect(s.stacks.find(i => i.id === sample.stackId).carriedBy).toBe('scientist');
  expect(errors).toEqual([]);
});
