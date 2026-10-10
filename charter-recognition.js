(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext,
    typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCharterRecognition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions, Theme) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const registry = Theme.createRegistry([{ id: 'recognition.shared.charter-review', kind: 'charterRecognition', compatibility: 'shared',
    template: 'Independent charter review and scoped administrative continuation', contentTags: ['science', 'survival'], fallback: true }]);
  const LIMITS = 'Central administration only, not citywide sovereignty. Other institutions have not agreed through this signature. No voluntary handover, army, pardon, immunity, confiscation, divine endorsement or ambition completion. Existing appointments, cases, property and religious duties remain.';
  const admin = (s, succession) => succession?.leaders.find(a => a.id === s?.administratorId && a.roles.includes('centralAdministration'));
  const reviewer = (s, succession) => succession?.leaders.find(a => a.id === s?.reviewerId && a.roles.includes('civicReview'));
  function create(succession, abdication, office, theme = 'madcap') {
    const claim = abdication?.receipt, source = succession?.source;
    if (!claim || claim.origin !== 'coerced' || claim.recognition !== 'disputedSuccessorClaim' || !source
      || claim.cityId !== source.cityId || claim.charterId !== source.charterId || claim.declarantId !== succession.ruler.id
      || succession.ruler.officeStatus?.sourceReceiptId !== claim.id || succession.handover
      || office?.id !== succession.officeId || claim.recorderId !== office.clerk?.id || claim.recorderInstitutionId !== office.institutionId
      || !claim.witnesses?.includes(office.clerk.id)) return null;
    const a = succession.leaders.find(a => a.roles.includes('centralAdministration')),
      r = succession.leaders.find(a => a.roles.includes('civicReview'));
    if (!a || !r || a.institutionId !== office.institutionId) return null;
    const selected = Theme.selectContent(registry, { kind: 'charterRecognition', worldTheme: theme, seed: source.cityId, required: true });
    if (!selected.ok) return null;
    // A stable choice of the same original official, not a refreshed chance or
    // a new officeholder. An eligible charter finding does not compel assent.
    if (!a.recognitionPolicy) {
      const n = [...a.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
      a.recognitionPolicy = n % 4 === 0 ? 'declineCoercedAppointment' : 'considerAdministrativeContinuity';
    }
    return { id: `${source.cityId}:charter-recognition`, definitionId: selected.definitionId, sourceTheme: selected.sourceTheme,
      cityId: source.cityId, charterId: source.charterId, officeId: office.id, clerkId: office.clerk.id,
      administratorId: a.id, administrationId: a.institutionId, reviewerId: r.id, reviewInstitutionId: r.institutionId,
      claim: copy(claim), phase: 'unfiled', review: null, previousReviews: [], response: null, terms: null,
      recognition: null, instruction: null, job: null, history: [], message: '', nextNumber: 1 };
  }
  const normalize = s => s?.claim?.id && s.clerkId && Array.isArray(s.history) && Array.isArray(s.previousReviews) ? copy(s) : null;
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-50); }
  function bound(s, succession, abdication, office, c) {
    return Boolean(s && same(s.claim, abdication?.receipt) && succession?.ruler.officeStatus?.sourceReceiptId === s.claim.id
      && !succession.handover && succession.source.cityId === s.cityId && succession.source.charterId === s.charterId
      && c.charterCurrent && c.cityId === s.cityId && c.authorityId === s.claim.declarantId
      && office?.id === s.officeId && office.institutionId === s.administrationId && office.clerk.id === s.clerkId
      && office.clerk.locationId === office.id && admin(s, succession)?.institutionId === s.administrationId
      && reviewer(s, succession)?.institutionId === s.reviewInstitutionId);
  }
  const independent = (s, succession) => Boolean(reviewer(s, succession) && s.reviewerId !== s.administratorId
    && s.reviewInstitutionId !== s.administrationId);
  function local(s, succession, abdication, office, c, own = false) {
    return Boolean(bound(s, succession, abdication, office, c) && c.alive && c.capable && c.local && c.atCounter
      && c.visitPermission && c.clerkPresent && c.lineOfSight && !c.busy && !c.activeViolence
      && c.bodyEpoch === s.claim.bodyEpoch && office.active && office.channelPowered && able(office.clerk)
      && c.administrationAvailable && !succession.job
      && (!office.assignment || own && office.assignment === s.job?.id)
      && (!office.clerk.assignment || own && office.clerk.assignment === s.job?.id));
  }
  function evidence(s, c) {
    return { claimId: s.claim.id, rule: copy(c.rule || null), authorizationIds: [...new Set(c.authorizationIds || [])].sort(),
      conduct: (c.conduct || []).filter(r => r.at >= s.claim.at).map(r => ({ id: r.id, at: r.at, kind: r.kind, targetId: r.targetId, witnessId: r.witnessId })).sort((a, b) => a.id.localeCompare(b.id)) };
  }
  function file(s, succession, abdication, office, institutions, c, at) {
    if (!local(s, succession, abdication, office, c) || s.job || s.recognition || !independent(s, succession)
      || !c.reviewAvailable || institutions?.cityId !== s.cityId || institutions.roles['civic-review'] !== s.reviewInstitutionId
      || office.workSeconds < 30) return false;
    const facts = evidence(s, c);
    if (s.review && same(s.review.evidence, facts)) return false;
    const id = `${s.id}:review:${s.nextNumber}`, readyAt = Institutions.reserve(institutions, 'civic-review', id, at);
    if (readyAt == null) return false;
    if (s.review) s.previousReviews.push(copy(s.review));
    s.nextNumber++; office.workSeconds -= 30;
    s.review = { id, filedAt: at, readyAt, reviewerId: s.reviewerId, evidence: facts, status: 'queued', finding: null };
    s.response = null; s.terms = null; s.phase = 'queued';
    note(s, at, 'filed', 'Filed the original coerced claim and scoped evidence in the existing independent review queue. Filing grants no recognition.'); return true;
  }
  function reviewAllocation(s, institutions, c, at) {
    return Boolean(s.review && c.reviewAvailable && institutions?.roles['civic-review'] === s.reviewInstitutionId
      && institutions.offices[s.reviewInstitutionId]?.available
      && institutions.offices[s.reviewInstitutionId]?.jobs[s.review.id]?.readyAt === s.review.readyAt && at >= s.review.readyAt);
  }
  function release(s, succession, office) {
    if (!s.job) return;
    for (const a of [reviewer(s, succession), admin(s, succession), office?.clerk]) if (a?.assignment === s.job.id) a.assignment = null;
    if (office?.assignment === s.job.id) office.assignment = null;
    s.job = null;
  }
  function jobReady(s, succession, abdication, office, institutions, c, at, kind, own = false) {
    if (!local(s, succession, abdication, office, c, own) || at < (office.availableAt || 0)) return false;
    const a = kind === 'review' ? reviewer(s, succession) : admin(s, succession);
    if (!able(a) || !c.presentIds?.includes(a.id) || a.locationId !== office.id
      || a.assignment && (!own || a.assignment !== s.job?.id)) return false;
    if (kind === 'review') return independent(s, succession) && reviewAllocation(s, institutions, c, at)
      && s.review.status === 'queued' && same(s.review.evidence, evidence(s, c));
    return Boolean(s.review?.finding?.outcome === 'eligible' && same(s.review.evidence, evidence(s, c))
      && (kind !== 'continuation' || s.terms && at < s.terms.expiresAt)
      && (kind !== 'instruction' || operative(s, succession, abdication, office, c)));
  }
  function begin(s, succession, abdication, office, institutions, c, at, kind, seconds, terms = null) {
    if (s.job || !jobReady(s, succession, abdication, office, institutions, c, at, kind) || office.power < 1 || office.workSeconds < seconds) return false;
    const a = kind === 'review' ? reviewer(s, succession) : admin(s, succession);
    if (a.workSeconds < seconds) return false;
    const id = `${s.id}:work:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch, terms: copy(terms), personId: a.id };
    office.power--; office.assignment = office.clerk.assignment = a.assignment = id; s.phase = kind;
    note(s, at, kind, `Attend ${seconds} actual seconds for ${kind} with the original civic people. Missed attendance cannot be backfilled.`); return true;
  }
  function hear(s, succession, abdication, office, institutions, c, at) {
    return s?.review?.status === 'queued' && begin(s, succession, abdication, office, institutions, c, at, 'review', 180);
  }
  function meeting(s, succession, abdication, office, institutions, c, at) {
    if (!s || s.recognition || s.response && same(s.response.evidence, evidence(s, c))) return false;
    return begin(s, succession, abdication, office, institutions, c, at, 'recognitionMeeting', 60);
  }
  function sign(s, succession, abdication, office, institutions, expected, c, at) {
    return Boolean(s?.terms && !s.recognition && same(s.terms, expected)
      && begin(s, succession, abdication, office, institutions, c, at, 'continuation', 60, expected));
  }
  function operative(s, succession, abdication, office, c) {
    return Boolean(s?.recognition && bound(s, succession, abdication, office, c) && c.alive && c.bodyEpoch === s.recognition.bodyEpoch
      && c.administrationAvailable && able(admin(s, succession)) && office.active
      && same(s.review.evidence, evidence(s, c)));
  }
  function instructionTerms(s) {
    return s?.recognition ? { recognitionId: s.recognition.id, institutionId: s.administrationId, role: 'centralAdministration',
      action: 'Enter one scoped succession memorandum in the original local administrative register',
      contents: { claimId: s.claim.id, reviewId: s.review.id, recognitionId: s.recognition.id, origin: 'coerced',
        recognizedRole: 'centralAdministration', limitations: LIMITS } } : null;
  }
  function instruct(s, succession, abdication, office, institutions, expected, c, at) {
    if (!s || s.instruction || !same(expected, instructionTerms(s))) return false;
    return begin(s, succession, abdication, office, institutions, c, at, 'instruction', 60, expected);
  }
  function cancel(s, succession, office, at, reason = 'Attendance interrupted without a new decision. Spent work and the original queue allocation remain.') {
    if (!s?.job) return false;
    release(s, succession, office); s.phase = s.recognition ? 'recognized' : s.terms ? 'offered' : s.review?.status === 'queued' ? 'queued' : 'reviewed';
    note(s, at, 'interrupted', reason); return true;
  }
  function finding(s) {
    const f = s.review.evidence, rule = f.rule;
    if (!rule || rule.principle !== s.claim.terms.successionPrinciple || rule.reviewInstitutionId !== s.reviewInstitutionId)
      return { outcome: 'unresolved', reason: 'No applicable explicit charter rule authorizes this reviewer to confirm a coerced designation.' };
    if (rule.coercionRule === 'uncoercedDesignationRequired') return { outcome: 'ineligible', reason: 'The published local rule requires an uncoerced designation. An authentic coerced declaration does not meet it.' };
    if (rule.coercionRule !== 'independentConfirmationPermitted' || !Array.isArray(rule.requiredAuthorizationIds))
      return { outcome: 'unresolved', reason: 'The applicable confirmation procedure is unsupported or incomplete; no law is invented.' };
    if (rule.requiredAuthorizationIds.some(id => !f.authorizationIds.includes(id)))
      return { outcome: 'unresolved', reason: 'An explicitly required authorization has not been authenticated. Civic signatures cannot substitute for divine approval.' };
    return { outcome: 'eligible', reason: 'The explicit local rule permits independent confirmation of this authentic coerced designation for separate institutional consideration. Coercion and all independent duties remain; no criminal guilt or pardon is decided.' };
  }
  function advance(s, succession, abdication, office, institutions, c, at) {
    if (!s?.job || !c.alive) return false;
    const j = s.job;
    if (!bound(s, succession, abdication, office, c) || c.bodyEpoch !== j.bodyEpoch)
      return cancel(s, succession, office, at, 'Original claim, charter, body or civic identity changed. No new recognition or instruction was completed.');
    if (j.kind === 'continuation' && at >= s.terms.expiresAt) {
      cancel(s, succession, office, at, 'Unsigned continuation terms expired without renewal.'); s.phase = 'expired'; return true;
    }
    const ready = jobReady(s, succession, abdication, office, institutions, c, at, j.kind, true)
      && (j.kind !== 'continuation' || same(j.terms, s.terms))
      && (j.kind !== 'instruction' || same(j.terms, instructionTerms(s)));
    if (!ready) { j.wasReady = false; j.lastAt = at; return false; }
    const a = j.kind === 'review' ? reviewer(s, succession) : admin(s, succession), start = j.lastAt;
    const work = j.wasReady ? Math.max(0, Math.min(Math.max(0, at - start), j.seconds - j.progress, office.workSeconds, a.workSeconds)) : 0;
    j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; a.workSeconds -= work;
    if (j.progress < j.seconds) return Boolean(work);
    const completedAt = start + work;
    if (j.kind === 'review') {
      s.review.status = 'completed'; s.review.completedAt = completedAt;
      s.review.finding = { ...finding(s), at: completedAt, reviewerId: a.id, claimId: s.claim.id, origin: 'coerced', limitations: LIMITS };
      s.phase = 'reviewed'; note(s, completedAt, 'finding', s.review.finding.reason);
    } else if (j.kind === 'recognitionMeeting') {
      const opposition = s.review.evidence.conduct.some(r => r.at > s.claim.at && /attack/i.test(r.kind));
      const refuses = a.recognitionPolicy === 'declineCoercedAppointment' || opposition;
      s.response = { at: completedAt, personId: a.id, evidence: copy(s.review.evidence), decision: refuses ? 'refused' : 'offered',
        reason: opposition ? 'The official declines continuation after received evidence of renewed violence; this is personal refusal, not conviction.'
          : refuses ? 'The original official declines this coerced appointment on grounds of institutional independence.'
            : 'The original official offers administrative continuity under exact retained duties, not citywide obedience.' };
      s.terms = refuses ? null : { id: `${s.id}:continuation:${s.nextNumber++}`, offeredAt: completedAt, expiresAt: completedAt + 3600,
        claimId: s.claim.id, reviewId: s.review.id, personId: a.id, institutionId: a.institutionId, bodyEpoch: c.bodyEpoch,
        role: 'centralAdministration', origin: 'coerced', duties: 'Continue existing administrative records duties with actual supplied staff work and power. Permit one scoped succession memorandum; no interference with cases, property, existing appointments or religious obligations.',
        retainedRights: s.claim.terms.retainedRights, limitations: LIMITS };
      s.phase = refuses ? 'refused' : 'offered'; note(s, completedAt, 'response', s.response.reason);
    } else if (j.kind === 'continuation') {
      s.recognition = { id: `${s.id}:recognition`, at: completedAt, cityId: s.cityId, charterId: s.charterId, bodyEpoch: c.bodyEpoch,
        claimId: s.claim.id, reviewId: s.review.id, institutionId: a.institutionId, personId: a.id, recorderId: office.clerk.id,
        recognizedAuthorityId: 'scientist', role: 'centralAdministration', origin: 'coerced', terms: copy(j.terms),
        commandRelationship: { personId: a.id, institutionId: a.institutionId, role: 'centralAdministration', scope: 'Existing administrative records only' }, limitations: LIMITS };
      s.phase = 'recognized'; note(s, completedAt, 'recognized', 'Central administration explicitly recognized this claim and accepted its own bounded continuation. No other institution agreed.');
    } else {
      const record = { id: `${s.id}:memorandum`, at: completedAt, type: 'scopedSuccessionMemorandum', contents: copy(j.terms.contents),
        authorId: a.id, recorderId: office.clerk.id, institutionId: office.institutionId };
      // Keep this category in the same original office's local register, but
      // separate from its identity-document records and verification pipeline.
      office.successionMemoranda ||= []; office.successionMemoranda.push(record);
      s.instruction = { id: `${s.id}:instruction`, at: completedAt, recordId: record.id, contents: copy(record.contents),
        personId: a.id, recorderId: office.clerk.id, recognitionId: s.recognition.id, status: 'completed', limitations: LIMITS };
      s.phase = 'recognized'; note(s, completedAt, 'instruction', 'The original administrator and clerk performed the scoped register instruction once. No goods, maps, fees, appointments or other commands changed.');
    }
    release(s, succession, office); return true;
  }
  function publicView(s) {
    if (!s) return null;
    return copy({ phase: s.phase, claimId: s.claim.id, rule: s.review?.evidence.rule || null,
      review: s.review ? { id: s.review.id, readyAt: s.review.readyAt, status: s.review.status, finding: s.review.finding } : null,
      response: s.response ? { at: s.response.at, personId: s.response.personId, decision: s.response.decision, reason: s.response.reason } : null,
      terms: s.terms, recognition: s.recognition, instruction: s.instruction, instructionTerms: instructionTerms(s),
      working: s.job ? { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds } : null, message: s.message, limitations: LIMITS });
  }
  return { LIMITS, create, normalize, admin, reviewer, independent, file, hear, meeting, sign, operative, instructionTerms, instruct, cancel, advance, publicView };
});
