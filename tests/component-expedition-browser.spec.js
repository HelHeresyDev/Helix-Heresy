const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const Library = require('../world-run-library');
const World = require('../strategic-world');
test.setTimeout(300000);
function physicalWorld() {
  const base = lifecycleWorld();
  const fine = Library.createWorld({ id: base.id, worldSeed: base.worldSeed, worldTheme: 'madcap', generationVersion: 6,
    creationSettings: { strategicMap: { refinementLevel: 4 } } });
  const map = fine.generatedData.strategicMap, i = map.surface.classes.indexOf('L');
  const nearest = World.topologyForMap(map).vertices.map((_, j) => ({ j, km: World.greatCircleDistanceKm(map, i, j) }))
    .filter(r => r.km > 1 && map.surface.classes[r.j] === 'L').sort((a, b) => a.km - b.km)[0];
  const catalog = JSON.parse(JSON.stringify(base.generatedData.strategicMap.strategicStartingSites)); delete catalog.digest;
  for (const c of catalog.scenarioRows[0].candidates) c.strategicCellId = World.cellId(i);
  catalog.digest = `strategic-starting-sites-${World.stableHash(catalog)}`;
  map.strategicStartingSites = catalog; map.publicStartingSiteDirectory = JSON.parse(JSON.stringify(catalog));
  return { world: Library.createWorld({ ...fine, generatedData: { ...fine.generatedData, strategicMap: World.finalizeStrategicMap(map) } }),
    originCell: World.cellId(i), remoteCell: World.cellId(nearest.j), km: nearest.km };
}
const physical = physicalWorld();
const snap = p => p.evaluate(() => window.helixHeresyDebug.componentExpeditionSnapshot());
const advance = (p, seconds) => p.evaluate(seconds => window.helixHeresyDebug.advanceCityApproachForTest(seconds, { render: true }), seconds);
async function setup(p, renderer) {
  p.on('dialog', d => d.accept());
  await startLifecycleRun(p, `component-expedition-${renderer}`, physical.world);
  await p.evaluate(({ renderer, originCell, remoteCell }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', cityId: 'a', kind: 'laboratorySite', label: 'Lab', cellId: originCell, known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      ...[['a', 'Aster', originCell, 'one'], ['b', 'Beryl', remoteCell, 'two']].map(([id, label, cellId, supportComponentId]) => ({
        id: `city:${id}`, cityId: id, label, cellId, supportComponentId, kind: 'fortifiedCity', known: true, jurisdiction: { kind: 'city', cityId: id } }))
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: originCell, seed: 'expedition', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ municipal: true, carry: ['drinkingWater', 'trailMeal', 'satelliteCommunicator'] });
    if (!d.configureComponentExpeditionTest({ source: { originCityId: 'a', destinationCityId: 'b', cargo: [{ section: 'resources', key: 'metalParts', quantity: 2 }], reception: {
      cityId: 'b', currentPopulation: 50000, physicalCondition: 'intact', currentAuthority: true, administrationId: 'beryl-administration',
      administrationName: 'Beryl Administration', watchId: 'beryl-watch', lawId: 'beryl-law', capacityBand: 'functional', localRules: [] } } })) throw new Error('Prepared original source unavailable');
  }, { renderer, ...physical });
  await p.locator('[data-workspace-tab="visits"]').click();
}
async function launch(p) {
  const initial = await snap(p); const provider = initial.providers.find(p => p.pad.cityId === 'a');
  expect(provider).toBeTruthy(); expect(initial.trip).toBeNull(); expect(initial.carried.some(s => s.key === 'metalParts' && s.quantity === 2)).toBe(true);
  expect(provider.originalOwner).toMatchObject({ kind: 'independentContact', ownerId: provider.contactId,
    employerId: provider.contactId, aircraftId: provider.aircraft.id, pilotId: provider.pilot.id });
  await p.getByRole('button', { name: 'Request Receiving Instructions: Beryl', exact: true }).first().click();
  expect((await snap(p)).trip.status).toBe('requested'); await advance(p, 120);
  let s = await snap(p); expect(s.trip.status, s.trip.reason).toBe('offered');
  expect(s.trip.component.charter.ownerId).toBe(provider.contactId);
  expect(s.public.charter.scope).toBe('namedCivilianRoundTrip');
  await expect(p.locator('[data-component-expedition]')).toContainText('not land title, military passage');
  expect(s.trip.distanceKm).toBeCloseTo(physical.km, 7);
  await expect(p.locator('[data-component-expedition]')).toContainText('not their hoarded terrain maps');
  await p.getByRole('button', { name: 'Accept Cross-Network Round Trip', exact: true }).click();
  s = await snap(p); expect(s.trip.status).toBe('preparing'); expect(s.money).toBe(initial.money - s.trip.payment.amount);
  await advance(p, 300); expect((await snap(p)).trip.status).toBe('boarding');
  await p.getByRole('button', { name: 'Walk to Original Aircraft and Board Expedition', exact: true }).click();
  await advance(p, 60); s = await snap(p);
  expect(s.trip.status, JSON.stringify(s.tasks)).toBe('outbound'); expect(s.roomId).toBe('castawayPickupCabin');
  expect(s.provider.aircraft.id).toBe(provider.aircraft.id); expect(s.provider.pilot.id).toBe(provider.pilot.id);
  const cargo = s.carried.map(s => s.id);
  await advance(p, s.trip.nextAt - s.clock + 30); s = await snap(p);
  expect(s.trip.status).toBe('checkpoint'); expect(s.roomId).toBe(s.gate.checkpointRoomId);
  expect(s.context.local).toBe(true); expect(s.trip.decisions).toEqual([]);
  expect(s.provider.aircraft.fuelKm).toBeCloseTo(provider.aircraft.fuelKm - physical.km);
  const owners = await p.evaluate(() => window.helixHeresyDebug.exceptionalReachSnapshot());
  expect(owners.providers.find(v => v.providerId === provider.id)).toMatchObject({ state: 'independentOriginalProvider',
    originalOwner: { ownerId: provider.contactId } });
  expect(owners.strategicComplete).toBe(false);
  expect(s.carried.map(s => s.id)).toEqual(cargo);
  expect(s.maps.rooms[s.gate.checkpointRoomId]).toBeTruthy();
  return { initial, provider, cargo };
}
test('DOM: actual spherical cross-network flight, independent visitor review, persistent cargo and paid return', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'dom'); const worldBefore = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const { initial, provider, cargo } = await launch(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacyAction('review'))).toBe(true);
  const receivedCharter = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().public.review.evidence.find(e => e.account?.scope === 'The named independent aircraft, pilot and civilian round trip'));
  expect(receivedCharter).toBeTruthy(); expect(receivedCharter.account.limits).toContain('No military passage');
  expect(receivedCharter.status).toBe('unverified');
  await expect(page.locator('[data-foreign-reception]')).toBeVisible();
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCityApproachWork('inspect', {}, { confirmed: true }))).toBe(false);
  await page.getByRole('button', { name: 'Walk to Foreign Reception Desk', exact: true }).click(); await advance(page, 60);
  await page.getByRole('button', { name: 'Pay $40 for Visitor Review and Scoped Identity Verification', exact: true }).click(); await advance(page, 180);
  let visitor = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot());
  expect(visitor.gate.visitorAdmission.decisions.at(-1).status).toBe('pending'); expect(visitor.permission).toBeNull();
  const beforeImport = await snap(page);
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-expedition.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
  await page.locator('[data-workspace-tab="visits"]').click();
  const imported = await snap(page);
  expect(imported.binding.runId).not.toBe(beforeImport.binding.runId); expect(imported.trip.component.runId).toBe(imported.binding.runId);
  expect(imported.trip.component.worldId).toBe(imported.binding.worldId); expect(imported.provider).toEqual(beforeImport.provider);
  expect(imported.gate.visitorAdmission.decisions).toEqual(visitor.gate.visitorAdmission.decisions);
  expect(imported.trip.component.charter).toEqual(beforeImport.trip.component.charter);
  expect(await page.evaluate(id => window.helixHeresyDebug.supremacySnapshot().public.review.evidence.find(e => e.id === id), receivedCharter.id)).toEqual(receivedCharter);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  let s = await snap(page); expect(s.roomId).toBe(s.gate.checkpointRoomId); expect(s.carried.map(s => s.id)).toEqual(cargo);
  await page.getByRole('button', { name: 'Walk to Aircraft and Return to Departure Apron', exact: true }).click();
  await advance(page, 60); s = await snap(page); expect(s.trip.status, JSON.stringify(s.tasks)).toBe('inbound');
  await advance(page, s.trip.nextAt - s.clock + 30); s = await snap(page);
  expect(s.trip.status).toBe('returned'); expect(s.roomId).toBe('supportedSurveyGround');
  expect(s.cell).toEqual(s.trip.component.origin.cell); expect(s.fieldContext.siteId).toBe(initial.fieldContext.siteId);
  expect(s.provider.aircraft.id).toBe(provider.aircraft.id); expect(s.provider.aircraft.fuelKm).toBeCloseTo(provider.aircraft.fuelKm - 2 * physical.km);
  expect(s.provider.dutySeconds).toBeLessThan(provider.dutySeconds); expect(s.provider.aircraft.readyAt).toBeGreaterThan(s.clock);
  expect(s.carried.map(s => s.id)).toEqual(cargo); expect(s.providers.length).toBe(initial.providers.length);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(worldBefore);
  expect(errors).toEqual([]);
});
test('Canvas: missed finite return leaves living scientist and dated knowledge, reload and death freeze originals', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, 'canvas'); await launch(page); let s = await snap(page);
  await advance(page, s.trip.component.returnDeadline - s.clock); s = await snap(page);
  expect(s.trip.status).toBe('departingEmpty'); expect(s.roomId).toBe(s.gate.checkpointRoomId); expect(s.health).toBeGreaterThan(0);
  const received = s.public, fuel = s.provider.aircraft.fuelKm;
  await advance(page, s.trip.nextAt - s.clock); s = await snap(page);
  expect(s.trip.status).toBe('settled'); expect(s.public).toEqual(received); expect(s.provider.aircraft.fuelKm).toBe(fuel);
  expect(s.roomId).toBe(s.gate.checkpointRoomId); expect(s.trip.returningIds).toEqual([]);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).public).toEqual(received);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCityApproachWork('returnBoard', {}, { confirmed: true }))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureComponentExpeditionTest({ killScientist: true }));
  const dead = await snap(page); await advance(page, 600); const frozen = await snap(page);
  expect(frozen.provider).toEqual(dead.provider); expect(frozen.trip).toEqual(dead.trip); expect(frozen.gate.powerSeconds).toBe(dead.gate.powerSeconds);
  expect(frozen.runEnded).toBeTruthy();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check();
  await page.locator('#startRunSubmitBtn').click(); await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  const fresh = await snap(page); expect(fresh.binding.worldId).toBe(frozen.binding.worldId); expect(fresh.binding.runId).not.toBe(frozen.binding.runId);
  expect(fresh.trip).toBeNull(); expect(fresh.providers).toEqual([]); expect(fresh.public).toBeNull();
  expect(errors).toEqual([]);
});
