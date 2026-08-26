(function initStrategicResourcePotential(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const environment = typeof module === "object" && module.exports
    ? require("./climate-hydrology-biomes")
    : root?.HelixClimateHydrologyBiomes;
  const strategicGeology = typeof module === "object" && module.exports
    ? require("./strategic-geology")
    : root?.HelixStrategicGeology;
  const arcaneGeography = typeof module === "object" && module.exports
    ? require("./strategic-arcane-geography")
    : root?.HelixStrategicArcaneGeography;
  const api = factory(strategicWorld, environment, strategicGeology, arcaneGeography);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicResourcePotential = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicResourcePotentialApi(StrategicWorld, Environment, StrategicGeology, ArcaneGeography) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-resource-potential.js");
  if (!Environment) throw new Error("HelixClimateHydrologyBiomes must load before strategic-resource-potential.js");
  if (!StrategicGeology) throw new Error("HelixStrategicGeology must load before strategic-resource-potential.js");
  if (!ArcaneGeography) throw new Error("HelixStrategicArcaneGeography must load before strategic-resource-potential.js");

  const RESOURCE_POTENTIAL_VERSION = 1;
  const PUBLIC_PROSPECT_VERSION = 1;
  const RESOURCE_FAMILIES = Object.freeze([
    Object.freeze({ id: "ferrousOre", code: "F", label: "Ferrous Ore", kind: "extractive" }),
    Object.freeze({ id: "baseMetalOre", code: "B", label: "Base-Metal Ore", kind: "extractive" }),
    Object.freeze({ id: "preciousMinerals", code: "P", label: "Precious Minerals", kind: "extractive" }),
    Object.freeze({ id: "constructionStone", code: "C", label: "Construction Stone", kind: "extractive" }),
    Object.freeze({ id: "industrialMinerals", code: "I", label: "Industrial Minerals", kind: "extractive" }),
    Object.freeze({ id: "chemicalFeedstock", code: "H", label: "Chemical / Fuel Feedstock", kind: "extractive" }),
    Object.freeze({ id: "manaCrystals", code: "M", label: "Mana Crystals", kind: "extractive" }),
    Object.freeze({ id: "nullstone", code: "N", label: "Nullstone", kind: "extractive" }),
    Object.freeze({ id: "freshWater", code: "W", label: "Fresh Water", kind: "renewable" }),
    Object.freeze({ id: "biologicalProductivity", code: "G", label: "Biological Productivity", kind: "renewable" }),
    Object.freeze({ id: "timberFiber", code: "T", label: "Timber / Fiber", kind: "renewable" }),
    Object.freeze({ id: "geothermalEnergy", code: "E", label: "Geothermal Energy", kind: "energy" })
  ]);
  const EXTRACTIVE_FAMILIES = Object.freeze(RESOURCE_FAMILIES.filter((family) => family.kind === "extractive"));
  const RESOURCE_BY_ID = Object.freeze(Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.id, family])));
  const RESOURCE_CLASS_LEGEND = Object.freeze({ ".": "noStrongProspect", ...Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.code, family.id])) });
  const PROSPECT_BAND_LEGEND = Object.freeze({ "0": "minimal", "1": "low", "2": "moderate", "3": "high" });
  const CONFIDENCE_CLASS_LEGEND = Object.freeze({ l: "low", m: "moderate", h: "high" });
  const DEPTH_CLASS_LEGEND = Object.freeze({ e: "exposed", s: "shallow", d: "deep", v: "veryDeep" });
  const CONTINUITY_CLASS_LEGEND = Object.freeze({ p: "isolatedPockets", d: "discontinuous", r: "regional", e: "extensive" });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function seededNoise(seed, index, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}:${index}`), 16) / 0xffffffff;
  }

  function biomeProductivity(code) {
    return ({
      I: 10, T: 100, B: 590, F: 720, G: 570, S: 310, D: 35, Y: 790, R: 960, A: 80,
      W: 850, p: 40, c: 130, t: 250, w: 430, u: 740, h: 900, o: 160, d: 50
    })[code] || 80;
  }

  function forestPotential(code) {
    return ({ B: 780, F: 870, Y: 830, R: 940, G: 260, S: 150, W: 420, T: 80 })[code] || 20;
  }

  function waterPotential(map, index) {
    if (map.surface.classes[index] === "W") return map.relief.reliefClasses[index] === "S" ? 120 : 10;
    const river = { ".": 0, r: 510, R: 710, G: 900 }[map.hydrology.riverClasses[index]];
    const wetland = map.hydrology.wetlandClasses[index] === "." ? 0 : 670;
    const lake = map.hydrology.lakeByCell[index] >= 0 ? 930 : 0;
    const rainfall = Math.min(720, map.climate.precipitationMm[index] * 0.24);
    const aquifer = map.geology.permeabilityPermille[index] * 0.45 + map.hydrology.drainageCellCount[index] * 3;
    return clamp(Math.max(river, wetland, lake, rainfall * 0.65 + aquifer), 0, 1000);
  }

  function resourceSignals(map, index) {
    const bedrock = map.geology.bedrockClasses[index];
    const regime = map.geology.tectonicRegimeClasses[index];
    const deposit = map.geology.surfaceDepositClasses[index];
    const crustAge = map.geology.crustAgeMyr[index];
    const geothermal = map.geology.geothermalPermille[index];
    const permeability = map.geology.permeabilityPermille[index];
    const stability = map.geology.stabilityPermille[index];
    const river = map.hydrology.riverClasses[index];
    const wetland = map.hydrology.wetlandClasses[index];
    const biome = map.biomes.classes[index];
    const productivity = biomeProductivity(biome);
    const forest = forestPotential(biome);
    const rainfall = map.climate.precipitationMm[index];
    const aridity = map.climate.aridityIndexPermille[index];
    const mana = map.arcaneGeography.manaConcentrationPermille[index];
    const nullStrength = map.arcaneGeography.nullPermille[index];
    const ley = map.arcaneGeography.leyClasses[index];
    const land = map.surface.classes[index] === "L";
    return {
      ferrousOre: 80 + (["b", "u", "v"].includes(bedrock) ? 500 : 80) + (["V", "S", "R", "T"].includes(regime) ? 240 : 20) + geothermal * 0.18 + Math.min(120, crustAge / 18),
      baseMetalOre: 70 + (["v", "b", "m", "s"].includes(bedrock) ? 320 : 60) + (["V", "R", "O", "F"].includes(regime) ? 360 : 25) + geothermal * 0.28,
      preciousMinerals: 45 + (["m", "g", "s"].includes(bedrock) ? 280 : 45) + (["O", "F", "B"].includes(regime) ? 310 : 25) + (["a", "d"].includes(deposit) || river !== "." ? 230 : 0) + Math.min(180, crustAge / 14),
      constructionStone: (land ? 180 : 20) + (["g", "b", "c", "m"].includes(bedrock) ? 430 : 170) + stability * 0.27 + (deposit === "n" ? 170 : 0),
      industrialMinerals: 50 + (["c", "s"].includes(bedrock) ? 460 : 70) + (["B", "P"].includes(regime) ? 260 : 25) + (["e", "l", "d", "a"].includes(deposit) ? 220 : 0) + (aridity < 500 ? 110 : 0),
      chemicalFeedstock: 25 + (["s", "c"].includes(bedrock) ? 340 : 35) + (regime === "B" ? 360 : 25) + (["w", "l", "d"].includes(deposit) || wetland !== "." ? 250 : 0) + productivity * 0.12 + Math.min(120, crustAge / 20),
      manaCrystals: 20 + mana * 0.55 + geothermal * 0.18 + (["m", "v", "b"].includes(bedrock) ? 180 : 35) + (ley === "n" ? 300 : (ley === "c" ? 150 : 0)) - nullStrength * 0.42,
      nullstone: 5 + nullStrength * 0.78 + stability * 0.18 + Math.min(140, crustAge / 20) - mana * 0.28,
      freshWater: waterPotential(map, index),
      biologicalProductivity: (land ? productivity : productivity * 0.72) + Math.min(120, rainfall * 0.035),
      timberFiber: land ? forest + Math.min(100, rainfall * 0.025) : 5,
      geothermalEnergy: geothermal * 0.78 + map.naturalHazards.volcanicPermille[index] * 0.22 + (["V", "R", "S"].includes(regime) ? 180 : 0) + 20,
    };
  }

  function surfaceAccessibility(map, index) {
    if (map.surface.classes[index] === "W") {
      return Math.round(clamp(260 - Math.max(0, -map.relief.elevationM[index]) * 0.025, 20, 300));
    }
    const slopePenalty = Math.min(460, map.relief.slopePermille[index] * 12);
    const reliefPenalty = ["M", "P"].includes(map.relief.reliefClasses[index]) ? 180 : 0;
    const depositBonus = map.geology.surfaceDepositClasses[index] === "n" ? 130 : 40;
    return Math.round(clamp(800 - slopePenalty - reliefPenalty + depositBonus, 80, 980));
  }

  function environmentalDifficulty(map, index) {
    const naturalMaximum = Math.max(...StrategicGeology.HAZARD_FIELDS.map((field) => map.naturalHazards[field][index]));
    const magicalMaximum = Math.max(...ArcaneGeography.MAGICAL_HAZARD_FIELDS.map((field) => map.magicalHazards[field][index]));
    const temperatureC = map.climate.temperatureTenthsC[index] / 10;
    const climatePenalty = Math.max(0, Math.abs(temperatureC - 18) - 12) * 18 + map.climate.snowIcePermille[index] * 0.12;
    const slopePenalty = Math.min(260, map.relief.slopePermille[index] * 7);
    return Math.round(clamp(naturalMaximum * 0.35 + magicalMaximum * 0.32 + climatePenalty + slopePenalty, 20, 1000));
  }

  function depthClass(map, index, familyId, potential, noise) {
    const exposed = map.geology.surfaceDepositClasses[index] === "n";
    const basin = map.geology.tectonicRegimeClasses[index] === "B";
    let score = 520 - potential * 0.26 + noise * 260 + (exposed ? -240 : 0) + (basin ? 170 : 0);
    if (["chemicalFeedstock", "nullstone"].includes(familyId)) score += 150;
    if (familyId === "constructionStone") score -= 230;
    if (score < 190) return "e";
    if (score < 430) return "s";
    if (score < 690) return "d";
    return "v";
  }

  function continuityClass(potential, provinceNoise) {
    const score = potential * 0.78 + provinceNoise * 230;
    if (score >= 720) return "e";
    if (score >= 510) return "r";
    if (score >= 300) return "d";
    return "p";
  }

  function resourcePotentialCore(resources) {
    return {
      version: resources.version,
      sourceGeologyDigest: resources.sourceGeologyDigest,
      sourceNaturalHazardDigest: resources.sourceNaturalHazardDigest,
      sourceClimateDigest: resources.sourceClimateDigest,
      sourceHydrologyDigest: resources.sourceHydrologyDigest,
      sourceBiomeDigest: resources.sourceBiomeDigest,
      sourceArcaneGeographyDigest: resources.sourceArcaneGeographyDigest,
      sourceMagicalHazardDigest: resources.sourceMagicalHazardDigest,
      potentialPermille: resources.potentialPermille,
      surfaceAccessibilityPermille: resources.surfaceAccessibilityPermille,
      environmentalDifficultyPermille: resources.environmentalDifficultyPermille,
      typicalDepthClasses: resources.typicalDepthClasses,
      continuityClasses: resources.continuityClasses,
      diagnostics: resources.diagnostics
    };
  }

  function createResourcePotential(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic resource generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    ArcaneGeography.validateStrategicArcaneGeography(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const potentialPermille = Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.id, new Array(topology.cellCount)]));
    const typicalDepthClasses = Object.fromEntries(EXTRACTIVE_FAMILIES.map((family) => [family.id, new Array(topology.cellCount)]));
    const continuityClasses = Object.fromEntries(EXTRACTIVE_FAMILIES.map((family) => [family.id, new Array(topology.cellCount)]));
    const surfaceAccessibilityPermille = new Array(topology.cellCount);
    const environmentalDifficultyPermille = new Array(topology.cellCount);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const signals = resourceSignals(strategicMap, index);
      const province = strategicMap.geology.provinceByCell[index];
      for (const family of RESOURCE_FAMILIES) {
        const anomaly = (seededNoise(seed, index, `resource-anomaly:${family.id}`) - 0.5) * 190;
        const provinceAnomaly = (seededNoise(seed, province, `resource-province:${family.id}`) - 0.5) * 130;
        const potential = Math.round(clamp(signals[family.id] + anomaly + provinceAnomaly, 0, 1000));
        potentialPermille[family.id][index] = potential;
        if (family.kind === "extractive") {
          typicalDepthClasses[family.id][index] = depthClass(strategicMap, index, family.id, potential, seededNoise(seed, index, `resource-depth:${family.id}`));
          continuityClasses[family.id][index] = continuityClass(potential, seededNoise(seed, province, `resource-continuity:${family.id}`));
        }
      }
      surfaceAccessibilityPermille[index] = surfaceAccessibility(strategicMap, index);
      environmentalDifficultyPermille[index] = environmentalDifficulty(strategicMap, index);
    }
    const resources = {
      version: RESOURCE_POTENTIAL_VERSION,
      sourceGeologyDigest: strategicMap.geology.digest,
      sourceNaturalHazardDigest: strategicMap.naturalHazards.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceHydrologyDigest: strategicMap.hydrology.digest,
      sourceBiomeDigest: strategicMap.biomes.digest,
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceMagicalHazardDigest: strategicMap.magicalHazards.digest,
      potentialPermille,
      surfaceAccessibilityPermille,
      environmentalDifficultyPermille,
      typicalDepthClasses: Object.fromEntries(Object.entries(typicalDepthClasses).map(([id, values]) => [id, values.join("")])),
      continuityClasses: Object.fromEntries(Object.entries(continuityClasses).map(([id, values]) => [id, values.join("")])),
      diagnostics: {
        representedFamilyCount: RESOURCE_FAMILIES.filter((family) => potentialPermille[family.id].some((value) => value >= 600)).length,
        highPotentialCellCounts: Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.id, potentialPermille[family.id].filter((value) => value >= 600).length]))
      }
    };
    resources.digest = `resource-potential-${StrategicWorld.stableHash(resourcePotentialCore(resources))}`;
    return resources;
  }

  function prospectBandCode(value) {
    if (value >= 620) return "3";
    if (value >= 420) return "2";
    if (value >= 220) return "1";
    return "0";
  }

  function confidenceCode(map, index) {
    if (map.surface.classes[index] === "W" && map.relief.reliefClasses[index] !== "S") return "l";
    let score = 390;
    if (map.geology.surfaceDepositClasses[index] === "n") score += 310;
    if (["D", "G", "S", "A"].includes(map.biomes.classes[index])) score += 130;
    if (["R", "B", "F", "W"].includes(map.biomes.classes[index])) score -= 150;
    if (map.geology.surfaceDepositClasses[index] !== "n") score -= 90;
    if (map.relief.slopePermille[index] > 25) score -= 80;
    return score >= 620 ? "h" : (score >= 360 ? "m" : "l");
  }

  function publicProspectCore(prospects) {
    return {
      version: prospects.version,
      sourceResourcePotentialDigest: prospects.sourceResourcePotentialDigest,
      prospectBands: prospects.prospectBands,
      confidenceClasses: prospects.confidenceClasses,
      dominantProspectClasses: prospects.dominantProspectClasses,
      diagnostics: prospects.diagnostics
    };
  }

  function createPublicResourceProspects(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    validateResourcePotential(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const signalsByFamily = {};
    const prospectBands = {};
    for (const family of RESOURCE_FAMILIES) {
      const values = strategicMap.resourcePotential.potentialPermille[family.id];
      const signals = values.map((value, index) => {
        const neighborhood = [index, ...topology.neighbors[index]];
        const neighborhoodMean = neighborhood.reduce((total, cell) => total + values[cell], 0) / neighborhood.length;
        return Math.round(clamp(neighborhoodMean * 0.78 + value * 0.12, 0, 1000));
      });
      signalsByFamily[family.id] = signals;
      prospectBands[family.id] = signals.map(prospectBandCode).join("");
    }
    const percentileByFamily = {};
    for (const family of RESOURCE_FAMILIES) {
      const ranked = signalsByFamily[family.id].map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
      const percentiles = new Array(topology.cellCount);
      ranked.forEach((entry, rank) => { percentiles[entry.index] = rank / Math.max(1, ranked.length - 1); });
      percentileByFamily[family.id] = percentiles;
    }
    const dominantProspectClasses = Array.from({ length: topology.cellCount }, (_, index) => {
      const ranked = RESOURCE_FAMILIES.map((family) => ({
        family,
        score: percentileByFamily[family.id][index] + signalsByFamily[family.id][index] / 5000
      })).sort((left, right) => right.score - left.score || left.family.id.localeCompare(right.family.id));
      return signalsByFamily[ranked[0].family.id][index] < 180 ? "." : ranked[0].family.code;
    }).join("");
    const confidenceClasses = Array.from({ length: topology.cellCount }, (_, index) => confidenceCode(strategicMap, index)).join("");
    const prospects = {
      version: PUBLIC_PROSPECT_VERSION,
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      prospectBands,
      confidenceClasses,
      dominantProspectClasses,
      diagnostics: {
        representedDominantProspectCount: new Set([...dominantProspectClasses].filter((code) => code !== ".")).size,
        confidenceCounts: Object.fromEntries(Object.keys(CONFIDENCE_CLASS_LEGEND).map((code) => [CONFIDENCE_CLASS_LEGEND[code], [...confidenceClasses].filter((value) => value === code).length]))
      }
    };
    prospects.digest = `public-resource-prospects-${StrategicWorld.stableHash(publicProspectCore(prospects))}`;
    return prospects;
  }

  function validatePermilleArray(candidate, field, cellCount, label) {
    if (!Array.isArray(candidate[field]) || candidate[field].length !== cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1000)) throw new Error(`${label} ${field} is incomplete.`);
  }

  function validateResourcePotential(map, candidate = map?.resourcePotential) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== RESOURCE_POTENTIAL_VERSION) throw new Error("Strategic resource-potential record is invalid.");
    for (const family of RESOURCE_FAMILIES) validatePermilleArray(candidate.potentialPermille || {}, family.id, topology.cellCount, "Strategic resource potential");
    validatePermilleArray(candidate, "surfaceAccessibilityPermille", topology.cellCount, "Strategic resource potential");
    validatePermilleArray(candidate, "environmentalDifficultyPermille", topology.cellCount, "Strategic resource potential");
    for (const family of EXTRACTIVE_FAMILIES) {
      if (String(candidate.typicalDepthClasses?.[family.id] || "").length !== topology.cellCount || [...candidate.typicalDepthClasses[family.id]].some((code) => !DEPTH_CLASS_LEGEND[code])) throw new Error(`Strategic resource depth for ${family.id} is invalid.`);
      if (String(candidate.continuityClasses?.[family.id] || "").length !== topology.cellCount || [...candidate.continuityClasses[family.id]].some((code) => !CONTINUITY_CLASS_LEGEND[code])) throw new Error(`Strategic resource continuity for ${family.id} is invalid.`);
    }
    if (candidate.sourceGeologyDigest !== map.geology?.digest || candidate.sourceNaturalHazardDigest !== map.naturalHazards?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceHydrologyDigest !== map.hydrology?.digest || candidate.sourceBiomeDigest !== map.biomes?.digest || candidate.sourceArcaneGeographyDigest !== map.arcaneGeography?.digest || candidate.sourceMagicalHazardDigest !== map.magicalHazards?.digest) throw new Error("Strategic resources do not match their source geography.");
    const expectedDigest = `resource-potential-${StrategicWorld.stableHash(resourcePotentialCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Strategic resource-potential data does not match its digest.");
    return clone(candidate);
  }

  function validatePublicResourceProspects(map, candidate = map?.publicResourceProspects) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== PUBLIC_PROSPECT_VERSION) throw new Error("Public resource-prospect record is invalid.");
    for (const family of RESOURCE_FAMILIES) {
      if (String(candidate.prospectBands?.[family.id] || "").length !== topology.cellCount || [...candidate.prospectBands[family.id]].some((code) => !PROSPECT_BAND_LEGEND[code])) throw new Error(`Public prospect bands for ${family.id} are invalid.`);
    }
    if (String(candidate.confidenceClasses || "").length !== topology.cellCount || [...candidate.confidenceClasses].some((code) => !CONFIDENCE_CLASS_LEGEND[code])) throw new Error("Public prospect confidence is invalid.");
    if (String(candidate.dominantProspectClasses || "").length !== topology.cellCount || [...candidate.dominantProspectClasses].some((code) => !RESOURCE_CLASS_LEGEND[code])) throw new Error("Dominant public prospect classification is invalid.");
    if (candidate.sourceResourcePotentialDigest !== map.resourcePotential?.digest) throw new Error("Public resource prospects do not match their resource endowment.");
    const expectedDigest = `public-resource-prospects-${StrategicWorld.stableHash(publicProspectCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Public resource-prospect data does not match its digest.");
    return clone(candidate);
  }

  function attachResourcePotential(worldSeed, map) {
    let next = StrategicWorld.validateStrategicMap(map);
    next.resourcePotential = createResourcePotential(worldSeed, next);
    next = StrategicWorld.finalizeStrategicMap(next);
    next.publicResourceProspects = createPublicResourceProspects(next);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicReasonFor(map, index, familyId) {
    const regime = StrategicGeology.TECTONIC_REGIME_LEGEND[map.geology.tectonicRegimeClasses[index]];
    const bedrock = StrategicGeology.BEDROCK_CLASS_LEGEND[map.geology.bedrockClasses[index]];
    if (familyId === "ferrousOre") return `${bedrock} bedrock and ${regime}`;
    if (familyId === "baseMetalOre") return `${regime} with geothermal alteration`;
    if (familyId === "preciousMinerals") return map.hydrology.riverClasses[index] !== "." ? "alluvial concentration near a major drainage" : `${regime} mineralization`;
    if (familyId === "constructionStone") return `${bedrock} bedrock with ${map.geology.surfaceDepositClasses[index] === "n" ? "surface exposure" : "overlying deposits"}`;
    if (familyId === "industrialMinerals") return `${bedrock} and basin-like surface deposits`;
    if (familyId === "chemicalFeedstock") return "sedimentary and biological accumulation indicators";
    if (familyId === "manaCrystals") return `${ArcaneGeography.LEY_CLASS_LEGEND[map.arcaneGeography.leyClasses[index]]} and ${ArcaneGeography.ASPECT_CLASS_LEGEND[map.arcaneGeography.primaryAspectClasses[index]]} affinity`;
    if (familyId === "nullstone") return "persistent natural null interference";
    if (familyId === "freshWater") return "visible climate, drainage, and aquifer indicators";
    if (familyId === "biologicalProductivity") return `${Environment.BIOME_CLASS_LEGEND[map.biomes.classes[index]]} productivity indicators`;
    if (familyId === "timberFiber") return `${Environment.BIOME_CLASS_LEGEND[map.biomes.classes[index]]} vegetation indicators`;
    return `${regime} geothermal indicators`;
  }

  function publicCellProspectSnapshot(map, index) {
    if (!map?.publicResourceProspects || !Number.isInteger(index) || index < 0 || index >= map.publicResourceProspects.confidenceClasses.length) return null;
    const dominantId = RESOURCE_CLASS_LEGEND[map.publicResourceProspects.dominantProspectClasses[index]];
    const dominant = RESOURCE_BY_ID[dominantId] || null;
    return {
      dominantProspect: dominant?.id || "noStrongProspect",
      dominantProspectLabel: dominant?.label || "No strong prospect",
      dominantProspectBand: dominant ? PROSPECT_BAND_LEGEND[map.publicResourceProspects.prospectBands[dominant.id][index]] : "minimal",
      inferenceConfidence: CONFIDENCE_CLASS_LEGEND[map.publicResourceProspects.confidenceClasses[index]],
      publicReason: dominant ? publicReasonFor(map, index, dominant.id) : "No public geographic indicator stands out",
      prospectBands: Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.id, PROSPECT_BAND_LEGEND[map.publicResourceProspects.prospectBands[family.id][index]]]))
    };
  }

  function cellResourceTruth(map, index) {
    if (!map?.resourcePotential || !Number.isInteger(index) || index < 0 || index >= map.resourcePotential.surfaceAccessibilityPermille.length) return null;
    return {
      potentialPermille: Object.fromEntries(RESOURCE_FAMILIES.map((family) => [family.id, map.resourcePotential.potentialPermille[family.id][index]])),
      surfaceAccessibilityPermille: map.resourcePotential.surfaceAccessibilityPermille[index],
      environmentalDifficultyPermille: map.resourcePotential.environmentalDifficultyPermille[index],
      typicalDepth: Object.fromEntries(EXTRACTIVE_FAMILIES.map((family) => [family.id, DEPTH_CLASS_LEGEND[map.resourcePotential.typicalDepthClasses[family.id][index]]])),
      continuity: Object.fromEntries(EXTRACTIVE_FAMILIES.map((family) => [family.id, CONTINUITY_CLASS_LEGEND[map.resourcePotential.continuityClasses[family.id][index]]]))
    };
  }

  function localResourceContext(map, index) {
    const truth = cellResourceTruth(map, index);
    if (!truth) return null;
    return {
      version: RESOURCE_POTENTIAL_VERSION,
      resourcePotentialPermille: clone(truth.potentialPermille),
      typicalDepth: clone(truth.typicalDepth),
      continuity: clone(truth.continuity)
    };
  }

  function auditResourcePotential(map) {
    validateResourcePotential(map);
    validatePublicResourceProspects(map);
    const sample = publicCellProspectSnapshot(map, 0);
    const publicProjectionHidesTruth = sample && !Object.keys(sample).some((key) => /permille|depth|continuity|difficulty|accessibility/i.test(key));
    return {
      valid: Boolean(publicProjectionHidesTruth),
      publicProjectionHidesTruth: Boolean(publicProjectionHidesTruth),
      representedFamilyCount: map.resourcePotential.diagnostics.representedFamilyCount,
      representedDominantProspectCount: map.publicResourceProspects.diagnostics.representedDominantProspectCount,
      confidenceCounts: clone(map.publicResourceProspects.diagnostics.confidenceCounts)
    };
  }

  function validateStrategicResources(map) {
    return { resourcePotential: validateResourcePotential(map), publicResourceProspects: validatePublicResourceProspects(map) };
  }

  return Object.freeze({
    RESOURCE_POTENTIAL_VERSION,
    PUBLIC_PROSPECT_VERSION,
    RESOURCE_FAMILIES,
    EXTRACTIVE_FAMILIES,
    RESOURCE_BY_ID,
    RESOURCE_CLASS_LEGEND,
    PROSPECT_BAND_LEGEND,
    CONFIDENCE_CLASS_LEGEND,
    DEPTH_CLASS_LEGEND,
    CONTINUITY_CLASS_LEGEND,
    createResourcePotential,
    validateResourcePotential,
    createPublicResourceProspects,
    validatePublicResourceProspects,
    attachResourcePotential,
    publicCellProspectSnapshot,
    cellResourceTruth,
    localResourceContext,
    auditResourcePotential,
    validateStrategicResources,
    clone
  });
});
