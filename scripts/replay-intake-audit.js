// Private synchronous replay observer. Never changes a game account or its rules.
const P = require('../beast-populations'), F = require('../beast-foraging'), Care = require('../beast-parental-care');
const Web = require('../beast-regional-foodweb'), D = require('../beast-demography'), Lantern = require('../carrion-lantern-biology');
const Journeys = require('../beast-seasonal-journeys');
const keys = ['regionalFoodKg', 'regionalWaterL', 'foragedWetTissueKg', 'foragedFoodEquivalentKg', 'foragedCarrionWaterL',
  'atmosphericWaterL', 'careFoodDeliveredKg', 'careWaterDeliveredL', 'instantRemainsKg'];
const copy = x => JSON.parse(JSON.stringify(x));
function observe(account, saved) {
  const species = [...new Set(account.groups.map(g => g.speciesId))].sort();
  const audit = saved ? copy(saved) : { sourceId: account.sourceId, from: account.clock, until: account.clock,
    bySpecies: Object.fromEntries(species.map(id => [id, Object.fromEntries(keys.map(k => [k, 0]))])), unattributedInstantRemainsKg: 0 };
  if (audit.sourceId !== account.sourceId || audit.until !== account.clock || !(audit.from >= 0 && audit.from <= audit.until)
    || !Number.isFinite(audit.unattributedInstantRemainsKg) || audit.unattributedInstantRemainsKg < 0
    || JSON.stringify(Object.keys(audit.bySpecies).sort()) !== JSON.stringify(species)
    || Object.values(audit.bySpecies).some(row => Object.keys(row).length !== keys.length
      || keys.some(k => !Number.isFinite(row[k]) || row[k] < 0))) throw Error('Intake audit does not match this exact checkpoint');
  const tracked = s => (s.accountRoot || s) === account, originals = { integrate: F.integrate, care: Care.integrate, finish: Web.finish };
  F.integrate = function (s, r, g, c, from, to, rate) {
    if (!tracked(s)) return originals.integrate(...arguments);
    const n = P.count(c), days = (to - from) / P.DAY, row = audit.bySpecies[g.speciesId];
    const eaten = r.foraging?.receipts.eatenKg || 0, food = c.stores.foodKg, water = c.stores.waterL;
    const result = originals.integrate(...arguments);
    if (n && days > 0) {
      row.regionalFoodKg += (c.needs.foodKg || 0) * days * (rate.supply[g.resources?.foodKg || 'foodKg'] ?? 0) * (c.intake.foodKg ?? 1);
      row.regionalWaterL += (c.needs.waterL || 0) * days * (rate.supply[g.resources?.waterL || 'waterL'] ?? 0) * (c.intake.waterL ?? 1);
      if (Lantern.is(c)) row.atmosphericWaterL += (c.airIntakeLDay || 0) * (rate.supply.atmosphericWaterL || 0) * days * n;
      const kg = (r.foraging?.receipts.eatenKg || 0) - eaten;
      row.foragedWetTissueKg += kg;
      if (kg > 0) {
        // Eating does not simultaneously regenerate mana or pay maintenance;
        // the integrator pays that maintenance after this actual feeding call.
        row.foragedFoodEquivalentKg += Math.max(0, c.stores.foodKg - food) * n;
        row.foragedCarrionWaterL += Math.max(0, c.stores.waterL - water) * n;
      }
    }
    return result;
  };
  Care.integrate = function (s, q, days) {
    if (!tracked(s)) return originals.care(...arguments);
    const g = q.g || D.group(s, q.groupId), r = D.region(s, Journeys.location(g));
    const beforeFood = r.careReceipts?.givenFoodKg || 0, beforeWater = r.careReceipts?.givenWaterL || 0;
    const result = originals.care(...arguments), row = audit.bySpecies[g.speciesId];
    row.careFoodDeliveredKg += (r.careReceipts?.givenFoodKg || 0) - beforeFood;
    row.careWaterDeliveredL += (r.careReceipts?.givenWaterL || 0) - beforeWater;
    return result;
  };
  Web.finish = function (s) {
    if (!tracked(s) || !s.foodWeb) return originals.finish(...arguments);
    const events = new Set(s.foodWeb.events), consumed = s.foodWeb.receipts.consumedKg;
    const result = originals.finish(...arguments); let attributed = 0;
    for (const e of s.foodWeb.events) if (!events.has(e) && e.kind === 'fedFromRemains') {
      const g = D.group(s, e.groupId); if (!g) continue;
      audit.bySpecies[g.speciesId].instantRemainsKg += e.kg; attributed += e.kg;
    }
    // The engine retains a bounded event ring. Never silently invent attribution
    // if it discarded more instant feeding events than the observer could see.
    audit.unattributedInstantRemainsKg += Math.max(0, s.foodWeb.receipts.consumedKg - consumed - attributed);
    return result;
  };
  return { snapshot() { audit.until = account.clock; return copy(audit); },
    stop() { F.integrate = originals.integrate; Care.integrate = originals.care; Web.finish = originals.finish; } };
}
module.exports = { observe, keys };
