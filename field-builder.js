(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldBuilder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const active = s => ['arriving', 'onSite', 'returning'].includes(s?.phase);
  const SCOPE = 'One original qualified noncombat craftsperson, an exact ordered list of one to four initial hut components. 40 engagement plus 48 reserved wages at 24/hour, capped at two on-site hours including walking between jobs, waits and rest; wages round up at settlement. Actual staged owned materials and original shared loaned tools, physical travel, ordinary work and wear. No repair, reconstruction, automatic repeat, supplied stock, seat, protection, title or garrison. Return and tool handback are physical; reports are dated.';
  const components = offer => offer?.components || (offer ? [offer] : []);
  function validOrder(offer) {
    const rows = components(offer);
    return Array.isArray(rows) && rows.length >= 1 && rows.length <= 4 && new Set(rows.map(p => p?.part?.id)).size === rows.length
      && rows.every(p => p?.part?.id && p.workCell && JSON.stringify(p.site) === JSON.stringify(offer.site));
  }
  function order(rows) {
    if (!Array.isArray(rows) || rows.some(p => !p || p.components)) return null;
    if (rows.length === 1) return validOrder(rows[0]) ? copy(rows[0]) : null;
    const tools = new Map();
    for (const p of rows) for (const t of p.tools || []) {
      if (tools.has(t.toolId) && JSON.stringify(tools.get(t.toolId)) !== JSON.stringify(t)) return null;
      tools.set(t.toolId, t);
    }
    const offer = { ...copy(rows[0] || {}), components: copy(rows), tools: copy([...tools.values()]), inputs: copy(rows.flatMap(p => p.inputs)) };
    return validOrder(offer) ? offer : null;
  }
  const currentOffer = s => components(s?.contract?.offer)[Math.min(s?.contract?.index || 0, components(s?.contract?.offer).length - 1)];
  const claimId = (s, index = Math.min(s.contract.index || 0, components(s.contract.offer).length - 1)) => components(s.contract.offer).length > 1 ? `${s.contract.id}:part-${index}` : s.contract.id;
  function complete(s, now) {
    const k = s?.contract; if (!k) return false;
    const offer = currentOffer(s);
    if (s.phase !== 'onSite' || k.actorId !== s.actor.id || s.job?.actorId !== s.actor.id || k.finishedAt != null || !Number.isFinite(now) || s.job?.status !== 'completed' || s.job.partId !== offer?.part.id
      || s.job.taskId !== claimId(s)) return false;
    (k.completed ||= []).push({ at: now, partId: offer.part.id, taskId: s.job.taskId });
    s.history.push({ at: now, contractId: k.id, partId: offer.part.id, actorId: s.actor.id, kind: 'built' });
    k.index = (k.index || 0) + 1; k.pickup = null;
    const next = components(k.offer)[k.index];
    if (next) { k.drop = copy(next.workCell); s.job = null; k.reason = 'Next explicitly authorized component; original wage clock continues.'; }
    else { k.finishedAt = now; k.reason = 'All explicitly commissioned components are physically installed; awaiting personal contact.'; }
    return true;
  }
  function source(city, institution, current, excursion) {
    if (!city?.assetId || city.cityId !== excursion?.source.cityId || city.assetId !== excursion.source.populationSourceId
      || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 8 || city.physicalCondition === 'ruined'
      || ['abandoned', 'destroyed'].includes(city.habitationStatus) || !institution?.id || institution.id !== excursion.source.worksId
      || !['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || institution.capacityBand)
      || ['displaced', 'disrupted', 'suspended', 'destroyed'].includes(current?.operationalStatus || institution.operationalStatus)) return null;
    return { cityId: city.cityId, populationId: city.assetId, people: 1, providerId: institution.id,
      allocationId: `${institution.id}:field-builder`, label: institution.name || 'Local Public Works',
      restrictions: copy(institution.clientRestrictions || []), prohibitions: copy(institution.prohibitions || []) };
  }
  function create(backing, e, now) {
    if (!backing || !e?.wilderness || backing.cityId !== e.source.cityId || backing.populationId !== e.source.populationSourceId) return null;
    const meeting = { x: 15, y: 10, z: e.entry.z };
    return { role: 'builder', source: copy(backing), phase: 'idle', next: 1, lastAt: now, dutySeconds: 28800, quote: null, contract: null,
      layout: { meeting, groundRoomId: e.roomId, wildernessRoomId: e.wilderness.roomId, gate: copy(e.wilderness.gate) },
      actor: { id: backing.allocationId, name: `${backing.label} field craftsperson`, actorKind: 'surfaceWorker', kind: 'visitor', present: true,
        status: 'alive', health: 100, maxHealth: 100, skills: { fabrication: 12, perception: 4 }, roomId: e.roomId, mapCell: copy(meeting),
        nextMoveAt: now, needs: Survival.defaultState(now), order: 'hold' }, history: [], received: null, reply: null, job: null };
  }
  const policy = c => JSON.stringify([c.source?.restrictions, c.source?.prohibitions]);
  const contact = c => c.alive && c.capable && c.originalBody && !c.custody && c.near && !c.busy;
  const control = (s, c) => Boolean(c.alive && c.capable && c.originalBody && !c.custody && c.originalTrip && s.contract
    && s.contract.bodyEpoch === c.bodyEpoch && s.contract.visitId === c.visitId && s.contract.tripId === c.tripId);
  function refusal(s, c) {
    if (['resting', 'paused'].includes(s.recovery?.status)) return 'Finish or personally end off-duty recovery before a new work agreement.';
    if (!c.source || !['cityId', 'populationId', 'providerId', 'allocationId'].every(k => s.source[k] === c.source[k])) return 'The original qualified public-works allocation is unavailable.';
    if (s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || c.incapacitated || s.actor.health < 60 || s.dutySeconds <= 300
      || ['hunger', 'thirst', 'exposure', 'exertion'].some(k => s.actor.needs[k] >= 80)) return 'The original craftsperson cannot safely accept work; no replacement supplied.';
    const rule = c.source.restrictions.find(r => r.refusesDeclaredOpposition || r.forbidsPrivateConstruction || r.forbidsWildernessWork);
    return rule ? rule.text || 'This provider refuses the disclosed commission.' : c.threatened ? 'Immediate danger prevents noncombat construction.' : '';
  }
  function review(s, c, offer, now) {
    if (!s || !Number.isFinite(now) || !contact(c) || !c.atGround || !c.originalTrip || !['idle', 'completed'].includes(s.phase)) return null;
    s.quote = null;
    const why = refusal(s, c) || (!validOrder(offer) || !c.routeOk ? 'Personally inspect one to four distinct ordered unbuilt components, reachable work positions, exact staged materials and usable tools first.' : '')
      || (s.dutySeconds < 7500 ? 'Finite duty cannot cover the budget and withdrawal margin.' : '');
    s.reply = { at: now, reason: why || SCOPE }; if (why) return null;
    s.quote = { at: now, expiresAt: now + 60, actorId: s.actor.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId,
      policy: policy(c), offer: copy(offer), hazards: copy(c.hazards), fee: 40, reserve: 48, hourly: 24, seconds: 7200, upfront: 88, scope: SCOPE };
    return copy(s.quote);
  }
  function hire(s, c, offer, expected, wallet, now, reserve) {
    const q = s?.quote;
    if (!q || !Number.isFinite(now) || now < q.at || now >= q.expiresAt || !contact(c) || !c.atGround || !c.originalTrip || refusal(s, c)
      || !['idle', 'completed'].includes(s.phase) || !validOrder(offer) || !c.routeOk || s.dutySeconds < 7500 || q.actorId !== s.actor.id
      || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId || q.policy !== policy(c)
      || JSON.stringify(q) !== JSON.stringify(expected) || JSON.stringify(q.offer) !== JSON.stringify(offer)
      || JSON.stringify(q.hazards) !== JSON.stringify(c.hazards) || !Number.isFinite(wallet?.money) || wallet.money < q.upfront) return false;
    const id = `field-build:${s.actor.id}:${s.next}`;
    const claims = reserve(q.offer, id); if (!claims) return false;
    wallet.money -= q.upfront; s.next++;
    s.contract = { ...copy(q), id, site: copy(offer.site), drop: copy(components(offer)[0].workCell), hiredAt: now, startedAt: null, earned: 0, refund: null,
      claims: copy(claims), index: 0, completed: [], reason: '' };
    s.phase = 'arriving'; s.job = null; s.quote = null; s.lastAt = now; s.actor.needs.lastAt = now; return true;
  }
  function withdraw(s, hooks, now, why = 'Personally requested withdrawal.') {
    if (!active(s)) return false;
    const returning = s.phase === 'returning';
    if (s.job?.status === 'working') hooks.cancel(s.job);
    hooks.release(s.contract); s.contract.pickup = null; s.phase = 'returning'; if (!returning) s.contract.reason = why; return true;
  }
  function advance(s, c, hooks, now) {
    if (!s || !Number.isFinite(now) || !c.alive || !active(s) || now < s.lastAt) return 0;
    const dt = now - s.lastAt; s.lastAt = now; const k = s.contract, a = s.actor;
    s.dutySeconds = Math.max(0, s.dutySeconds - dt);
    if (k.startedAt != null) k.earned = Math.min(k.reserve, Math.max(k.earned, (Math.min(now, a.diedAt ?? now) - k.startedAt) * k.hourly / 3600));
    if (a.status === 'dead') { withdraw(s, hooks, now, 'Original craftsperson died; property remains at the actual body.'); s.phase = 'dead'; return 1; }
    if (!control(s, c) || refusal(s, c) || c.injured || k.policy !== policy(c) || JSON.stringify(k.site) !== JSON.stringify(c.site)
      || s.dutySeconds <= 300 || k.startedAt != null && now >= k.startedAt + k.seconds)
      withdraw(s, hooks, now, c.threatened ? 'Immediate danger: noncombat withdrawal.' : 'Original authority, safe condition or finite budget ended.');
    if (c.incapacitated) { if (s.job) s.job.attended = false; return 1; }
    if (s.phase === 'returning') {
      if (hooks.adjacent(s.layout.meeting) && a.roomId === s.layout.groundRoomId) { s.phase = 'awaitingSettlement'; k.returnedAt = now; }
      else hooks.move(s.layout.meeting);
    } else if (s.phase === 'arriving') {
      if (hooks.atWork()) { s.phase = 'onSite'; k.startedAt = now; } else hooks.move(k.drop);
    } else if (c.care) { if (s.job) s.job.attended = false; k.pickup = null; }
    else if (!k.finishedAt) hooks.work(s, now);
    return 1;
  }
  function receive(s, c, now) {
    if (!s?.contract || !Number.isFinite(now) || !contact(c) || c.incapacitated || s.actor.status === 'dead' || s.actor.id !== s.contract.actorId || c.bodyEpoch !== s.contract.bodyEpoch) return false;
    s.received = { at: now, phase: s.phase, earned: s.contract.earned, reason: s.contract.reason, finishedAt: s.contract.finishedAt ?? null,
      completed: copy(s.contract.completed || []), condition: s.actor.health, cell: copy(s.actor.mapCell), job: copy(s.job), scope: SCOPE }; return true;
  }
  function settle(s, c, wallet, now) {
    if (s?.phase !== 'awaitingSettlement' || !Number.isFinite(now) || !contact(c) || !c.atGround || c.incapacitated || s.actor.status === 'dead' || s.actor.id !== s.contract.actorId
      || s.contract.bodyEpoch !== c.bodyEpoch || s.contract.refund != null || !c.toolsReturned || !Number.isFinite(wallet?.money)) return false;
    s.contract.earned = Math.min(48, Math.ceil(s.contract.earned)); s.contract.refund = 48 - s.contract.earned;
    wallet.money += s.contract.refund; s.contract.settledAt = now; s.phase = 'completed'; receive(s, c, now); return true;
  }
  function publicView(s) {
    return copy({ source: s?.source || null, quote: s?.quote || null, proposal: s?.proposal || null, reply: s?.reply || null, received: s?.received || null, scope: SCOPE,
      agreement: s?.contract ? { id: s.contract.id, hiredAt: s.contract.hiredAt, offer: s.contract.offer, fee: 40, reserve: 48,
        ...(s.contract.settledAt == null ? {} : { settledAt: s.contract.settledAt, refund: s.contract.refund }) } : null });
  }
  return { SCOPE, components, validOrder, order, currentOffer, claimId, complete, active, source, create, control, refusal, review, hire, withdraw, advance, receive, settle, publicView };
});
