(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const healthy = a => a?.status === 'alive' && a.health >= 50 && !a.incapacitated && !a.hostile;
  const functional = s => ['functional', 'strong', 'exceptional'].includes(s);
  const ROLES = ['centralAdministration', 'civicReview', 'civilWatch', 'publicWorksAndProvisioning', 'militaryDefenseCommand'];
  const KEYS = ['metalParts', 'preparedManaCrystals', 'fieldRation', 'drinkingWater'];
  const current = (s, at) => Number.isFinite(at) && at >= s.lastAt;
  function sourceFromWorld(map, cityId) {
    const city = map?.strategicPlayableSettlementState?.cityRows.find(r => r.cityId === cityId);
    const g = map?.cityGovernments?.governments.find(g => g.cityId === cityId);
    if (!g || !city?.physicalJurisdictionExists || city.currentPopulation < 16 || city.physicalCondition === 'ruined') return null;
    const institutions = map.strategicCivicHistory.currentInstitutionRows.filter(r => ROLES.some(role => g.roleAssignments[role] === r.institutionId));
    const satellites = map.strategicPlayableSettlementState.satelliteRows.filter(r => r.parentId === cityId && r.function === 'agriculture');
    const sites = map.strategicCapabilityHistory.milestoneRows.flatMap(m => m.infrastructureRows || []).filter(r => r.cityId === cityId && ['powerWorks', 'fortifiedWorks'].includes(r.function));
    const crew = Math.max(1, Math.floor(city.currentPopulation / 200));
    const projects = [];
    const add = (kind, targetId, severity, role = null) => {
      const parts = Math.ceil(city.currentPopulation / 250) * severity;
      projects.push({ id: `${cityId}:recovery:${targetId}`, kind, targetId, role, seconds: 7200 * severity,
        costs: { metalParts: parts, preparedManaCrystals: Math.max(1, Math.ceil(parts / 10)), fieldRation: crew, drinkingWater: crew } });
    };
    if (city.physicalCondition !== 'intact' || ['utilities', 'provisioning', 'transport', 'fortifications'].some(k => !functional(city.services[k]))) add('cityInfrastructure', city.assetId, city.physicalCondition === 'damaged' ? 3 : 1);
    for (const i of institutions) if (i.operationalStatus === 'disrupted' || !functional(i.currentCapacityBand)) {
      // Suspension, exile and changed appointments are political conditions,
      // never repaired into obedience by buying construction materials.
      if (['suspended', 'displaced'].includes(i.operationalStatus)) continue;
      add('institutionRecovery', i.institutionId, 1, ROLES.find(role => g.roleAssignments[role] === i.institutionId));
    }
    for (const s of satellites) if (s.currentPopulation >= 8 && s.physicalCondition !== 'ruined'
      && (s.physicalCondition !== 'intact' || !s.localRouteUsable || !functional(s.services.provisioning) || !functional(s.services.transport))) add('satelliteInfrastructure', s.assetId, s.physicalCondition === 'damaged' ? 2 : 1);
    return { id: `${cityId}:original-recovery-sources`, cityId, charterId: g.charter.id, populationSourceId: city.assetId,
      population: city.currentPopulation, crew, worksInstitutionId: g.roleAssignments.publicWorksAndProvisioning,
      defenseInstitutionId: g.roleAssignments.militaryDefenseCommand, projects,
      baseline: { city: copy(city), institutions: copy(institutions), satellites: copy(satellites), sites: copy(sites) } };
  }
  function validSource(s) {
    return Boolean(s?.id && s.cityId && s.charterId && s.populationSourceId && s.worksInstitutionId && s.defenseInstitutionId
      && Number.isSafeInteger(s.population) && s.population >= 16 && Number.isSafeInteger(s.crew)
      && s.crew === Math.max(1, Math.floor(s.population / 200))
      && s.crew + 8 <= s.population && s.baseline?.city?.assetId === s.populationSourceId
      && ['institutions', 'satellites', 'sites'].every(k => Array.isArray(s.baseline[k]))
      && Array.isArray(s.projects) && new Set(s.projects.map(p => p.id)).size === s.projects.length
      && s.projects.every(p => p.id && p.targetId && ['cityInfrastructure', 'institutionRecovery', 'satelliteInfrastructure'].includes(p.kind)
        && Number.isSafeInteger(p.seconds) && p.seconds > 0 && p.seconds <= 21600
        && KEYS.every(k => Number.isSafeInteger(p.costs[k]) && p.costs[k] > 0)));
  }
  function create(source, b, at) {
    if (!validSource(source) || !b?.worldId || !b.runId || !Number.isFinite(at) || at < 0) return null;
    return { worldId: b.worldId, runId: b.runId, id: source.id, source: copy(source), lastAt: at, serial: 0, job: null,
      crew: Array.from({length: source.crew}, (_, n) => ({ id: `${source.cityId}:original-recovery-worker:${n+1}`,
        name: `Original municipal recovery worker ${n+1}`, actorKind: 'civicOfficeholder', institutionId: source.worksInstitutionId,
        roles: ['municipalInfrastructureRecovery'], status: 'alive', health: 100, maxHealth: 100, fatigue: 0,
        workSeconds: 28800, assignment: null })),
      stores: Object.fromEntries(KEYS.map(k => [k, 0])), received: [], spent: Object.fromEntries(KEYS.map(k => [k, 0])), completed: [], rested: [], report: null };
  }
  const local = (s, c) => Boolean(c.alive && c.capable && c.local && c.atCounter && c.clerkPresent && c.free && c.permission && !c.violence
    && c.sourceCurrent && c.authority && c.cityId === s.source.cityId && c.worksAvailable);
  function outstanding(s, key) {
    const pending = s.source.projects.filter(p => !s.completed.some(r => r.projectId === p.id) && s.job?.projectId !== p.id);
    let shifts = 0, work = Math.min(...s.crew.map(a => a.workSeconds));
    for (const p of pending) { if (p.seconds > work) { shifts++; work = 28800; } work -= p.seconds; }
    const rest = ['fieldRation', 'drinkingWater'].includes(key) ? shifts * s.crew.length : 0;
    return pending.reduce((n, p) => n + p.costs[key], 0) + rest;
  }
  function stage(s, c, stacks, key, at) {
    if (!KEYS.includes(key) || !local(s, c) || !current(s, at)) return false;
    const item = stacks.find(i => i.key === key && i.quantity > 0 && i.carriedBy === 'scientist' && !i.reservedTaskId
      && !i.cityOwnerId && !i.civicCustody && !i.fixtureId && !i.containerId && !i.carryTaskId && !i.contents?.length
      && (!i.ownerId || i.ownerId === 'scientist') && (!i.legalOwnerId || i.legalOwnerId === 'scientist')
      && !i.tags?.some(t => /contaminated|stolen/i.test(t)));
    const needed = Math.max(0, outstanding(s, key) - s.stores[key]);
    if (!item || !needed) return false;
    const quantity = Math.min(needed, item.quantity); item.quantity -= quantity;
    item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity);
    s.stores[key] += quantity; s.received.push({ id: `${s.id}:delivery:${++s.serial}`, key, quantity, stackId: item.id, at });
    receive(s, c, at); return true;
  }
  function begin(s, c, at) {
    if (!local(s, c) || !current(s, at) || !Number.isSafeInteger(c.bodyEpoch) || c.bodyEpoch < 0
      || s.job || s.crew.some(a => !healthy(a) || a.assignment)) return false;
    const p = s.source.projects.find(p => !s.completed.some(r => r.projectId === p.id));
    if (!p || !c.defenseAvailable) return false;
    const rest = s.crew.some(a => a.workSeconds < p.seconds);
    const inputs = rest ? { metalParts: 0, preparedManaCrystals: 0, fieldRation: s.crew.length, drinkingWater: s.crew.length } : p.costs;
    if (KEYS.some(k => s.stores[k] < inputs[k])) return false;
    for (const k of KEYS) { s.stores[k] -= inputs[k]; s.spent[k] += inputs[k]; }
    s.job = { id: `${s.id}:work:${++s.serial}`, kind: rest ? 'suppliedRest' : 'repair', projectId: rest ? null : p.id,
      seconds: rest ? 57600 : p.seconds, progress: 0, lastAt: at, bodyEpoch: c.bodyEpoch,
      wasReady: true, inputs: copy(inputs) };
    for (const a of s.crew) a.assignment = s.job.id;
    receive(s, c, at); return true;
  }
  function advance(s, c, at) {
    if (!s || !c.alive || at < s.lastAt) return false;
    s.lastAt = at; const j = s.job; if (!j) return false;
    const elapsed = at - j.lastAt; j.lastAt = at;
    const p = s.source.projects.find(p => p.id === j.projectId);
    const rest = j.kind === 'suppliedRest';
    const ready = (p || rest) && c.sourceCurrent && c.authority && c.worksAvailable && c.defenseAvailable && !c.violence
      && c.bodyEpoch === j.bodyEpoch && s.crew.every(a => healthy(a) && a.assignment === j.id);
    // Orders dispatch original local workers; scientist attendance is required
    // for delivery/dispatch, not throughout an autonomous supplied repair.
    if (!ready) { j.wasReady = false; return false; }
    if (!j.wasReady) { j.wasReady = true; return false; }
    const work = Math.max(0, Math.min(elapsed, j.seconds - j.progress, rest ? Infinity : Math.min(...s.crew.map(a => a.workSeconds))));
    j.progress += work; if (!rest) for (const a of s.crew) a.workSeconds -= work;
    if (j.progress >= j.seconds) {
      if (rest) { s.rested.push({ id: j.id, at: at - elapsed + work, inputs: copy(j.inputs) }); for (const a of s.crew) a.workSeconds = 28800; }
      else s.completed.push({ id: j.id, projectId: p.id, at: at - elapsed + work, targetId: p.targetId,
        workerIds: s.crew.map(a => a.id), workerSeconds: p.seconds * s.crew.length, inputs: copy(j.inputs) });
      for (const a of s.crew) a.assignment = null; s.job = null;
    }
    return work > 0;
  }
  function receive(s, c, at) {
    if (!local(s, c) || !current(s, at)) return false;
    s.report = { at, cityId: s.source.cityId, completed: copy(s.completed), job: copy(s.job), stores: copy(s.stores),
      projects: copy(s.source.projects), limits: 'Actual local recovery only. No authority, stock, staff replacement, ruined-city resurrection or domination award.' }; return true;
  }
  function projectMap(map, s, b) {
    if (!s || !bound(s, b) || !validSource(s.source) || JSON.stringify(sourceFromWorld(map, s.source.cityId)) !== JSON.stringify(s.source)) return map;
    const done = kind => s.source.projects.filter(p => p.kind === kind && s.completed.some(r => r.projectId === p.id
      && r.workerSeconds === p.seconds * s.crew.length && KEYS.every(k => r.inputs?.[k] === p.costs[k] && s.spent[k] >= p.costs[k]))).map(p => p.targetId);
    const cityDone = done('cityInfrastructure'), officeDone = done('institutionRecovery'), satelliteDone = done('satelliteInfrastructure');
    const next = { ...map, strategicPlayableSettlementState: { ...map.strategicPlayableSettlementState }, strategicCivicHistory: { ...map.strategicCivicHistory } };
    next.strategicPlayableSettlementState.cityRows = map.strategicPlayableSettlementState.cityRows.map(r => !cityDone.includes(r.assetId) ? r
      : { ...r, physicalCondition: 'intact', services: { ...r.services, ...Object.fromEntries(['utilities', 'provisioning', 'transport', 'fortifications'].map(k => [k, functional(r.services[k]) ? r.services[k] : 'functional'])) } });
    next.strategicPlayableSettlementState.satelliteRows = map.strategicPlayableSettlementState.satelliteRows.map(r => !satelliteDone.includes(r.assetId) ? r
      : { ...r, physicalCondition: 'intact', localRouteUsable: true, services: { ...r.services, provisioning: 'functional', transport: 'functional' } });
    next.strategicCivicHistory.currentInstitutionRows = map.strategicCivicHistory.currentInstitutionRows.map(r => !officeDone.includes(r.institutionId) ? r
      : { ...r, operationalStatus: 'operational', currentCapacityBand: functional(r.currentCapacityBand) ? r.currentCapacityBand : 'functional' });
    return next;
  }
  function normalize(s) {
    if (s == null) return null;
    if (!s.worldId || !s.runId || !validSource(s.source) || !Number.isFinite(s.lastAt) || s.lastAt < 0
      || !Number.isSafeInteger(s.serial) || s.serial < 0 || !Array.isArray(s.crew) || s.crew.length !== s.source.crew
      || s.crew.some((a, n) => a.id !== `${s.source.cityId}:original-recovery-worker:${n+1}` || !Number.isFinite(a.workSeconds) || a.workSeconds < 0 || a.workSeconds > 28800)
      || !Array.isArray(s.received) || s.received.some(r => !KEYS.includes(r.key) || !Number.isSafeInteger(r.quantity) || r.quantity <= 0 || !r.stackId || !Number.isFinite(r.at) || r.at < 0)
      || !Array.isArray(s.completed) || !Array.isArray(s.rested) || new Set(s.completed.map(r => r.projectId)).size !== s.completed.length
      || s.rested.some(r => !r.id || !Number.isFinite(r.at) || r.at < 0 || KEYS.some(k => r.inputs?.[k] !== (['fieldRation', 'drinkingWater'].includes(k) ? s.crew.length : 0)))
      || s.completed.some(r => !s.source.projects.some(p => p.id === r.projectId && r.workerSeconds === p.seconds * s.crew.length
        && KEYS.every(k => r.inputs?.[k] === p.costs[k])) || !Number.isFinite(r.at) || r.at < 0)
      || KEYS.some(k => !Number.isSafeInteger(s.stores?.[k]) || s.stores[k] < 0 || !Number.isSafeInteger(s.spent?.[k]) || s.spent[k] < 0
        || s.received.filter(r => r.key === k).reduce((n, r) => n + r.quantity, 0) !== s.stores[k] + s.spent[k]
        || [...s.completed, ...s.rested, ...(s.job ? [s.job] : [])].reduce((n, r) => n + (r.inputs?.[k] ?? NaN), 0) !== s.spent[k])
      || s.job && (!(s.job.kind === 'suppliedRest' && s.job.projectId === null && s.job.seconds === 57600
          || s.job.kind === 'repair' && s.source.projects.some(p => p.id === s.job.projectId && p.seconds === s.job.seconds))
        || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress >= s.job.seconds
        || !Number.isFinite(s.job.lastAt) || s.job.lastAt < 0 || !Number.isSafeInteger(s.job.bodyEpoch))) return null;
    return copy(s);
  }
  return { KEYS, sourceFromWorld, validSource, create, stage, begin, advance, receive, projectMap, normalize, bound };
});
