(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWildernessSurvival = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ROOM = "wildernessSurveySector";
  const ENTRY = Object.freeze({ x: 22, y: 12, z: 6 });
  const GATE = Object.freeze({ x: 20, y: 12, z: 6 });
  const RADIO_SECONDS = 4 * 3600;
  const ITEMS = Object.freeze([
    { key: "drinkingWater", label: "Sealed Drinking Water", amount: 3, initial: 12, massKg: 1, volumeL: 1, price: 4 },
    { key: "trailMeal", label: "Trail Meal", amount: 2, initial: 8, massKg: .5, volumeL: .8, price: 8 },
    { key: "fieldShelter", label: "Field Shelter Kit", amount: 1, initial: 1, massKg: 3, volumeL: 8, price: 90 },
    { key: "satelliteCommunicator", label: "Satellite-magical Communicator", amount: 1, initial: 1, massKg: .8, volumeL: 1, price: 120 },
    { key: "relayBattery", label: "Relay Battery", amount: 1, initial: 2, massKg: .4, volumeL: .5, price: 20 }
  ]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));
  function defaultState(at = 0) { return { lastAt: at, hunger: 0, thirst: 0, exertion: 0, exposure: 0, harmRemainder: 0, destination: null, context: null, materialized: false, shelter: null, radios: {}, mode: "municipal", autoCare: true, warningBand: 0 }; }
  function normalizeState(candidate, at = 0) {
    const next = { ...defaultState(at), ...clone(candidate || {}) };
    for (const key of ["hunger", "thirst", "exertion", "exposure"]) next[key] = clamp(next[key]);
    next.radios ||= {}; next.mode = next.mode === "wilderness" ? "wilderness" : "municipal";
    return next;
  }
  function chooseDestination(origin, candidates, occupiedIds = []) {
    const occupied = new Set(occupiedIds);
    const candidate = candidates.filter((cell) => origin?.neighborIds?.includes(cell.id) && cell.surfaceClass === "land" && !occupied.has(cell.id) && Number.isFinite(cell.slopePercent) && cell.slopePercent <= 30 && Number.isFinite(cell.temperatureC))
      .sort((a, b) => a.slopePercent - b.slopePercent || a.id.localeCompare(b.id))[0];
    if (!candidate) return null;
    return { id: `wilderness:${candidate.id}`, strategicCellId: candidate.id, approachCellId: origin.id, label: `${candidate.biomeLabel || "Wilderness"} Boundary Sector`, temperatureC: candidate.temperatureC, slopePercent: candidate.slopePercent, precipitationMm: candidate.precipitationMm || 0,
      terrain: candidate.slopePercent > 15 ? "broken ground" : "gentle ground", jurisdiction: "No ordinary city jurisdiction beyond the defended boundary", description: "A small on-foot boundary sector, not a traversal or survey of the entire strategic cell. Beast encounters are not yet simulated here." };
  }
  function conditions(destination, at, sheltered = false) {
    if (!destination) return { temperatureC: 18, stress: 0, label: "Protected local conditions" };
    const temperatureC = destination.temperatureC + 4 * Math.sin(at / 86400 * Math.PI * 2);
    const coldHeat = Math.max(0, 8 - temperatureC, temperatureC - 30);
    const wet = destination.precipitationMm > 900 ? 2 : 0;
    return { temperatureC, stress: (coldHeat * .6 + wet) * (sheltered ? .2 : 1), label: `${Math.round(temperatureC)}°C; ${wet ? "damp" : "dry"} exposure${sheltered ? "; shelter reduces weather exposure" : ""}` };
  }
  function band(state) { const worst = Math.max(state.hunger, state.thirst, state.exertion, state.exposure); return worst >= 90 ? 3 : worst >= 70 ? 2 : worst >= 45 ? 1 : 0; }
  function advance(candidate, at, options = {}) {
    const state = normalizeState(candidate, at); const before = band(state);
    // Fixed one-second steps keep thresholds, damage, and reloads independent of caller chunking.
    const seconds = Math.max(0, Math.floor(at - state.lastAt));
    let damage = 0;
    for (let second = 0; second < seconds; second++) {
      const working = Boolean(options.working), resting = Boolean(options.resting);
      state.thirst = clamp(state.thirst + (working ? 8 : 6) / 3600);
      state.hunger = clamp(state.hunger + (working ? 4 : 3) / 3600);
      state.exertion = clamp(state.exertion + (working ? 12 : resting ? (options.sheltered || !options.destination ? -24 : -12) : -6) / 3600);
      const weather = conditions(options.destination, state.lastAt + second, options.sheltered);
      state.exposure = clamp(state.exposure + (weather.stress || -6) / 3600);
      state.harmRemainder += ((state.thirst >= 90 ? 4 : 0) + (state.hunger >= 95 ? 1 : 0) + (state.exposure >= 90 ? 4 : 0)) / 3600;
      if (state.harmRemainder >= 1) { damage++; state.harmRemainder -= 1; }
    }
    state.lastAt += seconds;
    for (const radio of Object.values(state.radios)) if (radio.powered && options.carriedRadioIds?.includes(radio.stackId)) { radio.charge = Math.max(0, radio.charge - seconds); if (!radio.charge) radio.powered = false; }
    state.warningBand = band(state);
    return { state, damage, warning: state.warningBand > before };
  }
  function consume(candidate, key) {
    const state = normalizeState(candidate);
    if (key === "drinkingWater" || key === "fieldRation") state.thirst = clamp(state.thirst - 40);
    if (key === "trailMeal" || key === "fieldRation") state.hunger = clamp(state.hunger - 40);
    state.warningBand = band(state); return state;
  }
  function fatigueMultiplier(state) { return 1 + Math.max(state?.exertion || 0, state?.thirst || 0, state?.hunger || 0, state?.exposure || 0) / 100; }
  function warnings(stacks) {
    return ITEMS.filter((item) => stacks.filter((s) => s.carriedBy === "scientist" && s.key === item.key && !s.reservedTaskId).reduce((n, s) => n + s.quantity, 0) < item.amount).map((item) => `Recommended: ${item.amount} ${item.label}`);
  }
  return { ROOM, ENTRY, GATE, RADIO_SECONDS, ITEMS, defaultState, normalizeState, chooseDestination, conditions, advance, consume, band, fatigueMultiplier, warnings };
});
