(function attachHelixTrialSentencing(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixTrialSentencing = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixTrialSentencing() {
  "use strict";

  const VERSION = 2;
  const HOUR = 3600;
  const CASE_STATUSES = Object.freeze(["scheduled", "inTrial", "awaitingSentencing", "sentencing", "completed", "missed"]);
  const PHASES = Object.freeze([
    { id: "prosecution", label: "Prosecution Case", durationMinutes: 60 },
    { id: "defense", label: "Defense Case", durationMinutes: 60 },
    { id: "deliberation", label: "Findings and Judgment", durationMinutes: 30 },
    { id: "sentencing", label: "Sentencing Hearing", durationMinutes: 45 }
  ]);
  const DEFENSE_THEORIES = Object.freeze([
    { id: "factualDenial", label: "Factual Denial", elementKinds: ["conduct", "identity"], requiresExculpatory: false },
    { id: "innocentExplanation", label: "Lawful Innocent Explanation", elementKinds: ["circumstance", "intent"], requiresExculpatory: true },
    { id: "mistakenAttribution", label: "Mistaken Identity or Attribution", elementKinds: ["identity", "intent"], requiresExculpatory: false },
    { id: "necessity", label: "Necessity or Emergency", elementKinds: ["unlawfulness", "intent"], requiresExculpatory: true },
    { id: "unlawfulInvestigation", label: "Unlawful Investigation", elementKinds: ["conduct", "circumstance"], requiresExculpatory: false },
    { id: "contestIntent", label: "Contest Knowledge or Intent", elementKinds: ["intent"], requiresExculpatory: false }
  ]);
  const CLOSING_PRIORITIES = Object.freeze([
    { id: "completeAcquittal", label: "Seek Complete Acquittal" },
    { id: "defeatSeriousCharges", label: "Defeat the Most Serious Charges" },
    { id: "preserveAppeal", label: "Preserve Appeal Issues" },
    { id: "mitigatePunishment", label: "Mitigate Punishment" }
  ]);
  const SENTENCING_SUBMISSIONS = Object.freeze([
    { id: "individualizedMercy", label: "Request Individualized Mercy", mitigation: 4 },
    { id: "restitutionAndCompliance", label: "Offer Restitution and Supervision", mitigation: 3 },
    { id: "penalService", label: "Request Penal-Legion Service", mitigation: 1 },
    { id: "contestAggravation", label: "Contest Aggravating Findings", mitigation: 2 }
  ]);
  const CHARGE_ELEMENTS = Object.freeze({
    prohibitedResearch: [
      { id: "researchConduct", label: "The scientist conducted or controlled the research", kind: "conduct", patterns: ["research", "experiment", "laboratory", "sample", "specimen", "mutation", "genetic"] },
      { id: "prohibitedSubject", label: "The work concerned a legally prohibited subject", kind: "circumstance", patterns: ["prohibited", "illegal", "mutation", "animancy", "contraband", "unlicensed"] },
      { id: "knowingLackOfLicense", label: "The scientist knowingly acted without lawful authorization", kind: "intent", patterns: ["knowing", "deliberate", "conceal", "unlicensed", "off-books", "black market"] }
    ],
    prohibitedAnimancy: [
      { id: "animanticPractice", label: "The scientist performed or controlled animantic practice", kind: "conduct", patterns: ["animancy", "animantic", "soul", "spirit", "resurrection"] },
      { id: "prohibitedSoulInterference", label: "The practice unlawfully interfered with a soul", kind: "circumstance", patterns: ["prohibited", "soul", "spirit", "phylactery", "soul transfer"] },
      { id: "knowingAnimancy", label: "The scientist knowingly engaged in the prohibited practice", kind: "intent", patterns: ["knowing", "deliberate", "conceal", "animancy", "soul"] }
    ],
    contrabandCommerce: [
      { id: "commerce", label: "A transfer, sale, or purchase occurred", kind: "conduct", patterns: ["sale", "purchase", "transaction", "commerce", "delivery", "market"] },
      { id: "contraband", label: "The transaction concerned contraband", kind: "circumstance", patterns: ["contraband", "illegal", "prohibited", "black market", "off-books"] },
      { id: "knowingCommerce", label: "The scientist knowingly participated", kind: "intent", patterns: ["knowing", "accepted", "contract", "ledger", "conceal", "black market"] }
    ],
    hazardousBiologicalConduct: [
      { id: "biologicalConduct", label: "The scientist handled or released biological material", kind: "conduct", patterns: ["biological", "creature", "specimen", "slime", "discharge", "contamination"] },
      { id: "substantialHazard", label: "The conduct created a substantial unlawful hazard", kind: "circumstance", patterns: ["hazard", "contamination", "injury", "release", "critical", "unsafe"] },
      { id: "recklessKnowledge", label: "The scientist knew of or recklessly disregarded the hazard", kind: "intent", patterns: ["warning", "known", "reckless", "ignored", "repeat", "deliberate"] }
    ],
    warrantObstruction: [
      { id: "obstructiveAct", label: "The scientist impeded warrant execution", kind: "conduct", patterns: ["obstruction", "forced entry", "denied access", "barrier", "resist"] },
      { id: "lawfulWarrant", label: "Officers were executing a lawful warrant within scope", kind: "circumstance", patterns: ["warrant", "authorized", "scope", "court order"] },
      { id: "knowingObstruction", label: "The scientist knowingly obstructed the officers", kind: "intent", patterns: ["knowing", "warning", "refused", "denied", "deliberate"] }
    ],
    violentResistance: [
      { id: "violentAct", label: "The scientist used or threatened physical violence", kind: "conduct", patterns: ["attack", "violent", "weapon", "injury", "lethal", "force"] },
      { id: "officerDuty", label: "The target was an officer performing lawful duty", kind: "identity", patterns: ["officer", "raid", "arrest", "warrant", "enforcement"] },
      { id: "intentionalResistance", label: "The scientist intentionally resisted arrest", kind: "intent", patterns: ["resistance", "attack", "intentional", "deliberate", "surrender revoked"] }
    ],
    escapeCustody: [
      { id: "departure", label: "The scientist left physical custody", kind: "conduct", patterns: ["escape", "departed", "custody", "fugitive"] },
      { id: "lawfulCustody", label: "The custody was imposed under lawful process", kind: "circumstance", patterns: ["custody", "booking", "court", "warrant", "detention"] },
      { id: "intentionalEscape", label: "The departure was knowing and intentional", kind: "intent", patterns: ["escape plan", "disabled", "bypass", "extraction", "deliberate"] }
    ],
    attemptedEscape: [
      { id: "substantialStep", label: "The scientist took a substantial physical step toward escape", kind: "conduct", patterns: ["attempt", "escape", "bypass", "interrupted", "tool"] },
      { id: "lawfulCustody", label: "The scientist was held under lawful process", kind: "circumstance", patterns: ["custody", "booking", "court", "warrant", "detention"] },
      { id: "escapeIntent", label: "The step was taken with intent to escape", kind: "intent", patterns: ["escape", "plan", "bypass", "extraction", "deliberate"] }
    ],
    failureToAppear: [
      { id: "requiredAppearance", label: "A court appearance was lawfully required", kind: "circumstance", patterns: ["appearance", "court", "scheduled", "required"] },
      { id: "nonappearance", label: "The scientist did not appear", kind: "conduct", patterns: ["missed", "failure to appear", "absent", "nonappearance"] },
      { id: "notice", label: "The scientist had notice of the appearance", kind: "intent", patterns: ["notice", "served", "scheduled", "required"] }
    ],
    falseStatement: [
      { id: "statement", label: "The scientist made the charged statement", kind: "conduct", patterns: ["statement", "claim", "denial", "testimony"] },
      { id: "materialFalsity", label: "The statement was false and material", kind: "circumstance", patterns: ["false", "contradicted", "material", "inconsistent"] },
      { id: "knowingFalsity", label: "The scientist knew the statement was false", kind: "intent", patterns: ["knowing", "contradicted", "explicit denial", "record"] }
    ]
  });

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function unique(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).map((value) => value.trim()).filter(Boolean))]; }
  function textOf(entry) { return [entry?.label, ...(entry?.traits || [])].join(" ").toLowerCase(); }
  function includesPattern(entry, patterns) { const text = textOf(entry); return patterns.some((pattern) => text.includes(pattern)); }
  function round(value) { return Math.round(finite(value) * 100) / 100; }

  function normalizeSupport(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `trial-support-${index + 1}`, sourceId: cleanId(candidate?.sourceId), kind: cleanId(candidate?.kind) || "authorityEvidence",
      label: String(candidate?.label || "Admitted prosecution support").trim(), reliability: ["weak", "credible", "strong"].includes(candidate?.reliability) ? candidate.reliability : "credible",
      significanceRank: Math.max(0, Math.min(4, Math.floor(finite(candidate?.significanceRank, 1)))), integrity: Math.max(0, Math.min(100, finite(candidate?.integrity, 100))),
      scopeStatus: ["authorized", "expanded", "outside", "unknown"].includes(candidate?.scopeStatus) ? candidate.scopeStatus : "unknown",
      custodyIssues: unique(candidate?.custodyIssues), traits: unique(candidate?.traits), admissibility: candidate?.admissibility === "excluded" ? "excluded" : "admitted",
      exclusionReason: String(candidate?.exclusionReason || "").trim(), exculpatory: Boolean(candidate?.exculpatory)
    };
  }

  function normalizeElement(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `element-${index + 1}`, label: String(candidate?.label || "Required legal element").trim(), kind: cleanId(candidate?.kind) || "conduct",
      patterns: unique(candidate?.patterns), proven: candidate?.proven == null ? null : Boolean(candidate.proven), prosecutionScore: round(candidate?.prosecutionScore),
      defenseDoubt: round(candidate?.defenseDoubt), margin: round(candidate?.margin), threshold: round(candidate?.threshold || 4.5), supportIds: (candidate?.supportIds || []).map(cleanId).filter(Boolean),
      witnessIds: (candidate?.witnessIds || []).map(cleanId).filter(Boolean), reasons: unique(candidate?.reasons)
    };
  }

  function elementsForCharge(typeId) {
    return (CHARGE_ELEMENTS[typeId] || CHARGE_ELEMENTS.prohibitedResearch).map((entry, index) => normalizeElement(entry, index));
  }

  function normalizeCharge(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `trial-charge-${index + 1}`, typeId: cleanId(candidate?.typeId) || "prohibitedResearch", label: String(candidate?.label || "Criminal charge").trim(),
      severity: cleanId(candidate?.severity) || "serious", weight: Math.max(0, finite(candidate?.weight, 5)), pretrialStatus: cleanId(candidate?.pretrialStatus) || "filed",
      publicProbableCause: String(candidate?.publicProbableCause || "").trim(), support: (Array.isArray(candidate?.support) ? candidate.support : []).map(normalizeSupport),
      elements: (Array.isArray(candidate?.elements) && candidate.elements.length ? candidate.elements : elementsForCharge(candidate?.typeId)).map(normalizeElement),
      verdict: ["pending", "guilty", "notGuilty", "dismissed"].includes(candidate?.verdict) ? candidate.verdict : candidate?.pretrialStatus === "dismissed" ? "dismissed" : "pending",
      verdictReason: String(candidate?.verdictReason || "").trim()
    };
  }

  function normalizeWitness(candidate, index = 0) {
    return { id: cleanId(candidate?.id) || `trial-witness-${index + 1}`, label: String(candidate?.label || "Prosecution witness").trim(), sourceItemIds: (candidate?.sourceItemIds || []).map(cleanId).filter(Boolean), credibility: Math.max(0, Math.min(100, finite(candidate?.credibility, 65))) };
  }

  function normalizeStrategy(candidate, charges = []) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const theories = {};
    for (const charge of charges) theories[charge.id] = DEFENSE_THEORIES.some((entry) => entry.id === source.theories?.[charge.id]) ? source.theories[charge.id] : "contestIntent";
    return {
      configured: Boolean(source.configured), theories, challengeKind: ["support", "witness"].includes(source.challengeKind) ? source.challengeKind : "",
      challengeTargetId: cleanId(source.challengeTargetId), testify: Boolean(source.testify), closingPriorityId: CLOSING_PRIORITIES.some((entry) => entry.id === source.closingPriorityId) ? source.closingPriorityId : "completeAcquittal",
      sentencingSubmissionId: SENTENCING_SUBMISSIONS.some((entry) => entry.id === source.sentencingSubmissionId) ? source.sentencingSubmissionId : "individualizedMercy", savedAt: source.savedAt == null ? null : Math.max(0, finite(source.savedAt))
    };
  }

  function normalizeOrder(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const legacyLife = candidate.kind === "lifePrison" || candidate.life === true;
    const kind = legacyLife ? "finitePrison" : cleanId(candidate.kind);
    return {
      id: cleanId(candidate.id), kind, label: legacyLife ? "Maximum finite prison commitment" : String(candidate.label || "Sentencing order").trim(), custodial: Boolean(candidate.custodial), final: candidate.final !== false,
      issuedAt: Math.max(0, finite(candidate.issuedAt)), transferNotBefore: candidate.transferNotBefore == null ? null : Math.max(0, finite(candidate.transferNotBefore)), destinationId: cleanId(candidate.destinationId),
      incarcerationMonths: legacyLife ? 120 : Math.max(0, Math.min(120, Math.floor(finite(candidate.incarcerationMonths)))), deathSentence: Boolean(candidate.deathSentence), penalService: Boolean(candidate.penalService),
      fine: Math.max(0, Math.round(finite(candidate.fine))), forfeiture: Math.max(0, Math.round(finite(candidate.forfeiture))), paid: Math.max(0, Math.round(finite(candidate.paid))), outstanding: Math.max(0, Math.round(finite(candidate.outstanding))),
      probationMonths: Math.max(0, Math.floor(finite(candidate.probationMonths))), restrictions: unique(candidate.restrictions), commitmentId: cleanId(candidate.commitmentId), provisionalExecutionProcessId: cleanId(candidate.provisionalExecutionProcessId),
      reasons: unique([...(candidate.reasons || []), ...(legacyLife ? ["Legacy life-imprisonment data was normalized to the jurisdiction's ten-year maximum finite term."] : [])]), status: ["issued", "releasePending", "remandPending", "commitmentPending", "committed", "releaseDue", "completed"].includes(candidate.status) ? candidate.status : "issued"
    };
  }

  function normalizeCase(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const charges = (Array.isArray(source.charges) ? source.charges : []).map(normalizeCharge);
    return {
      id: cleanId(source.id) || `trial-case-${index + 1}`, proceedingId: cleanId(source.proceedingId), raidId: cleanId(source.raidId), stayId: cleanId(source.stayId), docket: String(source.docket || "CR-0000").trim(),
      predecessorCaseId: cleanId(source.predecessorCaseId), successorKind: cleanId(source.successorKind), appealRecordId: cleanId(source.appealRecordId), appellateMandate: source.appellateMandate && typeof source.appellateMandate === "object" ? JSON.parse(JSON.stringify(source.appellateMandate)) : null,
      mode: source.mode === "plea" ? "plea" : "trial", status: CASE_STATUSES.includes(source.status) ? source.status : "scheduled", openedAt: Math.max(0, finite(source.openedAt)), trialAt: Math.max(0, finite(source.trialAt)),
      sentencingAt: source.sentencingAt == null ? null : Math.max(0, finite(source.sentencingAt)), appearanceDeadline: Math.max(0, finite(source.appearanceDeadline, finite(source.trialAt) + 4 * HOUR)),
      court: source.court && typeof source.court === "object" ? JSON.parse(JSON.stringify(source.court)) : {}, counsel: source.counsel && typeof source.counsel === "object" ? JSON.parse(JSON.stringify(source.counsel)) : {},
      plea: source.plea && typeof source.plea === "object" ? JSON.parse(JSON.stringify(source.plea)) : null,
      custodyStatus: cleanId(source.custodyStatus) || "detained", releaseConditionIds: (source.releaseConditionIds || []).map(cleanId).filter(Boolean), pretrialHistory: Array.isArray(source.pretrialHistory) ? source.pretrialHistory.map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action), summary: String(entry?.summary || "").trim() })) : [],
      defenseClaims: (Array.isArray(source.defenseClaims) ? source.defenseClaims : []).map((entry) => ({ id: cleanId(entry?.id), typeId: cleanId(entry?.typeId), status: cleanId(entry?.status), credibilityDelta: finite(entry?.credibilityDelta), citedItemIds: (entry?.citedItemIds || []).map(cleanId).filter(Boolean) })),
      preparation: { progress: Math.max(0, Math.min(100, finite(source.preparation?.progress))), credibility: Math.max(0, Math.min(100, finite(source.preparation?.credibility, 70))), conferenceCount: Math.max(0, Math.floor(finite(source.preparation?.conferenceCount))) },
      discoveryPacketId: cleanId(source.discoveryPacketId), charges, witnesses: (Array.isArray(source.witnesses) ? source.witnesses : []).map(normalizeWitness), strategy: normalizeStrategy(source.strategy, charges),
      currentPhaseId: cleanId(source.currentPhaseId) || (source.mode === "plea" ? "sentencing" : "prosecution"), phaseStatus: ["pending", "inProgress"].includes(source.phaseStatus) ? source.phaseStatus : "pending",
      phases: (Array.isArray(source.phases) ? source.phases : []).map((entry) => ({ id: cleanId(entry?.id), startedAt: Math.max(0, finite(entry?.startedAt)), completedAt: entry?.completedAt == null ? null : Math.max(0, finite(entry.completedAt)), summary: String(entry?.summary || "").trim() })),
      verdictAt: source.verdictAt == null ? null : Math.max(0, finite(source.verdictAt)), judgmentReasons: unique(source.judgmentReasons), sentencing: { exposure: round(source.sentencing?.exposure), aggravation: round(source.sentencing?.aggravation), mitigation: round(source.sentencing?.mitigation), reasons: unique(source.sentencing?.reasons), order: normalizeOrder(source.sentencing?.order) },
      missedAt: source.missedAt == null ? null : Math.max(0, finite(source.missedAt)), history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Trial case updated.").trim() }))
    };
  }

  function defaultState() { return { version: VERSION, cases: [], nextCaseNumber: 1, nextOrderNumber: 1 }; }
  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {}; const cases = (Array.isArray(source.cases) ? source.cases : []).map(normalizeCase);
    return { version: VERSION, cases, nextCaseNumber: Math.max(1, Math.floor(finite(source.nextCaseNumber, cases.length + 1))), nextOrderNumber: Math.max(1, Math.floor(finite(source.nextOrderNumber, 1))) };
  }

  function open(candidate, proceeding, options = {}) {
    const state = normalizeState(candidate); const proceedingId = cleanId(proceeding?.id); const existing = state.cases.find((entry) => entry.proceedingId === proceedingId);
    if (existing) return { state, case: existing, created: false };
    const handoff = proceeding?.trial?.handoff; const plea = proceeding?.trial?.status === "pleaSentencing" || proceeding?.plea?.status === "accepted";
    if (!proceedingId || !handoff || (!plea && proceeding?.trial?.status !== "scheduled")) return { state, case: null, created: false, reason: "A frozen trial or plea-sentencing handoff is required." };
    const pleaOffer = proceeding.plea?.offer || null; const resolutionIds = new Set(pleaOffer?.resolutionChargeIds || []); const dismissedIds = new Set(pleaOffer?.dismissedChargeIds || []);
    const included = proceeding.charges.filter((charge) => charge.status === "filed" || charge.status === "dismissed" || resolutionIds.has(charge.id) || dismissedIds.has(charge.id));
    const charges = included.map((charge, index) => normalizeCharge({ ...charge, pretrialStatus: charge.status, verdict: dismissedIds.has(charge.id) || charge.status === "dismissed" ? "dismissed" : plea && resolutionIds.has(charge.id) ? "guilty" : "pending", elements: elementsForCharge(charge.typeId) }, index));
    const discoveryBySupport = new Map((proceeding.discovery?.items || []).map((item) => [item.supportId, item]));
    for (const charge of charges) charge.support = charge.support.map((support, index) => normalizeSupport({ ...support, ...(discoveryBySupport.get(support.id) || {}), id: support.id, sourceId: support.sourceId, kind: support.kind, label: support.label, traits: support.traits, admissibility: support.admissibility }, index));
    const at = Math.max(0, finite(options.clock, proceeding.trial?.scheduledAt || proceeding.openedAt)); const trialAt = plea ? at + 2 * HOUR : Math.max(at, finite(proceeding.trial?.trialAt));
    const caseRecord = normalizeCase({
      id: `trial-case-${state.nextCaseNumber++}`, proceedingId, raidId: proceeding.raidId, stayId: options.stayId, docket: proceeding.docket, mode: plea ? "plea" : "trial", status: plea ? "awaitingSentencing" : "scheduled", openedAt: at, trialAt,
      sentencingAt: plea ? trialAt : null, appearanceDeadline: trialAt + 4 * HOUR, court: proceeding.court, counsel: { ...proceeding.counsel, selected: proceeding.counsel?.options?.find((entry) => entry.id === proceeding.counsel.selectedOptionId) || null },
      custodyStatus: handoff.custodyStatus, releaseConditionIds: handoff.releaseConditionIds, pretrialHistory: proceeding.history, defenseClaims: proceeding.defenseClaims, preparation: { progress: handoff.preparation, credibility: handoff.credibility, conferenceCount: proceeding.counsel?.conferences?.length || 0 },
      discoveryPacketId: handoff.discoveryPacketId, plea: pleaOffer, charges, witnesses: (proceeding.discovery?.witnesses || []).map((witness) => ({ ...witness, credibility: 55 + Math.min(30, witness.sourceItemIds?.length * 5 || 0) })), currentPhaseId: plea ? "sentencing" : "prosecution",
      history: [{ at, action: plea ? "pleaSentencingOpened" : "trialOpened", summary: plea ? "The accepted plea and exact dismissed charges were frozen for a separate sentencing appearance." : `A bench trial was opened before ${proceeding.court?.judge?.name || "the assigned judge"} from the immutable pretrial handoff.` }]
    }, state.cases.length);
    state.cases.push(caseRecord); return { state, case: caseRecord, created: true };
  }

  function openSuccessor(candidate, predecessorCaseId, options = {}) {
    const state = normalizeState(candidate); const predecessor = state.cases.find((entry) => entry.id === cleanId(predecessorCaseId)); const kind = options.kind === "resentencing" ? "resentencing" : "retrial"; const appealRecordId = cleanId(options.appealRecordId); const existing = state.cases.find((entry) => entry.predecessorCaseId === predecessor?.id && entry.appealRecordId === appealRecordId && entry.successorKind === kind); if (existing) return { state, case: existing, created: false };
    if (!predecessor || predecessor.status !== "completed") return { state, case: null, created: false, reason: "A completed predecessor judgment is required." };
    const at = Math.max(0, finite(options.clock)); const excluded = new Set((options.excludedSupportIds || []).map(cleanId)); const charges = predecessor.charges.filter((charge) => charge.verdict === "guilty").map((charge, index) => normalizeCharge({ ...charge, support: charge.support.filter((support) => !excluded.has(support.id)), verdict: kind === "resentencing" ? "guilty" : "pending", elements: kind === "resentencing" ? charge.elements : elementsForCharge(charge.typeId) }, index));
    const caseRecord = normalizeCase({ id: `trial-case-${state.nextCaseNumber++}`, proceedingId: predecessor.proceedingId, raidId: predecessor.raidId, stayId: options.stayId || predecessor.stayId, docket: `${predecessor.docket}-${kind === "resentencing" ? "RS" : "RT"}${state.cases.filter((entry) => entry.predecessorCaseId === predecessor.id).length + 1}`, predecessorCaseId: predecessor.id, successorKind: kind, appealRecordId, appellateMandate: { capitalSentenceBarred: kind === "resentencing", excludedSupportIds: [...excluded], reasons: unique(options.reasons) }, mode: "trial", status: kind === "resentencing" ? "awaitingSentencing" : "scheduled", openedAt: at, trialAt: at + 2 * HOUR, sentencingAt: kind === "resentencing" ? at + 2 * HOUR : null, appearanceDeadline: at + 6 * HOUR, court: predecessor.court, counsel: predecessor.counsel, custodyStatus: "detained", pretrialHistory: predecessor.pretrialHistory, defenseClaims: predecessor.defenseClaims, preparation: predecessor.preparation, discoveryPacketId: predecessor.discoveryPacketId, charges, witnesses: predecessor.witnesses, strategy: predecessor.strategy, currentPhaseId: kind === "resentencing" ? "sentencing" : "prosecution", history: [{ at, action: "appellateSuccessorOpened", summary: `${kind === "resentencing" ? "Noncapital resentencing" : "Retrial"} opened as a linked successor to ${predecessor.id}; the original judgment remains immutable.` }] }, state.cases.length);
    state.cases.push(caseRecord); return { state, case: caseRecord, created: true };
  }

  function configure(candidate, caseId, options = {}, clock = 0) {
    const state = normalizeState(candidate); const caseRecord = state.cases.find((entry) => entry.id === cleanId(caseId));
    if (!caseRecord || caseRecord.phaseStatus === "inProgress" || !["scheduled", "awaitingSentencing"].includes(caseRecord.status)) return { state, case: caseRecord, changed: false, reason: "Strategy can only be saved before the next appearance begins." };
    const theories = {};
    for (const charge of caseRecord.charges.filter((entry) => entry.verdict === "pending")) theories[charge.id] = DEFENSE_THEORIES.some((entry) => entry.id === options.theories?.[charge.id]) ? options.theories[charge.id] : caseRecord.strategy.theories[charge.id];
    const challengeKind = ["support", "witness"].includes(options.challengeKind) ? options.challengeKind : ""; const challengeTargetId = cleanId(options.challengeTargetId);
    const challengeExists = !challengeTargetId || (challengeKind === "support" ? caseRecord.charges.some((charge) => charge.support.some((support) => support.id === challengeTargetId)) : caseRecord.witnesses.some((witness) => witness.id === challengeTargetId));
    if (!challengeExists) return { state, case: caseRecord, changed: false, reason: "The selected challenge target is not in the frozen trial packet." };
    caseRecord.strategy = normalizeStrategy({ configured: true, theories, challengeKind, challengeTargetId, testify: options.testify, closingPriorityId: options.closingPriorityId, sentencingSubmissionId: options.sentencingSubmissionId, savedAt: Math.max(caseRecord.openedAt, finite(clock)) }, caseRecord.charges);
    caseRecord.history.push({ at: caseRecord.strategy.savedAt, action: "strategySaved", summary: `${Object.keys(theories).length} charge-specific defense theory choice(s), ${challengeTargetId ? `one exact ${challengeKind} challenge` : "no targeted challenge"}, testimony ${caseRecord.strategy.testify ? "authorized" : "declined"}, and ${caseRecord.strategy.closingPriorityId} closing priority were saved.` });
    return { state, case: caseRecord, changed: true };
  }

  function phaseDef(id) { return PHASES.find((entry) => entry.id === id) || null; }
  function beginAppearance(candidate, caseId, clock = 0) {
    const state = normalizeState(candidate); const caseRecord = state.cases.find((entry) => entry.id === cleanId(caseId)); const at = Math.max(0, finite(clock));
    if (!caseRecord || caseRecord.phaseStatus !== "pending" || !["scheduled", "inTrial", "awaitingSentencing"].includes(caseRecord.status)) return { state, case: caseRecord, changed: false, reason: "No court phase is ready to begin." };
    const dueAt = caseRecord.currentPhaseId === "sentencing" ? caseRecord.sentencingAt : caseRecord.trialAt;
    if (at < dueAt) return { state, case: caseRecord, changed: false, reason: "The saved court appearance time has not arrived." };
    if (!caseRecord.strategy.configured) return { state, case: caseRecord, changed: false, reason: "Save the bounded trial and sentencing strategy before appearing." };
    caseRecord.phaseStatus = "inProgress"; caseRecord.status = caseRecord.currentPhaseId === "sentencing" ? "sentencing" : "inTrial";
    caseRecord.phases.push({ id: caseRecord.currentPhaseId, startedAt: at, completedAt: null, summary: `${phaseDef(caseRecord.currentPhaseId).label} began before the assigned bench-trial judge.` });
    caseRecord.history.push({ at, action: `${caseRecord.currentPhaseId}Began`, summary: caseRecord.phases.at(-1).summary });
    return { state, case: caseRecord, phase: phaseDef(caseRecord.currentPhaseId), changed: true };
  }

  function supportValue(support, element) {
    if (support.admissibility === "excluded") return 0;
    const reliability = { weak: 1, credible: 2, strong: 3 }[support.reliability] || 2; let value = reliability + support.significanceRank;
    value *= support.integrity / 100; if (support.scopeStatus === "outside") value *= 0.55; if (support.scopeStatus === "unknown") value *= 0.9; value *= Math.max(0.35, 1 - support.custodyIssues.length * 0.15);
    const relevant = includesPattern(support, element.patterns); const factor = relevant ? 1 : element.kind === "conduct" ? 0.7 : element.kind === "circumstance" || element.kind === "identity" ? 0.42 : 0.24;
    return value * factor;
  }

  function counselCapacity(caseRecord) {
    const selected = caseRecord.counsel?.selected || {}; return Math.max(0.5, Math.min(5, (finite(selected.proceduralSkill, 20) - finite(selected.workload, 100) * 0.35 + caseRecord.preparation.progress * 0.3 + caseRecord.preparation.conferenceCount * 4) / 24));
  }

  function resolveVerdicts(caseRecord, at) {
    const capacity = counselCapacity(caseRecord); const exculpatory = caseRecord.charges.flatMap((charge) => charge.support).some((support) => support.exculpatory);
    for (const charge of caseRecord.charges.filter((entry) => entry.verdict === "pending")) {
      const theory = DEFENSE_THEORIES.find((entry) => entry.id === caseRecord.strategy.theories[charge.id]) || DEFENSE_THEORIES.at(-1);
      const theoryClaimTypes = { factualDenial: ["explicitDenial"], innocentExplanation: ["licensedConduct", "lawfulExplanation"], mistakenAttribution: ["mistakenAttribution"], necessity: ["necessity"], unlawfulInvestigation: ["scopeViolation", "custodyUnreliable"], contestIntent: ["explicitDenial", "lawfulExplanation"] };
      const alignedClaim = caseRecord.defenseClaims.find((claim) => (theoryClaimTypes[theory.id] || []).includes(claim.typeId));
      for (const element of charge.elements) {
        const admitted = charge.support.filter((support) => support.admissibility !== "excluded"); const contributions = admitted.map((support) => ({ support, value: supportValue(support, element) })).filter((entry) => entry.value > 0);
        let prosecution = contributions.reduce((total, entry) => total + entry.value, 0); let doubt = 0; const reasons = [];
        const linkedWitnesses = caseRecord.witnesses.filter((witness) => witness.sourceItemIds.some((id) => admitted.some((support) => id.includes(support.id) || support.id.includes(id))));
        if (linkedWitnesses.length) { const witnessContribution = linkedWitnesses.reduce((total, witness) => total + witness.credibility / 200, 0); prosecution += witnessContribution; reasons.push(`${linkedWitnesses.length} disclosed witness record(s) added ${round(witnessContribution)} corroboration.`); }
        if (caseRecord.strategy.challengeKind === "support") {
          const challenged = contributions.find((entry) => entry.support.id === caseRecord.strategy.challengeTargetId);
          if (challenged) { const reduction = Math.min(challenged.value, 1.5 + capacity); prosecution -= reduction; reasons.push(`${challenged.support.label} lost ${round(reduction)} weight under the saved evidence-specific challenge.`); }
        } else if (caseRecord.strategy.challengeKind === "witness" && linkedWitnesses.some((witness) => witness.id === caseRecord.strategy.challengeTargetId)) {
          const reduction = 0.75 + capacity / 2; prosecution -= reduction; reasons.push(`The targeted witness challenge created ${round(reduction)} doubt.`);
        }
        if (theory.elementKinds.includes(element.kind)) {
          const theoryEffect = capacity * (theory.requiresExculpatory && !exculpatory ? 0.3 : 0.65); doubt += theoryEffect; reasons.push(`${theory.label} created ${round(theoryEffect)} element-specific doubt${theory.requiresExculpatory && !exculpatory ? " because no disclosed exculpatory item fully supported it" : ""}.`);
          if (alignedClaim?.status === "supported") { doubt += 0.75; reasons.push(`The saved supported ${alignedClaim.typeId} pretrial claim added 0.75 doubt.`); }
          else if (alignedClaim?.status === "contradicted") { prosecution += 0.75; reasons.push(`The saved contradicted ${alignedClaim.typeId} claim added 0.75 prosecution weight.`); }
        }
        if (caseRecord.strategy.testify) {
          const credibilityEffect = (caseRecord.preparation.credibility - 50) / 25; const relevant = theory.elementKinds.includes(element.kind);
          if (credibilityEffect >= 0 && relevant) { doubt += credibilityEffect; reasons.push(`Credible scientist testimony added ${round(credibilityEffect)} doubt.`); }
          else if (credibilityEffect < 0) { prosecution += Math.abs(credibilityEffect); reasons.push(`Cross-examination and saved credibility damage added ${round(Math.abs(credibilityEffect))} prosecution weight.`); }
        }
        if (caseRecord.strategy.closingPriorityId === "defeatSeriousCharges" && ["critical", "serious"].includes(charge.severity)) doubt += 0.75;
        if (caseRecord.strategy.closingPriorityId === "completeAcquittal") doubt += 0.35;
        element.prosecutionScore = round(Math.max(0, prosecution)); element.defenseDoubt = round(doubt); element.margin = round(element.prosecutionScore - element.defenseDoubt); element.threshold = 4.5; element.proven = element.margin >= element.threshold;
        element.supportIds = contributions.map((entry) => entry.support.id); element.witnessIds = linkedWitnesses.map((entry) => entry.id);
        element.reasons = [`${contributions.length} admitted support item(s) supplied ${round(contributions.reduce((total, entry) => total + entry.value, 0))} element weight.`, ...reasons, `${element.margin} net proof ${element.proven ? "met" : "did not meet"} the 4.5 beyond-reasonable-doubt threshold.`];
      }
      const failed = charge.elements.filter((element) => !element.proven); charge.verdict = failed.length ? "notGuilty" : "guilty";
      charge.verdictReason = failed.length ? `Not guilty because ${failed.map((element) => element.label).join("; ")} remained in reasonable doubt.` : `Guilty because every required element was proven beyond reasonable doubt from the admitted saved record.`;
    }
    caseRecord.verdictAt = at; const guilty = caseRecord.charges.filter((entry) => entry.verdict === "guilty"); const acquitted = caseRecord.charges.filter((entry) => entry.verdict === "notGuilty"); const dismissed = caseRecord.charges.filter((entry) => entry.verdict === "dismissed");
    caseRecord.judgmentReasons = [`${guilty.length} guilty, ${acquitted.length} not-guilty, and ${dismissed.length} dismissed charge disposition(s).`, ...caseRecord.charges.map((charge) => `${charge.label}: ${charge.verdictReason || "Dismissed before judgment."}`)];
    return guilty;
  }

  function capitalEligible(caseRecord) {
    const capitalPatterns = ["death", "killed", "fatal", "mass casualty", "soul destruction", "genocide"];
    return caseRecord.charges.some((charge) => charge.verdict === "guilty" && ["violentResistance", "prohibitedAnimancy"].includes(charge.typeId) && charge.support.some((support) => includesPattern(support, capitalPatterns)));
  }

  function createOrder(state, caseRecord, at, acquittal = false) {
    const convictions = caseRecord.charges.filter((entry) => entry.verdict === "guilty");
    if (acquittal || !convictions.length) return normalizeOrder({ id: `sentencing-order-${state.nextOrderNumber++}`, kind: "acquittalRelease", label: "Acquittal and immediate release order", custodial: false, issuedAt: at, transferNotBefore: at + 30 * 60, destinationId: "publicEntrance", status: "releasePending", reasons: ["No charge resulted in a conviction.", "Pretrial restrictions and custody authority terminate with the final judgment."] });
    const totalWeight = convictions.reduce((total, charge) => total + charge.weight, 0); let aggravation = 0; const reasons = [`Conviction severity supplied ${round(totalWeight)} exposure points.`];
    if (convictions.some((charge) => charge.typeId === "violentResistance")) { aggravation += 6; reasons.push("A violent-resistance conviction added 6 aggravation points."); }
    if (convictions.some((charge) => ["escapeCustody", "attemptedEscape", "failureToAppear"].includes(charge.typeId))) { aggravation += 4; reasons.push("Custody or appearance offenses added 4 aggravation points."); }
    if (convictions.some((charge) => charge.typeId === "falseStatement")) { aggravation += 2; reasons.push("A material false-statement conviction added 2 aggravation points."); }
    let mitigation = caseRecord.strategy.sentencingSubmissionId === "individualizedMercy" ? 4 : SENTENCING_SUBMISSIONS.find((entry) => entry.id === caseRecord.strategy.sentencingSubmissionId)?.mitigation || 0;
    if (caseRecord.pretrialHistory.some((entry) => entry.action === "voluntarySurrender")) { mitigation += 3; reasons.push("Saved voluntary surrender added 3 mitigation points."); }
    mitigation += Math.min(5, caseRecord.preparation.progress / 20); if (caseRecord.strategy.closingPriorityId === "mitigatePunishment") mitigation += 2;
    if (caseRecord.mode === "plea") { mitigation += 4; reasons.push("The binding plea supplied 4 acceptance-of-responsibility points."); }
    let exposure = Math.max(0, totalWeight + aggravation - mitigation); reasons.push(`${round(mitigation)} total mitigation produced ${round(exposure)} net exposure.`);
    let kind = "finitePrison";
    if (capitalEligible(caseRecord) && exposure >= 28 && !caseRecord.appellateMandate?.capitalSentenceBarred) kind = "deathRow";
    else if (exposure >= 32) kind = "penalLegion";
    else if (caseRecord.strategy.sentencingSubmissionId === "penalService" && exposure >= 12 && !convictions.some((charge) => charge.typeId === "violentResistance")) kind = "penalLegion";
    else if (exposure < 7) kind = "timeServed";
    else if (exposure < 12) kind = "fineProbation";
    const recommendation = caseRecord.plea?.sentencingRecommendation || "";
    if (recommendation === "supervisedRelease" && !capitalEligible(caseRecord)) kind = "fineProbation";
    if (recommendation === "shortCustodyOrPenalService" && !["penalLegion", "fineProbation", "timeServed"].includes(kind)) kind = "finitePrison";
    if (recommendation === "custodialCap" && kind === "deathRow") kind = "finitePrison";
    const defs = {
      timeServed: { label: "Time served and release", custodial: false, destinationId: "publicEntrance", status: "releasePending" },
      fineProbation: { label: "Fine and supervised release", custodial: false, destinationId: "publicEntrance", status: "releasePending" },
      finitePrison: { label: "Finite prison commitment", custodial: true, destinationId: "statePrisonIntake", status: caseRecord.custodyStatus === "released" ? "remandPending" : "commitmentPending" },
      penalLegion: { label: "Penal-legion military commitment", custodial: true, destinationId: "penalLegionProcessing", status: caseRecord.custodyStatus === "released" ? "remandPending" : "commitmentPending" },
      deathRow: { label: "Death-row commitment and provisional execution process", custodial: true, destinationId: "deathRowIntake", status: caseRecord.custodyStatus === "released" ? "remandPending" : "commitmentPending" }
    };
    const def = defs[kind]; const fine = kind === "fineProbation" ? Math.ceil((1000 + exposure * 250) / 100) * 100 : 0; const forfeiture = Math.max(0, finite(caseRecord.plea?.forfeitureAmount));
    const order = normalizeOrder({ id: `sentencing-order-${state.nextOrderNumber++}`, kind, label: def.label, custodial: def.custodial, issuedAt: at, transferNotBefore: at + (def.custodial ? 4 * HOUR : 30 * 60), destinationId: def.destinationId, status: def.status,
      incarcerationMonths: kind === "finitePrison" ? Math.max(3, Math.min(120, Math.ceil(exposure * 2))) : 0, deathSentence: kind === "deathRow", penalService: kind === "penalLegion",
      fine, forfeiture, outstanding: fine + forfeiture, probationMonths: kind === "fineProbation" ? Math.max(6, Math.ceil(exposure * 2)) : 0,
      restrictions: kind === "fineProbation" ? ["Appear for supervision", "No prohibited research or contraband commerce", "Submit to lawful compliance inspections", ...(convictions.some((charge) => charge.typeId === "prohibitedAnimancy") ? ["Wear a court-ordered magic suppressor"] : [])] : [],
      commitmentId: def.custodial ? `${caseRecord.id}-${kind}-commitment` : "", provisionalExecutionProcessId: kind === "deathRow" ? `${caseRecord.id}-provisional-execution` : "", reasons: [...reasons, `${def.label} followed the saved exposure band and jurisdictional eligibility rules.`, ...(kind === "deathRow" ? ["The death sentence does not kill the scientist; appeals, commutation, rescue, escape, and physical execution remain unresolved."] : [])] });
    caseRecord.sentencing.exposure = exposure; caseRecord.sentencing.aggravation = aggravation; caseRecord.sentencing.mitigation = mitigation; caseRecord.sentencing.reasons = reasons; return order;
  }

  function completeAppearance(candidate, caseId, clock = 0) {
    const state = normalizeState(candidate); const caseRecord = state.cases.find((entry) => entry.id === cleanId(caseId));
    if (!caseRecord || caseRecord.phaseStatus !== "inProgress") return { state, case: caseRecord, changed: false, reason: "No court phase is in progress." };
    const phase = caseRecord.phases.at(-1); const at = Math.max(phase.startedAt, finite(clock)); phase.completedAt = at; phase.summary = `${phaseDef(phase.id).label} completed and entered the immutable court record.`; caseRecord.phaseStatus = "pending";
    if (phase.id === "prosecution") caseRecord.currentPhaseId = "defense";
    else if (phase.id === "defense") caseRecord.currentPhaseId = "deliberation";
    else if (phase.id === "deliberation") {
      const guilty = resolveVerdicts(caseRecord, at);
      if (guilty.length) { caseRecord.status = "awaitingSentencing"; caseRecord.currentPhaseId = "sentencing"; caseRecord.sentencingAt = at + 2 * HOUR; }
      else { caseRecord.sentencing.order = createOrder(state, caseRecord, at, true); caseRecord.status = "completed"; }
    } else if (phase.id === "sentencing") { caseRecord.sentencing.order = createOrder(state, caseRecord, at, false); caseRecord.status = "completed"; }
    if (!["awaitingSentencing", "completed"].includes(caseRecord.status)) caseRecord.status = "inTrial";
    caseRecord.history.push({ at, action: `${phase.id}Completed`, summary: phase.summary });
    if (caseRecord.status === "awaitingSentencing") caseRecord.history.push({ at, action: "verdictEntered", summary: `${caseRecord.charges.filter((charge) => charge.verdict === "guilty").length} conviction(s) require a separate sentencing appearance at ${caseRecord.sentencingAt}.` });
    if (caseRecord.status === "completed") caseRecord.history.push({ at, action: "finalOrderIssued", summary: `${caseRecord.sentencing.order.label} issued; only actual physical death can end the run.` });
    return { state, case: caseRecord, phase: phaseDef(phase.id), order: caseRecord.sentencing.order, changed: true };
  }

  function recordPayment(candidate, caseId, amount, clock = 0) {
    const state = normalizeState(candidate); const caseRecord = state.cases.find((entry) => entry.id === cleanId(caseId)); const order = caseRecord?.sentencing.order; const paid = Math.max(0, Math.min(Math.round(finite(amount)), order?.outstanding || 0));
    if (!order || !paid) return { state, case: caseRecord, order, paid: 0, changed: false };
    order.paid += paid; order.outstanding -= paid; caseRecord.history.push({ at: Math.max(order.issuedAt, finite(clock)), action: "financialOrderPaid", summary: `${paid} paid toward ${order.id}; ${order.outstanding} remains outstanding.` }); return { state, case: caseRecord, order, paid, changed: true };
  }

  function markOrderStatus(candidate, caseId, status, clock = 0, summary = "") {
    const state = normalizeState(candidate); const caseRecord = state.cases.find((entry) => entry.id === cleanId(caseId)); const order = caseRecord?.sentencing.order;
    if (!order || !["releasePending", "remandPending", "commitmentPending", "committed", "releaseDue", "completed"].includes(status)) return { state, case: caseRecord, order, changed: false };
    order.status = status; caseRecord.history.push({ at: Math.max(order.issuedAt, finite(clock)), action: "orderStatus", summary: String(summary || `${order.label} is now ${status}.`).trim() }); return { state, case: caseRecord, order, changed: true };
  }

  function advance(candidate, clock = 0) {
    const state = normalizeState(candidate); const at = finite(clock); let changes = 0;
    for (const caseRecord of state.cases) {
      if (caseRecord.status === "scheduled" && caseRecord.custodyStatus !== "detained" && at > caseRecord.appearanceDeadline) { caseRecord.status = "missed"; caseRecord.missedAt = caseRecord.appearanceDeadline; caseRecord.history.push({ at: caseRecord.missedAt, action: "trialMissed", summary: "The scientist missed the required bench-trial appearance; no verdict was fabricated and a failure-to-appear response is required." }); changes += 1; }
    }
    return { state, changes };
  }

  function nextEvent(candidate, clock = 0) {
    const at = finite(clock); const events = [];
    for (const caseRecord of normalizeState(candidate).cases) {
      if (caseRecord.status === "scheduled" && caseRecord.trialAt >= at) events.push({ at: caseRecord.trialAt, kind: "trialAppearance", caseId: caseRecord.id, label: `${caseRecord.docket} bench trial` });
      if (caseRecord.status === "awaitingSentencing" && caseRecord.sentencingAt >= at) events.push({ at: caseRecord.sentencingAt, kind: "sentencingAppearance", caseId: caseRecord.id, label: `${caseRecord.docket} sentencing` });
      const order = caseRecord.sentencing.order; if (order && ["releasePending", "remandPending", "commitmentPending"].includes(order.status) && order.transferNotBefore >= at) events.push({ at: order.transferNotBefore, kind: "orderEffective", caseId: caseRecord.id, label: order.label });
    }
    return events.sort((left, right) => left.at - right.at || left.caseId.localeCompare(right.caseId))[0] || null;
  }

  return Object.freeze({ VERSION, CASE_STATUSES, PHASES, DEFENSE_THEORIES, CLOSING_PRIORITIES, SENTENCING_SUBMISSIONS, CHARGE_ELEMENTS, defaultState, normalizeState, normalizeCase, open, openSuccessor, configure, phaseDef, beginAppearance, completeAppearance, recordPayment, markOrderStatus, advance, nextEvent });
}));
