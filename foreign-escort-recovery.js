(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./foreign-expedition-escort') : root.HelixForeignExpeditionEscort,
    node ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (node) module.exports = api;
  if (root) root.HelixForeignEscortRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Foreign, Survival) {
  'use strict';
  const SECONDS = 8 * 3600, DUTY = 12 * 3600;
  const copy = x => JSON.parse(JSON.stringify(x));
  const active = s => ['resting', 'paused'].includes(s?.recovery?.status);
  const owned = (s, stacks, key) => stacks.filter(i => i.section === 'inventory' && i.key === key
    && i.carriedBy === s.actor.id && !i.reservedTaskId && i.quantity >= 1);
  function reason(s, c) {
    if (!s?.source || !Foreign.current(s, c)) return 'The original local chapter no longer supports this rest place.';
    if (!c.placeUsable) return 'The original chapter shelter must remain physically deployed and usable.';
    if (!s.restPlace || s.restPlace.actorId !== s.actor.id || active(s)
      && (s.recovery.actorId !== s.actor.id || s.recovery.placeId !== s.restPlace.id)) return 'The original professional and resting place cannot be replaced.';
    if (Foreign.active(s) || s.drag || s.actor.care || c.careActive) return 'Finish protection, casualty assistance and care before resting.';
    if (s.actor.id !== s.source.allocationId || s.actor.status === 'dead' || s.actor.health <= 10 || c.escortIncapacitated)
      return 'The same living capable professional must be able to rest without clinical assistance.';
    if (!c.atRestPlace || c.threatened) return 'The professional must remain at the sheltered defended resting place without fighting.';
    return '';
  }
  function startReason(s, c, stacks) {
    const contact = Foreign.contactReason(s, c) || reason(s, c);
    if (contact) return contact;
    if (active(s)) return 'The original off-duty period is already in progress.';
    if (s.contract?.status !== 'completed') return 'Physically finish and settle the original contract first.';
    if (!Foreign.decision(s, c).accepted) return Foreign.decision(s, c).reason;
    if (owned(s, stacks, 'drinkingWater').reduce((n, i) => n + i.quantity, 0) < 2
      || !owned(s, stacks, 'trailMeal').length) return 'Stage two actual drinking-water units and one trail meal in the professional’s kit.';
    return '';
  }
  function consume(s, stacks, key, at) {
    const stack = owned(s, stacks, key)[0]; if (!stack) return false;
    stack.quantity--; stack.knownQuantity = Math.min(stack.knownQuantity, stack.quantity);
    s.actor.needs = Survival.consume(s.actor.needs, key);
    s.recovery.consumed.push({ stackId: stack.id, key, quantity: 1, at });
    return true;
  }
  function begin(s, c, stacks, now) {
    if (!Number.isFinite(now) || now < s?.actor?.needs?.lastAt || startReason(s, c, stacks)) return false;
    if (s.recovery) (s.recoveryHistory ||= []).push(copy(s.recovery));
    s.recovery = { id: `${s.actor.id}:rest-${(s.recoveryHistory?.length || 0) + 1}`, actorId: s.actor.id,
      placeId: s.restPlace.id, startedAt: now, lastAt: now, progressSeconds: 0, status: 'resting', reason: '', consumed: [], completedAt: null };
    s.quote = null; s.actor.order = 'hold'; s.actor.needs.lastAt = now;
    // Actual provisions are consumed, not supplied by the chapter or a payment.
    consume(s, stacks, 'drinkingWater', now); consume(s, stacks, 'trailMeal', now);
    return true;
  }
  function advance(s, c, stacks, now) {
    if (!active(s) || !c.alive || !Number.isFinite(now) || now < s.recovery.lastAt) return { changed: false, damage: 0 };
    const r = s.recovery, stop = reason(s, c), seconds = Math.floor(now - r.lastAt);
    let damage = 0;
    for (let n = 0; n < seconds; n++) {
      const at = r.lastAt + 1;
      const needs = Survival.advance(s.actor.needs, at, { resting: c.atRestPlace && !c.threatened, sheltered: c.placeUsable });
      s.actor.needs = needs.state; damage += needs.damage; r.lastAt = at;
      let blocked = stop || (s.actor.health - damage <= 10 ? 'Ordinary physiological harm prevents supported rest.' : '');
      if (!blocked && s.actor.needs.thirst >= 70 && !consume(s, stacks, 'drinkingWater', at)) blocked = 'Actual drinking water is needed; progress is held, not backfilled.';
      if (!blocked && s.actor.needs.hunger >= 85 && !consume(s, stacks, 'trailMeal', at)) blocked = 'An actual trail meal is needed; progress is held, not backfilled.';
      r.reason = blocked; r.status = blocked ? 'paused' : 'resting';
      if (!blocked) r.progressSeconds++;
      if (r.progressSeconds >= SECONDS) {
        r.progressSeconds = SECONDS; r.status = 'completed'; r.completedAt = at;
        s.dutySeconds = DUTY; s.lastAt = at;
        break; // No post-completion catch-up, additional duty, healing or equipment repair.
      }
    }
    return { changed: seconds > 0, damage };
  }
  function end(s, c, now) {
    if (!active(s) || !Number.isFinite(now) || now < s.recovery.lastAt || Foreign.contactReason(s, c)) return false;
    s.recovery.status = 'ended'; s.recovery.endedAt = now;
    s.recovery.reason = 'Off-duty period ended early; spent provisions and elapsed effort remain spent, with no duty restored.';
    s.quote = null; return true;
  }
  function observe(s, at) {
    s.recoveryReport = { at, actorId: s.actor.id, placeId: s.restPlace.id, dutySeconds: s.dutySeconds,
      recovery: copy(s.recovery || null), needs: copy(s.actor.needs) };
    return copy(s.recoveryReport);
  }
  return { SECONDS, DUTY, active, reason, startReason, begin, advance, end, observe };
});
