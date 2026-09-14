const { test, expect } = require('@playwright/test');
const Legion = require('../penal-legion');
const Trial = require('../trial-sentencing');

const copy = x => JSON.parse(JSON.stringify(x));
function fixture(months = 24) {
  const c = Trial.normalizeCase({ id: 'case-1', actorId: 'scientist', sentencingPolicy: { cityId: 'city-1', penalLegionAvailable: true, penalServiceMinimumMonths: 12, penalServiceMaximumMonths: 36 }, sentencing: { order: { id: 'order-1', kind: 'penalLegion', final: true, custodial: true, status: 'commitmentPending', penalServiceMonths: months } } });
  const institution = { id: 'command-1', cityId: 'city-1', role: 'militaryDefenseCommand' };
  const target = { id: 'satellite-1', parentId: 'city-1', parentKind: 'sovereignResourceAnchorCity', distanceKm: 12, localRouteCellIds: ['cell-1', 'cell-2'], logistics: { vehicleMode: 'groundConvoy' } };
  return { c, institution, target, s: Legion.create(c, institution, target, 0) };
}
const soldier = (id = 'commander') => ({ id, status: 'alive', health: 100 });

test('military intake requires the exact city, final order, and published finite term', () => {
  const { c, institution, target } = fixture();
  expect(Legion.legalReason(c, 'city-1')).toBe('');
  for (const change of [{ stayed: true }, { final: false }, { status: 'completed' }, { kind: 'finitePrison' }, { penalServiceMonths: null }, { penalServiceMonths: 37 }]) {
    const bad = copy(c); Object.assign(bad.sentencing.order, change);
    expect(Legion.create(bad, institution, target, 0)).toBeNull();
  }
  expect(Legion.legalReason(c, 'city-2')).not.toBe('');
  const missing = copy(c); delete missing.sentencingPolicy.penalServiceMaximumMonths;
  expect(Legion.create(missing, institution, target, 0)).toBeNull();
  expect(Legion.create(c, { ...institution, role: 'temporaryJailAuthority' }, target, 0)).toBeNull();
});

test('first relay selection remains on a nearby city-owned ground route', () => {
  const { target } = fixture();
  const candidates = [{ ...target, id: 'foreign', parentId: 'city-2' }, { ...target, id: 'remote', distanceKm: Legion.RANGE_KM + 1 }, { ...target, id: 'flight', logistics: { vehicleMode: 'aircraft' } }, { ...target, id: 'ruin', condition: 'ruined' }, { ...target, id: 'route-less', localRouteCellIds: [] }, target];
  expect(Legion.chooseTarget(candidates, 'city-1')).toEqual(target);
  expect(Legion.chooseTarget(candidates.slice(0, -1), 'city-1')).toBeNull();
});

test('occupied transport consumes finite fuel and stops at its saved position when disabled', () => {
  const { s } = fixture(); Legion.stage(s, 'outbound', 0);
  expect(Legion.travel(s, 900, soldier())).toBe(false);
  expect(s.truck.distanceKm).toBe(6); expect(s.truck.fuelKm).toBe(30);
  const loaded = copy(s); loaded.truck.condition = 20;
  expect(Legion.travel(loaded, 9000, soldier())).toBe(false);
  expect(loaded.truck.distanceKm).toBe(6); expect(loaded.truck.fuelKm).toBe(30);
  loaded.truck.condition = 100;
  expect(Legion.travel(loaded, 900, soldier())).toBe(true);
  expect(loaded.truck.fuelKm).toBe(24);
});

test('relay repair requires a present living technician, consumes parts once, and survives reload', () => {
  const { s } = fixture(); Legion.stage(s, 'field', 0);
  const facts = { technician: soldier('technician'), atRelay: true, threatened: false };
  for (const patch of [{ atRelay: false }, { threatened: true }, { technician: { ...soldier(), health: 0 } }]) expect(Legion.repair(s, 900, { ...facts, ...patch })).toBe(false);
  expect(s.relay.repairSeconds).toBe(0); expect(s.relay.parts).toBe(1);
  Legion.repair(s, 100, facts); expect(s.relay.parts).toBe(0);
  const loaded = copy(s); Legion.repair(loaded, 900, { ...facts, threatened: true });
  expect(loaded.relay.repairSeconds).toBe(100);
  expect(Legion.repair(loaded, 200, facts)).toBe(true);
  expect(loaded.relay.condition).toBe(100); expect(loaded.relay.parts).toBe(0);
});

