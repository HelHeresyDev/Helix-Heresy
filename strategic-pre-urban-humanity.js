(function initStrategicPreUrbanHumanity(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const beastEcology = typeof module === "object" && module.exports ? require("./strategic-beast-ecology") : root?.HelixStrategicBeastEcology;
  const api = factory(strategicWorld, beastEcology);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicPreUrbanHumanity = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicPreUrbanHumanityApi(StrategicWorld, StrategicBeastEcology) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-pre-urban-humanity.js");
  if (!StrategicBeastEcology) throw new Error("HelixStrategicBeastEcology must load before strategic-pre-urban-humanity.js");

  const CORE_CAPABILITIES = Object.freeze(["agriculture", "literacy", "metalworking", "establishedMagic"]);
  const CAPABILITY_BANDS = Object.freeze(["practiced", "established", "advanced"]);
  const SUBSISTENCE_MODES = Object.freeze(["mixedFarming", "pastoralCultivation", "agroforestry", "riverHorticulture", "coastalCultivation", "mobileGardenCircuit"]);
  const MOBILITY_PATTERNS = Object.freeze(["settledVillageCluster", "seasonalCircuit", "mobileCaravanNetwork", "riverCircuit", "coastalCircuit"]);
  const CULTURAL_EMPHASES = Object.freeze(["archivalLearning", "ritualStewardship", "craftLineages", "agriculturalCommons", "mobileHospitality", "ecologicalObservation", "oralLaw", "arcaneExperimentation"]);
  const EXTRA_CAPABILITIES = Object.freeze(["navigation", "healing", "animalTraining", "waterEngineering", "stoneConstruction", "longDistanceSignaling", "preservation", "protectiveWards"]);
  const POPULATION_BANDS = Object.freeze(["small", "moderate", "large", "veryLarge"]);
  const BASELINE_POPULATION_BANDS = Object.freeze(["few", "scattered", "numerous", "widespread"]);
  const PEOPLE_OPENINGS = Object.freeze(["Aru", "Bela", "Cera", "Doro", "Eli", "Fara", "Gala", "Hira", "Iona", "Joru", "Kela", "Luma", "Mora", "Nira", "Orin", "Pela", "Quara", "Ravi", "Sela", "Tova"]);
  const PEOPLE_ENDINGS = Object.freeze(["ani", "ari", "eni", "iri", "ori", "uun", "eth", "ai", "esh", "ora", "im", "al"]);
  const LANGUAGE_ENDINGS = Object.freeze(["ic", "ish", "an", "ese", "al", "in", "ari", "speech"]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function pick(values, seed, channel) {
    return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length];
  }

  function title(value) {
    return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
  }

  function waterSignal(map, index) {
    if (map.hydrology.lakeByCell[index] >= 0) return 1000;
    if (map.hydrology.riverClasses[index] === "G") return 950;
    if (map.hydrology.riverClasses[index] === "R") return 850;
    if (map.hydrology.riverClasses[index] === "r") return 700;
    if (map.hydrology.wetlandClasses[index] !== ".") return 620;
    return map.resourcePotential.potentialPermille.freshWater[index];
  }

  function comfortSignal(map, index) {
    const temperature = map.climate.temperatureTenthsC[index] / 10;
    const thermal = clamp(1000 - Math.abs(temperature - 17) * 31, 0, 1000);
    const rain = map.climate.precipitationMm[index];
    const moisture = rain < 220 ? rain * 2.5 : (rain > 2800 ? clamp(1000 - (rain - 2800) * 0.22, 200, 1000) : 1000);
    return thermal * 0.62 + moisture * 0.38;
  }

  function maximumHazard(map, index) {
    return Math.max(
      map.naturalHazards.earthquakePermille[index], map.naturalHazards.volcanicPermille[index], map.naturalHazards.landslidePermille[index], map.naturalHazards.floodPermille[index],
      map.magicalHazards.manaSurgePermille[index], map.magicalHazards.arcaneStormPermille[index], map.magicalHazards.realityDistortionPermille[index]
    );
  }

  function habitationSuitability(map, index, seed = "") {
    if (map.surface.classes[index] !== "L") return 0;
    const resources = map.resourcePotential.potentialPermille;
    const noise = (seededNumber(seed, `habitation:${index}`) - 0.5) * 90;
    return Math.round(clamp(
      waterSignal(map, index) * 0.24 + resources.biologicalProductivity[index] * 0.24 + comfortSignal(map, index) * 0.19
        + map.resourcePotential.surfaceAccessibilityPermille[index] * 0.08 + map.geology.stabilityPermille[index] * 0.1
        + map.arcaneGeography.manaConcentrationPermille[index] * 0.08 - maximumHazard(map, index) * 0.08 + 125 + noise,
      0,
      1000
    ));
  }

  function generatedPeopleName(seed, index, used) {
    const base = `${pick(PEOPLE_OPENINGS, seed, `people-opening:${index}`)}${pick(PEOPLE_ENDINGS, seed, `people-ending:${index}`)}`;
    let name = base;
    let suffix = 2;
    while (used.has(name)) name = `${base} ${suffix++}`;
    used.add(name);
    return name;
  }

  function allocateGroups(map) {
    const regions = map.surface.regions.filter((region) => region.surfaceClass === "land").sort((left, right) => right.cellCount - left.cellCount || left.id.localeCompare(right.id));
    const totalLand = regions.reduce((total, region) => total + region.cellCount, 0);
    const target = clamp(Math.round(totalLand / 165), Math.max(12, regions.length * 3), 30);
    const allocations = regions.map((region) => ({ region, count: Math.min(3, region.cellCount) }));
    let assigned = allocations.reduce((total, entry) => total + entry.count, 0);
    while (assigned < target) {
      const choice = [...allocations].sort((left, right) => (right.region.cellCount / (right.count + 1)) - (left.region.cellCount / (left.count + 1)) || left.region.id.localeCompare(right.region.id))[0];
      choice.count += 1;
      assigned += 1;
    }
    return allocations;
  }

  function selectGroupCenters(map, seed, allocation) {
    const regionIndex = map.surface.regions.findIndex((region) => region.id === allocation.region.id);
    const candidates = Array.from({ length: map.topology.cellCount }, (_, index) => ({ index, score: habitationSuitability(map, index, seed) }))
      .filter((entry) => map.surface.regionByCell[entry.index] === regionIndex && entry.score > 250)
      .sort((left, right) => right.score - left.score || left.index - right.index);
    const selected = [];
    for (const candidate of candidates) {
      if (selected.every((index) => StrategicWorld.greatCircleDistanceKm(map, index, candidate.index) >= 150)) selected.push(candidate.index);
      if (selected.length === allocation.count) break;
    }
    for (const candidate of candidates) {
      if (selected.length === allocation.count) break;
      if (!selected.includes(candidate.index)) selected.push(candidate.index);
    }
    if (selected.length !== allocation.count) throw new Error(`Pre-urban humans cannot establish enough communities in ${allocation.region.id}.`);
    return selected;
  }

  function populationRange(map, centerIndex, radius) {
    const topology = StrategicWorld.topologyForMap(map);
    const regionIndex = map.surface.regionByCell[centerIndex];
    const distance = new Map([[centerIndex, 0]]);
    const queue = [centerIndex];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (distance.get(current) >= radius) continue;
      for (const neighbor of topology.neighbors[current]) {
        if (distance.has(neighbor) || map.surface.classes[neighbor] !== "L" || map.surface.regionByCell[neighbor] !== regionIndex) continue;
        if (habitationSuitability(map, neighbor) < 210) continue;
        distance.set(neighbor, distance.get(current) + 1);
        queue.push(neighbor);
      }
    }
    return [...distance.keys()].sort((left, right) => left - right);
  }

  function populationBand(population) {
    if (population < 3500) return "small";
    if (population < 8000) return "moderate";
    if (population < 15000) return "large";
    return "veryLarge";
  }

  function baselineCountBand(count) {
    if (count <= 1) return "few";
    if (count <= 3) return "scattered";
    if (count <= 5) return "numerous";
    return "widespread";
  }

  function peopleFromRows(record) {
    return record.peopleRows.map((row) => ({ id: row[0], name: row[1], languageName: row[2], culturalEmphasis: CULTURAL_EMPHASES[row[3]] }));
  }

  function expandPopulationGroups(map, record = map?.preUrbanHumanity) {
    if (!record) return [];
    const peoples = peopleFromRows(record);
    return record.groupRows.map((row) => {
      const centerIndex = row[2];
      const rangeIndices = populationRange(map, centerIndex, row[3]);
      const capabilityBands = Object.fromEntries(CORE_CAPABILITIES.map((capability, index) => [capability, CAPABILITY_BANDS[parseInt(row[8][index], 36)]]));
      return {
        id: row[0],
        peopleId: peoples[row[1]].id,
        centerCellId: StrategicWorld.cellId(centerIndex),
        topologyRegionId: map.surface.regions[map.surface.regionByCell[centerIndex]].id,
        rangeCellIds: rangeIndices.map(StrategicWorld.cellId),
        population: row[4],
        supportedCapacity: row[5],
        subsistenceMode: SUBSISTENCE_MODES[row[6]],
        mobilityPattern: MOBILITY_PATTERNS[row[7]],
        capabilities: capabilityBands,
        additionalCapability: EXTRA_CAPABILITIES[row[9]],
        settlementScale: "villagesCampsAndLocalWorkshops",
        infrastructure: ["villageScaleShelter", "localWorkshops", "localArchives", "shrinesAndRitualPlaces"],
        absentInfrastructure: ["fortifiedCity", "industrialGrid", "globalLogistics", "orbitalNetwork"]
      };
    });
  }

  function publicCore(directory) {
    return { peoples: directory.peoples, groupSummaries: directory.groupSummaries, beastBaseline: directory.beastBaseline, sharedCapabilities: directory.sharedCapabilities, absentInfrastructure: directory.absentInfrastructure };
  }

  function humanityCore(record) {
    return {
      sourceResourcePotentialDigest: record.sourceResourcePotentialDigest,
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      sourcePristineBeastEcologyDigest: record.sourcePristineBeastEcologyDigest,
      peopleRows: record.peopleRows,
      groupRows: record.groupRows,
      publicDirectoryDigest: record.publicDirectoryDigest,
      diagnostics: record.diagnostics
    };
  }

  function buildPublicDirectory(map, record, expandedGroups = null) {
    const groups = expandedGroups || expandPopulationGroups(map, record);
    const pristine = StrategicBeastEcology.expandPristineBeastEcology(map);
    const directory = {
      peoples: peopleFromRows(record),
      groupSummaries: groups.map((group) => ({ id: group.id, peopleId: group.peopleId, topologyRegionId: group.topologyRegionId, populationBand: populationBand(group.population), subsistenceMode: group.subsistenceMode, mobilityPattern: group.mobilityPattern, capabilities: clone(group.capabilities), additionalCapability: group.additionalCapability, locationPrecision: "broadHistoricalRegionOnly" })),
      beastBaseline: StrategicBeastEcology.BEAST_SPECIES.map((species) => ({ speciesId: species.id, pristinePopulationBand: baselineCountBand(pristine.populations.filter((population) => population.speciesId === species.id).length), exactPopulationCountPublic: false })),
      sharedCapabilities: clone(CORE_CAPABILITIES),
      absentInfrastructure: ["fortifiedCities", "industrialGrids", "globalPhysicalLogistics", "orbitalInternet"]
    };
    directory.digest = `public-pre-urban-${StrategicWorld.stableHash(publicCore(directory))}`;
    return directory;
  }

  function createPreUrbanHumanity(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for pre-urban humanity.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicBeastEcology.validatePristineBeastEcology(strategicMap);
    if (strategicMap.humanGeography || strategicMap.cityPolities) throw new Error("Pre-urban humanity must be generated before cities.");
    const allocations = allocateGroups(strategicMap);
    const centers = allocations.flatMap((allocation) => selectGroupCenters(strategicMap, seed, allocation));
    const peopleCount = clamp(Math.round(centers.length / 3), 6, 10);
    const usedNames = new Set();
    const peopleRows = Array.from({ length: peopleCount }, (_, index) => {
      const name = generatedPeopleName(seed, index, usedNames);
      return [`people:${String(index + 1).padStart(2, "0")}`, name, `${name}${pick(LANGUAGE_ENDINGS, seed, `language:${index}`)}`, Math.floor(seededNumber(seed, `emphasis:${index}`) * CULTURAL_EMPHASES.length) % CULTURAL_EMPHASES.length];
    });
    const groupRows = centers.map((centerIndex, index) => {
      const radius = 2 + Math.floor(seededNumber(seed, `group-radius:${index}`) * 3);
      const range = populationRange(strategicMap, centerIndex, radius);
      const capacity = Math.max(1800, Math.round(range.reduce((total, cellIndex) => total + habitationSuitability(strategicMap, cellIndex), 0) * 3.4));
      const population = Math.max(900, Math.round(capacity * (0.42 + seededNumber(seed, `group-population:${index}`) * 0.38)));
      const capabilityCodes = CORE_CAPABILITIES.map((capability) => (1 + Math.floor(seededNumber(seed, `capability:${index}:${capability}`) * 2)).toString(36)).join("");
      return [
        `human-population:${String(index + 1).padStart(3, "0")}`,
        Math.floor(seededNumber(seed, `group-people:${index}`) * peopleCount) % peopleCount,
        centerIndex,
        radius,
        population,
        capacity,
        Math.floor(seededNumber(seed, `subsistence:${index}`) * SUBSISTENCE_MODES.length) % SUBSISTENCE_MODES.length,
        Math.floor(seededNumber(seed, `mobility:${index}`) * MOBILITY_PATTERNS.length) % MOBILITY_PATTERNS.length,
        capabilityCodes,
        Math.floor(seededNumber(seed, `extra-capability:${index}`) * EXTRA_CAPABILITIES.length) % EXTRA_CAPABILITIES.length
      ];
    });
    const groups = expandPopulationGroups(strategicMap, { peopleRows, groupRows });
    const directory = buildPublicDirectory(strategicMap, { peopleRows, groupRows }, groups);
    const record = {
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourcePristineBeastEcologyDigest: strategicMap.pristineBeastEcology.digest,
      peopleRows,
      groupRows,
      publicDirectoryDigest: directory.digest,
      diagnostics: {
        peopleCount: peopleRows.length,
        populationGroupCount: groupRows.length,
        totalPopulation: groups.reduce((total, group) => total + group.population, 0),
        representedLandRegionCount: new Set(groups.map((group) => group.topologyRegionId)).size,
        agricultureCapableGroupCount: groups.filter((group) => group.capabilities.agriculture).length,
        literacyCapableGroupCount: groups.filter((group) => group.capabilities.literacy).length,
        metalworkingCapableGroupCount: groups.filter((group) => group.capabilities.metalworking).length,
        establishedMagicGroupCount: groups.filter((group) => group.capabilities.establishedMagic).length,
        cityCount: 0
      }
    };
    record.digest = `pre-urban-humanity-${StrategicWorld.stableHash(humanityCore(record))}`;
    return { record, directory };
  }

  function validatePreUrbanHumanity(map, record = map?.preUrbanHumanity, directory = map?.publicPreUrbanOverview) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicBeastEcology.validatePristineBeastEcology(strategicMap);
    if (!record || record.sourceResourcePotentialDigest !== strategicMap.resourcePotential?.digest || record.sourceArcaneGeographyDigest !== strategicMap.arcaneGeography?.digest || record.sourcePristineBeastEcologyDigest !== strategicMap.pristineBeastEcology.digest || !Array.isArray(record.peopleRows) || !Array.isArray(record.groupRows)) throw new Error("Pre-urban humanity is incomplete or does not match its causal world.");
    const peoples = peopleFromRows(record);
    const groups = expandPopulationGroups(strategicMap, record);
    const effectiveDirectory = directory || buildPublicDirectory(strategicMap, record, groups);
    if (record.publicDirectoryDigest !== effectiveDirectory.digest) throw new Error("Pre-urban humanity does not match its public projection.");
    if (peoples.length < 6 || new Set(peoples.map((people) => people.id)).size !== peoples.length || new Set(peoples.map((people) => people.name)).size !== peoples.length) throw new Error("Pre-urban peoples require stable unique identities.");
    if (groups.length < 12 || new Set(groups.map((group) => group.id)).size !== groups.length || groups.some((group) => !peoples.some((people) => people.id === group.peopleId) || group.population < 1 || group.supportedCapacity < group.population || strategicMap.surface.classes[StrategicWorld.cellIndex(group.centerCellId)] !== "L" || group.rangeCellIds.some((cellId) => strategicMap.surface.classes[StrategicWorld.cellIndex(cellId)] !== "L") || CORE_CAPABILITIES.some((capability) => !CAPABILITY_BANDS.includes(group.capabilities[capability])) || !group.absentInfrastructure.includes("fortifiedCity"))) throw new Error("Pre-urban population groups have invalid physical or capability facts.");
    const landRegionCount = strategicMap.surface.regions.filter((region) => region.surfaceClass === "land").length;
    if (new Set(groups.map((group) => group.topologyRegionId)).size !== landRegionCount) throw new Error("Every connected land region requires pre-urban human presence.");
    if (JSON.stringify(record).match(/cityPolities|humanGeography|corridor|humanControl|beastPressure/i)) throw new Error("Pre-urban humanity leaks later urban causes into its canonical record.");
    if (effectiveDirectory.groupSummaries.some((summary) => Object.hasOwn(summary, "centerCellId") || Object.hasOwn(summary, "rangeCellIds") || Object.hasOwn(summary, "population") || summary.locationPrecision !== "broadHistoricalRegionOnly") || effectiveDirectory.beastBaseline.some((entry) => entry.exactPopulationCountPublic !== false || Object.hasOwn(entry, "populationCount"))) throw new Error("The public pre-urban overview leaks exact population geography or pristine beast counts.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.peopleCount !== peoples.length || diagnostics.populationGroupCount !== groups.length || diagnostics.totalPopulation !== groups.reduce((total, group) => total + group.population, 0) || diagnostics.representedLandRegionCount !== landRegionCount || diagnostics.agricultureCapableGroupCount !== groups.length || diagnostics.literacyCapableGroupCount !== groups.length || diagnostics.metalworkingCapableGroupCount !== groups.length || diagnostics.establishedMagicGroupCount !== groups.length || diagnostics.cityCount !== 0) throw new Error("Pre-urban humanity diagnostics are invalid.");
    if (effectiveDirectory.digest !== `public-pre-urban-${StrategicWorld.stableHash(publicCore(effectiveDirectory))}` || record.digest !== `pre-urban-humanity-${StrategicWorld.stableHash(humanityCore(record))}`) throw new Error("Pre-urban humanity does not match its digest.");
    return { record: clone(record), directory: clone(effectiveDirectory) };
  }

  function attachPreUrbanHumanity(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createPreUrbanHumanity(worldSeed, next);
    next.preUrbanHumanity = generated.record;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicPreUrbanOverview(map) {
    if (!map?.preUrbanHumanity) return null;
    return validatePreUrbanHumanity(map).directory;
  }

  function auditPreUrbanHumanity(map) {
    const { record, directory } = validatePreUrbanHumanity(map);
    const groups = expandPopulationGroups(map, record);
    return {
      valid: true,
      generatedBeforeCities: record.diagnostics.cityCount === 0 && !record.sourceHumanGeographyDigest,
      everyLandRegionRepresented: record.diagnostics.representedLandRegionCount === map.surface.regions.filter((region) => region.surfaceClass === "land").length,
      allGroupsAgriculturalLiterateMetalworkingAndMagical: groups.every((group) => CORE_CAPABILITIES.every((capability) => CAPABILITY_BANDS.includes(group.capabilities[capability]))),
      noModernScaleInfrastructure: groups.every((group) => group.absentInfrastructure.includes("fortifiedCity") && group.absentInfrastructure.includes("industrialGrid") && group.absentInfrastructure.includes("globalLogistics") && group.absentInfrastructure.includes("orbitalNetwork")),
      publicOverviewHidesExactPopulationGeography: directory.groupSummaries.every((summary) => !Object.hasOwn(summary, "centerCellId") && !Object.hasOwn(summary, "rangeCellIds") && !Object.hasOwn(summary, "population")),
      publicOverviewHidesExactPristineBeastCounts: directory.beastBaseline.every((entry) => entry.exactPopulationCountPublic === false && !Object.hasOwn(entry, "populationCount")),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    CORE_CAPABILITIES,
    CAPABILITY_BANDS,
    SUBSISTENCE_MODES,
    MOBILITY_PATTERNS,
    CULTURAL_EMPHASES,
    EXTRA_CAPABILITIES,
    POPULATION_BANDS,
    BASELINE_POPULATION_BANDS,
    habitationSuitability,
    createPreUrbanHumanity,
    validatePreUrbanHumanity,
    attachPreUrbanHumanity,
    expandPopulationGroups,
    publicPreUrbanOverview,
    auditPreUrbanHumanity,
    title
  });
});
