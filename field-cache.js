(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPE = 'fieldCache', KEY = 'fieldCacheFinished', MASS = 4, VOLUME = 8;
  const SECONDS = Object.freeze({ deploy: 60, pack: 60, put: 10, take: 10, recover: 20 });
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const BINDING = ['worldId', 'siteId', 'roomId', 'bodyEpoch', 'visitId', 'tripId'];
  function safe(i) {
    return Boolean(i && ['resources', 'inventory'].includes(i.section) && Number.isInteger(i.quantity) && i.quantity > 0
      && !i.cityOwnerId && !i.civicCustody && !i.creature && !i.biology && !i.chemicalBatch && !i.contents?.length
      && !(i.tags || []).some(t => /living|soul|toxic|hazard|contaminat|volatile|waste/i.test(t)));
  }
  const signature = i => JSON.stringify([i.id, i.section, i.key, i.unitMassKg, i.unitVolumeL,
    i.productionBillId, i.productionWorkpieceId, i.materialComposition, i.craftsmanship, i.sourceLabels, i.tags]);
  function source(i, f, claim = '') {
    return Boolean(safe(i) && i.key === KEY && i.quantity === 1 && i.carriedBy === 'scientist'
      && !i.fixtureId && !i.containerId && (!i.reservedTaskId || i.reservedTaskId === claim)
      && f?.id && f.fixtureTypeId === TYPE && f.physicalStackId === i.id
      && (f.condition == null || f.condition > 0)
      && i.productionBillId && f.productionBillId === i.productionBillId && (!f.reservedOrderId || f.reservedOrderId === claim));
  }
  function binding(c) { return Object.fromEntries(BINDING.map(k => [k, c[k]])); }
  function current(j, c) { return BINDING.every(k => j[k] === c[k]); }
  function reason(c) {
    if (!c.alive || !c.capable || !c.originalBody || c.custody || !c.local) return 'Use the original free capable body on personally reached wilderness ground.';
    if (c.busy || c.threatened) return 'Finish other work and reach safe working conditions first.';
    return '';
  }
  function frame(r, f) {
    return Boolean(r && !r.packed && f && f.id === r.fixtureId && f.typeId === TYPE
      && f.installedAt === r.installedAt && same(f.origin, r.cell));
  }
  function observe(r, f, items, at, canInspectContents) {
    const previous = r.lastInspection;
    r.lastInspection = { at, condition: r.packed ? r.packedCondition : frame(r, f) ? f.condition : null,
      state: r.packed ? 'packed personally' : !frame(r, f) ? 'original frame missing' : f.condition <= 0 ? 'broken' : f.accessState,
      ...(canInspectContents ? { contentsAt: at, contents: items.filter(i => i.fixtureId === r.fixtureId && !i.carriedBy && i.quantity > 0)
        .map(i => ({ id: i.id, key: i.key, quantity: i.quantity, section: i.section })) }
        : previous?.contents ? { contentsAt: previous.contentsAt, contents: copy(previous.contents) } : {}) };
    return r.lastInspection;
  }
  function publicView(records) {
    return copy(records.map(r => ({ id: r.fixtureId, worldId: r.worldId, siteId: r.siteId,
      cell: r.cell, port: r.port, deployedAt: r.installedAt, lastInspection: r.lastInspection || null })));
  }
  function advance(j, now, ready, alive = true) {
    if (!alive || !Number.isFinite(now) || now < j.lastAt) return;
    if (ready && j.wasReady) j.progress = Math.min(j.required, j.progress + now - j.lastAt);
    j.lastAt = now; j.wasReady = ready;
  }
  return { TYPE, KEY, MASS, VOLUME, SECONDS, safe, signature, source, binding, current, reason, frame, observe, publicView, advance };
});
