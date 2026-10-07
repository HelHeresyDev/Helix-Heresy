(function attachCampaign(root, factory) {
  const theme = typeof module === "object" && module.exports ? require("./theme-content") : root.HelixThemeContent;
  const api = factory(theme);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCampaign = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCampaign(Theme) {
  "use strict";
  const ambitions = [
    ["laboratory", "Establish the laboratory", "Create and care for life, develop repeatable research, finance operations, and secure local supplies and infrastructure."],
    ["localLeverage", "Become locally indispensable", "Develop relationships and leverage through products, services, discoveries, and creations."],
    ["independence", "Build an independent power base", "Recruit people, develop intelligent creations, and establish facilities that can survive loss of the original laboratory."],
    ["cityPower", "Challenge city powers", "Bargain with, influence, replace, or defeat authorities through actual people, defenses, resources, and enforceable arrangements."],
    ["worldDomination", "Pursue world domination", "Establish durable supremacy across sovereign cities and significant beast powers without pretending every empty hex needs occupation."],
    ["divineRule", "Rule over the gods", "Impose enforceable submission on the gods, kill those who refuse, and reign over the rest. Descent is not death; new ascendants remain relevant."]
  ];
  const OBJECTIVES = Object.freeze([
    { id: "creation", label: "Create a living specimen", requirement: "Complete a synthesis that stabilizes a living specimen.", workspace: "foundry" },
    { id: "care", label: "Demonstrate viable care", requirement: "Feed a scientist-created specimen successfully: positive nutrition, no feeding injury, and survival. A first care demonstration is not a guarantee of long-term welfare.", workspace: "specimens" },
    { id: "evidence", label: "Obtain experimental evidence", requirement: "Record a completed specimen test or diagnostic; a gene prediction or an unobserved event is not evidence.", workspace: "research" },
    { id: "research", label: "Develop a repeatable method", requirement: "Complete any evidence-backed research project at a physical workbench.", workspace: "research" },
    { id: "income", label: "Establish earned income", requirement: "Receive positive proceeds from a physically completed legal shipment or black-market sale. Orders, advances, and unpaid deliveries do not count.", workspace: "economy" },
    { id: "operations", label: "Secure local operations", requirement: "Assess an intact synthesis tube, an operational research workbench, a working powered utility, and accessible unreserved biomass for another synthesis in the Main Lab.", workspace: "map" }
  ].map(entry => Object.freeze({ ...entry, template: entry.requirement, kind: "campaignObjective", compatibility: "shared", contentTags: Object.freeze(["science", "survival"]) })));
  const registry = Theme.createRegistry([
    ...ambitions.map(([id, label, template]) => ({
      id, label, template, kind: "campaignAmbition", compatibility: "shared", contentTags: ["science", "survival"]
    })), ...OBJECTIVES
  ]);
  const CHECKS = Object.freeze(["synthesis", "workbench", "power", "materials"]);
  const time = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  const text = value => typeof value === "string" ? value.slice(0, 500) : "";
  function normalizeReceipt(value) {
    return value && Number.isFinite(value.at) ? { at: time(value.at), sourceId: text(value.sourceId), summary: text(value.summary) } : null;
  }
  function normalize(value) {
    return {
      guidanceEnabled: value?.guidanceEnabled !== false,
      objectives: Object.fromEntries(OBJECTIVES.map(({ id }) => [id, normalizeReceipt(value?.objectives?.[id])])),
      localLeverage: Object.fromEntries(["service", "reservation"].map(id => [id, normalizeReceipt(value?.localLeverage?.[id]) ? {
        ...normalizeReceipt(value.localLeverage[id]), clientId: text(value.localLeverage[id].clientId)
      } : null])),
      independentOperations: Object.fromEntries(["recruitment", "delegation"].map(id => [id, normalizeReceipt(value?.independentOperations?.[id])])),
      readiness: value?.readiness && Number.isFinite(value.readiness.at) ? {
        at: time(value.readiness.at), checks: Object.fromEntries(CHECKS.map(id => [id, value.readiness.checks?.[id] === true]))
      } : null,
      accomplishedAt: value?.accomplishedAt == null ? null : time(value.accomplishedAt)
    };
  }
  function ready(state) { return Boolean(state.readiness && CHECKS.every(id => state.readiness.checks[id])); }
  function finalize(state, clock) {
    if (state.accomplishedAt === null && ready(state) && state.readiness.at === time(clock) && OBJECTIVES.every(({ id }) => state.objectives[id])) state.accomplishedAt = time(clock);
    return state;
  }
  // Callers supply only a known successful outcome, never the canonical world
  // or live hidden simulation state. Each receipt records its first occurrence.
  function record(value, outcome = {}, clock = 0) {
    const state = normalize(value);
    if (outcome.known !== true || outcome.alive === false) return state;
    if (["workerRecruitment", "workerDelegation"].includes(outcome.kind)) {
      const id = outcome.kind === "workerRecruitment" ? "recruitment" : "delegation";
      if (!outcome.sourceId || (id === "recruitment" ? !(outcome.arrived && outcome.consented) : !outcome.delivered)) return state;
      state.independentOperations[id] ||= { at: time(clock), sourceId: text(outcome.sourceId), summary: text(outcome.summary) };
      return state;
    }
    if (outcome.kind === "localService" || outcome.kind === "localReservation") {
      if (!outcome.clientId || !outcome.sourceId) return state;
      const id = outcome.kind === "localService" ? "service" : "reservation";
      if (id === "service" && !(outcome.received === true && outcome.settled === true)) return state;
      if (id === "reservation" && outcome.granted !== true) return state;
      state.localLeverage[id] ||= { at: time(clock), sourceId: text(outcome.sourceId), clientId: text(outcome.clientId), summary: text(outcome.summary) };
      return state;
    }
    const id = outcome.kind;
    if (!OBJECTIVES.some(entry => entry.id === id) || id === "operations") return state;
    if (id === "care" && !(outcome.createdByScientist && outcome.nutritionGain > 0 && outcome.feedingDamage === 0 && outcome.survived)) return state;
    if (id === "evidence" && !(outcome.specimenId && ["test", "diagnostic"].includes(outcome.category))) return state;
    if (id === "income" && !(outcome.delivered === true && outcome.settled === true && outcome.amount > 0)) return state;
    state.objectives[id] ||= { at: time(clock), sourceId: text(outcome.sourceId), summary: text(outcome.summary) };
    return finalize(state, clock);
  }
  function assess(value, checks, clock = 0, options = {}) {
    const state = normalize(value);
    if (options.known !== true || options.alive === false) return state;
    state.readiness = { at: time(clock), checks: Object.fromEntries(CHECKS.map(id => [id, checks?.[id] === true])) };
    if (ready(state)) state.objectives.operations ||= { at: time(clock), sourceId: "local-assessment", summary: "Local supplies and infrastructure assessed ready." };
    return finalize(state, clock);
  }
  function accomplishments(value) {
    const state = normalize(value);
    const result = OBJECTIVES.filter(({ id }) => state.objectives[id]).map(({ id, label }) => ({ label, at: state.objectives[id].at }));
    if (state.accomplishedAt !== null) result.push({ label: "Establish the laboratory", at: state.accomplishedAt });
    for (const [id, label] of [["service", "Complete useful work for a local customer"], ["reservation", "Negotiate a real materials reservation"]]) {
      if (state.localLeverage[id]) result.push({ label, at: state.localLeverage[id].at });
    }
    for (const [id, label] of [["recruitment", "Engage a physically arrived voluntary worker"], ["delegation", "Delegate a physically completed supplies transfer"]]) {
      if (state.independentOperations[id]) result.push({ label, at: state.independentOperations[id].at });
    }
    return result;
  }
  function roadmap(worldTheme) { return Theme.eligibleDefinitions(registry, { kind: "campaignAmbition", worldTheme }); }
  function objectives(worldTheme) { return Theme.eligibleDefinitions(registry, { kind: "campaignObjective", worldTheme }); }
  return { OBJECTIVES, CHECKS, normalize, record, assess, ready, accomplishments, roadmap, objectives };
}));
