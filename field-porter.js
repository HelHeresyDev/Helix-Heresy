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
  const SCOPE = 'One noncombat porter, two on-site hours (including waiting and rest), 40 engagement plus 24 prepaid wages. Earned wages round up to whole currency at settlement. Disclosed wilderness hazards and the original station/return route only. Personally accepted orders of one to four exact loose stone, log or lumber units, carried sequentially to the outdoor drop or separately inspected ground-level hut staging tiles. Separately accepted stone/lumber deposits may enter only the inspected original open station crate within actual capacity; no withdrawals or automatic ground dumping. Retained crate cargo requires personal handback after return. No automatic repeat, building, guard, vehicle seat or guaranteed rescue. Orders never extend the shift. Settlement at the defended meeting point after physical return.';
  function stagingArea(site, cell) {
    return Boolean(site?.layout?.footprint?.length && cell && ['x', 'y', 'z'].every(k => Number.isInteger(cell[k]))
      && site.layout.footprint.some(p => p.z === cell.z && Math.max(Math.abs(p.x - cell.x), Math.abs(p.y - cell.y)) <= 1));
  }
  function stageCurrent(mark, c) {
    return Boolean(mark && Number.isFinite(mark.at) && mark.cell && ['x', 'y', 'z'].every(k => Number.isInteger(mark.cell[k]))
      && ['worldId', 'siteId', 'roomId'].every(k => mark.site?.[k] && mark.site[k] === c.site?.[k])
      && mark.bodyEpoch === c.bodyEpoch && mark.visitId === c.visitId && mark.tripId === c.tripId);
  }
  function markStage(c, now) {
    if (!Number.isFinite(now) || !c.alive || !c.capable || !c.originalBody || c.custody || !c.originalTrip || c.busy || !c.local
      || !c.stageLegal || !Number.isInteger(c.bodyEpoch) || c.bodyEpoch < 0 || !c.visitId || !c.tripId || !['worldId', 'siteId', 'roomId'].every(k => c.site?.[k])
      || !stagingArea(c.site, c.cell)) return null;
    return { id: `stage:${c.cell.x},${c.cell.y},${c.cell.z}`, at: now, cell: copy(c.cell),
      site: { worldId: c.site.worldId, siteId: c.site.siteId, roomId: c.site.roomId },
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId };
  }
  function crateCurrent(mark, c) {
    return Boolean(mark?.kind === 'crate' && stageCurrent(mark, c) && mark.fixtureId && Number.isFinite(mark.installedAt)
      && mark.installationKey && mark.fixtureCell && same(mark.cell, c.crate?.cell)
      && same(mark.fixtureCell, c.crate?.fixtureCell) && mark.fixtureId === c.crate?.fixtureId
      && mark.installedAt === c.crate.installedAt && mark.installationKey === c.crate.installationKey);
  }
  function markCrate(c, now) {
    const mark = markStage({ ...c, stageLegal: c.crateLegal }, now);
    if (!mark || !c.crate || !same(c.cell, c.crate.cell)) return null;
    const result = { ...mark, id: `crate:${c.crate.fixtureId}`, kind: 'crate', ...copy(c.crate) };
    return crateCurrent(result, c) ? result : null;
  }
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
    if (c.retainedCargo && !active(s)) return 'Personally collect the original retained crate cargo before another engagement.';
    if (['resting', 'paused'].includes(s.recovery?.status)) return 'Finish or personally end off-duty recovery before a new work agreement.';
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
    s.phase = 'arriving'; s.lastAt = now; s.actor.needs.lastAt = now; s.quote = null; s.job = null; s.proposal = null; s.deliveryOrder = null;
    if (s.supplyLeg) (s.supplyHistory ||= []).push(copy(s.supplyLeg));
    s.supplyLeg = null; s.supplyPreview = null;
    return true;
  }
  function stopJob(s, hooks, now, why, canDrop = true) {
    const supplyStopped = hooks.stopSupply?.(now, why) || false;
    if (s.job?.status !== 'working') return supplyStopped;
    hooks.release(s.job, canDrop && s.job.destination?.kind !== 'crate'); s.job.status = 'interrupted'; s.job.reason = why; s.job.endedAt = now; s.job.attended = false;
    s.history.push(copy(s.job));
    const o = s.deliveryOrder;
    if (o?.status === 'working') {
      o.jobs[o.index] = copy(s.job);
      for (const j of o.jobs.slice(o.index + 1)) {
        hooks.release(j, false); j.status = 'cancelled'; j.reason = why; j.endedAt = now; s.history.push(copy(j));
      }
      o.status = 'interrupted'; o.endedAt = now; o.reason = why;
    }
    s.proposal = null;
    return true;
  }
  function withdraw(s, hooks, now, why = 'Personally requested withdrawal.', canDrop = true) {
    if (!active(s)) return false;
    stopJob(s, hooks, now, why, canDrop); s.proposal = null; s.phase = 'returning'; s.contract.reason ||= why; return true;
  }
  function canOrder(s, c, now) {
    return Boolean(s && Number.isFinite(now) && s.phase === 'onSite' && control(s, c) && contact(c) && !refusal(s, c)
      && !c.injured && !c.care && s.job?.status !== 'working' && s.supplyLeg?.status !== 'working' && s.actor.id === s.contract.actorId
      && JSON.stringify(s.contract.site) === JSON.stringify(c.site) && s.contract.policy === policy(c)
      && same(s.contract.drop, c.drop) && s.contract.startedAt != null
      && now >= s.contract.startedAt && now < s.contract.startedAt + SHIFT);
  }
  const deliveryDrop = c => c.deliveryDrop || c.drop;
  const destinationOkay = c => Boolean((c.deliveryDropLegal ?? c.dropLegal)
    && (c.destination ? (c.destination.kind === 'crate' ? crateCurrent(c.destination, c) : stageCurrent(c.destination, c))
      && same(deliveryDrop(c), c.destination.cell) : same(deliveryDrop(c), c.drop)));
  const available = (s, c, i) => Boolean(Hauling.eligible(i) && !i.carriedBy && !i.reservedTaskId
    && (c.destination?.kind !== 'crate' || ['stoneBlocks', 'lumber'].includes(i.key))
    && i.roomId === s.contract.site.roomId && c.itemVisible && c.carryOk && c.routeOk && destinationOkay(c));
  const observed = (i, now, c) => ({ sourceId: i.id, sourceQuantity: i.quantity, key: i.key, unitMassKg: i.unitMassKg, unitVolumeL: i.unitVolumeL,
    sourceLabels: copy(i.sourceLabels || []), signature: Hauling.signature(i),
    roomId: i.roomId, pickup: copy(i.cell), drop: copy(deliveryDrop(c)), destination: copy(c.destination || null), inspectedAt: now });
  function proposalCurrent(s, c, p) {
    return p && p.contractId === s.contract.id && p.actorId === s.actor.id && p.bodyEpoch === c.bodyEpoch
      && p.visitId === c.visitId && p.tripId === c.tripId && p.policy === policy(c)
      && JSON.stringify(p.site) === JSON.stringify(c.site) && same(p.drop, c.drop);
  }
  function append(s, c, item, now) {
    if (s?.supplyPreview) return false; // One unsigned kind of order at a time.
    if (!canOrder(s, c, now) || !available(s, c, item)) return false;
    const p = s.proposal || { contractId: s.contract.id, actorId: s.actor.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      tripId: c.tripId, site: copy(c.site), drop: copy(c.drop), policy: policy(c), rows: [] };
    if (!proposalCurrent(s, c, p) || p.rows.length >= 4) return false;
    const previous = p.rows.filter(r => r.sourceId === item.id), row = observed(item, now, c);
    if (previous.length >= item.quantity || previous.some(r => r.sourceQuantity !== row.sourceQuantity || r.signature !== row.signature
      || r.roomId !== row.roomId || !same(r.pickup, row.pickup))) return false;
    p.rows.push(row); s.proposal = p; return true;
  }
  function edit(s, c, now, clear = false) {
    if (!canOrder(s, c, now) || !s.proposal) return false;
    if (clear || s.proposal.rows.length <= 1) s.proposal = null;
    else s.proposal.rows.pop();
    return true;
  }
  function accept(s, c, entries, expected, now, reserve, release) {
    const p = s?.proposal;
    if (!canOrder(s, c, now) || !proposalCurrent(s, c, p) || JSON.stringify(p) !== JSON.stringify(expected)
      || !Array.isArray(p.rows) || p.rows.length < 1 || p.rows.length > 4 || !Array.isArray(entries) || entries.length !== p.rows.length
      || typeof reserve !== 'function' || typeof release !== 'function') return false;
    const counts = new Map(), crateLoads = new Map();
    for (let n = 0; n < p.rows.length; n++) {
      const r = p.rows[n], { item: i, context: ic } = entries[n];
      if (!ic || !canOrder(s, ic, now) || !available(s, ic, i) || i.id !== r.sourceId || i.quantity !== r.sourceQuantity
        || Hauling.signature(i) !== r.signature || i.roomId !== r.roomId || !same(i.cell, r.pickup)
        || !same(deliveryDrop(ic), r.drop) || JSON.stringify(ic.destination || null) !== JSON.stringify(r.destination)) return false;
      counts.set(i.id, (counts.get(i.id) || 0) + 1); if (counts.get(i.id) > i.quantity) return false;
      if (r.destination?.kind === 'crate') {
        const load = crateLoads.get(r.destination.fixtureId) || { massKg: 0, volumeL: 0 };
        load.massKg += i.unitMassKg; load.volumeL += i.unitVolumeL;
        if (![load.massKg, load.volumeL, ic.crateCapacity?.massKg, ic.crateCapacity?.volumeL].every(Number.isFinite)
          || !(i.unitMassKg > 0 && i.unitVolumeL > 0) || load.massKg > ic.crateCapacity.massKg || load.volumeL > ic.crateCapacity.volumeL) return false;
        crateLoads.set(r.destination.fixtureId, load);
      }
    }
    const orderId = `field-porter-order:${s.contract.id}:${s.next++}`, jobs = [];
    for (let n = 0; n < p.rows.length; n++) {
      const r = p.rows[n], id = `field-porter-haul:${s.contract.id}:${s.next++}`, slice = reserve(entries[n].item, id);
      if (!slice || slice.quantity !== 1 || slice.reservedTaskId !== id || Hauling.signature(slice) !== r.signature
        || slice.carriedBy || slice.roomId !== r.roomId || !same(slice.cell, r.pickup) || jobs.some(j => j.stackId === slice.id)) {
        if (slice?.reservedTaskId === id) release({ id, stackId: slice.id }, false);
        for (const j of jobs) release(j, false);
        return false;
      }
      jobs.push({ id, orderId, actorId: s.actor.id, stackId: slice.id, sourceId: r.sourceId, signature: r.signature,
        roomId: r.roomId, pickup: copy(r.pickup), drop: copy(r.drop), destination: copy(r.destination), status: 'pending', phase: 'pickup', progress: 0,
        lastAt: now, attended: false, reason: '' });
    }
    // Only s.job carries live attendance. The list stores pending instructions
    // and final receipts, so continuation never depends on aliases lost in JSON.
    s.deliveryOrder = { ...copy(p), id: orderId, acceptedAt: now, status: 'working', index: 0, jobs };
    s.job = { ...copy(jobs[0]), status: 'working' };
    s.issued.push({ ...copy(p), at: now, id: orderId, deliveries: jobs.map(j => ({ id: j.id, sourceId: j.sourceId, stackId: j.stackId,
      pickup: copy(j.pickup), drop: copy(j.drop), destination: copy(j.destination) })) });
    s.proposal = null; return true;
  }
  function assign(s, c, item, now, reserve) {
    if (s?.supplyPreview) return false;
    if (!canOrder(s, c, now) || c.destination || !available(s, c, item)) return false;
    const id = `field-porter-haul:${s.contract.id}:${s.next++}`, slice = reserve(item, id);
    if (!slice || slice.quantity !== 1 || slice.reservedTaskId !== id) return false;
    s.job = { id, actorId: s.actor.id, stackId: slice.id, sourceId: item.id, signature: Hauling.signature(item),
      roomId: item.roomId, pickup: copy(item.cell), drop: copy(s.contract.drop), status: 'working', phase: 'pickup', progress: 0, lastAt: now, attended: false, reason: '' };
    s.deliveryOrder = null; s.proposal = null;
    s.issued.push({ at: now, id, sourceId: item.id, stackId: slice.id, pickup: copy(item.cell), drop: copy(s.contract.drop) }); return true;
  }
  function haul(s, c, hooks, now) {
    const j = s.job; if (j?.status !== 'working') return;
    const dt = Math.max(0, now - j.lastAt); j.lastAt = now;
    const i = hooks.item(j.stackId), carrying = ['delivery', 'unload'].includes(j.phase);
    if (!Hauling.eligible(i) || i.quantity !== 1 || i.reservedTaskId !== j.id || Hauling.signature(i) !== j.signature
      || (carrying ? i.carriedBy !== s.actor.id : i.carriedBy || i.roomId !== j.roomId || !same(i.cell, j.pickup))) {
      if (s.deliveryOrder?.status === 'working') withdraw(s, hooks, now, 'Original material or custody changed; no substitute fetched.');
      else stopJob(s, hooks, now, 'Original material or custody changed; no substitute fetched.');
      return;
    }
    if (!(hooks.dropLegal ? hooks.dropLegal(j) : c.dropLegal) || !hooks.capacity(carrying, i)) {
      j.attended = false; j.reason = 'Drop or carrying capacity unavailable.'; return;
    }
    const goal = carrying ? j.drop : j.pickup;
    if (!hooks.adjacent(goal)) { j.attended = false; j.reason = hooks.move(goal) ? '' : 'Physical route blocked; no attendance credited.'; return; }
    const phase = carrying ? 'unload' : 'load';
    if (j.phase !== phase || !j.attended) { j.phase = phase; j.attended = true; return; }
    j.progress += Math.min(dt, 10 - j.progress); j.reason = '';
    if (j.progress < 10) return;
    if (carrying ? hooks.deposit(j) : hooks.pickup(j)) {
      j.progress = 0; j.attended = false;
      if (carrying) {
        j.status = 'delivered'; j.endedAt = now; j.reason = 'Original unit physically delivered.'; s.history.push(copy(j));
        const o = s.deliveryOrder;
        if (o?.status === 'working') {
          o.jobs[o.index] = copy(j); o.index++;
          if (o.index < o.jobs.length) s.job = { ...copy(o.jobs[o.index]), status: 'working', lastAt: now };
          else { o.status = 'delivered'; o.endedAt = now; }
        }
      }
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
    } else {
      if (s.supplyLeg?.status === 'working' && hooks.supplyLeg) { hooks.supplyLeg(now, c); return 1; }
      // Every outstanding slice stays exact. Loss never selects surplus or
      // permits later jobs to leapfrog the signed order, even during self-care.
      const o = s.deliveryOrder;
      if (s.job?.status === 'working' && hooks.destinationCurrent
        && [s.job, ...(o?.status === 'working' ? o.jobs.slice(o.index + 1) : [])].some(j => !hooks.destinationCurrent(j)))
        withdraw(s, hooks, now, 'Original agreed crate was destroyed or replaced; fresh inspection and consent required.');
      else if (o?.status === 'working' && o.jobs.slice(o.index + 1).some(j => {
        const i = hooks.item(j.stackId);
        return !Hauling.eligible(i) || i.quantity !== 1 || i.reservedTaskId !== j.id || Hauling.signature(i) !== j.signature
          || i.carriedBy || i.roomId !== j.roomId || !same(i.cell, j.pickup);
      })) withdraw(s, hooks, now, 'Original future cargo or custody changed; no substitute fetched.');
      else if (c.care) { if (s.job) { s.job.attended = false; s.job.lastAt = now; } }
      else haul(s, c, hooks, now);
    }
    return 1;
  }
  function receive(s, c, now) {
    if (!s?.contract || !Number.isFinite(now) || !contact(c) || c.incapacitated || s.actor.id !== s.contract.actorId || s.actor.status === 'dead' || c.bodyEpoch !== s.contract.bodyEpoch) return false;
    const order = copy(s.deliveryOrder || null);
    if (order?.status === 'working') order.jobs[order.index] = copy(s.job);
    s.received = { at: now, phase: s.phase, earned: s.contract.earned, reason: s.contract.reason, health: s.actor.health,
      needs: copy(s.actor.needs), cell: copy(s.actor.mapCell), job: copy(s.job), order, supplyLeg: copy(s.supplyLeg || null), scope: SCOPE }; return true;
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
      proposal: s?.proposal || null, issued: s?.issued || [], received: s?.received || null, scope: SCOPE });
  }
  return { SHIFT, FEE, HOURLY, SCOPE, stagingArea, stageCurrent, markStage, crateCurrent, markCrate, source, create, active, current, control, review, hire, refusal, canOrder, append, edit, accept,
    assign, stopJob, withdraw, advance, receive, settle, publicView };
});
