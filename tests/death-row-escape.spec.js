// @ts-check
const { test, expect } = require('@playwright/test');
const Escape = require('../death-row-escape.js');
const Capital = require('../death-row-custody.js');
const path = require('path');
const { pathToFileURL } = require('url');
const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl); await page.evaluate(() => { window.localStorage.clear(); window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); }); await page.reload(); await page.locator('#titleNewRunBtn').click(); await page.locator('#startRunSubmitBtn').click();
}

async function enterCapitalCustody(page) {
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate((raidId) => { window.helixHeresyDebug.placeScientistAtRaidEntry(raidId); window.helixHeresyDebug.updateLawEnforcementRaids(1); window.helixHeresyDebug.surrenderToRaid(raidId); for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 }); }, execution.raidId);
  const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady({ custodial: true, capital: true }));
  for (let index = 0; index < 3; index += 1) { await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); }
  await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId); await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); await page.evaluate((id) => window.helixHeresyDebug.makeDeathRowTransferDueNow(id), caseId);
  return caseId;
}

function opened() {
  const stay = Capital.commit(Capital.defaultState(), { seed: 'gallows-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0199' }).stay;
  const result = Escape.open(Escape.defaultState(), stay, { clock: 1000, proceedingId: 'proceeding-1' });
  return { stay, ...result };
}

function ready() {
  const base = opened(); let state = base.state; let clock = 1000;
  for (const action of Escape.PREPARATION_DEFS) {
    const begun = Escape.beginPreparation(state, base.record.id, action.id, { clock });
    expect(begun.changed).toBe(true); clock = begun.preparation.dueAt;
    const completed = Escape.completePreparation(begun.state, base.record.id, begun.preparation.id, clock);
    expect(completed.changed).toBe(true); state = completed.state; clock += 1;
  }
  return { ...base, state, clock, record: Escape.recordForStay(state, base.stay.id) };
}

const visitor = { id: 'contact-visitor', name: 'Mara Vell', archetype: 'occultFactor', trust: 80, reliability: .8 };
const smuggler = { id: 'contact-smuggler', name: 'Sable Mire', archetype: 'industrialSmuggler', trust: 90, reliability: .95 };

