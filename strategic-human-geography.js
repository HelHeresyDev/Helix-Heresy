(function initStrategicHumanGeography(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const resourcePotential = typeof module === "object" && module.exports
    ? require("./strategic-resource-potential")
    : root?.HelixStrategicResourcePotential;
  const api = factory(strategicWorld, resourcePotential);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicHumanGeography = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicHumanGeographyApi(StrategicWorld, StrategicResourcePotential) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-human-geography.js");
  if (!StrategicResourcePotential) throw new Error("HelixStrategicResourcePotential must load before strategic-human-geography.js");

  const HUMAN_GEOGRAPHY_VERSION = 1;
  const DEFAULT_CITY_CELLS_PER_CITY = 125;
  const DEFAULT_MINIMUM_CITY_COUNT = 18;
  const DEFAULT_MAXIMUM_CITY_COUNT = 44;
  const DEFAULT_MINIMUM_CITY_SPACING_KM = 340;
  const CITY_BANDS = Object.freeze(["limited", "adequate", "strong", "formidable"]);
  const EXPOSURE_BANDS = Object.freeze(["limited", "moderate", "high", "extreme"]);
  const ISOLATION_BANDS = Object.freeze(["connected", "remote", "extreme"]);
  const CORRIDOR_CLASSES = Object.freeze(["primary", "redundant"]);
  const FOUNDING_ADVANTAGES = Object.freeze([
    "freshWater",
    "productiveHinterland",
    "stableGround",
    "constructionMaterials",
    "manaAccess",
    "defensibleTerrain",
    "transportPosition"
  ]);
  const CITY_NAME_OPENINGS = Object.freeze([
    "Aster", "Brass", "Cinder", "Cloud", "Dawn", "Ember", "Glass", "High",
    "Iron", "Lumen", "Moon", "Rune", "Star", "Storm", "Sun", "Thunder"
  ]);
  const CITY_NAME_ENDINGS = Object.freeze([
    "bastion", "bridge", "crown", "gate", "haven", "hold", "reach", "rest",
    "shield", "spire", "vault", "wall", "ward", "watch", "well", "works"
  ]);
  const NATURAL_HAZARD_FIELDS = Object.freeze([
    "earthquakePermille", "volcanicPermille", "landslidePermille",
    "subsidencePermille", "geothermalPermille", "floodPermille"
  ]);
  const MAGICAL_HAZARD_FIELDS = Object.freeze([
    "manaSurgePermille", "arcaneStormPermille", "realityDistortionPermille",
    "elementalManifestationPermille", "nullInterferencePermille"
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

  function maximumField(record, fields, index) {
    return Math.max(...fields.map((field) => Number(record?.[field]?.[index]) || 0));
  }

  function waterSignal(map, index) {
    if (map.hydrology.lakeByCell[index] >= 0) return 1000;
    if (map.hydrology.riverClasses[index] === "G") return 930;
    if (map.hydrology.riverClasses[index] === "R") return 820;
    if (map.hydrology.riverClasses[index] === "r") return 680;
    if (map.hydrology.wetlandClasses[index] !== ".") return 650;
    return map.resourcePotential.potentialPermille.freshWater[index];
  }

  function climateComfort(map, index) {
    const temperatureC = map.climate.temperatureTenthsC[index] / 10;
    const temperatureComfort = clamp(1000 - Math.abs(temperatureC - 16) * 32, 0, 1000);
    const precipitation = map.climate.precipitationMm[index];
    const rainfallComfort = precipitation < 250
      ? clamp(precipitation * 2.4, 0, 600)
      : precipitation > 2600
        ? clamp(1000 - (precipitation - 2600) * 0.22, 250, 1000)
        : 1000;
    return temperatureComfort * 0.62 + rainfallComfort * 0.38;
  }

  function wildernessExposurePermille(map, index) {
    const biological = map.resourcePotential.potentialPermille.biologicalProductivity[index];
    const mana = map.arcaneGeography.manaConcentrationPermille[index];
    const manifestation = map.magicalHazards.elementalManifestationPermille[index];
    const arcaneStorm = map.magicalHazards.arcaneStormPermille[index];
    const natural = maximumField(map.naturalHazards, NATURAL_HAZARD_FIELDS, index);
    return Math.round(clamp(
      biological * 0.36 + mana * 0.1 + manifestation * 0.25 + arcaneStorm * 0.12 + natural * 0.17,
      0,
      1000
    ));
  }

  function citySuitabilityPermille(map, index, worldSeed = "") {
    if (map.surface.classes[index] !== "L") return 0;
    const resources = map.resourcePotential.potentialPermille;
    const water = waterSignal(map, index);
    const food = resources.biologicalProductivity[index];
    const materials = resources.constructionStone[index];
    const industrial = (resources.ferrousOre[index] + resources.baseMetalOre[index] + resources.industrialMinerals[index]) / 3;
    const energy = Math.max(resources.geothermalEnergy[index], map.arcaneGeography.manaConcentrationPermille[index] * 0.82);
    const stability = map.geology.stabilityPermille[index];
    const accessibility = map.resourcePotential.surfaceAccessibilityPermille[index];
    const difficulty = map.resourcePotential.environmentalDifficultyPermille[index];
    const comfort = climateComfort(map, index);
    const wilderness = wildernessExposurePermille(map, index);
    const noise = (seededNoise(worldSeed, index, "fortified-city-suitability") - 0.5) * 70;
    return Math.round(clamp(
      water * 0.19 + food * 0.14 + materials * 0.11 + industrial * 0.08 + energy * 0.07
        + stability * 0.13 + accessibility * 0.1 + comfort * 0.11
        - difficulty * 0.05 - wilderness * 0.08 + 155 + noise,
      0,
      1000
    ));
  }

  function bandFor(value) {
    if (value >= 780) return "formidable";
    if (value >= 620) return "strong";
    if (value >= 440) return "adequate";
    return "limited";
  }

  function exposureBandFor(value) {
    if (value >= 760) return "extreme";
    if (value >= 580) return "high";
    if (value >= 390) return "moderate";
    return "limited";
  }

  function cityDefensibility(map, index) {
    const slope = map.relief.slopePermille[index];
    const terrainDefense = clamp(slope * 22 + (["M", "P"].includes(map.relief.reliefClasses[index]) ? 240 : 80), 0, 720);
    const hazards = maximumField(map.naturalHazards, NATURAL_HAZARD_FIELDS, index);
    return Math.round(clamp(
      map.geology.stabilityPermille[index] * 0.4
        + map.resourcePotential.potentialPermille.constructionStone[index] * 0.22
        + terrainDefense * 0.28 - hazards * 0.12 + 160,
      0,
      1000
    ));
  }

  function infrastructurePotential(map, index) {
    const resources = map.resourcePotential.potentialPermille;
    const energy = Math.max(resources.geothermalEnergy[index], map.arcaneGeography.manaConcentrationPermille[index]);
    return Math.round(clamp(
      resources.constructionStone[index] * 0.2 + resources.ferrousOre[index] * 0.12
        + resources.baseMetalOre[index] * 0.1 + waterSignal(map, index) * 0.18
        + energy * 0.18 + map.resourcePotential.surfaceAccessibilityPermille[index] * 0.22,
      0,
      1000
    ));
  }

  function foundingAdvantages(map, index) {
    const resources = map.resourcePotential.potentialPermille;
    const scores = [
      ["freshWater", waterSignal(map, index)],
      ["productiveHinterland", resources.biologicalProductivity[index]],
      ["stableGround", map.geology.stabilityPermille[index]],
      ["constructionMaterials", Math.max(resources.constructionStone[index], resources.ferrousOre[index])],
      ["manaAccess", map.arcaneGeography.manaConcentrationPermille[index]],
      ["defensibleTerrain", cityDefensibility(map, index)],
      ["transportPosition", clamp(
        (map.relief.coastClasses[index] !== "." ? 310 : 0)
          + (map.hydrology.riverClasses[index] !== "." ? 310 : 0)
          + map.resourcePotential.surfaceAccessibilityPermille[index] * 0.48,
        0,
        1000
      )]
    ];
    return scores.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 3).map(([id]) => id);
  }

  function generatedCityName(worldSeed, cellIndex, usedNames) {
    const openingIndex = Math.floor(seededNoise(worldSeed, cellIndex, "city-name-opening") * CITY_NAME_OPENINGS.length) % CITY_NAME_OPENINGS.length;
    const endingIndex = Math.floor(seededNoise(worldSeed, cellIndex, "city-name-ending") * CITY_NAME_ENDINGS.length) % CITY_NAME_ENDINGS.length;
    const base = `${CITY_NAME_OPENINGS[openingIndex]}${CITY_NAME_ENDINGS[endingIndex]}`;
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${base} ${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return name;
  }

  function selectRegionCityCells(map, worldSeed, regionIndex, targetCount, minimumSpacingKm) {
    const candidates = [];
    for (let index = 0; index < map.topology.cellCount; index += 1) {
      if (map.surface.classes[index] !== "L" || map.surface.regionByCell[index] !== regionIndex) continue;
      candidates.push({ index, score: citySuitabilityPermille(map, index, worldSeed) });
    }
    candidates.sort((left, right) => right.score - left.score || left.index - right.index);
    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= targetCount) break;
      if (selected.every((index) => StrategicWorld.greatCircleDistanceKm(map, index, candidate.index) >= minimumSpacingKm)) {
        selected.push(candidate.index);
      }
    }
    if (selected.length < targetCount) {
      for (const candidate of candidates) {
        if (selected.length >= targetCount) break;
        if (!selected.includes(candidate.index) && selected.every((index) => StrategicWorld.greatCircleDistanceKm(map, index, candidate.index) >= minimumSpacingKm * 0.58)) {
          selected.push(candidate.index);
        }
      }
    }
    return selected;
  }

  function allocateCityTargets(map, options = {}) {
    const minimum = Math.max(1, Math.floor(Number(options.minimumCityCount) || DEFAULT_MINIMUM_CITY_COUNT));
    const maximum = Math.max(minimum, Math.floor(Number(options.maximumCityCount) || DEFAULT_MAXIMUM_CITY_COUNT));
    const cellsPerCity = Math.max(40, Math.floor(Number(options.cityCellsPerCity) || DEFAULT_CITY_CELLS_PER_CITY));
    const landRegions = map.surface.regions
      .map((region, index) => ({ ...region, index }))
      .filter((region) => region.surfaceClass === "land" && region.cellCount >= 12);
    const eligibleCells = landRegions.reduce((total, region) => total + region.cellCount, 0);
    const minimumSupportedTotal = Math.min(maximum, landRegions.length * 2);
    const targetTotal = clamp(Math.round(eligibleCells / cellsPerCity), Math.max(minimum, minimumSupportedTotal), maximum);
    const allocations = landRegions.map((region) => ({
      regionIndex: region.index,
      regionCellCount: region.cellCount,
      target: Math.max(2, Math.floor(targetTotal * region.cellCount / Math.max(1, eligibleCells))),
      remainder: targetTotal * region.cellCount / Math.max(1, eligibleCells) % 1
    }));
    let allocated = allocations.reduce((total, allocation) => total + allocation.target, 0);
    for (const allocation of [...allocations].sort((left, right) => right.remainder - left.remainder || right.regionCellCount - left.regionCellCount)) {
      if (allocated >= targetTotal) break;
      allocation.target += 1;
      allocated += 1;
    }
    while (allocated > targetTotal) {
      const reducible = [...allocations].filter((allocation) => allocation.target > 2).sort((left, right) => left.remainder - right.remainder || right.target - left.target)[0];
      if (!reducible) break;
      reducible.target -= 1;
      allocated -= 1;
    }
    return allocations.sort((left, right) => left.regionIndex - right.regionIndex);
  }

  class MinimumHeap {
    constructor() { this.entries = []; }
    push(entry) {
      this.entries.push(entry);
      let index = this.entries.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.entries[parent].cost <= entry.cost) break;
        this.entries[index] = this.entries[parent];
        index = parent;
      }
      this.entries[index] = entry;
    }
    pop() {
      if (!this.entries.length) return null;
      const first = this.entries[0];
      const last = this.entries.pop();
      if (this.entries.length && last) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= this.entries.length) break;
          const child = right < this.entries.length && this.entries[right].cost < this.entries[left].cost ? right : left;
          if (this.entries[child].cost >= last.cost) break;
          this.entries[index] = this.entries[child];
          index = child;
        }
        this.entries[index] = last;
      }
      return first;
    }
  }

  function corridorStepCost(map, index, existingCells) {
    if (map.surface.classes[index] !== "L") return Infinity;
    const natural = maximumField(map.naturalHazards, NATURAL_HAZARD_FIELDS, index);
    const magical = maximumField(map.magicalHazards, MAGICAL_HAZARD_FIELDS, index);
    const slope = map.relief.slopePermille[index];
    const reliefPenalty = ["M", "P"].includes(map.relief.reliefClasses[index]) ? 1.1 : 0;
    const difficulty = map.resourcePotential.environmentalDifficultyPermille[index];
    const wilderness = wildernessExposurePermille(map, index);
    const reuseFactor = existingCells.has(index) ? 0.56 : 1;
    return (1 + slope * 0.055 + natural / 1000 * 2.4 + magical / 1000 * 1.35
      + difficulty / 1000 * 1.45 + wilderness / 1000 * 1.05 + reliefPenalty) * reuseFactor;
  }

  function leastCostLandPath(map, startIndex, endIndex, existingCells = new Set()) {
    const topology = StrategicWorld.topologyForMap(map);
    const distance = new Float64Array(topology.cellCount);
    distance.fill(Infinity);
    const previous = new Int32Array(topology.cellCount);
    previous.fill(-1);
    const heap = new MinimumHeap();
    distance[startIndex] = 0;
    heap.push({ index: startIndex, cost: 0 });
    while (heap.entries.length) {
      const current = heap.pop();
      if (!current || current.cost !== distance[current.index]) continue;
      if (current.index === endIndex) break;
      for (const neighbor of topology.neighbors[current.index]) {
        const step = corridorStepCost(map, neighbor, existingCells);
        if (!Number.isFinite(step)) continue;
        const nextCost = current.cost + step;
        if (nextCost >= distance[neighbor]) continue;
        distance[neighbor] = nextCost;
        previous[neighbor] = current.index;
        heap.push({ index: neighbor, cost: nextCost });
      }
    }
    if (!Number.isFinite(distance[endIndex])) return null;
    const path = [];
    for (let cursor = endIndex; cursor >= 0; cursor = previous[cursor]) {
      path.push(cursor);
      if (cursor === startIndex) break;
    }
    path.reverse();
    return { path, cost: distance[endIndex] };
  }

  function connectionPairs(map, cities) {
    const pairs = [];
    const byRegion = new Map();
    for (const city of cities) {
      const regionCities = byRegion.get(city.topologyRegionId) || [];
      regionCities.push(city);
      byRegion.set(city.topologyRegionId, regionCities);
    }
    for (const regionCities of byRegion.values()) {
      if (regionCities.length < 2) continue;
      const connected = new Set([regionCities[0].id]);
      const primaryKeys = new Set();
      while (connected.size < regionCities.length) {
        let best = null;
        for (const left of regionCities.filter((city) => connected.has(city.id))) {
          for (const right of regionCities.filter((city) => !connected.has(city.id))) {
            const distance = StrategicWorld.greatCircleDistanceKm(map, StrategicWorld.cellIndex(left.cellId), StrategicWorld.cellIndex(right.cellId));
            if (!best || distance < best.distance || (distance === best.distance && `${left.id}:${right.id}` < `${best.left.id}:${best.right.id}`)) {
              best = { left, right, distance };
            }
          }
        }
        if (!best) break;
        const key = [best.left.id, best.right.id].sort().join("|");
        primaryKeys.add(key);
        pairs.push({ left: best.left, right: best.right, corridorClass: "primary" });
        connected.add(best.right.id);
      }
      const candidates = [];
      for (const city of regionCities) {
        const alternatives = regionCities
          .filter((other) => other.id !== city.id)
          .map((other) => ({ other, distance: StrategicWorld.greatCircleDistanceKm(map, StrategicWorld.cellIndex(city.cellId), StrategicWorld.cellIndex(other.cellId)) }))
          .sort((left, right) => left.distance - right.distance || left.other.id.localeCompare(right.other.id));
        for (const alternative of alternatives.slice(0, 3)) {
          const key = [city.id, alternative.other.id].sort().join("|");
          if (!primaryKeys.has(key)) candidates.push({ key, left: city, right: alternative.other, distance: alternative.distance });
        }
      }
      const seen = new Set();
      const redundancyTarget = Math.max(1, Math.floor(regionCities.length / 3));
      for (const candidate of candidates.sort((left, right) => left.distance - right.distance || left.key.localeCompare(right.key))) {
        if (seen.has(candidate.key) || pairs.some((pair) => [pair.left.id, pair.right.id].sort().join("|") === candidate.key)) continue;
        pairs.push({ left: candidate.left, right: candidate.right, corridorClass: "redundant" });
        seen.add(candidate.key);
        if (seen.size >= redundancyTarget) break;
      }
    }
    return pairs;
  }

  function pathLengthKm(map, path) {
    let total = 0;
    for (let index = 1; index < path.length; index += 1) total += StrategicWorld.greatCircleDistanceKm(map, path[index - 1], path[index]);
    return Math.round(total);
  }

  function isolationBand(map, city, cities) {
    const index = StrategicWorld.cellIndex(city.cellId);
    const sameRegion = cities.filter((other) => other.id !== city.id && other.topologyRegionId === city.topologyRegionId);
    if (!sameRegion.length) return "extreme";
    const nearest = Math.min(...sameRegion.map((other) => StrategicWorld.greatCircleDistanceKm(map, index, StrategicWorld.cellIndex(other.cellId))));
    return nearest <= 560 ? "connected" : (nearest <= 980 ? "remote" : "extreme");
  }

  function humanGeographyCore(record) {
    return {
      version: record.version,
      sourceReliefDigest: record.sourceReliefDigest,
      sourceEnvironmentDigest: record.sourceEnvironmentDigest,
      sourceGeologyDigest: record.sourceGeologyDigest,
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      sourceResourcePotentialDigest: record.sourceResourcePotentialDigest,
      sourceRouteGraphDigest: record.sourceRouteGraphDigest,
      settings: record.settings,
      cities: record.cities,
      corridors: record.corridors,
      diagnostics: record.diagnostics
    };
  }

  function createHumanGeography(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic human geography.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicResourcePotential.validateStrategicResources(strategicMap);
    const cityCellsPerCity = Math.max(40, Math.floor(Number(options.cityCellsPerCity) || DEFAULT_CITY_CELLS_PER_CITY));
    const minimumCityCount = Math.max(1, Math.floor(Number(options.minimumCityCount) || DEFAULT_MINIMUM_CITY_COUNT));
    const maximumCityCount = Math.max(minimumCityCount, Math.floor(Number(options.maximumCityCount) || DEFAULT_MAXIMUM_CITY_COUNT));
    const minimumSpacingKm = Math.max(150, Math.round(Number(options.minimumCitySpacingKm) || DEFAULT_MINIMUM_CITY_SPACING_KM));
    const allocations = allocateCityTargets(strategicMap, { cityCellsPerCity, minimumCityCount, maximumCityCount });
    const selectedCells = allocations.flatMap((allocation) => selectRegionCityCells(
      strategicMap,
      seed,
      allocation.regionIndex,
      allocation.target,
      minimumSpacingKm
    ));
    const usedNames = new Set();
    let cities = selectedCells
      .sort((left, right) => left - right)
      .map((index) => ({
        id: `city:${String(index).padStart(5, "0")}`,
        kind: "fortifiedCity",
        name: generatedCityName(seed, index, usedNames),
        cellId: StrategicWorld.cellId(index),
        topologyRegionId: strategicMap.surface.regions[strategicMap.surface.regionByCell[index]].id,
        foundingAdvantages: foundingAdvantages(strategicMap, index),
        defensibilityBand: bandFor(cityDefensibility(strategicMap, index)),
        infrastructurePotentialBand: bandFor(infrastructurePotential(strategicMap, index)),
        wildernessExposureBand: exposureBandFor(wildernessExposurePermille(strategicMap, index)),
        isolationBand: "extreme"
      }));
    cities = cities.map((city) => ({ ...city, isolationBand: isolationBand(strategicMap, city, cities) }));

    const routeGraph = {
      version: StrategicWorld.ROUTE_GRAPH_VERSION,
      nodes: cities.map((city) => ({ id: city.id, kind: city.kind, cellId: city.cellId })),
      routes: []
    };
    const corridors = [];
    const existingCells = new Set();
    for (const pair of connectionPairs(strategicMap, cities)) {
      const leftIndex = StrategicWorld.cellIndex(pair.left.cellId);
      const rightIndex = StrategicWorld.cellIndex(pair.right.cellId);
      const result = leastCostLandPath(strategicMap, leftIndex, rightIndex, existingCells);
      if (!result) throw new Error(`No land corridor can connect ${pair.left.id} and ${pair.right.id}.`);
      result.path.forEach((index) => existingCells.add(index));
      const endpointIds = [pair.left.id, pair.right.id].sort();
      const routeId = `corridor:${endpointIds.map((id) => id.slice(5)).join("-")}`;
      routeGraph.routes.push({
        id: routeId,
        kind: "strategicIntercityCorridor",
        endpointIds,
        cellPath: result.path.map(StrategicWorld.cellId)
      });
      const meanExposure = result.path.reduce((total, index) => total + wildernessExposurePermille(strategicMap, index), 0) / result.path.length;
      corridors.push({
        id: routeId,
        corridorClass: pair.corridorClass,
        endpointCityIds: endpointIds,
        lengthKm: pathLengthKm(strategicMap, result.path),
        relativeConstructionCost: Math.round(result.cost * 100),
        exposureBand: exposureBandFor(meanExposure)
      });
    }
    routeGraph.routes.sort((left, right) => left.id.localeCompare(right.id));
    corridors.sort((left, right) => left.id.localeCompare(right.id));
    const validatedRouteGraph = StrategicWorld.validateRouteGraph(strategicMap, routeGraph);
    const record = {
      version: HUMAN_GEOGRAPHY_VERSION,
      sourceReliefDigest: strategicMap.relief.digest,
      sourceEnvironmentDigest: strategicMap.biomes.digest,
      sourceGeologyDigest: strategicMap.geology.digest,
      sourceArcaneGeographyDigest: strategicMap.arcaneGeography.digest,
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      sourceRouteGraphDigest: StrategicWorld.stableHash(validatedRouteGraph),
      settings: {
        cityCellsPerCity,
        minimumCityCount,
        maximumCityCount,
        minimumCitySpacingKm: minimumSpacingKm
      },
      cities,
      corridors,
      diagnostics: {
        cityCount: cities.length,
        corridorCount: corridors.length,
        primaryCorridorCount: corridors.filter((corridor) => corridor.corridorClass === "primary").length,
        redundantCorridorCount: corridors.filter((corridor) => corridor.corridorClass === "redundant").length,
        inhabitedLandRegionCount: new Set(cities.map((city) => city.topologyRegionId)).size,
        corridorCellCount: existingCells.size
      }
    };
    record.digest = `human-geography-${StrategicWorld.stableHash(humanGeographyCore(record))}`;
    return { humanGeography: record, routeGraph: validatedRouteGraph };
  }

  function validateHumanGeography(map, candidate = map?.humanGeography) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== HUMAN_GEOGRAPHY_VERSION) throw new Error("Strategic human-geography record is invalid.");
    if (candidate.sourceReliefDigest !== strategicMap.relief?.digest
      || candidate.sourceEnvironmentDigest !== strategicMap.biomes?.digest
      || candidate.sourceGeologyDigest !== strategicMap.geology?.digest
      || candidate.sourceArcaneGeographyDigest !== strategicMap.arcaneGeography?.digest
      || candidate.sourceResourcePotentialDigest !== strategicMap.resourcePotential?.digest) {
      throw new Error("Strategic human geography does not match its source geography.");
    }
    const routeGraph = StrategicWorld.validateRouteGraph(strategicMap, strategicMap.routeGraph);
    if (candidate.sourceRouteGraphDigest !== StrategicWorld.stableHash(routeGraph)) throw new Error("Strategic human geography does not match its route graph.");
    if (!Array.isArray(candidate.cities) || !candidate.cities.length || !Array.isArray(candidate.corridors)) throw new Error("Strategic human geography is incomplete.");
    const cityIds = new Set();
    const cityNames = new Set();
    const cityCellIds = new Set();
    const cityById = new Map();
    for (const city of candidate.cities) {
      const index = StrategicWorld.cellIndex(city.cellId);
      if (city.id !== `city:${String(index).padStart(5, "0")}` || cityIds.has(city.id)) throw new Error("Fortified cities require unique stable IDs tied to their cells.");
      if (!String(city.name || "").trim() || cityNames.has(city.name)) throw new Error("Fortified cities require unique generated names.");
      if (index < 0 || strategicMap.surface.classes[index] !== "L" || cityCellIds.has(city.cellId)) throw new Error(`${city.id} is not uniquely located on land.`);
      const region = strategicMap.surface.regions[strategicMap.surface.regionByCell[index]];
      if (city.topologyRegionId !== region?.id) throw new Error(`${city.id} has inconsistent land-region membership.`);
      if (!Array.isArray(city.foundingAdvantages) || city.foundingAdvantages.length !== 3 || new Set(city.foundingAdvantages).size !== 3 || city.foundingAdvantages.some((id) => !FOUNDING_ADVANTAGES.includes(id))) throw new Error(`${city.id} has invalid founding advantages.`);
      if (![city.defensibilityBand, city.infrastructurePotentialBand].every((band) => CITY_BANDS.includes(band)) || !EXPOSURE_BANDS.includes(city.wildernessExposureBand) || !ISOLATION_BANDS.includes(city.isolationBand)) throw new Error(`${city.id} has invalid public bands.`);
      cityIds.add(city.id);
      cityNames.add(city.name);
      cityCellIds.add(city.cellId);
      cityById.set(city.id, city);
    }
    const graphNodeIds = new Set(routeGraph.nodes.map((node) => node.id));
    if (routeGraph.nodes.length !== cityIds.size || graphNodeIds.size !== cityIds.size || [...cityIds].some((id) => !graphNodeIds.has(id))) throw new Error("The route graph does not contain every fortified city node exactly once.");
    for (const node of routeGraph.nodes) {
      const city = cityById.get(node.id);
      if (node.kind !== "fortifiedCity" || node.cellId !== city?.cellId) throw new Error(`${node.id} has inconsistent fortified-city node data.`);
    }
    const routeById = new Map(routeGraph.routes.map((route) => [route.id, route]));
    const corridorIds = new Set();
    for (const corridor of candidate.corridors) {
      const route = routeById.get(corridor.id);
      if (!route || corridorIds.has(corridor.id)) throw new Error("Human-geography corridors require unique matching route records.");
      if (!CORRIDOR_CLASSES.includes(corridor.corridorClass) || !EXPOSURE_BANDS.includes(corridor.exposureBand)) throw new Error(`${corridor.id} has invalid corridor classifications.`);
      if (!Array.isArray(corridor.endpointCityIds) || corridor.endpointCityIds.length !== 2 || corridor.endpointCityIds.some((id) => !cityById.has(id)) || corridor.endpointCityIds.join("|") !== route.endpointIds.join("|")) throw new Error(`${corridor.id} has invalid endpoints.`);
      const path = route.cellPath.map(StrategicWorld.cellIndex);
      if (!["strategicIntercityCorridor", "defendedGroundCorridor"].includes(route.kind)) throw new Error(`${corridor.id} has an invalid route kind.`);
      if (path.some((index) => strategicMap.surface.classes[index] !== "L")) throw new Error(`${corridor.id} crosses ocean cells.`);
      const pathEndpointCells = [route.cellPath[0], route.cellPath[route.cellPath.length - 1]].sort();
      const cityEndpointCells = corridor.endpointCityIds.map((id) => cityById.get(id).cellId).sort();
      if (pathEndpointCells.join("|") !== cityEndpointCells.join("|")) throw new Error(`${corridor.id} does not terminate at its named cities.`);
      const endpointRegions = corridor.endpointCityIds.map((id) => cityById.get(id).topologyRegionId);
      if (endpointRegions[0] !== endpointRegions[1] || path.some((index) => strategicMap.surface.regions[strategicMap.surface.regionByCell[index]].id !== endpointRegions[0])) throw new Error(`${corridor.id} leaves its connected land region.`);
      if (!Number.isFinite(Number(corridor.lengthKm)) || corridor.lengthKm <= 0 || !Number.isFinite(Number(corridor.relativeConstructionCost)) || corridor.relativeConstructionCost <= 0) throw new Error(`${corridor.id} has invalid distance or cost.`);
      if (corridor.lengthKm !== pathLengthKm(strategicMap, path)) throw new Error(`${corridor.id} has an inconsistent saved length.`);
      corridorIds.add(corridor.id);
    }
    if (corridorIds.size !== routeGraph.routes.length) throw new Error("The route graph contains a corridor without human-geography metadata.");
    const adjacency = new Map([...cityIds].map((id) => [id, new Set()]));
    for (const corridor of candidate.corridors) {
      adjacency.get(corridor.endpointCityIds[0]).add(corridor.endpointCityIds[1]);
      adjacency.get(corridor.endpointCityIds[1]).add(corridor.endpointCityIds[0]);
    }
    for (const regionId of new Set(candidate.cities.map((city) => city.topologyRegionId))) {
      const regionCities = candidate.cities.filter((city) => city.topologyRegionId === regionId);
      const visited = new Set([regionCities[0].id]);
      const queue = [regionCities[0].id];
      while (queue.length) {
        for (const neighbor of adjacency.get(queue.shift()) || []) {
          if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      if (regionCities.some((city) => !visited.has(city.id))) throw new Error(`Fortified cities in ${regionId} are not connected by primary corridors.`);
    }
    const expectedDigest = `human-geography-${StrategicWorld.stableHash(humanGeographyCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Strategic human-geography data does not match its digest.");
    return clone(candidate);
  }

  function attachHumanGeography(worldSeed, map, options = {}) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createHumanGeography(worldSeed, next, options);
    next.routeGraph = generated.routeGraph;
    next.humanGeography = generated.humanGeography;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function cellHumanGeographySnapshot(map, index) {
    if (!map?.humanGeography || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId) || null;
    const routes = map.routeGraph.routes.filter((route) => route.cellPath.includes(cellId));
    const corridorById = new Map(map.humanGeography.corridors.map((corridor) => [corridor.id, corridor]));
    return {
      city: city ? clone(city) : null,
      corridors: routes.map((route) => ({
        ...clone(corridorById.get(route.id)),
        endpointNames: route.endpointIds.map((cityId) => map.humanGeography.cities.find((entry) => entry.id === cityId)?.name || cityId)
      }))
    };
  }

  function auditHumanGeography(map) {
    const record = validateHumanGeography(map);
    const cityIndices = record.cities.map((city) => StrategicWorld.cellIndex(city.cellId));
    const meanCitySuitability = cityIndices.reduce((total, index) => total + citySuitabilityPermille(map, index, ""), 0) / cityIndices.length;
    const landIndices = [...map.surface.classes].map((code, index) => code === "L" ? index : -1).filter((index) => index >= 0);
    const meanLandSuitability = landIndices.reduce((total, index) => total + citySuitabilityPermille(map, index, ""), 0) / landIndices.length;
    return {
      valid: true,
      cityCount: record.cities.length,
      corridorCount: record.corridors.length,
      primaryCorridorCount: record.diagnostics.primaryCorridorCount,
      redundantCorridorCount: record.diagnostics.redundantCorridorCount,
      inhabitedLandRegionCount: record.diagnostics.inhabitedLandRegionCount,
      allCitiesOnLand: cityIndices.every((index) => map.surface.classes[index] === "L"),
      allCorridorsOnLand: map.routeGraph.routes.every((route) => route.cellPath.every((cellId) => map.surface.classes[StrategicWorld.cellIndex(cellId)] === "L")),
      citiesFavorHabitableCells: meanCitySuitability > meanLandSuitability,
      meanCitySuitability,
      meanLandSuitability
    };
  }

  return Object.freeze({
    HUMAN_GEOGRAPHY_VERSION,
    DEFAULT_CITY_CELLS_PER_CITY,
    DEFAULT_MINIMUM_CITY_COUNT,
    DEFAULT_MAXIMUM_CITY_COUNT,
    DEFAULT_MINIMUM_CITY_SPACING_KM,
    CITY_BANDS,
    EXPOSURE_BANDS,
    ISOLATION_BANDS,
    CORRIDOR_CLASSES,
    FOUNDING_ADVANTAGES,
    citySuitabilityPermille,
    wildernessExposurePermille,
    leastCostLandPath,
    createHumanGeography,
    validateHumanGeography,
    attachHumanGeography,
    cellHumanGeographySnapshot,
    auditHumanGeography,
    clone
  });
});
