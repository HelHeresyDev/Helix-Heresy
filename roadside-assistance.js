(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./corridor-beasts') : root.HelixCorridorBeasts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRoadsideAssistance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Road) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = p => p?.status === 'alive' && p.health >= 50 && p.fatigue < 80;
  const atVan = (p, op) => !p.locationId || p.locationId === op.vehicleId;
  const open = (route, sh) => route?.id === sh.routeId && route.supportCapable && !['closed', 'none'].includes(route.continuity)
    && route.distanceKm === sh.distanceKm && route.endpointCityIds?.includes(sh.sourceId) && route.endpointCityIds?.includes(sh.destinationId);
  function provision(state, broker, at) {
    if (state.assistanceAllocated || !broker || broker.homeCityId !== state.homeId || !broker.serviceCityIds?.includes(state.homeId)) return;
    state.assistanceAllocated = true;
    const id = state.homeId + ':recovery-outfit';
    state.roadsideAssistance = { id, brokerId: broker.id, homeId: state.homeId, willing: true, active: true,
      channelPowered: true, messagesLeft: 40, assignment: null, money: 600, quote: null, nextNumber: 1,
      vehicleId: id + ':truck', condition: 100, fuelKm: 300, provisions: 24, positionKm: 0, offRoadKm: 0,
      supplies: { fuelKm: 80, food: 8, repairParts: 20, medicalPacks: 4 },
      equipment: { winch: true, stretcher: true, towCapacityKg: 4000, patientSpaces: 1, passengerSeats: 2 },
      crew: ['driver', 'mechanic', 'attendant'].map(role => ({ id: id + ':' + role, name: 'Recovery ' + role,
        role, status: 'alive', health: 100, fatigue: 0 })),
      clinic: { id: id + ':depot-clinic', locationId: state.homeId, active: true, beds: 2, patients: [],
        attendant: { id: id + ':clinic-attendant', status: 'alive', health: 100, fatigue: 0 }, medicalPacks: 8 },
      establishedAt: at };
    Road.equipment(state.roadsideAssistance);
  }
  const available = a => a?.active && a.willing && a.channelPowered && a.messagesLeft > 0;
  const capable = a => a.condition > 50 && a.fuelKm > 0 && a.provisions > 0 && a.crew.every(able);
  const active = (state, sh) => Boolean(sh && state.roadsideAssistance?.assignment === sh.id);
  const roundTripReady = (a, q) => {
    const distance = 2 * (q.positionKm + q.offRoadKm + q.localDistanceKm);
    return a.fuelKm >= distance && a.condition - distance * .03 > 50
      && a.crew.every(p => p.fatigue + distance * .08 < 80);
  };
  function message(a, job, at, text) {
    if (!a.channelPowered || a.messagesLeft <= 0 || !a.crew.some(p => p.status === 'alive' && p.health >= 25)) return;
    a.messagesLeft--; job.messages.push({ at, text });
  }
  function quote(state, id, route, localRoute, at) {
    const a = state.roadsideAssistance, sh = state.shipments.find(s => s.id === id);
    const op = state.operators.find(o => o.id === sh?.operatorId);
    if (!sh || !op || !available(a) || a.assignment || !capable(a) || !open(route, sh)
      || !Number.isFinite(at) || op.brokerId !== a.brokerId || sh.receiptAt != null || sh.assistance?.phase === 'reserved') return null;
    const report = sh.corridorReports?.filter(r => r.availableForAssistance && r.routeId === sh.routeId
      && at >= r.at && at - r.at <= 7200).at(-1);
    if (!report || !Number.isFinite(report.positionKm) || report.positionKm < 0 || report.positionKm > route.distanceKm
      || !Number.isFinite(report.offRoadKm) || report.offRoadKm < 0 || report.offRoadKm > .5) return null;
    if (sh.living && (!localRoute?.ok || localRoute.cityId !== state.homeId || localRoute.distanceKm !== sh.localDistanceKm)) return null;
    const distance = 2 * (report.positionKm + report.offRoadKm + (sh.living ? sh.localDistanceKm : 0));
    if (a.fuelKm < distance || a.condition - distance * .03 <= 50 || a.crew.some(p => p.fatigue + distance * .08 >= 80)) return null;
    const q = { id: a.id + ':quote:' + a.nextNumber++, shipmentId: id, at, expiresAt: at + 3600,
      reportAt: report.at, routeId: sh.routeId, positionKm: report.positionKm, offRoadKm: report.offRoadKm,
      vehicleId: a.vehicleId, crew: a.crew.map(p => p.name), fee: Math.ceil(180 + distance * 3),
      destination: a.clinic.id, localDistanceKm: sh.living ? sh.localDistanceKm : 0,
      terms: 'Paid attempt at the dated reported location, not tracking or guaranteed recovery. One patient space, two walking passengers; original van stays loaded. Minor repairs and finite resupply only; towing needs an accessible intact tow point and capacity. No armed rescue, healing, automatic refund after departure, or restored sale.' };
    a.messagesLeft--; a.quote = copy(q); return copy(q);
  }
  function accept(state, id, quoteId, payer, route, at) {
    const a = state.roadsideAssistance, sh = state.shipments.find(s => s.id === id), q = a?.quote;
    if (!sh || !q || q.shipmentId !== id || q.id !== quoteId || !available(a) || a.assignment || !capable(a)
      || !roundTripReady(a, q) || !open(route, sh) || !Number.isFinite(at) || at < q.at || at >= q.expiresAt || !Number.isFinite(payer?.money) || payer.money < q.fee) return false;
    if (sh.assistance) (sh.assistanceHistory ||= []).push(copy(sh.assistance));
    payer.money -= q.fee; a.assignment = id; a.quote = null;
    sh.assistance = { id: q.id, quote: copy(q), phase: 'reserved', escrow: q.fee, lastAt: at, progress: 0,
      messages: [{ at, text: 'Recovery assets reserved. Dispatch fee held until departure; cancellation before departure refunds it.' }],
      convoy: { id: q.id + ':vehicle', routeId: sh.routeId, distanceKm: sh.distanceKm, phase: 'outbound', positionKm: 0, offRoadKm: 0, receiptAt: null } };
    return true;
  }
  function cancel(state, id, payer, at) {
    const a = state.roadsideAssistance, sh = state.shipments.find(s => s.id === id), j = sh?.assistance;
    if (!active(state, sh) || j?.phase !== 'reserved' || at < j.lastAt || !Number.isFinite(payer?.money)) return false;
    payer.money += j.escrow; j.escrow = 0; j.phase = 'canceled'; a.assignment = null;
    j.messages.push({ at, text: 'Undispatched reservation canceled; held dispatch fee refunded.' }); return true;
  }
  function danger(state, sh, a) {
    const group = state.roadsideGroups?.find(s => s.routeId === sh.routeId)?.group;
    if (group?.visible && !group.barrier && !(sh.robbery?.endedAt != null && group.recoveryPassage)
      && group.members.some(p => able(p) && p.weapon?.ammunition > 0
        && Math.hypot(p.positionKm - a.positionKm, p.offRoadKm - a.offRoadKm) < .2)) return true;
    return state.corridorBeasts?.find(s => s.routeId === sh.routeId)?.actors.some(b => b.status === 'alive'
      && b.health > 0 && b.effortSeconds > 0 && Math.hypot(b.positionKm - a.positionKm, b.offsetKm - a.offRoadKm) < .2);
  }
  function move(a, j, x, y, speed, dt) {
    const gap = Math.hypot(x - a.positionKm, y - a.offRoadKm);
    const moved = Math.max(0, Math.min(gap, speed * dt / 3600, a.fuelKm, (a.condition - 50) / .03,
      ...a.crew.map(p => (80 - p.fatigue) / .08)));
    if (gap > 0) { a.positionKm += (x - a.positionKm) / gap * moved; a.offRoadKm += (y - a.offRoadKm) / gap * moved; }
    a.fuelKm -= moved; a.condition -= moved * .03; a.crew.forEach(p => { p.fatigue += moved * .08; });
    j.convoy.positionKm = a.positionKm; j.convoy.offRoadKm = a.offRoadKm;
    return gap - moved < 1e-8;
  }
  function finish(a, sh, op, at, success) {
    const j = sh.assistance; j.phase = 'complete'; j.completedAt = at; a.assignment = null; j.convoy.phase = 'returned';
    if (success) {
      sh.phase = 'returned'; sh.returnedAt = at; op.assignment = null; op.location = sh.sourceId;
      for (const p of op.crew) if (p.locationId === a.vehicleId) p.locationId = op.vehicleId;
      if (sh.manifest && sh.owner === 'player') sh.custodian = 'covert-depot:' + sh.sourceId;
    }
    message(a, j, at, success ? 'Recovery crew reports return to the home depot. Original cargo remains subject to its separate receiving handoff.'
      : 'Recovery crew reports returning without recovery. The dispatch fee was spent; no new convoy location is known.');
  }
  // Called in convoy chronological steps. Original cargo care remains owned by LivingSmuggling.
  function tick(state, sh, op, route, localRoute, at) {
    if (!active(state, sh)) return false;
    const a = state.roadsideAssistance, j = sh.assistance;
    if (at <= j.lastAt) return Boolean(j.attached);
    const dt = Math.min(1, at - j.lastAt); j.lastAt = at;
    a.provisions = Math.max(0, a.provisions - dt / 28800);
    if (j.phase === 'reserved') {
      if (!available(a) || !capable(a) || !open(route, sh)) return false;
      a.money += j.escrow; j.escrow = 0; j.departedAt = at; j.phase = 'outbound';
      message(a, j, at, 'Recovery crew reports departure toward the dated reported position. Dispatch fee committed.'); return false;
    }
    const reportCount = j.convoy.corridorReports?.length || 0;
    // Passengers keep their original identities but are vulnerable in the vehicle
    // they actually occupy, not in the now-empty towed cabin.
    const helpers = a.crew;
    try {
      a.crew = [...helpers, ...op.crew.filter(p => p.locationId === a.vehicleId)];
      Road.tick(state, j.convoy, a, route, at);
    } finally { a.crew = helpers; }
    for (const report of (j.convoy.corridorReports || []).slice(reportCount)) message(a, j, at, 'Recovery vehicle: ' + report.text);
    if (!capable(a)) return Boolean(j.attached);
    const local = ['localOut', 'handoff', 'localBack'].includes(j.phase);
    if (local ? !localRoute?.ok || localRoute.cityId !== state.homeId || localRoute.distanceKm !== j.quote.localDistanceKm : !open(route, sh)) return Boolean(j.attached);
    const sideOpen = a.offRoadKm <= 0 && j.quote.offRoadKm <= 0 || state.roadsideGroups?.find(s => s.routeId === sh.routeId)?.group?.refuge.trailOpen;
    if (!local && !sideOpen && (a.offRoadKm > 0 || j.phase === 'outbound' && a.positionKm >= j.quote.positionKm - .001)) return Boolean(j.attached);
    if (!local && danger(state, sh, a)) {
      if (j.attached) return true;
      if (j.phase !== 'withdraw') message(a, j, at, 'Recovery crew reports a nearby threat and is withdrawing without an armed intervention.');
      j.phase = 'withdraw'; j.progress = 0;
    }
    if (j.phase === 'outbound') {
      const reached = a.positionKm < j.quote.positionKm - 1e-8
        ? move(a, j, j.quote.positionKm, 0, 24, dt) && j.quote.offRoadKm === 0
        : move(a, j, j.quote.positionKm, j.quote.offRoadKm, 8, dt);
      if (!reached) return false;
      if (Math.hypot(sh.positionKm - a.positionKm, (sh.offRoadKm || 0) - a.offRoadKm) > .003
        || op.controllerId || sh.phase === 'captured' || op.crew.some(p => p.capture?.active)
        || Road.equipment(op).acceptAssistance === false
        || !['outbound', 'returning', 'stranded'].includes(sh.phase)) {
        j.phase = 'withdraw'; message(a, j, at, 'Recovery crew could not collect a free convoy at the reported rendezvous. No search or forced entry attempted.'); return false;
      }
      j.phase = 'assess'; j.attached = true; sh.phase = 'stranded'; sh.returnRequestedAt ??= at;
      message(a, j, at, 'Recovery crew reports physical contact with the free convoy; assessing repair, patient and towing needs.'); return true;
    }
    if (j.phase === 'withdraw') {
      const reached = a.offRoadKm > 1e-8 ? move(a, j, a.positionKm, 0, 8, dt) && a.positionKm < 1e-8 : move(a, j, 0, 0, 24, dt);
      if (reached) finish(a, sh, op, at, false); return false;
    }
    if (j.attached && (op.controllerId || op.crew.some(p => p.capture?.active))) return true;
    if (j.phase === 'assess') {
      j.progress += dt; if (j.progress < 60) return true;
      const patients = op.crew.filter(p => atVan(p, op) && p.status === 'alive' && !able(p));
      const walking = op.crew.filter(p => atVan(p, op) && able(p));
      const mass = 2400 + (sh.cargo?.massKg || 0);
      const repair = op.condition >= 40 && op.condition < 60 ? 60 - op.condition : 0;
      if (!Road.equipment(op).controlsAccessible || !a.equipment.winch || op.towPointIntact === false || mass > a.equipment.towCapacityKg
        || patients.length > a.equipment.patientSpaces || walking.length > a.equipment.passengerSeats
        || patients.length && (!a.equipment.stretcher || a.supplies.medicalPacks < patients.length)) {
        j.attached = false; j.phase = 'withdraw'; message(a, j, at, 'Recovery crew reports that equipment, access or capacity prevents safe loading. Returning without recovery.'); return false;
      }
      j.patients = patients.map(p => p.id); j.repair = repair <= a.supplies.repairParts ? repair : 0;
      j.assessedCondition = op.condition;
      j.progress = 0; j.phase = 'service'; return true;
    }
    if (j.phase === 'service') {
      if (op.condition !== j.assessedCondition) { j.phase = 'assess'; j.progress = 0; return true; }
      const patients = op.crew.filter(p => atVan(p, op) && p.status === 'alive' && !able(p));
      if (!Road.equipment(op).controlsAccessible || !a.equipment.winch || op.towPointIntact === false
        || 2400 + (sh.cargo?.massKg || 0) > a.equipment.towCapacityKg
        || patients.length > a.equipment.patientSpaces || op.crew.filter(p => atVan(p, op) && able(p)).length > a.equipment.passengerSeats
        || patients.length && (!a.equipment.stretcher || a.supplies.medicalPacks < patients.length)
        || a.supplies.repairParts < j.repair) { j.progress = 0; return true; }
      j.progress += dt; if (j.progress < 120 + j.repair * 10) return true;
      j.patients = patients.map(p => p.id);
      a.supplies.repairParts -= j.repair; op.condition += j.repair;
      const fuel = Math.min(a.supplies.fuelKm, Math.max(0, 2 * (sh.positionKm + (sh.offRoadKm || 0)) + 5 - op.fuelKm));
      a.supplies.fuelKm -= fuel; op.fuelKm += fuel;
      const food = Math.min(a.supplies.food, Math.max(0, 2 - op.provisions)); a.supplies.food -= food; op.provisions += food;
      j.mode = op.condition > 50 && op.crew.length > 0 && op.crew.every(p => atVan(p, op) && able(p)) && op.fuelKm > sh.positionKm + (sh.offRoadKm || 0) + j.quote.localDistanceKm * 2 && op.provisions > 0 ? 'escort' : 'tow';
      a.supplies.medicalPacks -= j.patients.length;
      for (const p of op.crew) if (j.mode === 'tow' && p.status === 'alive' && atVan(p, op)) p.locationId = a.vehicleId;
      j.phase = 'return'; j.progress = 0;
      message(a, j, at, 'Recovery crew reports completed loading and ' + j.mode + ' preparation. Wounds remain; departure is not arrival.'); return true;
    }
    if (j.phase === 'return' || j.phase === 'localOut' || j.phase === 'localBack') {
      if (j.mode === 'escort' && (op.condition <= 50.001 || op.fuelKm < 24 * dt / 3600 || op.provisions <= 0 || !op.crew.every(able))) return true;
      const oldX = a.positionKm, oldY = a.offRoadKm;
      let reached;
      if (j.phase === 'return' && a.offRoadKm > 1e-8) reached = move(a, j, a.positionKm, 0, 8, dt) && a.positionKm < 1e-8;
      else reached = move(a, j, j.phase === 'localOut' ? j.quote.localDistanceKm : 0, 0, j.mode === 'tow' ? 16 : 24, dt);
      const moved = Math.hypot(a.positionKm - oldX, a.offRoadKm - oldY);
      if (j.mode === 'escort') {
        op.fuelKm -= moved; op.condition = Math.max(0, op.condition - moved * .02); op.crew.forEach(p => { p.fatigue += moved * .04; });
      }
      sh.positionKm = a.positionKm; sh.offRoadKm = a.offRoadKm; op.location = (local ? 'local recovery:' : sh.routeId + ':recovery:') + sh.positionKm;
      if (!reached) return true;
      if (j.phase === 'return') { j.phase = 'clinic'; return true; }
      if (j.phase === 'localOut') { j.phase = 'handoff'; sh.phase = 'returnWaiting'; message(a, j, at, 'Recovery crew reports arrival at the Concealed Exit. The living specimen still requires the scientist and a usable receiving container.'); return true; }
      finish(a, sh, op, at, true); return true;
    }
    if (j.phase === 'clinic') {
      const clinic = a.clinic, patients = op.crew.filter(p => p.status === 'alive' && j.patients.includes(p.id));
      if (patients.length && (!clinic.active || !able(clinic.attendant) || clinic.beds - clinic.patients.length < patients.length || clinic.medicalPacks < patients.length)) return true;
      clinic.medicalPacks -= patients.length;
      for (const p of patients) { p.locationId = clinic.id; clinic.patients.push({ personId: p.id, operatorId: op.id, admittedAt: at }); }
      if (patients.length) message(a, j, at, 'Recovery attendant reports patient handoff at the depot clinic. Admission does not heal wounds or return the driver to duty.');
      if (sh.living && sh.manifest?.entries.some(e => e.creature)) {
        j.phase = 'localOut'; j.convoy.routeId = 'local:' + state.homeId; sh.phase = 'returnLocal';
      } else finish(a, sh, op, at, true);
      return true;
    }
    if (j.phase === 'handoff') {
      if (!sh.manifest?.entries.some(e => e.creature)) { j.phase = 'localBack'; sh.phase = 'localEmpty'; }
      return true;
    }
    return Boolean(j.attached);
  }
  function advanceDetached(state, now, routes, localRoute) {
    const sh = state.shipments.find(s => active(state, s));
    if (!sh || ['outbound', 'returning', 'stranded', 'captured', 'returnLocal', 'returnWaiting', 'localEmpty'].includes(sh.phase)) return;
    const op = state.operators.find(o => o.id === sh.operatorId);
    for (let at = sh.assistance.lastAt + 1; at <= now && active(state, sh); at++) tick(state, sh, op, routes.find(r => r.id === sh.routeId), localRoute, at);
  }
  return { provision, quote, accept, cancel, tick, active, advanceDetached };
});
