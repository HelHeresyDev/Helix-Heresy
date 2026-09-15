const { test, expect } = require('@playwright/test');
const Assignments = require('../penal-assignments');
const Service = require('../penal-service');
const Legion = require('../penal-legion');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const s = { id: 'service', cityId: 'city', institution: { id: 'command' }, phase: 'depotService', termMonths: 12, startedAt: 100, jailStayId: 'jail', history: [], destination: { id: 'satellite-a', distanceKm: 12 }, relay: { id: 'relay', condition: 20, repairSeconds: 75, partsCommitted: true }, truck: { condition: 100, fuelKm: 10 } };
  Service.ledger(s, { id: 'jail', bookedAt: 0 }); Assignments.initialize(s, [{ id: 'satellite-b', distanceKm: 20 }]); return s;
}
test('finite assignment catalog preserves site progress, bodies and beasts across switches and reload', () => {
  const s = fixture(); s.fieldBeasts = { actors: [{ id: 'beast', status: 'dead' }] }; Assignments.saveSite(s);
  expect(s.assignments).toHaveLength(4);
  expect(Assignments.select(s, 'satellite-b:relief')).toBe(true);
  expect(s.relay.condition).toBe(20); expect(s.fieldBeasts).toBeNull();
  const loaded = copy(s); loaded.phase = 'depotService';
  expect(Assignments.select(loaded, 'satellite-a:repair')).toBe(true);
  expect(loaded.relay.repairSeconds).toBe(75); expect(loaded.relay.partsCommitted).toBe(true);
  expect(loaded.fieldBeasts.actors[0].status).toBe('dead');
  Assignments.initialize(loaded, [{ id: 'invented' }]); expect(loaded.assignments).toHaveLength(4);
});
test('readiness requires existing capable people, gear, cargo and round-trip fuel plus reserve', () => {
  const s = fixture(), facts = { personnel: true, equipment: true, cargo: true, reserveFuel: 18, routeOpen: true };
  expect(Assignments.readiness(s, facts)).toBe('');
  for (const key of ['personnel', 'equipment', 'cargo', 'routeOpen']) expect(Assignments.readiness(s, { ...facts, [key]: false })).not.toBe('');
  expect(Assignments.readiness(s, { ...facts, reserveFuel: 0 })).toContain('fuel');
  s.truck.condition = 0; expect(Assignments.readiness(s, facts)).toContain('disabled');
});
test('relief needs uninterrupted safe work and actual cargo; receipt and reward are unique', () => {
  const s = fixture(); Assignments.select(s, 'satellite-a:relief'); s.phase = 'field';
  expect(Assignments.reliefWork(s, 120, 200, { ready: false, cargo: true })).toBe(false);
  expect(Assignments.reliefWork(s, 120, 200, { ready: true, cargo: false })).toBe(false);
  expect(Assignments.reliefWork(s, 60, 200, { ready: true, cargo: true })).toBe(false);
  const loaded = copy(s);
  expect(Assignments.reliefWork(loaded, 60, 260, { ready: true, cargo: true })).toBe(true);
  expect(Assignments.recordDelivery(loaded, 260, ['water', 'food'])).toBe(true);
  expect(Assignments.recordDelivery(loaded, 260, ['extra'])).toBe(false);
  loaded.report = { outcome: 'aborted', casualties: [] };
  const award = Assignments.debrief(loaded, 300); expect(award.seconds).toBe(7 * 86400);
  expect(Assignments.debrief(loaded, 301)).toBeNull();
  loaded.phase = 'depotService'; expect(Assignments.select(loaded, award.assignmentId)).toBe(false);
});
test('only verified completion reduces the original boundary and neither abort nor reload duplicates credit', () => {
  const s = fixture(), original = s.ledger.releaseAt;
  s.report = { outcome: 'aborted', casualties: [] }; expect(Assignments.debrief(s, 500)).toBeNull();
  expect(s.ledger.releaseAt).toBe(original);
  s.report = { outcome: 'repaired', casualties: [] }; s.relay.condition = 100;
  const award = Assignments.debrief(s, 1000);
  expect(Service.awardReduction(s, { ...award, authorityId: 'forged' }, 1000)).toBe(false);
  expect(Service.awardReduction(s, award, 1000)).toBe(true);
  Service.accrue(s, 1000); expect(s.ledger.releaseAt).toBe(original - 7 * 86400);
  expect(s.ledger.originalReleaseAt).toBe(original);
  const loaded = copy(s); expect(Service.awardReduction(loaded, award, 2000)).toBe(false);
  Legion.credit(loaded, 1000); expect(loaded.creditedSeconds).toBe(s.creditedSeconds);
  expect(Assignments.select(loaded, 'satellite-a:relief')).toBe(true);
  loaded.report = { outcome: 'aborted', casualties: [] };
  expect(Assignments.debrief(loaded, 3000)).toBeNull();
  expect(loaded.ledger.reductions).toHaveLength(1);
  expect(loaded.ledger.releaseAt).toBe(original - 7 * 86400);
});
test('a reduction exhausting the remaining term releases now, without backdating actual service', () => {
  const s = fixture(); s.report = { outcome: 'repaired', casualties: [] }; s.relay.condition = 100;
  const now = s.ledger.releaseAt - 30, original = s.ledger.releaseAt;
  const award = Assignments.debrief(s, now); Service.awardReduction(s, award, now);
  expect(s.ledger.reductions[0]).toMatchObject({ seconds: 30, authorizedSeconds: 7 * 86400 });
  expect(Service.accrue(s, now)).toBe(true); expect(s.serviceEndedAt).toBe(now);
  expect(s.ledger.originalReleaseAt).toBe(original); expect(s.remainingSeconds).toBe(0);
  expect(Service.accrue(s, now + 100)).toBe(false);
});

