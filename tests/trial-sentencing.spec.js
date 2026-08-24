// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Trial = require('../trial-sentencing.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

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

function proceeding(overrides = {}) {
  const support = {
    id: 'support-1', sourceId: 'evidence-1', kind: 'authorityEvidence',
    label: 'Research ledger describing deliberate unlicensed prohibited specimen experiments',
    reliability: 'strong', significanceRank: 4, integrity: 100, scopeStatus: 'authorized', custodyIssues: [],
    traits: ['research', 'prohibited', 'unlicensed', 'deliberate', 'specimen'], admissibility: 'admitted'
  };
  return {
    id: 'pretrial-1', raidId: 'raid-1', docket: 'CR-0001', openedAt: 100,
    court: { jurisdictionId: 'local-municipality', judge: { id: 'judge-1', name: 'Mara Vale', proceduralStrictness: 60 }, prosecutor: { id: 'prosecutor-1', name: 'Ivo Ward' } },
    charges: [{ id: 'charge-1', typeId: 'prohibitedResearch', label: 'Unlicensed Prohibited Research', severity: 'serious', weight: 8, status: 'filed', publicProbableCause: 'Exact ledger support.', support: [support] }],
    counsel: { selectedOptionId: 'counsel-1', options: [{ id: 'counsel-1', name: 'Sera Dunn', proceduralSkill: 72, workload: 40 }], conferences: [{ id: 'conference-1' }] },
    discovery: { packetId: 'packet-1', items: [{ ...support, supportId: support.id, exculpatory: false }], witnesses: [{ id: 'witness-1', label: 'Authority evidence custodian', sourceItemIds: [`pretrial-1-discovery-${support.id}`] }] },
    preparation: { progress: 70, credibility: 75 }, history: [{ at: 100, action: 'voluntarySurrender', summary: 'The scientist surrendered.' }],
    release: { status: 'none', conditions: [] }, fugitive: { active: false }, plea: { status: 'rejected', offer: null },
    trial: { status: 'scheduled', scheduledAt: 1000, trialAt: 2000, handoff: { remainingChargeIds: ['charge-1'], admissibleSupportIds: ['support-1'], witnessIds: ['witness-1'], preparation: 70, credibility: 75, counselOptionId: 'counsel-1', custodyStatus: 'detained', releaseConditionIds: [], pleaStatus: 'rejected', discoveryPacketId: 'packet-1' } },
    ...overrides
  };
}

function configuredCase(source = proceeding(), options = {}) {
  let state = Trial.open(Trial.defaultState(), source, { clock: 1000, stayId: 'stay-1' }).state;
  const caseId = state.cases[0].id;
  state = Trial.configure(state, caseId, {
    theories: Object.fromEntries(state.cases[0].charges.filter((charge) => charge.verdict === 'pending').map((charge) => [charge.id, 'contestIntent'])),
    challengeKind: options.challengeKind || '', challengeTargetId: options.challengeTargetId || '', testify: Boolean(options.testify),
    closingPriorityId: options.closingPriorityId || 'completeAcquittal', sentencingSubmissionId: options.sentencingSubmissionId || 'individualizedMercy'
  }, 1100).state;
  return state;
}

function finishTrial(state) {
  const caseId = state.cases[0].id;
  let clock = state.cases[0].trialAt;
  for (let index = 0; index < 3; index += 1) {
    const begun = Trial.beginAppearance(state, caseId, clock); expect(begun.changed).toBe(true);
    const completed = Trial.completeAppearance(begun.state, caseId, clock + 3600); expect(completed.changed).toBe(true);
    state = completed.state; clock += 3601;
  }
  return state;
}

