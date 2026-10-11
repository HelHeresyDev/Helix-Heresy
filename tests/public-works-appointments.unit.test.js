const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public-works-appointments');
const Civil = require('../civil-installation-access');
const Opposition = require('../local-opposition');
const Safeguards = require('../municipal-safeguards');
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
function obstructed(policy = 'custodyAccountability') {
  const f = fixture(); f.s.incumbentPolicy = 'retainInstallation'; f.s.accessPolicy = policy;
  f.c.accessInventoryVisible = true;
  f.succession.directive = { status: 'completed', receipt: { id: 'staging-receipt', stackId: 'staged-parts', quantity: 3,
    workerId: f.old.id, destination: { x: 16, y: 12, z: 6 } } };
  f.stacks.push({ id: 'staged-parts', key: 'metalParts', quantity: 3, cityOwnerId: 'a',
    cell: { x: 16, y: 12, z: 6 }, civicCustody: { cityId: 'a', custodianId: f.old.id, sourceReceiptIds: ['old-reserve'] },
    reservedTaskId: `${f.succession.id}:city-maintenance-reserve` });
  approach(f);
  assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at), false);
  return f;
}
function accessReason(f) {
  assert.ok(A.discussAccess(f.s, f.succession, f.upkeep, f.office, f.c, f.at)); step(f, 60);
}
function accessInventory(f) {
  accessReason(f);
  assert.ok(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 120);
}
function accessSettlement(f) {
  accessInventory(f);
  assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 60);
}
function civilFixture() {
  const f = obstructed('rejectReplacement');
  f.old.maxHealth = 100;
  f.old.physicalControl = { strength: 20, stamina: 80, staminaCapacity: 80 };
  Object.assign(f.bargain.defender, { institutionId: 'defense:a', physicalStrength: 80, maxHealth: 100, stamina: 100, staminaCapacity: 100,
    civilAccessPolicy: 'considerCivilEscort', skills: { striking: 35, guarding: 50 } });
  f.bargain.source = { cityId: 'a', charterId: f.s.charterId };
  f.c.presentIds.push(f.bargain.defender.id);
  f.c.civilAccessRule = Civil.ruleFor('a', f.s.institutionId, f.s.reviewerInstitutionId, 'defense:a');
  f.c.civilDefenderId = f.bargain.defender.id; f.c.defenseInstitutionId = 'defense:a'; f.c.defenseAvailable = true;
  f.injuries = [];
  f.effects = { move, lineOfSight: () => true,
    approach: (a, target) => move(a, { ...target, x: target.x + 1 }),
    damage: (a, amount) => { a.health -= amount; f.injuries.push({ actorId: a.id, typeId: 'bruising', amount }); return true; } };
  f.e = Civil.create(civilBundle(f)); assert.ok(f.e); f.s.enforcement = f.e; return f;
}
function civilBundle(f) {
  f.c.appointmentCurrent = A.bound(f.s, f.succession, f.upkeep, f.office, f.c) && A.authenticAppointment(f.s, f.office);
  f.c.inventory = f.c.accessInventoryVisible ? A.custodyInventory(f.succession, f.upkeep, f.stacks) : null;
  return { appointment: f.s, succession: f.succession, upkeep: f.upkeep, bargain: f.bargain,
    office: f.office, institutions: f.institutions, c: f.c, at: f.at, effects: f.effects };
}
function civilStep(f, seconds) { f.at += seconds; return Civil.advance(f.e, civilBundle(f)); }
function civilOrder(f) {
  assert.ok(Civil.file(f.e, civilBundle(f))); civilStep(f, f.e.review.readyAt - f.at);
  assert.ok(Civil.hear(f.e, civilBundle(f))); civilStep(f, 180);
}
function civilCommission(f) {
  civilOrder(f); assert.ok(Civil.discussCommission(f.e, civilBundle(f))); civilStep(f, 60);
  assert.ok(Civil.signCommission(f.e, civilBundle(f), copy(f.e.terms))); civilStep(f, 60);
  assert.ok(Civil.serve(f.e, civilBundle(f))); civilStep(f, 60); civilStep(f, 60);
}
function civilRelease(f) {
  civilCommission(f); assert.ok(Civil.startEscort(f.e, civilBundle(f)));
  for (let i = 0; i < 100 && f.e.escort.status === 'active'; i++) civilStep(f, 1);
  assert.equal(f.e.escort.status, 'released');
}
test('civil access needs its own published law, actual original bodies and institution instead of inherited watch/ward powers', () => {
  const f = civilFixture();
  for (const change of [g => g.c.civilAccessRule = null, g => g.c.civilAccessRule.institutionId = 'another',
    g => g.office.publicWorksAppointments = [], g => g.bargain.defender = { ...g.bargain.defender, id: 'new-guard' },
    g => g.old.physicalControl = null, g => g.s.obstruction = null, g => g.bargain.source.charterId = 'changed']) {
    const g = civilFixture(); change(g); const b = civilBundle(g);
    if (!g.c.appointmentCurrent) b.c.appointmentCurrent = false;
    assert.equal(Civil.create(b), null);
  }
  assert.equal(f.e.order, null); assert.equal(f.e.commission, null); assert.equal(f.s.receipt, null);
});
test('independent civil access review reserves the original queue once and keeps appointment and dissent unchanged', () => {
  const f = civilFixture(), original = copy({ appointment: f.s.appointment, objection: f.s.obstruction });
  civilOrder(f);
  assert.equal(Object.keys(f.institutions.offices[f.s.reviewerInstitutionId].jobs).length, 2);
  assert.equal(f.office.civilInstallationOrders.length, 1); assert.equal(f.e.review.status, 'completed');
  assert.match(f.e.review.finding, /no criminal guilt/); assert.equal(f.s.receipt, null);
  assert.deepEqual(f.s.appointment, original.appointment); assert.deepEqual(f.s.obstruction, original.objection);
  assert.equal(Civil.file(f.e, civilBundle(f)), false); assert.equal(Civil.hear(f.e, civilBundle(f)), false);
});
test('the original defender can refuse the distinct commission without a persuasion reroll or replacement', () => {
  const f = civilFixture(); f.bargain.defender.civilAccessPolicy = 'declineCivilEscort'; civilOrder(f);
  assert.ok(Civil.discussCommission(f.e, civilBundle(f))); civilStep(f, 60);
  assert.equal(f.e.response.decision, 'refused'); assert.equal(f.e.terms, null);
  assert.equal(Civil.discussCommission(f.e, civilBundle(f)), false);
  assert.equal(Civil.serve(f.e, civilBundle(f)), false); assert.equal(f.s.receipt, null);
});
test('exact commission, order service and actual response time precede any force without manufacturing consent', () => {
  const f = civilFixture(); civilOrder(f);
  assert.equal(Civil.startEscort(f.e, civilBundle(f)), false);
  assert.ok(Civil.discussCommission(f.e, civilBundle(f))); civilStep(f, 60);
  assert.equal(Civil.signCommission(f.e, civilBundle(f), { ...f.e.terms, missionSeconds: 9999 }), false);
  assert.ok(Civil.signCommission(f.e, civilBundle(f), f.e.terms)); civilStep(f, 60);
  assert.equal(f.office.civilAccessCommissions.length, 1);
  assert.ok(Civil.serve(f.e, civilBundle(f))); civilStep(f, 60);
  assert.equal(Civil.startEscort(f.e, civilBundle(f)), false); civilStep(f, 59);
  assert.equal(Civil.startEscort(f.e, civilBundle(f)), false); civilStep(f, 1);
  assert.ok(Civil.startEscort(f.e, civilBundle(f))); assert.equal(f.s.receipt, null);
  assert.equal(f.e.service.outgoingId, f.old.id); assert.match(f.e.service.objection, /not agreement/);
});
test('actual approach and passive control spend finite stamina, inflict real persistent human trauma and require physical release', () => {
  const f = civilFixture(), before = copy({ old: f.old, defender: f.bargain.defender, supplies: f.stacks, reserve: f.succession.provision });
  civilRelease(f);
  assert.deepEqual(f.old.mapCell, Civil.RELEASE); assert.equal(f.e.release.steps, 2);
  assert.equal(f.e.release.gripSeconds, 20); assert.equal(f.old.health, before.old.health - 1);
  assert.equal(f.injuries.length, 1); assert.equal(f.injuries[0].typeId, 'bruising');
  assert.ok(f.bargain.defender.stamina < before.defender.stamina); assert.ok(f.old.physicalControl.stamina < 80);
  assert.equal(f.bargain.defender.wardMana, before.defender.wardMana);
  assert.deepEqual(f.stacks, before.supplies); assert.deepEqual(f.succession.provision, before.reserve);
  assert.equal(f.upkeep.workerId, f.old.id); assert.equal(f.s.receipt, null);
  assert.ok(f.e.reports.every(r => r.kind === 'boundedGrip')); assert.equal(f.office.civilAccessReleases.length, 1);
});
test('blocked paths, fractional ticks and saved contact never teleport, duplicate injury or backfill an outage', () => {
  const f = civilFixture(); civilCommission(f); assert.ok(Civil.startEscort(f.e, civilBundle(f)));
  const start = copy(f.bargain.defender.mapCell); f.effects.approach = () => false; civilStep(f, 100);
  assert.deepEqual(f.bargain.defender.mapCell, start); assert.equal(f.e.escort.contact, 0); assert.equal(f.injuries.length, 0);
  f.effects.approach = (a, target) => move(a, { ...target, x: target.x + 1 });
  civilStep(f, 8); civilStep(f, 5); const contact = f.e.escort.contact;
  f.s = A.normalize(f.s); f.succession.appointments = f.s; f.e = f.s.enforcement;
  f.c.externalPowered = false; civilStep(f, 10000); assert.equal(f.e.escort.contact, contact);
  f.c.externalPowered = true; civilStep(f, .5); assert.equal(f.e.escort.contact, contact);
  civilStep(f, .5); assert.equal(f.e.escort.contact, contact + 1);
  for (let i = 0; i < 50 && f.e.escort.status === 'active'; i++) civilStep(f, 1);
  assert.equal(f.e.escort.status, 'released'); assert.equal(f.injuries.length, 1);
});
test('strength, depleted stamina, incapacity and actual fighting end limited enforcement without fake victory or arrest', () => {
  for (const change of [f => f.old.physicalControl.strength = 1000, f => f.bargain.defender.stamina = 1,
    f => f.old.health = 49, f => f.c.activeViolence = true, f => f.bargain.defender.assignment = null,
    f => f.office.assignment = null, f => f.office.civilAccessServices = [], f => f.old.physicalControl.strength = NaN]) {
    const f = civilFixture(); civilCommission(f); assert.ok(Civil.startEscort(f.e, civilBundle(f))); change(f); civilStep(f, 10);
    assert.equal(f.e.escort.status, 'stopped', JSON.stringify({ escort: f.e.escort, old: f.old, defender: f.bargain.defender, c: f.c })); assert.equal(f.e.release, null); assert.equal(f.s.receipt, null);
  }
  const f = civilFixture(); civilCommission(f); assert.ok(Civil.startEscort(f.e, civilBundle(f)));
  assert.ok(Civil.attack(f.e, civilBundle(f), 'scientist', f.old.id, 'strike'));
  assert.equal(f.e.escort.status, 'stopped'); assert.equal(f.e.release, null);
  assert.ok(f.e.reports.length > 0); assert.ok(f.e.reports.every(r => /no criminal verdict/.test(r.finding)));
});
test('compulsory inspection uses actual incoming official and clerk, not an outgoing signature, and supports unchanged supplied upkeep', () => {
  const f = civilFixture(), before = copy({ oldSignatures: f.succession.agreements, appointment: f.s.appointment,
    obstruction: f.s.obstruction, supply: f.succession.provision, dates: [f.upkeep.dueAt, f.upkeep.graceUntil] });
  civilRelease(f); assert.ok(Civil.transfer(f.e, civilBundle(f))); civilStep(f, 60);
  assert.equal(f.e.transferEvidence, null); f.s = A.normalize(f.s); f.succession.appointments = f.s; f.e = f.s.enforcement;
  civilStep(f, 60); assert.ok(f.e.transferEvidence);
  assert.ok(A.compulsoryTransfer(f.s, f.succession, f.upkeep, f.office, civilBundle(f).c, f.at));
  assert.equal(f.s.receipt.origin, 'compulsoryCivilAccess'); assert.equal(f.s.receipt.accessSettlementId, undefined);
  assert.equal(f.s.access.settlement, null); assert.equal(f.e.transferEvidence.outgoingSignature, undefined);
  assert.deepEqual(f.succession.agreements, before.oldSignatures); assert.deepEqual(f.s.appointment, before.appointment);
  assert.deepEqual(f.s.obstruction, before.obstruction); assert.deepEqual(f.succession.provision, before.supply);
  assert.deepEqual([f.upkeep.dueAt, f.upkeep.graceUntil], before.dates);
  assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 1000; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.stacks[0].quantity, 0); assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.equal(A.compulsoryTransfer(f.s, f.succession, f.upkeep, f.office, f.c, f.at), false);
});
test('missing records, changed people, altered law and stale inventory cannot grant compulsory control', () => {
  for (const change of [f => f.office.civilAccessCommissions = [], f => f.office.civilInstallationOrders = [],
    f => f.office.civilAccessServices = [], f => f.office.civilAccessReleases = [], f => f.office.civilAccessTransfers = [],
    f => f.e.commission.defenderId = 'substitute', f => f.c.civilAccessRule.missionSeconds++, f => f.stacks[0].quantity--,
    f => { f.e.service.departBy--; f.office.civilAccessServices[0] = copy(f.e.service); },
    f => { f.e.release.defenderCell.x = 100; f.office.civilAccessReleases[0] = copy(f.e.release); },
    f => { f.e.transferEvidence.at = f.e.release.at - 1; f.office.civilAccessTransfers[0] = copy(f.e.transferEvidence); }]) {
    const f = civilFixture(); civilRelease(f); assert.ok(Civil.transfer(f.e, civilBundle(f))); civilStep(f, 120); change(f);
    assert.equal(A.compulsoryTransfer(f.s, f.succession, f.upkeep, f.office, civilBundle(f).c, f.at), false);
    assert.equal(f.upkeep.workerId, f.old.id);
  }
});
test('expiry, absence, original queue identity and death protect unfinished civil records and finite work', () => {
  const f = civilFixture(); civilOrder(f); assert.ok(Civil.discussCommission(f.e, civilBundle(f))); civilStep(f, 60);
  civilStep(f, 3600); assert.equal(Civil.signCommission(f.e, civilBundle(f), f.e.terms), false);
  const g = civilFixture(); assert.ok(Civil.file(g.e, civilBundle(g))); civilStep(g, g.e.review.readyAt - g.at);
  assert.ok(Civil.hear(g.e, civilBundle(g))); civilStep(g, 60); g.c.atCounter = false; civilStep(g, 120);
  assert.equal(g.e.order, null); assert.equal(g.e.review.status, 'queued'); assert.equal(g.office.assignment, null);
  const h = civilFixture(); civilCommission(h); assert.ok(Civil.startEscort(h.e, civilBundle(h))); civilStep(h, 5);
  const before = copy({ s: h.s, old: h.old, defender: h.bargain.defender, office: h.office, injuries: h.injuries });
  h.c.alive = false; civilStep(h, 100000);
  assert.deepEqual({ s: h.s, old: h.old, defender: h.bargain.defender, office: h.office, injuries: h.injuries }, before);
  assert.equal('physicalStrength' in Civil.publicView(h.e), false); assert.equal('stamina' in Civil.publicView(h.e).escort, false);
});
function step(f, seconds, effects = {}) { f.at += seconds; return A.advance(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at, { move, stacks: f.stacks, ...effects }); }
function discuss(f) { assert.equal(A.discuss(f.s, f.succession, f.upkeep, f.office, f.c, f.at), true); step(f, 60); }
function propose(f) { discuss(f); assert.equal(A.propose(f.s, f.succession, f.upkeep, f.office, f.institutions, copy(f.s.dossier), f.c, f.at), true); }
function hear(f) { propose(f); step(f, f.s.review.readyAt - f.at); assert.equal(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at), true); step(f, 180); }
function appoint(f) { hear(f); assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, copy(f.s.terms), f.c, f.at), true); step(f, 60); }
function approach(f) { appoint(f); assert.equal(A.approach(f.s, f.succession, f.upkeep, f.office, f.c, f.at), true); step(f, 10); }
function transfer(f) { approach(f); assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, copy(f.s.appointment), f.c, f.at), true); step(f, 3); step(f, 120); }
function combinedFixture() {
  const f = fixture(), roles = ['emergencyManagement', A.ROLE];
  f.old.roles = [...roles]; f.source.institutions[0].officeRoles = [...roles];
  f.source.publicWorksAppointment = null; f.source.publicWorksRoleReassignment = A.roleRuleFor('a', f.old.institutionId, f.reviewer.institutionId);
  f.succession.source = copy(f.source); f.succession.agreements[0].roles = [...roles];
  f.succession.control.commandRelationships[0].roles = [...roles];
  f.c.appointmentRule = copy(f.source.publicWorksRoleReassignment); f.c.appointmentOffice.roles = [...roles];
  f.c.accessInventoryVisible = true;
  f.s = A.create(f.succession, f.upkeep, f.office, f.source, 0); assert.ok(f.s); f.succession.appointments = f.s;
  f.s.candidate.credential.maintenance = 50; f.s.candidate.appointmentPolicy = 'considerExactDuties'; f.s.incumbentPolicy = 'contestThenRelease';
  f.c.presentIds = [f.old.id, f.reviewer.id, f.office.clerk.id, f.s.candidate.id];
  f.succession.directive = { status: 'completed', cargo: null, receipt: { id: 'original-stage', stackId: 'city-parts', quantity: 3,
    workerId: f.old.id, destination: { x: 16, y: 12, z: 6 } } };
  f.stacks.push({ id: 'city-parts', key: 'metalParts', quantity: 3, cityOwnerId: 'a', cell: { x: 16, y: 12, z: 6 },
    reservedTaskId: `${f.succession.id}:city-maintenance-reserve`, civicCustody: { cityId: 'a', custodianId: f.old.id, sourceReceiptIds: ['old-reserve'] } });
  return f;
}
function combinedTransfer(f) {
  approach(f); assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks)); step(f, 3); step(f, 120);
}
test('combined role reassignment requires its own exact published law and original distinct reviewer', () => {
  const f = combinedFixture(); assert.equal(f.s.rule.method, 'reviewedCombinedPublicWorksReassignment');
  assert.deepEqual(f.old.roles, ['emergencyManagement', A.ROLE]); assert.equal(f.s.receipt, null);
  for (const change of [g => g.source.publicWorksRoleReassignment = null,
    g => g.source.publicWorksRoleReassignment.retainedRoles = [], g => g.old.roles.push('civilWatch'),
    g => g.source.publicWorksAppointment = A.ruleFor('a', g.old.institutionId, g.reviewer.institutionId),
    g => g.source.institutions[0].officeRoles = [A.ROLE], g => g.reviewer.institutionId = g.old.institutionId,
    g => g.succession.handover = null, g => g.upkeep.authorizationId = 'disputed']) {
    const g = combinedFixture(); change(g); assert.equal(A.create(g.succession, g.upkeep, g.office, g.source, 0), null);
  }
});
test('combined review preserves the exact emergency role and actual original commitments without awarding control', () => {
  const f = combinedFixture(), prior = copy(f.succession.agreements); hear(f);
  assert.deepEqual(f.s.proposal.continuity.originalRoles, ['emergencyManagement', A.ROLE]);
  assert.deepEqual(f.s.terms.retainedRoles, ['emergencyManagement']); assert.deepEqual(f.s.terms.incomingRoles, [A.ROLE]);
  assert.deepEqual(f.s.proposal.continuity.directive, f.succession.directive);
  assert.equal(f.s.appointment, null); assert.equal(f.upkeep.workerId, f.old.id); assert.deepEqual(f.succession.agreements, prior);
  f.s.terms.incomingRoles.push('emergencyManagement');
  assert.equal(A.appoint(f.s, f.succession, f.upkeep, f.office, f.s.terms, f.c, f.at), false);
});
test('combined handover inspects real custody across reload and changes only the actual public-works role', () => {
  const f = combinedFixture(), before = copy({ source: f.source, agreements: f.succession.agreements, old: f.old,
    reserve: f.succession.provision, stacks: f.stacks, dueAt: f.upkeep.dueAt, receipts: f.upkeep.receipts });
  approach(f); assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks));
  step(f, 3); step(f, 60); assert.equal(f.s.receipt, null); assert.equal(f.upkeep.workerId, f.old.id);
  f.s = A.normalize(f.s); f.succession.appointments = f.s; step(f, 60);
  assert.deepEqual(f.old.roles, ['emergencyManagement']); assert.equal(f.old.officeStatus.status, 'publicWorksRoleReassigned');
  assert.deepEqual(f.s.candidate.roles, [A.ROLE]); assert.equal(f.upkeep.workerId, f.s.candidate.id);
  assert.equal(f.s.receipt.roleDivision.outgoingSignerId, f.old.id);
  assert.deepEqual(f.s.receipt.roleDivision.inventory.goods.map(g => [g.id, g.quantity]), [['city-parts', 3]]);
  assert.deepEqual(f.source, before.source); assert.deepEqual(f.succession.agreements, before.agreements);
  assert.deepEqual(f.succession.provision, before.reserve); assert.deepEqual(f.stacks, before.stacks);
  assert.equal(f.old.health, before.old.health); assert.equal(f.old.fatigue, before.old.fatigue); assert.ok(f.old.workSeconds < before.old.workSeconds);
  assert.equal(f.upkeep.dueAt, before.dueAt); assert.deepEqual(f.upkeep.receipts, before.receipts);
  assert.equal(f.succession.control.commandRelationships[0].roleStates[A.ROLE].status, 'replaced');
  assert.equal(f.succession.control.commandRelationships[0].roleStates.emergencyManagement, undefined);
  assert.ok(Administration.staff(f.succession, f.bargain, f.office).some(a => a.id === f.old.id));
  assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks), false);
});
test('combined refusal stays non-operational and cannot inherit separate-office civil enforcement', () => {
  const f = combinedFixture(); f.s.incumbentPolicy = 'retainInstallation'; f.s.accessPolicy = 'rejectReplacement'; approach(f);
  assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks), false);
  assert.ok(f.s.obstruction); assert.equal(f.s.receipt, null); assert.deepEqual(f.old.roles, ['emergencyManagement', A.ROLE]);
  assert.equal(Civil.create({ appointment: f.s, c: f.c }), null);
  f.s.enforcement = {}; assert.equal(A.compulsoryTransfer(f.s, f.succession, f.upkeep, f.office, f.c, f.at), false);
  accessReason(f); assert.equal(f.s.access.reason.kind, 'rejectReplacement');
  assert.equal(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, {}, f.c, f.at), false);
});
test('combined unfinished commitments or changed custody cannot disappear during review or physical handover', () => {
  for (const change of [f => f.upkeep.job = { cargo: { quantity: 3 } }, f => f.upkeep.rests.push({ personId: f.old.id }),
    f => f.succession.directive.cargo = { quantity: 3 }, f => f.succession.agreements[0].roles.pop(), f => f.upkeep.dueAt++]) {
    const f = combinedFixture(); propose(f); step(f, f.s.review.readyAt - f.at);
    assert.ok(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at)); change(f); step(f, 180);
    assert.equal(f.s.review.status, 'queued'); assert.equal(f.s.terms, null); assert.equal(f.s.job, null);
  }
  for (const change of [f => f.stacks[0].quantity--, f => f.c.accessInventoryVisible = false,
    f => f.succession.directive.cargo = { quantity: 3 }, f => f.succession.control.commandRelationships[0].roles.pop()]) {
    const f = combinedFixture(); approach(f); assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks));
    step(f, 3); step(f, 30); change(f); step(f, 120);
    assert.equal(f.s.receipt, null); assert.equal(f.upkeep.workerId, f.old.id); assert.deepEqual(f.old.roles, ['emergencyManagement', A.ROLE]);
  }
});
test('combined assigned technician performs supplied upkeep and independent prospective cooperation without emergency powers', () => {
  const f = combinedFixture(); combinedTransfer(f); const reserve = f.succession.provision.stock;
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 300; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.stacks[0].quantity, 0); assert.equal(f.succession.provision.stock, reserve);
  assert.equal(f.upkeep.receipts.at(-1).personId, f.s.candidate.id);
  f.upkeep.resistance = Resistance.create(f.upkeep, f.succession, f.office, f.c);
  assert.equal(f.upkeep.resistance.workerId, f.s.candidate.id); assert.ok(Resistance.propose(f.upkeep.resistance, f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Resistance.accept(f.upkeep.resistance, f.upkeep, f.succession, f.office, f.upkeep.resistance.offer, f.c, f.at));
  f.at += 60; Resistance.advance(f.upkeep.resistance, f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.institutions, f.c, f.at);
  assert.equal(f.upkeep.resistance.commitment.workerId, f.s.candidate.id);
  assert.deepEqual(f.old.roles, ['emergencyManagement']); assert.deepEqual(f.s.commandRelationship.roles, [A.ROLE]);
});
test('completed genuine upkeep while waiting is reviewed with current records, not an impossible frozen deadline', () => {
  const f = combinedFixture(); propose(f); const filed = copy(f.s.proposal.continuity);
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 300; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.upkeep.job, null); assert.notEqual(f.upkeep.dueAt, filed.dueAt);
  step(f, f.s.review.readyAt - f.at); assert.ok(A.hear(f.s, f.succession, f.upkeep, f.office, f.institutions, f.c, f.at)); step(f, 180);
  assert.equal(f.s.review.outcome, 'eligible'); assert.deepEqual(f.s.proposal.continuity, filed);
  assert.equal(f.s.review.continuity.dueAt, f.upkeep.dueAt); assert.equal(f.s.review.continuity.receipts.length, 1);
  assert.deepEqual(f.s.terms.continuity, f.s.review.continuity);
});
test('combined authorization rejects rewritten retained roles, missing custody or forced-origin records', () => {
  for (const change of [f => f.old.roles.push(A.ROLE), f => f.old.officeStatus.status = 'replacedByReviewedAppointment',
    f => { f.s.receipt.roleDivision.incomingRoles.push('emergencyManagement'); f.office.publicWorksTransfers[0] = copy(f.s.receipt); },
    f => { f.s.receipt.roleDivision.inventory = null; f.office.publicWorksTransfers[0] = copy(f.s.receipt); },
    f => f.office.publicWorksTransfers = [], f => f.s.receipt.origin = 'compulsoryCivilAccess']) {
    const f = combinedFixture(); combinedTransfer(f); change(f); assert.equal(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c), null);
  }
});
test('combined outages, blocked walking and death retain positions and unfinished finite handover without backfill', () => {
  const f = combinedFixture(); approach(f); assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks));
  const cell = copy(f.old.mapCell); step(f, 30, { move: () => false }); assert.deepEqual(f.old.mapCell, cell); assert.equal(f.s.job.progress, 0);
  step(f, 3); step(f, 30); f.s = A.normalize(f.s); f.succession.appointments = f.s;
  f.c.externalPowered = false; step(f, 100); assert.equal(f.s.job.progress, 30);
  f.c.externalPowered = true; step(f, 100); assert.equal(f.s.job.progress, 30);
  f.c.alive = false; const before = copy({ s: f.s, old: f.old, office: f.office, upkeep: f.upkeep }); step(f, 1000);
  assert.deepEqual({ s: f.s, old: f.old, office: f.office, upkeep: f.upkeep }, before);
});
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
test('access motives exist before obstruction, are deterministic and remain private until actually heard', () => {
  const f = fixture(), initial = A.create(f.succession, f.upkeep, f.office, f.source, 0);
  assert.equal(initial.accessPolicy, A.create(f.succession, f.upkeep, f.office, f.source, 0).accessPolicy);
  const policies = new Set(), obstructionPolicies = new Set();
  for (let i = 0; i < 100; i++) {
    const g = fixture(); g.old.id = `works-person:${i}`; g.upkeep.workerId = g.old.id;
    const generated = A.create(g.succession, g.upkeep, g.office, g.source, 0);
    policies.add(generated.accessPolicy);
    if (generated.incumbentPolicy === 'retainInstallation') obstructionPolicies.add(generated.accessPolicy);
  }
  assert.deepEqual([...policies].sort(), ['custodyAccountability', 'rejectReplacement']);
  assert.deepEqual([...obstructionPolicies].sort(), ['custodyAccountability', 'rejectReplacement']);
  assert.equal('accessPolicy' in A.publicView(initial), false); assert.equal(A.publicView(initial).access.reason, null);
  assert.equal(A.discussAccess(f.s, f.succession, f.upkeep, f.office, f.c, 0), false);
});
test('categorical obstruction cannot be bought, inspected into consent or rerolled through repeated discussion', () => {
  const f = obstructed('rejectReplacement'); accessReason(f);
  const reason = copy(f.s.access.reason), power = f.office.power;
  assert.equal(reason.authorId, f.old.id); assert.equal(reason.kind, 'rejectReplacement');
  assert.equal(A.discussAccess(f.s, f.succession, f.upkeep, f.office, f.c, f.at), false);
  assert.equal(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
  f.s = A.normalize(f.s); f.succession.appointments = f.s; step(f, 10000);
  assert.deepEqual(f.s.access.reason, reason); assert.equal(f.office.power, power);
  assert.equal(f.s.access.offer, null); assert.equal(f.upkeep.workerId, f.old.id);
});
test('joint custody inspection records only physical local city goods and retains discrepancies without guilt or stock repair', () => {
  const f = obstructed(); f.stacks[0].quantity = 2;
  f.stacks.push({ ...copy(f.stacks[0]), id: 'distant-secret', quantity: 999, cell: { x: 30, y: 30, z: 6 } },
    { ...copy(f.stacks[0]), id: 'private-property', cityOwnerId: 'private' },
    { ...copy(f.stacks[0]), id: 'sealed-container-interior', containerId: 'closed-box' },
    { ...copy(f.stacks[0]), id: 'held-elsewhere', carriedBy: 'scientist' });
  const before = copy({ stacks: f.stacks, reserve: f.succession.provision, appointment: f.s.appointment, objection: f.s.obstruction });
  accessInventory(f);
  assert.deepEqual(f.s.access.inspection.inventory.goods.map(i => i.id), ['staged-parts']);
  assert.deepEqual(f.s.access.inspection.inventory.reconciliation, { expected: 3, observed: 2, discrepancy: true });
  assert.deepEqual(f.stacks, before.stacks); assert.deepEqual(f.succession.provision, before.reserve);
  assert.deepEqual(f.s.appointment, before.appointment); assert.deepEqual(f.s.obstruction, before.objection);
  assert.equal(f.office.publicWorksAccessInspections.length, 1); assert.equal(f.s.access.settlement, null);
  assert.equal(f.s.receipt, null); assert.match(f.s.access.offer.rights, /neither grants immunity/);
  assert.equal(JSON.stringify(A.publicView(f.s)).includes('distant-secret'), false);
  assert.equal(JSON.stringify(A.publicView(f.s)).includes('sealed-container-interior'), false);
});
test('custody reconciliation accounts for genuinely installed parts rather than alleging a consumed lot is missing', () => {
  const f = obstructed(); f.stacks[0].quantity = 0;
  f.upkeep.receipts.push({ id: 'actual-service', installationId: f.upkeep.installation.id, quantity: 3,
    manifest: { sourceId: 'staged-parts' } });
  accessInventory(f);
  assert.deepEqual(f.s.access.inspection.inventory.reconciliation, { expected: 0, observed: 0, discrepancy: false });
});
test('negotiated settlement spends actual duty and power, preserves appointment and dissent, and still requires physical release', () => {
  const f = obstructed(), before = copy({ old: f.old, incoming: f.s.candidate, power: f.office.power,
    appointment: f.s.appointment, obstruction: f.s.obstruction, stacks: f.stacks, reserve: f.succession.provision });
  accessSettlement(f);
  assert.equal(f.office.power, before.power - 3); assert.equal(f.old.workSeconds, before.old.workSeconds - 240);
  assert.equal(f.s.candidate.workSeconds, before.incoming.workSeconds - 240);
  assert.equal(f.s.incumbentPolicy, 'retainInstallation'); assert.equal(f.s.receipt, null);
  assert.equal(f.upkeep.workerId, f.old.id); assert.deepEqual(f.old.mapCell, before.old.mapCell);
  assert.deepEqual(f.s.appointment, before.appointment); assert.deepEqual(f.s.obstruction, before.obstruction);
  assert.equal(f.office.publicWorksAccessSettlements.length, 1);
  assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks));
  step(f, 1000, { move: () => false }); assert.equal(f.s.receipt, null); assert.equal(f.s.job.progress, 0);
  f.s = A.normalize(f.s); f.succession.appointments = f.s;
  step(f, 2); step(f, 120);
  assert.equal(f.s.receipt.accessSettlementId, f.s.access.settlement.id);
  assert.deepEqual(f.old.mapCell, A.RETIRED_POST); assert.equal(f.upkeep.workerId, f.s.candidate.id);
  assert.deepEqual(f.stacks, before.stacks); assert.deepEqual(f.succession.provision, before.reserve);
  assert.equal(f.old.health, before.old.health); assert.equal(f.office.publicWorksTransfers.length, 1);
  assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 1000; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.stacks[0].quantity, 0); assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
});
test('negotiation requires the original appointment, exact people, visible inventory, physical post and finite resources', () => {
  for (const change of [f => f.c.atCounter = false, f => f.c.bodyEpoch++, f => f.c.activeViolence = true,
    f => f.c.presentIds = [], f => f.office.power = 0, f => f.old.workSeconds = 59,
    f => f.s.candidate.mapCell.x++, f => f.office.publicWorksAppointments = [], f => f.s.appointment.candidateId = 'substitute']) {
    const f = obstructed(); change(f);
    assert.equal(A.discussAccess(f.s, f.succession, f.upkeep, f.office, f.c, f.at), false);
  }
  const f = obstructed(); accessReason(f); f.c.accessInventoryVisible = false;
  assert.equal(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
});
test('partial negotiation and outages retain work and costs across reload without unattended signatures or backfill', () => {
  const f = obstructed(); accessReason(f);
  assert.ok(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 30);
  f.s = A.normalize(f.s); f.succession.appointments = f.s;
  f.c.externalPowered = false; step(f, 1000); assert.equal(f.s.job.progress, 30);
  f.c.externalPowered = true; step(f, 1000); assert.equal(f.s.job.progress, 30);
  step(f, 90); assert.equal(f.office.publicWorksAccessInspections.length, 1);
  assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 20);
  f.c.presentIds = f.c.presentIds.filter(id => id !== f.old.id); step(f, 40);
  assert.equal(f.s.access.settlement, null); assert.equal(f.s.job, null); assert.equal(f.old.assignment, null);
  assert.equal(f.s.receipt, null);
});
test('exact settlement and expiry cannot be altered or renewed on unchanged facts; declining makes no promise', () => {
  const f = obstructed(); accessInventory(f);
  assert.equal(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, { ...f.s.access.offer, rights: 'immunity' }, f.c, f.at), false);
  assert.equal(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
  step(f, 3570); assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 60);
  assert.equal(f.s.access.settlement, null); assert.equal(f.s.job, null);
  assert.equal(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at), false);
  assert.equal(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at), false);
  const g = obstructed(); accessInventory(g);
  assert.ok(A.declineAccess(g.s, g.succession, g.upkeep, g.office, g.s.access.offer, g.c, g.at));
  assert.equal(A.settleAccess(g.s, g.succession, g.upkeep, g.office, g.stacks, g.s.access.offer, g.c, g.at), false);
  assert.equal(g.s.access.settlement, null); assert.equal(g.upkeep.workerId, g.old.id);
});
test('changed real custody cancels unfinished inspection and requires a new witnessed account without deleting earlier records', () => {
  const f = obstructed(); accessReason(f);
  assert.ok(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 30);
  f.stacks[0].quantity--; step(f, 90); assert.equal(f.s.access.inspection, null); assert.equal(f.s.job, null);
  assert.ok(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 120);
  const original = copy(f.s.access.inspection);
  assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 60);
  const signed = copy(f.s.access.settlement); f.stacks[0].quantity--;
  assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks), false);
  assert.ok(A.inspectAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.c, f.at)); step(f, 120);
  assert.equal(f.s.access.settlement, null); assert.equal(f.office.publicWorksAccessInspections.length, 2);
  assert.deepEqual(f.office.publicWorksAccessInspections[0], original);
  assert.deepEqual(f.office.publicWorksAccessSettlements[0], signed);
  assert.equal(f.s.access.reason.kind, 'custodyAccountability'); assert.equal(f.s.receipt, null);
});
test('negotiated access cannot survive swapped participants, missing original registers or tampered terms', () => {
  for (const change of [f => f.office.publicWorksAccessInspections = [], f => f.office.publicWorksAccessSettlements = [],
    f => f.s.access.offer.expiresAt++, f => f.s.access.settlement.outgoingId = 'another-person',
    f => f.s.accessPolicy = 'rejectReplacement', f => f.s.access.inspection.inventory.goods[0].quantity++,
    f => f.s.access.declined = { at: f.at }]) {
    const f = obstructed(); accessSettlement(f); change(f);
    assert.equal(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks), false);
    assert.equal(f.upkeep.workerId, f.old.id);
  }
});
test('death freezes an unfinished access agreement and its original people, stock and records', () => {
  const f = obstructed(); accessInventory(f);
  assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 20);
  const before = copy({ s: f.s, office: f.office, old: f.old, stacks: f.stacks });
  f.c.alive = false; step(f, 100000);
  assert.deepEqual({ s: f.s, office: f.office, old: f.old, stacks: f.stacks }, before);
});
test('missing inspection evidence interrupts an unfinished signature safely instead of fabricating consent', () => {
  const f = obstructed(); accessInventory(f);
  assert.ok(A.settleAccess(f.s, f.succession, f.upkeep, f.office, f.stacks, f.s.access.offer, f.c, f.at)); step(f, 20);
  f.s.access.inspection = null; step(f, 40);
  assert.equal(f.s.job, null); assert.equal(f.s.access.settlement, null); assert.equal(f.old.assignment, null);
  assert.equal(f.s.receipt, null); assert.equal(f.office.publicWorksAccessSettlements, undefined);
});
test('an authentic signed settlement survives the unsigned offer deadline but cannot be detached from a later transfer', () => {
  const f = obstructed(); accessSettlement(f); step(f, 4000);
  assert.ok(A.transfer(f.s, f.succession, f.upkeep, f.office, f.s.appointment, f.c, f.at, f.stacks));
  step(f, 2); step(f, 120); assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  f.s.incumbentPolicy = 'contestThenRelease'; f.office.publicWorksAccessSettlements = [];
  assert.equal(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c), null);
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

// These fixtures execute the authentic appointment, civil order, consenting
// commission, physical grip/release and original-register transfer first.
function oppositionFixture(options = {}) {
  const f = civilFixture();
  f.old.oppositionPolicy = 'seekSafeguards'; f.old.oppositionSettlementPolicy = 'considerSafeguards';
  f.watch = { id: 'watch:a', name: 'Original watch official', institutionId: 'watch:a', roles: ['civilWatch'],
    status: 'alive', health: 100, maxHealth: 100, fatigue: 0, workSeconds: 1200, assignment: null,
    actorKind: 'civicOfficeholder', locationId: f.office.id, roomId: 'supportedSurveyGround', mapCell: { x: 17, y: 11, z: 6 },
    oppositionPolicy: 'joinCustodySafeguards', physicalControl: { strength: 25, stamina: 80, staminaCapacity: 80 } };
  f.succession.leaders.push(f.watch); f.succession.allocation.people++;
  f.succession.source.institutions.push({ role: 'civilWatch', id: f.watch.institutionId, officeRoles: ['civilWatch'] });
  f.c.presentIds.push(f.watch.id);
  civilRelease(f); assert.ok(Civil.transfer(f.e, civilBundle(f))); civilStep(f, 120);
  assert.ok(A.compulsoryTransfer(f.s, f.succession, f.upkeep, f.office, civilBundle(f).c, f.at));
  f.c.localGround = true; f.c.watchAvailable = true;
  const occupancyMove = (actor, target) => {
    const occupied = [f.old, f.watch, f.s.candidate, f.reviewer, f.bargain.defender, f.office.clerk];
    const key = p => `${p.x},${p.y}`, start = actor.mapCell;
    const queue = [{ cell: start, first: null }], seen = new Set([key(start)]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (sameCell(p.cell, target)) { if (!p.first) return false; actor.mapCell = copy(p.first); return true; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cell = { ...p.cell, x: p.cell.x + dx, y: p.cell.y + dy };
        if (cell.x < 12 || cell.x > 20 || cell.y < 8 || cell.y > 14 || seen.has(key(cell))
          || occupied.some(a => a.id !== actor.id && sameCell(a.mapCell, cell))) continue;
        seen.add(key(cell)); queue.push({ cell, first: p.first || cell });
      }
    }
    return false;
  };
  f.effects.move = occupancyMove;
  f.effects.approach = (a, target) => [{ ...target, x: target.x + 1 }, { ...target, y: target.y - 1 }].some(p => occupancyMove(a, p));
  options.prepare?.(f);
  f.o = Opposition.create(oppositionBundle(f)); f.s.opposition = f.o;
  return f;
}
const sameCell = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function defenseFixture(oldDefense = 'defendSelf', watchDefense = 'coverRetreat') {
  const f = oppositionFixture({ prepare: f => {
    f.old.oppositionDefensePolicy = oldDefense; f.watch.oppositionDefensePolicy = watchDefense;
  } });
  protest(f); f.c.scientistCell = { x: 16, y: 13, z: 6 }; f.c.threatLocal = true;
  f.scientistHealth = 100; f.strikes = []; f.telegraphs = [];
  f.effects.canStrike = a => Math.hypot(a.mapCell.x - f.c.scientistCell.x, a.mapCell.y - f.c.scientistCell.y) <= 1.5
    && f.effects.lineOfSight(a.mapCell, f.c.scientistCell);
  f.effects.strike = a => { f.strikes.push(a.id); f.scientistHealth -= 6; return { ok: true, hit: true, damage: 6 }; };
  f.effects.telegraph = (a, pending) => f.telegraphs.push({ actorId: a.id, ...copy(pending) });
  f.effects.incapacitated = a => Boolean(a.incapacitated);
  f.effects.alive = () => f.c.alive;
  return f;
}
const attacked = (f, target = f.old) => Opposition.attack(f.o, oppositionBundle(f), 'scientist', target.id, 'strike');
function oppositionBundle(f) {
  return { ...civilBundle(f), authenticTransfer: Boolean(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c)) };
}
function oppositionStep(f, seconds) {
  let changed = false;
  for (let i = 0; i < seconds; i++) { f.at++; changed = Opposition.advance(f.o, oppositionBundle(f)) || changed; }
  return changed;
}
function protest(f) { assert.ok(f.o); oppositionStep(f, 85); assert.equal(f.o.phase, 'protesting'); }
function oppositionOffer(f) { protest(f); assert.ok(Opposition.discuss(f.o, oppositionBundle(f))); oppositionStep(f, 60); }

