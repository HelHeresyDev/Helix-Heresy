const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), D = require('../creature-biology'), W = require('../beast-regional-work');
const { source } = require('./helpers/regional-work-source');
const DAY = P.DAY, binding = { worldId: 'world', runId: 'run' }, copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const region = s => s.regions[0], site = s => region(s).ecology.workSites[0], worker = s => s.groups[0].cohorts[0];
function fixture(action, change = () => {}, count = 1) {
  const src = source(action, count); change(src); const s = P.create(src, binding);
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return s;
}
const engineering = ['tendWetland', 'cultivateReef', 'buildDam', 'growBlooms', 'buildFurnace', 'dreamWeather'];
for (const action of engineering) test(`${action}: actual paid recipe, original worker and channel-specific effects`, () => {
  const s = fixture(action), before = copy(region(s).stocks), recipe = W.spec(action), p = D.lifecycle[worker(s).speciesId];
  P.advance(s, DAY, true, true);
  const r = region(s);
  for (const [key, amount] of Object.entries(recipe.costs)) {
    const maintenance = key === 'waterL' ? p.waterLDay + (action === 'dreamWeather' ? 2 : 0) : key === 'mineralsKg' ? p.mineralsKgDay : key === s.groups[0].resources.foodKg ? p.foodKgDay : 0;
    approx(before[key] - r.stocks[key], amount + maintenance);
  }
  assert.ok(r.ecologicalReceipts[action] > 0);
  for (const [channel] of D.ledgers) {
    const expected = recipe.channels.includes(channel) ? D.rates[worker(s).speciesId].nurturing[D.ledgers.findIndex(([id]) => id === channel)] : 0;
    approx(r.ecologicalAccount.nurturing[channel], expected);
  }
  assert.equal(P.count(worker(s)), 1); assert.ok(P.normalize(s, binding));
});
test('wetland tending requires surviving original wetland substrate and a real water column', () => {
  for (const change of [src => src.regions[0].stocks.wetlandBedKg = 0, src => src.regions[0].stocks.waterL = 0]) {
    const s = fixture('tendWetland', change); P.advance(s, DAY, true, true);
    assert.equal(region(s).outputs?.plantNutrientsKg || 0, 0); assert.equal(region(s).ecologicalAccount.nurturing.wetlandReefHabitat, 0);
  }
});
test('reef growth retains paid calcium/organic matter as finite living substrate, not generic food or ore', () => {
  const s = fixture('cultivateReef'), r = region(s); P.advance(s, DAY, true, true);
  approx(r.stocks.livingReefKg, 125); approx(r.stocks.calciumKg, 980); approx(r.stocks.organicKg, 1e6 - 5);
  assert.equal(r.outputs?.livingReefKg || 0, 0); assert.equal(r.stocks.mineralsKg, 1e6 - 20);
  const absent = fixture('cultivateReef', src => src.regions[0].stocks.livingReefKg = 0);
  P.advance(absent, DAY, true, true); assert.equal(region(absent).stocks.livingReefKg, 0);
});
test('receiving growth capacity stops further unpaid/unsupported reef and bloom production exactly', () => {
  for (const [action, key, daily] of [['cultivateReef', 'livingReefKg', 25], ['growBlooms', 'bloomKg', 2]]) {
    const s = fixture(action, src => src.regions[0].capacity[key] = 100 + daily / 2);
    P.advance(s, 2 * DAY, true, true); approx(region(s).stocks[key], 100 + daily / 2);
    approx(region(s).ecologicalReceipts[action], .5); assert.ok(P.normalize(s));
  }
});
test('blooms consume actual carrion once, retain plant water and stop outside their original season', () => {
  const s = fixture('growBlooms'), r = region(s); P.advance(s, DAY, true, true);
  approx(r.stocks.carrionKg, 98); approx(r.stocks.bloomKg, 102); approx(r.outputs.waterInPlantsKg, 1);
  const winter = fixture('growBlooms', src => src.regions[0].ecology.workSites[0].phases = [1]);
  P.advance(winter, DAY, true, true); assert.equal(region(winter).stocks.carrionKg, 100);
  const empty = fixture('growBlooms', src => src.regions[0].stocks.carrionKg = 0);
  P.advance(empty, DAY, true, true); assert.equal(region(empty).stocks.bloomKg, 100);
});
test('only original same-colony adult workers build a furnace; colony output is counted once', () => {
  const s = fixture('buildFurnace', () => {}, 100000); P.advance(s, DAY, true, true);
  approx(site(s).furnaceKg, 1); // Finite receiving structure, not an extra per-colony bonus.
  approx(region(s).stocks.metalKg, .5); approx(region(s).stocks.fuelKg, .5);
  for (const change of [src => src.groups[0].cohorts[0].role = 'male', src => src.groups[0].cohorts[0].colonyId = 'other-colony',
    src => src.regions[0].ecology.workSites[0].oxygen = false, src => src.regions[0].ecology.workSites[0].waterDepthM = 1]) {
    const blocked = fixture('buildFurnace', change); P.advance(blocked, DAY, true, true); assert.equal(site(blocked).furnaceKg, 0);
  }
});
test('dream weather requires the actual present willing sleepers and never grants blanket consent', () => {
  for (const change of [src => src.groups[1].activityState.dreamConsent = false,
    src => src.groups[1].activityState.sleeping = false, src => src.groups[1].regionId = 'downstream',
    src => src.groups[1].cohorts[0].count = 0, src => src.groups[0].activityState.sleeping = false,
    src => src.groups[0].willing = false]) {
    const s = fixture('dreamWeather', change); P.advance(s, DAY, true, true);
    assert.equal(region(s).ecologicalReceipts?.dreamWeather || 0, 0); assert.equal(region(s).stocks.atmosphericWaterL, 1e5);
  }
});
test('withdrawing a known original sleeper interrupts only future rain and preserves spent mana/water through reload', () => {
  const s = fixture('dreamWeather'); P.advance(s, DAY / 2, true, true);
  approx(region(s).stocks.atmosphericWaterL, 1e5 - 500); approx(region(s).activityReceipts.excessMana, 10);
  assert.ok(P.setEcologicalActivity(s, 'original-sleepers', { sleeping: true, dreamConsent: false }, s.clock, 'original-sleeper-refused'));
  const saved = P.normalize(s); assert.ok(saved);
  P.advance(s, 2 * DAY, true, true); P.advance(saved, 2 * DAY, true, true);
  approx(region(s).stocks.atmosphericWaterL, 1e5 - 500); approx(region(s).activityReceipts.excessMana, 10);
  assert.deepEqual(region(s), region(saved));
});
test('mana filtration uses the one actual physiological intake bill, not full daily potential or a new mana reserve', () => {
  const s = fixture('filterMana'), r = region(s); P.advance(s, DAY, true, true);
  approx(r.stocks.excessMana, 10000 - 60); approx(r.activityReceipts.excessMana, 60);
  approx(r.ecologicalAccount.nurturing.arcaneStability, 3 * 60 / DAY);
  approx(r.ecologicalAccount.destruction.arcaneStability, .3 * 60 / DAY);
  assert.equal(worker(s).mana, undefined); assert.ok(P.normalize(s));
  const absent = fixture('filterMana', src => src.regions[0].stocks.excessMana = 0);
  P.advance(absent, DAY, true, true); assert.equal(region(absent).ecologicalAccount.nurturing.arcaneStability, 0);
});
test('dam construction redirects one finite original flow while downstream consumers see only the passed amount', () => {
  const s = fixture('buildDam'), r = region(s), down = s.regions[1], before = r.stocks.waterL, downBefore = down.stocks.waterL;
  P.advance(s, DAY, true, true);
  approx(r.stocks.flowWaterL, 7000); approx(r.stocks.waterL - before, 1000);
  approx(down.stocks.waterL - downBefore, 2000); approx(site(s).damKg, 100);
  approx(r.watercourseReceipts.retainedL, 1000); approx(r.watercourseReceipts.passedL, 2000);
  assert.ok(P.normalize(s));
});
test('full upstream banks spill actual captured water downstream; downstream overflow can cause real flooding', () => {
  const s = fixture('buildDam', src => {
    src.regions[0].capacity.waterL = src.regions[0].stocks.waterL + 500;
    src.regions[1].capacity.waterL = src.regions[1].stocks.waterL; src.regions[1].ecology.floodable = true;
  });
  P.advance(s, DAY, true, true);
  approx(region(s).stocks.waterL, 1e10 + 500); approx(region(s).watercourseReceipts.retainedL, 500);
  approx(region(s).watercourseReceipts.spilledL, 500);
  assert.ok(s.regions[1].condition.soilCover < 80); assert.ok(P.normalize(s));
});
test('constructed dams retain physical hydraulic effects after their original builder is lost, without ongoing work credit', () => {
  const s = fixture('buildDam'); P.advance(s, DAY, true, true);
  P.kill(s, 'worker', 'original-workers', 0, s.clock, 'actual-builder-killed');
  P.advance(s, 2 * DAY, true, true); approx(region(s).watercourseReceipts.retainedL, 2000);
  approx(region(s).ecologicalReceipts.buildDam, 1); assert.equal(P.audit(s)['original-population'].dead, 1);
});
test('plankton filtration charges one shared food intake and surviving towers scale food and ecological throughput once', () => {
  const s = fixture('filterPlankton'), r = region(s); P.advance(s, DAY, true, true);
  approx(r.stocks.planktonKg, 960000); approx(r.ecologicalAccount.nurturing.wetlandReefHabitat, 50);
  assert.ok(P.damageFeedingTower(s, 'worker', 'original-workers', 0, 100, s.clock, 'original-tower-hit'));
  assert.ok(P.damageFeedingTower(s, 'worker', 'original-workers', 1, 100, s.clock, 'second-original-tower-hit'));
  P.advance(s, 2 * DAY, true, true);
  approx(r.stocks.planktonKg, 940000); approx(r.ecologicalAccount.nurturing.wetlandReefHabitat, 75);
  assert.deepEqual(worker(s).feedingTowers, [0, 0, 100, 100]); assert.ok(P.normalize(s));
});
test('destroyed feeding structures and marine-medium loss cannot be repaired by elapsed age or freshwater', () => {
  for (const change of [src => src.groups[0].cohorts[0].feedingTowers = [0, 0, 0, 0],
    src => src.regions[0].stocks.seawaterL = 0]) {
    const s = fixture('filterPlankton', change), before = region(s).stocks.planktonKg;
    P.advance(s, DAY, true, true); assert.equal(region(s).stocks.planktonKg, before);
    assert.equal(region(s).ecologicalAccount.nurturing.wetlandReefHabitat, 0);
  }
});
test('an exactly supported marine column permits filtration without requiring or consuming extra seawater', () => {
  const s = fixture('filterPlankton', src => {
    const r = src.regions[0], w = r.ecology.workSites[0].water;
    r.stocks.seawaterL = w.areaM2 * w.minDepthM * 1000;
  }), r = region(s), water = r.stocks.seawaterL;
  assert.equal(worker(s).intake.foodKg, 1);
  P.advance(s, DAY, true, true); approx(r.stocks.seawaterL, water);
  approx(r.stocks.planktonKg, 960000); assert.ok(P.normalize(s));
  P.removeStock(s, r.id, 'seawaterL', 1, s.clock, 'actual-loss-below-minimum-depth');
  assert.equal(worker(s).intake.foodKg, 0);
  const plankton = r.stocks.planktonKg; P.advance(s, 2 * DAY, true, true);
  assert.equal(r.stocks.planktonKg, plankton); assert.ok(P.normalize(s));
});
test('malformed medium, non-original sleepers, wrong colonies and cyclic/remote watercourses are rejected', () => {
  for (const [action, change] of [['cultivateReef', src => src.regions[0].ecology.workSites[0].water.stockKey = 'waterL'],
    ['dreamWeather', src => src.regions[0].ecology.workSites[0].participantGroupIds = ['invented-sleeper']],
    ['filterPlankton', src => delete src.groups[0].cohorts[0].feedingTowers],
    ['buildDam', src => src.regions[0].ecology.watercourses[0].downstreamRegionId = 'invisible-distant-sea'],
    ['buildDam', src => src.regions[1].ecology.watercourses = [{ id: 'cycle', sourceKey: 'flowWaterL', flowPerDay: 1000, downstreamRegionId: 'workface' }]]])
    assert.throws(() => fixture(action, change));
});
test('multiple original worker cohorts share one structure receiving limit, rather than each using the whole remaining space', () => {
  const s = fixture('buildFurnace', src => {
    const original = src.groups[0].cohorts[0]; original.count = 50000;
    src.groups[0].cohorts.push({ ...copy(original), id: 'second-original-workers' });
  }, 100000);
  P.advance(s, DAY, true, true); approx(site(s).furnaceKg, 1);
  approx(region(s).stocks.metalKg, .5); assert.ok(P.normalize(s));
});
test('actual water-column depletion stops tending at its geometric boundary, without a delayed restoration bill', () => {
  const s = fixture('tendWetland', src => src.regions[0].stocks.waterL = 150000000 + 1);
  P.advance(s, 2 * DAY, true, true); approx(region(s).ecologicalReceipts.tendWetland, .5);
  approx(region(s).outputs.plantNutrientsKg, .05); assert.ok(P.normalize(s));
});
test('finite flow caps paid dam work and depletion stops both diversion and work rather than creating a river', () => {
  const s = fixture('buildDam', src => src.regions[0].stocks.flowWaterL = 500);
  P.advance(s, DAY, true, true); approx(region(s).stocks.flowWaterL, 0);
  approx(site(s).damKg, 100 / 6); approx(region(s).watercourseReceipts.retainedL, 1000 / 6);
  approx(region(s).watercourseReceipts.passedL, 2000 / 6);
  const none = fixture('buildDam', src => src.regions[0].stocks.flowWaterL = 0);
  P.advance(none, DAY, true, true); approx(site(none).damKg, 0);
  assert.equal(region(none).ecologicalAccount.nurturing.freshwaterQuantity, 0);
});
test('downstream maintenance cannot spend the water that a paid upstream dam actually retained', () => {
  const s = fixture('buildDam', src => {
    src.regions[0].ecology.watercourses[0].flowPerDay = 1000;
    src.regions[1].stocks.waterL = 0; src.regions[1].edges = [];
    const speciesId = 'beast:mire-choir';
    src.groups.push({ id: 'downstream-drinker', populationId: 'downstream-originals', speciesId, regionId: 'downstream',
      resources: { foodKg: 'forageKg' }, cohorts: [{ id: 'downstream-body', speciesId, count: 1, ageDays: D.lifecycle[speciesId].adultDays, massKg: 60 }] });
  });
  const reserve = s.groups[1].cohorts[0].stores.waterL;
  P.advance(s, DAY, true, true); assert.equal(s.regions[1].stocks.waterL, 0);
  assert.ok(s.groups[1].cohorts[0].stores.waterL < .001);
  approx(s.regions[1].outputs.waterVaporKg + s.groups[1].cohorts[0].stores.waterL, reserve);
  assert.equal(s.groups[1].observedShortage, true); assert.ok(P.normalize(s));
});
test('direct users of a scarce original flow reduce the paid engineering budget as well as the passed water', () => {
  const s = fixture('buildDam', src => {
    src.regions[0].stocks.flowWaterL = 0; src.regions[0].renewalPerDay.flowWaterL = 100;
    const speciesId = 'beast:mire-choir';
    src.groups.push({ id: 'actual-flow-drinker', populationId: 'flow-drinker', speciesId, regionId: 'workface',
      resources: { foodKg: 'forageKg', waterL: 'flowWaterL' },
      cohorts: [{ id: 'original-flow-drinker', speciesId, count: 1, ageDays: D.lifecycle[speciesId].adultDays, massKg: 60 }] });
  });
  const job = s.extraRates.find(q => q.action === 'buildDam'), flow = s.rates.workface.watercourse;
  assert.ok(flow.retainedPerDay < 100);
  approx(job.perDay * job.factor * 1000, flow.retainedPerDay);
  approx(job.inputs.constructionKg, job.perDay * 100);
});
test('dam breach moves only surviving tagged water and actual structure debris, once, without replacing the builder/site', () => {
  const s = fixture('buildDam'); P.advance(s, DAY, true, true);
  const upstream = region(s).stocks.waterL, downstream = s.regions[1].stocks.waterL;
  approx(region(s).retainedWaterL, 1000);
  assert.ok(P.destroyEcologicalWorkSite(s, 'workface', 'original-work-site', s.clock, 'actual-dam-breach'));
  approx(region(s).stocks.waterL, upstream - 1000); approx(s.regions[1].stocks.waterL, downstream + 1000);
  approx(region(s).outputs['destroyedWorkSite:damKg'], 100); approx(region(s).retainedWaterL, 0);
  assert.equal(P.destroyEcologicalWorkSite(s, 'workface', 'original-work-site', s.clock, 'duplicate-breach'), false);
  P.advance(s, 2 * DAY, true, true); approx(region(s).ecologicalReceipts.buildDam, 1);
  approx(region(s).watercourseReceipts.releasedL, 1000); assert.ok(P.normalize(s));
  const spent = fixture('buildDam'); P.advance(spent, DAY, true, true);
  P.removeStock(spent, 'workface', 'waterL', 1000, spent.clock, 'actual-use-of-retained-water');
  P.destroyEcologicalWorkSite(spent, 'workface', 'original-work-site', spent.clock, 'spent-pond-breach');
  approx(region(spent).watercourseReceipts.releasedL || 0, 0);
});
test('paid original bed destruction preserves its real material as debris and does not automatically regrow it', () => {
  const s = fixture('cultivateReef'); P.advance(s, DAY, true, true);
  P.destroyEcologicalWorkSite(s, 'workface', 'original-work-site', s.clock, 'original-reef-bed-destroyed');
  approx(region(s).stocks.livingReefKg, 0); approx(region(s).outputs['destroyedWorkSite:livingReefKg'], 125);
  assert.equal(region(s).exhausted, false);
  P.advance(s, 3 * DAY, true, true); approx(region(s).stocks.livingReefKg, 0);
  assert.ok(region(s).ecologicalAccount.sourceLosses.some(loss => loss.kind === 'workSite')); assert.ok(P.normalize(s));
});
test('a real breach after a paid downstream nurturer loss classifies accumulated exhausted damage at the event, not the next day', () => {
  const s = fixture('buildDam', src => {
    const down = src.regions[1], speciesId = 'beast:mire-choir';
    down.capacity.waterL = down.stocks.waterL + 1998; down.ecology.floodable = true; down.ecology.viabilityFloors.soilCover = 79.95;
    down.ecology.workSites.push({ id: 'original-downstream-wetland', action: 'tendWetland', speciesId, areaHa: down.areaHa, maxWorkers: 1,
      water: { stockKey: 'waterL', areaM2: 100000, minDepthM: 1.5 } });
    src.groups.push({ id: 'original-downstream-nurturer', populationId: 'downstream-nurturer', speciesId, regionId: down.id,
      resources: { foodKg: 'forageKg' }, ecology: { action: 'tendWetland', siteId: 'original-downstream-wetland', regionId: down.id, effortFraction: 1 },
      cohorts: [{ id: 'original-downstream-body', speciesId, count: 1, ageDays: D.lifecycle[speciesId].adultDays, massKg: 60 }] });
  });
  P.advance(s, DAY, true, true);
  P.kill(s, 'original-downstream-nurturer', 'original-downstream-body', 0, s.clock, 'actual-wetland-defender-loss');
  assert.equal(s.regions[1].exhausted, false);
  P.destroyEcologicalWorkSite(s, 'workface', 'original-work-site', s.clock, 'actual-structure-breach');
  assert.equal(s.regions[1].exhausted, true);
  assert.equal(s.regions[1].ecologicalAccount.episodes[0].exhaustedAt, s.clock); assert.ok(P.normalize(s));
});
test('different tower injuries cannot be averaged into repaired structures when cohorts compact', () => {
  const G = require('../beast-demography'), s = fixture('filterPlankton', () => {}, 2), c = worker(s), other = copy(c);
  c.generated = other.generated = true; c.ranges = [[0, 1]]; other.ranges = [[1, 2]]; other.id = 'other-original';
  other.feedingTowers = [0, 0, 100, 100]; s.groups[0].cohorts.push(other);
  G.compact(s.groups[0], DAY); assert.equal(s.groups[0].cohorts.length, 2);
  assert.deepEqual(s.groups[0].cohorts[1].feedingTowers, [0, 0, 100, 100]);
});
test('all eight adapters retain partial work across chunked reads, normalized reload and continued branches; final death freezes work', () => {
  for (const action of [...engineering, 'filterMana', 'filterPlankton']) {
    const original = fixture(action), chunked = fixture(action);
    P.advance(original, 2 * DAY, true, true);
    for (let step = 1; step <= 16; step++) P.advance(chunked, step * DAY / 8, true, true);
    const loaded = P.normalize(chunked, binding); assert.ok(loaded, action);
    for (const r of original.regions) for (const [key, n] of Object.entries(r.stocks)) approx(n, loaded.regions.find(x => x.id === r.id).stocks[key]);
    for (const [key, n] of Object.entries(region(original).ecologicalAccount.nurturing)) approx(n, region(loaded).ecologicalAccount.nurturing[key]);
    const continued = P.rebind(loaded, binding, { ...binding, runId: 'continued' });
    P.advance(continued, 3 * DAY, true, true); P.advance(original, 3 * DAY, true, true);
    for (const [key, n] of Object.entries(region(original).stocks)) approx(n, region(continued).stocks[key]);
    const before = JSON.stringify(continued); P.advance(continued, 10 * DAY, false, true); assert.equal(JSON.stringify(continued), before);
    const fresh = fixture(action); assert.equal(region(fresh).ecologicalReceipts, undefined);
  }
});
test('partial hydraulic/tagged-water and structure state survive a mid-interval save rather than being rebuilt on read', () => {
  const s = fixture('buildDam'); P.advance(s, .375 * DAY, true, true);
  const saved = P.normalize(s); assert.ok(saved);
  const before = JSON.stringify(saved); P.advance(saved, saved.clock, true, true); assert.equal(JSON.stringify(saved), before);
  P.advance(s, 2.5 * DAY, true, true); P.advance(saved, 2.5 * DAY, true, true);
  approx(region(s).retainedWaterL, region(saved).retainedWaterL); approx(site(s).damKg, site(saved).damKg);
  const invalid = copy(saved); invalid.rates.workface.watercourse.retainedPerDay = -1; assert.equal(P.normalize(invalid), null);
  const repaired = copy(saved); repaired.groups[0].cohorts[0].feedingTowers = [100, 100, 100, 100]; assert.equal(P.normalize(repaired), null);
});
test('a million independently counted members still use cohort/site work, not a per-animal ecological loop', () => {
  const run = n => {
    const s = fixture('tendWetland', src => {
      for (const r of src.regions) {
        r.areaHa *= n;
        for (const k of Object.keys(r.stocks)) { r.stocks[k] *= n; r.capacity[k] *= n; }
        for (const site of r.ecology.workSites) { site.areaHa *= n; site.water.areaM2 *= n; }
      }
    }, n);
    P.advance(s, 30 * DAY, true, true); assert.ok(P.normalize(s)); return s;
  };
  const small = run(1000), large = run(1000000);
  assert.ok(large.work.cohortIntervals < small.work.cohortIntervals * 3);
  assert.equal(large.groups[0].cohorts.length, 1); assert.ok(JSON.stringify(large).length < 50000);
  assert.ok(region(large).ecologicalAccount.sourceLosses.length <= 1);
});
test('declaring a shallow or tiny water patch cannot bypass the existing species body dimensions', () => {
  for (const change of [src => { const w = src.regions[0].ecology.workSites[0].water; w.minDepthM = 0; src.regions[0].stocks.seawaterL = w.areaM2 * 1000; },
    src => src.regions[0].ecology.workSites[0].water.areaM2 = 1]) {
    const s = fixture('filterPlankton', change); P.advance(s, DAY, true, true);
    assert.equal(region(s).ecologicalAccount.nurturing.wetlandReefHabitat, 0);
    assert.equal(region(s).stocks.planktonKg, 1e6);
  }
});
test('an actual local handoff retains damaged original towers and removes the only body from background filtration', () => {
  const s = fixture('filterPlankton', src => src.groups[0].cohorts[0].feedingTowers = [0, 0, 100, 100]);
  const ctx = { alive: true, local: true, tileSizeM: 10,
    originalPosition: () => ({ regionId: 'workface', cell: { x: 0, y: 0, z: 6 }, mode: 'swimming', altitudeM: -30 }),
    originalReserves: () => ({ mana: 0, stamina: 100, energy: { heatMJ: 0, chargeMJ: 0, focus: 0, crownKg: 0, lightKg: 0 } }),
    terrain: () => ({ floor: true, waterDepthM: 10000, ceilingM: 100000, supportKg: 1e15, oxygen: true }), blocked: () => false };
  const actor = P.claimLocal(s, 'worker', 'original-workers', 0, 'original-local-cathedral', 0, ctx); assert.ok(actor);
  assert.equal(actor.bodyPhysics.parts['feeding tower 1'], 0); assert.equal(actor.bodyPhysics.parts['feeding tower 2'], 0);
  P.advance(s, DAY, true, true); assert.equal(region(s).stocks.planktonKg, 1e6);
  assert.deepEqual(P.audit(s)['original-population'], { background: 0, detailed: 1, dead: 0 }); assert.ok(P.normalize(s));
});
