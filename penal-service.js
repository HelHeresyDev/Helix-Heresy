(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPenalService = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400, MONTH = 30 * DAY;
  const able = a => a?.status === 'alive' && a.health > 10;
  const ACTIVITIES = { recovery: { label: 'Recover in quarters', seconds: 3600, point: 'quarters' }, training: { label: 'Physical training', seconds: 1800, point: 'training' }, maintenance: { label: 'Depot maintenance', seconds: 1800, point: 'workshop' }, medical: { label: 'Request medical treatment', seconds: 120, point: 'clinic' }, company: { label: 'Company communication', seconds: 600, point: 'terminal' }, counsel: { label: 'Confidential counsel session', seconds: 600, point: 'terminal' } };
  function ledger(s, jail) {
    if (!s.ledger && s.startedAt != null) {
      const valid = jail?.id === s.jailStayId && Number.isFinite(jail.bookedAt) && jail.bookedAt <= s.startedAt;
      const seconds = valid ? Math.min(s.termMonths * MONTH, Math.max(0, s.startedAt - jail.bookedAt)) : 0;
      s.recognizedCustodySeconds = seconds;
      s.ledger = { originalMonths: s.termMonths, originalSeconds: s.termMonths * MONTH, sources: valid ? [{ stayId: jail.id, from: jail.bookedAt, to: s.startedAt, seconds, basis: 'Documented continuous source-jail custody at military handoff' }] : [], recognizedCustodySeconds: seconds, reductions: [], releaseAt: s.startedAt + s.termMonths * MONTH - seconds };
    }
    return s.ledger;
  }
  function accrue(s, now) {
    if (!s.ledger) return false;
    const l = s.ledger;
    l.servedSeconds = Math.max(0, Math.min(now, l.releaseAt) - s.startedAt);
    s.creditedSeconds = Math.min(l.originalSeconds, l.recognizedCustodySeconds + l.servedSeconds);
    s.remainingSeconds = Math.max(0, l.originalSeconds - s.creditedSeconds);
    if (s.remainingSeconds || s.serviceEndedAt != null) return false;
    s.serviceEndedAt = l.releaseAt;
    s.history.push({ at: l.releaseAt, phase: 'serviceExpired', reason: 'Compulsory service ended at the fixed boundary; transport and paperwork cannot extend the sentence.' });
    return true;
  }
  function depot(s, now) {
    return s.depot ||= { createdAt: now, materialized: false, activity: null, communications: [], nextCommunication: { company: now, counsel: now }, notices: [], noticeSerial: 0, condition: 100, recordsOnline: true, lastAt: now, mealProgress: {}, medicalProgress: {}, supplyIds: {}, medicalIds: {}, cityStock: { drinkingWater: 48000, trailMeal: 24000, medicalBandage: 480, neutralizingWash: 120 }, delivery: null, deliverySerial: 0, deliveryHistory: [], supplyVan: { condition: 100, fuelKm: 2400, distanceKm: 0, location: 'depot', occupants: [] }, route: { cityId: s.cityId, distanceKm: 4, open: true }, discharge: null };
  }
  function notice(d, at, kind, text) { d.noticeSerial++; d.notices.push({ at, kind, text }); if (d.notices.length > 80) d.notices.shift(); }
  function activity(d, kind, now) {
    const def = ACTIVITIES[kind]; if (!def || d.activity) return false;
    const readyAt = ['company', 'counsel'].includes(kind) ? Math.max(now, d.nextCommunication[kind]) : now;
    d.activity = { kind, requestedAt: now, readyAt, progress: 0, duration: def.seconds, point: def.point };
    return true;
  }
  function work(d, elapsed, now, ready) {
    const a = d.activity; if (!a || now < a.readyAt || !ready) return null;
    a.progress = Math.min(a.duration, a.progress + Math.max(0, elapsed));
    if (a.progress < a.duration) return null;
    d.activity = null;
    if (['company', 'counsel'].includes(a.kind)) d.nextCommunication[a.kind] = now + DAY;
    notice(d, now, 'activityComplete', `${ACTIVITIES[a.kind].label} completed.`); return a;
  }
  function orderDelivery(d, stock, now) {
    if (d.delivery) return false;
    const cargo = {};
    for (const [key, target, threshold] of [['drinkingWater', 160, 40], ['trailMeal', 80, 20], ['medicalBandage', 12, 3], ['neutralizingWash', 6, 1]]) {
      if ((stock[key] || 0) <= threshold && d.cityStock[key] > 0) cargo[key] = Math.min(target - (stock[key] || 0), d.cityStock[key]);
    }
    if (!Object.keys(cargo).length) return false;
    d.delivery = { id: ++d.deliverySerial, phase: 'toCity', requestedAt: now, cargo, loaded: false, lastAt: now, loadingSeconds: 0, delay: '' };
    d.supplyVan.distanceKm = 0; return true;
  }
  function deliveryTick(d, elapsed, now, driver, atLoadingPoint) {
    const r = d.delivery; if (!r) return null;
    r.delay = !able(driver) ? 'The named supply driver is unavailable.' : !d.route.open ? 'The local supply road is blocked.' : d.supplyVan.condition < 50 ? 'The supply van is disabled.' : d.supplyVan.fuelKm <= 0 ? 'The supply van has exhausted its fuel.' : '';
    if (r.delay) return null;
    if (['toCity', 'toDepot'].includes(r.phase)) {
      const km = Math.min(d.route.distanceKm - d.supplyVan.distanceKm, Math.max(0, elapsed) * 24 / 3600, d.supplyVan.fuelKm);
      d.supplyVan.distanceKm += km; d.supplyVan.fuelKm -= km; d.supplyVan.location = `${r.phase}:${d.supplyVan.distanceKm.toFixed(3)}`;
      if (d.supplyVan.distanceKm >= d.route.distanceKm) { r.phase = r.phase === 'toCity' ? 'loading' : 'unloading'; r.loadingSeconds = 0; d.supplyVan.location = r.phase === 'loading' ? 'cityStore' : 'depot'; }
      return null;
    }
    if (!atLoadingPoint) return null;
    r.loadingSeconds += Math.max(0, elapsed); if (r.loadingSeconds < 120) return null;
    if (r.phase === 'loading') {
      for (const key of Object.keys(r.cargo)) { r.cargo[key] = Math.min(r.cargo[key], d.cityStock[key]); d.cityStock[key] -= r.cargo[key]; }
      r.loaded = true; r.phase = 'toDepot'; r.loadingSeconds = 0; d.supplyVan.distanceKm = 0; return null;
    }
    const delivered = { ...r.cargo }; r.phase = 'completed'; r.completedAt = now;
    d.deliveryHistory.push(r); d.delivery = null; d.supplyVan.occupants = [];
    notice(d, now, 'supplyDelivery', 'A physical city-local delivery reached the depot.'); return delivered;
  }
  function beginDischarge(s, now) {
    const d = s.depot;
    if (!d || s.serviceEndedAt == null || d.discharge) return false;
    if (d.activity?.kind !== 'medical') d.activity = null;
    d.discharge = { phase: 'processing', startedAt: now, progress: 0, equipment: [], personalPropertyIds: [], papers: null, receivingPermit: { cityId: s.cityId, scope: 'Military discharge receiving point only; unrelated restrictions remain in force', issuedAt: now }, distanceKm: 0, delay: '' };
    return true;
  }
  function dischargeTravel(s, elapsed, driver) {
    const d = s.depot, r = d.discharge;
    if (r?.phase !== 'travelling') return false;
    r.delay = !able(driver) ? 'The named discharge driver is unavailable.' : !d.route.open ? 'The civilian receiving road is blocked.' : s.truck.condition < 50 ? 'The occupied truck is disabled.' : s.truck.fuelKm <= 0 ? 'The occupied truck is out of fuel.' : '';
    if (r.delay) return false;
    const km = Math.min(4 - r.distanceKm, Math.max(0, elapsed) * 24 / 3600, s.truck.fuelKm);
    r.distanceKm += km; s.truck.fuelKm -= km; s.truck.location = `civilianReceivingRoad:${r.distanceKm.toFixed(3)}`;
    return r.distanceKm >= 4;
  }
  return { DAY, MONTH, ACTIVITIES, able, ledger, accrue, depot, notice, activity, work, orderDelivery, deliveryTick, beginDischarge, dischargeTravel };
});
