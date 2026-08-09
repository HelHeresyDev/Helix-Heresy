(function attachHelixWelfareSystem(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWelfareSystem = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixWelfareSystem() {
  "use strict";

  const VERSION = 1;
  const HISTORY_LIMIT = 80;
  const INTERVENTION_LIMIT = 60;
  const NEEDS = Object.freeze([
    Object.freeze({ id: "nourishment", label: "Nourishment" }),
    Object.freeze({ id: "recovery", label: "Recovery" }),
    Object.freeze({ id: "habitat", label: "Habitat" }),
    Object.freeze({ id: "social", label: "Social Fit" }),
    Object.freeze({ id: "stimulation", label: "Stimulation" })
  ]);
  const NEED_BY_ID = Object.freeze(Object.fromEntries(NEEDS.map((entry) => [entry.id, entry])));
  const CARE_PLANS = Object.freeze([
    Object.freeze({ id: "standard", label: "Standard Care", description: "Balance feeding, ordinary activity, compatible housing, and recovery." }),
    Object.freeze({ id: "recovery", label: "Recovery", description: "Suspend ordinary work and favor safe nourishment, quiet, and recovery." }),
    Object.freeze({ id: "researchExemption", label: "Research Exemption", description: "Permit approved stressful procedures while recording their full burden." }),
    Object.freeze({ id: "minimalIntervention", label: "Minimal Intervention", description: "Avoid unnecessary handling while still surfacing critical neglect." })
  ]);
  const CARE_PLAN_BY_ID = Object.freeze(Object.fromEntries(CARE_PLANS.map((entry) => [entry.id, entry])));
  const CONDITIONS = Object.freeze([
    Object.freeze({ id: "malnourished", label: "Malnourished", needId: "nourishment", thresholds: [6, 24, 72] }),
    Object.freeze({ id: "exhausted", label: "Exhausted", needId: "recovery", thresholds: [6, 24, 72] }),
    Object.freeze({ id: "habitatSick", label: "Habitat-Sick", needId: "habitat", thresholds: [6, 24, 72] }),
    Object.freeze({ id: "compressed", label: "Compressed", needId: "compression", thresholds: [2, 8, 24] }),
    Object.freeze({ id: "understimulated", label: "Understimulated", needId: "stimulation", thresholds: [12, 36, 96] }),
    Object.freeze({ id: "overstimulated", label: "Overstimulated", needId: "overstimulation", thresholds: [6, 24, 72] }),
    Object.freeze({ id: "sociallyDistressed", label: "Socially Distressed", needId: "social", thresholds: [12, 36, 96] }),
    Object.freeze({ id: "chronicallyStressed", label: "Chronically Stressed", needId: "chronicStress", thresholds: [6, 24, 72] })
  ]);
  const CONDITION_BY_ID = Object.freeze(Object.fromEntries(CONDITIONS.map((entry) => [entry.id, entry])));
  const STAGES = Object.freeze([
    Object.freeze({ id: "early", label: "Early", rank: 1 }),
    Object.freeze({ id: "established", label: "Established", rank: 2 }),
    Object.freeze({ id: "severe", label: "Severe", rank: 3 })
  ]);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }
  function clone(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return fallback; }
  }
  function cleanText(value, limit = 240) {
    return String(value || "").trim().slice(0, limit);
  }
  function needBand(score) {
    const value = clamp(score, 0, 100);
    if (value < 20) return { id: "critical", label: "Critical", rank: 3 };
    if (value < 45) return { id: "deprived", label: "Deprived", rank: 2 };
    if (value < 70) return { id: "strained", label: "Strained", rank: 1 };
    return { id: "met", label: "Met", rank: 0 };
  }
  function overallBand(needs) {
    const list = Object.values(needs || {});
    const worst = list.reduce((max, need) => Math.max(max, need.band.rank), 0);
    if (worst >= 3) return { id: "critical", label: "Critical", rank: 3 };
    if (worst >= 2) return { id: "poor", label: "Poor", rank: 2 };
    if (worst >= 1) return { id: "watch", label: "Watch", rank: 1 };
    return { id: "stable", label: "Stable", rank: 0 };
  }
  function needResult(id, score, reasons = []) {
    const cleanScore = Math.round(clamp(score, 0, 100));
    return {
      id,
      label: NEED_BY_ID[id]?.label || id,
      score: cleanScore,
      band: needBand(cleanScore),
      reasons: [...new Set((Array.isArray(reasons) ? reasons : []).map((entry) => cleanText(entry)).filter(Boolean))].slice(0, 8)
    };
  }
  function evaluate(input = {}) {
    const nutrition = clamp(input.nutrition, 0, 100);
    const mass = clamp(input.mass, 0, 100);
    const integrity = clamp(input.integrity, 0, 100);
    const stress = clamp(input.stress, 0, 100);
    const habitat = clamp(input.habitatScore, 0, 100);
    const social = clamp(input.socialScore, 0, 100);
    const stimulation = clamp(input.stimulationScore, 0, 100);
    const resting = Boolean(input.resting);
    const activeStrain = clamp(input.activeStrain, 0, 30);
    const spatialPressure = Boolean(input.spatialPressure);
    const nourishmentScore = nutrition * 0.78 + mass * 0.22;
    const recoveryScore = integrity * 0.55 + (100 - stress) * 0.35 + (resting ? 10 : 0) - activeStrain;
    const habitatScore = habitat - (spatialPressure ? 28 : 0);
    const needs = {
      nourishment: needResult("nourishment", nourishmentScore, [
        nutrition < 45 ? "Nutrition is below a sustainable level." : "",
        mass < 60 ? "Reduced Current Mass increases nutritional demand." : ""
      ]),
      recovery: needResult("recovery", recoveryScore, [
        integrity < 65 ? "Body Integrity needs recovery." : "",
        stress > 45 ? "Stress is disrupting recovery." : "",
        activeStrain > 0 ? "Recent activity is adding recovery strain." : "",
        resting ? "Current quiescence supports recovery." : ""
      ]),
      habitat: needResult("habitat", habitatScore, [
        habitat < 52 ? "The current environment is a poor biological fit." : "",
        spatialPressure ? "Physical space is compressing the body." : ""
      ]),
      social: needResult("social", social, Array.isArray(input.socialReasons) ? input.socialReasons : []),
      stimulation: needResult("stimulation", stimulation, [
        input.enrichment ? "A local enrichment station provides reusable stimulation." : "",
        input.meaningfulActivity ? "Recent meaningful activity provides stimulation." : "",
        stimulation < 45 ? "The recent environment offers too little suitable activity." : ""
      ])
    };
    return { needs, overall: overallBand(needs) };
  }
  function emptyExposure() {
    return Object.fromEntries([...NEEDS.map((need) => need.id), "compression", "overstimulation", "chronicStress"].map((id) => [id, 0]));
  }
  function normalizeHistoryEntry(entry) {
    return {
      at: Math.max(0, finite(entry?.at, 0)),
      kind: cleanText(entry?.kind, 40),
      severity: ["info", "minor", "serious", "critical"].includes(entry?.severity) ? entry.severity : "info",
      summary: cleanText(entry?.summary, 300)
    };
  }
  function normalizeIntervention(entry) {
    return {
      at: Math.max(0, finite(entry?.at, 0)),
      kind: cleanText(entry?.kind, 50),
      burden: clamp(entry?.burden, 0, 100),
      summary: cleanText(entry?.summary, 300)
    };
  }
  function normalizeCondition(entry) {
    if (!CONDITION_BY_ID[entry?.id]) return null;
    const stage = STAGES.some((candidate) => candidate.id === entry.stage) ? entry.stage : "early";
    return {
      id: entry.id,
      stage,
      startedAt: Math.max(0, finite(entry.startedAt, 0)),
      updatedAt: Math.max(0, finite(entry.updatedAt, entry.startedAt)),
      peakStage: STAGES.some((candidate) => candidate.id === entry.peakStage) ? entry.peakStage : stage
    };
  }
  function defaultRecord(clock = 0) {
    return {
      version: VERSION,
      carePlanId: "standard",
      updatedAt: Math.max(0, finite(clock, 0)),
      needExposureHours: emptyExposure(),
      lastBands: {},
      restHours: 0,
      activeHours: 0,
      consequenceProgress: { damage: 0, stressGain: 0, integrityRecovery: 0, stressRecovery: 0 },
      lastMeaningfulActivityAt: Math.max(0, finite(clock, 0)),
      conditions: [],
      history: [],
      interventions: []
    };
  }
  function normalizeRecord(candidate, clock = 0) {
    const fallback = defaultRecord(clock);
    const exposure = emptyExposure();
    for (const id of Object.keys(exposure)) exposure[id] = Math.max(0, finite(candidate?.needExposureHours?.[id], 0));
    const conditions = (Array.isArray(candidate?.conditions) ? candidate.conditions : []).map(normalizeCondition).filter(Boolean);
    return {
      version: VERSION,
      carePlanId: CARE_PLAN_BY_ID[candidate?.carePlanId] ? candidate.carePlanId : fallback.carePlanId,
      updatedAt: Math.max(0, finite(candidate?.updatedAt, clock)),
      needExposureHours: exposure,
      lastBands: Object.fromEntries(NEEDS.map((need) => [need.id, ["met", "strained", "deprived", "critical"].includes(candidate?.lastBands?.[need.id]) ? candidate.lastBands[need.id] : ""])),
      restHours: Math.max(0, finite(candidate?.restHours, 0)),
      activeHours: Math.max(0, finite(candidate?.activeHours, 0)),
      consequenceProgress: {
        damage: Math.max(0, finite(candidate?.consequenceProgress?.damage, 0)),
        stressGain: Math.max(0, finite(candidate?.consequenceProgress?.stressGain, 0)),
        integrityRecovery: Math.max(0, finite(candidate?.consequenceProgress?.integrityRecovery, 0)),
        stressRecovery: Math.max(0, finite(candidate?.consequenceProgress?.stressRecovery, 0))
      },
      lastMeaningfulActivityAt: Math.max(0, finite(candidate?.lastMeaningfulActivityAt, clock)),
      conditions,
      history: (Array.isArray(candidate?.history) ? candidate.history : []).map(normalizeHistoryEntry).filter((entry) => entry.summary).slice(-HISTORY_LIMIT),
      interventions: (Array.isArray(candidate?.interventions) ? candidate.interventions : []).map(normalizeIntervention).filter((entry) => entry.summary).slice(-INTERVENTION_LIMIT)
    };
  }
  function stageForExposure(definition, hours) {
    if (hours >= definition.thresholds[2]) return "severe";
    if (hours >= definition.thresholds[1]) return "established";
    if (hours >= definition.thresholds[0]) return "early";
    return "";
  }
  function stageRank(stage) {
    return STAGES.find((entry) => entry.id === stage)?.rank || 0;
  }
  function severityForStage(stage) {
    return stage === "severe" ? "critical" : stage === "established" ? "serious" : "minor";
  }
  function updateExposure(current, score, elapsedHours) {
    const band = needBand(score);
    if (band.id === "critical") return current + elapsedHours;
    if (band.id === "deprived") return current + elapsedHours * 0.55;
    if (band.id === "strained") return Math.max(0, current - elapsedHours * 0.25);
    return Math.max(0, current - elapsedHours * 1.5);
  }
  function pushHistory(record, entry) {
    record.history.push(normalizeHistoryEntry(entry));
    if (record.history.length > HISTORY_LIMIT) record.history.splice(0, record.history.length - HISTORY_LIMIT);
  }
  function reconcileConditions(record, clock) {
    const previous = new Map(record.conditions.map((condition) => [condition.id, condition]));
    const next = [];
    for (const definition of CONDITIONS) {
      const stage = stageForExposure(definition, record.needExposureHours[definition.needId] || 0);
      const old = previous.get(definition.id);
      if (!stage) {
        if (old) pushHistory(record, { at: clock, kind: "conditionRecovered", severity: "info", summary: `${definition.label} resolved after sustained care.` });
        continue;
      }
      const condition = {
        id: definition.id,
        stage,
        startedAt: old?.startedAt ?? clock,
        updatedAt: clock,
        peakStage: stageRank(stage) >= stageRank(old?.peakStage) ? stage : old.peakStage
      };
      next.push(condition);
      if (!old) pushHistory(record, { at: clock, kind: "conditionStarted", severity: severityForStage(stage), summary: `${definition.label} developed (${STAGES.find((entry) => entry.id === stage).label.toLowerCase()}).` });
      else if (old.stage !== stage) pushHistory(record, { at: clock, kind: "conditionChanged", severity: severityForStage(stage), summary: `${definition.label} is now ${STAGES.find((entry) => entry.id === stage).label.toLowerCase()}.` });
    }
    record.conditions = next;
  }
  function advance(candidate, input = {}, elapsedSeconds = 0, clock = 0) {
    const record = normalizeRecord(candidate, clock);
    const elapsedHours = Math.max(0, finite(elapsedSeconds, 0)) / 3600;
    const assessment = evaluate(input);
    if (!elapsedHours) return { record, assessment, changed: false };
    const before = JSON.stringify(record);
    for (const need of NEEDS) {
      const result = assessment.needs[need.id];
      record.needExposureHours[need.id] = updateExposure(record.needExposureHours[need.id], result.score, elapsedHours);
      const oldBand = record.lastBands[need.id];
      if (oldBand && oldBand !== result.band.id) pushHistory(record, { at: clock, kind: "needChanged", severity: result.band.rank >= 2 ? "serious" : result.band.rank ? "minor" : "info", summary: `${need.label} changed from ${oldBand} to ${result.band.label.toLowerCase()}.` });
      record.lastBands[need.id] = result.band.id;
    }
    record.needExposureHours.compression = updateExposure(record.needExposureHours.compression, input.spatialPressure ? 0 : 100, elapsedHours);
    record.needExposureHours.overstimulation = updateExposure(record.needExposureHours.overstimulation, 100 - clamp(input.overstimulationPressure, 0, 100), elapsedHours);
    record.needExposureHours.chronicStress = updateExposure(record.needExposureHours.chronicStress, 100 - clamp(input.stress, 0, 100), elapsedHours);
    if (input.resting) record.restHours += elapsedHours;
    if (input.meaningfulActivity) {
      record.activeHours += elapsedHours;
      record.lastMeaningfulActivityAt = clock;
    }
    reconcileConditions(record, clock);
    record.updatedAt = Math.max(record.updatedAt, finite(clock, record.updatedAt));
    return { record, assessment, changed: JSON.stringify(record) !== before };
  }
  function recordIntervention(candidate, intervention = {}, clock = 0) {
    const record = normalizeRecord(candidate, clock);
    const entry = normalizeIntervention({ ...intervention, at: clock });
    if (!entry.summary) return record;
    record.interventions.push(entry);
    if (record.interventions.length > INTERVENTION_LIMIT) record.interventions.splice(0, record.interventions.length - INTERVENTION_LIMIT);
    pushHistory(record, { at: clock, kind: "intervention", severity: entry.burden >= 70 ? "critical" : entry.burden >= 35 ? "serious" : entry.burden > 0 ? "minor" : "info", summary: entry.summary });
    return record;
  }
  function burdenScore(candidate, clock = 0) {
    const record = normalizeRecord(candidate, clock);
    const recent = record.interventions.filter((entry) => clock - entry.at <= 7 * 86400);
    const interventionBurden = recent.reduce((total, entry) => total + entry.burden, 0) / 4;
    const conditionBurden = record.conditions.reduce((total, condition) => total + stageRank(condition.stage) * 12, 0);
    return Math.round(clamp(interventionBurden + conditionBurden, 0, 100));
  }
  function conditionFactor(candidate) {
    const record = normalizeRecord(candidate);
    const penalty = record.conditions.reduce((total, condition) => total + ({ early: 0.04, established: 0.1, severe: 0.2 }[condition.stage] || 0), 0);
    return clamp(1 - penalty, 0.25, 1);
  }

  return {
    VERSION, NEEDS, NEED_BY_ID, CARE_PLANS, CARE_PLAN_BY_ID, CONDITIONS, CONDITION_BY_ID, STAGES,
    needBand, overallBand, evaluate, defaultRecord, normalizeRecord, advance,
    recordIntervention, burdenScore, conditionFactor, stageRank, clone
  };
}));
