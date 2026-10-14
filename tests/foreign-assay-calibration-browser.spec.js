const { test, expect } = require('@playwright/test');
const { openForeignWorkspace, workspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const calibration = (s, id) => s.diagnostics.instruments[id];
const task = s => s.tasks.find(t => t.data?.workflowId === 'calibrateInstrument');
test('canvas foreign Case calibration uses original physical tools, retains interrupted work across reload, and changes accuracy only', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page, 'foreign-case-calibration', 'canvas', true);
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-foreign-assay-workspace]');
  await expect(panel).toContainText('personal calibration');
  let s = await workspace(page); const id = s.tools.find(t => t.carriedBy === 'scientist').id;
  // Check unsupported procedures and missing/locality/lease/body/bench constraints
  // before any stamina, money, item, or task reservation is spent.
  const denials = await page.evaluate(() => {
    const d = window.helixHeresyDebug, original = d.exportSurveyExpeditionTestState(), out = [];
    for (const kind of ['otherInstrument', 'broken', 'missingStack', 'homeOnly', 'expired', 'noAuthority', 'newBody', 'missingBench', 'movedBench']) {
      const s = JSON.parse(JSON.stringify(original)), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b'), w = g.foreignWorkspace;
      const tool = s.toolDurability.assayCase.find(t => t.roomId === w.roomId), stack = s.physicalItemStacks.find(i => i.toolInstanceId === tool.id);
      if (kind === 'broken') tool.current = 0;
      if (kind === 'missingStack') s.physicalItemStacks = s.physicalItemStacks.filter(i => i.id !== stack.id);
      if (kind === 'homeOnly') { tool.roomId = stack.roomId = 'main'; tool.carriedBy = stack.carriedBy = ''; }
      if (kind === 'expired') w.lease.endsAt = s.clock;
      if (kind === 'noAuthority') g.preparedWorkspaceTestSource.city.physicalCondition = 'ruined';
      if (kind === 'newBody') s.scientistIdentity.bodyEpoch++;
      if (kind === 'missingBench') s.fixtures = s.fixtures.filter(f => f.id !== w.benchId);
      if (kind === 'movedBench') s.fixtures.find(f => f.id === w.benchId).origin = { x: 10, y: 7, z: g.z };
      d.importSurveyExpeditionTestState(s); const before = d.exportSurveyExpeditionTestState();
      const started = d.startDiagnosticCalibration(kind === 'otherInstrument' ? 'thaumometer' : 'assayCase'), after = d.exportSurveyExpeditionTestState();
      out.push({ kind, started, unchanged: before.scientist.vitals.stamina.current === after.scientist.vitals.stamina.current
        && before.economy.money === after.economy.money && before.tasks.length === after.tasks.length
        && JSON.stringify(before.toolDurability) === JSON.stringify(after.toolDurability) });
    }
    d.importSurveyExpeditionTestState(original); return out;
  });
  for (const denial of denials) { expect(denial.started, denial.kind).toBe(false); expect(denial.unchanged, denial.kind).toBe(true); }
  s = await workspace(page);
  const sample = s.diagnostics.samples.find(p => s.stacks.some(i => i.id === p.stackId && i.roomId === s.saved.roomId));
  const reagent = s.stacks.find(i => i.key === 'assayReagent' && i.carriedBy === 'scientist');
  expect(await wa(page, 'drop', { stackId: reagent.id })).toBe(true);
  expect(await wa(page, 'assay', { stackId: sample.stackId })).toBe(true); await finish(page);
  s = await workspace(page); const earlierFindings = s.diagnostics.results, earlierSamples = s.diagnostics.samples;
  const worn = s.tools.find(t => t.id === id).current, money = s.money, goods = s.stacks;
  expect(calibration(s, id).calibration).toBeLessThan(100);
  // Cancellation releases the specific reserved Case without refunding effort or
  // applying a completed reference reset.
  const beforeCancel = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.vitals.stamina.current);
  await panel.getByRole('button', { name: 'Calibrate own Assay Case at foreign bench', exact: true }).click();
  s = await workspace(page); expect(task(s).data.instrumentInstanceId).toBe(id);
  expect(s.tools.find(t => t.id === id).reservedTaskId).toBe(task(s).id);
  expect(await page.evaluate(() => window.helixHeresyDebug.startDiagnosticCalibration('assayCase'))).toBe(false);
  await panel.getByRole('button', { name: 'Cancel foreign workspace diagnostic work', exact: true }).click();
  s = await workspace(page); expect(task(s)).toBeUndefined(); expect(s.tools.find(t => t.id === id).reservedTaskId).toBeFalsy();
  expect(calibration(s, id).calibration).toBeLessThan(100);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().scientist.vitals.stamina.current)).toBeLessThan(beforeCancel);
  await panel.getByRole('button', { name: 'Calibrate own Assay Case at foreign bench', exact: true }).click();
  await advance(page, 1); s = await workspace(page); const originalTask = task(s);
  expect(originalTask.data.workstationId).toBe(s.saved.benchId);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignWorkspace.lease.endsAt = s.clock + 1;
    d.importSurveyExpeditionTestState(s); });
  await advance(page, 60); s = await workspace(page); const heldAt = task(s).data.foreignWorkspaceHeldAt;
  expect(task(s).reason).toContain('expired'); expect(heldAt).toBeTruthy();
  expect(calibration(s, id).calibration).toBeLessThan(100);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  await advance(page, 120); s = await workspace(page);
  expect(task(s).id).toBe(originalTask.id); expect(task(s).data.foreignWorkspaceHeldAt).toBe(heldAt);
  expect(calibration(s, id).calibration).toBeLessThan(100);
  expect(s.tools.find(t => t.id === id).current).toBe(worn);
  // Renewal is attended at the original desk; resumption uses a real return path
  // and remaining work, never backfills the expired interval.
  expect(await wa(page, 'walk')).toBe(true); await finish(page);
  expect(await wa(page, 'quote')).toBe(true); s = await workspace(page);
  expect(await wa(page, 'sign', { expected: s.saved.quote })).toBe(true);
  s = await workspace(page); expect(calibration(s, id).calibration).toBeLessThan(100);
  expect(task(s).dueAt).toBeGreaterThan(s.clock); expect(task(s).data.movement.steps[0].cell).toEqual(s.cell);
  await finish(page); s = await workspace(page);
  expect(task(s)).toBeUndefined(); expect(calibration(s, id)).toMatchObject({ calibration: 100, usesSinceCalibration: 0, lastCalibratedAt: s.clock });
  expect(s.tools.find(t => t.id === id).current).toBe(worn); expect(s.money).toBe(money - 225);
  expect(s.diagnostics.results).toEqual(earlierFindings); expect(s.diagnostics.samples).toEqual(earlierSamples);
  expect(s.stacks.map(i => [i.id, i.quantity, i.toolInstanceId])).toEqual(goods.map(i => [i.id, i.quantity, i.toolInstanceId]));
  await expect(panel.getByRole('button', { name: 'Calibrate own Assay Case at foreign bench', exact: true })).toBeDisabled();
  expect(await wa(page, 'calibrate')).toBe(false);
  // A second operation cannot migrate to a replacement body or consume time
  // after irreversible death.
  await page.evaluate(() => window.helixHeresyDebug.setInstrumentCalibration('assayCase', 40));
  expect(await wa(page, 'calibrate')).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), w = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignWorkspace;
    s.scientistIdentity.bodyEpoch++; w.permission.bodyEpoch = s.scientistIdentity.bodyEpoch;
    // Even a new property permission cannot transfer an old calibration task.
    s.intercityPassenger.trip.bodyEpoch = s.scientistIdentity.bodyEpoch;
    d.importSurveyExpeditionTestState(s); });
  expect(task(await workspace(page)).reason).not.toBe('');
  await advance(page, 120); expect(calibration(await workspace(page), id).calibration).toBe(40);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  const frozen = await workspace(page); await advance(page, 120); const dead = await workspace(page);
  expect(dead.clock).toBe(frozen.clock); expect(dead.diagnostics).toEqual(frozen.diagnostics); expect(dead.tools).toEqual(frozen.tools);
  expect(await wa(page, 'calibrate')).toBe(false); expect(errors).toEqual([]);
});
