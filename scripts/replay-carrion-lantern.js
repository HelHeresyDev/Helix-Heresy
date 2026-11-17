// Targeted generated-geography control, not a full-ecosystem acceptance run.
const Library = require('../world-run-library'), Sources = require('../beast-habitat-sources');
const P = require('../beast-populations'), Wildlife = require('../background-wildlife'), Foraging = require('../beast-foraging');
const ID = 'beast:carrion-lantern';
function replay() {
  const started = performance.now();
  const world = Library.createWorld({ id: 'lantern-approach-control', worldSeed: 'source-small', generationVersion: 8,
    createdAt: '2026-11-16', creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, source = Sources.expand(record, map);
  source.groups = source.groups.filter(g => g.speciesId === ID);
  source.id += ':isolated-lantern-control';
  const s = P.createDiagnostic(source, { worldId: world.id, runId: 'isolated-approach-control' });
  const original = s.groups.reduce((n, g) => n + g.cohorts.reduce((v, c) => v + P.count(c), 0), 0);
  const milestones = [];
  for (const day of [20, 40, 60, 80, 100, 120]) {
    P.advance(s, day * P.DAY, true, true);
    if (!P.normalize(s)) {
      const group = id => s.groups.find(g => g.id === id);
      console.log(JSON.stringify({ windValid: require('../beast-wind-drift').valid(s),
        forageValid: Foraging.valid(s, group), foodWebValid: require('../beast-regional-foodweb').validate(s),
        ecologyValid: require('../beast-regional-ecology').valid(s), schedulerValid: require('../beast-population-scheduler').validate(s) }));
      throw Error(`Invalid control at day ${day}`);
    }
    const living = Object.values(P.audit(s)).reduce((n, p) => n + p.background + p.detailed, 0);
    const row = { day, living, eatenKg: Foraging.summary(s).eatenKg,
      approaches: s.regions.reduce((n, r) => n + (r.foraging?.receipts.approaches || 0), 0),
      approachSeconds: s.regions.reduce((n, r) => n + (r.foraging?.receipts.approachSeconds || 0), 0) };
    milestones.push(row); console.log(JSON.stringify(row));
  }
  const causes = {};
  for (const loss of s.losses) causes[loss.cause] = (causes[loss.cause] || 0) + 1;
  for (const loss of s.lossBatches || []) causes[loss.cause] = (causes[loss.cause] || 0) + loss.count;
  const report = { sourceId: record.id, original, milestones, causes,
    births: s.births.reduce((n, b) => n + b.count, 0), wildlife: Wildlife.summary(s),
    atmosphericWaterL: s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0),
    work: s.work, cohorts: s.groups.reduce((n, g) => n + g.cohorts.length, 0),
    milliseconds: Math.round(performance.now() - started),
    scope: 'Only original Lantern groups; unchanged finite generated wildlife, water and wind; no rescue carcasses or other strategic species' };
  console.log(JSON.stringify(report)); return report;
}
if (require.main === module) replay();
module.exports = { replay };
