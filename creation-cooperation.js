(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCreationCooperation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEP = 10, REST = 3600, LESSON = 600;
  const copy = x => JSON.parse(JSON.stringify(x));
  const eligible = a => Boolean(a && !a.genome && a.family === 'homunculus' && a.actorKind === 'homunculus'
    && a.status !== 'dead' && a.status !== 'developing' && a.maturity >= 1 && !a.chamberId);
  function create(now = 0) { return { lastAt: now, nextId: 1, lessons: [], orders: [], learning: {}, relationships: {}, knowledge: {} }; }
  function normalize(s, now = 0) { return s?.lessons && s?.orders ? copy(s) : create(now); }
  function signature(p) { return JSON.stringify([p.roomId, p.source, p.destination, p.route, 'drinkingWater', 2, 'trailMeal', 1, 'drinkingWater', 1]); }
  function willing(a) { return eligible(a) && a.health >= 75 && a.foodHours >= 6 && a.waterHours >= 6 && a.fatigue < 20 && a.stress < 30; }
  function busy(s, id) { return s.lessons.some(l => l.actorId === id && l.status === 'active') || s.orders.some(o => o.actorId === id && ['active', 'paused', 'awaitingReward'].includes(o.status)); }
  function readiness(s, a, contact, now) {
    if (!eligible(a) || !contact?.understood) return 'A stabilized non-slime individual with demonstrated continue/stop understanding is required.';
    const r = s.relationships[a.id] ||= { brokenPromises: [], restUntil: 0 };
    if (!willing(a)) { if (r.restUntil <= now) r.restUntil = now + REST; return 'The individual declines; attend to actual health, needs, fatigue and stress.'; }
    if (now < r.restUntil || contact.restUntil > now || contact.lastSessionAt != null && now - contact.lastSessionAt < REST)
      return 'Allow genuine recovery after the previous interaction; repetition cannot manufacture agreement.';
    if (r.brokenPromises.length) return 'A remembered unpaid or broken promise prevents another arrangement; honor the original obligation first.';
    return '';
  }
  function lesson(s, a, kind, p, contact, now, reserve) {
    const reason = readiness(s, a, contact, now);
    if (reason || busy(s, a.id) || !p?.ok || !['demonstrate', 'check'].includes(kind)) return { ok: false, reason: reason || p?.reason || 'Finish the existing arrangement first.' };
    const key = signature(p), learned = s.learning[a.id];
    if (kind === 'check' && (!learned || learned.signature !== key || !learned.demonstrated)) return { ok: false, reason: 'Physically demonstrate this exact route and two-portion task first.' };
    const id = `creation-lesson-${s.nextId}`, stocks = reserve(id, p, false);
    if (!stocks) return { ok: false, reason: 'The original practice water is unavailable.' };
    const l = { id, actorId: a.id, kind, plan: copy(p), stocks: copy(stocks), status: 'active', stage: 'pickup', carriedStackId: '',
      startedAt: now, elapsed: 0, returned: false, reason: '', taskId: '', signature: key };
    s.nextId++; s.lessons.push(l); return { ok: true, lesson: l };
  }
  function propose(s, a, p, contact, now, reserve) {
    const reason = readiness(s, a, contact, now), learned = a && s.learning[a.id];
    if (reason || busy(s, a?.id) || !p?.ok || learned?.signature !== signature(p) || learned.checks < 2)
      return { ok: false, reason: reason || p?.reason || 'The individual has not demonstrated understanding of these exact task terms.' };
    const id = `creation-delivery-${s.nextId}`, stocks = reserve(id, p, true);
    if (!stocks) return { ok: false, reason: 'The actual original cargo and promised meal/water could not all be reserved.' };
    const o = { id, actorId: a.id, plan: copy(p), stocks: copy(stocks), status: 'active', stage: 'pickup', amount: 2, delivered: 0,
      carriedStackId: '', startedAt: now, finishedAt: null, worked: false, paid: false, broken: false, reason: '' };
    s.nextId++; s.orders.push(o); a.agreement = { id, kind: 'one-delivery', amount: 2, key: 'drinkingWater' };
    contact.lastSessionAt = now; a.fatigue = Math.min(100, a.fatigue + 2);
    return { ok: true, order: o };
  }
  function broken(s, o, now, reason) {
    if (o.paid || o.broken) return;
    o.broken = true; o.brokenAt = now; o.reason = reason;
    const r = s.relationships[o.actorId] ||= { brokenPromises: [], restUntil: 0 };
    r.brokenPromises.push(o.id);
  }
  function advance(s, now, hooks) {
    if (hooks.dead) return 0;
    if (!s.lessons.some(l => l.status === 'active') && !s.orders.some(o => !o.paid && (o.status !== 'cancelled' || o.worked) && ['active', 'paused', 'awaitingReward', 'cancelled'].includes(o.status))) {
      s.lastAt += Math.floor(Math.max(0, now - s.lastAt) / STEP) * STEP; return 0;
    }
    let changes = 0;
    while (s.lastAt + STEP <= now) {
      s.lastAt += STEP; const at = s.lastAt;
      for (const l of s.lessons.filter(l => l.status === 'active')) {
        if (at <= l.startedAt) continue;
        const a = hooks.actor(l.actorId);
        if (!willing(a) || !hooks.witness(l)) { l.status = 'interrupted'; l.reason = 'The lesson lost its actual witness, safe channel or willing participant.'; hooks.release(l); changes++; continue; }
        const step = l.returned ? { done: true } : hooks.step(l, l.kind === 'demonstrate' ? 'scientist' : a.id, true, STEP);
        if (step.reason) { l.status = 'interrupted'; l.reason = step.reason; hooks.release(l); }
        else {
          l.elapsed += STEP; if (step.done) l.returned = true;
          if (l.returned && l.elapsed >= LESSON) {
            l.status = 'completed'; l.finishedAt = at; hooks.release(l);
            let learned = s.learning[a.id];
            if (!learned || learned.signature !== l.signature) learned = s.learning[a.id] = { signature: l.signature, demonstrated: false, checks: 0 };
            if (l.kind === 'demonstrate') learned.demonstrated = true;
            else { learned.checks = Math.min(2, learned.checks + 1); a.skills.handling = (a.skills.handling || 0) + 1; }
            s.relationships[a.id] ||= { brokenPromises: [], restUntil: 0 }; s.relationships[a.id].restUntil = at + REST;
          }
        }
        changes++;
      }
      for (const o of s.orders.filter(o => ['active', 'paused', 'awaitingReward', 'cancelled'].includes(o.status) && !o.paid && (o.status !== 'cancelled' || o.worked))) {
        if (at <= o.startedAt) continue;
        const a = hooks.actor(o.actorId);
        if (!hooks.rewardIntact(o)) {
          broken(s, o, at, 'The original promised reward disappeared or changed custody; no replacement is invented.');
          if (o.status === 'active') { o.status = 'paused'; if (a?.agreement?.id === o.id) a.agreement = null; changes++; }
        }
        if (o.status !== 'active') continue;
        if (!willing(a) || hooks.danger(a)) {
          o.status = a?.status === 'dead' ? 'fatality' : 'paused'; o.reason = 'Pain, needs, fatigue, stress or danger ended this delivery. Actual cargo stays in custody.';
          if (a?.agreement?.id === o.id) a.agreement = null;
          changes++; continue;
        }
        const step = hooks.step(o, a.id, false, STEP);
        if (step.reason) { o.status = 'paused'; o.reason = step.reason; a.agreement = null; }
        else if (step.done) { o.status = 'awaitingReward'; o.finishedAt = at; a.agreement = null; }
        changes++;
      }
    }
    return changes;
  }
  function cancel(s, r, a, now, release) {
    if (!r || !['active', 'paused', 'awaitingReward'].includes(r.status)) return false;
    r.status = 'cancelled'; r.finishedAt = now; r.reason = 'Agreement ended locally. Existing deliveries and physical custody remain; a started delivery retains its reward obligation.';
    if (a?.agreement?.id === r.id) a.agreement = null;
    if (r.worked && !r.paid) broken(s, r, now, 'The started agreement ended without its promised reward. Honor the original obligation before new work.');
    release(r, Boolean(r.worked)); return true;
  }
  function resume(s, o, a, contact, now, valid) {
    const reason = readiness(s, a, contact, now);
    if (reason || o?.status !== 'paused' || !valid(o)) return { ok: false, reason: reason || 'The original route and exact remaining cargo are not physically supportable.' };
    o.status = 'active'; o.reason = ''; a.agreement = { id: o.id, kind: 'one-delivery', amount: 2, key: 'drinkingWater' }; contact.lastSessionAt = now;
    return { ok: true };
  }
  function pay(s, o, a, now, consume) {
    if (!o || o.paid || !eligible(a) || !(o.status === 'awaitingReward' || o.status === 'cancelled' && o.worked) || !consume(o, a)) return false;
    const cancelled = o.status === 'cancelled';
    o.paid = true; o.paidAt = now; o.status = cancelled ? 'settled' : 'completed'; o.reason = cancelled
      ? 'The actual promised meal and water settled the ended arrangement; partial delivery is not full completion.' : 'The actual promised meal and water were received.';
    a.foodHours += 24; a.waterHours += 24;
    const r = s.relationships[a.id]; if (r) r.brokenPromises = r.brokenPromises.filter(id => id !== o.id);
    return true;
  }
  function observe(s, a, now) {
    const orders = s.orders.filter(o => o.actorId === a.id).map(o => ({ id: o.id, amount: o.amount, delivered: o.delivered,
      status: o.status, paid: o.paid, reason: o.reason, source: copy(o.plan.source), destination: copy(o.plan.destination) }));
    const learning = s.learning[a.id];
    return s.knowledge[a.id] = { at: now, name: a.name, actorId: a.id, understanding: learning?.checks >= 2 ? 'Two unguided carrying checks observed' : learning?.demonstrated ? 'Demonstration observed; checks still needed' : 'No carrying understanding demonstrated', orders };
  }
  return { STEP, REST, LESSON, eligible, willing, create, normalize, signature, readiness, lesson, propose, advance, cancel, resume, pay, observe };
});
