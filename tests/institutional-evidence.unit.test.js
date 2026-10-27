const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../institutional-evidence'), S = require('../durable-supremacy');
const N = require('../network-operations'), C = require('../network-capabilities'), O = require('../institutional-outcomes');
const I = require('../network-inventories'), Owners = require('../network-owner-reconciliation');
const G = require('../terrestrial-forces'), M = require('../powerworks-maintenance'), CS = require('../city-services'), R = require('../city-rule');
const X = require('../exceptional-reach');
const { world, Definitions, binding } = require('./helpers/institutional-inventory-source');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(category = 'military') {
  const map = world([Definitions.find(d => d.category === category)]);
  map.strategicPlayableSettlementState.cityRows[0].assetId = 'population:city:0';
  map.strategicCapabilityHistory = { historicalHorizonYear: 1000, milestoneRows: Object.entries(X.FUNCTIONS).map(([capabilityId, kind]) => ({
    capabilityId, standardizationYear: 100, institution: { id: `institute:${capabilityId}` }, infrastructureRows: [{
      id: `commissioned:${capabilityId}`, capabilityId, function: kind, cityId: 'city:0', cellId: 'cell:0',
      operatingInstitutionId: `institute:${capabilityId}`, commissionedYear: 200, operationalAtPlayableYear: true }] })) };
  map.strategicCapabilityHistory.milestoneRows.push({ infrastructureRows: [{ id: 'power:city:0', cityId: 'city:0', function: 'powerWorks', operationalAtPlayableYear: true }] });
  const n = N.create(N.sources(map, 'evidence-originals'), binding, 0, { originalInventory: true });
  const run = { clock: 0, networkOperations: n }, supremacy = S.create(binding, { complete: true,
    targets: [{ id: 'counterpower:original:0', sourceId: 'original:0', kind: 'counterpower', createdAt: 0 }] }, 0);
  const f = { map, n, run, supremacy };
  f.assess = at => {
    run.clock = n.lastAt = at; Owners.reconcile(n.capabilityAccounting, n, run, binding); I.observe(n, run, binding);
    const frame = O.frame(n, run, at); O.advance(n, run, frame, at);
    return C.assess(n.capabilityAccounting, n, 'original:0', frame, at);
  };
  return f;
}
function post(f) {
  const state = G.create(binding, 0), b = G.sources(f.n, 'city:0')[0]; f.run.terrestrialForces = state;
  const c = { alive: true, capable: true, authority: true, local: true, sourceCurrent: true,
    cityId: b.cityId, populationSourceId: b.populationSourceId, observed: true };
  assert.ok(G.open(state, f.n, b.id, c, { roomId: 'original-post', home: { x: 8, y: 8, z: 10 } }, 'original-guard', 0));
  assert.ok(G.receive(state, f.n, state.posts[0].id, c, 10));
  return { state, c, report: G.publicView(state)[0] };
}
function ruleFor(f) {
  const src = sources('city:0').operation; src.powerCondition = 80;
  const succession = { source: { cityId: src.cityId, charterId: src.charterId, authority: { id: src.baselineAuthorityId } },
    handover: { id: 'actual-handover', bodyEpoch: 0 }, agreements: [] };
  const rule = R.createAggregate(src, succession, binding, 0, { id: 'original-ward', initialEnergy: 69120 }); assert.ok(rule);
  f.run.cityRule = rule; return rule;
}
function plant(f) {
  const rule = ruleFor(f);
  const model = CS.install(f.run, binding, 'maintenance', M.create(M.sources(f.map, rule.source, Definitions), rule, 0),
    (kind, s) => I.adopt(f.n, kind, s, binding)); assert.ok(model.sources.length);
  f.run.powerworksMaintenance = model;
  const wallet = { money: 1000 }, c = { alive: true, capable: true, authority: true, local: true, sourceCurrent: true,
    institutionsAvailable: true, atWorkface: true, workAccessible: true, bodyEpoch: 0, cell: copy(M.WORKFACE),
    wallet, stamina: 100, skills: { analysis: 40, materialsScience: 40 }, calibrations: {} };
  const stacks = ['preparedManaCrystals', 'assayReagent'].map(key => ({ id: key, section: 'resources', key, quantity: 2, carriedBy: 'scientist' }));
  const tools = ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => {
    const id = `tool:${key}`, stack = { id: `${id}:stack`, key, toolInstanceId: id, quantity: 1, carriedBy: 'scientist' };
    stacks.push(stack); c.calibrations[id] = 90; return { key, stack, tool: { id, current: 70, carriedBy: 'scientist' } };
  });
  const hooks = { alive: () => c.alive, stacks: () => stacks, tools: () => tools, work: amount => c.stamina -= amount };
  const work = (kind, at, to) => { assert.ok(M.begin(model, rule, f.n, c, kind, null, stacks, tools, wallet, at));
    M.advance(model, rule, f.n, () => c, to, hooks); assert.equal(model.job, null); rule.lastAt = to; };
  return { rule, model, c, work, stacks, tools };
}
test('actual original defensive observation has identical acquired meaning in opposite private owner outcomes', () => {
  const a = fixture(), b = fixture(), pa = post(a), pb = post(b);
  b.n.inventories.assets.find(v => v.ownerId === 'covertCell:cell:0').lost = true;
  assert.equal(a.assess(10).state, 'qualifying'); assert.equal(b.assess(10).state, 'unverified');
  const ea = E.ground(pa.report), eb = E.ground(pb.report); assert.deepEqual(ea, eb);
  S.review(a.supremacy, binding, ea, 10); S.review(b.supremacy, binding, eb, 10);
  assert.deepEqual(S.publicView(a.supremacy), S.publicView(b.supremacy));
  const held = copy(a.supremacy.review.evidence), resources = copy(a.n.inventories.assets);
  pa.c.alive = false; G.advance(pa.state, a.n, () => pa.c, 100, { alive: () => false });
  assert.deepEqual(a.n.inventories.assets, resources); assert.equal(G.receive(pa.state, a.n, pa.state.posts[0].id, pa.c, 100), false);
  delete a.run.terrestrialForces; a.assess(100);
  S.review(a.supremacy, binding, [], 100); assert.deepEqual(a.supremacy.review.evidence, held);
  assert.doesNotMatch(JSON.stringify(S.publicView(a.supremacy)), /covertCell|assetIds|scopeKey|qualifiedAt|survivingClaimants/);
});
test('actual plant work supplies distinct observed inspection/method dates, not a refreshed inspection or another plant method', () => {
  const f = fixture('research'), p = plant(f); assert.equal(f.assess(0).state, 'unverified');
  p.work('inspect', 0, 120); const inspected = E.service('technical', M.publicView(p.model), 'city:0', p.rule.id);
  assert.equal(inspected.length, 1); assert.equal(inspected[0].observedAt, 120);
  p.work('investigate', 120, 1920); assert.equal(p.stacks.find(s => s.key === 'assayReagent').quantity, 1);
  const report = M.publicView(p.model), rows = E.service('technical', report, 'city:0', p.rule.id);
  assert.equal(rows.length, 2); assert.deepEqual(rows.map(e => e.observedAt), [120, 1920]);
  assert.ok(rows[1].account.findings[0].includes('this specific plant'));
  assert.equal(f.assess(1920).state, 'qualifying');
  S.review(f.supremacy, binding, rows, 1920); const known = S.publicView(f.supremacy);
  p.model.providers[0].accepting = false; p.rule.powerMaintenance.condition = 10; p.rule.energy = 0; f.assess(2000);
  assert.deepEqual(E.service('technical', M.publicView(p.model), 'city:0', p.rule.id), rows);
  assert.deepEqual(S.publicView(f.supremacy), known);
  S.review(f.supremacy, binding, rows, 2000); assert.deepEqual(f.supremacy.review.evidence, rows);
  const source = copy(report); source.method.powerId = 'another-plant';
  assert.equal(E.service('technical', source, 'city:0', p.rule.id).length, 1);
});
test('actual attended office correspondence preserves each issuer/date and never turns signature or silence into withdrawal', () => {
  const f = fixture(), branch = f.n.source.branches[0], c = { ...binding, alive: true, capable: true, local: true, near: true, channel: true,
    cityId: branch.cityId, bodyEpoch: 0, cell: { x: 1, y: 1, z: 1 }, gate: { id: 'original-counter', receptionWorkSeconds: 1000, powerSeconds: 1000 },
    clerk: { id: 'original-clerk', status: 'alive', health: 100 } };
  assert.ok(N.begin(f.n, c, 'original:0', branch.id, 0, 'send', N.SUPPLY_PURPOSE)); N.advance(f.n, () => c, 150);
  assert.ok(N.begin(f.n, c, 'original:0', branch.id, 150, 'receive', N.SUPPLY_PURPOSE)); N.advance(f.n, () => c, 180);
  const released = N.publicView(f.n)[0], rows = E.network(released);
  assert.equal(rows.length, 2); assert.equal(rows[0].id, released.id); assert.equal(rows[1].observedAt, released.replies[0].at);
  assert.equal(rows[1].receivedAt, released.at); assert.ok(rows[1].account.findings.some(s => /radio receipt and physical withdrawal/.test(s)));
  assert.ok(rows.every(e => e.status === 'unverified')); assert.equal(f.run.networkInterdiction, undefined);
  const before = copy([f.n, released]); E.network(released); assert.deepEqual(copy([f.n, released]), before);
});
test('actual fuel contracting and failed support do not refresh delivered knowledge or imply ownership of independent producers', () => {
  const Fuel = require('../municipal-fuel-service'), Production = require('../local-market-production');
  const f = fixture('commercial'), rule = ruleFor(f), { profile } = require('./helpers/municipal-fuel-source').inputs(); profile.cityId = 'city:0';
  profile.commodityDefinitions = [Production.FUEL_DEFINITION, ...['manaCrystals', 'preparedManaCrystals', 'fieldRation', 'drinkingWater']
    .map(id => ({ id, basePrice: 10, supply: 36 }))];
  const production = Production.create(profile, 0), model = Fuel.create(Fuel.sources(f.map, rule.source, production, Definitions), rule, 0, production);
  const wallet = { money: 5000 }, c = { alive: true, capable: true, authority: true, atCounter: true, local: true, reportersPresent: true,
    bodyEpoch: 0, sourceCurrent: true, cell: copy(Fuel.DOCK), at: 0, wallet };
  const quote = Fuel.offer(model, rule, f.n, production, c, model.sources[0].id, { threshold: 6, quantity: 6, maxUnitPrice: 100, maxTripSpend: 1000 }, 0);
  assert.ok(Fuel.begin(model, rule, f.n, production, c, 'sign', quote, 1000, wallet, 0));
  const listings = Object.fromEntries(profile.commodityDefinitions.map(d => [d.id, { supply: 36, demand: 1 }]));
  Fuel.advance(model, rule, f.n, production, listings, () => c, 120, { alive: () => true }); assert.ok(model.contract);
  const held = E.service('fuel', Fuel.publicView(model), 'city:0', rule.id); assert.ok(held[0].account.limits.includes('producer ownership'));
  production.facilities[0].routeOpen = false; c.local = false; c.routeOpen = false;
  Fuel.advance(model, rule, f.n, production, listings, () => c, 240, { alive: () => true });
  assert.ok(model.hold); assert.deepEqual(E.service('fuel', Fuel.publicView(model), 'city:0', rule.id), held);
  c.local = true; c.at = 240; assert.ok(Fuel.action(model, rule, f.n, c, wallet, 'cancel'));
  const cancelled = E.service('fuel', Fuel.publicView(model), 'city:0', rule.id);
  assert.ok(cancelled[0].account.findings[0].includes('paid cargo')); assert.equal(cancelled[0].observedAt, 240);
  S.review(f.supremacy, binding, held, 120); S.review(f.supremacy, binding, cancelled, 240);
  assert.equal(f.supremacy.review.evidence[0].supersededBy, cancelled[0].id);
});
test('actual municipal enrollment/acknowledgement reports do not reveal a later port outage or certify satellite command', () => {
  const Civic = require('../civic-communications'), { addCommunications } = require('./helpers/civic-communication-source');
  const original = require('./helpers/network-operating-source').world(), city = { cityId: 'a', populationSourceId: 'population:a', charterId: 'charter:a', institutions: [{ role: 'publicWorksAndProvisioning', id: 'works:a' }] };
  const map = addCommunications(original, city), n = N.create(N.sources(map, 'messages'), binding, 0), model = Civic.create(Civic.sources(map, Definitions), binding, 0);
  const rule = { ...binding, id: 'rule:a', source: city, handoverId: 'actual-handover', operatorWorkSeconds: 28800 };
  const c = { alive: true, capable: true, local: true, atCounter: true, reportersPresent: true, authority: true, sourceCurrent: true,
    institutionsAvailable: true, bodyEpoch: 0, cell: { x: 17, y: 8, z: 6 } };
  const provider = model.sources.find(s => s.kind === 'provider').id;
  assert.ok(Civic.begin(model, rule, n, c, provider, Civic.PURPOSES, false, 0)); Civic.advance(model, rule, n, () => c, 60);
  const packet = sequence => Civic.packet(model, binding, { purpose: 'fuelProcurement', sessionId: 'actual-purchase', sequence,
    fromCityId: 'a', toCityId: 'a', signer: 'city', charterId: city.charterId, handoverId: rule.handoverId, bodyEpoch: 0 });
  assert.ok(Civic.transfer(model, n, packet(1), 61)); assert.ok(Civic.receive(model, rule, c, 61));
  const held = E.service('communications', Civic.publicView(model, 'a'), 'a', rule.id); assert.ok(held[0].account.findings[1].includes('Dated acknowledgements'));
  model.ports.find(p => p.id === provider).outage = true; assert.equal(Civic.transfer(model, n, packet(2), 62), false);
  assert.deepEqual(E.service('communications', Civic.publicView(model, 'a'), 'a', rule.id), held);
  assert.ok(held[0].account.limits.includes('satellite ownership'));
});
test('later received observation supersedes only its own source/scope, with historical dates and same-time contradictions retained', () => {
  const f = fixture();
  const city = (at, status = 'contested', sourceId = 'city-source') => E.city({ at, status, sourceId, cityId: 'known-city', foodKg: 10, waterLiters: 10, energy: 10 })[0];
  const earlier = city(10), newer = city(30, 'established'), foreign = city(50, 'established', 'another-source');
  S.review(f.supremacy, binding, [earlier], 10); S.review(f.supremacy, binding, [foreign], 50);
  assert.equal(f.supremacy.review.evidence[0].supersededBy, undefined);
  S.review(f.supremacy, binding, [newer], 50); assert.equal(f.supremacy.review.evidence[0].supersededBy, newer.id);
  assert.equal(f.supremacy.review.evidence[0].observedAt, 10); assert.ok(f.supremacy.review.apparent);
  // A later delivery of an older observation does not replace the newer observation.
  const delayed = { ...city(20), id: 'delayed-old-account', receivedAt: 60 };
  S.review(f.supremacy, binding, [delayed], 60); assert.equal(f.supremacy.review.evidence.at(-1).supersededBy, newer.id);
  const sameTime = { ...city(30), id: 'unresolved-same-time-contradiction' };
  S.review(f.supremacy, binding, [sameTime], 60); assert.equal(f.supremacy.review.apparent, false);
  const forgedRefresh = { ...newer, observedAt: 100, receivedAt: 100, supersededBy: 'fake' };
  S.review(f.supremacy, binding, [forgedRefresh], 100);
  assert.equal(f.supremacy.review.evidence.find(e => e.id === newer.id).observedAt, 30);
});
test('scoped records survive real normalization/continued binding; fresh starts and irreversible death cannot inherit or refresh them', () => {
  const f = fixture(), p = post(f), evidence = E.ground(p.report); S.review(f.supremacy, binding, evidence, 10);
  const restored = S.normalize(copy(f.supremacy)); assert.deepEqual(S.publicView(restored), S.publicView(f.supremacy));
  const continued = S.rebind(restored, binding, { ...binding, runId: 'continued' }); assert.deepEqual(S.publicView(continued), S.publicView(restored));
  const before = copy(continued); assert.equal(S.review(continued, continued, [], 20, false), false); assert.deepEqual(continued, before);
  const fresh = S.create({ ...binding, runId: 'fresh' }, S.baseline(f.map), 0); assert.equal(fresh.review, null);
  assert.equal(N.create(N.sources(f.map, 'evidence-originals'), { ...binding, runId: 'fresh' }, 0, { originalInventory: true }).reports.length, 0);
});
test('legacy receipt presentation can be enriched only from the matching held document, without changing its label, dates or status', () => {
  const f = fixture(), p = post(f), rich = E.ground(p.report)[0], { account, seriesId, ...legacy } = rich;
  S.review(f.supremacy, binding, [legacy], 10); S.review(f.supremacy, binding, [{ ...rich, receivedAt: 20 }], 20);
  assert.equal(f.supremacy.review.evidence[0].account, undefined);
  S.review(f.supremacy, binding, [rich], 20); assert.deepEqual(f.supremacy.review.evidence[0], rich);
  const changed = { ...rich, account: { ...rich.account, findings: ['Unsupported new scope'] } };
  S.review(f.supremacy, binding, [changed], 20); assert.deepEqual(f.supremacy.review.evidence[0], rich);
});
test('received-only projections strip private additions, refuse incomplete/future reports and retain bounded exact scopes', () => {
  for (const kind of ['technical', 'fuel', 'communications', 'parts', 'unknown']) assert.deepEqual(E.service(kind, { at: 10 }, 'city', 'rule'), []);
  assert.deepEqual(E.ground({ at: 10 }), []);
  assert.deepEqual(E.network({ at: 10 }), []); assert.deepEqual(E.charter({ charter: {}, at: 10 }), []);
  const e = E.ground({ id: 'post:observed:10', branchId: 'branch', at: 10, text: 'Personally observed on-post duty', privateRoster: 'SECRET' })[0];
  const f = fixture(); S.review(f.supremacy, binding, [{ ...e, privateRoster: 'SECRET', account: { ...e.account, inventory: 'SECRET' } },
    { ...e, id: 'future', observedAt: 100, receivedAt: 100 }], 10);
  assert.equal(f.supremacy.review.evidence.length, 1); assert.doesNotMatch(JSON.stringify(S.publicView(f.supremacy)), /SECRET|future|inventory/);
  assert.deepEqual(E.service('technical', { at: 1, powerId: 'plant', method: { powerId: 'plant', at: 10 } }, 'city', 'rule')[0].account.findings,
    ['No plant-specific inspection or acquired method is established by this received account.']);
});
