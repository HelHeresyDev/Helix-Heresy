// Background demographic batches, not a per-animal pregnancy/juvenile registry.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./creature-life') : root.HelixCreatureLife);
  if (node) module.exports = api;
  root.HelixBeastDemography = api;
})(globalThis, function (Data, Life) {
  'use strict';
  const DAY = Life.DAY, EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
  const indexes = new WeakMap();
  function index(s) {
    let value = indexes.get(s);
    if (!value || value.regionsArray !== s.regions || value.regions.size !== s.regions.length) {
      value = { regionsArray: s.regions, regions: new Map(s.regions.map(r => [r.id, r])), groups: new Map(), cohorts: new Map(), occupancy: null };
      indexes.set(s, value);
    }
    return value;
  }
  const region = (s, id) => index(s).regions.get(id) || (s.accountRoot && region(s.accountRoot, id));
  const group = (s, id) => index(s).groups.get(id) || (s.accountRoot && group(s.accountRoot, id)) || s.groups.find(g => g.id === id);
  const cohort = (s, groupId, id) => index(s).cohorts.get(`${groupId}:${id}`) || group(s, groupId)?.cohorts.find(c => c.id === id);
  function refreshGroups(s, groups) {
    const value = index(s); value.cohortKeys ||= new Map();
    for (const g of groups) {
      for (const key of value.cohortKeys.get(g.id) || []) value.cohorts.delete(key);
      const keys = []; value.groups.set(g.id, g);
      for (const c of g.cohorts) { const key = `${g.id}:${c.id}`; keys.push(key); value.cohorts.set(key, c); }
      value.cohortKeys.set(g.id, keys);
    }
    value.occupancy = null;
  }
  function prepare(s, at) {
    const value = index(s); value.groups = new Map(); value.cohorts = new Map(); value.cohortKeys = new Map(); value.occupancy = new Map();
    for (const g of s.groups) {
      value.groups.set(g.id, g);
      const keys = []; value.cohortKeys.set(g.id, keys);
      for (const c of g.cohorts) {
        const key = `${g.id}:${c.id}`; keys.push(key); value.cohorts.set(key, c);
        if (c.nurseryId && at - (c.birthSpan?.[1] ?? c.bornAt) < Data.lifecycle[c.speciesId].independentDays * DAY) {
          const key = `${g.regionId}:${c.nurseryId}`;
          value.occupancy.set(key, (value.occupancy.get(key) || 0) + size(c.ranges));
        }
        for (const b of c.demography?.broods || []) {
          const key = `${b.regionId}:${b.nurseryId}`;
          value.occupancy.set(key, (value.occupancy.get(key) || 0) + size(b.parents) * Data.lifecycle[c.speciesId].offspring);
        }
      }
    }
    for (const d of Object.values(s.details || {})) if (d.status === 'detailed' && d.nurseryId) {
      const age = d.actor?.life ? (at - d.actor.life.bornAt) / DAY : d.ageDays + (at - d.detailedAt) / DAY;
      if (age < Data.lifecycle[d.speciesId].independentDays) {
        const key = `${d.regionId}:${d.nurseryId}`; value.occupancy.set(key, (value.occupancy.get(key) || 0) + 1);
      }
    }
  }
  const size = ranges => ranges.reduce((n, [lo, hi]) => n + hi - lo, 0);
  const contains = (ranges, ordinal) => ranges.some(([lo, hi]) => ordinal >= lo && ordinal < hi);
  function subtract(ranges, removed) {
    let result = copy(ranges);
    for (const [lo, hi] of removed) result = result.flatMap(([a, b]) => b <= lo || a >= hi ? [[a, b]]
      : [...(a < lo ? [[a, lo]] : []), ...(b > hi ? [[hi, b]] : [])]);
    return result;
  }
  function intersect(a, b) {
    const result = []; let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1]);
      if (hi > lo) result.push([lo, hi]);
      if (a[i][1] < b[j][1]) i++; else j++;
    }
    return result;
  }
  function take(ranges, amount, end = false) {
    const result = [];
    for (const [lo, hi] of end ? [...ranges].reverse() : ranges) {
      const n = Math.min(amount, hi - lo); if (n > 0) result.push(end ? [hi - n, hi] : [lo, lo + n]);
      amount -= n; if (amount <= 0) break;
    }
    return end ? result.reverse() : result;
  }
  function union(ranges) {
    const result = [];
    for (const [lo, hi] of [...ranges].sort((a, b) => a[0] - b[0])) {
      const last = result.at(-1);
      if (last && lo <= last[1]) last[1] = Math.max(last[1], hi); else result.push([lo, hi]);
    }
    return result;
  }
  const MATTER = ['foodKg', 'forageKg', 'meatKg', 'carrionKg', 'organicKg', 'detritusKg', 'planktonKg', 'waterL', 'mineralsKg', 'calciumKg'];
  const recipeValid = recipe => recipe && Object.keys(recipe).every(k => MATTER.includes(k)) && Object.values(recipe).every(n => Number.isFinite(n) && n >= 0)
    && Math.abs(Object.values(recipe).reduce((n, v) => n + v, 0) - 1) < 1e-8;
  function recipe(g, p, kind) {
    const explicit = g.breeding?.[`${kind}Recipe`];
    if (explicit) return recipeValid(explicit) ? explicit : null;
    // Mineral/energy bodies need a sourced physical mixture; neither energy nor
    // a generic ecological score may be silently converted into body matter.
    return p.foodKgDay > 0 ? { [g.resources?.foodKg || 'foodKg']: 1 } : null;
  }
  function site(s, g, at) {
    if (!g.breeding || g.transit || g.windDriven && g.cohorts.some(c => c.windDrift && (c.windDrift.velocity.x || c.windDrift.velocity.y))
      || g.will === false || g.willing === false || Life.existingOwners[g.speciesId]) return null;
    const r = region(s, g.regionId), nursery = r?.nurseries?.find(n => n.id === g.breeding.siteId);
    if (!nursery || nursery.speciesId !== g.speciesId || nursery.enabled === false || !nursery.habitatSuitable
      || !nursery.phases.includes(s.plans.at(-1).season) || !(nursery.capacity > 0)) return null;
    if (g.windDriven && (!nursery.position || !g.cohorts.some(c => c.role === 'female' && c.regionalPosition?.regionId === r.id
      && Math.hypot(c.regionalPosition.eastM - nursery.position.eastM, c.regionalPosition.northM - nursery.position.northM) <= 1))) return null;
    if (nursery.workSiteId) {
      const site = r.ecology?.workSites.find(site => site.id === nursery.workSiteId && site.colonyId === nursery.colonyId);
      return { ...nursery, furnaceKg: site && site.destroyedAt == null ? site.furnaceKg : 0 };
    }
    return nursery;
  }
  function mature(c, at) {
    const p = Data.lifecycle[c.speciesId], reference = c.role === 'queen' ? p.breederKg : p.adultKg;
    return at - (c.birthSpan?.[1] ?? c.bornAt) >= p.adultDays * DAY && c.structuralKg >= reference * .75;
  }
  function eligible(c, at) {
    const p = Data.lifecycle[c.speciesId];
    return p.fertileDays != null && p.offspring > 0 && c.health >= .6 && mature(c, at)
      && at - (c.birthSpan?.[1] ?? c.bornAt) >= p.fertileDays * DAY
      && (c.role === 'female' || c.role === 'queen' || p.massSource.startsWith('Partition') || /propagule/i.test(p.method));
  }
  const external = p => /egg|clutch|propagule|fragment/i.test(p.method);
  function init(c) {
    c.demography ||= { credit: 0, serial: 0, cooldowns: [], broods: [] };
    return c.demography;
  }
  function freeRanges(c, at) {
    const d = init(c); let result = copy(c.ranges);
    for (const cooldown of d.cooldowns) if (cooldown.until > at + EPS) result = subtract(result, cooldown.ranges);
    if (!external(Data.lifecycle[c.speciesId])) for (const brood of d.broods) result = subtract(result, brood.parents);
    return result;
  }
  function synchronize(s, g, c, at) {
    const d = c.demography; if (!d) return;
    d.cooldowns = d.cooldowns.filter(x => x.until > at + EPS).map(x => ({ ...x, ranges: intersect(x.ranges, c.ranges) })).filter(x => x.ranges.length);
    for (const brood of d.broods) {
      if (!external(Data.lifecycle[c.speciesId])) {
        brood.regionId = g.transit ? g.transit.path[g.transit.edgeIndex] : g.regionId;
        const nurseryHere = site(s, g, at); if (nurseryHere) brood.nurseryId = nurseryHere.id;
      }
      const nursery = region(s, brood.regionId)?.nurseries?.find(n => n.id === brood.nurseryId);
      const destroyed = external(Data.lifecycle[c.speciesId]) && nursery?.destroyedAt != null;
      const before = size(brood.parents), next = c.health > .3 && !destroyed ? intersect(brood.parents, c.ranges) : [];
      const remaining = size(next), fraction = before ? remaining / before : 0;
      const waste = Math.max(0, brood.investedKg - (brood.emitted?.length || 0) * Data.lifecycle[c.speciesId].newbornKg) * (1 - fraction);
      if (waste > 0) {
        const r = region(s, brood.regionId); r.outputs ||= {};
        r.outputs.failedRecruitmentKg = (r.outputs.failedRecruitmentKg || 0) + waste;
      }
      brood.parents = next; brood.successful = intersect(brood.successful, next);
      brood.investedKg *= fraction; brood.investedMana *= fraction;
    }
    d.broods = d.broods.filter(b => b.parents.length);
  }
  function start(s, g, c, at) {
    const p = Data.lifecycle[c.speciesId], nursery = site(s, g, at), d = init(c);
    if (!nursery || !eligible(c, at) || c.contactBusyUntil > at || g.transit || !g.demographicPlan?.requestedReproduction
      || g.demographicPlan.siteId !== nursery.id || g.demographicPlan.regionId !== g.regionId) return;
    if (c.role === 'queen' && (!(nursery.furnaceKg > 0) || nursery.colonyId !== c.colonyId)) return;
    const fragment = p.massSource.startsWith('Partition'), propagation = /propagule/i.test(p.method);
    const mate = g.cohorts.find(m => m.role === 'male' && size(m.ranges) > 0 && m.health >= .6 && mature(m, at)
      && at - (m.birthSpan?.[1] ?? m.bornAt) >= p.fertileDays * DAY && (c.role !== 'queen' || m.colonyId === c.colonyId));
    if (!fragment && !propagation && (!nursery.mateAccess || !mate)) return;
    const materialRecipe = fragment ? {} : recipe(g, p, 'birth');
    if (!materialRecipe || p.reproductiveMana > 0 && !g.breeding.manaStockKey) return;
    if (!index(s).occupancy) prepare(s, at);
    const key = `${g.regionId}:${nursery.id}`, occupied = index(s).occupancy.get(key) || 0;
    const available = freeRanges(c, at);
    const units = Math.min(Math.floor(d.credit + EPS), size(available), Math.floor(Math.max(0, nursery.capacity - occupied) / p.offspring));
    if (!(units > 0) || fragment && c.structuralKg < p.newbornKg * p.offspring * 2) return;
    index(s).occupancy.set(key, occupied + units * p.offspring);
    const parents = take(available, units), serial = d.serial++, id = `brood:${c.id}:${serial}`;
    const successfulUnits = Math.min(units, Math.floor(units * p.success + Life.random(`${id}:success`)));
    const requiredKg = fragment ? p.newbornKg * p.offspring : p.birthMaterialKg;
    if (fragment) { c.structuralKg -= requiredKg * units / size(c.ranges); c.massKg -= requiredKg * units / size(c.ranges); }
    d.credit = Math.max(0, d.credit - units);
    d.cooldowns.push({ ranges: copy(parents), until: at + p.cooldownDays * DAY });
    d.broods.push({ id, parents, successful: take(parents, successfulUnits), regionId: g.regionId,
      nurseryId: nursery.id, startedAt: at, dueAt: at + p.incubationDays * DAY,
      requiredKg, requiredMana: p.reproductiveMana, materialRecipe: copy(materialRecipe),
      manaStockKey: g.breeding.manaStockKey || null, fragment,
      investedKg: fragment ? requiredKg * units : 0, investedMana: 0,
      parentOriginId: c.originId, mateOriginId: mate?.originId || null });
  }
  function requests(s, g, c, at) {
    const p = Data.lifecycle[c.speciesId], n = size(c.ranges), result = [];
    if (!n || c.contactBusyUntil > at || Life.existingOwners[g.speciesId]) return result;
    const reference = c.role === 'queen' ? p.breederKg : p.adultKg, mixture = recipe(g, p, 'growth');
    if (mixture && p.assimilation > 0 && c.health > .3 && c.structuralKg < reference * .8 - EPS) {
      // The population clock schedules the exact funded-target boundary.
      // Tapering toward the remaining gap would make unrelated rate refreshes
      // change the growth trajectory and could prevent completion indefinitely.
      const gain = reference / Math.max(1, p.adultDays);
      const requiresCare = c.dependency && at - c.bornAt < p.independentDays * DAY;
      const storeReserveKg = requiresCare ? (c.needs.foodKg || 0) / n : p.foodKgDay * 2;
      const storeFunded = (requiresCare || c.foraging && ['meatKg', 'carrionKg'].includes(g.resources?.foodKg)) && c.stores.foodKg > storeReserveKg + EPS;
      if (!requiresCare || storeFunded) result.push({ kind: 'growth', g, c, recipe: storeFunded ? {} : mixture, perDay: gain / p.assimilation * n,
        ...(storeFunded ? { storeFunded: true, storeReserveKg } : {}) });
    }
    for (const brood of c.demography?.broods || []) {
      if (!site(s, g, at) || brood.regionId !== g.regionId) continue;
      const units = size(brood.parents), days = Math.max(.25, p.incubationDays);
      const matter = brood.requiredKg * units - brood.investedKg > EPS ? brood.requiredKg * units / days : 0;
      const mana = brood.requiredMana * units - brood.investedMana > EPS ? brood.requiredMana * units / days : 0;
      if (matter > EPS || mana > EPS) result.push({ kind: 'brood', g, c, brood,
        recipe: brood.materialRecipe, perDay: Math.max(0, matter), manaPerDay: Math.max(0, mana) });
    }
    if (result.length && (p.manaDay > 0 || p.otherDay > 0)) {
      const scale = n * (c.massKg / p.adultKg) ** .75 * (at - c.bornAt < p.adultDays * DAY ? p.juvenileMultiplier : 1);
      const additionalInputs = {};
      if (p.manaDay > 0) additionalInputs[g.resources?.mana || 'excessMana'] = p.manaDay * scale;
      if (p.otherDay > 0) additionalInputs[g.resources?.other || (g.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ')] = p.otherDay * scale;
      result.unshift({ kind: 'activity', g, c, recipe: {}, perDay: 0, additionalInputs });
    }
    return result;
  }
  function complete(s, g, c, at, hooks) {
    const d = c.demography; if (!d) return;
    const p = Data.lifecycle[c.speciesId];
    d.broods = d.broods.filter(b => {
      const units = size(b.parents);
      if (at + EPS < b.dueAt || b.investedKg + EPS < b.requiredKg * units || b.investedMana + EPS < b.requiredMana * units
        || !site(s, g, at) || g.regionId !== b.regionId) return true;
      const born = Math.max(0, size(b.successful) * p.offspring - (b.emitted?.length || 0));
      const females = Math.floor(born / 2 + Life.random(`${b.id}:sex`));
      const roles = c.role === 'queen' ? [['worker', born]] : b.fragment || /propagule/i.test(p.method) ? [['individual', born]]
        : [['female', females], ['male', born - females]];
      let offspringOffset = b.emitted?.length || 0;
      for (const [role, count] of roles) if (count) {
        hooks.birth(g, c, { ...b, offspringOffset }, role, count, at); offspringOffset += count;
      }
      const r = region(s, b.regionId); r.outputs ||= {};
      r.outputs.reproductiveWasteKg = (r.outputs.reproductiveWasteKg || 0)
        + Math.max(0, b.investedKg - (born + (b.emitted?.length || 0)) * p.newbornKg);
      return false;
    });
  }
  function stage(c, at) {
    const p = Data.lifecycle[c.speciesId], age = (at - (c.birthSpan?.[1] ?? c.bornAt)) / DAY;
    return [p.independentDays, p.adultDays, p.fertileDays, c.role === 'queen' ? p.breederAgeingDays : p.ageingDays]
      .map(bound => bound != null && age >= bound ? 1 : 0).join('');
  }
  function compact(g, at) {
    const bins = new Map(), retained = [];
    for (const c of g.cohorts) {
      if (!size(c.ranges)) { if (!c.generated && !c.contactSplit) retained.push(c); continue; }
      if (!c.generated || c.personalActor) { retained.push(c); continue; }
      const p = Data.lifecycle[c.speciesId], age = Math.max(DAY, at - c.bornAt);
      const base = Math.max(DAY, p.adultDays * DAY / 12);
      const width = base * 2 ** Math.max(0, Math.floor(Math.log2(age / (base * 12))));
      const key = [c.originId, c.role, stage(c, at), Math.floor(c.bornAt / width), width,
        Math.floor(c.health * 10), Math.floor(c.massKg / p.adultKg * 20),
        // Averaging effort must not give an unworked original a different
        // cohort's contributor provenance when it subsequently dies.
        Object.keys(c.ecologyHistory || {}).filter(k => c.ecologyHistory[k] > EPS).sort().join(','),
        JSON.stringify(c.feedingTowers || null), JSON.stringify(c.regional || null), JSON.stringify(c.regionalPosition || null),
        JSON.stringify(c.regionalFormation || null), JSON.stringify(c.windDrift || null), JSON.stringify(c.foraging || null), JSON.stringify(c.dependency || null),
        JSON.stringify(c.parentalLedger || null), JSON.stringify(c.caregiving || null), JSON.stringify(c.firstScarcity || null), c.contactBusyUntil || 0].join(':');
      const old = bins.get(key);
      if (!old) { bins.set(key, c); retained.push(c); continue; }
      const a = size(old.ranges), b = size(c.ranges), total = a + b;
      if (old.ecologyHistory || c.ecologyHistory) {
        const history = {};
        for (const k of new Set([...Object.keys(old.ecologyHistory || {}), ...Object.keys(c.ecologyHistory || {})]))
          history[k] = ((old.ecologyHistory?.[k] || 0) * a + (c.ecologyHistory?.[k] || 0) * b) / total;
        old.ecologyHistory = history;
      }
      old.birthSpan ||= [old.bornAt, old.bornAt];
      old.birthSpan = [Math.min(old.birthSpan[0], c.birthSpan?.[0] ?? c.bornAt), Math.max(old.birthSpan[1], c.birthSpan?.[1] ?? c.bornAt)];
      for (const k of ['bornAt', 'massKg', 'structuralKg', 'health']) old[k] = (old[k] * a + c[k] * b) / total;
      for (const k of Object.keys(old.stores)) old.stores[k] = (old.stores[k] * a + c.stores[k] * b) / total;
      old.ranges = union([...old.ranges, ...c.ranges]); old.deathExposure += c.deathExposure;
      old.mortalityBalance = ((old.mortalityBalance || 0) * a + (c.mortalityBalance || 0) * b) / total;
      old.demography ||= { credit: 0, serial: 0, cooldowns: [], broods: [] };
      old.demography.credit += c.demography?.credit || 0;
      old.demography.serial = Math.max(old.demography.serial, c.demography?.serial || 0);
      old.demography.broods.push(...(c.demography?.broods || []));
      const cooldowns = new Map();
      for (const cd of [...old.demography.cooldowns, ...(c.demography?.cooldowns || [])])
        cooldowns.set(cd.until, union([...(cooldowns.get(cd.until) || []), ...cd.ranges]));
      old.demography.cooldowns = [...cooldowns].map(([until, ranges]) => ({ until, ranges }));
      old.aggregateMortality = true; old.batchHazard = 0; old.batchMembers = total;
    }
    g.cohorts = retained;
  }
  function handoff(c, ordinal, at) {
    const d = c.demography; if (!d) return null;
    const result = { opportunities: d.credit / Math.max(1, size(c.ranges)), lastAttemptAt: null, broods: [] };
    d.credit -= result.opportunities;
    for (const cooldown of d.cooldowns) if (contains(cooldown.ranges, ordinal)) {
      result.lastAttemptAt = cooldown.until - Data.lifecycle[c.speciesId].cooldownDays * DAY;
      cooldown.ranges = subtract(cooldown.ranges, [[ordinal, ordinal + 1]]);
    }
    for (const b of d.broods) if (contains(b.parents, ordinal)) {
      const n = size(b.parents);
      result.broods.push({ id: b.localId || `${b.id}:parent:${ordinal}`, startedAt: b.startedAt, dueAt: b.dueAt,
        parentIds: b.localId ? copy(b.parentIds) : [`${c.originId}:${ordinal}`, ...(b.mateOriginId ? [b.mateOriginId] : [])],
        investedKg: b.investedKg / n, requiredKg: b.requiredKg, investedMana: b.investedMana / n, requiredMana: b.requiredMana,
        fragment: b.fragment, materialRecipe: copy(b.materialRecipe), success: contains(b.successful, ordinal), emitted: copy(b.emitted || []), ready: false,
        externalNursery: external(Data.lifecycle[c.speciesId]), sourceRegionId: b.regionId, sourceNurseryId: b.nurseryId });
      b.investedKg *= (n - 1) / n; b.investedMana *= (n - 1) / n;
      b.parents = subtract(b.parents, [[ordinal, ordinal + 1]]); b.successful = subtract(b.successful, [[ordinal, ordinal + 1]]);
    }
    d.broods = d.broods.filter(b => b.parents.length); return result;
  }
  function valid(c) {
    const nonnegative = n => Number.isFinite(n) && n >= 0;
    const rangesValid = ranges => Array.isArray(ranges) && ranges.every(([lo, hi], i) => Number.isSafeInteger(lo)
      && Number.isSafeInteger(hi) && lo >= 0 && hi > lo && (!i || lo >= ranges[i - 1][1]));
    if (c.aggregateMortality && !['mortalityBalance', 'batchHazard', 'batchMembers'].every(k => nonnegative(c[k]))) return false;
    if (c.birthSpan && (!c.birthSpan.every(Number.isFinite) || c.birthSpan.length !== 2 || c.birthSpan[0] > c.bornAt || c.birthSpan[1] < c.bornAt)) return false;
    const d = c.demography; if (!d) return true;
    if (!nonnegative(d.credit) || !Number.isSafeInteger(d.serial) || d.serial < 0 || !Array.isArray(d.cooldowns) || !Array.isArray(d.broods)) return false;
    for (const cd of d.cooldowns) if (!nonnegative(cd.until) || !rangesValid(cd.ranges)
      || size(intersect(cd.ranges, c.ranges)) !== size(cd.ranges)) return false;
    const seen = new Set();
    for (const b of d.broods) {
      if (typeof b.id !== 'string' || seen.has(b.id) || !rangesValid(b.parents) || !b.parents.length || !rangesValid(b.successful)
        || size(intersect(b.parents, c.ranges)) !== size(b.parents) || size(intersect(b.parents, b.successful)) !== size(b.successful)
        || !['startedAt', 'dueAt', 'investedKg', 'investedMana', 'requiredKg', 'requiredMana'].every(k => nonnegative(b[k]))
        || b.dueAt < b.startedAt || b.investedKg > b.requiredKg * size(b.parents) + 1e-6
        || b.investedMana > b.requiredMana * size(b.parents) + 1e-6 || !b.fragment && !recipeValid(b.materialRecipe)) return false;
      if (b.emitted && (!Array.isArray(b.emitted) || size(b.parents) !== 1 || !b.localId
        || b.emitted.length > Data.lifecycle[c.speciesId].offspring || new Set(b.emitted).size !== b.emitted.length
        || b.emitted.some(id => typeof id !== 'string' || !id.startsWith(`${b.localId}:`)))) return false;
      seen.add(b.id);
    }
    return true;
  }
  return { DAY, region, group, cohort, prepare, refreshGroups, size, contains, subtract, intersect, take, union, recipeValid, recipe, site, mature, eligible,
    init, freeRanges, synchronize, start, requests, complete, compact, handoff, valid };
});
