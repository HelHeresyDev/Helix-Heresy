const { test } = require('node:test');
const assert = require('node:assert/strict');
const Resistance = require('../city-resistance');
const Administration = require('../city-administration');
const Institutions = require('../home-institution-context');
const Registry = require('../carrier-identity');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const market = { homeId: 'a' };
  Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Original counter', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0];
  office.civicCounter = { cell: { x: 17, y: 8, z: 6 } }; office.clerk.mapCell = { x: 18, y: 8, z: 6 };
  const person = (id, roles, cell, institutionId = id) => ({ id, name: id, roles, institutionId,
    status: 'alive', health: 100, fatigue: 0, workSeconds: 1800, assignment: null,
    mapCell: cell, locationId: office.id, roomId: 'supportedSurveyGround' });
  const a = person('works:a', ['publicWorksAndProvisioning', 'centralAdministration'], { x: 16, y: 12, z: 6 });
  const r = person('review:a', ['civicReview'], { x: 14, y: 9, z: 6 });
  const b = { officeId: office.id, representative: person('rep:a', [], { x: 18, y: 9, z: 6 }),
    defender: person('defender:a', ['militaryDefenseCommand'], { x: 19, y: 9, z: 6 }) };
  const succession = { id: 'succession:a', officeId: office.id, source: { cityId: 'a', charterId: 'charter:a' },
    handover: { id: 'handover:a', at: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0,
      commandRelationships: [a, r, b.defender].map(a => ({ personId: a.id, roles: copy(a.roles) })) },
    leaders: [a, r], agreements: [a, r, b.defender].map(a => ({ personId: a.id, roles: copy(a.roles), at: 0 })),
    provision: { stock: 15, receipts: [{ id: 'actual-reserve', quantity: 18, custodianId: b.defender.id }] } };
  const u = Administration.create(succession, b, office), s = Resistance.create(u, succession); u.resistance = s;
  const c = { alive: true, capable: true, atCounter: true, visitPermission: true, clerkPresent: true, lineOfSight: true,
    workerPresent: true, receiverPresent: true, busy: false, cityId: 'a', bodyEpoch: 0, charterCurrent: true,
    administrationAvailable: true, publicWorksAvailable: true, geometryAvailable: true, externalPowered: true,
    workerCanInspect: true, upkeepReachable: true, reserveInspectable: true, reviewAvailable: true,
    staffPresentIds: [a.id, r.id, b.defender.id, office.clerk.id] };
  const home = Institutions.create({ cityId: 'a' }, [{ role: 'civicReview', id: r.institutionId, capacityBand: 'exceptional' }]);
  const stacks = [{ id: 'staged:a', key: 'metalParts', quantity: 3, knownQuantity: 3, cityOwnerId: 'a',
    civicCustody: { cityId: 'a' }, reservedTaskId: 'succession:a:city-maintenance-reserve', carriedBy: '', cell: copy(Administration.RECEIVING) }];
  return { office, a, r, b, succession, u, s, c, home, stacks, at: 0 };
}
function tick(f, seconds) {
  f.at += seconds;
  Administration.advance(f.u, f.succession, f.b, f.office, f.stacks, f.c, f.at, { move: (a, target) => {
    for (const k of ['x', 'y', 'z']) if (a.mapCell[k] !== target[k]) { a.mapCell[k] += Math.sign(target[k] - a.mapCell[k]); return true; }
    return false;
  } });
  Resistance.advance(f.s, f.u, f.succession, f.b, f.office, f.stacks, f.home, f.c, f.at);
}
function action(f, name, expected) {
  const args = [f.s, f.u, f.succession];
  if (name === 'renew') return Resistance.renew(...args, f.b, f.office, f.stacks, expected, f.c, f.at);
  args.push(f.office);
  if (['fileReview', 'hear'].includes(name)) args.push(f.home);
  if (name === 'accept') args.push(expected);
  return Resistance[name](...args, f.c, f.at);
}
function commit(f) {
  assert.equal(action(f, 'propose'), true);
  assert.equal(action(f, 'accept', copy(f.s.offer)), true); tick(f, 60);
  assert.ok(f.s.commitment); assert.equal(f.s.job, null);
}
function overdue(f) { tick(f, f.u.graceUntil - f.at); assert.ok(f.s.notice); }
function suspend(f) { overdue(f); assert.equal(action(f, 'receive'), true); tick(f, Resistance.WINDOW); assert.equal(f.s.commandStatus, 'suspended'); }
function review(f) {
  assert.equal(action(f, 'fileReview'), true);
  tick(f, Math.max(0, f.s.notice.review.readyAt - f.at));
  assert.equal(action(f, 'hear'), true); tick(f, Resistance.HEARING);
  assert.equal(f.s.notice.review.status, 'completed');
}
function repair(f) {
  assert.equal(Administration.inspect(f.u, f.succession, f.office, f.c, f.at), true);
  assert.equal(Administration.order(f.u, f.succession, f.b, f.office, f.stacks, copy(f.u.inspection), f.c, f.at), true);
  tick(f, 180); assert.equal(f.u.job, null); assert.equal(f.office.maintenanceReady, true);
}
function reload(f) {
  f.u = Administration.normalize(f.u); f.s = f.u.resistance;
  f.home = copy(f.home); f.succession = copy(f.succession); f.a = f.succession.leaders[0]; f.r = f.succession.leaders[1];
}
test('binding creates no resources, people, recognition or retrospective obligation', () => {
  const f = fixture(), before = copy({ office: f.office, succession: f.succession, b: f.b });
  assert.equal(f.s.commitment, null); tick(f, 200000);
  assert.equal(f.s.notice, null); assert.equal(f.s.commandStatus, 'active');
  assert.deepEqual({ office: { ...f.office, maintenanceReady: undefined }, succession: f.succession, b: f.b },
    { ...before, office: { ...before.office, maintenanceReady: undefined } });
  assert.equal(action(f, 'accept', f.s.offer), false);
  assert.equal(Resistance.create(f.u, { ...f.succession, handover: null }), null);
});
test('exact prospective signature consumes actual attended work and finite power; altered terms and remote acceptance fail', () => {
  const f = fixture(); assert.equal(action(f, 'propose'), true);
  assert.equal(action(f, 'accept', { ...f.s.offer, remedySeconds: 0 }), false);
  f.c.atCounter = false; assert.equal(action(f, 'accept', f.s.offer), false); f.c.atCounter = true;
  assert.equal(action(f, 'accept', f.s.offer), true); tick(f, 30); assert.equal(f.s.commitment, null);
  assert.equal(f.a.workSeconds, 1770); assert.equal(f.office.workSeconds, 14370); assert.equal(f.office.power, 11);
  reload(f); tick(f, 30); assert.equal(f.s.commitment.acceptedAt, 60);
  assert.equal(f.s.commitment.bodyEpoch, 0); assert.equal(action(f, 'propose'), false);
});
test('leaving or changing bodies cannot complete an unattended agreement, while an external outage pauses without backfill', () => {
  for (const key of ['atCounter', 'alive', 'bodyEpoch']) {
    const f = fixture(); action(f, 'propose'); action(f, 'accept', f.s.offer); tick(f, 20);
    f.c[key] = key === 'bodyEpoch' ? 1 : false; tick(f, 500);
    assert.equal(f.s.commitment, null); if (key !== 'alive') assert.equal(f.s.job, null);
  }
  const f = fixture(); action(f, 'propose'); action(f, 'accept', f.s.offer); tick(f, 20);
  f.c.externalPowered = false; tick(f, 1000); f.c.externalPowered = true; tick(f, 1000);
  assert.equal(f.s.job.progress, 20); tick(f, 40); assert.ok(f.s.commitment);
});
test('a factual local notice has no deadline until actual receipt; absence and reload do not start one', () => {
  const f = fixture(); commit(f); f.c.atCounter = false; f.c.workerPresent = false; overdue(f);
  assert.equal(f.s.notice.receivedAt, null); tick(f, 100000); reload(f); tick(f, 10000);
  assert.equal(f.s.commandStatus, 'active'); assert.equal(f.s.notice.remedyUntil, null);
  assert.equal(action(f, 'receive'), false); f.c.atCounter = true; f.c.workerPresent = true;
  assert.equal(action(f, 'receive'), true); assert.equal(f.s.notice.remedyUntil, f.at + Resistance.WINDOW);
  assert.equal(action(f, 'receive'), false);
});
test('unobserved or unsupported installation conditions cannot fabricate an official report', () => {
  for (const key of ['workerCanInspect', 'charterCurrent', 'geometryAvailable']) {
    const f = fixture(); commit(f); f.c[key] = false; tick(f, 200000); assert.equal(f.s.notice, null, key);
  }
  const f = fixture(); commit(f); f.a.locationId = 'other-city'; tick(f, 200000); assert.equal(f.s.notice, null);
});
test('timely actual repair resolves the warning without retroactive refusal or a wasted queued ruling', () => {
  const f = fixture(); commit(f); overdue(f); action(f, 'receive'); action(f, 'fileReview'); repair(f);
  assert.equal(f.s.commandStatus, 'active'); assert.ok(f.s.notice.resolvedAt);
  assert.equal(f.s.notice.review.status, 'closedByRemedy'); assert.equal(action(f, 'hear'), false);
  assert.equal(f.home.offices[f.r.institutionId].jobs[f.s.notice.review.id].readyAt, f.s.notice.review.readyAt);
});
test('missed received window suspends only one role; real repair does not compel renewed consent or erase recognition', () => {
  const f = fixture(); commit(f); const recognition = copy(f.succession.handover); suspend(f);
  assert.deepEqual(f.succession.agreements[0].suspendedRoles, ['publicWorksAndProvisioning']);
  assert.deepEqual(f.succession.agreements[0].roles, ['publicWorksAndProvisioning', 'centralAdministration']);
  assert.equal(f.succession.control.commandRelationships[0].roleStates.publicWorksAndProvisioning.status, 'suspended');
  repair(f); assert.equal(f.s.commandStatus, 'suspended'); assert.deepEqual(f.succession.handover, recognition);
  assert.equal(f.succession.control.recognizedAuthorityId, 'scientist'); assert.equal(action(f, 'renew', null), false);
});
test('queued independent review requires the actual named reviewer, shared allocation, attendance and finite work', () => {
  const f = fixture(); commit(f); suspend(f);
  const office = f.home.offices[f.r.institutionId]; office.reservedUntil = f.at + 3000;
  assert.equal(action(f, 'fileReview'), true); const r = copy(f.s.notice.review);
  assert.equal(r.readyAt, f.at + 3000 + office.workSeconds); assert.equal(action(f, 'fileReview'), false);
  assert.equal(action(f, 'hear'), false); reload(f); tick(f, r.readyAt - f.at);
  f.c.staffPresentIds = []; assert.equal(action(f, 'hear'), false); f.c.staffPresentIds = [f.r.id];
  f.r.workSeconds = 179; assert.equal(action(f, 'hear'), false); f.r.workSeconds = 1800;
  assert.equal(action(f, 'hear'), true); tick(f, 179); assert.equal(f.s.reviews.length, 0);
  reload(f); tick(f, 1); assert.equal(f.s.reviews.length, 1);
  assert.equal(f.r.workSeconds, 1620); assert.equal(f.s.notice.review.outcome, 'unmetObligationUpheld');
  assert.equal(action(f, 'fileReview'), false); assert.equal(action(f, 'hear'), false); tick(f, 1000); assert.equal(f.s.reviews.length, 1);
});
test('a combined officeholder cannot review their own objection and no free substitute is invented', () => {
  const f = fixture(); f.a.roles.push('civicReview'); f.s.reviewerId = f.a.id; f.s.reviewerInstitutionId = f.a.institutionId;
  commit(f); suspend(f); assert.equal(action(f, 'fileReview'), false);
  assert.match(Resistance.publicView(f.s, f.succession, f.c).reviewAvailability, /cannot judge their own/);
  assert.equal(f.s.reviews.length, 0); assert.equal(f.succession.leaders.length, 2);
});
test('actual outages and uncertain or missing supply custody support capacity findings, never automatic guilt', () => {
  for (const setup of [f => { f.c.externalPowered = false; f.office.channelPowered = false; },
    f => { f.stacks = []; f.succession.provision.stock = 0; }, f => { f.stacks = []; f.c.reserveInspectable = false; },
    f => { f.c.upkeepReachable = false; }]) {
    const f = fixture(); commit(f); setup(f); suspend(f);
    f.c.externalPowered = true; f.office.channelPowered = true; review(f);
    assert.equal(f.s.notice.review.outcome, 'capacityFailureNotMisconduct');
    assert.match(f.s.notice.review.finding, /does not establish personal neglect or crime/);
    assert.equal(f.s.commandStatus, 'suspended');
  }
});
test('unsupported defense-command demand is recorded and immediately refused without control of the actual defender', () => {
  const f = fixture(); commit(f); const defender = copy(f.b.defender), recognition = copy(f.succession.handover);
  assert.equal(action(f, 'unsupported'), true); assert.equal(f.s.commandStatus, 'suspended');
  assert.equal(f.s.notice.kind, 'unsupportedOrder'); assert.equal(f.s.notice.remedyUntil, null);
  assert.equal(action(f, 'unsupported'), false); assert.deepEqual(f.b.defender, defender);
  review(f); assert.equal(f.s.notice.review.outcome, 'unsupportedOrderUpheld'); assert.deepEqual(f.succession.handover, recognition);
});
test('an actually observed interruption during the corrective window remains evidence after capacity recovers', () => {
  const f = fixture(); commit(f); overdue(f); action(f, 'receive');
  f.c.externalPowered = false; tick(f, 120); f.c.externalPowered = true;
  tick(f, Resistance.WINDOW); assert.equal(f.s.commandStatus, 'suspended');
  assert.ok(f.s.notice.capacityReports.some(r => r.blockers.includes('Observed external power outage')));
  reload(f); review(f); assert.equal(f.s.notice.review.outcome, 'capacityFailureNotMisconduct');
});
test('trimming recent status reports does not erase the original evidence of a recovered obstruction', () => {
  const f = fixture(); commit(f); overdue(f); action(f, 'receive');
  f.c.externalPowered = false; tick(f, 1); f.c.externalPowered = true; tick(f, 1);
  for (let i = 0; i < 50; i++) { f.c.upkeepReachable = false; tick(f, 1); f.c.upkeepReachable = true; tick(f, 1); }
  assert.equal(f.s.notice.capacityReports.length, 40);
  assert.ok(f.s.notice.observedCapacityEvidence['Observed external power outage']);
  tick(f, Resistance.WINDOW); reload(f); review(f);
  assert.equal(f.s.notice.review.outcome, 'capacityFailureNotMisconduct');
  assert.ok(f.s.notice.review.evidence.observedCapacityEvidence['Observed external power outage']);
});
test('renewal requires supported remedy, exact ruling and an explicit attended agreement, preserved exactly once across reload', () => {
  const f = fixture(); commit(f); suspend(f); review(f);
  const ruling = copy(f.s.notice.review);
  assert.equal(action(f, 'renew', ruling), false); repair(f);
  assert.equal(action(f, 'renew', { ...ruling, outcome: 'erased' }), false);
  assert.equal(action(f, 'renew', ruling), true); tick(f, 30); assert.equal(f.s.commandStatus, 'suspended');
  reload(f); tick(f, 30); assert.equal(f.s.commandStatus, 'active'); assert.equal(f.s.renewals.length, 1);
  assert.deepEqual(f.succession.agreements[0].suspendedRoles, []); assert.equal(f.s.reviews.length, 1);
  assert.equal(action(f, 'renew', ruling), false); tick(f, 1000); assert.equal(f.s.renewals.length, 1);
});
test('essential manual delivery and supplied recovery remain possible during refusal and do not reset consent', () => {
  const f = fixture(); commit(f); suspend(f); f.office.power = 0; f.a.workSeconds = 0;
  f.stacks.push({ id: 'battery', key: 'relayBattery', quantity: 1, carriedBy: 'scientist' },
    { id: 'food', key: 'fieldRation', quantity: 1, carriedBy: 'scientist' });
  assert.equal(Administration.handSupply(f.u, f.succession, f.b, f.office, f.stacks, 'relayBattery', f.c, f.at), true);
  assert.equal(Administration.rest(f.u, f.succession, f.b, f.office, f.stacks, f.a.id, f.c, f.at), true);
  tick(f, Administration.REST); assert.equal(f.a.workSeconds, 1800); assert.equal(f.s.commandStatus, 'suspended');
  repair(f); assert.equal(f.s.commandStatus, 'suspended');
});
test('already authorized upkeep and carried supplies continue out of sight after a role-specific refusal', () => {
  const f = fixture(); commit(f); assert.equal(action(f, 'unsupported'), true);
  assert.equal(Administration.inspect(f.u, f.succession, f.office, f.c, f.at), true);
  Administration.order(f.u, f.succession, f.b, f.office, f.stacks, copy(f.u.inspection), f.c, f.at); tick(f, 1);
  f.c.atCounter = false; f.c.workerPresent = false; f.c.cityId = null;
  tick(f, 180); assert.equal(f.u.job, null); assert.equal(f.s.commandStatus, 'suspended');
  assert.equal(f.u.receipts.filter(r => r.installationId).length, 1);
});
test('death freezes notices, hearings and allocations; received projections contain no raw personnel or stock totals', () => {
  const f = fixture(); commit(f); suspend(f); action(f, 'fileReview'); const before = copy(f.s);
  f.c.alive = false; tick(f, 1000000); assert.deepEqual(f.s, before);
  const v = Resistance.publicView(f.s, f.succession, f.c);
  assert.doesNotMatch(JSON.stringify(v), /"health"|"fatigue"|"stock"|"workCaps"|"wardMana"/);
});
