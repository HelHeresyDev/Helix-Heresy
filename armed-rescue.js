(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./corridor-beasts') : root.HelixCorridorBeasts,
    typeof module === 'object' && module.exports ? require('./corridor-robbery') : root.HelixCorridorRobbery);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixArmedRescue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Road, Robbery) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = p => p?.status === 'alive' && p.health >= 50 && p.fatigue < 80;
  const armed = p => able(p) && !p.surrendered && p.weapon?.condition >= 50 && p.weapon.ammunition > 0;
  const gap = (a, b) => Math.hypot(a.positionKm - b.positionKm, (a.offRoadKm || 0) - (b.offRoadKm || 0));
  const open = (r, s) => r?.id === s.routeId && r.distanceKm === s.distanceKm && r.supportCapable
    && !['none', 'closed'].includes(r.continuity) && r.endpointCityIds?.includes(s.sourceId) && r.endpointCityIds?.includes(s.destinationId);
  const active = (state, s) => Boolean(s && state.armedRescue?.assignment === s.id);
  function provision(state, broker, at) {
    if (state.armedRescueAllocated || !broker || broker.homeCityId !== state.homeId || !broker.serviceCityIds?.includes(state.homeId)) return;
    state.armedRescueAllocated = true;
    const id = state.homeId + ':armed-extraction';
    state.armedRescue = { id, brokerId: broker.id, active: true, willing: true, channelPowered: true,
      messagesLeft: 40, money: 800, assignment: null, quote: null, nextNumber: 1,
      vehicleId: id + ':van', condition: 100, fuelKm: 240, provisions: 24, passengerSeats: 2,
      positionKm: 0, offRoadKm: 0, sightKm: .12,
      crew: ['leader', 'driver', 'rifleman'].map(role => ({ id: id + ':' + role, name: 'Extraction ' + role,
        role, status: 'alive', health: 100, fatigue: 0, protection: 40, positionKm: 0, offRoadKm: 0,
        locationId: id + ':van', weapon: { id: id + ':rifle:' + role, condition: 100, ammunition: 12, rangeKm: .08, nextShotAt: at } })),
      establishedAt: at };
    const team = state.armedRescue; team.radioHolderId = team.crew[0].id; Road.equipment(team);
  }
  const contact = t => t?.active && t.willing && t.channelPowered && t.messagesLeft > 0;
  function ready(t, distance) {
    return t.condition - distance * .03 > 50 && t.fuelKm >= distance && t.provisions > 0
      && t.crew.every(p => armed(p) && p.locationId === t.vehicleId && p.fatigue + distance * .08 < 80);
  }
  function intelligence(s, at) {
    const candidates = (s.corridorReports || []).map(r => ({ at: r.at, routeId: r.routeId, positionKm: r.positionKm,
      offRoadKm: r.offRoadKm || 0, source: 'dated convoy witness: ' + r.witnessId }));
    const offer = s.negotiatedRelease?.offer;
    if (offer) candidates.push({ at: offer.at, ...copy(offer.rendezvous), source: 'relayed captor claim; unverified' });
    return candidates.filter(r => r.routeId === s.routeId && Number.isFinite(r.at) && r.at <= at && at - r.at <= 7200
      && Number.isFinite(r.positionKm) && r.positionKm >= 0 && r.positionKm <= s.distanceKm
      && Number.isFinite(r.offRoadKm) && r.offRoadKm >= 0 && r.offRoadKm <= .5).sort((a, b) => b.at - a.at)[0];
  }
  function quote(state, id, route, at) {
    const t = state.armedRescue, s = state.shipments.find(x => x.id === id), op = state.operators.find(o => o.id === s?.operatorId);
    if (!s || !op || !Number.isFinite(at) || !contact(t) || t.assignment || op.brokerId !== t.brokerId || !open(route, s)) return null;
    const report = intelligence(s, at); if (!report) return null;
    const distance = 2 * (report.positionKm + report.offRoadKm);
    if (!ready(t, distance)) return null;
    const q = { id: t.id + ':offer:' + t.nextNumber++, shipmentId: id, at, expiresAt: at + 3600,
      report: copy(report), distance, fee: Math.ceil(500 + distance * 5), vehicleId: t.vehicleId,
      crew: t.crew.map(p => p.name), priority: 'peopleFirst',
      terms: 'Attempt extraction at the reported location. People first; original vehicle and cargo only if feasible. Two walking-passenger seats, no patient lifting, towing or prisoner transport. The team decides locally whether to engage or withdraw. No guaranteed rescue, reinforcements, refund after departure, or revived sale.' };
    t.messagesLeft--; t.quote = copy(q); return copy(q);
  }
  function accept(state, id, offerId, payer, route, at) {
    const t = state.armedRescue, s = state.shipments.find(x => x.id === id), q = t?.quote;
    if (!s || !q || q.shipmentId !== id || q.id !== offerId || !contact(t) || t.assignment || !ready(t, q.distance)
      || !open(route, s) || !Number.isFinite(at) || at < q.at || at >= q.expiresAt || !Number.isFinite(payer?.money) || payer.money < q.fee) return false;
    if (s.rescue) (s.rescueHistory ||= []).push(copy(s.rescue));
    payer.money -= q.fee; t.assignment = s.id; t.quote = null;
    s.rescue = { id: q.id, offer: copy(q), phase: 'reserved', lastAt: at, escrow: q.fee, progress: 0,
      passengers: [], shots: [], observations: [], messages: [{ at, text: 'Armed extraction attempt reserved; fee held until departure.' }],
      convoy: { id: q.id + ':convoy', routeId: s.routeId, distanceKm: s.distanceKm, phase: 'outbound',
        positionKm: 0, offRoadKm: 0, receiptAt: null } };
    return true;
  }
  function cancel(state, id, payer, at) {
    const s = state.shipments.find(x => x.id === id), j = s?.rescue;
    if (!active(state, s) || j.phase !== 'reserved' || !Number.isFinite(payer?.money) || at < j.lastAt) return false;
    payer.money += j.escrow; j.escrow = 0; j.phase = 'canceled'; state.armedRescue.assignment = null;
    j.messages.push({ at, text: 'Undispatched extraction canceled; held fee refunded.' }); return true;
  }
  function say(t, s, at, text, observedConvoy = false) {
    const holder = t.crew.find(p => p.id === t.radioHolderId && p.status === 'alive' && p.health >= 25);
    if (!holder || gap(holder, t) > t.sightKm || !t.channelPowered || t.messagesLeft <= 0) return false;
    t.messagesLeft--; s.rescue.messages.push({ at, text });
    if (observedConvoy && gap(holder, s) <= t.sightKm) (s.corridorReports ||= []).push({ at, witnessId: holder.id,
      routeId: s.routeId, positionKm: s.positionKm, offRoadKm: s.offRoadKm || 0,
      availableForAssistance: !s.rescue.observedController, text,
      scope: 'Dated extraction-team observation, not live tracking or permanent safe passage.' });
    return true;
  }
  function walk(p, target, dt) {
    const d = gap(p, target), moved = Math.max(0, Math.min(d, .003 * dt, (80 - p.fatigue) / .1));
    if (d > 0) { p.positionKm += (target.positionKm - p.positionKm) / d * moved;
      p.offRoadKm = (p.offRoadKm || 0) + ((target.offRoadKm || 0) - (p.offRoadKm || 0)) / d * moved; }
    p.fatigue += moved * .1;
  }
  function drive(t, s, op, target, dt, escort) {
    const j = s.rescue, d = gap(t, target), speed = t.offRoadKm > 0 || target.offRoadKm > 0 ? 8 : 24;
    if (escort && (op.condition <= 50 || op.provisions <= 0 || !op.crew.every(p => able(p) && (!p.locationId || p.locationId === op.vehicleId)))) return false;
    const moved = Math.max(0, Math.min(d, speed * dt / 3600, t.fuelKm, (t.condition - 50) / .03,
      ...(escort ? [op.fuelKm, (op.condition - 50) / .02] : []),
      ...t.crew.filter(p => p.locationId === t.vehicleId).map(p => (80 - p.fatigue) / .08)));
    if (d > 0) { t.positionKm += (target.positionKm - t.positionKm) / d * moved;
      t.offRoadKm += ((target.offRoadKm || 0) - t.offRoadKm) / d * moved; }
    t.fuelKm -= moved; t.condition -= moved * .03;
    for (const p of [...t.crew, ...op.crew]) if (p.locationId === t.vehicleId) {
      p.positionKm = t.positionKm; p.offRoadKm = t.offRoadKm; p.fatigue += moved * .08;
    }
    j.convoy.positionKm = t.positionKm; j.convoy.offRoadKm = t.offRoadKm;
    if (escort) {
      op.fuelKm -= moved; op.condition -= moved * .02; op.crew.forEach(p => { p.fatigue += moved * .04; });
      s.positionKm = t.positionKm; s.offRoadKm = t.offRoadKm; op.location = 'rescue-escort:' + s.positionKm;
    }
    return d - moved < 1e-8;
  }
  function shoot(shooter, target, j, at, vehicle = null) {
    if (!armed(shooter) || target.status !== 'alive' || target.surrendered || gap(shooter, target) > shooter.weapon.rangeKm || at < shooter.weapon.nextShotAt) return;
    shooter.weapon.ammunition--; shooter.weapon.nextShotAt = at + 8;
    j.shots.push({ at, shooterId: shooter.id, targetId: target.id });
    if (vehicle && target.locationId === vehicle.vehicleId && Road.equipment(vehicle).cabinIntegrity > 0) {
      vehicle.condition = Math.max(0, vehicle.condition - 16);
      Road.equipment(vehicle).cabinIntegrity = Math.max(0, Road.equipment(vehicle).cabinIntegrity - 16);
    } else if ((target.protection || 0) > 0) target.protection = Math.max(0, target.protection - 16);
    else {
      target.health = Math.max(0, target.health - 18);
      (target.injuries ||= []).push({ at, cause: 'roadside firefight', damage: 18 });
      if (!target.health) { target.status = 'dead'; target.deathAt = at; }
    }
  }
  function tick(state, s, op, route, at) {
    if (!active(state, s)) return false;
    const t = state.armedRescue, j = s.rescue, g = Robbery.groupFor(state, s);
    if (at <= j.lastAt) return Boolean(j.holdingConvoy);
    const dt = Math.min(1, at - j.lastAt); j.lastAt = at;
    t.provisions = Math.max(0, t.provisions - dt / 28800);
    if (j.phase === 'reserved') {
      if (!contact(t) || !ready(t, j.offer.distance) || !open(route, s)) return false;
      t.money += j.escrow; j.escrow = 0; j.phase = 'outbound'; j.departedAt = at;
      say(t, s, at, 'Extraction team reports departure toward the dated reported location. Fee committed.'); return false;
    }
    const helpers = t.crew;
    try { t.crew = [...helpers, ...op.crew.filter(p => p.locationId === t.vehicleId)]; Road.tick(state, j.convoy, t, route, at); }
    finally { t.crew = helpers; }
    const canDrive = open(route, s) && t.condition > 50 && t.fuelKm > 0 && t.provisions > 0;
    const trailOpen = !t.offRoadKm && !j.offer.report.offRoadKm || g?.refuge.trailOpen;
    const trailBlocked = !trailOpen && (t.offRoadKm > 0 || j.phase === 'outbound' && t.positionKm >= j.offer.report.positionKm - .001);
    if (j.holdingConvoy && state.roadsideAssistance?.assignment === s.id && s.assistance?.attached) {
      j.holdingConvoy = false; j.escort = false; j.phase = 'withdraw'; j.withdrawAt = at;
    }
    const sees = p => g?.visible && !g.barrier && Road.equipment(t).visibility && !Road.equipment(t).barrier
      && t.crew.some(r => able(r) && gap(r, p) <= t.sightKm);
    const enemies = (g?.members || []).filter(p => p.status === 'alive' && sees(p));
    const hostiles = enemies.filter(p => armed(p) && !p.fleeing);
    const fighters = t.crew.filter(able);
    if (!['withdraw', 'return'].includes(j.phase) && (!t.willing || t.provisions <= 0 || fighters.length < 2 || !fighters.some(armed)
      || t.crew.some(p => p.health < 50) || state.corridorBeasts?.find(site => site.routeId === s.routeId)?.actors.some(b =>
        b.status === 'alive' && b.effortSeconds > 0 && Math.hypot(b.positionKm - t.positionKm, b.offsetKm - t.offRoadKm) < .15))) {
      j.phase = 'withdraw'; j.withdrawAt = at; say(t, s, at, 'Team reports withdrawing because of casualties, inadequate fighting capability or a nearby beast threat.');
    }
    if (j.phase === 'outbound') {
      if (hostiles.length) {
        for (const p of fighters) p.locationId = 'scene:' + s.routeId;
        j.phase = 'demand'; j.demandAt = at;
        j.observations.push({ at, people: hostiles.map(p => p.id), positionKm: t.positionKm, offRoadKm: t.offRoadKm });
        say(t, s, at, 'Team reports sighting armed people and demanding that they stand down. Captive access is not yet established.'); return false;
      }
      if (!canDrive || trailBlocked || !able(t.crew.find(p => p.role === 'driver' && p.locationId === t.vehicleId))) return false;
      const target = t.positionKm < j.offer.report.positionKm - 1e-8
        ? { positionKm: j.offer.report.positionKm, offRoadKm: 0 } : j.offer.report;
      if (!drive(t, s, op, target, dt, false) || gap(t, j.offer.report) > .003) return false;
      if (gap(t, s) > .003 || !Road.equipment(t).visibility || Road.equipment(t).barrier
        || g?.barrier || Road.equipment(op).barrier || !Road.equipment(op).controlsAccessible) {
        j.phase = 'withdraw'; j.withdrawAt = at; say(t, s, at, 'Team found no accessible convoy at the reported location. No hidden-location search is available.'); return false;
      }
      if (op.controllerId) { j.phase = 'withdraw'; j.withdrawAt = at; say(t, s, at, 'Team cannot establish safe access to the guarded convoy.'); return false; }
      j.phase = 'secure';
    }
    if (['demand', 'engage', 'withdraw', 'return'].includes(j.phase)) {
      for (const p of enemies) if (!p.surrendered && !p.fleeing) {
        const visibleRescuers = fighters.filter(r => gap(p, r) <= t.sightKm);
        if (g.rescueResponse === 'surrender' || g.rescueResponse === 'yieldWhenOutmatched' && visibleRescuers.filter(armed).length > enemies.filter(armed).length) p.surrendered = true;
        else if (g.rescueResponse === 'flee') p.fleeing = true;
      }
      for (const p of enemies.filter(p => p.fleeing && able(p))) walk(p, { positionKm: p.positionKm, offRoadKm: .7 }, dt);
      if (j.phase === 'demand' && at - j.demandAt >= 10) j.phase = 'engage';
      if (['engage', 'withdraw', 'return'].includes(j.phase)) {
        for (const p of enemies.filter(p => armed(p) && !p.fleeing)) {
          const target = fighters.filter(r => !r.surrendered).sort((a, b) => gap(p, a) - gap(p, b))[0];
          if (target) shoot(p, target, j, at, t);
        }
        for (const p of fighters.filter(armed)) {
          const target = enemies.filter(e => armed(e) && !e.fleeing).sort((a, b) => gap(p, a) - gap(p, b))[0];
          if (target) { if (j.phase === 'engage') walk(p, target, dt); shoot(p, target, j, at); }
        }
      }
      if (['demand', 'engage'].includes(j.phase) && !enemies.some(p => armed(p) && !p.fleeing)) {
        const surrender = enemies.find(p => p.surrendered && p.weapon);
        if (surrender) {
          const rescuer = fighters[0]; if (!rescuer) return false;
          walk(rescuer, surrender, dt);
          if (gap(rescuer, surrender) <= .003) {
            if (j.disarmTarget !== surrender.id) { j.disarmTarget = surrender.id; j.progress = 0; }
            j.progress += dt;
            if (j.progress >= 10) {
              (g.groundWeapons ||= []).push({ weapon: surrender.weapon, positionKm: surrender.positionKm, offRoadKm: surrender.offRoadKm, at });
              surrender.weapon = null; j.progress = 0;
              say(t, s, at, 'Team reports physically disarming a surrendered individual. The person remains at the scene; no arrest or prisoner transport is implied.');
            }
          } else j.progress = 0;
          return false;
        }
        j.phase = 'regroup';
      }
    }
    if (j.phase === 'regroup') {
      for (const p of fighters) { walk(p, t, dt); if (gap(p, t) <= .003) p.locationId = t.vehicleId; }
      if (fighters.every(p => p.locationId === t.vehicleId)) j.phase = 'outbound';
      return false;
    }
    if (j.phase === 'secure') {
      if (gap(t, s) > .003 || op.controllerId || op.crew.some(p => p.capture?.active)) return false;
      j.holdingConvoy = true; s.phase = 'stranded'; s.returnRequestedAt ??= at;
      j.observedController = null; j.releasedAt ??= at;
      say(t, s, at, 'Team reports reaching the free convoy. Freedom is not extraction; wounded people, vehicle and cargo still require feasible transport.', true);
      j.escort = op.condition > 50 && op.fuelKm >= gap(s, { positionKm: 0, offRoadKm: 0 }) + (s.localDistanceKm || 0) * 2
        && op.provisions > 0 && Road.equipment(op).controlsAccessible
        && op.crew.length > 0 && op.crew.every(p => able(p) && (!p.locationId || p.locationId === op.vehicleId));
      j.phase = 'board'; j.progress = 0;
    }
    if (j.phase === 'board') {
      if (op.controllerId || op.crew.some(p => p.capture?.active)) { j.phase = 'withdraw'; j.withdrawAt = at; return true; }
      j.progress += dt; if (j.progress < 30) return true;
      if (!j.escort) for (const p of op.crew) {
        if (j.passengers.length >= t.passengerSeats || !able(p) || p.locationId && p.locationId !== op.vehicleId) continue;
        p.positionKm = s.positionKm; p.offRoadKm = s.offRoadKm || 0;
        p.locationId = t.vehicleId; j.passengers.push(p.id);
      }
      j.phase = 'return';
      say(t, s, at, j.escort ? 'Team reports original crew departing in their operational van under escort. Cargo remains aboard.'
        : 'Team reports boarding walking survivors within capacity. Incapacitated people and the original van require separate recovery.');
      return true;
    }
    if (j.phase === 'withdraw') {
      for (const p of fighters) { walk(p, t, dt); if (gap(p, t) <= .003) p.locationId = t.vehicleId; }
      if (fighters.every(p => p.locationId === t.vehicleId)) { j.phase = 'return'; j.escort = false; }
    }
    if (j.phase === 'return') {
      if (!canDrive || trailBlocked || !able(t.crew.find(p => p.role === 'driver' && p.locationId === t.vehicleId))) return Boolean(j.holdingConvoy);
      const target = t.offRoadKm > 1e-8 ? { positionKm: t.positionKm, offRoadKm: 0 } : { positionKm: 0, offRoadKm: 0 };
      if (!drive(t, s, op, target, dt, j.escort) || gap(t, { positionKm: 0, offRoadKm: 0 }) > .003) return Boolean(j.holdingConvoy);
      for (const p of op.crew) if (p.locationId === t.vehicleId) { p.locationId = state.homeId + ':extraction-depot'; p.positionKm = 0; p.offRoadKm = 0; }
      if (j.escort) {
        s.positionKm = 0; s.offRoadKm = 0; op.location = state.homeId;
        if (s.living && s.manifest?.entries.some(e => e.creature)) s.phase = 'returnLocal';
        else { s.phase = 'returned'; s.returnedAt = at; op.assignment = null; s.custodian = 'covert-depot:' + state.homeId; }
      }
      j.phase = 'complete'; j.completedAt = at; j.convoy.phase = 'returned'; t.assignment = null;
      say(t, s, at, 'Extraction vehicle reports arrival at the home depot. This does not recover anything left at the scene or revive the sale.');
    }
    return Boolean(j.holdingConvoy);
  }
  function advanceDetached(state, now, routes) {
    const s = state.shipments.find(s => active(state, s));
    if (!s || ['outbound', 'returning', 'stranded', 'captured', 'returnLocal', 'returnWaiting', 'localEmpty'].includes(s.phase)) return;
    const op = state.operators.find(o => o.id === s.operatorId);
    for (let at = s.rescue.lastAt + 1; at <= now && active(state, s); at++) tick(state, s, op, routes.find(r => r.id === s.routeId), at);
  }
  return { provision, quote, accept, cancel, tick, active, advanceDetached };
});
