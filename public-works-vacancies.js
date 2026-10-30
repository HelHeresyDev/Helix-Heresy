(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPublicWorksVacancies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  const ROLE = 'publicWorksAndProvisioning', RECEIVING = { x: 16, y: 12, z: 6 };
  const LIMITS = 'One death-vacant separate public-works office and existing counter maintenance only. No deceased consent, immunity, confiscation, force authority, new stock or other office powers. Emergency attendance does not restore overdue ordinary services.';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const deceased = a => a?.status === 'dead' && a.health === 0;
  const old = (s, succession) => succession?.leaders.find(a => a.id === s?.incumbentId);
  const reviewer = (s, succession) => succession?.leaders.find(a => a.id === s?.reviewerId);
  function ruleFor(cityId, institutionId, reviewInstitutionId) {
    return { id: `${cityId}:public-works-death-vacancy-law`, method: 'reviewedDeathVacancy', role: ROLE,
      institutionId, reviewInstitutionId, appointmentMethod: 'appointmentBySovereignAuthority', minimumMaintenance: 40,
      text: 'After an actual voluntary sovereign handover, locally inspected death can establish a vacancy in this separate public-works office. The original independent reviewer checks death, authority and the same qualified willing municipal technician. Exact appointment and physically inspected installation custody are separate. The surviving clerk, candidate and reviewer may conduct only finite supplied emergency vacancy proceedings while ordinary counter service is overdue. Absence, injury, dissent and exhaustion are not vacancies. Death grants neither consent nor immunity.' };
  }
  function supported(s, succession, upkeep, office, c) {
    const law = s?.vacancy?.rule || c.vacancyRule;
    return Boolean(s && s.rule.method === 'reviewedPublicWorksReplacement' && !s.receipt && !upkeep.authorizationId && !s.candidate?.maintenanceDeputyId
      && law && same(law, ruleFor(s.cityId, s.institutionId, s.reviewerInstitutionId))
      && same(law, succession.source.publicWorksVacancy) && same(law, c.vacancyRule)
      && succession.handover?.id === s.handoverId && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === s.bodyEpoch && succession.source.charterId === s.charterId
      && succession.source.cityId === s.cityId && c.charterCurrent && c.administrationAvailable && c.publicWorksAvailable && c.geometryAvailable
      && same(c.appointmentOffice, { id: s.institutionId, roles: [ROLE], appointmentMethod: law.appointmentMethod })
      && old(s, succession)?.institutionId === s.institutionId && same(old(s, succession)?.roles, [ROLE])
      && reviewer(s, succession)?.institutionId === s.reviewerInstitutionId && reviewer(s, succession)?.roles.includes('civicReview')
      && s.reviewerId !== s.incumbentId && s.reviewerId !== s.candidate?.id && s.clerkId === office?.clerk?.id
      && office.active && office.cityId === s.cityId && office.id === s.officeId && upkeep.officeId === s.officeId
      && upkeep.installation.id === s.installationId && same(office.civicCounter?.cell, upkeep.installation.cell)
      && upkeep.charterId === s.charterId && upkeep.handoverId === s.handoverId
      && upkeep.workerId === (s.vacancy?.receipt ? s.candidate?.id : s.incumbentId));
  }
  function local(s, succession, upkeep, office, c) {
    return supported(s, succession, upkeep, office, c) && c.alive && c.capable && c.atCounter && c.visitPermission
      && c.clerkPresent && c.lineOfSight && !c.busy && !c.activeViolence && c.cityId === s.cityId && c.bodyEpoch === s.bodyEpoch;
  }
  function participants(s, succession, office, kind) {
    return [office.clerk, ...(kind === 'observe' ? [] : [s.candidate]), ...(kind === 'review' ? [reviewer(s, succession)] : [])];
  }
  function attended(s, succession, office, c, kind, own = null) {
    return participants(s, succession, office, kind).every(a => able(a) && a.locationId === s.officeId
      && c.presentIds?.includes(a.id) && (!a.assignment || a.assignment === own));
  }
  function free(s, succession, upkeep, office) {
    return !s.job && !s.travel && !s.enforcement?.job && s.enforcement?.escort?.status !== 'active'
      && !s.opposition?.job && !s.opposition?.safeguards?.job && !s.vacancy?.job && !s.vacancy?.travel
      && !office.assignment && !succession.job && !upkeep.resistance?.job
      && !upkeep.rests.length && !upkeep.job && !succession.directive?.cargo
      && !['ordered', 'carrying'].includes(succession.directive?.status);
  }
  function evidence(s, succession) {
    const a = old(s, succession);
    return deceased(a) ? { personId: a.id, institutionId: a.institutionId, status: a.status, health: a.health,
      diedAt: a.diedAt ?? null, cell: copy(a.mapCell), locationId: a.locationId } : null;
  }
  function deathCurrent(s, succession, office) {
    const v = s.vacancy;
    return Boolean(v?.death && deceased(old(s, succession)) && same(v.death.evidence, evidence(s, succession))
      && v.death.observerId === 'scientist' && v.death.recorderId === s.clerkId
      && office.publicWorksDeaths?.some(r => same(r, v.death)));
  }
  function note(v, at, kind, message) { v.history.push({ at, kind, message }); v.message = message; }
  function ensure(s, c, at) {
    s.vacancy ||= { id: `${s.id}:death-vacancy`, rule: copy(c.vacancyRule), phase: 'unconfirmed', death: null,
      dossier: null, proposal: null, review: null, terms: null, appointment: null, receipt: null, agreement: null,
      job: null, travel: null, history: [], interruptedDuties: [], nextNumber: 1, lastAt: at };
    return s.vacancy;
  }
  function begin(s, succession, upkeep, office, c, at, kind, seconds, terms = null) {
    if (!local(s, succession, upkeep, office, c) || !free(s, succession, upkeep, office)
      || !attended(s, succession, office, c, kind) || !c.externalPowered || office.power < 1
      || at < (office.availableAt || 0) || office.workSeconds < seconds
      || participants(s, succession, office, kind).some(a => a !== office.clerk && a.workSeconds < seconds)
      || kind !== 'observe' && !deathCurrent(s, succession, office)) return false;
    const v = s.vacancy, id = `${v.id}:work:${v.nextNumber++}`;
    v.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, terms: copy(terms), evidence: evidence(s, succession) };
    office.power--; office.assignment = id;
    for (const a of participants(s, succession, office, kind)) a.assignment = id;
    note(v, at, kind, 'Finite attended emergency vacancy work started; ordinary overdue services remain closed.'); return true;
  }
  // Death interrupts only the deceased person's duties, preserving cargo and
  // paid progress at the actual body, never converting it into usable stock.
  function interruptDeceased(s, succession, upkeep, office, stacks, at) {
    const a = old(s, succession), v = s.vacancy;
    if (upkeep.job?.workerId === a.id) {
      const j = upkeep.job;
      v.interruptedDuties.push({ at, job: copy(j), personId: a.id, cell: copy(a.mapCell) });
      if (j.cargo) a.civicMaintenanceCargo = { ...copy(j.cargo), interruptedJobId: j.id, cell: copy(a.mapCell) };
      const item = stacks.find(i => i.id === j.source.id);
      if (item?.reservedTaskId === j.id) item.reservedTaskId = j.source.reservation;
      if (succession.provision.reservedBy === j.id) delete succession.provision.reservedBy;
      if (a.assignment === j.id) a.assignment = null;
      upkeep.job = null; upkeep.inspection = null;
    }
    for (const r of upkeep.rests.filter(r => r.personId === a.id)) {
      v.interruptedDuties.push({ at, rest: copy(r), personId: a.id, cell: copy(a.mapCell) });
      if (a.assignment === r.id) a.assignment = null;
    }
    upkeep.rests = upkeep.rests.filter(r => r.personId !== a.id);
    const d = succession.directive;
    if (d?.workerId === a.id && d.status === 'carrying' && !succession.job) {
      v.interruptedDuties.push({ at, directive: copy(d), personId: a.id, cell: copy(a.mapCell) });
      if (d.cargo) a.civicMaintenanceCargo = { ...copy(d.cargo), interruptedDirectiveId: d.id, cell: copy(a.mapCell) };
      d.cargo = null; d.status = 'interruptedByDeath'; d.interruptedAt = at;
      if (a.assignment === succession.id) a.assignment = null;
    }
  }
  function observe(s, succession, upkeep, office, stacks, c, at) {
    if (!local(s, succession, upkeep, office, c) || !c.deathVisible || !deceased(old(s, succession))
      || s.vacancy?.death || s.vacancy?.job || s.vacancy?.travel || s.job || s.travel
      || office.assignment || !attended(s, succession, office, c, 'observe')
      || !c.externalPowered || office.power < 1 || office.workSeconds < 30) return false;
    ensure(s, c, at);
    interruptDeceased(s, succession, upkeep, office, stacks, at);
    return begin(s, succession, upkeep, office, c, at, 'observe', 30);
  }
  function discuss(s, succession, upkeep, office, c, at) {
    return Boolean(s.vacancy?.death && !s.vacancy.dossier && begin(s, succession, upkeep, office, c, at, 'discuss', 60));
  }
  function eligible(s) {
    const a = s.candidate, d = s.vacancy?.dossier;
    return Boolean(a && d && d.candidateId === a.id && same(d.credential, a.credential)
      && a.populationSourceId === s.populationSourceId && a.credential?.populationSourceId === s.populationSourceId
      && a.credential.issuerInstitutionId === s.institutionId && Number.isFinite(a.credential.maintenance)
      && a.credential.maintenance >= s.vacancy.rule.minimumMaintenance
      && a.appointmentPolicy === 'considerExactDuties' && (!a.roles.length || s.vacancy.receipt && same(a.roles, [ROLE])));
  }
  function propose(s, succession, upkeep, office, institutions, expected, c, at) {
    const v = s.vacancy;
    if (!v?.dossier || v.proposal || !same(expected, v.dossier) || !local(s, succession, upkeep, office, c)
      || !deathCurrent(s, succession, office) || !free(s, succession, upkeep, office)
      || !attended(s, succession, office, c, 'discuss') || !able(reviewer(s, succession)) || !c.reviewAvailable
      || !c.externalPowered || office.workSeconds < 30 || s.candidate.workSeconds < 30
      || institutions?.cityId !== s.cityId || institutions.roles['civic-review'] !== s.reviewerInstitutionId) return false;
    const id = `${v.id}:proposal`, readyAt = Institutions.reserve(institutions, 'civic-review', `${id}:review`, at);
    if (readyAt == null) return false;
    office.workSeconds -= 30; s.candidate.workSeconds -= 30;
    v.proposal = { id, at, authorId: 'scientist', candidateId: s.candidate.id, deceasedId: s.incumbentId,
      rule: copy(v.rule), death: copy(v.death), dossier: copy(v.dossier), handoverId: s.handoverId };
    v.review = { id: `${id}:review`, readyAt, status: 'queued', reviewerId: s.reviewerId };
    v.phase = 'queued'; note(v, at, 'proposal', 'The original independent queue received one exact death-vacancy proposal. No deceased objection or consent was fabricated.'); return true;
  }
  function hear(s, succession, upkeep, office, institutions, c, at) {
    const v = s.vacancy, job = institutions?.offices[s.reviewerInstitutionId]?.jobs[v?.review?.id];
    return Boolean(v?.review?.status === 'queued' && c.reviewAvailable && institutions?.cityId === s.cityId
      && institutions.roles['civic-review'] === s.reviewerInstitutionId && institutions.offices[s.reviewerInstitutionId]?.available
      && job?.readyAt === v.review.readyAt && at >= v.review.readyAt
      && begin(s, succession, upkeep, office, c, at, 'review', 180));
  }
  function appoint(s, succession, upkeep, office, expected, c, at) {
    const v = s.vacancy;
    return Boolean(v?.review?.status === 'completed' && v.review.outcome === 'eligible' && !v.appointment && eligible(s)
      && same(expected, v.terms) && at < v.terms.expiresAt
      && begin(s, succession, upkeep, office, c, at, 'appoint', 60, expected));
  }
  function appointmentCurrent(s, succession, office) {
    const v = s.vacancy;
    return Boolean(v?.appointment && deathCurrent(s, succession, office) && v.review?.outcome === 'eligible'
      && v.review.status === 'completed' && v.review.reviewerId === s.reviewerId && same(v.review.evidence, v.proposal)
      && same(v.proposal.rule, v.rule) && same(v.proposal.death, v.death) && same(v.proposal.dossier, v.dossier)
      && v.proposal.handoverId === s.handoverId && v.proposal.authorId === 'scientist' && v.proposal.deceasedId === s.incumbentId
      && v.proposal.candidateId === s.candidate?.id && same(v.appointment.terms, v.terms)
      && v.appointment.reviewId === v.review.id && v.appointment.candidateId === s.candidate?.id
      && v.appointment.deceasedId === s.incumbentId && v.appointment.recorderId === s.clerkId
      && v.appointment.institutionId === s.institutionId && v.appointment.handoverId === s.handoverId
      && v.appointment.origin === 'reviewedDeathVacancy' && v.terms.scope === LIMITS && v.terms.workCap === 1200
      && v.terms.bodyEpoch === s.bodyEpoch && v.terms.reviewId === v.review.id
      && v.terms.candidateId === s.candidate.id && v.terms.deceasedId === s.incumbentId
      && office.publicWorksAppointments?.some(r => same(r, v.appointment)) && eligible(s));
  }
  function approach(s, succession, upkeep, office, c, at) {
    const v = s.vacancy;
    if (!local(s, succession, upkeep, office, c) || !appointmentCurrent(s, succession, office) || v.receipt
      || !free(s, succession, upkeep, office) || !attended(s, succession, office, c, 'discuss')) return false;
    v.travel = { id: `${v.id}:approach`, lastAt: at, credit: 0, target: copy(upkeep.installation.workCell) };
    s.candidate.assignment = v.travel.id; v.phase = 'approaching'; return true;
  }
  function inventory(succession, upkeep, stacks) {
    return { installation: copy(upkeep.installation), dueAt: upkeep.dueAt, graceUntil: upkeep.graceUntil,
      receipts: copy(upkeep.receipts), directive: copy(succession.directive || null),
      deceasedCargo: copy(old(succession.appointments, succession)?.civicMaintenanceCargo || null),
      goods: stacks.filter(i => cellSame(i.cell, RECEIVING) && !i.carriedBy && !i.containerId && !i.fixtureId && !i.toolInstanceId
        && i.cityOwnerId === upkeep.cityId && i.civicCustody?.cityId === upkeep.cityId)
        .map(i => ({ id: i.id, key: i.key, quantity: i.quantity, custody: copy(i.civicCustody), reservation: i.reservedTaskId || null }))
        .sort((a, b) => a.id.localeCompare(b.id)) };
  }
  function transfer(s, succession, upkeep, office, stacks, expected, c, at) {
    const v = s.vacancy;
    if (!appointmentCurrent(s, succession, office) || v.receipt || !same(expected, v.appointment)
      || !c.accessInventoryVisible || !cellSame(s.candidate.mapCell, upkeep.installation.workCell)) return false;
    const ok = begin(s, succession, upkeep, office, c, at, 'transfer', 120, expected);
    if (ok) v.job.inventory = inventory(succession, upkeep, stacks);
    return ok;
  }
  function cancel(s, succession, office, at) {
    const v = s.vacancy; if (!v?.job && !v?.travel) return false;
    release(s, succession, office);
    note(v, at, 'interrupted', 'Attendance ended; records, partial costs and original queue remain. No signature, refunded work or stock follows.'); return true;
  }
  function release(s, succession, office) {
    const v = s.vacancy;
    const id = v.job?.id || v.travel.id;
    for (const a of [office.clerk, s.candidate, reviewer(s, succession)]) if (a?.assignment === id) a.assignment = null;
    if (office.assignment === id) office.assignment = null;
    v.job = null; v.travel = null;
  }
  function advance(s, succession, upkeep, office, institutions, stacks, c, at, effects = {}) {
    const v = s?.vacancy; if (!v || !c.alive || at < v.lastAt) return false;
    v.lastAt = at;
    if (v.travel) {
      const t = v.travel, delta = at - t.lastAt; t.lastAt = at;
      if (!supported(s, succession, upkeep, office, c) || !appointmentCurrent(s, succession, office)
        || !able(s.candidate) || s.candidate.assignment !== t.id || s.candidate.locationId !== s.officeId
        || c.bodyEpoch !== s.bodyEpoch || c.activeViolence) { t.credit = 0; return false; }
      t.credit = Math.min(60, t.credit + delta);
      while (t.credit >= 1 && s.candidate.workSeconds >= 1 && !cellSame(s.candidate.mapCell, t.target)) {
        t.credit--; if (!effects.move?.(s.candidate, t.target)) { t.credit = 0; return false; } s.candidate.workSeconds--;
      }
      if (!cellSame(s.candidate.mapCell, t.target)) return false;
      s.candidate.assignment = null; v.travel = null; v.phase = 'atPost'; note(v, at, 'arrival', 'The same living technician reached the real post. Actual inspected transfer remains required.'); return true;
    }
    const j = v.job; if (!j) return false;
    if (!local(s, succession, upkeep, office, c) || !attended(s, succession, office, c, j.kind, j.id)
      || !same(j.evidence, evidence(s, succession)) || !deceased(old(s, succession))
      || j.kind === 'observe' && !c.deathVisible || j.kind !== 'observe' && !deathCurrent(s, succession, office)
      || j.kind === 'appoint' && (!same(j.terms, v.terms) || at >= v.terms.expiresAt || !eligible(s))
      || j.kind === 'transfer' && (!appointmentCurrent(s, succession, office) || !c.accessInventoryVisible
        || !cellSame(s.candidate.mapCell, upkeep.installation.workCell) || !same(j.inventory, inventory(succession, upkeep, stacks)))
      || upkeep.job || upkeep.rests.length || upkeep.resistance?.job || succession.job
      || succession.directive?.cargo || ['ordered', 'carrying'].includes(succession.directive?.status)) return cancel(s, succession, office, at);
    const start = j.lastAt; j.lastAt = at;
    const ready = c.externalPowered && office.assignment === j.id && office.workSeconds > 0
      && participants(s, succession, office, j.kind).every(a => a.assignment === j.id && (a === office.clerk || a.workSeconds > 0))
      && (j.kind !== 'review' || c.reviewAvailable && institutions?.offices[s.reviewerInstitutionId]?.available
        && institutions.roles['civic-review'] === s.reviewerInstitutionId && institutions.cityId === s.cityId
        && institutions.offices[s.reviewerInstitutionId].jobs[v.review.id]?.readyAt === v.review.readyAt);
    if (!ready) { j.wasReady = false; return false; }
    const work = j.wasReady ? Math.min(at - start, j.seconds - j.progress, office.workSeconds,
      ...participants(s, succession, office, j.kind).filter(a => a !== office.clerk).map(a => a.workSeconds)) : 0;
    j.wasReady = true; j.progress += work; office.workSeconds -= work;
    for (const a of participants(s, succession, office, j.kind)) if (a !== office.clerk) a.workSeconds -= work;
    if (j.progress < j.seconds) return false;
    const done = start + work;
    if (j.kind === 'observe') {
      v.death = { id: `${v.id}:inspected-death`, at: done, observerId: 'scientist', recorderId: s.clerkId, evidence: copy(j.evidence) };
      office.publicWorksDeaths ||= []; office.publicWorksDeaths.push(copy(v.death)); v.phase = 'deathRecorded';
      note(v, done, 'death', 'Personally inspected death recorded. Legal cases, witness evidence, possessions and unfinished duties remain; this is not consent or immunity.');
    } else if (j.kind === 'discuss') {
      v.dossier = { at: done, recorderId: s.clerkId, candidateId: s.candidate.id, credential: copy(s.candidate.credential),
        willing: s.candidate.appointmentPolicy === 'considerExactDuties' }; v.phase = 'discussed';
    } else if (j.kind === 'review') {
      v.review.status = 'completed'; v.review.at = done; v.review.evidence = copy(v.proposal);
      v.review.outcome = eligible(s) ? 'eligible' : 'ineligible'; v.phase = v.review.outcome;
      v.review.finding = eligible(s) ? 'Locally established death, published authority and this consenting qualified candidate support one vacancy appointment. No deceased signature, guilt or immunity follows.'
        : 'This candidate lacks the required competence or willingness. Unchanged facts cannot reroll the finding.';
      if (eligible(s)) v.terms = { id: `${v.review.id}:terms`, reviewId: v.review.id, candidateId: s.candidate.id,
        deceasedId: s.incumbentId, workCap: 1200, expiresAt: done + 3600, bodyEpoch: s.bodyEpoch, scope: LIMITS,
        duties: 'Maintain the existing supplied counter only after actual custody-inspected transfer. Three real parts, finite duty and delivered power remain required; old deadlines, missing goods, original cases and unrecovered deceased cargo remain.' };
    } else if (j.kind === 'appoint') {
      v.appointment = { id: `${v.id}:appointment`, at: done, reviewId: v.review.id, candidateId: s.candidate.id,
        deceasedId: s.incumbentId, recorderId: s.clerkId, handoverId: s.handoverId, institutionId: s.institutionId,
        origin: 'reviewedDeathVacancy', terms: copy(j.terms) };
      office.publicWorksAppointments ||= []; office.publicWorksAppointments.push(copy(v.appointment)); v.phase = 'appointed';
    } else if (j.kind === 'transfer') {
      v.receipt = { id: `${v.id}:physical-transfer`, at: done, appointmentId: v.appointment.id,
        incomingId: s.candidate.id, deceasedId: s.incumbentId, recorderId: s.clerkId, installationId: s.installationId,
        origin: 'reviewedDeathVacancy', inventory: copy(j.inventory), deathId: v.death.id };
      office.publicWorksTransfers ||= []; office.publicWorksTransfers.push(copy(v.receipt));
      v.agreement = { id: `${v.receipt.id}:agreement`, personId: s.candidate.id, institutionId: s.institutionId,
        roles: [ROLE], at: done, terms: copy(v.terms), suspendedRoles: [] };
      s.commandRelationship = { personId: s.candidate.id, institutionId: s.institutionId, roles: [ROLE], authorityId: 'scientist', agreementAt: done };
      s.archivedResistance = copy(upkeep.resistance || null); upkeep.resistance = null;
      old(s, succession).officeStatus = { status: 'replacedByReviewedAppointment', at: done, receiptId: v.receipt.id,
        rights: 'Deceased person; original property, faith, cases, bodily remains and custody history retained.' };
      const oldLink = succession.control.commandRelationships?.find(a => a.personId === s.incumbentId);
      if (oldLink) { oldLink.roleStates ||= {}; oldLink.roleStates[ROLE] = { status: 'replaced', at: done, sourceId: v.receipt.id }; }
      s.candidate.roles = [ROLE]; s.candidate.role = 'Appointed public-works official — death-vacant counter maintenance';
      upkeep.workerId = s.candidate.id; upkeep.appointmentId = v.receipt.id; upkeep.workCaps[s.candidate.id] = v.terms.workCap;
      upkeep.inspection = null; v.phase = 'transferred';
      note(v, done, 'transfer', 'Actual inspected vacancy transfer completed. Service remains overdue until real repair; no body movement, deceased signature, stock reset or cleared legal case follows.');
    }
    release(s, succession, office);
    if (!['observe', 'transfer'].includes(j.kind)) note(v, done, j.kind, v.review?.finding || `Attended vacancy ${j.kind} completed; no ordinary service or physical custody was fabricated.`);
    return true;
  }
  function authorization(s, succession, upkeep, office, c) {
    const v = s?.vacancy, r = v?.receipt;
    return supported(s, succession, upkeep, office, c) && c.alive && c.bodyEpoch === s.bodyEpoch
      && appointmentCurrent(s, succession, office) && r?.id === upkeep.appointmentId
      && r.origin === 'reviewedDeathVacancy' && r.appointmentId === v.appointment.id && r.deathId === v.death.id
      && r.incomingId === s.candidate.id && r.deceasedId === s.incumbentId && r.recorderId === s.clerkId
      && r.installationId === s.installationId && r.inventory?.installation?.id === s.installationId
      && same(s.candidate.roles, [ROLE]) && upkeep.workCaps[s.candidate.id] === v.terms.workCap
      && v.agreement?.personId === s.candidate.id && v.agreement.institutionId === s.institutionId
      && same(v.agreement.terms, v.terms) && office.publicWorksTransfers?.some(t => same(t, r)) ? v.agreement : null;
  }
  function battery(s, succession, upkeep, office, stacks, c, at) {
    if (!local(s, succession, upkeep, office, c) || !deceased(old(s, succession)) || !s.vacancy && !c.deathVisible
      || !attended(s, succession, office, c, 'observe') || office.assignment || s.vacancy?.job || s.vacancy?.travel || office.workSeconds < 30
      || !c.externalPowered || office.power >= 12) return false;
    const item = stacks.find(i => i.key === 'relayBattery' && i.quantity >= 1 && i.carriedBy === 'scientist'
      && !i.cityOwnerId && !i.reservedTaskId && !i.fixtureId && !i.containerId && !i.toolInstanceId && !i.tags?.includes('contaminated'));
    if (!item) return false;
    ensure(s, c, at);
    item.quantity--; item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity);
    const receipt = { id: `${s.vacancy.id}:battery:${s.vacancy.nextNumber++}`, at, key: 'relayBattery', quantity: 1,
      stackId: item.id, custodianId: s.clerkId, suppliedOperations: 12 - office.power };
    office.power = 12; office.workSeconds -= 30; upkeep.receipts.push(receipt);
    note(s.vacancy, at, 'battery', 'One actual carried battery supplied finite emergency counter power, not ordinary service restoration.'); return true;
  }
  function publicView(v) {
    if (!v) return null;
    return { rule: copy(v.rule), phase: v.phase, death: copy(v.death), dossier: copy(v.dossier), proposal: copy(v.proposal),
      review: copy(v.review), terms: copy(v.terms), appointment: copy(v.appointment), receipt: copy(v.receipt),
      interruptedDuties: copy(v.interruptedDuties), working: v.job && { kind: v.job.kind, seconds: v.job.seconds, progress: v.job.progress },
      approaching: Boolean(v.travel), message: v.message, history: copy(v.history), limitations: LIMITS };
  }
  return { ruleFor, supported, observe, discuss, propose, hear, appoint, approach, transfer, cancel, advance, authorization, battery, publicView };
});
