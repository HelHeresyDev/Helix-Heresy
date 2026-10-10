(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./charter-recognition') : root.HelixCharterRecognition,
    typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDefenseRecognition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Charter, Theme) {
  'use strict';
  const ROLE = 'militaryDefenseCommand', POST = Object.freeze({ x: 19, y: 8, z: 6 }), SECONDS = 120;
  const registry = Theme.createRegistry([{ id: 'defense.shared.limited-cover', kind: 'defenseRecognition', compatibility: 'shared',
    contentTags: ['survival', 'science'], template: 'Original defender and one bounded protective ward', fallback: true }]);
  const LIMITS = 'One original defender and one short-range protective duty only. Coercion, cases, property, judicial independence, existing defense and religious obligations remain. No army, offensive commands, arrests, immunity, divine assent, citywide control or exclusive joint-stronghold command.';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
  const basisReference = b => b && Object.fromEntries(Object.entries(b).filter(([key]) => !['evidence', 'agreement'].includes(key)));
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const actor = (s, b) => s?.personId && b?.defender?.id === s.personId ? b.defender : null;
  function basis(charter, succession, abdication, b, office, c) {
    if (!c.alive || !c.charterCurrent || !office?.active || !b?.defender || succession?.source.charterId !== b.source.charterId
      || succession.officeId !== office.id || office.cityId !== b.source.cityId) return null;
    if (succession.handover && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === c.bodyEpoch && succession.handover.bodyEpoch === c.bodyEpoch
      && succession.handover.charterId === b.source.charterId && succession.handover.cityId === b.source.cityId
      && succession.handover.recognizedAuthorityId === 'scientist' && succession.control.sourceReceiptId === succession.handover.id) {
      const agreement = succession.agreements.find(r => r.personId === b.defender.id && r.institutionId === b.source.defenseId
        && r.termsId === succession.handover.termsId && r.roles?.includes(ROLE) && !r.suspendedRoles?.includes(ROLE));
      if (!agreement) return null;
      return { origin: 'voluntary', receiptId: succession.handover.id,
        agreement: { personId: agreement.personId, institutionId: agreement.institutionId, at: agreement.at,
          termsId: agreement.termsId, basis: agreement.basis, scope: agreement.scope, role: ROLE },
        charterId: b.source.charterId, bodyEpoch: c.bodyEpoch };
    }
    if (!Charter.recordsAuthorityCurrent(charter, succession, abdication, office, { ...c, cityId: b.source.cityId })) return null;
    const reviewed = charter.reconsideration || charter.review;
    return { origin: 'coerced', receiptId: charter.reconsideration ? charter.reaffirmation.receipt.id : charter.recognition.id,
      reviewId: reviewed.id, claimId: charter.claim.id, evidence: copy(reviewed.evidence),
      charterId: b.source.charterId, bodyEpoch: c.bodyEpoch };
  }
  function create(charter, succession, b, office, theme = 'madcap') {
    if (!b?.defender?.actorKind || !office?.clerk?.id || succession?.officeId !== office.id
      || (!charter?.recognition && !succession.handover)) return null;
    const selected = Theme.selectContent(registry, { kind: 'defenseRecognition', worldTheme: theme, seed: b.source.cityId, required: true });
    if (!selected.ok) return null;
    const a = b.defender;
    if (!a.defensePolicy) {
      const n = [...a.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
      a.defensePolicy = n % 5 === 0 ? 'declineCoercedContinuation' : 'considerLimitedCover';
    }
    return { id: `${a.id}:defense-recognition`, definitionId: selected.definitionId, sourceTheme: selected.sourceTheme, cityId: b.source.cityId,
      charterId: b.source.charterId, officeId: office.id, clerkId: office.clerk.id, personId: a.id,
      institutionId: b.source.defenseId, phase: 'unheard', response: null, priorResponses: [], terms: null,
      receipt: null, job: null, duty: null, completions: [], history: [], nextNumber: 1, message: '' };
  }
  const normalize = s => s?.personId && Array.isArray(s.priorResponses) && Array.isArray(s.completions) && Array.isArray(s.history) ? copy(s) : null;
  function note(s, at, kind, text) { s.message = text; s.history.push({ at, kind, text }); s.history = s.history.slice(-40); }
  function identities(s, b, office, c) {
    const a = actor(s, b);
    return Boolean(s && a && a.institutionId === s.institutionId && b.source.defenseId === s.institutionId
      && b.source.cityId === s.cityId && b.source.charterId === s.charterId && a.locationId === s.officeId
      && office?.id === s.officeId && office.cityId === s.cityId && office.clerk.id === s.clerkId
      && c.defenseInstitutionId === s.institutionId && c.defenseAvailable && c.alive);
  }
  function facts(s, charter, succession, abdication, b, office, c) {
    return { basis: basis(charter, succession, abdication, b, office, c), conduct: copy(c.conduct || []),
      conditions: copy(c.defenseConditions || []) };
  }
  function local(s, charter, succession, abdication, b, office, c, own = false) {
    const a = actor(s, b), id = own ? s.job?.id : null;
    return identities(s, b, office, c) && basis(charter, succession, abdication, b, office, c)
      && c.local && c.cityId === s.cityId && c.atCounter && c.visitPermission && c.capable && c.clerkPresent
      && c.lineOfSight && !c.busy && !c.activeViolence && c.administrationAvailable && able(a) && able(office.clerk)
      && c.presentIds?.includes(a.id) && office.channelPowered && office.maintenanceReady !== false && !s.duty
      && (!a.assignment || a.assignment === id) && (!office.assignment || office.assignment === id)
      && (!office.clerk.assignment || office.clerk.assignment === id);
  }
  function begin(s, charter, succession, abdication, b, office, c, at, kind, seconds, terms = null) {
    const a = actor(s, b);
    if (!s || s.job || !local(s, charter, succession, abdication, b, office, c) || office.power < 1
      || office.workSeconds < seconds || a.workSeconds < seconds || at < (office.availableAt || 0)) return false;
    const id = `${s.id}:meeting:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch,
      facts: facts(s, charter, succession, abdication, b, office, c), terms: copy(terms) };
    office.power--; a.assignment = office.assignment = office.clerk.assignment = id;
    note(s, at, kind, 'Attend the original defender and shared clerk; spent duty and power are not refunded.'); return true;
  }
  function meet(s, charter, succession, abdication, b, office, c, at) {
    if (!s || s.receipt) return false;
    const f = facts(s, charter, succession, abdication, b, office, c);
    if ([s.response, ...s.priorResponses].some(r => r && same(r.facts, f))) return false;
    return begin(s, charter, succession, abdication, b, office, c, at, 'discussion', 60);
  }
  function sign(s, charter, succession, abdication, b, office, terms, c, at) {
    return Boolean(s?.terms && !s.receipt && same(terms, s.terms) && at < s.terms.expiresAt
      && same(s.response.facts, facts(s, charter, succession, abdication, b, office, c))
      && begin(s, charter, succession, abdication, b, office, c, at, 'signing', 60, terms));
  }
  function authorization(s, charter, succession, abdication, b, office, c) {
    const r = s?.receipt;
    return r && identities(s, b, office, c) && same(r.basis, basis(charter, succession, abdication, b, office, c))
      && same(s.response.facts, facts(s, charter, succession, abdication, b, office, c))
      && r.id === `${s.id}:recognition` && r.role === ROLE && r.personId === s.personId && r.institutionId === s.institutionId
      && r.cityId === s.cityId && r.officeId === s.officeId && r.charterId === s.charterId && r.recorderId === s.clerkId
      && r.bodyEpoch === c.bodyEpoch && same(r.terms, s.terms) && r.origin === r.basis.origin
      && r.terms.role === ROLE && r.terms.personId === s.personId && r.terms.institutionId === s.institutionId
      && r.commandRelationship?.personId === s.personId && r.commandRelationship.role === ROLE
      && r.commandRelationship.scope === 'One two-minute local protective ward; no offensive command' ? r : null;
  }
  function instructionTerms(s) {
    return s?.receipt ? { recognitionId: s.receipt.id, role: ROLE, personId: s.personId, officeId: s.officeId,
      post: copy(POST), seconds: SECONDS, radiusM: 2, absorbedPerHit: 12, manaPerPoint: 2,
      duty: 'One two-minute physical protective ward for the scientist, then return. Physical and force damage only; no retaliation or immunity.' } : null;
  }
  function order(s, charter, succession, abdication, b, office, terms, c, at) {
    const a = actor(s, b);
    if (!authorization(s, charter, succession, abdication, b, office, c) || s.completions.length || !same(terms, instructionTerms(s))) return false;
    if (!c.geometryAvailable || !c.postReachable || c.defenderSuppressed || a.wardMana < 24
      || a.stamina < 12 || a.workSeconds < SECONDS + 90) return false;
    return begin(s, charter, succession, abdication, b, office, c, at, 'instruction', 30, terms);
  }
  function release(s, b, office) {
    if (!s.job) return;
    for (const a of [actor(s, b), office, office?.clerk]) if (a?.assignment === s.job.id) a.assignment = null;
    s.job = null;
  }
  function cancel(s, b, office, at) {
    if (!s?.job) return false;
    release(s, b, office); note(s, at, 'interrupted', 'Unfinished attendance cancelled; historical signatures and spent resources remain.'); return true;
  }
  function endCover(s, at, reason) {
    if (!s?.duty || s.duty.status === 'returning') return false;
    s.duty.status = 'returning'; s.duty.interrupted = reason || null; s.duty.travelCredit = 0;
    note(s, at, 'returning', reason || 'Two-minute cover finished; the original defender must physically return.'); return true;
  }
  function advance(s, charter, succession, abdication, b, office, c, at, effects = {}) {
    if (!s || !c.alive) return false;
    const a = actor(s, b);
    if (s.duty) {
      const d = s.duty, delta = Math.max(0, at - d.lastAt); d.lastAt = at;
      if (!able(a) || a.assignment !== d.id) {
        endCover(s, at, 'Original defender or supported institution unavailable.'); d.wasReady = false; return false;
      }
      if (d.status !== 'returning' && (d.bodyEpoch !== c.bodyEpoch || c.defenderSuppressed || a.wardMana < 2 || a.workSeconds < 1
        || !authorization(s, charter, succession, abdication, b, office, c))) endCover(s, at, 'Protection interrupted; no new authority or personal reserves were supplied.');
      if (d.status === 'covering' && at >= d.startedAt + SECONDS) {
        const work = d.wasReady && c.geometryAvailable && cellSame(a.mapCell, POST)
          ? Math.min(delta, SECONDS - d.progress, a.workSeconds) : 0;
        a.workSeconds -= work; d.progress += work;
        endCover(s, at, d.progress < SECONDS ? 'Two-minute attendance window ended after an interruption.' : null);
        return true;
      }
      // Safe return does not require renewed political permission or a powered counter.
      const ready = c.geometryAvailable && a.workSeconds >= 1 && (d.status === 'covering' || a.stamina >= 1);
      if (!ready) { d.wasReady = false; d.travelCredit = 0; return false; }
      if (!d.wasReady) { d.wasReady = true; return false; }
      if (!delta) return false;
      if (d.status !== 'covering') {
        const target = d.status === 'walking' ? POST : d.homeCell;
        d.travelCredit = Math.min(1, (d.travelCredit || 0) + delta);
        if (!cellSame(a.mapCell, target)) {
          if (d.travelCredit < 1 || !effects.move?.(a, target)) { d.blocked = true; return false; }
          a.workSeconds--; a.stamina--; d.travelSeconds++; d.travelCredit = 0; d.blocked = false; return true;
        }
        if (d.status === 'walking') { d.status = 'covering'; d.startedAt = at; return true; }
        s.completions.push({ id: `${d.id}:completion`, at, personId: a.id, seconds: d.progress,
          travelSeconds: d.travelSeconds, absorbed: d.absorbed, status: d.interrupted ? 'interruptedReturn' : 'completed', reason: d.interrupted });
        a.assignment = null; s.duty = null; s.phase = 'returned'; note(s, at, 'returned', 'Original defender returned; wounds and spent personal energy remain.'); return true;
      }
      if (!cellSame(a.mapCell, POST)) { endCover(s, at, 'Defender displaced from the agreed post.'); return true; }
      const work = Math.min(delta, SECONDS - d.progress, a.workSeconds);
      a.workSeconds -= work; d.progress += work;
      if (d.progress >= SECONDS || a.workSeconds < 1) endCover(s, at, d.progress < SECONDS ? 'Finite duty exhausted.' : null);
      return work > 0;
    }
    if (!s.job) return false;
    const j = s.job;
    if (!identities(s, b, office, c) || j.bodyEpoch !== c.bodyEpoch
      || !same(j.facts, facts(s, charter, succession, abdication, b, office, c))
      || j.kind === 'signing' && (at >= s.terms.expiresAt || !same(j.terms, s.terms))) return cancel(s, b, office, at);
    if (!local(s, charter, succession, abdication, b, office, c, true)) { j.lastAt = at; j.wasReady = false; return false; }
    const work = j.wasReady ? Math.max(0, Math.min(at - j.lastAt, j.seconds - j.progress, office.workSeconds, a.workSeconds)) : 0;
    j.lastAt = at; j.wasReady = true; j.progress += work; office.workSeconds -= work; a.workSeconds -= work;
    if (j.progress < j.seconds) return work > 0;
    if (j.kind === 'discussion') {
      const claimAt = charter?.claim.at ?? -Infinity;
      const refuses = j.facts.conditions.length > 0 || j.facts.basis.origin === 'coerced' && a.defensePolicy === 'declineCoercedContinuation'
        || j.facts.conduct.some(r => /attack/i.test(r.kind) && (r.targetId === a.id || r.at > claimAt));
      if (s.response) s.priorResponses.push(copy(s.response));
      s.response = { at, facts: copy(j.facts), decision: refuses ? 'refused' : 'offered', reason: refuses
        ? 'The original defender refuses on personal independence, received violence or incompatible obligations. This is not criminal guilt.'
        : 'The original defender offers one limited defensive cover duty; no offensive command or other institution has agreed.' };
      s.terms = refuses ? null : { id: `${s.id}:terms:${s.nextNumber++}`, offeredAt: at, expiresAt: at + 3600,
        origin: j.facts.basis.origin, role: ROLE, personId: s.personId, institutionId: s.institutionId,
        cityId: s.cityId, charterId: s.charterId, officeId: s.officeId, bodyEpoch: c.bodyEpoch, basis: basisReference(j.facts.basis),
        duties: 'One two-minute ward-cover instruction using the original person’s finite work, stamina and personal mana. Witnessed scientist aggression ends cover; existing civic, religious and judicial obligations remain.', limitations: LIMITS };
      release(s, b, office); s.phase = refuses ? 'refused' : 'offered'; note(s, at, 'response', s.response.reason);
    } else if (j.kind === 'signing') {
      s.receipt = { id: `${s.id}:recognition`, at, origin: j.facts.basis.origin, role: ROLE, personId: s.personId,
        institutionId: s.institutionId, cityId: s.cityId, charterId: s.charterId, officeId: s.officeId,
        recorderId: s.clerkId, bodyEpoch: c.bodyEpoch, basis: copy(j.facts.basis), terms: copy(j.terms),
        commandRelationship: { personId: s.personId, role: ROLE, scope: 'One two-minute local protective ward; no offensive command' }, limitations: LIMITS };
      release(s, b, office); s.phase = 'recognized'; note(s, at, 'recognized', 'Original defender separately signed the exact limited permission.');
    } else {
      if (!c.geometryAvailable || !c.postReachable || c.defenderSuppressed || a.wardMana < 24 || a.stamina < 12
        || !same(j.terms, instructionTerms(s))) return cancel(s, b, office, at);
      const id = `${s.id}:duty:${s.nextNumber++}`;
      s.duty = { id, bodyEpoch: c.bodyEpoch, homeCell: copy(a.mapCell), status: 'walking', progress: 0,
        travelSeconds: 0, absorbed: 0, lastAt: at, wasReady: true, terms: copy(j.terms) };
      release(s, b, office); a.assignment = id; note(s, at, 'ordered', 'Original defender walks to the agreed post before cover starts.');
    }
    return true;
  }
  function absorb(s, b, amount, damageTypes, c, at) {
    const a = actor(s, b), d = s?.duty;
    // This is immediate physical combat cover, not healing, a soul shield, or retroactive injury absorption.
    if (!d || d.status !== 'covering' || d.progress >= SECONDS || at >= d.startedAt + SECONDS || !able(a)
      || a.assignment !== d.id || a.workSeconds < 1 || !d.wasReady || !cellSame(a.mapCell, POST) || !c.alive || !c.local || c.cityId !== s.cityId
      || c.bodyEpoch !== d.bodyEpoch || c.defenderSuppressed || !c.coverVisible || c.coverDistanceM > 2
      || !damageTypes?.length || damageTypes.some(t => !['physical', 'force'].includes(t))) return { damage: amount, absorbed: 0 };
    const absorbed = Math.max(0, Math.min(amount, 12, Math.floor(a.wardMana / 2)));
    a.wardMana -= absorbed * 2; d.absorbed += absorbed;
    if (a.wardMana < 2) endCover(s, at, 'Personal projection energy exhausted.');
    return { damage: amount - absorbed, absorbed };
  }
  function aggression(s, observed, identified, at) {
    return observed && identified ? endCover(s, at, 'The defender personally witnessed scientist aggression; agreed cover ended, not a criminal verdict.') : false;
  }
  function publicView(s) {
    return s ? copy({ phase: s.phase, personId: s.personId, terms: s.terms,
      receipt: s.receipt && { ...s.receipt, basis: basisReference(s.receipt.basis) },
      response: s.response && { at: s.response.at, decision: s.response.decision, reason: s.response.reason },
      working: s.job && { kind: s.job.kind, seconds: s.job.seconds, progress: s.job.progress }, instructionTerms: instructionTerms(s),
      duty: s.duty && { status: s.duty.status, progress: s.duty.progress, seconds: SECONDS, absorbed: s.duty.absorbed },
      completions: s.completions, message: s.message, limitations: LIMITS }) : null;
  }
  return { ROLE, POST, SECONDS, LIMITS, actor, basis, create, normalize, meet, sign, authorization, instructionTerms,
    order, cancel, advance, absorb, aggression, publicView };
});
