const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('../institutional-outcomes'), C = require('../network-capabilities'), N = require('../network-operations');
const I = require('../network-inventories'), Owners = require('../network-owner-reconciliation');
const X = require('../exceptional-reach'), Field = require('../network-interdiction'), Rule = require('../city-rule');
const S = require('../durable-supremacy');
const { world, Definitions, binding } = require('./helpers/institutional-inventory-source');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(category = 'military', change = () => {}) {
  const map = world([Definitions.find(d => d.category === category)]);
  map.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'strong';
  map.strategicCapabilityHistory = { historicalHorizonYear: 1000, milestoneRows: Object.entries(X.FUNCTIONS).map(([capabilityId, kind]) => ({
    capabilityId, standardizationYear: 100, institution: { id: `institute:${capabilityId}` }, infrastructureRows: [{
      id: `commissioned:${capabilityId}`, capabilityId, function: kind, cityId: 'city:0', cellId: 'cell:0',
      operatingInstitutionId: `institute:${capabilityId}`, commissionedYear: 200, operationalAtPlayableYear: true }] })) };
  change(map);
  const n = N.create(N.sources(map, 'aggregate-originals'), binding, 0, { originalInventory: true });
  const run = { clock: 0, networkOperations: n }, context = {};
  const f = { map, n, run, context };
  f.tick = (at, advance = true) => {
    run.clock = n.lastAt = at;
    Owners.reconcile(n.capabilityAccounting, n, run, binding); I.observe(n, run, binding);
    const frame = O.frame(n, run, at, context); if (advance) O.advance(n, run, frame, at);
    return { frame, result: C.assess(n.capabilityAccounting, n, 'original:0', frame, at), fact: N.fact(n, 'original:0', false, at, frame) };
  };
  return f;
}
function city(id) {
  const src = sources(id).operation; src.powerCondition = 80;
  const people = Rule.ROLES.map(role => ({ id: `${id}:${role}`, institutionId: src.institutions.find(i => i.role === role).id,
    roles: [role], health: 100, status: 'alive' }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: `${id}:terms` }));
  const succession = { source: { cityId: id, charterId: src.charterId, authority: { id: src.baselineAuthorityId } }, officeId: `office:${id}`, handover: { id: `handover:${id}`, termsId: `${id}:terms`, bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: `handover:${id}`, bodyEpoch: 0, commandRelationships: copy(agreements) } };
  return Rule.createAggregate(src, succession, binding, 0, { id: `ward:${id}`, initialEnergy: 69120 });
}
function field(f) {
  const r = city('target'), force = Field.create(Field.originalSources(f.n), binding, 'aggregate-originals', 0);
  assert.ok(force.units.length); assert.ok(I.adopt(f.n, 'interdiction', force, binding)); Field.reserve(force, f.n);
  f.run.networkInterdiction = force; f.run.cityRule = r;
  const u = force.units[0], account = N.host(f.n, u.source.branchId);
  const link = { cityId: 'target', satelliteId: 'farm:target', targetRuleId: r.id, farmKm: .1, endpointCityIds: ['city:0', 'target'],
    originCityId: 'city:0', corridorKm: .1, distanceKm: .2, strongholds: [] };
  const c = { account, gate: { powerSeconds: 1800, receptionWorkSeconds: 1800 }, clerk: { id: 'original-clerk', status: 'alive', health: 100 }, quota: r,
    sourceCurrent: true, witnessCurrent: true, channel: true, routeOpen: true, physicalRouteOpen: true, link, targetControlled: true, targetReceiptId: r.handoverId,
    breach: { id: 'original-promise:breach', promiseId: 'original-promise', clerkId: 'original-clerk', at: 0 } };
  const h = { alive: () => true, arrive: unit => { unit.deployment.entry = { x: 5, y: 5, z: 10 };
    unit.actors.forEach((a, i) => { a.mapCell = { x: 6, y: 6 + i, z: 10 }; a.roomId = 'field-site'; }); return true; } };
  f.context.field = () => c;
  const advance = at => { Field.advance(force, f.n, () => c, at, h); r.lastAt = at; return f.tick(at); };
  return { r, force, u, c, h, advance };
}
test('complete ordinary original scopes qualify without disclosure, political submission or an invented hostile intent', () => {
  for (const category of ['military', 'standards', 'commercial', 'research']) {
    const f = fixture(category), before = copy([f.n.inventories.assets, f.n.accounts]);
    const { result, fact } = f.tick(0);
    assert.equal(result.state, 'qualifying', JSON.stringify(result.outcome.issues)); assert.equal(result.strategicComplete, true);
    assert.equal(fact.strategic.willing, false); assert.equal(fact.strategic.canOverturn, false);
    assert.equal(fact.basis, 'supportedNonintervention'); assert.equal(fact.since, 0);
    assert.equal(result.outcome.sources.length, 4); assert.ok(result.outcome.sources.every(s => s.families.length === 7));
    assert.equal(new Set(result.outcome.assetIds).size, result.outcome.assetIds.length);
    assert.deepEqual(copy([f.n.inventories.assets, f.n.accounts]), before);
    assert.equal(C.assess(f.n.capabilityAccounting, f.n, 'original:0').state, 'unverified');
    assert.equal(N.fact(f.n, 'original:0', false, 0).state, 'unverified');
  }
});
test('reads cannot inject, advance, serialize, rebind or refresh a strategic certificate', () => {
  const f = fixture(), initial = copy(f.n), frame = O.frame(f.n, f.run, 0);
  assert.equal(O.read(frame, f.n, 'original:0', 0).state, 'unverified'); // no owner reconciliation yet
  assert.deepEqual(copy(f.n), initial);
  assert.equal(C.assess(f.n.capabilityAccounting, f.n, 'original:0', { state: 'qualifying', strategicComplete: true }, 0).state, 'unverified');
  const good = f.tick(0); assert.equal(good.result.state, 'qualifying');
  assert.equal(O.read(copy(good.frame), f.n, 'original:0', 0), null);
  assert.equal(O.read(good.frame, N.normalize(f.n), 'original:0', 0), null);
  f.run.clock++; assert.equal(O.read(good.frame, f.n, 'original:0', 0), null);
  f.run.clock = 0; f.run.worldReference = { worldId: 'another-world' };
  assert.equal(O.read(O.frame(f.n, f.run, 0), f.n, 'original:0', 0), null);
  delete f.run.worldReference; f.context.alive = false;
  const before = copy(f.n.capabilityAccounting.institutionalContinuity), dead = O.frame(f.n, f.run, 0, f.context);
  assert.equal(O.advance(f.n, f.run, dead, 0), false); assert.deepEqual(f.n.capabilityAccounting.institutionalContinuity, before);
});
test('missing concealed originals, host conflicts, stale clocks and extra claimant/command claims stay unverified', () => {
  for (const change of [f => f.n.inventories.owners.pop(), f => f.n.capabilityAccounting.records.pop(),
    f => f.n.inventories.assets[0].lost = true, f => f.n.accounts[0].source.networkId = 'replacement',
    f => f.n.inventories.assets[0].state.survivingClaimants = ['unresolved-successor'],
    f => f.n.inventories.assets[0].state.governmentAccess = true]) {
    const f = fixture(); change(f); assert.equal(f.tick(0).result.state, 'unverified');
  }
  const f = fixture(); f.tick(0); f.run.clock = 1;
  const frame = O.frame(f.n, f.run, 1); assert.equal(O.read(frame, f.n, 'original:0', 1).state, 'unverified');
});
test('consolidated branches share original means once but do not erase either lineage or acquire wider control', () => {
  const f = fixture('military', m => {
    const h = m.strategicNonStateNetworkHistory, b = copy(h.branchRows[0]);
    b.id = 'original-consolidated'; b.consolidatedIntoBranchId = h.branchRows[0].id; h.branchRows.push(b);
  });
  const r = f.tick(0).result.outcome; assert.equal(r.state, 'qualifying', JSON.stringify(r.issues));
  const alias = r.sources.find(s => s.id === 'branch:original-consolidated'), host = r.sources.find(s => s.id === 'branch:branch:0');
  assert.equal(alias.sharedHost, host.id); assert.deepEqual(alias.families, host.families);
  assert.equal(r.sources.length, 5); assert.equal(new Set(r.assetIds).size, r.assetIds.length);
});
test('original exceptional ownership/manifests remain named unknowns after aggregation', () => {
  const f = fixture('transport'), r = f.tick(0).result;
  assert.equal(r.state, 'unverified'); assert.ok(r.outcome.issues.some(i => /rocketLaunchServices/.test(i)));
  assert.equal(r.outcome.canOverturn, false); // unknown is not an invented army
  const g = fixture(); g.n.source.exceptionalSources.sites[0].state = 'unverifiedCommissioning';
  assert.equal(g.tick(0).result.state, 'unverified');
});
test('supported later original-registry additions and missing source views are retained as gaps, never claimant retirement', () => {
  const f = fixture(); assert.equal(f.tick(0).result.state, 'qualifying');
  const later = copy(f.map); later.strategicNonStateNetworkHistory.covertRows.push({ id: 'later-original-cell', networkId: 'original:0',
    cityId: 'city:0', kind: 'brokerCell', status: 'active' });
  C.sync(f.n.capabilityAccounting, C.baseline(later));
  const r = f.tick(1).result; assert.equal(r.state, 'unverified');
  assert.ok(r.outcome.sources.some(s => s.id === 'covertCell:later-original-cell'));
  assert.ok(f.n.capabilityAccounting.records.find(r => r.id === 'covertCell:later-original-cell').lost);
  assert.ok(!f.tick(1).fact.lifecycle);
});
test('an actual paid capable field journey blocks even when unrelated original exceptional coverage is unknown', () => {
  const f = fixture(), d = field(f); f.n.source.exceptionalSources.sites[0].state = 'unverifiedCommissioning';
  const r = d.advance(150);
  assert.equal(d.u.phase, 'outbound'); assert.equal(d.c.account.money, 120);
  assert.equal(r.fact.state, 'notQualifying'); assert.equal(r.fact.strategic.canOverturn, true);
  assert.ok(r.result.outcome.issues.length); assert.equal(r.result.outcome.challenges[0].cityId, 'target');
  f.run.cityRule = city('other-home');
  f.run.penalFlights = { assistance: { cityApproach: { gates: [{ regionalGovernment: { rule: d.r, services: {} } }] } } };
  assert.equal(d.advance(151).fact.state, 'notQualifying'); // not a home-city-only check
});
test('a prospective stand-down signature is not radio receipt, physical withdrawal or a whole-network resolution', () => {
  const f = fixture(), d = field(f); assert.equal(d.advance(280).fact.state, 'notQualifying'); assert.equal(d.u.phase, 'deployed');
  d.c.physicalRouteOpen = false; assert.equal(d.advance(281).fact.state, 'notQualifying'); // the physical crossing hold survives an outward-route outage
  d.c.physicalRouteOpen = true;
  const at = f.run.clock; d.c.account.mandates = { [Field.PURPOSE]: { id: 'scoped-order', at } };
  assert.equal(d.advance(at + 1).fact.state, 'notQualifying'); assert.equal(d.u.deployment.ceasefire, null);
  assert.equal(d.advance(at + 70).fact.state, 'unverified'); assert.ok(d.u.deployment.ceasefire); assert.notEqual(d.u.phase, 'returned');
  d.u.actors.forEach(a => a.workSeconds = 0); assert.equal(d.advance(at + 100).fact.state, 'unverified');
  assert.ok(f.n.inventories.assets.some(a => a.id.endsWith('original-reserve-professional') && !a.lost));
});
test('coarse catch-up retains actual intervention/return dates even when the final scoped function is the same', () => {
  const coarse = fixture(), fine = fixture(), a = field(coarse), b = field(fine);
  for (const [f, d] of [[coarse, a], [fine, b]]) {
    d.h.move = (actor, goal) => { actor.mapCell = copy(goal); return true; };
    f.tick(0);
  }
  Field.advance(a.force, coarse.n, () => a.c, 150, a.h); // no intermediate assessment in this schedule
  for (let at = 1; at <= 150; at++) b.advance(at);
  for (const d of [a, b]) d.c.account.mandates = { [Field.PURPOSE]: { id: 'scoped-order', at: 150 } };
  // Real consumer simulates the same report, paid outward journey, received
  // recall and physical homeward journey in coarse/fine schedules.
  const final = a.advance(500);
  for (let at = 151; at <= 500; at++) b.advance(at);
  assert.equal(a.u.phase, 'returned'); assert.equal(b.u.phase, 'returned');
  assert.deepEqual(copy(a.force), copy(b.force)); assert.equal(final.fact.state, 'qualifying');
  assert.equal(final.fact.since, a.u.deployment.returnedAt);
  assert.equal(fine.n.capabilityAccounting.institutionalContinuity.rows[0].since, final.fact.since);
  const restored = N.normalize(coarse.n); assert.equal(restored.capabilityAccounting.institutionalContinuity.rows[0].since, final.fact.since);
  // A later changed original authorization is not covered by an old quiet window.
  a.c.account.mandates[Field.PURPOSE].id = 'replacement-order';
  assert.equal(a.advance(501).fact.since, 501);
});
test('an actual adopted fuel pipeline stays a named dependency despite a current buffer; cancellation retains independent producer property', () => {
  const Fuel = require('../municipal-fuel-service'), Production = require('../local-market-production');
  const f = fixture('commercial', m => m.strategicPlayableSettlementState.cityRows[0].assetId = 'population:city:0');
  const r = city('city:0'); f.run.cityRule = r;
  const { profile } = require('./helpers/municipal-fuel-source').inputs(); profile.cityId = 'city:0';
  profile.commodityDefinitions = [Production.FUEL_DEFINITION, ...['manaCrystals', 'preparedManaCrystals', 'fieldRation', 'drinkingWater']
    .map(id => ({ id, basePrice: 10, supply: 36 }))];
  const p = Production.create(profile, 0); f.run.economy = { commodityMarket: { localProduction: p } };
  const service = Fuel.create(Fuel.sources(f.map, r.source, p, Definitions), r, 0, p);
  assert.ok(service); f.run.municipalFuelService = service;
  const wallet = { money: 5000 }, c = { alive: true, capable: true, authority: true, atCounter: true, local: true, reportersPresent: true,
    otherBusy: false, violence: false, bodyEpoch: 0, sourceCurrent: true, cell: copy(Fuel.DOCK), at: 0, wallet };
  const quote = Fuel.offer(service, r, f.n, p, c, service.sources[0].id,
    { threshold: 6, quantity: 6, maxUnitPrice: 100, maxTripSpend: 1000 }, 0); assert.ok(quote);
  assert.ok(Fuel.begin(service, r, f.n, p, c, 'sign', quote, 1000, wallet, 0));
  const listings = Object.fromEntries(profile.commodityDefinitions.map(d => [d.id, { supply: 36, demand: 1 }]));
  Fuel.advance(service, r, f.n, p, listings, () => c, 120, { alive: () => true }); r.lastAt = 120;
  assert.ok(service.contract); assert.ok(r.energy > 0); // current power reserve is not continuing independent fuel
  const result = f.tick(120).result.outcome; assert.equal(result.state, 'unverified');
  assert.ok(result.issues.some(i => i.includes('fuel pipeline'))); assert.equal(result.willing, false);
  const before = copy(p); c.at = 120; assert.ok(Fuel.action(service, r, f.n, c, wallet, 'cancel'));
  assert.equal(f.tick(120).result.state, 'qualifying'); assert.deepEqual(copy(p), before);
  assert.ok(!f.n.inventories.assets.some(a => p.trucks.some(t => t.id === a.id)));
});
test('every city contributes its own original method dependency; shared workers do not copy methods between plants', () => {
  const M = require('../powerworks-maintenance'), CS = require('../city-services');
  const f = fixture('research', map => {
    map.strategicPlayableSettlementState.cityRows.push({ cityId: 'city:1', assetId: 'population:city:1', currentPopulation: 3000,
      physicalJurisdictionExists: true, physicalCondition: 'intact', services: { communications: 'functional' } });
    map.strategicPlayableSettlementState.cityRows[0].assetId = 'population:city:0';
    map.strategicCapabilityHistory.milestoneRows.push({ capabilityId: 'original-power-generation', infrastructureRows: ['city:0', 'city:1'].map(id => ({
      id: `power:${id}`, cityId: id, function: 'powerWorks', operationalAtPlayableYear: true })) });
  }), a = city('city:0'), b = city('city:1');
  f.run.cityRule = a; f.run.penalFlights = { assistance: { cityApproach: { gates: [{ regionalGovernment: { rule: b, services: {} } }] } } };
  for (const e of CS.entries(f.run)) e.owner.powerworksMaintenance = CS.install(f.run, binding, 'maintenance',
    M.create(M.sources(f.map, e.rule.source, Definitions, true), e.rule, 0), (kind, s) => I.adopt(f.n, kind, s, binding));
  const models = CS.entries(f.run).map(e => e.owner.powerworksMaintenance);
  assert.ok(models.every(s => s?.sources.length)); assert.equal(models[0].providers[0].technician, models[1].providers[0].technician);
  assert.equal(f.tick(0).result.state, 'unverified');
  assert.equal(f.tick(0).result.outcome.dependencies.length, 2);
  const wallet = { money: 1000 }, c = { alive: true, capable: true, local: true, authority: true, sourceCurrent: true,
    institutionsAvailable: true, atWorkface: true, workAccessible: true, otherBusy: false, violence: false, bodyEpoch: 0,
    cell: copy(M.WORKFACE), channelAvailable: true, wallet, stamina: 100, skills: { analysis: 40, materialsScience: 40 }, calibrations: {} };
  const stacks = [], tools = ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => {
    const id = `tool:${key}`, stack = { id: `${id}:stack`, key, toolInstanceId: id, quantity: 1, carriedBy: 'scientist' };
    stacks.push(stack); c.calibrations[id] = 90; return { key, stack, tool: { id, current: 70, carriedBy: 'scientist' } };
  });
  const h = { alive: () => true, stacks: () => stacks, tools: () => tools, work: amount => c.stamina -= amount };
  let at = 0;
  for (let i = 0; i < 2; i++) {
    const s = models[i], r = [a, b][i];
    M.advance(s, r, f.n, () => c, at, h);
    assert.ok(M.begin(s, r, f.n, c, 'inspect', null, stacks, tools, wallet, at));
    at += 120; M.advance(s, r, f.n, () => c, at, h);
    assert.ok(M.begin(s, r, f.n, c, 'learn', s.sources[0].id, stacks, tools, wallet, at));
    at += 1200; M.advance(s, r, f.n, () => c, at, h); assert.ok(s.method);
    for (let j = 0; j < 2; j++) { [a, b][j].lastAt = at; M.advance(models[j], [a, b][j], f.n, () => c, at, h); }
    const assessment = f.tick(at).result;
    assert.equal(assessment.state, i === 0 ? 'unverified' : 'qualifying', JSON.stringify(assessment.outcome.issues));
  }
  const dated = copy(models.map(s => s.report)); models[0].providers[0].accepting = false;
  assert.equal(f.tick(at).result.state, 'qualifying'); assert.deepEqual(models.map(s => s.report), dated);
  b.technicalMaintenanceInitialized = true; delete CS.entries(f.run)[1].owner.powerworksMaintenance;
  assert.equal(f.tick(at).result.state, 'unverified');
});
test('coarse, fine, save/rebind and missing timing restart only supported continuous observation; no empty world or automatic award', () => {
  const a = fixture(), b = fixture(); a.tick(0); b.tick(0); a.tick(200);
  for (let at = 1; at <= 200; at++) b.tick(at);
  assert.deepEqual(copy(a.n.capabilityAccounting.institutionalContinuity), copy(b.n.capabilityAccounting.institutionalContinuity));
  const restored = N.normalize(a.n); assert.deepEqual(restored.capabilityAccounting.institutionalContinuity, a.n.capabilityAccounting.institutionalContinuity);
  const rebound = N.rebind(a.n, binding, { ...binding, runId: 'continued' });
  assert.equal(rebound.capabilityAccounting.institutionalContinuity.runId, 'continued');
  const cityTarget = { id: 'city:living', sourceId: 'population:living', kind: 'city', createdAt: 0 };
  const base = { complete: true, targets: [cityTarget, { id: 'counterpower:original:0', sourceId: 'original:0', kind: 'counterpower', createdAt: 0 }] };
  const supremacy = S.create(binding, base, 0);
  const tick = at => { const fact = a.tick(at).fact; S.advance(supremacy, binding, { complete: true, facts: [fact,
    { ...binding, targetId: cityTarget.id, sourceId: cityTarget.sourceId, kind: 'city', at, since: 0, state: 'qualifying', viable: true, proofId: 'actual-city-consumer', basis: 'directGovernment' }] }, at); };
  tick(200); tick(200 + S.INTERVAL); assert.equal(supremacy.phase, 'qualified'); assert.equal(supremacy.accomplishment, undefined);
  delete a.n.capabilityAccounting.institutionalContinuity; tick(201 + S.INTERVAL); assert.equal(supremacy.phase, 'holding'); assert.equal(supremacy.since, 201 + S.INTERVAL);
  assert.doesNotMatch(JSON.stringify(S.publicView(supremacy)), /original:0|qualifiedAt|institutionalContinuity/);
});
