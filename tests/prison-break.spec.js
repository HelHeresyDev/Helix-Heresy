// @ts-check
const { test, expect } = require('@playwright/test');
const Break = require('../prison-break.js');
const Prison = require('../prison-custody.js');

function committed() {
  return Prison.commit(Prison.defaultState(), { seed: 'break-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0091', incarcerationMonths: 12 }).stay;
}

function opened() {
  const stay = committed();
  return { stay, ...Break.open(Break.defaultState(), stay, { clock: 1000, proceedingId: 'proceeding-1' }) };
}

function ready() {
  const base = opened(); let state = base.state; let clock = 1000;
  for (const action of Break.PREPARATION_DEFS) {
    const begun = Break.beginPreparation(state, base.record.id, action.id, { clock, actorId: action.relationshipRequired ? 'prisoner-ally' : '', relationshipScore: action.relationshipRequired ? 55 : 0 });
    expect(begun.changed).toBe(true);
    clock = begun.preparation.dueAt;
    const completed = Break.completePreparation(begun.state, base.record.id, begun.preparation.id, clock);
    expect(completed.changed).toBe(true); state = completed.state;
    for (const assetId of completed.preparation.grantsAssetIds) state = Break.setAssetPhysicalStack(state, base.record.id, assetId, `stack-${assetId}`).state;
    clock += 1;
  }
  return { ...base, state, clock, record: Break.recordForStay(state, base.stay.id) };
}

function rescueReady(overrides = {}) {
  const prepared = ready();
  const contact = { id: 'contact-smuggler', name: 'Sable Underhook', archetype: 'industrialSmuggler', trust: 100, reliability: 0.99, riskProfile: 'reckless', ...overrides.contact };
  const arranged = Break.arrangeRescue(prepared.state, prepared.record.id, { seed: overrides.seed || 'rescue-world', clock: prepared.clock, codedSessionId: 'prison-session-coded', collarStrategyId: overrides.collarStrategyId || 'keepLocked', contact, facilityAlert: overrides.facilityAlert || 0, standing: 70, sentenceServedSeconds: 10 * Break.DAY, unservedSentenceSeconds: 350 * Break.DAY, distractionActorId: overrides.distractionActorId || '', distractionActorName: overrides.distractionActorName || '', distractionRelationshipScore: overrides.distractionRelationshipScore || 0 });
  return { ...prepared, contact, ...arranged };
}

