(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-property-review') : root.HelixCargoPropertyReview,
    typeof module === 'object' && module.exports ? require('./cargo-criminal-referrals') : root.HelixCargoCriminalReferrals);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSmugglingCheckpoints = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PropertyReview, Referrals) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const fingerprint = m => JSON.stringify({ commodityKind: m.commodityKind, material: m.material, amount: m.amount,
    entries: m.commodityKind === 'specimen' ? m.entries.map(e => e.creature ? { id: e.creature.id, genome: e.creature.genome, pod: e.transportPodStackId } : { id: e.stack?.id, quality: e.stack?.craftsmanship, amount: e.amount }) : m.entries });
  // A published admission procedure, not a new criminal offense or confiscation power.
  function bind(state, facts) {
    state.checkpoints ||= [];
    for (const f of facts) {
      if (!f.cityId || !f.institutionId || !f.cellId || f.jurisdiction !== 'city') continue;
      if (state.checkpoints.some(g => g.cityId === f.cityId)) continue;
      state.checkpoints.push({ ...copy(f), id: `freight-gate:${f.cityId}`, active: true,
        policy: 'Cargo admission verification: thirty-minute inspection; missing manifest permits at most two further hours of temporary cargo detention. No forfeiture or arrest authority is conferred.',
        officer: { id: `freight-officer:${f.cityId}`, institutionId: f.institutionId, status: 'alive', health: 100 }, assignment: null });
    }
  }
  const pending = sh => ['inspecting', 'detained'].includes(sh.phase);
  function enter(state, sh, op, at) {
    if (sh.inspection || sh.receiptAt !== null || sh.positionKm < sh.distanceKm - 1e-8) return false;
    const gate = state.checkpoints?.find(g => g.cityId === sh.destinationId && g.active && g.jurisdiction === 'city' && g.institutionId && g.officer?.status === 'alive' && g.officer.health >= 50);
    if (!gate) return false;
    // One real officer processes one load; a queue remains carrier custody outside admission.
    sh.inspection = { gateId: gate.id, institutionId: gate.institutionId, institutionName: gate.institutionName,
      cityId: gate.cityId, cellId: gate.cellId, officerId: gate.officer.id, arrivedAt: at, startedAt: null,
      status: 'queued', documents: [], observations: [], vehicleId: op.vehicleId,
      crewIds: op.crew.map(c => c.id), crewDetained: false, vehicleSeized: false, owner: sh.owner,
      policy: gate.policy, reason: 'Waiting for the named admission officer; cargo remains with the carrier.' };
    sh.phase = 'inspecting'; sh.reason = sh.inspection.reason; op.location = gate.id;
    return true;
  }
  function expire(state, sh, at) {
    if (!Number.isFinite(sh.deliveryDeadlineAt) || (at < sh.deliveryDeadlineAt && sh.returnRequestedAt == null) || sh.receiptAt !== null || sh.saleFailedAt != null || ['canceled', 'awaitingCollection', 'returned'].includes(sh.phase)) return false;
    sh.saleFailedAt = sh.returnRequestedAt ?? sh.deliveryDeadlineAt;
    state.buyers.find(b => b.id === sh.buyerId).money += sh.playerEscrow + sh.freightEscrow;
    sh.playerEscrow = sh.freightEscrow = 0;
    if (sh.living) { sh.living.refunded = true; if (!sh.living.outcome) sh.living.outcome = sh.returnRequestedAt != null ? 'returnRequested' : 'deliveryExpired'; }
    if (sh.phase === 'outbound') sh.phase = 'returning';
    sh.reason = 'Delivery deadline expired; unearned sale and transit escrow refunded. Exact cargo remains player property; return requires release and a feasible route.';
    return true;
  }
  function submit(sh, manifestFingerprint, at) {
    if (!pending(sh) || manifestFingerprint !== sh.fingerprint) return false;
    const i = sh.inspection;
    if (i.documents.length) return false;
    i.documents.push({ kind: 'bookedCargoManifest', fingerprint: manifestFingerprint, submittedAt: at,
      scope: 'Identity and quantity only; not a commercial or contraband authorization.' });
    return true;
  }
  function tick(state, sh, op, at) {
    if (!pending(sh)) return false;
    const i = sh.inspection, gate = state.checkpoints.find(g => g.id === i.gateId);
    if (i.startedAt === null) {
      if (!gate?.active || gate.officer.status !== 'alive' || gate.officer.health < 50 || at < (gate.availableAt || 0) || (gate.assignment && gate.assignment !== sh.id)) {
        // A failed sale can turn back from the queue without ever being detained.
        if (sh.saleFailedAt != null) { i.status = 'withdrawn'; i.releasedAt = at; sh.phase = 'returning'; }
        return pending(sh);
      }
      gate.assignment = sh.id; i.startedAt = at; i.reviewAt = at + 1800; i.releaseBy = at + 9000; i.status = 'inspecting';
      i.reason = 'Admission inspection in progress. Cargo remains aboard the identified carrier; no criminal finding.'; sh.reason = i.reason;
      i.observations.push({ at, observerId: gate.officer.id, locationId: gate.id, material: sh.manifest.material,
        amount: sh.manifest.amount, entryIds: sh.manifest.entries.map(e => e.creature?.id || e.stack?.id || e.sourceReceptacleId),
        supports: 'Physical cargo present at gate; no finding about knowledge, origin, unlawful sale or scientist involvement.' });
      i.personObservations = op.crew.some(c => c.status === 'alive' && c.health >= 50) ? [{
        id: `${sh.id}:observed-presenter`, at, observerId: gate.officer.id, locationId: gate.id,
        description: 'Person presenting the cargo with the arriving vehicle; civil identity not checked.',
        conduct: 'Presented cargo for admission inspection, not a witnessed commercial transaction.'
      }] : [];
    }
    if (at < i.reviewAt) return true;
    PropertyReview.issue(gate, sh, at);
    const held = PropertyReview.tick(gate, sh, at);
    Referrals.tick(gate, sh, at, state);
    if (sh.examinationChangedLot && sh.saleFailedAt == null) {
      requestReturn(state, sh, at);
      sh.reason = 'Authorized sampling changed the exact contracted lot; unearned sale/transit escrow refunded. Physical return still awaits release.';
    }
    if (held) return true;
    const matching = i.documents.some(d => d.submittedAt <= at && d.fingerprint === fingerprint(sh.manifest));
    if (matching || at >= i.releaseBy || ['released', 'forfeited'].includes(sh.propertyOrder?.status)) {
      if (fingerprint(sh.manifest) !== sh.fingerprint && !sh.living?.outcome) requestReturn(state, sh, at);
      i.status = 'released'; i.releasedAt = at; i.reason = matching ? 'Manifest verified; no independently supported detention basis.' : 'Temporary verification authority expired; no independently supported seizure order.';
      if (['released', 'forfeited'].includes(sh.propertyOrder?.status)) i.reason = sh.propertyOrder.reason;
      if (gate) { gate.assignment = null; gate.availableAt = at; }
      if (sh.owner === 'player') sh.custodian = op.vehicleId;
      sh.phase = sh.saleFailedAt != null || sh.living?.outcome ? 'returning' : 'outbound'; sh.reason = i.reason;
      return false;
    }
    i.status = 'detained'; sh.phase = 'detained'; sh.custodian = gate.id;
    i.reason = 'Booked cargo manifest outstanding. Temporary cargo custody only; handler retains access to its own finite care kit. Submit existing manifest or await bounded review.';
    sh.reason = i.reason; return true;
  }
  function requestReturn(state, sh, at) {
    if (!pending(sh) || sh.saleFailedAt != null || sh.receiptAt !== null) return false;
    sh.returnRequestedAt = at; expire(state, sh, at);
    sh.reason = 'Sale abandoned by owner; unearned sale/transit escrow refunded. Return awaits cargo release and actual transport.';
    return true;
  }
  return { bind, enter, tick, pending, submit, expire, requestReturn, fingerprint };
});
