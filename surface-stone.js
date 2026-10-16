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
  const targetKey = node => node ? JSON.stringify([node.id, node.cell, node.inspected, node.portion || 0, node.faceEpoch || 0]) : '';
  const effort = node => node?.effort?.targetKey === targetKey(node) ? Math.max(0, Math.min(.999999, node.effort.fraction || 0)) : 0;
  function observeFace(node, present) {
    if (!node) return;
    if (!present && !node.faceMissing) { node.faceEpoch = (node.faceEpoch || 0) + 1; node.effort = null; }
    node.faceMissing = !present;
  }
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
    if (c.actorId && c.actorId !== 'scientist' && (!c.employmentAuthorized || c.commission?.operation !== 'recoverStone'))
      return 'The original craftsperson needs a separate authorized one-block recovery agreement.';
    if (c.facePresent === false) return 'The original exposed face or adjacent natural work ground is no longer available.';
    return '';
  }
  function plan(site, node, action, c, tools) {
    if (accessReason(c) || !site || !node || !site.nodes.includes(node) || !SECONDS[action]
      || c.siteId !== site.siteId || c.worldId !== site.worldId || c.busy || !c.reachable || !c.visible) return null;
    if (action === 'inspect' && node.inspected) return null;
    if (action === 'recover' && (!node.inspected?.workable || node.remaining <= 0)) return null;
    const delegated = c.actorId && c.actorId !== 'scientist', carrier = c.actorId || 'scientist', claim = c.claimId || '';
    if ((node.commissionClaim || '') !== claim || delegated && (action !== 'recover' || c.commission.nodeId !== node.id
      || c.commission.targetKey !== targetKey(node))) return null;
    const retained = action === 'recover' ? effort(node) : 0;
    const selected = [];
    if (action === 'recover') for (const [itemKey, fullWear] of Object.entries(WEAR)) {
      const wear = Math.max(1, Math.ceil(fullWear * (1 - retained)));
      const t = tools.find(t => t.key === itemKey && t.tool?.current >= wear && t.tool.carriedBy === carrier
        && t.tool.reservedTaskId === claim && t.stack?.quantity === 1 && t.stack.carriedBy === carrier && t.stack.reservedTaskId === claim
        && t.stack.toolInstanceId === t.tool.id && t.stack.key === itemKey
        && (!delegated || c.commission.tools?.some(loan => loan.key === itemKey && loan.toolId === t.tool.id && loan.stackId === t.stack.id)));
      if (!t) return null;
      selected.push({ key: itemKey, toolId: t.tool.id, stackId: t.stack.id, wear });
    }
    if (!(c.seconds > 0) || !(c.staminaCost >= 0) || c.stamina < c.staminaCost * (1 - retained)) return null;
    return { action, siteId: site.siteId, worldId: site.worldId, nodeId: node.id, bodyEpoch: c.bodyEpoch,
      targetKey: targetKey(node), retained, parentClaim: claim,
      ...(delegated ? { actorId: carrier, operation: 'recoverStone', partId: c.commission.partId } : {}),
      visitId: c.visitId || '', tripId: c.tripId || '', roomId: c.roomId, workCell: copy(c.workCell),
      required: c.seconds * (1 - retained), staminaCost: c.staminaCost * (1 - retained), tools: selected };
  }
  function begin(plan, taskId, now, tools, site) {
    const job = { ...copy(plan), taskId, progress: 0, lastAt: now, attended: false, wearApplied: {}, status: 'working' };
    job.parentClaim ||= taskId;
    if (job.action === 'recover') site.nodes.find(n => n.id === job.nodeId).commissionClaim = job.parentClaim;
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
    if (targetKey(node) !== job.targetKey || job.action === 'recover' && node.commissionClaim !== job.parentClaim)
      return 'The exact original face, agreed portion and exclusive source claim changed.';
    if ((job.actorId || 'scientist') !== (c.actorId || 'scientist') || job.actorId && (c.commission?.nodeId !== job.nodeId
      || c.commission?.partId !== job.partId || c.commission?.targetKey !== job.targetKey || c.claimId !== job.parentClaim))
      return 'Only the original authorized worker and one-block agreement can continue.';
    for (const claim of job.tools) {
      const t = tools.find(t => t.tool?.id === claim.toolId && t.stack?.id === claim.stackId);
      const outstanding = claim.wear - job.wearApplied[claim.toolId];
      if (!t || t.stack.quantity !== 1 || t.stack.key !== claim.key || t.stack.toolInstanceId !== claim.toolId
        || t.stack.carriedBy !== (job.actorId || 'scientist') || t.tool.carriedBy !== (job.actorId || 'scientist')
        || job.actorId && !c.commission?.tools?.some(loan => loan.key === claim.key && loan.toolId === claim.toolId && loan.stackId === claim.stackId)
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
    if (job.action === 'recover') site.nodes.find(n => n.id === job.nodeId).effort = {
      targetKey: job.targetKey, fraction: job.retained + (1 - job.retained) * job.progress / job.required };
    return added;
  }
  function release(job, tools, site) {
    const node = site?.nodes.find(n => n.id === job.nodeId);
    if (job.action === 'recover' && node?.commissionClaim === job.parentClaim) node.commissionClaim = '';
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
    else { node.remaining--; node.portion = (node.portion || 0) + 1; node.effort = null; }
    const receipt = { at: now, actorId: job.actorId || 'scientist', action: job.action, taskId: job.taskId, nodeId: node.id, siteId: site.siteId,
      worldId: site.worldId, strategicCellId: site.strategicCellId, cell: copy(node.cell),
      outputId, quantity: job.action === 'recover' ? 1 : 0, exhausted: node.remaining === 0 };
    node.receipts.push(receipt); job.status = 'completed'; job.receipt = receipt; release(job, tools, site); return receipt;
  }
  function cancel(job, tools, now, site) {
    if (!job || job.status !== 'working') return false;
    job.status = 'cancelled'; job.endedAt = now; release(job, tools, site); return true;
  }
  function publicView(site) {
    return { siteId: site?.siteId, observations: (site?.nodes || []).filter(n => n.inspected).map(n => ({
      id: n.id, cell: copy(n.cell), inspected: copy(n.inspected), receipts: copy(n.receipts.filter(r => !r.actorId || r.actorId === 'scientist')),
      summary: !n.inspected.workable ? 'No workable exposed construction stone established at this face.'
        : n.receipts.filter(r => !r.actorId || r.actorId === 'scientist').at(-1)?.exhausted ? 'This inspected face is exhausted.' : 'Workable exposed construction stone; remaining extent unmeasured.'
    })), limitation: 'Dated local-face evidence only. No whole-cell reserves, land title, permanent claim or safety guarantee.' };
  }
  return { WEAR, SECONDS, targetKey, effort, observeFace, create, accessReason, plan, begin, reason, advance, finish, cancel, publicView };
});
