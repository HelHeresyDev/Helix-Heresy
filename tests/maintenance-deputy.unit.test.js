const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, effects, tick, authorize, order, copy, T, U, A } = require('./helpers/maintenance-deputy-source');
const Temporary = require('../temporary-maintenance-commission');
function repaired(f) { order(f); tick(f, 300); assert(f.u.maintenanceDeputy.receipt); return f; }
function handback(f) { for (let i = 0; i < 10 && !f.u.maintenanceDeputy.handback; i++) tick(f, 30); assert(f.u.maintenanceDeputy.handback); }
test('one independently reviewed standing appointment supports two distinct fully supplied maintenance cycles without another hearing or replacement', () => {
  const f = fixture(), original = copy({ old: f.old, handover: f.succession.handover, agreements: f.succession.agreements, allocation: f.succession.allocation });
  const work = f.technician.workSeconds; authorize(f); const r = f.u.maintenanceDeputy, appointment = copy(r.commission), review = copy(r.review);
  assert.equal(f.technician.maintenanceDeputyId, appointment.id); assert.equal(r.commission.expiresAt, null);
  assert.equal(f.technician.workSeconds, work - 270); assert.equal(f.u.workerId, f.old.id);
  repaired(f); assert.equal(r.repairs.length, 1); assert.equal(f.succession.provision.stock, 15); assert.equal(r.ended, null);
  assert(!T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  tick(f, f.u.dueAt - f.at + 1); repaired(f);
  assert.equal(r.repairs.length, 2); assert.equal(new Set(r.repairs.map(r => r.receipt.id)).size, 2);
  assert.equal(f.succession.provision.stock, 12); assert(f.stacks.every(i => i.quantity === 0));
  assert.equal(f.u.receipts.filter(r => r.commissionId === appointment.id).length, 2);
  assert.deepEqual(r.commission, appointment); assert.deepEqual(r.review, review);
  assert.equal(f.office.maintenanceDeputyReviews.length, 1); assert.equal(f.office.maintenanceDeputyAppointments.length, 1);
  assert.deepEqual({ old: f.old, handover: f.succession.handover, agreements: f.succession.agreements, allocation: f.succession.allocation }, original);
  assert.deepEqual(f.technician.roles, []); assert.equal(f.succession.appointments.receipt, null);
  assert(!A.discuss(f.succession.appointments, f.succession, f.u, f.office, f.c, f.at));
  assert(!Temporary.observe(f.u, f.succession, f.office, f.c, f.at));
});
test('no unpublished, combined, dead, absent, merely tired or disputed-source deputy appointment is invented', () => {
  for (const change of [f => delete f.succession.source.maintenanceDeputy, f => f.c.maintenanceDeputyRule = null,
    f => f.old.roles.push('emergencyManagement'), f => f.old.status = 'dead', f => f.old.health = 50,
    f => { f.old.health = 100; f.old.fatigue = 90; }, f => f.c.commissionInjuryVisible = false,
    f => f.succession.handover = null, f => f.u.authorizationId = 'other-scoped-office', f => f.c.bodyEpoch++]) {
    const f = fixture(); change(f); assert(!T.observe(f.u, f.succession, f.office, f.c, f.at)); assert.equal(f.u.maintenanceDeputy, undefined);
  }
});
test('genuine refusal and insufficient original qualification remain stable after review, with no new worker or repaired authority', () => {
  for (const change of [f => f.technician.appointmentPolicy = 'declineOffice', f => f.technician.credential.maintenance = 39]) {
    const f = fixture(); change(f); const id = f.technician.id;
    assert(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 30);
    assert(T.propose(f.u, f.succession, f.office, f.institutions, f.u.maintenanceDeputy.observation, f.c, f.at));
    tick(f, f.u.maintenanceDeputy.review.readyAt - f.at);
    assert(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at)); tick(f, 180);
    const r = f.u.maintenanceDeputy; assert.equal(r.review.outcome, 'ineligible'); assert.equal(r.offer, null);
    assert(!T.propose(f.u, f.succession, f.office, f.institutions, r.observation, f.c, f.at));
    assert.equal(f.technician.id, id); assert.equal(f.technician.maintenanceDeputyId, undefined);
  }
});
test('original stock shortage prevents a second repair and never replenishes the accepted deputy or reserve', () => {
  const f = fixture(); f.succession.provision.stock = 5; f.succession.provision.receipts[0].quantity = 5;
  f.succession.provision.receipts[0].manifest[0].quantity = 5;
  authorize(f); repaired(f); assert.equal(f.succession.provision.stock, 2);
  tick(f, f.u.dueAt - f.at + 1);
  assert(!T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  assert.equal(f.u.maintenanceDeputy.repairs.length, 1); assert.equal(f.succession.provision.stock, 2);
});
test('exhausted original duty prevents more work; one real provision and eight off-duty hours restore only the existing bounded duty', () => {
  const f = fixture(); f.technician.workSeconds = 550; authorize(f); repaired(f);
  tick(f, f.u.dueAt - f.at + 1); assert(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  assert(!T.order(f.u, f.succession, f.bargain, f.office, f.stacks, f.u.maintenanceDeputy.inspection, f.c, f.at));
  assert(!U.rest(f.u, f.succession, f.bargain, f.office, f.stacks, f.technician.id, f.c, f.at));
  f.stacks.push({ id: 'owned-ration', key: 'fieldRation', quantity: 1, carriedBy: 'scientist', cell: { x: 15, y: 11, z: 6 } });
  const health = f.technician.health; assert(U.rest(f.u, f.succession, f.bargain, f.office, f.stacks, f.technician.id, f.c, f.at));
  assert.equal(f.stacks.find(i => i.id === 'owned-ration').quantity, 0);
  U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at + U.REST - 1, effects(f));
  assert(f.technician.workSeconds < 210);
  U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at + U.REST, effects(f)); f.at += U.REST;
  assert.equal(f.technician.workSeconds, 1200); assert.equal(f.technician.health, health); assert.equal(f.old.health, 35);
  repaired(f); assert.equal(f.u.maintenanceDeputy.repairs.length, 2); assert.equal(f.succession.provision.stock, 12);
});
test('revocation during actual carrying returns the exact lot physically, does not install or refund reserve, then records finite handback', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 75); const r = f.u.maintenanceDeputy; assert(r.collection);
  const lot = f.stacks.find(i => i.id === r.collection.stackId), stock = f.succession.provision.stock, old = copy(f.old);
  f.office.clerk.assignment = 'original-clerk-off-duty';
  assert(!T.end(f.u, f.succession, f.office, f.stacks, f.c, f.at, 'revoked'));
  f.office.clerk.assignment = null;
  assert(T.end(f.u, f.succession, f.office, f.stacks, f.c, f.at, 'revoked'));
  const before = copy(f.technician.mapCell); tick(f, 60, { move: () => false });
  assert.deepEqual(f.technician.mapCell, before); assert.equal(lot.carriedBy, f.technician.id);
  assert.equal(f.u.servicedAt, null); assert.equal(f.technician.maintenanceDeputyId, r.commission.id);
  handback(f); assert(r.returned); assert.equal(lot.quantity, 3); assert.equal(lot.carriedBy, null);
  assert.deepEqual(lot.cell, U.RECEIVING); assert.equal(f.succession.provision.stock, stock);
  assert.equal(r.repairs.length, 0); assert.equal(f.technician.maintenanceDeputyId, undefined);
  assert.deepEqual(f.technician.mapCell, r.proposal.homeCell); assert.deepEqual(f.old, old);
  assert(!T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
});
test('recovered incumbent ends acting authority and resumes only after actual deputy handback; no automatic promotion on death', () => {
  for (const died of [false, true]) {
    const f = fixture(); authorize(f); repaired(f); const oldId = f.old.id, originalAgreement = copy(f.succession.agreements);
    f.old.health = died ? 0 : 70; if (died) f.old.status = 'dead'; tick(f, 1); const r = f.u.maintenanceDeputy;
    assert.equal(r.ended.reason, died ? 'incumbentDied' : 'incumbentRecovered'); handback(f);
    assert.equal(f.u.workerId, oldId); assert.equal(f.succession.appointments.receipt, null); assert(!f.succession.appointments.vacancy);
    assert.deepEqual(f.succession.agreements, originalAgreement); assert.equal(f.old.health, died ? 0 : 70);
    if (!died) assert(U.inspect(f.u, f.succession, f.office, f.c, f.at));
  }
});
test('the deputy may withdraw consent, but the scientist cannot fabricate a resignation; safe handback retains all spent work', () => {
  const f = fixture(); authorize(f); assert(!T.end(f.u, f.succession, f.office, f.stacks, f.c, f.at, 'resigned'));
  f.technician.maintenanceDeputyResignation = { appointmentId: f.u.maintenanceDeputy.commission.id, at: f.at, reason: 'personally witnessed employer attack' };
  tick(f, 1); assert.equal(f.u.maintenanceDeputy.ended.reason, 'deputyResigned'); handback(f);
  assert.equal(f.technician.maintenanceDeputyId, undefined); assert(f.technician.workSeconds < 1200);
});
test('partial review pauses through outages without backfill; forged terms or missing registers do not authorize a deputy', () => {
  const f = fixture(); assert(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 15);
  f.c.externalPowered = false; tick(f, 100); assert.equal(f.u.maintenanceDeputy.job.progress, 15);
  f.c.externalPowered = true; tick(f, 100); assert.equal(f.u.maintenanceDeputy.job.progress, 15); tick(f, 15);
  assert(T.propose(f.u, f.succession, f.office, f.institutions, f.u.maintenanceDeputy.observation, f.c, f.at));
  tick(f, f.u.maintenanceDeputy.review.readyAt - f.at); assert(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at)); tick(f, 180);
  assert(!T.sign(f.u, f.succession, f.office, { ...f.u.maintenanceDeputy.offer, repairs: 1 }, f.c, f.at));
  assert(T.sign(f.u, f.succession, f.office, f.u.maintenanceDeputy.offer, f.c, f.at)); tick(f, 60);
  f.office.maintenanceDeputyAppointments = []; assert(!T.authentic(f.u, f.succession, f.office, f.c));
  assert(!T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
});
test('partial collected work survives normal serialization and resumed physical execution without another allocation', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 75);
  const preserved = JSON.parse(JSON.stringify({ u: f.u, succession: f.succession, office: f.office, bargain: f.bargain, stacks: f.stacks, institutions: f.institutions }));
  Object.assign(f, preserved); f.technician = f.succession.appointments.candidate; f.old = f.succession.leaders.find(a => a.id === f.u.workerId);
  f.u = U.normalize(f.u); tick(f, 300); assert.equal(f.u.maintenanceDeputy.repairs.length, 1);
  assert.equal(f.stacks.length, 1); assert.equal(f.succession.provision.stock, 15);
  assert.equal(f.technician.maintenanceDeputyId, f.u.maintenanceDeputy.commission.id);
});
test('final scientist death freezes active collected cargo, work, appointment and original people', () => {
  const f = fixture(); authorize(f); order(f); tick(f, 75);
  const before = copy({ u: f.u, succession: f.succession, office: f.office, stacks: f.stacks });
  f.c.alive = false; tick(f, 90000); U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, effects(f));
  assert.deepEqual({ u: f.u, succession: f.succession, office: f.office, stacks: f.stacks }, before);
});
