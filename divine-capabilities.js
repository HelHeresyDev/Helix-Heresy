(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-faiths') : root.HelixStrategicFaiths);
  if (node) module.exports = api;
  if (root) root.HelixDivineCapabilities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (World, Faiths) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const id = s => typeof s === 'string' && s.length > 0;
  const hash = x => World.stableHash(x);
  const validGod = g => id(g?.id) && ['living', 'dead'].includes(g.lifecycle?.lifeState)
    && ['divine', 'descended', 'none'].includes(g.lifecycle.divinityState) && id(g.divineCore?.repeatableSignature)
    && g.divineCore.identityBound === true && Number.isFinite(g.power?.reserve) && g.power.reserve >= 0
    && Number.isFinite(g.power.reserveCapacity) && g.power.reserveCapacity >= g.power.reserve;
  function sources(map) {
    const h = map?.strategicDivineHistory, gods = h?.currentGodRows || [], ids = [...new Set([...(map?.strategicDivinity?.godOrder || []), ...gods.map(g => g.id)])];
    const faiths = map?.publicFaithDirectory?.faiths || (map?.strategicFaiths ? Faiths.publicFaithDirectory(map)?.faiths : []) || [];
    return { complete: Array.isArray(h?.currentGodRows) && Array.isArray(h?.eventRows) && gods.length === ids.length
      && new Set(gods.map(g => g.id)).size === gods.length && gods.every(validGod), rows: ids.map(godId => {
      const god = gods.find(g => g.id === godId), faith = faiths.find(f => f.godId === godId);
      const death = (h?.eventRows || []).find(e => ['divineDeath', 'mortalGodKilling'].includes(e.kind)
        && e.participantIds?.includes(godId) && e.stateDelta?.victimLifeState === 'dead'
        && e.stateDelta?.remainsId && h.remainsRows?.some(r => r.id === e.stateDelta.remainsId && r.formerGodId === godId && r.identityPreserved));
      return { godId, god: copy(god), faith: copy(faith), death: death ? { causeId: death.id, historicalYear: death.year } : null };
    }) };
  }
  function create(base, binding, at, original = false) {
    if (!base || !Array.isArray(base.rows) || !id(binding?.worldId) || !id(binding.runId) || !Number.isFinite(at)) return null;
    return { ...binding, allocatedAt: at, lastAt: at, mode: original ? 'original' : 'legacyUnknown', complete: base.complete === true,
      originals: copy(base.rows), records: base.rows.map(r => ({ godId: r.godId, god: original && validGod(r.god) ? copy(r.god) : null,
        lost: !original || !validGod(r.god), linked: false })), continuity: [], reports: [], incidents: [], job: null, agreements: [], proposals: [], serial: 0, conflict: false };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !id(s.worldId) || !id(s.runId) || !Array.isArray(s.originals) || !Array.isArray(s.records)
      || !Array.isArray(s.continuity) || !Array.isArray(s.reports) || !Array.isArray(s.agreements) || !Array.isArray(s.proposals)
      || !Number.isFinite(s.lastAt) || !Number.isFinite(s.allocatedAt)
      || !Number.isSafeInteger(s.serial) || s.serial < 0
      || s.originals.some(r => !id(r?.godId)) || s.records.some(r => !id(r?.godId))
      || s.agreements.some(a => !a?.payload || !id(a.payload.id) || !id(a.payload.godId) || !Number.isFinite(a.payload.at) || !Number.isFinite(a.payload.expiresAt))
      || s.proposals.some(p => !id(p?.id) || !Number.isFinite(p.at) || !Number.isFinite(p.offerExpiresAt))
      || s.continuity.some(r => !id(r?.godId) || !Number.isFinite(r.since))
      || s.job && (!s.job.proposal || !id(s.job.id) || !Number.isFinite(s.job.progress) || !Number.isFinite(s.job.lastAt))
      || new Set(s.originals.map(r => r.godId)).size !== s.originals.length || new Set(s.records.map(r => r.godId)).size !== s.records.length)
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    const next = copy(s); next.incidents ||= [];
    if (!Array.isArray(next.incidents) || next.incidents.some(e => !id(e?.id) || !Number.isFinite(e.at))) return { worldId: s.worldId, runId: s.runId, invalid: true };
    for (const original of next.originals) {
      let r = next.records.find(r => r.godId === original.godId);
      if (!r) next.records.push(r = { godId: original.godId, god: null, lost: true, linked: false });
      if (!validGod(r.god) || r.god.id !== original.godId || r.god.divineCore.repeatableSignature !== original.god?.divineCore?.repeatableSignature) r.lost = true;
    }
    if (next.records.some(r => !next.originals.some(o => o.godId === r.godId))) next.conflict = true;
    return next;
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...to } : null; }
  const unknownGod = godId => ({ id: godId, lifecycle: { lifeState: 'unknown', divinityState: 'unknown' },
    divineCore: { receivingCapacity: 0 }, power: { reserve: 0, reserveCapacity: 0 }, expenditures: {} });
  // Only a pre-existing legacy contact's saved mutable account can migrate.
  // This never allocates a missing reserve from the immutable world snapshot.
  function preserveContact(s, religion) {
    const god = religion?.god, r = s?.records?.find(r => r.godId === god?.id), o = s?.originals?.find(o => o.godId === god?.id);
    if (s?.mode !== 'legacyUnknown' || religion?.godRef || !r || !r.lost || !validGod(god)
      || o?.god?.divineCore?.repeatableSignature !== god.divineCore.repeatableSignature
      || god.power.reserve > o.god.power.reserve || god.power.reserveCapacity !== o.god.power.reserveCapacity) return false;
    r.god = copy(god); r.lost = false; religion.godRef = { worldId: s.worldId, runId: s.runId, godId: god.id };
    return link(s, religion);
  }
  function link(s, religion) {
    if (!religion) return false;
    const ref = religion.godRef, godId = ref?.godId || religion.source?.god?.id;
    const r = s && !s.invalid && s.records.find(r => r.godId === godId), original = s?.originals?.find(o => o.godId === godId);
    if (!r || r.lost || !validGod(r.god) || !original || original.god?.divineCore?.repeatableSignature !== religion.source?.god?.divineCore?.repeatableSignature
      || ref && !bound(ref, s)) {
      // An existing reference must NEVER fall back to the fresh world reserve.
      if (ref || s || !religion.god) Object.defineProperty(religion, 'god', { configurable: true, enumerable: false, value: unknownGod(godId) });
      return false;
    }
    if (!ref && r.linked) {
      r.lost = true; Object.defineProperty(religion, 'god', { configurable: true, enumerable: false, value: unknownGod(godId) }); return false;
    }
    if (!ref && religion.god && hash(religion.god) !== hash(religion.source.god)) {
      // A previously active unlinked contact is not evidence of a second pot.
      // Preserve its actual spending once; never select a healthier copy.
      if (r.god.power.reserve !== original.god.power.reserve || religion.god.power.reserve > r.god.power.reserve) {
        r.lost = true; Object.defineProperty(religion, 'god', { configurable: true, enumerable: false, value: unknownGod(godId) }); return false;
      }
      r.god = copy(religion.god);
    }
    r.linked = true; religion.godRef = { worldId: s.worldId, runId: s.runId, godId };
    Object.defineProperty(religion, 'god', { configurable: true, enumerable: false, get: () => r.lost ? unknownGod(godId) : r.god });
    return true;
  }
  function seal(s, godId, payload) {
    const o = s?.originals?.find(o => o.godId === godId);
    return o?.god?.divineCore?.repeatableSignature ? hash(`${o.god.divineCore.repeatableSignature}:${hash(payload)}`) : null;
  }
  function currentAgreement(s, godId, bodyEpoch, at) {
    return (s?.agreements || []).findLast(a => a.payload.godId === godId && a.payload.bodyEpoch === bodyEpoch
      && a.payload.scope === 'ownTerrestrialIntervention' && a.payload.at <= at && at < a.payload.expiresAt
      && !a.breachedAt && a.seal === seal(s, godId, a.payload));
  }
  function assessment(s, run, at, context = {}) {
    if (!s || s.invalid || !context.alive || run.divineCapabilities !== s || run.clock !== at || at < s.lastAt) return [];
    const facts = [];
    for (const o of s.originals) {
      const r = s.records.find(r => r.godId === o.godId), god = r?.god;
      const f = { worldId: s.worldId, runId: s.runId, targetId: `divine:${o.godId}`, sourceId: o.godId, kind: 'divine', at,
        since: at, proofId: `divine-owner:${o.godId}`, state: 'unverified', basis: 'supportedNonintervention', strategic: {
          scope: 'terrestrialRule', consumerId: 'divineCapabilities', sourceId: o.godId, at, canOverturn: false, willing: false, responseSupported: false } };
      const i = run.divineIntervention?.godId === o.godId && bound(run.divineIntervention, s) ? run.divineIntervention : null;
      const active = i?.avatars?.some(a => a.status === 'alive' && a.manifested && at < a.expiresAt && a.hostile && a.health > 12
        && a.stamina >= 6 && !context.incapacitated?.(a) && !a.magicSuppressed && !a.suppressionActive);
      // This existing body has only local protective reach. A tactical fight
      // blocks a clean settlement but cannot manufacture planetary capability.
      if (s.complete && !s.conflict && r && !r.lost && validGod(god)) {
        if (s.mode === 'original' && god.lifecycle.lifeState === 'dead' && o.death && o.god.lifecycle.lifeState === 'dead'
          && !active && !god.survivingClaimants?.length && !god.independentCommands?.length) {
          f.state = 'retired'; f.lifecycle = { sourceId: o.godId, causeId: o.death.causeId, at: s.allocatedAt, kind: 'confirmedDeath', survivingClaimants: 0 };
        } else {
          const a = currentAgreement(s, o.godId, context.bodyEpoch, at);
          // All personal means are covered by the actual individual's current
          // commitment. Explicit independently delegated means still need their
          // own supported consumer; worshippers are NOT assumed to be troops.
          if (a && !active && god.lifecycle.lifeState === 'living' && !god.independentCommands?.length && !god.survivingClaimants?.length
            && !god.unresolvedCommitments?.length && !(i?.job || i?.authorizations?.some(a => !a.manifested && at < a.payload.expiresAt))) {
            f.state = 'qualifying'; f.strategic.canOverturn = true; f.strategic.willing = false;
          }
        }
      }
      const previous = s.continuity.find(r => r.godId === o.godId), agreement = currentAgreement(s, o.godId, context.bodyEpoch, at);
      // Renewal with overlapping valid terms preserves restraint continuity;
      // a gap or a breach, including one crossed during catch-up, does not.
      const intervals = s.agreements.filter(a => a.payload.godId === o.godId && a.payload.bodyEpoch === context.bodyEpoch
        && a.seal === seal(s, o.godId, a.payload)).map(a => ({ start: a.payload.at, end: Math.min(a.payload.expiresAt, a.breachedAt ?? Infinity) }))
        .sort((a, b) => a.start - b.start);
      let restraintSince = at, end = -Infinity;
      for (const a of intervals) { if (a.start > at) break; if (a.start > end) restraintSince = a.start; end = Math.max(end, a.end); }
      const key = `${f.state}:${god?.lifecycle?.divinityState || 'unknown'}`;
      const latestEvent = Math.max(s.allocatedAt, ...(i?.avatars || []).flatMap(a => [a.endedAt || 0, a.truce?.at || 0]),
        ...s.agreements.filter(a => a.payload.godId === o.godId).flatMap(a => [a.payload.at, a.breachedAt || 0]));
      f.since = previous?.key === key && Number.isFinite(previous.since) && previous.since <= s.lastAt
        ? Math.max(previous.since, latestEvent > s.lastAt ? latestEvent : previous.since) : at;
      if (f.state === 'qualifying') f.since = Math.max(previous?.key === key ? previous.since : s.allocatedAt, restraintSince,
        ...(previous?.key === key ? [] : (i?.avatars || []).flatMap(a => [a.endedAt || 0, a.truce?.at || 0])));
      facts.push({ fact: f, key });
    }
    return facts;
  }
  function advance(s, run, at, context) {
    const results = assessment(s, run, at, context); if (!results.length) return [];
    s.continuity = results.map(r => ({ godId: r.fact.sourceId, key: r.key, since: r.fact.since })); s.lastAt = at;
    return results.map(r => r.fact);
  }
  return { bound, validGod, sources, create, normalize, rebind, link, preserveContact, seal, currentAgreement, assessment, advance };
});
