(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldEmployeeRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const SECONDS = 8 * 3600, DUTY = 8 * 3600;
  const copy = x => JSON.parse(JSON.stringify(x));
  const active = s => ['resting', 'paused'].includes(s?.recovery?.status);
  const contact = c => c.alive && c.capable && c.originalBody && c.originalTrip && !c.custody && c.near && c.atGround && !c.busy;
  const owned = (s, stacks, key) => stacks.filter(i => i.section === 'inventory' && i.key === key && i.carriedBy === s.actor.id
    && !i.reservedTaskId && !i.cityOwnerId && !i.civicCustody && !i.containerId && !i.chemicalBatch
    && !(i.tags || []).some(t => /toxic|hazard|contaminat|volatile/i.test(t)) && i.quantity >= 1);
  function reason(s, c) {
    const keys = s?.role === 'builder' ? ['providerId'] : ['branchId', 'networkId'];
    if (!s?.source || !c.source || !['cityId', 'populationId', 'allocationId', ...keys].every(k => s.source[k] === c.source[k]))
      return 'The original population-backed provider no longer supports this worker.';
    const policy = c.source.restrictions?.find(r => r.refusesDeclaredOpposition || (s.role === 'builder'
      ? r.forbidsPrivateConstruction || r.forbidsWildernessWork : r.forbidsHauling));
    if (policy) return policy.text || 'The original provider refuses this arrangement.';
    if (s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || s.actor.health <= 10 || c.incapacitated)
      return 'The same living capable worker must be able to rest without clinical assistance.';
    if (['arriving', 'onSite', 'returning', 'awaitingSettlement'].includes(s.phase) || s.job?.status === 'working' || c.care || c.treatment)
      return 'Finish work, physical return, settlement, tool handback and care before resting.';
    const p = s.restPlace;
    if (!p || p.actorId !== s.actor.id || !c.placeUsable || active(s) && (s.recovery.actorId !== s.actor.id || s.recovery.placeId !== p.id
      || s.recovery.stackId !== p.stackId)) return 'The inspected original one-person shelter must remain usable; no substitute is supplied.';
    if (!c.atRestPlace || c.threatened) return 'Remain at the defended sheltered rest place without fighting.';
    return '';
  }
  function startReason(s, c, stacks) {
    if (!contact(c)) return 'Personally meet the worker on the original defended ground, free and capable.';
    const blocked = reason(s, c); if (blocked) return blocked;
    if (active(s)) return 'The original off-duty period is already in progress.';
    if (s.phase !== 'completed' || s.contract?.settledAt == null || s.contract.actorId !== s.actor.id || s.contract.bodyEpoch !== c.bodyEpoch || !c.toolsReturned)
      return 'Physically return, hand back borrowed tools and settle the original agreement first.';
    if (owned(s, stacks, 'drinkingWater').reduce((n, i) => n + i.quantity, 0) < 2 || !owned(s, stacks, 'trailMeal').length)
      return 'Personally supply two actual drinking-water units and one trail meal in this worker’s kit.';
    return '';
  }
  function consume(s, stacks, key, at) {
    const i = owned(s, stacks, key)[0]; if (!i) return false;
    i.quantity--; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity);
    s.actor.needs = Survival.consume(s.actor.needs, key);
    s.recovery.consumed.push({ stackId: i.id, key, quantity: 1, at }); return true;
  }
  function begin(s, c, stacks, now) {
    if (!Number.isFinite(now) || now < s?.actor?.needs?.lastAt || startReason(s, c, stacks)) return false;
    if (s.recovery) (s.recoveryHistory ||= []).push(copy(s.recovery));
    s.recovery = { id: `${s.actor.id}:rest-${(s.recoveryHistory?.length || 0) + 1}`, actorId: s.actor.id, placeId: s.restPlace.id,
      stackId: s.restPlace.stackId, startedAt: now, lastAt: now, progressSeconds: 0, status: 'resting', reason: '', consumed: [] };
    s.quote = null; s.actor.order = 'hold'; s.actor.needs.lastAt = now;
    consume(s, stacks, 'drinkingWater', now); consume(s, stacks, 'trailMeal', now); return true;
  }
  function advance(s, c, stacks, now) {
    if (!active(s) || !c.alive || s.actor.status === 'dead' || !Number.isFinite(now) || now < s.recovery.lastAt) return { changed: false, damage: 0 };
    const r = s.recovery, stop = reason(s, c), seconds = Math.floor(now - r.lastAt);
    let damage = 0;
    for (let n = 0; n < seconds; n++) {
      const at = r.lastAt + 1;
      const needs = Survival.advance(s.actor.needs, at, { resting: c.atRestPlace && !c.threatened, sheltered: c.placeUsable });
      s.actor.needs = needs.state; damage += needs.damage; r.lastAt = at;
      let blocked = stop || (s.actor.health - damage <= 10 ? 'Ordinary physiological harm prevents supported rest.' : '');
      if (!blocked && s.actor.needs.thirst >= 70 && !consume(s, stacks, 'drinkingWater', at)) blocked = 'Actual drinking water is missing; no progress is backfilled.';
      if (!blocked && s.actor.needs.hunger >= 85 && !consume(s, stacks, 'trailMeal', at)) blocked = 'An actual trail meal is missing; no progress is backfilled.';
      r.reason = blocked; r.status = blocked ? 'paused' : 'resting';
      if (!blocked) r.progressSeconds++;
      if (r.progressSeconds >= SECONDS) {
        r.progressSeconds = SECONDS; r.status = 'completed'; r.completedAt = at;
        s.dutySeconds = DUTY; s.lastAt = at; break;
      }
    }
    return { changed: seconds > 0, damage };
  }
  function end(s, c, now) {
    if (!active(s) || !contact(c) || !Number.isFinite(now) || now < s.recovery.lastAt) return false;
    s.recovery.status = 'ended'; s.recovery.endedAt = now;
    s.recovery.reason = 'Ended early: spent supplies and effort remain spent, with no duty restored.'; s.quote = null; return true;
  }
  function observe(s, c, now) {
    if (!contact(c) || c.incapacitated || s.actor.status === 'dead' || !Number.isFinite(now)) return false;
    s.recoveryReport = { at: now, actorId: s.actor.id, dutySeconds: s.dutySeconds, restPlace: copy(s.restPlace || null),
      recovery: copy(s.recovery || null), needs: copy(s.actor.needs) }; return copy(s.recoveryReport);
  }
  return { SECONDS, DUTY, active, contact, reason, startReason, begin, advance, end, observe };
});
