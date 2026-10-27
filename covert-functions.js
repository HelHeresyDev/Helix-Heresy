(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./network-inventories') : root.HelixNetworkInventories,
    node ? require('./local-covert-market') : root.HelixLocalCovertMarket);
  if (node) module.exports = api;
  if (root) root.HelixCovertFunctions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Inventories, Local) {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const WORK = 180, FEE = 2;
  const LIMITS = 'Prospective local collection introduction only. No reservation, delivery, carrier ownership, government credential, principal instruction, hidden-parent disclosure or strategic nonintervention. Ordinary delivery checks still apply.';
  function inventory(n) {
    return n?.inventories?.mode === 'original' && !n.invalid && !n.inventories.invalid && !n.inventories.conflict
      && bound(n.inventories, n) && n.source?.inventoryPlan ? n.inventories : null;
  }
  function resources(n, ownerId) {
    const inv = inventory(n), plan = n?.source?.inventoryPlan;
    const owner = plan?.owners.find(o => o.id === ownerId);
    if (!inv || !owner || owner.gaps.length || owner.sharedHost) return null;
    const base = n.source.capabilityBaseline.rows.find(r => r.id === ownerId);
    if (!base) return null;
    const allocations = plan.assets.filter(a => a.ownerId === ownerId);
    const get = suffix => {
      const p = allocations.find(a => a.id === `${base.sourceId}:${suffix}`), a = p && inv.assets.find(a => a.id === p.id);
      return p && a && !a.lost && a.ownerId === ownerId && a.ledger === 'inventory'
        && p.cityId === owner.cityId && p.populationSourceId === owner.populationSourceId ? a : null;
    };
    const worker = get(base.kind === 'covertCell' ? 'original-local-operator' : 'original-broker'),
      terminal = get('original-private-terminal'), access = get('own-correspondence-access'), funds = get('non-office-reserve');
    const accounted = Inventories.assess(n, owner.networkId).sources.find(o => o.id === ownerId);
    if (!accounted || accounted.gaps.length || !worker || !terminal || !access || !funds) return null;
    return { owner, base, worker, terminal, access, funds };
  }
  function ownOnly(r) {
    const a = r?.access.state;
    return Boolean(a && a.principalId === r.owner.id && a.targetId === r.terminal.id && a.credential === null
      && a.governmentAccess === false && a.carrierRights === false && a.scope === 'Own local correspondence only');
  }
  function sources(n, cityId) {
    if (!inventory(n)) return [];
    return n.source.branches.filter(b => b.public && b.hostId === b.id && b.cityId === cityId).flatMap(b => {
      const r = resources(n, `branch:${b.id}`);
      return r && ownOnly(r) && r.worker.state.qualification === 'localBrokerage'
        ? [{ ownerId: r.owner.id, cityId: b.cityId, label: b.label }] : [];
    }); // Concealed cells are privately accounted, not a new public directory.
  }
  function create(binding, at) { return { worldId: binding.worldId, runId: binding.runId, lastAt: at, nextNumber: 1, job: null, history: [], reports: [], closed: [] }; }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !Number.isFinite(s.lastAt) || !Number.isInteger(s.nextNumber) || s.nextNumber < 1
      || !Array.isArray(s.history) || !Array.isArray(s.reports) || !Array.isArray(s.closed) || s.closed.some(r => !r.id || !Number.isFinite(r.at))
      || s.job && (!s.job.id || !s.job.ownerId || !s.job.request
        || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress > WORK || !Number.isFinite(s.job.at)))
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return s && !s.invalid && bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  const capable = r => r.worker.state.status === 'alive' && r.worker.state.health >= 50 && r.worker.state.workSeconds > 0
    && r.terminal.state.condition > 0 && r.terminal.state.powerSeconds > 0;
  const channel = c => c?.alive && c.capable && c.local && c.channel && !c.busy;
  function requestValid(q, c, at) {
    return Boolean(q && q.contractId && q.contactId === c.contact?.id && q.cityId === c.cityId && q.cityId === c.market?.cityId
      && q.contactId === c.contract?.contactId && c.contract?.id === q.contractId && c.contract.status === 'active'
      && c.contract.dueAt > at && !c.contract.foreignShipmentId && c.contract.commodityKind !== 'specimen'
      && c.contactAvailable && c.contact.homeCityId === q.cityId && c.contact.serviceCityIds?.includes(q.cityId)
      && c.market.couriers.some(a => a.contactId === q.contactId) && same(q, c.request)
      && q.cargo?.massKg > 0 && q.cargo.volumeL > 0 && c.route?.ok && c.route.cityId === q.cityId
      && c.route.distanceKm === q.distanceKm);
  }
  function begin(s, n, ownerId, q, c, at) {
    if (!s || s.invalid || !bound(s, n) || s.job || !channel(c) || !requestValid(q, c, at)
      || !sources(n, c.cityId).some(b => b.ownerId === ownerId) || c.wallet.money < FEE) return false;
    const r = resources(n, ownerId);
    if (!r || !ownOnly(r) || !capable(r) || r.worker.state.assignment || r.worker.state.workSeconds < WORK || r.terminal.state.powerSeconds < WORK) return false;
    const id = `${ownerId}:collection-introduction:${s.nextNumber++}`;
    c.wallet.money -= FEE; r.funds.state.money += FEE;
    r.funds.state.ledger.push({ id, at, amount: FEE, purpose: 'prospectiveCollectionIntroduction' });
    r.worker.state.assignment = id;
    s.job = { id, ownerId, label: sources(n, c.cityId).find(b => b.ownerId === ownerId).label,
      workerId: r.worker.id, terminalId: r.terminal.id, request: copy(q), at, progress: 0, fee: FEE };
    s.lastAt = at; return true;
  }
  function cancel(s, n, at, reason = 'Customer ended the prospective introduction') {
    if (!s || s.invalid || !bound(s, n) || !s.job) return false;
    const j = s.job, worker = inventory(n)?.assets.find(a => a.id === j.workerId && a.ownerId === j.ownerId && !a.lost && a.ledger === 'inventory');
    if (worker?.state.assignment === j.id) worker.state.assignment = null;
    s.history.push({ ...copy(j), endedAt: at, reason }); s.job = null; return true;
  }
  function advance(s, n, context, to) {
    if (!s || s.invalid || !bound(s, n) || !context().alive || to <= s.lastAt) return false;
    let changed = false;
    while (s.job && s.lastAt < to && context().alive) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const j = s.job, c = context(), r = resources(n, j.ownerId);
      if (!r || !ownOnly(r) || r.worker.id !== j.workerId || r.terminal.id !== j.terminalId
        || r.worker.state.assignment !== j.id) { cancel(s, n, at, 'Original source, prospective consent or exact contract changed'); changed = true; break; }
      if (!channel(c) || !capable(r)) continue; // No attendance/work backfill across an outage or absence.
      if (!requestValid(j.request, c, at)) {
        cancel(s, n, at, 'Prospective consent or exact contract changed'); changed = true; break;
      }
      const work = Math.min(dt, WORK - j.progress, r.worker.state.workSeconds, r.terminal.state.powerSeconds);
      r.worker.state.workSeconds -= work; r.terminal.state.powerSeconds -= work; j.progress += work; changed = true;
      if (j.progress < WORK) continue;
      const check = Local.availability(c.market, c.contact, c.route, j.request.cargo);
      const report = { id: j.id, at, observedAt: at, ownerId: j.ownerId, label: j.label, contractId: j.request.contractId,
        contactId: j.request.contactId, contactName: c.contact.name, request: copy(j.request), fee: j.fee, available: check.ok,
        reason: check.ok ? 'Counterparty offers its existing local collection service; not reserved or prepaid.' : check.reason,
        expiresAt: Math.min(c.contract.dueAt, at + 3600), limits: LIMITS };
      s.reports.push(report);
      const grant = { id: j.id, kind: 'localCollectionIntroduction', contractId: j.request.contractId,
        contactId: j.request.contactId, at, scope: 'Prospective quote only; no carrier rights or onward delegation' };
      r.access.state.counterparties.push(copy(grant)); r.access.state.commitments.push(copy(grant));
      cancel(s, n, at, 'Dated introduction received; no collection booked');
    }
    s.lastAt = to; return changed;
  }
  function usable(s, n, reportId, c, at) {
    const r = s && !s.invalid && bound(s, n) && s.reports.find(r => r.id === reportId);
    return Boolean(r && !s.closed.some(x => x.id === reportId) && r.available && r.expiresAt > at && channel(c) && requestValid(r.request, c, at));
  }
  function close(s, n, reportId, c, at) {
    if (!s || s.invalid || !bound(s, n) || !channel(c) || s.closed.some(r => r.id === reportId)) return false;
    const report = s.reports.find(r => r.id === reportId); if (!report) return false;
    s.closed.push({ id: reportId, at });
    const r = resources(n, report.ownerId);
    for (const grant of r?.access.state.commitments || []) if (grant.id === reportId) grant.closedAt = at;
    return true; // Recipient closes prospective use only; paid cargo and old records are untouched.
  }
  function outcomes(n, s) {
    if (!inventory(n)) return { state: 'unverified', owners: [], strategicComplete: false };
    const plan = n.source.inventoryPlan, rows = n.source.capabilityBaseline.rows;
    const reports = s && !s.invalid && bound(s, n) ? s.reports : [];
    const assessments = new Map(n.source.networks.map(x => [x.id, Inventories.assess(n, x.id)]));
    const owners = rows.map(row => {
      const owner = plan.owners.find(o => o.id === row.id), account = assessments.get(row.networkId)?.sources.find(o => o.id === row.id);
      const ids = account?.families.find(f => f.family === 'covertAccess')?.assetIds || [];
      const assets = ids.filter(id => plan.assets.some(a => a.id === id && a.ownerId === row.id))
        .map(id => inventory(n).assets.find(a => a.id === id));
      const gaps = [...(account?.gaps || ['Original owner account missing'])];
      for (const a of assets) {
        const p = plan.assets.find(p => p.id === a?.id);
        if (!a || a.lost || a.ledger !== 'inventory' || !p || !same(p.initial.qualification, a.state.qualification)
          || p.cityId !== owner?.cityId || p.populationSourceId !== owner?.populationSourceId) { gaps.push('Actual covert resource/provenance unavailable'); continue; }
        if (a.kind !== 'access') continue;
        const r = resources(n, row.id);
        if (!r || !ownOnly(r) || [...a.state.counterparties, ...a.state.commitments].some(g =>
          !reports.some(q => q.ownerId === row.id && same(g, { id: q.id, kind: 'localCollectionIntroduction',
            contractId: q.contractId, contactId: q.contactId, at: q.at,
            scope: 'Prospective quote only; no carrier rights or onward delegation',
            ...(g.closedAt != null && s.closed.some(x => x.id === q.id && x.at === g.closedAt) ? { closedAt: g.closedAt } : {}) }))))
          gaps.push('External access or commitment lacks a supported original-owner consumer');
      }
      return { id: row.id, kind: row.kind, networkId: row.networkId, sharedHost: account?.sharedHost || null, gaps,
        state: gaps.length ? 'unverified' : account?.sharedHost || row.kind === 'network' ? 'relatedOwnerScopes'
          : ids.length ? 'ownCorrespondenceAndOrdinaryFunctionOnly' : 'noAllocatedCovertMeans',
        means: copy(assets), intent: 'History, hidden purpose and affiliation do not establish an operative instruction or target access',
        targetAccess: gaps.length ? 'unverified' : 'No government credential, carrier command or insider is established by these original functions',
        limits: 'Current complete original owner facts only; not political submission, universal harmlessness or whole-network qualification' };
    });
    return { state: 'privateScopedCovertOutcomes', owners, strategicComplete: false };
  }
  return { WORK, FEE, LIMITS, bound, create, normalize, rebind, sources, resources, begin, cancel, advance, usable, close, outcomes,
    publicView: s => copy(s && !s.invalid ? s.reports : []) };
});
