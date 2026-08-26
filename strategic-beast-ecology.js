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
  const SEASON_PHASES = Object.freeze(["thaw", "highSun", "stormturn", "deepCold"]);
  const MIGRATORY_SOCIAL_PATTERNS = Object.freeze(["migratoryHerd", "migratoryPod", "driftingFlock", "aerialSchool", "stormSwarm"]);
  const WAVE_CAUSES = Object.freeze(["breedingDispersal", "preyPressure", "territorialDefeat", "arcaneDisruption", "drought", "fire", "flood", "seasonalHabitatChange"]);
  const WAVE_SEVERITY_BANDS = Object.freeze(["guarded", "dangerous", "catastrophic"]);
  const RECURRENCE_BANDS = Object.freeze(["seasonal", "intermittent", "sporadic"]);
  const ATTACK_EXPOSURE_BANDS = Object.freeze(["guarded", "elevated", "severe", "extreme"]);
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

  function movementAllowsCell(definition, map, index, allowFortifiedCore = false) {
    if (!allowFortifiedCore && map.cityPolities.control.classes[index] === "c") return false;
    if (definition.movementModes.includes("flight") || definition.movementModes.includes("levitation")) return true;
    if (definition.realm === "ocean") return map.surface.classes[index] === "W";
    if (definition.realm === "land") return map.surface.classes[index] === "L";
    return surfaceMatches(definition, map, index);
  }

  function shortestMovementPath(definition, map, startIndex, endIndex, allowFortifiedDestination = false) {
    const topology = StrategicWorld.topologyForMap(map);
    const previous = new Int32Array(topology.cellCount);
    previous.fill(-2);
    const queue = new Int32Array(topology.cellCount);
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    previous[startIndex] = -1;
    while (head < tail) {
      const current = queue[head++];
      if (current === endIndex) break;
      for (const neighbor of topology.neighbors[current]) {
        if (previous[neighbor] !== -2) continue;
        if (!movementAllowsCell(definition, map, neighbor, allowFortifiedDestination && neighbor === endIndex)) continue;
        previous[neighbor] = current;
        queue[tail++] = neighbor;
      }
    }
    if (previous[endIndex] === -2) return null;
    const path = [];
    for (let cursor = endIndex; cursor >= 0; cursor = previous[cursor]) path.push(cursor);
    return path.reverse();
  }

  function pathLengthKm(map, path) {
    let total = 0;
    for (let index = 1; index < path.length; index += 1) total += StrategicWorld.greatCircleDistanceKm(map, path[index - 1], path[index]);
    return Math.round(total);
  }

  function seasonalPhases(map, centerIndex, seed, populationId) {
    const northern = StrategicWorld.topologyForMap(map).vertices[centerIndex][1] >= 0;
    const offset = Math.floor(seededNumber(seed, `${populationId}:season-offset`) * SEASON_PHASES.length);
    const ordered = Array.from({ length: SEASON_PHASES.length }, (_, index) => SEASON_PHASES[(index + offset) % SEASON_PHASES.length]);
    if (!northern) ordered.reverse();
    return { outboundPhase: ordered[0], residencePhase: ordered[1], returnPhase: ordered[2], homePhase: ordered[3] };
  }

  function migrationDestination(definition, population, map, seed) {
    const centerIndex = StrategicWorld.cellIndex(population.centerCellId);
    const centerRegion = map.surface.regionByCell[centerIndex];
    const flying = definition.movementModes.includes("flight") || definition.movementModes.includes("levitation");
    const candidates = [];
    for (let index = 0; index < map.topology.cellCount; index += 1) {
      if (!movementAllowsCell(definition, map, index)) continue;
      if (!flying && map.surface.regionByCell[index] !== centerRegion) continue;
      const distance = StrategicWorld.greatCircleDistanceKm(map, centerIndex, index);
      if (distance < 420 || distance > 2100) continue;
      candidates.push({
        index,
        score: habitatSuitability(definition, map, index, seed) + Math.min(360, distance * 0.2) + seededNumber(seed, `${population.id}:migration-destination:${index}`) * 240
      });
    }
    return candidates.sort((left, right) => right.score - left.score || left.index - right.index)[0]?.index ?? null;
  }

  function createMigrations(worldSeed, map, populations) {
    const migrations = [];
    for (const population of populations) {
      const definition = SPECIES_BY_ID.get(population.speciesId);
      if (!MIGRATORY_SOCIAL_PATTERNS.includes(definition.socialPattern)) continue;
      const destinationIndex = migrationDestination(definition, population, map, worldSeed);
      if (destinationIndex === null) continue;
      const centerIndex = StrategicWorld.cellIndex(population.centerCellId);
      const path = shortestMovementPath(definition, map, centerIndex, destinationIndex);
      if (!path || path.length < 3) continue;
      migrations.push({
        id: `beast-migration:${String(migrations.length + 1).padStart(4, "0")}`,
        populationId: population.id,
        kind: "seasonalCycle",
        homeCellId: population.centerCellId,
        seasonalCellId: StrategicWorld.cellId(destinationIndex),
        cellPath: path.map(StrategicWorld.cellId),
        distanceKm: pathLengthKm(map, path),
        phases: seasonalPhases(map, centerIndex, worldSeed, population.id),
        travelPaceBand: definition.movementModes.includes("flight") ? "rapid" : (definition.sizeBand === "colossal" ? "slow" : "steady")
      });
    }
    return migrations;
  }

  function attackExposureBand(score) {
    if (score >= 900) return "extreme";
    if (score >= 620) return "severe";
    if (score >= 360) return "elevated";
    return "guarded";
  }

  function cityAttackExposures(map, populations) {
    const topology = StrategicWorld.topologyForMap(map);
    return map.humanGeography.cities.map((city) => {
      const cityIndex = StrategicWorld.cellIndex(city.cellId);
      const neighbors = topology.neighbors[cityIndex];
      const landApproaches = neighbors.filter((index) => map.surface.classes[index] === "L");
      const coastalApproaches = neighbors.filter((index) => map.surface.classes[index] === "W");
      const approachIndices = [...new Set([...landApproaches, ...coastalApproaches])];
      const nearby = populations.map((population) => {
        const definition = SPECIES_BY_ID.get(population.speciesId);
        const centerIndex = StrategicWorld.cellIndex(population.centerCellId);
        const distance = StrategicWorld.greatCircleDistanceKm(map, cityIndex, centerIndex);
        const approachOverlap = approachIndices.some((index) => maskIncludes(population.territory.rangeMask, index));
        return { population, definition, distance, approachOverlap, score: definition.threatRank * 120 + (approachOverlap ? 420 : Math.max(0, 260 - distance * 0.16)) };
      }).sort((left, right) => right.score - left.score || left.population.id.localeCompare(right.population.id));
      const score = nearby.slice(0, 5).reduce((total, entry) => total + entry.score, 0) / 3
        + ({ low: 80, guarded: 180, dangerous: 300, extreme: 430 }[city.wildernessExposureBand] || 140);
      return {
        id: `city-beast-exposure:${city.id.slice(5)}`,
        cityId: city.id,
        attackable: true,
        exposureBand: attackExposureBand(score),
        approachCellIds: approachIndices.map(StrategicWorld.cellId),
        approachClasses: [landApproaches.length ? "land" : "", coastalApproaches.length ? "coastal" : "", "aerial"].filter(Boolean),
        credibleSpeciesIds: [...new Set(nearby.slice(0, 5).map((entry) => entry.population.speciesId))]
      };
    });
  }

  function attackDestination(definition, map, city) {
    const cityIndex = StrategicWorld.cellIndex(city.cellId);
    if (definition.movementModes.includes("flight") || definition.movementModes.includes("levitation") || definition.realm !== "ocean") return cityIndex;
    const topology = StrategicWorld.topologyForMap(map);
    return topology.neighbors[cityIndex].find((index) => map.surface.classes[index] === "W") ?? null;
  }

  function causeForWave(worldSeed, map, population, relations, migration) {
    const definition = SPECIES_BY_ID.get(population.speciesId);
    const centerIndex = StrategicWorld.cellIndex(population.centerCellId);
    const related = relations.filter((relation) => relation.populationIds.includes(population.id));
    const precipitation = map.climate.precipitationMm[centerIndex];
    const instability = 1000 - map.arcaneGeography.arcaneStabilityPermille[centerIndex];
    const flood = map.naturalHazards.floodPermille[centerIndex];
    const flame = map.arcaneGeography.primaryAspectClasses[centerIndex] === "F" || map.arcaneGeography.secondaryAspectClasses[centerIndex] === "F";
    const candidates = [];
    if (migration) candidates.push({ cause: "seasonalHabitatChange", score: 510, facts: [migration.id, migration.phases.outboundPhase] });
    if (["dense", "teeming"].includes(population.abundanceBand)) candidates.push({ cause: "breedingDispersal", score: 620 + population.populationIndex * 0.2, facts: [population.abundanceBand, `population-index:${population.populationIndex}`] });
    if (["apexPredator", "megapredator", "packPredator", "ambushPredator"].includes(definition.ecologicalRole) && related.some((relation) => relation.kind === "predation")) candidates.push({ cause: "preyPressure", score: 570, facts: related.filter((relation) => relation.kind === "predation").slice(0, 2).map((relation) => relation.id) });
    if (related.some((relation) => relation.kind === "rivalry" || relation.kind === "displacement")) candidates.push({ cause: "territorialDefeat", score: 540, facts: related.filter((relation) => relation.kind === "rivalry" || relation.kind === "displacement").slice(0, 2).map((relation) => relation.id) });
    if (instability >= 540) candidates.push({ cause: "arcaneDisruption", score: instability, facts: [`arcane-instability-permille:${instability}`, `cell:${population.centerCellId}`] });
    if (precipitation <= 520) candidates.push({ cause: "drought", score: 760 - precipitation * 0.5, facts: [`precipitation-mm:${precipitation}`, `biome:${map.biomes.classes[centerIndex]}`] });
    if (flame && precipitation <= 900) candidates.push({ cause: "fire", score: 520 + (900 - precipitation) * 0.2, facts: [`flame-aspect:${population.centerCellId}`, `precipitation-mm:${precipitation}`] });
    if (flood >= 620) candidates.push({ cause: "flood", score: flood, facts: [`flood-permille:${flood}`, `cell:${population.centerCellId}`] });
    if (!candidates.length) candidates.push({ cause: "breedingDispersal", score: 300, facts: [population.abundanceBand, definition.socialPattern] });
    return candidates.sort((left, right) => (right.score + seededNumber(worldSeed, `${population.id}:${right.cause}`) * 90) - (left.score + seededNumber(worldSeed, `${population.id}:${left.cause}`) * 90) || left.cause.localeCompare(right.cause))[0];
  }

  function corridorFromCity(map, cityId) {
    return map.routeGraph.routes.filter((route) => route.endpointIds.includes(cityId)).sort((left, right) => left.id.localeCompare(right.id));
  }

  function createWaveProfiles(worldSeed, map, populations, relations, migrations) {
    const migrationByPopulation = new Map(migrations.map((migration) => [migration.populationId, migration]));
    const candidates = [];
    for (const population of populations) {
      const definition = SPECIES_BY_ID.get(population.speciesId);
      if (definition.threatRank < 3) continue;
      const originIndex = StrategicWorld.cellIndex(population.centerCellId);
      const reachable = map.humanGeography.cities.map((city) => {
        const destinationIndex = attackDestination(definition, map, city);
        if (destinationIndex === null) return null;
        const distance = StrategicWorld.greatCircleDistanceKm(map, originIndex, destinationIndex);
        const limit = definition.movementModes.includes("flight") ? 3600 : 2200;
        return distance <= limit ? { city, destinationIndex, distance } : null;
      }).filter(Boolean).sort((left, right) => left.distance - right.distance || left.city.id.localeCompare(right.city.id));
      if (!reachable.length) continue;
      const roll = seededNumber(worldSeed, `${population.id}:wave-candidate`);
      const pressure = definition.threatRank * 0.12 + population.populationIndex / 2200 + (migrationByPopulation.has(population.id) ? 0.1 : 0);
      if (roll > clamp(pressure, 0.22, 0.72)) continue;
      candidates.push({ population, definition, ...reachable[0], priority: pressure - roll });
    }
    const maximum = Math.max(4, Math.round(map.humanGeography.cities.length * 1.25));
    const profiles = [];
    const sharedThreats = [];
    const cityWaveCounts = new Map(map.humanGeography.cities.map((city) => [city.id, 0]));
    for (const candidate of candidates.sort((left, right) => right.priority - left.priority || left.population.id.localeCompare(right.population.id)).slice(0, maximum)) {
      if ((cityWaveCounts.get(candidate.city.id) || 0) >= 3) continue;
      const originIndex = StrategicWorld.cellIndex(candidate.population.centerCellId);
      let path = shortestMovementPath(candidate.definition, map, originIndex, candidate.destinationIndex, candidate.destinationIndex === StrategicWorld.cellIndex(candidate.city.cellId));
      if (!path) continue;
      const threatenedCityIds = [candidate.city.id];
      const severe = candidate.definition.threatRank >= 4 || ["dense", "teeming"].includes(candidate.population.abundanceBand);
      if (severe && candidate.definition.realm !== "ocean" && seededNumber(worldSeed, `${candidate.population.id}:shared-threat`) >= 0.62) {
        const corridor = corridorFromCity(map, candidate.city.id).find((route) => {
          const otherCityId = route.endpointIds.find((id) => id !== candidate.city.id);
          return (cityWaveCounts.get(otherCityId) || 0) < 3;
        });
        if (corridor) {
          const secondCityId = corridor.endpointIds.find((id) => id !== candidate.city.id);
          const corridorPath = corridor.cellPath.map(StrategicWorld.cellIndex);
          if (corridorPath[0] !== path[path.length - 1]) corridorPath.reverse();
          path = [...path, ...corridorPath.slice(1)];
          threatenedCityIds.push(secondCityId);
        }
      }
      const migration = migrationByPopulation.get(candidate.population.id) || null;
      const cause = causeForWave(worldSeed, map, candidate.population, relations, migration);
      const severityBand = candidate.definition.threatRank >= 4 && candidate.population.populationIndex >= 500 ? "catastrophic" : (candidate.definition.threatRank >= 3 ? "dangerous" : "guarded");
      const profile = {
        id: `beast-wave:${String(profiles.length + 1).padStart(4, "0")}`,
        populationId: candidate.population.id,
        cause: cause.cause,
        triggerFacts: cause.facts,
        originCellId: candidate.population.centerCellId,
        destinationCellId: StrategicWorld.cellId(path[path.length - 1]),
        cellPath: path.map(StrategicWorld.cellId),
        distanceKm: pathLengthKm(map, path),
        threatenedCityIds,
        threatenedCorridorIds: map.routeGraph.routes.filter((route) => route.cellPath.some((cellId) => profilePathIncludes(path, cellId))).map((route) => route.id),
        severityBand,
        recurrenceBand: cause.cause === "seasonalHabitatChange" ? "seasonal" : (candidate.population.abundanceBand === "relict" ? "sporadic" : "intermittent"),
        seasonalWindow: migration?.phases.outboundPhase || SEASON_PHASES[Math.floor(seededNumber(worldSeed, `${candidate.population.id}:wave-season`) * SEASON_PHASES.length)],
        warningLeadBand: candidate.definition.movementModes.includes("flight") ? "hours" : (path.length <= 12 ? "days" : "weeks"),
        warningSigns: warningSigns(cause.cause, candidate.definition)
      };
      profiles.push(profile);
      for (const cityId of threatenedCityIds) cityWaveCounts.set(cityId, (cityWaveCounts.get(cityId) || 0) + 1);
      if (threatenedCityIds.length > 1) {
        const polityIds = threatenedCityIds.map((cityId) => map.cityPolities.polities.find((polity) => polity.cityId === cityId)?.id).filter(Boolean).sort();
        const relation = map.cityPolities.relations.find((entry) => entry.cityPolityIds.every((id) => polityIds.includes(id)) && polityIds.length === 2);
        sharedThreats.push({
          id: `shared-beast-threat:${String(sharedThreats.length + 1).padStart(4, "0")}`,
          waveProfileId: profile.id,
          cityIds: [...threatenedCityIds].sort(),
          cityPolityIds: polityIds,
          warningRelationId: relation?.id || null,
          warningProtocol: "sharedMonsterWaveWarningProtocol",
          coalitionFormed: false
        });
      }
    }
    return { profiles, sharedThreats };
  }

  function profilePathIncludes(path, cellId) {
    return path.includes(StrategicWorld.cellIndex(cellId));
  }

  function warningSigns(cause, definition) {
    const movement = definition.movementModes.includes("flight") ? "mass aerial sightings" : (definition.realm === "ocean" ? "coastal sonar and tide anomalies" : "tracks and displaced wildlife");
    const causeSign = {
      breedingDispersal: "juvenile groups leaving core habitat",
      preyPressure: "prey populations abandoning the region",
      territorialDefeat: "violent range-boundary activity",
      arcaneDisruption: "unstable mana readings",
      drought: "drying water sources",
      fire: "smoke and flame-aspect surges",
      flood: "rapidly rising drainage basins",
      seasonalHabitatChange: "recurring seasonal movement"
    }[cause];
    return [causeSign, movement];
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

  function expandMovementPath(cellPath, steps, definition, map) {
    const topology = StrategicWorld.topologyForMap(map);
    const expanded = new Set(cellPath.map(StrategicWorld.cellIndex));
    let frontier = new Set(expanded);
    for (let step = 0; step < steps; step += 1) {
      const next = new Set();
      for (const index of frontier) {
        for (const neighbor of topology.neighbors[index]) {
          if (expanded.has(neighbor) || !movementAllowsCell(definition, map, neighbor, true)) continue;
          expanded.add(neighbor);
          next.add(neighbor);
        }
      }
      frontier = next;
    }
    return [...expanded].sort((left, right) => left - right);
  }

  function citiesNearPath(map, cellPath) {
    const topology = StrategicWorld.topologyForMap(map);
    const indices = new Set(cellPath.map(StrategicWorld.cellIndex));
    return map.humanGeography.cities.filter((city) => {
      const index = StrategicWorld.cellIndex(city.cellId);
      return indices.has(index) || topology.neighbors[index].some((neighbor) => indices.has(neighbor));
    }).map((city) => city.id);
  }

  function reportedWaveCause(cause) {
    if (cause === "seasonalHabitatChange") return "seasonalMovement";
    if (["preyPressure", "territorialDefeat", "breedingDispersal"].includes(cause)) return "ecologicalDisplacement";
    if (cause === "arcaneDisruption") return "arcaneDisruption";
    return "environmentalDisruption";
  }

  function blurExposureBand(actual, seed, cityId) {
    const index = ATTACK_EXPOSURE_BANDS.indexOf(actual);
    const roll = seededNumber(seed, `${cityId}:public-attack-exposure`);
    if (roll >= 0.7) return actual;
    const offset = roll < 0.35 ? -1 : 1;
    return ATTACK_EXPOSURE_BANDS[clamp(index + offset, 0, ATTACK_EXPOSURE_BANDS.length - 1)];
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
    const migrationReports = ecology.migrations.map((migration) => {
      const population = ecology.populations.find((entry) => entry.id === migration.populationId);
      const definition = SPECIES_BY_ID.get(population.speciesId);
      const nearbyCityIds = citiesNearPath(map, migration.cellPath);
      const confidence = nearbyCityIds.length ? "high" : (seededNumber(worldSeed, `${migration.id}:public-confidence`) >= 0.48 ? "moderate" : "low");
      return { migration, population, definition, nearbyCityIds, confidence };
    }).filter(({ migration, confidence }) => confidence !== "low" || seededNumber(worldSeed, `${migration.id}:publicly-reported`) >= 0.42)
      .map(({ migration, population, definition, nearbyCityIds, confidence }, reportIndex) => {
        const expanded = expandMovementPath(migration.cellPath, confidence === "high" ? 1 : 2, definition, map);
        return {
          id: `beast-migration-report:${String(reportIndex + 1).padStart(4, "0")}`,
          speciesId: population.speciesId,
          reportedPathMask: maskForIndices(map.topology.cellCount, expanded),
          reportedPathCellCount: expanded.length,
          seasonalWindow: migration.phases.outboundPhase,
          travelPaceBand: migration.travelPaceBand,
          nearbyCityIds,
          confidence,
          publicReason: confidence === "high" ? "Repeated seasonal sightings near defended infrastructure" : (confidence === "moderate" ? "Correlated regional movement reports" : "Sparse long-range movement reports")
        };
      });
    const waveWarnings = ecology.waveProfiles.map((profile, warningIndex) => {
      const population = ecology.populations.find((entry) => entry.id === profile.populationId);
      const definition = SPECIES_BY_ID.get(population.speciesId);
      const expanded = expandMovementPath(profile.cellPath, profile.warningLeadBand === "hours" ? 2 : 1, definition, map);
      return {
        id: `beast-wave-warning:${String(warningIndex + 1).padStart(4, "0")}`,
        speciesId: population.speciesId,
        reportedCause: reportedWaveCause(profile.cause),
        reportedApproachMask: maskForIndices(map.topology.cellCount, expanded),
        reportedApproachCellCount: expanded.length,
        threatenedCityIds: [...profile.threatenedCityIds],
        threatenedCorridorIds: [...profile.threatenedCorridorIds],
        severityBand: profile.severityBand,
        recurrenceBand: profile.recurrenceBand,
        seasonalWindow: profile.seasonalWindow,
        warningLeadBand: profile.warningLeadBand,
        warningSigns: [...profile.warningSigns],
        confidence: profile.warningLeadBand === "weeks" ? "high" : "moderate"
      };
    });
    const cityAttackAssessments = ecology.cityAttackExposure.map((exposure) => {
      const approachIndices = exposure.approachCellIds.map(StrategicWorld.cellIndex);
      return {
        id: `public-${exposure.id}`,
        cityId: exposure.cityId,
        attackPossible: true,
        reportedExposureBand: blurExposureBand(exposure.exposureBand, worldSeed, exposure.cityId),
        approachClasses: [...exposure.approachClasses],
        reportedApproachMask: maskForIndices(map.topology.cellCount, approachIndices),
        confidence: "high",
        publicReason: "City defense surveys identify physically feasible beast approaches; this does not imply a current migration or wave."
      };
    });
    const sharedThreatReports = ecology.sharedThreats.map((shared, index) => ({
      id: `public-shared-beast-threat:${String(index + 1).padStart(4, "0")}`,
      cityIds: [...shared.cityIds],
      warningProtocol: shared.warningProtocol,
      warningRelationId: shared.warningRelationId,
      coalitionStatus: "none",
      confidence: "high"
    }));
    const threatClasses = new Array(map.topology.cellCount).fill(".");
    const contestedClasses = new Array(map.topology.cellCount).fill(".");
    const migrationClasses = new Array(map.topology.cellCount).fill(".");
    const wavePressureClasses = new Array(map.topology.cellCount).fill(".");
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
    for (const report of migrationReports) {
      const bytes = base64ToBytes(report.reportedPathMask);
      for (let index = 0; index < map.topology.cellCount; index += 1) if (bytes[index >> 3] & (1 << (index & 7))) migrationClasses[index] = "m";
    }
    for (const warning of waveWarnings) {
      const bytes = base64ToBytes(warning.reportedApproachMask);
      for (let index = 0; index < map.topology.cellCount; index += 1) if (bytes[index >> 3] & (1 << (index & 7))) wavePressureClasses[index] = "w";
    }
    const atlas = {
      sourceEcologyDigest: ecology.digest,
      reports,
      migrationReports,
      waveWarnings,
      cityAttackAssessments,
      sharedThreatReports,
      threatClasses: threatClasses.join(""),
      contestedClasses: contestedClasses.join(""),
      migrationClasses: migrationClasses.join(""),
      wavePressureClasses: wavePressureClasses.join(""),
      diagnostics: {
        reportCount: reports.length,
        migrationReportCount: migrationReports.length,
        waveWarningCount: waveWarnings.length,
        cityAttackAssessmentCount: cityAttackAssessments.length,
        sharedThreatReportCount: sharedThreatReports.length,
        highConfidenceReportCount: reports.filter((report) => report.confidence === "high").length,
        knownLairCount: reports.filter((report) => report.knownLairCellId).length,
        reportedCellCount: threatClasses.filter((code) => code !== ".").length,
        contestedCellCount: contestedClasses.filter((code) => code === "c").length,
        reportedMigrationCellCount: migrationClasses.filter((code) => code === "m").length,
        reportedWavePressureCellCount: wavePressureClasses.filter((code) => code === "w").length
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
      migrations: record.migrations,
      cityAttackExposure: record.cityAttackExposure,
      waveProfiles: record.waveProfiles,
      sharedThreats: record.sharedThreats,
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
    const relations = createRelations(populations, temporaryRanges);
    const migrations = createMigrations(seed, strategicMap, populations);
    const cityAttackExposure = cityAttackExposures(strategicMap, populations);
    const generatedWaves = createWaveProfiles(seed, strategicMap, populations, relations, migrations);
    const ecology = {
      sourceEnvironmentDigest: StrategicWorld.stableHash({ climate: strategicMap.climate, hydrology: strategicMap.hydrology, biomes: strategicMap.biomes }),
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      species: clone(BEAST_SPECIES),
      populations,
      relations,
      migrations,
      cityAttackExposure,
      waveProfiles: generatedWaves.profiles,
      sharedThreats: generatedWaves.sharedThreats,
      diagnostics: {
        speciesCount: BEAST_SPECIES.length,
        populationCount: populations.length,
        migrationCount: migrations.length,
        attackableCityCount: cityAttackExposure.filter((entry) => entry.attackable).length,
        waveProfileCount: generatedWaves.profiles.length,
        citiesWithWaveProfiles: new Set(generatedWaves.profiles.flatMap((profile) => profile.threatenedCityIds)).size,
        sharedThreatCount: generatedWaves.sharedThreats.length,
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

  function validateCellPath(map, cellPath, label) {
    if (!Array.isArray(cellPath) || cellPath.length < 2) throw new Error(`${label} requires an ordered multi-cell path.`);
    const topology = StrategicWorld.topologyForMap(map);
    const indices = cellPath.map((cellId) => StrategicWorld.cellIndex(cellId));
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= topology.cellCount)) throw new Error(`${label} references an invalid strategic cell.`);
    for (let index = 1; index < indices.length; index += 1) if (!topology.neighbors[indices[index - 1]].includes(indices[index])) throw new Error(`${label} must follow saved globe adjacency.`);
    return indices;
  }

  function validateBeastEcology(map, ecology = map?.beastEcology, publicAtlas = map?.publicBeastAtlas) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    if (!ecology || !publicAtlas || !Array.isArray(ecology.species) || !Array.isArray(ecology.populations) || !Array.isArray(ecology.relations) || !Array.isArray(ecology.migrations) || !Array.isArray(ecology.cityAttackExposure) || !Array.isArray(ecology.waveProfiles) || !Array.isArray(ecology.sharedThreats)) throw new Error("Strategic beast ecology is incomplete.");
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
    const migrationIds = new Set();
    for (const migration of ecology.migrations) {
      const population = ecology.populations.find((entry) => entry.id === migration.populationId);
      const definition = population ? SPECIES_BY_ID.get(population.speciesId) : null;
      const indices = validateCellPath(strategicMap, migration.cellPath, `${migration.id} migration`);
      if (!/^beast-migration:\d{4}$/.test(String(migration.id || "")) || migrationIds.has(migration.id) || !population || !MIGRATORY_SOCIAL_PATTERNS.includes(definition.socialPattern) || migration.kind !== "seasonalCycle") throw new Error("Seasonal migrations require unique identities and behaviorally migratory populations.");
      if (migration.homeCellId !== population.centerCellId || migration.cellPath[0] !== migration.homeCellId || migration.cellPath.at(-1) !== migration.seasonalCellId || !Number.isFinite(migration.distanceKm) || migration.distanceKm <= 0) throw new Error(`${migration.id} has inconsistent migration anchors.`);
      if (!Object.values(migration.phases || {}).every((phase) => SEASON_PHASES.includes(phase)) || new Set(Object.values(migration.phases || {})).size !== 4) throw new Error(`${migration.id} has invalid seasonal timing.`);
      if (indices.some((index) => !movementAllowsCell(definition, strategicMap, index))) throw new Error(`${migration.id} violates its species movement realm.`);
      migrationIds.add(migration.id);
    }
    const cityIds = new Set(strategicMap.humanGeography.cities.map((city) => city.id));
    if (ecology.cityAttackExposure.length !== cityIds.size) throw new Error("Every fortified city requires one beast-attack exposure assessment.");
    const exposureCityIds = new Set();
    const topology = StrategicWorld.topologyForMap(strategicMap);
    for (const exposure of ecology.cityAttackExposure) {
      const city = strategicMap.humanGeography.cities.find((entry) => entry.id === exposure.cityId);
      const cityIndex = city ? StrategicWorld.cellIndex(city.cellId) : -1;
      const approaches = Array.isArray(exposure.approachCellIds) ? exposure.approachCellIds.map(StrategicWorld.cellIndex) : [];
      if (!/^city-beast-exposure:\d{5}$/.test(String(exposure.id || "")) || !city || exposureCityIds.has(exposure.cityId) || exposure.attackable !== true || !ATTACK_EXPOSURE_BANDS.includes(exposure.exposureBand) || !approaches.length) throw new Error("Every city must remain physically attackable without requiring a migration route.");
      if (approaches.some((index) => !topology.neighbors[cityIndex].includes(index)) || !Array.isArray(exposure.approachClasses) || !exposure.approachClasses.includes("aerial") || !Array.isArray(exposure.credibleSpeciesIds) || exposure.credibleSpeciesIds.some((id) => !SPECIES_BY_ID.has(id))) throw new Error(`${exposure.id} has invalid feasible beast approaches.`);
      exposureCityIds.add(exposure.cityId);
    }
    const corridorIds = new Set(strategicMap.routeGraph.routes.map((route) => route.id));
    const waveIds = new Set();
    for (const profile of ecology.waveProfiles) {
      const population = ecology.populations.find((entry) => entry.id === profile.populationId);
      const definition = population ? SPECIES_BY_ID.get(population.speciesId) : null;
      const indices = validateCellPath(strategicMap, profile.cellPath, `${profile.id} wave`);
      if (!/^beast-wave:\d{4}$/.test(String(profile.id || "")) || waveIds.has(profile.id) || !population || !WAVE_CAUSES.includes(profile.cause) || !Array.isArray(profile.triggerFacts) || !profile.triggerFacts.length) throw new Error("Monster-wave profiles require unique identities and causal saved facts.");
      if (profile.originCellId !== population.centerCellId || profile.cellPath[0] !== profile.originCellId || profile.cellPath.at(-1) !== profile.destinationCellId || indices.some((index) => !movementAllowsCell(definition, strategicMap, index, true))) throw new Error(`${profile.id} has an invalid movement path.`);
      if (!Array.isArray(profile.threatenedCityIds) || !profile.threatenedCityIds.length || profile.threatenedCityIds.some((id) => !cityIds.has(id)) || !Array.isArray(profile.threatenedCorridorIds) || profile.threatenedCorridorIds.some((id) => !corridorIds.has(id))) throw new Error(`${profile.id} has invalid threatened infrastructure.`);
      if (!WAVE_SEVERITY_BANDS.includes(profile.severityBand) || !RECURRENCE_BANDS.includes(profile.recurrenceBand) || !SEASON_PHASES.includes(profile.seasonalWindow) || !["hours", "days", "weeks"].includes(profile.warningLeadBand) || !Array.isArray(profile.warningSigns) || profile.warningSigns.length < 2) throw new Error(`${profile.id} has invalid pressure and warning classifications.`);
      waveIds.add(profile.id);
    }
    for (const shared of ecology.sharedThreats) {
      const profile = ecology.waveProfiles.find((entry) => entry.id === shared.waveProfileId);
      const relation = strategicMap.cityPolities.relations.find((entry) => entry.id === shared.warningRelationId);
      if (!/^shared-beast-threat:\d{4}$/.test(String(shared.id || "")) || !profile || !Array.isArray(shared.cityIds) || shared.cityIds.length < 2 || shared.cityIds.some((id) => !profile.threatenedCityIds.includes(id)) || shared.warningProtocol !== "sharedMonsterWaveWarningProtocol" || !relation?.standingObligations.includes(shared.warningProtocol) || shared.coalitionFormed !== false) throw new Error("Shared beast threats require an existing neighboring-city warning handoff without a coalition.");
    }
    if (ecology.digest !== `beast-ecology-${StrategicWorld.stableHash(ecologyCore(ecology))}`) throw new Error("Strategic beast ecology does not match its digest.");
    if (publicAtlas.sourceEcologyDigest !== ecology.digest || !Array.isArray(publicAtlas.reports) || !Array.isArray(publicAtlas.migrationReports) || !Array.isArray(publicAtlas.waveWarnings) || !Array.isArray(publicAtlas.cityAttackAssessments) || !Array.isArray(publicAtlas.sharedThreatReports) || String(publicAtlas.threatClasses || "").length !== strategicMap.topology.cellCount || /[^.1234]/.test(publicAtlas.threatClasses) || String(publicAtlas.contestedClasses || "").length !== strategicMap.topology.cellCount || /[^.c]/.test(publicAtlas.contestedClasses) || String(publicAtlas.migrationClasses || "").length !== strategicMap.topology.cellCount || /[^.m]/.test(publicAtlas.migrationClasses) || String(publicAtlas.wavePressureClasses || "").length !== strategicMap.topology.cellCount || /[^.w]/.test(publicAtlas.wavePressureClasses)) throw new Error("Public beast atlas is invalid.");
    for (const report of publicAtlas.reports) {
      validateMask(report.reportedRangeMask, strategicMap.topology.cellCount, `${report.id} public range`);
      if (!/^beast-report:\d{4}$/.test(String(report.id || "")) || !SPECIES_BY_ID.has(report.speciesId) || !CONFIDENCE_BANDS.includes(report.confidence) || !ABUNDANCE_BANDS.includes(report.reportedAbundanceBand) || !THREAT_BANDS.includes(report.threatBand) || Object.hasOwn(report, "populationId") || Object.hasOwn(report, "populationIndex") || Object.hasOwn(report, "lairCellId")) throw new Error(`${report.id} leaks or contains invalid public ecology facts.`);
    }
    for (const report of publicAtlas.migrationReports) {
      validateMask(report.reportedPathMask, strategicMap.topology.cellCount, `${report.id} reported migration corridor`);
      if (!/^beast-migration-report:\d{4}$/.test(String(report.id || "")) || !SPECIES_BY_ID.has(report.speciesId) || !SEASON_PHASES.includes(report.seasonalWindow) || !CONFIDENCE_BANDS.includes(report.confidence) || Object.hasOwn(report, "populationId") || Object.hasOwn(report, "cellPath")) throw new Error(`${report.id} leaks or contains invalid public migration facts.`);
    }
    for (const warning of publicAtlas.waveWarnings) {
      validateMask(warning.reportedApproachMask, strategicMap.topology.cellCount, `${warning.id} reported wave approach`);
      if (!/^beast-wave-warning:\d{4}$/.test(String(warning.id || "")) || !SPECIES_BY_ID.has(warning.speciesId) || !Array.isArray(warning.threatenedCityIds) || warning.threatenedCityIds.some((id) => !cityIds.has(id)) || !WAVE_SEVERITY_BANDS.includes(warning.severityBand) || !RECURRENCE_BANDS.includes(warning.recurrenceBand) || Object.hasOwn(warning, "populationId") || Object.hasOwn(warning, "cellPath") || Object.hasOwn(warning, "triggerFacts") || Object.hasOwn(warning, "cause")) throw new Error(`${warning.id} leaks or contains invalid public wave facts.`);
    }
    if (publicAtlas.cityAttackAssessments.length !== cityIds.size || publicAtlas.cityAttackAssessments.some((assessment) => !cityIds.has(assessment.cityId) || assessment.attackPossible !== true || !ATTACK_EXPOSURE_BANDS.includes(assessment.reportedExposureBand) || !CONFIDENCE_BANDS.includes(assessment.confidence))) throw new Error("Public city beast-attack assessments are incomplete.");
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
    const migrationReports = map.publicBeastAtlas.migrationReports.filter((report) => maskIncludes(report.reportedPathMask, index)).map((report) => ({ ...clone(report), species: clone(SPECIES_BY_ID.get(report.speciesId)) }));
    const waveWarnings = map.publicBeastAtlas.waveWarnings.filter((warning) => maskIncludes(warning.reportedApproachMask, index)).map((warning) => ({ ...clone(warning), species: clone(SPECIES_BY_ID.get(warning.speciesId)) }));
    const cellId = StrategicWorld.cellId(index);
    const attackAssessments = map.publicBeastAtlas.cityAttackAssessments.filter((assessment) => {
      const city = map.humanGeography.cities.find((entry) => entry.id === assessment.cityId);
      return city?.cellId === cellId || maskIncludes(assessment.reportedApproachMask, index);
    }).map(clone);
    return {
      threatBand: THREAT_CLASS_LEGEND[map.publicBeastAtlas.threatClasses[index]],
      contested: map.publicBeastAtlas.contestedClasses[index] === "c",
      migrationPressure: map.publicBeastAtlas.migrationClasses[index] === "m",
      wavePressure: map.publicBeastAtlas.wavePressureClasses[index] === "w",
      reports,
      migrationReports,
      waveWarnings,
      attackAssessments
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

  function publicCityThreatDirectory(map) {
    if (!map?.publicBeastAtlas || !map?.humanGeography || !map?.cityPolities) return [];
    return map.humanGeography.cities.map((city) => {
      const polity = map.cityPolities.polities.find((entry) => entry.cityId === city.id);
      const assessment = map.publicBeastAtlas.cityAttackAssessments.find((entry) => entry.cityId === city.id);
      return {
        city: clone(city),
        polity: clone(polity),
        attackAssessment: clone(assessment),
        migrations: map.publicBeastAtlas.migrationReports.filter((entry) => entry.nearbyCityIds.includes(city.id)).map((entry) => ({ ...clone(entry), species: clone(SPECIES_BY_ID.get(entry.speciesId)) })),
        waveWarnings: map.publicBeastAtlas.waveWarnings.filter((entry) => entry.threatenedCityIds.includes(city.id)).map((entry) => ({ ...clone(entry), species: clone(SPECIES_BY_ID.get(entry.speciesId)) })),
        sharedThreats: map.publicBeastAtlas.sharedThreatReports.filter((entry) => entry.cityIds.includes(city.id)).map(clone)
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
      migrationCount: ecology.migrations.length,
      migrationsUseEligibleSpecies: ecology.migrations.every((migration) => {
        const population = ecology.populations.find((entry) => entry.id === migration.populationId);
        return MIGRATORY_SOCIAL_PATTERNS.includes(SPECIES_BY_ID.get(population.speciesId).socialPattern);
      }),
      cityAttackExposureCount: ecology.cityAttackExposure.length,
      everyCityAttackable: ecology.cityAttackExposure.length === map.humanGeography.cities.length && ecology.cityAttackExposure.every((entry) => entry.attackable),
      waveProfileCount: ecology.waveProfiles.length,
      citiesWithWaveProfiles: new Set(ecology.waveProfiles.flatMap((profile) => profile.threatenedCityIds)).size,
      citiesWithoutWaveProfiles: map.humanGeography.cities.length - new Set(ecology.waveProfiles.flatMap((profile) => profile.threatenedCityIds)).size,
      causalWaveProfiles: ecology.waveProfiles.every((profile) => WAVE_CAUSES.includes(profile.cause) && profile.triggerFacts.length > 0),
      sharedThreatCount: ecology.sharedThreats.length,
      sharedThreatsUseWarningProtocols: ecology.sharedThreats.every((entry) => entry.warningProtocol === "sharedMonsterWaveWarningProtocol" && entry.coalitionFormed === false),
      canonicalLandCoveragePercent: canonicalLandCovered.size / Math.max(1, landIndices.length) * 100,
      publicReportCount: publicAtlas.reports.length,
      publicMigrationReportCount: publicAtlas.migrationReports.length,
      publicWaveWarningCount: publicAtlas.waveWarnings.length,
      publicAtlasHidesExactPaths: [...publicAtlas.migrationReports, ...publicAtlas.waveWarnings].every((entry) => !Object.hasOwn(entry, "cellPath") && !Object.hasOwn(entry, "populationId")),
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
    SEASON_PHASES,
    MIGRATORY_SOCIAL_PATTERNS,
    WAVE_CAUSES,
    WAVE_SEVERITY_BANDS,
    RECURRENCE_BANDS,
    ATTACK_EXPOSURE_BANDS,
    THREAT_CLASS_LEGEND,
    createBeastEcology,
    validateBeastEcology,
    attachBeastEcology,
    cellPublicBeastSnapshot,
    publicBestiary,
    publicCityThreatDirectory,
    auditBeastEcology,
    maskIncludes,
    clone
  });
});
