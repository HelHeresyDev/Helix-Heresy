(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology);
  if (node) module.exports = api;
  if (root) root.HelixBeastDiplomacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Wild, World, Ecology) {
  'use strict';
  const SPECIES = 'beast:mirror-ape', DURATION = 4 * 86400, OFFER = 600;
  const WORK = { greet: 60, check: 120, discuss: 60, accept: 60 };
  const TERMS = 'For four days this named individual will not attack the scientist or identified municipal delivery traffic for the named city on this measured approach. The scientist will not attack this individual or enter the disclosed quiet-ground cells. Actual witnessed aggression or encroachment ends this compact. Only this individual consents: no troop command, taming, divine agreement, city sovereignty, general travel right or control of independent people follows.';
  const LIMITS = 'One original individual and one named approach only. A peaceful encounter is not a population census, regional safety, strategic resolution or world domination. Uncontacted individuals, unsupported vertical routes, spell imitation and independent means remain unverified.';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const id = x => typeof x === 'string' && x.length > 0;
  const time = x => Number.isFinite(x) && x >= 0;
  const bound = (a, b) => a && b && a.worldId === b.worldId && a.runId === b.runId;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cell = p => p && ['x', 'y', 'z'].every(k => Number.isInteger(p[k]));
  const hash = x => World.stableHash(x);
  function sources(map, route, cityId, geometry, walkingRouteId = `intercity-march:${route?.id}`) {
    const raw = map?.routeGraph?.routes?.find(r => r.id === (route?.corridorId || route?.id));
    const species = map?.beastEcology?.species?.find(s => s.id === SPECIES);
    if (!raw?.endpointIds?.includes(cityId) || !raw.cellPath?.length || !(route.distanceKm > 0)
      || !geometry || species?.intelligenceBand !== 'sapient' || !species.movementModes.includes('walking')) return [];
    const path = raw.endpointIds[0] === cityId ? raw.cellPath : [...raw.cellPath].reverse(), km = [0];
    for (let i = 1; i < path.length; i++) km.push(km.at(-1) + geometry.distance(path[i - 1], path[i]));
    if (!(km.at(-1) > 0)) return [];
    const cities = new Set((map.humanGeography?.cities || []).map(c => c.cellId));
    return (map.beastEcology.populations || []).flatMap(p => {
      if (p.speciesId !== SPECIES || !(p.populationIndex > 0) || !Number.isSafeInteger(p.devotionalUnitCount) || p.devotionalUnitCount < 1) return [];
      const index = path.findIndex((c, i) => i > 0 && i < path.length - 1 && geometry.land(c) && !cities.has(c)
        && Ecology.maskIncludes(p.territory?.rangeMask, World.cellIndex(c)));
      if (index < 0) return [];
      return [{ id: `mirror-contact:${p.id}`, populationId: p.id, speciesId: SPECIES, originalCount: p.devotionalUnitCount,
        cityId, cityName: map.humanGeography?.cities.find(c => c.id === cityId)?.name || cityId,
        corridorId: route.id, canonicalCorridorId: raw.id, routeId: walkingRouteId,
        distanceKm: route.distanceKm, positionKm: km[index] / km.at(-1) * route.distanceKm, sourceCellId: path[index] }];
    });
  }
  function validSource(s) {
    return s?.speciesId === SPECIES && ['id', 'populationId', 'cityId', 'cityName', 'corridorId', 'canonicalCorridorId', 'routeId', 'sourceCellId'].every(k => id(s[k]))
      && Number.isSafeInteger(s.originalCount) && s.originalCount > 0 && Number.isFinite(s.distanceKm)
      && Number.isFinite(s.positionKm) && s.positionKm > 0 && s.positionKm < s.distanceKm;
  }
  const create = binding => ({ ...binding, troops: [], contacts: [], agreements: [], reports: [], incidents: [], job: null, serial: 0 });
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !id(s.worldId) || !id(s.runId) || !['troops', 'contacts', 'agreements', 'reports', 'incidents'].every(k => Array.isArray(s[k]))
      || !Number.isSafeInteger(s.serial) || s.serial < 0 || s.troops.some(t => !validSource(t?.source) || !Array.isArray(t.memberIds)
        || t.memberIds.length > t.source.originalCount || new Set(t.memberIds).size !== t.memberIds.length || !t.memberIds.every(id))
      || new Set(s.troops.map(t => t.source.populationId)).size !== s.troops.length
      || s.contacts.some(c => !id(c?.actorId) || !Array.isArray(c.checks) || !Array.isArray(c.history))
      || new Set(s.contacts.map(c => c.actorId)).size !== s.contacts.length
      || s.agreements.some(a => !id(a?.payload?.actorId) || !id(a.payload.id) || !time(a.payload.at) || !time(a.payload.expiresAt)
        || a.payload.duration !== DURATION || a.payload.expiresAt !== a.payload.at + DURATION || a.payload.terms !== TERMS
        || !a.payload.boundary?.cells?.length || !a.payload.boundary.cells.every(cell))
      || s.reports.some(r => !id(r?.actorId) || !time(r.at))
      || s.job && (!WORK[s.job.kind] || !time(s.job.progress) || s.job.progress > WORK[s.job.kind]
        || !time(s.job.lastAt) || !id(s.job.actorId)
        || s.job.kind === 'check' && (s.job.markers?.length !== 2 || !s.job.markers.every(cell) || !s.job.noGo?.every(cell))))
      return { worldId: s.worldId, runId: s.runId, invalid: true };
    return copy(s);
  }
  function register(s, source, region, actors, seed, at) {
    if (!s || s.invalid || !validSource(source) || !bound(s, region) || !time(at)) return null;
    const old = s.troops.find(t => t.source.populationId === source.populationId);
    if (old) return same(old.source, source) ? old : null;
    if (region.managedPopulationIds.includes(source.populationId)) return null;
    const claimed = region.members.filter(m => m.populationId === source.populationId);
    if (claimed.length > source.originalCount || claimed.some(m => m.speciesId !== SPECIES || !actors.some(a => a.id === m.actorId))) return null;
    const ids = claimed.map(m => m.actorId), count = Math.min(2, source.originalCount);
    for (let i = ids.length; i < count; i++) {
      const actorId = `mirror-ape:${hash(`${seed}:${source.populationId}:${i}:identity`)}`;
      if (region.members.some(m => m.actorId === actorId)) return null;
      const a = { ...Wild.actor(SPECIES, actorId, { x: 0, y: 0, z: -9999 }, source.populationId, at),
        name: `Mirror Ape ${hash(actorId).slice(0, 4)}`, roomId: '', mapCell: null, homeCell: null, routeId: source.routeId,
        positionKm: source.positionKm, homePositionKm: source.positionKm, offsetM: i % 2 ? -4 : 4,
        regionalPhase: 'reserve', effortSeconds: 120, regionalAt: at, regionalSiteId: '',
        dialoguePolicy: parseInt(hash(`${seed}:${actorId}:consent`), 16) % 2 ? 'consider' : 'decline', contactWorkSeconds: 900 };
      region.members.push({ actorId, populationId: source.populationId, speciesId: SPECIES, source: source.id });
      region.beasts.actors.push(a); ids.push(actorId);
    }
    region.managedPopulationIds.push(source.populationId); region.beasts.materialized = true;
    const troop = { source: copy(source), memberIds: ids, createdAt: at }; s.troops.push(troop); return troop;
  }
  const troop = (s, a) => !s?.invalid && s?.troops.find(t => a?.actorKind === 'wildernessBeast' && !a.genome
    && a.speciesId === SPECIES && t.source.populationId === a.populationId && t.memberIds.includes(a.id));
  const contact = (s, a) => s?.contacts.find(c => c.actorId === a?.id);
  const able = a => a?.status === 'alive' && a.health >= a.maxHealth * .75;
  const present = c => c?.alive && c.capable && c.visible && c.near && c.sourceCurrent && c.gesture !== false;
  const ready = (a, c, at) => able(a) && present(c) && c.free && c.groundInteraction !== false && at >= (a.provokedUntil || 0);
  const seal = (s, p) => hash([s.troops.find(t => t.memberIds.includes(p.actorId))?.source, p]);
  function latest(s, actorId, bodyEpoch) {
    return !s?.invalid && s?.agreements.findLast(a => a.payload.actorId === actorId && a.payload.bodyEpoch === bodyEpoch && a.seal === seal(s, a.payload));
  }
  function active(s, a, c, at) {
    const p = latest(s, a?.id, c.bodyEpoch);
    return p && !p.breachedAt && p.payload.at <= at && at < p.payload.expiresAt ? p : null;
  }
  function covered(s, a, c, targetId, at) {
    const p = active(s, a, c, at)?.payload;
    return Boolean(p && c.routeId === p.routeId && (targetId === 'scientist'
      || c.cityId === p.cityId && (c.trafficIds || []).includes(targetId)));
  }
  function hear(s, a, c, at) {
    if (!troop(s, a) || !present(c) || a.status !== 'alive' || a.health < a.maxHealth * .3 || c.participantCapable === false) return false;
    const entry = contact(s, a), agreement = latest(s, a.id, c.bodyEpoch);
    const report = { actorId: a.id, name: a.name, at, understanding: entry?.understood === true,
      message: entry?.message || 'No shared meaning has been demonstrated.',
      agreement: agreement ? { id: agreement.payload.id, at: agreement.payload.at, expiresAt: agreement.payload.expiresAt,
        cityName: agreement.payload.cityName, routeId: agreement.payload.routeId, boundary: copy(agreement.payload.boundary), terms: TERMS,
        state: agreement.breachedAt ? 'receivedBrokenCompact' : at >= agreement.payload.expiresAt ? 'receivedExpiredCompact' : 'receivedConditionalCompact' } : null };
    s.reports.push(report); return true;
  }
  function begin(s, a, kind, c, at, expected = null) {
    const t = troop(s, a); if (!t || s.job || !WORK[kind] || !ready(a, c, at)) return false;
    if (!['consider', 'decline'].includes(a.dialoguePolicy) || !Number.isFinite(a.contactWorkSeconds)) return false;
    let entry = contact(s, a);
    if (!entry) { entry = { actorId: a.id, checks: [], history: [], demonstrated: false, understood: false, message: '' }; s.contacts.push(entry); }
    if (a.dialoguePolicy !== 'consider' || entry.brokenPromise || at < (entry.restUntil || 0)) {
      entry.message = entry.brokenPromise ? 'The individual remembers the broken promise and declines new terms.' : 'The individual declines this interaction. No consent or troop authority follows.';
      hear(s, a, c, at); return false;
    }
    if (kind === 'check' && (!entry.demonstrated || !c.markers?.every(cell) || c.markers.length !== 2 || same(c.markers[0], c.markers[1])
      || !c.noGo?.length || !c.noGo.every(cell) || c.markers.some(p => c.noGo.some(n => same(n, p))))) return false;
    if (kind === 'discuss' && (!entry.understood || active(s, a, c, at)?.payload.expiresAt - at > 86400
      || !c.boundary?.cells?.length || !c.boundary.cells.every(cell) || c.boundary.siteId !== c.siteId)) return false;
    if (kind === 'accept' && (!entry.proposal || !same(expected, entry.proposal) || at >= expected.offerExpiresAt
      || expected.bodyEpoch !== c.bodyEpoch || expected.routeId !== c.routeId || expected.terms !== TERMS
      || !entry.understood || expected.actorId !== a.id || expected.cityId !== t.source.cityId || !same(expected.boundary, c.boundary)
      || expected.duration !== DURATION || entry.proposal.startedAt != null)) return false;
    if (!Number.isFinite(a.contactWorkSeconds) || a.contactWorkSeconds < WORK[kind]) return false;
    a.contactWorkSeconds -= WORK[kind];
    const job = { id: `beast-dialogue:${++s.serial}`, actorId: a.id, kind, at, lastAt: at, progress: 0, wasReady: true,
      bodyEpoch: c.bodyEpoch, siteId: c.siteId, routeId: c.routeId, cityId: t.source.cityId, cityName: t.source.cityName,
      boundary: copy(c.boundary), markers: copy(c.markers), noGo: copy(c.noGo), detourObserved: false,
      stage: 'first', haltAt: null, proposal: copy(expected), proposalSeal: expected ? seal(s, expected) : null };
    if (kind === 'accept') entry.proposal.startedAt = at;
    s.job = job; return true;
  }
  function intent(s, a, c, at) {
    const j = s?.job;
    if (!j || j.actorId !== a.id || !ready(a, c, at) || a.dialoguePolicy !== 'consider' || contact(s, a)?.brokenPromise
      || j.bodyEpoch !== c.bodyEpoch || j.siteId !== c.siteId) return null;
    return { behavior: 'dialogue', goal: j.kind === 'check' ? j.stage === 'redirect' || j.stage === 'done' ? j.markers[1] : j.markers[0] : a.mapCell };
  }
  function forbidden(s, a, p) {
    const j = s?.job;
    return Boolean(j?.actorId === a.id && j.kind === 'check' && ['redirect', 'done'].includes(j.stage) && j.noGo.some(n => same(n, p)));
  }
  function advance(s, actors, context, at, alive = true) {
    if (!s || s.invalid || !alive) return false;
    for (const agreement of s.agreements) {
      const a = actors.find(a => a.id === agreement.payload.actorId), c = a && context(a);
      if (agreement.seal === seal(s, agreement.payload) && c?.actorWitness && c.bodyEpoch === agreement.payload.bodyEpoch && c.routeId === agreement.payload.routeId
        && c.scientistCell && agreement.payload.boundary.cells.some(p => same(p, c.scientistCell))
        && agreement.payload.at <= at && at < agreement.payload.expiresAt && !agreement.breachedAt)
        breach(s, agreement, at, 'Witnessed entry into the agreed quiet ground');
    }
    const j = s.job; if (!j || at <= j.lastAt) return false;
    const a = actors.find(a => a.id === j.actorId), c = a && context(a), dt = at - j.lastAt; j.lastAt = at;
    if (!a || a.status !== 'alive' || !c?.sourceCurrent || c.bodyEpoch !== j.bodyEpoch
      || a.dialoguePolicy !== 'consider' || contact(s, a)?.brokenPromise) { s.job = null; return true; }
    if (j.kind === 'accept' && (j.proposalSeal !== seal(s, j.proposal) || !same(j.boundary, j.proposal.boundary))) { s.job = null; return true; }
    const attending = ready(a, c, at) && c.siteId === j.siteId;
    if (attending && j.wasReady) {
      j.progress += Math.min(dt, WORK[j.kind] - j.progress);
      if (j.kind === 'check') {
        if (j.stage === 'first' && same(a.mapCell, j.markers[0])) { j.stage = 'halt'; j.haltAt = at; }
        else if (j.stage === 'halt') {
          if (!same(a.mapCell, j.markers[0])) { j.stage = 'first'; j.haltAt = null; }
          else if (at - j.haltAt >= 10) j.stage = 'redirect';
        } else if (j.stage === 'redirect') {
          if (j.noGo.some(p => same(p, a.mapCell))) { j.stage = 'failed'; }
          else {
            if (a.mapCell.y !== j.markers[0].y) j.detourObserved = true;
            if (j.detourObserved && same(a.mapCell, j.markers[1])) j.stage = 'done';
          }
        }
      }
    } else j.haltAt = j.stage === 'halt' ? at : j.haltAt;
    j.wasReady = attending;
    if (!attending || j.progress < WORK[j.kind] || j.kind === 'check' && j.stage !== 'done') return false;
    const entry = contact(s, a);
    if (j.kind === 'greet') { entry.demonstrated = true; entry.message = 'Stop/continue gestures demonstrated. Imitation alone is not demonstrated understanding.'; }
    if (j.kind === 'check') {
      entry.checks.push({ at, markers: copy(j.markers), noGo: copy(j.noGo), detourObserved: true, haltSeconds: 10, bodyEpoch: c.bodyEpoch }); entry.understood = true;
      entry.message = 'Observed unguided approach, a continuous stop, and a real detour around marked forbidden ground to a different marker. Shared stop/continue and boundary-reference signals demonstrated; no fluency or troop authority is inferred.';
    }
    if (j.kind === 'discuss') {
      entry.proposal = { id: `${j.id}:compact`, actorId: a.id, bodyEpoch: c.bodyEpoch, at, offerExpiresAt: at + OFFER,
        routeId: j.routeId, cityId: j.cityId, cityName: j.cityName, boundary: j.boundary, duration: DURATION, terms: TERMS };
      entry.message = 'Exact conditional territorial terms offered by this individual only; no agreement has yet been made.';
    }
    if (j.kind === 'accept') {
      const payload = { ...j.proposal, at, expiresAt: at + DURATION };
      s.agreements.push({ payload, seal: seal(s, payload), breachedAt: null });
      entry.message = 'The named individual accepted these exact conditional terms. Other individuals and gods are not bound.';
    }
    entry.history.push({ kind: j.kind, at }); s.job = null; hear(s, a, c, at); return true;
  }
  function breach(s, agreement, at, reason) {
    agreement.breachedAt = at; agreement.reason = reason;
    const entry = s.contacts.find(c => c.actorId === agreement.payload.actorId);
    if (entry) { entry.brokenPromise = true; entry.message = reason + '; no new consent or forgiveness is inferred.'; }
  }
  function aggression(s, actor, event, c, at) {
    if (!troop(s, actor) || !c.alive || !c.actorWitness) return false;
    const agreement = active(s, actor, c, at); if (!agreement) return false;
    if (!(event.actorId === 'scientist' && event.targetId === actor.id
      || event.actorId === actor.id && covered(s, actor, c, event.targetId, at))) return false;
    if (!s.incidents.some(e => e.id === event.id)) s.incidents.push({ ...copy(event), at, participantId: actor.id });
    for (const current of s.agreements) if (current.payload.actorId === actor.id && current.payload.bodyEpoch === c.bodyEpoch
      && current.payload.at <= at && at < current.payload.expiresAt && !current.breachedAt && current.seal === seal(s, current.payload))
      breach(s, current, at, 'Witnessed renewed aggression by a party to this compact');
    return true;
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...to } : null; }
  const publicView = s => copy(s && !s.invalid ? s.reports : []);
  function evidence(s) { return publicView(s).map(r => ({ id: `beast-contact:${r.actorId}:${r.at}`, sourceId: r.actorId,
    seriesId: `beast-contact:${r.actorId}`, label: 'Personally received individual beast-contact account', status: 'unverified',
    observedAt: r.at, receivedAt: r.at, account: { issuer: r.name, scope: 'Named individual’s conditional territorial compact',
      findings: [r.message, ...(r.agreement ? [r.agreement.state, r.agreement.terms, `Disclosed deadline: ${r.agreement.expiresAt}.`] : [])], limits: LIMITS } })); }
  return { SPECIES, DURATION, WORK, TERMS, LIMITS, bound, sources, validSource, create, normalize, register, troop, contact,
    present, ready, active, covered, hear, begin, intent, forbidden, advance, aggression, rebind, publicView, evidence };
});
