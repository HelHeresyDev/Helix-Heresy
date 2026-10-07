(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./local-covert-market') : root.HelixLocalCovertMarket);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixConfidentialServices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Local) {
  'use strict';
  const HOUR = 3600, FEE = 180, WINDOW = 48 * HOUR, PORTION = 0.1, MIN_CONFIDENCE = 66;
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const num = x => Math.max(0, Number.isFinite(Number(x)) ? Number(x) : 0), str = x => String(x || '').slice(0, 300);
  const quantity = x => Math.round(x * 10000) / 10000;
  const active = j => ['sampleInTransit', 'awaitingAssay', 'assayed'].includes(j.status);
  function normalize(value) {
    if (!value?.client?.id) return null;
    return { client: { id: str(value.client.id), name: str(value.client.name), cityId: str(value.client.cityId) },
      money: num(value.money), vials: Math.floor(num(value.vials)), workSeconds: num(value.workSeconds),
      nextNumber: Math.max(1, Math.floor(num(value.nextNumber))), nextOfferAt: num(value.nextOfferAt),
      quote: value.quote ? copy(value.quote) : null,
      jobs: (value.jobs || []).map(j => ({ ...copy(j), result: j.result ? report(j.result) : null, preview: j.preview ? report(j.preview) : null, disclosed: j.disclosed ? report(j.disclosed) : null })),
      history: (value.history || []).slice(-60).map(e => ({ at: num(e.at), kind: str(e.kind), jobId: str(e.jobId), summary: str(e.summary) })) };
  }
  function supported(entry) {
    const b = entry?.stack?.chemicalBatch;
    return entry?.kind === 'chemicalBatch' && !entry.creature && entry.stack?.section === 'chemicalBatches' && entry.amount >= PORTION
      && b?.id && Number.isFinite(b.purity) && b.phase === 'liquid' && b.packaging?.state === 'packaged'
      && ![...(b.tags || []), ...(b.hazards || [])].some(t => /soul|animantic|living|volatile|explosive|radioactive/i.test(t));
  }
  function lots(local, contactId) {
    return (local?.collections || []).filter(c => !c.kind && c.contactId === contactId && c.owner === contactId && c.phase === 'returned'
      && !c.canceled && !c.transferredTo && c.manifest?.commodityKind === 'manufactured').flatMap(c => c.manifest.entries.map((entry, index) => ({ source: c, entry, index })))
      .filter(l => supported(l.entry));
  }
  function create(local, contacts) {
    const contact = contacts.find(c => c.homeCityId === local?.cityId && c.serviceCityIds?.includes(local.cityId) && lots(local, c.id).some(l => !l.entry.analyticalHold));
    if (!contact) return null;
    // A single saved local customer's bounded analytical allocation. Neither a
    // new lot nor a reload replenishes these funds, vials or account work.
    return normalize({ client: { id: contact.id, name: contact.name, cityId: local.cityId }, money: 500, vials: 4, workSeconds: HOUR,
      nextNumber: 1, nextOfferAt: 0, quote: null, jobs: [], history: [] });
  }
  const customer = (state, contacts) => contacts.find(c => c.id === state?.client.id);
  function channel(state, contacts, now) {
    const c = customer(state, contacts);
    if (!c || c.homeCityId !== state.client.cityId || !c.serviceCityIds?.includes(state.client.cityId)) return 'The original local customer account is unavailable.';
    if ((c.unavailableUntil || 0) > now || state.workSeconds < 60) return 'The customer account is unavailable or has no allocated communications work.';
    return '';
  }
  const note = (s, at, kind, jobId, summary) => { s.history.push({ at, kind, jobId, summary }); s.history = s.history.slice(-60); };
  function offer(state, local, contacts, route, now) {
    if (!state) return { ok: false, reason: 'No known local customer has a supported physically received chemical lot.' };
    const reason = channel(state, contacts, now); if (reason) return { ok: false, reason };
    if (state.jobs.some(active) || now < state.nextOfferAt) return { ok: false, reason: 'Complete the accepted assessment or wait for the next customer allocation.' };
    const lot = lots(local, state.client.id).find(l => !l.entry.analyticalHold);
    if (!lot) return { ok: false, reason: 'No unassessed customer-owned packaged liquid lot is available at the local depot. Living, soul-affecting and unstable cargo require other protocols.' };
    const cargo = { massKg: PORTION + 0.1, volumeL: PORTION + 0.1 }, check = Local.availability(local, customer(state, contacts), route, cargo);
    if (!check.ok) return check;
    const freight = Math.ceil(12 + route.distanceKm * 0.8);
    if (state.money < FEE + freight || state.vials < 1) return { ok: false, reason: 'The customer cannot fund fee escrow, sample freight or a sealing vial from its remaining allocation.' };
    const b = lot.entry.stack.chemicalBatch;
    return { ok: true, sourceId: lot.source.id, entryIndex: lot.index, sourceStackId: lot.entry.sourceStackId || lot.entry.stack.id,
      batchId: b.id, label: b.label || lot.source.manifest.material, declaredHazards: [...(b.hazards || [])], sourceQuantity: lot.entry.amount,
      portion: PORTION, fee: FEE, freight, distanceKm: route.distanceKm, courierId: check.courierId, cargo,
      fingerprint: JSON.stringify(lot.entry), expiresAt: now + HOUR };
  }
  function request(state, local, contacts, route, now) {
    const q = offer(state, local, contacts, route, now);
    if (state) state.quote = q.ok ? q : null;
    return q;
  }
  function findLot(local, job) {
    const source = local.collections.find(c => c.id === job.sourceId);
    return { source, entry: source?.manifest?.entries[job.entryIndex] };
  }
  function heldLot(state, local, job) {
    const lot = findLot(local, job);
    return lot.source?.owner === state.client.id && lot.source.phase === 'returned' && !lot.source.canceled && !lot.source.transferredTo
      && lot.entry?.analyticalHold?.jobId === job.id && JSON.stringify(lot.entry.stack?.chemicalBatch) === job.batchFingerprint ? lot : null;
  }
  function debitPortion(lot) {
    lot.entry.amount = quantity(lot.entry.amount - PORTION);
    lot.entry.stack.quantity = lot.entry.stack.knownQuantity = lot.entry.amount;
    lot.source.manifest.amount = quantity(lot.source.manifest.entries.reduce((sum, e) => sum + e.amount, 0));
  }
  function transport(state, local, contacts, route, job, freight, now) {
    const r = Local.book(local, customer(state, contacts), route, `${job.id}:portion:${job.round}`, { massKg: 0.2, volumeL: 0.2 }, now);
    if (!r.ok) return r;
    const c = r.collection;
    c.kind = 'confidentialSample'; c.serviceJobId = job.id; c.sampleRound = job.round; c.owner = state.client.id;
    c.manifest = { commodityKind: 'analyticalSample', material: job.label, jobId: job.id, batchId: job.batchId, amount: PORTION, round: job.round,
      batch: JSON.parse(job.batchFingerprint), entries: [{ kind: 'analyticalSample', amount: PORTION, sourceStackId: job.sourceStackId }] };
    c.fee = freight; state.money -= freight; state.vials--; state.workSeconds -= 60;
    local.couriers.find(v => v.id === c.courierId).money += freight;
    job.collectionId = c.id; job.sampleAt = now; job.status = 'sampleInTransit'; job.sampleStatus = 'courier'; job.sampleStackId = '';
    job.result = null; job.preview = null;
    return { ok: true, job };
  }
  function accept(state, local, contacts, route, expected, now) {
    const fresh = offer(state, local, contacts, route, now); if (!fresh.ok) return fresh;
    if (!expected || now > expected.expiresAt || !same(expected, state.quote)
      || ['sourceId', 'entryIndex', 'fingerprint', 'fee', 'freight', 'courierId', 'distanceKm'].some(k => expected[k] !== fresh[k])) return { ok: false, reason: 'The exact lot, courier or terms changed or expired; review a new quote.' };
    const lot = { source: local.collections.find(c => c.id === fresh.sourceId) }; lot.entry = lot.source.manifest.entries[fresh.entryIndex];
    const b = lot.entry.stack.chemicalBatch;
    const job = { id: `confidential-service-${state.nextNumber}`, sourceId: fresh.sourceId, entryIndex: fresh.entryIndex, sourceStackId: fresh.sourceStackId,
      batchId: fresh.batchId, label: fresh.label, declaredHazards: fresh.declaredHazards, acceptedAt: now, dueAt: now + WINDOW,
      batchFingerprint: JSON.stringify(b), signal: { purity: b.purity, contamination: Object.values(b.contaminants || {}).reduce((n, v) => n + num(v), 0) },
      feeEscrow: FEE, lotStatus: 'awaitingTest', round: 1, reportStackId: '', disclosed: null };
    const booked = transport(state, local, contacts, route, job, fresh.freight, now); if (!booked.ok) return booked;
    debitPortion(lot); lot.entry.analyticalHold = { jobId: job.id, status: 'awaitingTest' };
    state.money -= FEE; state.nextNumber++; state.jobs.push(job); state.quote = null; state.nextOfferAt = now + 24 * HOUR;
    note(state, now, 'accepted', job.id, 'Customer funded confidential sample transport and fee escrow. Its actual remaining lot is withheld.');
    return booked;
  }
  function decline(state, now) {
    if (!state?.quote || state.jobs.some(active)) return false;
    state.quote = null; state.nextOfferAt = now + 6 * HOUR;
    note(state, now, 'declined', '', 'Declined without payment, material consumption or a relationship penalty.'); return true;
  }
  function ready(state, local, id, context, now) {
    const job = state?.jobs.find(j => j.id === id), c = local.collections.find(c => c.id === job?.collectionId);
    if (!job || job.status !== 'sampleInTransit' || now > job.dueAt || !context.scientistPresent) return { ok: false, reason: 'An able scientist must meet the active sample courier at the Concealed Exit before the deadline.' };
    if (!c || c.kind !== 'confidentialSample' || c.phase !== 'waiting' || c.reason || c.owner !== state.client.id || c.sampleRound !== job.round
      || c.manifest?.jobId !== id || c.manifest.round !== job.round || c.manifest.amount !== PORTION || JSON.stringify(c.manifest.batch) !== job.batchFingerprint)
      return { ok: false, reason: 'The actual loaded courier is not ready at the Concealed Exit.' };
    return { ok: true, job, collection: c };
  }
  function receive(state, local, id, stackId, context, now) {
    const r = ready(state, local, id, context, now); if (!r.ok || !stackId) return r.ok ? { ok: false, reason: 'No physical sealed sample was created.' } : r;
    const { job, collection: c } = r;
    c.manifest = null; c.receivedAt = now; c.phase = 'returning'; c.lastAt = now;
    local.couriers.find(v => v.id === c.courierId).location = 'returning empty after confidential sample delivery';
    job.sampleStackId = stackId; job.sampleStatus = 'laboratory'; job.receivedAt = now; job.status = 'awaitingAssay'; return r;
  }
  function assay(signal, confidence) {
    const p = Math.max(2, (100 - confidence) * 0.2), c = Math.max(0.02, (100 - confidence) * 0.005);
    const purity = { low: quantity(Math.max(0, signal.purity - p)), high: quantity(Math.min(100, signal.purity + p)) };
    const contamination = { low: quantity(Math.max(0, signal.contamination - c)), high: quantity(signal.contamination + c) };
    const finding = confidence < MIN_CONFIDENCE ? 'inconclusive' : purity.high < 70 || contamination.low > 0.25 ? 'unacceptable'
      : purity.low >= 70 && contamination.high <= 0.25 ? 'acceptable' : 'inconclusive';
    return { purity, contamination, finding, summary: `${finding === 'acceptable' ? 'Sample meets' : finding === 'unacceptable' ? 'Sample fails' : 'Cannot resolve'} the declared purity and contamination limits. This is not a recipe identification or legal certificate.` };
  }
  function report(r) {
    return { id: str(r.id), jobId: str(r.jobId), batchId: str(r.batchId), sampleCollectedAt: num(r.sampleCollectedAt), measuredAt: num(r.measuredAt),
      confidence: Math.min(100, num(r.confidence)), purity: { low: num(r.purity?.low), high: num(r.purity?.high) },
      contamination: { low: num(r.contamination?.low), high: num(r.contamination?.high) },
      finding: ['acceptable', 'unacceptable', 'inconclusive'].includes(r.finding) ? r.finding : 'inconclusive', summary: str(r.summary) };
  }
  function recordAssay(state, id, result, round, now) {
    const job = state?.jobs.find(j => j.id === id);
    if (!job || job.status !== 'awaitingAssay' || !job.sampleStackId || job.round !== round || job.sampleAt !== result.sampleCollectedAt || now > job.dueAt) return false;
    job.result = report({ id: result.id, jobId: id, batchId: job.batchId, sampleCollectedAt: job.sampleAt, measuredAt: now,
      confidence: result.confidenceScore, ...assay(job.signal, result.confidenceScore) });
    job.preview = null; job.status = 'assayed'; job.sampleStatus = 'consumed'; return true;
  }
  function preview(state, id) {
    const job = state?.jobs.find(j => j.id === id);
    if (job?.status !== 'assayed' || !job.result || job.result.finding === 'inconclusive') return null;
    job.preview = report(job.result); return copy(job.preview);
  }
  function submit(state, local, contacts, id, wallet, now) {
    const reason = state && channel(state, contacts, now); if (reason) return { ok: false, reason };
    const job = state?.jobs.find(j => j.id === id), lot = job && heldLot(state, local, job);
    if (!job || job.status !== 'assayed' || now > job.dueAt || job.feeEscrow !== FEE || !job.preview || !same(job.preview, job.result)
      || job.result.confidence < MIN_CONFIDENCE || job.result.finding === 'inconclusive') return { ok: false, reason: 'Preview the exact useful funded report before disclosure; inconclusive work needs another physical sample.' };
    if (!lot) return { ok: false, reason: 'The original held customer batch changed or is unavailable.' };
    wallet.money += job.feeEscrow; job.feeEscrow = 0; state.workSeconds -= 60; job.status = 'completed'; job.paidAt = now;
    job.lotStatus = job.result.finding === 'acceptable' ? 'released' : 'quarantined'; lot.entry.analyticalHold.status = job.lotStatus;
    job.disclosed = report(job.preview); job.preview = null;
    const c = customer(state, contacts); c.trust = Math.min(100, num(c.trust) + 2);
    note(state, now, 'completed', id, 'Exact scoped report received; escrow paid once, customer trust improved, actual remaining lot released or quarantined.');
    return { ok: true, job, amount: FEE };
  }
  function stop(state, local, contacts, id, now, status = 'cancelled') {
    const job = state?.jobs.find(j => j.id === id); if (!job || !active(job)) return false;
    state.money += job.feeEscrow; job.feeEscrow = 0; job.status = status; job.preview = null; job.lotStatus = 'withheld';
    const lot = heldLot(state, local, job); if (lot) lot.entry.analyticalHold.status = 'withheld';
    const c = local.collections.find(c => c.id === job.collectionId);
    if (c?.manifest && ['outbound', 'waiting'].includes(c.phase)) { c.phase = 'returning'; c.canceled = true; c.lastAt = now; }
    const contact = customer(state, contacts); if (contact) contact.trust = Math.max(0, num(contact.trust) - 1);
    note(state, now, status, id, 'Unearned fee refunded once; departed freight retained, untested remainder withheld and customer trust reduced. Physical sample custody preserved.'); return true;
  }
  function advance(state, local, contacts, now) {
    if (!state) return 0;
    let changed = 0;
    for (const job of state.jobs) {
      if (active(job) && now > job.dueAt) changed += Number(stop(state, local, contacts, job.id, now, 'expired'));
      const c = local.collections.find(c => c.id === job.collectionId);
      if (!active(job) && c?.manifest && c.kind === 'confidentialSample' && ['returned', 'canceled'].includes(c.phase)) {
        const lot = heldLot(state, local, job);
        if (lot) {
          lot.entry.amount = quantity(lot.entry.amount + c.manifest.amount); lot.entry.stack.quantity = lot.entry.stack.knownQuantity = lot.entry.amount;
          lot.source.manifest.amount = quantity(lot.source.manifest.entries.reduce((sum, e) => sum + e.amount, 0));
          c.manifest = null; job.sampleStatus = 'returned'; changed++;
        } else if (job.sampleStatus !== 'depotHold') {
          job.sampleStatus = 'depotHold';
          note(state, now, 'returnHeld', job.id, 'Returned portion retained at the customer depot: original unchanged owned lot unavailable; no mixing or material loss.'); changed++;
        }
      }
    }
    return changed;
  }
  function resample(state, local, contacts, route, id, expected, now) {
    const job = state?.jobs.find(j => j.id === id), reason = state && channel(state, contacts, now);
    if (reason) return { ok: false, reason };
    const lot = job && heldLot(state, local, job), freight = Math.ceil(12 + route.distanceKm * 0.8);
    if (!job || job.status !== 'assayed' || job.result?.finding !== 'inconclusive' || now > job.dueAt || state.money < freight || state.vials < 1
      || !lot || lot.entry.amount < PORTION) return { ok: false, reason: 'No funded supported fresh portion of this original held batch is available.' };
    if (!expected || expected.freight !== freight || expected.distanceKm !== route.distanceKm) return { ok: false, reason: 'Sample freight changed; review the current fresh-sample terms.' };
    job.round++;
    const booked = transport(state, local, contacts, route, job, freight, now);
    if (!booked.ok) { job.round--; return booked; }
    debitPortion(lot); note(state, now, 'resampled', id, 'Another actual portion and sealing vial consumed; original signal and deadline unchanged.'); return booked;
  }
  function publicQuote(q) {
    if (!q) return null;
    return Object.fromEntries(['sourceId', 'sourceStackId', 'batchId', 'label', 'declaredHazards', 'sourceQuantity', 'portion', 'fee', 'freight', 'distanceKm', 'expiresAt'].map(k => [k, copy(q[k])]));
  }
  function publicView(state) {
    if (!state) return null;
    return { client: copy(state.client), quote: publicQuote(state.quote),
      jobs: state.jobs.map(j => Object.fromEntries(['id', 'batchId', 'label', 'declaredHazards', 'acceptedAt', 'dueAt', 'sampleAt', 'status', 'lotStatus', 'sampleStatus',
        'sampleStackId', 'reportStackId', 'receivedAt', 'paidAt', 'result', 'preview', 'disclosed'].filter(k => j[k] !== undefined).map(k => [k, copy(j[k])]))),
      history: copy(state.history) };
  }
  return { FEE, WINDOW, PORTION, MIN_CONFIDENCE, normalize, create, active, lots, channel, offer, request, accept, decline, ready, receive,
    assay, recordAssay, preview, submit, stop, advance, resample, publicView };
});
