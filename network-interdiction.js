(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-operations') : root.HelixNetworkOperations,
    node ? require('./expedition-escorts') : root.HelixExpeditionEscorts,
    node ? require('./wilderness-beasts') : root.HelixWildernessBeasts);
  if (node) module.exports = api;
  if (root) root.HelixNetworkInterdiction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Networks, Escorts, Wild) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const PURPOSE = Networks.SUPPLY_PURPOSE, REPORT = 120, RADIO = 60, COST = 120, SPEED = 2.4 / 3600;
  const able = a => a?.status === 'alive' && a.health >= 35 && a.workSeconds > 0 && a.foodSeconds > 0
    && a.waterSeconds > 0 && a.physicalControl.stamina > 1;
  const same = (a, b) => a && b && Wild.key(a) === Wild.key(b);
  const bound = Networks.bound;
  const SCOPE = 'Original employed field team, actual reported breach, paid limited deployment and measured municipal road. No balancing army, municipal vehicle ownership, automatic overthrow, map disclosure or whole-network certification.';
  function sources(map) {
    const h = map?.strategicNonStateNetworkHistory, used = new Map(); if (!h) return [];
    return [...h.branchRows].sort((a, b) => a.id.localeCompare(b.id)).flatMap(b => {
      const n = h.networkRows.find(n => n.networkId === b.networkId);
      const city = map.strategicPlayableSettlementState?.cityRows.find(c => c.cityId === b.currentCityId);
      if (n?.category !== 'military' || !n.organizationalContinuity || ['defunct', 'dormant'].includes(n.lifecycleStatus)
        || !['established', 'strong', 'exceptional'].includes(n.actualCapacityBand) || !city?.physicalJurisdictionExists
        || city.physicalCondition === 'ruined' || city.currentPopulation < 64 || b.consolidatedIntoBranchId
        || b.organizationForm !== 'escortChapter' || b.operationalStatus !== 'active' || !b.publicPhysicalPresence
        || ['ruined', 'destroyed'].includes(b.physicalCondition)
        || !['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand)
        || !['licensed', 'chartered', 'recognized'].includes(b.currentStanding)
        || (used.get(city.cityId) || 0) + 2 > Math.floor(city.currentPopulation / 16)) return [];
      used.set(city.cityId, (used.get(city.cityId) || 0) + 2);
      return [{ id: `${b.id}:original-field-team`, branchId: b.id, networkId: b.networkId, cityId: city.cityId,
        populationSourceId: city.assetId, people: 2, label: b.publicName,
        provenance: 'Two separately reserved original local field employees; not the protective professional, survey employee, municipal defender or a new population.' }];
    });
  }
  function validSource(s) { return s?.id === `${s?.branchId}:original-field-team` && s.people === 2
    && ['branchId', 'networkId', 'cityId', 'populationSourceId', 'label'].every(k => typeof s[k] === 'string' && s[k]); }
  function links(map, quota, geometry, routes = []) {
    if (!quota?.routeCellIds?.length || !geometry) return [];
    const farm = [...quota.routeCellIds].reverse(), km = [0], result = [];
    for (let i = 1; i < farm.length; i++) km.push(km.at(-1) + geometry.distance(farm[i - 1], farm[i]));
    if (!(km.at(-1) > 0)) return [];
    for (const raw of map.routeGraph?.routes || []) {
      const route = routes.find(r => (r.corridorId || r.id) === raw.id);
      if (!route || !raw.endpointIds?.includes(quota.cityId)) continue;
      const road = raw.endpointIds[0] === quota.cityId ? raw.cellPath : [...raw.cellPath].reverse(), roadKm = [0];
      for (let i = 1; i < road.length; i++) roadKm.push(roadKm.at(-1) + geometry.distance(road[i - 1], road[i]));
      if (!(roadKm.at(-1) > 0)) continue;
      const strongholds = (map.cityExpansionHistory?.strongholdRows || []).filter(h => h.corridorId === raw.id)
        .filter(h => map.strategicPlayableSettlementState?.strongholdRows?.some(r => r.strongholdId === h.id
          && r.currentPopulation >= 4 && r.physicalCondition !== 'ruined'))
        .map(h => { const index = road.indexOf(h.cellId); return { id: h.id, cellId: h.cellId,
          corridorKm: index >= 0 ? roadKm[index] / roadKm.at(-1) * route.distanceKm : null }; });
      for (let i = 1; i < farm.length - 1; i++) {
        const j = road.indexOf(farm[i]); if (j < 1 || j >= road.length - 1 || !geometry.land(farm[i])
          || strongholds.some(h => h.cellId === farm[i]) || map.humanGeography?.cities?.some(c => c.cellId === farm[i])) continue;
        result.push({ cityId: quota.cityId, satelliteId: quota.satelliteId, cellId: farm[i], routeId: `intercity-march:${route.id}`, networkRouteId: route.id,
          corridorId: raw.id, originCityId: quota.cityId, endpointCityIds: copy(raw.endpointIds),
          farmKm: km[i] / km.at(-1) * quota.distanceKm, corridorKm: roadKm[j] / roadKm.at(-1) * route.distanceKm,
          distanceKm: route.distanceKm, strongholds: copy(strongholds) });
      }
    }
    return result;
  }
  function routeClear(link, originCityId) {
    if (!link?.endpointCityIds?.includes(originCityId)) return false;
    const low = originCityId === link.originCityId ? 0 : link.corridorKm;
    const high = originCityId === link.originCityId ? link.corridorKm : link.distanceKm;
    // This first foot consumer has no third-party stronghold inspection or
    // passage contract. Affiliation and a continuous road are not admission.
    return !(link.strongholds || []).some(h => !Number.isFinite(h.corridorKm) || h.corridorKm >= low && h.corridorKm <= high);
  }
  const physicalRouteId = link => link?.routeId?.startsWith('intercity-march:') ? link.routeId : `intercity-march:${link?.routeId}`;
  function create(sourceRows, binding, seed, at) {
    if (!binding?.worldId || !binding.runId || !sourceRows?.every(validSource)) return null;
    return { ...binding, sourceRegistry: copy(sourceRows), allocatedAt: at, lastAt: at, links: [], quotaId: null, reports: [], repair: null, repairs: [], units: sourceRows.map(source => ({
      id: source.id, source: copy(source), phase: 'idle', attempts: [], job: null, deployment: null, observations: [],
      radioSeconds: 3600, serial: 0, actors: [1, 2].map(i => {
        const a = Escorts.candidate(seed, { id: `${source.id}:${i}`, label: source.label });
        return { ...a, id: `${source.id}:${i}`, cityId: source.cityId, affiliation: `${source.label} employed field professional`,
          actorKind: 'civicOfficeholder', roomId: null, mapCell: null,
          workSeconds: 43200, foodSeconds: 43200, waterSeconds: 43200, assignment: null,
          physicalControl: { strength: 25, stamina: 80, staminaCapacity: 80 },
          fieldKit: { toolCondition: 100, vestCondition: 100 } };
      }) })) };
  }
  function normalize(s) {
    if (s == null) return null;
    if (!s.worldId || !s.runId || !Array.isArray(s.units) || !Array.isArray(s.links) || !Array.isArray(s.reports)
      || !Number.isFinite(s.lastAt) || !s.units.every(u => validSource(u.source) && u.actors?.length === 2
        && u.actors.every((a, i) => a.id === `${u.id}:${i + 1}` && a.fieldKit && Number.isFinite(a.workSeconds))))
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true, lastAt: s.lastAt || 0 };
    return { ...copy(s), sourceRegistry: copy(s.sourceRegistry || s.units.map(u => u.source)) };
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...to } : null; }
  function sync(s, expected = s?.sourceRegistry) {
    if (!s || s.invalid) return;
    s.sourceRegistry ||= s.units.map(u => copy(u.source));
    for (const source of expected || []) if (!s.sourceRegistry.some(r => r.id === source.id)) s.sourceRegistry.push(copy(source));
    for (const source of s.sourceRegistry) if (!s.units.some(u => u.id === source.id)) {
      const u = create([source], { worldId: s.worldId, runId: s.runId }, 'lost-account', s.allocatedAt).units[0];
      u.phase = 'unverified'; u.lost = true;
      u.actors.forEach(a => { a.status = 'unknown'; a.health = 0; a.workSeconds = a.foodSeconds = a.waterSeconds = 0;
        a.fieldKit.toolCondition = a.fieldKit.vestCondition = 0; }); s.units.push(u);
    }
    for (const link of [...s.links, ...s.units.flatMap(u => [u.deployment?.link, ...(u.history || []).map(d => d.link)])].filter(Boolean)) {
      link.networkRouteId ||= link.routeId.startsWith('intercity-march:') ? link.routeId.slice('intercity-march:'.length) : link.routeId;
      link.routeId = physicalRouteId(link);
    }
  }
  function reserve(s, networks) {
    if (!s || s.invalid || !bound(s, networks)) return;
    for (const u of s.units) {
      const a = Networks.host(networks, u.source.branchId); if (!a) continue;
      let row = a.allocations.find(r => r.id === u.id);
      if (!row) a.allocations.push(row = { id: u.id, kind: 'originalFieldTeam', people: u.source.people });
      row.actorIds = u.actors.map(a => a.id); row.assignment = u.deployment?.id || null;
      row.conditions = u.actors.map(a => ({ id: a.id, status: a.status, workSeconds: a.workSeconds, kit: copy(a.fieldKit) }));
    }
  }
  function release(u, c) {
    const id = u.job?.id;
    for (const a of [c.clerk, c.account?.operator]) if (a?.assignment === id) a.assignment = null;
    if (c.gate?.receptionAssignment === id) c.gate.receptionAssignment = null;
    u.job = null;
  }
  function current(u, c) { return c.sourceCurrent && c.account?.id === u.source.branchId && c.account.source.networkId === u.source.networkId; }
  function witness(u, c, own, at) { return current(u, c) && c.clerk?.status === 'alive' && c.clerk.health >= 35
    && c.witnessCurrent && c.channel && !c.clerkIncapacitated && c.gate.powerSeconds > 1 && c.gate.receptionWorkSeconds > 0
    && c.account.operator.status === 'alive' && c.account.operator.workSeconds > 0 && c.account.terminal.powerSeconds > 0
    && !(c.account.operator.lastOperatingWorkAt >= at)
    && [c.clerk.assignment, c.gate.receptionAssignment, c.account.operator.assignment].every(id => !id || id === own); }
  function advance(s, networks, context, to, h = {}) {
    if (!s || s.invalid || !bound(s, networks) || !Number.isFinite(to) || to <= s.lastAt || !h.alive?.()) return false;
    if (!s.repair && !s.units.some(u => u.job || u.deployment && !['returned', 'losses'].includes(u.phase)
      || context(u)?.breach && !u.attempts.some(r => r.id === context(u).breach.id))) { s.lastAt = to; return false; }
    while (s.lastAt < to && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      if (s.repair && at > s.repair.at) {
        const r = s.repair, c = h.repairContext?.(), q = c?.quota;
        if (!c?.ready || !bound(s, q) || c.bodyEpoch !== r.bodyEpoch || !same(c.cell, r.cell) || q?.vehicle.id !== r.vehicleId) {
          r.interruptedAt = at; s.repairs.push(copy(r)); s.repair = null;
        } else {
          r.progress += Math.min(dt, 120 - r.progress);
          if (r.progress >= 120) { q.vehicle.condition = Math.min(100, q.vehicle.condition + 30);
            r.completedAt = at; s.repairs.push(copy(r)); s.repair = null; }
        }
      }
      for (const u of s.units) {
        const c = context(u); if (!c) continue;
        const a = c.account, d = u.deployment;
        if (!d || u.phase === 'returned') {
          const breach = c.breach;
          if (!u.job && breach && breach.at >= s.allocatedAt && breach.at <= at - dt
            && !(d?.carrier && !d.carrier.endedAt) && !u.attempts.some(r => r.id === breach.id) && witness(u, c, null, at)
            && c.targetControlled && bound(s, c.quota) && c.link && routeClear(c.link, u.source.cityId) && u.actors.every(x => able(x) && !x.assignment)
            && a.money >= COST && c.routeOpen) {
            u.attempts.push({ id: breach.id, at, receivedAt: null });
            u.job = { id: `${u.id}:breach-report:${++u.serial}`, breach: copy(breach), progress: 0, at: at - dt };
            c.clerk.assignment = c.gate.receptionAssignment = a.operator.assignment = u.job.id;
          }
          if (u.job) {
            const j = u.job;
            if (!witness(u, c, j.id, at) || !bound(s, c.quota) || !c.breach || c.breach.id !== j.breach.id) { release(u, c); continue; }
            const n = Math.min(dt, REPORT - j.progress, c.gate.receptionWorkSeconds, c.gate.powerSeconds - 1,
              a.operator.workSeconds, a.terminal.powerSeconds);
            j.progress += n; c.gate.receptionWorkSeconds -= n; c.gate.powerSeconds -= n;
            a.operator.workSeconds -= n; a.terminal.powerSeconds -= n;
            a.operator.lastOperatingWorkAt = at;
            if (j.progress >= REPORT) {
              const cause = copy(j.breach); release(u, c); u.attempts.at(-1).receivedAt = at;
              const distance = u.source.cityId === c.link.originCityId ? c.link.corridorKm : c.link.distanceKm - c.link.corridorKm;
              if (!c.targetControlled || !bound(s, c.quota) || !c.routeOpen || !routeClear(c.link, u.source.cityId) || !current(u, c) || a.money < COST
                || !Networks.permitted(networks, u.source.branchId, PURPOSE)
                || distance <= 0 || !u.actors.every(x => able(x) && x.workSeconds > distance / SPEED * 2 + 600
                  && x.foodSeconds > distance / SPEED * 2 + 600 && x.waterSeconds > distance / SPEED * 2 + 600)) { u.phase = 'declined'; continue; }
              const id = `${u.id}:deployment:${++u.serial}`; a.money -= COST;
              if (u.deployment) { u.history ||= []; u.history.push(copy(u.deployment)); }
              a.payments.push({ id, at, amount: COST, purpose: PURPOSE, causeId: cause.id });
              u.deployment = { id, cause, link: copy(c.link), distanceKm: distance, positionKm: 0, at,
                charterReceiptId: c.targetReceiptId, spent: COST, siteId: null, recall: null, ceasefire: null, contacts: [], clearSeconds: 0, lastMoveAt: at };
              u.actors.forEach(x => x.assignment = id); u.phase = 'outbound';
              continue; // No simultaneous report work and field travel.
            }
          }
          continue;
        }
        if (u.phase === 'returned') continue;
        for (const x of u.actors.filter(x => x.status === 'alive')) {
          const credit = Math.min(dt, x.fieldRadioWorkCredit || 0); x.fieldRadioWorkCredit = Math.max(0, (x.fieldRadioWorkCredit || 0) - credit);
          if (x.assignment === d.id) x.workSeconds = Math.max(0, x.workSeconds - dt + credit);
          x.foodSeconds = Math.max(0, x.foodSeconds - dt);
          x.waterSeconds = Math.max(0, x.waterSeconds - dt);
        }
        if (u.actors.every(x => x.status === 'dead')) {
          if (a?.operator.assignment === d.recall?.id) a.operator.assignment = null;
          u.phase = 'losses'; d.endedAt ??= at; continue;
        }
        const mandate = a?.mandates?.[PURPOSE];
        if (mandate && !d.ceasefire) {
          d.recall ||= { id: `${d.id}:stand-down:${mandate.id}`, mandateId: mandate.id, at: mandate.at, progress: 0 };
          const r = d.recall;
          if (at > r.at && current(u, c) && a.operator.status === 'alive' && (!a.operator.assignment || a.operator.assignment === r.id)
            && !(a.operator.lastOperatingWorkAt >= at)
            && a.operator.workSeconds >= dt && a.terminal.powerSeconds >= dt && u.radioSeconds >= dt
            && u.actors.some(x => x.status === 'alive' && x.health >= 35 && !h.incapacitated?.(x))) {
            a.operator.assignment = r.id; r.progress += dt; a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; u.radioSeconds -= dt;
            a.operator.lastOperatingWorkAt = at;
            if (r.progress >= RADIO) { a.operator.assignment = null; d.ceasefire = { at, mandateId: mandate.id };
              u.phase = u.actors.some(x => x.mapCell) ? 'withdrawing' : 'returning'; }
          } else if (a?.operator.assignment === r.id) a.operator.assignment = null;
        }
        if (!u.actors.some(able) && !['withdrawing', 'returning', 'stranded'].includes(u.phase))
          u.phase = u.actors.some(x => x.mapCell) ? 'withdrawing' : 'returning';
        if (['outbound', 'returning'].includes(u.phase)) {
          if (c.routeOpen && u.actors.filter(x => x.status === 'alive').every(x => able(x) && !h.incapacitated?.(x))) {
            const km = Math.min(SPEED * dt, u.phase === 'outbound' ? d.distanceKm - d.positionKm : d.positionKm);
            d.positionKm += u.phase === 'outbound' ? km : -km;
            for (const x of u.actors.filter(x => x.status === 'alive')) x.physicalControl.stamina = Math.max(0, x.physicalControl.stamina - km * 3);
            if (u.phase === 'outbound' && d.positionKm >= d.distanceKm - 1e-8 && h.arrive?.(u, d.link, at)) u.phase = 'deployed';
            if (u.phase === 'returning' && d.positionKm <= 1e-8) {
              u.phase = 'returned'; d.returnedAt = at; u.actors.forEach(x => { if (x.status === 'alive') x.assignment = null; });
            }
          }
        } else if (['deployed', 'withdrawing'].includes(u.phase)) {
          for (const x of u.actors.filter(x => able(x) && !h.incapacitated?.(x))) {
            if (!x.mapCell || x.assignment !== d.id) continue;
            const threat = h.threat?.(u, x, at);
            const q = bound(s, c.quota) ? c.quota : null, v = q?.vehicle;
            const target = threat || (u.phase === 'deployed' && v?.condition >= 50 && v.roomId === x.roomId
              && Wild.distance(x.mapCell, v.mapCell) <= 8 && h.sight?.(x.mapCell, v.mapCell)
              ? { kind: 'structure', id: v.id, cell: v.mapCell } : null);
            if (target && Wild.distance(x.mapCell, target.cell) <= 1 && at >= (x.nextFieldAttackAt || 0) && x.fieldKit.toolCondition > 0) {
              const hit = h.strike?.(x, target);
              if (hit?.ok) { x.fieldKit.toolCondition = Math.max(0, x.fieldKit.toolCondition - 1);
                x.physicalControl.stamina = Math.max(0, x.physicalControl.stamina - 3); d.contacts.push({ at, targetId: target.id, vehicleDamage: hit.vehicleDamage || 0 }); }
              x.nextFieldAttackAt = at + 4;
              if (!h.alive()) return true;
            } else if (at > d.lastMoveAt) {
              const goal = target ? h.adjacent?.(x, target.cell) : u.phase === 'withdrawing' ? d.entry : x.fieldHome;
              if (goal && !same(x.mapCell, goal) && h.move?.(x, goal)) x.physicalControl.stamina = Math.max(0, x.physicalControl.stamina - .1);
            }
          }
          d.lastMoveAt = at;
          if (u.phase === 'withdrawing') {
            for (const x of u.actors.filter(x => x.status === 'alive' && same(x.mapCell, d.entry))) { x.mapCell = null; x.roomId = null; }
            if (u.actors.every(x => x.status === 'dead' || !x.mapCell)) u.phase = 'returning';
          }
        }
      }
    }
    reserve(s, networks); return true;
  }
  function crossing(s, q, from, to) {
    if (!s || s.invalid || !bound(s, q) || q.roadContactId || !['outbound', 'inbound'].includes(q.order?.phase)) return null;
    return s.units.filter(u => u.phase === 'deployed' && u.deployment?.link.cityId === q.source.cityId && u.actors.some(able))
      .map(u => ({ unitId: u.id, meterKm: q.order.phase === 'inbound' ? q.source.distanceKm - u.deployment.link.farmKm : u.deployment.link.farmKm }))
      .filter(c => c.meterKm >= from - 1e-7 && c.meterKm <= to + 1e-7).sort((a, b) => a.meterKm - b.meterKm)[0] || null;
  }
  function contact(s, q, candidate, site, at) {
    const u = s?.units.find(u => u.id === candidate?.unitId);
    if (!u || u.phase !== 'deployed' || q.roadContactId || !bound(s, q) || site?.id !== u.deployment.siteId) return false;
    const id = `${u.deployment.id}:carrier:${q.order.id}:${q.order.phase}`;
    q.roadContactId = id; u.deployment.carrier = { id, orderId: q.order.id, phase: q.order.phase, at, endedAt: null };
    q.vehicle.mapCell = { ...site.entry, x: site.entry.x + 2 }; q.vehicle.roomId = site.roomId;
    q.driver.mapCell = { ...site.entry, x: site.entry.x + 2, y: site.entry.y + 1 }; q.driver.roomId = site.roomId;
    return true;
  }
  function tickCarrier(s, q, at, h) {
    const u = s?.units?.find(u => q.roadContactId && u.deployment?.carrier?.id === q.roadContactId); if (!u) return false;
    const d = u.deployment, threat = s.units.some(t => t.phase === 'deployed' && t.actors.some(x => able(x)
      && x.roomId === q.vehicle.roomId && Wild.distance(x.mapCell, q.vehicle.mapCell) <= 8 && h.sight(x.mapCell, q.vehicle.mapCell)));
    d.clearSeconds = threat || h.otherThreat?.() ? 0 : d.clearSeconds + 1;
    if (d.clearSeconds >= 30 && q.vehicle.condition >= 50 && q.driver.status === 'alive' && q.driver.health >= 50 && !h.incapacitated(q.driver)) {
      d.carrier.endedAt = at; q.roadContactId = null; q.order.encounterReports ||= [];
      q.order.encounterReports.push({ at, description: 'The original carrier encountered an armed field team at the measured supply crossing. The road reopened locally; this is not a worldwide safety account.' });
      q.vehicle.mapCell = q.driver.mapCell = null; q.vehicle.roomId = q.driver.roomId = '';
    }
    return true;
  }
  function observe(s, q, at, canSee) {
    if (!s || s.invalid || !bound(s, q) || !q?.vehicle.mapCell || !canSee(q.vehicle.mapCell)) return false;
    s.reports.push({ id: `network-interdiction:observed:${at}`, at, cityId: q.source.cityId,
      text: `Personally observed original supply truck: ${q.vehicle.condition < 50 ? 'unable to operate' : 'operable'}.`,
      people: s.units.flatMap(u => u.actors.filter(a => a.mapCell && canSee(a.mapCell)).map(a => ({ id: a.id, name: a.name,
        condition: a.status === 'dead' ? 'Physical remains' : a.health < 35 ? 'Incapacitated' : 'Living field professional' }))) });
    return true;
  }
  function beginRepair(s, q, c, at, consume) {
    if (!s || s.invalid || !bound(s, q) || s.repair || !c?.ready || q.vehicle.condition <= 0 || q.vehicle.condition >= 100) return false;
    const inputs = consume(); if (!inputs) return false;
    s.repair = { at, vehicleId: q.vehicle.id, bodyEpoch: c.bodyEpoch, cell: copy(c.cell), progress: 0, inputs: copy(inputs) };
    return true;
  }
  function cancelRepair(s, alive, at) {
    if (!s || s.invalid || !alive || !s.repair) return false;
    s.repair.cancelledAt = at; s.repairs.push(copy(s.repair)); s.repair = null; return true;
  }
  return { PURPOSE, REPORT, RADIO, COST, SPEED, SCOPE, sources, links, routeClear, physicalRouteId, validSource, create, normalize, rebind, sync, reserve,
    advance, crossing, contact, tickCarrier, observe, beginRepair, cancelRepair, able, publicView: s => copy(s?.reports || []) };
});
