const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public-works-appointments');
const Administration = require('../city-administration');
const Resistance = require('../city-resistance');
const Succession = require('../city-succession');
const Institutions = require('../home-institution-context');
const Registry = require('../carrier-identity');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' };
  Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Actual registry', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0]; office.civicCounter = { cell: { x: 17, y: 8, z: 6 } };
  office.clerk.mapCell = { x: 18, y: 8, z: 6 }; office.power = 12;
  const person = (id, role, cell) => ({ id, name: id, institutionId: id, roles: [role], actorKind: 'civicOfficeholder',
    status: 'alive', health: 78, fatigue: 4, workSeconds: 1000, assignment: null, roomId: 'supportedSurveyGround', locationId: office.id, mapCell: copy(cell) });
  const old = person('works:a', A.ROLE, { x: 16, y: 12, z: 6 }), reviewer = person('review:a', 'civicReview', { x: 15, y: 10, z: 6 });
  const admin = person('admin:a', 'centralAdministration', { x: 15, y: 9, z: 6 });
  const source = { cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a', population: 100,
    publicWorksAppointment: A.ruleFor('a', old.institutionId, reviewer.institutionId),
    institutions: [old, reviewer, admin].map(a => ({ role: a.roles[0], id: a.institutionId, officeRoles: [...a.roles], appointmentMethod: 'appointmentBySovereignAuthority' })) };
  const succession = { id: 'succession:a', officeId: office.id, source: copy(source), ruler: person('ruler:a', 'ruler', { x: 14, y: 9, z: 6 }),
    allocation: { populationSourceId: 'population:a', people: 4 }, leaders: [old, reviewer, admin],
    handover: { id: 'handover:a', at: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0,
      commandRelationships: [{ personId: old.id, institutionId: old.institutionId, roles: [A.ROLE] }] },
    agreements: [{ personId: old.id, roles: [A.ROLE] }], provision: { stock: 15, receipts: [{ id: 'old-reserve', quantity: 18, custodianId: 'defender:a' }] } };
  const bargain = { officeId: office.id, representative: person('rep:a', 'representative', { x: 18, y: 9, z: 6 }),
    defender: { ...person('defender:a', 'defender', { x: 19, y: 9, z: 6 }), wardMana: 5 } };
  const upkeep = Administration.create(succession, bargain, office);
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, activeViolence: false, cityId: 'a', bodyEpoch: 0,
    charterCurrent: true, administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true,
    externalPowered: true, reviewAvailable: true, appointmentRule: copy(source.publicWorksAppointment),
    appointmentOffice: { id: old.institutionId, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' } };
  const s = A.create(succession, upkeep, office, source, 0); succession.appointments = s;
  s.candidate.credential.maintenance = 50; s.candidate.appointmentPolicy = 'considerExactDuties'; s.incumbentPolicy = 'contestThenRelease';
  c.presentIds = [office.clerk.id, old.id, reviewer.id, s.candidate.id];
  c.staffPresentIds = Administration.staff(succession, bargain, office).map(a => a.id);
  const institutions = Institutions.create({ cityId: 'a' }, source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 0);
  upkeep.resistance = Resistance.create(upkeep, succession, office, c);
  return { s, succession, upkeep, office, source, c, institutions, bargain, old, reviewer, stacks: [], at: 0 };
}
const move = (a, target) => { for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) {
  a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true;
} return false; };
function step(f, seconds, effects = {}) { f.at += seconds; return A.advance(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at, { move, ...effects }); }
function discuss(f) { assert.equal(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, f.at), true); step(f, 60); }
function propose(f) { discuss(f); assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, copy(f.s.dossier), f.c, f.at), true); }
function hear(f) { propose(f); step(f, f.s.review.readyAt - f.at); assert.equal(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), true); step(f, 180); }
function appoint(f) { hear(f); assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, copy(f.s.terms), f.c, f.at), true); step(f, 60); }
function approach(f) { appoint(f); assert.equal(A.approach(f.s, f.succession, f.upkeep, f.office, f.c, f.at), true); step(f, 10); }
function transfer(f) { approach(f); assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, copy(f.s.appointment), f.c, f.at), true); step(f, 3); step(f, 120); }
test('replacement source requires actual handover, published law, a separate office and a real independent reviewer', () => {
  const f = fixture();
  for (const change of [g => g.succession.handover = null, g => g.succession.control.recognizedAuthorityId = 'claimant',
    g => g.source.publicWorksAppointment = null, g => g.source.publicWorksAppointment.minimumMaintenance = 0,
    g => g.old.roles.push('emergencyManagement'), g => g.source.institutions[0].officeRoles.push('emergencyManagement'),
    g => g.source.institutions[0].appointmentMethod = 'collectiveSelection', g => g.reviewer.institutionId = g.old.institutionId,
    g => g.upkeep.authorizationId = 'disputed-receipt', g => g.office.clerk = null]) {
    const g = fixture(); change(g); assert.equal(A.create(g.succession, g.upkeep, g.office, g.source, 0), null);
  }
  assert.deepEqual(f.s.rule, A.ruleFor('a', 'works:a', 'review:a')); assert.equal(f.s.receipt, null);
  assert.equal(f.upkeep.workerId, f.old.id); assert.equal(f.office.power, 12); assert.equal(f.succession.provision.stock, 15);
});
test('candidate allocation is deterministic, population-backed and not a guaranteed competent willing deputy', () => {
  const f = fixture(); const initial = A.create(f.succession, f.upkeep, f.office, f.source, 0);
  assert.deepEqual(A.create(f.succession, f.upkeep, f.office, f.source, 0), initial);
  assert.equal(initial.candidate.populationSourceId, f.source.populationSourceId);
  assert.equal(initial.allocation.people, 1); assert.equal(initial.candidate.workSeconds, 1200);
  const choices = new Set();
  for (let i = 0; i < 30; i++) {
    const source = { ...f.source, populationSourceId: `population:${i}` };
    const s = A.create({ ...f.succession, source }, f.upkeep, f.office, source, 0);
    choices.add(s.candidate.appointmentPolicy); choices.add(s.candidate.credential.maintenance < 40 ? 'underqualified' : 'qualified');
  }
  assert.ok(choices.has('declineOffice') && choices.has('underqualified') && choices.has('qualified'));
  const small = A.create(f.succession, f.upkeep, f.office, { ...f.source, population: 8 }, 0);
  assert.equal(small.candidate, null); assert.equal(small.allocation.people, 0);
  assert.equal(A.discuss(small, f.succession, f.upkeep, f.office, f.c, 0), false);
});
test('personally attended discussion consumes exact finite work and power without granting credentials or an appointment', () => {
  const f = fixture(), before = copy({ old: f.old, incoming: f.s.candidate, handover: f.succession.handover });
  discuss(f);
  assert.equal(f.office.power, 11); assert.equal(f.old.workSeconds, before.old.workSeconds - 60);
  assert.equal(f.s.candidate.workSeconds, before.incoming.workSeconds - 60); assert.equal(f.office.workSeconds, 14340);
  assert.equal(f.s.dossier.credential.maintenance, 50); assert.equal(f.s.appointment, null); assert.equal(f.upkeep.workerId, f.old.id);
  assert.deepEqual(f.succession.handover, before.handover);
});
test('source, attendance, body, violence, shared assignments and supplies gate new appointment work', () => {
  for (const key of ['alive', 'capable', 'atCounter', 'visitPermission', 'clerkPresent', 'lineOfSight', 'charterCurrent',
    'administrationAvailable', 'publicWorksAvailable', 'geometryAvailable', 'externalPowered']) {
    const f = fixture(); f.c[key] = false; assert.equal(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, 0), false, key);
  }
  for (const change of [f => f.c.bodyEpoch++, f => f.c.activeViolence = true, f => f.c.busy = true,
    f => f.c.presentIds = [], f => f.office.power = 0, f => f.office.workSeconds = 59,
    f => f.old.workSeconds = 59, f => f.s.candidate.assignment = 'another-job', f => f.upkeep.job = { cargo: { quantity: 3 } },
    f => f.upkeep.rests.push({ personId: f.old.id }), f => f.office.maintenanceReady = false]) {
    const f = fixture(); change(f); assert.equal(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, 0), false);
  }
});
test('exact proposal reserves the existing independent queue once and retains the actual incumbent objection', () => {
  const f = fixture(); discuss(f);
  assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, { ...f.s.dossier, willing: false }, f.c, f.at), false);
  assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, f.s.dossier, f.c, f.at), true);
  assert.equal(f.office.workSeconds, 14310); assert.equal(f.s.candidate.workSeconds, 1110);
  assert.equal(f.s.review.readyAt, 7260); assert.equal(Object.keys(f.institutions.offices['review:a'].jobs).length, 1);
  assert.equal(f.s.proposal.objection.authorId, f.old.id); assert.match(f.s.proposal.objection.text, /not an admission/);
  assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, f.s.dossier, f.c, f.at), false);
  assert.equal(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), false);
});
test('real independent hearing records eligible or stable ineligible findings, never appointing or rerolling', () => {
  for (const change of [() => {}, f => f.s.candidate.credential.maintenance = 39, f => f.s.candidate.appointmentPolicy = 'declineOffice']) {
    const f = fixture(); change(f); hear(f);
    assert.equal(f.s.review.outcome, f.s.candidate.credential.maintenance < 40 || !f.s.dossier.willing ? 'ineligible' : 'eligible');
    assert.equal(f.reviewer.workSeconds, 820); assert.equal(f.s.appointment, null); assert.equal(f.upkeep.workerId, f.old.id);
    assert.equal(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), false);
    assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, f.s.dossier, f.c, f.at), false);
  }
});
test('partial attendance and outages survive reload without backfill or a fabricated signature', () => {
  const f = fixture(); assert.ok(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, 0)); step(f, 20);
  f.s = A.normalize(f.s); f.succession.appointments = f.s;
  f.c.externalPowered = false; step(f, 1000); assert.equal(f.s.job.progress, 20);
  const work = f.office.workSeconds; f.c.externalPowered = true; step(f, 1000);
  assert.equal(f.office.workSeconds, work); assert.equal(f.s.job.progress, 20);
  step(f, 40); assert.equal(f.s.dossier.at, f.at); assert.equal(f.s.job, null); assert.equal(f.office.power, 11);
});
test('leaving unfinished attendance releases assignments but retains costs and original review reservation', () => {
  const f = fixture(); propose(f); step(f, f.s.review.readyAt - f.at);
  assert.ok(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at)); step(f, 30);
  f.c.atCounter = false; step(f, 1000);
  assert.equal(f.s.job, null); assert.equal(f.s.review.status, 'queued'); assert.equal(f.office.assignment, null);
  assert.equal(f.reviewer.assignment, null); assert.equal(f.reviewer.workSeconds, 970);
  f.c.atCounter = true; assert.ok(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at)); step(f, 180);
  assert.equal(f.s.review.status, 'completed'); assert.equal(f.office.power, 9);
});
test('recorded appointment is optional exact finite consent, distinct from operational control', () => {
  const f = fixture(); hear(f);
  assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, { ...f.s.terms, workCap: 999999 }, f.c, f.at), false);
  assert.ok(A.appoint(f.s, f.succession, f.upkeep, f.office, f.s.terms, f.c, f.at)); step(f, 60);
  assert.equal(f.office.publicWorksAppointments.length, 1); assert.equal(f.s.appointment.control, 'pendingPhysicalHandover');
  assert.equal(f.s.receipt, null); assert.equal(f.upkeep.workerId, f.old.id); assert.equal(f.s.candidate.roles.length, 0);
  assert.equal(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c), null);
  assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, f.s.terms, f.c, f.at), false);
});
test('expired unsigned terms cannot be refreshed or completed across the deadline', () => {
  const f = fixture(); hear(f); step(f, 3600);
  assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, f.s.terms, f.c, f.at), false);
  assert.equal(f.s.appointment, null); assert.equal(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), false);
  const g = fixture(); hear(g); step(g, 3570); assert.ok(A.appoint(g.s, g.succession, g.upkeep, g.office, g.s.terms, g.c, g.at)); step(g, 60);
  assert.equal(g.s.appointment, null); assert.equal(g.s.job, null); assert.equal(g.office.power, 9);
});
test('physical approach uses the same actual person, path and finite walking work; blocked paths are not arrival', () => {
  const f = fixture(); appoint(f); assert.ok(A.approach(f.s, f.succession, f.upkeep, f.office, f.c, f.at));
  const before = copy(f.s.candidate); step(f, 1000, { move: () => false });
  assert.deepEqual(f.s.candidate.mapCell, before.mapCell); assert.equal(f.s.candidate.workSeconds, before.workSeconds);
  assert.equal(f.s.receipt, null); f.s = A.normalize(f.s); f.succession.appointments = f.s;
  step(f, 8); assert.equal(f.s.travel, null); assert.deepEqual(f.s.candidate.mapCell, f.upkeep.installation.workCell);
  assert.equal(f.s.candidate.workSeconds, before.workSeconds - 7); assert.equal(f.s.receipt, null);
});
test('incumbent physical obstruction preserves lawful appointment but grants no enforceable control or free eviction', () => {
  const f = fixture(); f.s.incumbentPolicy = 'retainInstallation'; approach(f);
  assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at), false);
  assert.equal(f.s.phase, 'obstructed'); assert.equal(f.s.obstruction.authorId, f.old.id); assert.equal(f.s.receipt, null);
  const record = copy(f.s.obstruction); step(f, 100000);
  assert.deepEqual(f.s.obstruction, record); assert.equal(f.upkeep.workerId, f.old.id); assert.equal(f.old.officeStatus, undefined);
  assert.equal(f.office.publicWorksAppointments.length, 1); assert.equal(f.office.publicWorksTransfers, undefined);
});
test('physical handover preserves old records, supplies, injury, deadlines and obligations without replenishment', () => {
  const f = fixture(); f.upkeep.resistance.commitment = { id: 'old-promise', duties: 'Actual supplied duty' };
  const before = copy({ handover: f.succession.handover, agreements: f.succession.agreements, provision: f.succession.provision,
    upkeep: f.upkeep, old: f.old, defender: f.bargain.defender });
  transfer(f);
  assert.deepEqual(f.succession.handover, before.handover); assert.deepEqual(f.succession.agreements, before.agreements);
  assert.deepEqual(f.succession.provision, before.provision); assert.deepEqual(f.upkeep.receipts, before.upkeep.receipts);
  assert.equal(f.upkeep.dueAt, before.upkeep.dueAt); assert.equal(f.upkeep.graceUntil, before.upkeep.graceUntil);
  assert.equal(f.old.health, before.old.health); assert.deepEqual(f.bargain.defender, before.defender);
  assert.deepEqual(f.s.archivedResistance, before.upkeep.resistance); assert.equal(f.upkeep.resistance, null);
  assert.equal(f.upkeep.workerId, f.s.candidate.id); assert.equal(f.s.candidate.workSeconds, 1200 - 60 - 30 - 180 - 60 - 7 - 120);
  assert.deepEqual(f.old.mapCell, A.RETIRED_POST);
  assert.equal(f.old.officeStatus.status, 'replacedByReviewedAppointment'); assert.equal(f.office.publicWorksTransfers.length, 1);
  assert.equal(Administration.authorization(f.upkeep, f.succession, f.office, f.c), f.s.agreement);
  assert.equal(Administration.worker(f.upkeep, f.succession), f.s.candidate);
  assert.equal(Succession.directive(f.succession, f.bargain, f.office, f.c, f.at), false);
  step(f, 1000); assert.equal(f.office.publicWorksTransfers.length, 1);
});
test('accepted cargo, staff recovery or other office jobs cannot be abandoned at transfer', () => {
  for (const change of [f => f.upkeep.job = { cargo: { quantity: 3 } }, f => f.upkeep.rests.push({ personId: f.old.id }),
    f => f.upkeep.resistance.job = { id: 'old-review' }, f => f.succession.directive = { status: 'carrying' }]) {
    const f = fixture(); approach(f); change(f);
    assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at), false);
    assert.equal(f.upkeep.workerId, f.old.id); assert.equal(f.s.receipt, null);
  }
});
test('outgoing release requires actual finite walking and preserves a blocked transfer across saves', () => {
  const f = fixture(); approach(f);
  assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at));
  const cell = copy(f.old.mapCell), work = f.old.workSeconds;
  step(f, 1000, { move: () => false });
  assert.deepEqual(f.old.mapCell, cell); assert.equal(f.old.workSeconds, work); assert.equal(f.s.job.progress, 0);
  assert.equal(f.s.receipt, null); assert.equal(f.upkeep.workerId, f.old.id);
  f.s = A.normalize(f.s); f.succession.appointments = f.s;
  step(f, 2); assert.equal(f.s.job.clearingPost, false); assert.equal(f.old.workSeconds, work - 2);
  step(f, 120); assert.equal(f.upkeep.workerId, f.s.candidate.id);
});
test('appointed official actually consumes original reserve parts in the existing maintenance loop', () => {
  const f = fixture(); transfer(f);
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 1000; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.upkeep.job, null); assert.equal(f.succession.provision.stock, 12);
  assert.equal(f.upkeep.receipts.filter(r => r.installationId).length, 1);
  assert.equal(f.upkeep.receipts.at(-1).personId, f.s.candidate.id);
  assert.equal(f.office.power, 7); assert.equal(f.old.health, 78);
});
test('new official can use separately supplied recovery and role-specific objections without inheriting old consent', () => {
  const f = fixture(); transfer(f);
  f.upkeep.resistance = Resistance.create(f.upkeep, f.succession, f.office, f.c);
  assert.equal(f.upkeep.resistance.workerId, f.s.candidate.id); assert.equal(f.upkeep.resistance.commitment, null);
  assert.ok(Resistance.propose(f.upkeep.resistance, f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Resistance.accept(f.upkeep.resistance, f.upkeep, f.succession, f.office, f.upkeep.resistance.offer, f.c, f.at));
  f.at += 60; Resistance.advance(f.upkeep.resistance, f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.institutions, f.c, f.at);
  assert.equal(f.upkeep.resistance.commitment.workerId, f.s.candidate.id);
  assert.ok(Resistance.unsupported(f.upkeep.resistance, f.upkeep, f.succession, f.office, f.c, f.at));
  assert.equal(f.s.commandRelationship.roleStates[A.ROLE].status, 'suspended');
  assert.deepEqual(f.succession.agreements, [{ personId: f.old.id, roles: [A.ROLE] }]);
  f.stacks.push({ id: 'real-ration', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  f.c.staffPresentIds.push(f.s.candidate.id);
  assert.ok(Administration.rest(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.s.candidate.id, f.c, f.at));
  f.at += Administration.REST; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at);
  assert.equal(f.s.candidate.workSeconds, 1200); assert.equal(f.stacks[0].quantity, 0);
  assert.equal(f.s.commandRelationship.roleStates[A.ROLE].status, 'suspended');
});
test('replacement authorization rejects missing custody records, swapped people, charter/body changes and forged evidence', () => {
  for (const change of [f => f.office.publicWorksAppointments = [], f => f.office.publicWorksTransfers = [],
    f => f.s.candidate.id = 'replacement-person', f => f.s.candidate.credential.maintenance++,
    f => f.s.receipt.incomingId = 'another', f => f.c.bodyEpoch++, f => f.c.appointmentRule = null,
    f => f.c.appointmentOffice.roles.push('emergencyManagement'), f => f.office.civicCounter.cell.x++,
    f => f.s.review.evidence.reason = 'convictForDisagreement', f => f.s.review.reviewerId = f.s.candidate.id,
    f => f.succession.handover.id = 'other', f => f.office.clerk.id = 'other', f => f.s.agreement.terms.workCap++,
    f => f.s.candidate.roles.push('militaryDefenseCommand'), f => f.upkeep.workCaps[f.s.candidate.id] = 999999]) {
    const f = fixture(); transfer(f); change(f);
    assert.equal(Administration.authorization(f.upkeep, f.succession, f.office, f.c), null);
    assert.equal(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at), false);
  }
});
test('death freezes appointment jobs and history; public knowledge omits private reserves and dispositions', () => {
  const f = fixture(); assert.ok(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, 0));
  const before = copy(f.s); f.c.alive = false; step(f, 1000000); assert.deepEqual(f.s, before);
  const view = A.publicView(f.s);
  assert.deepEqual(A.publicView(A.normalize(f.s)), view);
  assert.doesNotMatch(JSON.stringify(view), /appointmentPolicy|incumbentPolicy|workSeconds|"health"|wardMana|"stock"/);
});
