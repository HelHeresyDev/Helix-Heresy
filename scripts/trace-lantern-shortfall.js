// Private, read-only observer for an original Lantern cohort in a retained replay.
const fs = require('node:fs');
const P = require('../beast-populations');
const F = require('../beast-foraging');
const W = require('../beast-wind-drift');
const Bodies = require('../beast-bodies');
const Carcasses = require('../wildlife-carcasses');
const Tissues = require('../carcass-tissues');
const ID = 'beast:carrion-lantern';
const HOUR = 3600;
const round = n => Math.round(n * 1e6) / 1e6;

function observe(account, originId) {
  const step = F.step, integrate = F.integrate;
  const summary = { stepCalls: 0, sensingCalls: 0, detections: 0, inReach: 0, captureCalls: 0,
    captures: 0, eatenKg: 0, elapsedSeconds: {}, regions: {}, unholdableSeconds: 0,
    gripChecks: 0, minAirMps: null, maxAirMps: null, sites: [], incompleteQueries: 0, sampledPaths: 0 };
  const poolViews = new WeakMap(), samples = new Set();
  const match = (s, c) => s === account && c.speciesId === ID && c.originId === originId;

  function sample(r, g, c, from, to, start, end, flow) {
    // These are out-of-band checks, never passed back into animal decisions.
    // A disposable pool wrapper keeps observation from touching runtime query caches.
    const key = `${r.id}:${Math.floor(from / HOUR)}`;
    if (summary.sites.length >= 8 || samples.has(key)) return;
    samples.add(key); summary.sampledPaths++;
    const b = Bodies.profiles[ID], sense = Math.max(b.sightM, b.scentM);
    const distance = p => {
      const axes = ['eastM', 'northM', 'altitudeM'];
      const line = axes.map(k => end[k] - start[k]), offset = axes.map(k => p[k] - start[k]);
      const end2 = line.reduce((n, a) => n + a * a, 0);
      const t = end2 ? Math.max(0, Math.min(1, line.reduce((n, a, i) => n + a * offset[i], 0) / end2)) : 0;
      return Math.hypot(...offset.map((n, i) => n - t * line[i]));
    };
    const collect = (row, time) => {
      if (summary.sites.length >= 8 || !row.position || row.position.altitudeM < 0) return;
      const metres = distance(row.position), kg = Tissues.available(row, c);
      if (metres > sense || kg <= 1e-8 || summary.sites.some(site => site.id === row.id)) return;
      summary.sites.push({ id: row.id, from, to, inventoryAt: time, metres: round(metres),
        compatibleKg: round(kg), airborneGripPossible: W.canFeedAt(g, c, r, row, 60, flow) });
    };
    for (const row of [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {})]) collect(row, row.lastAt);
    for (const pool of r.wildlife?.pools || []) {
      if (!pool.carcassSpace || pool.guild === 'fish' || summary.sites.length >= 8) continue;
      const view = poolViews.get(pool) || {}; poolViews.set(pool, view); Object.assign(view, pool);
      const result = Carcasses.query(view, start, sense, end);
      if (!result.complete) summary.incompleteQueries++;
      for (const row of result.sites) collect(row, pool.carcass.lastAt);
    }
  }

  F.step = function (s, r, g, c, at, ctx) {
    if (!match(s.accountRoot || s, c)) return step(...arguments);
    summary.stepCalls++;
    return step(s, r, g, c, at, { ...ctx, senseCarrion() {
      const result = ctx.senseCarrion();
      summary.sensingCalls++;
      if (result) { summary.detections++; if (result.contact) summary.inReach++; }
      return result;
    }, capture(...args) {
      const result = ctx.capture(...args);
      summary.captureCalls++; summary.captures += result.length;
      return result;
    } });
  };
  F.integrate = function (s, r, g, c, from, to, rate) {
    if (!match(s, c) || to <= from) return integrate(...arguments);
    const seconds = to - from, phase = c.foraging?.phase || 'idle', d = c.windDrift;
    summary.elapsedSeconds[phase] = (summary.elapsedSeconds[phase] || 0) + seconds;
    summary.regions[r.id] = (summary.regions[r.id] || 0) + seconds;
    const end = c.regionalPosition;
    if (d?.flow && end?.regionId === r.id) {
      const air = Math.hypot(d.flow.x, d.flow.y);
      summary.minAirMps = Math.min(summary.minAirMps ?? Infinity, air);
      summary.maxAirMps = Math.max(summary.maxAirMps ?? 0, air);
      summary.gripChecks++;
      // Infinite anchor demand here is the body's own force limit, before
      // looking at how much support any particular corpse could supply.
      if (W.anchorNeed(c, r, d.flow, { position: end }) === Infinity
        && Math.hypot(d.velocity.x, d.velocity.y) * 60 > Bodies.profiles[ID].reachM * 2)
        summary.unholdableSeconds += seconds;
      const start = { ...end, eastM: end.eastM - d.velocity.x * seconds,
        northM: end.northM - d.velocity.y * seconds, altitudeM: end.altitudeM - (d.velocity.z || 0) * seconds };
      sample(r, g, c, from, to, start, end, d.flow);
    }
    const eatenBefore = r.foraging?.receipts.eatenKg || 0;
    const result = integrate(s, r, g, c, from, to, rate);
    summary.eatenKg += (r.foraging?.receipts.eatenKg || 0) - eatenBefore;
    return result;
  };
  return { summary, stop() { F.step = step; F.integrate = integrate; } };
}

function replay(checkpoint, originId, endDay) {
  const { world, account: saved } = checkpoint;
  const account = P.normalize(saved, { worldId: saved.worldId, runId: saved.runId });
  if (!account?.diagnosticOnly || world.id !== saved.worldId
    || world.generatedData.strategicMap.beastHabitatSources.id !== account.sourceId
    || !Number.isInteger(account.clock / P.DAY) || endDay <= account.clock / P.DAY)
    throw Error('Expected a valid diagnostic checkpoint and later whole day for that exact world');
  const find = () => account.groups.flatMap(g => g.cohorts.filter(c => c.originId === originId)
    .map(c => ({ group: g.id, members: P.count(c), position: c.regionalPosition, stores: c.stores,
      massKg: c.massKg, health: c.health, firstScarcity: c.firstScarcity })));
  const fromDay = account.clock / P.DAY, start = structuredClone(find());
  if (!start.length) throw Error('Lantern origin not found in checkpoint');
  const observer = observe(account, originId);
  try {
    for (let d = fromDay + 1; d <= endDay; d++) P.advance(account, d * P.DAY, true, true);
  } finally { observer.stop(); }
  if (!P.normalize(account, { worldId: account.worldId, runId: account.runId })) throw Error('End account failed normalization');
  return { sourceId: account.sourceId, originId, fromDay, endDay, start, end: find(), ...observer.summary };
}

if (require.main === module) {
  const [filename, originId, endDay] = process.argv.slice(2);
  if (!filename || !originId || !Number.isInteger(Number(endDay))) throw Error('Usage: node scripts/trace-lantern-shortfall.js CHECKPOINT ORIGIN_ID END_DAY');
  console.log(JSON.stringify(replay(JSON.parse(fs.readFileSync(filename, 'utf8')), originId, Number(endDay)), null, 2));
}
module.exports = { observe, replay };
