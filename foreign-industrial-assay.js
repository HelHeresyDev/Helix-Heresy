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
    return { service, liaisonId: workspace.actor.id, bodyEpoch: null, quote: null, observation: null,
      reservationQuote: null, reservationSerial: 0, reservationHistory: [] };
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
  function deliveryReason(s, w, p, c, now, reservedWork = 0) {
    if (!s || !Workspace.current(w, c) || !w.lease || w.lease.settled || now >= w.lease.endsAt
      || w.actor.id !== s.liaisonId || w.actor.status !== 'alive' || w.actor.health < 50 || w.actor.fatigue >= 80
      || w.actor.present === false || w.actor.roomId !== w.roomId || c.receivingReady === false)
      return 'The original authorized receiving workspace or liaison is unavailable.';
    return Services.available(reservedWork ? { ...s.service, communicationSeconds: s.service.communicationSeconds + reservedWork } : s.service, p);
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
  function reservationReason(s, p) {
    const completed = s?.service.jobs.filter(j => j.status === 'completed' && j.paidAt != null && j.feeEscrow === 0
      && j.result && j.result.confidence >= Services.MIN_CONFIDENCE && ['acceptable', 'contaminated'].includes(j.result.finding));
    if (!s || s.service.trust < 2 || completed.length < 2) return 'The original customer requires two successfully received conclusive reports and retained confidence.';
    if (['held', 'purchased'].includes(s.service.reservation?.status)) return 'The existing reagent allocation is held or still awaiting actual delivery.';
    const stock = p?.workshops?.find(w => w.facilityId === s.service.client.facilityId && w.id === 'assayReagent');
    if (!Number.isFinite(stock?.stock) || stock.stock < 4) return 'The chemical works cannot spare two actual reagent units while retaining two for its own needs.';
    return '';
  }
  function quoteReservation(s, w, p, c, now, marketQuote) {
    if (contactReason(s, w, p, c, now) || reservationReason(s, p) || s.service.communicationSeconds < 240 || marketQuote?.cityId !== p.cityId
      || marketQuote.good !== 'assayReagent' || !Number.isInteger(marketQuote.unitPrice) || marketQuote.unitPrice <= 0
      || !Number.isFinite(marketQuote.unitPrice * 2 + FREIGHT)) return null;
    s.reservationQuote = { clientId: s.service.client.id, facilityId: s.service.client.facilityId, cityId: p.cityId,
      propertyId: w.property.id, liaisonId: s.liaisonId, bodyEpoch: c.bodyEpoch, tenant: c.tenant,
      good: 'assayReagent', quantity: 2, unitPrice: marketQuote.unitPrice, freight: FREIGHT, total: marketQuote.unitPrice * 2 + FREIGHT,
      holdSeconds: 4 * Production.HOUR, issuedAt: now, expiresAt: now + 60,
      scope: 'Two actual factory reagent units held for four hours at the exact local-market ask, plus eight marks delivery. Explicit payment transfers title, not usable stock, and reserves one minute of existing receiving work. Original local truck delivery to this workspace only; no recurring procurement or wider trading or research permission.' };
    s.service.communicationSeconds -= 60; w.actor.fatigue += .1;
    return copy(s.reservationQuote);
  }
  function dispatchReservation(s, w, p, c, now) {
    const r = s?.service.reservation;
    if (!r || r.status !== 'purchased' || r.shipmentId || r.foreignTerms?.propertyId !== w?.property.id
      || r.foreignTerms.cityId !== p?.cityId || r.foreignTerms.bodyEpoch !== s.bodyEpoch
      || reservationDeliveryReason(s, w, p, c, now) || !Production.serviceTruck(p, r.quantity)) return false;
    const sh = Production.bookServiceCargo(p, s.service.client.facilityId, r.good, r.quantity, now,
      { cityId: p.cityId, propertyId: w.property.id, endsAt: w.lease.endsAt, closed: false });
    if (!sh) return false;
    sh.serviceReservationId = r.id; r.shipmentId = sh.id; r.consignmentId = sh.id;
    p.finance.transportEarned = (p.finance.transportEarned || 0) + r.freightEscrow; r.freightEscrow = 0;
    r.dispatchedAt = now; return true;
  }
  function reservationDeliveryReason(s, w, p, c, now) {
    const r = s?.service.reservation;
    if (!r || r.status !== 'purchased' || r.foreignTerms?.propertyId !== w?.property.id || r.foreignTerms.cityId !== p?.cityId
      || r.foreignTerms.liaisonId !== s.liaisonId || r.receivingWorkSeconds !== 60) return 'The original paid allocation or its reserved receiving work is unavailable.';
    return deliveryReason(s, w, p, c, now, r.receivingWorkSeconds);
  }
  function reservationNote(s, now, kind, summary, id) {
    s.service.history.push({ at: now, kind, summary, sourceId: id }); s.service.history = s.service.history.slice(-60);
  }
  function action(s, w, p, c, now, kind, options = {}, wallet = null, marketQuote = null) {
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
    if (kind === 'reviewReservation') return { ok: Boolean(quoteReservation(s, w, p, c, now, marketQuote)) };
    if (kind === 'reserveReagent') {
      const q = s.reservationQuote, unavailable = reservationReason(s, p);
      if (unavailable) return { ok: false, reason: unavailable };
      if (!q || s.service.communicationSeconds < 180 || now >= q.expiresAt || q.bodyEpoch !== c.bodyEpoch || q.tenant !== c.tenant
        || q.cityId !== p.cityId || q.propertyId !== w.property.id || q.facilityId !== s.service.client.facilityId
        || JSON.stringify(q) !== JSON.stringify(options.expected)) return { ok: false, reason: 'Review and accept the exact current reagent reservation terms at the original desk.' };
      if (s.service.reservation) (s.reservationHistory ||= []).push(copy(s.service.reservation));
      const stock = p.workshops.find(line => line.facilityId === s.service.client.facilityId && line.id === q.good);
      stock.stock -= q.quantity; s.service.communicationSeconds -= 60; w.actor.fatigue += .1;
      const r = { id: `foreign-reagent-${w.property.id}-${s.reservationSerial = (s.reservationSerial || 0) + 1}`, good: q.good, quantity: q.quantity,
        goodsUnitPrice: q.unitPrice, unitPrice: q.total / q.quantity, freightPerUnit: q.freight / q.quantity,
        expiresAt: now + q.holdSeconds, grantedAt: now, status: 'held', shipmentId: '', consignmentId: '',
        foreignTerms: copy(q), paidAt: null, receivedAt: null, receipt: null, freightEscrow: 0, receivingWorkSeconds: 0 };
      s.service.reservation = r; s.reservationQuote = null;
      reservationNote(s, now, 'reservationGranted', 'Two real factory reagent units held for four hours at the exact market ask and eight-mark delivery charge. No payment, title or usable stock yet.', r.id);
      return { ok: true, reservation: r };
    }
    if (kind === 'purchaseReagent') {
      const r = s.service.reservation;
      if (!Number.isFinite(wallet?.money) || s.service.communicationSeconds < 120 || r?.foreignTerms?.bodyEpoch !== c.bodyEpoch || r.foreignTerms.propertyId !== w.property.id
        || JSON.stringify(options.expected) !== JSON.stringify(r.foreignTerms)) return { ok: false, reason: 'Personally accept the original held reagent terms with actual sufficient funds.' };
      const result = Services.purchase(s.service, p, wallet, now);
      if (result.ok) { r.paidAt = now; r.freightEscrow = FREIGHT; r.receivingWorkSeconds = 60; s.service.communicationSeconds -= 120; w.actor.fatigue += .1;
        dispatchReservation(s, w, p, c, now); }
      return result;
    }
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
      s.observation = { at: now, ...Services.publicView(s.service), quote: copy(s.quote), liaisonId: s.liaisonId,
        reservationQuote: copy(s.reservationQuote || null), reservationHistory: copy(s.reservationHistory || []) };
    return s?.observation ? copy(s.observation) : null;
  }
  return { FREIGHT, create, contactReason, deliveryReason, quote, action, observe, reservationReason, quoteReservation, dispatchReservation, reservationDeliveryReason };
});
