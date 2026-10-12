const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../temporary-maintenance-commission');
const U = require('../city-administration');
const A = require('../public-works-appointments');
const Registry = require('../carrier-identity');
const Institutions = require('../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Counter', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0]; office.civicCounter = { cell: { x: 17, y: 8, z: 6 } };
  office.clerk.mapCell = { x: 18, y: 8, z: 6 }; office.power = 12;
  const person = (id, role, cell) => ({ id, name: id, institutionId: id, roles: [role], status: 'alive', health: 100,
    fatigue: 0, workSeconds: 1800, assignment: null, locationId: office.id, roomId: 'supportedSurveyGround', mapCell: copy(cell) });
  const old = person('works:a', A.ROLE, { x: 16, y: 12, z: 6 }), reviewer = person('review:a', 'civicReview', { x: 15, y: 10, z: 6 });
  const administrator = person('admin:a', 'centralAdministration', { x: 15, y: 9, z: 6 });
  const source = { cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a', population: 100,
    publicWorksAppointment: A.ruleFor('a', old.id, reviewer.id), temporaryMaintenance: T.ruleFor('a', old.id, reviewer.id),
    institutions: [old, reviewer, administrator].map(a => ({ role: a.roles[0], id: a.id, officeRoles: [...a.roles], appointmentMethod: 'appointmentBySovereignAuthority' })) };
  const succession = { id: 'succession:a', officeId: office.id, source: copy(source), leaders: [old, reviewer, administrator],
    allocation: { populationSourceId: 'population:a', people: 4 }, handover: { id: 'handover:a', at: 0 },
    control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: [] }, agreements: [{ personId: old.id, roles: [A.ROLE] }],
    provision: { stock: 18, receipts: [{ id: 'actual-supply', quantity: 18, custodianId: 'defender:a',
      manifest: [{ stackId: 'paid-original-parts', key: 'metalParts', quantity: 18 }] }] } };
  const bargain = { officeId: office.id, representative: person('rep:a', 'representative', { x: 18, y: 9, z: 6 }),
    defender: person('defender:a', 'defender', { x: 19, y: 9, z: 6 }) };
  const u = U.create(succession, bargain, office); succession.appointments = A.create(succession, u, office, source, 0);
  const technician = succession.appointments.candidate; technician.credential.maintenance = 50; technician.appointmentPolicy = 'considerExactDuties';
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, activeViolence: false, cityId: 'a', bodyEpoch: 0,
    charterCurrent: true, administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true,
    externalPowered: true, reviewAvailable: true, temporaryMaintenanceRule: copy(source.temporaryMaintenance),
    appointmentOffice: { id: old.id, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' },
    commissionInjuryVisible: true, commissionPresentIds: [office.clerk.id, technician.id, reviewer.id],
    commissionStagedReachable: true, commissionReserveCell: { x: 19, y: 8, z: 6 }, commissionCanCarry: true,
    commissionCanInspect: true, commissionSupplyContact: true, staffPresentIds: [technician.id, office.clerk.id] };
  const institutions = Institutions.create({ cityId: 'a' }, source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 0);
  old.health = 35;
  return { u, succession, bargain, office, technician, old, reviewer, c, institutions, stacks: [], at: 100 };
}
function effects(f, overrides = {}) {
  return { move: (a, target, item) => {
    for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) {
      a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); if (item) item.cell = copy(a.mapCell); return true;
    }
    return false;
  }, collect: (a, custody, reservation) => {
    const item = { id: 'actual-commission-lot', key: 'metalParts', quantity: 3, cityOwnerId: f.u.cityId,
      civicCustody: copy(custody), carriedBy: a.id, cell: copy(a.mapCell), reservedTaskId: reservation };
    f.stacks.push(item); return item;
  }, drop: (item, reservation) => { item.carriedBy = null; item.reservedTaskId = reservation; return true; }, ...overrides };
}
function tick(f, seconds, overrides) {
  f.at += seconds; return T.advance(f.u, f.succession, f.bargain, f.office, f.institutions, f.stacks, f.c, f.at, effects(f, overrides));
}
function authorize(f) {
  assert.ok(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 30);
  assert.ok(T.propose(f.u, f.succession, f.office, f.institutions, f.u.temporaryMaintenance.observation, f.c, f.at));
  assert.equal(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at), false);
  tick(f, f.u.temporaryMaintenance.review.readyAt - f.at);
  assert.ok(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at)); tick(f, 180);
  assert.ok(T.sign(f.u, f.succession, f.office, f.u.temporaryMaintenance.offer, f.c, f.at)); tick(f, 60);
}
function order(f) {
  assert.ok(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  assert.ok(T.order(f.u, f.succession, f.bargain, f.office, f.stacks, f.u.temporaryMaintenance.inspection, f.c, f.at));
}
test('only separately published injury law and original voluntary separate-office authority permit cover, never death, absence, dissent or exhaustion', () => {
  for (const change of [f => f.old.health = 50, f => { f.old.health = 100; f.old.fatigue = 90; }, f => { f.old.health = 0; f.old.status = 'dead'; },
    f => f.c.commissionInjuryVisible = false, f => f.c.temporaryMaintenanceRule = null, f => f.succession.source.temporaryMaintenance = null,
    f => f.succession.handover = null, f => f.c.bodyEpoch++, f => f.old.roles.push('emergencyManagement'),
    f => f.u.authorizationId = 'disputed', f => f.succession.appointments.vacancy = {}, f => f.u.job = { cargo: { quantity: 3 } },
    f => f.c.busy = true, f => f.c.activeViolence = true]) {
    const f = fixture(); change(f); assert.equal(T.observe(f.u, f.succession, f.office, f.c, f.at), false);
    assert.equal(f.u.temporaryMaintenance, undefined);
  }
});
test('finite observation, shared independent queue, immutable exact consent and one physical full repair preserve the living officeholder', () => {
  const f = fixture(), original = copy({ old: f.old, agreements: f.succession.agreements, worker: f.u.workerId });
  const work = f.technician.workSeconds; authorize(f);
  assert.equal(f.technician.workSeconds, work - 270); assert.equal(f.office.power, 9);
  assert.equal(T.sign(f.u, f.succession, f.office, { ...f.u.temporaryMaintenance.offer, repairs: 2 }, f.c, f.at), false);
  order(f); tick(f, 300);
  const r = f.u.temporaryMaintenance;
  assert.equal(r.receipt.workSeconds, 120); assert.equal(r.ended.reason, 'completed'); assert.equal(f.u.workerId, original.worker);
  assert.deepEqual(f.old, original.old); assert.deepEqual(f.succession.agreements, original.agreements);
  assert.equal(f.technician.roles.length, 0); assert.equal(f.succession.appointments.receipt, null);
  assert.equal(U.staff(f.succession, f.bargain, f.office, f.u).some(a => a.id === f.technician.id), false);
  assert.equal(f.succession.provision.stock, 15); assert.equal(f.stacks[0].quantity, 0); assert.equal(f.u.receipts.length, 1);
  assert.equal(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at), false);
  tick(f, 90000); assert.equal(f.u.receipts.length, 1); assert.equal(f.succession.provision.stock, 15);
});
test('changed or unwilling qualifications yield stable ineligibility, not a reroll or laboratory credential substitute', () => {
  for (const change of [f => f.technician.appointmentPolicy = 'declineOffice', f => f.technician.credential.maintenance = 39,
    f => f.technician.credential.issuerInstitutionId = 'laboratory']) {
    const f = fixture(); change(f); assert.ok(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 30);
    assert.ok(T.propose(f.u, f.succession, f.office, f.institutions, f.u.temporaryMaintenance.observation, f.c, f.at));
    tick(f, f.u.temporaryMaintenance.review.readyAt - f.at); assert.ok(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at)); tick(f, 180);
    assert.equal(f.u.temporaryMaintenance.review.outcome, 'ineligible'); assert.equal(f.u.temporaryMaintenance.offer, null);
    change(f); assert.equal(T.propose(f.u, f.succession, f.office, f.institutions, f.u.temporaryMaintenance.observation, f.c, f.at), false);
  }
});
test('outages, missing attendance, changed authority and scientist death stop recording without backfill or fabricated records', () => {
  const f = fixture(); assert.ok(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 10);
  f.c.externalPowered = false; tick(f, 100); assert.equal(f.u.temporaryMaintenance.job.progress, 10);
  f.c.externalPowered = true; tick(f, 100); assert.equal(f.u.temporaryMaintenance.job.progress, 10);
  f.c.commissionPresentIds = []; tick(f, 100); f.c.commissionPresentIds = [f.office.clerk.id]; tick(f, 100); tick(f, 20);
  assert.ok(f.u.temporaryMaintenance.observation);
  const frozen = copy(f.u); f.c.alive = false; tick(f, 100); assert.deepEqual(f.u, frozen);
  const changed = fixture(); assert.ok(T.observe(changed.u, changed.succession, changed.office, changed.c, changed.at));
  changed.c.bodyEpoch++; tick(changed, 100); assert.equal(changed.u.temporaryMaintenance.observation, null);
});
test('one-day expiry before collection releases the exact reservation without refunding work, power or inventing repair', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 2);
  const work = f.technician.workSeconds, power = f.office.power, stock = f.succession.provision.stock;
  tick(f, f.u.temporaryMaintenance.commission.expiresAt - f.at);
  assert.equal(f.u.temporaryMaintenance.ended.reason, 'expired'); assert.equal(f.u.temporaryMaintenance.job, null);
  assert.equal(f.succession.provision.reservedBy, undefined); assert.equal(f.succession.provision.stock, stock);
  assert.equal(f.office.power, power); assert.equal(f.technician.workSeconds, work); assert.equal(f.u.servicedAt, null);
});
test('expiry with collected cargo requires real loaded return and never refunds reserve or installs past the deadline', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 70); const r = f.u.temporaryMaintenance;
  assert.ok(r.collection); assert.equal(r.receipt, null); assert.equal(f.succession.provision.stock, 15);
  tick(f, r.commission.expiresAt - f.at); assert.equal(r.job.phase, 'returning'); assert.equal(r.receipt, null);
  const cell = copy(f.technician.mapCell); tick(f, 30, { move: () => false }); assert.deepEqual(f.technician.mapCell, cell);
  assert.equal(f.stacks[0].carriedBy, f.technician.id); tick(f, 30); tick(f, 30);
  assert.ok(r.returned); assert.deepEqual(r.returned.cell, U.RECEIVING); assert.equal(f.stacks[0].carriedBy, null);
  assert.equal(f.succession.provision.stock, 15); assert.equal(f.stacks[0].quantity, 3); assert.equal(f.u.servicedAt, null);
  // When the original official can actually work again, ordinary upkeep can consume the returned lot, once.
  f.old.health = 70; assert.ok(U.inspect(f.u, f.succession, f.office, f.c, f.at));
  assert.ok(U.order(f.u, f.succession, f.bargain, f.office, f.stacks, f.u.inspection, f.c, f.at));
  U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at + 300, effects(f));
  assert.equal(f.u.receipts.length, 1); assert.equal(f.stacks[0].quantity, 0); assert.equal(f.succession.provision.stock, 15);
});
test('missing power, blocked contact, changed source manifests and cargo ownership cannot duplicate collection or complete repair', () => {
  for (const change of [f => f.c.commissionCanCarry = false, f => f.c.commissionSupplyContact = false,
    f => f.succession.provision.receipts[0].manifest[0].quantity--, f => f.succession.provision.stock--]) {
    const f = fixture(); authorize(f); order(f); change(f); tick(f, 300);
    assert.equal(f.u.temporaryMaintenance.collection, null); assert.equal(f.u.servicedAt, null); assert.equal(f.stacks.length, 0);
  }
  const f = fixture(); authorize(f); order(f); tick(f, 70); f.stacks[0].cityOwnerId = 'private'; tick(f, 300);
  assert.equal(f.u.servicedAt, null); assert.equal(f.stacks[0].quantity, 3);
});
test('unused expiry, recovered incumbent, forged registers and changed exact inspection grant no new repair authority', () => {
  const f = fixture(); authorize(f); const r = f.u.temporaryMaintenance;
  assert.ok(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  assert.equal(T.order(f.u, f.succession, f.bargain, f.office, f.stacks, { ...r.inspection, installationSeconds: 1 }, f.c, f.at), false);
  f.old.health = 50; assert.equal(T.order(f.u, f.succession, f.bargain, f.office, f.stacks, r.inspection, f.c, f.at), false);
  f.old.health = 35; f.office.temporaryMaintenanceReviews = []; assert.equal(T.authentic(f.u, f.succession, f.office, f.c), false);
  tick(f, r.commission.expiresAt - f.at); assert.equal(r.ended.reason, 'expired'); assert.equal(f.u.workerId, f.old.id);
});
test('injured incumbent cargo and old partial maintenance remain untouched and cannot be seized to bypass supplies', () => {
  const f = fixture(); f.old.civicMaintenanceCargo = { key: 'metalParts', quantity: 3, custodianId: f.old.id };
  const cargo = copy(f.old.civicMaintenanceCargo); authorize(f); f.succession.provision.stock = 0;
  assert.equal(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at), false);
  assert.deepEqual(f.old.civicMaintenanceCargo, cargo);
  f.u.job = { workerId: f.old.id, progress: 77, cargo: copy(cargo) }; const job = copy(f.u.job);
  assert.equal(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at), false); assert.deepEqual(f.u.job, job);
});
test('cancellation spends finite costs and preserves source custody without opening a repeatable commission', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 10);
  const work = f.technician.workSeconds; assert.ok(T.cancel(f.u, f.succession, f.office, f.stacks, f.c, f.at));
  assert.equal(f.technician.workSeconds, work); assert.equal(f.succession.provision.stock, 18);
  assert.equal(T.observe(f.u, f.succession, f.office, f.c, f.at), false); assert.equal(f.u.temporaryMaintenance.job, null);
});
test('documented staged custody is consumed once without reserve withdrawal and changed contamination blocks collection', () => {
  for (const contaminated of [false, true]) {
    const f = fixture(); f.succession.directive = { status: 'completed', receipt: { stackId: 'original-staged-parts' } };
    const stack = { id: 'original-staged-parts', key: 'metalParts', quantity: 3, cell: copy(U.RECEIVING), cityOwnerId: 'a',
      civicCustody: { cityId: 'a', custodianId: f.old.id }, reservedTaskId: U.reserveKey(f.u, f.succession) };
    f.stacks.push(stack); authorize(f); order(f);
    if (contaminated) stack.tags = ['contaminated'];
    tick(f, 300);
    assert.equal(f.succession.provision.stock, 18);
    if (contaminated) { assert.equal(stack.quantity, 3); assert.equal(f.u.temporaryMaintenance.collection, null); }
    else { assert.equal(stack.quantity, 0); assert.ok(f.u.temporaryMaintenance.receipt); }
  }
});
test('supplied rest retains the exact temporary job and physical cargo, restores bounded duty only and cannot install while off duty', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 70);
  f.technician.workSeconds = 0; const cell = copy(f.technician.mapCell), cargo = copy(f.stacks[0]);
  f.stacks.push({ id: 'actual-ration', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.ok(U.rest(f.u, f.succession, f.bargain, f.office, f.stacks, f.technician.id, f.c, f.at));
  tick(f, 100); assert.equal(f.u.servicedAt, null); assert.deepEqual(f.technician.mapCell, cell); assert.deepEqual(f.stacks[0], cargo);
  f.at += 28800; U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at);
  assert.equal(f.technician.workSeconds, 1200); assert.equal(f.old.health, 35); assert.equal(f.stacks[1].quantity, 0);
  tick(f, 1); tick(f, 300); assert.ok(f.u.temporaryMaintenance.receipt);
});
test('fractional advances and saved physical positions preserve exactly-once collection, costs and the fresh full installation', () => {
  const coarse = fixture(), fine = fixture(); authorize(coarse); authorize(fine); order(coarse); order(fine);
  tick(coarse, 200);
  for (let n = 0; n < 400; n++) {
    tick(fine, .5);
    if (n === 145) for (const key of ['u', 'succession', 'office', 'stacks', 'institutions']) fine[key] = copy(fine[key]);
  }
  assert.deepEqual(fine.u.temporaryMaintenance.receipt, coarse.u.temporaryMaintenance.receipt);
  assert.equal(fine.succession.appointments.candidate.workSeconds, coarse.technician.workSeconds);
  assert.deepEqual(fine.stacks, coarse.stacks); assert.equal(fine.succession.provision.stock, 15);
});
