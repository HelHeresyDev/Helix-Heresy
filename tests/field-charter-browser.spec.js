const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.fieldCharterSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceFieldCharterForTest(n), n);
const action = (page, action, stopId = '') => page.evaluate(({ action, stopId }) => window.helixHeresyDebug.fieldCharterAction(action, stopId), { action, stopId });
async function visits(page) { const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function finish(page) { for (let n = 0; n < 40; n++) { const s = await snap(page); if (!s.tasks.length) return;
  expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe(''); await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1)); } throw new Error('Local movement unfinished'); }
async function walk(page, roomId, cell) { expect(await page.evaluate(({ roomId, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell })), { roomId, cell })).toBe(true); await finish(page); }
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `charter-${renderer}`);
  const site = await page.evaluate(renderer => { const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00003', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: .25, routeContinuity: 'municipal' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00003', seed: 'charter', publicProspects: {}, truth: {} } });
    d.configureUnsupportedTest({ municipal: true, carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false });
    // An explicit empty supported encounter fixture keeps this transport test
    // independent of world-seeded wildlife; the second flow adds a real actor.
    const ledger = d.configureRegionalEncounterTest([], 'charter-empty'), s = d.exportSurveyExpeditionTestState(), route = d.overlandSnapshot().route;
    // Previously visited ground is an explicit input fixture. This slice tests
    // actual charter travel/revisit, not the already-covered solo discovery walk.
    const old = window.HelixRoadsideStops.ensure(null, { worldId: ledger.worldId, runId: ledger.runId }, route.id, .75, s.clock, 31, { temperatureC: 18 });
    s.roadsideStops = old.state; d.importSurveyExpeditionTestState(s); return old.site;
  }, renderer);
  expect(site).toBeTruthy(); expect((await snap(page)).roomId).toBe('supportedSurveyGround');
  await visits(page); const original = await page.evaluate(() => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return {
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), carrier: s.surveyExpeditions.carrier, money: s.economy.money }; });
  let s = await snap(page); await walk(page, 'supportedSurveyGround', { ...s.escort.actor.mapCell, x: s.escort.actor.mapCell.x - 1 });
  expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.setFieldCharterTestSource({
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'population:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster works', capacityBand: 'functional' }] }] }
  }))).toBe(true);
  expect(await action(page, 'review', site.id)).toBe(true); s = await snap(page); const quote = s.saved.quote;
  await visits(page); await expect(page.locator('[data-field-charter]')).toContainText('two passenger seats');
  expect(await action(page, 'accept', site.id)).toBe(true); expect(await action(page, 'accept', site.id)).toBe(false);
  expect((await snap(page)).money).toBe(s.money - quote.fee); await advance(page, 1000);
  s = await snap(page); expect(s.saved.phase).toBe('boarding'); expect(s.saved.driver.mapCell).toBeTruthy();
  expect(await action(page, 'walk')).toBe(true); await finish(page); await advance(page, 5);
  expect(await action(page, 'boardEscort'), (await snap(page)).saved?.reason).toBe(true); await reload(page); await advance(page, 12);
  expect((await snap(page)).saved.boarded).toContain(s.escort.actor.id); expect(await action(page, 'board')).toBe(true);
  const boarded = await snap(page); expect(boarded.saved.boarded).toHaveLength(2); expect(boarded.escort.actor.id).toBe(s.escort.actor.id);
  expect(await action(page, 'depart')).toBe(true); return { site, original, errors, escortId: s.escort.actor.id };
}
test('Canvas original two-person charter uses actual collection, individual boarding, saved transport, original roadside ground and finite physical return', async ({ page }) => {
  const { site, original, errors, escortId } = await setup(page, 'canvas'); const departure = await snap(page);
  await advance(page, 25); const mid = await snap(page); expect(mid.saved.positionKm).toBeLessThan(departure.saved.positionKm);
  await reload(page); expect((await snap(page)).saved.vehicle).toEqual(mid.saved.vehicle); expect((await snap(page)).escort.actor.id).toBe(escortId);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    // A wall needs real supporting ground or save normalization correctly
    // discards it. Restore that previously visited tile before blocking entry.
    s.labMap.terrain.excavated.push(cell);
    s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock }); d.importSurveyExpeditionTestState(s);
  }, site.entry);
  expect(await page.evaluate(cell => window.helixHeresyDebug.exportSurveyExpeditionTestState().labMap.terrain.constructedWalls.some(w => ['x', 'y', 'z'].every(k => w.cell[k] === cell[k])), site.entry)).toBe(true);
  await advance(page, 1000); const held = await snap(page); expect(held.saved.phase).toBe('onsite'); expect(held.saved.boarded).toHaveLength(2);
  expect(held.roomId).toBe(held.saved.cabin.roomId); await reload(page); expect((await snap(page)).saved.boarded).toHaveLength(2);
  await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !['x', 'y', 'z'].every(k => w.cell[k] === cell[k])); d.importSurveyExpeditionTestState(s);
  }, site.entry);
  await advance(page, 1); let s = await snap(page); expect(s.saved.phase).toBe('onsite'); expect(s.stop.id).toBe(site.id);
  expect(s.escort.actor.roomId).toBe(site.roomId); expect(s.saved.boarded).toEqual([]);
  expect(s.overland.history).toEqual(departure.overland.history); // No new completed walking receipt.
  await visits(page); await expect(page.locator('[data-field-charter]')).toContainText('No laboratory access');
  await walk(page, site.roomId, { ...s.saved.vehicle.mapCell, x: s.saved.vehicle.mapCell.x - 1 }); await advance(page, 8);
  expect(await action(page, 'boardEscort')).toBe(true); await advance(page, 12);
  expect(await action(page, 'board')).toBe(true); const returned = await action(page, 'return'); expect(returned, (await snap(page)).saved?.reason).toBe(true);
  await advance(page, 1000); s = await snap(page); expect(s.roomId).toBe('supportedSurveyGround'); expect(s.saved.phase).toBe('depot');
  expect(s.escort.actor.id).toBe(escortId); expect(s.escort.actor.roomId).toBe('supportedSurveyGround');
  await advance(page, 1000); s = await snap(page); expect(s.saved.phase).toBe('completed'); expect(s.saved.history).toHaveLength(1);
  expect(s.saved.vehicle.fuelKm).toBeLessThan(departure.saved.vehicle.fuelKm); expect(s.saved.vehicle.passengerSeats).toBe(2);
  const result = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    carrier: s.surveyExpeditions.carrier, world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), valid: d.validateMapScene() }; });
  expect(result.carrier).toEqual(original.carrier); expect(result.world).toBe(original.world); expect(result.valid).toEqual([]); expect(errors).toEqual([]);
});
test('DOM blocked route retains actual people and cargo, original local beasts damage the van, partial return leaves the same escort behind, death and fresh-run boundaries persist', async ({ page }) => {
  const { site, errors, escortId } = await setup(page, 'dom'); await advance(page, 20); const moving = await snap(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.strategicJourneys.destinations.find(r => r.id === s.strategicJourneys.homeDestinationId).routeContinuity = 'closed'; d.importSurveyExpeditionTestState(s); });
  await advance(page, 1); let s = await snap(page); expect(s.saved.phase).toBe('stranded'); expect(s.saved.positionKm).toBe(moving.saved.positionKm);
  expect(s.stop).toBeTruthy(); expect(s.saved.boarded).toEqual([]); expect(s.escort.actor.id).toBe(escortId);
  await reload(page); expect((await snap(page)).saved.vehicle).toEqual(s.saved.vehicle);
  // Restore only the actual route and introduce one explicit supported actor at
  // adjacent physical ground; existing AI/attack timing handles exterior harm.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), v = s.fieldCharter.vehicle;
    s.strategicJourneys.destinations.find(r => r.id === s.strategicJourneys.homeDestinationId).routeContinuity = 'municipal';
    const R = window.HelixRegionalEncounters, W = window.HelixWildernessBeasts;
    const a = { ...W.actor('beast:rimefang-pack', 'fixture-local-beast', { ...v.mapCell, x: v.mapCell.x - 1 }, 'fixture-population', s.clock), roomId: v.roomId,
      routeId: s.fieldCharter.booking.routeId, positionKm: s.fieldCharter.positionKm, offsetM: 2, homePositionKm: s.fieldCharter.positionKm,
      regionalPhase: 'local', regionalSiteId: s.roadsideStops.sites.find(p => p.roomId === v.roomId).id, effortSeconds: 120, regionalAt: s.clock,
      behavior: 'pursue', nextAttackAt: s.clock, nextMoveAt: s.clock + 1000 };
    R.adopt(s.regionalEncounters, [a], 'explicit-test', s.clock); s.regionalEncounters.beasts.actors.push(a); d.importSurveyExpeditionTestState(s);
  });
  const condition = s.saved.vehicle.condition; await advance(page, 1); s = await snap(page); expect(s.saved.vehicle.condition).toBeLessThan(condition);
  expect(await action(page, 'abandon')).toBe(true); expect((await snap(page)).saved.scientistReleased).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('stop'))).toBe(true);
  expect((await snap(page)).saved.positionKm).toBe(s.saved.positionKm);
  // Preserve a real separation on return; no forced boarding of the escort.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); s.expeditionEscorts.actor.order = 'hold';
    s.regionalEncounters.beasts.actors.find(a => a.id === 'fixture-local-beast').nextAttackAt = s.clock + 1000; d.importSurveyExpeditionTestState(s); });
  await walk(page, s.stop.roomId, { ...s.saved.vehicle.mapCell, x: s.saved.vehicle.mapCell.x - 1, y: s.saved.vehicle.mapCell.y + 1 });
  expect(await action(page, 'board')).toBe(true); const left = (await snap(page)).escort.actor.mapCell;
  const returned = await action(page, 'return'); expect(returned, (await snap(page)).saved?.reason).toBe(true); await advance(page, 1000); s = await snap(page);
  expect(s.roomId).toBe('supportedSurveyGround'); expect(s.escort.actor.mapCell).toEqual(left); expect(s.escort.actor.roomId).not.toBe(s.roomId);
  expect(s.escort.actor.id).toBe(escortId); await reload(page);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = (await snap(page)).saved;
  await advance(page, 1000); expect((await snap(page)).saved).toEqual(frozen);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/); expect((await snap(page)).saved?.booking).toBeFalsy(); expect(errors).toEqual([]);
});