test('organized opposition: only authentic compulsory transfer, actual witnessed injury and distinct original single-role watch can seed a group', () => {
  for (const prepare of [f => f.old.oppositionPolicy = 'retainPrivateDissent', f => f.s.receipt.origin = 'voluntary',
    f => f.e.reports = [], f => f.office.publicWorksTransfers = [], f => f.watch.roles.push('civicReview'),
    f => f.succession.source.institutions.at(-1).officeRoles.push('emergencyManagement'), f => f.watch.id = f.s.reviewerId]) {
    const f = oppositionFixture({ prepare }); assert.equal(f.o, null);
  }
  const f = oppositionFixture(); assert.ok(f.o); assert.equal(f.o.formed, null);
  assert.equal(Opposition.publicView(f.o), null); assert.equal(f.watch.assignment, null);
});
test('organized opposition: real meeting and stable independent assent precede actual occupation without new people or inventory', () => {
  const f = oppositionFixture(), before = copy({ members: f.succession.allocation, supplies: f.stacks, receipt: f.s.receipt,
    agreements: f.succession.agreements, dates: [f.upkeep.dueAt, f.upkeep.graceUntil], power: f.office.power });
  oppositionStep(f, 30); assert.equal(f.o.formed, null); assert.ok(f.o.meetingProgress < 60);
  oppositionStep(f, 55); assert.equal(f.o.phase, 'protesting');
  assert.deepEqual([f.old.mapCell, f.watch.mapCell], Opposition.POSTS); assert.equal(f.o.joinDecision.decision, 'joined');
  assert.ok(f.old.workSeconds < 600); assert.ok(f.watch.workSeconds < 1200);
  assert.deepEqual({ members: f.succession.allocation, supplies: f.stacks, receipt: f.s.receipt,
    agreements: f.succession.agreements, dates: [f.upkeep.dueAt, f.upkeep.graceUntil], power: f.office.power }, before);
});
test('organized opposition: existing commitments and blocked approach do not conjure contact or overwrite assignments', () => {
  const f = oppositionFixture(); f.watch.assignment = 'accepted-watch-duty'; oppositionStep(f, 100);
  assert.equal(f.o.phase, 'waiting'); assert.equal(f.o.meetingProgress, 0); assert.equal(f.watch.assignment, 'accepted-watch-duty');
  f.watch.assignment = null; f.effects.approach = () => false;
  const position = copy(f.watch.mapCell), work = f.watch.workSeconds; oppositionStep(f, 100);
  assert.deepEqual(f.watch.mapCell, position); assert.equal(f.watch.workSeconds, work); assert.equal(f.o.formed, null);
  const g = oppositionFixture(); protest(g); g.office.clerk.assignment = 'other-accepted-duty';
  assert.equal(Opposition.discuss(g.o, oppositionBundle(g)), false); assert.equal(g.office.clerk.assignment, 'other-accepted-duty');
  g.office.clerk.assignment = null; g.office.availableAt = g.at + 60;
  assert.equal(Opposition.discuss(g.o, oppositionBundle(g)), false); assert.equal(g.o.job, null);
});
test('organized opposition: refusal after the actual shared account is stable across save and has no replacement or persuasion reroll', () => {
  const f = oppositionFixture({ prepare: f => f.watch.oppositionPolicy = 'retainIndependentDuty' });
  oppositionStep(f, 100); assert.equal(f.o.phase, 'declinedSupport'); assert.equal(f.o.formed, null);
  assert.equal(f.watch.assignment, null); assert.equal(f.old.assignment, null);
  const before = copy(f.o); f.s = A.normalize(f.s); f.o = f.s.opposition; f.succession.appointments = f.s;
  oppositionStep(f, 100); assert.equal(f.o.joinDecision.decision, 'refused'); assert.equal(f.o.formed, null);
  assert.deepEqual(f.o.joinDecision, before.joinDecision); assert.equal(f.o.history.length, before.history.length);
});
test('organized opposition: actual receiving occupancy blocks staged collection but not recognition, supplies or an alternative reserve path', () => {
  const f = oppositionFixture(); protest(f); const before = copy(f.stacks);
  assert.ok(Administration.inspect(f.upkeep, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 30; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move: f.effects.move });
  assert.equal(f.upkeep.job.status, 'collecting'); assert.equal(f.upkeep.job.cargo, null); assert.deepEqual(f.stacks[0].quantity, before[0].quantity);
  assert.ok(A.authorization(f.s, f.succession, f.upkeep, f.office, f.c));
  assert.ok(Administration.cancel(f.upkeep, f.succession, f.office, f.stacks, f.c, f.at));
  // The protest is not a global supply-disable flag. An original accessible
  // reserve can support accepted maintenance without deleting either occupant.
  f.stacks[0].carriedBy = 'another-real-custodian';
  assert.ok(Administration.order(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.upkeep.inspection, f.c, f.at));
  f.at += 200; Administration.advance(f.upkeep, f.succession, f.bargain, f.office, f.stacks, f.c, f.at, { move: f.effects.move });
  assert.equal(f.upkeep.job, null); assert.equal(f.succession.provision.stock, 12);
  assert.deepEqual([f.old.mapCell, f.watch.mapCell], Opposition.POSTS);
});
test('organized opposition: exact witnessed safeguards spend original capacity, save partial signing and require real withdrawal', () => {
  const f = oppositionFixture(); oppositionOffer(f); const original = copy({ receipt: f.s.receipt, supplies: f.stacks,
    health: f.old.health, dates: [f.upkeep.dueAt, f.upkeep.graceUntil] });
  assert.ok(f.o.offer); assert.equal(Opposition.accept(f.o, oppositionBundle(f), { ...f.o.offer, promise: 'immunity' }), false);
  const power = f.office.power, work = f.watch.workSeconds;
  assert.ok(Opposition.accept(f.o, oppositionBundle(f), copy(f.o.offer))); oppositionStep(f, 30);
  assert.equal(f.o.settlement, null); f.s = A.normalize(f.s); f.o = f.s.opposition; f.succession.appointments = f.s;
  oppositionStep(f, 30); assert.equal(f.o.phase, 'withdrawing'); assert.equal(f.office.localOppositionAccounts.length, 1);
  assert.deepEqual([f.old.mapCell, f.watch.mapCell], Opposition.POSTS);
  f.effects.move = () => false; oppositionStep(f, 30); assert.equal(f.o.phase, 'withdrawing');
  assert.deepEqual(f.old.mapCell, Opposition.POSTS[0]); assert.equal(f.watch.workSeconds, work - 60);
  assert.equal(f.office.power, power - 1); assert.equal(Opposition.accept(f.o, oppositionBundle(f), f.o.offer), false);
  assert.deepEqual({ receipt: f.s.receipt, supplies: f.stacks, health: f.old.health, dates: [f.upkeep.dueAt, f.upkeep.graceUntil] }, original);
});
test('organized opposition: accepted account ends only after both actual withdrawals and never duplicates the original register', () => {
  const f = oppositionFixture(); oppositionOffer(f);
  assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer)); oppositionStep(f, 60); oppositionStep(f, 20);
  assert.equal(f.o.phase, 'ended'); assert.deepEqual([f.old.mapCell, f.watch.mapCell], f.o.homes);
  assert.equal(f.old.assignment, null); assert.equal(f.watch.assignment, null); assert.equal(f.office.localOppositionAccounts.length, 1);
  oppositionStep(f, 100); assert.equal(f.office.localOppositionAccounts.length, 1); assert.equal(Opposition.discuss(f.o, oppositionBundle(f)), false);
});
test('organized opposition: categorical settlement refusal and player decline do not grant force or reroll an offer', () => {
  const f = oppositionFixture({ prepare: f => f.old.oppositionSettlementPolicy = 'rejectSafeguards' }); oppositionOffer(f);
  assert.equal(f.o.response.decision, 'refused'); assert.equal(f.o.offer, null); assert.equal(Opposition.discuss(f.o, oppositionBundle(f)), false);
  const g = oppositionFixture(); oppositionOffer(g);
  assert.ok(Opposition.decline(g.o, oppositionBundle(g), g.o.offer)); assert.equal(g.o.phase, 'protesting');
  assert.equal(Opposition.accept(g.o, oppositionBundle(g), g.o.offer), false); assert.equal(g.e.phase, 'transferred');
  assert.equal(Civil.startEscort(g.e, civilBundle(g)), false); assert.equal(g.o.settlement, null);
});
test('organized opposition: missing attendance, changed body, outage and cancelled work never produce an unattended account or refunds', () => {
  for (const change of [f => f.c.presentIds = [f.old.id], f => f.c.bodyEpoch++, f => f.c.activeViolence = true,
    f => f.office.assignment = 'another', f => f.watch.assignment = 'another-duty']) {
    const f = oppositionFixture(); oppositionOffer(f); assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer));
    oppositionStep(f, 30); change(f); oppositionStep(f, 30);
    assert.equal(f.o.settlement, null); assert.equal(f.office.localOppositionAccounts, undefined);
  }
  const g = oppositionFixture(); oppositionOffer(g); assert.ok(Opposition.accept(g.o, oppositionBundle(g), g.o.offer)); oppositionStep(g, 20);
  g.c.externalPowered = false; oppositionStep(g, 100); assert.equal(g.o.job.progress, 20);
  g.c.externalPowered = true; oppositionStep(g, 1); assert.equal(g.o.job.progress, 20);
  const power = g.office.power; assert.ok(Opposition.cancel(g.o, oppositionBundle(g))); assert.equal(g.office.power, power); assert.equal(g.o.settlement, null);
});
test('organized opposition: away observations remain dated without disclosing private choices or replenishing finite participants', () => {
  const f = oppositionFixture(); protest(f); const known = Opposition.publicView(f.o);
  f.c.atCounter = false; f.c.presentIds = []; oppositionStep(f, 100);
  assert.deepEqual(Opposition.publicView(f.o), known); assert.ok(f.o.protestSeconds > 100);
  assert.doesNotMatch(JSON.stringify(known), /oppositionPolicy|SettlementPolicy|workSeconds|"health"|stamina|"stock"/);
  f.c.atCounter = true; f.c.presentIds = [f.old.id, f.watch.id]; oppositionStep(f, 1);
  assert.ok(Opposition.publicView(f.o).reportedAt > known.reportedAt);
});
test('organized opposition: actual violence retains witnessed reports and attempts retreat, never lawful clearance or new civil authority', () => {
  const f = oppositionFixture(); oppositionOffer(f); assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer)); oppositionStep(f, 10);
  const receipt = copy(f.s.receipt); assert.ok(Opposition.attack(f.o, oppositionBundle(f), 'scientist', f.watch.id, 'strike'));
  assert.equal(f.o.phase, 'withdrawing'); assert.equal(f.o.settlement, null); assert.ok(f.o.reports.length > 0);
  assert.deepEqual(f.watch.mapCell, Opposition.POSTS[1]); assert.deepEqual(f.s.receipt, receipt);
  assert.equal(Civil.startEscort(f.e, civilBundle(f)), false);
  f.watch.health = 49; oppositionStep(f, 1); assert.equal(f.o.phase, 'stopped'); assert.deepEqual(f.watch.mapCell, Opposition.POSTS[1]);
});
test('organized opposition: finite capacity and death retain original people, positions, records and deadlines', () => {
  const f = oppositionFixture(); protest(f); f.old.workSeconds = 12; oppositionStep(f, 1);
  assert.equal(f.o.phase, 'withdrawing'); assert.deepEqual(f.old.mapCell, Opposition.POSTS[0]);
  oppositionStep(f, 20); assert.equal(f.o.phase, 'ended'); assert.ok(f.old.workSeconds < 12);
  const g = oppositionFixture(); protest(g); const before = copy({ opposition: g.o, old: g.old, watch: g.watch, office: g.office });
  g.c.alive = false; oppositionStep(g, 100);
  assert.deepEqual({ opposition: g.o, old: g.old, watch: g.watch, office: g.office }, before);
});
test('organized opposition: expired terms, an incapacitated clerk and altered original watch jurisdiction cannot finish a saved account', () => {
  for (const change of [f => f.at = f.o.offer.expiresAt, f => f.office.clerk.health = 49,
    f => f.succession.source.institutions.at(-1).officeRoles.push('civicReview')]) {
    const f = oppositionFixture(); oppositionOffer(f); assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer));
    oppositionStep(f, 20); const power = f.office.power; change(f); f.at += 60;
    Opposition.advance(f.o, oppositionBundle(f));
    assert.equal(f.o.settlement, null); assert.equal(f.office.localOppositionAccounts, undefined); assert.equal(f.office.power, power);
    assert.deepEqual([f.old.mapCell, f.watch.mapCell], Opposition.POSTS);
  }
});

