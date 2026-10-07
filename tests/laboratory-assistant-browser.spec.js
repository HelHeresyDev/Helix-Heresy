const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(180000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantSnapshot());
async function openWorkers(page) {
  if (!await page.locator('[data-economy-menu-tab="workers"]').isVisible()) await page.locator('[data-workspace-tab="economy"]').click();
  await page.locator('[data-economy-menu-tab="workers"]').click();
}
async function start(page) {
  page.setDefaultTimeout(30000);
  await startLifecycleRun(page, 'laboratory-technician');
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Test lab', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true, localDistanceKm: 1, routeContinuity: 'municipal', dangerBand: 'low' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Local city', cellId: 'cell:1', supportComponentId: 'component:a', known: true, reachable: true }
  ] }, 'laboratory-technician'));
  const source = await page.evaluate(() => window.helixHeresyDebug.configureLaboratoryAssistantTestSupport());
  expect(source).toBeTruthy(); await openWorkers(page); return source;
}
async function hire(page) {
  await page.getByRole('button', { name: 'Review 2-hour technician shift', exact: true }).click();
  await expect(page.locator('#laboratoryAssistantList')).toContainText('underground workspace Main Lab');
  await expect(page.getByRole('button', { name: /^Hire assay technician/ })).toBeDisabled();
  const before = await snapshot(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantAction('hire', { consent: false }))).toBe(false);
  expect((await snapshot(page)).money).toBe(before.money);
  await page.locator('[data-technician-consent]').check();
  await page.getByRole('button', { name: 'Hire assay technician', exact: true }).click();
  let s = await snapshot(page); expect(s.saved.actor.id).not.toBe(s.porter.actor.id); expect(s.money).toBe(before.money - 88);
  expect(s.saved.actor.present).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(910));
  expect((await snapshot(page)).saved.actor.present).toBe(false);
  await page.evaluate(() => { window.helixHeresyDebug.setDoorLockPhysicalState('door-surface-loading', 'unlocked'); window.helixHeresyDebug.advanceLaboratoryAssistantForTest(10); });
  s = await snapshot(page); expect(s.saved.actor.present, JSON.stringify(s.saved)).toBe(true);
  await page.getByRole('button', { name: 'Walk to technician receiving area', exact: true }).click();
  for (let i = 0; i < 6; i++) {
    const s = await snapshot(page), task = s.tasks.find(t => t.type === 'scientistMove'); if (!task) break;
    await page.evaluate(seconds => window.helixHeresyDebug.advanceBoundaryTravelForTest(seconds), Math.max(1, task.dueAt - s.clock + 1));
  }
  expect((await snapshot(page)).scientist.roomId).toBe('surfaceLoadingBay');
  await page.getByRole('button', { name: 'Receive technician report', exact: true }).click();
}

test('informed technician employment reserves and physically carries supplies, reloads, and discloses an actual assay only on receipt', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = await start(page); await hire(page);
  const before = await snapshot(page), reagent = before.stacks.filter(s => s.key === 'assayReagent').reduce((n, s) => n + s.quantity, 0);
  await page.locator('[data-technician-sample]').selectOption(source);
  await page.getByRole('button', { name: 'Delegate sealed sample assay', exact: true }).click();
  let s = await snapshot(page); expect(s.saved.orders).toHaveLength(1);
  expect(s.bench.productionTaskId).toBe(s.saved.orders[0].id); expect(s.tools[0].reservedTaskId).toBe(s.saved.orders[0].id);
  expect(s.tasks).toEqual(before.tasks); expect(s.scientist.vitals).toEqual(before.scientist.vitals);
  expect(await page.evaluate(id => window.helixHeresyDebug.startDiagnosticSampleAssay(id), source)).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(100));
  s = await snapshot(page); expect(s.stacks.some(item => item.carriedBy === s.saved.actor.id), JSON.stringify(s.saved.orders)).toBe(true);
  const identity = s.saved.actor.id, originalToolCondition = s.tools[0].current;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await openWorkers(page);
  s = await snapshot(page); expect(s.saved.actor.id).toBe(identity);
  expect(s.bench.productionTaskId).toBe(s.saved.orders[0].id); expect(s.tools[0].reservedTaskId).toBe(s.saved.orders[0].id);
  expect(s.stacks.some(item => item.carriedBy === identity)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ away: true }));
  const known = (await snapshot(page)).known;
  expect(await page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantAction('cancel'))).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(1800));
  s = await snapshot(page);
  expect(s.saved.orders[0].status, JSON.stringify({ actor: s.saved.actor, order: s.saved.orders[0] })).toBe('completed');
  expect(s.saved.actor.observations.some(o => o.roomId === 'mainLab')).toBe(true);
  expect(s.saved.orders[0].result.confidenceScore).toBeGreaterThan(0); expect(s.known).toEqual(known);
  expect(s.diagnostics.results).toHaveLength(before.diagnostics.results.length);
  expect(s.research.evidence).toHaveLength(before.research.evidence.length);
  expect(s.stacks.some(item => item.id === source)).toBe(false);
  expect(s.stacks.filter(item => item.key === 'assayReagent').reduce((n, item) => n + item.quantity, 0)).toBe(reagent - 1);
  expect(s.tools[0].current).toBe(originalToolCondition - 1);
  expect(s.bench.productionTaskId).toBe(''); expect(s.tools[0].reservedTaskId).toBe('');
  expect(s.scientist.skills).toEqual(before.scientist.skills);
  const packet = s.stacks.find(item => item.id === s.saved.orders[0].reportStackId);
  expect(packet).toMatchObject({ key: 'assistantReportPacket', roomId: 'mainLab', carriedBy: '' });
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ away: false }));
  expect(await page.evaluate(id => window.helixHeresyDebug.laboratoryAssistantAction('retrieve', { stackId: id }), packet.id)).toBe(false);
  await page.evaluate(id => window.helixHeresyDebug.setLaboratoryAssistantForTest({ nearRecord: id }), packet.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.laboratoryAssistantAction('retrieve', { stackId: id }), packet.id)).toBe(true);
  s = await snapshot(page); expect(s.known.orders[0].result).toBeTruthy(); expect(s.diagnostics.results).toHaveLength(before.diagnostics.results.length + 1);
  expect(s.research.evidence).toHaveLength(before.research.evidence.length + 1);
  expect(await page.evaluate(id => window.helixHeresyDebug.laboratoryAssistantAction('retrieve', { stackId: id }), packet.id)).toBe(false);
  expect((await snapshot(page)).research.evidence).toHaveLength(s.research.evidence.length);
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ nearby: true }));
  await openWorkers(page);
  await page.getByRole('button', { name: 'End technician shift', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(2200));
  s = await snapshot(page); expect(s.saved.contract.status).toBe('completed'); expect(s.money + s.saved.actor.money).toBeCloseTo(1000);
  expect(errors).toEqual([]);
});

