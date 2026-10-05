(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./corridor-beasts') : root.HelixCorridorBeasts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCorridorRobbery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Road) {
  'use strict';
  const able = p => p?.status === 'alive' && p.health >= 50 && p.fatigue < 80 && p.provisions > 0;
  const hash = s => { let n = 2166136261; for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; };
  function createGroup(route, at) {
    const id = `${route.id}:roadside-robbers`, km = route.distanceKm / 2;
    return { id, routeId: route.id, lengthKm: route.distanceKm, siteKm: km, lastAt: at, assignment: null, attempted: [],
      objective: 'takeLoadedVan', firePolicy: 'holdFire', visible: true, barrier: false,
      releasePreferences: { offer: true, amount: 300, honor: true, allowProof: true },
      recoveryPassage: true,
      rescueResponse: 'yieldWhenOutmatched', recaptureWilling: true,
      receivingAccount: { id: `${id}:receiving-account`, active: true, channelPowered: true, balance: 0 },
      refuge: { id: `${id}:refuge`, distanceKm: .5, trailOpen: true },
      truck: { id: `${id}:truck`, positionKm: km, condition: 80, fuelKm: 20, seats: 3, ownerId: id, assignment: null },
      members: ['leader', 'driver', 'lookout'].map((role, n) => ({ id: `${id}:${role}`, name: `Roadside ${role}`, role,
        status: 'alive', health: 100, protection: 24, fatigue: 0, provisions: 2, positionKm: km, offRoadKm: 0,
        canDrive: role === 'driver', weapon: { id: `${id}:rifle:${n}`, condition: 100, ammunition: 6, rangeKm: .08, nextShotAt: at } })) };
  }
  function provision(state, route, seed, at) {
    state.roadsideGroups ||= [];
    if (state.roadsideGroups.some(s => s.routeId === route.id) || !['intermittent', 'degraded'].includes(route.continuity) || !(route.distanceKm > 2)) return;
    // Bounded initial local scenario, allocated before cargo is offered. No
    // replacement or wealth-sensitive spawning, and no implied police authority.
    state.roadsideGroups.push({ routeId: route.id, lengthKm: route.distanceKm, createdAt: at,
      group: hash(`${seed}:${route.id}:roadside-group`) < .25 ? createGroup(route, at) : null });
  }
  const groupFor = (state, sh) => state.roadsideGroups?.find(s => s.routeId === sh.routeId && s.lengthKm === sh.distanceKm)?.group;
  const active = (state, sh) => Boolean(groupFor(state, sh));
  const separation = (p, sh) => Math.hypot(p.positionKm - sh.positionKm, p.offRoadKm - (sh.offRoadKm || 0));
  const armed = p => !p.surrendered && p.weapon?.condition >= 50 && p.weapon.ammunition > 0;
  function tell(sh, op, at, key, text) {
    sh.robberyNotices ||= [];
    if (sh.robberyNotices.includes(key)) return;
    sh.robberyNotices.push(key); Road.report(sh, op, at, text);
  }
  function finish(g, sh, op, at, reason) {
    const r = sh.robbery;
    if (!r || r.endedAt != null) return;
    r.endedAt = at; r.outcome = reason;
    if (g.assignment === sh.id) g.assignment = null;
    if (op.controllerId === g.id) delete op.controllerId;
    for (const p of op.crew) if (p.capture?.groupId === g.id) { p.capture.active = false; p.capture.endedAt = at; }
    if (sh.phase === 'captured') sh.phase = sh.offRoadKm > 0 ? 'stranded' : sh.saleFailedAt != null ? 'returning' : r.originalPhase;
    if (r.radioTaken) {
      const radio = Road.equipment(op).radio;
      const holder = g.members?.find(p => p.id === r.guardId);
      if (radio.custodianId === r.guardId && holder && separation(holder, sh) <= .003
        && op.crew.some(p => p.status === 'alive' && p.health >= 25 && (!p.locationId || p.locationId === op.vehicleId))) {
        if (r.radioPreviousCustodian) radio.custodianId = r.radioPreviousCustodian;
        else delete radio.custodianId;
        r.radioTaken = false;
      }
    }
  }
  function tick(state, sh, op, at) {
    const g = groupFor(state, sh);
    if (!g) {
      if (sh.robbery?.controlAt != null && sh.robbery.endedAt == null)
        finish({ id: sh.robbery.groupId }, sh, op, at, 'guardMissing');
      return sh.phase === 'stranded';
    }
    if (!['outbound', 'returning', 'captured', 'stranded'].includes(sh.phase)) return false;
    if (g.assignment && g.assignment !== sh.id) return false;
    const safety = Road.equipment(op), r = sh.robbery;
    if (r?.endedAt != null) {
      recapture(state, g, sh, op, at);
      return ['stranded', 'captured'].includes(sh.phase);
    }
    const members = g.members.filter(able);
    if (!r) {
      const leader = members.find(p => armed(p) && separation(p, sh) <= .1);
      if (sh.receiptAt != null || g.attempted.includes(sh.id) || !leader || !g.visible || g.barrier || !safety.visibility || safety.barrier) return false;
      g.assignment = sh.id; g.attempted.push(sh.id); g.lastAt = at;
      sh.robbery = { groupId: g.id, at, lastAt: at, phase: 'demand', originalPhase: sh.phase,
        progress: 0, observations: [], shots: [], controlAt: null, endedAt: null };
      tell(sh, op, at, 'demand', 'Driver reports armed people signaling a stop and demanding access to the van. Cargo has not been inspected.');
      return false;
    }
    if (at <= r.lastAt) return ['approach', 'secure', 'inspect', 'withdrawing', 'holding'].includes(r.phase);
    const dt = Math.min(1, at - r.lastAt); r.lastAt = at; g.lastAt = at;
    g.members.filter(p => p.status === 'alive').forEach(p => { p.provisions = Math.max(0, p.provisions - dt / 28800); p.fatigue += dt / 3600; });
    const crew = op.crew.find(p => p.status === 'alive' && p.health >= 25 && (!p.locationId || p.locationId === op.vehicleId));
    if (r.controlAt == null) {
      if (at > r.at + 180 || !members.some(armed)) { finish(g, sh, op, at, 'attemptAbandoned'); return false; }
      const response = safety.robberyResponse || 'surrender';
      if (r.phase === 'demand') {
        if (!crew || !g.visible || g.barrier || !safety.visibility || safety.barrier) { finish(g, sh, op, at, 'noObservedCompliance'); return false; }
        if (response === 'turnBack' && sh.receiptAt == null) sh.returnRequestedAt ??= at;
        if (response !== 'surrender') {
          // A refusal is not a shot. A separately saved attacker decision is
          // required, and only a reachable exterior can be targeted here.
          if (g.firePolicy === 'disableVehicle') for (const p of members) {
            if (!armed(p) || separation(p, sh) > p.weapon.rangeKm || at < p.weapon.nextShotAt) continue;
            p.weapon.ammunition--; p.weapon.nextShotAt = at + 8;
            r.shots.push({ at, shooterId: p.id, targetId: op.vehicleId });
            if (safety.cabinIntegrity > 0) { safety.cabinIntegrity = Math.max(0, safety.cabinIntegrity - 8); op.condition = Math.max(0, op.condition - 8); }
            else {
              const target = op.crew.find(p => p.status === 'alive');
              if (target) { target.health = Math.max(0, target.health - 8); (target.injuries ||= []).push({ at, cause: 'shot through breached cabin', damage: 8 });
                if (!target.health) { target.status = 'dead'; target.deathAt = at; } }
            }
            tell(sh, op, at, 'shot', 'Driver reports shots striking the van. No inspection of contained cargo has occurred.');
          }
          if (members.every(p => separation(p, sh) > .15)) finish(g, sh, op, at, 'escapedContact');
          return false;
        }
        r.phase = 'approach';
        tell(sh, op, at, 'surrender', 'Driver has stopped and surrendered. The armed group has not yet taken physical control.');
      }
      if (response !== 'surrender' || !crew) { finish(g, sh, op, at, 'surrenderWithdrawn'); return false; }
      if (g.barrier || safety.barrier || !g.visible || !safety.visibility) { r.progress = 0; return true; }
      const party = members.filter(p => p.role !== 'lookout');
      for (const p of party) p.positionKm += Math.sign(sh.positionKm - p.positionKm) * Math.min(Math.abs(sh.positionKm - p.positionKm), dt * .004);
      if (party.length < 2 || !party.some(p => p.role === 'leader' && armed(p)) || party.some(p => separation(p, sh) > .003) || !safety.controlsAccessible) { r.progress = 0; return true; }
      r.phase = 'secure'; r.progress += dt;
      if (r.progress < 30) return true;
      r.controlAt = at; r.phase = 'inspect'; r.progress = 0;
      op.controllerId = g.id; sh.phase = 'captured';
      for (const p of op.crew) p.capture = { groupId: g.id, active: true, at, restraint: 'physicalGuard' };
      tell(sh, op, at, 'captured', 'Driver reports the group boarding and taking control of the van. This is capture, not a lawful arrest.');
      r.guardId = party.find(p => p.role === 'leader').id;
      r.radioPreviousCustodian = safety.radio.custodianId || null; r.radioTaken = true; safety.radio.custodianId = r.guardId;
      return true;
    }
    const guard = members.find(p => p.id === r.guardId && armed(p) && separation(p, sh) <= .003);
    if (!guard || g.barrier || !g.visible) { finish(g, sh, op, at, 'guardLost'); return sh.phase === 'stranded'; }
    r.lastSeenVan = { positionKm: sh.positionKm, offRoadKm: sh.offRoadKm || 0, at };
    if (r.phase === 'inspect') {
      r.progress += dt; if (r.progress < 30) return true;
      r.observations.push({ at, observerId: guard.id, vehicleId: op.vehicleId,
        items: sh.manifest.entries.map(e => ({ id: e.stack?.id || e.creature?.id, label: e.stack?.chemicalBatch?.label || e.kind,
          scope: 'Visible cargo exterior only; sealed contents, chemistry, genetics and ownership claims unverified.' })) });
      r.phase = 'withdrawing';
    }
    const driver = members.find(p => p.canDrive && separation(p, sh) <= .003);
    if (r.phase === 'withdrawing' && driver && safety.cabinSeats >= op.crew.length + 2 && g.refuge.trailOpen
      && op.condition >= 50 && op.fuelKm > 0 && op.provisions > 0) {
      const moved = Math.max(0, Math.min(g.refuge.distanceKm - (sh.offRoadKm || 0), dt * 10 / 3600, op.fuelKm, (op.condition - 50) / .02));
      sh.offRoadKm = (sh.offRoadKm || 0) + moved; op.fuelKm -= moved; op.condition -= moved * .02;
      guard.offRoadKm = driver.offRoadKm = sh.offRoadKm;
      op.location = `${g.id}:trail:${sh.offRoadKm}`;
      if (sh.offRoadKm + 1e-8 >= g.refuge.distanceKm) { r.phase = 'holding'; r.arrivedAt = at; op.location = g.refuge.id; }
    }
    return true;
  }
  function recapture(state, g, sh, op, at) {
    const r = sh.robbery, safety = Road.equipment(op);
    if (!sh.rescue?.departedAt || !g.recaptureWilling || at < r.endedAt + 60 || at > r.endedAt + 600
      || !r.lastSeenVan || at <= (r.recaptureLastAt || r.endedAt)) return;
    const dt = Math.min(1, at - (r.recaptureLastAt || r.endedAt)); r.recaptureLastAt = at;
    const candidates = g.members.filter(p => able(p) && armed(p));
    const team = state.armedRescue;
    const threatened = team?.assignment === sh.id && team.crew.some(p => p.status === 'alive' && p.health >= 50 && p.weapon?.ammunition > 0
      && candidates.some(c => Math.hypot(p.positionKm - c.positionKm, (p.offRoadKm || 0) - c.offRoadKm) < .15));
    if (candidates.length < 2 || threatened || !g.visible || g.barrier || !safety.visibility || safety.barrier || !g.refuge.trailOpen) { r.recaptureProgress = 0; return; }
    const present = op.crew.filter(p => p.status === 'alive' && (!p.locationId || p.locationId === op.vehicleId));
    if (!present.length || op.controllerId || !['stranded', 'outbound', 'returning'].includes(sh.phase)) return;
    if (candidates.some(p => separation(p, sh) <= .1)) r.lastSeenVan = { at, positionKm: sh.positionKm, offRoadKm: sh.offRoadKm || 0 };
    for (const p of candidates) {
      p.provisions = Math.max(0, p.provisions - dt / 28800); p.fatigue += dt / 3600;
      const d = Math.hypot(r.lastSeenVan.positionKm - p.positionKm, r.lastSeenVan.offRoadKm - p.offRoadKm);
      const moved = Math.min(d, .003 * dt);
      if (d) { p.positionKm += (r.lastSeenVan.positionKm - p.positionKm) / d * moved; p.offRoadKm += (r.lastSeenVan.offRoadKm - p.offRoadKm) / d * moved; }
    }
    if (candidates.filter(p => separation(p, sh) <= .003).length < 2 || !safety.controlsAccessible) { r.recaptureProgress = 0; return; }
    r.recaptureProgress = (r.recaptureProgress || 0) + dt; if (r.recaptureProgress < 30) return;
    (sh.robberyHistory ||= []).push(JSON.parse(JSON.stringify(r)));
    const guard = candidates.find(p => separation(p, sh) <= .003);
    sh.robbery = { groupId: g.id, at, lastAt: at, phase: 'holding', originalPhase: sh.phase, progress: 0,
      observations: [], shots: [], controlAt: at, endedAt: null, guardId: guard.id, lastSeenVan: { ...r.lastSeenVan } };
    g.assignment = sh.id; op.controllerId = g.id; sh.phase = 'captured';
    for (const p of present) p.capture = { groupId: g.id, active: true, at, restraint: 'physicalGuard' };
    Road.report(sh, op, at, 'Crew reports armed people physically regaining control of the van. This is recapture, not lawful arrest.');
    const radio = safety.radio;
    if (!radio.custodianId || present.some(p => p.id === radio.custodianId)) {
      sh.robbery.radioPreviousCustodian = radio.custodianId || null;
      sh.robbery.radioTaken = true; radio.custodianId = guard.id;
    }
  }
  return { createGroup, provision, active, tick, groupFor, release: finish };
});
