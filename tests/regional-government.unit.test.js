const { test } = require('node:test');
const assert = require('node:assert/strict');
const Government = require('../regional-government');
const Rule = require('../city-rule');
const Succession = require('../city-succession');
const Foreign = require('../foreign-civic-bargains');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'w', runId: 'r' };
function fixture(name = 'Original Keeper') {
  const original = sources('b', name), g = { id: 'gate:b', cityId: 'b', z: 10, checkpointRoomId: 'checkpoint:b', materialized: true,
    institutionId: original.succession.administrationId, visitorAdmission: {}, receptionWorkSeconds: 14400, powerSeconds: 86400,
    clerk: { id: 'original-clerk:b', status: 'alive', health: 100, fatigue: 0 }, guard: { id: 'original-guard:b', status: 'alive', health: 100 } };
  g.foreignCivic = Foreign.create(g, original.succession);
  // Generate the actual earlier operating record through the existing model.
  const homeSources = sources('a');
  const people = Rule.ROLES.map(role => ({ id: `${role}:a:person`, status: 'alive', health: 100 }));
  const agreements = people.map((p, i) => ({ personId: p.id, institutionId: homeSources.operation.institutions[i].id, roles: [Rule.ROLES[i]], termsId: 'original-terms:a' }));
  const homeSuccession = { source: homeSources.succession, officeId: 'office:a', handover: { id: 'original-handover:a', termsId: 'original-terms:a', bodyEpoch: 0 },
    agreements, control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'original-handover:a', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const home = Rule.createAggregate(homeSources.operation, homeSuccession, binding, 0, { id: homeSources.defense.installationId, initialEnergy: homeSources.defense.baselineEnergy });
  const hc = { ...binding, bodyEpoch: 0, alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true,
    sourceCurrent: true, coverageVerified: true, institutionsAvailable: true, counterpower: 'noEstablishedChallenge', defenseAvailable: true };
  assert.equal(Rule.order(home, homeSuccession, people, hc, 0), true);
  let at = 3600 + Rule.INTERVAL; Rule.advance(home, homeSuccession, people, () => hc, at);
  Rule.receive(home, homeSuccession, people, hc, at);
  const record = Government.evidence(home, 0), n = Government.create(g, original, record, binding, at);
  assert.ok(n);
  const c = { ...hc, cityId: 'b', visitorPermission: true, atDesk: true, clerkPresent: true, lineOfSight: true,
    originalPeoplePresent: true, leadersPresent: true, positionDisclosed: true };
  return { n, g, original, home, homeSuccession, people, hc, c, at };
}
function advance(f, seconds) {
  f.at += seconds;
  Government.advance(f.n, f.g, f.c, f.at, { move: (a, cell) => { a.mapCell = copy(cell); return true; } });
}
const action = (f, a, expected, stacks) => Government.action(f.n, f.g, f.c, a, expected, f.at, stacks);
function hearing(f) {
  assert.equal(action(f, 'request'), true); advance(f, 5); assert.equal(f.n.succession.phase, 'ready');
  assert.equal(action(f, 'hear'), true); advance(f, 180);
}
function transferred(f) {
  hearing(f); assert.equal(f.n.succession.phase, 'offered');
  assert.equal(action(f, 'sign', copy(f.n.succession.terms)), true);
  const stack = { id: 'owned-parts', key: 'metalParts', quantity: 18, carriedBy: 'scientist', legalOwnerId: 'scientist' };
  assert.equal(action(f, 'deliver', null, [stack]), true); assert.equal(stack.quantity, 0);
  for (const p of [...f.n.succession.leaders, f.g.foreignCivic.bargain.defender]) {
    assert.equal(action(f, 'agree', p.id), true); advance(f, 60);
  }
  assert.equal(action(f, 'handover'), true); advance(f, 180); assert.ok(f.n.rule);
}
test('received governing experience is knowledge, not copied authority, original people or resources', () => {
  const f = fixture(), before = copy(f.home), original = copy(f.original);
  assert.equal(f.n.succession.ruler.retirementPolicy, 'considerAdministrativeRetirement');
  assert.ok(Government.evidence(f.home, 0)); assert.equal(Government.evidence(f.home, 1), null);
  assert.equal(Government.evidence({ ...f.home, report: null }, 0), null);
  assert.equal(f.n.rule, null); assert.equal(f.n.succession.handover, null);
  assert.equal(f.n.succession.allocation.populationSourceId, 'population:b');
  assert.equal(f.n.succession.ruler.mapCell.z, f.g.z);
  transferred(f); assert.deepEqual(f.home, before); assert.deepEqual(f.original, original);
  assert.equal(f.n.rule.id, 'b:city-operating-account'); assert.equal(f.n.rule.succession, undefined);
  assert.equal(f.n.rule.initialEnergy + f.original.defense.baselineEnergy, 5 * 86400 * 3);
  assert.equal(f.n.rule.farms[0].drivers, 6); assert.equal(f.n.rule.pilotProvisionId, null);
  assert.equal(f.n.rule.farms[0].excludedPilotId, null);
});
test('missing sources, incompatible charters, patron authentications, duplicate original people and unreceived records cannot open this route', () => {
  for (const mutate of [f => f.original.operation.farms = [], f => f.original.defense.baselineEnergy = NaN,
    f => f.original.succession.designationReview = { requiredAuthorizationIds: ['patron'] }, f => f.original.succession.succession = 'hereditary',
    f => f.n.evidence.reportAt = f.at + 1, f => f.n.evidence.runId = 'different', f => f.original.operation.charterId = 'other']) {
    const f = fixture(); mutate(f);
    assert.equal(Government.create(f.g, f.original, f.n.evidence, binding, f.at), null);
  }
  const f = fixture(); assert.equal(Government.create(f.g, f.original, f.n.evidence, binding, f.at, [f.n.succession.ruler.id]), null);
  f.c.positionDisclosed = false; assert.equal(action(f, 'request'), false);
});
test('original incumbent refusal is stable and a received record cannot compel retirement or reroll itself', () => {
  // Choose a stable original identity, never override the actual preference.
  let f; for (let i = 0; i < 30; i++) { f = fixture(`Keeper ${i}`); if (f.n.succession.ruler.retirementPolicy === 'retainOffice') break; }
  assert.equal(f.n.succession.ruler.retirementPolicy, 'retainOffice'); hearing(f);
  assert.equal(f.n.succession.phase, 'refused'); assert.equal(f.n.rule, null); assert.equal(action(f, 'request'), false);
  assert.match(f.n.succession.message, /declines retirement/);
});
test('partial attendance, shared clerk work/power and each individual continuation survive reload without any instant handover', () => {
  const f = fixture(); assert.equal(action(f, 'request'), true); advance(f, 5); assert.equal(action(f, 'hear'), true);
  const before = f.g.receptionWorkSeconds, power = f.g.powerSeconds;
  advance(f, 70); assert.equal(f.n.succession.job.progress, 70); assert.equal(before - f.g.receptionWorkSeconds, 70); assert.equal(power - f.g.powerSeconds, 70);
  f.n = Government.normalize(f.n); advance(f, 110); assert.equal(f.n.succession.phase, 'offered');
  assert.equal(action(f, 'sign', { ...f.n.succession.terms, quantity: 0 }), false);
  assert.equal(action(f, 'sign', copy(f.n.succession.terms)), true);
  assert.equal(action(f, 'handover'), false); assert.equal(action(f, 'agree', f.n.succession.leaders[0].id), false);
  assert.equal(action(f, 'deliver', null, [{ id: 'city-goods', key: 'metalParts', quantity: 18, carriedBy: 'scientist', legalOwnerId: 'b' }]), false);
  assert.equal(f.n.succession.provision.stock, 0);
  f.c.atDesk = false; assert.equal(action(f, 'deliver', null, []), false);
});
test('second original city operates while received reports remain stale; actual shortages/withdrawals lose control', () => {
  const f = fixture(); transferred(f); assert.equal(action(f, 'operate'), true); advance(f, 3600);
  assert.equal(action(f, 'report'), true); const dated = Government.publicView(f.n);
  f.c.local = false; f.c.atDesk = false; f.c.visitorPermission = false;
  advance(f, Rule.INTERVAL); assert.equal(f.n.rule.status, 'established'); assert.deepEqual(Government.publicView(f.n), dated);
  assert.equal(action(f, 'report'), false);
  f.n.succession.agreements[0].suspendedRoles = [...f.n.succession.agreements[0].roles]; advance(f, 1);
  assert.equal(f.n.rule.status, 'contested'); assert.equal(f.n.rule.since, null);
  assert.ok(f.n.rule.accomplishment); assert.deepEqual(Government.publicView(f.n), dated);
});
test('same recognized body has counter-only permission, not pardon, research, military or general visitor-hall rights', () => {
  const f = fixture(); transferred(f); f.c.visitorPermission = false;
  assert.equal(Government.context(f.n, f.g, f.c).visitPermission, true);
  f.c.bans = [{ cityId: 'b', status: 'active' }]; assert.equal(action(f, 'operate'), false);
  f.c.bans = []; f.c.free = false; assert.equal(action(f, 'operate'), false);
  f.c.free = true; f.c.bodyEpoch++; assert.equal(action(f, 'operate'), false);
  assert.equal(f.g.foreignCivic.permits.length, 0); assert.equal(f.g.visitorAdmission.offers, undefined);
});
test('witnessed actual aggression ends voluntary consent, not a criminal conviction or automatic death', () => {
  const f = fixture(); transferred(f); const leader = f.n.succession.leaders[0];
  assert.equal(Government.aggression(f.n, f.g, { ...f.c, witnessed: false }, leader.id, 'strike', f.at), false);
  assert.equal(Government.aggression(f.n, f.g, { ...f.c, witnessed: true }, leader.id, 'strike', f.at), true);
  advance(f, 1); assert.equal(f.n.rule.status, 'contested'); assert.equal(action(f, 'operate'), false);
  assert.equal(leader.status, 'alive'); assert.ok(f.n.succession.handover); assert.equal(f.n.conviction, undefined);
});
test('original officer death, source loss and independently exhausted resources are consequential; death freezes everything', () => {
  for (const mutate of [f => f.g.foreignCivic.bargain.defender.status = 'dead', f => f.c.sourceCurrent = false,
    f => f.c.defenseAvailable = false, f => f.n.rule.foodKg = 0, f => f.n.rule.energy = 0]) {
    const f = fixture(); transferred(f); action(f, 'operate'); advance(f, 3600 + 86400); mutate(f); advance(f, 1);
    assert.notEqual(f.n.rule.status, 'established'); assert.equal(f.n.rule.since, null);
  }
  const f = fixture(); transferred(f); const before = copy([f.n, f.g]); f.c.alive = false; advance(f, Rule.INTERVAL);
  assert.deepEqual([f.n, f.g], before); assert.equal(Government.normalize(null), null);
  assert.equal(Government.rebind(f.n, { ...binding, runId: 'other' }, { worldId: 'w2', runId: 'r2' }), null);
});
test('continued-copy import rebinds the knowledge packet and unfinished political work without rerolling the incumbent or duplicating people', () => {
  const f = fixture(); hearing(f); assert.equal(action(f, 'sign', copy(f.n.succession.terms)), true);
  const original = copy(f.n), to = { worldId: 'import-world', runId: 'import-run' };
  f.n = Government.rebind(f.n, binding, to); Object.assign(f.c, to);
  assert.equal(f.n.evidence.runId, to.runId); assert.equal(f.n.succession.governingEvidence.runId, to.runId);
  assert.equal(f.n.succession.terms.governingEvidence.runId, to.runId);
  assert.deepEqual(f.n.succession.ruler, original.succession.ruler);
  assert.equal(action(f, 'deliver', null, [{ id: 'parts', key: 'metalParts', quantity: 18, carriedBy: 'scientist' }]), true);
  assert.equal(original.evidence.runId, binding.runId);
  assert.equal(f.n.succession.phase, 'signed'); assert.equal(f.n.rule, null);
});
test('a retired private ruler is not a permanent reporter or mortality dependency for their former government', () => {
  const f = fixture(); transferred(f); action(f, 'operate'); advance(f, 3600);
  f.n.succession.ruler.status = 'dead';
  advance(f, Rule.INTERVAL); assert.equal(f.n.rule.status, 'established'); assert.equal(action(f, 'report'), true);
  assert.ok(f.n.rule.report.accomplishment);
});
test('leaving an unfinished hearing preserves spent work but cannot complete political attendance remotely', () => {
  const f = fixture(); action(f, 'request'); advance(f, 5); action(f, 'hear'); advance(f, 70);
  const work = f.g.receptionWorkSeconds, power = f.g.powerSeconds;
  f.c.atDesk = false; f.c.local = false; advance(f, 86400);
  assert.equal(f.n.succession.job, null); assert.equal(f.n.succession.handover, null); assert.equal(f.n.rule, null);
  assert.equal(f.g.receptionWorkSeconds, work); assert.equal(f.g.powerSeconds, power);
  assert.equal(f.g.receptionAssignment, null);
});
test('a dead original reception clerk or changed bargain source cannot publish a fresh governing account or substitute staff', () => {
  for (const mutate of [f => f.g.clerk.status = 'dead', f => f.g.foreignCivic.bargain.source.charterId = 'different-charter']) {
    const f = fixture(); transferred(f); action(f, 'operate'); advance(f, 3600); action(f, 'report'); const dated = copy(f.n.knowledge);
    mutate(f); advance(f, 60); assert.equal(action(f, 'report'), false); assert.deepEqual(f.n.knowledge, dated);
    assert.equal(f.g.clerk.id, 'original-clerk:b');
  }
});
