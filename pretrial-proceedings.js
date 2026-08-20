(function attachHelixPretrialProceedings(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPretrialProceedings = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixPretrialProceedings() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["chargingPending", "counselSelection", "firstAppearanceReady", "hearing", "detained", "bailPending", "released", "fugitive", "resolved"]);
  const COUNSEL_KINDS = Object.freeze(["public", "retained", "self"]);
  const SUBMISSIONS = Object.freeze([
    { id: "recognizance", label: "Request Release on Recognizance", mitigation: 5, conditions: false },
    { id: "securedBail", label: "Offer Secured Bail", mitigation: 7, conditions: true },
    { id: "strictConditions", label: "Propose Strict Conditions", mitigation: 10, conditions: true }
  ]);
  const CHARGE_DEFS = Object.freeze({
    prohibitedResearch: { id: "prohibitedResearch", label: "Unlicensed Prohibited Research", severity: "serious", weight: 8, maximumExposure: "Substantial custodial sentence" },
    prohibitedAnimancy: { id: "prohibitedAnimancy", label: "Prohibited Animantic Practice", severity: "critical", weight: 12, maximumExposure: "Severe custodial sentence" },
    contrabandCommerce: { id: "contrabandCommerce", label: "Contraband Commerce", severity: "serious", weight: 7, maximumExposure: "Custody, forfeiture, and fines" },
    hazardousBiologicalConduct: { id: "hazardousBiologicalConduct", label: "Hazardous Biological Conduct", severity: "material", weight: 5, maximumExposure: "Regulatory and custodial penalties" },
    warrantObstruction: { id: "warrantObstruction", label: "Obstruction of Warrant Service", severity: "serious", weight: 7, maximumExposure: "Additional custodial sentence" },
    violentResistance: { id: "violentResistance", label: "Violent Resistance to Arrest", severity: "critical", weight: 14, maximumExposure: "Severe consecutive sentence" },
    escapeCustody: { id: "escapeCustody", label: "Escape from Pretrial Custody", severity: "critical", weight: 13, maximumExposure: "Additional custodial sentence" },
    failureToAppear: { id: "failureToAppear", label: "Failure to Appear", severity: "serious", weight: 8, maximumExposure: "Bench warrant and additional sentence" }
  });
  const GIVEN_NAMES = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal", "Vera", "Jules", "Anja", "Rook"]);
  const SURNAMES = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene", "Ward", "Hale", "Pike", "Quill"]);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
  }

  function hash(seed) {
    const text = String(seed || "pretrial-proceedings");
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    value += value << 13; value ^= value >>> 7;
    value += value << 3; value ^= value >>> 17; value += value << 5;
    return value >>> 0;
  }

  function unitRoll(seed) {
    return hash(seed) / 4294967296;
  }

  function generatedName(seed, role) {
    return `${GIVEN_NAMES[hash(`${seed}:${role}:given`) % GIVEN_NAMES.length]} ${SURNAMES[hash(`${seed}:${role}:surname`) % SURNAMES.length]}`;
  }

  function normalizeHistory(candidate) {
    return (Array.isArray(candidate) ? candidate : []).map((entry) => ({
      at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated",
      summary: String(entry?.summary || "Pretrial proceeding updated.").trim()
    })).sort((left, right) => left.at - right.at);
  }

  function normalizeOfficial(candidate, fallback = {}) {
    return {
      id: cleanId(candidate?.id) || cleanId(fallback.id),
      name: String(candidate?.name || fallback.name || "Court official").trim(),
      role: cleanId(candidate?.role) || cleanId(fallback.role),
      proceduralStrictness: Math.max(0, Math.min(100, finite(candidate?.proceduralStrictness, fallback.proceduralStrictness ?? 50))),
      libertyPreference: Math.max(0, Math.min(100, finite(candidate?.libertyPreference, fallback.libertyPreference ?? 50)))
    };
  }

  function normalizeSupport(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `charge-support-${index + 1}`,
      kind: cleanId(candidate?.kind) || "authorityEvidence", sourceId: cleanId(candidate?.sourceId),
      label: String(candidate?.label || "Authority support").trim(),
      reliability: ["weak", "credible", "strong"].includes(candidate?.reliability) ? candidate.reliability : "credible",
      significanceRank: Math.max(0, Math.min(4, Math.floor(finite(candidate?.significanceRank, 1)))),
      traits: [...new Set((Array.isArray(candidate?.traits) ? candidate.traits : []).map((entry) => String(entry || "").trim()).filter(Boolean))],
      disclosed: Boolean(candidate?.disclosed)
    };
  }

  function normalizeCharge(candidate, index = 0) {
    const def = CHARGE_DEFS[candidate?.typeId] || CHARGE_DEFS.prohibitedResearch;
    return {
      id: cleanId(candidate?.id) || `criminal-charge-${index + 1}`,
      typeId: def.id, label: String(candidate?.label || def.label).trim(), severity: def.severity,
      weight: Math.max(0, finite(candidate?.weight, def.weight)), maximumExposure: String(candidate?.maximumExposure || def.maximumExposure),
      status: ["proposed", "filed", "rejected", "dismissed", "resolved"].includes(candidate?.status) ? candidate.status : "proposed",
      filedAt: candidate?.filedAt == null ? null : Math.max(0, finite(candidate.filedAt)),
      publicProbableCause: String(candidate?.publicProbableCause || "The prosecution cites the linked authority record.").trim(),
      support: (Array.isArray(candidate?.support) ? candidate.support : []).map(normalizeSupport)
    };
  }

  function normalizeCounselOption(candidate, index = 0) {
    const kind = COUNSEL_KINDS.includes(candidate?.kind) ? candidate.kind : COUNSEL_KINDS[index] || "public";
    return {
      id: cleanId(candidate?.id) || `counsel-option-${kind}`,
      kind, name: String(candidate?.name || (kind === "self" ? "The Scientist" : "Defense Counsel")).trim(),
      specialties: uniqueIds(candidate?.specialties), workload: Math.max(0, Math.min(100, finite(candidate?.workload, kind === "public" ? 78 : kind === "retained" ? 36 : 100))),
      loyalty: Math.max(0, Math.min(100, finite(candidate?.loyalty, kind === "retained" ? 58 : 45))),
      proceduralSkill: Math.max(0, Math.min(100, finite(candidate?.proceduralSkill, kind === "public" ? 64 : kind === "retained" ? 76 : 20))),
      cost: Math.max(0, Math.round(finite(candidate?.cost))), available: candidate?.available !== false,
      description: String(candidate?.description || "").trim()
    };
  }

  function normalizeConference(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `counsel-conference-${index + 1}`,
      counselOptionId: cleanId(candidate?.counselOptionId), at: Math.max(0, finite(candidate?.at)),
      channel: cleanId(candidate?.channel) || "legalCounsel", privileged: candidate?.privileged !== false,
      summary: String(candidate?.summary || "Privileged defense conference completed.").trim()
    };
  }

  function normalizeCondition(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `release-condition-${index + 1}`,
      kind: cleanId(candidate?.kind) || "appearAsOrdered", label: String(candidate?.label || "Appear as ordered").trim(),
      physicallyEnforced: Boolean(candidate?.physicallyEnforced), status: candidate?.status === "violated" ? "violated" : "active",
      sourceChargeId: cleanId(candidate?.sourceChargeId), imposedAt: Math.max(0, finite(candidate?.imposedAt)),
      physicalStackId: cleanId(candidate?.physicalStackId), toolInstanceId: cleanId(candidate?.toolInstanceId)
    };
  }

  function normalizeProceeding(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const openedAt = Math.max(0, finite(source.openedAt));
    const options = (Array.isArray(source.counsel?.options) ? source.counsel.options : []).map(normalizeCounselOption);
    const charges = (Array.isArray(source.charges) ? source.charges : []).map(normalizeCharge);
    const selectedOptionId = cleanId(source.counsel?.selectedOptionId);
    return {
      id: cleanId(source.id) || `pretrial-proceeding-${index + 1}`,
      raidId: cleanId(source.raidId), authorityCaseId: cleanId(source.authorityCaseId), warrantExecutionId: cleanId(source.warrantExecutionId),
      docket: String(source.docket || "CR-0000").trim(), status: STATUSES.includes(source.status) ? source.status : "chargingPending",
      openedAt, updatedAt: Math.max(openedAt, finite(source.updatedAt, openedAt)),
      court: {
        id: cleanId(source.court?.id) || "municipal-criminal-court", label: String(source.court?.label || "Municipal Criminal Court").trim(),
        jurisdictionId: cleanId(source.court?.jurisdictionId) || "local-municipality",
        judge: normalizeOfficial(source.court?.judge, { id: `pretrial-${index + 1}-judge`, name: "Magistrate", role: "judge" }),
        prosecutor: normalizeOfficial(source.court?.prosecutor, { id: `pretrial-${index + 1}-prosecutor`, name: "Prosecutor", role: "prosecutor" })
      },
      charges,
      counsel: {
        options, selectedOptionId, selectedAt: source.counsel?.selectedAt == null ? null : Math.max(openedAt, finite(source.counsel.selectedAt)),
        paid: Boolean(source.counsel?.paid), agreementAmount: Math.max(0, Math.round(finite(source.counsel?.agreementAmount))),
        conferences: (Array.isArray(source.counsel?.conferences) ? source.counsel.conferences : []).map(normalizeConference)
      },
      timeline: {
        chargingAt: Math.max(openedAt, finite(source.timeline?.chargingAt, openedAt + HOUR)),
        counselDeadline: Math.max(openedAt, finite(source.timeline?.counselDeadline, openedAt + 4 * HOUR)),
        firstAppearanceAt: Math.max(openedAt, finite(source.timeline?.firstAppearanceAt, openedAt + 8 * HOUR)),
        discoveryDueAt: source.timeline?.discoveryDueAt == null ? null : Math.max(openedAt, finite(source.timeline.discoveryDueAt)),
        nextHearingAt: source.timeline?.nextHearingAt == null ? null : Math.max(openedAt, finite(source.timeline.nextHearingAt))
      },
      firstAppearance: {
        status: ["scheduled", "ready", "inProgress", "completed", "missed"].includes(source.firstAppearance?.status) ? source.firstAppearance.status : "scheduled",
        startedAt: source.firstAppearance?.startedAt == null ? null : Math.max(openedAt, finite(source.firstAppearance.startedAt)),
        completedAt: source.firstAppearance?.completedAt == null ? null : Math.max(openedAt, finite(source.firstAppearance.completedAt)),
        submissionId: cleanId(source.firstAppearance?.submissionId), decision: cleanId(source.firstAppearance?.decision),
        riskScore: Math.max(0, finite(source.firstAppearance?.riskScore)), mitigationScore: Math.max(0, finite(source.firstAppearance?.mitigationScore)),
        discretion: Math.max(0, Math.min(1, finite(source.firstAppearance?.discretion))),
        reasons: (Array.isArray(source.firstAppearance?.reasons) ? source.firstAppearance.reasons : []).map(String),
        rejectedChargeIds: uniqueIds(source.firstAppearance?.rejectedChargeIds)
      },
      release: {
        status: ["none", "awaitingBail", "released", "revoked", "forfeited"].includes(source.release?.status) ? source.release.status : "none",
        kind: cleanId(source.release?.kind), orderedAt: source.release?.orderedAt == null ? null : Math.max(openedAt, finite(source.release.orderedAt)),
        releasedAt: source.release?.releasedAt == null ? null : Math.max(openedAt, finite(source.release.releasedAt)),
        bailAmount: Math.max(0, Math.round(finite(source.release?.bailAmount))),
        escrowStatus: ["none", "due", "held", "refunded", "forfeited"].includes(source.release?.escrowStatus) ? source.release.escrowStatus : "none",
        escrowPaidAt: source.release?.escrowPaidAt == null ? null : Math.max(openedAt, finite(source.release.escrowPaidAt)),
        conditions: (Array.isArray(source.release?.conditions) ? source.release.conditions : []).map(normalizeCondition),
        transport: source.release?.transport && typeof source.release.transport === "object" ? { ...source.release.transport } : null
      },
      fugitive: {
        active: Boolean(source.fugitive?.active), escapedAt: source.fugitive?.escapedAt == null ? null : Math.max(openedAt, finite(source.fugitive.escapedAt)),
        benchWarrantStatus: ["none", "requested", "issued", "served"].includes(source.fugitive?.benchWarrantStatus) ? source.fugitive.benchWarrantStatus : "none",
        failureToAppearAt: source.fugitive?.failureToAppearAt == null ? null : Math.max(openedAt, finite(source.fugitive.failureToAppearAt))
      },
      history: normalizeHistory(source.history)
    };
  }

  function defaultState() {
    return { version: VERSION, proceedings: [], nextProceedingNumber: 1, nextChargeNumber: 1, nextConferenceNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const proceedings = (Array.isArray(source.proceedings) ? source.proceedings : []).map(normalizeProceeding);
    return {
      version: VERSION, proceedings,
      nextProceedingNumber: Math.max(1, Math.floor(finite(source.nextProceedingNumber, proceedings.length + 1))),
      nextChargeNumber: Math.max(1, Math.floor(finite(source.nextChargeNumber, 1))),
      nextConferenceNumber: Math.max(1, Math.floor(finite(source.nextConferenceNumber, 1)))
    };
  }

  function counselOptions(seed, proceedingId) {
    const retainedCost = 1200 + (hash(`${seed}:${proceedingId}:retainer`) % 9) * 150;
    return [
      normalizeCounselOption({ id: `${proceedingId}-public-counsel`, kind: "public", name: generatedName(seed, `${proceedingId}:public`), specialties: ["custodyHearings", "warrantProcedure"], workload: 72 + hash(`${seed}:public:workload`) % 20, proceduralSkill: 60 + hash(`${seed}:public:skill`) % 17, loyalty: 45, cost: 0, description: "Free appointed counsel with strong routine procedure and a heavy caseload." }),
      normalizeCounselOption({ id: `${proceedingId}-retained-counsel`, kind: "retained", name: generatedName(seed, `${proceedingId}:retained`), specialties: ["prohibitedResearch", "complexEvidence", "custodyHearings"], workload: 24 + hash(`${seed}:retained:workload`) % 25, proceduralSkill: 73 + hash(`${seed}:retained:skill`) % 18, loyalty: 58, cost: retainedCost, description: "Paid specialist counsel with more preparation capacity and an explicit retainer." }),
      normalizeCounselOption({ id: `${proceedingId}-self-representation`, kind: "self", name: "The Scientist", specialties: [], workload: 100, proceduralSkill: 20, loyalty: 100, cost: 0, description: "Direct control without professional procedural expertise; standby public counsel remains available." })
    ];
  }

  function supportText(entry) {
    return `${entry.label}${entry.sourceId ? ` (${entry.sourceId})` : ""}`;
  }

  function chargesFromContext(state, proceedingId, context = {}) {
    const support = (Array.isArray(context.authoritySupport) ? context.authoritySupport : []).map(normalizeSupport);
    const traits = support.flatMap((entry) => entry.traits).join(" ").toLowerCase();
    const charges = [];
    const add = (typeId, matching, publicReason) => {
      const def = CHARGE_DEFS[typeId];
      const exact = matching.length ? matching : support;
      if (!def || charges.some((charge) => charge.typeId === typeId) || !exact.length) return;
      charges.push(normalizeCharge({
        id: `criminal-charge-${state.nextChargeNumber++}`, typeId, status: "proposed", support: exact,
        publicProbableCause: publicReason || `The prosecution cites ${exact.map(supportText).join("; ")}.`
      }, charges.length));
    };
    const matching = (patterns) => support.filter((entry) => patterns.some((pattern) => entry.traits.some((trait) => String(trait).toLowerCase().includes(pattern)) || entry.label.toLowerCase().includes(pattern)));
    add("prohibitedAnimancy", matching(["animancy", "animantic", "soul"]), "The prosecution alleges prohibited soul manipulation supported by the cited authority record.");
    add("contrabandCommerce", matching(["black market", "contraband", "off-books", "illegal commerce"]), "The prosecution alleges covert prohibited commerce supported by reported or seized transactions.");
    add("hazardousBiologicalConduct", matching(["biological", "hazard", "contamination", "discharge", "creature"]), "The prosecution alleges hazardous biological conduct supported by the cited physical or documentary record.");
    add("warrantObstruction", matching(["obstruction", "forced entry", "denied access"]), "The prosecution cites saved obstruction or forced-entry history.");
    const raidSupport = (Array.isArray(context.raidSupport) ? context.raidSupport : []).map(normalizeSupport);
    if (context.violentResistance) add("violentResistance", raidSupport.length ? raidSupport : support, "The raid record identifies an officer attack or immediate violent resistance during arrest.");
    if (!charges.length || /genetic|research|mutation|slime|specimen/.test(traits)) {
      const exact = matching(["genetic", "research", "mutation", "slime", "specimen"]);
      add("prohibitedResearch", exact.length ? exact : support, "The charging instrument cites the supported warrant allegation and its linked authority evidence for prohibited research.");
    }
    if (!charges.length) {
      const fallback = normalizeSupport({ id: `${proceedingId}-warrant-support`, kind: "warrantExecution", sourceId: context.warrantExecutionId, label: context.warrantLabel || "Supported search-and-arrest warrant", reliability: "credible", significanceRank: 2, traits: ["prohibited research allegation"] });
      charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "prohibitedResearch", status: "proposed", support: [fallback], publicProbableCause: "The charge rests on the supported warrant allegation pending discovery of the underlying authority record." }));
    }
    return charges;
  }

  function open(candidate, context = {}) {
    const state = normalizeState(candidate);
    const raidId = cleanId(context.raidId);
    const existing = state.proceedings.find((entry) => entry.raidId === raidId);
    if (existing) return { state, proceeding: existing, created: false };
    const openedAt = Math.max(0, finite(context.clock));
    const id = `pretrial-proceeding-${state.nextProceedingNumber++}`;
    const seed = String(context.seed || "pretrial");
    const discretion = unitRoll(`${seed}:${id}:first-appearance-discretion`);
    const proceeding = normalizeProceeding({
      id, raidId, authorityCaseId: context.authorityCaseId, warrantExecutionId: context.warrantExecutionId,
      docket: context.docket || `CR-${String(state.nextProceedingNumber - 1).padStart(4, "0")}`, openedAt,
      court: {
        id: "municipal-criminal-court", label: context.courtLabel || "Municipal Criminal Court", jurisdictionId: context.jurisdictionId || "local-municipality",
        judge: { id: `${id}-judge`, name: generatedName(seed, `${id}:judge`), role: "judge", proceduralStrictness: 40 + hash(`${seed}:${id}:strict`) % 41, libertyPreference: 35 + hash(`${seed}:${id}:liberty`) % 51 },
        prosecutor: { id: `${id}-prosecutor`, name: generatedName(seed, `${id}:prosecutor`), role: "prosecutor", proceduralStrictness: 50, libertyPreference: 20 }
      },
      charges: chargesFromContext(state, id, context), counsel: { options: counselOptions(seed, id) },
      timeline: { chargingAt: openedAt + HOUR, counselDeadline: openedAt + 4 * HOUR, firstAppearanceAt: openedAt + 8 * HOUR },
      firstAppearance: { discretion },
      history: [
        { at: openedAt, action: "caseOpened", summary: "A criminal proceeding was opened from the exact arrest, warrant, and authority record; charging remained pending." },
        ...(context.voluntarySurrender ? [{ at: openedAt, action: "voluntarySurrender", summary: "The saved raid record shows that the scientist surrendered before physical restraint." }] : [])
      ]
    }, state.proceedings.length);
    state.proceedings.push(proceeding);
    return { state, proceeding, created: true };
  }

  function current(candidate) {
    return normalizeState(candidate).proceedings.find((entry) => !["resolved"].includes(entry.status)) || null;
  }

  function fileCharges(proceeding, clock) {
    const filed = proceeding.charges.filter((charge) => charge.status === "proposed");
    for (const charge of filed) { charge.status = "filed"; charge.filedAt = clock; for (const support of charge.support) support.disclosed = false; }
    if (filed.length) proceeding.history.push({ at: clock, action: "chargesFiled", summary: `${filed.length} charge(s) were filed with stated probable cause; undisclosed support remained hidden pending discovery.` });
    if (!proceeding.fugitive.active) proceeding.status = "counselSelection";
  }

  function selectCounsel(candidate, proceedingId, optionId, clock = 0) {
    const state = normalizeState(candidate);
    const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const option = proceeding?.counsel.options.find((entry) => entry.id === cleanId(optionId) && entry.available);
    if (!proceeding || !option || proceeding.counsel.selectedOptionId) return { state, proceeding, option, changed: false };
    const at = Math.max(proceeding.openedAt, finite(clock));
    proceeding.counsel.selectedOptionId = option.id; proceeding.counsel.selectedAt = at;
    proceeding.counsel.agreementAmount = option.cost; proceeding.counsel.paid = option.cost === 0;
    proceeding.history.push({ at, action: "counselSelected", summary: option.kind === "self" ? "The scientist invoked self-representation with standby public counsel." : `${option.name} entered an appearance as ${option.kind} defense counsel.` });
    return { state, proceeding, option, changed: true };
  }

  function markCounselPaid(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.counsel.paid || !proceeding.counsel.selectedOptionId) return { state, proceeding, changed: false };
    proceeding.counsel.paid = true; proceeding.history.push({ at: Math.max(proceeding.openedAt, finite(clock)), action: "retainerPaid", summary: "The retained-counsel agreement was paid from an explicit lawful funding source." });
    return { state, proceeding, changed: true };
  }

  function recordConference(candidate, proceedingId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding?.counsel.selectedOptionId || proceeding.counsel.conferences.some((entry) => entry.counselOptionId === proceeding.counsel.selectedOptionId)) return { state, proceeding, changed: false };
    const conference = normalizeConference({ id: `counsel-conference-${state.nextConferenceNumber++}`, counselOptionId: proceeding.counsel.selectedOptionId, at: options.clock, channel: options.channel, privileged: true, summary: options.summary }, proceeding.counsel.conferences.length);
    proceeding.counsel.conferences.push(conference); proceeding.history.push({ at: conference.at, action: "privilegedConference", summary: conference.summary });
    return { state, proceeding, conference, changed: true };
  }

  function hearingRequirements(proceeding) {
    if (!proceeding) return "No active criminal proceeding.";
    if (!proceeding.counsel.selectedOptionId) return "Select representation before the first appearance.";
    const selected = proceeding.counsel.options.find((entry) => entry.id === proceeding.counsel.selectedOptionId);
    if (selected?.kind === "retained" && !proceeding.counsel.paid) return "Pay the retained-counsel agreement before counsel can appear.";
    if (selected?.kind !== "self" && !proceeding.counsel.conferences.some((entry) => entry.counselOptionId === selected?.id)) return "Complete a privileged counsel conference before the hearing.";
    if (proceeding.firstAppearance.status !== "ready") return proceeding.firstAppearance.status === "scheduled" ? "The first appearance is not yet due." : "The first appearance is unavailable.";
    if (proceeding.fugitive.active) return "A fugitive defendant cannot physically appear through the jail hearing room.";
    return "";
  }

  function beginHearing(candidate, proceedingId, submissionId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const submission = SUBMISSIONS.find((entry) => entry.id === cleanId(submissionId));
    const reason = hearingRequirements(proceeding);
    if (!proceeding || !submission || reason) return { state, proceeding, submission, reason, changed: false };
    proceeding.status = "hearing"; proceeding.firstAppearance.status = "inProgress"; proceeding.firstAppearance.startedAt = Math.max(proceeding.openedAt, finite(clock)); proceeding.firstAppearance.submissionId = submission.id;
    proceeding.history.push({ at: proceeding.firstAppearance.startedAt, action: "firstAppearanceBegan", summary: `${submission.label} was presented at the physical secure court appearance.` });
    return { state, proceeding, submission, reason: "", changed: true };
  }

  function counselMitigation(proceeding) {
    const selected = proceeding.counsel.options.find((entry) => entry.id === proceeding.counsel.selectedOptionId);
    if (!selected) return 0;
    const specialty = selected.specialties.includes("custodyHearings") ? 3 : 0;
    const capacity = Math.max(0, (selected.proceduralSkill - selected.workload * 0.35) / 15);
    return specialty + capacity;
  }

  function resolveHearing(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.firstAppearance.status !== "inProgress") return { state, proceeding, changed: false };
    const at = Math.max(proceeding.firstAppearance.startedAt, finite(clock));
    const filed = proceeding.charges.filter((charge) => charge.status === "filed");
    const rejected = filed.filter((charge) => !charge.support.length);
    for (const charge of rejected) charge.status = "rejected";
    const remaining = filed.filter((charge) => charge.status === "filed");
    const violence = remaining.some((charge) => charge.typeId === "violentResistance");
    const escape = remaining.some((charge) => charge.typeId === "escapeCustody");
    const chargeWeight = remaining.reduce((total, charge) => total + charge.weight, 0);
    const supportWeight = remaining.reduce((total, charge) => total + Math.max(0, ...charge.support.map((support) => support.significanceRank)), 0);
    const riskScore = chargeWeight + supportWeight + (violence ? 8 : 0) + (escape ? 8 : 0);
    const submission = SUBMISSIONS.find((entry) => entry.id === proceeding.firstAppearance.submissionId) || SUBMISSIONS[0];
    const surrenderMitigation = proceeding.history.some((entry) => entry.action === "voluntarySurrender") ? 3 : 0;
    const mitigation = submission.mitigation + counselMitigation(proceeding) + surrenderMitigation + proceeding.court.judge.libertyPreference / 25;
    const adjusted = riskScore - mitigation + proceeding.court.judge.proceduralStrictness / 30 + (proceeding.firstAppearance.discretion - 0.5) * 2;
    let decision = "detained";
    if (adjusted <= 7 && submission.id === "recognizance") decision = "recognizance";
    else if (adjusted <= 15) decision = "conditionalRelease";
    else if (adjusted <= 24) decision = "securedBail";
    const reasons = [
      `${remaining.length} supported filed charge(s) contributed ${Math.round(chargeWeight)} severity points.`,
      `Cited support contributed ${Math.round(supportWeight)} evidentiary-risk points.`,
      `${submission.label}, counsel capacity, and judicial liberty preference supplied ${Math.round(mitigation)} mitigation points.`,
      violence ? "Saved violent-resistance history materially increased danger findings." : "No saved violent-resistance charge increased the danger finding.",
      "The saved judicial-discretion value resolved only the narrow remaining margin."
    ];
    proceeding.firstAppearance.status = "completed"; proceeding.firstAppearance.completedAt = at; proceeding.firstAppearance.decision = decision;
    proceeding.firstAppearance.riskScore = riskScore; proceeding.firstAppearance.mitigationScore = mitigation; proceeding.firstAppearance.reasons = reasons; proceeding.firstAppearance.rejectedChargeIds = rejected.map((charge) => charge.id);
    proceeding.release.orderedAt = at; proceeding.release.kind = decision;
    const conditions = [normalizeCondition({ kind: "appearAsOrdered", label: "Appear at every scheduled court event", imposedAt: at })];
    if (["conditionalRelease", "securedBail"].includes(decision)) conditions.push(normalizeCondition({ kind: "weeklyReporting", label: "Report weekly to pretrial supervision", imposedAt: at }));
    const animancy = remaining.find((charge) => charge.typeId === "prohibitedAnimancy" && charge.support.some((support) => support.significanceRank >= 3));
    if (animancy && decision !== "detained") conditions.push(normalizeCondition({ kind: "courtMagicSuppression", label: "Wear a court-ordered magic suppressor", physicallyEnforced: true, sourceChargeId: animancy.id, imposedAt: at }));
    proceeding.release.conditions = conditions;
    if (decision === "securedBail") {
      proceeding.status = "bailPending"; proceeding.release.status = "awaitingBail"; proceeding.release.escrowStatus = "due";
      proceeding.release.bailAmount = Math.max(500, Math.ceil((riskScore * 175) / 100) * 100);
    } else if (["recognizance", "conditionalRelease"].includes(decision)) {
      proceeding.status = "released"; proceeding.release.status = "released"; proceeding.release.escrowStatus = "none"; proceeding.release.releasedAt = at;
    } else {
      proceeding.status = "detained"; proceeding.release.status = "none";
    }
    proceeding.timeline.discoveryDueAt = at + 24 * HOUR; proceeding.timeline.nextHearingAt = at + 72 * HOUR;
    proceeding.updatedAt = at; proceeding.history.push({ at, action: "firstAppearanceResolved", summary: `The court ordered ${decision}; the saved reasons identify charge, evidence, mitigation, and discretion contributions.` });
    return { state, proceeding, decision, changed: true };
  }

  function payBail(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.release.status !== "awaitingBail" || proceeding.release.escrowStatus !== "due") return { state, proceeding, changed: false };
    const at = Math.max(proceeding.release.orderedAt, finite(clock));
    proceeding.release.status = "released"; proceeding.release.escrowStatus = "held"; proceeding.release.escrowPaidAt = at; proceeding.release.releasedAt = at; proceeding.status = "released";
    proceeding.history.push({ at, action: "bailPosted", summary: `${proceeding.release.bailAmount} entered refundable court escrow; it was not recorded as a fine.` });
    return { state, proceeding, changed: true };
  }

  function markReleased(candidate, proceedingId, transport, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.release.status !== "released") return { state, proceeding, changed: false };
    proceeding.release.transport = transport && typeof transport === "object" ? { ...transport } : null;
    proceeding.updatedAt = Math.max(proceeding.openedAt, finite(clock));
    proceeding.history.push({ at: proceeding.updatedAt, action: "physicallyReleased", summary: "Jail staff removed jail custody equipment and transferred the scientist to the recorded lawful release destination." });
    return { state, proceeding, changed: true };
  }

  function addEscapeCharge(state, proceeding, clock) {
    if (proceeding.charges.some((charge) => charge.typeId === "escapeCustody")) return;
    proceeding.charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "escapeCustody", status: "filed", filedAt: clock, publicProbableCause: "The municipal jail custody record reports a physical escape.", support: [{ id: `${proceeding.id}-escape-support`, kind: "jailCustody", sourceId: proceeding.raidId, label: "Saved municipal jail escape record", reliability: "strong", significanceRank: 4, traits: ["escaped custody"] }] }, proceeding.charges.length));
  }

  function markFugitive(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.fugitive.active) return { state, proceeding, changed: false };
    const at = Math.max(proceeding.openedAt, finite(clock)); addEscapeCharge(state, proceeding, at);
    proceeding.fugitive.active = true; proceeding.fugitive.escapedAt = at; proceeding.fugitive.benchWarrantStatus = "issued"; proceeding.status = "fugitive";
    if (proceeding.release.escrowStatus === "held") { proceeding.release.escrowStatus = "forfeited"; proceeding.release.status = "forfeited"; }
    proceeding.history.push({ at, action: "fugitiveStatus", summary: "Escape added a separately supported charge and issued a saved bench warrant; the criminal case continued." });
    return { state, proceeding, changed: true };
  }

  function markFailureToAppear(state, proceeding, clock) {
    if (proceeding.charges.some((charge) => charge.typeId === "failureToAppear")) return false;
    proceeding.charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "failureToAppear", status: "filed", filedAt: clock, publicProbableCause: "The defendant did not appear at the scheduled first appearance.", support: [{ id: `${proceeding.id}-fta-support`, kind: "courtRecord", sourceId: proceeding.id, label: "Saved missed court appearance", reliability: "strong", significanceRank: 3, traits: ["failure to appear"] }] }, proceeding.charges.length));
    proceeding.fugitive.failureToAppearAt = clock; proceeding.firstAppearance.status = "missed"; proceeding.history.push({ at: clock, action: "failureToAppear", summary: "The fugitive defendant missed a required appearance; the court record added a separate charge without pretending the defendant attended." }); return true;
  }

  function advance(candidate, clock = 0) {
    const state = normalizeState(candidate); let changes = 0;
    for (const proceeding of state.proceedings.filter((entry) => entry.status !== "resolved")) {
      const at = Math.max(proceeding.openedAt, finite(clock));
      if (proceeding.charges.some((charge) => charge.status === "proposed") && at >= proceeding.timeline.chargingAt) { fileCharges(proceeding, proceeding.timeline.chargingAt); changes += 1; }
      if (!proceeding.counsel.selectedOptionId && at >= proceeding.timeline.counselDeadline) {
        const publicOption = proceeding.counsel.options.find((entry) => entry.kind === "public");
        proceeding.counsel.selectedOptionId = publicOption.id; proceeding.counsel.selectedAt = proceeding.timeline.counselDeadline; proceeding.counsel.paid = true;
        proceeding.history.push({ at: proceeding.timeline.counselDeadline, action: "publicCounselAppointed", summary: `${publicOption.name} was automatically appointed when the counsel-selection deadline expired.` }); changes += 1;
      }
      if (["counselSelection", "chargingPending", "fugitive"].includes(proceeding.status) && at >= proceeding.timeline.firstAppearanceAt && proceeding.charges.some((charge) => charge.status === "filed")) {
        proceeding.firstAppearance.status = "ready"; proceeding.status = proceeding.fugitive.active ? "fugitive" : "firstAppearanceReady"; changes += 1;
      }
      if (proceeding.fugitive.active && proceeding.firstAppearance.status === "ready" && at >= proceeding.timeline.firstAppearanceAt) changes += markFailureToAppear(state, proceeding, at) ? 1 : 0;
      proceeding.updatedAt = at;
    }
    return { state, changes };
  }

  function nextEvent(candidate, clock = 0) {
    const at = finite(clock); const events = [];
    for (const proceeding of normalizeState(candidate).proceedings.filter((entry) => entry.status !== "resolved")) {
      if (proceeding.status === "chargingPending" && proceeding.timeline.chargingAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.chargingAt, kind: "charging", label: "Charges filed" });
      if (!proceeding.counsel.selectedOptionId && proceeding.timeline.counselDeadline >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.counselDeadline, kind: "counselDeadline", label: "Counsel appointment deadline" });
      if (!["completed", "missed"].includes(proceeding.firstAppearance.status) && proceeding.timeline.firstAppearanceAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.firstAppearanceAt, kind: "firstAppearance", label: "First appearance" });
    }
    return events.sort((left, right) => left.at - right.at || left.proceedingId.localeCompare(right.proceedingId))[0] || null;
  }

  return Object.freeze({
    VERSION, STATUSES, COUNSEL_KINDS, SUBMISSIONS, CHARGE_DEFS,
    defaultState, normalizeState, normalizeProceeding, open, current, selectCounsel, markCounselPaid,
    recordConference, hearingRequirements, beginHearing, resolveHearing, payBail, markReleased, markFugitive, advance, nextEvent
  });
}));
