// Non-catalog food-chain guilds. Compact, finite, region-owned biological accounts.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./creature-life') : root.HelixCreatureLife,
    node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./carrion-lantern-biology') : root.HelixCarrionLanternBiology,
    node ? require('./carcass-tissues') : root.HelixCarcassTissues,
    node ? require('./wildlife-carcasses') : root.HelixWildlifeCarcasses);
  if (node) module.exports = api;
  root.HelixBackgroundWildlife = api;
})(globalThis, function (Life, Biology, Bodies, Lantern, Tissues, Carcasses) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, DURATION = 300, copy = x => JSON.parse(JSON.stringify(x));
  // Initial guild tuning, not additional researchable/strategic creature species.
  const profiles = Object.freeze({
    insects: Object.freeze({ adultKg: .002, newbornKg: .0001, adultDays: 14, foodDay: .0002, waterDay: 0,
      offspringDay: .05, incubationDays: 3, mortalityDay: .01, assimilation: .25, hatchSuccess: .6, externalBrood: true }),
    smallAnimals: Object.freeze({ adultKg: 2, newbornKg: .05, adultDays: 90, foodDay: .1, waterDay: .1,
      offspringDay: .004, incubationDays: 20, mortalityDay: .001, assimilation: .3, hatchSuccess: .7, externalBrood: false }),
    fish: Object.freeze({ adultKg: .25, newbornKg: .005, adultDays: 120, foodDay: .0125, waterDay: 0,
      offspringDay: .05, incubationDays: 7, mortalityDay: .002, assimilation: .25, hatchSuccess: .5, externalBrood: true })
  });
  const sizeClasses = Object.freeze({
    insects: { small: profiles.insects },
    smallAnimals: { small: profiles.smallAnimals,
      medium: { ...profiles.smallAnimals, adultKg: 10, newbornKg: .25, adultDays: 180, foodDay: .34, waterDay: .5,
        offspringDay: .002, incubationDays: 45, mortalityDay: .0006 },
      large: { ...profiles.smallAnimals, adultKg: 100, newbornKg: 5, adultDays: 365, foodDay: 1.9, waterDay: 3,
        offspringDay: .001, incubationDays: 90, mortalityDay: .0002 } },
    fish: { small: profiles.fish,
      medium: { ...profiles.fish, adultKg: 2.5, newbornKg: .01, adultDays: 240, foodDay: .07,
        offspringDay: .025, incubationDays: 10, mortalityDay: .001 },
      large: { ...profiles.fish, adultKg: 25, newbornKg: .05, adultDays: 365, foodDay: .4,
        offspringDay: .02, incubationDays: 14, mortalityDay: .0005 } }
  });
  const profile = pool => Object.hasOwn(profiles, pool.guild)
    ? pool.sizeClass == null ? profiles[pool.guild]
      : Object.hasOwn(sizeClasses[pool.guild], pool.sizeClass) ? sizeClasses[pool.guild][pool.sizeClass] : null : null;
  const CLASSES = Object.freeze([['insects', 'small'], ['smallAnimals', 'small'], ['smallAnimals', 'medium'],
    ['smallAnimals', 'large'], ['fish', 'small'], ['fish', 'medium'], ['fish', 'large']].map(Object.freeze));
  // Procedural refinement of one regional feeding ground, not an omnipresent
  // density multiplier. Its real geometry is also used for initial placement.
  function feedingGround(r, seed) {
    const regionRadiusM = Math.sqrt(r.areaHa * 10000 / Math.PI), angle = Life.random(`${seed}:${r.id}:feeding-ground:angle`) * Math.PI * 2;
    const distance = regionRadiusM * .35 * Math.sqrt(Life.random(`${seed}:${r.id}:feeding-ground:radius`));
    return { eastM: Math.cos(angle) * distance, northM: Math.sin(angle) * distance,
      radiusM: regionRadiusM * Math.sqrt(.00025), depthTopM: Math.min(5, Math.max(0, r.depthM - 15)) };
  }
  const SETTLING_DAYS = 7, BACKGROUND_SHARE = .3;
  const SCHOOL_MAX_RADIUS_M = 200, SCHOOL_MAX_DONOR_SHARE = .02, SCHOOL_KG_PER_HA = 1200;
  const sizeShare = Object.freeze({ small: .25, medium: .35, large: .4 });
  function habitatPatches(r, seed) {
    const radius = Math.sqrt(r.areaHa * 10000 / Math.PI), original = feedingGround(r, seed);
    const angle = Life.random(`${seed}:${r.id}:habitat-patches:angle`) * Math.PI * 2;
    return [{ id: 'background', share: BACKGROUND_SHARE, eastM: 0, northM: 0, radiusM: radius, depthTopM: original.depthTopM },
      ...[0, 1, 2].map(i => {
        const bearing = angle + i * Math.PI * 2 / 3;
        const distance = radius * (.25 + .35 * Life.random(`${seed}:${r.id}:habitat-patches:${i}`));
        return { id: `hotspot-${i}`, share: (1 - BACKGROUND_SHARE) / 3,
          eastM: i === 0 ? original.eastM : Math.cos(bearing) * distance,
          northM: i === 0 ? original.northM : Math.sin(bearing) * distance,
          radiusM: radius * .05, depthTopM: original.depthTopM };
      })];
  }
  function initialPosition(r, seed, groupId, distributed = false) {
    const ground = distributed ? habitatPatches(r, seed)[1 + Math.floor(Life.random(`${seed}:${groupId}:habitat-patch`) * 3)] : feedingGround(r, seed);
    const angle = Life.random(`${seed}:${groupId}:within-ground:angle`) * Math.PI * 2;
    const distance = ground.radiusM * .7 * Math.sqrt(Life.random(`${seed}:${groupId}:within-ground:radius`));
    return { eastM: ground.eastM + Math.cos(angle) * distance, northM: ground.northM + Math.sin(angle) * distance };
  }
  const finite = n => Number.isFinite(n) && n >= 0, integer = n => Number.isSafeInteger(n) && n >= 0;
  const total = pool => pool.cohorts.reduce((n, c) => n + c.count, 0);
  const mass = pool => pool.cohorts.reduce((n, c) => n + c.count * c.massKg, 0);
  function suitable(r, pool) {
    if (r.oxygen === false) return false;
    if (pool.guild !== 'fish') return r.kind !== 'waterColumn' && r.kind !== 'subsurface' && r.floor === true;
    const key = r.kind === 'waterColumn' ? 'seawaterL' : 'waterL';
    return ['waterColumn', 'wetland'].includes(r.kind) && (r.stocks[key] || 0) > r.areaHa * 10000 * 1000 * .5 + EPS;
  }
  const output = (r, key, kg) => { if (kg > 0) { r.outputs ||= {}; r.outputs[key] = (r.outputs[key] || 0) + kg; } };
  function allocate(source, seed, options = {}) {
    if (source.spatialContinuity) return allocateSpatial(source, seed, options.distributed === true,
      options.carcassBatches === true, options.reefSchools);
    const allocations = [];
    for (const r of source.regions) {
      const aquatic = ['wetland', 'waterColumn'].includes(r.kind);
      const types = r.kind === 'subsurface' ? [] : r.kind === 'waterColumn' ? ['fish']
        : [...(aquatic && r.depthM >= .5 ? ['fish'] : []), 'insects', 'smallAnimals'];
      const remaining = { ...r.stocks }, pools = [];
      for (const guild of types) {
        const p = profiles[guild], foodKey = guild === 'fish' ? r.kind === 'waterColumn' ? 'planktonKg' : 'organicKg'
          : guild === 'insects' ? 'organicKg' : 'forageKg';
        const minimum = Math.min(...r.seasons.map(s => s.renewal[foodKey] || 0));
        const waterLimit = p.waterDay ? Math.min(...r.seasons.map(s => s.renewal.waterL || 0)) * .05 / p.waterDay : Infinity;
        const n = Math.floor(Math.min(minimum * .05 / (p.foodDay + p.offspringDay * p.newbornKg / p.assimilation),
          (remaining[foodKey] || 0) * .02 / p.adultKg, waterLimit) * (.6 + Life.random(`${seed}:${r.id}:${guild}:abundance`) * .4));
        if (!(n > 0) || !integer(n)) continue;
        const originalMassKg = n * p.adultKg; remaining[foodKey] -= originalMassKg;
        pools.push({ id: `wildlife:${r.id}:${guild}`, guild, foodKey, areaHa: r.areaHa,
          habitatDepthM: guild === 'fish' ? Math.min(r.depthM, 200) : 0,
          capacityCount: Math.floor(n * 1.5), originalCount: n, originalMassKg });
      }
      if (pools.length) allocations.push({ regionId: r.id, pools });
    }
    return { basis: 'Finite adapted background guilds; original body matter partitioned from standing food stocks', allocations };
  }
  function allocateSpatial(source, seed, distributed = false, carcassBatches = false, reefSchools = []) {
    const allocations = [];
    for (const r of source.regions) {
      const aquatic = ['wetland', 'waterColumn'].includes(r.kind);
      const types = r.kind === 'subsurface' ? [] : r.kind === 'waterColumn' ? ['fish']
        : [...(aquatic && r.depthM >= .5 ? ['fish'] : []), 'insects', 'smallAnimals'];
      const remaining = { ...r.stocks }, pools = [], spatial = feedingGround(r, seed);
      for (const guild of types) for (const [sizeClass, p] of Object.entries(sizeClasses[guild])) {
        const share = guild === 'insects' ? 1 : sizeShare[sizeClass];
        const foodKey = guild === 'fish' ? r.kind === 'waterColumn' ? 'planktonKg' : 'organicKg'
          : guild === 'insects' ? 'organicKg' : 'forageKg';
        const food = Math.min(...r.seasons.map(s => s.renewal[foodKey] || 0));
        const water = p.waterDay ? Math.min(...r.seasons.map(s => s.renewal.waterL || 0)) * .05 * share / p.waterDay : Infinity;
        const n = Math.floor(Math.min(food * .05 * share / (p.foodDay + p.offspringDay * p.newbornKg / p.assimilation),
          (r.stocks[foodKey] || 0) * .02 * share / p.adultKg, (remaining[foodKey] || 0) / p.adultKg, water)
          * (.6 + Life.random(`${seed}:${r.id}:${guild}:${sizeClass}:abundance`) * .4));
        if (!(n > 0) || !integer(n) || !integer(Math.floor(n * 1.5))) continue;
        const originalMassKg = n * p.adultKg; remaining[foodKey] -= originalMassKg;
        pools.push({ id: `wildlife:${r.id}:${guild}:${sizeClass}`, guild, sizeClass, foodKey, areaHa: r.areaHa * .00025,
          habitatDepthM: guild === 'fish' ? Math.min(r.depthM, 15) : 0, spatial: copy(spatial),
          capacityCount: Math.floor(n * 1.5), originalCount: n, originalMassKg });
      }
      if (pools.length) allocations.push({ regionId: r.id, pools });
    }
    // Immutable world archives need counts, not seven copies of derived IDs,
    // geometry, area, body mass and profile names for every geographic patch.
    const fishRegions = distributed && reefSchools.length
      ? new Set(allocations.filter(a => a.pools.some(p => p.guild === 'fish')).map(a => a.regionId)) : null;
    const reefSchoolRows = fishRegions ? reefSchools.filter(row => fishRegions.has(row[0])) : [];
    return { basis: 'Finite size-classed spatial herds/schools; original matter and shared regional feeding budgets', seed,
      ...(distributed ? { distribution: 'habitatPatches', settlingDays: SETTLING_DAYS } : {}),
      ...(distributed && carcassBatches ? { carcassBatches: true } : {}),
      ...(reefSchoolRows.length ? { reefSchoolRows: copy(reefSchoolRows) } : {}),
      spatialRows: allocations.map(a => [a.regionId, ...CLASSES.map(([guild, size]) =>
        a.pools.find(p => p.guild === guild && p.sizeClass === size)?.originalCount || 0)]) };
  }
  function splitReefSchool(pool, site) {
    if (!site || pool.guild !== 'fish' || pool.habitatPatch !== 'background') return [];
    return splitSchool(pool, site, 'reef-shelf', sizeShare[pool.sizeClass]);
  }
  function offshoreDonor(pool) {
    return pool.guild === 'fish' && pool.sizeClass === 'large' && pool.habitatPatch === 'background';
  }
  function schoolCount(pool, areaHa, share) {
    return Math.min(Math.floor(pool.originalCount * SCHOOL_MAX_DONOR_SHARE),
      Math.floor(areaHa * SCHOOL_KG_PER_HA * share / profile(pool).adultKg));
  }
  function offshoreSchoolCount(pool, site) {
    return offshoreDonor(pool) ? schoolCount(pool, Math.PI * site.radiusM ** 2 / 10000, 1) : 0;
  }
  function splitSchool(pool, site, habitatPatch, share) {
    const adultKg = profile(pool).adultKg, areaHa = Math.PI * site.radiusM ** 2 / 10000;
    // A bounded share of existing diffuse fish gets a smaller footprint.
    // No fish, carrying capacity, or plankton are minted.
    const n = schoolCount(pool, areaHa, share);
    if (!n) return [];
    const capacity = n + Math.floor((pool.capacityCount - pool.originalCount) * n / pool.originalCount);
    const school = { ...pool, id: pool.id.replace(/:background$/, `:${habitatPatch}`), habitatPatch,
      areaHa, spatial: { ...site, depthTopM: pool.spatial.depthTopM },
      originalCount: n, capacityCount: capacity, originalMassKg: n * adultKg };
    pool.originalCount -= n; pool.capacityCount -= capacity; pool.originalMassKg -= school.originalMassKg;
    return [school];
  }
  function definitions(record, regions) {
    if (record.allocations) return record.allocations;
    if (typeof record.seed !== 'string' || !record.seed || !Array.isArray(record.spatialRows)) throw Error('Invalid original spatial wildlife');
    const byId = new Map(regions.map(r => [r.id, r])), seen = new Set(), reefs = new Map(), offshore = new Map();
    if (record.reefSchoolRows !== undefined) {
      if (!Array.isArray(record.reefSchoolRows) || record.distribution !== 'habitatPatches') throw Error('Invalid original reef schools');
      for (const row of record.reefSchoolRows) {
        const [id, site] = Array.isArray(row) ? row : [];
        const r = byId.get(id);
        if (row?.length !== 2 || r?.kind !== 'waterColumn' || r.biome !== 'h' || reefs.has(id)
          || !validSchoolSite(r, site)) throw Error('Invalid original reef schools');
        reefs.set(id, site);
      }
    }
    if (record.offshoreSchoolRows !== undefined) {
      if (!Array.isArray(record.offshoreSchoolRows) || record.offshoreSchoolRows.length > 1
        || record.distribution !== 'habitatPatches') throw Error('Invalid original offshore school');
      for (const row of record.offshoreSchoolRows) {
        const [id, site] = Array.isArray(row) ? row : [];
        if (row?.length !== 2 || reefs.has(id) || !validOffshoreSchoolSite(byId.get(id), site)
          || !record.spatialRows.some(pool => pool[0] === id))
          throw Error('Invalid original offshore school');
        offshore.set(id, site);
      }
    }
    return record.spatialRows.map(row => {
      const r = byId.get(row[0]);
      if (!r || seen.has(r.id) || row.length !== CLASSES.length + 1 || !row.slice(1).every(integer)) throw Error('Invalid original spatial wildlife row');
      seen.add(r.id);
      const pools = CLASSES.flatMap(([guild, sizeClass], i) => {
        const n = row[i + 1]; if (!n) return [];
        const p = sizeClasses[guild][sizeClass];
        return [{ id: `wildlife:${r.id}:${guild}:${sizeClass}`, guild, sizeClass,
          foodKey: guild === 'fish' ? r.kind === 'waterColumn' ? 'planktonKg' : 'organicKg' : guild === 'insects' ? 'organicKg' : 'forageKg',
          areaHa: r.areaHa * .00025, habitatDepthM: guild === 'fish' ? Math.min(r.depthM, 15) : 0,
          spatial: feedingGround(r, record.seed), capacityCount: Math.floor(n * 1.5), originalCount: n, originalMassKg: n * p.adultKg }];
      });
      if (record.distribution == null) return { regionId: r.id, pools };
      if (record.distribution !== 'habitatPatches' || record.settlingDays !== SETTLING_DAYS) throw Error('Invalid established wildlife layout');
      const sites = habitatPatches(r, record.seed);
      const situated = pools.flatMap(pool => {
        let assigned = 0, capacity = 0;
        return sites.flatMap((site, i) => {
          const n = i === sites.length - 1 ? pool.originalCount - assigned : Math.floor(pool.originalCount * site.share);
          const cap = i === sites.length - 1 ? pool.capacityCount - capacity
            : n + Math.floor((pool.capacityCount - pool.originalCount) * site.share);
          assigned += n; if (!n) return [];
          capacity += cap;
          return [{ ...pool, id: `${pool.id}:${site.id}`, habitatPatch: site.id, establishedDays: SETTLING_DAYS,
            ...(record.carcassBatches === true ? { spatialCarcasses: true } : {}),
            areaHa: site.id === 'background' ? r.areaHa : Math.PI * site.radiusM ** 2 / 10000,
            spatial: { eastM: site.eastM, northM: site.northM, radiusM: site.radiusM, depthTopM: site.depthTopM },
            originalCount: n, capacityCount: Math.max(n, cap), originalMassKg: n * profile(pool).adultKg }];
        });
      });
      const reef = reefs.get(r.id), school = offshore.get(r.id);
      if (school && !situated.some(pool => offshoreSchoolCount(pool, school) > 0))
        throw Error('Original offshore school has no large-fish donor');
      return { regionId: r.id, pools: reef ? situated.flatMap(pool => [pool, ...splitReefSchool(pool, reef)])
        : school ? situated.flatMap(pool => [pool, ...(offshoreDonor(pool) ? splitSchool(pool, school, 'offshore-school', 1) : [])])
          : situated };
    });
  }
  function validSchoolSite(r, site) {
    return site && ['eastM', 'northM', 'radiusM'].every(k => Number.isFinite(site[k]))
      && site.radiusM > 0 && site.radiusM <= SCHOOL_MAX_RADIUS_M
      && Math.hypot(site.eastM, site.northM) + site.radiusM <= Math.sqrt(r.areaHa * 10000 / Math.PI) + EPS;
  }
  function validOffshoreSchoolSite(r, site) {
    return r?.kind === 'waterColumn' && r.depthM >= 200 && r.oxygen !== false && validSchoolSite(r, site);
  }
  function apply(source, record) {
    const regions = new Map(source.regions.map(r => [r.id, r]));
    for (const row of definitions(record, source.regions)) {
      const r = regions.get(row.regionId); if (!r || r.wildlife) throw Error('Conflicting original wildlife habitat');
      for (const p of row.pools) {
        if (!(r.stocks[p.foodKey] + EPS >= p.originalMassKg)) throw Error('Unfunded original wildlife matter');
        r.stocks[p.foodKey] -= p.originalMassKg;
      }
      r.wildlife = { pools: copy(row.pools) };
    }
    return source;
  }
  function initialize(r, at) {
    if (!r.wildlife) return;
    Object.assign(r.wildlife, { initializedAt: at, pending: [], serial: 0, lastDemographyAt: at });
    for (const pool of r.wildlife.pools) Object.assign(pool, {
      cohorts: [{ id: `${pool.id}:original`, count: pool.originalCount, massKg: profile(pool).adultKg,
        bornAt: at - profile(pool).adultDays * DAY, health: 1, hazard: 0, mortalityBalance: Life.random(`${pool.id}:mortality`) }],
      broods: [], bornCount: 0, deadCount: 0, huntedCount: 0, fundedKg: 0, discardedKg: 0,
      maintenanceKg: 0, maintenanceWaterL: 0, wasteKg: 0, attempts: 0, catches: 0,
      carcass: { initialMassKg: 0, massKg: 0, edibleKg: 0, consumedKg: 0, decomposedKg: 0, lastAt: at } });
    for (const pool of r.wildlife.pools) {
      Carcasses.initialize(pool, r.id, at);
      if (pool.establishedDays) establish(r, pool);
    }
  }
  function initialDeaths(pool) {
    let living = pool.originalCount;
    return Array.from({ length: SETTLING_DAYS }, (_, day) => {
      const n = Math.min(living, Math.floor(living * -Math.expm1(-profile(pool).mortalityDay)
        + Life.random(`${pool.id}:establishment:${day}`)));
      living -= n; return n;
    });
  }
  function establish(r, pool) {
    const deaths = initialDeaths(pool), row = pool.carcass, p = profile(pool);
    for (const [day, n] of deaths.entries()) {
      Tissues.decay(row, 1); Tissues.add(row, n * p.adultKg);
      Carcasses.record(pool, n, n * p.adultKg, row.lastAt - (SETTLING_DAYS - day - .5) * DAY);
    }
    Tissues.decay(row, .5);
    pool.deadCount = deaths.reduce((n, v) => n + v, 0); pool.cohorts[0].count -= pool.deadCount;
    pool.establishment = { days: SETTLING_DAYS, deaths, decomposedKg: row.decomposedKg };
    const accepted = Math.min(row.decomposedKg, Math.max(0, (r.capacity.detritusKg || 0) - (r.stocks.detritusKg || 0)));
    if (accepted) r.stocks.detritusKg = (r.stocks.detritusKg || 0) + accepted;
    output(r, 'wildlifeEstablishmentDecayOverflowKg', row.decomposedKg - accepted);
  }
  function initialDecay(pool, deaths) {
    return deaths.reduce((kg, n, i) => kg + n * profile(pool).adultKg * Tissues.animalKeys.reduce((fraction, key) =>
      fraction + Tissues.profiles[key].share * -Math.expm1(-Tissues.profiles[key].decayDay * (SETTLING_DAYS - i - .5)), 0), 0);
  }
  function plan(r, month, at) {
    if (!r.wildlife) return;
    for (const pool of r.wildlife.pools) {
      const p = profile(pool), days = (month.end - at) / DAY;
      const adults = pool.cohorts.reduce((n, c) => n + (at - c.bornAt >= p.adultDays * DAY && c.massKg >= p.adultKg * .95 && c.health >= .6 ? c.count : 0), 0);
      const condition = Math.min(1, ...['renewableBiomass', ...(p.waterDay ? ['freshwaterQuantity', 'freshwaterQuality'] : [])]
        .map(k => r.ecology?.referenceCondition[k] > 0 ? r.condition[k] / r.ecology.referenceCondition[k] : 1));
      const reserved = pool.broods.reduce((n, b) => n + b.targetCount, 0);
      const targetCount = Math.max(0, Math.min(Math.floor(adults * p.offspringDay * days),
        Math.floor(pool.capacityCount * condition) - total(pool) - reserved));
      pool.plan = { monthIndex: month.index, plannedAt: at, end: month.end, targetCount,
        costPerDay: days > 0 ? targetCount * p.newbornKg / p.assimilation / days : 0 };
      if (targetCount) pool.broods.push({ id: `${pool.id}:brood:${month.index}`, monthIndex: month.index,
        targetCount, investedKg: 0, dueAt: month.end + p.incubationDays * DAY });
    }
  }
  function prepare(r, at, rate) {
    if (!r.wildlife) return [];
    const requests = []; rate.wildlifeMaintenance = []; rate.wildlifeRates = [];
    for (const pool of r.wildlife.pools) {
      const p = profile(pool);
      for (const c of pool.cohorts) if (c.count) {
        const scale = c.count * (c.massKg / p.adultKg) ** .75 * (at - c.bornAt < p.adultDays * DAY ? 1.5 : 1);
        const food = p.foodDay * scale, water = p.waterDay * scale;
        rate.demand[pool.foodKey] = (rate.demand[pool.foodKey] || 0) + food;
        if (water) rate.demand.waterL = (rate.demand.waterL || 0) + water;
        rate.wildlifeMaintenance.push({ poolId: pool.id, cohortId: c.id, food, water });
        if (c.massKg < p.adultKg - EPS && c.health > .3) requests.push({ kind: 'wildlifeGrowth', poolId: pool.id, cohortId: c.id,
          perDay: p.adultKg / p.adultDays * c.count / p.assimilation, remainingKg: (p.adultKg - c.massKg) * c.count,
          recipe: { [pool.foodKey]: 1 }, assimilation: p.assimilation });
      }
      const brood = pool.broods.find(b => b.monthIndex === pool.plan?.monthIndex);
      const adults = pool.cohorts.some(c => c.count && c.health >= .6 && at - c.bornAt >= p.adultDays * DAY && c.massKg >= p.adultKg * .95);
      if (adults && brood && brood.investedKg < brood.targetCount * p.newbornKg - EPS) requests.push({ kind: 'wildlifeBrood', poolId: pool.id,
        broodId: brood.id, perDay: pool.plan.costPerDay, remainingKg: brood.targetCount * p.newbornKg - brood.investedKg,
        recipe: { [pool.foodKey]: 1 }, assimilation: p.assimilation });
    }
    for (const q of requests) q.inputs = Object.fromEntries(Object.entries(q.recipe).map(([key, share]) => [key, share * q.perDay]));
    return requests;
  }
  function fed(r, q, rate) {
    const pool = r.wildlife.pools.find(p => p.id === q.poolId), p = profile(pool);
    return suitable(r, pool) && (rate.supply[pool.foodKey] ?? 0) >= 1 && (!p.waterDay || (rate.supply.waterL ?? 0) >= 1);
  }
  function next(r, rate, at) {
    if (!r.wildlife) return Infinity;
    let end = Infinity;
    for (const pool of r.wildlife.pools) {
      const p = profile(pool);
      for (const c of pool.cohorts) {
        if (c.bornAt + p.adultDays * DAY > at + EPS) end = Math.min(end, c.bornAt + p.adultDays * DAY);
        const missing = Math.max(suitable(r, pool) ? 0 : 1, 1 - (rate.supply[pool.foodKey] ?? 0), p.waterDay ? 1 - (rate.supply.waterL ?? 0) : 0);
        if (missing > EPS && c.health > EPS) end = Math.min(end, at + c.health / (missing * .2) * DAY);
      }
      for (const b of pool.broods) if (b.dueAt > at + EPS) end = Math.min(end, b.dueAt);
      if (pool.guild === 'fish') {
        const key = r.kind === 'waterColumn' ? 'seawaterL' : 'waterL', net = rate.net[key] || 0;
        const gap = (r.stocks[key] || 0) - r.areaHa * 10000 * 1000 * .5;
        if (net < -EPS && gap > EPS) end = Math.min(end, at + gap / -net * DAY);
      }
    }
    for (const q of rate.wildlifeRates || []) if (q.perDay * q.factor > EPS)
      end = Math.min(end, at + q.remainingKg / (q.perDay * q.factor * q.assimilation) * DAY);
    for (const q of r.wildlife.pending) end = Math.min(end, q.dueAt);
    return end;
  }
  function integrate(r, rate, from, to) {
    if (!r.wildlife) return;
    const days = (to - from) / DAY;
    for (const q of rate.wildlifeMaintenance || []) {
      const pool = r.wildlife.pools.find(p => p.id === q.poolId), c = pool.cohorts.find(c => c.id === q.cohortId), p = profile(pool);
      if (!c?.count) continue;
      const food = q.food * (rate.supply[pool.foodKey] ?? 0) * days, water = q.water * (rate.supply.waterL ?? 0) * days;
      pool.maintenanceKg += food; pool.maintenanceWaterL += water;
      output(r, 'wildlifeMetabolicWasteKg', food); output(r, 'wildlifeWaterVaporKg', water);
      const missing = Math.max(suitable(r, pool) ? 0 : 1, 1 - (rate.supply[pool.foodKey] ?? 0), p.waterDay ? 1 - (rate.supply.waterL ?? 0) : 0);
      c.health = Math.max(0, c.health - missing * .2 * days);
      const hazard = p.mortalityDay * (from - c.bornAt < p.adultDays * DAY ? 2 : 1) * days;
      c.mortalityBalance += c.count * Math.exp(-c.hazard) * -Math.expm1(-hazard); c.hazard += hazard;
    }
    for (const q of rate.wildlifeRates || []) {
      const pool = r.wildlife.pools.find(p => p.id === q.poolId), amount = q.perDay * q.factor * days, gain = amount * q.assimilation;
      pool.fundedKg += gain; pool.wasteKg += amount - gain; output(r, 'wildlifeGrowthWasteKg', amount - gain);
      if (q.kind === 'wildlifeGrowth') {
        const c = pool.cohorts.find(c => c.id === q.cohortId); if (c?.count) c.massKg += gain / c.count;
      } else pool.broods.find(b => b.id === q.broodId).investedKg += gain;
    }
    for (const pool of r.wildlife.pools) {
      const row = pool.carcass, elapsed = Math.max(0, to - Math.max(row.lastAt, row.frozenUntil || 0)) / DAY;
      const kg = Tissues.decay(row, elapsed); row.lastAt = to;
      Carcasses.advance(pool, elapsed, to);
      const accepted = Math.min(kg, Math.max(0, (r.capacity.detritusKg || 0) - (r.stocks.detritusKg || 0)));
      if (accepted) r.stocks.detritusKg = (r.stocks.detritusKg || 0) + accepted;
      output(r, 'wildlifeDetritusOverflowKg', kg - accepted);
    }
  }
  function lose(r, pool, c, n, hunted, at, point) {
    const p = profile(pool); n = Math.min(c.count, n);
    if (!p.externalBrood && n && at - c.bornAt >= p.adultDays * DAY && c.massKg >= p.adultKg * .95) {
      const adults = pool.cohorts.reduce((v, c) => v + (at - c.bornAt >= p.adultDays * DAY && c.massKg >= p.adultKg * .95 ? c.count : 0), 0);
      const surviving = Math.max(0, 1 - n / Math.max(1, adults));
      for (const b of pool.broods) {
        b.targetCount = Math.min(b.targetCount, Math.floor(b.targetCount * surviving
          + Life.random(`${b.id}:parent-loss:${pool.deadCount + pool.huntedCount + n}`)));
        const invested = Math.min(b.investedKg * surviving, b.targetCount * p.newbornKg), lost = b.investedKg - invested;
        b.investedKg = invested; pool.discardedKg += lost; output(r, 'wildlifeUnhatchedKg', lost);
      }
    }
    const kg = c.massKg * n; c.count -= n; c.hazard = 0;
    c.mortalityBalance *= c.count / Math.max(1, c.count + n);
    pool[hunted ? 'huntedCount' : 'deadCount'] += n;
    Tissues.add(pool.carcass, kg);
    Carcasses.record(pool, n, kg, at, hunted ? point : null);
    return n;
  }
  function boundary(r, at, daily) {
    if (!r.wildlife) return;
    for (const pool of r.wildlife.pools) {
      const p = profile(pool);
      for (const c of pool.cohorts) {
        if (c.health <= EPS) lose(r, pool, c, c.count, false, at);
        else if (daily && c.count) {
          const n = Math.min(c.count, Math.floor(c.mortalityBalance + EPS));
          if (n) { c.mortalityBalance -= n; lose(r, pool, c, n, false, at); }
        }
      }
      for (const b of pool.broods.filter(b => b.dueAt <= at + EPS)) {
        const paid = Math.min(b.targetCount, Math.floor((b.investedKg + EPS) / p.newbornKg));
        const n = suitable(r, pool) ? Math.min(paid, Math.floor(paid * p.hatchSuccess + Life.random(`${b.id}:hatch`))) : 0;
        if (n) { pool.cohorts.push({ id: `${b.id}:young`, count: n, massKg: p.newbornKg, bornAt: at, health: 1,
          hazard: 0, mortalityBalance: Life.random(`${b.id}:mortality`) }); pool.bornCount += n; }
        const discarded = Math.max(0, b.investedKg - n * p.newbornKg); pool.discardedKg += discarded;
        output(r, 'wildlifeUnhatchedKg', discarded);
      }
      pool.broods = pool.broods.filter(b => b.dueAt > at + EPS);
      pool.cohorts = pool.cohorts.filter(c => c.count);
      // Mature homogeneous guild members merge conservatively; juvenile birth dates stay distinct.
      const adults = pool.cohorts.filter(c => at - c.bornAt >= p.adultDays * DAY && c.massKg >= p.adultKg - EPS);
      if (adults.length > 1) {
        const n = adults.reduce((n, c) => n + c.count, 0), first = adults[0];
        first.massKg = adults.reduce((n, c) => n + c.count * c.massKg, 0) / n;
        first.health = Math.min(...adults.map(c => c.health));
        first.mortalityBalance = adults.reduce((n, c) => n + c.mortalityBalance, 0); first.count = n; first.hazard = 0;
        first.bornAt = Math.max(...adults.map(c => c.bornAt));
        pool.cohorts = pool.cohorts.filter(c => c === first || !adults.includes(c));
      }
    }
    if (daily) r.wildlife.lastDemographyAt = at;
  }
  function begin(r, g, c, a, at, position, credited = 0) {
    if (!r.wildlife || r.wildlife.pools.some(p => p.spatial) || c.contactBusyUntil > at || !a.life.will || a.life.willing === false || a.health < a.maxHealth * .3
      || !Bodies.capable(a, a.bodyPhysics.mode) || Bodies.wounded(a, /head|torso|limb|leg|wing|fin/) >= .65
      || a.bodyPhysics.stamina < 2 || !position || g.transit || r.contactBarriers?.length) return false;
    const scavenge = g.speciesId === 'beast:carrion-lantern', p = Biology.lifecycle[g.speciesId], n = c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0);
    if (!n || !scavenge && (g.foodWebPlan.huntingRemaining + credited < n || Life.random(`${g.id}:${at}:wildlife-search`) >= Math.min(1, p.huntsDay))) return false;
    const aquatic = ['swimming', 'drifting'].includes(a.bodyPhysics.mode);
    if (!aquatic && position.altitudeM > 2) return false;
    const guilds = r.wildlife.pools.filter(pool => aquatic === (pool.guild === 'fish') && suitable(r, pool) && profile(pool).adultKg < c.massKg * .5);
    if (!guilds.length) return false; // A habitat cue, not selection of a hidden rich destination.
    const b = Bodies.profiles[g.speciesId], mode = a.bodyPhysics.mode;
    const passive = mode === 'drifting' || mode === 'flight' && b.form === 'aerostat';
    // Same per-second movement effort as shared body locomotion. Leave half
    // the actual reserve for handling prey/return; no free long-range search.
    const effortRate = mode === 'flight' ? b.airCost : mode === 'burrowing' ? 3 : .5;
    const seconds = Math.min(DURATION, a.bodyPhysics.stamina * .5 / Math.max(.001, effortRate),
      mode === 'levitation' && b.levitationCost > 0 ? a.bodyPhysics.mana * .5 / b.levitationCost : Infinity);
    const distanceM = passive ? 0 : b.speed * seconds * Math.max(.1, 1 - Bodies.wounded(a, /leg|limb|wing|fin|tail/) * .8);
    const senseM = (aquatic ? Math.max(b.pressureM || 0, b.sightM || 0) : Math.max(b.sightM || 0, b.scentM || 0))
      * Math.max(0, 1 - Bodies.wounded(a, /head|eye|antenna|pressure organ/));
    const footprintHa = (Math.PI * senseM ** 2 + distanceM * Math.min(100, senseM) * 2) / 10000;
    // Homogeneous-field encounter approximation, including overlapping searches.
    const areaHa = r.areaHa * -Math.expm1(-footprintHa * n / r.areaHa);
    if (!(areaHa > 0)) return false;
    if (!scavenge) g.foodWebPlan.huntingRemaining -= Math.max(0, n - credited);
    c.regional.stamina -= passive ? 1 : effortRate * seconds;
    if (mode === 'levitation') c.regional.mana -= b.levitationCost * seconds;
    c.contactBusyUntil = at + DURATION;
    r.wildlife.pending.push({ id: `wildlife-search:${g.id}:${r.wildlife.serial++}`, groupId: g.id, cohortId: c.id,
      ranges: copy(c.ranges), startedAt: at, dueAt: at + DURATION, areaHa, scavenge, memberCount: n,
      position: copy(position), depthM: aquatic ? Math.min(200, 2 * senseM) : 0,
      guilds: guilds.map(p => p.id), success: scavenge ? 1 : p.huntSuccess });
    return true;
  }
  function cancel(r, groupId, cohortId, c) {
    if (!r?.wildlife) return;
    r.wildlife.pending = r.wildlife.pending.filter(q => q.groupId !== groupId || q.cohortId !== cohortId);
    if (c) delete c.contactBusyUntil;
  }
  function finish(r, at, api) {
    if (!r.wildlife) return;
    for (const q of r.wildlife.pending.filter(q => q.dueAt <= at + EPS)) {
      const g = api.group(q.groupId), c = g?.cohorts.find(c => c.id === q.cohortId);
      if (!c) continue;
      delete c.contactBusyUntil;
      if (g.transit || g.regionId !== r.id || g.will === false || g.willing === false || c.health <= .3
        || r.contactBarriers?.length || !api.canForage(g, c) || JSON.stringify(c.ranges) !== JSON.stringify(q.ranges)) continue;
      const p = Biology.lifecycle[g.speciesId], n = q.memberCount;
      const capacity = Math.min(c.massKg * .25, Math.max(p.foodKgDay * (p.foodReserveDays || 1), p.newbornKg));
      let room = Math.max(0, capacity - c.stores.foodKg) * n, intakeLeft = p.foodKgDay * DURATION / 600 * n;
      for (const id of q.guilds) {
        const pool = r.wildlife.pools.find(p => p.id === id); pool.attempts += n;
        if (!suitable(r, pool)) continue;
        const encountered = Math.min(1, q.areaHa / pool.areaHa) * (pool.habitatDepthM > 0 ? Math.min(1, q.depthM / pool.habitatDepthM) : 1);
        const encounteredCarrionKg = Tissues.available(pool.carcass, c) * encountered; let caughtEdibleKg = 0;
        if (!q.scavenge && room > EPS && intakeLeft > EPS) {
          for (const prey of pool.cohorts) {
            const expected = prey.count * encountered * q.success;
            const count = Math.min(prey.count, Math.floor(expected + Life.random(`${q.id}:${prey.id}:catch`)),
              Math.max(0, Math.ceil((Math.min(room, intakeLeft) - encounteredCarrionKg - caughtEdibleKg) / Math.max(EPS, prey.massKg * .6))));
            caughtEdibleKg += count * prey.massKg * .6;
            pool.catches += lose(r, pool, prey, count, true, at);
          }
        }
        // Carcass tissue has one owner. Searches encounter only a local fraction;
        // newly caught tissue is reachable by the same hunting batch.
        const available = Math.min(Tissues.available(pool.carcass, c), encounteredCarrionKg + caughtEdibleKg);
        const tissue = Tissues.take(pool.carcass, c, Math.min(room, available, intakeLeft)), kg = tissue.kg;
        if (!(kg > 0)) continue;
        if (q.scavenge) {
          const nutrients = Object.fromEntries(Object.entries(tissue).map(([key, value]) => [key, value / n]));
          const meal = Lantern.partition(kg / n, Lantern.waterCapacity(c.massKg) - c.stores.waterL, nutrients);
          c.stores.foodKg += meal.food; c.stores.waterL += meal.water; c.regional.energy.lightKg += meal.light;
          c.massKg += meal.food + meal.water + meal.light;
          r.outputs ||= {}; r.outputs.carrionWaterWasteL = (r.outputs.carrionWaterWasteL || 0) + meal.wasteWater * n;
          r.outputs.carrionMineralsKg = (r.outputs.carrionMineralsKg || 0) + meal.minerals * n;
          r.outputs.carrionSolidsKg = (r.outputs.carrionSolidsKg || 0) + meal.solids * n;
        } else { c.stores.foodKg += kg / n; c.massKg += kg / n; }
        room -= kg; intakeLeft -= kg;
      }
      poolCleanup(r);
    }
    r.wildlife.pending = r.wildlife.pending.filter(q => q.dueAt > at + EPS);
  }
  function poolCleanup(r) { for (const pool of r.wildlife.pools) pool.cohorts = pool.cohorts.filter(c => c.count); }
  function guilds(r, c, a) {
    const aquatic = ['swimming', 'drifting'].includes(a.bodyPhysics.mode);
    if (aquatic && Bodies.profiles[a.speciesId].modes.includes('walking') && Bodies.height(a) >= 0) return [];
    const pools = (r.wildlife?.pools || []).filter(pool => aquatic === (pool.guild === 'fish') && suitable(r, pool)
      && (a.speciesId === 'beast:carrion-lantern' || profile(pool).adultKg < c.massKg * .5));
    // A large hunter tries suitable larger prey first, not millions of insects
    // merely because that ledger was inserted first. This is an intrinsic size
    // preference, not knowledge of where unseen herds are or how many remain.
    if (pools.some(p => p.spatial)) pools.sort((a, b) => profile(b).adultKg - profile(a).adultKg || a.id.localeCompare(b.id));
    return pools.map(pool => pool.id);
  }
  function encounterFraction(pool, q) {
    if (!pool.spatial) return Math.min(1, q.areaHa / pool.areaHa)
      * (pool.habitatDepthM > 0 ? Math.min(1, q.depthM / pool.habitatDepthM) : 1);
    const p = q.position, site = pool.spatial;
    if (!p || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(p[k]))) return 0;
    const a = Math.sqrt(q.areaHa * 10000 / Math.PI), b = site.radiusM, d = Math.hypot(p.eastM - site.eastM, p.northM - site.northM);
    if (!(a > 0 && b > 0) || d >= a + b) return 0;
    const overlap = d <= Math.abs(a - b) ? Math.PI * Math.min(a, b) ** 2
      : a * a * Math.acos(Math.max(-1, Math.min(1, (d * d + a * a - b * b) / (2 * d * a))))
        + b * b * Math.acos(Math.max(-1, Math.min(1, (d * d + b * b - a * a) / (2 * d * b))))
        - .5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
    const depth = pool.habitatDepthM > 0 ? Math.max(0, Math.min(-p.altitudeM + q.depthM / 2, site.depthTopM + pool.habitatDepthM)
      - Math.max(0, -p.altitudeM - q.depthM / 2, site.depthTopM)) / pool.habitatDepthM : 1;
    return Math.min(1, overlap / (pool.areaHa * 10000)) * depth;
  }
  function capture(r, g, c, q, maximumKg, at) {
    const claims = []; let room = maximumKg;
    for (const id of q.guilds) {
      const pool = r.wildlife.pools.find(p => p.id === id); if (!pool || !suitable(r, pool) || !(room > EPS)) continue;
      pool.attempts += q.memberCount;
      if (pool.spatial && q.position?.regionId !== r.id) continue;
      const fraction = encounterFraction(pool, q);
      const eater = { speciesId: q.scavenge ? Lantern.ID : q.speciesId, carrionDiet: q.carrionDiet };
      if (pool.carcassSpace) {
        const body = Bodies.profiles[eater.speciesId || g.speciesId];
        const radius = Math.min(Math.sqrt(q.areaHa * 10000 / Math.PI), body?.reachM ?? 0);
        const sites = Carcasses.query(pool, q.position, radius).sites;
        let encountered = sites.reduce((n, site) => n + Tissues.available(site, eater), 0);
        if (!q.scavenge) for (const prey of pool.cohorts) {
          const n = Math.min(prey.count, Math.floor(prey.count * fraction * q.success + Life.random(`${q.id}:${prey.id}:catch`)),
            Math.max(0, Math.ceil((room - encountered) / Math.max(EPS, prey.massKg * .6))));
          pool.catches += lose(r, pool, prey, n, true, at, q.position);
          encountered += n * prey.massKg * .6;
        }
        if (!q.scavenge) {
          const originalIds = new Set(sites.map(site => site.id));
          for (const site of Carcasses.query(pool, q.position, radius).sites) if (!originalIds.has(site.id)) sites.push(site);
        }
        for (const site of sites) {
          const available = Tissues.available(site, eater);
          const kg = Math.min(room, available, q.scavenge ? available / site.count * Math.min(q.memberCount, site.count) : Infinity);
          if (kg > EPS) { claims.push({ sourceId: site.id, kg }); room -= kg; }
        }
        continue;
      }
      const encounteredKg = Tissues.available(pool.carcass, eater) * fraction;
      let caughtKg = 0;
      if (!q.scavenge) for (const prey of pool.cohorts) {
        const n = Math.min(prey.count, Math.floor(prey.count * fraction * q.success + Life.random(`${q.id}:${prey.id}:catch`)),
          Math.max(0, Math.ceil((room - encounteredKg - caughtKg) / Math.max(EPS, prey.massKg * .6))));
        const before = Tissues.available(pool.carcass, eater);
        pool.catches += lose(r, pool, prey, n, true, at);
        caughtKg += Tissues.available(pool.carcass, eater) - before;
      }
      const kg = Math.min(room, encounteredKg + caughtKg, Tissues.available(pool.carcass, eater));
      if (kg > EPS) { claims.push({ sourceId: pool.id, kg }); room -= kg; }
    }
    poolCleanup(r); return claims;
  }
  function validDefinition(r) {
    if (!r.wildlife) return true;
    const w = r.wildlife;
    return Array.isArray(w.pools) && new Set(w.pools.map(p => p.id)).size === w.pools.length && w.pools.every(p => profile(p)
      && (p.establishedDays == null || p.spatial && p.sizeClass && p.establishedDays === SETTLING_DAYS
        && (['background', 'hotspot-0', 'hotspot-1', 'hotspot-2'].includes(p.habitatPatch)
          || p.habitatPatch === 'reef-shelf' && r.kind === 'waterColumn' && r.biome === 'h' && p.guild === 'fish' && validSchoolSite(r, p.spatial)
          || p.habitatPatch === 'offshore-school' && p.guild === 'fish' && p.sizeClass === 'large' && p.foodKey === 'planktonKg'
            && validOffshoreSchoolSite(r, p.spatial) && p.originalMassKg <= p.areaHa * SCHOOL_KG_PER_HA + EPS))
      && (p.habitatPatch == null || p.establishedDays === SETTLING_DAYS)
      && (p.spatialCarcasses == null || p.spatialCarcasses === true && p.spatial && p.establishedDays === SETTLING_DAYS)
      && typeof p.id === 'string' && p.id && ['forageKg', 'organicKg', 'planktonKg'].includes(p.foodKey)
      && p.areaHa > 0 && p.areaHa <= r.areaHa && finite(p.habitatDepthM) && integer(p.originalCount) && integer(p.capacityCount)
      && p.capacityCount >= p.originalCount && finite(p.originalMassKg) && Math.abs(p.originalMassKg - p.originalCount * profile(p).adultKg) < EPS
      && Boolean(p.spatial) === Boolean(p.sizeClass)
      && (!p.spatial || p.sizeClass && ['eastM', 'northM'].every(k => Number.isFinite(p.spatial[k]))
        && p.spatial.radiusM > 0 && finite(p.spatial.radiusM) && finite(p.spatial.depthTopM)
        && Math.abs(Math.PI * p.spatial.radiusM ** 2 / 10000 - p.areaHa) < 1e-6 * Math.max(1, p.areaHa)
        && Math.hypot(p.spatial.eastM, p.spatial.northM) + p.spatial.radiusM <= Math.sqrt(r.areaHa * 10000 / Math.PI) + EPS
        && (p.guild !== 'fish' || p.spatial.depthTopM + p.habitatDepthM <= r.depthM + EPS)));
  }
  function valid(r, at, group, clock = at) {
    if (!r.wildlife) return true;
    if (!validDefinition(r)) return false;
    const w = r.wildlife;
    if (!finite(w.initializedAt) || !finite(w.lastDemographyAt) || w.lastDemographyAt > at + EPS
      || !integer(w.serial) || !Array.isArray(w.pending)) return false;
    for (const pool of w.pools) {
      if (pool.establishedDays) {
        const e = pool.establishment, deaths = initialDeaths(pool);
        if (!e || e.days !== SETTLING_DAYS || JSON.stringify(e.deaths) !== JSON.stringify(deaths)
          || !finite(e.decomposedKg) || Math.abs(e.decomposedKg - initialDecay(pool, deaths)) > 1e-7 * Math.max(1, e.decomposedKg)
          || e.decomposedKg > pool.carcass.decomposedKg + EPS
          || pool.deadCount < deaths.reduce((n, v) => n + v, 0)) return false;
      } else if (pool.establishment != null) return false;
      if (!['bornCount', 'deadCount', 'huntedCount', 'attempts', 'catches'].every(k => integer(pool[k]))
        || !['fundedKg', 'discardedKg', 'maintenanceKg', 'maintenanceWaterL', 'wasteKg'].every(k => finite(pool[k]))
        || !Array.isArray(pool.cohorts) || !Array.isArray(pool.broods) || !pool.plan
        || !integer(pool.plan.targetCount) || !finite(pool.plan.costPerDay) || !integer(pool.plan.monthIndex)
        || !finite(pool.plan.plannedAt) || pool.plan.plannedAt > at + EPS || !(pool.plan.end > pool.plan.plannedAt)) return false;
      if (pool.catches !== pool.huntedCount || !integer(total(pool))) return false;
      if (new Set(pool.cohorts.map(c => c.id)).size !== pool.cohorts.length || new Set(pool.broods.map(b => b.id)).size !== pool.broods.length) return false;
      if (pool.cohorts.some(c => typeof c.id !== 'string' || !c.id || !integer(c.count) || !(c.massKg > 0) || !finite(c.massKg) || c.massKg > profile(pool).adultKg + EPS
        || !Number.isFinite(c.bornAt) || c.bornAt > at + EPS || !finite(c.health) || c.health > 1 || !finite(c.hazard) || !finite(c.mortalityBalance))) return false;
      if (pool.broods.some(b => typeof b.id !== 'string' || !b.id || !integer(b.monthIndex) || !integer(b.targetCount) || !finite(b.investedKg) || !finite(b.dueAt)
        || b.investedKg > b.targetCount * profile(pool).newbornKg + EPS)) return false;
      const row = pool.carcass;
      if (!Carcasses.valid(pool, r.id, at, w.initializedAt)) return false;
      if (!row || !Tissues.valid(row) || !['initialMassKg', 'massKg', 'edibleKg', 'consumedKg', 'decomposedKg', 'lastAt'].every(k => finite(row[k]))
        || row.edibleKg > row.massKg + 1e-6 * Math.max(1, row.massKg) || row.lastAt > at + EPS
        || Math.abs(row.initialMassKg - row.massKg - row.consumedKg - row.decomposedKg) > 1e-6 * Math.max(1, row.initialMassKg)) return false;
      if (total(pool) + pool.deadCount + pool.huntedCount !== pool.originalCount + pool.bornCount) return false;
      const accounted = mass(pool) + pool.broods.reduce((n, b) => n + b.investedKg, 0) + row.initialMassKg + pool.discardedKg;
      if (Math.abs(accounted - pool.originalMassKg - pool.fundedKg) > 1e-6 * Math.max(1, accounted)) return false;
    }
    const claimed = new Set(), ids = new Set();
    return w.pending.every(q => {
      const g = group(q.groupId), c = g?.cohorts.find(c => c.id === q.cohortId);
      const key = `${q.groupId}:${q.cohortId}`;
      if (claimed.has(key) || ids.has(q.id)) return false;
      claimed.add(key); ids.add(q.id);
      return c && typeof q.id === 'string' && typeof q.scavenge === 'boolean' && g.regionId === r.id && !g.transit
        && q.scavenge === (g.speciesId === 'beast:carrion-lantern') && finite(q.startedAt) && q.startedAt <= at + EPS && q.dueAt === q.startedAt + DURATION
        && q.dueAt > clock && c.contactBusyUntil === q.dueAt && JSON.stringify(c.ranges) === JSON.stringify(q.ranges)
        && integer(q.memberCount) && q.memberCount === q.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0)
        && finite(q.areaHa) && q.areaHa <= r.areaHa && finite(q.depthM) && q.depthM <= 200
        && q.success === (q.scavenge ? 1 : Biology.lifecycle[g.speciesId].huntSuccess)
        && q.position && ['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(q.position[k]))
        && q.position.regionId === r.id && Array.isArray(q.guilds) && q.guilds.length > 0 && new Set(q.guilds).size === q.guilds.length
        && q.guilds.every(id => w.pools.some(p => p.id === id));
    });
  }
  function validRates(r, rate) {
    if (!r.wildlife) return rate.wildlifeRates == null && rate.wildlifeMaintenance == null;
    if (!Array.isArray(rate.wildlifeRates) || !Array.isArray(rate.wildlifeMaintenance)) return false;
    return rate.wildlifeRates.every(q => {
      const pool = r.wildlife.pools.find(p => p.id === q.poolId);
      return pool && finite(q.perDay) && finite(q.factor) && q.factor <= 1 && finite(q.remainingKg)
        && q.assimilation === profile(pool).assimilation && q.inputs && Object.values(q.inputs).every(finite)
        && (q.kind === 'wildlifeGrowth' ? pool.cohorts.some(c => c.id === q.cohortId)
          : q.kind === 'wildlifeBrood' && pool.broods.some(b => b.id === q.broodId));
    }) && rate.wildlifeMaintenance.every(q => r.wildlife.pools.some(p => p.id === q.poolId && p.cohorts.some(c => c.id === q.cohortId))
      && finite(q.food) && finite(q.water));
  }
  function summary(s) {
    const result = { original: 0, born: 0, living: 0, dead: 0, hunted: 0, liveKg: 0, consumedKg: 0, pending: 0, cohorts: 0,
      startingDead: 0, startingCarcassKg: 0, startingDecomposedKg: 0 };
    for (const r of s.regions) if (r.wildlife) {
      result.pending += r.wildlife.pending.length;
      for (const pool of r.wildlife.pools) {
        result.original += pool.originalCount; result.born += pool.bornCount; result.living += total(pool);
        result.dead += pool.deadCount; result.hunted += pool.huntedCount; result.liveKg += mass(pool);
        result.consumedKg += pool.carcass.consumedKg; result.cohorts += pool.cohorts.length;
        if (pool.establishment) {
          const kg = pool.establishment.deaths.reduce((n, v) => n + v, 0) * profile(pool).adultKg;
          result.startingDead += pool.establishment.deaths.reduce((n, v) => n + v, 0);
          result.startingCarcassKg += kg - pool.establishment.decomposedKg;
          result.startingDecomposedKg += pool.establishment.decomposedKg;
        }
      }
    }
    return result;
  }
  return { profiles, sizeClasses, profile, feedingGround, habitatPatches, initialDeaths, initialPosition, encounterFraction, definitions, allocate, apply, initialize, plan, prepare, fed, next, integrate, boundary, begin, finish, cancel,
    REEF_SCHOOL_MAX_RADIUS_M: SCHOOL_MAX_RADIUS_M, validReefSite: validSchoolSite, SCHOOL_MAX_RADIUS_M, validOffshoreSchoolSite, offshoreSchoolCount,
    compactCarcasses(r) { for (const pool of r.wildlife?.pools || []) Carcasses.compact(pool); },
    validDefinition, valid, validRates, summary, total, mass, guilds, capture, DURATION };
});
