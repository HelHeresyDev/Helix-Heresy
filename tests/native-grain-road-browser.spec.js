const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library'), World = require('../strategic-world');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');

function originalWorld() {
  const w = Library.createWorld({ id: 'lifecycle-world', worldSeed: 'native-encounters', createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = w.generatedData.strategicMap, catalog = JSON.parse(JSON.stringify(lifecycleWorld().generatedData.strategicMap.strategicStartingSites));
  delete catalog.digest;
  for (const c of catalog.scenarioRows[0].candidates) c.strategicCellId = World.cellId(map.surface.classes.indexOf('L'));
  catalog.digest = `strategic-starting-sites-${World.stableHash(catalog)}`;
  map.strategicStartingSites = catalog; map.publicStartingSiteDirectory = JSON.parse(JSON.stringify(catalog));
  return Library.createWorld({ ...w, generatedData: { ...w.generatedData, strategicMap: World.finalizeStrategicMap(map) } });
}

test('original grain driver passes a sighting, holds for a native body and reports only on actual return', async ({ page }) => {
  test.setTimeout(540000);
  const errors = []; page.on('pageerror', e => errors.push(e.stack || e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, 'native-grain-road', originalWorld());
  const ground = 'planet-cell:00041', city = 'planet-cell:00143', farm = 'planet-cell:00144';
  await prepareHome(page, 'canvas', { sustain: false, farm: { distanceKm: 1.2, cityCellId: city, satelliteCellId: farm,
    routeCellIds: [farm, ground, city], nativeRoad: { cellId: ground, eastM: -42560, northM: -149824 } } });
  const snap = () => page.evaluate(() => window.helixHeresyDebug.municipalSupplySnapshot());
  const tick = seconds => page.evaluate(n => window.helixHeresyDebug.advanceCityProvisioningForTest(n, true), seconds);
  const action = name => page.evaluate(name => window.helixHeresyDebug.cityProvisioningAction(name), name);
  const ready = () => expect(page.locator('#pauseReadout')).not.toContainText('habitat history', { timeout: 120000 });
  const original = (await snap()).saved;
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug;
    return d.cityProvisioningAction('inspect') && d.cityProvisioningAction('dispatch', d.cityProvisioningSnapshot().saved.quote);
  })).toBe(true);
  await ready();
  let s;
  for (let i = 0; i < 42; i++) {
    await tick(s?.saved.order?.meterKm > .45 ? 5 : 30); s = await snap();
    if (s.saved.roadContactId) break;
    const j = s.saved.network.journeys.find(j => j.id === s.saved.order?.journeyId);
    if (j?.status === 'stranded') expect(await action('recover')).toBe(true);
  }
  const e = s.saved.nativeRoadContact;
  expect(e, JSON.stringify({ order: s.saved.order, sites: s.sites.map(p => p.id) })).toBeTruthy();
  expect(s.saved.order.encounterReports[0].description).toMatch(/noticed.*continued/);
  expect(s.records).toEqual([]); expect(s.saved.report.receipts).toEqual([]);
  let site = s.sites.find(p => p.id === e.siteId);
  const [animal] = site.beasts.actors;
  expect(animal.life.originalMemberId).toBe('natural-group:beast-population:nullmaw-stalker:01:2:males:0');
  expect(s.region.beasts.actors).toHaveLength(0); expect(site.carrierOnly).toBe(true);
  const meter = s.saved.order.meterKm, cargo = s.saved.vehicle.cargoKg;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await ready();
  s = await snap(); expect(s.saved.nativeRoadContact.id).toBe(e.id);
  expect(s.saved.order.meterKm).toBe(meter); expect(s.saved.vehicle.cargoKg).toBe(cargo);
  expect(s.sites.find(p => p.id === e.siteId).beasts.actors[0].id).toBe(animal.id);
  expect(await action('report')).toBe(true);
  expect((await snap()).records).toEqual([]);
  // A neutral body actually rests and walks clear; no remote departure,
  // substituted truck, staged casualty or granted lane clearance is used.
  for (let i = 0; i < 48 && s.saved.order; i++) {
    await tick(s.saved.roadContactId ? 90 : 180); s = await snap();
    if (s.saved.network.journeys.find(j => j.id === s.saved.order?.journeyId)?.status === 'stranded') expect(await action('recover')).toBe(true);
  }
  expect(s.saved.order, JSON.stringify({ reason: s.saved.order?.reason, contact: s.saved.nativeRoadContact,
    actors: s.sites.flatMap(p => p.beasts?.actors || []).map(a => ({ cell: a.mapCell, activity: a.life.activity,
      stamina: a.bodyPhysics.stamina, turn: a.bodyPhysics.turn, motion: a.bodyPhysics.motion,
      stores: a.life.stores, health: a.health, blocked: a.bodyPhysics.blockedReason })) })).toBeNull();
  expect(s.saved.driver.id).toBe(original.driver.id); expect(s.saved.vehicle.id).toBe(original.vehicle.id);
  expect(s.saved.receipts[0].deliveredKg).toBeGreaterThan(0); expect(s.saved.receipts[0].deliveredKg).toBe(s.saved.receipts[0].loadedKg);
  expect(s.records).toEqual([]);
  expect(await action('report')).toBe(true); s = await snap();
  expect(s.records.some(r => /held for.*cleared/.test(r.text))).toBe(true);
  expect(JSON.stringify(s.records)).not.toContain(animal.id);
  const received = s.records;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snap()).records).toEqual(received);
  expect(errors).toEqual([]);
});
