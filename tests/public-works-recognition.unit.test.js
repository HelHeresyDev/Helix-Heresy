const { test } = require('node:test');
const assert = require('node:assert/strict');
const Charter = require('../charter-recognition');
const Abdication = require('../incumbent-resistance');
const Succession = require('../city-succession');
const Bargains = require('../sovereign-bargains');
const Institutions = require('../home-institution-context');
const Works = require('../public-works-recognition');
const Administration = require('../city-administration');
const Objections = require('../city-resistance');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap') {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'admin:a', active: true, channelPowered: true,
    civicCounter: { cell: { x: 17, y: 8, z: 6 } }, clerk: { id: 'clerk:a', locationId: 'office:a',
      mapCell: { x: 18, y: 8, z: 6 }, status: 'alive', health: 100 }, power: 12, workSeconds: 14400, assignment: null, records: [] };
  const rule = { id: 'rule:a', principle: Succession.CHARTERS[0], reviewInstitutionId: 'review:a',
    coercionRule: 'independentConfirmationPermitted', requiredAuthorizationIds: [], text: 'Explicit local rule.' };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', authority: { id: 'ruler:a', name: 'Incumbent', kind: 'individual' },
    succession: Succession.CHARTERS[0], designationReview: rule, administrationId: office.institutionId, defenseId: 'defense:a',
    populationSourceId: 'population:a', archive: { coverage: [{ cellId: 'a' }] },
    institutions: Succession.ROLES.map(role => ({ role, id: role === 'centralAdministration' ? office.institutionId : role === 'civicReview' ? 'review:a' : `institution:${role}`, name: role })) };
  const b = Bargains.create(source, office, { theme }), succession = Succession.create(source, b, office, { theme });
  const abdication = Abdication.create(succession, b, office, theme);
  succession.ruler.personalDefense.policy = 'preserveLife'; succession.ruler.health = 34;
  const c = { alive: true, capable: true, local: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true, busy: false,
    activeViolence: false, charterCurrent: true, cityId: 'a', authorityId: 'ruler:a', bodyEpoch: 0,
    rulerPresent: true, rulerDistanceM: 1, rulerLineOfEffect: true, cell: { x: 17, y: 8, z: 6 }, recordWitnesses: [office.clerk.id],
    administrationAvailable: true, reviewAvailable: true, rule: copy(rule), authorizationIds: [], conduct: [],
    publicWorksAvailable: true, publicWorksInstitutionId: source.institutions.find(i => i.role === Works.ROLE).id,
    presentIds: succession.leaders.map(a => a.id) };
  assert.ok(Abdication.demand(abdication, succession, c, 0));
  assert.ok(Abdication.accept(abdication, succession, office, copy(abdication.terms), c, 0));
  Abdication.advance(abdication, succession, office, c, 60);
  const charter = Charter.create(succession, abdication, office, theme), institutions = Institutions.create({ cityId: 'a' },
    source.institutions.map(i => ({ ...i, capacityBand: 'exceptional', status: 'operational' })), 60);
  Charter.admin(charter, succession).recognitionPolicy = 'considerAdministrativeContinuity';
  const args = [charter, succession, abdication, office, institutions];
  assert.ok(Charter.file(...args, c, 60)); let at = charter.review.readyAt;
  assert.ok(Charter.hear(...args, c, at)); at += 180; Charter.advance(...args, c, at);
  assert.ok(Charter.meeting(...args, c, at)); at += 60; Charter.advance(...args, c, at);
  assert.ok(Charter.sign(...args, copy(charter.terms), c, at)); at += 60; Charter.advance(...args, c, at);
  const s = Works.create(charter, succession, office), actor = Works.worker(s, succession);
  actor.publicWorksPolicy = 'considerSuppliedCounter';
  return { s, charter, succession, abdication, office, c, institutions, at, b, source, actor, stacks: [] };
}
const args = f => [f.s, f.charter, f.succession, f.abdication, f.office];
function step(f, seconds) { f.at += seconds; Works.advance(...args(f), f.c, f.at); }
function offer(f) { assert.ok(Works.meet(...args(f), f.c, f.at)); step(f, 60); assert.ok(f.s.terms); }
function recognized(f) { offer(f); assert.ok(Works.sign(...args(f), copy(f.s.terms), f.c, f.at)); step(f, 60); assert.ok(f.s.receipt); }
function upkeep(f) {
  recognized(f);
  f.uContext = { ...f.c, workerPresent: true, receiverPresent: true, receivingReachable: true, geometryAvailable: true,
    externalPowered: true, workerCanInspect: true, upkeepReachable: true, reserveInspectable: false,
    staffPresentIds: [...f.succession.leaders.map(a => a.id), f.office.clerk.id],
    recognitions: { publicWorks: f.s, charter: f.charter, abdication: f.abdication }, recognitionContext: f.c };
  f.u = Administration.create(f.succession, f.b, f.office, { context: f.uContext }); assert.ok(f.u);
  f.r = Objections.create(f.u, f.succession, f.office, f.uContext); assert.ok(f.r); return f;
}
const carried = (key, quantity, extra = {}) => ({ id: `${key}:carried`, key, quantity, knownQuantity: quantity, carriedBy: 'scientist', ...extra });
function deliver(f, quantity = 3) {
  f.stacks.push(carried('metalParts', quantity));
  return Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at, { stage: (n, custody) => {
    const id = `staged:${f.stacks.length}`;
    f.stacks.push({ id, key: 'metalParts', quantity: n, cell: copy(custody.cell), cityOwnerId: custody.cityId,
      civicCustody: copy(custody), reservedTaskId: custody.reservation }); return id;
  } });
}
function maintain(f) {
  assert.ok(Administration.inspect(f.u, f.succession, f.office, f.uContext, f.at));
  return Administration.order(f.u, f.succession, f.b, f.office, f.stacks, copy(f.u.inspection), f.uContext, f.at);
}
function tick(f, seconds) {
  f.at += seconds;
  Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.uContext, f.at, { move: (a, target) => {
    for (const key of ['x', 'y', 'z']) if (a.mapCell[key] !== target[key]) { a.mapCell[key] += Math.sign(target[key] - a.mapCell[key]); return true; }
    return false;
  } });
  Objections.advance(f.r, f.u, f.succession, f.b, f.office, f.stacks, f.institutions, f.uContext, f.at);
}
test('every theme binds authentic original receipts and rights without voluntary handover, new resources, people or broader roles', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme), originals = copy({ source: f.source, b: f.b, charter: f.charter.recognition, claim: f.abdication.receipt });
    f.actor.roles.push('civilWatch'); recognized(f);
    assert.equal(f.s.receipt.role, Works.ROLE); assert.equal(f.s.receipt.origin, 'coerced'); assert.equal(f.s.sourceTheme, 'shared');
    assert.equal(f.s.receipt.personId, f.actor.id); assert.equal(f.s.receipt.recorderId, f.office.clerk.id);
    assert.match(f.s.terms.retainedRights, /property and faith/);
    assert.deepEqual({ source: f.source, b: f.b, charter: f.charter.recognition, claim: f.abdication.receipt }, originals);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.equal(f.succession.provision.stock, 0);
    assert.deepEqual(f.succession.agreements, []); assert.equal(f.s.receipt.commandRelationship.role, Works.ROLE);
  }
});
test('missing original central recognition, forged identities, body and institutions cannot authorize public works or upkeep', () => {
  const f = fixture(); assert.equal(Works.create({ ...f.charter, recognition: null }, f.succession, f.office), null);
  const forged = copy(f.charter); forged.recognition.recorderId = 'replacement'; assert.equal(Works.create(forged, f.succession, f.office), null);
  assert.equal(Administration.create(f.succession, f.b, f.office), null); recognized(f);
  for (const change of [r => r.personId = 'other', r => r.role = 'militaryDefense', r => r.officeId = 'other', r => r.bodyEpoch++, r => r.terms.role = 'militaryDefense']) {
    const saved = copy(f.s.receipt); change(f.s.receipt);
    assert.equal(Works.authorization(...args(f), f.c), null); f.s.receipt = saved;
  }
  assert.equal(Works.authorization(...args(f), { ...f.c, publicWorksAvailable: false }), null);
  assert.equal(Works.authorization(...args(f), { ...f.c, publicWorksInstitutionId: 'other' }), null);
  assert.equal(Works.meet(f.s, null, f.succession, f.abdication, f.office, f.c, f.at), false);
  const central = copy(f.charter.recognition); f.charter.recognition.role = 'allInstitutions';
  assert.equal(Works.authorization(...args(f), f.c), null); f.charter.recognition = central;
});
test('stable personal refusal persists through reload with no reroll on unchanged evidence', () => {
  const f = fixture(); f.actor.publicWorksPolicy = 'declineCoercedContinuation';
  assert.ok(Works.meet(...args(f), f.c, f.at)); step(f, 60);
  assert.equal(f.s.response.decision, 'refused'); assert.equal(f.s.terms, null); assert.equal(f.s.receipt, null);
  const response = copy(f.s.response); f.s = Works.normalize(f.s);
  assert.equal(Works.meet(...args(f), f.c, f.at), false); assert.deepEqual(f.s.response, response);
  assert.doesNotMatch(JSON.stringify(Works.publicView(f.s)), /publicWorksPolicy|"evidence"|workSeconds|mapCell/);
});
test('actual attendance, original shared clerk, finite power and duty cannot be substituted by eligibility', () => {
  for (const change of [f => f.c.capable = false, f => f.c.local = false, f => f.c.atCounter = false, f => f.c.busy = true,
    f => f.c.presentIds = [], f => f.c.clerkPresent = false, f => f.c.bodyEpoch++, f => f.c.activeViolence = true,
    f => f.c.publicWorksAvailable = false, f => f.office.power = 0, f => f.office.channelPowered = false,
    f => f.office.workSeconds = 59, f => f.actor.workSeconds = 59, f => f.actor.assignment = 'other']) {
    const f = fixture(); change(f); assert.equal(Works.meet(...args(f), f.c, f.at), false); assert.equal(f.s.receipt, null);
  }
});
test('partial meetings, outages, absence and death preserve spent duty, actual assignments and exact saved state without backfill', () => {
  const f = fixture(), work = f.office.workSeconds, power = f.office.power;
  assert.ok(Works.meet(...args(f), f.c, f.at)); step(f, 20); f.s = Works.normalize(f.s);
  f.office.channelPowered = false; step(f, 500); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; step(f, 500); assert.equal(f.s.job.progress, 20); step(f, 40);
  assert.equal(f.office.workSeconds, work - 60); assert.equal(f.office.power, power - 1); assert.ok(f.s.terms);
  assert.equal(Works.sign(...args(f), { ...f.s.terms, role: 'militaryDefense' }, f.c, f.at), false);
  assert.ok(Works.sign(...args(f), copy(f.s.terms), f.c, f.at)); step(f, 20); f.c.atCounter = false; step(f, 60);
  assert.equal(f.s.job.progress, 20); f.c.alive = false; const frozen = copy(f.s); step(f, 1000); assert.deepEqual(f.s, frozen);
  f.c.alive = true; f.c.bodyEpoch++; step(f, 1); assert.equal(f.s.job, null); assert.equal(f.s.receipt, null); assert.equal(f.office.assignment, null);
});
test('expired and changed-evidence terms cannot sign, refresh or widen an offered continuation', () => {
  const f = fixture(); offer(f); step(f, 3600);
  assert.equal(Works.sign(...args(f), copy(f.s.terms), f.c, f.at), false); assert.equal(Works.meet(...args(f), f.c, f.at), false);
  const changed = fixture(); offer(changed); changed.c.publicWorksConditions = ['Actual received incompatible duty'];
  assert.equal(Works.sign(...args(changed), copy(changed.s.terms), changed.c, changed.at), false);
  assert.ok(Works.meet(...args(changed), changed.c, changed.at)); step(changed, 60); assert.equal(changed.s.response.decision, 'refused');
});
test('physically delivered clean carried parts enter only public-works custody, never a defense reserve or scalar fallback', () => {
  const f = upkeep(fixture()), reserve = copy(f.succession.provision), defender = copy(f.b.defender);
  assert.ok(deliver(f, 6)); const supply = f.stacks.find(i => i.cityOwnerId);
  assert.equal(supply.quantity, 3); assert.equal(f.stacks[0].quantity, 3); assert.equal(supply.civicCustody.custodianId, f.actor.id);
  assert.equal(f.u.receipts[0].stagedStackId, supply.id); assert.equal(f.u.receipts[0].stackId, f.stacks[0].id);
  assert.deepEqual(f.succession.provision, reserve); assert.deepEqual(f.b.defender, defender);
  assert.ok(maintain(f)); assert.equal(f.u.job.source.kind, 'stack');
  const absent = upkeep(fixture()); absent.succession.provision.stock = 18;
  assert.equal(maintain(absent), false); assert.equal(absent.u.job, null);
  const wrongCustody = upkeep(fixture()); deliver(wrongCustody);
  wrongCustody.stacks.find(i => i.cityOwnerId).civicCustody.custodianId = wrongCustody.b.defender.id;
  assert.equal(maintain(wrongCustody), false);
});
test('ground, dirty, reserved, city-owned supplies, unreachable receiving and failed staging consume nothing', () => {
  for (const extra of [{ carriedBy: null }, { tags: ['contaminated'] }, { reservedTaskId: 'another' }, { cityOwnerId: 'a' }]) {
    const f = upkeep(fixture()); f.stacks.push(carried('metalParts', 3, extra));
    assert.equal(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at), false);
    assert.equal(f.stacks[0].quantity, 3); assert.deepEqual(f.u.receipts, []);
  }
  const f = upkeep(fixture()); f.stacks.push(carried('metalParts', 3)); const work = f.actor.workSeconds;
  assert.equal(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at, { stage: () => null }), false);
  f.uContext.receivingReachable = false;
  assert.equal(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at, { stage: () => 'fake' }), false);
  assert.equal(f.stacks[0].quantity, 3); assert.equal(f.actor.workSeconds, work);
});
test('one complete three-part consignment may combine actual carried stacks; incomplete portions remain carried without spent duty', () => {
  const f = upkeep(fixture()); f.stacks.push(carried('metalParts', 1, { id: 'first' }));
  const work = f.actor.workSeconds;
  const stage = (n, custody) => { f.stacks.push({ id: 'combined', key: 'metalParts', quantity: n, cell: copy(custody.cell),
    cityOwnerId: custody.cityId, civicCustody: copy(custody), reservedTaskId: custody.reservation }); return 'combined'; };
  assert.equal(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at, { stage }), false);
  assert.equal(f.stacks[0].quantity, 1); assert.equal(f.actor.workSeconds, work);
  f.stacks.push(carried('metalParts', 2, { id: 'second' }));
  assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'metalParts', f.uContext, f.at, { stage }));
  assert.equal(f.stacks[0].quantity, 0); assert.equal(f.stacks[1].quantity, 0);
  assert.deepEqual(f.u.receipts[0].manifest, [{ stackId: 'first', key: 'metalParts', quantity: 1 }, { stackId: 'second', key: 'metalParts', quantity: 2 }]);
  assert.deepEqual(f.stacks[2].civicCustody.manifest, f.u.receipts[0].manifest); assert.ok(maintain(f));
});
test('authorized actual physical repair can continue away across reload and outages without creating other command', () => {
  const f = upkeep(fixture()); deliver(f); assert.ok(maintain(f)); tick(f, 10); const progress = f.u.job.progress;
  assert.deepEqual(f.u.installation.workCell, { x: 17, y: 9, z: 6 });
  f.u = Administration.normalize(f.u); f.uContext.externalPowered = false; tick(f, 1000); assert.equal(f.u.job.progress, progress);
  f.uContext.externalPowered = true; tick(f, 1000); assert.equal(f.u.job.progress, progress);
  f.uContext.cityId = null; f.uContext.atCounter = false; f.c.cityId = null; f.c.local = false; f.c.atCounter = false;
  assert.equal(Administration.inspect(f.u, f.succession, f.office, f.uContext, f.at), false);
  tick(f, 200); assert.equal(f.u.job, null); assert.equal(f.u.receipts.filter(r => r.installationId).length, 1);
  assert.equal(f.succession.control, null); assert.equal(f.succession.handover, null); assert.equal(f.succession.provision.stock, 0);
  assert.equal(f.u.receipts.at(-1).manifest.sourceReceiptIds[0], f.u.receipts[0].id);
  assert.equal(f.u.dueAt - f.u.servicedAt, Administration.PERIOD); assert.equal(f.u.graceUntil - f.u.dueAt, Administration.GRACE);
});
test('only the actually consenting officials and original clerk receive supplied finite recovery, not defender, watch or reviewer', () => {
  const f = upkeep(fixture()), staff = Administration.staff(f.succession, f.b, f.office, f.u);
  assert.deepEqual(new Set(staff.map(a => a.id)), new Set([f.actor.id, f.charter.administratorId, f.office.clerk.id]));
  f.stacks.push(carried('fieldRation', 10));
  for (const a of [...f.succession.leaders, f.b.defender, f.b.representative].filter(a => !staff.includes(a))) {
    a.workSeconds = 0;
    assert.equal(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, a.id, f.uContext, f.at), false);
  }
  for (const a of staff) { if (a === f.office.clerk) f.office.workSeconds = 0; else a.workSeconds = 0; a.fatigue = 85;
    assert.ok(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, a.id, f.uContext, f.at)); }
  const health = f.actor.health, defender = copy(f.b.defender); tick(f, 14400); assert.equal(f.actor.workSeconds, 0);
  f.u = Administration.normalize(f.u); tick(f, 14400); assert.equal(f.actor.workSeconds, 1800); assert.equal(f.office.workSeconds, 14400);
  assert.equal(f.actor.health, health); assert.deepEqual(f.b.defender, defender); assert.equal(f.stacks[0].quantity, 7);
  const lost = upkeep(fixture()); Charter.admin(lost.charter, lost.succession).status = 'dead';
  assert.equal(Administration.authorization(lost.u, lost.succession, lost.office, lost.uContext), null);
});
test('prospective duties, personally received window and original independent queue limit refusal to public works; repair needs explicit renewal', () => {
  const f = upkeep(fixture()), central = copy(f.charter.recognition), claim = copy(f.abdication.receipt);
  f.actor.roles.push('civilWatch');
  assert.ok(Objections.propose(f.r, f.u, f.succession, f.office, f.uContext, f.at));
  assert.ok(Objections.accept(f.r, f.u, f.succession, f.office, copy(f.r.offer), f.uContext, f.at)); tick(f, 60);
  tick(f, f.u.graceUntil - f.at); assert.ok(f.r.notice); assert.equal(f.r.notice.remedyUntil, null);
  tick(f, 3600); assert.equal(f.r.commandStatus, 'active');
  assert.ok(Objections.receive(f.r, f.u, f.succession, f.office, f.uContext, f.at));
  assert.equal(f.r.notice.remedyUntil, f.at + Objections.WINDOW); tick(f, Objections.WINDOW);
  assert.equal(f.r.commandStatus, 'suspended'); assert.deepEqual(f.s.receipt.suspendedRoles, [Works.ROLE]);
  assert.deepEqual(f.charter.recognition, central); assert.deepEqual(f.abdication.receipt, claim);
  assert.ok(Objections.fileReview(f.r, f.u, f.succession, f.office, f.institutions, f.uContext, f.at));
  assert.equal(Objections.hear(f.r, f.u, f.succession, f.office, f.institutions, f.uContext, f.at), false);
  tick(f, f.r.notice.review.readyAt - f.at);
  assert.ok(Objections.hear(f.r, f.u, f.succession, f.office, f.institutions, f.uContext, f.at)); tick(f, 180);
  assert.equal(f.r.notice.review.status, 'completed'); assert.equal(f.r.commandStatus, 'suspended');
  assert.ok(deliver(f)); assert.ok(maintain(f)); tick(f, 200);
  assert.equal(f.r.commandStatus, 'suspended'); assert.ok(f.u.servicedAt); assert.equal(f.succession.control, null);
  assert.ok(deliver(f));
  assert.ok(Objections.renew(f.r, f.u, f.succession, f.b, f.office, f.stacks, copy(f.r.notice.review), f.uContext, f.at)); tick(f, 60);
  assert.equal(f.r.commandStatus, 'active'); assert.deepEqual(f.s.receipt.suspendedRoles, []);
  assert.equal(f.r.renewals.length, 1); assert.deepEqual(f.charter.recognition, central); assert.equal(f.succession.handover, null);
});

