const { test, expect } = require('@playwright/test');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const Production = require('../local-market-production');
const Services = require('../local-services');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignCommissionSnapshot());
const workspace = page => page.evaluate(() => window.helixHeresyDebug.foreignWorkspaceSnapshot());
const advance = (page, seconds) => page.evaluate(s => window.helixHeresyDebug.advanceForeignReceptionTestTime(s), seconds);
const action = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignCommissionAction(action, options), { action, options });
const wa = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignWorkspaceAction(action, options), { action, options });
async function finish(page) {
  for (let n = 0; n < 12; n++) { const s = await workspace(page), t = s.tasks.find(t => !t.reason); if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 1)); }
  throw new Error('Physical work did not finish');
}
function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
test('foreign commissioned batch physically arrives, consumes real assay supplies and pays only on reviewed desk receipt', async ({ page }) => {
  page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'foreign-industrial-commission');
  await page.evaluate(identity => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    d.configureLaboratoryAssistantTestSupport(); d.setLeasedAnnexTestSupport({ atLoading: true });
    const s = d.exportSurveyExpeditionTestState();
    for (const key of ['assayCase', 'assayReagent']) { const item = s.physicalItemStacks.find(i => i.key === key);
      if (!d.carryActorStack('scientist', item.id, 1)) throw new Error('Finite original cargo unavailable'); }
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] }, ...identity });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
  }, identity());
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.setForeignWorkspaceTestSource({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' },
    standings: [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research', organizationForm: 'localLaboratory',
      currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }] }));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true); await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true); await advance(page, 60);
  expect(await wa(page, 'walk')).toBe(true); await finish(page); expect(await wa(page, 'quote')).toBe(true);
  expect(await wa(page, 'sign', { expected: (await workspace(page)).saved.quote })).toBe(true);
  expect((await snap(page)).commission).toBeNull(); // Reception and rent cannot create a factory or customer.
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3; p.workshops.find(w => w.id === 'rubber').produced = 3;
  const home = Services.create(p);
  await page.evaluate(({ p, home }) => { const d = window.helixHeresyDebug;
    d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [], market: { listings: {} } });
    const s = d.exportSurveyExpeditionTestState(); p.lastAt = s.clock;
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production = p;
    // Deliberate same job number/date in the independent home account. A foreign
    // result must never be filed there even when these non-global IDs coincide.
    const sample = s.diagnostics.samples[0];
    home.jobs.push({ id: 'industrial-service-1', status: 'awaitingAssay', acceptedAt: s.clock, dueAt: s.clock + 172800,
      feeEscrow: 120, sampleFreight: 0, sourceGood: 'rubber', heldQuantity: .9, burden: 5, lotStatus: 'awaitingTest',
      sampleAt: s.clock, sampleStackId: sample.stackId, result: null, preview: null });
    s.localServices = home;
    d.importSurveyExpeditionTestState(s); }, { p, home });
  await page.locator('[data-workspace-tab="visits"]').click(); const panel = page.locator('[data-foreign-industrial-assay]');
  await panel.getByRole('button', { name: 'Review foreign assay commission terms', exact: true }).click();
  await expect(panel).toContainText('120'); await expect(panel).toContainText('48 hours');
  const before = await snap(page); await panel.getByRole('button', { name: 'Accept exact foreign assay commission', exact: true }).click();
  let s = await snap(page), job = s.commission.service.jobs[0];
  expect(s.production.finance.money).toBe(1372); expect(s.money).toBe(before.money);
  expect(job.status).toBe('sampleInTransit'); expect(job.sampleStackId).toBe('');
  expect(s.production.trucks[0].fuelKm).toBe(232);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production.trucks[0].driver.health = 0; d.importSurveyExpeditionTestState(s); });
  await advance(page, 3700); s = await snap(page); expect(s.commission.service.jobs[0].sampleStackId).toBe('');
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.reloadSurveyExpeditionTestState(); const s = d.exportSurveyExpeditionTestState();
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production.trucks[0].driver.health = 100; d.importSurveyExpeditionTestState(s); });
  await advance(page, 3700); s = await snap(page); job = s.commission.service.jobs[0];
  expect(job.status).toBe('awaitingAssay'); expect(job.sampleStackId).toBeTruthy();
  const item = s.stacks.find(i => i.id === job.sampleStackId), w = await workspace(page);
  expect(item.roomId).toBe(w.saved.roomId); expect(item.carriedBy).toBe(''); expect(item.tags).toContain('sealed');
  expect(s.diagnostics.samples.find(i => i.stackId === item.id).captured.industrialService).toMatchObject({ cityId: 'b', propertyId: w.saved.property.id, burden: job.burden });
  const reagent = w.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  expect(await wa(page, 'drop', { stackId: reagent.id })).toBe(true);
  expect(await wa(page, 'assay', { stackId: item.id })).toBe(true); await finish(page);
  s = await snap(page); job = s.commission.service.jobs[0]; expect(job.status).toBe('assayed'); expect(job.result.finding).toBe('acceptable');
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().localServices.jobs[0].status)).toBe('awaitingAssay');
  expect(s.money).toBe(before.money); expect(s.stacks.some(i => i.id === item.id)).toBe(false); expect(s.stacks.some(i => i.id === reagent.id)).toBe(false);
  expect((await workspace(page)).tools[0].current).toBeLessThan(w.tools[0].current);
  expect(await action(page, 'submit', { jobId: job.id })).toBe(false);
  expect(await wa(page, 'walk')).toBe(true); await finish(page);
  await panel.getByRole('button', { name: 'Review exact foreign assay report', exact: true }).click();
  await expect(panel).toContainText('No unacceptable contamination');
  await panel.getByRole('button', { name: 'Deliver reviewed foreign assay report', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(before.money + 120); expect(s.commission.service.jobs[0].lotStatus).toBe('released');
  expect(s.production.workshops.find(w => w.id === 'rubber').stock).toBeCloseTo(2.9);
  expect(await action(page, 'submit', { jobId: job.id })).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).money).toBe(before.money + 120);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.money).toBe(before.money + 120); expect(s.commission.service.jobs[0]).toMatchObject({ status: 'completed', lotStatus: 'released' });
  expect(await wa(page, 'return')).toBe(true); await finish(page); const received = (await snap(page)).commission.observation;
  await advance(page, 60); expect((await snap(page)).commission.observation).toEqual(received);
  expect(await action(page, 'quote')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = await snap(page); await advance(page, 120);
  expect((await snap(page)).commission).toEqual(frozen.commission); expect((await snap(page)).production).toEqual(frozen.production);
  expect(errors).toEqual([]);
});
