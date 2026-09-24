(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./local-covert-market') : root.HelixLocalCovertMarket);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Local) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  function quote(local, sh, contact, route, at) {
    if (!sh || sh.living || sh.offsiteCreature || sh.owner !== 'player' || sh.receiptAt !== null || sh.phase !== 'returned'
      || sh.custodian !== `covert-depot:${local.cityId}` || sh.recoveryJobId || !sh.manifest?.entries?.length
      || !['manufactured', 'rawByproduct'].includes(sh.manifest.commodityKind)) return { ok: false, reason: 'No unrecovered player-owned nonliving manifest at the home covert depot.' };
    const check = Local.availability(local, contact, route, sh.cargo);
    if (!check.ok) return check;
    return { ok: true, shipmentId: sh.id, courierId: check.courierId, fingerprint: JSON.stringify(sh.manifest),
      distanceKm: route.distanceKm, fee: Math.ceil(12 + route.distanceKm * .8), expiresAt: at + 3600, travelSeconds: check.travelSeconds };
  }
  function book(local, sh, contact, route, q, wallet, at) {
    const fresh = quote(local, sh, contact, route, at);
    if (!fresh.ok) return fresh;
    if (!q || at > q.expiresAt || ['shipmentId', 'courierId', 'fingerprint', 'distanceKm', 'fee'].some(k => fresh[k] !== q[k])) return { ok: false, reason: 'Recovery quote changed or expired; request another quote.' };
    if (!Number.isFinite(wallet.money) || wallet.money < fresh.fee) return { ok: false, reason: 'Insufficient player funds for the disclosed recovery fee.' };
    const result = Local.book(local, contact, route, `recovery:${sh.id}`, sh.cargo, at);
    if (!result.ok) return result;
    const job = result.collection;
    job.kind = 'depotRecovery'; job.shipmentId = sh.id; job.manifest = sh.manifest; job.fee = fresh.fee; job.feePaidAt = at;
    wallet.money -= fresh.fee; local.couriers.find(c => c.id === job.courierId).money += fresh.fee;
    sh.manifest = null; sh.recoveryJobId = job.id; sh.custodian = job.courierId;
    return { ok: true, job };
  }
  function receive(local, sh, inventory, context, at) {
    const job = local.collections.find(c => c.id === sh?.recoveryJobId);
    const refuse = reason => ({ ok: false, reason });
    if (!job || job.kind !== 'depotRecovery' || job.phase !== 'waiting' || job.reason || !job.manifest || job.receivedAt != null) return refuse('The loaded recovery courier must be waiting at the Concealed Exit.');
    if (!context.scientistPresent) return refuse('The scientist must be able and physically present at the Concealed Exit.');
    const work = copy(inventory), manifest = job.manifest, receipts = [];
    const place = stack => Object.assign(stack, { roomId: context.roomId, cell: copy(context.cell), fixtureId: '', stockpileId: '', containerId: '', carriedBy: '', carryTaskId: '', carryLegIndex: -1, reservedTaskId: '', observedAt: at, updatedAt: at });
    if (manifest.commodityKind === 'manufactured') {
      for (const [i, entry] of manifest.entries.entries()) {
        if (!entry.stack || entry.creature || !Number.isFinite(entry.amount) || !(entry.amount > 0)) return refuse('Invalid nonliving manifest; nothing unloaded.');
        const stack = place(copy(entry.stack));
        if (work.some(s => s.id === stack.id)) stack.id = `recovered:${job.id}:${i}`;
        if (work.some(s => s.id === stack.id)) return refuse('Recovered lot identity conflict; nothing unloaded.');
        stack.quantity = stack.knownQuantity = entry.amount; stack.recoveredFromStackId = entry.sourceStackId || entry.stack.id;
        work.push(stack); receipts.push(stack.id);
      }
    } else if (manifest.commodityKind === 'rawByproduct') {
      for (const entry of manifest.entries) {
        const capacity = context.capacities[entry.itemKey];
        if (!(capacity > 0) || !entry.contents?.length) return refuse('No supported receptacle type for this raw cargo.');
        for (const content of entry.contents) {
          let remaining = content.amount;
          if (!Number.isFinite(remaining) || !(remaining > 0)) return refuse('Invalid raw cargo quantity.');
          while (remaining > 1e-8) {
            const partial = work.find(s => receipts.includes(s.id) && s.key === entry.itemKey && s.contents.reduce((n, c) => n + c.amount, 0) < capacity - 1e-8);
            if (partial) {
              const amount = Math.min(remaining, capacity - partial.contents.reduce((n, c) => n + c.amount, 0));
              partial.contents.push({ ...copy(content), amount }); remaining -= amount; continue;
            }
            const empty = work.find(s => s.section === 'inventory' && s.key === entry.itemKey && s.roomId === context.roomId && !s.carriedBy && !s.reservedTaskId && !s.containerId && !s.contents?.length && s.quantity >= 1);
            if (!empty) return refuse('Bring enough empty compatible unreserved receptacles to the Concealed Exit for the whole manifest. Nothing unloaded.');
            const amount = Math.min(remaining, capacity);
            let filled = empty;
            if (empty.quantity > 1) {
              empty.quantity--; empty.knownQuantity = Math.min(empty.knownQuantity, empty.quantity);
              filled = copy(empty); filled.id = `recovered:${job.id}:raw:${receipts.length}`;
              if (work.some(s => s.id === filled.id)) return refuse('Receptacle identity conflict; nothing unloaded.');
              work.push(filled);
            }
            place(filled); filled.quantity = filled.knownQuantity = 1; filled.form = 'receptacle';
            filled.contents = [{ ...copy(content), amount }]; receipts.push(filled.id); remaining -= amount;
          }
        }
      }
    } else return refuse('Living cargo and remains require separate handling.');
    // Commit only after every entry fits: neither partial cargo nor partial inventory mutation.
    inventory.splice(0, inventory.length, ...work);
    job.manifest = null; job.receivedAt = at; job.receiptStackIds = receipts; job.phase = 'returning'; job.lastAt = at;
    sh.custodian = 'laboratory'; sh.recoveredAt = at; sh.recoveryReceiptStackIds = receipts;
    local.couriers.find(c => c.id === job.courierId).location = 'returning empty after recovery';
    return { ok: true, receiptStackIds: receipts };
  }
  return { quote, book, receive };
});