function reconsidered(f, suffix = 'clarified') {
  f.c.upkeep = f.u;
  f.c.rule = { ...f.c.rule, text: `Authentic changed published rule: ${suffix}.` };
  const a = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  assert.ok(Charter.reconsider(...a, f.c, f.at)); f.at = f.charter.reconsideration.readyAt;
  assert.ok(Charter.hearReconsideration(...a, f.c, f.at)); f.at += 180; Charter.advance(...a, f.c, f.at);
  assert.equal(f.charter.reconsideration.finding.outcome, 'eligible'); return f;
}
function administrativeReaffirmation(f) {
  const a = [f.charter, f.succession, f.abdication, f.office, f.institutions];
  assert.ok(Charter.reaffirmMeeting(...a, f.c, f.at)); f.at += 60; Charter.advance(...a, f.c, f.at);
  assert.ok(Charter.reaffirmSign(...a, copy(f.charter.reaffirmation.terms), f.c, f.at)); f.at += 60; Charter.advance(...a, f.c, f.at);
  assert.ok(f.charter.reaffirmation.receipt); return f;
}
function reaffirmOffered(f) {
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 60);
  assert.equal(f.s.reaffirmation.response.decision, 'offered'); return f;
}
function reaffirmed(f) {
  reaffirmOffered(f); assert.ok(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); step(f, 60);
  assert.ok(Works.reaffirmationCurrent(...args(f), f.c)); return f;
}
test('each theme separately renews the original supplied counter basis without resetting historical signatures, stock, disputes, people or other roles', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = upkeep(fixture(theme)); assert.ok(deliver(f)); reconsidered(f); administrativeReaffirmation(f);
    assert.equal(Works.authorization(...args(f), f.c), null);
    assert.equal(Works.reaffirmSign(...args(f), {}, f.c, f.at), false);
    const historical = copy({ charter: f.charter, receipt: f.s.receipt, response: f.s.response, terms: f.s.terms,
      upkeep: f.u, resistance: f.r, stacks: f.stacks, ruler: f.succession.ruler, defender: f.b.defender, source: f.source });
    const power = f.office.power, duty = f.office.workSeconds, work = f.actor.workSeconds;
    reaffirmed(f);
    assert.equal(f.office.power, power - 2); assert.equal(f.office.workSeconds, duty - 120); assert.equal(f.actor.workSeconds, work - 120);
    assert.deepEqual({ charter: f.charter, receipt: f.s.receipt, response: f.s.response, terms: f.s.terms,
      upkeep: f.u, resistance: f.r, stacks: f.stacks, ruler: f.succession.ruler, defender: f.b.defender, source: f.source }, historical);
    assert.equal(f.s.reaffirmation.receipt.type, 'publicWorksReaffirmation');
    assert.equal(f.s.reaffirmation.receipt.originalReceiptId, f.s.receipt.id);
    assert.equal(f.s.reaffirmation.receipt.administrationReaffirmationId, f.charter.reaffirmation.receipt.id);
    assert.equal(f.s.reaffirmation.receipt.findingId, f.charter.reconsideration.id);
    assert.equal(f.office.records.filter(r => r.type === 'publicWorksReaffirmation').length, 1);
    assert.equal(Works.authorization(...args(f), f.c), f.s.receipt);
    assert.ok(maintain(f)); tick(f, 200); assert.equal(f.u.job, null); assert.ok(f.u.servicedAt);
    assert.equal(f.succession.handover, null); assert.equal(f.succession.control, null); assert.equal(f.succession.provision.stock, 0);
    assert.equal(Works.reaffirmMeeting(...args(f), f.c, f.at), false);
    assert.equal(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at), false);
  }
});
test('eligible reconsideration alone, records-only assent alone, wrong originals and unsupported installation cannot authorize renewed public works', () => {
  const noAdmin = reconsidered(upkeep(fixture()));
  assert.equal(Works.reaffirmMeeting(...args(noAdmin), noAdmin.c, noAdmin.at), false);
  for (const change of [f => f.charter.reconsideration.finding.outcome = 'unresolved',
    f => f.charter.reaffirmation.receipt.recorderId = 'replacement', f => f.office.clerk.id = 'replacement',
    f => f.actor.institutionId = 'other', f => f.actor.status = 'dead', f => f.c.publicWorksAvailable = false,
    f => f.c.upkeep = null, f => f.u.authorizationId = 'forged', f => f.u.installation.id = 'other',
    f => f.u.installation.cell.x++, f => f.u.installation.workCell.x++,
    f => f.c.bodyEpoch++, f => f.c.cityId = 'foreign', f => f.c.atCounter = false,
    f => f.c.presentIds = [], f => f.c.busy = true, f => f.c.activeViolence = true,
    f => f.office.maintenanceReady = false, f => f.office.workSeconds = 59, f => f.actor.workSeconds = 59, f => f.office.power = 0]) {
    const f = administrativeReaffirmation(reconsidered(upkeep(fixture()))); change(f);
    assert.equal(Works.reaffirmMeeting(...args(f), f.c, f.at), false); assert.equal(f.s.reaffirmation, null);
  }
});
test('personal independence and actual received renewed violence stably refuse without a signature, forgiveness or reroll', () => {
  const f = administrativeReaffirmation(reconsidered(upkeep(fixture())));
  f.actor.publicWorksPolicy = 'declineCoercedContinuation';
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 60);
  const decision = copy(f.s.reaffirmation); assert.equal(decision.response.decision, 'refused'); assert.equal(decision.terms, null);
  f.s = Works.normalize(f.s); f.uContext.recognitions.publicWorks = f.s;
  assert.equal(Works.reaffirmMeeting(...args(f), f.c, f.at + 1000), false); assert.deepEqual(f.s.reaffirmation, decision);
  const violent = upkeep(fixture());
  violent.c.conduct.push({ id: 'actual-renewed-attack', at: violent.at, kind: 'attack', witnessId: violent.office.clerk.id });
  reconsidered(violent);
  // The original administrator correctly refuses on this same received evidence.
  const a = [violent.charter, violent.succession, violent.abdication, violent.office, violent.institutions];
  assert.ok(Charter.reaffirmMeeting(...a, violent.c, violent.at)); violent.at += 60; Charter.advance(...a, violent.c, violent.at);
  assert.equal(violent.charter.reaffirmation.response.decision, 'refused');
  assert.equal(Works.reaffirmMeeting(...args(violent), violent.c, violent.at), false);
  assert.equal(Works.authorization(...args(violent), violent.c), null); assert.equal(violent.c.conduct.length, 1);
});
test('partial reaffirmation reloads and pauses through absence and outages without backfill or refunded work', () => {
  const f = administrativeReaffirmation(reconsidered(upkeep(fixture()))), duty = f.office.workSeconds, work = f.actor.workSeconds, power = f.office.power;
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 20);
  f.s = Works.normalize(f.s); f.uContext.recognitions.publicWorks = f.s;
  f.c.clerkPresent = false; step(f, 500); assert.equal(f.s.job.progress, 20);
  f.c.clerkPresent = true; step(f, 100); assert.equal(f.s.job.progress, 20); step(f, 40);
  assert.ok(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); step(f, 20);
  f.office.channelPowered = false; step(f, 500); assert.equal(f.s.job.progress, 20);
  f.office.channelPowered = true; step(f, 100); assert.equal(f.s.job.progress, 20); step(f, 40);
  assert.ok(Works.reaffirmationCurrent(...args(f), f.c)); assert.equal(f.office.workSeconds, duty - 120);
  assert.equal(f.actor.workSeconds, work - 120); assert.equal(f.office.power, power - 2);
  assert.equal(f.office.assignment, null); assert.equal(f.actor.assignment, null);
});
test('exact one-hour terms cannot be widened, refreshed, signed after expiry or authenticated by changing labels', () => {
  const f = reaffirmOffered(administrativeReaffirmation(reconsidered(upkeep(fixture()))));
  assert.equal(Works.reaffirmSign(...args(f), { ...f.s.reaffirmation.terms, role: 'militaryDefense' }, f.c, f.at), false);
  f.at = f.s.reaffirmation.terms.expiresAt - 10;
  assert.ok(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); step(f, 10);
  assert.equal(f.s.job, null); assert.equal(f.s.reaffirmation.receipt, null);
  assert.equal(Works.reaffirmMeeting(...args(f), f.c, f.at), false);
  for (const change of [f => f.s.reaffirmation.receipt.role = 'civilWatch', f => f.s.reaffirmation.receipt.type = 'recognition',
    f => f.s.reaffirmation.receipt.recorderId = 'replacement', f => f.s.reaffirmation.receipt.originalReceiptId = 'fake',
    f => f.s.reaffirmation.receipt.findingId = f.charter.review.id, f => f.s.reaffirmation.receipt.administrationReaffirmationId = 'fake',
    f => f.s.reaffirmation.receipt.bodyEpoch++, f => f.s.reaffirmation.receipt.commandRelationship.scope = 'army',
    f => f.s.reaffirmation.terms.duties = 'unlimited obedience', f => f.s.reaffirmation.receipt.at = f.s.reaffirmation.terms.expiresAt,
    f => f.office.records = []]) {
    const g = reaffirmed(administrativeReaffirmation(reconsidered(upkeep(fixture())))); change(g);
    assert.equal(Works.authorization(...args(g), g.c), null); assert.equal(Works.reaffirmationCurrent(...args(g), g.c), false);
  }
});
test('new received facts interrupt unfinished attendance, preserve earlier receipts and require another independent hearing', () => {
  const f = reaffirmOffered(administrativeReaffirmation(reconsidered(upkeep(fixture()))));
  assert.ok(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); step(f, 20);
  const spent = f.office.workSeconds, power = f.office.power;
  f.c.rule.text = 'Further authentic clarification'; step(f, 60);
  assert.equal(f.s.job, null); assert.equal(f.s.reaffirmation.receipt, null); assert.equal(f.office.workSeconds, spent); assert.equal(f.office.power, power);
  const g = reaffirmed(administrativeReaffirmation(reconsidered(upkeep(fixture())))), old = copy(g.s.reaffirmation);
  g.c.rule.text = 'Another genuine clarification'; assert.equal(Works.authorization(...args(g), g.c), null);
  assert.deepEqual(g.s.reaffirmation, old); assert.equal(Works.reaffirmMeeting(...args(g), g.c, g.at), false);
  g.stacks.push(carried('relayBattery', 1)); assert.ok(Administration.handSupply(g.u, g.succession, g.b, g.office, g.stacks, 'relayBattery', g.uContext, g.at));
  reconsidered(g, 'second hearing'); administrativeReaffirmation(g); reaffirmOffered(g);
  assert.deepEqual(g.s.previousReaffirmations, [old]); assert.equal(g.s.reaffirmation.receipt, null);
});
test('essential offline repair uses original custody and real supplies without renewed authority, free service or a cleared objection', () => {
  const f = upkeep(fixture()); reconsidered(f);
  f.at = f.u.graceUntil; tick(f, 0); assert.equal(f.office.maintenanceReady, false);
  assert.equal(Works.authorization(...args(f), f.c), null);
  assert.equal(Administration.authorization(f.u, f.succession, f.office, f.uContext), null);
  assert.equal(Charter.reaffirmMeeting(f.charter, f.succession, f.abdication, f.office, f.institutions, f.c, f.at), false);
  assert.equal(maintain(f), false); assert.equal(f.u.servicedAt, null);
  assert.ok(deliver(f)); const custody = copy(f.u.receipts[0]);
  assert.ok(maintain(f)); assert.equal(f.u.job.essentialOnly, true);
  tick(f, 10); f.u = Administration.normalize(f.u); f.c.upkeep = f.u;
  f.uContext.externalPowered = false; tick(f, 1000); const progress = f.u.job.progress;
  f.uContext.externalPowered = true; tick(f, 1000); assert.equal(f.u.job.progress, progress); tick(f, 200);
  assert.equal(f.u.job, null); assert.equal(f.office.maintenanceReady, true);
  assert.deepEqual(f.u.receipts[0], custody); assert.equal(f.u.receipts.at(-1).essentialOnly, true);
  assert.equal(f.u.receipts.at(-1).quantity, 3); assert.equal(f.u.dueAt - f.u.servicedAt, Administration.PERIOD);
  assert.equal(Works.authorization(...args(f), f.c), null); assert.equal(f.s.reaffirmation, null);
  administrativeReaffirmation(f); reaffirmed(f); assert.equal(Works.authorization(...args(f), f.c), f.s.receipt);
});
test('preserved essential recovery permits only original maintenance official and clerk, using actual packs and full off-duty time', () => {
  const f = reconsidered(upkeep(fixture()));
  f.stacks.push(carried('fieldRation', 3)); f.actor.workSeconds = 0; f.office.workSeconds = 0;
  const administrator = Charter.admin(f.charter, f.succession); administrator.workSeconds = 0;
  assert.equal(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, administrator.id, f.uContext, f.at), false);
  assert.ok(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, f.actor.id, f.uContext, f.at));
  assert.ok(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, f.office.clerk.id, f.uContext, f.at));
  tick(f, Administration.REST - 1); assert.equal(f.actor.workSeconds, 0); tick(f, 1);
  assert.equal(f.actor.workSeconds, 1800); assert.equal(f.office.workSeconds, 14400); assert.equal(administrator.workSeconds, 0);
  assert.equal(f.stacks[0].quantity, 1); assert.equal(Works.authorization(...args(f), f.c), null);
  administrator.workSeconds = 600; administrativeReaffirmation(f); reaffirmed(f);
  assert.equal(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, administrator.id, f.uContext, f.at), false);
});
test('old public-works objection and independent review remain separate after renewed authority; repair does not renew cooperation', () => {
  const f = upkeep(fixture()); assert.ok(Objections.propose(f.r, f.u, f.succession, f.office, f.uContext, f.at));
  assert.ok(Objections.accept(f.r, f.u, f.succession, f.office, copy(f.r.offer), f.uContext, f.at)); tick(f, 60);
  assert.ok(Objections.unsupported(f.r, f.u, f.succession, f.office, f.uContext, f.at));
  const objection = copy(f.r), originalReceipt = copy(f.s.receipt);
  administrativeReaffirmation(reconsidered(f)); reaffirmed(f);
  assert.deepEqual(f.r, objection); assert.deepEqual(f.s.receipt, originalReceipt); assert.equal(f.r.commandStatus, 'suspended');
  f.stacks.push(carried('relayBattery', 1));
  assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.uContext, f.at));
  assert.ok(deliver(f)); assert.ok(maintain(f));
  tick(f, 200); assert.equal(f.r.commandStatus, 'suspended');
  assert.ok(Objections.fileReview(f.r, f.u, f.succession, f.office, f.institutions, f.uContext, f.at)); tick(f, f.r.notice.review.readyAt - f.at);
  f.stacks.push(carried('relayBattery', 1)); assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.uContext, f.at));
  assert.ok(Objections.hear(f.r, f.u, f.succession, f.office, f.institutions, f.uContext, f.at)); tick(f, 180);
  assert.equal(f.r.notice.review.outcome, 'unsupportedOrderUpheld'); assert.equal(f.r.commandStatus, 'suspended');
  assert.ok(deliver(f)); assert.ok(Objections.renew(f.r, f.u, f.succession, f.b, f.office, f.stacks, copy(f.r.notice.review), f.uContext, f.at)); tick(f, 60);
  assert.equal(f.r.commandStatus, 'active'); assert.equal(f.r.renewals.length, 1);
});
test('irreversible death freezes partial reaffirmation and public projection omits private evidence and personnel policies', () => {
  const f = administrativeReaffirmation(reconsidered(upkeep(fixture())));
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 20); f.c.alive = false;
  const saved = copy({ s: f.s, office: f.office, actor: f.actor }); step(f, 1000);
  assert.deepEqual({ s: f.s, office: f.office, actor: f.actor }, saved);
  assert.equal(Works.reaffirmMeeting(...args(f), f.c, f.at), false);
  const g = reaffirmed(administrativeReaffirmation(reconsidered(upkeep(fixture())))), view = Works.publicView(g.s);
  assert.equal(view.reaffirmation.receipt.originalReceiptId, g.s.receipt.id);
  assert.equal(view.reaffirmation.terms.evidence, undefined); assert.equal(view.reaffirmation.terms.conditions, undefined);
  assert.equal(JSON.stringify(view).includes('publicWorksPolicy'), false);
});

