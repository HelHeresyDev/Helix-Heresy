// Finite, local family/colony provisioning. No per-child planner or new bodies.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-demography') : root.HelixBeastDemography,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-foraging') : root.HelixBeastForaging,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys);
  if (node) module.exports = api;
  root.HelixBeastParentalCare = api;
})(globalThis, function (Data, D, Bodies, Foraging, Journeys) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, EFFICIENCY = .8, WATER_EFFICIENCY = .95;
  const family = new Set(['ashhorn-behemoth', 'glasswing-roc', 'nullmaw-stalker', 'thunderback-grazer',
    'gloam-prowler', 'rimefang-pack', 'frostwake-leviathan', 'mirror-ape', 'gravebloom-elk'].map(id => `beast:${id}`));
  const mode = id => id === 'beast:ember-ant' ? 'colony' : family.has(id) ? 'family' : 'self';
  const n = c => D.size(c.ranges), finite = x => Number.isFinite(x) && x >= 0;
  const dependent = (c, at) => Boolean(c.dependency && at - c.bornAt < Data.lifecycle[c.speciesId].independentDays * DAY);
  function target(c, key) {
    const p = Data.lifecycle[c.speciesId], scale = (c.massKg / p.adultKg) ** .75 * p.juvenileMultiplier;
    return Math.min(c.massKg * (key === 'foodKg' ? .25 : .1), p[key === 'foodKg' ? 'foodKgDay' : 'waterLDay'] * scale * 2);
  }
  function review(c, at, key, deficit) {
    if (!dependent(c, at) || !['foodKg', 'waterL'].includes(key) || !(deficit > EPS)) return Infinity;
    const remaining = c.stores[key] - target(c, key) * .5;
    // Growth changes the threshold slightly. A one-minute review floor avoids
    // asymptotic micro-events without awarding a single second of future care.
    return remaining > EPS ? at + Math.max(60, remaining / deficit * DAY) : Infinity;
  }
  const reach = c => Math.max(20, Bodies.profiles[c.speciesId].lengthM * 4,
    Bodies.profiles[c.speciesId].hearingM, Bodies.profiles[c.speciesId].scentM);
  function attach(g, child, at, origins = null) {
    if (!['family', 'colony'].includes(g.parentalCare) || at - child.bornAt >= Data.lifecycle[child.speciesId].independentDays * DAY) return;
    const guardians = (g.parentalCare !== 'colony' && origins) || g.cohorts.filter(c => c !== child && n(c) && at - c.bornAt >= Data.lifecycle[c.speciesId].independentDays * DAY
      && c.massKg >= Data.lifecycle[c.speciesId].adultKg * .3 && (g.parentalCare !== 'colony' || c.role === 'worker' && c.colonyId === child.colonyId)).map(c => c.originId);
    child.dependency = { mode: g.parentalCare, guardians: [...new Set(guardians.filter(Boolean))], establishedAt: at };
  }
  function initialize(s) {
    for (const g of s.groups) if (g.parentalCare) for (const child of g.cohorts) attach(g, child, s.clock);
  }
  function ledger(c, month, at) {
    if (c.parentalLedger?.monthIndex !== month.index) c.parentalLedger = { monthIndex: month.index, plannedAt: at, end: month.end,
      limitSeconds: (month.end - at) / 12, usedSeconds: 0, givenFoodKg: 0, givenWaterL: 0, foodInputKg: 0, waterInputL: 0, cancelled: 0 };
    return c.parentalLedger;
  }
  function eligible(g, donor, child, at) {
    return n(donor) && donor.health > .3 && !dependent(donor, at) && donor.massKg >= Data.lifecycle[donor.speciesId].adultKg * .3
      && child.dependency.guardians.includes(donor.originId) && (child.dependency.mode !== 'colony' || donor.role === 'worker' && donor.colonyId === child.colonyId);
  }
  function near(g, donor, child, r, bounds) {
    if (r.contactBarriers?.length) return false; // No assumed path through unresolved local obstacles.
    const a = bounds(g, r, donor), b = bounds(g, r, child); if (!a || !b || a.regionId !== b.regionId) return false;
    return Math.hypot(...['eastM', 'northM', 'altitudeM'].map(k => Math.max(Math.abs(a.min[k] - b.max[k]), Math.abs(a.max[k] - b.min[k])))) <= reach(donor);
  }
  function demand(s, at, bounds) {
    for (const g of s.groups) {
      for (const c of g.cohorts) if (c.provisioningDemandKgDay) c.provisioningDemandKgDay = 0;
      if (!['family', 'colony'].includes(g.parentalCare) || Journeys.moving(g)) continue;
      const r = D.region(s, Journeys.location(g));
      for (const child of g.cohorts) if (dependent(child, at) && n(child)) {
        const donors = g.cohorts.filter(c => eligible(g, c, child, at) && near(g, c, child, r, bounds));
        const count = donors.reduce((v, c) => v + n(c), 0);
        const p = Data.lifecycle[child.speciesId], need = p.foodKgDay * (child.massKg / p.adultKg) ** .75 * p.juvenileMultiplier * n(child);
        if (count) for (const c of donors) c.provisioningDemandKgDay = (c.provisioningDemandKgDay || 0) + need / count / EFFICIENCY;
      }
      for (const c of g.cohorts) if (c.provisioningDemandKgDay > 0 && c.foraging?.phase === 'idle' && !c.foraging.action
        && c.stores.foodKg < (c.needs.foodKg || 0) / Math.max(1, n(c)) + c.provisioningDemandKgDay)
        c.foraging.nextAt = Math.min(c.foraging.nextAt, at + 60);
    }
  }
  function cancel(g, c, at) {
    const a = c.caregiving; if (!a) return;
    if (c.contactBusyUntil === a.until) delete c.contactBusyUntil;
    if (c.parentalLedger && at < a.until - EPS) c.parentalLedger.cancelled++;
    c.caregiving = null; if (c.regional) c.regional.at = at;
  }
  function cancelAffected(g, changed, at) {
    for (const c of g.cohorts) if (c === changed || c.caregiving?.childId === changed.id) cancel(g, c, at);
  }
  function finish(s, at) {
    for (const g of s.groups) for (const c of g.cohorts) if (c.caregiving?.until <= at + EPS) cancel(g, c, at);
  }
  function start(s, at, bounds, restore = () => {}, capable = () => true, onlyGroup = null, onlyDonor = null) {
    const month = Journeys.monthAt(s.calendar, at);
    for (const g of s.groups) {
      if (onlyGroup && g.id !== onlyGroup) continue;
      if (!['family', 'colony'].includes(g.parentalCare) || Journeys.moving(g) || g.will === false || g.willing === false) continue;
      const r = D.region(s, Journeys.location(g)), assigned = new Set(g.cohorts.filter(c => c.caregiving).map(c => c.caregiving.childId));
      const children = g.cohorts.filter(child => dependent(child, at) && n(child) && !assigned.has(child.id));
      if (!children.length) continue;
      for (const donor of g.cohorts) {
        if (onlyDonor && donor.id !== onlyDonor) continue;
        if (children.some(child => eligible(g, donor, child, at))) restore(donor, g, r, at);
        if (!n(donor) || donor.caregiving || donor.contactBusyUntil > at || donor.foraging?.action
          || donor.regional?.stamina < 2 || !Foraging.canRest(donor, g, r) || g.activityState?.sleeping || !capable(donor, g, r, at)) continue;
        for (const child of children) if (!assigned.has(child.id)
          && eligible(g, donor, child, at) && near(g, donor, child, r, bounds)) {
          const p = Data.lifecycle[donor.speciesId], budget = ledger(donor, month, at), count = n(donor), children = n(child);
          const scale = (donor.massKg / p.adultKg) ** .75;
          const foodTarget = target(child, 'foodKg'), waterTarget = target(child, 'waterL');
          // Hysteresis: complete a useful feeding, then wait for actual hunger
          // or thirst. Metabolism/growth cannot trigger a fresh top-up action
          // for every microscopic gap below a full stomach.
          if (!(foodTarget > 0 && child.stores.foodKg <= foodTarget * .5 + EPS
            || waterTarget > 0 && child.stores.waterL <= waterTarget * .5 + EPS)) continue;
          const food = Math.max(0, foodTarget - child.stores.foodKg) * children / EFFICIENCY;
          const water = Math.max(0, waterTarget - child.stores.waterL) * children / WATER_EFFICIENCY;
          if (!(food + water > EPS)) continue;
          const reserve = Math.max(EPS, (donor.needs.foodKg || 0) / count), spare = Math.max(0, donor.stores.foodKg - reserve) * count;
          const foodSource = spare > EPS ? 'stores' : 'regional';
          const availableFood = foodSource === 'stores' ? spare : r.stocks[g.resources?.foodKg || 'foodKg'] || 0;
          const availableWater = r.stocks[g.resources?.waterL || 'waterL'] || 0;
          // Missing food must not trigger endless microscopic WATER top-ups
          // that prevent a caregiver from obtaining the missing food itself.
          if (!(child.stores.foodKg <= foodTarget * .5 + EPS && availableFood > EPS
            || child.stores.waterL <= waterTarget * .5 + EPS && availableWater > EPS)) continue;
          const foodRate = p.foodKgDay * scale * DAY / 600 * count, waterRate = p.waterLDay * scale * DAY / 600 * count;
          const needed = Math.max(foodRate ? Math.min(food, availableFood) / foodRate * DAY : 0,
            waterRate ? Math.min(water, availableWater) / waterRate * DAY : 0);
          if (!(needed > EPS)) continue;
          // Tiny colonies still spend a real handling interval. Round time UP,
          // lowering the delivered rate, never round away their actual ration.
          const seconds = Math.min(600, budget.limitSeconds - budget.usedSeconds, budget.end - at,
            g.transit?.stop ? g.transit.stop.until - at : Infinity, donor.regional.stamina / .1, Math.max(60, needed));
          if (!(seconds >= 1)) continue;
          const foodPerDay = Math.min(foodRate, food / seconds * DAY, availableFood / seconds * DAY);
          const waterPerDay = Math.min(waterRate, water / seconds * DAY, availableWater / seconds * DAY);
          if (!(foodPerDay + waterPerDay > EPS)) continue;
          donor.caregiving = { childId: child.id, memberCount: count, childCount: children, startedAt: at, until: at + seconds,
            foodSource, foodPerDay, waterPerDay, reserveKg: reserve };
          donor.contactBusyUntil = at + seconds; assigned.add(child.id); break;
        }
      }
    }
  }
  function requests(s, g, c, at, capable = () => true) {
    const a = c.caregiving, child = a && D.cohort(s, g.id, a.childId);
    if (!a || a.until <= at + EPS || !child || !n(child) || Journeys.moving(g) || g.will === false || g.willing === false
      || n(c) !== a.memberCount || n(child) !== a.childCount || !dependent(child, at) || !Foraging.supported(c, g, s.rates[Journeys.location(g)])
      || c.health <= .3 || g.activityState?.sleeping || !capable(c, g, D.region(s, Journeys.location(g)), at)
      || a.foodSource === 'stores' && c.stores.foodKg <= a.reserveKg + EPS) {
      if (a) cancel(g, c, at); return [];
    }
    return [{ kind: 'care', g, c, perDay: 1, childId: child.id, recipe: {
      ...(a.foodSource === 'regional' && a.foodPerDay > 0 ? { [g.resources?.foodKg || 'foodKg']: a.foodPerDay } : {}),
      ...(a.waterPerDay > 0 ? { [g.resources?.waterL || 'waterL']: a.waterPerDay } : {}) } }];
  }
  function delivered(s, q) {
    const g = q.g || D.group(s, q.groupId), c = q.c || D.cohort(s, g.id, q.cohortId), a = c.caregiving;
    return { g, c, a, child: D.cohort(s, g.id, q.childId) };
  }
  function prepare(s, list, at, next, rates) {
    for (const g of s.groups) for (const c of g.cohorts) if (c.careIntake) { c.careIntake.foodKg = 0; c.careIntake.waterL = 0; }
    for (const q of list) if (q.kind === 'care') {
      const { g, c, a, child } = delivered(s, q), count = n(c);
      child.careIntake ||= { foodKg: 0, waterL: 0 };
      next = Math.min(next, a.until, child.bornAt + Data.lifecycle[child.speciesId].independentDays * DAY);
      child.careIntake.foodKg += a.foodPerDay * q.factor * EFFICIENCY / n(child);
      child.careIntake.waterL += a.waterPerDay * q.factor * WATER_EFFICIENCY / n(child);
      if (a.foodSource === 'stores' && a.foodPerDay * q.factor > EPS) {
        const rate = rates[Journeys.location(g)], ownUse = (c.needs.foodKg || 0) * (1 - (rate.supply[g.resources?.foodKg || 'foodKg'] ?? 0));
        next = Math.min(next, at + Math.max(0, c.stores.foodKg - a.reserveKg) * count / (a.foodPerDay * q.factor + ownUse) * DAY);
      }
    }
    return next;
  }
  function integrate(s, q, days) {
    const { g, c, a, child } = delivered(s, q), r = D.region(s, Journeys.location(g)), count = n(c), children = n(child);
    const food = a.foodPerDay * q.factor * days, water = a.waterPerDay * q.factor * days;
    if (a.foodSource === 'stores') { c.stores.foodKg = Math.max(0, c.stores.foodKg - food / count); c.massKg -= food / count; }
    child.stores.foodKg += food * EFFICIENCY / children; child.stores.waterL += water * WATER_EFFICIENCY / children;
    child.massKg += (food * EFFICIENCY + water * WATER_EFFICIENCY) / children;
    const b = c.parentalLedger; b.foodInputKg += food; b.waterInputL += water; b.givenFoodKg += food * EFFICIENCY; b.givenWaterL += water * WATER_EFFICIENCY;
    const receipt = receipts(r); receipt.foodInputKg += food; receipt.waterInputL += water;
    receipt.givenFoodKg += food * EFFICIENCY; receipt.givenWaterL += water * WATER_EFFICIENCY;
    r.outputs ||= {}; r.outputs.provisioningWasteKg = (r.outputs.provisioningWasteKg || 0) + food * (1 - EFFICIENCY) + water * (1 - WATER_EFFICIENCY);
  }
  function receipts(r) { return r.careReceipts ||= { foodInputKg: 0, waterInputL: 0, givenFoodKg: 0, givenWaterL: 0, memberSeconds: 0 }; }
  function effort(c, seconds, r) {
    if (!c.caregiving) return;
    c.parentalLedger.usedSeconds += seconds; c.regional.stamina = Math.max(0, c.regional.stamina - seconds * .1);
    receipts(r).memberSeconds += seconds * n(c);
  }
  const intake = (c, key) => c.careIntake?.[key] || 0;
  function waiting(s, g, at, bounds, capable) {
    if (g.will === false || g.willing === false || g.activityState?.sleeping) return false;
    const r = D.region(s, Journeys.location(g)), month = Journeys.monthAt(s.calendar, at);
    for (const child of g.cohorts) if (n(child) && dependent(child, at)) {
      const p = Data.lifecycle[child.speciesId], scale = (child.massKg / p.adultKg) ** .75 * p.juvenileMultiplier;
      const food = child.stores.foodKg + child.stores.fatKg < Math.min(child.massKg * .125, p.foodKgDay * scale * .5);
      const water = child.stores.waterL < Math.min(child.massKg * .05, p.waterLDay * scale * .5);
      for (const donor of g.cohorts) if (eligible(g, donor, child, at) && near(g, donor, child, r, bounds)
        && donor.regional?.stamina >= 2 && capable(donor, g, r, at)
        && (donor.parentalLedger?.monthIndex !== month.index || donor.parentalLedger.usedSeconds + 1 < donor.parentalLedger.limitSeconds)) {
        if (donor.caregiving) return true;
        const spare = donor.stores.foodKg > (donor.needs.foodKg || 0) / n(donor) + EPS;
        if (food && (spare || (r.stocks[g.resources?.foodKg || 'foodKg'] || 0) > EPS)
          || water && (r.stocks[g.resources?.waterL || 'waterL'] || 0) > EPS) return true;
      }
    }
    return false;
  }
  function situation(s, g, child, at, bounds, capable) {
    const r = D.region(s, Journeys.location(g)), month = Journeys.monthAt(s.calendar, at);
    const guardians = g.cohorts.filter(c => n(c) && child.dependency?.guardians.includes(c.originId));
    const local = guardians.filter(c => eligible(g, c, child, at) && near(g, c, child, r, bounds));
    const able = local.filter(c => c.regional?.stamina >= 2 && capable(c, g, r, at));
    const total = rows => rows.reduce((sum, c) => sum + n(c), 0);
    return { guardians: total(guardians), local: total(local), capable: total(able),
      free: total(able.filter(c => !c.caregiving && !c.foraging?.action && !(c.contactBusyUntil > at))),
      remainingMemberSeconds: able.reduce((sum, c) => sum + n(c) * (c.parentalLedger?.monthIndex === month.index
        ? Math.max(0, c.parentalLedger.limitSeconds - c.parentalLedger.usedSeconds) : (month.end - at) / 12), 0),
      availableFoodKg: (r.stocks[g.resources?.foodKg || 'foodKg'] || 0) + local.reduce((sum, c) => sum
        + Math.max(0, c.stores.foodKg - (c.needs.foodKg || 0) / n(c)) * n(c), 0),
      availableWaterL: r.stocks[g.resources?.waterL || 'waterL'] || 0,
      willing: g.will !== false && g.willing !== false, sleeping: g.activityState?.sleeping === true };
  }
  function valid(s) {
    for (const r of s.regions) if (r.careReceipts && (!['foodInputKg', 'waterInputL', 'givenFoodKg', 'givenWaterL', 'memberSeconds'].every(k => finite(r.careReceipts[k]))
      || Math.abs(r.careReceipts.givenFoodKg - r.careReceipts.foodInputKg * EFFICIENCY) > 1e-6 * Math.max(1, r.careReceipts.foodInputKg)
      || Math.abs(r.careReceipts.givenWaterL - r.careReceipts.waterInputL * WATER_EFFICIENCY) > 1e-6 * Math.max(1, r.careReceipts.waterInputL))) return false;
    for (const g of s.groups) {
      const children = new Set();
      if (g.parentalCare != null && g.parentalCare !== mode(g.speciesId)) return false;
      for (const c of g.cohorts) {
        const d = c.dependency, b = c.parentalLedger, a = c.caregiving;
        if (d && (d.mode !== g.parentalCare || !['family', 'colony'].includes(d.mode) || !finite(d.establishedAt) || d.establishedAt > s.clock
          || !Array.isArray(d.guardians) || new Set(d.guardians).size !== d.guardians.length || d.guardians.some(id => s.origins[id]?.populationId !== g.populationId))) return false;
        if (b && (!Number.isInteger(b.monthIndex) || !finite(b.plannedAt) || b.plannedAt > s.clock || !(b.end > b.plannedAt)
          || !['limitSeconds', 'usedSeconds', 'givenFoodKg', 'givenWaterL', 'foodInputKg', 'waterInputL', 'cancelled'].every(k => finite(b[k]))
          || b.usedSeconds > b.limitSeconds + EPS || b.usedSeconds > s.clock - b.plannedAt + EPS
          || !Number.isSafeInteger(b.cancelled) || Math.abs(b.limitSeconds - (b.end - b.plannedAt) / 12) > EPS
          || Math.abs(b.givenFoodKg - b.foodInputKg * EFFICIENCY) > 1e-6 * Math.max(1, b.foodInputKg)
          || Math.abs(b.givenWaterL - b.waterInputL * WATER_EFFICIENCY) > 1e-6 * Math.max(1, b.waterInputL))) return false;
        if (c.careIntake && !['foodKg', 'waterL'].every(k => finite(c.careIntake[k])) || c.provisioningDemandKgDay != null && !finite(c.provisioningDemandKgDay)) return false;
        if (a && (!b || !finite(a.startedAt) || a.startedAt > s.clock || !(a.until > s.clock - EPS) || a.until - a.startedAt > 600 + EPS
          || c.contactBusyUntil !== a.until || Journeys.moving(g) || a.memberCount !== n(c) || !['regional', 'stores'].includes(a.foodSource)
          || !['foodPerDay', 'waterPerDay', 'reserveKg'].every(k => finite(a[k]))
          || c.foraging?.action || children.has(a.childId)
          || a.foodPerDay > Data.lifecycle[c.speciesId].foodKgDay * DAY / 600 * n(c) * 2 + EPS
          || a.waterPerDay > Data.lifecycle[c.speciesId].waterLDay * DAY / 600 * n(c) * 2 + EPS
          || !g.cohorts.some(child => child.id === a.childId && dependent(child, s.clock) && n(child) === a.childCount && child.dependency.guardians.includes(c.originId)))) return false;
        if (a) children.add(a.childId);
      }
    }
    for (const q of s.extraRates || []) if (q.kind === 'care') {
      const { g, a } = delivered(s, q); if (!a) return false;
      const expected = { ...(a.foodSource === 'regional' && a.foodPerDay > 0 ? { [g.resources?.foodKg || 'foodKg']: a.foodPerDay } : {}),
        ...(a.waterPerDay > 0 ? { [g.resources?.waterL || 'waterL']: a.waterPerDay } : {}) };
      if (Object.keys(q.inputs).length !== Object.keys(expected).length || Object.entries(expected).some(([k, amount]) => q.inputs[k] !== amount)) return false;
    }
    return true;
  }
  function summary(s) {
    const result = { foodInputKg: 0, waterInputL: 0, givenFoodKg: 0, givenWaterL: 0, memberSeconds: 0, dependentLiving: 0 };
    for (const r of s.regions) for (const [key, amount] of Object.entries(r.careReceipts || {})) result[key] += amount;
    for (const g of s.groups) for (const c of g.cohorts) if (dependent(c, s.clock)) result.dependentLiving += n(c);
    return result;
  }
  return { mode, dependent, attach, initialize, demand, start, finish, cancelAffected, requests, prepare, integrate, effort, intake, waiting, review, situation, valid, summary, EFFICIENCY, WATER_EFFICIENCY };
});
