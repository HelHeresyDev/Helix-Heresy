(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldStation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const key = c => `${c?.x},${c?.y},${c?.z}`;
  function homeSupply(item, homeRoomIds) {
    return Boolean(item && homeRoomIds.includes(item.roomId) && item.quantity > 0
      && !item.carriedBy && !item.reservedTaskId && !item.cityOwnerId && !item.civicCustody
      && ['resources', 'inventory'].includes(item.section)
      && ['stoneBlocks', 'lumber', 'metalParts', 'masonryHammer', 'stoneChisel', 'handSaw', 'foldingLadder'].includes(item.key));
  }
  const registry = Theme.createRegistry([{ id: 'facility.shared.field-station', kind: 'facility', compatibility: 'shared',
    contentTags: ['survival'], template: 'Unstaffed wilderness supply hut', fallback: true }]);
  function create(theme = 'madcap', seed = 'field-station') {
    const selected = Theme.selectContent(registry, { kind: 'facility', worldTheme: theme, seed, required: true });
    if (!selected.ok) throw new Error('No compatible field station content.');
    return { definitionId: selected.definitionId, sourceTheme: selected.sourceTheme, site: null, observations: null, history: [] };
  }
  function layout(origin) {
    const at = (x, y, z = 0) => ({ x: origin.x + x, y: origin.y + y, z: origin.z + z });
    const footprint = [], walls = [], roofs = [];
    const door = at(1, 3), rest = at(1, 2), cache = at(1, 1), apron = at(1, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      const c = at(x, y); footprint.push(c); roofs.push(at(x, y, 1));
      if ((x === 0 || x === 2 || y === 0 || y === 3) && key(c) !== key(door)) walls.push(c);
    }
    const floors = [cache, rest, door], parts = [];
    const add = (kind, cell, costs, seconds, tools) => parts.push({ id: `${kind}:${key(cell)}`, kind, cell: copy(cell), costs, seconds, tools });
    floors.forEach(c => add('floor', c, { stoneBlocks: 1 }, 480, { masonryHammer: 1, stoneChisel: 1 }));
    walls.forEach(c => add('wall', c, { stoneBlocks: 2 }, 720, { masonryHammer: 2 }));
    roofs.forEach(c => add('roof', c, { lumber: 1 }, 360, { masonryHammer: 1, handSaw: 1, foldingLadder: 1 }));
    add('door', door, { lumber: 1 }, 600, { masonryHammer: 1, handSaw: 1 });
    add('cache', cache, { lumber: 3, metalParts: 1 }, 420, { masonryHammer: 1, handSaw: 1 });
    return { origin: copy(origin), footprint, ground: [...footprint, apron], floors, walls, roofs, door, rest, cache, apron, parts };
  }
  function accessReason(c) {
    return !c.local || !c.wilderness ? 'Personally attend the original foreign wilderness sector; municipal sampling ground is not a construction grant.'
      : !c.alive || !c.capable || !c.free ? 'A living free capable scientist must personally attend.'
        : c.actorId && c.actorId !== 'scientist' && !c.employmentAuthorized ? 'The original worker needs an explicit current construction commission.' : '';
  }
  function register(s, place, plan, c, now) {
    if (s.site || accessReason(c) || !c.observed || !c.clear || c.busy || !place?.worldId || !place?.siteId || !place?.cityId) return false;
    s.site = { ...copy(place), layout: copy(plan), registeredAt: now, parts: {}, effort: {}, cacheId: '', doorId: '' };
    s.history.push({ at: now, kind: 'registered', summary: 'Inspected physical footprint only; no building, supplies, title, staff or safety granted.' }); return true;
  }
  function prerequisite(site, part, c) {
    if (part.kind !== 'floor' && !c.floorsIntact) return 'Finish the three actual stone floor tiles first.';
    if (['roof', 'door', 'cache'].includes(part.kind) && !c.wallsIntact) return 'The actual nine masonry wall tiles must survive before roof, door or cache work.';
    if (part.kind === 'cache' && (!c.roofsIntact || !c.doorPresent)) return 'Finish the actual roof and original door before installing the crate.';
    return '';
  }
  function workPart(s, partId, operation = 'build') {
    const part = s?.site?.layout.parts.find(p => p.id === partId);
    if (!part || !['build', 'repair', 'reconstruct'].includes(operation)) return null;
    if (operation !== 'repair') return part;
    // Match ordinary material-aware structure repairs: one primary material,
    // at most 45 condition. A real surviving zero-condition object is repairable.
    return { ...copy(part), costs: { [part.kind === 'floor' || part.kind === 'wall' ? 'stoneBlocks' : 'lumber']: 1 },
      seconds: Math.max(180, part.seconds / 2) };
  }
  function maintenanceReason(s, part, c, operation) {
    if (operation === 'build') return s.site.parts[part.id] ? 'This component already has an installation receipt; inspect it for repair or reconstruction.' : '';
    if (!s.site.parts[part.id]) return 'Construct the original component first.';
    const t = c.target;
    if (!t?.visible) return 'Personally inspect the actual component or its empty footprint nearby.';
    if (!t.original) return 'The original component or clear original footprint is required; unrelated property cannot be replaced.';
    if (operation === 'repair') return !t.present ? 'The original component is missing; reconstruct it instead.'
      : !(t.condition >= 0 && t.condition < 100) ? 'The component is already at full condition.' : '';
    return t.present ? 'A surviving component must be repaired, not replaced.'
      : part.kind === 'cache' && t.goodsRemain ? 'Physically recover all goods from the missing original crate before replacing it.' : '';
  }
  function effortKey(partId, operation = 'build') { return operation === 'build' ? partId : `${operation}:${partId}`; }
  function targetKey(c) { return JSON.stringify([c.target?.id, c.target?.present, c.target?.condition, c.target?.stamp]); }
  function clearChangedEffort(s, partId, target) {
    for (const operation of ['repair', 'reconstruct']) {
      const k = effortKey(partId, operation), e = s.site?.maintenanceEffort?.[k];
      if (e && (!target?.original || e.targetKey !== targetKey({ target }))) delete s.site.maintenanceEffort[k];
    }
  }
  function inspectTarget(s, partId, target) {
    if (target?.visible) clearChangedEffort(s, partId, target);
  }
  function commissionAllows(c, partId, operation) {
    if (!c.actorId || c.actorId === 'scientist') return true;
    if (operation === 'build') return !c.commission || c.commission.operation === 'build' && c.commission.partId === partId;
    return operation === 'repair' && c.employmentAuthorized && c.commission?.operation === 'repair'
      && c.commission.partId === partId && c.commission.targetKey === targetKey(c);
  }
  function effort(s, partId, operation = 'build', c = {}) {
    if (operation === 'build') return s.site?.effort[partId] || 0;
    const e = s.site?.maintenanceEffort?.[effortKey(partId, operation)];
    return e?.targetKey === targetKey(c) ? e.fraction : 0;
  }
  function plan(s, partId, c, tools, inputs, operation = 'build') {
    const actorId = c.actorId || 'scientist';
    if (!commissionAllows(c, partId, operation)) return null;
    const site = s.site, part = workPart(s, partId, operation);
    if (!part || maintenanceReason(s, part, c, operation) || accessReason(c) || c.siteId !== site.siteId || c.worldId !== site.worldId
      || c.busy || !c.geometryOkay || !c.reachable || c.threatened || prerequisite(site, part, c) || !inputs) return null;
    if (Object.entries(part.costs).some(([key, amount]) => inputs.filter(i => i.key === key).reduce((n, i) => n + i.quantity, 0) !== amount)
      || inputs.some(i => !part.costs[i.key] || !(i.quantity > 0) || !i.stackId || !i.cell)) return null;
    const from = Math.max(0, Math.min(.999999, effort(s, partId, operation, c))), claims = [];
    for (const [itemKey, wear] of Object.entries(part.tools)) {
      const budget = Math.max(1, Math.ceil(wear * (1 - from)));
      const available = id => !id || Boolean(c.claimId && id === c.claimId);
      const t = tools.find(t => t.key === itemKey && t.tool?.current >= budget && available(t.tool.reservedTaskId) && t.tool.carriedBy === actorId
        && t.stack?.quantity === 1 && available(t.stack.reservedTaskId) && t.stack.carriedBy === actorId && t.stack.toolInstanceId === t.tool.id);
      if (!t) return null;
      claims.push({ key: itemKey, toolId: t.tool.id, stackId: t.stack.id, wear: budget });
    }
    if (!(c.seconds > 0) || c.stamina < c.staminaCost) return null;
    return { partId, actorId, operation, targetKey: operation === 'build' ? '' : targetKey(c), target: copy(c.target || null),
      siteId: site.siteId, worldId: site.worldId, roomId: site.roomId, bodyEpoch: c.bodyEpoch,
      tripId: c.tripId, visitId: c.visitId, workCell: copy(c.workCell), required: c.seconds, staminaCost: c.staminaCost,
      from, tools: claims, inputs: copy(inputs) };
  }
  function begin(plan, taskId, now, tools) {
    const j = { ...copy(plan), taskId, status: 'working', progress: 0, lastAt: now, attended: false, wearApplied: {} };
    for (const claim of j.tools) {
      const t = tools.find(t => t.tool?.id === claim.toolId && t.stack?.id === claim.stackId);
      t.tool.reservedTaskId = taskId; t.stack.reservedTaskId = taskId; j.wearApplied[claim.toolId] = 0;
    }
    return j;
  }
  function reason(s, j, c, tools, stacks) {
    const site = s?.site, part = site?.layout.parts.find(p => p.id === j.partId);
    if (!part) return 'The original station component is unavailable.';
    if (j.invalidated) return 'The inspected target changed during this task; cancel and start fresh supplied work.';
    const operation = j.operation || 'build';
    if (!commissionAllows(c, j.partId, operation)) return 'The original exact component commission is required.';
    const maintenance = maintenanceReason(s, part, c, operation);
    if (maintenance) return maintenance;
    if (operation !== 'build' && targetKey(c) !== j.targetKey) return 'The exact inspected target changed; cancel and inspect it again.';
    if (accessReason(c)) return accessReason(c);
    if ((j.actorId || 'scientist') !== (c.actorId || 'scientist')) return 'Only the original working person may continue this component.';
    if (c.siteId !== j.siteId || c.worldId !== j.worldId || c.roomId !== j.roomId || c.bodyEpoch !== j.bodyEpoch
      || c.tripId !== j.tripId || c.visitId !== j.visitId) return 'Only the original body and physical visit/trip may continue this personal task.';
    if (!c.geometryOkay || !c.materialsLocal || prerequisite(site, part, c)) return prerequisite(site, part, c) || 'Actual work ground, target footprint or staged material access changed.';
    for (const claim of j.inputs) {
      const i = stacks.find(i => i.id === claim.stackId);
      if (!i || i.section !== 'resources' || i.key !== claim.key || i.quantity !== claim.quantity || i.reservedTaskId !== j.taskId
        || i.carriedBy || i.fixtureId || i.containerId || i.cityOwnerId || i.civicCustody || key(i.cell) !== key(claim.cell) || i.roomId !== j.roomId)
        return 'An exact original staged owned material portion moved, disappeared or changed custody.';
    }
    for (const claim of j.tools) {
      const t = tools.find(t => t.tool?.id === claim.toolId && t.stack?.id === claim.stackId);
      if (!t || t.tool.carriedBy !== (j.actorId || 'scientist') || t.stack.carriedBy !== (j.actorId || 'scientist') || t.stack.quantity !== 1
        || t.stack.key !== claim.key || t.stack.toolInstanceId !== claim.toolId || t.tool.reservedTaskId !== j.taskId
        || t.stack.reservedTaskId !== j.taskId || t.tool.current < claim.wear - j.wearApplied[claim.toolId])
        return 'The exact carried reserved tools and their remaining wear budget are required.';
    }
    return '';
  }
  function advance(s, j, c, tools, stacks, now) {
    if (!j || j.status !== 'working') return 0;
    const elapsed = Math.max(0, now - j.lastAt); j.lastAt = now;
    if (j.operation && j.operation !== 'build' && c.local && c.target?.visible) {
      inspectTarget(s, j.partId, c.target);
      if (targetKey(c) !== j.targetKey || !c.target.original) j.invalidated = true;
    }
    const attended = !reason(s, j, c, tools, stacks) && c.atHead && !c.threatened && key(c.cell) === key(j.workCell);
    if (!attended || !j.attended) { j.attended = attended; return 0; }
    const used = Math.min(elapsed, j.required - j.progress); j.progress += used;
    const fraction = j.from + (1 - j.from) * j.progress / j.required;
    if (!j.operation || j.operation === 'build') s.site.effort[j.partId] = fraction;
    else (s.site.maintenanceEffort ||= {})[effortKey(j.partId, j.operation)] = { targetKey: j.targetKey, fraction };
    for (const claim of j.tools) {
      const due = Math.min(claim.wear, Math.floor(j.progress / j.required * claim.wear + 1e-8));
      tools.find(t => t.tool?.id === claim.toolId).tool.current -= due - j.wearApplied[claim.toolId]; j.wearApplied[claim.toolId] = due;
    }
    return used;
  }
  function release(j, tools, stacks) {
    for (const i of stacks) if (i.reservedTaskId === j.taskId) i.reservedTaskId = '';
    for (const t of tools) if (t.tool?.reservedTaskId === j.taskId) t.tool.reservedTaskId = '';
  }
  function ready(s, j, c, tools, stacks) {
    return j?.status === 'working' && j.progress >= j.required && !reason(s, j, c, tools, stacks)
      && c.atHead && !c.threatened && key(c.cell) === key(j.workCell);
  }
  function finish(s, j, c, tools, stacks, now, physicalId) {
    if (!physicalId || (j?.operation === 'repair' && physicalId !== j.target?.id) || !ready(s, j, c, tools, stacks)) return false;
    const receipt = { at: now, actorId: j.actorId || 'scientist', taskId: j.taskId, partId: j.partId, physicalId, operation: j.operation || 'build',
      target: copy(j.target || null), inputs: copy(j.inputs), tools: copy(j.tools) };
    if (receipt.operation !== 'repair') { s.site.parts[j.partId] = receipt; s.site.effort[j.partId] = 1; }
    if (s.site.maintenanceEffort) delete s.site.maintenanceEffort[effortKey(j.partId, receipt.operation)];
    s.history.push(receipt);
    j.status = 'completed'; release(j, tools, stacks); return true;
  }
  function cancel(s, j, tools, stacks, now) {
    if (!j || j.status !== 'working') return false;
    j.status = 'cancelled'; s.history.push({ at: now, actorId: j.actorId || 'scientist', kind: 'cancelled', partId: j.partId, operation: j.operation || 'build',
      fraction: j.from + (1 - j.from) * j.progress / j.required });
    release(j, tools, stacks); return true;
  }
  function observe(s, now, report) { if (s.site && report) s.observations = { at: now, ...copy(report) }; }
  function publicView(s) {
    const known = r => !r.actorId || r.actorId === 'scientist' || s?.observations?.parts?.[r.partId]?.at >= r.at;
    return s?.site ? { siteId: s.site.siteId, cityId: s.site.cityId, registeredAt: s.site.registeredAt,
      origin: copy(s.site.layout.origin), observations: s.observations && copy(s.observations),
      receipts: copy(Object.values(s.site.parts).filter(known)), history: copy(s.history.filter(known)),
      limitation: 'Dated supply hut records, not live remote inventory, land title, sovereignty, safety, staffing or transport rights.' } : null;
  }
  return { create, layout, homeSupply, accessReason, register, prerequisite, workPart, maintenanceReason, targetKey, clearChangedEffort, inspectTarget, effort, plan, begin, reason, advance, ready, finish, cancel, observe, publicView };
});
