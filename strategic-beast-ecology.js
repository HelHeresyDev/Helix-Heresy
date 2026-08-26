(function initStrategicBeastEcology(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const environment = typeof module === "object" && module.exports
    ? require("./climate-hydrology-biomes")
    : root?.HelixClimateHydrologyBiomes;
  const arcaneGeography = typeof module === "object" && module.exports
    ? require("./strategic-arcane-geography")
    : root?.HelixStrategicArcaneGeography;
  const cityPolities = typeof module === "object" && module.exports
    ? require("./strategic-city-polities")
    : root?.HelixStrategicCityPolities;
  const api = factory(strategicWorld, environment, arcaneGeography, cityPolities);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicBeastEcology = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicBeastEcologyApi(StrategicWorld, Environment, ArcaneGeography, StrategicCityPolities) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-beast-ecology.js");
  if (!Environment) throw new Error("HelixClimateHydrologyBiomes must load before strategic-beast-ecology.js");
  if (!ArcaneGeography) throw new Error("HelixStrategicArcaneGeography must load before strategic-beast-ecology.js");
  if (!StrategicCityPolities) throw new Error("HelixStrategicCityPolities must load before strategic-beast-ecology.js");

  const REALMS = Object.freeze(["land", "ocean", "either"]);
  const INTELLIGENCE_BANDS = Object.freeze(["instinctive", "cunning", "reasoning", "sapient"]);
  const SIZE_BANDS = Object.freeze(["small", "humanScale", "large", "colossal"]);
  const THREAT_BANDS = Object.freeze(["low", "guarded", "dangerous", "catastrophic"]);
  const ABUNDANCE_BANDS = Object.freeze(["relict", "sparse", "established", "dense", "teeming"]);
  const CONFIDENCE_BANDS = Object.freeze(["low", "moderate", "high"]);
  const RELATION_KINDS = Object.freeze(["predation", "rivalry", "displacement", "scavenging"]);
  const THREAT_CLASS_LEGEND = Object.freeze({ ".": "none", "1": "low", "2": "guarded", "3": "dangerous", "4": "catastrophic" });

  function species(definition) {
    return Object.freeze({
      ...definition,
      biomeCodes: Object.freeze([...definition.biomeCodes]),
      aspectCodes: Object.freeze([...definition.aspectCodes]),
      movementModes: Object.freeze([...definition.movementModes]),
      geologyCodes: Object.freeze([...(definition.geologyCodes || [])])
    });
  }

  const BEAST_SPECIES = Object.freeze([
    species({ id: "beast:ashhorn-behemoth", name: "Ashhorn Behemoth", description: "A fortress-sized herd grazer whose heated horns vitrify soil during territorial charges.", realm: "land", biomeCodes: ["G", "S", "D"], aspectCodes: ["E", "F"], movementModes: ["walking", "charging"], diet: "mineralGrazer", ecologicalRole: "megagrazer", socialPattern: "migratoryHerd", intelligenceBand: "instinctive", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [8, 13], lairKind: "calvingGround" }),
    species({ id: "beast:glasswing-roc", name: "Glasswing Roc", description: "A high-altitude apex flier whose translucent pinions focus sunlight and spellfire.", realm: "land", biomeCodes: ["A", "D", "G"], aspectCodes: ["A", "F"], movementModes: ["flight"], diet: "apexPredator", ecologicalRole: "apexPredator", socialPattern: "matedPair", intelligenceBand: "cunning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [10, 15], lairKind: "eyrie" }),
    species({ id: "beast:mire-choir", name: "Mire Choir", description: "Amphibious colonies that coordinate through hypnotic harmonics carried by fog and standing water.", realm: "land", biomeCodes: ["W", "R", "Y"], aspectCodes: ["W", "T"], movementModes: ["walking", "swimming"], diet: "omnivore", ecologicalRole: "mesopredator", socialPattern: "choralColony", intelligenceBand: "reasoning", sizeBand: "humanScale", threatRank: 3, prevalenceRank: 3, radius: [7, 11], lairKind: "spawningMire", waterAffinity: "wetland" }),
    species({ id: "beast:nullmaw-stalker", name: "Nullmaw Stalker", description: "A solitary hunter adapted to magic-dead ground, where its prey loses the abilities it expects to use.", realm: "land", biomeCodes: ["S", "D", "A"], aspectCodes: ["E", "T"], movementModes: ["walking", "burrowing"], diet: "apexPredator", ecologicalRole: "apexPredator", socialPattern: "solitary", intelligenceBand: "cunning", sizeBand: "large", threatRank: 4, prevalenceRank: 1, radius: [7, 12], lairKind: "nullDen", nullAffinity: true }),
    species({ id: "beast:thunderback-grazer", name: "Thunderback Grazer", description: "Massive herd animals that store atmospheric charge and answer panic with chain lightning.", realm: "land", biomeCodes: ["G", "S", "Y"], aspectCodes: ["S", "A"], movementModes: ["walking", "charging"], diet: "herbivore", ecologicalRole: "megagrazer", socialPattern: "migratoryHerd", intelligenceBand: "instinctive", sizeBand: "large", threatRank: 3, prevalenceRank: 4, radius: [9, 14], lairKind: "stormWallows" }),
    species({ id: "beast:candlecap-myriapod", name: "Candlecap Myriapod", description: "Burrowing detritivores whose luminous fungal crowns ignite when a colony is disturbed.", realm: "land", biomeCodes: ["B", "F", "R"], aspectCodes: ["L", "F"], movementModes: ["walking", "burrowing"], diet: "detritivore", ecologicalRole: "decomposer", socialPattern: "burrowColony", intelligenceBand: "instinctive", sizeBand: "small", threatRank: 2, prevalenceRank: 4, radius: [7, 11], lairKind: "fungalWarren" }),
    species({ id: "beast:ironroot-colossus", name: "Ironroot Colossus", description: "A slow arboreal titan armored in living wood and ore drawn from the ground beneath it.", realm: "land", biomeCodes: ["B", "F", "Y"], aspectCodes: ["E", "L"], movementModes: ["walking", "rooting"], diet: "mineralGrazer", ecologicalRole: "ecosystemEngineer", socialPattern: "solitary", intelligenceBand: "reasoning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [7, 12], lairKind: "rootSanctum", geologyCodes: ["m", "s", "g"] }),
    species({ id: "beast:gloam-prowler", name: "Gloam Prowler", description: "A pack ambusher that bends shadow and distance around coordinated hunting formations.", realm: "land", biomeCodes: ["B", "F", "R", "S"], aspectCodes: ["T", "A"], movementModes: ["walking", "shortBlink"], diet: "carnivore", ecologicalRole: "packPredator", socialPattern: "huntingPack", intelligenceBand: "reasoning", sizeBand: "large", threatRank: 3, prevalenceRank: 3, radius: [8, 12], lairKind: "shadowDen" }),
    species({ id: "beast:rimefang-pack", name: "Rimefang Pack", description: "Cooperative frost predators that freeze tracks behind them and preserve kills beneath communal ice.", realm: "land", biomeCodes: ["I", "T", "B", "A"], aspectCodes: ["I", "W"], movementModes: ["walking"], diet: "carnivore", ecologicalRole: "packPredator", socialPattern: "huntingPack", intelligenceBand: "cunning", sizeBand: "large", threatRank: 3, prevalenceRank: 3, radius: [8, 13], lairKind: "iceDen" }),
    species({ id: "beast:sunspine-basilisk", name: "Sunspine Basilisk", description: "An arid-land ambush predator whose radiant dorsal fan induces paralysis and flash burns.", realm: "land", biomeCodes: ["D", "S", "G"], aspectCodes: ["F", "E"], movementModes: ["walking", "burrowing"], diet: "carnivore", ecologicalRole: "ambushPredator", socialPattern: "solitary", intelligenceBand: "cunning", sizeBand: "large", threatRank: 3, prevalenceRank: 3, radius: [7, 11], lairKind: "sunPit" }),
    species({ id: "beast:ley-manta", name: "Ley Manta", description: "Aerial filter feeders that sail mana currents and descend in luminous schools around ley structures.", realm: "either", biomeCodes: ["G", "Y", "t", "w", "o"], aspectCodes: ["T", "A"], movementModes: ["flight", "levitation"], diet: "manaFilterFeeder", ecologicalRole: "arcaneGrazer", socialPattern: "aerialSchool", intelligenceBand: "instinctive", sizeBand: "large", threatRank: 2, prevalenceRank: 3, radius: [9, 14], lairKind: "leyRoost", leyAffinity: true }),
    species({ id: "beast:carrion-lantern", name: "Carrion Lantern", description: "Balloon-bodied scavengers whose corpse-lights attract predators and confuse the dying.", realm: "land", biomeCodes: ["G", "S", "D", "T"], aspectCodes: ["T", "L"], movementModes: ["flight"], diet: "scavenger", ecologicalRole: "scavenger", socialPattern: "driftingFlock", intelligenceBand: "instinctive", sizeBand: "humanScale", threatRank: 2, prevalenceRank: 4, radius: [9, 14], lairKind: "boneRoost" }),
    species({ id: "beast:brine-cathedral", name: "Brine Cathedral", description: "A mobile colonial organism that resembles a reef-covered island until its feeding towers open.", realm: "ocean", biomeCodes: ["h", "u", "w", "t"], aspectCodes: ["W", "L"], movementModes: ["swimming", "drifting"], diet: "filterFeeder", ecologicalRole: "ecosystemEngineer", socialPattern: "superorganism", intelligenceBand: "reasoning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [10, 16], lairKind: "reefNursery" }),
    species({ id: "beast:reef-wyrm", name: "Reef Wyrm", description: "Territorial marine serpents that cultivate armored reefs as both nest and hunting maze.", realm: "ocean", biomeCodes: ["h", "u", "w"], aspectCodes: ["W", "E"], movementModes: ["swimming"], diet: "carnivore", ecologicalRole: "apexPredator", socialPattern: "territorialFamily", intelligenceBand: "cunning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 3, radius: [9, 14], lairKind: "reefMaze" }),
    species({ id: "beast:abyssal-bell", name: "Abyssal Bell", description: "Deep-water hunters that use pressure waves and etheric lures to draw prey into crushing depths.", realm: "ocean", biomeCodes: ["d", "o", "c"], aspectCodes: ["W", "T"], movementModes: ["swimming"], diet: "apexPredator", ecologicalRole: "apexPredator", socialPattern: "solitary", intelligenceBand: "cunning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [11, 17], lairKind: "abyssalTrench" }),
    species({ id: "beast:frostwake-leviathan", name: "Frostwake Leviathan", description: "Polar leviathans whose migrations leave temporary ice roads and shattered coastal defenses.", realm: "ocean", biomeCodes: ["p", "c", "d"], aspectCodes: ["I", "W"], movementModes: ["swimming", "iceBreaking"], diet: "carnivore", ecologicalRole: "megapredator", socialPattern: "migratoryPod", intelligenceBand: "reasoning", sizeBand: "colossal", threatRank: 4, prevalenceRank: 2, radius: [11, 17], lairKind: "iceShelfNursery" }),
    species({ id: "beast:marsh-hydra", name: "Marsh Hydra", description: "Regenerating wetland predators whose quarrelling heads maintain separate hunting memories.", realm: "land", biomeCodes: ["W", "R", "Y"], aspectCodes: ["W", "L"], movementModes: ["walking", "swimming"], diet: "carnivore", ecologicalRole: "apexPredator", socialPattern: "solitary", intelligenceBand: "cunning", sizeBand: "large", threatRank: 4, prevalenceRank: 2, radius: [7, 11], lairKind: "reedNest", waterAffinity: "wetland" }),
    species({ id: "beast:rivercoil", name: "Rivercoil", description: "Long-bodied amphibians that dam rivers, flood valleys, and defend the resulting spawning lakes.", realm: "land", biomeCodes: ["W", "F", "G", "Y"], aspectCodes: ["W", "E"], movementModes: ["swimming", "walking"], diet: "omnivore", ecologicalRole: "ecosystemEngineer", socialPattern: "territorialFamily", intelligenceBand: "cunning", sizeBand: "colossal", threatRank: 3, prevalenceRank: 3, radius: [8, 13], lairKind: "riverDam", waterAffinity: "river" }),
    species({ id: "beast:ember-ant", name: "Ember Ant", description: "Heat-loving colonial insects that strip landscapes and build furnace mounds around stolen metal.", realm: "land", biomeCodes: ["D", "S", "G", "Y"], aspectCodes: ["F", "E"], movementModes: ["walking", "burrowing"], diet: "omnivore", ecologicalRole: "swarmForager", socialPattern: "hiveColony", intelligenceBand: "cunning", sizeBand: "small", threatRank: 3, prevalenceRank: 4, radius: [7, 12], lairKind: "furnaceMound" }),
    species({ id: "beast:dreaming-tortoise", name: "Dreaming Tortoise", description: "Ancient wandering grazers whose shared dreams distort weather and animal behavior around them.", realm: "land", biomeCodes: ["G", "S", "Y", "F"], aspectCodes: ["T", "L"], movementModes: ["walking"], diet: "herbivore", ecologicalRole: "megagrazer", socialPattern: "looseHerd", intelligenceBand: "sapient", sizeBand: "colossal", threatRank: 3, prevalenceRank: 1, radius: [9, 14], lairKind: "dreamingGround" }),
    species({ id: "beast:mirror-ape", name: "Mirror Ape", description: "Tool-using forest troops that imitate spells, signals, and military routines after watching them once.", realm: "land", biomeCodes: ["R", "Y", "F"], aspectCodes: ["T", "L"], movementModes: ["walking", "climbing"], diet: "omnivore", ecologicalRole: "opportunist", socialPattern: "toolUsingTroop", intelligenceBand: "sapient", sizeBand: "humanScale", threatRank: 3, prevalenceRank: 3, radius: [7, 11], lairKind: "canopyHold" }),
    species({ id: "beast:gravebloom-elk", name: "Gravebloom Elk", description: "Forest herd beasts that seed luminous flowers in carrion and return seasonally to graze the blooms.", realm: "land", biomeCodes: ["B", "F", "T"], aspectCodes: ["L", "T"], movementModes: ["walking"], diet: "herbivore", ecologicalRole: "grazer", socialPattern: "migratoryHerd", intelligenceBand: "instinctive", sizeBand: "large", threatRank: 2, prevalenceRank: 4, radius: [8, 13], lairKind: "bloomingGround" }),
    species({ id: "beast:storm-kite", name: "Storm Kite", description: "Aerial swarms that feed on electrical charge and turn violent when grounded by calm weather.", realm: "either", biomeCodes: ["G", "S", "t", "w", "u"], aspectCodes: ["S", "A"], movementModes: ["flight"], diet: "energyFeeder", ecologicalRole: "aerialForager", socialPattern: "stormSwarm", intelligenceBand: "instinctive", sizeBand: "small", threatRank: 3, prevalenceRank: 4, radius: [10, 15], lairKind: "stormRoost" }),
    species({ id: "beast:burrowing-furnace", name: "Burrowing Furnace", description: "Subterranean lithovores whose superheated tunnels trigger collapses and volcanic gas releases.", realm: "land", biomeCodes: ["A", "D", "S", "G"], aspectCodes: ["F", "E"], movementModes: ["burrowing"], diet: "mineralGrazer", ecologicalRole: "ecosystemEngineer", socialPattern: "burrowColony", intelligenceBand: "instinctive", sizeBand: "large", threatRank: 3, prevalenceRank: 3, radius: [8, 13], lairKind: "magmaWarren", geologyCodes: ["v", "b", "u"] })
  ]);

  const SPECIES_BY_ID = new Map(BEAST_SPECIES.map((entry) => [entry.id, entry]));

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(value, "base64"));
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function maskForIndices(cellCount, indices) {
    const bytes = new Uint8Array(Math.ceil(cellCount / 8));
    for (const index of indices) bytes[index >> 3] |= 1 << (index & 7);
    return bytesToBase64(bytes);
  }

  function maskIncludes(mask, index) {
    const bytes = typeof mask === "string" ? base64ToBytes(mask) : mask;
    return Boolean(bytes[index >> 3] & (1 << (index & 7)));
  }

  function countMask(mask) {
    return base64ToBytes(mask).reduce((total, byte) => total + byte.toString(2).replace(/0/g, "").length, 0);
  }

  function surfaceMatches(definition, map, index) {
    const land = map.surface.classes[index] === "L";
    return definition.realm === "either" || (definition.realm === "land" ? land : !land);
  }

  function habitatSuitability(definition, map, index, seed = "") {
    if (!surfaceMatches(definition, map, index)) return -100000;
    const biome = map.biomes.classes[index];
    const aspect = map.arcaneGeography.primaryAspectClasses[index];
    const secondaryAspect = map.arcaneGeography.secondaryAspectClasses[index];
    const controlClass = map.cityPolities.control.classes[index];
    if (controlClass === "c") return -100000;
    let score = definition.biomeCodes.includes(biome) ? 620 : 80;
    if (definition.aspectCodes.includes(aspect)) score += 190;
    if (definition.aspectCodes.includes(secondaryAspect)) score += 80;
    if (definition.geologyCodes.includes(map.geology.bedrockClasses[index])) score += 180;
    if (definition.nullAffinity) score += map.arcaneGeography.nullPermille[index] * 0.7;
    if (definition.leyAffinity) score += map.arcaneGeography.leyClasses[index] === "n" ? 520 : (map.arcaneGeography.leyClasses[index] === "c" ? 280 : 0);
    if (definition.waterAffinity === "wetland") score += map.hydrology.wetlandClasses[index] !== "." ? 420 : 0;
    if (definition.waterAffinity === "river") score += map.hydrology.riverClasses[index] !== "." || map.hydrology.lakeByCell[index] >= 0 ? 420 : 0;
    score += map.arcaneGeography.manaConcentrationPermille[index] * 0.08;
    if (controlClass === "a") score -= 520;
    if (controlClass === "i") score -= 130;
    score += seededNumber(seed || definition.id, `habitat:${definition.id}:${index}`) * 170;
    return score;
  }

  function populationCount(definition, seed) {
    const ranges = { 1: [1, 2], 2: [2, 3], 3: [3, 5], 4: [4, 6] }[definition.prevalenceRank];
    return ranges[0] + Math.floor(seededNumber(seed, `${definition.id}:population-count`) * (ranges[1] - ranges[0] + 1));
  }

  function selectCenters(definition, count, map, seed) {
    const candidates = Array.from({ length: map.topology.cellCount }, (_, index) => ({
      index,
      score: habitatSuitability(definition, map, index, seed) + seededNumber(seed, `${definition.id}:center:${index}`) * 260
    })).filter((entry) => entry.score > 150).sort((left, right) => right.score - left.score || left.index - right.index);
    if (!candidates.length) throw new Error(`${definition.name} has no viable habitat in this world.`);
    const selected = [];
    for (const candidate of candidates) {
      const separated = selected.every((index) => StrategicWorld.greatCircleDistanceKm(map, index, candidate.index) >= 260);
      if (separated) selected.push(candidate.index);
      if (selected.length === count) break;
    }
    for (const candidate of candidates) {
      if (selected.length === count) break;
      if (!selected.includes(candidate.index)) selected.push(candidate.index);
    }
    return selected;
  }

  function territoryIndices(definition, centerIndex, radius, map, seed) {
    const topology = StrategicWorld.topologyForMap(map);
    const distances = new Map([[centerIndex, 0]]);
    const queue = [centerIndex];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      const distance = distances.get(current);
      if (distance >= radius) continue;
      for (const neighbor of topology.neighbors[current]) {
        if (distances.has(neighbor) || !surfaceMatches(definition, map, neighbor)) continue;
        if (map.cityPolities.control.classes[neighbor] === "c") continue;
        const suitability = habitatSuitability(definition, map, neighbor, seed);
        const edgeTolerance = seededNumber(seed, `${definition.id}:range:${centerIndex}:${neighbor}`) * 240;
        if (suitability + edgeTolerance < 250) continue;
        distances.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }
    return {
      range: [...distances.keys()].sort((left, right) => left - right),
      core: [...distances.entries()].filter(([, distance]) => distance <= Math.max(1, Math.floor(radius / 3))).map(([index]) => index).sort((left, right) => left - right)
    };
  }

  function abundanceBand(index) {
    if (index < 120) return "relict";
    if (index < 280) return "sparse";
    if (index < 520) return "established";
    if (index < 780) return "dense";
    return "teeming";
  }

  function createPopulations(worldSeed, map) {
    const populations = [];
    const temporaryRanges = new Map();
    for (const definition of BEAST_SPECIES) {
      const count = populationCount(definition, worldSeed);
      const centers = selectCenters(definition, count, map, worldSeed);
      centers.forEach((centerIndex, ordinal) => {
        const radius = definition.radius[0] + Math.floor(seededNumber(worldSeed, `${definition.id}:radius:${ordinal}`) * (definition.radius[1] - definition.radius[0] + 1));
        const territory = territoryIndices(definition, centerIndex, radius, map, worldSeed);
        const populationIndex = Math.round(clamp(
          territory.range.length * (0.7 + definition.prevalenceRank * 0.23) * (0.72 + seededNumber(worldSeed, `${definition.id}:abundance:${ordinal}`) * 0.72),
          30,
          1000
        ));
        const suffix = definition.id.slice(6);
        const id = `beast-population:${suffix}:${String(ordinal + 1).padStart(2, "0")}`;
        populations.push({
          id,
          speciesId: definition.id,
          centerCellId: StrategicWorld.cellId(centerIndex),
          lairCellId: StrategicWorld.cellId(territory.core[Math.floor(seededNumber(worldSeed, `${id}:lair`) * territory.core.length)] || centerIndex),
          lairKind: definition.lairKind,
          populationIndex,
          abundanceBand: abundanceBand(populationIndex),
          territory: {
            rangeMask: maskForIndices(map.topology.cellCount, territory.range),
            coreMask: maskForIndices(map.topology.cellCount, territory.core),
            rangeCellCount: territory.range.length,
            coreCellCount: territory.core.length
          }
        });
        temporaryRanges.set(id, new Set(territory.range));
      });
    }
    return { populations, temporaryRanges };
  }

  function overlapCount(left, right) {
    let smaller = left;
    let larger = right;
    if (left.size > right.size) [smaller, larger] = [right, left];
    let count = 0;
    for (const index of smaller) if (larger.has(index)) count += 1;
    return count;
  }

  function relationKind(leftSpecies, rightSpecies) {
    const predators = new Set(["apexPredator", "megapredator", "packPredator", "ambushPredator"]);
    const prey = new Set(["grazer", "megagrazer", "arcaneGrazer", "aerialForager", "swarmForager"]);
    if ((predators.has(leftSpecies.ecologicalRole) && prey.has(rightSpecies.ecologicalRole)) || (predators.has(rightSpecies.ecologicalRole) && prey.has(leftSpecies.ecologicalRole))) return "predation";
    if (predators.has(leftSpecies.ecologicalRole) && predators.has(rightSpecies.ecologicalRole)) return "rivalry";
    if (leftSpecies.ecologicalRole === "scavenger" || rightSpecies.ecologicalRole === "scavenger") return "scavenging";
    return "displacement";
  }

  function createRelations(populations, temporaryRanges) {
    const candidates = [];
    for (let left = 0; left < populations.length; left += 1) {
      for (let right = left + 1; right < populations.length; right += 1) {
        if (populations[left].speciesId === populations[right].speciesId) continue;
        const overlap = overlapCount(temporaryRanges.get(populations[left].id), temporaryRanges.get(populations[right].id));
        if (overlap < 3) continue;
        candidates.push({ left: populations[left], right: populations[right], overlap });
      }
    }
    const degree = new Map();
    const relations = [];
    for (const candidate of candidates.sort((left, right) => right.overlap - left.overlap || `${left.left.id}:${left.right.id}`.localeCompare(`${right.left.id}:${right.right.id}`))) {
      if ((degree.get(candidate.left.id) || 0) >= 3 || (degree.get(candidate.right.id) || 0) >= 3) continue;
      const kind = relationKind(SPECIES_BY_ID.get(candidate.left.speciesId), SPECIES_BY_ID.get(candidate.right.speciesId));
      relations.push({
        id: `beast-relation:${String(relations.length + 1).padStart(4, "0")}`,
        populationIds: [candidate.left.id, candidate.right.id].sort(),
        kind,
        overlapCellCount: candidate.overlap,
        pressureBand: candidate.overlap >= 80 ? "severe" : (candidate.overlap >= 30 ? "strong" : "localized")
      });
      degree.set(candidate.left.id, (degree.get(candidate.left.id) || 0) + 1);
      degree.set(candidate.right.id, (degree.get(candidate.right.id) || 0) + 1);
    }
    return relations;
  }

  function expandIndices(indices, steps, definition, map) {
    const topology = StrategicWorld.topologyForMap(map);
    const expanded = new Set(indices);
    let frontier = new Set(indices);
    for (let step = 0; step < steps; step += 1) {
      const next = new Set();
      for (const index of frontier) {
        for (const neighbor of topology.neighbors[index]) {
          if (expanded.has(neighbor) || !surfaceMatches(definition, map, neighbor)) continue;
          expanded.add(neighbor);
          next.add(neighbor);
        }
      }
      frontier = next;
    }
    return [...expanded].sort((left, right) => left - right);
  }

  function nearestCityDistanceKm(map, cellId) {
    const index = StrategicWorld.cellIndex(cellId);
    return Math.min(...map.humanGeography.cities.map((city) => StrategicWorld.greatCircleDistanceKm(map, index, StrategicWorld.cellIndex(city.cellId))));
  }

  function reportedAbundance(population, confidence, seed) {
    const order = ABUNDANCE_BANDS;
    const actual = order.indexOf(population.abundanceBand);
    if (confidence === "high") return population.abundanceBand;
    const offset = seededNumber(seed, `${population.id}:public-abundance`) < 0.5 ? -1 : 1;
    const distance = confidence === "moderate" ? 1 : 2;
    return order[clamp(actual + offset * distance, 0, order.length - 1)];
  }

  function createPublicAtlas(worldSeed, map, ecology, temporaryRanges) {
    const observedPopulations = ecology.populations.map((population) => {
      const definition = SPECIES_BY_ID.get(population.speciesId);
      const distance = nearestCityDistanceKm(map, population.centerCellId);
      const confidence = distance <= 420 ? "high" : (distance <= 900 ? "moderate" : "low");
      return { population, definition, confidence };
    }).filter(({ population, confidence }) => {
      if (confidence === "high") return true;
      const reportingRoll = seededNumber(worldSeed, `${population.id}:publicly-reported`);
      return reportingRoll >= (confidence === "moderate" ? 0.12 : 0.38);
    });
    const reports = observedPopulations.map(({ population, definition, confidence }, reportIndex) => {
      const expanded = expandIndices(temporaryRanges.get(population.id), confidence === "high" ? 0 : (confidence === "moderate" ? 1 : 2), definition, map);
      const knownLair = confidence === "high" && seededNumber(worldSeed, `${population.id}:known-lair`) >= 0.38;
      return {
        id: `beast-report:${String(reportIndex + 1).padStart(4, "0")}`,
        speciesId: population.speciesId,
        reportedRangeMask: maskForIndices(map.topology.cellCount, expanded),
        reportedRangeCellCount: expanded.length,
        confidence,
        reportedAbundanceBand: reportedAbundance(population, confidence, worldSeed),
        threatBand: THREAT_BANDS[definition.threatRank - 1],
        knownLairCellId: knownLair ? population.lairCellId : null,
        publicReason: confidence === "high" ? "Repeated city and corridor observations" : (confidence === "moderate" ? "Correlated remote reports" : "Sparse long-range sightings")
      };
    });
    const threatClasses = new Array(map.topology.cellCount).fill(".");
    const contestedClasses = new Array(map.topology.cellCount).fill(".");
    const reportCounts = new Uint8Array(map.topology.cellCount);
    for (const report of reports) {
      const bytes = base64ToBytes(report.reportedRangeMask);
      const threatRank = THREAT_BANDS.indexOf(report.threatBand) + 1;
      for (let index = 0; index < map.topology.cellCount; index += 1) {
        if (!(bytes[index >> 3] & (1 << (index & 7)))) continue;
        reportCounts[index] += 1;
        threatClasses[index] = String(Math.max(Number(threatClasses[index]) || 0, threatRank));
      }
    }
    for (let index = 0; index < reportCounts.length; index += 1) if (reportCounts[index] >= 2) contestedClasses[index] = "c";
    const atlas = {
      sourceEcologyDigest: ecology.digest,
      reports,
      threatClasses: threatClasses.join(""),
      contestedClasses: contestedClasses.join(""),
      diagnostics: {
        reportCount: reports.length,
        highConfidenceReportCount: reports.filter((report) => report.confidence === "high").length,
        knownLairCount: reports.filter((report) => report.knownLairCellId).length,
        reportedCellCount: threatClasses.filter((code) => code !== ".").length,
        contestedCellCount: contestedClasses.filter((code) => code === "c").length
      }
    };
    atlas.digest = `public-beast-atlas-${StrategicWorld.stableHash(atlas)}`;
    return atlas;
  }

  function ecologyCore(record) {
    return {
      sourceEnvironmentDigest: record.sourceEnvironmentDigest,
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      sourceCityPolitiesDigest: record.sourceCityPolitiesDigest,
      species: record.species,
      populations: record.populations,
      relations: record.relations,
      diagnostics: record.diagnostics
    };
  }

  function createBeastEcology(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic beast ecology.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    Environment.validateEnvironment(strategicMap);
    ArcaneGeography.validateStrategicArcaneGeography(strategicMap);
    StrategicCityPolities.validateCityPolities(strategicMap);
    const { populations, temporaryRanges } = createPopulations(seed, strategicMap);
    const ecology = {
      sourceEnvironmentDigest: StrategicWorld.stableHash({ climate: strategicMap.climate, hydrology: strategicMap.hydrology, biomes: strategicMap.biomes }),
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      species: clone(BEAST_SPECIES),
      populations,
      relations: createRelations(populations, temporaryRanges),
      diagnostics: {
        speciesCount: BEAST_SPECIES.length,
        populationCount: populations.length,
        landSpeciesCount: BEAST_SPECIES.filter((entry) => entry.realm !== "ocean").length,
        marineSpeciesCount: BEAST_SPECIES.filter((entry) => entry.realm !== "land").length,
        sapientSpeciesCount: BEAST_SPECIES.filter((entry) => entry.intelligenceBand === "sapient").length,
        occupiedRangeCellMemberships: populations.reduce((total, population) => total + population.territory.rangeCellCount, 0)
      }
    };
    ecology.digest = `beast-ecology-${StrategicWorld.stableHash(ecologyCore(ecology))}`;
    const publicAtlas = createPublicAtlas(seed, strategicMap, ecology, temporaryRanges);
    return { ecology, publicAtlas };
  }

  function validateMask(mask, cellCount, label) {
    let bytes;
    try { bytes = base64ToBytes(String(mask || "")); } catch (error) { throw new Error(`${label} is not valid base64.`); }
    if (bytes.length !== Math.ceil(cellCount / 8)) throw new Error(`${label} has an invalid cell-mask length.`);
    return bytes;
  }

  function validateBeastEcology(map, ecology = map?.beastEcology, publicAtlas = map?.publicBeastAtlas) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    if (!ecology || !publicAtlas || !Array.isArray(ecology.species) || !Array.isArray(ecology.populations) || !Array.isArray(ecology.relations)) throw new Error("Strategic beast ecology is incomplete.");
    if (ecology.sourceEnvironmentDigest !== StrategicWorld.stableHash({ climate: strategicMap.climate, hydrology: strategicMap.hydrology, biomes: strategicMap.biomes }) || ecology.sourceArcaneGeographyDigest !== strategicMap.arcaneGeography.digest || ecology.sourceCityPolitiesDigest !== strategicMap.cityPolities.digest) throw new Error("Strategic beast ecology does not match its source world.");
    if (ecology.species.length !== BEAST_SPECIES.length || ecology.species.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(BEAST_SPECIES[index]))) throw new Error("Every world must contain the complete static beast-species catalog.");
    const populationIds = new Set();
    const speciesPopulationCounts = new Map(BEAST_SPECIES.map((entry) => [entry.id, 0]));
    for (const population of ecology.populations) {
      if (!/^beast-population:[a-z0-9-]+:\d{2}$/.test(String(population.id || "")) || populationIds.has(population.id) || !SPECIES_BY_ID.has(population.speciesId)) throw new Error("Beast populations require unique stable identities and known species.");
      if (!ABUNDANCE_BANDS.includes(population.abundanceBand) || !Number.isInteger(population.populationIndex) || population.populationIndex < 1 || !String(population.lairKind || "").trim()) throw new Error(`${population.id} has invalid population facts.`);
      const range = validateMask(population.territory?.rangeMask, strategicMap.topology.cellCount, `${population.id} range`);
      const core = validateMask(population.territory?.coreMask, strategicMap.topology.cellCount, `${population.id} core`);
      const centerIndex = StrategicWorld.cellIndex(population.centerCellId);
      const lairIndex = StrategicWorld.cellIndex(population.lairCellId);
      if (!maskIncludes(range, centerIndex) || !maskIncludes(core, lairIndex) || countMask(population.territory.rangeMask) !== population.territory.rangeCellCount || countMask(population.territory.coreMask) !== population.territory.coreCellCount) throw new Error(`${population.id} territory facts are inconsistent.`);
      const definition = SPECIES_BY_ID.get(population.speciesId);
      for (let index = 0; index < strategicMap.topology.cellCount; index += 1) if (range[index >> 3] & (1 << (index & 7)) && !surfaceMatches(definition, strategicMap, index)) throw new Error(`${population.id} occupies an impossible surface realm.`);
      populationIds.add(population.id);
      speciesPopulationCounts.set(population.speciesId, speciesPopulationCounts.get(population.speciesId) + 1);
    }
    if ([...speciesPopulationCounts.values()].some((count) => count < 1)) throw new Error("Every static beast species requires at least one living population in every world.");
    for (const relation of ecology.relations) {
      if (!RELATION_KINDS.includes(relation.kind) || !Array.isArray(relation.populationIds) || relation.populationIds.length !== 2 || relation.populationIds.some((id) => !populationIds.has(id))) throw new Error("Beast ecological relations are invalid.");
    }
    if (ecology.digest !== `beast-ecology-${StrategicWorld.stableHash(ecologyCore(ecology))}`) throw new Error("Strategic beast ecology does not match its digest.");
    if (publicAtlas.sourceEcologyDigest !== ecology.digest || !Array.isArray(publicAtlas.reports) || String(publicAtlas.threatClasses || "").length !== strategicMap.topology.cellCount || /[^.1234]/.test(publicAtlas.threatClasses) || String(publicAtlas.contestedClasses || "").length !== strategicMap.topology.cellCount || /[^.c]/.test(publicAtlas.contestedClasses)) throw new Error("Public beast atlas is invalid.");
    for (const report of publicAtlas.reports) {
      validateMask(report.reportedRangeMask, strategicMap.topology.cellCount, `${report.id} public range`);
      if (!/^beast-report:\d{4}$/.test(String(report.id || "")) || !SPECIES_BY_ID.has(report.speciesId) || !CONFIDENCE_BANDS.includes(report.confidence) || !ABUNDANCE_BANDS.includes(report.reportedAbundanceBand) || !THREAT_BANDS.includes(report.threatBand) || Object.hasOwn(report, "populationId") || Object.hasOwn(report, "populationIndex") || Object.hasOwn(report, "lairCellId")) throw new Error(`${report.id} leaks or contains invalid public ecology facts.`);
    }
    const publicCore = clone(publicAtlas);
    delete publicCore.digest;
    if (publicAtlas.digest !== `public-beast-atlas-${StrategicWorld.stableHash(publicCore)}`) throw new Error("Public beast atlas does not match its digest.");
    return { ecology: clone(ecology), publicAtlas: clone(publicAtlas) };
  }

  function attachBeastEcology(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createBeastEcology(worldSeed, next);
    next.beastEcology = generated.ecology;
    next.publicBeastAtlas = generated.publicAtlas;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function cellPublicBeastSnapshot(map, index) {
    if (!map?.publicBeastAtlas || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const reports = map.publicBeastAtlas.reports
      .filter((report) => maskIncludes(report.reportedRangeMask, index))
      .map((report) => ({
        id: report.id,
        species: clone(SPECIES_BY_ID.get(report.speciesId)),
        confidence: report.confidence,
        reportedAbundanceBand: report.reportedAbundanceBand,
        threatBand: report.threatBand,
        knownLairCellId: report.knownLairCellId,
        publicReason: report.publicReason
      }))
      .sort((left, right) => THREAT_BANDS.indexOf(right.threatBand) - THREAT_BANDS.indexOf(left.threatBand) || left.species.name.localeCompare(right.species.name));
    return {
      threatBand: THREAT_CLASS_LEGEND[map.publicBeastAtlas.threatClasses[index]],
      contested: map.publicBeastAtlas.contestedClasses[index] === "c",
      reports
    };
  }

  function publicBestiary(map) {
    if (!map?.publicBeastAtlas) return [];
    return BEAST_SPECIES.map((definition) => {
      const reports = map.publicBeastAtlas.reports.filter((report) => report.speciesId === definition.id);
      return {
        species: clone(definition),
        reportedPopulationCount: reports.length,
        highestConfidence: [...reports].sort((left, right) => CONFIDENCE_BANDS.indexOf(right.confidence) - CONFIDENCE_BANDS.indexOf(left.confidence))[0]?.confidence || "low",
        knownLairCount: reports.filter((report) => report.knownLairCellId).length,
        reportedAbundanceBands: [...new Set(reports.map((report) => report.reportedAbundanceBand))]
      };
    });
  }

  function auditBeastEcology(map) {
    const { ecology, publicAtlas } = validateBeastEcology(map);
    const landIndices = [...map.surface.classes].map((code, index) => code === "L" ? index : -1).filter((index) => index >= 0);
    const canonicalLandCovered = new Set();
    for (const population of ecology.populations) {
      const definition = SPECIES_BY_ID.get(population.speciesId);
      if (definition.realm === "ocean") continue;
      const bytes = base64ToBytes(population.territory.rangeMask);
      for (const index of landIndices) if (bytes[index >> 3] & (1 << (index & 7))) canonicalLandCovered.add(index);
    }
    return {
      valid: true,
      staticSpeciesCount: ecology.species.length,
      everySpeciesPresent: BEAST_SPECIES.every((definition) => ecology.populations.some((population) => population.speciesId === definition.id)),
      populationCount: ecology.populations.length,
      relationCount: ecology.relations.length,
      canonicalLandCoveragePercent: canonicalLandCovered.size / Math.max(1, landIndices.length) * 100,
      publicReportCount: publicAtlas.reports.length,
      publicAtlasHidesPopulationIdentity: publicAtlas.reports.every((report) => !Object.hasOwn(report, "populationId") && /^beast-report:\d{4}$/.test(report.id)),
      publicAtlasHidesPopulationIndex: publicAtlas.reports.every((report) => !Object.hasOwn(report, "populationIndex")),
      publicAtlasHidesUnknownLairs: publicAtlas.reports.some((report) => !report.knownLairCellId),
      knownLairCount: publicAtlas.diagnostics.knownLairCount,
      contestedCellCount: publicAtlas.diagnostics.contestedCellCount
    };
  }

  return Object.freeze({
    BEAST_SPECIES,
    REALMS,
    INTELLIGENCE_BANDS,
    SIZE_BANDS,
    THREAT_BANDS,
    ABUNDANCE_BANDS,
    CONFIDENCE_BANDS,
    RELATION_KINDS,
    THREAT_CLASS_LEGEND,
    createBeastEcology,
    validateBeastEcology,
    attachBeastEcology,
    cellPublicBeastSnapshot,
    publicBestiary,
    auditBeastEcology,
    maskIncludes,
    clone
  });
});
