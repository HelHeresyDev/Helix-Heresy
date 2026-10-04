(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-trial') : root.HelixCargoTrial,
    typeof module === 'object' && module.exports ? require('./cargo-sentencing') : root.HelixCargoSentencing);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoJudgmentReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trial, Sentencing) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const kinds = [...Trial.kinds, 'procedure', 'penalty'];
  function packet(g, d) {
    const s = d.sentencing, sentence = s?.sentence, t = d.trial, judgment = t?.judgment;
    const hearing = s?.disclosures?.find(x => x.id === sentence?.disclosureId);
    const trial = t?.disclosures?.find(x => x.id === judgment?.disclosureId);
    if (!sentence || judgment?.outcome !== 'convicted' || !hearing || !trial
      || !same(hearing.judgment, judgment) || sentence.trialId !== t.id || hearing.trialId !== t.id
      || sentence.personId !== judgment.personId || sentence.actorId !== d.actorId || judgment.actorId !== d.actorId
      || sentence.cityId !== g.cityId || judgment.cityId !== g.cityId || sentence.institutionId !== g.cargoCourt.institutionId
      || !same(hearing.proposal, trial.proposal)) return null;
    if (!trial.proposal?.disclosure?.evidence || !trial.proposal.disclosure.assessment
      || !Array.isArray(trial.sources?.records) || !Array.isArray(trial.sources?.assays)
      || !trial.authorization || !Array.isArray(judgment.elements)
      || ![trial.receivedAt, trial.prepareUntil, hearing.receivedAt, hearing.prepareUntil, sentence.at, judgment.at].every(Number.isFinite)) return null;
    const r = g.criminalIntake?.referrals.find(x => x.id === d.referralId), i = r?.investigation;
    // Pending intake/corroboration cannot be ignored merely because preparation expired.
    if (!r?.revisions?.at(-1)?.evidence || !i || r.reviewedRevision !== r.revisions.length
      || i.assessedSignature !== `${r.reviewedRevision}:${i.submissions.length}:${i.corrections.length}`
      || i.assessments.at(-1)?.sourceRevision !== r.reviewedRevision) return null;
    return copy({ sentence, judgment, trial, hearing,
      priorParticipants: [...new Set([...(t.sessions || []).flatMap(x => x.participantIds || []),
        ...(s.sessions || []).flatMap(x => (x.participants || []).map(p => p.id))])],
      current: { evidence: r.revisions.at(-1).evidence, assessment: i.assessments.at(-1) },
      authorization: Array.isArray(g.authorizations) ? { checked: true, entries: g.authorizations.filter(a =>
        a.cityId === g.cityId && a.productId === trial.proposal.disclosure.evidence.productId
        && a.validFrom <= trial.proposal.count.eventAt && a.expiresAt > trial.proposal.count.eventAt) } : { checked: false, entries: [] } });
  }
  function decision(input, findings) {
    const { sentence, judgment, trial, hearing, current, authorization } = input;
    const elements = Trial.evaluate(trial, sentence.actorId, trial.proposal.subjectDocument, findings);
    if (elements.some(e => !e.established)) return { outcome: 'convictionVacated', elements,
      reason: 'The original authenticated trial record fails to establish every required element. No retrial is authorized for this insufficiency.', sanction: null };
    const changed = !same(current.evidence, trial.proposal.disclosure.evidence)
      || !same(current.assessment, trial.proposal.disclosure.assessment) || !same(authorization, trial.authorization);
    if (!authorization.checked) return null;
    if (changed) return { outcome: 'retrialRequired', elements, sanction: null,
      reason: 'New disclosed case material requires separate fact-finding. It is not treated as proof of guilt or an automatic acquittal.' };
    if (trial.prepareUntil < trial.receivedAt + 86400 || trial.prepareUntil > judgment.at
      || hearing.prepareUntil < hearing.receivedAt + 86400 || hearing.prepareUntil > sentence.at
      || !Trial.kinds.every(id => judgment.elements.some(e => e.id === id && e.established)))
      return { outcome: 'retrialRequired', elements, sanction: null,
        reason: 'The retained record does not establish the required preparation or complete findings; a separate rehearing is required.' };
    const lawful = Sentencing.proposalFor({ proposal: trial.proposal, judgment, trialId: sentence.trialId });
    if (!lawful.sanction) return { outcome: 'sentenceVacated', elements, sanction: null,
      reason: `Separate lawful resentencing required: ${lawful.reason}` };
    if (!same(sentence.sanction, lawful.sanction) || sentence.lawId !== lawful.lawId || sentence.sourceLawId !== lawful.sourceLawId) {
      const field = lawful.sanction.kind === 'fine' ? 'credits' : 'months';
      if (sentence.sanction?.kind !== lawful.sanction.kind || !Number.isFinite(sentence.sanction[field])
        || lawful.sanction[field] > sentence.sanction[field]) return { outcome: 'sentenceVacated', elements, sanction: null,
        reason: 'The sanction is unsupported; this review cannot substitute a different punishment or increase it. Separate lawful resentencing is required.' };
      return { outcome: 'sentenceCorrected', elements, sanction: lawful.sanction, lawId: lawful.lawId, sourceLawId: lawful.sourceLawId,
        reason: 'A linked correction restores the published lower-bound penalty and its original local legal basis without increasing punishment.' };
    }
    return { outcome: 'affirmed', elements, sanction: copy(sentence.sanction), lawId: lawful.lawId, sourceLawId: lawful.sourceLawId,
      reason: 'Independent review confirms the original element findings, preparation and published lower-bound sentence. Silence adds no aggravation.' };
  }
  function tell(b, p, v, at, text) {
    if (v.events.at(-1)?.text === text) return;
    v.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.judgmentReviewNotices ||= []).push({ at, reviewId: v.id, text,
        scope: 'Receiver-consented review notice; no authority to act for this person.' });
  }
  function release(g, p, v) {
    const o = g.cargoCourt.reviewOffice;
    if (o?.job === v.id) o.job = null;
    if (o?.counsel?.job === v.id) o.counsel.job = null;
    if (p?.assignment === v.id) p.assignment = null;
    v.wasReady = false;
  }
  function availability(b, p, at, busy) {
    if (p?.courtPreferences?.shareAvailability && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.availabilityNotices ||= []).push({ at, text: busy
        ? 'Receiving representative is unavailable during a personal judgment review session.'
        : 'Receiving representative has finished the remote judgment review session.' });
  }
  function advance(state, g, at, findings) {
    const c = g.cargoCourt;
    if (!c || !Number.isFinite(at)) return;
    for (const d of c.dockets) {
      if (!d.sentencing?.sentence) continue;
      let v = d.judgmentReview;
      if (v?.decision || at < (v?.lastAt || 0)) continue;
      if (!v) v = d.judgmentReview = { id: `${d.sentencing.id}:review`, personId: d.sentencing.sentence.personId,
        phase: 'scheduling', lastAt: at, progress: 0, wasReady: false, stayActive: true,
        disclosures: [], mandates: [], sessions: [], events: [] };
      const dt = Math.max(0, at - v.lastAt); v.lastAt = at;
      const b = state.buyers.find(x => x.buyerService?.representatives.some(p => p.id === v.personId));
      const p = b?.buyerService.representatives.find(x => x.id === v.personId), bs = b?.buyerService;
      const o = c.reviewOffice, prefs = p?.judgmentReviewPreferences, input = packet(g, d);
      const pause = reason => { if (p?.assignment === v.id) availability(b, p, at, false);
        release(g, p, v); v.phase = 'paused'; v.progress = 0; tell(b, p, v, at, `${reason} Enforcement remains stayed; no rights expire.`); };
      const reviewer = o?.reviewer, lawyer = o?.counsel;
      if (!input || !Trial.local(g) || !p || b.cityId !== g.cityId || !o?.active || !o.channelPowered
        || o.cityId !== g.cityId || o.institutionId !== c.institutionId || reviewer?.role !== 'cargoJudgmentReview'
        || !able(reviewer) || reviewer.locationId !== c.id || [...input.priorParticipants, input.judgment.judgeId, input.sentence.judgeId,
          c.judge.id, c.counsel.id, g.chargingOffice?.prosecutor.id, p.id, lawyer?.id].includes(reviewer.id)
        || o.job && o.job !== v.id || reviewer.assignment || o.power < 1 || o.workSeconds <= 0) {
        pause('Independent local reviewer, complete case records or finite review resources unavailable.'); continue;
      }
      const signature = JSON.stringify(input);
      if (v.signature !== signature || v.reviewerId !== reviewer.id || v.phase === 'paused') {
        if (p.assignment === v.id) availability(b, p, at, false);
        release(g, p, v); v.signature = signature; v.reviewerId = reviewer.id; v.phase = 'scheduling'; v.progress = 0;
        for (const m of v.mandates) if (m.status === 'active') { m.status = 'superseded'; m.endedAt = at; }
      }
      if (v.phase === 'scheduling') {
        o.job = v.id;
        const work = v.wasReady ? Math.min(dt, 600 - v.progress, o.workSeconds) : 0;
        v.wasReady = true; v.progress += work; o.workSeconds -= work;
        if (v.progress < 600) continue;
        o.power--; release(g, p, v); v.phase = 'notice'; continue;
      }
      const address = input.trial.proposal.disclosure.assessment.recipientFindings?.flatMap(f => (f.events || []).filter(e =>
        f.comparisons?.some(x => x.recordId === e.id && x.result === 'matchesCarrierCopy'))).find(e =>
        e.kind === 'chemicalDisclosure' && e.observationId === d.actorId)?.serviceLocation;
      const reachable = Trial.identified(state, p, input.trial.proposal.subjectDocument, at)
        && p.locationId === g.cityId && bs.locationId === g.cityId && address?.cityId === g.cityId && address.siteId === bs.premises?.id
        && bs.channelPowered && bs.credentialActive && bs.power >= 1 && !bs.assignment
        && (!p.assignment || p.assignment === v.id) && (p.availableAt || 0) <= at;
      if (v.phase === 'notice') {
        if (!reachable || prefs?.acceptNotice !== true) continue;
        const proposed = decision(input, findings);
        if (!proposed) { pause('Required authorization records unavailable.'); continue; }
        const disclosure = { id: `${v.id}:disclosure:${v.disclosures.length + 1}`, receivedAt: at, prepareUntil: at + 86400,
          reviewerId: reviewer.id, input: copy(input), proposed };
        v.disclosures.push(disclosure); bs.power--; v.phase = 'preparation'; v.progress = 0;
        if (prefs.representation === 'counsel' && lawyer) v.mandates.push({ id: `${v.id}:mandate:${v.mandates.length + 1}`,
          personId: p.id, counselId: lawyer.id, disclosureId: disclosure.id, status: 'active', at,
          scope: 'This judgment review only; no waiver, prosecution appeal, payment, custody or player delegation.' });
        tell(b, p, v, at, `Mandatory independent review notice from ${reviewer.name}: proposed ${proposed.outcome}. ${proposed.reason} Original and new records supplied; at least one day to prepare optional challenges. Enforcement remains stayed.`);
        continue;
      }
      const disclosure = v.disclosures.at(-1);
      if (!disclosure || at < disclosure.prepareUntil) continue;
      const represented = prefs?.representation === 'counsel', remaining = 1800 - (v.phase === 'hearing' ? v.progress : 0);
      const mandate = v.mandates.find(m => m.status === 'active' && m.personId === p.id && m.counselId === lawyer?.id && m.disclosureId === disclosure.id);
      const authorized = represented ? mandate && able(lawyer) && lawyer.acceptsAppointments && lawyer.locationId === c.id
        && !lawyer.assignment && (!lawyer.job || lawyer.job === v.id) && lawyer.workSeconds >= remaining
        && ![p.id, reviewer.id, c.judge.id, g.chargingOffice?.prosecutor.id].includes(lawyer.id) : prefs?.representation === 'self';
      if (!reachable || prefs?.attend !== true || !authorized || o.workSeconds < remaining || p.provisions * 28800 < remaining
        || v.phase === 'hearing' && (v.represented !== represented || v.counselId !== (represented ? lawyer.id : null))) {
        pause('Review adjourned: actual participants, fresh counsel authority, channels or provisions unavailable.'); continue;
      }
      if (v.phase === 'preparation') {
        v.phase = 'hearing'; v.wasReady = false; v.progress = 0; v.represented = represented; v.counselId = represented ? lawyer.id : null;
        o.job = v.id; p.assignment = v.id; if (represented) lawyer.job = v.id;
        availability(b, p, at, true);
        v.sessions.push({ at, reviewerId: reviewer.id, reviewerLocationId: c.id, personId: p.id,
          defendantLocationId: bs.premises.id, counselId: v.counselId, disclosureId: disclosure.id }); continue;
      }
      if (v.phase !== 'hearing') continue;
      const work = v.wasReady ? Math.min(dt, remaining) : 0;
      v.wasReady = true; v.progress += work; o.workSeconds -= work; p.provisions -= work / 28800;
      if (represented) lawyer.workSeconds -= work;
      if (v.progress < 1800) continue;
      const result = disclosure.proposed;
      v.decision = { id: `${v.id}:decision`, at, reviewerId: reviewer.id, personId: p.id, cityId: g.cityId, institutionId: c.institutionId,
        trialId: input.sentence.trialId, sentenceId: input.sentence.id, disclosureId: disclosure.id, ...copy(result),
        submissions: [...new Set((prefs.challenges || []).filter(x => kinds.includes(x)))].map(kind => ({ kind,
          submittedBy: represented ? lawyer.id : p.id, sourceId: disclosure.id,
          finding: result.elements.find(e => e.id === kind)?.reason || result.reason })),
        mitigation: copy(input.sentence.mitigation),
        mitigationFinding: 'Only documented receiving role and existing findings considered; no new personal-means or harm evidence inferred.',
        enforcementAuthorized: false, custodyAuthorized: false, financialCollectionAuthorized: false };
      v.stayActive = !['affirmed', 'sentenceCorrected'].includes(result.outcome);
      v.disposition = v.stayActive ? 'reliefPendingSeparateProcedure' : 'finalAwaitingSeparateEnforcement';
      if (['retrialRequired', 'sentenceVacated'].includes(result.outcome)) v.handoff = { reviewDecisionId: v.decision.id,
        personId: p.id, cityId: g.cityId, trialId: input.sentence.trialId,
        kind: result.outcome === 'retrialRequired' ? 'separateRetrial' : 'separateResentencing', punishmentAuthorized: false, custodyAuthorized: false };
      v.sessions.at(-1).completedAt = at; o.power--; bs.power--; release(g, p, v); v.phase = 'decided';
      availability(b, p, at, false);
      tell(b, p, v, at, `Cargo review ${result.outcome}: ${result.reason} ${v.stayActive ? 'Enforcement remains blocked.' : 'Review stay lifted; a separate lawful enforcement proceeding is still required.'} No collection, arrest, custody or foreign enforcement authorized.`);
    }
  }
  return { advance, decision, kinds };
});
