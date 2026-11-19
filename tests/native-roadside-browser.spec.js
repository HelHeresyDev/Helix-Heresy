const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library'), World = require('../strategic-world');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');

function originalWorld() {
  const w = Library.createWorld({ id: 'native-walking', worldSeed: 'native-encounters', createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = w.generatedData.strategicMap, catalog = JSON.parse(JSON.stringify(lifecycleWorld().generatedData.strategicMap.strategicStartingSites));
  delete catalog.digest;
  for (const c of catalog.scenarioRows[0].candidates) c.strategicCellId = World.cellId(map.surface.classes.indexOf('L'));
  catalog.digest = `strategic-starting-sites-${World.stableHash(catalog)}`;
  map.strategicStartingSites = catalog; map.publicStartingSiteDirectory = JSON.parse(JSON.stringify(catalog));
  return Library.createWorld({ ...w, generatedData: { ...w.generatedData, strategicMap: World.finalizeStrategicMap(map) } });
}

test('one real walking itinerary senses an original beast and saves a wounded return without a replacement', async ({ page }) => {
  test.setTimeout(360000);
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message)); page.on('dialog', d => d.accept());
  const world = originalWorld();
  await startLifecycleRun(page, 'native-roadside', world);
  const snap = () => page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
  const view = () => page.evaluate(() => window.helixHeresyDebug.regionalEncounterSnapshot());
  const act = action => page.evaluate(a => window.helixHeresyDebug.overlandAction(a), action);
  const advance = seconds => page.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), seconds);
  const ready = () => expect(page.locator('#pauseReadout')).not.toContainText('habitat history', { timeout: 120000 });
  const finish = async () => {
    for (let i = 0; i < 12; i++) {
      const s = await snap(page); if (!s.tasks.length) return;
      expect(s.tasks[0].reason).toBe(''); await advance(Math.max(1, s.tasks[0].dueAt - s.clock + 1));
    }
    throw Error('Original physical walking task did not finish');
  };
  const depart = async () => { expect(await act('depart')).toBe(true); await finish(); await ready(); };
  const reload = async () => { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await ready(); };
  await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.setMapRenderer('canvas');
    // A recorded route before departure, not a chosen spawn or an edited body.
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00041', supportComponentId: 'one', known: true,
        localDistanceKm: .08, routeContinuity: 'municipal', walkingAnchor: { eastM: -42552, northM: -149825 } },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00143', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'native-walking', siteId: 'road-test', strategicCellId: 'planet-cell:00041', seed: 'route-test', publicProspects: {}, truth: {} } });
  });
  await depart(); await advance(4);
  expect((await snap()).saved.trip.status).toBe('walking'); expect((await view()).knowledge.sightings).toEqual([]);
  expect((await snap()).stops?.sites || []).toHaveLength(0);
  await advance(60);
  let s = await snap(), seen = await view();
  expect(s.saved.trip.status).toBe('stopped'); expect(s.saved.trip.reason).toContain('noticing a beast');
  expect(s.saved.trip.positionKm).toBeLessThan(.024); expect(s.saved.trip.positionKm).toBeGreaterThan(.01);
  const a = s.stop.beasts.actors[0];
  expect(a.life.originalMemberId).toBe('natural-group:beast-population:nullmaw-stalker:01:2:males:0');
  expect(a.nativePopulation.regionId).toBe('habitat:41:surface');
  expect(seen.ledger.beasts.actors).toHaveLength(0); expect(seen.knowledge.sightings[0]).toMatchObject({ id: a.id, current: true });
  expect(await page.evaluate(id => window.helixHeresyDebug.woundNativeBeastForTest(id), a.id)).toBe(true);
  await advance(1); const wounded = (await snap()).stop.beasts.actors[0];
  expect(wounded.health).toBeLessThan(a.health);
  await reload();
  expect((await snap()).stop.beasts.actors[0]).toMatchObject({ id: a.id, health: wounded.health });
  expect(await act('reverse')).toBe(true); expect(await act('resume')).toBe(true); await finish();
  expect((await snap()).stops.sites.every(p => !p.beasts?.actors.length)).toBe(true);
  seen = await view(); expect(seen.knowledge.sightings.every(p => !p.current)).toBe(true);
  await advance(60); expect((await snap()).saved.trip.status).toBe('arrived');
  await reload(); await depart(); await advance(60);
  s = await snap(); expect(s.saved.trip.status).toBe('stopped');
  expect(s.stops.sites.flatMap(p => p.beasts?.actors || [])).toHaveLength(1);
  const returned = s.stop.beasts.actors[0]; expect(returned.id).toBe(a.id);
  expect(returned.health).toBeCloseTo(wounded.health, 6);
  expect(errors).toEqual([]);
});
