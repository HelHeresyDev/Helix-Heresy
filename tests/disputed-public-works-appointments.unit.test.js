const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public-works-appointments');
const Charter = require('../charter-recognition');
const Works = require('../public-works-recognition');
const Abdication = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Administration = require('../city-administration');
const Resistance = require('../city-resistance');
const Institutions = require('../home-institution-context');
const Civil = require('../civil-installation-access');
const copy = v => JSON.parse(JSON.stringify(v));
const move = (a, target) => { for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) {
  a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true;
} return false; };
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    civicCounter: { cell: { x: 17, y: 8, z: 6 } }, clerk: { id: 'clerk:a', locationId: 'office:a',
      mapCell: { x: 18, y: 8, z: 6 }, status: 'alive', health: 100 }, power: 12, workSeconds: 14400, assignment: null, records: [] };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Explicit local rule.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', population: 100, archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`,
      name: role, officeRoles: [role], appointmentMethod: 'appointmentBySovereignAuthority' })) };
  const worksId = source.institutions.find(i => i.role === A.ROLE).id;
  source.disputedPublicWorksAppointment = A.disputedRuleFor('a', worksId, 'review:a');
  source.civilInstallationAccess = Civil.ruleFor('a', worksId, 'review:a', 'defense:a');
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Abdication.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const rc = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: [],
    publicWorksAvailable: true, publicWorksInstitutionId: worksId, presentIds: succession.leaders.map(a => a.id) };
  assert.ok(Abdication.demand(abdication, succession, rc, 0));
  assert.ok(Abdication.accept(abdication, succession, office, copy(abdication.terms), rc, 0));
  Abdication.advance(abdication, succession, office, rc, 60);
  const charter = Charter.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Charter.admin(charter, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  const ca = [charter, succession, abdication, office, institutions];
  assert.ok(Charter.file(...ca, rc, 60)); let at = charter.review.readyAt;
  assert.ok(Charter.hear(...ca, rc, at)); at += 180; Charter.advance(...ca, rc, at);
  assert.ok(Charter.meeting(...ca, rc, at)); at += 60; Charter.advance(...ca, rc, at);
  assert.ok(Charter.sign(...ca, copy(charter.terms), rc, at)); at += 60; Charter.advance(...ca, rc, at);
  const works = Works.create(charter, succession, office), old = Works.worker(works, succession);
  old.publicWorksPolicy = 'considerSuppliedCounter';
  const wa = [works, charter, succession, abdication, office];
  assert.ok(Works.meet(...wa, rc, at)); at += 60; Works.advance(...wa, rc, at);
  assert.ok(Works.sign(...wa, copy(works.terms), rc, at)); at += 60; Works.advance(...wa, rc, at);
  const c = { ...rc, workerPresent: true, receiverPresent: true, receivingReachable: true, geometryAvailable: true,
    externalPowered: true, workerCanInspect: true, upkeepReachable: true, reserveInspectable: false, accessInventoryVisible: true,
    staffPresentIds: [...rc.presentIds, office.clerk.id], appointmentRule: copy(source.disputedPublicWorksAppointment),
    appointmentOffice: { id: worksId, roles: [A.ROLE], appointmentMethod: 'appointmentBySovereignAuthority' },
    recognitions: { charter, publicWorks: works, abdication }, recognitionContext: rc };
  const u = Administration.create(succession, b, office, { context: c, theme }); rc.upkeep = u;
  assert.ok(u); u.resistance = Resistance.create(u, succession, office, c);
  const s = A.create(succession, u, office, source, at, c); assert.ok(s); succession.appointments = s;
  s.candidate.credential.maintenance = 50; s.candidate.appointmentPolicy = 'considerExactDuties'; s.incumbentPolicy = 'contestThenRelease';
  c.presentIds = [...rc.presentIds, office.clerk.id, s.candidate.id];
  return { s, succession, u, office, source, c, institutions, b, old, charter, works, abdication, rc, at, stacks: [] };
}
const args = f => [f.s, f.succession, f.u, f.office];
function tick(f, seconds, effects = {}) { f.at += seconds; return A.advance(...args(f), f.institutions, f.c, f.at, { move, stacks: f.stacks, ...effects }); }
function propose(f) {
  assert.ok(A.discuss(...args(f), f.c, f.at)); tick(f, 60);
  assert.ok(A.propose(...args(f), f.institutions, copy(f.s.dossier), f.c, f.at));
}
function appoint(f) {
  propose(f); tick(f, f.s.review.readyAt - f.at);
  assert.ok(A.hear(...args(f), f.institutions, f.c, f.at)); tick(f, 180);
  assert.equal(f.s.review.outcome, 'eligible');
  assert.ok(A.appoint(...args(f), copy(f.s.terms), f.c, f.at)); tick(f, 60);
  assert.ok(A.approach(...args(f), f.c, f.at)); tick(f, 30);
  assert.equal(f.s.travel, null);
}
function transfer(f) {
  assert.ok(A.transfer(...args(f), copy(f.s.appointment), f.c, f.at, f.stacks));
  tick(f, 30); tick(f, 120); assert.ok(f.s.receipt);
}
function deliver(f) {
  f.stacks.push({ id: `carried:${f.stacks.length}`, key: 'metalParts', quantity: 3, knownQuantity: 3, carriedBy: 'scientist' });
  assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.c, f.at, { stage: (n, custody) => {
    const id = `staged:${f.stacks.length}`;
    f.stacks.push({ id, key: 'metalParts', quantity: n, cityOwnerId: 'a', cell: copy(custody.cell), civicCustody: copy(custody), reservedTaskId: custody.reservation }); return id;
  } }));
}
test('disputed appointments: actual producer chain supports one peaceful replacement in every theme without forging sovereign control', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme); deliver(f);
    const originals = copy({ claim: f.abdication.receipt, charter: f.charter, works: f.works, source: f.source,
      provision: f.succession.provision, agreements: f.succession.agreements, receipts: f.u.receipts, goods: f.stacks, health: f.old.health });
    appoint(f); assert.equal(f.u.workerId, f.old.id); assert.equal(f.s.receipt, null);
    transfer(f);
    assert.equal(f.s.receipt.origin, 'peacefulDisputedAppointment'); assert.ok(A.authorization(...args(f), f.c));
    assert.equal(f.u.workerId, f.s.candidate.id); assert.deepEqual(f.s.candidate.roles, [A.ROLE]);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null);
    assert.deepEqual({ claim: f.abdication.receipt, charter: f.charter, works: f.works, source: f.source,
      provision: f.succession.provision, agreements: f.succession.agreements, receipts: f.u.receipts, goods: f.stacks, health: f.old.health }, originals);
    assert.equal(f.s.receipt.inventory.goods.length, 1); assert.equal(f.s.receipt.inventory.goods[0].custody.custodianId, f.old.id);
    assert.ok(f.u.staffIds.includes(f.s.candidate.id)); assert.ok(!f.u.staffIds.includes(f.old.id));
  }
});
test('disputed appointments: records-only assent, missing law, unconfirmed claim and unsupported combined offices cannot invent power', () => {
  for (const change of [f => f.source.disputedPublicWorksAppointment = null,
    f => f.source.disputedPublicWorksAppointment.minimumMaintenance = 0,
    f => f.charter.review.finding.outcome = 'unresolved', f => f.charter.review.evidence.conduct.push({ id: 'invented' }),
    f => f.rc.conduct.push({ id: 'received-new', at: f.at, kind: 'attack', targetId: f.old.id, witnessId: 'clerk:a' }),
    f => f.works.receipt = null, f => f.charter.recognition.role = 'allInstitutions',
    f => f.old.roles.push('emergencyManagement'), f => f.source.institutions.find(i => i.role === A.ROLE).officeRoles.push('emergencyManagement'),
    f => f.rc.bodyEpoch++, f => f.u.authorizationId = 'other-receipt', f => f.source.designationReview.requiredAuthorizationIds.push('absent-patron')]) {
    const f = fixture(); change(f);
    assert.equal(A.create(f.succession, f.u, f.office, f.source, f.at, f.c), null);
  }
});
test('disputed appointments: partial attendance reload, outages and changed received evidence retain actual costs and original queue', () => {
  const f = fixture(); propose(f); tick(f, f.s.review.readyAt - f.at);
  assert.ok(A.hear(...args(f), f.institutions, f.c, f.at)); tick(f, 90);
  f.s = A.normalize(f.s); f.succession.appointments = f.s; assert.equal(f.s.job.progress, 90);
  f.c.externalPowered = false; tick(f, 100); assert.equal(f.s.job.progress, 90);
  f.c.externalPowered = true; tick(f, 100); assert.equal(f.s.job.progress, 90);
  const power = f.office.power, work = f.office.workSeconds, queue = copy(f.institutions);
  f.rc.conduct.push({ id: 'actual-received', at: f.at, kind: 'attack', targetId: f.old.id, witnessId: 'clerk:a' });
  tick(f, 90); assert.equal(f.s.job, null); assert.equal(f.s.review.status, 'queued');
  assert.equal(f.s.appointment, null); assert.equal(f.office.power, power); assert.equal(f.office.workSeconds, work);
  assert.deepEqual(f.institutions, queue); assert.ok(f.s.proposal.objection);
});
test('disputed appointments: categorical obstruction remains non-operational and published civil access cannot be inherited', () => {
  const f = fixture(); f.s.incumbentPolicy = 'retainInstallation'; f.s.accessPolicy = 'rejectReplacement'; appoint(f);
  assert.equal(A.transfer(...args(f), f.s.appointment, f.c, f.at, f.stacks), false);
  assert.ok(A.discussAccess(...args(f), f.c, f.at)); tick(f, 60);
  assert.equal(f.s.access.reason.kind, 'rejectReplacement');
  assert.equal(A.inspectAccess(...args(f), f.stacks, f.c, f.at), false);
  assert.equal(Civil.create({ appointment: f.s, succession: f.succession, upkeep: f.u, bargain: f.b, office: f.office,
    c: { ...f.c, appointmentCurrent: true, civilAccessRule: f.source.civilInstallationAccess }, at: f.at }), null);
  assert.equal(f.s.receipt, null); assert.equal(f.u.workerId, f.old.id); assert.equal(f.succession.control, null);
});
test('disputed appointments: original staged custody supports real supplied upkeep and incoming-specific objections', () => {
  const f = fixture(); deliver(f); appoint(f); transfer(f);
  const originals = copy({ receipts: f.u.receipts, works: f.works.receipt, stock: f.succession.provision.stock });
  f.c.staffPresentIds.push(f.s.candidate.id);
  assert.ok(Administration.inspect(f.u, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.u, f.succession, f.b, f.office, f.stacks, f.u.inspection, f.c, f.at));
  f.at += 300; Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.u.job, null); assert.equal(f.stacks.find(i => i.id.startsWith('staged:')).quantity, 0);
  assert.equal(f.u.receipts.at(-1).personId, f.s.candidate.id); assert.deepEqual(f.u.receipts.slice(0, originals.receipts.length), originals.receipts);
  assert.deepEqual(f.works.receipt, originals.works); assert.equal(f.succession.provision.stock, originals.stock);
  f.u.resistance = Resistance.create(f.u, f.succession, f.office, f.c); assert.ok(f.u.resistance);
  assert.equal(f.u.resistance.workerId, f.s.candidate.id);
  assert.ok(Resistance.propose(f.u.resistance, f.u, f.succession, f.office, f.c, f.at));
  assert.equal(Administration.bodyEpoch(f.u, f.succession, f.office, f.c), 0);
  deliver(f); assert.equal(f.u.receipts.at(-1).custodianId, f.s.candidate.id);
});
test('disputed appointments: custody visibility, changed goods, blocked paths and unfinished cargo cannot manufacture handover', () => {
  const f = fixture(); deliver(f); appoint(f); f.c.accessInventoryVisible = false;
  assert.equal(A.transfer(...args(f), f.s.appointment, f.c, f.at, f.stacks), false);
  f.c.accessInventoryVisible = true; f.u.job = { cargo: { quantity: 3 } };
  assert.equal(A.transfer(...args(f), f.s.appointment, f.c, f.at, f.stacks), false); f.u.job = null;
  assert.ok(A.transfer(...args(f), f.s.appointment, f.c, f.at, f.stacks));
  const before = copy(f.old.mapCell); tick(f, 30, { move: () => false }); assert.deepEqual(f.old.mapCell, before);
  assert.equal(f.s.job.progress, 0); tick(f, 30); tick(f, 60);
  f.stacks.find(i => i.id.startsWith('staged:')).quantity--;
  const duty = f.office.workSeconds; tick(f, 60); assert.equal(f.s.job, null); assert.equal(f.s.receipt, null);
  assert.equal(f.u.workerId, f.old.id); assert.equal(f.office.workSeconds, duty);
});
test('disputed appointments: incoming recovery consumes actual provision and full off-duty time without employing the retired official', () => {
  const f = fixture(); appoint(f); transfer(f); const health = f.s.candidate.health;
  f.c.staffPresentIds.push(f.s.candidate.id);
  f.stacks.push({ id: 'actual-provision', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.equal(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, f.old.id, f.c, f.at), false);
  assert.ok(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, f.s.candidate.id, f.c, f.at));
  assert.equal(f.stacks[0].quantity, 0); const remaining = f.s.candidate.workSeconds;
  f.at += 14400; Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.s.candidate.workSeconds, remaining);
  f.at += 14400; Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.s.candidate.workSeconds, 1200); assert.equal(f.s.candidate.health, health); assert.equal(f.u.rests.length, 0);
});
test('disputed appointments: a completed incoming agreement is independent of the retired worker’s later death', () => {
  const f = fixture(); deliver(f); appoint(f); transfer(f); f.old.status = 'dead'; f.old.health = 0;
  assert.ok(A.authorization(...args(f), f.c)); assert.ok(Administration.inspect(f.u, f.succession, f.office, f.c, f.at));
  assert.ok(Administration.order(f.u, f.succession, f.b, f.office, f.stacks, f.u.inspection, f.c, f.at));
  f.at += 300; Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move });
  assert.equal(f.u.job, null); assert.equal(f.u.receipts.at(-1).personId, f.s.candidate.id);
});
test('disputed appointments: exact peaceful custody settlement retains dissent and requires physical release before transfer', () => {
  const f = fixture(); deliver(f); f.s.incumbentPolicy = 'retainInstallation'; f.s.accessPolicy = 'custodyAccountability'; appoint(f);
  f.stacks.push({ id: 'actual-extra-battery', key: 'relayBattery', quantity: 1, carriedBy: 'scientist' });
  assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, f.at));
  assert.equal(A.transfer(...args(f), f.s.appointment, f.c, f.at, f.stacks), false);
  assert.ok(A.discussAccess(...args(f), f.c, f.at)); tick(f, 60);
  assert.ok(A.inspectAccess(...args(f), f.stacks, f.c, f.at)); tick(f, 120);
  assert.equal(A.settleAccess(...args(f), f.stacks, { ...f.s.access.offer, rights: 'immunity' }, f.c, f.at), false);
  assert.ok(A.settleAccess(...args(f), f.stacks, f.s.access.offer, f.c, f.at)); tick(f, 60);
  assert.equal(f.s.receipt, null); transfer(f);
  assert.ok(f.s.receipt.accessSettlementId); assert.ok(f.s.proposal.objection); assert.equal(f.succession.control, null);
});
test('disputed appointments: forged transfer authority, missing original register and invalid custody origin grant no maintenance', () => {
  for (const change of [f => f.s.authority.claim.id = 'forged', f => f.s.appointment.authority.finding.id = 'forged',
    f => f.office.publicWorksAppointments = [], f => f.office.publicWorksTransfers = [],
    f => f.s.receipt.origin = 'compulsoryCivilAccess', f => f.s.receipt.inventory = null,
    f => f.s.agreement.bodyEpoch++, f => f.s.candidate.roles.push('civilWatch')]) {
    const f = fixture(); appoint(f); transfer(f); change(f);
    assert.equal(A.authorization(...args(f), f.c), null); assert.equal(Administration.authorization(f.u, f.succession, f.office, f.c), null);
  }
});
test('disputed appointments: expired consent and scientist death preserve unfinished work and historical claims', () => {
  const f = fixture(); propose(f); tick(f, f.s.review.readyAt - f.at);
  assert.ok(A.hear(...args(f), f.institutions, f.c, f.at)); tick(f, 180);
  assert.ok(A.appoint(...args(f), f.s.terms, f.c, f.at)); tick(f, 30); tick(f, 3600);
  assert.equal(f.s.appointment, null); assert.equal(f.s.job, null);
  const g = fixture(); assert.ok(A.discuss(...args(g), g.c, g.at)); tick(g, 30); g.c.alive = false;
  const saved = copy({ s: g.s, office: g.office, old: g.old, u: g.u }); tick(g, 1000);
  assert.deepEqual({ s: g.s, office: g.office, old: g.old, u: g.u }, saved);
});