test('a bench trial resolves every legal element from exact admitted support and written reasons', () => {
  const state = finishTrial(configuredCase());
  const caseRecord = state.cases[0];
  expect(caseRecord).toMatchObject({ status: 'awaitingSentencing', charges: [{ verdict: 'guilty', elements: [
    expect.objectContaining({ id: 'researchConduct', proven: true, supportIds: ['support-1'], threshold: 4.5 }),
    expect.objectContaining({ id: 'prohibitedSubject', proven: true }),
    expect.objectContaining({ id: 'knowingLackOfLicense', proven: true })
  ] }] });
  expect(caseRecord.charges[0].verdictReason).toContain('every required element');
  expect(Trial.normalizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
});

test('reasonable doubt on one required element acquits without fabricating missing evidence', () => {
  const weak = proceeding();
  weak.charges[0].support[0] = { ...weak.charges[0].support[0], label: 'Unattributed laboratory photograph', reliability: 'weak', significanceRank: 1, integrity: 45, scopeStatus: 'unknown', custodyIssues: ['Broken chain'], traits: ['laboratory'] };
  weak.discovery.items[0] = { ...weak.charges[0].support[0], supportId: 'support-1', exculpatory: true };
  const state = finishTrial(configuredCase(weak, { challengeKind: 'support', challengeTargetId: 'support-1' }));
  const caseRecord = state.cases[0];
  expect(caseRecord).toMatchObject({ status: 'completed', charges: [{ verdict: 'notGuilty' }], sentencing: { order: { kind: 'acquittalRelease', custodial: false, status: 'releasePending' } } });
  expect(caseRecord.charges[0].elements.some((element) => element.proven === false)).toBe(true);
  expect(caseRecord.sentencing.order.reasons).toContain('No charge resulted in a conviction.');
});

test('a separate sentencing appearance combines convictions into a finite prison commitment', () => {
  const source = proceeding(); source.charges[0].weight = 30;
  let state = finishTrial(configuredCase(source)); const caseId = state.cases[0].id; const sentencingAt = state.cases[0].sentencingAt;
  state = Trial.beginAppearance(state, caseId, sentencingAt).state;
  const completed = Trial.completeAppearance(state, caseId, sentencingAt + 2700);
  expect(completed.case).toMatchObject({ status: 'completed', sentencing: { order: { kind: 'finitePrison', custodial: true, destinationId: 'statePrisonIntake', incarcerationMonths: expect.any(Number), status: 'commitmentPending' } } });
  expect(completed.case.sentencing.order.incarcerationMonths).toBeGreaterThan(0);
  expect(completed.case.sentencing.order.transferNotBefore).toBeGreaterThan(completed.case.sentencing.order.issuedAt);
});

test('an accepted plea freezes dismissed charges and enforces its supervised-release recommendation', () => {
  const source = proceeding({
    charges: [
      { ...proceeding().charges[0], id: 'charge-resolution' },
      { ...proceeding().charges[0], id: 'charge-dismissed', typeId: 'hazardousBiologicalConduct', label: 'Hazardous Biological Conduct', weight: 5 }
    ],
    plea: { status: 'accepted', offer: { id: 'plea-1', resolutionChargeIds: ['charge-resolution'], dismissedChargeIds: ['charge-dismissed'], sentencingRecommendation: 'supervisedRelease', forfeitureAmount: 600 } },
    trial: { status: 'pleaSentencing', scheduledAt: 1000, trialAt: null, handoff: { remainingChargeIds: ['charge-resolution'], admissibleSupportIds: ['support-1'], witnessIds: [], preparation: 70, credibility: 75, counselOptionId: 'counsel-1', custodyStatus: 'detained', releaseConditionIds: [], pleaStatus: 'accepted', discoveryPacketId: 'packet-1' } }
  });
  let state = configuredCase(source, { sentencingSubmissionId: 'restitutionAndCompliance' }); const caseId = state.cases[0].id;
  expect(state.cases[0].charges.map((charge) => charge.verdict)).toEqual(['guilty', 'dismissed']);
  state = Trial.beginAppearance(state, caseId, state.cases[0].sentencingAt).state;
  const completed = Trial.completeAppearance(state, caseId, state.cases[0].sentencingAt + 2700);
  expect(completed.case.sentencing.order).toMatchObject({ kind: 'fineProbation', custodial: false, probationMonths: expect.any(Number), forfeiture: 600, status: 'releasePending' });
});

test('capital eligibility creates a death-row order, not death or game over', () => {
  const source = proceeding();
  source.charges[0] = { ...source.charges[0], typeId: 'violentResistance', label: 'Violent Resistance to Arrest', severity: 'critical', weight: 40,
    support: [{ ...source.charges[0].support[0], label: 'Officer death record from deliberate lethal attack during arrest', traits: ['attack', 'violent', 'officer', 'arrest', 'deliberate', 'resistance', 'death', 'killed'] }] };
  source.discovery.items[0] = { ...source.charges[0].support[0], supportId: 'support-1' };
  let state = finishTrial(configuredCase(source)); const caseId = state.cases[0].id;
  state = Trial.beginAppearance(state, caseId, state.cases[0].sentencingAt).state;
  const completed = Trial.completeAppearance(state, caseId, state.cases[0].sentencingAt + 2700);
  expect(completed.case.sentencing.order).toMatchObject({ kind: 'deathRow', deathSentence: true, destinationId: 'deathRowIntake', provisionalExecutionProcessId: expect.any(String), final: true });
  expect(completed.case.sentencing.order.reasons.at(-1)).toContain('does not kill the scientist');
  expect(completed.case).not.toHaveProperty('runEnded');
});

test('sentencing bands support time served and route severe punishment to penal service instead of indefinite imprisonment', () => {
  for (const scenario of [
    { weight: 5, submission: 'individualizedMercy', expected: 'timeServed' },
    { weight: 30, submission: 'penalService', expected: 'penalLegion' },
    { weight: 50, submission: 'individualizedMercy', expected: 'penalLegion' }
  ]) {
    const source = proceeding(); source.charges[0].weight = scenario.weight;
    let state = finishTrial(configuredCase(source, { sentencingSubmissionId: scenario.submission })); const caseId = state.cases[0].id;
    state = Trial.beginAppearance(state, caseId, state.cases[0].sentencingAt).state;
    const completed = Trial.completeAppearance(state, caseId, state.cases[0].sentencingAt + 2700);
    expect(completed.case.sentencing.order.kind).toBe(scenario.expected);
  }
});

test('missing a required trial appearance records nonappearance without resolving a verdict', () => {
  const source = proceeding(); source.trial.handoff.custodyStatus = 'released';
  const state = configuredCase(source); const advanced = Trial.advance(state, state.cases[0].appearanceDeadline + 1);
  expect(advanced).toMatchObject({ changes: 1, state: { cases: [{ status: 'missed', missedAt: expect.any(Number), charges: [{ verdict: 'pending' }] }] } });
});

test('@smoke a detained scientist physically completes a bench trial and receives a saved prison commitment without game over', async ({ page }) => {
  test.setTimeout(240_000);
  await startRun(page);
  await bookScientist(page);
  const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady({ custodial: true }));
  expect(caseId).toMatch(/^trial-case-/);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
  expect(snapshot).toMatchObject({ activeCase: { id: caseId, status: 'scheduled', strategy: { configured: true }, currentPhaseId: 'prosecution' }, activeStay: { status: 'active' }, runEnded: false });

  for (const phaseId of ['prosecution', 'defense', 'deliberation']) {
    expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true);
    expect((await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot())).scientist.roomId).toBe('municipalHoldingLegalRoom');
    expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);
    snapshot = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
    expect(snapshot.cases[0].phases.at(-1)).toMatchObject({ id: phaseId, completedAt: expect.any(Number) });
  }
  expect(snapshot.cases[0]).toMatchObject({ status: 'awaitingSentencing', currentPhaseId: 'sentencing', charges: [expect.objectContaining({ verdict: 'guilty', elements: expect.arrayContaining([expect.objectContaining({ proven: true })]) })] });
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId)).toBe(true);
  expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);

  snapshot = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
  expect(snapshot).toMatchObject({ activeCase: null, cases: [{ status: 'completed', sentencing: { order: { kind: 'finitePrison', custodial: true, destinationId: 'statePrisonIntake', status: 'commitmentPending' } } }], activeStay: { status: 'active' }, runEnded: false });
  const pretrial = await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot());
  expect(pretrial.proceedings[0]).toMatchObject({ status: 'resolved', resolution: { judgmentId: caseId, outcomeKind: 'finitePrison' } });
  expect(pretrial.scientist.roomId).toBe('municipalHoldingCell');

  await page.locator('[data-workspace-tab="visits"]').click();
  const trialRow = page.locator(`[data-trial-case-id="${caseId}"]`);
  await expect(trialRow).toContainText('Final order: Finite prison commitment');
  await expect(trialRow).toContainText('every required element was proven');

  expect(await page.evaluate((id) => window.helixHeresyDebug.makePrisonTransferDueNow(id), caseId)).toBe(true);
  const prison = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(prison).toMatchObject({ activeStay: { status: 'active', caseId, facility: { capacity: 9, occupied: 9 }, sentence: { months: expect.any(Number), maximumMonths: 120 }, suppressor: { suppressionActive: true }, actors: expect.any(Array), relationships: expect.any(Array) }, scientist: { roomId: 'statePrisonHousing', mapCell: { z: 5 } }, runEnded: false });
  expect(prison.activeStay.actors.filter((actor) => actor.role === 'prisoner')).toHaveLength(8);
  expect(prison.activeStay.actors.filter((actor) => actor.role !== 'prisoner')).toHaveLength(5);
  await expect(page.locator(`[data-prison-custody="${prison.activeStay.id}"]`)).toContainText('Shared housing is deliberately compact');
  await expect(page.locator(`[data-prison-custody="${prison.activeStay.id}"]`)).toContainText('Repeat Up to 7 Days');
  const prisoner = prison.activeStay.actors.find((actor) => actor.role === 'prisoner');
  const beforeRelationship = prison.activeStay.relationships.find((entry) => entry.actorId === prisoner.id).score;
  expect(await page.evaluate((actorId) => window.helixHeresyDebug.interactInPrison(actorId, 'conversation'), prisoner.id)).toBe(true);
  const routed = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(routed).toMatchObject({ custodyTasks: [{ type: 'prisonInteraction', data: { actorId: prisoner.id, mapPath: expect.any(Array) } }], scientist: { roomId: prisoner.roomId, mapCell: { z: 5 } } });
  expect(routed.custodyTasks[0].data.mapPath.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  let interacted = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(interacted.activeStay.relationships.find((entry) => entry.actorId === prisoner.id).score).toBe(beforeRelationship + 2);

  // Exercise the irreversible prison-break branch, then restore the saved custody
  // point so this same smoke test continues to cover lawful release as well.
  const lawfulCustodySave = await page.evaluate(() => window.localStorage.getItem('helix-heresy-v1-save'));
  const accompliceId = await page.evaluate(() => window.helixHeresyDebug.makePrisonBreakReady());
  expect(accompliceId).toMatch(/^prison-stay-\d+-prisoner-\d+$/);
  let breakSnapshot = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  const breakRecord = breakSnapshot.prisonBreak.records.find((record) => record.stayId === breakSnapshot.activeStay.id);
  expect(breakRecord.factIds).toHaveLength(8);
  expect(breakRecord.assets).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'latchShim', status: 'held', physicalStackId: expect.any(String) }),
    expect.objectContaining({ id: 'maintenanceCredential', status: 'held', physicalStackId: expect.any(String), actorId: accompliceId }),
    expect.objectContaining({ id: 'maintenanceUniform', status: 'held', physicalStackId: expect.any(String), actorId: accompliceId })
  ]));
  expect(await page.evaluate(() => window.helixHeresyDebug.planPrisonBreak('removeAfter'))).toBe(true);
  breakSnapshot = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  const attemptId = breakSnapshot.activePrisonBreak.id;
  const frozenUnserved = breakSnapshot.activePrisonBreak.frozen.unservedSentenceSeconds;
  expect(breakSnapshot.activePrisonBreak).toMatchObject({ collarStrategyId: 'removeAfter', status: 'planned', frozen: { assistingActorId: accompliceId, factIds: expect.any(Array), assetIds: expect.any(Array) } });
  expect(await page.evaluate((id) => window.helixHeresyDebug.forcePrisonBreakSuccess(id), attemptId)).toBe(true);
  for (let index = 0; index < breakSnapshot.activePrisonBreak.stages.length; index += 1) {
    expect(await page.evaluate((id) => window.helixHeresyDebug.queueNextPrisonBreakStage(id), attemptId)).toBe(true);
    const inMotion = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
    expect(inMotion.custodyTasks[0]).toMatchObject({ type: 'prisonBreakAction', data: { action: 'escapeStage', mapPath: expect.any(Array), stageId: expect.any(String) } });
    expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  }
  breakSnapshot = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(breakSnapshot).toMatchObject({
    activeStay: null,
    escapedStay: { status: 'escaped', sentence: { servicePausedAt: expect.any(Number), unservedSeconds: frozenUnserved }, suppressor: { suppressionActive: true } },
    latestPrisonEscape: { id: attemptId, status: 'escaped', pursuit: { status: 'watchingLab', labWatch: true } },
    scientist: { roomId: 'correctionalServiceRoad', mapCell: { z: 4 } },
    runEnded: false
  });
  expect(breakSnapshot.magicSuppressionReason).toContain('prison');
  const fugitiveProceeding = (await page.evaluate(() => window.helixHeresyDebug.pretrialProceedingsSnapshot())).proceedings[0];
  expect(fugitiveProceeding).toMatchObject({ status: 'fugitive', fugitive: { active: true, benchWarrantStatus: 'issued' }, charges: expect.arrayContaining([expect.objectContaining({ typeId: 'escapeCustody', support: [expect.objectContaining({ kind: 'prisonCustody', sourceId: attemptId })] })]) });
  await expect(page.locator('#visitsList')).toContainText('unserved and paused at escape');
  expect(await page.evaluate(() => window.helixHeresyDebug.queueEscapedPrisonCollarRemoval())).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  breakSnapshot = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(breakSnapshot).toMatchObject({ escapedStay: { suppressor: { status: 'removed', suppressionActive: false } }, latestPrisonEscape: { collarStatus: 'removed', collarRemoval: { status: 'completed' } } });
  expect(breakSnapshot.magicSuppressionReason).toBe('');
  expect(await page.evaluate(() => window.helixHeresyDebug.queuePrisonFugitiveReturn('concealedExit'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  breakSnapshot = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(breakSnapshot).toMatchObject({ scientist: { roomId: 'concealedExit' }, latestPrisonEscape: { pursuit: { status: 'recaptureScheduled', labWatch: true } }, runEnded: false });

  await page.evaluate((save) => window.localStorage.setItem('helix-heresy-v1-save', save), lawfulCustodySave);
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  interacted = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(interacted).toMatchObject({ activeStay: { status: 'active' }, latestPrisonEscape: null, scientist: { mapCell: { z: 5 } }, runEnded: false });

  expect(await page.evaluate(() => window.helixHeresyDebug.makePrisonReviewEligibleNow(true))).toBe(true);
  interacted = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(interacted).toMatchObject({ activeStay: { decision: { kind: 'releaseReviewEligible', required: true } }, releaseRecord: { eligibility: { notifiedAt: expect.any(Number) }, panel: { members: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]) } } });
  expect(await page.evaluate(() => window.helixHeresyDebug.filePrisonReleaseReview('verifiedReleasePlan'))).toBe(true);
  let release = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(release).toMatchObject({ activeStay: { status: 'active' }, releaseRecord: { applications: [{ status: 'filed', resolvedAt: null }] }, custodyTasks: [{ type: 'prisonReleaseReview', data: { mapPath: expect.any(Array) } }], scientist: { roomId: 'statePrisonProgram' } });
  expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  release = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(release).toMatchObject({ activeStay: { status: 'discharging' }, releaseRecord: { authorization: { kind: 'earnedSupervisedRelease', remainingSentenceSeconds: expect.any(Number), conditions: expect.arrayContaining([expect.objectContaining({ kind: 'supervisionReporting' })]) }, applications: [{ status: 'approved' }], discharge: { status: 'inTransit' } }, custodyTasks: [{ type: 'prisonDischarge' }], scientist: { roomId: 'statePrisonIntake' }, runEnded: false });
  const beforeWages = release.money;
  expect(await page.evaluate(() => window.helixHeresyDebug.completePrisonTaskNow())).toBe(true);
  release = await page.evaluate(() => window.helixHeresyDebug.prisonCustodySnapshot());
  expect(release.activeStay).toBeNull();
  expect(release.stays[0]).toMatchObject({ status: 'released', suppressor: { status: 'removed', suppressionActive: false } });
  expect(release.releaseRecords[0].discharge).toMatchObject({ status: 'completed', wagesPaid: 44, returnedPropertyLabels: ['Intake notebook'], transport: { destinationAccessPointId: 'publicEntrance', destinationRoomId: 'surfaceReception' } });
  expect(release).toMatchObject({ scientist: { roomId: 'surfaceReception' }, runEnded: false });
  expect(release.money).toBe(beforeWages + 44);

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
  expect(reloaded.cases[0]).toMatchObject({ id: caseId, status: 'completed', sentencing: { order: { commitmentId: expect.any(String), status: 'completed' } } });
  expect(reloaded.scientist.roomId).toBe('surfaceReception');
  expect(reloaded.runEnded).toBe(false);
});

