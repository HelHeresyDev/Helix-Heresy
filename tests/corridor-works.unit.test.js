const { test } = require('node:test');
const assert = require('node:assert/strict');
const Works = require('../corridor-works'), Joint = require('../joint-transit'), Field = require('../field-station'), March = require('../intercity-march');
const { fixture } = require('./helpers/corridor-works-source');
const copy = x => JSON.parse(JSON.stringify(x)), binding = { worldId: 'world', runId: 'run' };
function site() {
  const f = fixture(), p = (x, y) => ({ x, y, z: 25 });
  const station = Joint.create(f.source.joint, binding, { roomId: 'original-ground', entry: p(10, 10), post: p(14, 9),
    homes: [p(13, 8), p(16, 8)], bins: [p(12, 9), p(17, 9)] }, 0);
  const w = Works.create(f.source, binding, station, 0); w.inspectedAt = 10;
  assert.ok(Works.authorize(w, station, 0, 70));
  return { ...f, station, w, ledger: { ...binding, sites: [w], notices: [], preparedSources: [] }, floors: {} };
}
function build(f, index, split = false) {
  const p = f.w.site.layout.parts[index], cell = { ...p.cell, y: 12 };
  const tools = Object.keys(p.tools).map((key, n) => ({ key, tool: { id: `tool:${n}`, current: 20, carriedBy: 'scientist' },
    stack: { id: `tool-stack:${n}`, toolInstanceId: `tool:${n}`, key, quantity: 1, carriedBy: 'scientist' } }));
  const items = Object.entries(p.costs).map(([key, quantity]) => ({ id: key, key, quantity, cell, roomId: f.w.site.roomId, section: 'resources' }));
  const c = { local: true, constructionGrant: 'jointCorridorRepair', wilderness: false, alive: true, capable: true, free: true,
    siteId: f.w.id, worldId: binding.worldId, roomId: f.w.site.roomId, cell, bodyEpoch: 0, geometryOkay: true, reachable: true,
    materialsLocal: true, workCell: cell, atHead: true, stamina: 100, staminaCost: 3, seconds: 900 };
  const inputs = items.map(i => ({ stackId: i.id, key: i.key, quantity: i.quantity, cell }));
  const plan = Field.plan(f.w, p.id, c, tools, inputs); assert.ok(plan);
  const task = `actual-work:${index}`, job = Field.begin(plan, task, 70, tools); items.forEach(i => { i.reservedTaskId = task; });
  f.w.startedAt ??= 70; Field.advance(f.w, job, c, tools, items, 71);
  if (split) {
    Field.advance(f.w, job, c, tools, items, 300); assert.ok(job.progress > 0);
    const progress = job.progress; c.cell = { ...cell, x: 99 }; Field.advance(f.w, job, c, tools, items, 600);
    assert.equal(job.progress, progress); c.cell = cell; Field.advance(f.w, job, c, tools, items, 601);
    Object.assign(f.w, copy(f.w)); Field.advance(f.w, job, c, tools, items, 1600);
  } else Field.advance(f.w, job, c, tools, items, 1000);
  assert.ok(Field.ready(f.w, job, c, tools, items));
  assert.ok(Field.finish(f.w, job, c, tools, items, 1600 + index, `floor:${index}`));
  assert.equal(tools[0].tool.current, 17); assert.equal(tools[1].tool.current, 18);
  f.floors[p.id] = 100; return { job, tools, items };
}
const project = (f, at = 2000, alive = true) => Works.project(f.ledger, f.network, p => f.floors[p.id] || 0, () => true, at, alive);
test('canonical corridor IDs bind both joint receiving and real causal road damage to prefixed runtime journey IDs', () => {
  const f = fixture(); assert.equal(f.source.joint.corridorId, f.route.id); assert.equal(f.source.joint.canonicalCorridorId, f.route.corridorId);
  assert.equal(f.source.causeId, 'original-crisis'); assert.equal(f.source.joint.positionKm, 1);
  assert.deepEqual(f.source.joint.sponsors.map(s => s.upkeepPercent), [35, 65]);
});
test('healthy roads, a fabricated cause, unsupported public works and a missing sponsor do not generate a repair project', () => {
  for (const kind of ['healthy', 'cause', 'institution', 'sponsor']) {
    const f = fixture();
    if (kind === 'healthy') f.map.strategicPlayableSettlementState.routeRows[0].physicalState = 'operational';
    if (kind === 'cause') f.map.strategicCrisisHistory.eventRows[0].stateDelta.infrastructureDeltas = [];
    if (kind === 'institution') f.map.cityGovernments.governments[0].institutions[0].capacityBand = 'fragile';
    if (kind === 'sponsor') f.map.cityExpansionHistory.strongholdRows[0].sponsorCityIds = ['a', 'c'];
    assert.equal(Works.sourceFromWorld(f.map, f.route, () => 1), null, kind);
  }
});
test('other original ruined strongholds remain an independent closed link after pavement repair', () => {
  const f = fixture(); f.map.strategicPlayableSettlementState.strongholdRows.push({ strongholdId: 'other-fort', currentPopulation: 0, physicalCondition: 'ruined' });
  f.map.strategicPlayableSettlementState.routeRows[0].requiredStrongholdIds.push('other-fort');
  const source = Works.sourceFromWorld(f.map, f.route, () => 1);
  assert.equal(source.residualContinuity, 'closed'); assert.deepEqual(source.remainingFailures, ['other-fort']);
});
test('released work directions allow a measured near-side approach to a closed road, never a learned completed passenger journey', () => {
  const f = fixture(), notice = Works.notice(f.source, 'a', 10), m = March.create(binding);
  assert.equal(Works.notice(f.source, 'c', 10), null); assert.equal(notice.plan.distanceKm, 1); assert.equal(notice.plan.fullDistanceKm, 2);
  assert.deepEqual(March.plans(m, f.network, 'a'), []);
  const [plan] = March.plans(m, f.network, 'a', [notice]); assert.equal(plan.worksiteId, f.source.id);
  const origin = { roomId: 'municipal', cell: { x: 10, y: 10, z: 6 } }, prior = { walk: null, approach: null };
  assert.equal(March.begin(m, plan, 'reconnoitre', origin, prior, 20, 0), null);
  assert.ok(March.begin(m, plan, 'reconnoitre', origin, prior, 20, 0, [notice])); assert.equal(m.routes.length, 0);
  assert.equal(m.operation.plan.distanceKm, 1); assert.ok(March.normalize(copy(m)));
  const w = copy(m.operation.walk); w.trip.status = 'stopped'; w.trip.positionKm = 1;
  assert.ok(March.stage(m, w, { id: 'original-fort-patch', routeId: `intercity-march:${f.route.id}`, positionKm: 1 }, 100));
  w.trip.direction = -1; w.trip.positionKm = 0; w.trip.status = 'arrived'; w.trip.walkedKm = 2;
  assert.ok(March.finish(m, w, 200)); assert.equal(m.history[0].worksiteId, f.source.id); assert.equal(m.routes.length, 0);
});
test('scoped local authorization spends both original officers duty and preserves divided administration and all rights', () => {
  const f = site(); assert.deepEqual(f.station.members.map(a => a.workSeconds), [Joint.DUTY - 60, Joint.DUTY - 60]);
  assert.equal(f.w.source.joint.administration, 'dividedSponsorFacilities'); assert.equal(f.w.grant.authority, 'existingJointCompact');
  f.station.members[1].willing = false; assert.equal(Works.authorize(f.w, f.station, 1, 100), false); assert.equal(f.w.grant.bodyEpoch, 0);
});
test('inspection, plans, one completed course and source labels cannot open a road; all actual surviving courses are required', () => {
  const f = site(); assert.equal(project(f), false); assert.equal(f.route.continuity, 'closed');
  const materials = build(f, 0, true); project(f); assert.equal(f.route.continuity, 'closed');
  assert.equal(materials.job.inputs.reduce((n, i) => n + i.quantity, 0), 5);
  build(f, 1); project(f); assert.equal(f.route.supportCapable, false);
  build(f, 2); assert.equal(project(f), true); assert.equal(f.route.continuity, 'operational'); assert.equal(f.route.supportCapable, true);
});
test('actual repair joins only its viable two-city component and leaves disconnected cities, worlds and politics unchanged', () => {
  const f = site(), world = copy(f.map); [0, 1, 2].forEach(i => build(f, i)); project(f);
  assert.deepEqual(f.ledger.currentSupportComponents.map(c => c.cityIds), [['a', 'b'], ['c'], ['d']]);
  assert.ok(f.ledger.currentSupportComponents.every(c => c.politicalUnity === false)); assert.equal(f.network.routes[1].continuity, 'closed');
  assert.equal(f.network.destinations.find(d => d.id === 'city:b').reachable, true); assert.deepEqual(f.map, world);
});
test('a physical re-breach splits the run component again without deleting earlier work, people, supplies or dated reports', () => {
  const f = site(); [0, 1, 2].forEach(i => build(f, i)); project(f); const history = copy(f.w.history), people = copy(f.station.members);
  f.w.observations = { at: 2000, roadbedRestored: true }; f.floors[f.w.site.layout.parts[1].id] = 49;
  assert.equal(project(f, 2100), true); assert.equal(f.route.supportCapable, false);
  assert.deepEqual(f.ledger.currentSupportComponents.map(c => c.cityIds), [['a'], ['b'], ['c'], ['d']]);
  assert.deepEqual(f.station.members, people); assert.deepEqual(f.w.observations, { at: 2000, roadbedRestored: true });
  assert.ok(f.w.history.length > history.length); assert.equal(Object.keys(f.w.site.parts).length, 3);
});
test('original-source loss or another still-ruined support link prevents a repaired road becoming a usable supported corridor', () => {
  const f = site(); [0, 1, 2].forEach(i => build(f, i)); f.w.source.residualContinuity = 'closed'; project(f); assert.equal(f.route.continuity, 'closed');
  f.w.source.residualContinuity = 'operational'; Works.project(f.ledger, f.network, p => f.floors[p.id], () => false, 2000); assert.equal(f.route.continuity, 'closed');
});
test('death freezes projection and continued-run rebinding preserves only that copied physical history', () => {
  const f = site(); build(f, 0); project(f); const before = copy(f.ledger); f.floors = {};
  assert.equal(project(f, 2200, false), false); assert.deepEqual(f.ledger, before);
  const rebound = Works.rebind(f.ledger, binding, { worldId: 'copy-world', runId: 'copy-run' });
  assert.equal(rebound.sites[0].site.worldId, 'copy-world'); assert.equal(f.ledger.sites[0].site.worldId, 'world');
  assert.equal(Works.rebind(f.ledger, { worldId: 'wrong', runId: 'run' }, binding), null);
  assert.equal(Works.normalize({ ...binding, sites: [], notices: [], preparedSources: [] }).sites.length, 0);
});
test('an independently changed run-owned corridor condition is not overwritten by an old successful roadbed repair', () => {
  const f = site(); [0, 1, 2].forEach(i => build(f, i)); project(f);
  f.route.continuity = 'closed'; f.route.supportCapable = false; project(f, 2200);
  assert.equal(f.route.continuity, 'closed'); assert.equal(f.route.supportCapable, false); assert.ok(Works.intact(f.w, p => f.floors[p.id]));
});
