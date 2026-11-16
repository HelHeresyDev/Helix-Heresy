const Care = require('../../beast-parental-care'), D = require('../../creature-biology');
const { source: original } = require('./regional-foodweb-source');
const { source: sustenance } = require('./sustenance-source');
const copy = x => JSON.parse(JSON.stringify(x));
function familySource({ species = 'rimefang-pack', children = 2, parents = 2, food = 1e6 } = {}) {
  const src = original([[species, 0, parents]]), g = src.groups[0], p = D.lifecycle[g.speciesId];
  src.spatialContinuity = true; g.parentalCare = Care.mode(g.speciesId);
  g.resources.foodKg = species === 'rimefang-pack' ? 'meatKg' : 'forageKg';
  g.cohorts[0].role = 'female';
  g.cohorts.push({ id: 'actual-young', speciesId: g.speciesId, count: children, ageDays: 0, massKg: p.newbornKg, role: 'juvenile' });
  src.regions[0].stocks[g.resources.foodKg] = food; src.regions[0].capacity[g.resources.foodKg] = food;
  return src;
}
function travelSource() {
  const src = sustenance({ members: 1, cohorts: 1, count: 1000000 }); src.spatialContinuity = true;
  const r = src.regions[0]; r.areaHa = 1e6;
  Object.assign(r.wildlife.pools[0], { sizeClass: 'small', areaHa: Math.PI * 2000 ** 2 / 10000,
    spatial: { eastM: 6250, northM: 0, radiusM: 2000, depthTopM: 0 } });
  const away = copy(r); away.id = 'away'; away.wildlife.pools[0].id = 'destination-prey'; src.regions.push(away);
  const point = (regionId, eastM) => ({ regionId, eastM, northM: 0, altitudeM: 0 });
  const edge = (from, to, direction) => ({ id: to, distanceKm: 100, traversable: true,
    departurePosition: point(from, 0), arrivalPosition: point(to, 0),
    routeFrames: { exit: point(from, direction * 50000), entry: point(to, -direction * 50000) } });
  r.edges = [edge(r.id, away.id, 1)]; away.edges = [edge(away.id, r.id, -1)]; return src;
}
module.exports = { familySource, travelSource };
