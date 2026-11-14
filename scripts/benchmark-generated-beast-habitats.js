// Focused generated-source execution, not a native game or world-balance claim.
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
function run({ seed = 'source-small', days, progress = () => {} } = {}) {
  const started = performance.now();
  const world = L.createWorld({ id: 'generated-habitat-benchmark', worldSeed: seed, createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
  const binding = { worldId: world.id, runId: 'private-generated-replay' };
  const endDays = days ?? record.calendar.monthDays.reduce((n, d) => n + d, 0);
  const account = P.createDiagnostic(S.expand(record, map), binding);
  const executionStarted = performance.now();
  for (let day = 1; day <= endDays; day++) {
    P.advance(account, day * P.DAY, true, true);
    if (day % 10 === 0 || day === endDays) progress({ day, milliseconds: Math.round(performance.now() - executionStarted),
      ...account.work, cohorts: account.groups.reduce((n, g) => n + g.cohorts.length, 0) });
  }
  const result = S.replay(record, map, { binding, account, until: endDays * P.DAY });
  return { milliseconds: Math.round(performance.now() - started), days: endDays, regions: account.regions.length,
    groups: account.groups.length, bindingBytes: JSON.stringify(record.physicalBinding).length,
    accountBytes: JSON.stringify(account).length, ...result.report, issues: result.report.issues.length,
    sourceAvailability: result.report.sourceAvailability.length, populations: result.report.populations.length };
}
if (require.main === module) {
  const daysArg = process.argv.find(arg => arg.startsWith('--days='));
  const days = daysArg ? Number(daysArg.slice(7)) : undefined;
  if (days != null && (!Number.isInteger(days) || days < 1)) throw Error('A positive whole elapsed-day count is required');
  console.log(JSON.stringify(run({ days, progress: value => console.log(JSON.stringify(value)) })));
}
module.exports = { run };
