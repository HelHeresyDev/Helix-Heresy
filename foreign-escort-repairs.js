(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./foreign-expedition-escort') : root.HelixForeignExpeditionEscort,
    node ? require('./foreign-escort-recovery') : root.HelixForeignEscortRecovery);
  if (node) module.exports = api;
  if (root) root.HelixForeignEscortRepairs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Foreign, Recovery) {
  'use strict';
  const SECONDS = 1800, GAIN = 25, WEAR = 6;
  const RECIPES = Object.freeze({ escortBaton: Object.freeze({ metalParts: 1 }), escortVest: Object.freeze({ metalParts: 1, rubber: 1 }) });
  const copy = x => JSON.parse(JSON.stringify(x));
  const active = s => ['working', 'held'].includes(s?.repair?.status);
  function contactReason(s, c) {
    const reason = Foreign.contactReason(s, c);
    if (reason) return reason;
    if (!s.restPlace || s.restPlace.actorId !== s.actor.id || s.restPlace.branchId !== s.source.branchId || !c.placeUsable || !c.atRestPlace) return 'Meet the original professional at their actual usable chapter shelter.';
    if (Foreign.active(s) || Recovery.active(s) || s.drag || s.actor.care || c.careActive || c.threatened)
      return 'Finish protection, recovery, casualty assistance, medical work and fighting first.';
    if (s.contract?.status !== 'completed') return 'Return and personally settle protection before requesting equipment work.';
    return '';
  }
  const owned = i => i.carriedBy === 'scientist' && !i.cityOwnerId && !i.civicCustody;
  function plan(s, c, stacks, tool, gearId, now) {
    if (!Number.isFinite(now) || contactReason(s, c) || active(s) || !Foreign.decision(s, c).accepted) return null;
    const gear = stacks.find(i => i.id === gearId), condition = s.gearCondition[gearId];
    if (!gear || !RECIPES[gear.key] || gear.section !== 'inventory' || gear.carriedBy !== s.actor.id || gear.quantity !== 1
      || gear.cityOwnerId || gear.civicCustody || gear.reservedTaskId || !Number.isFinite(condition) || condition < 0 || condition >= 100) return null;
    const hammer = stacks.find(i => i.toolInstanceId === tool?.id && i.key === 'masonryHammer' && i.section === 'inventory'
      && owned(i) && i.quantity === 1 && !i.reservedTaskId);
    if (!hammer || !tool || tool.carriedBy !== 'scientist' || tool.current <= 0 || !Number.isFinite(tool.current) || tool.reservedTaskId
      || !Number.isFinite(c.seconds) || c.seconds < 1 || !Number.isFinite(c.staminaCost) || c.staminaCost < 0 || !Number.isFinite(c.stamina) || c.stamina < c.staminaCost) return null;
    const inputs = [];
    for (const [key, quantity] of Object.entries(RECIPES[gear.key])) {
      const item = stacks.filter(i => i.section === 'resources' && i.key === key && owned(i) && !i.reservedTaskId && i.quantity >= quantity)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!item) return null;
      inputs.push({ stackId: item.id, section: item.section, key, quantity, unitMassKg: item.unitMassKg, unitVolumeL: item.unitVolumeL });
    }
    return { actorId: s.actor.id, branchId: s.source.branchId, placeId: s.restPlace.id, gearId, gearKey: gear.key, condition,
      gain: Math.min(GAIN, 100 - condition), toolId: tool.id, toolStackId: hammer.id, inputs, requiredSeconds: c.seconds,
      staminaCost: c.staminaCost, bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId,
      roomId: c.roomId, cell: copy(c.cell), at: now };
  }
  function begin(s, c, stacks, tool, expected, taskId, now) {
    if (!expected || !taskId) return false;
    const actual = plan(s, c, stacks, tool, expected.gearId, now);
    if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) return false;
    if (s.repair) (s.repairHistory ||= []).push(copy(s.repair));
    s.repair = { ...copy(actual), taskId, consent: { at: now, actorId: s.actor.id, gearId: actual.gearId,
      scope: 'Scientist-performed repair of this one original professional-owned item only; no ownership, employment, healing, duty recovery, transport or allegiance.' },
      status: 'working', progressSeconds: 0, lastAt: now, ready: true, wearApplied: 0, reason: '', receipt: null };
    s.quote = null; return true;
  }
  function reason(s, c, stacks, tool) {
    if (!active(s)) return 'No unfinished original equipment repair.';
    const j = s.repair, contact = contactReason(s, c);
    if (contact) return contact;
    if (c.bodyEpoch !== j.bodyEpoch || c.visitId !== j.visitId || c.tripId !== j.tripId || s.actor.id !== j.actorId
      || s.source.branchId !== j.branchId || s.restPlace.id !== j.placeId) return 'Only the original body, visit, trip, professional and chapter place may continue this work.';
    if (c.roomId !== j.roomId || JSON.stringify(c.cell) !== JSON.stringify(j.cell)) return 'Return to the original physical work position; no remote work or backfill.';
    const gear = stacks.find(i => i.id === j.gearId), hammer = stacks.find(i => i.id === j.toolStackId);
    if (!gear || gear.section !== 'inventory' || gear.key !== j.gearKey || gear.quantity !== 1 || gear.carriedBy !== j.actorId
      || gear.cityOwnerId || gear.civicCustody || gear.reservedTaskId !== j.taskId || s.gearCondition[j.gearId] !== j.condition) return 'The exact reserved original gear, owner and unchanged wear must remain available.';
    const lastStroke = j.toolSpentAtCompletion && j.progressSeconds >= j.requiredSeconds && tool?.current === 0;
    if (!tool || tool.id !== j.toolId || tool.carriedBy !== 'scientist' || !Number.isFinite(tool.current) || tool.current < 0 || tool.current === 0 && !lastStroke || tool.reservedTaskId !== j.taskId
      || !hammer || hammer.section !== 'inventory' || hammer.key !== 'masonryHammer' || hammer.quantity !== 1 || hammer.toolInstanceId !== j.toolId
      || !owned(hammer) || hammer.reservedTaskId !== j.taskId) return 'The original reserved carried hammer must remain usable; cancel to release exhausted tools.';
    for (const input of j.inputs) {
      const item = stacks.find(i => i.id === input.stackId);
      if (!item || item.section !== input.section || item.key !== input.key || item.quantity !== input.quantity || !owned(item)
        || item.reservedTaskId !== j.taskId || item.unitMassKg !== input.unitMassKg || item.unitVolumeL !== input.unitVolumeL)
        return 'The exact reserved physically carried owned component portions are required; no remote or replacement stock.';
    }
    return '';
  }
  function advance(s, c, stacks, tool, now) {
    if (!active(s) || !c.alive || !Number.isFinite(now) || now < s.repair.lastAt) return 0;
    const j = s.repair, elapsed = now - j.lastAt; j.lastAt = now;
    const blocked = reason(s, c, stacks, tool) || (!c.atHead ? 'Other work has the scientist’s physical attention.' : '');
    if (blocked) { j.status = 'held'; j.reason = blocked; j.ready = false; return 0; }
    j.status = 'working'; j.reason = '';
    if (!j.ready) { j.ready = true; return 0; }
    // A coarse simulation step cannot spend more work than the original
    // hammer's remaining wear budget supports before it breaks.
    const supported = Math.min(j.requiredSeconds, (j.wearApplied + tool.current) * j.requiredSeconds / WEAR);
    const added = Math.max(0, Math.min(elapsed, supported - j.progressSeconds)); j.progressSeconds += added;
    const wear = Math.min(WEAR, Math.floor(WEAR * j.progressSeconds / j.requiredSeconds + 1e-9));
    const spent = wear - j.wearApplied;
    tool.current = Math.max(0, tool.current - spent); j.wearApplied = wear;
    if (spent > 0 && tool.current === 0 && j.progressSeconds >= j.requiredSeconds) j.toolSpentAtCompletion = true;
    return added;
  }
  function release(s, stacks, tool) {
    for (const item of stacks) if (item.reservedTaskId === s.repair.taskId) item.reservedTaskId = '';
    if (tool?.reservedTaskId === s.repair.taskId) tool.reservedTaskId = '';
  }
  function finish(s, c, stacks, tool, now) {
    if (!c.alive || !Number.isFinite(now) || !active(s) || now < s.repair.lastAt || reason(s, c, stacks, tool)
      || s.repair.progressSeconds < s.repair.requiredSeconds) return false;
    const j = s.repair;
    for (const input of j.inputs) {
      const item = stacks.find(i => i.id === input.stackId); item.quantity -= input.quantity; item.knownQuantity = Math.min(item.knownQuantity, item.quantity);
    }
    s.gearCondition[j.gearId] = Math.min(100, j.condition + j.gain); j.status = 'completed';
    j.receipt = { at: now, gearId: j.gearId, ownerId: j.actorId, from: j.condition, to: s.gearCondition[j.gearId], consumed: copy(j.inputs), toolId: j.toolId, wear: j.wearApplied };
    release(s, stacks, tool); return true;
  }
  function cancel(s, stacks, tool, now) {
    if (!active(s)) return false;
    release(s, stacks, tool); s.repair.status = 'cancelled'; s.repair.cancelledAt = now;
    s.repair.reason = 'Unused components and gear released; elapsed effort, stamina and tool wear remain spent. No condition restored.';
    return true;
  }
  return { SECONDS, GAIN, WEAR, RECIPES, active, contactReason, plan, begin, reason, advance, finish, cancel };
});
