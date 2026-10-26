const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../powerworks-maintenance');
const R = require('../city-rule');
const N = require('../network-operations');
const C = require('../network-capabilities');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const { inputs } = require('./helpers/powerworks-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(options = {}) {
  const map = inputs(), binding = { worldId: 'w', runId: 'r' };
  const people = R.ROLES.map(role => ({ id: `original:${role}`, institutionId: role, roles: [role], health: 100, status: 'alive' }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'terms' }));
  const succession = { source: { cityId: 'a', charterId: 'charter:a' }, officeId: 'office:a',
    handover: { id: 'handover:a', termsId: 'terms', bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'handover:a', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const farm = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', institutionId: 'publicWorksAndProvisioning', populationSourceId: 'population:a',
    cityPopulation: 3000, satelliteId: 'farm:a', satelliteName: 'Farm', satellitePopulation: 600,
    cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive', storageDays: 3,
    distanceKm: 2, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', populationSourceId: 'population:a', population: 3000,
    institutions: R.ROLES.map(role => ({ role, id: role })), worksId: 'works:a', powerId: 'original-power:a', reserveDays: 4,
    powerCondition: options.condition ?? 80, farms: [farm] };
  const rule = R.createAggregate(source, succession, binding, 0, { id: 'original-detailed-ward', initialEnergy: 69120 });
  const networks = N.create(N.sources(map, 'original-powerworks'), binding, 0);
  const state = M.create(M.sources(map, source, Definitions), rule, 0);
  const wallet = { money: 1000 }, c = { alive: true, capable: true, local: true, free: true, authority: true, sourceCurrent: true,
    institutionsAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge', defenseAvailable: true, pilotDefended: true, pilotSupplied: true,
    atCounter: true, reportersPresent: true, atWorkface: true, workAccessible: true, otherBusy: false, violence: false,
    bodyEpoch: 0, cell: copy(M.WORKFACE), channelAvailable: true, wallet, stamina: 100,
    skills: { analysis: 40, materialsScience: 40 }, calibrations: {}, routes: { 'farm:a': true } };
  const stacks = Object.entries({ metalParts: 10, rubber: 5, assayReagent: 2, preparedManaCrystals: 2 })
    .map(([key, quantity]) => ({ id: `original:${key}`, key, section: 'resources', quantity, carriedBy: 'scientist' }));
  const tools = ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => {
    const id = `original-tool:${key}`, stack = { id: `${id}:stack`, key, toolInstanceId: id, quantity: 1, carriedBy: 'scientist' };
    stacks.push(stack); c.calibrations[id] = 90;
    return { key, stack, tool: { id, current: 70, carriedBy: 'scientist' } };
  });
  assert.ok(state); assert.equal(state.sources.length, 1);
  const f = { map, state, rule, networks, source, people, succession, wallet, c, stacks, tools, at: 0 };
  f.hooks = { alive: () => c.alive, stacks: () => f.stacks, tools: () => f.tools, work: n => { c.stamina -= n; } };
  f.tick = n => { for (let i = 0; i < n; i++) { f.at++; R.advance(f.rule, succession, people, () => c, f.at); M.advance(f.state, f.rule, f.networks, () => c, f.at, f.hooks); } };
  f.begin = (kind, remote = true) => M.begin(f.state, f.rule, f.networks, c, kind, remote ? f.state.sources[0].id : '', f.stacks, f.tools, wallet, f.at);
  return f;
}
test('only original operational local licensed controlled-field laboratories and an actual original plant supply bounded specialist/bench allocations', () => {
  const f = fixture(), before = copy(f.map); assert.deepEqual(f.map, before);
  for (const change of [m => m.strategicNonStateNetworkHistory.branchRows[0].organizationForm = 'registeredOffice',
    m => m.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'non-state-network.shared.common-measure',
    m => m.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'other',
    m => m.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].operationalAtPlayableYear = false,
    m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 63,
    m => m.strategicNonStateNetworkHistory.networkRows[0].organizationalContinuity = false]) {
    const map = copy(f.map); change(map); assert.deepEqual(M.sources(map, f.source, Definitions), []);
  }
  assert.notEqual(f.state.providers[0].technician.id, f.networks.accounts[0].operator.id);
  assert.equal(f.state.providers[0].technician.workSeconds, 14400);
});
test('actual powered operation wears the plant, offline wear stops, legacy migration has no backfill and missing initialized accounting never heals', () => {
  const f = fixture(); assert.equal(R.order(f.rule, f.succession, f.people, f.c, 0), true); f.tick(3600);
  const before = f.rule.powerMaintenance.condition; f.tick(21600);
  assert.ok(Math.abs(before - f.rule.powerMaintenance.condition - 1) < 1e-7);
  f.c.institutionsAvailable = false; const idle = copy(f.rule.powerMaintenance); f.tick(120); assert.deepEqual(f.rule.powerMaintenance, idle);
  const legacy = copy(f.rule); delete legacy.powerMaintenance; delete legacy.powerMaintenanceInitialized;
  const migrated = R.normalize(legacy); assert.equal(migrated.powerMaintenance.condition, 100); assert.equal(migrated.powerMaintenance.operatedSeconds, 0);
  assert.equal(migrated.powerMaintenance.initializedAt, f.rule.lastAt);
  delete migrated.powerMaintenance; const lost = R.normalize(migrated);
  assert.equal(lost.powerMaintenance.accountLost, true); assert.equal(R.plantWorking(lost), false);
});
test('guided inspection and repair share original desk, technician, bench, power and municipal labor, conserve money/parts, and retain dated evidence', () => {
  const f = fixture(), a = f.networks.accounts[0], start = copy([f.rule.operatorWorkSeconds, a.operator.workSeconds, a.terminal.powerSeconds]);
  assert.equal(f.begin('repair'), false); assert.equal(f.begin('inspect'), true); f.tick(120);
  assert.equal(f.wallet.money, 988); assert.equal(a.money, 252); assert.equal(f.state.inspection.condition, 80);
  const received = copy(f.state.report); f.tick(20); assert.deepEqual(f.state.report, received);
  assert.equal(f.begin('repair'), true); assert.equal(R.plantWorking(f.rule), false); f.tick(600);
  assert.equal(f.rule.powerMaintenance.condition, 100); assert.equal(f.rule.powerMaintenance.repaired, 20);
  assert.equal(f.wallet.money, 928); assert.equal(a.money + f.wallet.money, 1240);
  assert.deepEqual([f.rule.operatorWorkSeconds, a.operator.workSeconds, a.terminal.powerSeconds], start.map(n => n - 720));
  assert.equal(f.state.providers[0].technician.workSeconds, 14400 - 720);
  assert.equal(f.state.providers[0].bench.workSeconds, 14400 - 720);
  assert.equal(f.stacks.find(i => i.key === 'metalParts').quantity, 8); assert.equal(f.stacks.find(i => i.key === 'rubber').quantity, 4);
  assert.equal(f.state.history.filter(h => h.kind === 'repair').length, 1); assert.equal(R.plantWorking(f.rule), true);
});
test('lost message delivery pauses the same remote attendance and all spending; supported offline investigation and repair need no relay', () => {
  const f = fixture(); let connected = true;
  f.c.communicate = () => connected;
  assert.equal(f.begin('inspect'), true); f.tick(43); connected = false;
  const cost = copy([f.wallet, f.networks, f.state.providers, f.c.stamina, f.tools.map(t => t.tool.current)]);
  f.tick(120); assert.equal(f.state.job.progress, 43); assert.ok(f.state.job.hold);
  assert.deepEqual([f.wallet, f.networks, f.state.providers, f.c.stamina, f.tools.map(t => t.tool.current)], cost);
  connected = true; f.tick(77); assert.ok(f.state.inspection); assert.equal(f.wallet.money, 988);
  connected = false; assert.equal(f.begin('investigate', false), true); f.tick(1800); assert.ok(f.state.method);
  assert.equal(f.begin('repair', false), true); f.tick(600); assert.equal(f.rule.powerMaintenance.condition, 100);
});
test('partial work and exact claims survive normalization; interruptions retain earned fees/work but release only uninstalled original supplies', () => {
  const f = fixture(); f.begin('inspect'); f.tick(120); f.begin('repair'); f.tick(173);
  const id = f.state.job.id; f.state = M.normalize(f.state); f.rule = R.normalize(f.rule); f.networks = N.normalize(f.networks);
  const durability = f.tools.map(t => t.tool.current); assert.ok(durability.every(Number.isInteger));
  assert.equal(f.state.job.progress, 173); assert.equal(f.stacks[0].reservedTaskId, id); f.tick(427);
  assert.equal(f.state.job, null); assert.equal(f.rule.powerMaintenance.condition, 100); assert.equal(f.wallet.money, 928);
  assert.deepEqual(f.tools.map(t => t.tool.current), durability);
  for (const mutate of [x => x.c.cell.x++, x => x.c.bodyEpoch++, x => x.c.channelAvailable = false,
    x => x.state.providers[0].technician.health = 10, x => x.networks.accounts[0].terminal.powerSeconds = 0,
    x => x.c.authority = false, x => x.c.workAccessible = false]) {
    const x = fixture(); x.begin('inspect'); x.tick(120); x.begin('repair'); x.tick(10); mutate(x); x.tick(1);
    assert.equal(x.state.job, null); assert.equal(x.rule.powerMaintenance.condition, 80); assert.equal(x.wallet.money, 928);
    assert.equal(x.stacks[0].quantity, 10); assert.equal(x.stacks[0].reservedTaskId, undefined);
    assert.equal(x.rule.operatorServiceAssignment, null); assert.equal(x.rule.powerMaintenance.repairAssignment, undefined);
  }
});
test('retained learned methods allow original scientist repair after refusal, without provider money, desk work, new staff or free instruments', () => {
  const f = fixture(); f.begin('inspect'); f.tick(120); assert.equal(f.begin('learn'), true); f.tick(1200);
  assert.ok(f.state.method); const provider = copy(f.state.providers[0]), account = copy(f.networks.accounts[0]);
  f.state.providers[0].accepting = false;
  assert.equal(f.begin('repair'), false); assert.equal(f.rule.powerMaintenance.condition, 80);
  assert.equal(f.begin('repair', false), true); const condition = f.tools[0].tool.current; f.tick(600);
  assert.equal(f.rule.powerMaintenance.condition, 100); assert.equal(f.wallet.money, 868);
  assert.ok(f.tools[0].tool.current < condition); assert.deepEqual(f.networks.accounts[0], account);
  assert.equal(f.state.providers[0].technician.workSeconds, provider.technician.workSeconds);
  assert.ok(f.state.method); assert.equal(f.rule.powerMaintenance.repaired, 20);
});
test('independent investigation is measured, skilled, instrumented, material-backed local research, not a signature or a new credential', () => {
  const f = fixture(); assert.equal(f.begin('investigate', false), false);
  assert.equal(f.begin('inspect', false), true); f.tick(120);
  for (const mutate of [x => x.c.skills.analysis = 39, x => x.c.calibrations[x.tools[0].tool.id] = 64,
    x => x.tools[1].tool.carriedBy = '', x => x.stacks.find(i => i.key === 'assayReagent').cityOwnerId = 'a']) {
    const x = fixture(); x.begin('inspect', false); x.tick(120); mutate(x); assert.equal(x.begin('investigate', false), false);
  }
  assert.equal(f.begin('investigate', false), true); f.tick(1800); assert.ok(f.state.method);
  assert.equal(f.state.method.sourceId, 'personal-reproducible-investigation'); assert.equal(f.wallet.money, 1000);
  assert.equal(f.stacks.find(i => i.key === 'assayReagent').quantity, 1); assert.equal(f.stacks.find(i => i.key === 'preparedManaCrystals').quantity, 1);
  assert.equal(f.begin('repair', false), true); f.tick(600); assert.equal(f.rule.powerMaintenance.condition, 100);
});
test('failure disables the actual plant, not stored energy, fuel or sovereignty; buffers fail only through consumption and repair restores no energy', () => {
  const f = fixture({ condition: 50.0001 }); f.rule.plan = { at: 0 }; f.rule.receipts.push({ kind: 'priorOperation' });
  const energy = f.rule.energy; f.tick(5); assert.equal(R.plantWorking(f.rule), false); assert.ok(f.rule.energy < energy && f.rule.energy > 0);
  assert.notEqual(f.rule.status, 'contested'); const pumped = f.rule.pumpedLiters;
  f.rule.powerFuel.stock = f.rule.powerFuel.received = 1; f.rule.powerFuel.enabled = true; f.rule.powerFuel.handoverId = f.rule.handoverId;
  f.tick(120); assert.equal(f.rule.pumpedLiters, pumped); assert.equal(f.rule.powerFuel.stock, 1); assert.equal(f.rule.powerFuel.processed, 0);
  const unsupported = copy(f.rule), later = f.at + 2 * R.DAY;
  R.advance(unsupported, f.succession, f.people, () => f.c, later);
  assert.equal(unsupported.waterLiters, 0); assert.equal(unsupported.status, 'contested');
  assert.ok(unsupported.energy > 0); assert.ok(f.c.alive);
  assert.equal(R.recharge(f.rule, f.succession, f.people, f.c, [{ key: 'arcaneFeedstock', carriedBy: 'scientist', quantity: 1 }], f.at), false);
  f.begin('inspect'); f.tick(120); assert.equal(f.begin('repair'), true); const remaining = f.rule.energy; f.tick(600);
  assert.equal(R.plantWorking(f.rule), true); assert.ok(f.rule.energy < remaining); assert.equal(f.rule.chargedEnergy, 0);
  assert.ok(f.c.alive); assert.equal(f.rule.accomplishment, null);
});
test('restricted original archives can refuse transfer without breaking machinery; independent investigation and another original local provider remain real alternatives', () => {
  const f = fixture(), map = copy(f.map);
  map.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'non-state-network.grim.sealed-archive';
  map.strategicNonStateNetworkHistory.branchRows[1].currentCityId = 'a';
  f.state = M.create(M.sources(map, f.source, Definitions), f.rule, 0);
  f.networks = N.create(N.sources(map, 'original-powerworks'), { worldId: 'w', runId: 'r' }, 0);
  assert.equal(f.state.sources.length, 2); assert.equal(f.state.sources[0].methodPolicy, 'restrictedArchive');
  assert.equal(f.begin('inspect'), true); f.tick(120); assert.equal(f.begin('learn'), false);
  assert.equal(f.rule.powerMaintenance.condition, 80); assert.equal(f.begin('investigate', false), true); f.tick(1800);
  assert.ok(f.state.method); f.state.providers[0].technician.health = 0;
  assert.equal(M.begin(f.state, f.rule, f.networks, f.c, 'repair', f.state.sources[1].id, f.stacks, f.tools, f.wallet, f.at), true);
  f.tick(600); assert.equal(f.rule.powerMaintenance.condition, 100);
  assert.equal(f.state.providers[0].technician.workSeconds, 14280); assert.equal(f.state.providers[1].technician.workSeconds, 13800);
});
test('missing equipment, changed duty/charters and concurrent original work cannot supply a second worker or certification', () => {
  for (const mutate of [f => f.state.providers[0].bench.condition = 49, f => f.state.providers[0].technician.workSeconds = 1,
    f => f.networks.accounts[0].operator.assignment = 'other', f => f.rule.operatorServiceAssignment = 'other',
    f => f.networks.accounts[0].source.charter.scope = [], f => f.c.stamina = 0, f => f.wallet.money = 0, f => f.networks.accounts = []]) {
    const f = fixture(); mutate(f); const ok = f.begin('inspect'); if (ok) f.tick(1);
    assert.equal(f.state.inspection, null); assert.equal(f.rule.powerMaintenance.condition, 80);
  }
  const f = fixture(); f.begin('inspect'); const a = f.networks.accounts[0]; a.operator.lastOperatingWorkAt = f.rule.operatorWorkedUntil = 1;
  f.tick(1); assert.equal(f.state.job.progress, 0); assert.equal(f.wallet.money, 1000); f.tick(120); assert.ok(f.state.inspection);
  M.register(f.state, f.networks); M.register(f.state, f.networks);
  const assessment = C.assess(f.networks.capabilityAccounting, f.networks, 'original-network');
  assert.equal(assessment.references.filter(r => r.assetId === f.state.providers[0].technician.id).length, 1);
  assert.equal(assessment.strategicComplete, false); assert.equal(f.networks.accounts[0].mandate, null);
});
test('continued bindings conserve partial work, fresh runs reject it, corrupt allocation stays unknown, and death freezes all costs/work', () => {
  const f = fixture(); f.begin('inspect'); f.tick(43);
  const continued = M.rebind(f.state, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'copy' });
  assert.equal(continued.job.progress, 43); assert.equal(M.target(continued, f.rule), false);
  assert.equal(M.rebind(f.state, { worldId: 'other', runId: 'r' }, { worldId: 'w', runId: 'new' }), null);
  const bad = copy(f.state); bad.providers = []; assert.equal(M.normalize(bad).invalid, true);
  f.c.alive = false; const before = copy([f.state, f.rule, f.networks, f.wallet]); f.tick(120);
  assert.deepEqual([f.state, f.rule, f.networks, f.wallet], before);
});
test('coarse and fine city wear/depletion agree, including a stopped plant boundary and saved processing', () => {
  const a = fixture({ condition: 50.1 }), b = fixture({ condition: 50.1 });
  for (const f of [a, b]) { f.rule.plan = { at: 0 }; f.rule.receipts.push({ kind: 'priorOperation' }); }
  R.advance(a.rule, a.succession, a.people, () => a.c, 3000); for (let at = 1; at <= 3000; at++) R.advance(b.rule, b.succession, b.people, () => b.c, at);
  for (const key of ['energy', 'spentEnergy', 'waterLiters', 'pumpedLiters']) assert.ok(Math.abs(a.rule[key] - b.rule[key]) < 1e-5, key);
  assert.ok(Math.abs(a.rule.powerMaintenance.condition - b.rule.powerMaintenance.condition) < 1e-7);
  assert.ok(R.normalize(a.rule)); assert.equal(R.plantWorking(a.rule), false); assert.equal(R.plantWorking(b.rule), false);
});
