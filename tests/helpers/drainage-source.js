// Explicit finite hydraulics for focused controls, not a generated ecology.
const { vector } = require('./regional-work-source');
const DAY = 86400;
function source({ areaHa = 1, rain = 12000, outlet = 8000, safeDepthMm = 0, middle = false, river = 0 } = {}) {
  const region = id => ({ id, areaHa, kind: 'wetland', depthM: 1, floor: true, oxygen: true,
    stocks: { waterL: areaHa * 1e7, flowWaterL: river * 10 }, capacity: { waterL: areaHa * 1e7, flowWaterL: river * 10 },
    renewalPerDay: {}, condition: vector(80), edges: [],
    ecology: { referenceCondition: vector(80), viabilityFloors: { soilCover: 30 }, naturalRenewalEP: vector(0),
      renewalDependencies: {}, workSites: [], renewalSites: [], floodable: true,
      floodplain: { areaHa, safeDepthMm, erosionPointsPerMm: .01 } } });
  const upstream = region('upstream'), sink = region('sink'); upstream.renewalPerDay.waterL = rain;
  sink.kind = 'waterColumn'; sink.ecology.floodable = false; delete sink.ecology.floodplain;
  sink.stocks.waterL = sink.capacity.waterL = 0;
  const regions = middle ? [upstream, region('middle'), sink] : [upstream, sink];
  if (outlet != null) for (let i = 0; i < regions.length - 1; i++) {
    const r = regions[i], next = regions[i + 1]; r.edges.push({ id: next.id, distanceKm: 1, traversable: true });
    const discharge = i === 0 ? outlet : outlet * 2;
    r.ecology.watercourses = [{ id: `original-outlet:${r.id}`, sourceKey: 'flowWaterL', flowPerDay: i === 0 ? river : 0,
      downstreamRegionId: next.id, outlet: { widthM: .1, depthM: .1, velocityMps: discharge / (1000 * .1 * .1 * DAY), grade: 0 } }];
  }
  return { id: 'prepared-drainage-source', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] }, regions, groups: [] };
}
module.exports = { source };
