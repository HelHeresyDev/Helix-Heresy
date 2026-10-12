const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../public-works-vacancies');
const A = require('../public-works-appointments');
const Administration = require('../city-administration');
const Resistance = require('../city-resistance');
const Institutions = require('../home-institution-context');
const Registry = require('../carrier-identity');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' };
  Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Original office', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0]; office.civicCounter = { cell: { x: 17, y: 8, z: 6 } };
  office.clerk.mapCell = { x: 18, y: 8, z: 6 }; office.power = 12;
  const person = (id, role, cell) => ({ id, name: id, institutionId: id, roles: [role], actorKind: 'civicOfficeholder',
    status: 'alive', health: 78, fatigue: 4, workSeconds: 1000, assignment: null, locationId: office.id,
    roomId: 'supportedSurveyGround', mapCell: copy(cell) });
  const old = person('works:a', A.ROLE, { x: 16, y: 12, z: 6 }), review = person('review:a', 'civicReview', { x: 15, y: 10, z: 6 });
  const admin = person('admin:a', 'centralAdministration', { x: 15, y: 9, z: 6 });
  const source = { cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a', population: 100,
    publicWorksAppointment: A.ruleFor('a', old.id, review.id), publicWorksVacancy: V.ruleFor('a', old.id, review.id),
    institutions: [old, review, admin].map(a => ({ role: a.roles[0], id: a.id, officeRoles: [...a.roles], appointmentMethod: 'appointmentBySovereignAuthority' })) };
  const succession = { id: 'succession:a', officeId: office.id, source: copy(source), leaders: [old, review, admin],
    allocation: { populationSourceId: 'population:a', people: 4 }, handover: { id: 'handover:a', at: 0 },
    control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: [] },
    agreements: [{ personId: old.id, roles: [A.ROLE] }], provision: { stock: 15, receipts: [{ id: 'original-reserve', quantity: 18, custodianId: 'defender:a' }] } };
  const bargain = { officeId: office.id, representative: person('rep:a', 'representative', { x: 18, y: 9, z: 6 }),
    defender: person('defender:a', 'defender', { x: 19, y: 9, z: 6 }) };
  const upkeep = Administration.create(succession, bargain, office);
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, activeViolence: false, cityId: 'a', bodyEpoch: 0,
    charterCurrent: true, administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true,
    externalPowered: true, reviewAvailable: true, deathVisible: true, accessInventoryVisible: true,
    appointmentRule: copy(source.publicWorksAppointment), vacancyRule: copy(source.publicWorksVacancy),
    appointmentOffice: { id: old.id, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' } };
  const s = A.create(succession, upkeep, office, source, 0); succession.appointments = s;
  s.candidate.credential.maintenance = 50; s.candidate.appointmentPolicy = 'considerExactDuties';
  c.presentIds = [office.clerk.id, review.id, s.candidate.id];
  const institutions = Institutions.create({ cityId: 'a' }, source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 0);
  old.status = 'dead'; old.health = 0; old.diedAt = 4;
  return { s, succession, upkeep, office, source, c, institutions, bargain, old, review, stacks: [], at: 4 };
}
const move = (a, target) => {
  for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) { a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true; }
  return false;
};
function step(f, seconds, effects = { move }) {
  f.at += seconds; return V.advance(f.s, f.succession, f.upkeep, f.office, f.institutions, f.stacks, f.c, f.at, effects);
}
function observe(f) { assert.ok(V.observe(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 30); }
function reviewed(f) {
  observe(f); assert.ok(V.discuss(f.s, f.succession, f.upkeep, f.office, f.c, f.at)); step(f, 60);
  assert.ok(V.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, copy(f.s.vacancy.dossier), f.c, f.at));
  step(f, f.s.vacancy.review.readyAt - f.at);
  assert.ok(V.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at)); step(f, 180);
}
function appointed(f) {
  reviewed(f); assert.ok(V.appoint(f.s, f.succession, f.upkeep, f.office, copy(f.s.vacancy.terms), f.c, f.at)); step(f, 60);
  assert.ok(V.approach(f.s, f.succession, f.upkeep, f.office, f.c, f.at)); step(f, 30);
}
function transferred(f) {
  appointed(f); assert.ok(V.transfer(f.s, f.succession, f.upkeep, f.office, f.stacks, copy(f.s.vacancy.appointment), f.c, f.at)); step(f, 120);
}
test('vacancy: local actual death and distinct exact law are required, never absence, wounds or dissent', () => {
  for (const change of [f => f.old.status = 'alive', f => f.old.health = 1, f => f.c.deathVisible = false,
    f => f.c.vacancyRule = null, f => f.succession.source.publicWorksVacancy = null, f => f.succession.handover = null,
    f => f.s.rule.method = 'reviewedDisputedPublicWorksReplacement', f => f.s.rule.method = 'reviewedCombinedPublicWorksReassignment',
    f => f.c.appointmentOffice.roles.push('emergencyManagement'), f => f.c.bodyEpoch++, f => f.c.atCounter = false,
    f => f.c.activeViolence = true, f => f.office.clerk.status = 'dead', f => f.c.externalPowered = false]) {
    const f = fixture(); change(f);
    assert.equal(V.observe(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
    assert.equal(f.s.vacancy, undefined);
  }
});
test('vacancy: overdue emergency hearing spends finite actual people and queue without restoring service', () => {
  const f = fixture(), original = copy({ handover: f.succession.handover, agreements: f.succession.agreements, cell: f.old.mapCell,
    stock: f.succession.provision.stock, deadlines: [f.upkeep.dueAt, f.upkeep.graceUntil], oldWork: f.old.workSeconds });
  f.office.maintenanceReady = false; const candidateId = f.s.candidate.id;
  transferred(f);
  assert.equal(f.s.vacancy.phase, 'transferred'); assert.equal(f.office.publicWorksDeaths.length, 1);
  assert.equal(f.office.publicWorksAppointments.length, 1); assert.equal(f.office.publicWorksTransfers.length, 1);
  assert.equal(f.old.workSeconds, original.oldWork); assert.deepEqual(f.old.mapCell, original.cell);
  assert.deepEqual(f.succession.handover, original.handover); assert.deepEqual(f.succession.agreements, original.agreements);
  assert.equal(f.succession.provision.stock, original.stock); assert.deepEqual([f.upkeep.dueAt, f.upkeep.graceUntil], original.deadlines);
  assert.equal(f.office.maintenanceReady, false); assert.equal(f.s.candidate.id, candidateId);
  assert.equal(f.upkeep.workerId, candidateId); assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.equal(Object.keys(f.institutions.offices[f.s.reviewerInstitutionId].jobs).length, 1);
  assert.match(f.s.vacancy.review.finding, /No deceased signature/);
  assert.equal(V.observe(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
});
test('vacancy: physical handover actually funds existing maintenance and candidate recovery without healing anyone', () => {
  const f = fixture(); transferred(f);
  f.at = f.upkeep.dueAt;
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 160; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.upkeep.job, null); assert.equal(f.succession.provision.stock, 12);
  assert.equal(f.upkeep.receipts.at(-1).personId, f.s.candidate.id);
  assert.equal(f.old.status, 'dead'); assert.equal(f.old.health, 0);
  f.c.staffPresentIds = [f.s.candidate.id, f.office.clerk.id];
  f.stacks.push({ id: 'food', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.ok(Administration.rest(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.s.candidate.id, f.c, f.at));
  f.at += 28800; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.s.candidate.workSeconds, 1200); assert.equal(f.stacks.at(-1).quantity, 0);
});
test('vacancy: incoming worker retains individual objections and real independent review without rewriting deceased consent', () => {
  const f = fixture(); transferred(f); const originalAgreements = copy(f.succession.agreements);
  const r = Resistance.create(f.upkeep, f.succession, f.office, f.c); f.upkeep.resistance = r;
  f.c.staffPresentIds = [f.s.candidate.id, f.review.id, f.office.clerk.id];
  const advance = seconds => {
    f.at += seconds;
    Resistance.advance(r, f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.institutions, f.c, f.at);
  };
  assert.equal(r.workerId, f.s.candidate.id);
  assert.ok(Resistance.propose(r, f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Resistance.accept(r, f.upkeep, f.succession, f.office, copy(r.offer), f.c, f.at)); advance(60);
  assert.ok(Resistance.unsupported(r, f.upkeep, f.succession, f.office, f.c, f.at));
  assert.equal(r.commandStatus, 'suspended'); assert.equal(r.notice.evidence.recipientId, f.s.candidate.id);
  assert.deepEqual(f.s.vacancy.agreement.suspendedRoles, [A.ROLE]);
  assert.deepEqual(f.succession.agreements, originalAgreements);
  assert.ok(Resistance.fileReview(r, f.upkeep, f.succession, f.office, f.institutions, f.c, f.at));
  advance(r.notice.review.readyAt - f.at);
  assert.ok(Resistance.hear(r, f.upkeep, f.succession, f.office, f.institutions, f.c, f.at)); advance(180);
  assert.equal(r.notice.review.status, 'completed'); assert.equal(r.notice.review.reviewerId, f.review.id);
  assert.equal(r.commandStatus, 'suspended'); assert.equal(f.old.status, 'dead');
  assert.deepEqual(f.succession.agreements, originalAgreements);
});
test('vacancy: no new candidate, refusal and insufficient competence stay stable across reload', () => {
  for (const change of [f => f.s.candidate.appointmentPolicy = 'declineOffice', f => f.s.candidate.credential.maintenance = 39]) {
    const f = fixture(); change(f); reviewed(f);
    assert.equal(f.s.vacancy.review.outcome, 'ineligible'); const saved = A.normalize(f.s);
    assert.deepEqual(saved, f.s); assert.equal(V.hear(saved, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), false);
    assert.equal(f.s.vacancy.terms, null);
  }
  const f = fixture(); f.s.candidate = null; observe(f);
  assert.equal(V.discuss(f.s, f.succession, f.upkeep, f.office, f.c, f.at), false);
});
test('vacancy: saved partial hearing pauses through outage without paid work backfill', () => {
  const f = fixture(); observe(f); V.discuss(f.s, f.succession, f.upkeep, f.office, f.c, f.at); step(f, 60);
  V.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, f.s.vacancy.dossier, f.c, f.at);
  step(f, f.s.vacancy.review.readyAt - f.at); V.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at);
  step(f, 90); f.s = A.normalize(f.s); f.succession.appointments = f.s;
  const paid = f.office.workSeconds; f.c.externalPowered = false; step(f, 200);
  assert.equal(f.s.vacancy.job.progress, 90); assert.equal(f.office.workSeconds, paid);
  f.c.externalPowered = true; step(f, 200); assert.equal(f.s.vacancy.job.progress, 90);
  step(f, 90); assert.equal(f.s.vacancy.review.outcome, 'eligible'); assert.equal(f.office.workSeconds, paid - 90);
});
test('vacancy: actual custody, blocked approach, expiry and altered authority prevent unsupported completion', () => {
  const f = fixture(); appointed(f); f.c.accessInventoryVisible = false;
  assert.equal(V.transfer(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.vacancy.appointment, f.c, f.at), false);
  f.c.accessInventoryVisible = true; V.transfer(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.vacancy.appointment, f.c, f.at);
  step(f, 60); f.stacks.push({ id: 'new', key: 'metalParts', quantity: 3, cell: { x: 16, y: 12, z: 6 }, cityOwnerId: 'a', civicCustody: { cityId: 'a', custodianId: f.old.id } });
  step(f, 60); assert.equal(f.s.vacancy.receipt, null); assert.equal(f.s.vacancy.job, null);
  const blocked = fixture(); reviewed(blocked);
  V.appoint(blocked.s, blocked.succession, blocked.upkeep, blocked.office, blocked.s.vacancy.terms, blocked.c, blocked.at); step(blocked, 60);
  V.approach(blocked.s, blocked.succession, blocked.upkeep, blocked.office, blocked.c, blocked.at);
  const cell = copy(blocked.s.candidate.mapCell); step(blocked, 90, { move: () => false }); assert.deepEqual(blocked.s.candidate.mapCell, cell);
  assert.equal(blocked.s.vacancy.receipt, null);
  for (const change of [g => g.c.bodyEpoch++, g => g.c.vacancyRule.text += ' more powers', g => g.old.status = 'alive',
    g => g.c.presentIds = [], g => g.c.alive = false]) {
    const g = fixture(); reviewed(g); change(g);
    assert.equal(V.appoint(g.s, g.succession, g.upkeep, g.office, g.s.vacancy.terms, g.c, g.at), false);
  }
});
test('vacancy: interrupted maintenance preserves carried parts at actual remains without stock refund or duplicate installation', () => {
  const f = fixture();
  f.upkeep.job = { id: 'old-job', workerId: f.old.id, source: { kind: 'reserve', id: 'reserve' }, progress: 55,
    status: 'installing', cargo: { key: 'metalParts', quantity: 3, custodianId: f.old.id, sourceId: 'reserve' } };
  f.old.assignment = 'old-job'; const stock = f.succession.provision.stock;
  observe(f);
  assert.equal(f.upkeep.job, null); assert.equal(f.old.civicMaintenanceCargo.quantity, 3);
  assert.deepEqual(f.old.civicMaintenanceCargo.cell, f.old.mapCell); assert.equal(f.succession.provision.stock, stock);
  assert.equal(f.s.vacancy.interruptedDuties[0].job.progress, 55); assert.equal(f.old.assignment, null);
  assert.equal(V.observe(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
});
test('vacancy: already collected original staging cargo stays at the body while its impossible duty is archived', () => {
  const f = fixture(); f.succession.directive = { id: 'original-staging', workerId: f.old.id, status: 'carrying',
    cargo: { key: 'metalParts', quantity: 3, custodianId: f.old.id, sourceReceiptIds: ['original-reserve'] }, receipt: null };
  f.old.assignment = f.succession.id; const stock = f.succession.provision.stock; observe(f);
  assert.equal(f.succession.directive.status, 'interruptedByDeath'); assert.equal(f.succession.directive.cargo, null);
  assert.equal(f.succession.directive.receipt, null); assert.equal(f.old.civicMaintenanceCargo.quantity, 3);
  assert.equal(f.old.civicMaintenanceCargo.interruptedDirectiveId, 'original-staging');
  assert.equal(f.s.vacancy.interruptedDuties[0].directive.cargo.quantity, 3);
  assert.equal(f.succession.provision.stock, stock); assert.equal(f.old.assignment, null);
});
test('vacancy: exhausted emergency power needs real carried clean battery and finite clerk work', () => {
  const f = fixture(); f.office.power = 0; f.office.maintenanceReady = false;
  assert.equal(V.observe(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
  assert.equal(V.battery(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
  f.stacks.push({ id: 'battery', key: 'relayBattery', quantity: 1, carriedBy: 'scientist' });
  assert.ok(V.battery(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at));
  assert.equal(f.stacks[0].quantity, 0); assert.equal(f.office.power, 12); assert.equal(f.office.maintenanceReady, false);
  observe(f); assert.equal(f.office.power, 11);
});
test('vacancy: earlier inactive civil records remain history, not a death-vacancy force commission or blocker', () => {
  const f = fixture(); f.s.enforcement = { phase: 'interrupted', order: { id: 'earlier-real-order' }, job: null, escort: null };
  const earlier = copy(f.s.enforcement); transferred(f);
  assert.deepEqual(f.s.enforcement, earlier); assert.equal(f.s.vacancy.receipt.origin, 'reviewedDeathVacancy');
  assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  const busy = fixture(); busy.s.enforcement = { job: { id: 'existing-hearing' } };
  assert.equal(V.observe(busy.s, busy.succession, busy.upkeep, busy.office, busy.stacks, busy.c, busy.at), false);
  assert.equal(busy.s.vacancy.death, null);
});
test('vacancy: blocked body-side staged supplies remain intact while real reachable reserve supports repair', () => {
  const f = fixture(); f.stacks.push({ id: 'body-side-parts', key: 'metalParts', quantity: 3,
    cell: { x: 16, y: 12, z: 6 }, cityOwnerId: 'a', civicCustody: { cityId: 'a', custodianId: f.old.id },
    reservedTaskId: `${f.succession.id}:city-maintenance-reserve` });
  transferred(f); f.c.stagedSupplyReachable = false; f.c.reserveCollectionCell = { x: 19, y: 10, z: 6 }; f.at = f.upkeep.dueAt;
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  assert.equal(f.upkeep.job.source.kind, 'reserve'); assert.deepEqual(f.upkeep.job.source.cell, f.c.reserveCollectionCell); f.at += 160;
  Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.stacks[0].quantity, 3); assert.equal(f.succession.provision.stock, 12);
  assert.deepEqual(f.old.mapCell, { x: 16, y: 12, z: 6 });
});
test('vacancy: a nonexistent or non-adjacent reserve pickup cannot invent accessible custody', () => {
  for (const cell of [null, { x: 1, y: 1, z: 6 }, { x: 19, y: 8, z: 5 }]) {
    const f = fixture(); transferred(f); f.at = f.upkeep.dueAt; f.c.reserveCollectionCell = cell;
    Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at);
    assert.equal(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at), false);
    assert.equal(f.succession.provision.stock, 15);
  }
});
test('vacancy: expiry, candidate death and scientist death preserve records and do not complete signatures', () => {
  const expired = fixture(); reviewed(expired); expired.at = expired.s.vacancy.terms.expiresAt;
  assert.equal(V.appoint(expired.s, expired.succession, expired.upkeep, expired.office, expired.s.vacancy.terms, expired.c, expired.at), false);
  for (const change of [f => { f.c.alive = false; }, f => { f.s.candidate.status = 'dead'; f.s.candidate.health = 0; }]) {
    const f = fixture(); reviewed(f); V.appoint(f.s, f.succession, f.upkeep, f.office, f.s.vacancy.terms, f.c, f.at); step(f, 30);
    change(f); const paid = f.office.workSeconds; step(f, 1000);
    assert.equal(f.s.vacancy.appointment, null); assert.equal(f.office.workSeconds, paid);
    assert.equal(f.s.vacancy.review.outcome, 'eligible');
  }
});
test('vacancy: forged appointment, transfer, death register or inherited role cannot authorize maintenance', () => {
  for (const change of [f => f.office.publicWorksDeaths = [], f => f.office.publicWorksTransfers = [],
    f => f.s.vacancy.receipt.origin = 'voluntaryHandover', f => f.s.vacancy.appointment.candidateId = 'other',
    f => f.s.vacancy.agreement.terms.workCap++, f => f.s.candidate.roles.push('emergencyManagement'),
    f => f.succession.source.publicWorksVacancy = null]) {
    const f = fixture(); transferred(f); change(f);
    assert.equal(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c), null);
  }
});
