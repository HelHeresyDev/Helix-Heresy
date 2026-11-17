// Focused generated-source execution, not a native game or world-balance claim.
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations'), Care = require('../beast-parental-care');
const Carcasses = require('../wildlife-carcasses');
function run({ seed = 'source-small', days, progress = () => {}, checkpoint = () => {}, resume = null, engine = P } = {}) {
  const started = performance.now();
  const world = resume?.world || L.createWorld({ id: 'generated-habitat-benchmark', worldSeed: seed, createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
  const binding = { worldId: world.id, runId: 'private-generated-replay' };
  const endDays = days ?? record.calendar.monthDays.reduce((n, d) => n + d, 0);
  const account = resume ? engine.normalize(resume.account, binding) : engine.createDiagnostic(S.expand(record, map), binding);
  if (!account || account.sourceId !== record.id || account.diagnosticOnly !== true || !Number.isInteger(account.clock / engine.DAY))
    throw Error('Resume requires this exact private source and a valid whole-day snapshot');
  S.validate(record, map);
  const executionStarted = performance.now();
  for (let day = account.clock / engine.DAY + 1; day <= endDays; day++) {
    engine.advance(account, day * engine.DAY, true, true);
    if (day % 10 === 0 || day === endDays) checkpoint({ world, account }, day);
    if ((day % 10 === 0 || day === endDays) && !engine.normalize(account, binding))
      throw Error(`Generated account cannot normalize at day ${day}`);
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
    parentalCare: Care.summary(account), carcasses: Carcasses.summary(account), scarcityPhases, scarcityExamples,
    sourceAvailability: result.report.sourceAvailability.length, populations: result.report.populations.length };
}
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
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
  const resumePath = process.argv.find(arg => arg.startsWith('--resume='))?.slice(9);
  const checkpointDir = process.argv.find(arg => arg.startsWith('--checkpoint-dir='))?.slice(17);
  if (checkpointDir && (!fs.lstatSync(checkpointDir).isDirectory() || fs.lstatSync(checkpointDir).isSymbolicLink()))
    throw Error('Use an existing real checkpoint directory; snapshots never overwrite files');
  const finalOnly = process.argv.includes('--checkpoint-final-only'), saveReport = process.argv.includes('--save-report');
  if ((finalOnly || saveReport) && !checkpointDir) throw Error('A real checkpoint directory is required');
  const result = run({ days, engine, resume: resumePath ? JSON.parse(fs.readFileSync(resumePath, 'utf8')) : null,
    checkpoint: checkpointDir ? (value, day) => {
      const finalDay = days ?? value.account.calendar.monthDays.reduce((n, d) => n + d, 0);
      if (!finalOnly || day === finalDay) fs.writeFileSync(path.join(checkpointDir, `day-${day}.json`), JSON.stringify(value), { flag: 'wx' });
    } : undefined, progress: value => console.log(JSON.stringify(value)) });
  if (saveReport) {
    const reportPath = path.join(checkpointDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result), { flag: 'wx' });
    console.log(JSON.stringify({ sourceId: result.sourceId, status: result.status, viability: result.viability.status,
      days: result.days, counts: result.counts, issueKinds: result.issueKinds, reportPath }));
  } else console.log(JSON.stringify(result));
}
module.exports = { run };
