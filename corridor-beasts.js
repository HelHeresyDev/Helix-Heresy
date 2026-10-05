(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-beasts') : root.HelixWildernessBeasts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCorridorBeasts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Wild) {
  'use strict';
  const conscious = p => p?.status === 'alive' && p.health >= 25;
  const hash = s => { let n = 2166136261; for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; };
  function equipment(op) {
    op.roadSafety ||= { cabinIntegrity: 100, sightKm: .1, visibility: true, barrier: false,
      radio: { powered: true, connected: true, charges: 24, contacts: [{ brokerId: op.brokerId, carrierId: op.id }] }, driverChoice: 'escape', acceptAbort: true,
      robberyResponse: 'surrender', controlsAccessible: true, cabinSeats: 3 };
    return op.roadSafety;
  }
  // Input is canonical regional presence, not the player's public atlas or shipment value.
  // Materialization is saved even when absent and never replenishes killed/exhausted actors.
  function provision(state, route, populations, seed, at) {
    state.corridorBeasts ||= [];
    if (state.corridorBeasts.some(s => s.routeId === route.id) || !(route.distanceKm > 0)) return;
    const site = { routeId: route.id, lengthKm: route.distanceKm, actors: [], createdAt: at };
    for (const p of [...populations].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!Wild.PROFILES[p.speciesId] || !Number.isFinite(p.positionKm) || p.positionKm <= 0 || p.positionKm >= route.distanceKm || !(p.populationIndex > 0)) continue;
      if (hash(`${seed}:${route.id}:${p.id}:presence`) > Math.min(.8, p.populationIndex / 1000)) continue;
      site.actors.push(createActor(`${route.id}:road-beast`, p.speciesId, p.id, p.positionKm, at)); break;
    }
    state.corridorBeasts.push(site);
  }
  function createActor(id, speciesId, populationId, km, at) {
    const profile = Wild.PROFILES[speciesId]; if (!profile) throw new Error('Unsupported local beast species');
    return { id, speciesId, populationId, status: 'alive', health: profile.health, maxHealth: profile.health,
      positionKm: km, offsetKm: .04, homeKm: km, homeOffsetKm: .04, lastAt: at, nextAttackAt: at,
      effortSeconds: 180, targetId: null, rememberedUntil: 0, targetKm: null, finished: [], behavior: 'resting' };
  }
  const siteFor = (state, sh) => state.corridorBeasts?.find(s => s.routeId === sh.routeId && s.lengthKm === sh.distanceKm);
  const active = (state, sh) => Boolean(siteFor(state, sh)?.actors.length);
  function report(sh, op, at, text) {
    const safety = equipment(op), driver = op.crew.find(p => conscious(p) && (!p.locationId || p.locationId === op.vehicleId));
    // Nothing is queued for retrospective transmission after an outage.
    if (!driver || !safety.radio.powered || !safety.radio.connected || safety.radio.charges < 1
      || safety.radio.custodianId && safety.radio.custodianId !== driver.id) return false;
    safety.radio.charges--; sh.corridorReports ||= [];
    sh.corridorReports.push({ at, witnessId: driver.id, positionKm: sh.positionKm, offRoadKm: sh.offRoadKm || 0,
      availableForAssistance: !op.controllerId, routeId: sh.routeId, text,
      scope: 'Dated driver message, not live tracking or proof of unseen outcomes.' }); return true;
  }
  function note(sh, op, at, key, text) {
    sh.corridorNoted ||= [];
    if (sh.corridorNoted.includes(key)) return;
    sh.corridorNoted.push(key); report(sh, op, at, text);
  }
  function requestAbort(state, id, at) {
    const sh = state.shipments.find(s => s.id === id), op = state.operators.find(o => o.id === sh?.operatorId);
    if (!sh || !op || !['outbound', 'returning'].includes(sh.phase)) return false;
    const radio = equipment(op).radio;
    if (!op.crew.some(conscious) || !radio.powered || !radio.connected || radio.charges < 1
      || radio.custodianId && !op.crew.some(p => conscious(p) && p.id === radio.custodianId)) return false;
    const accepts = op.roadSafety.acceptAbort;
    report(sh, op, at, accepts ? 'Driver accepts the request to abandon delivery. Return still requires a passable route and a working vehicle.' : 'Driver declines the request; local driving decisions remain with the crew.');
    if (accepts && sh.receiptAt == null) sh.returnRequestedAt ??= at;
    return true;
  }
  function tick(state, sh, op, route, at) {
    const site = siteFor(state, sh); if (!site || !['outbound', 'returning', 'captured', 'stranded'].includes(sh.phase)) return;
    const safety = equipment(op), driver = op.crew.find(p => conscious(p) && (!p.locationId || p.locationId === op.vehicleId));
    for (const b of site.actors) {
      if (b.targetId && b.targetId !== sh.id) {
        const previous = state.shipments.find(s => s.id === b.targetId)
          || state.shipments.find(s => s.assistance?.convoy.id === b.targetId)?.assistance.convoy;
        if (!previous || !['outbound', 'returning', 'captured', 'stranded'].includes(previous.phase)) { b.finished.push(b.targetId); b.targetId = null; }
        else continue;
      }
      if (at < b.lastAt) continue;
      const dt = Math.min(1, Math.max(0, at - b.lastAt));
      if (b.status !== 'alive' || b.health <= 0 || !dt) continue;
      const profile = Wild.PROFILES[b.speciesId];
      let distance = Math.hypot(b.positionKm - sh.positionKm, b.offsetKm - (sh.offRoadKm || 0));
      const sees = safety.visibility && !safety.barrier && distance <= profile.sight * .015;
      const hears = !safety.barrier && distance <= .18 && op.condition > 0;
      const driverSees = driver && safety.visibility && !safety.barrier && distance <= safety.sightKm;
      if (driverSees) {
        note(sh, op, at, `${b.id}:sighting`, `Driver sighted a ${profile.name} near the road.`);
        if (!op.controllerId && safety.driverChoice === 'turnBack' && sh.receiptAt == null) sh.returnRequestedAt ??= at;
      }
      const territorial = profile.disposition === 'territorial';
      const willing = b.health >= b.maxHealth * .3 && b.effortSeconds > 0 && !b.finished.includes(sh.id);
      if (!b.targetId && willing && (sees || hears) && (!territorial || Math.abs(sh.positionKm - b.homeKm) <= .08)) b.targetId = sh.id;
      if (b.targetId !== sh.id) continue;
      b.lastAt = at;
      if (sees || hears) { b.targetKm = sh.positionKm; b.targetOffsetKm = sh.offRoadKm || 0; b.rememberedUntil = at + 12; }
      if (!willing || at > b.rememberedUntil || territorial && Math.abs(sh.positionKm - b.homeKm) > .2) {
        b.finished.push(sh.id); b.targetId = null; b.behavior = 'disengaged';
        if (driverSees) note(sh, op, at, `${b.id}:disengaged`, 'Driver observed the beast break off its approach.');
        continue;
      }
      b.behavior = sees ? 'pursuing' : 'investigating'; b.effortSeconds = Math.max(0, b.effortSeconds - dt);
      if (!safety.barrier && b.targetKm != null) {
        const gap = Math.hypot(b.targetKm - b.positionKm, (b.targetOffsetKm || 0) - b.offsetKm), step = Math.min(gap, .012 / profile.stepSeconds * dt);
        if (gap > 0) { b.positionKm += (b.targetKm - b.positionKm) / gap * step; b.offsetKm += ((b.targetOffsetKm || 0) - b.offsetKm) / gap * step; }
      }
      distance = Math.hypot(b.positionKm - sh.positionKm, b.offsetKm - (sh.offRoadKm || 0));
      if (safety.barrier || !sees || distance > .004 || at < b.nextAttackAt) continue;
      b.nextAttackAt = at + profile.recovery;
      // Exterior strikes do not also damage every occupant, container or cargo stack.
      if (safety.cabinIntegrity > 0) {
        op.condition = Math.max(0, op.condition - profile.damage);
        safety.cabinIntegrity = Math.max(0, safety.cabinIntegrity - profile.damage);
        note(sh, op, at, `${b.id}:impact`, 'Driver reports a physical strike on the vehicle exterior. Cargo contents have not been inspected.');
      } else if (op.crew.some(p => p.status === 'alive' && (!p.locationId || p.locationId === op.vehicleId))) {
        const occupant = op.crew.find(p => p.status === 'alive' && (!p.locationId || p.locationId === op.vehicleId));
        occupant.health = Math.max(0, occupant.health - profile.damage);
        occupant.injuries ||= []; occupant.injuries.push({ at, cause: 'beast contact through breached cabin', damage: profile.damage });
        if (occupant.health === 0) { occupant.status = 'dead'; occupant.deathAt = at; }
        note(sh, op, at, `${b.id}:injury`, 'Driver reports an injury through the breached cabin.');
      }
    }
    if (op.condition < 50 || !op.crew.every(p => p.status === 'alive' && p.health >= 50 && p.fatigue < 80) || op.fuelKm <= 0 || op.provisions <= 0)
      note(sh, op, at, 'stranded', 'Driver reports the convoy cannot proceed. People, vehicle and cargo remain at the reported location; no rescue is confirmed.');
  }
  return { provision, createActor, equipment, active, tick, requestAbort, report };
});
