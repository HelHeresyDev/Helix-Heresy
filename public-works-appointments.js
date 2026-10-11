(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./home-institution-context') : root.HelixHomeInstitutionContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixPublicWorksAppointments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Institutions) {
  'use strict';
  const ROLE = 'publicWorksAndProvisioning', REASON = 'changeMaintenanceSteward';
  const HOME = Object.freeze({ x: 19, y: 12, z: 6 });
  const RETIRED_POST = Object.freeze({ x: 14, y: 12, z: 6 });
  const RECEIVING = Object.freeze({ x: 16, y: 12, z: 6 });
  const ACCESS_RIGHTS = 'Original policy dissent, private property, faith, injuries and legal cases remain. This witnessed custody account neither grants immunity nor certifies missing goods as present. No worship, loyalty, eviction or violence is authorized. The remote defender reserve is outside this inspection.';
  const LIMITS = 'One separate public-works office and its existing counter upkeep only. A recorded appointment is not physical control. No criminal finding, confiscation, forced eviction, army, divine approval or ambition completion. Former officials retain personal rights, faith and legal cases.';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cellSame = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const hash = id => [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const incumbent = (s, succession) => succession?.leaders.find(a => a.id === s?.incumbentId);
  const reviewer = (s, succession) => succession?.leaders.find(a => a.id === s?.reviewerId);
  function ruleFor(cityId, institutionId, reviewInstitutionId) {
    return { id: `${cityId}:public-works-appointment-law`, method: 'reviewedPublicWorksReplacement',
      role: ROLE, institutionId, reviewInstitutionId, appointmentMethod: 'appointmentBySovereignAuthority',
      minimumMaintenance: 40, requiredAuthorizationIds: [],
      reason: REASON, text: 'A charter-recognized sovereign may propose a non-punitive change of maintenance steward in this separate office. The named local municipal technician must consent and have documented maintenance competence of at least 40. The independent civic-review office hears the incumbent and checks authority and eligibility before a separately attended appointment and physical handover. Policy disagreement is not misconduct; private property, faith, cases and other offices remain independent.' };
  }
  function create(succession, upkeep, office, source, at) {
    const law = source?.publicWorksAppointment, a = succession?.leaders.find(p => p.id === upkeep?.workerId);
    const r = succession?.leaders.find(p => p.roles.includes('civicReview'));
    if (!law || !same(law, ruleFor(source.cityId, a?.institutionId, r?.institutionId))
      || !a || a.roles.length !== 1 || a.roles[0] !== ROLE || !r || r.id === a.id || r.institutionId === a.institutionId
      || source.institutions.find(i => i.role === ROLE)?.officeRoles?.length !== 1
      || source.institutions.find(i => i.role === ROLE)?.appointmentMethod !== law.appointmentMethod
      || !succession.handover || succession.control?.recognizedAuthorityId !== 'scientist' || upkeep.authorizationId
      || upkeep.officeId !== office?.id || !office?.clerk?.id || upkeep.charterId !== source.charterId
      || source.cityId !== succession.source.cityId || source.charterId !== succession.source.charterId
      || upkeep.cityId !== source.cityId || office.cityId !== source.cityId
      || !source.populationSourceId || !Number.isFinite(source.population)) return null;
    if (source.populationSourceId !== succession.source.populationSourceId) return null;
    const id = `${upkeep.id}:replacement`, n = hash(`${source.populationSourceId}:${a.institutionId}:municipal-technician`);
    // Allocate one existing local person, not a replenishable applicant market.
    // Leave room for the already materialized ruler, leaders, clerk, defender,
    // representative and any faithful representative. Small cities can lack a candidate.
    const enough = source.population > (succession.allocation?.people || succession.leaders.length + 1) + 4;
    const candidate = enough ? { id: `${id}:technician`, name: ['Mira Reed', 'Iven Holt', 'Kessa Vale', 'Ronan Ash'][n % 4],
      actorKind: 'municipalTechnician', role: 'Existing local municipal maintenance technician', roles: [],
      institutionId: a.institutionId, populationSourceId: source.populationSourceId,
      credential: { id: `${id}:service-record`, issuerInstitutionId: a.institutionId, populationSourceId: source.populationSourceId,
        maintenance: 25 + n % 46, basis: 'Existing municipal maintenance service record, not a laboratory employment credential' },
      appointmentPolicy: n % 5 === 0 ? 'declineOffice' : 'considerExactDuties',
      status: 'alive', health: 100, maxHealth: 100, fatigue: 0, workSeconds: 1200,
      roomId: 'supportedSurveyGround', locationId: office.id, mapCell: copy(HOME), assignment: null } : null;
    return { id, cityId: source.cityId, charterId: source.charterId, officeId: office.id, clerkId: office.clerk.id,
      handoverId: succession.handover.id, bodyEpoch: succession.control.bodyEpoch, rule: copy(law),
      incumbentId: a.id, institutionId: a.institutionId, reviewerId: r.id, reviewerInstitutionId: r.institutionId,
      installationId: upkeep.installation.id, populationSourceId: source.populationSourceId,
      allocation: { populationSourceId: source.populationSourceId, people: candidate ? 1 : 0 }, candidate,
      incumbentPolicy: hash(`${a.id}:replacement-response`) % 4 === 0 ? 'retainInstallation' : 'contestThenRelease',
      // Use a different modulus from the obstruction branch: hash parity
      // would otherwise give every obstructing incumbent the same concern.
      accessPolicy: hash(`${a.id}:custody-concern`) % 7 < 3 ? 'custodyAccountability' : 'rejectReplacement',
      access: { reason: null, inspection: null, offer: null, settlement: null, declined: null },
      phase: 'undiscussed', dossier: null, proposal: null, review: null, terms: null, appointment: null,
      receipt: null, agreement: null, commandRelationship: null, archivedResistance: null,
      job: null, travel: null, history: [], message: candidate ? 'Discuss the actual local technician and published replacement procedure.' : 'No additional local municipal technician can be allocated from this population.',
      nextNumber: 1, lastAt: at };
  }
  function normalize(s) {
    return s?.id && s.rule?.method === 'reviewedPublicWorksReplacement' && Array.isArray(s.history)
      && (!s.candidate || s.candidate.id && Number.isFinite(s.candidate.workSeconds)) ? copy(s) : null;
  }
  function note(s, at, kind, text) { s.history.push({ at, kind, text }); s.message = text; }
  function bound(s, succession, upkeep, office, c) {
    return Boolean(s && succession?.handover?.id === s.handoverId && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === s.bodyEpoch && succession.source.cityId === s.cityId && succession.source.charterId === s.charterId
      && same(c.appointmentRule, s.rule) && same(s.rule, ruleFor(s.cityId, s.institutionId, s.reviewerInstitutionId))
      && same(c.appointmentOffice, { id: s.institutionId, roles: [ROLE], appointmentMethod: s.rule.appointmentMethod })
      && upkeep?.installation.id === s.installationId && upkeep.officeId === s.officeId && upkeep.handoverId === s.handoverId
      && office?.id === s.officeId && office.cityId === s.cityId && office.clerk?.id === s.clerkId && office.active
      && same(office.civicCounter?.cell, upkeep.installation.cell)
      && c.charterCurrent && c.administrationAvailable && c.publicWorksAvailable && c.geometryAvailable
      && incumbent(s, succession)?.institutionId === s.institutionId && same(incumbent(s, succession)?.roles, [ROLE])
      && reviewer(s, succession)?.institutionId === s.reviewerInstitutionId && reviewer(s, succession)?.roles.includes('civicReview')
      && s.reviewerId !== s.incumbentId && s.reviewerId !== s.candidate?.id
      && upkeep.workerId === (s.receipt ? s.candidate?.id : s.incumbentId));
  }
  function localReason(s, succession, upkeep, office, c) {
    if (!bound(s, succession, upkeep, office, c)) return 'An actual voluntary sovereign handover, unchanged published appointment law, separate office and original independent reviewer are required.';
    if (!c.alive || !c.capable || !c.atCounter || !c.visitPermission || !c.clerkPresent || !c.lineOfSight
      || c.busy || c.activeViolence || c.cityId !== s.cityId || c.bodyEpoch !== s.bodyEpoch)
      return 'Attend the original municipal counter in the authenticated body, capable and free of other work or violence.';
    return '';
  }
  function free(s, succession, upkeep, office) {
    return !s.job && !s.travel && !office.assignment && !office.clerk.assignment && !succession.job
      && !upkeep.job && !upkeep.rests.length && !upkeep.resistance?.job && succession.directive?.status !== 'carrying';
  }
  function actors(s, succession, office, kind) {
    return [office.clerk, s.candidate, ...(['discuss', 'review', 'transfer', 'accessReason', 'accessInventory', 'accessSettle'].includes(kind) ? [incumbent(s, succession)] : []),
      ...(kind === 'review' ? [reviewer(s, succession)] : [])];
  }
  function attended(s, succession, office, c, kind, own = null) {
    return actors(s, succession, office, kind).every(a => able(a) && (!a.assignment || a.assignment === own)
      && a.locationId === office.id && c.presentIds?.includes(a.id));
  }
  function begin(s, succession, upkeep, office, c, at, kind, seconds, terms = null) {
    if (localReason(s, succession, upkeep, office, c) || !free(s, succession, upkeep, office)
      || !attended(s, succession, office, c, kind) || !c.externalPowered || office.maintenanceReady === false
      || at < (office.availableAt || 0) || office.power < 1 || office.workSeconds < seconds
      || actors(s, succession, office, kind).some(a => a !== office.clerk && a.workSeconds < seconds)) return false;
    const id = `${s.id}:work:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch, terms: copy(terms),
      clearingPost: kind === 'transfer' && !cellSame(incumbent(s, succession).mapCell, RETIRED_POST), walkCredit: 0 };
    office.power--; office.assignment = id;
    for (const a of actors(s, succession, office, kind)) a.assignment = id;
    note(s, at, kind, `Started attended ${kind}; original staff duty and one finite counter operation are required.`); return true;
  }
  function discuss(s, succession, upkeep, office, c, at) {
    return !s.dossier && !s.receipt && begin(s, succession, upkeep, office, c, at, 'discuss', 60);
  }
  function propose(s, succession, upkeep, office, institutions, expected, c, at) {
    if (localReason(s, succession, upkeep, office, c) || !s.dossier || !same(expected, s.dossier) || s.proposal
      || !free(s, succession, upkeep, office) || !attended(s, succession, office, c, 'discuss')
      || !c.reviewAvailable || !able(reviewer(s, succession)) || office.maintenanceReady === false
      || office.workSeconds < 30 || s.candidate.workSeconds < 30 || !c.externalPowered
      || institutions?.cityId !== s.cityId || institutions.roles['civic-review'] !== s.reviewerInstitutionId) return false;
    const id = `${s.id}:proposal`, readyAt = Institutions.reserve(institutions, 'civic-review', `${id}:review`, at);
    if (readyAt == null) return false;
    office.workSeconds -= 30; s.candidate.workSeconds -= 30;
    s.proposal = { id, at, authorId: 'scientist', reason: REASON, candidateId: s.candidate.id,
      incumbentId: s.incumbentId, ruleId: s.rule.id, dossier: copy(s.dossier),
      objection: { authorId: s.incumbentId, at, text: 'I oppose this policy replacement and ask the independent reviewer to preserve my rights and the installation records. This disagreement is not an admission of misconduct.' } };
    s.review = { id: `${id}:review`, readyAt, status: 'queued', reviewerId: s.reviewerId, proposalId: id };
    s.phase = 'queued'; note(s, at, 'proposal', 'The incumbent contested the proposed non-punitive appointment. The original independent queue was reserved; no appointment or physical control follows.'); return true;
  }
  function hear(s, succession, upkeep, office, institutions, c, at) {
    return Boolean(s.review?.status === 'queued' && at >= s.review.readyAt && c.reviewAvailable
      && institutions?.cityId === s.cityId && institutions.roles['civic-review'] === s.reviewerInstitutionId
      && institutions.offices[s.reviewerInstitutionId]?.available
      && institutions.offices[s.reviewerInstitutionId].jobs[s.review.id]?.readyAt === s.review.readyAt
      && begin(s, succession, upkeep, office, c, at, 'review', 180));
  }
  function appoint(s, succession, upkeep, office, expected, c, at) {
    return Boolean(s.review?.status === 'completed' && s.review.outcome === 'eligible' && !s.appointment
      && s.terms && same(expected, s.terms) && at < s.terms.expiresAt
      && s.candidate.appointmentPolicy === 'considerExactDuties' && eligibility(s)
      && begin(s, succession, upkeep, office, c, at, 'appoint', 60, expected));
  }
  function approach(s, succession, upkeep, office, c, at) {
    if (localReason(s, succession, upkeep, office, c) || !s.appointment || s.receipt || !free(s, succession, upkeep, office)
      || !able(s.candidate) || s.candidate.assignment || !c.presentIds?.includes(s.candidate.id)) return false;
    const id = `${s.id}:approach`;
    s.travel = { id, target: copy(upkeep.installation.workCell), lastAt: at, credit: 0 };
    s.candidate.assignment = id; s.phase = 'approaching';
    note(s, at, 'approach', 'The appointed technician must physically reach the existing maintenance post. An order is not arrival or control.'); return true;
  }
  function transfer(s, succession, upkeep, office, expected, c, at, stacks = null) {
    if (!s.appointment || s.receipt || !same(expected, s.appointment) || !cellSame(s.candidate?.mapCell, upkeep.installation.workCell)) return false;
    if (!releaseAllowed(s, office)) {
      if (!localReason(s, succession, upkeep, office, c) && attended(s, succession, office, c, 'transfer') && !s.obstruction) {
        s.obstruction = { at, authorId: s.incumbentId, installationId: s.installationId,
          text: 'The outgoing official refuses to release physical access and the installation records. Lawful appointment remains recorded, but enforceable control has not transferred. No eviction or violence is authorized here.' };
        s.phase = 'obstructed'; note(s, at, 'obstruction', s.obstruction.text);
      }
      return false;
    }
    if (s.incumbentPolicy === 'retainInstallation' && (!c.accessInventoryVisible || !Array.isArray(stacks)
      || !same(s.access.inspection.inventory, custodyInventory(succession, upkeep, stacks)))) return false;
    return begin(s, succession, upkeep, office, c, at, 'transfer', 120, expected);
  }
  function accessReady(s, succession, upkeep, office, c) {
    return Boolean(s?.access && s.obstruction && !s.receipt && authenticAppointment(s, office) && eligibility(s)
      && !localReason(s, succession, upkeep, office, c)
      && cellSame(s.candidate.mapCell, upkeep.installation.workCell));
  }
  function discussAccess(s, succession, upkeep, office, c, at) {
    return Boolean(accessReady(s, succession, upkeep, office, c) && !s.access.reason
      && begin(s, succession, upkeep, office, c, at, 'accessReason', 60));
  }
  // Only supplies on the physically inspected receiving tile and their existing
  // counter records. Do not inspect a private inventory or the distant reserve.
  function custodyInventory(succession, upkeep, stacks) {
    const goods = stacks.filter(i => cellSame(i.cell, RECEIVING) && !i.carriedBy && !i.containerId && !i.fixtureId && !i.toolInstanceId && i.cityOwnerId === upkeep.cityId
      && i.civicCustody?.cityId === upkeep.cityId).map(i => ({ id: i.id, key: i.key, quantity: i.quantity,
        cell: copy(i.cell), custody: copy(i.civicCustody), reservation: i.reservedTaskId || null }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const manifest = succession.directive?.receipt || null;
    const consumed = manifest ? upkeep.receipts.filter(r => r.installationId && r.manifest?.sourceId === manifest.stackId)
      .reduce((n, r) => n + r.quantity, 0) : 0;
    const expected = manifest ? Math.max(0, manifest.quantity - consumed) : null;
    const observed = manifest ? goods.find(i => i.id === manifest.stackId)?.quantity || 0 : null;
    return { installation: copy(upkeep.installation), dueAt: upkeep.dueAt, graceUntil: upkeep.graceUntil,
      servicedAt: upkeep.servicedAt, manifests: copy(upkeep.receipts), stagedManifest: copy(manifest), goods,
      reconciliation: { expected, observed, discrepancy: expected != null && expected !== observed }, scope: ACCESS_RIGHTS };
  }
  function inspectAccess(s, succession, upkeep, office, stacks, c, at) {
    return Boolean(accessReady(s, succession, upkeep, office, c) && s.access.reason?.kind === 'custodyAccountability'
      && !s.access.declined && c.accessInventoryVisible && Array.isArray(stacks)
      && (!s.access.inspection || !same(s.access.inspection.inventory, custodyInventory(succession, upkeep, stacks)))
      && begin(s, succession, upkeep, office, c, at, 'accessInventory', 120, custodyInventory(succession, upkeep, stacks)));
  }
  function settleAccess(s, succession, upkeep, office, stacks, expected, c, at) {
    return Boolean(accessReady(s, succession, upkeep, office, c) && authenticInspection(s, office)
      && same(s.access.offer, accessOffer(s.access.inspection)) && !s.access.settlement && !s.access.declined && at < s.access.offer.expiresAt
      && same(expected, s.access.offer) && c.accessInventoryVisible && Array.isArray(stacks)
      && same(s.access.inspection.inventory, custodyInventory(succession, upkeep, stacks))
      && begin(s, succession, upkeep, office, c, at, 'accessSettle', 60, expected));
  }
  function declineAccess(s, succession, upkeep, office, expected, c, at) {
    if (!accessReady(s, succession, upkeep, office, c) || !free(s, succession, upkeep, office)
      || !attended(s, succession, office, c, 'accessSettle') || !s.access.offer || !same(expected, s.access.offer)
      || s.access.settlement || s.access.declined || at >= s.access.offer.expiresAt) return false;
    s.access.declined = { at, authorId: 'scientist', offerId: s.access.offer.id };
    note(s, at, 'accessDeclined', 'Declined the optional custody settlement. No promise, access, transfer, refund or punishment follows.'); return true;
  }
  function authenticInspection(s, office) {
    const a = s.access, i = a?.inspection;
    return Boolean(i && a.reason?.kind === 'custodyAccountability' && s.accessPolicy === 'custodyAccountability'
      && i.appointmentId === s.appointment?.id && i.incomingId === s.candidate?.id && i.outgoingId === s.incumbentId
      && i.recorderId === s.clerkId && i.installationId === s.installationId && i.inventory?.scope === ACCESS_RIGHTS
      && office.publicWorksAccessInspections?.some(r => same(r, i)));
  }
  function accessOffer(i) {
    return { id: `${i.id}:offer`, inspectionId: i.id, appointmentId: i.appointmentId,
      incomingId: i.incomingId, outgoingId: i.outgoingId, recorderId: i.recorderId, installationId: i.installationId,
      inventory: copy(i.inventory), rights: ACCESS_RIGHTS, expiresAt: i.at + 3600,
      duties: 'Accept this exact witnessed custody account, retain the original objection and records, and voluntarily step aside before the existing attended physical handover. The account records discrepancies, not a clean-stock guarantee, immunity or loyalty.' };
  }
  function authenticSettlement(s, office) {
    const a = s.access, r = a?.settlement;
    return Boolean(r && authenticInspection(s, office) && same(a.offer, accessOffer(a.inspection)) && !a.declined
      && r.appointmentId === s.appointment?.id && r.inspectionId === a.inspection.id
      && r.incomingId === s.candidate?.id && r.outgoingId === s.incumbentId && r.recorderId === s.clerkId
      && r.installationId === s.installationId && r.authorId === 'scientist' && r.at < a.offer.expiresAt
      && same(r.terms, a.offer) && same(a.offer.inventory, a.inspection.inventory) && a.offer.rights === ACCESS_RIGHTS
      && office.publicWorksAccessSettlements?.some(x => same(x, r)));
  }
  const releaseAllowed = (s, office) => s.incumbentPolicy === 'contestThenRelease' || authenticSettlement(s, office);
  function release(s, succession, office) {
    if (!s.job) return;
    for (const a of actors(s, succession, office, s.job.kind)) if (a?.assignment === s.job.id) a.assignment = null;
    if (office.assignment === s.job.id) office.assignment = null;
    s.job = null;
  }
  function cancel(s, succession, office, at) {
    if (!s.job && !s.travel) return false;
    release(s, succession, office);
    if (s.travel && s.candidate.assignment === s.travel.id) s.candidate.assignment = null;
    s.travel = null;
    note(s, at, 'interrupted', 'Unfinished attendance or approach ended. Earlier documents, physical position, costs and original queue remain; no signature or handover was invented.'); return true;
  }
  function eligibility(s) {
    const a = s.candidate, d = s.proposal?.dossier;
    return Boolean(d && d.candidateId === a?.id && same(d.credential, a.credential)
      && a.populationSourceId === s.populationSourceId && a.credential.issuerInstitutionId === s.institutionId
      && a.credential.populationSourceId === s.populationSourceId && Number.isFinite(a.credential.maintenance)
      && a.credential.maintenance >= s.rule.minimumMaintenance && a.appointmentPolicy === 'considerExactDuties'
      && (!a.roles.length || s.receipt && same(a.roles, [ROLE])));
  }
  function advance(s, succession, upkeep, office, institutions, c, at, effects = {}) {
    if (!s || !c.alive || at < s.lastAt) return false;
    s.lastAt = at;
    if (s.travel) {
      const t = s.travel, delta = Math.max(0, at - t.lastAt); t.lastAt = at;
      if (!bound(s, succession, upkeep, office, c) || c.bodyEpoch !== s.bodyEpoch || !able(s.candidate)
        || s.candidate.locationId !== s.officeId || s.candidate.assignment !== t.id || c.activeViolence) { t.credit = 0; return false; }
      t.credit = Math.min(60, t.credit + delta);
      while (t.credit >= 1 && s.candidate.workSeconds >= 1 && !cellSame(s.candidate.mapCell, t.target)) {
        t.credit--; if (!effects.move?.(s.candidate, t.target)) { t.credit = 0; return false; }
        s.candidate.workSeconds--;
      }
      if (cellSame(s.candidate.mapCell, t.target)) {
        s.candidate.assignment = null; s.travel = null; s.phase = 'atPost';
        note(s, at, 'arrival', 'The same appointed person physically reached the existing post. Separate attended transfer is still required.'); return true;
      }
      return false;
    }
    const j = s.job; if (!j) return false;
    if (localReason(s, succession, upkeep, office, c) || c.bodyEpoch !== j.bodyEpoch
      || !attended(s, succession, office, c, j.kind, j.id)
      || j.kind === 'appoint' && (at >= s.terms.expiresAt || !same(j.terms, s.terms) || !eligibility(s))
      || ['accessReason', 'accessInventory', 'accessSettle'].includes(j.kind) && !accessReady(s, succession, upkeep, office, c)
      || ['accessInventory', 'accessSettle'].includes(j.kind) && (!c.accessInventoryVisible || !Array.isArray(effects.stacks)
        || !same(j.kind === 'accessInventory' ? j.terms : s.access.inspection?.inventory, custodyInventory(succession, upkeep, effects.stacks)))
      || j.kind === 'accessSettle' && (!authenticInspection(s, office) || !same(j.terms, s.access.offer)
        || !same(s.access.offer, accessOffer(s.access.inspection))
        || s.access.declined || at >= s.access.offer.expiresAt)
      || j.kind === 'transfer' && (!cellSame(s.candidate.mapCell, upkeep.installation.workCell) || !releaseAllowed(s, office)
        || s.incumbentPolicy === 'retainInstallation' && (!c.accessInventoryVisible || !Array.isArray(effects.stacks)
          || !same(s.access.inspection.inventory, custodyInventory(succession, upkeep, effects.stacks)))))
      return cancel(s, succession, office, at);
    const start = j.lastAt; j.lastAt = at;
    const valid = c.externalPowered && office.maintenanceReady !== false && office.assignment === j.id && office.workSeconds > 0
      && actors(s, succession, office, j.kind).every(a => a.assignment === j.id && (a === office.clerk || a.workSeconds > 0))
      && (j.kind !== 'review' || c.reviewAvailable && institutions?.offices[s.reviewerInstitutionId]?.available
        && institutions.offices[s.reviewerInstitutionId].jobs[s.review.id]?.readyAt === s.review.readyAt);
    if (!valid) { j.wasReady = false; return false; }
    if (j.clearingPost) {
      const a = incumbent(s, succession);
      j.walkCredit = j.wasReady ? Math.min(60, j.walkCredit + at - start) : 0; j.wasReady = true;
      let moved = false;
      while (j.walkCredit >= 1 && a.workSeconds >= 1 && !cellSame(a.mapCell, RETIRED_POST)) {
        j.walkCredit--;
        if (!effects.move?.(a, RETIRED_POST)) { j.walkCredit = 0; return moved; }
        a.workSeconds--; moved = true;
      }
      if (cellSame(a.mapCell, RETIRED_POST)) {
        j.clearingPost = false; j.walkCredit = 0;
        note(s, at, 'accessReleased', 'The outgoing official physically stepped aside to the agreed nearby private position. No teleport, eviction, signature or abandoned cargo was supplied; attend the actual two-minute handover.');
      }
      return moved;
    }
    const work = j.wasReady ? Math.min(at - start, j.seconds - j.progress, office.workSeconds,
      ...actors(s, succession, office, j.kind).filter(a => a !== office.clerk).map(a => a.workSeconds)) : 0;
    j.wasReady = true; j.progress += work; office.workSeconds -= work;
    for (const a of actors(s, succession, office, j.kind)) if (a !== office.clerk) a.workSeconds -= work;
    if (j.progress < j.seconds) return false;
    const completedAt = start + work;
    if (j.kind === 'discuss') {
      s.dossier = { at: completedAt, recorderId: s.clerkId, incumbentId: s.incumbentId, candidateId: s.candidate.id,
        credential: copy(s.candidate.credential), willing: s.candidate.appointmentPolicy === 'considerExactDuties',
        rule: copy(s.rule), reason: REASON, scope: LIMITS };
      s.phase = 'discussed'; note(s, completedAt, 'dossier', 'The original clerk checked the actual local service record and heard the candidate. Qualifications, willingness and published law are disclosed, not supplied by payment.');
    } else if (j.kind === 'review') {
      s.review.status = 'completed'; s.review.at = completedAt; s.review.outcome = eligibility(s) ? 'eligible' : 'ineligible';
      s.review.evidence = copy(s.proposal); s.review.rule = copy(s.rule);
      s.review.finding = s.review.outcome === 'eligible' ? 'Authority, documented competence and voluntary candidature meet this explicit non-punitive appointment procedure. The incumbent objection remains recorded; no misconduct or physical control is found.'
        : 'The candidate does not meet documented competence or voluntary candidature requirements. The unchanged proposal cannot be rerolled.';
      s.phase = s.review.outcome;
      if (s.review.outcome === 'eligible') s.terms = { id: `${s.review.id}:terms`, reviewId: s.review.id, candidateId: s.candidate.id,
        incumbentId: s.incumbentId, institutionId: s.institutionId, installationId: s.installationId,
        bodyEpoch: s.bodyEpoch, expiresAt: completedAt + 3600, workCap: 1200, releaseCell: copy(RETIRED_POST),
        duties: 'Maintain the existing municipal counter using three actual city-owned parts per one-day service period, its unchanged eight-hour grace, finite battery operations and individually supplied eight-hour off-duty recovery. No new stock, healed injuries or automatic daily work reset. Existing accepted work must finish before physical transfer; the outgoing person must voluntarily walk to the nearby private position at 14,12 on level 6 before the two-minute attended handover. Prospective objections use independent review.', scope: LIMITS };
      note(s, completedAt, 'finding', s.review.finding);
    } else if (j.kind === 'appoint') {
      s.appointment = { id: `${s.id}:appointment`, at: completedAt, authorId: 'scientist', recorderId: s.clerkId,
        reviewId: s.review.id, candidateId: s.candidate.id, incumbentId: s.incumbentId,
        charterId: s.charterId, handoverId: s.handoverId, institutionId: s.institutionId, terms: copy(j.terms),
        control: 'pendingPhysicalHandover', scope: LIMITS };
      office.publicWorksAppointments ||= []; office.publicWorksAppointments.push(copy(s.appointment));
      s.phase = 'appointed'; note(s, completedAt, 'appointment', 'Recorded the reviewed appointment once with the candidate consent. The outgoing official still holds the installation pending physical handover.');
    } else if (j.kind === 'accessReason') {
      const kind = s.accessPolicy === 'custodyAccountability' ? 'custodyAccountability' : 'rejectReplacement';
      s.access.reason = { at: completedAt, authorId: s.incumbentId, recorderId: s.clerkId, kind,
        text: kind === 'custodyAccountability'
          ? 'I still oppose replacement, but will consider voluntarily releasing access if we inspect the actual staged supplies and record custody and discrepancies without blaming me merely for this disagreement.'
          : 'I reject this replacement itself. A custody account does not answer my objection, and I will not release access under this settlement.' };
      note(s, completedAt, 'accessReasonReceived', s.access.reason.text);
    } else if (j.kind === 'accessInventory') {
      s.access.inspection = { id: `${j.id}:access-inspection`, at: completedAt, appointmentId: s.appointment.id,
        incomingId: s.candidate.id, outgoingId: s.incumbentId, recorderId: s.clerkId,
        installationId: s.installationId, inventory: copy(j.terms) };
      office.publicWorksAccessInspections ||= []; office.publicWorksAccessInspections.push(copy(s.access.inspection));
      s.access.settlement = null; // Earlier signed accounts remain in the original register.
      s.access.offer = accessOffer(s.access.inspection);
      note(s, completedAt, 'accessInventoryReceived', 'Recorded the jointly inspected staged supplies and original manifests. Discrepancies remain evidence, not a finding of guilt. An optional exact settlement is available for one hour; custody and control have not changed.');
    } else if (j.kind === 'accessSettle') {
      s.access.settlement = { id: `${j.id}:access-settlement`, at: completedAt, authorId: 'scientist',
        appointmentId: s.appointment.id, inspectionId: s.access.inspection.id, incomingId: s.candidate.id,
        outgoingId: s.incumbentId, recorderId: s.clerkId, installationId: s.installationId, terms: copy(j.terms) };
      office.publicWorksAccessSettlements ||= []; office.publicWorksAccessSettlements.push(copy(s.access.settlement));
      note(s, completedAt, 'accessSettlement', 'The actual outgoing and incoming people accepted the witnessed custody settlement. The original appointment and dissent remain; voluntary physical release and attended handover are still required.');
    } else if (j.kind === 'transfer') {
      // No cargo or staffing duty may be abandoned by replacing its owner.
      if (upkeep.job || upkeep.rests.length || upkeep.resistance?.job || succession.job || succession.directive?.status === 'carrying'
        || !authenticAppointment(s, office) || !eligibility(s)) { release(s, succession, office); return false; }
      s.receipt = { id: `${s.id}:physical-transfer`, at: completedAt, appointmentId: s.appointment.id,
        incomingId: s.candidate.id, outgoingId: s.incumbentId, recorderId: s.clerkId, installationId: s.installationId,
        dueAt: upkeep.dueAt, graceUntil: upkeep.graceUntil, servicedAt: upkeep.servicedAt,
        sourceReceiptIds: upkeep.receipts.map(r => r.id), reserveReceiptIds: succession.provision.receipts.map(r => r.id),
        ...(s.incumbentPolicy === 'retainInstallation' ? { accessSettlementId: s.access.settlement.id } : {}),
        scope: LIMITS };
      office.publicWorksTransfers ||= []; office.publicWorksTransfers.push(copy(s.receipt));
      s.agreement = { id: `${s.receipt.id}:agreement`, personId: s.candidate.id, institutionId: s.institutionId,
        roles: [ROLE], at: completedAt, terms: copy(s.appointment.terms), suspendedRoles: [] };
      s.commandRelationship = { personId: s.candidate.id, institutionId: s.institutionId, roles: [ROLE], authorityId: 'scientist', agreementAt: completedAt };
      s.archivedResistance = copy(upkeep.resistance || null); upkeep.resistance = null;
      incumbent(s, succession).officeStatus = { status: 'replacedByReviewedAppointment', at: completedAt, receiptId: s.receipt.id,
        rights: 'Living private individual; property, faith and cases retained.' };
      const oldLink = succession.control.commandRelationships?.find(a => a.personId === s.incumbentId);
      if (oldLink) { oldLink.roleStates ||= {}; oldLink.roleStates[ROLE] = { status: 'replaced', at: completedAt, sourceId: s.receipt.id }; }
      s.candidate.roles = [ROLE]; s.candidate.role = 'Appointed public-works official — existing counter maintenance';
      upkeep.appointmentId = s.receipt.id; upkeep.workerId = s.candidate.id; upkeep.inspection = null;
      upkeep.workCaps[s.candidate.id] = s.appointment.terms.workCap;
      s.phase = 'transferred'; note(s, completedAt, 'transfer', 'Actual local handover completed. The new official may maintain the same supplied counter; deadlines, stocks, original records and spent personal work are unchanged.');
    }
    release(s, succession, office); return true;
  }
  function authenticAppointment(s, office) {
    return Boolean(s.appointment && s.review?.status === 'completed' && s.review.outcome === 'eligible'
      && s.review.reviewerId === s.reviewerId && s.review.proposalId === s.proposal?.id
      && same(s.review.rule, s.rule) && same(s.review.evidence, s.proposal) && same(s.proposal.dossier, s.dossier)
      && s.proposal.reason === s.rule.reason && s.proposal.authorId === 'scientist'
      && s.appointment.authorId === 'scientist' && s.appointment.control === 'pendingPhysicalHandover'
      && s.appointment.reviewId === s.review.id && s.appointment.candidateId === s.candidate?.id
      && s.appointment.incumbentId === s.incumbentId && s.appointment.recorderId === s.clerkId
      && s.appointment.charterId === s.charterId && s.appointment.handoverId === s.handoverId
      && s.appointment.institutionId === s.institutionId && same(s.appointment.terms, s.terms)
      && office?.publicWorksAppointments?.some(r => same(r, s.appointment)));
  }
  function authorization(s, succession, upkeep, office, c) {
    return bound(s, succession, upkeep, office, c) && c.alive && c.bodyEpoch === s.bodyEpoch
      && s.receipt && s.receipt.id === upkeep.appointmentId && s.receipt.appointmentId === s.appointment?.id
      && s.receipt.incomingId === s.candidate?.id && s.receipt.outgoingId === s.incumbentId
      && s.receipt.recorderId === s.clerkId && s.receipt.installationId === upkeep.installation.id
      && s.candidate.id === upkeep.workerId && s.candidate.institutionId === s.institutionId
      && upkeep.workCaps[s.candidate.id] === s.appointment?.terms.workCap
      && same(s.candidate.roles, [ROLE]) && authenticAppointment(s, office) && eligibility(s)
      && (s.receipt.accessSettlementId ? authenticSettlement(s, office) && s.receipt.accessSettlementId === s.access.settlement.id
        : s.incumbentPolicy === 'contestThenRelease')
      && s.agreement?.personId === s.candidate.id && s.agreement.institutionId === s.institutionId
      && same(s.agreement.terms, s.appointment.terms)
      && office.publicWorksTransfers?.some(r => same(r, s.receipt)) ? s.agreement : null;
  }
  function publicView(s) {
    if (!s) return null;
    return { phase: s.phase, rule: copy(s.rule), candidate: s.candidate && { id: s.candidate.id, name: s.candidate.name },
      dossier: copy(s.dossier), proposal: copy(s.proposal), review: copy(s.review), terms: copy(s.terms),
      appointment: copy(s.appointment), receipt: copy(s.receipt), obstruction: copy(s.obstruction || null),
      access: copy(s.access || null),
      previousObjections: [s.archivedResistance?.notice, ...(s.archivedResistance?.incidents || [])]
        .filter(n => n?.receivedAt != null).map(n => ({ at: n.receivedAt, finding: n.finding, review: n.review?.status === 'completed' ? n.review.finding : null })),
      working: s.job && { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds, clearingPost: s.job.clearingPost },
      approaching: Boolean(s.travel), message: s.message, history: copy(s.history), limitations: LIMITS };
  }
  return { ROLE, REASON, HOME, RETIRED_POST, LIMITS, ruleFor, create, normalize, incumbent, reviewer, bound, localReason,
    discuss, propose, hear, appoint, approach, transfer, discussAccess, inspectAccess, settleAccess, declineAccess,
    custodyInventory, cancel, advance, authorization, publicView };
});
