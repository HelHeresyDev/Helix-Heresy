const Ecology = require('../../strategic-beast-ecology');
function fixture() {
  const species = Ecology.BEAST_SPECIES.find(s => s.id === 'beast:rimefang-pack');
  const map = { humanGeography: { cities: [{ id: 'a', name: 'Aster' }] }, routeGraph: { routes: [{ id: 'corridor:a:b', endpointIds: ['a', 'b'], label: 'Aster–Birch support' }] },
    beastEcology: { species: [species], populations: [{ id: 'SECRET_POPULATION', speciesId: species.id, populationIndex: 600,
      lairCellId: 'SECRET_LAIR', territory: { rangeCellCount: 20, rangeMask: 'SECRET_RANGE' } }],
    waveProfiles: [{ id: 'SECRET_PROFILE', populationId: 'SECRET_POPULATION', threatenedCityIds: ['a'], cellPath: ['planet-cell:00001', 'planet-cell:00002'], distanceKm: 20, severityBand: 'dangerous' }] },
    publicBeastAtlas: { waveWarnings: [{ id: 'beast-wave-warning:0001', speciesId: species.id, threatenedCityIds: ['a'], threatenedCorridorIds: ['corridor:a:b'], severityBand: 'dangerous',
      confidence: 'moderate', reportedCause: 'Reported prey pressure', recurrenceBand: 'intermittent', warningSigns: ['Displaced prey near city approaches'], reportedApproachMask: 'SECRET_BROAD_MASK' }] } };
  const office = { id: 'office:a', institutionId: 'registry:a', cityId: 'a', active: true, channelPowered: true, maintenanceReady: true, power: 5, workSeconds: 1000, availableAt: 0,
    clerk: { id: 'original-clerk', name: 'Mira', locationId: 'office:a', status: 'alive', health: 100, fatigue: 0 } };
  const ctx = { alive: true, capable: true, atCounter: true, clerkPresent: true, lineOfSight: true, visitPermission: true, serviceAvailable: true,
    cityId: 'a', placeId: 'survey:a', bodyEpoch: 0, busy: false };
  return { map, office, ctx };
}
module.exports = { fixture };