test('renewed public works cannot reactivate a historical watch signature even when actual upkeep is supported again', () => {
  const Watch = require('../watch-recognition'), f = upkeep(fixture());
  f.c.watchInstitutionId = f.source.institutions.find(i => i.role === Watch.ROLE).id; f.c.watchAvailable = true;
  const watch = Watch.create(f.charter, f.s, f.succession, f.office), a = [watch, f.charter, f.s, f.succession, f.abdication, f.office];
  Watch.actor(watch, f.succession).watchPolicy = 'considerCounterObservation';
  assert.ok(Watch.meet(...a, f.c, f.at)); f.at += 60; Watch.advance(...a, f.c, f.at);
  assert.ok(Watch.sign(...a, copy(watch.terms), f.c, f.at)); f.at += 60; Watch.advance(...a, f.c, f.at);
  const oldWatch = copy(watch.receipt);
  f.stacks.push(carried('relayBattery', 1)); assert.ok(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.uContext, f.at));
  reaffirmed(administrativeReaffirmation(reconsidered(f)));
  assert.equal(Works.authorization(...args(f), f.c), f.s.receipt);
  assert.equal(Watch.authorization(...a, f.c), null); assert.deepEqual(watch.receipt, oldWatch);
  assert.equal(Watch.order(...a, Watch.instructionTerms(watch), f.c, f.at), false);
});
test('preserved essential requests still require authentic originals, usable geometry and custody and cannot create supplies or remote access', () => {
  for (const change of [f => f.s.receipt.recorderId = 'substitute', f => f.s.receipt.commandRelationship.scope = 'army',
    f => f.charter.reconsideration.claimId = 'fake', f => f.abdication.receipt.recognition = 'sovereign',
    f => f.c.charterCurrent = false, f => f.uContext.geometryAvailable = false, f => f.c.publicWorksAvailable = false,
    f => f.office.active = false, f => f.actor.status = 'dead', f => f.office.clerk.status = 'dead',
    f => f.uContext.atCounter = false, f => f.uContext.cityId = 'other', f => f.c.bodyEpoch++, f => f.uContext.activeViolence = true]) {
    const f = reconsidered(upkeep(fixture())); change(f);
    const stack = carried('metalParts', 3); f.stacks.push(stack);
    assert.equal(deliver(f), false); assert.equal(stack.quantity, 3); assert.equal(f.u.receipts.length, 0);
    assert.equal(Administration.inspect(f.u, f.succession, f.office, f.uContext, f.at), false); assert.equal(f.u.servicedAt, null);
  }
});
test('cancelled or body-invalid reaffirmation preserves spent resources and safe already accepted upkeep survives revised authority', () => {
  const f = administrativeReaffirmation(reconsidered(upkeep(fixture())));
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 20);
  const duty = f.office.workSeconds, power = f.office.power;
  assert.ok(Works.cancel(f.s, f.succession, f.office, f.at)); assert.equal(f.office.workSeconds, duty); assert.equal(f.office.power, power);
  assert.ok(Works.reaffirmMeeting(...args(f), f.c, f.at)); step(f, 60);
  assert.ok(Works.reaffirmSign(...args(f), copy(f.s.reaffirmation.terms), f.c, f.at)); step(f, 20);
  f.c.bodyEpoch++; step(f, 40); assert.equal(f.s.job, null); assert.equal(f.s.reaffirmation.receipt, null);
  const g = upkeep(fixture()); assert.ok(deliver(g)); assert.ok(maintain(g)); tick(g, 10);
  reconsidered(g); tick(g, 200); assert.equal(g.u.job, null); assert.ok(g.u.servicedAt);
  assert.equal(Works.authorization(...args(g), g.c), null); assert.equal(g.s.reaffirmation, null);
});
