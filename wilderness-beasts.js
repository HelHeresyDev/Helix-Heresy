(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWildernessBeasts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ROOM = "wildernessSurveySector";
  const PROFILES = Object.freeze({
    "beast:rimefang-pack": { name: "Rimefang", disposition: "predator", health: 48, damage: 6, barrierKinds: ["door"], damageTypes: ["physical", "cold"], stepSeconds: 1.5, recovery: 8, sight: 8, track: "Frost-rimmed paw prints", sound: "Distant growling" },
    "beast:gravebloom-elk": { name: "Gravebloom Elk", disposition: "territorial", health: 60, damage: 8, barrierKinds: ["door", "constructedWall"], damageTypes: ["physical"], stepSeconds: 2, recovery: 10, sight: 7, track: "Hoof prints among luminous flowers", sound: "Heavy rustling and a low call" }
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const key = (cell) => `${cell.x},${cell.y},${cell.z}`;
  const distance = (a, b) => !a || !b || a.z !== b.z ? Infinity : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  function random(seed) { let n = 2166136261; for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; }
  function defaultState() { return { materialized: false, siteId: "", actors: [], tracks: [], sightings: {}, heard: null, noticeSerial: 0, lastAt: 0 }; }
  function normalizeState(candidate) { return { ...defaultState(), ...clone(candidate || {}) }; }
  function actor(speciesId, id, cell, populationId, at = 0) {
    const profile = PROFILES[speciesId];
    return { id, actorKind: "wildernessBeast", speciesId, populationId, name: `${profile.name} ${id.split(":").pop()}`, roomId: ROOM, mapCell: clone(cell), homeCell: clone(cell), health: profile.health, maxHealth: profile.health, status: "alive", behavior: "roam", lastTarget: null, rememberedUntil: 0, nextMoveAt: at + profile.stepSeconds, nextAttackAt: at + profile.recovery, provokedUntil: 0, patrolIndex: 0 };
  }
  function materialize(seed, siteId, populations, cells, at = 0) {
    const state = { ...defaultState(), materialized: true, siteId, lastAt: at };
    const available = [...cells].filter((c) => c.x >= 28).sort((a, b) => key(a).localeCompare(key(b)));
    for (const population of [...populations].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!PROFILES[population.speciesId] || state.actors.length >= 4 || !available.length) continue;
      // A regional presence is not a guarantee of an animal in this tiny boundary sector.
      const chance = Math.max(.15, Math.min(.8, population.populationIndex / 1000));
      if (random(`${seed}:${siteId}:${population.id}:presence`) >= chance) continue;
      const count = Math.min(2, 4 - state.actors.length, available.length);
      for (let i = 0; i < count; i++) {
        const index = Math.floor(random(`${seed}:${siteId}:${population.id}:${i}:place`) * available.length);
        const cell = available.splice(index, 1)[0], id = `field-beast:${siteId}:${state.actors.length + 1}`;
        state.actors.push(actor(population.speciesId, id, cell, population.id, at));
        state.tracks.push({ id: `track:${id}`, cell: clone(cell), label: PROFILES[population.speciesId].track, observedAt: null });
      }
    }
    return state;
  }
  function neighbors(cell) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ x: cell.x + x, y: cell.y + y, z: cell.z })); }
  function nextStep(from, goal, canEnter) {
    if (!goal || key(from) === key(goal)) return null;
    const queue = [{ cell: from, first: null }], visited = new Set([key(from)]);
    for (let i = 0; i < queue.length && i < 512; i++) {
      const current = queue[i];
      for (const cell of neighbors(current.cell)) {
        if (visited.has(key(cell)) || !canEnter(cell)) continue;
        const first = current.first || cell;
        if (key(cell) === key(goal)) return first;
        visited.add(key(cell)); queue.push({ cell, first });
      }
    }
    return null;
  }
  function decide(beast, scientist, at, sees, hears) {
    const profile = PROFILES[beast.speciesId];
    if (beast.status === "dead") return { behavior: "dead", goal: null };
    if (sees) { beast.lastTarget = clone(scientist); beast.rememberedUntil = at + 12; }
    else if (hears && at >= beast.rememberedUntil) { beast.lastTarget = clone(scientist); beast.rememberedUntil = at + 6; }
    const afraid = beast.health < beast.maxHealth * .3;
    if (afraid && beast.lastTarget && at <= beast.rememberedUntil) return { behavior: "flee", goal: beast.lastTarget };
    const territorial = profile.disposition === "territorial";
    if (sees && (!territorial || distance(scientist, beast.homeCell) <= 3 || at < beast.provokedUntil)) return { behavior: "pursue", goal: beast.lastTarget };
    if (beast.lastTarget && at < beast.rememberedUntil && (!territorial || at < beast.provokedUntil)) return { behavior: sees ? "pursue" : "investigate", goal: beast.lastTarget };
    return { behavior: distance(beast.mapCell, beast.homeCell) > 2 ? "return" : "roam", goal: beast.homeCell };
  }
  // This is capability, not a command to attack. The caller must first find
  // an obstructed route to the perceived/remembered goal, trying open routes
  // first. These ordinary animals cannot siege masonry, metal or wards.
  function canBreach(beast, decision, barrier, at) {
    const p = PROFILES[beast?.speciesId], c = barrier?.composition;
    return Boolean(p && beast.status !== 'dead' && beast.health >= beast.maxHealth * .3
      && ['pursue', 'investigate'].includes(decision?.behavior) && decision.goal && beast.lastTarget
      && key(decision.goal) === key(beast.lastTarget) && at < beast.rememberedUntil
      && (beast.effortSeconds == null || beast.effortSeconds > 0)
      && p.barrierKinds.includes(barrier?.kind) && barrier.closed && barrier.condition > 0
      && c?.primary === 'wood' && !c.reinforcement && !c.lining && !c.coating && !c.seal && !barrier.warded);
  }
  function barrierStrike(beast, decision, barrier, at) {
    if (!canBreach(beast, decision, barrier, at) || at < beast.nextAttackAt
      || beast.mapCell.z !== barrier.cell?.z
      || Math.abs(beast.mapCell.x - barrier.cell.x) + Math.abs(beast.mapCell.y - barrier.cell.y) !== 1) return null;
    return { damage: PROFILES[beast.speciesId].damage, damageTypes: ['physical'], recovery: PROFILES[beast.speciesId].recovery };
  }
  function publicKnowledge(state, visibleIds = []) {
    const visible = new Set(visibleIds);
    return { sightings: Object.values(state.sightings).map((entry) => ({ ...clone(entry), current: visible.has(entry.id) })), tracks: state.tracks.filter((track) => track.observedAt != null).map(clone), heard: state.heard ? clone(state.heard) : null };
  }
  return { ROOM, PROFILES, defaultState, normalizeState, actor, materialize, nextStep, neighbors, decide, canBreach, barrierStrike, publicKnowledge, distance, key };
});
