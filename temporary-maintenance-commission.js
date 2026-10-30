(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixTemporaryMaintenanceCommission = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  function service(standing = false) {
  const KEY = standing ? 'maintenanceDeputy' : 'temporaryMaintenance';
  const RULE_CONTEXT = standing ? 'maintenanceDeputyRule' : 'temporaryMaintenanceRule';
  const REVIEW_REGISTER = standing ? 'maintenanceDeputyReviews' : 'temporaryMaintenanceReviews';
  const ACCEPT_REGISTER = standing ? 'maintenanceDeputyAppointments' : 'temporaryMaintenanceCommissions';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const ROLE = 'publicWorksAndProvisioning', RECEIVING = { x: 16, y: 12, z: 6 };
  const LIMITS = standing
    ? 'Standing deputy for supplied upkeep of this existing municipal counter during the living incumbent’s bodily maintenance incapacity only. Repeated repairs need actual supplies and finite work, not another appointment hearing. No removal, promotion, emergency, police, military, wider public-works or government powers; no new staff, stock, health, immunity or ambition completion. Resignation, revocation, withdrawal or the incumbent’s recovery/death ends acting authority and requires physical cargo return and handback.'
    : 'One supplied counter repair, not an appointment or removal. The living incumbent retains office, rights, faith, cases and agreements. No personal property, injured-carrier cargo, force, immunity, healed injuries or new supplies.';
  function ruleFor(cityId, institutionId, reviewInstitutionId) {
    if (standing) return { id: `${cityId}:standing-maintenance-deputy-law`, method: 'reviewedStandingMaintenanceDeputy', institutionId,
      reviewInstitutionId, role: ROLE, minimumMaintenance: 40, durationSeconds: null, repairs: null, scope: LIMITS,
      text: 'After actual voluntary sovereign handover, observed bodily maintenance incapacity of the living separate public-works incumbent permits one independent review and explicit appointment of the existing qualified consenting municipal technician as standing counter-maintenance deputy. The incumbent retains office; only supplied counter upkeep is delegated. Authority ends on recovery, death, resignation, revocation or actual withdrawal; carrying and handback remain physical, and death supplies no automatic promotion. No renewal hearing per repair, automatic resource reset or other office powers.' };
    return { id: `${cityId}:temporary-maintenance-law`, method: 'reviewedInjuryMaintenanceCommission', institutionId,
      reviewInstitutionId, role: ROLE, minimumMaintenance: 40, durationSeconds: 86400, repairs: 1,
      text: 'After voluntary sovereign handover, personally observed bodily incapacity of the living separate public-works official permits independent review of one qualified consenting existing technician for one supplied counter repair. The official remains in office. Finite attended emergency recording is possible during overdue maintenance. One-day authority expires without renewal; collected city cargo must physically return, not install after expiry. Absence, dissent and exhaustion are not bodily incapacity.' };
  }
  const people = (u, succession) => ({ a: succession?.appointments, technician: succession?.appointments?.candidate,
    incumbent: succession?.leaders?.find(a => a.id === u?.workerId),
    reviewer: succession?.leaders?.find(a => a.id === succession?.appointments?.reviewerId) });
  const injured = p => p?.status === 'alive' && p.health > 0 && p.health < 50;
  const validRecord = r => !standing || r && Array.isArray(r.repairs) && Array.isArray(r.history)
    && (!r.proposal || r.proposal.homeCell && ['x', 'y', 'z'].every(k => Number.isFinite(r.proposal.homeCell[k])));
  function supported(u, succession, office, c) {
    const { a, incumbent, reviewer } = people(u, succession), law = succession?.source?.[KEY];
    const other = standing ? u?.temporaryMaintenance : u?.maintenanceDeputy;
    return Boolean(u && a && !u.authorizationId && !u.appointmentId && !a.receipt && !a.vacancy && !a.appointment
      && !other?.job && !(other?.commission && !other.ended) && (standing || !a.candidate?.maintenanceDeputyId)
      && law && same(law, ruleFor(u.cityId, incumbent?.institutionId, reviewer?.institutionId)) && same(law, c[RULE_CONTEXT])
      && same(c.appointmentOffice, { id: incumbent?.institutionId, roles: [ROLE], appointmentMethod: 'appointmentBySovereignAuthority' })
      && same(incumbent?.roles, [ROLE]) && reviewer?.roles.includes('civicReview') && reviewer.id !== incumbent.id
      && reviewer.id !== a.candidate?.id && a.incumbentId === incumbent.id && a.institutionId === incumbent.institutionId
      && a.reviewerInstitutionId === reviewer.institutionId && a.charterId === u.charterId && a.installationId === u.installation.id
      && succession.source.cityId === u.cityId && succession.source.charterId === u.charterId
      && succession.handover?.id === u.handoverId && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === c.bodyEpoch && succession.agreements.some(r => r.personId === incumbent.id)
      && office?.id === u.officeId && office.cityId === u.cityId && office.active && office.clerk?.id === u.clerkId
      && cellSame(office.civicCounter?.cell, u.installation.cell) && c.charterCurrent && c.administrationAvailable
      && c.publicWorksAvailable && c.geometryAvailable);
  }
  function local(u, succession, office, c) {
    return supported(u, succession, office, c) && c.alive && c.capable && c.atCounter && c.visitPermission
      && c.clerkPresent && c.lineOfSight && !c.busy && !c.activeViolence && c.cityId === u.cityId;
  }
  function free(u, succession, office) {
    const a = succession.appointments;
    return !u.job && !u.cargoRecovery?.job && !u.rests.length && !u.resistance?.job && !succession.job
      && !['ordered', 'carrying'].includes(succession.directive?.status) && !office.assignment && !office.clerk.assignment
      && !a.job && !a.travel && !a.candidate?.assignment && !a.enforcement?.job && !a.enforcement?.escort
      && !a.opposition?.job && !a.opposition?.safeguards?.job;
  }
  function note(r, at, kind, text) { r.history.push({ at, kind, text }); r.message = text; }
  function observedRecord(u, succession, office) {
    const r = u[KEY], p = people(u, succession).incumbent;
    return r?.observation?.personId === p?.id && r.observation.status === 'alive'
      && r.observation.health > 0 && r.observation.health < 50 && r.observation.observerId === 'scientist'
      && r.observation.recorderId === office.clerk.id
      && office.maintenanceIncapacityRecords?.some(e => same(e, r.observation));
  }
  const recordCurrent = (u, succession, office) => injured(people(u, succession).incumbent) && observedRecord(u, succession, office);
  function eligible(u, succession) {
    const { a, technician: t } = people(u, succession);
    return Boolean(t && t.populationSourceId === a.populationSourceId && a.populationSourceId === succession.source.populationSourceId
      && t.credential?.populationSourceId === t.populationSourceId && t.credential.issuerInstitutionId === a.institutionId
      && Number.isFinite(t.credential.maintenance) && t.credential.maintenance >= 40 && !t.roles.length
      && (standing && u[KEY]?.commission ? t.maintenanceDeputyId === u[KEY].commission.id : !t.maintenanceDeputyId && t.appointmentPolicy === 'considerExactDuties'));
  }
  function participants(u, succession, office, kind) {
    const p = people(u, succession);
    return [office.clerk, ...(kind === 'observe' ? [] : [p.technician]), ...(kind === 'review' ? [p.reviewer] : [])];
  }
  function attended(u, succession, office, c, kind, jobId = null) {
    return participants(u, succession, office, kind).every(a => able(a) && a.locationId === office.id
      && c.commissionPresentIds?.includes(a.id) && (!a.assignment || a.assignment === jobId));
  }
  function begin(u, succession, office, c, at, kind, seconds, terms = null) {
    const r = u[KEY];
    if (!local(u, succession, office, c) || !free(u, succession, office) || r.job
      || !attended(u, succession, office, c, kind) || !c.externalPowered || office.power < 1
      || office.workSeconds < seconds || at < (office.availableAt || 0)
      || participants(u, succession, office, kind).some(a => a !== office.clerk && a.workSeconds < seconds)) return false;
    r.job = { id: `${r.id}:${kind}`, kind, progress: 0, seconds, lastAt: at, wasReady: true, terms: copy(terms) };
    office.power--; office.assignment = r.job.id;
    for (const a of participants(u, succession, office, kind)) a.assignment = r.job.id;
    note(r, at, kind, `Finite attended ${standing ? 'standing-deputy' : 'temporary-maintenance'} proceedings started; no vacancy or ordinary service restoration.`); return true;
  }
  function observe(u, succession, office, c, at) {
    const p = people(u, succession).incumbent;
    if (u[KEY] || !local(u, succession, office, c) || !free(u, succession, office)
      || !injured(p) || !c.commissionInjuryVisible) return false;
    u[KEY] = { id: `${u.id}:${standing ? 'maintenance-deputy' : 'temporary-maintenance'}`, observation: null, proposal: null, review: null,
      offer: null, commission: null, inspection: null, job: null, collection: null, receipt: null, returned: null,
      ended: null, history: [], message: '', ...(standing ? { repairs: [], handback: null } : {}) };
    if (begin(u, succession, office, c, at, 'observe', 30, { personId: p.id, status: p.status,
      health: p.health, cell: copy(p.mapCell), recorderId: office.clerk.id, observerId: 'scientist' })) return true;
    delete u[KEY]; return false;
  }
  function propose(u, succession, office, institutions, expected, c, at) {
    const r = u[KEY], p = people(u, succession);
    if (!r?.observation || r.proposal || !same(expected, r.observation) || !recordCurrent(u, succession, office)
      || !local(u, succession, office, c) || !free(u, succession, office) || r.job
      || !attended(u, succession, office, c, 'review') || !c.reviewAvailable || !c.externalPowered
      || office.workSeconds < 30 || p.technician.workSeconds < 30 || institutions?.cityId !== u.cityId
      || institutions.roles['civic-review'] !== p.reviewer.institutionId) return false;
    const id = `${r.id}:review`, readyAt = Institutions.reserve(institutions, 'civic-review', id, at);
    if (readyAt == null) return false;
    office.workSeconds -= 30; p.technician.workSeconds -= 30;
    r.proposal = { id: `${r.id}:proposal`, at, observation: copy(r.observation), candidateId: p.technician.id,
      credential: copy(p.technician.credential), rule: copy(c[RULE_CONTEXT]), handoverId: u.handoverId,
      charterId: u.charterId, installationId: u.installation.id, bodyEpoch: c.bodyEpoch, scope: LIMITS,
      ...(standing ? { homeCell: copy(p.technician.mapCell) } : {}) };
    r.review = { id, readyAt, status: 'queued', reviewerId: p.reviewer.id };
    note(r, at, 'filed', 'One exact injury-cover proposal entered the existing independent queue. The original officeholder is not removed.'); return true;
  }
  function hear(u, succession, office, institutions, c, at) {
    const r = u[KEY], p = people(u, succession), queued = institutions?.offices[p.reviewer?.institutionId]?.jobs[r?.review?.id];
    return Boolean(r?.review?.status === 'queued' && recordCurrent(u, succession, office) && c.reviewAvailable
      && institutions?.cityId === u.cityId && institutions.roles['civic-review'] === p.reviewer.institutionId
      && institutions.offices[p.reviewer.institutionId]?.available && queued?.readyAt === r.review.readyAt
      && at >= r.review.readyAt && begin(u, succession, office, c, at, 'review', 180));
  }
  function sign(u, succession, office, expected, c, at) {
    const r = u[KEY];
    return Boolean(r?.offer && !r.commission && !r.ended && r.review?.outcome === 'eligible'
      && same(expected, r.offer) && at < r.offer.expiresAt && recordCurrent(u, succession, office)
      && same(r.offer.proposal, r.proposal) && same(r.offer.review, r.review)
      && office[REVIEW_REGISTER]?.some(e => same(e, r.review))
      && eligible(u, succession) && same(people(u, succession).technician.credential, r.proposal.credential)
      && begin(u, succession, office, c, at, 'sign', 60, expected));
  }
  function authentic(u, succession, office, c, withdrawal = false) {
    const r = u[KEY], t = people(u, succession).technician;
    const returning = standing && withdrawal && r?.ended;
    const originalDesk = u.officeId === office?.id && office.cityId === u.cityId && office.clerk?.id === u.clerkId
      && cellSame(office.civicCounter?.cell, u.installation.cell);
    return Boolean(validRecord(r) && (returning ? originalDesk : supported(u, succession, office, c)) && (!standing || returning
      || t?.appointmentPolicy === 'considerExactDuties' && t?.maintenanceDeputyResignation?.appointmentId !== r?.commission?.id)
      && r?.commission && r.proposal && r.review?.outcome === 'eligible'
      && r.commission.workerId === t.id && same(r.commission.terms, r.offer) && r.offer.proposalId === r.proposal.id
      && observedRecord(u, succession, office) && same(r.proposal.observation, r.observation)
      && same(r.offer.proposal, r.proposal) && same(r.offer.review, r.review)
      && (returning || same(r.proposal.rule, c[RULE_CONTEXT]) && r.proposal.bodyEpoch === c.bodyEpoch)
      && r.proposal.handoverId === u.handoverId && (returning || same(t.credential, r.proposal.credential) && eligible(u, succession))
      && (!standing || t.maintenanceDeputyId === r.commission.id) && office[REVIEW_REGISTER]?.some(e => same(e, r.review))
      && office[ACCEPT_REGISTER]?.some(e => same(e, r.commission)));
  }
  function supply(u, succession, bargain, stacks, c) {
    const reservation = `${succession.id}:city-maintenance-reserve`, r = u[KEY];
    const item = c.commissionStagedReachable && stacks.find(i => i.key === 'metalParts' && i.quantity >= 3
      && i.cityOwnerId === u.cityId && i.civicCustody?.cityId === u.cityId && i.reservedTaskId === reservation
      && !i.carriedBy && !i.fixtureId && !i.containerId && !i.toolInstanceId && !i.tags?.includes('contaminated')
      && cellSame(i.cell, RECEIVING) && succession.directive?.receipt?.stackId === i.id
      && i.civicCustody.custodianId === u.workerId);
    const receipts = succession.provision.receipts;
    if (!receipts.length || receipts.some(e => !e.id || !e.custodianId || !e.manifest?.length
      || e.manifest.some(m => m.key !== 'metalParts' || !m.stackId || !(m.quantity > 0))
      || e.manifest.reduce((n, m) => n + m.quantity, 0) !== e.quantity)) return null;
    if (item) return { kind: 'stack', id: item.id, cell: copy(item.cell), reservation, custody: copy(item.civicCustody),
      quantity: item.quantity, receipts: copy(receipts) };
    const d = bargain.defender;
    return c.commissionReserveCell && succession.provision.stock >= 3 && (!succession.provision.reservedBy || succession.provision.reservedBy === r?.job?.id)
      && able(d) && !d.assignment && d.workSeconds >= 1 && d.locationId === u.officeId
      && d.mapCell.z === c.commissionReserveCell.z && Math.hypot(d.mapCell.x - c.commissionReserveCell.x, d.mapCell.y - c.commissionReserveCell.y) <= 1
      ? { kind: 'reserve', custodianId: d.id, cell: copy(c.commissionReserveCell), stock: succession.provision.stock, receipts: copy(receipts) } : null;
  }
  function inspect(u, succession, bargain, office, stacks, c, at) {
    const r = u[KEY], t = people(u, succession).technician;
    if (!authentic(u, succession, office, c) || !local(u, succession, office, c) || !free(u, succession, office)
      || r.job || r.collection || r.ended || !standing && at >= r.commission.expiresAt || !recordCurrent(u, succession, office)
      || !attended(u, succession, office, c, 'sign') || !c.commissionCanCarry || !c.commissionCanInspect
      || u.servicedAt != null && at < u.dueAt) return false;
    const source = supply(u, succession, bargain, stacks, c); if (!source) return false;
    const returnCell = standing ? c.deputyReturnCell : RECEIVING;
    if (!returnCell || returnCell.z !== RECEIVING.z || Math.hypot(returnCell.x - RECEIVING.x, returnCell.y - RECEIVING.y) > 1) return false;
    r.inspection = { at, workerId: t.id, source, installationId: u.installation.id, workCell: copy(u.installation.workCell),
      returnCell: copy(returnCell), dueAt: u.dueAt, commissionId: r.commission.id, parts: 3, collectionSeconds: 60, installationSeconds: 120 };
    note(r, at, 'inspection', 'Inspected available municipal supplies and one fresh repair. The injured official’s cargo and partial work are excluded.'); return true;
  }
  function order(u, succession, bargain, office, stacks, expected, c, at) {
    const r = u[KEY], t = people(u, succession).technician;
    if (!r?.inspection || !same(expected, r.inspection) || !authentic(u, succession, office, c)
      || !local(u, succession, office, c) || !free(u, succession, office) || r.job || r.collection || r.ended
      || !standing && at >= r.commission.expiresAt || !recordCurrent(u, succession, office) || !c.commissionCanCarry
      || !c.commissionCanInspect || !attended(u, succession, office, c, 'sign') || !c.externalPowered || office.power < 1
      || office.workSeconds < 30 || t.workSeconds < 210 || r.inspection.dueAt !== u.dueAt
      || !same(supply(u, succession, bargain, stacks, c), r.inspection.source)) return false;
    const id = `${r.id}:repair${standing ? `:${r.repairs.length + 1}` : ''}`; r.job = { id, kind: 'repair', phase: 'collecting', progress: 0, lastAt: at, wasReady: true,
      walkCredit: 0, terms: copy(expected) };
    if (expected.source.kind === 'stack') stacks.find(i => i.id === expected.source.id).reservedTaskId = id;
    else succession.provision.reservedBy = id;
    t.assignment = id; t.workSeconds -= 30; office.workSeconds -= 30; office.power--;
    if (standing) r.receipt = null;
    note(r, at, 'ordered', standing ? 'One physical supplied repair accepted under the existing standing appointment; no new hearing, stock refund or previous partial-work credit.'
      : 'One physical supplied repair accepted; no permanent appointment, stock refund or previous partial-work credit.'); return true;
  }
  function release(u, succession, office) {
    const r = u[KEY], j = r.job; if (!j) return;
    if (office.assignment === j.id) office.assignment = null;
    for (const a of [office.clerk, people(u, succession).technician, people(u, succession).reviewer]) if (a?.assignment === j.id) a.assignment = null;
    r.job = null;
  }
  function unreserve(u, succession, stacks) {
    const j = u[KEY].job, item = stacks.find(i => i.id === j?.terms?.source?.id);
    if (item?.reservedTaskId === j.id) item.reservedTaskId = j.terms.source.reservation;
    if (succession.provision.reservedBy === j?.id) delete succession.provision.reservedBy;
  }
  function cancel(u, succession, office, stacks, c, at) {
    const r = u[KEY];
    if (!r?.job || !local(u, succession, office, c) || r.job.kind === 'repair' && r.collection) return false;
    if (r.job.kind === 'repair') unreserve(u, succession, stacks);
    release(u, succession, office); r.ended = { at, reason: 'cancelled' };
    note(r, at, 'cancelled', 'Unfinished commission work cancelled; no duty, power, supplies or office rights refunded or removed.'); return true;
  }
  function end(u, succession, office, stacks, c, at, reason) {
    const r = u?.[KEY], t = people(u, succession).technician;
    if (!standing || !r?.commission || r.ended || !['resigned', 'revoked'].includes(reason)
      || reason === 'resigned' && t?.appointmentPolicy === 'considerExactDuties' && t?.maintenanceDeputyResignation?.appointmentId !== r.commission.id
      || !local(u, succession, office, c) || !c.commissionPresentIds?.includes(t?.id) || !able(office.clerk)
      || office.assignment || office.clerk.assignment || at < (office.availableAt || 0)
      || !c.externalPowered || office.power < 1 || office.workSeconds < 30) return false;
    office.power--; office.workSeconds -= 30; r.ended = { at, reason };
    note(r, at, reason, 'Standing acting authority ended; no new repair may begin. Collected city cargo and physical handback remain outstanding.'); return true;
  }
  function startHandback(u, succession, office, at) {
    const r = u[KEY], t = people(u, succession).technician;
    if (!standing || !r?.commission || !r.ended || r.job || r.handback || t?.assignment) return false;
    r.job = { id: `${r.id}:handback`, kind: 'handback', phase: 'returning', seconds: 30, progress: 0, lastAt: at, wasReady: true };
    t.assignment = r.job.id; return true;
  }
  function advance(u, succession, bargain, office, institutions, stacks, c, at, effects = {}) {
    const r = u?.[KEY]; if (!r || !c.alive || !validRecord(r)) return false;
    const p = people(u, succession), expired = !standing && r.commission && at >= r.commission.expiresAt;
    if (standing && r.commission && !r.ended && (!injured(p.incumbent) || p.technician.appointmentPolicy !== 'considerExactDuties'
      || p.technician.maintenanceDeputyResignation?.appointmentId === r.commission.id
      || !supported(u, succession, office, c))) {
      r.ended = { at, reason: p.incumbent.status !== 'alive' ? 'incumbentDied' : !injured(p.incumbent) ? 'incumbentRecovered'
        : p.technician.appointmentPolicy !== 'considerExactDuties' || p.technician.maintenanceDeputyResignation?.appointmentId === r.commission.id
          ? 'deputyResigned' : 'authorityUnavailable' };
    }
    if (standing && r.ended && r.job?.kind === 'repair' && !r.collection) {
      unreserve(u, succession, stacks); release(u, succession, office);
    }
    startHandback(u, succession, office, at);
    const j = r.job;
    if (!j) {
      if (expired && !r.ended) { r.ended = { at: r.commission.expiresAt, reason: 'expired' }; note(r, at, 'expired', 'Unused one-day commission expired without renewal or removal.'); return true; }
      return false;
    }
    if (at < j.lastAt) return false;
    const start = j.lastAt, delta = at - start; j.lastAt = at;
    if (standing && j.kind === 'handback') {
      if (!authentic(u, succession, office, c, true) || !able(p.technician) || p.technician.assignment !== j.id
        || p.technician.locationId !== office.id || c.activeViolence || u.rests.length) { j.wasReady = false; return false; }
      if (!j.wasReady) { j.wasReady = true; return false; }
      let seconds = delta, cursor = start;
      while (seconds >= 1 && p.technician.workSeconds > 0 && !cellSame(p.technician.mapCell, r.proposal.homeCell)) {
        if (!effects.move?.(p.technician, r.proposal.homeCell, null)) return false;
        p.technician.workSeconds--; seconds--; cursor++;
      }
      if (!cellSame(p.technician.mapCell, r.proposal.homeCell) || !c.deputyHandbackVisible || !able(office.clerk)
        || office.assignment && office.assignment !== j.id || office.clerk.assignment && office.clerk.assignment !== j.id
        || !c.externalPowered || at < (office.availableAt || 0)) { j.wasReady = false; return false; }
      if (!j.recordPowered) { if (office.power < 1) return false; office.power--; j.recordPowered = true; }
      office.assignment = j.id; office.clerk.assignment = j.id;
      const n = Math.min(seconds, 30 - j.progress, p.technician.workSeconds, office.workSeconds);
      j.progress += n; p.technician.workSeconds -= n; office.workSeconds -= n;
      if (j.progress >= 30) {
        r.handback = { id: `${r.id}:handback-receipt`, at: cursor + n, workerId: p.technician.id, incumbentId: p.incumbent.id,
          commissionId: r.commission.id, cell: copy(p.technician.mapCell), clerkId: office.clerk.id, reason: r.ended.reason };
        office.maintenanceDeputyHandbacks ||= []; office.maintenanceDeputyHandbacks.push(copy(r.handback));
        delete p.technician.maintenanceDeputyId; release(u, succession, office);
      }
      return n > 0;
    }
    if (j.kind !== 'repair') {
      const valid = local(u, succession, office, c) && !u.job && !u.cargoRecovery?.job && !u.rests.length
        && !u.resistance?.job && !succession.job && attended(u, succession, office, c, j.kind, j.id)
        && c.externalPowered && office.assignment === j.id && office.workSeconds > 0
        && (j.kind === 'observe' ? injured(p.incumbent) && c.commissionInjuryVisible : recordCurrent(u, succession, office))
        && participants(u, succession, office, j.kind).every(a => a === office.clerk || a.workSeconds > 0)
        && (j.kind !== 'review' || c.reviewAvailable && institutions?.offices[p.reviewer.institutionId]?.available)
        && (j.kind !== 'sign' || at < r.offer.expiresAt && eligible(u, succession) && same(p.technician.credential, r.proposal.credential));
      if (!valid) { j.wasReady = false; return false; }
      if (!j.wasReady) { j.wasReady = true; return false; }
      const n = Math.min(delta, j.seconds - j.progress, office.workSeconds,
        ...participants(u, succession, office, j.kind).filter(a => a !== office.clerk).map(a => a.workSeconds));
      j.progress += n; office.workSeconds -= n;
      for (const a of participants(u, succession, office, j.kind)) if (a !== office.clerk) a.workSeconds -= n;
      if (j.progress < j.seconds) return n > 0;
      const completedAt = start + n;
      if (j.kind === 'observe') {
        r.observation = { id: `${r.id}:incapacity`, at: completedAt, ...copy(j.terms), health: p.incumbent.health, cell: copy(p.incumbent.mapCell) };
        office.maintenanceIncapacityRecords ||= []; office.maintenanceIncapacityRecords.push(copy(r.observation));
      } else if (j.kind === 'review') {
        r.review.status = 'completed'; r.review.at = completedAt;
        r.review.outcome = eligible(u, succession) && same(p.technician.credential, r.proposal.credential) ? 'eligible' : 'ineligible';
        office[REVIEW_REGISTER] ||= []; office[REVIEW_REGISTER].push(copy(r.review));
        if (r.review.outcome === 'eligible') r.offer = { id: `${r.id}:offer`, proposalId: r.proposal.id, workerId: p.technician.id,
          incumbentId: p.incumbent.id, installationId: u.installation.id, offeredAt: completedAt, expiresAt: completedAt + 3600,
          proposal: copy(r.proposal), review: copy(r.review), durationSeconds: standing ? null : 86400, repairs: standing ? null : 1, scope: LIMITS };
      } else {
        r.commission = { id: `${r.id}:accepted`, at: completedAt, workerId: p.technician.id,
          expiresAt: standing ? null : completedAt + 86400, terms: copy(j.terms) };
        office[ACCEPT_REGISTER] ||= []; office[ACCEPT_REGISTER].push(copy(r.commission));
        u.workCaps[p.technician.id] = 1200; // A bounded recovery cap, not a work refill.
        if (standing) p.technician.maintenanceDeputyId = r.commission.id;
      }
      release(u, succession, office); note(r, completedAt, 'recorded', 'Actual attended record completed. The living official retains their unchanged office and rights.'); return true;
    }
    if (expired || standing && r.ended || p.incumbent.status !== 'alive' || !r.collection && !injured(p.incumbent)) {
      r.ended ||= { at: expired ? r.commission.expiresAt : at, reason: expired ? 'expired' : 'incumbentUnavailableOrRecovered' };
      if (!r.collection) { unreserve(u, succession, stacks); release(u, succession, office); return true; }
      if (j.phase !== 'returning') { j.phase = 'returning'; j.progress = 0; j.walkCredit = 0; j.wasReady = false; }
    }
    let item = r.collection && stacks.find(i => i.id === r.collection.stackId);
    const cargoValid = !r.collection || item?.quantity === 3 && item.key === 'metalParts' && item.cityOwnerId === u.cityId
      && item.carriedBy === p.technician.id && cellSame(item.cell, p.technician.mapCell)
      && item.reservedTaskId === j.id && !item.fixtureId && !item.containerId && !item.toolInstanceId
      && !item.tags?.includes('contaminated') && same(item.civicCustody, r.collection.custody);
    const valid = authentic(u, succession, office, c, j.phase === 'returning') && able(p.technician) && p.technician.assignment === j.id
      && p.technician.locationId === office.id && c.externalPowered && !c.activeViolence && !u.job && !u.rests.length && cargoValid;
    if (!valid) { j.wasReady = false; j.walkCredit = 0; return false; }
    if (!j.wasReady) { j.wasReady = true; return false; }
    // A coarse advance crossing expiry may only return cargo, never install past the deadline.
    let remaining = delta + j.walkCredit, cursor = start - j.walkCredit; j.walkCredit = 0; let changed = false;
    while (remaining > 0 && r.job && p.technician.workSeconds > 0) {
      const target = j.phase === 'collecting' ? j.terms.source.cell : j.phase === 'returning' ? j.terms.returnCell : j.terms.workCell;
      if (!cellSame(p.technician.mapCell, target)) {
        if (remaining < 1) { j.walkCredit = remaining; break; }
        if (!effects.move?.(p.technician, target, item || null)) { j.wasReady = false; break; }
        p.technician.workSeconds--; remaining--; cursor++; changed = true; continue;
      }
      if (j.phase === 'returning') {
        if (!effects.drop?.(item, `${succession.id}:city-maintenance-reserve`, standing ? RECEIVING : null)) { j.wasReady = false; break; }
        r.returned = { at: cursor, stackId: item.id, cell: copy(item.cell), quantity: 3 };
        if (standing) r.collection = null;
        release(u, succession, office); note(r, cursor, 'returned', 'Expired/interrupted commission cargo physically returned to municipal receiving custody; no installation or reserve refund.'); return true;
      }
      if (j.phase === 'collecting') {
        const source = j.terms.source, stack = stacks.find(i => i.id === source.id), d = bargain.defender;
        const original = same(source.receipts, succession.provision.receipts) && (source.kind === 'stack'
          ? stack?.quantity === source.quantity && stack.reservedTaskId === j.id && !stack.carriedBy
            && stack.key === 'metalParts' && !stack.fixtureId && !stack.containerId && !stack.toolInstanceId && !stack.tags?.includes('contaminated')
            && stack.cityOwnerId === u.cityId && same(stack.civicCustody, source.custody) && cellSame(stack.cell, source.cell)
          : succession.provision.stock === source.stock && succession.provision.reservedBy === j.id && able(d) && !d.assignment
            && d.id === source.custodianId && d.workSeconds >= 1 && d.locationId === office.id
            && d.mapCell.z === target.z && Math.hypot(d.mapCell.x - target.x, d.mapCell.y - target.y) <= 1);
        if (!original || !c.commissionCanCarry || !c.commissionSupplyContact) { j.wasReady = false; break; }
        const n = Math.min(remaining, 60 - j.progress, p.technician.workSeconds);
        j.progress += n; p.technician.workSeconds -= n; remaining -= n; cursor += n; changed ||= n > 0;
        if (j.progress < 60) break;
        const custody = { cityId: u.cityId, custodianId: p.technician.id, commissionId: r.commission.id,
          sourceReceiptIds: source.receipts.map(e => e.id), source: copy(source) };
        const lot = effects.collect?.(p.technician, custody, j.id);
        if (!lot || !stacks.includes(lot) || lot.key !== 'metalParts' || lot.quantity !== 3 || lot.carriedBy !== p.technician.id
          || !cellSame(lot.cell, p.technician.mapCell)
          || lot.cityOwnerId !== u.cityId || lot.reservedTaskId !== j.id || !same(lot.civicCustody, custody)) break;
        if (source.kind === 'stack') { stack.quantity -= 3; stack.knownQuantity = Math.min(stack.knownQuantity ?? stack.quantity, stack.quantity); }
        else { succession.provision.stock -= 3; d.workSeconds--; delete succession.provision.reservedBy; }
        r.collection = { at: cursor, stackId: lot.id, custody }; j.phase = 'installing'; j.progress = 0;
        item = lot; changed = true; continue;
      }
      const n = Math.min(remaining, 120 - j.progress, p.technician.workSeconds);
      j.progress += n; p.technician.workSeconds -= n; remaining -= n; cursor += n; changed ||= n > 0;
      if (j.progress < 120) break;
      item.quantity -= 3; item.knownQuantity = 0;
      u.servicedAt = cursor; u.dueAt = cursor + 86400; u.graceUntil = u.dueAt + 28800;
      r.receipt = { id: `${r.id}:repair-receipt${standing ? `:${r.repairs.length + 1}` : ''}`, at: cursor, installationId: u.installation.id, personId: p.technician.id,
        quantity: 3, source: copy(j.terms.source), manifest: copy(r.collection.custody), workSeconds: 120,
        commissionId: r.commission.id, dueAt: u.dueAt, graceUntil: u.graceUntil };
      u.receipts.push(copy(r.receipt));
      if (standing) { r.repairs.push({ receipt: copy(r.receipt), collection: copy(r.collection), inspection: copy(r.inspection) }); r.collection = null; r.inspection = null; }
      else r.ended = { at: cursor, reason: 'completed' };
      release(u, succession, office); office.maintenanceReady = at < u.graceUntil;
      note(r, cursor, 'serviced', standing ? 'Actual supplied counter repair completed under the existing standing appointment. Original supplies and work remain spent; no renewed hearing, dismissal or injury healing.'
        : 'One actual supplied repair completed. Temporary permission ended; the incumbent remains in office and their injuries are unchanged.'); return true;
    }
    return changed;
  }
  function publicView(r) {
    return r ? { observation: copy(r.observation), proposal: copy(r.proposal), review: copy(r.review), offer: copy(r.offer),
      commission: copy(r.commission), inspection: copy(r.inspection), collection: copy(r.collection), receipt: copy(r.receipt),
      returned: copy(r.returned), ended: copy(r.ended), working: r.job && { kind: r.job.kind, phase: r.job.phase, progress: r.job.progress, seconds: r.job.seconds },
      message: r.message, limitations: LIMITS, ...(standing ? { repairs: copy(r.repairs), handback: copy(r.handback) } : {}) } : null;
  }
  return { ruleFor, supported, injured, observe, propose, hear, sign, authentic, inspect, order, cancel, advance, publicView, end };
  }
  return { ...service(), standing: service(true) };
});
