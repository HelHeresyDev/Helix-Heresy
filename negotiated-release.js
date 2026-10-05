(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./corridor-robbery') : root.HelixCorridorRobbery,
    typeof module === 'object' && module.exports ? require('./corridor-beasts') : root.HelixCorridorBeasts,
    typeof module === 'object' && module.exports ? require('./payment-records') : root.HelixPaymentRecords);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixNegotiatedRelease = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Robbery, Road, Payments) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = p => p?.status === 'alive' && p.health >= 50 && p.fatigue < 80;
  const close = (p, s) => Math.hypot(p.positionKm - s.positionKm, p.offRoadKm - (s.offRoadKm || 0)) <= .003;
  function bind(state, broker, at) {
    if (!broker || broker.homeCityId !== state.homeId || !broker.serviceCityIds?.includes(state.homeId)) return;
    state.releaseRelays ||= []; state.releaseRelayAllocations ||= [];
    if (!state.releaseRelayAllocations.includes(broker.id)) {
      state.releaseRelayAllocations.push(broker.id);
      state.releaseRelays.push({ id: broker.id, label: broker.name, active: true, channelPowered: true,
        energy: 16, workSeconds: 960, available: true, consent: true });
    }
    const relay = state.releaseRelays.find(r => r.id === broker.id);
    if (relay) relay.available = (broker.unavailableUntil || 0) <= at;
  }
  function contact(state, s, op, g) {
    const relay = state.releaseRelays?.find(r => r.id === op.brokerId), radio = Road.equipment(op).radio;
    const guard = g?.members.find(p => p.id === s.robbery?.guardId && able(p) && p.provisions > 0 && close(p, s));
    if (!guard || !relay?.active || !relay.available || !relay.consent || !relay.channelPowered || relay.energy < 1 || relay.workSeconds < 30
      || !radio.powered || !radio.connected || radio.charges < 1 || radio.custodianId !== guard.id
      || !radio.contacts?.some(c => c.carrierId === op.id && c.brokerId === relay.id)) return null;
    return { relay, radio, guard };
  }
  function spend(c) { c.relay.energy--; c.relay.workSeconds -= 30; c.radio.charges--; }
  const ids = s => s.manifest?.entries.map(e => e.stack?.id || e.creature?.id).filter(Boolean) || [];
  function possessed(s, op, g, offer) {
    return Boolean(g && s.phase === 'captured' && s.robbery?.endedAt == null && op.controllerId === g.id
      && op.vehicleId === offer.vehicleId && s.custodian === op.vehicleId
      && offer.crewIds.every(id => op.crew.some(p => p.id === id && p.status === 'alive' && p.capture?.active && p.capture.groupId === g.id))
      && JSON.stringify(ids(s)) === JSON.stringify(offer.cargoIds));
  }
  function act(state, id, action, offerId, payer, at) {
    const s = state.shipments.find(s => s.id === id), op = state.operators.find(o => o.id === s?.operatorId), n = s?.negotiatedRelease;
    if (!s || !op || !n || !Number.isFinite(at) || at < n.lastAt || n.offer.id !== offerId || n.receipt || n.declinedAt != null || at < n.offer.at || at >= n.offer.expiresAt) return false;
    const g = Robbery.groupFor(state, s), c = contact(state, s, op, g);
    if (!c || JSON.stringify(g.releaseOffer) !== JSON.stringify(n.offer) || !possessed(s, op, g, n.offer)) return false;
    if (action === 'decline') { spend(c); n.declinedAt = at; n.messages.push({ at, text: 'Broker relayed your refusal. This is not a release or a prediction of captor behavior.' }); return true; }
    if (action === 'proof') {
      const person = op.crew.find(p => p.status === 'alive' && p.health >= 25 && n.offer.crewIds.includes(p.id));
      if (!person || !g.releasePreferences.allowProof || n.proof) return false;
      spend(c); n.proof = { at, speakerClaim: person.name,
        statement: 'I am speaking under guard through the van communicator.',
        scope: 'Supervised contact with the original crew member at this time. Not freedom, a full identity verification, cargo inspection or a guarantee of future safety.' };
      return true;
    }
    if (action !== 'accept') return false;
    const provider = state.paymentProviders?.find(p => p.id === n.offer.providerId);
    if (!provider) return false;
    const receipt = Payments.voluntaryTransfer(provider, payer, g.receivingAccount, n.offer, at);
    if (!receipt) return false;
    spend(c); n.receipt = receipt; n.lastAt = at; n.releaseProgress = 0;
    n.messages.push({ at, text: 'Payment receipt received. Custody and location have not changed; await a witnessed release report.' });
    return true;
  }
  function tick(state, s, op, at) {
    const g = Robbery.groupFor(state, s);
    if (!s.negotiatedRelease && g?.releasePreferences?.offer && s.robbery?.phase === 'holding' && s.robbery.endedAt == null) {
      const c = contact(state, s, op, g), provider = state.paymentProviders?.find(p => p.active && p.sponsor === op.brokerId);
      const observation = s.robbery.observations.at(-1), cargoIds = ids(s);
      if (!c || !provider || !g.receivingAccount?.active || !Number.isFinite(g.releasePreferences.amount) || g.releasePreferences.amount <= 0
        || !observation || cargoIds.some(id => !observation.items.some(i => i.id === id))) return;
      const offer = { id: `${s.id}:release-offer`, at, expiresAt: at + 7200, providerId: provider.id, fee: provider.fee,
        recipientId: g.receivingAccount.id, amount: g.releasePreferences.amount, vehicleId: op.vehicleId,
        crewIds: op.crew.filter(p => p.status === 'alive' && p.capture?.active).map(p => p.id), cargoIds,
        rendezvous: { routeId: s.routeId, positionKm: s.positionKm, offRoadKm: s.offRoadKm || 0 },
        terms: 'Claimed release of the named crew, original van, observed cargo and held communicator at the stated refuge. Original driver must drive home; no towing, medical evacuation, repair, resupply or restored sale. Payment is not proof of compliance.' };
      if (!offer.crewIds.length || !possessed(s, op, g, offer)) return;
      g.releaseOffer = copy(offer);
      spend(c); s.negotiatedRelease = { offer: copy(offer), messages: [{ at, text: 'Known carrier contact relays a captor demand. Possession and release are claims, not independently verified facts.' }], lastAt: at };
    }
    const n = s.negotiatedRelease;
    if (!n || at <= n.lastAt) return;
    const dt = Math.min(1, at - n.lastAt); n.lastAt = at;
    if (n.receipt && n.releasedAt == null) {
      // Saved willingness is private, not a public betrayal/intent indicator.
      const guard = g?.members.find(p => p.id === s.robbery.guardId && able(p) && p.provisions > 0 && close(p, s));
      if (!g?.releasePreferences.honor || !guard || !possessed(s, op, g, n.offer) || g.barrier || !g.visible) { n.releaseProgress = 0; return; }
      n.releaseProgress += dt;
      if (n.releaseProgress < 60) return;
      Robbery.release(g, s, op, at, 'negotiatedRelease'); n.releasedAt = at;
      s.returnRequestedAt ??= at;
      Road.report(s, op, at, 'Driver reports the guard relinquished control and the crew are free. Return still requires the original vehicle and a feasible route.');
      return;
    }
    if (n.releasedAt != null && n.roadReachedAt == null) {
      if (op.controllerId || !g?.refuge.trailOpen || !Road.equipment(op).controlsAccessible || op.condition <= 50 || op.fuelKm <= 0 || op.provisions <= 0
        || !op.crew.length || !op.crew.every(p => able(p) && (!p.locationId || p.locationId === op.vehicleId))) return;
      const moved = Math.min(s.offRoadKm || 0, dt * 10 / 3600, op.fuelKm, (op.condition - 50) / .02,
        ...op.crew.map(p => Math.max(0, (80 - p.fatigue) / .04)));
      s.offRoadKm = Math.max(0, (s.offRoadKm || 0) - moved); op.fuelKm -= moved; op.condition -= moved * .02;
      op.crew.forEach(p => { p.fatigue += moved * .04; }); op.location = `${s.routeId}:release-trail:${s.offRoadKm}`;
      if (s.offRoadKm < 1e-8) { s.offRoadKm = 0; n.roadReachedAt = at; s.phase = 'returning';
        Road.report(s, op, at, 'Driver reports reaching the corridor in the original van and beginning the return journey.'); }
    }
  }
  function arrival(s, op, at) {
    const n = s.negotiatedRelease;
    if (n?.releasedAt != null && !n.arrivalReported && ['returned', 'returnWaiting'].includes(s.phase)) {
      n.arrivalReported = true;
      Road.report(s, op, at, s.phase === 'returned' ? 'Driver reports arrival back at the home depot; cargo recovery remains a separate physical handoff.'
        : 'Handler reports arrival at the Concealed Exit. The living specimen still requires an actual receiving handoff.');
    }
  }
  return { bind, act, tick, arrival };
});
