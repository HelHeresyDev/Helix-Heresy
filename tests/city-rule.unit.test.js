const { test } = require('node:test');
const assert = require('node:assert/strict');
const Rule = require('../city-rule');
const Provisioning = require('../city-provisioning');
const Defense = require('../city-defense');
const Campaign = require('../campaign');
const World = require('../strategic-world');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const institutions = Rule.ROLES.map(role => ({ role, id: role }));
  const farm = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', institutionId: 'publicWorksAndProvisioning',
    populationSourceId: 'population:a', cityPopulation: 3000, satelliteId: 'farm:a', satelliteName: 'Original farm',
    satellitePopulation: 600, cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002',
    arableLandBand: 'productive', storageDays: 3, distanceKm: 5, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const people = Rule.ROLES.map(role => ({ id: `${role}:person`, institutionId: role, roles: [role], status: 'alive', health: 100,
    stamina: 80, workSeconds: 3600, exceptionalCapabilities: role === 'militaryDefenseCommand' ? ['city-scale ward defense'] : [] }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'terms' }));
  const succession = { source: { cityId: 'a', charterId: 'charter:a' }, officeId: 'office:a', leaders: people.slice(0, -1),
    handover: { id: 'handover:a', termsId: 'terms', bodyEpoch: 0 }, agreements,
    control: { recognizedAuthorityId: 'scientist', sourceReceiptId: 'handover:a', bodyEpoch: 0, commandRelationships: copy(agreements) } };
  const office = { id: 'office:a', cityId: 'a' }, run = { worldId: 'w', runId: 'r' };
  const p = Provisioning.create(farm, succession, office, run, 0);
  const d = Defense.create({ cityId: 'a', charterId: 'charter:a', institutionId: 'militaryDefenseCommand',
    populationSourceId: 'population:a', population: 3000, condition: 80, installationId: 'original-approach', baselineEnergy: 69120 },
  succession, people.at(-1), office, run, 0, 80);
  const source = { cityId: 'a', cityName: 'Aster', charterId: 'charter:a', populationSourceId: 'population:a', population: 3000,
    institutions, worksId: 'original-water-walls', powerId: 'original-power', reserveDays: 4, farms: [farm] };
  const s = Rule.create(source, succession, p, d, run, 0);
  const c = { alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true,
    sourceCurrent: true, bodyEpoch: 0, institutionsAvailable: true, coverageVerified: true,
    counterpower: 'noEstablishedChallenge', pilotSupplied: true, pilotDefended: true, defenseAvailable: true, routes: { 'farm:a': true } };
  return { s, source, succession, people, c, p, d, at: 0 };
}
function tick(f, seconds) { f.at += seconds; Rule.advance(f.s, f.succession, f.people, () => f.c, f.at); }
function order(f) { assert.equal(Rule.order(f.s, f.succession, f.people, f.c, f.at), true); }
function establish(f) { order(f); tick(f, 3600 + Rule.INTERVAL); assert.equal(f.s.status, 'established'); }
function receive(f) { return Rule.receive(f.s, f.succession, f.people, f.c, f.at); }

