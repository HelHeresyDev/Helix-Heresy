const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public-works-appointments');
const Civil = require('../civil-installation-access');
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
