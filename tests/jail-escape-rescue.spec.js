// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Escape = require('../jail-escape-rescue.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

const contact = (overrides = {}) => ({
  id: 'contact-smuggler', name: 'Sable Underhook', archetype: 'industrialSmuggler', archetypeLabel: 'Industrial Smuggler',
  trust: 72, reliability: 0.91, riskProfile: 'reckless', ...overrides
});

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#startRunSubmitBtn').click();
}

async function bookScientist(page) {
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate((raidId) => {
    window.helixHeresyDebug.placeScientistAtRaidEntry(raidId);
    window.helixHeresyDebug.updateLawEnforcementRaids(1);
    window.helixHeresyDebug.surrenderToRaid(raidId);
    for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 });
  }, execution.raidId);
  return execution.raidId;
}

test('standing contingencies freeze a persistent contact decision, named extractor, vehicle, and safe room', () => {
  const first = Escape.establishContingency(Escape.defaultState(), { seed: 'contingency-seed', clock: 100, contact: contact(), deposit: 1200 });
  const second = Escape.establishContingency(Escape.defaultState(), { seed: 'contingency-seed', clock: 100, contact: contact(), deposit: 1200 });
  expect(first).toMatchObject({ changed: true, decision: { accepted: true }, contingency: { status: 'active', deposit: 1200, destinationId: 'safeRoom', extractor: { name: expect.any(String), vehicle: { label: 'Disguised service van' } } } });
  expect(first.contingency.extractor.name).toBe(second.contingency.extractor.name);
  expect(Escape.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('observations are exact plan facts rather than a mandatory progress bar', () => {
  const result = Escape.plan(Escape.defaultState(), { seed: 'uncertain', clock: 100, routeId: 'selfTransferBay', stayId: 'stay-1', raidId: 'raid-1', observationIds: ['suppressionCollar'], facilityAlert: 20 });
  expect(result.changed).toBe(true);
  expect(result.attempt).toMatchObject({ status: 'planned', missingRequiredIds: expect.arrayContaining(['cellDoorProcedure', 'officerRoutine']), riskBand: 'critical' });
  expect(result.attempt.stages).toHaveLength(4);
  expect(result.attempt.stages.find((stage) => stage.observationId === 'suppressionCollar').risk).toBeLessThan(result.attempt.stages.find((stage) => stage.observationId === 'cellDoorProcedure').risk);
});

test('covert extraction advances through frozen physical stages and ends under laboratory watch', () => {
  let state = Escape.establishContingency(Escape.defaultState(), { seed: 'rescue', clock: 0, contact: contact(), deposit: 1200 }).state;
  const contingency = Escape.activeContingency(state);
  let result = Escape.plan(state, { seed: 'rescue', clock: 100, routeId: 'covertExtraction', stayId: 'stay-1', raidId: 'raid-1', proceedingId: 'case-1', observationIds: Escape.OBSERVATION_IDS, facilityAlert: 0, contingencyId: contingency.id, contact: contact(), payment: 1200 });
  state = result.state;
  result = Escape.stageAttempt(state, result.attempt.id, result.attempt.opportunityAt); state = result.state;
  expect(result.attempt).toMatchObject({ status: 'staged', extractor: { present: true, status: 'waiting' }, equipment: [expect.objectContaining({ status: 'staged' })] });
  const attemptId = result.attempt.id;
  for (let index = 0; index < 4; index += 1) {
    const attempt = state.attempts[0]; attempt.stages[attempt.currentStageIndex].roll = 0;
    const begun = Escape.beginStage(state, attemptId, { clock: 20_000 + index * 100, officerExposure: 0, skill: 50 });
    const completed = Escape.completeStage(begun.state, attemptId, { clock: 20_050 + index * 100 });
    state = completed.state;
  }
  expect(state.attempts[0]).toMatchObject({ status: 'escaped', destinationId: 'safeRoom', pursuit: { status: 'watchingLab', labWatch: true, lastKnownRoomId: 'municipalHoldingProcessing' } });
  const returned = Escape.recordReturn(state, attemptId, 'concealedExit', 30_000);
  expect(returned).toMatchObject({ changed: true, recaptureRequired: true, attempt: { pursuit: { status: 'recaptureScheduled', returnDestinationId: 'concealedExit' } } });
});

test('a detected stage freezes capture and concrete consequences', () => {
  let state = Escape.plan(Escape.defaultState(), { seed: 'failure', clock: 100, routeId: 'selfTransferBay', stayId: 'stay-1', raidId: 'raid-1', observationIds: [], facilityAlert: 80 }).state;
  const attemptId = state.attempts[0].id; state = Escape.stageAttempt(state, attemptId, state.attempts[0].opportunityAt).state;
  state.attempts[0].stages[0].roll = 1;
  const begun = Escape.beginStage(state, attemptId, { clock: 10_000, officerExposure: 80, skill: 0 });
  const completed = Escape.completeStage(begun.state, attemptId, { clock: 10_100, injury: 'Minor restraint injury' });
  expect(completed).toMatchObject({ captured: true, attempt: { status: 'captured', consequences: expect.arrayContaining(['Facility lockdown', 'Escape equipment confiscated', 'Minor restraint injury']), pursuit: { status: 'closed' } } });
});

test('@smoke a named covert extractor reaches the jail and escape ends at a saved staging site before a watched return', async ({ page }) => {
  test.setTimeout(120_000);
  await startRun(page);
  await bookScientist(page);
  const contactId = await page.evaluate(() => window.helixHeresyDebug.makeJailEscapeReady());
  expect(contactId).toMatch(/^contact-/);
  expect(await page.evaluate((id) => window.helixHeresyDebug.establishJailEscapeContingency(id), contactId)).toBe(true);
  expect(await page.evaluate((id) => window.helixHeresyDebug.planJailEscape('covertExtraction', id), contactId)).toBe(true);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.jailEscapeRescueSnapshot());
  const attemptId = snapshot.activeAttempt.id;
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeJailEscapeOpportunityNow(id), attemptId)).toBe(true);
  expect(await page.evaluate((id) => window.helixHeresyDebug.forceJailEscapeStageSuccess(id), attemptId)).toBe(true);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.jailEscapeRescueSnapshot());
  expect(snapshot.activeAttempt).toMatchObject({ status: 'staged', extractor: { name: expect.any(String), present: true, roomId: 'municipalHoldingProcessing', vehicle: { label: 'Disguised service van' } } });
  expect((await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot().entities.filter((entry) => entry.kind === 'escapeExtractor')))).toHaveLength(1);

  for (let index = 0; index < 4; index += 1) {
    expect(await page.evaluate((id) => window.helixHeresyDebug.queueNextJailEscapeStage(id), attemptId)).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.completeJailEscapeActionNow())).toBe(true);
  }
  snapshot = await page.evaluate(() => window.helixHeresyDebug.jailEscapeRescueSnapshot());
  expect(snapshot).toMatchObject({ activeAttempt: null, latestEscape: { status: 'escaped', destinationId: 'safeRoom', pursuit: { status: 'watchingLab', labWatch: true } }, scientist: { roomId: 'fugitiveSafeRoom', mapCell: { z: 4 } } });
  const custody = await page.evaluate(() => window.helixHeresyDebug.jailCustodySnapshot());
  expect(custody).toMatchObject({ runEnded: false, activeStay: null, magicSuppressionReason: '' });
  expect((await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot())).raids.some((raid) => raid.status === 'escaped' && raid.detention.status === 'escaped')).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click();
  const escapeRow = page.locator('[data-raid-id]').filter({ hasText: 'Fugitive staging' });
  await expect(escapeRow).toContainText('Temporary Fugitive Safe Room');
  await expect(escapeRow.getByRole('button', { name: 'Risk Return via Concealed Exit' })).toBeVisible();

  expect(await page.evaluate(() => window.helixHeresyDebug.queueFugitiveReturn('concealedExit'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.completeJailEscapeActionNow())).toBe(true);
  const raids = await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot());
  expect(raids.scientist.roomId).toBe('concealedExit');
  expect(raids.raids.some((raid) => raid.status === 'scheduled' && raid.history.some((entry) => entry.action === 'recaptureAuthorized'))).toBe(true);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.jailEscapeRescueSnapshot());
  expect(reloaded.latestEscape).toMatchObject({ id: attemptId, pursuit: { status: 'recaptureScheduled', returnDestinationId: 'concealedExit' } });
});
