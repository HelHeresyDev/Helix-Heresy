(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./regional-suppression') : root.HelixRegionalSuppression,
    node ? require('./wilderness-beasts') : root.HelixWildernessBeasts,
    node ? require('./city-rule') : root.HelixCityRule,
    node ? require('./beast-diplomacy') : root.HelixBeastDiplomacy,
    node ? require('./mirror-ape-populations') : root.HelixMirrorApePopulations);
  if (node) module.exports = api;
  if (root) root.HelixMunicipalSupplyThreats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Population, Wild, Rule, Diplomacy, Apes) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const SCOPE = 'Original municipal grain traffic on a genuinely shared road crossing. Original animals, driver, truck, cargo and losses only. An overdue carrier is not a casualty report. A safe shipment is not population-wide safety, political submission or world domination.';
  const bound = (s, b) => s && b && s.worldId === b.worldId && s.runId === b.runId;
  // One surveyed interior part of this original farm road. The route geometry
  // fixes the span before any query of wildlife or traffic outcomes.
  function nativeSpan(source, geometry) {
    if (!source?.routeCellIds || source.routeCellIds.length < 3 || !(source.distanceKm > 0)) return null;
    const path = [...source.routeCellIds].reverse(), km = [0], recorded = source.nativeRoad;
    for (let i = 1; i < path.length; i++) {
      if (!geometry.adjacent(path[i - 1], path[i])) return null;
      km.push(km[i - 1] + geometry.distance(path[i - 1], path[i]));
    }
    const total = km.at(-1);
    if (!(total > 0) || !Number.isFinite(total)) return null;
    const i = path.findIndex((id, i) => i > 0 && i < path.length - 1 && (!recorded || id === recorded.cellId)
      && geometry.areaHa(id) > 0 && !geometry.settlement(id));
    if (i < 1) return null;
    const scale = source.distanceKm / total, center = km[i] * scale;
    const lengthKm = Math.min(.064, (km[i] - km[i - 1]) * scale, (km[i + 1] - km[i]) * scale);
    if (!(lengthKm >= .012)) return null;
    const startKm = center - lengthKm / 2, endKm = center + lengthKm / 2;
    return { cellId: path[i], startKm, endKm, lengthKm, areaHa: geometry.areaHa(path[i]),
      routeId: `${source.cityId}:${source.satelliteId}:original-grain-road`,
      anchor: recorded ? { eastM: recorded.eastM, northM: recorded.northM } : null };
  }
  function nativePosition(span, quota, meter = quota.order?.meterKm) {
    if (!span || !Number.isFinite(meter)) return null;
    const direction = quota.order?.phase === 'inbound' ? -1 : 1;
    const outwardKm = direction > 0 ? meter : quota.source.distanceKm - meter;
    return outwardKm < span.startKm - 1e-9 || outwardKm > span.endKm + 1e-9 ? null : {
      direction, outwardKm, km: Math.max(0, Math.min(span.lengthKm, outwardKm - span.startKm))
    };
  }
  function nativeBoundary(span, quota, from, to, tile = 1) {
    if (!span || !(to > from)) return null;
    const incoming = quota.order?.phase === 'inbound';
    const enter = incoming ? quota.source.distanceKm - span.endKm : span.startKm;
    const leave = incoming ? quota.source.distanceKm - span.startKm : span.endKm;
    if (from >= leave - 1e-9 || to < enter - 1e-9) return null;
    return from < enter - 1e-9 ? enter : Math.min(leave, from + tile / 1000);
  }
  function nativeObstruction(entry, occupied, direction) {
    return occupied.some(c => c.z === entry.z && c.y === entry.y
      && (c.x - entry.x) * direction >= 0 && (c.x - entry.x) * direction <= 4);
  }
  function nativeLaneExits(entry, body, tile) {
    // A side step can turn the long axis toward the verge. Leave space for
    // the largest ground dimension, not just the current anchor or heading.
    return [entry.y - Math.ceil(Math.max(body.lengthM, body.widthM) / tile), entry.y + 1];
  }
  function nativeYieldGoal(entry, direction, actor, occupied, tile, canEnter) {
    // While aware of the halted carrier, don't immediately patrol back into
    // the lane from the verge. No movement is credited by this decision.
    if (!nativeObstruction(entry, occupied, direction)) return copy(actor.mapCell);
    return nativeLaneExits(entry, actor.bodyPhysics.dimensions, tile)
      .map(y => ({ ...actor.mapCell, y })).find(canEnter);
  }
  function nativeReport(q, animal, at, outwardKm, held, outcome = null) {
    const o = q.order; if (!o) return false;
    const key = `${o.phase}:${animal.id}:${held ? 'held' : 'seen'}`;
    o.nativeRoadReports ||= [];
    if (o.nativeRoadReports.includes(key)) return false;
    o.nativeRoadReports.push(key);
    o.encounterReports ||= [];
    o.encounterReports.push({ at, contacts: [], description: `Original driver ${held ? 'held for' : 'noticed'} ${animal.name} at ${outwardKm.toFixed(3)} km from the city. ${held
      ? `The road cleared after ${Math.round(outcome.seconds)} seconds; ${outcome.cargoKg.toFixed(1)} kg remained aboard at departure.`
      : 'The lane was clear at the sighting and the truck continued.'} This is a dated account of one passage.` });
    return true;
  }
  function startNative(q, site, animal, position, at) {
    if (q.roadContactId || !q.order || !['outbound', 'inbound'].includes(q.order.phase) || q.vehicle.mapCell
      || !animal?.nativePopulation || animal.roomId !== site.roomId) return null;
    const e = { id: `${q.order.id}:native-road:${at}`, orderId: q.order.id, phase: q.order.phase, siteId: site.id,
      actorId: animal.id, at, lastAt: at, clearSeconds: 0, meterKm: q.order.meterKm, ...position, name: Wild.PROFILES[animal.speciesId].name };
    q.nativeRoadContact = e; q.roadContactId = e.id;
    q.vehicle.mapCell = copy(site.entry); q.vehicle.roomId = site.roomId;
    q.driver.mapCell = { ...site.entry, y: site.entry.y + 1 }; q.driver.roomId = site.roomId;
    return e;
  }
  function activeNative(q) {
    const e = q?.nativeRoadContact;
    return e && q.roadContactId === e.id && q.order?.id === e.orderId && q.order.phase === e.phase
      && q.order.meterKm === e.meterKm ? e : null;
  }
  function clearNative(q, at, occupied, able) {
    const e = activeNative(q); if (!e || !(at > e.lastAt)) return false;
    e.clearSeconds = occupied ? 0 : e.clearSeconds + at - e.lastAt; e.lastAt = at;
    if (e.clearSeconds < 30 || !able || q.driver.status !== 'alive' || q.driver.health < 50 || q.vehicle.condition < 50) return false;
    nativeReport(q, { id: e.actorId, name: e.name }, e.at, e.outwardKm, true, { seconds: at - e.at, cargoKg: q.vehicle.cargoKg });
    q.roadContactId = null; q.nativeRoadContact = null;
    q.driver.mapCell = null; q.driver.roomId = ''; q.vehicle.mapCell = null; q.vehicle.roomId = '';
    return true;
  }
  function sources(map, quota, geometry, routes = []) {
    if (!quota?.routeCellIds?.length || !geometry) return [];
    const path = [...quota.routeCellIds].reverse(), lengths = [0];
    for (let i = 1; i < path.length; i++) lengths.push(lengths.at(-1) + geometry.distance(path[i - 1], path[i]));
    if (!(lengths.at(-1) > 0)) return [];
    const result = [], settlements = new Set((map.humanGeography?.cities || []).map(c => c.cellId));
    for (const raw of map.routeGraph?.routes || []) {
      if (!raw.endpointIds?.includes(quota.cityId)) continue;
      const road = raw.endpointIds[0] === quota.cityId ? raw.cellPath : [...raw.cellPath].reverse();
      const km = [0]; for (let i = 1; i < road.length; i++) km.push(km.at(-1) + geometry.distance(road[i - 1], road[i]));
      const route = routes.find(r => (r.corridorId || r.id) === raw.id) || { id: raw.id, distanceKm: km.at(-1) };
      const apes = Diplomacy.sources(map, route, quota.cityId, geometry).map(population => ({ population, habitat: Apes.habitat(map, population, geometry) }))
        .filter(l => l.habitat);
      for (let i = 1; i < path.length - 1; i++) {
        const j = road.indexOf(path[i]);
        if (j < 1 || j >= road.length - 1 || settlements.has(path[i]) || !geometry.land(path[i])) continue;
        for (const population of [...Population.sourceFromWorld(map, route, quota.cityId, geometry), ...apes.map(l => l.population)]) {
          if (population.speciesId === Population.ELK && !population.homes.some(h => h.distanceKm === 0 && h.cellId === path[i])) continue;
          const habitat = apes.find(l => l.population === population)?.habitat;
          if (habitat && !habitat.spans.some(s => s.cellId === path[i])) continue;
          const row = { quotaId: `${quota.cityId}:agricultural-quota`, cityId: quota.cityId, satelliteId: quota.satelliteId,
            cellId: path[i], farmKm: lengths[i] / lengths.at(-1) * quota.distanceKm,
            corridorKm: km[j] / km.at(-1) * route.distanceKm, population, ...(habitat ? { habitat } : {}) };
          if (validLink(row, quota)) result.push(row);
        }
      }
    }
    return result;
  }
  function validLink(l, quota) {
    return Boolean(l && (Population.validSource(l.population) || Diplomacy.validSource(l.population)
      && l.population.cityId === quota.cityId && Apes.validHabitat(l.habitat, l.population) && l.habitat.spans.some(s => s.cellId === l.cellId))
      && l.cityId === quota.cityId && l.satelliteId === quota.satelliteId
      && l.quotaId === `${quota.cityId}:agricultural-quota` && quota.routeCellIds.slice(1, -1).includes(l.cellId)
      && Number.isFinite(l.farmKm) && l.farmKm > 0 && l.farmKm < quota.distanceKm
      && Number.isFinite(l.corridorKm) && l.corridorKm > 0 && l.corridorKm < l.population.distanceKm);
  }
  function create(binding, quota, links, at) {
    if (!binding.worldId || !binding.runId || !links.length || !links.every(l => validLink(l, quota))) return null;
    return { worldId: binding.worldId, runId: binding.runId, quotaId: `${quota.cityId}:agricultural-quota`, links: copy(links), encounters: [], observations: [], assessments: {}, lastAt: at };
  }
  function normalize(s, quota) {
    return s && bound(s, quota) && s.quotaId === quota.id && s.links?.length && s.links.every(l => validLink(l, quota.source))
      && Array.isArray(s.encounters) && Array.isArray(s.observations) && Number.isFinite(s.lastAt) ? copy(s) : null;
  }
  // Only an original, actually arrived body at this shared physical crossing
  // can intercept. Another route, unlocated claim or distant group cannot spawn here.
  function candidates(s, quota, population, actors, sites, diplomacy = null, canAllocate = () => true) {
    if (!bound(s, quota) || !quota.order || !['outbound', 'inbound'].includes(quota.order.phase)) return [];
    const rows = [];
    for (const link of s.links) {
      if (!canAllocate(link.population.populationId)) continue;
      if (link.population.speciesId === Apes.SPECIES) {
        if (!bound(diplomacy, s) || diplomacy.invalid) continue;
        for (const t of diplomacy.troops) for (const c of Apes.candidates(t, actors, sites, link)) {
          const farmKm = link.farmKm + c.corridorKm - link.corridorKm;
          if (farmKm > 0 && farmKm < quota.source.distanceKm) rows.push({ ...c, link, farmKm });
        }
        continue;
      }
      const p = population?.populations.find(p => p.source.populationId === link.population.populationId
        && p.source.routeId === link.population.routeId);
      if (!p) continue;
      for (const member of p.members) {
        const a = actors.find(a => a.id === member.id), home = member.native && p.source.homes[member.homeIndex];
        if (!a || !Population.capable(a) || a.routeId !== link.population.routeId || a.campaignTravelRemainingKm > 0
          || ['withdrawing', 'sheltered'].includes(a.campaignLeg) || Math.abs(a.offsetM) > Wild.PROFILES[a.speciesId].sight) continue;
        if (member.native ? home?.path.at(-1) !== link.cellId : Math.abs(a.positionKm - link.corridorKm) > .03) continue;
        const site = a.regionalPhase === 'local' ? sites.find(t => t.id === a.regionalSiteId) : null;
        if (a.regionalPhase !== 'reserve' && !site) continue;
        const corridorKm = site?.positionKm ?? a.positionKm;
        const farmKm = link.farmKm + corridorKm - link.corridorKm;
        if (!(farmKm > 0 && farmKm < quota.source.distanceKm)) continue;
        rows.push({ link, actorId: a.id, corridorKm, farmKm, siteId: site?.id || null });
      }
    }
    return rows;
  }
  function crossing(s, quota, candidates, from, to) {
    const incoming = quota.order.phase === 'inbound';
    return candidates.map(c => ({ ...c, meterKm: incoming ? quota.source.distanceKm - c.farmKm : c.farmKm }))
      .filter(c => c.meterKm >= from - 1e-7 && c.meterKm <= to + 1e-7
        && !s.encounters.some(e => e.orderId === quota.order.id && e.phase === quota.order.phase
          && e.populationId === c.link.population.populationId && Math.abs(e.meterKm - c.meterKm) < .001))
      .sort((a, b) => a.meterKm - b.meterKm)[0] || null;
  }
  function start(s, quota, candidate, site, at) {
    if (!bound(s, quota) || !quota.order || quota.vehicle.mapCell || !site || site.routeId !== candidate.link.population.routeId) return false;
    const e = { id: `${quota.order.id}:contact:${s.encounters.length + 1}`, orderId: quota.order.id, phase: quota.order.phase,
      siteId: site.id, populationId: candidate.link.population.populationId, at, endedAt: null,
      meterKm: candidate.meterKm, lastAt: at, clearSeconds: 0, contacts: [], deliveredReport: false };
    s.encounters.push(e); quota.roadContactId = e.id;
    quota.vehicle.mapCell = { ...site.entry, x: site.entry.x + 2 }; quota.vehicle.roomId = site.roomId;
    quota.driver.mapCell = { ...site.entry, x: site.entry.x + 2, y: site.entry.y + 1 }; quota.driver.roomId = site.roomId;
    return e;
  }
  function active(s, quota) { return s?.encounters.find(e => e.id === quota?.roadContactId && e.endedAt == null) || null; }
  function step(s, quota, site, actors, at, h) {
    const e = h.encounter || active(s, quota); if (!e || !site || at <= e.lastAt || h.alive?.() === false) return false;
    const dt = at - e.lastAt; e.lastAt = at; s.lastAt = at;
    const v = quota.vehicle, d = quota.driver;
    const local = actors.filter(a => a.roomId === site.roomId && a.regionalPhase === 'local');
    let threat = false;
    for (const a of local) {
      if (h.alive?.() === false) break;
      const vertical = h.verticalStep?.(a, null, at);
      if (vertical && a.climbing?.mode !== 'perched') { h.spellStep?.(a, null, null, at); continue; }
      if (a.status === 'dead' || a.health <= 0 || h.incapacitated?.(a)) { h.spellStep?.(a, null, null, at); continue; }
      const profile = Wild.PROFILES[a.speciesId];
      const targets = [...(h.targets || []), ...(v.roomId !== site.roomId ? [] : v.condition > 0 ? [{ kind: 'structure', cell: v.mapCell, id: v.id }]
        : d.status === 'alive' ? [{ kind: 'creature', cell: d.mapCell, id: d.id }] : v.cargoKg > 0 ? [{ kind: 'structure', cell: v.mapCell, id: v.id }] : [])];
      if (a.targetId && h.protectedTarget?.(a, a.targetId, at)) { a.targetId = null; a.lastTarget = null; a.rememberedUntil = 0; }
      const seen = targets.filter(t => !h.protectedTarget?.(a, t.id, at) && Wild.distance(a.mapCell, t.cell) <= profile.sight
        && (h.actorSight ? h.actorSight(a, t) : h.sight(a.mapCell, t.cell)))
        .sort((aTarget, bTarget) => Wild.distance(a.mapCell, aTarget.cell) - Wild.distance(a.mapCell, bTarget.cell));
      const t = seen.find(t => t.id === a.targetId && at < a.provokedUntil) || seen[0];
      if (t) a.targetId = t.id;
      const decision = h.intent?.(a) || Wild.decide(a, t?.cell || a.lastTarget, at, Boolean(t), false);
      if (a.effortSeconds <= 0 && ['pursue', 'investigate'].includes(decision.behavior)) {
        decision.behavior = 'return'; decision.goal = a.homeCell;
      }
      a.behavior = decision.behavior;
      if (t && decision.behavior === 'pursue') threat = true;
      if (h.spellStep?.(a, t, decision, at)) continue;
      if (vertical) continue;
      if (h.verticalStep?.(a, decision, at)) continue;
      if (decision.behavior === 'pursue' && t && Wild.distance(a.mapCell, t.cell) <= 1 && at >= a.nextAttackAt) {
        const before = v.condition, cargo = v.cargoKg, health = d.health;
        const result = h.strike(a, t, profile);
        a.nextAttackAt = at + profile.recovery;
        if (result.ok) e.contacts.push({ at, name: profile.name, actorId: a.id, populationId: a.populationId,
          vehicleDamage: Math.max(0, before - v.condition),
          spoiledKg: Math.max(0, cargo - v.cargoKg), driverDamage: Math.max(0, health - d.health) });
      } else if (at >= a.nextMoveAt) {
        const canEnter = cell => h.canEnter(a, cell) && !targets.some(t => Wild.key(t.cell) === Wild.key(cell));
        let next;
        if (decision.behavior === 'flee') next = Wild.neighbors(a.mapCell).filter(canEnter).sort((aCell, bCell) => Wild.distance(bCell, decision.goal) - Wild.distance(aCell, decision.goal))[0];
        else if (decision.behavior === 'roam') {
          const options = Wild.neighbors(a.mapCell).filter(c => canEnter(c) && Wild.distance(c, a.homeCell) <= 2);
          next = options[a.patrolIndex++ % options.length];
        }
        else next = Wild.nextStep(a.mapCell, decision.goal, canEnter);
        // Plan up to a perceived target's neighboring tile, never through bodies.
        if (!next && t && ['pursue', 'investigate'].includes(decision.behavior) && Wild.distance(a.mapCell, t.cell) > 1) for (const goal of Wild.neighbors(t.cell).filter(canEnter)) {
          next = Wild.nextStep(a.mapCell, goal, canEnter); if (next) break;
        }
        if (next) a.mapCell = copy(next);
        a.nextMoveAt = at + profile.stepSeconds * (h.speedFactor?.(a) || 1);
      }
    }
    if (h.alive?.() === false) return true;
    if (h.campOnly) return true; // Field-party ecology does not hold or release a distant carrier.
    e.clearSeconds = threat || h.extraThreat?.() ? 0 : e.clearSeconds + dt;
    if (e.clearSeconds >= 30 && d.status === 'alive' && d.health >= 50 && !h.incapacitated?.(d) && v.condition >= 50) {
      e.endedAt = at; quota.roadContactId = null;
      quota.order.encounterReports ||= [];
      quota.order.encounterReports.push({ at, contacts: e.contacts.map(c => ({ at: c.at, name: c.name, vehicleDamage: c.vehicleDamage,
        spoiledKg: c.spoiledKg, driverDamage: c.driverDamage })), description: 'Original carrier personally encountered animals on the shared road. This is not a regional census or permanent safety.' });
      d.mapCell = null; d.roomId = ''; v.mapCell = null; v.roomId = '';
    }
    return true;
  }
  function vehicleImpact(quota, amount, at) {
    if (!quota?.roadContactId || !quota.vehicle.mapCell || !(amount > 0)) return false;
    if (quota.vehicle.condition > 0) quota.vehicle.condition = Math.max(0, quota.vehicle.condition - amount);
    else if (quota.vehicle.cargoKg > 0) {
      const kg = Math.min(50, quota.vehicle.cargoKg); quota.vehicle.cargoKg -= kg;
      quota.stores.spoiledKg = (quota.stores.spoiledKg || 0) + kg;
      quota.order.spoiledKg = (quota.order.spoiledKg || 0) + kg;
    }
    quota.vehicle.lastImpactAt = at; return true;
  }
  function observe(s, quota, actors, site, at, canSee) {
    if (!site || !canSee(quota.vehicle.mapCell) || quota.vehicle.roomId !== site.roomId) return false;
    s.observations.push({ at, siteId: site.id, vehicle: quota.vehicle.condition <= 0 ? 'Wrecked original truck' : quota.vehicle.condition < 50 ? 'Original truck cannot operate' : 'Original truck remains operable',
      driver: canSee(quota.driver.mapCell) ? quota.driver.status === 'dead' ? 'Original driver dead' : quota.driver.health < 50 ? 'Original driver incapacitated' : 'Original driver alive' : 'Driver condition unverified',
      contacts: actors.filter(a => a.roomId === site.roomId && canSee(a.mapCell)).map(a => ({ name: Wild.PROFILES[a.speciesId].name,
        condition: a.status === 'dead' ? 'Physical remains' : a.health < a.maxHealth * .3 ? 'Severely wounded' : 'Living contact' })) });
    return true;
  }
  function fact(s, quota, population, actors, at, context = {}) {
    if (!bound(s, quota) || !bound(population, s) || context.alive === false) return [];
    return Population.facts(population, actors, at, true, context.canAssess).filter(f => s.links.some(l => l.population.populationId === f.sourceId)).map(f => {
      if (context.canAssess && !context.canAssess(f.sourceId)) return f;
      const { rule, succession, people, civic } = context;
      const dependent = rule && bound(rule, s) && rule.lastAt === at && quota.lastAt === at && rule.pilotProvisionId === quota.id
        && rule.source.cityId === quota.source.cityId && rule.handoverId === quota.handoverId && rule.plan
        && civic?.alive && Rule.authority(rule, succession, people || [], civic)
        && Rule.condition(rule, succession, people || [], civic) === 'supply' && quota.stores.cityKg <= 1e-7;
      // Actual damage to this necessary original carrier must still be held
      // by a capable, physically present aggressor. Presence, hostility labels,
      // a nearby herd or a mere overdue truck do not establish governing effect.
      const e = dependent && active(s, quota);
      const cause = e && e.lastAt === at && (quota.vehicle.condition < 50 || quota.driver.status === 'dead' || quota.driver.health < 50)
        && e.contacts.find(c => c.populationId === f.sourceId && (c.vehicleDamage > 0 || c.driverDamage > 0)
          && actors.some(a => a.id === c.actorId && a.populationId === f.sourceId && Population.capable(a) && !context.incapacitated?.(a)
            && a.regionalPhase === 'local' && a.roomId === quota.vehicle.roomId && a.behavior === 'pursue'
            && [quota.vehicle.id, quota.driver.id].includes(a.targetId)));
      if (cause && f.state !== 'qualifying') {
        f.state = 'notQualifying'; f.since = at; f.proofId = `${e.id}:${cause.actorId}:necessary-supply`;
        f.strategic.consumerId = 'municipal-supply-threats'; f.strategic.canOverturn = f.strategic.willing = true;
      }
      return f;
    });
  }
  function rebind(s, quota, from, to) {
    s = normalize(s, quota); return bound(s, from) ? { ...s, ...to } : null;
  }
  return { SCOPE, sources, validLink, create, normalize, candidates, crossing, start, active, step, vehicleImpact, observe, fact, rebind,
    nativeSpan, nativePosition, nativeBoundary, nativeObstruction, nativeLaneExits, nativeYieldGoal, nativeReport, startNative, activeNative, clearNative };
});
