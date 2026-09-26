(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./carrier-corroboration') : root.HelixCarrierCorroboration,
    typeof module === 'object' && module.exports ? require('./buyer-corroboration') : root.HelixBuyerCorroboration,
    typeof module === 'object' && module.exports ? require('./contract-witnessing') : root.HelixContractWitnessing);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoInvestigations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Carrier, Buyer, Witness) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const able = a => a?.status === 'alive' && a.health >= 50;
  function provision(gate, at) {
    if (!gate.investigationOffice && gate.criminalIntake && gate.institutionId) gate.investigationOffice = {
      investigator: { id: `${gate.id}:cargo-investigator`, name: `${gate.institutionName || gate.institutionId} cargo investigator`, institutionId: gate.institutionId, status: 'alive', health: 100 },
      locationId: gate.id, channelPowered: true, power: 12, workSeconds: 14400, lastAt: at
    };
  }
  function create(r, at) {
    return { id: `${r.id}:investigation`, openedAt: at, status: 'working', interviews: [], submissions: [], corrections: [], assessments: [], notices: [], job: null, assessedSignature: '' };
  }
  function signature(r) { const i = r.investigation; return `${r.reviewedRevision}:${i.submissions.length}:${i.corrections.length}`; }
  function releaseSource(operators, buyers, offices, job, at) {
    if (!job?.sourceAssignment) return;
    for (const service of [...operators.map(o => o.carrierService), ...buyers.map(b => b.buyerService), ...offices.map(o => o.witnessService)].filter(Boolean))
      if (service.assignment === job.sourceAssignment) { service.assignment = null; service.availableAt = at; }
  }
  function interview(gate, r, kind, at) {
    const i = r.investigation, e = r.revisions[r.reviewedRevision - 1].evidence;
    const officer = kind === 'officer', source = officer ? e.observation.observerId : e.reports.find(p => p.method === 'sealedSampleConfirmatoryAssay')?.examinerId;
    i.interviews.push({ id: `${i.id}:${kind}`, kind, at, witnessId: source, sourceRevision: r.reviewedRevision,
      sourceIds: officer ? [`${r.sourceOrderId}:gate-observation`] : e.reports.map(p => p.id),
      persons: officer ? copy(e.personObservations || []) : [],
      statement: officer ? 'I can confirm only the retained gate observations. Presenting cargo for inspection is not a sale or delivery to a buyer; no civil identity was checked.' : 'My testimony concerns the recorded sample, method and uncertainty only. I did not observe a commercial transaction or anyone’s earlier knowledge.',
      reliability: 'Bounded to contemporaneous source records; repeating this account is not independent corroboration.' });
  }
  function assess(gate, r, at) {
    const i = r.investigation, review = r.reviews.at(-1), e = r.revisions[r.reviewedRevision - 1].evidence;
    const persons = i.interviews.filter(w => w.kind === 'officer').flatMap(w => w.persons)
      .filter(p => (e.personObservations || []).some(current => JSON.stringify(current) === JSON.stringify(p)));
    const actors = [...new Map(persons.map(p => [p.id, { id: p.id, identity: 'unverified', role: 'observed cargo presenter', conduct: p.conduct,
      sourceIds: [p.id], transaction: 'not established', knowledge: 'not established' }])).values()];
    if (i.submissions.length) actors.push({ id: `${i.id}:claimant`, identity: 'authenticated property channel only; civil identity unverified', role: 'voluntary document submitter, not an established sender',
      conduct: 'Submitted the selected copies after inquiry.', sourceIds: i.submissions.map(s => s.id), transaction: 'not established', knowledge: 'not established at any earlier transaction' });
    const claims = new Map();
    for (const s of i.submissions.filter(s => s.document.kind === 'contract')) {
      const key = JSON.stringify([s.document.sourceId, s.document.counterpartyName]);
      if (!claims.has(key)) claims.set(key, { id: `${s.id}:counterparty`, identity: `unverified document name: ${s.document.counterpartyName}`, role: 'asserted counterparty, not linked to the observed presenter',
        conduct: 'Named in a claimant-supplied copy; no observed act.', sourceIds: [s.document.sourceId], transaction: 'not established', knowledge: 'not established' });
    }
    actors.push(...claims.values());
    const carrierFindings = Carrier.findings(i, gate.cityId), buyerFindings = Buyer.findings(i, gate.cityId);
    for (const account of new Map(buyerFindings.filter(f => f.decision !== 'refused').map(f => [f.account.accountId, f.account])).values()) actors.push({
      id: `${i.id}:account:${account.accountId}`, identity: 'authenticated buyer account; civil identity unverified', role: 'buyer record source, not automatically a principal or gate presenter',
      conduct: 'Supplied bounded buyer records or testimony voluntarily.', sourceIds: [account.accountId], transaction: 'not established as knowing local unlawful commerce', knowledge: 'not established' });
    for (const account of new Map(carrierFindings.filter(f => f.decision !== 'refused').map(f => [f.account.accountId, f.account])).values()) actors.push({
      id: `${i.id}:account:${account.accountId}`, identity: 'authenticated carrier account; civil identity unverified', role: 'record source, not automatically the gate presenter',
      conduct: 'Supplied bounded carrier records or testimony voluntarily.', sourceIds: [account.accountId], transaction: 'not established as knowing local unlawful commerce', knowledge: 'not established' });
    const corrections = i.corrections.map(c => ({ id: c.id, kind: c.kind,
      result: c.kind === 'scope' ? 'Assay and gate presence establish neither prior knowledge nor a transaction; that limitation remains in force.'
        : e.reports.some(p => p.sourceStackId !== e.examinationAuthority.stackId || p.sourceBatchId !== e.examinationAuthority.batchId)
          ? 'Source mismatch reproduced. The disputed report cannot establish actor attribution.' : 'No source mismatch reproduced in current records. This does not verify a person’s identity.' }));
    const status = review.status === 'declined' ? 'exhaustedUnsupported' : 'awaitingNamedSource';
    const result = { at, sourceRevision: r.reviewedRevision, investigatorId: gate.investigationOffice.investigator.id, status, actors,
      elements: copy(review.elements), correctionFindings: corrections, carrierFindings, buyerFindings, witnessFindings: Witness.findings(i, gate.cityId),
      documents: i.submissions.map(s => ({ id: s.id, sourceId: s.document.sourceId, finding: 'Voluntarily supplied copy; provenance is the authenticated property channel, not independent verification of its parties or performance.' + (s.document.status === 'failed' ? ' Reported nonperformance is retained as potentially exculpatory material, not independently proven nonoccurrence.' : '') })),
      missingSources: status === 'exhaustedUnsupported' ? [] : ['A witness or independently authenticated record of a locally relevant completed transaction.', 'Independent identification of each alleged participant.', 'A source establishing each participant’s knowledge at the relevant time.'],
      reason: status === 'exhaustedUnsupported' ? `Available lead exhausted: ${review.reason}` : 'Available gate interviews and records do not establish a completed transaction, verified participants or knowing participation. Waiting creates no evidence.' };
    i.assessments.push(result); i.status = status; i.assessedSignature = signature(r);
    i.notices.push({ at, assessment: copy(result), investigatorName: gate.investigationOffice.investigator.name,
      request: status === 'exhaustedUnsupported' ? 'No further voluntary material requested on the current unsupported lead.' : 'Optional: supply a booked manifest, contract excerpt or carrier/buyer contact and customer records or independent witness receipts, or identify a source-identity or scope error. Source cooperation remains voluntary; copies alone are not verified.',
      obligation: 'Voluntary only. No deadline, adverse inference from silence, charge, warrant or custody authority.' });
  }
  function advance(gate, at, operators = [], buyers = [], offices = []) {
    const office = gate?.investigationOffice; if (!office || at < office.lastAt) return;
    let cursor = office.lastAt; office.lastAt = at;
    for (const r of gate.criminalIntake.referrals) {
      const review = r.reviews.at(-1);
      if (!r.investigation && review?.status === 'acceptedForInvestigation') r.investigation = create(r, review.at);
      const i = r.investigation; if (!i) continue;
      if (r.reviewedRevision !== r.revisions.length) { i.status = 'awaitingSourceReview'; if (i.job) i.job.wasReady = false; releaseSource(operators, buyers, offices, i.job, at); continue; }
      if (i.assessedSignature === signature(r)) continue;
      const changedAt = Math.max(review.at, i.submissions.at(-1)?.at || 0, i.corrections.at(-1)?.at || 0);
      if (i.job && i.job.signature !== signature(r)) {
        releaseSource(operators, buyers, offices, i.job, at);
        i.job = null;
      }
      let continuing = false;
      while (true) {
        const sourceTask = Carrier.next(i) || Buyer.next(i) || Witness.next(i);
        const sourceApi = sourceTask?.kind === 'witnessRecords' ? Witness : sourceTask?.kind.startsWith('buyer') ? Buyer : Carrier;
        const participants = sourceApi === Witness ? offices : sourceApi === Buyer ? buyers : operators;
        const kind = review.status !== 'acceptedForInvestigation' ? 'reconcile'
          : !i.interviews.some(w => w.kind === 'officer') ? 'officer'
            : !i.interviews.some(w => w.kind === 'examiner') ? 'examiner' : sourceTask?.kind || 'reconcile';
        if (!i.job) i.job = { kind, signature: signature(r), startedAt: Math.max(cursor, changedAt), progress: 0, paid: false, wasReady: continuing };
        const job = i.job, e = r.revisions[r.reviewedRevision - 1].evidence;
        const isSource = ['carrierRecords', 'carrierInterview', 'buyerRecords', 'buyerInterview', 'witnessRecords'].includes(kind);
        const sourceAssignment = isSource ? `${i.id}:${sourceTask.submission.id}:${kind}` : null;
        const officeReady = gate.active && gate.jurisdiction === 'city' && gate.criminalIntake.active && gate.criminalIntake.cityId === gate.cityId
          && office.locationId === gate.id && office.investigator.institutionId === gate.institutionId && able(office.investigator)
          && office.channelPowered && office.workSeconds > 0 && (job.paid || office.power >= 1);
        const source = isSource && officeReady ? sourceApi.prepare(participants, i, sourceTask.submission, kind, at, job.paid, sourceAssignment, buyers) : null;
        const witness = kind === 'officer' ? gate.officer : kind === 'examiner' ? gate.examinationLab?.examiner : null;
        const expected = kind === 'officer' ? e.observation.observerId : e.reports.find(p => p.method === 'sealedSampleConfirmatoryAssay')?.examinerId;
        const ready = officeReady && (kind === 'reconcile' || (isSource ? Boolean(source) : able(witness) && witness.id === expected))
          && (kind !== 'examiner' || gate.examinationLab.locationId === gate.id && !gate.examinationLab.assignment)
          && (kind !== 'officer' || !gate.assignment) && office.workSeconds > 0
          && (!isSource || source && source.service.workSeconds > 0 && (!source.service.assignment || source.service.assignment === sourceAssignment)
            && (!job.sourceWitnessId || job.sourceWitnessId === source.witness.id));
        if (!ready || !job.paid && (office.power < 1 || isSource && source.service.power < 1)) { job.wasReady = false; releaseSource(operators, buyers, offices, job, at); i.status = 'paused'; return; }
        if (!job.paid) {
          office.power--; job.paid = true;
          if (isSource) { source.service.power--; source.service.assignment = sourceAssignment; job.sourceAssignment = sourceAssignment; job.sourceWitnessId = source.witness.id; }
        }
        if (isSource) source.service.assignment = sourceAssignment;
        const start = Math.max(cursor, job.startedAt, source?.service.availableAt || 0), available = job.wasReady ? Math.max(0, at - start) : 0;
        job.wasReady = true;
        const work = Math.min(1800 - job.progress, available, office.workSeconds, source?.service.workSeconds ?? Infinity); job.progress += work; office.workSeconds -= work;
        if (isSource) source.service.workSeconds -= work;
        i.status = 'working';
        if (job.progress < 1800) return;
        cursor = start + work;
        if (kind === 'reconcile') { assess(gate, r, cursor); i.job = null; break; }
        if (isSource) { sourceApi.complete(i, sourceTask.submission, kind, source, cursor); source.service.assignment = null; source.service.availableAt = cursor; }
        else interview(gate, r, kind, cursor);
        i.job = null; continuing = true;
      }
    }
  }
  function preview(kind, sh, contract, buyerName) {
    if (kind === 'carrier') return Carrier.preview(sh);
    if (kind === 'buyer') return Buyer.preview(sh);
    if (kind === 'witness') return Witness.preview(sh);
    if (!sh || !contract || contract.id !== sh.contractId) return null;
    if (kind === 'manifest') return { kind, sourceId: `${contract.id}:booked-manifest`, material: contract.material, quantity: contract.amount,
      stackId: sh.propertyOrder?.evidence.stackId, limitation: 'Booked quantity only, not a receipt or proof of current retained quantity.' };
    if (kind === 'contract') return { kind, sourceId: contract.id, material: contract.material, quantity: contract.amount,
      counterpartyName: buyerName || 'Unnamed counterparty', destination: sh.destinationId, status: contract.status,
      limitation: 'Unverified copy of the claimant’s contract record. Names are document assertions, not verified identities. Contract status is not independent proof of performance or earlier knowledge.' };
    return null;
  }
  const filingAvailable = (gate, r) => gate?.active && gate.jurisdiction === 'city' && gate.investigationOffice?.channelPowered
    && gate.investigationOffice.locationId === gate.id && gate.criminalIntake?.referrals.includes(r);
  function submit(gate, r, document, at) {
    const i = r?.investigation;
    if (!filingAvailable(gate, r) || !i?.notices.length || i.status === 'exhaustedUnsupported' || !['manifest', 'contract', 'carrier', 'buyer', 'witness'].includes(document?.kind)
      || i.submissions.some(s => JSON.stringify(s.document) === JSON.stringify(document))) return false;
    i.submissions.push({ id: `${i.id}:submission:${i.submissions.length + 1}`, at, channel: 'authenticatedPropertyClaimant', document: copy(document) });
    return true;
  }
  function correct(gate, r, kind, at) {
    const i = r?.investigation;
    if (!filingAvailable(gate, r) || !i?.notices.length || !['identity', 'scope'].includes(kind) || i.corrections.some(c => c.kind === kind && c.sourceRevision === r.reviewedRevision)) return false;
    i.corrections.push({ id: `${i.id}:correction:${i.corrections.length + 1}`, kind, at, sourceRevision: r.reviewedRevision }); return true;
  }
  return { provision, advance, preview, submit, correct };
});
