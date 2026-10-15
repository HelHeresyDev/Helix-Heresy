(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./foreign-expedition-escort') : root.HelixForeignExpeditionEscort,
    node ? require('./expedition-escorts') : root.HelixExpeditionEscorts);
  if (node) module.exports = api;
  if (root) root.HelixForeignEscortHauling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Foreign, Escorts) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const key = c => `${c?.x},${c?.y},${c?.z}`;
  const GOODS = Object.freeze(['stoneBlocks', 'fieldLog', 'lumber']);
  const SCOPE = 'One voluntary delivery of one identified ordinary loose material unit to the personally marked outdoor station drop, with ten attended seconds each for pickup and deposit. Existing hourly wages continue; no surcharge, dedicated protection while hauling, repeated work, storage access, building, garrison, title or extra transport seat.';
  const state = s => s.hauling ||= { next: 1, drop: null, quote: null, job: null, issued: [], history: [], received: null, reply: null };
  const active = s => s?.hauling?.job?.status === 'working';
  function eligible(i) {
    return Boolean(i && i.section === 'resources' && GOODS.includes(i.key) && Number.isInteger(i.quantity) && i.quantity > 0
      && !i.chemicalBatch && !i.creature && !i.biology && !i.contents?.length && !i.cityOwnerId && !i.civicCustody
      && !i.fixtureId && !i.containerId && !(i.tags || []).some(t => /living|soul|toxic|hazard|contaminat|volatile|waste/i.test(t)));
  }
  const signature = i => JSON.stringify([i.section, i.key, i.unitMassKg, i.unitVolumeL, i.dimensionsM, i.sourceLabels, i.materialComposition, i.tags]);
  const policy = c => JSON.stringify([c.source?.restrictions, c.source?.prohibitions]);
  function reason(s, c, contact = false) {
    if (!s?.source || s.actor?.id !== s.source.allocationId || !Foreign.current(s, c) || !Foreign.control(s, c) || !c.originalTrip || s.contract?.status !== 'active')
      return 'The original current chapter-backed local paid engagement must still permit new work.';
    if (!c.capable || c.escortIncapacitated || s.actor.status === 'dead' || Escorts.refusal(s.actor)
      || c.care || c.drag || c.otherWork || c.threatened) return 'Capable willing people, safe conditions and no competing care, casualty assistance or work are required.';
    if (contact && (!c.near || c.busy)) return 'Personally meet the same professional to discuss this delivery.';
    const rule = c.source.restrictions?.find(r => r.forbidsHauling);
    return rule ? rule.text : '';
  }
  function mark(s, c, now) {
    if (!s?.source || !c.alive || !c.capable || c.custody || !c.local || !c.near || c.busy || !c.dropLegal || active(s) || !c.site) return false;
    const h = state(s); h.drop = { at: now, worldId: c.site.worldId, siteId: c.site.siteId, roomId: c.site.roomId, cell: copy(c.dropCell) };
    h.quote = null; return true;
  }
  function review(s, c, item, now) {
    const blocked = reason(s, c, true);
    if (blocked || active(s)) {
      if (c.near && c.alive && c.capable && !c.busy) state(s).reply = { at: now, reason: blocked || 'Finish or cancel the existing one-delivery assignment first.', scope: SCOPE };
      return null;
    }
    const h = state(s); h.quote = null;
    const error = !h.drop || !c.site || h.drop.siteId !== c.site.siteId || h.drop.worldId !== c.site.worldId || !c.dropLegal
      ? 'Mark a reachable inspected outdoor drop beside the original station first.'
      : !eligible(item) || item.carriedBy || item.reservedTaskId || item.roomId !== c.site.roomId || !c.itemVisible
        ? 'Personally identify an available owned loose stone block, field log or lumber unit.'
        : !c.carryOk ? 'The material unit does not fit beside the professional’s actual existing kit.'
          : !c.routeOk ? 'No permitted physical route connects pickup and the agreed drop.' : '';
    h.reply = { at: now, reason: error || 'One delivery only, by explicit consent; existing hourly wages continue.', scope: SCOPE };
    if (error) return null;
    h.quote = { at: now, expiresAt: now + 60, scope: SCOPE, actorId: s.actor.id, contractId: s.contract.id,
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId, worldId: c.site.worldId, siteId: c.site.siteId,
      roomId: c.site.roomId, sourceId: item.id, sourceQuantity: item.quantity, signature: signature(item),
      pickup: copy(item.cell), drop: copy(h.drop.cell), policy: policy(c), hourly: s.contract.hourly };
    return copy(h.quote);
  }
  function accept(s, c, item, expected, now, reserve) {
    const h = state(s), q = h.quote;
    if (!q || reason(s, c, true) || active(s) || !Number.isFinite(now) || now < q.at || now >= q.expiresAt
      || JSON.stringify(q) !== JSON.stringify(expected) || q.actorId !== s.actor.id || q.contractId !== s.contract.id
      || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId || q.policy !== policy(c)
      || q.siteId !== c.site?.siteId || q.worldId !== c.site?.worldId || !c.dropLegal || key(q.drop) !== key(h.drop?.cell)
      || !eligible(item) || item.id !== q.sourceId || item.quantity !== q.sourceQuantity || item.carriedBy || item.reservedTaskId
      || signature(item) !== q.signature || key(item.cell) !== key(q.pickup) || item.roomId !== q.roomId
      || !c.itemVisible || !c.carryOk || !c.routeOk) return false;
    const id = `escort-haul:${s.contract.id}:${h.next}`, slice = reserve(item, id);
    if (!slice || slice.quantity !== 1 || slice.reservedTaskId !== id) return false;
    h.next++; h.job = { ...copy(q), id, stackId: slice.id, status: 'working', phase: 'pickup', progress: 0,
      lastAt: now, attended: false, reason: '', acceptedAt: now };
    h.issued.push({ ...copy(q), id, stackId: slice.id, acceptedAt: now });
    h.quote = null; s.actor.order = 'haul'; return true;
  }
  function stop(s, hooks, now, why = 'Delivery cancelled by personal instruction.', status = 'cancelled', canDrop = true) {
    if (!active(s)) return false;
    const h = state(s), j = h.job;
    hooks.release(j, canDrop); j.status = status; j.reason = why; j.endedAt = now; j.attended = false;
    h.history.push(copy(j)); if (s.actor.order === 'haul') s.actor.order = 'hold'; return true;
  }
  function advance(s, c, hooks, now) {
    if (!active(s) || !c.alive) return 0;
    const j = s.hauling.job, dt = Math.max(0, now - j.lastAt); j.lastAt = now;
    const unsupported = reason(s, c) || (j.actorId !== s.actor.id || j.contractId !== s.contract.id
      || j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || j.tripId !== c.tripId
      || j.siteId !== c.site?.siteId || j.worldId !== c.site?.worldId ? 'Original person, body, visit, trip or station changed.' : '');
    if (unsupported) { stop(s, hooks, now, unsupported, 'interrupted', !c.escortIncapacitated && s.actor.status !== 'dead'); return 1; }
    const item = hooks.item(j.stackId), carrying = j.phase === 'delivery' || j.phase === 'unload';
    if (!eligible(item) || item.quantity !== 1 || signature(item) !== j.signature || item.reservedTaskId !== j.id
      || (carrying ? item.carriedBy !== s.actor.id : item.carriedBy || item.roomId !== j.roomId || key(item.cell) !== key(j.pickup))) {
      stop(s, hooks, now, 'The original material or its exact custody changed; no replacement was fetched.', 'interrupted'); return 1;
    }
    if (!c.dropLegal || !hooks.capacity(carrying, item)) { j.reason = 'Original drop access or actual carrying capacity is unavailable.'; j.attended = false; return 1; }
    const goal = carrying ? j.drop : j.pickup;
    if (!hooks.adjacent(goal)) {
      j.attended = false; j.reason = hooks.move(goal) ? '' : 'Physical route blocked; waiting without delivery credit.';
      return 1;
    }
    const phase = carrying ? 'unload' : 'load';
    if (j.phase !== phase || !j.attended) { j.phase = phase; j.attended = true; j.reason = ''; return 1; }
    j.progress += Math.min(dt, 10 - j.progress); j.reason = '';
    if (j.progress < 10) return 1;
    if (!carrying) {
      if (!hooks.pickup(j)) { j.progress = 0; j.attended = false; return 1; }
      j.phase = 'delivery'; j.progress = 0; j.attended = false;
    } else {
      if (!hooks.deposit(j)) { j.progress = 0; j.attended = false; return 1; }
      j.status = 'delivered'; j.endedAt = now; j.reason = 'One original unit physically deposited at the agreed outdoor drop.';
      s.hauling.history.push(copy(j)); s.actor.order = 'hold';
    }
    return 1;
  }
  function receive(s, c, now) {
    const h = s?.hauling, j = h?.job;
    if (!j || j.actorId !== s.actor?.id || !c.alive || !c.capable || !c.near || c.busy || c.custody || c.escortIncapacitated || s.actor.status === 'dead'
      || c.bodyEpoch !== j.bodyEpoch || c.visitId !== j.visitId || c.tripId !== j.tripId) return false;
    h.received = { at: now, id: j.id, status: j.status, phase: j.phase, reason: j.reason, endedAt: j.endedAt ?? null,
      stackId: j.stackId, cell: copy(s.actor.mapCell), scope: SCOPE }; return true;
  }
  function publicView(s) {
    const h = s?.hauling;
    return { drop: copy(h?.drop || null), quote: copy(h?.quote || null), issued: copy(h?.issued || []),
      reply: copy(h?.reply || null), received: copy(h?.received || null), scope: SCOPE };
  }
  return { GOODS, SCOPE, state, active, eligible, signature, reason, mark, review, accept, stop, advance, receive, publicView };
});
