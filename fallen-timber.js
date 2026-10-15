(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFallenTimber = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const key = c => `${c?.x},${c?.y},${c?.z}`;
  const SECONDS = Object.freeze({ inspect: 60, cut: 600, saw: 1200 });
  const WEAR = Object.freeze({ inspect: 0, cut: 4, saw: 8 });
  // One 11 kg log becomes two ordinary 5 kg lumber units and 1 kg of offcuts.
  const LOG = Object.freeze({ massKg: 11, volumeL: 26 });
  function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function create(context, baseline, roomId, clear) {
    if (!context?.truth || baseline?.worldId !== context.worldId || baseline.placeId !== context.siteId) return null;
    const potential = Math.max(0, Math.min(1000, Number(context.truth.potentialPermille?.timberFiber) || 0));
    const access = Math.max(0, Math.min(1000, Number(context.truth.surfaceAccessibilityPermille) || 0));
    const candidates = (baseline.cells || []).filter(c => c.y !== baseline.bounds.y + 4 && clear(c))
      .map(cell => ({ cell, n: hash(`${context.seed}:${context.worldId}:${context.siteId}:${key(cell)}:fallen-timber`) }))
      .filter(p => potential >= 300 && access >= 300 && p.n % 1000 < potential * access / 1000)
      .sort((a, b) => a.n - b.n).slice(0, potential >= 700 ? 3 : 1);
    return { worldId: context.worldId, siteId: context.siteId, strategicCellId: context.strategicCellId, roomId,
      nodes: candidates.map(({ cell, n }) => ({ id: `${context.siteId}:trunk:${key(cell)}`, cell: copy(cell),
        remaining: 1 + (n >>> 12) % 3, stackId: '', inspected: null, effort: 0, receipts: [] })), sawEffort: {}, receipts: [] };
  }
  const sourceClaim = node => `natural-timber:${node.id}`;
  function source(site, node, stacks) {
    const s = stacks.find(s => s.id === node?.stackId);
    return s && s.section === 'resources' && s.key === 'fallenTrunk' && s.quantity === 1 && !s.carriedBy
      && !s.fixtureId && !s.containerId && s.roomId === site.roomId && key(s.cell) === key(node.cell)
      && s.reservedTaskId === sourceClaim(node) && s.unitMassKg === node.remaining * LOG.massKg
      && s.unitVolumeL === node.remaining * LOG.volumeL ? s : null;
  }
  function logSignature(s) { return s ? JSON.stringify([s.id, s.section, s.key, s.quantity, s.unitMassKg, s.unitVolumeL, s.sourceLabels, s.materialComposition]) : ''; }
  function validLog(s, site, c, claim = '') {
    return s?.section === 'resources' && s.key === 'fieldLog' && s.quantity === 1 && !s.carriedBy && !s.fixtureId && !s.containerId
      && !s.cityOwnerId && !s.civicCustody && s.reservedTaskId === claim && s.roomId === site.roomId
      && s.unitMassKg === LOG.massKg && s.unitVolumeL === LOG.volumeL && c.inputAccessible;
  }
  function accessReason(c) {
    if (!c.wilderness || c.controlled) return 'Municipal sampling permission is not timber extraction permission; use unoccupied wilderness ground.';
    if (!c.alive || !c.capable || !c.free) return 'A living, free, capable scientist must personally work.';
    if (!c.groundPresent) return 'The original reachable natural working ground is no longer available.';
    return '';
  }
  function effort(site, node, action, input) {
    if (action === 'cut') return node.effort || 0;
    const saved = site.sawEffort[input?.id];
    return action === 'saw' && saved?.signature === logSignature(input) ? saved.fraction : 0;
  }
  function plan(site, node, action, c, tools, stacks, input = null) {
    if (!site || !SECONDS[action] || accessReason(c) || c.worldId !== site.worldId || c.siteId !== site.siteId
      || c.roomId !== site.roomId || c.busy || !c.reachable || !c.visible || c.threatened) return null;
    if (action === 'saw') { if (!validLog(input, site, c)) return null; }
    else if (!site.nodes.includes(node) || !source(site, node, stacks) || node.remaining <= 0
      || action === 'inspect' && node.inspected || action === 'cut' && !node.inspected?.workable) return null;
    const retained = Math.max(0, Math.min(.999999, effort(site, node, action, input)));
    const wear = Math.ceil(WEAR[action] * (1 - retained));
    const selected = wear ? tools.find(t => t.key === 'handSaw' && t.tool?.current >= wear && !t.tool.reservedTaskId
      && t.tool.carriedBy === 'scientist' && t.stack.carriedBy === 'scientist' && t.stack.quantity === 1
      && !t.stack.reservedTaskId && t.stack.key === 'handSaw' && t.stack.toolInstanceId === t.tool.id) : null;
    if (wear && !selected || !(c.seconds > 0) || !(c.staminaCost >= 0) || c.stamina < c.staminaCost) return null;
    return { action, siteId: site.siteId, worldId: site.worldId, nodeId: node?.id || '', sourceStackId: node?.stackId || '',
      sourceRemaining: node?.remaining, inputId: input?.id || '', inputSignature: action === 'saw' ? logSignature(input) : '',
      bodyEpoch: c.bodyEpoch, visitId: c.visitId || '', tripId: c.tripId || '', roomId: c.roomId, workCell: copy(c.workCell),
      retained, required: c.seconds * (1 - retained), staminaCost: c.staminaCost,
      toolId: selected?.tool.id || '', toolStackId: selected?.stack.id || '', wear };
  }
  function begin(plan, taskId, now, tools, stacks) {
    const job = { ...copy(plan), taskId, progress: 0, lastAt: now, attended: false, wearApplied: 0, status: 'working' };
    if (job.toolId) {
      const t = tools.find(t => t.tool?.id === job.toolId && t.stack.id === job.toolStackId);
      t.tool.reservedTaskId = taskId; t.stack.reservedTaskId = taskId;
    }
    if (job.inputId) stacks.find(s => s.id === job.inputId).reservedTaskId = taskId;
    return job;
  }
  function reason(site, job, c, tools, stacks) {
    if (accessReason(c)) return accessReason(c);
    if (!site || c.worldId !== job.worldId || site.worldId !== job.worldId || site.siteId !== job.siteId || c.siteId !== job.siteId
      || c.roomId !== job.roomId || c.bodyEpoch !== job.bodyEpoch || (c.visitId || '') !== job.visitId || (c.tripId || '') !== job.tripId)
      return 'Only the original body, world, site, visit and physical trip can continue this task.';
    const node = site.nodes.find(n => n.id === job.nodeId), input = stacks.find(s => s.id === job.inputId);
    if (job.action === 'saw') {
      if (!validLog(input, site, c, job.taskId) || logSignature(input) !== job.inputSignature)
        return 'The exact original staged log, dimensions, ownership and reservation must remain available.';
    } else if (!node || node.stackId !== job.sourceStackId || node.remaining !== job.sourceRemaining
      || !source(site, node, stacks) || node.remaining <= 0 || job.action === 'cut' && !node.inspected?.workable)
      return 'The original inspected fallen trunk is missing, changed or exhausted.';
    if (job.toolId) {
      const t = tools.find(t => t.tool?.id === job.toolId && t.stack.id === job.toolStackId);
      if (!t || t.stack.quantity !== 1 || t.stack.key !== 'handSaw' || t.stack.toolInstanceId !== job.toolId
        || t.stack.carriedBy !== 'scientist' || t.tool.carriedBy !== 'scientist'
        || t.stack.reservedTaskId !== job.taskId || t.tool.reservedTaskId !== job.taskId || t.tool.current < job.wear - job.wearApplied)
        return 'The exact original carried hand saw, its claim and remaining durability are required.';
    }
    return '';
  }
  function advance(site, job, c, tools, stacks, now) {
    if (!job || job.status !== 'working') return 0;
    const dt = Math.max(0, now - job.lastAt); job.lastAt = now;
    const supported = !reason(site, job, c, tools, stacks) && c.atHead && !c.threatened && key(c.cell) === key(job.workCell);
    if (!supported || !job.attended) { job.attended = supported; return 0; }
    const added = Math.min(dt, job.required - job.progress); job.progress += added;
    if (job.toolId) {
      const due = Math.min(job.wear, Math.floor(job.progress / job.required * job.wear + 1e-8));
      tools.find(t => t.tool?.id === job.toolId).tool.current -= due - job.wearApplied; job.wearApplied = due;
    }
    const fraction = job.retained + (1 - job.retained) * job.progress / job.required;
    if (job.action === 'cut') site.nodes.find(n => n.id === job.nodeId).effort = fraction;
    if (job.action === 'saw') site.sawEffort[job.inputId] = { signature: job.inputSignature, fraction };
    return added;
  }
  function release(job, tools, stacks) {
    for (const t of tools) {
      if (t.tool?.id === job.toolId && t.tool.reservedTaskId === job.taskId) t.tool.reservedTaskId = '';
      if (t.stack.id === job.toolStackId && t.stack.reservedTaskId === job.taskId) t.stack.reservedTaskId = '';
    }
    const input = stacks.find(s => s.id === job.inputId); if (input?.reservedTaskId === job.taskId) input.reservedTaskId = '';
  }
  function finish(site, job, c, tools, stacks, now, outputs = []) {
    if (job?.status !== 'working' || job.progress < job.required || reason(site, job, c, tools, stacks)
      || !c.atHead || c.threatened || key(c.cell) !== key(job.workCell)) return null;
    const keys = job.action === 'cut' ? ['fieldLog'] : job.action === 'saw' ? ['lumber', 'woodDebris'] : [];
    if (outputs.length !== keys.length || outputs.some((o, i) => !o?.id || o.key !== keys[i]
      || o.quantity !== (o.key === 'lumber' ? 2 : 1)) || new Set(outputs.map(o => o.id)).size !== outputs.length) return null;
    const node = site.nodes.find(n => n.id === job.nodeId);
    if (job.action === 'inspect') node.inspected = { at: now, workable: node.remaining > 0 };
    if (job.action === 'cut') {
      const s = source(site, node, stacks); node.remaining--; node.effort = 0;
      s.unitMassKg = node.remaining * LOG.massKg; s.unitVolumeL = node.remaining * LOG.volumeL;
      s.updatedAt = now; s.observedAt = now;
      if (!node.remaining) { s.quantity = 0; s.knownQuantity = 0; }
    }
    if (job.action === 'saw') {
      const input = stacks.find(s => s.id === job.inputId); input.quantity = 0; input.knownQuantity = 0;
      input.updatedAt = now;
      delete site.sawEffort[job.inputId];
    }
    const receipt = { at: now, taskId: job.taskId, action: job.action, worldId: site.worldId, siteId: site.siteId,
      nodeId: job.nodeId, inputId: job.inputId, cell: copy(job.workCell), outputs: copy(outputs), exhausted: node ? node.remaining === 0 : false };
    site.receipts.push(receipt); if (node) node.receipts.push(receipt);
    job.status = 'completed'; job.receipt = receipt; release(job, tools, stacks); return receipt;
  }
  function cancel(job, tools, stacks, now) {
    if (job?.status !== 'working') return false;
    job.status = 'cancelled'; job.endedAt = now; release(job, tools, stacks); return true;
  }
  function publicView(site) {
    return { siteId: site?.siteId, observations: (site?.nodes || []).filter(n => n.inspected).map(n => ({
      id: n.id, cell: copy(n.cell), at: n.inspected.at, receipts: copy(n.receipts),
      summary: n.receipts.at(-1)?.exhausted ? 'Original fallen trunk exhausted.' : 'Inspected workable fallen timber; no regional reserves established.'
    })), receipts: copy(site?.receipts || []), limitation: 'Dated personal evidence, not live remote stocks, land ownership, forestry rights or automatic regrowth.' };
  }
  return { SECONDS, WEAR, LOG, create, sourceClaim, source, logSignature, accessReason, plan, begin, reason, advance, finish, cancel, publicView };
});
