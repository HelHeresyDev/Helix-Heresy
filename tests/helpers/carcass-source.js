const W = require('../../background-wildlife'), { source: basic } = require('./regional-foodweb-source');
function source({ animals = false, areaHa = 100, scale = 100, wind = { x: 0, y: 0 } } = {}) {
  const raw = basic(animals ? [['carrion-lantern', 0, 1]] : []), r = raw.regions[0]; raw.spatialContinuity = true;
  r.areaHa = areaHa; r.depthM = 0; r.wind = wind;
  r.stocks = { forageKg: 1e7 * scale, organicKg: 1e7 * scale, waterL: 1e8 * scale, mineralsKg: 1e7, detritusKg: 0, meatKg: 0 };
  r.capacity = { ...r.stocks, detritusKg: 1e12 };
  const renewal = { forageKg: 1e5 * scale, organicKg: 1e5 * scale, waterL: 1e5 * scale };
  r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20, humidity: 70, renewal }));
  if (animals) { raw.groups[0].windDriven = true; raw.groups[0].resources.foodKg = 'carrionKg'; }
  W.apply(raw, W.allocate(raw, 'actual-local-carcasses', { distributed: true, carcassBatches: true }));
  return raw;
}
module.exports = { source };
