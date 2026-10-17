(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixFieldToolCare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEYS = Object.freeze(['masonryHammer', 'stoneChisel', 'handSaw']);
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const signature = s => JSON.stringify([s.key, s.unitMassKg, s.unitVolumeL, s.dimensionsM, s.sourceLabels, s.materialComposition, s.tags]);
  const owned = s => s && s.quantity > 0 && !s.cityOwnerId && !s.civicCustody && !s.fixtureId && !s.containerId
    && !s.chemicalBatch && !s.biology && !s.creature && !s.contents?.length && !(s.tags || []).some(t => /toxic|hazard|contaminat|volatile|waste/i.test(t));
  const held = (s, c) => owned(s) && s.carriedBy === 'scientist' && s.roomId === c.roomId && same(s.cell, c.cell);
  function plan(action, tool, stack, part, c) {
    if (!['maintain', 'repair'].includes(action) || !tool || !KEYS.includes(stack?.key) || stack.toolInstanceId !== tool.id
      || stack.quantity !== 1 || !held(stack, c) || tool.carriedBy !== 'scientist' || tool.roomId !== c.roomId
      || tool.reservedTaskId || stack.reservedTaskId || !Number.isFinite(tool.current) || !Number.isFinite(tool.max) || !(tool.max > 0)
      || tool.current < 0 || tool.current >= tool.max || action === 'maintain' && (tool.current <= 0 || tool.current >= tool.max * .9)
      || !c.alive || !c.capable || !c.free || c.busy || !c.supported || c.threatened || !c.worldId || !c.siteId || !c.roomId
      || !Number.isInteger(c.bodyEpoch) || c.bodyEpoch < 0 || !Number.isFinite(c.seconds) || c.seconds <= 0
      || !Number.isFinite(c.staminaCost) || c.staminaCost < 0 || c.stamina < c.staminaCost) return null;
    if (action === 'repair' && (!held(part, c) || part.key !== 'metalParts' || part.section !== 'resources' || part.reservedTaskId)) return null;
    return { action, key: stack.key, toolId: tool.id, stackId: stack.id, signature: signature(stack), max: tool.max,
      before: tool.current, expected: tool.current, target: action === 'maintain' ? Math.min(tool.max, Math.ceil(tool.max * .9)) : Math.min(tool.max, tool.current + Math.ceil(tool.max * .45)),
      required: c.seconds, staminaCost: c.staminaCost, bodyEpoch: c.bodyEpoch, worldId: c.worldId, siteId: c.siteId,
      roomId: c.roomId, cell: copy(c.cell), visitId: c.visitId, tripId: c.tripId,
      part: action === 'repair' ? { stackId: part.id, signature: signature(part), consumed: false } : null };
  }
  function begin(p, id, now, tool, stack, part) {
    if (!p || !id || !Number.isFinite(now) || tool?.id !== p.toolId || stack?.id !== p.stackId || tool.current !== p.before || tool.max !== p.max
      || signature(stack) !== p.signature || stack.toolInstanceId !== tool.id || tool.reservedTaskId || stack.reservedTaskId
      || p.part && (part?.quantity !== 1 || part.reservedTaskId !== id || signature(part) !== p.part.signature)) return null;
    tool.reservedTaskId = stack.reservedTaskId = id;
    return { ...copy(p), ...(p.part ? { part: { ...copy(p.part), stackId: part.id } } : {}), id, status: 'working', progress: 0, lastAt: now, attended: false };
  }
  function reason(j, tool, stack, part, c) {
    if (!j || j.status !== 'working') return 'This personal tool-care task is no longer working.';
    if (!c.alive || !c.capable || !c.free || ['bodyEpoch', 'worldId', 'siteId', 'roomId', 'visitId', 'tripId'].some(k => j[k] !== c[k]) || !same(j.cell, c.cell))
      return 'The original free capable scientist, body, place and visit must physically attend.';
    if (tool?.id !== j.toolId || stack?.id !== j.stackId || stack.toolInstanceId !== tool.id || stack.quantity !== 1 || stack.key !== j.key
      || !held(stack, c) || tool.carriedBy !== 'scientist' || tool.roomId !== c.roomId || signature(stack) !== j.signature
      || tool.reservedTaskId !== j.id || stack.reservedTaskId !== j.id || tool.max !== j.max || !Number.isFinite(tool.current) || Math.abs(tool.current - j.expected) > 1e-8)
      return 'The exact owned carried tool, original condition and both exclusive claims must remain unchanged; cancel before fresh care.';
    if (j.part && !j.part.consumed && (!held(part, c) || part.id !== j.part.stackId || part.key !== 'metalParts' || part.quantity !== 1
      || part.reservedTaskId !== j.id || signature(part) !== j.part.signature)) return 'The exact reserved carried metal part is unavailable; no substitute is used.';
    return !c.supported ? 'Clear supported working ground is required.' : c.threatened ? 'Fighting or a nearby visible threat prevents attended tool care.' : '';
  }
  function advance(j, tool, stack, part, c, now) {
    if (!j || j.status !== 'working' || !Number.isFinite(now) || !c.alive || now < j.lastAt) return false;
    const dt = now - j.lastAt; j.lastAt = now;
    j.reason = reason(j, tool, stack, part, c) || (!c.atHead ? 'Personal attendance at the queue head is required.' : '');
    if (j.reason) { j.attended = false; return false; }
    if (!j.attended) { j.attended = true; return false; }
    if (!(dt > 0)) return false;
    if (j.part && !j.part.consumed) { part.quantity = 0; part.reservedTaskId = ''; j.part.consumed = true; j.part.consumedAt = now; }
    j.progress = Math.min(j.required, j.progress + dt);
    // Durable-tool saves use integer condition. Never lose or invent a
    // fractional improvement when ordinary tool normalization runs on reload.
    tool.current = j.expected = j.before + Math.floor((j.target - j.before) * j.progress / j.required);
    return true;
  }
  function release(j, tool, stack, part) {
    for (const i of [tool, stack, part]) if (i?.reservedTaskId === j.id) i.reservedTaskId = '';
  }
  function finish(j, tool, stack, part, c, now) {
    if (!Number.isFinite(now) || reason(j, tool, stack, part, c) || !c.atHead || j.progress < j.required) return null;
    j.status = 'completed'; j.endedAt = now; release(j, tool, stack, part);
    return { id: j.id, at: now, action: j.action, toolId: j.toolId, stackId: j.stackId, key: j.key,
      before: j.before, after: tool.current, bodyEpoch: j.bodyEpoch, roomId: j.roomId, cell: copy(j.cell), part: copy(j.part) };
  }
  function cancel(j, tool, stack, part, now) {
    if (j?.status !== 'working' || !Number.isFinite(now)) return false;
    release(j, tool, stack, part); j.status = 'cancelled'; j.endedAt = now; j.attended = false; return true;
  }
  return { KEYS, signature, plan, begin, reason, advance, finish, cancel };
});
