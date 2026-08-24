// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Capital = require('../death-row-custody.js');
const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl); await page.evaluate(() => { window.localStorage.clear(); window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); }); await page.reload(); await page.locator('#titleNewRunBtn').click(); await page.locator('#startRunSubmitBtn').click();
}

async function bookScientist(page) {
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate((raidId) => { window.helixHeresyDebug.placeScientistAtRaidEntry(raidId); window.helixHeresyDebug.updateLawEnforcementRaids(1); window.helixHeresyDebug.surrenderToRaid(raidId); for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 }); }, execution.raidId);
}

function committed() {
  return Capital.commit(Capital.defaultState(), { seed: 'cinder-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0099', roomIds: ['capitalCustodyCell'], counselName: 'Ari Vale', labSnapshot: { money: 800 } });
}

test('capital intake creates deterministic named custody without ending the run', () => {
  const first = committed(); const second = committed();
  expect(first.stay).toMatchObject({ status: 'active', facility: { kind: 'deathRow' }, calendar: { provisionalExecutionAt: 1000 + 30 * Capital.DAY, automaticReviewAt: 1000 + 3 * Capital.DAY, executionStatus: 'provisional' }, suppressor: { kind: 'nullstoneCollar', suppressionActive: true }, plan: { priorityId: 'legalPreparation' } });
  expect(first.stay.actors).toHaveLength(8);
  expect(first.stay.actors.map((actor) => actor.name)).toEqual(second.stay.actors.map((actor) => actor.name));
  expect(first.stay.actors.some((actor) => actor.role === 'executionOfficer')).toBe(true);
  expect(first.stay.actors.find((actor) => actor.role === 'capitalCounselVisitor')?.name).toBe('Ari Vale');
  expect(first.stay).not.toHaveProperty('runEnded');
  expect(Capital.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('saved custody priorities accrue distinct preparation and change the focus room', () => {
  let { state, stay } = committed();
  state = Capital.setPriority(state, stay.id, 'physicalConditioning', 1100).state;
  const advanced = Capital.advance(state, 1000 + 2 * Capital.DAY);
  expect(advanced.stay.progress).toMatchObject({ physicalConditioning: 2, legalPreparation: 0, custodyDays: 2 });
  state = Capital.clearDecision(advanced.state, stay.id).state;
  state = Capital.setPriority(state, stay.id, 'outsideCommunication', 1000 + 2 * Capital.DAY).state;
  const focus = Capital.advance(state, 1000 + 2 * Capital.DAY + 16 * Capital.HOUR);
  expect(focus.stay.routine).toMatchObject({ currentKind: 'focusBlock', currentRoomId: 'capitalCustodyVisitation' });
});

test('communications are delayed, monitored except counsel, and update bounded knowledge', () => {
  let { state, stay } = committed();
  const legal = Capital.requestCommunication(state, stay.id, 'legalCounsel', 'Ari Vale', 1200); state = legal.state;
  expect(legal.request.readyAt).toBe(1200 + 6 * Capital.HOUR);
  state = Capital.advance(state, legal.request.readyAt).state;
  const ready = Capital.activeStay(state).communications.requests[0]; expect(ready.status).toBe('ready');
  const completed = Capital.completeCommunication(state, stay.id, ready.id, ready.readyAt, { company: 'Helix' });
  expect(completed.session).toMatchObject({ monitored: false, privileged: true });
  expect(completed.stay.knowledge).toMatchObject({ labSnapshot: { company: 'Helix' }, reports: [expect.objectContaining({ company: 'Helix' })] });
});

test('automatic review interrupts time without fabricating a result', () => {
  const { state, stay } = committed();
  const advanced = Capital.advance(state, stay.calendar.automaticReviewAt);
  expect(advanced.stay).toMatchObject({ status: 'active', calendar: { automaticReviewStatus: 'opened' }, decision: { required: true, kind: 'automaticReviewOpened' } });
  expect(advanced.stay.history.at(-1).summary).toContain('capital-appeals pass');
});

test('disciplinary incidents save a proportionate response and interrupt compression', () => {
  const { state, stay } = committed();
  const recorded = Capital.recordDisciplinaryIncident(state, stay.id, { kind: 'routeRefusal', severity: 2, summary: 'The scientist refused a saved escorted movement.' }, 2000);
  expect(recorded).toMatchObject({ incident: { kind: 'routeRefusal', response: 'privilegeRestriction' }, stay: { discipline: { standing: 34, incidents: [expect.objectContaining({ summary: expect.stringContaining('refused') })] }, decision: { required: true, kind: 'disciplinaryIncident' } } });
  expect(Capital.nextEvent(recorded.state, 2000)).toBeNull();
});

test('execution date stops at a living physical-process boundary', () => {
  let { state, stay } = committed();
  state = Capital.advance(state, stay.calendar.automaticReviewAt).state;
  state = Capital.clearDecision(state, stay.id).state;
  const due = Capital.advance(state, stay.calendar.provisionalExecutionAt);
  expect(due.stay).toMatchObject({ status: 'executionProcessDue', calendar: { executionStatus: 'due' }, decision: { required: true, kind: 'executionProcessDue' }, suppressor: { suppressionActive: true } });
  expect(Capital.clearDecision(due.state, stay.id).changed).toBe(false);
  expect(Capital.nextEvent(due.state, due.stay.lastAdvancedAt)).toBeNull();
  expect(due.stay).not.toHaveProperty('deadAt');
});

test('@smoke capital sentencing physically transfers into daily custody and stops alive at execution day', async ({ page }) => {
  test.setTimeout(360_000); await startRun(page); await bookScientist(page);
  const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady({ custodial: true, capital: true })); expect(caseId).toMatch(/^trial-case-/);
  for (let index = 0; index < 3; index += 1) { expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true); }
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId)).toBe(true); expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);
  let trial = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot()); expect(trial.cases[0].sentencing.order).toMatchObject({ kind: 'deathRow', status: 'commitmentPending' });
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeDeathRowTransferDueNow(id), caseId)).toBe(true);
  let custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot());
  expect(custody).toMatchObject({ activeStay: { status: 'active', caseId, suppressor: { kind: 'nullstoneCollar', suppressionActive: true }, calendar: { executionStatus: 'provisional' }, actors: expect.any(Array) }, scientist: { roomId: 'capitalCustodyCell', mapCell: { z: 6 } }, runEnded: false });
  expect(custody.activeStay.facility.roomIds).toEqual(expect.arrayContaining(['capitalCustodySallyPort', 'capitalCustodyIntake', 'capitalCustodyCell', 'capitalCustodyExecutionSuite']));
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator(`[data-death-row-custody="${custody.activeStay.id}"]`)).toContainText('Execution suite: locked and inaccessible');
  expect(await page.evaluate(() => window.helixHeresyDebug.setDeathRowPriority('physicalConditioning'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.requestDeathRowCommunication('legalCounsel'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.advanceDeathRowTime(1))).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody.activeStay.decision.kind).toBe('communicationReady');
  expect(await page.evaluate(() => window.helixHeresyDebug.useDeathRowCommunication(window.helixHeresyDebug.deathRowCustodySnapshot().activeStay.communications.requests[0].id))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.makeDeathRowExecutionDueNow())).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody).toMatchObject({ activeStay: { status: 'executionProcessDue', decision: { kind: 'executionProcessDue' } }, runEnded: false });
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody).toMatchObject({ activeStay: { status: 'executionProcessDue' }, scientist: { mapCell: { z: 6 } }, runEnded: false });
});
