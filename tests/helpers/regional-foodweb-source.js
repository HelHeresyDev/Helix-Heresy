const D = require('../../creature-biology');
function source(rows = [['glasswing-roc', 0, 2], ['storm-kite', 3, 4]]) {
  const stocks = { waterL: 1e9, mineralsKg: 1e9, forageKg: 1e9, organicKg: 1e9, detritusKg: 0, meatKg: 0, excessMana: 1e9, chargeMJ: 1e9 };
  return { id: 'physical-food-web', regionalFoodWeb: true, calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: [{ id: 'ground', areaHa: 100, kind: 'surface', floor: true, oxygen: true, densityKgM3: 1600,
      stocks, capacity: { ...stocks, detritusKg: 1e9 }, renewalPerDay: {}, edges: [] }],
    groups: rows.map(([suffix, x, n = 1], i) => {
      const speciesId = `beast:${suffix}`, p = D.lifecycle[speciesId];
      return { id: `group-${i}`, populationId: `population-${i}`, speciesId, regionId: 'ground',
        home: { patchId: 'ground', cellId: 'cell', eastKm: x / 1000, northKm: 0, depthM: 0 },
        resources: { foodKg: suffix === 'glasswing-roc' || suffix === 'rimefang-pack' || suffix === 'carrion-lantern' ? 'meatKg' : 'forageKg' },
        cohorts: [{ id: `original-${i}`, speciesId, count: n, massKg: p.adultKg, ageDays: p.adultDays, role: 'individual' }] };
    }) };
}
module.exports = { source };
