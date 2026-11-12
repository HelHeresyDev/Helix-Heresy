(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLanternWisps = api;
})(globalThis, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const distance = (a, b) => !a || !b || a.z !== b.z ? Infinity : Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  function body() { return { bodyKg: .1, brokenKg: 0, manaReserve: 2, manaReceived: 2, manaSpent: 0, formationManaSpent: 2,
    emission: 'bright', starvationHours: 0, fear: 0, familiarity: 0, lessons: { follow: 0, stay: 0 },
    lessonReceipts: [], cueReceipts: [], feedReceipts: [], moves: [], goal: null, lastMoveAt: 0, carryStackId: '', shutterClosed: false,
    mode: 'contained luminous core' }; }
  function willing(a, disrupted = false) { return a.status !== 'dead' && a.health >= 35 && a.manaReserve >= .5 && a.fear < 40 && !disrupted; }
  function light(a) { return a.status === 'dead' || a.shutterClosed || a.chamberId || a.manaReserve <= 0 ? 0 : a.emission === 'dim' ? 20 : 60; }
  function recharge(a, receipt) {
    if (a.status === 'dead' || a.manaReserve > 8 + 1e-8 || !receipt?.sourceIds?.length) return false;
    a.manaReserve += 8; a.manaReceived += 8; a.feedReceipts.push(copy(receipt)); return true;
  }
  function lesson(a, kind, receipt, hasWill) {
    if (!hasWill || !willing(a) || !receipt?.taskId || !receipt.heard || a.manaReserve < .55) return false;
    if (kind !== 'familiarity' && (a.familiarity < 3 || !['follow', 'stay'].includes(kind))) return false;
    a.manaReserve -= .05; a.manaSpent += .05;
    if (kind === 'familiarity') a.familiarity = Math.min(6, a.familiarity + 1);
    else a.lessons[kind] = Math.min(3, a.lessons[kind] + 1);
    a.lessonReceipts.push({ kind, taskId: receipt.taskId, at: receipt.at, rewardMana: .05 }); return true;
  }
  function cue(a, kind, teacher, receipt, hasWill) {
    if (!hasWill || !willing(a) || !['follow', 'stay'].includes(kind) || a.lessons[kind] < 3 || a.familiarity < 3
      || !receipt?.taskId || !receipt.heard || !teacher?.cell || !teacher.lineOfSight || distance(a.mapCell, teacher.cell) > 6 || a.chamberId || a.carryStackId) return false;
    a.goal = { kind, teacherId: 'scientist', lastSeenCell: copy(teacher.cell), receivedAt: receipt.at,
      lastSeenAt: receipt.at, expiresAt: receipt.at + 300 };
    a.cueReceipts.push({ kind, at: receipt.at, taskId: receipt.taskId, channel: 'learned local audible/visual signal' }); return true;
  }
  function damage(a, amount, cause, at, fracture = true) {
    if (!a || a.status === 'dead' || !(amount > 0)) return false;
    const used = Math.min(a.health, amount * (fracture ? 3 : 1)); a.health -= used; a.fear = Math.min(100, a.fear + used);
    if (fracture) { const kg = Math.min(a.bodyKg, used * .001); a.bodyKg -= kg; a.brokenKg += kg; }
    const last = a.injuries.at(-1);
    if (last?.cause === cause) last.amount += used; else a.injuries.push({ at, cause, amount: used });
    if (!a.health) { a.status = 'dead'; a.diedAt = at; a.goal = null; a.independentIntent = ''; a.emission = 'extinct'; }
    return true;
  }
  function step(a, env, seconds, at, h) {
    if (a.status === 'dead') return;
    const hours = seconds / 3600, will = h.hasWill(a);
    a.fear = Math.max(0, a.fear - hours * 2);
    // Dimness is a voluntary conservation response. A shutter only hides light;
    // it neither orders a soulless body nor suppresses its internal expenditure.
    a.emission = will && a.manaReserve <= 2 ? 'dim' : 'bright';
    const rate = a.emission === 'dim' ? .5 : 2, used = Math.min(a.manaReserve, hours * rate);
    a.manaReserve -= used; a.manaSpent += used;
    const starved = Math.max(0, hours - used / rate);
    if (starved) { a.starvationHours += starved; damage(a, starved * 10, 'Luminous coherence starvation', at, false); }
    if (env.disrupted) damage(a, hours * 10, 'Disruptive ambient mana', at, false);
    if (env.temperature < -20 || env.temperature > 80) damage(a, hours * 10, 'Unsafe core temperature', at, false);
    if (a.status === 'dead') return;
    if (!will || !willing(a, env.disrupted) || a.chamberId || a.carryStackId) {
      a.goal = null; a.independentIntent = ''; a.mode = !will ? 'soulless; passive emission only' : a.carryStackId || a.chamberId ? 'physically enclosed' : 'unwilling or depleted'; return;
    }
    if (!a.goal || at < a.goal.receivedAt) { a.mode = 'watchful low hover'; a.independentIntent = ''; return; }
    if (at >= a.goal.expiresAt) { a.goal = null; a.mode = 'signal expired; hovering'; a.independentIntent = ''; return; }
    if (a.goal.kind === 'stay') { a.mode = 'answering learned stay'; a.independentIntent = a.mode; return; }
    const teacher = h.teacher(a);
    if (teacher?.lineOfSight && distance(a.mapCell, teacher.cell) <= 6) { a.goal.lastSeenCell = copy(teacher.cell); a.goal.lastSeenAt = at; }
    if (at - a.goal.lastSeenAt > 15) { a.goal = null; a.mode = 'familiar feeder lost; hovering'; a.independentIntent = ''; return; }
    if (distance(a.mapCell, a.goal.lastSeenCell) > 1 && at - a.lastMoveAt >= 2) {
      const next = h.next(a, a.goal.lastSeenCell);
      if (next && distance(a.mapCell, next) === 1 && h.move(a, next)) {
        a.mapCell = copy(next); a.lastMoveAt = at; a.moves.push({ at, cell: copy(next) }); a.moves = a.moves.slice(-12);
      }
    }
    a.mode = 'answering learned follow'; a.independentIntent = a.mode;
  }
  function shield(housing, amount) {
    const absorbed = Math.min(amount, Math.max(0, housing.condition) / 4);
    housing.condition = Math.max(0, housing.condition - absorbed * 4); return amount - absorbed;
  }
  return { body, distance, willing, light, recharge, lesson, cue, damage, shield, step };
});
