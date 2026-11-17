// Finite overbank water and a deliberately coarse, area-scaled erosion model.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixBeastRegionalFlood = api;
})(globalThis, function () {
  'use strict';
  const DAY = 86400, EPS = 1e-8;
  const finite = n => Number.isFinite(n) && n >= 0;
  const geometry = r => r.ecology?.floodplain || { areaHa: r.areaHa, safeDepthMm: 100, erosionPointsPerMm: .01 };
  const capacity = course => course?.outlet && !course.outlet.blocked
    ? course.outlet.widthM * course.outlet.depthM * course.outlet.velocityMps * 1000 * DAY : 0;
  const safeVolume = r => geometry(r).areaHa * 10000 * geometry(r).safeDepthMm;
  const erosion = (r, litres) => Math.max(0, litres) / 10000 * geometry(r).erosionPointsPerMm;
  const tolerance = r => Math.max(EPS, Math.max(safeVolume(r), r.flood?.receivedL || 0, r.flood?.dischargedL || 0) * Number.EPSILON * 32);
  const atBuffer = r => r.flood.waterL >= safeVolume(r) - tolerance(r);
  function initialize(r, at) {
    if (r.ecology?.floodable && !r.flood) r.flood = { startedAt: at, waterL: 0, receivedL: 0, dischargedL: 0,
      riverBlockedL: 0, breachReceivedL: 0, bankDischargedL: 0, erosionEP: 0 };
  }
  function ensure(r, at) { if (!r.flood) initialize(r, at); return r.flood; }
  function validateDefinition(r) {
    if (!validState(r, Infinity)) throw Error('Invalid original flood-water inventory');
    const p = r.ecology?.floodplain;
    if (p != null && (!r.ecology.floodable || !Number.isFinite(p.areaHa) || !(p.areaHa > 0 && p.areaHa <= r.areaHa)
      || !finite(p.safeDepthMm) || !finite(p.erosionPointsPerMm))) throw Error('Invalid finite floodplain');
    for (const c of r.ecology?.watercourses || []) if (c.outlet != null) {
      const o = c.outlet;
      if (!r.ecology.floodable || !Number.isFinite(o.widthM) || !(o.widthM > 0 && o.widthM <= Math.sqrt(r.areaHa * 10000))
        || !(o.depthM > 0) || !Number.isFinite(o.depthM) || r.depthM > 0 && o.depthM > r.depthM
        || !Number.isFinite(o.velocityMps) || !(o.velocityMps > 0 && o.velocityMps <= 2) || !finite(o.grade)
        || o.blocked != null && typeof o.blocked !== 'boolean' || !finite(capacity(c))) throw Error('Invalid original outlet geometry');
    }
  }
  function route(r, rate, rates, course, river, at) {
    if (!r.ecology?.floodable) {
      if (course) rates[course.downstreamRegionId].renewal.waterL = (rates[course.downstreamRegionId].renewal.waterL || 0) + river.through;
      return;
    }
    const f = ensure(r, at), bankExcess = (r.stocks.waterL || 0) >= (r.capacity.waterL || 0) - EPS ? Math.max(0, rate.net.waterL || 0) : 0;
    // An old flow-only course proves that original flow, not an unbounded bank
    // drain. Additional drainage requires recorded physical outlet dimensions.
    const limit = course?.outlet ? capacity(course) : river.through;
    const passed = Math.min(river.through, limit), blocked = river.through - passed;
    const spare = course?.outlet ? Math.max(0, limit - passed) : 0;
    const floodDrain = f.waterL > tolerance(r) ? spare : 0;
    const bankDrain = Math.min(bankExcess, Math.max(0, spare - floodDrain));
    const net = blocked + bankExcess - bankDrain - floodDrain;
    rate.net.waterL = (rate.net.waterL || 0) - bankDrain;
    rate.drainage = { capacityLDay: limit, riverPassedLDay: passed, riverBlockedLDay: blocked,
      bankExcessLDay: bankExcess, bankDrainLDay: bankDrain, floodDrainLDay: floodDrain, floodNetLDay: net,
      erosionEPDay: atBuffer(r) ? erosion(r, Math.max(0, net)) : 0 };
    if (course) {
      const down = rates[course.downstreamRegionId];
      down.renewal.waterL = (down.renewal.waterL || 0) + passed + bankDrain + floodDrain;
      rate.watercourse.passedPerDay = passed; rate.watercourse.blockedPerDay = blocked;
    }
  }
  function boundary(r, rate, at) {
    const d = rate.drainage; if (!d) return Infinity;
    const water = r.flood.waterL, net = d.floodNetLDay;
    let next = Infinity;
    if (net < -EPS && water > EPS) next = at + water / -net * DAY;
    if (net > EPS && !atBuffer(r)) next = Math.min(next, at + (safeVolume(r) - water) / net * DAY);
    return next;
  }
  function integrate(r, rate, days, overflow, at) {
    if (!r.ecology?.floodable) return false;
    const f = ensure(r, at - days * DAY), d = rate.drainage;
    const blocked = (d?.riverBlockedLDay || 0) * days, drained = (d?.floodDrainLDay || 0) * days;
    f.receivedL += overflow + blocked; f.riverBlockedL += blocked;
    f.dischargedL += drained;
    f.bankDischargedL += (d?.bankDrainLDay || 0) * days;
    f.waterL = Math.max(0, f.waterL + overflow + blocked - drained);
    f.erosionEP += (d?.erosionEPDay || 0) * days;
    return true;
  }
  function addBreach(r, litres, at) {
    const f = ensure(r, at); if (!f) return 0;
    const before = Math.max(0, f.waterL - safeVolume(r));
    f.waterL += litres; f.receivedL += litres; f.breachReceivedL += litres;
    const damage = erosion(r, Math.max(0, f.waterL - safeVolume(r)) - before);
    f.erosionEP += damage; return damage;
  }
  function validState(r, at) {
    const f = r.flood;
    if (f != null && (typeof f !== 'object' || Array.isArray(f))) return false;
    if (f && (!r.ecology?.floodable || !['startedAt', 'waterL', 'receivedL', 'dischargedL', 'riverBlockedL', 'breachReceivedL', 'bankDischargedL', 'erosionEP'].every(k => finite(f[k]))
      || f.startedAt > at + EPS || f.riverBlockedL + f.breachReceivedL > f.receivedL + 1e-6
      || Math.abs(f.waterL - (f.receivedL - f.dischargedL)) > 1e-6 * Math.max(1, f.receivedL))) return false;
    return true;
  }
  function valid(r, rate, at) {
    const f = r.flood, d = rate?.drainage;
    if (!validState(r, at) || (r.ecology?.floodplain || r.ecology?.watercourses?.[0]?.outlet) && (!f || !d) || f && !d) return false;
    if (!d) return true; // Unmarked older snapshots do not acquire past flood history.
    if (!f || !Object.values(d).every(Number.isFinite) || Object.entries(d).some(([k, n]) => k !== 'floodNetLDay' && n < 0)) return false;
    const c = r.ecology.watercourses?.[0], riverThrough = rate.watercourse ? rate.watercourse.flowPerDay - rate.watercourse.retainedPerDay : 0;
    const limit = c?.outlet ? capacity(c) : riverThrough;
    const passed = Math.min(riverThrough, limit), spare = c?.outlet ? Math.max(0, limit - passed) : 0;
    const floodDrain = f.waterL > tolerance(r) ? spare : 0;
    const bankExcess = (r.stocks.waterL || 0) >= (r.capacity.waterL || 0) - EPS ? Math.max(0, (rate.net.waterL || 0) + d.bankDrainLDay) : 0;
    const near = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
    return near(d.capacityLDay, limit) && near(d.riverPassedLDay + d.riverBlockedLDay, riverThrough)
      && near(d.riverPassedLDay, passed) && near(d.floodDrainLDay, floodDrain) && near(d.bankExcessLDay, bankExcess)
      && near(d.bankDrainLDay, Math.min(bankExcess, Math.max(0, spare - floodDrain)))
      && d.riverPassedLDay + d.bankDrainLDay + d.floodDrainLDay <= limit + 1e-6 * Math.max(1, limit)
      && d.bankDrainLDay <= d.bankExcessLDay + EPS
      && near(d.floodNetLDay, d.riverBlockedLDay + d.bankExcessLDay - d.bankDrainLDay - d.floodDrainLDay)
      && near(d.erosionEPDay, atBuffer(r) ? erosion(r, Math.max(0, d.floodNetLDay)) : 0);
  }
  return { geometry, capacity, safeVolume, erosion, initialize, validateDefinition, route, boundary, integrate, addBreach, valid };
});
