// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Commutation = require('../executive-commutation.js');
const Trial = require('../trial-sentencing.js');
const Prison = require('../prison-custody.js');
const appUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl); await page.evaluate(() => { window.localStorage.clear(); window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); }); await page.reload(); await page.locator('#titleNewRunBtn').click(); await page.locator('#startRunSubmitBtn').click();
}

async function bookScientist(page) {
  const execution = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate((raidId) => { window.helixHeresyDebug.placeScientistAtRaidEntry(raidId); window.helixHeresyDebug.updateLawEnforcementRaids(1); window.helixHeresyDebug.surrenderToRaid(raidId); for (let index = 0; index < 8; index += 1) window.helixHeresyDebug.updateLawEnforcementRaids(1, { defer: index < 7 }); }, execution.raidId);
}

async function enterCapitalCustody(page) {
  await startRun(page); await bookScientist(page); const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady({ custodial: true, capital: true }));
  for (let index = 0; index < 3; index += 1) { await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); }
  await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId); await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId); await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow()); await page.evaluate((id) => window.helixHeresyDebug.makeDeathRowTransferDueNow(id), caseId); return caseId;
}

function capitalCase() { return { id: 'trial-case-1', docket: 'CR-0099', status: 'completed', sentencing: { exposure: 38, order: { id: 'capital-order-1', kind: 'deathRow' } } }; }
function opened() { return Commutation.open(Commutation.defaultState(), { seed: 'cinder-world', clock: 1000, stayId: 'capital-stay-1', caseRecord: capitalCase() }); }
function strongInputs() { return { counselName: 'Ari Vale', counselSkill: 90, legalPreparationDays: 5, companyName: 'Helix Chemical Works', companyCredibility: 92, lawfulActivityCount: 12, filedPeriodCount: 3, acceptedResponseCount: 2, adverseActionCount: 0, unpaidPenaltyCount: 0, complianceScore: 90, custodyStanding: 95, custodyIncidentCount: 0, capitalCustodySeconds: 5 * Commutation.DAY, offenseExposure: 38, capitalCaseId: 'trial-case-1', capitalOrderId: 'capital-order-1' }; }

