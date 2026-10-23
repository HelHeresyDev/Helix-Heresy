(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRegionalChange = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const text = x => typeof x === 'string' && x.length > 0 && x.length <= 1000;
  const time = x => Number.isFinite(x) && x >= 0;
  const copy = x => JSON.parse(JSON.stringify(x));
  const eventIndexes = new WeakMap();
  const KINDS = ['beastDeparture', 'beastArrival', 'beastWithdrawal', 'beastSheltered', 'pressure',
    'routeCondition', 'installation', 'cityRule', 'authority', 'divinePresence', 'founding'];
  const SCOPE = 'Dated received regional observations only. Silence is not safety; an old account is not current control. No hidden population, enemy total, automatic map access or replacement opposition is disclosed.';
  function create(b) {
    return text(b?.worldId) && text(b.runId) ? { worldId: b.worldId, runId: b.runId, events: [], heads: [], reports: [], serial: 0 } : null;
  }
  const bound = (s, b) => s && b && s.worldId === b.worldId && s.runId === b.runId;
  function event(v) {
    return v && ['id', 'sourceId', 'siteId', 'causeId', 'to'].every(k => text(v[k])) && time(v.at)
      && KINDS.includes(v.kind) && (v.from === null || text(v.from)) && Array.isArray(v.actorIds) && v.actorIds.every(text)
      ? { id: v.id, sourceId: v.sourceId, siteId: v.siteId, causeId: v.causeId, at: v.at,
        kind: v.kind, from: v.from, to: v.to, actorIds: [...new Set(v.actorIds)].sort() } : null;
  }
  function report(v) {
    return v && ['id', 'sourceId', 'siteId', 'text'].every(k => text(v[k])) && time(v.observedAt) && time(v.receivedAt)
      && v.observedAt <= v.receivedAt && v.kind === 'localPressure' && Array.isArray(v.observations)
      && v.observations.every(o => text(o?.id) && text(o.condition) && typeof o.capable === 'boolean')
      ? { id: v.id, sourceId: v.sourceId, siteId: v.siteId, kind: v.kind, text: v.text,
        observedAt: v.observedAt, receivedAt: v.receivedAt,
        observations: v.observations.map(o => ({ id: o.id, condition: o.condition, capable: o.capable })) } : null;
  }
  function normalize(v) {
    const s = create(v); if (!s) return null;
    const eventIds = new Set();
    for (const row of Array.isArray(v.events) ? v.events : []) {
      const e = event(row); if (e && !eventIds.has(e.id)) { s.events.push(e); eventIds.add(e.id); }
    }
    s.events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    for (const h of Array.isArray(v.heads) ? v.heads : []) if (text(h?.sourceId) && text(h.state) && time(h.at)
      && KINDS.includes(h.kind) && !s.heads.some(x => x.sourceId === h.sourceId && x.kind === h.kind))
      s.heads.push({ sourceId: h.sourceId, kind: h.kind, state: h.state, at: h.at });
    for (const row of Array.isArray(v.reports) ? v.reports : []) {
      const r = report(row); if (r && !s.reports.some(x => x.id === r.id)) s.reports.push(r);
    }
    s.serial = Number.isSafeInteger(v.serial) && v.serial >= 0 ? v.serial : 0;
    for (const e of s.events) {
      const match = /^regional-change:(\d+)$/.exec(e.id), n = match && Number(match[1]);
      if (Number.isSafeInteger(n)) s.serial = Math.max(s.serial, n);
    }
    return s;
  }
  // This journal records facts from authoritative consumers. It NEVER applies
  // casualties, damage, appointments, movement or a political result itself.
  function record(s, b, row, at, alive = true) {
    const e = event(row);
    if (!alive || !bound(s, b) || !time(at) || !e || e.at > at) return false;
    let index = eventIndexes.get(s);
    if (!index || index.rows !== s.events || index.size !== s.events.length) {
      index = { rows: s.events, size: s.events.length, ids: new Set(s.events.map(e => e.id)) }; eventIndexes.set(s, index);
    }
    if (index.ids.has(e.id)) return false;
    s.events.push(e); index.ids.add(e.id); index.size++;
    s.events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)); return true;
  }
  function capture(s, b, fact, at, alive = true) {
    if (!alive || !bound(s, b) || !time(at) || !KINDS.includes(fact?.kind)
      || !['sourceId', 'siteId', 'causeId', 'state'].every(k => text(fact[k]))) return false;
    const h = s.heads.find(h => h.sourceId === fact.sourceId && h.kind === fact.kind);
    if (h && at < h.at) return false;
    if (h && h.state === fact.state) { h.at = at; return false; }
    const e = { id: `regional-change:${++s.serial}`, sourceId: fact.sourceId, kind: fact.kind, siteId: fact.siteId,
      causeId: fact.causeId, from: h?.state || null, to: fact.state, actorIds: fact.actorIds || [], at };
    if (!record(s, b, e, at, alive)) { s.serial--; return false; }
    if (h) { h.state = fact.state; h.at = at; }
    else s.heads.push({ sourceId: fact.sourceId, kind: fact.kind, state: fact.state, at });
    return true;
  }
  // Caller must have completed the real local inspection. In particular, this
  // does not copy unseen event history, habitat paths or private assessments.
  function receivePressure(s, b, sourceId, receipt, alive = true) {
    if (!alive || !bound(s, b) || !text(sourceId) || !receipt?.observations?.length) return false;
    const previous = s.reports.filter(r => r.sourceId === sourceId && r.observedAt < receipt.observedAt)
      .sort((a, b) => b.observedAt - a.observedAt)[0];
    const renewed = previous && previous.observations.every(o => !o.capable) && receipt.observations.some(o => o.capable);
    const r = report({ id: `${sourceId}:${receipt.siteId}:${receipt.observedAt}:${receipt.at}`, sourceId,
      siteId: receipt.siteId, kind: 'localPressure', observedAt: receipt.observedAt, receivedAt: receipt.at,
      observations: receipt.observations,
      text: renewed ? 'Capable pressure personally encountered after an earlier locally broken contact. This does not establish where it came from, healing, replacement or a regional census.'
        : 'Original hunting contacts personally inspected. This is a dated local observation, not proof of regional safety or current remote conditions.' });
    if (!r || s.reports.some(x => x.id === r.id) || s.reports.some(x => x.sourceId === sourceId && x.observedAt > r.observedAt)) return false;
    s.reports.push(r); return true;
  }
  function collect(s, b, inputs, at, alive = true) {
    if (!alive || !bound(s, b) || !time(at) || !inputs) return false;
    let changed = false;
    const captureFact = fact => { changed = capture(s, b, fact, at, alive) || changed; };
    const local = v => v && (!v.worldId && !v.runId || bound(v, b));
    // These adapters consume existing original outcomes, not speculative
    // settlement destruction, new gods or automatic political succession.
    for (const w of local(inputs.corridorWorks) ? inputs.corridorWorks.sites || [] : []) if (local(w) && w.startedAt != null) captureFact({
      kind: 'routeCondition', sourceId: w.id, siteId: w.source.canonicalCorridorId,
      causeId: w.source.causeId, state: `${w.condition}:${w.lastProjection?.continuity || 'unverified'}` });
    for (const i of local(inputs.conditions) ? inputs.conditions.installations || [] : []) if (local(i)) for (const e of i.events || []) changed = record(s, b, {
      id: `${i.installationId}:${e.id}`, sourceId: i.installationId, siteId: i.cityId,
      causeId: e.sourceId, kind: 'installation', from: null, to: e.status, at: e.at, actorIds: [] }, at, alive) || changed;
    const rule = inputs.cityRule;
    if (local(rule)) captureFact({ kind: 'cityRule', sourceId: rule.id, siteId: rule.source.cityId,
      causeId: rule.handoverId, state: rule.status });
    const succession = inputs.succession;
    if (local(succession) && succession.handover && succession.source?.cityId) captureFact({ kind: 'authority', sourceId: `${succession.source.cityId}:sovereign-authority`,
      siteId: succession.source.cityId, causeId: succession.handover.id,
      state: `${succession.control?.recognizedAuthorityId || 'unverified'}:${succession.handover.id}` });
    for (const a of local(inputs.divineIntervention) ? inputs.divineIntervention.avatars || [] : []) captureFact({ kind: 'divinePresence', sourceId: a.id,
      siteId: inputs.divineIntervention.cityId, causeId: inputs.divineIntervention.id,
      state: `${a.status}:${a.manifested === true ? 'manifested' : 'not-manifested'}` });
    const works = inputs.foundingWorks;
    if (local(works)) captureFact({ kind: 'founding', sourceId: works.id, siteId: works.site?.siteId || works.id,
      causeId: works.id, state: works.phase });
    return changed;
  }
  function publicView(s) { return { reports: copy(normalize(s)?.reports || []), scope: SCOPE }; }
  function rebind(v, from, to) {
    const s = normalize(v); if (!bound(s, from) || !create(to)) return null;
    s.worldId = to.worldId; s.runId = to.runId; return s;
  }
  return { KINDS, SCOPE, create, normalize, bound, record, capture, collect, receivePressure, publicView, rebind };
});
