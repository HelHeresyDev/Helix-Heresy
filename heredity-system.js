(function attachHelixHereditySystem(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixHereditySystem = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixHereditySystem() {
  "use strict";

  const VERSION = 1;
  const BASES = Object.freeze(["A", "C", "G", "T"]);
  const METHODS = Object.freeze([
    Object.freeze({ id: "naturalDivision", label: "Natural Division", parentCount: 1, controlled: false, baseMutationChance: 0.38 }),
    Object.freeze({ id: "inducedDivision", label: "Induced Division", parentCount: 1, controlled: true, baseMutationChance: 0.12 }),
    Object.freeze({ id: "forcedRecombination", label: "Forced Recombination", parentCount: 2, controlled: true, baseMutationChance: 0.3 })
  ]);
  const METHOD_BY_ID = Object.freeze(Object.fromEntries(METHODS.map((entry) => [entry.id, entry])));
  const PRIORITIES = Object.freeze([
    Object.freeze({ id: "fidelity", label: "Fidelity", mutationDelta: -0.1, description: "Favor faithful inheritance and lower parent strain." }),
    Object.freeze({ id: "balanced", label: "Balanced", mutationDelta: 0, description: "Accept ordinary recombination variability." }),
    Object.freeze({ id: "novelty", label: "Novelty", mutationDelta: 0.28, description: "Invite additional mutation at greater biological strain." })
  ]);
  const PRIORITY_BY_ID = Object.freeze(Object.fromEntries(PRIORITIES.map((entry) => [entry.id, entry])));

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }
  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }
  function cleanGenome(value) {
    return String(value || "").toUpperCase().replace(/[^ACGT]/g, "");
  }
  function clone(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return fallback; }
  }
  function hashSeed(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function seededRng(seed) {
    let value = hashSeed(seed) || 1;
    return function nextRandom() {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }
  function mutationBand(chance) {
    const value = clamp(chance, 0, 1);
    if (value < 0.16) return { id: "stable", label: "Stable" };
    if (value < 0.38) return { id: "variable", label: "Variable" };
    if (value < 0.66) return { id: "unstable", label: "Unstable" };
    return { id: "chaotic", label: "Chaotic" };
  }
  function mutationChance(options = {}) {
    const method = METHOD_BY_ID[options.methodId] || METHOD_BY_ID.naturalDivision;
    const priority = PRIORITY_BY_ID[options.priorityId] || PRIORITY_BY_ID.balanced;
    let chance = method.baseMutationChance + priority.mutationDelta;
    chance += (clamp(options.stabilityRisk, 1, 10) - 5) * 0.035;
    chance += clamp(options.stress, 0, 100) / 100 * 0.14;
    chance += (100 - clamp(options.integrity, 0, 100)) / 100 * 0.12;
    chance += clamp(options.contamination, 0, 100) / 100 * 0.08;
    chance += Math.abs(clamp(options.ambientMana, 0, 100) - 50) / 100 * 0.08;
    return clamp(chance, 0.02, 0.92);
  }
  function methodMutationBand(methodId, priorityId = "balanced") {
    const method = METHOD_BY_ID[methodId] || METHOD_BY_ID.naturalDivision;
    const priority = PRIORITY_BY_ID[priorityId] || PRIORITY_BY_ID.balanced;
    return mutationBand(clamp(method.baseMutationChance + priority.mutationDelta, 0.02, 0.92));
  }
  function contributionRanges(owners, parentIds) {
    if (!owners.length) return [];
    const ranges = [];
    let start = 0;
    for (let index = 1; index <= owners.length; index += 1) {
      if (index < owners.length && owners[index] === owners[start]) continue;
      ranges.push({ parentId: cleanId(parentIds[owners[start]]) || `parent-${owners[start] + 1}`, start: start + 1, end: index });
      start = index;
    }
    return ranges;
  }
  function recombinedGenome(parents, priorityId, rng) {
    const length = parents[0].genome.length;
    if (parents.length < 2) {
      return { genome: parents[0].genome, owners: Array(length).fill(0) };
    }
    const desiredSwitches = priorityId === "fidelity" ? 1 : priorityId === "novelty" ? 3 : 2;
    const candidates = Array.from({ length: Math.max(0, length - 5) }, (_, index) => index + 3);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
    }
    const switches = candidates.slice(0, Math.min(desiredSwitches, candidates.length)).sort((a, b) => a - b);
    const owners = [];
    let owner = rng() < 0.5 ? 0 : 1;
    for (let index = 0; index < length; index += 1) {
      if (switches.includes(index)) owner = owner === 0 ? 1 : 0;
      owners.push(owner);
    }
    return { genome: owners.map((parentIndex, index) => parents[parentIndex].genome[index]).join(""), owners };
  }
  function inheritGenome(options = {}) {
    const method = METHOD_BY_ID[options.methodId] || METHOD_BY_ID.naturalDivision;
    const priority = PRIORITY_BY_ID[options.priorityId] || PRIORITY_BY_ID.balanced;
    const parents = (Array.isArray(options.parents) ? options.parents : [])
      .map((entry, index) => ({ id: cleanId(entry?.id) || `parent-${index + 1}`, genome: cleanGenome(entry?.genome) }))
      .filter((entry) => entry.genome);
    if (!parents.length) return null;
    const length = Math.min(...parents.map((entry) => entry.genome.length));
    if (!length) return null;
    for (const parent of parents) parent.genome = parent.genome.slice(0, length);
    const rng = seededRng(options.seed);
    const inherited = method.id === "forcedRecombination"
      ? recombinedGenome(parents.slice(0, 2), priority.id, rng)
      : { genome: parents[0].genome, owners: Array(length).fill(0) };
    const chance = mutationChance({ ...options, methodId: method.id, priorityId: priority.id });
    let mutationCount = rng() < chance ? 1 : 0;
    const maximum = priority.id === "novelty" ? 4 : 3;
    while (mutationCount < maximum && rng() < chance * (0.42 - mutationCount * 0.06)) mutationCount += 1;
    const characters = inherited.genome.split("");
    const positions = Array.from({ length }, (_, index) => index);
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [positions[index], positions[swap]] = [positions[swap], positions[index]];
    }
    const mutations = [];
    for (const position of positions.slice(0, mutationCount).sort((a, b) => a - b)) {
      const from = characters[position];
      const choices = BASES.filter((base) => base !== from);
      const to = choices[Math.floor(rng() * choices.length)];
      characters[position] = to;
      mutations.push({ position: position + 1, from, to });
    }
    return {
      genome: characters.join(""),
      methodId: method.id,
      priorityId: priority.id,
      mutationChance: chance,
      mutationBand: mutationBand(chance).id,
      contributions: contributionRanges(inherited.owners, parents.map((entry) => entry.id)),
      mutations
    };
  }
  function normalizeInheritance(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      methodId: METHOD_BY_ID[candidate.methodId] ? candidate.methodId : "naturalDivision",
      priorityId: PRIORITY_BY_ID[candidate.priorityId] ? candidate.priorityId : "balanced",
      mutationBand: ["stable", "variable", "unstable", "chaotic"].includes(candidate.mutationBand) ? candidate.mutationBand : "variable",
      contributions: (Array.isArray(candidate.contributions) ? candidate.contributions : []).map((entry) => ({
        parentId: cleanId(entry?.parentId), start: Math.max(1, Math.floor(finite(entry?.start, 1))), end: Math.max(1, Math.floor(finite(entry?.end, 1)))
      })).filter((entry) => entry.parentId && entry.end >= entry.start).slice(0, 20),
      mutations: (Array.isArray(candidate.mutations) ? candidate.mutations : []).map((entry) => ({
        position: Math.max(1, Math.floor(finite(entry?.position, 1))), from: cleanGenome(entry?.from).slice(0, 1), to: cleanGenome(entry?.to).slice(0, 1)
      })).filter((entry) => entry.from && entry.to && entry.from !== entry.to).slice(0, 26)
    };
  }
  function normalizeSnapshot(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const snapshot = clone(candidate, null);
    if (!snapshot) return null;
    snapshot.id = cleanId(snapshot.id);
    snapshot.genome = cleanGenome(snapshot.genome);
    snapshot.generation = Math.max(0, Math.floor(finite(snapshot.generation, 0)));
    if (snapshot.inheritance) snapshot.inheritance = normalizeInheritance(snapshot.inheritance);
    return snapshot.id ? snapshot : null;
  }
  function normalizeEvent(candidate, index = 0) {
    const id = cleanId(candidate?.id) || `reproduction-${index + 1}`;
    return {
      id,
      methodId: METHOD_BY_ID[candidate?.methodId] ? candidate.methodId : "naturalDivision",
      priorityId: PRIORITY_BY_ID[candidate?.priorityId] ? candidate.priorityId : "balanced",
      broodId: cleanId(candidate?.broodId),
      createdAt: Math.max(0, finite(candidate?.createdAt, 0)),
      targetCount: Math.max(1, Math.min(8, Math.floor(finite(candidate?.targetCount, 1)))),
      parents: (Array.isArray(candidate?.parents) ? candidate.parents : []).map(normalizeSnapshot).filter(Boolean).slice(0, 2),
      children: (Array.isArray(candidate?.children) ? candidate.children : []).map(normalizeSnapshot).filter(Boolean).slice(0, 8),
      environment: clone(candidate?.environment, {}),
      summary: String(candidate?.summary || "").trim()
    };
  }
  function defaultState() {
    return { version: VERSION, events: [], nextEventNumber: 1 };
  }
  function normalizeState(candidate) {
    const events = (Array.isArray(candidate?.events) ? candidate.events : []).map(normalizeEvent).filter(Boolean).slice(-200);
    return {
      version: VERSION,
      events,
      nextEventNumber: Math.max(1, Math.floor(finite(candidate?.nextEventNumber, 1)), events.reduce((max, event) => Math.max(max, Number(event.id.match(/([0-9]+)$/)?.[1]) || 0), 0) + 1)
    };
  }

  return {
    VERSION, METHODS, METHOD_BY_ID, PRIORITIES, PRIORITY_BY_ID,
    cleanId, cleanGenome, clone, seededRng, mutationBand, mutationChance,
    methodMutationBand, inheritGenome, normalizeInheritance, normalizeEvent,
    defaultState, normalizeState
  };
}));
