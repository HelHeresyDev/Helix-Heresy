(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./foreign-supplies') : root.HelixForeignSupplies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixTradeTripPreparation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Supplies) {
  'use strict';
  const MAX = 6, PASSENGER_KG = 20, PASSENGER_L = 40;
  const WARNING = 'A six-unit sale may not cover travel, admission and handling costs. Future foreign bids are unknown; return is separately paid and never guaranteed. Cargo competes with survival supplies. Nothing is automatically discarded or replenished.';
  function eligible(item, reservationId = '') {
    return Boolean(Supplies.ownedMetalParts(item) && !item.carriedBy && !item.containerId
      && (!item.reservedTaskId || reservationId && item.reservedTaskId === reservationId));
  }
  function manifest(stacks) {
    const items = (stacks || []).filter(i => i.carriedBy === 'scientist' && i.quantity > 0);
    const massKg = items.reduce((n, i) => n + i.quantity * i.unitMassKg, 0), volumeL = items.reduce((n, i) => n + i.quantity * i.unitVolumeL, 0);
    return { massKg, volumeL, passengerRemaining: { massKg: Math.max(0, PASSENGER_KG - massKg), volumeL: Math.max(0, PASSENGER_L - volumeL) },
      fitsPassenger: massKg <= PASSENGER_KG && volumeL <= PASSENGER_L, reserved: items.some(i => i.reservedTaskId),
      metalParts: items.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0),
      items: items.map(i => ({ id: i.id, section: i.section, key: i.key, quantity: i.quantity, massKg: i.quantity * i.unitMassKg,
        volumeL: i.quantity * i.unitVolumeL, reserved: Boolean(i.reservedTaskId), claimed: Boolean(i.cityOwnerId || i.civicCustody || i.carryTaskId) })) };
  }
  function plan(item, quantity, c, reservationId = '') {
    const n = Number(quantity), refuse = reason => ({ ok: false, reason });
    if (!c.atLab || !c.alive || !c.capable || !c.free) return refuse('Packing requires the living, capable scientist physically at the home laboratory and free of custody.');
    if (c.busy) return refuse('Finish or cancel current personal work before packing trade cargo.');
    if (!eligible(item, reservationId) || !c.accessible) return refuse('Choose an exact accessible player-owned, unreserved metal-parts lot; claimed, contained or borrowed goods are excluded.');
    if (!Number.isInteger(n) || n < 1 || n > MAX || n > item.quantity || c.manifest.metalParts + n > MAX) return refuse('Choose one to six available units, with at most six carried metal parts for this preparation.');
    const massKg = n * item.unitMassKg, volumeL = n * item.unitVolumeL;
    if (!Number.isFinite(massKg) || !Number.isFinite(volumeL) || massKg <= 0 || volumeL <= 0) return refuse('Actual cargo dimensions are unavailable.');
    if (!Number.isFinite(c.remaining?.massKg) || !Number.isFinite(c.remaining?.volumeL)
      || massKg > c.remaining.massKg || volumeL > c.remaining.volumeL) return refuse('This exact slice does not fit the actual remaining backpack capacity.');
    if (!Number.isFinite(c.manifest.passengerRemaining.massKg) || !Number.isFinite(c.manifest.passengerRemaining.volumeL)
      || massKg > c.manifest.passengerRemaining.massKg || volumeL > c.manifest.passengerRemaining.volumeL) return refuse('This slice would exceed the published passenger allowance of 20 kg / 40 L.');
    return { ok: true, stackId: item.id, quantity: n, massKg, volumeL, reason: '' };
  }
  return { MAX, PASSENGER_KG, PASSENGER_L, WARNING, eligible, manifest, plan };
});
