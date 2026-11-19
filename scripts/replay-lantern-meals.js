// Process-local observer for the isolated generated Lantern replay.
const F = require('../beast-foraging'), W = require('../beast-wind-drift');
const C = require('../wildlife-carcasses'), A = require('../carrion-lantern-approach');
const ID = 'beast:carrion-lantern';

function trace() {
  const originals = { step: F.step, integrate: F.integrate, query: C.query, anchor: W.canFeedAt, windPlan: W.plan,
    course: A.course, intercept: A.intercept };
  const counters = {}, examples = {}, groups = new Map();
  const count = (key, n = 1) => { counters[key] = (counters[key] || 0) + n; };
  const example = (key, value) => { if ((examples[key] ||= []).length < 4) examples[key].push(value); };
  C.query = function (pool, start, range, end) {
    const result = originals.query(...arguments);
    const swept = end && (start.eastM !== end.eastM || start.northM !== end.northM);
    const key = swept ? 'sweep' : 'point';
    count(key); count(`${key}Sites`, result.sites.length);
    if (!result.complete) count(`${key}Truncated`);
    return result;
  };
  W.canFeedAt = function (g, c, r, body) {
    const result = originals.anchor(...arguments);
    if (g.speciesId === ID) {
      const key = `${body.poolId ? 'actualAnchor' : 'representativeAnchor'}${result ? 'Pass' : 'Fail'}`;
      count(key);
      if (!result) example(key, { region: r.id, wind: c.windDrift?.flow, velocity: c.windDrift?.velocity, mass: body.massKg,
        referenceMass: body.referenceBodyKg, count: body.count });
    }
    return result;
  };
  W.plan = function (g, c, r, at, month, pos) {
    const result = originals.windPlan(...arguments);
    const action = c.foraging?.action;
    if (g.speciesId === ID && action?.phase === 'handling' && action.startedAt === at) {
      const data = r.foraging.meals[c.foraging.mealIds[0]];
      const body = data && (data.kind === 'wildlife' ? C.source(r, data.sourceId) :
        r.remains?.[data.sourceId] || r.remainsBatches?.[data.sourceId]);
      const key = c.windDrift?.hold ? 'holding' : 'handlingWithoutHold';
      count(key);
      example(key, { at, group: g.id, pos, dueAt: action.dueAt, source: data?.sourceId, matter: data?.kg, anchors: data?.anchors,
        structuralMass: body && C.anchorLimit(body), sourceBodies: body?.count, organismMass: c.massKg, stamina: c.regional.stamina,
        wind: c.windDrift?.flow });
    }
    return result;
  };
  A.course = function () {
    const result = originals.course(...arguments);
    count(result ? 'course' : 'noCourse');
    return result;
  };
  A.intercept = function () {
    const result = originals.intercept(...arguments);
    count(result ? 'intercept' : 'noIntercept');
    return result;
  };
  F.step = function (s, r, g, c, at, ctx) {
    if (g.speciesId !== ID) return originals.step(...arguments);
    const wrap = { ...ctx, senseCarrion() {
      const seen = ctx.senseCarrion();
      const key = seen ? `${seen.kind}${seen.contact ? 'InReach' : 'Sensed'}` : 'nothingSensed';
      count(key);
      if (seen) example(key, { group: g.id, at, pos: ctx.position, target: seen.position, source: seen.sourceId });
      return seen;
    }, capture() {
      const claims = ctx.capture(...arguments);
      count('captureReviews');
      if (claims.length) count('captureReturns');
      for (const claim of claims) count(`claim:${claim.kind || 'wildlife'}`);
      return claims;
    } };
    const result = originals.step(s, r, g, c, at, wrap);
    if (c.foraging?.action?.startedAt === at) count(`start:${c.foraging.action.phase}`);
    return result;
  };
  F.integrate = function (s, r, g, c, from, to) {
    if (g.speciesId !== ID || c.foraging?.phase !== 'eating') return originals.integrate(...arguments);
    const before = r.foraging.receipts.eatenKg, meal = r.foraging.meals[c.foraging.action.mealId];
    const result = originals.integrate(...arguments);
    const kg = r.foraging.receipts.eatenKg - before;
    if (kg > 0 && meal) {
      const originalFlock = g.windFlockId || g.id;
      const bySource = groups.get(originalFlock) || new Map(); groups.set(originalFlock, bySource);
      const key = `${meal.kind}:${meal.sourceId}`, row = bySource.get(key) || { kg: 0, firstAt: from, lastAt: to };
      row.kg += kg; row.lastAt = to; bySource.set(key, row);
    }
    return result;
  };
  return {
    snapshot: () => ({ counters, examples, groups: Object.fromEntries([...groups].map(([id, sources]) => [id, Object.fromEntries(sources)])) }),
    stop() { F.step = originals.step; F.integrate = originals.integrate; C.query = originals.query; W.canFeedAt = originals.anchor; W.plan = originals.windPlan;
      A.course = originals.course; A.intercept = originals.intercept; }
  };
}
if (require.main === module) {
  const days = process.argv.slice(2).map(Number);
  const observer = trace();
  try { require('./replay-carrion-lantern').replay(days.length ? { checkpoints: days } : {}); }
  finally { observer.stop(); console.log(JSON.stringify(observer.snapshot())); }
}
module.exports = { trace };
