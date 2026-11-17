// Fixed-size tissue accounts shared by native corpses and strategic carcass batches.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixCarcassTissues = api;
})(globalThis, function () {
  'use strict';
  const EPS = 1e-8;
  // Initial tuning: fractions of actual animal body mass, not extra resources.
  // food is dry organic matter; minerals and rejected solids are separate.
  const profiles = Object.freeze(Object.fromEntries(Object.entries({
    flesh:       [.60, .10, 1,   .50, .45, .02],
    liver:       [.025,.20, 1,   .30, .65, .02],
    heart:       [.01, .20, 1,   .30, .65, .02],
    brain:       [.015,.20, 1,   .30, .65, .02],
    otherOrgans: [.05, .20, 1,   .30, .65, .02],
    fluids:      [.10, .30, 1,   .10, .85, .03],
    tough:       [.10, .02, .4,  .40, .25, .05],
    hard:        [.10, .005,.1,  .15, .10, .65],
    // Old saves disclose no tissue composition. Preserve their remaining
    // soft-food account and old yields, never recreate already missing bones.
    legacy:      [0,   .10, 1,   .50, .50, 0]
  }).map(([key, [share, decayDay, handling, food, water, minerals]]) =>
    [key, Object.freeze({ share, decayDay, handling, food, water, minerals })])));
  const animalKeys = Object.keys(profiles).filter(k => k !== 'legacy');
  const nonAnimalSpecies = new Set(['beast:ironroot-colossus', 'mudlet', 'cinderling', 'zephyrMote',
    'rootling', 'sporecap', 'hauntbound', 'quartzShardling', 'lanternWisp']);
  const cell = (kg = 0, consumedKg = 0, decomposedKg = 0, reservedKg = 0) =>
    ({ kg, initialKg: kg + consumedKg + decomposedKg, consumedKg, decomposedKg, reservedKg });
  const sum = (r, key) => Object.values(r.tissues).reduce((n, t) => n + t[key], 0);
  function ensure(r) {
    if (!r.tissues) {
      r.consumedKg ||= 0; r.decomposedKg ||= 0;
      r.tissues = { legacy: cell(r.edibleKg || 0, r.consumedKg, r.decomposedKg, r.reservedKg || 0) };
      r.inertKg = Math.max(0, (r.massKg || 0) - (r.edibleKg || 0));
      r.initialEdibleKg ??= sum(r, 'initialKg');
    }
    return r;
  }
  function inertMatter(body) {
    const anatomy = body.life || body.regional || {}, stores = body.life?.stores || body.stores || {};
    return (stores.mineralsKg || 0) + (body.speciesId === 'beast:burrowing-furnace' ? anatomy.armourKg || 0 : 0)
      + (body.speciesId === 'beast:candlecap-myriapod' ? anatomy.energy?.crownKg || 0 : 0);
  }
  function add(r, kg, speciesId, inertKg = 0) {
    if (!Number.isFinite(kg) || kg < 0 || !Number.isFinite(inertKg) || inertKg < 0 || inertKg > kg + EPS)
      throw new Error('Invalid body material partition');
    ensure(r); r.massKg = (r.massKg || 0) + kg;
    if (r.initialMassKg != null) r.initialMassKg += kg;
    if (nonAnimalSpecies.has(speciesId)) { r.inertKg += kg; return; }
    inertKg = Math.min(kg, inertKg); r.inertKg += inertKg;
    for (const key of animalKeys) {
      const t = r.tissues[key] ||= cell(), amount = (kg - inertKg) * profiles[key].share;
      t.kg += amount; t.initialKg += amount;
    }
    r.edibleKg = sum(r, 'kg'); r.initialEdibleKg = sum(r, 'initialKg');
  }
  // An explicit authored diet can name one organ without admitting other
  // organs. Current ordinary meat eaters eat flesh; Lanterns eat all animal
  // classes. This does not give them wood/stone/metal/equipment digestion.
  function diet(actor) {
    const declared = actor?.carrionDiet;
    return Array.isArray(declared) ? declared.filter(k => animalKeys.includes(k) || k === 'legacy')
      : actor?.speciesId === 'beast:carrion-lantern' ? [...animalKeys, 'legacy'] : ['flesh', 'legacy'];
  }
  function available(r, actor) {
    if (!r) return 0;
    if (!r.tissues) return diet(actor).includes('legacy') ? Math.max(0, (r.edibleKg || 0) - (r.reservedKg || 0)) : 0;
    return diet(actor).reduce((n, key) => n + Math.max(0, (r.tissues[key]?.kg || 0) - (r.tissues[key]?.reservedKg || 0)), 0);
  }
  function debit(r, key, consumed, decomposed = 0, reserved = false) {
    ensure(r); const t = r.tissues[key], total = consumed + decomposed;
    if (!t || total < 0 || total > (reserved ? t.reservedKg : t.kg - t.reservedKg) + EPS || total > t.kg + EPS)
      throw new Error('Tissue debit exceeds its finite custody');
    t.kg = Math.max(0, t.kg - total); t.consumedKg += consumed; t.decomposedKg += decomposed;
    if (reserved) { t.reservedKg = Math.max(0, t.reservedKg - total); r.reservedKg = Math.max(0, (r.reservedKg || 0) - total); }
    r.edibleKg = sum(r, 'kg'); r.massKg = Math.max(0, r.massKg - total);
    r.consumedKg += consumed; r.decomposedKg += decomposed;
  }
  function reserve(r, actor, maximum) {
    ensure(r); const claims = [];
    for (const key of diet(actor)) {
      const t = r.tissues[key]; if (!t) continue;
      const kg = Math.min(maximum, Math.max(0, t.kg - t.reservedKg)); if (!(kg > EPS)) continue;
      t.reservedKg += kg; r.reservedKg = (r.reservedKg || 0) + kg;
      claims.push({ tissue: key, kg }); maximum -= kg;
    }
    return claims;
  }
  function release(r, key, kg) {
    ensure(r); const t = r.tissues[key || 'legacy'];
    t.reservedKg = Math.max(0, t.reservedKg - kg); r.reservedKg = Math.max(0, (r.reservedKg || 0) - kg);
  }
  function nutrition(key, kg) {
    const p = profiles[key || 'legacy'];
    return { kg, food: kg * p.food, water: kg * p.water, minerals: kg * p.minerals,
      solids: kg * (1 - p.food - p.water - p.minerals) };
  }
  function take(r, actor, maximum) {
    ensure(r); const result = { kg: 0, food: 0, water: 0, minerals: 0, solids: 0 };
    for (const key of diet(actor)) {
      const t = r.tissues[key]; if (!t) continue;
      const kg = Math.min(maximum * profiles[key].handling, Math.max(0, t.kg - t.reservedKg)); if (!(kg > EPS)) continue;
      debit(r, key, kg); const part = nutrition(key, kg);
      for (const k of Object.keys(result)) result[k] += part[k];
      maximum -= kg / profiles[key].handling;
    }
    return result;
  }
  function decay(r, days) {
    ensure(r); let kg = 0;
    for (const [key, t] of Object.entries(r.tissues)) {
      const amount = Math.max(0, t.kg - t.reservedKg) * -Math.expm1(-profiles[key].decayDay * days);
      debit(r, key, 0, amount); kg += amount;
    }
    return kg;
  }
  function valid(r) {
    if (r.tissues === undefined) return true; // Old accounts remain valid without migration/refill.
    if (!r.tissues || typeof r.tissues !== 'object' || Array.isArray(r.tissues)) return false;
    const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, a, b);
    const animalInitial = animalKeys.reduce((n, key) => n + (r.tissues[key]?.initialKg || 0), 0);
    return Number.isFinite(r.inertKg) && r.inertKg >= 0 && near(r.massKg, r.edibleKg + r.inertKg)
      && animalKeys.every(key => near(r.tissues[key]?.initialKg || 0, animalInitial * profiles[key].share))
      && Object.entries(r.tissues).every(([key, t]) => Object.hasOwn(profiles, key) && t
      && ['kg', 'initialKg', 'consumedKg', 'decomposedKg', 'reservedKg'].every(k => Number.isFinite(t[k]) && t[k] >= 0)
      && t.reservedKg <= t.kg + EPS && near(t.initialKg, t.kg + t.consumedKg + t.decomposedKg))
      && near(r.edibleKg, sum(r, 'kg')) && near(r.initialEdibleKg, sum(r, 'initialKg'))
      && near(r.consumedKg, sum(r, 'consumedKg')) && near(r.decomposedKg, sum(r, 'decomposedKg'))
      && near(r.reservedKg || 0, sum(r, 'reservedKg'));
  }
  return { profiles, animalKeys, ensure, inertMatter, add, diet, available, debit, reserve, release, nutrition, take, decay, valid };
});
