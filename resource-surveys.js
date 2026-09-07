(function attachResourceSurveys(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixResourceSurveys = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const FAMILIES = Object.freeze({ ferrousOre: "Ferrous ore", baseMetalOre: "Base-metal ore", preciousMinerals: "Precious minerals", constructionStone: "Construction stone", industrialMinerals: "Industrial minerals", chemicalFeedstock: "Chemical / fuel feedstock", manaCrystals: "Mana crystals", nullstone: "Nullstone", freshWater: "Fresh water", biologicalProductivity: "Biological productivity", timberFiber: "Timber / fiber", geothermalEnergy: "Geothermal energy" });
  const MINERALS = ["ferrousOre", "baseMetalOre", "preciousMinerals", "constructionStone", "industrialMinerals", "chemicalFeedstock"];
  const METHODS = Object.freeze({
    reconnaissance: { label: "Resource Reconnaissance", instrument: "environmentalSurveyKit", seconds: 120, families: [...MINERALS, "freshWater", "biologicalProductivity", "timberFiber", "geothermalEnergy"], depth: "surface indicators" },
    arcaneSurvey: { label: "Arcane Resource Survey", instrument: "thaumometer", seconds: 120, families: ["arcaneIndicators"], depth: "surface magical signals" },
    surfaceSample: { label: "Collect Resource Surface Sample", instrument: "environmentalSurveyKit", seconds: 90, sampleMethod: "resourceSurfaceSample", families: MINERALS, depth: "surface material only" },
    shallowCore: { label: "Collect Prospecting Core", instrument: "environmentalSurveyKit", seconds: 180, sampleMethod: "resourceShallowCore", families: MINERALS, depth: "shallow soil only" }
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const cellKey = (cell) => `${cell.x},${cell.y},${cell.z}`;
  function noise(seed) { let hash = 2166136261; for (const c of String(seed)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return (hash >>> 0) / 0xffffffff; }
  function defaultState(context = null) { return { context: context ? clone(context) : null, observations: [], nextObservationNumber: 1 }; }
  function normalizeState(candidate) {
    const state = defaultState(candidate?.context);
    state.observations = (Array.isArray(candidate?.observations) ? candidate.observations : []).filter((entry) => entry?.id && METHODS[entry.methodId] && entry.cell && Array.isArray(entry.findings)).map(clone);
    state.nextObservationNumber = state.observations.reduce((next, entry) => Math.max(next, (Number(entry.id.split("-").at(-1)) || 0) + 1), Math.max(1, Number(candidate?.nextObservationNumber) || 1));
    return state;
  }
  // Simulation-only local indicators derived from strategic opportunity; not veins or reserves.
  function capture(context, cell, methodId, at, quality = 50, instrument = {}) {
    const method = METHODS[methodId];
    if (!context?.truth || !method || !cell) return null;
    const key = `${context.seed}:${context.siteId}:${cellKey(cell)}:${methodId}`;
    const signals = {};
    for (const family of method.families) {
      const truth = context.truth;
      const potential = family === "arcaneIndicators" ? Math.max(truth.potentialPermille?.manaCrystals || 0, truth.potentialPermille?.nullstone || 0, context.arcaneInterference || 0) : truth.potentialPermille?.[family] || 0;
      const depth = truth.typicalDepth?.[family];
      const depthFactor = ({ exposed: 1, shallow: methodId === "shallowCore" ? 0.85 : 0.5, deep: 0.12, veryDeep: 0.02 })[depth] ?? 1;
      const access = family === "arcaneIndicators" ? 1 : 0.25 + clamp(truth.surfaceAccessibilityPermille, 0, 1000) / 1334;
      signals[family] = clamp(potential * depthFactor * access * (0.6 + noise(`${key}:${family}:local`) * 0.65), 0, 1000);
    }
    return { siteId: context.siteId, strategicCellId: context.strategicCellId, worldId: context.worldId, cell: clone(cell), methodId, sampledAt: at, quality: clamp(quality, 0, 100), instrument: clone(instrument), evidenceKey: key, signals, interference: clamp(context.truth.environmentalDifficultyPermille, 0, 1000) / 100 };
  }
  function assess(captured, score) {
    const method = METHODS[captured?.methodId];
    if (!method) return [];
    const effective = clamp(Math.min(score, captured.quality) - captured.interference, 0, 100);
    return method.families.map((familyId) => {
      const signal = captured.signals[familyId] || 0;
      // Fixed place/method ambiguity prevents repeat-order or reload fishing.
      const ambiguous = noise(`${captured.evidenceKey}:${familyId}:measurement`) * 180 - 90;
      const detected = signal + ambiguous > 290 - effective * 1.8;
      const result = effective < 28 ? "inconclusive" : detected ? "indicatorsDetected" : "notDetected";
      return { familyId, label: FAMILIES[familyId] || "Arcane mineral indicators", result,
        confidence: effective >= 75 ? "strong" : effective >= 48 ? "moderate" : "low",
        summary: result === "inconclusive" ? "Reading inconclusive" : result === "notDetected" ? "Not detected by this method; absence is not established" : familyId === "arcaneIndicators" ? "Magical anomaly detected; source and resource identity unresolved" : "Promising local indicators; deposit and recoverable yield unconfirmed" };
    });
  }
  function record(candidate, captured, options = {}) {
    const state = normalizeState(candidate);
    if (!captured || captured.siteId !== state.context?.siteId || captured.worldId !== state.context?.worldId || !METHODS[captured.methodId]) return { state, observation: null };
    const observation = { id: `resource-observation-${state.nextObservationNumber++}`, methodId: captured.methodId, worldId: captured.worldId, siteId: captured.siteId, strategicCellId: captured.strategicCellId, cell: clone(captured.cell), coverage: "local sampling point; strategic cell remains unsurveyed", depth: METHODS[captured.methodId].depth, sampledAt: captured.sampledAt, recordedAt: options.at ?? captured.sampledAt, instrument: clone(captured.instrument), assayInstrument: clone(options.instrument || {}), evidenceKey: captured.evidenceKey, sampleId: options.sampleId || "", sampleStackId: options.sampleStackId || "", diagnosticResultId: options.diagnosticResultId || "", findings: assess(captured, options.score ?? captured.quality) };
    state.observations.push(observation);
    return { state, observation: clone(observation) };
  }
  // Never project hidden context, captured signals, or noise seeds to ordinary UI.
  function publicKnowledge(candidate, strategicCellId = null) {
    const observations = (candidate?.observations || []).filter((entry) => !strategicCellId || entry.strategicCellId === strategicCellId).map(({ evidenceKey, ...entry }) => clone(entry));
    return { publicProspects: clone(candidate?.context?.publicProspects || {}), observations, coveredPoints: new Set(observations.map((entry) => `${entry.siteId}:${cellKey(entry.cell)}`)).size, wholeCellSurveyed: false, grantsExtractionRights: false };
  }
  return { FAMILIES, METHODS, defaultState, normalizeState, capture, assess, record, publicKnowledge };
});
