(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./city-rule') : root.HelixCityRule);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDurableSupremacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rule) {
  'use strict';
  const INTERVAL = 3 * 86400;
  const id = s => typeof s === 'string' && s.length > 0 && s.length <= 1000;
  const time = n => Number.isFinite(n) && n >= 0;
  const copy = x => JSON.parse(JSON.stringify(x));
  const kinds = ['city', 'beast', 'divine', 'counterpower'];
  const phases = ['unverified', 'failed', 'holding', 'qualified'];
  const SCOPE = 'Three continuous days of actual enforceable supremacy, not signatures, occupied hexes or wealth. Received evidence is dated, never a live worldwide timer or hidden-enemy count. Technical service, trade and withdrawal agreements are not sovereignty. No accomplishment or ending is awarded here.';
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  function target(v) {
    return v && id(v.id) && id(v.sourceId) && kinds.includes(v.kind) && time(v.createdAt)
      ? { id: v.id, sourceId: v.sourceId, kind: v.kind, createdAt: v.createdAt } : null;
  }
  function baseline(map) {
    const cities = map?.strategicPlayableSettlementState?.cityRows;
    const human = map?.humanGeography?.cities, polities = map?.cityPolities?.polities;
    const beasts = map?.beastEcology?.populations;
    const gods = map?.strategicDivineHistory?.currentGodRows;
    const godIds = Array.isArray(gods) ? gods.map(g => g.id) : map?.strategicDivinity?.godOrder;
    const networks = map?.strategicNonStateNetworkHistory?.networkRows;
    const targets = [], add = (kind, key, sourceId) => {
      const t = target({ id: `${kind}:${key}`, kind, sourceId, createdAt: 0 });
      if (t && !targets.some(x => x.id === t.id)) targets.push(t);
    };
    // Include every original city identity, even a ruined/displaced claimant.
    // Forts/satellites are NOT additional sovereign targets.
    for (const c of Array.isArray(human) ? human : []) add('city', c.id, cities?.find(r => r.cityId === c.id)?.assetId || c.id);
    for (const c of Array.isArray(cities) ? cities : []) add('city', c.cityId, c.assetId || c.cityId);
    for (const p of Array.isArray(polities) ? polities : []) add('city', p.cityId, cities?.find(r => r.cityId === p.cityId)?.assetId || p.cityId);
    for (const p of Array.isArray(beasts) ? beasts : []) add('beast', p.id, p.id);
    for (const g of Array.isArray(godIds) ? godIds : []) add('divine', g, g);
    // Coverage candidates, not a demand that every guild submit politically.
    for (const n of Array.isArray(networks) ? networks : []) add('counterpower', n.networkId, n.networkId);
    const cityIds = targets.filter(t => t.kind === 'city');
    const complete = cityIds.length > 0 && Array.isArray(cities) && Array.isArray(human) && Array.isArray(polities)
      && cityIds.every(t => cities.some(c => `city:${c.cityId}` === t.id) && human.some(c => `city:${c.id}` === t.id)
        && polities.some(p => `city:${p.cityId}` === t.id)) && Array.isArray(beasts) && Array.isArray(godIds) && Array.isArray(networks);
    return { complete, targets };
  }
  function create(b, base, at = 0) {
    if (!id(b?.worldId) || !id(b.runId) || !time(at)) return null;
    const s = { worldId: b.worldId, runId: b.runId, complete: false, targets: [], conflict: false,
      lastAt: at, since: null, qualifiedAt: null, phase: 'unverified', reason: 'coverage', history: [], review: null };
    syncBaseline(s, base); return s;
  }
  function syncBaseline(s, base) {
    if (!s || !base || !Array.isArray(base.targets)) return false;
    let changed = s.complete !== (base.complete === true); s.complete = base.complete === true;
    // Multi-city updates revisit this immutable original roster each heartbeat.
    // Index it without skipping reconciliation: deleted identities must still
    // return, and conflicting sources must still prevent qualification.
    const originals = new Map(s.targets.map(t => [t.id, t]));
    for (const row of base.targets) {
      const t = target(row); if (!t) { s.conflict = true; continue; }
      const old = originals.get(t.id);
      if (!old) { s.targets.push(t); originals.set(t.id, t); changed = true; }
      else if (old.sourceId !== t.sourceId || old.kind !== t.kind) s.conflict = true;
    }
    return changed;
  }
  function normalize(v) {
    const s = create(v, { complete: v?.complete === true, targets: v?.targets || [] }, time(v?.lastAt) ? v.lastAt : 0);
    if (!s) return null;
    s.conflict ||= v.conflict === true;
    s.phase = phases.includes(v.phase) ? v.phase : 'unverified'; s.reason = id(v.reason) ? v.reason : 'coverage';
    s.since = time(v.since) && v.since <= s.lastAt && ['holding', 'qualified'].includes(s.phase) ? v.since : null;
    s.qualifiedAt = s.phase === 'qualified' && s.since != null && s.lastAt >= s.since + INTERVAL ? s.since + INTERVAL : null;
    if ((['holding', 'qualified'].includes(s.phase) && s.since == null) || (s.phase === 'qualified' && s.qualifiedAt == null)
      || s.conflict || !s.complete || !s.targets.some(t => t.kind === 'city')) {
      s.phase = 'unverified'; s.reason = 'coverage'; s.since = null; s.qualifiedAt = null;
    }
    s.history = (Array.isArray(v.history) ? v.history : []).filter(e => time(e?.at) && e.at <= s.lastAt && phases.includes(e.phase) && id(e.reason))
      .map(e => ({ at: e.at, phase: e.phase, reason: e.reason })).slice(-200);
    s.review = normalizeReview(v.review); return s;
  }
  // Only existing current city operation can emit this fact. Historical local
  // accomplishments, signatures and technical compacts are deliberately absent.
  function cityAccount(b, s, succession, people, c, at) {
    if (!s?.source) return null;
    const f = { ...b, targetId: `city:${s.source.cityId}`, sourceId: s.source.populationSourceId,
      kind: 'city', at, since: s.since, state: 'unverified', proofId: s.id, basis: 'directGovernment', viable: false };
    if (!bound(s, b) || s.lastAt !== at || !c?.alive || !c.sourceCurrent) return f;
    const reason = Rule.condition(s, succession, people, c);
    if (reason === 'unverified') return f;
    f.state = reason ? 'notQualifying' : 'qualifying';
    f.since = time(s.since) ? s.since : at;
    f.viable = s.source.population > 0 && s.foodKg > 0 && s.waterLiters > 0 && s.energy > 0 && !reason;
    return f;
  }
  function factState(t, f, b, at) {
    if (!f || !bound(f, b) || f.targetId !== t.id || f.sourceId !== t.sourceId || f.kind !== t.kind
      || f.at !== at || !id(f.proofId) || !time(f.since) || f.since > at) return 'unverified';
    if (f.state === 'unverified') return 'unverified';
    if (f.state === 'retired') return f.lifecycle?.sourceId === t.sourceId && id(f.lifecycle.causeId)
      && time(f.lifecycle.at) && f.lifecycle.at <= at && f.lifecycle.survivingClaimants === 0
      && (t.kind === 'city' ? f.lifecycle.kind === 'physicalDestruction' && f.lifecycle.population === 0
        : t.kind === 'counterpower' ? f.lifecycle.kind === 'organizationDissolution'
          : f.lifecycle.kind === 'confirmedDeath' && (t.kind !== 'beast' || f.lifecycle.population === 0)) ? 'retired' : 'unverified';
    if (t.kind === 'city') {
      if (!['directGovernment', 'enforceableClient', 'voluntarySubmission'].includes(f.basis)) return 'unverified';
      if (f.state === 'notQualifying') return 'failed';
      return f.state === 'qualifying' && f.viable === true ? 'qualifying' : 'unverified';
    }
    // A tactical pack, authored danger rating, avatar loss or worship loss is
    // NOT a strategic capability/resolution proof. Future owner consumers must
    // substantiate these fields; this module cannot manufacture such a proof.
    const p = f.strategic;
    if (p?.scope !== 'terrestrialRule' || !id(p.consumerId) || p.sourceId !== t.sourceId || p.at !== at
      || typeof p.canOverturn !== 'boolean' || typeof p.willing !== 'boolean' || typeof p.responseSupported !== 'boolean') return 'unverified';
    if (p.canOverturn && p.willing && !p.responseSupported) return 'failed';
    return f.state === 'qualifying' && ['effectiveSuppression', 'engineeredContainment', 'enforceableSubmission',
      'strategicIncapacity', 'supportedNonintervention'].includes(f.basis) ? 'qualifying' : 'unverified';
  }
  function advance(s, b, frame, at, alive = true) {
    if (!alive || !bound(s, b) || !time(at) || at < s.lastAt || !frame) return false;
    // New identities require a real dated owner-consumer birth/founding source.
    for (const row of frame.additions || []) if (id(row.causeId) && bound(row, b) && time(row.createdAt) && row.createdAt <= at)
      syncBaseline(s, { complete: s.complete, targets: [row] });
    const byId = new Map(), duplicates = new Set();
    for (const f of frame.facts || []) { if (byId.has(f.targetId)) duplicates.add(f.targetId); byId.set(f.targetId, f); }
    let reason = !s.complete || s.conflict || !s.targets.length || frame.complete !== true ? 'coverage' : '';
    if ([...byId.keys()].some(key => !s.targets.some(t => t.id === key)) || duplicates.size) reason = 'identity';
    const states = s.targets.map(t => ({ t, f: byId.get(t.id), state: factState(t, byId.get(t.id), b, at) }));
    if (reason !== 'identity' && states.some(x => x.state === 'failed')) reason = 'controlOrCounterpower';
    if (!reason && states.some(x => x.state === 'unverified')) reason = 'coverage';
    if (!reason && !states.some(x => x.t.kind === 'city' && x.state === 'qualifying' && x.f.viable)) reason = 'noLivingPolity';
    const oldPhase = s.phase, oldReason = s.reason;
    if (reason) {
      s.phase = ['controlOrCounterpower', 'noLivingPolity'].includes(reason) ? 'failed' : 'unverified';
      s.reason = reason; s.since = null; s.qualifiedAt = null;
    } else {
      const gaps = states.filter(x => x.state === 'qualifying' && x.t.createdAt <= s.lastAt && x.f.since > s.lastAt);
      if (s.since == null) s.since = at; // No retrospective worldwide proof from a late snapshot.
      else if (gaps.length) s.since = Math.max(...gaps.map(x => x.f.since));
      s.phase = at - s.since >= INTERVAL ? 'qualified' : 'holding'; s.reason = 'supported';
      s.qualifiedAt = s.phase === 'qualified' ? s.since + INTERVAL : null;
    }
    s.lastAt = at;
    if (s.phase !== oldPhase || s.reason !== oldReason) s.history.push({ at, phase: s.phase, reason: s.reason });
    s.history = s.history.slice(-200);
    return s.phase !== oldPhase || s.reason !== oldReason;
  }
  function normalizeEvidence(v) {
    return v && ['id', 'sourceId', 'label'].every(k => id(v[k])) && ['control', 'influence', 'unverified', 'challenge'].includes(v.status)
      && time(v.observedAt) && time(v.receivedAt) && v.observedAt <= v.receivedAt
      ? { id: v.id, sourceId: v.sourceId, label: v.label, status: v.status, observedAt: v.observedAt, receivedAt: v.receivedAt } : null;
  }
  function normalizeReview(v) {
    if (!time(v?.at) || !Array.isArray(v.evidence)) return null;
    const evidence = v.evidence.map(normalizeEvidence).filter(e => e && e.receivedAt <= v.at);
    return { at: v.at, evidence, apparent: evidence.some(e => e.status === 'control') && !evidence.some(e => ['challenge', 'unverified'].includes(e.status)) };
  }
  function review(s, b, evidence, at, alive = true, capable = true) {
    if (!alive || !capable || !bound(s, b) || !time(at) || s.review?.at > at) return false;
    // This path must NEVER inspect the roster, private phase or holding clock.
    const seen = new Set();
    s.review = normalizeReview({ at, evidence: (evidence || []).map(normalizeEvidence)
      .filter(e => e && e.receivedAt <= at && !seen.has(e.id) && seen.add(e.id)) }); return true;
  }
  function publicView(s) {
    const r = normalizeReview(s?.review);
    return { scope: SCOPE, review: r, label: !r ? 'Not reviewed' : r.apparent ? 'Apparent supremacy in received evidence — worldwide verification incomplete'
      : 'Received evidence does not establish supremacy',
      limits: 'This review neither refreshes source observations nor certifies worldwide coverage. Unsupported sovereignty, strategic beast resolution and divine nonintervention remain unverified.' };
  }
  function rebind(v, from, to) {
    const s = normalize(v); if (!bound(s, from) || !id(to?.worldId) || !id(to.runId)) return null;
    s.worldId = to.worldId; s.runId = to.runId; return s;
  }
  return { INTERVAL, SCOPE, bound, baseline, create, normalize, syncBaseline, cityAccount, factState, advance, review, publicView, rebind };
});
