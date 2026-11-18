// Focused generated geography/flux control, never a reduced-roster ecology pass.
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
const Flood = require('../beast-regional-flood');
function run({ world, days = 120, baseline } = {}) {
  const start = performance.now();
  world ||= L.createWorld({ id: 'wetland-drainage-control', worldSeed: 'source-small', createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, source = S.expand(record, map);
  if (baseline && (baseline.account.sourceId !== baseline.world.generatedData.strategicMap.beastHabitatSources.id
    || baseline.world.generatedData.strategicMap.beastHabitatSources.sourceDigest !== record.sourceDigest))
    throw Error('Baseline must belong to the same original geography and biology');
  const historicalFailures = baseline?.account.regions.filter(r => r.ecologicalAccount?.viabilityHistory?.maintenanceFailures?.soilCover) || [];
  if (historicalFailures.some(r => r.kind !== 'wetland' || !source.regions.some(n => n.id === r.id)))
    throw Error('Baseline includes a soil deficit outside the compared wetland accounts');
  const originals = source.groups.reduce((n, g) => n + g.cohorts.reduce((n, c) => n + c.count, 0), 0);
  // Isolate water and existing structures, not the full ecosystem. No canonical
  // group, original body, source record or reusable world is edited by this copy.
  source.id += ':hydrology-only'; source.groups = []; source.regionalFoodWeb = false;
  for (const r of source.regions) delete r.wildlife;
  const s = P.createDiagnostic(source, { worldId: world.id, runId: 'private-hydrology-control' });
  const inventory = () => s.regions.reduce((n, r) => n + (r.stocks.waterL || 0) + (r.stocks.flowWaterL || 0) + (r.flood?.waterL || 0)
    + (r.outputs?.waterLOverflow || 0) + (r.outputs?.flowWaterLOverflow || 0) + (r.outputs?.unusableWaterL || 0), 0);
  const originalL = inventory(); let suppliedL = 0;
  for (let day = 1; day <= days; day++) {
    const phase = P.monthAt(s.calendar, (day - 1) * P.DAY).season;
    suppliedL += s.regions.reduce((n, r) => n + (r.seasons[phase].renewal.waterL || 0) + (r.seasons[phase].renewal.flowWaterL || 0), 0);
    P.advance(s, day * P.DAY, true, true);
    if ((day % 10 === 0 || day === days) && !P.normalize(s)) throw Error(`Generated drainage cannot normalize at day ${day}`);
  }
  const accountedL = inventory(), errorL = accountedL - originalL - suppliedL;
  if (Math.abs(errorL) > Math.max(.01, (originalL + suppliedL) * 1e-10)) throw Error('Generated drainage water conservation failed');
  const wetlands = s.regions.filter(r => r.ecology.floodable);
  const wetlandRecords = wetlands.map(r => {
    const sized = record.physicalBinding.catchmentDrainage?.find(row => row.regionId === r.id), old = baseline?.account.regions.find(row => row.id === r.id);
    const priorFailure = old?.ecologicalAccount.viabilityHistory.maintenanceFailures.soilCover;
    return { regionId: r.id, areaHa: r.areaHa, outletWidthM: r.ecology.watercourses?.[0]?.outlet?.widthM ?? null,
      outletCapacityLDay: Flood.capacity(r.ecology.watercourses?.[0]), ...(sized ? { catchment: sized } : {}),
      finalFloodGrowthLDay: s.rates[r.id].drainage.floodNetLDay, endingFloodWaterL: r.flood.waterL,
      erosionEP: r.flood.erosionEP, soilNaturalEP: r.ecologicalAccount.natural.soilCover,
      soilMaintenanceDeficit: Boolean(r.ecologicalAccount.viabilityHistory.maintenanceFailures.soilCover),
      minimumSoilCover: r.ecologicalAccount.viabilityHistory.minimumCondition.soilCover,
      ...(priorFailure ? { historicalFullFoodWeb: { sourceId: baseline.account.sourceId,
        soilNaturalEP: old.ecologicalAccount.natural.soilCover, soilNurturingEP: old.ecologicalAccount.nurturing.soilCover,
        soilDestructionEP: old.ecologicalAccount.destruction.soilCover, floodErosionEP: old.flood.erosionEP,
        nonFloodSoilDestructionEP: old.ecologicalAccount.destruction.soilCover - old.flood.erosionEP,
        soilBalanceWithoutRecordedFloodEP: old.ecologicalAccount.natural.soilCover + old.ecologicalAccount.nurturing.soilCover
          - (old.ecologicalAccount.destruction.soilCover - old.flood.erosionEP),
        outletCapacityLDay: Flood.capacity(old.ecology.watercourses?.[0]),
        minimumSoilCover: old.ecologicalAccount.viabilityHistory.minimumCondition.soilCover } } : {}) };
  });
  return { scope: 'Hydrology-only diagnostic; no animal/wildlife consumption or ongoing nurturing; not food-web viability or source adoption',
    sourceId: record.id, seed: world.worldSeed, days, regions: s.regions.length, wetlands: wetlands.length, excludedOriginalStrategicBodies: originals,
    actualOutlets: wetlands.filter(r => r.ecology.watercourses?.[0]?.outlet).length,
    noRecordedOutlet: wetlands.filter(r => !r.ecology.watercourses?.[0]?.outlet).length,
    floodedWetlands: wetlands.filter(r => r.flood.waterL > 1e-6).length,
    erodedWetlands: wetlands.filter(r => r.flood.erosionEP > 1e-8).length,
    soilMaintenanceDeficits: wetlandRecords.filter(r => r.soilMaintenanceDeficit).length,
    unsupportedCatchments: record.physicalBinding.issues.filter(i => i.kind === 'unsupportedCatchmentDrainage'),
    soilFloorBreaches: wetlands.filter(r => r.ecologicalAccount.viabilityHistory.floorBreaches.soilCover).length,
    breachedWetlands: wetlands.filter(r => r.ecologicalAccount.viabilityHistory.floorBreaches.soilCover).map(r => ({
      regionId: r.id, areaHa: r.areaHa, outletCapacityLDay: Flood.capacity(r.ecology.watercourses?.[0]),
      endingFloodWaterL: r.flood.waterL, minimumSoilCover: r.ecologicalAccount.viabilityHistory.minimumCondition.soilCover,
      erosionEP: r.flood.erosionEP, finalFloodGrowthLDay: s.rates[r.id].drainage.floodNetLDay })),
    minimumSoilCover: Math.min(...wetlands.map(r => r.ecologicalAccount.viabilityHistory.minimumCondition.soilCover)),
    minimumSoilCoverWithFloor: Math.min(...wetlands.filter(r => r.ecology.viabilityFloors.soilCover > 0)
      .map(r => r.ecologicalAccount.viabilityHistory.minimumCondition.soilCover)),
    standingFloodL: wetlands.reduce((n, r) => n + r.flood.waterL, 0),
    bankDischargedL: wetlands.reduce((n, r) => n + r.flood.bankDischargedL, 0),
    floodDischargedL: wetlands.reduce((n, r) => n + r.flood.dischargedL, 0),
    originalL, suppliedL, accountedL, errorL,
    outletCapacityRangeLDay: [Math.min(...wetlands.flatMap(r => r.ecology.watercourses?.[0]?.outlet ? [Flood.capacity(r.ecology.watercourses[0])] : [])),
      Math.max(...wetlands.flatMap(r => r.ecology.watercourses?.[0]?.outlet ? [Flood.capacity(r.ecology.watercourses[0])] : []))],
    wetlandRecords, ...(baseline ? { historicalComparison: { sourceId: baseline.account.sourceId, days: baseline.account.clock / P.DAY,
      scope: 'Retained full-food-web history compared with a new-source HYDROLOGY-ONLY control, not a repeated all-species result',
      soilDeficitRegions: historicalFailures.length,
      floodOnlyDestructionRegions: wetlandRecords.filter(r => r.historicalFullFoodWeb?.nonFloodSoilDestructionEP === 0).length,
      otherSoilDestructionRegions: wetlandRecords.filter(r => r.historicalFullFoodWeb?.nonFloodSoilDestructionEP > 0).length,
      positiveRecordedBalanceWithoutFloodRegions: wetlandRecords.filter(r => r.historicalFullFoodWeb?.soilBalanceWithoutRecordedFloodEP > 0).length } } : {}),
    boundaries: s.work.boundaries, regionIntervals: s.work.regionIntervals, milliseconds: Math.round(performance.now() - start) };
}
if (require.main === module) {
  const fs = require('node:fs'), args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const baselinePath = value('--baseline'), output = value('--output');
  const report = run({ ...(baselinePath ? { baseline: JSON.parse(fs.readFileSync(baselinePath, 'utf8')) } : {}) });
  if (output) { fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(`Recorded ${report.sourceId}: ${report.soilMaintenanceDeficits} soil deficits, ${report.erodedWetlands} eroded wetlands`); }
  else console.log(JSON.stringify(report, null, 2));
}
module.exports = { run };
