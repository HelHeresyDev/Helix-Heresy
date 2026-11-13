// Shared local food-web rules. No census input, generated kills or renewable meat.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./creature-life') : root.HelixCreatureLife);
  if (node) module.exports = api;
  root.HelixBeastPredation = api;
})(globalThis, function (Bodies, Life) {
  'use strict';
  const DAY = Life.DAY, copy = x => JSON.parse(JSON.stringify(x));
  const alive = a => a?.status !== 'dead' && a?.health > 0;
  const finite = x => Number.isFinite(x) && x >= 0;
  function sensed(a, target, ctx, dead = false) {
    if (!alive(a) || !target || (!dead && !alive(target))) return false;
    const channels = dead ? ['scent', 'sight'] : ['sight', 'hearing', 'scent', 'vibration', 'pressure'];
    return channels.some(channel => ctx.signal?.(a, target, channel) && Bodies.perceive(a, target, channel,
      { tileSizeM: ctx.tileSizeM || 1, light: ctx.lightAt?.(target.mapCell) ?? 100,
        signal: () => true }));
  }
  function hungry(a) {
    const l = a?.life, p = Life.profile(a);
    return Boolean(l && p && l.stores.foodKg < p.foodKgDay * .25
      && l.stores.fatKg < Math.max(.000001, l.fatCapacityKg * .5));
  }
  function fit(a) {
    return alive(a) && a.life?.will && a.health >= a.maxHealth * .3 && a.bodyPhysics?.stamina >= 1
      && Bodies.capable(a, a.bodyPhysics.mode) && Bodies.wounded(a, /head|torso|limb|leg|wing|fin/) < .65;
  }
  function eligible(a, target, ctx) {
    if (!fit(a) || !alive(target) || !target.bodyPhysics || a.id === target.id || a.speciesId === target.speciesId
      || ctx.canHunt?.(a) !== true || !(ctx.foodKeys?.(a) || []).includes('meatKg') || target.speciesId === 'beast:ironroot-colossus'
      || ctx.protectedTarget?.(a, target) || !sensed(a, target, ctx)) return false;
    // Heard, physically present pack members may support a hunt; no distant
    // population total, telepathy, guaranteed success or combined attack damage.
    let mass = a.bodyPhysics.massKg;
    if (['beast:rimefang-pack', 'beast:gloam-prowler'].includes(a.speciesId)) {
      for (const member of ctx.actors || []) if (member.id !== a.id && member.speciesId === a.speciesId
        && member.populationId === a.populationId && member.life?.originalGroupId === a.life.originalGroupId
        && member.life.willing !== false && hungry(member) && fit(member) && ctx.signal?.(a, member, 'hearing')
        && Bodies.perceive(a, member, 'hearing', { tileSizeM: ctx.tileSizeM || 1, signal: () => true })
        && sensed(member, target, ctx)) mass += member.bodyPhysics.massKg;
    }
    return target.bodyPhysics.massKg < mass * .5;
  }
  function finish(a, at, reason) {
    if (!a.life.hunt) return;
    a.life.hunt.endedAt = at; a.life.hunt.outcome = reason;
    a.life.huntCooldownUntil = at + 300;
    a.life.events.push({ kind: 'huntEnded', at, targetId: a.life.hunt.targetId, reason });
    if (a.life.events.length > 96) a.life.events.shift();
  }
  function huntingTarget(a, at, ctx) {
    if (!a?.life || !alive(a) || !ctx.alive || !ctx.local) return null;
    const h = a.life.hunt;
    if (h && h.endedAt == null) {
      const target = (ctx.actors || []).find(t => t.id === h.targetId);
      if (target?.status === 'dead' && sensed(a, target, ctx, true)) { finish(a, at, 'preyDead'); return null; }
      if (ctx.huntingAllowed === false || ctx.incapacitated || !fit(a) || !hungry(a) || at >= h.deadlineAt) {
        finish(a, at, ctx.huntingAllowed === false ? 'localConstraint' : !fit(a) || ctx.incapacitated ? 'unable' : !hungry(a) ? 'fed' : 'timeBudgetSpent'); return null;
      }
      if (target && eligible(a, target, ctx)) {
        h.lastSeenAt = at; h.lastCell = copy(target.mapCell); return target;
      }
      if (at - h.lastSeenAt > 12) finish(a, at, 'lostContact');
      return null;
    }
    if (ctx.huntingAllowed === false || ctx.incapacitated || !fit(a) || !hungry(a) || at < (a.life.huntCooldownUntil || 0)) return null;
    const target = (ctx.actors || []).filter(t => eligible(a, t, ctx)).sort((x, y) =>
      Math.hypot(a.mapCell.x - x.mapCell.x, a.mapCell.y - x.mapCell.y)
      - Math.hypot(a.mapCell.x - y.mapCell.x, a.mapCell.y - y.mapCell.y) || x.id.localeCompare(y.id))[0];
    if (!target) return null;
    a.life.hunt = { targetId: target.id, startedAt: at, deadlineAt: at + 300,
      lastSeenAt: at, lastCell: copy(target.mapCell) };
    a.life.events.push({ kind: 'huntStarted', at, targetId: target.id });
    if (a.life.events.length > 96) a.life.events.shift();
    return target;
  }
  function remains(a, at) {
    if (a?.status !== 'dead' || !a.life || !a.bodyPhysics) return null;
    // Preserve legacy remaining mass, never reconstruct already eaten tissue.
    const r = a.life.remains ||= { edibleKg: a.speciesId === 'beast:ironroot-colossus' ? 0 : a.bodyPhysics.massKg * .6, lastAt: at };
    r.consumedKg ??= 0; r.decomposedKg ??= 0;
    r.initialEdibleKg ??= r.edibleKg + r.consumedKg + r.decomposedKg;
    r.massKgAtDeath ??= a.bodyPhysics.massKg + r.consumedKg + r.decomposedKg;
    return r;
  }
  function decay(a, at, ctx) {
    if (ctx.alive === false || ctx.local === false) return 0;
    const r = remains(a, at); if (!r || at <= r.lastAt) return 0;
    const seconds = Math.max(0, at - Math.max(r.lastAt, r.frozenUntil || 0)); r.lastAt = at;
    const kg = r.edibleKg * -Math.expm1(-seconds / DAY * .1);
    r.edibleKg -= kg; r.decomposedKg += kg;
    Life.changeMass(a, -kg); if (kg > 0) ctx.waste?.(a, 'detritusKg', kg);
    return kg;
  }
  function carcass(a, at, ctx) {
    if (!a.life?.will || !hungry(a) || !(ctx.foodKeys?.(a) || []).some(k => ['meatKg', 'carrionKg'].includes(k))) return null;
    return (ctx.actors || []).filter(t => t.status === 'dead' && t.speciesId !== 'beast:ironroot-colossus'
      && !ctx.protectedTarget?.(a, t) && sensed(a, t, ctx, true)
      && (t.life?.remains?.edibleKg ?? t.bodyPhysics?.massKg * .6) > 1e-8).sort((x, y) =>
        Math.hypot(a.mapCell.x - x.mapCell.x, a.mapCell.y - x.mapCell.y)
        - Math.hypot(a.mapCell.x - y.mapCell.x, a.mapCell.y - y.mapCell.y) || x.id.localeCompare(y.id))[0] || null;
  }
  function validRemains(a) {
    const r = a?.life?.remains;
    return !r || a.status === 'dead' && ['edibleKg', 'lastAt'].every(k => finite(r[k]))
      && (r.initialEdibleKg == null || ['initialEdibleKg', 'consumedKg', 'decomposedKg'].every(k => finite(r[k]))
        && finite(r.massKgAtDeath) && r.initialEdibleKg <= r.massKgAtDeath + 1e-7
        && Math.abs(r.edibleKg + r.consumedKg + r.decomposedKg - r.initialEdibleKg) < Math.max(1e-7, r.initialEdibleKg * 1e-10));
  }
  function validHunt(a) {
    const h = a?.life?.hunt;
    return !h || typeof h.targetId === 'string' && ['startedAt', 'deadlineAt', 'lastSeenAt'].every(k => finite(h[k]))
      && h.deadlineAt > h.startedAt && h.lastSeenAt >= h.startedAt && h.lastSeenAt <= h.deadlineAt
      && h.lastCell && ['x', 'y', 'z'].every(k => Number.isInteger(h.lastCell[k]))
      && (h.endedAt == null || finite(h.endedAt) && h.endedAt >= h.startedAt && typeof h.outcome === 'string');
  }
  return { sensed, hungry, eligible, huntingTarget, remains, decay, carcass, validRemains, validHunt };
});
