(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCivilInstallationAccess = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const distance = (a, b) => a && b && a.z === b.z ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const RELEASE = Object.freeze({ x: 14, y: 12, z: 6 });
  const LIMITS = 'Civil access to this municipal installation only. No criminal guilt, arrest, punishment, confiscation, compelled signature, immunity, loyalty, religious approval or army. Actual dissent, property, injuries, faith, cases and custody records remain.';
  function ruleFor(cityId, worksId, reviewId, defenseId) {
    return { id: `${cityId}:civil-installation-access-law`, method: 'reviewedCivilInstallationAccess',
      institutionId: worksId, reviewInstitutionId: reviewId, defenseInstitutionId: defenseId,
      orderSeconds: 86400, responseSeconds: 60, contactSeconds: 20, missionSeconds: 600,
      text: 'After a lawful separate-office appointment and witnessed obstruction, the independent civic-review office may order restoration of access to the named municipal counter. The actual outgoing official is heard; disagreement is not crime. A separately consenting original defender may serve the order, allow one minute to depart, and physically escort a passively resisting capable person to the nearby private position using bounded low force. Active fighting ends this commission. No detention, property seizure, compelled handover signature or wider command is authorized.', limits: LIMITS };
  }
  const outgoing = b => b.succession?.leaders.find(a => a.id === b.appointment?.incumbentId);
  const reviewer = b => b.succession?.leaders.find(a => a.id === b.appointment?.reviewerId);
  function create(b) {
    const a = b.appointment, law = b.c.civilAccessRule, d = b.bargain?.defender;
    if (a?.rule?.method !== 'reviewedPublicWorksReplacement' || !a?.appointment || a.receipt || !a.obstruction || !b.c.appointmentCurrent || !d?.physicalStrength
      || !outgoing(b)?.physicalControl || !law || !same(law, ruleFor(a.cityId, a.institutionId, a.reviewerInstitutionId, d.institutionId))
      || b.bargain.source.cityId !== a.cityId || b.bargain.source.charterId !== a.charterId
      || b.c.civilDefenderId !== d.id || b.c.defenseInstitutionId !== d.institutionId) return null;
    return { id: `${a.id}:civil-access`, cityId: a.cityId, charterId: a.charterId, officeId: a.officeId,
      bodyEpoch: a.bodyEpoch, appointmentId: a.appointment.id, outgoingId: a.incumbentId,
      incomingId: a.candidate.id, reviewerId: a.reviewerId, clerkId: a.clerkId, defenderId: d.id,
      installationId: a.installationId, rule: copy(law), phase: 'unfiled', petition: null, review: null,
      order: null, response: null, terms: null, commission: null, service: null, release: null,
      transferEvidence: null, job: null, escort: null, reports: [], history: [], message: '', nextNumber: 1, lastAt: b.at };
  }
  function current(e, b) {
    const a = b.appointment, d = b.bargain?.defender;
    return Boolean(e && a?.rule?.method === 'reviewedPublicWorksReplacement' && a?.appointment?.id === e.appointmentId && !a.receipt && b.c.appointmentCurrent
      && a.cityId === e.cityId && a.charterId === e.charterId && a.incumbentId === e.outgoingId
      && a.candidate?.id === e.incomingId && a.clerkId === e.clerkId && a.reviewerId === e.reviewerId
      && a.installationId === e.installationId && d?.id === e.defenderId && d.institutionId === e.rule.defenseInstitutionId
      && b.bargain.source.cityId === e.cityId && b.bargain.source.charterId === e.charterId
      && same(b.c.civilAccessRule, e.rule) && same(e.rule, ruleFor(e.cityId, a.institutionId, a.reviewerInstitutionId, d.institutionId))
      && b.c.civilDefenderId === e.defenderId && b.c.defenseInstitutionId === d.institutionId
      && b.office?.id === e.officeId && b.office.clerk?.id === e.clerkId && b.c.defenseAvailable);
  }
  function local(e, b) {
    const c = b.c;
    return current(e, b) && c.alive && c.capable && c.atCounter && c.visitPermission && c.clerkPresent && c.lineOfSight
      && c.cityId === e.cityId && c.bodyEpoch === e.bodyEpoch && !c.busy && !c.activeViolence;
  }
  function people(e, b, kind) {
    return [b.office.clerk, ...(kind === 'review' ? [outgoing(b), reviewer(b), b.appointment.candidate]
      : kind === 'transfer' ? [b.appointment.candidate] : kind === 'serve' ? [outgoing(b), b.bargain.defender]
      : [b.bargain.defender])];
  }
  const free = b => !b.appointment.job && !b.appointment.travel && !b.succession.job && !b.upkeep.job
    && !b.upkeep.rests.length && !b.upkeep.resistance?.job && b.succession.directive?.status !== 'carrying';
  const present = (a, b, own = null) => able(a) && a.locationId === b.office.id && b.c.presentIds?.includes(a.id)
    && (!a.assignment || a.assignment === own);
  function note(e, at, kind, text) { e.history.push({ at, kind, text }); e.message = text; }
  function begin(e, b, kind, seconds, terms = null) {
    const actors = people(e, b, kind);
    if (!local(e, b) || e.job || e.escort?.status === 'active' || !free(b) || b.office.assignment || !b.c.externalPowered
      || b.office.maintenanceReady === false || b.at < (b.office.availableAt || 0) || b.office.power < 1
      || b.office.workSeconds < seconds || !actors.every(a => present(a, b) && (a === b.office.clerk || a.workSeconds >= seconds))) return false;
    const id = `${e.id}:work:${e.nextNumber++}`;
    e.job = { id, kind, seconds, progress: 0, lastAt: b.at, wasReady: true, terms: copy(terms) };
    b.office.power--; b.office.assignment = id; for (const a of actors) a.assignment = id;
    note(e, b.at, kind, `Started attended civil-access ${kind}; original duty and one finite counter operation are required.`); return true;
  }
  function file(e, b) {
    if (!local(e, b) || e.petition || e.job || e.escort || !free(b) || b.office.assignment || !b.c.externalPowered
      || b.office.maintenanceReady === false || b.office.workSeconds < 30 || !present(b.office.clerk, b)
      || !present(outgoing(b), b) || !present(b.appointment.candidate, b) || !b.c.reviewAvailable
      || b.institutions?.cityId !== e.cityId || b.institutions.roles['civic-review'] !== e.rule.reviewInstitutionId) return false;
    const id = `${e.id}:petition`, readyAt = Institutions.reserve(b.institutions, 'civic-review', `${id}:review`, b.at);
    if (readyAt == null) return false;
    b.office.workSeconds -= 30;
    e.petition = { id, at: b.at, authorId: 'scientist', appointment: copy(b.appointment.appointment),
      obstruction: copy(b.appointment.obstruction), rule: copy(e.rule), requestedCell: copy(RELEASE) };
    e.review = { id: `${id}:review`, readyAt, status: 'queued', reviewerId: e.reviewerId };
    e.phase = 'queued'; note(e, b.at, 'petition', 'Filed only the named installation-access request in the original independent queue. Candidate eligibility is not reheard; no guilt or access follows.'); return true;
  }
  function queued(e, b) {
    return b.c.reviewAvailable && b.institutions?.offices[e.rule.reviewInstitutionId]?.available
      && b.institutions.offices[e.rule.reviewInstitutionId].jobs[e.review?.id]?.readyAt === e.review?.readyAt;
  }
  function hear(e, b) {
    return Boolean(e.review?.status === 'queued' && b.at >= e.review.readyAt && queued(e, b)
      && begin(e, b, 'review', 180));
  }
  function orderAuthentic(e, a, office) {
    return Boolean(e.order && e.review?.status === 'completed' && e.review.reviewerId === e.reviewerId
      && same(e.review.evidence, e.petition) && same(e.petition?.appointment, a.appointment)
      && same(e.petition?.obstruction, a.obstruction) && same(e.petition?.rule, e.rule)
      && e.order.appointmentId === e.appointmentId && e.order.outgoingId === e.outgoingId
      && e.order.incomingId === e.incomingId && e.order.installationId === e.installationId
      && e.order.recorderId === e.clerkId && e.order.reviewerId === e.reviewerId
      && e.order.expiresAt === e.order.at + e.rule.orderSeconds && same(e.order.rule, e.rule)
      && same(e.order.destination, RELEASE) && office.civilInstallationOrders?.some(r => same(r, e.order)));
  }
  function commissionTerms(e, at) {
    return { id: `${e.id}:commission-terms`, orderId: e.order.id, offeredAt: at, expiresAt: at + 3600,
      defenderId: e.defenderId, outgoingId: e.outgoingId, installationId: e.installationId, bodyEpoch: e.bodyEpoch,
      missionSeconds: e.rule.missionSeconds, contactSeconds: e.rule.contactSeconds, destination: copy(RELEASE),
      duties: 'Serve this exact civil order; allow actual time to depart; escort this capable passively resisting person to the nearby private position only. One bounded physical grip, no offensive spells, punishment, arrest or forced signature. Stop for active fighting, incapacity, missing supervision or exhausted reserves.', limits: LIMITS };
  }
  function discussCommission(e, b) {
    return Boolean(orderAuthentic(e, b.appointment, b.office) && b.at < e.order.expiresAt && !e.response
      && begin(e, b, 'commissionMeeting', 60));
  }
  function signCommission(e, b, expected) {
    return Boolean(e.response?.decision === 'offered' && !e.commission && e.terms && same(expected, e.terms)
      && same(e.terms, commissionTerms(e, e.response.at)) && b.at < e.terms.expiresAt && b.at < e.order.expiresAt
      && orderAuthentic(e, b.appointment, b.office) && begin(e, b, 'commission', 60, expected));
  }
  function commissionAuthentic(e, a, office) {
    return Boolean(orderAuthentic(e, a, office) && e.response?.decision === 'offered' && e.commission
      && same(e.terms, commissionTerms(e, e.response.at)) && same(e.commission.terms, e.terms)
      && e.commission.defenderId === e.defenderId && e.commission.recorderId === e.clerkId
      && e.commission.at < e.terms.expiresAt && office.civilAccessCommissions?.some(r => same(r, e.commission)));
  }
  function serve(e, b) {
    return Boolean(!e.service && commissionAuthentic(e, b.appointment, b.office) && b.at < e.order.expiresAt
      && begin(e, b, 'serve', 60));
  }
  function clearJob(e, b) {
    const j = e.job; if (!j) return;
    for (const a of people(e, b, j.kind)) if (a?.assignment === j.id) a.assignment = null;
    if (b.office.assignment === j.id) b.office.assignment = null; e.job = null;
  }
  function stop(e, b, text) {
    clearJob(e, b);
    if (e.escort) {
      for (const a of [outgoing(b), b.bargain?.defender, b.office?.clerk, b.appointment?.candidate]) if (a?.assignment === e.escort.id) a.assignment = null;
      if (b.office.assignment === e.escort.id) b.office.assignment = null;
      e.escort.status = 'stopped'; e.escort.stoppedAt = b.at;
    }
    e.phase = 'interrupted'; note(e, b.at, 'interruption', text); return true;
  }
  function cancel(e, b) {
    return Boolean(local(e, b) && (e.job || e.escort?.status === 'active')
      && stop(e, b, 'Stopped unfinished access work. Physical positions, original orders, injuries, spent resources and earlier records remain. No refund or transfer.'));
  }
  function startEscort(e, b) {
    if (!local(e, b) || e.job || e.escort || !free(b) || b.office.assignment || !e.service
      || b.at < e.service.departBy || b.at >= e.order.expiresAt || !commissionAuthentic(e, b.appointment, b.office)
      || !b.office.civilAccessServices?.some(r => same(r, e.service)) || !b.c.externalPowered || b.office.maintenanceReady === false
      || ![outgoing(b), b.bargain.defender, b.office.clerk, b.appointment.candidate].every(a => present(a, b))
      || !outgoing(b).physicalControl || b.bargain.defender.stamina < 2 || b.bargain.defender.workSeconds < 1) return false;
    const id = `${e.id}:escort`;
    e.escort = { id, status: 'active', phase: 'approaching', authorizedAt: b.at, lastAt: b.at, credit: 0,
      elapsed: 0, contact: 0, gripApplied: false, steps: 0, startCell: copy(outgoing(b).mapCell) };
    for (const a of [outgoing(b), b.bargain.defender, b.office.clerk, b.appointment.candidate]) a.assignment = id;
    b.office.assignment = id; e.phase = 'escorting'; note(e, b.at, 'escort', 'The commissioned defender must physically reach and control the actual outgoing person. This is an escort, not arrest or access.'); return true;
  }
  function witness(e, b, kind, actorId, targetId, detail) {
    const target = [outgoing(b), b.bargain.defender, b.appointment.candidate, b.office.clerk].find(a => a.id === targetId);
    const people = [outgoing(b), reviewer(b), b.bargain.defender, b.appointment.candidate, b.office.clerk];
    for (const witnessId of b.c.presentIds || []) {
      const witness = people.find(a => a?.id === witnessId);
      if (!witness || !target || distance(witness.mapCell, target.mapCell) > 6 || !b.effects?.lineOfSight?.(witness.mapCell, target.mapCell)) continue;
      e.reports.push({ id: `${e.id}:report:${e.reports.length + 1}`, at: b.at,
      cityId: e.cityId, actorId, targetId, witnessId, kind, detail,
      finding: 'Actually witnessed conduct only. The civil order grants no criminal verdict, immunity or punishment.' });
    }
  }
  function attack(e, b, actorId, targetId, actionId) {
    if (!e || !b.c.alive || ![e.outgoingId, e.defenderId, e.incomingId, e.clerkId].includes(targetId)) return false;
    witness(e, b, 'attack', actorId, targetId, `Observed ${actionId}; it is not an authorized escort action.`);
    if (e.job || e.escort?.status === 'active') stop(e, b, 'Active fighting ended the limited escort commission. No automatic victory, arrest or transfer follows.');
    e.fightingAt = b.at; return true;
  }
  function transfer(e, b) {
    return Boolean(e.release && !e.transferEvidence && e.escort?.status === 'released' && b.c.accessInventoryVisible
      && b.c.inventory && cellSame(outgoing(b).mapCell, RELEASE) && cellSame(b.appointment.candidate.mapCell, b.upkeep.installation.workCell)
      && commissionAuthentic(e, b.appointment, b.office) && b.at < e.order.expiresAt
      && b.office.civilAccessReleases?.some(r => same(r, e.release)) && begin(e, b, 'transfer', 120, b.c.inventory));
  }
  function advance(e, b) {
    if (!e || !b.c.alive || b.at < e.lastAt) return false; e.lastAt = b.at;
    if (e.escort?.status === 'active') return advanceEscort(e, b);
    const j = e.job; if (!j) return false;
    if (!local(e, b) || !people(e, b, j.kind).every(a => present(a, b, j.id))
      || j.kind === 'review' && (!queued(e, b) || !same(e.petition.appointment, b.appointment.appointment) || !same(e.petition.obstruction, b.appointment.obstruction))
      || j.kind !== 'review' && (!orderAuthentic(e, b.appointment, b.office) || b.at >= e.order.expiresAt)
      || j.kind === 'commission' && (b.at >= e.terms.expiresAt || !same(j.terms, e.terms) || !same(e.terms, commissionTerms(e, e.response.at)))
      || ['serve', 'transfer'].includes(j.kind) && !commissionAuthentic(e, b.appointment, b.office)
      || j.kind === 'transfer' && (!b.c.accessInventoryVisible || !same(j.terms, b.c.inventory)
        || !cellSame(outgoing(b).mapCell, RELEASE) || !cellSame(b.appointment.candidate.mapCell, b.upkeep.installation.workCell)
        || !b.office.civilAccessReleases?.some(r => same(r, e.release))))
      return stop(e, b, 'Actual attendance, source authority, exact evidence or safe conditions changed. No unfinished order, consent or access record was invented.');
    const start = j.lastAt; j.lastAt = b.at;
    if (!b.c.externalPowered || b.office.maintenanceReady === false || b.office.assignment !== j.id) { j.wasReady = false; return false; }
    const work = j.wasReady ? Math.min(b.at - start, j.seconds - j.progress, b.office.workSeconds,
      ...people(e, b, j.kind).filter(a => a !== b.office.clerk).map(a => a.workSeconds)) : 0;
    j.wasReady = true; j.progress += work; b.office.workSeconds -= work;
    for (const a of people(e, b, j.kind)) if (a !== b.office.clerk) a.workSeconds -= work;
    if (j.progress < j.seconds) return false;
    const at = start + work;
    if (j.kind === 'review') {
      e.review.status = 'completed'; e.review.at = at; e.review.evidence = copy(e.petition);
      e.review.finding = 'The existing lawful appointment and witnessed obstruction support only the published civil installation-access procedure. Dissent is not misconduct; no criminal guilt or physical control is found.';
      e.order = { id: `${e.id}:order`, at, expiresAt: at + e.rule.orderSeconds, appointmentId: e.appointmentId,
        outgoingId: e.outgoingId, incomingId: e.incomingId, installationId: e.installationId,
        reviewerId: e.reviewerId, recorderId: e.clerkId, rule: copy(e.rule), destination: copy(RELEASE), limits: LIMITS };
      b.office.civilInstallationOrders ||= []; b.office.civilInstallationOrders.push(copy(e.order)); e.phase = 'ordered';
      note(e, at, 'order', e.review.finding);
    } else if (j.kind === 'commissionMeeting') {
      e.response = { at, personId: e.defenderId, decision: b.bargain.defender.civilAccessPolicy === 'considerCivilEscort' ? 'offered' : 'refused' };
      if (e.response.decision === 'offered') e.terms = commissionTerms(e, at);
      note(e, at, 'commissionResponse', e.terms ? 'The original defender offers one exact separately authorized civil escort, not an army or arrest power.' : 'The original defender refuses this civil escort. Prior protective or watch duties supply no substitute commission.');
    } else if (j.kind === 'commission') {
      e.commission = { id: `${e.id}:commission`, at, defenderId: e.defenderId, recorderId: e.clerkId, terms: copy(j.terms) };
      b.office.civilAccessCommissions ||= []; b.office.civilAccessCommissions.push(copy(e.commission)); e.phase = 'commissioned';
      note(e, at, 'commission', 'Recorded the original defender’s specific consent. No person has been moved or installation transferred.');
    } else if (j.kind === 'serve') {
      e.service = { id: `${e.id}:service`, at, orderId: e.order.id, outgoingId: e.outgoingId,
        defenderId: e.defenderId, recorderId: e.clerkId, departBy: at + e.rule.responseSeconds,
        objection: 'The outgoing official retains their original objection; receipt of the order is not agreement or guilt.' };
      b.office.civilAccessServices ||= []; b.office.civilAccessServices.push(copy(e.service)); e.phase = 'served';
      note(e, at, 'service', 'The actual official received the order and one minute to depart. This service is not restraint, consent, punishment or access.');
    } else if (j.kind === 'transfer') {
      e.transferEvidence = { id: `${e.id}:compulsory-access-inspection`, at, orderId: e.order.id,
        commissionId: e.commission.id, releaseId: e.release.id, incomingId: e.incomingId, recorderId: e.clerkId,
        installationId: e.installationId, inventory: copy(j.terms), origin: 'compulsoryCivilAccess', limits: LIMITS };
      b.office.civilAccessTransfers ||= []; b.office.civilAccessTransfers.push(copy(e.transferEvidence));
      e.phase = 'accessReady'; note(e, at, 'accessInspection', 'Actual incoming-official/clerk inspection completed after physical release. No outgoing signature or voluntary consent was manufactured.');
    }
    clearJob(e, b); return true;
  }
  function advanceEscort(e, b) {
    const t = e.escort, a = outgoing(b), d = b.bargain.defender;
    const start = t.lastAt; t.lastAt = b.at;
    if (!local(e, b) || !commissionAuthentic(e, b.appointment, b.office) || b.at >= e.order.expiresAt
      || !b.office.civilAccessServices?.some(r => same(r, e.service)) || b.office.assignment !== t.id
      || e.fightingAt != null || ![a, d, b.office.clerk, b.appointment.candidate].every(p => present(p, b, t.id) && p.assignment === t.id))
      return stop(e, b, 'Active fighting, lost supervision, incapacity or changed authority ended the limited escort. Real positions and consequences remain.');
    if (!b.c.externalPowered || b.office.maintenanceReady === false) { t.credit = 0; return false; }
    t.credit = Math.min(60, t.credit + b.at - start); let changed = false;
    while (t.credit >= 1) {
      t.credit--; t.elapsed++;
      if (t.elapsed > e.rule.missionSeconds || d.workSeconds < 1 || d.stamina < 2 || b.office.workSeconds < 1 || b.appointment.candidate.workSeconds < 1)
        return stop(e, b, 'The bounded mission or actual duty/stamina reserves are exhausted. No free recovery, force or access follows.');
      d.workSeconds--; b.office.workSeconds--; b.appointment.candidate.workSeconds--; changed = true;
      const contact = distance(a.mapCell, d.mapCell) <= 1 && b.effects?.lineOfSight?.(d.mapCell, a.mapCell);
      if (!contact) {
        t.phase = 'approaching'; t.contact = 0;
        const reached = b.effects?.approach?.(d, a.mapCell);
        if (reached) d.stamina--; else { t.credit = 0; return changed; }
        continue;
      }
      t.phase = 'contact';
      const force = d.physicalStrength * d.health / d.maxHealth * d.stamina / d.staminaCapacity;
      const resistance = a.physicalControl.strength * a.health / a.maxHealth * a.physicalControl.stamina / a.physicalControl.staminaCapacity;
      if (!Number.isFinite(force) || !Number.isFinite(resistance) || force <= resistance || a.physicalControl.stamina < 1)
        return stop(e, b, 'The actual defender cannot safely control this person under the low-force commission. No strength or compliance was invented.');
      if (!t.gripApplied) {
        if (!b.effects?.damage?.(a, 1)) return stop(e, b, 'Physical grip could not be resolved. No injury or restraint was fabricated.');
        t.gripApplied = true; witness(e, b, 'boundedGrip', d.id, a.id, 'One low-force grip during passive resistance caused actual bodily trauma; the civil order supplies no immunity.');
        if (!able(a)) return stop(e, b, 'The person is no longer capable of this supervised escort. No artificial health floor or transfer follows.');
      }
      if (t.contact < e.rule.contactSeconds) { d.stamina -= 2; a.physicalControl.stamina--; t.contact++; continue; }
      t.phase = 'escorting';
      if (!cellSame(a.mapCell, RELEASE)) {
        const prior = copy(a.mapCell);
        if (!b.effects?.move?.(a, RELEASE)) { t.credit = 0; return changed; }
        d.stamina -= 2; a.physicalControl.stamina--; t.steps++;
        if (!b.effects?.move?.(d, prior)) { t.phase = 'approaching'; t.contact = 0; t.credit = 0; return changed; }
      }
      if (cellSame(a.mapCell, RELEASE) && distance(a.mapCell, d.mapCell) <= 1) {
        e.release = { id: `${e.id}:physical-release`, at: b.at, orderId: e.order.id, commissionId: e.commission.id,
          outgoingId: a.id, defenderId: d.id, recorderId: e.clerkId, startCell: copy(t.startCell),
          cell: copy(a.mapCell), defenderCell: copy(d.mapCell), steps: t.steps, gripSeconds: t.contact, limits: LIMITS };
        b.office.civilAccessReleases ||= []; b.office.civilAccessReleases.push(copy(e.release));
        for (const p of [a, d, b.office.clerk, b.appointment.candidate]) if (p.assignment === t.id) p.assignment = null;
        if (b.office.assignment === t.id) b.office.assignment = null;
        t.status = 'released'; e.phase = 'released';
        note(e, b.at, 'physicalRelease', 'The real official was physically escorted to the private position. Dissent and injuries remain; there is no jail, compelled signature or installation transfer.'); return true;
      }
    }
    return changed;
  }
  function receiptAuthentic(e, a, office, c) {
    return Boolean(e && c.civilDefenderId === e.defenderId && c.defenseInstitutionId === e.rule.defenseInstitutionId
      && same(c.civilAccessRule, e.rule) && same(e.rule, ruleFor(a.cityId, a.institutionId, a.reviewerInstitutionId, c.defenseInstitutionId))
      && e.cityId === a.cityId && e.charterId === a.charterId && e.bodyEpoch === a.bodyEpoch
      && e.officeId === office?.id && e.appointmentId === a.appointment?.id && e.outgoingId === a.incumbentId
      && e.incomingId === a.candidate?.id && e.clerkId === a.clerkId && e.reviewerId === a.reviewerId
      && e.installationId === a.installationId && commissionAuthentic(e, a, office)
      && e.service?.orderId === e.order.id && e.service.defenderId === e.defenderId && e.service.outgoingId === e.outgoingId
      && e.service.recorderId === e.clerkId && e.service.at >= e.commission.at && e.service.departBy === e.service.at + e.rule.responseSeconds
      && office.civilAccessServices?.some(r => same(r, e.service)) && e.release?.orderId === e.order.id
      && e.release.commissionId === e.commission.id && e.release.outgoingId === e.outgoingId && e.release.defenderId === e.defenderId
      && e.release.recorderId === e.clerkId && cellSame(e.release.cell, RELEASE) && distance(e.release.cell, e.release.defenderCell) <= 1
      && e.release.gripSeconds >= e.rule.contactSeconds
      && e.release.at >= e.service.departBy && e.release.at < e.order.expiresAt && e.escort?.status === 'released'
      && office.civilAccessReleases?.some(r => same(r, e.release)) && e.transferEvidence?.orderId === e.order.id
      && e.transferEvidence.commissionId === e.commission.id && e.transferEvidence.releaseId === e.release.id
      && e.transferEvidence.incomingId === e.incomingId && e.transferEvidence.recorderId === e.clerkId
      && e.transferEvidence.installationId === e.installationId && e.transferEvidence.at >= e.release.at && e.transferEvidence.at < e.order.expiresAt
      && e.transferEvidence.origin === 'compulsoryCivilAccess' && office.civilAccessTransfers?.some(r => same(r, e.transferEvidence)));
  }
  function publicView(e) {
    return e ? { phase: e.phase, rule: copy(e.rule), petition: copy(e.petition), review: copy(e.review), order: copy(e.order),
      response: copy(e.response), terms: copy(e.terms), commission: copy(e.commission), service: copy(e.service),
      release: copy(e.release), transferEvidence: copy(e.transferEvidence), reports: copy(e.reports),
      working: e.job && { kind: e.job.kind, progress: e.job.progress, seconds: e.job.seconds },
      escort: e.escort && { status: e.escort.status, phase: e.escort.phase, contact: e.escort.contact, steps: e.escort.steps },
      message: e.message, history: copy(e.history), limitations: LIMITS } : null;
  }
  return { RELEASE, LIMITS, ruleFor, create, file, hear, discussCommission, signCommission, serve, startEscort,
    transfer, advance, attack, cancel, current, receiptAuthentic, publicView };
});