async function setup(page) {
  const { pathToFileURL } = require('url'), path = require('path');
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'assignments-test', publicProspects: {}, truth: {} } }));
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(id => { const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(id); d.updateLawEnforcementRaids(1); d.surrenderToRaid(id); for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 }); }, execution.raidId);
  expect(await page.evaluate(() => window.helixHeresyDebug.preparePenalLegionForTest())).toBe(true);
  await phase(page, 'briefing');
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.penalLegionSnapshot());
async function phase(page, name) {
  await page.evaluate(p => window.helixHeresyDebug.advancePenalLegionForTest(12000, { untilPhase: p }), name);
  expect((await snapshot(page)).service.phase).toBe(name);
}
const deploy = page => page.evaluate(() => window.helixHeresyDebug.penalLegionAction('deploy'));

test('browser retry retains the original battlefield and casualty, then awards the repair only once', async ({ page }) => {
  test.setTimeout(600000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page); await deploy(page); await phase(page, 'field');
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.configurePenalLegionForTest({ distantBeast: true, casualty: true }); d.configurePenalAssignmentsForTest({ repairSeconds: 75 }); d.penalLegionAction('recall'); });
  await phase(page, 'depotService'); let s = await snapshot(page);
  const casualty = s.squad[1], boundary = s.service.ledger.releaseAt;
  expect(s.service.ledger.reductions).toHaveLength(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectPenalAssignment('satellite-a:repair'))).toBe(true);
  await phase(page, 'briefing'); await deploy(page); await phase(page, 'outbound');
  expect((await snapshot(page)).service.truck.occupants).not.toContain(casualty.id);
  await phase(page, 'field');
  s = await snapshot(page); expect(s.service.relay.repairSeconds).toBe(75);
  expect(s.squad[1]).toMatchObject({ status: 'dead', roomId: casualty.roomId, mapCell: casualty.mapCell });
  expect(s.beasts.actors.some(a => a.id === 'legion-test-beast')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await phase(page, 'depotService'); s = await snapshot(page);
  expect(s.service.assignmentReports).toHaveLength(2);
  expect(s.service.ledger.reductions).toHaveLength(1);
  expect(s.service.ledger.releaseAt).toBe(boundary - 7 * 86400);
  expect(await page.evaluate(() => window.helixHeresyDebug.selectPenalAssignment('satellite-a:repair'))).toBe(false);
  expect(errors).toEqual([]);
});

test('browser relief loads finite cargo, uses a distinct persistent site and earns discharge through debrief', async ({ page }) => {
  test.setTimeout(600000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.configurePenalAssignmentsForTest({ extraSite: { id: 'satellite-b', name: 'Second Farm', cellId: 'planet-cell:00003', distanceKm: 12 } }); d.preparePenalDepotForTest(); });
  expect(await page.evaluate(() => window.helixHeresyDebug.selectPenalAssignment('satellite-b:relief'))).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.configurePenalAssignmentsForTest({ fuel: 0, reserveFuel: 0 }); d.advancePenalLegionForTest(60); });
  let blocked = await snapshot(page);
  expect(blocked.service.phase).toBe('assignmentLoading'); expect(blocked.service.delay).toContain('fuel');
  expect(Object.keys(blocked.service.assignmentSites[1].relief.cargoIds)).toHaveLength(0);
  await page.evaluate(() => window.helixHeresyDebug.configurePenalAssignmentsForTest({ reserveFuel: 1000 }));
  await phase(page, 'briefing'); let s = await snapshot(page);
  expect(s.service.depot.missionFuelKm).toBe(972); expect(s.service.truck.fuelKm).toBe(28);
  const row = s.service.assignmentSites.find(a => a.id === 'satellite-b');
  expect(Object.keys(row.relief.cargoIds)).toHaveLength(2);
  const cargoIds = Object.values(row.relief.cargoIds);
  expect(s.stacks.filter(a => cargoIds.includes(a.id)).every(a => a.carriedBy === s.squad[3].id && a.reservedTaskId === 'satellite-b:relief')).toBe(true);
  await deploy(page); await phase(page, 'field');
  expect((await snapshot(page)).roomId).toBe('penalLegionSite1');
  await phase(page, 'debrief');
  await page.evaluate(() => window.helixHeresyDebug.configurePenalDepotForTest({ remaining: 300 }));
  await phase(page, 'dischargeBoarding'); s = await snapshot(page);
  expect(s.service.remainingSeconds).toBe(0); expect(s.service.ledger.reductions).toHaveLength(1);
  expect(s.service.assignmentReports.at(-1).outcome).toBe('delivered');
  expect(s.stacks.filter(a => cargoIds.includes(a.id)).every(a => a.roomId === 'penalLegionSite1' && !a.carriedBy && !a.reservedTaskId)).toBe(true);
  expect(s.service.assignmentSites[0].relay.condition).toBe(20);
  expect(s.suppression).toBe(''); expect(errors).toEqual([]);
});
