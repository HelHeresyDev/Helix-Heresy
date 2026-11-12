(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixDuskcats = api;
})(globalThis, function () {
  'use strict';
  const distance = (a, b) => !a || !b || a.z !== b.z ? Infinity : Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const copy = x => JSON.parse(JSON.stringify(x));
  function body() {
    return { bodyKg: 2, foodKg: .1, waterL: .5, foodReceivedKg: .1, waterReceivedL: .5,
      metabolizedKg: 0, waterLostL: 0, grownKg: 0, ageHours: 0, fatigue: 0, sleeping: false,
      manaReserve: 2, manaReceived: 2, formationManaSpent: 2, manaSpent: 0, concealment: false, exposedUntil: 0,
      familiarity: 0, fear: 0, lessons: { attack: 0, recall: 0 }, cueReceipts: [], lessonReceipts: [],
      goal: null, lastSenseAt: -10, lastMoveAt: 0, recoveryUntil: 0, pendingPounce: null,
      mode: 'contained juvenile', attacks: [], carryStackId: '', lastSourceIds: [] };
  }
  function willing(a) { return a.status !== 'dead' && !a.sleeping && a.foodKg >= .025 && a.waterL >= .05 && a.health >= 35 && a.fear < 40; }
  function carrierAccessible(i, cell) {
    return Boolean(i && !i.reservedTaskId && !i.containerId && !i.fixtureId
      && (i.carriedBy === 'scientist' || !i.carriedBy && distance(i.cell, cell) <= 1));
  }
  function concealed(a, light, now, disruption = false) {
    return a.status !== 'dead' && a.formationSoul?.present !== false && !a.chamberId && !a.carryStackId && !a.sleeping && light < 35 && a.manaReserve > 0 && !disruption && now >= a.exposedUntil;
  }
  function canNotice(a, observer, env, now) {
    if (!observer.lineOfSight) return false;
    if (distance(a.mapCell, observer.cell) <= 1) return true;
    // Low-light blending defeats distant ordinary vision, not scent, hearing,
    // magical detection, contact or a body exposed by an actual attack.
    if (observer.channel && observer.channel !== 'sight') return true;
    return !concealed(a, env.light, now, env.disrupted) || distance(a.mapCell, observer.cell) <= 2;
  }
  function feed(a, kg, ids) {
    if (a.status === 'dead' || !Number.isFinite(kg) || kg <= 0 || a.foodKg + kg > .6 + 1e-8) return false;
    a.foodKg += kg; a.foodReceivedKg += kg; a.lastSourceIds = [...ids]; return true;
  }
  function water(a, litres, ids) {
    if (a.status === 'dead' || !Number.isFinite(litres) || litres <= 0 || a.waterL + litres > 1 + 1e-8) return false;
    a.waterL += litres; a.waterReceivedL += litres; a.lastSourceIds = [...ids]; return true;
  }
  function lesson(a, kind, receipt, hasWill) {
    if (!hasWill || !willing(a) || !receipt?.taskId || !receipt.heard || a.foodKg < .035) return false;
    if (kind !== 'socialize' && (a.familiarity < 3 || !['attack', 'recall'].includes(kind))) return false;
    a.foodKg -= .01; a.metabolizedKg += .01; a.fear = Math.max(0, a.fear - 5);
    if (kind === 'socialize') a.familiarity = Math.min(10, a.familiarity + 1);
    else a.lessons[kind] = Math.min(4, a.lessons[kind] + 1);
    a.lessonReceipts.push({ kind, at: receipt.at, taskId: receipt.taskId, rewardKg: .01, personId: 'scientist' });
    return true;
  }
  function cue(a, kind, target, receipt, hasWill) {
    if (!['attack', 'recall'].includes(kind) || !hasWill || !willing(a) || a.familiarity < 3 || a.lessons[kind] < 4 || !receipt?.heard || !receipt.taskId) return false;
    if (!target?.id || !target.cell || distance(a.mapCell, target.cell) > 6) return false;
    a.goal = { kind, targetId: target.id, lastSeenCell: copy(target.cell), receivedAt: receipt.at, expiresAt: receipt.at + 60, instructed: true };
    a.pendingPounce = null;
    a.cueReceipts.push({ kind, targetId: target.id, at: receipt.at, taskId: receipt.taskId, channel: 'learned audible cue and visible local demonstration' });
    return true;
  }
  function damage(a, amount, cause, at) {
    if (!a || a.status === 'dead' || !(amount > 0)) return false;
    a.health = Math.max(0, a.health - amount); a.fear = Math.min(100, a.fear + amount);
    a.injuries.push({ at, amount, cause }); a.exposedUntil = at + 15;
    if (!a.health) { a.status = 'dead'; a.diedAt = at; a.goal = null; a.pendingPounce = null; a.concealment = false; a.independentIntent = ''; }
    return true;
  }
  function step(a, env, seconds, at, h) {
    if (a.status === 'dead') return;
    const hours = seconds / 3600, will = h.hasWill(a);
    a.ageHours += hours; a.fear = Math.max(0, a.fear - hours * 2);
    const meal = Math.min(a.foodKg, hours * .012), grow = Math.min(.5 - a.grownKg, meal * .25);
    a.foodKg -= meal; a.grownKg += grow; a.bodyKg += grow; a.metabolizedKg += meal - grow;
    const water = Math.min(a.waterL, hours * .025); a.waterL -= water; a.waterLostL += water;
    if (!a.foodKg) damage(a, hours * 3, 'Feline starvation', at);
    if (!a.waterL) damage(a, hours * 6, 'Feline dehydration', at);
    if (env.temperature < 5 || env.temperature > 38) damage(a, hours * 3, 'Unsafe feline temperature', at);
    if (a.status === 'dead') return;
    // Soulless bodies have passive metabolism/fatigue, never voluntary rest,
    // feeding, learned responses, concealment or hunting.
    if (will && !a.pendingPounce && a.fatigue >= 35) { a.sleeping = true; a.goal = null; }
    if (will && a.sleeping) { a.fatigue = Math.max(0, a.fatigue - hours * 12); if (!a.fatigue) a.sleeping = false; }
    else a.fatigue = Math.min(100, a.fatigue + hours * 2);
    if (a.fatigue > 90) damage(a, hours, 'Unrelieved exhaustion', at);
    a.concealment = will && concealed(a, env.light, at, env.disrupted);
    if (a.concealment) { const mana = Math.min(a.manaReserve, hours); a.manaReserve -= mana; a.manaSpent += mana; }
    if (!will || a.chamberId || a.carryStackId || a.sleeping) {
      a.mode = !will ? 'soulless; no independent behavior' : a.sleeping ? 'sleeping' : 'contained'; a.independentIntent = ''; return;
    }
    // Attended cues arrive at their actual completion time. Catch-up substeps
    // must not execute a newly received instruction before it was demonstrated.
    if (a.goal && at < a.goal.receivedAt) return;
    if (a.goal && (at >= a.goal.expiresAt || !willing(a))) { a.goal = null; a.pendingPounce = null; }
    if (!a.goal && at - a.lastSenseAt >= 10 && willing(a) && at >= a.recoveryUntil) {
      a.lastSenseAt = at;
      const prey = h.prey(a); // Only actual directly perceived small subjects.
      if (prey) a.goal = { kind: 'attack', targetId: prey.id, lastSeenCell: copy(prey.cell), receivedAt: at, expiresAt: at + 45, instructed: false };
    }
    if (a.pendingPounce) {
      const p = a.pendingPounce;
      if (at >= p.dueAt) {
        const seen = h.perceive(a, p.targetId);
        let result = { hit: false, damage: 0, reason: 'Target moved or was lost' };
        const ambush = p.ambush && env.light < 35 && !env.disrupted;
        if (seen && distance(a.mapCell, seen.cell) <= 1 && distance(seen.cell, p.cell) === 0)
          result = h.strike(a, seen, ambush, p.sequence) || result;
        a.attacks.push({ at, targetId: p.targetId, ambush, sequence: p.sequence, ...result });
        a.pendingPounce = null; a.goal = null; a.exposedUntil = at + 15; a.concealment = false; a.recoveryUntil = at + 12;
      }
      a.mode = 'pouncing'; return;
    }
    if (a.goal) {
      const seen = h.perceive(a, a.goal.targetId);
      if (seen) a.goal.lastSeenCell = copy(seen.cell);
      if (a.goal.kind === 'recall' && distance(a.mapCell, a.goal.lastSeenCell) <= 1) { a.goal = null; a.mode = 'returned to familiar cue'; return; }
      if (a.goal.kind === 'attack' && seen && distance(a.mapCell, seen.cell) <= 1 && at >= a.recoveryUntil) {
        const ambush = a.concealment && a.manaReserve >= 1;
        if (ambush) { a.manaReserve--; a.manaSpent++; }
        a.fatigue = Math.min(100, a.fatigue + 8);
        a.pendingPounce = { targetId: seen.id, cell: copy(seen.cell), dueAt: at + 2, ambush, sequence: a.attacks.length + 1 };
        a.exposedUntil = at + 15; a.concealment = false; a.mode = 'visible pounce preparation'; return;
      }
      if (at - a.lastMoveAt >= (a.concealment ? 2 : 3)) {
        const next = h.next(a, a.goal.lastSeenCell);
        if (next && h.move(a, next)) a.lastMoveAt = at;
      }
      a.mode = a.goal.kind === 'recall' ? 'answering familiar recall' : 'stalking';
    } else a.mode = a.concealment ? 'blending into existing shade' : 'watchful';
    a.independentIntent = a.mode;
  }
  return { body, willing, carrierAccessible, concealed, canNotice, feed, water, lesson, cue, damage, step, distance };
});
