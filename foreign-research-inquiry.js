(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixForeignResearchInquiry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SECONDS = 180;
  const TOPICS = Object.freeze({ geneticEngineering: 'Genetic engineering', artificialCreatureCreation: 'Artificial creature creation', animancy: 'Animancy and soul interference' });
  const LIMITS = 'Public research law only. This inquiry discloses the chosen research interest, not experiments or a laboratory. It is not proof of an offense, a license, residence, a map, divine approval or political recognition.';
  const APPLICATION = 'Authorization cannot presently be established: this public record does not establish an application procedure or an authorized licensing issuer. Responsible enforcement institutions are not licensing issuers. Published exceptions are not individual approval.';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = a => a?.status === 'alive' && Number.isFinite(a.health) && a.health >= 50 && Number.isFinite(a.fatigue ?? 0) && (a.fatigue || 0) < 80;
  const strings = values => Array.isArray(values) ? values.filter(v => typeof v === 'string') : [];
  // Deliberately select public fields, including within sentencing. Never serialize a whole source code or directive.
  function publicRule(rule) {
    if (typeof rule?.id !== 'string' || !rule.id || !Object.hasOwn(TOPICS, rule.offenseId) || !['prohibited', 'restricted', 'licensed', 'tolerated', 'unregulated'].includes(rule.legalStatus)) return null;
    const s = rule.sentencing || {}, range = r => r && Number.isFinite(r.minimum) && Number.isFinite(r.maximum)
      ? { minimum: r.minimum, maximum: r.maximum } : null;
    return { id: rule.id, offenseId: rule.offenseId, label: TOPICS[rule.offenseId], legalStatus: rule.legalStatus,
      authorizationExceptions: strings(rule.authorizationExceptions), defenses: strings(rule.defenses),
      elements: (Array.isArray(rule.elements) ? rule.elements : []).filter(e => typeof e?.id === 'string' && typeof e.label === 'string')
        .map(e => ({ id: e.id, kind: typeof e.kind === 'string' ? e.kind : null, label: e.label })),
      culpability: typeof rule.culpability === 'string' ? rule.culpability : null,
      aggravatingFactors: strings(rule.aggravatingFactors), responsibleInstitutionIds: strings(rule.responsibleInstitutionIds),
      sentencing: { ordinarySanctions: strings(s.ordinarySanctions), fineRangeCredits: range(s.fineRangeCredits),
        finitePrisonRangeMonths: range(s.finitePrisonRangeMonths), penalLegionEligible: s.penalLegionEligible === true,
        capitalEligibility: s.capitalEligibility ? { requiresProvenTrigger: s.capitalEligibility.requiresProvenTrigger === true,
          triggers: strings(s.capitalEligibility.triggers), withoutPublicEnemy: typeof s.capitalEligibility.withoutPublicEnemy === 'string' ? s.capitalEligibility.withoutPublicEnemy : null,
          withPublicEnemy: typeof s.capitalEligibility.withPublicEnemy === 'string' ? s.capitalEligibility.withPublicEnemy : null } : null } };
  }
  function publish(g, at) {
    if (!g?.materialized || !g.visitorAdmission) return null;
    return g.researchInquiry ||= { serial: 0, publishedAt: at, originalClerkId: g.clerk.id, job: null, extracts: [], history: [], knowledge: null, message: '' };
  }
  function recordsFrom(administration, law, institutionId = administration?.id) {
    const branch = administration?.branches?.find(b => b.role === 'centralAdministration' && typeof b.id === 'string' && b.id.endsWith(':public-records'));
    if (!branch || !institutionId || !law?.id || !Array.isArray(law.offenseRules)) return null;
    return { mandate: 'public-records', institutionId, branchId: branch.id, lawId: law.id,
      rules: law.offenseRules.map(publicRule).filter(Boolean) };
  }
  function facts(g, c, topic) {
    const source = c.source, records = source?.researchRecords;
    if (!g?.materialized || !g.visitorAdmission || !Object.hasOwn(TOPICS, topic) || !source || source.cityId !== g.cityId
      || !Number.isFinite(source.currentPopulation) || source.currentPopulation < 2 || source.physicalCondition === 'ruined'
      || !source.currentAuthority || source.administrationId !== g.institutionId || source.lawId !== g.visitorAdmission.rule.lawId
      || !records || !records.branchId || records.mandate !== 'public-records' || records.institutionId !== g.institutionId || records.lawId !== source.lawId) return null;
    const rules = Array.isArray(records.rules) ? records.rules.filter(r => r?.offenseId === topic) : [];
    const rule = rules.length === 1 && publicRule(rules[0]);
    return rule ? { cityId: g.cityId, administrationId: g.institutionId, branchId: records.branchId, lawId: source.lawId, rule } : null;
  }
  function permitValid(g, c, at) {
    const p = c.visitorPermit;
    return p && p.cityId === g.cityId && p.bodyEpoch === c.bodyEpoch && p.visitId === c.visitId
      && p.scope === 'visitorHallOnly' && Number.isFinite(p.issuedAt) && Number.isFinite(p.expiresAt) && p.issuedAt <= at && at < p.expiresAt;
  }
  function reason(g, c, topic, at, job = null) {
    if (!c.alive || !c.capable || c.originalBody === false || c.custodyActive) return 'A living, capable, free original visiting body is required.';
    if (!c.local || !c.atDesk || !c.clerkPresent || !c.lineOfSight || c.cityId !== g?.cityId) return 'Attend the original reception desk in person.';
    if ((c.bans || []).some(b => b.status === 'active' && (b.cityId === g.cityId
      || b.recognizedBy?.some(r => r.cityId === g.cityId && r.localOrderId && r.institutionId && r.status === 'active')))) return 'An applicable local exclusion prevents this inquiry; an old visitor permit cannot override it.';
    if (!c.authorityCurrent || !facts(g, c, topic)) return 'No supported current public-records mandate and research rule is available.';
    if (!permitValid(g, c, at)) return 'Current visitor permission is required; lodging alone does not authorize this inquiry.';
    if (!able(g.clerk) || g.researchInquiry?.originalClerkId !== g.clerk.id || c.otherBusy || g.visitorAdmission.job || g.visitorLodging?.job
      || g.receptionAssignment && g.receptionAssignment !== job?.id) return 'The original clerk or shared queue is unavailable.';
    if (![g.powerSeconds, g.receptionWorkSeconds].every(n => Number.isFinite(n) && n > 0)) return 'Original reception power or clerk duty is exhausted.';
    if (!job && (Math.min(g.powerSeconds, g.receptionWorkSeconds) < SECONDS || at + SECONDS >= c.visitorPermit.expiresAt)) return 'Three attended minutes must fit the remaining original duty, power and visitor permission.';
    return '';
  }
  // Bind the exact public source without revealing its content in a pre-attendance preview.
  function revision(f) {
    let hash = 2166136261;
    for (const char of JSON.stringify(f)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16);
  }
  function quote(g, c, topic, at) {
    const s = g?.researchInquiry;
    if (!s || s.job || reason(g, c, topic, at)) return null;
    const f = facts(g, c, topic);
    if (s.extracts.some(e => e.bodyEpoch === c.bodyEpoch && same(e.source, f))) return null;
    return { cityId: g.cityId, lawId: f.lawId, topic, clerkId: g.clerk.id, bodyEpoch: c.bodyEpoch,
      visitId: c.visitId, visitorPermitId: c.visitorPermit.id, revision: revision(f), seconds: SECONDS, fee: 0, scope: LIMITS };
  }
  function begin(g, c, expected, at) {
    const q = quote(g, c, expected?.topic, at);
    if (!q || !same(q, expected)) return false;
    const s = g.researchInquiry, id = `${g.id}:research-inquiry:${++s.serial}`;
    s.job = { id, quote: copy(q), source: facts(g, c, q.topic), clerkId: q.clerkId, bodyEpoch: q.bodyEpoch, visitId: q.visitId,
      progress: 0, lastAt: at, wasReady: true };
    g.receptionAssignment = id;
    s.message = `Disclosed research interest: ${TOPICS[q.topic]}. Three attended minutes; no filing fee or authorization granted.`;
    s.history.push({ id, at, topic: q.topic, status: 'begun', disclosedInterest: TOPICS[q.topic] });
    return true;
  }
  function stop(g, at, status, message) {
    const s = g.researchInquiry, j = s.job;
    if (g.receptionAssignment === j.id) g.receptionAssignment = null;
    s.history.push({ id: j.id, at, topic: j.quote.topic, status, progress: j.progress });
    s.job = null; s.message = message;
  }
  function cancel(g, c, at) {
    const j = g?.researchInquiry?.job;
    if (!j || !c.alive || !c.local || j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId) return false;
    stop(g, at, 'cancelled', 'Inquiry cancelled. Disclosed interest and spent original clerk duty/power remain; no extract or license was issued.');
    return true;
  }
  function advance(g, c, at) {
    const s = g?.researchInquiry, j = s?.job;
    if (!j || !c.alive || !Number.isFinite(at) || at < j.lastAt) return false;
    const previousAt = j.lastAt, elapsed = at - previousAt; j.lastAt = at;
    if (j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || c.originalBody === false || j.clerkId !== g.clerk?.id
      || !same(j.source, facts(g, c, j.quote.topic)) || c.visitorPermit?.id !== j.quote.visitorPermitId) {
      stop(g, at, 'interrupted', 'Original body, visit, clerk, law or permission changed. Spent work and disclosure remain; no extract was fabricated.'); return true;
    }
    // A coarse tick may finish before expiry, but can never count attendance beyond it.
    const eligibleAt = Math.min(at, c.visitorPermit.expiresAt - 1e-6);
    const blocked = reason(g, c, j.quote.topic, eligibleAt, j);
    if (blocked) { j.wasReady = false; s.message = `Inquiry paused: ${blocked} Partial work is retained without backfill.`;
      if (at >= c.visitorPermit.expiresAt) stop(g, at, 'expired', 'Visitor permission expired before completion; spent work remains, with no extract.');
      return true; }
    if (!j.wasReady) { j.wasReady = true;
      if (at >= c.visitorPermit.expiresAt) stop(g, at, 'expired', 'Visitor permission expired while interrupted; no retroactive extract.');
      return true; }
    const work = Math.min(elapsed, Math.max(0, c.visitorPermit.expiresAt - previousAt), SECONDS - j.progress, g.powerSeconds, g.receptionWorkSeconds);
    j.progress += work; g.powerSeconds -= work; g.receptionWorkSeconds -= work;
    const completedAt = previousAt + work;
    if (j.progress + 1e-8 >= SECONDS && completedAt < c.visitorPermit.expiresAt) {
      s.extracts.push({ id: `${j.id}:extract`, at: completedAt, source: copy(j.source), topic: j.quote.topic,
        clerkId: j.clerkId, clerkName: g.clerk.name, bodyEpoch: j.bodyEpoch, visitId: j.visitId,
        disclosedInterest: TOPICS[j.quote.topic], application: APPLICATION, scope: LIMITS,
        safeguard: 'Generally applicable safety and harm laws still apply. A potential sanction requires a separate lawful case and proven elements; asking is not an offense finding.' });
      stop(g, completedAt, 'completed', 'Dated public-law extract received. No licensing issuer or application procedure is established by this record; no individual authorization granted.');
    } else if (at >= c.visitorPermit.expiresAt) stop(g, at, 'expired', 'Visitor permission expired before completion; spent work remains, with no extract.');
    return true;
  }
  function observe(g, c, at) {
    const s = g?.researchInquiry;
    if (!s || !c.alive || !c.capable || c.originalBody === false || c.custodyActive || !c.local || !c.atDesk || !c.clerkPresent || !c.lineOfSight || !able(g.clerk)) return s?.knowledge || null;
    s.knowledge = { at, cityId: g.cityId, clerkName: g.clerk.name, message: s.message,
      working: s.job ? { topic: s.job.quote.topic, progress: s.job.progress, seconds: SECONDS } : null };
    return s.knowledge;
  }
  return { SECONDS, TOPICS, LIMITS, APPLICATION, publicRule, recordsFrom, publish, facts, reason, quote, begin, cancel, advance, observe };
});
