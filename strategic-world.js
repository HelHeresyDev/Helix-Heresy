(function initStrategicWorld(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicWorld = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicWorldApi() {
  "use strict";

  const STRATEGIC_MAP_VERSION = 1;
  const TOPOLOGY_VERSION = 1;
  const SURFACE_VERSION = 1;
  const ROUTE_GRAPH_VERSION = 1;
  const DEFAULT_REFINEMENT_LEVEL = 5;
  const DEFAULT_PLANET_RADIUS_KM = 3000;
  const DEFAULT_LAND_FRACTION = 0.38;
  const CELL_ID_PREFIX = "planet-cell:";
  const topologyCache = new Map();

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function stableHash(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function seededNumbers(seed) {
    let cursor = parseInt(stableHash(seed), 16) >>> 0;
    return function next() {
      cursor += 0x6d2b79f5;
      let value = cursor;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
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

  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function cellId(index) {
    const value = Math.floor(Number(index));
    if (!Number.isInteger(value) || value < 0) throw new Error("A non-negative strategic cell index is required.");
    return `${CELL_ID_PREFIX}${String(value).padStart(5, "0")}`;
  }

  function cellIndex(value) {
    const match = String(value || "").match(/^planet-cell:(\d{5,})$/);
    return match ? Number(match[1]) : -1;
  }

  function baseIcosahedron() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const vertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(normalizeVector);
    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    return { vertices, faces };
  }

  function buildTopology(refinementLevel = DEFAULT_REFINEMENT_LEVEL) {
    const level = clamp(Math.floor(Number(refinementLevel) || DEFAULT_REFINEMENT_LEVEL), 0, 5);
    if (topologyCache.has(level)) return topologyCache.get(level);
    let { vertices, faces } = baseIcosahedron();
    for (let iteration = 0; iteration < level; iteration += 1) {
      const midpoints = new Map();
      const midpoint = (left, right) => {
        const key = left < right ? `${left}:${right}` : `${right}:${left}`;
        if (midpoints.has(key)) return midpoints.get(key);
        const index = vertices.length;
        vertices.push(normalizeVector(add(vertices[left], vertices[right])));
        midpoints.set(key, index);
        return index;
      };
      const nextFaces = [];
      for (const [a, b, c] of faces) {
        const ab = midpoint(a, b);
        const bc = midpoint(b, c);
        const ca = midpoint(c, a);
        nextFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = nextFaces;
    }

    const neighborSets = Array.from({ length: vertices.length }, () => new Set());
    const incidentFaces = Array.from({ length: vertices.length }, () => []);
    const faceCenters = faces.map((face, faceIndex) => {
      const [a, b, c] = face;
      neighborSets[a].add(b).add(c);
      neighborSets[b].add(a).add(c);
      neighborSets[c].add(a).add(b);
      incidentFaces[a].push(faceIndex);
      incidentFaces[b].push(faceIndex);
      incidentFaces[c].push(faceIndex);
      return normalizeVector(add(add(vertices[a], vertices[b]), vertices[c]));
    });
    const neighbors = neighborSets.map((entries) => [...entries].sort((a, b) => a - b));
    const cellCornerFaceIndices = incidentFaces.map((entries, index) => {
      const center = vertices[index];
      const referenceAxis = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const tangentX = normalizeVector(cross(referenceAxis, center));
      const tangentY = cross(center, tangentX);
      return [...entries].sort((left, right) => {
        const a = faceCenters[left];
        const b = faceCenters[right];
        const angleA = Math.atan2(dot(a, tangentY), dot(a, tangentX));
        const angleB = Math.atan2(dot(b, tangentY), dot(b, tangentX));
        return angleA - angleB;
      });
    });
    const pentagonIndices = neighbors
      .map((entries, index) => entries.length === 5 ? index : -1)
      .filter((index) => index >= 0);
    const topology = Object.freeze({
      version: TOPOLOGY_VERSION,
      kind: "geodesic-icosphere-dual",
      refinementLevel: level,
      cellCount: vertices.length,
      faceCount: faces.length,
      hexagonCount: neighbors.filter((entries) => entries.length === 6).length,
      pentagonCount: pentagonIndices.length,
      pentagonIndices: Object.freeze(pentagonIndices),
      vertices: Object.freeze(vertices.map((vertex) => Object.freeze(vertex))),
      faces: Object.freeze(faces.map((face) => Object.freeze(face))),
      faceCenters: Object.freeze(faceCenters.map((center) => Object.freeze(center))),
      neighbors: Object.freeze(neighbors.map((entries) => Object.freeze(entries))),
      cellCornerFaceIndices: Object.freeze(cellCornerFaceIndices.map((entries) => Object.freeze(entries)))
    });
    topologyCache.set(level, topology);
    return topology;
  }

  function randomUnitVector(rng) {
    const y = rng() * 2 - 1;
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  }

  function surfaceScores(topology, seed) {
    const rng = seededNumbers(`${seed}:planet-surface:v${SURFACE_VERSION}`);
    const anchors = Array.from({ length: 9 }, () => ({
      center: randomUnitVector(rng),
      radius: 0.42 + rng() * 0.55,
      strength: 0.75 + rng() * 0.5
    }));
    const waves = Array.from({ length: 6 }, (_, index) => ({
      axis: randomUnitVector(rng),
      frequency: 3 + index * 1.7 + rng() * 1.5,
      phase: rng() * Math.PI * 2,
      amplitude: 0.12 / (1 + index * 0.35)
    }));
    return topology.vertices.map((position, index) => {
      let continental = -0.6;
      for (const anchor of anchors) {
        const angularDistance = Math.acos(clamp(dot(position, anchor.center), -1, 1));
        const influence = anchor.strength * (1 - angularDistance / anchor.radius);
        continental = Math.max(continental, influence);
      }
      let detail = 0;
      for (const wave of waves) {
        detail += Math.sin(dot(position, wave.axis) * wave.frequency + wave.phase) * wave.amplitude;
      }
      return continental + detail + index * 1e-12;
    });
  }

  function surfaceRegions(topology, surfaceClasses) {
    const regionByCell = new Array(topology.cellCount).fill(-1);
    const regions = [];
    for (let start = 0; start < topology.cellCount; start += 1) {
      if (regionByCell[start] >= 0) continue;
      const surfaceClass = surfaceClasses[start] === "L" ? "land" : "ocean";
      const regionIndex = regions.length;
      const queue = [start];
      regionByCell[start] = regionIndex;
      let cursor = 0;
      while (cursor < queue.length) {
        const current = queue[cursor];
        cursor += 1;
        for (const neighbor of topology.neighbors[current]) {
          const neighborClass = surfaceClasses[neighbor] === "L" ? "land" : "ocean";
          if (regionByCell[neighbor] < 0 && neighborClass === surfaceClass) {
            regionByCell[neighbor] = regionIndex;
            queue.push(neighbor);
          }
        }
      }
      const ordinal = regions.filter((region) => region.surfaceClass === surfaceClass).length + 1;
      regions.push({
        id: `topology-region:${surfaceClass}:${String(ordinal).padStart(3, "0")}`,
        surfaceClass,
        cellCount: queue.length,
        anchorCellId: cellId(start)
      });
    }
    return { regions, regionByCell };
  }

  function strategicMapCore(map) {
    const core = {
      version: map.version,
      topology: map.topology,
      surface: map.surface,
      routeGraph: map.routeGraph,
      diagnostics: map.diagnostics
    };
    if (map.relief) core.relief = map.relief;
    if (map.climate) core.climate = map.climate;
    if (map.hydrology) core.hydrology = map.hydrology;
    if (map.biomes) core.biomes = map.biomes;
    if (map.geology) core.geology = map.geology;
    if (map.naturalHazards) core.naturalHazards = map.naturalHazards;
    if (map.arcaneGeography) core.arcaneGeography = map.arcaneGeography;
    if (map.magicalHazards) core.magicalHazards = map.magicalHazards;
    if (map.resourcePotential) core.resourcePotential = map.resourcePotential;
    if (map.publicResourceProspects) core.publicResourceProspects = map.publicResourceProspects;
    if (map.humanGeography) core.humanGeography = map.humanGeography;
    if (map.cityPolities) core.cityPolities = map.cityPolities;
    if (map.beastEcology) core.beastEcology = map.beastEcology;
    if (map.publicBeastAtlas) core.publicBeastAtlas = map.publicBeastAtlas;
    if (map.cityGovernments) core.cityGovernments = map.cityGovernments;
    if (map.publicCityGovernmentDirectory) core.publicCityGovernmentDirectory = map.publicCityGovernmentDirectory;
    if (map.cityLegalCodes) core.cityLegalCodes = map.cityLegalCodes;
    if (map.publicCityLawDirectory) core.publicCityLawDirectory = map.publicCityLawDirectory;
    if (map.crossCityRecognition) core.crossCityRecognition = map.crossCityRecognition;
    if (map.publicCrossCityRecognitionDirectory) core.publicCrossCityRecognitionDirectory = map.publicCrossCityRecognitionDirectory;
    if (map.strategicReligions) core.strategicReligions = map.strategicReligions;
    if (map.publicReligionDirectory) core.publicReligionDirectory = map.publicReligionDirectory;
    if (map.strategicNonStateNetworks) core.strategicNonStateNetworks = map.strategicNonStateNetworks;
    if (map.publicNonStateNetworkDirectory) core.publicNonStateNetworkDirectory = map.publicNonStateNetworkDirectory;
    if (map.strategicSettlements) core.strategicSettlements = map.strategicSettlements;
    if (map.publicSettlementDirectory) core.publicSettlementDirectory = map.publicSettlementDirectory;
    if (map.strategicCrisisHistory) core.strategicCrisisHistory = map.strategicCrisisHistory;
    if (map.publicCrisisHistoryDirectory) core.publicCrisisHistoryDirectory = map.publicCrisisHistoryDirectory;
    if (map.strategicPoliticalHistory) core.strategicPoliticalHistory = map.strategicPoliticalHistory;
    if (map.publicPoliticalHistoryDirectory) core.publicPoliticalHistoryDirectory = map.publicPoliticalHistoryDirectory;
    if (map.strategicCivicHistory) core.strategicCivicHistory = map.strategicCivicHistory;
    if (map.publicCivicHistoryDirectory) core.publicCivicHistoryDirectory = map.publicCivicHistoryDirectory;
    if (map.strategicLegalHistory) core.strategicLegalHistory = map.strategicLegalHistory;
    if (map.publicLegalHistoryDirectory) core.publicLegalHistoryDirectory = map.publicLegalHistoryDirectory;
    if (map.strategicPublicAttitudeHistory) core.strategicPublicAttitudeHistory = map.strategicPublicAttitudeHistory;
    if (map.publicAttitudeHistoryDirectory) core.publicAttitudeHistoryDirectory = map.publicAttitudeHistoryDirectory;
    if (map.strategicPlayableSettlementState) core.strategicPlayableSettlementState = map.strategicPlayableSettlementState;
    if (map.publicPlayableSettlementDirectory) core.publicPlayableSettlementDirectory = map.publicPlayableSettlementDirectory;
    if (map.strategicReligiousInstitutionHistory) core.strategicReligiousInstitutionHistory = map.strategicReligiousInstitutionHistory;
    if (map.publicReligiousInstitutionHistoryDirectory) core.publicReligiousInstitutionHistoryDirectory = map.publicReligiousInstitutionHistoryDirectory;
    if (map.strategicNonStateNetworkHistory) core.strategicNonStateNetworkHistory = map.strategicNonStateNetworkHistory;
    if (map.publicNonStateNetworkHistoryDirectory) core.publicNonStateNetworkHistoryDirectory = map.publicNonStateNetworkHistoryDirectory;
    if (map.strategicEnforcementPracticeHistory) core.strategicEnforcementPracticeHistory = map.strategicEnforcementPracticeHistory;
    if (map.publicEnforcementPracticeDirectory) core.publicEnforcementPracticeDirectory = map.publicEnforcementPracticeDirectory;
    return core;
  }

  function strategicMapDigest(map) {
    return `strategic-${stableHash(strategicMapCore(map))}`;
  }

  function finalizeStrategicMap(candidate) {
    const map = clone(candidate);
    delete map.digest;
    map.digest = strategicMapDigest(map);
    return map;
  }

  function createStrategicMap(worldSeed, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic globe generation.");
    const refinementLevel = clamp(Math.floor(Number(options.refinementLevel) || DEFAULT_REFINEMENT_LEVEL), 0, 5);
    const radiusKm = Math.max(100, Math.round(Number(options.radiusKm) || DEFAULT_PLANET_RADIUS_KM));
    const requestedFraction = Number(options.landFraction);
    const landFraction = clamp(Number.isFinite(requestedFraction) ? requestedFraction : DEFAULT_LAND_FRACTION, 0.2, 0.7);
    const topology = buildTopology(refinementLevel);
    const scores = surfaceScores(topology, seed);
    const landCount = Math.round(topology.cellCount * landFraction);
    const ranked = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    const classes = new Array(topology.cellCount).fill("W");
    for (let index = 0; index < landCount; index += 1) classes[ranked[index].index] = "L";
    const surfaceClasses = classes.join("");
    const { regions, regionByCell } = surfaceRegions(topology, surfaceClasses);
    const map = {
      version: STRATEGIC_MAP_VERSION,
      topology: {
        version: TOPOLOGY_VERSION,
        kind: topology.kind,
        refinementLevel,
        planetRadiusKm: radiusKm,
        cellCount: topology.cellCount,
        faceCount: topology.faceCount,
        hexagonCount: topology.hexagonCount,
        pentagonCount: topology.pentagonCount
      },
      surface: {
        version: SURFACE_VERSION,
        encoding: "LW-by-cell-index",
        landFraction: landCount / topology.cellCount,
        classes: surfaceClasses,
        regions,
        regionByCell
      },
      routeGraph: {
        version: ROUTE_GRAPH_VERSION,
        nodes: [],
        routes: []
      },
      diagnostics: {
        boundaryCellCount: 0,
        landCellCount: landCount,
        oceanCellCount: topology.cellCount - landCount,
        topologyRegionCount: regions.length
      }
    };
    map.digest = strategicMapDigest(map);
    return map;
  }

  function validateStrategicMap(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("Strategic map record is invalid.");
    }
    if (Number(candidate.version) !== STRATEGIC_MAP_VERSION) throw new Error("Strategic map version is unsupported.");
    if (candidate.topology?.kind !== "geodesic-icosphere-dual") throw new Error("Strategic topology kind is unsupported.");
    const topology = buildTopology(candidate.topology.refinementLevel);
    if (
      Number(candidate.topology.cellCount) !== topology.cellCount
      || Number(candidate.topology.hexagonCount) !== topology.hexagonCount
      || Number(candidate.topology.pentagonCount) !== 12
    ) throw new Error("Strategic topology metadata is inconsistent.");
    const classes = String(candidate.surface?.classes || "");
    if (classes.length !== topology.cellCount || /[^LW]/.test(classes)) throw new Error("Strategic surface encoding is invalid.");
    if (!Array.isArray(candidate.surface?.regions) || !Array.isArray(candidate.surface?.regionByCell)) {
      throw new Error("Strategic topology regions are missing.");
    }
    validateRouteGraph(candidate, candidate.routeGraph);
    if (candidate.surface.regionByCell.length !== topology.cellCount) throw new Error("Strategic region index is incomplete.");
    for (let index = 0; index < topology.cellCount; index += 1) {
      const region = candidate.surface.regions[candidate.surface.regionByCell[index]];
      const surfaceClass = classes[index] === "L" ? "land" : "ocean";
      if (!region || region.surfaceClass !== surfaceClass) throw new Error("Strategic region membership is inconsistent.");
    }
    const expectedDigest = strategicMapDigest(candidate);
    if (candidate.digest !== expectedDigest) throw new Error("Strategic map data does not match its digest.");
    return clone(candidate);
  }

  function topologyForMap(map) {
    return buildTopology(map?.topology?.refinementLevel);
  }

  function cellSurfaceClass(map, index) {
    return map?.surface?.classes?.[index] === "L" ? "land" : "ocean";
  }

  function cellRegion(map, index) {
    return map?.surface?.regions?.[map.surface.regionByCell?.[index]] || null;
  }

  function latitudeLongitude(position) {
    return {
      latitude: Math.asin(clamp(position[1], -1, 1)) * 180 / Math.PI,
      longitude: Math.atan2(position[2], position[0]) * 180 / Math.PI
    };
  }

  function greatCircleDistanceKm(map, leftIndex, rightIndex) {
    const topology = topologyForMap(map);
    const left = topology.vertices[leftIndex];
    const right = topology.vertices[rightIndex];
    if (!left || !right) return null;
    return Math.acos(clamp(dot(left, right), -1, 1)) * Number(map.topology.planetRadiusKm);
  }

  function graphDistance(map, leftIndex, rightIndex) {
    const topology = topologyForMap(map);
    if (!topology.vertices[leftIndex] || !topology.vertices[rightIndex]) return null;
    if (leftIndex === rightIndex) return 0;
    const distances = new Int32Array(topology.cellCount);
    distances.fill(-1);
    distances[leftIndex] = 0;
    const queue = [leftIndex];
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      const nextDistance = distances[current] + 1;
      for (const neighbor of topology.neighbors[current]) {
        if (distances[neighbor] >= 0) continue;
        if (neighbor === rightIndex) return nextDistance;
        distances[neighbor] = nextDistance;
        queue.push(neighbor);
      }
    }
    return null;
  }

  function cellRing(map, originIndex, radius) {
    const topology = topologyForMap(map);
    const targetRadius = Math.max(0, Math.floor(Number(radius) || 0));
    if (!topology.vertices[originIndex]) return [];
    if (targetRadius === 0) return [originIndex];
    const visited = new Set([originIndex]);
    let frontier = [originIndex];
    for (let step = 0; step < targetRadius; step += 1) {
      const next = [];
      for (const current of frontier) {
        for (const neighbor of topology.neighbors[current]) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
    return frontier.sort((a, b) => a - b);
  }

  function cellSnapshot(map, index) {
    const topology = topologyForMap(map);
    const position = topology.vertices[index];
    if (!position) return null;
    const coordinates = latitudeLongitude(position);
    const region = cellRegion(map, index);
    return {
      id: cellId(index),
      index,
      sides: topology.neighbors[index].length,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      surfaceClass: cellSurfaceClass(map, index),
      topologyRegionId: region?.id || null,
      neighborIds: topology.neighbors[index].map(cellId)
    };
  }

  function validateRouteRecord(map, candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Strategic route record is invalid.");
    const id = String(candidate.id || "").trim();
    if (!/^[a-z0-9][a-z0-9:._-]*$/i.test(id)) throw new Error("Strategic routes require a stable semantic ID.");
    if (!Array.isArray(candidate.cellPath) || candidate.cellPath.length < 2) throw new Error(`${id} requires an ordered path across at least two cells.`);
    const topology = topologyForMap(map);
    const indices = candidate.cellPath.map(cellIndex);
    if (indices.some((index) => !topology.vertices[index])) throw new Error(`${id} references an unknown strategic cell.`);
    for (let index = 1; index < indices.length; index += 1) {
      if (!topology.neighbors[indices[index - 1]].includes(indices[index])) {
        throw new Error(`${id} contains non-adjacent strategic cells.`);
      }
    }
    return {
      id,
      kind: String(candidate.kind || "surfaceRoute"),
      endpointIds: Array.isArray(candidate.endpointIds) ? candidate.endpointIds.map((value) => String(value)) : [],
      cellPath: indices.map(cellId)
    };
  }

  function validateRouteGraph(map, candidate = {}) {
    if (Number(candidate?.version) !== ROUTE_GRAPH_VERSION) throw new Error("Strategic route graph version is unsupported.");
    if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.routes)) throw new Error("Strategic route graph is invalid.");
    const routeIds = new Set();
    const routes = candidate.routes.map((route) => {
      const normalized = validateRouteRecord(map, route);
      if (routeIds.has(normalized.id)) throw new Error(`Duplicate strategic route ID: ${normalized.id}.`);
      routeIds.add(normalized.id);
      return normalized;
    });
    return {
      version: ROUTE_GRAPH_VERSION,
      nodes: clone(candidate.nodes),
      routes
    };
  }

  function auditStrategicMap(map) {
    const validated = validateStrategicMap(map);
    const topology = topologyForMap(validated);
    let reciprocalEdges = true;
    for (let index = 0; index < topology.cellCount && reciprocalEdges; index += 1) {
      reciprocalEdges = topology.neighbors[index].every((neighbor) => topology.neighbors[neighbor].includes(index));
    }
    const rebuilt = surfaceRegions(topology, validated.surface.classes);
    const connectedRegions = rebuilt.regions.length === validated.surface.regions.length
      && rebuilt.regionByCell.every((regionIndex, index) => regionIndex === validated.surface.regionByCell[index]);
    return {
      valid: reciprocalEdges && connectedRegions,
      cellCount: topology.cellCount,
      hexagonCount: topology.hexagonCount,
      pentagonCount: topology.pentagonCount,
      boundaryCellCount: topology.neighbors.filter((entries) => entries.length < 5).length,
      reciprocalEdges,
      connectedRegions,
      landCellCount: [...validated.surface.classes].filter((value) => value === "L").length,
      oceanCellCount: [...validated.surface.classes].filter((value) => value === "W").length
    };
  }

  return Object.freeze({
    STRATEGIC_MAP_VERSION,
    TOPOLOGY_VERSION,
    SURFACE_VERSION,
    ROUTE_GRAPH_VERSION,
    DEFAULT_REFINEMENT_LEVEL,
    DEFAULT_PLANET_RADIUS_KM,
    DEFAULT_LAND_FRACTION,
    CELL_ID_PREFIX,
    stableHash,
    seededNumbers,
    buildTopology,
    createStrategicMap,
    strategicMapDigest,
    finalizeStrategicMap,
    validateStrategicMap,
    topologyForMap,
    cellId,
    cellIndex,
    cellSurfaceClass,
    cellRegion,
    cellSnapshot,
    validateRouteRecord,
    validateRouteGraph,
    latitudeLongitude,
    greatCircleDistanceKm,
    graphDistance,
    cellRing,
    auditStrategicMap,
    clone
  });
});
