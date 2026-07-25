(function attachHelixTerrainConnectivity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixTerrainConnectivity = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixTerrainConnectivity() {
  "use strict";

  const CARDINALS = Object.freeze([
    Object.freeze({ id: "north", bit: 1, dx: 0, dy: -1, opposite: "south" }),
    Object.freeze({ id: "east", bit: 2, dx: 1, dy: 0, opposite: "west" }),
    Object.freeze({ id: "south", bit: 4, dx: 0, dy: 1, opposite: "north" }),
    Object.freeze({ id: "west", bit: 8, dx: -1, dy: 0, opposite: "east" })
  ]);
  const DIAGONALS = Object.freeze([
    Object.freeze({ id: "northEast", bit: 1, dx: 1, dy: -1 }),
    Object.freeze({ id: "southEast", bit: 2, dx: 1, dy: 1 }),
    Object.freeze({ id: "southWest", bit: 4, dx: -1, dy: 1 }),
    Object.freeze({ id: "northWest", bit: 8, dx: -1, dy: -1 })
  ]);
  const EDGE_RELATIONS = new Set(["joined", "abutment", "portal", "transition", "exposed", "unknown", "boundary"]);
  const FRAME_AXES = new Set(["eastWest", "northSouth"]);

  function cleanRelation(value, fallback = "exposed") {
    const relation = String(value || "");
    return EDGE_RELATIONS.has(relation) ? relation : fallback;
  }

  function cleanFrameAxis(value, fallback = "eastWest") {
    const axis = String(value || "");
    return FRAME_AXES.has(axis) ? axis : fallback;
  }

  function passageAxisForFrame(frameAxis) {
    return cleanFrameAxis(frameAxis) === "eastWest" ? "northSouth" : "eastWest";
  }

  function maskForRelations(relations = {}, accepted = ["joined"]) {
    const acceptedSet = new Set(accepted.map((entry) => cleanRelation(entry)));
    return CARDINALS.reduce((mask, direction) => (
      acceptedSet.has(cleanRelation(relations[direction.id])) ? mask | direction.bit : mask
    ), 0);
  }

  function diagonalMaskForRelations(relations = {}, accepted = ["joined"]) {
    const acceptedSet = new Set(accepted.map((entry) => cleanRelation(entry)));
    return DIAGONALS.reduce((mask, direction) => (
      acceptedSet.has(cleanRelation(relations[direction.id])) ? mask | direction.bit : mask
    ), 0);
  }

  function directionIdsForMask(mask) {
    const cleanMask = Math.max(0, Math.min(15, Math.floor(Number(mask) || 0)));
    return CARDINALS.filter((direction) => cleanMask & direction.bit).map((direction) => direction.id);
  }

  function classifyCardinalMask(mask) {
    const cleanMask = Math.max(0, Math.min(15, Math.floor(Number(mask) || 0)));
    const count = directionIdsForMask(cleanMask).length;
    if (cleanMask === 0) return { shape: "isolated", rotationQuarterTurns: 0 };
    if (cleanMask === 15) return { shape: "cross", rotationQuarterTurns: 0 };
    if (count === 1) {
      return {
        shape: "end",
        rotationQuarterTurns: { 1: 0, 2: 1, 4: 2, 8: 3 }[cleanMask]
      };
    }
    if (cleanMask === 5 || cleanMask === 10) {
      return { shape: "straight", rotationQuarterTurns: cleanMask === 5 ? 0 : 1 };
    }
    if (count === 2) {
      return {
        shape: "corner",
        rotationQuarterTurns: { 3: 0, 6: 1, 12: 2, 9: 3 }[cleanMask] ?? 0
      };
    }
    if (count === 3) {
      return {
        shape: "tee",
        rotationQuarterTurns: { 7: 0, 14: 1, 13: 2, 11: 3 }[cleanMask] ?? 0
      };
    }
    return { shape: "custom", rotationQuarterTurns: 0 };
  }

  function normalizeCardinalRelations(relations = {}) {
    return Object.fromEntries(CARDINALS.map((direction) => [
      direction.id,
      cleanRelation(relations[direction.id])
    ]));
  }

  function normalizeDiagonalRelations(relations = {}) {
    return Object.fromEntries(DIAGONALS.map((direction) => [
      direction.id,
      cleanRelation(relations[direction.id])
    ]));
  }

  function describeEdgeRelations(cardinalRelations = {}, diagonalRelations = {}) {
    const edges = normalizeCardinalRelations(cardinalRelations);
    const corners = normalizeDiagonalRelations(diagonalRelations);
    const joinedMask = maskForRelations(edges, ["joined"]);
    const classification = classifyCardinalMask(joinedMask);
    return {
      edges,
      corners,
      cardinalMask: joinedMask,
      joinedMask,
      abutmentMask: maskForRelations(edges, ["abutment"]),
      portalMask: maskForRelations(edges, ["portal"]),
      transitionMask: maskForRelations(edges, ["transition"]),
      exposedMask: maskForRelations(edges, ["exposed"]),
      unknownMask: maskForRelations(edges, ["unknown"]),
      boundaryMask: maskForRelations(edges, ["boundary"]),
      contactMask: maskForRelations(edges, ["joined", "abutment", "portal", "transition", "boundary"]),
      diagonalMask: diagonalMaskForRelations(corners, ["joined"]),
      joinedDirections: directionIdsForMask(joinedMask),
      shape: classification.shape,
      rotationQuarterTurns: classification.rotationQuarterTurns
    };
  }

  function cellAtOffset(cell, dx, dy, dz = 0) {
    if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) return null;
    return {
      x: Math.round(Number(cell.x)) + dx,
      y: Math.round(Number(cell.y)) + dy,
      z: (Number.isFinite(Number(cell.z)) ? Math.round(Number(cell.z)) : 0) + dz
    };
  }

  function buildNeighborRelations(cell, getNeighbor, classifyRelation) {
    const cardinal = {};
    const diagonal = {};
    for (const direction of CARDINALS) {
      const neighborCell = cellAtOffset(cell, direction.dx, direction.dy);
      cardinal[direction.id] = cleanRelation(classifyRelation(getNeighbor(neighborCell), direction.id, neighborCell));
    }
    for (const direction of DIAGONALS) {
      const neighborCell = cellAtOffset(cell, direction.dx, direction.dy);
      diagonal[direction.id] = cleanRelation(classifyRelation(getNeighbor(neighborCell), direction.id, neighborCell));
    }
    return describeEdgeRelations(cardinal, diagonal);
  }

  function stableHash(value) {
    const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function variationIndex(parts, count = 4) {
    const cleanCount = Math.max(1, Math.floor(Number(count) || 1));
    return stableHash(parts) % cleanCount;
  }

  function inferFrameAxis(options = {}) {
    const supportMask = Math.max(0, Math.min(15, Math.floor(Number(options.supportMask) || 0)));
    const passageMask = Math.max(0, Math.min(15, Math.floor(Number(options.passageMask) || 0)));
    const eastWestSupports = Number(Boolean(supportMask & 2)) + Number(Boolean(supportMask & 8));
    const northSouthSupports = Number(Boolean(supportMask & 1)) + Number(Boolean(supportMask & 4));
    if (eastWestSupports !== northSouthSupports) return eastWestSupports > northSouthSupports ? "eastWest" : "northSouth";
    const northSouthPassage = Number(Boolean(passageMask & 1)) + Number(Boolean(passageMask & 4));
    const eastWestPassage = Number(Boolean(passageMask & 2)) + Number(Boolean(passageMask & 8));
    if (northSouthPassage !== eastWestPassage) return northSouthPassage > eastWestPassage ? "eastWest" : "northSouth";
    return cleanFrameAxis(options.fallback);
  }

  function rampSegment(ramp, cell) {
    if (!ramp || !cell) return null;
    const key = (candidate) => `${Number(candidate?.x)},${Number(candidate?.y)},${Number(candidate?.z) || 0}`;
    const targetKey = key(cell);
    const footprint = Array.isArray(ramp.footprintCells) ? ramp.footprintCells : [];
    const upper = Array.isArray(ramp.upperCells) ? ramp.upperCells : [];
    const footprintIndex = footprint.findIndex((candidate) => key(candidate) === targetKey);
    const width = Math.max(1, Math.floor(Number(ramp.width) || 1));
    const length = Math.max(1, Math.floor(Number(ramp.length) || 1));
    if (footprintIndex >= 0) {
      const alongIndex = Math.floor(footprintIndex / width);
      return {
        kind: alongIndex === 0 ? "entry" : alongIndex === length - 1 ? "exit" : "middle",
        alongIndex,
        laneIndex: footprintIndex % width,
        length,
        width,
        direction: String(ramp.direction || "east")
      };
    }
    const upperIndex = upper.findIndex((candidate) => key(candidate) === targetKey);
    if (upperIndex >= 0) {
      return {
        kind: "upperLanding",
        alongIndex: length,
        laneIndex: upperIndex,
        length,
        width,
        direction: String(ramp.direction || "east")
      };
    }
    return null;
  }

  return {
    CARDINALS,
    DIAGONALS,
    cleanRelation,
    cleanFrameAxis,
    passageAxisForFrame,
    maskForRelations,
    diagonalMaskForRelations,
    directionIdsForMask,
    classifyCardinalMask,
    describeEdgeRelations,
    cellAtOffset,
    buildNeighborRelations,
    stableHash,
    variationIndex,
    inferFrameAxis,
    rampSegment
  };
}));
