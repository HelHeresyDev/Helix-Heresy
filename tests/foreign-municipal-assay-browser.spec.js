const { test, expect } = require('@playwright/test');
const Production = require('../local-market-production');
const Municipal = require('../foreign-municipal-assay');
const { openForeignWorkspace, workspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignCommissionSnapshot());
const action = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignMunicipalAssayAction(action, options), { action, options });
test('canvas municipal advisory contract uses supplier consent, real freight and assay supplies, saves interrupted cargo and pays only on identified personal receipt', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page, 'foreign-municipal-assay', 'canvas');
  expect((await snap(page)).municipal).toBeFalsy();
  const p = Production.create({ cityId: 'b', workshopCapacity: 1, manufacturingFacilities: [{ id: 'works:b', name: 'B Chemical Works', kind: 'chemicalWorks',
    condition: 95, labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] });
  p.workshops.find(w => w.id === 'rubber').stock = 3; p.workshops.find(w => w.id === 'rubber').produced = 3;
  const source = { cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', institutionId: 'civic:b', branchId: 'civic:b:protected-provisioning',
    name: 'B Provisioning', populationSourceId: 'population:b', budgetSourceId: 'admin:b:protected-provisioning-assay-allocation', budget: Municipal.BUDGET };
  await page.evaluate(({ p, source }) => {
    const d = window.helixHeresyDebug; d.setForeignSuppliesTestContext({ city: { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' }, standings: [], market: { listings: {} } });
    const s = d.exportSurveyExpeditionTestState(); p.lastAt = s.clock; s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production = p;
    d.importSurveyExpeditionTestState(s); d.setForeignMunicipalAssayTestSource(source);
  }, { p, source });
  await page.locator('[data-workspace-tab="visits"]').click(); const panel = page.locator('[data-foreign-municipal-assay]');
  const before = await snap(page); expect(before.commission.service.trust).toBe(0);
  await panel.getByRole('button', { name: 'Review municipal advisory assay terms', exact: true }).click();
  await expect(panel).toContainText('advisory'); await expect(panel).toContainText('48 hours');
  expect(await action(page, 'accept', { expected: (await snap(page)).municipal.quote })).toBe(false);
  await panel.getByRole('button', { name: 'Obtain explicit supplier consent', exact: true }).click();
  await panel.getByRole('button', { name: 'Accept supplier-consented municipal contract', exact: true }).click();
  let s = await snap(page), job = s.municipal.jobs[0];
  expect(job.status).toBe('sampleInTransit'); expect(s.municipal.money).toBe(0); expect(s.production.finance.money).toBe(before.production.finance.money);
  expect(s.money).toBe(before.money); expect(s.commission.service.jobs).toEqual([]);
  const actor = s.municipal.actor, truck = s.production.trucks[0];
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production.trucks[0].driver.health = 0; d.importSurveyExpeditionTestState(s); });
  await advance(page, 3700); expect((await snap(page)).municipal.jobs[0].sampleStackId).toBe('');
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.municipal.actor).toEqual(actor); expect(s.municipal.money).toBe(0); expect(s.production.trucks[0].id).toBe(truck.id);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.economy.commodityMarket.intercityTrade.neighbors.find(n => n.id === 'b').production.trucks[0].driver.health = 100; d.importSurveyExpeditionTestState(s); });
  await advance(page, 3700); s = await snap(page); job = s.municipal.jobs[0]; expect(job.status).toBe('awaitingAssay'); expect(job.sampleStackId).toBeTruthy();
  expect(s.diagnostics.samples.find(i => i.stackId === job.sampleStackId).captured.industrialService).toMatchObject({ municipal: true, institutionId: 'civic:b', cityId: 'b' });
  const w = await workspace(page), reagent = w.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  expect(await wa(page, 'drop', { stackId: reagent.id })).toBe(true);
  expect(await wa(page, 'assay', { stackId: job.sampleStackId })).toBe(true); await finish(page);
  s = await snap(page); job = s.municipal.jobs[0]; expect(job.status).toBe('assayed'); expect(job.result.finding).toBe('acceptable');
  expect(job.reportReceipt).toBeNull(); expect(s.money).toBe(before.money); expect(s.commission.service.trust).toBe(0);
  expect(s.stacks.some(i => i.id === reagent.id || i.id === job.sampleStackId)).toBe(false);
  expect((await workspace(page)).tools[0].current).toBeLessThan(w.tools[0].current);
  expect(await action(page, 'submit', { jobId: job.id })).toBe(false);
  if (!(await workspace(page)).context.atDesk) { expect(await wa(page, 'walk')).toBe(true); await finish(page); }
  await panel.getByRole('button', { name: 'Review identified municipal assay report', exact: true }).click();
  await panel.getByRole('button', { name: 'Deliver reviewed advisory report to municipality', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(before.money + 120); expect(s.municipal.jobs[0].reportReceipt).toMatchObject({ reportId: job.result.id, institutionId: 'civic:b', officerId: actor.id });
  expect(s.commission.service.trust).toBe(0); expect(s.municipal.jobs[0].lotStatus).toBe('supplierWithheld');
  const completedActor = s.municipal.actor;
  expect(await action(page, 'submit', { jobId: job.id })).toBe(false);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  s = await snap(page); expect(s.money).toBe(before.money + 120); expect(s.municipal.actor).toEqual(completedActor); expect(s.municipal.money).toBe(0);
  // Officer spent only finite personal duty; reload must not refresh their fatigue.
  expect(s.municipal.actor.id).toBe(actor.id);
  expect(await wa(page, 'return')).toBe(true); await finish(page); const observation = (await snap(page)).municipal.observation;
  await advance(page, 60); expect((await snap(page)).municipal.observation).toEqual(observation); expect(await action(page, 'quote')).toBe(false);
  expect(errors).toEqual([]);
});
