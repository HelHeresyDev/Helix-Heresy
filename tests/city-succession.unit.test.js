const { test } = require('node:test');
const assert = require('node:assert/strict');
const Succession = require('../city-succession');
const Watch = require('../watch-recognition');
const Bargains = require('../sovereign-bargains');
const Campaign = require('../campaign');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'counter:a', cityId: 'a', institutionId: 'institution:centralAdministration', active: true, channelPowered: true,
    clerk: { id: 'clerk:a', status: 'alive', health: 100, fatigue: 0 }, power: 12, workSeconds: 1500, availableAt: 0, assignment: null };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Existing Ruler', kind: 'individual' },
    succession: Succession.CHARTERS[0], administrationId: office.institutionId, defenseId: 'institution:militaryDefenseCommand', defenseName: 'Existing defense',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a', latitude: 0, longitude: 0 }] },
    institutions: [...Succession.ROLES, 'militaryDefenseCommand'].map(role => ({ role, id: `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme });
  const s = Succession.create(source, b, office, { theme });
  s.ruler.retirementPolicy = 'considerAdministrativeRetirement';
  const challenge = { terms: { bodyEpoch: 0 }, receipt: { id: 'concession:a', outcome: 'defenderConceded', bodyEpoch: 0,
    defenderId: b.defender.id, witnessId: b.representative.id, charterId: source.charterId, authorityId: source.authority.id },
    petition: { id: 'petition:a', status: 'filedNotAccepted', authorityId: source.authority.id, receiptId: 'concession:a' } };
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    cityId: 'a', authorityId: source.authority.id, bodyEpoch: 0, charterCurrent: true, administrationAvailable: true, defenseAvailable: true,
    institutionsAvailable: true, participantsPresent: true, leadersPresent: true, serviceIds: ['batch:a', 'batch:b', 'batch:c'], oppositionReports: [] };
  return { office, source, b, s, challenge, c, at: 0 };
}
const move = (actor, target) => { for (const key of ['x', 'y', 'z']) if (actor.mapCell[key] !== target[key]) {
  actor.mapCell[key] += Math.sign(target[key] - actor.mapCell[key]); return true;
} return false; };
function step(f, seconds, effects = {}) { f.at += seconds; return Succession.advance(f.s, f.b, f.office, f.c, f.at, { move, ...effects }); }
function hearing(f) {
  assert.equal(Succession.request(f.s, f.b, f.office, f.challenge, f.c, f.at), true);
  for (let i = 0; i < 30 && f.s.phase === 'approaching'; i++) step(f, 1);
  assert.equal(f.s.phase, 'ready'); assert.equal(Succession.hear(f.s, f.b, f.office, f.c, f.at), true); step(f, 180);
}
function signed(f) { hearing(f); assert.equal(f.s.phase, 'offered'); assert.equal(Succession.sign(f.s, f.b, f.office, copy(f.s.terms), f.c, f.at), true); }
const stack = (id, quantity, extra = {}) => ({ id, key: 'metalParts', quantity, knownQuantity: quantity, carriedBy: 'scientist', ...extra });
function provisioned(f) { signed(f); assert.equal(Succession.deliver(f.s, f.b, f.office, [stack('carried:a', 18)], f.c, f.at), true); }
function transferred(f) {
  provisioned(f);
  for (const actor of [...f.s.leaders, f.b.defender]) { assert.equal(Succession.agree(f.s, f.b, f.office, actor.id, f.c, f.at), true); step(f, 60); }
  assert.equal(Succession.handover(f.s, f.b, f.office, f.c, f.at), true); step(f, 180);
  assert.equal(f.s.phase, 'transferred'); f.c.authorityId = 'scientist';
}
function voluntaryWatch(f) {
  transferred(f);
  f.c = { ...f.c, local: true, geometryAvailable: true, postReachable: true, counterVisible: true,
    watchAvailable: true, watchConditions: [], presentIds: f.s.leaders.map(a => a.id),
    watchInstitutionId: f.s.source.institutions.find(i => i.role === 'civilWatch').id };
  f.watch = Watch.create(null, null, f.s, f.office); assert.ok(f.watch);
  f.watchActor = Watch.actor(f.watch, f.s);
  return [f.watch, null, null, f.s, null, f.office];
}
test('voluntary watch: actual handover and original scoped continuation reuse the same finite observation duty', () => {
  const f = fixture(), args = voluntaryWatch(f), original = copy({ handover: f.s.handover, agreements: f.s.agreements, stock: f.s.provision });
  assert.equal(f.watch.receipt.origin, 'voluntaryHandover'); assert.ok(Watch.authorization(...args, f.c));
  assert.ok(Watch.order(...args, Watch.instructionTerms(f.watch), f.c, f.at));
  f.at += 30; Watch.advance(...args, f.c, f.at, { move });
  assert.equal(f.watch.duty.status, 'walking');
  f.c.safeguardWatchWithdrawn = true;
  const duty = copy(f.watch.duty); assert.equal(Watch.authorization(...args, f.c), null);
  for (let i = 0; i < 650 && f.watch.duty; i++) { f.at++; Watch.advance(...args, f.c, f.at, { move }); }
  assert.equal(f.watch.duty, null); assert.equal(f.watch.deliveries[0].seconds, 600);
  assert.deepEqual(f.watchActor.mapCell, duty.homeCell);
  assert.equal(Watch.order(...args, Watch.instructionTerms(f.watch), f.c, f.at), false);
  assert.deepEqual({ handover: f.s.handover, agreements: f.s.agreements, stock: f.s.provision }, original);
});
test('voluntary watch: no forged handover, lost original role, changed body or unrelated withdrawal can grant new commands', () => {
  for (const change of [f => f.s.handover.recognizedAuthorityId = 'other', f => f.c.bodyEpoch++,
    f => f.s.agreements.find(a => a.personId === f.watch.personId).suspendedRoles = ['civilWatch'],
    f => f.s.control.commandRelationships.find(a => a.personId === f.watch.personId).agreementAt++,
    f => f.watchActor.roles = [], f => f.c.watchConditions = ['Incompatible independent duty']]) {
    const f = fixture(), args = voluntaryWatch(f); change(f); assert.equal(Watch.authorization(...args, f.c), null);
  }
});
test('voluntary watch: actual displacement interrupts observation and permits only ordinary physical safe return', () => {
  const f = fixture(), args = voluntaryWatch(f);
  assert.ok(Watch.order(...args, Watch.instructionTerms(f.watch), f.c, f.at));
  f.at += 30; Watch.advance(...args, f.c, f.at, { move });
  for (let i = 0; i < 20 && f.watch.duty.status !== 'observing'; i++) { f.at++; Watch.advance(...args, f.c, f.at, { move }); }
  assert.equal(f.watch.duty.status, 'observing');
  f.watchActor.mapCell.x++; f.c.safeguardWatchWithdrawn = true;
  f.at++; Watch.advance(...args, f.c, f.at, { move }); assert.equal(f.watch.duty.status, 'returning');
  for (let i = 0; i < 20 && f.watch.duty; i++) { f.at++; Watch.advance(...args, f.c, f.at, { move }); }
  assert.equal(f.watch.duty, null); assert.equal(f.watch.deliveries[0].status, 'interruptedReturn');
  assert.ok(f.watch.deliveries[0].seconds < 600); assert.equal(Watch.authorization(...args, f.c), null);
});
test('role-specific refusal blocks new discretionary staging, not historical recognition or previously accepted physical cargo', () => {
  const fresh = fixture(); transferred(fresh);
  const worker = fresh.s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
  fresh.s.agreements.find(a => a.personId === worker.id).suspendedRoles = ['publicWorksAndProvisioning'];
  const receipt = copy(fresh.s.handover);
  assert.equal(Succession.operative(fresh.s, fresh.b, fresh.c), false);
  assert.equal(Succession.directive(fresh.s, fresh.b, fresh.office, fresh.c, fresh.at), false);
  assert.deepEqual(fresh.s.handover, receipt);
  const accepted = fixture(); transferred(accepted);
  assert.equal(Succession.directive(accepted.s, accepted.b, accepted.office, accepted.c, accepted.at), true);
  const person = accepted.s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
  accepted.s.agreements.find(a => a.personId === person.id).suspendedRoles = ['publicWorksAndProvisioning'];
  step(accepted, 60); assert.equal(accepted.s.directive.status, 'carrying');
  step(accepted, 60, { stage: () => 'actual-original-stack' });
  assert.equal(accepted.s.directive.status, 'completed'); assert.equal(accepted.s.provision.stock, 15);
  assert.equal(Succession.operative(accepted.s, accepted.b, accepted.c), false);
});
test('designation binds existing individual ruler, charter, actual institutions and population without mutating world facts', () => {
  const f = fixture();
  const government = { cityId: 'a', sovereigntyScope: 'cityOnly', charter: { id: f.source.charterId, successionPrinciple: f.source.succession },
    roleAssignments: Object.fromEntries(f.source.institutions.map(i => [i.role, i.id])),
    institutions: f.source.institutions.map(i => ({ ...i, publicName: i.name, commandAuthorityId: f.source.authority.id })) };
  const map = { cityGovernments: { governments: [government] }, cityPolities: { polities: [{ cityId: 'a', authority: copy(f.source.authority) }] },
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'population:a', currentPopulation: 8, physicalCondition: 'intact', services: { fortifications: 'operational' } }] },
    strategicPoliticalHistory: { currentControlRows: [{ cityId: 'a', recognizedAuthorityId: 'ruler:a', controlStatus: 'sovereign' }] } };
  const original = copy(map); assert.equal(Succession.sourceFromWorld(map, f.b).authority.id, 'ruler:a'); assert.deepEqual(map, original);
  assert.equal(Succession.sourceFromWorld(map, f.b).designationReview, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).civilInstallationAccess, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).publicWorksRoleReassignment, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).disputedPublicWorksAppointment, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).publicWorksVacancy, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).maintenanceCargoRecovery, null);
  assert.equal(Succession.sourceFromWorld(map, f.b).temporaryMaintenance, null);
  government.charter.designationReview = { id: 'original-law', principle: f.source.succession,
    reviewInstitutionId: government.roleAssignments.civicReview, coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [] };
  const published = Succession.sourceFromWorld(map, f.b).designationReview;
  assert.deepEqual(published, government.charter.designationReview);
  published.coercionRule = 'uncoercedDesignationRequired';
  assert.equal(government.charter.designationReview.coercionRule, 'independentConfirmationPermitted');
  const Appointments = require('../public-works-appointments');
  const worksId = government.roleAssignments.publicWorksAndProvisioning;
  const reviewId = government.roleAssignments.civicReview;
  government.charter.publicWorksAppointment = Appointments.ruleFor('a', worksId, reviewId);
  government.charter.publicWorksVacancy = Appointments.vacancyRuleFor('a', worksId, reviewId);
  government.charter.maintenanceCargoRecovery = Appointments.cargoRecoveryRuleFor('a', worksId);
  government.charter.temporaryMaintenance = Appointments.temporaryMaintenanceRuleFor('a', worksId, reviewId);
  government.charter.civilInstallationAccess = require('../civil-installation-access').ruleFor('a', worksId, reviewId, government.roleAssignments.militaryDefenseCommand);
  for (const i of government.institutions) { i.roles = [i.role]; i.appointmentMethod = 'appointmentBySovereignAuthority'; }
  const replacementSource = Succession.sourceFromWorld(map, f.b);
  assert.deepEqual(replacementSource.publicWorksAppointment, government.charter.publicWorksAppointment);
  assert.deepEqual(replacementSource.publicWorksVacancy, government.charter.publicWorksVacancy);
  replacementSource.publicWorksVacancy.minimumMaintenance = 0;
  assert.equal(government.charter.publicWorksVacancy.minimumMaintenance, 40);
  assert.deepEqual(replacementSource.maintenanceCargoRecovery, government.charter.maintenanceCargoRecovery);
  replacementSource.maintenanceCargoRecovery.collectionSeconds = 0;
  assert.equal(government.charter.maintenanceCargoRecovery.collectionSeconds, 60);
  assert.deepEqual(replacementSource.temporaryMaintenance, government.charter.temporaryMaintenance);
  replacementSource.temporaryMaintenance.repairs = 100;
  assert.equal(government.charter.temporaryMaintenance.repairs, 1);
  assert.deepEqual(replacementSource.civilInstallationAccess, government.charter.civilInstallationAccess);
  replacementSource.civilInstallationAccess.contactSeconds = 0;
  assert.equal(government.charter.civilInstallationAccess.contactSeconds, 20);
  assert.equal(replacementSource.population, 8);
  assert.deepEqual(replacementSource.institutions.find(i => i.role === 'publicWorksAndProvisioning').officeRoles, ['publicWorksAndProvisioning']);
  replacementSource.publicWorksAppointment.minimumMaintenance = 0;
  assert.equal(government.charter.publicWorksAppointment.minimumMaintenance, 40);
  government.charter.disputedPublicWorksAppointment = Appointments.disputedRuleFor('a', worksId, reviewId);
  const disputedSource = Succession.sourceFromWorld(map, f.b);
  assert.deepEqual(disputedSource.disputedPublicWorksAppointment, government.charter.disputedPublicWorksAppointment);
  disputedSource.disputedPublicWorksAppointment.minimumMaintenance = 0;
  assert.equal(government.charter.disputedPublicWorksAppointment.minimumMaintenance, 40);
  government.charter.publicWorksRoleReassignment = Appointments.roleRuleFor('a', worksId, reviewId);
  const combinedSource = Succession.sourceFromWorld(map, f.b);
  assert.deepEqual(combinedSource.publicWorksRoleReassignment, government.charter.publicWorksRoleReassignment);
  combinedSource.publicWorksRoleReassignment.retainedRoles = [];
  assert.deepEqual(government.charter.publicWorksRoleReassignment.retainedRoles, ['emergencyManagement']);
  for (const change of [m => m.cityPolities.polities[0].authority.kind = 'collective', m => m.cityGovernments.governments[0].sovereigntyScope = 'jointStronghold',
    m => m.cityGovernments.governments[0].charter.successionPrinciple = 'inheritance under emergency law', m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 7,
    m => m.cityGovernments.governments[0].institutions[0].commandAuthorityId = 'usurper', m => m.strategicPoliticalHistory.currentControlRows[0].controlStatus = 'occupied']) {
    const bad = copy(map); change(bad); assert.equal(Succession.sourceFromWorld(bad, f.b), null);
  }
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme); assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.ruler.id, f.source.authority.id);
    assert.equal(f.s.allocation.people, 5); assert.equal(f.s.control, null); assert.equal(f.s.provision.stock, 0);
    const worker = f.s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
    assert.ok(worker.physicalControl.strength >= 20 && worker.physicalControl.strength <= 50);
    assert.equal(worker.physicalControl.stamina, 80); assert.equal(worker.skills.guarding, 15);
    worker.physicalControl.stamina = 7;
    assert.equal(Succession.normalize(f.s).leaders.find(a => a.id === worker.id).physicalControl.stamina, 7);
    assert.equal(Succession.create({ ...f.source, succession: 'publicly demonstrated competence' }, f.b, f.office), null);
    assert.equal(Succession.create({ ...f.source, authority: { ...f.source.authority, kind: 'collective' } }, f.b, f.office), null);
  }
});
test('original civic opposition dispositions and ordinary watch body remain deterministic and private across themes and reload', () => {
  const f = fixture(), originalSource = copy(f.source);
  const watch = f.s.leaders.find(a => a.roles.includes('civilWatch'));
  const works = f.s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
  assert.ok(['joinCustodySafeguards', 'retainIndependentDuty'].includes(watch.oppositionPolicy));
  assert.ok(['seekSafeguards', 'retainPrivateDissent'].includes(works.oppositionPolicy));
  assert.ok(['considerSafeguards', 'rejectSafeguards'].includes(works.oppositionSettlementPolicy));
  assert.ok(['defendSelf', 'coverRetreat', 'flee'].includes(works.oppositionDefensePolicy));
  assert.ok(['defendSelf', 'coverRetreat', 'flee'].includes(watch.oppositionDefensePolicy));
  assert.ok(['retainWithdrawal', 'considerAcknowledgedSafeguards'].includes(watch.oppositionRenewalPolicy));
  assert.equal(watch.maxHealth, 100); assert.equal(watch.physicalControl.stamina, 80);
  assert.deepEqual(f.source, originalSource); assert.equal(f.s.allocation.people, 5);
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const g = fixture(theme);
    assert.deepEqual(g.s.leaders.map(a => [a.id, a.oppositionPolicy, a.oppositionSettlementPolicy, a.oppositionDefensePolicy, a.oppositionRenewalPolicy]),
      f.s.leaders.map(a => [a.id, a.oppositionPolicy, a.oppositionSettlementPolicy, a.oppositionDefensePolicy, a.oppositionRenewalPolicy]));
  }
  watch.workSeconds = 3; watch.health = 53;
  assert.deepEqual(Succession.normalize(f.s).leaders.find(a => a.id === watch.id), watch);
  assert.doesNotMatch(JSON.stringify(Succession.publicView(f.s, f.b, f.c)), /oppositionPolicy|oppositionSettlementPolicy|oppositionDefensePolicy|oppositionRenewalPolicy|physicalControl/);
});
test('a combined directorate uses one original person and finite duty for both actual roles without extra population', () => {
  const f = fixture(), source = copy(f.source);
  source.institutions.find(i => i.role === 'publicWorksAndProvisioning').officeRoles = ['emergencyManagement', 'publicWorksAndProvisioning'];
  source.publicWorksRoleReassignment = require('../public-works-appointments').roleRuleFor('a',
    source.institutions.find(i => i.role === 'publicWorksAndProvisioning').id, source.institutions.find(i => i.role === 'civicReview').id);
  const s = Succession.create(source, f.b, f.office), old = s.leaders.find(a => a.roles.includes('publicWorksAndProvisioning'));
  assert.equal(s.allocation.people, f.s.allocation.people); assert.equal(s.leaders.length, f.s.leaders.length);
  assert.deepEqual(old.roles, ['emergencyManagement', 'publicWorksAndProvisioning']); assert.equal(old.workSeconds, 1800);
  old.workSeconds = 23; old.health = 67;
  const saved = Succession.normalize(s).leaders.find(a => a.id === old.id); assert.equal(saved.workSeconds, 23); assert.equal(saved.health, 67);
});
test('appointment flags are not proof: only actual paid civic decisions reviewed against the original producer and charter count', () => {
  const f = fixture(), result = { finding: 'acceptable', confidence: 66 };
  const service = { client: { id: 'producer:a', facilityId: 'works:a' }, jobs: ['a', 'b', 'c'].map(id => ({ id, status: 'completed', paidAt: 5, receivedAt: 2,
    result: copy(result), civic: { mandateId: 'mandate:a', decision: 'clear' } })) };
  const mandate = { authority: { cityId: 'a', charterId: f.source.charterId, authorityId: 'ruler:a' }, mandates: [{ id: 'mandate:a', producerId: 'producer:a', facilityId: 'works:a',
    jobIds: ['a', 'b', 'c', 'a'], review: { status: 'completed', outcome: 'upheld', evidence: ['a', 'b', 'c'].map(id => ({ id, status: 'completed', result: copy(result) })) } }] };
  assert.deepEqual(Succession.serviceEvidence(f.s, mandate, service), ['a', 'b', 'c']);
  for (const change of [m => m.authority.cityId = 'other', m => m.mandates[0].producerId = 'other', m => m.mandates[0].review.outcome = 'revoked',
    m => m.mandates[0].review.evidence = []]) { const bad = copy(mandate); change(bad); assert.deepEqual(Succession.serviceEvidence(f.s, bad, service), []); }
  service.jobs[0].paidAt = null; service.jobs[1].civic.decision = 'hold'; service.jobs[2].result.confidence = 65;
  assert.deepEqual(Succession.serviceEvidence(f.s, mandate, service), []);
});
test('a filed bout request is not acceptance; physical walking spends real duty work and keeps the shared participants reserved', () => {
  const f = fixture(), cell = copy(f.s.ruler.mapCell);
  assert.equal(Succession.request(f.s, f.b, f.office, null, f.c, 0), false);
  assert.equal(Succession.request(f.s, f.b, f.office, { ...f.challenge, petition: { ...f.challenge.petition, receiptId: 'other' } }, f.c, 0), false);
  assert.equal(Succession.request(f.s, f.b, f.office, f.challenge, f.c, 0), true);
  assert.deepEqual(f.s.ruler.mapCell, cell); assert.equal(f.b.defender.assignment, f.s.id); assert.equal(f.s.control, null);
  step(f, 1); assert.notDeepEqual(f.s.ruler.mapCell, cell); assert.equal(f.s.ruler.workSeconds, 1799);
  assert.equal(Succession.hear(f.s, f.b, f.office, f.c, 1), false);
  assert.equal(Bargains.request(f.b, f.office, f.c, 1, 1), false);
});
test('actual incumbent may refuse for personal choice, missing demonstrated service or no administrative bottleneck; reload cannot reroll', () => {
  for (const setup of [f => f.s.ruler.retirementPolicy = 'retainOffice', f => f.c.serviceIds = [], f => f.office.workSeconds = 3600]) {
    const f = fixture(); setup(f); hearing(f); assert.equal(f.s.phase, 'refused'); assert.equal(f.s.decision.decisionMakerId, 'ruler:a');
    assert.equal(f.s.terms, null); assert.equal(f.s.control, null); f.s = Succession.normalize(f.s);
    assert.equal(Succession.request(f.s, f.b, f.office, f.challenge, f.c, f.at), false);
  }
});
test('real outstanding civic duties can support retirement without demanding impossible exhaustion of the counter before handover', () => {
  const f = fixture(); f.office.workSeconds = 14400; f.c.administrationBacklogged = true;
  hearing(f); assert.equal(f.s.phase, 'offered'); assert.match(f.s.decision.reason, /outstanding scheduled civic duties/);
  assert.equal(f.s.control, null); assert.equal(f.office.power, 11);
});
test('exact conditional terms, original body, real carried reserve and separately attended leaders precede any transfer', () => {
  const f = fixture(); hearing(f);
  assert.equal(Succession.sign(f.s, f.b, f.office, { ...f.s.terms, quantity: 1 }, f.c, f.at), false);
  assert.equal(Succession.sign(f.s, f.b, f.office, copy(f.s.terms), { ...f.c, bodyEpoch: 1 }, f.at), false);
  assert.equal(Succession.sign(f.s, f.b, f.office, copy(f.s.terms), f.c, f.at), true);
  const goods = [stack('remote', 50, { carriedBy: '' }), stack('reserved', 10, { reservedTaskId: 'task' }), stack('dirty', 10, { tags: ['contaminated'] }), stack('own', 9)];
  assert.equal(Succession.deliver(f.s, f.b, f.office, goods, f.c, f.at), true); assert.equal(f.s.provision.stock, 9);
  assert.deepEqual(goods.map(i => i.quantity), [50, 10, 10, 0]);
  assert.equal(Succession.agree(f.s, f.b, f.office, f.s.leaders[0].id, f.c, f.at), false);
  assert.equal(Succession.deliver(f.s, f.b, f.office, [stack('own2', 9)], f.c, f.at), true);
  assert.equal(Succession.handover(f.s, f.b, f.office, f.c, f.at), false);
  assert.equal(Succession.agree(f.s, f.b, f.office, f.s.leaders[0].id, f.c, f.at), true); step(f, 30);
  assert.equal(f.s.agreements.length, 0); f.s = Succession.normalize(f.s); step(f, 30); assert.equal(f.s.agreements.length, 1);
  assert.equal(Succession.agree(f.s, f.b, f.office, f.s.leaders[0].id, f.c, f.at), false);
  assert.equal(f.s.control, null);
});
test('unavailable originals, power outage and absence never retroactively perform a handover or replenish staff', () => {
  for (const key of ['alive', 'capable', 'atCounter', 'visitPermission', 'clerkPresent', 'lineOfSight', 'charterCurrent', 'institutionsAvailable', 'leadersPresent', 'participantsPresent']) {
    const f = fixture(); provisioned(f);
    assert.equal(Succession.agree(f.s, f.b, f.office, f.s.leaders[0].id, { ...f.c, [key]: false }, f.at), false);
  }
  const f = fixture(); provisioned(f); assert.equal(Succession.agree(f.s, f.b, f.office, f.s.leaders[0].id, f.c, f.at), true);
  step(f, 20); const work = f.office.workSeconds; f.office.channelPowered = false; step(f, 1000);
  assert.equal(f.s.job.progress, 20); assert.equal(f.office.workSeconds, work); f.office.channelPowered = true;
  step(f, 1000); assert.equal(f.s.job.progress, 20); step(f, 40); assert.equal(f.s.agreements.length, 1);
  assert.equal(f.office.workSeconds, work - 40); assert.equal(f.s.control, null);
});
test('withdrawal, expiry, body change and death preserve consumed resources and cannot award authority', () => {
  const f = fixture(); provisioned(f); const reserve = copy(f.s.provision);
  assert.equal(Succession.cancel(f.s, f.b, f.office, f.at), true); assert.deepEqual(f.s.provision, reserve); assert.equal(f.s.control, null);
  const expired = fixture(); provisioned(expired); step(expired, 86400); assert.equal(expired.s.phase, 'withdrawn'); assert.equal(expired.s.provision.stock, 18);
  const dead = fixture(); hearing(dead); dead.c.alive = false; const original = copy(dead.s); step(dead, 90000); assert.deepEqual(dead.s, original);
  const changed = fixture(); provisioned(changed); Succession.agree(changed.s, changed.b, changed.office, changed.s.leaders[0].id, changed.c, changed.at);
  changed.c.bodyEpoch++; step(changed, 60); assert.equal(changed.s.job, null); assert.equal(changed.s.agreements.length, 0);
});
test('witnessed unlawful-force allegation permits personal defender refusal, not automatic conviction or loyalty', () => {
  const f = fixture(); provisioned(f); f.c.oppositionReports = [{ id: 'witness:a', targetId: f.b.defender.id, kind: 'attackOutsideAgreement', finding: 'Not a conviction' }];
  assert.equal(Succession.agree(f.s, f.b, f.office, f.b.defender.id, f.c, f.at), false);
  assert.deepEqual(f.s.opposition, f.c.oppositionReports); assert.match(f.s.message, /not a criminal conviction/); assert.equal(f.s.control, null);
});
test('physical handover creates run-owned recognition and actual bounded command relationships; losses do not erase the historical receipt', () => {
  const f = fixture(); const original = copy(f.source); transferred(f);
  assert.deepEqual(f.source, original); assert.equal(f.s.handover.recognizedAuthorityId, 'scientist');
  assert.equal(f.s.ruler.status, 'alive'); assert.equal(f.s.control.commandRelationships.length, f.s.leaders.length + 1);
  assert.equal(Succession.operative(f.s, f.b, f.c), true); f.s = Succession.normalize(f.s);
  const receipt = copy(f.s.handover); f.b.defender.health = 49;
  assert.equal(Succession.operative(f.s, f.b, f.c), false); assert.equal(Succession.directive(f.s, f.b, f.office, f.c, f.at), false);
  assert.deepEqual(f.s.handover, receipt); assert.equal(f.s.control.recognizedAuthorityId, 'scientist');
  assert.equal(Succession.operative(f.s, f.b, { ...f.c, bodyEpoch: 1 }), false);
});
test('one administrative directive moves original finite goods physically, retains cargo through reload and stages once only', () => {
  const f = fixture(); transferred(f); assert.equal(Succession.directive(f.s, f.b, f.office, f.c, f.at), true);
  assert.equal(f.s.provision.stock, 18); step(f, 60); assert.equal(f.s.provision.stock, 15); assert.equal(f.s.directive.status, 'carrying');
  f.s = Succession.normalize(f.s); const cargo = copy(f.s.directive.cargo); const staged = [];
  const effects = { stage: (goods, cell) => { staged.push({ goods, cell }); return 'physical-stack:a'; } };
  f.c.institutionsAvailable = false; step(f, 60, effects); assert.equal(staged.length, 0); assert.deepEqual(f.s.directive.cargo, cargo);
  f.c.institutionsAvailable = true;
  for (let i = 0; i < 30 && f.s.directive.status === 'carrying'; i++) step(f, 1, effects);
  assert.equal(f.s.directive.status, 'completed'); assert.equal(staged.length, 1); assert.equal(staged[0].goods.quantity, 3);
  assert.deepEqual(staged[0].cell, Succession.RECEIVING); assert.equal(f.s.directive.receipt.stackId, 'physical-stack:a');
  step(f, 3600, effects); assert.equal(staged.length, 1); assert.equal(Succession.directive(f.s, f.b, f.office, f.c, f.at), false);
  assert.equal(f.s.provision.stock + staged[0].goods.quantity, 18);
});
test('cancelled unfinished order leaves handover and reserve intact without refunding finite work', () => {
  const f = fixture(); transferred(f); const receipt = copy(f.s.handover);
  assert.equal(Succession.directive(f.s, f.b, f.office, f.c, f.at), true); step(f, 20);
  const work = f.office.workSeconds;
  assert.equal(Succession.cancel(f.s, f.b, f.office, f.at), true);
  assert.equal(f.s.job, null); assert.equal(f.s.directive, null); assert.equal(f.s.provision.stock, 18);
  assert.equal(f.office.workSeconds, work); assert.deepEqual(f.s.handover, receipt);
  assert.equal(Succession.directive(f.s, f.b, f.office, f.c, f.at), true);
});
test('failed physical placement retains custody; dated public records omit hidden resources and character preferences', () => {
  const f = fixture(); transferred(f); Succession.directive(f.s, f.b, f.office, f.c, f.at); step(f, 60);
  step(f, 30, { stage: () => null }); assert.equal(f.s.directive.status, 'carrying'); assert.equal(f.s.directive.cargo.quantity, 3);
  const view = Succession.publicView(f.s); assert.equal(view.handover.recognizedAuthorityId, 'scientist');
  assert.doesNotMatch(JSON.stringify(view), /workSeconds|retirementPolicy|wardMana|"stock"/);
  assert.deepEqual(Succession.publicView(Succession.normalize(f.s)), view);
});
test('campaign records only received handover, keeps six ambitions separate and preserves the receipt across normalization', () => {
  let campaign = Campaign.record(null, { kind: 'citySuccession', known: true, handedOver: false, sourceId: 'offer', cityId: 'a' }, 10);
  assert.equal(campaign.cityPower.succession, null);
  campaign = Campaign.record(campaign, { kind: 'citySuccession', known: true, handedOver: true, sourceId: 'handover', cityId: 'a', summary: 'Dated recognition' }, 20);
  assert.equal(campaign.cityPower.succession.at, 20); assert.equal(campaign.accomplishedAt, null);
  assert.equal(Campaign.roadmap('unbound').length, 6); assert.deepEqual(Campaign.normalize(copy(campaign)), campaign);
  assert.equal(Campaign.accomplishments(campaign).length, 1);
});
test('later upkeep replacement receipts preserve custody without rewriting the original conditional designation fulfilment', () => {
  const f = fixture(); transferred(f); const historical = copy(f.s.handover);
  f.s.provision.receipts.push({ id: 'later-parts', at: f.at + 100, purpose: 'upkeepReplacement', quantity: 3, manifest: [{ stackId: 'replacement', quantity: 3 }] });
  assert.equal(Succession.publicView(f.s).received, 18); assert.deepEqual(f.s.handover, historical);
  assert.equal(Succession.normalize(f.s).provision.receipts.length, 2);
});
