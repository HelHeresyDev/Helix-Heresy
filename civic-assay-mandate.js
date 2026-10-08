(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./local-services') : root.HelixLocalServices);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCivicAssayMandate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Services) {
  'use strict';
  const TERM = 72 * 3600, LIMIT = 3, QUOTE = 3600, DISPUTE_DELAY = 24 * 3600;
  const copy = v => JSON.parse(JSON.stringify(v));
  const fail = reason => ({ ok: false, reason });
  function create(authority) {
    if (!authority?.cityId || !authority.charterId || !authority.authorityId || !authority.issuerId || !authority.reviewerId) return null;
    // Lazy run-local office representatives, not new sovereigns or additions to the reusable world.
    const names = ['Mira Holt', 'Arlen Fen', 'Vera Ash', 'Davin Reed'];
    const n = [...authority.issuerId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return { authority: copy(authority), issuer: { id: `${authority.issuerId}:assay-delegate`, name: names[n % 4], role: 'Scoped public-works delegate' },
      reviewer: { id: `${authority.reviewerId}:assay-reviewer`, name: names[(n + 1) % 4], role: 'Charter-review representative' },
      nextNumber: 1, proposal: null, mandates: [], history: [] };
  }
  function normalize(s) { return s?.authority?.charterId && Array.isArray(s.mandates) ? copy(s) : null; }
  function note(s, at, kind, summary, sourceId = '') { s.history.push({ at, kind, summary, sourceId }); s.history = s.history.slice(-64); }
  const current = s => s?.mandates.at(-1);
  const active = (m, now) => Boolean(m && m.status === 'active' && now < m.endsAt);
  const jobFor = (m, service, id) => m?.jobIds.includes(id) && service?.jobs.find(j => j.id === id && j.civic?.mandateId === m.id);
  function qualified(service) { return Boolean(service?.jobs.some(j => j.status === 'completed' && j.paidAt != null && j.result?.confidence >= Services.MIN_CONFIDENCE)); }
  function request(s, service, now, c) {
    if (!s || !service || !c.channel || !c.equipment || !c.issuerAvailable || !c.producerAvailable || service.communicationSeconds < 60 || !qualified(service))
      return fail('A supported public-works office, working analytical equipment and an actual accepted paid assessment are required; campaign chapters grant no appointment.');
    const m = current(s);
    if (m && (['active', 'suspended'].includes(m.status) || m.review?.status === 'pending' || m.jobIds.some(id => { const j = jobFor(m, service, id); return j && !j.civic.returned && j.status !== 'completed'; })))
      return fail('Close the prior mandate and obtain review of outstanding held batches before negotiating another.');
    if (s.proposal && now < s.proposal.expiresAt) return fail('The existing application is still queued or quoted.');
    if (!Number.isFinite(c.readyAt)) return fail('The issuer has no staffed work allocation.');
    const id = `civic-mandate-${s.nextNumber++}`;
    s.proposal = { id, status: 'pending', filedAt: now, readyAt: c.readyAt, expiresAt: c.readyAt + QUOTE,
      cityId: s.authority.cityId, charterId: s.authority.charterId, authorityId: s.authority.authorityId,
      issuerId: s.issuer.id, reviewerId: s.reviewer.id, facilityId: service.client.facilityId, producerId: service.client.id,
      duration: TERM, maxBatches: LIMIT, minConfidence: Services.MIN_CONFIDENCE,
      feePerBatch: Services.FEE, sampleGood: service.client.sampleGood,
      qualificationIds: service.jobs.filter(j => j.status === 'completed' && j.paidAt != null).map(j => j.id),
      duties: 'Nonliving contamination assessment only; evidence-backed clearance or quarantine, physical freight, producer-funded fees, 48-hour service deadlines, charter review. No immunity, monopoly, underground access or authority outside this city.' };
    note(s, now, 'application', 'Applied for a bounded assay delegation; the generated public-works office must complete its actual shared work queue.', id);
    service.communicationSeconds -= 60;
    return { ok: true };
  }
  function advance(s, service, now, c = {}) {
    if (!s || c.dead) return 0;
    let changed = 0;
    const p = s.proposal;
    if (p?.status === 'pending' && now >= p.readyAt && now < p.expiresAt && c.issuerAvailable) {
      p.status = 'quoted'; note(s, now, 'terms', 'Public works approved exact three-day, three-batch trial terms; the producer and scientist must explicitly agree.', p.id); changed++;
    }
    if (p && ['pending', 'quoted'].includes(p.status) && now >= p.expiresAt) { p.status = 'expired'; changed++; }
    for (const m of s.mandates) {
      if (['active', 'suspended'].includes(m.status) && now >= m.endsAt) {
        m.status = 'expired'; note(s, now, 'expiry', 'Delegated authority expired. Held goods, samples, freight, fees and service obligations remain; no automatic clearance or renewal.', m.id); changed++;
      }
      for (const id of m.jobIds) {
        const j = jobFor(m, service, id);
        if (!j || j.civic.returned || m.disputes.some(d => d.jobId === id) || now - j.acceptedAt < DISPUTE_DELAY || j.lotStatus === 'released') continue;
        const reason = ['cancelled', 'expired'].includes(j.status) ? 'Accepted assessment stopped without a protected disposition.'
          : j.lotStatus === 'quarantined' ? 'Producer disputes the quarantine and requests charter review.'
            : 'Producer requests review of a batch still withheld after one day.';
        m.disputes.push({ jobId: id, at: now, producerId: service.client.id, reason });
        note(s, now, 'producerDispute', reason, id); changed++;
      }
      const r = m.review;
      if (r?.status === 'pending' && now >= r.readyAt && c.reviewerAvailable) {
        const missed = r.evidence.filter(e => ['cancelled', 'expired'].includes(e.status) || e.overdue);
        const delayed = r.evidence.filter(e => !e.dispatched && e.age >= DISPUTE_DELAY);
        r.outcome = missed.length ? 'revoked' : delayed.length ? 'suspended' : 'upheld';
        r.reason = missed.length ? 'An accepted service ended or missed its disclosed deadline without a supported disposition; the delegation is withdrawn, not a criminal conviction.'
          : delayed.length ? 'Undispatched accepted batches were withheld for a day; further delegated decisions are suspended.'
            : 'The disclosed evidence supports protective holding or a truthful disposition; disagreement alone is not misconduct.';
        r.status = 'completed'; r.completedAt = now;
        if (r.outcome === 'revoked' || r.outcome === 'suspended' && active(m, now)) m.status = r.outcome;
        // A closed/suspended delegation returns decision responsibility through this real review, never by silently freeing stock.
        if (!active(m, now)) {
          for (const id of m.jobIds) { const j = jobFor(m, service, id); if (j) j.civic.returned = true; }
          m.handedBackAt = now;
          if (m.status === 'suspended') m.status = 'returned';
          r.reason += ' Decision responsibility returned to the producer; goods remain held until an ordinary supported assessment disposition.';
        }
        note(s, now, 'reviewDecision', r.reason, m.id); changed++;
      }
    }
    return changed;
  }
  function sign(s, service, now, expected, c) {
    const p = s?.proposal;
    if (!p || p.status !== 'quoted' || now >= p.expiresAt || JSON.stringify(p) !== JSON.stringify(expected)) return fail('Review the exact unexpired approved terms before signing.');
    if (!c.channel || !c.equipment || !c.issuerAvailable || !c.producerAvailable || service.communicationSeconds < 60 || !qualified(service)
      || service.client.facilityId !== p.facilityId || service.client.id !== p.producerId || service.client.sampleGood !== p.sampleGood)
      return fail('The original parties, office or analytical capacity are unavailable.');
    const m = { ...copy(p), status: 'active', startsAt: now, endsAt: now + TERM, jobIds: [], dispatchCount: 0, priorityJobId: '', disputes: [], review: null, priorReviews: [], handedBackAt: null };
    s.mandates.push(m); s.proposal = null;
    service.communicationSeconds -= 60;
    note(s, now, 'grant', 'Signed a bounded civic assay mandate with the public-works delegate and participating producer. No goods, fees or city sovereignty were awarded.', m.id);
    return { ok: true, mandate: m };
  }
  function enroll(s, service, production, now, freight, c) {
    const m = current(s);
    if (!active(m, now) || !c.channel || !c.issuerAvailable || !c.equipment) return fail('No current usable delegation and physical service channel.');
    if (m.jobIds.length >= LIMIT || now + Services.WINDOW > m.endsAt) return fail('The three-batch limit or remaining time cannot support another full 48-hour service obligation.');
    if (service.client.facilityId !== m.facilityId || production.cityId !== m.cityId) return fail('The mandate does not cover this producer or another city.');
    const result = Services.accept(service, production, now, freight, m.id);
    if (!result.ok) return result;
    m.jobIds.push(result.job.id); m.priorityJobId ||= result.job.id;
    note(s, now, 'enrolled', 'Identified one actual producer batch; its sample and remainder, fee escrow and freight draw from finite existing resources. Select dispatch priority explicitly.', result.job.id);
    return result;
  }
  function prioritize(s, service, id, now) {
    const m = current(s), j = jobFor(m, service, id);
    if (!active(m, now) || !j || !Services.active(j) || j.consignmentId || j.shipmentId || j.civic.dispatchApproved) return fail('Only an unbooked batch under current authority can be prioritized; existing trips cannot be preempted.');
    m.priorityJobId = id; note(s, now, 'priority', 'Selected this identified batch for the next physical sample dispatch.', id); return { ok: true };
  }
  function dispatch(s, service, now, c) {
    const m = current(s), j = jobFor(m, service, m?.priorityJobId);
    if (!active(m, now) || !c.channel || !c.issuerAvailable || !c.producerAvailable || service.communicationSeconds < 60 || !j || !Services.active(j) || j.civic.dispatchApproved) return fail('No current authorized unbooked priority sample and funded producer account work.');
    j.civic.dispatchApproved = true;
    service.communicationSeconds -= 60;
    j.civic.dispatchRank = ++m.dispatchCount;
    m.priorityJobId = m.jobIds.find(id => { const next = jobFor(m, service, id); return next && Services.active(next) && !next.civic.dispatchApproved; }) || '';
    note(s, now, 'dispatch', 'Authorized existing producer trucks and exchange freight to carry this exact sample when actual capacity is available.', j.id);
    return { ok: true };
  }
  function decide(s, service, production, wallet, id, action, now, c) {
    const m = current(s), j = jobFor(m, service, id);
    if (!active(m, now) || !c.channel || !c.issuerAvailable || !c.producerAvailable || service.communicationSeconds < 60 || !j || j.civic.returned || !Services.active(j)) return fail('No current delegated decision authority and usable producer account over this identified held batch.');
    if (action === 'hold') {
      j.lotStatus = 'civicHold'; j.civic.decision = 'hold'; j.civic.heldAt = now;
      service.communicationSeconds -= 60;
      note(s, now, 'hold', 'Issued a protective hold pending analysis or review. No supplies moved and no fee was earned.', id); return { ok: true };
    }
    const expected = { clear: 'acceptable', quarantine: 'contaminated' }[action];
    if (!expected || j.result?.finding !== expected || j.result.confidence < Services.MIN_CONFIDENCE) return fail('The requested disposition is not supported by a sufficiently confident actual assay. Uncertainty cannot be cleared by decree.');
    const result = Services.submit(service, production, id, wallet, now, m.id);
    if (result.ok) { j.civic.decision = action; note(s, now, action, `Binding ${action} received by the producer for this actual remaining batch; the ordinary truthful service fee settled once.`, id); }
    return result;
  }
  function relinquish(s, now) {
    const m = current(s);
    if (!active(m, now)) return fail('No current mandate to relinquish.');
    m.status = 'relinquished'; note(s, now, 'relinquished', 'Relinquished delegated power; outstanding held batches need charter review before responsibility is handed back.', m.id); return { ok: true };
  }
  function fileReview(s, service, now, c) {
    const m = current(s);
    if (!m || m.review?.status === 'pending' || !c.channel || !c.reviewerAvailable || !Number.isFinite(c.readyAt) || service.communicationSeconds < 60) return fail('An absent review office, pending filing, exhausted account work or closed channel grants no new review.');
    const evidence = m.jobIds.map(id => jobFor(m, service, id)).filter(Boolean).map(j => ({ id: j.id, status: c.producerFiled && Services.active(j) ? 'awaitingReport' : j.status, lotStatus: j.lotStatus,
        age: now - j.acceptedAt, overdue: Services.active(j) && now > j.dueAt, dispatched: Boolean(j.shipmentId || j.consignmentId),
        result: j.result && (!c.producerFiled || j.status === 'completed') ? copy(j.result) : null }));
    const signature = JSON.stringify([m.status, evidence.map(({ age, ...e }) => ({ ...e, delayed: age >= DISPUTE_DELAY })), m.disputes.map(d => d.jobId)]);
    if (signature === m.review?.signature) return fail('The same facts have already been reviewed; elapsed minutes and reload cannot reroll the decision.');
    if (m.review) { m.priorReviews ||= []; m.priorReviews.push(copy(m.review)); }
    m.review = { status: 'pending', filedAt: now, readyAt: c.readyAt, reviewerId: s.reviewer.id,
      filedBy: c.producerFiled ? service.client.id : 'scientist', signature, evidence, disputeIds: m.disputes.map(d => d.jobId) };
    service.communicationSeconds -= 60;
    note(s, now, 'reviewFiled', `${c.producerFiled ? 'The producer filed' : 'Filed'} the exact batch delays, disclosed findings and complaints for charter review. The saved evidence and shared office work cannot reroll on reload.`, m.id);
    return { ok: true };
  }
  function publicView(s, now) {
    if (!s) return null;
    const result = copy(s); delete result.nextNumber;
    result.reportedAt = now; return result;
  }
  return { TERM, LIMIT, QUOTE, DISPUTE_DELAY, create, normalize, current, active, qualified, request, advance, sign, enroll, prioritize, dispatch, decide, relinquish, fileReview, publicView };
});
