(function initClimateHydrologyBiomes(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const planetaryRelief = typeof module === "object" && module.exports
    ? require("./planetary-relief")
    : root?.HelixPlanetaryRelief;
  const api = factory(strategicWorld, planetaryRelief);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixClimateHydrologyBiomes = api;
})(typeof window !== "undefined" ? window : globalThis, function createClimateHydrologyBiomesApi(StrategicWorld, PlanetaryRelief) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before climate-hydrology-biomes.js");
  if (!PlanetaryRelief) throw new Error("HelixPlanetaryRelief must load before climate-hydrology-biomes.js");

  const CLIMATE_VERSION = 1;
  const HYDROLOGY_VERSION = 1;
  const BIOME_VERSION = 1;
  const AXIAL_TILT_MINIMUM_DEG = 18;
  const AXIAL_TILT_MAXIMUM_DEG = 28;
  const RIVER_CLASS_LEGEND = Object.freeze({ ".": "none", r: "river", R: "majorRiver", G: "greatRiver" });
  const WETLAND_CLASS_LEGEND = Object.freeze({ ".": "none", m: "marsh", f: "floodplain", d: "delta", l: "lakeshore" });
  const OCEAN_CURRENT_LEGEND = Object.freeze({ ".": "land", N: "neutral", W: "warm", C: "cold", U: "upwelling" });
  const BIOME_CLASS_LEGEND = Object.freeze({
    I: "iceCap",
    T: "tundra",
    B: "borealForest",
    F: "temperateForest",
    G: "temperateGrassland",
    S: "shrubland",
    D: "desert",
    Y: "tropicalSeasonalForest",
    R: "tropicalRainforest",
    A: "alpine",
    W: "wetland",
    p: "polarOcean",
    c: "coldOcean",
    t: "temperateOcean",
    w: "tropicalOcean",
    u: "upwellingOcean",
    h: "reefShelf",
    o: "openOcean",
    d: "deepOcean"
  });
  const BIOME_MODIFIERS = Object.freeze({
    alpine: 1,
    wetland: 2,
    floodplain: 4,
    seasonal: 8,
    coastal: 16,
    endorheic: 32
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function scale(vector, amount) {
    return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
  }

  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function tangentToward(position, target) {
    return normalize([
      target[0] - position[0] * dot(target, position),
      target[1] - position[1] * dot(target, position),
      target[2] - position[2] * dot(target, position)
    ]);
  }

  function geographicVectors(position) {
    const east = normalize([-position[2], 0, position[0]]);
    const north = normalize([-position[0] * position[1], 1 - position[1] * position[1], -position[2] * position[1]]);
    return { east, north };
  }

  function windVector(position, bearingDeg) {
    const { east, north } = geographicVectors(position);
    const radians = bearingDeg * Math.PI / 180;
    return normalize(add(scale(north, Math.cos(radians)), scale(east, Math.sin(radians))));
  }

  function latitudeDeg(position) {
    return Math.asin(clamp(position[1], -1, 1)) * 180 / Math.PI;
  }

  function longitudeDeg(position) {
    return Math.atan2(position[2], position[0]) * 180 / Math.PI;
  }

  function distanceToOcean(topology, surfaceClasses) {
    const distances = new Array(topology.cellCount).fill(-1);
    const queue = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (surfaceClasses[index] !== "W") continue;
      distances[index] = 0;
      queue.push(index);
    }
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (distances[neighbor] >= 0) continue;
        distances[neighbor] = distances[current] + 1;
        queue.push(neighbor);
      }
    }
    return distances;
  }

  function seededCellNoise(seed, index, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}:${index}`), 16) / 0xffffffff;
  }

  function currentClasses(seed, map, topology) {
    const phase = seededCellNoise(seed, 0, "ocean-current-phase") * Math.PI * 2;
    return topology.vertices.map((position, index) => {
      if (map.surface.classes[index] === "L") return ".";
      const latitude = latitudeDeg(position);
      const longitude = longitudeDeg(position) * Math.PI / 180;
      const shelf = map.relief.reliefClasses[index] === "S";
      const oscillation = Math.sin(longitude * 2 + phase) * Math.cos(latitude * Math.PI / 180);
      if (shelf && Math.abs(latitude) >= 12 && Math.abs(latitude) <= 52 && oscillation < -0.45) return "U";
      if (oscillation > 0.28 && Math.abs(latitude) < 62) return "W";
      if (oscillation < -0.28 || Math.abs(latitude) > 68) return "C";
      return "N";
    }).join("");
  }

  function prevailingWinds(seed, topology) {
    const bearingDeg = new Array(topology.cellCount);
    const strengthPermille = new Array(topology.cellCount);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const position = topology.vertices[index];
      const latitude = latitudeDeg(position);
      const absoluteLatitude = Math.abs(latitude);
      const longitude = longitudeDeg(position) * Math.PI / 180;
      const baseBearing = absoluteLatitude < 30 ? 270 : (absoluteLatitude < 60 ? 90 : 270);
      const hemisphereBend = latitude >= 0 ? -12 : 12;
      const wave = Math.sin(longitude * 3 + seededCellNoise(seed, index % 17, "wind-phase") * Math.PI) * 14;
      bearingDeg[index] = Math.round((baseBearing + hemisphereBend + wave + 360) % 360);
      strengthPermille[index] = Math.round(clamp(430 + absoluteLatitude * 5 + Math.abs(Math.sin(longitude * 2)) * 170, 300, 1000));
    }
    return { bearingDeg, strengthPermille };
  }

  function upwindTrace(index, map, topology, windBearingDeg, maximumSteps = 18) {
    let current = index;
    let previous = -1;
    let oceanSteps = -1;
    let maximumUpwindElevationM = map.relief.elevationM[index];
    let immediateUpwindElevationM = map.relief.elevationM[index];
    const seen = new Set([index]);
    for (let step = 1; step <= maximumSteps; step += 1) {
      const position = topology.vertices[current];
      const desired = scale(windVector(position, windBearingDeg[current]), -1);
      let bestNeighbor = -1;
      let bestScore = -Infinity;
      for (const neighbor of topology.neighbors[current]) {
        if (neighbor === previous || seen.has(neighbor)) continue;
        const score = dot(tangentToward(position, topology.vertices[neighbor]), desired);
        if (score > bestScore || (score === bestScore && neighbor < bestNeighbor)) {
          bestScore = score;
          bestNeighbor = neighbor;
        }
      }
      if (bestNeighbor < 0) break;
      previous = current;
      current = bestNeighbor;
      seen.add(current);
      if (step === 1) immediateUpwindElevationM = map.relief.elevationM[current];
      maximumUpwindElevationM = Math.max(maximumUpwindElevationM, map.relief.elevationM[current]);
      if (map.surface.classes[current] === "W") {
        oceanSteps = step;
        break;
      }
    }
    return { oceanSteps, maximumUpwindElevationM, immediateUpwindElevationM };
  }

  function climateCore(climate) {
    return {
      version: climate.version,
      settings: climate.settings,
      sourceReliefDigest: climate.sourceReliefDigest,
      temperatureTenthsC: climate.temperatureTenthsC,
      seasonalRangeTenthsC: climate.seasonalRangeTenthsC,
      precipitationMm: climate.precipitationMm,
      aridityIndexPermille: climate.aridityIndexPermille,
      snowIcePermille: climate.snowIcePermille,
      windBearingDeg: climate.windBearingDeg,
      windStrengthPermille: climate.windStrengthPermille,
      oceanCurrentClasses: climate.oceanCurrentClasses,
      diagnostics: climate.diagnostics
    };
  }

  function createClimate(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for climate generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    PlanetaryRelief.validateRelief(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const minimumTilt = clamp(Number(options.axialTiltMinimumDeg) || AXIAL_TILT_MINIMUM_DEG, 0, 45);
    const maximumTilt = clamp(Number(options.axialTiltMaximumDeg) || AXIAL_TILT_MAXIMUM_DEG, minimumTilt, 45);
    const rng = StrategicWorld.seededNumbers(`${seed}:climate:v${CLIMATE_VERSION}`);
    const axialTiltDeg = Number((minimumTilt + rng() * (maximumTilt - minimumTilt)).toFixed(2));
    const oceanDistance = distanceToOcean(topology, strategicMap.surface.classes);
    const oceanCurrentClasses = currentClasses(seed, strategicMap, topology);
    const winds = prevailingWinds(seed, topology);
    const temperatureTenthsC = new Array(topology.cellCount);
    const seasonalRangeTenthsC = new Array(topology.cellCount);

    for (let index = 0; index < topology.cellCount; index += 1) {
      const position = topology.vertices[index];
      const latitude = Math.abs(latitudeDeg(position));
      const land = strategicMap.surface.classes[index] === "L";
      const elevationM = land ? strategicMap.relief.elevationM[index] : 0;
      const currentAnomaly = { W: 3.2, C: -3.2, U: -2.4, N: 0, ".": 0 }[oceanCurrentClasses[index]];
      const continentality = land ? clamp(oceanDistance[index] / 12, 0, 1) : 0;
      const noise = (seededCellNoise(seed, index, "temperature") - 0.5) * 2.4;
      const temperatureC = 29 - latitude * 0.55 - elevationM * 0.0062 + currentAnomaly * (land ? 0.3 : 1) + noise;
      const seasonalRangeC = 3 + latitude / 90 * axialTiltDeg * 0.72 + continentality * 13;
      temperatureTenthsC[index] = Math.round(clamp(temperatureC, -55, 42) * 10);
      seasonalRangeTenthsC[index] = Math.round(clamp(seasonalRangeC, 2, 42) * 10);
    }

    const precipitationMm = new Array(topology.cellCount);
    const aridityIndexPermille = new Array(topology.cellCount);
    const snowIcePermille = new Array(topology.cellCount);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const latitude = Math.abs(latitudeDeg(topology.vertices[index]));
      const land = strategicMap.surface.classes[index] === "L";
      const temperatureC = temperatureTenthsC[index] / 10;
      const equatorialRain = 1450 * Math.exp(-Math.pow(latitude / 18, 2));
      const midlatitudeRain = 720 * Math.exp(-Math.pow((latitude - 48) / 20, 2));
      const polarRain = 90 + Math.max(0, 250 - latitude * 2.2);
      const subtropicalDrying = 520 * Math.exp(-Math.pow((latitude - 27) / 9, 2));
      let precipitation = 420 + equatorialRain + midlatitudeRain + polarRain - subtropicalDrying;
      if (land) {
        const trace = upwindTrace(index, strategicMap, topology, winds.bearingDeg);
        const moistureFactor = trace.oceanSteps >= 0 ? clamp(1.16 - trace.oceanSteps * 0.055, 0.34, 1.1) : 0.3;
        const elevationM = strategicMap.relief.elevationM[index];
        const shadowHeightM = Math.max(0, trace.maximumUpwindElevationM - elevationM);
        const upliftM = Math.max(0, elevationM - trace.immediateUpwindElevationM);
        precipitation *= moistureFactor * Math.exp(-shadowHeightM / 1800) * (1 + Math.min(0.75, upliftM / 1800));
      } else if (oceanCurrentClasses[index] === "U") {
        precipitation *= 0.82;
      }
      precipitation *= 0.82 + seededCellNoise(seed, index, "precipitation") * 0.36;
      const annualMm = Math.round(clamp(precipitation, 25, 4200));
      const potentialEvaporation = 260 + Math.max(0, temperatureC) * 52 + seasonalRangeTenthsC[index] * 0.55;
      precipitationMm[index] = annualMm;
      aridityIndexPermille[index] = Math.round(clamp(annualMm / potentialEvaporation * 1000, 0, 3500));
      const coldness = clamp((-temperatureC + seasonalRangeTenthsC[index] / 28 + 5) / 22, 0, 1);
      snowIcePermille[index] = Math.round(clamp(coldness * (0.55 + Math.min(0.45, annualMm / 2200)) * 1000, 0, 1000));
    }

    const climate = {
      version: CLIMATE_VERSION,
      settings: { axialTiltDeg, axialTiltMinimumDeg: minimumTilt, axialTiltMaximumDeg: maximumTilt },
      sourceReliefDigest: strategicMap.relief.digest,
      temperatureTenthsC,
      seasonalRangeTenthsC,
      precipitationMm,
      aridityIndexPermille,
      snowIcePermille,
      windBearingDeg: winds.bearingDeg,
      windStrengthPermille: winds.strengthPermille,
      oceanCurrentClasses,
      diagnostics: {
        minimumTemperatureTenthsC: Math.min(...temperatureTenthsC),
        maximumTemperatureTenthsC: Math.max(...temperatureTenthsC),
        minimumPrecipitationMm: Math.min(...precipitationMm),
        maximumPrecipitationMm: Math.max(...precipitationMm),
        meanPrecipitationMm: Math.round(precipitationMm.reduce((total, value) => total + value, 0) / topology.cellCount)
      }
    };
    climate.digest = `climate-${StrategicWorld.stableHash(climateCore(climate))}`;
    return climate;
  }

  function validateCellArray(candidate, field, cellCount) {
    if (!Array.isArray(candidate[field]) || candidate[field].length !== cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)))) {
      throw new Error(`Climate ${field} is incomplete.`);
    }
  }

  function validateClimate(map, candidate = map?.climate) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== CLIMATE_VERSION) throw new Error("Climate record is invalid.");
    for (const field of ["temperatureTenthsC", "seasonalRangeTenthsC", "precipitationMm", "aridityIndexPermille", "snowIcePermille", "windBearingDeg", "windStrengthPermille"]) {
      validateCellArray(candidate, field, topology.cellCount);
    }
    if (String(candidate.oceanCurrentClasses || "").length !== topology.cellCount || [...candidate.oceanCurrentClasses].some((code) => !OCEAN_CURRENT_LEGEND[code])) {
      throw new Error("Ocean-current classification is invalid.");
    }
    if (candidate.sourceReliefDigest !== map.relief?.digest) throw new Error("Climate does not match its source relief.");
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] === "L" && candidate.oceanCurrentClasses[index] !== ".") throw new Error("Land cannot have an ocean-current class.");
      if (map.surface.classes[index] === "W" && candidate.oceanCurrentClasses[index] === ".") throw new Error("Ocean cells require an ocean-current class.");
      if (candidate.windBearingDeg[index] < 0 || candidate.windBearingDeg[index] >= 360) throw new Error("Climate wind bearing is invalid.");
      if (candidate.seasonalRangeTenthsC[index] < 0 || candidate.precipitationMm[index] < 0 || candidate.aridityIndexPermille[index] < 0) throw new Error("Climate normal values cannot be negative.");
      if (candidate.snowIcePermille[index] < 0 || candidate.snowIcePermille[index] > 1000 || candidate.windStrengthPermille[index] < 0 || candidate.windStrengthPermille[index] > 1000) {
        throw new Error("Climate tendency values are outside their valid range.");
      }
    }
    const expectedDigest = `climate-${StrategicWorld.stableHash(climateCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Climate data does not match its digest.");
    return clone(candidate);
  }

  class MinHeap {
    constructor() { this.values = []; }
    push(entry) {
      this.values.push(entry);
      let index = this.values.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.compare(this.values[parent], entry) <= 0) break;
        this.values[index] = this.values[parent];
        index = parent;
      }
      this.values[index] = entry;
    }
    pop() {
      if (!this.values.length) return null;
      const first = this.values[0];
      const last = this.values.pop();
      if (this.values.length && last) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= this.values.length) break;
          let child = left;
          if (right < this.values.length && this.compare(this.values[right], this.values[left]) < 0) child = right;
          if (this.compare(last, this.values[child]) <= 0) break;
          this.values[index] = this.values[child];
          index = child;
        }
        this.values[index] = last;
      }
      return first;
    }
    compare(a, b) { return a[0] - b[0] || a[1] - b[1]; }
    get length() { return this.values.length; }
  }

  function conditionedDrainage(map, topology) {
    const cellCount = topology.cellCount;
    const visited = new Array(cellCount).fill(false);
    const flowSurfaceM = [...map.relief.elevationM];
    const downstreamByCell = new Array(cellCount).fill(-1);
    const heap = new MinHeap();
    for (let index = 0; index < cellCount; index += 1) {
      if (map.surface.classes[index] !== "L") continue;
      const oceanNeighbors = topology.neighbors[index].filter((neighbor) => map.surface.classes[neighbor] === "W");
      if (!oceanNeighbors.length) continue;
      downstreamByCell[index] = oceanNeighbors.sort((a, b) => map.relief.elevationM[b] - map.relief.elevationM[a] || a - b)[0];
      visited[index] = true;
      heap.push([flowSurfaceM[index], index]);
    }
    while (heap.length) {
      const [, current] = heap.pop();
      for (const neighbor of topology.neighbors[current]) {
        if (visited[neighbor] || map.surface.classes[neighbor] !== "L") continue;
        visited[neighbor] = true;
        flowSurfaceM[neighbor] = Math.max(map.relief.elevationM[neighbor], flowSurfaceM[current] + 1);
        downstreamByCell[neighbor] = current;
        heap.push([flowSurfaceM[neighbor], neighbor]);
      }
    }
    if (visited.some((value, index) => map.surface.classes[index] === "L" && !value)) throw new Error("Every land cell must join the conditioned drainage graph.");
    return { flowSurfaceM, downstreamByCell };
  }

  function lakeComponents(map, topology, flowSurfaceM) {
    const candidate = flowSurfaceM.map((height, index) => map.surface.classes[index] === "L" && height - map.relief.elevationM[index] >= 120);
    const seen = new Set();
    const components = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (!candidate[index] || seen.has(index)) continue;
      const cells = [];
      const queue = [index];
      seen.add(index);
      let cursor = 0;
      while (cursor < queue.length) {
        const current = queue[cursor++];
        cells.push(current);
        for (const neighbor of topology.neighbors[current]) {
          if (!candidate[neighbor] || seen.has(neighbor)) continue;
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
      components.push(cells.sort((a, b) => a - b));
    }
    return components;
  }

  function redirectEndorheicLake(topology, cells, sink, downstreamByCell) {
    const membership = new Set(cells);
    const queue = [sink];
    const seen = new Set([sink]);
    downstreamByCell[sink] = -1;
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (!membership.has(neighbor) || seen.has(neighbor)) continue;
        seen.add(neighbor);
        downstreamByCell[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }

  function accumulateDrainage(map, topology, downstreamByCell) {
    const indegree = new Array(topology.cellCount).fill(0);
    const drainageCellCount = new Array(topology.cellCount).fill(0);
    const runoffAccumulation = new Array(topology.cellCount).fill(0);
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] !== "L") continue;
      drainageCellCount[index] = 1;
      runoffAccumulation[index] = Math.max(1, Math.round(map.climate.precipitationMm[index] * (0.32 + Math.min(0.5, map.climate.aridityIndexPermille[index] / 4000))));
      const downstream = downstreamByCell[index];
      if (downstream >= 0 && map.surface.classes[downstream] === "L") indegree[downstream] += 1;
    }
    const queue = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] === "L" && indegree[index] === 0) queue.push(index);
    }
    let cursor = 0;
    let processed = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      processed += 1;
      const downstream = downstreamByCell[current];
      if (downstream < 0 || map.surface.classes[downstream] !== "L") continue;
      drainageCellCount[downstream] += drainageCellCount[current];
      runoffAccumulation[downstream] += runoffAccumulation[current];
      indegree[downstream] -= 1;
      if (indegree[downstream] === 0) queue.push(downstream);
    }
    const landCount = [...map.surface.classes].filter((code) => code === "L").length;
    if (processed !== landCount) throw new Error("Conditioned drainage contains a cycle.");
    return { drainageCellCount, runoffAccumulation };
  }

  function watershedRecords(map, topology, downstreamByCell, runoffAccumulation) {
    const terminalByCell = new Array(topology.cellCount).fill(-1);
    function resolve(start) {
      if (terminalByCell[start] >= 0) return terminalByCell[start];
      const path = [];
      const positions = new Map();
      let current = start;
      let terminal = -1;
      while (true) {
        if (terminalByCell[current] >= 0) {
          terminal = terminalByCell[current];
          break;
        }
        if (positions.has(current)) throw new Error("Drainage terminal resolution found a cycle.");
        positions.set(current, path.length);
        path.push(current);
        const downstream = downstreamByCell[current];
        if (downstream < 0) {
          terminal = current;
          break;
        }
        if (map.surface.classes[downstream] === "W") {
          terminal = downstream;
          break;
        }
        current = downstream;
      }
      path.forEach((cell) => { terminalByCell[cell] = terminal; });
      return terminal;
    }
    const terminals = new Set();
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] !== "L") continue;
      terminals.add(resolve(index));
    }
    const sortedTerminals = [...terminals].sort((a, b) => a - b);
    const watershedIndexByTerminal = new Map(sortedTerminals.map((cell, index) => [cell, index]));
    const watershedByCell = terminalByCell.map((terminal, index) => map.surface.classes[index] === "L" ? watershedIndexByTerminal.get(terminal) : -1);
    const watersheds = sortedTerminals.map((terminalCellIndex, index) => {
      const cells = watershedByCell.reduce((values, watershedIndex, cellIndex) => {
        if (watershedIndex === index) values.push(cellIndex);
        return values;
      }, []);
      const endorheic = map.surface.classes[terminalCellIndex] === "L";
      return {
        id: `watershed:${String(index + 1).padStart(4, "0")}`,
        index,
        terminalType: endorheic ? "endorheicBasin" : "oceanMouth",
        terminalCellId: StrategicWorld.cellId(terminalCellIndex),
        cellCount: cells.length,
        terminalRunoffUnits: endorheic ? runoffAccumulation[terminalCellIndex] : Math.max(...cells.map((cell) => runoffAccumulation[cell]))
      };
    });
    return { watershedByCell, watersheds };
  }

  function hydrologyCore(hydrology) {
    return {
      version: hydrology.version,
      settings: hydrology.settings,
      sourceReliefDigest: hydrology.sourceReliefDigest,
      sourceClimateDigest: hydrology.sourceClimateDigest,
      flowSurfaceM: hydrology.flowSurfaceM,
      downstreamByCell: hydrology.downstreamByCell,
      drainageCellCount: hydrology.drainageCellCount,
      runoffAccumulation: hydrology.runoffAccumulation,
      watershedByCell: hydrology.watershedByCell,
      lakeByCell: hydrology.lakeByCell,
      riverClasses: hydrology.riverClasses,
      wetlandClasses: hydrology.wetlandClasses,
      watersheds: hydrology.watersheds,
      lakes: hydrology.lakes,
      diagnostics: hydrology.diagnostics
    };
  }

  function createHydrology(map, options = {}) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    PlanetaryRelief.validateRelief(strategicMap);
    validateClimate(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const drainage = conditionedDrainage(strategicMap, topology);
    const lakeByCell = new Array(topology.cellCount).fill(-1);
    const lakes = lakeComponents(strategicMap, topology, drainage.flowSurfaceM).map((cells, index) => {
      const sinkCellIndex = cells.reduce((best, cell) => strategicMap.relief.elevationM[cell] < strategicMap.relief.elevationM[best] ? cell : best, cells[0]);
      const maximumFillDepthM = Math.max(...cells.map((cell) => drainage.flowSurfaceM[cell] - strategicMap.relief.elevationM[cell]));
      const meanAridity = cells.reduce((total, cell) => total + strategicMap.climate.aridityIndexPermille[cell], 0) / cells.length;
      const endorheic = meanAridity < (Number(options.endorheicAridityThresholdPermille) || 720) && maximumFillDepthM >= 260;
      cells.forEach((cell) => { lakeByCell[cell] = index; });
      if (endorheic) redirectEndorheicLake(topology, cells, sinkCellIndex, drainage.downstreamByCell);
      return {
        id: `major-lake:${String(index + 1).padStart(4, "0")}`,
        index,
        anchorCellId: StrategicWorld.cellId(cells[0]),
        sinkCellId: StrategicWorld.cellId(sinkCellIndex),
        cellCount: cells.length,
        maximumFillDepthM,
        surfaceElevationM: Math.max(...cells.map((cell) => drainage.flowSurfaceM[cell])),
        kind: endorheic ? "endorheicSaltLake" : "drainingFreshwaterLake",
        endorheic
      };
    });
    const accumulation = accumulateDrainage(strategicMap, topology, drainage.downstreamByCell);
    const riverClasses = accumulation.drainageCellCount.map((count, index) => {
      if (strategicMap.surface.classes[index] !== "L") return ".";
      if (count >= 80 && accumulation.runoffAccumulation[index] >= 50000) return "G";
      if (count >= 20 && accumulation.runoffAccumulation[index] >= 12000) return "R";
      if (count >= 5 && accumulation.runoffAccumulation[index] >= 2500) return "r";
      return ".";
    }).join("");
    const wetlandClasses = accumulation.drainageCellCount.map((count, index) => {
      if (strategicMap.surface.classes[index] !== "L") return ".";
      const downstream = drainage.downstreamByCell[index];
      if (riverClasses[index] !== "." && downstream >= 0 && strategicMap.surface.classes[downstream] === "W" && strategicMap.relief.elevationM[index] < 500) return "d";
      if (lakeByCell[index] >= 0 || topology.neighbors[index].some((neighbor) => lakeByCell[neighbor] >= 0)) return "l";
      if (riverClasses[index] !== "." && strategicMap.relief.slopePermille[index] < 16) return "f";
      if (strategicMap.climate.aridityIndexPermille[index] > 1450 && strategicMap.relief.elevationM[index] < 500 && count >= 2) return "m";
      return ".";
    }).join("");
    const watershedData = watershedRecords(strategicMap, topology, drainage.downstreamByCell, accumulation.runoffAccumulation);
    const lakeRecords = lakes.map((lake) => {
      const sinkIndex = StrategicWorld.cellIndex(lake.sinkCellId);
      return { ...lake, inflowUnits: accumulation.runoffAccumulation[sinkIndex] };
    });
    const hydrology = {
      version: HYDROLOGY_VERSION,
      settings: {
        lakeMinimumFillDepthM: 120,
        endorheicAridityThresholdPermille: Number(options.endorheicAridityThresholdPermille) || 720
      },
      sourceReliefDigest: strategicMap.relief.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      flowSurfaceM: drainage.flowSurfaceM,
      downstreamByCell: drainage.downstreamByCell,
      drainageCellCount: accumulation.drainageCellCount,
      runoffAccumulation: accumulation.runoffAccumulation,
      watershedByCell: watershedData.watershedByCell,
      lakeByCell,
      riverClasses,
      wetlandClasses,
      watersheds: watershedData.watersheds,
      lakes: lakeRecords,
      diagnostics: {
        watershedCount: watershedData.watersheds.length,
        lakeCount: lakeRecords.length,
        endorheicLakeCount: lakeRecords.filter((lake) => lake.endorheic).length,
        riverCellCount: [...riverClasses].filter((code) => code !== ".").length,
        majorRiverCellCount: [...riverClasses].filter((code) => code === "R" || code === "G").length,
        wetlandCellCount: [...wetlandClasses].filter((code) => code !== ".").length
      }
    };
    hydrology.digest = `hydrology-${StrategicWorld.stableHash(hydrologyCore(hydrology))}`;
    return hydrology;
  }

  function validateHydrology(map, candidate = map?.hydrology) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== HYDROLOGY_VERSION) throw new Error("Hydrology record is invalid.");
    for (const field of ["flowSurfaceM", "downstreamByCell", "drainageCellCount", "runoffAccumulation", "watershedByCell", "lakeByCell"]) {
      if (!Array.isArray(candidate[field]) || candidate[field].length !== topology.cellCount || candidate[field].some((value) => !Number.isFinite(Number(value)))) {
        throw new Error(`Hydrology ${field} is incomplete.`);
      }
    }
    if (String(candidate.riverClasses || "").length !== topology.cellCount || [...candidate.riverClasses].some((code) => !RIVER_CLASS_LEGEND[code])) throw new Error("River classification is invalid.");
    if (String(candidate.wetlandClasses || "").length !== topology.cellCount || [...candidate.wetlandClasses].some((code) => !WETLAND_CLASS_LEGEND[code])) throw new Error("Wetland classification is invalid.");
    if (!Array.isArray(candidate.watersheds) || !Array.isArray(candidate.lakes)) throw new Error("Hydrology feature records are incomplete.");
    if (candidate.watersheds.some((watershed, index) => watershed.index !== index || watershed.id !== `watershed:${String(index + 1).padStart(4, "0")}`)) throw new Error("Watershed identities are invalid.");
    if (candidate.lakes.some((lake, index) => lake.index !== index || lake.id !== `major-lake:${String(index + 1).padStart(4, "0")}`)) throw new Error("Lake identities are invalid.");
    if (candidate.sourceReliefDigest !== map.relief?.digest || candidate.sourceClimateDigest !== map.climate?.digest) throw new Error("Hydrology does not match its source geography.");
    const indegree = new Array(topology.cellCount).fill(0);
    let landCount = 0;
    for (let index = 0; index < topology.cellCount; index += 1) {
      const downstream = candidate.downstreamByCell[index];
      if (!Number.isInteger(downstream) || downstream < -1 || downstream >= topology.cellCount) throw new Error("Hydrology downstream index is invalid.");
      if (!Number.isInteger(candidate.watershedByCell[index]) || !Number.isInteger(candidate.lakeByCell[index])) throw new Error("Hydrology feature membership must use integer indices.");
      if (map.surface.classes[index] === "W") {
        if (downstream !== -1 || candidate.watershedByCell[index] !== -1 || candidate.lakeByCell[index] !== -1 || candidate.riverClasses[index] !== "." || candidate.wetlandClasses[index] !== ".") {
          throw new Error("Ocean cells cannot have land drainage records.");
        }
        continue;
      }
      landCount += 1;
      if (downstream >= 0 && !topology.neighbors[index].includes(downstream)) throw new Error("Hydrology downstream cells must be adjacent.");
      if (candidate.watershedByCell[index] < 0 || !candidate.watersheds[candidate.watershedByCell[index]]) throw new Error("Land watershed membership is invalid.");
      if (candidate.lakeByCell[index] < -1 || candidate.lakeByCell[index] >= candidate.lakes.length) throw new Error("Lake membership is invalid.");
      if (downstream < 0) {
        const lake = candidate.lakes[candidate.lakeByCell[index]];
        if (!lake?.endorheic || lake.sinkCellId !== StrategicWorld.cellId(index)) throw new Error("Only a saved endorheic lake sink may terminate on land.");
      } else if (map.surface.classes[downstream] === "L") {
        indegree[downstream] += 1;
      }
    }
    const queue = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] === "L" && indegree[index] === 0) queue.push(index);
    }
    let cursor = 0;
    let processed = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      processed += 1;
      const downstream = candidate.downstreamByCell[current];
      if (downstream < 0 || map.surface.classes[downstream] === "W") continue;
      indegree[downstream] -= 1;
      if (indegree[downstream] === 0) queue.push(downstream);
    }
    if (processed !== landCount) throw new Error("Hydrology drainage graph contains a cycle.");
    const expectedDigest = `hydrology-${StrategicWorld.stableHash(hydrologyCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Hydrology data does not match its digest.");
    return clone(candidate);
  }

  function biomeCore(biomes) {
    return {
      version: biomes.version,
      sourceReliefDigest: biomes.sourceReliefDigest,
      sourceClimateDigest: biomes.sourceClimateDigest,
      sourceHydrologyDigest: biomes.sourceHydrologyDigest,
      classes: biomes.classes,
      modifiers: biomes.modifiers,
      diagnostics: biomes.diagnostics
    };
  }

  function createBiomes(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    PlanetaryRelief.validateRelief(strategicMap);
    validateClimate(strategicMap);
    validateHydrology(strategicMap);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const classes = new Array(topology.cellCount);
    const modifiers = new Array(topology.cellCount).fill(0);
    for (let index = 0; index < topology.cellCount; index += 1) {
      const land = strategicMap.surface.classes[index] === "L";
      const temperatureC = strategicMap.climate.temperatureTenthsC[index] / 10;
      const precipitation = strategicMap.climate.precipitationMm[index];
      const aridity = strategicMap.climate.aridityIndexPermille[index];
      const seasonalRangeC = strategicMap.climate.seasonalRangeTenthsC[index] / 10;
      if (!land) {
        const current = strategicMap.climate.oceanCurrentClasses[index];
        const relief = strategicMap.relief.reliefClasses[index];
        if (strategicMap.climate.snowIcePermille[index] > 700 || temperatureC < -3) classes[index] = "p";
        else if (current === "U") classes[index] = "u";
        else if (relief === "S" && temperatureC > 21) classes[index] = "h";
        else if (relief === "T" || relief === "A") classes[index] = temperatureC > 18 ? "o" : "d";
        else if (temperatureC < 7) classes[index] = "c";
        else if (temperatureC < 20) classes[index] = "t";
        else classes[index] = "w";
        continue;
      }
      const coastal = strategicMap.relief.coastClasses[index] !== ".";
      const alpine = strategicMap.relief.elevationM[index] > 3200;
      const wetland = strategicMap.hydrology.wetlandClasses[index] !== ".";
      if (alpine) modifiers[index] |= BIOME_MODIFIERS.alpine;
      if (wetland) modifiers[index] |= BIOME_MODIFIERS.wetland;
      if (strategicMap.hydrology.wetlandClasses[index] === "f" || strategicMap.hydrology.wetlandClasses[index] === "d") modifiers[index] |= BIOME_MODIFIERS.floodplain;
      if (seasonalRangeC > 20) modifiers[index] |= BIOME_MODIFIERS.seasonal;
      if (coastal) modifiers[index] |= BIOME_MODIFIERS.coastal;
      const lake = strategicMap.hydrology.lakes[strategicMap.hydrology.lakeByCell[index]];
      if (lake?.endorheic) modifiers[index] |= BIOME_MODIFIERS.endorheic;
      if (strategicMap.climate.snowIcePermille[index] > 780 || temperatureC < -12) classes[index] = "I";
      else if (alpine) classes[index] = "A";
      else if (wetland && temperatureC > -2) classes[index] = "W";
      else if (temperatureC < 2) classes[index] = "T";
      else if (temperatureC < 8 && precipitation > 420) classes[index] = "B";
      else if (aridity < 360) classes[index] = "D";
      else if (aridity < 650) classes[index] = "S";
      else if (temperatureC > 22 && precipitation > 1750) classes[index] = "R";
      else if (temperatureC > 18 && precipitation > 820) classes[index] = "Y";
      else if (precipitation > 850) classes[index] = "F";
      else classes[index] = "G";
    }
    const encoded = classes.join("");
    const biomeCounts = Object.fromEntries(Object.keys(BIOME_CLASS_LEGEND).map((code) => [BIOME_CLASS_LEGEND[code], classes.filter((value) => value === code).length]));
    const biomes = {
      version: BIOME_VERSION,
      sourceReliefDigest: strategicMap.relief.digest,
      sourceClimateDigest: strategicMap.climate.digest,
      sourceHydrologyDigest: strategicMap.hydrology.digest,
      classes: encoded,
      modifiers,
      diagnostics: {
        representedBiomeCount: Object.values(biomeCounts).filter((count) => count > 0).length,
        biomeCounts
      }
    };
    biomes.digest = `biomes-${StrategicWorld.stableHash(biomeCore(biomes))}`;
    return biomes;
  }

  function validateBiomes(map, candidate = map?.biomes) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== BIOME_VERSION) throw new Error("Biome record is invalid.");
    if (String(candidate.classes || "").length !== topology.cellCount || [...candidate.classes].some((code) => !BIOME_CLASS_LEGEND[code])) throw new Error("Biome classification is invalid.");
    if (!Array.isArray(candidate.modifiers) || candidate.modifiers.length !== topology.cellCount || candidate.modifiers.some((value) => !Number.isInteger(value) || value < 0 || value >= 64)) throw new Error("Biome modifiers are invalid.");
    if (candidate.sourceReliefDigest !== map.relief?.digest || candidate.sourceClimateDigest !== map.climate?.digest || candidate.sourceHydrologyDigest !== map.hydrology?.digest) {
      throw new Error("Biomes do not match their source geography.");
    }
    const expectedDigest = `biomes-${StrategicWorld.stableHash(biomeCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Biome data does not match its digest.");
    return clone(candidate);
  }

  function attachEnvironment(worldSeed, map, options = {}) {
    let next = StrategicWorld.validateStrategicMap(map);
    next.climate = createClimate(worldSeed, next, options.climate);
    next = StrategicWorld.finalizeStrategicMap(next);
    next.hydrology = createHydrology(next, options.hydrology);
    next = StrategicWorld.finalizeStrategicMap(next);
    next.biomes = createBiomes(next);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function drainageTerminates(map, start) {
    const seen = new Set();
    let current = start;
    while (map.surface.classes[current] === "L") {
      if (seen.has(current)) return false;
      seen.add(current);
      const downstream = map.hydrology.downstreamByCell[current];
      if (downstream < 0) return true;
      current = downstream;
    }
    return true;
  }

  function auditEnvironment(map) {
    validateClimate(map);
    validateHydrology(map);
    validateBiomes(map);
    const topology = StrategicWorld.topologyForMap(map);
    const landCells = [];
    let adjacentDrainage = true;
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (map.surface.classes[index] !== "L") continue;
      landCells.push(index);
      const downstream = map.hydrology.downstreamByCell[index];
      adjacentDrainage &&= downstream < 0 || topology.neighbors[index].includes(downstream);
    }
    const drainageAcyclic = landCells.every((index) => drainageTerminates(map, index));
    const equatorial = topology.vertices.map((position, index) => ({ index, latitude: Math.abs(latitudeDeg(position)) })).filter((entry) => entry.latitude < 15);
    const polar = topology.vertices.map((position, index) => ({ index, latitude: Math.abs(latitudeDeg(position)) })).filter((entry) => entry.latitude > 70);
    const mean = (entries, values) => entries.reduce((total, entry) => total + values[entry.index], 0) / Math.max(1, entries.length);
    const equatorWarmerThanPoles = mean(equatorial, map.climate.temperatureTenthsC) > mean(polar, map.climate.temperatureTenthsC);
    return {
      valid: adjacentDrainage && drainageAcyclic && equatorWarmerThanPoles,
      adjacentDrainage,
      drainageAcyclic,
      equatorWarmerThanPoles,
      watershedCount: map.hydrology.watersheds.length,
      lakeCount: map.hydrology.lakes.length,
      riverCellCount: map.hydrology.diagnostics.riverCellCount,
      representedBiomeCount: map.biomes.diagnostics.representedBiomeCount
    };
  }

  function modifierNames(mask) {
    return Object.entries(BIOME_MODIFIERS).filter(([, bit]) => (mask & bit) !== 0).map(([name]) => name);
  }

  function cellEnvironmentSnapshot(map, index) {
    if (!map?.climate || !map?.hydrology || !map?.biomes || !Number.isInteger(index) || index < 0 || index >= map.climate.temperatureTenthsC.length) return null;
    const watershed = map.hydrology.watersheds[map.hydrology.watershedByCell[index]];
    const lake = map.hydrology.lakes[map.hydrology.lakeByCell[index]];
    const downstream = map.hydrology.downstreamByCell[index];
    return {
      temperatureC: map.climate.temperatureTenthsC[index] / 10,
      seasonalRangeC: map.climate.seasonalRangeTenthsC[index] / 10,
      precipitationMm: map.climate.precipitationMm[index],
      aridityIndex: map.climate.aridityIndexPermille[index] / 1000,
      snowIcePercent: map.climate.snowIcePermille[index] / 10,
      windBearingDeg: map.climate.windBearingDeg[index],
      windStrengthPercent: map.climate.windStrengthPermille[index] / 10,
      oceanCurrent: OCEAN_CURRENT_LEGEND[map.climate.oceanCurrentClasses[index]],
      watershedId: watershed?.id || null,
      watershedTerminalType: watershed?.terminalType || null,
      downstreamCellId: downstream >= 0 ? StrategicWorld.cellId(downstream) : null,
      drainageCellCount: map.hydrology.drainageCellCount[index],
      runoffAccumulation: map.hydrology.runoffAccumulation[index],
      riverClass: RIVER_CLASS_LEGEND[map.hydrology.riverClasses[index]],
      wetlandClass: WETLAND_CLASS_LEGEND[map.hydrology.wetlandClasses[index]],
      lakeId: lake?.id || null,
      lakeKind: lake?.kind || null,
      biomeClass: BIOME_CLASS_LEGEND[map.biomes.classes[index]],
      biomeModifiers: modifierNames(map.biomes.modifiers[index])
    };
  }

  function validateEnvironment(map) {
    return {
      climate: validateClimate(map),
      hydrology: validateHydrology(map),
      biomes: validateBiomes(map)
    };
  }

  return Object.freeze({
    CLIMATE_VERSION,
    HYDROLOGY_VERSION,
    BIOME_VERSION,
    AXIAL_TILT_MINIMUM_DEG,
    AXIAL_TILT_MAXIMUM_DEG,
    RIVER_CLASS_LEGEND,
    WETLAND_CLASS_LEGEND,
    OCEAN_CURRENT_LEGEND,
    BIOME_CLASS_LEGEND,
    BIOME_MODIFIERS,
    createClimate,
    validateClimate,
    createHydrology,
    validateHydrology,
    createBiomes,
    validateBiomes,
    attachEnvironment,
    validateEnvironment,
    auditEnvironment,
    cellEnvironmentSnapshot,
    clone
  });
});
