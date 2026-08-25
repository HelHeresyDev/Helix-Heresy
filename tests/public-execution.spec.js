// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Capital = require('../death-row-custody.js');
const Execution = require('../public-execution.js');
const Death = require('../scientist-death.js');
const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

function dueStay() {
  const committed = Capital.commit(Capital.defaultState(), { seed: 'gallows-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0199', publicEnemyDesignation: { status: 'entered', kind: 'publicEnemy', label: 'Public Enemy', enteredAt: 900, grounds: ['A supported mass-casualty finding.'] }, executionMethod: 'publicBeheading' });
  committed.stay.status = 'executionProcessDue'; committed.stay.calendar.executionStatus = 'due';
  return committed;
}

function planned(options = {}) {
  const { stay } = dueStay(); const result = Execution.plan(Execution.defaultState(), stay, { designation: stay.sentence.publicEnemyDesignation, staff: stay.actors, statementStanceId: 'defiance', ...options }, 2000);
  return { stay, ...result };
}

test('public execution requires a saved designation and freezes optional access, statement, staff, and broadcast', () => {
  const { stay } = dueStay(); const denied = Execution.plan(Execution.defaultState(), stay, { statementStanceId: 'silence' }, 2000); expect(denied).toMatchObject({ created: false, reason: expect.stringContaining('designation') });
  const result = planned({ counsel: true, spiritualAccess: true, statementText: 'You have learned nothing.' });
  expect(result.record).toMatchObject({ status: 'planned', designation: { status: 'entered', kind: 'publicEnemy' }, choices: { counsel: true, spiritualAccess: true, statementStanceId: 'defiance', statementText: 'You have learned nothing.' }, broadcast: { public: true, internetStream: true, holographicRelay: true }, staff: expect.any(Array) });
  expect(result.record.stages.map((entry) => entry.id)).toEqual(['identityVerification', 'finalCounsel', 'spiritualAccess', 'restraintInspection', 'armoredConvoy', 'publicProclamation', 'finalStatement', 'finalLegalClearance', 'positionAtBlock', 'axeStrike']);
  expect(Execution.normalizeState(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
});

test('every pre-strike stage is explicit and lawful relief interrupts before lethal physiology', () => {
  let { state, record } = planned({ counsel: false, spiritualAccess: false }); let clock = 2000;
  while (record.stages[record.currentStageIndex].id !== 'finalLegalClearance') { const begun = Execution.beginStage(state, record.id, clock); expect(begun.changed).toBe(true); const completed = Execution.completeStage(begun.state, record.id, clock + begun.stage.durationMinutes * 60); expect(completed.changed).toBe(true); state = completed.state; record = completed.record; clock += begun.stage.durationMinutes * 60 + 1; }
  const begun = Execution.beginStage(state, record.id, clock); const stopped = Execution.interrupt(begun.state, record.id, { kind: 'judicialStay', summary: 'A judicial stay reached the final-clearance officer.' }, clock + 30);
  expect(stopped.record).toMatchObject({ status: 'interrupted', outcome: { kind: 'judicialStay', survived: true }, stages: expect.arrayContaining([expect.objectContaining({ id: 'finalLegalClearance', status: 'interrupted' })]) });
  expect(stopped.record.stages.find((entry) => entry.id === 'axeStrike').status).toBe('pending');
});

test('axe strike resolves physical death or exceptional survival without a hidden roll', () => {
  for (const survived of [false, true]) {
    let { state, record } = planned(); let clock = 2000;
    while (record.stages[record.currentStageIndex].id !== 'axeStrike') { const begun = Execution.beginStage(state, record.id, clock); const completed = Execution.completeStage(begun.state, record.id, clock + begun.stage.durationMinutes * 60); state = completed.state; record = completed.record; clock += begun.stage.durationMinutes * 60 + 1; }
    const strike = Execution.beginStage(state, record.id, clock); const result = Execution.resolveStrike(strike.state, record.id, { survived }, clock + 60);
    expect(result).toMatchObject({ changed: true, survived, died: !survived, record: { status: survived ? 'interrupted' : 'completed', outcome: { kind: survived ? 'physicalSurvival' : 'physicalDeath', survived } } });
    if (survived) { expect(result.record.outcome.retryNotBefore).toBe(clock + 60 + Execution.MINIMUM_RETRY_DELAY); const retryStay = dueStay().stay; retryStay.id = result.record.stayId; expect(Execution.plan(result.state, retryStay, { designation: retryStay.sentence.publicEnemyDesignation }, result.record.outcome.retryNotBefore)).toMatchObject({ created: true, record: { id: 'public-execution-2' } }); }
  }
});

test('shared death record preserves separated remains and hands valid anchors to future resurrection', () => {
  const physical = { causeKind: 'statePublicExecution', causeLabel: 'Public beheading', location: { roomId: 'civicExecutionScaffold', mapCell: { x: 34, y: 8, z: 7 } }, physiology: { healthAtDeath: 0, consciousness: 'absent', circulation: 'stopped', brainContinuity: false, headAttached: false, lethal: true }, body: { custodyKind: 'capitalAuthority', custodian: 'Capital Custody Service' }, legal: { caseId: 'case-1', stayId: 'stay-1', executionId: 'execution-1' } };
  const terminal = Death.recordDeath(Death.defaultState(), physical, 5000); expect(terminal).toMatchObject({ created: true, terminal: true, resurrectionPending: false, record: { body: { partIds: ['scientist-head-remains', 'scientist-body-remains'] }, resurrection: { status: 'unavailable' } } });
  const anchored = Death.addContingency(Death.defaultState(), { status: 'ready', completedAt: 1000, siteId: 'hidden-base', siteIntact: true, utilitiesOnline: true, preparedBodyId: 'replacement-body', memoryTier: 'perfected' }, 1000);
  const pending = Death.recordDeath(anchored.state, physical, 5000); expect(pending).toMatchObject({ created: true, terminal: false, resurrectionPending: true, record: { physiology: { lethal: true, headAttached: false }, resurrection: { status: 'pending', contingencyIds: [anchored.contingency.id] } } });
  expect(pending.record.body.status).toBe('corpse');
});

test('capital custody records execution start, failed survival hold, and medically confirmed death distinctly', () => {
  let { state, stay } = dueStay(); let begun = Capital.beginExecution(state, stay.id, 'execution-1', 2000); state = begun.state; expect(begun.stay).toMatchObject({ status: 'executionInProgress', calendar: { executionStatus: 'inProgress' }, execution: { method: 'publicBeheading', status: 'active' } });
  const survived = Capital.interruptExecution(state, stay.id, { retryNotBefore: 2000 + Capital.MINIMUM_POST_DECISION_DELAY, summary: 'The scientist survived catastrophic severing.' }, 2100); expect(survived.stay).toMatchObject({ status: 'active', calendar: { executionStatus: 'interrupted' }, decision: { kind: 'executionInterrupted' } });
  ({ state, stay } = dueStay()); begun = Capital.beginExecution(state, stay.id, 'execution-2', 2000); const dead = Capital.markDeceased(begun.state, stay.id, { deathRecordId: 'death-1' }, 2200); expect(dead.stay).toMatchObject({ status: 'deceased', calendar: { executionStatus: 'completed' }, execution: { status: 'completed', deathRecordId: 'death-1' }, suppressor: { suppressionActive: true } });
});

async function startRun(page) { await page.goto(appUrl); await page.evaluate(() => { window.localStorage.clear(); window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); }); await page.reload(); await page.locator('#titleNewRunBtn').click(); await page.locator('#startRunSubmitBtn').click(); }
async function enterCapitalCustody(page) {
  const warrant = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true })); await page.evaluate((raidId) => { window.helixHeresyDebug.placeScientistAtRaidEntry(raidId); window.helixHeresyDebug.updateLawEnforcementRaids(1); window.helixHeresyDebug.surrenderToRaid(raidId); for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 }); }, warrant.raidId);
  const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady({ custodial: true, capital: true })); for (let index = 0; index < 3; index += 1) { await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); } await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId); await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); await page.evaluate((id) => window.helixHeresyDebug.makeDeathRowTransferDueNow(id), caseId); return caseId;
}

