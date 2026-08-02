(function attachHelixGeologyField(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixGeologyField = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixGeologyField() {
  "use strict";

  const VERSION = 1;
  const STRATA = Object.freeze([
    Object.freeze({ id: "limestone", label: "Limestone", materialId: "limestone", hardness: 55, stability: 54, permeability: 66, manaConductivity: 58, workMultiplier: 0.78, toolWearMultiplier: 0.82, rubbleYield: 3 }),
    Object.freeze({ id: "granite", label: "Granite", materialId: "granite", hardness: 82, stability: 90, permeability: 18, manaConductivity: 42, workMultiplier: 1.25, toolWearMultiplier: 1.2, rubbleYield: 3.5 }),
    Object.freeze({ id: "shale", label: "Fractured Shale", materialId: "shale", hardness: 38, stability: 32, permeability: 74, manaConductivity: 52, workMultiplier: 0.68, toolWearMultiplier: 0.72, rubbleYield: 2.5 }),
    Object.freeze({ id: "basalt", label: "Mana-Responsive Basalt", materialId: "basalt", hardness: 86, stability: 82, permeability: 12, manaConductivity: 88, workMultiplier: 1.42, toolWearMultiplier: 1.35, rubbleYield: 4 })
  ]);
  const STRATUM_BY_ID = Object.freeze(Object.fromEntries(STRATA.map((entry) => [entry.id, entry])));
  const DEPOSITS = Object.freeze([
    Object.freeze({ id: "ironOre", label: "Iron-bearing vein", materialId: "ironOre", compatibleStrata: ["granite", "basalt", "shale"] }),
    Object.freeze({ id: "copperOre", label: "Copper-bearing vein", materialId: "copperOre", compatibleStrata: ["limestone", "shale", "basalt"] })
  ]);
  const HAZARDS = Object.freeze([
    Object.freeze({ id: "contaminatedGas", label: "Trapped contaminated air", kind: "airborne", severity: "serious" }),
    Object.freeze({ id: "manaPocket", label: "Mana-saturated pocket", kind: "mana", severity: "serious" }),
    Object.freeze({ id: "thermalPocket", label: "Geothermal pocket", kind: "heat", severity: "serious" })
  ]);

  function stableHash(value) {
    const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function cleanCell(candidate) {
    const x = Math.round(Number(candidate?.x));
    const y = Math.round(Number(candidate?.y));
    const rawZ = Number(candidate?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, z: Number.isFinite(rawZ) ? Math.round(rawZ) : 0 };
  }

  function cellKey(candidate) {
    const cell = cleanCell(candidate);
    return cell ? `${cell.x},${cell.y},${cell.z}` : "invalid";
  }

  function stratumForCell(seed, candidate) {
    const cell = cleanCell(candidate);
    if (!cell) return STRATA[0];
    const bend = stableHash(`${seed}:geology-bend:${Math.floor(cell.x / 5)}:${cell.z}`) % 7 - 3;
    const band = Math.floor((cell.y + bend + cell.z * 7) / 7);
    return STRATA[stableHash(`${seed}:geology-stratum:${band}:${cell.z}`) % STRATA.length];
  }

  function depositForCell(seed, candidate, stratum = stratumForCell(seed, candidate)) {
    const cell = cleanCell(candidate);
    if (!cell) return null;
    const veinX = Math.floor((cell.x + stableHash(`${seed}:vein-x:${cell.z}`) % 4) / 4);
    const veinY = Math.floor((cell.y + stableHash(`${seed}:vein-y:${cell.z}`) % 4) / 4);
    if (stableHash(`${seed}:vein:${veinX}:${veinY}:${cell.z}`) % 1000 >= 82) return null;
    const compatible = DEPOSITS.filter((entry) => entry.compatibleStrata.includes(stratum.id));
    if (!compatible.length) return null;
    const definition = compatible[stableHash(`${seed}:vein-type:${veinX}:${veinY}:${cell.z}`) % compatible.length];
    return {
      ...definition,
      yield: 1 + stableHash(`${seed}:vein-yield:${cellKey(cell)}`) % 2
    };
  }

  function hazardForCell(seed, candidate) {
    const cell = cleanCell(candidate);
    if (!cell) return null;
    const roll = stableHash(`${seed}:geology-hazard:${cellKey(cell)}`) % 1000;
    if (roll >= 24) return null;
    return HAZARDS[stableHash(`${seed}:geology-hazard-type:${cellKey(cell)}`) % HAZARDS.length];
  }

  function stabilityBand(score) {
    if (score >= 80) return "Very Stable";
    if (score >= 60) return "Stable";
    if (score >= 40) return "Questionable";
    return "Fractured";
  }

  function hardnessBand(score) {
    if (score >= 80) return "Very Hard";
    if (score >= 60) return "Hard";
    if (score >= 40) return "Moderate";
    return "Soft";
  }

  function profileForCell(seed, candidate) {
    const cell = cleanCell(candidate);
    if (!cell) return null;
    const stratum = stratumForCell(seed, cell);
    const depthMultiplier = 1 + Math.max(0, Math.abs(cell.z)) * 0.08;
    return {
      version: VERSION,
      cell,
      stratum,
      hardnessBand: hardnessBand(stratum.hardness),
      stabilityBand: stabilityBand(stratum.stability),
      deposit: depositForCell(seed, cell, stratum),
      hazard: hazardForCell(seed, cell),
      workMultiplier: stratum.workMultiplier * depthMultiplier,
      toolWearMultiplier: stratum.toolWearMultiplier * depthMultiplier,
      rubbleYield: stratum.rubbleYield
    };
  }

  function faceKnowledge(profile) {
    if (!profile) return null;
    return {
      stratumId: profile.stratum.id,
      label: profile.stratum.label,
      materialId: profile.stratum.materialId,
      hardnessBand: profile.hardnessBand,
      stabilityBand: profile.stabilityBand,
      permeabilityBand: profile.stratum.permeability >= 65 ? "High" : profile.stratum.permeability >= 35 ? "Moderate" : "Low",
      manaResponseBand: profile.stratum.manaConductivity >= 75 ? "Strong" : profile.stratum.manaConductivity >= 45 ? "Moderate" : "Weak"
    };
  }

  function excavationMaterials(profile) {
    if (!profile) return {};
    const materials = { [profile.stratum.materialId]: profile.rubbleYield };
    if (profile.deposit) materials[profile.deposit.materialId] = profile.deposit.yield;
    return materials;
  }

  function findNearestFeature(seed, originCandidate, feature, options = {}) {
    const origin = cleanCell(originCandidate);
    if (!origin) return null;
    const maxRadius = Math.max(0, Math.floor(Number(options.maxRadius) || 40));
    const width = Math.max(1, Math.floor(Number(options.width) || 100));
    const height = Math.max(1, Math.floor(Number(options.height) || 100));
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const dxMagnitude = radius - Math.abs(dy);
        for (const dx of dxMagnitude ? [-dxMagnitude, dxMagnitude] : [0]) {
          const cell = { x: origin.x + dx, y: origin.y + dy, z: origin.z };
          if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
          const profile = profileForCell(seed, cell);
          if (feature === "hazard" && profile.hazard) return profile;
          if (feature === "deposit" && profile.deposit) return profile;
          if (STRATUM_BY_ID[feature] && profile.stratum.id === feature) return profile;
        }
      }
    }
    return null;
  }

  return {
    VERSION,
    STRATA,
    STRATUM_BY_ID,
    DEPOSITS,
    HAZARDS,
    stableHash,
    cleanCell,
    cellKey,
    stratumForCell,
    depositForCell,
    hazardForCell,
    hardnessBand,
    stabilityBand,
    profileForCell,
    faceKnowledge,
    excavationMaterials,
    findNearestFeature
  };
}));
