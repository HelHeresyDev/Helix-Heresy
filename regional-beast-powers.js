(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRegionalBeastPowers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const str = x => typeof x === 'string' ? x.slice(0, 1200) : '';
  const date = x => Number.isFinite(x) && x >= 0;
  const strings = xs => [...new Set((Array.isArray(xs) ? xs : []).filter(x => str(x) === x && x))];
  const SECONDS = 180;
  const LIMITS = 'Dated evidence, not live surveillance. Potential regional pressure is not an attack in progress, proof of intent or inevitable city defeat. No detailed maps, exact populations, hidden lairs, travel rights, force allocation or resolution credit.';
  function report(x) {
    if (!str(x?.id) || !str(x.cityId) || !str(x.speciesId) || !str(x.speciesName)
      || !['dangerous', 'catastrophic'].includes(x.severity)) return null;
    return { id: str(x.id), cityId: str(x.cityId), cityName: str(x.cityName), speciesId: str(x.speciesId), speciesName: str(x.speciesName),
      source: str(x.source), sourceAt: date(x.sourceAt) ? x.sourceAt : null, significance: str(x.significance),
      severity: x.severity, confidence: str(x.confidence), reportedCause: str(x.reportedCause), recurrence: str(x.recurrence),
      warningSigns: strings(x.warningSigns), capability: str(x.capability), socialPattern: str(x.socialPattern),
      corridorLabels: strings(x.corridorLabels) };
  }
  // Select a real population-backed, physically routed settlement-scale threat.
  // Matching public warnings is deliberately conservative; no report is fabricated
  // for worlds without these records. Multiple plausible populations stay private.
  function sourceFromWorld(map, cityId) {
    const city = map?.humanGeography?.cities?.find(c => c.id === cityId), ecology = map?.beastEcology;
    if (!city || !ecology) return null;
    for (const warning of [...(map.publicBeastAtlas?.waveWarnings || [])].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!warning.threatenedCityIds?.includes(cityId) || !['dangerous', 'catastrophic'].includes(warning.severityBand)) continue;
      const definition = ecology.species?.find(s => s.id === warning.speciesId);
      if (!definition || !(definition.threatRank >= 3)) continue;
      const profiles = (ecology.waveProfiles || []).filter(p => {
        const population = ecology.populations?.find(row => row.id === p.populationId);
        return population?.speciesId === definition.id && population.populationIndex > 0 && population.territory?.rangeCellCount > 0
          && p.threatenedCityIds?.includes(cityId) && p.cellPath?.length >= 2 && p.distanceKm > 0
          && p.severityBand === warning.severityBand;
      });
      if (!profiles.length) continue;
      return { populationIds: strings(profiles.map(p => p.populationId)), profileIds: strings(profiles.map(p => p.id)),
        report: report({ id: `regional-pressure:${cityId}:${warning.id}`, cityId, cityName: city.name || cityId,
          speciesId: definition.id, speciesName: definition.name, source: 'Municipal released beast-pressure account', sourceAt: null,
          significance: 'A population-backed settlement-scale wave capability has a physically feasible approach to this city. It could disrupt defended approaches and regional support; present defenses and an active attack are not established.',
          severity: warning.severityBand, confidence: warning.confidence, reportedCause: warning.reportedCause,
          recurrence: warning.recurrenceBand, warningSigns: warning.warningSigns,
          capability: definition.description, socialPattern: definition.socialPattern,
          corridorLabels: (map.routeGraph?.routes || []).filter(r => warning.threatenedCorridorIds?.includes(r.id)
            && r.endpointIds?.includes(cityId)).map(r => r.label || r.name || 'An adjoining city support corridor') }) };
    }
    return null;
  }
  function create(binding) { return { worldId: binding.worldId, runId: binding.runId, dossiers: [], objective: null, job: null, serial: 0, message: '' }; }
  function observation(x) {
    if (!str(x?.id) || !str(x.speciesId) || !date(x.observedAt) || !str(x.siteId)) return null;
    return { id: str(x.id), speciesId: str(x.speciesId), name: str(x.name), observedAt: x.observedAt, siteId: str(x.siteId),
      condition: str(x.condition), cell: x.cell && ['x', 'y', 'z'].every(k => Number.isInteger(x.cell[k])) ? { x: x.cell.x, y: x.cell.y, z: x.cell.z } : null,
      association: 'Same species only; membership in the reported regional population is unconfirmed.' };
  }
  function normalize(value) {
    if (!str(value?.worldId) || !str(value.runId)) return null;
    const s = create(value); s.serial = Number.isSafeInteger(value.serial) && value.serial >= 0 ? value.serial : 0; s.message = str(value.message);
    for (const d of Array.isArray(value.dossiers) ? value.dossiers : []) {
      const r = report(d?.report);
      if (!r || !date(d.receivedAt) || s.dossiers.some(row => row.report.id === r.id)) continue;
      s.dossiers.push({ report: r, receivedAt: d.receivedAt, issuerId: str(d.issuerId), clerkId: str(d.clerkId),
        populationIds: strings(d.populationIds), profileIds: strings(d.profileIds),
        observations: (Array.isArray(d.observations) ? d.observations : []).map(observation).filter(o => o && o.speciesId === r.speciesId) });
    }
    const j = value.job, r = report(j?.report);
    if (r && str(j.id) && str(j.officeId) && str(j.institutionId) && str(j.clerkId) && str(j.placeId)
      && Number.isSafeInteger(j.bodyEpoch) && j.bodyEpoch >= 0 && date(j.lastAt) && date(j.progress) && j.progress < SECONDS)
      s.job = { id: str(j.id), officeId: str(j.officeId), institutionId: str(j.institutionId), clerkId: str(j.clerkId), placeId: str(j.placeId),
        bodyEpoch: j.bodyEpoch, lastAt: j.lastAt, progress: j.progress, wasReady: j.wasReady === true,
        report: r, populationIds: strings(j.populationIds), profileIds: strings(j.profileIds) };
    if (s.dossiers.some(d => d.report.id === value.objective?.id) && date(value.objective?.at)) s.objective = { id: value.objective.id, at: value.objective.at, purpose: 'investigate' };
    return s;
  }
  const present = (office, c) => Boolean(c?.alive && c.capable && c.atCounter && c.clerkPresent && c.lineOfSight && c.visitPermission
    && c.serviceAvailable !== false && c.cityId === office?.cityId && str(c.placeId));
  const ready = o => Boolean(o?.active && o.channelPowered && o.maintenanceReady !== false && o.clerk?.status === 'alive'
    && o.clerk.health >= 50 && (o.clerk.fatigue || 0) < 80 && o.clerk.locationId === o.id);
  function request(s, source, office, c, at) {
    const r = report(source?.report);
    if (!s || !date(at) || !r || r.cityId !== office?.cityId || !source.populationIds?.length || !source.profileIds?.length
      || s.job || s.dossiers.some(d => d.report.id === r.id) || !present(office, c) || !ready(office)
      || !Number.isSafeInteger(c.bodyEpoch) || c.bodyEpoch < 0 || c.busy || office.assignment || office.power < 1 || office.workSeconds < SECONDS || at < (office.availableAt || 0)) return false;
    const id = `beast-account:${s.runId}:${++s.serial}`;
    s.job = { id, officeId: office.id, institutionId: office.institutionId, clerkId: office.clerk.id, placeId: c.placeId,
      bodyEpoch: c.bodyEpoch, lastAt: at, progress: 0, wasReady: true, report: r,
      populationIds: strings(source.populationIds), profileIds: strings(source.profileIds) };
    office.assignment = id; office.power--; s.message = 'Preparing one narrow safety account. Remain at the existing counter for three minutes. No fee, wider archive or map access is granted.';
    return true;
  }
  function release(office, job, at) { if (office?.assignment === job.id) { office.assignment = null; office.availableAt = at; } }
  function cancel(s, office, at) {
    if (!s?.job) return false;
    release(office, s.job, at); s.job = null; s.message = 'Unfinished account cancelled; spent power and work remain spent. Received dossiers remain yours.'; return true;
  }
  function advance(s, office, c, at) {
    const j = s?.job; if (!j || !date(at) || at < j.lastAt || !c?.alive) return false;
    if (!c.capable || !c.atCounter || !c.visitPermission || c.cityId !== j.report.cityId || c.placeId !== j.placeId || c.bodyEpoch !== j.bodyEpoch) return cancel(s, office, at);
    const available = office?.id === j.officeId && office.institutionId === j.institutionId && office.clerk?.id === j.clerkId
      && present(office, c) && ready(office) && !c.busy && (!office.assignment || office.assignment === j.id) && office.workSeconds > 0;
    if (!available) { release(office, j, at); j.lastAt = at; j.wasReady = false; s.message = 'Account paused: original staff, service or capacity unavailable. No absent work accrues.'; return false; }
    office.assignment = j.id;
    const start = Math.max(j.lastAt, office.availableAt || 0), work = j.wasReady ? Math.min(SECONDS - j.progress, Math.max(0, at - start), office.workSeconds) : 0;
    office.workSeconds -= work; j.progress += work; j.lastAt = at; j.wasReady = true;
    if (j.progress + 1e-8 < SECONDS) return false;
    s.dossiers.push({ report: copy(j.report), populationIds: [...j.populationIds], profileIds: [...j.profileIds], receivedAt: start + work,
      issuerId: j.institutionId, clerkId: j.clerkId, observations: [] });
    release(office, j, start + work); s.job = null; s.message = 'Dated regional pressure account received. Its source date is unknown; current aggression and the full population remain unverified.'; return true;
  }
  function observe(s, sighting, siteId, alive = true) {
    if (!s || !alive) return false;
    const o = observation({ ...sighting, siteId }); if (!o) return false;
    let changed = false;
    for (const d of s.dossiers.filter(d => d.report.speciesId === o.speciesId)) {
      const previous = d.observations.findIndex(row => row.id === o.id);
      if (previous >= 0 && d.observations[previous].observedAt >= o.observedAt) continue;
      if (previous < 0) d.observations.push(o); else d.observations[previous] = o;
      changed = true;
    }
    return changed;
  }
  function select(s, id, at, capable = true) {
    if (!s || !capable || !date(at) || id !== null && !s.dossiers.some(d => d.report.id === id)) return false;
    s.objective = id === null ? null : { id, at, purpose: 'investigate' }; return true;
  }
  function publicView(value) {
    const s = normalize(value); if (!s) return null;
    return { dossiers: s.dossiers.map(d => ({ report: copy(d.report), receivedAt: d.receivedAt, observations: copy(d.observations) })),
      objective: s.objective, working: Boolean(s.job), message: s.message, limitations: LIMITS };
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && str(to?.worldId) && str(to?.runId)
      ? normalize({ ...s, worldId: to.worldId, runId: to.runId }) : s;
  }
  return { SECONDS, LIMITS, sourceFromWorld, create, normalize, request, advance, cancel, observe, select, publicView, rebind };
});
