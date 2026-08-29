// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Divinity = require('../strategic-divinity');
const Faiths = require('../strategic-faiths');
const Religions = require('../strategic-religions');
const BeastEcology = require('../strategic-beast-ecology');
const PreUrbanHumanity = require('../strategic-pre-urban-humanity');

let cachedMap;

function worshipMap() {
  cachedMap ||= Library.createWorld({ id: 'population-backed-worship', worldSeed: 'population-backed-worship', worldTheme: 'unbound', createdAt: 'test' }).generatedData.strategicMap;
  return cachedMap;
}

test('every active god draws deliberate worship from bounded canonical populations', () => {
  const map = worshipMap();
  const humanGroups = PreUrbanHumanity.expandPopulationGroups(map);
  const beastGroups = BeastEcology.expandPristineBeastEcology(map).populations;
  const capacities = new Map([
    ...humanGroups.map((group) => [group.id, { kind: 'human', units: group.population }]),
    ...beastGroups.map((population) => [population.id, { kind: 'beast', units: population.devotionalUnitCount }]),
  ]);
  const assigned = new Map();

  for (const godId of map.strategicDivinity.godOrder) {
    const god = Divinity.privateDivineStateFor(map, godId);
    expect(god.worshipSources.some((source) => source.followerUnits > 0 && source.devotionPermille > 0)).toBe(true);
    for (const source of god.worshipSources) {
      const population = capacities.get(source.sourcePopulationId);
      expect(population).toEqual({ kind: source.kind, units: source.sourcePopulationUnits });
      expect(source.followerUnits).toBeLessThanOrEqual(source.sourcePopulationUnits);
      assigned.set(source.sourcePopulationId, (assigned.get(source.sourcePopulationId) || 0) + source.followerUnits);
    }
  }
  expect([...assigned].every(([populationId, followers]) => followers <= capacities.get(populationId).units)).toBe(true);
  expect(Divinity.auditPreCivicDivinity(map)).toMatchObject({ everyCohortPopulationBacked: true, worshipRequiresIntentionalFaith: true });
});

test('beast worship uses cognition-appropriate practices and collective devotional units', () => {
  const map = worshipMap();
  const pristine = BeastEcology.expandPristineBeastEcology(map);
  const populationById = new Map(pristine.populations.map((population) => [population.id, population]));
  const allowed = {
    sapient: new Set(['formalDoctrine', 'ordainedClergy', 'templeCustody', 'relicTradition']),
    reasoning: new Set(['formalDoctrine', 'ritualCustodians', 'templeCustody', 'relicTradition', 'sacredTerritory', 'learnedOffering']),
    cunning: new Set(['dominanceRite', 'sacredHunt', 'learnedOffering', 'nestTaboo']),
    instinctive: new Set(['sacredMigration', 'cultivatedDivineBond', 'instinctiveOffering']),
  };
  const beastSources = map.strategicDivinity.godOrder.flatMap((godId) => Divinity.privateDivineStateFor(map, godId).worshipSources).filter((source) => source.kind === 'beast');

  expect(beastSources.length).toBeGreaterThan(0);
  for (const source of beastSources) {
    const population = populationById.get(source.sourcePopulationId);
    const species = BeastEcology.BEAST_SPECIES.find((entry) => entry.id === population.speciesId);
    expect(allowed[species.intelligenceBand].has(source.practiceId)).toBe(true);
    expect(source.sourcePopulationUnits).toBe(population.devotionalUnitCount);
  }
  expect(pristine.populations.filter((population) => ['superorganism', 'hiveColony', 'burrowColony', 'choralColony'].includes(BeastEcology.BEAST_SPECIES.find((entry) => entry.id === population.speciesId).socialPattern)).every((population) => population.devotionalUnitCount >= 1)).toBe(true);
});

test('human-facing directories omit the beast-only unknown god without mystery placeholders or hidden totals', () => {
  const map = worshipMap();
  const hiddenGodId = map.humanReligiousKnowledge.hiddenGodId;
  const divinity = Divinity.publicDivinityDirectory(map);
  const faiths = Faiths.publicFaithDirectory(map);
  const religions = Religions.publicReligionDirectory(map);
  const hiddenGod = Divinity.privateDivineStateFor(map, hiddenGodId);
  const knownBeastOnlyGod = divinity.godStates.map((state) => Divinity.privateDivineStateFor(map, state.godId)).find((god) => god.worshipSources.every((source) => source.kind === 'beast'));

  expect(hiddenGod.worshipSources.every((source) => source.kind === 'beast')).toBe(true);
  expect(knownBeastOnlyGod).toBeTruthy();
  expect(divinity.godStates.some((state) => state.godId === hiddenGodId)).toBe(false);
  expect(faiths.faiths.some((faith) => faith.godId === hiddenGodId)).toBe(false);
  expect(religions.gods.some((god) => god.id === hiddenGodId)).toBe(false);
  expect(map.preCivicFaiths.faithRows.some((row) => row[1] === hiddenGodId)).toBe(true);
  const publicJson = JSON.stringify({ divinity: map.publicDivinityDirectory, faiths: map.publicPreCivicFaithDirectory, religions: map.publicReligionDirectory });
  expect(publicJson).not.toContain(hiddenGodId);
  expect(publicJson).not.toMatch(/Unknown Monster|unknownGod|hiddenGod|followerUnits|sourcePopulationId|humanUnknownGodCount/);
  expect(divinity.knownPractices.every((practice) => practice.exactFollowerCountPublic === false && practice.sourcePopulationIdentityPublic === false)).toBe(true);
});

test('population-backed worship and human knowledge survive compact save/load and reject demographic over-allocation', () => {
  const world = Library.createWorld({ id: 'worship-roundtrip', worldSeed: 'population-backed-worship', worldTheme: 'unbound', createdAt: 'test' });
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(JSON.stringify(world).length).toBeLessThan(5_500_000);

  const altered = JSON.parse(JSON.stringify(world.generatedData.strategicMap));
  const fields = altered.strategicDivinity.godRows[0][6][0].split('.');
  fields[4] = (parseInt(fields[2], 36) + 1).toString(36);
  altered.strategicDivinity.godRows[0][6][0] = fields.join('.');
  expect(() => Divinity.validatePreCivicDivinity(altered)).toThrow(/bounded|population|cohort/i);
});
