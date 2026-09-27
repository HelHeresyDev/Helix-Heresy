(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPaymentRecords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50;
  const online = s => s?.channelPowered && s.credentialActive;
  const ready = p => p?.active && p.channelPowered && able(p.operator) && p.operator.locationId === p.id;
  const scope = 'Provider money handling and authenticated account messages only. Not civil identity, physical delivery, completed sale, account ownership, knowing illegality, guilt or enforcement authority. Communications do not grant foreign jurisdiction.';
  function provision(state, broker, at) {
    if (!state.homeId || !broker || broker.homeCityId !== state.homeId || !broker.serviceCityIds?.includes(state.homeId)) return;
    state.paymentProviders ||= [];
    if (state.paymentProviders.length) return;
    const id = `${state.homeId}:independent-settlement`;
    state.paymentProviders.push({ id, cityId: state.homeId, establishedAt: at, sponsor: broker.id, active: true, channelPowered: true,
      contact: { accountId: id, handle: `${id}:contact`, label: 'Local independent settlement office' },
      operator: { id: `${id}:operator`, name: 'Settlement operator', locationId: id, status: 'alive', health: 100 },
      fee: 20, money: 0, held: 0, power: 24, workSeconds: 14400, assignment: null, availableAt: at, releaseConsent: true,
      customer: { contact: { accountId: `${id}:seller`, handle: `${id}:seller-channel`, label: 'Customer settlement account' }, channelPowered: true, credentialActive: true, consent: true, customerCopy: true, releaseConsent: true },
      accounts: [], cases: [], records: [], jobs: [], nextNumber: 1 });
  }
  function quote(state, q, request) {
    const p = state.paymentProviders?.find(p => p.id === request.paymentProviderId), b = state.buyers.find(b => b.id === q.buyerId), op = state.operators.find(o => o.id === q.operatorId);
    if (!ready(p) || !online(p.customer) || !p.customer.consent || !online(b?.buyerService) || b.buyerService.paymentConsent !== true
      || !online(op?.carrierService) || op.carrierService.paymentConsent !== true || q.livingPlan || !request.localPayee?.accountId || !request.localPayee?.handle || p.power < 1 || p.workSeconds < 600 || b.money < q.gross + p.fee) return null;
    return { provider: copy(p.contact), cityId: p.cityId, fee: p.fee, feePayer: 'buyer', gross: q.gross,
      payer: copy(b.buyerService.contact), seller: copy(p.customer.contact), local: copy(request.localPayee), freight: copy(op.carrierService.contact),
      amounts: { local: q.localFreight, freight: q.intercityFreight, seller: q.net },
      conditions: 'One funding power allocation on booking; provider holds the actual funds. Each authenticated release/refund instruction takes ten minutes of available operator work and one power allocation. Depot account report queues local freight; buyer receipt report queues transit freight and seller proceeds. Buyer cancellation or customer pre-collection cancellation refunds only still-reserved amounts. Missing messages leave funds held, including after physical failure. No hidden shipment-state lookup, automatic timeout refund or backdated release. Fees are nonrefundable. Late contradictory reports are retained, not a second payment. ' + scope };
  }
  function account(p, endpoint, enroll = false) {
    let a = p.accounts.find(a => same(a.contact, endpoint));
    if (!a && enroll) { a = { contact: copy(endpoint), balance: 0, active: true, releaseConsent: true }; p.accounts.push(a); }
    return a;
  }
  function append(p, c, kind, at, data = {}) {
    const document = { id: `${p.id}:entry:${p.nextNumber++}`, caseReference: c.id, shipmentReference: c.shipmentReference,
      kind, at, office: copy(p.contact), cityId: p.cityId, ...copy(data), scope };
    p.records.push({ document });
    if (c.customerCopy && online(p.customer)) c.documents.push(copy(document));
    return document;
  }
  function fund(state, sh, q, at) {
    const p = state.paymentProviders.find(p => same(p.contact, q.provider)), b = state.buyers.find(b => b.id === sh.buyerId);
    if (sh.paymentCase || !same(sh.payment, q) || !ready(p) || !online(p.customer) || !online(b?.buyerService) || b.buyerService.paymentConsent !== true
      || p.power < 1 || p.fee !== q.fee || b.money < q.gross + q.fee || q.gross !== Object.values(q.amounts).reduce((a, n) => a + n, 0)) return false;
    // Called only after the exact booking quote has been revalidated; this is the sole escrow debit.
    b.money -= q.gross + q.fee; p.held += q.gross; p.money += q.fee; p.power--;
    const id = `${p.id}:escrow:${p.cases.length + 1}`;
    const c = { id, shipmentReference: sh.id, openedAt: at, quote: copy(q), legs: {}, documents: [], received: [], customerCopy: p.customer.customerCopy && b.buyerService.paymentCustomerCopy !== false,
      releaseChoices: [], claimed: { local: 0, freight: 0, seller: 0, refund: 0 }, credits: { local: 0, freight: 0, seller: 0, refund: 0 } };
    for (const [leg, amount] of Object.entries(q.amounts)) c.legs[leg] = { amount, status: 'reserved' };
    for (const endpoint of [q.payer, q.seller, q.local, q.freight]) account(p, endpoint, true);
    p.cases.push(c); sh.paymentCase = { providerId: p.id, id }; sh.paymentDocuments = c.documents;
    append(p, c, 'fundingReceived', at, { from: q.payer, amount: q.gross });
    append(p, c, 'providerFeePaid', at, { from: q.payer, to: p.contact, amount: q.fee });
    append(p, c, 'fundsReserved', at, { allocations: Object.entries(q.amounts).map(([leg, amount]) => ({ leg, amount, to: q[leg] })) });
    return true;
  }
  function lookup(state, sh) {
    const p = state.paymentProviders?.find(p => p.id === sh?.paymentCase?.providerId), c = p?.cases.find(c => c.id === sh.paymentCase.id);
    return c ? { p, c } : null;
  }
  function receive(p, c, document, service, at) {
    if (!ready(p) || !online(service) || !document || document.shipmentReference !== c.shipmentReference || document.at < c.openedAt || document.at > at
      || !service.records?.some(r => same(r.document, document)) || c.received.some(r => r.id === document.id && same(r.from, service.contact))) return false;
    const depot = document.kind === 'receivedAtDepot' && same(service.contact, c.quote.freight);
    const receipt = document.kind === 'deliveryReceived' && same(service.contact, c.quote.payer);
    const cancellation = document.kind === 'cancellationAcknowledged' && same(service.contact, c.quote.payer)
      || document.kind === 'customerCancellation' && same(service.contact, c.quote.seller);
    if (!depot && !receipt && !cancellation) return false;
    const legs = Object.keys(c.legs).filter(leg => c.legs[leg].status === 'reserved' && (cancellation || depot && leg === 'local' || receipt && leg !== 'local'));
    c.received.push({ id: document.id, from: copy(service.contact), receivedAt: at });
    const evidence = append(p, c, 'authenticatedInstructionReceived', at, { message: copy(document), from: service.contact, reportedCondition: depot ? 'depotReceiptReported' : receipt ? 'buyerReceiptReported' : 'cancellationReported', outcome: legs.length ? 'reportedConditionSatisfied' : 'noUnreservedFunds; contradictoryOrRepeatedClaimRetained' });
    if (!legs.length) return true;
    for (const leg of legs) c.legs[leg].status = 'queued';
    const allocations = cancellation ? [{ leg: 'refund', amount: legs.reduce((n, leg) => n + c.legs[leg].amount, 0), to: c.quote.payer }]
      : legs.map(leg => ({ leg, amount: c.legs[leg].amount, to: c.quote[leg] }));
    const j = { id: `${evidence.id}:settlement`, caseId: c.id, legs, allocations, progress: 0, lastAt: at, wasReady: true, paid: false };
    p.jobs.push(j); append(p, c, 'paymentQueued', at, { instructionId: evidence.id, allocations }); return true;
  }
  function customerCancel(state, sh, at) {
    const f = lookup(state, sh); if (!f) return;
    const { p, c } = f;
    // A prospective customer instruction, not a search of private cargo state by the provider.
    c.customerInstructions ||= [];
    if (c.customerInstructions.length || !p.customer.consent) return;
    c.customerInstructions.push({ document: { id: `${c.id}:customer-cancellation`, shipmentReference: sh.id, kind: 'customerCancellation', at,
      scope: 'Customer requests pre-collection cancellation under the accepted escrow terms; no provider observation of cargo.' } });
  }
  function relay(state, sh, at) {
    const f = lookup(state, sh); if (!f) return;
    const { p, c } = f, b = state.buyers.find(b => same(b.buyerService?.contact, c.quote.payer)), op = state.operators.find(o => same(o.carrierService?.contact, c.quote.freight));
    const sources = [op?.carrierService, b?.buyerService, { ...p.customer, records: c.customerInstructions || [] }].filter(Boolean);
    for (const s of sources) for (const r of s.records || []) if (r.document.shipmentReference === c.shipmentReference) receive(p, c, r.document, s, at);
    // Customer copies survive reload independently; later outages never backfill missing statements.
    sh.paymentDocuments = copy(c.documents);
  }
  function release(p, j, at) { if (p.assignment === j.id) { p.assignment = null; p.availableAt = at; } }
  function advance(state, at) {
    for (const p of state.paymentProviders || []) {
      for (const j of p.jobs.filter(j => !j.completedAt)) {
        if (at < j.lastAt) continue;
        const c = p.cases.find(c => c.id === j.caseId), start = Math.max(j.lastAt, p.availableAt || 0);
        const available = ready(p) && (!p.assignment || p.assignment === j.id) && p.workSeconds > 0 && (j.paid || p.power >= 1)
          && j.allocations.every(a => account(p, a.to)?.active);
        if (!available) { release(p, j, at); j.lastAt = at; j.wasReady = false; continue; }
        p.assignment = j.id;
        if (!j.paid) { p.power--; j.paid = true; }
        const work = j.wasReady ? Math.min(600 - j.progress, Math.max(0, at - start), p.workSeconds) : 0;
        p.workSeconds -= work; j.progress += work; j.lastAt = at; j.wasReady = true;
        if (j.progress < 600) continue;
        const date = start + work;
        if (j.correction) append(p, c, 'recordCorrection', date, { supersedes: j.correction.recordId, reason: j.correction.reason, moneyMovement: 0,
          limitation: 'Originating provider corrects the cited record; original retained. This correction neither reverses money nor certifies an alternative cargo history.' });
        for (const a of j.allocations) {
          p.held -= a.amount; account(p, a.to).balance += a.amount; c.credits[a.leg] += a.amount;
          append(p, c, a.leg === 'refund' ? 'refundCompleted' : 'paymentCompleted', date, { leg: a.leg, amount: a.amount, to: a.to, jobReference: j.id });
        }
        for (const leg of j.legs) c.legs[leg].status = j.allocations[0].leg === 'refund' ? 'refunded' : 'paid';
        j.completedAt = date; release(p, j, date);
      }
    }
    for (const sh of state.shipments) {
      const f = lookup(state, sh); if (!f) continue;
      const b = state.buyers.find(b => same(b.buyerService?.contact, f.c.quote.payer)), op = state.operators.find(o => same(o.carrierService?.contact, f.c.quote.freight));
      if (b && online(b.buyerService)) b.money += claim(state, sh, 'refund', b.buyerService.contact, at);
      if (op && online(op.carrierService)) op.money += claim(state, sh, 'freight', op.carrierService.contact, at);
      sh.paymentDocuments = copy(f.c.documents);
    }
  }
  function claim(state, sh, leg, endpoint, at) {
    const f = lookup(state, sh); if (!f || !['local', 'freight', 'seller', 'refund'].includes(leg)) return 0;
    const { p, c } = f, to = c.quote[leg === 'refund' ? 'payer' : leg], amount = c.credits[leg] - c.claimed[leg], a = account(p, to);
    if (!ready(p) || !same(to, endpoint) || !a?.active || amount <= 0 || a.balance < amount || leg === 'seller' && !online(p.customer)) return 0;
    a.balance -= amount; c.claimed[leg] += amount; append(p, c, 'accountWithdrawal', at, { leg, amount, from: to }); sh.paymentDocuments = copy(c.documents); return amount;
  }
  function correct(p, recordId, reason, at) {
    const r = p?.records.find(r => r.document.id === recordId), c = p?.cases.find(c => c.id === r?.document.caseReference);
    if (!ready(p) || !c || !reason?.trim() || at < r.document.at || p.assignment || p.power < 1 || p.workSeconds < 600) return false;
    if (p.jobs.some(j => j.correction?.recordId === recordId)) return false;
    p.jobs.push({ id: `${recordId}:correction`, caseId: c.id, correction: { recordId, reason: reason.trim().slice(0, 300) }, legs: [], allocations: [], progress: 0, lastAt: at, wasReady: true, paid: false }); return true;
  }
  function preview(sh) {
    const records = sh?.paymentDocuments; if (!records?.length) return null;
    return { kind: 'paymentRecords', sourceId: `${records[0].caseReference}:customer-statement`, contact: copy(records[0].office), records: copy(records), releaseConsent: true,
      limitation: 'Exact customer statement only. Account parties and provider separately permit source access. Corrections do not reverse money; refunds remain visible. ' + scope };
  }
  function next(i) {
    const submission = i.submissions.find(s => s.document.kind === 'paymentRecords' && !(i.paymentResponses || []).some(r => r.submissionId === s.id));
    return submission ? { kind: 'paymentRecords', submission } : null;
  }
  function prepare(providers, i, submission, kind, at, allocated = false, assignment = null, buyers = []) {
    const p = providers.find(p => same(p.contact, submission.document.contact));
    if (!ready(p) || p.assignment && p.assignment !== assignment || p.workSeconds <= 0 || !allocated && p.power < 1) return null;
    const selected = p.records.filter(r => submission.document.records.some(d => d.id === r.document.id));
    const cases = p.cases.filter(c => selected.some(r => r.document.caseReference === c.id));
    for (const c of cases) {
      if (c.releaseChoices.some(v => v.investigationId === i.id) || !submission.document.releaseConsent) continue;
      const b = buyers.find(b => same(b.buyerService?.contact, c.quote.payer));
      if (!online(b?.buyerService) || !online(p.customer) || b.buyerService.power < 1) return null;
      b.buyerService.power--;
      c.releaseChoices.push({ investigationId: i.id, at, consent: p.releaseConsent && p.customer.releaseConsent && b.buyerService.paymentReleaseConsent === true
        && [c.quote.payer, c.quote.seller, c.quote.local, c.quote.freight].every(e => account(p, e)?.releaseConsent) });
    }
    return { service: p, witness: p.operator, provider: p, selected, cases };
  }
  function complete(i, submission, kind, ctx, at) {
    i.paymentResponses ||= [];
    const comparisons = submission.document.records.map(d => {
      const r = ctx.selected.find(r => r.document.id === d.id), c = ctx.cases.find(c => c.id === r?.document.caseReference);
      const permit = submission.document.releaseConsent && c?.releaseChoices.some(v => v.investigationId === i.id && v.consent);
      return { recordId: d.id, result: !r ? 'unavailable' : !permit ? 'notReleased' : !same(r.document, d) ? 'alteredCopy' : 'matchesProviderRecord', record: permit && r && same(r.document, d) ? copy(d) : null };
    });
    i.paymentResponses.push({ id: `${submission.id}:paymentRecords`, submissionId: submission.id, at, account: copy(ctx.provider.contact), cityId: ctx.provider.cityId, comparisons,
      limit: 'Provider ledger and operator are one source. Embedded buyer/carrier reports remain derived from those accounts, not independent delivery evidence. Refusal implies no guilt. ' + scope });
  }
  const findings = (i, cityId) => (i.paymentResponses || []).map(r => ({ ...copy(r), jurisdiction: r.cityId === cityId ? 'local provider record' : 'foreign provider record; voluntary information only' }));
  return { provision, quote, fund, lookup, receive, customerCancel, relay, advance, claim, correct, preview, next, prepare, complete, findings };
});
