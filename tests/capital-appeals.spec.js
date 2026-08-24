// @ts-check
const { test, expect } = require('@playwright/test');
const Appeals = require('../capital-appeals.js');
const Trial = require('../trial-sentencing.js');

function capitalCase(overrides = {}) {
  const support = { id: 'support-fatal', label: 'Fatal soul destruction ledger', traits: ['fatal', 'soul destruction'], admissibility: 'admitted', scopeStatus: 'authorized', integrity: 100, custodyIssues: [] };
  return {
    id: 'trial-case-1', docket: 'CR-0099', phases: ['prosecution', 'defense', 'deliberation', 'sentencing'].map((id, index) => ({ id, completedAt: 2000 + index })),
    counsel: { selected: { id: 'counsel-1', name: 'Ari Vale', proceduralSkill: 68 } }, preparation: { progress: 72 }, strategy: { closingPriorityId: 'preserveAppeal' },
    charges: [{ id: 'charge-1', verdict: 'guilty', support: [support], elements: [{ id: 'conduct', margin: 9 }, { id: 'intent', margin: 8 }] }],
    sentencing: { exposure: 38, order: { id: 'order-1', kind: 'deathRow' } }, ...overrides
  };
}

function opened(caseRecord = capitalCase()) {
  return Appeals.open(Appeals.defaultState(), { seed: 'cinder-world', clock: 1000, stayId: 'capital-stay-1', caseRecord, automaticReviewAt: 1000 + 3 * Appeals.DAY, executionAt: 1000 + 30 * Appeals.DAY });
}

