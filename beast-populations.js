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
    node ? require('./beast-foraging') : root.HelixBeastForaging,
    node ? require('./beast-parental-care') : root.HelixBeastParentalCare,
    node ? require('./beast-wind-drift') : root.HelixBeastWindDrift,
    node ? require('./carrion-lantern-biology') : root.HelixCarrionLanternBiology,
    node ? require('./beast-behavior') : root.HelixBeastBehavior,
    node ? require('./beast-spell-imitation') : root.HelixBeastSpellImitation,
    node ? require('./carrion-lantern-approach') : root.HelixCarrionLanternApproach);
  if (node) module.exports = api;
  root.HelixBeastPopulations = api;
})(globalThis, function (Biology, Life, Journeys, Wilderness, Predation, Bodies, Demography, Ecology, Foodweb, Scheduler, Wildlife, Foraging, Care, Wind, Lantern, Behavior, Spell, Approach) {
  'use strict';
  const DAY = 86400, EPS = 1e-8;
  // Accounts can exceed the engine's single-string limit at globe resolution.
  // Clone their large collections record-by-record, preserving JSON semantics.
  function copy(x) {
    if (Array.isArray(x) && x.length > 256) return x.map(v => v === undefined ? null : copy(v));
    if (x && typeof x === 'object' && Object.keys(x).length > 256)
      return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, copy(v)]));
    if (x && typeof x === 'object' && !Array.isArray(x)
      && (Array.isArray(x.regions) || Array.isArray(x.groups)))
      return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, copy(v)]));
    return JSON.parse(JSON.stringify(x));
  }
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
    if (!Wind.validDefinition(source)) throw Error('Invalid physical airflow');
    if (source.spatialContinuity != null && typeof source.spatialContinuity !== 'boolean') throw Error('Invalid physical continuity declaration');
    monthAt(source.calendar, 0);
    if (source.unlocated && (!Array.isArray(source.unlocated) || source.unlocated.some(row => !id(row.populationId)
      || !Biology.lifecycle[row.speciesId] || row.count != null && !integer(row.count)))) throw Error('Invalid original unlocated capacity');
    const regions = new Set(), groups = new Set(), cohorts = new Set();
    for (const r of source.regions) {
      if (r.deferred === true && source._deferredLoader) {
        if (!id(r.id) || regions.has(r.id) || !source._deferredLoader.header(r.id)) throw Error('Invalid deferred original region');
        regions.add(r.id); continue;
      }
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
      if ([r, ...(r.seasons || [])].some(env => env.humidity != null && (!Number.isFinite(env.humidity) || env.humidity < 0 || env.humidity > 100))) throw Error('Invalid actual air humidity');
      Ecology.validate(r); regions.add(r.id);
    }
    for (const r of source.regions) for (const edge of r.edges) if (!regions.has(edge.id) || !(edge.distanceKm > 0) || !Number.isFinite(edge.distanceKm)
      || typeof edge.traversable !== 'boolean') throw Error('Invalid regional edge');
    for (const g of source.groups) {
      if (!id(g.id) || groups.has(g.id) || !id(g.populationId) || !regions.has(g.regionId)
        || !Array.isArray(g.cohorts) || !Biology.lifecycle[g.speciesId]) throw Error('Invalid population group');
      groups.add(g.id);
      Ecology.validateGroup(g, source.regions);
      if (!Journeys.validSpec(g, source.calendar, source.diagnosticOnly === true || source.nativeEncounters === true)) throw Error('Invalid original seasonal route');
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
      ...(source.nativeEncounters === true ? { nativeEncounters: true } : {}),
      ...(source.regionalFoodWeb === true ? { regionalFoodWeb: true } : {}),
      ...(source.spatialContinuity === true ? { spatialContinuity: true } : {}),
      regions: source._deferredLoader ? source.regions : copy(source.regions), groups: source.groups.map(g => ({ ...copy(g), cohorts: g.cohorts.map(c => cohort(c, at)),
        knowledge: copy(g.knowledge || []), choiceSerial: 0, intention: null, transit: null, observedShortage: false })),
      details: {}, losses: [], lossBatches: [], births: [], plans: [], events: [], nextEventAt: at,
      nextDemographyAt: (Math.floor(at / DAY) + 1) * DAY, work: { boundaries: 0, cohortIntervals: 0 } };
    if (source._deferredLoader) Object.defineProperty(s, '_deferredLoader', { value: source._deferredLoader });
    s.originalCounts = {};
    for (const g of source.groups) s.originalCounts[g.populationId] = (s.originalCounts[g.populationId] || 0) + g.cohorts.reduce((n, c) => n + c.count, 0);
    s.origins = Object.fromEntries(source.groups.flatMap(g => g.cohorts.map(c => [c.id,
      { populationId: g.populationId, speciesId: c.speciesId, count: c.count }])));
    for (const r of s.regions) if (!r.deferred) Wildlife.initialize(r, at);
    Ecology.initialize(s); Foodweb.initialize(s, source.regionalFoodWeb === true); Care.initialize(s);
    if (s.foodWeb) Care.demand(s, at, Foodweb.bounds);
    plan(s, at, !s._deferredLoader);
    s.rates ||= {};
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
    if (Wind.enabled(g)) return; // A drift reference speed is not directed flight.
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
    for (const r of s.regions) if (!r.deferred) Wildlife.plan(r, month, at);
    Foodweb.plan(s, { ...month, plannedAt: at });
    for (const g of s.groups) {
      if (s.spatialContinuity) travelCarePlan(g, month, at);
      Ecology.plan(g, month);
      g.demographicPlan = { monthIndex: month.index, regionId: g.regionId, siteId: g.breeding?.siteId || null,
        requestedReproduction: Boolean(g.breeding && g.will !== false && g.willing !== false),
        ratePerDay: Biology.lifecycle[g.speciesId].attempts365 / 365 };
      if (Wind.enabled(g) || g.will === false || !g.cohorts.some(c => count(c))) continue;
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
  function travelCarePlan(g, month, at) {
    if (g.travelCare?.monthIndex !== month.index) g.travelCare = { monthIndex: month.index,
      plannedAt: at, end: month.end, limitSeconds: (month.end - at) * 2 / 3, usedSeconds: 0, stops: 0 };
    return g.travelCare;
  }
  function journeyStop(s, g, at) {
    const t = g.transit; if (!s.spatialContinuity || !t?.spatial || t.stop || !(t.nextStopCheckAt <= at + EPS)) return;
    t.nextStopCheckAt = at + DAY / 4;
    if (g.will === false || g.willing === false) return;
    const pos = Foodweb.transitPosition(g, at)?.position, r = Demography.region(s, location(g));
    if (!pos || pos.regionId !== r.id) return; // A scalar route fraction is not an established feeding location.
    const budget = travelCarePlan(g, monthAt(s.calendar, at), at), seconds = Math.min(DAY / 4,
      budget.limitSeconds - budget.usedSeconds, budget.end - at);
    if (seconds < 60) return;
    let reason = null;
    for (const c of g.cohorts) if (count(c)) {
      const rate = s.rates[r.id], n = count(c), foodUse = (c.needs.foodKg || 0) / n
        * (1 - (rate.supply[g.resources?.foodKg || 'foodKg'] ?? 0) * (c.intake.foodKg ?? 1));
      const waterUse = (c.needs.waterL || 0) / n
        * (1 - (rate.supply[g.resources?.waterL || 'waterL'] ?? 0) * (c.intake.waterL ?? 1));
      if (foodUse > EPS && c.stores.foodKg + c.stores.fatKg < foodUse * 2) { reason = 'hunger'; break; }
      if (waterUse > EPS && c.stores.waterL < waterUse * 2) { reason = 'thirst'; break; }
      if (c.regional?.stamina < 100 && Foraging.canRest(c, { ...g, transit: { ...t, stop: { position: pos } } }, r)) reason = 'fatigue';
    }
    if (!reason) return;
    const event = Journeys.pause(g, at, pos, at + seconds, reason);
    if (event) { budget.stops++; record(s, event.kind, at, event); }
  }
  function activateDeferred(s, ids, at) {
    const set = new Set(ids), regions = s._deferredLoader.load(ids);
    const edges = new Map(regions.map(r => [r.id, r.edges]));
    // No named group has entered this disconnected component yet. Outside
    // traversal edges cannot affect its anonymous wildlife or internal water.
    for (const r of regions) r.edges = r.edges.filter(e => set.has(e.id));
    const past = create({ id: s.sourceId, calendar: s.calendar, regions, groups: [],
      nativeEncounters: true, regionalFoodWeb: s.regionalFoodWeb, spatialContinuity: s.spatialContinuity },
    { worldId: s.worldId, runId: s.runId });
    advance(past, at, true, true);
    for (const r of past.regions) {
      r.edges = edges.get(r.id);
      const header = Demography.region(s, r.id);
      delete header.deferred; Object.setPrototypeOf(header, Object.prototype); Object.assign(header, r);
    }
    for (const [key, n] of Object.entries(past.work)) s.work[key] = (s.work[key] || 0) + n;
  }
  const schedulerOps = { location, rebuild: rebuildKernel, integrate, boundary, activateDeferred,
    refreshGroups: (s, groups) => Demography.refreshGroups(s, groups),
    dailyNeeded: s => Boolean(s.regions.some(r => r.ecology || r.wildlife) || s.groups.some(g => g.cohorts.some(c => count(c) && (c.aggregateMortality || c.demography)) || g.breeding) || s.extraRates?.length),
    movingDestinations: (g, at) => [g.intention?.departAt <= at + EPS ? g.intention.destination : null,
      g.transit && !g.transit.stop && (g.transit.crossAt <= at + EPS || g.transit.edgeArriveAt <= at + EPS) ? g.transit.path.at(-1) : null,
      ...Wind.destinations(g, at)].filter(Boolean),
    references: (g, at) => {
      const refs = new Set();
      for (const c of g.cohorts) {
        if (count(c) && c.windDrift?.front)
          for (const front of [c.windDrift.front, ...(c.windDrift.front.others || [])]) refs.add(front.neighborId);
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
        if (Wind.enabled(g) && count(c)) next = Math.min(next, Wind.plan(g, c, Demography.region(s, g.regionId), at, month,
          Foodweb.position(g, Demography.region(s, g.regionId), c, c.ranges[0][0]), Foodweb.actor(g, c, c.ranges[0][0], Demography.region(s, g.regionId), at),
          id => Demography.region(s.accountRoot || s, id)));
        const activity = Lantern.is(c) ? 1 + (p.travelMultiplier - 1) * Foraging.travelScale(c)
          : Journeys.moving(g) ? p.travelMultiplier : c.foraging?.action
            ? 1 + (p.travelMultiplier - 1) * Foraging.travelScale(c) : c.contactBusyUntil > at ? p.travelMultiplier : 1;
        const scale = count(c) * (c.massKg / p.adultKg) ** .75 * (juvenile ? p.juvenileMultiplier : 1) * activity;
        c.needs = {}; c.intake = {};
        for (const key of ['foodKg', 'waterL', 'mineralsKg']) {
          const need = p[({ foodKg: 'foodKgDay', waterL: 'waterLDay', mineralsKg: 'mineralsKgDay' })[key]] * scale;
          c.needs[key] = need;
          c.intake[key] = Care.dependent(c, at) && ['foodKg', 'waterL'].includes(key) ? 0 : Ecology.Work.intake(s, g, c, key);
          if (Lantern.is(c) && key === 'waterL') c.intake[key] = 0; // No remote ground-water drinking while airborne.
          g.needs[key] = (g.needs[key] || 0) + need * c.intake[key];
        }
        if (Lantern.is(c)) {
          const region = Demography.region(s, location(g)), env = region.seasons?.[month.season] || region;
          const maximum = Lantern.airRate(c.massKg, c.regional?.parts, { ...region, ...env });
          c.airReferenceKg = c.massKg;
          c.airIntakeLDay = count(c) ? Math.min(maximum, c.stores.waterL >= Lantern.waterCapacity(c.massKg) - EPS ? c.needs.waterL / count(c) : Infinity) : 0;
          r.demand.atmosphericWaterL = (r.demand.atmosphericWaterL || 0) + c.airIntakeLDay * count(c);
        }
        next = Math.min(next, nextDeath(c, at, until));
        if (c.bornAt + p.adultDays * DAY > at + EPS) next = Math.min(next, c.bornAt + p.adultDays * DAY);
        if (Care.dependent(c, at)) next = Math.min(next, c.bornAt + p.independentDays * DAY);
      }
      for (const [key, need] of Object.entries(g.needs)) {
        const stockKey = g.resources?.[key] || key;
        r.demand[stockKey] = (r.demand[stockKey] || 0) + need;
      }
      if (g.intention) next = Math.min(next, g.intention.departAt);
      if (g.transit) {
        if (Journeys.moving(g) && g.transit.nextStopCheckAt != null) for (const c of g.cohorts) if (count(c) && Care.dependent(c, at)) {
          // Review before a small dependent body's own reserve is exhausted,
          // not six hours later just because the adults have larger stores.
          for (const key of ['foodKg', 'waterL']) {
            const use = (c.needs[key] || 0) / count(c), stored = c.stores[key] + (key === 'foodKg' ? c.stores.fatKg : 0);
            if (use > EPS) g.transit.nextStopCheckAt = Math.min(g.transit.nextStopCheckAt, at + Math.max(60, stored / use * DAY * .5));
          }
        }
        next = Math.min(next, Journeys.next(g));
      }
      if (!Journeys.moving(g) && Demography.region(s, location(g))?.foraging)
        for (const c of g.cohorts) if (count(c)) next = Math.min(next, Foraging.next(c));
    }
    const extra = Ecology.requests(s, at, s.groups.flatMap(g => g.cohorts.flatMap(c => [...Demography.requests(s, g, c, at), ...Care.requests(s, g, c, at, Foodweb.careCapable, Foodweb.bounds)])));
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
        if (request.poolId ? !Wildlife.fed(r, request, rate) : request.kind === 'care' ? !Care.fundable(request) : Object.entries(request.c.needs).some(([k, n]) => n > 0
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
    next = Care.prepare(s, extra, at, next, rates);
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
      const rate = rates[location(g)];
      for (const [key, need] of Object.entries(c.needs)) {
        const deficit = Math.max(0, need * (1 - (rate.supply[g.resources?.[key] || key] ?? 0) * c.intake[key]) / n
          - (['foodKg', 'waterL'].includes(key) ? Foraging.intake(c, key) : 0)
          - (key === 'waterL' ? (c.airIntakeLDay || 0) * (rate.supply.atmosphericWaterL || 0) : 0) - Care.intake(c, key));
        if (!(deficit > EPS)) continue;
        next = Math.min(next, Care.review(c, at, key, deficit));
        const stored = (c.stores[key] || 0) + (key === 'foodKg' ? c.stores.fatKg : 0);
        if (stored > EPS) next = Math.min(next, at + stored / deficit * DAY);
        else {
          // Health tracks the fraction of THIS body's requirement unmet. A tiny
          // orphan does not survive months without water merely because its
          // missing ration was divided by an adult's much larger requirement.
          const daily = need / n;
          c.healthLossPerDay += deficit / daily * (key === 'waterL' ? .4 : .1);
          c.scarcityCause = key === 'waterL' ? 'dehydration' : key === 'foodKg' ? 'starvation' : 'mineralDeficiency';
        }
      }
      if (Lantern.is(c) && count(c)) {
        // Carrion overflow is already resolved during ingestion, against the
        // actual stored water and the simultaneous maintenance. Its nominal
        // intake overstates retention and must not schedule repeated, tiny
        // speculative cap events. Only uncapped atmospheric intake needs this.
        const waterNet = (c.airIntakeLDay || 0) * (rate.supply.atmosphericWaterL || 0) - c.needs.waterL / count(c);
        const room = Lantern.waterCapacity(c.massKg) - c.stores.waterL;
        if (waterNet > EPS && room > EPS) next = Math.min(next, at + room / waterNet * DAY);
      }
      if (c.healthLossPerDay > 0) {
        next = Math.min(next, at + c.health / c.healthLossPerDay * DAY);
        // Hunger does not instantly prohibit care, but declining health must
        // interrupt it at incapacity, not continue until the death boundary.
        if (c.caregiving && c.health > .3) next = Math.min(next, at + (c.health - .3) / c.healthLossPerDay * DAY);
      }
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
        if (key === 'waterL' && r.ecology?.floodable) Ecology.Work.Flood.integrate(r, rate, days, overflow, to);
        else if (overflow > 0) { r.outputs ||= {}; const k = `${key}Overflow`; r.outputs[k] = (r.outputs[k] || 0) + overflow; }
        r.stocks[key] = Math.max(0, Math.min(r.capacity[key] || 0, before + days * net));
        r.receipts[key] = (r.receipts[key] || 0) + r.stocks[key] - before;
      }
      Ecology.Work.integrateWater(r, rate, days, waterBefore);
    }
    for (const q of s.extraRates || []) if (q.kind === 'care') Care.integrate(s, q, days);
    for (const g of s.groups) {
      const r = Demography.region(s, location(g)), rate = s.rates[r.id];
      if (g.transit?.stop) g.travelCare.usedSeconds += to - from;
      for (const c of g.cohorts) {
        const n = count(c); if (!n) continue;
        if (Lantern.is(c)) {
          const water = (c.airIntakeLDay || 0) * (rate.supply.atmosphericWaterL || 0) * days;
          c.stores.waterL += water; c.massKg += water;
          r.airMoistureTakenL = (r.airMoistureTakenL || 0) + water * n;
        }
        if (Wind.enabled(g)) Wind.integrate(c, to);
        Foraging.integrate(s.accountRoot || s, r, g, c, from, to, rate);
        Care.effort(c, to - from, r);
        if (Journeys.moving(g) && c.regional) c.regional.at = to; // Moving travel is not banked supplied rest; an actual stop can earn it.
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
            if (!c.firstScarcity) {
              const animalMatterKg = key === 'foodKg' ? (r.wildlife?.pools || []).reduce((n, p) => n + Wildlife.mass(p) + p.carcass.edibleKg, 0)
                + [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {})].reduce((n, body) => n + (body.edibleKg || 0), 0) : 0;
              c.firstScarcity = { at: from, regionId: location(g),
                phase: g.transit?.stop ? 'stopped' : g.transit ? 'travelling' : 'stationary',
                dependent: Care.dependent(c, from), afterPersonalArrival: g.knowledge.some(k => k.source === 'personalArrival' && k.at <= from),
                inventory: { snapshotAt: to, resource: stockKey, regionalStock: r.stocks[stockKey] || 0,
                  renewalPerDay: rate.renewal[stockKey] || 0, regionalAnimalMatterKg: animalMatterKg } };
            }
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
      if (rate.kind === 'ecology' || rate.kind === 'care') continue;
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
    const scarcity = ['starvation', 'dehydration', 'mineralDeficiency'].includes(cause) ? scarcityContext(s, g, c, at) : null;
    Care.cancelAffected(g, c, at);
    Foodweb.cancel(s, g.id, c.id, ranges, at);
    Ecology.lostContributor(s, g, c, n, at, cause, `loss-batch:${c.originId}:${location(g)}:${cause}`);
    c.ranges = Demography.subtract(c.ranges, ranges);
    s.lossBatches ||= [];
    const batchId = `loss-batch:${c.originId}:${location(g)}:${cause}`;
    let b = s.lossBatches.find(b => b.id === batchId);
    if (!b) { b = { id: batchId, populationId: g.populationId, speciesId: g.speciesId, originId: c.originId,
      groupId: g.id, regionId: location(g), cause, ranges: [], count: 0, firstAt: at, lastAt: at, massKg: 0 }; s.lossBatches.push(b); }
    b.ranges = Demography.union([...b.ranges, ...ranges]); b.count += n; b.lastAt = at; b.massKg += c.massKg * n;
    if (scarcity) b.context = scarcity;
    const r = s.regions.find(r => r.id === location(g));
    if (s.foodWeb) Foodweb.addRemains(s, r, batchId, g, c, n, at, cause, n === 1 ? Foodweb.position(g, r, c, ranges[0][0]) : null);
    else {
      r.remainsBatches ||= {};
      const remains = r.remainsBatches[batchId] ||= { count: 0, massKg: 0, edibleKg: 0, firstAt: at, lastAt: at };
      remains.count += n; Predation.tissues.add(remains, c.massKg * n, c.speciesId, Predation.tissues.inertMatter(c) * n); remains.lastAt = at;
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
    Foodweb.birthPosition(s, g, parent, c, brood, at);
    Care.attach(g, c, at, [parent.originId, brood.mateOriginId]);
    let birth = s.births.find(b => b.originId === originId);
    if (!birth) { birth = { originId, populationId: g.populationId, count: 0, firstAt: at, lastAt: at, parentOrigins: [] }; s.births.push(birth); }
    birth.count += n; birth.lastAt = at;
    if (!birth.parentOrigins.includes(parent.originId)) birth.parentOrigins.push(parent.originId);
    return c;
  }
  function lose(s, g, c, ordinal, cause, at) {
    const region = Demography.region(s, location(g));
    const stored = c.personalActor?.nativePopulation && c.personalActor;
    const pos = stored && (Foodweb.position(g, region, c, ordinal) || Foodweb.transitPosition(g, at)?.position);
    const personal = pos?.regionId === region.id && (Foodweb.actor(g, c, ordinal, region, at) || copy(stored));
    const scarcity = ['starvation', 'dehydration', 'mineralDeficiency'].includes(cause) ? scarcityContext(s, g, c, at) : null;
    if (!remove(c, ordinal)) return false;
    Care.cancelAffected(g, c, at);
    Foodweb.cancel(s, g.id, c.id, [[ordinal, ordinal + 1]], at);
    Ecology.lostContributor(s, g, c, 1, at, cause, cohortKey(c, ordinal));
    const loss = { memberId: cohortKey(c, ordinal), populationId: g.populationId, speciesId: g.speciesId,
      groupId: g.id, originId: c.originId || c.id, ordinal, regionId: location(g), cause, at, massKg: c.massKg };
    if (scarcity) loss.context = scarcity;
    s.losses.push(loss);
    const r = s.regions.find(r => r.id === loss.regionId);
    // Remains are real finite matter and are not renewable generic prey.
    if (personal) {
      const a = personal, n = stored.nativePopulation;
      a.id = stored.id; a.roomId = stored.roomId; a.status = 'dead'; a.health = 0; a.diedAt = at;
      a.bodyPhysics.massKg = c.massKg; a.bodyPhysics.altitudeM = pos.altitudeM;
      a.bodyPhysics.parts = copy(c.regional.parts); a.life.armourKg = c.regional.armourKg; a.life.energy = copy(c.regional.energy);
      a.life.originalGroupId = g.id; a.life.originalMemberId = loss.memberId;
      a.life.bornAt = c.bornAt; a.life.ageDays = Math.max(0, (at - c.bornAt) / DAY); a.life.lastAt = at;
      a.nativePopulation = { ...copy(n), regionId: r.id, sourcePosition: copy(pos), background: true };
      const tile = n.tileSizeM || 1;
      a.mapCell = { x: n.bounds.x + Math.floor((pos.eastM - n.frame.eastM) / tile),
        y: n.bounds.y + Math.floor((pos.northM - n.frame.northM) / tile), z: n.bounds.z };
      Predation.remains(a, at);
      const detail = { actorId: a.id, memberId: loss.memberId, populationId: g.populationId, speciesId: g.speciesId,
        groupId: g.id, cohortId: c.id, ordinal, regionId: r.id, detailedAt: at, diedAt: at, status: 'dead', actor: a };
      (s.accountRoot || s).details[a.id] = detail; s.details[a.id] = detail;
      Foodweb.addRemains(s, r, loss.memberId, g, c, 1, at, cause, pos);
      detail.regionalCorpse = true;
      detail.remainsKey = Object.keys(r.remainsBatches).find(key => r.remainsBatches[key].sourceKey === loss.memberId);
      Scheduler.noteDetail(s.accountRoot || s, a.id);
    } else if (s.foodWeb) Foodweb.addRemains(s, r, loss.memberId, g, c, 1, at, cause, Foodweb.position(g, r, c, ordinal));
    else {
      r.remains ||= {}; const remains = r.remains[loss.memberId] = { massKg: 0, edibleKg: 0, at, cause };
      Predation.tissues.add(remains, c.massKg, c.speciesId, Predation.tissues.inertMatter(c));
    }
    if (c.personalActor) delete c.personalActor;
    record(s, 'loss', at, { memberId: loss.memberId, cause }); return true;
  }
  function scarcityContext(s, g, c, at) {
    return { ageDays: Math.max(0, (at - c.bornAt) / DAY), dependent: Care.dependent(c, at),
      phase: g.transit?.stop ? 'stopped' : g.transit ? 'travelling' : 'stationary',
      afterPersonalArrival: g.knowledge.some(k => k.source === 'personalArrival' && k.at <= at),
      firstFailure: copy(c.firstScarcity || null),
      knownLivingCaregivers: c.dependency ? g.cohorts.filter(d => c.dependency.guardians.includes(d.originId)).reduce((v, d) => v + count(d), 0) : 0,
      ...(Care.dependent(c, at) ? { careAccess: Care.situation(s, g, c, at, Foodweb.bounds, Foodweb.careCapable) } : {}),
      monthlySearchSeconds: c.foraging?.plan.used.search || 0,
      monthlyCareSeconds: c.parentalLedger?.usedSeconds || 0,
      ...(g.transit?.spatial ? { routeProgress: Foodweb.transitPosition(g, at) } : {}) };
  }
  function boundary(s, at) {
    if (s.work) s.work.boundaries++;
    Care.finish(s, at);
    for (const g of [...s.groups]) if (Wind.enabled(g)) for (const c of [...g.cohorts].reverse()) {
      if (!count(c) || !c.windDrift?.crossing || c.windDrift.until > at + EPS) continue;
      const r = Demography.region(s, g.regionId), edge = r.edges.find(e => e.id === c.windDrift.crossing.destination);
      if (!c.windDrift.control && Wind.convergence(r, edge, Foodweb.actor(g, c, c.ranges[0][0], r, at), monthAt(s.calendar, at).season,
        id => Demography.region(s.accountRoot || s, id))) { delete c.windDrift.crossing; continue; }
      const position = Wind.entry(c), root = s.accountRoot || s;
      c.windCrossings = (c.windCrossings || 0) + 1;
      Foodweb.handoff(s, g.id, c.id, at, { region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args) });
      let owner = g;
      if (g.cohorts.length > 1) {
        const flock = g.windFlockId || g.id;
        owner = { ...copy(g), id: `${flock}:drift:${c.id}:${c.windCrossings}`, windFlockId: flock, cohorts: [c], breeding: null, instinct: null, seasonal: null,
          intention: null, transit: null, regionId: position.regionId };
        g.cohorts = g.cohorts.filter(row => row !== c); root.groups.push(owner);
        if (s !== root) s.groups.push(owner);
        Scheduler.registerGroup(root, owner, at);
      }
      owner.regionId = position.regionId; c.regionalPosition = position; delete c.windDrift;
      // Crossing releases the old meal and cancels its actions. In a world
      // with seasonal circulation, observe from the actual new airspace
      // immediately instead of carrying that handoff's six-hour idle delay
      // through a narrow coastal feeding window.
      if (c.foraging && (r.seasons?.some(p => p.wind)
        || Demography.region(root, position.regionId)?.seasons?.some(p => p.wind))) c.foraging.nextAt = at;
      record(s, 'windCrossing', at, { groupId: owner.id, cohortId: c.id, regionId: owner.regionId });
    }
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
        const caringUntil = Math.max(at, ...g.cohorts.map(c => c.caregiving?.until || at));
        if (caringUntil > at + EPS) {
          // Preserve this same chosen destination. Finish already-started local
          // care rather than repeatedly cancelling it at an arbitrary window.
          g.intention.departAt = caringUntil;
        } else {
          for (const c of g.cohorts) Care.cancelAffected(g, c, at);
          Foodweb.cancelForaging(s, g, at);
          const r = Demography.region(s, g.regionId), edge = r.edges.find(e => e.id === g.intention.destination);
          const spatial = Foodweb.travelPlan(s, g, r, edge, at), p = Biology.lifecycle[g.speciesId];
          const pace = spatial?.pace ? Math.min(1, ...spatial.pace.map(c => (c.juvenile ? Math.cbrt(c.massKg / p.adultKg) : 1) * c.mobility)) : 1;
          for (const event of Journeys.depart(g, at, r, p.travelKmDay * pace, spatial))
            record(s, event.kind, event.at, event);
        }
      }
      if (g.transit?.stop?.until <= at + EPS) {
        const budget = travelCarePlan(g, monthAt(s.calendar, at), at), remaining = Math.min(600,
          budget.limitSeconds - budget.usedSeconds, budget.end - at);
        if (remaining >= 60 && Care.waiting(s, g, at, Foodweb.bounds, Foodweb.careCapable)) {
          // Same position, same pause, same finite monthly time owner. This is
          // a local unfinished feeding, not a destination-capacity forecast.
          g.transit.stop.until = at + remaining;
        } else {
          Foodweb.foragers(s, at, monthAt(s.calendar, at), g.id); // Resolve earned work before releasing unfinished custody.
          Foodweb.cancelForaging(s, g, at);
          for (const c of g.cohorts) Care.cancelAffected(g, c, at);
          const event = Journeys.resume(g, at); if (event) record(s, event.kind, at, event);
        }
      }
      const spatial = g.transit?.spatial;
      for (const event of Journeys.arrive(g, at)) {
        if (event.kind === 'arrival') Foodweb.arrived(g, spatial, at);
        record(s, event.kind, event.at, event);
      }
      journeyStop(s, g, at);
    }
    plan(s, at, false);
    const demographicTick = at + EPS >= (s.nextDemographyAt ?? Infinity);
    if (demographicTick) s.nextDemographyAt = (Math.floor((at + EPS) / DAY) + 1) * DAY;
    for (const r of s.regions) if (!r.deferred) Wildlife.boundary(r, at, demographicTick);
    const foodApi = {
      region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args)
    };
    if (s.accountRoot) Foodweb.finish(s.accountRoot, at, foodApi, s.regionIds);
    else Foodweb.advance(s, at, monthAt(s.calendar, at), foodApi);
    if (s.foodWeb) Care.demand(s, at, Foodweb.bounds);
    Foodweb.foragers(s, at, monthAt(s.calendar, at), null,
      (g, c) => Care.start(s, at, Foodweb.bounds, Foodweb.restore, Foodweb.careCapable, g.id, c.id));
    if (s.foodWeb) Care.start(s, at, Foodweb.bounds, Foodweb.restore, Foodweb.careCapable);
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
  function advanceBudget(s, at, budget = 32) {
    if (!nonnegative(at) || at < s.clock || !Number.isSafeInteger(budget) || budget < 1) throw Error('Invalid elapsed-work budget');
    if (!Scheduler.active(s)) Scheduler.restore(s, schedulerOps);
    return Scheduler.advance(s, at, false, budget);
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
    Care.cancelAffected(g, c, at);
    Foodweb.handoff(s, groupId, cohortId, at, { region: id => Demography.region(s, id), group: id => Demography.group(s, id), lose: (...args) => lose(s, ...args) });
    if (!c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) { rebuild(s, at, location(g)); return null; }
    // Save only the original metadata needed to resume the same work/care
    // stream. Do not copy the entire cohort's membership or the personal body.
    const returnCohort = s.nativeEncounters || c.personalActor ? copy(Object.fromEntries(
      ['sex', 'deathSerial', 'deathExposure', 'deathThreshold', 'contactSplit', 'nurseryId', 'dependency',
        'parentalLedger', 'feedingTowers', 'foraging', 'ecologyHistory', 'unmet', 'firstScarcity', 'windCrossings'].map(key => [key, c[key]]))) : null;
    const returnGroup = returnCohort ? copy({ ...g, cohorts: [] }) : null;
    const demographicHandoff = Demography.handoff(c, ordinal, at);
    if (!remove(c, ordinal)) return null;
    const memberId = cohortKey(c, ordinal);
    if (Object.values(s.details).some(d => d.memberId === memberId)) throw Error('Duplicate individual claim');
    const result = { actorId, memberId, populationId: g.populationId, groupId, cohortId, ordinal,
      speciesId: g.speciesId, regionId: location(g), detailedAt: at, status: 'detailed',
      ageDays: Math.max(0, (at - (c.birthSpan?.[1] ?? c.bornAt)) / DAY), massKg: c.massKg, structuralKg: c.structuralKg,
      stores: copy(c.stores), role: c.role, colonyId: c.colonyId, health: c.health,
      ...(c.dependency ? { dependency: copy(c.dependency) } : {}),
      ...(c.parentalLedger ? { parentalLedger: copy(c.parentalLedger) } : {}),
      ...(c.feedingTowers ? { feedingTowers: copy(c.feedingTowers) } : {}),
      ...(c.nurseryId ? { nurseryId: c.nurseryId } : {}),
      ...(demographicHandoff ? { demography: demographicHandoff } : {}), ...(c.birthSpan ? { birthSpan: copy(c.birthSpan) } : {}),
      ...(returnCohort ? { returnCohort, returnGroup } : {}) };
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
    const a = previewLocal(g, c, ordinal, actorId, at, ctx, position);
    if (!a) return null;
    const personal = c.personalActor;
    const d = detail(s, groupId, cohortId, ordinal, actorId, at); if (!d) return null;
    if (!personal) a.maxHealth = Math.max(1, a.maxHealth * Math.min(1, Math.sqrt(d.massKg / Biology.lifecycle[g.speciesId].adultKg)));
    a.health = a.maxHealth * d.health;
    a.life.stores = copy(d.stores); a.life.structuralKg = d.structuralKg;
    if (c.regional) {
      a.life.armourKg = c.regional.armourKg;
      a.beastConditions = copy(c.regional.conditions); a.life.cooldowns = copy(c.regional.cooldowns);
    }
    a.life.bornAt = at - d.ageDays * DAY;
    a.life.ageDays = d.ageDays; a.life.lastAt = at; a.life.wasLocal = true;
    a.life.physicalAt = at;
    a.bodyPhysics.lastAt = at; a.bodyPhysics.wasLocal = true;
    a.life.originalMemberId = d.memberId;
    a.life.originalGroupId = groupId;
    if (d.dependency) a.life.parentalDependency = copy(d.dependency);
    if (d.demography) {
      a.life.opportunities = d.demography.opportunities;
      a.life.lastAttemptAt = d.demography.lastAttemptAt ?? a.life.lastAttemptAt;
      a.life.populationBroods = copy(d.demography.broods);
    }
    a.life.reproduction = null;
    if (personal) delete c.personalActor;
    s.details[actorId].actor = a; Scheduler.noteDetail(s, actorId); return a;
  }
  // Try the exact supplied body in the same physical context, without claiming it.
  function previewLocal(g, c, ordinal, actorId, at, ctx, position) {
    if (!position || position.regionId !== location(g) || !position.cell
      || !['x', 'y', 'z'].every(k => Number.isInteger(position.cell[k]))) return null;
    const personal = c.personalActor;
    if (personal && personal.id !== actorId) return null;
    const a = personal ? copy(personal) : Wilderness.actor(g.speciesId, actorId, position.cell, g.populationId, at,
      { ageDays: (at - c.bornAt) / DAY, massKg: c.massKg, role: c.role, colonyId: c.colonyId, will: g.will, willing: g.willing });
    if (personal) {
      a.mapCell = copy(position.cell); a.homeCell = copy(position.cell);
      const scale = personal.life.structuralKg > 0 ? Math.cbrt(c.structuralKg / personal.life.structuralKg) : 1;
      for (const key of Object.keys(a.bodyPhysics.dimensions)) a.bodyPhysics.dimensions[key] *= scale;
      a.bodyPhysics.massKg = c.massKg;
    }
    if (Number.isFinite(position.altitudeM)) a.bodyPhysics.altitudeM = position.altitudeM;
    if (position.mode) a.bodyPhysics.mode = position.mode;
    const reserves = ctx.originalReserves?.(g, c, ordinal, at), manaOwner = a.spellImitation || a.bodyPhysics;
    // A caller must supply attributable personal reserves, including any saved
    // regional contact history; never create a freshly full pool on handoff.
    if (!reserves || !nonnegative(reserves.mana) || reserves.mana > (personal ? Biology.lifecycle[g.speciesId].manaCapacity : manaOwner.mana)
      || !nonnegative(reserves.stamina) || reserves.stamina > (personal ? 300 : a.bodyPhysics.stamina)
      || !reserves.energy || !Object.keys(a.life.energy).every(k => nonnegative(reserves.energy[k]))) return null;
    manaOwner.mana = reserves.mana; a.bodyPhysics.stamina = reserves.stamina;
    a.life.energy = copy(reserves.energy);
    if (c.feedingTowers) c.feedingTowers.forEach((health, i) => { a.bodyPhysics.parts[`feeding tower ${i + 1}`] = health; });
    if (c.regional) for (const [part, health] of Object.entries(c.regional.parts)) a.bodyPhysics.parts[part] = health;
    const modes = Bodies.profiles[g.speciesId].modes;
    if (!Bodies.valid(a) || !(modes.includes(a.bodyPhysics.mode) || a.bodyPhysics.mode === 'walking' && modes.includes('charging')
      || a.bodyPhysics.mode === 'grounded' && modes.includes('flight'))
      || Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode === 'grounded' ? 'walking' : a.bodyPhysics.mode, Bodies.height(a), ctx)) return null;
    return a;
  }
  function returnLocal(s, actorId, at, position) {
    const d = s.details[actorId], a = d?.actor;
    if (!a || d.status !== 'detailed' || a.status === 'dead' || !(a.health > 0)
      || !Life.valid(a) || !Bodies.valid(a) || !nonnegative(at) || at < s.clock
      || !position || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(position[k]))
      || !Demography.region(s, position.regionId)) return false;
    advanceLocal(s, at, [position.regionId, d.regionId]);
    const lastDamageAt = a.life.lastDamageAt;
    Behavior.interrupt(a, at, 'Returning to regional physical ownership');
    if (lastDamageAt == null) delete a.life.lastDamageAt; else a.life.lastDamageAt = lastDamageAt;
    Spell.interrupt(a, 'Local channel ended at physical handoff', at);
    Approach.stop(a.life, at, 'interrupted');
    delete a.life.wildlifeContact;
    a.life.lastAt = at;
    if (a.life.hunt && a.life.hunt.endedAt == null) {
      a.life.hunt.endedAt = at; a.life.hunt.outcome = 'local pursuit interrupted';
    }
    a.bodyPhysics.motion = null; a.bodyPhysics.turn = null;
    const original = Demography.group(s, d.groupId);
    if (!original) return false;
    const template = d.returnCohort || original.cohorts.find(c => c.id === d.cohortId)
      || { deathSerial: 0, ...Object.fromEntries(['nurseryId', 'dependency', 'parentalLedger', 'feedingTowers']
        .filter(key => d[key] != null).map(key => [key, d[key]])) };
    const originalKnowledge = d.returnGroup?.knowledge || [];
    let g = original;
    if (location(g) !== position.regionId || g.transit
      || JSON.stringify(g.knowledge) !== JSON.stringify(originalKnowledge)) {
      const previous = Demography.group(s, `returned-group:${d.memberId}`);
      const groupId = previous ? `returned-group:${d.memberId}:${at}` : `returned-group:${d.memberId}`;
      g = Demography.group(s, groupId);
      if (!g) {
        g = { ...copy(d.returnGroup || { ...original, cohorts: [] }), id: groupId, cohorts: [], regionId: position.regionId,
          home: { patchId: position.regionId, cellId: Demography.region(s, position.regionId).cellId || 'original-region',
            eastKm: position.eastM / 1000, northKm: position.northM / 1000, depthM: -position.altitudeM },
          knowledge: copy(originalKnowledge), regionalPosition: { ...copy(position), establishedAt: at },
          intention: null, transit: null, seasonal: null };
        if (g.ecology?.regionId && g.ecology.regionId !== g.regionId) delete g.ecology;
        const month = monthAt(s.calendar, at), hunts = Math.min(original.foodWebPlan?.huntingRemaining || 0,
          Math.floor(Biology.lifecycle[g.speciesId].huntsDay * (month.end - at) / DAY));
        if (original.foodWebPlan) original.foodWebPlan.huntingRemaining -= hunts;
        g.foodWebPlan = { monthIndex: month.index, plannedAt: at, huntingRemaining: hunts, contactPulses: 0 };
        g.demographicPlan = { monthIndex: month.index, regionId: g.regionId, siteId: g.breeding?.siteId || null,
          requestedReproduction: Boolean(g.breeding), ratePerDay: Biology.lifecycle[g.speciesId].attempts365 / 365 };
        s.groups.push(g); Scheduler.registerGroup(s, g, at);
      }
    }
    const c = copy(template), p = Biology.lifecycle[d.speciesId], workParts = Behavior.definitions[g.ecology?.action]?.parts;
    Object.assign(c, { id: `returned:${d.memberId}`, originId: d.memberId.slice(0, d.memberId.lastIndexOf(':')),
      speciesId: d.speciesId, ranges: [[d.ordinal, d.ordinal + 1]], generated: false, contactSplit: true,
      bornAt: a.life.bornAt, massKg: a.bodyPhysics.massKg, structuralKg: a.life.structuralKg,
      stores: copy(a.life.stores), health: a.health / a.maxHealth, role: a.life.role, colonyId: a.life.colonyId,
      regionalPosition: copy(position), personalActor: copy(a),
      regional: { at, stamina: a.bodyPhysics.stamina, mana: (a.spellImitation || a.bodyPhysics).mana,
        energy: copy(a.life.energy), parts: copy(a.bodyPhysics.parts), armourKg: a.life.armourKg,
        conditions: copy(a.beastConditions || []), cooldowns: copy(a.life.cooldowns || {}), originalTissueAccounted: true,
        workBlocked: Boolean(workParts && Bodies.wounded(a, workParts) >= .65) } });
    if (!template.contactSplit) { c.deathExposure = 0; c.deathThreshold = exponential(`${d.memberId}:personal-background`); }
    for (const key of ['aggregateMortality', 'mortalityBalance', 'batchHazard', 'batchMembers', 'birthSpan', 'regionalFormation', 'contactBusyUntil', 'caregiving', 'windDrift']) delete c[key];
    if (c.feedingTowers) c.feedingTowers = c.feedingTowers.map((_, i) => a.bodyPhysics.parts[`feeding tower ${i + 1}`]);
    c.demography = { credit: a.life.opportunities || 0, serial: a.life.attemptSerial || 0,
      cooldowns: a.life.lastAttemptAt != null && a.life.lastAttemptAt + p.cooldownDays * DAY > at
        ? [{ ranges: copy(c.ranges), until: a.life.lastAttemptAt + p.cooldownDays * DAY }] : [], broods: [] };
    for (const b of [...(a.life.populationBroods || []), ...(a.life.reproduction ? [a.life.reproduction] : [])]) if (b.disposedAt == null) {
      c.demography.broods.push({ ...copy(b), localId: b.id, parents: copy(c.ranges), successful: b.success ? copy(c.ranges) : [],
        parentOriginId: c.originId, mateOriginId: null, regionId: b.sourceRegionId || position.regionId,
        nurseryId: b.sourceNurseryId || g.breeding?.siteId || null, manaStockKey: g.breeding?.manaStockKey || null,
        materialRecipe: b.materialRecipe || { [g.resources?.foodKg || 'foodKg']: 1 } });
    }
    c.personalActor.life.populationBroods = []; c.personalActor.life.reproduction = null;
    if (c.foraging) {
      c.foraging.mealIds = []; c.foraging.action = null; c.foraging.bout = null; c.foraging.phase = 'idle';
      c.foraging.lastAt = at; c.foraging.nextAt = at + 1e-6;
      Foraging.plan(g, c, monthAt(s.calendar, at), at);
    }
    c.personalActor.life.originalGroupId = g.id;
    g.cohorts = g.cohorts.filter(old => old.id !== c.id || count(old));
    g.cohorts.push(c); delete s.details[actorId]; Scheduler.noteDetail(s, actorId);
    rebuild(s, at, [g.regionId, d.regionId]);
    record(s, 'returnedToBackground', at, { actorId, memberId: d.memberId, regionId: position.regionId });
    return true;
  }
  function settleLocalLoss(s, actorId, at, cause) {
    const d = s.details[actorId], a = d?.actor;
    if (!a || a.status !== 'dead' || a.health > 0 || !id(cause) || !nonnegative(at) || at < s.clock) return false;
    const r = Predation.remains(a, at);
    if (!recordDetailedLoss(s, actorId, at, cause, r.massKgAtDeath)) return false;
    return true;
  }
  function releaseCorpse(s, actorId, at, position) {
    const d = s.details[actorId], a = d?.actor;
    if (!d || d.status !== 'dead' || !a || !s.foodWeb || !nonnegative(at) || at < s.clock
      || !position || position.regionId !== d.regionId) return false;
    if (d.regionalCorpse) return true;
    advanceLocal(s, at, [d.regionId]);
    const r = Demography.region(s, d.regionId), loss = s.losses.find(l => l.memberId === d.memberId);
    if (!loss || loss.detailOwner !== actorId) return false;
    const body = Predation.remains(a, at), key = `native-corpse:${d.memberId}`;
    for (const b of [...(a.life.populationBroods || []), ...(a.life.reproduction ? [a.life.reproduction] : [])]) if (b.disposedAt == null) {
      r.outputs ||= {};
      r.outputs.failedRecruitmentKg = (r.outputs.failedRecruitmentKg || 0)
        + Math.max(0, b.investedKg - Biology.lifecycle[d.speciesId].newbornKg * b.emitted.length);
      b.disposedAt = at;
    }
    r.remainsBatches ||= {};
    r.remainsBatches[key] = { ...copy(body), count: 1, sourceKey: d.memberId, speciesId: d.speciesId, groupId: d.groupId,
      position: copy(position), firstAt: loss.at, lastDeathAt: loss.at, cause: loss.cause };
    for (const k of ['consumedKg', 'decomposedKg']) s.foodWeb.receipts[k] += body[k] - (d.regionalReceipt?.[k] || 0);
    delete d.regionalReceipt; delete loss.detailOwner;
    d.regionalCorpse = true; d.remainsKey = key;
    return true;
  }
  function claimCorpse(s, actorId, at) {
    const d = s.details[actorId];
    if (!d || d.status !== 'dead' || !nonnegative(at) || at < s.clock) return false;
    if (!d.regionalCorpse) return true;
    advanceLocal(s, at, [d.regionId]);
    const r = Demography.region(s, d.regionId), body = r.remainsBatches?.[d.remainsKey];
    if (!body || body.massKg <= EPS || body.reservedKg > EPS) return false;
    const loss = s.losses.find(l => l.memberId === d.memberId);
    d.actor.life.remains = { ...copy(body), massKgAtDeath: loss.massKg };
    d.actor.bodyPhysics.massKg = body.massKg;
    d.regionalReceipt = { consumedKg: body.consumedKg, decomposedKg: body.decomposedKg };
    loss.detailOwner = actorId; delete r.remainsBatches[d.remainsKey];
    delete d.regionalCorpse; delete d.remainsKey;
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
  function setDrainageObstruction(s, regionId, blocked, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock || typeof blocked !== 'boolean') return false;
    advanceLocal(s, at, [regionId]);
    const course = Demography.region(s, regionId)?.ecology?.watercourses?.[0];
    if (!course?.outlet || Boolean(course.outlet.blocked) === blocked) return false;
    course.outlet.blocked = blocked;
    record(s, 'drainageObstructionChanged', at, { regionId, courseId: course.id, blocked, cause });
    rebuild(s, at, regionId); return true;
  }
  function setDreamParticipants(s, regionId, siteId, participantGroupIds, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock || !Array.isArray(participantGroupIds)
      || participantGroupIds.some(v => !id(v)) || new Set(participantGroupIds).size !== participantGroupIds.length) return false;
    advanceLocal(s, at, [regionId]);
    const r = Demography.region(s, regionId), site = r?.ecology?.workSites.find(site => site.id === siteId && site.action === 'dreamWeather');
    if (!site || site.destroyedAt != null || participantGroupIds.some(id => {
      const g = Demography.group(s, id);
      return !g || g.regionId !== regionId || g.transit || g.will === false || g.willing === false
        || ['slime', 'mudlet', 'cinderling', 'zephyrMote', 'quartzShardling', 'rootling', 'sporecap', 'lanternWisp'].includes(g.speciesId)
        || !g.cohorts.some(c => count(c) && c.health > .3 && Ecology.Work.inReach(g, c, site));
    })) return false;
    if (!participantGroupIds.length && site.allowDormantParticipants !== true) return false;
    site.participantGroupIds = [...participantGroupIds];
    record(s, 'dreamParticipantsChanged', at, { regionId, siteId, participantGroupIds: [...participantGroupIds], cause });
    rebuild(s, at, regionId); return true;
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
    if (s._deferredLoader) {
      result.regions = result.regions.map(r => r.deferred ? s._deferredLoader.header(r.id) : r);
      Object.defineProperty(result, '_deferredLoader', { value: s._deferredLoader });
    }
    if (s.worldId === from?.worldId && s.runId === from?.runId && id(to?.worldId) && id(to.runId)) Object.assign(result, to);
    return result;
  }
  function normalize(value, binding, loader = value?._deferredLoader) {
    try {
      if (!id(value?.worldId) || !id(value.runId) || binding && (value.worldId !== binding.worldId || value.runId !== binding.runId)
        || value.spatialContinuity != null && typeof value.spatialContinuity !== 'boolean'
        || value.diagnosticOnly != null && typeof value.diagnosticOnly !== 'boolean'
        || value.nativeEncounters != null && typeof value.nativeEncounters !== 'boolean'
        || !nonnegative(value.clock) || !nonnegative(value.appliedAt) || value.appliedAt > value.clock + EPS
        || !nonnegative(value.nextEventAt) || value.nextEventAt <= value.clock - EPS
        || !Array.isArray(value.losses) || !Array.isArray(value.births) || !Array.isArray(value.plans)
        || !value.originalCounts || !Object.values(value.originalCounts).every(integer)) return null;
      const s = copy(value);
      if (s.regions.some(r => r.deferred)) {
        if (!loader) return null;
        s.regions = s.regions.map(r => r.deferred ? loader.header(r.id) : r);
      }
      if (loader) Object.defineProperty(s, '_deferredLoader', { value: loader });
      if (s.nextDemographyAt != null && !nonnegative(s.nextDemographyAt)) return null;
      validateSource({ id: s.sourceId, calendar: s.calendar, regions: s.regions,
        diagnosticOnly: s.diagnosticOnly === true, nativeEncounters: s.nativeEncounters === true, _deferredLoader: loader, unlocated: s.unlocated, regionalFoodWeb: s.regionalFoodWeb,
        groups: s.groups.map(g => ({ ...g, cohorts: g.cohorts.map(c => ({ ...c, count: count(c), ageDays: Math.max(0, (s.clock - c.bornAt) / DAY) })) })) });
      for (const r of s.regions) {
        if (r.deferred) continue;
        if (r.airMoistureTakenL != null && !nonnegative(r.airMoistureTakenL)) return null;
        if (r.unmetTotals && !Object.values(r.unmetTotals).every(nonnegative)) return null;
        const rate = s.rates[r.id];
        if (!Wildlife.valid(r, s.regionClocks?.[r.id]?.appliedAt ?? s.appliedAt, id => Demography.group(s, id), s.clock)
          || !Wildlife.validRates(r, rate)) return null;
        if (!rate || !['renewal', 'demand', 'supply'].every(k => rate[k] && Object.values(rate[k]).every(nonnegative))
          || !rate.net || !Object.values(rate.net).every(Number.isFinite)) return null;
      }
      for (const g of s.groups) {
        if (!integer(g.choiceSerial) || !Array.isArray(g.knowledge) || !g.needs || !Object.values(g.needs).every(nonnegative)) return null;
        if (!Journeys.validState(g, s.calendar, s.clock, s.diagnosticOnly === true || s.nativeEncounters === true)) return null;
        if (g.travelCare && (!s.spatialContinuity || !Number.isInteger(g.travelCare.monthIndex) || !nonnegative(g.travelCare.plannedAt)
          || g.travelCare.plannedAt > s.clock || !(g.travelCare.end > g.travelCare.plannedAt) || !integer(g.travelCare.stops)
          || !nonnegative(g.travelCare.usedSeconds) || g.travelCare.usedSeconds > g.travelCare.limitSeconds + EPS
          || g.travelCare.usedSeconds > s.clock - g.travelCare.plannedAt + EPS
          || Math.abs(g.travelCare.limitSeconds - (g.travelCare.end - g.travelCare.plannedAt) * 2 / 3) > 1e-6)) return null;
        if (g.intention && (!id(g.intention.destination) || !nonnegative(g.intention.chosenAt) || !(g.intention.departAt > s.clock - EPS))) return null;
        if (g.transit && (!Array.isArray(g.transit.path) || g.transit.path.length !== 2 || ![0, 1].includes(g.transit.edgeIndex)
          || !nonnegative(g.transit.departedAt) || !(g.transit.edgeArriveAt > (g.transit.stop?.startedAt ?? s.clock) - EPS)
          || !(g.transit.crossAt > g.transit.departedAt) || !(g.transit.edgeArriveAt > g.transit.crossAt)
          || g.transit.path.some(id => !s.regions.some(r => r.id === id)))) return null;
        for (const c of g.cohorts) if (c.personalActor && (count(c) !== 1 || !Life.valid(c.personalActor) || !Bodies.valid(c.personalActor)
          || c.personalActor.status === 'dead' || c.personalActor.speciesId !== g.speciesId || c.personalActor.populationId !== g.populationId
          || c.personalActor.life.originalGroupId !== g.id || c.personalActor.life.originalMemberId !== cohortKey(c, c.ranges[0][0]))) return null;
        for (const c of g.cohorts) if (!Demography.valid(c) || !Number.isFinite(c.bornAt) || !nonnegative(c.structuralKg) || c.massKg + EPS < c.structuralKg
          || !c.stores || !Object.values(c.stores).every(nonnegative) || !nonnegative(c.health) || c.health > 1
          || !integer(c.deathSerial) || !nonnegative(c.deathExposure) || !nonnegative(c.deathThreshold)
          || !c.needs || !Object.values(c.needs).every(nonnegative) || !Ecology.Work.towersValid(c)
          || c.airIntakeLDay != null && (!Lantern.is(c) || !nonnegative(c.airIntakeLDay) || !(c.airReferenceKg > 0) || !Number.isFinite(c.airReferenceKg)
            || c.airReferenceKg > c.massKg * 2 || c.airReferenceKg < c.massKg / 2
            || c.airIntakeLDay > Lantern.airRate(c.airReferenceKg, c.regional?.parts,
              { ...Demography.region(s, location(g)), ...Demography.region(s, location(g)).seasons?.[s.plans.at(-1).season] }) + EPS)
          || c.intake && Object.values(c.intake).some(n => !nonnegative(n) || n > 1)) return null;
        for (const c of g.cohorts) if (c.firstScarcity && (!nonnegative(c.firstScarcity.at) || c.firstScarcity.at > s.clock
          || !s.regions.some(r => r.id === c.firstScarcity.regionId) || typeof c.firstScarcity.dependent !== 'boolean'
          || typeof c.firstScarcity.afterPersonalArrival !== 'boolean' || !['stationary', 'travelling', 'stopped'].includes(c.firstScarcity.phase)
          || c.firstScarcity.inventory && (!id(c.firstScarcity.inventory.resource)
            || !nonnegative(c.firstScarcity.inventory.snapshotAt) || c.firstScarcity.inventory.snapshotAt < c.firstScarcity.at
            || c.firstScarcity.inventory.snapshotAt > s.clock
            || !['regionalStock', 'renewalPerDay', 'regionalAnimalMatterKg'].every(k => nonnegative(c.firstScarcity.inventory[k]))))) return null;
      }
      if (s.extraRates && (!Array.isArray(s.extraRates) || s.extraRates.some(r => {
        const g = s.groups.find(g => g.id === r.groupId), c = g?.cohorts.find(c => c.id === r.cohortId);
        return !c || !['activity', 'growth', 'brood', 'ecology', 'care'].includes(r.kind) || !nonnegative(r.perDay) || !nonnegative(r.factor)
          || r.factor > 1 || !r.inputs || !Object.values(r.inputs).every(nonnegative)
          || r.manaPerDay != null && !nonnegative(r.manaPerDay)
          || r.storeFunded != null && (r.storeFunded !== true || r.kind !== 'growth' || !nonnegative(r.storeReserveKg) || !(c.foraging || c.dependency))
          || r.kind === 'care' && (!c.caregiving || r.childId !== c.caregiving.childId || r.perDay !== 1)
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
        if (d.regionalCorpse && (d.status !== 'dead' || !d.actor?.nativePopulation?.background || d.regionalReceipt
          || Demography.region(s, d.regionId)?.remainsBatches?.[d.remainsKey]?.sourceKey !== d.memberId
          || !s.losses.some(l => l.memberId === d.memberId && !l.detailOwner))) return null;
      }
      if (!Ecology.valid(s) || !Foodweb.validate(s) || !Scheduler.validate(s) || !Foraging.valid(s, id => Demography.group(s, id)) || !Care.valid(s) || !Wind.valid(s)) return null;
      audit(s); Demography.prepare(s, s.clock); Scheduler.restore(s, schedulerOps); return s; // Restore indexes, never paid rates or choices.
    } catch { return null; }
  }
  return { DAY, count, cohortKey, monthAt, hazardIntegral, validateSource, create, createDiagnostic, chooseDestination,
    advance, advanceBudget, settleRegions, groupsForRegion: Scheduler.groupsForRegion, detail, claimLocal, previewLocal, returnLocal, releaseCorpse, claimCorpse, settleLocalLoss, registerLocalBirth, recordDetailedLoss, removeStock, destroyNursery, destroyRenewalSite, foodWebSummary: Foodweb.summary,
    destroyEcologicalWorkSite, setEcologicalActivity, setDrainageObstruction, setDreamParticipants, damageFeedingTower, kill, audit, rebind, normalize };
});
