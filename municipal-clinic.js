(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixMunicipalClinic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const BED = Object.freeze({ x: 17, y: 11, z: 6 });
  const DESK = Object.freeze({ x: 18, y: 11, z: 6 });
  const EMERGENCY_LIMIT = 180, RECOVERY_SECONDS = 900;
  function defaultState() { return { clinician: { id: "municipal-clinician", actorKind: "municipalClinician", name: "Clinician Iona Vale", mapCell: { ...DESK } }, stockCreated: false, stay: null, history: [], debt: 0, nextStay: 1, lastHandoff: null }; }
  function active(stay) { return Boolean(stay && !["discharged", "left", "dead", "interrupted"].includes(stay.status)); }
  function admit(number, now, emergency) { return { id: `clinic-${number}`, status: "admitting", emergency, emergencySpent: 0, escrow: 0, spent: 0, admittedAt: now, nextAt: now + 4, assessment: null, operation: null, reason: "Physical transfer to the treatment bed pending." }; }
  function quote(injuries) { return { amount: 120 + injuries.filter(i => i.status !== "healed").length * 40, recoveryHours: 3, description: "Up to three hours of monitored recovery and injury-specific care; unused escrow refunded. Specialist reconstruction is unavailable." }; }
  function available(stay, incapacitated) { return !active(stay) ? 0 : stay.escrow > 0 ? stay.escrow : stay.emergency && incapacitated ? Math.max(0, EMERGENCY_LIMIT - stay.emergencySpent) : 0; }
  function charge(stay, amount, incapacitated) {
    if (!Number.isFinite(amount) || amount <= 0 || available(stay, incapacitated) < amount) return null;
    if (stay.escrow > 0) { stay.escrow -= amount; stay.spent += amount; return 0; }
    stay.emergencySpent += amount; return amount;
  }
  function close(stay, status, now) { if (!active(stay)) return 0; const refund = stay.escrow; stay.escrow = 0; stay.status = status; stay.endedAt = now; stay.operation = null; return refund; }
  return { BED, DESK, EMERGENCY_LIMIT, RECOVERY_SECONDS, defaultState, active, admit, quote, available, charge, close };
});
