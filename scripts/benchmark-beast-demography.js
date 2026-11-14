// Focused model benchmark: finite prepared supplies, not a generated-world balance certificate.
const P = require('../beast-populations'), D = require('../creature-biology');
function source(n = 1000, speciesId = 'beast:storm-kite', groups = 1) {
  const p = D.lifecycle[speciesId];
  const stocks = { foodKg: n * Math.max(1, p.foodKgDay) * 1000, waterL: n * Math.max(1, p.waterLDay) * 1000,
    mineralsKg: n * Math.max(1, p.mineralsKgDay) * 1000, chargeMJ: n * 1000, heatMJ: n * 1000, excessMana: n * 1000 };
  return { id: 'prepared-demographic-source', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: [{ id: 'habitat', areaHa: n * p.territoryHa, stocks, capacity: { ...stocks },
      renewalPerDay: Object.fromEntries(Object.keys(stocks).map(k => [k, stocks[k] / 10])), edges: [],
      nurseries: [{ id: 'original-nursery', speciesId, capacity: n * 100, habitatSuitable: true, mateAccess: true, phases: [0, 1, 2, 3] }] }],
    groups: Array.from({ length: groups }, (_, i) => {
      const bodies = Math.floor(n / groups) + (i < n % groups ? 1 : 0), females = Math.floor(bodies / 2);
      return { id: `group-${i}`, speciesId, populationId: 'original-population', regionId: 'habitat', breeding: { siteId: 'original-nursery' },
        cohorts: [['female', females], ['male', bodies - females]].filter(([, count]) => count).map(([role, count]) =>
          ({ id: `original-${i}-${role}`, speciesId, role, count, ageDays: Math.max(p.adultDays, p.fertileDays || 0), massKg: p.adultKg })) };
    }) };
}
function run(n, groups = 1, days = 120) {
  const began = performance.now(), s = P.create(source(n, 'beast:storm-kite', groups), { worldId: 'benchmark', runId: 'run' });
  P.advance(s, days * P.DAY, true, true); P.audit(s);
  return { initialBodies: n, groups, days, milliseconds: Math.round((performance.now() - began) * 10) / 10,
    cohorts: s.groups.reduce((n, g) => n + g.cohorts.length, 0), origins: Object.keys(s.origins).length,
    birthRecords: s.births.length, deathRecords: s.losses.length + s.lossBatches.length,
    rangeRecords: s.groups.reduce((n, g) => n + g.cohorts.reduce((v, c) => v + c.ranges.length, 0), 0),
    ...s.work, serializedBytes: JSON.stringify(s).length, population: P.audit(s)['original-population'] };
}
if (require.main === module) for (const [n, groups] of [[1000, 1], [100000, 1], [1000000, 1], [1000000, 10]])
  console.log(JSON.stringify(run(n, groups)));
if (require.main === module && process.argv.includes('--long')) console.log(JSON.stringify(run(1000, 1, 2400)));
module.exports = { source, run };
