(function attachHelixDiagnosticSystem(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixDiagnosticSystem = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixDiagnosticSystem() {
  "use strict";

  const VERSION = 1;
  const INSTRUMENTS = Object.freeze([
    Object.freeze({
      id: "environmentalSurveyKit", label: "Environmental Survey Kit",
      metrics: Object.freeze(["temperature", "humidity", "light", "electricalCharge"]),
      fieldSeconds: 12, calibrationSeconds: 45, calibrationUseCost: 4
    }),
    Object.freeze({
      id: "thaumometer", label: "Thaumometer",
      metrics: Object.freeze(["ambientMana"]),
      fieldSeconds: 16, calibrationSeconds: 60, calibrationUseCost: 5
    }),
    Object.freeze({
      id: "assayCase", label: "Assay Case",
      metrics: Object.freeze(["contamination", "airborneIdentity", "biological"]),
      fieldSeconds: 10, calibrationSeconds: 60, calibrationUseCost: 6
    })
  ]);
  const INSTRUMENT_BY_ID = Object.freeze(Object.fromEntries(INSTRUMENTS.map((entry) => [entry.id, entry])));
  const SAMPLE_METHODS = Object.freeze([
    Object.freeze({ id: "airVial", label: "Air Vial", targetKinds: Object.freeze(["tile", "container"]), quality: 62, collectionSeconds: 10, stress: 0, bodyDamage: 0 }),
    Object.freeze({ id: "surfaceSwab", label: "Surface Swab", targetKinds: Object.freeze(["slime", "scientist"]), quality: 48, collectionSeconds: 12, stress: 2, bodyDamage: 0 }),
    Object.freeze({ id: "fluidSample", label: "Fluid Sample", targetKinds: Object.freeze(["slime", "scientist"]), quality: 78, collectionSeconds: 18, stress: 6, bodyDamage: 1 })
  ]);
  const SAMPLE_METHOD_BY_ID = Object.freeze(Object.fromEntries(SAMPLE_METHODS.map((entry) => [entry.id, entry])));
  const CONFIDENCE_BANDS = Object.freeze([
    Object.freeze({ min: 82, id: "reference", label: "Reference" }),
    Object.freeze({ min: 66, id: "strong", label: "Strong" }),
    Object.freeze({ min: 48, id: "fair", label: "Fair" }),
    Object.freeze({ min: 28, id: "rough", label: "Rough" }),
    Object.freeze({ min: 0, id: "uncertain", label: "Uncertain" })
  ]);
  const CALIBRATION_BANDS = Object.freeze([
    Object.freeze({ min: 85, id: "reference", label: "Reference" }),
    Object.freeze({ min: 65, id: "calibrated", label: "Calibrated" }),
    Object.freeze({ min: 40, id: "drifting", label: "Drifting" }),
    Object.freeze({ min: 1, id: "rough", label: "Rough" }),
    Object.freeze({ min: 0, id: "uncalibrated", label: "Uncalibrated" })
  ]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }
  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }
  function calibrationBand(value) {
    const score = clamp(value, 0, 100);
    return CALIBRATION_BANDS.find((band) => score >= band.min) || CALIBRATION_BANDS.at(-1);
  }
  function confidenceBand(value) {
    const score = clamp(value, 0, 100);
    return CONFIDENCE_BANDS.find((band) => score >= band.min) || CONFIDENCE_BANDS.at(-1);
  }
  function normalizeInstrumentRecord(candidate, instanceId) {
    return {
      instanceId: cleanId(instanceId),
      calibration: clamp(candidate?.calibration ?? 45, 0, 100),
      usesSinceCalibration: Math.max(0, Math.floor(finite(candidate?.usesSinceCalibration, 0))),
      lastCalibratedAt: candidate?.lastCalibratedAt == null ? null : Math.max(0, finite(candidate.lastCalibratedAt, 0)),
      lastUsedAt: candidate?.lastUsedAt == null ? null : Math.max(0, finite(candidate.lastUsedAt, 0))
    };
  }
  function normalizeSample(candidate, index = 0) {
    const method = SAMPLE_METHOD_BY_ID[candidate?.methodId];
    const id = cleanId(candidate?.id) || `diagnostic-sample-${index + 1}`;
    const stackId = cleanId(candidate?.stackId);
    if (!method || !id || !stackId) return null;
    return {
      id, stackId, methodId: method.id,
      targetKind: cleanId(candidate?.targetKind),
      targetId: cleanId(candidate?.targetId),
      targetLabel: String(candidate?.targetLabel || "Unknown target").trim(),
      cell: candidate?.cell && typeof candidate.cell === "object"
        ? { x: Math.floor(finite(candidate.cell.x)), y: Math.floor(finite(candidate.cell.y)), z: Math.floor(finite(candidate.cell.z)) }
        : null,
      collectedAt: Math.max(0, finite(candidate?.collectedAt, 0)),
      collectorInstrumentInstanceId: cleanId(candidate?.collectorInstrumentInstanceId),
      captured: candidate?.captured && typeof candidate.captured === "object" ? JSON.parse(JSON.stringify(candidate.captured)) : {}
    };
  }
  function normalizeResult(candidate, index = 0) {
    const id = cleanId(candidate?.id) || `diagnostic-result-${index + 1}`;
    if (!id) return null;
    return {
      id,
      workflowId: cleanId(candidate?.workflowId),
      targetKind: cleanId(candidate?.targetKind),
      targetId: cleanId(candidate?.targetId),
      targetLabel: String(candidate?.targetLabel || "Unknown target").trim(),
      cell: candidate?.cell && typeof candidate.cell === "object"
        ? { x: Math.floor(finite(candidate.cell.x)), y: Math.floor(finite(candidate.cell.y)), z: Math.floor(finite(candidate.cell.z)) }
        : null,
      measuredAt: Math.max(0, finite(candidate?.measuredAt, 0)),
      sampleCollectedAt: candidate?.sampleCollectedAt == null ? null : Math.max(0, finite(candidate.sampleCollectedAt, 0)),
      instrumentId: cleanId(candidate?.instrumentId),
      instrumentInstanceId: cleanId(candidate?.instrumentInstanceId),
      confidenceScore: clamp(candidate?.confidenceScore, 0, 100),
      confidence: confidenceBand(candidate?.confidenceScore).label,
      summary: String(candidate?.summary || "").trim(),
      readings: Array.isArray(candidate?.readings) ? candidate.readings.map((entry) => ({ ...entry })).slice(0, 20) : [],
      factors: Array.isArray(candidate?.factors) ? candidate.factors.map(String).filter(Boolean).slice(0, 12) : []
    };
  }
  function defaultState() {
    return { version: VERSION, instruments: {}, samples: [], results: [], nextSampleNumber: 1, nextResultNumber: 1 };
  }
  function normalizeState(candidate) {
    const samples = (Array.isArray(candidate?.samples) ? candidate.samples : []).map(normalizeSample).filter(Boolean);
    const results = (Array.isArray(candidate?.results) ? candidate.results : []).map(normalizeResult).filter(Boolean).slice(-100);
    const instruments = {};
    for (const [instanceId, record] of Object.entries(candidate?.instruments || {})) {
      const clean = cleanId(instanceId);
      if (clean) instruments[clean] = normalizeInstrumentRecord(record, clean);
    }
    return {
      version: VERSION, instruments, samples, results,
      nextSampleNumber: Math.max(1, Math.floor(finite(candidate?.nextSampleNumber, 1))),
      nextResultNumber: Math.max(1, Math.floor(finite(candidate?.nextResultNumber, 1)))
    };
  }
  function confidenceScore(options = {}) {
    const calibration = clamp(options.calibration, 0, 100);
    const condition = clamp(options.condition, 0, 100);
    const skill = clamp(options.skill, 0, 100);
    const methodQuality = clamp(options.methodQuality ?? 70, 0, 100);
    const ageHours = Math.max(0, finite(options.sampleAgeSeconds, 0) / 3600);
    const agePenalty = Math.min(32, ageHours * 4);
    const contaminationPenalty = clamp(options.contaminationPenalty, 0, 35);
    return clamp(calibration * 0.38 + condition * 0.22 + skill * 0.18 + methodQuality * 0.22 - agePenalty - contaminationPenalty, 0, 100);
  }
  function uncertaintyFraction(score) {
    const band = confidenceBand(score).id;
    return { reference: 0.02, strong: 0.06, fair: 0.14, rough: 0.28, uncertain: 0.5 }[band] || 0.5;
  }
  function useInstrument(record, instrumentId, at) {
    const normalized = normalizeInstrumentRecord(record, record?.instanceId);
    const def = INSTRUMENT_BY_ID[instrumentId];
    normalized.calibration = clamp(normalized.calibration - (def?.calibrationUseCost || 4), 0, 100);
    normalized.usesSinceCalibration += 1;
    normalized.lastUsedAt = Math.max(0, finite(at, 0));
    return normalized;
  }

  return {
    VERSION, INSTRUMENTS, INSTRUMENT_BY_ID, SAMPLE_METHODS, SAMPLE_METHOD_BY_ID,
    CONFIDENCE_BANDS, CALIBRATION_BANDS, cleanId, clamp, calibrationBand,
    confidenceBand, normalizeInstrumentRecord, normalizeSample, normalizeResult,
    defaultState, normalizeState, confidenceScore, uncertaintyFraction, useInstrument
  };
}));
