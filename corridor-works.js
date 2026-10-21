(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./joint-transit') : root.HelixJointTransit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCorridorWorks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Joint) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const SCOPE = 'One inspected three-metre roadbed breach under the original two-sponsor compact. No new road, fort, map, staff, supplies, city admission, alliance or sovereignty. Other damaged links remain independent; checkpoint service and political permission are separate from pavement.';
  function validSource(s) {
    return Boolean(s?.id && s.causeId && s.routeId && s.canonicalCorridorId && Joint.validSource(s.joint)
      && s.joint.corridorId === s.routeId && ['damaged', 'severed'].includes(s.physicalState)
      && ['operational', 'degraded', 'intermittent', 'closed'].includes(s.residualContinuity)
      && Array.isArray(s.remainingFailures) && s.authority === 'existingJointCompact');
  }
  function sourceFromWorld(map, route, distance) {
    const joint = Joint.sourceFromWorld(map, route, distance), canonical = route?.corridorId || route?.id;
    const row = map?.strategicPlayableSettlementState?.routeRows.find(r => r.corridorId === canonical);
    const cause = map?.strategicCrisisHistory?.eventRows.find(e => e.id === row?.lastCauseEventId);
    if (!joint || !row || !['damaged', 'severed'].includes(row.physicalState) || !cause
      || !cause.stateDelta?.infrastructureDeltas?.some(d => d.assetId === canonical && d.kind === 'supportCorridor' && ['damaged', 'severed'].includes(d.resultingState))) return null;
    const state = map.strategicPlayableSettlementState;
    const forts = row.requiredStrongholdIds.map(id => state.strongholdRows.find(f => f.strongholdId === id));
    const cities = row.endpointCityIds.map(id => state.cityRows.find(c => c.cityId === id));
    const remainingFailures = forts.filter(f => !f || f.physicalCondition === 'ruined' || f.currentPopulation < 4).map(f => f?.strongholdId || 'missing-original-stronghold');
    for (const sponsor of joint.sponsors) {
      const g = map.cityGovernments.governments.find(g => g.cityId === sponsor.cityId);
      const works = g.institutions?.find(i => i.id === sponsor.institutionId);
      if (!works || !['functional', 'strong', 'exceptional'].includes(works.capacityBand)) return null;
    }
    if (cities.some(c => !c || c.physicalCondition === 'ruined' || !c.currentPopulation)) remainingFailures.push('original-endpoint-uninhabitable');
    const damaged = forts.filter(f => f && (['damaged', 'worn'].includes(f.physicalCondition) || f.habitationStatus !== 'inhabited')).length;
    const residualContinuity = remainingFailures.length ? 'closed' : damaged > Math.max(1, forts.length / 2) ? 'intermittent'
      : damaged || cities.some(c => c.physicalCondition !== 'intact') ? 'degraded' : 'operational';
    const source = { id: `corridor-work:${canonical}:${cause.id}`, causeId: cause.id, routeId: route.id, canonicalCorridorId: canonical,
      joint, physicalState: row.physicalState, baseline: { continuity: route.continuity, supportCapable: route.supportCapable },
      residualContinuity, remainingFailures, authority: 'existingJointCompact' };
    return validSource(source) ? source : null;
  }
  function create(source, binding, station, at) {
    if (!validSource(source) || !binding?.worldId || !binding.runId || !station?.layout?.roomId) return null;
    const z = station.layout.entry.z, point = (x, y) => ({ x, y, z });
    // A bounded local elaboration of the saved causal corridor breach, not a
    // claim that a whole ruined fort or an unknown second failure was fixed.
    const parts = [13, 14, 15].map(x => ({ id: `roadbed:${x},13,${z}`, kind: 'floor', cell: point(x, 13),
      costs: { stoneBlocks: 4, metalParts: 1 }, seconds: 900, tools: { masonryHammer: 3, stoneChisel: 2 } }));
    return { ...copy(binding), id: source.id, source: copy(source), stationId: station.id, inspectedAt: null, grant: null, startedAt: null,
      site: { worldId: binding.worldId, siteId: source.id, id: source.id, cityId: source.joint.endpointCityIds[0],
        roomId: station.layout.roomId, registeredAt: at, layout: { parts, floors: parts.map(p => p.cell) }, parts: {}, effort: {} },
      history: [], observations: null, condition: 'uninspected' };
  }
  function normalize(v) {
    if (!v?.worldId || !v.runId) return null;
    const sources = (v.preparedSources || []).filter(validSource);
    const sites = (v.sites || []).filter(s => validSource(s.source) && s.id === s.source.id && s.worldId === v.worldId && s.runId === v.runId
      && s.site?.siteId === s.id && s.site.worldId === v.worldId && s.site.layout?.parts?.length === 3 && s.site.parts && s.site.effort && Array.isArray(s.history));
    return copy({ worldId: v.worldId, runId: v.runId, preparedSources: sources, sites: sites.filter((s, i) => sites.findIndex(t => t.id === s.id) === i),
      currentSupportComponents: v.currentSupportComponents || [],
      notices: (v.notices || []).filter(n => validSource(n.source) && n.id && Number.isFinite(n.at) && n.homeCityId && n.plan?.worksiteId === n.source.id) });
  }
  function rebind(v, from, to) {
    const s = normalize(v); if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId) return null;
    Object.assign(s, to); for (const w of s.sites) { Object.assign(w, to); w.site.worldId = to.worldId; } return s;
  }
  function notice(source, homeCityId, at) {
    if (!validSource(source) || !source.joint.endpointCityIds.includes(homeCityId)) return null;
    const other = source.joint.endpointCityIds.find(id => id !== homeCityId), km = Joint.position(source.joint, homeCityId);
    const id = `${source.id}:approach:${homeCityId}`;
    return { id, at, homeCityId, source: copy(source), plan: {
      id: `works-approach:${source.id}:${homeCityId}`, homeId: `city:${homeCityId}`, groundId: source.id, cityId: other, homeCityId,
      corridorId: source.routeId, worksiteId: source.id, sourceId: id, sourceAt: at, distanceKm: km,
      fullDistanceKm: source.joint.distanceKm, cellPath: [], label: 'Original joint roadworks receiving ground',
      source: 'Released original joint-compact work approach, not a completed passenger itinerary or map',
      directions: 'Follow the existing near-side corridor to the original stronghold receiving apron. Stop before the damaged roadbed; no onward city or vehicle passage is certified.',
      legs: [{ distanceKm: km, factor: 1.55 }] } };
  }
  function authorize(w, station, bodyEpoch, at, paidDuty = 0) {
    if (!w || w.inspectedAt == null || station.id !== w.stationId || JSON.stringify(station.source.sponsors) !== JSON.stringify(w.source.joint.sponsors)
      || station.job || Joint.active(station, at)
      || ![0, 60].includes(paidDuty)
      || station.members.some(a => !Joint.able(a) || !a.willing || a.assignment || a.workSeconds < 60 - paidDuty)) return false;
    station.members.forEach(a => { a.workSeconds -= 60 - paidDuty; });
    w.grant = { at, bodyEpoch, sponsorCityIds: copy(w.source.joint.endpointCityIds), stationId: station.id,
      authority: 'existingJointCompact', scope: SCOPE };
    w.history.push({ at, kind: 'authorized', bodyEpoch, sponsorCityIds: copy(w.grant.sponsorCityIds) }); return true;
  }
  function intact(w, condition) {
    return w.site.layout.parts.every(p => w.site.parts[p.id] && condition(p, w) >= 50);
  }
  function components(network) {
    const cities = [...new Set(network.destinations.filter(d => d.kind === 'fortifiedCity').map(d => d.cityId))].sort(), seen = new Set(), out = [];
    for (const start of cities) {
      if (seen.has(start)) continue;
      const members = [start]; seen.add(start);
      for (let i = 0; i < members.length; i++) for (const r of network.routes) {
        if (!r.supportCapable || r.continuity === 'closed' || !r.endpointCityIds.includes(members[i])) continue;
        for (const id of r.endpointCityIds) if (cities.includes(id) && !seen.has(id)) { seen.add(id); members.push(id); }
      }
      members.sort(); out.push({ id: `run-support:${members[0]}`, cityIds: members, politicalUnity: false });
    }
    return out;
  }
  function project(s, network, condition, sourceCurrent, at, alive = true) {
    if (!s || !alive) return false;
    let changed = false;
    for (const w of s.sites) {
      if (w.startedAt == null) continue;
      const route = network.routes.find(r => r.id === w.source.routeId); if (!route) continue;
      const observed = { continuity: route.continuity, supportCapable: route.supportCapable };
      if (w.lastProjection && JSON.stringify(observed) !== JSON.stringify(w.lastProjection)) w.externalCondition = observed;
      const ready = intact(w, condition);
      let continuity = ready && sourceCurrent(w) ? w.source.residualContinuity : 'closed';
      // An unrelated run-owned route failure cannot be erased by repeatedly
      // projecting our own surviving stone courses.
      if (w.externalCondition) {
        const ranks = ['operational', 'degraded', 'intermittent', 'closed'];
        const external = w.externalCondition.supportCapable ? w.externalCondition.continuity : 'closed';
        continuity = ranks[Math.max(ranks.indexOf(continuity), ranks.indexOf(external))] || 'closed';
      }
      const status = ready ? 'roadbedRestored' : 'roadbedUnusable';
      if (w.condition !== status) { w.condition = status; w.history.push({ at, kind: status }); }
      if (route.continuity !== continuity || route.supportCapable !== (continuity !== 'closed')) {
        route.continuity = continuity; route.supportCapable = continuity !== 'closed'; changed = true;
      }
      w.lastProjection = { continuity: route.continuity, supportCapable: route.supportCapable };
    }
    if (changed) {
      const groups = components(network); s.currentSupportComponents = groups;
      const home = network.destinations.find(d => d.id === network.homeDestinationId);
      for (const d of network.destinations) { const group = groups.find(g => g.cityIds.includes(d.cityId));
        if (group) { d.supportComponentId = group.id; d.reachable = Boolean(group.cityIds.includes(home?.cityId)); } }
    }
    return changed;
  }
  return { SCOPE, validSource, sourceFromWorld, create, normalize, rebind, notice, authorize, intact, components, project };
});
