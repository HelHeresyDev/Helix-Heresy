(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRunStrategicConditions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const id = v => typeof v === 'string' ? v.slice(0, 300) : '';
  const date = v => Number.isFinite(v) && v >= 0;
  const statuses = ['maintained', 'maintenanceOffline'];
  const sameSite = (a, b) => a && b && ['worldId', 'runId', 'cityId', 'officeId', 'installationId', 'maintenanceId'].every(k => a[k] === b[k]);
  const binding = s => s && ['worldId', 'runId', 'cityId', 'officeId', 'installationId', 'maintenanceId'].every(k => id(s[k]))
    ? Object.fromEntries(['worldId', 'runId', 'cityId', 'officeId', 'installationId', 'maintenanceId'].map(k => [k, id(s[k])])) : null;
  const cycle = r => r && id(r.id) && date(r.at) && date(r.dueAt) && date(r.graceUntil) && r.at <= r.dueAt && r.dueAt < r.graceUntil
    ? { id: id(r.id), at: r.at, dueAt: r.dueAt, graceUntil: r.graceUntil } : null;
  const event = r => r && id(r.id) && date(r.at) && id(r.sourceId) && statuses.includes(r.status)
    && ['baseline', 'expired', 'restored', 'renewed'].includes(r.kind)
    ? { id: id(r.id), at: r.at, sourceId: id(r.sourceId), kind: r.kind, status: r.status } : null;
  function events(xs, at) {
    const seen = new Set();
    return (Array.isArray(xs) ? xs : []).map(event).filter(r => r && r.at <= at && !seen.has(r.id) && seen.add(r.id))
      .sort((a, b) => a.at - b.at).slice(-200);
  }
  function normalize(value) {
    if (!id(value?.worldId) || !id(value?.runId)) return null;
    const base = { worldId: id(value.worldId), runId: id(value.runId), installations: [], reports: [] };
    for (const v of Array.isArray(value.installations) ? value.installations : []) {
      const b = binding(v), c = cycle(v.cycle);
      if (!b || !c || b.worldId !== base.worldId || b.runId !== base.runId || !date(v.lastAt) || c.at > v.lastAt || !statuses.includes(v.status)
        || base.installations.some(r => r.installationId === b.installationId)) continue;
      base.installations.push({ ...b, cycle: c, status: v.status, lastAt: v.lastAt, events: events(v.events, v.lastAt) });
    }
    for (const v of Array.isArray(value.reports) ? value.reports : []) {
      const b = binding(v);
      if (!b || !base.installations.some(r => sameSite(r, b)) || !date(v.at) || !statuses.includes(v.status)
        || base.reports.some(r => r.installationId === b.installationId)) continue;
      base.reports.push({ ...b, at: v.at, status: v.status, available: v.available === true,
        availability: typeof v.availability === 'string' ? v.availability.slice(0, 300) : 'Current service unverified', events: events(v.events, v.at) });
    }
    return base;
  }
  function matches(site, s) {
    return binding(site) && s?.id === site.maintenanceId && s.cityId === site.cityId && s.officeId === site.officeId && s.installation?.id === site.installationId;
  }
  function advance(value, site, s, at, alive = true) {
    const old = normalize(value);
    if (!alive || !date(at) || !matches(site, s) || old && (old.worldId !== site.worldId || old.runId !== site.runId)) return old;
    const next = old || { worldId: site.worldId, runId: site.runId, installations: [], reports: [] };
    let entry = next.installations.find(r => r.installationId === site.installationId);
    if (entry && (!sameSite(entry, site) || at < entry.lastAt)) return old;
    if (!entry) {
      const originalRepair = (s.receipts || []).find(r => r.installationId === site.installationId && r.dueAt === s.dueAt && r.graceUntil === s.graceUntil);
      const initial = cycle(originalRepair || { id: s.handoverId || s.authorizationId, at: Math.min(s.lastAt, s.dueAt), dueAt: s.dueAt, graceUntil: s.graceUntil });
      if (!initial || initial.at > at) return old;
      entry = { ...binding(site), cycle: initial, status: 'maintained', lastAt: initial.at,
        events: [{ id: `${initial.id}:baseline`, sourceId: initial.id, at: initial.at, kind: 'baseline', status: 'maintained' }] };
      next.installations.push(entry);
    }
    const append = (kind, sourceId, time, status) => {
      const row = { id: `${sourceId}:${kind}`, sourceId, at: time, kind, status };
      if (!entry.events.some(e => e.id === row.id)) entry.events.push(row);
      entry.status = status;
    };
    const expire = time => {
      if (entry.status === 'maintained' && entry.cycle.graceUntil <= time)
        append('expired', entry.cycle.id, entry.cycle.graceUntil, 'maintenanceOffline');
    };
    // These are original physical repair receipts, not UI claims. Replay work
    // before testing the new deadline so a large step cannot invent an outage
    // that a timely repair actually prevented.
    const repairs = (s.receipts || []).filter(r => r.installationId === site.installationId && r.quantity === 3 && r.workSeconds === 120)
      .map(cycle).filter(r => r && r.at <= at).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    for (const r of repairs) {
      if (r.at < entry.lastAt || r.at <= entry.cycle.at || r.id === entry.cycle.id) continue;
      expire(r.at);
      append(entry.status === 'maintenanceOffline' ? 'restored' : 'renewed', r.id, r.at, 'maintained');
      entry.cycle = r;
    }
    expire(at); entry.lastAt = at; entry.events = entry.events.slice(-200);
    return next;
  }
  function serviceReason(value, site) {
    if (!site) return ''; // Other offices retain their existing service rules.
    const s = normalize(value), entry = s?.installations.find(r => sameSite(r, site));
    if (!entry) return 'Original counter maintenance condition is not established for this run.';
    return entry.status === 'maintenanceOffline' ? 'Original counter service unavailable: maintenance grace expired. Actual supplied repair is required.' : '';
  }
  function observe(value, site, availability, at, permitted) {
    const s = normalize(value), entry = s?.installations.find(r => sameSite(r, site));
    if (!permitted || !entry || !date(at) || at < entry.lastAt || s.reports.some(r => sameSite(r, site) && r.at > at)) return s;
    const reason = serviceReason(s, site);
    const report = { ...binding(site), at, status: entry.status, available: !reason && availability === 'Counter service available',
      availability: reason || availability || 'Current service unverified', events: copy(entry.events) };
    s.reports = [...s.reports.filter(r => !sameSite(r, site)), report]; return normalize(s);
  }
  function publicView(value, site) {
    return normalize(value)?.reports.find(r => sameSite(r, site)) || null;
  }
  // A validated saved-run import may allocate a new library ID to avoid a
  // collision. It is continuation of the imported physical state, not a fresh
  // game; preserve its facts while binding only that copy to its new identity.
  function rebind(value, from, to) {
    const s = normalize(value);
    if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId || !id(to?.worldId) || !id(to?.runId)) return s;
    s.worldId = id(to.worldId); s.runId = id(to.runId);
    for (const r of [...s.installations, ...s.reports]) { r.worldId = s.worldId; r.runId = s.runId; }
    return normalize(s);
  }
  return { normalize, advance, serviceReason, observe, publicView, rebind };
});
