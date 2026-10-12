(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./public-works-vacancies') : root.HelixPublicWorksVacancies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixMunicipalCargoRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Vacancies) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const adjacent = (a, b) => Boolean(a && b && a.z === b.z && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const LIMITS = 'Recover this documented city-owned maintenance cargo only. No personal property, body removal, search, confiscation, reserve refund, immunity or automatic repair.';
  function ruleFor(cityId, institutionId) {
    return { id: `${cityId}:retained-maintenance-cargo-law`, method: 'documentedMunicipalCargoRecovery', institutionId,
      role: 'publicWorksAndProvisioning', recordSeconds: 30, collectionSeconds: 60,
      text: 'After completed voluntary-succession death-vacancy transfer, the replacement technician may retrieve only the original deceased official’s documented city-owned uninstalled maintenance cargo. The original clerk records exact authority and source custody through thirty attended seconds and finite power, even when maintenance is overdue. One minute of actual adjacent collection and physical carrying precede a municipal custody receipt. Ordinary repair work remains separate. Personal property and the body are excluded.' };
  }
  function actors(succession) {
    const a = succession?.appointments;
    return { appointment: a, technician: a?.candidate, deceased: succession?.leaders?.find(p => p.id === a?.incumbentId) };
  }
  function supported(u, succession, office, c) {
    const { appointment: a } = actors(succession), law = succession?.source?.maintenanceCargoRecovery;
    return Boolean(u && c && a?.vacancy?.receipt && !u.authorizationId && law
      && same(law, ruleFor(u.cityId, a.institutionId)) && same(law, c.cargoRecoveryRule)
      && Vacancies.authorization(a, succession, u, office, c));
  }
  function source(u, succession) {
    const { appointment: a, deceased: body } = actors(succession), v = a?.vacancy, cargo = body?.civicMaintenanceCargo;
    if (!v?.receipt || body?.status !== 'dead' || body.health !== 0 || !cargo || cargo.key !== 'metalParts'
      || cargo.quantity !== 3 || cargo.cityId !== u.cityId || cargo.custodianId !== body.id
      || !cellSame(cargo.cell, body.mapCell) || !same(cargo, v.receipt.inventory?.deceasedCargo)
      || !Array.isArray(cargo.sourceReceiptIds) || !cargo.sourceReceiptIds.length
      || new Set(cargo.sourceReceiptIds).size !== cargo.sourceReceiptIds.length) return null;
    const matches = v.interruptedDuties.filter(e => e.personId === body.id && cellSame(e.cell, body.mapCell)
      && (cargo.interruptedJobId && e.job?.id === cargo.interruptedJobId
        && e.job.workerId === body.id && e.job.status === 'installing' && e.job.progress >= 0 && e.job.progress < 120
        && e.job.terms?.installationId === u.installation.id && e.job.terms.charterId === u.charterId
        && e.job.terms.handoverId === u.handoverId && e.job.terms.workerId === body.id
        && cargo.sourceId === (e.job.source?.id || e.job.source?.custodianId)
        && (e.job.source?.kind === 'reserve' || e.job.source?.kind === 'stack'
          && succession.directive?.status === 'completed' && succession.directive.receipt?.stackId === e.job.source.id
          && succession.directive.receipt.workerId === body.id)
        && same(cargo, { ...e.job.cargo, interruptedJobId: e.job.id, cell: e.cell })
        || cargo.interruptedDirectiveId && e.directive?.id === cargo.interruptedDirectiveId
        && e.directive.workerId === body.id && e.directive.status === 'carrying'
        && e.directive.key === 'metalParts' && e.directive.quantity === 3
        && succession.directive?.id === e.directive.id && succession.directive.status === 'interruptedByDeath'
        && !succession.directive.cargo && !succession.directive.receipt
        && same(cargo, { ...e.directive.cargo, interruptedDirectiveId: e.directive.id, cell: e.cell })));
    if (matches.length !== 1) return null;
    const receipts = cargo.sourceReceiptIds.map(id => succession.provision.receipts.find(r => r.id === id));
    if (receipts.some(r => !r || r.quantity < 3 || !r.custodianId || !Array.isArray(r.manifest) || !r.manifest.length
      || r.manifest.some(m => m.key !== 'metalParts' || !m.stackId || m.quantity <= 0))) return null;
    return { deceasedId: body.id, cell: copy(body.mapCell), cargo: copy(cargo), interruptedDuty: copy(matches[0]),
      sourceReceipts: copy(receipts), transferId: v.receipt.id, deathId: v.death.id };
  }
  function local(u, succession, office, c) {
    return supported(u, succession, office, c) && c.alive && c.capable && c.atCounter && c.visitPermission
      && c.clerkPresent && c.lineOfSight && c.workerPresent && !c.busy && !c.activeViolence
      && c.cityId === u.cityId && able(office.clerk);
  }
  function free(u, succession, office) {
    const a = succession.appointments;
    return !u.job && !u.cargoRecovery?.job && !u.rests.length && !u.resistance?.job && !office.assignment
      && !office.clerk.assignment && !a.candidate.assignment && !succession.job && !a.job && !a.travel
      && !a.vacancy.job && !a.vacancy.travel && !a.enforcement?.job && a.enforcement?.escort?.status !== 'active'
      && !a.opposition?.job && !a.opposition?.safeguards?.job && !succession.directive?.cargo;
  }
  function note(r, at, kind, message) { r.history.push({ at, kind, message }); r.message = message; }
  function inspect(u, succession, office, c, at) {
    const proof = source(u, succession), a = actors(succession).technician;
    if (!proof || !local(u, succession, office, c) || !free(u, succession, office) || !able(a)
      || !c.recoveryBodyVisible || !adjacent(c.recoveryCollectionCell, proof.cell)
      || c.recoveryCanCarry !== true || u.cargoRecovery?.collection || u.cargoRecovery?.order) return false;
    u.cargoRecovery ||= { id: `${u.id}:retained-cargo-recovery`, inspection: null, order: null, job: null,
      collection: null, receipt: null, consumed: null, history: [], message: '' };
    const r = u.cargoRecovery;
    r.inspection = { at, rule: copy(c.cargoRecoveryRule), proof, workerId: a.id, clerkId: office.clerk.id,
      charterId: u.charterId, bodyEpoch: c.bodyEpoch, installationId: u.installation.id,
      collectionCell: copy(c.recoveryCollectionCell), returnCell: copy(u.installation.workCell), scope: LIMITS };
    note(r, at, 'inspection', 'Identified original city-owned cargo and source manifests; no personal belongings or body disposition included.'); return true;
  }
  function authorize(u, succession, office, expected, c, at) {
    const r = u.cargoRecovery, a = actors(succession).technician;
    if (!r?.inspection || r.order || !same(expected, r.inspection) || !local(u, succession, office, c)
      || !free(u, succession, office) || !same(source(u, succession), r.inspection.proof)
      || !c.recoveryBodyVisible || !adjacent(c.recoveryCollectionCell, r.inspection.proof.cell)
      || !cellSame(c.recoveryCollectionCell, r.inspection.collectionCell) || c.recoveryCanCarry !== true
      || !able(a) || a.locationId !== office.id || a.workSeconds < 90 || office.workSeconds < 30
      || !c.externalPowered || office.power < 1 || at < (office.availableAt || 0)) return false;
    r.job = { id: `${r.id}:work`, phase: 'recording', progress: 0, lastAt: at, wasReady: true, walkCredit: 0, terms: copy(expected) };
    office.assignment = r.job.id; office.clerk.assignment = r.job.id; a.assignment = r.job.id; office.power--;
    note(r, at, 'recording', 'Exact recovery instruction started: thirty attended seconds of finite clerk and technician duty, not an appointment or ordinary service renewal.'); return true;
  }
  function cancel(u, succession, office, c, at) {
    const r = u.cargoRecovery, j = r?.job, a = actors(succession).technician;
    if (!j || j.phase !== 'recording' || !c.alive || !c.atCounter || c.cityId !== u.cityId) return false;
    if (office.assignment === j.id) office.assignment = null;
    if (office.clerk.assignment === j.id) office.clerk.assignment = null;
    if (a?.assignment === j.id) a.assignment = null;
    r.job = null; note(r, at, 'cancelled', 'Unfinished recording ended; spent work and power are not refunded. Cargo remains at the original body.'); return true;
  }
  function lotValid(r, a, stacks, reservation = r?.id) {
    const item = stacks.find(i => i.id === r?.collection?.stackId);
    return item && item.key === 'metalParts' && item.quantity === 3 && item.cityOwnerId === r.order.charterCityId
      && item.carriedBy === a.id && cellSame(item.cell, a.mapCell) && item.reservedTaskId === reservation && !item.fixtureId && !item.containerId && !item.toolInstanceId
      && !item.tags?.includes('contaminated') && same(item.civicCustody, r.collection.custody) ? item : null;
  }
  function advance(u, succession, office, stacks, c, at, effects = {}) {
    const r = u.cargoRecovery, j = r?.job; if (!j || !c.alive || at < j.lastAt) return false;
    const start = j.lastAt, delta = at - start; j.lastAt = at;
    const { technician: a, deceased: body } = actors(succession);
    const original = same(source(u, succession), j.terms.proof);
    const orderCurrent = !r.order || same(r.order.terms, j.terms) && r.order.workerId === a.id
      && office.municipalCargoOrders?.some(e => same(e, r.order));
    const valid = supported(u, succession, office, c) && able(a) && a.locationId === office.id && a.assignment === j.id
      && orderCurrent && !c.activeViolence && c.externalPowered && !u.job && !u.resistance?.job && !u.rests.length
      && !succession.job && a.workSeconds > 0 && (r.collection ? Boolean(lotValid(r, a, stacks)) : original);
    const attended = j.phase !== 'recording' || local(u, succession, office, c) && c.recoveryBodyVisible
      && office.assignment === j.id && office.clerk.assignment === j.id && office.workSeconds > 0;
    if (!valid || !attended) { j.wasReady = false; j.walkCredit = 0; return false; }
    if (!j.wasReady) { j.wasReady = true; return false; }
    let remaining = delta + j.walkCredit, cursor = start - j.walkCredit; j.walkCredit = 0;
    let changed = false;
    while (remaining > 0 && r.job && a.workSeconds > 0) {
      if (j.phase === 'recording') {
        const n = Math.min(remaining, 30 - j.progress, office.workSeconds, a.workSeconds);
        j.progress += n; office.workSeconds -= n; a.workSeconds -= n; remaining -= n; cursor += n;
        if (j.progress < 30) break;
        r.order = { id: `${r.id}:order`, at: cursor, clerkId: office.clerk.id, workerId: a.id,
          charterCityId: u.cityId, terms: copy(j.terms) };
        office.municipalCargoOrders ||= []; office.municipalCargoOrders.push(copy(r.order));
        office.assignment = null; office.clerk.assignment = null; j.phase = 'approaching'; j.progress = 0; changed = true;
      }
      const target = r.collection ? j.terms.returnCell : j.terms.collectionCell;
      if (!cellSame(a.mapCell, target)) {
        if (remaining < 1) { j.walkCredit = remaining; break; }
        if (!effects.move?.(a, target, r.collection && stacks.find(i => i.id === r.collection.stackId))) break;
        a.workSeconds--; remaining--; cursor++; changed = true; continue;
      }
      if (!r.collection) {
        if (!adjacent(a.mapCell, body.mapCell) || c.recoveryCanCarry !== true || c.recoveryContactClear !== true) break;
        j.phase = 'collecting';
        const n = Math.min(remaining, 60 - j.progress, a.workSeconds);
        j.progress += n; a.workSeconds -= n; remaining -= n; cursor += n; changed ||= n > 0;
        if (j.progress < 60) break;
        const custody = { cityId: u.cityId, custodianId: a.id, recoveryId: r.id, orderId: r.order.id,
          deceasedId: body.id, interruptedDutyId: j.terms.proof.cargo.interruptedJobId || j.terms.proof.cargo.interruptedDirectiveId,
          sourceReceiptIds: copy(j.terms.proof.cargo.sourceReceiptIds), originalCargo: copy(j.terms.proof.cargo) };
        const item = effects.collect?.(a, copy(custody), cursor);
        if (!item || item.quantity !== 3 || item.key !== 'metalParts' || item.carriedBy !== a.id
          || item.cityOwnerId !== u.cityId || item.reservedTaskId !== r.id || !same(item.civicCustody, custody)
          || !stacks.includes(item)) break;
        r.collection = { id: `${r.id}:collection`, at: cursor, stackId: item.id, custody, bodyCell: copy(body.mapCell) };
        office.municipalCargoCollections ||= []; office.municipalCargoCollections.push(copy(r.collection));
        body.civicMaintenanceCargo = null; j.phase = 'returning'; j.progress = 0;
        note(r, cursor, 'collection', 'The actual three parts entered the technician’s municipal carrying custody. Original remains, private property, source history and reserve stock are unchanged.'); changed = true;
      } else {
        r.receipt = { id: `${r.id}:returned`, at: cursor, collectionId: r.collection.id, stackId: r.collection.stackId,
          workerId: a.id, installationId: u.installation.id, cell: copy(a.mapCell) };
        office.municipalCargoReturns ||= []; office.municipalCargoReturns.push(copy(r.receipt));
        a.assignment = null; r.job = null;
        note(r, cursor, 'returned', 'Recovered municipal lot physically reached the maintenance post. Original deadlines and spent work remain; a fresh supplied repair is still required.'); changed = true;
      }
    }
    return changed;
  }
  function readyLot(u, succession, office, stacks, c, reservation) {
    const r = u.cargoRecovery, a = actors(succession).technician;
    return supported(u, succession, office, c) && r?.receipt && r.order && r.inspection && r.collection && !r.job && !r.consumed
      && r.order.workerId === a.id && r.order.clerkId === office.clerk.id && same(r.order.terms, r.inspection)
      && r.receipt.workerId === a.id && r.receipt.collectionId === r.collection.id
      && r.receipt.installationId === u.installation.id && cellSame(r.receipt.cell, u.installation.workCell)
      && cellSame(a.mapCell, u.installation.workCell)
      && office.municipalCargoOrders?.some(e => same(e, r.order))
      && office.municipalCargoCollections?.some(e => same(e, r.collection))
      && office.municipalCargoReturns?.some(e => same(e, r.receipt)) ? lotValid(r, a, stacks, reservation || r.id) : null;
  }
  function publicView(r) {
    return r ? { inspection: copy(r.inspection), order: copy(r.order), collection: copy(r.collection), receipt: copy(r.receipt),
      consumed: copy(r.consumed), working: r.job && { phase: r.job.phase, progress: r.job.progress },
      message: r.message, limitations: LIMITS } : null;
  }
  return { ruleFor, supported, source, inspect, authorize, cancel, advance, readyLot, publicView };
});
