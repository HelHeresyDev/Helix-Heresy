const { source } = require('./sustenance-source'), { source: bodies } = require('./regional-foodweb-source');
function windSource({ wind = { x: .5, y: 0 }, preyX = 100, members = 1, cohorts = 1 } = {}) {
  const src = source({ species: 'carrion-lantern', members, cohorts, count: 0 });
  src.spatialContinuity = true; src.groups[0].windDriven = true; src.regions[0].wind = wind;
  const prey = bodies([['gravebloom-elk', preyX, 1]]).groups[0];
  prey.id = 'actual-prey'; prey.populationId = 'actual-prey-population'; prey.cohorts[0].id = 'actual-prey-body';
  src.groups.push(prey); return src;
}
module.exports = { windSource };
