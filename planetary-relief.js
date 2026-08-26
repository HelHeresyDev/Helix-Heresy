(function initPlanetaryRelief(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const api = factory(strategicWorld);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPlanetaryRelief = api;
})(typeof window !== "undefined" ? window : globalThis, function createPlanetaryReliefApi(StrategicWorld) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before planetary-relief.js");

  const RELIEF_VERSION = 1;
  const DEFAULT_PLATE_COUNT = 28;
  const MAX_LAND_ELEVATION_M = 8500;
  const MAX_OCEAN_DEPTH_M = -9000;
  const RELIEF_CLASS_LEGEND = Object.freeze({
    C: "coastalPlain",
    L: "lowland",
    U: "upland",
    H: "highland",
    M: "mountain",
    P: "highPeak",
    S: "continentalShelf",
    D: "continentalSlope",
    A: "abyssalPlain",
    T: "oceanTrench"
  });
  const COAST_CLASS_LEGEND = Object.freeze({
    ".": "none",
    l: "lowCoast",
    r: "rockyCoast",
    c: "cliffCoast",
    i: "islandCoast",
    s: "shallowShelf"
  });
  const BOUNDARY_KINDS = Object.freeze(["convergent", "divergent", "transform"]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function scale(vector, amount) {
    return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
  }

  function randomUnitVector(rng) {
    const y = rng() * 2 - 1;
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  }

  function plateSeeds(topology, seed, plateCount) {
    const rng = StrategicWorld.seededNumbers(`${seed}:tectonic-plates:v${RELIEF_VERSION}`);
    const seeds = [Math.floor(rng() * topology.cellCount)];
    const nearestDistance = new Float64Array(topology.cellCount);
    nearestDistance.fill(Infinity);
    while (seeds.length < plateCount) {
      const latest = topology.vertices[seeds.at(-1)];
      let nextIndex = 0;
      let nextScore = -Infinity;
      for (let index = 0; index < topology.cellCount; index += 1) {
        nearestDistance[index] = Math.min(nearestDistance[index], 1 - dot(topology.vertices[index], latest));
        const score = nearestDistance[index] + (parseInt(StrategicWorld.stableHash(`${seed}:plate-seed:${seeds.length}:${index}`), 16) / 0xffffffff) * 0.0005;
        if (score > nextScore) {
          nextScore = score;
          nextIndex = index;
        }
      }
      seeds.push(nextIndex);
    }
    return seeds;
  }

  function assignPlates(topology, seeds) {
    const plateByCell = new Array(topology.cellCount).fill(-1);
    const distanceByCell = new Array(topology.cellCount).fill(-1);
    const queue = [];
    seeds.forEach((seedCell, plateIndex) => {
      plateByCell[seedCell] = plateIndex;
      distanceByCell[seedCell] = 0;
      queue.push(seedCell);
    });
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      const plateIndex = plateByCell[current];
      for (const neighbor of topology.neighbors[current]) {
        if (plateByCell[neighbor] >= 0) continue;
        plateByCell[neighbor] = plateIndex;
        distanceByCell[neighbor] = distanceByCell[current] + 1;
        queue.push(neighbor);
      }
    }
    return { plateByCell, distanceByCell };
  }

  function createPlateRecords(seed, topology, seeds, plateByCell) {
    const rng = StrategicWorld.seededNumbers(`${seed}:plate-motion:v${RELIEF_VERSION}`);
    const cellCounts = new Array(seeds.length).fill(0);
    plateByCell.forEach((plateIndex) => { cellCounts[plateIndex] += 1; });
    return seeds.map((seedCellIndex, index) => {
      const rate = Math.round(5 + rng() * 85) * (rng() < 0.5 ? -1 : 1);
      return {
        id: `tectonic-plate:${String(index + 1).padStart(3, "0")}`,
        index,
        seedCellId: StrategicWorld.cellId(seedCellIndex),
        cellCount: cellCounts[index],
        eulerPole: randomUnitVector(rng).map((value) => Number(value.toFixed(6))),
        rotationRateMmPerYear: rate
      };
    });
  }

  function plateVelocity(plate, position) {
    return scale(cross(plate.eulerPole, position), plate.rotationRateMmPerYear);
  }

  function createBoundaries(topology, plateByCell, plates) {
    const aggregates = new Map();
    for (let left = 0; left < topology.cellCount; left += 1) {
      for (const right of topology.neighbors[left]) {
        if (right <= left || plateByCell[left] === plateByCell[right]) continue;
        let plateAIndex = plateByCell[left];
        let plateBIndex = plateByCell[right];
        let cellA = left;
        let cellB = right;
        if (plateAIndex > plateBIndex) {
          [plateAIndex, plateBIndex] = [plateBIndex, plateAIndex];
          [cellA, cellB] = [cellB, cellA];
        }
        const key = `${plateAIndex}:${plateBIndex}`;
        const aggregate = aggregates.get(key) || {
          plateAIndex,
          plateBIndex,
          edges: [],
          movementSum: 0
        };
        const positionA = topology.vertices[cellA];
        const positionB = topology.vertices[cellB];
        const midpoint = normalize([
          positionA[0] + positionB[0],
          positionA[1] + positionB[1],
          positionA[2] + positionB[2]
        ]);
        const tangentTowardB = normalize(subtract(positionB, scale(midpoint, dot(positionB, midpoint))));
        const velocityA = plateVelocity(plates[plateAIndex], midpoint);
        const velocityB = plateVelocity(plates[plateBIndex], midpoint);
        const separation = dot(subtract(velocityB, velocityA), tangentTowardB);
        aggregate.edges.push([cellA, cellB]);
        aggregate.movementSum += separation;
        aggregates.set(key, aggregate);
      }
    }
    return [...aggregates.values()]
      .sort((a, b) => a.plateAIndex - b.plateAIndex || a.plateBIndex - b.plateBIndex)
      .map((aggregate, index) => {
        const meanMovement = aggregate.movementSum / aggregate.edges.length;
        const kind = meanMovement < -8 ? "convergent" : meanMovement > 8 ? "divergent" : "transform";
        return {
          id: `plate-boundary:${String(index + 1).padStart(3, "0")}`,
          index,
          plateIds: [plates[aggregate.plateAIndex].id, plates[aggregate.plateBIndex].id],
          kind,
          relativeMotionMmPerYear: Math.round(Math.abs(meanMovement)),
          edgeCount: aggregate.edges.length,
          anchorCellId: StrategicWorld.cellId(Math.min(...aggregate.edges[0])),
          edges: aggregate.edges
        };
      });
  }

  function boundaryCellData(topology, boundaries) {
    const boundaryByCell = new Array(topology.cellCount).fill(-1);
    const boundaryStrengthByCell = new Array(topology.cellCount).fill(-1);
    for (const boundary of boundaries) {
      for (const edge of boundary.edges) {
        for (const cell of edge) {
          if (boundary.relativeMotionMmPerYear > boundaryStrengthByCell[cell]) {
            boundaryByCell[cell] = boundary.index;
            boundaryStrengthByCell[cell] = boundary.relativeMotionMmPerYear;
          }
        }
      }
    }
    const boundaryDistanceByCell = new Array(topology.cellCount).fill(-1);
    const nearestBoundaryByCell = [...boundaryByCell];
    const queue = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (boundaryByCell[index] >= 0) {
        boundaryDistanceByCell[index] = 0;
        queue.push(index);
      }
    }
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (boundaryDistanceByCell[neighbor] >= 0) continue;
        boundaryDistanceByCell[neighbor] = boundaryDistanceByCell[current] + 1;
        nearestBoundaryByCell[neighbor] = nearestBoundaryByCell[current];
        queue.push(neighbor);
      }
    }
    return { boundaryByCell, boundaryDistanceByCell, nearestBoundaryByCell };
  }

  function coastDistance(topology, surfaceClasses) {
    const distances = new Array(topology.cellCount).fill(-1);
    const queue = [];
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (topology.neighbors[index].some((neighbor) => surfaceClasses[neighbor] !== surfaceClasses[index])) {
        distances[index] = 0;
        queue.push(index);
      }
    }
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (distances[neighbor] >= 0 || surfaceClasses[neighbor] !== surfaceClasses[current]) continue;
        distances[neighbor] = distances[current] + 1;
        queue.push(neighbor);
      }
    }
    return distances;
  }

  function reliefNoise(seed, topology) {
    const rng = StrategicWorld.seededNumbers(`${seed}:relief-noise:v${RELIEF_VERSION}`);
    const waves = Array.from({ length: 7 }, (_, index) => ({
      axis: randomUnitVector(rng),
      frequency: 2.4 + index * 1.35 + rng(),
      phase: rng() * Math.PI * 2,
      amplitude: 1 / (1 + index * 0.42)
    }));
    const amplitudeTotal = waves.reduce((total, wave) => total + wave.amplitude, 0);
    return topology.vertices.map((position) => (
      waves.reduce((total, wave) => total + Math.sin(dot(position, wave.axis) * wave.frequency + wave.phase) * wave.amplitude, 0) / amplitudeTotal
    ));
  }

  function createElevation(topology, map, boundaries, boundaryData, distancesToCoast, noise) {
    return topology.vertices.map((position, index) => {
      const land = map.surface.classes[index] === "L";
      const coastSteps = Math.max(0, distancesToCoast[index]);
      const boundaryDistance = Math.max(0, boundaryData.boundaryDistanceByCell[index]);
      const boundary = boundaries[boundaryData.nearestBoundaryByCell[index]];
      const influence = Math.max(0, 1 - boundaryDistance / 6);
      let elevation = land
        ? 80 + Math.min(2600, coastSteps * 260) + noise[index] * 620
        : -90 - Math.min(6200, coastSteps * 520) + noise[index] * 850;
      if (boundary?.kind === "convergent") elevation += influence * (land ? 3000 : -2200);
      else if (boundary?.kind === "divergent") elevation += influence * (land ? -850 : 1550);
      else if (boundary?.kind === "transform") elevation += influence * noise[index] * (land ? 700 : 800);
      if (coastSteps === 0) {
        if (land) elevation = clamp(elevation, 20, boundary?.kind === "convergent" ? 2400 : 900);
        else elevation = clamp(elevation, boundary?.kind === "convergent" ? -2600 : -700, -20);
      }
      return Math.round(land
        ? clamp(elevation, 20, MAX_LAND_ELEVATION_M)
        : clamp(elevation, MAX_OCEAN_DEPTH_M, -20));
    });
  }

  function createSlopes(topology, map, elevationM) {
    return elevationM.map((elevation, index) => {
      let steepest = 0;
      for (const neighbor of topology.neighbors[index]) {
        const distanceM = StrategicWorld.greatCircleDistanceKm(map, index, neighbor) * 1000;
        steepest = Math.max(steepest, Math.abs(elevation - elevationM[neighbor]) / distanceM * 1000);
      }
      return Math.round(steepest);
    });
  }

  function classifyRelief(map, elevationM, slopePermille, distancesToCoast) {
    return elevationM.map((elevation, index) => {
      if (map.surface.classes[index] === "L") {
        if (distancesToCoast[index] === 0 && elevation < 450) return "C";
        if (elevation < 600) return "L";
        if (elevation < 1600) return "U";
        if (elevation < 3000) return "H";
        if (elevation < 5000 || slopePermille[index] < 18) return "M";
        return "P";
      }
      if (distancesToCoast[index] === 0 || elevation > -700) return "S";
      if (elevation > -2500) return "D";
      if (elevation > -6000) return "A";
      return "T";
    }).join("");
  }

  function classifyCoasts(topology, map, elevationM, slopePermille) {
    return elevationM.map((elevation, index) => {
      const land = map.surface.classes[index] === "L";
      const touchesOther = topology.neighbors[index].some((neighbor) => map.surface.classes[neighbor] !== map.surface.classes[index]);
      if (!touchesOther) return ".";
      if (!land) return "s";
      const landNeighborCount = topology.neighbors[index].filter((neighbor) => map.surface.classes[neighbor] === "L").length;
      const region = StrategicWorld.cellRegion(map, index);
      if (region?.cellCount < 60 || landNeighborCount <= 2) return "i";
      if (elevation < 320 && slopePermille[index] < 12) return "l";
      if (elevation > 950 || slopePermille[index] >= 24) return "c";
      return "r";
    }).join("");
  }

  function reliefCore(relief) {
    return {
      version: relief.version,
      settings: relief.settings,
      sourceSurfaceDigest: relief.sourceSurfaceDigest,
      plates: relief.plates,
      boundaries: relief.boundaries,
      plateByCell: relief.plateByCell,
      boundaryByCell: relief.boundaryByCell,
      nearestBoundaryByCell: relief.nearestBoundaryByCell,
      boundaryDistanceByCell: relief.boundaryDistanceByCell,
      elevationM: relief.elevationM,
      slopePermille: relief.slopePermille,
      reliefClasses: relief.reliefClasses,
      coastClasses: relief.coastClasses,
      diagnostics: relief.diagnostics
    };
  }

  function createRelief(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for planetary relief generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    const topology = StrategicWorld.topologyForMap(strategicMap);
    const requestedPlateCount = Math.floor(Number(options.plateCount) || DEFAULT_PLATE_COUNT);
    const plateCount = clamp(requestedPlateCount, 8, Math.min(64, topology.cellCount));
    const seeds = plateSeeds(topology, seed, plateCount);
    const { plateByCell } = assignPlates(topology, seeds);
    const plates = createPlateRecords(seed, topology, seeds, plateByCell);
    const rawBoundaries = createBoundaries(topology, plateByCell, plates);
    const boundaryData = boundaryCellData(topology, rawBoundaries);
    const distancesToCoast = coastDistance(topology, strategicMap.surface.classes);
    const noise = reliefNoise(seed, topology);
    const elevationM = createElevation(topology, strategicMap, rawBoundaries, boundaryData, distancesToCoast, noise);
    const slopePermille = createSlopes(topology, strategicMap, elevationM);
    const reliefClasses = classifyRelief(strategicMap, elevationM, slopePermille, distancesToCoast);
    const coastClasses = classifyCoasts(topology, strategicMap, elevationM, slopePermille);
    const boundaries = rawBoundaries.map(({ edges, ...boundary }) => boundary);
    const relief = {
      version: RELIEF_VERSION,
      settings: { plateCount },
      sourceSurfaceDigest: StrategicWorld.stableHash(strategicMap.surface.classes),
      plates,
      boundaries,
      plateByCell,
      boundaryByCell: boundaryData.boundaryByCell,
      nearestBoundaryByCell: boundaryData.nearestBoundaryByCell,
      boundaryDistanceByCell: boundaryData.boundaryDistanceByCell,
      elevationM,
      slopePermille,
      reliefClasses,
      coastClasses,
      diagnostics: {
        minimumElevationM: Math.min(...elevationM),
        maximumElevationM: Math.max(...elevationM),
        coastalCellCount: [...coastClasses].filter((code) => code !== ".").length,
        plateBoundaryCount: boundaries.length,
        boundaryKindCounts: Object.fromEntries(BOUNDARY_KINDS.map((kind) => [kind, boundaries.filter((boundary) => boundary.kind === kind).length]))
      }
    };
    relief.digest = `relief-${StrategicWorld.stableHash(reliefCore(relief))}`;
    return relief;
  }

  function validateRelief(map, candidate = map?.relief) {
    const topology = StrategicWorld.topologyForMap(map);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== RELIEF_VERSION) throw new Error("Planetary relief record is invalid.");
    for (const field of ["plateByCell", "boundaryByCell", "nearestBoundaryByCell", "boundaryDistanceByCell", "elevationM", "slopePermille"]) {
      if (!Array.isArray(candidate[field]) || candidate[field].length !== topology.cellCount) throw new Error(`Planetary relief ${field} is incomplete.`);
    }
    if (String(candidate.reliefClasses || "").length !== topology.cellCount || [...candidate.reliefClasses].some((code) => !RELIEF_CLASS_LEGEND[code])) {
      throw new Error("Planetary relief classification is invalid.");
    }
    if (String(candidate.coastClasses || "").length !== topology.cellCount || [...candidate.coastClasses].some((code) => !COAST_CLASS_LEGEND[code])) {
      throw new Error("Planetary coast classification is invalid.");
    }
    if (!Array.isArray(candidate.plates) || candidate.plates.length !== Number(candidate.settings?.plateCount)) throw new Error("Planetary plate records are incomplete.");
    if (!Array.isArray(candidate.boundaries) || candidate.boundaries.some((boundary) => !BOUNDARY_KINDS.includes(boundary.kind))) throw new Error("Planetary boundary records are invalid.");
    if (candidate.sourceSurfaceDigest !== StrategicWorld.stableHash(map.surface.classes)) throw new Error("Planetary relief does not match its canonical land/ocean surface.");
    for (let index = 0; index < topology.cellCount; index += 1) {
      if (!candidate.plates[candidate.plateByCell[index]]) throw new Error("Planetary plate membership is invalid.");
      if (map.surface.classes[index] === "L" && candidate.elevationM[index] <= 0) throw new Error("Canonical land must remain above sea level.");
      if (map.surface.classes[index] === "W" && candidate.elevationM[index] >= 0) throw new Error("Canonical ocean must remain below sea level.");
      if (candidate.boundaryByCell[index] >= candidate.boundaries.length || candidate.nearestBoundaryByCell[index] >= candidate.boundaries.length) {
        throw new Error("Planetary boundary membership is invalid.");
      }
    }
    const expectedDigest = `relief-${StrategicWorld.stableHash(reliefCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Planetary relief data does not match its digest.");
    return clone(candidate);
  }

  function attachRelief(worldSeed, map, options = {}) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    const next = clone(strategicMap);
    next.relief = createRelief(worldSeed, strategicMap, options);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function plateIsContiguous(topology, plateByCell, plateIndex, expectedCount) {
    const start = plateByCell.indexOf(plateIndex);
    if (start < 0) return false;
    const seen = new Set([start]);
    const queue = [start];
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const neighbor of topology.neighbors[current]) {
        if (plateByCell[neighbor] !== plateIndex || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    return seen.size === expectedCount;
  }

  function auditRelief(map) {
    const relief = validateRelief(map);
    const topology = StrategicWorld.topologyForMap(map);
    const contiguousPlates = relief.plates.every((plate) => plateIsContiguous(topology, relief.plateByCell, plate.index, plate.cellCount));
    let coastPreserved = true;
    let elevationSignsValid = true;
    for (let index = 0; index < topology.cellCount; index += 1) {
      const touchesOther = topology.neighbors[index].some((neighbor) => map.surface.classes[neighbor] !== map.surface.classes[index]);
      coastPreserved &&= touchesOther === (relief.coastClasses[index] !== ".");
      elevationSignsValid &&= map.surface.classes[index] === "L" ? relief.elevationM[index] > 0 : relief.elevationM[index] < 0;
    }
    return {
      valid: contiguousPlates && coastPreserved && elevationSignsValid,
      plateCount: relief.plates.length,
      boundaryCount: relief.boundaries.length,
      contiguousPlates,
      coastPreserved,
      elevationSignsValid,
      minimumElevationM: relief.diagnostics.minimumElevationM,
      maximumElevationM: relief.diagnostics.maximumElevationM,
      boundaryKindCounts: clone(relief.diagnostics.boundaryKindCounts)
    };
  }

  function cellReliefSnapshot(map, index) {
    const relief = map?.relief;
    if (!relief || !Number.isInteger(index) || index < 0 || index >= relief.elevationM.length) return null;
    const plate = relief.plates[relief.plateByCell[index]];
    const boundary = relief.boundaries[relief.nearestBoundaryByCell[index]];
    return {
      elevationM: relief.elevationM[index],
      slopePercent: relief.slopePermille[index] / 10,
      reliefClass: RELIEF_CLASS_LEGEND[relief.reliefClasses[index]],
      coastClass: COAST_CLASS_LEGEND[relief.coastClasses[index]],
      plateId: plate?.id || null,
      boundaryId: boundary?.id || null,
      boundaryKind: boundary?.kind || null,
      boundaryDistanceCells: relief.boundaryDistanceByCell[index]
    };
  }

  return Object.freeze({
    RELIEF_VERSION,
    DEFAULT_PLATE_COUNT,
    MAX_LAND_ELEVATION_M,
    MAX_OCEAN_DEPTH_M,
    RELIEF_CLASS_LEGEND,
    COAST_CLASS_LEGEND,
    BOUNDARY_KINDS,
    createRelief,
    validateRelief,
    attachRelief,
    auditRelief,
    cellReliefSnapshot,
    clone
  });
});
