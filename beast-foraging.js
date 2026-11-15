// Monthly sustenance budgets, local elapsed actions and single-owner meal claims.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-bodies') : root.HelixBeastBodies);
  if (node) module.exports = api;
  root.HelixBeastForaging = api;
})(globalThis, function (Life, Data, Bodies) {
  'use strict';
  const DAY = 86400, HOUR = 3600, EPS = 1e-8, DECAY = .1, copy = x => JSON.parse(JSON.stringify(x));
  const count = c => c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0);
  const finite = n => Number.isFinite(n) && n >= 0;
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  function initialize(r) {
    if (r.wildlife) r.foraging = { serial: 0, meals: {}, receipts: { searches: 0, searchSeconds: 0,
      eatingSeconds: 0, handlingSeconds: 0, restSeconds: 0, eatenKg: 0, interrupted: 0 } };
  }
  function plan(g, c, month, at) {
    const f = c.foraging ||= { phase: 'idle', nextAt: at + 1e-6, lastAt: at, serial: 0,
      mealIds: [], bout: null, action: null, restPending: 0 };
    if (f.plan?.monthIndex === month.index) return;
    const days = Math.max(0, (month.end - at) / DAY);
    f.plan = { monthIndex: month.index, plannedAt: at, end: month.end,
      limits: { search: days * 6 * HOUR, eating: days * 2 * HOUR, handling: days * HOUR, active: days * 8 * HOUR },
      used: { search: 0, eating: 0, handling: 0, rest: 0 } };
    f.nextAt = Math.min(f.nextAt, at + 1e-6);
  }
  function row(r, meal) {
    return meal.kind === 'wildlife' ? r.wildlife?.pools.find(p => p.id === meal.sourceId)?.carcass
      : r.remains?.[meal.sourceId] || r.remainsBatches?.[meal.sourceId];
  }
  function claim(r, g, c, kind, sourceId, kg, at, position) {
    if (!r.foraging || !(kg > EPS)) return null;
    const candidate = { kind, sourceId }, source = row(r, candidate); if (!source) return null;
    kg = Math.min(kg, Math.max(0, source.edibleKg - (source.reservedKg || 0))); if (!(kg > EPS)) return null;
    const id = `forage-meal:${r.id}:${r.foraging.serial++}`;
    r.foraging.meals[id] = { id, kind, sourceId, groupId: g.id, cohortId: c.id, kg, initialKg: kg,
      consumedKg: 0, decomposedKg: 0, lastAt: at, position: copy(position) };
    source.reservedKg = (source.reservedKg || 0) + kg;
    c.foraging.mealIds.push(id); return id;
  }
  function release(r, c) {
    const f = c.foraging; if (!f || !r.foraging) return;
    for (const id of f.mealIds) {
      const meal = r.foraging.meals[id]; if (!meal) continue;
      const source = row(r, meal); if (source) source.reservedKg = Math.max(0, (source.reservedKg || 0) - meal.kg);
      delete r.foraging.meals[id];
    }
    f.mealIds = [];
  }
  function cancel(r, c, at) {
    const f = c?.foraging; if (!f) return;
    release(r, c); if (f.action) r.foraging.receipts.interrupted++;
    f.action = null; f.bout = null; f.phase = 'idle'; f.nextAt = at + 6 * HOUR;
    delete c.contactBusyUntil;
  }
  function supported(c, g, rate) {
    const p = Data.lifecycle[c.speciesId];
    return (p.foodKgDay === 0 || c.stores.foodKg + c.stores.fatKg > EPS)
      && (p.waterLDay === 0 || c.stores.waterL > EPS || (rate?.supply[g.resources?.waterL || 'waterL'] ?? 0) >= 1);
  }
  const usedActive = f => f.plan.used.search + f.plan.used.eating + f.plan.used.handling;
  const room = (f, kind) => Math.max(0, Math.min(f.plan.limits[kind] - f.plan.used[kind], f.plan.limits.active - usedActive(f)));
  function capacity(c) {
    const p = Data.lifecycle[c.speciesId];
    return Math.min(c.massKg * .25, Math.max(p.foodKgDay * Math.max(2, p.foodReserveDays || 1), p.newbornKg));
  }
  function action(c, phase, at, seconds, data = {}) {
    const f = c.foraging;
    seconds = Math.max(1e-6, Math.min(seconds, f.plan.end - at));
    f.phase = phase; f.action = { phase, startedAt: at, dueAt: at + seconds, ...data }; f.nextAt = at + seconds;
    if (phase === 'search' || phase === 'eating' || phase === 'handling') c.contactBusyUntil = f.nextAt;
    else delete c.contactBusyUntil;
  }
  function activeAt(a, seconds) {
    if (!(a.cycleActive > 0)) return 0;
    const cycle = a.cycleActive + a.cycleRest;
    return Math.floor(seconds / cycle) * a.cycleActive + Math.min(a.cycleActive, seconds % cycle);
  }
  function decayMeal(s, r, meal, at, ratePerDay = 0) {
    const source = row(r, meal), dt = Math.max(0, at - meal.lastAt) / DAY;
    if (!source || !(dt > 0)) return 0;
    const frozen = Math.min(dt, Math.max(0, (source.frozenUntil || 0) - meal.lastAt) / DAY);
    const frozenConsumed = Math.min(meal.kg, ratePerDay * frozen), afterFrozen = meal.kg - frozenConsumed;
    const duration = ratePerDay > 0 ? Math.min(dt - frozen, Math.log1p(DECAY * afterFrozen / ratePerDay) / DECAY) : dt - frozen;
    const consumed = frozenConsumed + ratePerDay * duration;
    const remaining = Math.max(0, afterFrozen * Math.exp(-DECAY * duration) - ratePerDay / DECAY * -Math.expm1(-DECAY * duration));
    const decomposed = Math.max(0, meal.kg - consumed - remaining);
    source.reservedKg = Math.max(0, (source.reservedKg || 0) - consumed - decomposed);
    source.edibleKg = Math.max(0, source.edibleKg - consumed - decomposed);
    source.massKg = Math.max(0, source.massKg - consumed - decomposed);
    source.consumedKg += consumed; source.decomposedKg += decomposed;
    if (meal.kind === 'beast' && s.foodWeb) { s.foodWeb.receipts.consumedKg += consumed; s.foodWeb.receipts.decomposedKg += decomposed; }
    const accepted = Math.min(decomposed, Math.max(0, (r.capacity.detritusKg || 0) - (r.stocks.detritusKg || 0)));
    if (accepted) r.stocks.detritusKg = (r.stocks.detritusKg || 0) + accepted;
    if (decomposed > accepted) { r.outputs ||= {}; r.outputs.forageDecayOverflowKg = (r.outputs.forageDecayOverflowKg || 0) + decomposed - accepted; }
    meal.kg = remaining; meal.consumedKg += consumed; meal.decomposedKg += decomposed; meal.lastAt = at;
    return consumed;
  }
  function integrate(s, r, g, c, from, to, rate) {
    const f = c.foraging; if (!f || !r.foraging || !(to > from) || !count(c)) return;
    const a = f.action, seconds = to - from, n = count(c), restOK = supported(c, g, rate) && !g.transit;
    let active = 0, rest = 0;
    if (f.phase === 'search' && a) {
      const earned = activeAt(a, Math.max(0, to - a.startedAt)) - activeAt(a, Math.max(0, from - a.startedAt));
      rest = restOK ? Math.max(0, seconds - earned) : 0;
      active = Math.min(earned, (c.regional.stamina + rest * .5) / Math.max(.001, a.effortRate),
        a.manaRate > 0 ? c.regional.mana / a.manaRate : Infinity);
      c.regional.stamina = Math.max(0, Math.min(300, c.regional.stamina + rest * .5 - active * a.effortRate));
      c.regional.mana = Math.max(0, c.regional.mana - active * a.manaRate);
      a.earnedSeconds += active;
      f.plan.used.search += active; r.foraging.receipts.searchSeconds += active * n;
    } else if (f.phase === 'eating' && a) {
      f.plan.used.eating += seconds; r.foraging.receipts.eatingSeconds += seconds * n;
    } else if (f.phase === 'handling' && a) {
      f.plan.used.handling += seconds; r.foraging.receipts.handlingSeconds += seconds * n;
    } else if (restOK && !c.contactBusyUntil) {
      rest = seconds; c.regional.stamina = Math.min(300, c.regional.stamina + seconds * .5);
    }
    if (rest > 0) { f.restPending += rest; f.plan.used.rest += rest; r.foraging.receipts.restSeconds += rest * n; }
    if (rest > 0 && g.speciesId !== 'beast:mirror-ape') {
      const p = Data.lifecycle[g.speciesId], capacity = p.manaCapacity * Math.min(1, c.massKg / p.adultKg);
      const mana = Math.min(Math.max(0, capacity - c.regional.mana), rest / 10, c.stores.foodKg / .01);
      const kg = Math.min(c.stores.foodKg, mana * .01); c.regional.mana += kg / .01;
      c.stores.foodKg = Math.max(0, c.stores.foodKg - kg); c.massKg -= kg;
      if (kg > 0) { r.outputs ||= {}; r.outputs.manaRecoveryWasteKg = (r.outputs.manaRecoveryWasteKg || 0) + kg * n; }
    }
    for (const id of f.mealIds) {
      const meal = r.foraging.meals[id]; if (!meal) continue;
      const eaten = decayMeal(s, r, meal, to, f.phase === 'eating' && a?.mealId === id ? a.intakePerDay * n : 0);
      if (eaten > 0) {
        const light = g.speciesId === 'beast:carrion-lantern' ? eaten * .05 : 0;
        c.stores.foodKg += (eaten - light) / n; c.massKg += eaten / n;
        if (light) c.regional.energy.lightKg += light / n;
        r.foraging.receipts.eatenKg += eaten;
      }
    }
    f.lastAt = to;
  }
  function decay(s, r, at) { for (const meal of Object.values(r.foraging?.meals || {})) decayMeal(s, r, meal, at); }
  function travelScale(c) {
    const a = c.foraging?.action;
    return a?.phase === 'search' ? a.cycleActive / (a.cycleActive + a.cycleRest) : 0;
  }
  const intake = c => c.foraging?.phase === 'eating' ? c.foraging.action.intakePerDay * (c.speciesId === 'beast:carrion-lantern' ? .95 : 1) : 0;
  function step(s, r, g, c, at, ctx) {
    const f = c.foraging; if (!f || !r.foraging || !count(c)) return;
    const p = Data.lifecycle[g.speciesId], n = count(c);
    if (g.transit || g.regionId !== r.id || g.will === false || g.willing === false || c.health <= .3 || !ctx.usable) {
      cancel(r, c, at); return;
    }
    if (c.contactBusyUntil > at && !f.action) { f.nextAt = c.contactBusyUntil; return; }
    const old = f.action;
    // Running out of reserves cannot turn a partially elapsed search into a
    // fresh capture opportunity. Unsupported rest earns no effort; any real
    // search already earned resolves once, at its original completion time.
    if (old && old.dueAt > at + EPS) return;
    if (!old && f.nextAt > at + EPS) return;
    if (old) {
      f.action = null; f.phase = 'idle'; delete c.contactBusyUntil;
      if (old.phase === 'search' && old.earnedSeconds > 0) {
        const footprint = (Math.PI * old.senseM ** 2 + old.speed * old.earnedSeconds * Math.min(100, old.senseM) * 2) / 10000;
        const areaHa = r.areaHa * -Math.expm1(-footprint * n / r.areaHa);
        const claims = ctx.capture({ id: old.id, areaHa, depthM: old.depthM, scavenge: old.scavenge,
          success: old.scavenge ? 1 : p.huntSuccess, memberCount: n, guilds: old.guilds }, Math.max(0, capacity(c) - c.stores.foodKg) * n);
        for (const entry of claims) claim(r, g, c, 'wildlife', entry.sourceId, entry.kg, at, ctx.position);
        r.foraging.receipts.searches += n;
        if (f.mealIds.length) { action(c, 'handling', at, Math.min(60, room(f, 'handling'))); return; }
      }
    }
    f.mealIds = f.mealIds.filter(id => {
      const meal = r.foraging.meals[id]; if (meal?.kg > EPS) return true;
      if (meal) { const source = row(r, meal); source.reservedKg = Math.max(0, source.reservedKg - meal.kg); delete r.foraging.meals[id]; }
      return false;
    });
    if (f.mealIds.length && c.stores.foodKg < capacity(c) - EPS && room(f, 'eating') > EPS) {
      const meal = r.foraging.meals[f.mealIds[0]], perDay = p.foodKgDay * DAY / 600;
      const outflow = (c.needs.foodKg || 0) / n * (1 - (s.rates[r.id].supply[g.resources.foodKg] ?? 0));
      const net = perDay * (g.speciesId === 'beast:carrion-lantern' ? .95 : 1) - outflow;
      const frozenDays = Math.max(0, (row(r, meal).frozenUntil || 0) - at) / DAY;
      const untilEmpty = meal.kg <= perDay * n * frozenDays ? meal.kg / (perDay * n) * DAY
        : (frozenDays + Math.log1p(DECAY * (meal.kg - perDay * n * frozenDays) / (perDay * n)) / DECAY) * DAY;
      const untilFull = net > 0 ? (capacity(c) - c.stores.foodKg) / net * DAY : HOUR;
      action(c, 'eating', at, Math.min(room(f, 'eating'), untilEmpty, untilFull, 2 * HOUR), { mealId: meal.id, intakePerDay: perDay }); return;
    }
    if (f.mealIds.length) release(r, c);
    const need = Math.max(p.foodKgDay * .5, (c.needs.foodKg || 0) / n);
    const continuingBout = f.bout && at < f.bout.until - EPS && c.stores.foodKg < capacity(c) - EPS;
    const wantsFood = continuingBout || c.stores.foodKg < need && c.stores.fatKg < Math.max(EPS, c.massKg * .05);
    if (!wantsFood) {
      f.shortageAt = null;
      const use = (c.needs.foodKg || 0) / n * (1 - (s.rates[r.id].supply[g.resources.foodKg] ?? 0));
      const untilHungry = use > EPS ? Math.max(0, c.stores.foodKg - need, c.stores.foodKg + c.stores.fatKg - c.massKg * .05) / use * DAY : DAY;
      f.bout = null; f.nextAt = Math.min(f.plan.end, at + Math.max(60, untilHungry)); return;
    }
    if (room(f, 'search') < 1 || room(f, 'eating') < 1 || room(f, 'handling') < 60 || f.plan.end <= at + EPS) {
      f.nextAt = f.plan.end; return;
    }
    if (c.regional.stamina < 100) {
      if (supported(c, g, s.rates[r.id])) { action(c, 'rest', at, Math.max(1, (300 - c.regional.stamina) / .5)); return; }
      if (c.regional.stamina < 2) { f.nextAt = Math.min(f.plan.end, at + 6 * HOUR); return; }
    }
    const scavenge = g.speciesId === 'beast:carrion-lantern';
    if (!f.bout || at >= f.bout.until) {
      // The monthly elapsed-time/effort budget replaces the former one-hunt-
      // per-day gate. Sparse original-beast duels retain their own opportunity
      // ceiling; they neither multiply kills nor spend this whole cohort's day.
      f.bout = { id: `${g.id}:${c.id}:forage:${f.serial++}`, until: at + 8 * HOUR };
    }
    const a = ctx.actor, b = Bodies.profiles[g.speciesId], aquatic = ['swimming', 'drifting'].includes(a.bodyPhysics.mode);
    if (!aquatic && ctx.position.altitudeM > 2 || r.contactBarriers?.length) { f.nextAt = Math.min(f.plan.end, at + 6 * HOUR); return; }
    const guilds = ctx.guilds(a); if (!guilds.length) { f.nextAt = Math.min(f.plan.end, at + 6 * HOUR); return; }
    const passive = a.bodyPhysics.mode === 'drifting' || a.bodyPhysics.mode === 'flight' && b.form === 'aerostat';
    const effortRate = passive ? .01 : a.bodyPhysics.mode === 'flight' ? b.airCost : a.bodyPhysics.mode === 'burrowing' ? 3 : .5;
    const manaRate = a.bodyPhysics.mode === 'levitation' ? b.levitationCost : 0;
    const cycleActive = Math.min(300, c.regional.stamina * .5 / effortRate, manaRate > 0 ? c.regional.mana / manaRate : Infinity);
    if (cycleActive < 1) { f.nextAt = Math.min(f.plan.end, at + HOUR); return; }
    const cycleRest = supported(c, g, s.rates[r.id]) ? cycleActive * effortRate / .5 : 0;
    const seconds = Math.min(HOUR, f.bout.until - at, room(f, 'search') * (cycleActive + cycleRest) / cycleActive,
      cycleRest ? Infinity : cycleActive);
    const senseM = (aquatic ? Math.max(b.pressureM || 0, b.sightM || 0) : Math.max(b.sightM || 0, b.scentM || 0))
      * Math.max(0, 1 - Bodies.wounded(a, /head|eye|antenna|pressure organ/));
    action(c, 'search', at, seconds, { id: `${f.bout.id}:search:${r.foraging.serial++}`, cycleActive, cycleRest, effortRate, manaRate,
      speed: passive ? 0 : b.speed * Math.max(.1, 1 - Bodies.wounded(a, /leg|limb|wing|fin|tail/) * .8), senseM,
      depthM: aquatic ? Math.min(200, 2 * senseM) : 0, guilds, scavenge, earnedSeconds: 0 });
  }
  function next(c) { return c.foraging?.nextAt ?? Infinity; }
  function valid(s, getGroup) {
    const owned = new Map();
    for (const r of s.regions) {
      const x = r.foraging; if (!x) continue;
      if (!integer(x.serial) || !x.meals || !x.receipts || !Object.values(x.receipts).every(finite)) return false;
      const sums = new Map();
      for (const [id, meal] of Object.entries(x.meals)) {
        const g = getGroup(meal.groupId), c = g?.cohorts.find(c => c.id === meal.cohortId), source = row(r, meal);
        if (meal.id !== id || !c?.foraging?.mealIds.includes(id) || !source || g.regionId !== r.id || g.transit
          || !['wildlife', 'beast'].includes(meal.kind) || !['kg', 'initialKg', 'consumedKg', 'decomposedKg', 'lastAt'].every(k => finite(meal[k]))
          || !meal.position || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(meal.position[k]))
          || meal.position.regionId !== r.id || meal.lastAt > (s.regionClocks?.[r.id]?.appliedAt ?? s.appliedAt) + EPS
          || Math.abs(meal.initialKg - meal.kg - meal.consumedKg - meal.decomposedKg) > 1e-6 * Math.max(1, meal.initialKg)) return false;
        if (owned.has(id)) return false;
        owned.set(id, c); sums.set(source, (sums.get(source) || 0) + meal.kg);
      }
      for (const source of [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {}), ...(r.wildlife?.pools || []).map(p => p.carcass)])
        if (!finite(source.reservedKg || 0) || (source.reservedKg || 0) > source.edibleKg + EPS
          || Math.abs((sums.get(source) || 0) - (source.reservedKg || 0)) > 1e-6 * Math.max(1, source.edibleKg)) return false;
    }
    for (const g of s.groups) for (const c of g.cohorts) if (c.foraging) {
      const f = c.foraging, plan = f.plan;
      const dormant = !count(c) || g.transit || !s.regions.find(r => r.id === g.regionId)?.foraging;
      if (!['idle', 'search', 'handling', 'eating', 'rest'].includes(f.phase) || !finite(f.nextAt) || !dormant && f.nextAt <= s.clock - EPS
        || !finite(f.lastAt) || f.lastAt > s.clock + EPS || !finite(f.restPending) || !integer(f.serial)
        || !plan || !integer(plan.monthIndex) || !finite(plan.plannedAt) || !(plan.end > plan.plannedAt)
        || !plan.used || !['search', 'eating', 'handling', 'rest'].every(k => finite(plan.used[k]))
        || !plan.limits || !['search', 'eating', 'handling', 'active'].every(k => finite(plan.limits[k]))
        || usedActive(f) > plan.limits.active + EPS || ['search', 'eating', 'handling'].some(k => plan.used[k] > plan.limits[k] + EPS)
        || !Array.isArray(f.mealIds) || new Set(f.mealIds).size !== f.mealIds.length || f.mealIds.some(id => owned.get(id) !== c)) return false;
      const elapsed = Math.max(0, f.lastAt - plan.plannedAt), days = (plan.end - plan.plannedAt) / DAY;
      if (usedActive(f) + plan.used.rest > elapsed + 1e-5
        || ['search', 'eating', 'handling', 'active'].some((k, i) => Math.abs(plan.limits[k] - days * [6, 2, 1, 8][i] * HOUR) > 1e-5)
        || f.bout && (typeof f.bout.id !== 'string' || !finite(f.bout.until))
        || ['shortageAt', 'reactedShortageAt'].some(k => f[k] != null && (!finite(f[k]) || f[k] > s.clock + EPS))) return false;
      if (f.phase === 'idle' ? f.action != null : !f.action || f.action.phase !== f.phase || f.action.dueAt !== f.nextAt || !finite(f.action.startedAt)
        || f.action.startedAt > (s.regionClocks?.[g.regionId]?.appliedAt ?? s.appliedAt) + EPS) return false;
      if (['search', 'eating', 'handling'].includes(f.phase) && c.contactBusyUntil !== f.nextAt) return false;
      const a = f.action;
      if (a && (!finite(a.dueAt) || !(a.dueAt > a.startedAt) || a.dueAt > plan.end + EPS)) return false;
      if (a?.phase === 'eating' && (!f.mealIds.includes(a.mealId) || a.intakePerDay !== Data.lifecycle[c.speciesId].foodKgDay * DAY / 600
        || a.dueAt - a.startedAt > 2 * HOUR + EPS)) return false;
      if (a?.phase === 'handling' && a.dueAt - a.startedAt > 60 + EPS) return false;
      if (a?.phase === 'search') {
        const r = s.regions.find(r => r.id === g.regionId), b = Bodies.profiles[c.speciesId];
        if (typeof a.id !== 'string' || !['cycleActive', 'cycleRest', 'effortRate', 'manaRate', 'speed', 'senseM', 'depthM', 'earnedSeconds'].every(k => finite(a[k]))
          || !(a.cycleActive >= 1 && a.cycleActive <= 300) || !(a.effortRate > 0) || a.speed > b.speed + EPS
          || a.dueAt - a.startedAt > HOUR + EPS || typeof a.scavenge !== 'boolean'
          || a.earnedSeconds > activeAt(a, Math.max(0, f.lastAt - a.startedAt)) + 1e-5
          || !Array.isArray(a.guilds) || new Set(a.guilds).size !== a.guilds.length
          || a.guilds.some(id => !r?.wildlife?.pools.some(p => p.id === id))) return false;
      }
    }
    return true;
  }
  function summary(s) {
    const result = { searches: 0, searchSeconds: 0, eatingSeconds: 0, handlingSeconds: 0, restSeconds: 0, eatenKg: 0, interrupted: 0, meals: 0 };
    for (const r of s.regions) if (r.foraging) {
      for (const key of Object.keys(r.foraging.receipts)) result[key] += r.foraging.receipts[key];
      result.meals += Object.keys(r.foraging.meals).length;
    }
    return result;
  }
  return { initialize, plan, claim, cancel, supported, integrate, decay, step, next, travelScale, intake, valid, summary, capacity };
});
