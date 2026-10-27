(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-inventories') : root.HelixNetworkInventories,
    node ? require('./network-owner-reconciliation') : root.HelixNetworkOwnerReconciliation,
    node ? require('./terrestrial-forces') : root.HelixTerrestrialForces,
    node ? require('./covert-functions') : root.HelixCovertFunctions,
    node ? require('./exceptional-reach') : root.HelixExceptionalReach,
    node ? require('./city-services') : root.HelixCityServices,
    node ? require('./chapter-protection') : root.HelixChapterProtection);
  if (node) module.exports = api;
  if (root) root.HelixInstitutionalOutcomes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Inventory, Owners, Ground, Covert, Exceptional, Cities, Protection) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  // A transient frame is a read of actual owner consumers, not a serializable
  // caller-supplied certificate. No assets, permission or evidence are created.
  const frames = new WeakMap();
  const gates = run => run.penalFlights?.assistance?.cityApproach?.gates || [];
  const able = a => a?.status === 'alive' && a.health >= 35 && a.workSeconds > 0
    && a.foodSeconds > 0 && a.waterSeconds > 0 && a.physicalControl?.stamina > 1 && a.fieldKit?.toolCondition > 0;
  function frame(n, run, at, context = {}) {
    const token = Object.freeze({});
    if (!n || n.invalid || run.networkOperations !== n || run.clock !== at || !Number.isFinite(at) || context.alive === false
      || run.worldReference && run.worldReference.worldId !== n.worldId || run.runIdentity && run.runIdentity.runId !== n.runId) return token;
    const ground = Ground.outcomes(n, run), covert = Covert.outcomes(n, run.covertFunctions), exceptional = Exceptional.outcomes(n, run, Inventory.assess);
    const entries = Cities.entries(run), results = new Map();
    for (const network of n.source.networks) {
      const networkId = network.id, inventory = Inventory.assess(n, networkId), owner = Owners.view(n.capabilityAccounting, n, networkId);
      const originals = n.capabilityAccounting?.originals?.filter(r => r.networkId === networkId) || [];
      const records = n.capabilityAccounting?.records || [];
      const issues = [], challenges = [], dependencies = [], events = [n.capabilityAccounting?.allocatedAt || 0];
      const authorizations = n.accounts.filter(a => a.source.networkId === networkId && a.id === a.source.hostId)
        .map(a => ({ branchId: a.id, charter: copy(a.source.charter), mandates: Object.values(a.mandates || {})
          .map(m => ({ id: m.id, purpose: m.purpose, at: m.at })) }));
      for (const a of authorizations) for (const m of a.mandates) events.push(m.at || 0);
      const issue = text => issues.push(text);
      if (n.lastAt !== at || new Set(n.source.networks.map(v => v.id)).size !== n.source.networks.length)
        issue('Current organizational clock or identity is conflicting');
      if (!n.capabilityAccounting?.catalogComplete || n.capabilityAccounting.conflict || !originals.some(r => r.kind === 'network')
        || originals.some(r => !records.some(v => v.id === r.id && v.networkId === networkId && v.lost === false))) issue('Original source registry incomplete or conflicting');
      if (!inventory.complete) issue('Original inventory incomplete');
      for (const a of inventory.assets) if (a.state?.governmentAccess || a.state?.militaryCommand || a.state?.governingAuthority
        || a.state?.survivingClaimants?.length) issue(`${a.id}: additional governing access, command or claimant needs a supported owner consumer`);
      if (owner.state !== 'partial' || owner.assets.some(a => a.state !== 'linked')) issue('Current original service ownership not reconciled');
      for (const b of owner.boundaries.filter(b => b.branchId && n.source.branches.some(r => r.id === b.branchId && r.networkId === networkId)))
        if (b.ownerKind === 'unknownAttribution') issue(`${b.assetId}: ${b.reason}`);
      const scoped = originals.map(row => {
        const i = inventory.sources.find(v => v.id === row.id), k = covert.owners.find(v => v.id === row.id), x = exceptional.owners.find(v => v.id === row.id);
        const g = ground.owners.find(v => v.id === row.id);
        const gaps = [...(i?.gaps || ['Original owner inventory missing']), ...(k?.gaps || ['Covert owner outcome missing']),
          ...(x?.issues || ['Exceptional owner outcome missing']), ...(g?.gaps || [])];
        if (g?.means.some(m => m.state === 'unverified')) gaps.push('Original ground means unavailable');
        if (i?.families.some(f => f.family === 'armedForce' && f.assetIds.length) && !g && row.kind !== 'network' && !i.sharedHost)
          gaps.push('Original ground outcome missing');
        issues.push(...gaps.map(g => `${row.id}: ${g}`));
        return { id: row.id, kind: row.kind, sharedHost: i?.sharedHost || null, gaps,
          families: (i?.families || []).map(f => ({ family: f.family, assetIds: [...new Set(f.assetIds)],
            state: gaps.length ? 'unverified' : 'originalScopedFunction',
            basis: 'Actual original owner scope; no extension of title, credentials, command or commitments' })) };
      });
      // Every governed city participates. A failing city is not automatically
      // blamed on every provider; unresolved dependence is distinct from intent.
      for (const e of entries) {
        const r = e.rule, o = e.owner;
        for (const [key, initialized] of [['powerworksMaintenance', 'technicalMaintenanceInitialized'],
          ['powerworksStandards', 'partsStandardsInitialized'], ['municipalFuelService', 'fuelServiceInitialized']]) {
          const service = o[key], sources = service?.sources?.filter(s => s.networkId === networkId) || [];
          if (r[initialized] && (!service || service.invalid || !bound(service, n))) {
            // Missing adopted books cannot identify which original provider was
            // depended on. Keep this uncertainty rather than choosing a culprit.
            issue(`${r.id}: initialized ${key} account unavailable`); continue;
          }
          if (!sources.length) continue;
          if (!bound(r, n) || !bound(service, n) || service.ruleId !== r.id || service.lastAt !== at || r.lastAt !== at) {
            issue(`${r.id}: stale or conflicting ${key} target`); continue;
          }
          if (key === 'powerworksMaintenance') {
            const independent = service.method?.powerId === r.source.powerId;
            dependencies.push({ cityId: r.source.cityId, kind: key, independent, sourceIds: sources.map(s => s.id) });
            if (!independent) issue(`${r.id}: continuing regulator method/support not independently established`);
            else events.push(service.method.at || 0);
          } else if (key === 'municipalFuelService' && service.contract && !service.contract.cancelledAt
            && sources.some(s => s.id === service.contract.sourceId)) {
            dependencies.push({ cityId: r.source.cityId, kind: key, sourceId: service.contract.sourceId,
              buffer: r.powerFuel?.stock ?? null, paidCargoContinues: Boolean(service.mission && !service.mission.returnedAt) });
            issue(`${r.id}: adopted continuing fuel pipeline has no demonstrated independent replacement`);
          } else if (key === 'powerworksStandards') {
            // The actual standard permits independent local measurement. Its
            // existence, refused optional review or an old signature is not a veto.
            dependencies.push({ cityId: r.source.cityId, kind: key, independentlyMeasurable: true });
          }
          for (const v of [...(service.contracts || []), ...(service.suspended || []), service.policy].filter(Boolean)) events.push(v.at || 0, v.cancelledAt || 0);
        }
      }
      // An authenticated local personal contract remains scoped to its person;
      // only the existing consumer can establish its actual governing effect.
      for (const g of gates(run)) {
        const p = g.outerApproach?.chapterProtection;
        if (p?.source.networkId !== networkId) continue;
        if (!bound(p, n) || p.invalid) { issue(`${p.id}: original protection owner unavailable`); continue; }
        const c = context.chapter?.(g);
        if (!c || !Protection.current(p, c)) issue(`${p.id}: current original protection context unavailable`);
        else if (Protection.fact(p, c, at).state === 'notQualifying') challenges.push({ id: p.id, cityId: g.cityId, kind: 'actualEssentialOfficialWithdrawal' });
        for (const v of [p.contract, p.promise, ...(p.promises || [])].filter(Boolean)) events.push(v.at || 0, v.breachedAt || 0, v.closedAt || 0);
      }
      const field = run.networkInterdiction;
      for (const u of field?.units?.filter(u => u.source.networkId === networkId) || []) {
        const d = u.deployment;
        if (!bound(field, n) || field.invalid || u.lost) { issue(`${u.id}: original field accounting unavailable`); continue; }
        for (const v of [d, ...(u.history || [])].filter(Boolean)) events.push(v.at || 0, v.ceasefire?.at || 0, v.returnedAt || 0, v.endedAt || 0);
        const q = run.cityProvisioning;
        for (const v of [d, ...(u.history || [])].filter(Boolean)) if (q && bound(q, n) && v.carrier?.id === q.roadContactId && !v.carrier.endedAt
          && v.contacts?.some(c => c.targetId === q.vehicle.id && c.vehicleDamage > 0) && q.vehicle.condition < 50)
          issue(`${v.id}: damaged original municipal carrier has no supported replacement`);
        if (!d || u.phase === 'returned') continue;
        const c = context.field?.(u), target = entries.find(e => e.rule.id === d.link?.targetRuleId
          || e.rule.source.cityId === d.link?.cityId && e.rule.handoverId === d.charterReceiptId);
        if (!c || !c.sourceCurrent || !target || !bound(target.rule, n)) { issue(`${u.id}: current target, authority or journey context unavailable`); continue; }
        const capable = u.actors.some(a => able(a) && !context.incapacitated?.(a));
        const currentTarget = target.rule.lastAt === at && target.rule.handoverId === d.charterReceiptId
          && c.targetControlled && c.targetReceiptId === d.charterReceiptId;
        if (currentTarget && capable && !d.ceasefire && ['outbound', 'deployed'].includes(u.phase)) {
          const reach = Ground.reach(u, c);
          const holdingCrossing = u.phase === 'deployed' && u.actors.some(a => able(a) && !context.incapacitated?.(a)
            && a.mapCell && a.assignment === d.id);
          if (holdingCrossing || reach.state === 'originalJourneyInProgress') challenges.push({ id: d.id, cityId: target.rule.source.cityId,
            kind: 'supportedUnresolvedMunicipalInterdiction', scope: 'Same paid original deployment, target and physical journey only' });
          else issue(`${d.id}: intended field intervention lacks current supported reach`);
        } else if (!['losses', 'returned'].includes(u.phase)) {
          // Receipt is not physical return. Temporary exhaustion/route blockage
          // cannot erase either the team or its surviving property claims.
          issue(`${d.id}: original field withdrawal or reversible constraint unresolved`);
        }
      }
      // Consolidation, dormancy and defunct labels are not claimant extinction.
      // Original rows remain above; no retired fact is synthesized here.
      const state = challenges.length ? 'notQualifying' : issues.length ? 'unverified' : 'qualifying';
      const result = { networkId, at, state, strategicComplete: !issues.length, issues: [...new Set(issues)], challenges,
        sources: scoped, dependencies, assetIds: [...new Set(inventory.assets.map(a => a.id))],
        canOverturn: challenges.length > 0, willing: challenges.length > 0, responseSupported: false,
        eventAt: Math.max(...events.filter(t => Number.isFinite(t) && t >= 0 && t <= at)) };
      // Exclude continuously consumed numeric resources and buffers. Only a
      // change in causal scope/outcome, not every second's wage, restarts time.
      result.key = stable([state, result.issues, challenges, authorizations]);
      result.scopeKey = stable([scoped.map(s => [s.id, s.sharedHost, s.gaps, s.families.map(f => [f.family, f.assetIds])]),
        dependencies.map(({ buffer, ...d }) => d)]);
      results.set(networkId, result);
    }
    frames.set(token, { n, run, at, results }); return token;
  }
  function read(token, n, networkId, at) {
    const f = frames.get(token);
    return f && f.n === n && f.run.networkOperations === n && f.run.clock === f.at && f.at === at
      ? copy(f.results.get(networkId)) : null;
  }
  // Only timing metadata is persisted here. Missing/old timing can safely
  // restart observation now; it never reconstructs an original resource.
  function advance(n, run, token, at) {
    const f = frames.get(token);
    if (!f || f.n !== n || f.run !== run || f.at !== at || run.clock !== at || !n.capabilityAccounting) return false;
    const old = n.capabilityAccounting.institutionalContinuity;
    const valid = old && bound(old, n) && Number.isFinite(old.lastAt) && old.lastAt <= at && Array.isArray(old.rows)
      && new Set(old.rows.map(r => r.networkId)).size === old.rows.length;
    const rows = [];
    for (const [networkId, r] of f.results) {
      const prior = valid && old.rows.find(v => v.networkId === networkId);
      const uninterrupted = prior && prior.state === 'qualifying' && r.state === 'qualifying'
        && prior.scopeKey === r.scopeKey && (prior.key === r.key || r.eventAt > old.lastAt)
        && Number.isFinite(prior.since) && prior.since >= 0 && prior.since <= old.lastAt;
      r.since = uninterrupted ? Math.max(prior.since, r.eventAt > old.lastAt ? r.eventAt : prior.since) : at;
      rows.push({ networkId, state: r.state, key: r.key, scopeKey: r.scopeKey, since: r.since });
    }
    const next = { worldId: n.worldId, runId: n.runId, lastAt: at, rows };
    const changed = stable(old) !== stable(next); n.capabilityAccounting.institutionalContinuity = next; return changed;
  }
  return { frame, read, advance };
});