test('changed permissions or broken original equipment halt assays; cancellation preserves unused goods and death freezes custody', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const source = await start(page); await hire(page);
  expect(await page.evaluate(id => window.helixHeresyDebug.laboratoryAssistantAction('assign', { stackId: id }), source)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(100));
  let s = await snapshot(page); expect(s.saved.orders[0].status).toBe('active');
  const condition = s.tools[0].current;
  const blockedCell = s.saved.actor.mapCell;
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ blockRoom: 'mainLab' }));
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(100));
  s = await snapshot(page); expect(s.saved.orders[0].result).toBeNull(); expect(s.saved.orders[0].reason).toContain('forbidden');
  expect(s.saved.actor.mapCell).toEqual(blockedCell);
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ clearBlock: true, toolCondition: 0 }));
  const cell = (await snapshot(page)).saved.actor.mapCell;
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(300));
  s = await snapshot(page); expect(s.saved.actor.mapCell).toEqual(cell); expect(s.saved.orders[0].reason).toContain('broken');
  expect(s.saved.orders[0].result).toBeNull(); expect(s.diagnostics.results).toEqual([]);
  await page.evaluate(() => window.helixHeresyDebug.setLaboratoryAssistantForTest({ nearby: true, toolCondition: 70 }));
  await openWorkers(page);
  await page.getByRole('button', { name: 'Cancel technician assay', exact: true }).click();
  s = await snapshot(page); expect(s.saved.orders[0].status).toBe('cancelled');
  expect(s.stacks.filter(item => item.key === 'assayReagent').reduce((n, item) => n + item.quantity, 0)).toBe(12);
  expect(s.stacks.find(item => item.id === source)).toBeTruthy(); expect(s.stacks.filter(item => item.carriedBy === s.saved.actor.id)).toEqual([]);
  expect(s.bench.productionTaskId).toBe(''); expect(s.tools[0].reservedTaskId).toBe(''); expect(condition).toBeGreaterThan(0);
  const hit = await page.evaluate(() => window.helixHeresyDebug.laboratoryAssistantCombatForTest(15));
  expect(hit).toMatchObject({ ok: true, hit: true, damage: 15 });
  s = await snapshot(page); expect(s.saved.actor.health).toBe(85);
  expect(s.injuries).toEqual(expect.arrayContaining([expect.objectContaining({ actorId: s.saved.actor.id, actorKind: 'laboratoryAssistant', typeId: 'bleeding' })]));
  await page.evaluate(() => { window.helixHeresyDebug.laboratoryAssistantCombatForTest(200); window.helixHeresyDebug.advanceLaboratoryAssistantForTest(10); });
  s = await snapshot(page); expect(s.saved.actor.status).toBe('dead'); expect(s.saved.contract.status).toBe('fatality');
  expect(s.saved.contract.settled).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const dead = await snapshot(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceLaboratoryAssistantForTest(3600));
  s = await snapshot(page); expect(s.saved).toEqual(dead.saved); expect(s.known).toEqual(dead.known);
  // A debug render may restamp an existing observation, but cannot move or change physical goods.
  const physicalGoods = stacks => stacks.map(({ observedAt, ...item }) => item);
  expect(physicalGoods(s.stacks)).toEqual(physicalGoods(dead.stacks));
  expect(errors).toEqual([]);
});
