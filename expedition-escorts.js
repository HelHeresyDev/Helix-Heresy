(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixExpeditionEscorts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MEETING = Object.freeze({ x: 12, y: 10, z: 6 });
  const FEE = 60, HOURLY = 20;
  const ORDERS = Object.freeze(["follow", "hold", "defend", "withdraw"]);
  const GEAR = Object.freeze([
    { key: "escortBaton", label: "Field Escort Baton", price: 45, massKg: 1.5, volumeL: 2 },
    { key: "escortVest", label: "Field Escort Protective Vest", price: 90, massKg: 4, volumeL: 6 }
  ]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function defaultState() { return { actor: null, contract: null, history: [], nextContract: 1, gearCondition: {}, budgetHours: 4, drag: null }; }
  function normalizeState(value) { return { ...defaultState(), ...clone(value || {}) }; }
  function candidate(seed, city) {
    let hash = 0; for (const c of `${seed}:${city.id}`) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
    const first = ["Mara", "Soren", "Ilya", "Tamsin", "Ren", "Dara"][hash % 6];
    const last = ["Vale", "Voss", "Kestrel", "Arden", "Neri", "Thorne"][Math.floor(hash / 6) % 6];
    return { id: `escort:${city.id}`, actorKind: "expeditionEscort", name: `${first} ${last}`, cityId: city.id, affiliation: `${city.label} independent field-survey professional`, temperament: "Cautious professional; protects people, does not pursue trophies", skills: { striking: 12, guarding: 10, evasion: 8, perception: 10 }, health: 100, maxHealth: 100, status: "alive", trust: 50, roomId: "supportedSurveyGround", mapCell: clone(MEETING), order: "follow", lastReportAt: null, nextMoveAt: 0, nextAttackAt: 0, care: null, initializedKit: false, needs: null, observed: {} };
  }
  function quote(hours = 4) { const limitHours = [2, 4, 8].includes(Number(hours)) ? Number(hours) : 4; return { fee: FEE, hourly: HOURLY, limitHours, wageReserve: limitHours * HOURLY, upfront: FEE + limitHours * HOURLY }; }
  function start(number, at, hours) { return { id: `escort-contract-${number}`, status: "active", startedAt: at, ...quote(hours), earned: 0, returnReason: "", endedAt: null, refund: 0 }; }
  function accrue(contract, at) {
    if (!contract || !["active", "returning"].includes(contract.status)) return contract;
    contract.earned = Math.min(contract.wageReserve, Math.max(0, at - contract.startedAt) / 3600 * contract.hourly);
    if (contract.earned >= contract.wageReserve && !contract.returnReason) { contract.returnReason = "The agreed spending limit has been reached"; contract.status = "returning"; }
    return contract;
  }
  function refusal(actor, threats = 0) {
    if (actor.health < 35) return "Serious wounds require withdrawal";
    if (Math.max(actor.needs?.thirst || 0, actor.needs?.hunger || 0) >= 85) return "Critical supply needs require withdrawal";
    if ((actor.needs?.exertion || 0) >= 80) return "Exhaustion requires withdrawal";
    if (threats >= 3) return "The visible opposition is overwhelming";
    return "";
  }
  function finish(contract, at, dead = false) {
    if (!contract || !["active", "returning"].includes(contract.status)) return 0;
    accrue(contract, at); contract.status = dead ? "fatality" : "completed"; contract.endedAt = at;
    contract.refund = Math.floor(Math.max(0, contract.wageReserve - contract.earned) * 100) / 100;
    return contract.refund;
  }
  function canDrag(helper, casualty, loadKg = 0) { return helper.health > helper.maxHealth * .35 && (helper.needs?.exertion || 0) < 90 && casualty.health > 0 && 80 + Math.max(0, loadKg) <= 180; }
  return { MEETING, FEE, HOURLY, ORDERS, GEAR, defaultState, normalizeState, candidate, quote, start, accrue, refusal, finish, canDrag };
});
