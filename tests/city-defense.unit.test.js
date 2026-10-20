const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../city-defense');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'a', charterId: 'charter:a', institutionId: 'defense:a', populationSourceId: 'population:a',
    population: 3000, condition: 80, installationId: 'original-approach:a', baselineEnergy: 69120 };
  const a = { id: 'original-defender', institutionId: 'defense:a', exceptionalCapabilities: ['city-scale ward defense'],
    status: 'alive', health: 100, fatigue: 0, workSeconds: 3600, stamina: 100, wardMana: 17, assignment: null,
    roomId: 'supportedSurveyGround', mapCell: { x: 19, y: 9, z: 6 } };
  const agreement = { personId: a.id, institutionId: a.institutionId, roles: [D.ROLE], termsId: 'original-terms' };
  const succession = { officeId: 'office:a', source: { cityId: 'a', charterId: 'charter:a' },
    handover: { id: 'original-handover', bodyEpoch: 0, termsId: 'original-terms' }, agreements: [agreement],
    control: { sourceReceiptId: 'original-handover', recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: [copy(agreement)] } };
  const s = D.create(source, succession, a, { id: 'office:a', cityId: 'a' }, { worldId: 'w', runId: 'r' }, 0, 100);
  const c = { alive: true, capable: true, local: true, free: true, atStation: true, atCounter: false, defenderPresent: true,
    sourceCurrent: true, bodyEpoch: 0, installationPresent: true, condition: 80, postAccessible: true, defenderWitness: true };
  const stacks = [{ id: 'feed', key: 'arcaneFeedstock', quantity: 2, carriedBy: 'scientist' },
    { id: 'parts', key: 'metalParts', quantity: 4, carriedBy: 'scientist' }];
  const h = { stacks: () => stacks, move: (a, goal) => { for (const k of ['x', 'y']) if (a.mapCell[k] !== goal[k]) { a.mapCell[k] += Math.sign(goal[k] - a.mapCell[k]); return true; } return false; },
    repair: condition => { c.condition = condition; return true; } };
  return { source, a, succession, s, c, stacks, h, at: 0 };
}
const tick = (f, n) => { f.at += n; D.advance(f.s, f.succession, f.a, () => f.c, f.at, f.h); };
const inspect = f => assert.equal(D.inspect(f.s, f.succession, f.a, f.c, f.at), true);
const order = f => { inspect(f); assert.equal(D.order(f.s, f.succession, f.a, f.c, copy(f.s.quote), f.at), true); };
const hit = (f, changes = {}) => D.absorb(f.s, f.a, f.c, { cell: D.COVERAGE[0], hostile: true, lineOfEffect: true, amount: 25, damageTypes: ['physical'], ...changes }, f.at);
test('source is original generated fortifications, not a new wall, stronghold or invented defender', () => {
  const map = { strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', assetId: 'pop:a', currentPopulation: 100, physicalJurisdictionExists: true,
    physicalCondition: 'intact', services: { fortifications: 'functional' } }] }, cityGovernments: { governments: [{ cityId: 'a', charter: { id: 'charter:a' },
      roleAssignments: { militaryDefenseCommand: 'defense:a' }, institutions: [{ id: 'defense:a' }] }] } };
  const before = copy(map), source = D.sourceFromWorld(map, 'a'); assert.equal(source.condition, 80); assert.deepEqual(map, before);
  assert.equal(D.sourceFromWorld(map, 'stronghold'), null);
  for (const change of [m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 0,
    m => m.strategicPlayableSettlementState.cityRows[0].physicalJurisdictionExists = false,
    m => m.strategicPlayableSettlementState.cityRows[0].physicalCondition = 'ruined',
    m => m.strategicPlayableSettlementState.cityRows[0].services.fortifications = 'failed', m => m.cityGovernments.governments[0].institutions = []]) {
    const bad = copy(map); change(bad); assert.equal(D.sourceFromWorld(bad, 'a'), null);
  }
});
test('creation binds original source, living installation and voluntary handover without refilling personal reserves', () => {
  const f = fixture(); assert.equal(f.s.baselineCondition, 80); assert.equal(f.s.energy, 69120); assert.equal(f.a.wardMana, 17);
  const args = [f.source, f.succession, f.a, { id: 'office:a', cityId: 'a' }, { worldId: 'w', runId: 'r' }, 0];
  assert.equal(D.create(...args, 0), null);
  const relationships = f.succession.control.commandRelationships; f.succession.control.commandRelationships = [];
  assert.equal(D.create(...args, 100), null); f.succession.control.commandRelationships = relationships;
  f.succession.handover = null; assert.equal(D.create(...args, 100), null);
});
test('orders need exact inspection, original authority, available person and real accessible post', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.sourceCurrent = false, f => f.c.local = false,
    f => f.c.defenderPresent = false, f => f.c.violence = true, f => f.c.postAccessible = false, f => f.c.obligation = true,
    f => f.c.suppressed = true, f => f.a.assignment = 'other-duty', f => f.a.workSeconds = 30,
    f => f.succession.agreements[0].suspendedRoles = [D.ROLE], f => f.succession.control.commandRelationships = []]) {
    const f = fixture(); inspect(f); change(f); assert.equal(D.order(f.s, f.succession, f.a, f.c, copy(f.s.quote), 0), false);
    assert.equal(f.a.wardMana, 17);
  }
  const f = fixture(); inspect(f); assert.equal(D.order(f.s, f.succession, f.a, f.c, { ...f.s.quote, seconds: 1 }, 0), false);
  assert.equal(D.order(f.s, f.succession, f.a, f.c, f.s.quote, 3600), false);
});
test('watch uses actual outward steps, finite original duty and physical return before releasing the same actor', () => {
  const f = fixture(); order(f); const home = copy(f.a.mapCell); assert.deepEqual(f.a.mapCell, home);
  tick(f, 3); assert.equal(f.s.duty.phase, 'outward'); tick(f, 1); assert.equal(f.s.duty.phase, 'watch');
  assert.deepEqual(f.a.mapCell, D.POST); tick(f, D.SHIFT); assert.equal(f.s.duty.phase, 'returning');
  tick(f, 5); assert.equal(f.s.duty, null); assert.equal(f.a.assignment, null); assert.deepEqual(f.a.mapCell, home);
  assert.equal(f.s.receipts[0].seconds, D.SHIFT); assert.equal(f.a.wardMana, 17); assert.ok(f.a.workSeconds < 1800);
});
test('blocked outward or return movement never teleports, resets the body or grants another duty', () => {
  const f = fixture(); order(f); const home = copy(f.a.mapCell); f.h.move = () => false; tick(f, 10);
  assert.deepEqual(f.a.mapCell, home); assert.equal(f.s.duty.phase, 'outward');
  D.release(f.s, f.a, f.at); tick(f, 1); assert.equal(f.s.duty, null); assert.equal(f.s.receipts.length, 1);
});
test('one installation reserve pays standby and interception; personal mana and counter power are not batteries', () => {
  const f = fixture(); tick(f, 10); assert.equal(f.s.energy, f.s.initialEnergy - 10);
  assert.deepEqual(hit(f), { damage: 20, absorbed: 5 }); assert.equal(f.a.wardMana, 17);
  order(f); tick(f, 5); assert.equal(f.s.duty.phase, 'watch'); assert.deepEqual(hit(f), { damage: 5, absorbed: 20 });
  assert.equal(f.s.energy + f.s.standbySpent + f.s.combatSpent, f.s.initialEnergy + f.s.charged);
});
test('unsupported damage, absent geometry, friendly attacks, hidden lines and uncovered cells spend no reserve', () => {
  for (const change of [{ hostile: false }, { lineOfEffect: false }, { cell: { x: 24, y: 12, z: 6 } }, { damageTypes: ['arcane'] }, { damageTypes: ['physical', 'toxic'] }]) {
    const f = fixture(); assert.equal(hit(f, change).absorbed, 0); assert.equal(f.s.energy, f.s.initialEnergy);
  }
  const f = fixture(); f.c.condition = 0; assert.equal(hit(f).absorbed, 0); tick(f, 100); assert.equal(f.s.energy, f.s.initialEnergy);
});
test('fatigue, exhaustion, suppression, obligations and withdrawn command cause original safe return, not replacement or healing', () => {
  for (const change of [f => f.c.suppressed = true, f => f.c.obligation = true, f => f.c.sourceCurrent = false, f => f.s.energy = 0]) {
    const f = fixture(); order(f); tick(f, 5); change(f); tick(f, 1); assert.equal(f.s.duty.phase, 'returning');
    tick(f, 5); assert.equal(f.s.duty, null); assert.equal(f.a.wardMana, 17);
  }
  for (const change of [f => f.a.status = 'dead', f => f.c.incapacitated = true, f => f.a.workSeconds = 0]) {
    const f = fixture(); order(f); tick(f, 5); change(f); const cell = copy(f.a.mapCell); tick(f, 60);
    assert.deepEqual(f.a.mapCell, cell); assert.ok(f.s.duty); assert.equal(f.s.receipts.length, 0);
  }
});
test('real charging holds exact owned cargo, persists partial work, consumes once and does not recharge the defender', () => {
  const f = fixture(); f.s.energy = 30000; inspect(f);
  assert.equal(D.beginService(f.s, f.succession, f.a, f.c, 'charge', f.stacks, 0), true);
  tick(f, 30); assert.equal(f.s.job.progress, 30); assert.equal(f.stacks[0].quantity, 2);
  f.s = D.normalize(f.s); tick(f, 30); assert.equal(f.s.job, null); assert.equal(f.stacks[0].quantity, 1);
  assert.equal(f.s.energy, 30000 - 60 + 21600); assert.equal(f.s.charged, 21600); assert.equal(f.a.wardMana, 17);
  tick(f, 60); assert.equal(f.stacks[0].quantity, 1); assert.equal(f.s.receipts.length, 1);
});
test('foreign, city-owned, contaminated, changed or missing physical cargo cannot become a free installation recharge', () => {
  for (const change of [i => i.carriedBy = 'other', i => i.cityOwnerId = 'a', i => i.civicCustody = {}, i => i.tags = ['contaminated']]) {
    const f = fixture(); f.s.energy = 30000; inspect(f); change(f.stacks[0]); assert.equal(D.beginService(f.s, f.succession, f.a, f.c, 'charge', f.stacks, 0), false);
  }
  const f = fixture(); f.s.energy = 30000; inspect(f); assert.equal(D.beginService(f.s, f.succession, f.a, f.c, 'charge', f.stacks, 0), true); tick(f, 10);
  f.stacks[0].quantity++; tick(f, 1); assert.equal(f.s.job, null); assert.equal(f.s.charged, 0); assert.equal(f.stacks[0].reservedTaskId, '');
});
test('physical repair spends actual parts and attended work; missing original structure cannot be reconstructed by inspection', () => {
  const f = fixture(); inspect(f); assert.equal(D.beginService(f.s, f.succession, f.a, f.c, 'repair', f.stacks, 0), true);
  tick(f, 60); f.s = D.normalize(f.s); tick(f, 60); assert.equal(f.c.condition, 100); assert.equal(f.stacks[1].quantity, 2);
  const g = fixture(); inspect(g); D.beginService(g.s, g.succession, g.a, g.c, 'repair', g.stacks, 0);
  g.c.installationPresent = false; tick(g, 120); assert.equal(g.stacks[1].quantity, 4); assert.equal(g.s.job, null);
});
test('movement, new damage, violence and changed body interrupt uncompleted service without a resource refund or remote work', () => {
  for (const change of [f => f.c.atStation = false, f => f.c.condition--, f => f.c.bodyEpoch++, f => f.c.violence = true]) {
    const f = fixture(); inspect(f); D.beginService(f.s, f.succession, f.a, f.c, 'repair', f.stacks, 0); tick(f, 30);
    const work = f.a.workSeconds; change(f); tick(f, 120); assert.equal(f.s.job, null); assert.equal(f.stacks[1].quantity, 4); assert.equal(f.a.workSeconds, work);
  }
});
test('refusal requires actual witnessing, persists, blocks new watches but not essential physical remediation', () => {
  const f = fixture(); f.c.defenderWitness = false; assert.equal(D.aggression(f.s, f.a, f.c, 0), false);
  f.c.defenderWitness = true; D.aggression(f.s, f.a, f.c, 0); f.s = D.normalize(f.s); inspect(f);
  assert.equal(D.order(f.s, f.succession, f.a, f.c, f.s.quote, 0), false);
  assert.equal(D.beginService(f.s, f.succession, f.a, f.c, 'repair', f.stacks, 0), true); tick(f, 120); assert.ok(f.s.refusal);
  assert.equal(f.succession.handover.id, 'original-handover');
});
test('reports retain dates; counter reception cannot publish remote reserves or unwitnessed contacts', () => {
  const f = fixture(); inspect(f); const report = copy(f.s.report); tick(f, 100); hit(f); assert.deepEqual(f.s.report, report);
  f.c.atStation = false; f.c.atCounter = true; assert.equal(D.receive(f.s, f.succession, f.a, f.c, f.at), true);
  assert.equal(f.s.report.energy, null); assert.equal(f.s.report.condition, null); assert.deepEqual(f.s.report.contacts, []);
  f.c.local = false; assert.equal(D.receive(f.s, f.succession, f.a, f.c, 1000), false);
});
test('irreversible scientist death freezes work and energy; independent runs inherit no station duty or reports', () => {
  const f = fixture(); order(f); tick(f, 5); f.c.alive = false; const old = copy(f.s); tick(f, 86400); assert.deepEqual(f.s, old);
  const g = fixture(); assert.equal(g.s.duty, null); assert.equal(g.s.report, null); assert.deepEqual(g.s.receipts, []);
});
test('coarse advancement and a mid-watch save retain identical dates, original person and finite energy', () => {
  const a = fixture(), b = fixture(); order(a); order(b); tick(a, 2000);
  for (let n = 0; n < 2000; n++) { tick(b, 1); if (n === 300) b.s = D.normalize(b.s); }
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.a, b.a);
});
