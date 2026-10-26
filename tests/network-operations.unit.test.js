const { test } = require('node:test');
const assert = require('node:assert/strict');
const N = require('../network-operations');
const P = require('../chapter-protection');
const { world, source } = require('./helpers/network-operating-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const bind = { worldId: 'world', runId: 'run' }, s = N.create(source(), bind, 0);
  const c = { ...bind, alive: true, capable: true, cityId: 'b', local: true, near: true, busy: false, otherBusy: false,
    channel: true, bodyEpoch: 0, cell: { x: 10, y: 6, z: 21 }, gate: { id: 'gate:b', powerSeconds: 3600, receptionWorkSeconds: 3600 },
    clerk: { id: 'original-clerk:b', status: 'alive', health: 100 } };
  const f = { s, c, at: 0 };
  f.tick = n => { f.at += n; return N.advance(f.s, () => f.c, f.at); };
  f.send = () => N.begin(f.s, f.c, 'original-network', 'branch:b', f.at);
  f.op = id => N.host(f.s, `branch:${id}`);
  return f;
}
function replies(f = fixture()) { assert.equal(f.send(), true); f.tick(181); return f; }
test('source elaboration is fixed, finite, original-population bound and independent of threats/branding/ownership', () => {
  const m = world(), src = source(); assert.deepEqual(N.sources(m, 'original:5'), src);
  assert.equal(src.branches.find(b => b.id === 'branch:a').charter.mode, 'autonomousAccession');
  assert.equal(src.branches.find(b => b.id === 'branch:c').charter.mode, 'delegatedManagement');
  assert.equal(src.networks[0].headBranchId, 'branch:b'); assert.equal(src.concealed.length, 2);
  m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 15;
  const small = N.sources(m, 'original:5').branches[0]; assert.equal(small.capital, 0); assert.equal(small.operatorSeconds, 0);
  m.strategicPlayableSettlementState.cityRows[1].services.communications = 'failed';
  assert.equal(N.sources(m, 'original:5').branches[1].terminalSeconds, 0);
  assert.equal(src.branches.reduce((v, b) => v + b.capital, 0), 720);
  assert.ok(src.branches.every(b => !b.trucks && !b.army));
});
test('consolidated original lineages share one physical working-capital/operator allocation', () => {
  const m = world(); m.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'branch:b';
  const src = N.sources(m, 'original:5'), s = N.create(src, { worldId: 'w', runId: 'r' }, 0);
  assert.equal(s.accounts.reduce((n, a) => n + a.initialMoney, 0), 480);
  assert.equal(N.host(s, 'branch:a'), N.host(s, 'branch:b'));
  assert.equal(s.accounts[0].operator.workSeconds, 0);
  m.strategicPlayableSettlementState.cityRows[1].physicalCondition = 'ruined';
  const ruined = N.create(N.sources(m, 'original:5'), { worldId: 'w', runId: 'r' }, 0);
  assert.equal(N.host(ruined, 'branch:a').money, 0); // An alias cannot resurrect its ruined physical host.
  m.strategicNonStateNetworkHistory.branchRows[1].consolidatedIntoBranchId = 'branch:c';
  const chain = N.create(N.sources(m, 'original:5'), { worldId: 'w', runId: 'r' }, 0);
  assert.equal(N.host(chain, 'branch:a'), N.host(chain, 'branch:c'));
  assert.equal(chain.accounts.reduce((n, a) => n + a.initialMoney, 0), 240);
});
test('signing requires original available receiving staff, local attendance, finite channel and correct run', () => {
  for (const change of [f => f.c.near = false, f => f.c.local = false, f => f.c.channel = false, f => f.c.alive = false,
    f => f.c.runId = 'other', f => f.c.clerk.assignment = 'other-duty', f => f.c.gate.receptionAssignment = 'other-report',
    f => f.op('b').operator.assignment = 'previous-work', f => f.op('b').terminal.powerSeconds = 0,
    f => f.c.gate.powerSeconds = 60, f => f.c.busy = true]) {
    const f = fixture(); change(f); assert.equal(f.send(), false); assert.equal(f.s.requests.length, 0);
  }
  const f = fixture(); assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:a', 0), false);
});
test('partial signing uses actual work/power, persists, and dispatches no remote request early', () => {
  const f = fixture(); f.send(); f.tick(20); assert.equal(f.s.requests.length, 0); assert.equal(f.s.job.progress, 20);
  assert.equal(f.c.gate.powerSeconds, 3580); assert.equal(f.op('b').operator.workSeconds, 14380);
  f.s = N.normalize(f.s); f.tick(40); assert.equal(f.s.requests.length, 1);
  assert.equal(f.op('a').operator.workSeconds, 14400); assert.equal(f.op('a').mandate, null);
  assert.equal(f.c.gate.receptionAssignment, null); assert.equal(f.c.clerk.assignment, null);
});
test('movement, body change, broken channel or shared work interrupts without free catch-up or lock theft', () => {
  for (const change of [f => f.c.cell.x++, f => f.c.bodyEpoch++, f => f.c.channel = false, f => f.c.otherBusy = true,
    f => f.c.clerk.assignment = 'new-other-duty']) {
    const f = fixture(); f.send(); f.tick(20); change(f); f.tick(100);
    assert.equal(f.s.job, null); assert.equal(f.s.requests.length, 0); assert.equal(f.op('b').operator.workSeconds, 14380);
    assert.notEqual(f.c.gate.receptionAssignment, 'network-contact:1');
    if (f.c.clerk.assignment) assert.equal(f.c.clerk.assignment, 'new-other-duty');
  }
});
test('internet delivers independent replies: controller signs only delegated assets; autonomous holdout remains independent', () => {
  const f = replies(), r = f.s.requests[0];
  assert.ok(r.delegation); assert.equal(r.delegation.principalBranchId, 'branch:b');
  assert.equal(f.op('b').reply.accepts, true); assert.equal(f.op('c').reply.accepts, true);
  assert.equal(f.op('a').reply.accepts, false); assert.equal(f.op('a').mandate, null);
  assert.equal(f.op('c').mandate.delegationId, r.delegation.id);
  assert.equal(f.op('a').operator.workSeconds, 14340); assert.equal(f.op('a').terminal.powerSeconds, 14340);
  assert.equal(N.publicView(f.s).length, 0); // Reply owner data is not player knowledge.
  assert.equal(f.send(), false); const refusal = copy(f.op('a').reply); f.s = N.normalize(f.s); f.tick(500);
  assert.deepEqual(f.op('a').reply, refusal); assert.equal(f.op('a').operator.workSeconds, 14340);
});
test('no working principal means no blanket delegated orders; autonomous office can still answer', () => {
  const f = fixture(); f.s.source.networks[0].headBranchId = null; f.send(); f.tick(500);
  assert.equal(f.op('a').reply.accepts, false); assert.equal(f.op('b').mandate, null); assert.equal(f.op('c').mandate, null);
  assert.equal(f.op('c').operator.workSeconds, 14400);
});
test('unavailable remote channel pauses only that office, preserves unfinished work, and permits subsequent genuine reply', () => {
  const f = fixture(); f.send(); f.tick(80); assert.equal(f.op('a').pending.progress, 20);
  f.op('a').terminal.powerSeconds = 0; f.tick(150); assert.equal(f.op('a').reply, null); assert.ok(f.op('c').mandate);
  f.s = N.normalize(f.s); f.op('a').terminal.powerSeconds = 40; f.tick(40);
  assert.equal(f.op('a').reply.accepts, false); assert.equal(f.op('a').operator.workSeconds, 14340);
});
test('dated attended receipt discloses only actual replying public scopes; hidden source IDs and live resources never leak', () => {
  const f = replies(); assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:b', f.at, 'receive'), true);
  f.tick(15); assert.deepEqual(N.publicView(f.s), []); f.s = N.normalize(f.s); f.tick(15);
  const view = N.publicView(f.s); assert.equal(view.length, 1); assert.equal(view[0].replies.length, 3);
  assert.match(view[0].limits, /not certified/);
  assert.doesNotMatch(JSON.stringify(view), /original-undisclosed|original-opaque|money|capital|powerSeconds|populationSource|workSeconds|latitude/);
  f.tick(999); assert.deepEqual(N.publicView(f.s), view);
});
test('receipt needs only its actual thirty seconds; remote work cannot precede controller authorization', () => {
  const f = fixture(); f.send(); f.tick(119.75); assert.equal(f.op('b').mandate, null);
  f.tick(.25); assert.equal(f.op('b').mandate.at, 120); assert.equal(f.op('c').operator.workSeconds, 14400);
  f.tick(60); assert.equal(f.op('c').mandate.at, 180);
  f.op('b').operator.workSeconds = f.op('b').terminal.powerSeconds = 30;
  assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:b', f.at, 'receive'), true);
  f.tick(29.75); f.tick(.5); assert.equal(f.op('b').operator.workSeconds, 0);
  assert.equal(N.publicView(f.s)[0].at, 210);
});
test('binding mandates change actual financing without cancelling prior obligations or humanitarian protection', () => {
  const f = fixture(), op = id => ({ id, cityId: 'target', payerCityId: 'c', routeId: 'real-route', purpose: 'armedReceivingContest' });
  assert.equal(N.sponsor(f.s, 'branch:c', 40, op('earlier'), 0), true); assert.equal(f.op('c').money, 200);
  replies(f); assert.equal(N.sponsor(f.s, 'branch:c', 40, op('new'), f.at), false); assert.equal(f.op('c').money, 200);
  assert.equal(N.permitted(f.s, 'branch:c', 'armedReceivingContest', 0), true);
  assert.equal(N.permitted(f.s, 'branch:c', 'humanitarianProtection'), true);
  assert.equal(N.permitted(f.s, 'branch:c', 'civilianSupplies'), true);
  assert.match(N.TERMS, /Existing obligations/);
  const action = { ...op('holdout'), payerCityId: 'a' };
  assert.equal(N.sponsor(f.s, 'branch:a', 40, action, f.at), true); assert.equal(f.op('a').money, 200);
  assert.equal(N.sponsor(f.s, 'branch:a', 40, action, f.at), false); assert.equal(f.op('a').money, 200);
  assert.equal(N.sponsor(f.s, 'branch:a', 201, { ...action, id: 'unfunded' }, f.at), false);
  assert.equal(N.sponsor(f.s, 'branch:a', 40, { ...action, id: 'wrong-city', payerCityId: 'c' }, f.at), false);
  assert.equal(N.sponsor(f.s, 'branch:a', 40, { ...action, id: 'no-route', routeId: null }, f.at), false);
  const power = f.op('a').terminal.powerSeconds; assert.equal(power, 14339);
  f.op('a').terminal.powerSeconds = 0;
  assert.equal(N.sponsor(f.s, 'branch:a', 40, { ...action, id: 'offline' }, f.at), false);
  assert.equal(f.op('a').money, 200); assert.equal(N.candidates(f.s, 'a').length, 0);
});
test('existing chapter employee, worn kit, earned fees and obligations attach once, without duplicating money or bodies', () => {
  const f = fixture(), b = source().branches[1];
  const backing = { cityId: 'b', populationSourceId: b.populationSourceId, networkId: b.networkId, branchId: b.id,
    allocationId: `${b.id}:protective-duty-professional`, label: b.label, people: 1, capacityBand: 'functional', restrictions: [], roles: ['escortContracting'] };
  const actor = { id: 'client', mapCell: { x: 1, y: 1, z: 1 } };
  const p = P.create(backing, f.s, { roomId: 'room', roomIds: ['room'], home: actor.mapCell, refuge: actor.mapCell }, actor, { id: 'clerk' }, 'seed', 0);
  p.kit.batonCondition = 42; p.actor.status = 'dead'; p.actor.workSeconds = 31; p.finances.engagement = 80; p.finances.earnedWages = 10;
  assert.equal(N.attach(f.s, p), true); assert.equal(N.attach(f.s, p), true);
  const a = f.op('b'); assert.equal(a.money, 330); assert.equal(a.allocations.length, 1);
  assert.equal(a.allocations[0].status, 'dead'); assert.equal(a.allocations[0].workSeconds, 31); assert.equal(a.allocations[0].equipment.batonCondition, 42);
  p.finances.earnedWages += 5; N.attach(f.s, p); assert.equal(a.money, 335);
  p.runId = 'foreign-run'; assert.equal(N.attach(f.s, p), false);
});
test('missing original accounts/roster rows become gaps, not refreshed money or deleted capacities', () => {
  const f = fixture(), expected = copy(f.s.source);
  f.s.accounts = f.s.accounts.filter(a => a.id !== 'branch:a'); f.s.source.branches.shift(); f.s.source.concealed.pop();
  N.sync(f.s, expected); assert.equal(f.s.source.branches.length, 3); assert.equal(f.s.source.concealed.length, 2);
  assert.equal(f.s.accounts.find(a => a.id === 'branch:a').money, 0); assert.equal(N.host(f.s, 'branch:a'), null);
  assert.equal(N.fact(f.s, 'original-network', false, f.at).state, 'unverified');
  const damaged = copy(f.s); damaged.accounts[0].money = -1;
  assert.equal(N.normalize(damaged).invalid, true);
  assert.equal(N.normalize(N.normalize(damaged)).invalid, true); // Never becomes uninitialized.
});
test('coarse, fine and saved continuation consume identical original resources without backdated replies', () => {
  const coarse = fixture(), fine = fixture(), saved = fixture(); coarse.send(); fine.send(); saved.send();
  coarse.tick(200); for (let n = 0; n < 200; n++) fine.tick(1);
  saved.tick(90); saved.s = N.normalize(saved.s); saved.tick(110);
  assert.deepEqual(coarse.s, fine.s); assert.deepEqual(coarse.s, saved.s);
});
test('binding/import isolation and final death freeze spending, contacts and remote replies', () => {
  const f = fixture(); f.send(); f.tick(20); const original = copy(f.s);
  f.c.alive = false; f.tick(500); assert.deepEqual(f.s, original);
  f.c.alive = true; f.c.runId = 'foreign'; f.tick(500); assert.deepEqual(f.s, original);
  assert.equal(N.rebind(f.s, { worldId: 'world', runId: 'other' }, { worldId: 'world', runId: 'new' }), null);
  const imported = N.rebind(f.s, f.s, { worldId: 'world', runId: 'new' }); assert.equal(imported.runId, 'new');
  assert.equal(N.create(source(), { worldId: 'world', runId: 'independent' }, 0).accounts[0].money, 240);
});
test('refusal, silence, an ordinary armed professional and local mandates never certify worldwide coverage', () => {
  const f = replies(); assert.equal(N.fact(f.s, 'original-network', false, f.at).state, 'unverified');
  assert.equal(N.fact(f.s, 'original-network', true, f.at).state, 'notQualifying');
  assert.equal(N.fact(f.s, 'not-original', false, f.at), null);
});
test('separate supply scope preserves old signatures, independent replies and legacy reply accounting without duplicate work', () => {
  const f = replies(); assert.equal(N.permitted(f.s, 'branch:b', N.SUPPLY_PURPOSE), true);
  const old = copy(f.op('b').mandate), work = f.op('b').operator.workSeconds;
  // A saved receiving-only account from before multi-scope support.
  f.s.accounts.forEach(a => { delete a.responses; delete a.mandates; });
  assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:b', f.at, 'send', N.SUPPLY_PURPOSE), true);
  f.tick(181);
  assert.deepEqual(f.op('b').mandate, old); assert.equal(f.op('b').operator.workSeconds, work - 120);
  assert.equal(N.permitted(f.s, 'branch:b', N.SUPPLY_PURPOSE), false);
  assert.equal(N.permitted(f.s, 'branch:a', N.SUPPLY_PURPOSE), true);
  assert.equal(f.op('b').responses.length, 2); assert.equal(f.op('c').responses.length, 2);
  const spent = f.op('b').operator.workSeconds; f.tick(500); assert.equal(f.op('b').operator.workSeconds, spent);
  assert.match(f.op('b').mandates[N.SUPPLY_PURPOSE].terms, /physically return/);
});
test('an attended receipt and remote reply cannot spend the same operator second on the completion boundary', () => {
  const f = fixture(); f.send(); f.tick(60);
  const work = f.op('b').operator.workSeconds;
  assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:b', f.at, 'receive'), true);
  f.tick(30);
  assert.equal(f.s.job, null); assert.equal(f.op('b').operator.workSeconds, work - 30);
  assert.equal(f.op('b').pending, undefined);
  f.tick(1); assert.equal(f.op('b').pending.progress, 1);
});
test('a remote reply waits if the same original operator has just completed another network consumer', () => {
  const f = fixture(); f.send(); f.tick(60); const work = f.op('b').operator.workSeconds;
  f.op('b').operator.lastOperatingWorkAt = 61;
  f.tick(1); assert.equal(f.op('b').pending, undefined); assert.equal(f.op('b').operator.workSeconds, work);
  f.tick(1); assert.equal(f.op('b').pending.progress, 1); assert.equal(f.op('b').operator.workSeconds, work - 1);
});
