(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./foreign-expedition-escort') : root.HelixForeignExpeditionEscort,
    node ? require('./expedition-escorts') : root.HelixExpeditionEscorts);
  if (node) module.exports = api;
  if (root) root.HelixFieldForce = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Foreign, Escorts) {
  'use strict';
  const WATCH = 4 * 3600, DUTY = 12 * 3600, MARGIN = 300;
  const copy = x => JSON.parse(JSON.stringify(x));
  const SCOPE = 'Two original consenting field guards: personally accompanied outward walk on the inspected route, a four-hour defensive refuge watch, then physical return. Defend the named refuge and people physically there, including one another; no assault, pursuit, arrest, seizure, hauling, divine endorsement or extra passenger seat. Finite original kit, individual wounds and skills, 12-hour original duty, prepaid travel/wait/watch/return time. Unsafe conditions or exhausted support prompt withdrawal, not a replacement or guaranteed rescue. Personal orders/reports only; absence does not end an accepted safe watch. One bounded operation at a time; further service needs fresh consent with the same spent bodies and property, never a hire reset or automatic renewal. Eight supplied off-duty hours at the original chapter shelters may restore duty, not health or equipment.';
  const active = s => Boolean(s?.operation && !['completed', 'returned'].includes(s.operation.phase));
  const policy = source => JSON.stringify([source?.restrictions || [], source?.prohibitions || []]);
  function source(city, standings, excursion) {
    const eligible = (standings || []).filter(e => (e.network?.roles || []).some(r => ['perimeterDefense', 'monsterResponse'].includes(r)));
    const b = Foreign.source(city, eligible, excursion);
    if (!b || city.currentPopulation < 16) return null;
    return { ...b, people: 2, allocationId: `${b.branchId}:refuge-detachment`,
      memberIds: [1, 2].map(n => `${b.branchId}:refuge-guard-${n}`) };
  }
  function create(backing, excursion, seed, now) {
    if (!backing || !excursion?.wilderness || backing.cityId !== excursion.source?.cityId || backing.populationId !== excursion.source?.populationSourceId
      || backing.memberIds?.length !== 2 || new Set(backing.memberIds).size !== 2 || !Number.isFinite(now)) return null;
    const s = { source: copy(backing), quote: null, reply: null, operation: null, report: null };
    s.members = backing.memberIds.map((id, index) => {
      const m = Foreign.create({ ...backing, people: 1, allocationId: id }, excursion, seed, now);
      m.role = 'fieldGuard'; m.forceId = backing.allocationId;
      m.layout.meeting = { ...m.layout.meeting, x: m.layout.meeting.x + index + 1, y: m.layout.meeting.y + 1 };
      m.actor.mapCell = copy(m.layout.meeting); m.actor.affiliation = `${backing.label} — consenting refuge guard`;
      m.actor.order = 'hold'; m.dutySeconds = DUTY; m.phase = 'available'; return m;
    });
    return s;
  }
  const original = s => Boolean(s?.source.memberIds?.length === 2 && s.members?.length === 2
    && s.members.every((m, i) => m.actor.id === s.source.memberIds[i] && m.source.allocationId === m.actor.id));
  function current(s, c) {
    return Boolean(original(s) && c.source && ['cityId', 'populationId', 'branchId', 'networkId', 'allocationId'].every(k => s.source[k] === c.source[k])
      && JSON.stringify(s.source.memberIds) === JSON.stringify(c.source.memberIds));
  }
  const contact = c => c.alive && c.capable && c.originalBody && c.originalTrip && !c.custody && !c.busy && c.near;
  function restriction(source) {
    return source?.restrictions?.find(r => r.refusesDeclaredOpposition || r.forbidsWildernessWork || r.forbidsResidentWork || r.forbidsGuardWork)?.text
      || source?.prohibitions?.find(r => typeof r === 'object' && r.forbidsGuardWork)?.text || '';
  }
  function refusal(s, c) {
    if (!current(s, c)) return 'No current suitable population-backed defensive chapter supports these two original allocations.';
    if (!contact(c) || !c.atGround) return 'Personally muster both original capable guards at their defended municipal meeting ground.';
    if (s.operation && s.operation.phase !== 'completed') return 'Finish and personally settle the original operation before another bounded agreement.';
    if (s.employerAssault) return 'The original members refuse further employment after the scientist assaulted their detachment.';
    if (c.recovering) return 'Finish or personally end the original off-duty arrangement first.';
    if (restriction(c.source)) return restriction(c.source);
    const p = c.plan;
    if (!p || !c.routeOk || !c.refugeValid || !Number.isFinite(p.travelSeconds) || p.travelSeconds < MARGIN
      || p.route?.length < 2 || p.posts?.length !== 2 || !p.home || p.posts[0].x === p.posts[1].x && p.posts[0].y === p.posts[1].y && p.posts[0].z === p.posts[1].z)
      return 'Personally inspect the complete refuge, two distinct posts and an actually known walkable outward/return route.';
    const seconds = WATCH + 2 * p.travelSeconds + MARGIN;
    if (seconds > DUTY || s.members.some(m => m.dutySeconds < seconds || Escorts.refusal(m.actor) || c.incapacitatedIds?.includes(m.actor.id)))
      return 'Original health, endurance or finite duty cannot support travel, watch and withdrawal.';
    if (!c.supplied || c.threatened) return 'Both original guards need usable personal weapons/vests, real travel provisions and no immediate danger at muster.';
    return '';
  }
  function review(s, c, now) {
    if (!s || !Number.isFinite(now) || !contact(c)) return null;
    s.quote = null;
    const reason = refusal(s, c); s.reply = { at: now, text: reason || SCOPE };
    if (reason) return null;
    const seconds = WATCH + 2 * c.plan.travelSeconds + MARGIN;
    const reserveEach = Math.ceil(seconds / 3600 * Escorts.HOURLY);
    s.quote = { at: now, expiresAt: now + 60, bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId,
      memberIds: s.members.map(m => m.actor.id), sourceId: s.source.allocationId, policy: policy(c.source),
      plan: copy(c.plan), watchSeconds: WATCH, budgetSeconds: seconds, hourly: Escorts.HOURLY,
      feeEach: Escorts.FEE, reserveEach, upfront: 2 * (Escorts.FEE + reserveEach), scope: SCOPE };
    return copy(s.quote);
  }
  function accept(s, c, expected, wallet, now) {
    const q = s?.quote;
    if (!q || refusal(s, c) || !Number.isFinite(now) || now < q.at || now >= q.expiresAt
      || JSON.stringify(expected) !== JSON.stringify(q) || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || q.tripId !== c.tripId
      || q.policy !== policy(c.source) || JSON.stringify(q.plan) !== JSON.stringify(c.plan)
      || !Number.isFinite(wallet?.money) || wallet.money < q.upfront) return false;
    wallet.money -= q.upfront;
    if (s.operation) (s.history ||= []).push(copy(s.operation));
    s.operation = { ...copy(q), id: `${s.source.allocationId}:watch-${(s.history?.length || 0) + 1}`, phase: 'outward', signedAt: now, lastAt: now,
      departBy: now + q.plan.travelSeconds, returnBy: now + q.plan.travelSeconds + WATCH,
      watchStartedAt: null, watchEndsAt: null, reason: '', earned: 0, settledAt: null };
    for (const m of s.members) {
      m.phase = 'outward'; m.lastAt = now; m.actor.needs.lastAt = now; m.actor.order = 'follow';
      m.actor.money = (m.actor.money || 0) + q.feeEach;
      m.contract = { id: `${s.operation.id}:${m.actor.id}`, status: 'active', startedAt: now,
        hourly: q.hourly, wageReserve: q.reserveEach, earned: 0, returnReason: '', bodyEpoch: q.bodyEpoch, visitId: q.visitId, tripId: q.tripId };
    }
    s.quote = null; return true;
  }
  function withdraw(s, now, reason) {
    if (!active(s) || !Number.isFinite(now) || s.operation.phase === 'returning') return false;
    s.operation.phase = 'returning'; s.operation.reason = reason;
    for (const m of s.members) if (!['returned', 'fatality'].includes(m.phase)) {
      m.phase = 'returning'; m.actor.order = 'withdraw'; m.contract.status = 'returning'; m.contract.returnReason = reason;
    }
    return true;
  }
  function authorized(s, c) {
    const o = s?.operation;
    // A personally returning original body can settle or address its own
    // people on a later visit. Old quote/transport identities remain bound at
    // acceptance; leaving for a new trip must not erase wage obligations.
    return Boolean(o && original(s) && contact(c) && o.bodyEpoch === c.bodyEpoch);
  }
  function order(s, c, order, now) {
    if (!active(s) || !authorized(s, c) || !['muster', 'hold', 'withdraw'].includes(order)) return false;
    if (order === 'withdraw') return withdraw(s, now, 'Personally ordered physical withdrawal.');
    // Accepted outward movement and the fixed watch are not extendable orders.
    if (!current(s, c) || s.operation.phase === 'returning' || order === 'hold' && !c.atRefuge) return false;
    s.operation.reason = order === 'hold' ? 'Personally confirmed the original defensive positions; no extension of the watch.' : 'Personally confirmed the original muster and accompanied route.';
    return true;
  }
  function receive(s, c, now) {
    const reporters = s?.members.filter(m => c.reporterIds ? c.reporterIds.includes(m.actor.id) : c.near);
    if (!original(s) || !reporters?.length || !contact({ ...c, near: true }) || !Number.isFinite(now)) return false;
    s.report = { at: now, partial: reporters.length !== s.members.length, phase: reporters.length === s.members.length ? s.operation?.phase || 'available' : reporters[0].phase,
      reason: reporters.length === s.members.length ? s.operation?.reason || '' : reporters[0].contract?.returnReason || '',
      members: reporters.map(m => ({ actorId: m.actor.id, name: m.actor.name, phase: m.phase, cell: copy(m.actor.mapCell),
        health: m.actor.health, needs: copy(m.actor.needs), dutySeconds: m.dutySeconds, earned: m.contract?.earned || 0,
        recovery: copy(m.recovery || null),
        observations: copy(m.actor.observed || {}) })) }; return true;
  }
  function settle(s, c, wallet, now) {
    const o = s?.operation;
    if (!o || o.phase !== 'returned' || o.settledAt != null || !authorized(s, c) || !c.atGround || !Number.isFinite(now) || !Number.isFinite(wallet?.money)) return false;
    // The run wallet stores whole marks. Pay each person's earned fraction up
    // to the next mark, like the existing caretaker settlement, so reload
    // cannot round a fractional refund into newly created player money.
    o.refund = s.members.reduce((n, m) => {
      const paid = Math.min(o.reserveEach, Math.ceil(m.contract.earned - 1e-8));
      m.actor.money = Math.round((m.actor.money + paid - m.contract.earned) * 1e8) / 1e8;
      m.contract.earned = paid; return n + o.reserveEach - paid;
    }, 0);
    o.earned = s.members.reduce((n, m) => n + m.contract.earned, 0);
    wallet.money += o.refund; o.settledAt = now; o.phase = 'completed'; return true;
  }
  // Hooks share the game's physical movement, physiology, care and combat.
  // Runtime advances in one-second steps, including when the scientist is away.
  function advance(s, now, h) {
    if (!active(s) || !h.alive || !Number.isFinite(now) || now <= s.operation.lastAt) return 0;
    const o = s.operation, dt = now - o.lastAt; o.lastAt = now;
    if (!original(s)) { o.reason = 'Original detachment identities unavailable; no substitute may work, spend wages or complete the operation.'; return 0; }
    if (!h.current() || !h.refugeValid()) withdraw(s, now, 'Original provider or refuge support lost; safe physical withdrawal only.');
    if (o.phase === 'outward' && now >= o.departBy) withdraw(s, now, 'Outward travel/wait allowance exhausted; preserve the paid return budget.');
    if (o.phase === 'watch' && now >= o.watchEndsAt) withdraw(s, now, 'The four-hour watch ended; no automatic renewal.');
    for (const m of s.members) {
      if (['returned', 'fatality'].includes(m.phase)) continue;
      const k = m.contract, a = m.actor;
      const earned = Math.min(k.wageReserve, Math.max(0, Math.min(now, a.diedAt ?? now) - k.startedAt) * k.hourly / 3600);
      a.money += Math.max(0, earned - k.earned); k.earned = earned;
      m.dutySeconds = Math.max(0, m.dutySeconds - dt);
      if (a.status === 'dead') { m.phase = 'fatality'; k.status = 'fatality'; withdraw(s, now, 'An original member died; no replacement or automatic recovery.'); continue; }
      h.physiology(m, now);
      const c = h.context(m), reason = Escorts.refusal(a, c.threatCount);
      if (reason || !c.supplied || m.dutySeconds <= o.plan.travelSeconds + MARGIN || k.earned >= k.wageReserve)
        withdraw(s, now, reason || 'Finite supplies, wages or duty require withdrawal.');
      h.defend(m, now); // Self/nearby defended people only; never a pursuit order.
      if (a.status === 'dead') continue;
      if (h.care(m, now)) continue;
      if (c.incapacitated) continue;
      if (o.phase === 'returning') {
        if (c.atHome) { m.phase = 'returned'; k.status = 'completed'; k.endedAt = now; a.order = 'hold'; }
        else if (m.dutySeconds > 0) h.move(m, m.layout.meeting, now);
      } else if (o.phase === 'outward' && c.accompanied) h.move(m, o.plan.posts[s.members.indexOf(m)], now);
    }
    if (o.phase === 'outward' && s.members.every(m => h.context(m).atPost)) {
      o.phase = 'watch'; o.watchStartedAt = now; o.watchEndsAt = Math.min(now + WATCH, o.returnBy);
      for (const m of s.members) { m.phase = 'watch'; m.actor.order = 'hold'; }
    }
    if (s.members.every(m => ['returned', 'fatality'].includes(m.phase))) o.phase = 'returned';
    o.earned = s.members.reduce((n, m) => n + m.contract.earned, 0); return 1;
  }
  return { WATCH, DUTY, MARGIN, SCOPE, source, create, active, original, current, contact, restriction, refusal, review, accept, authorized, order, receive, settle, withdraw, advance };
});