test('a capital intake receives a deterministic named executive office', () => {
  const first = opened(); const second = opened();
  expect(first.record).toMatchObject({ status: 'available', office: { executive: { role: 'stateExecutive' }, advisors: [{ role: 'executiveLegalAdvisor' }, { role: 'correctionalPolicyAdvisor' }] }, renewal: { ordinaryPetitionUsed: false, status: 'ordinaryAvailable' } });
  expect(first.record.office).toEqual(second.record.office); expect(Commutation.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
});

test('filing requires resolved automatic review and completed privileged counsel', () => {
  const { state, record } = opened();
  expect(Commutation.availability(record, { automaticReviewResolved: false, counselSessionId: '' })).toMatchObject({ available: false, reasons: [expect.stringContaining('Automatic'), expect.stringContaining('counsel')] });
  const rejected = Commutation.filePetition(state, record.id, { rationaleId: 'publicBenefit', automaticReviewResolved: true, counselSessionId: '' }, 2000); expect(rejected.changed).toBe(false);
});

test('one ordinary petition freezes exact inputs, threshold, dates, and an administrative stay', () => {
  const { state, record } = opened(); const filed = Commutation.filePetition(state, record.id, { rationaleId: 'publicBenefit', automaticReviewResolved: true, counselSessionId: 'capital-session-1', inputs: strongInputs() }, 2000);
  expect(filed.record).toMatchObject({ status: 'filed', petition: { filedAt: 2000, advisoryAt: 2000 + 2 * Commutation.DAY, decisionAt: 2000 + 3 * Commutation.DAY, frozen: { rationaleId: 'publicBenefit', targetKind: 'maximumFinitePrison', targetMonths: 120, counselSessionId: 'capital-session-1' }, factors: expect.any(Array), threshold: 60 }, execution: { stayed: true, stayKind: 'acceptedExecutivePetition' }, renewal: { ordinaryPetitionUsed: true, status: 'pending' }, decision: { kind: 'commutationPetitionAccepted' } });
  expect(filed.record.petition.score).toBeGreaterThanOrEqual(Commutation.APPROVAL_THRESHOLD);
});

test('advisory recommendation and executive grant are separate written boundaries', () => {
  let { state, record } = opened(); state = Commutation.filePetition(state, record.id, { rationaleId: 'publicBenefit', automaticReviewResolved: true, counselSessionId: 'capital-session-1', inputs: strongInputs() }, 2000).state; state = Commutation.clearDecision(state, record.id).state; record = state.records[0];
  state = Commutation.advance(state, record.petition.advisoryAt).state; record = state.records[0]; expect(record).toMatchObject({ status: 'recommended', advisory: { status: 'recommendGrant', reasons: expect.any(Array) }, decision: { kind: 'commutationRecommendation' }, execution: { stayed: true } });
  state = Commutation.clearDecision(state, record.id).state; record = state.records[0]; state = Commutation.advance(state, record.petition.decisionAt).state; record = state.records[0];
  expect(record).toMatchObject({ status: 'granted', outcome: { kind: 'granted', reasons: expect.any(Array) }, execution: { stayed: false, cancelledAt: record.petition.decisionAt }, instrument: { kind: 'executiveCommutation', preservesConviction: true, preservesOriginalSentenceRecord: true, replacementKind: 'maximumFinitePrison', replacementMonths: 120, serviceCreditSeconds: 5 * Commutation.DAY, status: 'transferRequired' }, decision: { kind: 'commutationGranted' } });
});

test('denial preserves reasons and bars repetition without a material political change', () => {
  let { state, record } = opened(); const weak = { ...strongInputs(), counselSkill: 10, legalPreparationDays: 0, companyCredibility: 5, lawfulActivityCount: 0, filedPeriodCount: 0, acceptedResponseCount: 0, complianceScore: 10, custodyStanding: 20, custodyIncidentCount: 3, unpaidPenaltyCount: 2, adverseActionCount: 3, offenseExposure: 50 };
  state = Commutation.filePetition(state, record.id, { rationaleId: 'institutionalCooperation', automaticReviewResolved: true, counselSessionId: 'capital-session-1', inputs: weak }, 2000).state; state = Commutation.clearDecision(state, record.id).state; record = state.records[0]; state = Commutation.advance(state, record.petition.advisoryAt).state; state = Commutation.clearDecision(state, record.id).state; record = state.records[0]; state = Commutation.advance(state, record.petition.decisionAt).state; record = state.records[0];
  expect(record).toMatchObject({ status: 'denied', outcome: { kind: 'denied', reasons: expect.any(Array) }, renewal: { ordinaryPetitionUsed: true, status: 'materialChangeRequired', qualifyingChangeKinds: expect.arrayContaining(['newInstitutionalSponsor', 'newExecutiveAdministration']) }, instrument: null, execution: { stayed: false } });
  expect(Commutation.filePetition(state, record.id, { rationaleId: 'publicBenefit', automaticReviewResolved: true, counselSessionId: 'capital-session-2', inputs: strongInputs() }, record.petition.decisionAt + 1).changed).toBe(false);
});

test('judicial relief makes an unfinished political petition moot without replacing the court remedy', () => {
  let { state, record } = opened(); state = Commutation.filePetition(state, record.id, { rationaleId: 'publicBenefit', automaticReviewResolved: true, counselSessionId: 'capital-session-1', inputs: strongInputs() }, 2000).state;
  const moot = Commutation.markMoot(state, record.id, 'Conviction reversal superseded commutation.', 3000); expect(moot.record).toMatchObject({ status: 'moot', execution: { stayed: false, liftedAt: 3000 }, renewal: { status: 'judicialReliefSuperseded' }, decision: { kind: 'commutationMoot' }, instrument: null }); expect(Commutation.nextEvent(moot.state, 3000)).toBeNull();
});

test('a grant creates a linked finite successor while preserving the capital judgment', () => {
  const original = { ...capitalCase(), status: 'completed', proceedingId: 'pretrial-1', sentencing: { exposure: 38, reasons: ['Capital judgment entered.'], order: { id: 'capital-order-1', kind: 'deathRow', label: 'Capital sentence', incarcerationMonths: 0, status: 'committed' } } };
  const trialState = Trial.normalizeState({ cases: [original], nextCaseNumber: 2, nextOrderNumber: 2 }); const converted = Trial.recordExecutiveCommutation(trialState, original.id, { executiveInstrumentId: 'executive-instrument-1', incarcerationMonths: 120, clock: 9000, reasons: ['Written executive grant.'] });
  expect(converted.created).toBe(true); expect(converted.case).toMatchObject({ predecessorCaseId: original.id, successorKind: 'executiveCommutation', executiveInstrumentId: 'executive-instrument-1', sentencing: { order: { kind: 'finitePrison', incarcerationMonths: 120, status: 'commitmentPending' } } });
  expect(converted.state.cases.find((entry) => entry.id === original.id).sentencing.order).toMatchObject({ id: 'capital-order-1', kind: 'deathRow', status: 'committed' });
});

test('capital-custody credit shortens the finite maximum and remains part of service', () => {
  const credit = 11 * Prison.DAY + 123; const committed = Prison.commit(Prison.defaultState(), { seed: 'cinder-world', clock: 20_000, caseId: 'trial-case-2', orderId: 'order-2', docket: 'CR-0099-EC1', incarcerationMonths: 120, serviceCreditSeconds: credit });
  expect(committed.stay.sentence).toMatchObject({ months: 120, servedSeconds: credit, serviceCreditSeconds: credit, serviceCreditDays: 11, releaseAt: 20_000 + 120 * Prison.MONTH - credit });
  const advanced = Prison.advance(committed.state, 20_000 + Prison.DAY); expect(advanced.stay.sentence.servedSeconds).toBe(credit + Prison.DAY);
});

test('@smoke executive grant stays execution, preserves judgment, and physically transfers with credit', async ({ page }) => {
  test.setTimeout(360_000); const originalCaseId = await enterCapitalCustody(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.requestDeathRowCommunication('legalCounsel'))).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.advanceDeathRowTime(1))).toBe(true);
  let custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); const requestId = custody.activeStay.communications.requests.find((entry) => entry.channelId === 'legalCounsel').id; expect(await page.evaluate((id) => window.helixHeresyDebug.useDeathRowCommunication(id), requestId)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.makeCapitalAppealMilestoneDueNow())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.acknowledgeDeathRowDecision())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.makeCapitalAppealMilestoneDueNow())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.acknowledgeDeathRowDecision())).toBe(true);
  custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody.activeAppeal.automaticReview.status).toBe('affirmed'); expect(custody.activeCommutation.status).toBe('available');
  await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator(`[data-death-row-custody="${custody.activeStay.id}"]`)).toContainText('disclosed grant threshold 60');
  expect(await page.evaluate(() => window.helixHeresyDebug.fileExecutiveCommutationForTest('correctionalPracticality', true))).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody.activeCommutation).toMatchObject({ status: 'filed', execution: { stayed: true, stayKind: 'acceptedExecutivePetition' }, petition: { frozen: { rationaleId: 'correctionalPracticality', counselSessionId: expect.any(String) }, score: expect.any(Number), threshold: 60 }, decision: { kind: 'commutationPetitionAccepted' } }); expect(custody.activeStay.calendar.executionStatus).toBe('stayed');
  expect(await page.evaluate(() => window.helixHeresyDebug.acknowledgeDeathRowDecision())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.makeExecutiveCommutationMilestoneDueNow())).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody.activeCommutation).toMatchObject({ status: 'recommended', advisory: { status: 'recommendGrant' }, decision: { kind: 'commutationRecommendation' } });
  expect(await page.evaluate(() => window.helixHeresyDebug.acknowledgeDeathRowDecision())).toBe(true); expect(await page.evaluate(() => window.helixHeresyDebug.makeExecutiveCommutationMilestoneDueNow())).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); const recordId = custody.activeCommutation.id; const successorId = custody.activeCommutation.instrument.convertedCaseId; expect(custody).toMatchObject({ activeStay: { status: 'commutationTransferRequired', calendar: { executionStatus: 'cancelled' } }, activeCommutation: { status: 'granted', instrument: { status: 'transferRequired', replacementMonths: 120, preservesConviction: true, preservesOriginalSentenceRecord: true }, decision: { kind: 'commutationGranted' } }, runEnded: false });
  const beforeTransferTrial = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot()); expect(beforeTransferTrial.cases.find((entry) => entry.id === originalCaseId).sentencing.order.kind).toBe('deathRow'); expect(beforeTransferTrial.cases.find((entry) => entry.id === successorId)).toMatchObject({ predecessorCaseId: originalCaseId, successorKind: 'executiveCommutation', sentencing: { order: { kind: 'finitePrison', incarcerationMonths: 120 } } });
  expect(await page.evaluate(() => window.helixHeresyDebug.acknowledgeDeathRowDecision())).toBe(true); expect(await page.evaluate((id) => window.helixHeresyDebug.queueExecutiveCommutationTransfer(id), recordId)).toBe(true); custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody).toMatchObject({ activeCommutation: { instrument: { status: 'inTransit' } }, scientist: { roomId: 'capitalCustodySallyPort' }, custodyTasks: [{ type: 'executiveCommutationTransfer' }] });
  expect(await page.evaluate(() => window.helixHeresyDebug.completeExecutiveCommutationTransferNow())).toBe(true); const prison = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot()); expect(prison).toMatchObject({ activeStay: { caseId: successorId, sentence: { months: 120, serviceCreditSeconds: expect.any(Number), serviceCreditDays: expect.any(Number) }, suppressor: { suppressionActive: true } }, scientist: { roomId: 'statePrisonHousing', mapCell: { z: 5 } }, runEnded: false }); expect(prison.activeStay.sentence.serviceCreditSeconds).toBeGreaterThan(0);
  custody = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(custody.activeStay).toBeNull(); const completed = custody.executiveCommutation.records.find((entry) => entry.id === recordId); expect(completed.instrument).toMatchObject({ status: 'completed', prisonStayId: prison.activeStay.id });
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); const reloadedPrison = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot()); const reloadedCapital = await page.evaluate(() => window.helixHeresyDebug.deathRowCustodySnapshot()); expect(reloadedPrison.activeStay).toMatchObject({ caseId: successorId, sentence: { months: 120 } }); expect(reloadedCapital.executiveCommutation.records.find((entry) => entry.id === recordId).instrument.status).toBe('completed');
});
