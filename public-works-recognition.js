(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./charter-recognition') : root.HelixCharterRecognition);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPublicWorksRecognition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charter) {
  'use strict';
  const ROLE = 'publicWorksAndProvisioning';
  const LIMITS = 'This original municipal counter only. Coerced origin remains. No voluntary handover, citywide control, watch or defense command, judicial interference, confiscation, religious consent, new staff or ambition completion.';
  const SCOPE = 'This existing municipal counter upkeep only';
  const DUTIES = 'Receive physically carried clean maintenance parts into documented public-works custody and maintain this counter with three parts per repair, finite batteries and supplied staff recovery. No defense stock or private property may be appropriated.';
  const SAFEGUARDS = 'Existing one-day service and eight-hour grace; precise prospective upkeep commitments and independent objection review remain separately attended. Essential repairs do not renew suspended cooperation.';
  const renewedKind = kind => ['reaffirmationDiscussion', 'reaffirmationSigning'].includes(kind);
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const worker = (s, succession) => succession?.leaders.find(a => a.id === s?.workerId && a.roles.includes(ROLE));
  function create(charter, succession, office) {
    const a = succession?.leaders.find(a => a.roles.includes(ROLE)), r = charter?.recognition;
    if (!r || r.role !== 'centralAdministration' || !a || r.claimId !== charter.claim.id || r.reviewId !== charter.review?.id
      || r.personId !== charter.administratorId || r.institutionId !== office?.institutionId || r.recorderId !== office.clerk.id
      || succession.handover || office.id !== succession.officeId) return null;
    if (!a.publicWorksPolicy) {
      const n = [...a.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
      a.publicWorksPolicy = n % 5 === 0 ? 'declineCoercedContinuation' : 'considerSuppliedCounter';
    }
    return { id: `${charter.id}:public-works`, sourceTheme: charter.sourceTheme, cityId: charter.cityId, charterId: charter.charterId,
      officeId: office.id, clerkId: office.clerk.id, workerId: a.id, institutionId: a.institutionId, administrationReceiptId: r.id,
      phase: 'unheard', response: null, terms: null, receipt: null, reaffirmation: null, previousReaffirmations: [],
      job: null, history: [], message: '', nextNumber: 1 };
  }
  const normalize = s => s?.administrationReceiptId && s.workerId && Array.isArray(s.history)
    ? { ...copy(s), reaffirmation: s.reaffirmation ? copy(s.reaffirmation) : null, previousReaffirmations: copy(s.previousReaffirmations || []) } : null;
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-40); }
  function bound(s, charter, succession, abdication, office, c) {
    const a = worker(s, succession);
    // This is current institutional authorization, not the scientist's current
    // location. Actual attendance is checked separately; accepted work may run away.
    const canonical = { ...c, cityId: s?.cityId };
    return Boolean(s && a && charter?.recognition?.id === s.administrationReceiptId
      && Charter.authorityCurrent(charter, succession, abdication, office, canonical)
      && c.administrationAvailable && c.publicWorksAvailable && c.publicWorksInstitutionId === s.institutionId
      && a.institutionId === s.institutionId && a.locationId === s.officeId && office.id === s.officeId && office.clerk.id === s.clerkId);
  }
  function facts(s, charter, c) {
    return { administrationReceiptId: s.administrationReceiptId, findingId: charter.review.id,
      evidence: copy(charter.review.evidence), conditions: copy(c.publicWorksConditions || []) };
  }
  function local(s, charter, succession, abdication, office, c, own = false) {
    const a = worker(s, succession), id = own ? s.job?.id : null;
    const renewed = own ? renewedKind(s.job?.kind) : c.reaffirmationAttendance === true;
    return Boolean((renewed ? reaffirmationBasis(s, charter, succession, abdication, office, c) : bound(s, charter, succession, abdication, office, c))
      && Charter.operative(charter, succession, abdication, office, c) && c.alive && c.cityId === s.cityId
      && (!renewed || office.maintenanceReady !== false)
      && c.local && c.atCounter && c.visitPermission && c.capable && c.clerkPresent && c.lineOfSight && !c.busy && !c.activeViolence
      && c.presentIds?.includes(a.id) && able(a) && able(office.clerk) && office.channelPowered
      && (!a.assignment || a.assignment === id) && (!office.assignment || office.assignment === id)
      && (!office.clerk.assignment || office.clerk.assignment === id) && !succession.job && !charter.job);
  }
  function begin(s, charter, succession, abdication, office, c, at, kind, terms = null) {
    const attendance = { ...c, reaffirmationAttendance: renewedKind(kind) };
    if (!s || s.job || !local(s, charter, succession, abdication, office, attendance) || office.power < 1
      || at < (office.availableAt || 0) || office.workSeconds < 60 || worker(s, succession).workSeconds < 60) return false;
    const id = `${s.id}:meeting:${s.nextNumber++}`, a = worker(s, succession);
    s.job = { id, kind, terms: copy(terms), facts: renewedKind(kind) ? reaffirmationFacts(s, charter, c) : facts(s, charter, c),
      progress: 0, seconds: 60, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch };
    office.power--; a.assignment = office.assignment = office.clerk.assignment = id; s.phase = kind;
    note(s, at, kind, 'Attend one actual minute with the original public-works official and clerk; no unattended signature.'); return true;
  }
  function meet(s, charter, succession, abdication, office, c, at) {
    if (!s || !charter?.review || s.receipt || s.response && same(s.response.facts, facts(s, charter, c))) return false;
    return begin(s, charter, succession, abdication, office, c, at, 'discussion');
  }
  function sign(s, charter, succession, abdication, office, terms, c, at) {
    return Boolean(s?.terms && charter?.review && !s.receipt && same(terms, s.terms) && at < s.terms.expiresAt
      && same(s.response?.facts, facts(s, charter, c))
      && begin(s, charter, succession, abdication, office, c, at, 'continuation', terms));
  }
  function release(s, succession, office) {
    if (!s?.job) return false;
    for (const a of [worker(s, succession), office?.clerk, office]) if (a?.assignment === s.job.id) a.assignment = null;
    s.job = null; s.phase = s.receipt ? 'recognized' : s.terms ? 'offered' : 'unheard';
    return true;
  }
  function cancel(s, succession, office, at) {
    if (!release(s, succession, office)) return false;
    note(s, at, 'interrupted', 'Unfinished attendance ended without consent. Spent work and power remain spent.'); return true;
  }
  function advance(s, charter, succession, abdication, office, c, at) {
    if (!s?.job || !c.alive) return false;
    const j = s.job;
    const renewed = renewedKind(j.kind), offer = renewed ? s.reaffirmation?.terms : s.terms;
    if (!(renewed ? reaffirmationBasis(s, charter, succession, abdication, office, c) : bound(s, charter, succession, abdication, office, c))
      || j.bodyEpoch !== c.bodyEpoch || !same(j.facts, renewed ? reaffirmationFacts(s, charter, c) : facts(s, charter, c))
      || ['continuation', 'reaffirmationSigning'].includes(j.kind) && (!offer || at >= offer.expiresAt || !same(j.terms, offer)))
      return cancel(s, succession, office, at);
    if (!local(s, charter, succession, abdication, office, c, true)) { j.wasReady = false; j.lastAt = at; return false; }
    const a = worker(s, succession), start = j.lastAt;
    const work = j.wasReady ? Math.max(0, Math.min(at - start, 60 - j.progress, office.workSeconds, a.workSeconds)) : 0;
    j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; a.workSeconds -= work;
    if (j.progress < 60) return Boolean(work);
    const completedAt = start + work;
    if (renewed) {
      const r = s.reaffirmation;
      if (j.kind === 'reaffirmationDiscussion') {
        const refuses = a.publicWorksPolicy === 'declineCoercedContinuation' || j.facts.conditions.length > 0
          || j.facts.evidence.conduct.some(report => report.at > charter.claim.at && /attack/i.test(report.kind));
        r.response = { at: completedAt, personId: a.id, facts: copy(j.facts), decision: refuses ? 'refused' : 'offered',
          reason: refuses ? 'The original official refuses renewed cooperation on personal independence, received renewed violence or incompatible duties. Eligibility is neither forgiveness nor a criminal verdict.'
            : 'The original official offers separately renewed upkeep of the same supplied counter. Existing objections and their separate remedy/review remain intact.' };
        r.terms = refuses ? null : reaffirmationTerms(s, charter, c, completedAt);
        release(s, succession, office); s.phase = refuses ? 'reaffirmationRefused' : 'reaffirmationOffered';
        note(s, completedAt, 'reaffirmationResponse', r.response.reason);
      } else {
        r.receipt = { ...copy(j.terms), type: 'publicWorksReaffirmation', at: completedAt,
          terms: copy(j.terms), id: `${r.id}:receipt`, recorderId: office.clerk.id,
          commandRelationship: { personId: a.id, institutionId: a.institutionId, role: ROLE, scope: SCOPE } };
        office.records ||= []; office.records.push(copy(r.receipt));
        release(s, succession, office); s.phase = 'reaffirmed';
        note(s, completedAt, 'reaffirmed', 'Original public works separately reaffirmed this counter upkeep. Supplies, deadlines and prior objections were not reset; no other institution renewed assent.');
      }
    } else if (j.kind === 'discussion') {
      const refuses = a.publicWorksPolicy === 'declineCoercedContinuation' || j.facts.conditions.length > 0
        || j.facts.evidence.conduct.some(r => /attack/i.test(r.kind));
      s.response = { at: completedAt, personId: a.id, facts: copy(j.facts), decision: refuses ? 'refused' : 'offered',
        reason: refuses ? 'The original official declines on personal independence, received conduct or unsupported local obligations; this is not criminal guilt.'
          : 'The original official offers supplied upkeep of this counter only, not allegiance of other roles.' };
      s.terms = refuses ? null : { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: completedAt, expiresAt: completedAt + 3600,
        administrationReceiptId: s.administrationReceiptId, claimId: charter.claim.id, reviewId: charter.review.id,
        cityId: s.cityId, charterId: s.charterId, officeId: s.officeId, personId: a.id, institutionId: a.institutionId,
        role: ROLE, bodyEpoch: c.bodyEpoch, origin: 'coerced', retainedRights: charter.claim.terms.retainedRights,
        duties: DUTIES, safeguards: SAFEGUARDS, limitations: LIMITS };
      release(s, succession, office); s.phase = refuses ? 'refused' : 'offered'; note(s, completedAt, 'response', s.response.reason);
    } else {
      s.receipt = { id: `${s.id}:recognition`, at: completedAt, cityId: s.cityId, charterId: s.charterId, officeId: s.officeId,
        administrationReceiptId: s.administrationReceiptId, personId: a.id, institutionId: a.institutionId, recorderId: office.clerk.id,
        role: ROLE, bodyEpoch: c.bodyEpoch, origin: 'coerced', terms: copy(j.terms), suspendedRoles: [],
        commandRelationship: { personId: a.id, institutionId: a.institutionId, role: ROLE, scope: SCOPE }, limitations: LIMITS };
      release(s, succession, office); s.phase = 'recognized'; note(s, completedAt, 'recognized', 'Public works explicitly accepted its own bounded continuation. No other institution or role agreed.');
    }
    return true;
  }
  function originalReceipt(s, charter, succession, abdication, office, c) {
    const r = s?.receipt;
    return r && r.id === `${s.id}:recognition` && r.role === ROLE && r.origin === 'coerced'
      && r.personId === s.workerId && r.institutionId === s.institutionId && r.recorderId === s.clerkId
      && r.cityId === s.cityId && r.charterId === s.charterId && r.officeId === s.officeId
      && r.administrationReceiptId === charter?.recognition?.id && r.bodyEpoch === c.bodyEpoch
      && r.terms?.administrationReceiptId === s.administrationReceiptId && same(r.terms, s.terms)
      && r.terms.role === ROLE && r.terms.personId === s.workerId && r.terms.institutionId === s.institutionId
      && r.terms.cityId === s.cityId && r.terms.charterId === s.charterId && r.terms.officeId === s.officeId
      && r.terms.bodyEpoch === c.bodyEpoch && r.terms.claimId === charter.claim.id && r.terms.reviewId === charter.review.id
      && r.terms.origin === 'coerced' && r.terms.duties === DUTIES && r.terms.safeguards === SAFEGUARDS
      && r.terms.retainedRights === charter.claim.terms.retainedRights
      && r.commandRelationship?.personId === s.workerId && r.commandRelationship.institutionId === s.institutionId
      && r.commandRelationship.role === ROLE && r.commandRelationship.scope === SCOPE
      && s.response?.decision === 'offered' && s.response.personId === s.workerId
      && same(s.response.facts, facts(s, charter, { ...c, publicWorksConditions: s.response.facts.conditions }))
      && Charter.authenticRecognition(charter, succession, abdication, office, { ...c, cityId: s.cityId })
      && worker(s, succession)?.status === 'alive' && worker(s, succession).institutionId === s.institutionId
      && worker(s, succession).locationId === s.officeId && c.publicWorksAvailable && c.administrationAvailable
      && c.publicWorksInstitutionId === s.institutionId && office.id === s.officeId && office.clerk.id === s.clerkId ? r : null;
  }
  function essentialAuthorization(s, charter, succession, abdication, office, c) {
    return Charter.reconsiderationBound(charter) && originalReceipt(s, charter, succession, abdication, office, c);
  }
  function reaffirmationFacts(s, charter, c) {
    return { originalReceiptId: s.receipt.id, originalAdministrationReceiptId: s.administrationReceiptId,
      administrationReaffirmationId: charter.reaffirmation.receipt.id, findingId: charter.reconsideration.id,
      evidence: copy(charter.reconsideration.evidence), installationId: c.upkeep.installation.id,
      conditions: copy(c.publicWorksConditions || []) };
  }
  function reaffirmationBasis(s, charter, succession, abdication, office, c) {
    const canonical = { ...c, cityId: s?.cityId }, u = c.upkeep;
    return Boolean(originalReceipt(s, charter, succession, abdication, office, c)
      && Charter.currentReconsideration(charter, succession, abdication, office, canonical)
      && charter.reaffirmation?.receipt && Charter.recordsAuthorityCurrent(charter, succession, abdication, office, canonical)
      && u?.authorizationId === s.receipt.id && u.workerId === s.workerId && u.officeId === s.officeId
      && u.cityId === s.cityId && u.charterId === s.charterId && u.clerkId === s.clerkId
      && u.installation?.id === `${office.id}:service-channel` && same(u.installation.cell, office.civicCounter?.cell)
      && same(u.installation.workCell, { x: 17, y: 9, z: 6 }));
  }
  function reaffirmationTerms(s, charter, c, at) {
    const f = reaffirmationFacts(s, charter, c);
    return { id: `${s.reaffirmation.id}:terms`, offeredAt: at, expiresAt: at + 3600, ...f,
      claimId: charter.claim.id, cityId: s.cityId, charterId: s.charterId, officeId: s.officeId, personId: s.workerId,
      institutionId: s.institutionId, role: ROLE, origin: 'coerced', bodyEpoch: c.bodyEpoch,
      retainedRights: charter.claim.terms.retainedRights, duties: DUTIES, safeguards: SAFEGUARDS, limitations: LIMITS };
  }
  function canReaffirm(s, charter, succession, abdication, office, c) {
    if (!s || s.job || !reaffirmationBasis(s, charter, succession, abdication, office, c)) return false;
    const f = reaffirmationFacts(s, charter, c);
    return ![s.reaffirmation, ...(s.previousReaffirmations || [])].some(r => r?.response && same(r.response.facts, f));
  }
  function reaffirmMeeting(s, charter, succession, abdication, office, c, at) {
    if (!canReaffirm(s, charter, succession, abdication, office, c)
      || !begin(s, charter, succession, abdication, office, c, at, 'reaffirmationDiscussion')) return false;
    if (s.reaffirmation) s.previousReaffirmations.push(copy(s.reaffirmation));
    s.reaffirmation = { id: `${s.id}:reaffirmation:${s.nextNumber++}`, response: null, terms: null, receipt: null }; return true;
  }
  function reaffirmSign(s, charter, succession, abdication, office, terms, c, at) {
    const r = s?.reaffirmation;
    return Boolean(r?.terms && r.response?.decision === 'offered' && !r.receipt && same(terms, r.terms)
      && reaffirmationBasis(s, charter, succession, abdication, office, c) && same(r.response.facts, reaffirmationFacts(s, charter, c))
      && same(r.terms, reaffirmationTerms(s, charter, c, r.response.at)) && at < r.terms.expiresAt
      && begin(s, charter, succession, abdication, office, c, at, 'reaffirmationSigning', terms));
  }
  function reaffirmationCurrent(s, charter, succession, abdication, office, c) {
    if (!reaffirmationBasis(s, charter, succession, abdication, office, c)) return false;
    const a = s.reaffirmation, r = a?.receipt;
    return Boolean(r && r.id === `${a.id}:receipt` && r.type === 'publicWorksReaffirmation' && r.recorderId === office.clerk.id
      && a.response?.decision === 'offered' && same(a.response.facts, reaffirmationFacts(s, charter, c))
      && same(a.terms, reaffirmationTerms(s, charter, c, a.response.at)) && same(r.terms, a.terms)
      && r.at >= a.terms.offeredAt && r.at < a.terms.expiresAt
      && Object.entries(a.terms).every(([key, value]) => key === 'id' || same(r[key], value))
      && r.commandRelationship?.personId === s.workerId && r.commandRelationship.institutionId === s.institutionId
      && r.commandRelationship.role === ROLE && r.commandRelationship.scope === SCOPE
      && office.records?.some(record => same(record, r)));
  }
  function authorization(s, charter, succession, abdication, office, c) {
    return originalReceipt(s, charter, succession, abdication, office, c)
      && (bound(s, charter, succession, abdication, office, c) || reaffirmationCurrent(s, charter, succession, abdication, office, c)) ? s.receipt : null;
  }
  function publicView(s) {
    const view = r => r && { id: r.id, response: r.response && { at: r.response.at, decision: r.response.decision, reason: r.response.reason },
      terms: r.terms && Object.fromEntries(Object.entries(r.terms).filter(([key]) => !['evidence', 'conditions'].includes(key))),
      receipt: r.receipt && { id: r.receipt.id, at: r.receipt.at, personId: r.receipt.personId, role: r.receipt.role, origin: r.receipt.origin,
        findingId: r.receipt.findingId, originalReceiptId: r.receipt.originalReceiptId, installationId: r.receipt.installationId } };
    return s ? copy({ phase: s.phase, personId: s.workerId, response: s.response && { at: s.response.at, decision: s.response.decision, reason: s.response.reason },
      terms: s.terms, receipt: s.receipt, reaffirmation: view(s.reaffirmation), previousReaffirmations: (s.previousReaffirmations || []).map(view),
      working: s.job && { kind: s.job.kind, progress: s.job.progress, seconds: 60 }, message: s.message, limitations: LIMITS }) : null;
  }
  return { ROLE, LIMITS, worker, create, normalize, meet, sign, cancel, advance, authorization, essentialAuthorization,
    canReaffirm, reaffirmMeeting, reaffirmSign, reaffirmationCurrent, publicView };
});
