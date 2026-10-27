(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./powerworks-maintenance') : root.HelixPowerworksMaintenance,
    node ? require('./powerworks-standards') : root.HelixPowerworksStandards,
    node ? require('./municipal-fuel-service') : root.HelixMunicipalFuelService);
  if (node) module.exports = api;
  if (root) root.HelixCityServices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Maintenance, Standards, Fuel) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  function entries(run) {
    const result = [];
    if (run.cityRule) result.push({ rule: run.cityRule, owner: run, regional: false });
    for (const gate of run.penalFlights?.assistance?.cityApproach?.gates || []) if (gate.regionalGovernment?.rule)
      result.push({ rule: gate.regionalGovernment.rule, owner: gate.regionalGovernment.services || {}, regional: true, gate });
    return result;
  }
  function ensure(run, binding) {
    if (!run.cityServicesInitialized) {
      run.cityServicesInitialized = true;
      run.cityServices ||= { ...binding, assets: [], originals: [], conflict: false };
    }
    return bound(run.cityServices, binding) && !run.cityServices.invalid
      && Array.isArray(run.cityServices.assets) && Array.isArray(run.cityServices.originals) ? run.cityServices : null;
  }
  function normalize(pool) {
    if (!pool || pool.invalid || !pool.worldId || !pool.runId || !Array.isArray(pool.assets) || !Array.isArray(pool.originals)
      || !pool.assets.every(a => a && a.id && a.value?.id === a.id && ['technician', 'reviewer', 'bench'].includes(a.kind))
      || new Set(pool.assets.map(a => a.id)).size !== pool.assets.length || new Set(pool.originals).size !== pool.originals.length)
      return { worldId: pool?.worldId || '', runId: pool?.runId || '', invalid: true };
    return copy(pool);
  }
  function lost(id, kind) { return { id, status: 'unknown', health: 0, condition: 0, workSeconds: 0, assignment: null,
    qualification: kind === 'technician' ? 'powerworksRegulatorDiagnostics' : 'regulatorMaterialMetrology', accountLost: true }; }
  function link(pool, state, kind, legacy = false) {
    if (!state || state.invalid) return state;
    if (!Array.isArray(state.sources) || !Array.isArray(state.providers)
      || state.sources.some(r => !r || typeof r !== 'object')
      || state.providers.some(p => !p || typeof p !== 'object' || p.resourceRefs && typeof p.resourceRefs !== 'object')) {
      state.invalid = true; return state;
    }
    const worker = kind === 'maintenance' ? 'technician' : 'reviewer';
    for (const p of state.providers || []) for (const field of [worker, 'bench']) {
      const src = state.sources?.find(r => r.id === p.sourceId);
      const ref = p.resourceRefs?.[field], embedded = p[field];
      if (field === worker && embedded && !ref && typeof embedded.serviceAccepting !== 'boolean')
        embedded.serviceAccepting = p.accepting !== false;
      const id = ref || embedded?.id;
      if (!id) { state.invalid = true; continue; }
      const suffix = field === 'bench' ? kind === 'maintenance' ? 'original-regulator-bench' : 'original-material-review-bench'
        : kind === 'maintenance' ? 'original-regulator-specialist' : 'original-material-metrologist';
      if (id !== `${src?.branchId}:${suffix}`) p.resourceLost = true;
      let a = pool?.assets?.find(a => a.id === id);
      if (ref) {
        // Saved references never recreate missing charged equipment or people.
        if (!a || a.kind !== field || pool.invalid || pool.conflict || !pool.originals.includes(id)) p.resourceLost = true;
      } else if (!pool || pool.invalid || pool.conflict) p.resourceLost = true;
      else if (a) {
        if (a.kind !== field || a.value !== embedded && stable(a.value) !== stable(embedded)) {
          pool.conflict = true; p.resourceLost = true;
        }
      } else if (!pool.originals.includes(id) && embedded) {
        a = { id, kind: field, value: embedded }; pool.assets.push(a); pool.originals.push(id);
      } else p.resourceLost = true;
      const value = a?.value;
      if (value && (!Number.isFinite(value.workSeconds) || value.workSeconds < 0 || value.workSeconds > 14400
        || field === 'bench' && (!Number.isFinite(value.condition) || value.condition < 0 || value.condition > 100)
        || field !== 'bench' && (!Number.isFinite(value.health) || value.health < 0 || value.health > 100
          || value.qualification !== src?.qualification))) p.resourceLost = true;
      p.resourceRefs ||= {}; p.resourceRefs[field] = id;
      Object.defineProperty(p, field, { configurable: true, enumerable: false,
        value: !p.resourceLost && a ? a.value : lost(id, field), writable: false });
    }
    for (const p of state.providers || []) {
      const original = pool?.assets?.find(a => a.id === p.resourceRefs?.[worker])?.value;
      if (!original) continue;
      if (typeof original.serviceAccepting !== 'boolean') {
        if (typeof p.accepting === 'boolean') original.serviceAccepting = p.accepting;
        else { p.resourceLost = true; original.serviceAccepting = false; }
      }
      Object.defineProperty(p, 'accepting', { configurable: true, enumerable: false,
        get: () => !p.resourceLost && original.serviceAccepting,
        set: value => { if (typeof value === 'boolean') original.serviceAccepting = value; } });
    }
    return state;
  }
  function available(pool, source, kind) {
    if (!pool || pool.invalid || pool.conflict) return false;
    const workerId = `${source.branchId}:${kind === 'maintenance' ? 'original-regulator-specialist' : 'original-material-metrologist'}`;
    const benchId = `${source.branchId}:${kind === 'maintenance' ? 'original-regulator-bench' : 'original-material-review-bench'}`;
    return [workerId, benchId].every(id => pool.originals.includes(id) && pool.assets.some(a => a.id === id));
  }
  function install(run, binding, kind, state, adopt) {
    if (!state) return null;
    const pool = ensure(run, binding); if (!pool || pool.conflict) return null;
    const shared = state.providers.filter(p => available(pool, state.sources.find(r => r.id === p.sourceId), kind));
    const newProviders = state.providers.filter(p => !shared.includes(p));
    if (newProviders.length && !adopt(kind, { ...state, providers: newProviders })) return null;
    // Replace temporary constructor defaults BEFORE interning. They were never
    // authoritative resources and never participate in work or save accounting.
    for (const p of shared) {
      const src = state.sources.find(r => r.id === p.sourceId);
      p.resourceRefs = { [kind === 'maintenance' ? 'technician' : 'reviewer']:
        `${src.branchId}:${kind === 'maintenance' ? 'original-regulator-specialist' : 'original-material-metrologist'}`,
      bench: `${src.branchId}:${kind === 'maintenance' ? 'original-regulator-bench' : 'original-material-review-bench'}` };
    }
    return link(pool, state, kind);
  }
  function restore(run, binding) {
    const pool = ensure(run, binding);
    for (const e of entries(run)) for (const [key, kind, Model] of [
      ['powerworksMaintenance', 'maintenance', Maintenance], ['powerworksStandards', 'standards', Standards]
    ]) {
      const s = e.owner[key]; if (!s) continue;
      if (!bound(s, binding) || s.ruleId !== e.rule.id || s.powerId !== e.rule.source.powerId) {
        e.owner[key] = { ...binding, invalid: true }; continue;
      }
      link(pool, s, kind, true);
      const next = Model.normalize(s); e.owner[key] = next;
      if (next && !next.invalid) link(pool, next, kind, true);
    }
    // A disagreement is not permission to select the first healthy copy.
    if (pool?.conflict) for (const e of entries(run)) for (const [key, kind] of [
      ['powerworksMaintenance', 'maintenance'], ['powerworksStandards', 'standards']
    ]) link(pool, e.owner[key], kind);
    for (const e of entries(run).filter(e => e.regional)) {
      const f = Fuel.normalize(e.owner.municipalFuelService);
      e.owner.municipalFuelService = f && (!bound(f, binding) || f.ruleId !== e.rule.id)
        ? { ...binding, invalid: true } : f;
    }
    return pool;
  }
  function rebind(run, from, to) {
    const original = ensure(run, from);
    for (const e of entries(run)) {
      for (const [key, kind, Model] of [['powerworksMaintenance', 'maintenance', Maintenance],
        ['powerworksStandards', 'standards', Standards], ['municipalFuelService', 'fuel', Fuel]]) {
        const s = e.owner[key]; if (!s || bound(s, to)) continue;
        if (!bound(s, from)) { e.owner[key] = { ...to, invalid: true }; continue; }
        if (kind !== 'fuel') link(original, s, kind, true);
        e.owner[key] = Model.rebind(s, from, to) || { ...to, invalid: true };
      }
    }
    const pool = normalize(original);
    run.cityServices = bound(pool, from) ? { ...pool, ...to } : { ...to, invalid: true };
    restore(run, to);
  }
  function personal(run, except = '', cityId = null) {
    const skips = (kind, city) => except === kind && (cityId == null || city === cityId);
    return entries(run).some(e => !skips('fuel', e.rule.source.cityId) && e.owner.municipalFuelService?.job
      || !skips('maintenance', e.rule.source.cityId) && e.owner.powerworksMaintenance?.job
      || !skips('standards', e.rule.source.cityId) && e.owner.powerworksStandards?.job)
      || !skips('communications', run.civicCommunications?.job?.cityId) && Boolean(run.civicCommunications?.job);
  }
  function active(run) {
    return personal(run) || entries(run).some(e => Fuel.active(e.owner.municipalFuelService));
  }
  function outcome(entry, communications) {
    const r = entry.rule, o = entry.owner, m = o.powerworksMaintenance, f = o.municipalFuelService, s = o.powerworksStandards;
    const gaps = [];
    if (r.powerMaintenance?.accountLost) gaps.push('Original regulator accounting missing');
    for (const [key, initialized] of [['powerworksMaintenance', 'technicalMaintenanceInitialized'], ['powerworksStandards', 'partsStandardsInitialized'], ['municipalFuelService', 'fuelServiceInitialized']])
      if (r[initialized] && (!o[key] || o[key].invalid)) gaps.push(`Original ${key} accounting missing`);
    const failed = r.unmetKg > 0 && r.foodKg <= 1e-7 || r.unmetLiters > 0 && r.waterLiters <= 1e-7 || r.energy <= 1e-7;
    return { cityId: r.source.cityId, sourceId: r.id, powerId: r.source.powerId,
      state: gaps.length ? 'unverified' : failed ? 'unmetGovernmentRequirement' : 'noCurrentServiceFailure', gaps,
      dependencies: [
        { kind: 'fuel', adopted: Boolean(f?.contract && !f.contract.cancelledAt), sourceId: f?.contract?.sourceId || null,
          paidCargoContinues: Boolean(f?.mission && !f.mission.returnedAt), buffer: r.powerFuel?.stock ?? null },
        { kind: 'maintenance', required: true, working: r.powerMaintenance?.condition > 50 && !r.powerMaintenance?.accountLost,
          independentMethod: Boolean(m?.method?.powerId === r.source.powerId), sourceId: m?.job?.providerId || null },
        { kind: 'standards', adopted: Boolean(s?.policy), specificationId: s?.policy?.specificationId || null,
          independentMeasurementsAllowed: true },
        { kind: 'communications', adopted: Boolean(communications?.profiles?.some(p => p.cityId === r.source.cityId)),
          scope: 'Only actually enrolled municipal message classes; not machinery, all private links or old documents' }
      ], limits: 'Private causal account, not acquired knowledge or a whole-network strategic outcome. Private credit, criticism, religion and unrelated archives are not required city services.' };
  }
  return { bound, entries, ensure, normalize, restore, rebind, install, available, personal, active, outcome };
});
