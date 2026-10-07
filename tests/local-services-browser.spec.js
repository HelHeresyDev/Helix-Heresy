const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Library = require('../world-run-library');
const { lifecycleWorld } = require('./helpers/lifecycle-world');
const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
test.setTimeout(180000);
async function start(page) {
  page.setDefaultTimeout(30000);
  const world = lifecycleWorld();
  await page.goto(appUrl);
  await page.evaluate(({ id, payload }) => {
    localStorage.clear();
    localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
    localStorage.setItem('helix-heresy-v2-library', JSON.stringify({ version: 2, worldIds: [id], runIds: [] }));
    localStorage.setItem(`helix-heresy-v2-world:${id}`, payload);
  }, { id: world.id, payload: Library.compressStorageText(JSON.stringify(world)) });
  await page.reload();
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();
  await page.locator('#seedInput').fill('local-service-loop');
  await page.locator('[data-starting-site-input]').first().check();
  await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test laboratory', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'industrial-services-test'));
  expect(await page.evaluate(() => window.helixHeresyDebug.configureLocalServiceTestSupport())).toBe('');
  await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="services"]').click();
}
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.localServicesSnapshot());
async function freight(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await snapshot(page);
    if (state.service.jobs.at(-1)?.status === 'awaitingAssay') return;
    const unloading = state.tasks.find(task => task.type === 'commodityFreight');
    if (unloading) await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, unloading.dueAt - state.clock + 1));
    else await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(3600));
  }
  throw new Error(`Sample did not arrive: ${JSON.stringify(await snapshot(page))}`);
}
async function finishAssay(page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await snapshot(page), task = state.tasks.find(t => t.type === 'physicalDiagnostic');
    if (!task) return;
    await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, task.dueAt - state.clock + 1));
  }
  throw new Error('Physical assay did not complete.');
}
async function completeService(page) {
  await page.getByRole('button', { name: 'Accept testing service', exact: true }).click();
  expect((await snapshot(page)).service.jobs.at(-1)?.status).toBe('accepted');
  await freight(page);
  await page.getByRole('button', { name: 'Analyze customer sample', exact: true }).click();
  await finishAssay(page);
  expect((await snapshot(page)).service.jobs.at(-1).status).toBe('assayed');
  await page.getByRole('button', { name: 'Preview exact report disclosure', exact: true }).last().click();
  await expect(page.locator('[data-service-disclosure-preview]').last()).not.toContainText('burden');
  await page.getByRole('button', { name: 'Send previewed report', exact: true }).last().click();
}

test('visible service loop uses physical samples, saved exact reports and paid reserved-material freight', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await expect(page.locator('#economyServicesList')).toContainText('Test City Chemical Works');
  const initial = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().money);
  await page.getByRole('button', { name: 'Accept testing service', exact: true }).click();
  expect((await snapshot(page)).service.jobs).toHaveLength(1);
  expect((await snapshot(page)).samples).toHaveLength(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().money)).toBe(initial);
  await freight(page);
  let state = await snapshot(page);
  expect(state.samples).toHaveLength(1);
  expect(state.stacks.some(s => s.id === state.service.jobs[0].sampleStackId && s.roomId === 'surfaceLoadingBay')).toBe(true);
  const sampleId = state.samples[0].id;
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="services"]').click();
  expect((await snapshot(page)).samples[0].id).toBe(sampleId);
  const beforeReagent = (await snapshot(page)).stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
  await page.getByRole('button', { name: 'Analyze customer sample', exact: true }).click();
  await finishAssay(page);
  state = await snapshot(page);
  expect(state.samples).toHaveLength(0);
  expect(state.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0)).toBe(beforeReagent - 1);
  expect(state.service.jobs[0].result.finding).toBe('acceptable');
  await page.getByRole('button', { name: 'Preview exact report disclosure', exact: true }).click();
  expect(await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().money)).toBe(initial);
  const preview = (await snapshot(page)).service.jobs[0].preview;
  await page.evaluate(() => window.helixHeresyDebug.reloadLocalServiceStateForTest());
  expect((await snapshot(page)).service.jobs[0].preview).toEqual(preview);
  await page.getByRole('button', { name: 'Send previewed report', exact: true }).click();
  expect(await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().money)).toBe(initial + 120);
  expect((await snapshot(page)).service.jobs[0].lotStatus).toBe('released');
  await page.evaluate(() => { window.helixHeresyDebug.advanceStrategicServices(86400); window.helixHeresyDebug.setInstrumentCalibration('assayCase', 100); });
  await completeService(page);
  await page.getByRole('button', { name: 'Request materials reservation', exact: true }).click();
  state = await snapshot(page);
  expect(state.service.reservation.status).toBe('held');
  const quantity = state.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
  await page.getByRole('button', { name: 'Buy reserved materials', exact: true }).click();
  expect((await snapshot(page)).stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0)).toBe(quantity);
  for (let i = 0; i < 8; i++) {
    const current = await page.evaluate(() => window.helixHeresyDebug.commodityMarketSnapshot().consignments);
    const reservationId = (await snapshot(page)).service.reservation.consignmentId;
    if (current.some(c => c.id === reservationId && c.status === 'received')) break;
    const pending = await snapshot(page), unloading = pending.tasks.find(task => task.type === 'commodityFreight');
    if (unloading) await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, unloading.dueAt - pending.clock + 1));
    else await page.evaluate(() => window.helixHeresyDebug.advanceStrategicServices(3600));
  }
  expect((await snapshot(page)).stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0)).toBe(quantity + 2);
  const campaign = await page.evaluate(() => window.helixHeresyDebug.campaignSnapshot());
  expect(campaign.localLeverage.service).not.toBeNull(); expect(campaign.localLeverage.reservation).not.toBeNull();
  expect(campaign.accomplishedAt).toBeNull();
  expect(errors).toEqual([]);
});

test('negative findings earn payment, while off-site customer state stays a dated report and death freezes obligations', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ condition: 55 }));
  await completeService(page);
  let state = await snapshot(page);
  expect(state.service.jobs[0]).toMatchObject({ lotStatus: 'quarantined', status: 'completed' });
  expect(state.service.trust).toBe(1);
  expect(JSON.stringify(state.known)).not.toContain('burden');
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: true }));
  const known = (await snapshot(page)).known;
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ reserveStock: 0, utilities: 0 }));
  expect((await snapshot(page)).known).toEqual(known);
  await expect(page.locator('#economyServicesList')).toContainText('last received report');
  expect(await page.evaluate(() => window.helixHeresyDebug.localServiceAction('reserve'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: false, utilities: 1 }));
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  await expect(page.locator('#runOutcomePanel')).toBeVisible();
  state = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.localServiceAction('accept'))).toBe(false);
  expect((await snapshot(page)).service).toEqual(state.service);
  const death = await page.evaluate(() => window.helixHeresyDebug.runLifecycleSnapshot());
  expect(death.postmortem.accomplishments.some(e => e.label === 'Complete useful work for a local customer')).toBe(true);
  expect(errors).toEqual([]);
});
