// Regional clocks and disposable work indexes. No biological policy or RNG.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixBeastPopulationScheduler = api;
})(globalThis, function () {
  'use strict';
  const EPS = 1e-8, DAY = 86400, caches = new WeakMap();
  class Heap {
    constructor() { this.items = []; }
    push(item) {
      const a = this.items; a.push(item); let i = a.length - 1;
      while (i) { const p = (i - 1) >> 1; if (Heap.before(a[p], item)) break; a[i] = a[p]; i = p; }
      a[i] = item;
    }
    static before(a, b) { return a.at < b.at || a.at === b.at && a.order <= b.order; }
    pop() {
      const a = this.items, first = a[0], last = a.pop(); if (!a.length) return first;
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let j = i * 2 + 1; if (j + 1 < a.length && Heap.before(a[j + 1], a[j])) j++;
        if (Heap.before(last, a[j])) break; a[i] = a[j]; i = j;
      }
      a[i] = last; return first;
    }
    peek(valid) { while (this.items.length && !valid(this.items[0])) this.pop(); return this.items[0]; }
  }
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
  function buildIndex(s, ops) {
    const c = { ops, regions: new Map(s.regions.map(r => [r.id, r])), groups: new Map(), groupOrder: new Map(),
      regionOrder: new Map(s.regions.map((r, i) => [r.id, i])), resident: new Map(), groupRegion: new Map(),
      refs: new Map(), owners: new Map(), water: new Map(), sites: new Map(), groupSites: new Map(),
      detailRegions: new Map(), detailsAt: new Map(), extras: new Map(), units: new Map(), byRegion: new Map(),
      events: new Heap(), applied: new Heap(), serial: 0, dailyUnits: 0, extraList: null };
    for (const r of s.regions) {
      for (const course of r.ecology?.watercourses || []) { add(c.water, r.id, course.downstreamRegionId); add(c.water, course.downstreamRegionId, r.id); }
      for (const site of r.ecology?.workSites || []) for (const id of site.participantGroupIds || []) { add(c.sites, r.id, id); add(c.groupSites, id, r.id); }
    }
    s.groups.forEach((g, i) => { c.groups.set(g.id, g); c.groupOrder.set(g.id, i); });
    caches.set(s, c);
    for (const g of s.groups) updateGroup(s, g, s.regionClocks?.[ops.location(g)]?.appliedAt ?? s.appliedAt);
    for (const id of Object.keys(s.details)) noteDetail(s, id);
    for (const q of s.extraRates || []) {
      const g = c.groups.get(q.groupId), regionId = ops.location(g);
      if (!c.extras.has(regionId)) c.extras.set(regionId, []); c.extras.get(regionId).push(q);
    }
    Object.defineProperty(s, 'extraRates', { configurable: true, enumerable: true,
      get() { return c.extraList ||= s.regions.flatMap(r => c.extras.get(r.id) || []); } });
    return c;
  }
  function updateGroup(s, g, at) {
    const c = caches.get(s), oldRegion = c.groupRegion.get(g.id), here = c.ops.location(g);
    if (oldRegion !== here) { c.resident.get(oldRegion)?.delete(g.id); add(c.resident, here, g.id); c.groupRegion.set(g.id, here); }
    for (const regionId of c.refs.get(g.id) || []) c.owners.get(regionId)?.delete(g.id);
    const refs = new Set(c.ops.references(g, at)); c.refs.set(g.id, refs);
    for (const regionId of refs) add(c.owners, regionId, g.id);
  }
  function noteDetail(s, id) {
    const c = caches.get(s); if (!c) return;
    for (const r of c.detailRegions.get(id) || []) c.detailsAt.get(r)?.delete(id);
    const d = s.details[id], refs = new Set(d ? [d.regionId] : []);
    for (const b of [...(d?.demography?.broods || []), ...(d?.actor?.life?.populationBroods || [])]) if (b.sourceRegionId) refs.add(b.sourceRegionId);
    c.detailRegions.set(id, refs); for (const r of refs) add(c.detailsAt, r, id);
  }
  function linked(c, regionId) {
    const result = new Set(c.water.get(regionId) || []);
    for (const gid of c.resident.get(regionId) || []) {
      for (const r of c.refs.get(gid) || []) result.add(r);
      for (const r of c.groupSites.get(gid) || []) result.add(r);
    }
    for (const gid of c.owners.get(regionId) || []) result.add(c.groupRegion.get(gid));
    for (const gid of c.sites.get(regionId) || []) result.add(c.groupRegion.get(gid));
    for (const did of c.detailsAt.get(regionId) || []) for (const r of c.detailRegions.get(did) || []) result.add(r);
    return result;
  }
  function closure(c, ids, includeOldUnits = false) {
    const result = new Set(), queue = [...ids];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]; if (result.has(id) || !c.regions.has(id)) continue;
      result.add(id); queue.push(...linked(c, id));
      if (includeOldUnits) queue.push(...(c.byRegion.get(id)?.ids || []));
    }
    return result;
  }
  function components(c, ids) {
    const unseen = new Set(ids), result = [];
    for (const id of ids) if (unseen.has(id)) {
      const part = closure(c, [id]); for (const r of part) unseen.delete(r); result.push(part);
    }
    return result;
  }
  function view(s, ids, at) {
    const c = caches.get(s), order = [...ids].sort((a, b) => c.regionOrder.get(a) - c.regionOrder.get(b)), gids = new Set(), dids = new Set();
    for (const r of order) {
      for (const g of c.resident.get(r) || []) gids.add(g);
      for (const d of c.detailsAt.get(r) || []) dids.add(d);
    }
    const v = Object.create(s);
    Object.assign(v, { accountRoot: s, regionIds: new Set(order), regions: order.map(id => c.regions.get(id)),
      groups: [...gids].sort((a, b) => c.groupOrder.get(a) - c.groupOrder.get(b)).map(id => c.groups.get(id)),
      details: Object.fromEntries([...dids].map(id => [id, s.details[id]])),
      appliedAt: at, nextDemographyAt: s.nextDemographyAt,
      rates: Object.fromEntries(order.map(id => [id, s.rates[id]])) });
    Object.defineProperty(v, 'extraRates', { value: order.flatMap(id => c.extras.get(id) || []), writable: true, configurable: true });
    return v;
  }
  function globalAt(s, c) {
    return Math.min(s.plans.at(-1).end, c.dailyUnits ? s.nextDemographyAt : Infinity, s.foodWeb?.nextAt ?? Infinity);
  }
  function refresh(s) {
    const c = caches.get(s);
    // Lazy invalidation must not retain one old heap entry per lifetime event.
    // This occasional compaction reads clock metadata only, never organisms.
    if (c.events.items.length > Math.max(64, c.units.size * 4)) {
      c.events = new Heap();
      for (const unit of c.units.values()) c.events.push({ at: unit.next, order: Math.min(...unit.ids.map(id => c.regionOrder.get(id))), unit });
    }
    if (c.applied.items.length > Math.max(64, c.regions.size * 4)) {
      c.applied = new Heap();
      for (const [id, stamp] of Object.entries(s.regionClocks)) c.applied.push({ at: stamp.appliedAt, order: c.regionOrder.get(id), id, stamp });
    }
    const event = c.events.peek(e => c.units.has(e.unit.id)), applied = c.applied.peek(e => s.regionClocks[e.id] === e.stamp);
    s.nextEventAt = Math.min(globalAt(s, c), event?.at ?? Infinity);
    s.appliedAt = applied?.at ?? s.clock;
  }
  function removeUnits(c, ids) {
    for (const id of ids) {
      const u = c.byRegion.get(id); if (!u || !c.units.has(u.id)) continue;
      c.units.delete(u.id); if (u.daily) c.dailyUnits--;
      for (const r of u.ids) c.byRegion.delete(r);
    }
  }
  function store(s, ids, v) {
    const c = caches.get(s), daily = Boolean(v.dailyNeeded), unit = { id: ++c.serial, ids: [...ids], at: v.appliedAt, next: v.nextEventAt, daily };
    c.units.set(unit.id, unit); if (daily) c.dailyUnits++;
    const extras = new Map(unit.ids.map(id => [id, []]));
    for (const q of v.extraRates || []) extras.get(c.ops.location(c.groups.get(q.groupId))).push(q);
    for (const id of unit.ids) {
      s.rates[id] = v.rates[id]; c.extras.set(id, extras.get(id)); c.byRegion.set(id, unit);
      const stamp = { appliedAt: unit.at, nextEventAt: unit.next, daily }; s.regionClocks[id] = stamp;
      c.applied.push({ at: unit.at, order: c.regionOrder.get(id), id, stamp });
    }
    c.extraList = null;
    c.events.push({ at: unit.next, order: Math.min(...unit.ids.map(id => c.regionOrder.get(id))), unit });
    c.ops.refreshGroups?.(s, v.groups);
    return unit;
  }
  function rebuildParts(s, ids, at) {
    const c = caches.get(s); removeUnits(c, ids);
    s.nextDemographyAt = Math.max(s.nextDemographyAt, (Math.floor((at + EPS) / DAY) + 1) * DAY);
    for (const part of components(c, ids)) {
      const v = view(s, part, at); c.ops.rebuild(v, at); store(s, part, v);
    }
    refresh(s);
  }
  function rebuildAll(s, at) {
    const c = caches.get(s);
    for (const g of s.groups) updateGroup(s, g, at);
    for (const id of Object.keys(s.details)) noteDetail(s, id);
    rebuildParts(s, new Set(s.regions.map(r => r.id)), at);
  }
  function initialize(s, ops) {
    buildIndex(s, ops); s.regionClocks = {};
    rebuildAll(s, s.appliedAt);
  }
  function restore(s, ops) {
    if (!s.regionClocks) s.regionClocks = Object.fromEntries(s.regions.map(r => [r.id,
      { appliedAt: s.appliedAt, nextEventAt: s.nextEventAt, daily: ops.dailyNeeded(s) }]));
    const c = buildIndex(s, ops);
    for (const ids of components(c, new Set(s.regions.map(r => r.id)))) {
      const first = s.regionClocks[ids.values().next().value], v = view(s, ids, first.appliedAt);
      if ([...ids].some(id => s.regionClocks[id].appliedAt !== first.appliedAt || s.regionClocks[id].nextEventAt !== first.nextEventAt
        || s.regionClocks[id].daily !== first.daily)) throw Error('Coupled region clocks disagree');
      v.nextEventAt = first.nextEventAt; v.dailyNeeded = first.daily;
      store(s, ids, v); // Restore recorded rates/times, never run biological rebuild.
    }
    refresh(s);
  }
  function integrateUnit(s, u, at) {
    if (at <= u.at) return;
    const c = caches.get(s), v = view(s, new Set(u.ids), u.at);
    c.ops.integrate(v, at); u.at = at;
    for (const id of u.ids) {
      const stamp = { ...s.regionClocks[id], appliedAt: at }; s.regionClocks[id] = stamp;
      c.applied.push({ at, order: c.regionOrder.get(id), id, stamp });
    }
  }
  function settle(s, ids, at) {
    const c = caches.get(s), affected = closure(c, ids, true), units = new Set([...affected].map(id => c.byRegion.get(id)));
    for (const u of units) if (u) integrateUnit(s, u, at);
    refresh(s); return affected;
  }
  function settleAll(s, at) {
    const c = caches.get(s); for (const u of c.units.values()) integrateUnit(s, u, at);
    refresh(s);
  }
  function invalidate(s, ids, at) {
    const c = caches.get(s), affected = settle(s, ids, at);
    for (const id of affected) for (const gid of c.resident.get(id) || []) updateGroup(s, c.groups.get(gid), at);
    rebuildParts(s, closure(c, affected, true), at);
  }
  function advance(s, at, settleRead) {
    const c = caches.get(s);
    while (s.nextEventAt <= at + EPS) {
      const event = c.events.peek(e => c.units.has(e.unit.id)), global = globalAt(s, c);
      if (global <= (event?.at ?? Infinity) + EPS) {
        settleAll(s, global); c.ops.boundary(s, global);
      } else {
        const time = event.at, seeds = new Set(event.unit.ids);
        const initial = view(s, seeds, event.unit.at);
        for (const g of initial.groups) for (const id of c.ops.movingDestinations(g, time)) seeds.add(id);
        const affected = settle(s, seeds, time), v = view(s, affected, time);
        c.ops.boundary(v, time);
        s.nextDemographyAt = Math.max(s.nextDemographyAt, v.nextDemographyAt);
        for (const g of v.groups) updateGroup(s, g, time);
        // Movement/care may split or merge prior work units. Each resulting
        // dependency component receives its own next-event calculation.
        const parts = components(c, affected);
        if (parts.length === 1 && parts[0].size === affected.size) {
          removeUnits(c, affected); store(s, affected, v); refresh(s);
        } else rebuildParts(s, closure(c, affected, true), time);
      }
    }
    if (settleRead) settleAll(s, at);
    s.clock = at; refresh(s);
  }
  function validate(s) {
    if (!s.regionClocks) return true; // A pre-clock account can retain its recorded global cache.
    const keys = Object.keys(s.regionClocks);
    if (keys.length !== s.regions.length || s.regions.some(r => !s.regionClocks[r.id])) return false;
    const valid = s.regions.every(r => {
      const x = s.regionClocks[r.id];
      return Number.isFinite(x.appliedAt) && x.appliedAt >= 0 && x.appliedAt <= s.clock + EPS
        && Number.isFinite(x.nextEventAt) && x.nextEventAt > s.clock - EPS && typeof x.daily === 'boolean';
    }) && Math.abs((keys.length ? Math.min(...keys.map(k => s.regionClocks[k].appliedAt)) : s.clock) - s.appliedAt) < EPS;
    const next = Math.min(s.plans.at(-1).end, keys.some(k => s.regionClocks[k].daily) ? s.nextDemographyAt : Infinity,
      s.foodWeb?.nextAt ?? Infinity, ...keys.map(k => s.regionClocks[k].nextEventAt));
    return valid && Math.abs(next - s.nextEventAt) < EPS;
  }
  const active = s => caches.has(s);
  const inspect = s => { const c = caches.get(s); return c ? { units: c.units.size, eventEntries: c.events.items.length, appliedEntries: c.applied.items.length } : null; };
  const detailsForRegion = (s, id) => [...(caches.get(s)?.detailsAt.get(id) || [])].map(key => s.details[key]);
  return { initialize, restore, active, advance, settle, settleAll, invalidate, rebuildAll, noteDetail, detailsForRegion, validate, inspect, Heap };
});
