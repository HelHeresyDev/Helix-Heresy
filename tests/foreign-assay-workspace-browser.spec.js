const { test, expect } = require('@playwright/test');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.setTimeout(420000);
function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.foreignWorkspaceSnapshot());
const action = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignWorkspaceAction(action, options), { action, options });
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceForeignReceptionTestTime(seconds), seconds);
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), task = s.tasks.find(t => !t.reason); if (!task) return;
    await advance(page, Math.max(1, task.dueAt - s.clock + 1));
  }
  throw new Error('Physical work did not finish');
}
async function arrive(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const samples = await page.evaluate(({ identity, renderer }) => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    const samples = [d.configureLaboratoryAssistantTestSupport(), d.configureLaboratoryAssistantTestSupport()];
    d.setLeasedAnnexTestSupport({ atLoading: true });
    let s = d.exportSurveyExpeditionTestState();
    // Explicit finite original-departure cargo, not supplies awarded by foreign rent.
    for (const id of [...samples, s.physicalItemStacks.find(i => i.key === 'assayCase').id, s.physicalItemStacks.find(i => i.key === 'assayReagent').id]) {
      const item = s.physicalItemStacks.find(i => i.id === id);
      if (!d.carryActorStack('scientist', id, item.key === 'assayReagent' ? 2 : 1)) throw new Error('Cargo fixture failed');
    }
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer); d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact',
      administrationId: 'admin:b', administrationName: 'B Administration', capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] }, ...identity });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
    return samples;
  }, { identity: identity(), renderer });
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect((await snapshot(page)).saved).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.setForeignWorkspaceTestSource({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' },
    standings: [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research', organizationForm: 'localLaboratory',
      currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }] }))).toBe(true);
  expect(await action(page, 'walk')).toBe(false); // A visitor permit alone still needs an explicit separate invitation.
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await advance(page, 60);
  await page.locator('[data-workspace-tab="visits"]').click();
  return samples;
}
for (const renderer of ['dom', 'canvas']) test(`foreign manual workspace physical assays, expiry, retrieval and settlement through ${renderer}`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const samples = await arrive(page, renderer), initial = await snapshot(page), panel = page.locator('[data-foreign-assay-workspace]');
  expect(initial.saved.permission).toBeNull(); expect(initial.saved.observation).toBeNull();
  await panel.getByRole('button', { name: 'Accept named approach and walk to workspace', exact: true }).click();
  expect((await snapshot(page)).roomId).not.toBe(initial.saved.roomId); await finish(page);
  let s = await snapshot(page); expect(s.roomId).toBe(s.saved.roomId); expect(s.context.atDesk).toBe(true);
  expect(await action(page, 'assay', { stackId: samples[0] })).toBe(false);
  await panel.getByRole('button', { name: 'Review foreign workspace lease', exact: true }).click();
  await expect(panel).toContainText('375');
  await panel.getByRole('button', { name: 'Sign exact foreign workspace terms', exact: true }).click();
  s = await snapshot(page); expect(s.money).toBe(initial.money - 375); expect(s.saved.property.tenantStaffAuthorized).toBe(false);
  expect(s.tools.find(t => t.carriedBy === 'scientist').roomId).toBe(s.saved.roomId);
  expect(await page.evaluate(() => window.helixHeresyDebug.startDiagnosticCalibration('assayCase'))).toBe(true);
  expect(await action(page, 'cancelAssay')).toBe(true);
  expect(s.stacks.filter(i => i.roomId === s.saved.roomId && !i.carriedBy)).toHaveLength(0);
  expect(await action(page, 'assay', { stackId: samples[0] })).toBe(false); // Carrying reagent is not staging it.
  const reagent = s.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  expect(await action(page, 'drop', { stackId: reagent.id })).toBe(true);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).tags.push('living'); d.importSurveyExpeditionTestState(s); }, samples[0]);
  expect(await action(page, 'assay', { stackId: samples[0] })).toBe(false);
  await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.physicalItemStacks.find(i => i.id === id).tags = ['sealed']; d.importSurveyExpeditionTestState(s); d.setLeasedAnnexTestSupport({ breakOriginalBench: true }); }, samples[0]);
  expect(await page.evaluate(id => window.helixHeresyDebug.foreignWorkspaceAssayReason(id), samples[0])).toBe('');
  expect(await action(page, 'assay', { stackId: samples[0] })).toBe(true);
  expect(await action(page, 'cancelAssay')).toBe(true);
  expect((await snapshot(page)).stacks.some(i => i.id === samples[0])).toBe(true);
  expect(await action(page, 'assay', { stackId: samples[0] })).toBe(true);
  s = await snapshot(page); const task = s.tasks.find(t => t.type === 'physicalDiagnostic'); expect(task.data.workstationId).toBe(s.saved.benchId);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await finish(page);
  s = await snapshot(page); expect(s.diagnostics.results.at(-1).workflowId).toBe('assaySample');
  expect(s.stacks.some(i => i.id === samples[0])).toBe(false);
  expect(s.stacks.filter(i => i.key === 'assayReagent' && i.roomId === s.saved.roomId).reduce((n, i) => n + i.quantity, 0)).toBe(1);
  expect(s.tools[0].current).toBeLessThan(initial.tools[0].current);
  expect(await action(page, 'assay', { stackId: samples[1] })).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    g.foreignWorkspace.lease.endsAt = s.clock + 1; g.visitorAdmission.permits.at(-1).expiresAt = s.clock + 1; d.importSurveyExpeditionTestState(s); });
  await advance(page, 60); s = await snapshot(page); expect(s.saved.lease.status).toBe('expired');
  expect(s.diagnostics.results.filter(r => r.workflowId === 'assaySample')).toHaveLength(1);
  expect(s.tasks.find(t => t.type === 'physicalDiagnostic').data.foreignWorkspaceHeldAt).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState()); await advance(page, 60);
  expect((await snapshot(page)).stacks.some(i => i.id === samples[1])).toBe(true);
  expect(await action(page, 'walk')).toBe(true); await finish(page);
  expect(await action(page, 'quote')).toBe(true); s = await snapshot(page); expect(s.saved.quote).toMatchObject({ rent: 225, deposit: 0 });
  expect(await action(page, 'sign', { expected: s.saved.quote })).toBe(true);
  s = await snapshot(page);
  expect(s.tasks.find(t => t.type === 'physicalDiagnostic').data.movement.steps[0].cell).toEqual(s.cell);
  await finish(page); s = await snapshot(page);
  expect(s.diagnostics.results.filter(r => r.workflowId === 'assaySample')).toHaveLength(2);
  expect(s.stacks.some(i => i.id === samples[1])).toBe(false); expect(s.stacks.some(i => i.id === reagent.id)).toBe(false);
  const tool = s.stacks.find(i => i.key === 'assayCase' && i.roomId === s.saved.roomId);
  expect(tool.toolInstanceId).toBe(initial.tools[0].id);
  if (tool.carriedBy === 'scientist') expect(await action(page, 'drop', { stackId: tool.id })).toBe(true);
  expect(await action(page, 'walk')).toBe(true); await finish(page);
  expect(await action(page, 'handback')).toBe(false); // Original dropped tool is retained, not deleted.
  if (renderer === 'canvas') await page.evaluate(id => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.toolDurability.assayCase.find(t => t.id === id).current = 0; d.importSurveyExpeditionTestState(s); }, tool.toolInstanceId);
  expect(await action(page, 'pack', { stackId: tool.id })).toBe(true); await finish(page);
  s = await snapshot(page); expect(s.tools[0].carriedBy).toBe('scientist');
  if (renderer === 'canvas') expect(s.tools[0].current).toBe(0); // Broken belongings can be retrieved, not magically repaired.
  expect(await action(page, 'walk')).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    s.fixtures.find(f => f.id === g.foreignWorkspace.benchId).condition = 60; d.importSurveyExpeditionTestState(s); });
  expect(await action(page, 'handback')).toBe(true); s = await snapshot(page); expect(s.money).toBe(initial.money - 375 - 225 + 90);
  expect(await action(page, 'handback')).toBe(false); expect(s.saved.lease.settled).toBe(true);
  expect(await action(page, 'return')).toBe(true); await finish(page); s = await snapshot(page);
  expect(s.roomId).toContain('passenger-outer'); const observed = s.saved.observation;
  await advance(page, 60); expect((await snapshot(page)).saved.observation).toEqual(observed);
  expect(await action(page, 'walk')).toBe(false); expect(errors).toEqual([]);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = (await snapshot(page)).saved; await advance(page, 120);
  expect((await snapshot(page)).saved).toEqual(frozen); expect(await action(page, 'quote')).toBe(false);
});
