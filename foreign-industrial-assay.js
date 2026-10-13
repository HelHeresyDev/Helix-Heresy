(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./local-services') : root.HelixLocalServices,
    node ? require('./local-market-production') : root.HelixLocalMarketProduction,
    node ? require('./foreign-assay-workspace') : root.HelixForeignAssayWorkspace);
  if (node) module.exports = api;
  if (root) root.HelixForeignIndustrialAssay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Services, Production, Workspace) {
  'use strict';
  const FREIGHT = 8, copy = x => JSON.parse(JSON.stringify(x));
  function create(workspace, production) {
    if (!workspace || production?.cityId !== workspace.property.cityId) return null;
    const chemical = production.facilities?.find(f => f.kind === 'chemicalWorks' && f.expertise?.includes('chemicalProcessing'));
    if (!chemical) return null;
    // This is the factory's account, represented at the desk by the original
    // branch liaison. It creates no employee, truck, stock or operating budget.
    const service = Services.create({ facilities: [chemical] });
    return { service, liaisonId: workspace.actor.id, bodyEpoch: null, quote: null, observation: null };
  }
  function contactReason(s, w, p, c, now) {
    if (!s || !p || p.cityId !== w?.property.cityId) return 'No supported local chemical-works customer exists.';
    const reason = Workspace.workReason(w, c, now); if (reason) return reason;
    if (!c.atDesk || !c.contact || c.busy || w.actor.id !== s.liaisonId || w.actor.status !== 'alive' || w.actor.health < 50 || w.actor.fatigue >= 80)
      return 'Attend the original workspace liaison at the desk; remote customer access is not authorized.';
    if (s.bodyEpoch != null && s.bodyEpoch !== c.bodyEpoch) return 'The original contracted scientist must attend.';
    const f = p.facilities?.find(f => f.id === s.service.client.facilityId);
    if (!Number.isFinite(p.finance?.money) || !f || f.kind !== 'chemicalWorks' || !f.expertise?.includes('chemicalProcessing')
      || !Number.isFinite(f.condition) || !Number.isFinite(f.labour) || !Number.isFinite(f.utilities)) return 'The original funded chemical works is unavailable.';
    return Services.available(s.service, p);
  }
  function deliveryReason(s, w, p, c, now) {
    if (!s || !Workspace.current(w, c) || !w.lease || w.lease.settled || now >= w.lease.endsAt
      || w.actor.id !== s.liaisonId || w.actor.status !== 'alive' || w.actor.health < 50 || w.actor.fatigue >= 80
      || w.actor.present === false || w.actor.roomId !== w.roomId || c.receivingReady === false)
      return 'The original authorized receiving workspace or liaison is unavailable.';
    return Services.available(s.service, p);
  }
  function quote(s, w, p, c, now) {
    if (contactReason(s, w, p, c, now) || Services.offerReason(s.service, p, now, FREIGHT) || !Production.serviceTruck(p)
      || now + Production.HOUR >= w.lease.endsAt) return null;
    s.quote = { clientId: s.service.client.id, cityId: p.cityId, propertyId: w.property.id, liaisonId: s.liaisonId,
      bodyEpoch: c.bodyEpoch, tenant: c.tenant, fee: Services.FEE, freight: FREIGHT, window: Services.WINDOW,
      issuedAt: now, expiresAt: now + 60, scope: 'One sealed nonliving batch portion; 120 marks for a conclusive truthful report within 48 hours. Customer funds local truck delivery. Scientist supplies reagent and Assay Case. No wider research or trading permission.' };
    s.service.communicationSeconds -= 60; w.actor.fatigue += .1;
    return copy(s.quote);
  }
  function book(s, w, p, job, now) {
    const sh = Production.bookServiceCargo(p, s.service.client.facilityId, 'diagnosticSample', 1, now,
      { cityId: p.cityId, propertyId: w.property.id, endsAt: w.lease.endsAt, closed: false });
    if (!sh) return false;
    sh.serviceJobId = job.id; sh.sampleAt = job.sampleAt;
    job.shipmentId = sh.id; job.consignmentId = sh.id; job.status = 'sampleInTransit';
    p.finance.transportEarned = (p.finance.transportEarned || 0) + FREIGHT;
    return true;
  }
  function action(s, w, p, c, now, kind, options = {}, wallet = null) {
    // Cancellation is termination, not laboratory work. An expired tenant may
    // still personally settle it at the original retrieval desk.
    if (kind === 'cancel' && s && p?.cityId === w?.property.cityId && Number.isFinite(p.finance?.money)
      && Workspace.body(w, c) && Workspace.access(w, c, now) && c.atDesk && c.contact && !c.busy
      && s.bodyEpoch === c.bodyEpoch && w.actor.id === s.liaisonId && w.actor.status === 'alive' && w.actor.health >= 50) {
      Services.advance(s.service, p, now);
      return { ok: Services.stop(s.service, p, s.service.jobs.find(j => j.id === options.jobId), now) };
    }
    const reason = contactReason(s, w, p, c, now); if (reason) return { ok: false, reason };
    Services.advance(s.service, p, now);
    if (kind === 'quote') return { ok: Boolean(quote(s, w, p, c, now)) };
    if (kind === 'accept') {
      const q = s.quote;
      if (!q || now >= q.expiresAt || q.bodyEpoch !== c.bodyEpoch || q.tenant !== c.tenant || JSON.stringify(q) !== JSON.stringify(options.expected)
        || Services.offerReason(s.service, p, now, FREIGHT) || !Production.serviceTruck(p)
        || now + Production.HOUR >= w.lease.endsAt) return { ok: false, reason: 'Review exact current funded commission terms and functioning local delivery first.' };
      const r = Services.accept(s.service, p, now, FREIGHT);
      if (r.ok) { book(s, w, p, r.job, now); s.bodyEpoch = c.bodyEpoch; s.quote = null; w.actor.fatigue += .1; }
      return r;
    }
    const job = s.service.jobs.find(j => j.id === options.jobId);
    if (kind === 'cancel') return { ok: Services.stop(s.service, p, job, now) };
    if (kind === 'preview') return { ok: Boolean(Services.preview(s.service, options.jobId)) };
    if (kind === 'submit') {
      if (!Number.isFinite(wallet?.money)) return { ok: false, reason: 'Actual scientist funds are unavailable.' };
      return Services.submit(s.service, p, options.jobId, wallet, now);
    }
    if (kind === 'resample') {
      if (!Production.serviceTruck(p) || now + Production.HOUR >= w.lease.endsAt) return { ok: false, reason: 'No functioning original local truck and unexpired receiving workspace are available.' };
      const r = Services.resample(s.service, p, options.jobId, now, FREIGHT);
      if (r.ok) book(s, w, p, r.job, now);
      return r;
    }
    return { ok: false, reason: 'Unsupported commission action.' };
  }
  function observe(s, w, p, c, now) {
    if (s && Workspace.body(w, c) && Workspace.access(w, c, now) && c.atDesk && c.contact && !c.busy
      && (s.bodyEpoch == null || s.bodyEpoch === c.bodyEpoch) && w.actor.id === s.liaisonId && w.actor.status === 'alive' && w.actor.health >= 50)
      s.observation = { at: now, ...Services.publicView(s.service), quote: copy(s.quote), liaisonId: s.liaisonId };
    return s?.observation ? copy(s.observation) : null;
  }
  return { FREIGHT, create, contactReason, deliveryReason, quote, action, observe };
});