test('generated city, institution, capability-site and decoded agricultural route records supply the aggregate adapter without changing the reusable world', () => {
  const map = World.createStrategicMap('city-rule-source', { refinementLevel: 1, radiusKm: 100 });
  const cityIndex = 0, farmIndex = World.topologyForMap(map).neighbors[cityIndex][0];
  const cityCell = World.cellId(cityIndex), farmCell = World.cellId(farmIndex);
  map.humanGeography = { cities: [{ id: 'a', name: 'Aster', cellId: cityCell }] };
  map.publicSettlementDirectory = { strongholdCodes: [], foundationRows: [], satelliteCodes: [`c000${farmIndex.toString(36).padStart(3, '0')}012z00100`],
    satelliteRoutePaths: [`${farmIndex.toString(36)}.${cityIndex.toString(36)}`], cellFeatures: [] };
  map.routeGraph = { routes: [] };
  map.cityGovernments = { governments: [{ cityId: 'a', charter: { id: 'charter:a' },
    roleAssignments: Object.fromEntries(Rule.ROLES.map(r => [r, r])),
    institutions: Rule.ROLES.map(id => ({ id, capacityBand: 'functional' })) }] };
  map.strategicCivicHistory = { currentInstitutionRows: Rule.ROLES.map(institutionId => ({ institutionId,
    actualControlStatus: 'localCharter', operationalStatus: 'operational', currentCapacityBand: 'functional' })) };
  map.strategicPoliticalHistory = { currentControlRows: [{ cityId: 'a', controlStatus: 'sovereign', recognizedAuthorityId: 'original-ruler',
    sovereignPolityId: 'polity:a', effectiveControllerPolityId: 'polity:a' }] };
  map.strategicPlayableSettlementState = { cityRows: [{ cityId: 'a', assetId: 'population:a', name: 'Aster', cellId: cityCell,
    currentPopulation: 3000, physicalJurisdictionExists: true, physicalCondition: 'intact', services: { provisioning: 'functional', transport: 'functional', fortifications: 'functional' } }],
    satelliteRows: [{ assetId: 'satellite:c:0:0', parentId: 'a', function: 'agriculture', currentPopulation: 600,
      physicalCondition: 'intact', localRouteUsable: true, services: { provisioning: 'functional', transport: 'functional' } }] };
  map.strategicCapabilityHistory = { milestoneRows: ['fortifiedWorks', 'powerWorks'].map(fn => ({ infrastructureRows: [
    { id: `original:${fn}`, cityId: 'a', function: fn, operationalAtPlayableYear: true, hiddenConditionBand: 'serviceable' }
  ] })) };
  const before = copy(map), source = Rule.sourceFromWorld(map, 'a');
  assert.equal(source.population, 3000); assert.equal(source.reserveDays, 4); assert.equal(source.farms.length, 1);
  assert.equal(source.farms[0].satelliteId, 'satellite:c:0:0'); assert.ok(Rule.validSource(source));
  assert.deepEqual(Provisioning.sourceFromWorld(map, 'a', true), [Provisioning.sourceFromWorld(map, 'a')]);
  assert.deepEqual(map, before);
  map.strategicPoliticalHistory.currentControlRows[0].controlStatus = 'puppet';
  assert.equal(Rule.sourceFromWorld(map, 'a'), null);
  map.strategicPoliticalHistory.currentControlRows[0].controlStatus = 'sovereign';
  map.strategicCapabilityHistory.milestoneRows[1].infrastructureRows[0].operationalAtPlayableYear = false;
  assert.equal(Rule.sourceFromWorld(map, 'a'), null);
});

