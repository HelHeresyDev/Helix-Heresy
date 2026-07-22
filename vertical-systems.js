(function attachHelixVerticalSystems(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixVerticalSystems = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixVerticalSystems() {
  "use strict";

  const DIRECTIONS = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 }
  };

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanCell(value) {
    if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
    return {
      x: Math.round(Number(value.x)),
      y: Math.round(Number(value.y)),
      z: Number.isFinite(Number(value.z)) ? Math.round(Number(value.z)) : 0
    };
  }

  function cellKey(cell) {
    const clean = cleanCell(cell);
    return clean ? `${clean.x},${clean.y},${clean.z}` : "invalid";
  }

  function cleanDirection(value) {
    return DIRECTIONS[value] ? value : "east";
  }

  function rampAngleDegrees(length, layerHeight = 4, tileSize = 1) {
    const run = Math.max(tileSize, Math.round(finiteNumber(length, 1)) * tileSize);
    return Math.atan2(Math.max(0.1, finiteNumber(layerHeight, 4)), run) * 180 / Math.PI;
  }

  function rampGradeLabel(length) {
    const clean = Math.max(1, Math.round(finiteNumber(length, 1)));
    if (clean <= 1) return "Steep";
    if (clean <= 2) return "Moderate";
    if (clean <= 4) return "Gradual";
    return "Gentle";
  }

  function rampTravelCost(length, layerHeight = 4, tileSize = 1) {
    const cleanLength = Math.max(1, Math.round(finiteNumber(length, 1)));
    const run = cleanLength * Math.max(0.1, finiteNumber(tileSize, 1));
    const rise = Math.max(0.1, finiteNumber(layerHeight, 4));
    const distance = Math.hypot(run, rise);
    const steepnessFactor = 1 + Math.max(0, rise / run - 1) * 0.5;
    return distance * steepnessFactor;
  }

  function rampFootprintCells(lowerCell, direction = "east", length = 1, width = 1) {
    const lower = cleanCell(lowerCell);
    if (!lower) return [];
    const cleanDirectionId = cleanDirection(direction);
    const vector = DIRECTIONS[cleanDirectionId];
    const side = { x: -vector.y, y: vector.x };
    const cleanLength = Math.max(1, Math.round(finiteNumber(length, 1)));
    const cleanWidth = Math.max(1, Math.round(finiteNumber(width, 1)));
    const cells = [];
    for (let along = 0; along < cleanLength; along += 1) {
      for (let across = 0; across < cleanWidth; across += 1) {
        cells.push({
          x: lower.x + vector.x * along + side.x * across,
          y: lower.y + vector.y * along + side.y * across,
          z: lower.z
        });
      }
    }
    return cells;
  }

  function rampUpperCells(lowerCell, direction = "east", length = 1, width = 1) {
    const lower = cleanCell(lowerCell);
    if (!lower) return [];
    const cleanDirectionId = cleanDirection(direction);
    const vector = DIRECTIONS[cleanDirectionId];
    const side = { x: -vector.y, y: vector.x };
    const cleanLength = Math.max(1, Math.round(finiteNumber(length, 1)));
    const cleanWidth = Math.max(1, Math.round(finiteNumber(width, 1)));
    return Array.from({ length: cleanWidth }, (_, across) => ({
      x: lower.x + vector.x * cleanLength + side.x * across,
      y: lower.y + vector.y * cleanLength + side.y * across,
      z: lower.z + 1
    }));
  }

  function normalizeRamp(candidate, options = {}) {
    const lowerCell = cleanCell(candidate?.lowerCell || candidate?.startCell);
    if (!lowerCell) return null;
    const direction = cleanDirection(candidate?.direction);
    const length = Math.max(1, Math.min(64, Math.round(finiteNumber(candidate?.length, 1))));
    const width = Math.max(1, Math.min(16, Math.round(finiteNumber(candidate?.width, 1))));
    const upperCells = rampUpperCells(lowerCell, direction, length, width);
    const upperCell = upperCells[0];
    const layerHeight = Math.max(1, finiteNumber(options.layerHeight, 4));
    const tileSize = Math.max(0.25, finiteNumber(options.tileSize, 1));
    return {
      id: String(candidate?.id || `ramp-${lowerCell.x}-${lowerCell.y}-${lowerCell.z}-${direction}-${length}x${width}`)
        .replace(/[^a-zA-Z0-9_-]/g, ""),
      type: "ramp",
      lowerCell,
      upperCell,
      upperCells,
      direction,
      length,
      width,
      grade: rampGradeLabel(length),
      angleDegrees: rampAngleDegrees(length, layerHeight, tileSize),
      travelCost: rampTravelCost(length, layerHeight, tileSize),
      footprintCells: rampFootprintCells(lowerCell, direction, length, width),
      materialComposition: candidate?.materialComposition || { primary: candidate?.materialId || "stone" },
      condition: Math.max(0, Math.min(100, finiteNumber(candidate?.condition, 100))),
      builtAt: finiteNumber(candidate?.builtAt, 0)
    };
  }

  function rampEndpointOtherThan(ramp, cell) {
    const clean = cleanCell(cell);
    if (!ramp || !clean) return null;
    if (cellKey(ramp.lowerCell) === cellKey(clean)) return cleanCell(ramp.upperCell);
    if (cellKey(ramp.upperCell) === cellKey(clean)) return cleanCell(ramp.lowerCell);
    return null;
  }

  function rampTraversalBlockReason(ramp, footprint = {}, load = {}) {
    if (!ramp) return "The ramp no longer exists.";
    if (finiteNumber(ramp.condition, 0) <= 0) return "The ramp has collapsed.";
    const crosswise = ["north", "south"].includes(ramp.direction)
      ? Math.max(1, Math.round(finiteNumber(footprint.width, 1)))
      : Math.max(1, Math.round(finiteNumber(footprint.height, 1)));
    const loadWidth = Math.max(0, finiteNumber(load.widthM, 0));
    if (Math.max(crosswise, Math.ceil(loadWidth)) > ramp.width) {
      return `The ${ramp.width} m ramp is too narrow for this body or carried load.`;
    }
    const loadLength = Math.max(0, finiteNumber(load.lengthM, 0));
    if (ramp.length === 1 && loadLength > 2) return "This bulky load cannot negotiate a one-tile steep ramp.";
    const loadMass = Math.max(0, finiteNumber(load.massKg, 0));
    if (ramp.length === 1 && loadMass > 250) return "This heavy load needs a longer ramp, powered haulage, or disassembly.";
    if (finiteNumber(ramp.condition, 100) < 25 && loadMass > 50) return "The breached ramp cannot safely carry this load.";
    return "";
  }

  function boundaryKey(upperCell) {
    return `floor:${cellKey(upperCell)}`;
  }

  return {
    DIRECTIONS,
    cleanCell,
    cellKey,
    cleanDirection,
    rampAngleDegrees,
    rampGradeLabel,
    rampTravelCost,
    rampFootprintCells,
    rampUpperCells,
    normalizeRamp,
    rampEndpointOtherThan,
    rampTraversalBlockReason,
    boundaryKey
  };
}));
