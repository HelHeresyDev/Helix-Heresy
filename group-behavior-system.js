(function attachHelixGroupBehavior(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixGroupBehavior = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixGroupBehavior() {
  "use strict";

  const LOCAL_RADIUS = 6;
  const COHORT_LINK_RADIUS = 3;
  const DETAILED_NEIGHBOR_LIMIT = 16;

  function cleanCell(cell) {
    if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) return null;
    return {
      x: Math.round(Number(cell.x)),
      y: Math.round(Number(cell.y)),
      z: Math.round(Number(cell.z) || 0)
    };
  }

  function distance(left, right) {
    const a = cleanCell(left);
    const b = cleanCell(right);
    if (!a || !b || a.z !== b.z) return Infinity;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function stableActorCompare(left, right) {
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  }

  function defaultCompatible(left, right) {
    if (left.containerId || right.containerId) {
      return Boolean(left.containerId) && left.containerId === right.containerId;
    }
    return left.roomId === right.roomId;
  }

  function buildLocalContexts(actors, options = {}) {
    const radius = Math.max(1, Math.floor(Number(options.radius) || LOCAL_RADIUS));
    const linkRadius = Math.min(radius, Math.max(1, Math.floor(Number(options.linkRadius) || COHORT_LINK_RADIUS)));
    const neighborLimit = Math.max(1, Math.floor(Number(options.neighborLimit) || DETAILED_NEIGHBOR_LIMIT));
    const compatible = typeof options.compatible === "function" ? options.compatible : defaultCompatible;
    const cohortCompatible = typeof options.cohortCompatible === "function" ? options.cohortCompatible : compatible;
    const canPerceive = typeof options.canPerceive === "function" ? options.canPerceive : () => true;
    const source = (Array.isArray(actors) ? actors : [])
      .filter((actor) => actor && actor.id && cleanCell(actor.cell))
      .map((actor) => ({ ...actor, id: String(actor.id), cell: cleanCell(actor.cell) }))
      .sort(stableActorCompare);
    const byId = new Map(source.map((actor) => [actor.id, actor]));
    const buckets = new Map();
    const cellBuckets = new Map();
    for (const actor of source) {
      const key = actor.containerId
        ? `container:${actor.containerId}`
        : `room:${actor.roomId || ""}:z:${actor.cell.z}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(actor);
      if (!actor.containerId) {
        if (!cellBuckets.has(key)) cellBuckets.set(key, new Map());
        const cellKey = `${actor.cell.x},${actor.cell.y}`;
        const cells = cellBuckets.get(key);
        if (!cells.has(cellKey)) cells.set(cellKey, []);
        cells.get(cellKey).push(actor);
      }
    }

    const allNeighbors = new Map();
    for (const [bucketKey, members] of buckets.entries()) {
      for (const actor of members) {
        const candidates = actor.containerId
          ? members
          : (() => {
            const local = [];
            const cells = cellBuckets.get(bucketKey);
            for (let y = actor.cell.y - radius; y <= actor.cell.y + radius; y += 1) {
              for (let x = actor.cell.x - radius; x <= actor.cell.x + radius; x += 1) {
                local.push(...(cells.get(`${x},${y}`) || []));
              }
            }
            return local;
          })();
        const nearby = candidates
          .filter((other) => other.id !== actor.id && compatible(actor, other))
          .map((other) => ({ actor: other, distance: actor.containerId ? 0 : distance(actor.cell, other.cell) }))
          .filter((entry) => entry.distance <= radius && canPerceive(actor, entry.actor, entry.distance))
          .sort((left, right) => left.distance - right.distance || stableActorCompare(left.actor, right.actor));
        allNeighbors.set(actor.id, nearby);
      }
    }

    const parent = new Map(source.map((actor) => [actor.id, actor.id]));
    const find = (id) => {
      let current = parent.get(id);
      while (current && parent.get(current) !== current) current = parent.get(current);
      let cursor = id;
      while (parent.get(cursor) && parent.get(cursor) !== current) {
        const next = parent.get(cursor);
        parent.set(cursor, current);
        cursor = next;
      }
      return current || id;
    };
    const unite = (leftId, rightId) => {
      const leftRoot = find(leftId);
      const rightRoot = find(rightId);
      if (leftRoot === rightRoot) return;
      const first = [leftRoot, rightRoot].sort()[0];
      parent.set(leftRoot, first);
      parent.set(rightRoot, first);
    };
    for (const actor of source) {
      for (const entry of allNeighbors.get(actor.id) || []) {
        if (entry.distance <= linkRadius && cohortCompatible(actor, entry.actor)) unite(actor.id, entry.actor.id);
      }
    }

    const components = new Map();
    for (const actor of source) {
      const rootId = find(actor.id);
      if (!components.has(rootId)) components.set(rootId, []);
      components.get(rootId).push(actor.id);
    }
    for (const ids of components.values()) ids.sort();

    const contexts = {};
    for (const actor of source) {
      const nearby = allNeighbors.get(actor.id) || [];
      const memberIds = components.get(find(actor.id)) || [actor.id];
      contexts[actor.id] = {
        actorId: actor.id,
        cohortId: memberIds.length > 1 ? `cohort:${memberIds[0]}` : "",
        cohortSize: memberIds.length,
        memberIds: memberIds.filter((id) => id !== actor.id).slice(0, neighborLimit),
        nearbyIds: nearby.slice(0, neighborLimit).map((entry) => entry.actor.id),
        localCount: nearby.length,
        detailedCount: Math.min(nearby.length, neighborLimit),
        truncatedCount: Math.max(0, nearby.length - neighborLimit),
        densityCount: nearby.length,
        nearestDistance: nearby[0]?.distance ?? null
      };
    }

    return {
      contexts,
      cohorts: [...components.values()]
        .filter((ids) => ids.length > 1)
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map((ids) => ({ id: `cohort:${ids[0]}`, memberIds: [...ids], size: ids.length })),
      actorCount: source.length,
      maxDetailedNeighbors: Math.max(0, ...Object.values(contexts).map((context) => context.detailedCount)),
      radius,
      linkRadius,
      neighborLimit,
      byId
    };
  }

  function benchmarkPopulation(count = 250) {
    const total = Math.max(1, Math.floor(Number(count) || 250));
    const actors = Array.from({ length: total }, (_entry, index) => ({
      id: `slime-${String(index).padStart(4, "0")}`,
      roomId: `room-${Math.floor(index / 125)}`,
      cell: { x: index % 25, y: Math.floor(index / 25) % 10, z: 0 }
    }));
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const result = buildLocalContexts(actors);
    const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      actorCount: result.actorCount,
      cohortCount: result.cohorts.length,
      maxDetailedNeighbors: result.maxDetailedNeighbors,
      neighborLimit: result.neighborLimit,
      elapsedMs: endedAt - startedAt
    };
  }

  return {
    COHORT_LINK_RADIUS,
    DETAILED_NEIGHBOR_LIMIT,
    LOCAL_RADIUS,
    benchmarkPopulation,
    buildLocalContexts,
    distance
  };
}));
