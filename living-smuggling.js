(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLivingSmuggling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v)), HOUR = 3600;
  const stat = (c, key) => Number(c.stats?.[key]?.current) || 0;
  function change(c, key, n) { const s = c.stats[key]; s.current = Math.max(0, Math.min(s.max || 100, s.current + n)); }
  function provision(state, feedKeys, at) {
    for (const base of [...state.operators]) if (!base.biological && !base.biologicalAllocated) {
      base.biologicalAllocated = true;
      state.operators.push({ id: `${base.id}:biological`, routeId: base.routeId, sourceId: base.sourceId, destinationId: base.destinationId, buyerId: base.buyerId,
        brokerId: base.brokerId, name: `${base.name} biological transport`, vehicleId: `${base.vehicleId}:biological`, biological: true,
        capacityKg: 120, capacityL: 240, fuelKm: 600, provisions: 40, money: 1200, condition: 100, assignment: null, location: state.homeId, lastAt: at,
        crew: [{ id: `${base.id}:handler`, name: `${base.name} trained specimen handler`, trainedHandler: true, status: 'alive', health: 100, fatigue: 0 }],
        careStock: { id: `${base.id}:care-depot`, feeds: Object.fromEntries(feedKeys.map(k => [k, 32])), water: 96, power: 96 }, reason: '' });
    }
  }
  function plan(op, request, journey) {
    const profile = request.livingProfile, creature = request.manifest.entries.find(e => e.creature)?.creature;
    const pod = request.manifest.entries.find(e => e.kind === 'transportPod')?.stack;
    if (request.manifest.amount !== 1 || request.manifest.entries.filter(e => e.creature).length !== 1 || request.manifest.entries.filter(e => e.kind === 'transportPod').length !== 1) return { ok: false, reason: 'One exact living creature and one transport pod are required.' };
    if (!op.biological || !op.crew.some(c => c.trainedHandler && c.status === 'alive' && c.health >= 50) || !profile?.feedKey || !creature || !pod) return { ok: false, reason: 'A biological vehicle, trained handler, exact pod and known compatible diet are required.' };
    if (stat(creature, 'bodyIntegrity') < 60 || stat(creature, 'stress') > profile.maximumStress || pod.craftsmanship < 60) return { ok: false, reason: 'Specimen condition or pod craftsmanship is unsuitable for foreign transport (health and pod quality at least 60).' };
    const reserveHours = Math.ceil(journey.hours + request.localDistanceKm / 24 * 4 + 6);
    const foodRate = Math.max(.125, profile.foodRate || .125), food = Math.ceil(reserveHours * foodRate), water = Math.ceil(reserveHours * .25), power = reserveHours;
    if ((op.careStock?.feeds[profile.feedKey] || 0) < food || op.careStock.water < water || op.careStock.power < power) return { ok: false, reason: 'The specialist depot lacks finite diet, moisture or containment-power stocks for the round trip plus six-hour safety margin.' };
    const totalDistance = (journey.distanceKm + request.localDistanceKm) * 2;
    if (op.fuelKm < totalDistance || op.condition - totalDistance * .02 < 50 || op.crew.some(c => c.fatigue + totalDistance * .04 >= 80) || op.provisions * 8 < reserveHours) return { ok: false, reason: 'Insufficient vehicle range, condition, rested crew or provisions for an emergency local return.' };
    return { ok: true, feedKey: profile.feedKey, foodRate, food, water, power, reserveHours, maximumStress: profile.maximumStress, minimumHealth: 60,
      hazard: Math.max(.01, profile.hazard || .01), returnFee: Math.ceil(15 + request.localDistanceKm * .4), kitKg: food + water + power * .1, kitL: food + water + power * .15 };
  }
  function reserve(op, sh, plan) {
    op.careStock.feeds[plan.feedKey] -= plan.food; op.careStock.water -= plan.water; op.careStock.power -= plan.power;
    sh.living = { ...copy(plan), lastAt: sh.bookedAt, foodLeft: plan.food, waterLeft: plan.water, powerLeft: plan.power, hydration: 100,
      kitCustodian: op.careStock.id, podCondition: 100, strain: 0, threshold: null, outcome: '', failureAt: null, report: null, reportAt: null, refunded: false };
  }
  function release(op, sh) {
    if (!sh.living || sh.living.suppliesReleased) return;
    const l = sh.living; op.careStock.feeds[l.feedKey] += l.foodLeft; op.careStock.water += l.waterLeft; op.careStock.power += l.powerLeft;
    l.foodLeft = l.waterLeft = l.powerLeft = 0; l.suppliesReleased = true; l.kitCustodian = op.careStock.id;
  }
  function collected(sh, manifest, at, roll) {
    sh.manifest = copy(manifest); const l = sh.living; l.lastAt = at;
    // One saved threshold, consumed by accumulating condition-dependent strain, never rerolled on reload.
    l.threshold = 20 + Math.max(0, Math.min(1, roll)) * 80;
    l.podCondition = Math.max(0, Math.min(100, manifest.entries.find(e => e.kind === 'transportPod').stack.craftsmanship));
    const c = sh.manifest.entries.find(e => e.creature).creature; c.ownerId = 'player';
  }
  function refund(state, sh) {
    if (sh.living.refunded) return;
    state.buyers.find(b => b.id === sh.buyerId).money += sh.playerEscrow + sh.freightEscrow;
    sh.playerEscrow = sh.freightEscrow = 0; sh.living.refunded = true;
  }
  function emptyHome(state, sh, op) {
    state.buyers.find(b => b.id === sh.buyerId).money += sh.returnEscrow; sh.returnEscrow = 0;
    sh.phase = 'returned'; op.assignment = null; op.location = state.homeId; release(op, sh);
  }
  function fail(state, sh, outcome, at) {
    const l = sh.living; if (['dead', 'escaped', 'received', 'returnedAlive'].includes(l.outcome)) return;
    l.outcome = outcome; l.failureAt = at; refund(state, sh);
    const c = sh.manifest.entries.find(e => e.creature).creature;
    if (['dead', 'escaped'].includes(outcome)) {
      c.status = outcome === 'dead' ? 'dead' : 'released'; if (outcome === 'dead') { c.deathAt = at; c.deathCause = c.deathCause || 'biological transport condition failure'; }
      sh.offsiteCreature = { creature: copy(c), kind: outcome === 'dead' ? 'corpse' : 'escapedCreature', at,
        location: { routeId: ['localTransit', 'depot', 'returnLocal', 'returnWaiting'].includes(sh.phase) ? `local:${sh.sourceId}` : sh.routeId, phase: sh.phase, positionKm: sh.positionKm, custodian: sh.custodian }, owner: 'player' };
      sh.manifest.entries = sh.manifest.entries.filter(e => !e.creature);
      sh.custodian = 'offsite-record';
    }
  }
  function care(state, sh, seconds, at) {
    const l = sh.living, c = sh.manifest?.entries.find(e => e.creature)?.creature;
    if (!c || ['dead', 'escaped', 'received'].includes(l.outcome)) return;
    const hours = seconds / HOUR;
    const use = (field, amount) => { const taken = Math.min(l[field], amount); l[field] -= taken; return amount > 0 ? taken / amount : 1; };
    const food = use('foodLeft', hours * l.foodRate), water = use('waterLeft', hours * .25), power = use('powerLeft', hours);
    change(c, 'nutrition', hours * (food * 4 - 3)); l.hydration = Math.max(0, Math.min(100, l.hydration + hours * (water * 8 - 6)));
    const unsupported = (1 - food) + (1 - water) + (1 - power);
    change(c, 'stress', hours * (unsupported * 5 + .25));
    l.podCondition = Math.max(0, l.podCondition - hours * (l.hazard * 2 + (1 - power) * 5));
    if (stat(c, 'nutrition') <= 0 || l.hydration <= 0) change(c, 'bodyIntegrity', -hours * 12);
    if (power < 1) change(c, 'bodyIntegrity', -hours * 2);
    l.strain += hours * l.hazard * (1 + stat(c, 'stress') / 20 + (100 - l.podCondition) / 10 + unsupported * 3);
    if (stat(c, 'bodyIntegrity') <= 0 || Number.isFinite(c.deathAt) && at >= c.deathAt) fail(state, sh, 'dead', at);
    else if (l.podCondition <= 0 || l.strain >= l.threshold) fail(state, sh, 'escaped', at);
    if (l.reportAt === null || at - l.reportAt >= HOUR) {
      l.reportAt = at; l.report = { at, health: stat(c, 'bodyIntegrity'), stress: stat(c, 'stress'), nutrition: stat(c, 'nutrition'), podCondition: l.podCondition,
        reserveHours: Math.min(l.foodLeft / l.foodRate, l.waterLeft / .25, l.powerLeft), outcome: l.outcome };
    }
  }
  function advance(state, now, routes, localRoute, collections) {
    for (const sh of state.shipments.filter(s => s.living)) {
      const l = sh.living, op = state.operators.find(o => o.id === sh.operatorId);
      const job = collections.find(c => l.localJobId ? c.id === l.localJobId : c.obligationId === sh.contractId && !c.canceled);
      if (['awaitingCollection', 'canceled'].includes(sh.phase)) {
        if (job?.phase === 'canceled') {
          l.kitAtDepot = true; l.kitCustodian = op.careStock.id; op.location = state.homeId;
          if (sh.phase === 'canceled') { release(op, sh); op.assignment = null; }
        }
        continue;
      }
      if (['returned', 'labReceived'].includes(sh.phase)) continue;
      // Small fixed steps give live needs time to fail before a destination receipt on large clock jumps.
      while (l.lastAt + 60 <= now) {
        l.lastAt += 60; const at = l.lastAt;
        op.provisions = Math.max(0, op.provisions - 60 / (8 * HOUR));
        if (sh.phase === 'localTransit') sh.positionKm = job?.positionKm || 0;
        if (sh.receiptAt === null) care(state, sh, 60, at);
        if (sh.phase === 'localTransit') {
          sh.positionKm = job?.positionKm || 0;
          if (job?.phase !== 'returned' || job.returnedAt > at) continue;
          sh.localPaymentDue = sh.localEscrow; sh.localEscrow = 0; job.manifest = null; job.transferredTo = sh.id;
          l.kitCustodian = op.vehicleId;
          sh.phase = 'depot'; sh.positionKm = 0; sh.custodian = `covert-depot:${state.homeId}`;
        }
        const route = routes.find(r => r.id === sh.routeId);
        const routeOpen = route?.supportCapable && !['closed', 'none'].includes(route.continuity) && route.distanceKm === sh.distanceKm && route.endpointCityIds?.includes(sh.sourceId) && route.endpointCityIds?.includes(sh.destinationId);
        const crewReady = op.condition >= 50 && op.crew.every(c => c.status === 'alive' && c.health >= 50 && c.fatigue < 80);
        const reserveHours = Math.min(l.foodLeft / l.foodRate, l.waterLeft / .25, l.powerLeft);
        if (!l.outcome && ['depot', 'outbound'].includes(sh.phase) && (reserveHours < (sh.distanceKm - sh.positionKm) / 20 + sh.localDistanceKm / 24 + 2 || l.podCondition < 35)) fail(state, sh, 'returningUnsafe', at);
        if (sh.phase === 'depot') {
          if (['dead', 'escaped'].includes(l.outcome)) { emptyHome(state, sh, op); break; }
          if (l.outcome) sh.phase = 'returnLocal';
          else if (routeOpen && crewReady && op.fuelKm >= sh.distanceKm * 2 + sh.localDistanceKm * 2 && op.money >= sh.hours) {
            op.money -= sh.hours; sh.phase = 'outbound'; sh.departedAt = at;
          } else { sh.reason = 'Biological departure held; care supplies continue to be consumed.'; continue; }
        }
        if (l.outcome && sh.phase === 'outbound') sh.phase = 'returning';
        if (['dead', 'escaped'].includes(l.outcome) && sh.phase === 'returnLocal') {
          state.buyers.find(b => b.id === sh.buyerId).money += sh.returnEscrow; sh.returnEscrow = 0; sh.phase = 'localEmpty';
        }
        if (sh.phase === 'returnWaiting') {
          if (!sh.manifest.entries.some(e => e.creature)) { op.money += sh.returnEscrow; sh.returnEscrow = 0; sh.phase = 'localEmpty'; }
          else { sh.reason = 'At Concealed Exit: scientist and empty usable containment must be physically present for handoff. Care continues.'; continue; }
        }
        const local = ['returnLocal', 'localEmpty'].includes(sh.phase), outward = ['outbound', 'returnLocal'].includes(sh.phase);
        const open = local ? localRoute?.ok && localRoute.cityId === state.homeId : routeOpen;
        if (!open || !crewReady || op.fuelKm <= 0 || op.provisions <= 0) { sh.reason = 'Biological convoy held; no teleport, rescue or replacement. Care continues.'; continue; }
        const length = local ? sh.localDistanceKm : sh.distanceKm, speed = local ? 24 : 30 / (route.continuity === 'intermittent' ? 1.55 : route.continuity === 'degraded' ? 1.25 : 1);
        const remaining = outward ? length - sh.positionKm : sh.positionKm;
        const moved = Math.max(0, Math.min(remaining, speed / 60, op.fuelKm));
        op.fuelKm -= moved; op.condition -= moved * .02; op.crew.forEach(c => { c.fatigue += moved * .04; });
        sh.positionKm += outward ? moved : -moved; op.location = `${sh.phase}:${sh.positionKm.toFixed(2)}km`; sh.reason = '';
        if (sh.receiptAt === null && !sh.offsiteCreature) sh.custodian = op.vehicleId;
        if (moved + 1e-8 < remaining) continue;
        if (sh.phase === 'outbound') {
          const c = sh.manifest.entries.find(e => e.creature)?.creature;
          if (!c || stat(c, 'bodyIntegrity') < l.minimumHealth || stat(c, 'stress') > l.maximumStress) { fail(state, sh, 'arrivalRejected', at); sh.phase = 'returning'; }
          else {
            l.outcome = 'received'; sh.receiptAt = at; sh.owner = sh.buyerId; c.ownerId = sh.buyerId; sh.custodian = sh.buyerId;
            op.money += sh.freightEscrow; sh.freightEscrow = 0; state.buyers.find(b => b.id === sh.buyerId).money += sh.returnEscrow; sh.returnEscrow = 0;
            sh.phase = 'returning';
          }
        } else if (sh.phase === 'returning') {
          if (sh.receiptAt !== null) { sh.phase = 'returned'; op.assignment = null; op.location = state.homeId; release(op, sh); break; }
          if (['dead', 'escaped'].includes(l.outcome)) { emptyHome(state, sh, op); break; }
          sh.phase = 'returnLocal'; sh.positionKm = 0;
        } else if (sh.phase === 'returnLocal') {
          if (sh.manifest.entries.some(e => e.creature)) sh.phase = 'returnWaiting';
          else { op.money += sh.returnEscrow; sh.returnEscrow = 0; sh.phase = 'localEmpty'; }
        } else if (sh.phase === 'localEmpty') { sh.phase = 'returned'; op.assignment = null; op.location = state.homeId; release(op, sh); break; }
      }
      sh.lastAt = l.lastAt; op.lastAt = now;
    }
  }
  function receive(state, id, at) {
    const sh = state.shipments.find(s => s.id === id);
    if (!sh?.living || sh.phase !== 'returnWaiting') return null;
    const entry = sh.manifest.entries.find(e => e.creature); if (!entry || entry.creature.status === 'dead') return null;
    const creature = copy(entry.creature); sh.manifest.entries = sh.manifest.entries.filter(e => !e.creature);
    sh.phase = 'localEmpty'; sh.custodian = 'laboratory'; sh.living.outcome = 'returnedAlive'; sh.living.lastAt = at;
    const op = state.operators.find(o => o.id === sh.operatorId); op.money += sh.returnEscrow; sh.returnEscrow = 0; return creature;
  }
  return { provision, plan, reserve, release, collected, advance, receive };
});
