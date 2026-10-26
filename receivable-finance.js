(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./intercity-trade') : root.HelixIntercityTrade);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixReceivableFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Trade) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const TERMS = 'Nonrecourse assignment of one identified funded legal export receivable. The financier advances its own existing money and receives only the agreed first portion of actual proceeds. No interest clock, personal debt, municipal guarantee, seizure right, cargo command, sovereignty or claim on unrelated income is granted. A stranded shipment is not a fabricated loss or completed sale.';
  function sources(map, cityId, definitions) {
    const h = map?.strategicNonStateNetworkHistory, city = map?.strategicPlayableSettlementState?.cityRows?.find(c => c.cityId === cityId);
    if (!h || !city?.assetId || !city.physicalJurisdictionExists || city.physicalCondition === 'ruined' || city.currentPopulation < 32) return [];
    return h.branchRows.filter(b => b.currentCityId === cityId && b.publicPhysicalPresence && !b.consolidatedIntoBranchId
      && b.organizationForm === 'registeredOffice' && b.operationalStatus === 'active' && ['licensed', 'chartered'].includes(b.currentStanding)
      && !['ruined', 'destroyed'].includes(b.physicalCondition) && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand))
      .filter(b => { const n = h.networkRows.find(n => n.networkId === b.networkId), d = definitions?.find(d => d.id === n?.sourceDefinitionId);
        return n?.category === 'commercial' && n.organizationalContinuity && !['defunct', 'dormant'].includes(n.lifecycleStatus) && d?.roles.includes('finance'); })
      .map(b => ({ id: `${b.id}:funded-export-finance`, branchId: b.id, networkId: b.networkId, cityId, populationSourceId: city.assetId, label: b.publicName }));
  }
  const validSource = r => r && ['id', 'branchId', 'networkId', 'cityId', 'populationSourceId', 'label'].every(k => typeof r[k] === 'string' && r[k]);
  function create(rows, binding, cityId, at) {
    if (!Array.isArray(rows) || !rows.every(validSource) || rows.some(r => r.cityId !== cityId) || new Set(rows.map(r => r.id)).size !== rows.length
      || !binding?.worldId || !binding.runId || !Number.isFinite(at) || at < 0) return null;
    return { worldId: binding.worldId, runId: binding.runId, cityId, id: `${cityId}:export-receivable-finance`,
      sources: copy(rows), offer: null, job: null, claims: [], refunds: [], serial: 0, lastAt: at, report: null };
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !s.cityId || !s.id || !Number.isFinite(s.lastAt) || !Array.isArray(s.sources) || !s.sources.every(validSource)
      || s.lastAt < 0 || !Number.isSafeInteger(s.serial) || s.serial < 0
      || s.sources.some(r => r.cityId !== s.cityId) || new Set(s.sources.map(r => r.id)).size !== s.sources.length
      || !Array.isArray(s.claims) || !Array.isArray(s.refunds) || s.claims.some(c => !c || !c.shipmentId)
      || new Set(s.claims.map(c => c.shipmentId)).size !== s.claims.length
      || new Set(s.claims.map(c => c.id)).size !== s.claims.length
      || s.claims.some(c => !c.id || !c.creditorId || !Number.isInteger(c.advance) || c.advance < 1 || c.claimAmount < c.advance
        || !s.sources.some(r => r.id === c.financierSourceId && r.branchId === c.creditorId)
        || ![c.claimAmount, c.originalNet, c.collected, c.heldProceeds].every(n => Number.isFinite(n) && n >= 0)
        || c.claimAmount > c.originalNet || !['active', 'settled'].includes(c.status) || c.heldProceeds > c.collected || c.collected > c.claimAmount
        || c.status === 'active' && c.collected !== 0)
      || s.refunds.some(r => !r || !s.sources.some(s => s.id === r.sourceId) || !Number.isInteger(r.amount) || r.amount < 1)
      || s.job && (!s.job.offer || !Number.isFinite(s.job.progress) || s.job.progress < 0 || s.job.progress > 60 || s.job.reserved !== s.job.offer.advance))
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  function account(s, networks, sourceId, includeLost = false) {
    const r = s?.sources?.find(r => r.id === sourceId), a = networks?.accounts?.find(a => a.id === r?.branchId && (includeLost || !a.lost));
    return bound(s, networks) && a && a.source.hostId === a.id && a.source.cityId === r.cityId
      && a.source.networkId === r.networkId && a.source.populationSourceId === r.populationSourceId ? a : null;
  }
  function contact(s, c) { return Boolean(s && !s.invalid && bound(s, c) && c.alive && c.capable && c.local && c.atCounter && c.clerkPresent
    && c.lineOfSight && c.authorizedSeller && c.cityId === s.cityId && c.channel && !c.otherBusy && !c.violence); }
  function receivable(trade, consignments, id, defs, reservation = '') {
    const sh = trade?.shipments.find(sh => sh.id === id), con = consignments.find(c => c.exportShipmentId === id);
    const op = trade?.operators.find(o => o.id === sh?.operatorId), def = defs.find(d => d.id === sh?.good), m = sh?.cargoManifest || con?.cargoManifest;
    if (!sh || sh.kind !== 'export' || sh.owner !== 'player' || sh.sourceId !== trade.homeId || !sh.collected || sh.failed || sh.delivered || sh.settled
      || sh.receivableAssignment || sh.receivableReservation && sh.receivableReservation.id !== reservation
      || !con || !['inTransit', 'awaitingExport'].includes(con.status) || con.direction !== 'outbound' || con.id !== sh.consignmentId
      || !op || op.shipment !== sh.id || op.vehicleId !== sh.vehicleId || !trade.neighbors.some(n => n.id === sh.destinationId)
      || !m || m.id !== sh.stackId || m.quantity !== sh.quantity || m.cityOwnerId || m.civicCustody
      || m.legalOwnerId && !['player', 'scientist'].includes(m.legalOwnerId) || m.ownerId && !['player', 'scientist'].includes(m.ownerId)
      || !Trade.exportLot(def, m, sh.quantity, m.reservedTaskId || '') || con.total !== sh.playerEscrow || !(sh.playerEscrow > 1)
      || JSON.stringify({ id: m.id, section: m.section, key: m.key, batch: m.chemicalBatch || null }) !== sh.fingerprint) return null;
    return { shipmentId: sh.id, consignmentId: con.id, sourceId: sh.sourceId, destinationId: sh.destinationId, operatorId: sh.operatorId,
      vehicleId: sh.vehicleId, good: sh.good, quantity: sh.quantity, fingerprint: sh.fingerprint, originalNet: sh.playerEscrow, bookedAt: sh.bookedAt };
  }
  function quote(s, networks, trade, consignments, defs, c, sourceId, shipmentId, advance, at) {
    const a = account(s, networks, sourceId), r = receivable(trade, consignments, shipmentId, defs);
    if (!contact(s, c) || s.job || !a || !r || trade.homeId !== s.cityId || s.claims.some(cl => cl.shipmentId === shipmentId)
      || !a.source.charter.scope.includes('ownDiscretionaryFinance') || !Number.isSafeInteger(advance) || advance < 1
      || advance > Math.floor(Math.min(a.money, r.originalNet * .6))) return null;
    const discount = Math.max(1, Math.ceil(advance * .1));
    s.offer = { ...r, id: `${s.id}:offer:${++s.serial}`, financierSourceId: sourceId, creditorId: a.id, creditorCharterId: a.source.charter.id,
      advance, discount, claimAmount: advance + discount, bodyEpoch: c.bodyEpoch, at, expiresAt: at + 600, terms: TERMS };
    return copy(s.offer);
  }
  function begin(s, networks, trade, consignments, defs, c, expected, at) {
    const q = s?.offer, a = q && account(s, networks, q.financierSourceId), r = q && receivable(trade, consignments, q.shipmentId, defs);
    if (!contact(s, c) || s.job || !q || JSON.stringify(q) !== JSON.stringify(expected) || at > q.expiresAt || q.bodyEpoch !== c.bodyEpoch
      || !a || !r || Object.keys(r).some(k => JSON.stringify(r[k]) !== JSON.stringify(q[k])) || a.money < q.advance
      || a.source.charter.id !== q.creditorCharterId || !a.source.charter.scope.includes('ownDiscretionaryFinance')
      || a.operator.status !== 'alive' || a.operator.assignment || a.operator.workSeconds < 60 || a.terminal.powerSeconds < 60
      || c.counterAssignment || c.counterClerkAssignment || c.counterWork < 60 || c.counterPower < 1) return false;
    const id = `${s.id}:acceptance:${++s.serial}`;
    s.job = { id, offer: copy(q), at, progress: 0, reserved: q.advance, cell: copy(c.cell), officeId: c.officeId, bodyEpoch: c.bodyEpoch };
    a.money -= q.advance; a.operator.assignment = id;
    trade.shipments.find(sh => sh.id === q.shipmentId).receivableReservation = { id, financeId: s.id };
    return true;
  }
  function release(s, networks, trade, at) {
    const j = s?.job; if (!j) return false;
    const a = account(s, networks, j.offer.financierSourceId, true), sh = trade?.shipments.find(sh => sh.id === j.offer.shipmentId);
    if (a) { a.money += j.reserved; if (a.operator.assignment === j.id) a.operator.assignment = null; }
    else s.refunds.push({ sourceId: j.offer.financierSourceId, amount: j.reserved, at });
    if (sh?.receivableReservation?.id === j.id) delete sh.receivableReservation;
    s.job = null; s.offer = null; return true;
  }
  function advance(s, networks, trade, consignments, defs, context, to, h) {
    if (!s || s.invalid || !h.alive() || to <= s.lastAt) return false;
    for (const r of s.refunds.filter(r => !r.returnedAt)) {
      const a = account(s, networks, r.sourceId, true);
      if (a) { a.money += r.amount; r.returnedAt = to; }
    }
    for (const cl of s.claims.filter(cl => cl.heldProceeds > 0)) {
      const a = account(s, networks, cl.financierSourceId, true);
      if (a) {
        a.money += cl.heldProceeds; a.income ||= []; a.income.push({ id: cl.id, at: to, purpose: 'receivableSettlement', amount: cl.heldProceeds,
          returnedAdvance: Math.min(cl.heldProceeds, cl.advance), discountIncome: Math.max(0, cl.heldProceeds - cl.advance) });
        cl.heldProceeds = 0;
      }
    }
    if (!s.job) { s.lastAt = to; return false; }
    while (s.lastAt < to && s.job && h.alive()) {
      const at = s.lastAt + Math.min(1, to - s.lastAt), dt = at - s.lastAt; s.lastAt = at;
      const j = s.job, q = j.offer, c = context(), a = account(s, networks, q.financierSourceId);
      const r = receivable(trade, consignments, q.shipmentId, defs, j.id);
      if (!contact(s, c) || c.bodyEpoch !== j.bodyEpoch || c.officeId !== j.officeId || !['x', 'y', 'z'].every(k => c.cell[k] === j.cell[k])
        || !r || !a || Object.keys(r).some(k => JSON.stringify(r[k]) !== JSON.stringify(q[k]))
        || a.operator.assignment !== j.id || a.operator.status !== 'alive' || a.operator.workSeconds < dt || a.terminal.powerSeconds < dt
        || !a.source.charter.scope.includes('ownDiscretionaryFinance') || a.source.charter.id !== q.creditorCharterId
        || c.counterWork < dt || !j.counterPowerPaid && c.counterPower < 1 || c.counterAssignment && c.counterAssignment !== j.id
        || c.counterClerkAssignment && c.counterClerkAssignment !== j.id) {
        release(s, networks, trade, at); h.releaseCounter?.(j.id); continue;
      }
      if (a.operator.lastOperatingWorkAt >= at) continue;
      if (c.communicate && !c.communicate({ purpose: 'receivableFinance', sessionId: j.id, sequence: Math.ceil(j.progress + dt),
        fromCityId: s.cityId, toCityId: s.cityId, civicCityIds: [s.cityId], signer: 'branch', senderId: a.id, charterId: a.source.charter.id }, at)) {
        j.hold = 'Awaiting the supported authenticated path; no advance has been paid.'; continue;
      }
      delete j.hold;
      a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; a.operator.lastOperatingWorkAt = at;
      h.counterWork(dt, j.id, !j.counterPowerPaid); j.counterPowerPaid = true; j.progress += dt;
      if (j.progress >= 60) {
        const sh = trade.shipments.find(sh => sh.id === q.shipmentId);
        const cl = { ...copy(q), id: `${s.id}:claim:${++s.serial}`, acceptedAt: at, status: 'active', heldProceeds: 0, collected: 0 };
        sh.receivableAssignment = { id: cl.id, financeId: s.id, creditorId: a.id, claimAmount: q.claimAmount, originalNet: q.originalNet };
        delete sh.receivableReservation;
        s.claims.push(cl); c.wallet.money += q.advance; a.operator.assignment = null;
        s.job = null; s.offer = null; h.releaseCounter?.(j.id); h.advanced?.(cl);
        receive(s, c, at);
      }
    }
    if (!s.job) s.lastAt = to;
    register(s, networks); return true;
  }
  function settle(s, networks, trade, shipmentId, at) {
    const sh = trade?.shipments.find(sh => sh.id === shipmentId), cl = s && !s.invalid && s.claims.find(cl => cl.shipmentId === shipmentId);
    if (!bound(s, networks) || !cl || trade?.homeId !== s.cityId || sh?.sourceId !== s.cityId || cl.status !== 'active'
      || sh?.receivableAssignment?.id !== cl.id || sh.receivableAssignment.financeId !== s.id
      || !sh.delivered || sh.settled || sh.playerEscrow !== cl.originalNet || sh.fingerprint !== cl.fingerprint) return null;
    const total = Trade.settleExport(trade, shipmentId, cl.id);
    if (total !== cl.originalNet) return null;
    const assigned = Math.min(total, cl.claimAmount), a = account(s, networks, cl.financierSourceId, true);
    if (a) {
      a.money += assigned; a.income ||= []; a.income.push({ id: cl.id, at, purpose: 'receivableSettlement', amount: assigned,
        returnedAdvance: Math.min(assigned, cl.advance), discountIncome: Math.max(0, assigned - cl.advance) });
    } else cl.heldProceeds = assigned;
    cl.status = 'settled'; cl.settledAt = at; cl.collected = assigned; cl.discountEarned = Math.max(0, assigned - cl.advance);
    return { total, seller: total - assigned, assigned, advance: cl.advance, discount: cl.discountEarned, claimId: cl.id };
  }
  function receive(s, c, at) {
    if (!contact(s, c) || s.job) return false;
    s.report = { at, terms: TERMS, claims: s.claims.map(cl => ({ id: cl.id, shipmentId: cl.shipmentId,
      financier: s.sources.find(r => r.id === cl.financierSourceId)?.label, acceptedAt: cl.acceptedAt, advance: cl.advance,
      claimAmount: cl.claimAmount, discount: cl.discount, status: cl.status, settledAt: cl.settledAt ?? null, collected: cl.collected })) };
    return true;
  }
  function register(s, networks) {
    if (!s || s.invalid || !bound(s, networks)) return;
    for (const r of s.sources) {
      const a = account(s, networks, r.id); if (!a) continue;
      let ref = a.allocations.find(ref => ref.id === r.id);
      if (!ref) a.allocations.push(ref = { id: r.id, kind: 'exportReceivableFinance', ownerAccountId: a.id,
        scope: 'Existing office capital and assigned export receivables only; not total institutional wealth or civic sovereignty.' });
      ref.claimIds = s.claims.filter(cl => cl.financierSourceId === r.id).map(cl => cl.id);
      ref.assignment = s.job?.offer.financierSourceId === r.id ? s.job.id : null;
    }
  }
  return { TERMS, bound, sources, create, normalize, rebind, account, receivable, quote, begin, release, advance, settle, receive, register,
    active: s => Boolean(s && !s.invalid && s.job), publicView: s => copy(s?.report) };
});
