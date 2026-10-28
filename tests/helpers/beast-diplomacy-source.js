const D = require('../../beast-diplomacy');
const R = require('../../regional-encounters');
const E = require('../../strategic-beast-ecology');
const W = require('../../strategic-world');
const P = require('../../mirror-ape-populations');
function sourceFixture(routeId = 'walk:a', distanceKm = .25, count = 5) {
  const route = { id: 'corridor:ab', corridorId: 'ab', distanceKm };
  const map = { humanGeography: { cities: [{ id: 'a', name: 'Aster', cellId: W.cellId(1) }, { id: 'b', name: 'Birch', cellId: W.cellId(3) }] },
    routeGraph: { routes: [{ id: 'ab', endpointIds: ['a', 'b'], cellPath: [1, 2, 3].map(W.cellId) }] },
    beastEcology: { species: E.BEAST_SPECIES, populations: [{ id: 'SECRET_APE_POPULATION', speciesId: D.SPECIES,
      devotionalUnitCount: count, populationIndex: 500, territory: { rangeMask: Buffer.from([4]).toString('base64') } }] } };
  const geometry = { distance: () => 1, land: () => true }, source = D.sources(map, route, 'a', geometry, routeId)[0];
  if (!source) throw new Error('Original habitat crossing was not supported');
  // Fix original source/personality inputs before allocation; never reroll an existing person.
  let seed;
  for (let i = 0; i < 100; i++) {
    const b = { worldId: 'world', runId: 'run' }, s = D.create(b), r = R.create(b);
    D.register(s, source, r, [], `mirror-${i}`, 0);
    if (new Set(r.beasts.actors.map(a => a.dialoguePolicy)).size === 2) { seed = `mirror-${i}`; break; }
  }
  return { source, route, map, geometry, seed, habitat: P.habitat(map, source, geometry) };
}
module.exports = { sourceFixture };
