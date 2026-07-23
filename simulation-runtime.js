(function attachHelixSimulation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixSimulation = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixSimulation() {
  "use strict";

  const EPSILON = 1e-6;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function stableCompare(left, right) {
    return finiteNumber(left.dueAt) - finiteNumber(right.dueAt)
      || finiteNumber(left.priority) - finiteNumber(right.priority)
      || String(left.entityId || "").localeCompare(String(right.entityId || ""))
      || String(left.id || "").localeCompare(String(right.id || ""));
  }

  function normalizeCadenceState(definitions, candidate = {}, clock = 0) {
    const now = finiteNumber(clock);
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return Object.fromEntries((definitions || []).map((definition) => {
      const id = String(definition.id || "");
      const interval = Math.max(EPSILON, finiteNumber(definition.interval, 1));
      const saved = source[id] && typeof source[id] === "object" ? source[id] : {};
      const lastRunAt = Math.min(now, finiteNumber(saved.lastRunAt, now));
      const defaultNext = lastRunAt + interval;
      const nextRunAt = Math.max(lastRunAt, finiteNumber(saved.nextRunAt, defaultNext));
      return [id, { lastRunAt, nextRunAt }];
    }));
  }

  function collectDueCadences(definitions, cadenceState, fromClock, toClock, options = {}) {
    const from = finiteNumber(fromClock);
    const to = Math.max(from, finiteNumber(toClock, from));
    const force = Boolean(options.force);
    const normalized = normalizeCadenceState(definitions, cadenceState, from);
    const due = [];

    for (const definition of definitions || []) {
      const id = String(definition.id || "");
      if (!id) continue;
      const interval = Math.max(EPSILON, finiteNumber(definition.interval, 1));
      const record = normalized[id];
      if (!force && to + EPSILON < record.nextRunAt) continue;
      due.push({
        ...definition,
        id,
        elapsed: Math.max(0, to - record.lastRunAt),
        dueAt: record.nextRunAt
      });
      record.lastRunAt = to;
      if (force) {
        record.nextRunAt = to + interval;
      } else {
        const intervalsPassed = Math.max(1, Math.floor((to - record.nextRunAt) / interval) + 1);
        record.nextRunAt += intervalsPassed * interval;
      }
    }

    due.sort((left, right) => finiteNumber(left.priority) - finiteNumber(right.priority)
      || finiteNumber(left.dueAt) - finiteNumber(right.dueAt)
      || String(left.id).localeCompare(String(right.id)));
    return { due, state: normalized };
  }

  function createEventQueue(events = []) {
    const records = new Map();

    function schedule(event) {
      const id = String(event?.id || "");
      if (!id) throw new Error("Scheduled events require an id.");
      const normalized = {
        ...event,
        id,
        dueAt: finiteNumber(event.dueAt),
        priority: finiteNumber(event.priority),
        entityId: String(event.entityId || "")
      };
      records.set(id, normalized);
      return { ...normalized };
    }

    function cancel(id) {
      return records.delete(String(id || ""));
    }

    function takeDue(clock) {
      const now = finiteNumber(clock);
      const due = [...records.values()].filter((event) => event.dueAt <= now + EPSILON).sort(stableCompare);
      for (const event of due) records.delete(event.id);
      return due.map((event) => ({ ...event }));
    }

    function peek() {
      const first = [...records.values()].sort(stableCompare)[0];
      return first ? { ...first } : null;
    }

    function snapshot() {
      return [...records.values()].sort(stableCompare).map((event) => ({ ...event }));
    }

    for (const event of events || []) schedule(event);
    return { schedule, cancel, takeDue, peek, snapshot, get size() { return records.size; } };
  }

  function createSpatialIndex(options = {}) {
    const cellFor = typeof options.cellFor === "function" ? options.cellFor : (record) => record?.cell;
    const cellsFor = typeof options.cellsFor === "function" ? options.cellsFor : (record) => [cellFor(record)];
    const roomFor = typeof options.roomFor === "function" ? options.roomFor : (record) => record?.roomId;
    const containerFor = typeof options.containerFor === "function" ? options.containerFor : (record) => record?.containerId;
    const idFor = typeof options.idFor === "function" ? options.idFor : (record) => record?.id;
    const byId = new Map();
    const byCell = new Map();
    const byRoom = new Map();
    const byContainer = new Map();
    let revision = 0;

    function cleanCell(cell) {
      if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) return null;
      return { x: Math.round(Number(cell.x)), y: Math.round(Number(cell.y)), z: Math.round(finiteNumber(cell.z)) };
    }

    function cellKey(cell) {
      const clean = cleanCell(cell);
      return clean ? `${clean.x},${clean.y},${clean.z}` : "";
    }

    function addTo(map, key, record) {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(record);
    }

    function rebuild(records = []) {
      byId.clear();
      byCell.clear();
      byRoom.clear();
      byContainer.clear();
      for (const record of records || []) {
        const id = String(idFor(record) || "");
        if (!id) continue;
        byId.set(id, record);
        const occupiedKeys = new Set((cellsFor(record) || []).map(cellKey).filter(Boolean));
        for (const key of occupiedKeys) addTo(byCell, key, record);
        addTo(byRoom, String(roomFor(record) || ""), record);
        addTo(byContainer, String(containerFor(record) || ""), record);
      }
      revision += 1;
      return revision;
    }

    function recordsAtCell(cell) {
      return [...(byCell.get(cellKey(cell)) || [])];
    }

    function recordsInRoom(roomId) {
      return [...(byRoom.get(String(roomId || "")) || [])];
    }

    function recordsInContainer(containerId) {
      return [...(byContainer.get(String(containerId || "")) || [])];
    }

    function recordsInRadius(cell, radius) {
      const origin = cleanCell(cell);
      if (!origin) return [];
      const distance = Math.max(0, Math.ceil(finiteNumber(radius)));
      const found = new Map();
      for (let y = origin.y - distance; y <= origin.y + distance; y += 1) {
        for (let x = origin.x - distance; x <= origin.x + distance; x += 1) {
          for (const record of byCell.get(`${x},${y},${origin.z}`) || []) {
            found.set(String(idFor(record)), record);
          }
        }
      }
      return [...found.values()];
    }

    function snapshot() {
      return {
        revision,
        records: byId.size,
        occupiedCells: byCell.size,
        rooms: byRoom.size,
        containers: byContainer.size
      };
    }

    return { rebuild, recordsAtCell, recordsInRoom, recordsInContainer, recordsInRadius, snapshot };
  }

  return {
    EPSILON,
    collectDueCadences,
    createEventQueue,
    createSpatialIndex,
    normalizeCadenceState,
    stableCompare
  };
}));
