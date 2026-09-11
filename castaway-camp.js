(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCastawayCamp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function create(destination) {
    // Bounded local prospects, not a renewable harvest of the strategic cell.
    const temperate = destination.temperatureC >= 8 && destination.temperatureC <= 30;
    return { inspected: false, searched: false, salvaged: false, toolCondition: 100, toolStackId: null,
      water: destination.precipitationMm >= 400 ? 3 : 0,
      food: temperate && destination.precipitationMm >= 300 ? 2 : 0,
      components: { serviceKit: 1, canopy: 1 }, filtersRemaining: 3,
      collarInspected: false, jam: 0, attempts: [], agreements: [], history: [],
      cell: { x: 23, y: 12, z: 13 }, forageCell: { x: 26, y: 14, z: 13 } };
  }
  function willingness(actor, kind) {
    if (!actor || actor.status === "dead" || actor.health <= 0) return "They cannot agree.";
    const trust = actor.relationship?.trust || 0;
    if (trust < 0 || actor.relationship?.scientist === "hostile") return "They distrust you after your observed conduct or prior relationship.";
    if (kind === "shelter") return "";
    if (trust < 1) return "They want evidence of cooperation before accepting responsibility for you.";
    if ((actor.needs?.thirst || 0) >= 70 || (actor.needs?.exertion || 0) >= 70) return "Their immediate survival needs take priority.";
    return "";
  }
  function collarAttempt(camp, skill, helperSkill = 0) {
    if (!camp.collarInspected || camp.toolCondition <= 0) return { ok: false, reason: "Inspect the collar and obtain usable physical tools first." };
    const competence = Math.max(skill, helperSkill);
    if (camp.attempts.some(a => a.competence >= competence && !a.success)) return { ok: false, reason: "An unchanged or weaker approach cannot improve the failed result. Gain expertise or find a more capable helper." };
    const success = competence >= 4 + camp.jam;
    camp.toolCondition = Math.max(0, camp.toolCondition - (success ? 20 : 35));
    camp.attempts.push({ competence, success });
    if (!success) camp.jam++;
    return { ok: true, success, injury: success ? 0 : 4 };
  }
  function agree(camp, actor, kind, now) {
    const reason = willingness(actor, kind); if (reason) return { ok: false, reason };
    camp.agreements = camp.agreements.filter(a => !(a.actorId === actor.id && a.kind === kind));
    camp.agreements.push({ actorId: actor.id, kind, until: now + 3600 });
    return { ok: true };
  }
  return { create, willingness, collarAttempt, agree };
});