test('defensive resistance: peaceful protest, declined safeguards and expiry cannot activate combat or replenish original people', () => {
  const f = defenseFixture(); oppositionStep(f, 20);
  assert.equal(f.o.defense, undefined); assert.equal(f.strikes.length, 0);
  assert.ok(Opposition.discuss(f.o, oppositionBundle(f))); oppositionStep(f, 60);
  assert.ok(Opposition.decline(f.o, oppositionBundle(f), f.o.offer));
  f.at = f.o.offer.expiresAt; Opposition.advance(f.o, oppositionBundle(f));
  assert.equal(f.o.defense, undefined); assert.equal(f.strikes.length, 0);
});
test('defensive resistance: witnessed aggression independently activates actual guard, finite telegraphed ordinary strikes and recovery', () => {
  const f = defenseFixture(), original = copy({ receipt: f.s.receipt, supplies: f.stacks, agreements: f.succession.agreements });
  const stamina = f.old.physicalControl.stamina, duty = f.old.workSeconds;
  assert.ok(attacked(f)); assert.equal(f.o.defense.participants[0].status, 'defending');
  assert.equal(f.o.defense.participants[1].status, 'defending'); assert.equal(f.strikes.length, 0);
  oppositionStep(f, 1); assert.equal(f.telegraphs.length, 2); assert.equal(f.strikes.length, 0);
  assert.ok(Opposition.guard(f.o, f.old.id, f.at));
  assert.ok(f.old.physicalControl.stamina < stamina); assert.ok(f.old.workSeconds < duty);
  oppositionStep(f, 1); assert.equal(f.strikes.length, 0);
  oppositionStep(f, 1); assert.equal(f.strikes.length, 2); assert.equal(f.scientistHealth, 88);
  oppositionStep(f, 3); assert.equal(f.strikes.length, 2);
  assert.deepEqual({ receipt: f.s.receipt, supplies: f.stacks, agreements: f.succession.agreements }, original);
  assert.equal(Civil.startEscort(f.e, civilBundle(f)), false);
});
test('defensive resistance: independent flight and self-only defense do not manufacture shared obedience', () => {
  const f = defenseFixture('flee', 'defendSelf'); const oldCell = copy(f.old.mapCell);
  assert.ok(attacked(f)); assert.deepEqual(f.o.defense.participants.map(p => p.status), ['retreating', 'retreating']);
  oppositionStep(f, 4); assert.equal(f.strikes.length, 0); assert.notDeepEqual(f.old.mapCell, oldCell);
  assert.equal(f.old.oppositionDefensePolicy, 'flee'); assert.equal(f.watch.oppositionDefensePolicy, 'defendSelf');
});
test('defensive resistance: no private remote trigger, invisible recruitment or commandeering another accepted assignment', () => {
  const f = defenseFixture(); f.c.scientistCell = { x: 10, y: 10, z: 6 }; attacked(f);
  assert.equal(f.o.defense, undefined);
  const g = defenseFixture(); g.watch.assignment = 'accepted-watch-duty'; attacked(g);
  assert.equal(g.watch.assignment, 'accepted-watch-duty'); assert.deepEqual(g.o.defense.participants.map(p => p.actorId), [g.old.id]);
  const h = defenseFixture(); h.effects.lineOfSight = () => false; attacked(h); assert.equal(h.o.defense, undefined);
  const j = defenseFixture(); j.c.threatLocal = false; attacked(j); assert.equal(j.o.defense, undefined);
});
test('defensive resistance: saved windups and stable decisions survive reload without duplicate strikes, duty or refund', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1);
  const saved = copy(f.o), people = copy([f.old, f.watch]), stamina = f.old.physicalControl.stamina;
  f.o = copy(saved); f.s.opposition = f.o;
  assert.deepEqual([f.old, f.watch], people); assert.deepEqual(f.o, saved);
  Opposition.advance(f.o, oppositionBundle(f)); assert.equal(f.strikes.length, 0);
  assert.equal(f.old.physicalControl.stamina, stamina);
  oppositionStep(f, 2); assert.equal(f.strikes.length, 2);
  Opposition.advance(f.o, oppositionBundle(f)); assert.equal(f.strikes.length, 2);
});
test('defensive resistance: moving, lost sight, leaving approach and body changes cancel pending attacks without refund or remote pursuit', () => {
  for (const change of [f => f.c.scientistCell = { x: 17, y: 13, z: 6 }, f => f.effects.lineOfSight = () => false,
    f => f.c.scientistCell = { x: 10, y: 10, z: 6 }, f => f.c.threatLocal = false, f => f.c.bodyEpoch++]) {
    const f = defenseFixture(); attacked(f); oppositionStep(f, 1); const spent = f.old.physicalControl.stamina;
    change(f); oppositionStep(f, 2); assert.equal(f.strikes.length, 0); assert.ok(f.old.physicalControl.stamina <= spent);
    assert.ok(f.o.defense.participants.every(p => !p.pending));
  }
});
test('defensive resistance: finite threat expires and retreat remains collision-bound without deleting occupants or stock', () => {
  const f = defenseFixture(); attacked(f); f.effects.move = () => false; const bodies = copy([f.old.mapCell, f.watch.mapCell]), stock = copy(f.stacks);
  oppositionStep(f, 12); assert.equal(f.o.defense.phase, 'retreating'); const strikes = f.strikes.length;
  oppositionStep(f, 20); assert.equal(f.strikes.length, strikes); assert.deepEqual([f.old.mapCell, f.watch.mapCell], bodies);
  assert.deepEqual(f.stacks, stock); assert.equal(Opposition.defenseActive(f.o), true);
  assert.equal(Opposition.guard(f.o, f.old.id, f.at), false);
});
test('defensive resistance: incapacity, exhausted reserves and death stop one person without immobilizing capable companion or healing wounds', () => {
  for (const change of [f => { f.old.health = 0; f.old.status = 'dead'; }, f => f.old.incapacitated = true,
    f => f.old.physicalControl.stamina = 0, f => f.old.workSeconds = 0]) {
    const f = defenseFixture(); attacked(f); oppositionStep(f, 1); change(f); oppositionStep(f, 2);
    assert.equal(f.o.defense.participants[0].status, 'stopped'); assert.equal(Opposition.guard(f.o, f.old.id, f.at), false);
    assert.ok(!f.strikes.includes(f.old.id)); assert.ok(f.strikes.includes(f.watch.id));
    const cell = copy(f.old.mapCell), health = f.old.health; oppositionStep(f, 20);
    assert.deepEqual(f.old.mapCell, cell); assert.equal(f.old.health, health); assert.equal(f.o.defense.phase, 'ended');
  }
});
test('defensive resistance: unsigned account interruption and post-settlement aggression preserve original once-only promises', () => {
  const f = defenseFixture(); assert.ok(Opposition.discuss(f.o, oppositionBundle(f))); oppositionStep(f, 60);
  assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer)); oppositionStep(f, 10); attacked(f);
  assert.equal(f.o.job, null); assert.equal(f.o.settlement, null); assert.equal(f.office.localOppositionAccounts, undefined);
  const g = defenseFixture(); assert.ok(Opposition.discuss(g.o, oppositionBundle(g))); oppositionStep(g, 60);
  assert.ok(Opposition.accept(g.o, oppositionBundle(g), g.o.offer)); oppositionStep(g, 60);
  const account = copy(g.o.settlement), register = copy(g.office.localOppositionAccounts);
  attacked(g); oppositionStep(g, 3); assert.deepEqual(g.o.settlement, account); assert.deepEqual(g.office.localOppositionAccounts, register);
});
test('defensive resistance: received knowledge exposes only dated visible actions, never policies, stamina or remote positions', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1); const known = Opposition.publicView(f.o);
  assert.ok(known.defense.participants.some(p => p.pending));
  assert.doesNotMatch(JSON.stringify(known), /oppositionDefensePolicy|defendSelf|coverRetreat|workSeconds|stamina|physicalControl/);
  f.c.atCounter = false; f.c.threatLocal = false; f.c.presentIds = []; oppositionStep(f, 20);
  assert.deepEqual(Opposition.publicView(f.o), known); assert.equal(f.o.defense.phase, 'ended');
});
test('defensive resistance: scientist death freezes saved windups, original bodies and remaining supplies', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1); f.c.alive = false;
  const before = copy({ o: f.o, old: f.old, watch: f.watch, stacks: f.stacks }); oppositionStep(f, 100);
  assert.deepEqual({ o: f.o, old: f.old, watch: f.watch, stacks: f.stacks }, before); assert.equal(f.strikes.length, 0);
});
test('defensive resistance: renewed witnessed attacks retain earlier encounters and spend remaining reserves rather than resetting capacity', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 25);
  assert.equal(f.o.defense.phase, 'ended'); const first = copy(f.o.defense), stamina = f.old.physicalControl.stamina;
  f.c.scientistCell = { x: f.old.mapCell.x, y: f.old.mapCell.y + 1, z: 6 };
  attacked(f); assert.deepEqual(f.o.defenseHistory, [first]); assert.equal(f.old.physicalControl.stamina, stamina);
  oppositionStep(f, 3); assert.ok(f.old.physicalControl.stamina < stamina);
  assert.deepEqual(f.o.defenseHistory[0], first); assert.ok(f.o.reports.length > 0);
});
test('defensive resistance: missing original mandate stops unsupported pending force without moving anyone or inventing new law', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1);
  const positions = copy([f.old.mapCell, f.watch.mapCell]); f.office.publicWorksTransfers = [];
  oppositionStep(f, 5); assert.equal(f.o.defense.phase, 'ended'); assert.equal(f.strikes.length, 0);
  assert.deepEqual([f.old.mapCell, f.watch.mapCell], positions);
  assert.equal(f.old.assignment, null); assert.equal(f.watch.assignment, null);
});
test('defensive resistance: an ordinary lethal effect stops the second pending attack and freezes further work', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1);
  f.effects.strike = actor => { f.strikes.push(actor.id); f.c.alive = false; return { ok: true, hit: true, damage: 100 }; };
  oppositionStep(f, 2); assert.deepEqual(f.strikes, [f.old.id]);
  const before = copy({ defense: f.o, old: f.old, watch: f.watch }); oppositionStep(f, 20);
  assert.deepEqual({ defense: f.o, old: f.old, watch: f.watch }, before);
});
test('defensive resistance: fractional live ticks preserve actual preparation and finite cost through a partial reload', () => {
  const f = defenseFixture(); attacked(f); const stamina = f.watch.physicalControl.stamina;
  for (let i = 0; i < 8; i++) { f.at += .25; Opposition.advance(f.o, oppositionBundle(f)); }
  assert.equal(f.strikes.length, 0); assert.equal(f.o.defense.participants[1].pending.releaseAt, f.at + 1);
  assert.equal(f.watch.physicalControl.stamina, stamina - 8);
  f.o = copy(f.o); f.s.opposition = f.o;
  for (let i = 0; i < 4; i++) { f.at += .25; Opposition.advance(f.o, oppositionBundle(f)); }
  assert.equal(f.strikes.length, 2); assert.deepEqual(f.watch.mapCell, f.o.homes[1]);
  assert.equal(f.watch.physicalControl.stamina, stamina - 10); // Three guard seconds, preparation and one real step.
});
test('defensive resistance: physical strike obstruction cancels prepared force even while the target remains visible', () => {
  const f = defenseFixture(); attacked(f); oppositionStep(f, 1); const spent = f.watch.physicalControl.stamina;
  f.effects.canStrike = () => false; oppositionStep(f, 2);
  assert.equal(f.strikes.length, 0); assert.ok(f.o.defense.participants.every(p => p.lastOutcome.result === 'cancelled'));
  assert.ok(f.watch.physicalControl.stamina < spent); assert.ok(f.telegraphs.length === 2);
});

