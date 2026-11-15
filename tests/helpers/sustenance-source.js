const W = require('../../background-wildlife'), D = require('../../creature-biology');
const { source: original } = require('./regional-foodweb-source');
function source({ guild = 'smallAnimals', count = 10000, species = 'rimefang-pack', members = 6, areaHa = 1000, cohorts = 2, juvenile = false } = {}) {
  const src = original([[species, 0, members]]), r = src.regions[0], g = src.groups[0], p = D.lifecycle[g.speciesId];
  r.areaHa = areaHa; r.stocks = { forageKg: 1e8, organicKg: 1e8, planktonKg: 1e8, waterL: 1e8,
    mineralsKg: 1e8, meatKg: 0, carrionKg: 0, detritusKg: 0, excessMana: 1e8, chargeMJ: 1e8 };
  g.resources.foodKg = species === 'carrion-lantern' ? 'carrionKg' : 'meatKg';
  r.capacity = { ...r.stocks, detritusKg: 1e9 }; r.renewalPerDay = {};
  r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 15, renewal: {} }));
  if (guild === 'fish') { r.kind = 'waterColumn'; r.floor = false; r.depthM = 100; r.stocks.seawaterL = r.capacity.seawaterL = areaHa * 10000 * 100 * 1000; }
  const c = g.cohorts[0]; g.cohorts = Array.from({ length: cohorts }, (_, i) => ({ ...c, id: `original-forager-${i}`,
    count: Math.floor(members / cohorts) + (i < members % cohorts ? 1 : 0), ...(juvenile ? { ageDays: Math.max(p.independentDays, p.adultDays / 2), massKg: p.adultKg / 3, role: 'juvenile' } : {}) })).filter(c => c.count);
  const foodKey = guild === 'fish' ? 'planktonKg' : guild === 'insects' ? 'organicKg' : 'forageKg';
  W.apply(src, { allocations: [{ regionId: r.id, pools: [{ id: `original-prey:${guild}`, guild, foodKey, areaHa,
    habitatDepthM: guild === 'fish' ? 100 : 0, originalCount: count, originalMassKg: count * W.profiles[guild].adultKg, capacityCount: Math.floor(count * 1.5) }] }] });
  return src;
}
module.exports = { source };
