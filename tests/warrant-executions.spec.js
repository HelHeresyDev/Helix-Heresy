// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Warrants = require('../warrant-executions.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

function action(overrides = {}) {
  return {
    id: 'institution-action-1', caseId: 'authority-case-1', demandId: 'institution-demand-1',
    institutionId: 'commercial-registry', kind: 'warrant', createdAt: 100, status: 'issued',
    ...overrides
  };
}

function demand(overrides = {}) {
  return { id: 'institution-demand-1', docket: 'CR-0001', family: 'companyRecords', ...overrides };
}

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#startRunSubmitBtn').click();
}

test('issued registry warrants freeze deterministic exact scope and service windows', () => {
  const first = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'scope-seed', clock: 100 });
  const second = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'scope-seed', clock: 100 });
  expect(first.created).toBe(true);
  expect(first.execution).toMatchObject({
    status: 'scheduled', docket: 'CR-0001',
    scope: {
      id: 'registryRecords', supported: true,
      authorizedRoomIds: ['surfaceStaffOperations'],
      authorizedFixtureIds: ['starter-surface-records-cabinet'],
      subjectCategories: ['companyRecords']
    }
  });
  expect(first.execution.arrivalAt).toBe(second.execution.arrivalAt);
  expect(Warrants.nextEvent(first.state, 100)).toMatchObject({ id: first.execution.id });
  expect(Warrants.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('environmental warrants use bounded sampling scope while law-enforcement raids remain deferred', () => {
  const environmental = Warrants.issue(Warrants.defaultState(), action({ institutionId: 'environmental-health' }), demand({ family: 'hazardousDischarge', docket: 'EH-0001' }), { seed: 'environment', clock: 100 });
  expect(environmental.execution).toMatchObject({
    status: 'scheduled', scope: { id: 'environmentalSearch', supported: true }
  });
  expect(environmental.execution.scope.authorizedRoomIds).toEqual([
    'surfaceFacility', 'surfaceHazardousStorage', 'surfaceLoadingBay'
  ]);
  expect(environmental.execution.scope.targets.every((target) => target.maxSubjects <= 2)).toBe(true);

  const deferred = Warrants.issue(Warrants.defaultState(), action({ institutionId: 'law-enforcement' }), demand({ docket: 'LE-0001', family: 'hazardousDischarge' }), { seed: 'raid', clock: 100 });
  expect(deferred.execution).toMatchObject({ status: 'deferred', scope: { id: 'deferredRaid', supported: false } });
  expect(deferred.execution.arrivalAt).toBeNull();
  expect(Warrants.nextEvent(deferred.state, 100)).toBeNull();
});

test('searched and seized exact subjects retain append-only custody through the immutable warrant return', () => {
  let state = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'custody', clock: 100 }).state;
  const execution = state.executions[0];
  state = Warrants.linkVisit(state, execution.id, 'site-visit-1', 'visitor-actor-1', 110).state;
  state = Warrants.activate(state, execution.id, 'visitor-actor-1', 120).state;
  state = Warrants.recordSearch(state, execution.id, 'company-records', {
    status: 'searched', clock: 130, observedSubjectIds: ['stack-records-1']
  }).state;
  state = Warrants.recordSeizure(state, execution.id, 'company-records', {
    sourceSubjectId: 'stack-records-1', subjectId: 'stack-records-1',
    label: 'Company records packet', quantity: 1, clock: 131
  }).state;
  state = Warrants.externalizeSeizure(state, execution.id, 'stack-records-1', {
    clock: 150, roomId: 'surfaceReception', accessPointId: 'publicEntrance'
  }).state;
  const completed = Warrants.complete(state, execution.id, 160);
  expect(completed.execution).toMatchObject({
    status: 'completed', warrantReturn: {
      outcome: 'completed', immutable: true,
      searchedTargetIds: ['company-records'], seizedSubjectIds: ['stack-records-1']
    }
  });
  expect(completed.execution.seizures[0]).toMatchObject({
    status: 'externalized', sourceSubjectId: 'stack-records-1', subjectId: 'stack-records-1'
  });
  expect(completed.execution.seizures[0].custody.map((entry) => entry.action)).toEqual([
    'located', 'carried', 'externalized'
  ]);
});

