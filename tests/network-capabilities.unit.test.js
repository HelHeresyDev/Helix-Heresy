const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../network-capabilities');
const N = require('../network-operations');
const S = require('../durable-supremacy');
const { world, source } = require('./helpers/network-operating-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const s = N.create(source(), { worldId: 'w', runId: 'r' }, 0);
  const c = { worldId: 'w', runId: 'r', alive: true, capable: true, cityId: 'b', local: true, near: true,
    busy: false, otherBusy: false, channel: true, bodyEpoch: 0, cell: { x: 10, y: 6, z: 21 },
    gate: { id: 'gate:b', powerSeconds: 3600, receptionWorkSeconds: 3600 }, clerk: { id: 'original-clerk', status: 'alive', health: 100 } };
  const f = { s, c, at: 0 };
  f.tick = n => { f.at += n; N.advance(f.s, () => f.c, f.at); };
  f.begin = kind => N.begin(f.s, f.c, 'original-network', 'branch:b', f.at, kind || 'send', C.PURPOSE);
  return f;
}
test('finite original source inventory retains every lineage, covert cell, affiliate and seven capability families without world edits', () => {
  const m = world(), original = copy(m), src = N.sources(m, 'seed'), s = N.create(src, { worldId: 'w', runId: 'r' }, 0);
  assert.deepEqual(m, original); assert.equal(src.capabilityBaseline.rows.length, 6);
  const a = C.assess(s.capabilityAccounting, s, 'original-network');
  assert.equal(a.catalogComplete, true); assert.equal(a.strategicComplete, false);
  assert.equal(a.sources.length, 6); assert.equal(a.families.length, 7);
  assert.ok(a.sources.every(r => r.families.length === 7));
  assert.ok(a.sources.some(r => r.id === 'affiliate:original-opaque-affiliate'));
  assert.ok(a.sources.some(r => r.id === 'covertCell:original-undisclosed-cell'));
  assert.ok(a.sources.filter(r => ['affiliate', 'covertCell', 'network'].includes(r.kind)).every(r => r.families.every(f => f.state === 'unallocated')));
});
test('advertised ratings, dormant/defunct sources, absent public premises and low capacity never erase a possible capability', () => {
  const m = world(); m.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'negligible';
  m.strategicNonStateNetworkHistory.networkRows[0].lifecycleStatus = 'defunct';
  m.strategicNonStateNetworkHistory.branchRows.forEach(b => b.publicPhysicalPresence = false);
  m.strategicNonStateNetworkHistory.covertRows[0].status = 'dormant';
  m.publicNonStateNetworkDirectory = { networkRecords: [{ id: 'original-network', capabilityCodes: '4444444' }] };
  const src = N.sources(m, 'seed'), s = N.create(src, { worldId: 'w', runId: 'r' }, 0);
  assert.equal(s.capabilityAccounting.originals.length, 6);
  assert.equal(s.capabilityAccounting.originals[0].advertisedCapabilityCodes, '4444444');
  assert.equal(C.assess(s.capabilityAccounting, s, 'original-network').state, 'unverified');
  assert.equal(N.fact(s, 'original-network', false, 0).state, 'unverified');
});
test('shared hosts and existing protective/field allocations are references, not duplicate wealth, people, kit or municipal assets', () => {
  const m = world(); m.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'branch:b';
  const s = N.create(N.sources(m, 'seed'), { worldId: 'w', runId: 'r' }, 0), a = N.host(s, 'branch:b');
  a.allocations.push({ id: 'original-protector', kind: 'originalProtectiveProfessional', contractId: 'actual-commitment', equipment: { vestCondition: 12 } },
    { id: 'original-field-team', kind: 'originalFieldTeam', actorIds: ['employee:1', 'employee:2'], assignment: 'actual-deployment' });
  const before = copy(s), view = C.assess(s.capabilityAccounting, s, 'original-network');
  assert.deepEqual(s, before);
  assert.equal(view.references.filter(r => r.scope === 'smallOfficeWorkingCapitalOnly').length, 2);
  assert.equal(view.references.filter(r => r.assetId === 'employee:1').length, 1);
  assert.equal(view.branchAccounts.find(b => b.sourceId === 'branch:branch:a').accountId, 'branch:b');
  assert.equal(view.branchAccounts.find(b => b.sourceId === 'branch:branch:b').accountId, 'branch:b');
  assert.ok(view.commitments.some(c => c.id === 'actual-commitment' && c.allocationId === 'original-protector'));
  assert.ok(view.commitments.some(c => c.id === 'actual-deployment' && c.allocationId === 'original-field-team'));
  assert.ok(view.commitments.some(c => c.kind === 'operatingCharter' && c.scope.includes('ownNewContracts')));
  assert.doesNotMatch(JSON.stringify(view.references), /municipal|truck|treasury/);
  assert.equal(a.money, 240); assert.equal(view.strategicComplete, false);
});
test('deleted records are restored as named gaps; changed parent identities and corrupt accounting cannot certify or refill anything', () => {
  const f = fixture(), ledger = f.s.capabilityAccounting;
  ledger.records.pop(); N.sync(f.s); assert.equal(ledger.records.at(-1).lost, true);
  assert.equal(C.assess(ledger, f.s, 'original-network').catalogComplete, false);
  const base = copy(f.s.source.capabilityBaseline); base.rows[1].networkId = 'different-parent'; C.sync(ledger, base);
  assert.equal(ledger.conflict, true); assert.equal(N.host(f.s, 'branch:b').money, 240);
  const corrupt = copy(ledger); corrupt.records.push(copy(corrupt.records[0])); assert.equal(C.normalize(corrupt).invalid, true);
  assert.equal(C.normalize(C.normalize(corrupt)).invalid, true);
  const absent = fixture(); absent.s.capabilityAccounting = null; N.sync(absent.s);
  assert.ok(absent.s.capabilityAccounting.records.every(r => r.lost));
});
test('older saves acquire source accounting without resetting spent money, kit or work, and continued copies keep binding isolation', () => {
  const f = fixture(); delete f.s.capabilityAccounting; delete f.s.capabilityAccountingInitialized; delete f.s.source.capabilityBaseline;
  const a = N.host(f.s, 'branch:b'); a.money = 31; a.operator.workSeconds = 27;
  N.sync(f.s, source()); assert.equal(f.s.capabilityAccounting.records.length, 6); assert.equal(a.money, 31); assert.equal(a.operator.workSeconds, 27);
  const resumed = N.rebind(f.s, f.s, { worldId: 'copy-world', runId: 'copy-run' });
  assert.equal(C.bound(resumed.capabilityAccounting, resumed), true); assert.equal(N.host(resumed, 'branch:b').money, 31);
  assert.equal(C.assess(resumed.capabilityAccounting, f.s, 'original-network').catalogComplete, false);
  assert.equal(N.create(source(), { worldId: 'w', runId: 'independent' }, 0).accounts[0].money, 240);
});
test('capability requests spend the same actual attendance, operator work and power, persist partial work and acquire no knowledge remotely', () => {
  const f = fixture(), money = N.host(f.s, 'branch:b').money;
  assert.equal(f.begin(), true); f.tick(20); assert.equal(f.s.job.progress, 20); assert.equal(f.s.requests.length, 0);
  f.s = N.normalize(f.s); f.tick(100); assert.equal(f.s.requests[0].replies.length, 3);
  assert.equal(N.host(f.s, 'branch:b').operator.workSeconds, 14280); assert.deepEqual(N.publicView(f.s), []);
  assert.equal(N.host(f.s, 'branch:b').money, money); assert.equal(f.s.requests[0].delegation, undefined);
  assert.ok(f.s.accounts.every(a => !a.mandate && !a.mandates));
  assert.equal(f.begin('receive'), true); f.tick(30);
  assert.equal(f.s.reports[0].purpose, C.PURPOSE); assert.equal(f.s.reports[0].replies[0].statement.scope, 'ownOfficeOnly');
  assert.ok(f.s.reports[0].replies.every(r => r.statement.limits.includes('Unexamined')));
});
test('autonomous information sharing is not accession; no head office, withheld accounts or an old mandate cannot widen command rights', () => {
  const f = fixture(); N.host(f.s, 'branch:a').source.disclosurePolicy = 'withholdInternalAccounts';
  N.host(f.s, 'branch:b').terminal.powerSeconds = 0;
  // Reach a different original office; the actual principal remains offline.
  f.c.cityId = 'c'; assert.equal(N.begin(f.s, f.c, 'original-network', 'branch:c', 0, 'send', C.PURPOSE), true);
  f.tick(120); const c = N.host(f.s, 'branch:c'), a = N.host(f.s, 'branch:a');
  assert.equal(c.reply.statement.disclosure, 'limited'); assert.equal(a.reply.statement.disclosure, 'withheld');
  assert.equal(N.permitted(f.s, 'branch:c', 'municipalSupplyInterdiction'), true);
  assert.equal(c.mandate, null); assert.equal(c.mandates, undefined);
  const old = { id: 'old-specific', at: 0, terms: 'Only the old scope' }; c.mandate = old;
  f.tick(300); assert.deepEqual(c.mandate, old); assert.equal(c.reply.statement.disclosure, 'limited');
});
test('public statements are unchanged by concealed sources, financial balances or deployed identities and cannot refresh themselves', () => {
  const f = fixture(), a = N.host(f.s, 'branch:b');
  const before = C.statement(f.s, a); a.money = 0;
  f.s.source.concealed.push({ id: 'SECRET-extra-cell', networkId: 'original-network', status: 'active' });
  f.s.capabilityAccounting.originals[0].original.actualCapacityBand = 'exceptional';
  assert.deepEqual(C.statement(f.s, a), before);
  f.begin(); f.tick(120); f.begin('receive'); f.tick(30); const publicBefore = N.publicView(f.s);
  a.money = 2000; f.tick(300); assert.deepEqual(N.publicView(f.s), publicBefore);
  assert.doesNotMatch(JSON.stringify(publicBefore), /original-undisclosed|original-opaque|SECRET|14400|240|workSeconds|money|actualCapacity|populationSource|latitude|longitude/);
  assert.equal(f.begin('receive'), true); f.tick(30);
  assert.equal(f.s.reports.at(-1).observedAt, publicBefore[0].observedAt);
  assert.ok(f.s.reports.at(-1).at > publicBefore[0].at);
});
test('movement, body changes, outages and conflicting assignments interrupt without free work or false knowledge', () => {
  for (const change of [f => f.c.cell.x++, f => f.c.bodyEpoch++, f => f.c.channel = false, f => f.c.otherBusy = true]) {
    const f = fixture(); f.begin(); f.tick(20); change(f); f.tick(200);
    assert.equal(f.s.job, null); assert.equal(f.s.requests.length, 0); assert.equal(f.s.reports.length, 0);
    assert.equal(N.host(f.s, 'branch:b').operator.workSeconds, 14380);
  }
});
test('coarse/fine/save continuity and final death preserve the complete private book and finite shared resources', () => {
  const a = fixture(), b = fixture(), c = fixture(); a.begin(); b.begin(); c.begin();
  a.tick(150); for (let n = 0; n < 150; n++) b.tick(1);
  c.tick(30); c.s = N.normalize(c.s); c.tick(120);
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.s, c.s);
  const original = copy(a.s); a.c.alive = false; a.tick(900); assert.deepEqual(a.s, original);
  const fact = N.fact(b.s, 'original-network', false, b.at);
  assert.equal(S.factState({ id: fact.targetId, kind: fact.kind, sourceId: fact.sourceId }, fact, b.s, b.at), 'unverified');
});
