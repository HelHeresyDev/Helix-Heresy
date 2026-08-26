// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const BeastEcology = require('../strategic-beast-ecology');
const StrategicWorld = require('../strategic-world');

function generatedWorld(seed, theme = 'madcap') {
  return Library.createWorld({ id: `world-${seed}-${theme}`, worldSeed: seed, worldTheme: theme, createdAt: 'test' }).generatedData.strategicMap;
}

test('the complete authored species catalog exists unchanged in every world while populations vary', () => {
  const first = generatedWorld('beast-catalog-first');
  const second = generatedWorld('beast-catalog-second');

  expect(first.beastEcology.species).toEqual(BeastEcology.BEAST_SPECIES);
  expect(second.beastEcology.species).toEqual(BeastEcology.BEAST_SPECIES);
  expect(first.beastEcology.species).toEqual(second.beastEcology.species);
  expect(first.beastEcology.populations).not.toEqual(second.beastEcology.populations);
  for (const species of BeastEcology.BEAST_SPECIES) {
    expect(first.beastEcology.populations.some((population) => population.speciesId === species.id)).toBe(true);
    expect(second.beastEcology.populations.some((population) => population.speciesId === species.id)).toBe(true);
  }
});

test('population ecology is deterministic, theme-independent, validated, and compact', () => {
  const first = generatedWorld('beast-determinism', 'madcap');
  const same = generatedWorld('beast-determinism', 'madcap');
  const grim = generatedWorld('beast-determinism', 'grim');

  expect(first.beastEcology).toEqual(same.beastEcology);
  expect(first.publicBeastAtlas).toEqual(same.publicBeastAtlas);
  expect(first.beastEcology.species).toEqual(grim.beastEcology.species);
  expect(first.beastEcology.populations).toEqual(grim.beastEcology.populations);
  expect(first.beastEcology.migrations).toEqual(grim.beastEcology.migrations);
  expect(first.beastEcology.cityAttackExposure).toEqual(grim.beastEcology.cityAttackExposure);
  expect(first.beastEcology.waveProfiles).toEqual(grim.beastEcology.waveProfiles);
  expect(first.publicBeastAtlas.reports.map(({ id, speciesId, reportedRangeMask, confidence, reportedAbundanceBand, threatBand, knownLairCellId, publicReason }) => ({ id, speciesId, reportedRangeMask, confidence, reportedAbundanceBand, threatBand, knownLairCellId, publicReason })))
    .toEqual(grim.publicBeastAtlas.reports.map(({ id, speciesId, reportedRangeMask, confidence, reportedAbundanceBand, threatBand, knownLairCellId, publicReason }) => ({ id, speciesId, reportedRangeMask, confidence, reportedAbundanceBand, threatBand, knownLairCellId, publicReason })));
  expect(BeastEcology.validateBeastEcology(first)).toEqual({ ecology: first.beastEcology, publicAtlas: first.publicBeastAtlas });
  expect(JSON.stringify(first).length).toBeLessThan(4_000_000);
});

test('seasonal migrations use eligible species, saved adjacency, movement realms, and four climate phases', () => {
  const map = generatedWorld('beast-migrations');
  expect(map.beastEcology.migrations.length).toBeGreaterThan(10);
  for (const migration of map.beastEcology.migrations) {
    const population = map.beastEcology.populations.find((entry) => entry.id === migration.populationId);
    const species = BeastEcology.BEAST_SPECIES.find((entry) => entry.id === population.speciesId);
    expect(BeastEcology.MIGRATORY_SOCIAL_PATTERNS).toContain(species.socialPattern);
    expect(new Set(Object.values(migration.phases))).toEqual(new Set(BeastEcology.SEASON_PHASES));
    for (let index = 1; index < migration.cellPath.length; index += 1) {
      const left = StrategicWorld.cellIndex(migration.cellPath[index - 1]);
      const right = StrategicWorld.cellIndex(migration.cellPath[index]);
      expect(StrategicWorld.topologyForMap(map).neighbors[left]).toContain(right);
    }
  }
});

test('every city is attackable without requiring migration or a current wave profile', () => {
  const map = generatedWorld('pressure-probe-a');
  const audit = BeastEcology.auditBeastEcology(map);
  expect(audit).toMatchObject({ everyCityAttackable: true, causalWaveProfiles: true, sharedThreatsUseWarningProtocols: true });
  expect(audit.cityAttackExposureCount).toBe(map.humanGeography.cities.length);
  expect(audit.waveProfileCount).toBeGreaterThan(0);
  expect(audit.citiesWithoutWaveProfiles).toBeGreaterThan(0);
  expect(audit.sharedThreatCount).toBeGreaterThan(0);
  expect(map.beastEcology.waveProfiles.every((profile) => profile.triggerFacts.length > 0 && profile.threatenedCityIds.length > 0)).toBe(true);
  expect(Math.max(...map.humanGeography.cities.map((city) => map.beastEcology.waveProfiles.filter((profile) => profile.threatenedCityIds.includes(city.id)).length))).toBeLessThanOrEqual(3);
  expect(map.beastEcology.sharedThreats.every((shared) => shared.coalitionFormed === false && shared.warningProtocol === 'sharedMonsterWaveWarningProtocol')).toBe(true);
});