test('preparation records concrete facts and physical assets instead of an abstract progress value', () => {
  const result = ready();
  expect(result.record.factIds).toEqual(expect.arrayContaining(Break.FACT_DEFS.map((entry) => entry.id)));
  expect(result.record.assets).toEqual(expect.arrayContaining(Break.ASSET_DEFS.map((entry) => expect.objectContaining({ id: entry.id, status: 'held', physicalStackId: `stack-${entry.id}` }))));
  expect(result.record).not.toHaveProperty('progress');
  expect(result.record.preparations).toHaveLength(Break.PREPARATION_DEFS.length);
  expect(Break.normalizeState(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
});

test('the named disguise accomplice must be cooperative and remains frozen in the route', () => {
  const base = opened(); let state = base.state;
  for (const actionId of ['observeWorkshop']) {
    const begun = Break.beginPreparation(state, base.record.id, actionId, { clock: 1000 }); state = Break.completePreparation(begun.state, base.record.id, begun.preparation.id, begun.preparation.dueAt).state;
  }
  expect(Break.preparationAvailability(Break.recordForStay(state, base.stay.id), 'secureDisguise', { actorId: 'prisoner-1', relationshipScore: 19 })).toMatchObject({ available: false, reason: expect.stringContaining('not yet cooperative') });
  const begun = Break.beginPreparation(state, base.record.id, 'secureDisguise', { clock: 10000, actorId: 'prisoner-1', relationshipScore: 20 });
  expect(begun).toMatchObject({ changed: true, preparation: { actorId: 'prisoner-1' } });
});

test('launch requires exact route facts and physical assets and freezes unserved time', () => {
  const base = opened();
  expect(Break.planAvailability(base.record, 'keepLocked')).toMatchObject({ available: false, missingFactIds: expect.any(Array), missingAssetIds: expect.any(Array) });
  const prepared = ready();
  const planned = Break.plan(prepared.state, prepared.record.id, { seed: 'break-world', clock: prepared.clock, collarStrategyId: 'keepLocked', assistingActorId: 'prisoner-ally', assistingActorName: 'Mara Vale', relationshipScore: 55, standing: 72, sentenceServedSeconds: 20 * Break.DAY, unservedSentenceSeconds: 340 * Break.DAY });
  expect(planned.attempt).toMatchObject({ status: 'planned', collarStrategyId: 'keepLocked', frozen: { assistingActorId: 'prisoner-ally', assistingActorName: 'Mara Vale', unservedSentenceSeconds: 340 * Break.DAY, factIds: expect.any(Array), assetIds: expect.any(Array) }, stages: expect.any(Array) });
  expect(planned.attempt.stages.map((entry) => entry.layer)).toEqual(['housing', 'circulation', 'control', 'perimeter']);
});

test('actual officer exposure is applied to each frozen stage and physical detection ends that attempt', () => {
  const prepared = ready(); let result = Break.plan(prepared.state, prepared.record.id, { seed: 'capture-seed', clock: prepared.clock, collarStrategyId: 'keepLocked', relationshipScore: 20, standing: 40, unservedSentenceSeconds: 1000 });
  result.state.attempts[0].stages[0].roll = 0;
  const begun = Break.beginStage(result.state, result.attempt.id, { clock: prepared.clock + 1, officerExposure: 80 });
  expect(begun.stage).toMatchObject({ status: 'active', exposure: 80, reason: expect.stringContaining('actual officer exposure') });
  const completed = Break.completeStage(begun.state, result.attempt.id, prepared.clock + 2000);
  expect(completed).toMatchObject({ captured: true, attempt: { status: 'captured', consequences: expect.arrayContaining(['Evidence-linked attempted-escape referral']) }, stage: { status: 'detected' } });
});

test('inside tampering adds a suppression stage while after-escape removal is frozen once', () => {
  const prepared = ready();
  const withoutCollarNotes = JSON.parse(JSON.stringify(prepared.record));
  withoutCollarNotes.factIds = withoutCollarNotes.factIds.filter((id) => id !== 'collarMechanism');
  expect(Break.planAvailability(withoutCollarNotes, 'removeAfter')).toMatchObject({ available: false, missingFactIds: expect.arrayContaining(['collarMechanism']) });
  let planned = Break.plan(prepared.state, prepared.record.id, { seed: 'collar-route', clock: prepared.clock, collarStrategyId: 'tamperInside', relationshipScore: 55, standing: 80, unservedSentenceSeconds: 1000 });
  expect(planned.attempt.stages[0]).toMatchObject({ id: 'disableCollar', layer: 'suppression' });

  planned = Break.plan(prepared.state, prepared.record.id, { seed: 'outside-collar', clock: prepared.clock, collarStrategyId: 'removeAfter', relationshipScore: 55, standing: 80, unservedSentenceSeconds: 1000 });
  for (const stage of planned.state.attempts[0].stages) stage.roll = 1;
  while (Break.activeAttempt(planned.state)) {
    const begun = Break.beginStage(planned.state, planned.attempt.id, { clock: prepared.clock, officerExposure: 0 });
    const completed = Break.completeStage(begun.state, planned.attempt.id, prepared.clock + 1000); planned.state = completed.state;
  }
  let removal = Break.beginCollarRemoval(planned.state, planned.attempt.id, prepared.clock + 2000); expect(removal.changed).toBe(true);
  removal.state.attempts[0].collarRemoval.roll = 1;
  const completedRemoval = Break.completeCollarRemoval(removal.state, planned.attempt.id, { analysisSkill: 0 }, prepared.clock + 5600);
  expect(completedRemoval).toMatchObject({ success: true, attempt: { collarStatus: 'removed', collarRemoval: { status: 'completed' } } });
  expect(Break.beginCollarRemoval(completedRemoval.state, planned.attempt.id, prepared.clock + 6000).changed).toBe(false);
});

test('prison escape pauses the exact remainder while failed recapture leaves the sentence boundary unchanged', () => {
  const stay = committed(); const prisonState = { ...Prison.defaultState(), stays: [stay], nextStayNumber: 2 };
  const failed = Prison.resecureEscape(prisonState, stay.id, { clock: stay.committedAt + 5 * Prison.DAY, suppressorId: 'replacement-collar' });
  expect(failed.stay).toMatchObject({ status: 'active', sentence: { releaseAt: stay.sentence.releaseAt }, discipline: { segregatedUntil: stay.committedAt + 7 * Prison.DAY, privilegeRestrictionUntil: stay.committedAt + 8 * Prison.DAY }, suppressor: { id: 'replacement-collar', suppressionActive: true } });
  const escaped = Prison.escape(prisonState, stay.id, { clock: stay.committedAt + 10 * Prison.DAY, completedPlanId: 'break-1', collarStatus: 'locked' });
  expect(escaped.stay).toMatchObject({ status: 'escaped', sentence: { servedSeconds: 10 * Prison.DAY, unservedSeconds: 350 * Prison.DAY, servicePausedAt: stay.committedAt + 10 * Prison.DAY }, suppressor: { suppressionActive: true } });
  expect(escaped.stay.sentence.releaseAt).toBe(stay.sentence.releaseAt);
});

test('covert rescue requires exact prison facts, a coded session, and a transport-capable contact', () => {
  const prepared = ready();
  const ordinary = { id: 'contact-ordinary', name: 'Mara Vale', archetype: 'occultFactor', trust: 100, reliability: 0.99 };
  expect(Break.rescueAvailability(prepared.record, { codedSessionId: 'coded-1', collarStrategyId: 'keepLocked', contact: ordinary })).toMatchObject({ available: false, eligibleContact: false });
  const smuggler = { ...ordinary, id: 'contact-smuggler', archetype: 'industrialSmuggler' };
  expect(Break.rescueAvailability(prepared.record, { clock: 100, codedSessionId: 'coded-1', collarStrategyId: 'keepLocked', contact: { ...smuggler, unavailableUntil: 101 } })).toMatchObject({ available: false, eligibleContact: true, contactAvailable: false });
  expect(Break.rescueAvailability(prepared.record, { codedSessionId: '', collarStrategyId: 'keepLocked', contact: smuggler })).toMatchObject({ available: false, reason: expect.stringContaining('coded-contact') });
  expect(Break.rescueAvailability(prepared.record, { codedSessionId: 'coded-1', collarStrategyId: 'keepLocked', contact: smuggler })).toMatchObject({ available: true, missingFactIds: [] });
});

test('an accepted substituted-service deal freezes payment, crew, vehicle, window, and optional distraction', () => {
  const result = rescueReady({ distractionActorId: 'prisoner-ally', distractionActorName: 'Ilen Cask', distractionRelationshipScore: 55 });
  expect(result).toMatchObject({ changed: true, paymentCharged: true, decision: { status: 'accepted', payment: Break.RESCUE_COST }, attempt: { routeKind: 'covertRescue', status: 'planned', window: { label: 'Substituted maintenance collection window' }, frozen: { routeLabel: 'Substituted Maintenance Collection', payment: Break.RESCUE_COST, assistingActorId: 'prisoner-ally', crewPosture: 'abortFleeSurrender' }, crew: [expect.objectContaining({ role: 'rescueDriver', name: expect.any(String) }), expect.objectContaining({ role: 'rescueInfiltrator', name: expect.any(String) })], vehicle: { concealmentCompartment: true, nonviolentPosture: true, registration: expect.stringMatching(/^SVC-/) }, equipment: expect.arrayContaining([expect.objectContaining({ kind: 'credential' }), expect.objectContaining({ kind: 'coverall' }), expect.objectContaining({ kind: 'concealment' })]) } });
  expect(Break.beginStage(result.state, result.attempt.id, { clock: result.attempt.window.startAt - 1 }).changed).toBe(false);
  expect(Break.normalizeState(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
});

test('detection before the workshop handoff records helper outcomes without punishing the scientist', () => {
  const arranged = rescueReady(); arranged.state.attempts[0].stages[0].roll = 0;
  const begun = Break.beginStage(arranged.state, arranged.attempt.id, { clock: arranged.attempt.window.startAt, officerExposure: 20 });
  const completed = Break.completeStage(begun.state, arranged.attempt.id, arranged.attempt.window.startAt + 1200);
  expect(completed).toMatchObject({ aborted: true, scientistCaptured: false, attempt: { status: 'abandoned', scientistCommitted: false, consequences: expect.arrayContaining(['Scientist remained in ordinary custody']), helperOutcomes: expect.arrayContaining([expect.objectContaining({ outcome: 'withdrew' })]) } });
});

test('the rescue physically reaches handoff and gate exit before pausing sentence service', () => {
  const arranged = rescueReady({ collarStrategyId: 'removeAfter' });
  for (const stage of arranged.state.attempts[0].stages) stage.roll = 1;
  let state = arranged.state; let clock = arranged.attempt.window.startAt;
  while (Break.activeAttempt(state)) {
    const begun = Break.beginStage(state, arranged.attempt.id, { clock, officerExposure: 10 }); expect(begun.changed).toBe(true);
    const completed = Break.completeStage(begun.state, arranged.attempt.id, clock + begun.stage.durationMinutes * 60); state = completed.state; clock += begun.stage.durationMinutes * 60 + 1;
  }
  const escaped = Break.latestEscape(state);
  expect(escaped).toMatchObject({ status: 'escaped', scientistCommitted: true, collarStatus: 'locked', collarRemoval: { status: 'available' }, helperOutcomes: [expect.objectContaining({ outcome: 'escaped' }), expect.objectContaining({ outcome: 'escaped' })], pursuit: { status: 'watchingLab' } });
  expect(escaped.stages.map((entry) => entry.id)).toEqual(['vehicleGateEntry', 'infiltratorToWorkshop', 'workshopHandoff', 'returnToVehicle', 'vehicleGateExit']);
});
