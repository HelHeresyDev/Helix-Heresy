const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Beasts = require('../wilderness-beasts');
const { openForeignWorkspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(900000);
const escort = page => page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot());
const field = page => page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot());
const act = (page, action) => page.evaluate(action => window.helixHeresyDebug.foreignSurveyAction(action), action);
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  await info.attach('foreign-escort-failure-state', { body: JSON.stringify(await page.evaluate(() => ({ storage: Object.fromEntries(Object.entries(localStorage)),
    escort: window.helixHeresyDebug.expeditionEscortSnapshot(), scientist: window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist }))), contentType: 'application/json' });
});
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
async function openField(page) {
  page.on('dialog', d => d.accept());
  await openForeignWorkspace(page, 'foreign-escort', 'canvas', false, false, 0, true);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] },
    cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  expect(await page.evaluate(({ source, carrier, city }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const context = s.resourceSurveys.context || { worldId: 'lifecycle-world', siteId: 'original-home-parcel', strategicCellId: 'planet-cell:00009', seed: 'home-fixture', truth: { potentialPermille: {} } };
    if (!s.resourceSurveys.context) d.setResourceSurveyTestContext(context);
    if (!d.setForeignSurveyTestSource(source, carrier, { ...context, siteId: source.placeId, strategicCellId: source.cellId })) return false;
    if (!d.setForeignWildernessTestSource({ origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10, temperatureC: 18, precipitationMm: 500, biomeLabel: 'Woodland' }], occupied: [], context })) return false;
    return d.setForeignEscortTestSource({ city, standings: [{ standing: 'licensed',
      network: { id: 'military:b', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
      branch: { id: 'chapter:b', publicName: 'Birch Escort Chapter', organizationForm: 'escortChapter', currentCityId: 'b', publicPhysicalPresence: true, physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] });
  }, { source, carrier, city })).toBe(true);
  expect(await act(page, 'quote')).toBe(true);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignSurveyAction('accept', { expected: d.foreignSurveySnapshot().excursion.quote }); })).toBe(true);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
}
test('canvas source-backed foreign escort uses exact local terms, original gear, independent combat and physical casualty assistance across real saves without a spare seat or home-escort reset', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openField(page);
  await testInfo.attach('foreign-field-local-storage', { body: JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))), contentType: 'application/json' });
  const initial = await escort(page), originalField = await field(page);
  expect(initial.actor.id).toBe('chapter:b:field-survey-professional'); expect(initial.stacks.map(s => s.key)).toContain('escortBaton');
  const home = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().expeditionEscorts);
  expect(home.actor?.id).not.toBe(initial.actor.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(false);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignSurveySnapshot(); return Boolean(d.startScientistMove(s.excursion.roomId, { toCell: { x: 13, y: 10, z: s.excursion.entry.z } })); })).toBe(true); await finish(page);
  const quote = await page.evaluate(() => window.helixHeresyDebug.reviewForeignEscort()); expect(quote.upfront).toBe(140);
  await page.locator('[data-workspace-tab="visits"]').click();
  await page.locator('[data-expedition-escort]').getByRole('button', { name: 'Accept exact foreign escort terms', exact: true }).click();
  let s = await escort(page); expect(s.money).toBe(initial.money - 140); expect(s.contract.bodyEpoch).toBe(quote.bodyEpoch);
  expect(await act(page, 'board')).toBe(false); expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'take'))).toBe(true);
  expect((await escort(page)).stacks.find(s => s.key === 'drinkingWater').quantity).toBe(3);
  expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'give'))).toBe(true);
  const handedKitIds = (await escort(page)).stacks.map(s => s.id);
  expect(await act(page, 'enterWilderness')).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, w = d.foreignWildernessSnapshot().site; return Boolean(d.startScientistMove(w.roomId, { toCell: { x: 25, y: 12, z: w.entry.z } })); })).toBe(true); await finish(page);
  s = await escort(page); const wildRoom = (await field(page)).excursion.wilderness.roomId;
  expect(s.actor.roomId).toBe(wildRoom); expect(s.actor.mapCell.x).toBeGreaterThan(20);
  expect(await page.evaluate(() => window.helixHeresyDebug.orderExpeditionEscort('hold'))).toBe(true); const held = s.actor.mapCell;
  await advance(page, 2); expect((await escort(page)).actor.mapCell).toEqual(held);
  await reload(page); s = await escort(page); expect(s.actor.id).toBe(initial.actor.id); expect(s.stacks.map(s => s.id)).toEqual(handedKitIds);
  console.info('Foreign escort: paid hiring, physical follow, held position and real save/load verified.');
  // Explicit finite combat fixture; normal shared attacks still decide damage and wear.
  const f = await field(page), z = f.excursion.entry.z, beast = Beasts.actor('beast:rimefang-pack', 'foreign-wolf', { x: 25, y: 12, z }, 'test-existing-population:b', s.clock);
  expect(await page.evaluate(({ beast, z, wildRoom }) => {
    const d = window.helixHeresyDebug;
    d.configureEscortTest({ cell: { x: 24, y: 12, z }, scientistCell: { x: 22, y: 12, z }, order: 'defend' });
    const state = d.exportSurveyExpeditionTestState(), w = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness;
    Object.assign(beast, { roomId: wildRoom, nextMoveAt: state.clock + 1000, nextAttackAt: state.clock + 1 }); w.beasts.actors = [beast];
    d.importSurveyExpeditionTestState(state); return true;
  }, { beast, z, wildRoom })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(1)); s = await escort(page);
  expect(s.beasts[0].targetId).toBe(s.actor.id); expect(s.gearCondition[s.stacks.find(s => s.key === 'escortBaton').id]).toBeLessThan(100);
  await page.evaluate(() => window.helixHeresyDebug.damageEscortForTest(5)); s = await escort(page);
  expect(s.injuries.some(i => i.actorId === s.actor.id)).toBe(true); expect(s.gearCondition[s.stacks.find(s => s.key === 'escortVest').id]).toBeLessThan(100);
  console.info('Foreign escort: independent beast targeting, shared combat, injuries and physical gear wear verified.');
  await page.evaluate(z => { const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), w = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.wilderness;
    w.beasts.actors[0].health = 0; w.beasts.actors[0].status = 'dead'; d.importSurveyExpeditionTestState(state);
    d.configureEscortTest({ cell: { x: 24, y: 12, z }, scientistCell: { x: 23, y: 12, z }, health: 5, order: 'hold' }); }, z);
  expect(await page.evaluate(() => window.helixHeresyDebug.startEscortDrag('scientist'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(3)); expect((await escort(page)).scientistCell.x).toBe(23);
  await reload(page); await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(2));
  s = await escort(page); expect(s.scientistCell.x).toBe(22); expect(s.actor.mapCell.x).toBe(23);
  await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(90)); s = await escort(page);
  expect(s.drag).toBeNull(); expect(s.actor.roomId).toBe(originalField.excursion.roomId); expect(s.actor.health).toBe(5);
  console.info('Foreign escort: physical dragging of the original injured professional back to the ground verified.');
  // A capable escort can assist the same living scientist; it does not heal or board them.
  await page.evaluate(z => window.helixHeresyDebug.configureEscortTest({ cell: { x: 22, y: 12, z }, scientistCell: { x: 23, y: 12, z }, health: 100, scientistHealth: 5, order: 'follow' }), z);
  await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(7)); s = await escort(page);
  expect(s.drag.helperId).toBe(s.actor.id);
  console.info('Foreign escort: scientist assistance timing', JSON.stringify({ actor: s.actor.mapCell, scientist: s.scientistCell, drag: s.drag, clock: s.clock, needs: s.actor.needs }));
  for (let n = 0; n < 6 && s.scientistCell.x === 23 && s.scientistCell.y === 12; n++) {
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(3)); s = await escort(page);
  }
  expect(s.scientistCell).not.toEqual({ x: 23, y: 12, z }); expect(s.scientistHealth).toBe(5);
  await reload(page); await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(90)); s = await escort(page);
  console.info('Foreign escort: casualty return', JSON.stringify({ actor: s.actor.mapCell, room: s.actor.roomId, scientist: s.scientistCell, drag: s.drag, clock: s.clock }));
  expect(s.drag).toBeNull(); expect(s.scientistHealth).toBe(5); expect(await act(page, 'board')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ scientistHealth: 100 }));
  const beforeSettlement = await escort(page); expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(true);
  s = await escort(page); expect(s.contract.status).toBe('completed'); expect(s.money).toBeCloseTo(beforeSettlement.money + s.contract.refund);
  expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(false);
  expect(s.actor.id).toBe(initial.actor.id); expect(s.dutySeconds).toBeLessThan(initial.dutySeconds);
  expect(s.stacks.map(s => s.id)).toEqual(expect.arrayContaining(initial.stacks.filter(s => ['escortBaton', 'escortVest'].includes(s.key)).map(s => s.id)));
  expect(s.stacks.filter(s => s.key === 'drinkingWater').reduce((n, s) => n + s.quantity, 0)).toBeLessThanOrEqual(4);
  const finalField = await field(page); expect(finalField.excursion.carrier.vehicle.fuelKm).toBe(originalField.excursion.carrier.vehicle.fuelKm);
  expect(finalField.passenger.vehicle.id).toBe(originalField.passenger.vehicle.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().expeditionEscorts)).toEqual(home);
  expect(errors).toEqual([]);
});

