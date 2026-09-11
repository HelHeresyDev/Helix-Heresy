(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCastawayAssistance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CABIN = "castawayPickupCabin", PAD = "castawayReceivingPad";
  const clone = x => JSON.parse(JSON.stringify(x));
  function create() { return { services: [], requests: [], introductions: [], nextRequest: 1, activeId: null, debts: [], initializedContacts: [] }; }
  function active(s) { return s.requests.find(r => r.id === s.activeId) || null; }
  function ongoing(r) { return r && !["refused", "expired", "failed", "complete"].includes(r.status); }
  function service(contact, pad, pilotName, now) {
    return { id: `castaway-service:${contact.id}`, contactId: contact.id, pad: clone(pad),
      pilot: { id: `castaway-pilot:${contact.id}`, name: pilotName, health: 100, status: "alive", location: "receivingPad", cell: null },
      aircraft: { id: `castaway-aircraft:${contact.id}`, ownerId: contact.id, condition: 100, fuelKm: 1600, rangeKm: 800, passengerSeats: 2, cargoKg: 40, cargoL: 60, readyAt: now, reservedBy: null } };
  }
  function reason(contact, provider, distance, now) {
    if (!contact || contact.trust < 25) return "The contact is unwilling to risk a pickup without an established working relationship.";
    if (contact.unavailableUntil > now) return "The contact cannot arrange assistance while unavailable.";
    if (!provider) return "No existing aircraft, named pilot, and controlled receiving pad are available through this contact.";
    const a = provider.aircraft, p = provider.pilot;
    if (p.status !== "alive" || p.health < 50 || p.location !== "receivingPad") return "The named pilot is not fit and available at the receiving pad.";
    if (a.condition < 50 || a.reservedBy || a.readyAt > now) return "The aircraft is damaged, occupied, reserved, or still turning around.";
    if (!Number.isFinite(distance) || distance <= 0 || distance > a.rangeKm || a.fuelKm < distance * 2 + 50) return "The actual aircraft cannot make this round trip with its fuel reserve.";
    return "";
  }
  function request(s, contact, provider, message, now) {
    if (ongoing(active(s))) return null;
    const fingerprint = JSON.stringify([contact?.id, contact?.trust, Boolean(contact?.unavailableUntil > now), provider?.aircraft, provider?.pilot, message]);
    if (s.requests.some(r => r.fingerprint === fingerprint && r.status === "refused")) return null;
    const r = { id: `castaway-request-${s.nextRequest++}`, contactId: contact.id, serviceId: provider?.id || null, message: clone(message), fingerprint, status: "assessing", nextAt: now + 60, requestedAt: now, lastReport: { at: now, status: "sent", reason: "Request transmitted; no rescue promised." }, history: [], reason: "Request received for assessment." };
    s.requests.push(r); s.activeId = r.id; return r;
  }
  function stage(r, status, now, delay, reason) { r.status = status; r.nextAt = now + delay; r.reason = reason; r.history.push({ at: now, status, reason }); }
  function assess(r, contact, provider, now, weatherReason = "") {
    if (r.status !== "assessing") return false;
    const blocked = reason(contact, provider, r.message.distanceKm, now) || weatherReason;
    if (blocked) { stage(r, "refused", now, 0, blocked); return true; }
    r.offer = { fee: Math.ceil(500 + r.message.distanceKm * 4), debtAvailable: contact.trust >= 60, expiresAt: now + 3600, seats: provider.aircraft.passengerSeats, cargoKg: provider.aircraft.cargoKg, cargoL: provider.aircraft.cargoL, destination: clone(provider.pad), pilotName: provider.pilot.name, aircraftId: provider.aircraft.id, rendezvous: clone(r.message.cell), flightSeconds: Math.ceil(r.message.distanceKm / 210 * 3600) };
    stage(r, "offered", now, 3600, "A specific pickup is offered, not dispatched. Pre-departure cancellation refunds payment; a launched attempt is charged even if unsuccessful. Walking passengers only; no casualty equipment."); return true;
  }
  function accept(s, r, provider, now, payment, money, passengers) {
    if (r.status !== "offered" || now >= r.offer.expiresAt || provider.aircraft.reservedBy || passengers.length > r.offer.seats || new Set(passengers).size !== passengers.length || !passengers.includes("scientist")) return false;
    if (payment !== "cash" && payment !== "debt" || payment === "debt" && !r.offer.debtAvailable || payment === "cash" && money < r.offer.fee) return false;
    r.payment = { kind: payment, amount: payment === "debt" ? Math.ceil(r.offer.fee * 1.25) : r.offer.fee, refunded: false };
    r.passengers = [...passengers]; provider.aircraft.reservedBy = r.id;
    if (payment === "debt") s.debts.push({ requestId: r.id, creditorId: r.contactId, debtorId: "scientist", amount: r.payment.amount, status: "reserved" });
    stage(r, "preparing", now, 300, "Named pilot and aircraft reserved. Preparation is underway; no one has been transported."); return true;
  }
  function refund(s, r) {
    if (r.departedAt != null || !r.payment || r.payment.refunded) return 0;
    r.payment.refunded = true;
    const debt = s.debts.find(d => d.requestId === r.id); if (debt) debt.status = "cancelled";
    return r.payment.kind === "cash" ? r.payment.amount : 0;
  }
  return { CABIN, PAD, create, active, ongoing, service, reason, request, stage, assess, accept, refund };
});
