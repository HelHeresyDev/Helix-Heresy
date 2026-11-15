// #3.38-D internal account model. Native source/encounter adapters are unfinished;
// this module alone is not a claim of live regional simulation or encounter coverage.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys,
    node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./beast-predation') : root.HelixBeastPredation,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-demography') : root.HelixBeastDemography,
    node ? require('./beast-regional-ecology') : root.HelixBeastRegionalEcology,
    node ? require('./beast-regional-foodweb') : root.HelixBeastRegionalFoodweb,
    node ? require('./beast-population-scheduler') : root.HelixBeastPopulationScheduler,
    node ? require('./background-wildlife') : root.HelixBackgroundWildlife,
    node ? require('./beast-foraging') : root.HelixBeastForaging);
  if (node) module.exports = api;
  root.HelixBeastPopulations = api;
})(globalThis, function (Biology, Life, Journeys, Wilderness, Predation, Bodies, Demography, Ecology, Foodweb, Scheduler, Wildlife, Foraging) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
  const diagnosticToken = Symbol('private generated-source replay');
  const nonnegative = n => Number.isFinite(n) && n >= 0;
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const id = s => typeof s === 'string' && s.length > 0 && s !== 'prototype'
    && !Object.prototype.hasOwnProperty.call(Object.prototype, s);
  const count = c => c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0);
  const cohortKey = (c, ordinal) => `${c.originId || c.id}:${ordinal}`;
  const monthAt = Journeys.monthAt;
  function remove(c, ordinal) {
    const index = c.ranges.findIndex(([lo, hi]) => ordinal >= lo && ordinal < hi);
    if (index < 0) return false;
    const [lo, hi] = c.ranges[index], replacements = [];
    if (lo < ordinal) replacements.push([lo, ordinal]);
    if (ordinal + 1 < hi) replacements.push([ordinal + 1, hi]);
    c.ranges.splice(index, 1, ...replacements); return true;
  }
  function ordinalAt(c, rank) {
    for (const [lo, hi] of c.ranges) { if (rank < hi - lo) return lo + rank; rank -= hi - lo; }
    return null;
  }
  const exponential = seed => -Math.log(1 - (Life.random(seed) + .5 / 4294967296));
  function cohort(source, at) {
    const p = Biology.lifecycle[source.speciesId];
    if (!p || !id(source.id) || !integer(source.count) || !nonnegative(source.ageDays)
      || !(source.massKg > 0) || !Number.isFinite(source.massKg) || !Ecology.Work.towersValid(source)) throw Error('Invalid original cohort');
    const waterL = Math.min(source.massKg * .1, p.waterLDay * (p.waterReserveDays || 0));
    const fatKg = Math.min(source.massKg * .1, p.foodKgDay * (p.foodReserveDays || 0));
    return { id: source.id, originId: source.id, speciesId: source.speciesId, ranges: source.count ? [[0, source.count]] : [],
      bornAt: at - source.ageDays * DAY, massKg: source.massKg, structuralKg: source.massKg - waterL - fatKg,
      stores: { waterL, fatKg, foodKg: 0, mineralsKg: 0 }, role: source.role || 'individual', sex: source.sex || null,
      colonyId: source.colonyId || null, health: 1, deathSerial: 0, deathExposure: 0,
      ...(source.nurseryId ? { nurseryId: source.nurseryId } : {}),
      ...(source.feedingTowers ? { feedingTowers: copy(source.feedingTowers) } : {}),
      deathThreshold: exponential(`${source.id}:background:0`),
      ...(source.count > 128 || source.aggregateMortality === true ? { aggregateMortality: true, mortalityBalance: Life.random(`${source.id}:mortality-offset`),
        batchHazard: 0, batchMembers: source.count } : {}) };
  }
  function hazardIntegral(c, from, to) {
    if (!(to > from)) return 0;
    const p = Biology.lifecycle[c.speciesId], queen = c.role === 'queen';
    const adult = p.adultDays, ageing = queen ? p.breederAgeingDays : p.ageingDays;
    const doubling = queen ? p.breederDoublingDays : p.doublingDays;
    const juvenile = p.juvenileMortality / 1000, mature = (queen ? p.breederMortality : p.adultMortality) / 1000;
    let age = Math.max(0, (from - c.bornAt) / DAY), end = Math.max(age, (to - c.bornAt) / DAY), result = 0;
    if (age < adult) { const until = Math.min(adult, end); result += (until - age) * juvenile; age = until; }
    if (age < end && (ageing == null || age < ageing)) {
      const until = ageing == null ? end : Math.min(ageing, end); result += (until - age) * mature; age = until;
    }
    if (age < end) {
      const k = Math.LN2 / doubling;
      result += mature / k * Math.exp(k * (age - ageing)) * Math.expm1(k * (end - age));
    }
    return result;
  }
  function nextDeath(c, from, until) {
    if (c.aggregateMortality) return Infinity;
    const n = count(c), remaining = c.deathThreshold - c.deathExposure;
    if (!n || hazardIntegral(c, from, until) * n + EPS < remaining) return Infinity;
    let lo = from, hi = until;
    for (let i = 0; i < 48; i++) {
      const middle = (lo + hi) / 2;
      if (hazardIntegral(c, from, middle) * n >= remaining) hi = middle; else lo = middle;
    }
    return hi;
  }
  function validateSource(source) {
    if (!id(source?.id) || !Array.isArray(source.groups) || !Array.isArray(source.regions)) throw Error('Missing population source');
    Foodweb.validateSource(source);
    monthAt(source.calendar, 0);
    if (source.unlocated && (!Array.isArray(source.unlocated) || source.unlocated.some(row => !id(row.populationId)
      || !Biology.lifecycle[row.speciesId] || row.count != null && !integer(row.count)))) throw Error('Invalid original unlocated capacity');
    const regions = new Set(), groups = new Set(), cohorts = new Set();
    for (const r of source.regions) {
      if (!id(r.id) || regions.has(r.id) || !(r.areaHa > 0) || !Number.isFinite(r.areaHa) || !r.stocks || !r.capacity || !r.renewalPerDay
        || !Object.values(r.stocks).every(nonnegative) || !Object.values(r.capacity).every(nonnegative)
        || !Object.values(r.renewalPerDay).every(nonnegative) || !Array.isArray(r.edges)) throw Error('Invalid physical region');
      for (const [key, amount] of Object.entries(r.stocks)) if (amount > (r.capacity[key] ?? 0)) throw Error('Stock exceeds original capacity');
      if (r.seasons && (r.seasons.length !== source.calendar.monthDays.length
        || !r.seasons.every(s => s.renewal && Object.values(s.renewal).every(nonnegative)))) throw Error('Invalid actual seasonal supply');
      if (r.nurseries && (!Array.isArray(r.nurseries) || new Set(r.nurseries.map(n => n.id)).size !== r.nurseries.length
        || r.nurseries.some(n => !id(n.id) || !Biology.lifecycle[n.speciesId] || !integer(n.capacity)
          || !Array.isArray(n.phases) || n.phases.some(i => !integer(i) || i >= source.calendar.monthDays.length)))) throw Error('Invalid sourced nursery');
      if (!Wildlife.validDefinition(r)) throw Error('Invalid original background wildlife');
      Ecology.validate(r); regions.add(r.id);
    }
    for (const r of source.regions) for (const edge of r.edges) if (!regions.has(edge.id) || !(edge.distanceKm > 0) || !Number.isFinite(edge.distanceKm)
      || typeof edge.traversable !== 'boolean') throw Error('Invalid regional edge');
    for (const g of source.groups) {
      if (!id(g.id) || groups.has(g.id) || !id(g.populationId) || !regions.has(g.regionId)
        || !Array.isArray(g.cohorts) || !Biology.lifecycle[g.speciesId]) throw Error('Invalid population group');
      groups.add(g.id);
      Ecology.validateGroup(g, source.regions);
      if (!Journeys.validSpec(g, source.calendar, source.diagnosticOnly === true)) throw Error('Invalid original seasonal route');
      for (const c of g.cohorts) {
        if (c.speciesId !== g.speciesId || cohorts.has(c.id)) throw Error('Conflicting cohort source');
        if (c.role === 'queen' && (!id(c.colonyId) || !nonnegative(Biology.lifecycle[c.speciesId].breederMortality)
          || !(c.massKg >= Biology.lifecycle[c.speciesId].breederKg * .8))) throw Error('No original queen body/colony source');
        cohort(c, 0); cohorts.add(c.id);
      }
    }
    Ecology.Work.validateLinks(source); return source;
  }
  function create(source, binding, at = 0, token = null) {
    if (source?.diagnosticOnly && token !== diagnosticToken) throw Error('An unaccepted generator proposal cannot create an active population account');
    validateSource(source);
    if (!id(binding?.worldId) || !id(binding.runId) || !nonnegative(at)) throw Error('Missing run binding');
    const s = { ...binding, sourceId: source.id, calendar: copy(source.calendar), clock: at, appliedAt: at,
      ...(token === diagnosticToken ? { diagnosticOnly: true } : {}), unlocated: copy(source.unlocated || []),
      ...(source.regionalFoodWeb === true ? { regionalFoodWeb: true } : {}),
      regions: copy(source.regions), groups: source.groups.map(g => ({ ...copy(g), cohorts: g.cohorts.map(c => cohort(c, at)),
        knowledge: copy(g.knowledge || []), choiceSerial: 0, intention: null, transit: null, observedShortage: false })),
      details: {}, losses: [], lossBatches: [], births: [], plans: [], events: [], nextEventAt: at,
      nextDemographyAt: (Math.floor(at / DAY) + 1) * DAY, work: { boundaries: 0, cohortIntervals: 0 } };
    s.originalCounts = {};
    for (const g of source.groups) s.originalCounts[g.populationId] = (s.originalCounts[g.populationId] || 0) + g.cohorts.reduce((n, c) => n + c.count, 0);
    s.origins = Object.fromEntries(source.groups.flatMap(g => g.cohorts.map(c => [c.id,
      { populationId: g.populationId, speciesId: c.speciesId, count: c.count }])));
    for (const r of s.regions) Wildlife.initialize(r, at);
    Ecology.initialize(s); Foodweb.initialize(s, source.regionalFoodWeb === true); plan(s, at);
    Scheduler.initialize(s, schedulerOps); return s;
  }
  function createDiagnostic(source, binding, at = 0) {
    if (source?.diagnosticOnly !== true) throw Error('A diagnostic replay requires an explicitly unaccepted source');
    return create(source, binding, at, diagnosticToken);
  }
  function record(s, kind, at, detail) {
    s.events.push({ kind, at, ...detail }); if (s.events.length > 256) s.events.shift();
  }
  // The policy receives deliberately limited observations, never a region stock,
  // incoming group roster, target carrying capacity or private physical map.
  function chooseDestination(policy, observations, seed) {
    if (policy?.mode === 'instinctive') return policy.route?.[policy.cursor || 0] || null;
    const usable = (observations || []).filter(o => id(o.id) && o.encountered !== false);
    const informed = policy?.mode === 'informed' ? usable.filter(o => o.learnedAt != null && o.learnedAt <= policy.at) : [];
    const options = informed.length ? informed : usable;
    return options.length ? options[Math.floor(Life.random(seed) * options.length)].id : null;
  }
  function scheduleDeparture(s, g, at, month) {
    if (g.will === false || Journeys.configured(g) && g.seasonal?.active && g.seasonal.active.status !== 'blocked') return;
    const here = s.regions.find(r => r.id === g.regionId);
    const policy = { ...(Journeys.configured(g) ? { mode: 'forcedDispersal' } : g.instinct || { mode: 'forcedDispersal' }), at };
    const observations = here.edges.map(edge => ({ id: edge.id, encountered: true,
      learnedAt: g.knowledge.find(k => k.regionId === edge.id)?.at ?? null }));
    const serial = g.choiceSerial++;
    const destination = chooseDestination(policy, observations, `${g.id}:choice:${serial}`);
    if (destination) g.intention = { destination, chosenAt: at,
      departAt: at + (month.end - at) * (.05 + .9 * Life.random(`${g.id}:departure:${month.index}:${serial}`)) };
  }
  function plan(s, at, build = true) {
    const month = monthAt(s.calendar, at);
    if (s.plans.some(p => p.index === month.index)) return;
    s.plans.push({ ...month, plannedAt: at });
    for (const r of s.regions) Wildlife.plan(r, month, at);
    Foodweb.plan(s, { ...month, plannedAt: at });
    for (const g of s.groups) {
      Ecology.plan(g, month);
      g.demographicPlan = { monthIndex: month.index, regionId: g.regionId, siteId: g.breeding?.siteId || null,
        requestedReproduction: Boolean(g.breeding && g.will !== false && g.willing !== false),
        ratePerDay: Biology.lifecycle[g.speciesId].attempts365 / 365 };
      if (g.will === false || !g.cohorts.some(c => count(c))) continue;
      if (Journeys.configured(g)) {
        for (const event of Journeys.planMonth(g, s.calendar, month, at)) record(s, event.kind, event.at, event);
        continue;
      }
      if (g.transit) continue;
      if (g.instinct?.mode !== 'instinctive' && !g.observedShortage && !g.displaced) continue;
      if (!g.intention) scheduleDeparture(s, g, at, month);
    }
    if (build) rebuild(s, at);
  }
  const location = Journeys.location;
  const schedulerOps = { location, rebuild: rebuildKernel, integrate, boundary,
    refreshGroups: (s, groups) => Demography.refreshGroups(s, groups),
    dailyNeeded: s => Boolean(s.regions.some(r => r.ecology || r.wildlife) || s.groups.some(g => g.cohorts.some(c => count(c) && (c.aggregateMortality || c.demography)) || g.breeding) || s.extraRates?.length),
    movingDestinations: (g, at) => [g.intention?.departAt <= at + EPS ? g.intention.destination : null,
      g.transit && (g.transit.crossAt <= at + EPS || g.transit.edgeArriveAt <= at + EPS) ? g.transit.path.at(-1) : null].filter(Boolean),
    references: (g, at) => {
      const refs = new Set();
      for (const c of g.cohorts) {
        for (const b of c.demography?.broods || []) refs.add(b.regionId);
        if (c.nurseryId && count(c) && at - (c.birthSpan?.[1] ?? c.bornAt) < Biology.lifecycle[c.speciesId].independentDays * DAY) refs.add(g.regionId);
      }
      return refs;
    } };
  function rebuild(s, at, affected = null) {
    if (s.accountRoot || !Scheduler.active(s)) return rebuildKernel(s, at);
    if (affected) Scheduler.invalidate(s, typeof affected === 'string' ? [affected] : affected, at);
    else Scheduler.rebuildAll(s, at);
  }
  function rebuildKernel(s, at) {
    Demography.prepare(s, at);
    if (s.work) {
      s.work.regionRebuilds = (s.work.regionRebuilds || 0) + s.regions.length;
      s.work.cohortRateVisits = (s.work.cohortRateVisits || 0) + s.groups.reduce((n, g) => n + g.cohorts.length, 0);
    }
    const month = monthAt(s.calendar, at), until = month.end;
    let next = until;
    const rates = Object.fromEntries(s.regions.map(r => [r.id, { renewal: {}, demand: {}, supply: {}, net: {} }]));
    for (const r of s.regions) for (const [key, value] of Object.entries(r.seasons?.[month.season]?.renewal || r.renewalPerDay)) {
      const base = value * (r.seasons ? 1 : r.seasonFactors?.[month.season] ?? 1);
      rates[r.id].renewal[key] = Ecology.renewal(r, key, base);
      if (key === 'waterL') rates[r.id].rejectedWaterPerDay = base - rates[r.id].renewal[key];
    }
    for (const g of s.groups) {
      const r = rates[location(g)]; g.needs = {};
      if (!r) throw Error(`Group ${g.id} moved outside its settled scope (${location(g)})`);
      for (const c of g.cohorts) {
        Demography.synchronize(s, g, c, at);
        const p = Biology.lifecycle[c.speciesId], juvenile = at - c.bornAt < p.adultDays * DAY;
        const scale = count(c) * (c.massKg / p.adultKg) ** .75 * (juvenile ? p.juvenileMultiplier : 1)
          * (g.transit ? p.travelMultiplier : c.foraging?.action
            ? 1 + (p.travelMultiplier - 1) * Foraging.travelScale(c) : c.contactBusyUntil > at ? p.travelMultiplier : 1);
        c.needs = {}; c.intake = {};
        for (const key of ['foodKg', 'waterL', 'mineralsKg']) {
          const need = p[({ foodKg: 'foodKgDay', waterL: 'waterLDay', mineralsKg: 'mineralsKgDay' })[key]] * scale;
          c.needs[key] = need;
          c.intake[key] = Ecology.Work.intake(s, g, c, key);
          g.needs[key] = (g.needs[key] || 0) + need * c.intake[key];
        }
        next = Math.min(next, nextDeath(c, at, until));
        if (c.bornAt + p.adultDays * DAY > at + EPS) next = Math.min(next, c.bornAt + p.adultDays * DAY);
      }
      for (const [key, need] of Object.entries(g.needs)) {
        const stockKey = g.resources?.[key] || key;
        r.demand[stockKey] = (r.demand[stockKey] || 0) + need;
      }
      if (g.intention) next = Math.min(next, g.intention.departAt);
      if (g.transit) next = Math.min(next, g.transit.edgeIndex === 0 ? g.transit.crossAt : g.transit.edgeArriveAt);
      if (!g.transit && Demography.region(s, g.regionId)?.foraging)
        for (const c of g.cohorts) if (count(c)) next = Math.min(next, Foraging.next(c));
    }
    const extra = Ecology.requests(s, at, s.groups.flatMap(g => g.cohorts.flatMap(c => Demography.requests(s, g, c, at))));
    const requestsByRegion = new Map();
    for (const request of extra) {
      const key = location(request.g);
      if (!requestsByRegion.has(key)) requestsByRegion.set(key, []);
      request.inputs = Object.fromEntries(Object.entries(request.recipe).map(([k, fraction]) => [k, fraction * request.perDay]));
      Object.assign(request.inputs, request.additionalInputs || {});
      if (request.manaPerDay > 0) request.inputs[request.brood.manaStockKey] = request.manaPerDay;
      requestsByRegion.get(key).push(request);
    }
    // Process real upstream accounts first. Downstream consumers see only the
    // water that actually passes retention/spill, never the undammed forecast.
    for (const r of Ecology.Work.order(s)) {
      const regionId = r.id, rate = rates[regionId], requested = {};
      const list = [...(requestsByRegion.get(regionId) || []), ...Wildlife.prepare(r, at, rate)];
      Ecology.Work.addFlowDemand(r, rate);
      for (const key of new Set([...Object.keys(rate.renewal), ...Object.keys(rate.demand)])) {
        const renewal = rate.renewal[key] || 0, demand = rate.demand[key] || 0, stock = r.stocks[key] || 0;
        rate.supply[key] = demand > 0 ? stock > EPS ? 1 : Math.min(1, renewal / demand) : 1;
        rate.net[key] = renewal - demand * rate.supply[key];
      }
      Ecology.Work.limitFlow(s, list, at, rate);
      for (const request of list) for (const [key, n] of Object.entries(request.inputs)) requested[key] = (requested[key] || 0) + n;
      for (const request of list) {
        request.factor = Math.min(1, ...Object.entries(request.inputs).filter(([, n]) => n > 0).map(([key]) =>
          (r.stocks[key] || 0) > EPS ? 1 : Math.min(1, Math.max(0, (rate.renewal[key] || 0) - (rate.demand[key] || 0)) / requested[key])));
        if (request.poolId ? !Wildlife.fed(r, request, rate) : Object.entries(request.c.needs).some(([k, n]) => n > 0
          && !(request.storeFunded && k === 'foodKg')
          && !(request.g.ecology?.action === 'filterPlankton' && k === 'foodKg')
          && (rate.supply[request.g.resources?.[k] || k] ?? 0) < 1)) request.factor = 0;
      }
      const activity = new Map(list.filter(r => r.kind === 'activity').map(r => [r.c.id, r.factor]));
      for (const request of list) {
        if (request.kind !== 'activity' && request.c) request.factor = Math.min(request.factor, activity.get(request.c.id) ?? 1);
        for (const [key, amount] of Object.entries(request.inputs)) rate.net[key] = (rate.net[key] || 0) - amount * request.factor;
        const perDay = request.perDay * request.factor;
        if (perDay > EPS && ['growth', 'brood'].includes(request.kind)) {
          const remaining = request.kind === 'growth' ? (Biology.lifecycle[request.c.speciesId][request.c.role === 'queen' ? 'breederKg' : 'adultKg'] * .8 - request.c.structuralKg)
            * count(request.c) / Biology.lifecycle[request.c.speciesId].assimilation
            : request.brood.requiredKg * Demography.size(request.brood.parents) - request.brood.investedKg;
          next = Math.min(next, at + remaining / perDay * DAY);
          if (request.storeFunded) {
            const n = count(request.c), missing = request.c.needs.foodKg * (1 - (rate.supply[request.g.resources?.foodKg || 'foodKg'] ?? 0));
            next = Math.min(next, at + (request.c.stores.foodKg - request.storeReserveKg) / ((perDay + missing) / n) * DAY);
          }
        }
        if (request.kind === 'brood' && request.manaPerDay * request.factor > EPS) {
          const remaining = request.brood.requiredMana * Demography.size(request.brood.parents) - request.brood.investedMana;
          next = Math.min(next, at + remaining / (request.manaPerDay * request.factor) * DAY);
        }
      }
      if (r.wildlife) rate.wildlifeRates = list.filter(q => q.poolId);
      next = Math.min(next, Ecology.Work.prepareOutputs(r, rate, list, at));
      Ecology.Work.route(s, r, rate, list, rates);
      next = Math.min(next, Wildlife.next(r, rate, at));
      next = Math.min(next, Ecology.Work.boundaries(r, rate, at, list));
      for (const [key, net] of Object.entries(rate.net)) {
        if (net < -EPS && (r.stocks[key] || 0) > EPS) next = Math.min(next, at + r.stocks[key] / -net * DAY);
        if (net > EPS && (r.stocks[key] || 0) < (r.capacity[key] || 0) - EPS)
          next = Math.min(next, at + ((r.capacity[key] || 0) - (r.stocks[key] || 0)) / net * DAY);
      }
    }
    next = Math.min(next, Ecology.build(s, rates, extra, at, month.season));
    s.dailyNeeded = Boolean(s.regions.some(r => r.ecology || r.wildlife) || s.groups.some(g => g.cohorts.some(c => count(c) && (c.aggregateMortality || c.demography)) || g.breeding) || extra.length);
    if (s.dailyNeeded) {
      s.nextDemographyAt ??= (Math.floor(at / DAY) + 1) * DAY;
      next = Math.min(next, s.nextDemographyAt);
    }
    for (const g of s.groups) for (const c of g.cohorts) {
      for (const b of c.demography?.broods || []) if (b.dueAt > at + EPS) next = Math.min(next, b.dueAt);
    }
    s.extraRates = extra.map(({ g, c, brood, ...r }) => ({ ...r, groupId: g.id, cohortId: c.id, broodId: brood?.id || null }));
    for (const g of s.groups) for (const c of g.cohorts) {
      const n = count(c); if (!n) continue;
      c.healthLossPerDay = 0;
      const rate = rates[location(g)], p = Biology.lifecycle[c.speciesId];
      for (const [key, need] of Object.entries(c.needs)) {
        const deficit = Math.max(0, need * (1 - (rate.supply[g.resources?.[key] || key] ?? 0) * c.intake[key]) / n
          - (key === 'foodKg' ? Foraging.intake(c) : 0));
        if (!(deficit > EPS)) continue;
        const stored = (c.stores[key] || 0) + (key === 'foodKg' ? c.stores.fatKg : 0);
        if (stored > EPS) next = Math.min(next, at + stored / deficit * DAY);
        else {
          const daily = p[({ foodKg: 'foodKgDay', waterL: 'waterLDay', mineralsKg: 'mineralsKgDay' })[key]];
          c.healthLossPerDay += deficit / daily * (key === 'waterL' ? .4 : .1);
          c.scarcityCause = key === 'waterL' ? 'dehydration' : key === 'foodKg' ? 'starvation' : 'mineralDeficiency';
        }
      }
      if (c.healthLossPerDay > 0) next = Math.min(next, at + c.health / c.healthLossPerDay * DAY);
    }
    for (const g of s.groups) if (!g.transit && !g.observedShortage && g.cohorts.some(c => count(c))
      && Object.entries(g.needs).some(([key, need]) => need > 0 && !(key === 'foodKg' && g.cohorts.some(c => c.foraging))
        && (rates[location(g)].supply[g.resources?.[key] || key] ?? 0) < 1))
      next = Math.min(next, at + 1); // The next actual local feeding attempt discovers it.
    next = Math.min(next, Foodweb.next(s, s.regionIds));
    s.rates = rates; s.nextEventAt = Math.max(at + 1e-6, next);
  }
  function integrate(s, to) {
    const from = s.appliedAt, days = (to - from) / DAY;
    if (!(days > 0)) return;
    if (s.work) s.work.cohortIntervals += s.groups.reduce((n, g) => n + g.cohorts.length, 0);
    if (s.work) s.work.regionIntervals = (s.work.regionIntervals || 0) + s.regions.length;
    for (const r of s.regions) {
      const rate = s.rates[r.id];
      const waterBefore = r.stocks.waterL || 0;
      r.receipts ||= {};
      for (const [key, net] of Object.entries(rate.net)) {
        const before = r.stocks[key] || 0;
        const overflow = Math.max(0, before + days * net - (r.capacity[key] || 0));
        if (overflow > 0) { r.outputs ||= {}; const k = `${key}Overflow`; r.outputs[k] = (r.outputs[k] || 0) + overflow; }
        r.stocks[key] = Math.max(0, Math.min(r.capacity[key] || 0, before + days * net));
        r.receipts[key] = (r.receipts[key] || 0) + r.stocks[key] - before;
      }
      Ecology.Work.integrateWater(r, rate, days, waterBefore);
    }
    for (const g of s.groups) {
      const r = Demography.region(s, location(g)), rate = s.rates[r.id];
      for (const c of g.cohorts) {
        const n = count(c); if (!n) continue;
        Foraging.integrate(s.accountRoot || s, r, g, c, from, to, rate);
        if (g.transit && c.regional) c.regional.at = to; // Travel is not banked supplied rest.
        if (c.aggregateMortality) {
          if (c.batchMembers !== n) { c.batchMembers = n; c.batchHazard = 0; }
          const hazard = hazardIntegral(c, from, to);
          c.mortalityBalance += n * Math.exp(-c.batchHazard) * -Math.expm1(-hazard); c.batchHazard += hazard;
        } else c.deathExposure += hazardIntegral(c, from, to) * n;
        for (const [key, need] of Object.entries(c.needs)) {
          const stockKey = g.resources?.[key] || key, supply = (rate.supply[stockKey] ?? 0) * (c.intake?.[key] ?? 1);
          let missing = need * days * (1 - supply);
          const available = (c.stores[key] || 0) + (key === 'foodKg' ? c.stores.fatKg : 0);
          const consumed = Math.min(available, missing / n);
          let left = consumed;
          if (c.stores[key] > 0) { const taken = Math.min(c.stores[key], left); c.stores[key] -= taken; left -= taken; }
          if (key === 'foodKg' && left > 0) c.stores.fatKg = Math.max(0, c.stores.fatKg - left);
          c.massKg -= consumed; missing -= consumed * n;
          if (missing > EPS) {
            g.observedShortage = true;
            if (key === 'foodKg' && c.foraging) c.foraging.shortageAt ??= to;
            c.unmet ||= {}; c.unmet[key] = (c.unmet[key] || 0) + missing / n;
            r.unmetTotals ||= {}; r.unmetTotals[stockKey] = (r.unmetTotals[stockKey] || 0) + missing;
          }
          // Real maintenance outputs remain matter, not ecological points.
          const used = need * days * supply + consumed * n;
          r.outputs ||= {}; const output = key === 'waterL' ? 'waterVaporKg' : 'metabolicWasteKg';
          r.outputs[output] = (r.outputs[output] || 0) + used;
          if (s.foodWeb && key === 'foodKg' && need * days * supply > EPS && Biology.rates[c.speciesId]?.destruction.some(v => v > 0))
            Foodweb.noteFeeding(g, c, r, to);
        }
        c.health = Math.max(0, c.health - (c.healthLossPerDay || 0) * days);
        if (Demography.site(s, g, from) && Demography.eligible(c, from)) {
          const p = Biology.lifecycle[c.speciesId];
          const available = /egg|clutch|propagule|fragment/i.test(p.method) ? n
            : Demography.size(Demography.subtract(c.ranges, Demography.union((c.demography?.broods || []).flatMap(b => b.parents))));
          const d = Demography.init(c);
          d.credit = Math.min(n, d.credit + available * (g.demographicPlan?.ratePerDay || 0) * days);
        }
      }
    }
    for (const rate of s.extraRates || []) {
      const g = Demography.group(s, rate.groupId), c = Demography.cohort(s, g.id, rate.cohortId), n = count(c);
      const amount = rate.perDay * rate.factor * days, r = Demography.region(s, location(g));
      if (!n) continue;
      if (rate.kind === 'activity') {
        r.activityReceipts ||= {};
        for (const [key, input] of Object.entries(rate.inputs)) r.activityReceipts[key] = (r.activityReceipts[key] || 0) + input * rate.factor * days;
        continue;
      }
      if (rate.kind === 'ecology') continue;
      if (!(amount > 0 || rate.manaPerDay > 0)) continue;
      if (rate.kind === 'growth') {
        const gain = amount * Biology.lifecycle[c.speciesId].assimilation;
        if (rate.storeFunded) { c.stores.foodKg = Math.max(0, c.stores.foodKg - amount / n); c.massKg -= amount / n; }
        c.structuralKg += gain / n; c.massKg += gain / n;
        r.outputs ||= {}; r.outputs.growthWasteKg = (r.outputs.growthWasteKg || 0) + amount - gain;
      } else {
        const brood = c.demography.broods.find(b => b.id === rate.broodId);
        brood.investedKg += amount; brood.investedMana += (rate.manaPerDay || 0) * rate.factor * days;
      }
    }
    for (const r of s.regions) { Foraging.decay(s.accountRoot || s, r, to); Wildlife.integrate(r, s.rates[r.id], from, to); }
    Ecology.integrate(s, days, to);
    s.appliedAt = to;
  }
  function loseBatch(s, g, c, amount, cause, at) {
    const ranges = Demography.take(c.ranges, Math.min(amount, count(c)), true), n = Demography.size(ranges);
    if (!n) return;
    Foodweb.cancel(s, g.id, c.id, ranges, at);
    Ecology.lostContributor(s, g, c, n, at, cause, `loss-batch:${c.originId}:${location(g)}:${cause}`);
    c.ranges = Demography.subtract(c.ranges, ranges);
    s.lossBatches ||= [];
    const batchId = `loss-batch:${c.originId}:${location(g)}:${cause}`;
    let b = s.lossBatches.find(b => b.id === batchId);
    if (!b) { b = { id: batchId, populationId: g.populationId, speciesId: g.speciesId, originId: c.originId,
      groupId: g.id, regionId: location(g), cause, ranges: [], count: 0, firstAt: at, lastAt: at, massKg: 0 }; s.lossBatches.push(b); }
    b.ranges = Demography.union([...b.ranges, ...ranges]); b.count += n; b.lastAt = at; b.massKg += c.massKg * n;
    const r = s.regions.find(r => r.id === location(g));
    if (s.foodWeb) Foodweb.addRemains(s, r, batchId, g, c, n, at, cause, n === 1 ? Foodweb.position(g, r, c, ranges[0][0]) : null);
    else {
      r.remainsBatches ||= {};
      const remains = r.remainsBatches[batchId] ||= { count: 0, massKg: 0, edibleKg: 0, firstAt: at, lastAt: at };
      remains.count += n; remains.massKg += c.massKg * n; remains.edibleKg += c.massKg * n * .6; remains.lastAt = at;
    }
  }
  function recordBirth(s, g, parent, brood, role, n, at) {
    const p = Biology.lifecycle[g.speciesId], originId = `birth-stream:${g.id}:${role}`;
    const origin = s.origins[originId] ||= { populationId: g.populationId, speciesId: g.speciesId, count: 0 };
    if (!integer(n) || !integer(origin.count + n)) throw Error('Birth batch exceeds conserved integer capacity');
    const lo = origin.count; origin.count += n;
    const c = cohort({ id: `${originId}:${lo}`, speciesId: g.speciesId, count: n, ageDays: 0, massKg: p.newbornKg,
      role, colonyId: parent.colonyId, ...(parent.feedingTowers ? { feedingTowers: copy(parent.feedingTowers) } : {}) }, at);
    Object.assign(c, { originId, generated: true, nurseryId: brood.nurseryId, ranges: [[lo, lo + n]], aggregateMortality: true,
      mortalityBalance: Life.random(`${c.id}:mortality-offset`), batchHazard: 0, batchMembers: n });
    g.cohorts.push(c);
    if (s.foodWeb) Foodweb.initial(c, at);
    let birth = s.births.find(b => b.originId === originId);
    if (!birth) { birth = { originId, populationId: g.populationId, count: 0, firstAt: at, lastAt: at, parentOrigins: [] }; s.births.push(birth); }
    birth.count += n; birth.lastAt = at;
    if (!birth.parentOrigins.includes(parent.originId)) birth.parentOrigins.push(parent.originId);
    return c;
  }
  function lose(s, g, c, ordinal, cause, at) {
    if (!remove(c, ordinal)) return false;
    Foodweb.cancel(s, g.id, c.id, [[ordinal, ordinal + 1]], at);
    Ecology.lostContributor(s, g, c, 1, at, cause, cohortKey(c, ordinal));
    const loss = { memberId: cohortKey(c, ordinal), populationId: g.populationId, speciesId: g.speciesId,
      groupId: g.id, originId: c.originId || c.id, ordinal, regionId: location(g), cause, at, massKg: c.massKg };
    s.losses.push(loss);
    const r = s.regions.find(r => r.id === loss.regionId);
    // Remains are real finite matter and are not renewable generic prey.
    if (s.foodWeb) Foodweb.addRemains(s, r, loss.memberId, g, c, 1, at, cause, Foodweb.position(g, r, c, ordinal));
    else { r.remains ||= {}; r.remains[loss.memberId] = { massKg: c.massKg, edibleKg: c.massKg * .6, at, cause }; }
    record(s, 'loss', at, { memberId: loss.memberId, cause }); return true;
  }
  function boundary(s, at) {
    if (s.work) s.work.boundaries++;
    for (const g of s.groups) {
      for (const c of g.cohorts) if (count(c) && c.health <= EPS) {
        if (c.aggregateMortality) loseBatch(s, g, c, count(c), c.scarcityCause, at);
        else for (const [lo, hi] of copy(c.ranges)) for (let ordinal = lo; ordinal < hi; ordinal++) lose(s, g, c, ordinal, c.scarcityCause, at);
      }
      for (const c of g.cohorts) if (count(c) && c.deathExposure + EPS >= c.deathThreshold) {
        if (c.aggregateMortality) continue;
        const ordinal = ordinalAt(c, Math.min(count(c) - 1, Math.floor(Life.random(`${c.id}:victim:${c.deathSerial}`) * count(c))));
        lose(s, g, c, ordinal, 'background', at); c.deathExposure = Math.max(0, c.deathExposure - c.deathThreshold);
        c.deathThreshold = exponential(`${c.id}:background:${++c.deathSerial}`);
      }
      if (!g.cohorts.some(c => count(c))) { g.regionId = location(g); g.intention = null; g.transit = null; continue; }
      if (g.intention && g.intention.departAt <= at + EPS) {
        Foodweb.cancelForaging(s, g, at);
        for (const event of Journeys.depart(g, at, s.regions.find(r => r.id === g.regionId), Biology.lifecycle[g.speciesId].travelKmDay))
          record(s, event.kind, event.at, event);
      }
      for (const event of Journeys.arrive(g, at)) record(s, event.kind, event.at, event);
    }
    plan(s, at, false);
    const demographicTick = at + EPS >= (s.nextDemographyAt ?? Infinity);
    if (demographicTick) s.nextDemographyAt = (Math.floor((at + EPS) / DAY) + 1) * DAY;
    for (const r of s.regions) Wildlife.boundary(r, at, demographicTick);
    const foodApi = {
      region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args)
    };
    if (s.accountRoot) Foodweb.finish(s.accountRoot, at, foodApi, s.regionIds);
    else Foodweb.advance(s, at, monthAt(s.calendar, at), foodApi);
    Foodweb.foragers(s, at, monthAt(s.calendar, at));
    for (const g of s.groups) {
      for (const c of [...g.cohorts]) {
        if (demographicTick && c.aggregateMortality && count(c)) {
          const dead = Math.min(count(c), Math.floor(c.mortalityBalance + EPS));
          if (dead) { loseBatch(s, g, c, dead, 'background', at); c.mortalityBalance = Math.max(0, c.mortalityBalance - dead); c.batchHazard = 0; c.batchMembers = count(c); }
        }
        Demography.synchronize(s, g, c, at);
        Demography.complete(s, g, c, at, { birth: (...args) => recordBirth(s, ...args) });
      }
    }
    Demography.prepare(s, at);
    if (demographicTick) for (const g of s.groups) for (const c of g.cohorts) if (count(c)) Demography.start(s, g, c, at);
    for (const g of s.groups) {
      if (demographicTick) Demography.compact(g, at);
    }
    rebuild(s, at);
    const changed = new Set();
    for (const g of s.groups) {
      const rate = s.rates[location(g)];
      const localShortage = !g.transit && g.cohorts.some(c => count(c)) && Object.entries(g.needs)
        .some(([key, need]) => need > 0 && !(key === 'foodKg' && g.cohorts.some(c => c.foraging))
          && (rate.supply[g.resources?.[key] || key] ?? 0) < 1);
      for (const c of g.cohorts) if (!g.transit && c.foraging?.shortageAt != null
        && c.foraging.shortageAt !== c.foraging.reactedShortageAt) {
        c.foraging.reactedShortageAt = c.foraging.shortageAt;
        if (!g.intention && count(c)) { scheduleDeparture(s, g, at, monthAt(s.calendar, at)); changed.add(location(g)); }
      }
      if (localShortage && !g.observedShortage) {
        g.observedShortage = true;
        record(s, 'observedShortage', at, { groupId: g.id, regionId: g.regionId });
        if (!g.intention) { scheduleDeparture(s, g, at, monthAt(s.calendar, at)); changed.add(location(g)); }
      }
    }
    if (changed.size) rebuild(s, at, changed);
  }
  function advance(s, at, alive = true, settle = false) {
    if (!alive || !nonnegative(at) || at < s.clock) return false;
    if (!Scheduler.active(s)) Scheduler.restore(s, schedulerOps);
    Scheduler.advance(s, at, settle); return true;
  }
  function advanceLocal(s, at, regions) {
    advance(s, at, true, false);
    const ids = typeof regions === 'function' ? regions() : regions;
    return Scheduler.settle(s, typeof ids === 'string' ? [ids] : ids, at);
  }
  function settleRegions(s, at, regions, alive = true) {
    if (!alive || !nonnegative(at) || at < s.clock || !Array.isArray(regions) || regions.some(id => !Demography.region(s, id))) return false;
    advanceLocal(s, at, regions); return true;
  }
  const groupRegions = (s, id) => { const g = Demography.group(s, id); return g ? [location(g)] : []; };
  function detail(s, groupId, cohortId, ordinal, actorId, at) {
    if (!id(actorId) || s.details[actorId] || !nonnegative(at) || at < s.clock) return null;
    advanceLocal(s, at, () => groupRegions(s, groupId));
    const g = Demography.group(s, groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) return null;
    Foodweb.handoff(s, groupId, cohortId, at, { region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args) });
    if (!c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) { rebuild(s, at, location(g)); return null; }
    const demographicHandoff = Demography.handoff(c, ordinal, at);
    if (!remove(c, ordinal)) return null;
    const memberId = cohortKey(c, ordinal);
    if (Object.values(s.details).some(d => d.memberId === memberId)) throw Error('Duplicate individual claim');
    const result = { actorId, memberId, populationId: g.populationId, groupId, cohortId, ordinal,
      speciesId: g.speciesId, regionId: location(g), detailedAt: at, status: 'detailed',
      ageDays: Math.max(0, (at - (c.birthSpan?.[1] ?? c.bornAt)) / DAY), massKg: c.massKg, structuralKg: c.structuralKg,
      stores: copy(c.stores), role: c.role, colonyId: c.colonyId, health: c.health,
      ...(c.feedingTowers ? { feedingTowers: copy(c.feedingTowers) } : {}),
      ...(c.nurseryId ? { nurseryId: c.nurseryId } : {}),
      ...(demographicHandoff ? { demography: demographicHandoff } : {}), ...(c.birthSpan ? { birthSpan: copy(c.birthSpan) } : {}) };
    s.details[actorId] = result; Scheduler.noteDetail(s, actorId); rebuild(s, at, location(g)); return copy(result);
  }
  // A local source adapter must supply the original body's established position
  // and real terrain context. A regional range/centroid alone cannot place prey
  // beside a predator. The resulting actor is owned by this exact detail claim.
  function claimLocal(s, groupId, cohortId, ordinal, actorId, at, ctx) {
    if (!nonnegative(at) || at < s.clock || !ctx?.alive || !ctx.local || !id(actorId) || s.details[actorId]) return null;
    advanceLocal(s, at, () => groupRegions(s, groupId));
    const g = Demography.group(s, groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi) || !Bodies.profiles[g.speciesId]) return null;
    let position = ctx.originalPosition?.(g, c, ordinal, at);
    if (position?.regionId === location(g) && c.contactBusyUntil > at) {
      Foodweb.handoff(s, groupId, cohortId, at, { region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args) });
      rebuild(s, at, location(g));
      if (!c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) return null;
      position = ctx.originalPosition?.(g, c, ordinal, at);
    }
    if (!position || position.regionId !== location(g) || !position.cell
      || !['x', 'y', 'z'].every(k => Number.isInteger(position.cell[k]))) return null;
    const a = Wilderness.actor(g.speciesId, actorId, position.cell, g.populationId, at,
      { ageDays: (at - c.bornAt) / DAY, massKg: c.massKg, role: c.role, colonyId: c.colonyId, will: g.will, willing: g.willing });
    if (Number.isFinite(position.altitudeM)) a.bodyPhysics.altitudeM = position.altitudeM;
    if (position.mode) a.bodyPhysics.mode = position.mode;
    const reserves = ctx.originalReserves?.(g, c, ordinal, at), manaOwner = a.spellImitation || a.bodyPhysics;
    // A caller must supply attributable personal reserves, including any saved
    // regional contact history; never create a freshly full pool on handoff.
    if (!reserves || !nonnegative(reserves.mana) || reserves.mana > manaOwner.mana
      || !nonnegative(reserves.stamina) || reserves.stamina > a.bodyPhysics.stamina
      || !reserves.energy || !Object.keys(a.life.energy).every(k => nonnegative(reserves.energy[k]))) return null;
    manaOwner.mana = reserves.mana; a.bodyPhysics.stamina = reserves.stamina;
    a.life.energy = copy(reserves.energy);
    if (c.feedingTowers) c.feedingTowers.forEach((health, i) => { a.bodyPhysics.parts[`feeding tower ${i + 1}`] = health; });
    const modes = Bodies.profiles[g.speciesId].modes;
    if (!Bodies.valid(a) || !(modes.includes(a.bodyPhysics.mode) || a.bodyPhysics.mode === 'walking' && modes.includes('charging'))
      || Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode, Bodies.height(a), ctx)) return null;
    const d = detail(s, groupId, cohortId, ordinal, actorId, at); if (!d) return null;
    a.maxHealth = Math.max(1, a.maxHealth * Math.min(1, Math.sqrt(d.massKg / Biology.lifecycle[g.speciesId].adultKg)));
    a.health = a.maxHealth * d.health;
    a.life.stores = copy(d.stores); a.life.structuralKg = d.structuralKg;
    if (c.regional) {
      for (const [part, health] of Object.entries(c.regional.parts)) a.bodyPhysics.parts[part] = health;
      a.life.armourKg = c.regional.armourKg;
      a.beastConditions = copy(c.regional.conditions); a.life.cooldowns = copy(c.regional.cooldowns);
    }
    a.life.bornAt = at - d.ageDays * DAY;
    a.life.originalMemberId = d.memberId;
    a.life.originalGroupId = groupId;
    if (d.demography) {
      a.life.opportunities = d.demography.opportunities;
      a.life.lastAttemptAt = d.demography.lastAttemptAt;
      a.life.populationBroods = copy(d.demography.broods);
    }
    s.details[actorId].actor = a; Scheduler.noteDetail(s, actorId); return a;
  }
  function settleLocalLoss(s, actorId, at, cause) {
    const d = s.details[actorId], a = d?.actor;
    if (!a || a.status !== 'dead' || a.health > 0 || !id(cause) || !nonnegative(at) || at < s.clock) return false;
    const r = Predation.remains(a, at);
    if (!recordDetailedLoss(s, actorId, at, cause, r.massKgAtDeath)) return false;
    return true;
  }
  function registerLocalBirth(s, parentActorId, child, at) {
    if (!nonnegative(at) || at < s.clock) return false;
    const parent = s.details[parentActorId], a = parent?.actor, p = Biology.lifecycle[parent?.speciesId];
    if (!a || a.status === 'dead' || parent.status !== 'detailed' || !child || !Life.valid(child) || !Bodies.valid(child)
      || child.speciesId !== a.speciesId || Math.abs(child.bodyPhysics.massKg - p.newbornKg) > EPS) return false;
    if (s.details[child.id]) return s.details[child.id].actor?.id === child.id;
    const r = [...(a.life.populationBroods || []), a.life.reproduction].filter(Boolean).find(r => child.id.startsWith(`${r.id}:`));
    if (!r || !r.ready || !r.success || at + EPS < r.dueAt || r.investedKg + EPS < r.requiredKg
      || r.investedMana + EPS < r.requiredMana) return false;
    const suffix = child.id.slice(r.id.length + 1), index = Number(suffix);
    if (!integer(index) || String(index) !== suffix || index >= p.offspring) return false;
    advanceLocal(s, at, () => groupRegions(s, parent.groupId));
    const g = Demography.group(s, parent.groupId), co = g.cohorts.find(c => c.originId === parent.memberId.slice(0, parent.memberId.lastIndexOf(':')))
      || { originId: parent.memberId.slice(0, parent.memberId.lastIndexOf(':')), colonyId: a.life.colonyId };
    const c = recordBirth(s, g, co, { nurseryId: g.breeding?.siteId || null }, child.life.role || 'individual', 1, at);
    rebuild(s, at, location(g));
    const d = detail(s, g.id, c.id, c.ranges[0][0], child.id, at); if (!d) return false;
    child.life.originalMemberId = d.memberId; child.life.originalGroupId = g.id;
    s.details[child.id].actor = child; Scheduler.noteDetail(s, child.id); return true;
  }
  function recordDetailedLoss(s, actorId, at, cause, remainsKg) {
    const d = s.details[actorId];
    if (!d || d.status !== 'detailed' || !nonnegative(remainsKg) || !nonnegative(at) || at < s.clock) return false;
    advanceLocal(s, at, [d.regionId]); d.status = 'dead'; d.diedAt = at; d.cause = cause;
    s.losses.push({ memberId: d.memberId, populationId: d.populationId, speciesId: d.speciesId,
      groupId: d.groupId, originId: d.memberId.slice(0, d.memberId.lastIndexOf(':')), ordinal: d.ordinal,
      regionId: d.regionId, cause, at, massKg: remainsKg, detailOwner: actorId });
    // The physical corpse still belongs to its detailed owner; do not copy it
    // into regional food stocks or apply another background death.
    record(s, 'detailedLoss', at, { actorId, memberId: d.memberId, cause }); return true;
  }
  function removeStock(s, regionId, key, amount, at, cause) {
    if (!id(cause) || !nonnegative(amount) || !nonnegative(at) || at < s.clock) return false;
    advanceLocal(s, at, [regionId]);
    const r = Demography.region(s, regionId);
    if (!r || !(r.stocks[key] >= amount)) return false;
    r.stocks[key] -= amount;
    if (key === 'waterL' && r.retainedWaterL) r.retainedWaterL = Math.max(0, r.retainedWaterL - amount);
    record(s, 'stockLoss', at, { regionId, key, amount, cause });
    rebuild(s, at, regionId); return true;
  }
  function destroyNursery(s, regionId, siteId, at, cause) {
    if (!nonnegative(at) || at < s.clock || !id(cause)) return false;
    advanceLocal(s, at, [regionId]);
    const nursery = Demography.region(s, regionId)?.nurseries?.find(n => n.id === siteId);
    if (!nursery || nursery.destroyedAt != null) return false;
    nursery.destroyedAt = at; nursery.enabled = false;
    for (const d of Scheduler.detailsForRegion(s, regionId)) for (const brood of d.actor?.life?.populationBroods || [])
      if (brood.externalNursery && brood.sourceRegionId === regionId && brood.sourceNurseryId === siteId && brood.disposedAt == null) {
        const r = Demography.region(s, regionId); r.outputs ||= {};
        r.outputs.failedRecruitmentKg = (r.outputs.failedRecruitmentKg || 0)
          + Math.max(0, brood.investedKg - Biology.lifecycle[d.speciesId].newbornKg * brood.emitted.length);
        brood.disposedAt = at;
      }
    record(s, 'nurseryDestroyed', at, { regionId, siteId, cause }); rebuild(s, at, regionId); return true;
  }
  function destroyRenewalSite(s, regionId, siteId, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock) return false;
    advanceLocal(s, at, [regionId]);
    if (!Ecology.destroySite(s, regionId, siteId, at, cause)) return false;
    record(s, 'renewalSiteDestroyed', at, { regionId, siteId, cause }); rebuild(s, at, regionId); return true;
  }
  function destroyEcologicalWorkSite(s, regionId, siteId, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock) return false;
    advanceLocal(s, at, [regionId]);
    if (!Ecology.destroyWorkSite(s, regionId, siteId, at, cause)) return false;
    record(s, 'ecologicalWorkSiteDestroyed', at, { regionId, siteId, cause }); rebuild(s, at, regionId); return true;
  }
  function setEcologicalActivity(s, groupId, state, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock || !state
      || ['sleeping', 'dreamConsent'].some(k => typeof state[k] !== 'boolean')) return false;
    advanceLocal(s, at, () => groupRegions(s, groupId));
    const g = Demography.group(s, groupId); if (!g) return false;
    g.activityState = { sleeping: state.sleeping, dreamConsent: state.dreamConsent };
    record(s, 'ecologicalActivityChanged', at, { groupId, ...g.activityState, cause }); rebuild(s, at, location(g)); return true;
  }
  function damageFeedingTower(s, groupId, cohortId, towerIndex, damage, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock || !integer(towerIndex) || towerIndex >= 4 || !(damage > 0) || !Number.isFinite(damage)) return false;
    advanceLocal(s, at, () => groupRegions(s, groupId));
    const g = Demography.group(s, groupId), c = g && Demography.cohort(s, groupId, cohortId);
    if (!c?.feedingTowers || !count(c) || c.feedingTowers[towerIndex] <= 0) return false;
    c.feedingTowers[towerIndex] = Math.max(0, c.feedingTowers[towerIndex] - damage);
    record(s, 'feedingTowerDamaged', at, { groupId, cohortId, towerIndex, damage, cause }); rebuild(s, at, location(g)); return true;
  }
  function kill(s, groupId, cohortId, ordinal, at, cause) {
    if (!id(cause) || cause === 'background' || !nonnegative(at) || at < s.clock) return false;
    advanceLocal(s, at, () => groupRegions(s, groupId));
    const g = Demography.group(s, groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !lose(s, g, c, ordinal, cause, at)) return false;
    rebuild(s, at, location(g)); return true;
  }
  function audit(s) {
    const byPopulation = {}, families = new Map();
    function add(originId, populationId, speciesId, ranges) {
      const origin = s.origins[originId];
      if (!origin || origin.populationId !== populationId || origin.speciesId !== speciesId) throw Error('Member has no original source');
      if (!families.has(originId)) families.set(originId, []);
      for (const [lo, hi] of ranges) {
        if (!integer(lo) || !integer(hi) || hi <= lo || hi > origin.count) throw Error('Invalid conserved membership range');
        families.get(originId).push([lo, hi]);
      }
    }
    for (const g of s.groups) {
      const row = byPopulation[g.populationId] ||= { background: 0, detailed: 0, dead: 0 };
      for (const c of g.cohorts) {
        row.background += count(c);
        add(c.originId || c.id, g.populationId, g.speciesId, c.ranges);
      }
    }
    for (const d of Object.values(s.details)) {
      const originId = d.memberId.slice(0, d.memberId.lastIndexOf(':')), origin = s.origins[originId];
      if (!origin || origin.populationId !== d.populationId || origin.speciesId !== d.speciesId || d.ordinal >= origin.count
        || d.memberId !== `${originId}:${d.ordinal}`) throw Error('Detailed individual has no original source');
      if (d.status === 'detailed') {
        (byPopulation[d.populationId] ||= { background: 0, detailed: 0, dead: 0 }).detailed++;
        add(originId, d.populationId, d.speciesId, [[d.ordinal, d.ordinal + 1]]);
      }
    }
    for (const loss of s.losses) {
      const origin = s.origins[loss.originId];
      if (!origin || origin.populationId !== loss.populationId || origin.speciesId !== loss.speciesId
        || !integer(loss.ordinal) || loss.ordinal >= origin.count || loss.memberId !== `${loss.originId}:${loss.ordinal}`)
        throw Error('Death has no original source');
      (byPopulation[loss.populationId] ||= { background: 0, detailed: 0, dead: 0 }).dead++;
      add(loss.originId, loss.populationId, loss.speciesId, [[loss.ordinal, loss.ordinal + 1]]);
    }
    for (const batch of s.lossBatches || []) {
      if (!integer(batch.count) || batch.count !== Demography.size(batch.ranges) || !nonnegative(batch.massKg)) throw Error('Invalid compact death batch');
      add(batch.originId, batch.populationId, batch.speciesId, batch.ranges);
      (byPopulation[batch.populationId] ||= { background: 0, detailed: 0, dead: 0 }).dead += batch.count;
    }
    for (const [originId, intervals] of families) {
      intervals.sort((a, b) => a[0] - b[0]); let end = 0;
      for (const [lo, hi] of intervals) { if (lo !== end) throw Error('Duplicated or missing original members'); end = hi; }
      if (end !== s.origins[originId].count) throw Error('Missing original members');
    }
    for (const [originId, origin] of Object.entries(s.origins)) if (origin.count && !families.has(originId)) throw Error('Missing original family');
    for (const [populationId, row] of Object.entries(byPopulation)) {
      const born = s.births.filter(b => b.populationId === populationId).reduce((n, b) => n + b.count, 0);
      if (row.background + row.detailed + row.dead !== (s.originalCounts[populationId] || 0) + born) throw Error('Population conservation failed');
    }
    for (const [populationId, n] of Object.entries(s.originalCounts)) if (n && !byPopulation[populationId]) throw Error('Missing original population');
    return byPopulation;
  }
  function rebind(s, from, to) {
    const result = copy(s);
    if (s.worldId === from?.worldId && s.runId === from?.runId && id(to?.worldId) && id(to.runId)) Object.assign(result, to);
    return result;
  }
  function normalize(value, binding) {
    try {
      if (!id(value?.worldId) || !id(value.runId) || binding && (value.worldId !== binding.worldId || value.runId !== binding.runId)
        || value.diagnosticOnly != null && typeof value.diagnosticOnly !== 'boolean'
        || !nonnegative(value.clock) || !nonnegative(value.appliedAt) || value.appliedAt > value.clock + EPS
        || !nonnegative(value.nextEventAt) || value.nextEventAt <= value.clock - EPS
        || !Array.isArray(value.losses) || !Array.isArray(value.births) || !Array.isArray(value.plans)
        || !value.originalCounts || !Object.values(value.originalCounts).every(integer)) return null;
      const s = copy(value);
      if (s.nextDemographyAt != null && !nonnegative(s.nextDemographyAt)) return null;
      validateSource({ id: s.sourceId, calendar: s.calendar, regions: s.regions,
        diagnosticOnly: s.diagnosticOnly === true, unlocated: s.unlocated, regionalFoodWeb: s.regionalFoodWeb,
        groups: s.groups.map(g => ({ ...g, cohorts: g.cohorts.map(c => ({ ...c, count: count(c), ageDays: Math.max(0, (s.clock - c.bornAt) / DAY) })) })) });
      for (const r of s.regions) {
        if (r.unmetTotals && !Object.values(r.unmetTotals).every(nonnegative)) return null;
        const rate = s.rates[r.id];
        if (!Wildlife.valid(r, s.regionClocks?.[r.id]?.appliedAt ?? s.appliedAt, id => Demography.group(s, id), s.clock)
          || !Wildlife.validRates(r, rate)) return null;
        if (!rate || !['renewal', 'demand', 'supply'].every(k => rate[k] && Object.values(rate[k]).every(nonnegative))
          || !rate.net || !Object.values(rate.net).every(Number.isFinite)) return null;
      }
      for (const g of s.groups) {
        if (!integer(g.choiceSerial) || !Array.isArray(g.knowledge) || !g.needs || !Object.values(g.needs).every(nonnegative)) return null;
        if (!Journeys.validState(g, s.calendar, s.clock, s.diagnosticOnly === true)) return null;
        if (g.intention && (!id(g.intention.destination) || !nonnegative(g.intention.chosenAt) || !(g.intention.departAt > s.clock - EPS))) return null;
        if (g.transit && (!Array.isArray(g.transit.path) || g.transit.path.length !== 2 || ![0, 1].includes(g.transit.edgeIndex)
          || !nonnegative(g.transit.departedAt) || !(g.transit.edgeArriveAt > s.clock - EPS)
          || !(g.transit.crossAt > g.transit.departedAt) || !(g.transit.edgeArriveAt > g.transit.crossAt)
          || g.transit.path.some(id => !s.regions.some(r => r.id === id)))) return null;
        for (const c of g.cohorts) if (!Demography.valid(c) || !Number.isFinite(c.bornAt) || !nonnegative(c.structuralKg) || c.massKg + EPS < c.structuralKg
          || !c.stores || !Object.values(c.stores).every(nonnegative) || !nonnegative(c.health) || c.health > 1
          || !integer(c.deathSerial) || !nonnegative(c.deathExposure) || !nonnegative(c.deathThreshold)
          || !c.needs || !Object.values(c.needs).every(nonnegative) || !Ecology.Work.towersValid(c)
          || c.intake && Object.values(c.intake).some(n => !nonnegative(n) || n > 1)) return null;
      }
      if (s.extraRates && (!Array.isArray(s.extraRates) || s.extraRates.some(r => {
        const g = s.groups.find(g => g.id === r.groupId), c = g?.cohorts.find(c => c.id === r.cohortId);
        return !c || !['activity', 'growth', 'brood', 'ecology'].includes(r.kind) || !nonnegative(r.perDay) || !nonnegative(r.factor)
          || r.factor > 1 || !r.inputs || !Object.values(r.inputs).every(nonnegative)
          || r.manaPerDay != null && !nonnegative(r.manaPerDay)
          || r.storeFunded != null && (r.storeFunded !== true || r.kind !== 'growth' || !nonnegative(r.storeReserveKg) || !c.foraging)
          || r.kind === 'brood' && !c.demography?.broods.some(b => b.id === r.broodId)
          || r.kind === 'ecology' && (!g.ecology || !nonnegative(r.workPerDay) || !r.outputs || !Object.values(r.outputs).every(nonnegative)
            || !Array.isArray(r.channels) || r.channels.some(k => !Ecology.channels.includes(k)));
      }))) return null;
      for (const [actorId, d] of Object.entries(s.details)) {
        if (actorId !== d.actorId || !id(d.memberId) || !integer(d.ordinal)
          || !['detailed', 'dead'].includes(d.status) || !s.groups.some(g => g.id === d.groupId && g.populationId === d.populationId)) return null;
        if (d.actor && (d.actor.id !== actorId || d.actor.speciesId !== d.speciesId || d.actor.populationId !== d.populationId
          || !nonnegative(d.actor.health) || !(d.actor.maxHealth > 0) || !Number.isFinite(d.actor.maxHealth) || d.actor.health > d.actor.maxHealth
          || d.actor.life?.originalMemberId !== d.memberId || d.actor.life.originalGroupId !== d.groupId || !Life.valid(d.actor) || !Bodies.valid(d.actor)
          || !Predation.validRemains(d.actor) || !Predation.validHunt(d.actor) || d.status === 'dead' && d.actor.status !== 'dead')) return null;
      }
      if (!Ecology.valid(s) || !Foodweb.validate(s) || !Scheduler.validate(s) || !Foraging.valid(s, id => Demography.group(s, id))) return null;
      audit(s); Demography.prepare(s, s.appliedAt); Scheduler.restore(s, schedulerOps); return s; // Restore indexes, never paid rates or choices.
    } catch { return null; }
  }
  return { DAY, count, cohortKey, monthAt, hazardIntegral, validateSource, create, createDiagnostic, chooseDestination,
    advance, settleRegions, detail, claimLocal, settleLocalLoss, registerLocalBirth, recordDetailedLoss, removeStock, destroyNursery, destroyRenewalSite, foodWebSummary: Foodweb.summary,
    destroyEcologicalWorkSite, setEcologicalActivity, damageFeedingTower, kill, audit, rebind, normalize };
});
