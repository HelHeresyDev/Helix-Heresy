(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixLocalDiscovery = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  function hash(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function create(destination, clock) {
    return { placeId: destination.id, cityId: destination.cityId, label: destination.label, baseline: null,
      access: { active: true, issuer: destination.cityId, scope: "municipalSurveyVisit", acquiredAt: clock },
      records: [{ id: "destination-listing", kind: "publicRecord", source: "Municipal destination listing", at: clock, text: destination.label },
        { id: "visit-extract", kind: "receivedReport", source: "Municipal visit permission", at: clock,
        text: "Limited directions to the authorized sampling ground and notice of flagged loose rock. No surrounding terrain map or mineral survey is supplied." }] };
  }
  function materialize(state, worldId, worldSeed) {
    if (!state || state.baseline) return state?.baseline;
    const key = `${worldSeed}:${state.placeId}:municipal-ground`;
    const n = hash(key);
    // An authored municipal footprint; only harmless surface detail is elaborated.
    // No minerals, inhabitants, historical events, or institutions are invented.
    state.baseline = { worldId, placeId: state.placeId,
      bounds: { x: 8, y: 8, z: 6, width: 12, height: 10 },
      marker: { x: 9 + n % 9, y: 16, z: 6, label: `${["Blue", "Ochre", "White", "Green"][n % 4]} municipal survey marker` } };
    return state.baseline;
  }
  function revoke(state) { if (state) state.access.active = false; }
  function observe(state, clock, cell, canSee, hazardDisturbed) {
    if (!state?.baseline || cell?.z !== 6) return;
    const facts = [
      { id: "vehicle", cell: { x: 10, y: 10, z: 6 }, text: "Municipal survey vehicle rendezvous" },
      { id: "marker", cell: state.baseline.marker, text: state.baseline.marker.label },
      { id: "loose-rock", cell: { x: 15, y: 14, z: 6 }, text: hazardDisturbed ? "Previously disturbed loose rock; patch settled" : "Flagged loose rock; unstable footing" }
    ];
    for (const fact of facts) {
      if (Math.max(Math.abs(cell.x - fact.cell.x), Math.abs(cell.y - fact.cell.y)) > 5 || !canSee(fact.cell)) continue;
      const previous = state.records.filter(row => row.subject === fact.id).at(-1);
      if (previous?.text === fact.text) continue;
      state.records.push({ id: `observation-${state.records.length}`, kind: "directObservation", source: "Scientist field observation", subject: fact.id,
        at: clock, cell: { x: fact.cell.x, y: fact.cell.y, z: fact.cell.z }, text: fact.text });
    }
  }
  function publicView(state) {
    if (!state) return null;
    // Copies already acquired survive revocation; neither baseline nor current
    // physical state is projected. A date records knowledge, not live telemetry.
    return { placeId: state.placeId, label: state.label, accessActive: state.access.active,
      scope: state.access.scope, records: copy(state.records),
      limitations: "Retained, dated information—not a live map. Access does not grant extraction, ownership, construction, or onward travel rights. Resource indicators require fieldwork and analysis; satellite images are not mineral surveys." };
  }
  return { create, materialize, revoke, observe, publicView };
}));
