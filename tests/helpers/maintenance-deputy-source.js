const assert = require('node:assert/strict');
const T = require('../../temporary-maintenance-commission').standing;
const U = require('../../city-administration');
const A = require('../../public-works-appointments');
const Registry = require('../../carrier-identity');
const Institutions = require('../../home-institution-context');
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
    publicWorksAppointment: A.ruleFor('a', old.id, reviewer.id), maintenanceDeputy: T.ruleFor('a', old.id, reviewer.id),
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
    externalPowered: true, reviewAvailable: true, maintenanceDeputyRule: copy(source.maintenanceDeputy),
    appointmentOffice: { id: old.id, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' },
    commissionInjuryVisible: true, commissionPresentIds: [office.clerk.id, technician.id, reviewer.id],
    commissionStagedReachable: true, commissionReserveCell: { x: 19, y: 8, z: 6 }, commissionCanCarry: true,
    commissionCanInspect: true, commissionSupplyContact: true,
    deputyReturnCell: { x: 15, y: 12, z: 6 }, deputyHandbackVisible: true, staffPresentIds: [technician.id, office.clerk.id] };
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
    const item = { id: `actual-deputy-lot-${f.stacks.length + 1}`, key: 'metalParts', quantity: 3, cityOwnerId: f.u.cityId,
      civicCustody: copy(custody), carriedBy: a.id, cell: copy(a.mapCell), reservedTaskId: reservation };
    f.stacks.push(item); return item;
  }, drop: (item, reservation, depositCell) => { if (depositCell) { assert(Math.hypot(item.cell.x - depositCell.x, item.cell.y - depositCell.y) <= 1); item.cell = copy(depositCell); } item.carriedBy = null; item.reservedTaskId = reservation; return true; }, ...overrides };
}
function tick(f, seconds, overrides) {
  f.at += seconds; return T.advance(f.u, f.succession, f.bargain, f.office, f.institutions, f.stacks, f.c, f.at, effects(f, overrides));
}
function authorize(f) {
  assert.ok(T.observe(f.u, f.succession, f.office, f.c, f.at)); tick(f, 30);
  assert.ok(T.propose(f.u, f.succession, f.office, f.institutions, f.u.maintenanceDeputy.observation, f.c, f.at));
  assert.equal(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at), false);
  tick(f, f.u.maintenanceDeputy.review.readyAt - f.at);
  assert.ok(T.hear(f.u, f.succession, f.office, f.institutions, f.c, f.at)); tick(f, 180);
  assert.ok(T.sign(f.u, f.succession, f.office, f.u.maintenanceDeputy.offer, f.c, f.at)); tick(f, 60);
}
function order(f) {
  assert.ok(T.inspect(f.u, f.succession, f.bargain, f.office, f.stacks, f.c, f.at));
  assert.ok(T.order(f.u, f.succession, f.bargain, f.office, f.stacks, f.u.maintenanceDeputy.inspection, f.c, f.at));
}
module.exports = { fixture, effects, tick, authorize, order, copy, T, U, A };