test('capital appellate docket creates deterministic judges, claims, and disclosed dates', () => {
  const first = opened(); const second = opened();
  expect(first.record).toMatchObject({ status: 'active', predecessorCaseId: 'trial-case-1', panel: [expect.objectContaining({ role: 'presidingAppellateJudge' }), expect.any(Object), expect.any(Object)], calendar: { automaticReviewAt: 1000 + 3 * Appeals.DAY, directAppealDeadlineAt: 1000 + 10 * Appeals.DAY }, directAppeal: { status: 'available' }, execution: { executionAt: 1000 + 30 * Appeals.DAY } });
  expect(first.record.panel.map((judge) => judge.name)).toEqual(second.record.panel.map((judge) => judge.name));
  expect(first.record.claims).toHaveLength(Appeals.CLAIMS.length);
  expect(Appeals.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('unsupported claims remain visible but cannot be filed', () => {
  const { state, record } = opened(); const unsupported = record.claims.find((claim) => claim.id === 'proceduralError');
  expect(unsupported).toMatchObject({ supported: false, baseScore: 0, reasons: [expect.stringContaining('completed')] });
  const filed = Appeals.fileDirectAppeal(state, record.id, { primaryClaimId: unsupported.id, counselSkill: 80 }, 2000);
  expect(filed.changed).toBe(false); expect(filed.reason).toContain('supported primary claim');
});

test('automatic review stays execution and resolves from record claims without a reroll', () => {
  let { state, record } = opened();
  let advanced = Appeals.advance(state, record.calendar.automaticReviewAt); state = advanced.state; record = state.records[0];
  expect(record).toMatchObject({ automaticReview: { status: 'pending', decisionAt: record.calendar.automaticReviewAt + 2 * Appeals.DAY }, execution: { stayed: true, stayKind: 'automaticReview' }, decision: { kind: 'automaticReviewOpened' } });
  state = Appeals.clearDecision(state, record.id).state; advanced = Appeals.advance(state, record.automaticReview.decisionAt); record = advanced.state.records[0];
  expect(record).toMatchObject({ automaticReview: { status: 'affirmed', outcome: { kind: 'affirmed', reasons: expect.any(Array) } }, execution: { stayed: false }, directAppeal: { status: 'available' }, status: 'active' });
});

test('a timely appeal freezes two supported claims and automatically stays execution', () => {
  const source = capitalCase({ charges: [{ id: 'charge-1', verdict: 'guilty', support: [{ id: 'bad-scope', label: 'Fatal ledger', traits: ['fatal'], admissibility: 'admitted', scopeStatus: 'outside', integrity: 60, custodyIssues: ['Seal gap'] }], elements: [{ id: 'conduct', margin: 5 }] }] });
  const { state, record } = opened(source); const filed = Appeals.fileDirectAppeal(state, record.id, { primaryClaimId: 'improperlyAdmittedEvidence', secondaryClaimId: 'brokenEvidenceIntegrity', counselName: 'Ari Vale', counselSkill: 80, legalPreparationDays: 4, preserved: true }, 2000);
  expect(filed.record).toMatchObject({ directAppeal: { status: 'filed', primaryClaimId: 'improperlyAdmittedEvidence', secondaryClaimId: 'brokenEvidenceIntegrity', frozen: { counselName: 'Ari Vale', counselSkill: 80, legalPreparationDays: 4, preserved: true, claimSnapshots: [expect.any(Object), expect.any(Object)] } }, execution: { stayed: true, stayKind: 'timelyDirectAppeal' }, decision: { kind: 'directAppealFiled' } });
});

test('one pending review keeps the stay active when the other review affirms first', () => {
  let { state, record } = opened(); const supported = record.claims.find((claim) => claim.supported); expect(supported).toBeTruthy();
  state = Appeals.fileDirectAppeal(state, record.id, { primaryClaimId: supported.id, counselSkill: 0 }, record.openedAt).state; state = Appeals.clearDecision(state, record.id).state;
  state = Appeals.advance(state, record.calendar.automaticReviewAt).state; state = Appeals.clearDecision(state, record.id).state; record = state.records[0];
  expect(record).toMatchObject({ status: 'active', directAppeal: { status: 'affirmed' }, automaticReview: { status: 'pending' }, execution: { stayed: true, stayKind: 'automaticReview' } });
  state = Appeals.clearDecision(state, record.id).state; state = Appeals.advance(state, record.automaticReview.decisionAt).state; record = state.records[0];
  expect(record).toMatchObject({ status: 'final', automaticReview: { status: 'affirmed' }, execution: { stayed: false }, calendar: { finalAdverseDecisionAt: record.automaticReview.decisionAt } });
});

test('material evidentiary error creates a linked retrial instead of rewriting the original case', () => {
  const source = capitalCase({ charges: [{ id: 'charge-1', verdict: 'guilty', support: [{ id: 'bad-scope', label: 'Fatal ledger', traits: ['fatal'], admissibility: 'admitted', scopeStatus: 'outside', integrity: 100, custodyIssues: [] }], elements: [{ id: 'conduct', margin: 5 }] }] });
  let { state, record } = opened(source); const filed = Appeals.fileDirectAppeal(state, record.id, { primaryClaimId: 'improperlyAdmittedEvidence', counselSkill: 90, legalPreparationDays: 5, preserved: true }, 2000); state = Appeals.clearDecision(filed.state, record.id).state; record = state.records[0];
  const resolved = Appeals.advance(state, record.directAppeal.decisionAt); record = resolved.state.records[0];
  expect(record).toMatchObject({ status: 'reliefOrdered', directAppeal: { status: 'relief', outcome: { kind: 'convictionReversal', successorKind: 'retrial', excludedSupportIds: ['bad-scope'] } }, successorCase: { kind: 'retrial', status: 'transferRequired', predecessorCaseId: 'trial-case-1' }, execution: { stayed: false }, decision: { kind: 'appellateReliefOrdered' } });
});

test('capital eligibility error creates noncapital resentencing while final reversal orders release', () => {
  let result = opened(capitalCase({ sentencing: { exposure: 28, order: { id: 'order-1', kind: 'deathRow' } }, charges: [{ id: 'charge-1', verdict: 'guilty', support: [], elements: [{ id: 'conduct', margin: 6 }] }] }));
  let filed = Appeals.fileDirectAppeal(result.state, result.record.id, { primaryClaimId: 'unsupportedCapitalEligibility', counselSkill: 85, legalPreparationDays: 4, preserved: true }, 2000); let state = Appeals.clearDecision(filed.state, result.record.id).state; let record = state.records[0]; record = Appeals.advance(state, record.directAppeal.decisionAt).state.records[0];
  expect(record.successorCase).toMatchObject({ kind: 'resentencing' }); expect(record.directAppeal.outcome.kind).toBe('sentenceReversal');

  result = opened(capitalCase({ charges: [{ id: 'charge-1', verdict: 'guilty', support: [], elements: [{ id: 'conduct', margin: 4.5 }] }] })); filed = Appeals.fileDirectAppeal(result.state, result.record.id, { primaryClaimId: 'insufficientProof', counselSkill: 100, legalPreparationDays: 5, preserved: true }, 2000); state = Appeals.clearDecision(filed.state, result.record.id).state; record = state.records[0]; record = Appeals.advance(state, record.directAppeal.decisionAt).state.records[0];
  expect(record.directAppeal.outcome.kind).toBe('finalReversalRelease'); expect(record.successorCase).toMatchObject({ kind: 'release' });
});

test('final adverse decision enforces a minimum 72-hour execution interval', () => {
  let { state, record } = opened(); state = Appeals.advance(state, record.calendar.automaticReviewAt).state; state = Appeals.clearDecision(state, record.id).state; record = state.records[0]; state = Appeals.advance(state, record.automaticReview.decisionAt).state; state = Appeals.clearDecision(state, record.id).state; record = state.records[0];
  record.execution.executionAt = record.calendar.directAppealDeadlineAt + Appeals.DAY; const filedAt = record.calendar.directAppealDeadlineAt - Appeals.DAY; const supported = record.claims.find((claim) => claim.supported); expect(supported).toBeTruthy();
  const filed = Appeals.fileDirectAppeal(state, record.id, { primaryClaimId: supported.id, counselSkill: 0, legalPreparationDays: 0, preserved: false }, filedAt); state = Appeals.clearDecision(filed.state, record.id).state; record = state.records[0]; const resolved = Appeals.advance(state, record.directAppeal.decisionAt); record = resolved.state.records[0];
  expect(record.directAppeal.outcome.kind).toBe('affirmed'); expect(record.calendar.earliestExecutionAt).toBe(record.directAppeal.decisionAt + 3 * Appeals.DAY); expect(record.execution.executionAt).toBe(record.calendar.earliestExecutionAt);
});

test('appellate mandates create linked trial successors without mutating the predecessor', () => {
  const predecessor = Trial.normalizeCase({ ...capitalCase(), id: 'trial-case-1', status: 'completed', proceedingId: 'pretrial-1', raidId: 'raid-1', sentencing: { exposure: 38, order: { id: 'order-1', kind: 'deathRow', custodial: true, deathSentence: true, status: 'committed' } } });
  let trialState = Trial.normalizeState({ cases: [predecessor], nextCaseNumber: 2 });
  const retrial = Trial.openSuccessor(trialState, predecessor.id, { kind: 'retrial', appealRecordId: 'appeal-1', excludedSupportIds: ['support-fatal'], clock: 5000 }); trialState = retrial.state;
  expect(retrial.case).toMatchObject({ predecessorCaseId: predecessor.id, successorKind: 'retrial', appealRecordId: 'appeal-1', status: 'scheduled', charges: [expect.objectContaining({ verdict: 'pending', support: [] })] });
  expect(trialState.cases[0]).toEqual(predecessor);
  const resentencing = Trial.openSuccessor(trialState, predecessor.id, { kind: 'resentencing', appealRecordId: 'appeal-2', clock: 6000 });
  expect(resentencing.case).toMatchObject({ predecessorCaseId: predecessor.id, successorKind: 'resentencing', status: 'awaitingSentencing', currentPhaseId: 'sentencing', appellateMandate: { capitalSentenceBarred: true } });
});