test('finite city allocations partition detailed food, farm, driver, truck and ward power instead of copying them', () => {
  const f = fixture(); assert.ok(f.s); assert.equal(f.s.population + f.p.demand.population, 3000);
  assert.equal(f.s.foodKg + f.p.stores.cityKg, 3000);
  assert.equal(f.s.initialEnergy + f.d.initialEnergy, f.source.reserveDays * Rule.DAY * 3);
  assert.equal(f.s.farms[0].drivers + 1, 6); assert.equal(f.s.farms[0].excludedPilotId, f.p.id);
  const before = copy([f.p, f.d, f.source, f.succession]); tick(f, 3600);
  assert.deepEqual([f.p, f.d, f.source, f.succession], before);
});
test('source adapter requires original operational city-wide sites and current institutions, not service bands alone', () => {
  const f = fixture();
  // Farm selection uses the existing validated measured-route adapter. A map
  // with only functional labels cannot supply a city-wide operating account.
  const map = { strategicPlayableSettlementState: { cityRows: [{ cityId: 'a', physicalJurisdictionExists: true,
    currentPopulation: 3000, physicalCondition: 'intact', services: { provisioning: 'strong', fortifications: 'strong' } }] },
    cityGovernments: { governments: [{ cityId: 'a', institutions: f.source.institutions }] } };
  const before = copy(map); assert.equal(Rule.sourceFromWorld(map, 'a'), null); assert.deepEqual(map, before);
  for (const mutate of [f => f.source.farms = [], f => f.source.institutions.pop(), f => f.source.reserveDays = 99,
    f => f.p.runId = 'other', f => f.d.handoverId = 'other', f => f.source.population++, f => f.source.farms.push(copy(f.source.farms[0]))]) {
    const f = fixture(); mutate(f); assert.equal(Rule.create(f.source, f.succession, f.p, f.d, { worldId: 'w', runId: 'r' }, 0), null);
  }
});
test('signatures and issued orders are not completed governing work; reception never advances the timer', () => {
  const f = fixture(); order(f); assert.equal(receive(f), true); const before = f.s.lastAt;
  assert.equal(f.s.since, null); assert.equal(f.s.accomplishment, null); assert.equal(f.s.lastAt, before);
  tick(f, 3599); assert.equal(f.s.receipts.length, 0); assert.equal(f.s.since, null);
  tick(f, 1); assert.equal(f.s.receipts[0].workSeconds, 3600); assert.equal(f.s.operatorWorkSeconds, 7 * 3600);
  assert.equal(f.s.since, 3600); assert.equal(Rule.order(f.s, f.succession, f.people, f.c, f.at), false);
});
test('actual original relationships, body and sources gate commands, not a new ceremony', () => {
  for (const mutate of [f => f.c.bodyEpoch++, f => f.c.sourceCurrent = false, f => f.c.atCounter = false,
    f => f.c.reportersPresent = false, f => f.c.violence = true, f => f.c.institutionsAvailable = false,
    f => f.succession.control.commandRelationships.pop(), f => f.succession.agreements[0].suspendedRoles = ['centralAdministration'],
    f => f.people[0].status = 'dead', f => f.c.incapacitatedIds = [f.people[0].id], f => f.s.operatorWorkSeconds = 0]) {
    const f = fixture(); mutate(f); assert.equal(Rule.order(f.s, f.succession, f.people, f.c, 0), false);
  }
});
test('finite source-backed food, water and logistics sustain exactly three days without an attack or permanent defender watch', () => {
  const f = fixture(); order(f); tick(f, 3600 + Rule.INTERVAL - 1); assert.equal(f.s.status, 'limited');
  assert.equal(f.s.accomplishment, null); tick(f, 1); assert.equal(f.s.status, 'established');
  assert.equal(f.s.accomplishment.at, 3600 + Rule.INTERVAL); assert.equal(f.s.accomplishment.since, 3600);
  assert.ok(f.s.receipts.some(r => r.kind === 'grainDelivered')); assert.ok(f.s.waterLiters > 0); assert.ok(f.s.foodKg > 0);
  assert.equal(f.people.at(-1).workSeconds, 3600); assert.equal(f.s.report, null);
});
test('all aggregate food, standing crop, fuel, water and power conserve; no midnight reset', () => {
  const f = fixture(); establish(f);
  const farms = f.s.farms;
  assert.ok(Math.abs(f.s.foodKg + f.s.eatenKg - f.s.initialFoodKg - farms.reduce((n, a) => n + a.deliveredKg, 0)) < 1e-6);
  for (const a of farms) {
    assert.ok(Math.abs(a.stockKg + a.cargoKg + a.deliveredKg - a.initialKg - a.harvestedKg) < 1e-6);
    assert.ok(Math.abs(a.cropKg + a.harvestedKg - a.initialCropKg) < 1e-6);
    assert.equal(a.fuelKm + a.spentFuelKm, a.initialFuelKm);
  }
  assert.ok(Math.abs(f.s.waterLiters + f.s.drankLiters - f.s.initialWaterLiters - f.s.pumpedLiters) < 1e-6);
  assert.ok(Math.abs(f.s.rawWaterLiters + f.s.pumpedLiters - f.s.initialRawWaterLiters) < 1e-6);
  assert.ok(Math.abs(f.s.energy + f.s.spentEnergy - f.s.initialEnergy) < 1e-6);
});
test('the real detailed quota and physically serviced original station can support the same three-day city window without replenishment injection', () => {
  const f = fixture(), defender = f.people.at(-1), office = { id: 'office:a', cityId: 'a' };
  const pc = { ...f.c, workerPresent: true, worksCurrent: true, depotAvailable: true, routeUsable: true,
    productionAvailable: true, reportAllowed: true, atDepot: true };
  const dc = { ...f.c, atStation: true, defenderPresent: true, installationPresent: true, condition: 80 };
  const stacks = [{ id: 'owned-feedstock', key: 'arcaneFeedstock', quantity: 12, carriedBy: 'scientist' }];
  order(f);
  const target = 3600 + Rule.INTERVAL;
  while (f.at < target) {
    // Real physical-service and delivery model entry points, never setting
    // energy, delivered goods, receipts or success directly.
    if (!f.d.job && f.d.energy < 48000) {
      assert.equal(Defense.inspect(f.d, f.succession, defender, dc, f.at), true);
      assert.equal(Defense.beginService(f.d, f.succession, defender, dc, 'charge', stacks, f.at), true);
    }
    if (!f.p.order && f.p.stores.cityKg < f.p.demand.kgPerDay * 2) {
      assert.equal(Provisioning.inspect(f.p, f.succession, office, pc, f.at), true);
      assert.equal(Provisioning.dispatch(f.p, f.succession, office, f.succession.leaders.at(-1), pc, f.p.quote, f.at), true);
    }
    const journey = f.p.network.journeys.find(j => j.id === f.p.order?.journeyId);
    if (journey?.status === 'stranded') assert.equal(Provisioning.recover(f.p, f.succession, office, pc, f.at), true);
    f.at += Math.min(30, target - f.at);
    Provisioning.advance(f.p, pc, f.at, { move: (a, cell) => { a.mapCell = copy(cell); return true; } });
    Defense.advance(f.d, f.succession, defender, () => dc, f.at, { stacks: () => stacks });
    f.c.pilotSupplied = f.p.stores.cityKg > 0; f.c.pilotDefended = f.d.energy > 0;
    Rule.advance(f.s, f.succession, f.people, () => f.c, f.at);
  }
  assert.equal(f.s.status, 'established'); assert.equal(f.p.demand.unmetKg, 0);
  assert.ok(f.p.receipts.length > 0); assert.ok(f.d.receipts.length > 0);
  assert.equal(12 - stacks[0].quantity, f.d.receipts.length); assert.ok(defender.workSeconds < 3600);
  assert.ok(f.p.vehicle.fuelKm < 600); assert.ok(f.s.energy > 0);
});
test('actual authority, supply, capable threat and defensive failures break the contiguous interval', () => {
  for (const mutate of [f => f.c.pilotSupplied = false, f => f.c.pilotDefended = false,
    f => f.c.defenseAvailable = false, f => f.c.counterpower = 'capableOpposition',
    f => f.succession.agreements[0].suspendedRoles = ['centralAdministration'], f => f.s.foodKg = 0,
    f => f.s.waterLiters = 0, f => f.s.energy = 0]) {
    const f = fixture(); order(f); tick(f, Rule.DAY); assert.equal(f.s.since, 3600);
    mutate(f); tick(f, 0); assert.equal(f.s.since, null); assert.equal(f.s.status, 'contested'); assert.equal(f.s.accomplishment, null);
  }
});
test('missing evidence does not fail actual government; missing canonical coverage cannot become a success', () => {
  const f = fixture(); order(f); tick(f, Rule.DAY); f.c.reportersPresent = false;
  assert.equal(receive(f), false); assert.equal(f.s.since, 3600); tick(f, 3600 + Rule.INTERVAL - f.at);
  assert.equal(f.s.status, 'established'); assert.equal(f.s.report, null);
  const g = fixture(); order(g); tick(g, Rule.DAY); g.c.coverageVerified = false; tick(g, 60);
  assert.equal(g.s.status, 'unverified'); assert.equal(g.s.failureAt, null); assert.equal(g.s.since, null);
  g.c.coverageVerified = true; tick(g, 0); assert.equal(g.s.since, g.at);
  delete g.c.counterpower; tick(g, 0); assert.equal(g.s.status, 'unverified'); assert.equal(g.s.since, null);
});
test('obstructed original routes hold original cargo and cannot deliver remotely or spawn replacement convoys', () => {
  const f = fixture(); order(f); tick(f, 3600); assert.ok(f.s.farms[0].trip);
  const cargo = f.s.farms[0].cargoKg, drivers = f.s.farms[0].drivers;
  f.c.routes['farm:a'] = false; tick(f, Rule.DAY); assert.equal(f.s.farms[0].cargoKg, cargo);
  assert.equal(f.s.farms[0].deliveredKg, 0); assert.equal(f.s.farms[0].drivers, drivers);
  f.c.routes['farm:a'] = true; tick(f, 3600); assert.ok(f.s.farms[0].deliveredKg >= cargo);
});
test('shortages and finite municipal ward power can end current control without erasing a once-only accomplishment', () => {
  const f = fixture(); establish(f); assert.equal(receive(f), true); const dated = copy(f.s.report), history = copy(f.s.accomplishment);
  tick(f, 2 * Rule.DAY); assert.equal(f.s.status, 'contested'); assert.equal(f.s.energy, 0);
  assert.equal(f.s.since, null); assert.deepEqual(f.s.accomplishment, history); assert.deepEqual(f.s.report, dated);
  assert.equal(receive(f), true); assert.equal(f.s.report.status, 'contested'); assert.deepEqual(f.s.report.accomplishment, history);
});
test('independent property, courts, worship, divine hostility or silence are not overthrow capability', () => {
  const f = fixture(); f.c.privateDissent = true; f.c.godHostile = true; f.c.divineEndorsement = false;
  f.c.independentCourts = true; f.c.independentProperty = true; establish(f);
  receive(f); assert.match(f.s.report.counterpower, /not proof.*divine acquiescence/);
  assert.equal(JSON.stringify(f.s.report).includes('godHostile'), false);
});
test('save/reload and fine/coarse advancement preserve resources, dated reports and exact qualification', () => {
  const a = fixture(), b = fixture(); order(a); order(b);
  tick(a, 1800); a.s = Rule.normalize(a.s); tick(a, 1800 + Rule.INTERVAL);
  tick(b, 3600 + Rule.INTERVAL); assert.deepEqual(a.s, b.s);
  receive(a); assert.deepEqual(Rule.normalize(a.s), a.s); assert.equal(Rule.normalize(null), null);
  const bad = copy(a.s); bad.energy = -1; assert.equal(Rule.normalize(bad), null);
});
test('irreversible death freezes the account; a fresh same-world run cannot adopt the old allocation', () => {
  const f = fixture(); order(f); tick(f, 60); const before = copy(f.s); f.c.alive = false; tick(f, Rule.INTERVAL);
  assert.deepEqual(f.s, before);
  assert.equal(Rule.create(f.source, f.succession, f.p, f.d, { worldId: 'w', runId: 'new' }, 0), null);
});
test('incommensurate clock chunks preserve governing and delivery dates and conserved totals', () => {
  const a = fixture(), b = fixture(); order(a); order(b); const target = 3600 + Rule.INTERVAL;
  while (a.at < target) tick(a, Math.min(17, target - a.at));
  tick(b, target); assert.equal(a.s.status, b.s.status); assert.equal(a.s.since, b.s.since);
  assert.equal(a.s.accomplishment.at, b.s.accomplishment.at);
  assert.deepEqual(a.s.receipts, b.s.receipts);
  for (const k of ['foodKg', 'waterLiters', 'rawWaterLiters', 'energy', 'eatenKg', 'drankLiters'])
    assert.ok(Math.abs(a.s[k] - b.s[k]) < 1e-6, k);
});
test('campaign records only received three-day city evidence once, independently of laboratory and global ambitions', () => {
  const f = fixture(); establish(f); let campaign = Campaign.normalize(null);
  const outcome = { kind: 'cityRule', known: true, alive: true, established: true, intervalSeconds: Rule.INTERVAL,
    cityId: 'a', sourceId: f.s.id, summary: 'Dated city account' };
  for (const patch of [{ known: false }, { alive: false }, { established: false }, { intervalSeconds: Rule.INTERVAL - 1 }, { cityId: '' }])
    assert.equal(Campaign.record(campaign, { ...outcome, ...patch }, f.at).cityPower.rule, null);
  receive(f); campaign = Campaign.record(campaign, outcome, f.s.report.accomplishment.at);
  assert.deepEqual(Campaign.record(campaign, outcome, f.at + Rule.DAY), campaign);
  assert.equal(campaign.accomplishedAt, null); assert.equal(campaign.worldDomination, undefined); assert.equal(campaign.divineRule, undefined);
  assert.match(Campaign.accomplishments(campaign)[0].label, /subsequently losable/);
});