function safeguardFixture() {
  const f = oppositionFixture(); oppositionOffer(f);
  assert.ok(Opposition.accept(f.o, oppositionBundle(f), f.o.offer)); oppositionStep(f, 80);
  assert.equal(f.o.phase, 'ended');
  f.watch.oppositionRenewalPolicy = 'considerAcknowledgedSafeguards';
  f.c.scientistCell = { x: 17, y: 10, z: 6 }; f.c.threatLocal = true;
  const battery = { id: 'carried-extra-battery', key: 'relayBattery', quantity: 1, carriedBy: 'scientist' };
  f.stacks.push(battery);
  assert.ok(Administration.handSupply(f.upkeep, f.succession, f.bargain, f.office, f.stacks, 'relayBattery', f.c, f.at));
  return f;
}
function safeguardBundle(f) { const b = oppositionBundle(f); b.current = Opposition.current(f.o, b); return b; }
function safeguardStep(f, seconds) { f.at += seconds; return Safeguards.advance(f.o, safeguardBundle(f)); }
function removed(f, options = {}) {
  const from = copy(f.watch.mapCell), to = { ...from, x: from.x + 1 };
  f.watch.mapCell = copy(to); f.at++;
  return Safeguards.removal(f.o, safeguardBundle(f), { id: `actual-shove:${f.at}`, at: f.at, actorId: 'scientist',
    targetId: f.watch.id, actionId: 'shove', from, to, bodyEpoch: 0, ...options });
}
function receivedSafeguards(f) {
  while (Safeguards.receive(f.o, safeguardBundle(f))) safeguardStep(f, 30);
  assert.ok(f.o.safeguards.received.length);
}
function reviewedSafeguards(f) {
  receivedSafeguards(f); assert.ok(Safeguards.file(f.o, safeguardBundle(f))); safeguardStep(f, 30);
  f.at = f.o.safeguards.reviews[0].readyAt;
  assert.ok(Safeguards.hear(f.o, safeguardBundle(f))); safeguardStep(f, 180);
  assert.equal(f.o.safeguards.reviews[0].finding.outcome, 'breachUpheld');
}
test('safeguards: only authentic signed post-acceptance witnessed displacement qualifies, never an attack report alone', () => {
  for (const event of [{ actionId: 'strike' }, { at: 0 }, { actorId: 'other' }, { bodyEpoch: 1 }, { targetId: 'other' }]) {
    const f = safeguardFixture(); assert.equal(removed(f, event), false); assert.equal(Safeguards.withdrawn(f.o, f.watch.id), false);
  }
  const f = safeguardFixture(); attacked(f); assert.equal(Safeguards.withdrawn(f.o, f.watch.id), false);
  const g = safeguardFixture(); g.office.localOppositionAccounts = []; assert.equal(removed(g), false);
  const h = safeguardFixture(); h.effects.lineOfSight = () => false; assert.equal(removed(h), false);
  const i = safeguardFixture(); i.c.threatLocal = false; assert.equal(removed(i), false);
});
test('safeguards: firsthand withdrawal is prospective and private testimony requires finite attended communication', () => {
  const f = safeguardFixture(), history = copy({ account: f.o.settlement, appointment: f.s.receipt, stock: f.stacks });
  assert.ok(removed(f)); assert.equal(Safeguards.withdrawn(f.o, f.watch.id), true);
  assert.equal(Safeguards.withdrawn(f.o, f.old.id), false); assert.equal(Safeguards.publicView(f.o), null);
  const power = f.office.power;
  assert.ok(Safeguards.receive(f.o, safeguardBundle(f))); safeguardStep(f, 15);
  assert.equal(f.o.safeguards.received.length, 0); f.o = copy(f.o); f.s.opposition = f.o;
  safeguardStep(f, 15); assert.equal(f.o.safeguards.received.length, 1); assert.equal(f.office.power, power - 1);
  receivedSafeguards(f); assert.equal(Safeguards.receive(f.o, safeguardBundle(f)), false);
  assert.deepEqual({ account: f.o.settlement, appointment: f.s.receipt, stock: f.stacks }, history);
  assert.doesNotMatch(JSON.stringify(Safeguards.publicView(f.o)), /oppositionRenewalPolicy|workSeconds|stamina/);
});
test('safeguards: shared original queue and independent reviewer produce one bounded finding, not restored consent', () => {
  const f = safeguardFixture(); removed(f); receivedSafeguards(f);
  assert.ok(Safeguards.file(f.o, safeguardBundle(f))); safeguardStep(f, 30);
  const r = f.o.safeguards.reviews[0], jobs = copy(f.institutions.offices[f.reviewer.institutionId].jobs);
  assert.equal(Safeguards.hear(f.o, safeguardBundle(f)), false); assert.equal(Safeguards.file(f.o, safeguardBundle(f)), false);
  f.at = r.readyAt; assert.ok(Safeguards.hear(f.o, safeguardBundle(f))); safeguardStep(f, 90);
  assert.equal(r.finding, null); f.o = copy(f.o); f.s.opposition = f.o; safeguardStep(f, 90);
  assert.equal(f.o.safeguards.reviews[0].finding.outcome, 'breachUpheld');
  assert.equal(Safeguards.withdrawn(f.o, f.watch.id), true); assert.deepEqual(f.institutions.offices[f.reviewer.institutionId].jobs, jobs);
  assert.equal(Safeguards.hear(f.o, safeguardBundle(f)), false);
});
test('safeguards: outages pause without backfill, and changed body or evidence cancels without refund', () => {
  const f = safeguardFixture(); removed(f); assert.ok(Safeguards.receive(f.o, safeguardBundle(f))); safeguardStep(f, 10);
  f.c.externalPowered = false; safeguardStep(f, 100); assert.equal(f.o.safeguards.job.progress, 10);
  f.c.externalPowered = true; safeguardStep(f, 100); assert.equal(f.o.safeguards.job.progress, 10);
  f.c.presentIds = []; safeguardStep(f, 100); assert.equal(f.o.safeguards.job.progress, 10);
  f.c.bodyEpoch++; const power = f.office.power; safeguardStep(f, 100);
  assert.equal(f.o.safeguards.job, null); assert.equal(f.office.power, power); assert.equal(f.o.safeguards.received.length, 0);
  const g = safeguardFixture(); removed(g); receivedSafeguards(g); assert.ok(Safeguards.file(g.o, safeguardBundle(g)));
  removed(g); safeguardStep(g, 30); assert.equal(g.o.safeguards.job, null); assert.equal(g.o.safeguards.reviews.length, 0);
});
test('safeguards: missing or interested reviewer cannot create an independent finding or replacement people', () => {
  for (const change of [f => f.reviewer.roles = [], f => f.institutions.offices[f.reviewer.institutionId].available = false,
    f => f.institutions.roles['civic-review'] = f.watch.institutionId]) {
    const f = safeguardFixture(); removed(f); receivedSafeguards(f); change(f);
    assert.equal(Safeguards.file(f.o, safeguardBundle(f)), false); assert.equal(f.o.safeguards.reviews.length, 0);
  }
});
test('safeguards: exact explicit renewal restores only personal willingness, never wounds or erased history', () => {
  const f = safeguardFixture(); removed(f); reviewedSafeguards(f);
  const history = copy({ account: f.o.settlement, health: f.watch.health, reports: f.o.safeguards.received, appointment: f.s.receipt });
  assert.ok(Safeguards.meet(f.o, safeguardBundle(f))); safeguardStep(f, 60);
  const terms = f.o.safeguards.renewalResponses[0].terms;
  assert.equal(Safeguards.withdrawn(f.o, f.watch.id), true);
  assert.equal(Safeguards.sign(f.o, safeguardBundle(f), { ...terms, scope: 'army' }), false);
  assert.ok(Safeguards.sign(f.o, safeguardBundle(f), terms)); safeguardStep(f, 30);
  f.o = copy(f.o); f.s.opposition = f.o; safeguardStep(f, 30);
  assert.equal(Safeguards.withdrawn(f.o, f.watch.id), false); assert.equal(f.o.safeguards.renewals.length, 1);
  assert.equal(Safeguards.sign(f.o, safeguardBundle(f), terms), false);
  assert.deepEqual({ account: f.o.settlement, health: f.watch.health, reports: f.o.safeguards.received, appointment: f.s.receipt }, history);
  removed(f); assert.equal(Safeguards.withdrawn(f.o, f.watch.id), true); assert.equal(f.o.safeguards.renewals.length, 1);
});
test('safeguards: stable refusal and unsigned expiry cannot be rerolled or restore willingness', () => {
  for (const refusal of [true, false]) {
    const f = safeguardFixture(); removed(f); reviewedSafeguards(f);
    if (refusal) f.watch.oppositionRenewalPolicy = 'retainWithdrawal';
    assert.ok(Safeguards.meet(f.o, safeguardBundle(f))); safeguardStep(f, 60);
    const r = f.o.safeguards.renewalResponses[0];
    if (refusal) assert.equal(r.decision, 'refused');
    else { f.at = r.terms.expiresAt; assert.equal(Safeguards.sign(f.o, safeguardBundle(f), r.terms), false); }
    f.o = copy(f.o); f.s.opposition = f.o; assert.equal(Safeguards.meet(f.o, safeguardBundle(f)), false);
    assert.equal(Safeguards.withdrawn(f.o, f.watch.id), true);
  }
});
test('safeguards: scientist death freezes testimony, queue, bodies, costs and dated projections', () => {
  const f = safeguardFixture(); removed(f); assert.ok(Safeguards.receive(f.o, safeguardBundle(f))); safeguardStep(f, 10);
  f.c.alive = false; const before = copy({ o: f.o, people: f.succession.leaders, office: f.office, institutions: f.institutions });
  safeguardStep(f, 100); assert.equal(Safeguards.receive(f.o, safeguardBundle(f)), false);
  assert.deepEqual({ o: f.o, people: f.succession.leaders, office: f.office, institutions: f.institutions }, before);
});
test('safeguards: unchanged displacement, outside-approach force and duplicate ordinary events supply no additional evidence', () => {
  const f = safeguardFixture(), from = copy(f.watch.mapCell);
  assert.equal(removed(f, { from: { ...from, x: from.x + 1 } }), false);
  const g = safeguardFixture(); g.watch.mapCell = { x: 30, y: 12, z: 6 }; assert.equal(removed(g), false);
  const h = safeguardFixture(); removed(h);
  const reports = copy(h.o.safeguards.reports), r = reports[0];
  Safeguards.removal(h.o, safeguardBundle(h), { id: r.eventId, at: r.at, actorId: r.actorId, targetId: r.targetId,
    actionId: r.actionId, from: r.from, to: r.to, bodyEpoch: r.bodyEpoch });
  assert.deepEqual(h.o.safeguards.reports, reports);
});
test('safeguards: away observations stay dated and cancellation or missing original office retains spent costs', () => {
  const f = safeguardFixture(); removed(f); receivedSafeguards(f); const known = Safeguards.publicView(f.o);
  f.c.atCounter = false; f.c.presentIds = []; safeguardStep(f, 100); assert.deepEqual(Safeguards.publicView(f.o), known);
  const g = safeguardFixture(); removed(g); assert.ok(Safeguards.receive(g.o, safeguardBundle(g))); safeguardStep(g, 10);
  const power = g.office.power, work = g.old.workSeconds;
  assert.ok(Safeguards.release(g.o, safeguardBundle(g))); assert.equal(g.office.power, power); assert.equal(g.old.workSeconds, work);
  assert.equal(g.office.assignment, null); assert.equal(g.o.safeguards.received.length, 0);
  assert.ok(Safeguards.receive(g.o, safeguardBundle(g)));
  const b = safeguardBundle(g); b.office = null; b.current = false; b.at++;
  assert.doesNotThrow(() => Safeguards.advance(g.o, b)); assert.equal(g.o.safeguards.job, null);
});
test('safeguards: altered received testimony and missing original finding records cannot grant review or renewal', () => {
  const f = safeguardFixture(); removed(f); receivedSafeguards(f);
  f.o.safeguards.received[0].authorization = 'Invented immunity';
  assert.equal(Safeguards.file(f.o, safeguardBundle(f)), false);
  const g = safeguardFixture(); removed(g); reviewedSafeguards(g);
  g.office.records = g.office.records.filter(r => !r.id.endsWith(':finding'));
  assert.equal(Safeguards.meet(g.o, safeguardBundle(g)), false); assert.equal(Safeguards.withdrawn(g.o, g.watch.id), true);
});
