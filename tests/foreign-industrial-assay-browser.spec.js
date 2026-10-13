const { test, expect } = require('@playwright/test');
const Production = require('../local-market-production');
const Services = require('../local-services');
const { openForeignWorkspace, workspace, advance, action, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignCommissionSnapshot());
test('foreign commissioned batch physically arrives, consumes real assay supplies and pays only on reviewed desk receipt', async ({ page }) => {
  page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page);
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
