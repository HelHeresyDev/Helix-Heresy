(function initStrategicGeology(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const planetaryRelief = typeof module === "object" && module.exports
    ? require("./planetary-relief")
    : root?.HelixPlanetaryRelief;
  const environment = typeof module === "object" && module.exports
    ? require("./climate-hydrology-biomes")
    : root?.HelixClimateHydrologyBiomes;
  const api = factory(strategicWorld, planetaryRelief, environment);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicGeology = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicGeologyApi(StrategicWorld, PlanetaryRelief, Environment) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-geology.js");
  if (!PlanetaryRelief) throw new Error("HelixPlanetaryRelief must load before strategic-geology.js");
  if (!Environment) throw new Error("HelixClimateHydrologyBiomes must load before strategic-geology.js");

  const GEOLOGY_VERSION = 1;
  const NATURAL_HAZARD_VERSION = 1;
  const DEFAULT_PROVINCE_CELL_TARGET = 72;
  const CRUST_CLASS_LEGEND = Object.freeze({ C: "continentalCrust", O: "oceanicCrust", T: "transitionalCrust" });
  const BEDROCK_CLASS_LEGEND = Object.freeze({
    g: "granitic",
    b: "basaltic",
    s: "siliciclasticSedimentary",
    c: "carbonate",
    m: "metamorphic",
    v: "volcanic",
    u: "ultramafic"
  });
  const SURFACE_DEPOSIT_LEGEND = Object.freeze({
    n: "exposedBedrock",
    a: "alluvium",
    d: "deltaicSediment",
    l: "lacustrineSediment",
    w: "wetlandOrganicDeposit",
    i: "glacialTill",
    v: "volcanicAsh",
    c: "coastalSediment",
    e: "aeolianSand",
    m: "marineSediment"
  });
  const TECTONIC_REGIME_LEGEND = Object.freeze({
    C: "stableInterior",
    O: "orogenicBelt",
    R: "continentalRift",
    F: "transformFaultZone",
    B: "sedimentaryBasin",
    V: "volcanicArc",
    S: "spreadingRidge",
    T: "subductionTrench",
    P: "passiveMargin",
    A: "abyssalPlate"
  });
  const HAZARD_CLASS_LEGEND = Object.freeze({
    ".": "none",
    E: "earthquake",
    V: "volcanic",
    L: "landslide",
    S: "subsidence",
    G: "geothermal",
    F: "flood"
  });
  const HAZARD_FIELDS = Object.freeze([
    "earthquakePermille",
    "volcanicPermille",
    "landslidePermille",
    "subsidencePermille",
    "geothermalPermille",
    "floodPermille"
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function seededNoise(seed, index, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}:${index}`), 16) / 0xffffffff;
  }

  function tectonicRegime(map, index) {
    const land = map.surface.classes[index] === "L";
    const boundaryDistance = map.relief.boundaryDistanceByCell[index];
    const boundary = map.relief.boundaries[map.relief.nearestBoundaryByCell[index]];
    const relief = map.relief.reliefClasses[index];
    if (boundaryDistance <= 2 && boundary?.kind === "convergent") return land ? (relief === "M" || relief === "P" ? "O" : "V") : "T";
    if (boundaryDistance <= 2 && boundary?.kind === "divergent") return land ? "R" : "S";
    if (boundaryDistance <= 1 && boundary?.kind === "transform") return "F";
    if (!land) return relief === "S" || relief === "D" ? "P" : "A";
    if (["C", "L", "U"].includes(relief) && map.hydrology.drainageCellCount[index] >= 8) return "B";
    if (relief === "M" || relief === "P") return "O";
    return "C";
  }

  function provinceZone(map, index, regime) {
    if (["O", "V", "T", "R", "S", "F"].includes(regime)) return regime;
    if (map.surface.classes[index] === "W") return map.relief.reliefClasses[index] === "S" ? "shelf" : "deepOcean";
    if (map.hydrology.wetlandClasses[index] !== "." || map.hydrology.lakeByCell[index] >= 0) return "depositional";
    if (["H", "M", "P"].includes(map.relief.reliefClasses[index])) return "highland";
    return regime === "B" ? "basin" : "interior";
  }

  function groupedComponents(map, topology, regimes) {
    const groupKeys = regimes.map((regime, index) => `${map.relief.plateByCell[index]}:${map.surface.classes[index]}:${provinceZone(map, index, regime)}`);
    const seen = new Set();
    const components = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (seen.has(index)) continue;
      const cells = [];
      const queue = [index];
      const key = groupKeys[index];
      seen.add(index);
      let cursor = 0;
      while (cursor < queue.length) {
        const current = queue[cursor++];
        cells.push(current);
        for (const neighbor of topology.neighbors[current]) {
          if (seen.has(neighbor) || groupKeys[neighbor] !== key) continue;
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
      components.push(cells.sort((a, b) => a - b));
    }
    return components;
  }

  function componentSeeds(seed, topology, cells, requestedCount) {
    const seedCount = clamp(requestedCount, 1, cells.length);
    const seeds = [cells.reduce((best, cell) => seededNoise(seed, cell, "province-first") < seededNoise(seed, best, "province-first") ? cell : best, cells[0])];
    while (seeds.length < seedCount) {
      let bestCell = cells[0];
      let bestScore = -Infinity;
      for (const cell of cells) {
        if (seeds.includes(cell)) continue;
        const nearestSeparation = Math.min(...seeds.map((seedCell) => 1 - (
          topology.vertices[cell][0] * topology.vertices[seedCell][0]
          + topology.vertices[cell][1] * topology.vertices[seedCell][1]
          + topology.vertices[cell][2] * topology.vertices[seedCell][2]
        )));
        const score = nearestSeparation + seededNoise(seed, cell, `province-seed:${seeds.length}`) * 0.0002;
        if (score > bestScore) {
          bestScore = score;
          bestCell = cell;
        }
      }
      seeds.push(bestCell);
    }
    return seeds;
  }

  function assignProvinceCells(topology, cells, seeds) {
    const membership = new Set(cells);
    const localProvince = new Map();
    const queue = [];
    seeds.forEach((cell, index) => {
      localProvince.set(cell, index);
      queue.push(cell);
    });
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (!membership.has(neighbor) || localProvince.has(neighbor)) continue;
        localProvince.set(neighbor, localProvince.get(current));
        queue.push(neighbor);
      }
    }
    return localProvince;
  }

  function crustClassFor(map, index) {
    if (map.surface.classes[index] === "L") return "C";
    return ["S", "D"].includes(map.relief.reliefClasses[index]) ? "T" : "O";
  }

  function bedrockForProvince(seed, map, anchorCellIndex, regime) {
    const land = map.surface.classes[anchorCellIndex] === "L";
    const roll = seededNoise(seed, anchorCellIndex, "bedrock");
    if (!land) {
      if (regime === "S" || regime === "V") return roll < 0.76 ? "b" : "v";
      if (regime === "T") return roll < 0.55 ? "b" : "u";
      if (map.relief.reliefClasses[anchorCellIndex] === "S") return roll < 0.5 ? "c" : "s";
      return roll < 0.84 ? "b" : "u";
    }
    if (regime === "O" || regime === "F") return roll < 0.62 ? "m" : "g";
    if (regime === "V" || regime === "R") return roll < 0.65 ? "v" : "b";
    if (regime === "B") return roll < 0.42 ? "s" : (roll < 0.72 ? "c" : "g");
    if (["H", "M", "P"].includes(map.relief.reliefClasses[anchorCellIndex])) return roll < 0.48 ? "g" : "m";
    if (map.biomes.classes[anchorCellIndex] === "D") return roll < 0.5 ? "s" : "g";
    return roll < 0.52 ? "g" : (roll < 0.78 ? "s" : "c");
  }

  function surfaceDepositFor(map, index, regime) {
    if (map.surface.classes[index] === "W") return "m";
    const wetland = map.hydrology.wetlandClasses[index];
    if (wetland === "d") return "d";
    if (wetland === "l" || map.hydrology.lakeByCell[index] >= 0) return "l";
    if (wetland === "m") return "w";
    if (wetland === "f" || map.hydrology.riverClasses[index] !== ".") return "a";
    if (map.climate.snowIcePermille[index] > 720) return "i";
    if (regime === "V" || regime === "R") return "v";
    if (map.relief.coastClasses[index] !== ".") return "c";
    if (map.biomes.classes[index] === "D") return "e";
    return "n";
  }

  const BEDROCK_PROPERTIES = Object.freeze({
    g: { permeability: 170, stability: 850 },
    b: { permeability: 130, stability: 820 },
    s: { permeability: 610, stability: 490 },
    c: { permeability: 690, stability: 540 },
    m: { permeability: 210, stability: 790 },
    v: { permeability: 390, stability: 610 },
    u: { permeability: 100, stability: 880 }
  });

  function geologyCore(geology) {
    return {
      version: geology.version,
      settings: geology.settings,
      sourceReliefDigest: geology.sourceReliefDigest,
      sourceClimateDigest: geology.sourceClimateDigest,
      sourceHydrologyDigest: geology.sourceHydrologyDigest,
      sourceBiomeDigest: geology.sourceBiomeDigest,
      provinces: geology.provinces,
      provinceByCell: geology.provinceByCell,
      crustClasses: geology.crustClasses,
      bedrockClasses: geology.bedrockClasses,
      surfaceDepositClasses: geology.surfaceDepositClasses,
      tectonicRegimeClasses: geology.tectonicRegimeClasses,
      crustAgeMyr: geology.crustAgeMyr,
      permeabilityPermille: geology.permeabilityPermille,
      stabilityPermille: geology.stabilityPermille,
      geothermalPermille: geology.geothermalPermille,
      diagnostics: geology.diagnostics
    };
  }

  function createGeology(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic geology generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    PlanetaryRelief.validateRelief(strategicMap);
    Environment.validateEnvironment(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const provinceCellTarget = clamp(Math.round(Number(options.provinceCellTarget) || DEFAULT_PROVINCE_CELL_TARGET), 24, 180);
    const regimeArray = topology.vertices.map((_, index) => tectonicRegime(strategicMap, index));
    const components = groupedComponents(strategicMap, topology, regimeArray);
    const provinceByCell = new Array(topology.cellCount).fill(-1);
    const provinces = [];
    for (const component of components) {
      const seedCount = Math.max(1, Math.round(component.length / provinceCellTarget));
      const seeds = componentSeeds(seed, topology, component, seedCount);
      const assignment = assignProvinceCells(topology, component, seeds);
      seeds.forEach((anchorCellIndex, localIndex) => {
        const cells = component.filter((cell) => assignment.get(cell) === localIndex);
        const index = provinces.length;
        cells.forEach((cell) => { provinceByCell[cell] = index; });
        const regime = regimeArray[anchorCellIndex];
        provinces.push({
          id: `geologic-province:${String(index + 1).padStart(4, "0")}`,
          index,
          anchorCellId: StrategicWorld.cellId(anchorCellIndex),
          plateId: strategicMap.relief.plates[strategicMap.relief.plateByCell[anchorCellIndex]].id,
          surfaceClass: strategicMap.surface.classes[anchorCellIndex] === "L" ? "land" : "ocean",
          crustClass: CRUST_CLASS_LEGEND[crustClassFor(strategicMap, anchorCellIndex)],
          dominantBedrockClass: BEDROCK_CLASS_LEGEND[bedrockForProvince(seed, strategicMap, anchorCellIndex, regime)],
          dominantTectonicRegime: TECTONIC_REGIME_LEGEND[regime],
          cellCount: cells.length
        });
      });
    }
    const crustClasses = new Array(topology.cellCount);
    const bedrockClasses = new Array(topology.cellCount);
    const surfaceDepositClasses = new Array(topology.cellCount);
    const crustAgeMyr = new Array(topology.cellCount);
    const permeabilityPermille = new Array(topology.cellCount);
    const stabilityPermille = new Array(topology.cellCount);
    const geothermalPermille = new Array(topology.cellCount);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const province = provinces[provinceByCell[index]];
      const bedrockCode = Object.keys(BEDROCK_CLASS_LEGEND).find((code) => BEDROCK_CLASS_LEGEND[code] === province.dominantBedrockClass);
      const regime = regimeArray[index];
      const boundaryDistance = strategicMap.relief.boundaryDistanceByCell[index];
      const boundaryInfluence = clamp(1 - boundaryDistance / 8, 0, 1);
      const fracturePenalty = ["O", "R", "F", "V", "S", "T"].includes(regime) ? 220 * boundaryInfluence : 0;
      const slopePenalty = Math.min(250, strategicMap.relief.slopePermille[index] * 8);
      const noise = seededNoise(seed, index, "geology-properties");
      crustClasses[index] = crustClassFor(strategicMap, index);
      bedrockClasses[index] = bedrockCode;
      surfaceDepositClasses[index] = surfaceDepositFor(strategicMap, index, regime);
      crustAgeMyr[index] = crustClasses[index] === "O"
        ? Math.round(clamp(4 + boundaryDistance * 13 + noise * 35, 1, 240))
        : Math.round(clamp(450 + noise * 2800 - boundaryInfluence * 260, 80, 3500));
      permeabilityPermille[index] = Math.round(clamp(BEDROCK_PROPERTIES[bedrockCode].permeability + fracturePenalty * 0.7 + noise * 80, 40, 950));
      stabilityPermille[index] = Math.round(clamp(BEDROCK_PROPERTIES[bedrockCode].stability - fracturePenalty - slopePenalty + noise * 70, 50, 960));
      const thermalRegime = ["R", "V", "S"].includes(regime) ? 720 : (["O", "T"].includes(regime) ? 430 : 80);
      geothermalPermille[index] = Math.round(clamp(thermalRegime * boundaryInfluence + (bedrockCode === "v" || bedrockCode === "b" ? 120 : 0) + noise * 100, 20, 980));
    }
    const geology = {
      version: GEOLOGY_VERSION,
      settings: { provinceCellTarget },
      sourceReliefDigest: strategicMap.relief.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceHydrologyDigest: strategicMap.hydrology.digest,
      sourceBiomeDigest: strategicMap.biomes.digest,
      provinces,
      provinceByCell,
      crustClasses: crustClasses.join(""),
      bedrockClasses: bedrockClasses.join(""),
      surfaceDepositClasses: surfaceDepositClasses.join(""),
      tectonicRegimeClasses: regimeArray.join(""),
      crustAgeMyr,
      permeabilityPermille,
      stabilityPermille,
      geothermalPermille,
      diagnostics: {
        provinceCount: provinces.length,
        landProvinceCount: provinces.filter((province) => province.surfaceClass === "land").length,
        oceanProvinceCount: provinces.filter((province) => province.surfaceClass === "ocean").length,
        representedBedrockClassCount: new Set(bedrockClasses).size,
        representedTectonicRegimeCount: new Set(regimeArray).size
      }
    };
    geology.digest = `geology-${StrategicWorld.stableHash(geologyCore(geology))}`;
    return geology;
  }

  function validateEncodedClasses(candidate, field, legend, cellCount) {
    if (String(candidate[field] || "").length !== cellCount || [...candidate[field]].some((code) => !legend[code])) throw new Error(`Strategic geology ${field} is invalid.`);
  }

  function validateGeology(map, candidate = map?.geology) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== GEOLOGY_VERSION) throw new Error("Strategic geology record is invalid.");
    if (!Array.isArray(candidate.provinces) || !candidate.provinces.length || candidate.provinces.some((province, index) => province.index !== index || province.id !== `geologic-province:${String(index + 1).padStart(4, "0")}`)) throw new Error("Strategic geology province records are invalid.");
    if (!Array.isArray(candidate.provinceByCell) || candidate.provinceByCell.length !== topology.cellCount) throw new Error("Strategic geology province membership is incomplete.");
    for (const [field, legend] of [["crustClasses", CRUST_CLASS_LEGEND], ["bedrockClasses", BEDROCK_CLASS_LEGEND], ["surfaceDepositClasses", SURFACE_DEPOSIT_LEGEND], ["tectonicRegimeClasses", TECTONIC_REGIME_LEGEND]]) validateEncodedClasses(candidate, field, legend, topology.cellCount);
    for (const field of ["crustAgeMyr", "permeabilityPermille", "stabilityPermille", "geothermalPermille"]) {
      if (!Array.isArray(candidate[field]) || candidate[field].length !== topology.cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error(`Strategic geology ${field} is incomplete.`);
    }
    for (const [field, maximum] of [["crustAgeMyr", 5000], ["permeabilityPermille", 1000], ["stabilityPermille", 1000], ["geothermalPermille", 1000]]) {
      if (candidate[field].some((value) => Number(value) > maximum)) throw new Error(`Strategic geology ${field} exceeds its valid range.`);
    }
    if (candidate.sourceReliefDigest !== map.relief?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceHydrologyDigest !== map.hydrology?.digest || candidate.sourceBiomeDigest !== map.biomes?.digest) throw new Error("Strategic geology does not match its source geography.");
    const counts = new Array(candidate.provinces.length).fill(0);
    for (const provinceIndex of candidate.provinceByCell) {
      if (!Number.isInteger(provinceIndex) || !candidate.provinces[provinceIndex]) throw new Error("Strategic geology province membership is invalid.");
      counts[provinceIndex] += 1;
    }
    if (candidate.provinces.some((province, index) => province.cellCount !== counts[index])) throw new Error("Strategic geology province sizes are inconsistent.");
    const expectedDigest = `geology-${StrategicWorld.stableHash(geologyCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Strategic geology data does not match its digest.");
    return clone(candidate);
  }

  function naturalHazardCore(hazards) {
    return {
      version: hazards.version,
      sourceGeologyDigest: hazards.sourceGeologyDigest,
      sourceReliefDigest: hazards.sourceReliefDigest,
      sourceClimateDigest: hazards.sourceClimateDigest,
      sourceHydrologyDigest: hazards.sourceHydrologyDigest,
      earthquakePermille: hazards.earthquakePermille,
      volcanicPermille: hazards.volcanicPermille,
      landslidePermille: hazards.landslidePermille,
      subsidencePermille: hazards.subsidencePermille,
      geothermalPermille: hazards.geothermalPermille,
      floodPermille: hazards.floodPermille,
      dominantClasses: hazards.dominantClasses,
      diagnostics: hazards.diagnostics
    };
  }

  function createNaturalHazards(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for natural-hazard generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    validateGeology(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const values = Object.fromEntries(HAZARD_FIELDS.map((field) => [field, new Array(topology.cellCount)]));
    const dominantClasses = new Array(topology.cellCount);
    const codeByField = { earthquakePermille: "E", volcanicPermille: "V", landslidePermille: "L", subsidencePermille: "S", geothermalPermille: "G", floodPermille: "F" };
    for (let index = 0; index < topology.cellCount; index += 1) {
      const regime = strategicMap.geology.tectonicRegimeClasses[index];
      const boundaryDistance = strategicMap.relief.boundaryDistanceByCell[index];
      const boundaryInfluence = clamp(1 - boundaryDistance / 8, 0, 1);
      const slope = strategicMap.relief.slopePermille[index];
      const precipitation = strategicMap.climate.precipitationMm[index];
      const bedrock = strategicMap.geology.bedrockClasses[index];
      const wetland = strategicMap.hydrology.wetlandClasses[index];
      const river = strategicMap.hydrology.riverClasses[index];
      const noise = seededNoise(seed, index, "natural-hazards") * 90;
      values.earthquakePermille[index] = Math.round(clamp((regime === "F" ? 900 : (["O", "T"].includes(regime) ? 760 : (["R", "S", "V"].includes(regime) ? 560 : 110))) * boundaryInfluence + noise, 20, 1000));
      values.volcanicPermille[index] = Math.round(clamp((["V", "S"].includes(regime) ? 860 : (regime === "R" ? 620 : (regime === "T" ? 360 : 50))) * Math.max(0.25, boundaryInfluence) + strategicMap.geology.geothermalPermille[index] * 0.18 + noise * 0.5, 10, 1000));
      values.landslidePermille[index] = Math.round(clamp(slope * 18 + Math.min(320, precipitation / 7) + (["s", "c", "v"].includes(bedrock) ? 120 : 30) + noise, 10, 1000));
      values.subsidencePermille[index] = Math.round(clamp((bedrock === "c" ? 520 : (bedrock === "s" ? 260 : 45)) + strategicMap.geology.permeabilityPermille[index] * 0.28 + (wetland !== "." ? 150 : 0) + noise, 10, 1000));
      values.geothermalPermille[index] = Math.round(clamp(strategicMap.geology.geothermalPermille[index] + noise * 0.5, 10, 1000));
      values.floodPermille[index] = Math.round(clamp((river === "G" ? 760 : (river === "R" ? 600 : (river === "r" ? 390 : 45))) + (wetland === "d" ? 280 : (wetland !== "." ? 170 : 0)) + Math.min(180, precipitation / 12) - Math.min(180, slope * 6) + noise, 10, 1000));
      const ranked = HAZARD_FIELDS.map((field) => [field, values[field][index]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      dominantClasses[index] = ranked[0][1] < 180 ? "." : codeByField[ranked[0][0]];
    }
    const encoded = dominantClasses.join("");
    const hazards = {
      version: NATURAL_HAZARD_VERSION,
      sourceGeologyDigest: strategicMap.geology.digest,
      sourceReliefDigest: strategicMap.relief.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceHydrologyDigest: strategicMap.hydrology.digest,
      ...values,
      dominantClasses: encoded,
      diagnostics: {
        highHazardCellCount: topology.vertices.filter((_, index) => HAZARD_FIELDS.some((field) => values[field][index] >= 700)).length,
        dominantHazardCounts: Object.fromEntries(Object.keys(HAZARD_CLASS_LEGEND).map((code) => [HAZARD_CLASS_LEGEND[code], dominantClasses.filter((value) => value === code).length]))
      }
    };
    hazards.digest = `natural-hazards-${StrategicWorld.stableHash(naturalHazardCore(hazards))}`;
    return hazards;
  }

  function validateNaturalHazards(map, candidate = map?.naturalHazards) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== NATURAL_HAZARD_VERSION) throw new Error("Natural-hazard record is invalid.");
    for (const field of HAZARD_FIELDS) {
      if (!Array.isArray(candidate[field]) || candidate[field].length !== topology.cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)) || value < 0 || value > 1000)) throw new Error(`Natural-hazard ${field} is incomplete.`);
    }
    if (String(candidate.dominantClasses || "").length !== topology.cellCount || [...candidate.dominantClasses].some((code) => !HAZARD_CLASS_LEGEND[code])) throw new Error("Dominant natural-hazard classification is invalid.");
    if (candidate.sourceGeologyDigest !== map.geology?.digest || candidate.sourceReliefDigest !== map.relief?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceHydrologyDigest !== map.hydrology?.digest) throw new Error("Natural hazards do not match their source geography.");
    const expectedDigest = `natural-hazards-${StrategicWorld.stableHash(naturalHazardCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Natural-hazard data does not match its digest.");
    return clone(candidate);
  }

  function attachGeology(worldSeed, map, options = {}) {
    let next = StrategicWorld.validateStrategicMap(map);
    next.geology = createGeology(worldSeed, next, options);
    next = StrategicWorld.finalizeStrategicMap(next);
    next.naturalHazards = createNaturalHazards(worldSeed, next);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function provinceIsContiguous(map, provinceIndex) {
    const topology = StrategicWorld.topologyForMap(map);
    const members = map.geology.provinceByCell;
    const start = members.indexOf(provinceIndex);
    if (start < 0) return false;
    const seen = new Set([start]);
    const queue = [start];
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (members[neighbor] !== provinceIndex || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    return seen.size === map.geology.provinces[provinceIndex].cellCount;
  }

  function auditGeology(map) {
    validateGeology(map);
    validateNaturalHazards(map);
    const contiguousProvinces = map.geology.provinces.every((_, index) => provinceIsContiguous(map, index));
    return {
      valid: contiguousProvinces,
      contiguousProvinces,
      provinceCount: map.geology.provinces.length,
      representedBedrockClassCount: map.geology.diagnostics.representedBedrockClassCount,
      representedTectonicRegimeCount: map.geology.diagnostics.representedTectonicRegimeCount,
      highHazardCellCount: map.naturalHazards.diagnostics.highHazardCellCount,
      dominantHazardCounts: clone(map.naturalHazards.diagnostics.dominantHazardCounts)
    };
  }

  function tendencyBand(value) {
    if (value >= 800) return "extreme";
    if (value >= 600) return "high";
    if (value >= 400) return "moderate";
    if (value >= 200) return "low";
    return "minimal";
  }

  function cellGeologySnapshot(map, index) {
    if (!map?.geology || !map?.naturalHazards || !Number.isInteger(index) || index < 0 || index >= map.geology.provinceByCell.length) return null;
    const province = map.geology.provinces[map.geology.provinceByCell[index]];
    const hazardValues = Object.fromEntries(HAZARD_FIELDS.map((field) => [field.replace("Permille", ""), map.naturalHazards[field][index]]));
    return {
      provinceId: province.id,
      plateId: province.plateId,
      crustClass: CRUST_CLASS_LEGEND[map.geology.crustClasses[index]],
      bedrockClass: BEDROCK_CLASS_LEGEND[map.geology.bedrockClasses[index]],
      surfaceDeposit: SURFACE_DEPOSIT_LEGEND[map.geology.surfaceDepositClasses[index]],
      tectonicRegime: TECTONIC_REGIME_LEGEND[map.geology.tectonicRegimeClasses[index]],
      crustAgeMyr: map.geology.crustAgeMyr[index],
      permeabilityBand: tendencyBand(map.geology.permeabilityPermille[index]),
      stabilityBand: tendencyBand(map.geology.stabilityPermille[index]),
      geothermalBand: tendencyBand(map.geology.geothermalPermille[index]),
      dominantHazard: HAZARD_CLASS_LEGEND[map.naturalHazards.dominantClasses[index]],
      hazardBands: Object.fromEntries(Object.entries(hazardValues).map(([key, value]) => [key, tendencyBand(value)]))
    };
  }

  function localGeologyContext(map, index) {
    const snapshot = cellGeologySnapshot(map, index);
    if (!snapshot) return null;
    return {
      version: GEOLOGY_VERSION,
      provinceId: snapshot.provinceId,
      bedrockClass: snapshot.bedrockClass,
      surfaceDeposit: snapshot.surfaceDeposit,
      permeabilityPermille: map.geology.permeabilityPermille[index],
      stabilityPermille: map.geology.stabilityPermille[index],
      geothermalPermille: map.geology.geothermalPermille[index],
      hazardPermille: Object.fromEntries(HAZARD_FIELDS.map((field) => [field.replace("Permille", ""), map.naturalHazards[field][index]]))
    };
  }

  function validateStrategicGeology(map) {
    return { geology: validateGeology(map), naturalHazards: validateNaturalHazards(map) };
  }

  return Object.freeze({
    GEOLOGY_VERSION,
    NATURAL_HAZARD_VERSION,
    DEFAULT_PROVINCE_CELL_TARGET,
    CRUST_CLASS_LEGEND,
    BEDROCK_CLASS_LEGEND,
    SURFACE_DEPOSIT_LEGEND,
    TECTONIC_REGIME_LEGEND,
    HAZARD_CLASS_LEGEND,
    HAZARD_FIELDS,
    createGeology,
    validateGeology,
    createNaturalHazards,
    validateNaturalHazards,
    attachGeology,
    validateStrategicGeology,
    auditGeology,
    cellGeologySnapshot,
    localGeologyContext,
    tendencyBand,
    clone
  });
});
