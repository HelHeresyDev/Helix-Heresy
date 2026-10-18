(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixExpansionAtlas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = 'Retained knowledge, not live telemetry. Public listings are not detailed maps. Routes, surface indicators, permissions, ownership and enforceable control are separate. Unknown ground, reserves, threats and rights remain unknown.';
  const text = x => typeof x === 'string' ? x.slice(0, 1200) : '';
  const date = x => Number.isFinite(x) && x >= 0 ? x : null;
  const cell = x => x && ['x', 'y', 'z'].every(k => Number.isInteger(x[k])) ? { x: x.x, y: x.y, z: x.z } : null;
  const kinds = ['city', 'survey', 'wilderness', 'adjoining', 'remote', 'home'];
  const categories = ['listing', 'terrain', 'route', 'resources', 'rights', 'operations'];
  function fact(x) {
    if (!text(x?.id) || !text(x.sourceId) || !text(x.source) || !text(x.text) || !categories.includes(x.category)
      || date(x.indexedAt) == null || x.category !== 'listing' && date(x.receivedAt) == null) return null;
    return { id: text(x.id), category: x.category, subject: text(x.subject), sourceId: text(x.sourceId), source: text(x.source),
      sourceAt: date(x.sourceAt), receivedAt: date(x.receivedAt), lastReceivedAt: date(x.lastReceivedAt ?? x.receivedAt),
      indexedAt: date(x.indexedAt), coverage: text(x.coverage), text: text(x.text), cell: cell(x.cell) };
  }
  function normalize(value) {
    if (!text(value?.worldId) || !text(value?.runId)) return null;
    const s = { worldId: text(value.worldId), runId: text(value.runId), entries: [], objective: null };
    for (const x of Array.isArray(value.entries) ? value.entries : []) {
      if (!text(x?.id) || !kinds.includes(x.kind) || s.entries.some(e => e.id === x.id)) continue;
      const facts = (Array.isArray(x.facts) ? x.facts : []).map(fact).filter(Boolean);
      if (!facts.length) continue;
      s.entries.push({ id: text(x.id), label: text(x.label), cityId: text(x.cityId), globeCellId: text(x.globeCellId), kind: x.kind, facts });
    }
    const o = value.objective;
    if (o && s.entries.some(e => e.id === o.siteId) && ['investigate', 'revisit'].includes(o.purpose) && date(o.at) != null)
      s.objective = { siteId: text(o.siteId), purpose: o.purpose, at: o.at };
    return s;
  }
  function merge(value, binding, records, at, alive = true) {
    const old = normalize(value);
    if (!alive || date(at) == null || !text(binding?.worldId) || !text(binding?.runId)
      || old && (old.worldId !== binding.worldId || old.runId !== binding.runId)) return old;
    const s = old || { worldId: binding.worldId, runId: binding.runId, entries: [], objective: null };
    for (const record of records || []) {
      const p = record?.site, f = fact({ ...record?.fact, indexedAt: at });
      if (!text(p?.id) || !kinds.includes(p.kind) || !f || [f.sourceAt, f.receivedAt, f.lastReceivedAt].some(d => d != null && d > at)) continue;
      let entry = s.entries.find(e => e.id === p.id);
      if (!entry) { entry = { id: text(p.id), label: text(p.label), cityId: text(p.cityId), globeCellId: text(p.globeCellId), kind: p.kind, facts: [] }; s.entries.push(entry); }
      entry.cityId ||= text(p.cityId); entry.globeCellId ||= text(p.globeCellId); entry.label ||= text(p.label);
      // Reindexing does not re-date documents. Repeated received operational
      // accounts can confirm the same fact later without copying it per frame.
      const same = entry.facts.find(x => x.id === f.id && x.sourceId === f.sourceId && x.category === f.category
        && x.text === f.text && x.coverage === f.coverage && JSON.stringify(x.cell) === JSON.stringify(f.cell));
      if (same) {
        if (f.lastReceivedAt != null && (same.lastReceivedAt == null || f.lastReceivedAt > same.lastReceivedAt)) same.lastReceivedAt = f.lastReceivedAt;
      } else entry.facts.push(f);
    }
    return normalize(s);
  }
  function select(value, siteId, purpose, at, capable = true) {
    const s = normalize(value);
    if (!s || !capable || date(at) == null) return s;
    if (siteId === null) { s.objective = null; return s; }
    if (s.entries.some(e => e.id === siteId) && ['investigate', 'revisit'].includes(purpose)) s.objective = { siteId, purpose, at };
    return s;
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && text(to?.worldId) && text(to?.runId)
      ? normalize({ ...s, worldId: to.worldId, runId: to.runId }) : s;
  }
  return { LIMITS, normalize, merge, select, rebind };
});
