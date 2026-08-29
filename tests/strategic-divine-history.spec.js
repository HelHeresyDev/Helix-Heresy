// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const DivineHistory = require('../strategic-divine-history');

const cache = new Map();

function generatedWorld(seed = 'world-seed-one', worldTheme = 'unbound') {
  const key = `${seed}:${worldTheme}`;
  if (!cache.has(key)) cache.set(key, Library.createWorld({ id: `divine-history-${key}`, worldSeed: seed, worldTheme, createdAt: 'test' }));
  return cache.get(key);
}

test('divine history is deterministic, sparse, causal, and preserves the pre-civic baseline', () => {
  const first = generatedWorld();
  const same = Library.createWorld({ id: 'same-divine-history', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  const map = first.generatedData.strategicMap;
  const record = map.strategicDivineHistory;

  expect(record).toEqual(same.generatedData.strategicMap.strategicDivineHistory);
  expect(record.sourceDivinityDigest).toBe(map.strategicDivinity.digest);
  expect(record.eventRows.length).toBeLessThanOrEqual(record.opportunityYears.length);
  expect(record.eventRows.length).toBeGreaterThan(0);
  expect(record.eventRows.every((event) => event.cellId && event.prerequisites.length && event.exactContributions && event.stateDelta)).toBe(true);
  expect(DivineHistory.auditStrategicDivineHistory(map)).toMatchObject({ valid: true, preCivicBaselineImmutable: true, retainedEventsHaveConsequences: true, quietWorldsAllowed: true });
});

test('conflict distinguishes retreat, descent, reascension, and permanent death through saved factors', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicDivineHistory;
  const kinds = new Set(record.eventRows.map((event) => event.kind));

  expect(kinds.has('holySiteContest')).toBe(true);
  expect(kinds.has('forcedDescent') || kinds.has('worshipCollapse')).toBe(true);
  expect(kinds.has('reascension')).toBe(true);
  expect(kinds.has('divineDeath')).toBe(true);

  for (const event of record.eventRows.filter((entry) => ['holySiteContest', 'forcedDescent', 'divineDeath'].includes(entry.kind))) {
    expect(event.exactContributions).toMatchObject({ attackerCommittedPower: expect.any(Number), defenderCommittedPower: expect.any(Number), attackerPreparation: expect.any(Number), defenderPreparation: expect.any(Number), attackerSurprise: expect.any(Number), defenderSurprise: expect.any(Number), attackerManifestationCost: expect.any(Number), defenderManifestationCost: expect.any(Number), attackerScore: expect.any(Number), defenderScore: expect.any(Number) });
  }
  for (const event of record.eventRows.filter((entry) => ['forcedDescent', 'worshipCollapse'].includes(entry.kind))) {
    expect(event.stateDelta).toMatchObject({ identityPreserved: true, retainedMortalPower: true });
    expect(event.stateDelta.lifeState || event.stateDelta.loserLifeState).toBe('living');
  }
  for (const event of record.eventRows.filter((entry) => entry.kind === 'divineDeath')) {
    expect(event.stateDelta).toMatchObject({ victimLifeState: 'dead', victimDivinityState: 'none', identityTransferred: false, religionTransferred: false });
    expect(record.remainsRows.some((remains) => remains.id === event.stateDelta.remainsId && remains.discoverableHook)).toBe(true);
  }
  expect(DivineHistory.auditStrategicDivineHistory(map)).toMatchObject({ descentPreservesLivingIdentity: true, deathPermanentAndIdentityNotTransferred: true });
});

test('faith confirmation follows current lifecycle while successors remain unconfirmed', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicDivineHistory;

  for (const faith of record.currentFaithRows) {
    const god = record.currentGodRows.find((entry) => entry.id === faith.godId);
    expect(faith.confirmationState).toBe(god.lifecycle.lifeState === 'living' && god.lifecycle.divinityState === 'divine' ? 'activelyConfirmed' : 'historicallyConfirmed');
    expect(faith.sameGodHeresyClaimsValid).toBe(false);
  }
  expect(record.successorRows.length).toBeGreaterThan(0);
  expect(record.successorRows.every((successor) => successor.confirmationState === 'unconfirmedSuccessor' && successor.correctionAuthorityId === null && !successor.sameGodHeresyClaimsValid && !successor.sovereignAuthority)).toBe(true);
  const reascendedGodIds = new Set(record.eventRows.filter((event) => event.kind === 'reascension').flatMap((event) => event.participantIds));
  expect(record.successorRows.filter((successor) => reascendedGodIds.has(successor.historicalGodId)).every((successor) => successor.resolution === 'reconciliationContested')).toBe(true);
});