test('denied scope produces an obstructed return without inventing searched subjects', () => {
  let state = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'denial', clock: 100 }).state;
  const execution = state.executions[0];
  state = Warrants.recordObstruction(state, execution.id, 'evidence-obstruction-1', 'company-records', 130).state;
  const completed = Warrants.complete(state, execution.id, 140);
  expect(completed.execution).toMatchObject({
    status: 'obstructed', warrantReturn: {
      outcome: 'obstructed', deniedTargetIds: ['company-records'],
      searchedTargetIds: [], seizedSubjectIds: [], obstructionIds: ['evidence-obstruction-1']
    }
  });
  expect(completed.execution.scope.targets[0].observedSubjectIds).toEqual([]);
});

test('obstructed supported warrants schedule deterministic bounded forced-entry returns', () => {
  const obstructedState = () => {
    let state = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'forced-entry', clock: 100 }).state;
    const execution = state.executions[0];
    state = Warrants.recordObstruction(state, execution.id, 'evidence-obstruction-1', 'company-records', 130).state;
    return Warrants.complete(state, execution.id, 140).state;
  };
  const first = Warrants.authorizeForcedEntry(obstructedState(), 'warrant-execution-1', { seed: 'forced-entry', clock: 140 });
  const second = Warrants.authorizeForcedEntry(obstructedState(), 'warrant-execution-1', { seed: 'forced-entry', clock: 140 });
  expect(first.created).toBe(true);
  expect(first.execution.warrantReturn).toMatchObject({ outcome: 'obstructed', immutable: true });
  expect(first.forcedEntry).toMatchObject({
    status: 'scheduled', targets: [{ targetId: 'company-records', status: 'pending' }]
  });
  expect(first.forcedEntry.arrivalAt).toBe(second.forcedEntry.arrivalAt);
  expect(first.forcedEntry.arrivalAt - first.forcedEntry.authorizedAt).toBeGreaterThanOrEqual(2 * 3600);
  expect(first.forcedEntry.arrivalAt - first.forcedEntry.authorizedAt).toBeLessThan(6 * 3600);
  expect(Warrants.nextForcedEntryEvent(first.state, 140)?.id).toBe(first.execution.id);
  expect(Warrants.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('forced-entry barriers retain damage, late compliance, and original scope boundaries', () => {
  let state = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'barrier', clock: 100 }).state;
  let execution = state.executions[0];
  state = Warrants.recordObstruction(state, execution.id, 'evidence-obstruction-1', 'company-records', 130).state;
  state = Warrants.complete(state, execution.id, 140).state;
  state = Warrants.authorizeForcedEntry(state, execution.id, { seed: 'barrier', clock: 140 }).state;
  state = Warrants.activateForcedEntry(state, execution.id, 'lead-1', 'breach-1', 150).state;
  const authorized = Warrants.authorizeBarrier(state, execution.id, {
    targetId: 'company-records', kind: 'door', barrierId: 'door-records',
    cell: { x: 2, y: 3, z: 1 }, label: 'Records door', condition: 100, clock: 151
  });
  state = Warrants.recordBreachProgress(authorized.state, execution.id, authorized.barrier.id, {
    clock: 160, currentCondition: 72, breached: false
  }).state;
  const complied = Warrants.recordLateCompliance(state, execution.id, 'company-records', authorized.barrier.id, 170);
  expect(complied.barrier).toMatchObject({
    status: 'complied', startingCondition: 100, currentCondition: 72, damageApplied: 28, lateComplianceAt: 170
  });
  expect(complied.execution.warrantReturn).toMatchObject({ outcome: 'obstructed', deniedTargetIds: ['company-records'] });
  expect(complied.execution.scope.authorizedRoomIds).toEqual(['surfaceStaffOperations']);
});

