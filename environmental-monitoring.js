(function initEnvironmentalMonitoring(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixEnvironmentalMonitoring = api;
})(typeof window !== "undefined" ? window : globalThis, function createEnvironmentalMonitoringApi() {
  "use strict";

  const MEDIA = Object.freeze({
    surface: Object.freeze({ id: "surface", label: "surface residue", method: "visual", thresholds: [0.5, 3, 8, 20] }),
    odor: Object.freeze({ id: "odor", label: "odor plume", method: "odor", thresholds: [5, 20, 50, 80] }),
    drainage: Object.freeze({ id: "drainage", label: "drainage trace", method: "sampling", thresholds: [0.25, 2, 7, 18] }),
    airborne: Object.freeze({ id: "airborne", label: "airborne trace", method: "airSampling", thresholds: [0.25, 2, 7, 18] }),
    offsite: Object.freeze({ id: "offsite", label: "off-site receptor trace", method: "receptorSampling", thresholds: [1, 5, 15, 40] })
  });
  const BAND_LABELS = Object.freeze(["none", "trace", "small", "moderate", "large"]);
  const SAMPLE_METHODS = Object.freeze({
    surfaceSwab: Object.freeze({ id: "surfaceSwab", label: "Surface residue swab", medium: "surface", knowledgeKey: "surfaceKnown" }),
    runoffSample: Object.freeze({ id: "runoffSample", label: "Runoff sample", medium: "drainage", knowledgeKey: "runoffKnown" }),
    soilCore: Object.freeze({ id: "soilCore", label: "Shallow soil core", medium: "subsurface", knowledgeKey: "subsurfaceKnown" }),
    airVial: Object.freeze({ id: "airVial", label: "Air vial", medium: "airborne", knowledgeKey: "odorKnown" })
  });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value, minimum))); }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return null;
    return { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) };
  }
  function contextDigest(context) { return String(context?.digest || context?.contextDigest || ""); }
  function mediumAmount(record, mediumId) {
    if (mediumId === "odor") return Math.max(0, finite(record?.odorIndex));
    return Math.max(0, finite(record?.media?.[mediumId]));
  }
  function bandRank(mediumId, amount) {
    const definition = MEDIA[mediumId];
    if (!definition) return 0;
    let rank = 0;
    for (const threshold of definition.thresholds) if (amount >= threshold) rank += 1;
    return rank;
  }
  function bandLabel(mediumId, amount) { return BAND_LABELS[bandRank(mediumId, amount)] || BAND_LABELS.at(-1); }
  function hazardousRecord(record) {
    const tags = new Set((record?.tags || []).map((entry) => String(entry || "").toLowerCase()));
    return ["hazard", "hazardous", "toxic", "corrosive", "reactive", "contaminated"].some((tag) => tags.has(tag));
  }

  function sourceProfile(context, mediumId) {
    const distanceBand = String(context?.location?.distanceBand || "remoteWilderness");
    const outletKind = String(context?.drainage?.outletKind || context?.surfaceExposure?.drainage?.outletKind || "");
    const activity = distanceBand === "cityDistrict" ? 1 : distanceBand === "protectedApproaches" ? 0.58 : 0.2;
    if (mediumId === "drainage" || mediumId === "offsite") {
      const monitored = outletKind === "roadDrain";
      const maintained = outletKind === "drainageDitch";
      return {
        sourceId: monitored ? "environmental-monitor" : maintained ? "nearby-observer" : "environmental-monitor",
        channel: mediumId === "offsite" ? "downstreamReceptor" : "drainage",
        detectionBase: monitored ? 0.56 : maintained ? 0.3 : 0.13,
        reportChance: monitored ? 1 : 0.76,
        reliability: monitored ? "strong" : "credible",
        specificity: monitored || maintained ? "siteLinked" : "generic",
        reportDelaySeconds: monitored ? 0 : 6 * 3600,
        sourceLabel: monitored ? "fixed drainage monitoring" : maintained ? "drainage maintenance activity" : "periodic receptor sampling"
      };
    }
    if (mediumId === "airborne") {
      return {
        sourceId: "environmental-monitor", channel: "airSampling", detectionBase: 0.16 + activity * 0.2,
        reportChance: 0.88, reliability: "credible", specificity: distanceBand === "remoteWilderness" ? "generic" : "siteLinked",
        reportDelaySeconds: 3 * 3600, sourceLabel: "periodic air monitoring"
      };
    }
    return {
      sourceId: "nearby-observer", channel: mediumId === "odor" ? "odor" : "exterior",
      detectionBase: (mediumId === "odor" ? 0.18 : 0.12) + activity * (mediumId === "odor" ? 0.32 : 0.38),
      reportChance: mediumId === "odor" ? 0.52 : 0.62,
      reliability: "weak", specificity: "siteLinked", reportDelaySeconds: 8 * 3600,
      sourceLabel: distanceBand === "cityDistrict" ? "nearby public activity" : distanceBand === "protectedApproaches" ? "route and service activity" : "occasional nearby activity"
    };
  }

  function normalizeMilestone(candidate, index = 0) {
    const mediumId = MEDIA[candidate?.mediumId] ? candidate.mediumId : "surface";
    const bandRankValue = Math.max(1, Math.min(4, Math.floor(finite(candidate?.bandRank, 1))));
    return {
      id: cleanId(candidate?.id) || `environmental-milestone-${index + 1}`,
      key: String(candidate?.key || ""), exposureRecordId: cleanId(candidate?.exposureRecordId),
      mediumId, bandRank: bandRankValue, band: BAND_LABELS[bandRankValue],
      sourceId: cleanId(candidate?.sourceId), sourceLabel: String(candidate?.sourceLabel || "external observation source"),
      channel: cleanId(candidate?.channel), method: cleanId(candidate?.method) || MEDIA[mediumId].method,
      receiverLabel: String(candidate?.receiverLabel || ""), createdAt: Math.max(0, finite(candidate?.createdAt)),
      detectionChance: clamp(candidate?.detectionChance, 0, 1), reportChance: clamp(candidate?.reportChance, 0, 1),
      reportDelaySeconds: Math.max(0, finite(candidate?.reportDelaySeconds)),
      reliability: ["weak", "credible", "strong"].includes(candidate?.reliability) ? candidate.reliability : "credible",
      specificity: ["generic", "siteLinked", "identityLinked"].includes(candidate?.specificity) ? candidate.specificity : "generic",
      hazardous: Boolean(candidate?.hazardous), evidenceId: cleanId(candidate?.evidenceId), externalExposureId: cleanId(candidate?.externalExposureId),
      reportId: cleanId(candidate?.reportId), outcome: ["pending", "missed", "observed", "reported"].includes(candidate?.outcome) ? candidate.outcome : "pending",
      knowledge: ["hidden", "inferred", "known"].includes(candidate?.knowledge) ? candidate.knowledge : "hidden"
    };
  }
  function defaultState(context = null) {
    return { contextDigest: contextDigest(context), milestones: [], highWater: {}, nextMilestoneNumber: 1, lastScannedAt: 0 };
  }
  function normalizeState(candidate, context = null) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const milestones = (Array.isArray(source.milestones) ? source.milestones : []).map(normalizeMilestone);
    const highWater = {};
    for (const [key, value] of Object.entries(source.highWater || {})) {
      const clean = String(key || "").trim();
      if (clean) highWater[clean] = Math.max(0, Math.min(4, Math.floor(finite(value))));
    }
    for (const milestone of milestones) highWater[`${milestone.exposureRecordId}:${milestone.mediumId}`] = Math.max(highWater[`${milestone.exposureRecordId}:${milestone.mediumId}`] || 0, milestone.bandRank);
    const nextFromIds = milestones.reduce((maximum, entry) => {
      const match = entry.id.match(/environmental-milestone-(\d+)$/);
      return Math.max(maximum, match ? Number(match[1]) + 1 : 1);
    }, 1);
    return {
      contextDigest: contextDigest(context) || String(source.contextDigest || ""), milestones, highWater,
      nextMilestoneNumber: Math.max(nextFromIds, Math.floor(finite(source.nextMilestoneNumber, 1))),
      lastScannedAt: Math.max(0, finite(source.lastScannedAt))
    };
  }

  function monitoredMedia(record, context) {
    const result = ["surface", "odor", "drainage", "airborne"];
    const outletKind = String(context?.drainage?.outletKind || "");
    if (outletKind && outletKind !== "groundSwale") result.push("offsite");
    return result.filter((mediumId) => mediumAmount(record, mediumId) > 0);
  }
  function scan(candidate, exposureState, context, clock = 0) {
    const state = normalizeState(candidate, context);
    const now = Math.max(state.lastScannedAt, finite(clock));
    const created = [];
    for (const record of exposureState?.records || []) {
      if (!record?.id) continue;
      for (const mediumId of monitoredMedia(record, exposureState || context || {})) {
        const amount = mediumAmount(record, mediumId);
        const rank = bandRank(mediumId, amount);
        const waterKey = `${cleanId(record.id)}:${mediumId}`;
        const previousRank = Math.max(0, Math.floor(finite(state.highWater[waterKey])));
        if (rank <= previousRank || rank <= 0) continue;
        state.highWater[waterKey] = rank;
        const profile = sourceProfile({ ...context, drainage: exposureState?.drainage || context?.drainage }, mediumId);
        const hazardous = hazardousRecord(record);
        const detectionChance = clamp(profile.detectionBase + (rank - 1) * 0.1 + (hazardous ? 0.08 : 0), 0, 0.96);
        const id = `environmental-milestone-${state.nextMilestoneNumber++}`;
        const milestone = normalizeMilestone({
          id, key: `${waterKey}:band-${rank}`, exposureRecordId: record.id, mediumId, bandRank: rank,
          sourceId: profile.sourceId, sourceLabel: profile.sourceLabel, channel: profile.channel, method: MEDIA[mediumId].method,
          receiverLabel: mediumId === "surface" || mediumId === "odor" || mediumId === "airborne" ? "facility exterior" : record.receiver?.label,
          createdAt: now, detectionChance, reportChance: profile.reportChance, reportDelaySeconds: profile.reportDelaySeconds,
          reliability: rank >= 3 && profile.reliability === "weak" ? "credible" : profile.reliability,
          specificity: profile.specificity, hazardous
        }, state.milestones.length);
        state.milestones.push(milestone);
        created.push(clone(milestone));
      }
    }
    state.lastScannedAt = now;
    return { state, created };
  }

  function updateMilestone(candidate, milestoneId, updates = {}, context = null) {
    const state = normalizeState(candidate, context);
    const index = state.milestones.findIndex((entry) => entry.id === cleanId(milestoneId));
    if (index < 0) return { state, milestone: null };
    state.milestones[index] = normalizeMilestone({ ...state.milestones[index], ...updates, id: state.milestones[index].id }, index);
    return { state, milestone: clone(state.milestones[index]) };
  }
  function syncExternal(candidate, exposures = [], reports = [], context = null) {
    let state = normalizeState(candidate, context);
    const exposureById = new Map((exposures || []).map((entry) => [entry.id, entry]));
    const reportById = new Map((reports || []).map((entry) => [entry.id, entry]));
    for (const milestone of state.milestones) {
      const exposure = exposureById.get(milestone.externalExposureId);
      if (!exposure) continue;
      const report = reportById.get(exposure.reportId);
      milestone.outcome = report ? "reported" : exposure.observed ? "observed" : "missed";
      milestone.reportId = report?.id || exposure.reportId || "";
      const knowledgeRank = { hidden: 0, inferred: 1, known: 2 };
      milestone.knowledge = [milestone.knowledge, exposure.knowledge, report?.knowledge]
        .filter((entry) => Object.hasOwn(knowledgeRank, entry))
        .sort((left, right) => knowledgeRank[right] - knowledgeRank[left])[0] || "hidden";
    }
    state = normalizeState(state, context);
    return state;
  }

  function captureSample(record, methodId, clock = 0) {
    const method = SAMPLE_METHODS[methodId];
    if (!method || !record) return null;
    const amount = Math.max(0, finite(record.media?.[method.medium]));
    return {
      kind: "environmentalExposure", exposureRecordId: cleanId(record.id), methodId: method.id, mediumId: method.medium,
      collectedAt: Math.max(0, finite(clock)), cell: cleanCell(record.cell), amount,
      amountBand: method.medium === "subsurface" ? bandLabel("surface", amount) : bandLabel(method.medium, amount),
      substanceId: cleanId(record.substanceId) || "unidentifiedResidue", label: String(record.label || "Environmental trace"),
      tags: [...new Set((record.tags || []).map(cleanId).filter(Boolean))], hazardous: hazardousRecord(record),
      source: { kind: cleanId(record.source?.kind), id: cleanId(record.source?.id), label: String(record.source?.label || "") }
    };
  }
  function assaySample(captured, confidenceScore = 0) {
    if (captured?.kind !== "environmentalExposure") return null;
    const method = SAMPLE_METHODS[captured.methodId];
    if (!method) return null;
    const confidence = clamp(confidenceScore, 0, 100);
    const detected = finite(captured.amount) > 0.000001;
    const identity = !detected ? "noneDetected" : confidence >= 82 ? "substance" : confidence >= 48 ? "family" : "indeterminate";
    const burden = !detected ? "none" : confidence >= 48 ? String(captured.amountBand || "trace") : "presenceOnly";
    return {
      detected, identity, burden, mediumId: method.medium, methodId: method.id, knowledgeKey: method.knowledgeKey,
      substanceId: identity === "substance" ? cleanId(captured.substanceId) : "",
      family: identity === "family" ? (captured.hazardous ? "hazard-associated chemical material" : "process-associated material") : "",
      hazardous: Boolean(captured.hazardous), exposureRecordId: cleanId(captured.exposureRecordId)
    };
  }
  function knownProjection(candidate, context = null) {
    const state = normalizeState(candidate, context);
    const disclosed = state.milestones.filter((entry) => entry.knowledge !== "hidden").map((entry) => ({
      id: entry.id, mediumId: entry.mediumId, band: entry.band, outcome: entry.outcome, knowledge: entry.knowledge,
      sourceLabel: entry.knowledge === "known" ? entry.sourceLabel : "Possible external observation",
      receiverLabel: entry.receiverLabel, createdAt: entry.createdAt
    }));
    return { disclosed, summary: disclosed.length ? `${disclosed.length} disclosed or reasonably inferred environmental signal${disclosed.length === 1 ? "" : "s"}` : "No external environmental observation has been disclosed or reasonably inferred" };
  }

  return {
    MEDIA, SAMPLE_METHODS, BAND_LABELS, clone, bandRank, bandLabel, sourceProfile,
    defaultState, normalizeState, scan, updateMilestone, syncExternal, captureSample, assaySample, knownProjection
  };
});
