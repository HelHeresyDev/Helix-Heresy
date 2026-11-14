// Explicit finite originals for adapter checks, not generated habitat acceptance.
const Data = require('../../creature-biology'), Work = require('../../beast-regional-work');
const channels = Data.ledgers.map(([id]) => id), vector = n => Object.fromEntries(channels.map(k => [k, n]));
function source(action, count = 1) {
  const speciesId = Work.actions[action], p = Data.lifecycle[speciesId];
  const stocks = { forageKg: 1e6, organicKg: 1e6, meatKg: 1e6, detritusKg: 1e6, waterL: 1e10,
    mineralsKg: 1e6, calciumKg: 1000, seawaterL: 1e12, wetlandBedKg: 100, livingReefKg: 100,
    bloomKg: 100, constructionKg: 1000, flowWaterL: 10000, carrionKg: 100, metalKg: 1, fuelKg: 1,
    atmosphericWaterL: 1e5, excessMana: 10000, rootBedKg: 1, planktonKg: 1e6 };
  const region = id => ({ id, areaHa: 100, stocks: { ...stocks },
    capacity: { ...stocks, waterL: 1.1e10, livingReefKg: 1000, bloomKg: 1000 }, renewalPerDay: {},
    edges: [{ id: id === 'workface' ? 'downstream' : 'workface', distanceKm: 2, traversable: true }],
    condition: vector(80), ecology: { referenceCondition: vector(80), viabilityFloors: { soilCover: 30 },
      naturalRenewalEP: vector(0), renewalDependencies: {}, workSites: [], renewalSites: [] } });
  const regions = [region('workface'), region('downstream')];
  const site = { id: 'original-work-site', action, speciesId, areaHa: 100, maxWorkers: count };
  if (action === 'rootStabilize') Object.assign(site, { rootable: true, substrateKey: 'rootBedKg', minSubstrateKg: 1, vitrifiedKg: 0 });
  if (['tendWetland', 'cultivateReef', 'filterPlankton', 'buildDam'].includes(action)) site.water = {
    stockKey: ['cultivateReef', 'filterPlankton'].includes(action) ? 'seawaterL' : 'waterL', areaM2: 100000,
    minDepthM: ({ tendWetland: 1.5, cultivateReef: 4, filterPlankton: 20, buildDam: 3 })[action] };
  if (action === 'buildDam') {
    Object.assign(site, { watercourseId: 'original-river', damKg: 0, maxDamKg: 1000, retentionLPerKgDay: 10 });
    regions[0].ecology.watercourses = [{ id: 'original-river', sourceKey: 'flowWaterL', flowPerDay: 3000, downstreamRegionId: 'downstream' }];
  }
  if (action === 'buildFurnace') Object.assign(site, { colonyId: 'original-colony', oxygen: true, waterDepthM: 0, furnaceKg: 0, maxFurnaceKg: 1 });
  if (['growBlooms', 'dreamWeather'].includes(action)) site.phases = [0, 1, 2, 3];
  if (action === 'filterMana') site.medium = 'air';
  const group = { id: 'worker', speciesId, populationId: 'original-population', regionId: 'workface',
    resources: { foodKg: Work.diets[action][0] }, ecology: { action, siteId: site.id, regionId: 'workface', effortFraction: 1 },
    cohorts: [{ id: 'original-workers', speciesId, count, ageDays: p.adultDays, massKg: p.adultKg,
      ...(action === 'buildFurnace' ? { role: 'worker', colonyId: 'original-colony' } : {}),
      ...(action === 'filterPlankton' ? { feedingTowers: [100, 100, 100, 100] } : {}) }] };
  const groups = [group];
  if (action === 'dreamWeather') {
    site.participantGroupIds = ['original-sleepers']; group.activityState = { sleeping: true, dreamConsent: true };
    const sleeper = 'beast:mire-choir';
    groups.push({ id: 'original-sleepers', populationId: 'original-sleepers', speciesId: sleeper, regionId: 'workface',
      resources: { foodKg: 'forageKg' }, activityState: { sleeping: true, dreamConsent: true },
      cohorts: [{ id: 'original-sleeper-body', speciesId: sleeper, count: 1, ageDays: Data.lifecycle[sleeper].adultDays, massKg: Data.lifecycle[sleeper].adultKg }] });
  }
  regions[0].ecology.workSites.push(site);
  return { id: `prepared-${action}`, calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] }, regions, groups };
}
module.exports = { source, vector };
