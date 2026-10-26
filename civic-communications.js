(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCivicCommunications = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const PURPOSES = Object.freeze(['fuelProcurement', 'technicalGuidance', 'networkCorrespondence', 'receivableFinance', 'partsAssessment']);
  const TERMS = 'Route only the selected civic-service message classes through an original access interface. Authentication identifies the actual issuer and its narrow existing authority; it grants no sovereignty, worship, certification monopoly or power over old documents. Accepted obligations and local work survive outages. No map, remote inventory or hidden-resource report is supplied.';
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const finite = n => Number.isFinite(n) && n >= 0;
  const validSource = r => r && ['id', 'cityId', 'populationSourceId', 'siteId', 'label', 'ownerId'].every(k => typeof r[k] === 'string' && r[k])
    && ['municipal', 'provider'].includes(r.kind) && (r.kind !== 'provider' || r.branchId && r.networkId);
  function sources(map, definitions) {
    const h = map?.strategicNonStateNetworkHistory, sites = map?.strategicCapabilityHistory?.milestoneRows?.flatMap(m => m.infrastructureRows || []) || [];
    const result = [];
    for (const city of map?.strategicPlayableSettlementState?.cityRows || []) {
      if (!city.physicalJurisdictionExists || city.physicalCondition === 'ruined' || city.currentPopulation < 64) continue;
      const site = sites.filter(s => s.cityId === city.cityId && s.operationalAtPlayableYear && s.function === 'orbitalControlGateway').sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!site) continue;
      const g = map.cityGovernments?.governments?.find(g => g.cityId === city.cityId);
      const institutionId = g?.roleAssignments?.publicWorksAndProvisioning;
      const current = map.strategicCivicHistory?.currentInstitutionRows?.find(i => i.institutionId === institutionId);
      if (g?.charter?.id && institutionId && g.institutions?.some(i => i.id === institutionId)
        && current?.actualControlStatus === 'localCharter' && !['displaced', 'disrupted', 'suspended'].includes(current.operationalStatus))
        result.push({ id: `${city.cityId}:original-civic-data-interface`, kind: 'municipal', cityId: city.cityId,
          populationSourceId: city.assetId, siteId: site.id, ownerId: institutionId, charterId: g.charter.id,
          backboneCondition: ({ fragile: 65, strained: 75, serviceable: 85, robust: 100 })[site.hiddenConditionBand] ?? 100,
          label: 'Original municipal uplink', initiallyPowered: city.services?.communications !== 'failed' });
      for (const b of (h?.branchRows || []).filter(b => b.currentCityId === city.cityId && b.publicPhysicalPresence
        && !b.consolidatedIntoBranchId && b.organizationForm === 'orbitalRelayGateway' && b.operationalStatus === 'active'
        && ['licensed', 'chartered'].includes(b.currentStanding) && !['ruined', 'destroyed'].includes(b.physicalCondition)
        && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand))) {
        const n = h.networkRows.find(n => n.networkId === b.networkId), def = definitions?.find(d => d.id === n?.sourceDefinitionId);
        const activated = h.eventRows?.some(e => e.kind === 'advancedServiceActivated' && e.networkIds?.includes(n?.networkId)
          && e.exactFactors?.capabilityId === 'orbitalArcaneRelayMesh');
        if (!n?.organizationalContinuity || ['defunct', 'dormant'].includes(n.lifecycleStatus) || !activated
          || !def?.roles.includes('relayOperations') || !def.orbitalRoles.includes('orbitalRelayOperations')) continue;
        result.push({ id: `${b.id}:original-data-interface`, kind: 'provider', cityId: city.cityId, populationSourceId: city.assetId,
          siteId: site.id, ownerId: b.id, branchId: b.id, networkId: n.networkId, label: b.publicName,
          backboneCondition: ({ fragile: 65, strained: 75, serviceable: 85, robust: 100 })[site.hiddenConditionBand] ?? 100,
          initiallyPowered: city.services?.communications !== 'failed' });
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }
  function create(rows, binding, at) {
    if (!binding?.worldId || !binding.runId || !Array.isArray(rows) || !rows.every(validSource) || !finite(at)
      || new Set(rows.map(r => r.id)).size !== rows.length) return null;
    return { worldId: binding.worldId, runId: binding.runId, sources: copy(rows), ports: rows.map(r => ({ id: r.id, condition: 100, outage: false,
      powerSeconds: r.initiallyPowered ? 14400 : 0, initialPowerSeconds: r.initiallyPowered ? 14400 : 0,
      spentSeconds: 0, usedAt: null, usedThisSecond: 0, assignment: null })), profiles: [], sessions: [],
      backbones: [...new Set(rows.map(r => r.siteId))].map(id => ({ id,
        condition: Math.min(...rows.filter(r => r.siteId === id).map(r => r.backboneCondition ?? 100)), outage: false })),
      serial: 0, origins: [], job: null, lastAt: at, report: null };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !Array.isArray(s.sources) || !s.sources.every(validSource)
      || !Array.isArray(s.ports) || s.ports.length !== s.sources.length || !Array.isArray(s.profiles) || !Array.isArray(s.sessions) || !Array.isArray(s.origins)
      || !Array.isArray(s.backbones) || s.backbones.length !== new Set(s.sources.map(r => r.siteId)).size
      || new Set(s.backbones.map(b => b.id)).size !== s.backbones.length
      || s.backbones.some(b => !s.sources.some(r => r.siteId === b.id) || !finite(b.condition) || b.condition > 100)
      || new Set(s.sources.map(r => r.id)).size !== s.sources.length || new Set(s.ports.map(p => p.id)).size !== s.ports.length
      || new Set(s.profiles.map(p => p.cityId)).size !== s.profiles.length
      || new Set(s.sessions.map(r => r.id)).size !== s.sessions.length || new Set(s.origins.map(r => r.id)).size !== s.origins.length
      || s.ports.some(p => !s.sources.some(r => r.id === p.id) || ![p.condition, p.powerSeconds, p.initialPowerSeconds, p.spentSeconds].every(finite)
        || p.condition > 100 || p.initialPowerSeconds !== (s.sources.find(r => r.id === p.id).initiallyPowered ? 14400 : 0)
        || Math.abs(p.powerSeconds + p.spentSeconds - p.initialPowerSeconds) > 1e-6)
      || s.profiles.some(p => !s.sources.some(r => r.id === p.pathId && r.cityId === p.cityId) || !p.keyId || !p.charterId || !p.handoverId
        || !Array.isArray(p.purposes) || !p.purposes.length || p.purposes.some(k => !PURPOSES.includes(k)))
      || s.sessions.some(r => !r.id || !r.proof || !Number.isInteger(r.through) || r.through < 1 || !finite(r.firstAt) || !finite(r.at)
        || !Array.isArray(r.segments) || !r.segments.length || r.segments.at(-1).through !== r.through
        || r.segments.some((v, i) => !Number.isInteger(v.first) || !Number.isInteger(v.through) || v.through < v.first
          || v.first !== (i ? r.segments[i - 1].through + 1 : 1) || typeof v.keys !== 'string'))
      || s.origins.some(r => !r.id || !Number.isInteger(r.firstSequence) || r.firstSequence < 1)
      || !finite(s.lastAt) || s.job && (!finite(s.job.progress) || s.job.progress > 60)) return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  const row = (s, id) => s.sources.find(r => r.id === id);
  const port = (s, id) => s.ports.find(p => p.id === id);
  const backboneAvailable = (s, r) => { const b = s.backbones.find(b => b.id === r?.siteId); return b && !b.outage && b.condition >= 50; };
  function account(s, networks, r) {
    if (r?.kind !== 'provider') return null;
    const a = networks?.accounts?.find(a => a.id === r.branchId && !a.lost);
    return bound(s, networks) && a?.source.hostId === a.id && a.source.networkId === r.networkId && a.source.cityId === r.cityId
      && a.source.populationSourceId === r.populationSourceId ? a : null;
  }
  function contact(s, rule, c) {
    return s && !s.invalid && bound(s, rule) && c.alive && c.capable && c.local && c.atCounter && c.authority && c.sourceCurrent
      && c.reportersPresent && c.institutionsAvailable && !c.otherBusy && !c.violence && !rule.command && !rule.recharge;
  }
  function begin(s, rule, networks, c, pathId, purposes, rotate, at) {
    if (!contact(s, rule, c) || s.job || rule.operatorServiceAssignment || rule.operatorWorkSeconds < 60
      || !Array.isArray(purposes) || !purposes.length || purposes.some(p => !PURPOSES.includes(p)) || new Set(purposes).size !== purposes.length) return false;
    const r = row(s, pathId), p = r && port(s, pathId), a = r && account(s, networks, r);
    if (!r || !backboneAvailable(s, r) || r.cityId !== rule.source.cityId || r.populationSourceId !== rule.source.populationSourceId
      || r.kind === 'municipal' && (r.charterId !== rule.source.charterId || !rule.source.institutions.some(i => i.id === r.ownerId))
      || !p || p.assignment || p.outage || p.condition < 50 || p.powerSeconds < 60
      || r.kind === 'provider' && (!a || a.operator.status !== 'alive' || a.operator.assignment || a.operator.workSeconds < 60
        || a.terminal.powerSeconds < 60 || !a.source.charter.scope.includes('ownNewContracts'))) return false;
    const id = `civic-path:${++s.serial}`;
    s.job = { id, pathId, purposes: copy(purposes), rotate: Boolean(rotate), at, progress: 0, cell: copy(c.cell),
      charterId: rule.source.charterId, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch,
      providerCharterId: a?.source.charter.id || null, cityId: rule.source.cityId };
    rule.operatorServiceAssignment = p.assignment = id; if (a) a.operator.assignment = id;
    return true;
  }
  function release(s, rule, networks) {
    const j = s?.job; if (!j) return false;
    const p = port(s, j.pathId), a = account(s, networks, row(s, j.pathId));
    if (p?.assignment === j.id) p.assignment = null;
    if (a?.operator.assignment === j.id) a.operator.assignment = null;
    if (rule.operatorServiceAssignment === j.id) rule.operatorServiceAssignment = null;
    s.job = null; return true;
  }
  function advance(s, rule, networks, context, to) {
    if (!s || s.invalid || !bound(s, rule) || !context().alive || to <= s.lastAt) return false;
    if (!s.job) { s.lastAt = to; return false; }
    while (s.lastAt < to && s.job) {
      const at = s.lastAt + Math.min(1, to - s.lastAt), dt = at - s.lastAt; s.lastAt = at;
      const j = s.job, c = context(), r = row(s, j.pathId), p = port(s, j.pathId), a = account(s, networks, r);
      if (!c.alive) return false;
      if (!contact(s, rule, c) || !['x', 'y', 'z'].every(k => c.cell[k] === j.cell[k]) || c.bodyEpoch !== j.bodyEpoch
        || rule.handoverId !== j.handoverId || rule.source.charterId !== j.charterId || rule.operatorServiceAssignment !== j.id
        || !p || !backboneAvailable(s, r) || p.assignment !== j.id || p.outage || p.condition < 50 || p.powerSeconds < dt || rule.operatorWorkSeconds < dt
        || r.kind === 'provider' && (!a || a.operator.status !== 'alive' || a.operator.assignment !== j.id
          || a.source.charter.id !== j.providerCharterId || !a.source.charter.scope.includes('ownNewContracts')
          || a.operator.workSeconds < dt || a.terminal.powerSeconds < dt)) { release(s, rule, networks); break; }
      if (rule.operatorWorkedUntil >= at || a?.operator.lastOperatingWorkAt >= at) continue;
      rule.operatorWorkSeconds -= dt; rule.operatorWorkedUntil = at; p.powerSeconds -= dt; p.spentSeconds += dt;
      if (a) { a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; a.operator.lastOperatingWorkAt = at; }
      j.progress += dt;
      if (j.progress >= 60) {
        const old = s.profiles.find(p => p.cityId === j.cityId);
        const sameAuthority = old?.charterId === j.charterId && old.handoverId === j.handoverId && old.bodyEpoch === j.bodyEpoch;
        const profile = { id: j.id, cityId: j.cityId, pathId: j.pathId, purposes: copy(j.purposes), charterId: j.charterId,
          handoverId: j.handoverId, bodyEpoch: j.bodyEpoch, at,
          keyId: sameAuthority && !j.rotate ? old.keyId : `${j.cityId}:civic-service-key:${++s.serial}` };
        if (old) Object.assign(old, profile); else s.profiles.push(profile);
        release(s, rule, networks); receive(s, rule, c, at);
      }
    }
    if (!s.job) s.lastAt = to;
    register(s, networks); return true;
  }
  function transfer(s, networks, packet, at) {
    if (!s || s.invalid || !bound(s, packet) || !finite(at) || !PURPOSES.includes(packet.purpose)
      || !packet.sessionId || !packet.fromCityId || !packet.toCityId || !Number.isInteger(packet.sequence) || packet.sequence < 1) return false;
    const endpoints = packet.civicCityIds || [packet.fromCityId];
    if (!Array.isArray(endpoints) || endpoints.some(id => ![packet.fromCityId, packet.toCityId].includes(id))) return false;
    // Only the actual municipal endpoint is enrolled. A city's routing choice
    // does NOT seize an independent branch's private connection in that city.
    const profiles = [...new Set(endpoints)].map(id => s.profiles.find(p => p.cityId === id && p.purposes.includes(packet.purpose))).filter(Boolean);
    // Unenrolled links retain their ORIGINAL consumer constraints. This is
    // neither proof of independent orbital capacity nor an invented provider.
    if (profiles.length && packet.signer === 'city') {
      const p = s.profiles.find(p => p.cityId === packet.fromCityId);
      if (!p || packet.charterId !== p.charterId || packet.handoverId !== p.handoverId || packet.bodyEpoch !== p.bodyEpoch) return false;
    } else if (profiles.length && packet.signer === 'branch') {
      const a = networks?.accounts?.find(a => a.id === packet.senderId && !a.lost);
      if (!bound(s, networks) || !a || a.source.cityId !== packet.fromCityId || a.source.charter.id !== packet.charterId) return false;
    } else if (profiles.length) return false;
    const id = `${packet.purpose}:${packet.senderId || packet.signer}:${packet.sessionId}`;
    const proof = JSON.stringify([packet.purpose, packet.fromCityId, packet.toCityId, packet.signer, packet.senderId,
      packet.charterId, packet.handoverId, packet.bodyEpoch, endpoints]);
    const keys = JSON.stringify(packet.keys || {});
    const session = s.sessions.find(r => r.id === id);
    if (session && session.proof !== proof) return false;
    if (session && packet.sequence <= session.through)
      return session.segments.some(r => r.first <= packet.sequence && r.through >= packet.sequence && r.keys === keys);
    if (packet.sequence !== (session?.through || 0) + 1) return false;
    const ports = [];
    for (const profile of profiles) {
      if (!profile.purposes.includes(packet.purpose) || packet.keys?.[profile.cityId] !== profile.keyId || at <= profile.at) return false;
      const r = row(s, profile.pathId), p = port(s, profile.pathId), a = r && account(s, networks, r);
      if (!p || !backboneAvailable(s, r) || p.assignment || p.outage || p.condition < 50 || p.powerSeconds < 1 || p.usedAt > at
        || p.usedAt === at && p.usedThisSecond >= 4
        || r.kind === 'provider' && (!a || a.operator.status !== 'alive')) return false;
      ports.push(p);
    }
    // Atomic reservation: an unusable receiving path spends no sending power.
    for (const p of ports) { p.usedThisSecond = p.usedAt === at ? p.usedThisSecond + 1 : 1; p.usedAt = at; p.powerSeconds--; p.spentSeconds++; }
    const received = session || { id, proof, purpose: packet.purpose, fromCityId: packet.fromCityId, toCityId: packet.toCityId,
      firstAt: at, at, through: 0, segments: [] };
    const segment = received.segments.at(-1);
    if (segment?.keys === keys) segment.through = packet.sequence;
    else received.segments.push({ keys, first: packet.sequence, through: packet.sequence });
    received.through = packet.sequence; received.at = at;
    if (!session) s.sessions.push(received);
    return true;
  }
  function packet(s, binding, data) {
    const endpoints = data.civicCityIds || [data.fromCityId];
    const keys = Object.fromEntries((s?.profiles || []).filter(p => endpoints.includes(p.cityId) && p.purposes.includes(data.purpose)).map(p => [p.cityId, p.keyId]));
    const id = `${data.purpose}:${data.senderId || data.signer}:${data.sessionId}`;
    // The transport begins observing an existing consumer at its actual
    // current unit, never inventing acknowledgements for earlier work.
    let origin = s && !s.invalid && s.origins.find(r => r.id === id);
    if (s && !s.invalid && !origin && Number.isInteger(data.sequence) && data.sequence > 0)
      s.origins.push(origin = { id, firstSequence: data.sequence });
    return { worldId: binding?.worldId, runId: binding?.runId, ...copy(data), sequence: origin ? data.sequence - origin.firstSequence + 1 : data.sequence, keys };
  }
  function receive(s, rule, c, at) {
    if (!contact(s, rule, c) || s.job) return false;
    const p = s.profiles.find(p => p.cityId === rule.source.cityId);
    s.report = { at, cityId: rule.source.cityId, pathLabel: p ? row(s, p.pathId)?.label : 'No new routing agreement adopted',
      adoptedAt: p?.at ?? null, purposes: copy(p?.purposes || []),
      acknowledgements: s.sessions.filter(r => [r.fromCityId, r.toCityId].includes(rule.source.cityId))
        .map(r => ({ purpose: r.purpose, firstAt: r.firstAt, at: r.at, receivedUnits: r.through })), terms: TERMS };
    return true;
  }
  function register(s, networks) {
    if (!s || s.invalid) return;
    for (const r of s.sources.filter(r => r.kind === 'provider')) {
      const a = account(s, networks, r); if (!a) continue;
      let allocation = a.allocations.find(a => a.id === r.id);
      if (!allocation) a.allocations.push(allocation = { id: r.id, kind: 'civicRelayAccess', interfaceId: r.id,
        siteId: r.siteId, scope: 'One original access interface into existing shared orbital infrastructure, not ownership of the constellation or civic authority.' });
      allocation.contractId = s.profiles.find(p => p.pathId === r.id)?.id || null;
      allocation.assignment = port(s, r.id)?.assignment || null;
    }
  }
  return { PURPOSES, TERMS, bound, sources, create, normalize, rebind, begin, release, advance, packet, transfer, receive, register,
    active: s => Boolean(s && !s.invalid && s.job), publicView: s => copy(s?.report) };
});
