// Targeted generated-geography control, not a full-ecosystem acceptance run.
const Library = require('../world-run-library'), Sources = require('../beast-habitat-sources');
const P = require('../beast-populations'), Wildlife = require('../background-wildlife'), Foraging = require('../beast-foraging'), Carcasses = require('../wildlife-carcasses');
const ID = 'beast:carrion-lantern';
function replay({ checkpoints = [20, 40, 60, 80, 100, 120] } = {}) {
  const started = performance.now();
  const world = Library.createWorld({ id: 'lantern-approach-control', worldSeed: 'source-small', generationVersion: 8,
    createdAt: '2026-11-17', creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, source = Sources.expand(record, map);
  source.groups = source.groups.filter(g => g.speciesId === ID);
  source.id += ':isolated-lantern-control';
  const s = P.createDiagnostic(source, { worldId: world.id, runId: 'isolated-approach-control' });
  const original = s.groups.reduce((n, g) => n + g.cohorts.reduce((v, c) => v + P.count(c), 0), 0);
  const initialWildlife = Wildlife.summary(s);
  const milestones = [];
  for (const day of checkpoints) {
    P.advance(s, day * P.DAY, true, true);
    if (!P.normalize(s)) throw Error(`Invalid control at day ${day}`);
    const living = Object.values(P.audit(s)).reduce((n, p) => n + p.background + p.detailed, 0);
    const row = { day, living, eatenKg: Foraging.summary(s).eatenKg, wildlifeEatenKg: Wildlife.summary(s).consumedKg,
      approaches: s.regions.reduce((n, r) => n + (r.foraging?.receipts.approaches || 0), 0),
      approachSeconds: s.regions.reduce((n, r) => n + (r.foraging?.receipts.approachSeconds || 0), 0) };
    milestones.push(row); console.log(JSON.stringify(row));
  }
  const causes = {};
  for (const loss of s.losses) causes[loss.cause] = (causes[loss.cause] || 0) + 1;
  for (const loss of s.lossBatches || []) causes[loss.cause] = (causes[loss.cause] || 0) + loss.count;
  const report = { sourceId: record.id, original, initialWildlife, milestones, causes,
    births: s.births.reduce((n, b) => n + b.count, 0), wildlife: Wildlife.summary(s),
    atmosphericWaterL: s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0),
    carcasses: Carcasses.summary(s),
    work: s.work, cohorts: s.groups.reduce((n, g) => n + g.cohorts.length, 0),
    milliseconds: Math.round(performance.now() - started),
    scope: 'Only original Lantern groups; finite spatial carcass batches from actual wildlife deaths; no rescue bodies or other strategic species' };
  console.log(JSON.stringify(report)); return report;
}
if (require.main === module) replay();
module.exports = { replay };
