// Shared biological tuning and conservative matter transfers, not a new species.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./creature-biology') : root.HelixCreatureBiology);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixCarrionLanternBiology = api;
})(globalThis, function (Data) {
  'use strict';
  const ID = 'beast:carrion-lantern', DAY = 86400, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const is = c => c?.speciesId === ID;
  const profile = () => Data.lifecycle[ID];
  const foodFraction = () => 1 - profile().carrionWaterFraction - .05;
  const mealPerDay = () => profile().mealKg * DAY / 600;
  const waterCapacity = mass => Math.min(mass * .1, profile().waterLDay * profile().waterReserveDays);
  function airRate(mass, parts, env) {
    if (!Number.isFinite(env?.humidity) || !Number.isFinite(env?.temperatureC) || env.exposed === false) return 0;
    return profile().airWaterLDay * (mass / profile().adultKg) ** (2 / 3)
      * clamp((env.humidity - 20) / 50, 0, 1) * clamp((env.temperatureC + 5) / 25, 0, 1)
      * clamp((parts?.membrane ?? 0) / 100, 0, 1);
  }
  function partition(kg, waterRoom) {
    const water = Math.min(kg * profile().carrionWaterFraction, Math.max(0, waterRoom));
    return { food: kg * foodFraction(), light: kg * .05, water, wasteWater: kg * profile().carrionWaterFraction - water };
  }
  const active = a => ['seekCarrion', 'approachCarrion', 'feed', 'feeding'].includes(a.life?.activity);
  // A narrow compatibility projection for source proposals captured before the
  // approved correction. It does not refill or migrate an existing run body.
  function legacyLifecycle() {
    const lifecycle = Object.fromEntries(Object.entries(Data.lifecycle).map(([id, value]) => {
      const p = { ...value }; delete p.airWaterLDay; delete p.carrionWaterFraction; return [id, p];
    })), p = { ...profile() };
    delete p.airWaterLDay; delete p.carrionWaterFraction;
    Object.assign(p, { foodKgDay: 1.5, waterLDay: .3, foodReserveDays: 5, waterReserveDays: 2, travelMultiplier: 1.5, mealKg: 0,
      diet: 'Actual carrion', shelter: 'Real carrion access, intact bladder and tolerable wind',
      notes: 'Travel is a wind-dependent reference, never guaranteed directed flight. Corpse-light spends actual carrion-derived substrate; no ghosts, soul feeding or resurrection.' });
    lifecycle[ID] = p; return lifecycle;
  }
  return { ID, is, profile, foodFraction, mealPerDay, waterCapacity, airRate, partition, active, legacyLifecycle };
});
