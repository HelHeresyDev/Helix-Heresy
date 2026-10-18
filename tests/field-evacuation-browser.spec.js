const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldCharterSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldCharterForTest(n), n);
const action = (page, a, id = '') => page.evaluate(([a, id]) => window.helixHeresyDebug.fieldCharterAction(a, id), [a, id]);
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); }
async function walk(page, roomId, cell) {
  expect(await page.evaluate(([roomId, cell]) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), [roomId, cell])).toBe(true);
  for (let i = 0; i < 30; i++) { const s = await snap(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason).toBe(''); await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1)); }
  throw Error('Actual walk unfinished');
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `evacuation-${renderer}`);
  const site = await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'evacuation', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ municipal: true, carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false });
    const ledger = d.configureRegionalEncounterTest([], 'evacuation-empty'), s = d.exportSurveyExpeditionTestState();
    // Explicit short published approach and previously purchased carried
    // equipment fixtures. Acceptance itself must never supply this equipment.
    s.surveyExpeditions.destination.localDistanceKm = .1;
    const water = s.physicalItemStacks.find(i => i.carriedBy === 'scientist' && i.key === 'drinkingWater');
    s.physicalItemStacks.push({ ...water, id: 'brought-stretcher', key: 'foldingStretcher', quantity: 1, knownQuantity: 1,
      unitMassKg: 7, unitVolumeL: 12, sourceLabels: ['Explicit previously purchased carried equipment fixture'] });
    d.importSurveyExpeditionTestState(s);
    const route = d.overlandSnapshot().route, current = d.exportSurveyExpeditionTestState();
    const old = window.HelixRoadsideStops.ensure(null, { worldId: ledger.worldId, runId: ledger.runId }, route.id, .1, s.clock, 31, { temperatureC: 18 });
    current.roadsideStops = old.state; d.importSurveyExpeditionTestState(current); return old.site;
  }, renderer);
  let s = await snap(page);
  await walk(page, 'supportedSurveyGround', { ...s.escort.actor.mapCell, x: s.escort.actor.mapCell.x - 1 });
  expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.setFieldCharterTestSource({
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'population:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster works', capacityBand: 'functional' }] }] }
  }))).toBe(true);
  expect(await action(page, 'review', site.id)).toBe(true); expect(await action(page, 'accept', site.id)).toBe(true);
  await advance(page, 100); s = await snap(page); expect(s.saved.phase).toBe('boarding');
  expect(await action(page, 'walk')).toBe(true);
  for (let i = 0; i < 20 && (await snap(page)).tasks.length; i++) await advance(page, 10);
  expect(await action(page, 'boardEscort')).toBe(true); await advance(page, 12); expect(await action(page, 'board')).toBe(true);
  expect(await action(page, 'depart')).toBe(true); await advance(page, 200); s = await snap(page);
  expect(s.saved.phase).toBe('onsite'); expect(s.saved.boarded).toEqual([]);
  return { site, errors, escortId: s.escort.actor.id,
    world: await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world')) };
}
async function wound(page, patient) {
  await page.evaluate(patient => {
    const d = window.helixHeresyDebug; d.configureEscortTest(patient === 'scientist' ? { scientistHealth: 5, order: 'hold' } : { health: 5, order: 'hold' });
    const s = d.exportSurveyExpeditionTestState(), id = patient === 'scientist' ? 'scientist' : s.expeditionEscorts.actor.id;
    s.injuries.push({ id: 'original-field-wound', actorId: id, actorKind: patient === 'scientist' ? 'scientist' : 'expeditionEscort',
      typeId: 'bruising', severityId: 'minor', location: 'left leg', status: 'active', createdAt: s.clock, nextProgressAt: s.clock + 3600 });
    d.importSurveyExpeditionTestState(s);
  }, patient);
}
async function until(page, predicate, limit = 24) {
  let blocked = '';
  for (let i = 0; i < limit; i++) { const s = await snap(page); if (predicate(s)) return s;
    if (s.saved.evacuation?.reason === 'Casualty route is physically blocked.') {
      const current = JSON.stringify([s.cell, s.escort.actor.mapCell]);
      if (current === blocked) throw Error(`Fixed test ground is blocked: ${JSON.stringify(s.saved)}`);
      blocked = current;
    } else blocked = '';
    if (i % 6 === 0) console.info('Evacuation checkpoint', JSON.stringify({ phase: s.saved.phase, e: s.saved.evacuation, scientist: s.cell, escort: s.escort.actor.mapCell }));
    await advance(page, 10); }
  throw Error(`Evacuation did not reach checkpoint: ${JSON.stringify((await snap(page)).saved)}`);
}
test('Canvas original escort autonomously stabilizes, drags, secures and returns incapacitated scientist; saved handover uses one finite clinic', async ({ page }) => {
  const { site, errors, escortId, world } = await setup(page, 'canvas');
  let s = await snap(page); await walk(page, site.roomId, { ...s.cell, x: s.cell.x + 3 }); await advance(page, 8);
  const before = await snap(page), bandages = before.stacks.filter(i => i.carriedBy === escortId && i.key === 'medicalBandage').reduce((n, i) => n + i.quantity, 0);
  await wound(page, 'scientist'); await advance(page, 2);
  s = await until(page, s => s.saved.evacuation?.phase === 'aid' && s.saved.evacuation.work);
  expect(s.roomId).toBe(site.roomId); const aid = s.saved.evacuation;
  await reload(page); expect((await snap(page)).saved.evacuation).toEqual(aid);
  await advance(page, 50); s = await snap(page);
  expect(s.stacks.filter(i => i.carriedBy === escortId && i.key === 'medicalBandage').reduce((n, i) => n + i.quantity, 0)).toBe(bandages - 1);
  s = await until(page, s => s.saved.evacuation?.phase === 'load' && s.saved.evacuation.work);
  await reload(page); const loadedFrom = await snap(page); expect(loadedFrom.saved.boarded).toEqual([]);
  await advance(page, 35); s = await snap(page); expect(s.saved.evacuation.secured).toBe(true); expect(s.saved.boarded).toHaveLength(2);
  expect(s.saved.vehicle.passengerSeats).toBe(2); expect(await action(page, 'return')).toBe(false); // not a conscious scientist order
  s = await until(page, s => s.saved.phase === 'unloading'); expect(s.saved.evacuation.phase).toBe('unload');
  await advance(page, 10); const unloading = (await snap(page)).saved.evacuation; await reload(page);
  expect((await snap(page)).saved.evacuation).toEqual(unloading);
  s = await until(page, s => s.saved.evacuation?.phase === 'handedOver');
  const clinic = await page.evaluate(() => window.helixHeresyDebug.clinicSnapshot());
  expect(clinic.stay).toMatchObject({ patientId: 'scientist', charterId: s.saved.booking.id, emergency: false });
  expect(clinic.stay.escrow).toBe(180); expect(s.saved.careEscrow).toBe(0); expect(clinic.health).toBe(5);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(120)); const examined = await page.evaluate(() => window.helixHeresyDebug.clinicSnapshot());
  expect(examined.stay.assessment, examined.stay.reason).not.toBeNull();
  expect(examined.stay.assessment.personId).toBe('scientist'); expect(examined.debt).toBe(0); expect(examined.health).toBe(5);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
test('DOM original escort casualty cannot load without brought equipment; unavailable clinic retains waiting patient and death freezes assistance', async ({ page }) => {
  const { errors, escortId } = await setup(page, 'dom');
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const i = s.physicalItemStacks.find(i => i.id === 'brought-stretcher'); i.carriedBy = ''; i.roomId = s.scientist.roomId; i.cell = { ...s.scientist.mapCell, x: s.scientist.mapCell.x + 3 }; d.importSurveyExpeditionTestState(s); });
  await wound(page, 'escort'); let s = await until(page, s => s.saved.evacuation?.phase === 'load');
  await advance(page, 40); s = await snap(page); expect(s.saved.boarded).toEqual([]); expect(s.saved.evacuation.reason).toContain('stretcher');
  const originalCell = s.escort.actor.mapCell; await reload(page); expect((await snap(page)).escort.actor.mapCell).toEqual(originalCell);
  // Restore only the explicit carried-equipment fixture, never via acceptance.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const i = s.physicalItemStacks.find(i => i.id === 'brought-stretcher'); i.carriedBy = 'scientist'; i.cell = s.scientist.mapCell; i.roomId = s.scientist.roomId;
    s.medicalExtraction.clinic ||= window.HelixMunicipalClinic.defaultState(); s.medicalExtraction.clinic.clinician.status = 'dead'; d.importSurveyExpeditionTestState(s); });
  s = await until(page, s => s.saved.evacuation?.phase === 'receiving');
  await advance(page, 90); s = await snap(page); expect(s.saved.evacuation.phase).toBe('receiving'); expect(s.saved.evacuation.reason).toContain('unavailable');
  expect(s.escort.actor.id).toBe(escortId); expect(s.escort.actor.roomId).toBe('supportedSurveyGround'); expect(s.saved.careEscrow).toBe(180);
  await reload(page); const waiting = (await snap(page)).escort.actor.mapCell; await advance(page, 30); expect((await snap(page)).escort.actor.mapCell).toEqual(waiting);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); delete s.medicalExtraction.clinic.clinician.status; d.importSurveyExpeditionTestState(s); });
  s = await until(page, s => s.saved.evacuation?.phase === 'handedOver'); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(120));
  const clinic = await page.evaluate(() => window.helixHeresyDebug.clinicSnapshot()); expect(clinic.stay.assessment.personId).toBe(escortId);
  expect(clinic.stay.emergency).toBe(false); expect(clinic.debt).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = await snap(page);
  await advance(page, 100); expect((await snap(page)).saved).toEqual(frozen.saved); expect(errors).toEqual([]);
});