test('canvas foreign escort supplied off-duty recovery preserves original shelter, physical handoffs, interrupted effort and dated away knowledge before fresh paid rehire', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openField(page);
  const initial = await escort(page), f = await field(page);
  const home = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().expeditionEscorts);
  expect(initial.restPlace.stackId).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.beginForeignEscortRecovery())).toBe(false);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignSurveySnapshot().excursion;
    return Boolean(d.startScientistMove(s.roomId, { toCell: { x: 13, y: 10, z: s.entry.z } })); })).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.reviewForeignEscort())).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.beginForeignEscortRecovery())).toBe(false);
  for (const key of ['drinkingWater', 'trailMeal']) expect(await page.evaluate(key => window.helixHeresyDebug.transferEscortSupply(key, 'take'), key)).toBe(true);
  // Keep another original bottle for the scientist's elapsed-time consumption
  // and the second trip's real departure requirement; rest creates no supplies.
  expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'take'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(true);
  // Explicit exhausted/injured original-person fixture, not an awarded new kit.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.escort;
    e.dutySeconds = 100; e.actor.health = 72; Object.assign(e.actor.needs, { thirst: 80, hunger: 75, exertion: 85 });
    for (const id of Object.keys(e.gearCondition)) e.gearCondition[id] = 43;
    s.injuries.push({ id: 'original-escort-bruise', actorId: e.actor.id, actorKind: 'expeditionEscort', typeId: 'bruising', severityId: 'minor',
      location: 'left arm', status: 'stabilized', createdAt: s.clock, updatedAt: s.clock, stabilizedAt: s.clock, diagnosedAt: s.clock });
    d.importSurveyExpeditionTestState(s);
  });
  expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'take'))).toBe(false);
  for (const key of ['drinkingWater', 'trailMeal']) expect(await page.evaluate(key => window.helixHeresyDebug.transferEscortSupply(key), key)).toBe(true);
  const beforeRest = await escort(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-expedition-escort]');
  await panel.getByRole('button', { name: 'Begin supplied eight-hour off-duty rest', exact: true }).click();
  expect((await escort(page)).recovery.status).toBe('resting');
  expect(await page.evaluate(() => window.helixHeresyDebug.reviewForeignEscort())).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignEscortRecoveryForTest(3600));
  let s = await escort(page); expect(s.recovery.progressSeconds).toBe(3600); expect(s.dutySeconds).toBe(100);
  await reload(page); expect((await escort(page)).recovery.progressSeconds).toBe(3600);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.escort;
    s.physicalItemStacks.find(i => i.id === e.restPlace.stackId).cell.x++; d.importSurveyExpeditionTestState(s); });
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignEscortRecoveryForTest(1800));
  s = await escort(page); expect(s.recovery.status).toBe('paused'); expect(s.recovery.progressSeconds).toBe(3600);
  await reload(page); expect((await escort(page)).recovery.status).toBe('paused');
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), e = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.escort;
    s.physicalItemStacks.find(i => i.id === e.restPlace.stackId).cell = { ...e.restPlace.cell }; d.importSurveyExpeditionTestState(s); });
  expect(await act(page, 'walkVehicle')).toBe(true); await finish(page);
  const boarding = await act(page, 'board');
  expect(boarding, JSON.stringify((await field(page)).context)).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page); await advance(page, 120);
  const away = () => page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.escort);
  const dated = (await away()).recoveryReport;
  console.info('Foreign escort recovery: original shelter, physical provisions, partial real save/load and loss-of-shelter pause verified; scientist physically returned to city.');
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignEscortRecoveryForTest(8 * 3600));
  s = await away(); expect(s.recovery.status).toBe('completed'); expect(s.dutySeconds).toBe(12 * 3600); expect(s.recovery.progressSeconds).toBe(8 * 3600);
  expect(s.recoveryReport).toEqual(dated); expect(s.actor.health).toBe(72); expect(s.gearCondition).toEqual(beforeRest.gearCondition);
  expect(s.actor.id).toBe(initial.actor.id); expect(s.restPlace.stackId).toBe(initial.restPlace.stackId);
  await reload(page); expect((await away()).recovery).toEqual(s.recovery);
  expect(await act(page, 'book')).toBe(true); await advance(page, 120);
  expect(await act(page, 'board')).toBe(true); await finish(page); await advance(page, 600);
  expect(await act(page, 'disembark')).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignSurveySnapshot().excursion;
    return Boolean(d.startScientistMove(s.roomId, { toCell: { x: 13, y: 10, z: s.entry.z } })); })).toBe(true); await finish(page);
  s = await escort(page); expect(s.recoveryReport.recovery.status).toBe('completed'); expect(s.recoveryReport.at).toBeGreaterThan(dated.at);
  expect(s.injuries.find(i => i.id === 'original-escort-bruise').status).toBe('stabilized');
  const q = await page.evaluate(() => window.helixHeresyDebug.reviewForeignEscort()); expect(q).toBeTruthy();
  const money = s.money; expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
  s = await escort(page); expect(s.actor.id).toBe(initial.actor.id); expect(s.money).toBe(money - q.upfront);
  expect(s.contract.id).not.toBe(beforeRest.contract.id); expect(s.contract.tripId).not.toBe(beforeRest.contract.tripId);
  expect(s.gearCondition).toEqual(beforeRest.gearCondition); expect(s.actor.health).toBe(72);
  expect((await field(page)).excursion.carrier.vehicle.fuelKm).toBeLessThan(f.excursion.carrier.vehicle.fuelKm);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().expeditionEscorts)).toEqual(home);
  expect(errors).toEqual([]);
});