test('capital preparations learn exact unit facts once without an abstract progress bar', () => {
  const result = ready();
  expect(result.record.factIds).toEqual(Escape.FACT_DEFS.map((entry) => entry.id));
  expect(result.record.preparations).toHaveLength(Escape.PREPARATION_DEFS.length);
  expect(result.record).not.toHaveProperty('progress');
  expect(Escape.preparationAvailability(result.record, 'observeEscort')).toMatchObject({ available: false, reason: expect.stringContaining('already') });
  expect(Escape.normalizeState(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
});

test('approved-visitor diversion and counterfeit transfer have distinct gates and physical routes', () => {
  const prepared = ready();
  expect(Escape.routeAvailability(prepared.record, 'visitorDiversion', { collarStrategyId: 'keepLocked', visitorSessionId: '', contact: visitor })).toMatchObject({ available: false, sessionOk: false });
  expect(Escape.routeAvailability(prepared.record, 'visitorDiversion', { collarStrategyId: 'keepLocked', visitorSessionId: 'session-visitor', contact: visitor })).toMatchObject({ available: true });
  expect(Escape.routeAvailability(prepared.record, 'counterfeitTransfer', { collarStrategyId: 'keepLocked', codedSessionId: 'session-coded', contact: visitor, money: 9000 })).toMatchObject({ available: false, capable: false });
  expect(Escape.routeAvailability(prepared.record, 'counterfeitTransfer', { collarStrategyId: 'keepLocked', codedSessionId: 'session-coded', contact: smuggler, money: 9000 })).toMatchObject({ available: true });

  const diversion = Escape.plan(prepared.state, prepared.record.id, 'visitorDiversion', { seed: 'visit', clock: prepared.clock, collarStrategyId: 'keepLocked', visitorSessionId: 'session-visitor', contact: visitor, standing: 60 });
  expect(diversion.attempt).toMatchObject({ routeKind: 'visitorDiversion', frozen: { routeLabel: 'Approved-Visitor Diversion', contactId: visitor.id, sessionId: 'session-visitor' }, vehicle: null, assets: [expect.objectContaining({ id: 'visitorBoothShim', holderId: expect.stringContaining('visitor') })] });
  expect(diversion.attempt.stages.map((entry) => entry.id)).toEqual(['visitorScreening', 'escortToVisit', 'boothDiversion', 'crossGuardControl', 'clearIntake', 'exitSally']);

  const rescue = Escape.plan(prepared.state, prepared.record.id, 'counterfeitTransfer', { seed: 'transfer', clock: prepared.clock, collarStrategyId: 'removeAfter', codedSessionId: 'session-coded', contact: smuggler, standing: 60, money: 9000 });
  expect(rescue).toMatchObject({
    changed: true,
    paymentCharged: true,
    attempt: {
      frozen: { routeLabel: 'Counterfeit Capital Transfer', payment: Escape.RESCUE_COST, crewPosture: 'abortFleeSurrender' },
      vehicle: { label: expect.stringContaining('armored capital-custody'), registration: expect.stringMatching(/^CAP-/) },
      crew: [
        expect.objectContaining({ role: 'rescueDriver', name: expect.any(String) }),
        expect.objectContaining({ role: 'rescueInfiltrator', name: expect.any(String) })
      ],
      assets: expect.arrayContaining([
        expect.objectContaining({ id: 'transferCredential' }),
        expect.objectContaining({ id: 'transferUniform' })
      ])
    }
  });
  expect(rescue.attempt.stages.map((entry) => entry.id)).toEqual(['sallyEntry', 'infiltratorToControl', 'capitalHandoff', 'escortToSally', 'sallyExit']);
});

test('pre-handoff rescue detection affects named helpers but does not invent an attempted-escape charge', () => {
  const prepared = ready(); let result = Escape.plan(prepared.state, prepared.record.id, 'counterfeitTransfer', { seed: 'abort', clock: prepared.clock, collarStrategyId: 'keepLocked', codedSessionId: 'coded', contact: smuggler, standing: 50, money: 9000 });
  result.state.attempts[0].stages[0].roll = 0;
  const begun = Escape.beginStage(result.state, result.attempt.id, { clock: result.attempt.window.startAt, officerExposure: 30 });
  const completed = Escape.completeStage(begun.state, result.attempt.id, result.attempt.window.startAt + 1200);
  expect(completed).toMatchObject({ aborted: true, scientistCaptured: false, attempt: { status: 'abandoned', scientistCommitted: false, consequences: expect.arrayContaining(['No automatic attempted-escape charge']), helperOutcomes: [expect.objectContaining({ outcome: expect.stringMatching(/withdrew|identified/) }), expect.any(Object)] } });
});

test('a controlling lawful transfer preempts an unfinished escape without teleporting the scientist', () => {
  const prepared = ready(); const planned = Escape.plan(prepared.state, prepared.record.id, 'visitorDiversion', { seed: 'relief', clock: prepared.clock, collarStrategyId: 'keepLocked', visitorSessionId: 'visit', contact: visitor, standing: 50 });
  const preempted = Escape.preemptForLawfulRelief(planned.state, planned.attempt.id, 'Release Ordered', prepared.clock + 10);
  expect(preempted).toMatchObject({ changed: true, attempt: { status: 'abandoned', consequences: ['Controlling lawful relief preempted escape', 'Helpers withdrew', 'Physical legal transfer remains required'], helperOutcomes: [expect.objectContaining({ outcome: 'withdrew' })] } });
  expect(Escape.activeAttempt(preempted.state)).toBeNull();
});

test('detection after physical handoff creates recapture, confiscation, discipline, evidence, and helper outcomes', () => {
  const prepared = ready(); let result = Escape.plan(prepared.state, prepared.record.id, 'visitorDiversion', { seed: 'capture', clock: prepared.clock, collarStrategyId: 'keepLocked', visitorSessionId: 'visit', contact: visitor, standing: 50 });
  for (const stage of result.state.attempts[0].stages) stage.roll = 1;
  let clock = result.attempt.window.startAt;
  for (let index = 0; index < 2; index += 1) { const begun = Escape.beginStage(result.state, result.attempt.id, { clock, officerExposure: 0 }); const done = Escape.completeStage(begun.state, result.attempt.id, clock + 1000); result.state = done.state; clock += 1001; }
  result.state.attempts[0].stages[2].roll = 0;
  const begun = Escape.beginStage(result.state, result.attempt.id, { clock, officerExposure: 50 });
  const completed = Escape.completeStage(begun.state, result.attempt.id, clock + 1000);
  expect(completed).toMatchObject({ captured: true, scientistCaptured: true, attempt: { scientistCommitted: true, status: 'captured', consequences: expect.arrayContaining(['Physical recapture', 'Contraband confiscated', 'Emergency lockdown and privilege restriction', 'Evidence-linked attempted-escape referral']) } });
});

test('successful escape reaches a distinct fugitive state with a locked collar and continuing lab watch', () => {
  const prepared = ready(); let result = Escape.plan(prepared.state, prepared.record.id, 'counterfeitTransfer', { seed: 'success', clock: prepared.clock, collarStrategyId: 'removeAfter', codedSessionId: 'coded', contact: smuggler, standing: 90, money: 9000 });
  for (const stage of result.state.attempts[0].stages) stage.roll = 1;
  let clock = result.attempt.window.startAt;
  while (Escape.activeAttempt(result.state)) { const begun = Escape.beginStage(result.state, result.attempt.id, { clock, officerExposure: 0 }); const done = Escape.completeStage(begun.state, result.attempt.id, clock + begun.stage.durationMinutes * 60); result.state = done.state; clock += begun.stage.durationMinutes * 60 + 1; }
  const escaped = Escape.latestEscape(result.state);
  expect(escaped).toMatchObject({ status: 'escaped', scientistCommitted: true, collarStatus: 'locked', collarRemoval: { status: 'available' }, pursuit: { status: 'watchingLab', labWatch: true }, helperOutcomes: [expect.objectContaining({ outcome: 'escaped' }), expect.objectContaining({ outcome: 'escaped' })] });
  expect(escaped.history.at(-1).summary).toContain('legal review continues');

  let removal = Escape.beginCollarRemoval(result.state, escaped.id, clock); expect(removal.changed).toBe(true);
  removal.state.attempts[0].collarRemoval.roll = 1;
  const removed = Escape.completeCollarRemoval(removal.state, escaped.id, { analysisSkill: 0 }, clock + Escape.HOUR);
  expect(removed).toMatchObject({ success: true, attempt: { collarStatus: 'removed', collarRemoval: { status: 'completed' } } });
  expect(Escape.beginCollarRemoval(removed.state, escaped.id, clock + 2 * Escape.HOUR).changed).toBe(false);
});

test('@smoke counterfeit capital transfer physically reaches the safehouse and survives save/load', async ({ page }) => {
  test.setTimeout(360_000); await startRun(page); const caseId = await enterCapitalCustody(page);
  const support = await page.evaluate(() => window.helixHeresyDebug.prepareDeathRowEscapeTestSupport('counterfeitTransfer'));
  expect(support.record.factIds).toHaveLength(Escape.FACT_DEFS.length); expect(support.contact.id).toBeTruthy();
  const availability = await page.evaluate(({ contactId }) => window.helixHeresyDebug.deathRowEscapeAvailability('counterfeitTransfer', contactId, 'removeAfter'), { contactId: support.contact.id });
  expect(await page.evaluate(({ contactId }) => window.helixHeresyDebug.planDeathRowEscape('counterfeitTransfer', contactId, 'removeAfter'), { contactId: support.contact.id }), JSON.stringify(availability)).toBe(true);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); const attemptId = snapshot.activeEscape.id;
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeDeathRowEscapeWindowNow(id), attemptId)).toBe(true);
  expect(await page.evaluate((id) => window.helixHeresyDebug.forceDeathRowEscapeSuccess(id), attemptId)).toBe(true);
  for (let index = 0; index < Escape.RESCUE_STAGES.length; index += 1) { expect(await page.evaluate((id) => window.helixHeresyDebug.queueNextDeathRowEscapeStage(id), attemptId)).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.completeDeathRowEscapeActionNow())).toBe(true); }
  snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot());
  expect(snapshot).toMatchObject({ activeStay: null, escapedStay: { status: 'escaped', caseId, calendar: { executionStatus: expect.any(String) }, suppressor: { suppressionActive: true }, actors: expect.arrayContaining([expect.objectContaining({ role: 'rescueDriver' }), expect.objectContaining({ role: 'rescueInfiltrator' })]) }, completedEscape: { status: 'escaped', crew: [expect.objectContaining({ roomId: 'capitalFugitiveSafehouse', status: 'escaped' }), expect.objectContaining({ roomId: 'capitalFugitiveSafehouse', status: 'escaped' })], vehicle: { roomId: 'capitalFugitiveSafehouse', present: false }, pursuit: { status: 'watchingLab', labWatch: true }, collarRemoval: { status: 'available' } }, scientist: { roomId: 'capitalFugitiveSafehouse', mapCell: { z: 4 } }, runEnded: false });
  expect(snapshot.activeAppeal).toBeTruthy(); expect(snapshot.magicSuppressionReason).toContain('completely suppresses');
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator(`[data-capital-fugitive="${attemptId}"]`)).toContainText('execution is physically impossible');
  expect(await page.evaluate((id) => window.helixHeresyDebug.forceDeathRowCollarRemovalSuccess(id), attemptId)).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.queueDeathRowCollarRemoval())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.completeDeathRowEscapeActionNow())).toBe(true);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(snapshot).toMatchObject({ completedEscape: { collarStatus: 'removed' }, escapedStay: { suppressor: { suppressionActive: false } } });
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); snapshot = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(snapshot).toMatchObject({ escapedStay: { status: 'escaped', suppressor: { suppressionActive: false } }, completedEscape: { status: 'escaped', collarStatus: 'removed' }, scientist: { roomId: 'capitalFugitiveSafehouse' }, runEnded: false });
});
