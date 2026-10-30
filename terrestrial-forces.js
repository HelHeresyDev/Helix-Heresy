(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./expedition-escorts') : root.HelixExpeditionEscorts);
  if (node) module.exports = api;
  if (root) root.HelixTerrestrialForces = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Escorts) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const SCOPE = 'Original ordinary ground forces only. Private defensive posts, existing protective/survey contracts and the same field teams retain their own owners and limits. No new army, transport, political allegiance, maps, global nonintervention or regime-change mandate.';
  const inventory = n => n?.inventories?.mode === 'original' && !n.inventories.invalid && !n.inventories.conflict
    && bound(n.inventories, n) && Array.isArray(n.source?.inventoryPlan?.assets) ? n.inventories : null;
  const asset = (n, id) => inventory(n)?.assets.find(a => a.id === id && !a.lost && a.ledger === 'inventory');
  function sources(n, cityId) {
    const inv = inventory(n); if (!inv) return [];
    return n.source.branches.filter(b => b.public && b.hostId === b.id && (!cityId || b.cityId === cityId))
      .filter(b => asset(n, `${b.id}:original-reserve-professional`)?.state.qualification === 'localDefensiveDuty'
        && ['original-reserve-professional', 'original-reserve-kit', 'non-office-reserve'].every(k =>
          asset(n, `${b.id}:${k}`)?.ownerId === `branch:${b.id}` && n.source.inventoryPlan.assets.some(a =>
            a.id === `${b.id}:${k}` && a.ownerId === `branch:${b.id}` && a.cityId === b.cityId
            && a.populationSourceId === b.populationSourceId)));
  }
  function create(binding, at) { return { worldId: binding.worldId, runId: binding.runId, lastAt: at, posts: [], reports: [] }; }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !Number.isFinite(s.lastAt) || !Array.isArray(s.posts) || !Array.isArray(s.reports)
      || new Set(s.posts.map(p => p?.id)).size !== s.posts.length || s.posts.some(p => !p?.id || !p.branchId || !p.cityId
        || p.actorId !== `${p.branchId}:original-reserve-professional` || p.kitId !== `${p.branchId}:original-reserve-kit`
        || !p.layout?.roomId || !p.layout?.home || !Number.isFinite(p.at) || !Number.isFinite(p.paidWork)))
      return { worldId: s?.worldId || '', runId: s?.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, ...to } : null; }
  function resolve(s, n, p) {
    if (!s || s.invalid || !bound(s, n)) return null;
    const b = sources(n, p.cityId).find(b => b.id === p.branchId && b.populationSourceId === p.populationSourceId),
      worker = asset(n, p.actorId), kit = asset(n, p.kitId), funds = asset(n, `${p.branchId}:non-office-reserve`);
    if (!b || worker?.ownerId !== `branch:${b.id}` || kit?.ownerId !== worker.ownerId || funds?.ownerId !== worker.ownerId
      || worker.state.id !== p.actorId || worker.state.groundPostId !== p.id || worker.state.qualification !== 'localDefensiveDuty') return null;
    // The inventory remains the sole mutable owner; posts save IDs/layout only.
    Object.defineProperty(worker.state, 'fieldKit', { configurable: true, enumerable: false, value: kit.state });
    return { b, actor: worker.state, kit: kit.state, funds: funds.state };
  }
  function actors(s, n) { return (s?.posts || []).flatMap(p => { const r = resolve(s, n, p); return r ? [r.actor] : []; }); }
  function open(s, n, branchId, c, layout, seed, at) {
    if (!bound(s, n) || s.invalid || !c.alive || !c.capable || !c.authority || !c.local || c.busy || !c.sourceCurrent || !layout?.home) return false;
    const b = sources(n, c.cityId).find(b => b.id === branchId); if (!b || c.populationSourceId !== b.populationSourceId) return false;
    const prior = s.posts.find(p => p.branchId === branchId);
    if (prior) return Boolean(resolve(s, n, prior));
    const worker = asset(n, `${b.id}:original-reserve-professional`), a = worker.state;
    if (a.groundPostId || a.groundForceInitialized || a.assignment || a.mapCell || a.status !== 'alive') return false;
    const original = copy(a), candidate = Escorts.candidate(seed, { id: worker.id, label: b.label });
    Object.assign(a, candidate, original, { id: worker.id, actorKind: 'civicOfficeholder', maxHealth: 100,
      groundForceInitialized: true, groundPostId: `${b.id}:original-defensive-post`, roomId: layout.roomId,
      cityId: b.cityId, affiliation: `${b.label} original local defensive professional`,
      mapCell: copy(layout.home), assignment: `${b.id}:original-defensive-post`,
      physicalControl: original.physicalControl || { strength: 25, stamina: 80, staminaCapacity: 80 } });
    const p = { id: a.groundPostId, branchId: b.id, cityId: b.cityId, populationSourceId: b.populationSourceId,
      actorId: a.id, kitId: `${b.id}:original-reserve-kit`, layout: copy(layout), at, paidWork: 0, dutyProgress: 0,
      phase: 'onPost', history: [] };
    s.posts.push(p); resolve(s, n, p); return true;
  }
  const able = a => a?.status === 'alive' && a.health >= 35 && a.workSeconds > 0 && a.physicalControl?.stamina > 1;
  function advance(s, n, context, to, h) {
    if (!s || s.invalid || !bound(s, n) || !h.alive() || to <= s.lastAt) return false;
    let changed = false;
    while (s.lastAt < to && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      for (const p of s.posts) {
        if (at <= p.at) continue;
        const r = resolve(s, n, p), c = context(p); if (!r || !c?.sourceCurrent) { p.phase = 'unverified'; continue; }
        const { actor: a, kit, funds } = r;
        if (a.assignment !== p.id || !able(a) || h.incapacitated(a) || kit.toolCondition <= 0 || funds.money <= 0) {
          p.phase = a.status === 'dead' ? 'dead' : 'offDuty'; continue;
        }
        p.phase = 'onPost'; a.workSeconds = Math.max(0, a.workSeconds - dt); p.dutyProgress += dt; changed = true;
        if (p.dutyProgress >= 60) {
          p.dutyProgress -= 60; funds.money--; p.paidWork++; a.money = (a.money || 0) + 1;
          funds.ledger.push({ id: `${p.id}:wage:${p.paidWork}`, at, amount: 1, purpose: 'originalLocalDefensiveDuty' });
        }
        const target = h.threat(p, a, at);
        if (!target || target.cell?.z !== a.mapCell?.z || at < (a.nextFieldAttackAt || 0)) continue;
        if (h.distance(a.mapCell, target.cell) <= 1) {
          const hit = h.strike(a, target); if (hit?.ok) {
            kit.toolCondition = Math.max(0, kit.toolCondition - 1); a.physicalControl.stamina = Math.max(0, a.physicalControl.stamina - 3);
            p.history.push({ at, kind: 'defendedOriginalPremises', targetId: target.id });
          }
          a.nextFieldAttackAt = at + 4;
          if (!h.alive()) return changed;
        } else h.move(p, a, target.cell);
      }
    }
    return changed;
  }
  function receive(s, n, postId, c, at) {
    const p = s?.posts?.find(p => p.id === postId), r = p && resolve(s, n, p);
    if (!r || !c.alive || !c.capable || !c.local || !c.observed || c.busy) return false;
    const report = { id: `${p.id}:observed:${at}`, at, cityId: p.cityId, branchId: p.branchId,
      text: `Personally observed original chapter receiving post: ${r.actor.status === 'dead' ? 'physical remains' : p.phase}. Defensive duty at its own premises only; no offensive or political concession.`, scope: SCOPE };
    s.reports.push(report); return true;
  }
  function reach(unit, context) {
    const l = unit.deployment?.link || context.link;
    if (!l || !l.endpointCityIds?.includes(unit.source.cityId) || !context.sourceCurrent || !(context.physicalRouteOpen ?? context.routeOpen))
      return { state: 'blocked', reason: 'No current source-bound physical corridor' };
    const distanceKm = unit.source.cityId === l.originCityId ? l.corridorKm : l.distanceKm - l.corridorKm;
    const low = unit.source.cityId === l.originCityId ? 0 : l.corridorKm, high = unit.source.cityId === l.originCityId ? l.corridorKm : l.distanceKm;
    if (l.strongholds?.some(h => !Number.isFinite(h.corridorKm) || h.corridorKm >= low && h.corridorKm <= high))
      return { state: 'unverifiedPassage', reason: 'Original joint stronghold has no force-specific military passage grant; passenger inspection is not that grant', distanceKm };
    const seconds = distanceKm / (2.4 / 3600) * 2 + 600;
    if (unit.deployment && !['returned', 'losses'].includes(unit.phase)) return { state: 'originalJourneyInProgress',
      distanceKm, positionKm: unit.deployment.positionKm, phase: unit.phase };
    if (!(distanceKm > 0) || !unit.actors.every(a => able(a) && !a.assignment && a.workSeconds > seconds
      && a.foodSeconds > seconds && a.waterSeconds > seconds && a.fieldKit?.toolCondition > 0))
      return { state: 'unavailable', reason: 'Original duty, provisions, wounds, equipment or prior assignment cannot support outward/return walking', distanceKm };
    return { state: 'supportedFootJourney', distanceKm, seconds, transport: 'Original walking personnel only; no vehicle or passenger military rights inferred' };
  }
  // Privately enumerate ALL original ground means, not public office rosters.
  // No result below is a whole-network strategic certificate (.4).
  function outcomes(n, run) {
    const inv = inventory(n); if (!inv) return { state: 'unverified', owners: [], limits: SCOPE };
    const field = bound(run.networkInterdiction, n) ? run.networkInterdiction : null,
      posts = bound(run.terrestrialForces, n) ? run.terrestrialForces : null;
    const views = [...(field?.units || []).flatMap(u => [{ id: u.id, value: { radioSeconds: u.radioSeconds }, unit: u },
      ...u.actors.map(a => ({ id: a.id, value: a, scope: 'originalFieldContract', unit: u }))]),
      ...(run.penalFlights?.assistance?.cityApproach?.gates || []).flatMap(g => bound(g.outerApproach?.chapterProtection, n)
        ? [{ id: g.outerApproach.chapterProtection.actor.id, value: g.outerApproach.chapterProtection.actor, scope: 'originalCivilianProtection',
          contract: g.outerApproach.chapterProtection.contract }, { id: `${g.outerApproach.chapterProtection.source.branchId}:protective-kit`, value: g.outerApproach.chapterProtection.kit }] : []),
      ...(run.penalFlights?.assistance?.cityApproach?.gates || []).flatMap(g => g.foreignSurvey?.escort?.actor
        ? [{ id: g.foreignSurvey.escort.actor.id, value: g.foreignSurvey.escort.actor, scope: 'originalSurveyProtection', contract: g.foreignSurvey.escort.contract },
          { id: `${g.foreignSurvey.escort.source.branchId}:survey-duty`, value: g.foreignSurvey.escort },
          { id: `${g.foreignSurvey.escort.source.branchId}:survey-supplies`, value: g.foreignSurvey.escort.inventorySupplies }] : [])];
    return { state: 'currentScopedGroundAccounts', owners: inv.owners.filter(o => o.assetIds.some(id =>
      n.source.inventoryPlan.assets.some(a => a.id === id && a.families.includes('armedForce')))).map(o => ({
      id: o.id, networkId: o.networkId, gaps: copy(o.gaps), means: o.assetIds.flatMap(id => {
        const a = inv.assets.find(a => a.id === id), plan = n.source.inventoryPlan.assets.find(a => a.id === id);
        if (!plan?.families.includes('armedForce')) return [];
        const v = a?.ledger === 'inventory' ? a.state : views.find(v => v.id === id)?.value;
        const q = plan.initial.qualification, post = posts?.posts?.find(p => p.actorId === id), view = views.find(v => v.id === id);
        const offensive = view?.unit?.offensivePostId && bound(run.offensiveMandates, n)
          && run.offensiveMandates.posts?.find(p => p.id === view.unit.offensivePostId && p.source.id === view.unit.id);
        const missingOffensive = view?.unit?.offensivePostId && !offensive;
        return [{ id, kind: plan.kind, state: !a || a.lost || !v || missingOffensive || v.groundForceInitialized && (!post || !resolve(posts, n, post)) ? 'unverified' : q === 'ordinaryProtectiveTraining' ? 'ordinaryTrainingOnly'
          : q === 'localDefensiveDuty' ? 'ownPremisesDefenseOnly' : 'originalContractScope',
          intent: offensive ? 'Separately disclosed political preparation at original chapter; no performed assault or city control'
            : view?.unit?.deployment ? 'Existing scoped field deployment' : view?.contract ? 'Existing limited civilian contract'
            : q === 'localDefensiveDuty' ? 'Own premises only; no offensive commission' : 'No offensive commission supplied by an inventory',
          contract: copy(offensive?.contract || view?.contract || null),
          current: copy(v), deployment: copy(views.find(v => v.id === id)?.unit?.deployment || null),
          postId: posts?.posts?.find(p => p.actorId === id)?.id || null }];
      }) })), limits: 'Current original ground resources/scopes only; missing contracts/owners stay unverified. Blocked journeys and expired duties are reversible constraints, not destruction. Covert and exceptional means and whole-network aggregation remain separate.' };
  }
  return { SCOPE, bound, create, normalize, rebind, sources, resolve, actors, open, able, advance, receive, reach, outcomes,
    publicView: s => copy(s?.reports || []) };
});
