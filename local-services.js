(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalServices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOUR = 3600, FEE = 120, WINDOW = 48 * HOUR, MIN_CONFIDENCE = 66;
  const TYPES = [
    { kind: 'chemicalWorks', sample: 'rubber', reserve: 'assayReagent' },
    { kind: 'glassworks', sample: 'glass', reserve: 'glass' },
    { kind: 'textileWorks', sample: 'cloth', reserve: 'cloth' }
  ];
  const copy = value => JSON.parse(JSON.stringify(value));
  const number = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  const text = value => String(value || '').slice(0, 300);
  const optionalTime = value => value == null ? null : number(value);
  const active = job => ['accepted', 'sampleInTransit', 'awaitingAssay', 'assayed'].includes(job.status);
  function create(production) {
    const type = TYPES.find(t => production?.facilities?.some(f => f.kind === t.kind));
    const facility = production?.facilities?.find(f => f.kind === type?.kind);
    if (!facility) return null;
    const names = ['Tamsin Reed', 'Oren Vale', 'Ilen Moss'];
    const nameIndex = [...facility.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % names.length;
    return normalize({ client: { id: `${facility.id}:quality-account`, facilityId: facility.id, name: names[nameIndex], organization: facility.name,
      sampleGood: type.sample, reserveGood: type.reserve }, nextNumber: 1, communicationSeconds: HOUR, jobs: [], history: [], trust: 0, nextOfferAt: 0 });
  }
  function normalize(value) {
    if (!value?.client?.id) return null;
    return {
      client: Object.fromEntries(['id', 'facilityId', 'name', 'organization', 'sampleGood', 'reserveGood'].map(key => [key, text(value.client[key])])),
      nextNumber: Math.max(1, Math.floor(number(value.nextNumber))), communicationSeconds: number(value.communicationSeconds),
      trust: Math.min(10, number(value.trust)), nextOfferAt: number(value.nextOfferAt),
      jobs: (value.jobs || []).map(job => ({
        id: text(job.id), status: text(job.status), acceptedAt: number(job.acceptedAt), dueAt: number(job.dueAt),
        feeEscrow: number(job.feeEscrow), sampleFreight: number(job.sampleFreight), sourceGood: text(job.sourceGood),
        heldQuantity: number(job.heldQuantity), burden: number(job.burden), lotStatus: text(job.lotStatus),
        shipmentId: text(job.shipmentId), consignmentId: text(job.consignmentId), sampleStackId: text(job.sampleStackId),
        sampleAt: number(job.sampleAt), result: job.result ? report(job.result) : null,
        preview: job.preview ? report(job.preview) : null, paidAt: optionalTime(job.paidAt), receivedAt: optionalTime(job.receivedAt),
        civic: job.civic ? { mandateId: text(job.civic.mandateId), dispatchApproved: job.civic.dispatchApproved === true,
          dispatchRank: optionalTime(job.civic.dispatchRank), returned: job.civic.returned === true, decision: text(job.civic.decision), heldAt: optionalTime(job.civic.heldAt) } : null
      })),
      reservation: value.reservation ? { id: text(value.reservation.id), good: text(value.reservation.good), quantity: number(value.reservation.quantity),
        unitPrice: number(value.reservation.unitPrice), freightPerUnit: number(value.reservation.freightPerUnit), expiresAt: number(value.reservation.expiresAt),
        status: text(value.reservation.status), grantedAt: number(value.reservation.grantedAt), shipmentId: text(value.reservation.shipmentId), consignmentId: text(value.reservation.consignmentId) } : null,
      history: (value.history || []).slice(-60).map(entry => ({ at: number(entry.at), kind: text(entry.kind), summary: text(entry.summary), sourceId: text(entry.sourceId) }))
    };
  }
  function report(value) {
    return { id: text(value.id), jobId: text(value.jobId), sampleCollectedAt: number(value.sampleCollectedAt), measuredAt: number(value.measuredAt),
      confidence: Math.min(100, number(value.confidence)), finding: ['acceptable', 'contaminated', 'inconclusive'].includes(value.finding) ? value.finding : 'inconclusive', summary: text(value.summary) };
  }
  const facility = (state, production) => production?.facilities?.find(f => f.id === state?.client.facilityId);
  const line = (state, production, good) => production?.workshops?.find(w => w.facilityId === state?.client.facilityId && w.id === good);
  function available(state, production) {
    const f = facility(state, production);
    if (!f || f.condition < 50 || f.labour <= 0 || f.utilities <= 0 || !f.routeOpen) return 'The customer facility, staffed account, utilities or local route is unavailable.';
    if (state.communicationSeconds < 60) return 'The customer account has exhausted its allocated communications work.';
    return '';
  }
  function note(state, at, kind, summary, sourceId = '') {
    state.history.push({ at, kind, summary, sourceId }); state.history = state.history.slice(-60);
  }
  function offerReason(state, production, now, freight = 0, civicMandateId = '') {
    if (!state) return 'No supported local industrial customer is known.';
    const reason = available(state, production); if (reason) return reason;
    if (!civicMandateId && state.jobs.some(active)) return 'Complete or cancel the accepted service before accepting another.';
    if (!civicMandateId && now < state.nextOfferAt) return 'The customer has no new testing allocation yet.';
    if ((line(state, production, state.client.sampleGood)?.stock || 0) < 1) return 'The customer has no produced batch available for sampling.';
    if (production.finance.money < FEE + freight) return 'The customer cannot fund the disclosed fee and sample freight.';
    return '';
  }
  function accept(state, production, now, freight = 0, civicMandateId = '') {
    const reason = offerReason(state, production, now, freight, civicMandateId); if (reason) return { ok: false, reason };
    const f = facility(state, production), stock = line(state, production, state.client.sampleGood);
    stock.stock -= 1; production.finance.money -= FEE + freight; state.communicationSeconds -= 60;
    const job = { id: `industrial-service-${state.nextNumber++}`, status: 'accepted', acceptedAt: now, dueAt: now + WINDOW,
      feeEscrow: FEE, sampleFreight: freight, sourceGood: stock.id, heldQuantity: 0.9,
      // One captured run-owned batch, not a current remote-facility reading.
      burden: f.condition >= 85 ? 5 : f.condition >= 65 ? 35 : 65, lotStatus: 'awaitingTest', sampleAt: now,
      shipmentId: '', consignmentId: '', sampleStackId: '', result: null, preview: null, paidAt: null, receivedAt: null, civic: null };
    if (civicMandateId) job.civic = { mandateId: civicMandateId, dispatchApproved: false, dispatchRank: null, returned: false, decision: '', heldAt: null };
    state.jobs.push(job); state.nextOfferAt = now + 24 * HOUR;
    note(state, now, 'accepted', 'Accepted one captured batch. Fee escrow and sample freight funded by the customer; the remaining batch is withheld from use.', job.id);
    return { ok: true, job };
  }
  function decline(state, now) {
    if (!state || state.jobs.some(active) || now < state.nextOfferAt) return false;
    state.nextOfferAt = now + 6 * HOUR;
    note(state, now, 'declined', 'Declined the proposed work without an obligation or relationship penalty.'); return true;
  }
  function stop(state, production, job, now, kind = 'cancelled') {
    if (!job || !active(job)) return false;
    production.finance.money += job.feeEscrow; job.feeEscrow = 0;
    // A booked sample remains with its physical carrier/lab; no remote recall.
    if (!job.consignmentId) { production.finance.money += job.sampleFreight; job.sampleFreight = 0; }
    job.status = kind; job.lotStatus = 'withheld'; job.preview = null;
    state.trust = Math.max(0, state.trust - 1);
    note(state, now, kind, 'Accepted work stopped: unearned fee returned, booked transport retained, untested batch withheld. One customer-confidence loss.', job.id); return true;
  }
  function advance(state, production, now) {
    if (!state || !production) return false;
    let changed = false;
    for (const job of state.jobs) if (active(job) && now > job.dueAt) changed = stop(state, production, job, now, 'expired') || changed;
    const reservation = state.reservation;
    if (reservation?.status === 'held' && now >= reservation.expiresAt) {
      const stock = line(state, production, reservation.good);
      if (stock) { stock.stock += reservation.quantity; reservation.status = 'expired';
        note(state, now, 'reservationExpired', 'Unpurchased reserved materials returned to the customer stock.', reservation.id); changed = true; }
    }
    return changed;
  }
  function assay(burden, confidence) {
    const spread = Math.max(2, (100 - confidence) * 0.5), low = Math.max(0, burden - spread), high = burden + spread;
    const finding = confidence < MIN_CONFIDENCE ? 'inconclusive' : high <= 25 ? 'acceptable' : low > 25 ? 'contaminated' : 'inconclusive';
    return { finding, summary: finding === 'acceptable' ? 'No unacceptable contamination detected in this captured sample.'
      : finding === 'contaminated' ? 'Unacceptable contamination detected in this captured sample.' : 'Sample assessment inconclusive; obtain a fresh sample with better-supported analysis.' };
  }
  function recordAssay(state, jobId, result, sampleAt, now) {
    const job = state?.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'awaitingAssay' || now > job.dueAt || !job.sampleStackId || job.sampleAt !== sampleAt || result.sampleCollectedAt !== sampleAt) return false;
    job.result = report({ id: result.id, jobId, sampleCollectedAt: sampleAt, measuredAt: now,
      confidence: result.confidenceScore, ...assay(job.burden, result.confidenceScore) });
    job.preview = null; job.status = 'assayed'; return true;
  }
  function preview(state, jobId) {
    const job = state?.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'assayed' || !job.result) return null;
    job.preview = copy(job.result); return copy(job.preview);
  }
  function submit(state, production, jobId, wallet, now, civicMandateId = '') {
    const job = state?.jobs.find(j => j.id === jobId), reason = state && available(state, production);
    if (reason) return { ok: false, reason };
    if (job?.civic && !job.civic.returned && civicMandateId !== job.civic.mandateId)
      return { ok: false, reason: 'This batch is under a civic mandate; issue its authorized disposition or obtain an institutional handback first.' };
    if (!job || job.status !== 'assayed' || now > job.dueAt || job.feeEscrow !== FEE || !job.preview || JSON.stringify(job.preview) !== JSON.stringify(job.result)) return { ok: false, reason: 'Preview the exact current funded report before disclosure.' };
    if (job.result.finding === 'inconclusive' || job.result.confidence < MIN_CONFIDENCE) return { ok: false, reason: 'The report is inconclusive. A fresh physical sample and improved analysis are required.' };
    if (!line(state, production, job.sourceGood)) return { ok: false, reason: 'The original customer batch facility is unavailable.' };
    state.communicationSeconds -= 60; wallet.money += job.feeEscrow; job.feeEscrow = 0;
    job.status = 'completed'; job.paidAt = now; job.lotStatus = job.result.finding === 'acceptable' ? 'released' : 'quarantined';
    // Negative findings earn the same fee. Only the actual remaining lot moves.
    if (job.lotStatus === 'released') { line(state, production, job.sourceGood).stock += job.heldQuantity; job.heldQuantity = 0; }
    job.preview = null; state.trust = Math.min(10, state.trust + 1);
    note(state, now, 'completed', `Truthful report received; fee paid. Captured batch ${job.lotStatus}.`, job.id); return { ok: true, job, amount: FEE };
  }
  function resample(state, production, jobId, now, freight = 0) {
    const job = state?.jobs.find(j => j.id === jobId), reason = state && available(state, production);
    if (reason) return { ok: false, reason };
    if (!job || job.status !== 'assayed' || job.result?.finding !== 'inconclusive' || now > job.dueAt || job.heldQuantity < 0.1 || production.finance.money < freight)
      return { ok: false, reason: 'No funded fresh sample from this held batch is available.' };
    job.heldQuantity = Math.round((job.heldQuantity - 0.1) * 10) / 10; production.finance.money -= freight; state.communicationSeconds -= 60;
    job.sampleFreight = freight; job.sampleAt = now; job.status = 'accepted';
    job.shipmentId = ''; job.consignmentId = ''; job.sampleStackId = ''; job.result = null; job.preview = null;
    if (job.civic && !job.civic.returned) { job.civic.dispatchApproved = false; job.civic.dispatchRank = null; }
    note(state, now, 'resampled', 'Fresh portion consumed from the same captured batch; original contamination and deadline unchanged.', job.id); return { ok: true, job };
  }
  function reserve(state, production, now, unitPrice, freightPerUnit) {
    const reason = state && available(state, production); if (reason) return { ok: false, reason };
    if (!state || state.trust < 2) return { ok: false, reason: 'The customer requires two reliable completed assessments.' };
    if (state.reservation?.status === 'held' || state.reservation?.status === 'purchased' && !state.reservation.consignmentId)
      return { ok: false, reason: 'The existing reservation is held or its paid cargo still awaits physical depot handoff.' };
    const last = [...state.history].reverse().find(e => e.kind === 'completed');
    if (!last || state.history.some(e => e.kind === 'reservationGranted' && e.sourceId === last.sourceId)) return { ok: false, reason: 'Complete another useful service before requesting another allocation.' };
    const stock = line(state, production, state.client.reserveGood);
    if (!stock || stock.stock < 4) return { ok: false, reason: 'Refused: the customer cannot spare two units while retaining its own two-unit allocation.' };
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(freightPerUnit) || freightPerUnit < 0 || unitPrice < freightPerUnit) return { ok: false, reason: 'A current lawful materials quote is unavailable.' };
    stock.stock -= 2; state.communicationSeconds -= 60;
    state.reservation = { id: `${last.sourceId}:reservation`, good: stock.id, quantity: 2, unitPrice, freightPerUnit,
      expiresAt: now + 4 * HOUR, status: 'held', grantedAt: now, shipmentId: '', consignmentId: '' };
    note(state, now, 'reservationGranted', 'Two actual material units held for four hours at the disclosed normal quote. Payment and physical delivery are still required.', last.sourceId);
    return { ok: true, reservation: state.reservation };
  }
  function purchase(state, production, wallet, now) {
    const r = state?.reservation, reason = state && available(state, production);
    if (reason) return { ok: false, reason };
    if (!r || r.status !== 'held' || now >= r.expiresAt) return { ok: false, reason: 'No unexpired held reservation is available.' };
    const total = Math.round(r.quantity * r.unitPrice);
    if (wallet.money < total) return { ok: false, reason: 'Insufficient company funds; reserved stock remains held until expiry.' };
    wallet.money -= total; production.finance.money += total - r.quantity * r.freightPerUnit;
    r.status = 'purchased'; note(state, now, 'reservationPurchased', 'Reserved stock paid for; title transferred, but no materials have reached the laboratory yet.', r.id);
    return { ok: true, reservation: r, total };
  }
  function publicView(state) {
    if (!state) return null;
    return { client: copy(state.client), trust: state.trust, nextOfferAt: state.nextOfferAt,
      jobs: state.jobs.map(({ burden, feeEscrow, heldQuantity, sampleFreight, shipmentId, ...job }) => copy(job)),
      reservation: state.reservation ? copy(state.reservation) : null, history: copy(state.history) };
  }
  return { FEE, WINDOW, MIN_CONFIDENCE, create, normalize, active, available, offerReason, accept, decline, stop, advance, assay, recordAssay, preview, submit, resample, reserve, purchase, publicView };
});
