(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPenalLegion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MONTH = 30 * 86400;
  const RANGE_KM = 300;
  const ITEMS = [{ key: 'legionRelayAssembly', label: 'Warning Relay Repair Assembly', massKg: 4, volumeL: 5 }];
  const copy = value => JSON.parse(JSON.stringify(value));
  const able = actor => actor?.status === 'alive' && actor.health > 10;
  function legalReason(c, cityId) {
    const o = c?.sentencing?.order, p = c?.sentencingPolicy;
    if (!c || c.actorId !== 'scientist' || !o?.id || o.kind !== 'penalLegion' || !o.final || !o.custodial || !['commitmentPending', 'committed'].includes(o.status) || o.stayed) return 'A final, unstayed military commitment is required.';
    if (!cityId || p?.cityId !== cityId || p.penalLegionAvailable !== true) return 'The sentencing city has not authorized this military service.';
    if (!Number.isInteger(o.penalServiceMonths) || !Number.isInteger(p.penalServiceMinimumMonths) || !Number.isInteger(p.penalServiceMaximumMonths) || p.penalServiceMinimumMonths < 12 || p.penalServiceMaximumMonths > 36 || o.penalServiceMonths < p.penalServiceMinimumMonths || o.penalServiceMonths > p.penalServiceMaximumMonths) return 'The court must specify a term under its published one-to-three-year service policy before transfer.';
    return '';
  }
  function chooseTarget(satellites, cityId) {
    return satellites.filter(s => s.parentId === cityId && s.parentKind === 'sovereignResourceAnchorCity' && s.localRouteCellIds?.length && s.distanceKm > 0 && s.distanceKm <= RANGE_KM && s.condition !== 'ruined' && ['groundConvoy', 'mixedFleet'].includes(s.logistics?.vehicleMode)).sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))[0] || null;
  }
  function create(c, institution, target, now) {
    if (legalReason(c, c?.sentencingPolicy?.cityId) || !institution?.id || institution.cityId !== c.sentencingPolicy.cityId || institution.role !== 'militaryDefenseCommand' || !chooseTarget(target ? [target] : [], institution.cityId)) return null;
    return { id: `legion-${c.sentencing.order.id}`, caseId: c.id, orderId: c.sentencing.order.id, cityId: institution.cityId, institution: copy(institution), destination: copy(target), phase: 'awaitingTransfer', startedAt: null, lastAt: now, nextAt: now, termMonths: c.sentencing.order.penalServiceMonths, creditedSeconds: 0, remainingSeconds: c.sentencing.order.penalServiceMonths * MONTH, squadIds: [], collarId: null, suppressionActive: true, equipmentIssued: false, truck: { id: `legion-truck-${c.sentencing.order.id}`, condition: 100, fuelKm: target.distanceKm * 3, distanceKm: 0, occupants: [], location: 'jail' }, relay: { id: `${target.id}:warning-relay`, condition: 20, repairSeconds: 0, requiredSeconds: 300, parts: 1, partsCommitted: false }, history: [], report: null, delay: '' };
  }
  function stage(s, phase, now, seconds = 0) { s.phase = phase; s.lastAt = now; s.nextAt = now + seconds; s.delay = ''; s.history.push({ at: now, phase }); }
  function credit(s, now) {
    if (s.startedAt == null) return;
    if (s.ledger) {
      s.ledger.servedSeconds = Math.max(0, Math.min(now, s.ledger.releaseAt) - s.startedAt);
      s.creditedSeconds = Math.min(s.ledger.originalSeconds, s.ledger.recognizedCustodySeconds + s.ledger.servedSeconds);
      s.remainingSeconds = Math.max(0, s.ledger.originalSeconds - s.creditedSeconds); return;
    }
    s.creditedSeconds = Math.min(s.termMonths * MONTH, Math.max(s.creditedSeconds, now - s.startedAt));
    s.remainingSeconds = Math.max(0, s.termMonths * MONTH - s.creditedSeconds);
  }
  function travel(s, elapsed, driver) {
    s.delay = !able(driver) ? 'The named driver cannot drive.' : s.truck.condition < 50 ? 'The truck is disabled at its saved route position.' : s.truck.fuelKm <= 0 ? 'The truck has no remaining fuel.' : '';
    if (s.delay) return false;
    const target = s.phase === 'returning' ? s.returnDistanceKm ?? s.destination.distanceKm : s.destination.distanceKm;
    const distance = Math.min(Math.max(0, elapsed) * 24 / 3600, target - s.truck.distanceKm, s.truck.fuelKm);
    s.truck.distanceKm += distance; s.truck.fuelKm -= distance;
    s.truck.location = `${s.destination.id}:${s.phase}:${s.truck.distanceKm.toFixed(3)}`;
    return s.truck.distanceKm >= target;
  }
  function repair(s, elapsed, facts) {
    if (s.phase !== 'field' || s.relay.condition >= 100) return false;
    s.delay = !able(facts.technician) ? 'The repair technician is incapacitated or dead.' : !facts.atRelay ? 'The technician must physically reach the relay.' : facts.threatened ? 'Nearby hostile beasts interrupt repair.' : !s.relay.partsCommitted && s.relay.parts < 1 ? 'No replacement relay assembly remains.' : '';
    if (s.delay) return false;
    if (!s.relay.partsCommitted) { s.relay.parts--; s.relay.partsCommitted = true; }
    s.relay.repairSeconds = Math.min(s.relay.requiredSeconds, s.relay.repairSeconds + Math.max(0, elapsed));
    if (s.relay.repairSeconds < s.relay.requiredSeconds) return false;
    s.relay.condition = 100; return true;
  }
  function debrief(s, squad, now) {
    if (s.phase !== 'debrief' || s.report) return false;
    credit(s, now);
    s.report = { at: now, outcome: s.relay.condition === 100 ? 'repaired' : s.recalledAt != null ? 'aborted' : 'failed', relayId: s.relay.id, repairSeconds: s.relay.repairSeconds, survivors: squad.filter(a => a.status !== 'dead').map(a => a.id), casualties: squad.filter(a => a.status === 'dead').map(a => a.id), termMonths: s.termMonths, creditedSeconds: s.creditedSeconds, remainingSeconds: s.remainingSeconds, newConviction: false };
    stage(s, 'depotService', now); return true;
  }
  return { MONTH, RANGE_KM, ITEMS, able, legalReason, chooseTarget, create, stage, credit, travel, repair, debrief };
});
