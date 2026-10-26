const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../powerworks-standards'), M = require('../powerworks-maintenance'), R = require('../city-rule');
const N = require('../network-operations'), Caps = require('../network-capabilities'), Comms = require('../civic-communications');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const { source: sourceMap } = require('./helpers/powerworks-standards-source');
const { addCommunications } = require('./helpers/civic-communication-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(condition = 80) {
  const map = sourceMap(), binding = { worldId: 'w', runId: 'r' };
  const people = R.ROLES.map(role => ({ id: `original:${role}`, institutionId: role, roles: [role], health: 100, status: 'alive' }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'terms' }));
  const succession = { source: { cityId: 'a', charterId: 'charter:a' }, officeId: 'office:a', handover: { id: 'handover:a', termsId: 'terms', bodyEpoch: 0 },
    agreements, control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'handover:a', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const farm = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', institutionId: 'publicWorksAndProvisioning', populationSourceId: 'population:a',
    cityPopulation: 3000, satelliteId: 'farm:a', satelliteName: 'Farm', satellitePopulation: 600, cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002',
    arableLandBand: 'productive', storageDays: 3, distanceKm: 2, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', populationSourceId: 'population:a', population: 3000,
    institutions: R.ROLES.map(role => ({ role, id: role })), worksId: 'works:a', powerId: 'original-power:a', reserveDays: 4, powerCondition: 80, farms: [farm] };
  const rule = R.createAggregate(source, succession, binding, 0, { id: 'original-ward', initialEnergy: 69120 }); rule.powerMaintenance.condition = condition;
  const networks = N.create(N.sources(map, 'original-standards'), binding, 0), s = S.create(S.sources(map, source, Definitions), rule, 0);
  rule.partsStandardsInitialized = true;
  S.register(s, networks);
  const wallet = { money: 1000 }, c = { alive: true, capable: true, local: true, authority: true, sourceCurrent: true, institutionsAvailable: true,
    otherBusy: false, violence: false, atCounter: true, reportersPresent: true, atWorkface: false, workAccessible: true, bodyEpoch: 0,
    cell: { x: 17, y: 8, z: 6 }, stamina: 100, skills: { analysis: 40, materialsScience: 40 }, calibrations: {}, channelAvailable: true, wallet,
    free: true, coverageVerified: true, counterpower: 'noEstablishedChallenge', defenseAvailable: true, pilotDefended: true, pilotSupplied: true, routes: { 'farm:a': true } };
  const stacks = Object.entries({ metalParts: 10, rubber: 5, assayReagent: 5, preparedManaCrystals: 2 }).map(([key, quantity]) => ({
    id: `original:${key}`, section: 'resources', key, quantity, knownQuantity: quantity, carriedBy: 'scientist' }));
  const tools = ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => {
    const id = `original:${key}`, stack = { id: `${id}:stack`, toolInstanceId: id, key, quantity: 1, carriedBy: 'scientist' };
    stacks.push(stack); c.calibrations[id] = 90; return { key, stack, tool: { id, current: 70, carriedBy: 'scientist' } };
  });
  const f = { map, s, rule, networks, wallet, c, stacks, tools, at: 0, succession, people, source };
  f.context = () => ({ ...c, partsPolicy: f.s?.policy || null, acceptParts: (i, p) => S.permits(f.s, f.rule, i, p) });
  f.h = { alive: () => c.alive, stacks: () => f.stacks, tools: () => f.tools, work: n => c.stamina -= n,
    partsInstalled: (stacks, inputs) => S.installed(f.s, stacks, inputs) };
  f.tick = n => { f.at += n; S.advance(f.s, f.rule, f.networks, f.context, f.at, f.h); };
  f.dock = () => { c.atCounter = false; c.atWorkface = true; c.cell = copy(M.WORKFACE); };
  f.counter = () => { c.atCounter = true; c.atWorkface = false; c.cell = { x: 17, y: 8, z: 6 }; };
  f.adopt = () => { f.counter(); const q = S.review(f.s, f.rule, c, 'adopt', f.s.sources[0].id, f.at);
    assert.ok(q); assert.equal(S.begin(f.s, f.rule, f.networks, c, 'adopt', '', '', stacks, tools, q, f.at), true); f.tick(60); f.dock(); };
  f.begin = (personal = false, provider = f.s.sources[0].id) => S.begin(f.s, f.rule, f.networks, c, personal ? 'selfTest' : 'test', provider,
    'original:metalParts', stacks, tools, null, f.at);
  return f;
}
test('actual original licensed standards function and plant support bounded distinct metrology, not a category, rating, new municipal title or adoption', () => {
  const f = fixture(); assert.equal(f.s.sources.length, 2); assert.equal(f.s.policy, null);
  const initial = copy(f.map); S.register(f.s, f.networks); S.register(f.s, f.networks); assert.deepEqual(f.map, initial);
  assert.notEqual(f.s.providers[0].reviewer.id, f.networks.accounts.find(a => a.id === f.s.sources[0].branchId).operator.id);
  for (const mutate of [m => m.strategicNonStateNetworkHistory.branchRows.forEach(b => b.organizationForm = 'registeredOffice'),
    m => m.strategicNonStateNetworkHistory.networkRows.forEach(n => n.organizationalContinuity = false),
    m => m.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].operationalAtPlayableYear = false,
    m => m.strategicPlayableSettlementState.cityRows[0].assetId = 'another-population']) {
    const map = copy(f.map); mutate(map); assert.deepEqual(S.sources(map, f.source, Definitions), []);
  }
  const a = Caps.assess(f.networks.capabilityAccounting, f.networks, 'measure'); assert.equal(a.strategicComplete, false);
  assert.equal(a.references.filter(r => r.family === 'certification').length, 2); assert.equal(f.networks.accounts.every(a => !a.mandate), true);
});
test('review reserves nothing, original local authority explicitly adopts after finite work, and old machinery and documents do not change', () => {
  const f = fixture(), before = copy([f.rule.powerMaintenance, f.networks, f.wallet]);
  const q = S.review(f.s, f.rule, f.c, 'adopt', f.s.sources[0].id, 0); assert.deepEqual([f.rule.powerMaintenance, f.networks, f.wallet], before);
  assert.equal(S.begin(f.s, f.rule, f.networks, f.c, 'adopt', '', '', f.stacks, f.tools, { ...q, text: 'different' }, 0), false);
  assert.equal(S.begin(f.s, f.rule, f.networks, f.c, 'adopt', '', '', f.stacks, f.tools, q, 0), true); f.tick(23);
  assert.equal(f.s.policy, null); f.s = S.normalize(f.s); f.tick(37); assert.ok(f.s.policy); assert.equal(f.rule.operatorWorkSeconds, 28740);
  assert.deepEqual([f.rule.powerMaintenance, f.networks, f.wallet], before);
});
test('guided testing consumes an actual lot sample, reagent, reference capacity, shared original workers and money once; no early certificate', () => {
  const f = fixture(); f.adopt(); const n = copy(f.networks), duty = f.rule.operatorWorkSeconds;
  assert.equal(f.begin(), true); f.tick(43); assert.equal(f.s.assessments.length, 0); assert.equal(f.stacks[0].quantity, 9);
  assert.equal(f.stacks[2].quantity, 4); assert.equal(f.wallet.money, 980); assert.equal(f.s.reference.sampleTests, 23);
  f.s = S.normalize(f.s); f.tick(257); const a = f.s.assessments[0]; assert.equal(a.measurements.suitable, true); assert.ok(a.endorsement);
  assert.equal(a.remaining, 9); assert.equal(f.rule.operatorWorkSeconds, duty - 300); assert.equal(f.s.reference.workSeconds, 14100);
  const owner = f.networks.accounts.find(a => a.id === f.s.sources[0].branchId), before = n.accounts.find(a => a.id === owner.id);
  assert.equal(owner.money, before.money + 20); assert.equal(owner.operator.workSeconds, before.operator.workSeconds - 300);
  assert.equal(f.s.providers[0].reviewer.workSeconds, 14100); assert.equal(S.permits(f.s, f.rule, f.stacks[0], f.s.policy), true);
  const dated = copy(f.s.report); f.tick(100); assert.deepEqual(f.s.report, dated);
});
test('measurement is not endorsement: poor fabrication, wrong composition and damage fail without a payment reroll; qualified local testing needs no provider', () => {
  for (const mutate of [i => i.craftsmanship = 30, i => i.materialComposition = { primary: 'wood' }, i => i.tags = ['cracked']]) {
    const f = fixture(); f.adopt(); mutate(f.stacks[0]); assert.equal(f.begin(), true); f.tick(300);
    assert.equal(f.s.assessments[0].measurements.suitable, false); assert.ok(f.s.assessments[0].endorsement);
    assert.equal(S.permits(f.s, f.rule, f.stacks[0], f.s.policy), false); assert.equal(f.rule.powerMaintenance.condition, 80);
  }
  const f = fixture(); f.adopt(); f.s.providers.forEach(p => p.accepting = false); const prior = copy(f.networks);
  assert.equal(f.begin(), false); assert.equal(f.begin(true), true); f.tick(600);
  assert.equal(f.s.assessments[0].endorsement, null); assert.equal(f.s.assessments[0].measurements.suitable, true); assert.deepEqual(f.networks, prior);
  assert.equal(f.wallet.money, 1000); assert.equal(f.rule.operatorWorkSeconds, 28740);
});
test('exact assessed lots cannot be substituted, split, mixed or damaged; real repair consumes only the measured remainder, without duplicating its acceptance', () => {
  const f = fixture(); f.adopt(); f.begin(true); f.tick(600);
  for (const mutate of [i => i.id = 'substitute', i => i.quantity--, i => i.quantity++, i => i.tags = ['cracked'], i => i.craftsmanship = 20]) {
    const i = copy(f.stacks[0]); mutate(i); assert.equal(S.permits(f.s, f.rule, i, f.s.policy), false);
  }
  const m = M.create(M.sources(f.map, f.source, Definitions), f.rule, f.at);
  const begin = kind => M.begin(m, f.rule, f.networks, f.context(), kind, '', f.stacks, f.tools, f.wallet, f.at);
  const tick = n => { f.at += n; M.advance(m, f.rule, f.networks, f.context, f.at, f.h); };
  assert.equal(begin('inspect'), true); tick(120); assert.equal(begin('investigate'), true); tick(1800);
  assert.equal(begin('repair'), true); tick(600); assert.equal(f.rule.powerMaintenance.condition, 100);
  assert.equal(f.stacks[0].quantity, 7); assert.equal(f.s.assessments[0].remaining, 7); assert.equal(S.permits(f.s, f.rule, f.stacks[0], f.s.policy), true);
  assert.equal(f.s.report.assessments[0].remaining, 9); // received record is not live inventory
});
test('policy withdrawal is prospective and cannot make unsuitable parts safe; a repair already accepted before adoption keeps its original scope', () => {
  const f = fixture(), m = M.create(M.sources(f.map, f.source, Definitions), f.rule, 0); f.dock();
  const begin = kind => M.begin(m, f.rule, f.networks, f.context(), kind, '', f.stacks, f.tools, f.wallet, f.at);
  const tick = n => { f.at += n; M.advance(m, f.rule, f.networks, f.context, f.at, f.h); };
  assert.equal(begin('inspect'), true); tick(120); assert.equal(begin('investigate'), true); tick(1800); assert.equal(begin('repair'), true);
  assert.equal(m.job.partsPolicy, null); f.s.policy = { id: 'later-policy', specificationId: 'later-specification' }; // simulated later policy, not repair authority
  tick(600); assert.equal(f.rule.powerMaintenance.condition, 100);
  const g = fixture(); g.adopt(); g.counter(); const q = S.review(g.s, g.rule, g.c, 'withdraw', '', g.at);
  assert.equal(S.begin(g.s, g.rule, g.networks, g.c, 'withdraw', '', '', g.stacks, g.tools, q, g.at), true); g.tick(60);
  assert.equal(g.s.policy, null); assert.equal(S.permits(g.s, g.rule, g.stacks[0], null), true);
  g.stacks[0].tags = ['cracked']; assert.equal(S.permits(g.s, g.rule, g.stacks[0], null), false);
});
test('interruption retains spent sample, fee and work, releases exact original locks, and cannot steal another worker or create a result', () => {
  for (const mutate of [f => f.c.cell.x++, f => f.c.bodyEpoch++, f => f.c.authority = false, f => f.c.skills.materialsScience = 39,
    f => f.s.reference.assignment = 'another-job', f => f.tools[0].tool.current = 1]) {
    const f = fixture(); f.adopt(); assert.equal(f.begin(true), true); f.tick(43); mutate(f); f.tick(1);
    assert.equal(f.s.job, null); assert.equal(f.s.assessments.length, 0); assert.equal(f.stacks[0].quantity, 9); assert.equal(f.stacks[2].quantity, 4);
    assert.equal(f.stacks[0].reservedTaskId, undefined); assert.equal(f.s.reference.workSeconds, 14357);
  }
  const f = fixture(); f.adopt(); const ch = S.channel(f.s, f.networks, f.s.sources[0].id); ch.a.operator.assignment = 'other';
  assert.equal(f.begin(), false); assert.equal(ch.a.operator.assignment, 'other');
  const g = fixture(); g.adopt(); g.begin(); g.tick(43);
  const p = g.s.providers.find(p => p.sourceId === g.s.job.providerId), a = S.channel(g.s, g.networks, g.s.job.providerId).a;
  g.networks.accounts = g.networks.accounts.filter(row => row.id !== a.id); g.tick(1);
  assert.equal(g.s.job, null); assert.equal(p.reviewer.assignment, null); assert.equal(p.bench.assignment, null);
  assert.equal(g.s.assessments.length, 0); assert.equal(g.wallet.money, 980);
});
test('original communication adoption scopes pause authenticated guidance without double sample spending; older scopes do not expand', () => {
  for (const enrolled of [false, true]) {
    const f = fixture(), city = { ...f.source }, map = addCommunications(f.map, city), binding = { worldId: 'w', runId: 'r' };
    f.networks = N.create(N.sources(map, 'original-standards'), binding, 0);
    const comm = Comms.create(Comms.sources(map, Definitions), binding, 0), port = comm.ports.find(p => comm.sources.some(r => r.id === p.id && r.kind === 'municipal'));
    assert.equal(Comms.begin(comm, f.rule, f.networks, f.c, port.id, [enrolled ? 'partsAssessment' : 'technicalGuidance'], false, 0), true);
    Comms.advance(comm, f.rule, f.networks, () => f.c, 60); f.at = 60; f.adopt();
    f.c.communicate = (data, at) => Comms.transfer(comm, f.networks, Comms.packet(comm, binding, data), at);
    f.begin(); f.tick(43); const old = copy([f.stacks, f.tools, f.networks, f.s.reference, f.wallet]); port.outage = true; f.tick(100);
    if (enrolled) { assert.equal(f.s.job.progress, 43); assert.deepEqual([f.stacks, f.tools, f.networks, f.s.reference, f.wallet], old); }
    port.outage = false; f.tick(257); assert.equal(f.s.assessments.length, 1); assert.equal(f.wallet.money, 980);
    assert.equal(comm.profiles[0].purposes.includes('partsAssessment'), enrolled);
  }
});
test('new-service refusal preserves earlier assessments and accepted work; actual local and alternative original providers remain separate', () => {
  const f = fixture(); f.adopt(); const ch = S.channel(f.s, f.networks, f.s.sources[0].id); f.begin(); f.tick(43);
  ch.p.accepting = false; ch.a.source.charter.scope = []; f.tick(257); assert.equal(f.s.assessments.length, 1);
  assert.equal(S.permits(f.s, f.rule, f.stacks[0], f.s.policy), true); assert.equal(f.begin(), false);
  assert.equal(f.begin(false, f.s.sources[1].id), true); f.tick(300); assert.equal(f.s.assessments.length, 2);
  assert.ok(f.s.assessments[0].supersededAt); const i = copy(f.stacks[0]); i.quantity++;
  assert.equal(S.permits(f.s, f.rule, i, f.s.policy), false); // no revival of the earlier larger-lot assessment
});
test('finite reference capacity, absent samples and inadequate qualifications cannot be replaced by endorsement or a fresh day', () => {
  const f = fixture(); f.adopt(); f.s.reference.sampleTests = 1; assert.equal(f.begin(true), true); f.tick(600);
  const old = copy(f.s.reference); f.tick(86400); assert.deepEqual(f.s.reference, old); assert.equal(f.begin(true), false);
  const g = fixture(); g.adopt(); g.c.skills.analysis = 39; assert.equal(g.begin(true), false);
  g.c.skills.analysis = 40; g.stacks[2].cityOwnerId = 'a'; assert.equal(g.begin(true), false);
  const bad = copy(g.s); bad.assessments = [{ id: 'bad', stackId: 'x', fingerprint: 'x', remaining: 3, at: 0 }];
  assert.equal(S.normalize(bad).invalid, true); assert.equal(S.permits(S.normalize(bad), g.rule, g.stacks[0], null), false);
});
test('lack of acceptance does not switch off machinery or erase buffers; only actual wear and resource consumption can compromise services', () => {
  const f = fixture(50.001); f.adopt(); f.s.providers.forEach(p => p.accepting = false); assert.equal(f.begin(), false);
  assert.equal(R.plantWorking(f.rule), true); const water = f.rule.waterLiters, energy = f.rule.energy;
  f.rule.plan = { at: f.at }; f.rule.receipts.push({ kind: 'priorOperation' });
  R.advance(f.rule, f.succession, f.people, () => f.c, f.at + 100); assert.equal(R.plantWorking(f.rule), false);
  assert.ok(f.rule.waterLiters > 0 && f.rule.waterLiters <= water); assert.ok(f.rule.energy > 0 && f.rule.energy < energy);
  R.advance(f.rule, f.succession, f.people, () => f.c, f.at + 2 * R.DAY); assert.equal(f.rule.waterLiters, 0); assert.equal(f.rule.status, 'contested');
  assert.equal(f.c.alive, true); assert.equal(f.rule.accomplishment, null);
});
test('saved/copy continuity conserves exact tools, reference, resource and policy identity; missing accounting cannot revoke requirements or replenish apparatus, and death freezes all work', () => {
  const a = fixture(), b = fixture(); a.adopt(); b.adopt(); a.begin(true); b.begin(true); a.tick(43); b.tick(43);
  a.s = S.normalize(a.s); assert.equal(S.savedTools(a.s, a.rule, a.stacks).length, 3); a.tick(557); for (let i = 0; i < 557; i++) b.tick(1);
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.stacks, b.stacks); assert.deepEqual(a.networks, b.networks);
  assert.equal(S.rebind(a.s, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'copy' }).policy.id, a.s.policy.id);
  assert.equal(S.rebind(a.s, { worldId: 'w', runId: 'new' }, { worldId: 'w', runId: 'other' }), null);
  const bad = copy(a.s); delete bad.reference; assert.equal(S.normalize(bad).invalid, true); assert.equal(S.permits(null, a.rule, a.stacks[0], null), false);
  const f = fixture(); f.adopt(); f.begin(); f.tick(43); f.c.alive = false; const frozen = copy([f.s, f.rule, f.networks, f.stacks, f.wallet]);
  f.tick(600); assert.deepEqual([f.s, f.rule, f.networks, f.stacks, f.wallet], frozen);
  assert.doesNotMatch(JSON.stringify(a.s.report), /workSeconds|14400|populationSourceId|original-undisclosed/);
});
