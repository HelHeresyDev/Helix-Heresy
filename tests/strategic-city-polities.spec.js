// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');
const StrategicGeology = require('../strategic-geology');
const ArcaneGeography = require('../strategic-arcane-geography');
const Resources = require('../strategic-resource-potential');
const HumanGeography = require('../strategic-human-geography');
const CityPolities = require('../strategic-city-polities');

function generatedHumanWorld(seed) {
  let map = StrategicWorld.createStrategicMap(seed);
  map = PlanetaryRelief.attachRelief(seed, map);
  map = Environment.attachEnvironment(seed, map);
  map = StrategicGeology.attachGeology(seed, map);
  map = ArcaneGeography.attachArcaneGeography(seed, map);
  map = Resources.attachResourcePotential(seed, map);
  return HumanGeography.attachHumanGeography(seed, map);
}

test('sovereign city polities are deterministic, themed, source-linked, and compact', () => {
  const human = generatedHumanWorld('city-polity-determinism');
  const first = CityPolities.attachCityPolities('city-polity-determinism', 'unbound', human);
  const same = CityPolities.attachCityPolities('city-polity-determinism', 'unbound', human);
  const grim = CityPolities.attachCityPolities('city-polity-determinism', 'grim', human);

  expect(first.cityPolities).toEqual(same.cityPolities);
  expect(first.cityPolities).not.toEqual(grim.cityPolities);
  expect(first.humanGeography).toEqual(grim.humanGeography);
  expect(first.cityPolities.sourceHumanGeographyDigest).toBe(first.humanGeography.digest);
  expect(CityPolities.validateCityPolities(first)).toEqual(first.cityPolities);
  expect(JSON.stringify(first).length).toBeLessThan(3_100_000);
});

test('every city is its own globally connected polity with only local physical control', () => {
  const map = CityPolities.attachCityPolities('city-polity-sovereignty', 'unbound', generatedHumanWorld('city-polity-sovereignty'));
  const audit = CityPolities.auditCityPolities(map);

  expect(audit).toMatchObject({
    valid: true,
    oneIndependentPolityPerCity: true,
    maximumCitiesPerPolity: 1,
    globalInternetCoverage: true,
    permanentAllianceCount: 0,
  });
  expect(audit.individualAuthorityCount).toBeGreaterThan(0);
  expect(audit.collectiveAuthorityCount).toBeGreaterThan(0);
  expect(audit.controlledLandPercent).toBeLessThan(8);
  expect(new Set(map.cityPolities.polities.map((polity) => polity.cityId)).size).toBe(map.humanGeography.cities.length);
  expect(map.cityPolities.polities.every((polity) => polity.sovereignty === 'independentCityPolity')).toBe(true);
  expect(map.cityPolities.polities.every((polity) => polity.internetStatus === 'globalNetworkConnected')).toBe(true);
  expect(map.cityPolities).not.toHaveProperty('states');
  expect(map.cityPolities).not.toHaveProperty('territorialClaims');
});

test('sparse relations cover corridor warnings without inventing standing alliances', () => {
  const map = CityPolities.attachCityPolities('city-polity-relations', 'unbound', generatedHumanWorld('city-polity-relations'));
  const relations = map.cityPolities.relations;
  const polityByCity = new Map(map.cityPolities.polities.map((polity) => [polity.cityId, polity]));

  expect(relations.length).toBeLessThan(map.cityPolities.polities.length * 4);
  expect(relations.some((relation) => relation.basis === 'notableInternetTie')).toBe(true);
  expect(relations.every((relation) => relation.permanentAlliance === false)).toBe(true);
  for (const route of map.routeGraph.routes) {
    const pair = route.endpointIds.map((cityId) => polityByCity.get(cityId)?.id).sort();
    const relation = relations.find((entry) => entry.cityPolityIds.join('|') === pair.join('|'));
    expect(relation).toMatchObject({
      basis: 'corridorNeighbors',
      standingObligations: expect.arrayContaining(['sharedMonsterWaveWarningProtocol', 'corridorStatusExchange']),
    });
  }
});

test('cell inspection exposes sovereign identity, civic causes, and non-territorial corridor control', () => {
  const map = CityPolities.attachCityPolities('city-polity-inspection', 'madcap', generatedHumanWorld('city-polity-inspection'));
  const polity = map.cityPolities.polities[0];
  const citySnapshot = CityPolities.cellCityPolitySnapshot(map, StrategicWorld.cellIndex(polity.cellId));
  const intermittentIndex = [...map.cityPolities.control.classes].findIndex((code) => code === 'i');
  const corridorSnapshot = CityPolities.cellCityPolitySnapshot(map, intermittentIndex);

  expect(citySnapshot).toMatchObject({
    controlClass: 'fortifiedCore',
    cityPolity: { id: polity.id, authority: { kind: expect.stringMatching(/^(individual|collective)$/) } },
    controller: { id: polity.id },
  });
  expect(citySnapshot?.cityPolity?.civicPriorities).toHaveLength(3);
  expect(citySnapshot?.cityPolity?.logisticalDependencies).toHaveLength(3);
  expect(corridorSnapshot).toMatchObject({ controlClass: 'intermittentCorridor', controller: null, cityPolity: null });
});

test('theme compatibility is enforced and tampering invalidates canonical polity facts', () => {
  const human = generatedHumanWorld('city-polity-integrity');
  const madcap = CityPolities.attachCityPolities('city-polity-integrity', 'madcap', human);
  const grim = CityPolities.attachCityPolities('city-polity-integrity', 'grim', human);
  expect(new Set(madcap.cityPolities.polities.map((polity) => polity.themeContent.sourceTheme))).toEqual(new Set(['madcap']));
  expect(new Set(grim.cityPolities.polities.map((polity) => polity.themeContent.sourceTheme))).toEqual(new Set(['grim']));

  const changed = JSON.parse(JSON.stringify(madcap));
  changed.cityPolities.polities[0].publicMotto = 'Tampered';
  changed.digest = StrategicWorld.strategicMapDigest(changed);
  expect(() => CityPolities.validateCityPolities(changed)).toThrow(/digest/i);
});
