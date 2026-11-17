const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
const W = require('../strategic-world'), E = require('../strategic-beast-ecology'), D = require('../creature-biology');
const clone = x => JSON.parse(JSON.stringify(x));
const approx = (a, b, relative = 1e-9) => assert.ok(Math.abs(a - b) <= Math.max(1e-8, Math.abs(b) * relative), `${a} != ${b}`);
let cached;
function fixture() {
  if (!cached) {
    const world = L.createWorld({ id: 'habitat-source-world', worldSeed: 'source-small', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
    cached = { world, map, record, source: S.expand(record, map) };
  }
  return cached;
}
function prepared(groups) {
  const f = fixture(), region = clone(f.source.regions.find(r => r.kind === 'surface'));
  // Explicit original finite prepared stocks, not live-game acquisition or an
  // invented renewable meat source. This isolates the resource-feasibility rule.
  region.stocks = Object.fromEntries(S.STOCKS.map(k => [k, 1e9]));
  region.capacity = clone(region.stocks);
  region.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20,
    renewal: Object.fromEntries(S.STOCKS.map(k => [k, 10000])), renewalEP: D.ledgers.map(() => 10000) }));
  const group = (speciesId, id, cohorts) => ({ id, speciesId, populationId: `original:${id}`, regionId: region.id,
    home: { patchId: region.id, cellId: region.cellId, eastKm: 0, northKm: 0, depthM: 0 },
    resources: { foodKg: ['beast:rimefang-pack', 'beast:glasswing-roc'].includes(speciesId) ? 'meatKg'
      : speciesId === 'beast:carrion-lantern' ? 'carrionKg' : 'forageKg' }, cohorts });
  const cohort = (speciesId, id, count, young = false) => ({ id, speciesId, count,
    ageDays: young ? 0 : D.lifecycle[speciesId].fertileDays, massKg: young ? D.lifecycle[speciesId].newbornKg : D.lifecycle[speciesId].adultKg,
    role: young ? 'juvenile' : 'female' });
  return { source: { calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] }, regions: [region], groups: groups(group, cohort) }, map: f.map, region };
}
test('new canonical worlds archive a private, reproducible source proposal without rewriting their ecology', () => {
  const { world, map, record } = fixture();
  assert.equal(S.validate(record, map, world.worldSeed), record);
  assert.equal(L.normalizeWorld(world).canonicalDigest, world.canonicalDigest);
  const before = JSON.stringify(world), again = S.generate(world.worldSeed, map);
  assert.deepEqual(again, record); assert.equal(JSON.stringify(world), before);
  assert.throws(() => S.attach(world.worldSeed, map), /overwrite/);
  assert.doesNotMatch(JSON.stringify(map.publicBeastAtlas || {}), /beast-habitat-source|groupRows|foodAllocations|originalIndividualCount/);
});
test('distributed wildlife markers reproduce new habitats while unmarked archives keep their original source identity', () => {
  const { map, record, source } = fixture(), Wildlife = require('../background-wildlife');
  assert.equal(record.wildlifeDistribution, true);
  assert.equal(record.backgroundWildlife.distribution, 'habitatPatches');
  assert.ok(source.regions.some(r => r.wildlife?.pools.some(p => p.habitatPatch === 'background')));
  const old = S.generate(record.seed, map, { wildlifeDistribution: false }), archived = JSON.stringify(old);
  assert.equal(old.wildlifeDistribution, undefined); assert.equal(old.backgroundWildlife.distribution, undefined);
  assert.deepEqual(old.backgroundWildlife.spatialRows, record.backgroundWildlife.spatialRows);
  S.validate(old, map); const expanded = S.expand(old, map);
  assert.ok(expanded.regions.every(r => !r.wildlife || r.wildlife.pools.every(p => !p.establishedDays && !p.habitatPatch)));
  const account = P.createDiagnostic(expanded, { worldId: 'old-layout', runId: 'original' });
  assert.equal(Wildlife.summary(account).startingDead, 0);
  assert.equal(JSON.stringify(old), archived);
  assert.ok(P.normalize(account));
});
test('new drift records use canonical climate direction while older source records remain unchanged', () => {
  const { source, map, record } = fixture();
  assert.equal(record.windTransport, true);
  assert.ok(source.groups.filter(g => g.speciesId === 'beast:carrion-lantern').every(g => g.windDriven));
  for (const r of source.regions.filter(r => r.kind !== 'subsurface')) {
    const i = W.cellIndex(r.cellId), angle = map.climate.windBearingDeg[i] * Math.PI / 180;
    approx(r.wind.x, Math.sin(angle) * map.climate.windStrengthPermille[i] / 100);
    approx(r.wind.y, Math.cos(angle) * map.climate.windStrengthPermille[i] / 100);
  }
  const legacy = S.generate(record.seed, map, { windTransport: false }), before = JSON.stringify(legacy);
  assert.equal(legacy.windTransport, undefined); S.validate(legacy, map);
  const old = S.expand(legacy, map);
  assert.ok(old.groups.every(g => !g.windDriven)); assert.ok(old.regions.every(r => r.wind == null && r.edges.every(e => !e.windBoundary)));
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(legacy.groupRows, record.groupRows);
});
test('the explicit passive-biology correction preserves old source identities and cannot silently add moisture', () => {
  const { map, record } = fixture();
  const legacy = S.generate(record.seed, map, { lanternMoisture: false });
  legacy.sourceDigest = S.sourceDigest(map, true); legacy.id = '';
  legacy.id = `beast-habitat-source:${W.stableHash(legacy)}`;
  const before = JSON.stringify(legacy); S.validate(legacy, map);
  const source = S.expand(legacy, map);
  assert.equal(JSON.stringify(legacy), before); assert.ok(source.regions.every(r => r.humidity == null));
  const forged = clone(legacy); forged.lanternMoisture = true; forged.id = '';
  forged.id = `beast-habitat-source:${W.stableHash(forged)}`; assert.throws(() => S.validate(forged, map));
});
test('spherical habitat areas cover the actual globe once at the surface, with separate underground volumes', () => {
  const { map, record } = fixture();
  const globe = 4 * Math.PI * map.topology.planetRadiusKm ** 2 * 100;
  approx(record.patchRows.filter(r => r[1] !== 4).reduce((n, r) => n + r[2], 0), globe);
  for (let index = 0; index < map.topology.cellCount; index++) {
    const rows = record.patchRows.filter(r => r[0] === index);
    approx(rows.filter(r => r[1] !== 4).reduce((n, r) => n + r[2], 0), S.cellAreaHa(map, index));
    if (map.surface.classes[index] === 'W') assert.deepEqual(rows.map(r => r[1]), [3]);
    else assert.ok(rows.some(r => r[1] === 4));
  }
});
test('all 24 canonical species remain represented, with original authoritative counts conserved rather than inferred from abundance', () => {
  const { map, record, source } = fixture(), populations = S.populationsFor(map);
  assert.deepEqual(new Set(record.populations.map(p => p.speciesId)), new Set(E.BEAST_SPECIES.map(s => s.id)));
  for (const p of record.populations) {
    const located = source.groups.filter(g => g.populationId === p.populationId).reduce((n, g) => n + g.cohorts.reduce((t, c) => t + c.count, 0), 0);
    assert.equal(located, p.locatedIndividualCount);
    if (p.originalIndividualCount != null) assert.equal(located + p.unlocatedIndividualCount, p.originalIndividualCount);
    if (S.ORIGINAL_COUNTS.includes(p.speciesId)) assert.equal(p.originalIndividualCount, populations.find(r => r.id === p.populationId).devotionalUnitCount);
  }
  const changed = clone(map);
  changed.beastEcology = clone(map.beastEcology || E.expandPristineBeastEcology(map));
  changed.beastEcology.digest = 'prepared-abundance-only-variation';
  changed.beastEcology.populations.forEach(p => p.populationIndex = 999999999);
  assert.deepEqual(S.generate(record.seed, changed, { attempts: 1 }).groupRows,
    S.generate(record.seed, map, { attempts: 1 }).groupRows);
});
test('hives have explicit original queens, males, workers and brood; whole organisms are not multiplied into polyps', () => {
  const { source } = fixture();
  for (const g of source.groups.filter(g => g.speciesId === 'beast:ember-ant')) {
    assert.equal(g.cohorts.find(c => c.role === 'queen').count, 1);
    assert.equal(g.cohorts.find(c => c.role === 'queen').massKg, D.lifecycle[g.speciesId].breederKg);
    assert.equal(g.cohorts.find(c => c.role === 'male').count, 2);
    assert.ok(g.cohorts.filter(c => c.role === 'worker').every(c => c.colonyId === `${g.id}:hive`));
  }
  const cathedrals = source.groups.filter(g => g.speciesId === 'beast:brine-cathedral'); assert.ok(cathedrals.length);
  assert.ok(cathedrals.every(g => g.cohorts.reduce((n, c) => n + c.count, 0) === 1));
  assert.ok(source.groups.every(g => g.cohorts.every(c => Number.isSafeInteger(c.count) && c.count > 0)));
});
test('food, rainfall, salts, heat and loose minerals remain separate finite physical accounts', () => {
  for (const r of fixture().source.regions) {
    assert.equal(r.stocks.meatKg, undefined); assert.equal(r.stocks.carrionKg, undefined);
    assert.equal(r.source.mineralRenewalKg, 0); assert.equal(r.source.meatRenewalKg, 0);
    for (const season of r.seasons) {
      assert.equal(season.renewal.mineralsKg, 0);
      if (r.kind === 'subsurface') {
        assert.equal(season.renewal.forageKg, 0); assert.equal(season.renewal.waterL, 0);
      }
      if (r.kind !== 'waterColumn') approx(season.renewal.waterL + (season.renewal.atmosphericWaterL || 0)
        + (season.renewal.flowWaterL || 0) + season.photosyntheticWaterL, r.source.rainfallLPerDay);
    }
    if (r.kind === 'waterColumn') { assert.equal(r.stocks.waterL, 0); assert.equal(r.source.waterKind, 'seawater'); }
    for (const [key, amount] of Object.entries(r.stocks)) assert.ok(Number.isFinite(amount) && amount >= 0 && amount <= r.capacity[key]);
  }
});
test('source geography uses real realm/depth and species-specific approaches instead of one shared hex granting universal reach', () => {
  const { source, map } = fixture();
  for (const g of source.groups) {
    const s = E.BEAST_SPECIES.find(s => s.id === g.speciesId), r = source.regions.find(r => r.id === g.regionId);
    assert.ok(S.compatible(s, r));
    if (s.realm === 'ocean') assert.equal(map.surface.classes[W.cellIndex(r.cellId)], 'W');
    if (g.speciesId === 'beast:burrowing-furnace') assert.equal(r.kind, 'subsurface');
  }
  for (const r of source.regions) for (const edge of r.edges) {
    const destination = source.regions.find(p => p.id === edge.id); assert.ok(destination);
    assert.ok(edge.distanceKm > 0 && edge.allowedSpecies.length > 0);
    assert.ok(edge.allowedSpecies.every(id => {
      const species = E.BEAST_SPECIES.find(s => s.id === id);
      return S.compatible(species, destination) || destination.kind === 'waterColumn'
        && species.movementModes.some(mode => ['flight', 'levitation'].includes(mode));
    }));
    if (destination.cellId === r.cellId) assert.notEqual(destination.kind, 'subsurface');
  }
});
test('a physically supplied prepared herbivore region passes; a bad season is explicitly rejected, not called exhausted', () => {
  const { source, region, map } = prepared((g, c) => [g('beast:gravebloom-elk', 'original-elk', [c('beast:gravebloom-elk', 'elk-adults', 2)])]);
  assert.equal(S.assess(source, map).status, 'feasibleInitialCycle');
  region.stocks.forageKg = 0; region.seasons[2].renewal.forageKg = 0;
  assert.equal(S.assess(source, map).status, 'feasibleInitialCycle', 'actual accumulated summer stock can cover a seasonal low');
  region.capacity.forageKg = 0;
  const bad = S.assess(source, map);
  assert.equal(bad.status, 'rejected'); assert.ok(bad.issues.some(i => i.phase === 2 && i.resource === 'forageKg' && i.missingAmount > 0));
  assert.equal(region.exhausted, false);
});
test('predator feasibility spends actual reachable prey bodies once, never a generic biomass score', () => {
  const { source, map, region } = prepared((g, c) => [
    g('beast:rimefang-pack', 'hunters', [c('beast:rimefang-pack', 'wolves', 2)]),
    g('beast:gravebloom-elk', 'prey', [c('beast:gravebloom-elk', 'breeders', 2), c('beast:gravebloom-elk', 'calves', 200, true)])
  ]);
  const before = clone(source), result = S.assess(source, map);
  assert.equal(result.status, 'rejected'); assert.deepEqual(source, before);
  assert.ok(result.issues.some(i => i.resource === 'meatKg' && i.missingAmount > 0), 'hypothetical future kills do not refill actual stocks');
  assert.ok(result.foodAllocations.length);
  const paid = result.foodAllocations.filter(a => a.preyCohortId === 'calves');
  const kills = paid.reduce((n, a) => n + a.individuals, 0), food = paid.reduce((n, a) => n + a.edibleKg, 0);
  assert.ok(paid.every(a => Number.isSafeInteger(a.individuals) && a.individuals >= 0));
  assert.ok(kills <= 200); assert.ok(food <= kills * D.lifecycle['beast:gravebloom-elk'].newbornKg * .6 + 1e-6);
  source.groups.pop(); region.condition.renewableBiomass = 100;
  assert.ok(S.assess(source, map).issues.some(i => i.kind === 'unfundedPrey'));
});
test('live animals do not become a scavenger food source without actual carcasses or funded predation remnants', () => {
  const { source, map } = prepared((g, c) => [
    g('beast:carrion-lantern', 'scavenger', [c('beast:carrion-lantern', 'lantern', 1)]),
    g('beast:gravebloom-elk', 'living-prey', [c('beast:gravebloom-elk', 'calves', 200, true)])
  ]);
  const result = S.assess(source, map);
  assert.equal(result.foodAllocations.length, 0); assert.ok(result.issues.some(i => i.kind === 'unfundedPrey'));
});
test('distant or unwilling nurturers do not provide opposition merely because a species label shares the hex', () => {
  const { source, map } = prepared((g, c) => [
    g('beast:glasswing-roc', 'roc', [c('beast:glasswing-roc', 'roc-adult', 1)]),
    g('beast:ashhorn-behemoth', 'calving-herd', [c('beast:ashhorn-behemoth', 'calf', 10, true)])
  ]);
  assert.ok(S.assess(source, map).opposition.some(o => o.edgeId === 'roc-ashhorn'));
  source.groups[0].willing = false; assert.equal(S.assess(source, map).opposition.length, 0);
  source.groups[0].willing = true; source.groups[0].home.eastKm = 10000;
  assert.equal(S.assess(source, map).opposition.length, 0);
});
test('rejected candidates cannot initialize active accounts or silently certify healthy/exhausted territory', () => {
  const { record, source, map } = fixture();
  assert.equal(record.assessment.status, 'rejected'); assert.ok(record.assessment.issues.length);
  assert.throws(() => S.runtimeSource(record, map), /Rejected initial allocation/);
  assert.throws(() => P.create(source, { worldId: 'world', runId: 'run' }), /unaccepted generator proposal/);
  assert.ok(source.regions.every(r => r.exhausted === false));
  assert.ok(record.unlocated.every(p => p.reason && p.count !== 0));
});
test('source validation derives area/counts from physical truth, not a re-signed inflated proposal', () => {
  const { record, map } = fixture(), inflated = clone(record);
  inflated.patchRows[0][2] *= 100;
  inflated.id = ''; inflated.id = `beast-habitat-source:${W.stableHash(inflated)}`;
  assert.throws(() => S.validate(inflated, map), /changed/);
  const altered = clone(map); altered.climate.precipitationMm[0]++;
  assert.throws(() => S.validate(record, altered), /physical world/);
  assert.throws(() => S.validate(record, map, 'a-different-world-seed'), /physical world/);
});
test('traditional seasonal destinations stay fixed while concrete route and resource checks replace blanket unverified labels', () => {
  const { record, map } = fixture(), source = S.expand(record, map);
  const g = source.groups.find(g => g.instinct); assert.ok(g);
  const before = clone(g.instinct);
  for (const patchId of g.instinct.route.filter(Boolean)) {
    const patch = source.regions.find(r => r.id === patchId);
    patch.stocks = Object.fromEntries(S.STOCKS.map(key => [key, 0]));
  }
  const result = S.assess(source, map);
  assert.deepEqual(g.instinct, before);
  const journey = result.seasonalJourneys.find(j => j.groupId === g.id);
  assert.ok(journey && journey.departures > 0);
  assert.ok(result.issues.some(i => ['seasonalRouteBlocked', 'lateSeasonalArrival', 'seasonalResourceDeficit'].includes(i.kind)));
  assert.ok(!result.issues.some(i => i.kind === 'seasonalResidenceUnverified'));
  assert.deepEqual(g.knowledge, []);
});
test('archived worlds without source proposals retain their identity; independent copies cannot drain the reusable source', () => {
  const { world, record, map } = fixture(), old = clone(world);
  delete old.generatedData.strategicMap.beastHabitatSources; delete old.canonicalDigest;
  const archived = L.normalizeWorld(old), before = JSON.stringify(archived);
  assert.equal(L.normalizeWorld(archived).generatedData.strategicMap.beastHabitatSources, undefined);
  assert.equal(JSON.stringify(archived), before);
  const a = S.expand(record, map), b = S.expand(record, map), sourceBefore = JSON.stringify(record);
  a.regions[0].stocks.mineralsKg = 0; a.groups[0].cohorts[0].count = 0;
  assert.ok(b.regions[0].stocks.mineralsKg > 0 && b.groups[0].cohorts[0].count > 0);
  assert.equal(JSON.stringify(record), sourceBefore);
});
test('all resident groups compete for one finite supply, and later renewal cannot pay an earlier shortage', () => {
  const { source, map, region } = prepared((g, c) => [
    g('beast:gravebloom-elk', 'herd-one', [c('beast:gravebloom-elk', 'one', 1)]),
    g('beast:gravebloom-elk', 'herd-two', [c('beast:gravebloom-elk', 'two', 1)])
  ]);
  source.calendar.monthDays = [1, 1, 1, 1];
  const ration = D.lifecycle['beast:gravebloom-elk'].foodKgDay;
  region.stocks.forageKg = ration * 6;
  region.seasons.forEach(s => s.renewal.forageKg = 0);
  const failures = S.assess(source, map).issues.filter(i => i.resource === 'forageKg');
  approx(failures.reduce((n, i) => n + i.missingAmount, 0), ration * 2);
  approx(failures[0].at, 3 * P.DAY);
  region.stocks.forageKg = ration / 2;
  region.seasons.slice(1).forEach(s => s.renewal.forageKg = ration * 100);
  const earlier = S.assess(source, map).issues.filter(i => i.resource === 'forageKg');
  assert.equal(earlier.length, 1); assert.equal(earlier[0].phase, 0);
  approx(earlier[0].at, P.DAY / 4); approx(earlier[0].missingAmount, ration * 1.5);
});
test('archived advisory diagnostics retain their original identity, but cannot bypass current activation checks', () => {
  const { map, record } = fixture(), archived = clone(record);
  archived.assessment = { status: 'rejected', issues: [{ kind: 'seasonalResidenceUnverified', note: 'Original archived diagnostic' }] };
  archived.id = ''; archived.id = `beast-habitat-source:${W.stableHash(archived)}`;
  const before = clone(archived); assert.equal(S.validate(archived, map), archived); assert.deepEqual(archived, before);
  archived.assessment = { status: 'feasibleInitialCycle', issues: [] };
  archived.id = ''; archived.id = `beast-habitat-source:${W.stableHash(archived)}`;
  const claimed = clone(map); claimed.beastHabitatSources = archived;
  assert.throws(() => S.runtimeSource(archived, claimed), /current physical residence checks/);
});
test('a still-travelling original group misses its seasonal deadline even without an arrival event', () => {
  const { source, map, region } = prepared((g, c) => [g('beast:gravebloom-elk', 'slow-herd', [c('beast:gravebloom-elk', 'adults', 1)])]);
  source.calendar.monthDays = [1, 1, 1, 1];
  const away = clone(region); away.id = 'traditional-away';
  region.edges = [{ id: away.id, traversable: true, distanceKm: D.lifecycle['beast:gravebloom-elk'].travelKmDay * 10 }];
  away.edges = [{ ...region.edges[0], id: region.id }]; source.regions.push(away);
  source.groups[0].instinct = { mode: 'instinctive', seasonal: { outboundRoute: [region.id, away.id],
    phases: { outboundPhase: 'thaw', residencePhase: 'highSun', returnPhase: 'stormturn', homePhase: 'deepCold' } } };
  const report = S.assess(source, map);
  assert.ok(report.issues.some(i => i.kind === 'lateSeasonalArrival' && i.at === 2 * P.DAY));
  assert.equal(report.seasonalJourneys[0].arrivals, 0); assert.equal(report.seasonalJourneys[0].transitAtCycleEnd, true);
});
