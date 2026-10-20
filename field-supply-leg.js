(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./foreign-escort-hauling') : root.HelixForeignEscortHauling);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldSupplyLeg = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Hauling) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const GOODS = Object.freeze(['trailMeal', 'drinkingWater', 'fuelReagent', 'fieldWaterFilter']);
  const SCOPE = 'One original porter carries one exact load of at most four meal, drinking-water, fuel or purifier-cartridge units from the inspected original station crate to the inspected refuge crate, then returns to the original station work point. This order permits only those exact withdrawals, deposits, disclosed local route and necessary withdrawal. Ten attended seconds per unit at each end; personal provisions are separate. Existing wages, two-hour shift, duty, injuries and employment conditions continue without reset or surcharge. No repeat, purchase, new staff, guard, production, arbitrary storage access or general adjoining resource retrieval. Obstruction retains actual people and goods; carried undelivered cargo is retained for personal handback after defended-ground return. Reports require personal receipt.';
  const active = s => s?.supplyLeg?.status === 'working';
  const eligible = i => Boolean(i && GOODS.includes(i.key) && i.section === (i.key === 'fuelReagent' ? 'resources' : 'inventory')
    && Number.isInteger(i.quantity) && i.quantity > 0 && i.unitMassKg > 0 && i.unitVolumeL > 0
    && !i.cityOwnerId && !i.civicCustody && !i.containerId && !i.chemicalBatch && !i.biology && !i.creature && !i.contents?.length
    && !(i.tags || []).some(t => /toxic|hazard|contaminat|volatile|waste|living|soul/i.test(t)));
  const signature = Hauling.signature;
  function bound(p, c) {
    return p && ['actorId', 'contractId', 'bodyEpoch', 'visitId', 'tripId'].every(k => p[k] === c[k])
      && JSON.stringify(p.source) === JSON.stringify(c.source) && JSON.stringify(p.destination) === JSON.stringify(c.destination)
      && JSON.stringify(p.route) === JSON.stringify(c.route) && same(p.returnCell, c.returnCell);
  }
  function append(s, c, id, now) {
    if (!c.allowed || active(s) || !c.source || !c.destination || !c.route?.length || !Number.isFinite(now)) return false;
    const i = c.source.stock.find(i => i.id === id);
    if (!eligible(i)) return false;
    const p = s.supplyPreview || { actorId: c.actorId, contractId: c.contractId, bodyEpoch: c.bodyEpoch, visitId: c.visitId, tripId: c.tripId,
      source: copy(c.source), destination: copy(c.destination), route: copy(c.route), returnCell: copy(c.returnCell), scope: SCOPE, at: now, rows: [] };
    if (!bound(p, c) || p.rows.length >= 4 || p.rows.filter(r => r.sourceId === id).length >= i.quantity) return false;
    p.rows.push({ sourceId: id, key: i.key, signature: signature(i), sourceQuantity: i.quantity, unitMassKg: i.unitMassKg,
      unitVolumeL: i.unitVolumeL, sourceLabels: copy(i.sourceLabels || []) }); s.supplyPreview = p; return true;
  }
  function accept(s, c, expected, now, h) {
    const p = s.supplyPreview;
    if (!c.allowed || active(s) || !Number.isFinite(now) || !bound(p, c) || JSON.stringify(p) !== JSON.stringify(expected)
      || p.scope !== SCOPE || p.at > now || !p.rows.length || p.rows.length > 4 || !c.originals || !c.sourceOpen || !c.routeOk) return false;
    const kg = p.rows.reduce((n, r) => n + r.unitMassKg, 0), litres = p.rows.reduce((n, r) => n + r.unitVolumeL, 0);
    if (![kg, litres, c.remaining?.massKg, c.remaining?.volumeL, c.destinationCapacity?.massKg, c.destinationCapacity?.volumeL,
      c.budgetSeconds, c.minimumSeconds].every(Number.isFinite) || kg > c.remaining.massKg || litres > c.remaining.volumeL
      || kg > c.destinationCapacity.massKg || litres > c.destinationCapacity.volumeL || c.budgetSeconds < c.minimumSeconds) return false;
    const counts = new Map();
    for (const r of p.rows) {
      const i = h.item(r.sourceId); counts.set(r.sourceId, (counts.get(r.sourceId) || 0) + 1);
      if (!eligible(i) || i.carriedBy || i.reservedTaskId || signature(i) !== r.signature || i.quantity !== r.sourceQuantity
        || i.quantity < counts.get(r.sourceId) || i.fixtureId !== p.source.fixtureId || i.roomId !== p.source.roomId || !same(i.cell, p.source.fixtureCell)) return false;
    }
    const id = `field-supply:${s.contract.id}:${s.next++}`, rows = [];
    for (const r of p.rows) {
      const i = h.reserve(h.item(r.sourceId), id);
      if (!i || i.quantity !== 1 || i.reservedTaskId !== id || signature(i) !== r.signature || rows.some(r => r.stackId === i.id)) {
        if (i?.reservedTaskId === id) h.release(i.id, id);
        for (const row of rows) h.release(row.stackId, id); return false;
      }
      rows.push({ ...copy(r), stackId: i.id, phase: 'reserved' });
    }
    if (s.supplyLeg) (s.supplyHistory ||= []).push(copy(s.supplyLeg));
    s.supplyLeg = { ...copy(p), id, rows, status: 'working', phase: 'load', index: 0, progress: 0, attended: false, lastAt: now,
      acceptedAt: now, reason: '', estimatedSeconds: c.minimumSeconds, massKg: kg, volumeL: litres };
    (s.supplyIssued ||= []).push(copy(s.supplyLeg)); s.supplyPreview = null; return true;
  }
  function stop(s, h, now, reason) {
    if (!active(s)) return false;
    const j = s.supplyLeg;
    for (const r of j.rows.filter(r => r.phase !== 'delivered')) h.release(r.stackId, j.id);
    j.status = 'interrupted'; j.reason = reason; j.endedAt = now; j.attended = false; return true;
  }
  function advance(s, c, h, now) {
    if (!active(s) || !c.alive || !Number.isFinite(now) || now < s.supplyLeg.lastAt) return false;
    const j = s.supplyLeg, dt = now - j.lastAt; j.lastAt = now;
    if (s.actor.id !== j.actorId || s.contract.id !== j.contractId || !h.original(j.source) || !h.original(j.destination))
      return stop(s, h, now, 'Original person, agreement or crate changed; no substitute installation or cargo used.');
    for (const r of j.rows.filter(r => r.phase !== 'delivered')) {
      const i = h.item(r.stackId);
      if (!eligible(i) || i.quantity !== 1 || i.reservedTaskId !== j.id || signature(i) !== r.signature
        || (r.phase === 'carried' ? i.carriedBy !== s.actor.id || i.fixtureId
          : i.carriedBy || i.fixtureId !== j.source.fixtureId || i.roomId !== j.source.roomId || !same(i.cell, j.source.fixtureCell)))
        return stop(s, h, now, 'An exact undelivered portion or its custody changed; no surplus or substitute fetched.');
    }
    if (c.care || c.incapacitated) { j.attended = false; return false; }
    const point = j.phase === 'load' ? j.source.port : j.phase === 'unload' ? j.destination.port : j.returnCell;
    if (!h.at(point)) { j.attended = false; j.reason = h.move(point) ? 'Walking the accepted physical supply route.' : 'Accepted route obstructed; no movement or work backfilled.'; return false; }
    if (j.phase === 'return') { j.status = 'completed'; j.returnedAt = now; j.endedAt = now; j.reason = 'Original porter physically returned to the station work point; employment clock unchanged.'; return true; }
    const mark = j.phase === 'load' ? j.source : j.destination, row = j.rows[j.index];
    if (!h.open(mark) || !h.capacity(j, j.phase)) { j.attended = false; j.reason = 'Original crate access, storage or carrying capacity unavailable; waiting spends the same shift.'; return false; }
    if (!j.attended) { j.attended = true; return false; }
    j.progress = Math.min(10, j.progress + dt); j.reason = '';
    if (j.progress < 10) return false;
    if (!(j.phase === 'load' ? h.pickup(row, j) : h.deposit(row, j))) { j.attended = false; return false; }
    row.phase = j.phase === 'load' ? 'carried' : 'delivered'; row[j.phase === 'load' ? 'loadedAt' : 'deliveredAt'] = now;
    j.progress = 0; j.attended = false;
    if (++j.index === j.rows.length) {
      j.index = 0;
      if (j.phase === 'load') j.phase = 'unload';
      else { j.phase = 'return'; j.deliveredAt = now; }
    }
    return true;
  }
  return { GOODS, SCOPE, active, eligible, signature, append, accept, stop, advance };
});
