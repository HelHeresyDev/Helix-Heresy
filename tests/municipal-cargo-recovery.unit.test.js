const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../municipal-cargo-recovery');
const V = require('../public-works-vacancies');
const A = require('../public-works-appointments');
const U = require('../city-administration');
const Registry = require('../carrier-identity');
const Institutions = require('../home-institution-context');
const copy = v => JSON.parse(JSON.stringify(v));
function move(a, target, item) {
  for (const k of ['x', 'y', 'z']) if (a.mapCell[k] !== target[k]) {
    a.mapCell[k] += Math.sign(target[k] - a.mapCell[k]); if (item) item.cell = copy(a.mapCell); return true;
  }
  return false;
}
function fixture(kind = 'maintenance') {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Original counter', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0]; office.civicCounter = { cell: { x: 17, y: 8, z: 6 } };
  office.clerk.mapCell = { x: 18, y: 8, z: 6 }; office.power = 12;
  const person = (id, role, cell) => ({ id, name: id, institutionId: id, roles: [role], status: 'alive', health: 100,
    fatigue: 0, workSeconds: 1800, assignment: null, locationId: office.id, roomId: 'supportedSurveyGround', mapCell: copy(cell) });
  const old = person('works:a', A.ROLE, { x: 16, y: 12, z: 6 }), review = person('review:a', 'civicReview', { x: 15, y: 10, z: 6 });
  const admin = person('admin:a', 'centralAdministration', { x: 15, y: 9, z: 6 });
  const source = { cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a', population: 100,
    publicWorksAppointment: A.ruleFor('a', old.id, review.id), publicWorksVacancy: V.ruleFor('a', old.id, review.id),
    maintenanceCargoRecovery: R.ruleFor('a', old.id),
    institutions: [old, review, admin].map(a => ({ role: a.roles[0], id: a.id, officeRoles: [...a.roles], appointmentMethod: 'appointmentBySovereignAuthority' })) };
  const succession = { id: 'succession:a', officeId: office.id, source: copy(source), leaders: [old, review, admin],
    allocation: { populationSourceId: 'population:a', people: 4 }, handover: { id: 'handover:a', at: 0 },
    control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: [] },
    agreements: [{ personId: old.id, roles: [A.ROLE] }], provision: { stock: 18,
      receipts: [{ id: 'original-reserve', quantity: 18, custodianId: 'defender:a', manifest: [{ stackId: 'paid-carried-parts', key: 'metalParts', quantity: 18 }] }] } };
  const bargain = { officeId: office.id, representative: person('rep:a', 'representative', { x: 18, y: 9, z: 6 }), defender: person('defender:a', 'defender', { x: 19, y: 9, z: 6 }) };
  const u = U.create(succession, bargain, office), stacks = [];
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, activeViolence: false, cityId: 'a', bodyEpoch: 0,
    charterCurrent: true, administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true, externalPowered: true,
    reviewAvailable: true, deathVisible: true, accessInventoryVisible: true, appointmentRule: copy(source.publicWorksAppointment),
    vacancyRule: copy(source.publicWorksVacancy), cargoRecoveryRule: copy(source.maintenanceCargoRecovery),
    appointmentOffice: { id: old.id, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' },
    recoveryBodyVisible: true, recoveryCanCarry: true, recoveryContactClear: true };
  let at = 4; assert.ok(U.inspect(u, succession, office, c, at)); assert.ok(U.order(u, succession, bargain, office, stacks, u.inspection, c, at));
  while (u.job.progress < 20) U.advance(u, succession, bargain, office, stacks, c, ++at, { move });
  if (kind === 'directive') {
    const cargo = copy(u.job.cargo); delete cargo.sourceId;
    succession.directive = { id: `${succession.id}:directive`, workerId: old.id, key: 'metalParts', quantity: 3,
      status: 'carrying', sourceReceiptIds: copy(cargo.sourceReceiptIds), cargo, receipt: null };
    u.job = null; old.assignment = succession.id;
  }
  old.status = 'dead'; old.health = 0; old.diedAt = at;
  const s = A.create(succession, u, office, source, at); succession.appointments = s;
  s.candidate.credential.maintenance = 50; s.candidate.appointmentPolicy = 'considerExactDuties';
  c.presentIds = [office.clerk.id, review.id, s.candidate.id];
  const institutions = Institutions.create({ cityId: 'a' }, source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 0);
  const step = seconds => { at += seconds; V.advance(s, succession, u, office, institutions, stacks, c, at, { move }); };
  assert.ok(V.observe(s, succession, u, office, stacks, c, at)); step(30);
  assert.ok(V.discuss(s, succession, u, office, c, at)); step(60);
  assert.ok(V.propose(s, succession, u, office, institutions, s.vacancy.dossier, c, at)); step(s.vacancy.review.readyAt - at);
  assert.ok(V.hear(s, succession, u, office, institutions, c, at)); step(180);
  assert.ok(V.appoint(s, succession, u, office, s.vacancy.terms, c, at)); step(60);
  assert.ok(V.approach(s, succession, u, office, c, at)); step(30);
  assert.ok(V.transfer(s, succession, u, office, stacks, s.vacancy.appointment, c, at)); step(120);
  c.recoveryCollectionCell = { ...old.mapCell, y: old.mapCell.y + 1 };
  c.staffPresentIds = [s.candidate.id, office.clerk.id];
  return { u, succession, office, c, stacks, bargain, at, old, s };
}
function effects(f, overrides = {}) {
  return { move, collect: (a, custody) => {
    const item = { id: 'recovered-lot', section: 'resources', key: 'metalParts', quantity: 3, carriedBy: a.id,
      cityOwnerId: f.u.cityId, civicCustody: custody, reservedTaskId: f.u.cargoRecovery.id, cell: copy(a.mapCell) };
    f.stacks.push(item); return item;
  }, ...overrides };
}
function tick(f, seconds, overrides) {
  f.at += seconds; return R.advance(f.u, f.succession, f.office, f.stacks, f.c, f.at, effects(f, overrides));
}
function start(f) {
  assert.ok(R.inspect(f.u, f.succession, f.office, f.c, f.at));
  assert.ok(R.authorize(f.u, f.succession, f.office, copy(f.u.cargoRecovery.inspection), f.c, f.at));
}
test('recovery requires published separate custody authority, actual transfer, original city cargo and exact authenticated manifests', () => {
  for (const change of [f => f.c.cargoRecoveryRule = null, f => f.succession.source.maintenanceCargoRecovery = null,
    f => f.s.vacancy.receipt = null, f => f.c.bodyEpoch++, f => f.old.status = 'alive', f => f.c.recoveryBodyVisible = false,
    f => f.c.recoveryCanCarry = false, f => f.c.recoveryCollectionCell = copy(f.old.mapCell), f => f.succession.provision.receipts[0].manifest = [],
    f => f.old.civicMaintenanceCargo.cityId = 'private', f => f.old.civicMaintenanceCargo.sourceReceiptIds.push('invented'),
    f => f.s.vacancy.interruptedDuties[0].job.progress = 120]) {
    const f = fixture(); change(f); assert.equal(R.inspect(f.u, f.succession, f.office, f.c, f.at), false);
    assert.equal(f.u.cargoRecovery, undefined);
  }
});
test('exact finite attended recording, adjacent collection and actual return yield one traceable lot without refund or repair', () => {
  const f = fixture(), stock = f.succession.provision.stock, body = copy(f.old), agreements = copy(f.succession.agreements);
  f.at = f.u.graceUntil + 1; U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at);
  start(f); const r = f.u.cargoRecovery, power = f.office.power, duty = f.office.workSeconds;
  assert.equal(R.authorize(f.u, f.succession, f.office, { ...r.inspection, scope: 'loot' }, f.c, f.at), false);
  tick(f, 15); assert.equal(r.order, null); assert.equal(f.office.workSeconds, duty - 15);
  tick(f, 15); assert.ok(r.order); assert.equal(f.office.power, power); assert.equal(r.collection, null);
  tick(f, 30); assert.equal(r.collection, null); assert.ok(f.old.civicMaintenanceCargo);
  tick(f, 40); assert.ok(r.receipt); assert.equal(r.job, null); assert.equal(f.old.civicMaintenanceCargo, null);
  assert.deepEqual(f.old.mapCell, body.mapCell); assert.deepEqual(f.succession.agreements, agreements);
  assert.equal(f.succession.provision.stock, stock); assert.equal(f.office.maintenanceReady, false);
  assert.equal(f.stacks.length, 1); assert.equal(f.stacks[0].carriedBy, f.s.candidate.id);
  assert.ok(R.readyLot(f.u, f.succession, f.office, f.stacks, f.c));
  assert.equal(R.inspect(f.u, f.succession, f.office, f.c, f.at), false); tick(f, 100); assert.equal(f.stacks.length, 1);
  assert.ok(U.inspect(f.u, f.succession, f.office, f.c, f.at));
  assert.ok(U.order(f.u, f.succession, f.bargain, f.office, f.stacks, f.u.inspection, f.c, f.at));
  assert.equal(f.u.job.source.kind, 'recovered'); assert.equal(f.u.job.progress, 0);
  f.at += 119; U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.u.job.progress, 119); assert.equal(f.office.maintenanceReady, false);
  f.at++; U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.u.job, null); assert.equal(f.office.maintenanceReady, true); assert.equal(f.stacks[0].quantity, 0);
  assert.equal(f.u.cargoRecovery.consumed.quantity, 3); assert.equal(f.succession.provision.stock, stock);
  assert.equal(f.s.vacancy.interruptedDuties[0].job.progress, 20);
  assert.equal(R.readyLot(f.u, f.succession, f.office, f.stacks, f.c), null);
});
test('saved partial work pauses through absence, outages and blocked contact without backfill or duplication', () => {
  const f = fixture(); start(f); tick(f, 15);
  f.u = U.normalize(f.u); f.c.atCounter = false; tick(f, 100); assert.equal(f.u.cargoRecovery.job.progress, 15);
  f.c.atCounter = true; tick(f, 100); assert.equal(f.u.cargoRecovery.job.progress, 15); tick(f, 15);
  const cell = copy(f.s.candidate.mapCell); tick(f, 100, { move: () => false }); assert.deepEqual(f.s.candidate.mapCell, cell);
  tick(f, 30); const progress = f.u.cargoRecovery.job.progress;
  f.c.externalPowered = false; tick(f, 100); f.c.externalPowered = true; tick(f, 100);
  assert.equal(f.u.cargoRecovery.job.progress, progress);
  f.c.recoveryContactClear = false; tick(f, 100); assert.equal(f.u.cargoRecovery.collection, null);
  f.c.recoveryContactClear = true; tick(f, 100); assert.ok(f.u.cargoRecovery.receipt); assert.equal(f.stacks.length, 1);
});
test('loaded return can stop without moving the body or losing the already collected municipal lot', () => {
  const f = fixture(); start(f); tick(f, 30);
  tick(f, 70, { move: (a, target, item) => item ? false : move(a, target) });
  assert.ok(f.u.cargoRecovery.collection); assert.equal(f.u.cargoRecovery.receipt, null);
  assert.equal(f.old.civicMaintenanceCargo, null); assert.equal(f.stacks.length, 1);
  const at = f.stacks[0].cell; f.c.alive = false; tick(f, 10000);
  assert.deepEqual(f.stacks[0].cell, at); assert.equal(f.u.cargoRecovery.receipt, null);
});
test('depleted technician uses an actual supplied off-duty period while retaining cargo and assignment', () => {
  const f = fixture(); start(f); tick(f, 30);
  tick(f, 70, { move: (a, target, item) => item ? false : move(a, target) });
  const receipt = copy(f.u.cargoRecovery.collection); f.s.candidate.workSeconds = 0;
  f.stacks.push({ id: 'ration', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.ok(U.rest(f.u, f.succession, f.bargain, f.office, f.stacks, f.s.candidate.id, f.c, f.at));
  tick(f, 100); const j = f.u.cargoRecovery.job;
  f.at += 28800; U.advance(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.s.candidate.assignment, j.id); assert.equal(f.s.candidate.workSeconds, 1200);
  tick(f, 100); assert.equal(f.u.cargoRecovery.receipt, null); tick(f, 10); assert.ok(f.u.cargoRecovery.receipt);
  assert.deepEqual(f.u.cargoRecovery.collection, receipt); assert.equal(f.stacks.at(-1).quantity, 0);
});
test('changed custody, death, violence, forged records and personal goods cannot fund recovery or maintenance', () => {
  for (const change of [f => f.old.civicMaintenanceCargo.quantity++, f => f.c.activeViolence = true,
    f => f.s.candidate.status = 'dead', f => f.succession.source.maintenanceCargoRecovery.text += ' confiscate']) {
    const f = fixture(); start(f); tick(f, 15); change(f); tick(f, 1000);
    assert.equal(f.u.cargoRecovery.order, null); assert.equal(f.stacks.length, 0);
  }
  for (const change of [f => f.office.municipalCargoOrders = [], f => f.office.municipalCargoCollections = [],
    f => f.stacks[0].cityOwnerId = 'scientist', f => f.stacks[0].carriedBy = 'scientist',
    f => f.stacks[0].civicCustody.sourceReceiptIds = [], f => f.u.cargoRecovery.receipt.installationId = 'another']) {
    const f = fixture(); start(f); tick(f, 110); change(f);
    assert.equal(R.readyLot(f.u, f.succession, f.office, f.stacks, f.c), null);
  }
});
test('cancelling unfinished recording refunds nothing and never moves or collects the original cargo', () => {
  const f = fixture(); start(f); tick(f, 15); const duty = f.office.workSeconds, power = f.office.power;
  assert.ok(R.cancel(f.u, f.succession, f.office, f.c, f.at));
  assert.equal(f.office.workSeconds, duty); assert.equal(f.office.power, power); assert.ok(f.old.civicMaintenanceCargo);
  assert.equal(f.s.candidate.assignment, null); assert.equal(f.office.assignment, null); assert.equal(f.stacks.length, 0);
});
test('original interrupted staging cargo retains its own once-only source rather than inheriting installation progress', () => {
  const f = fixture('directive'), stock = f.succession.provision.stock;
  assert.equal(f.succession.directive.status, 'interruptedByDeath');
  assert.ok(R.source(f.u, f.succession)); start(f); tick(f, 110);
  assert.ok(f.u.cargoRecovery.receipt); assert.equal(f.stacks.length, 1); assert.equal(f.succession.provision.stock, stock);
  assert.equal(f.succession.directive.receipt, null); assert.equal(f.succession.directive.cargo, null);
  assert.equal(f.stacks[0].civicCustody.interruptedDutyId, f.succession.directive.id);
});
test('fractional walking and saved collection preserve the same work, cargo and once-only return as a coarse advance', () => {
  const coarse = fixture(), fine = fixture(); start(coarse); start(fine); tick(coarse, 110);
  for (let i = 0; i < 440; i++) {
    tick(fine, .25);
    if (i === 210) { fine.u = U.normalize(fine.u); fine.stacks = copy(fine.stacks); }
  }
  assert.deepEqual(fine.u.cargoRecovery, coarse.u.cargoRecovery);
  assert.deepEqual(fine.stacks, coarse.stacks); assert.equal(fine.s.candidate.workSeconds, coarse.s.candidate.workSeconds);
});
test('ordinary supplied technician rest remains available without a recovery job or an assignment property', () => {
  const f = fixture(); delete f.s.candidate.assignment;
  f.stacks.push({ id: 'ration', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.ok(U.rest(f.u, f.succession, f.bargain, f.office, f.stacks, f.s.candidate.id, f.c, f.at));
  assert.equal(f.u.cargoRecovery, undefined); assert.equal(f.stacks[0].quantity, 0);
});
