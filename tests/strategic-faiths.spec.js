// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Divinity = require('../strategic-divinity');
const Faiths = require('../strategic-faiths');

let cachedMap;

function faithMap() {
  cachedMap ||= Library.createWorld({
    id: 'pre-civic-faiths',
    worldSeed: 'faith-check',
    worldTheme: 'unbound',
    generationVersion: 7,
    createdAt: 'test',
  }).generatedData.strategicMap;
  return cachedMap;
}

test('pre-civic faith identities are deterministic, semantic, and filtered by human knowledge before cities', () => {
  const map = faithMap();
  const directory = Faiths.publicFaithDirectory(map);
  const audit = Faiths.auditPreCivicFaiths(map);

  expect(map.humanGeography).toBeUndefined();
  expect(audit).toMatchObject({
    valid: true,
    independentOfCities: true,
    exactlyOneConfirmedFaithPerGod: true,
    everyFaithSemantic: true,
    noSameGodHeresyWhileCorrectionActive: true,
    promisesAcknowledgeFiniteCapacity: true,
  });
  expect(directory.faiths).toHaveLength(map.publicDivinityDirectory.godStateRows.length);
  expect(directory.faiths.length).toBeLessThan(map.strategicDivinity.godOrder.length);
  expect(directory.faiths.some((faith) => faith.godId === map.humanReligiousKnowledge.hiddenGodId)).toBe(false);
  for (const faith of directory.faiths) {
    expect(faith).toMatchObject({
      confirmation: { state: 'activelyConfirmed', authorityId: faith.godId, channel: 'repeatableDirectDivineCommunication' },
      coreTenets: expect.any(Array),
      commandments: expect.any(Array),
      prohibitions: expect.any(Array),
      promises: expect.any(Array),
      acceptableMethods: expect.any(Array),
      unacceptableMethods: expect.any(Array),
      outsiderTreatment: expect.any(Object),
      civicTeaching: { churchHasAutomaticSovereignty: false },
      urbanTeaching: expect.any(Object),
      topicPositions: expect.any(Object),
      verifiedConduct: expect.any(Array),
      sameGodHeresyClaimsValid: false,
    });
    expect(faith.promises.every((promise) => promise.conditionalOnFiniteCapacity)).toBe(true);
    expect(JSON.stringify(faith).toLowerCase()).not.toContain('alignment');
  }
});

test('holy sites use bounded rank-based counts and pre-civic physical causes', () => {
  const map = faithMap();
  const directory = Faiths.publicFaithDirectory(map);
  const states = map.strategicDivinity.godOrder.map((godId) => Divinity.privateDivineStateFor(map, godId));

  expect(new Set(directory.holySites.map((site) => site.cellId)).size).toBe(directory.holySites.length);
  for (const state of states) {
    const count = map.preCivicFaiths.holySiteRows.filter((row) => row[1] === state.id).length;
    expect(count).toBeGreaterThanOrEqual(state.rank === 'major' ? 1 : 0);
    expect(count).toBeLessThanOrEqual(state.rank === 'major' ? 3 : 2);
  }
  for (const site of directory.holySites) {
    expect(site).toMatchObject({
      confirmedByGod: true,
      divineActivity: 'active',
      discoveryStatus: 'confirmed',
      routineCommunicationRequired: false,
      publicEffects: expect.arrayContaining(['boundedManifestationSupport']),
    });
    expect(site.causalFactors.join(' ')).not.toMatch(/city|corridor|beastPressure|population/i);
  }
});

test('holy-site support finalizes divine power while exact power and suppressed origins stay hidden', () => {
  const map = faithMap();
  const directory = Faiths.publicFaithDirectory(map);
  const supportedGodIds = new Set(map.preCivicFaiths.holySiteRows.map((row) => row[1]));

  for (const godId of map.strategicDivinity.godOrder) {
    const privateState = Divinity.privateDivineStateFor(map, godId);
    expect(privateState.worshipSources.some((source) => source.holySiteSupportPermille > 0)).toBe(supportedGodIds.has(godId));
  }
  expect(map.strategicDivinity.holySiteSupportDigest).toBe(map.preCivicFaiths.divinityHolySiteSupportDigest);
  expect(map.preCivicFaiths.diagnostics.suppressedAscensionOriginCount).toBeGreaterThan(0);
  expect(JSON.stringify(map.publicPreCivicFaithDirectory)).not.toMatch(/suppressedAscensionEvent|ascensionResidue|exactAffinityScore|worshipSupportPermille/);
  const hidden = Faiths.privateHolySiteStateFor(map, directory.holySites[0].id);
  expect(hidden).toMatchObject({ publicInferencePermitted: false, exactAffinityScore: expect.any(Number), worshipSupportPermille: expect.any(Number) });
});

test('pre-civic faith and holy-site records survive the existing compact world round trip', () => {
  const world = Library.createWorld({ id: 'faith-roundtrip', worldSeed: 'faith-check', worldTheme: 'unbound', generationVersion: 7, createdAt: 'test' });
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(JSON.stringify(world).length).toBeLessThan(4_800_000);
});

test('descent and death preserve historical faith identity while reascension restores active confirmation', () => {
  const faith = Faiths.publicFaithDirectory(faithMap()).faiths[0];
  const descended = Faiths.projectFaithConfirmation(faith, { lifeState: 'living', divinityState: 'descended' });
  const dead = Faiths.projectFaithConfirmation(faith, { lifeState: 'dead', divinityState: 'none' });
  const reascended = Faiths.projectFaithConfirmation(descended, { lifeState: 'living', divinityState: 'divine' });
  const successor = Faiths.createUnconfirmedSuccessorFaith(dead, `${faith.id}:successor:1`, `${faith.name} Reformed`);

  expect(descended).toMatchObject({ id: faith.id, confirmation: { state: 'historicallyConfirmed', channel: 'lastConfirmedDoctrine', physicalSpeechCountsAsDivineConfirmation: false } });
  expect(dead).toMatchObject({ id: faith.id, confirmation: { state: 'historicallyConfirmed' } });
  expect(reascended).toMatchObject({ id: faith.id, confirmation: { state: 'activelyConfirmed', channel: 'repeatableDirectDivineCommunication', physicalSpeechCountsAsDivineConfirmation: true } });
  expect(successor).toMatchObject({ predecessorFaithId: faith.id, kind: 'unconfirmedSuccessorTradition', confirmation: { state: 'unconfirmedSuccessor', authorityId: null }, sameGodHeresyClaimsValid: false });
  expect(successor.id).not.toBe(faith.id);
});
