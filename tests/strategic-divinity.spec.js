// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Divinity = require('../strategic-divinity');

function divinityMap(seed = 'pre-civic-divinity', worldTheme = 'unbound') {
  return Library.createWorld({
    id: `divinity-${seed}-${worldTheme}`,
    worldSeed: seed,
    worldTheme,
    generationVersion: 7,
    createdAt: 'test',
  }).generatedData.strategicMap;
}

function deliberateWorship(id = 'worship:test:1') {
  return {
    id,
    kind: 'human',
    sourcePopulationId: 'human-population:test',
    sourcePopulationUnits: 1_000_000,
    practiceId: 'villageShrines',
    followerUnits: 900,
    beliefOnlyPopulation: 10000,
    devotionPermille: 900,
    organizationPermille: 900,
    ritualInfrastructurePermille: 800,
    offeringPermille: 700,
    holySiteSupportPermille: 500,
    coercedWorshipPermille: 0,
    receptionEfficiencyPermille: 1000,
  };
}

test('pre-civic divinity is deterministic, city-independent, compact, and knowledge-safe', () => {
  const first = divinityMap('independent-gods', 'grim');
  const same = divinityMap('independent-gods', 'grim');
  const audit = Divinity.auditPreCivicDivinity(first);

  expect(first.humanGeography).toBeUndefined();
  expect(first.strategicDivinity).toEqual(same.strategicDivinity);
  expect(first.publicDivinityDirectory).toEqual(same.publicDivinityDirectory);
  expect(audit).toMatchObject({
    valid: true,
    independentOfCities: true,
    allInitiallyLivingAndDivine: true,
    worshipRequiresIntentionalFaith: true,
    everyCohortPopulationBacked: true,
    humanDirectoryOmitsUnsupportedGods: true,
    beastOnlyUnknownGodPreserved: true,
    publicPracticesHideExactAllocations: true,
    exactPowerHiddenFromPublic: true,
    originsHiddenFromPublic: true,
    alignmentAbsent: true,
  });
  expect(JSON.stringify(first.publicDivinityDirectory)).not.toMatch(/reserveCapacity|receivingCapacity|privateObjective|mortalIdentityId/);
  expect(JSON.stringify(first).length).toBeLessThan(4_800_000);
  const savedWorld = Library.createWorld({
    id: 'divinity-save-roundtrip',
    worldSeed: 'independent-gods',
    worldTheme: 'grim',
    generationVersion: 7,
    createdAt: 'test',
  });
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(savedWorld)))).toEqual(savedWorld);
});

test('worship income requires deliberate devotion and rewards organization and infrastructure', () => {
  const source = deliberateWorship();
  const beliefOnly = { ...source, followerUnits: 0, beliefOnlyPopulation: 1000000 };
  const disorganized = { ...source, organizationPermille: 200, ritualInfrastructurePermille: 100, offeringPermille: 100, holySiteSupportPermille: 0 };
  const coerced = { ...source, coercedWorshipPermille: 1000 };

  expect(Divinity.worshipPowerFromSource(beliefOnly)).toBe(0);
  expect(Divinity.worshipPowerFromSource(source)).toBeGreaterThan(Divinity.worshipPowerFromSource(disorganized));
  expect(Divinity.worshipPowerFromSource(coerced)).toBeGreaterThan(0);
  expect(Divinity.worshipPowerFromSource(coerced)).toBeLessThan(Divinity.worshipPowerFromSource(source));
  expect(Divinity.calculateWorshipIncome([source], 50)).toBe(50);
});

