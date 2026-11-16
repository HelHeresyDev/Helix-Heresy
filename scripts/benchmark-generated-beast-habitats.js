// Focused generated-source execution, not a native game or world-balance claim.
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations'), Care = require('../beast-parental-care');
function run({ seed = 'source-small', days, progress = () => {}, engine = P } = {}) {
  const started = performance.now();
  const world = L.createWorld({ id: 'generated-habitat-benchmark', worldSeed: seed, createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
  const binding = { worldId: world.id, runId: 'private-generated-replay' };
  const endDays = days ?? record.calendar.monthDays.reduce((n, d) => n + d, 0);
  const account = engine.createDiagnostic(S.expand(record, map), binding);
  const executionStarted = performance.now();
  for (let day = 1; day <= endDays; day++) {
    engine.advance(account, day * engine.DAY, true, true);
    if (day % 10 === 0 || day === endDays) progress({ day, milliseconds: Math.round(performance.now() - executionStarted),
      ...account.work, cohorts: account.groups.reduce((n, g) => n + g.cohorts.length, 0) });
  }
  const executionMilliseconds = Math.round(performance.now() - executionStarted);
  const result = S.replay(record, map, { binding, account, until: endDays * engine.DAY });
  const byKind = rows => rows.reduce((counts, row) => { counts[row.kind] = (counts[row.kind] || 0) + 1; return counts; }, {});
  const lossesByCause = {};
  for (const loss of [...account.losses, ...account.lossBatches])
    lossesByCause[loss.cause] = (lossesByCause[loss.cause] || 0) + (loss.count ?? 1);
  const shortfalls = {};
  for (const issue of result.report.issues) if (issue.kind === 'performedResourceShortfall')
    shortfalls[issue.resource] = (shortfalls[issue.resource] || 0) + issue.missingAmount;
  const lossesBySpecies = {};
  const scarcityPhases = {}, scarcityExamples = {};
  for (const loss of [...account.losses, ...account.lossBatches]) {
    const row = lossesBySpecies[loss.speciesId] ||= {};
    row[loss.cause] = (row[loss.cause] || 0) + (loss.count ?? 1);
    if (loss.context) {
      const c = loss.context, phase = `${c.phase}:${c.dependent ? 'dependent' : 'independent'}:${c.afterPersonalArrival ? 'after-arrival' : 'no-prior-arrival'}`;
      scarcityPhases[phase] = (scarcityPhases[phase] || 0) + (loss.count ?? 1);
      const examples = scarcityExamples[loss.speciesId] ||= [];
      if (examples.length < 2) examples.push({ cause: loss.cause, count: loss.count ?? 1, ...c });
    }
  }
  return { milliseconds: Math.round(performance.now() - started), executionMilliseconds, days: endDays, regions: account.regions.length,
    groups: account.groups.length, bindingBytes: JSON.stringify(record.physicalBinding).length,
    accountBytes: JSON.stringify(account).length, ...result.report, issues: result.report.issues.length,
    issueKinds: byKind(result.report.issues), sourceIssueKinds: byKind(result.report.sourceAvailability), lossesByCause, lossesBySpecies, shortfalls,
    parentalCare: Care.summary(account), scarcityPhases, scarcityExamples,
    sourceAvailability: result.report.sourceAvailability.length, populations: result.report.populations.length };
}
if (require.main === module) {
  const daysArg = process.argv.find(arg => arg.startsWith('--days='));
  const days = daysArg ? Number(daysArg.slice(7)) : undefined;
  if (days != null && (!Number.isInteger(days) || days < 1)) throw Error('A positive whole elapsed-day count is required');
  let engine = P;
  // Read a trusted committed kernel through stdin, keeping the same current
  // biology/support modules to isolate scheduler cost and timing behavior.
  // Example: git show <baseline>:beast-populations.js | node this-script --baseline-stdin --days=35
  if (process.argv.includes('--baseline-stdin')) {
    const Module = require('node:module'), path = require('node:path');
    const baseline = new Module(path.resolve(__dirname, '../baseline-populations.js'));
    baseline.filename = path.resolve(__dirname, '../baseline-populations.js');
    baseline.paths = Module._nodeModulePaths(path.dirname(baseline.filename));
    baseline._compile(require('node:fs').readFileSync(0, 'utf8'), baseline.filename); engine = baseline.exports;
  }
  console.log(JSON.stringify(run({ days, engine, progress: value => console.log(JSON.stringify(value)) })));
}
module.exports = { run };
