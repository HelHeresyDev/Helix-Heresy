(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSurfaceStone = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const key = c => `${c?.x},${c?.y},${c?.z}`;
  const WEAR = Object.freeze({ masonryHammer: 4, stoneChisel: 6 });
  const SECONDS = Object.freeze({ inspect: 60, recover: 900 });
  function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function create(context, baseline) {
    if (!context?.truth || !baseline || baseline.worldId !== context.worldId || baseline.placeId !== context.siteId) return null;
    const truth = context.truth;
    const exposed = truth.typicalDepth?.constructionStone === 'exposed';
    const potential = Math.max(0, Math.min(1000, Number(truth.potentialPermille?.constructionStone) || 0));
    const access = Math.max(0, Math.min(1000, Number(truth.surfaceAccessibilityPermille) || 0));
    return { worldId: context.worldId, siteId: context.siteId, strategicCellId: context.strategicCellId,
      nodes: (baseline.rocks || []).map(cell => {
        const n = hash(`${context.seed}:${context.worldId}:${context.siteId}:${key(cell)}:stone-face`);
        const suitable = exposed && potential >= 300 && access >= 300 && n % 1000 < potential * access / 1000;
        return { id: `${context.siteId}:stone:${key(cell)}`, cell: copy(cell),
          remaining: suitable ? 1 + (n >>> 12) % 3 : 0, inspected: null, receipts: [] };
      }) };
  }
  function accessReason(c) {
    if (!c.wilderness || c.controlled) return 'Sampling access is not extraction permission. This service covers only unoccupied wilderness surface faces, not municipal reserves or controlled land.';
    if (!c.alive || !c.capable || !c.free) return 'A living, free, capable scientist must personally perform the work.';
    if (c.facePresent === false) return 'The original exposed face or adjacent natural work ground is no longer available.';
    return '';
  }
  function plan(site, node, action, c, tools) {
    if (accessReason(c) || !site || !node || !site.nodes.includes(node) || !SECONDS[action]
      || c.siteId !== site.siteId || c.worldId !== site.worldId || c.busy || !c.reachable || !c.visible) return null;
    if (action === 'inspect' && node.inspected) return null;
    if (action === 'recover' && (!node.inspected?.workable || node.remaining <= 0)) return null;
    const selected = [];
    if (action === 'recover') for (const [itemKey, wear] of Object.entries(WEAR)) {
      const t = tools.find(t => t.key === itemKey && t.tool?.current >= wear && t.tool.carriedBy === 'scientist'
        && !t.tool.reservedTaskId && t.stack?.quantity === 1 && t.stack.carriedBy === 'scientist' && !t.stack.reservedTaskId
        && t.stack.toolInstanceId === t.tool.id && t.stack.key === itemKey);
      if (!t) return null;
      selected.push({ key: itemKey, toolId: t.tool.id, stackId: t.stack.id, wear });
    }
    if (!(c.seconds > 0) || !(c.staminaCost >= 0) || c.stamina < c.staminaCost) return null;
    return { action, siteId: site.siteId, worldId: site.worldId, nodeId: node.id, bodyEpoch: c.bodyEpoch,
      visitId: c.visitId || '', tripId: c.tripId || '', roomId: c.roomId, workCell: copy(c.workCell),
      required: c.seconds, staminaCost: c.staminaCost, tools: selected };
  }
  function begin(plan, taskId, now, tools) {
    const job = { ...copy(plan), taskId, progress: 0, lastAt: now, attended: false, wearApplied: {}, status: 'working' };
    for (const claim of job.tools) {
      const t = tools.find(t => t.tool?.id === claim.toolId && t.stack?.id === claim.stackId);
      t.tool.reservedTaskId = taskId; t.stack.reservedTaskId = taskId;
      job.wearApplied[claim.toolId] = 0;
    }
    return job;
  }
  function reason(site, job, c, tools) {
    const node = site?.nodes.find(n => n.id === job?.nodeId);
    const access = accessReason(c); if (access) return access;
    if (!node || site.worldId !== job.worldId || c.worldId !== job.worldId || c.siteId !== job.siteId
      || c.bodyEpoch !== job.bodyEpoch || (c.visitId || '') !== job.visitId || (c.tripId || '') !== job.tripId || c.roomId !== job.roomId)
      return 'The original body, site and physical trip must remain available; no replacement-body inheritance.';
    if (job.action === 'recover' && (!node.inspected?.workable || node.remaining <= 0)) return 'The inspected surface face is unavailable or exhausted.';
    for (const claim of job.tools) {
      const t = tools.find(t => t.tool?.id === claim.toolId && t.stack?.id === claim.stackId);
      const outstanding = claim.wear - job.wearApplied[claim.toolId];
      if (!t || t.stack.quantity !== 1 || t.stack.key !== claim.key || t.stack.toolInstanceId !== claim.toolId
        || t.stack.carriedBy !== 'scientist' || t.tool.carriedBy !== 'scientist'
        || t.stack.reservedTaskId !== job.taskId || t.tool.reservedTaskId !== job.taskId || t.tool.current < outstanding)
        return 'The exact original carried hammer and chisel, claims and remaining durability are required.';
    }
    return '';
  }
  function advance(site, job, c, tools, now) {
    if (!job || job.status !== 'working') return 0;
    const dt = Math.max(0, now - job.lastAt); job.lastAt = now;
    const supported = !reason(site, job, c, tools) && c.atHead && !c.threatened && key(c.cell) === key(job.workCell);
    // The first supported observation establishes arrival, never credits the walk or an away interval.
    if (!supported || !job.attended) { job.attended = supported; return 0; }
    const added = Math.min(dt, job.required - job.progress); job.progress += added;
    for (const claim of job.tools) {
      const due = Math.min(claim.wear, Math.floor(job.progress / job.required * claim.wear + 1e-8));
      const t = tools.find(t => t.tool?.id === claim.toolId);
      t.tool.current -= due - job.wearApplied[claim.toolId]; job.wearApplied[claim.toolId] = due;
    }
    return added;
  }
  function release(job, tools) {
    for (const claim of job.tools) for (const t of tools) {
      if (t.tool?.id === claim.toolId && t.tool.reservedTaskId === job.taskId) t.tool.reservedTaskId = '';
      if (t.stack?.id === claim.stackId && t.stack.reservedTaskId === job.taskId) t.stack.reservedTaskId = '';
    }
  }
  function finish(site, job, c, tools, now, outputId = '') {
    if (job?.status !== 'working' || job.progress < job.required || reason(site, job, c, tools)
      || !c.atHead || c.threatened || key(c.cell) !== key(job.workCell) || job.action === 'recover' && !outputId) return null;
    const node = site.nodes.find(n => n.id === job.nodeId);
    if (job.action === 'inspect') node.inspected = { at: now, workable: node.remaining > 0, bodyEpoch: job.bodyEpoch };
    else node.remaining--;
    const receipt = { at: now, action: job.action, taskId: job.taskId, nodeId: node.id, siteId: site.siteId,
      worldId: site.worldId, strategicCellId: site.strategicCellId, cell: copy(node.cell),
      outputId, quantity: job.action === 'recover' ? 1 : 0, exhausted: node.remaining === 0 };
    node.receipts.push(receipt); job.status = 'completed'; job.receipt = receipt; release(job, tools); return receipt;
  }
  function cancel(job, tools, now) {
    if (!job || job.status !== 'working') return false;
    job.status = 'cancelled'; job.endedAt = now; release(job, tools); return true;
  }
  function publicView(site) {
    return { siteId: site?.siteId, observations: (site?.nodes || []).filter(n => n.inspected).map(n => ({
      id: n.id, cell: copy(n.cell), inspected: copy(n.inspected), receipts: copy(n.receipts),
      summary: !n.inspected.workable ? 'No workable exposed construction stone established at this face.'
        : n.receipts.at(-1)?.exhausted ? 'This inspected face is exhausted.' : 'Workable exposed construction stone; remaining extent unmeasured.'
    })), limitation: 'Dated local-face evidence only. No whole-cell reserves, land title, permanent claim or safety guarantee.' };
  }
  return { WEAR, SECONDS, create, accessReason, plan, begin, reason, advance, finish, cancel, publicView };
});
