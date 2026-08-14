(function attachHelixInvestigationCases(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixInvestigationCases = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixInvestigationCases() {
  "use strict";

  const VERSION = 1;
  const DAY = 86400;
  const CASE_STATUSES = Object.freeze(["open", "dormant", "closed", "referred"]);
  const ESCALATION_STAGES = Object.freeze(["monitoring", "inquiry", "formal", "priority"]);
  const STRENGTH_BANDS = Object.freeze([
    { id: "preliminary", label: "Preliminary", min: 0, pressure: 6 },
    { id: "supported", label: "Supported", min: 18, pressure: 12 },
    { id: "corroborated", label: "Corroborated", min: 32, pressure: 20 },
    { id: "compelling", label: "Compelling", min: 50, pressure: 28 }
  ]);
  const THEORY_DEFS = Object.freeze({
    "reporting-noncompliance": {
      id: "reporting-noncompliance", institutionId: "commercial-registry", label: "Reporting noncompliance",
      publicConcern: "Compliance with required company reporting",
      leads: [
        { kind: "verifyFilingHistory", label: "Verify the company's filing history" },
        { kind: "compareDeclaredRecords", label: "Compare declarations with available registry records" }
      ]
    },
    "site-discharge": {
      id: "site-discharge", institutionId: "environmental-health", label: "Unusual site discharge",
      publicConcern: "Reported exterior discharge associated with the facility",
      leads: [
        { kind: "corroborateObservation", label: "Corroborate the reported discharge" },
        { kind: "attributeSite", label: "Determine whether the signal can be attributed to the site" }
      ]
    },
    "improper-biological-disposal": {
      id: "improper-biological-disposal", institutionId: "environmental-health", label: "Improper biological disposal",
      publicConcern: "Reported biological material near the facility",
      leads: [
        { kind: "corroborateObservation", label: "Corroborate the biological-material report" },
        { kind: "attributeSite", label: "Determine whether the material can be attributed to the site" }
      ]
    },
    "unsafe-public-conditions": {
      id: "unsafe-public-conditions", institutionId: "environmental-health", label: "Unsafe public conditions",
      publicConcern: "Reported unusual conditions in a public-facing area",
      leads: [
        { kind: "corroborateObservation", label: "Corroborate the public-area observation" },
        { kind: "attributeSite", label: "Confirm the responsible operating site" }
      ]
    },
    "off-books-commerce": {
      id: "off-books-commerce", institutionId: "law-enforcement", label: "Off-books commercial activity",
      publicConcern: "Suspected off-books commercial activity",
      leads: [
        { kind: "identifyIntermediary", label: "Identify the commercial intermediary" },
        { kind: "linkTransactions", label: "Determine whether reported handoffs share a source" }
      ]
    }
  });

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function uniqueIds(candidate) {
    return [...new Set((Array.isArray(candidate) ? candidate : []).map(cleanId).filter(Boolean))];
  }

  function unitRoll(seed) {
    const text = String(seed || "investigation-case");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash += hash << 13; hash ^= hash >>> 7;
    hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  }

  function theoryForSignal(signal) {
    if (signal.institutionId === "commercial-registry") return THEORY_DEFS["reporting-noncompliance"];
    if (signal.institutionId === "law-enforcement") return THEORY_DEFS["off-books-commerce"];
    if (signal.evidenceType === "dumpedBiologicalRemains") return THEORY_DEFS["improper-biological-disposal"];
    if (["exteriorDrainageTrace", "exteriorExhaustTrace"].includes(signal.evidenceType)
      || ["drainage", "exhaust"].includes(signal.channel)) return THEORY_DEFS["site-discharge"];
    return THEORY_DEFS["unsafe-public-conditions"];
  }

  function normalizeIntake(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const firstReceivedAt = Math.max(0, finite(source.firstReceivedAt));
    return {
      id: cleanId(source.id) || `case-intake-${index + 1}`,
      institutionId: cleanId(source.institutionId), theoryId: cleanId(source.theoryId),
      reportIds: uniqueIds(source.reportIds), correlationIds: uniqueIds(source.correlationIds),
      firstReceivedAt, lastReceivedAt: Math.max(firstReceivedAt, finite(source.lastReceivedAt, firstReceivedAt)),
      reviewAt: source.reviewAt == null ? null : Math.max(firstReceivedAt, finite(source.reviewAt, firstReceivedAt)),
      status: ["pending", "insufficient", "opened"].includes(source.status) ? source.status : "pending",
      caseId: cleanId(source.caseId), reviewCount: Math.max(0, Math.floor(finite(source.reviewCount)))
    };
  }

  function normalizeAuthorityLink(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `authority-evidence-${index + 1}`,
      evidenceId: cleanId(source.evidenceId), reportIds: uniqueIds(source.reportIds),
      summary: String(source.summary || "Reported external signal").trim(),
      firstKnownAt: Math.max(0, finite(source.firstKnownAt)),
      reliability: ["weak", "credible", "strong"].includes(source.reliability) ? source.reliability : "credible",
      specificity: ["generic", "siteLinked", "identityLinked"].includes(source.specificity) ? source.specificity : "generic",
      significanceRank: clamp(Math.floor(finite(source.significanceRank, 1)), 0, 4)
    };
  }

  function normalizeLead(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const createdAt = Math.max(0, finite(source.createdAt));
    return {
      id: cleanId(source.id) || `case-lead-${index + 1}`, kind: cleanId(source.kind),
      label: String(source.label || "Unresolved institutional lead").trim(), createdAt,
      updatedAt: Math.max(createdAt, finite(source.updatedAt, createdAt)),
      dueAt: Math.max(createdAt, finite(source.dueAt, createdAt)), deadlineId: cleanId(source.deadlineId),
      status: ["open", "resolved", "stalled"].includes(source.status) ? source.status : "open",
      resolvedAt: source.resolvedAt == null ? null : Math.max(createdAt, finite(source.resolvedAt, createdAt)),
      reportIds: uniqueIds(source.reportIds), resolution: String(source.resolution || "").trim()
    };
  }

  function normalizeDeadline(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const createdAt = Math.max(0, finite(source.createdAt));
    return {
      id: cleanId(source.id) || `case-deadline-${index + 1}`, kind: cleanId(source.kind) || "leadReview",
      targetId: cleanId(source.targetId), createdAt, dueAt: Math.max(createdAt, finite(source.dueAt, createdAt)),
      status: ["pending", "met", "missed", "superseded"].includes(source.status) ? source.status : "pending",
      resolvedAt: source.resolvedAt == null ? null : Math.max(createdAt, finite(source.resolvedAt, createdAt)),
      visibility: source.visibility === "disclosed" ? "disclosed" : "hidden",
      history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({
        at: Math.max(createdAt, finite(entry?.at, createdAt)), action: cleanId(entry?.action) || "created",
        summary: String(entry?.summary || "Deadline recorded.").trim()
      })).sort((a, b) => a.at - b.at)
    };
  }

  function normalizeContact(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `authority-contact-${index + 1}`, at: Math.max(0, finite(source.at)),
      direction: source.direction === "outgoing" ? "outgoing" : "incoming",
      kind: cleanId(source.kind) || "notice", visibility: source.visibility === "disclosed" ? "disclosed" : "hidden",
      summary: String(source.summary || "Authority contact recorded.").trim()
    };
  }

  function normalizeDisclosure(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      state: source.state === "disclosed" ? "disclosed" : "hidden",
      disclosedAt: source.disclosedAt == null ? null : Math.max(0, finite(source.disclosedAt)),
      statedConcern: String(source.statedConcern || "").trim(),
      knownEvidenceLinkIds: uniqueIds(source.knownEvidenceLinkIds), knownLeadIds: uniqueIds(source.knownLeadIds),
      knownDeadlineIds: uniqueIds(source.knownDeadlineIds), knownContactIds: uniqueIds(source.knownContactIds),
      strengthDisclosed: Boolean(source.strengthDisclosed)
    };
  }

  function strengthBandForScore(score) {
    const value = Math.max(0, finite(score));
    for (let index = STRENGTH_BANDS.length - 1; index >= 0; index -= 1) {
      if (value >= STRENGTH_BANDS[index].min) return STRENGTH_BANDS[index];
    }
    return STRENGTH_BANDS[0];
  }

  function normalizeCase(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const openedAt = Math.max(0, finite(source.openedAt));
    const score = Math.max(0, finite(source.strength?.score));
    const band = strengthBandForScore(score);
    return {
      id: cleanId(source.id) || `authority-case-${index + 1}`, docket: String(source.docket || "CASE-0000").trim(),
      institutionId: cleanId(source.institutionId), theoryId: cleanId(source.theoryId),
      theoryLabel: String(source.theoryLabel || "Institutional inquiry").trim(),
      publicConcern: String(source.publicConcern || "An institutional concern").trim(),
      status: CASE_STATUSES.includes(source.status) ? source.status : "open",
      escalationStage: ESCALATION_STAGES.includes(source.escalationStage) ? source.escalationStage : "monitoring",
      openedAt, updatedAt: Math.max(openedAt, finite(source.updatedAt, openedAt)),
      reportIds: uniqueIds(source.reportIds), correlationIds: uniqueIds(source.correlationIds),
      authorityEvidence: (Array.isArray(source.authorityEvidence) ? source.authorityEvidence : []).map(normalizeAuthorityLink),
      leads: (Array.isArray(source.leads) ? source.leads : []).map(normalizeLead),
      deadlines: (Array.isArray(source.deadlines) ? source.deadlines : []).map(normalizeDeadline),
      contactHistory: (Array.isArray(source.contactHistory) ? source.contactHistory : []).map(normalizeContact),
      disclosure: normalizeDisclosure(source.disclosure),
      strength: { score, bandId: band.id },
      history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({
        at: Math.max(openedAt, finite(entry?.at, openedAt)), action: cleanId(entry?.action) || "updated",
        summary: String(entry?.summary || "Case updated.").trim()
      })).sort((a, b) => a.at - b.at)
    };
  }

  function defaultState() {
    return {
      version: VERSION, intakes: [], cases: [],
      nextIntakeNumber: 1, nextCaseNumber: 1, nextLeadNumber: 1,
      nextDeadlineNumber: 1, nextContactNumber: 1, nextAuthorityEvidenceNumber: 1
    };
  }

  function nextNumber(records, prefix, candidate) {
    return Math.max(Math.floor(finite(candidate, 1)), records.reduce((max, record) => {
      const match = String(record.id || "").match(new RegExp(`${prefix}(\\d+)$`));
      return Math.max(max, match ? Number(match[1]) + 1 : 1);
    }, 1));
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const intakes = (Array.isArray(source.intakes) ? source.intakes : []).map(normalizeIntake);
    const cases = (Array.isArray(source.cases) ? source.cases : []).map(normalizeCase);
    const leads = cases.flatMap((entry) => entry.leads);
    const deadlines = cases.flatMap((entry) => entry.deadlines);
    const contacts = cases.flatMap((entry) => entry.contactHistory);
    const evidence = cases.flatMap((entry) => entry.authorityEvidence);
    return {
      version: VERSION, intakes, cases,
      nextIntakeNumber: nextNumber(intakes, "case-intake-", source.nextIntakeNumber),
      nextCaseNumber: nextNumber(cases, "authority-case-", source.nextCaseNumber),
      nextLeadNumber: nextNumber(leads, "case-lead-", source.nextLeadNumber),
      nextDeadlineNumber: nextNumber(deadlines, "case-deadline-", source.nextDeadlineNumber),
      nextContactNumber: nextNumber(contacts, "authority-contact-", source.nextContactNumber),
      nextAuthorityEvidenceNumber: nextNumber(evidence, "authority-evidence-", source.nextAuthorityEvidenceNumber)
    };
  }

  function reportScore(report) {
    const reliability = { weak: 3, credible: 6, strong: 9 }[report.reliability] || 3;
    const specificity = { generic: 0, siteLinked: 3, identityLinked: 6 }[report.specificity] || 0;
    return reliability + specificity + clamp(report.significanceRank, 0, 4) * 2;
  }

  function escalationForBand(bandId) {
    return { preliminary: "monitoring", supported: "inquiry", corroborated: "formal", compelling: "priority" }[bandId] || "monitoring";
  }

  function docketPrefix(institutionId) {
    return { "environmental-health": "EH", "commercial-registry": "CR", "law-enforcement": "LE" }[institutionId] || "AU";
  }

  function intakeDelay(seed, key, institutionId) {
    if (institutionId === "commercial-registry") return 0;
    return Math.floor((2 + unitRoll(`${seed}:${key}:intake-delay`) * 10) * 3600);
  }

  function leadDelay(seed, caseId, kind) {
    return Math.floor((2 + unitRoll(`${seed}:${caseId}:${kind}:lead-delay`) * 3) * DAY);
  }

  function groupCorrelations(correlations, reportIds) {
    const ids = new Set(reportIds);
    return correlations.filter((correlation) => correlation.status === "active"
      && correlation.reportIds.filter((id) => ids.has(id)).length >= 2);
  }

  function openingThresholdMet(reports, correlations, theory) {
    if (reports.some((report) => report.reliability === "strong" && report.specificity === "identityLinked" && report.significanceRank >= 2)) return true;
    if (theory.id === "reporting-noncompliance" && reports.some((report) => report.specificity === "identityLinked" && report.significanceRank >= 2)) return true;
    if (correlations.length) return true;
    const independentReports = reports.filter((report, index, all) => all.findIndex((entry) => entry.evidenceId === report.evidenceId && entry.sourceId === report.sourceId) === index);
    return independentReports.length >= 2 && independentReports.reduce((total, report) => total + reportScore(report), 0) >= 20;
  }

  function linkAuthorityEvidence(state, authorityCase, reports) {
    for (const report of reports) {
      let link = authorityCase.authorityEvidence.find((entry) => entry.evidenceId === report.evidenceId);
      if (!link) {
        link = normalizeAuthorityLink({
          id: `authority-evidence-${state.nextAuthorityEvidenceNumber++}`, evidenceId: report.evidenceId,
          reportIds: [report.id], summary: report.summary, firstKnownAt: report.reportedAt,
          reliability: report.reliability, specificity: report.specificity, significanceRank: report.significanceRank
        }, authorityCase.authorityEvidence.length);
        authorityCase.authorityEvidence.push(link);
      } else {
        link.reportIds = uniqueIds([...link.reportIds, report.id]);
        if (reportScore(report) > reportScore(link)) {
          link.summary = report.summary;
          link.reliability = report.reliability;
          link.specificity = report.specificity;
          link.significanceRank = report.significanceRank;
        }
      }
    }
  }

  function createLeadsAndDeadlines(state, authorityCase, theory, reports, seed, clock) {
    for (const definition of theory.leads) {
      const leadId = `case-lead-${state.nextLeadNumber++}`;
      const deadlineId = `case-deadline-${state.nextDeadlineNumber++}`;
      const dueAt = clock + leadDelay(seed, authorityCase.id, definition.kind);
      authorityCase.leads.push(normalizeLead({
        id: leadId, kind: definition.kind, label: definition.label, createdAt: clock, updatedAt: clock,
        dueAt, deadlineId, status: "open", reportIds: reports.map((report) => report.id)
      }, authorityCase.leads.length));
      authorityCase.deadlines.push(normalizeDeadline({
        id: deadlineId, kind: "leadReview", targetId: leadId, createdAt: clock, dueAt,
        status: "pending", visibility: "hidden",
        history: [{ at: clock, action: "created", summary: "Institutional lead review scheduled." }]
      }, authorityCase.deadlines.length));
    }
  }

  function caseStrength(authorityCase, reports, correlations) {
    const linkedReports = reports.filter((report) => authorityCase.reportIds.includes(report.id) && report.status === "active");
    const linkedCorrelations = correlations.filter((entry) => authorityCase.correlationIds.includes(entry.id) && entry.status === "active");
    return linkedReports.reduce((total, report) => total + reportScore(report), 0)
      + linkedCorrelations.length * 6
      + authorityCase.leads.filter((lead) => lead.status === "resolved").length * 4;
  }

  function shouldDisclose(authorityCase, reports) {
    if (authorityCase.institutionId === "commercial-registry") return true;
    if (authorityCase.institutionId === "law-enforcement") return false;
    return authorityCase.strength.bandId === "corroborated" || authorityCase.strength.bandId === "compelling"
      || reports.some((report) => authorityCase.reportIds.includes(report.id) && report.reliability === "strong" && report.specificity === "identityLinked");
  }

  function discloseCase(state, authorityCase, clock) {
    if (authorityCase.disclosure.state === "disclosed") return false;
    const contact = normalizeContact({
      id: `authority-contact-${state.nextContactNumber++}`, at: clock, direction: "incoming", kind: "informationalNotice",
      visibility: "disclosed", summary: `${authorityCase.docket}: ${authorityCase.publicConcern}. No response has been requested at this stage.`
    }, authorityCase.contactHistory.length);
    authorityCase.contactHistory.push(contact);
    authorityCase.disclosure = normalizeDisclosure({
      state: "disclosed", disclosedAt: clock, statedConcern: authorityCase.publicConcern,
      knownEvidenceLinkIds: authorityCase.authorityEvidence.map((entry) => entry.id), knownContactIds: [contact.id]
    });
    authorityCase.history.push({ at: clock, action: "disclosed", summary: "The institution issued an informational notice." });
    return true;
  }

  function createCase(state, intake, theory, reports, correlations, seed, clock) {
    const number = state.nextCaseNumber++;
    const id = `authority-case-${number}`;
    const authorityCase = normalizeCase({
      id, docket: `${docketPrefix(theory.institutionId)}-${String(number).padStart(4, "0")}`,
      institutionId: theory.institutionId, theoryId: theory.id, theoryLabel: theory.label,
      publicConcern: theory.publicConcern, status: "open", escalationStage: "monitoring",
      openedAt: clock, updatedAt: clock, reportIds: reports.map((report) => report.id),
      correlationIds: correlations.map((entry) => entry.id), authorityEvidence: [], leads: [], deadlines: [],
      contactHistory: [], disclosure: { state: "hidden" }, strength: { score: 0 },
      history: [{ at: clock, action: "opened", summary: `Institutional case opened under the ${theory.label.toLowerCase()} theory.` }]
    }, state.cases.length);
    linkAuthorityEvidence(state, authorityCase, reports);
    createLeadsAndDeadlines(state, authorityCase, theory, reports, seed, clock);
    authorityCase.strength.score = caseStrength(authorityCase, reports, correlations);
    authorityCase.strength.bandId = strengthBandForScore(authorityCase.strength.score).id;
    authorityCase.escalationStage = escalationForBand(authorityCase.strength.bandId);
    state.cases.push(authorityCase);
    intake.status = "opened";
    intake.caseId = authorityCase.id;
    intake.reviewAt = null;
    return authorityCase;
  }

  function leadCanResolve(lead, authorityCase, reports, correlations) {
    const linked = reports.filter((report) => authorityCase.reportIds.includes(report.id) && report.status === "active");
    const distinctEvidence = new Set(linked.map((report) => report.evidenceId).filter(Boolean)).size;
    if (lead.kind === "verifyFilingHistory") return linked.some((report) => report.specificity === "identityLinked");
    if (lead.kind === "compareDeclaredRecords") return linked.length >= 2;
    if (lead.kind === "corroborateObservation") return distinctEvidence >= 2 || correlations.some((entry) => authorityCase.correlationIds.includes(entry.id));
    if (lead.kind === "attributeSite") return linked.some((report) => ["siteLinked", "identityLinked"].includes(report.specificity));
    if (lead.kind === "identifyIntermediary") return linked.some((report) => report.reliability === "strong" && report.specificity !== "generic");
    if (lead.kind === "linkTransactions") return distinctEvidence >= 2 || correlations.some((entry) => authorityCase.correlationIds.includes(entry.id));
    return false;
  }

  function processDeadlines(authorityCase, reports, correlations, clock) {
    let changed = false;
    for (const lead of authorityCase.leads) {
      if (lead.status === "stalled" && leadCanResolve(lead, authorityCase, reports, correlations)) {
        lead.status = "resolved";
        lead.updatedAt = clock;
        lead.resolvedAt = clock;
        lead.resolution = "Later institutional information satisfied this previously stalled lead.";
        authorityCase.history.push({ at: clock, action: "leadResolved", summary: `${lead.label}: ${lead.resolution}` });
        changed = true;
        continue;
      }
      if (lead.status !== "open" || lead.dueAt > clock) continue;
      const deadline = authorityCase.deadlines.find((entry) => entry.id === lead.deadlineId);
      const resolved = leadCanResolve(lead, authorityCase, reports, correlations);
      lead.status = resolved ? "resolved" : "stalled";
      lead.updatedAt = clock;
      lead.resolvedAt = resolved ? clock : null;
      lead.resolution = resolved ? "Available institutional information satisfied this lead." : "The review deadline passed without sufficient corroboration.";
      if (deadline) {
        deadline.status = resolved ? "met" : "missed";
        deadline.resolvedAt = clock;
        deadline.history.push({ at: clock, action: deadline.status, summary: lead.resolution });
      }
      authorityCase.history.push({ at: clock, action: resolved ? "leadResolved" : "leadStalled", summary: `${lead.label}: ${lead.resolution}` });
      changed = true;
    }
    return changed;
  }

  function update(candidate, context = {}) {
    const state = normalizeState(candidate);
    const clock = Math.max(0, finite(context.clock));
    const seed = String(context.seed || "site");
    const reports = (Array.isArray(context.reports) ? context.reports : []).filter((entry) => entry?.status !== "resolved").map((entry) => ({ ...entry, theory: theoryForSignal(entry) }));
    const correlations = Array.isArray(context.correlations) ? context.correlations : [];
    const openedCaseIds = [];
    const disclosedCaseIds = [];
    const changedCaseIds = [];
    const processedCaseIds = new Set();

    const groups = new Map();
    for (const report of reports) {
      const key = `${report.institutionId}:${report.theory.id}`;
      if (!groups.has(key)) groups.set(key, { key, theory: report.theory, reports: [] });
      groups.get(key).reports.push(report);
    }

    for (const group of groups.values()) {
      const correlationRows = groupCorrelations(correlations, group.reports.map((report) => report.id));
      let authorityCase = state.cases.find((entry) => entry.institutionId === group.theory.institutionId
        && entry.theoryId === group.theory.id && !["closed", "referred"].includes(entry.status));
      let intake = authorityCase
        ? state.intakes.find((entry) => entry.caseId === authorityCase.id)
        : state.intakes.find((entry) => entry.institutionId === group.theory.institutionId && entry.theoryId === group.theory.id && entry.status !== "opened");
      if (!intake) {
        intake = normalizeIntake({
          id: `case-intake-${state.nextIntakeNumber++}`, institutionId: group.theory.institutionId,
          theoryId: group.theory.id, reportIds: [], correlationIds: [], firstReceivedAt: Math.min(...group.reports.map((report) => report.reportedAt)),
          status: "pending"
        }, state.intakes.length);
        intake.reviewAt = intake.firstReceivedAt + intakeDelay(seed, group.key, intake.institutionId);
        state.intakes.push(intake);
      }
      const previousReportCount = intake.reportIds.length;
      intake.reportIds = uniqueIds([...intake.reportIds, ...group.reports.map((report) => report.id)]);
      intake.correlationIds = uniqueIds([...intake.correlationIds, ...correlationRows.map((entry) => entry.id)]);
      intake.lastReceivedAt = Math.max(intake.lastReceivedAt, ...group.reports.map((report) => report.reportedAt));
      if (intake.status === "insufficient" && intake.reportIds.length > previousReportCount) {
        intake.status = "pending";
        intake.reviewAt = clock + intakeDelay(seed, `${group.key}:${intake.reportIds.length}`, intake.institutionId);
      }

      if (!authorityCase && intake.status === "pending" && intake.reviewAt <= clock) {
        intake.reviewCount += 1;
        if (openingThresholdMet(group.reports, correlationRows, group.theory)) {
          authorityCase = createCase(state, intake, group.theory, group.reports, correlationRows, seed, clock);
          openedCaseIds.push(authorityCase.id);
        } else {
          intake.status = "insufficient";
          intake.reviewAt = null;
        }
      }
      if (!authorityCase) continue;
      processedCaseIds.add(authorityCase.id);

      const priorReportCount = authorityCase.reportIds.length;
      authorityCase.reportIds = uniqueIds([...authorityCase.reportIds, ...group.reports.map((report) => report.id)]);
      authorityCase.correlationIds = uniqueIds([...authorityCase.correlationIds, ...correlationRows.map((entry) => entry.id)]);
      linkAuthorityEvidence(state, authorityCase, group.reports);
      const deadlinesChanged = processDeadlines(authorityCase, reports, correlations, clock);
      const beforeBand = authorityCase.strength.bandId;
      const beforeEscalation = authorityCase.escalationStage;
      authorityCase.strength.score = caseStrength(authorityCase, reports, correlations);
      authorityCase.strength.bandId = strengthBandForScore(authorityCase.strength.score).id;
      authorityCase.escalationStage = escalationForBand(authorityCase.strength.bandId);
      if (!reports.some((report) => authorityCase.reportIds.includes(report.id))) authorityCase.status = "dormant";
      else if (authorityCase.status === "dormant") authorityCase.status = "open";
      const materiallyChanged = priorReportCount !== authorityCase.reportIds.length || deadlinesChanged
        || beforeBand !== authorityCase.strength.bandId || beforeEscalation !== authorityCase.escalationStage;
      if (materiallyChanged) {
        authorityCase.updatedAt = clock;
        authorityCase.history.push({ at: clock, action: "reviewed", summary: `Case reviewed at ${strengthBandForScore(authorityCase.strength.score).label.toLowerCase()} strength.` });
        changedCaseIds.push(authorityCase.id);
      }
      if (shouldDisclose(authorityCase, reports) && discloseCase(state, authorityCase, clock)) {
        disclosedCaseIds.push(authorityCase.id);
      }
      if (authorityCase.disclosure.state === "disclosed") {
        authorityCase.disclosure.knownEvidenceLinkIds = uniqueIds([...authorityCase.disclosure.knownEvidenceLinkIds, ...authorityCase.authorityEvidence.map((entry) => entry.id)]);
      }
    }
    for (const authorityCase of state.cases.filter((entry) => !processedCaseIds.has(entry.id) && !["closed", "referred"].includes(entry.status))) {
      const deadlinesChanged = processDeadlines(authorityCase, reports, correlations, clock);
      const beforeBand = authorityCase.strength.bandId;
      authorityCase.strength.score = caseStrength(authorityCase, reports, correlations);
      authorityCase.strength.bandId = strengthBandForScore(authorityCase.strength.score).id;
      authorityCase.escalationStage = escalationForBand(authorityCase.strength.bandId);
      authorityCase.status = "dormant";
      if (deadlinesChanged || beforeBand !== authorityCase.strength.bandId) {
        authorityCase.updatedAt = clock;
        authorityCase.history.push({ at: clock, action: "dormant", summary: "No active institutional report currently supports further case work." });
        changedCaseIds.push(authorityCase.id);
      }
    }
    return { state, openedCaseIds, disclosedCaseIds, changedCaseIds: uniqueIds(changedCaseIds) };
  }

  function casePressure(candidate) {
    const state = normalizeState(candidate);
    return clamp(Math.round(state.cases.reduce((total, authorityCase) => {
      if (["closed"].includes(authorityCase.status)) return total;
      if (authorityCase.status === "dormant") return total + 3;
      const band = STRENGTH_BANDS.find((entry) => entry.id === authorityCase.strength.bandId) || STRENGTH_BANDS[0];
      return total + band.pressure;
    }, 0)), 0, 60);
  }

  function visibleCases(candidate) {
    return normalizeState(candidate).cases.filter((entry) => entry.disclosure.state === "disclosed");
  }

  function nextEvent(candidate, clock) {
    const state = normalizeState(candidate);
    const now = Math.max(0, finite(clock));
    const events = [
      ...state.intakes.filter((entry) => entry.status === "pending" && entry.reviewAt != null && entry.reviewAt >= now)
        .map((entry) => ({ time: entry.reviewAt, type: "caseIntake", id: entry.id, label: "Institutional intake review" })),
      ...state.cases.flatMap((entry) => entry.deadlines.filter((deadline) => deadline.status === "pending" && deadline.dueAt >= now)
        .map((deadline) => ({ time: deadline.dueAt, type: "caseReview", id: deadline.id, label: "Authority lead review" })))
    ];
    return events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))[0] || null;
  }

  return {
    VERSION, DAY, CASE_STATUSES, ESCALATION_STAGES, STRENGTH_BANDS, THEORY_DEFS,
    cleanId, unitRoll, theoryForSignal, normalizeIntake, normalizeLead, normalizeDeadline,
    normalizeContact, normalizeDisclosure, normalizeCase, defaultState, normalizeState,
    reportScore, strengthBandForScore, update, casePressure, visibleCases, nextEvent
  };
}));
