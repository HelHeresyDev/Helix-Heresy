(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPenalAssignments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const REDUCTION = 7 * 86400;
  const copy = x => JSON.parse(JSON.stringify(x));
  function initialize(s, targets = []) {
    if (s.assignments) return s.assignments;
    const unique = [s.destination, ...targets].filter((t, i, rows) => t?.id && rows.findIndex(r => r.id === t.id) === i).slice(0, 3);
    s.assignmentSites = unique.map((target, i) => ({ id: target.id, target: copy(target), roomId: i ? `penalLegionSite${i}` : 'penalLegionField', visited: Boolean(i === 0 && s.fieldBeasts), beasts: i === 0 ? copy(s.fieldBeasts || null) : null,
      relay: i === 0 ? s.relay : { id: `${target.id}:warning-relay`, condition: 20, repairSeconds: 0, requiredSeconds: 300, parts: 0, partsCommitted: false },
      relief: { required: { drinkingWater: 12, trailMeal: 12 }, delivered: { drinkingWater: 0, trailMeal: 0 }, seconds: 0, cargoIds: {}, receipt: null },
      needSource: 'Local defense inspection: damaged warning equipment and an unfilled emergency reserve.' }));
    s.assignments = s.assignmentSites.flatMap(site => ['repair', 'relief'].map(kind => ({ id: `${site.id}:${kind}`, siteId: site.id, kind, reductionSeconds: REDUCTION, authorityId: s.institution.id, policy: 'Published local defense service: seven days for one verified objective', completedAt: null, receipt: null })));
    s.activeAssignmentId = s.assignments[0].id; s.assignmentReports = [];
    return s.assignments;
  }
  const active = s => s.assignments?.find(a => a.id === s.activeAssignmentId);
  const site = s => s.assignmentSites?.find(row => row.id === active(s)?.siteId);
  function saveSite(s) { const row = site(s); if (row) { row.relay = s.relay; if (s.fieldBeasts) row.beasts = s.fieldBeasts; } }
  function select(s, id) {
    const a = s.assignments?.find(row => row.id === id);
    if (s.phase !== 'depotService' || s.serviceEndedAt != null || !a || a.completedAt != null) return false;
    saveSite(s); s.activeAssignmentId = id;
    const row = site(s); s.destination = copy(row.target); s.relay = row.relay; s.fieldBeasts = row.beasts;
    s.report = null; s.recalledAt = null; s.returnDistanceKm = null; s.action = null; s.actionSeconds = 0; s.delay = '';
    s.phase = 'assignmentLoading'; s.assignmentLoadingSeconds = 0; return true;
  }
  const fuelRequired = s => 2 * s.destination.distanceKm + Math.max(4, s.destination.distanceKm * 0.2);
  function readiness(s, facts) {
    if (s.serviceEndedAt != null) return 'Compulsory service has ended.';
    if (!facts.personnel) return 'All living squad members, the commander, technician, and scientist must be fit and physically available.';
    if (!facts.equipment) return 'Required carried protective equipment and finite supplies are missing.';
    if (s.truck.condition < 50) return 'The original mission truck is disabled.';
    if (s.truck.fuelKm + (facts.reserveFuel || 0) < fuelRequired(s)) return 'Insufficient finite fuel for the round trip and reserve.';
    if (!facts.cargo) return 'The outstanding objective lacks its actual repair assembly or relief cargo.';
    if (facts.routeOpen === false) return 'The city-local route is blocked.';
    return '';
  }
  function reliefWork(s, elapsed, now, facts) {
    const a = active(s), row = site(s); if (s.phase !== 'field' || a?.kind !== 'relief' || a.completedAt != null || row.relief.receipt) return false;
    if (!facts.ready || !facts.cargo) return false;
    row.relief.seconds = Math.min(120, row.relief.seconds + Math.max(0, elapsed));
    return row.relief.seconds >= 120;
  }
  function recordDelivery(s, now, stacks) {
    const row = site(s), a = active(s);
    if (!row || a?.kind !== 'relief' || row.relief.receipt || row.relief.seconds < 120) return false;
    row.relief.delivered = { ...row.relief.required };
    row.relief.receipt = { id: `${a.id}:delivery`, at: now, stackIds: [...stacks] }; return true;
  }
  function debrief(s, now) {
    const a = active(s), row = site(s); if (!a || !s.report || s.report.assignmentReceipt) return null;
    saveSite(s);
    const success = a.kind === 'repair' ? row.relay.condition >= 100 : Boolean(row.relief.receipt);
    s.report.outcome = success ? (a.kind === 'repair' ? 'repaired' : 'delivered') : 'aborted';
    s.report.assignmentId = a.id; s.report.assignmentReceipt = `${a.id}:debrief:${s.assignmentReports.length + 1}`;
    s.assignmentReports.push(copy(s.report));
    if (!success || a.completedAt != null) return null;
    a.completedAt = now; a.receipt = s.report.assignmentReceipt;
    return { assignmentId: a.id, receiptId: a.receipt, authorityId: a.authorityId, policy: a.policy, seconds: a.reductionSeconds };
  }
  return { REDUCTION, initialize, active, site, saveSite, select, fuelRequired, readiness, reliefWork, recordDelivery, debrief };
});
