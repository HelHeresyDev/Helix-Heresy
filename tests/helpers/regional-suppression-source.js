const Ecology = require('../../strategic-beast-ecology');
const World = require('../../strategic-world');
const Suppression = require('../../regional-suppression');
const cell = World.cellId;
function fixture(count = 10, farKm = 16, speciesId = Suppression.SPECIES, options = {}) {
  const route = { id: 'corridor:ab', corridorId: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 2, supportCapable: true, continuity: 'continuous', cellPath: [cell(1), cell(2), cell(3)] };
  const mask = Buffer.from([options.crossingOnly ? 4 : 20]).toString('base64');
  const map = { humanGeography: { cities: [{ id: 'a', name: 'Aster', cellId: cell(1) }, { id: 'b', name: 'Birch', cellId: cell(3) }] },
    routeGraph: { routes: [{ id: 'ab', endpointIds: ['a', 'b'], cellPath: route.cellPath }] },
    beastEcology: { species: Ecology.BEAST_SPECIES, populations: [{ id: 'SECRET_POPULATION', speciesId, devotionalUnitCount: count,
      populationIndex: 600, territory: { rangeMask: mask, rangeCellCount: options.crossingOnly ? 1 : 2 } }], waveProfiles: [{ id: 'SECRET_PROFILE', populationId: 'SECRET_POPULATION',
      cellPath: [cell(4), cell(2), cell(1)], distanceKm: farKm + 1, threatenedCityIds: ['a'], threatenedCorridorIds: ['ab'], severityBand: 'dangerous' }] },
    publicBeastAtlas: { waveWarnings: [{ id: 'beast-wave-warning:0001', speciesId: 'beast:rimefang-pack', threatenedCityIds: ['a'], threatenedCorridorIds: ['ab'],
      severityBand: 'dangerous', confidence: 'moderate', warningSigns: ['Frost trails on the approach'], reportedCause: 'Reported prey pressure', recurrenceBand: 'intermittent' }] } };
  if (speciesId === Suppression.ELK) { map.beastEcology.waveProfiles = []; map.publicBeastAtlas.waveWarnings = []; }
  const links = { [cell(1)]: [cell(2)], [cell(2)]: [cell(1), cell(3), cell(4)], [cell(3)]: [cell(2)], [cell(4)]: [cell(2)] };
  const geometry = { cellCount: 5, land: id => Boolean(links[id]), neighbors: id => links[id] || [], distance: (a, b) => a === cell(4) || b === cell(4) ? farKm : 1 };
  const source = Suppression.sourceFromWorld(map, route, 'a', geometry)[0];
  if (!source) throw new Error('Population-backed ground source rejected');
  return { map, route, source, geometry };
}
module.exports = { fixture };
