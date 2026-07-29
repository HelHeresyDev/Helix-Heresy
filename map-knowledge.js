(function attachHelixMapKnowledge(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixMapKnowledge = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixMapKnowledge() {
  "use strict";

  const RECENT_OBSERVATION_SECONDS = 15 * 60;
  const AGED_OBSERVATION_SECONDS = 2 * 60 * 60;
  const DEFAULT_VISION_RANGE_TILES = 12;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) {
      return null;
    }
    return {
      x: Math.round(Number(candidate.x)),
      y: Math.round(Number(candidate.y)),
      z: Number.isFinite(Number(candidate.z)) ? Math.round(Number(candidate.z)) : 0
    };
  }

  function cellKey(candidate) {
    const cell = cleanCell(candidate);
    return cell ? `${cell.x},${cell.y},${cell.z}` : "";
  }

  function cloneJson(candidate, fallback = null) {
    if (candidate === undefined || candidate === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(candidate));
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeObservation(candidate, fallbackKey = "") {
    if (!candidate || typeof candidate !== "object") return null;
    const cell = cleanCell(candidate.cell || (() => {
      const parts = String(fallbackKey || "").split(",").map(Number);
      return parts.length >= 2 ? { x: parts[0], y: parts[1], z: parts[2] || 0 } : null;
    })());
    if (!cell) return null;
    const lastObservedAt = Math.max(0, finiteNumber(candidate.lastObservedAt ?? candidate.observedAt));
    return {
      cell,
      firstObservedAt: Math.max(0, finiteNumber(candidate.firstObservedAt, lastObservedAt)),
      lastObservedAt,
      source: String(candidate.source || "direct observation"),
      snapshot: cloneJson(candidate.snapshot, {})
    };
  }

  function normalizeObservations(candidate = {}) {
    const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    const result = {};
    for (const [key, value] of Object.entries(source)) {
      const observation = normalizeObservation(value, key);
      if (observation) result[cellKey(observation.cell)] = observation;
    }
    return result;
  }

  function observationAgeSeconds(observation, clock = 0) {
    const clean = normalizeObservation(observation);
    return clean ? Math.max(0, finiteNumber(clock) - clean.lastObservedAt) : Number.POSITIVE_INFINITY;
  }

  function observationTier(observation, clock = 0) {
    const age = observationAgeSeconds(observation, clock);
    if (!Number.isFinite(age)) return "unknown";
    if (age <= RECENT_OBSERVATION_SECONDS) return "recent";
    if (age <= AGED_OBSERVATION_SECONDS) return "aged";
    return "archived";
  }

  function knowledgeForObservation(observation, clock = 0, options = {}) {
    if (options.debug) {
      return {
        state: "debug",
        observedAt: finiteNumber(clock),
        confidence: 1,
        source: "debug",
        tier: "current"
      };
    }
    if (options.current) {
      return {
        state: "current",
        observedAt: finiteNumber(clock),
        confidence: 1,
        source: String(options.source || "direct observation"),
        tier: "current"
      };
    }
    const clean = normalizeObservation(observation);
    if (!clean) {
      return {
        state: "unknown",
        observedAt: null,
        confidence: 0,
        source: String(options.source || "unexplored"),
        tier: "unknown"
      };
    }
    const age = observationAgeSeconds(clean, clock);
    const confidence = age <= RECENT_OBSERVATION_SECONDS
      ? 0.78
      : age <= AGED_OBSERVATION_SECONDS
        ? 0.55
        : 0.35;
    return {
      state: "stale",
      observedAt: clean.lastObservedAt,
      confidence,
      source: clean.source,
      tier: observationTier(clean, clock)
    };
  }

  function perceivedCellKeys(options = {}) {
    const origin = cleanCell(options.origin);
    if (!origin) return new Set();
    const width = Math.max(1, Math.floor(finiteNumber(options.width, origin.x + 1)));
    const height = Math.max(1, Math.floor(finiteNumber(options.height, origin.y + 1)));
    const radius = Math.max(0, finiteNumber(options.radius, DEFAULT_VISION_RANGE_TILES));
    const canSee = typeof options.canSee === "function" ? options.canSee : () => true;
    const distance = typeof options.distance === "function"
      ? options.distance
      : (left, right) => Math.hypot(right.x - left.x, right.y - left.y);
    const result = new Set();
    const minX = Math.max(0, Math.floor(origin.x - radius));
    const maxX = Math.min(width - 1, Math.ceil(origin.x + radius));
    const minY = Math.max(0, Math.floor(origin.y - radius));
    const maxY = Math.min(height - 1, Math.ceil(origin.y + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cell = { x, y, z: origin.z };
        if (distance(origin, cell) <= radius && canSee(origin, cell)) {
          result.add(cellKey(cell));
        }
      }
    }
    result.add(cellKey(origin));
    return result;
  }

  function snapshotCellView(cellView) {
    if (!cellView?.cell) return {};
    const object = cellView.object ? {
      symbols: [...(cellView.object.symbols || [])],
      labels: [...(cellView.object.labels || [])],
      tags: [...(cellView.object.tags || [])],
      blocking: Boolean(cellView.object.blocking),
      spriteKey: String(cellView.object.spriteKey || "")
    } : null;
    return cloneJson({
      roomId: String(cellView.roomId || ""),
      base: cellView.base || null,
      terrainConnectivity: cellView.terrainConnectivity || null,
      door: cellView.door || null,
      object,
      anchor: cellView.anchor || null,
      visual: cellView.visual || null
    }, {});
  }

  return {
    RECENT_OBSERVATION_SECONDS,
    AGED_OBSERVATION_SECONDS,
    DEFAULT_VISION_RANGE_TILES,
    cleanCell,
    cellKey,
    cloneJson,
    normalizeObservation,
    normalizeObservations,
    observationAgeSeconds,
    observationTier,
    knowledgeForObservation,
    perceivedCellKeys,
    snapshotCellView
  };
}));