test('debrief preserves fixed service and casualties after abort without conviction or duplicate credit', () => {
  const { s } = fixture(); s.startedAt = 100; s.recalledAt = 500;
  Legion.stage(s, 'debrief', 900); const squad = [soldier(), { ...soldier('technician'), status: 'dead', health: 0 }];
  expect(Legion.debrief(s, squad, 1000)).toBe(true);
  expect(s.report).toMatchObject({ outcome: 'aborted', termMonths: 24, creditedSeconds: 900, casualties: ['technician'], newConviction: false });
  const loaded = copy(s); expect(Legion.debrief(loaded, squad, 2000)).toBe(false);
  Legion.credit(loaded, 1000); expect(loaded.creditedSeconds).toBe(900);
  expect(loaded.remainingSeconds).toBe(24 * Legion.MONTH - 900);
});

for (const abort of [false, true]) test(`browser military intake, ${abort ? 'abort' : 'relay repair'}, physical return and debrief persist without term reset`, async ({ page }) => {
  test.setTimeout(360_000);
  const { pathToFileURL } = require('url'); const path = require('path');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'legion-test', publicProspects: {}, truth: {} } }));
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(raidId => {
    const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(raidId); d.updateLawEnforcementRaids(1); d.surrenderToRaid(raidId);
    for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 });
  }, execution.raidId);
  expect(await page.evaluate(() => window.helixHeresyDebug.preparePenalLegionForTest())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(2400));
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.phase, JSON.stringify({ service: snapshot.service, cell: snapshot.cell, officers: snapshot.jail?.actors })).toBe('briefing');
  expect(snapshot.squad).toHaveLength(4); expect(snapshot.suppression).toContain('military');
  expect(snapshot.service.allocations).toHaveLength(25);
  const allocations = snapshot.service.allocations;
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.allocations).toEqual(allocations);
  expect(await page.evaluate(() => window.helixHeresyDebug.penalLegionAction('deploy'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(90));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.phase, JSON.stringify(snapshot.service)).toBe('outbound');
  expect(snapshot.suppression).toBe('');
  expect(snapshot.stacks.find(s => s.id === snapshot.service.collarId).carriedBy).toBe(snapshot.squad[0].id);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(1800));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.phase, JSON.stringify(snapshot.service)).toBe('field');
  const squadIds = snapshot.squad.map(a => a.id);
  let casualtyCell;
  if (!abort) {
    expect(await page.evaluate(() => window.helixHeresyDebug.configurePenalLegionForTest({ distantBeast: true, casualty: true }))).toBe(true);
    casualtyCell = (await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot())).squad[1].mapCell;
  }
  if (abort) expect(await page.evaluate(() => window.helixHeresyDebug.penalLegionAction('recall'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(360));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.phase, JSON.stringify({ service: snapshot.service, squad: snapshot.squad })).toBe('returning');
  if (!abort) {
    expect(snapshot.service.relay.condition).toBe(100);
    expect(snapshot.stacks.some(s => s.id === snapshot.service.relay.stackId)).toBe(false);
  }
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advancePenalLegionForTest(2100));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
  expect(snapshot.service.phase, JSON.stringify(snapshot.service)).toBe('depotService');
  expect(snapshot.service.report).toMatchObject({ outcome: abort ? 'aborted' : 'repaired', termMonths: 24, newConviction: false, casualties: abort ? [] : [squadIds[1]] });
  if (!abort) {
    expect(snapshot.squad[1]).toMatchObject({ status: 'dead', roomId: 'penalLegionField', mapCell: casualtyCell });
    expect(snapshot.service.fieldBeasts.actors.find(b => b.id === 'legion-test-beast').status).toBe('alive');
  }
  expect(snapshot.suppression).toContain('military');
  expect(snapshot.squad.map(a => a.id)).toEqual(squadIds);
  expect(snapshot.service.allocations).toEqual(allocations);
  expect(snapshot.service.creditedSeconds).toBeGreaterThan(0);
  expect(await page.evaluate(id => window.helixHeresyDebug.dropActorStack('scientist', id), snapshot.service.collarId)).toBe(false);
  expect(errors).toEqual([]);
});
