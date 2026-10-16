(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./foreign-escort-hauling') : root.HelixForeignEscortHauling,
    node ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (node) module.exports = api;
  if (root) root.HelixFieldPorter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Hauling, Survival) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const SHIFT = 7200, FEE = 40, HOURLY = 12;
  const SCOPE = 'One noncombat porter, two on-site hours (including waiting and rest), 40 engagement plus 24 prepaid wages. Earned wages round up to whole currency at settlement. Disclosed wilderness hazards and the original station/return route only. One personally instructed loose stone, log or lumber delivery at a time; no queue, crates, building, guard, vehicle seat or guaranteed rescue. Settlement at the defended meeting point after physical return.';
  function source(city, standings, excursion) {
    if (!city?.assetId || city.cityId !== excursion?.source.cityId || city.assetId !== excursion.source.populationSourceId
      || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 8 || city.physicalCondition === 'ruined'
      || ['abandoned', 'destroyed'].includes(city.habitationStatus) || !['functional', 'strong', 'regionalHub'].includes(city.services?.transport)) return null;
    const e = [...(standings || [])].sort((a, b) => String(a.branch?.id).localeCompare(String(b.branch?.id))).find(e => e.network?.id && e.network.category === 'transport'
      && e.branch?.id && e.branch.organizationForm === 'contractDepot' && e.branch.publicPhysicalPresence === true
      && (e.branch.currentCityId || e.branch.cityId) === city.cityId && ['licensed', 'chartered', 'recognized'].includes(e.standing)
      && e.branch.operationalStatus === 'active' && !['ruined', 'destroyed'].includes(e.branch.physicalCondition)
      && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)
      && (e.network.roles || []).some(r => ['courierDispatch', 'freightBrokerage', 'routeHandoffs', 'armoredHandoffs'].includes(r)));
    return e ? { cityId: city.cityId, populationId: city.assetId, people: 1, branchId: e.branch.id, networkId: e.network.id,
      label: e.branch.publicName, allocationId: `${e.branch.id}:field-porter`,
      restrictions: copy([...(e.network.clientRestrictions || []), ...(e.branch.clientRestrictions || [])]), prohibitions: copy(e.network.prohibitions || []) } : null;
  }
  function create(backing, excursion, now) {
    if (!backing || !excursion?.wilderness || backing.cityId !== excursion.source.cityId || backing.populationId !== excursion.source.populationSourceId) return null;
    const meeting = { x: 13, y: 10, z: excursion.entry.z };
    return { source: copy(backing), phase: 'idle', next: 1, lastAt: now, dutySeconds: 8 * 3600, quote: null, contract: null,
      layout: { meeting, groundRoomId: excursion.roomId, wildernessRoomId: excursion.wilderness.roomId, gate: copy(excursion.wilderness.gate) },
      actor: { id: backing.allocationId, name: `${backing.label} field porter`, actorKind: 'surfaceWorker', kind: 'visitor',
        present: true, cityId: backing.cityId, affiliation: backing.label, status: 'alive', health: 100, maxHealth: 100,
        roomId: excursion.roomId, mapCell: copy(meeting), nextMoveAt: now, needs: Survival.defaultState(now),
        skills: { hauling: 8, perception: 3 }, order: 'hold' },
      job: null, history: [], issued: [], received: null, reply: null };
  }
  const active = s => ['arriving', 'onSite', 'returning'].includes(s?.phase);
  const current = (s, c) => Boolean(c.source && ['cityId', 'populationId', 'branchId', 'networkId', 'allocationId'].every(k => s.source[k] === c.source[k]));
  const policy = c => JSON.stringify([c.source?.restrictions, c.source?.prohibitions]);
  const control = (s, c) => Boolean(c.alive && c.capable && c.originalBody && !c.custody && c.originalTrip
    && s.contract?.bodyEpoch === c.bodyEpoch && s.contract.visitId === c.visitId && s.contract.tripId === c.tripId);
  const contact = c => c.alive && c.capable && c.originalBody && !c.custody && c.near && !c.busy;
  function refusal(s, c) {
    if (!current(s, c)) return 'The original functioning population-backed transport depot is unavailable.';
    if (s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || c.incapacitated || s.actor.health < 60 || s.dutySeconds <= 300
      || Math.max(...['hunger', 'thirst', 'exposure', 'exertion'].map(k => s.actor.needs[k])) >= 80) return 'The original porter cannot safely accept this work; no replacement is allocated.';
    const rule = c.source.restrictions.find(r => r.forbidsHauling || r.refusesDeclaredOpposition);
    return rule ? rule.text || 'This depot refuses the disclosed employment.' : c.threatened ? 'Known immediate danger prevents noncombat work.' : '';
  }
  function review(s, c, now) {
    if (!s || !Number.isFinite(now) || !contact(c) || !c.atGround || !c.originalTrip || active(s) || !['idle', 'completed'].includes(s.phase)) return null;
    s.quote = null;
    const reason = refusal(s, c) || (!c.site || !c.dropLegal || !c.routeOk ? 'Personally mark an inspected reachable station drop and disclose its wilderness hazards and return route.' : '')
      || (s.dutySeconds < SHIFT + 300 ? 'Original finite duty cannot cover a two-hour shift and return margin.' : '');
    s.reply = { at: now, reason: reason || SCOPE };
    if (reason) return null;
    s.quote = { at: now, expiresAt: now + 60, actorId: s.actor.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId,
      site: copy(c.site), drop: copy(c.drop), meeting: copy(s.layout.meeting), hazards: copy(c.hazards), policy: policy(c), fee: FEE, hourly: HOURLY, reserve: 24, upfront: 64, seconds: SHIFT, scope: SCOPE };
    return copy(s.quote);
  }
  function hire(s, c, expected, wallet, now) {
    const q = s?.quote;
    if (!q || !Number.isFinite(now) || !contact(c) || !c.atGround || !c.originalTrip || refusal(s, c) || active(s) || !['idle', 'completed'].includes(s.phase)
      || now < q.at || now >= q.expiresAt || JSON.stringify(q) !== JSON.stringify(expected) || q.actorId !== s.actor.id
      || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId || q.policy !== policy(c)
      || JSON.stringify(q.site) !== JSON.stringify(c.site) || JSON.stringify(q.hazards) !== JSON.stringify(c.hazards)
      || !same(q.drop, c.drop) || !c.dropLegal || !c.routeOk || s.dutySeconds < SHIFT + 300 || !Number.isFinite(wallet?.money) || wallet.money < q.upfront) return false;
    wallet.money -= q.upfront;
    s.contract = { ...copy(q), id: `${s.actor.id}:shift-${s.next++}`, hiredAt: now, startedAt: null, earned: 0, refund: null, reason: '' };
    s.phase = 'arriving'; s.lastAt = now; s.actor.needs.lastAt = now; s.quote = null; s.job = null;
    return true;
  }
  function stopJob(s, hooks, now, why, canDrop = true) {
    if (s.job?.status !== 'working') return false;
    hooks.release(s.job, canDrop); s.job.status = 'interrupted'; s.job.reason = why; s.job.endedAt = now; s.job.attended = false;
    s.history.push(copy(s.job)); return true;
  }
  function withdraw(s, hooks, now, why = 'Personally requested withdrawal.', canDrop = true) {
    if (!active(s)) return false;
    stopJob(s, hooks, now, why, canDrop); s.phase = 'returning'; s.contract.reason ||= why; return true;
  }
  function assign(s, c, item, now, reserve) {
    if (!Number.isFinite(now) || s.phase !== 'onSite' || !control(s, c) || !contact(c) || refusal(s, c) || c.care || s.job?.status === 'working'
      || !c.dropLegal || !c.itemVisible || !c.carryOk || !c.routeOk || !Hauling.eligible(item) || item.carriedBy || item.reservedTaskId
      || item.roomId !== s.contract.site.roomId) return false;
    const id = `field-porter-haul:${s.contract.id}:${s.next++}`, slice = reserve(item, id);
    if (!slice || slice.quantity !== 1 || slice.reservedTaskId !== id) return false;
    s.job = { id, actorId: s.actor.id, stackId: slice.id, sourceId: item.id, signature: Hauling.signature(item),
      roomId: item.roomId, pickup: copy(item.cell), drop: copy(s.contract.drop), status: 'working', phase: 'pickup', progress: 0, lastAt: now, attended: false, reason: '' };
    s.issued.push({ at: now, id, sourceId: item.id, stackId: slice.id, pickup: copy(item.cell), drop: copy(s.contract.drop) }); return true;
  }
  function haul(s, c, hooks, now) {
    const j = s.job; if (j?.status !== 'working') return;
    const dt = Math.max(0, now - j.lastAt); j.lastAt = now;
    const i = hooks.item(j.stackId), carrying = ['delivery', 'unload'].includes(j.phase);
    if (!Hauling.eligible(i) || i.quantity !== 1 || i.reservedTaskId !== j.id || Hauling.signature(i) !== j.signature
      || (carrying ? i.carriedBy !== s.actor.id : i.carriedBy || i.roomId !== j.roomId || !same(i.cell, j.pickup))) {
      stopJob(s, hooks, now, 'Original material or custody changed; no substitute fetched.'); return;
    }
    if (!c.dropLegal || !hooks.capacity(carrying, i)) { j.attended = false; j.reason = 'Drop or carrying capacity unavailable.'; return; }
    const goal = carrying ? j.drop : j.pickup;
    if (!hooks.adjacent(goal)) { j.attended = false; j.reason = hooks.move(goal) ? '' : 'Physical route blocked; no attendance credited.'; return; }
    const phase = carrying ? 'unload' : 'load';
    if (j.phase !== phase || !j.attended) { j.phase = phase; j.attended = true; return; }
    j.progress += Math.min(dt, 10 - j.progress); j.reason = '';
    if (j.progress < 10) return;
    if (carrying ? hooks.deposit(j) : hooks.pickup(j)) {
      j.progress = 0; j.attended = false;
      if (carrying) { j.status = 'delivered'; j.endedAt = now; j.reason = 'Original unit physically delivered.'; s.history.push(copy(j)); }
      else j.phase = 'delivery';
    } else { j.progress = 0; j.attended = false; }
  }
  function advance(s, c, hooks, now) {
    if (!s || !Number.isFinite(now) || !c.alive || now < s.lastAt || !active(s)) return 0;
    const dt = Math.max(0, now - s.lastAt); s.lastAt = now;
    const a = s.actor, k = s.contract;
    s.dutySeconds = Math.max(0, s.dutySeconds - dt);
    if (k.startedAt != null) k.earned = Math.min(k.reserve, Math.max(k.earned, (Math.min(now, a.diedAt ?? now) - k.startedAt) * HOURLY / 3600));
    if (a.status === 'dead') { stopJob(s, hooks, now, 'Original porter died; possessions remain at the body.', false); s.phase = 'dead'; return 1; }
    if (!control(s, c) || refusal(s, c) || k.policy !== policy(c) || JSON.stringify(k.site) !== JSON.stringify(c.site)
      || c.injured || s.dutySeconds <= 300 || k.startedAt != null && now >= k.startedAt + SHIFT) {
      withdraw(s, hooks, now, c.threatened ? 'Immediate danger: noncombat withdrawal.' : c.injured ? 'Physical injury: withdrawal.' : 'Original authority, safe condition or finite shift ended.', !c.incapacitated);
    }
    if (c.incapacitated) { if (s.job) s.job.attended = false; return 1; }
    if (s.phase === 'returning') {
      if (hooks.adjacent(s.layout.meeting) && a.roomId === s.layout.groundRoomId) { s.phase = 'awaitingSettlement'; k.returnedAt = now; }
      else hooks.move(s.layout.meeting);
    } else if (s.phase === 'arriving') {
      if (hooks.adjacent(k.drop) && a.roomId === k.site.roomId) { s.phase = 'onSite'; k.startedAt = now; }
      else hooks.move(k.drop);
    } else if (c.care) { if (s.job) s.job.attended = false; }
    else haul(s, c, hooks, now);
    return 1;
  }
  function receive(s, c, now) {
    if (!s?.contract || !Number.isFinite(now) || !contact(c) || c.incapacitated || s.actor.id !== s.contract.actorId || s.actor.status === 'dead' || c.bodyEpoch !== s.contract.bodyEpoch) return false;
    s.received = { at: now, phase: s.phase, earned: s.contract.earned, reason: s.contract.reason, health: s.actor.health,
      needs: copy(s.actor.needs), cell: copy(s.actor.mapCell), job: copy(s.job), scope: SCOPE }; return true;
  }
  function settle(s, c, wallet, now) {
    if (s?.phase !== 'awaitingSettlement' || !Number.isFinite(now) || !Number.isFinite(wallet?.money) || !contact(c) || !c.atGround || c.incapacitated
      || s.actor.id !== s.contract.actorId || s.actor.status === 'dead' || s.contract.bodyEpoch !== c.bodyEpoch
      || !same(s.contract.meeting, s.layout.meeting) || s.contract.refund != null) return false;
    s.contract.earned = Math.min(s.contract.reserve, Math.ceil(s.contract.earned));
    const refund = Math.max(0, s.contract.reserve - s.contract.earned);
    wallet.money += refund; s.contract.refund = refund; s.contract.settledAt = now; s.phase = 'completed'; receive(s, c, now); return true;
  }
  function publicView(s) {
    return copy({ source: s?.source || null, quote: s?.quote || null, reply: s?.reply || null,
      agreement: s?.contract ? { id: s.contract.id, hiredAt: s.contract.hiredAt, site: s.contract.site, drop: s.contract.drop,
        fee: FEE, reserve: 24, seconds: SHIFT, scope: SCOPE, ...(s.contract.settledAt == null ? {} : { settledAt: s.contract.settledAt, refund: s.contract.refund }) } : null,
      issued: s?.issued || [], received: s?.received || null, scope: SCOPE });
  }
  return { SHIFT, FEE, HOURLY, SCOPE, source, create, active, current, control, review, hire, refusal, assign, stopJob, withdraw, advance, receive, settle, publicView };
});
