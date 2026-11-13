// #3.38-D internal account model. Native source/encounter adapters are unfinished;
// this module alone is not a claim of live regional simulation or encounter coverage.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./creature-life') : root.HelixCreatureLife);
  if (node) module.exports = api;
  root.HelixBeastPopulations = api;
})(globalThis, function (Biology, Life) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
  const nonnegative = n => Number.isFinite(n) && n >= 0;
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const id = s => typeof s === 'string' && s.length > 0 && s !== 'prototype'
    && !Object.prototype.hasOwnProperty.call(Object.prototype, s);
  const count = c => c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0);
  const cohortKey = (c, ordinal) => `${c.originId || c.id}:${ordinal}`;
  function monthAt(calendar, at) {
    if (!calendar?.monthDays?.length || !calendar.monthDays.every(n => Number.isFinite(n) && n > 0)
      || !Number.isFinite(calendar.epochAt)) throw Error('An explicit game calendar is required');
    const year = calendar.monthDays.reduce((n, days) => n + days * DAY, 0);
    const cycle = Math.floor((at - calendar.epochAt) / year);
    let start = calendar.epochAt + cycle * year;
    for (let index = 0; index < calendar.monthDays.length; index++) {
      const end = start + calendar.monthDays[index] * DAY;
      if (at < end - EPS) return { index: cycle * calendar.monthDays.length + index, start, end, season: index };
      start = end;
    }
    return monthAt(calendar, start + EPS * 2);
  }
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
      stores: { waterL, fatKg, foodKg: 0, mineralsKg: 0 }, role: source.role || 'individual',
      colonyId: source.colonyId || null, health: 1, deathSerial: 0, deathExposure: 0,
      deathThreshold: exponential(`${source.id}:background:0`) };
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
      regions.add(r.id);
    }
    for (const r of source.regions) for (const edge of r.edges) if (!regions.has(edge.id) || !(edge.distanceKm > 0) || !Number.isFinite(edge.distanceKm)
      || typeof edge.traversable !== 'boolean') throw Error('Invalid regional edge');
    for (const g of source.groups) {
      if (!id(g.id) || groups.has(g.id) || !id(g.populationId) || !regions.has(g.regionId)
        || !Array.isArray(g.cohorts) || !Biology.lifecycle[g.speciesId]) throw Error('Invalid population group');
      groups.add(g.id);
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
      details: {}, losses: [], births: [], plans: [], events: [], nextEventAt: at };
    s.originalCounts = Object.fromEntries(source.groups.map(g => g.populationId).map(populationId => [populationId,
      source.groups.filter(g => g.populationId === populationId).reduce((total, g) => total + g.cohorts.reduce((n, c) => n + c.count, 0), 0)]));
    s.origins = Object.fromEntries(source.groups.flatMap(g => g.cohorts.map(c => [c.id,
      { populationId: g.populationId, speciesId: c.speciesId, count: c.count }])));
    plan(s, at); return s;
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
    const here = s.regions.find(r => r.id === g.regionId);
    const policy = { ...(g.instinct || { mode: 'forcedDispersal' }), at };
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
      if (g.transit || !g.cohorts.some(c => count(c))) continue;
      if (g.instinct?.mode !== 'instinctive' && !g.observedShortage && !g.displaced) continue;
      if (!g.intention) scheduleDeparture(s, g, at, month);
    }
    rebuild(s, at);
  }
  function location(g) { return g.transit ? g.transit.path[g.transit.edgeIndex] : g.regionId; }
  function rebuild(s, at) {
    const month = monthAt(s.calendar, at), until = month.end;
    let next = until;
    const rates = Object.fromEntries(s.regions.map(r => [r.id, { renewal: {}, demand: {}, supply: {}, net: {} }]));
    for (const r of s.regions) for (const [key, value] of Object.entries(r.renewalPerDay)) {
      rates[r.id].renewal[key] = value * (r.seasonFactors?.[month.season] ?? 1);
    }
    for (const g of s.groups) {
      const r = rates[location(g)]; g.needs = {};
      for (const c of g.cohorts) {
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
      const r = s.regions.find(r => r.id === location(g)), rate = s.rates[r.id];
      for (const c of g.cohorts) {
        const n = count(c); if (!n) continue;
        c.deathExposure += hazardIntegral(c, from, to) * n;
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
      }
    }
    s.appliedAt = to;
  }
  function lose(s, g, c, ordinal, cause, at) {
    if (!remove(c, ordinal)) return false;
    const loss = { memberId: cohortKey(c, ordinal), populationId: g.populationId, speciesId: g.speciesId,
      groupId: g.id, originId: c.originId || c.id, ordinal, regionId: location(g), cause, at, massKg: c.massKg };
    s.losses.push(loss);
    const r = s.regions.find(r => r.id === loss.regionId);
    // Remains are real finite matter and are not renewable generic prey.
    r.remains ||= {}; r.remains[loss.memberId] = { massKg: c.massKg, edibleKg: c.massKg * .6, at, cause };
    record(s, 'loss', at, { memberId: loss.memberId, cause }); return true;
  }
  function boundary(s, at) {
    for (const g of s.groups) {
      for (const c of g.cohorts) if (count(c) && c.health <= EPS) {
        for (const [lo, hi] of copy(c.ranges)) for (let ordinal = lo; ordinal < hi; ordinal++)
          lose(s, g, c, ordinal, c.scarcityCause, at);
      }
      for (const c of g.cohorts) if (count(c) && c.deathExposure + EPS >= c.deathThreshold) {
        const ordinal = ordinalAt(c, Math.min(count(c) - 1, Math.floor(Life.random(`${c.id}:victim:${c.deathSerial}`) * count(c))));
        lose(s, g, c, ordinal, 'background', at); c.deathExposure = Math.max(0, c.deathExposure - c.deathThreshold);
        c.deathThreshold = exponential(`${c.id}:background:${++c.deathSerial}`);
      }
      if (!g.cohorts.some(c => count(c))) { g.intention = null; g.transit = null; continue; }
      if (g.intention && g.intention.departAt <= at + EPS) {
        const edge = s.regions.find(r => r.id === g.regionId).edges.find(e => e.id === g.intention.destination);
        const destination = g.intention.destination; g.intention = null;
        if (!edge?.traversable || edge.allowedSpecies && !edge.allowedSpecies.includes(g.speciesId)) {
          record(s, 'blockedDeparture', at, { groupId: g.id, destination }); continue;
        }
        const speed = Biology.lifecycle[g.speciesId].travelKmDay;
        if (!(speed > 0)) continue;
        g.transit = { path: [g.regionId, destination], edgeIndex: 0, departedAt: at,
          edgeStartedAt: at, crossAt: at + edge.distanceKm / speed * DAY / 2, edgeArriveAt: at + edge.distanceKm / speed * DAY };
        record(s, 'departure', at, { groupId: g.id, from: g.regionId, destination });
      }
      if (g.transit && g.transit.crossAt <= at + EPS) g.transit.edgeIndex = 1;
      if (g.transit && g.transit.edgeArriveAt <= at + EPS) {
        g.regionId = g.transit.path.at(-1); g.transit = null; g.observedShortage = false;
        g.knowledge.push({ regionId: g.regionId, at, source: 'personalArrival', confidence: 'localOnly' });
        if (g.instinct?.mode === 'instinctive') g.instinct.cursor = ((g.instinct.cursor || 0) + 1) % g.instinct.route.length;
        record(s, 'arrival', at, { groupId: g.id, regionId: g.regionId });
      }
    }
    plan(s, at); rebuild(s, at);
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
    if (!c || !remove(c, ordinal)) return null;
    const memberId = cohortKey(c, ordinal);
    if (Object.values(s.details).some(d => d.memberId === memberId)) throw Error('Duplicate individual claim');
    const result = { actorId, memberId, populationId: g.populationId, groupId, cohortId, ordinal,
      speciesId: g.speciesId, regionId: location(g), detailedAt: at, status: 'detailed',
      ageDays: Math.max(0, (at - c.bornAt) / DAY), massKg: c.massKg, structuralKg: c.structuralKg,
      stores: copy(c.stores), role: c.role, colonyId: c.colonyId };
    s.details[actorId] = result; rebuild(s, at); return copy(result);
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
  function kill(s, groupId, cohortId, ordinal, at, cause) {
    if (!id(cause) || cause === 'background' || !nonnegative(at) || at < s.clock) return false;
    advance(s, at, true, true);
    const g = s.groups.find(g => g.id === groupId), c = g?.cohorts.find(c => c.id === cohortId);
    if (!c || !lose(s, g, c, ordinal, cause, at)) return false;
    rebuild(s, at); return true;
  }
  function audit(s) {
    const byPopulation = {};
    const keys = new Set();
    for (const g of s.groups) {
      const row = byPopulation[g.populationId] ||= { background: 0, detailed: 0, dead: 0 };
      for (const c of g.cohorts) {
        row.background += count(c);
        for (const [lo, hi] of c.ranges) {
          if (!integer(lo) || !integer(hi) || hi <= lo) throw Error('Invalid conserved membership range');
          // Overlap is checked by intervals, not expanding millions of bodies.
          const family = c.originId || c.id;
          const origin = s.origins[family];
          if (!origin || origin.populationId !== g.populationId || origin.speciesId !== g.speciesId || hi > origin.count)
            throw Error('Member is not backed by an original cohort');
          for (const entry of keys) if (entry.family === family && lo < entry.hi && hi > entry.lo) throw Error('Duplicated background members');
          keys.add({ family, lo, hi });
        }
      }
    }
    for (const d of Object.values(s.details)) {
      const originId = d.memberId.slice(0, d.memberId.lastIndexOf(':')), origin = s.origins[originId];
      if (!origin || origin.populationId !== d.populationId || origin.speciesId !== d.speciesId || d.ordinal >= origin.count
        || d.memberId !== `${originId}:${d.ordinal}`) throw Error('Detailed individual has no original source');
      if (d.status === 'detailed') (byPopulation[d.populationId] ||= { background: 0, detailed: 0, dead: 0 }).detailed++;
    }
    for (const loss of s.losses) {
      const origin = s.origins[loss.originId];
      if (!origin || origin.populationId !== loss.populationId || origin.speciesId !== loss.speciesId
        || !integer(loss.ordinal) || loss.ordinal >= origin.count || loss.memberId !== `${loss.originId}:${loss.ordinal}`)
        throw Error('Death has no original source');
      (byPopulation[loss.populationId] ||= { background: 0, detailed: 0, dead: 0 }).dead++;
    }
    if (new Set(s.losses.map(l => l.memberId)).size !== s.losses.length) throw Error('Duplicate deaths');
    for (const d of Object.values(s.details)) for (const entry of keys)
      if (entry.family === d.memberId.slice(0, d.memberId.lastIndexOf(':')) && d.ordinal >= entry.lo && d.ordinal < entry.hi)
        throw Error('Detailed individual duplicated in background');
    for (const loss of s.losses) for (const entry of keys)
      if (entry.family === loss.originId && loss.ordinal >= entry.lo && loss.ordinal < entry.hi) throw Error('Dead individual duplicated in background');
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
      validateSource({ id: s.sourceId, calendar: s.calendar, regions: s.regions,
        groups: s.groups.map(g => ({ ...g, cohorts: g.cohorts.map(c => ({ ...c, count: count(c), ageDays: Math.max(0, (s.clock - c.bornAt) / DAY) })) })) });
      for (const r of s.regions) {
        const rate = s.rates[r.id];
        if (!rate || !['renewal', 'demand', 'supply'].every(k => rate[k] && Object.values(rate[k]).every(nonnegative))
          || !rate.net || !Object.values(rate.net).every(Number.isFinite)) return null;
      }
      for (const g of s.groups) {
        if (!integer(g.choiceSerial) || !Array.isArray(g.knowledge) || !g.needs || !Object.values(g.needs).every(nonnegative)) return null;
        if (g.intention && (!id(g.intention.destination) || !nonnegative(g.intention.chosenAt) || !(g.intention.departAt > s.clock - EPS))) return null;
        if (g.transit && (!Array.isArray(g.transit.path) || g.transit.path.length !== 2 || ![0, 1].includes(g.transit.edgeIndex)
          || !nonnegative(g.transit.departedAt) || !(g.transit.edgeArriveAt > s.clock - EPS)
          || !(g.transit.crossAt > g.transit.departedAt) || !(g.transit.edgeArriveAt > g.transit.crossAt)
          || g.transit.path.some(id => !s.regions.some(r => r.id === id)))) return null;
        for (const c of g.cohorts) if (!Number.isFinite(c.bornAt) || !nonnegative(c.structuralKg) || c.massKg + EPS < c.structuralKg
          || !c.stores || !Object.values(c.stores).every(nonnegative) || !nonnegative(c.health) || c.health > 1
          || !integer(c.deathSerial) || !nonnegative(c.deathExposure) || !nonnegative(c.deathThreshold)
          || !c.needs || !Object.values(c.needs).every(nonnegative)) return null;
      }
      for (const [actorId, d] of Object.entries(s.details)) if (actorId !== d.actorId || !id(d.memberId) || !integer(d.ordinal)
        || !['detailed', 'dead'].includes(d.status) || !s.groups.some(g => g.id === d.groupId && g.populationId === d.populationId)) return null;
      audit(s); return s; // Preserve cached event times; loading is not a reroll or refill.
    } catch { return null; }
  }
  return { DAY, count, cohortKey, monthAt, hazardIntegral, validateSource, create, chooseDestination,
    advance, detail, recordDetailedLoss, removeStock, kill, audit, rebind, normalize };
});
