const Ecology = require('../../strategic-beast-ecology');
const World = require('../../strategic-world');
const Suppression = require('../../regional-suppression');
const cell = World.cellId;
function fixture(count = 10, farKm = 16) {
  const route = { id: 'corridor:ab', corridorId: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 2, supportCapable: true, continuity: 'continuous', cellPath: [cell(1), cell(2), cell(3)] };
  const mask = Buffer.from([20]).toString('base64');
  const map = { humanGeography: { cities: [{ id: 'a', name: 'Aster', cellId: cell(1) }, { id: 'b', name: 'Birch', cellId: cell(3) }] },
    routeGraph: { routes: [{ id: 'ab', endpointIds: ['a', 'b'], cellPath: route.cellPath }] },
    beastEcology: { species: Ecology.BEAST_SPECIES, populations: [{ id: 'SECRET_POPULATION', speciesId: 'beast:rimefang-pack', devotionalUnitCount: count,
      populationIndex: 600, territory: { rangeMask: mask, rangeCellCount: 2 } }], waveProfiles: [{ id: 'SECRET_PROFILE', populationId: 'SECRET_POPULATION',
      cellPath: [cell(4), cell(2), cell(1)], distanceKm: farKm + 1, threatenedCityIds: ['a'], threatenedCorridorIds: ['ab'], severityBand: 'dangerous' }] },
    publicBeastAtlas: { waveWarnings: [{ id: 'beast-wave-warning:0001', speciesId: 'beast:rimefang-pack', threatenedCityIds: ['a'], threatenedCorridorIds: ['ab'],
      severityBand: 'dangerous', confidence: 'moderate', warningSigns: ['Frost trails on the approach'], reportedCause: 'Reported prey pressure', recurrenceBand: 'intermittent' }] } };
  const links = { [cell(1)]: [cell(2)], [cell(2)]: [cell(1), cell(3), cell(4)], [cell(3)]: [cell(2)], [cell(4)]: [cell(2)] };
  const geometry = { cellCount: 5, land: id => Boolean(links[id]), neighbors: id => links[id] || [], distance: (a, b) => a === cell(4) || b === cell(4) ? farKm : 1 };
  const source = Suppression.sourceFromWorld(map, route, 'a', geometry)[0];
  if (!source) throw new Error('Population-backed ground source rejected');
  return { map, route, source, geometry };
}
module.exports = { fixture };
