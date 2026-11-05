(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSporecaps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const total = x => Object.values(x || {}).reduce((n, v) => n + v, 0);
  const SPORES = 'sporecap-spores';
  function body() {
    return { planterId: '', capKg: .3, myceliumKg: .2, reserveKg: .5, feedKg: 1, spentKg: 0,
      materialReceivedKg: 2, digestedKg: 0, respiredKg: 0, discardedSpentKg: 0,
      emittedSporeKg: 0, washedSporeKg: 0, pendingSporeKg: 0, coverSporeKg: 0,
      coverFitted: false, coverReceipt: null, covered: false, gillsClosed: false,
      waterL: 1, waterReceivedL: 1, evaporatedL: 0,
      feedLoads: {}, tissueLoads: {}, spentLoads: {}, removedLoads: {}, feedSources: [] };
  }
  function dryMass(a) { return a.capKg + a.myceliumKg + a.reserveKg + a.feedKg + a.spentKg + a.pendingSporeKg + a.coverSporeKg; }
  function feed(a, batch) {
    if (a.status === 'dead' || !batch || !(batch.kg > 0) || a.feedKg + batch.kg > 2 + 1e-8) return false;
    a.feedKg += batch.kg; a.materialReceivedKg += batch.kg;
    for (const [id, n] of Object.entries(batch.substances || {})) a.feedLoads[id] = (a.feedLoads[id] || 0) + n;
    a.feedSources.push(copy(batch)); return true;
  }
  function water(a) {
    if (a.status === 'dead' || a.waterL > 1 + 1e-8) return false;
    a.waterL += 1; a.waterReceivedL += 1; return true;
  }
  function wash(a) {
    const kg = a.coverSporeKg; a.coverSporeKg = 0; a.washedSporeKg += kg;
    if (a.coverFitted) a.covered = true;
    return { waterL: 1, substances: { [SPORES]: kg * 1000 }, sourceIds: [a.id], kind: 'sporecap cover washwater' };
  }
  function collectSpent(a) {
    const kg = Math.floor((a.spentKg + 1e-12) * 1000) / 1000;
    if (!(kg > 0)) return null;
    const fraction = kg / a.spentKg;
    const output = { kg, substances: Object.fromEntries(Object.entries(a.spentLoads).map(([id, n]) => [id, n * fraction])), sourceIds: [a.id, ...a.feedSources.flatMap(b => b.sourceIds)], kind: 'sporecap spent compost' };
    a.discardedSpentKg += kg; a.spentKg -= kg;
    for (const [id, n] of Object.entries(output.substances)) a.spentLoads[id] -= n;
    for (const [id, n] of Object.entries(output.substances)) a.removedLoads[id] = (a.removedLoads[id] || 0) + n;
    return output;
  }
  function step(a, env, seconds, now, hooks) {
    a.independentIntent = ''; if (a.status === 'dead') return;
    const h = seconds / 3600, wet = a.waterL >= .1, temperature = env.temperature ?? 20;
    const vapor = Math.min(a.waterL, h * (.02 + Math.max(0, temperature - 25) * .003 + (env.humidity < 35 ? .02 : 0)));
    a.waterL -= vapor; a.evaporatedL += vapor; hooks.transpire?.(a, vapor);
    a.gillsClosed = Boolean(hooks.hasWill(a) && env.disturbed);
    if (a.gillsClosed) a.independentIntent = 'Closing gills against directly sensed local disturbance';
    if (wet && temperature >= 8 && temperature <= 35) {
      const oldFeed = a.feedKg, used = Math.min(oldFeed, h * .05, Math.max(0, 2 - a.spentKg) * 4);
      if (used > 0) {
        a.feedKg -= used; a.digestedKg += used; a.reserveKg += used * .25; a.spentKg += used * .25; a.respiredKg += used * .5;
        for (const [id, n] of Object.entries(a.feedLoads)) {
          const moved = n * used / oldFeed; a.feedLoads[id] -= moved;
          a.tissueLoads[id] = (a.tissueLoads[id] || 0) + moved * .25;
          a.spentLoads[id] = (a.spentLoads[id] || 0) + moved * .75;
        }
      }
      const respiration = Math.min(a.reserveKg, h * .01); a.reserveKg -= respiration; a.respiredKg += respiration;
      if (!a.gillsClosed && (!a.covered || a.coverSporeKg < .02)) {
        const produced = Math.min(a.reserveKg, h * .005, a.covered ? .02 - a.coverSporeKg : Infinity);
        a.reserveKg -= produced;
        if (a.covered) a.coverSporeKg += produced;
        else {
          a.pendingSporeKg += produced;
          // Deposited stock is measured in grams to 0.001 g. Keep finer material
          // in the same body instead of rounding it out of existence.
          const emitted = Math.floor((a.pendingSporeKg + 1e-12) * 1e6) / 1e6;
          if (emitted > 0 && hooks.emitSpores?.(a, emitted)) { a.pendingSporeKg -= emitted; a.emittedSporeKg += emitted; }
        }
      }
    }
    if (!wet || a.reserveKg <= 1e-8) hooks.damage(a, h * 8, 'Unmet fungal water or organic reserves', now);
    if (temperature < 8 || temperature > 35) hooks.damage(a, h * 12, 'Unsafe fungal temperature', now);
    if (a.waterL > 1.75) hooks.damage(a, h * 4, 'Waterlogged mycelial substrate', now);
    if (total(a.tissueLoads) > .05) hooks.damage(a, h * 8, 'Retained pollutants injure the same fungus', now);
    if (env.hazard) hooks.damage(a, h * 8, 'Unsafe fungal exposure', now);
  }
  return { SPORES, body, dryMass, total, feed, water, wash, collectSpent, step };
});
