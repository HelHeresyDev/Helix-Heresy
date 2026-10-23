(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./regional-encounters') : root.HelixRegionalEncounters,
    node ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology,
    node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./regional-change') : root.HelixRegionalChange);
  if (node) module.exports = api;
  if (root) root.HelixRegionalSuppression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Wild, Regional, Ecology, World, Changes) {
  'use strict';
  const SPECIES = 'beast:rimefang-pack', WINDOW = 6 * 3600, PACK = 5;
  const copy = x => JSON.parse(JSON.stringify(x));
  const valid = s => typeof s === 'string' && s.length > 0;
  const time = n => Number.isFinite(n) && n >= 0;
  const stamp = n => Math.round(n * 1e6) / 1e6; // Stable microsecond event identity across catch-up chunk sizes.
  const SCOPE = 'One source-backed Rimefang population and one measured land corridor. Existing contracts are unchanged. Wounded survivors and displaced hunting groups remain real. Local observations are not a hidden census, permanent safety, extermination or world-domination credit.';
  function hash(s) { let n = 2166136261; for (const ch of s) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return n >>> 0; }
  function sourceFromWorld(map, route, homeCityId, geometry) {
    const raw = map?.routeGraph?.routes?.find(r => r.id === (route?.corridorId || route?.id));
    if (!raw || raw.endpointIds?.length !== 2 || !raw.endpointIds.includes(homeCityId) || !(route.distanceKm > 0)
      || !raw.cellPath?.length || !geometry) return [];
    const cells = homeCityId === raw.endpointIds[0] ? raw.cellPath : [...raw.cellPath].reverse();
    const km = [0]; for (let i = 1; i < cells.length; i++) km.push(km[i - 1] + geometry.distance(cells[i - 1], cells[i]));
    if (!(km.at(-1) > 0)) return [];
    const cities = new Set((map.humanGeography?.cities || []).map(c => c.cellId));
    const sources = [];
    for (const p of map.beastEcology?.populations || []) {
      // These are the existing soul-bearing INDIVIDUAL units for this species,
      // not a conversion of abundance or the four representative encounter cap.
      if (p.speciesId !== SPECIES || !Number.isSafeInteger(p.devotionalUnitCount) || p.devotionalUnitCount <= 0) continue;
      const profiles = (map.beastEcology.waveProfiles || []).filter(w => w.populationId === p.id
        && w.threatenedCorridorIds?.includes(raw.id) && w.threatenedCityIds?.some(id => raw.endpointIds.includes(id))
        && ['dangerous', 'catastrophic'].includes(w.severityBand));
      if (!profiles.length) continue;
      const range = Array.from({ length: geometry.cellCount }, (_, i) => i).filter(i => Ecology.maskIncludes(p.territory.rangeMask, i))
        .map(World.cellId).filter(id => geometry.land(id) && !cities.has(id));
      if (!range.length) continue;
      const allowed = new Set([...range, ...profiles.flatMap(w => w.cellPath || []), ...cells].filter(id => geometry.land(id) && !cities.has(id)));
      const goals = cells.filter(id => allowed.has(id)); if (!goals.length) continue;
      // Multi-source shortest physical walking paths from the real corridor.
      const paths = new Map(goals.map(id => [id, { distance: 0, cells: [id], goal: id }])), pending = [...goals];
      while (pending.length) {
        pending.sort((a, b) => paths.get(a).distance - paths.get(b).distance || a.localeCompare(b));
        const here = pending.shift(), row = paths.get(here);
        for (const next of geometry.neighbors(here)) {
          if (!allowed.has(next)) continue;
          const length = geometry.distance(here, next); if (!(length > 0)) continue;
          const distance = row.distance + length, old = paths.get(next);
          if (old && old.distance <= distance) continue;
          paths.set(next, { distance, cells: [next, ...row.cells], goal: row.goal });
          if (!pending.includes(next)) pending.push(next);
        }
      }
      const homes = range.filter(id => paths.has(id)).sort().map(id => {
        const path = paths.get(id), index = cells.indexOf(path.goal);
        return { cellId: id, path: path.cells, distanceKm: path.distance,
          entryKm: Math.min(route.distanceKm - .005, Math.max(.005, km[index] / km.at(-1) * route.distanceKm)) };
      });
      // Unreachable habitat is not silently deleted to make an objective winnable.
      if (!homes.length || homes.length !== range.length || route.distanceKm <= .02) continue;
      sources.push({ id: `suppression:${p.id}`, populationId: p.id, speciesId: SPECIES, individualCount: p.devotionalUnitCount,
        profileIds: profiles.map(w => w.id), corridorId: route.id, canonicalCorridorId: raw.id,
        routeId: `intercity-march:${route.id}`, homeCityId, endpointCityIds: [...raw.endpointIds], distanceKm: route.distanceKm, homes });
    }
    return sources;
  }
  function validSource(s) {
    return s?.speciesId === SPECIES && ['id', 'populationId', 'corridorId', 'canonicalCorridorId', 'routeId', 'homeCityId'].every(k => valid(s[k]))
      && Number.isSafeInteger(s.individualCount) && s.individualCount > 0 && s.profileIds?.length > 0 && s.distanceKm > .02
      && s.homes?.length > 0 && s.homes.every(h => valid(h.cellId) && h.path?.length && time(h.distanceKm) && h.entryKm > 0 && h.entryKm < s.distanceKm);
  }
  function create(binding) { return { ...binding, populations: [], reports: [], lastAt: 0 }; }
  function normalize(value) {
    if (!valid(value?.worldId) || !valid(value.runId)) return null;
    const s = create({ worldId: value.worldId, runId: value.runId }); s.lastAt = time(value.lastAt) ? value.lastAt : 0;
    for (const p of Array.isArray(value.populations) ? value.populations : []) {
      if (!validSource(p?.source) || s.populations.some(row => row.source.populationId === p.source.populationId)
        || !Array.isArray(p.members) || p.members.length !== p.source.individualCount || new Set(p.members.map(m => m.id)).size !== p.members.length
        || !p.members.every(m => valid(m.id) && typeof m.native === 'boolean' && (!m.native || Number.isInteger(m.homeIndex) && p.source.homes[m.homeIndex]))
        || !time(p.createdAt)) continue;
      s.populations.push({ source: copy(p.source), members: copy(p.members), createdAt: p.createdAt,
        suppressedSince: time(p.suppressedSince) ? p.suppressedSince : null,
        displacements: Array.isArray(p.displacements) ? copy(p.displacements) : [],
        lastAssessment: p.lastAssessment && time(p.lastAssessment.at) && ['capable', 'suppressed', 'unverified'].includes(p.lastAssessment.status)
          ? { at: p.lastAssessment.at, status: p.lastAssessment.status } : null });
    }
    s.reports = (Array.isArray(value.reports) ? value.reports : []).filter(r => valid(r?.dossierId) && valid(r.routeId) && valid(r.siteId)
      && time(r.at) && Array.isArray(r.observations)).map(r => ({ dossierId: r.dossierId, routeId: r.routeId, siteId: r.siteId, at: r.at,
        observedAt: time(r.observedAt) && r.observedAt <= r.at ? r.observedAt : r.at,
        observations: r.observations.filter(o => valid(o?.id) && valid(o.condition) && typeof o.capable === 'boolean')
          .map(o => ({ id: o.id, condition: o.condition, capable: o.capable })), text: String(r.text || '') }));
    return s;
  }
  function register(s, source, regional, knownActors, seed, at) {
    if (!s || !validSource(source) || !regional || !time(at) || s.worldId !== regional.worldId || s.runId !== regional.runId) return null;
    const old = s.populations.find(p => p.source.populationId === source.populationId); if (old) return old;
    const claims = regional.members.filter(m => m.populationId === source.populationId), known = new Map(knownActors.map(a => [a.id, a]));
    if (claims.length > source.individualCount) return null;
    const members = claims.map(m => ({ id: m.actorId, native: false })), allocated = [];
    const p = { source: copy(source), members, createdAt: at, suppressedSince: null, displacements: [], lastAssessment: null };
    for (let ordinal = claims.length; ordinal < source.individualCount; ordinal++) {
      const group = Math.floor((ordinal - claims.length) / PACK), homeIndex = hash(`${seed}:${source.populationId}:home:${group}`) % source.homes.length;
      const home = source.homes[homeIndex], id = `population-beast:${hash(`${seed}:${source.populationId}:${ordinal}`).toString(16)}`;
      // A collision or an already allocated identity is uncertainty, never a refill.
      if (regional.members.some(m => m.actorId === id) || known.has(id) || allocated.some(a => a.id === id)) return null;
      const positionKm = Math.max(.003, Math.min(source.distanceKm - .003,
        home.entryKm + ((hash(`${seed}:${source.populationId}:crossing:${group}`) % 41) - 20) / 1000 + (ordinal % PACK) / 1000));
      members.push({ id, native: true, homeIndex });
      const a = { ...Wild.actor(SPECIES, id, { x: 0, y: 0, z: -9999 }, source.populationId, at), name: 'Rimefang', roomId: '', mapCell: null, homeCell: null,
        routeId: source.routeId, positionKm, offsetM: 2 + ordinal % 3, homePositionKm: positionKm, regionalPhase: 'reserve', effortSeconds: 120,
        regionalAt: at, regionalTargetKm: null, regionalMemoryUntil: 0, regionalSiteId: '',
        campaignTravelRemainingKm: home.distanceKm, campaignTravelAt: at, campaignLeg: home.distanceKm > 0 ? 'approaching' : 'arrived',
        campaignGroupId: `hunting-group:${hash(`${seed}:${source.populationId}:${group}`).toString(16)}` };
      allocated.push(a);
    }
    regional.beasts.actors.push(...allocated);
    Regional.adopt(regional, regional.beasts.actors, 'population-backed-hunting-groups', at);
    regional.managedPopulationIds ||= [];
    if (!regional.managedPopulationIds.includes(source.populationId)) regional.managedPopulationIds.push(source.populationId);
    s.populations.push(p); regional.beasts.materialized = true; return p;
  }
  const capable = a => a && a.status !== 'dead' && a.health > 0 && a.health >= a.maxHealth * .3;
  function advance(s, regional, actors, at, alive = true, speedFactor = () => 1, journal = null, canMove = () => true) {
    if (!s || !alive || !time(at) || at < s.lastAt) return false;
    const byId = new Map(actors.map(a => [a.id, a])); let changed = false;
    for (const p of s.populations) {
      const before = assess(p, actors, s.lastAt, speedFactor), previous = p.lastAssessment;
      const edges = [];
      const emit = (kind, id, when, from, to, actorIds, causeId = p.source.id) => { changed = Changes.record(journal, s, {
        id: `${p.source.id}:${kind}:${id}`, sourceId: p.source.id, siteId: p.source.canonicalCorridorId,
        causeId, kind, from, to, actorIds, at: stamp(when) }, at + 1e-6, alive) || changed; };
      for (const m of p.members.filter(m => m.native)) {
        const a = byId.get(m.id); if (!a || !time(a.campaignTravelRemainingKm) || !time(a.campaignTravelAt)) continue;
        const start = Math.max(p.createdAt, a.campaignTravelAt), dt = Math.max(0, at - start), home = p.source.homes[m.homeIndex];
        a.campaignTravelAt = at;
        // Local bodies stay on their physical ground. Neither leaving the UI
        // nor an injury teleports one out of an occupied tactical patch.
        if (a.status === 'dead' || a.health <= 0 || a.regionalPhase !== 'reserve' || a.roomId || a.mapCell || !canMove(a)) continue;
        const factor = speedFactor(a); if (!Number.isFinite(factor) || factor < 0) continue;
        const pace = 1 / Wild.PROFILES[SPECIES].stepSeconds / Math.max(1, factor) / 1000;
        a.campaignLeg ||= a.campaignTravelRemainingKm > 0 ? 'approaching' : 'arrived';
        // A surviving wounded animal already travelling off-ground can turn
        // back along its OWN travelled habitat path. There is no free healing,
        // new lair, replacement group, or response to unseen player progress.
        if (a.campaignLeg === 'approaching' && !capable(a) && home.distanceKm > 0) {
          a.campaignLeg = 'withdrawing'; changed = true;
          emit('beastWithdrawal', a.id, at, 'approaching', 'withdrawing', [a.id], `${a.id}:existing-wounds`);
          continue; // The wound is known now, not retroactively at the last tick.
        }
        if (['sheltered', 'arrived'].includes(a.campaignLeg)) continue;
        if (a.campaignLeg === 'withdrawing') {
          const left = Math.max(0, home.distanceKm - a.campaignTravelRemainingKm), work = Math.min(left, dt * pace);
          a.campaignTravelRemainingKm += work; changed ||= work > 0;
          if (left <= dt * pace) {
            a.campaignTravelRemainingKm = home.distanceKm; a.campaignLeg = 'sheltered'; changed = true;
            emit('beastSheltered', a.id, start + left / pace, 'withdrawing', 'sheltered', [a.id], `${a.id}:existing-wounds`);
          }
          continue;
        }
        if (!capable(a)) continue;
        const remaining = a.campaignTravelRemainingKm;
        if (remaining > 0) emit('beastDeparture', a.id, start, 'habitatApproach', 'travelling', [a.id]);
        const threshold = start + Math.max(0, remaining / pace - WINDOW);
        if (remaining > 0 && threshold <= at) edges.push(threshold);
        const travel = Math.min(remaining, dt * pace);
        a.campaignTravelRemainingKm = Math.max(0, remaining - travel); changed ||= travel > 0;
        if (remaining > 0 && !a.campaignTravelRemainingKm) {
          const arrivalAt = stamp(start + remaining / pace);
          a.campaignLeg = 'arrived';
          emit('beastArrival', a.id, arrivalAt, 'travelling', 'corridorApproach', [a.id]);
          if (!p.displacements.some(d => d.groupId === a.campaignGroupId)) p.displacements.push({ groupId: a.campaignGroupId,
            fromCellId: home.cellId, at: arrivalAt, cause: 'Original hunting group reached its source-backed corridor approach; danger displaced, not erased.' });
        }
      }
      const result = assess(p, actors, at, speedFactor);
      // Physical travel boundaries are exact even during coarse catch-up.
      // Externally supplied wounds/missing identities are first known at this
      // consumer tick, so never backdate them into an unseen fight.
      const travelTransition = previous?.status === 'suppressed' && before.status === 'suppressed'
        && result.status === 'capable' && edges.length;
      const transitionAt = stamp(travelTransition ? Math.min(...edges) : at);
      if (!previous || previous.status !== result.status) emit('pressure', `${transitionAt}:${result.status}`, transitionAt,
        previous?.status || null, result.status, [], p.source.id);
      p.lastAssessment = { at, status: result.status };
      if (result.status === 'suppressed') { if (p.suppressedSince == null) p.suppressedSince = at; }
      else p.suppressedSince = null;
    }
    s.lastAt = at; return changed;
  }
  // Private capability assessment. Never expose the count/status of unobserved
  // groups in an ordinary report. No empty roster or missing original can win.
  function assess(p, actors, at, speedFactor = () => 1) {
    if (!p || !validSource(p.source) || p.members.length !== p.source.individualCount || !p.members.length || !time(at)) return { status: 'unverified' };
    const byId = new Map(actors.map(a => [a.id, a])); let threatening = 0, consequence = false;
    const originalIds = new Set(p.members.map(m => m.id));
    if (actors.some(a => a.populationId === p.source.populationId && !originalIds.has(a.id))) return { status: 'unverified' };
    for (const m of p.members) {
      const a = byId.get(m.id); if (!a || a.populationId !== p.source.populationId || a.speciesId !== SPECIES) return { status: 'unverified' };
      consequence ||= (a.status === 'dead' || a.health < a.maxHealth) && a.routeId === p.source.routeId
        && time(a.campaignTravelRemainingKm ?? 0) && (a.campaignTravelRemainingKm || 0) * 1000 * Wild.PROFILES[SPECIES].stepSeconds <= WINDOW;
      if (!capable(a)) continue;
      if (['withdrawing', 'sheltered'].includes(a.campaignLeg)) continue;
      if (a.routeId !== p.source.routeId || !time(a.campaignTravelRemainingKm ?? 0)) return { status: 'unverified' };
      const remaining = a.campaignTravelRemainingKm || 0;
      const factor = speedFactor(a); if (!Number.isFinite(factor) || factor < 0) return { status: 'unverified' };
      if (remaining * 1000 * Wild.PROFILES[SPECIES].stepSeconds * Math.max(1, factor) <= WINDOW) threatening++;
    }
    return { status: threatening ? 'capable' : consequence ? 'suppressed' : 'unverified', windowSeconds: WINDOW };
  }
  function record(s, dossier, routeId, siteId, visibleActors, at, alive = true, observedAt = at) {
    if (!s || !alive || !dossier || dossier.report?.speciesId !== SPECIES || !valid(siteId) || !time(at) || !time(observedAt) || observedAt > at) return false;
    const populations = s.populations.filter(p => p.source.routeId === routeId && dossier.populationIds?.includes(p.source.populationId)
      && p.source.profileIds.some(id => dossier.profileIds?.includes(id)));
    const members = new Set(populations.flatMap(p => p.members.map(m => m.id)));
    const seen = visibleActors.filter(a => members.has(a.id) && !(a.campaignTravelRemainingKm > 0));
    if (!seen.length) return false;
    const observations = seen.map(a => ({ id: a.id, capable: capable(a), condition: a.status === 'dead' ? 'Dead; original remains' : capable(a) ? 'Still capable of local hunting pressure' : 'Severely wounded; withdrew from effective hunting' }));
    s.reports.push({ dossierId: dossier.report.id, routeId, siteId, at, observedAt, observations,
      text: 'Personally inspected original Rimefang hunting-group contacts on this reported ground approach. This links the encountered pressure to the scoped campaign, not every same-species sighting. ' +
        (observations.some(o => o.capable) ? 'Observed pressure remains capable here.' : 'The observed local pressure has been broken for now; survivors/remains persist.') +
        ' Unseen replacements and wider regional renewal remain unverified. No extinction or permanently safe corridor is certified.' }); return true;
  }
  function publicView(s) { return { reports: copy(normalize(s)?.reports || []), scope: SCOPE }; }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && valid(to?.worldId) && valid(to?.runId) ? normalize({ ...s, ...to }) : null;
  }
  return { SPECIES, WINDOW, PACK, SCOPE, sourceFromWorld, validSource, create, normalize, register, capable, advance, assess, record, publicView, rebind };
});
