(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-appearance') : root.HelixCargoAppearance,
    typeof module === 'object' && module.exports ? require('./chemical-handoff') : root.HelixChemicalHandoff,
    typeof module === 'object' && module.exports ? require('./cargo-examination') : root.HelixCargoExamination);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoTrial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Appearance, Chemical, Exam) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const kinds = ['identity', 'transaction', 'contraband', 'knowledge', 'authorization'];
  const free = (value, id) => !value || value === id;
  function identified(state, person, document, at) {
    const office = state.identityOffices?.find(o => o.cityId === document?.cityId && o.contact?.handle === document?.issuer?.handle);
    return able(person) && same(person.civicDocument, document) && same(person.appearance, document?.description)
      && document.issuedAt <= at && document.expiresAt > at && office?.active && office.channelPowered
      && office.records.some(r => r.status === 'active' && same(r.document, document));
  }
  function local(g) {
    const c = g.cargoCourt;
    return g.active && g.jurisdiction === 'city' && c?.active && c.cityId === g.cityId && g.judiciary?.active
      && g.judiciary.cityId === g.cityId && g.judiciary.institutionId === c.institutionId;
  }
  function context(state, g, d) {
    const address = Appearance.source(d);
    const buyer = state.buyers.find(b => b.cityId === g.cityId && b.buyerService?.premises?.id === address?.location.siteId);
    const personId = d.appearance?.phase === 'complete' ? d.appearance.personId : d.custodyCase?.personId;
    const person = buyer?.buyerService.representatives.find(p => p.id === personId);
    return { buyer, person, address };
  }
  function tell(b, p, t, at, text) {
    t.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.trialNotices ||= []).push({ at, trialId: t.id, text,
        scope: 'Receiver-consented trial notice; no right to control or represent this defendant.' });
  }
  function availability(b, p, at, busy) {
    if (p.courtPreferences?.shareAvailability && b.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.availabilityNotices ||= []).push({ at, text: busy
        ? 'Receiving representative is unavailable during a personal remote court hearing.' : 'Receiving representative has finished the remote court session.' });
  }
  // Only records already cited by the disclosed investigation are requested.
  // Voluntary, authenticated source attendance is separate from a copied report.
  function sources(state, g, proposal, trialId, remaining = 1800) {
    const events = (proposal.disclosure.assessment.recipientFindings || []).flatMap(f => (f.events || []).filter(e =>
      e.observationId === proposal.count.actor.id && f.comparisons?.some(c => c.recordId === e.id && c.result === 'matchesCarrierCopy')));
    const witnesses = [], records = [];
    for (const event of events) {
      const matches = state.operators.flatMap(op => (op.carrierService?.recipientRecords || [])
        .filter(r => r.document.id === event.id).map(record => ({ op, record })));
      if (matches.length !== 1) return { reason: 'Required carrier source is unavailable or ambiguous.' };
      const { op, record } = matches[0], s = op.carrierService, witness = op.crew.find(w => w.id === record.observerId);
      const protectedDelivery = s.policy === 'protectCompletedClients' && (s.records || []).some(r =>
        r.document.kind === 'buyerHandoff' && r.document.shipmentReference === event.shipmentReference);
      if (!s.channelPowered || !s.credentialActive || s.trialConsent !== true || !s.interviewConsent || s.policy === 'recordsOnly'
        || s.policy === 'refuse' || protectedDelivery || !free(s.assignment, trialId) || op.assignment || op.identityTrip || op.location !== op.sourceId
        || !able(witness) || !free(witness.assignment, trialId) || s.power < 1 || s.workSeconds < remaining)
        return { reason: 'Required carrier witness cannot voluntarily attend from the actual home depot.' };
      records.push({ document: copy(record.document), observerId: witness.id, accountId: s.contact.accountId });
      if (!witnesses.some(w => w.person.id === witness.id)) witnesses.push({ person: witness, service: s, locationId: op.sourceId, channel: s.contact.handle });
    }
    const lab = g.examinationLab;
    if (!lab || lab.locationId !== g.id || lab.institutionId !== g.cargoCourt.institutionId || !lab.channelPowered
      || lab.trialConsent !== true || lab.assignment || !free(lab.trialJob, trialId) || !able(lab.examiner) || lab.examiner.locationId !== lab.locationId
      || lab.power < 1 || lab.testimonySeconds < remaining)
      return { reason: 'Required examiner cannot attend from the actual examination laboratory.' };
    const reports = proposal.disclosure.evidence.reports.filter(r => r.method === 'sealedSampleConfirmatoryAssay');
    const archive = reports.map(r => lab.records?.find(x => x.report.id === r.id)).filter(Boolean);
    if (!reports.length || archive.length !== reports.length || reports.some(r => r.examinerId !== lab.examiner.id))
      return { reason: 'Required original examiner or retained assay record is unavailable.' };
    return { witnesses, lab, packet: { records, assays: copy(archive), examinerId: lab.examiner.id } };
  }
  function registry(g, proposal) {
    // A missing registry is not a negative search. Preserve all potentially
    // relevant permissions, including unresolved holder attribution, as doubt.
    const e = proposal.disclosure.evidence, at = proposal.count.eventAt;
    return { checked: Array.isArray(g.authorizations), entries: copy((g.authorizations || []).filter(a =>
      a.cityId === g.cityId && a.productId === e.productId && a.validFrom <= at && a.expiresAt > at)) };
  }
  function signature(g, d, r, s) {
    return JSON.stringify({ proposal: d.proposals.at(-1), revisions: r?.revisions, assessments: r?.investigation?.assessments,
      submissions: r?.investigation?.submissions, corrections: r?.investigation?.corrections, challenges: d.challenges,
      sources: s.packet, registry: registry(g, d.proposals.at(-1)) });
  }
  function release(state, g, b, p, t, at) {
    const c = g.cargoCourt, office = g.chargingOffice;
    if (!p) {
      b = state.buyers.find(b => b.buyerService?.representatives.some(p => p.id === t.personId));
      p = b?.buyerService.representatives.find(p => p.id === t.personId);
    }
    if (c.trialJob === t.id) { c.trialJob = null; c.lastAt = at; c.wasReady = false; }
    if (office?.trialJob === t.id) { office.trialJob = null; office.lastAt = at; office.wasReady = false; }
    if (c.counsel.trialJob === t.id) c.counsel.trialJob = null;
    if (g.examinationLab?.trialJob === t.id) g.examinationLab.trialJob = null;
    for (const op of state.operators) {
      if (op.carrierService?.assignment === t.id) op.carrierService.assignment = null;
      for (const w of op.crew || []) if (w.assignment === t.id) w.assignment = null;
    }
    if (p?.assignment === t.id) { p.assignment = null; p.availableAt = at; availability(b, p, at, false); }
    t.wasReady = false;
  }
  function adjourn(state, g, b, p, t, at, reason) {
    release(state, g, b, p, t, at);
    if (t.phase !== 'adjourned' || t.reason !== reason) tell(b, p, t, at, `Trial adjourned: ${reason} No guilt inference or custody extension.`);
    t.phase = 'adjourned'; t.reason = reason; t.progress = 0; t.retryAt = at + 3600;
  }
  function evaluate(disclosure, actorId, document, findings) {
    const { proposal, sources: s, authorization } = disclosure, e = proposal.disclosure.evidence;
    // Authenticate sources afresh. Witness and retained record count as one
    // source; a copied prosecutor conclusion is never admitted as trial proof.
    const admitted = (proposal.disclosure.assessment.recipientFindings || []).map(f => ({ ...copy(f), events: (f.events || []).filter(event =>
      s.records.some(r => same(r.document, event) && r.accountId === event.sourceAccountId)) }));
    const a = { ...copy(proposal.disclosure.assessment), recipientFindings: admitted };
    const proof = Chemical.proof(e, a, actorId), intake = findings(e);
    const events = admitted.flatMap(f => f.events);
    const identity = events.find(v => v.kind === 'recipientIdentity' && v.result === 'supported' && v.observationId === actorId
      && v.cityId === e.cityId && v.at <= proof.at && same(v.document, document));
    const report = e.reports.find(r => r.method === 'sealedSampleConfirmatoryAssay' && r.result === 'targetDetected' && r.supported);
    const sample = e.samples.find(x => x.id === report?.sampleId);
    const assay = s.assays.find(x => same(x.report, report));
    const authenticatedAssay = Boolean(report && sample && assay && same(assay.sample, sample) && report.examinerId === s.examinerId
      && Exam.validChain(sample) && !e.challenges?.some(c => c.reportId === report.id && c.result === 'sustained'));
    const corrections = (a.correctionFindings || []).length > 0;
    const sourceConflict = (proposal.disclosure.assessment.recipientFindings || []).some(f => (f.events || []).some(event =>
      s.records.some(r => r.document.id === event.id && !same(r.document, event))));
    const contraryAssay = e.reports.some(r => r.sourceStackId === report?.sourceStackId && r.sourceBatchId === report?.sourceBatchId
      && r.method === 'sealedSampleConfirmatoryAssay' && r.result === 'targetNotDetected');
    const conditions = {
      identity: Boolean(identity), transaction: proof.transaction.length > 0,
      contraband: authenticatedAssay && !contraryAssay && proof.goodsScope && intake.status === 'acceptedForInvestigation',
      knowledge: authenticatedAssay && proof.knowledge.length > 0,
      authorization: authorization.checked && !authorization.entries.length && e.authorization?.checked === true
        && !e.authorization.covering.length && !proof.authorizationCopies.length
    };
    const explanations = {
      identity: 'A source-authenticated observation links this defendant’s verified document to the receiving person before the transfer.',
      transaction: 'The authenticated eyewitness record describes this person accepting these exact goods in this city.',
      contraband: 'The original examiner authenticates the assay, sample chain and representative batch scope under the prospective local rule.',
      knowledge: 'The same carrier source witnessed acknowledgment of the exact assay and product before the transfer; later knowledge is excluded.',
      authorization: 'The disclosed relevant-time registry search and receiver’s presented copies leave no supported permission or unresolved authorization.'
    };
    return kinds.map(id => ({ id, established: conditions[id] && !corrections && !sourceConflict,
      reason: corrections || sourceConflict ? 'Disclosed source corrections or conflicting copies leave unresolved reasonable doubt; no numerical confidence can replace resolution.'
        : conditions[id] ? explanations[id] : `Reasonable doubt: the disclosed sources do not establish ${id}.`,
      sourceIds: id === 'identity' ? identity ? [identity.id] : [] : id === 'transaction' ? proof.transaction
        : id === 'authorization' ? authorization.entries.map(x => x.id) : [...new Set([...(report ? [report.id] : []), ...(id === 'knowledge' ? proof.knowledge : [])])] }));
  }
  function advance(state, g, at, findings) {
    const c = g.cargoCourt;
    if (!c || !Number.isFinite(at)) return;
    for (const d of c.dockets) {
      let t = d.trial;
      if (t?.judgment || at < (t?.lastAt || 0)) continue;
      const { buyer: b, person: p, address } = context(state, g, d);
      const eligible = d.appearance?.phase === 'complete' && d.appearance.returnedAt != null
        || d.custodyCase?.review && d.custodyCase.personReturnedAt != null;
      if (!t && (!eligible || !local(g) || d.status !== 'allowed' || !d.handoff || !p || !address)) continue;
      if (!t) t = d.trial = { id: `${d.id}:trial`, personId: p.id, actorId: d.actorId, cityId: g.cityId,
        phase: 'scheduling', progress: 0, lastAt: at, wasReady: false, disclosures: [], events: [], challenges: [], sessions: [] };
      const dt = Math.max(0, at - t.lastAt); t.lastAt = at;
      if (!local(g) || !p || !address || p.id !== t.personId) { adjourn(state, g, b, p, t, at, 'Local authority or verified defendant unavailable.'); continue; }
      const r = g.criminalIntake?.referrals.find(r => r.id === d.referralId);
      const office = g.chargingOffice, lawyer = c.counsel;
      const judgeReady = c.channelPowered && able(c.judge) && c.judge.locationId === c.id && c.workSeconds > 0 && c.power >= 1
        && !c.job && !c.appearanceJob && !c.custodyJob && free(c.trialJob, t.id);
      if (['withdrawn', 'rejected'].includes(d.status)) {
        release(state, g, b, p, t, at);
        if (!judgeReady) { t.dismissalReady = false; continue; }
        if (t.phase !== 'dismissal') { t.phase = 'dismissal'; t.progress = 0; t.wasReady = false; }
        c.trialJob = t.id;
        const work = t.dismissalReady ? Math.min(dt, 600 - t.progress, c.workSeconds) : 0;
        t.dismissalReady = true; t.progress += work; c.workSeconds -= work;
        if (t.progress < 600) continue;
        c.power--; t.judgment = { at, outcome: 'dismissed', judgeId: c.judge.id, reason: 'The local count was withdrawn before a completed contested hearing.', elements: [] };
        t.phase = 'judgment'; release(state, g, b, p, t, at); tell(b, p, t, at, 'Cargo count dismissed. No punishment or custody authorized.'); continue;
      }
      if (d.status !== 'allowed' || !d.handoff) { adjourn(state, g, b, p, t, at, 'Awaiting current independent charging review.'); continue; }
      const investigation = r?.investigation;
      if (!r || r.reviewedRevision !== r.revisions.length || investigation?.assessments.at(-1)?.sourceRevision !== r.reviewedRevision
        || investigation.assessedSignature !== `${r.reviewedRevision}:${investigation.submissions.length}:${investigation.corrections.length}`
        || d.proposals.at(-1).reviewId !== r.charging?.reviews.at(-1)?.id
        || !same(d.proposals.at(-1).disclosure.evidence, r.revisions.at(-1).evidence)
        || !same(d.proposals.at(-1).disclosure.assessment, investigation.assessments.at(-1))) {
        adjourn(state, g, b, p, t, at, 'New material requires completed investigation and fresh judicial disclosure.'); continue;
      }
      if (t.phase === 'adjourned' && at < t.retryAt) continue;
      const s = sources(state, g, d.proposals.at(-1), t.id, t.phase === 'hearing' ? 1800 - t.progress : 1800);
      if (s.reason) { adjourn(state, g, b, p, t, at, s.reason); continue; }
      const sig = signature(g, d, r, s);
      if (t.signature !== sig) {
        release(state, g, b, p, t, at); t.signature = sig; t.phase = 'scheduling'; t.progress = 0; t.wasReady = false;
        t.candidate = copy({ proposal: d.proposals.at(-1), sources: s.packet, authorization: registry(g, d.proposals.at(-1)), filings: d.challenges });
        t.mandate = null;
      }
      if (t.phase === 'adjourned') { t.phase = 'scheduling'; t.progress = 0; t.wasReady = false; }
      if (t.phase === 'scheduling') {
        if (!judgeReady) { t.wasReady = false; continue; }
        if (t.schedulingJudgeId !== c.judge.id) { t.schedulingJudgeId = c.judge.id; t.progress = 0; t.wasReady = false; }
        c.trialJob = t.id;
        const work = t.wasReady ? Math.min(dt, 600 - t.progress, c.workSeconds) : 0;
        t.wasReady = true; t.progress += work; c.workSeconds -= work;
        if (t.progress < 600) continue;
        c.power--; t.scheduledBy = c.judge.id; t.phase = 'notice'; release(state, g, b, p, t, at); continue;
      }
      const bs = b.buyerService, preferences = p.trialPreferences;
      const receiverReady = identified(state, p, address.document, at) && p.locationId === b.cityId && bs.locationId === b.cityId
        && bs.channelPowered && bs.credentialActive && bs.power >= 1 && free(p.assignment, t.id) && !bs.assignment && (p.availableAt || 0) <= at;
      if (t.phase === 'notice') {
        if (!receiverReady || preferences?.acceptNotice !== true) continue;
        bs.power--; t.disclosures.push({ id: `${t.id}:disclosure:${t.disclosures.length + 1}`, receivedAt: at,
          prepareUntil: at + 86400, ...copy(t.candidate) });
        t.phase = 'preparation'; t.progress = 0; t.wasReady = false;
        tell(b, p, t, at, `Fresh cargo trial notice and exact disclosure received at the verified receiving desk. At least one day to prepare; authenticated remote attendance is voluntary. No detention authorized.`);
        if (preferences.representation === 'counsel') t.mandate = { at, personId: p.id, document: copy(address.document), counselId: lawyer.id,
          disclosureId: t.disclosures.at(-1).id, scope: 'This contested trial only; no plea, settlement, punishment or player delegation.', status: 'active' };
        continue;
      }
      const disclosure = t.disclosures.at(-1);
      if (!disclosure || at < disclosure.prepareUntil) continue;
      const represented = preferences?.representation === 'counsel';
      const authorized = represented ? t.mandate?.status === 'active' && t.mandate.personId === p.id && t.mandate.counselId === lawyer.id
        && able(lawyer) && lawyer.locationId === c.id && lawyer.acceptsAppointments && !lawyer.job && free(lawyer.trialJob, t.id) && lawyer.workSeconds >= 1800 - (t.phase === 'hearing' ? t.progress : 0)
        : preferences?.representation === 'self';
      const participantIds = [p.id, c.judge.id, office?.prosecutor.id, ...(represented ? [lawyer.id] : []), s.lab.examiner.id, ...s.witnesses.map(w => w.person.id)];
      const ready = judgeReady && receiverReady && preferences?.attend === true && authorized && new Set(participantIds).size === participantIds.length
        && office?.active && office.channelPowered && office.locationId === g.id && office.cityId === g.cityId && able(office.prosecutor)
        && office.prosecutor.locationId === office.locationId
        && !office.job && free(office.trialJob, t.id) && office.power >= 1 && office.workSeconds >= 1800 - (t.phase === 'hearing' ? t.progress : 0)
        && p.provisions * 28800 >= 1800 - (t.phase === 'hearing' ? t.progress : 0);
      if (!ready) { adjourn(state, g, b, p, t, at, 'Defendant, authorized representation, distinct court participants or finite resources unavailable.'); continue; }
      if (t.phase === 'preparation') {
        t.phase = 'hearing'; t.progress = 0; t.wasReady = false; p.assignment = t.id; c.trialJob = t.id; office.trialJob = t.id;
        if (represented) lawyer.trialJob = t.id;
        s.lab.trialJob = t.id;
        for (const w of s.witnesses) { w.service.assignment = t.id; w.person.assignment = t.id; }
        t.participants = participantIds; t.sessions.push({ at, disclosureId: disclosure.id, participantIds: copy(participantIds),
          channels: [{ personId: p.id, locationId: bs.premises.id }, { personId: c.judge.id, locationId: c.id },
            { personId: office.prosecutor.id, locationId: office.locationId }, { personId: s.lab.examiner.id, locationId: s.lab.locationId },
            ...s.witnesses.map(w => ({ personId: w.person.id, locationId: w.locationId, channel: w.channel }))] });
        availability(b, p, at, true); continue;
      }
      if (t.phase !== 'hearing') continue;
      if (!same(t.participants, participantIds)) { adjourn(state, g, b, p, t, at, 'A required participant changed; no substituted testimony.'); continue; }
      const work = t.wasReady ? Math.min(dt, 1800 - t.progress, c.workSeconds) : 0;
      t.wasReady = true; t.progress += work; c.workSeconds -= work; office.workSeconds -= work;
      if (represented) lawyer.workSeconds -= work;
      p.provisions -= work / 28800;
      s.lab.testimonySeconds -= work;
      for (const service of new Set(s.witnesses.map(w => w.service))) service.workSeconds -= work;
      if (t.progress < 1800) continue;
      t.sessions.at(-1).completedAt = at;
      t.testimony = s.witnesses.map(w => ({ at, witnessId: w.person.id, channel: w.channel,
        sourceIds: s.packet.records.filter(r => r.observerId === w.person.id).map(r => r.document.id),
        statement: 'I authenticate these retained observations as my records. Differences from the disclosed copies remain on the record; I offer no claim about unobserved people or private knowledge.' }));
      t.testimony.push({ at, witnessId: s.lab.examiner.id, locationId: s.lab.locationId,
        sourceIds: s.packet.assays.map(a => a.report.id),
        statement: 'I authenticate these retained assay and sample-chain records. The stated method, quality and representative batch limitations apply; this does not establish anyone’s knowledge or guilt.' });
      const elements = evaluate(disclosure, d.actorId, address.document, findings);
      t.challenges.push(...kinds.filter(k => preferences.challenges?.includes(k)).map(kind => ({ at, kind, disclosureId: disclosure.id,
        submittedBy: represented ? lawyer.id : p.id, result: elements.find(e => e.id === kind).established ? 'notEstablished' : 'sustained',
        reason: elements.find(e => e.id === kind).reason })));
      const outcome = elements.every(e => e.established) ? 'convicted' : 'acquitted';
      t.judgment = { at, outcome, judgeId: c.judge.id, personId: p.id, actorId: d.actorId, cityId: g.cityId,
        disclosureId: disclosure.id, elements, standard: 'Every required element beyond reasonable doubt; no additive scores, double-counted witnesses, or adverse inference from silence.' };
      t.phase = 'judgment'; c.power--; office.power--; bs.power--; s.lab.power--;
      for (const service of new Set(s.witnesses.map(w => w.service))) service.power--;
      if (outcome === 'convicted') t.sentencingHandoff = { trialId: t.id, personId: p.id, actorId: d.actorId, cityId: g.cityId,
        institutionId: c.institutionId, lawId: disclosure.proposal.count.lawId, judgment: copy(t.judgment),
        punishmentAuthorized: false, custodyAuthorized: false, status: 'awaitingSeparateSentencing' };
      release(state, g, b, p, t, at); tell(b, p, t, at, `Cargo trial ${outcome}. ${elements.map(e => `${e.id}: ${e.reason}`).join(' ')} No punishment or custody authorized; any sentencing requires a separate proceeding.`);
    }
  }
  return { advance, evaluate, kinds, identified, local };
});
