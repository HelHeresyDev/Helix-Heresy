const Library = require('../../world-run-library');
const World = require('../../strategic-world');
let cached;

// Lifecycle tests need physical site context and a saved site catalog, not the
// unrelated full historical simulation. Use a validated legacy physical world
// with an authored public-only catalog. No generator or validator is mocked.
function lifecycleWorld() {
  if (cached) return cached;
  const base = Library.createWorld({ id: 'lifecycle-world', worldSeed: 'lifecycle-world', worldTheme: 'madcap',
    generationVersion: 6, createdAt: 'test', creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = base.generatedData.strategicMap;
  const cell = World.cellSnapshot(map, map.surface.classes.indexOf('L'));
  const candidates = Array.from({ length: 15 }, (_, index) => ({
    id: `lifecycle-site-${index}`, name: `Saved Parcel ${index + 1}`, scenarioId: 'chemistryFront',
    requiredBlueprintId: 'chemistry-front-site-v3', strategicCellId: cell.id,
    distanceBand: 'cityDistrict', distanceBandLabel: 'Inside city walls',
    environment: { biome: 'Temperate woodland' },
    nearestSettlement: { cityId: 'test-city', name: 'Test City', assetId: 'test-city', kind: 'city' },
    distance: { straightLineKm: 1, practicalTravelKm: 1 },
    approximatePosition: { bearingLabel: 'north', distanceBand: 'nearby' },
    access: { kind: 'cityStreet', supportCapable: true, routeContinuity: 'municipal' },
    jurisdiction: { kind: 'exclusiveCityJurisdiction', governingCityId: 'test-city', legalReferenceCityId: 'test-city' },
    publicLaw: { label: 'Published laboratory regulation', relevantRules: [] },
    publicEnforcement: { declaredPriorityBand: 'moderate' },
    publicUtilities: { availabilityBand: 'high' },
    tradeoffs: { landAvailability: 'moderate', legalCover: 'moderate', secrecy: 'moderate', authorityExposure: 'high', beastDanger: 'low' },
    tradeoffSummary: 'Authored public parcel for focused lifecycle testing.', sourceFacts: {},
    reusableAcrossIndependentRuns: true, existingLaboratoryOccupancyTracked: false
  }));
  const record = { knowledgePolicy: 'publicObservedStrategicTradeoffsOnly', generatedFromWorldSeed: true,
    runSeedsIgnored: true, oldLaboratoriesPersistInWorld: false,
    scenarioRows: [{ scenarioId: 'chemistryFront', requiredBlueprintId: 'chemistry-front-site-v3', allowedDistanceBands: ['cityDistrict'], candidates }] };
  record.digest = `strategic-starting-sites-${World.stableHash(record)}`;
  map.strategicStartingSites = record;
  map.publicStartingSiteDirectory = JSON.parse(JSON.stringify(record));
  cached = Library.createWorld({ ...base, generatedData: { ...base.generatedData, strategicMap: World.finalizeStrategicMap(map) } });
  return cached;
}

module.exports = { lifecycleWorld };
