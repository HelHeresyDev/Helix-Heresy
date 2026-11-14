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
    node ? require('./beast-regional-ecology') : root.HelixBeastRegionalEcology);
  if (node) module.exports = api;
  root.HelixBeastPopulations = api;
})(globalThis, function (Biology, Life, Journeys, Wilderness, Predation, Bodies, Demography, Ecology) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
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
      || !(source.massKg > 0) || !Number.isFinite(source.massKg)) throw Error('Invalid original cohort');
    const waterL = Math.min(source.massKg * .1, p.waterLDay * (p.waterReserveDays || 0));
    const fatKg = Math.min(source.massKg * .1, p.foodKgDay * (p.foodReserveDays || 0));
    return { id: source.id, originId: source.id, speciesId: source.speciesId, ranges: source.count ? [[0, source.count]] : [],
      bornAt: at - source.ageDays * DAY, massKg: source.massKg, structuralKg: source.massKg - waterL - fatKg,
      stores: { waterL, fatKg, foodKg: 0, mineralsKg: 0 }, role: source.role || 'individual', sex: source.sex || null,
      colonyId: source.colonyId || null, health: 1, deathSerial: 0, deathExposure: 0,
      deathThreshold: exponential(`${source.id}:background:0`),
      ...(source.count > 128 ? { aggregateMortality: true, mortalityBalance: Life.random(`${source.id}:mortality-offset`),
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
    monthAt(source.calendar, 0);
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
      Ecology.validate(r); regions.add(r.id);
    }
    for (const r of source.regions) for (const edge of r.edges) if (!regions.has(edge.id) || !(edge.distanceKm > 0) || !Number.isFinite(edge.distanceKm)
      || typeof edge.traversable !== 'boolean') throw Error('Invalid regional edge');
    for (const g of source.groups) {
      if (!id(g.id) || groups.has(g.id) || !id(g.populationId) || !regions.has(g.regionId)
        || !Array.isArray(g.cohorts) || !Biology.lifecycle[g.speciesId]) throw Error('Invalid population group');
      groups.add(g.id);
      Ecology.validateGroup(g, source.regions);
      if (!Journeys.validSpec(g, source.calendar)) throw Error('Invalid original seasonal route');
      for (const c of g.cohorts) {
        if (c.speciesId !== g.speciesId || cohorts.has(c.id)) throw Error('Conflicting cohort source');
        if (c.role === 'queen' && (!id(c.colonyId) || !nonnegative(Biology.lifecycle[c.speciesId].breederMortality)
          || !(c.massKg >= Biology.lifecycle[c.speciesId].breederKg * .8))) throw Error('No original queen body/colony source');
        cohort(c, 0); cohorts.add(c.id);
      }
    }
    return source;
  }
  function create(source, binding, at = 0) {
    if (source?.diagnosticOnly) throw Error('An unaccepted generator proposal cannot create an active population account');
    validateSource(source);
    if (!id(binding?.worldId) || !id(binding.runId) || !nonnegative(at)) throw Error('Missing run binding');
    const s = { ...binding, sourceId: source.id, calendar: copy(source.calendar), clock: at, appliedAt: at,
      regions: copy(source.regions), groups: source.groups.map(g => ({ ...copy(g), cohorts: g.cohorts.map(c => cohort(c, at)),
        knowledge: copy(g.knowledge || []), choiceSerial: 0, intention: null, transit: null, observedShortage: false })),
      details: {}, losses: [], lossBatches: [], births: [], plans: [], events: [], nextEventAt: at,
      nextDemographyAt: (Math.floor(at / DAY) + 1) * DAY, work: { boundaries: 0, cohortIntervals: 0 } };
    s.originalCounts = {};
    for (const g of source.groups) s.originalCounts[g.populationId] = (s.originalCounts[g.populationId] || 0) + g.cohorts.reduce((n, c) => n + c.count, 0);
    s.origins = Object.fromEntries(source.groups.flatMap(g => g.cohorts.map(c => [c.id,
      { populationId: g.populationId, speciesId: c.speciesId, count: c.count }])));
    Ecology.initialize(s); plan(s, at); return s;
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
  function plan(s, at) {
    const month = monthAt(s.calendar, at);
    if (s.plans.some(p => p.index === month.index)) return;
    s.plans.push({ ...month, plannedAt: at });
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
    rebuild(s, at);
  }
  const location = Journeys.location;
  function rebuild(s, at) {
    Demography.prepare(s, at);
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
      for (const c of g.cohorts) {
        Demography.synchronize(s, g, c, at);
        const p = Biology.lifecycle[c.speciesId], juvenile = at - c.bornAt < p.adultDays * DAY;
        const scale = count(c) * (c.massKg / p.adultKg) ** .75 * (juvenile ? p.juvenileMultiplier : 1) * (g.transit ? p.travelMultiplier : 1);
        c.needs = {};
        for (const key of ['foodKg', 'waterL', 'mineralsKg']) {
          const need = p[({ foodKg: 'foodKgDay', waterL: 'waterLDay', mineralsKg: 'mineralsKgDay' })[key]] * scale;
          c.needs[key] = need;
          g.needs[key] = (g.needs[key] || 0) + need;
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
    }
    for (const r of s.regions) {
      const rate = rates[r.id];
      for (const key of new Set([...Object.keys(rate.renewal), ...Object.keys(rate.demand)])) {
        const renewal = rate.renewal[key] || 0, demand = rate.demand[key] || 0, stock = r.stocks[key] || 0;
        rate.supply[key] = demand > 0 ? stock > EPS ? 1 : Math.min(1, renewal / demand) : 1;
        rate.net[key] = renewal - demand * rate.supply[key];
        if (rate.net[key] < -EPS && stock > EPS) next = Math.min(next, at + stock / -rate.net[key] * DAY);
      }
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
    for (const [regionId, list] of requestsByRegion) {
      const r = Demography.region(s, regionId), rate = rates[regionId], requested = {};
      for (const request of list) for (const [key, n] of Object.entries(request.inputs)) requested[key] = (requested[key] || 0) + n;
      for (const request of list) {
        request.factor = Math.min(1, ...Object.entries(request.inputs).filter(([, n]) => n > 0).map(([key]) =>
          (r.stocks[key] || 0) > EPS ? 1 : Math.min(1, Math.max(0, (rate.renewal[key] || 0) - (rate.demand[key] || 0)) / requested[key])));
        if (Object.entries(request.c.needs).some(([k, n]) => n > 0 && (rate.supply[request.g.resources?.[k] || k] ?? 0) < 1)) request.factor = 0;
      }
      const activity = new Map(list.filter(r => r.kind === 'activity').map(r => [r.c.id, r.factor]));
      for (const request of list) {
        if (request.kind !== 'activity') request.factor = Math.min(request.factor, activity.get(request.c.id) ?? 1);
        for (const [key, amount] of Object.entries(request.inputs)) rate.net[key] = (rate.net[key] || 0) - amount * request.factor;
        const perDay = request.perDay * request.factor;
        if (perDay > EPS && ['growth', 'brood'].includes(request.kind)) {
          const remaining = request.kind === 'growth' ? (Biology.lifecycle[request.c.speciesId][request.c.role === 'queen' ? 'breederKg' : 'adultKg'] * .8 - request.c.structuralKg)
            * count(request.c) / Biology.lifecycle[request.c.speciesId].assimilation
            : request.brood.requiredKg * Demography.size(request.brood.parents) - request.brood.investedKg;
          next = Math.min(next, at + remaining / perDay * DAY);
        }
      }
      for (const [key, net] of Object.entries(rate.net)) if (net < -EPS && (r.stocks[key] || 0) > EPS)
        next = Math.min(next, at + r.stocks[key] / -net * DAY);
    }
    next = Math.min(next, Ecology.build(s, rates, extra, at, month.season));
    if (s.regions.some(r => r.ecology) || s.groups.some(g => g.cohorts.some(c => count(c) && (c.aggregateMortality || c.demography)) || g.breeding) || extra.length) {
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
        const deficit = need * (1 - (rate.supply[g.resources?.[key] || key] ?? 0)) / n;
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
      && Object.entries(g.needs).some(([key, need]) => need > 0 && (rates[location(g)].supply[g.resources?.[key] || key] ?? 0) < 1))
      next = Math.min(next, at + 1); // The next actual local feeding attempt discovers it.
    s.rates = rates; s.nextEventAt = Math.max(at + 1e-6, next);
  }
  function integrate(s, to) {
    const from = s.appliedAt, days = (to - from) / DAY;
    if (!(days > 0)) return;
    if (s.work) s.work.cohortIntervals += s.groups.reduce((n, g) => n + g.cohorts.length, 0);
    for (const r of s.regions) {
      const rate = s.rates[r.id];
      r.receipts ||= {};
      for (const [key, net] of Object.entries(rate.net)) {
        const before = r.stocks[key] || 0;
        r.stocks[key] = Math.max(0, Math.min(r.capacity[key] || 0, before + days * net));
        r.receipts[key] = (r.receipts[key] || 0) + r.stocks[key] - before;
      }
    }
    for (const g of s.groups) {
      const r = Demography.region(s, location(g)), rate = s.rates[r.id];
      for (const c of g.cohorts) {
        const n = count(c); if (!n) continue;
        if (c.aggregateMortality) {
          if (c.batchMembers !== n) { c.batchMembers = n; c.batchHazard = 0; }
          const hazard = hazardIntegral(c, from, to);
          c.mortalityBalance += n * Math.exp(-c.batchHazard) * -Math.expm1(-hazard); c.batchHazard += hazard;
        } else c.deathExposure += hazardIntegral(c, from, to) * n;
        for (const [key, need] of Object.entries(c.needs)) {
          const stockKey = g.resources?.[key] || key, supply = rate.supply[stockKey] ?? 0;
          let missing = need * days * (1 - supply);
          const available = (c.stores[key] || 0) + (key === 'foodKg' ? c.stores.fatKg : 0);
          const consumed = Math.min(available, missing / n);
          let left = consumed;
          if (c.stores[key] > 0) { const taken = Math.min(c.stores[key], left); c.stores[key] -= taken; left -= taken; }
          if (key === 'foodKg' && left > 0) c.stores.fatKg = Math.max(0, c.stores.fatKg - left);
          c.massKg -= consumed; missing -= consumed * n;
          if (missing > EPS) {
            g.observedShortage = true;
            c.unmet ||= {}; c.unmet[key] = (c.unmet[key] || 0) + missing / n;
          }
          // Real maintenance outputs remain matter, not ecological points.
          const used = need * days * supply + consumed * n;
          r.outputs ||= {}; const output = key === 'waterL' ? 'waterVaporKg' : 'metabolicWasteKg';
          r.outputs[output] = (r.outputs[output] || 0) + used;
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
        c.structuralKg += gain / n; c.massKg += gain / n;
        r.outputs ||= {}; r.outputs.growthWasteKg = (r.outputs.growthWasteKg || 0) + amount - gain;
      } else {
        const brood = c.demography.broods.find(b => b.id === rate.broodId);
        brood.investedKg += amount; brood.investedMana += (rate.manaPerDay || 0) * rate.factor * days;
      }
    }
    Ecology.integrate(s, days, to);
    s.appliedAt = to;
  }
  function loseBatch(s, g, c, amount, cause, at) {
    const ranges = Demography.take(c.ranges, Math.min(amount, count(c)), true), n = Demography.size(ranges);
    if (!n) return;
    Ecology.lostContributor(s, g, c, n, at, cause, `loss-batch:${c.originId}:${location(g)}:${cause}`);
    c.ranges = Demography.subtract(c.ranges, ranges);
    s.lossBatches ||= [];
    const batchId = `loss-batch:${c.originId}:${location(g)}:${cause}`;
    let b = s.lossBatches.find(b => b.id === batchId);
    if (!b) { b = { id: batchId, populationId: g.populationId, speciesId: g.speciesId, originId: c.originId,
      groupId: g.id, regionId: location(g), cause, ranges: [], count: 0, firstAt: at, lastAt: at, massKg: 0 }; s.lossBatches.push(b); }
    b.ranges = Demography.union([...b.ranges, ...ranges]); b.count += n; b.lastAt = at; b.massKg += c.massKg * n;
    const r = s.regions.find(r => r.id === location(g)); r.remainsBatches ||= {};
    const remains = r.remainsBatches[batchId] ||= { count: 0, massKg: 0, edibleKg: 0, firstAt: at, lastAt: at };
    remains.count += n; remains.massKg += c.massKg * n; remains.edibleKg += c.massKg * n * .6; remains.lastAt = at;
  }
  function recordBirth(s, g, parent, brood, role, n, at) {
    const p = Biology.lifecycle[g.speciesId], originId = `birth-stream:${g.id}:${role}`;
    const origin = s.origins[originId] ||= { populationId: g.populationId, speciesId: g.speciesId, count: 0 };
    if (!integer(n) || !integer(origin.count + n)) throw Error('Birth batch exceeds conserved integer capacity');
    const lo = origin.count; origin.count += n;
    const c = cohort({ id: `${originId}:${lo}`, speciesId: g.speciesId, count: n, ageDays: 0, massKg: p.newbornKg,
      role, colonyId: parent.colonyId }, at);
    Object.assign(c, { originId, generated: true, nurseryId: brood.nurseryId, ranges: [[lo, lo + n]], aggregateMortality: true,
      mortalityBalance: Life.random(`${c.id}:mortality-offset`), batchHazard: 0, batchMembers: n });
    g.cohorts.push(c);
    let birth = s.births.find(b => b.originId === originId);
    if (!birth) { birth = { originId, populationId: g.populationId, count: 0, firstAt: at, lastAt: at, parentOrigins: [] }; s.births.push(birth); }
    birth.count += n; birth.lastAt = at;
    if (!birth.parentOrigins.includes(parent.originId)) birth.parentOrigins.push(parent.originId);
    return c;
  }
  function lose(s, g, c, ordinal, cause, at) {
    if (!remove(c, ordinal)) return false;
    Ecology.lostContributor(s, g, c, 1, at, cause, cohortKey(c, ordinal));
    const loss = { memberId: cohortKey(c, ordinal), populationId: g.populationId, speciesId: g.speciesId,
      groupId: g.id, originId: c.originId || c.id, ordinal, regionId: location(g), cause, at, massKg: c.massKg };
    s.losses.push(loss);
    const r = s.regions.find(r => r.id === loss.regionId);
    // Remains are real finite matter and are not renewable generic prey.
    r.remains ||= {}; r.remains[loss.memberId] = { massKg: c.massKg, edibleKg: c.massKg * .6, at, cause };
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
      if (!g.cohorts.some(c => count(c))) { g.intention = null; g.transit = null; continue; }
      if (g.intention && g.intention.departAt <= at + EPS) {
        for (const event of Journeys.depart(g, at, s.regions.find(r => r.id === g.regionId), Biology.lifecycle[g.speciesId].travelKmDay))
          record(s, event.kind, event.at, event);
      }
      for (const event of Journeys.arrive(g, at)) record(s, event.kind, event.at, event);
    }
    plan(s, at);
    const demographicTick = at + EPS >= (s.nextDemographyAt ?? Infinity);
    if (demographicTick) s.nextDemographyAt = (Math.floor((at + EPS) / DAY) + 1) * DAY;
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
    let changed = false;
    for (const g of s.groups) {
      const rate = s.rates[location(g)];
      const localShortage = !g.transit && g.cohorts.some(c => count(c)) && Object.entries(g.needs)
        .some(([key, need]) => need > 0 && (rate.supply[g.resources?.[key] || key] ?? 0) < 1);
      if (localShortage && !g.observedShortage) {
        g.observedShortage = true;
        record(s, 'observedShortage', at, { groupId: g.id, regionId: g.regionId });
        if (!g.intention) { scheduleDeparture(s, g, at, monthAt(s.calendar, at)); changed = true; }
      }
    }
    if (changed) rebuild(s, at);
  }
  function advance(s, at, alive = true, settle = false) {
    if (!alive || !nonnegative(at) || at < s.clock) return false;
    while (s.nextEventAt <= at + EPS) { const eventAt = s.nextEventAt; integrate(s, eventAt); boundary(s, eventAt); }
    if (settle) integrate(s, at); // A read settles elapsed work, not new intentions/rates.
    s.clock = at; return true;
  }
  function detail(s, groupId, cohortId, ordinal, actorId, at) {
    if (!id(actorId) || s.details[actorId] || !nonnegative(at) || at < s.clock) return null;
    advance(s, at, true, true);
    const g = s.groups.find(g => g.id === groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) return null;
    const demographicHandoff = Demography.handoff(c, ordinal, at);
    if (!remove(c, ordinal)) return null;
    const memberId = cohortKey(c, ordinal);
    if (Object.values(s.details).some(d => d.memberId === memberId)) throw Error('Duplicate individual claim');
    const result = { actorId, memberId, populationId: g.populationId, groupId, cohortId, ordinal,
      speciesId: g.speciesId, regionId: location(g), detailedAt: at, status: 'detailed',
      ageDays: Math.max(0, (at - (c.birthSpan?.[1] ?? c.bornAt)) / DAY), massKg: c.massKg, structuralKg: c.structuralKg,
      stores: copy(c.stores), role: c.role, colonyId: c.colonyId, health: c.health,
      ...(c.nurseryId ? { nurseryId: c.nurseryId } : {}),
      ...(demographicHandoff ? { demography: demographicHandoff } : {}), ...(c.birthSpan ? { birthSpan: copy(c.birthSpan) } : {}) };
    s.details[actorId] = result; rebuild(s, at); return copy(result);
  }
  // A local source adapter must supply the original body's established position
  // and real terrain context. A regional range/centroid alone cannot place prey
  // beside a predator. The resulting actor is owned by this exact detail claim.
  function claimLocal(s, groupId, cohortId, ordinal, actorId, at, ctx) {
    if (!nonnegative(at) || at < s.clock || !ctx?.alive || !ctx.local || !id(actorId) || s.details[actorId]) return null;
    advance(s, at, true, true);
    const g = s.groups.find(g => g.id === groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi) || !Bodies.profiles[g.speciesId]) return null;
    const position = ctx.originalPosition?.(g, c, ordinal, at);
    if (!position || position.regionId !== location(g) || !position.cell
      || !['x', 'y', 'z'].every(k => Number.isInteger(position.cell[k]))) return null;
    const a = Wilderness.actor(g.speciesId, actorId, position.cell, g.populationId, at,
      { ageDays: (at - c.bornAt) / DAY, massKg: c.massKg, role: c.role, colonyId: c.colonyId, will: g.will, willing: g.willing });
    if (Number.isFinite(position.altitudeM)) a.bodyPhysics.altitudeM = position.altitudeM;
    if (position.mode) a.bodyPhysics.mode = position.mode;
    const reserves = ctx.originalReserves?.(g, c, ordinal, at), manaOwner = a.spellImitation || a.bodyPhysics;
    // The background account does not yet own magical/effort histories. Missing
    // provenance is unavailable, never a freshly full (or fabricated empty) pool.
    if (!reserves || !nonnegative(reserves.mana) || reserves.mana > manaOwner.mana
      || !nonnegative(reserves.stamina) || reserves.stamina > a.bodyPhysics.stamina
      || !reserves.energy || !Object.keys(a.life.energy).every(k => nonnegative(reserves.energy[k]))) return null;
    manaOwner.mana = reserves.mana; a.bodyPhysics.stamina = reserves.stamina;
    a.life.energy = copy(reserves.energy);
    const modes = Bodies.profiles[g.speciesId].modes;
    if (!Bodies.valid(a) || !(modes.includes(a.bodyPhysics.mode) || a.bodyPhysics.mode === 'walking' && modes.includes('charging'))
      || Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode, Bodies.height(a), ctx)) return null;
    const d = detail(s, groupId, cohortId, ordinal, actorId, at); if (!d) return null;
    a.maxHealth = Math.max(1, a.maxHealth * Math.min(1, Math.sqrt(d.massKg / Biology.lifecycle[g.speciesId].adultKg)));
    a.health = a.maxHealth * d.health;
    a.life.stores = copy(d.stores); a.life.structuralKg = d.structuralKg;
    a.life.bornAt = at - d.ageDays * DAY;
    a.life.originalMemberId = d.memberId;
    a.life.originalGroupId = groupId;
    if (d.demography) {
      a.life.opportunities = d.demography.opportunities;
      a.life.lastAttemptAt = d.demography.lastAttemptAt;
      a.life.populationBroods = copy(d.demography.broods);
    }
    s.details[actorId].actor = a; return a;
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
    advance(s, at, true, true);
    const g = s.groups.find(g => g.id === parent.groupId), co = g.cohorts.find(c => c.originId === parent.memberId.slice(0, parent.memberId.lastIndexOf(':')))
      || { originId: parent.memberId.slice(0, parent.memberId.lastIndexOf(':')), colonyId: a.life.colonyId };
    const c = recordBirth(s, g, co, { nurseryId: g.breeding?.siteId || null }, child.life.role || 'individual', 1, at);
    rebuild(s, at);
    const d = detail(s, g.id, c.id, c.ranges[0][0], child.id, at); if (!d) return false;
    child.life.originalMemberId = d.memberId; child.life.originalGroupId = g.id;
    s.details[child.id].actor = child; return true;
  }
  function recordDetailedLoss(s, actorId, at, cause, remainsKg) {
    const d = s.details[actorId];
    if (!d || d.status !== 'detailed' || !nonnegative(remainsKg) || !nonnegative(at) || at < s.clock) return false;
    advance(s, at, true, true); d.status = 'dead'; d.diedAt = at; d.cause = cause;
    s.losses.push({ memberId: d.memberId, populationId: d.populationId, speciesId: d.speciesId,
      groupId: d.groupId, originId: d.memberId.slice(0, d.memberId.lastIndexOf(':')), ordinal: d.ordinal,
      regionId: d.regionId, cause, at, massKg: remainsKg, detailOwner: actorId });
    // The physical corpse still belongs to its detailed owner; do not copy it
    // into regional food stocks or apply another background death.
    record(s, 'detailedLoss', at, { actorId, memberId: d.memberId, cause }); return true;
  }
  function removeStock(s, regionId, key, amount, at, cause) {
    if (!id(cause) || !nonnegative(amount) || !nonnegative(at) || at < s.clock) return false;
    advance(s, at, true, true);
    const r = s.regions.find(r => r.id === regionId);
    if (!r || !(r.stocks[key] >= amount)) return false;
    r.stocks[key] -= amount;
    record(s, 'stockLoss', at, { regionId, key, amount, cause });
    rebuild(s, at); return true;
  }
  function destroyNursery(s, regionId, siteId, at, cause) {
    if (!nonnegative(at) || at < s.clock || !id(cause)) return false;
    advance(s, at, true, true);
    const nursery = s.regions.find(r => r.id === regionId)?.nurseries?.find(n => n.id === siteId);
    if (!nursery || nursery.destroyedAt != null) return false;
    nursery.destroyedAt = at; nursery.enabled = false;
    for (const d of Object.values(s.details)) for (const brood of d.actor?.life?.populationBroods || [])
      if (brood.externalNursery && brood.sourceRegionId === regionId && brood.sourceNurseryId === siteId && brood.disposedAt == null) {
        const r = s.regions.find(r => r.id === regionId); r.outputs ||= {};
        r.outputs.failedRecruitmentKg = (r.outputs.failedRecruitmentKg || 0)
          + Math.max(0, brood.investedKg - Biology.lifecycle[d.speciesId].newbornKg * brood.emitted.length);
        brood.disposedAt = at;
      }
    record(s, 'nurseryDestroyed', at, { regionId, siteId, cause }); rebuild(s, at); return true;
  }
  function destroyRenewalSite(s, regionId, siteId, at, cause) {
    if (!id(cause) || !nonnegative(at) || at < s.clock) return false;
    advance(s, at, true, true);
    if (!Ecology.destroySite(s, regionId, siteId, at, cause)) return false;
    record(s, 'renewalSiteDestroyed', at, { regionId, siteId, cause }); rebuild(s, at); return true;
  }
  function kill(s, groupId, cohortId, ordinal, at, cause) {
    if (!id(cause) || cause === 'background' || !nonnegative(at) || at < s.clock) return false;
    advance(s, at, true, true);
    const g = s.groups.find(g => g.id === groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !lose(s, g, c, ordinal, cause, at)) return false;
    rebuild(s, at); return true;
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
        || !nonnegative(value.clock) || !nonnegative(value.appliedAt) || value.appliedAt > value.clock + EPS
        || !nonnegative(value.nextEventAt) || value.nextEventAt <= value.clock - EPS
        || !Array.isArray(value.losses) || !Array.isArray(value.births) || !Array.isArray(value.plans)
        || !value.originalCounts || !Object.values(value.originalCounts).every(integer)) return null;
      const s = copy(value);
      if (s.nextDemographyAt != null && !nonnegative(s.nextDemographyAt)) return null;
      validateSource({ id: s.sourceId, calendar: s.calendar, regions: s.regions,
        groups: s.groups.map(g => ({ ...g, cohorts: g.cohorts.map(c => ({ ...c, count: count(c), ageDays: Math.max(0, (s.clock - c.bornAt) / DAY) })) })) });
      for (const r of s.regions) {
        const rate = s.rates[r.id];
        if (!rate || !['renewal', 'demand', 'supply'].every(k => rate[k] && Object.values(rate[k]).every(nonnegative))
          || !rate.net || !Object.values(rate.net).every(Number.isFinite)) return null;
      }
      for (const g of s.groups) {
        if (!integer(g.choiceSerial) || !Array.isArray(g.knowledge) || !g.needs || !Object.values(g.needs).every(nonnegative)) return null;
        if (!Journeys.validState(g, s.calendar, s.clock)) return null;
        if (g.intention && (!id(g.intention.destination) || !nonnegative(g.intention.chosenAt) || !(g.intention.departAt > s.clock - EPS))) return null;
        if (g.transit && (!Array.isArray(g.transit.path) || g.transit.path.length !== 2 || ![0, 1].includes(g.transit.edgeIndex)
          || !nonnegative(g.transit.departedAt) || !(g.transit.edgeArriveAt > s.clock - EPS)
          || !(g.transit.crossAt > g.transit.departedAt) || !(g.transit.edgeArriveAt > g.transit.crossAt)
          || g.transit.path.some(id => !s.regions.some(r => r.id === id)))) return null;
        for (const c of g.cohorts) if (!Demography.valid(c) || !Number.isFinite(c.bornAt) || !nonnegative(c.structuralKg) || c.massKg + EPS < c.structuralKg
          || !c.stores || !Object.values(c.stores).every(nonnegative) || !nonnegative(c.health) || c.health > 1
          || !integer(c.deathSerial) || !nonnegative(c.deathExposure) || !nonnegative(c.deathThreshold)
          || !c.needs || !Object.values(c.needs).every(nonnegative)) return null;
      }
      if (s.extraRates && (!Array.isArray(s.extraRates) || s.extraRates.some(r => {
        const g = s.groups.find(g => g.id === r.groupId), c = g?.cohorts.find(c => c.id === r.cohortId);
        return !c || !['activity', 'growth', 'brood', 'ecology'].includes(r.kind) || !nonnegative(r.perDay) || !nonnegative(r.factor)
          || r.factor > 1 || !r.inputs || !Object.values(r.inputs).every(nonnegative)
          || r.manaPerDay != null && !nonnegative(r.manaPerDay)
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
      if (!Ecology.valid(s)) return null;
      audit(s); return s; // Preserve cached event times; loading is not a reroll or refill.
    } catch { return null; }
  }
  return { DAY, count, cohortKey, monthAt, hazardIntegral, validateSource, create, chooseDestination,
    advance, detail, claimLocal, settleLocalLoss, registerLocalBirth, recordDetailedLoss, removeStock, destroyNursery, destroyRenewalSite, kill, audit, rebind, normalize };
});