test('plain-view expansion records its physical justification separately and violence causes withdrawal', () => {
  let state = Warrants.issue(Warrants.defaultState(), action(), demand(), { seed: 'expansion', clock: 100 }).state;
  const id = state.executions[0].id;
  state = Warrants.recordObstruction(state, id, 'evidence-obstruction-1', 'company-records', 130).state;
  state = Warrants.complete(state, id, 140).state;
  state = Warrants.authorizeForcedEntry(state, id, { seed: 'expansion', clock: 140 }).state;
  state = Warrants.activateForcedEntry(state, id, 'lead-1', 'breach-1', 150).state;
  const expanded = Warrants.authorizeExpansion(state, id, {
    evidenceId: 'evidence-obvious-1', observationId: 'plain-view:1', roomId: 'surfaceReception',
    sourceCell: { x: 4, y: 5, z: 1 }, label: 'Obvious chemical spill',
    subjectCategories: ['hazardousMaterial'], maxSubjects: 1, reason: 'Observed through an open adjoining doorway.', clock: 155
  });
  expect(expanded.created).toBe(true);
  expect(expanded.execution.scope.authorizedRoomIds).toEqual(['surfaceStaffOperations']);
  expect(expanded.expansion).toMatchObject({
    evidenceId: 'evidence-obvious-1', observationId: 'plain-view:1', roomId: 'surfaceReception'
  });
  state = Warrants.recordViolentObstruction(expanded.state, id, 'evidence-violence-1', 'The team was attacked and withdrew.', 160).state;
  const completed = Warrants.completeForcedEntry(state, id, 170);
  expect(completed.execution).toMatchObject({
    status: 'obstructed', forcedEntry: {
      status: 'withdrawn', supplementalReturn: { outcome: 'withdrawn', immutable: true, violenceIds: ['evidence-violence-1'] }
    }
  });
});

test('@smoke a registry warrant is served, physically searches records, carries exact packets out, and survives reload', async ({ page }) => {
  await startRun(page);
  const scheduled = await page.evaluate(() => {
    window.helixHeresyDebug.ensureCompanyRecordPackets();
    return window.helixHeresyDebug.issueTestWarrant('commercial-registry', { immediate: true });
  });
  expect(scheduled).toMatchObject({
    status: 'scheduled', scope: { id: 'registryRecords' }, visitId: expect.stringMatching(/^site-visit-/)
  });

  await page.evaluate(() => window.helixHeresyDebug.updateSiteVisits(60));
  let visit = await page.evaluate((visitId) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId), scheduled.visitId);
  expect(visit.sourceKind).toBe('warrantExecution');
  expect(visit.actor.present).toBe(true);

  await page.evaluate((visitId) => window.helixHeresyDebug.grantSiteVisitMandate(visitId), scheduled.visitId);
  await page.evaluate(() => window.helixHeresyDebug.setStorageFixtureAccessState('starter-surface-records-cabinet', 'open'));
  await page.evaluate(() => {
    for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateSiteVisits(60);
  });

  const result = await page.evaluate((executionId) => ({
    execution: window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === executionId),
    visit: window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.sourceId === executionId),
    stacks: window.helixHeresyDebug.physicalItemVisualSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot().records,
    company: window.helixHeresyDebug.companySnapshot().company
  }), scheduled.id);
  expect(result.execution).toMatchObject({
    status: 'completed', warrantReturn: { outcome: 'completed', immutable: true }
  });
  expect(result.execution.seizures.length).toBeGreaterThan(0);
  expect(result.execution.seizures.every((seizure) => seizure.status === 'externalized')).toBe(true);
  expect(result.visit.phase).toBe('completed');
  expect(result.visit.routeHistory.length).toBeGreaterThan(4);
  expect(result.execution.seizures.every((seizure) => !result.stacks.some((stack) => stack.id === seizure.subjectId))).toBe(true);
  expect(result.evidence).toContainEqual(expect.objectContaining({ lifecycle: 'externalized' }));
  expect(result.company.records).toContainEqual(expect.objectContaining({ kind: 'warrantSeizure' }));

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate((executionId) => window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === executionId), scheduled.id);
  expect(reloaded).toEqual(result.execution);
});