test('losing every follower causes reversible descent without death', () => {
  const map = divinityMap('fallen-god');
  const original = Divinity.privateDivineStateFor(map, map.strategicDivinity.godOrder[0]);
  const noWorship = original.worshipSources.map((source) => ({ ...source, followerUnits: 0, beliefOnlyPopulation: source.sourcePopulationUnits }));
  const descended = Divinity.advanceDivineCycle(original, { worshipSources: noWorship, publiclyObserved: true });

  expect(descended.lifecycle).toMatchObject({ lifeState: 'living', divinityState: 'descended', publicStatus: 'fallen' });
  expect(descended.power.reserve).toBe(0);
  expect(descended.descendedMortalPower).toMatchObject({ condition: 'activeFormerGod', remainsExtraordinary: true });
  expect(descended.descendedMortalPower.retainedSources).toEqual(expect.arrayContaining(['perfectedBody', 'ancientSkills', 'divineKnowledge']));

  const restored = Divinity.restoreDescendedDivinity(descended, {
    worshipSources: [deliberateWorship('worship:restoration:1')],
    catalyst: true,
    identityStable: true,
    coreReconstructed: true,
    publiclyObserved: true,
  });
  expect(restored.id).toBe(original.id);
  expect(restored.stableIdentity.mortalIdentityId).toBe(original.stableIdentity.mortalIdentityId);
  expect(restored.lifecycle).toMatchObject({ lifeState: 'living', divinityState: 'divine', publicStatus: 'active' });
});

test('death is separate and permanent while captured power remains partial', () => {
  const map = divinityMap('divine-death');
  const victim = Divinity.privateDivineStateFor(map, map.strategicDivinity.godOrder[0]);
  const victor = Divinity.privateDivineStateFor(map, map.strategicDivinity.godOrder[1]);
  const result = Divinity.resolveDivineDeath(victim, victor, { capturePermille: 300, publiclyConfirmed: true });

  expect(result.victim.lifecycle).toMatchObject({ lifeState: 'dead', divinityState: 'none', publicStatus: 'confirmedDead' });
  expect(result.victim.power.reserve).toBe(0);
  expect(result.capturedPower).toBeGreaterThan(0);
  expect(result.capturedPower + result.remains.power + result.dissipatedPower).toBe(victim.power.reserve);
  expect(result).toMatchObject({ identityTransferred: false, religionTransferred: false });
  expect(() => Divinity.advanceDivineCycle(result.victim)).toThrow(/permanent divine death/i);
  expect(() => Divinity.restoreDescendedDivinity(result.victim, {})).toThrow(/permanent divine death/i);
});

test('combat uses causal advantages and ascension requires a surviving stable mortal identity', () => {
  const map = divinityMap('combat-and-ascension');
  const attacker = Divinity.privateDivineStateFor(map, map.strategicDivinity.godOrder[0]);
  const defender = Divinity.privateDivineStateFor(map, map.strategicDivinity.godOrder[1]);
  const ordinary = Divinity.resolveDivineCombat(attacker, defender, { seed: 'ordinary' });
  const prepared = Divinity.resolveDivineCombat(attacker, defender, { seed: 'prepared', attackerPreparation: 5000, attackerHolySitePower: 5000 });

  expect(prepared.attackerScore).toBeGreaterThan(ordinary.attackerScore);
  expect(prepared).toMatchObject({ winnerId: attacker.id, deathAutomatic: false, outcomeOptions: ['retreat', 'forcedDescent', 'death'] });
  expect(() => Divinity.ascendMortal({ id: 'mortal:failed', originKind: 'human' }, {})).toThrow(/ascension requires/i);

  const ascended = Divinity.ascendMortal({
    id: 'mortal:successful',
    originKind: 'beast',
    stableIdentity: true,
    transcendentPower: 280,
    soulStable: true,
    survivesTransformation: true,
  }, {
    catalyst: 'world-heart-fragment',
    viableDivineCore: true,
    repeatableSignature: 'divine-signature:ascended-fixture',
    worshipSources: [deliberateWorship('worship:ascended:1')],
    receivingCapacity: 400,
    reserveCapacity: 900,
    existenceCost: 30,
    domains: ['beasts', 'transformation'],
  });
  expect(ascended).toMatchObject({
    id: expect.stringMatching(/^god:ascended:/),
    stableIdentity: { mortalIdentityId: 'mortal:successful', originKind: 'beast', identityContinuity: 'continuousThroughAscension' },
    lifecycle: { lifeState: 'living', divinityState: 'divine' },
  });
  expect(map.strategicDivinity.godOrder).not.toContain(ascended.id);
});
