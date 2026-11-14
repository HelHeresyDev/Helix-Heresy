// A finite prepared maintenance workface, not a whole-world ecology certificate.
const P = require('../beast-populations'), D = require('../creature-biology');
const E = require('../beast-regional-ecology');
const vector = n => Object.fromEntries(E.channels.map(k => [k, n]));
function source(multiplier = 1) {
  const natural = { ...vector(0), freshwaterQuantity: 3, freshwaterQuality: 1, wetlandReefHabitat: .5, renewableBiomass: 20 };
  function region(id, reserve = false) {
    const stocks = { forageKg: 200000 * multiplier, organicKg: 1000000 * multiplier,
      waterL: 2000000 * multiplier, mineralsKg: 2000000 * multiplier, chargeMJ: 100000 * multiplier,
      excessMana: 100000 * multiplier, rootBedKg: multiplier, watershedHabitatKg: 100000 * multiplier };
    const renewal = { forageKg: 800 * multiplier, organicKg: 1000 * multiplier, waterL: 20000 * multiplier,
      chargeMJ: 100 * multiplier, excessMana: 80 * multiplier };
    return { id, areaHa: 10 * multiplier, stocks, capacity: { ...stocks }, renewalPerDay: renewal,
      edges: [{ id: reserve ? 'field' : 'reserve', distanceKm: 2, traversable: true }], condition: vector(80),
      seasons: [1, .75, 1, .9].map(factor => ({ renewal: { ...renewal, forageKg: renewal.forageKg * factor } })),
      ecology: { referenceCondition: vector(80), viabilityFloors: { soilCover: 30 }, naturalRenewalEP: Object.fromEntries(Object.entries(natural).map(([k, n]) => [k, n * multiplier])),
        renewalDependencies: { forageKg: ['soilCover', 'renewableBiomass'], waterL: ['freshwaterQuantity', 'freshwaterQuality'] },
        workSites: [{ id: `${id}-root-bed`, action: 'rootStabilize', speciesId: 'beast:ironroot-colossus', areaHa: 10 * multiplier,
          maxWorkers: multiplier, rootable: true, substrateKey: 'rootBedKg', minSubstrateKg: multiplier, vitrifiedKg: 0 }],
        renewalSites: [{ id: `${id}-watershed`, materials: { watershedHabitatKg: 100000 * multiplier },
          renewalShares: { waterL: 1 }, ledgerShares: { freshwaterQuantity: 1, freshwaterQuality: 1, wetlandReefHabitat: 1, renewableBiomass: 1 } }] } };
  }
  const group = (id, speciesId, regionId, n, action) => ({ id, speciesId, populationId: id, regionId,
    resources: { foodKg: action === 'graze' ? 'forageKg' : 'organicKg' },
    ecology: { regionId: 'field', action, siteId: 'field-root-bed', effortFraction: 1 },
    cohorts: [{ id: `${id}-originals`, speciesId, count: n, ageDays: D.lifecycle[speciesId].adultDays, massKg: D.lifecycle[speciesId].adultKg }] });
  return { id: 'prepared-regional-maintenance-source', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: [region('field'), region('reserve', true)], groups: [
      group('root', 'beast:ironroot-colossus', 'field', multiplier, 'rootStabilize'),
      group('herd', 'beast:thunderback-grazer', 'field', multiplier * 10, 'graze'),
      group('returning-root', 'beast:ironroot-colossus', 'reserve', multiplier, 'rootStabilize') ] };
}
function run(multiplier = 1, days = 120) {
  const start = performance.now(), s = P.create(source(multiplier), { worldId: 'benchmark', runId: 'regional-run' });
  P.advance(s, days * P.DAY, true, true); P.audit(s);
  return { initialBodies: multiplier * 12, days, milliseconds: Math.round((performance.now() - start) * 10) / 10,
    ...s.work, cohorts: s.groups.reduce((n, g) => n + g.cohorts.length, 0),
    sourceLossRecords: s.regions.reduce((n, r) => n + r.ecologicalAccount.sourceLosses.length, 0),
    serializedBytes: JSON.stringify(s).length, exhausted: s.regions[0].exhausted };
}
if (require.main === module) for (const n of [1, 1000, 100000]) console.log(JSON.stringify(run(n)));
module.exports = { vector, source, run };
