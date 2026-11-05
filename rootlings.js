(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRootlings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const total = x => Object.values(x || {}).reduce((n, v) => n + v, 0);
  const DUST = ['cinderling-smoke', 'fuel-smoke', 'mineral-test-dust'];
  const VAPOR = ['chemistry-test-fumes'];
  const SOLUTES = ['spent-assay-solute'];
  const DIRECTIONS = Object.freeze({ air: DUST.concat(VAPOR), liquid: SOLUTES });
  function body() {
    return { planterId: '', filterMode: 'off', rootGuard: true, guideCell: null, rootCell: null, rootLength: 0,
      stemKg: .75, rootKg: .15, reserveKg: .35, mediumOrganicKg: .25, mediumMineralKg: .5,
      mineralBoundKg: 0, respiredKg: 0, materialReceivedKg: 2, prunedKg: 0, discardedMediumKg: 0,
      waterL: 2, waterReceivedL: 2, transpiredL: 0, drainedCareWaterL: 0,
      surfaceLoad: {}, tissueLoad: {}, substrateLoad: {}, capturedEver: {}, removedLoads: {},
      liquid: null, lastFilter: null, lastRootGrowthAt: null };
  }
  function dryMass(a) { return a.stemKg + a.rootKg + a.reserveKg + a.mediumOrganicKg + a.mediumMineralKg + a.mineralBoundKg; }
  function capacity(a, where) { return where === 'surfaceLoad' ? .25 : where === 'substrateLoad' ? .5 * Math.min(1, a.mediumOrganicKg + a.mediumMineralKg) : .2 * (a.stemKg + a.rootKg); }
  function capture(a, sourceAmounts, ids, where, maxAmount) {
    let room = Math.max(0, Math.min(maxAmount, capacity(a, where) - total(a[where]))), moved = 0;
    for (const id of ids) {
      const n = Math.max(0, Math.min(sourceAmounts[id] || 0, room)); if (!n) continue;
      sourceAmounts[id] -= n; a[where][id] = (a[where][id] || 0) + n;
      a.capturedEver[id] = (a.capturedEver[id] || 0) + n; room -= n; moved += n;
    }
    return moved;
  }
  function filterAir(a, environment, volumeM3, contactM3, hours, now) {
    if (!environment || !(volumeM3 > 0)) return 0;
    const loads = Object.fromEntries(Object.entries(environment.airborne || {}).map(([id, c]) => [id, c * volumeM3]));
    const available = Object.fromEntries(Object.entries(loads).map(([id, n]) => [id, n * Math.min(1, contactM3 / volumeM3)]));
    const original = { ...available };
    const moved = capture(a, available, DUST, 'surfaceLoad', hours * .1) + capture(a, available, VAPOR, 'tissueLoad', hours * .05);
    for (const [id, n] of Object.entries(original)) environment.airborne[id] = Math.max(0, (loads[id] - n + available[id]) / volumeM3);
    a.lastFilter = { at: now, mode: 'air', amount: moved, contactM3 }; return moved;
  }
  function filterLiquid(a, hours, now) {
    if (!a.liquid?.waterL) return 0;
    const moved = capture(a, a.liquid.substances, SOLUTES, 'substrateLoad', hours * .1)
      + capture(a, a.liquid.substances, SOLUTES, 'tissueLoad', hours * .05);
    a.lastFilter = { at: now, mode: 'liquid', amount: moved, sourceIds: copy(a.liquid.sourceIds) }; return moved;
  }
  function water(a, amount = 1) {
    if (a.status === 'dead' || !(amount > 0) || a.waterL + amount > 4 + 1e-8) return false;
    a.waterL += amount; a.waterReceivedL += amount; return true;
  }
  function nourish(a) {
    if (a.status === 'dead' || a.mediumOrganicKg + a.mediumMineralKg > 1 + 1e-8) return false;
    a.mediumOrganicKg += .5; a.mediumMineralKg += .5; a.materialReceivedKg += 1; return true;
  }
  function wash(a) {
    const substances = copy(a.surfaceLoad); a.surfaceLoad = {};
    for (const [id, n] of Object.entries(substances)) a.removedLoads[id] = (a.removedLoads[id] || 0) + n;
    return { waterL: 1, substances, sourceIds: [a.id], kind: 'rootling washwater' };
  }
  function replaceMedium(a) {
    const kg = a.mediumOrganicKg + a.mediumMineralKg, substances = copy(a.substrateLoad);
    a.mediumOrganicKg = .5; a.mediumMineralKg = .5; a.materialReceivedKg += 1; a.discardedMediumKg += kg; a.substrateLoad = {};
    for (const [id, n] of Object.entries(substances)) a.removedLoads[id] = (a.removedLoads[id] || 0) + n;
    return { kg, substances, sourceIds: [a.id], kind: 'rootling spent substrate' };
  }
  function prune(a, now, damage) {
    const kg = Math.min(a.rootKg, Math.max(.1, a.rootKg - .15)); if (kg <= 0) return null;
    const fraction = kg / Math.max(.001, a.stemKg + a.rootKg + a.reserveKg), substances = {};
    for (const [id, n] of Object.entries(a.tissueLoad)) {
      substances[id] = n * fraction; a.tissueLoad[id] -= substances[id];
      a.removedLoads[id] = (a.removedLoads[id] || 0) + substances[id];
    }
    a.rootKg -= kg; a.prunedKg += kg; a.rootCell = null; a.rootLength = 0; a.guideCell = null; a.rootGuard = true;
    damage(a, 8, 'Physical root pruning', now);
    return { kg, substances, sourceIds: [a.id], kind: 'rootling contaminated cuttings' };
  }
  function loadLiquid(a, batch) {
    if (!a.planterId || a.liquid || !batch || !(batch.waterL > 0) || batch.waterL > 2) return false;
    a.liquid = copy(batch); return true;
  }
  function drainLiquid(a) { const batch = a.liquid; a.liquid = null; return batch; }
  function step(a, env, seconds, now, hooks) {
    a.independentIntent = ''; if (a.status === 'dead') return;
    const h = seconds / 3600;
    const surfaceFraction = Math.min(1, total(a.surfaceLoad) / .25);
    const lit = (env.light || 0) * (1 - surfaceFraction) >= 20;
    const wet = a.waterL >= .2, nourished = a.mediumMineralKg > 0;
    const vapor = Math.min(a.waterL, h * (.025 + Math.max(0, (env.temperature || 20) - 20) * .002 + (lit ? .025 : 0)));
    a.waterL -= vapor; a.transpiredL += vapor; hooks.transpire?.(a, vapor);
    const uptake = Math.min(a.mediumOrganicKg, h * .02); a.mediumOrganicKg -= uptake; a.reserveKg += uptake;
    const respiration = Math.min(a.reserveKg, h * (lit ? .01 : .03)); a.reserveKg -= respiration; a.respiredKg += respiration;
    const minerals = Math.min(a.mediumMineralKg, h * .001); a.mediumMineralKg -= minerals; a.mineralBoundKg += minerals;
    if (!wet || !nourished || a.reserveKg <= 1e-8 || !lit) hooks.damage(a, h * (!wet ? 8 : !lit ? 3 : 5), 'Unmet botanical water, light or nutrient needs', now);
    if ((env.temperature ?? 20) < 8 || (env.temperature ?? 20) > 40) hooks.damage(a, h * 12, 'Unsafe botanical temperature', now);
    if (a.waterL > 3.5) hooks.damage(a, h * 4, 'Root waterlogging', now);
    if (total(a.tissueLoad) > .15) hooks.damage(a, h * 2, 'Accumulated captured phytotoxic solute', now);
    if (env.hazard) hooks.damage(a, h * 8, 'Unsafe botanical exposure', now);
    if (a.status === 'dead') return;
    if (a.planterId && !a.rootGuard && !a.guideCell && hooks.hasWill(a) && env.moistCell) {
      a.guideCell = copy(env.moistCell); a.independentIntent = 'Directing a root tip toward directly sensed adjacent moisture';
    }
    if (a.planterId && !a.rootGuard && a.guideCell && env.rootPassable && wet && lit && nourished) {
      const grown = Math.max(0, Math.min(.5 - a.rootKg, a.reserveKg, h * .02));
      a.rootKg += grown; a.reserveKg -= grown;
      if (grown > 0) { a.rootCell = copy(a.guideCell); a.rootLength = Math.max(0, Math.min(1, (a.rootKg - .15) / .1)); a.lastRootGrowthAt = now; }
    }
    if (a.planterId && wet && lit && nourished && a.filterMode === 'air' && env.air)
      filterAir(a, env.air, env.volumeM3, h * (env.ventilated ? 1 : .5), h, now);
    if (a.planterId && wet && lit && nourished && a.filterMode === 'liquid') filterLiquid(a, h, now);
  }
  function drainFactor(a, cell) {
    return a.rootCell && cell && a.rootCell.x === cell.x && a.rootCell.y === cell.y && a.rootCell.z === cell.z ? Math.max(.25, 1 - .75 * a.rootLength) : 1;
  }
  return { DUST, VAPOR, SOLUTES, DIRECTIONS, body, dryMass, total, capacity, filterAir, filterLiquid,
    water, nourish, wash, replaceMedium, prune, loadLiquid, drainLiquid, step, drainFactor };
});
