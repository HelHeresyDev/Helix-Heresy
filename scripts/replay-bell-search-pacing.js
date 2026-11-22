// Private day-window comparison on the same retained all-species account.
// For the baseline, pipe the trusted, committed beast-foraging.js into stdin.
const fs = require('node:fs');
const [checkpoint, endDayText, ...options] = process.argv.slice(2);
const endDay = Number(endDayText);
if (!checkpoint || !Number.isInteger(endDay) || options.some(x => x !== '--baseline-stdin'))
  throw Error('Usage: node scripts/replay-bell-search-pacing.js CHECKPOINT END_DAY [--baseline-stdin]');
const baseline = options.includes('--baseline-stdin');
if (baseline) {
  const Module = require('node:module'), path = require('node:path');
  const filename = require.resolve('../beast-foraging'), kernel = new Module(filename, module);
  kernel.filename = filename; kernel.paths = Module._nodeModulePaths(path.dirname(filename));
  kernel._compile(fs.readFileSync(0, 'utf8'), filename);
  require.cache[filename] = kernel;
}
const P = require('../beast-populations'), F = require('../beast-foraging');
const origin = 'natural-group:beast-population:abyssal-bell:01:2:males';
const { world, account: saved } = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
const binding = { worldId: saved.worldId, runId: saved.runId };
const account = P.normalize(saved, binding);
const start = account?.clock / P.DAY;
if (!account?.diagnosticOnly || world.id !== account.worldId || world.generatedData.strategicMap.beastHabitatSources.id !== account.sourceId
  || !Number.isInteger(start) || endDay <= start)
  throw Error('Expected the original whole-day diagnostic checkpoint and a later day');
const locate = () => account.groups.flatMap(g => g.cohorts.filter(c => c.originId === origin && P.count(c)).map(c => ({ g, c })))[0];
if (!locate()) throw Error('The retained Abyssal Bell is not present');
const counts = { captures: 0, claimedKg: 0, eatenKg: 0, lateEatenKg: 0, lateSearchSeconds: 0 };
const read = day => {
  const { g, c } = locate() || {}, f = c?.foraging;
  return { day, alive: Boolean(c), region: c && (g.transit?.stop?.position.regionId || g.regionId),
    health: c?.health, foodKg: c?.stores.foodKg, fatKg: c?.stores.fatKg, searchUsed: f?.plan.used.search,
    searchCeiling: f?.plan.limits.search, phase: f?.phase, firstShortfallAt: c?.firstScarcity?.at, ...counts };
};
const step = F.step, integrate = F.integrate;
F.step = function (s, r, g, c, at, ctx) {
  if ((s.accountRoot || s) !== account || c.originId !== origin) return step(...arguments);
  return step(s, r, g, c, at, { ...ctx, capture(...args) {
    const claims = ctx.capture(...args);
    counts.captures += claims.length;
    counts.claimedKg += claims.reduce((n, p) => n + p.kg, 0);
    return claims;
  } });
};
F.integrate = function (s, r, g, c, from, to, rate) {
  if (s !== account || c.originId !== origin) return integrate(...arguments);
  const before = r.foraging?.receipts.eatenKg || 0, search = c.foraging?.plan.used.search || 0;
  const result = integrate(s, r, g, c, from, to, rate);
  const eaten = (r.foraging?.receipts.eatenKg || 0) - before;
  counts.eatenKg += eaten;
  if (from >= 50 * P.DAY) {
    counts.lateEatenKg += eaten;
    counts.lateSearchSeconds += (c.foraging?.plan.used.search || 0) - search;
  }
  return result;
};
try {
  const started = performance.now();
  console.log(JSON.stringify({ sourceId: account.sourceId, original: origin, baseline, ...read(start) }));
  for (let day = start + 1; day <= endDay; day++) {
    P.advance(account, day * P.DAY, true, true);
    if ([41, 45, 48, 50, 52, 55, endDay].includes(day))
      console.log(JSON.stringify({ ...read(day), milliseconds: Math.round(performance.now() - started) }));
  }
} finally { F.step = step; F.integrate = integrate; }
if (!P.normalize(account, binding)) throw Error('End account failed normalization');
