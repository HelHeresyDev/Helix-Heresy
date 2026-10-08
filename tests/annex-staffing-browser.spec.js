const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(360000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantSnapshot());
const action = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.laboratoryAssistantAction(action, options), { action, options });
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(seconds), seconds);
const panel = page => page.locator('[data-annex-technician]:visible');
async function visits(page) {
  if (!await page.locator('#visitsList').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
}
async function start(page) {
  page.setDefaultTimeout(30000);
  await startLifecycleRun(page, 'annex-staffing');
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, 'annex-staffing'));
  await page.evaluate(() => window.helixHeresyDebug.configureLaboratoryAssistantTestSupport());
  await page.locator('[data-workspace-tab="economy"]').click(); await page.locator('[data-economy-menu-tab="facilities"]').click();
  const property = await page.evaluate(() => window.helixHeresyDebug.leasedAnnexSnapshot());
  expect(property.saved, JSON.stringify({ route: property.route, scientist: property.scientist })).toBeTruthy();
  await page.getByRole('button', { name: 'Review annex lease', exact: true }).click();
  await page.getByRole('button', { name: 'Sign exact annex terms', exact: true }).click();
  const ids = await page.evaluate(() => window.helixHeresyDebug.prepareAnnexTechnicianForTest());
  const identity = (await snapshot(page)).saved.actor.id;
  await panel(page).getByRole('button', { name: 'Review 2-hour annex technician shift', exact: true }).click();
  await expect(panel(page)).toContainText('leased aboveground workspace');
  expect(await action(page, 'hire', { consent: false, workplace: 'leasedAnnex' })).toBe(false);
  await panel(page).locator('[data-technician-consent]').check();
  await panel(page).getByRole('button', { name: 'Hire annex assay technician', exact: true }).click();
  expect((await snapshot(page)).money).toBe(537);
  expect(await action(page, 'quote', { workplace: 'laboratory' })).toBe(false);
  await page.evaluate(() => { window.helixHeresyDebug.setDoorLockPhysicalState('door-surface-loading', 'locked');
    window.helixHeresyDebug.setLeasedAnnexTestSupport({ atAnnex: true, breakOriginalBench: true }); });
  await advance(page, 440); expect((await snapshot(page)).saved.actor.present).toBe(false);
  await advance(page, 10); expect((await snapshot(page)).saved.actor.roomId).toBe('leasedAssayAnnex');
  expect((await snapshot(page)).saved.actor.id).toBe(identity);
  await visits(page); await panel(page).getByRole('button', { name: 'Receive technician report', exact: true }).click();
  return ids;
}
test('three exact annex assays run while absent, preserve reservations across reload and reveal findings only through physical receipt', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const ids = await start(page), initial = await snapshot(page);
  const world = await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
  expect(await action(page, 'batch', { stackIds: [ids[0], ids[0]] })).toBe(false);
  await panel(page).locator('[data-technician-sample]').selectOption(ids);
  await panel(page).getByRole('button', { name: 'Authorize annex assay queue', exact: true }).click();
  let s = await snapshot(page); expect(s.saved.orders).toHaveLength(3);
  const batch = s.saved.orders[0].batchId;
  expect(s.tools[0].reservedTaskId).toBe(batch);
  expect(await page.evaluate(id => window.helixHeresyDebug.leasedAnnexAction('assay', { stackId: id }), ids[0])).toBe(false);
  await advance(page, 140); s = await snapshot(page);
  expect(s.saved.orders[0].status).toBe('completed'); expect(s.saved.orders.some(o => o.status === 'active')).toBe(true);
  expect(s.stacks.some(item => item.carriedBy === s.saved.actor.id)).toBe(true);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page);
  s = await snapshot(page); expect(s.tools[0].reservedTaskId).toBe(batch);
  await page.evaluate(() => {
    window.helixHeresyDebug.setLaboratoryAssistantForTest({ away: true });
    window.helixHeresyDebug.setLeasedAnnexTestSupport({ atReception: true });
  });
  const known = (await snapshot(page)).known;
  expect(await action(page, 'batch', { stackIds: ids })).toBe(false);
  expect(await action(page, 'report')).toBe(false);
  await advance(page, 650); s = await snapshot(page);
  expect(s.saved.orders.map(o => o.status), JSON.stringify(s.saved.orders)).toEqual(['completed', 'completed', 'completed']);
  expect(s.known).toEqual(known); expect(s.diagnostics.results).toHaveLength(0);
  expect(s.stacks.filter(item => item.key === 'assistantReportPacket')).toHaveLength(3);
  expect(s.stacks.filter(item => item.key === 'assayReagent').reduce((n, item) => n + item.quantity, 0)).toBe(9);
  expect(s.tools[0].current).toBe(initial.tools[0].current - 3); expect(s.tools[0].reservedTaskId).toBe('');
  expect(s.scientist.skills).toEqual(initial.scientist.skills);
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ atAnnex: true }));
  await visits(page); await panel(page).getByRole('button', { name: 'Receive technician report', exact: true }).click();
  s = await snapshot(page); expect(s.diagnostics.results).toHaveLength(3);
  expect(s.saved.orders.every(o => o.receivedAt != null)).toBe(true);
  await action(page, 'report'); expect((await snapshot(page)).diagnostics.results).toHaveLength(3);
  expect(await page.evaluate(() => window.helixHeresyDebug.leasedAnnexAction('handback'))).toBe(false);
  await action(page, 'withdraw'); await advance(page, 550); s = await snapshot(page);
  expect(s.saved.contract.status).toBe('completed'); expect(s.saved.actor.present).toBe(false);
  expect(s.stacks.find(item => item.toolInstanceId === s.tools[0].id).roomId).toBe('leasedAssayAnnex');
  expect(await page.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world))).toBe(world);
  expect(errors).toEqual([]);
});
test('annex lease expiry, inaccessible exit and queue cancellation preserve unused objects and settle finite wages only after physical return', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const ids = await start(page);
  expect(await action(page, 'batch', { stackIds: ids })).toBe(true);
  await advance(page, 30); const before = await snapshot(page);
  await page.evaluate(() => window.helixHeresyDebug.setLeasedAnnexTestSupport({ expire: true }));
  await advance(page, 200); let s = await snapshot(page);
  expect(s.saved.orders.map(o => o.workSeconds)).toEqual(before.saved.orders.map(o => o.workSeconds));
  expect(s.saved.orders.every(o => o.result === null)).toBe(true); expect(s.tools[0].reservedTaskId).toBeTruthy();
  expect(await action(page, 'batch', { stackIds: ids })).toBe(false);
  expect(await action(page, 'cancel')).toBe(true); s = await snapshot(page);
  expect(s.saved.orders.every(o => o.status === 'cancelled')).toBe(true);
  expect(s.stacks.filter(item => ids.includes(item.id))).toHaveLength(3); expect(s.tools[0].reservedTaskId).toBe('');
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ blockRoom: 'leasedAssayAnnex' }));
  expect(await action(page, 'withdraw')).toBe(true); await advance(page, 100); s = await snapshot(page);
  expect(s.saved.contract.status).toBe('departing'); expect(s.saved.actor.present).toBe(true); expect(s.saved.contract.settled).toBe(false);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ clearBlock: true }));
  await advance(page, 550); s = await snapshot(page); expect(s.saved.contract.status).toBe('completed');
  expect(s.saved.contract.settled).toBe(true); const money = s.money;
  await advance(page, 100); expect((await snapshot(page)).money).toBe(money);
  expect(s.money + s.saved.actor.money).toBeCloseTo(625);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const dead = await snapshot(page);
  await advance(page, 1000); expect((await snapshot(page)).saved).toEqual(dead.saved);
  expect(errors).toEqual([]);
});
