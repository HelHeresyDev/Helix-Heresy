const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.civicAssaySnapshot());
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceStrategicServices(seconds), seconds);
const jobRow = (page, id) => page.locator(`[data-local-service-job="${id}"]`);
async function start(page, seed) {
  page.setDefaultTimeout(30000);
  await startLifecycleRun(page, seed);
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test laboratory', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Test City', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
    ]
  }, 'civic-assay-focused'));
  await page.evaluate(() => window.helixHeresyDebug.configureCivicAssayTestSupport());
  await open(page);
}
async function open(page) {
  await page.locator('[data-workspace-tab="economy"]').click(); await page.locator('[data-economy-menu-tab="services"]').click();
}
async function freight(page, id) {
  for (let i = 0; i < 20; i++) {
    const s = await snapshot(page), j = s.service.jobs.find(j => j.id === id);
    if (j.status === 'awaitingAssay') return;
    const t = s.tasks.find(t => t.type === 'commodityFreight');
    if (t) await page.evaluate(n => window.helixHeresyDebug.advanceBoundaryTravelForTest(n), Math.max(1, t.dueAt - s.clock + 1));
    else await advance(page, 3600);
  }
  throw new Error(`No physical receipt for ${id}: ${JSON.stringify((await snapshot(page)).service.jobs)}`);
}
async function assay(page, id) {
  const before = await snapshot(page), j = before.service.jobs.find(j => j.id === id);
  const portions = before.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
  await jobRow(page, id).getByRole('button', { name: 'Analyze customer sample', exact: true }).click();
  for (let i = 0; i < 8; i++) {
    const s = await snapshot(page), t = s.tasks.find(t => t.type === 'physicalDiagnostic'); if (!t) break;
    await page.evaluate(n => window.helixHeresyDebug.advanceBoundaryTravelForTest(n), Math.max(1, t.dueAt - s.clock + 1));
  }
  const s = await snapshot(page); expect(s.service.jobs.find(j => j.id === id).status).toBe('assayed');
  expect(s.stacks.some(s => s.id === j.sampleStackId)).toBe(false);
  expect(s.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0)).toBe(portions - 1);
  await jobRow(page, id).getByRole('button', { name: 'Preview exact report disclosure', exact: true }).click();
}
async function qualifyAndGrant(page) {
  expect(await page.evaluate(() => window.helixHeresyDebug.civicAssayAction('request'))).toBe(false);
  await page.getByRole('button', { name: 'Accept testing service', exact: true }).click();
  const id = (await snapshot(page)).service.jobs.at(-1).id;
  await freight(page, id); await assay(page, id);
  await jobRow(page, id).getByRole('button', { name: 'Send previewed report', exact: true }).click();
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Request civic mandate terms', exact: true }).click();
  const pending = (await snapshot(page)).mandate.proposal; expect(pending.status).toBe('pending');
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await open(page);
  expect((await snapshot(page)).mandate.proposal.id).toBe(pending.id);
  await advance(page, pending.readyAt - (await snapshot(page)).clock);
  await expect(page.locator('[data-civic-terms]')).not.toContainText('burden');
  await page.getByRole('button', { name: 'Sign exact civic mandate', exact: true }).click();
  const s = await snapshot(page), m = s.mandate.mandates.at(-1);
  expect(m.status).toBe('active'); expect(m.endsAt - m.startsAt).toBe(72 * 3600);
  expect(s.money).toBe(before.money); expect(s.campaign.cityPower.mandate.sourceId).toBe(m.id);
  expect(s.campaign.accomplishedAt).toBeNull(); return m;
}
test('charter mandate uses real qualification, three exact batches, chosen dispatch, physical assays and binding clearance without private bypass', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, 'civic-mandate-learning');
  await qualifyAndGrant(page);
  const before = await snapshot(page), stock = before.production.workshops.find(w => w.id === 'rubber').stock;
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Enroll identified civic batch', exact: true }).click();
  let s = await snapshot(page), m = s.mandate.mandates.at(-1); expect(m.jobIds).toHaveLength(3);
  expect(s.production.workshops.find(w => w.id === 'rubber').stock).toBeCloseTo(stock - 3);
  expect(s.service.jobs.filter(j => m.jobIds.includes(j.id)).every(j => !j.shipmentId && !j.consignmentId)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.civicAssayAction('enroll', '', { freight: 0 }))).toBe(false);
  const id = m.jobIds[1];
  await page.locator(`[data-civic-batch="${id}"] [data-civic-action="priority"]`).click();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await open(page);
  expect((await snapshot(page)).mandate.mandates.at(-1).priorityJobId).toBe(id);
  await page.getByRole('button', { name: 'Dispatch priority civic sample', exact: true }).click();
  s = await snapshot(page); expect(s.service.jobs.find(j => j.id === id).civic.dispatchApproved).toBe(true);
  expect(s.service.jobs.find(j => j.id === m.jobIds[0]).shipmentId).toBe('');
  await freight(page, id); await assay(page, id);
  expect(await page.evaluate(id => window.helixHeresyDebug.localServiceAction('submit', id), id)).toBe(false);
  await expect(jobRow(page, id).getByRole('button', { name: /^Send previewed report/ })).toBeDisabled();
  s = await snapshot(page); const money = s.money;
  await page.locator(`[data-civic-batch="${id}"] [data-civic-action="clear"]`).click();
  s = await snapshot(page); expect(s.service.jobs.find(j => j.id === id).lotStatus).toBe('released'); expect(s.money).toBe(money + 120);
  expect(await page.evaluate(id => window.helixHeresyDebug.civicAssayAction('clear', id), id)).toBe(false);
  expect((await snapshot(page)).money).toBe(money + 120);
  const saved = (await snapshot(page)).mandate;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).mandate).toEqual(saved);
  expect(JSON.stringify((await snapshot(page)).known)).not.toMatch(/burden|feeEscrow|heldQuantity|workSeconds/);
  const dated = (await snapshot(page)).known, term = saved.mandates.at(-1);
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: true }));
  await advance(page, term.endsAt + 1 - (await snapshot(page)).clock);
  s = await snapshot(page); expect(s.mandate.mandates.at(-1).status).toBe('expired'); expect(s.known).toEqual(dated);
  expect(s.service.jobs.filter(j => term.jobIds.includes(j.id) && j.id !== id).every(j => j.heldQuantity === .9)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: false }));
  expect((await snapshot(page)).known.mandates.at(-1).status).toBe('expired');
  expect((await snapshot(page)).campaign.cityPower.mandate.sourceId).toBe(term.id);
  expect(errors).toEqual([]);
});
test('producer delay review is saved and capacity-bound, hands back without releasing goods, expires offsite without surveillance and freezes on death', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, 'civic-mandate-review');
  const granted = await qualifyAndGrant(page);
  await page.getByRole('button', { name: 'Enroll identified civic batch', exact: true }).click();
  let s = await snapshot(page); const id = s.mandate.mandates.at(-1).jobIds[0], accepted = s.service.jobs.find(j => j.id === id);
  await advance(page, accepted.acceptedAt + 86400 - s.clock);
  await expect(page.locator('[data-civic-assay-mandate]')).toContainText('Producer requests review');
  const review = (await snapshot(page)).mandate.mandates.at(-1).review; expect(review.status).toBe('pending');
  expect(review.filedBy).toBe((await snapshot(page)).service.client.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.civicAssayAction('review'))).toBe(false);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await open(page);
  expect((await snapshot(page)).mandate.mandates.at(-1).review.evidence).toEqual(review.evidence);
  await page.evaluate(() => window.helixHeresyDebug.setCivicAssayTestOfficeAvailability('civic-review', false));
  await advance(page, review.readyAt - (await snapshot(page)).clock);
  expect((await snapshot(page)).mandate.mandates.at(-1).review.status).toBe('pending');
  await page.evaluate(() => window.helixHeresyDebug.setCivicAssayTestOfficeAvailability('civic-review', true)); await advance(page, 1);
  s = await snapshot(page); expect(s.mandate.mandates.at(-1).review.outcome).toBe('suspended');
  expect(s.service.jobs.find(j => j.id === id).civic.returned).toBe(true);
  expect(s.service.jobs.find(j => j.id === id).heldQuantity).toBe(.9);
  expect(s.mandate.mandates.at(-1).handedBackAt).toBe(review.readyAt);
  expect(s.mandate.mandates.at(-1).review.completedAt).toBe(review.readyAt);
  // A fresh mandate is not automatic, and a previous campaign appointment remains only a historical receipt.
  expect(s.campaign.cityPower.mandate.sourceId).toBe(granted.id);
  const known = s.known;
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: true }));
  await advance(page, granted.endsAt + 1 - (await snapshot(page)).clock);
  expect((await snapshot(page)).known).toEqual(known);
  expect(await page.evaluate(() => window.helixHeresyDebug.civicAssayAction('request'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setLocalServiceCustomerForTest({ away: false }));
  expect((await snapshot(page)).known.reportedAt).toBeGreaterThan(known.reportedAt);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = (await snapshot(page)).mandate;
  await page.evaluate(() => window.helixHeresyDebug.advanceTestRunTime(3600));
  expect((await snapshot(page)).mandate).toEqual(frozen);
  expect(await page.evaluate(() => window.helixHeresyDebug.civicAssayAction('request'))).toBe(false); expect(errors).toEqual([]);
});
