(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWildernessDiscovery = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const BOUNDS = Object.freeze({ x: 21, y: 8, z: 6, width: 16, height: 12 });
  const ENTRY = Object.freeze({ x: 22, y: 12, z: 6 });
  const copy = value => JSON.parse(JSON.stringify(value));
  const key = cell => `${cell.x},${cell.y},${cell.z}`;
  function hash(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function create(destination) { return { placeId: destination.id, label: destination.label, baseline: null, records: [] }; }
  function cellsWithout(rocks) {
    const blocked = new Set(rocks.map(key)), cells = [];
    for (let y = BOUNDS.y; y < BOUNDS.y + BOUNDS.height; y++) {
      for (let x = BOUNDS.x; x < BOUNDS.x + BOUNDS.width; x++) {
        const cell = { x, y, z: BOUNDS.z };
        if (!blocked.has(key(cell))) cells.push(cell);
      }
    }
    return cells;
  }
  function connected(cells) {
    const allowed = new Set(cells.map(key)), reached = new Set([key(ENTRY)]), queue = [ENTRY];
    if (!allowed.has(key(ENTRY))) return false;
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: cell.x + dx, y: cell.y + dy, z: cell.z }, id = key(next);
        if (allowed.has(id) && !reached.has(id)) { reached.add(id); queue.push(next); }
      }
    }
    return reached.size === allowed.size;
  }
  function materialize(state, worldId, worldSeed, destination, clock, existingCells = null) {
    if (!state || state.baseline) return state?.baseline;
    const seed = hash(`${worldSeed}:${state.placeId}:boundary-ground`), rocks = [];
    const broken = Number(destination.slopePercent) > 15;
    const clearing = { x: 30 + seed % 5, y: 9 + (seed >>> 5) % 2, z: 6 };
    const count = broken ? 14 : 6;
    // Reserve the entrance and a cross-sector withdrawal lane. All remaining
    // ground must remain connected; rocks are surface obstacles, never ore.
    for (let i = 0; rocks.length < count && i < 100; i++) {
      const n = hash(`${seed}:rock:${i}`);
      const cell = { x: broken && i < 5 ? 28 + seed % 3 : 26 + n % 10, y: 8 + (n >>> 8) % 12, z: 6 };
      if (cell.y === 12 || key(cell) === key(clearing) || rocks.some(rock => key(rock) === key(cell))) continue;
      if (connected(cellsWithout([...rocks, cell]))) rocks.push(cell);
    }
    // An already visited older save keeps its actual footprint, including
    // physical changes. Never insert new obstacles under bodies or property.
    const retained = existingCells?.length ? copy(existingCells) : null;
    const cells = retained || cellsWithout(rocks);
    const physicalRocks = retained ? [] : rocks;
    const landmarks = [
      { id: "entrance-ground", cell: { x: 24, y: 12, z: 6 }, text: broken ? "Broken ground beyond the defended entrance" : "Gentle ground beyond the defended entrance" },
      { id: "bare-clearing", cell: clearing, text: "Bare surface clearing; appearance alone establishes no deposits" }
    ].filter(row => cells.some(cell => key(cell) === key(row.cell)));
    if (physicalRocks.length) landmarks.push({ id: "weathered-rock", cell: physicalRocks.at(-1), text: "Weathered rock outcrop; blocks walking and sight" });
    state.baseline = { worldId, placeId: state.placeId, bounds: copy(BOUNDS), cells, rocks: physicalRocks, landmarks, terrain: broken ? "broken ground" : "gentle ground", materializedAt: clock };
    return state.baseline;
  }
  function obstacleAt(state, cell) { return Boolean(state?.baseline?.rocks.some(rock => key(rock) === key(cell))); }
  function observe(state, clock, observer, canSee, hasFloor) {
    if (!state?.baseline || observer?.z !== BOUNDS.z) return;
    for (const landmark of state.baseline.landmarks) {
      if (Math.max(Math.abs(observer.x - landmark.cell.x), Math.abs(observer.y - landmark.cell.y)) > 5 || !canSee(landmark.cell)) continue;
      const text = landmark.id === "weathered-rock" && hasFloor(landmark.cell) ? "Previously observed rock outcrop cleared" : landmark.text;
      if (state.records.filter(row => row.subject === landmark.id).at(-1)?.text === text) continue;
      state.records.push({ id: `boundary-observation-${state.records.length}`, subject: landmark.id, kind: "directObservation", source: "Scientist boundary observation", at: clock, cell: copy(landmark.cell), text });
    }
  }
  function publicView(state) {
    if (!state) return null;
    return { placeId: state.placeId, label: state.label, records: copy(state.records), limitations: "Dated, directly observed surface landmarks—not live telemetry, a mineral survey, safe passage, ownership, or permission to extract resources. Unseen terrain and creatures remain unknown." };
  }
  return { BOUNDS, ENTRY, create, materialize, connected, obstacleAt, observe, publicView };
}));
