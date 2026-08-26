(function initStrategicArcaneGeography(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const environment = typeof module === "object" && module.exports
    ? require("./climate-hydrology-biomes")
    : root?.HelixClimateHydrologyBiomes;
  const strategicGeology = typeof module === "object" && module.exports
    ? require("./strategic-geology")
    : root?.HelixStrategicGeology;
  const api = factory(strategicWorld, environment, strategicGeology);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicArcaneGeography = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicArcaneGeographyApi(StrategicWorld, Environment, StrategicGeology) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-arcane-geography.js");
  if (!Environment) throw new Error("HelixClimateHydrologyBiomes must load before strategic-arcane-geography.js");
  if (!StrategicGeology) throw new Error("HelixStrategicGeology must load before strategic-arcane-geography.js");

  const ARCANE_GEOGRAPHY_VERSION = 1;
  const MAGICAL_HAZARD_VERSION = 1;
  const DEFAULT_FIELD_WAVE_COUNT = 5;
  const DEFAULT_LEY_CELL_FRACTION = 0.065;
  const ASPECT_CLASS_LEGEND = Object.freeze({
    E: "earth",
    F: "flame",
    W: "water",
    I: "frost",
    S: "storm",
    A: "wind",
    L: "life",
    T: "ether"
  });
  const LEY_CLASS_LEGEND = Object.freeze({ ".": "none", c: "leyCorridor", n: "leyNode" });
  const MAGICAL_HAZARD_CLASS_LEGEND = Object.freeze({
    ".": "none",
    S: "manaSurge",
    T: "arcaneStorm",
    D: "realityDistortion",
    M: "elementalManifestation",
    N: "nullInterference"
  });
  const MAGICAL_HAZARD_FIELDS = Object.freeze([
    "manaSurgePermille",
    "arcaneStormPermille",
    "realityDistortionPermille",
    "elementalManifestationPermille",
    "nullInterferencePermille"
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function dot(left, right) {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
  }

  function randomUnitVector(rng) {
    const y = rng() * 2 - 1;
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  }

  function seededNoise(seed, index, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}:${index}`), 16) / 0xffffffff;
  }

  function planetaryField(seed, waveCount) {
    const rng = StrategicWorld.seededNumbers(`${seed}:planetary-arcane-field:v${ARCANE_GEOGRAPHY_VERSION}`);
    return Array.from({ length: waveCount }, (_, index) => ({
      axis: randomUnitVector(rng).map((value) => Number(value.toFixed(7))),
      frequency: Number((1.8 + index * 0.72 + rng() * 0.65).toFixed(4)),
      phase: Number((rng() * Math.PI * 2).toFixed(5)),
      weight: Number((0.7 + rng() * 0.6).toFixed(4))
    }));
  }

  function fieldAt(position, waves) {
    const values = waves.map((wave) => Math.sin(dot(position, wave.axis) * wave.frequency * Math.PI + wave.phase) * wave.weight);
    const weightTotal = waves.reduce((total, wave) => total + wave.weight, 0);
    const signed = values.reduce((total, value) => total + value, 0) / weightTotal;
    const activity = values.reduce((total, value) => total + Math.abs(value), 0) / weightTotal;
    return {
      signed,
      coherence: Math.abs(signed),
      activity,
      interference: clamp(activity - Math.abs(signed), 0, 1)
    };
  }

  const BEDROCK_CONDUCTIVITY = Object.freeze({ g: 220, b: 510, s: 280, c: 240, m: 630, v: 760, u: 420 });
  const BIOME_LIFE = Object.freeze({
    I: 20, T: 110, B: 500, F: 650, G: 430, S: 240, D: 60, Y: 710, R: 900, A: 100,
    W: 780, p: 60, c: 150, t: 230, w: 360, u: 650, h: 820, o: 180, d: 80
  });

  function waterInfluence(map, index) {
    if (map.hydrology.lakeByCell[index] >= 0) return 300;
    const river = { ".": 0, r: 150, R: 245, G: 330 }[map.hydrology.riverClasses[index]];
    const wetland = map.hydrology.wetlandClasses[index] === "." ? 0 : 240;
    const ocean = map.surface.classes[index] === "W" ? 130 : 0;
    return Math.max(river, wetland, ocean);
  }

  function sourceStrength(map, index, field) {
    const bedrock = map.geology.bedrockClasses[index];
    const conductivity = BEDROCK_CONDUCTIVITY[bedrock] || 300;
    const geothermal = map.geology.geothermalPermille[index];
    const life = BIOME_LIFE[map.biomes.classes[index]] || 100;
    const water = waterInfluence(map, index);
    return clamp(90 + conductivity * 0.28 + geothermal * 0.25 + life * 0.18 + water * 0.2 + field.coherence * 250, 40, 1000);
  }

  function naturalNullStrength(map, index, field) {
    const geologicalQuiet = (map.geology.stabilityPermille[index] - map.geology.geothermalPermille[index] * 0.35) / 1000;
    const raw = field.interference * 760 + geologicalQuiet * 190 - field.coherence * 180;
    return Math.round(clamp((raw - 300) * 2.15, 0, 1000));
  }

  function manaFlow(topology, flowSurface, sourceByCell) {
    const downstreamByCell = new Array(topology.cellCount).fill(-1);
    for (let index = 0; index < topology.cellCount; index += 1) {
      let best = -1;
      for (const neighbor of topology.neighbors[index]) {
        if (flowSurface[neighbor] >= flowSurface[index]) continue;
        if (best < 0 || flowSurface[neighbor] < flowSurface[best] || (flowSurface[neighbor] === flowSurface[best] && neighbor < best)) best = neighbor;
      }
      downstreamByCell[index] = best;
    }
    const accumulation = sourceByCell.map((value) => 0.35 + value / 290);
    const order = Array.from({ length: topology.cellCount }, (_, index) => index)
      .sort((left, right) => flowSurface[right] - flowSurface[left] || left - right);
    for (const index of order) {
      const downstream = downstreamByCell[index];
      if (downstream >= 0) accumulation[downstream] += accumulation[index] * 0.86;
    }
    const maximumLog = Math.log1p(Math.max(...accumulation));
    const strengthPermille = accumulation.map((value) => Math.round(clamp(Math.log1p(value) / maximumLog * 1000, 0, 1000)));
    return { downstreamByCell, accumulation, strengthPermille };
  }

  function leyStructures(topology, flow, requestedFraction) {
    const leyCellCount = clamp(Math.round(topology.cellCount * requestedFraction), 24, Math.round(topology.cellCount * 0.16));
    const ranked = Array.from({ length: topology.cellCount }, (_, index) => index)
      .sort((left, right) => flow.strengthPermille[right] - flow.strengthPermille[left] || left - right);
    const leySet = new Set(ranked.slice(0, leyCellCount));
    const upstreamCounts = new Array(topology.cellCount).fill(0);
    for (const index of leySet) {
      const downstream = flow.downstreamByCell[index];
      if (leySet.has(downstream)) upstreamCounts[downstream] += 1;
    }
    const classes = new Array(topology.cellCount).fill(".");
    const nodeCells = [];
    for (const index of leySet) {
      const downstream = flow.downstreamByCell[index];
      const node = upstreamCounts[index] >= 2 || downstream < 0 || !leySet.has(downstream);
      classes[index] = node ? "n" : "c";
      if (node) nodeCells.push(index);
    }
    const nodes = nodeCells.sort((left, right) => left - right).map((cellIndex, index) => ({
      id: `ley-node:${String(index + 1).padStart(4, "0")}`,
      index,
      cellId: StrategicWorld.cellId(cellIndex),
      kind: flow.downstreamByCell[cellIndex] < 0 ? "sink" : (upstreamCounts[cellIndex] >= 2 ? "confluence" : "terminal"),
      incomingLeyCount: upstreamCounts[cellIndex],
      flowStrengthPermille: flow.strengthPermille[cellIndex]
    }));
    return { classes: classes.join(""), nodes };
  }

  function contiguousNullZones(topology, nullPermille) {
    const eligible = new Set(nullPermille.map((value, index) => value >= 520 ? index : -1).filter((index) => index >= 0));
    const zones = [];
    while (eligible.size) {
      const start = Math.min(...eligible);
      const queue = [start];
      const cells = [];
      eligible.delete(start);
      let cursor = 0;
      while (cursor < queue.length) {
        const current = queue[cursor++];
        cells.push(current);
        for (const neighbor of topology.neighbors[current]) {
          if (!eligible.has(neighbor)) continue;
          eligible.delete(neighbor);
          queue.push(neighbor);
        }
      }
      const anchor = cells.reduce((best, cell) => nullPermille[cell] > nullPermille[best] ? cell : best, cells[0]);
      zones.push({ cells, anchor });
    }
    return zones.map((zone, index) => ({
      id: `natural-null-zone:${String(index + 1).padStart(4, "0")}`,
      index,
      anchorCellId: StrategicWorld.cellId(zone.anchor),
      cellCount: zone.cells.length,
      peakNullPermille: nullPermille[zone.anchor]
    }));
  }

  function aspectScores(seed, map, index, field, concentration) {
    const temperatureC = map.climate.temperatureTenthsC[index] / 10;
    const precipitation = map.climate.precipitationMm[index];
    const snowIce = map.climate.snowIcePermille[index];
    const wind = map.climate.windStrengthPermille[index];
    const geothermal = map.geology.geothermalPermille[index];
    const stability = map.geology.stabilityPermille[index];
    const water = waterInfluence(map, index);
    const life = BIOME_LIFE[map.biomes.classes[index]] || 100;
    const elevation = Math.max(0, map.relief.elevationM[index]);
    const bedrock = map.geology.bedrockClasses[index];
    const noise = (channel) => seededNoise(seed, index, `aspect:${channel}`) * 70;
    return {
      E: stability * 0.55 + elevation * 0.045 + (["g", "m", "u"].includes(bedrock) ? 210 : 40) + noise("earth"),
      F: geothermal * 0.72 + Math.max(0, temperatureC) * 9 + (["v", "b"].includes(bedrock) ? 180 : 20) + noise("flame"),
      W: water * 1.8 + Math.min(360, precipitation * 0.1) + (map.surface.classes[index] === "W" ? 260 : 0) + noise("water"),
      I: snowIce * 0.78 + Math.max(0, -temperatureC) * 13 + noise("frost"),
      S: wind * 0.42 + Math.min(420, precipitation * 0.14) + map.naturalHazards.floodPermille[index] * 0.16 + noise("storm"),
      A: wind * 0.62 + elevation * 0.055 + Math.max(0, 800 - precipitation) * 0.12 + noise("wind"),
      L: life * 0.78 + water * 0.28 + Math.max(0, 28 - Math.abs(18 - temperatureC)) * 5 + noise("life"),
      T: field.coherence * 620 + concentration * 0.3 + map.geology.permeabilityPermille[index] * 0.15 + noise("ether")
    };
  }

  function arcaneGeographyCore(arcane) {
    return {
      version: arcane.version,
      settings: arcane.settings,
      sourceGeologyDigest: arcane.sourceGeologyDigest,
      sourceClimateDigest: arcane.sourceClimateDigest,
      sourceHydrologyDigest: arcane.sourceHydrologyDigest,
      sourceBiomeDigest: arcane.sourceBiomeDigest,
      planetaryField: arcane.planetaryField,
      manaConcentrationPermille: arcane.manaConcentrationPermille,
      manaFlowToCell: arcane.manaFlowToCell,
      manaFlowStrengthPermille: arcane.manaFlowStrengthPermille,
      primaryAspectClasses: arcane.primaryAspectClasses,
      secondaryAspectClasses: arcane.secondaryAspectClasses,
      leyClasses: arcane.leyClasses,
      leyNodes: arcane.leyNodes,
      nullPermille: arcane.nullPermille,
      nullZones: arcane.nullZones,
      arcaneStabilityPermille: arcane.arcaneStabilityPermille,
      diagnostics: arcane.diagnostics
    };
  }

  function createArcaneGeography(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for arcane-geography generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicGeology.validateStrategicGeology(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const waveCount = clamp(Math.round(Number(options.fieldWaveCount) || DEFAULT_FIELD_WAVE_COUNT), 3, 9);
    const leyCellFraction = clamp(Number(options.leyCellFraction) || DEFAULT_LEY_CELL_FRACTION, 0.025, 0.16);
    const waves = planetaryField(seed, waveCount);
    const fields = topology.vertices.map((position) => fieldAt(position, waves));
    const sourceByCell = fields.map((field, index) => sourceStrength(strategicMap, index, field));
    const nullPermille = fields.map((field, index) => naturalNullStrength(strategicMap, index, field));
    const flowSurface = fields.map((field, index) => (
      sourceByCell[index] + field.signed * 240 + strategicMap.relief.elevationM[index] * 0.012 + seededNoise(seed, index, "mana-flow") * 18 + index * 1e-9
    ));
    const flow = manaFlow(topology, flowSurface, sourceByCell);
    const ley = leyStructures(topology, flow, leyCellFraction);
    const manaConcentrationPermille = sourceByCell.map((source, index) => Math.round(clamp(
      source * 0.72 + flow.strengthPermille[index] * 0.3 - nullPermille[index] * 0.55,
      0,
      1000
    )));
    const primaryAspects = new Array(topology.cellCount);
    const secondaryAspects = new Array(topology.cellCount);
    const arcaneStabilityPermille = new Array(topology.cellCount);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const ranked = Object.entries(aspectScores(seed, strategicMap, index, fields[index], manaConcentrationPermille[index]))
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
      primaryAspects[index] = ranked[0][0];
      secondaryAspects[index] = ranked[1][0];
      arcaneStabilityPermille[index] = Math.round(clamp(
        720 + strategicMap.geology.stabilityPermille[index] * 0.25 - fields[index].activity * 210 - flow.strengthPermille[index] * 0.2 - nullPermille[index] * 0.24,
        20,
        980
      ));
    }
    const nullZones = contiguousNullZones(topology, nullPermille);
    const aspectCounts = Object.fromEntries(Object.keys(ASPECT_CLASS_LEGEND).map((code) => [ASPECT_CLASS_LEGEND[code], primaryAspects.filter((value) => value === code).length]));
    const arcane = {
      version: ARCANE_GEOGRAPHY_VERSION,
      settings: { fieldWaveCount: waveCount, leyCellFraction },
      sourceGeologyDigest: strategicMap.geology.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceHydrologyDigest: strategicMap.hydrology.digest,
      sourceBiomeDigest: strategicMap.biomes.digest,
      planetaryField: waves,
      manaConcentrationPermille,
      manaFlowToCell: flow.downstreamByCell,
      manaFlowStrengthPermille: flow.strengthPermille,
      primaryAspectClasses: primaryAspects.join(""),
      secondaryAspectClasses: secondaryAspects.join(""),
      leyClasses: ley.classes,
      leyNodes: ley.nodes,
      nullPermille,
      nullZones,
      arcaneStabilityPermille,
      diagnostics: {
        leyCellCount: [...ley.classes].filter((value) => value !== ".").length,
        leyNodeCount: ley.nodes.length,
        naturalNullCellCount: nullPermille.filter((value) => value >= 520).length,
        naturalNullZoneCount: nullZones.length,
        representedPrimaryAspectCount: Object.values(aspectCounts).filter((count) => count > 0).length,
        primaryAspectCounts: aspectCounts
      }
    };
    arcane.digest = `arcane-geography-${StrategicWorld.stableHash(arcaneGeographyCore(arcane))}`;
    return arcane;
  }

  function validatePermilleArray(candidate, field, cellCount, label = "Arcane geography") {
    if (!Array.isArray(candidate[field]) || candidate[field].length !== cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1000)) throw new Error(`${label} ${field} is incomplete.`);
  }

  function validateArcaneGeography(map, candidate = map?.arcaneGeography) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== ARCANE_GEOGRAPHY_VERSION) throw new Error("Arcane-geography record is invalid.");
    if (!Array.isArray(candidate.planetaryField) || candidate.planetaryField.length < 3 || candidate.planetaryField.some((wave) => !Array.isArray(wave.axis) || wave.axis.length !== 3 || wave.axis.some((value) => !Number.isFinite(value)) || !Number.isFinite(wave.frequency) || !Number.isFinite(wave.phase) || !Number.isFinite(wave.weight))) throw new Error("Planetary arcane field is invalid.");
    for (const field of ["manaConcentrationPermille", "manaFlowStrengthPermille", "nullPermille", "arcaneStabilityPermille"]) validatePermilleArray(candidate, field, topology.cellCount);
    if (!Array.isArray(candidate.manaFlowToCell) || candidate.manaFlowToCell.length !== topology.cellCount) throw new Error("Arcane mana flow is incomplete.");
    for (let index = 0; index < topology.cellCount; index += 1) {
      const downstream = candidate.manaFlowToCell[index];
      if (!Number.isInteger(downstream) || (downstream >= 0 && !topology.neighbors[index].includes(downstream))) throw new Error("Arcane mana flow must follow adjacent strategic cells.");
    }
    if (!flowIsAcyclic({ arcaneGeography: candidate })) throw new Error("Arcane mana flow must be acyclic.");
    for (const field of ["primaryAspectClasses", "secondaryAspectClasses"]) {
      if (String(candidate[field] || "").length !== topology.cellCount || [...candidate[field]].some((code) => !ASPECT_CLASS_LEGEND[code])) throw new Error(`Arcane geography ${field} is invalid.`);
    }
    if ([...candidate.primaryAspectClasses].some((code, index) => code === candidate.secondaryAspectClasses[index])) throw new Error("Primary and secondary arcane aspects must differ.");
    if (String(candidate.leyClasses || "").length !== topology.cellCount || [...candidate.leyClasses].some((code) => !LEY_CLASS_LEGEND[code])) throw new Error("Ley classification is invalid.");
    if (!Array.isArray(candidate.leyNodes) || candidate.leyNodes.length !== [...candidate.leyClasses].filter((code) => code === "n").length || candidate.leyNodes.some((node, index) => node.index !== index || node.id !== `ley-node:${String(index + 1).padStart(4, "0")}` || candidate.leyClasses[StrategicWorld.cellIndex(node.cellId)] !== "n")) throw new Error("Ley-node records are invalid.");
    const rebuiltNullZones = contiguousNullZones(topology, candidate.nullPermille);
    if (!Array.isArray(candidate.nullZones) || JSON.stringify(candidate.nullZones) !== JSON.stringify(rebuiltNullZones)) throw new Error("Natural null-zone records are invalid.");
    if (candidate.sourceGeologyDigest !== map.geology?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceHydrologyDigest !== map.hydrology?.digest || candidate.sourceBiomeDigest !== map.biomes?.digest) throw new Error("Arcane geography does not match its physical sources.");
    const expectedDigest = `arcane-geography-${StrategicWorld.stableHash(arcaneGeographyCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Arcane-geography data does not match its digest.");
    return clone(candidate);
  }

  function magicalHazardCore(hazards) {
    return {
      version: hazards.version,
      sourceArcaneGeographyDigest: hazards.sourceArcaneGeographyDigest,
      sourceClimateDigest: hazards.sourceClimateDigest,
      sourceGeologyDigest: hazards.sourceGeologyDigest,
      manaSurgePermille: hazards.manaSurgePermille,
      arcaneStormPermille: hazards.arcaneStormPermille,
      realityDistortionPermille: hazards.realityDistortionPermille,
      elementalManifestationPermille: hazards.elementalManifestationPermille,
      nullInterferencePermille: hazards.nullInterferencePermille,
      dominantClasses: hazards.dominantClasses,
      diagnostics: hazards.diagnostics
    };
  }

  function createMagicalHazards(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for magical-hazard generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    validateArcaneGeography(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const values = Object.fromEntries(MAGICAL_HAZARD_FIELDS.map((field) => [field, new Array(topology.cellCount)]));
    const dominantClasses = new Array(topology.cellCount);
    const codeByField = { manaSurgePermille: "S", arcaneStormPermille: "T", realityDistortionPermille: "D", elementalManifestationPermille: "M", nullInterferencePermille: "N" };
    for (let index = 0; index < topology.cellCount; index += 1) {
      const concentration = strategicMap.arcaneGeography.manaConcentrationPermille[index];
      const flow = strategicMap.arcaneGeography.manaFlowStrengthPermille[index];
      const instability = 1000 - strategicMap.arcaneGeography.arcaneStabilityPermille[index];
      const nullStrength = strategicMap.arcaneGeography.nullPermille[index];
      const aspect = strategicMap.arcaneGeography.primaryAspectClasses[index];
      const ley = strategicMap.arcaneGeography.leyClasses[index];
      const noise = seededNoise(seed, index, "magical-hazards") * 65;
      values.manaSurgePermille[index] = Math.round(clamp(concentration * 0.5 + flow * 0.3 + instability * 0.25 + (ley === "n" ? 170 : (ley === "c" ? 80 : 0)) + noise - nullStrength * 0.3, 5, 1000));
      values.arcaneStormPermille[index] = Math.round(clamp(concentration * 0.22 + strategicMap.climate.windStrengthPermille[index] * 0.15 + Math.min(260, strategicMap.climate.precipitationMm[index] * 0.065) + (aspect === "S" || aspect === "A" ? 180 : 15) + noise, 5, 1000));
      values.realityDistortionPermille[index] = Math.round(clamp(concentration * 0.34 + instability * 0.42 + flow * 0.18 + (aspect === "T" ? 230 : 25) + (ley === "n" ? 120 : 0) + noise, 5, 1000));
      values.elementalManifestationPermille[index] = Math.round(clamp(concentration * 0.47 + instability * 0.19 + (aspect === "T" ? 40 : 180) + (strategicMap.biomes.classes[index] === "R" || strategicMap.biomes.classes[index] === "W" ? 75 : 0) + noise, 5, 1000));
      values.nullInterferencePermille[index] = Math.round(clamp(nullStrength * 0.86 + instability * 0.22 + noise, 5, 1000));
      const ranked = MAGICAL_HAZARD_FIELDS.map((field) => [field, values[field][index]]).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
      dominantClasses[index] = ranked[0][1] < 380 ? "." : codeByField[ranked[0][0]];
    }
    const hazards = {
      version: MAGICAL_HAZARD_VERSION,
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceGeologyDigest: strategicMap.geology.digest,
      ...values,
      dominantClasses: dominantClasses.join(""),
      diagnostics: {
        highHazardCellCount: Array.from({ length: topology.cellCount }, (_, index) => index).filter((index) => MAGICAL_HAZARD_FIELDS.some((field) => values[field][index] >= 700)).length,
        dominantHazardCounts: Object.fromEntries(Object.keys(MAGICAL_HAZARD_CLASS_LEGEND).map((code) => [MAGICAL_HAZARD_CLASS_LEGEND[code], dominantClasses.filter((value) => value === code).length]))
      }
    };
    hazards.digest = `magical-hazards-${StrategicWorld.stableHash(magicalHazardCore(hazards))}`;
    return hazards;
  }

  function validateMagicalHazards(map, candidate = map?.magicalHazards) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== MAGICAL_HAZARD_VERSION) throw new Error("Magical-hazard record is invalid.");
    for (const field of MAGICAL_HAZARD_FIELDS) validatePermilleArray(candidate, field, topology.cellCount, "Magical hazard");
    if (String(candidate.dominantClasses || "").length !== topology.cellCount || [...candidate.dominantClasses].some((code) => !MAGICAL_HAZARD_CLASS_LEGEND[code])) throw new Error("Dominant magical-hazard classification is invalid.");
    if (candidate.sourceArcaneGeographyDigest !== map.arcaneGeography?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceGeologyDigest !== map.geology?.digest) throw new Error("Magical hazards do not match their source geography.");
    const expectedDigest = `magical-hazards-${StrategicWorld.stableHash(magicalHazardCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Magical-hazard data does not match its digest.");
    return clone(candidate);
  }

  function attachArcaneGeography(worldSeed, map, options = {}) {
    let next = StrategicWorld.validateStrategicMap(map);
    next.arcaneGeography = createArcaneGeography(worldSeed, next, options);
    next = StrategicWorld.finalizeStrategicMap(next);
    next.magicalHazards = createMagicalHazards(worldSeed, next);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function flowIsAcyclic(map) {
    const downstream = map.arcaneGeography.manaFlowToCell;
    for (let start = 0; start < downstream.length; start += 1) {
      const seen = new Set();
      let current = start;
      while (current >= 0) {
        if (seen.has(current)) return false;
        seen.add(current);
        current = downstream[current];
      }
    }
    return true;
  }

  function auditArcaneGeography(map) {
    validateArcaneGeography(map);
    validateMagicalHazards(map);
    const acyclicFlow = flowIsAcyclic(map);
    return {
      valid: acyclicFlow,
      acyclicFlow,
      leyCellCount: map.arcaneGeography.diagnostics.leyCellCount,
      leyNodeCount: map.arcaneGeography.diagnostics.leyNodeCount,
      naturalNullCellCount: map.arcaneGeography.diagnostics.naturalNullCellCount,
      naturalNullZoneCount: map.arcaneGeography.diagnostics.naturalNullZoneCount,
      representedPrimaryAspectCount: map.arcaneGeography.diagnostics.representedPrimaryAspectCount,
      highMagicalHazardCellCount: map.magicalHazards.diagnostics.highHazardCellCount,
      dominantHazardCounts: clone(map.magicalHazards.diagnostics.dominantHazardCounts)
    };
  }

  function tendencyBand(value) {
    if (value >= 800) return "extreme";
    if (value >= 600) return "high";
    if (value >= 400) return "moderate";
    if (value >= 200) return "low";
    return "minimal";
  }

  function cellArcaneSnapshot(map, index) {
    if (!map?.arcaneGeography || !map?.magicalHazards || !Number.isInteger(index) || index < 0 || index >= map.arcaneGeography.manaConcentrationPermille.length) return null;
    const downstream = map.arcaneGeography.manaFlowToCell[index];
    const hazardValues = Object.fromEntries(MAGICAL_HAZARD_FIELDS.map((field) => [field.replace("Permille", ""), map.magicalHazards[field][index]]));
    return {
      manaConcentrationBand: tendencyBand(map.arcaneGeography.manaConcentrationPermille[index]),
      manaFlowTowardCellId: downstream >= 0 ? StrategicWorld.cellId(downstream) : null,
      manaFlowStrengthBand: tendencyBand(map.arcaneGeography.manaFlowStrengthPermille[index]),
      primaryAspect: ASPECT_CLASS_LEGEND[map.arcaneGeography.primaryAspectClasses[index]],
      secondaryAspect: ASPECT_CLASS_LEGEND[map.arcaneGeography.secondaryAspectClasses[index]],
      leyStructure: LEY_CLASS_LEGEND[map.arcaneGeography.leyClasses[index]],
      nullIntensityBand: tendencyBand(map.arcaneGeography.nullPermille[index]),
      arcaneStabilityBand: tendencyBand(map.arcaneGeography.arcaneStabilityPermille[index]),
      dominantMagicalHazard: MAGICAL_HAZARD_CLASS_LEGEND[map.magicalHazards.dominantClasses[index]],
      magicalHazardBands: Object.fromEntries(Object.entries(hazardValues).map(([key, value]) => [key, tendencyBand(value)]))
    };
  }

  function localArcaneContext(map, index) {
    const snapshot = cellArcaneSnapshot(map, index);
    if (!snapshot) return null;
    return {
      version: ARCANE_GEOGRAPHY_VERSION,
      manaPermille: map.arcaneGeography.manaConcentrationPermille[index],
      nullPermille: map.arcaneGeography.nullPermille[index],
      primaryAspect: snapshot.primaryAspect,
      secondaryAspect: snapshot.secondaryAspect,
      leyStructure: snapshot.leyStructure,
      arcaneStabilityPermille: map.arcaneGeography.arcaneStabilityPermille[index],
      magicalHazardPermille: Object.fromEntries(MAGICAL_HAZARD_FIELDS.map((field) => [field.replace("Permille", ""), map.magicalHazards[field][index]]))
    };
  }

  function validateStrategicArcaneGeography(map) {
    return { arcaneGeography: validateArcaneGeography(map), magicalHazards: validateMagicalHazards(map) };
  }

  return Object.freeze({
    ARCANE_GEOGRAPHY_VERSION,
    MAGICAL_HAZARD_VERSION,
    DEFAULT_FIELD_WAVE_COUNT,
    DEFAULT_LEY_CELL_FRACTION,
    ASPECT_CLASS_LEGEND,
    LEY_CLASS_LEGEND,
    MAGICAL_HAZARD_CLASS_LEGEND,
    MAGICAL_HAZARD_FIELDS,
    createArcaneGeography,
    validateArcaneGeography,
    createMagicalHazards,
    validateMagicalHazards,
    attachArcaneGeography,
    validateStrategicArcaneGeography,
    auditArcaneGeography,
    cellArcaneSnapshot,
    localArcaneContext,
    tendencyBand,
    clone
  });
});
