// Compact evidence from one completed diagnostic, not a new acceptance policy.
const fs = require('node:fs'), path = require('node:path');
const P = require('../beast-populations'), Care = require('../beast-parental-care'), F = require('../beast-foraging');
const Library = require('../world-run-library');
const Biology = require('../creature-biology');
const LANTERN = 'beast:carrion-lantern';
const close = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
function membership(s) {
  const populationSpecies = new Map(s.groups.map(g => [g.populationId, g.speciesId])), rows = {};
  const row = id => rows[id] ||= { original: 0, born: 0, living: 0, dead: 0 };
  for (const [id, n] of Object.entries(s.originalCounts)) row(populationSpecies.get(id)).original += n;
  for (const birth of s.births) row(populationSpecies.get(birth.populationId)).born += birth.count;
  for (const [id, counts] of Object.entries(P.audit(s))) {
    row(populationSpecies.get(id)).living += counts.background + counts.detailed;
    row(populationSpecies.get(id)).dead += counts.dead;
  }
  for (const [id, r] of Object.entries(rows)) if (id === 'undefined' || r.original + r.born !== r.living + r.dead)
    throw Error('Per-species membership does not conserve original and born bodies');
  return rows;
}
function summarize(directory, { runtimeKernelCommit = 'unrecorded' } = {}) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')), report = read('report.json');
  const days = report.days, checkpoints = []; let originalWorld, final;
  if (days !== 120) throw Error('This comparison requires one complete 120-day cycle');
  for (let day = 10; day <= days; day += 10) {
    const value = read(`day-${day}.json`), { world, account: s, intakeAudit } = value, members = membership(s);
    const bytes = JSON.stringify(world);
    if (originalWorld == null) originalWorld = bytes;
    if (originalWorld !== bytes || s.sourceId !== report.sourceId || s.clock !== day * P.DAY
      || intakeAudit?.sourceId !== s.sourceId || intakeAudit.from !== 0 || intakeAudit.until !== s.clock)
      throw Error('Checkpoint source, immutable world, interval or intake history changed');
    const sum = key => Object.values(intakeAudit.bySpecies).reduce((n, row) => n + row[key], 0);
    const care = Care.summary(s), foraged = F.summary(s).eatenKg, atmosphere = s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0);
    if (!close(sum('foragedWetTissueKg'), foraged) || !close(sum('atmosphericWaterL'), atmosphere)
      || !close(sum('careFoodDeliveredKg'), care.givenFoodKg) || !close(sum('careWaterDeliveredL'), care.givenWaterL))
      throw Error('Species intake does not reconcile with performed receipts');
    const lanterns = s.groups.filter(g => g.speciesId === LANTERN).flatMap(g => g.cohorts).filter(c => P.count(c));
    const stored = key => lanterns.reduce((n, c) => n + (c.stores[key] || 0) * P.count(c), 0);
    checkpoints.push({ day, livingBySpecies: Object.fromEntries(Object.entries(members).map(([id, r]) => [id, r.living])),
      original: Object.values(members).reduce((n, r) => n + r.original, 0), born: s.births.reduce((n, b) => n + b.count, 0),
      living: Object.values(members).reduce((n, r) => n + r.living, 0), dead: Object.values(members).reduce((n, r) => n + r.dead, 0),
      lanternIntake: intakeAudit.bySpecies[LANTERN],
      lanternCondition: { minimumLivingHealth: lanterns.length ? Math.min(...lanterns.map(c => c.health)) : null,
        maximumLivingHealth: lanterns.length ? Math.max(...lanterns.map(c => c.health)) : null,
        storedFoodKg: stored('foodKg'), storedFatKg: stored('fatKg'), storedWaterL: stored('waterL') },
      soilFloorBreaches: s.regions.filter(r => r.ecologicalAccount?.viabilityHistory.floorBreaches.soilCover).length,
      receiptsReconciled: true });
    if (day === days) final = value;
  }
  const s = final.account, v = report.viability, floors = v.issues.filter(i => i.kind === 'performedHabitatFloorBreach');
  if (Library.normalizeWorld(final.world).canonicalDigest !== final.world.canonicalDigest) throw Error('Reusable world digest changed');
  const deficits = v.issues.filter(i => i.kind === 'performedMaintenanceDeficit');
  const scarcityAgeClasses = {};
  for (const loss of [...s.losses, ...s.lossBatches]) if (['starvation', 'dehydration'].includes(loss.cause)) {
    const context = loss.context, kind = !Number.isFinite(context?.ageDays) ? 'unrecorded'
      : context.dependent ? 'dependent' : context.ageDays < Biology.lifecycle[loss.speciesId].adultDays ? 'independentJuvenile' : 'adult';
    const row = scarcityAgeClasses[loss.speciesId] ||= {};
    row[kind] = (row[kind] || 0) + (loss.count || 1);
  }
  const byChannel = rows => rows.reduce((n, r) => { n[r.channel] = (n[r.channel] || 0) + 1; return n; }, {});
  return { scope: 'Fresh private all-species diagnostic after hunting placement, vector Lantern motion and catchment drainage; no balance tuning or native adoption',
    runtimeKernelCommit, instrumentation: 'Node-only observer; no simulation rule or game-account changes',
    sourceId: report.sourceId, seed: final.world.worldSeed, refinement: final.world.generatedData.strategicMap.topology.refinementLevel,
    days, status: report.status, measuredStatus: v.status, coverage: v.coverage,
    regions: report.regions, populations: report.populations, original: report.initialLocated, born: report.born, counts: report.counts,
    checkpointNormalization: 'All twelve ten-day checkpoints passed the executing benchmark normalization before completion',
    reusableWorldIdenticalAcrossCheckpoints: true, canonicalWorldDigest: final.world.canonicalDigest, species: membership(s), milestones: checkpoints,
    issueKinds: report.issueKinds, shortfalls: report.shortfalls, lossesByCause: report.lossesByCause,
    lossesBySpecies: report.lossesBySpecies, scarcityPhases: report.scarcityPhases, scarcityAgeClasses, scarcityExamples: report.scarcityExamples,
    firstFailures: v.firstFailures.length,
    firstFailureEvidence: v.firstFailures.reduce((n, f) => { n[f.supplyEvidence] = (n[f.supplyEvidence] || 0) + 1; return n; }, {}),
    habitatFloorBreaches: floors, maintenanceDeficits: deficits, maintenanceDeficitsByChannel: byChannel(deficits), habitatFloorBreachesByChannel: byChannel(floors),
    exhaustedRegions: s.regions.filter(r => r.exhausted).map(r => r.id),
    floodErosionEP: s.regions.reduce((n, r) => n + (r.flood?.erosionEP || 0), 0),
    erodedWetlands: s.regions.filter(r => (r.flood?.erosionEP || 0) > 1e-8).length,
    atmosphericWaterTakenL: s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0),
    intakeAudit: report.intakeAudit, intakeLimits: 'Direct maintenance uptake uses the executed cached supply rates; foraging and care use actual transfer receipts. Starting reserves are not new intake. Care is an internal transfer, not additional environmental production. Instant remains are wet kg, not inferred water or food-equivalent.',
    parentalCare: report.parentalCare, foodWeb: report.foodWeb, carcasses: report.carcasses,
    sourceIssueKinds: report.sourceIssueKinds, executionMilliseconds: report.executionMilliseconds,
    boundaries: report.boundaries, cohortIntervals: report.cohortIntervals, accountBytes: report.accountBytes };
}
if (require.main === module) {
  const [directory, output, runtimeKernelCommit] = process.argv.slice(2);
  if (!directory || !output) throw Error('Provide a completed checkpoint directory and a new output JSON path');
  const result = summarize(directory, { runtimeKernelCommit });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ sourceId: result.sourceId, status: result.status, days: result.days, issueKinds: result.issueKinds }));
}
module.exports = { summarize, membership };