test('territories respect species surface realms, exclude fortified cores, overlap, and dominate most land', () => {
  const map = generatedWorld('beast-territories');
  const audit = BeastEcology.auditBeastEcology(map);

  expect(audit).toMatchObject({ valid: true, staticSpeciesCount: 24, everySpeciesPresent: true });
  expect(audit.populationCount).toBeGreaterThan(60);
  expect(audit.relationCount).toBeGreaterThan(20);
  expect(audit.canonicalLandCoveragePercent).toBeGreaterThan(70);
  expect(audit.contestedCellCount).toBeGreaterThan(0);
  for (const population of map.beastEcology.populations) {
    const definition = BeastEcology.BEAST_SPECIES.find((species) => species.id === population.speciesId);
    const center = StrategicWorld.cellIndex(population.centerCellId);
    expect(map.cityPolities.control.classes[center]).not.toBe('c');
    if (definition?.realm === 'land') expect(map.surface.classes[center]).toBe('L');
    if (definition?.realm === 'ocean') expect(map.surface.classes[center]).toBe('W');
  }
});

test('the public atlas exposes uncertainty without leaking exact populations or unknown lairs', () => {
  const map = generatedWorld('beast-public-atlas');
  const audit = BeastEcology.auditBeastEcology(map);
  const reportedIndex = [...map.publicBeastAtlas.threatClasses].findIndex((code) => code !== '.');
  const snapshot = BeastEcology.cellPublicBeastSnapshot(map, reportedIndex);

  expect(audit).toMatchObject({ publicAtlasHidesPopulationIdentity: true, publicAtlasHidesPopulationIndex: true, publicAtlasHidesUnknownLairs: true, publicAtlasHidesExactPaths: true });
  expect(snapshot?.reports.length).toBeGreaterThan(0);
  expect(snapshot?.reports[0]).toMatchObject({
    species: { id: expect.stringMatching(/^beast:/), name: expect.any(String) },
    confidence: expect.stringMatching(/^(low|moderate|high)$/),
    reportedAbundanceBand: expect.stringMatching(/^(relict|sparse|established|dense|teeming)$/),
  });
  expect(snapshot?.reports[0]).not.toHaveProperty('populationIndex');
  expect(snapshot?.reports[0]).not.toHaveProperty('populationId');
  expect(snapshot?.reports[0]).not.toHaveProperty('lairCellId');
  expect(map.publicBeastAtlas.reports.every((report) => /^beast-report:\d{4}$/.test(report.id))).toBe(true);
  expect(BeastEcology.publicBestiary(map)).toHaveLength(BeastEcology.BEAST_SPECIES.length);
  expect(map.publicBeastAtlas.migrationReports.every((report) => !Object.hasOwn(report, 'populationId') && !Object.hasOwn(report, 'cellPath'))).toBe(true);
  expect(map.publicBeastAtlas.waveWarnings.every((warning) => !Object.hasOwn(warning, 'populationId') && !Object.hasOwn(warning, 'cellPath') && !Object.hasOwn(warning, 'triggerFacts'))).toBe(true);
  const directory = BeastEcology.publicCityThreatDirectory(map);
  expect(directory).toHaveLength(map.humanGeography.cities.length);
  expect(directory.every((entry) => entry.attackAssessment.attackPossible)).toBe(true);
  expect(directory.some((entry) => entry.waveWarnings.length === 0)).toBe(true);
});

test('validation rejects altered canonical and public ecology', () => {
  const map = generatedWorld('beast-integrity');
  const alteredTruth = JSON.parse(JSON.stringify(map));
  alteredTruth.beastEcology.populations[0].populationIndex += 1;
  alteredTruth.digest = StrategicWorld.strategicMapDigest(alteredTruth);
  expect(() => BeastEcology.validateBeastEcology(alteredTruth)).toThrow(/digest/i);

  const alteredPublic = JSON.parse(JSON.stringify(map));
  alteredPublic.publicBeastAtlas.reports[0].populationIndex = 999;
  alteredPublic.digest = StrategicWorld.strategicMapDigest(alteredPublic);
  expect(() => BeastEcology.validateBeastEcology(alteredPublic)).toThrow(/leaks/i);
});