test('rare beast ascension preserves population capacity and creates a distinct minor god and faith', () => {
  const map = generatedWorld('rare-ascension-4').generatedData.strategicMap;
  const record = map.strategicDivineHistory;
  const event = record.eventRows.find((entry) => entry.kind === 'mortalAscension');
  const ascended = record.currentGodRows.find((god) => god.id === event?.stateDelta.newGodId);
  const faith = record.ascendedFaithRows.find((entry) => entry.godId === ascended?.id);
  const currentFaith = record.currentFaithRows.find((entry) => entry.godId === ascended?.id);
  const compact = record.eventRows.find((entry) => entry.kind === 'divineCooperation');

  expect(event).toMatchObject({ mortalOrigin: { kind: 'beast' }, prerequisites: expect.arrayContaining(['stableMortalIdentity', 'transcendentPower', 'soulStability', 'survivedTransformation', 'identityBoundDivineCore', 'deliberateTransferredWorship', 'repeatableDivineSignature']), stateDelta: { initialRank: 'minor', identityContinuous: true } });
  expect(event.exactContributions.transferredFollowerUnits).toBeGreaterThan(0);
  expect(ascended).toMatchObject({ definitionId: 'ascended.dynamic', rank: 'minor', stableIdentity: { originKind: 'beast', identityContinuity: 'continuousThroughAscension' }, lifecycle: { lifeState: 'living' } });
  expect(event.exactContributions.worshipIncome).toBeGreaterThan(0);
  expect(faith).toMatchObject({ distinctFromPredecessorFaith: true, confirmationState: 'activelyConfirmed', sameGodHeresyClaimsValid: false });
  expect(currentFaith.confirmationState).toBe(ascended.lifecycle.divinityState === 'divine' ? 'activelyConfirmed' : 'historicallyConfirmed');
  expect(compact).toMatchObject({ prerequisites: expect.arrayContaining(['compatibleImmediateObjectives', 'finiteCommittedPower', 'specificPhysicalTarget', 'temporaryMutualConsent']), stateDelta: { mergesGods: false, mergesFaiths: false, createsSovereignty: false, temporaryCompactEndsYear: expect.any(Number) } });

  const assigned = new Map();
  for (const god of record.currentGodRows) for (const source of god.worshipSources) assigned.set(source.sourcePopulationId, (assigned.get(source.sourcePopulationId) || 0) + source.followerUnits);
  expect(record.currentGodRows.every((god) => god.worshipSources.every((source) => assigned.get(source.sourcePopulationId) <= source.sourcePopulationUnits))).toBe(true);
  expect(DivineHistory.auditStrategicDivineHistory(map).ascensionsRequireCausalPrerequisites).toBe(true);
});

test('public chronology and save-load projection hide canonical power, cohorts, and uncertain causes', () => {
  const world = generatedWorld();
  const map = world.generatedData.strategicMap;
  const publicHistory = DivineHistory.publicDivineHistory(map);
  const publicJson = JSON.stringify(publicHistory);

  expect(publicHistory.currentGods.length).toBeGreaterThan(0);
  expect(publicHistory.chronology.every((event) => event.exactPowerPublic === false && event.hiddenCausalityAcknowledged)).toBe(true);
  expect(publicHistory.principles).toMatchObject({ descentIsNotDeath: true, deathPermanentByDefault: true, reascensionRestoresSameIdentity: true, victorsNeverInheritCompleteReligion: true, ascendantsCreateDistinctFaiths: true, sameGodHeresyClaimsValid: false });
  expect(publicJson).not.toMatch(/exactContributions|actualCause|followerDispositionRows|worshipIncome|reserveAfterward|attackerScore|defenderScore|transferredFollowerUnits|exactResidualPower/);
  expect(DivineHistory.auditStrategicDivineHistory(map).publicHistoryHidesExactPowerAndCausality).toBe(true);

  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));
  expect(normalized.generatedData.strategicMap.strategicDivineHistory).toEqual(map.strategicDivineHistory);
  expect(normalized.generatedData.strategicMap.publicDivineHistoryDirectory).toEqual(map.publicDivineHistoryDirectory);
});
