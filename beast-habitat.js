(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./creature-biology') : root.HelixCreatureBiology);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixBeastHabitat = api;
})(globalThis, function (Data) {
  'use strict';
  const DAY = 86400, positive = n => Number.isFinite(n) && n >= 0;
  const key = c => `${c.x},${c.y},${c.z}`;
  // Shared physical daily work recipes; regional cohorts and local bodies use
  // the same costs/outputs. These are not automatic disposition bonuses.
  const WORK = {
    rootStabilize: { costs: { waterL: 600, mineralsKg: 120, organicKg: 30 }, outputs: { rootedBiomassKg: 150, atmosphericWaterL: 600 }, channels: ['soilCover', 'freshwaterQuality', 'renewableBiomass'] },
    tendWetland: { costs: { detritusKg: .1 }, outputs: { plantNutrientsKg: .1 }, channels: ['soilCover', 'freshwaterQuality', 'wetlandReefHabitat'] },
    cultivateReef: { costs: { calciumKg: 20, organicKg: 5 }, outputs: { livingReefKg: 25 }, channels: ['wetlandReefHabitat', 'renewableBiomass', 'freshwaterQuality'] },
    buildDam: { costs: { constructionKg: 100 }, outputs: { damKg: 100 }, channels: ['freshwaterQuantity', 'freshwaterQuality', 'wetlandReefHabitat'] },
    growBlooms: { costs: { carrionKg: 2, waterL: 1 }, outputs: { bloomKg: 2, waterInPlantsKg: 1 }, channels: ['soilCover', 'renewableBiomass', 'wetlandReefHabitat'] },
    buildFurnace: { costs: { metalKg: .00002, fuelKg: .00002 }, outputs: { furnaceKg: .00004 }, channels: ['soilCover', 'renewableBiomass'] },
    dreamWeather: { costs: { atmosphericWaterL: 1000 }, outputs: { waterL: 1000 }, channels: ['soilCover', 'freshwaterQuantity', 'wetlandReefHabitat'] }
  };
  const workSpec = kind => WORK[kind] ? JSON.parse(JSON.stringify(WORK[kind])) : null;
  const FILTER = {
    filterMana: { costs: {}, outputs: {}, channels: ['arcaneStability'] },
    filterPlankton: { costs: {}, outputs: {}, channels: ['wetlandReefHabitat', 'renewableBiomass'] }
  };
  const filterSpec = kind => FILTER[kind] ? JSON.parse(JSON.stringify(FILTER[kind])) : null;
  function patch(p, c, tileM = 1) {
    if (!p || p.known === false) return null;
    p.resources ||= {};
    p.transfers ||= {};
    // This is the original volume of an actual water column, not a new spring.
    const waterKey = p.waterKind === 'seawater' ? 'seawaterL' : 'waterL';
    if (p.waterDepthM > 0 && !p.waterAccounted) {
      p.resources[waterKey] = p.waterDepthM * tileM * tileM * 1000;
      p.waterAccounted = true;
    }
    if (p.waterAccounted) p.waterDepthM = (p.resources[waterKey] || 0) / (tileM * tileM * 1000);
    return p;
  }
  function has(p, costs) {
    return Boolean(p && Object.entries(costs).every(([k, n]) => positive(n) && positive(p.resources?.[k]) && p.resources[k] + 1e-10 >= n));
  }
  function take(p, costs) {
    if (!has(p, costs)) return false;
    for (const [k, n] of Object.entries(costs)) { p.resources[k] = Math.max(0, p.resources[k] - n); p.transfers[k] = (p.transfers[k] || 0) - n; }
    return true;
  }
  function put(p, amounts) {
    for (const [k, n] of Object.entries(amounts)) {
      if (!positive(n)) throw Error('Invalid physical habitat transfer');
      p.resources[k] = (p.resources[k] || 0) + n;
      p.transfers[k] = (p.transfers[k] || 0) + n;
    }
  }
  function fraction(p, costs) {
    return Math.min(1, ...Object.entries(costs).filter(([, n]) => n > 0).map(([k, n]) => Math.max(0, (p.resources[k] || 0) / n)));
  }
  function receipt(p, a, kind, at, detail) {
    p.events ||= []; p.events.push({ id: `${a.id}:${kind}:${at}:${p.events.length}`, actorId: a.id, kind, at, ...detail });
    if (p.events.length > 128) p.events.splice(0, p.events.length - 128);
    return p.events[p.events.length - 1];
  }
  function ledger(p, a, seconds, factor, channels, kind) {
    const r = Data.rates[a.speciesId || a.family], result = {};
    if (!r || !(p.areaHa > 0) || !p.condition) return result;
    for (const name of channels) {
      const i = Data.ledgers.findIndex(([id]) => id === name);
      if (i < 0 || !positive(p.condition[name])) continue;
      const amount = (r.nurturing[i] - r.destruction[i]) * seconds / DAY * factor;
      const before = p.condition[name];
      p.condition[name] = Math.max(0, Math.min(100, before + amount / p.areaHa));
      result[name] = (p.condition[name] - before) * p.areaHa;
    }
    p.performed ||= {}; p.performed[kind] = (p.performed[kind] || 0) + seconds * factor;
    return result;
  }
  function burn(p, a, kg, at, native) {
    if (!(kg > 0) || p.oxygen === false || p.waterDepthM > .1 || p.wetness > .8 || !take(p, { fuelKg: kg })) return false;
    const heatMJ = kg * 18;
    put(p, { ashKg: kg * .1, airborneCarbonKg: kg * .9 });
    p.heatMJ = (p.heatMJ || 0) + heatMJ;
    p.temperatureC = (p.temperatureC ?? 20) + heatMJ / Math.max(.0048, p.heatCapacityMJPerC || .0048);
    native?.({ kind: 'heat', heatMJ, smokeKg: kg * .9 });
    receipt(p, a, 'combustion', at, { kg, heatMJ }); return true;
  }
  function freeze(p, a, kg, at, native) {
    if (!(kg > 0) || !take(p, { waterL: kg })) return false;
    p.iceKg = (p.iceKg || 0) + kg;
    p.iceDensityKgM3 = 900; p.iceThicknessM = p.iceKg / (900 * (p.tileAreaM2 || 1));
    p.iceAt = at; p.iceLastAt = at;
    native?.({ kind: 'cold', heatMJ: -kg * .334 });
    receipt(p, a, 'temporaryIce', at, { kg }); return true;
  }
  function thaw(p, at, native) {
    if (!(p.iceKg > 0) || !(at > p.iceLastAt) || !(p.temperatureC > 0)) return 0;
    const capacity = Math.max(.0048, p.heatCapacityMJPerC || .0048), elapsed = at - p.iceLastAt;
    const kg = Math.min(p.iceKg, p.temperatureC * capacity / .334, elapsed * .01);
    p.iceKg -= kg; put(p, { waterL: kg }); p.temperatureC -= kg * .334 / capacity;
    p.iceThicknessM = p.iceKg / (900 * (p.tileAreaM2 || 1)); p.iceLastAt = at;
    native?.({ kind: 'cold', heatMJ: -kg * .334 }); return kg;
  }
  // Each effect is capped by actually contacting stock and paid work. Initial
  // daily EP coefficients are ceilings, not an independent second resource.
  function advanceBlooms(p, at) {
    const elapsed = Math.max(0, at - (p.bloomLastAt ?? at)); p.bloomLastAt = at;
    if (!(p.resources.bloomKg > 0) || p.oxygen === false || p.seasonSuitable === false) { p.bloomLit = false; return; }
    const used = p.resources.bloomKg * -Math.expm1(-elapsed / DAY * .01);
    if (used > 0 && take(p, { bloomKg: used })) { put(p, { airborneCarbonKg: used }); p.bloomLit = true; }
  }
  function work(a, kind, seconds, at, ctx) {
    const p = ctx.patch?.(a.mapCell); if (!p || p.protected || !(seconds > 0)) return null;
    const massScale = Math.min(1, (a.bodyPhysics?.massKg || 0) / (Data.lifecycle[a.speciesId]?.adultKg || Infinity));
    const scale = massScale * Math.max(0, ctx.healthFactor ?? 1), d = seconds / DAY * scale;
    const spec = workSpec(kind); if (!spec) return null;
    let costs = Object.fromEntries(Object.entries(spec.costs).map(([k, n]) => [k, n * d]));
    let outputs = Object.fromEntries(Object.entries(spec.outputs).map(([k, n]) => [k, n * d]));
    const channels = spec.channels; let factor = 1;
    if (kind === 'rootStabilize') {
      if (a.bodyPhysics.mode !== 'rooting' || p.vitrifiedKg > 0 && !(p.resources.soilSeedKg > 0)) return null;
    } else if (kind === 'tendWetland') {
      if (!(p.waterDepthM > 0) || !(p.resources.wetlandBedKg > 0)) return null;
    } else if (kind === 'cultivateReef') {
      if (!(p.waterDepthM > 0) || !(p.resources.livingReefKg > 0)) return null;
    } else if (kind === 'buildDam') {
      const downstream = p.downstream && ctx.patch(p.downstream);
      if (!downstream || !(p.resources.flowWaterL > 0)) return null;
      const water = Math.min(p.resources.flowWaterL, d * 1000);
      // Retention moves actual flow; it is NOT additional water creation.
      costs.flowWaterL = water; outputs.waterL = water;
    } else if (kind === 'growBlooms') {
      if (!(p.resources.bloomKg > 0) || p.seasonSuitable === false) return null;
    } else if (kind === 'buildFurnace') {
      if (!a.life?.colonyId || p.oxygen === false || p.waterDepthM > .1) return null;
    } else if (kind === 'dreamWeather') {
      if (!ctx.dreamParticipants?.length || ctx.dreamParticipants.some(t => !t.sleeping || !t.consent)) return null;
    } else return null;
    factor = fraction(p, costs); if (!(factor > 0)) return null;
    for (const k of Object.keys(costs)) costs[k] *= factor;
    for (const k of Object.keys(outputs)) outputs[k] *= factor;
    if (!take(p, costs)) return null;
    put(p, outputs);
    if (kind === 'rootStabilize') p.supportKg = (p.supportKg || 0) + outputs.rootedBiomassKg * 2;
    if (kind === 'cultivateReef') p.reefHeightM = (p.reefHeightM || 0) + outputs.livingReefKg / 2000;
    if (kind === 'buildDam') {
      p.damHeightM = (p.damHeightM || 0) + outputs.damKg / 2000;
      const attenuation = Math.exp(-outputs.damKg / 1000);
      p.current = { x: (p.current?.x || 0) * attenuation, y: (p.current?.y || 0) * attenuation };
      if (p.resources.waterL > (p.bankCapacityL ?? Infinity)) {
        const spill = p.resources.waterL - p.bankCapacityL, downstream = ctx.patch(p.downstream);
        take(p, { waterL: spill }); put(downstream, { waterL: spill }); downstream.floodedL = (downstream.floodedL || 0) + spill;
        if (downstream.condition?.soilCover > 0) downstream.condition.soilCover = Math.max(0, downstream.condition.soilCover - spill / 10000);
      }
    }
    if (kind === 'dreamWeather') p.weatherStress = Math.max(0, (p.weatherStress || 0) - d * factor);
    const points = ledger(p, a, seconds, scale * factor, channels, kind);
    ctx.changed?.(a.mapCell, p);
    return receipt(p, a, kind, at, { seconds: seconds * factor, costs, outputs, points });
  }
  function thermal(a, kind, amount, at, ctx) {
    const p = ctx.patch?.(a.mapCell); if (!p || p.protected || !(amount > 0)) return null;
    if (kind === 'hornVitrify') {
      const kg = Math.min(p.materialKg || 0, amount / 1.2);
      if (!(kg > 0) || !(p.densityKgM3 > 0)) return null;
      p.materialKg -= kg; p.vitrifiedKg = (p.vitrifiedKg || 0) + kg;
      if (p.condition?.soilCover > 0) p.condition.soilCover = Math.max(0, p.condition.soilCover - kg / Math.max(1, (p.areaHa || 1) * 100));
    } else if (kind === 'hotTunnel') {
      if (!(p.soilDepthM > 0) || p.oxygen === false || p.foundation) return null;
      const gas = Math.min(p.resources?.geologicalGasKg || 0, amount / 100);
      if (gas > 0 && take(p, { geologicalGasKg: gas })) put(p, { airborneGasKg: gas });
      if (positive(p.supportKg)) { p.supportKg = Math.max(0, p.supportKg - amount * 100); if (!p.supportKg) { p.floor = false; p.collapsed = true; } }
    } else return null;
    p.heatMJ = (p.heatMJ || 0) + amount;
    ctx.native?.(a.mapCell, { kind: 'heat', heatMJ: amount }); ctx.changed?.(a.mapCell, p);
    return receipt(p, a, kind, at, { heatMJ: amount });
  }
  return { DAY, key, workSpec, filterSpec, patch, has, take, put, fraction, ledger, receipt, burn, freeze, thaw, advanceBlooms, work, thermal };
});
