(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCityApproach = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CHECKPOINT = "cityReceivingCheckpoint", ANNEX = "cityVisitorAnnex", Z = 16;
  const LANDING = Object.freeze({ x: 6, y: 7, z: Z });
  const DESK = Object.freeze({ x: 10, y: 7, z: Z });
  const ENTRY = Object.freeze({ x: 15, y: 7, z: Z });
  const clone = x => JSON.parse(JSON.stringify(x));
  const terminal = new Set(["returned", "settled", "failed", "cancelled", "expired"]);
  function create() { return { gates: [], trips: [], activeId: null, nextTrip: 1, consents: [] }; }
  function active(s) { return s?.trips.find(t => t.id === s.activeId) || null; }
  function ongoing(t) { return Boolean(t && !terminal.has(t.status)); }
  function stage(t, status, now, delay, reason) {
    t.status = status; t.nextAt = delay == null ? null : now + delay; t.reason = reason;
    t.history.push({ at: now, status, reason });
  }
  function transportReason(provider, km, now, reservationId = null) {
    if (!provider) return "No existing pilot, aircraft, and receiving pad are available.";
    const a = provider.aircraft, p = provider.pilot;
    if (!p || p.status !== "alive" || p.health < 50 || p.location !== "receivingPad") return "The actual pilot is not fit and present at the private pad.";
    if (!a || a.condition < 50 || a.readyAt > now || a.reservedBy && a.reservedBy !== reservationId) return "The aircraft is damaged, reserved, or still turning around.";
    if (!Number.isFinite(km) || km <= 0 || km > a.rangeKm || a.fuelKm < km * 2 + 50) return "The actual aircraft lacks range or fuel for the journey, return, and reserve.";
    return "";
  }
  function gate(facts) {
    const suffix = facts.cityId.replace(/[^a-zA-Z0-9_-]/g, ""), z = facts.z ?? Z;
    return { ...clone(facts), z, checkpointRoomId: `${CHECKPOINT}-${suffix}`, annexRoomId: `${ANNEX}-${suffix}`, doorId: `door-city-reception-${suffix}`,
      clerk: { ...clone(facts.clerk), mapCell: { ...facts.clerk.mapCell, z } }, guard: { ...clone(facts.guard), mapCell: { ...facts.guard.mapCell, z } },
      powerSeconds: 86400, lastAt: facts.createdAt, berthReservedBy: null,
      admissionPolicy: ["fragile", "strained"].includes(facts.capacityBand) ? "registeredAnnexOnly" : "ordinaryVisitor",
      policyText: "A named reception permit authorizes the landing apron, identity desk, waiting area and return boarding only, including for a locally banished applicant. It neither suspends the wider ban nor authorizes detention. Review may remain pending; no supplies or legal relief are promised." };
  }
  function request(s, gateId, providerId, manifest, km, now) {
    if (ongoing(active(s)) || !manifest.some(p => p.id === "scientist")) return null;
    const t = { id: `city-approach-${s.nextTrip++}`, gateId, providerId, manifest: clone(manifest), distanceKm: km,
      status: "requested", nextAt: now + 120, history: [], requestedAt: now, decisions: [], boardedIds: [], enteredIds: [], reason: "The pilot transmitted an openly identified manifest. Receiving permission is not yet granted." };
    s.trips.push(t); s.activeId = t.id; return t;
  }
  function offer(t, g, p, now, reason = "") {
    const blocked = reason || !g?.institutionId && "No city institution can authorize this reception." || g?.berthReservedBy && "The city receiving berth is reserved.";
    if (blocked) { stage(t, "failed", now, null, blocked); return false; }
    t.offer = { fee: Math.ceil(300 + t.distanceKm * 4), expiresAt: now + 3600, flightSeconds: Math.ceil(t.distanceKm / 210 * 3600),
      aircraftId: p.aircraft.id, pilotName: p.pilot.name, seats: p.aircraft.passengerSeats, cargoKg: p.aircraft.cargoKg, cargoL: p.aircraft.cargoL,
      returnTerms: "Round trip paid at departure. Aircraft remains reserved at the checkpoint until you board the return or explicitly release it. No automatic eviction, free food, refuelling, or guarantee against later physical damage." };
    t.permit = { id: `${t.id}:reception-permit`, cityId: g.cityId, institutionId: g.institutionId, personIds: t.manifest.map(p => p.id),
      scope: "checkpointAndReturnOnly", overridesBanishmentWithinScope: true, status: "offered" };
    stage(t, "offered", now, 3600, "The receiving institution offers limited checkpoint permission. Entry beyond the checkpoint requires a separate individual decision."); return true;
  }
  function accept(t, g, p, money, now) {
    if (t.status !== "offered" || now >= t.offer.expiresAt || money < t.offer.fee || g.berthReservedBy || transportReason(p, t.distanceKm, now)) return false;
    if (t.manifest.length > p.aircraft.passengerSeats || new Set(t.manifest.map(x => x.id)).size !== t.manifest.length) return false;
    t.payment = { amount: t.offer.fee, refunded: false }; p.aircraft.reservedBy = t.id; g.berthReservedBy = t.id; t.permit.status = "active";
    stage(t, "preparing", now, 300, "Round-trip escrow paid; the named aircraft and receiving berth are reserved. Walk to the aircraft when preparation finishes."); return true;
  }
  function refund(t) {
    if (t.departedAt != null || !t.payment || t.payment.refunded) return 0;
    t.payment.refunded = true; return t.payment.amount;
  }
  function decision(person, g, evidence, bans, now) {
    const base = { personId: person.id, at: now, cityId: g.cityId, clerkId: g.clerk.id, identityVerified: false, entered: false };
    if (!evidence?.present || !evidence.sourceOrderId) return { ...base, status: "pending", reason: "No matching identity record was presented. Further documentation is required; there is no automatic arrest." };
    if (!evidence.connection || evidence.recognition === "caseReview") return { ...base, status: "pending", reason: "Identity verification needs a working records channel or individual review. Repeating the same facts does not resolve it." };
    if (evidence.recognition === "refused") return { ...base, status: "refused", reason: "This city does not accept the presented foreign identity record. Refusal of entry is not a custody order." };
    if (!["automatic", "verified", "domestic"].includes(evidence.recognition)) return { ...base, status: "pending", reason: "No applicable identity-recognition rule is available." };
    base.identityVerified = true;
    const restriction = bans.find(b => b.personId === person.id && b.status === "active" && (b.cityId === g.cityId || (b.recognizedBy || []).some(r => r.cityId === g.cityId && r.localOrderId && r.institutionId && r.status === "active")));
    if (restriction) return { ...base, status: "refused", sourceOrderId: restriction.orderId, reason: "An active banishment applies under this city's own authority. Your limited checkpoint permit remains valid for waiting and departure. The completed sentence is not reactivated." };
    if (g.admissionPolicy === "registeredAnnexOnly") return { ...base, status: "conditional", scope: "visitorAnnexOnly", reason: "Limited reception capacity: register for accommodation in the visitor annex only. No city-wide access, employment, resupply, or permanent refuge is promised." };
    return { ...base, status: "admitted", scope: "ordinaryVisitor", reason: "Ordinary visitor admission authorized. Only the reception area is materialized in this pass; onward city travel remains separate." };
  }
  function canEnter(d, acceptsConditions) { return Boolean(d && (d.status === "admitted" || d.status === "conditional" && acceptsConditions)); }
  function checkpointAuthorized(t, personId) { return t?.permit?.status === "active" && t.permit.scope === "checkpointAndReturnOnly" && t.permit.personIds.includes(personId) && !(t.permit.departedIds || []).includes(personId); }
  return { CHECKPOINT, ANNEX, Z, LANDING, DESK, ENTRY, create, active, ongoing, stage, transportReason, gate, request, offer, accept, refund, decision, canEnter, checkpointAuthorized };
});
