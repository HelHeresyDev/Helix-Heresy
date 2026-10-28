const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { prepareHome } = require('./helpers/multi-city-home');
const { fixture } = require('./helpers/regional-suppression-source');
const M = require('../municipal-supply-threats');
const Population = require('../regional-suppression');
test.setTimeout(900000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.municipalSupplySnapshot());
const tick = (p, seconds) => p.evaluate(seconds => window.helixHeresyDebug.advanceCityProvisioningForTest(seconds, true), seconds);
async function finish(page, field = false) {
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot()), task = s.tasks.find(t => !t.reason);
    if (!task) return;
    await page.evaluate(({ n, field }) => { const d = window.helixHeresyDebug;
      return field ? d.advanceOverlandForTest(n) : d.advanceForeignReceptionTestTime(n);
    }, { n: Math.max(1, task.dueAt - s.clock + 1), field });
  }
  throw new Error('Original physical movement unfinished');
}
async function learnAndReach(page, route) {
  await page.evaluate(route => {
    const d = window.helixHeresyDebug;
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 3000, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-carrier:a', publicName: 'Original Carrier', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [route], destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00001' },
        ...['a', 'b'].map((id, i) => ({ id: `city:${id}`, cityId: id, label: `City ${id}`, kind: 'fortifiedCity', known: true,
          jurisdiction: { kind: 'city', cityId: id }, supportComponentId: 'one', cellId: `planet-cell:0000${i ? 3 : 1}` })) ] } });
    // Prepared personal capability, not a contact, casualty or victory outcome.
    const s = d.exportSurveyExpeditionTestState(); s.scientist.vitals.mana = { current: 10000, max: 10000 };
    s.scientist.vitals.health = { current: 10000, max: 10000 }; d.importSurveyExpeditionTestState(s);
  }, route);
  for (let trip = 0; trip < 2; trip++) {
    expect(await page.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
    await page.evaluate(() => { const d = window.helixHeresyDebug, t = d.intercityPassengerSnapshot().carrier.trip;
      d.advanceForeignReceptionTestTime(Math.ceil(t.seconds - t.progressSeconds + t.delaySeconds + 1)); });
    expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
    console.log(`supply: personally completed commercial itinerary leg ${trip + 1}`);
  }
  const plans = await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans);
  expect(plans).toHaveLength(1);
  expect(await page.evaluate(id => window.helixHeresyDebug.intercityMarchAction('depart', id), plans[0].id)).toBe(true); await finish(page, true);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(8000));
}
for (const renderer of ['dom', 'canvas']) for (const elk of [false, true]) test(`${renderer}: original grain carrier physically meets conserved ${elk ? 'territorial elk' : 'animals'}; reload and reports retain unseen uncertainty`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `supply-contact-${renderer}`);
  await prepareHome(page, renderer, { sustain: false, farm: { distanceKm: .11, satelliteCellId: 'planet-cell:00004',
    routeCellIds: ['planet-cell:00004', 'planet-cell:00002', 'planet-cell:00001'] } });
  console.log(`supply: ${renderer} real home handover ready`);
  const f = fixture(elk ? 5 : 10, .01, elk ? Population.ELK : Population.SPECIES, { crossingOnly: elk }), before = await snap(page);
  f.route.distanceKm = 1;
  f.geometry.distance = (a, b) => a === 'planet-cell:00004' || b === 'planet-cell:00004' ? .01
    : a === 'planet-cell:00003' || b === 'planet-cell:00003' ? .9 : .1;
  const links = M.sources(f.map, before.saved.source, f.geometry, [f.route]);
  expect(links).toHaveLength(1);
  expect(await page.evaluate(links => window.helixHeresyDebug.configureMunicipalSupplyTest(links), links)).toBe(true);
  const original = await snap(page), ids = original.region.beasts.actors.map(a => a.id);
  if (elk) {
    expect(f.map.beastEcology.waveProfiles).toEqual([]);
    expect(original.region.beasts.actors.every(a => a.speciesId === Population.ELK && a.health === 60)).toBe(true);
    expect(original.saved.supplyTrafficCheckedSpecies).toEqual(Population.SUPPORTED_SPECIES);
  }
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug;
    if (!d.cityProvisioningAction('inspect')) return false;
    return d.cityProvisioningAction('dispatch', d.cityProvisioningSnapshot().saved.quote);
  })).toBe(true);
  // Local civic clock, but the driver uses real navigation, shared journeys,
  // original population travel and shared combat; there is no incident roll.
  let s;
  for (let n = 0; n < 15; n++) { await tick(page, 20); s = await snap(page); if (s.saved.roadContactId) break; }
  expect(s.saved.roadContactId, JSON.stringify(s.saved.order)).toBeTruthy();
  console.log(`supply: ${renderer} original carrier physically intercepted`);
  expect(s.saved.driver.roomId).toMatch(/^roadsideStop-/);
  expect(s.saved.vehicle.roomId).toBe(s.saved.driver.roomId);
  const contact = s.saved.supplyTraffic.encounters[0];
  const meter = s.saved.order.meterKm, cargo = s.saved.vehicle.cargoKg;
  expect(s.records).toEqual([]); expect(s.saved.report.receipts).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('observe'))).toBe(false);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snap(page); expect(s.saved.roadContactId).toBe(contact.id); expect(s.saved.order.meterKm).toBe(meter);
  expect(s.region.beasts.actors.map(a => a.id)).toEqual(ids);
  await tick(page, 160); s = await snap(page);
  expect(s.saved.vehicle.condition).toBeLessThan(50);
  expect(s.saved.order.meterKm).toBe(meter); expect(s.saved.order.deliveredKg).toBe(0);
  expect(s.saved.vehicle.cargoKg).toBe(cargo);
  expect(s.saved.supplyTraffic.encounters[0].contacts.some(c => c.vehicleDamage > 0)).toBe(true);
  expect(s.saved.driver.id).toBe(original.saved.driver.id); expect(s.saved.vehicle.id).toBe(original.saved.vehicle.id);
  expect(s.records).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('report'))).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
  const report = (await snap(page)).saved.report;
  expect(report.instruction.receivedKg).toBe(0); expect(report.receipts).toEqual([]);
  expect(JSON.stringify(report)).not.toMatch(/SECRET_POPULATION|Rimefang|wrecked|dead|killed|driverDamage|vehicleDamage/i);
  expect(s.saved.stores.cityKg).toBeLessThan(original.saved.stores.cityKg);
  await learnAndReach(page, f.route);
  const local = await page.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
  expect(local.roomId).toBe(s.saved.vehicle.roomId);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2)); // Ordinary whole-game heartbeat too.
  expect(await page.evaluate(() => window.helixHeresyDebug.cityProvisioningAction('observe'))).toBe(true);
  s = await snap(page); expect(s.records.length).toBeGreaterThan(0);
  expect(s.records[0].text).toMatch(/truck|driver/); expect(JSON.stringify(s.records)).not.toContain('SECRET_POPULATION');
  const beforeCombat = s.region.beasts.actors.map(a => a.health);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, k = d.regionalEncounterSnapshot().knowledge;
    const target = k.sightings.find(a => a.current && d.wildernessBeastActionReason('soulLash', a.id) === '');
    return target && d.startScientistCombatAction('soulLash', target.id);
  })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(2));
  s = await snap(page); expect(s.region.beasts.actors.some((a, i) => a.health < beforeCombat[i])).toBe(true);
  if (elk) {
    for (let hit = 0; hit < 40; hit++) {
      const result = await page.evaluate(() => {
        const d = window.helixHeresyDebug, s = d.municipalSupplySnapshot(), k = d.regionalEncounterSnapshot().knowledge;
        const capable = s.region.beasts.actors.filter(a => a.status !== 'dead' && a.health >= a.maxHealth * .3);
        if (!capable.length) return 'resolved';
        const target = capable.find(a => k.sightings.some(o => o.id === a.id && o.current) && d.wildernessBeastActionReason('soulLash', a.id) === '');
        return target && d.startScientistCombatAction('soulLash', target.id) ? 'acted' : 'blocked';
      });
      if (result === 'resolved') break;
      expect(result, JSON.stringify((await snap(page)).region.beasts.actors)).toBe('acted');
      await page.evaluate(() => window.helixHeresyDebug.advanceOverlandForTest(2));
    }
    await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));
    s = await snap(page);
    expect(s.region.beasts.actors.every(a => a.status === 'dead' || a.health < a.maxHealth * .3)).toBe(true);
    expect(s.region.beasts.actors.some(a => a.status === 'alive')).toBe(true);
    expect(s.population.populations[0].strategicAssessment.incapable).toBe(true);
    expect(s.region.beasts.actors.map(a => a.id)).toEqual(ids);
  }
  const knowledge = s.records;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); s = await snap(page);
  expect(s.records).toEqual(knowledge); expect(s.region.beasts.actors.map(a => a.id)).toEqual(ids);
  if (elk && renderer === 'dom') {
    const bodies = s.region.beasts.actors, run = s.population.runId;
    const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
    await page.locator('#newRunBtn').click();
    await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-original-elk.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 });
    s = await snap(page); expect(s.population.runId).not.toBe(run); expect(s.region.beasts.actors).toEqual(bodies); expect(s.records).toEqual(knowledge);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
  if (elk) {
    const frozen = (await snap(page)).population;
    await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
    expect((await snap(page)).population).toEqual(frozen);
    if (renderer === 'dom') {
      await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
      await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
      await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
      expect((await snap(page)).population).toBeNull(); expect((await snap(page)).records).toEqual([]);
    }
  }
});
