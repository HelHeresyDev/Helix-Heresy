(function attachHelixNavigation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixNavigation = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixNavigation() {
  "use strict";

  const CARDINAL_DIRECTIONS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanCell(value) {
    if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) {
      return null;
    }
    return { x: Math.round(Number(value.x)), y: Math.round(Number(value.y)) };
  }

  function cellKey(cell) {
    return `${cell.x},${cell.y}`;
  }

  function stateKey(cell, orientation = "square") {
    return `${cell.x},${cell.y},${orientation}`;
  }

  function manhattan(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
  }

  function normalizeFootprint(candidate = {}) {
    const width = Math.max(1, Math.ceil(finiteNumber(candidate.width, 1)));
    const height = Math.max(1, Math.ceil(finiteNumber(candidate.height, 1)));
    return {
      width,
      height,
      orientation: width === height ? "square" : candidate.orientation === "vertical" ? "vertical" : "horizontal",
      rotatable: width !== height && candidate.rotatable !== false,
      exclusive: Boolean(candidate.exclusive || width > 1 || height > 1),
      loadM2: Math.max(0.001, finiteNumber(candidate.loadM2, 1))
    };
  }

  function orientedDimensions(footprint, orientation = footprint.orientation) {
    if (orientation === "vertical" && footprint.width !== footprint.height) {
      return { width: footprint.height, height: footprint.width };
    }
    return { width: footprint.width, height: footprint.height };
  }

  function footprintCells(anchor, footprintCandidate = {}, orientation = "") {
    const clean = cleanCell(anchor);
    if (!clean) return [];
    const footprint = normalizeFootprint(footprintCandidate);
    const resolvedOrientation = orientation || footprint.orientation;
    const dimensions = orientedDimensions(footprint, resolvedOrientation);
    const cells = [];
    for (let y = 0; y < dimensions.height; y += 1) {
      for (let x = 0; x < dimensions.width; x += 1) {
        cells.push({ x: clean.x + x, y: clean.y + y });
      }
    }
    return cells;
  }

  class BinaryHeap {
    constructor(compare) {
      this.items = [];
      this.compare = compare;
    }

    get size() {
      return this.items.length;
    }

    push(value) {
      const items = this.items;
      items.push(value);
      let index = items.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.compare(items[parent], value) <= 0) break;
        items[index] = items[parent];
        index = parent;
      }
      items[index] = value;
    }

    pop() {
      const items = this.items;
      if (!items.length) return null;
      const rootValue = items[0];
      const tail = items.pop();
      if (!items.length) return rootValue;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        let child = left;
        if (right < items.length && this.compare(items[right], items[left]) < 0) child = right;
        if (this.compare(tail, items[child]) <= 0) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = tail;
      return rootValue;
    }
  }

  class LruCache {
    constructor(limit = 256) {
      this.limit = Math.max(1, Math.floor(finiteNumber(limit, 256)));
      this.entries = new Map();
    }

    get(key) {
      if (!this.entries.has(key)) return null;
      const value = this.entries.get(key);
      this.entries.delete(key);
      this.entries.set(key, value);
      return value;
    }

    set(key, value) {
      if (this.entries.has(key)) this.entries.delete(key);
      this.entries.set(key, value);
      while (this.entries.size > this.limit) {
        this.entries.delete(this.entries.keys().next().value);
      }
    }

    clear() {
      this.entries.clear();
    }

    get size() {
      return this.entries.size;
    }
  }

  function reconstructPath(goalKey, records) {
    const steps = [];
    let key = goalKey;
    while (key && records.has(key)) {
      const record = records.get(key);
      steps.push({
        cell: { ...record.cell },
        orientation: record.orientation,
        action: record.action || "start"
      });
      key = record.parentKey;
    }
    steps.reverse();
    const path = [];
    for (const step of steps) {
      if (!path.length || cellKey(path[path.length - 1]) !== cellKey(step.cell)) {
        path.push({ ...step.cell });
      }
    }
    return { path, steps };
  }

  function findPath(options = {}) {
    const start = cleanCell(options.start);
    const goal = cleanCell(options.goal);
    if (!start || !goal) {
      return { found: false, path: [], steps: [], cost: Infinity, visited: 0, reason: "invalid endpoint" };
    }
    const width = Math.max(1, Math.floor(finiteNumber(options.width, 1)));
    const height = Math.max(1, Math.floor(finiteNumber(options.height, 1)));
    const footprint = normalizeFootprint(options.footprint);
    const startOrientation = footprint.orientation;
    const canOccupy = typeof options.canOccupy === "function" ? options.canOccupy : () => true;
    const stepCost = typeof options.stepCost === "function" ? options.stepCost : () => 1;
    const heuristic = typeof options.heuristic === "function" ? options.heuristic : manhattan;
    const maxVisited = Math.max(1, Math.floor(finiteNumber(options.maxVisited, width * height * 2)));
    const inBounds = (cell, orientation) => footprintCells(cell, footprint, orientation)
      .every((part) => part.x >= 0 && part.y >= 0 && part.x < width && part.y < height);
    const goalOrientations = footprint.rotatable
      ? [startOrientation, startOrientation === "vertical" ? "horizontal" : "vertical"]
      : [startOrientation];
    const goalFits = goalOrientations.some((orientation) => inBounds(goal, orientation) && canOccupy(goal, orientation, true));
    if (!inBounds(start, startOrientation) || !goalFits || !canOccupy(start, startOrientation, true)) {
      return { found: false, path: [], steps: [], cost: Infinity, visited: 0, reason: "endpoint is not occupiable" };
    }

    let sequence = 0;
    const open = new BinaryHeap((left, right) => left.f - right.f || left.h - right.h || left.sequence - right.sequence);
    const startKey = stateKey(start, startOrientation);
    const records = new Map([[startKey, {
      cell: start,
      orientation: startOrientation,
      g: 0,
      parentKey: "",
      action: "start"
    }]]);
    const closed = new Set();
    open.push({ key: startKey, cell: start, orientation: startOrientation, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), sequence: sequence++ });

    while (open.size && closed.size < maxVisited) {
      const current = open.pop();
      if (!current || closed.has(current.key)) continue;
      closed.add(current.key);
      if (current.cell.x === goal.x && current.cell.y === goal.y) {
        const reconstructed = reconstructPath(current.key, records);
        return {
          found: true,
          ...reconstructed,
          cost: current.g,
          visited: closed.size,
          reason: ""
        };
      }

      const candidates = CARDINAL_DIRECTIONS.map((direction) => ({
        cell: { x: current.cell.x + direction.x, y: current.cell.y + direction.y },
        orientation: current.orientation,
        action: "move"
      }));
      if (footprint.rotatable) {
        candidates.push({
          cell: { ...current.cell },
          orientation: current.orientation === "vertical" ? "horizontal" : "vertical",
          action: "rotate"
        });
      }

      for (const candidate of candidates) {
        if (!inBounds(candidate.cell, candidate.orientation)) continue;
        const isGoal = candidate.cell.x === goal.x && candidate.cell.y === goal.y;
        if (!canOccupy(candidate.cell, candidate.orientation, isGoal)) continue;
        const candidateKey = stateKey(candidate.cell, candidate.orientation);
        if (closed.has(candidateKey)) continue;
        const cost = Math.max(0.001, finiteNumber(stepCost(current, candidate), candidate.action === "rotate" ? 0.5 : 1));
        const nextG = current.g + cost;
        const existing = records.get(candidateKey);
        if (existing && existing.g <= nextG) continue;
        const h = heuristic(candidate.cell, goal);
        records.set(candidateKey, {
          cell: candidate.cell,
          orientation: candidate.orientation,
          g: nextG,
          parentKey: current.key,
          action: candidate.action
        });
        open.push({ key: candidateKey, cell: candidate.cell, orientation: candidate.orientation, g: nextG, h, f: nextG + h, sequence: sequence++ });
      }
    }

    return {
      found: false,
      path: [],
      steps: [],
      cost: Infinity,
      visited: closed.size,
      reason: closed.size >= maxVisited ? "search limit reached" : "no route"
    };
  }

  function cloneResult(result, cached = false) {
    return {
      ...result,
      path: (result.path || []).map((cell) => ({ ...cell })),
      steps: (result.steps || []).map((step) => ({ ...step, cell: { ...step.cell } })),
      cached
    };
  }

  class NavigationService {
    constructor(options = {}) {
      this.cache = new LruCache(options.cacheLimit || 256);
      this.stats = { searches: 0, cacheHits: 0, visited: 0, failures: 0 };
    }

    findPath(options = {}, cacheKeyValue = "") {
      const key = String(cacheKeyValue || "");
      if (key) {
        const cached = this.cache.get(key);
        const valid = cached && (!options.validatePath || options.validatePath(cached.path, cached.steps));
        if (valid) {
          this.stats.cacheHits += 1;
          return cloneResult(cached, true);
        }
      }
      const result = findPath(options);
      this.stats.searches += 1;
      this.stats.visited += result.visited;
      if (!result.found) this.stats.failures += 1;
      if (key && result.found) this.cache.set(key, cloneResult(result));
      return cloneResult(result);
    }

    clear() {
      this.cache.clear();
    }

    snapshot() {
      return { ...this.stats, cacheSize: this.cache.size };
    }
  }

  function intervalsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  class ReservationTable {
    constructor(options = {}) {
      this.capacity = Math.max(0.01, finiteNumber(options.capacity, 1));
      this.byCell = new Map();
    }

    prune(now) {
      const at = finiteNumber(now, 0);
      for (const [key, entries] of this.byCell.entries()) {
        const active = entries.filter((entry) => entry.endAt > at);
        if (active.length) this.byCell.set(key, active);
        else this.byCell.delete(key);
      }
    }

    clear() {
      this.byCell.clear();
    }

    releaseActor(actorId) {
      const id = String(actorId || "");
      if (!id) return;
      for (const [key, entries] of this.byCell.entries()) {
        const remaining = entries.filter((entry) => entry.actorId !== id);
        if (remaining.length) this.byCell.set(key, remaining);
        else this.byCell.delete(key);
      }
    }

    conflicts(request = {}) {
      const actorId = String(request.actorId || "");
      const startAt = finiteNumber(request.startAt, 0);
      const endAt = Math.max(startAt + 0.001, finiteNumber(request.endAt, startAt + 1));
      const loadM2 = Math.max(0.001, finiteNumber(request.loadM2, 1));
      const exclusive = Boolean(request.exclusive);
      const conflicts = [];
      for (const cell of request.cells || []) {
        const key = cellKey(cell);
        const overlapping = (this.byCell.get(key) || []).filter((entry) => entry.actorId !== actorId
          && intervalsOverlap(startAt, endAt, entry.startAt, entry.endAt));
        const used = overlapping.reduce((total, entry) => total + entry.loadM2, 0);
        if ((exclusive && overlapping.length) || overlapping.some((entry) => entry.exclusive) || used + loadM2 > this.capacity + 0.0001) {
          conflicts.push(...overlapping.map((entry) => ({ ...entry, cell: { ...cell } })));
        }
      }
      return conflicts;
    }

    tryReserve(request = {}) {
      const conflicts = this.conflicts(request);
      const priority = finiteNumber(request.priority, 0);
      const canPreempt = Boolean(request.preempt) && conflicts.length && conflicts.every((entry) => priority > entry.priority);
      if (conflicts.length && !canPreempt) {
        return { ok: false, conflicts };
      }
      if (canPreempt) {
        for (const actorId of new Set(conflicts.map((entry) => entry.actorId))) this.releaseActor(actorId);
      }
      this.releaseActor(request.actorId);
      const entry = {
        actorId: String(request.actorId || ""),
        startAt: finiteNumber(request.startAt, 0),
        endAt: Math.max(finiteNumber(request.startAt, 0) + 0.001, finiteNumber(request.endAt, 1)),
        loadM2: Math.max(0.001, finiteNumber(request.loadM2, 1)),
        exclusive: Boolean(request.exclusive),
        priority,
        intent: String(request.intent || "move")
      };
      for (const cell of request.cells || []) {
        const key = cellKey(cell);
        const entries = this.byCell.get(key) || [];
        entries.push(entry);
        this.byCell.set(key, entries);
      }
      return { ok: true, conflicts: [], preempted: canPreempt };
    }

    snapshot(now = -Infinity) {
      const rows = [];
      for (const [key, entries] of this.byCell.entries()) {
        for (const entry of entries) {
          if (entry.endAt <= now) continue;
          rows.push({ cellKey: key, ...entry });
        }
      }
      return rows.sort((left, right) => left.startAt - right.startAt || right.priority - left.priority || left.actorId.localeCompare(right.actorId));
    }
  }

  return {
    CARDINAL_DIRECTIONS,
    LruCache,
    NavigationService,
    ReservationTable,
    cellKey,
    cleanCell,
    findPath,
    footprintCells,
    manhattan,
    normalizeFootprint,
    stateKey
  };
}));
