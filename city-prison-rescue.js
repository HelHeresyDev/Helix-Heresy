(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityPrisonRescue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const terminal = ['refused', 'cancelled', 'withdrawn', 'complete'];
  const able = a => a?.status === 'alive' && a.health >= 50;
  function service(contact, cityId, name) {
    return { id: `local-rescue:${cityId}:${contact.id}`, contactId: contact.id, cityId,
      driver: { id: `local-driver:${cityId}:${contact.id}`, name, status: 'alive', health: 100, location: 'receiving', mapCell: null },
      vehicle: { id: `local-van:${cityId}:${contact.id}`, condition: 100, fuelKm: 40, passengerSeats: 1, cargoKg: 40, cargoL: 60, reservedBy: null, occupants: [], location: 'receiving', mapCell: null },
      destination: { id: `local-receiving:${cityId}:${contact.id}`, ownerId: contact.id, label: `${contact.name}'s local receiving garage`, permission: true }, distanceKm: 4 };
  }
  function reason(contact, provider, cityId, now) {
    if (!contact || contact.discoveredAt > now || contact.trust < 60 || contact.unavailableUntil > now) return 'No willing, available established contact.';
    if (!provider || provider.cityId !== cityId || !provider.destination.permission) return 'No existing local vehicle, helper and permitted receiving site.';
    if (!able(provider.driver) || provider.driver.location !== 'receiving') return 'The named driver is unavailable.';
    const v = provider.vehicle;
    if (v.reservedBy || v.location !== 'receiving' || v.condition < 50 || v.passengerSeats < 1 || v.fuelKm < provider.distanceKm * 2) return 'The actual vehicle lacks availability, condition, capacity or round-trip fuel.';
    return '';
  }
  function request(p, contact, provider, message, cityId, now, roll) {
    p.rescueRequests ||= [];
    if (p.rescueRequests.some(r => !terminal.includes(r.status) || r.message.sessionId === message.sessionId)) return null;
    const blocked = reason(contact, provider, cityId, now);
    const r = { id: `${p.id}:rescue-${p.rescueRequests.length + 1}`, contactId: contact?.id, serviceId: provider?.id, message: JSON.parse(JSON.stringify(message)), status: 'offered', createdAt: now, lastAt: now, history: [], noticeSerial: 0, roll,
      reason: blocked, fee: 750, expiresAt: now + 300, pickupAt: now + 86400, closesAt: now + 93600, boardingSeconds: 0, distanceTravelledKm: 0, occupied: false };
    if (blocked || roll > (contact?.reliability || 0)) { r.status = 'refused'; r.reason ||= 'The contact declines this risky extraction.'; }
    r.disclosed = !blocked && roll > Math.min(0.99, (contact?.reliability || 0) + 0.05);
    p.rescueRequests.push(r); return r;
  }
  function accept(r, provider, contact, cityId, now, money) {
    if (!r || r.status !== 'offered' || now >= r.expiresAt || money < r.fee || reason(contact, provider, cityId, now)) return false;
    provider.vehicle.reservedBy = r.id; r.paid = r.fee; r.status = 'planned'; r.lastAt = now; r.noticeSerial++; return true;
  }
  function stage(r, status, now, reason) { r.status = status; r.reason = reason; r.noticeSerial++; r.history.push({ at: now, status, reason }); }
  function refund(r) { if (!r.paid || r.departedAt != null || r.refunded) return 0; r.refunded = true; return r.paid; }
  function cancel(r, provider, now, reason) {
    if (!r || terminal.includes(r.status) || r.occupied) return false;
    if (r.status === 'withdrawing' || r.status === 'stranded' && r.resumeStatus === 'withdrawing') return false;
    if (r.departedAt == null) { if (provider?.vehicle.reservedBy === r.id) provider.vehicle.reservedBy = null; stage(r, 'cancelled', now, reason); }
    else { provider.driver.location = provider.vehicle.location = 'road'; stage(r, 'withdrawing', now, reason); }
    return true;
  }
  function board(r, p, f, now) {
    if (r?.status !== 'waiting' || now >= r.closesAt || !f.escaped || !f.mobile || !f.adjacent || f.busy || f.detected || !able(p.driver) || p.vehicle.condition < 50 || p.vehicle.fuelKm < p.distanceKm || f.cargoKg > p.vehicle.cargoKg || f.cargoL > p.vehicle.cargoL) return false;
    r.boardingSeconds = 0; r.lastAt = now; stage(r, 'boarding', now, 'Thirty seconds of uninterrupted physical boarding.'); return true;
  }
  function tick(r, p, now, f = {}) {
    if (!r || terminal.includes(r.status)) return;
    const elapsed = Math.max(0, now - r.lastAt); r.lastAt = now;
    if (r.status === 'offered') { if (now >= r.expiresAt || f.released) cancel(r, p, now, 'Offer expired or lawful release superseded escape.'); return; }
    if (f.released && !r.occupied) cancel(r, p, now, 'Custody ended; use ordinary discharge.');
    if (r.status === 'planned') {
      if (!able(p.driver) || p.vehicle.condition < 50 || p.vehicle.fuelKm < p.distanceKm * 2 || !p.destination.permission) { cancel(r, p, now, 'Reserved assets became unavailable before departure.'); return; }
      if (now >= r.pickupAt - p.distanceKm * 120) { r.departedAt = now; p.vehicle.occupants = [p.driver.id]; p.driver.location = p.vehicle.location = 'road'; stage(r, 'outbound', now, 'Named driver departed on the local route.'); }
      return;
    }
    if (['waiting', 'boarding'].includes(r.status)) {
      if (f.detected || f.recaptured || now >= r.closesAt || !able(p.driver) || !p.destination.permission) { r.identified ||= Boolean(f.detected); cancel(r, p, now, f.detected ? 'Actual staff observation exposed the pickup; the helper withdraws.' : 'Pickup failed; the driver returns without the scientist.'); return; }
      if (r.status === 'boarding') {
        if (!f.mobile || !f.adjacent || f.busy || !f.escaped || f.cargoKg > p.vehicle.cargoKg || f.cargoL > p.vehicle.cargoL) { stage(r, 'waiting', now, 'Boarding interrupted; no passenger was moved.'); return; }
        r.boardingSeconds += elapsed;
        if (r.boardingSeconds >= 30) { r.occupied = true; r.boardedAt = now; p.vehicle.occupants = [p.driver.id, 'scientist']; p.driver.location = p.vehicle.location = 'road'; stage(r, 'returning', now, 'Scientist physically boarded; local journey underway.'); }
      }
      return;
    }
    if (['outbound', 'returning', 'withdrawing', 'stranded'].includes(r.status)) {
      const needsFuel = r.distanceTravelledKm > 0 || r.status === 'outbound' || r.status === 'stranded' && r.resumeStatus === 'outbound';
      if (!able(p.driver) || p.vehicle.condition < 50 || p.vehicle.fuelKm <= 0 && needsFuel || r.occupied && r.distanceTravelledKm === 0 && !p.destination.permission) { if (r.status !== 'stranded') { r.resumeStatus = r.status; stage(r, 'stranded', now, 'The actual vehicle cannot proceed or unload; occupants and route position remain here.'); } return; }
      if (r.status === 'stranded') { stage(r, r.resumeStatus, now, 'The same driver and vehicle can continue.'); return; }
      const outbound = r.status === 'outbound', remaining = outbound ? p.distanceKm - r.distanceTravelledKm : r.distanceTravelledKm;
      const distance = Math.min(remaining, elapsed / 120, p.vehicle.fuelKm);
      p.vehicle.fuelKm -= distance; r.distanceTravelledKm += outbound ? distance : -distance;
      if (distance + 1e-8 >= remaining) {
        r.distanceTravelledKm = outbound ? p.distanceKm : 0;
        if (outbound) { p.driver.location = p.vehicle.location = 'pickup'; stage(r, 'waiting', now, 'Driver waiting at the agreed service-lane rendezvous.'); }
        else {
          if (r.occupied && !p.destination.permission) { r.resumeStatus = 'returning'; stage(r, 'stranded', now, 'Receiving permission was withdrawn; no automatic admission or substitute destination.'); return; }
          p.driver.location = p.vehicle.location = 'receiving'; p.vehicle.reservedBy = null;
          stage(r, r.occupied ? 'complete' : 'withdrawn', now, r.occupied ? 'Arrived at the host-permitted local garage. No immunity, city admission or journey home.' : 'The same vehicle returned empty; spent fuel and fees remain spent.');
          r.arrivedAt = now; r.occupied = false; p.vehicle.occupants = [];
        }
      }
    }
  }
  return { terminal, service, reason, request, accept, cancel, refund, board, tick };
});