test('@smoke public execution physically reaches the scaffold, records separated remains, and survives save/load', async ({ page }) => {
  test.setTimeout(360_000); await startRun(page); const caseId = await enterCapitalCustody(page); expect(await page.evaluate(() => window.helixHeresyDebug.makeDeathRowExecutionDueNow())).toBe(true);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(snapshot.activeStay).toMatchObject({ status: 'executionProcessDue', sentence: { executionMethod: 'publicBeheading', publicEnemyDesignation: { status: 'entered', kind: 'publicEnemy' } } });
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator(`[data-death-row-custody="${snapshot.activeStay.id}"]`)).toContainText('Public Enemy Execution');
  expect(await page.evaluate(() => window.helixHeresyDebug.planPublicExecution({ counsel: true, spiritualAccess: true, statementStanceId: 'scientificManifesto', statementText: 'The work will outlive this state.' }))).toBe(true); snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); const executionId = snapshot.activePublicExecution.id; expect(snapshot.activeStay.status).toBe('executionInProgress');
  for (let index = 0; index < 10; index += 1) { expect(await page.evaluate((id) => window.helixHeresyDebug.queueNextPublicExecutionStage(id), executionId)).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.completePublicExecutionActionNow())).toBe(true); }
  snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); const deceasedStay = snapshot.stays.find((entry) => entry.caseId === caseId); const completedExecution = snapshot.publicExecution.records.find((entry) => entry.id === executionId);
  expect(deceasedStay).toMatchObject({ caseId, status: 'deceased', calendar: { executionStatus: 'completed' }, execution: { status: 'completed', deathRecordId: expect.any(String) } }); expect(completedExecution).toMatchObject({ id: executionId, status: 'completed', broadcast: { status: 'completed' }, deathRecordId: expect.any(String), outcome: { kind: 'physicalDeath' } }); expect(snapshot).toMatchObject({ latestDeath: { causeKind: 'statePublicExecution', terminal: true, body: { roomId: 'civicExecutionScaffold', partIds: ['scientist-head-remains', 'scientist-body-remains'] }, legal: { caseId, executionId } }, scientist: { roomId: 'civicExecutionScaffold', mapCell: { z: 7 }, health: 0 }, runEnded: true });
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(snapshot.publicExecution.records.find((entry) => entry.id === executionId)).toMatchObject({ id: executionId, status: 'completed' }); expect(snapshot).toMatchObject({ latestDeath: { resurrection: { status: 'unavailable' } }, runEnded: true });
});