test('@smoke a final noncustodial judgment releases the scientist through the armored jail route', async ({ page }) => {
  test.setTimeout(120_000);
  await startRun(page);
  await bookScientist(page);
  const caseId = await page.evaluate(() => window.helixHeresyDebug.makeTrialReady());
  for (let index = 0; index < 3; index += 1) {
    expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);
  }
  expect(await page.evaluate((id) => window.helixHeresyDebug.makeTrialAppearanceDueNow(id), caseId)).toBe(true);
  expect(await page.evaluate((id) => window.helixHeresyDebug.beginTrialCourtAppearance(id), caseId)).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);
  let snapshot = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
  expect(snapshot).toMatchObject({ cases: [{ sentencing: { order: { kind: 'timeServed', custodial: false, status: 'releasePending' } } }], activeStay: { status: 'active' }, scientist: { roomId: 'municipalHoldingProcessing' }, runEnded: false });
  expect(await page.evaluate(() => window.helixHeresyDebug.completeTrialCourtActionNow())).toBe(true);
  snapshot = await page.evaluate(() => window.helixHeresyDebug.trialSentencingSnapshot());
  expect(snapshot).toMatchObject({ cases: [{ sentencing: { order: { kind: 'timeServed', status: 'completed' } } }], activeStay: null, scientist: { roomId: 'surfaceReception' }, runEnded: false });
  const raids = await page.evaluate(() => window.helixHeresyDebug.lawEnforcementRaidsSnapshot());
  expect(raids.raids[0]).toMatchObject({ status: 'completed', custody: { status: 'released' }, detention: { status: 'released' } });
});
