// @ts-check
const { test, expect } = require('@playwright/test');
const Release = require('../prison-release.js');
const Prison = require('../prison-custody.js');

function stay(months = 6) {
  return Prison.commit(Prison.defaultState(), { seed: 'release-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', jailStayId: 'jail-1', docket: 'CR-0042', incarcerationMonths: months }).stay;
}

function opened(months = 6) {
  return Release.open(Release.defaultState(), stay(months), 1000);
}

function strongInputs(record) {
  return {
    sentenceMonths: record.sentenceMonths, sentenceSeconds: record.sentenceMonths * 30 * Release.DAY,
    servedSeconds: record.eligibility.eligibleAt - record.openedAt, standing: 92, participation: 86,
    assignmentDays: Math.ceil((record.eligibility.eligibleAt - record.openedAt) / Release.DAY), incidentCount: 0, warningCount: 0,
    cooperativeRelationships: 3, trustedRelationships: 1, counselName: 'Sera Dunn', counselSkill: 82, counselPreparation: 90,
    sponsorLabel: 'Verified chemistry company reentry plan', sponsorStrength: 85, sponsorVerified: true,
    facilityPopulation: 268, facilityCapacity: 240, magicSuppressionRequired: true
  };
}

test('eligibility uses the approved bounded formula and creates a deterministic named panel', () => {
  const short = opened(3); const long = opened(120); const repeated = opened(3);
  expect((short.record.eligibility.eligibleAt - short.record.openedAt) / Release.DAY).toBe(30);
  expect((long.record.eligibility.eligibleAt - long.record.openedAt) / Release.DAY).toBe(180);
  expect(short.record.panel.members).toHaveLength(3);
  expect(short.record.panel.members.map((entry) => entry.name)).toEqual(repeated.record.panel.members.map((entry) => entry.name));
  expect(Release.normalizeState(JSON.parse(JSON.stringify(short.state)))).toEqual(short.state);
});

test('filing freezes exact conduct, counsel, sponsor, capacity, and argument inputs', () => {
  const openedRecord = opened(); const inputs = strongInputs(openedRecord.record);
  const filed = Release.fileReview(openedRecord.state, openedRecord.record.id, 'verifiedReleasePlan', inputs, openedRecord.record.eligibility.eligibleAt);
  expect(filed.application).toMatchObject({ status: 'filed', argumentId: 'verifiedReleasePlan', frozen: { inputs: { standing: 92, sponsorVerified: true, magicSuppressionRequired: true }, factors: expect.any(Array), total: expect.any(Number), threshold: expect.any(Number) } });
  inputs.standing = 0; inputs.sponsorStrength = 0;
  expect(filed.application.frozen.inputs).toMatchObject({ standing: 92, sponsorStrength: 85 });
  expect(Release.normalizeState(JSON.parse(JSON.stringify(filed.state)))).toEqual(filed.state);
});

test('an approved review converts only the remaining custody term and preserves explicit conditions', () => {
  const base = opened(); const at = base.record.eligibility.eligibleAt;
  const filed = Release.fileReview(base.state, base.record.id, 'rehabilitation', strongInputs(base.record), at);
  const resolved = Release.resolveReview(filed.state, base.record.id, filed.application.id, filed.application.hearingAt);
  expect(resolved.application.status).toBe('approved');
  expect(resolved.record.authorization).toMatchObject({ kind: 'earnedSupervisedRelease', applicationId: filed.application.id, remainingSentenceSeconds: expect.any(Number), conditions: expect.arrayContaining([
    expect.objectContaining({ kind: 'supervisionReporting' }),
    expect.objectContaining({ kind: 'prohibitedResearchRestriction' }),
    expect.objectContaining({ kind: 'complianceInspection' }),
    expect.objectContaining({ kind: 'courtMagicSuppression', physicallyEnforced: true })
  ]) });
  expect(resolved.record.authorization.remainingSentenceSeconds).toBeGreaterThan(0);
});

test('denial gives frozen reasons and a deterministic achievable review date', () => {
  const base = opened(60); const at = base.record.eligibility.eligibleAt;
  const filed = Release.fileReview(base.state, base.record.id, 'exceptionalConduct', { sentenceMonths: 60, sentenceSeconds: 60 * 30 * Release.DAY, servedSeconds: at - base.record.openedAt, standing: 10, participation: 0, assignmentDays: 0, incidentCount: 4, warningCount: 5, facilityPopulation: 240, facilityCapacity: 240 }, at);
  const resolved = Release.resolveReview(filed.state, base.record.id, filed.application.id, filed.application.hearingAt);
  expect(resolved.application).toMatchObject({ status: 'denied', decision: { approved: false, summary: expect.stringContaining('denied') } });
  expect(resolved.record.eligibility.nextReviewAt).toBeGreaterThan(resolved.application.resolvedAt);
  expect((resolved.record.eligibility.nextReviewAt - resolved.application.resolvedAt) / Release.DAY).toBeGreaterThanOrEqual(30);
});

test('sentence completion and approved review share one physical discharge record', () => {
  const base = opened(1); let state = Release.authorizeCompletion(base.state, base.record.id, base.record.sentenceReleaseAt).state;
  state = Release.queueDischarge(state, base.record.id, base.record.sentenceReleaseAt).state;
  state = Release.beginDischarge(state, base.record.id, base.record.sentenceReleaseAt + 1).state;
  const completed = Release.completeDischarge(state, base.record.id, { wagesPaid: 44, returnedPropertyLabels: ['Notebook'], transport: { id: 'transport-1', destinationAccessPointId: 'publicEntrance' } }, base.record.sentenceReleaseAt + Release.HOUR);
  expect(completed.record.discharge).toMatchObject({ status: 'completed', wagesPaid: 44, returnedPropertyLabels: ['Notebook'], transport: { id: 'transport-1' } });
  expect(Release.nextMilestone(completed.state, base.record.stayId, completed.record.discharge.completedAt)).toBeNull();
});

test('physical prison custody has distinct authorized, discharging, and released states', () => {
  const committed = Prison.commit(Prison.defaultState(), { seed: 'release-world', clock: 1000, caseId: 'case-1', orderId: 'order-1', incarcerationMonths: 3 });
  let state = Prison.authorizeRelease(committed.state, committed.stay.id, 'earnedSupervisedRelease', 2000).state;
  expect(state.stays[0]).toMatchObject({ status: 'releaseAuthorized', decision: { required: true } });
  state = Prison.beginDischarge(state, committed.stay.id, 2100).state; expect(state.stays[0].status).toBe('discharging');
  state = Prison.completeRelease(state, committed.stay.id, 2200).state;
  expect(state.stays[0]).toMatchObject({ status: 'released', suppressor: { status: 'removed', suppressionActive: false }, decision: { required: false } });
});
