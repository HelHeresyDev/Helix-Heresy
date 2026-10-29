const { test } = require('node:test');
const assert = require('node:assert/strict');
const Rule = require('../city-rule'), Quota = require('../city-provisioning');
const Production = require('../local-market-production'), Market = require('../city-commodity-market');
const Carrier = require('../local-exchange-carrier'), Library = require('../world-run-library');
const Recovery = require('../city-recovery');
const Defense = require('../city-defense');
const { sources } = require('./helpers/regional-government-source');
const { recoverySources } = require('./helpers/city-recovery-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(population = 24, farms = false) {
  const input = sources('a'), source = input.operation;
  source.population = population;
  if (!farms) source.farms = [];
  for (const farm of source.farms) farm.cityPopulation = population;
  const people = source.institutions.map(i => ({ id: `${i.id}:original`, institutionId: i.id, roles: [i.role], status: 'alive', health: 100 }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'original-terms' }));
  const succession = { source: { ...copy(source), authority: { id: source.baselineAuthorityId } }, officeId: 'original-counter', leaders: people,
    handover: { id: 'actual-handover', termsId: 'original-terms', bodyEpoch: 0 }, agreements,
    control: { sourceReceiptId: 'actual-handover', recognizedAuthorityId: 'scientist', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const s = Rule.createAggregate(source, succession, { worldId: 'world', runId: 'run' }, 0, { id: 'original-ward', initialEnergy: 0 });
  const c = { alive: true, capable: true, free: true, local: true, atCounter: true, reportersPresent: true, sourceCurrent: true,
    bodyEpoch: 0, institutionsAvailable: true, defenseAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge' };
  return { input, source, s, succession, people, c };
}
const advance = (f, seconds) => Rule.advance(f.s, f.succession, f.people, () => f.c, f.s.lastAt + seconds);
const stack = (quantity = 40, key = 'fieldRation') => ({ id: 'original-owned-lot', section: 'inventory', key, quantity, knownQuantity: quantity, carriedBy: 'scientist' });
const deliver = (f, item, quantity) => Rule.deliverFood(f.s, f.succession, f.people, f.c, [item], item.key, f.s.lastAt, quantity);

test('intact original cities can have no farm, ruined farms or unusable routes without fabricating local food production', () => {
  for (const variant of ['absent', 'ruined', 'blocked', 'transport']) {
    const map = recoverySources().rawMap, city = map.strategicPlayableSettlementState.cityRows[0];
    city.physicalCondition = 'intact'; for (const key of Object.keys(city.services)) city.services[key] = 'functional';
    for (const i of map.strategicCivicHistory.currentInstitutionRows) { i.operationalStatus = 'operational'; i.currentCapacityBand = 'functional'; }
    const farm = map.strategicPlayableSettlementState.satelliteRows[0];
    Object.assign(farm, { physicalCondition: 'intact', localRouteUsable: true, services: { provisioning: 'functional', transport: 'functional' } });
    if (variant === 'absent') { map.publicSettlementDirectory.satelliteCodes = []; map.strategicPlayableSettlementState.satelliteRows = []; }
    if (variant === 'ruined') farm.physicalCondition = 'ruined';
    if (variant === 'blocked') farm.localRouteUsable = false;
    if (variant === 'transport') farm.services.transport = 'failed';
    const before = copy(map), source = Rule.sourceFromWorld(map, 'a', { politicalSettlement: true });
    assert(Rule.validSource(source), variant); assert.deepEqual(source.farms, []); assert.deepEqual(map, before);
  }
});

test('a recognized farmless city exhausts its actual buffer and cannot qualify on promises or a farm label', () => {
  const f = fixture(); assert(Rule.order(f.s, f.succession, f.people, f.c, 0));
  advance(f, 3600 + Rule.INTERVAL);
  assert.equal(f.s.foodKg, 0); assert(f.s.unmetKg > 0); assert.equal(f.s.since, null);
  assert.equal(f.s.accomplishment, null); assert.equal(f.s.status, 'contested'); assert.deepEqual(f.s.farms, []);
});

test('home government without a farm uses its original defense allocation without requiring or inventing an agricultural pilot', () => {
  const f = fixture(), actor = f.people.at(-1); actor.exceptionalCapabilities = ['city-scale ward defense'];
  const defenseSource = { ...f.input.defense, population: f.source.population };
  const defense = Defense.create(defenseSource, f.succession, actor, { id: 'original-counter', cityId: 'a' },
    { worldId: 'world', runId: 'run' }, 0, 80);
  assert(defense);
  const create = () => Rule.create(f.source, f.succession, null, defense, { worldId: 'world', runId: 'run' }, 0);
  const rule = create(); assert(rule); assert.equal(rule.allocationMode, 'aggregate'); assert.equal(rule.pilotProvisionId, null);
  assert.equal(rule.initialEnergy + defense.initialEnergy, f.source.reserveDays * 86400);
  assert.equal(rule.population, f.source.population); assert.deepEqual(rule.farms, []);
  defense.source.populationSourceId = 'other'; assert.equal(create(), null);
});

test('actual carried food and finite intake work sustain a farmless city, with shortages and recovery retaining historical truth', () => {
  const f = fixture(), item = stack(60);
  assert(Rule.order(f.s, f.succession, f.people, f.c, 0)); advance(f, 3600);
  const water = f.s.waterLiters + f.s.rawWaterLiters + f.s.drankLiters, food = f.s.foodKg;
  assert(deliver(f, item, 30)); assert.equal(item.quantity, 30); assert.equal(f.s.foodKg, food);
  advance(f, 60); assert.equal(f.s.deliveredFoodKg, 15); assert(Math.abs(f.s.waterLiters + f.s.rawWaterLiters + f.s.drankLiters - water) < 1e-6);
  advance(f, Rule.INTERVAL); assert.equal(f.s.status, 'established');
  assert(Math.abs(f.s.initialFoodKg + f.s.deliveredFoodKg - f.s.eatenKg - f.s.foodKg) < 1e-6);
  assert(Rule.receive(f.s, f.succession, f.people, f.c, f.s.lastAt)); const historical = copy(f.s.report);
  advance(f, 86400 / 2); assert.equal(f.s.foodKg, 0); assert.equal(f.s.since, null);
  assert.deepEqual(f.s.report, historical); const failureAt = f.s.failureAt, energy = f.s.energy;
  assert(deliver(f, item, 20)); advance(f, 40);
  assert.equal(f.s.status, 'limited'); assert(f.s.since > failureAt); assert(f.s.energy < energy);
  assert.deepEqual(f.s.accomplishment, historical.accomplishment); assert.equal(item.quantity, 10);
});

test('food intake rejects remote, reserved, unsafe, foreign, fabricated and over-capacity goods without mutation', () => {
  for (const patch of [{ carriedBy: '' }, { carriedBy: 'employee' }, { cityOwnerId: 'a' }, { civicCustody: true },
    { ownerId: 'merchant' }, { legalOwnerId: 'merchant' }, { reservedTaskId: 'sale' }, { fixtureId: 'shelf' },
    { containerId: 'box' }, { carryTaskId: 'haul' }, { contents: [{}] }, { biology: {} }, { chemicalBatch: {} },
    { tags: ['contaminated'] }, { tags: ['stolen'] }, { tags: ['spoiled'] }, { tags: ['poisoned'] },
    { section: 'resources' }, { key: 'biomass' }, { key: 'toString' }, { key: 'constructor' }, { quantity: 1.5 }]) {
    const f = fixture(), item = { ...stack(), ...patch }, before = copy([f.s, item]);
    assert.equal(deliver(f, item, 1), false, JSON.stringify(patch)); assert.deepEqual([f.s, item], before);
  }
  for (const mutate of [f => f.c.local = false, f => f.c.atCounter = false, f => f.c.reportersPresent = false,
    f => f.c.violence = true, f => f.c.alive = false, f => f.c.sourceCurrent = false,
    f => f.c.bodyEpoch++, f => f.c.institutionsAvailable = false, f => f.succession.agreements.pop(),
    f => f.s.operatorWorkSeconds = 0]) {
    const f = fixture(); mutate(f); const item = stack(), before = copy([f.s, item]);
    assert.equal(deliver(f, item, 1), false); assert.deepEqual([f.s, item], before);
  }
  const f = fixture(); for (const n of [0, -1, 1.5, NaN, Infinity, 10001, 100]) assert.equal(deliver(f, stack(200), n), false);
  assert.equal(Rule.deliverFood(f.s, f.succession, f.people, f.c, [stack()], 'fieldRation', 10, 1), false);
});

test('partial saved intake retains city custody through authority interruption, continued copy and death without refunds or backfill', () => {
  const f = fixture(), item = stack(20); assert(deliver(f, item, 20)); advance(f, 10);
  assert.equal(f.s.foodDelivery.progress, 10); assert.equal(f.s.deliveredFoodKg, 0);
  const loaded = { ...copy(f), s: Rule.normalize(f.s) }; assert(loaded.s);
  for (const model of [f, loaded]) {
    model.c.institutionsAvailable = false; advance(model, 120); assert.equal(model.s.foodDelivery.progress, 10);
    model.c.institutionsAvailable = true; advance(model, 30); assert.equal(model.s.deliveredFoodKg, 10);
    model.s = Rule.normalize(model.s); model.s.runId = 'continued-run';
    model.c.alive = false; const frozen = copy(model.s); assert.equal(advance(model, 86400), false); assert.deepEqual(model.s, frozen);
  }
  assert.deepEqual(loaded.s, f.s); assert.equal(item.quantity, 0);
  const bad = copy(f.s); bad.foodDelivery = { id: 'fake', key: 'biomass', quantity: 1 }; assert.equal(Rule.normalize(bad), null);
});

test('the same owned packages cannot feed two accounts and an old report is not refreshed by delivery', () => {
  const f = fixture(), other = fixture(), item = stack(20);
  assert(Rule.receive(f.s, f.succession, f.people, f.c, 0)); const before = copy(f.s.report);
  assert(deliver(f, item, 20)); assert.equal(deliver(other, item, 20), false);
  advance(f, 40); assert.deepEqual(f.s.report, before); assert.equal(other.s.deliveredFoodKg, 0);
});

test('commercial extraction is excluded once from original municipal harvest; existing stock, cargo and quota are never copied or refilled', () => {
  const f = fixture(3000, true), sourceId = f.s.farms[0].id;
  const producer = Production.create({ cityId: 'a', workshopCapacity: 1, listings: {}, productionSources: [
    { id: sourceId, family: 'biologicalProductivity', capacity: 1, route: { open: true, distanceKm: 4, cellIds: [], mode: 'groundConvoy' } }
  ] });
  const listings = { biomass: { supply: 0 }, fieldRation: { supply: 0 } }, supplier = Carrier.support(Carrier.create('a')).supplier;
  Production.advance(producer, 3 * 3600, listings, supplier);
  const commercial = copy(producer), produced = producer.sources[0].produced, crop = f.s.farms[0].cropKg;
  assert(produced > 0); assert(Production.reserveMunicipalFood(producer, f.s));
  const allocation = producer.sources[0].municipalFoodAllocation;
  assert.equal(f.s.farms[0].cropKg, crop - produced - allocation.futureKg);
  assert.equal(producer.sources[0].remaining, allocation.futureKg);
  assert.equal(producer.sources[0].stock, commercial.sources[0].stock); assert.deepEqual(producer.shipments, commercial.shipments);
  assert.deepEqual(producer.workshops, commercial.workshops); assert.equal(f.s.foodKg, f.s.initialFoodKg);
  const saved = copy([producer, f.s]); assert.equal(Production.reserveMunicipalFood(producer, f.s), false); assert.deepEqual([producer, f.s], saved);
  Production.advance(producer, 48 * 3600, listings, supplier); assert(producer.sources[0].produced > produced);
  Production.advance(producer, 500 * 3600, listings, supplier);
  assert(producer.sources[0].produced <= produced + allocation.futureKg + 1e-7);
  assert.equal(f.s.farms[0].cropKg, crop - produced - allocation.futureKg);
  const loaded = copy(producer), loadedRule = Rule.normalize(f.s); loadedRule.runId = 'continued';
  assert.equal(Production.reserveMunicipalFood(loaded, loadedRule), false);
});

test('detailed municipal quota and aggregate remainder share the same commercial exclusion without counting it twice', () => {
  const f = fixture(3000, true), farm = f.source.farms[0];
  const quota = Quota.create(farm, f.succession, { id: 'original-counter', cityId: 'a' }, { worldId: 'world', runId: 'run' }, 0);
  assert(quota);
  const producer = Production.create({ cityId: 'a', workshopCapacity: 1, listings: {}, productionSources: [
    { id: farm.satelliteId, family: 'biologicalProductivity', capacity: 1, route: { open: true, distanceKm: 4 } }
  ] });
  const listings = { biomass: { supply: 0 }, fieldRation: { supply: 0 } }, supplier = Carrier.support(Carrier.create('a')).supplier;
  Production.advance(producer, 3 * 3600, listings, supplier); const produced = producer.sources[0].produced;
  const quotaBefore = copy(quota), ruleBefore = f.s.farms[0].cropKg;
  Production.reserveMunicipalFood(producer, null, quota); Production.reserveMunicipalFood(producer, f.s, quota);
  assert.deepEqual(quota, quotaBefore);
  const allocation = producer.sources[0].municipalFoodAllocation;
  assert.equal(ruleBefore - f.s.farms[0].cropKg, produced + allocation.futureKg);
  assert.equal(allocation.protectedQuotaId, quota.id);
});

test('arable terrain and hunting-outpost labels alone do not manufacture farms or beast meat for the exchange', () => {
  const profile = Market.profile('a', { foundations: [{ city: { id: 'a' }, arableLandBand: 'abundant', primaryExploitation: { id: 'ferrousOre' } }],
    satellites: [{ id: 'hunt', parentId: 'a', function: 'hunting', exportResource: { id: 'biologicalProductivity' }, logistics: { vehicleMode: 'groundConvoy' } }] }, null, []);
  assert.equal(profile.productionSources.some(s => s.family === 'biologicalProductivity'), false);
});

test('generated original city coverage distinguishes real agricultural routes from delivery-dependent accounts after paid recovery', () => {
  const counts = { cities: 0, farms: 0, deliveries: 0, unresolved: 0 };
  for (const seed of ['charter-foundation']) {
    const map = Library.createWorld({ id: seed, worldSeed: seed, worldTheme: 'madcap', createdAt: 'test' }).generatedData.strategicMap;
    const pristine = JSON.stringify(map);
    for (const city of map.strategicPlayableSettlementState.cityRows.filter(c => c.physicalJurisdictionExists)) {
      counts.cities++; let source = Rule.sourceFromWorld(map, city.cityId, { politicalSettlement: true });
      if (!source) {
        const s = Recovery.create(Recovery.sourceFromWorld(map, city.cityId), { worldId: seed, runId: 'run' }, 0);
        if (!s) { counts.unresolved++; continue; }
        const c = { alive: true, capable: true, local: true, atCounter: true, clerkPresent: true, free: true, permission: true,
          sourceCurrent: true, authority: true, worksAvailable: true, defenseAvailable: true, cityId: city.cityId, bodyEpoch: 0 };
        const stacks = Recovery.KEYS.map(key => ({ id: `original:${key}`, key, quantity: 1000000, carriedBy: 'scientist' })); let at = 0;
        while (s.completed.length < s.source.projects.length) {
          for (const key of Recovery.KEYS) Recovery.stage(s, c, stacks, key, at);
          assert(Recovery.begin(s, c, at)); at += s.job.seconds; assert(Recovery.advance(s, c, at));
        }
        source = Rule.sourceFromWorld(Recovery.projectMap(map, s, s), city.cityId, { politicalSettlement: true });
      }
      if (!source) { counts.unresolved++; continue; }
      assert(Rule.validSource(source)); counts[source.farms.length ? 'farms' : 'deliveries']++;
    }
    assert.equal(JSON.stringify(map), pristine);
  }
  assert(counts.cities >= 14); assert(counts.farms > 0);
  assert.equal(counts.farms + counts.deliveries + counts.unresolved, counts.cities);
  console.log('Original generated food coverage (operating sources, not played domination):', counts);
});
