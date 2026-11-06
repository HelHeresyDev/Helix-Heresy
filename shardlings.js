(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixShardlings = api;
})(globalThis, function () {
  'use strict';
  const MATERIALS = Object.freeze({ quartz: Object.freeze({ name: 'Quartz Shardling', resource: 'quartz',
    senseTiles: 6, movementSeconds: 300, biteKgPerHour: .01, maxBodyKg: 2 }) });
  const EDIBLE = new Set(['quartz', 'stone', 'granite', 'limestone', 'shale', 'basalt', 'mineralSalts']);
  const copy = x => JSON.parse(JSON.stringify(x));
  const total = m => Object.values(m || {}).reduce((n, v) => n + v, 0);
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  function body(material = 'quartz') {
    if (!MATERIALS[material]) return null;
    return { material, bodyKg: 1, missingKg: 0, materialReceivedKg: 1, reserveHours: 48,
      consumedMaterials: {}, spentMaterials: {}, brokenKg: 0, removedKg: 0, grownKg: 0, repairedKg: 0,
      biteBudgetKg: 0, moveProgress: 0, digProgress: 0, lastSenseAt: -1800, sensed: null, carryStackId: '',
      order: null, orderHistory: [], assistedSourceId: '', mode: 'contained', explored: {}, foodSources: [] };
  }
  function quartzAt(seed, cell, stratumId) {
    // Independent of old iron/copper/hazard rolls; no change to archived strategic worlds.
    let hash = 2166136261;
    const text = `${seed}:quartz:${Math.floor(cell.x / 4)},${Math.floor(cell.y / 4)},${cell.z}`;
    for (const c of text) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) % 100 < 12 ? 10 : stratumId === 'granite' ? .1 : 0;
  }
  function instruction(a, enabled, receipt, at, hasWill) {
    if (a.status === 'dead' || hasWill || !receipt?.taskId || !receipt.touch) return false;
    const order = { kind: enabled ? 'prospect-and-feed' : 'stop', at, taskId: receipt.taskId, channel: 'physical-core-contact' };
    a.orderHistory.push(order); a.order = enabled ? copy(order) : null;
    a.sensed = null; a.lastSenseAt = -1800; a.digProgress = 0; a.moveProgress = 0;
    return true;
  }
  function sense(a, candidates) {
    return candidates.filter(c => c.material === a.material && c.kg >= .001 && c.cell.z === a.mapCell.z
      && distance(a.mapCell, c.cell) <= MATERIALS[a.material].senseTiles)
      .sort((x, y) => y.kg / (1 + distance(a.mapCell, y.cell)) ** 2 - x.kg / (1 + distance(a.mapCell, x.cell)) ** 2
        || String(x.id).localeCompare(String(y.id)))[0] || null;
  }
  function eat(a, batch, at) {
    const amount = total(batch?.materials);
    if (a.status === 'dead' || !(amount > 0) || amount > a.biteBudgetKg + 1e-8 || Object.keys(batch.materials).some(k => !EDIBLE.has(k))) return false;
    const own = batch.materials[a.material] || 0, assimilated = Math.min(own * .25, MATERIALS[a.material].maxBodyKg - a.bodyKg);
    const repaired = Math.min(a.missingKg, assimilated);
    a.bodyKg += assimilated; a.missingKg -= repaired; a.repairedKg += repaired; a.grownKg += assimilated - repaired;
    a.health = Math.min(100, a.health + repaired * 500);
    a.reserveHours = Math.min(72, a.reserveHours + amount * 400);
    a.materialReceivedKg += amount; a.biteBudgetKg -= amount;
    for (const [k, kg] of Object.entries(batch.materials)) {
      a.consumedMaterials[k] = (a.consumedMaterials[k] || 0) + kg;
      a.spentMaterials[k] = (a.spentMaterials[k] || 0) + kg - (k === a.material ? assimilated : 0);
    }
    a.foodSources.push({ at, kg: amount, sourceIds: [...(batch.sourceIds || [])] });
    if (a.foodSources.length > 100) {
      const old = a.foodSources.shift(); a.archivedFoodKg = (a.archivedFoodKg || 0) + old.kg;
      a.archivedSourceIds = [...new Set([...(a.archivedSourceIds || []), ...old.sourceIds])];
    }
    return true;
  }
  function damage(a, amount, cause, at) {
    if (!a || a.status === 'dead' || !(amount > 0)) return false;
    const fracture = Math.min(a.bodyKg, amount * .002);
    a.bodyKg -= fracture; a.missingKg += fracture; a.brokenKg += fracture;
    a.health = Math.max(0, a.health - amount);
    a.injuries.push({ at, cause, amount, fracturedKg: fracture });
    if (!a.health) { a.status = 'dead'; a.diedAt = at; a.independentIntent = ''; a.order = null; }
    return true;
  }
  function collect(a) {
    const materials = Object.fromEntries(Object.entries(a.spentMaterials).map(([k, kg]) => [k, Math.floor((kg + 1e-9) * 1000) / 1000]));
    const brokenKg = Math.floor((a.brokenKg + 1e-9) * 1000) / 1000;
    const out = { materials, brokenMaterial: a.material, brokenKg };
    a.removedKg += total(materials) + brokenKg;
    for (const [k, kg] of Object.entries(materials)) a.spentMaterials[k] -= kg;
    a.brokenKg -= brokenKg; return out;
  }
  function step(a, env, seconds, at, hooks) {
    if (a.status === 'dead') return;
    const definition = MATERIALS[a.material], active = hooks.hasWill(a) || a.order?.kind === 'prospect-and-feed';
    const hours = seconds / 3600;
    a.reserveHours = Math.max(0, a.reserveHours - hours);
    if (env.temperature > 180 || env.temperature < -50) damage(a, hours * 8, 'Extreme mineral thermal shock', at);
    if (!a.reserveHours) damage(a, hours * 2, 'Mineral starvation; no unordered self-feeding', at);
    if (a.status === 'dead') return;
    a.biteBudgetKg = Math.min(.01, a.biteBudgetKg + hours * definition.biteKgPerHour);
    if (active || a.assistedSourceId) {
      const request = Math.floor((a.biteBudgetKg + 1e-9) * 1000) / 1000;
      if (request >= .001) {
        const meal = hooks.takeFood(a, request, active);
        if (meal) eat(a, meal, at);
      }
    }
    if (!active || a.chamberId || a.carryStackId) { a.mode = a.chamberId || a.carryStackId ? 'contained' : 'unordered'; a.independentIntent = ''; return; }
    if (at - a.lastSenseAt >= 1800 || !a.sensed || distance(a.mapCell, a.sensed.cell) > definition.senseTiles || !hooks.sourceExists(a.sensed)) {
      a.sensed = copy(sense(a, hooks.sense(a))); a.lastSenseAt = at;
    }
    if (a.sensed && distance(a.mapCell, a.sensed.cell) <= 1) {
      a.mode = 'feeding-at-source'; a.independentIntent = hooks.hasWill(a) ? 'Slowly consuming sensed growth mineral' : '';
      hooks.expose?.(a, a.sensed); return;
    }
    const next = hooks.next(a, a.sensed?.cell || null);
    if (!next) { a.mode = 'blocked'; return; }
    if (next.dig) {
      a.mode = a.sensed ? 'digging-toward-mineral' : 'exploratory-digging'; a.digProgress += seconds;
      if (a.digProgress >= 600) { hooks.dig(a, next.cell, a.digProgress); a.digProgress = 0; }
    } else {
      a.mode = a.sensed ? 'approaching-mineral' : 'exploring'; a.moveProgress += seconds;
      if (a.moveProgress >= definition.movementSeconds && hooks.move(a, next.cell)) { a.moveProgress -= definition.movementSeconds;
        const key = `${next.cell.x},${next.cell.y},${next.cell.z}`; a.explored[key] = (a.explored[key] || 0) + 1; }
    }
    a.independentIntent = hooks.hasWill(a) ? a.mode : '';
  }
  return { MATERIALS, EDIBLE, body, quartzAt, instruction, sense, eat, damage, collect, step, total, distance };
});
