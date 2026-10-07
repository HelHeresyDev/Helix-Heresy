const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(180000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.confidentialServiceSnapshot());
async function openServices(page) {
  if (!await page.locator('[data-economy-menu-tab="services"]').isVisible()) await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="services"]').click();
}
async function start(page, options = {}) {
  page.setDefaultTimeout(30000); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, 'confidential-chemical-testing');
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
  ] }, 'confidential-services-test'));
  expect(await page.evaluate(() => window.helixHeresyDebug.configureLocalServiceTestSupport())).toBe('');
  expect(await page.evaluate(options => window.helixHeresyDebug.configureConfidentialServiceTestSupport(options), options)).toBe(true);
  await openServices(page);
}
async function finishWork(page, type) {
  for (let i = 0; i < 6; i++) {
    const state = await snapshot(page), task = state.tasks.find(t => t.type === type);
    if (!task) return;
    await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, task.dueAt - state.clock + 1));
  }
  throw new Error(`Physical work did not finish: ${JSON.stringify(await snapshot(page))}`);
}
async function receiveSample(page) {
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(1200));
  await openServices(page);
  const before = (await snapshot(page)).scientist;
  await page.getByRole('button', { name: 'Walk to confidential handoff', exact: true }).click();
  expect((await snapshot(page)).scientist).toEqual(before);
  await finishWork(page, 'scientistMove');
  await page.getByRole('button', { name: 'Receive confidential sample', exact: true }).click();
  expect((await snapshot(page)).service.jobs[0].status).toBe('awaitingAssay');
}
async function accept(page) {
  await page.getByRole('button', { name: 'Request confidential testing terms', exact: true }).click();
  await expect(page.locator('#economyServicesList')).toContainText('Forty-eight-hour deadline');
  await page.getByRole('button', { name: 'Accept confidential testing', exact: true }).click();
  expect((await snapshot(page)).service.jobs[0].status).toBe('sampleInTransit');
}

test('confidential service works without a front: saved incoming courier, physical assay, exact disclosure and paid receipt', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page);
  const initial = await snapshot(page); expect(initial.company).toBe(false); expect(initial.service.jobs).toEqual([]);
  await accept(page);
  let state = await snapshot(page), job = state.service.jobs[0];
  expect(state.money).toBe(initial.money); expect(state.samples).toEqual([]);
  expect(state.local.collections.find(c => c.id === job.sourceId).manifest.amount).toBe(0.8);
  expect(await page.evaluate(id => window.helixHeresyDebug.confidentialServiceAction('receive', id), job.id)).toBe(false);
  const sourceSignal = job.signal;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await openServices(page);
  expect((await snapshot(page)).service.jobs[0].signal).toEqual(sourceSignal);
  await receiveSample(page);
  state = await snapshot(page); job = state.service.jobs[0];
  expect(state.stacks.find(s => s.id === job.sampleStackId).roomId).toBe('concealedExit');
  const reagent = state.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
  await page.getByRole('button', { name: 'Analyze confidential sample', exact: true }).click();
  const work = (await snapshot(page)).tasks.find(t => t.type === 'physicalDiagnostic'); expect(work.data.mapPath.length).toBeGreaterThan(1);
  await finishWork(page, 'physicalDiagnostic');
  state = await snapshot(page); job = state.service.jobs[0];
  expect(job.result.finding).toBe('acceptable'); expect(state.samples).toEqual([]);
  expect(state.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0)).toBe(reagent - 1);
  expect(state.evidence).toHaveLength(1); expect(state.stacks.some(s => s.id === job.reportStackId && s.key === 'confidentialReportPacket')).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.confidentialWarrantCategoriesForTest(id), job.reportStackId)).toContain('companyRecords');
  await page.getByRole('button', { name: 'Preview confidential report', exact: true }).click();
  await expect(page.locator('[data-confidential-disclosure-preview]')).not.toContainText('lineage');
  await expect(page.locator('[data-confidential-disclosure-preview]')).not.toContainText('classification');
  expect((await snapshot(page)).money).toBe(initial.money);
  const preview = (await snapshot(page)).service.jobs[0].preview;
  await page.evaluate(() => window.helixHeresyDebug.reloadLocalServiceStateForTest());
  expect((await snapshot(page)).service.jobs[0].preview).toEqual(preview);
  await page.getByRole('button', { name: 'Send confidential report', exact: true }).click();
  state = await snapshot(page); expect(state.money).toBe(initial.money + 180);
  expect(state.service.jobs[0]).toMatchObject({ status: 'completed', lotStatus: 'released', disclosed: preview });
  expect(state.contacts.find(c => c.id === state.service.client.id).trust).toBe(initial.contacts.find(c => c.id === state.service.client.id).trust + 2);
  const campaign = await page.evaluate(() => window.helixHeresyDebug.campaignSnapshot());
  expect(campaign.localLeverage.service.sourceId).toBe(job.id); expect(campaign.accomplishedAt).toBeNull(); expect(errors).toEqual([]);
});

test('confidential negative reports pay equally; off-site views are frozen and death freezes service and courier custody', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await start(page, { purity: 40, contamination: 1 });
  await accept(page);
  const known = (await snapshot(page)).known;
  await page.evaluate(() => { window.helixHeresyDebug.setConfidentialServiceCustomerForTest({ away: true }); window.helixHeresyDebug.setConfidentialServiceCustomerForTest({ money: 0 }); });
  expect((await snapshot(page)).known).toEqual(known);
  await expect(page.locator('#economyServicesList')).toContainText('no remote customer or courier surveillance');
  const away = await snapshot(page), courier = away.local.couriers.find(c => c.contactId === away.service.client.id);
  await expect(page.locator(`#economyContactsList [data-covert-courier="${courier.id}"]`)).toHaveCount(0);
  await expect(page.locator(`#economyContactsList [data-covert-custody="${away.service.jobs[0].sourceId}"]`)).toHaveCount(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.confidentialServiceAction('quote'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setConfidentialServiceCustomerForTest({ away: false }));
  await receiveSample(page);
  const before = (await snapshot(page)).money;
  await page.getByRole('button', { name: 'Analyze confidential sample', exact: true }).click(); await finishWork(page, 'physicalDiagnostic');
  await page.getByRole('button', { name: 'Preview confidential report', exact: true }).click();
  await page.getByRole('button', { name: 'Send confidential report', exact: true }).click();
  const paid = await snapshot(page); expect(paid.money).toBe(before + 180); expect(paid.service.jobs[0].lotStatus).toBe('quarantined');
  expect(JSON.stringify(paid.known)).not.toMatch(/batchFingerprint|signal|private-lineage/);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await expect(page.locator('#runOutcomePanel')).toBeVisible();
  const dead = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.confidentialServiceAction('quote'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(3600));
  const after = await snapshot(page); expect(after.service).toEqual(dead.service); expect(after.local).toEqual(dead.local); expect(after.known).toEqual(dead.known);
  const report = await page.evaluate(() => window.helixHeresyDebug.runLifecycleSnapshot());
  expect(report.postmortem.accomplishments.some(e => e.label === 'Complete useful work for a local customer')).toBe(true); expect(errors).toEqual([]);
});