test('denying a served environmental warrant records obstruction but no hidden finding or seizure', async ({ page }) => {
  await startRun(page);
  const scheduled = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('environmental-health', { immediate: true }));
  await page.evaluate(() => window.helixHeresyDebug.updateSiteVisits(60));
  const before = await page.evaluate((visitId) => {
    for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateSiteVisits(60);
    return window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId);
  }, scheduled.visitId);
  const request = before.requests.find((entry) => entry.decision === 'pending');
  expect(request).toBeTruthy();
  await page.evaluate(({ visitId, requestId }) => window.helixHeresyDebug.decideSiteVisitAccess(visitId, requestId, 'denied'), {
    visitId: scheduled.visitId, requestId: request.id
  });
  const result = await page.evaluate((executionId) => ({
    execution: window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === executionId),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot().records
  }), scheduled.id);
  expect(result.execution.obstructionIds).toHaveLength(1);
  expect(result.execution.seizures).toHaveLength(0);
  expect(result.execution.scope.targets[0]).toMatchObject({ status: 'denied', observedSubjectIds: [] });
  expect(result.evidence).toContainEqual(expect.objectContaining({
    type: 'warrantObstruction', traits: expect.arrayContaining(['access denied', 'served warrant'])
  }));
});

test('@smoke an obstructed records warrant returns with a physical breach officer and honors late compliance', async ({ page }) => {
  test.setTimeout(90_000);
  await startRun(page);
  const scheduled = await page.evaluate(() => {
    window.helixHeresyDebug.ensureCompanyRecordPackets();
    for (const doorId of ['door-surface-reception-staff', 'door-surface-basement-staff', 'door-surface-staff-loading']) {
      window.helixHeresyDebug.setDoorPhysicalState(doorId, 'closed');
      window.helixHeresyDebug.setDoorLockPhysicalState(doorId, 'locked');
    }
    return window.helixHeresyDebug.issueTestWarrant('commercial-registry', { immediate: true });
  });
  await page.evaluate(() => {
    for (let index = 0; index < 5; index += 1) window.helixHeresyDebug.updateSiteVisits(30);
  });
  let visit = await page.evaluate((visitId) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId), scheduled.visitId);
  const originalRequest = visit.requests.find((entry) => entry.decision === 'pending');
  expect(originalRequest).toBeTruthy();
  await page.evaluate(({ visitId, requestId }) => window.helixHeresyDebug.decideSiteVisitAccess(visitId, requestId, 'denied'), {
    visitId: scheduled.visitId, requestId: originalRequest.id
  });
  await page.evaluate(() => {
    for (let index = 0; index < 10; index += 1) window.helixHeresyDebug.updateSiteVisits(30);
  });
  let execution = await page.evaluate((id) => window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === id), scheduled.id);
  expect(execution).toMatchObject({
    status: 'obstructed', warrantReturn: { outcome: 'obstructed', immutable: true },
    forcedEntry: { status: 'scheduled', visitId: expect.stringMatching(/^site-visit-/) }
  });
  const forcedVisitId = execution.forcedEntry.visitId;
  await page.evaluate((id) => window.helixHeresyDebug.setForcedEntryImmediate(id), scheduled.id);
  await page.evaluate(() => {
    for (let index = 0; index < 5; index += 1) window.helixHeresyDebug.updateSiteVisits(5);
  });
  visit = await page.evaluate((visitId) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId), forcedVisitId);
  expect(visit.supportActors).toEqual([
    expect.objectContaining({ label: 'Breach Officer', role: 'breach', present: true })
  ]);
  const forcedRequest = visit.requests.find((entry) => entry.decision === 'pending');
  expect(forcedRequest).toBeTruthy();
  await page.evaluate(({ visitId, requestId }) => window.helixHeresyDebug.decideSiteVisitAccess(visitId, requestId, 'denied'), {
    visitId: forcedVisitId, requestId: forcedRequest.id
  });
  await page.evaluate(() => window.helixHeresyDebug.updateSiteVisits(1));
  visit = await page.evaluate((visitId) => window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId), forcedVisitId);
  const forcedFixtureRequest = visit.requests.find((entry) => entry.decision === 'pending');
  expect(forcedFixtureRequest).toMatchObject({ targetKind: 'fixture', targetId: 'starter-surface-records-cabinet' });
  await page.evaluate(({ visitId, requestId }) => window.helixHeresyDebug.decideSiteVisitAccess(visitId, requestId, 'denied'), {
    visitId: forcedVisitId, requestId: forcedFixtureRequest.id
  });
  await page.evaluate(() => {
    for (let index = 0; index < 15; index += 1) window.helixHeresyDebug.updateSiteVisits(1);
  });
  let snapshot = await page.evaluate(({ executionId, visitId }) => ({
    execution: window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === executionId),
    visit: window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId),
    stacks: window.helixHeresyDebug.physicalItemVisualSnapshot()
  }), { executionId: scheduled.id, visitId: forcedVisitId });
  const barrier = snapshot.execution.forcedEntry.barriers[0];
  expect(barrier).toMatchObject({ kind: 'door', barrierId: 'door-surface-reception-staff' });
  expect(['authorized', 'breaching']).toContain(barrier.status);
  const breachTool = snapshot.stacks.find((stack) =>
    stack.key === 'pryBar' && snapshot.visit.supportActors[0].inventory.stackIds.includes(stack.id)
  );
  expect(breachTool).toBeTruthy();
  const task = await page.evaluate(({ visitId, barrierId }) => window.helixHeresyDebug.queueForcedEntryCompliance(visitId, barrierId), {
    visitId: forcedVisitId, barrierId: barrier.id
  });
  expect(task).toMatchObject({ type: 'forcedEntryCompliance', data: { barrierId: barrier.id } });
  const damageAtCompliance = barrier.damageApplied;
  await page.evaluate(() => {
    for (let index = 0; index < 10; index += 1) window.helixHeresyDebug.updateSiteVisits(1);
  });
  execution = await page.evaluate((id) => window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === id), scheduled.id);
  expect(execution.forcedEntry.barriers[0]).toMatchObject({ status: 'complied', damageApplied: damageAtCompliance });
  const clock = await page.evaluate(() => window.helixHeresyDebug.warrantExecutionsSnapshot().clock);
  await page.evaluate((seconds) => window.helixHeresyDebug.advanceSimulation(seconds), Math.max(1, Math.ceil(task.dueAt - clock + 2)));
  await page.evaluate(() => {
    for (let index = 0; index < 14; index += 1) window.helixHeresyDebug.updateSiteVisits(30);
  });
  const result = await page.evaluate(({ executionId, visitId }) => ({
    execution: window.helixHeresyDebug.warrantExecutionsSnapshot().executions.find((entry) => entry.id === executionId),
    visit: window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visitId),
    stacks: window.helixHeresyDebug.physicalItemVisualSnapshot(),
    door: window.helixHeresyDebug.siteAccessSnapshot().doors.find((entry) => entry.id === 'door-surface-reception-staff')
  }), { executionId: scheduled.id, visitId: forcedVisitId });
  expect(result.execution).toMatchObject({
    status: 'completed',
    warrantReturn: { outcome: 'obstructed', immutable: true },
    forcedEntry: {
      status: 'completed', supplementalReturn: {
        outcome: 'completed', immutable: true, compliedBarrierIds: [barrier.id],
        breachedBarrierIds: ['forced-barrier-2']
      }
    }
  });
  expect(result.visit.phase).toBe('completed');
  expect(result.door.state).toMatchObject({ breached: false, condition: expect.any(Number) });
  expect(result.door.state.condition).toBeLessThan(100);
  expect(result.stacks.some((stack) => stack.id === breachTool.id)).toBe(false);
});
