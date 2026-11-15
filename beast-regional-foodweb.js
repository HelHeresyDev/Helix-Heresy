// Sparse regional contacts, not a per-animal strategic update or a prey census.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-behavior') : root.HelixBeastBehavior,
    node ? require('./beast-predation') : root.HelixBeastPredation,
    node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./beast-demography') : root.HelixBeastDemography,
    node ? require('./background-wildlife') : root.HelixBackgroundWildlife,
    node ? require('./beast-foraging') : root.HelixBeastForaging);
  if (node) module.exports = api;
  root.HelixBeastRegionalFoodweb = api;
})(globalThis, function (Data, Life, Bodies, Behavior, Predation, Wilderness, Demography, Wildlife, Foraging) {
  'use strict';
  const DAY = Life.DAY, EPS = 1e-8, BIN = 128, LIMIT = 16, DURATION = 300;
  const copy = x => JSON.parse(JSON.stringify(x)), size = c => Demography.size(c.ranges);
  const finite = n => Number.isFinite(n) && n >= 0;
  const point = p => p && ['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(p[k]));
  const energyKeys = ['heatMJ', 'chargeMJ', 'focus', 'crownKg', 'lightKg'];
  const referenceCache = new Map();
  const harmIndexes = new WeakMap();
  function noteFeeding(g, c, r, at) {
    r.contactHarms ||= [];
    let index = harmIndexes.get(r);
    if (!index || index.rows !== r.contactHarms) {
      index = { rows: r.contactHarms, byCohort: new Map(r.contactHarms.map(h => [`${h.groupId}:${h.cohortId}`, h])) };
      harmIndexes.set(r, index);
    }
    const key = `${g.id}:${c.id}`;
    let row = index.byCohort.get(key);
    if (!row) { row = { groupId: g.id, cohortId: c.id }; r.contactHarms.push(row); index.byCohort.set(key, row); }
    Object.assign(row, { at, position: c.regionalPosition || position(g, r), kind: 'feeding' });
  }
  function reference(speciesId) {
    if (!referenceCache.has(speciesId)) {
      const a = Wilderness.actor(speciesId, 'body-reference', { x: 0, y: 0, z: 0 }, 'body-reference');
      referenceCache.set(speciesId, { energy: a.life.energyCapacity, armourKg: a.life.armourKg, massKg: a.bodyPhysics.massKg });
    }
    return referenceCache.get(speciesId);
  }
  function position(g, r, c = null, ordinal = 0) {
    if (g.transit) return null;
    if (c?.regionalPosition?.regionId === r.id) return copy(c.regionalPosition);
    if (g.regionalPosition?.regionId === r.id && point(g.regionalPosition)) return copy(g.regionalPosition);
    if (g.home?.patchId !== r.id || !Number.isFinite(g.home.eastKm) || !Number.isFinite(g.home.northKm)) return null;
    const p = { regionId: r.id, eastM: g.home.eastKm * 1000, northM: g.home.northKm * 1000, altitudeM: -g.home.depthM || 0 };
    if (c) {
      const formation = g.regionalFormation?.[c.originId]; if (!formation) return null;
      p.eastM += formation.offsetM + ordinal % formation.columns * formation.eastSpacingM;
      p.northM += Math.floor(ordinal / formation.columns) * formation.northSpacingM;
    }
    return p;
  }
  function environment(r, season = 0) {
    const marine = r.kind === 'waterColumn', water = marine ? r.stocks.seawaterL : r.stocks.waterL;
    return { floor: r.floor === true, waterDepthM: ['waterColumn', 'wetland'].includes(r.kind)
      ? (water || 0) / (r.areaHa * 10000 * 1000) : 0,
      soilDepthM: r.kind === 'subsurface' ? r.depthM : r.accessibleMineralDepthM || 0,
      oxygen: r.oxygen !== false, ceilingM: r.kind === 'subsurface' ? r.depthM : Infinity,
      densityKgM3: r.densityKgM3 || 1600, hardness: r.source?.surfaceDeposit === 'n' ? 6 : 2,
      temperatureC: r.seasons?.[season]?.temperatureC ?? 20, light: r.kind === 'subsurface' ? 0 : 100 };
  }
  function blocked(r, a, b) {
    // Explicit local barriers are physical inputs, not received animal maps.
    return (r.contactBarriers || []).some(w => {
      if (Math.max(a.altitudeM, b.altitudeM) < w.bottomM || Math.min(a.altitudeM, b.altitudeM) > w.topM) return false;
      let lo = 0, hi = 1;
      for (const [key, min, max] of [['eastM', w.minEastM, w.maxEastM], ['northM', w.minNorthM, w.maxNorthM]]) {
        const delta = b[key] - a[key];
        if (!delta) { if (a[key] < min || a[key] > max) return false; }
        else { const x = (min - a[key]) / delta, y = (max - a[key]) / delta; lo = Math.max(lo, Math.min(x, y)); hi = Math.min(hi, Math.max(x, y)); }
      }
      return lo <= hi;
    });
  }
  const actorPoint = a => ({ eastM: a.mapCell.x, northM: a.mapCell.y, altitudeM: Bodies.height(a) });
  function context(r, actors, season) {
    const terrain = environment(r, season), patch = { ...terrain, resources: r.stocks, transfers: {}, events: [],
      waterAccounted: true, areaHa: r.areaHa, condition: null };
    const signal = (a, b, channel) => {
      const from = actorPoint(a), to = actorPoint(b);
      if (blocked(r, from, to)) return false;
      if (channel === 'vibration') return from.altitudeM <= 0 && to.altitudeM <= 0 && r.floor;
      if (channel === 'pressure') return from.altitudeM < 0 && to.altitudeM < 0 && terrain.waterDepthM > 0;
      return r.kind !== 'subsurface'; // Solid rock is not an open sight/scent tunnel.
    };
    return { alive: true, local: true, actors, tileSizeM: 1, terrain: () => terrain, patch: () => patch,
      blocked: () => false, signal, lightAt: () => terrain.light, effectLine: (a, b) => signal(a, b, 'sight'),
      foodKeys: Behavior.foodKeys, canHunt: a => Behavior.capabilities[a.speciesId]?.includes('hunt'),
      protectedTarget: (a, b) => a.protectedGroupIds?.includes(b.life.originalGroupId),
      destinationSeen: () => false, sunlightFluxMJ: 0, cloudCover: 1, focusAngle: 0,
      noise: 0, contestedNoise: false, conductive: () => false,
      waste: (a, key, kg) => put(r, key, kg) };
  }
  function put(r, key, kg) {
    if (!(kg > 0)) return;
    const accepted = Math.min(kg, Math.max(0, (r.capacity[key] || 0) - (r.stocks[key] || 0)));
    if (accepted) r.stocks[key] = (r.stocks[key] || 0) + accepted;
    if (kg > accepted) { r.outputs ||= {}; r.outputs[`${key}Overflow`] = (r.outputs[`${key}Overflow`] || 0) + kg - accepted; }
  }
  function initial(c, at) {
    // These are attributable lower bounds, not freshly full personal reserves.
    // Ordinary supplied rest can establish effort; paid food can restore mana.
    c.regional ||= { at, stamina: 0, mana: 0, energy: Object.fromEntries(energyKeys.map(k => [k, 0])),
      parts: Object.fromEntries(Bodies.profiles[c.speciesId].parts.map(k => [k, 100])), armourKg: 0,
      conditions: [], cooldowns: {}, workBlocked: false };
    if (!c.regional.originalTissueAccounted) {
      const ref = reference(c.speciesId);
      c.regional.armourKg = ref.armourKg * c.massKg / ref.massKg;
      c.regional.energy.crownKg = ref.energy.crownKg * c.massKg / ref.massKg;
      c.regional.originalTissueAccounted = true;
    }
    return c.regional;
  }
  function restore(c, g, r, at) {
    const state = initial(c, at), managed = c.foraging && r.foraging && !g.transit;
    const elapsed = Math.max(0, at - state.at), p = Data.lifecycle[c.speciesId];
    if (managed) { state.at = at; c.foraging.restPending = 0; return; } // Paid at its actual supplied-rest interval, not after a later meal.
    const n = size(c); if (!n) { state.at = at; return; }
    const manaCapacity = p.manaCapacity * Math.min(1, c.massKg / p.adultKg);
    const canRest = !g.transit && !c.contactBusyUntil && (r.floor || r.kind === 'waterColumn');
    if (canRest && c.speciesId !== 'beast:mirror-ape' && state.mana < manaCapacity) {
      const stockKey = g.resources?.foodKg || 'foodKg';
      if (Behavior.foodKeys({ speciesId: c.speciesId }).includes(stockKey)) {
        const kg = Math.min((r.stocks[stockKey] || 0) / n, p.foodKgDay * elapsed / 600,
          Math.max(0, (manaCapacity - state.mana) * .01 - c.stores.foodKg));
        if (kg > 0) { r.stocks[stockKey] -= kg * n; c.stores.foodKg += kg; c.massKg += kg; }
      }
    }
    const food = p.foodKgDay === 0 || c.stores.foodKg + c.stores.fatKg > EPS;
    const water = p.waterLDay === 0 || c.stores.waterL > EPS || (r.stocks[g.resources?.waterL || 'waterL'] || 0) > EPS;
    if (canRest && food && water)
      state.stamina = Math.min(300, state.stamina + elapsed * .5);
    // Same paid food-to-mana conversion as local resting biology. No personal
    // mana is inferred from a region's gross magical maintenance throughput.
    if (canRest && food && water && c.speciesId !== 'beast:mirror-ape') {
      const mana = Math.min(Math.max(0, manaCapacity - state.mana), elapsed / 10, c.stores.foodKg / .01);
      state.mana += mana; c.stores.foodKg -= mana * .01; c.massKg -= mana * .01;
      r.outputs ||= {}; r.outputs.manaRecoveryWasteKg = (r.outputs.manaRecoveryWasteKg || 0) + mana * .01 * size(c);
    }
    if (canRest && p.otherDay > 0) {
      const key = c.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ', ref = reference(c.speciesId);
      const kgScale = Math.min(1, c.massKg / p.adultKg), capacity = ref.energy[key] * kgScale;
      const amount = Math.min((r.stocks[key] || 0) / n, p.otherDay * elapsed / 600, Math.max(0, capacity - state.energy[key]));
      state.energy[key] += amount; if (amount) r.stocks[key] -= amount * n;
    }
    state.at = at;
  }
  function actor(g, c, ordinal, r, at) {
    const pos = position(g, r, c, ordinal); if (!pos || !size(c)) return null;
    const a = Wilderness.actor(c.speciesId, `${c.originId}:${ordinal}`, { x: Math.round(pos.eastM), y: Math.round(pos.northM), z: 0 }, g.populationId, at,
      { massKg: c.massKg, ageDays: Math.max(0, (at - c.bornAt) / DAY), role: c.role, colonyId: c.colonyId, will: g.will, willing: g.willing });
    const state = initial(c, at), b = a.bodyPhysics;
    a.maxHealth = Math.max(1, a.maxHealth * Math.min(1, Math.sqrt(c.massKg / Data.lifecycle[c.speciesId].adultKg)));
    b.altitudeM = pos.altitudeM; b.stamina = state.stamina; b.mana = state.mana; b.parts = copy(state.parts);
    if (r.kind === 'subsurface') b.mode = 'burrowing';
    else if (r.kind === 'waterColumn' || r.kind === 'wetland' && Bodies.profiles[c.speciesId].modes.includes('swimming')
      && environment(r).waterDepthM >= Bodies.profiles[c.speciesId].minWaterDepthM)
      b.mode = Bodies.profiles[c.speciesId].modes.includes('drifting') ? 'drifting' : 'swimming';
    else if (Bodies.profiles[c.speciesId].modes.includes('walking') || Bodies.profiles[c.speciesId].modes.includes('charging')) b.mode = 'walking';
    a.health = a.maxHealth * c.health; a.life.stores = copy(c.stores); a.life.structuralKg = c.structuralKg;
    a.life.originalGroupId = g.id; a.life.energy = copy(state.energy); a.life.armourKg = state.armourKg;
    a.life.cooldowns = copy(state.cooldowns); a.beastConditions = copy(state.conditions);
    a.protectedGroupIds = g.protectedGroupIds || [];
    if (c.feedingTowers) c.feedingTowers.forEach((health, i) => { b.parts[`feeding tower ${i + 1}`] = health; });
    return a;
  }
  function initialize(s, enabled) {
    if (!enabled) return;
    s.foodWeb = { nextAt: (Math.floor(s.clock / DAY) + 1) * DAY, lastAt: s.clock, pending: [],
      serial: 0, receipts: { attempts: 0, contacts: 0, kills: 0, escapes: 0, interrupted: 0, consumedKg: 0, decomposedKg: 0, deferred: 0 },
      work: { indexedGroups: 0, candidateChecks: 0, combatSteps: 0 }, events: [] };
    for (const r of s.regions) Foraging.initialize(r);
    for (const g of s.groups) {
      g.regionalFormation = {}; let offsetM = 0;
      for (const c of g.cohorts) {
        initial(c, s.clock);
        const profile = Bodies.profiles[c.speciesId], scale = Math.cbrt(c.massKg / profile.massKg), columns = Math.max(1, Math.ceil(Math.sqrt(size(c))));
        const eastSpacingM = profile.lengthM * scale * 1.1, northSpacingM = profile.widthM * scale * 1.1;
        g.regionalFormation[c.originId] = { offsetM, columns, eastSpacingM, northSpacingM };
        offsetM += columns * eastSpacingM;
      }
    }
  }
  function plan(s, month) {
    if (!s.foodWeb) return;
    for (const g of s.groups) {
      const n = g.cohorts.reduce((n, c) => n + size(c), 0), p = Data.lifecycle[g.speciesId];
      g.foodWebPlan = { monthIndex: month.index, plannedAt: month.plannedAt ?? month.start,
        huntingRemaining: Math.floor(n * p.huntsDay * (month.end - month.start) / DAY),
        contactPulses: 0 };
      if (s.regions.some(r => r.id === g.regionId && r.foraging) && (Behavior.capabilities[g.speciesId]?.includes('hunt') || g.speciesId === 'beast:carrion-lantern'))
        for (const c of g.cohorts) Foraging.plan(g, c, month, month.plannedAt ?? month.start);
    }
  }
  function event(s, at, kind, detail) {
    s.foodWeb.events.push({ at, kind, ...detail });
    if (s.foodWeb.events.length > 128) s.foodWeb.events.shift();
  }
  function binKey(regionId, p, dx = 0, dy = 0) { return `${regionId}:${Math.floor(p.eastM / BIN) + dx}:${Math.floor(p.northM / BIN) + dy}`; }
  function index(rows) {
    const bins = new Map();
    for (const row of rows) if (row.position) {
      const key = binKey(row.regionId, row.position); if (!bins.has(key)) bins.set(key, []); bins.get(key).push(row);
    }
    return bins;
  }
  function nearby(bins, regionId, pos, seed, counters) {
    const result = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      const rows = bins.get(binKey(regionId, pos, x, y)) || [];
      if (rows.length > LIMIT) counters.deferred += rows.length - LIMIT;
      const start = Math.floor(Life.random(`${seed}:${x}:${y}`) * rows.length);
      for (let i = 0; i < Math.min(LIMIT, rows.length); i++) result.push(rows[(i + start) % rows.length]);
    }
    return result;
  }
  function chooseCohort(g, seed) {
    const live = g.cohorts.filter(c => size(c) && c.health > 0 && !c.contactBusyUntil && !c.foraging?.action);
    const n = live.reduce((n, c) => n + size(c), 0); let rank = Math.floor(Life.random(seed) * n);
    for (const c of live) { if (rank < size(c)) return c; rank -= size(c); }
    return null;
  }
  function support(g, primary, r, at, target, ctx) {
    if (!['beast:rimefang-pack', 'beast:gloam-prowler', 'beast:mire-choir'].includes(g.speciesId)) return [];
    const result = [];
    for (const c of g.cohorts) {
      if (c.contactBusyUntil || c.foraging?.action || c.health <= .3) continue;
      for (const [lo, hi] of c.ranges) for (let ordinal = lo; ordinal < Math.min(hi, lo + 8) && result.length < 7; ordinal++) {
        if (`${c.originId}:${ordinal}` === primary.id) continue;
        const a = actor(g, c, ordinal, r, at);
        if (a && a.life.will && a.life.willing && Predation.sensed(a, target, ctx)
          && Behavior.canSense(primary, a, 'hearing', ctx) && (g.speciesId === 'beast:mire-choir' || Predation.hungry(a)))
          result.push({ g, c, ordinal, a });
      }
      if (result.length >= 7) break;
    }
    return result;
  }
  function addRemains(s, r, key, g, c, n, at, cause, pos) {
    r.remainsBatches ||= {};
    // A new death cannot move/refill an older carcass at another location.
    const suffix = pos ? `${Math.floor(pos.eastM / 4)}:${Math.floor(pos.northM / 4)}:${Math.floor(pos.altitudeM / 4)}` : 'unlocated';
    const id = `${key}:${suffix}`, row = r.remainsBatches[id] ||= { count: 0, massKg: 0, edibleKg: 0,
      initialEdibleKg: 0, consumedKg: 0, decomposedKg: 0, lastAt: at, firstAt: at, speciesId: c.speciesId, groupId: g.id,
      position: pos && copy(pos), cause, sourceKey: key };
    decay(s, r, row, at);
    const kg = c.massKg * n, edible = c.speciesId === 'beast:ironroot-colossus' ? 0 : kg * .6;
    row.count += n; row.massKg += kg; row.edibleKg += edible; row.initialEdibleKg += edible;
    row.lastDeathAt = at;
  }
  function decay(s, r, row, at) {
    const elapsed = Math.max(0, at - Math.max(row.lastAt, row.frozenUntil || 0)); row.lastAt = at;
    const kg = Math.max(0, row.edibleKg - (row.reservedKg || 0)) * -Math.expm1(-elapsed / DAY * .1);
    row.edibleKg -= kg; row.massKg -= kg; row.decomposedKg += kg; put(r, 'detritusKg', kg);
    s.foodWeb.receipts.decomposedKg += kg;
  }
  function feed(s, g, c, a, r, rows, at, foraging = false) {
    if ((!foraging && !Predation.hungry(a)) || foraging && size(c) !== 1 || !a.life.will || a.life.willing === false
      || !Behavior.foodKeys(a).some(k => ['meatKg', 'carrionKg'].includes(k))) return;
    for (const { row } of rows) {
      s.foodWeb.work.candidateChecks++;
      if (!(row.edibleKg > 0) || !point(row.position) || g.protectedGroupIds?.includes(row.groupId)) continue;
      const target = { id: 'remains', mapCell: { x: Math.round(row.position.eastM), y: Math.round(row.position.northM), z: 0 },
        status: 'dead', bodyPhysics: { altitudeM: row.position.altitudeM } };
      // Body-height lookup requires a real typed corpse. Reuse a transient
      // original body; it is never a newly live member or a second corpse owner.
      const body = Wilderness.actor(row.speciesId, 'corpse-contact', target.mapCell, 'remains', at, { massKg: Math.max(.000001, row.massKg / Math.max(1, row.count)) });
      body.status = 'dead'; body.health = 0; body.bodyPhysics.altitudeM = row.position.altitudeM;
      const ctx = context(r, [a, body], 0);
      if (!Predation.sensed(a, body, ctx, true) || Behavior.distance(a, body, ctx) > 2) continue;
      const p = Data.lifecycle[c.speciesId], managed = Boolean(r.foraging && c.foraging);
      const capacity = Math.min(c.massKg * .25, Math.max(p.foodKgDay * (p.foodReserveDays || 1), p.newbornKg || 0));
      // Only this original contact member feeds. Other members do not receive
      // food remotely merely because their cohort shares a strategic patch.
      const amount = Math.min(Math.max(0, row.edibleKg - (row.reservedKg || 0)),
        managed ? Math.max(0, Foraging.capacity(c) - c.stores.foodKg) : p.foodKgDay * DURATION / 600,
        Math.max(0, (managed ? Foraging.capacity(c) : capacity) - c.stores.foodKg));
      if (!(amount > EPS)) return;
      const ordinal = c.ranges[0][0], eater = split(g, c, ordinal, at);
      if (managed) {
        const key = Object.keys(r.remains || {}).find(k => r.remains[k] === row) || Object.keys(r.remainsBatches || {}).find(k => r.remainsBatches[k] === row);
        if (Foraging.claim(r, g, eater, 'beast', key, amount, at, position(g, r, eater, ordinal))) {
          eater.foraging.nextAt = at; return true;
        }
      }
      row.edibleKg -= amount; row.massKg -= amount; row.consumedKg += amount;
      const light = c.speciesId === 'beast:carrion-lantern' ? amount * .05 : 0;
      eater.stores.foodKg += amount - light; eater.massKg += amount;
      eater.regional.energy.lightKg += light;
      s.foodWeb.receipts.consumedKg += amount;
      event(s, at, 'fedFromRemains', { groupId: g.id, memberId: `${eater.originId}:${ordinal}`, sourceKey: row.sourceKey, kg: amount }); return true;
    }
  }
  function split(g, c, ordinal, at) {
    if (!c.ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi)) throw Error('Contact does not own that original member');
    const n = size(c); if (n === 1) return c;
    const ranges = [[ordinal, ordinal + 1]], rest = Demography.subtract(c.ranges, ranges), chosen = copy(c);
    chosen.id = `${c.originId}:contact:${ordinal}`; chosen.ranges = ranges; chosen.contactSplit = true; c.ranges = rest;
    if (c.aggregateMortality) {
      chosen.mortalityBalance /= n; c.mortalityBalance *= (n - 1) / n;
      chosen.batchMembers = 1; c.batchMembers = n - 1; chosen.batchHazard = c.batchHazard = 0;
    } else {
      // Memoryless residual hazard for the newly separated original, seeded
      // once at physical separation; the remaining stream keeps its clock.
      chosen.deathExposure = 0;
      chosen.deathThreshold = -Math.log(1 - (Life.random(`${chosen.id}:split:${at}`) + .5 / 4294967296));
    }
    function partition(d, keep) {
      if (!d) return;
      d.cooldowns = d.cooldowns.map(x => ({ ...x, ranges: Demography.intersect(x.ranges, keep) })).filter(x => x.ranges.length);
      d.broods = d.broods.map(b => { const parents = Demography.intersect(b.parents, keep), ratio = Demography.size(parents) / Demography.size(b.parents);
        return { ...b, parents, successful: Demography.intersect(b.successful, keep), investedKg: b.investedKg * ratio, investedMana: b.investedMana * ratio };
      }).filter(b => b.parents.length);
    }
    if (c.demography) { chosen.demography.credit /= n; c.demography.credit *= (n - 1) / n; partition(chosen.demography, ranges); partition(c.demography, rest); }
    g.cohorts.push(chosen); return chosen;
  }
  function harm(s, r, g, c, a, target, at, ctx, sequence, damage, type) {
    if (target.status === 'dead' || !Behavior.conscious(a, at) || !ctx.effectLine(a, target)) return false;
    const mods = Behavior.modifiers(a, at), score = 58 + a.health / a.maxHealth * 18 - mods.attack - 24;
    if (score + (Life.random(`${s.sourceId}:${a.id}:${target.id}:${sequence}`) * 16 - 8) < 0) return false;
    const actual = Behavior.absorb(target, damage, type, at, ctx);
    target.health = Math.max(0, target.health - actual);
    const parts = Object.keys(target.bodyPhysics.parts), part = parts[Math.floor(Life.random(`${a.id}:${target.id}:part:${sequence}`) * parts.length)];
    Bodies.damagePart(target, part, actual, at); Behavior.interrupt(target, at, 'Regional physical contact');
    if (!target.health) { target.status = 'dead'; target.diedAt = at; }
    return true;
  }
  function resolve(s, contact, at, api) {
    const r = api.region(contact.regionId), participants = contact.members.map(m => {
      const g = api.group(m.groupId), c = g?.cohorts.find(c => c.id === m.cohortId);
      return { g, c, a: c && size(c) && !g.transit && g.regionId === r.id ? actor(g, c, m.ordinal, r, contact.startedAt) : null, ordinal: m.ordinal };
    });
    if (participants.some(m => !m.a || m.c.health <= 0)) {
      s.foodWeb.receipts.interrupted++; for (const m of participants) if (m.c) delete m.c.contactBusyUntil; return;
    }
    const ctx = context(r, participants.map(m => m.a), contact.season), [hunter, prey] = participants;
    let t = contact.startedAt, steps = 0, result = 'timeBudgetSpent';
    ctx.strike = (a, target, hit) => harm(s, r, hunter.g, hunter.c, a, target, t, ctx, ++steps, hit.damage, hit.type);
    ctx.damage = (target, amount) => { target.health = Math.max(0, target.health - amount); if (!target.health) target.status = 'dead'; };
    for (; t < at && steps < 96 && hunter.a.status !== 'dead' && prey.a.status !== 'dead'; steps++) {
      const a = hunter.a, b = prey.a, distance = Behavior.distance(a, b, ctx);
      if (!Predation.sensed(a, b, ctx) || !Behavior.conscious(a, t) || !Bodies.capable(a, a.bodyPhysics.mode)) { result = 'lostContact'; break; }
      const reach = Bodies.profiles[a.speciesId].reachM;
      const fleeing = b.life.will && (Behavior.canSense(b, a, 'sight', ctx) || Behavior.canSense(b, a, 'hearing', ctx));
      const injured = b.health < b.maxHealth * .3;
      if (distance > reach || injured) {
        const move = (body, metres, away) => {
          const dx = b.mapCell.x - a.mapCell.x, dy = b.mapCell.y - a.mapCell.y, len = Math.hypot(dx, dy) || 1;
          const start = actorPoint(body), end = { ...start, eastM: start.eastM + dx / len * metres * away, northM: start.northM + dy / len * metres * away };
          if (blocked(r, start, end)) return false;
          body.mapCell.x = Math.round(end.eastM); body.mapCell.y = Math.round(end.northM);
          body.bodyPhysics.stamina -= metres; body.bodyPhysics.distanceM += metres; return true;
        };
        const speed = body => Bodies.capable(body, body.bodyPhysics.mode) ? Bodies.profiles[body.speciesId].speed * Math.max(.1, 1 - Bodies.wounded(body, /leg|limb|wing|fin|tail/) * .8) : 0;
        const seconds = Math.min(12, at - t), preyMove = fleeing ? Math.min(b.bodyPhysics.stamina, speed(b) * seconds) : 0;
        if (preyMove) move(b, preyMove, 1);
        const gap = Behavior.distance(a, b, ctx);
        const pursuit = Math.min(a.bodyPhysics.stamina, speed(a) * seconds, Math.max(0, gap - Math.max(.5, reach - .5)));
        if (pursuit) move(a, pursuit, 1);
        t += seconds; if (injured || fleeing && speed(b) >= speed(a) && distance > reach) { result = 'escaped'; break; }
        continue;
      }
      for (const [body, target] of [[a, b], [b, a], ...participants.slice(2).map(m => [m.a, b])]) {
        if (body.status === 'dead' || !body.life.will || !Behavior.conscious(body, t) || !Bodies.capable(body, body.bodyPhysics.mode)) continue;
        const range = Behavior.distance(body, target, ctx);
        const canStrike = range <= Bodies.profiles[body.speciesId].reachM;
        if (body.life.pending) Behavior.advanceAction(body, t, 1, ctx);
        else {
          const ability = (Behavior.capabilities[body.speciesId] || []).find(k => ['chorus', 'discharge', 'radiantFan', 'pressurePulse', 'laneInterference'].includes(k)
            && !(body.life.cooldowns[k] > t) && Behavior.affordable(body, Behavior.definitions[k]));
          if (ability && Behavior.begin(body, ability, target, t, ctx).ok) continue;
          const profile = Wilderness.PROFILES[body.speciesId];
          if (canStrike && body.bodyPhysics.stamina >= 1 && t >= body.nextAttackAt) {
            body.bodyPhysics.stamina--; body.nextAttackAt = t + profile.recovery;
            const scale = Math.min(1, Math.sqrt(body.bodyPhysics.massKg / Data.lifecycle[body.speciesId].adultKg));
            harm(s, r, hunter.g, hunter.c, body, target, t, ctx, steps, profile.damage * scale, 'physical');
          }
        }
      }
      const deadlines = participants.flatMap(m => [m.a.life.pending?.dueAt, m.a.nextAttackAt,
        ...(m.a.beastConditions || []).map(c => c.until)]).filter(d => Number.isFinite(d) && d > t + .001);
      t = Math.min(at, t + 12, ...deadlines);
    }
    s.foodWeb.work.combatSteps += steps;
    for (const m of participants) {
      const { c, g, a } = m;
      c.health = Math.min(c.health, a.health / a.maxHealth); c.massKg = a.bodyPhysics.massKg;
      c.structuralKg = Math.min(c.structuralKg, Math.max(0, c.massKg - Object.values(c.stores).reduce((n, v) => n + v, 0)));
      const d = Behavior.definitions[g.ecology?.action];
      c.regional = { at, stamina: a.bodyPhysics.stamina, mana: a.bodyPhysics.mana, energy: copy(a.life.energy),
        parts: copy(a.bodyPhysics.parts), armourKg: a.life.armourKg, conditions: copy(a.beastConditions || []), cooldowns: copy(a.life.cooldowns),
        originalTissueAccounted: true, workBlocked: Boolean(d?.parts && Bodies.wounded(a, d.parts) >= .65) };
      c.regionalPosition = { ...actorPoint(a), regionId: r.id };
      delete c.contactBusyUntil;
      if (c.feedingTowers) c.feedingTowers = c.feedingTowers.map((v, i) => Math.min(v, a.bodyPhysics.parts[`feeding tower ${i + 1}`]));
      if (a.status === 'dead') { api.lose(g, c, m.ordinal, contact.kind === 'hunt' ? 'regionalPredation' : 'regionalConflict', at); s.foodWeb.receipts.kills++; result = 'actualDeath'; }
    }
    if (result === 'escaped' || result === 'lostContact') s.foodWeb.receipts.escapes++;
    event(s, at, 'contactEnded', { id: contact.id, kind: contact.kind, outcome: result, startedAt: contact.startedAt });
  }
  function finish(s, at, api, regionIds = null) {
    if (!s.foodWeb) return;
    const web = s.foodWeb;
    const due = web.pending.filter(c => c.dueAt <= at + EPS && (!regionIds || regionIds.has(c.regionId)));
    const claimed = new Set(due); web.pending = web.pending.filter(c => !claimed.has(c));
    for (const c of due) resolve(s, c, at, api);
    for (const r of s.regions) if (!regionIds || regionIds.has(r.id)) Wildlife.finish(r, at, { ...api,
      canForage(g, c) {
        const a = actor(g, c, c.ranges[0]?.[0], r, at); if (!a) return false;
        const ctx = context(r, [a], s.plans.at(-1).season);
        return Behavior.conscious(a, at) && Bodies.capable(a, a.bodyPhysics.mode)
          && !Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode, Bodies.height(a), ctx);
      } });
  }
  function advance(s, at, month, api) {
    if (!s.foodWeb) return;
    finish(s, at, api);
    const web = s.foodWeb;
    if (at + EPS < web.nextAt) return;
    web.nextAt = (Math.floor((at + EPS) / DAY) + 1) * DAY; web.lastAt = at;
    const regionMap = new Map(s.regions.map(r => [r.id, r])), rows = [], harms = new Map();
    for (const r of s.regions) {
      r.contactHarms = (r.contactHarms || []).filter(h => at - h.at <= 60);
      const byGroup = new Map(); harms.set(r.id, byGroup);
      for (const h of r.contactHarms) { if (!byGroup.has(h.groupId)) byGroup.set(h.groupId, []); byGroup.get(h.groupId).push(h); }
    }
    for (const r of s.regions) for (const row of [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {})]) {
      if (row.initialEdibleKg == null) { row.initialEdibleKg = row.edibleKg; row.consumedKg = row.decomposedKg = 0; row.lastAt = row.at ?? row.lastAt ?? at; }
      decay(s, r, row, at); if (row.position && row.edibleKg > EPS) rows.push({ regionId: r.id, position: row.position, row });
    }
    const corpses = index(rows), live = [];
    for (const g of s.groups) {
      const r = regionMap.get(g.regionId), pos = position(g, r); if (!pos || !g.cohorts.some(c => size(c))) continue;
      for (const c of g.cohorts) restore(c, g, r, at);
      live.push({ regionId: r.id, position: pos, g });
    }
    const bins = index(live); web.work.indexedGroups += live.length;
    for (const entry of live) {
      const { g, position: pos } = entry, r = regionMap.get(g.regionId), p = Data.lifecycle[g.speciesId];
      if (g.will === false || g.willing === false || !g.foodWebPlan) continue;
      const c = chooseCohort(g, `${g.id}:${at}:active`); if (!c) continue;
      const ordinal = c.ranges[0][0], a = actor(g, c, ordinal, r, at); if (!a) continue;
      const ctx = context(r, [a], month.season);
      if (!Bodies.capable(a, a.bodyPhysics.mode) || Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode, Bodies.height(a), ctx)) continue;
      if (feed(s, g, c, a, r, nearby(corpses, r.id, pos, `${g.id}:${at}:carrion`, web.receipts), at)) continue;
      const hunting = Behavior.capabilities[g.speciesId]?.includes('hunt') && g.foodWebPlan.huntingRemaining > 0 && Predation.hungry(a);
      const neighbors = nearby(bins, r.id, pos, `${g.id}:${at}:contact`, web.receipts);
      if (hunting) { g.foodWebPlan.huntingRemaining--; web.receipts.attempts++; }
      g.foodWebPlan.contactPulses++;
      for (const other of neighbors) {
        if (other.g.id === g.id || other.g.speciesId === g.speciesId) continue;
        web.work.candidateChecks++;
        const targetC = chooseCohort(other.g, `${g.id}:${other.g.id}:${at}:target`); if (!targetC) continue;
        const target = actor(other.g, targetC, targetC.ranges[0][0], r, at); if (!target) continue;
        const helpers = support(g, a, r, at, target, ctx);
        ctx.actors = [a, target, ...helpers.map(m => m.a)];
        if (Bodies.habitatReason(target, target.mapCell, target.bodyPhysics.mode, Bodies.height(target), ctx)) continue;
        const antagonism = Data.antagonisms.find(e => e.nurturer === g.speciesId && e.destroyer === other.g.speciesId);
        const damage = (harms.get(r.id).get(other.g.id) || []).some(h => point(h.position)
          && Math.hypot(h.position.eastM - a.mapCell.x, h.position.northM - a.mapCell.y) <= Math.max(Bodies.profiles[a.speciesId].sightM, Bodies.profiles[a.speciesId].hearingM));
        const defends = antagonism && damage && Predation.sensed(a, target, ctx) && !ctx.protectedTarget(a, target)
          && !(['roc-ashhorn', 'roc-furnace'].includes(antagonism.id) && at - targetC.bornAt >= Data.lifecycle[targetC.speciesId].adultDays * DAY);
        const hunts = hunting && Predation.eligible(a, target, ctx);
        if (!hunts && !defends || !Behavior.conscious(a, at) || !ctx.effectLine(a, target)) continue;
        // A contact consumes one actual opportunity, never a species-wide kill
        // multiplier. The authored success ceiling can also end a hunt empty.
        if (hunts && Life.random(`${g.id}:${at}:opportunity`) >= p.huntSuccess) { event(s, at, 'failedHunt', { groupId: g.id }); break; }
        const claims = [[g, c, ordinal], [other.g, targetC, targetC.ranges[0][0]], ...helpers.map(m => [m.g, m.c, m.ordinal])];
        const members = claims.map(([group, co, ord]) => {
          // Earlier claims may have split the same source cohort.
          co = group.cohorts.find(c => c.originId === co.originId && c.ranges.some(([lo, hi]) => ord >= lo && ord < hi));
          const one = split(group, co, ord, at); one.contactBusyUntil = at + DURATION;
          return { groupId: group.id, cohortId: one.id, ordinal: ord };
        });
        web.pending.push({ id: `regional-contact:${web.serial++}`, regionId: r.id, kind: hunts ? 'hunt' : 'defense',
          antagonismId: defends ? antagonism.id : null, startedAt: at, dueAt: at + DURATION, season: month.season, members });
        web.receipts.contacts++; break;
      }
      if (!r.foraging && !c.contactBusyUntil && Behavior.conscious(a, at) && Predation.hungry(a)
        && Behavior.foodKeys(a).some(k => ['meatKg', 'carrionKg'].includes(k)) && (hunting || g.speciesId === 'beast:carrion-lantern'))
        Wildlife.begin(r, g, c, a, at, position(g, r, c, ordinal), hunting ? 1 : 0);
    }
  }
  function foragers(s, at, month) {
    if (!s.foodWeb) return;
    const regions = new Map(s.regions.map(r => [r.id, r]));
    for (const g of s.groups) {
      const r = regions.get(g.regionId); if (!r?.foraging || g.transit) continue;
      if (!Behavior.capabilities[g.speciesId]?.includes('hunt') && g.speciesId !== 'beast:carrion-lantern') continue;
      for (const c of g.cohorts) {
        if (!size(c)) continue;
        Foraging.plan(g, c, month, at);
        const a = actor(g, c, c.ranges[0][0], r, at), pos = position(g, r, c, c.ranges[0][0]);
        if (c.foraging.nextAt <= at + EPS || c.foraging.action) restore(c, g, r, at);
        const ctx = a && context(r, [a], month.season);
        if (a && c.foraging.phase === 'idle' && !c.contactBusyUntil && size(c) === 1
          && c.stores.foodKg < Math.max(Data.lifecycle[c.speciesId].foodKgDay, c.needs.foodKg || 0)) {
          const rows = [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {})]
            .filter(row => row.position && row.edibleKg > (row.reservedKg || 0)).map(row => ({ row }));
          feed(s, g, c, a, r, rows, at, true);
        }
        Foraging.step(s, r, g, c, at, { actor: a, position: pos,
          usable: Boolean(a && pos && Behavior.conscious(a, at) && Bodies.wounded(a, /head|torso|limb|leg|wing|fin/) < .65
            && !Bodies.habitatReason(a, a.mapCell, a.bodyPhysics.mode, Bodies.height(a), ctx)),
          guilds: actor => Wildlife.guilds(r, c, actor), capture: (q, maximum) => Wildlife.capture(r, g, c, q, maximum, at) });
      }
    }
  }
  function cancelForaging(s, g, at) {
    const r = Demography.region(s, g.transit ? g.transit.path[g.transit.edgeIndex] : g.regionId);
    if (r?.foraging) for (const c of g.cohorts) Foraging.cancel(r, c, at);
  }
  function next(s, regionIds = null) { return s.foodWeb ? Math.min(s.foodWeb.nextAt,
    ...s.foodWeb.pending.filter(c => !regionIds || regionIds.has(c.regionId)).map(c => c.dueAt),
    ...s.regions.filter(r => !regionIds || regionIds.has(r.id)).flatMap(r => (r.wildlife?.pending || []).map(q => q.dueAt))) : Infinity; }
  function cancel(s, groupId, cohortId, ranges, at) {
    if (!s.foodWeb) return;
    const owner = Demography.group(s, groupId), region = owner && Demography.region(s, owner.transit ? owner.transit.path[owner.transit.edgeIndex] : owner.regionId);
    if (region?.foraging) Foraging.cancel(region, owner.cohorts.find(c => c.id === cohortId), at);
    if (region?.wildlife?.pending.some(q => q.groupId === groupId && q.cohortId === cohortId))
      Wildlife.cancel(region, groupId, cohortId, owner.cohorts.find(c => c.id === cohortId));
    const pending = s.foodWeb.pending.filter(p => p.members.some(m => m.groupId === groupId && m.cohortId === cohortId
      && ranges.some(([lo, hi]) => m.ordinal >= lo && m.ordinal < hi)));
    for (const p of pending) {
      s.foodWeb.pending = s.foodWeb.pending.filter(x => x !== p);
      for (const m of p.members) {
        const c = s.groups.find(g => g.id === m.groupId)?.cohorts.find(c => c.id === m.cohortId);
        if (c) { delete c.contactBusyUntil; if (c.regional) c.regional.at = at; }
      }
      s.foodWeb.receipts.interrupted++; event(s, at, 'contactInterrupted', { id: p.id, cause: 'Original participant lost' });
    }
  }
  function handoff(s, groupId, cohortId, at, api) {
    if (!s.foodWeb) return;
    const owner = api.group(groupId), region = owner && api.region(owner.regionId);
    if (region?.foraging) Foraging.cancel(region, owner.cohorts.find(c => c.id === cohortId), at);
    if (region?.wildlife?.pending.some(q => q.groupId === groupId && q.cohortId === cohortId))
      Wildlife.cancel(region, groupId, cohortId, owner.cohorts.find(c => c.id === cohortId));
    const pending = s.foodWeb.pending.filter(p => p.members.some(m => m.groupId === groupId && m.cohortId === cohortId));
    for (const p of pending) {
      s.foodWeb.pending = s.foodWeb.pending.filter(x => x !== p); resolve(s, p, at, api);
      s.foodWeb.receipts.interrupted++; event(s, at, 'contactInterrupted', { id: p.id, cause: 'Physical local handoff' });
    }
    return pending.length > 0;
  }
  function validate(s) {
    if (!s.foodWeb) return s.regionalFoodWeb !== true;
    if (s.regionalFoodWeb !== true) return false;
    const w = s.foodWeb;
    if (!finite(w.nextAt) || w.nextAt <= s.clock || !finite(w.lastAt) || w.lastAt > s.clock
      || !Number.isSafeInteger(w.serial) || w.serial < 0 || !Object.values(w.receipts).every(finite)
      || !Object.values(w.work).every(finite) || !Array.isArray(w.events) || !Array.isArray(w.pending)) return false;
    for (const g of s.groups) {
      if (!g.foodWebPlan || !Number.isSafeInteger(g.foodWebPlan.huntingRemaining) || g.foodWebPlan.huntingRemaining < 0) return false;
      if (!g.regionalFormation || Object.entries(g.regionalFormation).some(([key, f]) => !s.origins[key]
        || !Number.isSafeInteger(f.columns) || f.columns < 1 || !finite(f.offsetM) || !(f.eastSpacingM > 0) || !finite(f.eastSpacingM)
        || !(f.northSpacingM > 0) || !finite(f.northSpacingM))) return false;
      for (const c of g.cohorts) {
        const x = c.regional;
        const appliedAt = s.regionClocks?.[g.transit ? g.transit.path[g.transit.edgeIndex] : g.regionId]?.appliedAt ?? s.appliedAt;
        if (!x || x.originalTissueAccounted !== true || !finite(x.at) || x.at > appliedAt || !finite(x.stamina) || x.stamina > 300 || !finite(x.mana)
          || x.mana > Data.lifecycle[c.speciesId].manaCapacity || !energyKeys.every(k => finite(x.energy[k]))
          || !Bodies.profiles[c.speciesId].parts.every(k => finite(x.parts[k]) && x.parts[k] <= 100) || !finite(x.armourKg) || x.armourKg > c.massKg
          || !Array.isArray(x.conditions) || !Object.values(x.cooldowns).every(finite)) return false;
      }
    }
    const sources = new Map([...s.losses.filter(l => !l.detailOwner).map(l => [l.memberId, l]), ...(s.lossBatches || []).map(l => [l.id, l])]);
    const assigned = new Map(), assignedMass = new Map(); let consumed = 0, decomposed = 0;
    for (const r of s.regions) for (const row of [...Object.values(r.remains || {}), ...Object.values(r.remainsBatches || {})]) {
      const source = sources.get(row.sourceKey);
      if (!source || source.speciesId !== row.speciesId || source.groupId !== row.groupId || source.regionId !== r.id) return false;
      if (!['massKg', 'edibleKg', 'initialEdibleKg', 'consumedKg', 'decomposedKg', 'lastAt'].every(k => finite(row[k]))
        || row.edibleKg > row.massKg + EPS || Math.abs(row.initialEdibleKg - row.edibleKg - row.consumedKg - row.decomposedKg) > 1e-6 * Math.max(1, row.initialEdibleKg)
        || row.position && !point(row.position)) return false;
      assigned.set(row.sourceKey, (assigned.get(row.sourceKey) || 0) + row.initialEdibleKg);
      assignedMass.set(row.sourceKey, (assignedMass.get(row.sourceKey) || 0) + row.massKg + row.consumedKg + row.decomposedKg);
      consumed += row.consumedKg; decomposed += row.decomposedKg;
    }
    for (const [key, loss] of sources) {
      const expected = loss.speciesId === 'beast:ironroot-colossus' ? 0 : loss.massKg * .6;
      if (Math.abs((assigned.get(key) || 0) - expected) > 1e-6 * Math.max(1, expected)
        || Math.abs((assignedMass.get(key) || 0) - loss.massKg) > 1e-6 * Math.max(1, loss.massKg)) return false;
    }
    if (Math.abs(consumed - w.receipts.consumedKg) > 1e-6 * Math.max(1, consumed) || Math.abs(decomposed - w.receipts.decomposedKg) > 1e-6 * Math.max(1, decomposed)) return false;
    const reserved = new Set();
    return w.pending.every(p => finite(p.startedAt) && p.startedAt <= (s.regionClocks?.[p.regionId]?.appliedAt ?? s.appliedAt)
      && finite(p.dueAt) && p.dueAt > s.clock && p.dueAt === p.startedAt + DURATION
      && ['hunt', 'defense'].includes(p.kind) && s.regions.some(r => r.id === p.regionId) && p.members.length >= 2 && p.members.length <= 9
      && p.members.every(m => {
        const key = `${m.groupId}:${m.cohortId}:${m.ordinal}`;
        if (reserved.has(key)) return false; reserved.add(key);
        return Number.isSafeInteger(m.ordinal) && s.groups.find(g => g.id === m.groupId)?.cohorts.some(c => c.id === m.cohortId
          && c.contactBusyUntil === p.dueAt && c.ranges.some(([lo, hi]) => m.ordinal >= lo && m.ordinal < hi));
      }));
  }
  function validateSource(source) {
    if (source.regionalFoodWeb != null && typeof source.regionalFoodWeb !== 'boolean') throw Error('Invalid regional food-web declaration');
    if (source.regionalFoodWeb && source.groups.some(g => !Bodies.profiles[g.speciesId]))
      throw Error('Regional contacts require authored strategic beast bodies, not a second core-care owner');
    for (const r of source.regions) if (r.contactBarriers && (!Array.isArray(r.contactBarriers) || r.contactBarriers.some(w =>
      !['minEastM', 'maxEastM', 'minNorthM', 'maxNorthM', 'bottomM', 'topM'].every(k => Number.isFinite(w[k]))
      || w.minEastM > w.maxEastM || w.minNorthM > w.maxNorthM || w.bottomM > w.topM))) throw Error('Invalid physical contact barrier');
  }
  function summary(s) {
    if (!s.foodWeb) return null;
    const regions = new Map(s.regions.map(r => [r.id, r]));
    return { ...copy(s.foodWeb.receipts), work: copy(s.foodWeb.work), pending: s.foodWeb.pending.length, wildlife: Wildlife.summary(s), foraging: Foraging.summary(s),
      unlocatedLiving: s.groups.reduce((n, g) => n + g.cohorts.reduce((v, c) => v + (c.ranges.length
        && !position(g, regions.get(g.regionId), c, c.ranges[0][0]) ? size(c) : 0), 0), 0),
      unlocatedRemainsKg: s.regions.reduce((n, r) => n + Object.values(r.remainsBatches || {}).reduce((v, row) => v + (!row.position ? row.edibleKg : 0), 0), 0) };
  }
  return { initialize, initial, plan, advance, finish, foragers, cancelForaging, next, validate, validateSource, position, environment, context, actor, split, addRemains, decay, cancel, handoff, noteFeeding, summary, LIMIT, DURATION };
});
