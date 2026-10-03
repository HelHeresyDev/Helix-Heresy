(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-trial') : root.HelixCargoTrial);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoSentencing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trial) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const free = (job, id) => !job || job === id;
  function basis(g, d) {
    const t = d.trial, h = t?.sentencingHandoff, j = t?.judgment;
    const disclosure = t?.disclosures.find(x => x.id === j?.disclosureId), proposal = disclosure?.proposal;
    if (!h || h.status !== 'awaitingSeparateSentencing' || j?.outcome !== 'convicted' || !same(h.judgment, j) || h.trialId !== t.id || h.personId !== j.personId
      || h.actorId !== d.actorId || j.actorId !== d.actorId || h.cityId !== g.cityId || j.cityId !== g.cityId
      || h.institutionId !== g.cargoCourt.institutionId || h.lawId !== proposal?.count.lawId
      || !['identity', 'transaction', 'contraband', 'knowledge', 'authorization'].every(id => j.elements.some(e => e.id === id && e.established))) return null;
    return { trialId: t.id, judgment: copy(j), proposal: copy(proposal), document: copy(proposal.subjectDocument) };
  }
  function proposalFor(input) {
    const law = input.proposal.disclosure.evidence.law, at = input.proposal.count.eventAt;
    if (!Number.isFinite(at) || !law?.active || law.id !== input.proposal.count.lawId || law.cityId !== input.judgment.cityId
      || law.offenseId !== 'contrabandCommerce' || !Number.isFinite(law.publishedAt) || law.publishedAt > at
      || !Number.isFinite(law.effectiveAt) || law.effectiveAt > at || !law.sourceLawId)
      return { reason: 'Applicable prospective local penalty publication is missing.' };
    const policy = law.sentencing, sanctions = policy?.ordinarySanctions;
    const range = sanctions?.includes('fine') ? policy.fineRangeCredits : policy?.finitePrisonRangeMonths;
    if (!Array.isArray(sanctions) || !range || !Number.isSafeInteger(range.minimum) || !Number.isSafeInteger(range.maximum)
      || range.minimum < 0 || range.minimum > range.maximum)
      return { reason: 'Published local penalty terms are incomplete. Missing fine amounts do not authorize substituting imprisonment.' };
    const fine = sanctions.includes('fine');
    if (!fine && (!sanctions.includes('finitePrison') || range.minimum < 1 || range.maximum > 120))
      return { reason: 'No supported bounded ordinary sanction; capital, legion, banishment and indefinite custody require separate procedures.' };
    return { sanction: fine ? { kind: 'fine', credits: range.minimum } : { kind: 'finitePrison', months: range.minimum },
      lawId: law.id, sourceLawId: law.sourceLawId, policy: copy(policy),
      reasons: ['The published lower bound applies to this bounded receiving-person conviction. No additional penalty or higher term is inferred.',
        'A received chemical is not proof of organizing a market, corruption, injury, or another person’s conduct.'],
      mitigation: [{ kind: 'role', sourceId: input.trialId, finding: input.proposal.count.actor.role === 'receiver'
        ? 'Only the receiving role was established; no organizer or principal role is inferred.' : 'Only the role actually established by the judgment is considered.' },
      { kind: 'harm', finding: 'No separate harm finding is supplied by this trial adapter. This is not a finding that no harm occurred.' },
      { kind: 'personalCircumstances', finding: 'No authenticated personal financial, health or dependency records are supplied. Private NPC state and company assets are not defendant means.' }],
      limitation: 'Accusations, silence, unproved prior offenses, player reputation and custody are not aggravation.' };
  }
  function tell(b, p, s, at, text) {
    if (s.events.at(-1)?.text === text) return;
    s.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.sentencingNotices ||= []).push({ at, sentencingId: s.id, text, scope: 'Receiver-consented sentencing record; no authority over another person.' });
  }
  function availability(b, p, at, busy) {
    if (p?.courtPreferences?.shareAvailability && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.availabilityNotices ||= []).push({ at, text: busy
        ? 'Receiving representative is unavailable during a personal sentencing hearing.' : 'Receiving representative has finished the remote sentencing session.' });
  }
  function release(g, b, p, s, at) {
    const c = g.cargoCourt, o = g.chargingOffice;
    if (c.trialJob === s.id) { c.trialJob = null; c.wasReady = false; c.lastAt = at; }
    if (o?.trialJob === s.id) { o.trialJob = null; o.wasReady = false; o.lastAt = at; }
    if (c.counsel.trialJob === s.id) c.counsel.trialJob = null;
    if (p?.assignment === s.id) { p.assignment = null; p.availableAt = at; availability(b, p, at, false); }
    s.wasReady = false;
  }
  function advance(state, g, at) {
    const c = g.cargoCourt;
    if (!c || !Number.isFinite(at)) return;
    for (const d of c.dockets) {
      let s = d.sentencing;
      if (s?.sentence || at < (s?.lastAt || 0)) continue;
      const input = basis(g, d);
      if (!s && !input) continue;
      if (!s) s = d.sentencing = { id: `${d.trial.id}:sentencing`, personId: input.judgment.personId,
        phase: 'scheduling', lastAt: at, progress: 0, wasReady: false, disclosures: [], mandates: [], sessions: [], events: [] };
      const dt = Math.max(0, at - s.lastAt); s.lastAt = at;
      const b = state.buyers.find(b => b.buyerService?.representatives.some(p => p.id === s.personId));
      const p = b?.buyerService.representatives.find(p => p.id === s.personId), bs = b?.buyerService;
      const pause = (phase, reason) => { release(g, b, p, s, at); s.phase = phase; s.progress = 0; tell(b, p, s, at, reason); };
      if (!input || !Trial.local(g) || !p || b.cityId !== g.cityId || input.judgment.personId !== s.personId) {
        pause('reviewRequired', 'Sentencing stayed: current local authority, original judgment or verified defendant unavailable. No enforcement authorized.'); continue;
      }
      const r = g.criminalIntake?.referrals.find(r => r.id === d.referralId), i = r?.investigation;
      if (d.status !== 'allowed' || !d.handoff || !same(input.proposal.disclosure.evidence, r?.revisions.at(-1)?.evidence)
        || !same(input.proposal.disclosure.assessment, i?.assessments.at(-1))
        || i?.assessedSignature !== `${r?.reviewedRevision}:${i?.submissions.length}:${i?.corrections.length}`) {
        pause('reviewRequired', 'New case material requires separate judgment review; sentencing cannot rewrite the conviction. No enforcement authorized.'); continue;
      }
      const proposed = proposalFor(input);
      if (!proposed.sanction) { pause('policyPending', `Sentencing pending: ${proposed.reason} No punishment or custody authorized.`); continue; }
      // Only prior local judgments actually held by this court are disclosed.
      // They cannot aggravate without a separately supported statutory finding.
      const priorJudgments = c.dockets.filter(other => other.id !== d.id && other.trial?.judgment?.personId === p.id
        && other.trial.judgment.outcome === 'convicted' && other.trial.judgment.at < input.proposal.count.eventAt)
        .map(other => copy(other.trial.judgment));
      const candidate = { ...input, proposed, priorJudgments };
      const signature = JSON.stringify(candidate);
      if (s.signature !== signature) {
        release(g, b, p, s, at); s.signature = signature; s.candidate = copy(candidate); s.phase = 'scheduling'; s.progress = 0;
        for (const m of s.mandates) if (m.status === 'active') { m.status = 'superseded'; m.endedAt = at; }
      }
      if (['adjourned', 'reviewRequired', 'policyPending'].includes(s.phase)) {
        if (at < (s.retryAt || 0)) continue;
        s.phase = 'scheduling'; s.progress = 0; s.wasReady = false;
      }
      const o = g.chargingOffice, lawyer = c.counsel;
      const judgeReady = c.channelPowered && able(c.judge) && c.judge.locationId === c.id && c.power >= 1 && c.workSeconds > 0
        && !c.job && !c.appearanceJob && !c.custodyJob && free(c.trialJob, s.id);
      if (s.phase === 'scheduling') {
        if (!judgeReady) { release(g, b, p, s, at); continue; }
        if (s.judgeId !== c.judge.id) { s.judgeId = c.judge.id; s.progress = 0; s.wasReady = false; }
        c.trialJob = s.id;
        const work = s.wasReady ? Math.min(dt, 600 - s.progress, c.workSeconds) : 0;
        s.wasReady = true; s.progress += work; c.workSeconds -= work;
        if (s.progress < 600) continue;
        c.power--; s.phase = 'notice'; release(g, b, p, s, at); continue;
      }
      const prefs = p.sentencingPreferences;
      const address = input.proposal.disclosure.assessment.recipientFindings?.flatMap(f => (f.events || []).filter(e =>
        f.comparisons?.some(c => c.recordId === e.id && c.result === 'matchesCarrierCopy'))).find(e =>
        e.kind === 'chemicalDisclosure' && e.observationId === d.actorId)?.serviceLocation;
      const receiverReady = Trial.identified(state, p, input.document, at) && p.locationId === b.cityId && bs.locationId === b.cityId
        && address?.siteId === bs.premises?.id && address.cityId === b.cityId && bs.channelPowered && bs.credentialActive && bs.power >= 1
        && !bs.assignment && free(p.assignment, s.id) && (p.availableAt || 0) <= at;
      if (s.phase === 'notice') {
        if (!receiverReady || prefs?.acceptNotice !== true) continue;
        bs.power--;
        const disclosure = { id: `${s.id}:disclosure:${s.disclosures.length + 1}`, receivedAt: at, prepareUntil: at + 86400, ...copy(s.candidate) };
        s.disclosures.push(disclosure); s.phase = 'preparation'; s.progress = 0;
        for (const m of s.mandates) if (m.status === 'active') { m.status = 'superseded'; m.endedAt = at; }
        if (prefs.representation === 'counsel') s.mandates.push({ id: `${s.id}:mandate:${s.mandates.length + 1}`, at, personId: p.id,
          counselId: lawyer.id, disclosureId: disclosure.id, status: 'active', scope: 'Sentencing hearing only; no plea, waiver of review, collection, custody or player delegation.' });
        const penalty = proposed.sanction.kind === 'fine' ? `${proposed.sanction.credits} credits` : `${proposed.sanction.months} months finite prison`;
        tell(b, p, s, at, `Fresh sentencing notice: proposed ${penalty} under ${proposed.sourceLawId}. Exact penalty basis and mitigation supplied; at least one day to prepare. Any sentence remains stayed for separate review.`);
        continue;
      }
      const disclosure = s.disclosures.at(-1);
      if (!disclosure || at < disclosure.prepareUntil) continue;
      const represented = prefs?.representation === 'counsel', remaining = 1800 - (s.phase === 'hearing' ? s.progress : 0);
      const mandate = s.mandates.find(m => m.status === 'active' && m.disclosureId === disclosure.id && m.personId === p.id && m.counselId === lawyer.id);
      const authorized = represented ? mandate && able(lawyer) && lawyer.locationId === c.id && lawyer.acceptsAppointments
        && !lawyer.job && free(lawyer.trialJob, s.id) && lawyer.workSeconds >= remaining : prefs?.representation === 'self';
      const ids = [p.id, c.judge.id, o?.prosecutor.id, ...(represented ? [lawyer.id] : [])];
      const ready = receiverReady && prefs?.attend === true && authorized && judgeReady && c.workSeconds >= remaining
        && o?.active && o.cityId === g.cityId && o.locationId === g.id && o.channelPowered && o.power >= 1 && o.workSeconds >= remaining
        && g.criminalIntake?.active && o.institutionId === g.criminalIntake.institutionId
        && able(o.prosecutor) && o.prosecutor.locationId === o.locationId && !o.job && free(o.trialJob, s.id)
        && p.provisions * 28800 >= remaining && new Set(ids).size === ids.length;
      if (!ready || s.phase === 'hearing' && (!same(ids, s.participantIds) || represented !== s.represented)) {
        pause('adjourned', 'Sentencing adjourned: actual participants, express representation, channels or finite resources unavailable. No adverse inference or custody extension.');
        s.retryAt = at + 3600; continue;
      }
      if (s.phase === 'preparation') {
        s.phase = 'hearing'; s.progress = 0; s.wasReady = false; s.participantIds = ids; s.represented = represented;
        c.trialJob = s.id; o.trialJob = s.id; p.assignment = s.id; if (represented) lawyer.trialJob = s.id;
        s.sessions.push({ at, disclosureId: disclosure.id, participants: ids.map(id => ({ id, locationId: id === p.id ? bs.premises.id : id === o.prosecutor.id ? o.locationId : c.id })) });
        availability(b, p, at, true); continue;
      }
      if (s.phase !== 'hearing') continue;
      const work = s.wasReady ? Math.min(dt, remaining) : 0;
      s.wasReady = true; s.progress += work; c.workSeconds -= work; o.workSeconds -= work; p.provisions -= work / 28800;
      if (represented) lawyer.workSeconds -= work;
      if (s.progress < 1800) continue;
      s.sessions.at(-1).completedAt = at; c.power--; o.power--; bs.power--;
      s.sentence = { id: `${s.id}:sentence`, at, status: 'stayedPendingReview', personId: p.id, actorId: d.actorId, cityId: g.cityId,
        institutionId: c.institutionId, judgeId: c.judge.id, disclosureId: disclosure.id, trialId: input.trialId,
        sanction: copy(disclosure.proposed.sanction), lawId: disclosure.proposed.lawId, sourceLawId: disclosure.proposed.sourceLawId,
        reasons: copy(disclosure.proposed.reasons), mitigation: copy(disclosure.proposed.mitigation),
        defense: { submittedBy: represented ? lawyer.id : p.id, request: prefs.requestMitigation === true ? 'Consider documented role, harm and personal circumstances; exclude unsupported aggravation.' : 'No mitigation request; silence adds no aggravation.',
          finding: 'All disclosed mitigating material considered. Unsupported personal circumstances, harm and accusations cannot increase the published lower-bound sanction.' },
        priorJudgmentFinding: 'Disclosed prior local judgments do not increase punishment without a separate supported statutory aggravation finding.',
        review: { status: 'awaitingSeparateProcedure', rights: 'Challenge the conviction or penalty through separate judgment review. No waiver inferred.', expiresAt: null },
        enforcementAuthorized: false, custodyAuthorized: false, financialCollectionAuthorized: false };
      s.phase = 'sentence'; release(g, b, p, s, at);
      const penalty = s.sentence.sanction.kind === 'fine' ? `fine of ${s.sentence.sanction.credits} credits` : `${s.sentence.sanction.months} months finite prison`;
      tell(b, p, s, at, `Sentencing decision stayed pending separate judgment review: ${penalty}. No payment, custody, imprisonment or enforcement authorized. Review rights do not expire while the review procedure is unavailable.`);
    }
  }
  return { advance, proposalFor };
});
