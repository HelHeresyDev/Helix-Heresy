(function attachHelixResearchSystem(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixResearchSystem = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixResearchSystem() {
  "use strict";
  const VERSION = 1;
  const BASIC_TEST_IDS = Object.freeze(["visual", "sustenance", "element", "containment", "byproduct", "behavior"]);
  const PROJECTS = Object.freeze([
    Object.freeze({
      id: "controlledStress", label: "Controlled Stress Methodology",
      description: "Establish a repeatable way to distinguish ordinary agitation from biologically meaningful instability.",
      skillId: "medicine", workSeconds: 90, prerequisites: [],
      evidence: [
        Object.freeze({ label: "Containment observations from two specimens", methods: ["containment"], count: 2, uniqueSpecimens: 2 }),
        Object.freeze({ label: "Behavior observations from two specimens", methods: ["behavior"], count: 2, uniqueSpecimens: 2 })
      ],
      inputs: Object.freeze({ resources: Object.freeze({ geneticMaterial: 1 }), specimenAmount: 1 }),
      unlocks: Object.freeze([{ id: "test:stress", label: "Stress Test" }])
    }),
    Object.freeze({
      id: "longitudinalVitality", label: "Longitudinal Vitality Study",
      description: "Compare stress responses over time to separate temporary condition from lifespan expression.",
      skillId: "medicine", workSeconds: 120, prerequisites: ["controlledStress"],
      evidence: [Object.freeze({ label: "Stress observations from two specimens", methods: ["stress"], count: 2, uniqueSpecimens: 2 })],
      inputs: Object.freeze({ resources: Object.freeze({ geneticMaterial: 1, biomass: 1 }), specimenAmount: 1 }),
      unlocks: Object.freeze([{ id: "test:lifespan", label: "Lifespan Study" }])
    }),
    Object.freeze({
      id: "reproductiveCycle", label: "Reproductive Cycle Documentation",
      description: "Connect nutrition, maturation, and observed division into a controlled reproductive record.",
      skillId: "husbandry", workSeconds: 120, prerequisites: ["longitudinalVitality"],
      evidence: [
        Object.freeze({ label: "Sustenance observations from two specimens", methods: ["sustenance"], count: 2, uniqueSpecimens: 2 }),
        Object.freeze({ label: "One observed maturation or division", methods: ["maturation", "division"], count: 1, uniqueSpecimens: 1 })
      ],
      inputs: Object.freeze({ resources: Object.freeze({ geneticMaterial: 1, biomass: 2 }), specimenAmount: 1 }),
      unlocks: Object.freeze([{ id: "test:breeding", label: "Reproduction Survey" }])
    }),
    Object.freeze({
      id: "tissueCultureMethods", label: "Human Tissue-Culture Methods",
      description: "Document a human-derived biological template and develop a sterile non-slime growth procedure. No memories or skills are copied.",
      skillId: "medicine", minimumSkills: { medicine: 101, alchemy: 101 }, workSeconds: 6 * 3600,
      prerequisites: ["longitudinalVitality"],
      evidence: [Object.freeze({ label: "Physically examined human-derived template", methods: ["humanTemplateExam"], count: 1, uniqueSpecimens: 1 })],
      inputs: { resources: { biomass: 10, geneticMaterial: 5 }, specimenAmount: 0 },
      unlocks: [{ id: "fixtureBlueprint:homunculusChamber", label: "Dedicated tissue-growth chamber" }]
    }),
    Object.freeze({
      id: "homunculusMorphogenesis", label: "Homunculus Morphogenesis",
      description: "Plan organ formation using an examined successful chamber-grown culture. A viable body is not a trained assistant.",
      skillId: "medicine", minimumSkills: { medicine: 101, alchemy: 101 }, workSeconds: 8 * 3600,
      prerequisites: ["tissueCultureMethods", "reinforcedObservationVessels"],
      evidence: [Object.freeze({ label: "Locally examined successful non-slime culture trial", methods: ["tissueCultureTrial"], count: 1, uniqueSpecimens: 1 })],
      inputs: { resources: { biomass: 12, geneticMaterial: 6 }, specimenAmount: 0 },
      unlocks: [{ id: "procedure:homunculusGrowth", label: "Bounded homunculus growth procedure" }]
    }),
    Object.freeze({
      id: "soulBeaconReconstruction", label: "Soul Beacon Reconstruction",
      description: "Reconstruct the exhausted original's guiding apparatus from physical examination. It holds no stored soul and its creator did not anticipate memory loss.",
      skillId: "animancy", minimumSkills: { animancy: 151, medicine: 151, alchemy: 151, fabrication: 101 }, workSeconds: 12 * 3600,
      prerequisites: ["tissueCultureMethods", "homunculusMorphogenesis"],
      evidence: [{ label: "Physically examined exhausted original apparatus", methods: ["exhaustedBeaconExam"], count: 1, uniqueSpecimens: 1 }],
      inputs: { resources: { metalParts: 8, glass: 8, arcaneFeedstock: 8 }, specimenAmount: 0 },
      unlocks: [{ id: "fixtureBlueprint:soulBeacon", label: "Soul beacon and transfer apparatus" }]
    }),
    Object.freeze({
      id: "receivingBodyDevelopment", label: "Receiving-Body Development",
      description: "Prevent independent soul formation during specialized dormant receiver growth. An existing souled homunculus cannot be overwritten.",
      skillId: "medicine", minimumSkills: { animancy: 151, medicine: 151, alchemy: 151, fabrication: 101 }, workSeconds: 24 * 3600,
      prerequisites: ["soulBeaconReconstruction", "homunculusMorphogenesis"],
      evidence: [{ label: "Examined successful human-derived culture", methods: ["tissueCultureTrial"], count: 1, uniqueSpecimens: 1 }],
      inputs: { resources: { biomass: 20, geneticMaterial: 10, arcaneFeedstock: 8 }, specimenAmount: 0 },
      unlocks: [{ id: "fixtureBlueprint:soulReceiver", label: "Dedicated soul-free receiving chamber" }]
    }),
    Object.freeze({
      id: "soulTransferIntegration", label: "Soul-Transfer Integration",
      description: "Integrate an examined grown receiver and calibrated charged beacon. This first reconstruction loses personal memory and practiced expertise; perfected transfer remains separate research.",
      skillId: "animancy", minimumSkills: { animancy: 151, medicine: 151, alchemy: 151, fabrication: 101 }, workSeconds: 24 * 3600,
      prerequisites: ["receivingBodyDevelopment", "soulBeaconReconstruction"],
      evidence: [{ label: "Locally examined compatible grown receiver", methods: ["receivingBodyExam"], count: 1, uniqueSpecimens: 1 },
        { label: "Locally calibrated fully charged beacon", methods: ["beaconCalibration"], count: 1, uniqueSpecimens: 1 }],
      inputs: { resources: { metalParts: 6, arcaneFeedstock: 8 }, specimenAmount: 0 },
      unlocks: [{ id: "procedure:soulTransfer", label: "Arm an imperfect soul-beacon contingency" }]
    }),
    Object.freeze({
      id: "memoryContinuityPreservation", label: "Memory Continuity Preservation",
      description: "Identify the original neural-pattern loss without sacrificing a person. Preserve the departing soul's current personal continuity, not a stored personality or an older backup.",
      skillId: "animancy", minimumSkills: { animancy: 201, medicine: 201, alchemy: 201, fabrication: 151 }, workSeconds: 36 * 3600,
      prerequisites: ["soulTransferIntegration"],
      evidence: [{ label: "Controlled self-derived neural-pattern continuity experiment", methods: ["neuralContinuityTrial"], count: 1, uniqueSpecimens: 1 }],
      inputs: { resources: { metalParts: 12, glass: 8, arcaneFeedstock: 16 }, specimenAmount: 0 },
      unlocks: [{ id: "procedure:memoryContinuity", label: "Continuity-preserving guiding circuitry" }]
    }),
    Object.freeze({
      id: "receivingNeuralIntegration", label: "Receiving-Body Neural Integration",
      description: "Prepare and validate one actual soul-free receiver and charged apparatus for perfected memory transmission. Remembered methods do not train the new body's hands, senses or combat reflexes.",
      skillId: "medicine", minimumSkills: { animancy: 201, medicine: 201, alchemy: 201, fabrication: 151 }, workSeconds: 36 * 3600,
      prerequisites: ["memoryContinuityPreservation", "receivingBodyDevelopment"],
      evidence: [{ label: "Examined compatible grown receiver", methods: ["receivingBodyExam"], count: 1, uniqueSpecimens: 1 },
        { label: "Calibrated charged guiding apparatus", methods: ["beaconCalibration"], count: 1, uniqueSpecimens: 1 }],
      inputs: { resources: { biomass: 16, geneticMaterial: 8, arcaneFeedstock: 12 }, specimenAmount: 0 },
      unlocks: [{ id: "procedure:perfectedSoulTransfer", label: "Physical neural preparation and perfected-pair validation" }]
    }),
    Object.freeze({
      id: "reinforcedObservationVessels", label: "Reinforced Observation Vessels",
      description: "Translate observed containment loads into a visible, sealed vessel with a reinforced frame.",
      skillId: "materialsScience", workSeconds: 150, prerequisites: [],
      evidence: [Object.freeze({ label: "Containment observations from two specimens", methods: ["containment"], count: 2, uniqueSpecimens: 2 })],
      inputs: Object.freeze({ resources: Object.freeze({ glass: 2, metalParts: 1 }), specimenAmount: 1 }),
      unlocks: Object.freeze([{ id: "containerBlueprint:reinforcedObservationVessel", label: "Reinforced Observation Vessel blueprint" }])
    })
  ]);
  const PROJECT_BY_ID = Object.freeze(Object.fromEntries(PROJECTS.map((project) => [project.id, project])));
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function finiteTime(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  }
  function normalizeEvidence(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    const methodId = cleanId(candidate.methodId);
    const sourceKey = String(candidate.sourceKey || "").trim();
    if (!methodId || !sourceKey) return null;
    return {
      id: cleanId(candidate.id) || `evidence-${index + 1}`,
      methodId, category: cleanId(candidate.category) || "observation",
      specimenId: cleanId(candidate.specimenId),
      specimenName: String(candidate.specimenName || "Unknown specimen").trim(),
      sourceKey, summary: String(candidate.summary || "").trim(),
      confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
      observedAt: finiteTime(candidate.observedAt, 0)
    };
  }
  function normalizeProjectRecord(candidate, projectId) {
    const status = ["available", "active", "paused", "completed"].includes(candidate?.status) ? candidate.status : "available";
    return {
      projectId, status,
      progressSeconds: Math.max(0, Number(candidate?.progressSeconds) || 0),
      inputsConsumed: Boolean(candidate?.inputsConsumed),
      taskId: cleanId(candidate?.taskId), workstationId: cleanId(candidate?.workstationId),
      startedAt: candidate?.startedAt == null ? null : finiteTime(candidate.startedAt, 0),
      completedAt: candidate?.completedAt == null ? null : finiteTime(candidate.completedAt, 0)
    };
  }
  function defaultState() {
    return {
      version: VERSION, evidence: [],
      projects: Object.fromEntries(PROJECTS.map((project) => [project.id, normalizeProjectRecord({}, project.id)])),
      unlocks: [], activeProjectId: "", nextEvidenceNumber: 1
    };
  }
  function normalizeState(candidate) {
    const evidence = (Array.isArray(candidate?.evidence) ? candidate.evidence : []).map(normalizeEvidence).filter(Boolean);
    const deduped = [...new Map(evidence.map((entry) => [entry.sourceKey, entry])).values()]
      .sort((a, b) => a.observedAt - b.observedAt || a.id.localeCompare(b.id));
    const projects = Object.fromEntries(PROJECTS.map((project) => [
      project.id, normalizeProjectRecord(candidate?.projects?.[project.id], project.id)
    ]));
    const activeProjectId = cleanId(candidate?.activeProjectId);
    if (!PROJECT_BY_ID[activeProjectId] || projects[activeProjectId].status !== "active") {
      for (const record of Object.values(projects)) {
        if (record.status === "active") record.status = "paused";
        record.taskId = "";
      }
    }
    return {
      version: VERSION, evidence: deduped, projects,
      unlocks: [...new Set((Array.isArray(candidate?.unlocks) ? candidate.unlocks : []).map(cleanId).filter(Boolean))],
      activeProjectId: PROJECT_BY_ID[activeProjectId] && projects[activeProjectId].status === "active" ? activeProjectId : "",
      nextEvidenceNumber: Math.max(Number(candidate?.nextEvidenceNumber) || 1,
        deduped.reduce((max, entry) => Math.max(max, Number(entry.id.match(/([0-9]+)$/)?.[1]) || 0), 0) + 1)
    };
  }
  function evidenceRequirementProgress(requirement, evidence) {
    const matching = evidence.filter((entry) => requirement.methods.includes(entry.methodId));
    const uniqueSpecimens = new Set(matching.map((entry) => entry.specimenId).filter(Boolean)).size;
    const count = matching.length;
    const requiredCount = Math.max(1, Number(requirement.count) || 1);
    const requiredSpecimens = Math.max(0, Number(requirement.uniqueSpecimens) || 0);
    return { label: requirement.label, count, requiredCount, uniqueSpecimens, requiredSpecimens,
      met: count >= requiredCount && uniqueSpecimens >= requiredSpecimens };
  }
  function projectEvaluation(projectOrId, researchState) {
    const project = typeof projectOrId === "string" ? PROJECT_BY_ID[projectOrId] : projectOrId;
    const normalized = normalizeState(researchState);
    if (!project) return null;
    const record = normalized.projects[project.id];
    const prerequisiteRows = project.prerequisites.map((id) => ({
      id, label: PROJECT_BY_ID[id]?.label || id, met: normalized.projects[id]?.status === "completed"
    }));
    const evidenceRows = project.evidence.map((requirement) => evidenceRequirementProgress(requirement, normalized.evidence));
    return {
      project, record, prerequisiteRows, evidenceRows,
      prerequisitesMet: prerequisiteRows.every((row) => row.met),
      evidenceMet: evidenceRows.every((row) => row.met),
      completed: record.status === "completed", active: record.status === "active", paused: record.status === "paused"
    };
  }
  function isUnlocked(researchState, unlockId) {
    return BASIC_TEST_IDS.includes(String(unlockId || "").replace(/^test:/, ""))
      || normalizeState(researchState).unlocks.includes(cleanId(unlockId));
  }
  return {
    VERSION, BASIC_TEST_IDS, PROJECTS, PROJECT_BY_ID, cleanId, normalizeEvidence,
    normalizeProjectRecord, defaultState, normalizeState, evidenceRequirementProgress,
    projectEvaluation, isUnlocked
  };
}));
